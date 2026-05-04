import { Logger } from '@nestjs/common';
import {
  ToolCall,
  ToolDef,
} from '../../../../modules/llm/interfaces/llm-client.interface';
import {
  IntegrationsService,
  PublicIntegration,
} from '../../../../modules/integrations/integrations.service';
import {
  McpClientService,
  McpConnectParams,
  McpSession,
} from '../../../../modules/mcp/mcp-client.service';
import type { Integration } from '../../../../modules/integrations/entities/integration.entity';
import {
  AgentToolProvider,
  AgentToolResult,
  ProviderBuildCtx,
  ProviderCleanupCtx,
  ProviderExecCtx,
} from './agent-tool-provider.interface';

const SID_LENGTH = 8;
const SEP = '__';
const PREFIX = 'mcp_';
const META_LIST_RESOURCES = 'list_resources';
const META_READ_RESOURCE = 'read_resource';
const META_LIST_PROMPTS = 'list_prompts';
const META_GET_PROMPT = 'get_prompt';

/**
 * Cap on the JSON-serialized tool_result content delivered to the LLM. Spec
 * §8.1 sets 100 KB as the soft limit; configurable via env so an operator can
 * tune for very large MCP servers without redeploying.
 */
const MAX_RESPONSE_BYTES =
  Number(process.env.MCP_MAX_RESPONSE_BYTES) || 102_400;

const CALL_TIMEOUT_MS = Number(process.env.MCP_CALL_TIMEOUT_MS) || 30_000;
const LIST_TIMEOUT_MS = Number(process.env.MCP_LIST_TIMEOUT_MS) || 10_000;

/** McpServerRef as declared in `aiAgentNodeConfigSchema.mcpServers`. */
interface McpServerRefConfig {
  integrationId: string;
  enabledTools?: string[];
  includeResources?: boolean;
  includePrompts?: boolean;
  toolOverrides?: Array<{ toolName: string; description?: string }>;
}

/**
 * Minimal Integration shape consumed here. The runtime value comes from
 * `IntegrationsService.getForExecution()` which returns the entity with
 * decrypted credentials.
 */
type IntegrationLike = Pick<
  Integration,
  'id' | 'name' | 'serviceType' | 'authType' | 'credentials'
> & {
  credentials: Record<string, unknown>;
};

/**
 * Per-server runtime state inside a single node execution. `tools` lists the
 * server's `tools/list` response (filtered by allowlist) so `execute()` can
 * map a sanitized tool name back to the original MCP tool name without
 * re-listing on every call.
 */
interface ServerEntry {
  integrationId: string;
  integrationName: string;
  /** Maps `<sanitized>` → original `<toolName>` for callTool dispatch. */
  toolNameMap: Map<string, string>;
  /** original tool name → MCP ToolDef captured at connect time. */
  toolDefs: Map<
    string,
    { name: string; description?: string; inputSchema: unknown }
  >;
  session: McpSession;
  capabilities: { resources: boolean; prompts: boolean };
}

/**
 * Sanitize a tool name to the alphabet LLM provider APIs accept. Mirrors the
 * `kb_<sanitizedKbId>` rule used by `KbToolProvider` so the provider stack
 * stays consistent.
 */
function sanitizeToolName(s: string): string {
  return s.replace(/[^a-zA-Z0-9_]/g, '_');
}

function shortIntegrationId(id: string): string {
  return sanitizeToolName(id.slice(0, SID_LENGTH));
}

/**
 * Build the LLM-visible tool name for an `(integrationId, toolName)` pair.
 * Exported so other code (tests, future debug UI) can reproduce the naming
 * without re-implementing the rule.
 */
export function mcpToolName(integrationId: string, toolName: string): string {
  return `${PREFIX}${shortIntegrationId(integrationId)}${SEP}${sanitizeToolName(toolName)}`;
}

/**
 * Inverse of {@link mcpToolName} — splits an MCP-prefixed name back into
 * `(sid, sanitized tool name)`. Returns `null` if the input is not a valid
 * MCP tool name; callers must not assume `sid` corresponds to a real server.
 */
