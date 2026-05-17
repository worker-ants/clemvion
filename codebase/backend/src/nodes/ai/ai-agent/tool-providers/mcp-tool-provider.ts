import { Logger } from '@nestjs/common';
import { withTimeout } from '../../../../common/utils/with-timeout';
import {
  ToolCall,
  ToolDef,
} from '../../../../modules/llm/interfaces/llm-client.interface';
import { IntegrationsService } from '../../../../modules/integrations/integrations.service';
import {
  isInsecureUrlAllowed,
  McpClientService,
  McpConnectParams,
  McpSession,
} from '../../../../modules/mcp/mcp-client.service';
import {
  MCP_ERROR_CODES,
  sanitizeMcpErrorMessage,
} from '../../../../modules/mcp/mcp-error-codes';
import type { Integration } from '../../../../modules/integrations/entities/integration.entity';
import {
  AgentToolProvider,
  AgentToolResult,
  ProviderBuildCtx,
  ProviderCleanupCtx,
  ProviderExecCtx,
} from './agent-tool-provider.interface';

const SID_LENGTHS = [8, 12, 32] as const;
const SEP = '__';
const PREFIX = 'mcp_';
const META_LIST_RESOURCES = 'list_resources';
const META_READ_RESOURCE = 'read_resource';
const META_LIST_PROMPTS = 'list_prompts';
const META_GET_PROMPT = 'get_prompt';

/** Cap for user-controlled identifier strings spliced into descriptions. */
const MAX_DESCRIPTION_LEN = 500;
const MAX_INTEGRATION_NAME_LEN = 80;

/** Allowed authType strings — anything outside this set must be rejected. */
const SUPPORTED_AUTH_TYPES = new Set(['bearer_token', 'api_key', 'none']);

/**
 * Cap on the JSON-serialized tool_result content delivered to the LLM. Spec
 * §8.1 sets 100 KB as the soft limit; configurable via env so an operator can
 * tune for very large MCP servers without redeploying.
 */
const MAX_RESPONSE_BYTES =
  Number(process.env.MCP_MAX_RESPONSE_BYTES) || 102_400;

const CALL_TIMEOUT_MS = Number(process.env.MCP_CALL_TIMEOUT_MS) || 30_000;
const LIST_TIMEOUT_MS = Number(process.env.MCP_LIST_TIMEOUT_MS) || 10_000;
const CONNECT_TIMEOUT_MS = Number(process.env.MCP_CONNECT_TIMEOUT_MS) || 10_000;

/** McpServerRef as declared in `aiAgentNodeConfigSchema.mcpServers`. */
interface McpServerRefConfig {
  integrationId: string;
  enabledTools?: string[];
  includeResources?: boolean;
  includePrompts?: boolean;
  toolOverrides?: Array<{ toolName: string; description?: string }>;
}

/**
 * Per-server runtime state inside a single node execution. `tools` lists the
 * server's `tools/list` response (filtered by allowlist) so `execute()` can
 * map a sanitized tool name back to the original MCP tool name without
 * re-listing on every call.
 *
 * `sid` is the LLM-visible short identifier — computed at buildTools time
 * to be unique within the execution (collision-free across attached servers).
 */
