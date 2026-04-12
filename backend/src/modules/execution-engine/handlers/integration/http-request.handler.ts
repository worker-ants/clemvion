import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';
import {
  IntegrationError,
  IntegrationHandlerBase,
  toLogError,
} from './integration-handler-base.js';
import { IntegrationsService } from '../../../integrations/integrations.service.js';

export class HttpRequestHandler
  extends IntegrationHandlerBase
  implements NodeHandler
{
  constructor(integrationsService?: IntegrationsService) {
    super(integrationsService);
  }

  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!config.method || typeof config.method !== 'string') {
      errors.push('method is required and must be a string');
    } else {
      const allowed = [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'HEAD',
        'OPTIONS',
      ];
      if (!allowed.includes(config.method.toUpperCase())) {
        errors.push(`method must be one of: ${allowed.join(', ')}`);
      }
    }

    if (!config.url || typeof config.url !== 'string') {
      errors.push('url is required and must be a string');
    }

    if (
      config.timeout !== undefined &&
      (typeof config.timeout !== 'number' || config.timeout <= 0)
    ) {
      errors.push('timeout must be a positive number');
    }

    if (
      config.authentication === 'integration' &&
      (!config.integrationId || typeof config.integrationId !== 'string')
    ) {
      errors.push(
        'integrationId is required when authentication is "integration"',
      );
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    _input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    const method = (config.method as string).toUpperCase();
    const initialUrl = config.url as string;
    const userHeaders = (config.headers as Record<string, string>) ?? {};
    const queryParams = (config.queryParams as Record<string, string>) ?? {};
    const body = config.body;
    const bodyType = (config.bodyType as string) ?? 'json';
    const responseType = (config.responseType as string) ?? 'json';
    const timeout = (config.timeout as number) ?? 30000;
    const authentication = (config.authentication as string) ?? 'none';
    const integrationId = config.integrationId as string | undefined;

    const start = Date.now();

    // Resolve integration-backed authentication, if requested.
    let credentials: HttpCredentials = {};
    let baseUrl: string | undefined;
    if (authentication === 'integration' && integrationId) {
      if (!this.integrationsService) {
        throw new Error(
          'Integration-based authentication is not available in this environment',
        );
      }
      try {
        const integration = await this.resolveIntegration(
          integrationId,
          context,
          'http',
        );
        const result = buildHttpCredentials(
          integration.authType,
          integration.credentials,
        );
        credentials = result.credentials;
        baseUrl = result.baseUrl;
      } catch (err) {
        await this.logUsage(context, {
          integrationId,
          status: 'failed',
          durationMs: Date.now() - start,
          error: toLogError(err),
        });
        throw err;
      }
    }

    // Build request URL: prepend base_url if present and the config URL is relative.
    let url = resolveUrl(baseUrl, initialUrl);

    // Append query parameters to the resolved URL.
    if (Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        params.append(key, String(value));
      }
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}${params.toString()}`;
    }

    // Apply integration-provided query params (api_key in query mode).
    if (credentials.queryParams) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(credentials.queryParams)) {
        params.append(k, v);
      }
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}${params.toString()}`;
    }

    const mergedHeaders: Record<string, string> = {
      ...(credentials.defaultHeaders ?? {}),
      ...(credentials.headers ?? {}),
      ...userHeaders,
    };

    const fetchOptions: RequestInit = { method, headers: mergedHeaders };

    if (body !== undefined && !['GET', 'HEAD'].includes(method)) {
      if (bodyType === 'json') {
        mergedHeaders['Content-Type'] =
          mergedHeaders['Content-Type'] ?? 'application/json';
        fetchOptions.body = JSON.stringify(body);
      } else if (bodyType === 'form') {
        const formData = new URLSearchParams();
        if (typeof body === 'object' && body !== null) {
          for (const [key, value] of Object.entries(
            body as Record<string, unknown>,
          )) {
            formData.append(key, String(value));
          }
        }
        fetchOptions.body = formData.toString();
        mergedHeaders['Content-Type'] =
          mergedHeaders['Content-Type'] ?? 'application/x-www-form-urlencoded';
      } else {
        fetchOptions.body =
          typeof body === 'string' ? body : JSON.stringify(body);
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    fetchOptions.signal = controller.signal;

    try {
      const res = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      const duration = Date.now() - start;

      let responseData: unknown;
      if (responseType === 'json') {
        responseData = await res.json().catch(() => null);
      } else if (responseType === 'text') {
        responseData = await res.text();
      } else {
        responseData = await res.text();
      }

      const meta = { statusCode: res.status, duration };

      if (integrationId && authentication === 'integration') {
        await this.logUsage(context, {
          integrationId,
          status: res.ok ? 'success' : 'failed',
          durationMs: duration,
          error: res.ok
            ? null
            : { code: `HTTP_${res.status}`, message: res.statusText },
        });
      }

      if (res.ok) {
        return { port: 'success', data: { response: responseData, meta } };
      }
      return { port: 'error', data: { response: responseData, meta } };
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      const duration = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);
      if (integrationId && authentication === 'integration') {
        await this.logUsage(context, {
          integrationId,
          status: 'failed',
          durationMs: duration,
          error: { code: 'HTTP_TRANSPORT_FAILED', message },
        });
      }
      return {
        port: 'error',
        data: {
          response: { error: message },
          meta: { statusCode: 0, duration },
        },
      };
    }
  }
}

