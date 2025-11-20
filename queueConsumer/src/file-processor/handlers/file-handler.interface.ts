import FileEntity from '@common/entities/file/file.entity';
import QueueEntity from '@common/entities/queue/queue.entity';

export interface FileProcessingContext {
    workDirectory: string;
    filePath: string;
    fileType: string;
    queueItem: QueueEntity;
    primaryFile: FileEntity;
}

export interface FileHandler {
    canHandle(filename: string): boolean;
    process(context: FileProcessingContext): Promise<void>;
}
export const FILE_HANDLER = 'FILE_HANDLER_TOKEN';
