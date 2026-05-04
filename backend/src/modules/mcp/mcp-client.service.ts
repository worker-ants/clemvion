import { Injectable, Logger } from '@nestjs/common';
import pLimit, { LimitFunction } from 'p-limit';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/**
 * Identifier sent to MCP servers in `clientInfo`. The MCP spec is happy with
 * any non-empty string — servers may log it for debugging. Keep stable so
 * downstream operators can correlate logs across deploys; bump the version
 * when the wire-level behavior of this client changes.
 */
const MCP_CLIENT_NAME = 'idea-workflow-backend';
const MCP_CLIENT_VERSION = '1.0.0';

/**
 * Connection parameters for an MCP server. Resolved from a workspace
 * Integration ({@link Integration}) of `service_type='mcp'`. The shape
 * mirrors the credentials JSONB schema declared in
 * `spec/2-navigation/4-integration.md §5.6`.
 *
 * The required-field discriminated union here lets the type system catch
 * "auth credentials missing" at compile time. Tests that intentionally pass
 * incomplete credentials must do so via an explicit cast (`as never`).
 */
export type McpConnectParams =
  | {
      url: string;
      authType: 'bearer_token';
      token: string;
      defaultHeaders?: Record<string, string>;
    }
  | {
      url: string;
      authType: 'api_key';
      headerName: string;
      value: string;
      defaultHeaders?: Record<string, string>;
    }
  | {
      url: string;
      authType: 'none';
      defaultHeaders?: Record<string, string>;
    };

/**
 * Subset of the official `@modelcontextprotocol/sdk` `Client` surface that
 * AI Agent code paths consume. Re-exposed so callers do not need to depend on
 * the SDK type imports directly.
 */
export interface McpSession {
  readonly capabilities: ServerCapabilities;
  readonly serverInfo: ServerInfo;
  listTools(params?: ListParams): Promise<ListToolsResult>;
  callTool(params: CallToolParams): Promise<CallToolResult>;
  listResources(params?: ListParams): Promise<ListResourcesResult>;
  readResource(params: { uri: string }): Promise<ReadResourceResult>;
  listPrompts(params?: ListParams): Promise<ListPromptsResult>;
  getPrompt(params: GetPromptParams): Promise<GetPromptResult>;
  close(): Promise<void>;
}

