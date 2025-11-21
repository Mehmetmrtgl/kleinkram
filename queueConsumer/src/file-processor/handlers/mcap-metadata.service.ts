import FileEntity from '@common/entities/file/file.entity';
import TopicEntity from '@common/entities/topic/topic.entity';
import { FileState } from '@common/frontend_shared/enum';
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
    ) {}

    /**
     * Extracts metadata from an MCAP file on disk and attaches it to the targetEntity.
     * @param filePath Physical path to the .mcap file
     * @param targetEntity The DB entity (Bag or Mcap) the topics should belong to
     * @returns The extracted metadata (for further use if needed)
     */
    async extractAndPersist(
        filePath: string,
        targetEntity: FileEntity,
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

            // If target is the actual MCAP file, we might want to save size here too
            // but for Bags we keep the Bag size.
            // We can make this optional or handle it in the caller if strictness is needed.
            if (targetEntity.filename.endsWith('.mcap')) {
                targetEntity.size = meta.size;
            }

            await this.fileRepo.save(targetEntity);
        } catch (error) {
            logger.error(
                `Metadata extraction failed for ${targetEntity.filename}: ${error}`,
            );
            // We assume the caller handles the specific error state (like deleting temp files)
            // but we mark the entity as corrupted/error here.
            targetEntity.state = FileState.CONVERSION_ERROR; // Or CORRUPTED
            await this.fileRepo.save(targetEntity);
            throw error;
        }
    }
}
