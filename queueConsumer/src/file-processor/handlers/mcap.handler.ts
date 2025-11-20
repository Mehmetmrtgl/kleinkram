// src/modules/file-processor/handlers/mcap.handler.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import logger from 'src/logger';
import { Repository } from 'typeorm';

import FileEntity from '@common/entities/file/file.entity';
import TopicEntity from '@common/entities/topic/topic.entity';
import { FileState } from '@common/frontend_shared/enum';
import { McapParser } from '../helper/mcap-parser'; // [Import the new parser]
import { FileHandler, FileProcessingContext } from './file-handler.interface';

@Injectable()
export class McapHandler implements FileHandler {
    constructor(
        @InjectRepository(TopicEntity)
        private topicRepo: Repository<TopicEntity>,
        @InjectRepository(FileEntity) private fileRepo: Repository<FileEntity>,
    ) {}

    canHandle(filename: string): boolean {
        return filename.endsWith('.mcap');
    }

    async process(context: FileProcessingContext): Promise<void> {
        const { primaryFile, filePath } = context;
        logger.debug(`Extracting topics from ${primaryFile.filename}`);

        try {
            const { topics, date } = await McapParser.extractMetadata(filePath);

            // batch insert topics
            if (topics.length > 0) {
                const topicEntities = topics.map((t) =>
                    this.topicRepo.create({ ...t, file: primaryFile }),
                );

                await this.topicRepo.save(topicEntities, { chunk: 100 });
            }

            primaryFile.date = date;
            primaryFile.state = FileState.OK;
            await this.fileRepo.save(primaryFile);
        } catch (error) {
            logger.error(
                `Extraction failed for ${primaryFile.filename}: ${error}`,
            );

            primaryFile.state = FileState.CORRUPTED;
            await this.fileRepo.save(primaryFile);

            throw error; // Re-throw to ensure queue marks job as failed
        }
    }
}