export interface ServerCapabilities {
  tools?: Record<string, unknown>;
  resources?: Record<string, unknown>;
  prompts?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ServerInfo {
  name: string;
  version: string;
}

export type ListParams = { cursor?: string };

export interface McpToolDef {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ListToolsResult {
  tools: McpToolDef[];
  nextCursor?: string;
}

export interface CallToolParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface CallToolResult {
  content: Array<Record<string, unknown>>;
  isError?: boolean;
  [key: string]: unknown;
}

export interface McpResourceDef {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface ListResourcesResult {
  resources: McpResourceDef[];
  nextCursor?: string;
}

export interface ReadResourceResult {
  contents: Array<Record<string, unknown>>;
}

export interface McpPromptDef {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface ListPromptsResult {
  prompts: McpPromptDef[];
  nextCursor?: string;
}

export interface GetPromptParams {
  name: string;
  /**
   * MCP prompt arguments are string-valued by spec — the LLM caller is
   * expected to coerce non-string values to text before invoking the prompt.
   */
  arguments?: Record<string, string>;
}

export interface GetPromptResult {
  description?: string;
  messages: Array<Record<string, unknown>>;
}

/**
 * URL or host is rejected by transport policy — `https://` strictly required
 * and SSRF-blocked hosts (loopback / link-local / RFC1918 / IPv6 ULA / cloud
 * metadata endpoints) cannot be used. See
 * `spec/5-system/11-mcp-client.md §3.2`.
 */
export class McpHttpsRequiredError extends Error {
  readonly code = 'MCP_HTTPS_REQUIRED';
  constructor(reason: string) {
    super(reason);
    this.name = 'McpHttpsRequiredError';
  }
}

/**
 * Auth credentials are missing or malformed. Maps to the user-facing
 * `MCP_AUTH_FAILED` vocabulary downstream.
 */
export class McpAuthError extends Error {
  readonly code = 'MCP_AUTH_FAILED';
  constructor(message: string) {
    super(message);
    this.name = 'McpAuthError';
  }
}

/**
 * `default_headers` contains a forbidden value — CRLF in name/value or an
 * attempt to override a hop-by-hop / framing-relevant header. Mapped upstream
 * to the same `MCP_AUTH_FAILED` vocabulary for user simplicity (the failure
 * is structural rather than transport-level so emitting `MCP_HEADER_*`
 * separately would force a UI distinction with no practical value).
 */
export class McpInvalidHeaderError extends Error {
  readonly code = 'MCP_AUTH_FAILED';
  constructor(message: string) {
    super(message);
    this.name = 'McpInvalidHeaderError';
  }
}

/** Default — environment override via `MCP_MAX_CONCURRENT_CONNECTIONS`. */
const DEFAULT_MAX_CONCURRENT_CONNECTIONS = 20;
/** Default connect+initialize timeout in ms (spec §4.4). */
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;

/**
 * Headers the user is NOT allowed to override via `default_headers`. These
 * either control framing (Content-Length, Transfer-Encoding) or are computed
 * by the transport itself (Host, Connection). Allowing them through would
 * either break the request or let an attacker smuggle traffic.
 */
const FORBIDDEN_HEADER_NAMES = new Set(
  [
    'host',
    'connection',
    'content-length',
    'transfer-encoding',
    'upgrade',
    'te',
    'expect',
    'trailer',
    'proxy-authenticate',
    'proxy-authorization',
    'mcp-session-id',
  ].map((s) => s.toLowerCase()),
);

/**
 * Wraps the `@modelcontextprotocol/sdk` Streamable HTTP client into a
 * Nest-friendly service. Each {@link connect} call yields a fresh
 * {@link McpSession} — the service itself holds no per-request state, which
 * keeps the lifecycle decision (per node execution, per request, etc.) in
 * the hands of the caller. AI Agent uses one session per node execution
 * (see `spec/5-system/11-mcp-client.md §4`).
 *
 * A process-wide semaphore (`MCP_MAX_CONCURRENT_CONNECTIONS`, default 20)
 * caps the number of simultaneous outbound MCP connections so a single
 * workspace cannot exhaust the Node event loop's connection capacity.
 *
 * Connection failures surface as the SDK's native errors verbatim — callers
 * are expected to translate them into the `MCP_*` vocabulary at the boundary
 * where they enter user-visible state (`mcpDiagnostics`, `IntegrationUsageLog`).
 */
@Injectable()
export class McpClientService {
  private readonly logger = new Logger(McpClientService.name);
  private readonly limit: LimitFunction;
  private readonly connectTimeoutMs: number;

  constructor() {
    const max =
      Number(process.env.MCP_MAX_CONCURRENT_CONNECTIONS) ||
      DEFAULT_MAX_CONCURRENT_CONNECTIONS;
    this.limit = pLimit(max);
    this.connectTimeoutMs =
      Number(process.env.MCP_CONNECT_TIMEOUT_MS) || DEFAULT_CONNECT_TIMEOUT_MS;
  }

  async connect(params: McpConnectParams): Promise<McpSession> {
    const url = this.requireSafeHttpsUrl(params.url);
    const headers = this.buildHeaders(params);

    return this.limit(() => this.connectInner(url, headers));
  }

