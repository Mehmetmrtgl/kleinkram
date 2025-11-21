import FileEventEntity from '@common/entities/file/file-event.entity';
import FileEntity from '@common/entities/file/file.entity';
import TopicEntity from '@common/entities/topic/topic.entity';
import UserEntity from '@common/entities/user/user.entity';
import { FileEventType, FileState } from '@common/frontend_shared/enum';
import { UniversalHttpReader } from '@common/frontend_shared/universal-http-reader';
import { McapIndexedReader } from '@mcap/core';
import { IReadable } from '@mcap/core/dist/cjs/src/types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fsPromises from 'node:fs/promises';
import logger from 'src/logger';
import { Repository } from 'typeorm';

/**
 * Simple wrapper to read local files using the Mcap IReadable interface.
 */
class LocalFileReader implements IReadable {
    constructor(
        private handle: fsPromises.FileHandle,
        private _size: number,
    ) {}

    async size(): Promise<bigint> {
        return new Promise((resolve) => resolve(BigInt(this._size)));
    }

    async read(offset: bigint, length: bigint): Promise<Uint8Array> {
        const buffer = new Uint8Array(Number(length));
        await this.handle.read(buffer, 0, Number(length), Number(offset));
        return buffer;
    }
}

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
     * Extracts metadata from a remote URL (Streamed, no download).
     */
    async extractFromUrl(
        presignedUrl: string,
        targetEntity: FileEntity,
        headers: Record<string, string> = {},
        actor?: UserEntity,
    ): Promise<void> {
        const fileReader = new UniversalHttpReader(presignedUrl, headers);
        await fileReader.init();
        await this.processReader(fileReader, targetEntity, actor);
    }
    /**
     * Extracts metadata from a local file path (No download, direct disk access).
     */
    async extractFromLocalFile(
        filePath: string,
        targetEntity: FileEntity,
        actor?: UserEntity,
    ): Promise<void> {
        const handle = await fsPromises.open(filePath, 'r');
        try {
            const stat = await handle.stat();
            const fileReader = new LocalFileReader(handle, stat.size);
            await this.processReader(fileReader, targetEntity, actor);
        } finally {
            await handle.close();
        }
    }

    /**
     * Shared logic for parsing MCAP structures.
     */
    private async processReader(
        readable: IReadable,
        targetEntity: FileEntity,
        actor?: UserEntity,
    ): Promise<void> {
        try {
            const reader = await McapIndexedReader.Initialize({ readable });
            const topics: Partial<TopicEntity>[] = [];

            if (reader.statistics) {
                for (const [channelId, count] of reader.statistics
                    .channelMessageCounts) {
                    const channel = reader.channelsById.get(channelId);
                    if (channel) {
                        topics.push({
                            name: channel.topic,
                            type:
                                channel.schemaId > 0
                                    ? (reader.schemasById.get(channel.schemaId)
                                          ?.name ?? 'unknown')
                                    : 'unknown',
                            nrMessages: count,
                            frequency: 0,
                        });
                    }
                }
            } else {
                for (const channel of reader.channelsById.values()) {
                    topics.push({
                        name: channel.topic,
                        type:
                            reader.schemasById.get(channel.schemaId)?.name ??
                            'unknown',
                        nrMessages: 0n,
                        frequency: 0,
                        file: targetEntity,
                    });
                }
            }

            if (topics.length > 0) {
                // Deduplicate topics by name
                const uniqueTopics = [
                    ...new Map(topics.map((t) => [t.name, t])).values(),
                ];
                const topicEntities = uniqueTopics.map((t) =>
                    this.topicRepo.create({ ...t, file: targetEntity }),
                );
                await this.topicRepo.save(topicEntities, { chunk: 100 });
            }

            // Update File Metadata
            if (reader.header) {
                // @ts-ignore: profileTime exists on header but types might be strict
                const profileTime = reader.header.profileTime;
                // Convert nanoseconds to milliseconds
                if (profileTime) {
                    targetEntity.date = new Date(
                        Number(profileTime / 1_000_000n),
                    );
                }
            }

            targetEntity.state = FileState.OK;
            targetEntity.size = Number(await readable.size());

            await this.fileRepo.save(targetEntity);

            await this.fileEventRepo.save(
                this.fileEventRepo.create({
                    file: targetEntity,
                    ...(targetEntity.mission
                        ? { mission: targetEntity.mission }
                        : {}),
                    ...(actor ? { actor } : {}),
                    type: FileEventType.TOPICS_EXTRACTED,
                    filenameSnapshot: targetEntity.filename,
                    details: {
                        topicCount: topics.length,
                        method: 'indexed_reader',
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
