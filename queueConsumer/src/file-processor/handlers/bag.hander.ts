import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import path from 'node:path';
import { Repository } from 'typeorm';

import FileEntity from '@common/entities/file/file.entity';
import IngestionJobEntity from '@common/entities/file/ingestion-job.entity';
import env from '@common/environment';
import {
    FileEventType,
    FileOrigin,
    FileState,
    FileType,
    QueueState,
} from '@common/frontend_shared/enum';
import { StorageService } from '@common/modules/storage/storage.service';
import logger from 'src/logger';

import FileEventEntity from '@common/entities/file/file-event.entity';
import { calculateFileHash } from '../helper/hash-helper';
import { FileHandler, FileProcessingContext } from './file-handler.interface';
import { McapMetadataService } from './mcap-metadata.service';
import { RosBagConverter } from './rosbag-converter';

@Injectable()
export class RosBagHandler implements FileHandler {
    constructor(
        @InjectRepository(FileEntity) private fileRepo: Repository<FileEntity>,
        @InjectRepository(IngestionJobEntity)
        private jobRepo: Repository<IngestionJobEntity>,
        @InjectRepository(FileEventEntity)
        private fileEventRepo: Repository<FileEventEntity>,
        private readonly storageService: StorageService,
        private readonly mcapMetadataService: McapMetadataService,
    ) {}

    canHandle(filename: string): boolean {
        return filename.endsWith('.bag');
    }

    async process(context: FileProcessingContext): Promise<void> {
        const { primaryFile, filePath, workDirectory, queueItem } = context;
        const job = queueItem as unknown as IngestionJobEntity;
        const autoConvert = job.mission?.project?.autoConvert !== false;

        logger.debug(
            `Starting ROS Bag pipeline for ${primaryFile.filename} (AutoConvert: ${autoConvert})`,
        );

        job.state = QueueState.CONVERTING_AND_EXTRACTING_TOPICS;
        await this.jobRepo.save(job);

        const mcapFilename = primaryFile.filename.replace('.bag', '.mcap');
        const mcapOutputPath = path.join(workDirectory, mcapFilename);

        try {
            // Convert (Required for both cases)
            await RosBagConverter.convert(filePath, mcapOutputPath);

            if (!fs.existsSync(mcapOutputPath)) {
                throw new Error('Conversion output file missing');
            }

            await (autoConvert
                ? this.handleAutoConvert(
                      primaryFile,
                      job,
                      mcapOutputPath,
                      mcapFilename,
                  )
                : this.handleExtractionOnly(primaryFile, mcapOutputPath));
        } catch (error) {
            logger.error(`RosBag Processing failed: ${error}`);
            // Ensure we don't leave temp files in the extraction-only case
            if (!autoConvert && fs.existsSync(mcapOutputPath)) {
                await fsPromises.unlink(mcapOutputPath).catch(() => ({}));
            }

            primaryFile.state = FileState.CONVERSION_ERROR;
            await this.fileRepo.save(primaryFile);
            throw error;
        }
    }

    /**
     * Case 1: AutoConvert is DISABLED.
     * We extract topics from the temp MCAP, assign them to the BAG, then delete the MCAP.
     */
    private async handleExtractionOnly(
        primaryFile: FileEntity,
        mcapPath: string,
    ): Promise<void> {
        logger.debug(
            `Extracting topics to original Bag file: ${primaryFile.filename}`,
        );

        // CHANGED: Removed job.creator to allow "System" actor
        await this.mcapMetadataService.extractAndPersist(mcapPath, primaryFile);

        await fsPromises.unlink(mcapPath);
        logger.debug(`Temporary MCAP deleted for ${primaryFile.filename}`);
    }

    private async handleAutoConvert(
        primaryFile: FileEntity,
        job: IngestionJobEntity,
        mcapPath: string,
        mcapFilename: string,
    ): Promise<void> {
        const mcapEntity = this.fileRepo.create({
            date: new Date(),
            mission: job.mission,
            size: 0,
            filename: mcapFilename,
            creator: job.creator,
            type: FileType.MCAP,
            state: FileState.CONVERTING,
            origin: FileOrigin.CONVERTED,
            parent: primaryFile,
        } as FileEntity);

        const savedMcapEntity = await this.fileRepo.save(mcapEntity);

        try {
            await this.mcapMetadataService.extractAndPersist(
                mcapPath,
                savedMcapEntity,
            );

            savedMcapEntity.hash = await calculateFileHash(mcapPath);
            await this.fileRepo.save(savedMcapEntity);

            job.state = QueueState.UPLOADING;
            await this.jobRepo.save(job);

            await this.storageService.uploadFile(
                env.MINIO_DATA_BUCKET_NAME,
                savedMcapEntity.uuid,
                mcapPath,
            );

            await this.storageService
                .addTags(env.MINIO_DATA_BUCKET_NAME, savedMcapEntity.uuid, {
                    missionUuid: job.mission?.uuid ?? '',
                    filename: mcapFilename,
                })
                .catch((error: unknown) =>
                    logger.warn(`Tagging failed: ${error}`),
                );

            primaryFile.date = savedMcapEntity.date ?? primaryFile.date;
            primaryFile.state = FileState.OK;
            await this.fileRepo.save(primaryFile);

            // Event on Original BAG (Converted TO) ---
            await this.fileEventRepo.save(
                this.fileEventRepo.create({
                    file: primaryFile,
                    ...(job.mission ? { mission: job.mission } : {}),
                    // actor undefined -> System
                    type: FileEventType.FILE_CONVERTED,
                    filenameSnapshot: primaryFile.filename,
                    details: {
                        generatedFileUuid: savedMcapEntity.uuid,
                        generatedFilename: savedMcapEntity.filename,
                    },
                }),
            );

            // Event on New MCAP (Converted FROM) ---
            await this.fileEventRepo.save(
                this.fileEventRepo.create({
                    file: savedMcapEntity,
                    ...(job.mission ? { mission: job.mission } : {}),
                    // actor undefined -> System
                    type: FileEventType.FILE_CONVERTED_FROM,
                    filenameSnapshot: savedMcapEntity.filename,
                    details: {
                        sourceFileUuid: primaryFile.uuid,
                        sourceFilename: primaryFile.filename,
                    },
                }),
            );
        } catch (error: unknown) {
            savedMcapEntity.state = FileState.CONVERSION_ERROR;
            await this.fileRepo.save(savedMcapEntity);
            throw error;
        }
    }
}
