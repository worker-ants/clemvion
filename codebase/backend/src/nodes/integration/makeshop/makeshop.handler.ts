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
import { buildDryRunMock, isDryRun } from '../../core/dry-run.util.js';
import {
  MakeshopApiClient,
  MakeshopAuthFailedError,
  MakeshopCallResult,
  MakeshopIncompleteCredentialsError,
  MakeshopMethod,
  MakeshopRateLimitedError,
  MakeshopTransportFailedError,
} from './makeshop-api.client.js';
import {
  MAKESHOP_RESOURCES,
  MakeshopOperationMetadata,
  MakeshopResource,
  findMakeshopOperation,
  validateMakeshopConstraints,
} from './metadata/index.js';

/**
 * shop_uid 형식 규약 (spec §4 step 4) — 영숫자·하이픈·언더스코어만 허용한다.
 * base URL path segment (`/api/v1/{shop_uid}/`) 주입을 통한 SSRF/path traversal
 * 을 차단한다. 정확한 makeshop 규약은 §9.7 open question 이라 보수적으로 시작.
 */
const SHOP_UID_PATTERN = /^[A-Za-z0-9_-]{2,64}$/;

/**
 * Coerce a path placeholder value to a safe string (config mistake surfaces
 * as the stringified form rather than '[object Object]').
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
 * MakeShop node handler — drives every MakeShop Shop API call through the
 * MakeshopApiClient using the metadata table. spec/4-nodes/4-integration/
 * 5-makeshop.md §4 (12-step flow) / §5 (output) / §6 (error codes).
 */
