import { MinioClientFactory } from '@common/services/storage/storage-config.factory';
import { Module } from '@nestjs/common';
import { StorageAuthService } from './storage-auth.service';
import { StorageMetricsService } from './storage-metrics.service';
import { StorageService } from './storage.service';

@Module({
    providers: [
        StorageService,
        MinioClientFactory,
        StorageMetricsService,
        StorageAuthService,
    ],
    exports: [StorageService],
})
export class StorageModule {}
