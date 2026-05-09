import {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import {
  IntegrationError,
  IntegrationHandlerBase,
  toLogError,
} from '../_base/integration-handler-base.js';
import { truncateBodyForOutput } from '../../core/truncate-output.util.js';
import { sanitizeResponseHeaders } from '../_base/sanitize-response-headers.util.js';
import { IntegrationsService } from '../../../modules/integrations/integrations.service.js';
import { assertSafeOutboundUrl } from './http-safety.js';
import { httpRequestNodeMetadata } from './http-request.schema.js';

/**
 * Strip URL-borne credentials before echoing on `NodeHandlerOutput.config`
 * or inside `output.error.details.url` (CONVENTIONS §7).
 *
 * Two attack surfaces:
 *  1. `user:password@host` userinfo segment — replaced with empty strings.
 *  2. `?api_key=…` / `?token=…` style query-string secrets — many APIs
 *     accept credentials this way (Stripe webhook signing, S3 presigned
 *     URLs, etc.). Without this redaction, a 4xx/5xx response would land
 *     the raw secret on the NodeExecution row, expression cache, and
 *     websocket event.
 *
 * Falls back to a regex userinfo strip on parse failure so malformed input
 * still gets some protection.
 */
const QUERY_PARAM_BLACKLIST = new Set<string>([
  'api_key',
  'apikey',
  'access_token',
  'accesstoken',
  'auth_token',
  'authtoken',
  'token',
  'secret',
  'password',
  'sig',
  'signature',
  'x-amz-security-token',
  'x-amz-signature',
]);

function sanitizeUrlCredentials(raw: string): string {
  try {
    const parsed = new URL(raw);
    if (parsed.username || parsed.password) {
      parsed.username = '';
      parsed.password = '';
    }
    if (parsed.searchParams.size > 0) {
      // Mutating searchParams during iteration is awkward; collect the
      // sensitive keys first.
      const sensitive: string[] = [];
      for (const key of parsed.searchParams.keys()) {
        if (QUERY_PARAM_BLACKLIST.has(key.toLowerCase())) sensitive.push(key);
      }
      for (const key of sensitive) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    }
    return parsed.toString();
  } catch {
    return raw.replace(/^([a-zA-Z][\w+\-.]*:\/\/)[^/@]*@/, '$1');
  }
}

export class HttpRequestHandler
  extends IntegrationHandlerBase
  implements NodeHandler
{
  constructor(integrationsService?: IntegrationsService) {
    super(integrationsService);
  }

  metadata = httpRequestNodeMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers URL required,
    // integration-auth-needs-integrationId, and timeout numeric guard. The
    // method enum + non-string url + non-string integrationId guards stay
    // handler-side because the mini-DSL can't express the case-folded enum
    // membership and zod narrows them at parse time only.
    const errors = [...evaluateMetadataBlockingErrors(this.metadata, config)];
    if (config.method !== undefined) {
      if (typeof config.method !== 'string') {
        errors.push('method must be a string');
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
    }
    if (config.url !== undefined && typeof config.url !== 'string') {
      errors.push('url is required and must be a string');
    }
    if (
      config.authentication === 'integration' &&
      config.integrationId !== undefined &&
      typeof config.integrationId !== 'string'
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
  ): Promise<NodeHandlerOutput> {
    const method = (
      (config.method as string | undefined) ?? 'GET'
    ).toUpperCase();
    const initialUrl = config.url as string;
    const userHeaders = toKeyValueRecord(config.headers);
    const queryParams = toKeyValueRecord(config.queryParams);
    const body = config.body;
    const bodyType = (config.bodyType as string) ?? 'json';
    const responseType = (config.responseType as string) ?? 'json';
    const timeout = (config.timeout as number) ?? 30000;
    const authentication = (config.authentication as string) ?? 'none';
    const integrationId = config.integrationId as string | undefined;

    // CONVENTIONS Principle 7 — config echo carries the **raw** user input
    // (`{{ ... }}` preserved, URL credentials stripped). evaluated request
    // body is surfaced on `output.requestBody` so a downstream node can
    // observe the bytes that actually went on the wire. Engine populates
    // `rawConfig` for every dispatch (Phase 1); fallback to evaluated config
    // is purely for unit tests that bypass the engine.
    const rawConfig = context.rawConfig ?? config;
    const rawUrl =
      typeof rawConfig.url === 'string'
        ? sanitizeUrlCredentials(rawConfig.url)
        : rawConfig.url;
    // Spread + URL override — adding a new schema field is automatically
    // echoed without a maintenance step here (review W-6).
    const configEcho: Record<string, unknown> = { ...rawConfig, url: rawUrl };

    // The evaluated body reflects what was actually sent (after expression
    // substitution). For `form-data` we record the multipart parts as a
    // plain object since `FormData` itself isn't JSON-serializable.
    const evaluatedRequestBody = serializeEvaluatedBody(body, bodyType);
    const cappedRequestBody = truncateBodyForOutput(evaluatedRequestBody);

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

    // Credential headers must take precedence over user-supplied headers to
    // prevent a workflow author from silently overwriting an integration's
    // Authorization header with an attacker-controlled value.
    const mergedHeaders: Record<string, string> = {
      ...(credentials.defaultHeaders ?? {}),
      ...userHeaders,
      ...(credentials.headers ?? {}),
    };

    const fetchOptions: RequestInit = { method, headers: mergedHeaders };

    if (body !== undefined && !['GET', 'HEAD'].includes(method)) {
      if (bodyType === 'json') {
        mergedHeaders['Content-Type'] =
          mergedHeaders['Content-Type'] ?? 'application/json';
        fetchOptions.body =
          typeof body === 'string' ? body : JSON.stringify(body);
      } else if (bodyType === 'x-www-form-urlencoded' || bodyType === 'form') {
        const formData = new URLSearchParams();
        const entries = toKeyValueEntries(body);
        for (const [key, value] of entries) {
          formData.append(key, value);
        }
        fetchOptions.body = formData.toString();
        mergedHeaders['Content-Type'] =
          mergedHeaders['Content-Type'] ?? 'application/x-www-form-urlencoded';
      } else if (bodyType === 'form-data') {
        const formData = new FormData();
        const entries = toKeyValueEntries(body);
        for (const [key, value] of entries) {
          formData.append(key, value);
        }
        fetchOptions.body = formData;
        // Let the runtime set the multipart boundary; explicit Content-Type
        // would prevent the boundary parameter from being added.
        delete mergedHeaders['Content-Type'];
      } else {
        fetchOptions.body =
          typeof body === 'string' ? body : JSON.stringify(body);
      }
    }

    // SSRF guard for Integration-backed calls only. Un-authenticated HTTP
    // requests (authentication=none / custom) may legitimately target
    // internal services in some deployments, so we don't block those here.
    if (authentication === 'integration') {
      try {
        assertSafeOutboundUrl(url);
      } catch (err) {
        if (integrationId) {
          await this.logUsage(context, {
            integrationId,
            status: 'failed',
            durationMs: Date.now() - start,
            error: {
              code: 'HTTP_BLOCKED',
              message: err instanceof Error ? err.message : String(err),
            },
          }).catch(() => {});
        }
        throw err;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    fetchOptions.signal = controller.signal;
    // Follow redirects manually so that a redirect to an internal host does
    // not bypass `assertSafeOutboundUrl`. We honour up to 5 hops and
    // re-validate each target.
    fetchOptions.redirect = 'manual';

    try {
      let res = await fetch(url, fetchOptions);
      let hops = 0;
      while (
        authentication === 'integration' &&
        res.status >= 300 &&
        res.status < 400 &&
        res.headers.get('location')
      ) {
        if (hops >= 5) {
          throw new Error('SSRF_BLOCKED: redirect chain exceeded 5 hops');
        }
        const location = res.headers.get('location') as string;
        const next = new URL(location, url).toString();
        assertSafeOutboundUrl(next);
        url = next;
        hops++;
        res = await fetch(url, fetchOptions);
      }
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

      const responseHeaders = sanitizeResponseHeaders(res.headers);
      const bodyFields = buildBodyOutputFields(
        cappedRequestBody,
        bodyType,
        responseHeaders,
      );
      if (res.ok) {
        return {
          config: configEcho,
          output: { response: responseData, ...bodyFields },
          meta,
          port: 'success',
        };
      }
      // Non-2xx: surface both the raw response (`output.response`) for
      // inspection AND the standardized runtime-error envelope required by
      // CONVENTIONS §3.2. Sanitize embedded credentials before echoing the
      // URL into `details` so workflow authors reading `output.error` can't
      // accidentally persist Basic Auth secrets.
      return {
        config: configEcho,
        output: {
          response: responseData,
          ...bodyFields,
          error: {
            code: res.status >= 500 ? 'HTTP_5XX' : 'HTTP_4XX',
            message: `HTTP ${res.status} ${res.statusText}`,
            details: {
              statusCode: res.status,
              statusText: res.statusText,
              url: sanitizeUrlCredentials(url),
              method,
            },
          },
        },
        meta,
        port: 'error',
      };
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
      // Transport failures don't carry a Response, so `responseHeaders` is
      // omitted. Downstream nodes can detect this via `port === 'error'`
      // + `error.code === 'HTTP_TRANSPORT_FAILED'`.
      const bodyFields = buildBodyOutputFields(cappedRequestBody, bodyType);
      return {
        config: configEcho,
        output: {
          response: { error: message },
          ...bodyFields,
          error: {
            code: 'HTTP_TRANSPORT_FAILED',
            message,
            details: { url: sanitizeUrlCredentials(url), method },
          },
        },
        meta: { statusCode: 0, duration },
        port: 'error',
      };
    }
  }
}

/**
 * Shared `output.*` body-related fields builder. Used at all three return
 * sites (success / non-2xx / transport error) so the contract stays
 * lock-step. `requestBodyType` carries the **evaluated** type (with the
 * `'json'` schema default applied) — Principle 7 + review W-5.
 */
function buildBodyOutputFields(
  capped: { value: unknown; truncated: boolean },
  evaluatedBodyType: string,
  responseHeaders?: Record<string, string>,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    requestBodyType: evaluatedBodyType,
  };
  if (capped.value !== undefined) fields.requestBody = capped.value;
  if (capped.truncated) fields.bodyTruncated = true;
  if (responseHeaders !== undefined) fields.responseHeaders = responseHeaders;
  return fields;
}

/**
 * Best-effort serialisation of the request body for echoing on
 * `output.requestBody`. Mirrors the shape that hit the wire — JSON / form /
 * raw all become inspectable values without re-parsing the network frame.
 * `FormData` isn't JSON-serialisable so we record the {key,value} entries
 * the user supplied (after `toKeyValueEntries` would normalise them).
 */
function serializeEvaluatedBody(body: unknown, bodyType: string): unknown {
  if (body === undefined) return undefined;
  if (bodyType === 'form-data') {
    const entries: Record<string, string> = {};
    for (const [k, v] of toKeyValueEntries(body)) {
      entries[k] = v;
    }
    return entries;
  }
  return body;
}

/**
 * Normalize config values that the schema declares as
 * `Array<{ key, value }>` but callers may legacy-pass as
 * `Record<string, string>`. Empty keys are dropped so malformed rows
 * in the UI don't produce invalid headers.
 */
function toKeyValueRecord(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of toKeyValueEntries(value)) {
    out[k] = v;
  }
  return out;
}

function toKeyValueEntries(value: unknown): Array<[string, string]> {
  if (value == null) return [];
  if (Array.isArray(value)) {
    const entries: Array<[string, string]> = [];
    for (const item of value) {
      if (item && typeof item === 'object' && 'key' in item) {
        const rec = item as { key: unknown; value: unknown };
        const key = stripCrlf(stringifyScalar(rec.key)).trim();
        if (!key) continue;
        entries.push([key, stripCrlf(stringifyScalar(rec.value))]);
      }
    }
    return entries;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]): [string, string] => [
        stripCrlf(k).trim(),
        stripCrlf(stringifyScalar(v)),
      ])
      .filter(([k]) => k.length > 0);
  }
  return [];
}

// Strip CR/LF from header-like values to prevent HTTP header injection when
// the workflow author can influence the key or value via expressions.
function stripCrlf(value: string): string {
  return value.replace(/[\r\n]/g, '');
}

function stringifyScalar(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
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
 * If the config URL is absolute (starts with `http://` or `https://`), use
 * it verbatim. Otherwise, prefix with `base_url` (if provided). Trims a
 * trailing slash from `base_url` and a leading slash from `configUrl` so
 * the join point yields exactly one `/`. Slashes inside the path are left
 * untouched.
 */
function resolveUrl(baseUrl: string | undefined, configUrl: string): string {
  if (/^https?:\/\//i.test(configUrl)) return configUrl;
  if (!baseUrl) return configUrl;
  return `${baseUrl.replace(/\/+$/, '')}/${configUrl.replace(/^\/+/, '')}`;
}
