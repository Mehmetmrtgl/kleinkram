import {
    AuditActionType,
    AuditContext,
    AuditContextExtractor,
} from '@common/audit/audit.types';
import { Logger } from '@nestjs/common';
import { DefaultAuditStrategy } from './audit.strategies';

export function AuditLog(
    action: AuditActionType,
    strategy: AuditContextExtractor = DefaultAuditStrategy,
) {
    return function (
        target: object,
        propertyKey: string,
        descriptor: PropertyDescriptor,
    ): PropertyDescriptor {
        const originalMethod = descriptor.value;
        const logger = new Logger('AuditLogger');

        descriptor.value = async function <T>(...arguments_: T[]): Promise<T> {
            const start = Date.now();
            const className = target.constructor.name;

            let context: AuditContext;
            try {
                context = strategy(arguments_);
            } catch {
                context = { resource: 'STRATEGY_ERROR' };
            }

            try {
                const result = await originalMethod.apply(this, arguments_);

                const duration = Date.now() - start;
                logger.log(
                    `[AUDIT] Action: ${action} | Resource: ${context.resource} | Method: ${className}.${propertyKey} | Time: ${duration}ms`,
                );

                return result;
            } catch (error) {
                const duration = Date.now() - start;
                const errorMessage =
                    error instanceof Error ? error.message : String(error);

                logger.error(
                    `[AUDIT-FAIL] Action: ${action} | Resource: ${context.resource} | Method: ${className}.${propertyKey} | Time: ${duration}ms | Error: ${errorMessage}`,
                );

                throw error;
            }
        };

        return descriptor;
    };
}
