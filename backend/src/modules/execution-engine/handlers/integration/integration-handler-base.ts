import { IntegrationsService } from '../../../integrations/integrations.service.js';
import { Integration } from '../../../integrations/entities/integration.entity.js';
import { ExecutionContext } from '../node-handler.interface.js';

/**
 * Shared helpers for node handlers that read Integration credentials and
 * attribute calls to the IntegrationUsageLog via the execution context.
 *
 * Handlers call:
 *  - `resolveIntegration(...)` to fetch + validate the Integration entity
 *  - `logUsage(...)` to record success/failure for the Activity tab
 */
export interface IntegrationUsageParams {
  integrationId: string;
  status: 'success' | 'failed';
  durationMs: number;
  error?: { code?: string; message?: string } | null;
}

export class IntegrationHandlerBase {
  constructor(protected readonly integrationsService?: IntegrationsService) {}

  protected getWorkspaceId(context: ExecutionContext): string | undefined {
    return context.variables.__workspaceId as string | undefined;
  }

  protected async resolveIntegration(
    integrationId: string,
    context: ExecutionContext,
    expectedServiceType: string,
  ): Promise<Integration> {
    if (!this.integrationsService) {
      throw new Error('Integration service is not available');
    }
    const workspaceId = this.getWorkspaceId(context);
    if (!workspaceId) {
      throw new Error(
        'Missing workspace context — handler cannot resolve the integration',
      );
    }

    const integration = await this.integrationsService.getForExecution(
      integrationId,
      workspaceId,
    );

    if (integration.serviceType !== expectedServiceType) {
      throw new IntegrationError(
        'INTEGRATION_TYPE_MISMATCH',
        `Integration ${integrationId} is type "${integration.serviceType}", not "${expectedServiceType}"`,
      );
    }
    if (integration.status !== 'connected') {
      throw new IntegrationError(
        'INTEGRATION_NOT_CONNECTED',
        `Integration "${integration.name}" is ${integration.status}${
          integration.statusReason ? ` (${integration.statusReason})` : ''
        }`,
      );
    }
    return integration;
  }

  protected async logUsage(
    context: ExecutionContext,
    params: IntegrationUsageParams,
  ): Promise<void> {
    if (!this.integrationsService) return;
    if (!context.nodeExecutionId) return;
    await this.integrationsService.logUsage({
      integrationId: params.integrationId,
      nodeExecutionId: context.nodeExecutionId,
      workflowId: context.workflowId,
      status: params.status,
      durationMs: params.durationMs,
      error: params.error ?? null,
    });
  }
}

export class IntegrationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

export function toLogError(err: unknown): {
  code: string;
  message: string;
} {
  if (err instanceof IntegrationError) {
    return { code: err.code, message: err.message };
  }
  return {
    code: 'INTEGRATION_CALL_FAILED',
    message: err instanceof Error ? err.message : String(err),
  };
}
