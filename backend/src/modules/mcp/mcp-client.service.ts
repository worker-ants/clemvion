import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/**
 * Connection parameters for an MCP server. Resolved from a workspace
 * Integration ({@link Integration}) of `service_type='mcp'`. The shape
 * mirrors the credentials JSONB schema declared in
 * `spec/2-navigation/4-integration.md §5.6`.
 */
export type McpConnectParams =
  | {
      url: string;
      authType: 'bearer_token';
      token?: string;
      defaultHeaders?: Record<string, string>;
    }
  | {
      url: string;
      authType: 'api_key';
      headerName?: string;
      value?: string;
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

/** HTTPS-only transport policy (per `spec/5-system/11-mcp-client.md §2.1`). */
export class McpHttpsRequiredError extends Error {
  readonly code = 'MCP_HTTPS_REQUIRED';
  constructor(url: string) {
    super(`MCP server URL must use https:// (got ${url})`);
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
 * Wraps the `@modelcontextprotocol/sdk` Streamable HTTP client into a
 * Nest-friendly service. Each {@link connect} call yields a fresh
 * {@link McpSession} — the service itself holds no per-request state, which
 * keeps the lifecycle decision (per node execution, per request, etc.) in
 * the hands of the caller. AI Agent uses one session per node execution
 * (see `spec/5-system/11-mcp-client.md §4`).
 *
 * Connection failures surface as the SDK's native errors verbatim — callers
 * are expected to translate them into the `MCP_*` vocabulary at the boundary
 * where they enter user-visible state (`mcpDiagnostics`, `IntegrationUsageLog`).
 */
@Injectable()
export class McpClientService {
  private readonly logger = new Logger(McpClientService.name);

  async connect(params: McpConnectParams): Promise<McpSession> {
    const url = this.requireHttpsUrl(params.url);
    const headers = this.buildHeaders(params);

    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers },
    });

    const client = new Client({
      name: 'idea-workflow-backend',
      version: '0.1.0',
    });

    await client.connect(transport);

    const capabilities: ServerCapabilities =
      client.getServerCapabilities() ?? {};
    const serverInfo: ServerInfo = client.getServerVersion() ?? {
      name: 'unknown',
      version: '0.0.0',
    };

    return new SessionImpl(client, capabilities, serverInfo, this.logger);
  }

  private requireHttpsUrl(raw: string): URL {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new McpHttpsRequiredError(raw);
    }
    if (parsed.protocol !== 'https:') {
      throw new McpHttpsRequiredError(raw);
    }
    return parsed;
  }

  private buildHeaders(params: McpConnectParams): Record<string, string> {
    // default_headers is the lowest precedence — auth headers must override it
    const headers: Record<string, string> = {
      ...(params.defaultHeaders ?? {}),
    };

    if (params.authType === 'bearer_token') {
      if (!params.token) {
        throw new McpAuthError(
          'bearer_token credential requires a non-empty token',
        );
      }
      // Strip any default_headers entry that would conflict (case-insensitive).
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
      this.deleteHeaderCaseInsensitive(headers, params.headerName);
      headers[params.headerName] = params.value;
      return headers;
    }

    // authType === 'none'
    return headers;
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
