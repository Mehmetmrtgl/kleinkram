import { redis, systemUser } from '@common/consts';
import FileEntity from '@common/entities/file/file.entity';
import IngestionJobEntity from '@common/entities/file/ingestion-job.entity';
import MissionEntity from '@common/entities/mission/mission.entity';
import UserEntity from '@common/entities/user/user.entity';
import env from '@common/environment';
import {
    AccessGroupRights,
    FileLocation,
    FileOrigin,
    FileState,
    FileType,
    QueueState,
    UserRole,
} from '@common/frontend_shared/enum';
import { StorageService } from '@common/modules/storage/storage.service';
import { MissionAccessViewEntity } from '@common/viewEntities/mission-access-view.entity';
import { ProjectAccessViewEntity } from '@common/viewEntities/project-access-view.entity';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, Queue } from 'bull';
import { Redis } from 'ioredis';
import crypto from 'node:crypto';
import Redlock from 'redlock';
import {
    In,
    IsNull,
    LessThanOrEqual,
    MoreThanOrEqual,
    Not,
    Repository,
} from 'typeorm';
import logger from '../logger';

type CancelUploadJob = Job<{
    uuids: string[];
    missionUUID: string;
    userUUID: string;
}>;

@Processor('file-cleanup')
@Injectable()
export class FileCleanupQueueProcessorProvider implements OnModuleInit {
    private redlock!: Redlock;

    constructor(
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        @InjectRepository(IngestionJobEntity)
        private queueRepository: Repository<IngestionJobEntity>,
        @InjectRepository(UserEntity)
        private userRepository: Repository<UserEntity>,
        @InjectRepository(MissionEntity)
        private missionRepository: Repository<MissionEntity>,
        @InjectRepository(ProjectAccessViewEntity)
        private projectAccessView: Repository<ProjectAccessViewEntity>,
        @InjectRepository(MissionAccessViewEntity)
        private missionAccessView: Repository<MissionAccessViewEntity>,
        @InjectQueue('file-queue') private readonly fileQueue: Queue,
        private readonly storageService: StorageService,
    ) {}

    onModuleInit(): void {
        const redisClient = new Redis(redis);
        this.redlock = new Redlock([redisClient], {
            retryCount: 0,
            retryDelay: 200, // Time in ms between retries
        });
    }

    @Process({ concurrency: 10, name: 'cancelUpload' })
    async process(job: CancelUploadJob): Promise<void> {
        const userUUID = job.data.userUUID;
        const uuids = job.data.uuids;
        const missionUUID = job.data.missionUUID;
        const canCancelUpload = await this.canCancelUpload(
            userUUID,
            missionUUID,
        );
        if (!canCancelUpload) {
            logger.debug(`User ${userUUID} can't cancel upload`);
            return;
        }
        await Promise.all(
            uuids.map(async (uuid) => {
                const file = await this.fileRepository.findOne({
                    where: { uuid, mission: { uuid: missionUUID } },
                    relations: ['mission'],
                });
                if (!file) {
                    return;
                }
                if (file.state === FileState.OK) {
                    return;
                }

                if (file.mission === undefined) {
                    logger.error(
                        `Mission of file ${file.uuid} is undefined, skipping`,
                    );
                    return;
                }

                const queue = await this.queueRepository.findOneOrFail({
                    where: {
                        display_name: file.filename,
                        mission: { uuid: file.mission.uuid },
                    },
                });
                queue.state = QueueState.CANCELED;
                await this.queueRepository.save(queue);
                await this.fileRepository.remove(file);
                return;
            }),
        );
    }

    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async fixFileHashes(): Promise<void> {
        await this.redlock
            .using([`lock:hash-repair`], 10_000, async () => {
                logger.debug('Fixing file hashes');

                const files = await this.fileRepository.find({
                    where: { hash: IsNull(), state: Not(FileState.LOST) },
                    relations: ['mission', 'mission.project'],
                });
                for (const file of files) {
                    const hash = crypto.createHash('md5');

                    if (file.mission === undefined) {
                        logger.error(
                            `Mission of file ${file.uuid} is undefined, skipping`,
                        );
                        continue;
                    }

                    if (file.mission.project === undefined) {
                        logger.error(
                            `Project of file ${file.uuid} is undefined, skipping`,
                        );
                        continue;
                    }

                    // REFACTORED: Use StorageService to get stream
                    const datastream = await this.storageService.getFileStream(
                        env.MINIO_DATA_BUCKET_NAME,
                        `${file.mission.project.name}/${file.mission.name}/${file.filename}`,
                    );
                    await new Promise((resolve, reject) => {
                        datastream.on('error', (error) => {
                            logger.error(error);
                            resolve(void 0);
                        });
                        datastream.on('data', (chunk) => {
                            hash.update(chunk);
                        });
                        datastream.on('end', () => {
                            file.hash = hash.digest('base64');
                            this.fileRepository
                                .save(file)
                                .then(resolve)
                                .catch((error: unknown) => {
                                    reject(error as Error);
                                });
                        });
                    });
                }
            })
            .catch(() => {
                logger.debug("Couldn't acquire lock for hash repair");
            });
    }

