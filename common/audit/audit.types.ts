export type AuditActionType = string;

export interface AuditContext {
    resource: string;
    metadata?: Record<string, string>;
}

export type AuditContextExtractor = (arguments_: unknown[]) => AuditContext;

export enum AuditFileAction {
    READ = 'FILE_READ',
    WRITE = 'FILE_WRITE',
    DELETE = 'FILE_DELETE',
    META = 'FILE_META',
}
