import ActionTemplateEntity from '@common/entities/action/action-template.entity';
import ActionEntity from '@common/entities/action/action.entity';
import AccessGroupEntity from '@common/entities/auth/accessgroup.entity';
import AccountEntity from '@common/entities/auth/account.entity';
import ApikeyEntity from '@common/entities/auth/apikey.entity';
import GroupMembershipEntity from '@common/entities/auth/group-membership.entity';
import MissionAccessEntity from '@common/entities/auth/mission-access.entity';
import ProjectAccessEntity from '@common/entities/auth/project-access.entity';
import CategoryEntity from '@common/entities/category/category.entity';
import FileEntity from '@common/entities/file/file.entity';
import MetadataEntity from '@common/entities/metadata/metadata.entity';
import MissionEntity from '@common/entities/mission/mission.entity';
import ProjectEntity from '@common/entities/project/project.entity';
import QueueEntity from '@common/entities/queue/queue.entity';
import TagTypeEntity from '@common/entities/tagType/tag-type.entity';
import TopicEntity from '@common/entities/topic/topic.entity';
import UserEntity from '@common/entities/user/user.entity';
import WorkerEntity from '@common/entities/worker/worker.entity';
import env from '@common/environment';
import { StorageModule } from '@common/services/storage/storage.module';
import configuration from '@common/typeorm-config';
import { MissionAccessViewEntity } from '@common/viewEntities/mission-access-view.entity';
import { ProjectAccessViewEntity } from '@common/viewEntities/project-access-view.entity';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import os from 'node:os';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { AccessGroupExpiryProvider } from './accessGroupExpiry/access-group-expiry.provider';
import { ActionQueueProcessorProvider } from './actions/action-queue-processor.provider';
import { ActionManagerService } from './actions/services/action-manager.service';
import { ContainerCleanupService } from './actions/services/cleanup-containers.service';
import { DockerDaemon } from './actions/services/docker-daemon.service';
import { FileCleanupQueueProcessorProvider } from './fileCleanup/file-cleanup-queue-processor.provider';
import { FileQueueProcessorProvider } from './files/file-queue-processor.provider';

@Module({
    imports: [
        BullModule.forRoot({
            redis: {
                host: 'redis',
                port: 6379,
            },
        }),

        BullModule.registerQueue({
            name: 'file-queue',
        }),

        BullModule.registerQueue({
            name: `action-queue-${os.hostname()}`,
        }),
        BullModule.registerQueue({
            name: 'file-cleanup',
        }),

        BullModule.registerQueue({
            name: 'move',
        }),

        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) =>
                ({
                    type: 'postgres',
                    host: configService.getOrThrow<string>('database.host'),
                    port: configService.getOrThrow<number>('database.port'),
                    username:
                        configService.getOrThrow<string>('database.username'),
                    password:
                        configService.getOrThrow<string>('database.password'),
                    database:
                        configService.getOrThrow<string>('database.database'),
                    entities: [
                        QueueEntity,
                        MissionEntity,
                        FileEntity,
                        ProjectEntity,
                        TopicEntity,
                        ActionEntity,
                        ActionTemplateEntity,
                        ProjectEntity,
                        UserEntity,
                        ApikeyEntity,
                        AccountEntity,
                        AccessGroupEntity,
                        TagTypeEntity,
                        MetadataEntity,
                        ProjectAccessEntity,
                        MissionAccessEntity,
                        ProjectAccessViewEntity,
                        MissionAccessViewEntity,
                        WorkerEntity,
                        CategoryEntity,
                        GroupMembershipEntity,
                    ],
                    synchronize: env.DEV,
                    logging: ['warn', 'error'],
                }) as PostgresConnectionOptions,
            inject: [ConfigService],
        }),
        TypeOrmModule.forFeature([
            QueueEntity,
            MissionEntity,
            FileEntity,
            TopicEntity,
            ActionEntity,
            ActionTemplateEntity,
            ProjectEntity,
            UserEntity,
            ApikeyEntity,
            TagTypeEntity,
            MetadataEntity,
            ProjectAccessEntity,
            MissionAccessEntity,
            ProjectAccessViewEntity,
            MissionAccessViewEntity,
            WorkerEntity,
            CategoryEntity,
            GroupMembershipEntity,
        ]),
        ScheduleModule.forRoot(),
        StorageModule,
    ],
    providers: [
        FileQueueProcessorProvider,
        ActionQueueProcessorProvider,
        FileCleanupQueueProcessorProvider,
        DockerDaemon,
        ActionManagerService,
        ContainerCleanupService,
        AccessGroupExpiryProvider,
    ],
})
export class AppModule {}