export function parseMcpToolName(
  name: string,
): { sid: string; toolNameSanitized: string } | null {
  if (!name.startsWith(PREFIX)) return null;
  const body = name.slice(PREFIX.length);
  const sepIdx = body.indexOf(SEP);
  if (sepIdx <= 0 || sepIdx + SEP.length >= body.length) return null;
  return {
    sid: body.slice(0, sepIdx),
    toolNameSanitized: body.slice(sepIdx + SEP.length),
  };
}

/**
 * Wraps a Promise with a timeout. Same shape used by `McpTestConnectionService`
 * — duplicated here rather than shared because the two providers may diverge
 * in retry / abort behavior later (e.g. resumable streams).
 */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/**
 * Exposes MCP servers (registered as `service_type='mcp'` Integrations) as
 * LLM tools to the AI Agent. One `McpToolProvider` instance is shared across
 * every AI Agent execution in the process; per-execution state (open sessions,
 * tool name maps) is keyed by `executionId` so concurrent executions stay
 * isolated.
 *
 * Lifecycle (per spec/5-system/11-mcp-client.md §4):
 *   buildTools  — connect to each configured server, list tools, cache session
 *   execute     — reuse the cached session, callTool, serialize content
 *   cleanup     — close every session attached to this `executionId`
 *
 * One server's failure must not poison the others — `Promise.allSettled` is
 * used at the connect/list boundary and connect/list errors are recorded
 * server-locally rather than thrown.
 */
export class McpToolProvider implements AgentToolProvider {
  readonly key = 'mcp';

  private static readonly logger = new Logger('McpToolProvider');

  /**
   * `Map<executionId, Map<integrationId, ServerEntry>>`. Sessions are scoped
   * by executionId so two AI Agent runs against the same server do not share
   * state (and one's `cleanup` cannot close the other's connection).
   */
  private readonly sessionsByExecution = new Map<
    string,
    Map<string, ServerEntry>
  >();

