import { Logger } from '@nestjs/common';
import { IntegrationsService } from '../../../integrations/integrations.service.js';
import { Integration } from '../../../integrations/entities/integration.entity.js';
import { ExecutionContext } from '../../../../nodes/core/node-handler.interface.js';

const logger = new Logger('IntegrationHandlerBase');
let warnedMissingNodeExecutionId = false;

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
    if (!context.nodeExecutionId) {
      // Engine must populate nodeExecutionId before dispatching a handler.
      // If this fires in production it means IntegrationUsageLog rows are
      // being dropped silently — surface it once so the gap is caught.
      if (!warnedMissingNodeExecutionId) {
        warnedMissingNodeExecutionId = true;
        logger.warn(
          'ExecutionContext.nodeExecutionId missing — IntegrationUsageLog rows will be skipped for this call.',
        );
      }
      return;
    }
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

/**
 * Sanitizes an arbitrary thrown value for recording in IntegrationUsageLog.
 * Prefers the structured `IntegrationError` code/message pair, otherwise
 * extracts a safe string from the error and masks credential-like tokens
 * so that pg / nodemailer messages don't leak secrets
 * into activity logs.
 */
export function toLogError(err: unknown): {
  code: string;
  message: string;
} {
  if (err instanceof IntegrationError) {
    return { code: err.code, message: sanitizeMessage(err.message) };
  }

  return {
    code: 'INTEGRATION_CALL_FAILED',
    message: sanitizeMessage(err instanceof Error ? err.message : String(err)),
  };
}

/**
 * Redacts likely secret tokens from free-form error messages. Intentionally
 * conservative — we match common secret-looking patterns (long hex/base64
 * strings, `password=…`, `Bearer …`) and replace them with `***`.
 */
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  // password=..., pwd=..., secret=..., token=..., api_key=..., apikey=...
  [/((?:password|pwd|secret|token|api[_-]?key)=)[^&\s"']+/gi, '$1***'],
  // Bearer / Basic Authorization header fragments
  [/(Bearer|Basic)\s+[A-Za-z0-9+/=._-]{8,}/g, '$1 ***'],
  // Long opaque hex/base64-ish blobs (24+ chars)
  [/(?<![A-Za-z0-9+/=._-])[A-Za-z0-9+/=]{32,}(?![A-Za-z0-9+/=])/g, '***'],
];

export function sanitizeMessage(input: string): string {
  let out = input;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}
