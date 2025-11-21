import UserEntity from '@common/entities/user/user.entity';
import { FileEventType } from '@common/frontend_shared/enum';

export type AuditActionType = FileEventType;

export interface AuditContext {
    fileUuid?: string;
    filename?: string;
    missionUuid?: string;
    actor?: UserEntity;
    details?: Record<string, any>;
}

export type AuditContextExtractor = (arguments_: any[]) => AuditContext;