  constructor(
    private readonly mcpClient: McpClientService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  matches(toolName: string): boolean {
    return toolName.startsWith(PREFIX);
  }

  async buildTools(ctx: ProviderBuildCtx): Promise<ToolDef[]> {
    const refs = this.parseRefs(ctx.config);
    if (refs.length === 0) return [];

    const execId = this.executionKey(ctx.executionId);
    const sessions = this.getOrCreateSessionMap(execId);

    // For each server, ensure a session and collect its tool defs in parallel.
    const settled = await Promise.allSettled(
      refs.map((ref) => this.materializeServer(ref, ctx, execId, sessions)),
    );

    const out: ToolDef[] = [];
    for (let i = 0; i < settled.length; i++) {
      const r = settled[i];
      if (r.status === 'fulfilled') {
        out.push(...r.value);
      } else {
        McpToolProvider.logger.warn(
          `MCP server ${refs[i].integrationId} build failed — skipping: ${
            r.reason instanceof Error ? r.reason.message : String(r.reason)
          }`,
        );
      }
    }
    return out;
  }

  async execute(
    call: ToolCall,
    ctx: ProviderExecCtx,
  ): Promise<AgentToolResult> {
    const parsed = parseMcpToolName(call.name);
    if (!parsed) {
      return this.errorResult(
        call.id,
        'INVALID_TOOL_ARGUMENTS',
        'Malformed MCP tool name',
      );
    }

    const execId = this.executionKey(ctx.executionId);
    const sessions = this.sessionsByExecution.get(execId);
    const entry = sessions
      ? this.findEntryBySid(sessions, parsed.sid)
      : undefined;

    if (!entry) {
      return this.errorResult(
        call.id,
        'MCP_UNKNOWN_TOOL',
        'No active MCP session for this tool — was buildTools called first?',
      );
    }

    let args: Record<string, unknown>;
    try {
      args = call.arguments
        ? (JSON.parse(call.arguments) as Record<string, unknown>)
        : {};
      if (typeof args !== 'object' || args === null || Array.isArray(args)) {
        throw new Error('arguments must be a JSON object');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return this.errorResult(
        call.id,
        'INVALID_TOOL_ARGUMENTS',
        `Failed to parse tool arguments: ${msg}`,
      );
    }

    // Meta tools (resources/prompts) — exact name match.
    const meta = this.routeMetaTool(parsed.toolNameSanitized);
    if (meta) {
      return this.executeMeta(call.id, meta, args, entry);
    }

    // Regular tool — map sanitized → original name and forward.
    const originalName = entry.toolNameMap.get(parsed.toolNameSanitized);
    if (!originalName) {
      return this.errorResult(
        call.id,
        'MCP_UNKNOWN_TOOL',
        `Tool "${parsed.toolNameSanitized}" not exposed by server "${entry.integrationName}"`,
      );
    }

    try {
      const result = await withTimeout(
        entry.session.callTool({ name: originalName, arguments: args }),
        CALL_TIMEOUT_MS,
        `tools/call ${originalName}`,
      );
      return this.successResult(call.id, result);
    } catch (e) {
      McpToolProvider.logger.warn(
        `MCP_CALL_FAILED ${entry.integrationId}/${originalName}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      return this.errorResult(
        call.id,
        'MCP_CALL_FAILED',
        `MCP server "${entry.integrationName}" failed to execute the tool`,
      );
    }
  }

  async cleanup(ctx: ProviderCleanupCtx): Promise<void> {
    const execId = this.executionKey(ctx.executionId);
    const sessions = this.sessionsByExecution.get(execId);
    if (!sessions) return;

    // Drop the map atomically so a concurrent buildTools sees a fresh slate
    // and we don't double-close on idempotent cleanup.
    this.sessionsByExecution.delete(execId);

    await Promise.allSettled(
      [...sessions.values()].map((entry) =>
        entry.session.close().catch((e: unknown) => {
          McpToolProvider.logger.warn(
            `Failed to close MCP session for ${entry.integrationId}: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        }),
      ),
    );
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  private executionKey(id: string | undefined): string {
    // When the handler can't supply an executionId we fall back to a single
    // shared bucket; this means cleanup is global but it's the safe default
    // since unbucketed sessions would otherwise leak forever.
    return id ?? '__default__';
  }

  private getOrCreateSessionMap(execId: string): Map<string, ServerEntry> {
    let m = this.sessionsByExecution.get(execId);
    if (!m) {
      m = new Map();
      this.sessionsByExecution.set(execId, m);
    }
    return m;
  }

  private parseRefs(config: Record<string, unknown>): McpServerRefConfig[] {
    const raw = config.mcpServers;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (r): r is McpServerRefConfig =>
        !!r &&
        typeof (r as { integrationId?: unknown }).integrationId === 'string',
    );
  }

  /**
   * Connect (or reuse) a session for one server and return its ToolDef list.
   * Throws on connection / list-tools failure — the caller wraps each call in
   * `Promise.allSettled` so one server's error does not poison the others.
   */
  private async materializeServer(
    ref: McpServerRefConfig,
    ctx: ProviderBuildCtx,
    execId: string,
    sessions: Map<string, ServerEntry>,
  ): Promise<ToolDef[]> {
    let entry = sessions.get(ref.integrationId);
    if (!entry) {
      entry = await this.openServer(ref, ctx);
      sessions.set(ref.integrationId, entry);
    }
    return this.buildToolDefsForEntry(ref, entry);
  }

  private async openServer(
    ref: McpServerRefConfig,
    ctx: ProviderBuildCtx,
  ): Promise<ServerEntry> {
    const integration = await this.integrationsService.getForExecution(
      ref.integrationId,
      ctx.workspaceId,
    );
    const i = integration as IntegrationLike & PublicIntegration;
    if (i.serviceType !== 'mcp') {
      throw new Error(
        `Integration ${ref.integrationId} is not service_type='mcp' (got ${i.serviceType})`,
      );
    }

    const params = this.toConnectParams(i);
    const session = await this.mcpClient.connect(params);
    const list = await withTimeout(
      session.listTools(),
      LIST_TIMEOUT_MS,
      `tools/list ${i.name}`,
    );

    // Pre-build the sanitized → original map so execute() doesn't re-sanitize
    // each call. Allowlist filtering happens here too — disallowed tools are
    // never even surfaced to the LLM.
    const allowlist = ref.enabledTools;
    const allowAll = !allowlist || allowlist.includes('*');
    const allowSet = new Set(allowlist ?? []);
    const toolNameMap = new Map<string, string>();
    const toolDefs = new Map<
      string,
      { name: string; description?: string; inputSchema: unknown }
    >();
    for (const t of list.tools) {
      if (!allowAll && !allowSet.has(t.name)) continue;
      toolNameMap.set(sanitizeToolName(t.name), t.name);
      toolDefs.set(t.name, {
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      });
    }

    return {
      integrationId: i.id,
      integrationName: i.name,
      toolNameMap,
      toolDefs,
      session,
      capabilities: {
        resources: session.capabilities.resources !== undefined,
        prompts: session.capabilities.prompts !== undefined,
      },
    };
  }

