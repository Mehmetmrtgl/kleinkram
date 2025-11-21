import { Injectable } from '@nestjs/common';
import logger from 'src/logger';
import { FileHandler, FileProcessingContext } from './file-handler.interface';
import { McapMetadataService } from './mcap-metadata.service';

@Injectable()
export class McapHandler implements FileHandler {
    constructor(private readonly mcapMetadataService: McapMetadataService) {}

    canHandle(filename: string): boolean {
        return filename.endsWith('.mcap');
    }

    async process(context: FileProcessingContext): Promise<void> {
        const { primaryFile, filePath } = context;
        logger.debug(`Extracting topics from ${primaryFile.filename}`);

        await this.mcapMetadataService.extractAndPersist(filePath, primaryFile);
    }
}
