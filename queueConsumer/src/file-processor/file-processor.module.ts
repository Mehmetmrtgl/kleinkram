import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ActionDispatcherService } from '@common/modules/action-dispatcher/action-dispatcher.service';
import { FileIngestionService } from './file-ingestion.service';
import { FILE_HANDLER, FileHandler } from './handlers/file-handler.interface';
import { McapHandler } from './handlers/mcap.handler';
import { GoogleDriveStrategy } from './strategies/google-drive.strategy';
import { MinioStrategy } from './strategies/minio.strategy';

import ActionTemplateEntity from '@common/entities/action/action-template.entity';
import ActionEntity from '@common/entities/action/action.entity';
import FileEventEntity from '@common/entities/file/file-event.entity';
import FileEntity from '@common/entities/file/file.entity';
import IngestionJobEntity from '@common/entities/file/ingestion-job.entity';
import TopicEntity from '@common/entities/topic/topic.entity';
import WorkerEntity from '@common/entities/worker/worker.entity';
import { StorageModule } from '@common/modules/storage/storage.module';
import { makeGaugeProvider } from '@willsoto/nestjs-prometheus';
import { FileQueueProcessorProvider } from './file-queue-processor.provider';
import { RosBagHandler } from './handlers/bag.hander';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            FileEntity,
            IngestionJobEntity,
            TopicEntity,
            ActionEntity,
            ActionTemplateEntity,
            FileEventEntity,
            WorkerEntity,
        ]),
        BullModule.registerQueue({ name: 'file-queue' }),
        StorageModule,
    ],
    providers: [
        FileQueueProcessorProvider,
        FileIngestionService,
        GoogleDriveStrategy,
        MinioStrategy,
        ActionDispatcherService,

        McapHandler,
        RosBagHandler,

        makeGaugeProvider({
            name: 'backend_online_workers',
            help: 'Number of online workers',
            labelNames: ['queue'],
        }),
        makeGaugeProvider({
            name: 'backend_pending_jobs',
            help: 'Number of pending jobs',
            labelNames: ['queue'],
        }),
        makeGaugeProvider({
            name: 'backend_active_jobs',
            help: 'Number of active jobs',
            labelNames: ['queue'],
        }),
        makeGaugeProvider({
            name: 'backend_completed_jobs',
            help: 'Number of completed jobs',
            labelNames: ['queue'],
        }),
        makeGaugeProvider({
            name: 'backend_failed_jobs',
            help: 'Number of completed jobs',
            labelNames: ['queue'],
        }),

        {
            provide: FILE_HANDLER,
            useFactory: (
                bag: RosBagHandler,
                mcap: McapHandler,
            ): FileHandler[] => [bag, mcap],
            inject: [McapHandler, RosBagHandler],
        },
    ],
})
export class FileProcessorModule {}