    @Cron(CronExpression.EVERY_DAY_AT_1AM)
    async cleanupFailedUploads(): Promise<void> {
        await this.redlock
            .using([`lock:cleanup-failed-uploads`], 10_000, async () => {
                logger.debug('Cleaning up failed uploads');
                const failedUploads = await this.fileRepository.find({
                    where: {
                        state: FileState.UPLOADING,
                        updatedAt: LessThanOrEqual(
                            new Date(Date.now() - 1000 * 60 * 60 * 12),
                        ),
                    },
                });
                await Promise.all(
                    failedUploads.map(async (file) => {
                        file.state = FileState.ERROR;
                        await this.fileRepository.save(file);

                        if (file.mission === undefined) {
                            logger.error(
                                `Mission of file ${file.uuid} is undefined, skipping`,
                            );
                            return;
                        }

                        const queue = await this.queueRepository.findOne({
                            where: {
                                display_name: file.filename,
                                mission: { uuid: file.mission.uuid },
                            },
                        });
                        if (queue) {
                            queue.state = QueueState.ERROR;
                            await this.queueRepository.save(queue);
                        }
                    }),
                );

                // set pending queue entries to error
                const pendingQueues = await this.queueRepository.find({
                    where: {
                        state: QueueState.AWAITING_UPLOAD,
                        updatedAt: LessThanOrEqual(
                            new Date(Date.now() - 1000 * 60 * 60 * 12),
                        ),
                    },
                });
                await Promise.all(
                    pendingQueues.map(async (queue) => {
                        queue.state = QueueState.ERROR;
                        await this.queueRepository.save(queue);
                    }),
                );
            })
            .catch(() => {
                logger.debug(
                    "Couldn't acquire lock for cleanup failed uploads",
                );
            });
    }

    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async synchronizeFileSystem(): Promise<void> {
        await this.redlock
            .using([`lock:fs-sync`], 10_000, async () => {
                logger.debug('Synchronizing file system');

                const files = await this.fileRepository.find({
                    where: { state: In([FileState.OK, FileState.FOUND]) },
                });
                let count = 0;
                await Promise.all(
                    files.map(async (file) => {
                        const exists = await this.doesFileExist(
                            env.MINIO_DATA_BUCKET_NAME,
                            file.uuid,
                        );
                        if (!exists) {
                            count++;
                            file.state = FileState.LOST;
                            logger.error(
                                `File ${file.filename} is missing in minio`,
                            );
                            await this.fileRepository.save(file);
                        }
                    }),
                );
                if (count === 0) {
                    logger.info(
                        'All files from the database are present in the minio storage',
                    );
                } else {
                    logger.info(
                        `${count.toString()} files are missing in the minio storage`,
                    );
                }

                // search for lost files
                const lostFiles = await this.fileRepository.find({
                    where: { state: FileState.LOST },
                });

                await Promise.all(
                    lostFiles.map(async (file) => {
                        const exists = await this.doesFileExist(
                            env.MINIO_DATA_BUCKET_NAME,
                            file.uuid,
                        );
                        if (exists) {
                            file.state = FileState.FOUND;
                            logger.info(
                                `Previously lost file ${file.filename} found`,
                            );
                            await this.fileRepository.save(file);
                        }
                    }),
                );

                // #####################
                // search for files present in minio but missing in DB
                // #####################
                await this.missingInDB(FileType.BAG);
                await this.missingInDB(FileType.MCAP);
            })
            .catch(() => {
                logger.debug("Couldn't acquire lock for fs sync");
            });
    }

