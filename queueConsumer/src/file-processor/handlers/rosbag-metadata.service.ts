import FileEventEntity from '@common/entities/file/file-event.entity';
import FileEntity from '@common/entities/file/file.entity';
import TopicEntity from '@common/entities/topic/topic.entity';
import UserEntity from '@common/entities/user/user.entity';
import { FileEventType, FileState } from '@common/frontend_shared/enum';
import { Bag } from '@foxglove/rosbag';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fsPromises from 'node:fs/promises';
import logger from 'src/logger';
import { Repository } from 'typeorm';

/**
 * Adapts Node.js fs.FileHandle to the BagReader interface required by @foxglove/rosbag
 */
class LocalBagReader {
    constructor(
        private handle: fsPromises.FileHandle,
        private _size: number,
    ) {}

    // Foxglove expects number, fs expects number (for legacy reasons),
    // but we should be careful with large files.
    async read(offset: number, length: number): Promise<Uint8Array> {
        const buffer = new Uint8Array(length);
        await this.handle.read(buffer, 0, length, offset);
        return buffer;
    }

    size(): number {
        return this._size;
    }
}

@Injectable()
export class RosBagMetadataService {
    constructor(
        @InjectRepository(TopicEntity)
        private topicRepo: Repository<TopicEntity>,
        @InjectRepository(FileEntity)
        private fileRepo: Repository<FileEntity>,
        @InjectRepository(FileEventEntity)
        private fileEventRepo: Repository<FileEventEntity>,
    ) {}

    /**
     * Extracts metadata directly from a local ROS1 .bag file
     * using streaming/random-access (no conversion required).
     */
    async extractFromLocalFile(
        filePath: string,
        targetEntity: FileEntity,
        actor?: UserEntity,
    ): Promise<void> {
        const handle = await fsPromises.open(filePath, 'r');
        try {
            const stat = await handle.stat();
            const bagReader = new LocalBagReader(handle, stat.size);
            await this.processBag(bagReader, targetEntity, actor);
        } finally {
            await handle.close();
        }
    }

    private async processBag(
        bagReader: LocalBagReader,
        targetEntity: FileEntity,
        actor?: UserEntity,
    ): Promise<void> {
        try {
            const bag = new Bag(bagReader);
            await bag.open();

            const topics: Partial<TopicEntity>[] = [];
            const connectionCounts = new Map<number, number>();

            // FIX 1: Iterate 'chunkInfos' to sum message counts
            // 'chunk.connections' is an Array of objects: { conn: number, count: number }
            if (bag.chunkInfos) {
                for (const chunk of bag.chunkInfos) {
                    for (const { conn, count } of chunk.connections) {
                        const current = connectionCounts.get(conn) || 0;
                        connectionCounts.set(conn, current + count);
                    }
                }
            }

            // FIX 2: Iterate 'bag.connections' as a Map
            // We iterate values directly since the connection object contains the topic name
            if (bag.connections instanceof Map) {
                for (const connection of bag.connections.values()) {
                    const count = connectionCounts.get(connection.conn) || 0;
                    topics.push({
                        name: connection.topic,
                        type: connection.type || 'unknown',
                        nrMessages: BigInt(count),
                        frequency: 0,
                        file: targetEntity,
                    });
                }
            } else {
                // Fallback if strict types aren't matching or version differs (treat as Record)
                for (const connection of Object.values(
                    bag.connections as any,
                )) {
                    // @ts-ignore
                    const connId = connection.conn;
                    const count = connectionCounts.get(connId) || 0;
                    // @ts-ignore
                    topics.push({
                        // @ts-ignore
                        name: connection.topic,
                        // @ts-ignore
                        type: connection.type || 'unknown',
                        nrMessages: BigInt(count),
                        frequency: 0,
                        file: targetEntity,
                    });
                }
            }

            // Deduplicate topics by name
            const uniqueTopicsMap = new Map<string, Partial<TopicEntity>>();

            if (topics.length > 0) {
                for (const t of topics) {
                    if (!t.name) continue;
                    if (uniqueTopicsMap.has(t.name)) {
                        const existing = uniqueTopicsMap.get(t.name);
                        if (existing) {
                            existing.nrMessages =
                                (existing.nrMessages as bigint) +
                                (t.nrMessages as bigint);
                        }
                    } else {
                        uniqueTopicsMap.set(t.name, t);
                    }
                }

                const uniqueTopics = [...uniqueTopicsMap.values()];
                const topicEntities = uniqueTopics.map((t) =>
                    this.topicRepo.create({ ...t, file: targetEntity }),
                );

                await this.topicRepo.save(topicEntities, { chunk: 100 });
            }

            if (bag.startTime) {
                const ms = Math.round(
                    bag.startTime.sec * 1000 + bag.startTime.nsec / 1e6,
                );
                targetEntity.date = new Date(ms);
            }

            targetEntity.state = FileState.OK;
            targetEntity.size = bagReader.size();

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
                        topicCount: uniqueTopicsMap?.size ?? topics.length,
                        method: 'rosbag_stream',
                        extractedAt: new Date(),
                    },
                }),
            );
        } catch (error) {
            logger.error(
                `Bag Metadata extraction failed for ${targetEntity.filename}: ${error}`,
            );
            targetEntity.state = FileState.CONVERSION_ERROR;
            await this.fileRepo.save(targetEntity);
            throw error;
        }
    }
}
