import FileEventEntity from '@common/entities/file/file-event.entity';
import FileEntity from '@common/entities/file/file.entity';
import TopicEntity from '@common/entities/topic/topic.entity';
import UserEntity from '@common/entities/user/user.entity';
import { UniversalHttpReader } from '@common/frontend_shared/universal-http-reader';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
// Database importunu bu şekilde yapıyoruz
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Repository } from 'typeorm';
import { AbstractMetadataService } from './abstract-metadata.service';
import { ExtractedTopicInfo } from './file-handler.interface';

@Injectable()
export class Db3MetadataService extends AbstractMetadataService {
    private readonly logger = new Logger(Db3MetadataService.name);

    constructor(
        @InjectRepository(TopicEntity) topicRepo: Repository<TopicEntity>,
        @InjectRepository(FileEntity) fileRepo: Repository<FileEntity>,
        @InjectRepository(FileEventEntity)
        fileEventRepo: Repository<FileEventEntity>,
    ) {
        super(topicRepo, fileRepo, fileEventRepo);
    }

    async extractFromUrl(
        presignedUrl: string,
        targetEntity: FileEntity,
        actor?: UserEntity,
    ): Promise<void> {
        const startTime = Date.now();
        
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `ros2_${targetEntity.uuid}.db3`);

        try {
            this.logger.debug(`Downloading DB3 file to temp: ${tempFilePath}`);
            
            const httpReader = new UniversalHttpReader(presignedUrl);
            await httpReader.init();
            
            const fileSize = Number(httpReader.sizeBytes);
            const data = await httpReader.read(0n, BigInt(fileSize));
            
            fs.writeFileSync(tempFilePath, data);

            await this.extractFromLocalFile(tempFilePath, targetEntity, actor, startTime);

        } catch (error) {
            this.logger.error(`Error processing DB3 from URL: ${error}`);
            throw error;
        } finally {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    }

    async extractFromLocalFile(
        filePath: string,
        targetEntity: FileEntity,
        actor?: UserEntity,
        providedStartTime?: number,
    ): Promise<void> {
        const startTime = providedStartTime || Date.now();
        

        let db: any = null;

        try {

            db = new Database(filePath, { readonly: true });

            const rawTopics: ExtractedTopicInfo[] = [];


            const topicsQuery = db.prepare('SELECT id, name, type FROM topics');
            const topics = topicsQuery.all() as { id: number; name: string; type: string }[];


            const countQuery = db.prepare('SELECT count(*) as count FROM messages WHERE topic_id = ?');

            for (const topic of topics) {
                const result = countQuery.get(topic.id) as { count: number };
                
                rawTopics.push({
                    name: topic.name,
                    type: topic.type,
                    nrMessages: BigInt(result.count),
                });
            }


            let fileDate: Date | undefined;
            const timeQuery = db.prepare('SELECT MIN(timestamp) as start_time FROM messages');
            const timeResult = timeQuery.get() as { start_time: number | bigint };

            if (timeResult && timeResult.start_time) {
                const nanos = BigInt(timeResult.start_time);
                const millis = Number(nanos / 1_000_000n);
                fileDate = new Date(millis);
            }

            const stats = fs.statSync(filePath);

            await this.finishExtraction(
                targetEntity,
                rawTopics,
                stats.size,
                fileDate,
                'ros2_sqlite_parser',
                startTime,
                actor,
            );

        } catch (error) {
            this.logger.error(`Failed to parse DB3 file: ${error}`);
            throw new Error(`Invalid DB3/SQLite format: ${error}`);
        } finally {
            if (db) {
                db.close();
            }
        }
    }
}
