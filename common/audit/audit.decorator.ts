import { Logger } from '@nestjs/common';
import { DefaultAuditStrategy } from './audit.strategies';
import {
    AuditActionType,
    AuditContext,
    AuditContextExtractor,
} from './audit.types';
import { FileAuditService } from './file-audit.service';

export const AUDIT_LOGGER = new Logger('AuditLogger');

export function AuditLog(
    action: AuditActionType,
    strategy: AuditContextExtractor = DefaultAuditStrategy,
) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor,
    ): PropertyDescriptor {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...arguments_: any[]) {
            // 'this' refers to the instance of the service (e.g. StorageService)
            // We attempt to access the injected audit service.
            const auditService: FileAuditService | undefined = (this as any)
                .fileAuditService;

            if (!auditService) {
                AUDIT_LOGGER.warn(
                    `[AuditLog] @AuditLog used on ${target.constructor.name}.${propertyKey} but 'fileAuditService' was not found on the instance. Make sure to inject FileAuditService as a public property.`,
                );
                return originalMethod.apply(this, arguments_);
            }

            let context: AuditContext = {};
            try {
                context = strategy(arguments_);
            } catch (error) {
                context = { details: { strategyError: String(error) } };
            }

            try {
                const result = await originalMethod.apply(this, arguments_);

                auditService
                    .log(action, context, true)
                    .catch((error) =>
                        AUDIT_LOGGER.error(
                            `Failed to persist audit log: ${error}`,
                        ),
                    );

                return result;
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);

                auditService
                    .log(action, context, false, errorMessage)
                    .catch((error_) =>
                        AUDIT_LOGGER.error(
                            `Failed to persist audit log (error case): ${error_}`,
                        ),
                    );

                throw error;
            }
        };

        return descriptor;
    };
}
