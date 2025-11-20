import FileEntity from '@common/entities/file/file.entity';
import IngestionJobEntity from '@common/entities/file/ingestion-job.entity';

export interface FileProcessingContext {
    workDirectory: string;
    filePath: string;
    fileType: string;
    queueItem: IngestionJobEntity;
    primaryFile: FileEntity;
}

export interface FileHandler {
    canHandle(filename: string): boolean;
    process(context: FileProcessingContext): Promise<void>;
}
export const FILE_HANDLER = 'FILE_HANDLER_TOKEN';
