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
    FileOrigin,
    FileState,
    FileType,
    QueueState,
} from '@common/frontend_shared/enum';
import { StorageService } from '@common/modules/storage/storage.service';
import logger from 'src/logger';

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

        // Define paths
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

        // Use the shared service to put topics onto the *primaryFile* (the BAG)
        await this.mcapMetadataService.extractAndPersist(mcapPath, primaryFile);

        // Cleanup: Delete the temporary MCAP file
        await fsPromises.unlink(mcapPath);
        logger.debug(`Temporary MCAP deleted for ${primaryFile.filename}`);
    }

    /**
     * Case 2: AutoConvert is ENABLED.
     * We create a new MCAP entity, extract topics to it, and upload it.
     */
    private async handleAutoConvert(
        primaryFile: FileEntity,
        job: IngestionJobEntity,
        mcapPath: string,
        mcapFilename: string,
    ): Promise<void> {
        // Create the MCAP Entity
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
            // Extract topics onto the *new MCAP entity*
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

            // Add Tags
            await this.storageService
                .addTags(env.MINIO_DATA_BUCKET_NAME, savedMcapEntity.uuid, {
                    missionUuid: job.mission?.uuid ?? '',
                    filename: mcapFilename,
                })
                .catch((error) => logger.warn(`Tagging failed: ${error}`));

            // Sync Original Bag Date if needed
            primaryFile.date = savedMcapEntity.date ?? primaryFile.date;
            primaryFile.state = FileState.OK;
            await this.fileRepo.save(primaryFile);
        } catch (error) {
            savedMcapEntity.state = FileState.CONVERSION_ERROR;
            await this.fileRepo.save(savedMcapEntity);
            throw error;
        }
    }
}
