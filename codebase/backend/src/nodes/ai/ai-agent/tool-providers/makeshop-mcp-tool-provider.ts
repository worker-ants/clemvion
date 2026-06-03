import { Logger } from '@nestjs/common';
import {
  ToolCall,
  ToolDef,
} from '../../../../modules/llm/interfaces/llm-client.interface.js';
import {
  AgentToolProvider,
  AgentToolResult,
  ProviderBuildCtx,
  ProviderCleanupCtx,
  ProviderExecCtx,
} from './agent-tool-provider.interface.js';
import { McpSkipReason, pushMcpServerSummary } from './mcp-diagnostics.js';
import { IntegrationsService } from '../../../../modules/integrations/integrations.service.js';
import { parseMcpToolName } from './mcp-tool-provider.js';
import {
  MakeshopApiClient,
  MakeshopAuthFailedError,
  MakeshopRateLimitedError,
  MakeshopTransportFailedError,
} from '../../../integration/makeshop/makeshop-api.client.js';
import {
  MakeshopFieldConstraint,
  MakeshopOperationMetadata,
  MakeshopResource,
  listAllMakeshopOperations,
  validateMakeshopConstraints,
} from '../../../integration/makeshop/metadata/index.js';
import { Integration } from '../../../../modules/integrations/entities/integration.entity.js';

/**
 * MakeShop MCP Tool Provider — surfaces MakeShop Shop API operations to the
 * AI Agent as MCP-style tools (`mcp_<sid>__<operation_id>`) via the
 * in-process Internal Bridge transport. spec/5-system/11-mcp-client.md §2.3
 * + spec/4-nodes/4-integration/5-makeshop.md §8.
 *
 * Mirrors {@link Cafe24McpToolProvider} with MakeShop-specific divergences
 * (spec §8 references cafe24 §8 as "동형"):
 *  - **operationId sanitize**: MakeShop operationIds mix hyphens and
 *    underscores (`get-product`, `get-cart_free_config`). MCP §5.2 sanitizes
 *    non-alphanumeric/underscore chars, so the hyphen becomes `_`
 *    (`get-product` → tool token `get_product`). The BARE operationId is kept
 *    internally (allowlist + dispatch); the sanitize happens at tool-name
 *    emission. spec §8.1.
 *  - **NO restricted-approval ⚠ labels** — MakeShop has no partner-approval
 *    tier (spec §8.2 / §9.5). No `restrictedApproval` passthrough.
 *  - **NO timezone suffix** — MakeShop timezone is unconfirmed (spec §4.1); the
 *    makeshop metadata index declares no KST suffix const, unlike cafe24's
 *    CAFE24_TIMEZONE_SUFFIX.
 *  - **NO granted-scope pre-filter** — the makeshop node handler does not
 *    pre-filter operations by granted scopes; we mirror that (all operations
 *    are exposed for a connected integration).
 *
 * Coexists with the external HTTP {@link McpToolProvider} (which handles
 * `service_type='mcp'`): registered BEFORE it so its sid-aware matches() can
 * claim makeshop-owned sids before McpToolProvider's broad `mcp_*` matcher.
 */
export class MakeshopMcpToolProvider implements AgentToolProvider {
  readonly key = 'makeshop-mcp';
  private readonly logger = new Logger(MakeshopMcpToolProvider.name);

  // Reference-counted set of sids belonging to makeshop Integrations
  // registered via buildTools. Counted (not a plain Set) so two concurrent
  // AI Agent executions binding the same Integration both keep the sid alive.
  private readonly ownedSidCounts = new Map<string, number>();