  private async connectInner(
    url: URL,
    headers: Record<string, string>,
  ): Promise<McpSession> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), this.connectTimeoutMs);

    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers, signal: abort.signal },
    });

    const client = new Client({
      name: MCP_CLIENT_NAME,
      version: MCP_CLIENT_VERSION,
    });

    try {
      await client.connect(transport);
    } finally {
      clearTimeout(timer);
    }

    const capabilities: ServerCapabilities =
      client.getServerCapabilities() ?? {};
    const serverInfo: ServerInfo = client.getServerVersion() ?? {
      name: 'unknown',
      version: '0.0.0',
    };

    return new SessionImpl(client, capabilities, serverInfo, this.logger);
  }

  /**
   * Validate URL is well-formed, https-only, and the host is not a known
   * SSRF-sensitive endpoint. Returns the parsed URL for downstream use.
   *
   * Note: this is a literal-only check (we do NOT resolve DNS to try to
   * detect a private IP behind a public hostname). Defense in depth against
   * DNS rebinding belongs at the transport layer or a corporate egress
   * proxy — out of scope for the first pass but tracked in spec §3.2.
   */
  private requireSafeHttpsUrl(raw: string): URL {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new McpHttpsRequiredError(
        `MCP server URL must be a well-formed https:// URL`,
      );
    }
    if (parsed.protocol !== 'https:') {
      throw new McpHttpsRequiredError(
        `MCP server URL must use https:// (got ${parsed.protocol})`,
      );
    }
    // Node URL.hostname returns IPv6 literals with surrounding brackets —
    // strip them before pattern matching.
    const rawHost = parsed.hostname.toLowerCase();
    const host =
      rawHost.startsWith('[') && rawHost.endsWith(']')
        ? rawHost.slice(1, -1)
        : rawHost;
    if (this.isBlockedHost(host)) {
      throw new McpHttpsRequiredError(
        `MCP server host is blocked by SSRF policy (host=${host})`,
      );
    }
    return parsed;
  }

  /**
   * Pure-literal SSRF host blocklist. Returns true if the hostname is a
   * private/loopback/metadata endpoint that must not be reachable from a
   * workspace-controlled URL. See spec §3.2.
   */
  private isBlockedHost(host: string): boolean {
    if (!host) return true;
    if (host === 'localhost' || host === 'localhost.') return true;
    // Cloud metadata endpoints
    if (host === 'metadata.google.internal') return true;
    if (host === 'metadata.azure.com') return true;
    if (host === 'metadata.amazonaws.com') return true;
    // IPv4 literal
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      return this.isBlockedIPv4(host);
    }
    // IPv6 literal (URL hostname strips brackets)
    if (host.includes(':')) {
      return this.isBlockedIPv6(host);
    }
    return false;
  }

  private isBlockedIPv4(host: string): boolean {
    const parts = host.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => n < 0 || n > 255 || isNaN(n)))
      return true;
    const [a, b] = parts;
    // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8
    if (a === 0 || a === 10 || a === 127) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 (link-local incl. AWS metadata 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 100.64.0.0/10 (carrier-grade NAT — also avoid)
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  private isBlockedIPv6(host: string): boolean {
    const lower = host.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    // ::ffff:a.b.c.d (IPv4-mapped) — enforce v4 rules
    const v4Mapped = lower.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (v4Mapped) return this.isBlockedIPv4(v4Mapped[1]);
    // fc00::/7 unique-local, fe80::/10 link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('fe8') || lower.startsWith('fe9')) return true;
    if (lower.startsWith('fea') || lower.startsWith('feb')) return true;
    return false;
  }

  /**
   * Build the outbound HTTP header map. Precedence (lowest → highest):
   *   default_headers → auth header
   *
   * default_headers is sanitized: CRLF in name or value triggers
   * {@link McpInvalidHeaderError}, and a small set of framing-relevant
   * headers are forbidden outright (Host, Content-Length, etc).
   */
  private buildHeaders(params: McpConnectParams): Record<string, string> {
    const headers: Record<string, string> = {};
    if (params.defaultHeaders) {
      for (const [name, value] of Object.entries(params.defaultHeaders)) {
        const sanitizedName = this.sanitizeHeaderName(name);
        headers[sanitizedName] = this.sanitizeHeaderValue(value);
      }
    }

    if (params.authType === 'bearer_token') {
      // Defense in depth — types enforce `token: string`, but a caller using
      // `as never` could still slip an empty string or undefined through.
      if (!params.token) {
        throw new McpAuthError(
          'bearer_token credential requires a non-empty token',
        );
      }
      this.deleteHeaderCaseInsensitive(headers, 'authorization');
      headers.Authorization = `Bearer ${params.token}`;
      return headers;
    }

    if (params.authType === 'api_key') {
      if (!params.headerName || !params.value) {
        throw new McpAuthError(
          'api_key credential requires both header_name and value',
        );
      }
      const headerName = this.sanitizeHeaderName(params.headerName);
      this.deleteHeaderCaseInsensitive(headers, headerName);
      headers[headerName] = this.sanitizeHeaderValue(params.value);
      return headers;
    }

    return headers;
  }

  private sanitizeHeaderName(name: string): string {
    if (typeof name !== 'string' || name.length === 0) {
      throw new McpInvalidHeaderError('Header name must be a non-empty string');
    }
    if (/[\r\n\0]/.test(name)) {
      throw new McpInvalidHeaderError(
        `Header name contains forbidden control characters`,
      );
    }
    // RFC 7230 token = ALPHA / DIGIT / "!#$%&'*+-.^_`|~"
    if (!/^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$/.test(name)) {
      throw new McpInvalidHeaderError(`Header name must be an RFC 7230 token`);
    }
    if (FORBIDDEN_HEADER_NAMES.has(name.toLowerCase())) {
      throw new McpInvalidHeaderError(
        `Header "${name}" cannot be set via default_headers (reserved)`,
      );
    }
    return name;
  }

  private sanitizeHeaderValue(value: unknown): string {
    if (typeof value !== 'string') {
      throw new McpInvalidHeaderError('Header value must be a string');
    }
    if (/[\r\n\0]/.test(value)) {
      throw new McpInvalidHeaderError(
        'Header value contains forbidden control characters',
      );
    }
    return value;
  }

  private deleteHeaderCaseInsensitive(
    headers: Record<string, string>,
    key: string,
  ): void {
    const lower = key.toLowerCase();
    for (const existing of Object.keys(headers)) {
      if (existing.toLowerCase() === lower) {
        delete headers[existing];
      }
    }
  }
}