    async missingInDB(fileType: FileType): Promise<void> {
        const bucket = env.MINIO_DATA_BUCKET_NAME;
        const minioObjects = await this.storageService.listFiles(bucket);

        const minioObjectNamesSet = new Set<string>(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            minioObjects.map((object) => object.name!),
        );

        const databaseObjects = await this.fileRepository.find({
            where: { type: fileType },
        });
        const databaseObjectNames = new Set(
            databaseObjects.map((object) => object.uuid),
        );
        const missingObjects =
            minioObjectNamesSet.difference(databaseObjectNames);

        await Promise.all(
            [...missingObjects].map(async (object) => {
                const tags = await this.storageService.getTags(bucket, object);

                const missionUUID = tags['missionUuid'];
                const filename = tags['filename'];

                const minioObject = await this.storageService.getFileInfo(
                    bucket,
                    object,
                );

                if (
                    missionUUID === undefined ||
                    filename === undefined ||
                    !minioObject
                ) {
                    logger.error(
                        `Missing tags or stats in minio object: UUID: ${object}, has Tags:${JSON.stringify(tags)} in ${fileType === FileType.MCAP ? 'MCAP' : 'BAG'} bucket`,
                    );
                    return;
                }

                const mission = await this.missionRepository.findOne({
                    where: {
                        uuid: missionUUID,
                    },
                });
                if (!mission) {
                    throw new Error(
                        `Mission of file to be recovered not found: mission UUID:${missionUUID}`,
                    );
                }
                const recoverQueue = this.queueRepository.create({
                    identifier: object,

                    display_name: filename,
                    state: QueueState.AWAITING_PROCESSING,
                    location: FileLocation.MINIO,
                    mission: { uuid: missionUUID },
                    creator: { uuid: systemUser.uuid },
                });

                const fileEntity = this.fileRepository.create({
                    uuid: object,
                    mission: { uuid: missionUUID },
                    date: new Date(),
                    filename,
                    size: minioObject.size,
                    creator: { uuid: systemUser.uuid },
                    type: fileType,
                    origin: FileOrigin.UNKNOWN,
                });
                try {
                    const queueEntity =
                        await this.queueRepository.save(recoverQueue);

                    await this.fileRepository.save(fileEntity);
                    await this.fileQueue.add('processMinioFile', {
                        queueUuid: queueEntity.uuid,
                        recovering: true,
                    });
                } catch {
                    logger.error(
                        `Failed to recover file ${object} in mission ${missionUUID}`,
                    );
                }
                logger.error(
                    `Found missing object in minio: UUID: ${object}, has Tags:${JSON.stringify(tags)} in ${fileType === FileType.MCAP ? 'MCAP' : 'BAG'} bucket`,
                );
            }),
        );
        if (missingObjects.size === 0) {
            logger.info(
                `All Files in ${fileType === FileType.MCAP ? 'MCAP' : 'BAG'} bucket are in the DB`,
            );
        }
    }

    async canCancelUpload(
        userUUID: string,
        missionUUID: string,
    ): Promise<boolean> {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        if (!user) {
            return false;
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['project'],
        });
        if (mission === undefined) {
            logger.error(
                `Mission ${missionUUID} is undefined, skipping cancel upload`,
            );
            return false;
        }

        if (mission.project === undefined) {
            logger.error(
                `Project of mission ${mission.uuid} is undefined, skipping`,
            );
            return false;
        }

        const canAccessProject = await this.projectAccessView.exists({
            where: {
                projectUuid: mission.project.uuid,
                userUuid: userUUID,
                rights: MoreThanOrEqual(AccessGroupRights.WRITE),
            },
        });
        if (canAccessProject) {
            return true;
        }
        return await this.missionAccessView.exists({
            where: {
                missionUuid: missionUUID,
                userUuid: userUUID,
                rights: MoreThanOrEqual(AccessGroupRights.WRITE),
            },
        });
    }

    async doesFileExist(
        bucketName: string,
        objectName: string,
    ): Promise<boolean> {
        const info = await this.storageService.getFileInfo(
            bucketName,
            objectName,
        );
        return !!info;
    }
}
