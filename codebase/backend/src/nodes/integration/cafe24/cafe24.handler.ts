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
 * Coerce a path placeholder value to a safe string. Path placeholders only
 * ever carry scalar ids (product_no, order_id, member_id, ...), so a
 * non-scalar input is a configuration mistake — we surface it as the
 * stringified form ({"a":1}) rather than '[object Object]' so the eventual
 * 4xx from Cafe24 carries an actionable URL.
 */
function stringifyPathValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'bigint') return value.toString();
  return JSON.stringify(value);
}

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
    let resourceValid = false;
    if (!config.resource || typeof config.resource !== 'string') {
      errors.push('resource is required and must be a string');
    } else if (
      !(CAFE24_RESOURCES as readonly string[]).includes(config.resource)
    ) {
      errors.push(`resource must be one of: ${CAFE24_RESOURCES.join(', ')}`);
    } else {
      resourceValid = true;
    }
    if (!config.operation || typeof config.operation !== 'string') {
      errors.push('operation is required and must be a string');
    } else if (resourceValid) {
      // B-3-3: 캔버스 배지가 잘못된 operation 선택을 즉시 경고할 수 있도록
      // resource + operation 조합이 메타데이터에 존재하는지 검증한다. 잘못된
      // 조합은 실행 직전에 IntegrationError(CAFE24_UNKNOWN_OPERATION) 로
      // 터질텐데, validate() 가 같은 검사를 미리 수행해 캔버스에서 차단.
      // planned 작업은 아직 메타데이터에 없으므로 INFO 분류로 메시지에 명시.
      const op = findCafe24Operation(
        config.resource as Cafe24Resource,
        config.operation,
      );
      if (!op) {
        errors.push(
          `operation '${String(config.operation)}' is not a supported '${String(config.resource)}' operation in this build. If you intend a planned operation, update the metadata first.`,
        );
      }
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
    const rawConfig = context.rawConfig ?? config;
    const echo = sanitizeConfigEcho({
      integrationId: rawConfig.integrationId,
      resource: rawConfig.resource,
      operation: rawConfig.operation,
      fields: rawConfig.fields ?? {},
      pagination: rawConfig.pagination,
    });

    const integrationId = config.integrationId as string;
    const resource = config.resource as Cafe24Resource;
    const operationId = config.operation as string;
    const fields = ((config.fields ?? {}) as Record<string, unknown>) || {};
    const pagination = (config.pagination ?? undefined) as
      | { limit?: number; offset?: number; cursor?: string }
      | undefined;

    // D4 (2026-05-17, plan/in-progress/node-output-redesign) — Integration
    // 4종 모두 send-email 의 catch-all 패턴으로 통일. handler.validate() 가
    // 거른 config 형식 오류만 throw, 그 외 IntegrationError (resolve /
    // CAFE24_UNKNOWN_OPERATION / CAFE24_MISSING_FIELDS / CAFE24_INVALID_MALL_ID
    // / INTEGRATION_*) 와 환경 오류 (apiClient 미주입) 모두 catch + port:'error'.
    let mallIdForErrorDetails: string | undefined;
    try {
      if (!this.apiClient) {
        throw new IntegrationError(
          'INTEGRATION_SERVICE_UNAVAILABLE',
          'Cafe24ApiClient is not available in this environment — cannot dispatch',
        );
      }

      // 1. Resource/operation metadata lookup.
      const operation = findCafe24Operation(resource, operationId);
      if (!operation) {
        throw new IntegrationError(
          'CAFE24_UNKNOWN_OPERATION',
          `operation "${operationId}" not defined for resource "${resource}"`,
        );
      }

      // 2. Required field check.
      const missing = operation.requiredFields.filter(
        (key) =>
          fields[key] === undefined ||
          fields[key] === null ||
          fields[key] === '',
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
      mallIdForErrorDetails = creds.mall_id;
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
    } catch (err) {
      // D4 — pre-flight throws (CAFE24_UNKNOWN_OPERATION / CAFE24_MISSING_FIELDS
      // / CAFE24_INVALID_MALL_ID / INTEGRATION_* / INTEGRATION_SERVICE_UNAVAILABLE)
      // 가 모두 본 catch 로 흘러 port:'error' 로 변환된다.
      const durationMs = Date.now() - started;
      const code =
        err instanceof IntegrationError ? err.code : 'INTEGRATION_CALL_FAILED';
      const message = err instanceof Error ? err.message : String(err);
      await this.logUsage(context, {
        integrationId,
        status: 'failed',
        durationMs,
        error: { code, message },
      }).catch(() => {});
      const details: Record<string, unknown> = {
        resource,
        operation: operationId,
      };
      if (mallIdForErrorDetails) details.mallId = mallIdForErrorDetails;
      return {
        config: echo,
        output: {
          error: { code, message, details },
        },
        meta: { statusCode: 0, durationMs },
        port: 'error',
      };
    }
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  private buildRequestParts(
    operation: Cafe24OperationMetadata,
    fields: Record<string, unknown>,
    pagination: { limit?: number; offset?: number } | undefined,
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
            encodeURIComponent(stringifyPathValue(value)),
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
    // Cafe24 Admin API supports limit/offset only (B-3-7) — cursor field
    // was removed from cafe24PaginationSchema.
    if (pagination && operation.paginated) {
      if (pagination.limit !== undefined) query.limit = pagination.limit;
      if (pagination.offset !== undefined) query.offset = pagination.offset;
    }

    // B-3-2: path placeholder hard-fail. 사용자가 required path field 를
    // 누락하거나 fields 매핑에 오류가 있으면 `{member_id}` 같은 잔여
    // placeholder 가 그대로 Cafe24 에 전달되어 noisy 404/422 가 발생한다.
    // 메타데이터-실제 호출 간 silent drift 를 차단하기 위해 fail-fast.
    const unresolved = path.match(/\{[^}]+\}/g);
    if (unresolved && unresolved.length > 0) {
      throw new Error(
        `CAFE24_UNRESOLVED_PATH_PARAM: operation '${operation.id}' has unresolved path placeholder(s): ${unresolved.join(', ')}. Check that required fields are provided and field metadata location='path' is correct.`,
      );
    }

    const hasBody = Object.keys(body).length > 0 && operation.method !== 'GET';
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
