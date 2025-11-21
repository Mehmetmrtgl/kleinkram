import FileEventEntity from '@common/entities/file/file-event.entity';
import FileEntity from '@common/entities/file/file.entity';
import TopicEntity from '@common/entities/topic/topic.entity';
import UserEntity from '@common/entities/user/user.entity';
import { FileEventType, FileState } from '@common/frontend_shared/enum';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import logger from 'src/logger';
import { Repository } from 'typeorm';
import { McapParser } from '../helper/mcap-parser';

@Injectable()
export class McapMetadataService {
    constructor(
        @InjectRepository(TopicEntity)
        private topicRepo: Repository<TopicEntity>,
        @InjectRepository(FileEntity)
        private fileRepo: Repository<FileEntity>,
        @InjectRepository(FileEventEntity)
        private fileEventRepo: Repository<FileEventEntity>,
    ) {}

    /**
     * Extracts metadata from an MCAP file on disk and attaches it to the targetEntity.
     * @param filePath Physical path to the .mcap file
     * @param targetEntity The DB entity (Bag or Mcap) the topics should belong to
     * @param actor The user performing the action (optional). Leave undefined for "System".
     */
    async extractAndPersist(
        filePath: string,
        targetEntity: FileEntity,
        actor?: UserEntity,
    ): Promise<void> {
        try {
            const meta = await McapParser.extractMetadata(filePath);

            // Batch Insert Topics
            if (meta.topics.length > 0) {
                const topicEntities = meta.topics.map((t) =>
                    this.topicRepo.create({ ...t, file: targetEntity }),
                );
                await this.topicRepo.save(topicEntities, { chunk: 100 });
            }

            // Update the Target Entity (Date & State)
            targetEntity.date = meta.date ?? targetEntity.date;
            targetEntity.state = FileState.OK;

            if (targetEntity.filename.endsWith('.mcap')) {
                targetEntity.size = meta.size;
            }

            await this.fileRepo.save(targetEntity);

            // Create Topic Extraction Event
            // CHANGED: Removed `?? targetEntity.creator` to allow "System" (null actor)
            await this.fileEventRepo.save(
                this.fileEventRepo.create({
                    file: targetEntity,
                    ...(targetEntity.mission
                        ? { mission: targetEntity.mission }
                        : {}),
                    ...(actor ? { actor } : {}), // Only set actor if explicitly provided
                    type: FileEventType.TOPICS_EXTRACTED,
                    filenameSnapshot: targetEntity.filename,
                    details: {
                        topicCount: meta.topics.length,
                        extractedAt: new Date(),
                    },
                }),
            );
        } catch (error) {
            logger.error(
                `Metadata extraction failed for ${targetEntity.filename}: ${error}`,
            );
            targetEntity.state = FileState.CONVERSION_ERROR;
            await this.fileRepo.save(targetEntity);
            throw error;
        }
    }
}
