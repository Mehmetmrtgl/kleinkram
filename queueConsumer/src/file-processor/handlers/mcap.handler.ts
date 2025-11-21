import env from '@common/environment';
import { StorageService } from '@common/modules/storage/storage.service';
import { Injectable } from '@nestjs/common';
import { FileHandler, FileProcessingContext } from './file-handler.interface';
import { McapMetadataService } from './mcap-metadata.service';

@Injectable()
export class McapHandler implements FileHandler {
    constructor(
        private readonly mcapMetadataService: McapMetadataService,
        private readonly storageService: StorageService,
    ) {}

    canHandle(filename: string): boolean {
        return filename.endsWith('.mcap');
    }

    async process(context: FileProcessingContext): Promise<void> {
        const { primaryFile } = context;

        const presignedUrl =
            await this.storageService.getInternalPresignedDownloadUrl(
                env.MINIO_DATA_BUCKET_NAME,
                primaryFile.uuid,
                15 * 60,
            );

        await this.mcapMetadataService.extractFromUrl(
            presignedUrl,
            primaryFile,
        );
    }
}