  /**
   * Compose the LLM-visible ToolDef[] for a server: regular tools first, then
   * any meta tools that the server's capabilities + the user's
   * include{Resources,Prompts} flags allow.
   */
  private buildToolDefsForEntry(
    ref: McpServerRefConfig,
    entry: ServerEntry,
  ): ToolDef[] {
    const overrides = new Map(
      (ref.toolOverrides ?? []).map((o) => [o.toolName, o]),
    );

    const out: ToolDef[] = [];

    for (const [, original] of entry.toolNameMap) {
      const def = entry.toolDefs.get(original);
      if (!def) continue;
      const ovr = overrides.get(original);
      const baseDescription =
        ovr?.description ?? def.description ?? `MCP tool ${original}`;
      out.push({
        name: mcpToolName(entry.integrationId, original),
        description: `${baseDescription}\n\n(via MCP server: ${entry.integrationName})`,
        parameters: (def.inputSchema as Record<string, unknown>) ?? {
          type: 'object',
          properties: {},
        },
      });
    }

    if (entry.capabilities.resources && ref.includeResources !== false) {
      out.push({
        name: mcpToolName(entry.integrationId, META_LIST_RESOURCES),
        description: `List available resources on MCP server "${entry.integrationName}".`,
        parameters: {
          type: 'object',
          properties: {
            cursor: {
              type: 'string',
              description: 'Pagination cursor (optional)',
            },
          },
        },
      });
      out.push({
        name: mcpToolName(entry.integrationId, META_READ_RESOURCE),
        description: `Read a resource by URI from MCP server "${entry.integrationName}".`,
        parameters: {
          type: 'object',
          properties: {
            uri: { type: 'string', description: 'Resource URI' },
          },
          required: ['uri'],
        },
      });
    }

    if (entry.capabilities.prompts && ref.includePrompts !== false) {
      out.push({
        name: mcpToolName(entry.integrationId, META_LIST_PROMPTS),
        description: `List available prompt templates on MCP server "${entry.integrationName}".`,
        parameters: {
          type: 'object',
          properties: {
            cursor: { type: 'string' },
          },
        },
      });
      out.push({
        name: mcpToolName(entry.integrationId, META_GET_PROMPT),
        description: `Render a prompt template from MCP server "${entry.integrationName}". Returns a list of messages to incorporate into your reasoning.`,
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            arguments: {
              type: 'object',
              description: 'Prompt arguments (server-defined)',
            },
          },
          required: ['name'],
        },
      });
    }

    return out;
  }

  private toConnectParams(i: IntegrationLike): McpConnectParams {
    const url = i.credentials.url as string;
    const defaultHeaders = i.credentials.default_headers as
      | Record<string, string>
      | undefined;
    if (i.authType === 'bearer_token') {
      return {
        authType: 'bearer_token',
        url,
        token: i.credentials.token as string,
        defaultHeaders,
      };
    }
    if (i.authType === 'api_key') {
      return {
        authType: 'api_key',
        url,
        headerName: i.credentials.header_name as string,
        value: i.credentials.value as string,
        defaultHeaders,
      };
    }
    return { authType: 'none', url, defaultHeaders };
  }

  private routeMetaTool(
    sanitizedName: string,
  ):
    | typeof META_LIST_RESOURCES
    | typeof META_READ_RESOURCE
    | typeof META_LIST_PROMPTS
    | typeof META_GET_PROMPT
    | null {
    if (sanitizedName === META_LIST_RESOURCES) return META_LIST_RESOURCES;
    if (sanitizedName === META_READ_RESOURCE) return META_READ_RESOURCE;
    if (sanitizedName === META_LIST_PROMPTS) return META_LIST_PROMPTS;
    if (sanitizedName === META_GET_PROMPT) return META_GET_PROMPT;
    return null;
  }

  private async executeMeta(
    toolCallId: string,
    meta:
      | typeof META_LIST_RESOURCES
      | typeof META_READ_RESOURCE
      | typeof META_LIST_PROMPTS
      | typeof META_GET_PROMPT,
    args: Record<string, unknown>,
    entry: ServerEntry,
  ): Promise<AgentToolResult> {
    try {
      if (meta === META_LIST_RESOURCES) {
        const r = await withTimeout(
          entry.session.listResources({
            cursor: typeof args.cursor === 'string' ? args.cursor : undefined,
          }),
          LIST_TIMEOUT_MS,
          'resources/list',
        );
        return this.successResult(toolCallId, r);
      }
      if (meta === META_READ_RESOURCE) {
        if (typeof args.uri !== 'string' || !args.uri) {
          return this.errorResult(
            toolCallId,
            'INVALID_TOOL_ARGUMENTS',
            'read_resource requires a string `uri` argument',
          );
        }
        const r = await withTimeout(
          entry.session.readResource({ uri: args.uri }),
          CALL_TIMEOUT_MS,
          'resources/read',
        );
        return this.successResult(toolCallId, r);
      }
      if (meta === META_LIST_PROMPTS) {
        const r = await withTimeout(
          entry.session.listPrompts({
            cursor: typeof args.cursor === 'string' ? args.cursor : undefined,
          }),
          LIST_TIMEOUT_MS,
          'prompts/list',
        );
        return this.successResult(toolCallId, r);
      }
      // META_GET_PROMPT
      if (typeof args.name !== 'string' || !args.name) {
        return this.errorResult(
          toolCallId,
          'INVALID_TOOL_ARGUMENTS',
          'get_prompt requires a string `name` argument',
        );
      }
      const promptArgs = this.coerceStringArgs(args.arguments);
      const r = await withTimeout(
        entry.session.getPrompt({ name: args.name, arguments: promptArgs }),
        CALL_TIMEOUT_MS,
        'prompts/get',
      );
      return this.successResult(toolCallId, r);
    } catch (e) {
      McpToolProvider.logger.warn(
        `MCP meta tool failed (${meta}): ${e instanceof Error ? e.message : String(e)}`,
      );
      return this.errorResult(
        toolCallId,
        'MCP_CALL_FAILED',
        `MCP server "${entry.integrationName}" failed to execute the meta tool`,
      );
    }
  }

  private coerceStringArgs(raw: unknown): Record<string, string> | undefined {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      out[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }
    return out;
  }

  private successResult(toolCallId: string, payload: unknown): AgentToolResult {
    const json = JSON.stringify(payload ?? null);
    if (json.length <= MAX_RESPONSE_BYTES) {
      return { toolCallId, content: json };
    }
    // Truncated payload — keep the JSON parseable so the LLM gets a structured
    // hint that the response was clipped.
    const truncated = JSON.stringify({
      error: 'MCP_RESPONSE_TOO_LARGE',
      originalSizeBytes: json.length,
      previewBase64: Buffer.from(json.slice(0, MAX_RESPONSE_BYTES)).toString(
        'base64',
      ),
    });
    return { toolCallId, content: truncated };
  }

  private errorResult(
    toolCallId: string,
    code: string,
    message: string,
  ): AgentToolResult {
    return {
      toolCallId,
      content: JSON.stringify({ error: code, message }),
    };
  }

  private findEntryBySid(
    sessions: Map<string, ServerEntry>,
    sid: string,
  ): ServerEntry | undefined {
    for (const entry of sessions.values()) {
      if (shortIntegrationId(entry.integrationId) === sid) return entry;
    }
    return undefined;
  }
}
