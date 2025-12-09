import env from '@common/environment';
import { StorageService } from '@common/modules/storage/storage.service';
import { Injectable, Logger } from '@nestjs/common';
// DİKKAT: Yeni servisi import ediyoruz
import { Db3MetadataService } from './db3-metadata.service'; 
import { FileHandler, FileProcessingContext } from './file-handler.interface';

@Injectable()
export class Db3Handler implements FileHandler {
    private readonly logger = new Logger(Db3Handler.name);

    constructor(
        // RosBagMetadataService DEĞİL, Db3MetadataService kullanıyoruz
        private readonly db3MetadataService: Db3MetadataService, 
        private readonly storageService: StorageService,
    ) {}

    canHandle(filename: string): boolean {
        return filename.endsWith('.db3');
    }

    async process(context: FileProcessingContext): Promise<void> {
        const { primaryFile } = context;

        this.logger.log(`Starting processing for DB3 file: ${primaryFile.filename}`);

        const presignedUrl =
            await this.storageService.getInternalPresignedDownloadUrl(
                env.MINIO_DATA_BUCKET_NAME,
                primaryFile.uuid,
                15 * 60,
            );

        // Yeni servisi çağırıyoruz
        await this.db3MetadataService.extractFromUrl(
            presignedUrl,
            primaryFile,
        );

        this.logger.log(`Finished processing for DB3 file: ${primaryFile.filename}`);
    }
}
