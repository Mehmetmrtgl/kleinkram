import { MinioClientFactory } from '@common/services/storage/storage-config.factory';
import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';

@Module({
    providers: [StorageService, MinioClientFactory],
    exports: [StorageService],
})
export class StorageModule {}