interface ServerEntry {
  integrationId: string;
  integrationName: string;
  sid: string;
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

/**
 * Strip newlines & control characters from a user-controlled string spliced
 * into LLM tool descriptions. CRLF in a description has no functional use
 * for the LLM and removing it kills a class of prompt-injection vectors
 * (review WARNING #3).
 */
function sanitizeDescriptionFragment(s: string, max: number): string {
  return s.replace(/[\r\n\t]/g, ' ').slice(0, max);
}

function shortIdAt(integrationId: string, length: number): string {
  return sanitizeToolName(integrationId.replace(/-/g, '').slice(0, length));
}

/**
 * Detect "the MCP server rejected our credentials" from an SDK error. The
 * `@modelcontextprotocol/sdk` is not yet consistent about exposing HTTP
 * status codes on its error objects, so we check structured fields first
 * (`code`, `status`, `statusCode`) and fall back to a message regex covering
 * the wording most providers leak.
 */
function isAuthFailure(err: unknown, message: string): boolean {
  if (err && typeof err === 'object') {
    const anyErr = err as {
      code?: unknown;
      status?: unknown;
      statusCode?: unknown;
    };
    const status = anyErr.status ?? anyErr.statusCode;
    if (status === 401 || status === 403) return true;
    if (
      typeof anyErr.code === 'string' &&
      /unauthori[sz]ed|forbidden/i.test(anyErr.code)
    ) {
      return true;
    }
  }
  return /\b40[13]\b|unauthori[sz]ed|forbidden/i.test(message);
}

/**
 * Build the LLM-visible tool name for an `(integrationId, toolName)` pair.
 * Exported so other code (tests, future debug UI) can reproduce the naming
 * without re-implementing the rule.
 */
export function mcpToolName(integrationId: string, toolName: string): string {
  return `${PREFIX}${shortIdAt(integrationId, SID_LENGTHS[0])}${SEP}${sanitizeToolName(toolName)}`;
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
 * Validate the URL string at the provider boundary. Defense in depth on top
 * of the same check inside `McpClientService.connect()` — this catches typos
 * before we even call into the SDK.
 *
 * Honors the same `MCP_ALLOW_INSECURE_URL` escape hatch as the client layer
 * so a local-dev operator does not see a different rule on either side of
 * the call.
 */
function assertHttpsUrl(url: unknown): asserts url is string {
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('MCP integration is missing a server URL');
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`MCP integration URL is malformed: ${url}`);
  }
  const allowedProtocols = isInsecureUrlAllowed()
    ? ['https:', 'http:']
    : ['https:'];
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new Error(
      `MCP integration URL must use ${allowedProtocols.join('/')} (got ${url})`,
    );
  }
}

/**
 * Compute a collision-free short identifier (sid) for every attached server,
 * preferring the shortest length that keeps every value distinct. Falls
 * through to the full sanitized id if even that collides — at which point
 * we have two integrations with literally the same id, an impossible state
 * given the DB unique constraint.
 */
