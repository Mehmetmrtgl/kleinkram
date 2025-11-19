import { CustomDecorator, SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit_operation';

export enum AuditFileAction {
    READ = 'READ',
    WRITE = 'WRITE',
    DELETE = 'DELETE',
    META = 'META',
}

export const AuditFileOp = (action: AuditFileAction): CustomDecorator =>
    SetMetadata(AUDIT_KEY, action);