interface HttpCredentials {
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  defaultHeaders?: Record<string, string>;
}

function buildHttpCredentials(
  authType: string,
  raw: Record<string, unknown>,
): { credentials: HttpCredentials; baseUrl: string | undefined } {
  const defaultHeaders =
    typeof raw.default_headers === 'object' && raw.default_headers !== null
      ? (raw.default_headers as Record<string, string>)
      : undefined;
  const baseUrl =
    typeof raw.base_url === 'string' && raw.base_url.length > 0
      ? raw.base_url
      : undefined;

  switch (authType) {
    case 'api_key': {
      const location = raw.location as 'header' | 'query' | undefined;
      const keyName = raw.key_name as string | undefined;
      const value = raw.value as string | undefined;
      if (!location || !keyName || !value) {
        throw new IntegrationError(
          'INTEGRATION_INCOMPLETE',
          'HTTP integration (api_key) is missing location/key_name/value',
        );
      }
      if (location === 'header') {
        return {
          credentials: { headers: { [keyName]: value }, defaultHeaders },
          baseUrl,
        };
      }
      return {
        credentials: { queryParams: { [keyName]: value }, defaultHeaders },
        baseUrl,
      };
    }
    case 'bearer_token': {
      const token = raw.token as string | undefined;
      if (!token) {
        throw new IntegrationError(
          'INTEGRATION_INCOMPLETE',
          'HTTP integration (bearer) is missing token',
        );
      }
      return {
        credentials: {
          headers: { Authorization: `Bearer ${token}` },
          defaultHeaders,
        },
        baseUrl,
      };
    }
    case 'basic': {
      const username = raw.username as string | undefined;
      const password = raw.password as string | undefined;
      if (!username || !password) {
        throw new IntegrationError(
          'INTEGRATION_INCOMPLETE',
          'HTTP integration (basic) is missing username/password',
        );
      }
      const encoded = Buffer.from(`${username}:${password}`).toString('base64');
      return {
        credentials: {
          headers: { Authorization: `Basic ${encoded}` },
          defaultHeaders,
        },
        baseUrl,
      };
    }
    default:
      throw new IntegrationError(
        'INTEGRATION_AUTH_UNSUPPORTED',
        `HTTP integration auth type "${authType}" is not supported`,
      );
  }
}

/**
 * If the config URL is absolute (includes a scheme), use it verbatim.
 * Otherwise, prefix with `base_url` (if provided), stripping duplicate slashes.
 */
function resolveUrl(baseUrl: string | undefined, configUrl: string): string {
  if (/^https?:\/\//i.test(configUrl)) return configUrl;
  if (!baseUrl) return configUrl;
  return `${baseUrl.replace(/\/+$/, '')}/${configUrl.replace(/^\/+/, '')}`;
}
