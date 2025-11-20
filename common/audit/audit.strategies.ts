import { AuditContext, AuditContextExtractor } from './audit.types';

export const MinioStorageStrategy: AuditContextExtractor = (
    arguments_: unknown[],
): AuditContext => {
    // MinIO methods usually follow (bucketName, objectName, ...args)
    // objectName in your system corresponds to the fileUUID
    return {
        fileUuid: typeof arguments_[1] === 'string' ? arguments_[1] : '',
        details: { bucket: arguments_[0] },
    };
};

export const DefaultAuditStrategy: AuditContextExtractor = (
    arguments_,
): AuditContext => {
    return {
        details: {
            rawArgs: arguments_.map((a) =>
                typeof a === 'string' ? a : typeof a,
            ),
        },
    };
};
