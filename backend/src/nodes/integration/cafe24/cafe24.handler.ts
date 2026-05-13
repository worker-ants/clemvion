import { Logger } from '@nestjs/common';
import {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
} from '../../core/node-handler.interface.js';
import {
  IntegrationError,
  IntegrationHandlerBase,
  sanitizeConfigEcho,
} from '../_base/integration-handler-base.js';
import { IntegrationsService } from '../../../modules/integrations/integrations.service.js';
import {
  Cafe24ApiClient,
  Cafe24AuthFailedError,
  Cafe24CallResult,
  Cafe24IncompleteCredentialsError,
  Cafe24Method,
  Cafe24RateLimitedError,
  Cafe24TransportFailedError,
} from './cafe24-api.client.js';
import {
  CAFE24_RESOURCES,
  Cafe24OperationMetadata,
  Cafe24Resource,
  findCafe24Operation,
} from './metadata/index.js';

const MALL_ID_PATTERN = /^[a-z0-9-]{3,50}$/;

/**
 * Cafe24 node handler — drives every cafe24 Admin API call through the
 * Cafe24ApiClient using the metadata table. spec/4-nodes/4-integration/
 * 4-cafe24.md §4 (12-step flow) / §5 (output) / §6 (error codes).
 */
export class Cafe24Handler
  extends IntegrationHandlerBase
  implements NodeHandler
{
  private readonly handlerLogger = new Logger(Cafe24Handler.name);

  constructor(
    integrationsService: IntegrationsService | undefined,
    private readonly apiClient: Cafe24ApiClient | undefined,
  ) {
    super(integrationsService);
  }

  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    if (!config.integrationId || typeof config.integrationId !== 'string') {
      errors.push('integrationId is required and must be a string');
    }
    if (!config.resource || typeof config.resource !== 'string') {
      errors.push('resource is required and must be a string');
    } else if (
      !(CAFE24_RESOURCES as readonly string[]).includes(
        config.resource as string,
      )
    ) {
      errors.push(
        `resource must be one of: ${CAFE24_RESOURCES.join(', ')}`,
      );
    }
    if (!config.operation || typeof config.operation !== 'string') {
      errors.push('operation is required and must be a string');
    }
    if (
      config.fields !== undefined &&
      (typeof config.fields !== 'object' ||
        config.fields === null ||
        Array.isArray(config.fields))
    ) {
      errors.push('fields must be an object');
    }
    return { valid: errors.length === 0, errors };
  }

  async execute(
    _input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    const started = Date.now();
    const rawConfig = (context.rawConfig ?? config) as Record<string, unknown>;
    const echo = sanitizeConfigEcho({
      integrationId: rawConfig.integrationId,
      resource: rawConfig.resource,
      operation: rawConfig.operation,
      fields: rawConfig.fields ?? {},
      pagination: rawConfig.pagination,
    });

    if (!this.apiClient) {
      throw new Error(
        'Cafe24ApiClient is not available in this environment — cannot dispatch',
      );
    }

    const integrationId = config.integrationId as string;
    const resource = config.resource as Cafe24Resource;
    const operationId = config.operation as string;
    const fields = ((config.fields ?? {}) as Record<string, unknown>) || {};
    const pagination = (config.pagination ?? undefined) as
      | { limit?: number; offset?: number; cursor?: string }
      | undefined;

    // 1. Resource/operation metadata lookup — pre-flight.
    const operation = findCafe24Operation(resource, operationId);
    if (!operation) {
      throw new IntegrationError(
        'CAFE24_UNKNOWN_OPERATION',
        `operation "${operationId}" not defined for resource "${resource}"`,
      );
    }

    // 2. Required field check — pre-flight.
    const missing = operation.requiredFields.filter(
      (key) => fields[key] === undefined || fields[key] === null || fields[key] === '',
    );
    if (missing.length > 0) {
      throw new IntegrationError(
        'CAFE24_MISSING_FIELDS',
        `missing required fields [${missing.join(', ')}] for ${resource}.${operationId}`,
      );
    }

    // 3. Integration resolve (status='connected', serviceType='cafe24').
    const integration = await this.resolveIntegration(
      integrationId,
      context,
      'cafe24',
    );

    // 4. Credentials sanity: mall_id format. (Other field assertions happen
    //    inside Cafe24ApiClient.)
    const creds = (integration.credentials ?? {}) as {
      mall_id?: string;
    };
    if (!creds.mall_id || !MALL_ID_PATTERN.test(creds.mall_id)) {
      throw new IntegrationError(
        'CAFE24_INVALID_MALL_ID',
        `mall_id "${creds.mall_id ?? '<missing>'}" does not match /^[a-z0-9-]{3,50}$/`,
      );
    }

    // 5. URL placeholder substitution + query/body split.
    const { path, query, body } = this.buildRequestParts(
      operation,
      fields,
      pagination,
    );

    // 6. Execute via Cafe24ApiClient (auto refresh + rate limit + mutex).
    let result: Cafe24CallResult;
    try {
      result = await this.apiClient.call(integration, {
        method: operation.method as Cafe24Method,
        path,
        query,
        body,
      });
    } catch (err) {
      const durationMs = Date.now() - started;
      const errorOutput = this.mapClientErrorToOutput(
        err,
        creds.mall_id,
        resource,
        operationId,
      );
      await this.logUsage(context, {
        integrationId,
        status: 'failed',
        durationMs,
        error: { code: errorOutput.code, message: errorOutput.message },
      });
      return {
        config: echo,
        output: {
          ...(errorOutput.responseBody !== undefined
            ? { response: errorOutput.responseBody }
            : {}),
          error: {
            code: errorOutput.code,
            message: errorOutput.message,
            details: errorOutput.details,
          },
        },
        meta: { statusCode: errorOutput.statusCode, durationMs },
        port: 'error',
      };
    }

    const durationMs = Date.now() - started;

    // 7. HTTP-level non-2xx → translate to error envelope. 401/403 already
    //    surfaced as Cafe24AuthFailedError inside the client; remaining 4xx/5xx
    //    here mean the body is preserved on `output.response` (debug aid).
    if (result.status >= 400) {
      const code = this.codeForStatus(result.status);
      const details: Record<string, unknown> = {
        statusCode: result.status,
        mallId: creds.mall_id,
        resource,
        operation: operationId,
      };
      const c24 = this.extractCafe24Error(result.body);
      if (c24.code) details.cafe24ErrorCode = c24.code;
      if (c24.message) details.cafe24Message = c24.message;

      await this.logUsage(context, {
        integrationId,
        status: 'failed',
        durationMs,
        error: { code, message: `Cafe24 API returned ${result.status}` },
      });
      return {
        config: echo,
        output: {
          response: result.body,
          error: {
            code,
            message: `Cafe24 API returned ${result.status}`,
            details,
          },
        },
        meta: this.buildMeta(result, durationMs),
        port: 'error',
      };
    }

    // 8. Success.
    await this.logUsage(context, {
      integrationId,
      status: 'success',
      durationMs,
    });
    return {
      config: echo,
      output: { response: result.body },
      meta: this.buildMeta(result, durationMs),
      port: 'success',
    };
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  private buildRequestParts(
    operation: Cafe24OperationMetadata,
    fields: Record<string, unknown>,
    pagination:
      | { limit?: number; offset?: number; cursor?: string }
      | undefined,
  ): {
    path: string;
    query: Record<string, unknown>;
    body: Record<string, unknown> | undefined;
  } {
    let path = operation.path;
    const query: Record<string, unknown> = {};
    const body: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined || value === null) continue;
      const fieldSpec = operation.fields[key];
      if (!fieldSpec) {
        // Unknown field — drop it (metadata is the contract).
        continue;
      }
      switch (fieldSpec.location) {
        case 'path':
          path = path.replace(
            new RegExp(`\\{${key}\\}`, 'g'),
            encodeURIComponent(String(value)),
          );
          break;
        case 'query':
          query[key] = value;
          break;
        case 'body':
          body[key] = value;
          break;
      }
    }

    // Pagination always travels on query, regardless of operation shape.
    if (pagination && operation.paginated) {
      if (pagination.limit !== undefined) query.limit = pagination.limit;
      if (pagination.offset !== undefined) query.offset = pagination.offset;
      if (pagination.cursor !== undefined) query.cursor = pagination.cursor;
    }

    const hasBody =
      Object.keys(body).length > 0 && operation.method !== 'GET';
    return {
      path,
      query,
      body: hasBody ? body : undefined,
    };
  }

  private buildMeta(
    result: Cafe24CallResult,
    durationMs: number,
  ): Record<string, unknown> {
    const meta: Record<string, unknown> = {
      statusCode: result.status,
      durationMs,
    };
    if (result.callUsage !== undefined) meta.callUsage = result.callUsage;
    if (result.callRemain !== undefined) meta.callRemain = result.callRemain;
    if (result.callLimit !== undefined) meta.callLimit = result.callLimit;
    if (result.timeUsage !== undefined) meta.timeUsage = result.timeUsage;
    if (result.timeRemain !== undefined) meta.timeRemain = result.timeRemain;
    return meta;
  }

  private codeForStatus(status: number): string {
    if (status === 404) return 'CAFE24_404';
    if (status === 422) return 'CAFE24_422';
    if (status >= 500 && status < 600) return 'CAFE24_5XX';
    return 'CAFE24_4XX';
  }

  private extractCafe24Error(body: unknown): {
    code?: string;
    message?: string;
  } {
    if (!body || typeof body !== 'object') return {};
    const obj = body as Record<string, unknown>;
    // Cafe24 error envelope: { error: { code, message, ... } } or
    // sometimes top-level error fields.
    const err =
      obj.error && typeof obj.error === 'object'
        ? (obj.error as Record<string, unknown>)
        : obj;
    const code =
      typeof err.code === 'string'
        ? err.code
        : typeof err.error_code === 'string'
          ? err.error_code
          : undefined;
    const message =
      typeof err.message === 'string'
        ? err.message
        : typeof err.error_message === 'string'
          ? err.error_message
          : undefined;
    return { code, message };
  }

  private mapClientErrorToOutput(
    err: unknown,
    mallId: string,
    resource: string,
    operationId: string,
  ): {
    code: string;
    message: string;
    statusCode: number;
    details: Record<string, unknown>;
    responseBody?: unknown;
  } {
    const details: Record<string, unknown> = {
      mallId,
      resource,
      operation: operationId,
    };
    if (err instanceof Cafe24AuthFailedError) {
      return {
        code: 'CAFE24_AUTH_FAILED',
        message: err.message,
        statusCode: err.status,
        details: { ...details, statusCode: err.status },
        responseBody: err.responseBody,
      };
    }
    if (err instanceof Cafe24RateLimitedError) {
      return {
        code: 'CAFE24_RATE_LIMITED',
        message: err.message,
        statusCode: 429,
        details: {
          ...details,
          retries: err.retries,
          lastRetryAfterSec: err.lastRetryAfterSec,
        },
      };
    }
    if (err instanceof Cafe24TransportFailedError) {
      return {
        code: 'CAFE24_TRANSPORT_FAILED',
        message: err.message,
        statusCode: 0,
        details,
      };
    }
    if (err instanceof Cafe24IncompleteCredentialsError) {
      throw new IntegrationError('INTEGRATION_INCOMPLETE', err.message);
    }
    if (err instanceof IntegrationError) {
      // Pre-flight categories — re-throw to surface as node execution
      // failure (spec §5.8 / Principle 3.1).
      throw err;
    }
    // Unknown failure — surface as transport-failed for consistency.
    const message = err instanceof Error ? err.message : String(err);
    this.handlerLogger.warn(
      `Cafe24 unexpected error: ${message} (mall=${mallId})`,
    );
    return {
      code: 'CAFE24_TRANSPORT_FAILED',
      message,
      statusCode: 0,
      details,
    };
  }
}
