import { AuditLog } from '@common/audit/audit.decorator';
import { FileAuditStrategy } from '@common/audit/audit.strategies';
import { AuditFileAction } from '@common/audit/audit.types';
import { Inject, Injectable } from '@nestjs/common';
import { BucketItemStat, Client, ItemBucketMetadata } from 'minio';
import Credentials from 'minio/dist/main/Credentials';
import { BucketItem, TaggingOpts, Tags } from 'minio/dist/main/internal/type';
import { Stream } from 'node:stream';
import { StorageAuthService } from './storage-auth.service';
import { StorageMetricsService } from './storage-metrics.service';

@Injectable()
export class StorageService {
    constructor(
        @Inject('MINIO_CLIENTS')
        private clients: { external: Client; internal: Client },
        private readonly metricsService: StorageMetricsService,
        private readonly authService: StorageAuthService,
    ) {}

    @AuditLog(AuditFileAction.READ, FileAuditStrategy)
    async getPresignedDownloadUrl(
        bucketName: string,
        objectName: string,
        expirySeconds: number,
        responseDisposition?: Record<string, string>,
    ): Promise<string> {
        return this.clients.external.presignedUrl(
            'GET',
            bucketName,
            objectName,
            expirySeconds,
            responseDisposition,
        );
    }

    @AuditLog(AuditFileAction.READ, FileAuditStrategy)
    async downloadFile(
        bucketName: string,
        objectName: string,
        destinationPath: string,
    ): Promise<void> {
        await this.clients.internal.fGetObject(
            bucketName,
            objectName,
            destinationPath,
        );
    }

    @AuditLog(AuditFileAction.READ, FileAuditStrategy)
    async getFileStream(
        bucketName: string,
        objectName: string,
    ): Promise<Stream.Readable> {
        return this.clients.internal.getObject(bucketName, objectName);
    }

    @AuditLog(AuditFileAction.READ, FileAuditStrategy)
    async listFiles(bucketName: string): Promise<BucketItem[]> {
        const stream = this.clients.internal.listObjects(bucketName, '');
        const result: BucketItem[] = [];
        for await (const item of stream) {
            result.push(item);
        }
        return result;
    }

    @AuditLog(AuditFileAction.READ, FileAuditStrategy)
    async getFileInfo(
        bucketName: string,
        location: string,
    ): Promise<BucketItemStat | undefined> {
        try {
            return await this.clients.internal.statObject(bucketName, location);
        } catch (error: any) {
            if (error.code === 'NotFound') return;
            throw error;
        }
    }

    @AuditLog(AuditFileAction.WRITE, FileAuditStrategy)
    async uploadFile(
        bucketName: string,
        objectName: string,
        filePath: string,
        metaData: ItemBucketMetadata = {},
    ): Promise<void> {
        await this.clients.internal.fPutObject(
            bucketName,
            objectName,
            filePath,
            metaData,
        );
    }

    @AuditLog(AuditFileAction.DELETE, FileAuditStrategy)
    async deleteFile(bucketName: string, location: string): Promise<void> {
        await this.clients.internal.removeObject(bucketName, location);
    }

    @AuditLog(AuditFileAction.READ, FileAuditStrategy)
    async getTags(
        bucketName: string,
        objectName: string,
    ): Promise<Record<string, string>> {
        const tagList = await this.clients.internal.getObjectTagging(
            bucketName,
            objectName,
        );
        return this.normalizeTags(tagList);
    }

    @AuditLog(AuditFileAction.META, FileAuditStrategy)
    async addTags(
        bucketName: string,
        objectName: string,
        tags: Tags,
    ): Promise<void> {
        await this.clients.internal.setObjectTagging(
            bucketName,
            objectName,
            tags,
            { versionId: 'null' },
        );
    }

    @AuditLog(AuditFileAction.META, FileAuditStrategy)
    async removeTags(bucketName: string, objectName: string): Promise<void> {
        await this.clients.internal.removeObjectTagging(
            bucketName,
            objectName,
            {} as TaggingOpts,
        );
    }

    async getSystemMetrics(): Promise<any> {
        return this.metricsService.getSystemMetrics();
    }

    @AuditLog(AuditFileAction.WRITE, FileAuditStrategy)
    async generateTemporaryCredential(
        filename: string,
        bucketName: string,
    ): Promise<Credentials> {
        return this.authService.generateTemporaryCredential(
            filename,
            bucketName,
        );
    }

    private normalizeTags(tagList: any): Record<string, string> {
        if (Array.isArray(tagList)) {
            // eslint-disable-next-line unicorn/no-array-reduce
            return tagList.reduce((accumulator, tag) => {
                if (tag.Key && tag.Value) accumulator[tag.Key] = tag.Value;
                return accumulator;
            }, {});
        }
        if (typeof tagList === 'object') {
            return tagList as Record<string, string>;
        }
        return {};
    }
}