  // executionId -> per-execution lookup tables (integrations + operations).
  // sidToOpMap: sid -> sanitized operation token -> { resource, operation }.
  // Keyed by the SANITIZED token (not the bare operationId) because
  // parseMcpToolName returns the sanitized token from the wire tool name.
  private readonly executionState = new Map<
    string,
    {
      sidToIntegration: Map<string, Integration>;
      sidToOpMap: Map<
        string,
        Map<
          string,
          { resource: MakeshopResource; operation: MakeshopOperationMetadata }
        >
      >;
    }
  >();

  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly makeshopApiClient: MakeshopApiClient,
  ) {}

  matches(toolName: string): boolean {
    if (!toolName.startsWith('mcp_')) return false;
    const sid = this.extractSid(toolName);
    return sid !== null && (this.ownedSidCounts.get(sid) ?? 0) > 0;
  }

  private retainSid(sid: string): void {
    this.ownedSidCounts.set(sid, (this.ownedSidCounts.get(sid) ?? 0) + 1);
  }

  private releaseSid(sid: string): void {
    const cur = this.ownedSidCounts.get(sid) ?? 0;
    if (cur <= 1) {
      this.ownedSidCounts.delete(sid);
    } else {
      this.ownedSidCounts.set(sid, cur - 1);
    }
  }

  async buildTools(ctx: ProviderBuildCtx): Promise<ToolDef[]> {
    if (!ctx.executionId) {
      this.logger.warn(
        'MakeshopMcpToolProvider.buildTools called without executionId — skipping',
      );
      return [];
    }
    const mcpServers = this.extractMcpServers(ctx.config);
    if (mcpServers.length === 0) return [];

    const tools: ToolDef[] = [];
    const state = this.ensureState(ctx.executionId);

    for (const ref of mcpServers) {
      if (!ref.integrationId) continue;

      let integration: Integration;
      try {
        integration = await this.integrationsService.getForExecution(
          ref.integrationId,
          ctx.workspaceId,
        );
      } catch (err) {
        this.logger.warn(
          `MakeShop integration ${ref.integrationId} lookup failed: ${this.errMsg(err)}`,
        );
        pushMcpServerSummary(ctx.mcpDiagnostics, {
          integrationId: ref.integrationId,
          serviceType: 'makeshop',
          status: 'skipped',
          skipReason: 'lookup_failed',
          toolCount: 0,
        });
        continue;
      }

      // Only react to makeshop — other service_types belong to McpToolProvider
      // (external HTTP) or Cafe24McpToolProvider. Silent skip — the owning
      // provider pushes its own summary.
      if (integration.serviceType !== 'makeshop') continue;

      // spec §8.6 — `expired` 자가 회복. refresh_token 보유 + 큐 경유 refresh
      // 1회 시도 후 worker 가 status='connected' 로 전이시키면 fresh row 로 진행.
      if (integration.status === 'expired') {
        const recovered = await this.tryRecoverExpired(integration);
        if (recovered.kind === 'recovered') {
          integration = recovered.integration;
        } else {
          this.logger.warn(
            `MakeShop integration ${integration.id} expired (reason=${recovered.skipReason}) — skipped`,
          );
          pushMcpServerSummary(ctx.mcpDiagnostics, {
            integrationId: integration.id,
            serviceType: 'makeshop',
            status: 'skipped',
            skipReason: recovered.skipReason,
            toolCount: 0,
          });
          continue;
        }
      } else if (integration.status === 'pending_install') {
        this.logger.warn(
          `MakeShop integration ${integration.id} pending_install — skipped`,
        );
        pushMcpServerSummary(ctx.mcpDiagnostics, {
          integrationId: integration.id,
          serviceType: 'makeshop',
          status: 'skipped',
          skipReason: 'pending_install',
          toolCount: 0,
        });
        continue;
      } else if (integration.status !== 'connected') {
        // 'error' (auth_failed / network) — 외부 명시 reauth 가 정식 회복 경로.
        this.logger.warn(
          `MakeShop integration ${integration.id} not connected (status=${integration.status}) — skipped`,
        );
        pushMcpServerSummary(ctx.mcpDiagnostics, {
          integrationId: integration.id,
          serviceType: 'makeshop',
          status: 'skipped',
          skipReason: 'error',
          toolCount: 0,
        });
        continue;
      }

      const sid = sanitizeSid(integration.id);
      const enabled = this.applyAllowlist(ref.enabledTools);

      const opMap = new Map<
        string,
        { resource: MakeshopResource; operation: MakeshopOperationMetadata }
      >();
      for (const { resource, operation } of listAllMakeshopOperations()) {
        // allowlist matches the BARE operationId (spec §8.3).
        if (!enabled(operation.id)) continue;
        const token = sanitizeOperationId(operation.id);
        // Defensive runtime guard for sanitize collisions within a sid. The
        // metadata.spec test already enforces resource-local uniqueness
        // (spec §8.1), but two distinct bare ids that sanitize identically
        // would otherwise silently overwrite the opMap entry — keep the first
        // and skip the collider so dispatch stays deterministic.
        if (opMap.has(token)) {
          this.logger.warn(
            `MakeShop integration ${integration.id}: operationId sanitize collision ("${opMap.get(token)!.operation.id}" vs "${operation.id}" → "${token}") — keeping first, skipping "${operation.id}"`,
          );
          continue;
        }
        opMap.set(token, { resource, operation });
        tools.push({
          name: `mcp_${sid}__${token}`,
          description: buildToolDescription(operation, integration.name),
          parameters: this.buildJsonSchema(operation),
        });
      }

      // One retain per (executionId, sid) pair — buildTools may run multiple
      // times per executionId (multi-turn resume); each cleanup releases once.
      const newForThisExecution = !state.sidToIntegration.has(sid);
      state.sidToIntegration.set(sid, integration);
      state.sidToOpMap.set(sid, opMap);
      if (newForThisExecution) this.retainSid(sid);

      pushMcpServerSummary(ctx.mcpDiagnostics, {
        integrationId: integration.id,
        serviceType: 'makeshop',
        status: 'connected',
        toolCount: opMap.size,
      });
    }

    return tools;
  }

  /**
   * spec §8.6 — `status='expired'` 인 makeshop 통합의 buildTools 자가 회복.
   *
   * **분기**:
   * - `status_reason === 'install_timeout'` → refresh 불가 (install_token NULL).
   *   `skipReason='expired_install_timeout'`.
   * - `credentials.refresh_token` 누락 → refresh 불가, reauth 필요.
   *   `skipReason='expired_no_refresh_token'`.
   * - 그 외 → `MakeshopApiClient.refreshTokenViaQueue(_, 'background')` 1회 시도.
   *   `makeshop-token-refresh` 큐의 `jobId = integrationId` dedup 으로 클러스터
   *   전체 직렬화. 성공 시 worker 가 status='connected' 로 전이시키고 fresh row
   *   를 재조회해 반환. 실패 (`MakeshopAuthFailedError`) 시 worker 가 이미
   *   `error(auth_failed)` 전이를 책임지므로 `skipReason='expired_refresh_failed'`.
   *
   * `refreshTokenViaQueue` 직접 호출 (ensureFreshToken 우회) — BullMQ jobId dedup
   * 로 cross-pod / cross-turn 동시 refresh 가 직렬화돼 thundering herd 가 없다.
   */
  private async tryRecoverExpired(
    integration: Integration,
  ): Promise<
    | { kind: 'recovered'; integration: Integration }
    | { kind: 'skipped'; skipReason: McpSkipReason }
  > {
    if (integration.statusReason === 'install_timeout') {
      return { kind: 'skipped', skipReason: 'expired_install_timeout' };
    }
    const creds = integration.credentials as
      | Record<string, unknown>
      | null
      | undefined;
    const rt = creds?.refresh_token;
    if (typeof rt !== 'string' || rt.length === 0) {
      return { kind: 'skipped', skipReason: 'expired_no_refresh_token' };
    }
    try {
      await this.makeshopApiClient.refreshTokenViaQueue(
        integration,
        'background',
      );
    } catch (err) {
      if (err instanceof MakeshopAuthFailedError) {
        return { kind: 'skipped', skipReason: 'expired_refresh_failed' };
      }
      // Transport / Redis / 기타 (MakeshopAuthFailedError 외) — 보수적으로 skip
      // + 같은 reason (사용자 입장에선 토큰 갱신 실패는 동일). 다음 AI Agent 노드
      // 실행이 새 buildTools 를 발사할 때 자연 재시도된다.
      this.logger.warn(
        `MakeShop integration ${integration.id} refresh attempt failed (non-auth): ${this.errMsg(err)}`,
      );
      return { kind: 'skipped', skipReason: 'expired_refresh_failed' };
    }
    // refresh 성공 — fresh row 재조회. worker 가 DB 갱신을 마쳤으므로 다음
    // SELECT 가 새 access_token / status='connected' 을 본다.
    let fresh: Integration;
    try {
      fresh = await this.integrationsService.getForExecution(
        integration.id,
        integration.workspaceId,
      );
    } catch (err) {
      this.logger.warn(
        `MakeShop integration ${integration.id} re-read after refresh failed: ${this.errMsg(err)}`,
      );
      return { kind: 'skipped', skipReason: 'lookup_failed' };
    }
    if (fresh.status !== 'connected') {
      // worker 가 refresh 를 끝냈는데도 status 가 connected 아니면 회복 실패 —
      // worker 의 status 전이 결과 (예: error(auth_failed)) 를 그대로 reflect.
      return { kind: 'skipped', skipReason: 'expired_refresh_failed' };
    }
    return { kind: 'recovered', integration: fresh };
  }

  /**
   * Execute a MakeShop MCP tool call via the Internal Bridge transport.
   * Logs api.label/method/path on every logUsage call when ctx carries
   * nodeExecutionId + workflowId (INT-US-05; spec §8.5). The catalog key
   * format `makeshop.<resource>.<operation>` matches the node handler.
   */
  async execute(
    call: ToolCall,
    ctx: ProviderExecCtx,
  ): Promise<AgentToolResult> {
    const sid = this.extractSid(call.name);
    const token = this.extractOperationToken(call.name);
    if (!sid || !token) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: { code: 'MAKESHOP_MCP_TOOL_NAME_INVALID', name: call.name },
        }),
        status: 'error',
        error: `Invalid tool name: ${call.name}`,
      };
    }

    const state = ctx.executionId
      ? this.executionState.get(ctx.executionId)
      : undefined;
    if (!state) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: {
            code: 'MAKESHOP_MCP_NO_SESSION',
            message: 'buildTools was not called for this execution',
          },
        }),
        status: 'error',
        error: 'No active makeshop MCP session',
      };
    }
    const integration = state.sidToIntegration.get(sid);
    const opMap = state.sidToOpMap.get(sid);
    if (!integration || !opMap) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: { code: 'MAKESHOP_MCP_INTEGRATION_UNKNOWN', sid },
        }),
        status: 'error',
        error: `Unknown sid ${sid}`,
      };
    }
    const opEntry = opMap.get(token);
    if (!opEntry) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: {
            code: 'MAKESHOP_UNKNOWN_OPERATION',
            operation: token,
          },
        }),
        status: 'error',
        error: `Unknown makeshop operation ${token}`,
      };
    }
    const { resource, operation } = opEntry;
    // INT-US-05 — 활동 로그에 동반할 API 식별 정보. catalog key 는 노드
    // 핸들러와 동일 형식 (`makeshop.<resource>.<operation>`, bare operationId).
    // SoT: spec §8.5 + spec/5-system/11-mcp-client.md §8.3 (Internal Bridge).
    const apiInfo = {
      label: `makeshop.${resource}.${operation.id}`,
      method: operation.method,
      path: operation.path,
    };

    let args: Record<string, unknown> = {};
    try {
      args = call.arguments
        ? (JSON.parse(call.arguments) as Record<string, unknown>)
        : {};
    } catch {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: { code: 'MAKESHOP_MCP_TOOL_ARGS_INVALID' },
        }),
        status: 'error',
        error: 'Tool arguments are not valid JSON',
      };
    }

    // Required field check.
    const missing = operation.requiredFields.filter(
      (k) => args[k] === undefined || args[k] === null || args[k] === '',
    );
    if (missing.length > 0) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: {
            code: 'MAKESHOP_MISSING_FIELDS',
            missing,
          },
        }),
        status: 'error',
        error: `Missing required fields: ${missing.join(', ')}`,
      };
    }

    // Conditional constraints check (spec §2 "constraints 의 의미"). Reuses
    // MAKESHOP_MISSING_FIELDS so client/UI does not need a new code; the
    // human-readable message identifies which kind / fields were violated.
    const constraintViolation = validateMakeshopConstraints(operation, args);
    if (constraintViolation) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: {
            code: 'MAKESHOP_MISSING_FIELDS',
            message: constraintViolation,
          },
        }),
        status: 'error',
        error: constraintViolation,
      };
    }

    // Split args into path/query/body per metadata (mirror of the node
    // handler's buildRequestParts).
    let path = operation.path;
    const query: Record<string, unknown> = {};
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(args)) {
      if (v === undefined || v === null) continue;
      const spec = operation.fields[k];
      if (!spec) continue;
      if (spec.location === 'path') {
        path = path.replace(
          new RegExp(`\\{${k}\\}`, 'g'),
          encodeURIComponent(scalarToString(v)),
        );
      } else if (spec.location === 'query') {
        query[k] = v;
      } else {
        body[k] = v;
      }
    }

    // Path placeholder hard-fail — a leftover `{...}` means a required path
    // field was not supplied or metadata location='path' is wrong.
    const unresolved = path.match(/\{[^}]+\}/g);
    if (unresolved && unresolved.length > 0) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: {
            code: 'MAKESHOP_MISSING_FIELDS',
            message: `unresolved path placeholder(s): ${unresolved.join(', ')}`,
          },
        }),
        status: 'error',
        error: `Unresolved path placeholder(s): ${unresolved.join(', ')}`,
      };
    }

    const startedAt = Date.now();
    try {
      const result = await this.makeshopApiClient.call(integration, {
        method: operation.method,
        path,
        query,
        body:
          Object.keys(body).length > 0 && operation.method !== 'GET'
            ? body
            : undefined,
      });

      // Usage log — success awaits; fail is fire-and-forget.
      if (ctx.nodeExecutionId && ctx.workflowId) {
        await this.integrationsService.logUsage({
          integrationId: integration.id,
          nodeExecutionId: ctx.nodeExecutionId,
          workflowId: ctx.workflowId,
          status: result.status >= 400 ? 'failed' : 'success',
          durationMs: Date.now() - startedAt,
          error:
            result.status >= 400
              ? {
                  code: this.codeForStatus(result.status),
                  message: `MakeShop API returned ${result.status}`,
                }
              : null,
          api: apiInfo,
        });
      }

      const status: 'success' | 'error' =
        result.status >= 400 ? 'error' : 'success';
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          status: result.status,
          response: result.body,
        }),
        status,
      };
    } catch (err) {
      const errInfo = this.classifyError(err);
      if (ctx.nodeExecutionId && ctx.workflowId) {
        await this.integrationsService
          .logUsage({
            integrationId: integration.id,
            nodeExecutionId: ctx.nodeExecutionId,
            workflowId: ctx.workflowId,
            status: 'failed',
            durationMs: Date.now() - startedAt,
            error: { code: errInfo.code, message: errInfo.message },
            api: apiInfo,
          })
          .catch(() => undefined);
      }
      // Preserve the MakeShop原문 errorBody (있을 때) on `error.response` so the
      // LLM can reason about retryability / specific cause for self-recovery.
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: {
            code: errInfo.code,
            message: errInfo.message,
            ...(errInfo.response !== undefined
              ? { response: errInfo.response }
              : {}),
          },
        }),
        status: 'error',
        error: errInfo.message,
      };
    }
  }

  cleanup(ctx: ProviderCleanupCtx): Promise<void> {
    this.cleanupInternal(ctx);
    return Promise.resolve();
  }

  /**
   * Test-only convenience — clears every per-execution state. Production code
   * MUST always pass an `executionId` to `cleanup()` so a stray `cleanup({})`
   * cannot tear down concurrent AI Agent sessions belonging to other users.
   */
  __resetForTesting(): void {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '__resetForTesting must not be called in production — use cleanup({ executionId })',
      );
    }
    this.ownedSidCounts.clear();
    this.executionState.clear();
  }

  private cleanupInternal(ctx: ProviderCleanupCtx): void {
    if (!ctx.executionId) {
      // Whole-provider wipe is a test-only path. Production callers always
      // supply the executionId of the AI Agent node that is winding down.
      this.logger.debug(
        'cleanup() called without executionId — no-op (use __resetForTesting in tests)',
      );
      return;
    }
    const state = this.executionState.get(ctx.executionId);
    if (!state) return;
    for (const sid of state.sidToIntegration.keys()) this.releaseSid(sid);
    this.executionState.delete(ctx.executionId);
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  private ensureState(executionId: string): {
    sidToIntegration: Map<string, Integration>;
    sidToOpMap: Map<
      string,
      Map<
        string,
        { resource: MakeshopResource; operation: MakeshopOperationMetadata }
      >
    >;
  } {
    let s = this.executionState.get(executionId);
    if (!s) {
      s = {
        sidToIntegration: new Map(),
        sidToOpMap: new Map(),
      };
      this.executionState.set(executionId, s);
    }
    return s;
  }

  private extractMcpServers(config: Record<string, unknown>): Array<{
    integrationId?: string;
    enabledTools?: string[];
  }> {
    const raw = config.mcpServers;
    if (!Array.isArray(raw)) return [];
    return raw as Array<{ integrationId?: string; enabledTools?: string[] }>;
  }

  // Single source for tool-name decomposition — delegate to parseMcpToolName
  // (mcp-tool-provider.ts) so PREFIX / SEP changes propagate to both providers.
  private extractSid(toolName: string): string | null {
    return parseMcpToolName(toolName)?.sid ?? null;
  }

  /** Returns the SANITIZED operation token (hyphens already → underscores). */
  private extractOperationToken(toolName: string): string | null {
    return parseMcpToolName(toolName)?.toolNameSanitized ?? null;
  }

  private applyAllowlist(
    enabledTools: string[] | undefined,
  ): (id: string) => boolean {
    if (!enabledTools || enabledTools.length === 0) return () => true;
    if (enabledTools.includes('*')) return () => true;
    const set = new Set(enabledTools);
    return (id: string) => set.has(id);
  }

  private buildJsonSchema(
    op: MakeshopOperationMetadata,
  ): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    for (const [name, spec] of Object.entries(op.fields)) {
      const prop: Record<string, unknown> = {};
      if (spec.type === 'enum') {
        prop.type = 'string';
        if (spec.enum) prop.enum = spec.enum;
      } else if (spec.type === 'array') {
        prop.type = 'array';
        prop.items = { type: 'string' };
      } else if (spec.type === 'object') {
        prop.type = 'object';
        prop.additionalProperties = true;
      } else {
        prop.type = spec.type;
      }
      if (spec.description) prop.description = spec.description;
      if (spec.default !== undefined) prop.default = spec.default;
      properties[name] = prop;
    }
    const schema: Record<string, unknown> = {
      type: 'object',
      properties,
    };

    // Compose `required` + `oneOf` constraints (same mapping as cafe24).
    // - No oneOf constraint: emit plain top-level `required`.
    // - Has oneOf constraint(s): wrap in `allOf` so the AND of requiredFields
    //   plus the AND of each oneOf (each an `anyOf` of single-field `required`
    //   clauses) compose cleanly.
    // - `allOrNone` / `implies` / `impliesValue` are enforced via runtime
    //   validateMakeshopConstraints, not JSON Schema (their `not` encodings
    //   trip LLM tool-call validators).
    const oneOfConstraints = (op.constraints ?? []).filter(
      (c): c is Extract<MakeshopFieldConstraint, { kind: 'oneOf' }> =>
        c.kind === 'oneOf',
    );
    const requiredClause =
      op.requiredFields.length > 0
        ? { required: [...op.requiredFields] }
        : null;

    if (oneOfConstraints.length === 0) {
      if (requiredClause) schema.required = requiredClause.required;
    } else {
      const anyOfClauses = oneOfConstraints.map((c) => ({
        anyOf: c.fields.map((f) => ({ required: [f] })),
      }));
      const allOf = requiredClause
        ? [requiredClause, ...anyOfClauses]
        : anyOfClauses;
      schema.allOf = allOf;
    }

    return schema;
  }

  private codeForStatus(status: number): string {
    if (status === 404) return 'MAKESHOP_404';
    if (status === 422) return 'MAKESHOP_422';
    if (status >= 500 && status < 600) return 'MAKESHOP_5XX';
    if (status === 401 || status === 403) return 'MAKESHOP_AUTH_FAILED';
    if (status === 429) return 'MAKESHOP_RATE_LIMITED';
    return 'MAKESHOP_4XX';
  }

  private classifyError(err: unknown): {
    code: string;
    message: string;
    response?: unknown;
  } {
    if (err instanceof MakeshopAuthFailedError) {
      return {
        code: 'MAKESHOP_AUTH_FAILED',
        message: err.message,
        response: err.responseBody,
      };
    }
    if (err instanceof MakeshopRateLimitedError) {
      return { code: 'MAKESHOP_RATE_LIMITED', message: err.message };
    }
    if (err instanceof MakeshopTransportFailedError) {
      return { code: 'MAKESHOP_TRANSPORT_FAILED', message: err.message };
    }
    return {
      code: 'MAKESHOP_CALL_FAILED',
      message: err instanceof Error ? err.message : String(err),
    };
  }

  private errMsg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * Build the LLM-readable MCP tool description for a makeshop operation.
 * Order (spec §8 / §2 "MCP/JSON Schema 매핑"):
 *   base description → "(MakeShop METHOD path — via Internal Bridge: name)"
 *   → constraint suffix lines (0..N, one per MakeshopFieldConstraint).
 *
 * Unlike cafe24 there is **no timezone suffix** (MakeShop timezone unconfirmed,
 * spec §4.1) and **no restricted-approval ⚠ label** (no MakeShop approval tier,
 * spec §8.2 / §9.5). Sections separated by a blank line.
 */