class SessionImpl implements McpSession {
  constructor(
    private readonly client: Client,
    readonly capabilities: ServerCapabilities,
    readonly serverInfo: ServerInfo,
    private readonly logger: Logger,
  ) {}

  listTools(params?: ListParams): Promise<ListToolsResult> {
    return this.client.listTools(params) as Promise<ListToolsResult>;
  }

  callTool(params: CallToolParams): Promise<CallToolResult> {
    return this.client.callTool(
      params,
      undefined,
      undefined,
    ) as Promise<CallToolResult>;
  }

  listResources(params?: ListParams): Promise<ListResourcesResult> {
    return this.client.listResources(params) as Promise<ListResourcesResult>;
  }

  readResource(params: { uri: string }): Promise<ReadResourceResult> {
    return this.client.readResource(
      params,
      undefined,
    ) as Promise<ReadResourceResult>;
  }

  listPrompts(params?: ListParams): Promise<ListPromptsResult> {
    return this.client.listPrompts(params) as Promise<ListPromptsResult>;
  }

  getPrompt(params: GetPromptParams): Promise<GetPromptResult> {
    return this.client.getPrompt(params, undefined) as Promise<GetPromptResult>;
  }

  async close(): Promise<void> {
    try {
      await this.client.close();
    } catch (err) {
      // Closing is best-effort. Surfacing a partial-close error to the caller
      // would mask the real upstream failure that triggered the close.
      this.logger.warn(
        `Failed to close MCP client: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
