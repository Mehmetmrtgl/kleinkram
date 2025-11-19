import { AuditContext, AuditContextExtractor } from './audit.types';

/**
 * Strategy for MinIO/Storage operations.
 * Assumes: args[0] = bucketName, args[1] = objectName
 */
export const FileAuditStrategy: AuditContextExtractor = (
    arguments_: unknown[],
): AuditContext => {
    const bucket =
        typeof arguments_[0] === 'string' ? arguments_[0] : 'UNKNOWN_BUCKET';
    const object =
        typeof arguments_[1] === 'string' ? arguments_[1] : 'UNKNOWN_OBJECT';

    return {
        resource: `${bucket}/${object}`,
        metadata: { bucket, object },
    };
};

/**
 * Fallback Strategy.
 * Just logs that the method was called.
 */
export const DefaultAuditStrategy: AuditContextExtractor = (): AuditContext => {
    return {
        resource: 'SYSTEM',
    };
};
