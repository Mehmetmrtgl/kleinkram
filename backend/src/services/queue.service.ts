import { CancleProgessingResponseDto } from '@common/api/types/cancle-progessing-response.dto';
import { DeleteMissionResponseDto } from '@common/api/types/delete-mission-response.dto';
import { DriveCreate } from '@common/api/types/drive-create.dto';
import {
    FileQueueEntriesDto,
    FileQueueEntryDto,
} from '@common/api/types/file/file-queue-entry.dto';
import { UpdateTagTypeDto } from '@common/api/types/update-tag-type.dto';
import { redis } from '@common/consts';
import FileEntity from '@common/entities/file/file.entity';
import MissionEntity from '@common/entities/mission/mission.entity';
import QueueEntity from '@common/entities/queue/queue.entity';
import UserEntity from '@common/entities/user/user.entity';
import env from '@common/environment';
import {
    FileLocation,
    FileState,
    FileType,
    QueueState,
    UserRole,
} from '@common/frontend_shared/enum';
import { StorageService } from '@common/modules/storage/storage.service';
import { ConflictException, Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import Queue from 'bull';
import { Gauge } from 'prom-client';
import {
    FindOptionsWhere,
    In,
    IsNull,
    Like,
    MoreThan,
    Repository,
} from 'typeorm';
import { addAccessConstraints } from '../endpoints/auth/auth-helper';
import logger from '../logger';
import { missionEntityToDto } from '../serialization';
import { UserService } from './user.service';

function extractFileIdFromUrl(url: string): string | undefined {
    const filePattern = /\/file(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)/;
    const folderPattern = /\/drive(?:\/u\/\d+)?\/folders\/([a-zA-Z0-9_-]+)/;
    let match = filePattern.exec(url);
    if (match?.[1]) return match[1];
    match = folderPattern.exec(url);
    if (match?.[1]) return match[1];
    return undefined;
}

@Injectable()
export class QueueService implements OnModuleInit {
    private fileQueue!: Queue.Queue;

    constructor(
        @InjectRepository(QueueEntity)
        private queueRepository: Repository<QueueEntity>,
        @InjectRepository(MissionEntity)
        private missionRepository: Repository<MissionEntity>,
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        private userService: UserService,
        private readonly storageService: StorageService,

        // Metrics for File Queue
        @InjectMetric('backend_pending_jobs')
        private pendingJobs: Gauge,
        @InjectMetric('backend_active_jobs')
        private activeJobs: Gauge,
        @InjectMetric('backend_completed_jobs')
        private completedJobs: Gauge,
        @InjectMetric('backend_failed_jobs')
        private failedJobs: Gauge,
    ) {}

    async onModuleInit(): Promise<void> {
        this.fileQueue = new Queue('file-queue', { redis });
        logger.debug('File Queue initialized');
    }

    async importFromDrive(
        driveCreate: DriveCreate,
        user: UserEntity,
    ): Promise<UpdateTagTypeDto> {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: driveCreate.missionUUID },
        });
        const creator = await this.userService.findOneByUUID(user.uuid, {}, {});

        const fileId = extractFileIdFromUrl(driveCreate.driveURL);
        if (fileId === undefined)
            throw new ConflictException('Invalid Drive URL');

        const queueEntry = await this.queueRepository.save(
            this.queueRepository.create({
                identifier: fileId,
                display_name: `GoogleDrive Object (no id=${fileId})`,
                state: QueueState.AWAITING_PROCESSING,
                location: FileLocation.DRIVE,
                mission,
                creator,
            }),
        );

        await this.fileQueue
            .add('processDriveFile', { queueUuid: queueEntry.uuid })
            .catch((error: unknown) => logger.error(error));

        logger.debug('Added drive file to queue');
        return {};
    }

    async recalculateHashes(): Promise<{
        success: boolean;
        fileCount: number;
    }> {
        const files = await this.fileRepository.find({
            where: [
                { hash: IsNull(), state: FileState.OK },
                { hash: '', state: FileState.OK },
            ],
            relations: ['mission', 'mission.project'],
        });

        logger.debug(`Add ${files.length} files to queue for hash calculation`);

        for (const file of files) {
            try {
                await this.fileQueue.add('extractHashFromMinio', {
                    file_uuid: file.uuid,
                });
            } catch (error: any) {
                logger.error(error);
            }
        }

        return { success: true, fileCount: files.length };
    }

    async confirmUpload(uuid: string, md5: string): Promise<void> {
        const queue = await this.queueRepository.findOneOrFail({
            where: { identifier: uuid },
            relations: ['mission', 'mission.project'],
        });

        if (queue.state !== QueueState.AWAITING_UPLOAD) {
            throw new ConflictException('File is not in uploading state');
        }

        const file = await this.fileRepository.findOneOrFail({
            where: { uuid: uuid },
            relations: ['mission', 'mission.project'],
        });

        const fileInfo = await this.storageService
            .getFileInfo(env.MINIO_DATA_BUCKET_NAME, file.uuid)
            .catch(async () => {
                await this.fileRepository.remove(file);
                throw new ConflictException('File not found in Minio');
            });

        if (fileInfo === null) throw new Error('File not found in Minio');

        if (file.state === FileState.UPLOADING) file.state = FileState.OK;
        file.size = fileInfo?.size ?? 0;
        await this.fileRepository.save(file);

        queue.state = QueueState.AWAITING_PROCESSING;
        await this.queueRepository.save(queue);

        await this.fileQueue.add('processMinioFile', {
            queueUuid: queue.uuid,
            md5,
        });
    }

    async active(
        startDate: Date,
        stateFilter: string,
        userUUID: string,
        skip: number,
        take: number,
    ): Promise<any[]> {
        // @ts-ignore
        const user = await this.userService.findOneByUUID(userUUID);
        const where: FindOptionsWhere<QueueEntity> = {
            updatedAt: MoreThan(startDate),
        };

        if (user.role === UserRole.ADMIN) {
            if (stateFilter) {
                const filter = stateFilter
                    .split(',')
                    .map((state) => Number.parseInt(state));
                where.state = In(filter);
            }
            return await this.queueRepository.find({
                where,
                relations: ['mission', 'mission.project', 'creator'],
                skip,
                take,
                order: { createdAt: 'DESC' },
            });
        }

        const query = addAccessConstraints(
            this.queueRepository
                .createQueryBuilder('queue')
                .leftJoinAndSelect('queue.mission', 'mission')
                .leftJoinAndSelect('mission.project', 'project')
                .leftJoinAndSelect('queue.creator', 'creator')
                .where('queue.updatedAt > :startDate', { startDate }),
            userUUID,
        )
            .skip(skip)
            .take(take)
            .orderBy('queue.createdAt', 'DESC');

        if (stateFilter) {
            const filter = stateFilter
                .split(',')
                .map((state) => Number.parseInt(state));
            query.andWhere('queue.state IN (:...filter)', { filter });
        }
        return query.getMany();
    }

    async forFile(
        filename: string,
        missionUUID: string,
    ): Promise<FileQueueEntriesDto> {
        const entries = await this.queueRepository.find({
            where: {
                display_name: Like(`${filename}%`),
                mission: { uuid: missionUUID },
            },
            order: { createdAt: 'DESC' },
            relations: ['creator', 'mission', 'mission.project'],
        });

        const dtos = entries.map(
            (queue): FileQueueEntryDto => ({
                state: queue.state,
                uuid: queue.uuid,
                creator: {
                    uuid: queue.creator!.uuid,
                    name: queue.creator!.name,
                    avatarUrl: queue.creator!.avatarUrl ?? '',
                    email: null,
                },
                createdAt: queue.createdAt,
                display_name: queue.display_name,
                identifier: queue.identifier,
                processingDuration: queue.processingDuration ?? 0,
                updatedAt: queue.updatedAt,
                location: queue.location,
                mission: missionEntityToDto(queue.mission!),
            }),
        );

        return { data: dtos, count: dtos.length, take: dtos.length, skip: 0 };
    }

    async delete(
        missionUUID: string,
        queueUUID: string,
    ): Promise<DeleteMissionResponseDto> {
        const queue = await this.queueRepository.findOneOrFail({
            where: { uuid: queueUUID, mission: { uuid: missionUUID } },
            relations: ['mission', 'mission.project'],
        });

        if (
            queue.state >= QueueState.PROCESSING &&
            queue.state < QueueState.COMPLETED
        ) {
            throw new ConflictException('Cannot delete file while processing');
        }

        const waitingJobs = await this.fileQueue.getWaiting();
        const jobToRemove = waitingJobs.find(
            (job) => job.data.queueUuid === queueUUID,
        );
        if (jobToRemove) await jobToRemove.remove();

        await this.queueRepository.remove(queue);

        const file = await this.fileRepository.findOne({
            where: { uuid: queue.identifier, mission: { uuid: missionUUID } },
        });

        if (file) {
            await this.storageService
                .deleteFile(env.MINIO_DATA_BUCKET_NAME, file.uuid)
                .catch((e) => logger.log(e));
            await this.fileRepository.remove(file);

            if (file.type === FileType.BAG) {
                const mcap = await this.fileRepository.findOne({
                    where: {
                        uuid: queue.identifier,
                        mission: { uuid: missionUUID },
                    },
                });
                if (mcap) {
                    await this.storageService
                        .deleteFile(env.MINIO_DATA_BUCKET_NAME, mcap.uuid)
                        .catch((e) => logger.log(e));
                    await this.fileRepository.remove(mcap);
                }
            }
        }
        return {};
    }

    async cancelProcessing(
        queueUUID: string,
        missionUUID: string,
    ): Promise<CancleProgessingResponseDto> {
        const queue = await this.queueRepository.findOneOrFail({
            where: { uuid: queueUUID, mission: { uuid: missionUUID } },
            relations: ['mission', 'mission.project'],
        });

        if (queue.state >= QueueState.PROCESSING) {
            throw new ConflictException('File is not in processing state');
        }

        const waitingJobs = await this.fileQueue.getWaiting();
        const jobToRemove = waitingJobs.find(
            (job) => job.data.queueUuid === queueUUID,
        );
        if (jobToRemove) await jobToRemove.remove();

        queue.state = QueueState.CANCELED;
        await this.queueRepository.save(queue);

        return {};
    }

    /**
     * Updates Prometheus metrics for File Queue
     */
    @Cron(CronExpression.EVERY_SECOND)
    async checkQueueState() {
        const jobsCount = await this.fileQueue.getJobCounts();
        const label = { queue: 'fileQueue' };

        this.pendingJobs.set(label, jobsCount.waiting + jobsCount.delayed);
        this.activeJobs.set(label, jobsCount.active);
        this.completedJobs.set(label, jobsCount.completed);
        this.failedJobs.set(label, jobsCount.failed);
    }
}
