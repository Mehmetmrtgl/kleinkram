import FileEventEntity from '@common/entities/file/file-event.entity';
import FileEntity from '@common/entities/file/file.entity';
import TopicEntity from '@common/entities/topic/topic.entity';
import UserEntity from '@common/entities/user/user.entity';
import { Bag } from '@foxglove/rosbag';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fsPromises from 'node:fs/promises';
import { Repository } from 'typeorm';
import { AbstractMetadataService } from './abstract-metadata.service'; // Import Base
import { ExtractedTopicInfo } from './file-handler.interface';

class LocalBagReader {
    constructor(
        private handle: fsPromises.FileHandle,
        private _size: number,
    ) {}
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
export class RosBagMetadataService extends AbstractMetadataService {
    constructor(
        @InjectRepository(TopicEntity) topicRepo: Repository<TopicEntity>,
        @InjectRepository(FileEntity) fileRepo: Repository<FileEntity>,
        @InjectRepository(FileEventEntity)
        fileEventRepo: Repository<FileEventEntity>,
    ) {
        super(topicRepo, fileRepo, fileEventRepo);
    }

    async extractFromLocalFile(
        filePath: string,
        targetEntity: FileEntity,
        actor?: UserEntity,
    ): Promise<void> {
        // Start Timer
        const startTime = Date.now();

        const handle = await fsPromises.open(filePath, 'r');
        try {
            const stat = await handle.stat();
            const bagReader = new LocalBagReader(handle, stat.size);

            const bag = new Bag(bagReader);
            await bag.open();

            const rawTopics: ExtractedTopicInfo[] = [];
            const connectionCounts = new Map<number, number>();

            // Sum counts from ChunkInfos
            if (bag.chunkInfos) {
                for (const chunk of bag.chunkInfos) {
                    for (const { conn, count } of chunk.connections) {
                        const current = connectionCounts.get(conn) || 0;
                        connectionCounts.set(conn, current + count);
                    }
                }
            }

            // Iterate Connections
            const connections =
                bag.connections instanceof Map
                    ? bag.connections.values()
                    : Object.values(bag.connections as any);

            for (const connection of connections) {
                // @ts-ignore
                const connId = connection.conn;
                const count = connectionCounts.get(connId) || 0;

                rawTopics.push({
                    // @ts-ignore
                    name: connection.topic,
                    // @ts-ignore
                    type: connection.type || 'unknown',
                    nrMessages: BigInt(count),
                });
            }

            // Determine Date
            let fileDate: Date | undefined;
            if (bag.startTime) {
                fileDate = new Date(
                    Math.round(
                        bag.startTime.sec * 1000 + bag.startTime.nsec / 1e6,
                    ),
                );
            }

            // Delegate to Base Class for saving/event creation
            await this.finishExtraction(
                targetEntity,
                rawTopics,
                bagReader.size(),
                fileDate,
                'rosbag_stream',
                startTime,
                actor,
            );
        } finally {
            await handle.close();
        }
    }
}