export class MakeshopHandler
  extends IntegrationHandlerBase
  implements NodeHandler
{
  private readonly handlerLogger = new Logger(MakeshopHandler.name);

  constructor(
    integrationsService: IntegrationsService | undefined,
    private readonly apiClient: MakeshopApiClient | undefined,
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
      !(MAKESHOP_RESOURCES as readonly string[]).includes(config.resource)
    ) {
      errors.push(`resource must be one of: ${MAKESHOP_RESOURCES.join(', ')}`);
    } else {
      resourceValid = true;
    }
    if (!config.operation || typeof config.operation !== 'string') {
      errors.push('operation is required and must be a string');
    } else if (resourceValid) {
      const op = findMakeshopOperation(
        config.resource as MakeshopResource,
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
    const resource = config.resource as MakeshopResource;
    const operationId = config.operation as string;
    const fields = ((config.fields ?? {}) as Record<string, unknown>) || {};
    const pagination = (config.pagination ?? undefined) as
      | { limit?: number; offset?: number }
      | undefined;

    // INT-US-05 — catalog key is derivable from user input before lookup;
    // method/path are filled once the operation metadata is resolved.
    const apiInfo: {
      label?: string | null;
      method?: string | null;
      path?: string | null;
    } = {
      label: `makeshop.${resource}.${operationId}`,
    };

    let shopUidForErrorDetails: string | undefined;
    try {
      if (!this.apiClient) {
        throw new IntegrationError(
          'INTEGRATION_SERVICE_UNAVAILABLE',
          'MakeshopApiClient is not available in this environment — cannot dispatch',
        );
      }

      // 1. Resource/operation metadata lookup.
      const operation = findMakeshopOperation(resource, operationId);
      if (!operation) {
        throw new IntegrationError(
          'MAKESHOP_UNKNOWN_OPERATION',
          `operation "${operationId}" not defined for resource "${resource}"`,
        );
      }
      apiInfo.method = operation.method;
      apiInfo.path = operation.path;

      // 1b. Re-run dry-run (§7) — WRITE operations (POST) mock-short-circuit to
      // block external state changes; READ operations (GET) pass through.
      if (isDryRun(context) && operation.method !== 'GET') {
        const durationMs = Date.now() - started;
        await this.logUsage(context, {
          integrationId,
          status: 'success',
          durationMs,
          api: apiInfo,
        });
        return {
          config: echo,
          output: buildDryRunMock('makeshop', {
            operation: operationId,
            method: operation.method,
            resource,
          }),
          meta: { statusCode: 0, durationMs },
          port: 'success',
        };
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
          'MAKESHOP_MISSING_FIELDS',
          `missing required fields [${missing.join(', ')}] for ${resource}.${operationId}`,
        );
      }

      // 2b. Conditional constraints check (reuses MAKESHOP_MISSING_FIELDS).
      const constraintViolation = validateMakeshopConstraints(
        operation,
        fields,
      );
      if (constraintViolation) {
        throw new IntegrationError(
          'MAKESHOP_MISSING_FIELDS',
          `${constraintViolation} (for ${resource}.${operationId})`,
        );
      }

      // 3. Integration resolve (status='connected', serviceType='makeshop').
      const integration = await this.resolveIntegration(
        integrationId,
        context,
        'makeshop',
      );

      // 4. Credentials sanity: shop_uid format (SSRF guard). Other field
      //    assertions happen inside MakeshopApiClient.
      const creds = (integration.credentials ?? {}) as {
        shop_uid?: string;
      };
      shopUidForErrorDetails = creds.shop_uid;
      if (!creds.shop_uid || !SHOP_UID_PATTERN.test(creds.shop_uid)) {
        throw new IntegrationError(
          'MAKESHOP_INVALID_SHOP_UID',
          `shop_uid "${creds.shop_uid ?? '<missing>'}" does not match /^[A-Za-z0-9_-]{2,64}$/`,
        );
      }

      // 5. URL placeholder substitution + query/body split.
      const { path, query, body } = this.buildRequestParts(
        operation,
        fields,
        pagination,
      );

      // 6. Execute via MakeshopApiClient (auto refresh + 429 retry + mutex).
      let result: MakeshopCallResult;
      try {
        result = await this.apiClient.call(integration, {
          method: operation.method as MakeshopMethod,
          path,
          query,
          body,
        });
      } catch (err) {
        const durationMs = Date.now() - started;
        const errorOutput = this.mapClientErrorToOutput(
          err,
          creds.shop_uid,
          resource,
          operationId,
        );
        await this.logUsage(context, {
          integrationId,
          status: 'failed',
          durationMs,
          error: { code: errorOutput.code, message: errorOutput.message },
          api: apiInfo,
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
      //    surfaced as MakeshopAuthFailedError inside the client; remaining
      //    4xx/5xx here preserve the body on `output.response`.
      if (result.status >= 400) {
        const code = this.codeForStatus(result.status);
        const details: Record<string, unknown> = {
          statusCode: result.status,
          shopUid: creds.shop_uid,
          resource,
          operation: operationId,
        };
        const m = this.extractMakeshopError(result.body);
        if (m.code) details.makeshopErrorCode = m.code;
        if (m.message) details.makeshopMessage = m.message;

        await this.logUsage(context, {
          integrationId,
          status: 'failed',
          durationMs,
          error: { code, message: `MakeShop API returned ${result.status}` },
          api: apiInfo,
        });
        return {
          config: echo,
          output: {
            response: result.body,
            error: {
              code,
              message: `MakeShop API returned ${result.status}`,
              details,
            },
          },
          meta: { statusCode: result.status, durationMs },
          port: 'error',
        };
      }

      // 8. Success.
      await this.logUsage(context, {
        integrationId,
        status: 'success',
        durationMs,
        api: apiInfo,
      });
      return {
        config: echo,
        output: { response: result.body },
        meta: { statusCode: result.status, durationMs },
        port: 'success',
      };
    } catch (err) {
      // D4 — pre-flight throws (MAKESHOP_UNKNOWN_OPERATION / MAKESHOP_MISSING_FIELDS
      // / MAKESHOP_INVALID_SHOP_UID / INTEGRATION_* / INTEGRATION_SERVICE_UNAVAILABLE)
      // all funnel through here into port:'error'.
      const durationMs = Date.now() - started;
      const code =
        err instanceof IntegrationError ? err.code : 'INTEGRATION_CALL_FAILED';
      const message = err instanceof Error ? err.message : String(err);
      await this.logUsage(context, {
        integrationId,
        status: 'failed',
        durationMs,
        error: { code, message },
        api: apiInfo,
      }).catch(() => {});
      const details: Record<string, unknown> = {
        resource,
        operation: operationId,
      };
      if (shopUidForErrorDetails) details.shopUid = shopUidForErrorDetails;
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
    operation: MakeshopOperationMetadata,
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

    // Pagination always travels on query (spec §8 — `pagination.{limit,offset}`).
    if (pagination && operation.paginated) {
      if (pagination.limit !== undefined) query.limit = pagination.limit;
      if (pagination.offset !== undefined) query.offset = pagination.offset;
    }

    // Path placeholder hard-fail — a leftover `{...}` means a required path
    // field was not supplied or metadata location='path' is wrong.
    const unresolved = path.match(/\{[^}]+\}/g);
    if (unresolved && unresolved.length > 0) {
      throw new Error(
        `MAKESHOP_UNRESOLVED_PATH_PARAM: operation '${operation.id}' has unresolved path placeholder(s): ${unresolved.join(', ')}. Check that required fields are provided and field metadata location='path' is correct.`,
      );
    }

    const hasBody = Object.keys(body).length > 0 && operation.method !== 'GET';
    return {
      path,
      query,
      body: hasBody ? body : undefined,
    };
  }

  private codeForStatus(status: number): string {
    if (status === 404) return 'MAKESHOP_404';
    if (status === 422) return 'MAKESHOP_422';
    if (status >= 500 && status < 600) return 'MAKESHOP_5XX';
    return 'MAKESHOP_4XX';
  }

  private extractMakeshopError(body: unknown): {
    code?: string;
    message?: string;
  } {
    if (!body || typeof body !== 'object') return {};
    const obj = body as Record<string, unknown>;
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
    shopUid: string,
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
      shopUid,
      resource,
      operation: operationId,
    };
    if (err instanceof MakeshopAuthFailedError) {
      return {
        code: 'MAKESHOP_AUTH_FAILED',
        message: err.message,
        statusCode: err.status,
        details: { ...details, statusCode: err.status },
        responseBody: err.responseBody,
      };
    }
    if (err instanceof MakeshopRateLimitedError) {
      return {
        code: 'MAKESHOP_RATE_LIMITED',
        message: err.message,
        statusCode: 429,
        details: {
          ...details,
          retries: err.retries,
          lastRetryAfterSec: err.lastRetryAfterSec,
        },
      };
    }
    if (err instanceof MakeshopTransportFailedError) {
      return {
        code: 'MAKESHOP_TRANSPORT_FAILED',
        message: err.message,
        statusCode: 0,
        details,
      };
    }
    if (err instanceof MakeshopIncompleteCredentialsError) {
      throw new IntegrationError('INTEGRATION_INCOMPLETE', err.message);
    }
    if (err instanceof IntegrationError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    this.handlerLogger.warn(
      `MakeShop unexpected error: ${message} (shop=${shopUid})`,
    );
    return {
      code: 'MAKESHOP_TRANSPORT_FAILED',
      message,
      statusCode: 0,
      details,
    };
  }
}
