import environment from '@common/environment';
import {
    AuditFileAction,
    AuditFileOp,
} from '@common/services/storage/audit.decorator';
import { Inject, Injectable } from '@nestjs/common';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { Client, ItemBucketMetadata } from 'minio';
import AssumeRoleProvider from 'minio/dist/main/AssumeRoleProvider.js';
import Credentials from 'minio/dist/main/Credentials';
import { BucketItem, TaggingOpts, Tags } from 'minio/dist/main/internal/type';
import { Stream } from 'node:stream';

@Injectable()
export class StorageService {
    constructor(
        @Inject('MINIO_CLIENTS')
        private clients: { external: Client; internal: Client },
    ) {}

    @AuditFileOp(AuditFileAction.READ)
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

    @AuditFileOp(AuditFileAction.READ)
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

    @AuditFileOp(AuditFileAction.READ)
    async getFileStream(
        bucketName: string,
        objectName: string,
    ): Promise<Stream.Readable> {
        return this.clients.internal.getObject(bucketName, objectName);
    }

    @AuditFileOp(AuditFileAction.WRITE)
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

    @AuditFileOp(AuditFileAction.READ)
    async getTags(
        bucketName: string,
        objectName: string,
    ): Promise<Record<string, string>> {
        const tagList = await this.clients.internal.getObjectTagging(
            bucketName,
            objectName,
        );

        // Extracted normalization logic to keep method clean
        return this.normalizeTags(tagList);
    }

    @AuditFileOp(AuditFileAction.READ)
    async getFileInfo(bucketName: string, location: string) {
        try {
            return await this.clients.internal.statObject(bucketName, location);
        } catch (error: any) {
            if (error.code === 'NotFound') return null;
            throw error;
        }
    }

    @AuditFileOp(AuditFileAction.META)
    async addTags(
        bucketName: string,
        objectName: string,
        tags: Tags,
    ): Promise<void> {
        await this.clients.internal.setObjectTagging(
            bucketName,
            objectName,
            tags,
            {
                versionId: 'null',
            },
        );
    }

    @AuditFileOp(AuditFileAction.META)
    async removeTags(bucketName: string, objectName: string): Promise<void> {
        await this.clients.internal.removeObjectTagging(
            bucketName,
            objectName,
            {} as TaggingOpts,
        );
    }

    @AuditFileOp(AuditFileAction.DELETE)
    async deleteFile(bucketName: string, location: string): Promise<void> {
        await this.clients.internal.removeObject(bucketName, location);
    }

    @AuditFileOp(AuditFileAction.READ)
    async listFiles(bucketName: string): Promise<BucketItem[]> {
        const stream = this.clients.internal.listObjects(bucketName, '');
        const result: BucketItem[] = [];
        for await (const item of stream) {
            result.push(item);
        }
        return result;
    }

    private normalizeTags(tagList: any): Record<string, string> {
        const result: Record<string, string> = {};
        if (Array.isArray(tagList)) {
            for (const tag of tagList) {
                if (tag.Key && tag.Value) result[tag.Key] = tag.Value;
            }
        } else if (typeof tagList === 'object') {
            return tagList as Record<string, string>;
        }
        return result;
    }
    /**
     * Fetches system drive metrics from MinIO Prometheus endpoint
     */
    async getSystemMetrics(): Promise<any> {
        const expiredAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

        const payload = {
            exp: expiredAt,

            sub: environment.MINIO_ACCESS_KEY,

            iss: 'prometheus',
        };

        const token = jwt.sign(payload, environment.MINIO_SECRET_KEY, {
            algorithm: 'HS512',
        });

        const response = await axios.get(
            'http://minio:9000/minio/metrics/v3/system/drive',

            {
                headers: { Authorization: `Bearer ${token}` },
            },
        );
        return this.parseMinioMetrics(response.data);
    }

    private parseMinioMetrics(metricsText) {
        const lines = metricsText
            .split('\n')
            .filter((line) => line.trim() !== '');

        const result = {};
        for (const line of lines) {
            // Skip comments
            if (line.startsWith('#')) {
                continue;
            }

            // Match metric lines
            const match = line.match(/^(\w+)\{(.+)\}\s+(.+)$/);

            if (match) {
                const [, metricName, labelsText, value] = match;

                // Parse labels
                const labels = {};

                for (const labelPair of labelsText.split(',')) {
                    const [key, value_] = labelPair.split('=');
                    labels[key] = value_.replaceAll('"', ''); // Remove quotes
                }

                // Add to the result object
                if (!result[metricName]) {
                    result[metricName] = [];
                }

                result[metricName].push({
                    labels,

                    value: Number.parseFloat(value),
                });
            }
        }

        return result;
    }

    async generateTemporaryCredential(
        filename: string,

        bucketName: string,
    ): Promise<Credentials> {
        const resource = `arn:aws:s3:::${bucketName}/${filename}`;

        const policy = {
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Action: ['s3:PutObject', 's3:AbortMultipartUpload'],
                    Resource: [resource],
                },
            ],
        };

        const provider = new AssumeRoleProvider({
            secretKey: environment.MINIO_PASSWORD,
            accessKey: environment.MINIO_USER,
            stsEndpoint: 'http://minio:9000',
            action: 'AssumeRole',
            policy: JSON.stringify(policy),
            durationSeconds: 60 * 60 * 4,
        });

        return await provider.getCredentials();
    }
}