export function buildToolDescription(
  op: MakeshopOperationMetadata,
  integrationName: string,
): string {
  const constraintLines = (op.constraints ?? []).map(constraintToSuffixLine);
  const parts = [
    op.description,
    `(MakeShop ${op.method} ${op.path} — via Internal Bridge: ${integrationName})`,
    ...constraintLines,
  ];
  return parts.join('\n\n');
}

/**
 * Format a single MakeshopFieldConstraint as a one-line LLM suffix per
 * spec §2 "MCP/JSON Schema 매핑" table (shared wording with cafe24).
 */
export function constraintToSuffixLine(c: MakeshopFieldConstraint): string {
  if (c.kind === 'oneOf') {
    return `Constraint: at least one of ${c.fields.join(', ')} must be provided.`;
  }
  if (c.kind === 'allOrNone') {
    return `Constraint: ${c.fields.join(', ')} must be provided together (all or none).`;
  }
  if (c.kind === 'implies') {
    return `Constraint: when ${c.if} is provided, ${c.then.join(', ')} are also required.`;
  }
  // impliesValue
  return `Constraint: when ${c.if}="${String(c.value)}", ${c.then.join(', ')} are also required.`;
}

/**
 * Sanitize a MakeShop operationId into the MCP tool-name token: non
 * alphanumeric/underscore chars → `_`. MakeShop operationIds mix hyphens and
 * underscores (`get-product`, `get-cart_free_config`) so the hyphen is the
 * primary char this normalizes (`get-product` → `get_product`). spec §8.1.
 *
 * Mirrors `sanitizeToolName` in mcp-tool-provider.ts so the Bridge-side token
 * matches what the MCP Client layer would emit.
 */
export function sanitizeOperationId(operationId: string): string {
  return operationId.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Coerce a tool-argument value to a path-safe scalar string. Mirror of the
 * cafe24 provider / makeshop handler `stringifyPathValue`.
 */
function scalarToString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'bigint') return value.toString();
  return JSON.stringify(value);
}

/**
 * Compute the sid for a tool name from an Integration id. 16자 prefix +
 * non-alphanumeric → underscore. Identical rule to cafe24's `sanitizeSid` so
 * the Internal Bridge sid namespace is consistent across providers.
 */
export function sanitizeSid(integrationId: string): string {
  return integrationId.slice(0, 16).replace(/[^a-z0-9]/gi, '_');
}
