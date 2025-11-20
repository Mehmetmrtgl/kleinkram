import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'node:fs';
import { Repository } from 'typeorm';

import FileEntity from '@common/entities/file/file.entity';
import QueueEntity from '@common/entities/queue/queue.entity';
import TopicEntity from '@common/entities/topic/topic.entity';
import env from '@common/environment';
import {
    FileOrigin,
    FileState,
    FileType,
    QueueState,
} from '@common/frontend_shared/enum';
import { StorageService } from '@common/modules/storage/storage.service';
import logger from 'src/logger';

import path from 'node:path';
import { calculateFileHash } from '../helper/hash-helper';
import { McapParser } from '../helper/mcap-parser';
import { FileHandler, FileProcessingContext } from './file-handler.interface';
import { RosBagConverter } from './rosbag-converter';

@Injectable()
export class RosBagHandler implements FileHandler {
    constructor(
        @InjectRepository(FileEntity) private fileRepo: Repository<FileEntity>,
        @InjectRepository(TopicEntity)
        private topicRepo: Repository<TopicEntity>,
        @InjectRepository(QueueEntity)
        private queueRepo: Repository<QueueEntity>,
        private readonly storageService: StorageService,
    ) {}

    canHandle(filename: string): boolean {
        return filename.endsWith('.bag');
    }

    async process(context: FileProcessingContext): Promise<void> {
        const { primaryFile, filePath, workDirectory, queueItem } = context;

        // Check Auto-Convert Policy
        if (queueItem.mission?.project?.autoConvert === false) {
            logger.debug(`Auto-convert disabled for ${primaryFile.filename}`);
            return;
        }

        logger.debug(`Starting ROS Bag pipeline for ${primaryFile.filename}`);

        // Update Queue State
        queueItem.state = QueueState.CONVERTING_AND_EXTRACTING_TOPICS;
        await this.queueRepo.save(queueItem);

        // Prepare Target (MCAP) Entity
        const mcapFilename = primaryFile.filename.replace('.bag', '.mcap');
        const mcapOutputPath = path.join(workDirectory, mcapFilename);

        const mcapEntity = this.fileRepo.create({
            date: new Date(), // Will be updated after parsing
            mission: queueItem.mission,
            size: 0, // Will be updated
            filename: mcapFilename,
            creator: queueItem.creator,
            type: FileType.MCAP,
            state: FileState.CONVERTING,
            origin: FileOrigin.CONVERTED,
            relatedFile: primaryFile,
        } as FileEntity);

        // Save early to generate UUID
        const savedMcapEntity = await this.fileRepo.save(mcapEntity);

        // Link Bag -> Mcap
        primaryFile.relatedFile = savedMcapEntity;
        await this.fileRepo.update(primaryFile.uuid, {
            relatedFile: savedMcapEntity,
        });

        try {
            await RosBagConverter.convert(filePath, mcapOutputPath);

            if (!fs.existsSync(mcapOutputPath)) {
                throw new Error('Conversion output file missing');
            }

            const meta = await McapParser.extractMetadata(mcapOutputPath);
            const mcapHash = await calculateFileHash(mcapOutputPath);

            // Batch Insert Topics (Linked to the MCAP)
            if (meta.topics.length > 0) {
                const topicEntities = meta.topics.map((t) =>
                    this.topicRepo.create({ ...t, file: savedMcapEntity }),
                );
                await this.topicRepo.save(topicEntities, { chunk: 100 });
            }

            // Upload Converted File
            queueItem.state = QueueState.UPLOADING;
            await this.queueRepo.save(queueItem);

            await this.storageService.uploadFile(
                env.MINIO_DATA_BUCKET_NAME,
                savedMcapEntity.uuid,
                mcapOutputPath,
            );

            await this.storageService
                .addTags(env.MINIO_DATA_BUCKET_NAME, savedMcapEntity.uuid, {
                    missionUuid: queueItem.mission?.uuid ?? '',
                    filename: mcapFilename,
                })
                .catch((error: unknown) =>
                    logger.warn(`Tagging failed: ${error}`),
                );

            // Update MCAP Entity
            savedMcapEntity.size = meta.size;
            savedMcapEntity.hash = mcapHash;
            savedMcapEntity.date = meta.date;
            savedMcapEntity.state = FileState.OK;
            await this.fileRepo.save(savedMcapEntity);

            // Update Original BAG Entity (Sync date)
            primaryFile.date = meta.date ?? primaryFile.date;
            primaryFile.state = FileState.OK;
            await this.fileRepo.save(primaryFile);
        } catch (error) {
            logger.error(`RosBag Processing failed: ${error}`);
            savedMcapEntity.state = FileState.CONVERSION_ERROR;
            await this.fileRepo.save(savedMcapEntity);
            throw error;
        }
    }
}
