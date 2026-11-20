import type { LookupAddress } from 'node:dns';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pLimit, { LimitFunction } from 'p-limit';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { FetchLike } from '@modelcontextprotocol/sdk/shared/transport.js';
import { TimeoutError, withTimeout } from '../../common/utils/with-timeout';
import {
  createGuardedLookupDispatcher,
  createLazyGuardedDispatcher,
  findCause,
} from '../../common/utils/guarded-lookup-dispatcher';
import { isBlockedIpLiteral } from '../../common/utils/ssrf/ip-classifier';

/**
 * Identifier sent to MCP servers in `clientInfo`. The MCP spec is happy with
 * any non-empty string — servers may log it for debugging. Keep stable so
 * downstream operators can correlate logs across deploys; bump the version
 * when the wire-level behavior of this client changes.
 */
const MCP_CLIENT_NAME = 'clemvion-backend';
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
 * MCP 서버 URL 이 `https://` 가 아니거나(`MCP_ALLOW_INSECURE_URL` 이 켜져 있으면 http(s) 가 아닌 스킴) 파싱할 수 없다.
 * 주소 차단은 {@link McpHostBlockedError} 가 따로 맡는다. 근거는 [MCP 연결](CLE-INT-MCP-CONN) 「자격 증명과 URL 검증」.
 */
export class McpHttpsRequiredError extends Error {
  readonly code = 'MCP_HTTPS_REQUIRED';
  constructor(reason: string) {
    super(reason);
    this.name = 'McpHttpsRequiredError';
  }
}

/**
 * MCP 서버 호스트가 SSRF 정책으로 막혔다. 리터럴 판정 · DNS 해석 주소 판정 · 연결 시점 판정 세 곳이 이 오류를 낸다
 * (NERV Task `CLE-T-DDN3MS`). message 에는 사용자가 적은 호스트 이름만 싣는다. 해석된 주소는 서버 로그에만 남긴다.
 * 연결 테스트는 `MCP_HOST_BLOCKED` 로 돌려주고, 노드 실행의 도구 목록 구성은 다른 connect 실패처럼 `MCP_CONNECT_FAILED` 로 모은다.
 */
