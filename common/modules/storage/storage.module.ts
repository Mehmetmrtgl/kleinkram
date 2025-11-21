import { FileAuditService } from '@common/audit/file-audit.service';
import FileEventEntity from '@common/entities/file/file-event.entity';
import FileEntity from '@common/entities/file/file.entity';
import MissionEntity from '@common/entities/mission/mission.entity';
import { MinioClientFactory } from '@common/modules/storage/storage-config.factory';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageAuthService } from './storage-auth.service';
import { StorageMetricsService } from './storage-metrics.service';
import { StorageService } from './storage.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([FileEventEntity, FileEntity, MissionEntity]),
    ],
    providers: [
        FileAuditService,
        StorageService,
        MinioClientFactory,
        StorageMetricsService,
        StorageAuthService,
    ],
    exports: [StorageService, FileAuditService],
})
export class StorageModule {}