function assignSids(integrationIds: string[]): Map<string, string> {
  for (const len of SID_LENGTHS) {
    const candidates = new Map<string, string>();
    const reverse = new Map<string, string>();
    let collision = false;
    for (const id of integrationIds) {
      const sid = shortIdAt(id, len);
      if (reverse.has(sid)) {
        collision = true;
        break;
      }
      reverse.set(sid, id);
      candidates.set(id, sid);
    }
    if (!collision) return candidates;
  }
  // SID_LENGTHS already exhausts the full id length — should never reach.
  /* istanbul ignore next */
  throw new Error(
    'Unable to assign unique MCP sids — duplicate integrationIds in mcpServers config',
  );
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

  /**
   * In-flight openServer promises keyed by `${executionId}:${integrationId}`.
   * Prevents the TOCTOU race where two concurrent buildTools calls (e.g.
   * single-turn + a parallel watchdog) double-open a session and leak the
   * loser. Once openServer resolves, the entry is moved to
   * sessionsByExecution and the inflight slot is cleared.
   */
  private readonly inflight = new Map<string, Promise<ServerEntry>>();

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
    if (!ctx.executionId) {
      // Without an executionId we have no scope key to tie sessions to a
      // node run, which would let them leak across executions. Emit one
      // diagnostic and short-circuit rather than mis-attribute resources.
      McpToolProvider.logger.warn(
        'McpToolProvider.buildTools called without executionId — skipping MCP setup',
      );
      return [];
    }

    const execId = ctx.executionId;
    const sessions = this.getOrCreateSessionMap(execId);
    const sidMap = assignSids(refs.map((r) => r.integrationId));

    const settled = await Promise.allSettled(
      refs.map((ref) =>
        this.materializeServer(
          ref,
          ctx,
          execId,
          sessions,
          sidMap.get(ref.integrationId)!,
        ),
      ),
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

    if (!ctx.executionId) {
      return this.errorResult(
        call.id,
        'MCP_UNKNOWN_TOOL',
        'No executionId on provider context — buildTools was likely skipped',
      );
    }

    const sessions = this.sessionsByExecution.get(ctx.executionId);
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

    const callStartedAt = Date.now();
    try {
      const result = await withTimeout(
        entry.session.callTool({ name: originalName, arguments: args }),
        CALL_TIMEOUT_MS,
        `tools/call ${originalName}`,
      );
      // Honor the MCP spec's `isError` flag so the LLM doesn't mistake an
      // application-level failure for a successful call (review WARNING #17).
      if (
        result &&
        typeof result === 'object' &&
        (result as { isError?: unknown }).isError === true
      ) {
        this.fireUsageLog(ctx, entry, callStartedAt, 'failed', {
          code: MCP_ERROR_CODES.TOOL_ERROR,
          message: 'MCP tool reported an error',
        });
        return this.errorResult(
          call.id,
          MCP_ERROR_CODES.TOOL_ERROR,
          'MCP tool reported an error',
          { content: (result as { content?: unknown }).content },
        );
      }
      this.fireUsageLog(ctx, entry, callStartedAt, 'success');
      return this.successResult(call.id, result);
    } catch (e) {
      const message = sanitizeMcpErrorMessage(e);
      McpToolProvider.logger.warn(
        `${MCP_ERROR_CODES.CALL_FAILED} ${entry.integrationId}/${originalName}: ${message}`,
      );
      // Auth failures (401/403 from the MCP server) trip the integration
      // into an `error` state so the UI can surface "needs reauthorization"
      // instead of a silent retry-storm. SDK error structure isn't
      // standardized — prefer a structured `code`/`status` field if the
      // SDK exposes one, fall back to the original message regex.
      const code = isAuthFailure(e, message)
        ? MCP_ERROR_CODES.AUTH_FAILED
        : MCP_ERROR_CODES.CALL_FAILED;
      this.fireUsageLog(ctx, entry, callStartedAt, 'failed', {
        code,
        message,
      });
      return this.errorResult(
        call.id,
        code,
        `MCP server "${entry.integrationName}" failed to execute the tool`,
      );
    }
  }

  /**
   * Fire-and-forget IntegrationUsageLog write — execute() must not block on
   * the database hit (review Stage 5 W-3). Errors from logUsage cannot bubble
   * out (the integrations service swallows internally); we still attach a
   * `.catch` to silence node's unhandled-rejection warning if the contract
   * regresses. Skipped when the surrounding ExecutionContext didn't carry
   * the foreign keys; the engine guarantees them for real workflow runs.
   */
  private fireUsageLog(
    ctx: ProviderExecCtx,
    entry: ServerEntry,
    startedAt: number,
    status: 'success' | 'failed',
    error?: { code: string; message: string },
  ): void {
    if (!ctx.nodeExecutionId || !ctx.workflowId) return;
    void this.integrationsService
      .logUsage({
        integrationId: entry.integrationId,
        nodeExecutionId: ctx.nodeExecutionId,
        workflowId: ctx.workflowId,
        status,
        durationMs: Date.now() - startedAt,
        error: error ?? null,
      })
      .catch((e: unknown) => {
        McpToolProvider.logger.warn(
          `MCP usage logging failed: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      });
  }

  async cleanup(ctx: ProviderCleanupCtx): Promise<void> {
    if (!ctx.executionId) {
      // Without an executionId we cannot scope cleanup safely — refuse to
      // close anything rather than blast every open session.
      return;
    }
    const sessions = this.sessionsByExecution.get(ctx.executionId);
    if (!sessions) return;

    // Drop the map atomically so a concurrent buildTools sees a fresh slate
    // and we don't double-close on idempotent cleanup.
    this.sessionsByExecution.delete(ctx.executionId);

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
        typeof (r as { integrationId?: unknown }).integrationId === 'string' &&
        (r as { integrationId: string }).integrationId.length > 0,
    );
  }

  /**
   * Connect (or reuse) a session for one server and return its ToolDef list.
   * Throws on connection / list-tools failure — the caller wraps each call in
   * `Promise.allSettled` so one server's error does not poison the others.
   *
   * Concurrent builders on the same `(executionId, integrationId)` pair de-dup
   * via the {@link inflight} cache so we never open two sessions for one slot.
   */
  private async materializeServer(
    ref: McpServerRefConfig,
    ctx: ProviderBuildCtx,
    execId: string,
    sessions: Map<string, ServerEntry>,
    sid: string,
  ): Promise<ToolDef[]> {
    const existing = sessions.get(ref.integrationId);
    if (existing) return this.buildToolDefsForEntry(ref, existing);

    const inflightKey = `${execId}:${ref.integrationId}`;
    let pending = this.inflight.get(inflightKey);
    if (!pending) {
      pending = this.openServer(ref, ctx, sid).finally(() => {
        this.inflight.delete(inflightKey);
      });
      this.inflight.set(inflightKey, pending);
    }
    const entry = await pending;
    sessions.set(ref.integrationId, entry);
    return this.buildToolDefsForEntry(ref, entry);
  }

  private async openServer(
    ref: McpServerRefConfig,
    ctx: ProviderBuildCtx,
    sid: string,
  ): Promise<ServerEntry> {
    const integration = await this.integrationsService.getForExecution(
      ref.integrationId,
      ctx.workspaceId,
    );
    if (integration.serviceType !== 'mcp') {
      throw new Error(
        `Integration ${ref.integrationId} is not service_type='mcp' (got ${integration.serviceType})`,
      );
    }
    if (integration.status !== 'connected') {
      throw new Error(
        `Integration ${ref.integrationId} is not connected (status=${integration.status})`,
      );
    }

    const params = this.toConnectParams(integration);
    const session = await withTimeout(
      this.mcpClient.connect(params),
      CONNECT_TIMEOUT_MS,
      `connect ${integration.name}`,
    );

    // Once connected, *anything* that throws between here and the return must
    // close the session — otherwise the listTools timeout (review WARNING #6)
    // leaks an open SSE stream forever.
    try {
      const list = await withTimeout(
        session.listTools(),
        LIST_TIMEOUT_MS,
        `tools/list ${integration.name}`,
      );

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
        const sanitized = sanitizeToolName(t.name);
        if (toolNameMap.has(sanitized)) {
          // Two distinct upstream names sanitize to the same string — surface
          // a warning and keep the first occurrence (review WARNING #18).
          // The collision is improbable for typical MCP servers but worth
          // flagging for operators.
          McpToolProvider.logger.warn(
            `MCP server "${integration.name}": tool name collision after sanitize ` +
              `("${toolNameMap.get(sanitized)}" vs "${t.name}") — ignoring "${t.name}"`,
          );
          continue;
        }
        toolNameMap.set(sanitized, t.name);
        toolDefs.set(t.name, {
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        });
      }

      return {
        integrationId: integration.id,
        integrationName: integration.name,
        sid,
        toolNameMap,
        toolDefs,
        session,
        capabilities: {
          resources: session.capabilities.resources !== undefined,
          prompts: session.capabilities.prompts !== undefined,
        },
      };
    } catch (err) {
      // Best-effort — if close itself throws we still want the original error
      // to bubble up.
      session.close().catch(() => undefined);
      throw err;
    }
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
    const safeName = sanitizeDescriptionFragment(
      entry.integrationName,
      MAX_INTEGRATION_NAME_LEN,
    );

    const out: ToolDef[] = [];

    for (const [, original] of entry.toolNameMap) {
      const def = entry.toolDefs.get(original);
      if (!def) continue;
      const ovr = overrides.get(original);
      const baseDescription = sanitizeDescriptionFragment(
        ovr?.description ?? def.description ?? `MCP tool ${original}`,
        MAX_DESCRIPTION_LEN,
      );
      out.push({
        name: this.regularToolName(entry, original),
        description: `${baseDescription} (via MCP server: ${safeName})`,
        parameters: (def.inputSchema as Record<string, unknown>) ?? {
          type: 'object',
          properties: {},
        },
      });
    }

    if (entry.capabilities.resources && ref.includeResources !== false) {
      out.push({
        name: this.metaToolName(entry, META_LIST_RESOURCES),
        description: `List available resources on MCP server "${safeName}".`,
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
        name: this.metaToolName(entry, META_READ_RESOURCE),
        description: `Read a resource by URI from MCP server "${safeName}".`,
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
        name: this.metaToolName(entry, META_LIST_PROMPTS),
        description: `List available prompt templates on MCP server "${safeName}".`,
        parameters: {
          type: 'object',
          properties: {
            cursor: { type: 'string' },
          },
        },
      });
      out.push({
        name: this.metaToolName(entry, META_GET_PROMPT),
        description: `Render a prompt template from MCP server "${safeName}". Returns a list of messages to incorporate into your reasoning.`,
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

  private regularToolName(entry: ServerEntry, original: string): string {
    return `${PREFIX}${entry.sid}${SEP}${sanitizeToolName(original)}`;
  }

  private metaToolName(
    entry: ServerEntry,
    meta:
      | typeof META_LIST_RESOURCES
      | typeof META_READ_RESOURCE
      | typeof META_LIST_PROMPTS
      | typeof META_GET_PROMPT,
  ): string {
    return `${PREFIX}${entry.sid}${SEP}${meta}`;
  }

  /**
   * Map the validated `Integration.credentials` JSONB into the discriminated
   * union {@link McpConnectParams}. Validates URL + credential presence at
   * runtime — TypeScript's `as` casts are not load-bearing security here.
   *
   * Supported `authType` values: `bearer_token`, `api_key`, `none`. Anything
   * else is a hard error (review CRITICAL #2 — silently falling through to
   * `none` would let an unknown authType connect unauthenticated).
   */
  private toConnectParams(integration: Integration): McpConnectParams {
    const creds = integration.credentials;
    const url = creds.url;
    assertHttpsUrl(url);
    const defaultHeaders = creds.default_headers as
      | Record<string, string>
      | undefined;

    if (integration.authType === 'bearer_token') {
      const token = creds.token;
      if (typeof token !== 'string' || token.length === 0) {
        throw new Error(
          'MCP integration with auth_type=bearer_token is missing a token',
        );
      }
      return { authType: 'bearer_token', url, token, defaultHeaders };
    }
    if (integration.authType === 'api_key') {
      const headerName = creds.header_name;
      const value = creds.value;
      if (typeof headerName !== 'string' || headerName.length === 0) {
        throw new Error(
          'MCP integration with auth_type=api_key is missing header_name',
        );
      }
      if (typeof value !== 'string' || value.length === 0) {
        throw new Error(
          'MCP integration with auth_type=api_key is missing value',
        );
      }
      return { authType: 'api_key', url, headerName, value, defaultHeaders };
    }
    if (integration.authType === 'none') {
      return { authType: 'none', url, defaultHeaders };
    }
    if (!SUPPORTED_AUTH_TYPES.has(integration.authType)) {
      throw new Error(
        `MCP integration uses unsupported auth_type "${integration.authType}"`,
      );
    }
    /* istanbul ignore next — exhaustive by construction */
    throw new Error('unreachable');
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
    // Truncated payload — keep the JSON parseable and stream-friendly. We
    // serialize once (we already needed the byte length) and emit a sliced
    // base64 preview rather than re-allocating the full payload.
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
    extra?: Record<string, unknown>,
  ): AgentToolResult {
    return {
      toolCallId,
      content: JSON.stringify({ error: code, message, ...(extra ?? {}) }),
      status: 'error',
      error: `${code}: ${message}`,
    };
  }

  private findEntryBySid(
    sessions: Map<string, ServerEntry>,
    sid: string,
  ): ServerEntry | undefined {
    for (const entry of sessions.values()) {
      if (entry.sid === sid) return entry;
    }
    return undefined;
  }
}