export class McpHostBlockedError extends Error {
  readonly code = 'MCP_HOST_BLOCKED';
  constructor(reason: string) {
    super(reason);
    this.name = 'McpHostBlockedError';
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
  /** {@link guardedFetch} 가 나눠 쓰는 연결 시점 판정 dispatcher. 처음 쓸 때 만든다. */
  private readonly connectGuardDispatcher = createLazyGuardedDispatcher(() =>
    createGuardedLookupDispatcher(({ address }, hostname) => {
      if (!this.isBlockedHost(address.toLowerCase())) return null;
      this.logger.warn(
        `[mcp] SSRF block at connect: host ${hostname} resolved to ${address}`,
      );
      return new McpHostBlockedError(
        `MCP server host is blocked by SSRF policy (host=${hostname})`,
      );
    }),
  );

  // refactor M-6: MCP_MAX_CONCURRENT_CONNECTIONS / MCP_CONNECT_TIMEOUT_MS 직접 접근을
  // ConfigService(`mcp.*`, number|undefined 로 파싱됨)로 이전. `@Optional()` — 수동 생성
  // 테스트(`new McpClientService()`)는 configService 미주입 → `undefined || DEFAULT_*` 로
  // 기존 폴백 동작을 보존한다(`'0'`→DEFAULT 등 `||` 의미 동일).
  constructor(@Optional() private readonly configService?: ConfigService) {
    const max =
      this.configService?.get<number>('mcp.maxConcurrentConnections') ||
      DEFAULT_MAX_CONCURRENT_CONNECTIONS;
    this.limit = pLimit(max);
    this.connectTimeoutMs =
      this.configService?.get<number>('mcp.connectTimeoutMs') ||
      DEFAULT_CONNECT_TIMEOUT_MS;
  }

  /**
   * refactor M-6: MCP_ALLOW_INSECURE_URL escape hatch 의 단일 source. ConfigService
   * (`mcp.allowInsecureUrl`, boolean — `'true'`/`'1'` 만 ON 으로 config 레이어가 파싱)를 읽는다.
   * configService 미주입(수동 테스트) 시 false(strict). `McpToolProvider` 가 주입된 본 인스턴스
   * 경유로 동일 source 를 공유한다.
   */
  get allowInsecureUrl(): boolean {
    return this.configService?.get<boolean>('mcp.allowInsecureUrl') ?? false;
  }

  async connect(params: McpConnectParams): Promise<McpSession> {
    const url = this.requireSafeHttpsUrl(params.url);
    const headers = this.buildHeaders(params);
    await this.requireSafeResolvedHost(url);

    return this.limit(() => this.connectInner(url, headers));
  }

  private async connectInner(
    url: URL,
    headers: Record<string, string>,
  ): Promise<McpSession> {
    const abort = new AbortController();
    // Track whether the abort was fired by *our* deadline vs the SDK/network,
    // so a connect timeout surfaces as a distinct `TimeoutError` (→ MCP_TIMEOUT)
    // rather than an opaque abort/transport error (→ MCP_CONNECT_FAILED). This
    // AbortController genuinely cancels the in-flight fetch (unlike withTimeout's
    // soft deadline), so it stays the connect-phase timeout mechanism.
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, this.connectTimeoutMs);

    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers, signal: abort.signal },
      fetch: this.guardedFetch(),
    });

    const client = new Client({
      name: MCP_CLIENT_NAME,
      version: MCP_CLIENT_VERSION,
    });

    try {
      await client.connect(transport);
    } catch (err) {
      if (timedOut) {
        throw new TimeoutError(`connect ${url.host}`, this.connectTimeoutMs);
      }
      // 연결 시점 판정이 막으면 fetch 오류의 `cause` 에 판정 오류가 있다. 사전 검사 차단과 같은 오류로 올린다.
      throw findCause(err, McpHostBlockedError) ?? err;
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
   * This is the literal check. A hostname that resolves to a private address
   * is caught right after by {@link requireSafeResolvedHost}.
   */
  private requireSafeHttpsUrl(raw: string): URL {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new McpHttpsRequiredError(
        `MCP server URL must be a well-formed URL`,
      );
    }

    // Local-development escape hatch. When set, the operator has explicitly
    // accepted that http:// + private-network / loopback hosts may be used
    // (e.g. running a sample MCP server on http://localhost:3001). The flag
    // is resolved via ConfigService (`mcp.allowInsecureUrl`, refactor M-6).
    if (this.allowInsecureUrl) {
      // Still require http/https — file://, ftp://, ws:// etc. are never OK.
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new McpHttpsRequiredError(
          `MCP server URL must use http(s):// (got ${parsed.protocol})`,
        );
      }
      return parsed;
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
      throw new McpHostBlockedError(
        `MCP server host is blocked by SSRF policy (host=${host})`,
      );
    }
    return parsed;
  }

  /**
   * 호스트 이름(IP literal 이 아닌 것)을 연결 직전에 DNS 로 해석해, 나온 주소 가운데 하나라도
   * {@link isBlockedHost} 에 걸리면 literal 차단과 같은 {@link McpHostBlockedError} 를 던진다
   * (CLE-INT-MCP 「자격 증명과 URL 검증」 3항, NERV Task `CLE-T-RAPNHB`).
   *
   * - 오류 메시지에는 사용자가 적은 호스트 이름만 싣는다. 해석된 주소는 내부망 정찰에 쓰일 수 있어 서버 로그에만 남긴다.
   * - `MCP_ALLOW_INSECURE_URL`(`allowInsecureUrl`)이 켜져 있으면 literal 검사처럼 건너뛴다. 통합 노드의
   *   `ALLOW_PRIVATE_HOST_TARGETS` 는 보지 않는다.
   * - 해석에는 connect 타임아웃(`mcp.connectTimeoutMs`)과 같은 상한을 둔다. 시간 초과는 `TimeoutError` 로 던져
   *   `MCP_TIMEOUT` 으로 분류된다(검사를 건너뛰지 않는다).
   * - 시간 초과가 아닌 DNS 해석 실패는 막지 않는다(fail-open). 같은 이름은 SDK 의 fetch 에서도 풀리지 않아 연결 실패로 드러난다.
   * - 검사와 SDK 의 실제 연결은 각자 해석한다. 그 사이 DNS 응답이 바뀌는 경우는 {@link guardedFetch} 가 연결할 때 다시
   *   판정해서 막는다(NERV Task `CLE-T-BS1WD1`). 이 검사는 차단을 연결 전에 같은 오류로 알리려고 남긴다.
   */
  private async requireSafeResolvedHost(url: URL): Promise<void> {
    if (this.allowInsecureUrl) return;
    const host = url.hostname.toLowerCase();
    // IPv6 literal 은 `[...]` 로 오고 IPv4 literal 은 그대로 온다. 둘 다 literal 검사가 이미 봤다.
    if (host.startsWith('[') || isIP(host) !== 0) return;

    let addresses: LookupAddress[];
    try {
      addresses = await withTimeout(
        lookup(host, { all: true, verbatim: true }),
        this.connectTimeoutMs,
        `resolve ${host}`,
      );
    } catch (err) {
      // 시간 초과는 넘기지 않는다. 느린 응답으로 검사를 건너뛰게 할 수 없고, connect 타임아웃과 같은 MCP_TIMEOUT 으로 분류된다.
      if (err instanceof TimeoutError) throw err;
      return;
    }
    const blocked = addresses.find((entry) =>
      this.isBlockedHost(entry.address.toLowerCase()),
    );
    if (blocked) {
      this.logger.warn(
        `[mcp] SSRF block: host ${host} resolved to ${blocked.address}`,
      );
      throw new McpHostBlockedError(
        `MCP server host is blocked by SSRF policy (host=${host})`,
      );
    }
  }

  /**
   * SDK transport 에 넘기는 fetch. 실제 연결이 쓰는 주소 조회에 {@link isBlockedHost} 판정을 넣은 dispatcher 를 붙인다.
   * 연결할 때 푼 주소가 막힌 대역이면 연결하지 않고, `fetch` 오류의 `cause` 에 {@link McpHostBlockedError} 를 싣는다.
   *
   * - 메시지는 사전 검사와 같이 사용자가 적은 호스트 이름만 싣는다. 해석된 주소는 서버 로그에만 남긴다.
   * - `MCP_ALLOW_INSECURE_URL` 이 켜져 있으면 `undefined` 다. SDK 는 전역 fetch 를 쓴다.
   * - SDK 의 요청(초기화 · 알림 스트림 · 인증 탐색)이 모두 이 fetch 를 쓰므로 같은 판정을 받는다.
   * - IP 리터럴 호스트는 연결 때 조회하지 않으므로 {@link requireSafeHttpsUrl} 이 맡는다.
   */
  private guardedFetch(): FetchLike | undefined {
    if (this.allowInsecureUrl) return undefined;
    const dispatcher = this.connectGuardDispatcher.get();
    // `dispatcher` 는 Node fetch(undici) 확장이라 DOM 의 `RequestInit` 타입에 없다.
    return (input, init) =>
      fetch(input, { ...init, dispatcher } as RequestInit);
  }

  /**
   * SSRF host blocklist. host 이름(literal)과 DNS 로 해석된 주소({@link requireSafeResolvedHost}) 모두에 쓴다.
   * Returns true if the host is a private/loopback/metadata endpoint that must not be reachable from a
   * workspace-controlled URL. See spec §3.2.
   */
  private isBlockedHost(host: string): boolean {
    if (!host) return true;
    if (host === 'localhost' || host === 'localhost.') return true;
    // Cloud metadata endpoints
    if (host === 'metadata.google.internal') return true;
    if (host === 'metadata.azure.com') return true;
    if (host === 'metadata.amazonaws.com') return true;
    // IP 리터럴은 SSRF 가드 네 벌이 함께 쓰는 판정(`common/utils/ssrf/ip-classifier.ts`)으로 본다. 정규화하지 못한 IPv6
    // 모양 문자열과 255 를 넘는 octet 은 막는다(fail-closed).
    return isBlockedIpLiteral(host);
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
    return this.client.listTools(params);
  }

  callTool(params: CallToolParams): Promise<CallToolResult> {
    return this.client.callTool(
      params,
      undefined,
      undefined,
    ) as Promise<CallToolResult>;
  }

  listResources(params?: ListParams): Promise<ListResourcesResult> {
    return this.client.listResources(params);
  }

  readResource(params: { uri: string }): Promise<ReadResourceResult> {
    return this.client.readResource(params, undefined);
  }

  listPrompts(params?: ListParams): Promise<ListPromptsResult> {
    return this.client.listPrompts(params);
  }

  getPrompt(params: GetPromptParams): Promise<GetPromptResult> {
    return this.client.getPrompt(params, undefined);
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
