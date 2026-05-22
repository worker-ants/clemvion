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
  Cafe24ApiClient,
  Cafe24AuthFailedError,
  Cafe24RateLimitedError,
  Cafe24TransportFailedError,
} from '../../../integration/cafe24/cafe24-api.client.js';
import {
  CAFE24_TIMEZONE_SUFFIX,
  Cafe24FieldConstraint,
  Cafe24OperationMetadata,
  Cafe24Resource,
  listAllCafe24Operations,
  scopeForOperation,
  validateCafe24Constraints,
} from '../../../integration/cafe24/metadata/index.js';
import { Integration } from '../../../../modules/integrations/entities/integration.entity.js';

/**
 * Cafe24 MCP Tool Provider — surfaces Cafe24 Admin API operations to the
 * AI Agent as MCP-style tools (`mcp_<sid>__<operation_id>`) via the
 * in-process Internal Bridge transport. spec/5-system/11-mcp-client.md §2.3
 * + spec/4-nodes/4-integration/4-cafe24.md §8.
 *
 * Coexists with the existing McpToolProvider (which handles external HTTP
 * MCP servers, `service_type='mcp'`):
 *  - This provider is registered BEFORE McpToolProvider so `matches()` can
 *    win for Cafe24-owned sids.
 *  - matches() returns true only for sids that buildTools has registered
 *    for cafe24 — other `mcp_*` names fall through to McpToolProvider.
 */
export class Cafe24McpToolProvider implements AgentToolProvider {
  readonly key = 'cafe24-mcp';
  private readonly logger = new Logger(Cafe24McpToolProvider.name);

  // Reference-counted set of sids belonging to cafe24 Integrations
  // registered via buildTools. Counted (not a plain Set) so two concurrent
  // AI Agent executions binding the same Integration both keep the sid
  // alive — one execution's cleanup() must not remove the sid while the
  // other still relies on matches() returning true. count drops to 0 ⇒
  // the entry is removed.
  private readonly ownedSidCounts = new Map<string, number>();

  // executionId -> per-execution lookup tables (integrations + operations).
  // sidToOpMap: sid -> operation id -> { resource, operation } pair so that
  // an integration can expose many (resource, operation) tuples under one sid.
  private readonly executionState = new Map<
    string,
    {
      sidToIntegration: Map<string, Integration>;
      sidToOpMap: Map<
        string,
        Map<
          string,
          { resource: Cafe24Resource; operation: Cafe24OperationMetadata }
        >
      >;
    }
  >();

  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly cafe24ApiClient: Cafe24ApiClient,
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
        'Cafe24McpToolProvider.buildTools called without executionId — skipping',
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
          `Cafe24 integration ${ref.integrationId} lookup failed: ${this.errMsg(err)}`,
        );
        pushMcpServerSummary(ctx.mcpDiagnostics, {
          integrationId: ref.integrationId,
          serviceType: 'cafe24',
          status: 'skipped',
          skipReason: 'lookup_failed',
          toolCount: 0,
        });
        continue;
      }

      // Only react to cafe24 — other service_types belong to McpToolProvider.
      // McpToolProvider 가 본 ref 를 처리하므로 본 provider 의 summary 에는
      // 포함하지 않는다 (다른 provider 가 자기 summary 를 push).
      if (integration.serviceType !== 'cafe24') continue;

      // spec/4-nodes/4-integration/4-cafe24.md §8.6 (2026-05-18) — `expired`
      // 상태 분기. install_timeout 은 install_token NULL 이라 refresh 불가;
      // refresh_token 보유 + 그 외 statusReason 은 큐 경유 refresh 1회 시도
      // 후 worker 가 status='connected' 로 전이시키면 fresh row 로 진행.
      // ensureFreshToken 직접 호출 금지 — BullMQ jobId dedup 우회 위험.
      if (integration.status === 'expired') {
        const recovered = await this.tryRecoverExpired(integration);
        if (recovered.kind === 'recovered') {
          integration = recovered.integration;
        } else {
          this.logger.warn(
            `Cafe24 integration ${integration.id} expired (reason=${recovered.skipReason}) — skipped`,
          );
          pushMcpServerSummary(ctx.mcpDiagnostics, {
            integrationId: integration.id,
            serviceType: 'cafe24',
            status: 'skipped',
            skipReason: recovered.skipReason,
            toolCount: 0,
          });
          continue;
        }
      } else if (integration.status === 'pending_install') {
        this.logger.warn(
          `Cafe24 integration ${integration.id} pending_install — skipped`,
        );
        pushMcpServerSummary(ctx.mcpDiagnostics, {
          integrationId: integration.id,
          serviceType: 'cafe24',
          status: 'skipped',
          skipReason: 'pending_install',
          toolCount: 0,
        });
        continue;
      } else if (integration.status !== 'connected') {
        // 'error' (auth_failed / insufficient_scope / network) — 외부 명시
        // reauth 가 정식 회복 경로 ([Spec MCP Client §8.4]).
        this.logger.warn(
          `Cafe24 integration ${integration.id} not connected (status=${integration.status}) — skipped`,
        );
        pushMcpServerSummary(ctx.mcpDiagnostics, {
          integrationId: integration.id,
          serviceType: 'cafe24',
          status: 'skipped',
          skipReason: 'error',
          toolCount: 0,
        });
        continue;
      }

      const sid = sanitizeSid(integration.id);
      const enabled = this.applyAllowlist(ref.enabledTools);

      // Filter operations by what scopes Cafe24 actually granted us.
      // The integration's `credentials.scopes` records the scopes echoed
      // back by Cafe24's `/oauth/token` response (after PR #37) — these
      // are the *real* permissions on the access_token, not what we asked
      // for. Exposing an operation that requires a scope we don't hold
      // makes the AI Agent try it and 403 with `insufficient_scope`,
      // which (a) wastes a tool round-trip and (b) flips the integration
      // status to `error(auth_failed)` via the 401/403 handler in
      // Cafe24ApiClient — a UX regression because the integration WAS
      // working fine for the scopes it actually has.
      const grantedScopes = extractGrantedScopes(integration);
      const opMap = new Map<
        string,
        { resource: Cafe24Resource; operation: Cafe24OperationMetadata }
      >();
      const skippedByScope: string[] = [];
      for (const { resource, operation } of listAllCafe24Operations()) {
        if (!enabled(operation.id)) continue;
        const required = scopeForOperation(resource, operation);
        if (!grantedScopes.has(required)) {
          skippedByScope.push(`${operation.id}(needs ${required})`);
          continue;
        }
        opMap.set(operation.id, { resource, operation });
        tools.push({
          name: `mcp_${sid}__${operation.id}`,
          description: buildToolDescription(operation, integration.name),
          parameters: this.buildJsonSchema(operation),
        });
      }
      if (skippedByScope.length > 0) {
        // Log only a sample — the full list can run into hundreds for a
        // mall with a single scope granted.
        this.logger.log(
          `Cafe24 integration ${integration.id} (${integration.name}) — ${skippedByScope.length} operation(s) skipped due to missing scope. granted=[${[...grantedScopes].join(',')}] sample=[${skippedByScope.slice(0, 5).join(',')}${skippedByScope.length > 5 ? ',...' : ''}]`,
        );
      }
      // Only retain the sid for THIS execution if buildTools hasn't seen
      // it on this execution before — buildTools may be invoked multiple
      // times per `executionId` (e.g. multi-turn AI Agent resume), and
      // we want one retain per (executionId, sid) pair so each cleanup()
      // releases exactly once.
      const newForThisExecution = !state.sidToIntegration.has(sid);
      state.sidToIntegration.set(sid, integration);
      state.sidToOpMap.set(sid, opMap);
      if (newForThisExecution) this.retainSid(sid);

      pushMcpServerSummary(ctx.mcpDiagnostics, {
        integrationId: integration.id,
        serviceType: 'cafe24',
        status: 'connected',
        toolCount: opMap.size,
      });
    }

    return tools;
  }

  /**
   * spec/4-nodes/4-integration/4-cafe24.md §8.6 — `status='expired'` 인
   * cafe24 통합의 buildTools 자가 회복 시도.
   *
   * **분기**:
   * - `status_reason === 'install_timeout'` → refresh 불가 (install_token
   *   자체 NULL). `skipReason='expired_install_timeout'`.
   * - `credentials.refresh_token` 누락 → refresh 불가, 사용자 reauth 필요.
   *   `skipReason='expired_no_refresh_token'`.
   * - 그 외 → `Cafe24ApiClient.refreshTokenViaQueue` 1회 시도. BullMQ
   *   `cafe24-token-refresh` 큐의 `jobId = integrationId` dedup 으로 클러스터
   *   전체 직렬화. 성공 시 worker 가 status='connected' 로 전이시키고 본
   *   메서드가 fresh row 를 다시 조회해 반환. 실패 (`Cafe24AuthFailedError`)
   *   시 worker 가 이미 `error(auth_failed)` 전이를 책임지므로 추가 status
   *   변경 없이 `skipReason='expired_refresh_failed'`.
   *
   * **재진입**: 본 메서드 자체는 buildTools 의 노드 실행 단위 호출 1회당 최대
   * 1회만 호출된다 — 동일 노드의 multi-turn resume 도 새 buildTools 호출이므로
   * 매 turn 마다 별도 회복 시도. 큐 dedup 으로 cross-pod / cross-turn 동시
   * refresh 가 직렬화되므로 thundering herd 없음.
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
      await this.cafe24ApiClient.refreshTokenViaQueue(
        integration,
        'background',
      );
    } catch (err) {
      if (err instanceof Cafe24AuthFailedError) {
        return { kind: 'skipped', skipReason: 'expired_refresh_failed' };
      }
      // Transport / Redis / 기타 (Cafe24AuthFailedError 외) — 보수적으로 skip
      // + 같은 reason 사용 (사용자 입장에선 토큰 갱신이 안 된 상태는 동일).
      // 본 buildTools 패스 안에서는 자동 재시도하지 않음 — 다음 AI Agent 노드
      // 실행이 새 buildTools 를 발사할 때 자연 재시도된다. spec/5-system/
      // 11-mcp-client.md §6.2 의 `expired_refresh_failed` vocabulary 는
      // invalid_grant 와 transport 실패를 모두 포함하는 의미로 사용 (skipReason
      // 세분화는 spec follow-up).
      this.logger.warn(
        `Cafe24 integration ${integration.id} refresh attempt failed (non-auth): ${this.errMsg(err)}`,
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
        `Cafe24 integration ${integration.id} re-read after refresh failed: ${this.errMsg(err)}`,
      );
      return { kind: 'skipped', skipReason: 'lookup_failed' };
    }
    if (fresh.status !== 'connected') {
      // Worker 가 refresh 를 끝냈는데도 status 가 connected 아니면 결과적으로
      // 회복 실패 — worker 의 status 전이 결과 (예: error(auth_failed)) 를
      // 그대로 reflect.
      return { kind: 'skipped', skipReason: 'expired_refresh_failed' };
    }
    return { kind: 'recovered', integration: fresh };
  }

  async execute(
    call: ToolCall,
    ctx: ProviderExecCtx,
  ): Promise<AgentToolResult> {
    const sid = this.extractSid(call.name);
    const operationId = this.extractOperationId(call.name);
    if (!sid || !operationId) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: { code: 'CAFE24_MCP_TOOL_NAME_INVALID', name: call.name },
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
            code: 'CAFE24_MCP_NO_SESSION',
            message: 'buildTools was not called for this execution',
          },
        }),
        status: 'error',
        error: 'No active cafe24 MCP session',
      };
    }
    const integration = state.sidToIntegration.get(sid);
    const opMap = state.sidToOpMap.get(sid);
    if (!integration || !opMap) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: { code: 'CAFE24_MCP_INTEGRATION_UNKNOWN', sid },
        }),
        status: 'error',
        error: `Unknown sid ${sid}`,
      };
    }
    const opEntry = opMap.get(operationId);
    if (!opEntry) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: {
            code: 'CAFE24_UNKNOWN_OPERATION',
            operation: operationId,
          },
        }),
        status: 'error',
        error: `Unknown cafe24 operation ${operationId}`,
      };
    }
    const { operation } = opEntry;

    let args: Record<string, unknown> = {};
    try {
      args = call.arguments
        ? (JSON.parse(call.arguments) as Record<string, unknown>)
        : {};
    } catch {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: { code: 'CAFE24_MCP_TOOL_ARGS_INVALID' },
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
            code: 'CAFE24_MISSING_FIELDS',
            missing,
          },
        }),
        status: 'error',
        error: `Missing required fields: ${missing.join(', ')}`,
      };
    }

    // Conditional constraints check (spec §2 "constraints 의 의미"). Reuses
    // CAFE24_MISSING_FIELDS so client/UI does not need to learn a new code;
    // the human-readable message identifies which kind / fields were violated.
    const constraintViolation = validateCafe24Constraints(operation, args);
    if (constraintViolation) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({
          error: {
            code: 'CAFE24_MISSING_FIELDS',
            message: constraintViolation,
          },
        }),
        status: 'error',
        error: constraintViolation,
      };
    }

    // Split args into path/query/body per metadata.
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

    const startedAt = Date.now();
    try {
      const result = await this.cafe24ApiClient.call(integration, {
        method: operation.method,
        path,
        query,
        body:
          Object.keys(body).length > 0 && operation.method !== 'GET'
            ? body
            : undefined,
      });

      // Usage log — success.
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
                  message: `Cafe24 API returned ${result.status}`,
                }
              : null,
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
          })
          .catch(() => undefined);
      }
      // B-3-1: 노드 경로의 `output.response` (success 시 result.body) 와
      // 일관되게, MCP 에러 envelope 도 Cafe24 원문 errorBody (있을 때) 를
      // `error.response` 에 보존한다 — LLM 이 retryability·구체 사유를
      // 직접 추론할 수 있어 다단계 자가복구 시나리오를 지원.
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
   * Test-only convenience — clears every per-execution state. Production
   * code MUST always pass an `executionId` to `cleanup()` so a stray
   * `cleanup({})` cannot tear down concurrent AI Agent sessions belonging
   * to other users (`CAFE24_MCP_NO_SESSION` would surface on their next
   * tool call).
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
      // Whole-provider wipe is a test-only path now — production callers
      // (AiAgentHandler) always supply the executionId of the AI Agent
      // node that is winding down. Silently ignoring a missing
      // executionId would erase other in-flight sessions and break their
      // tool calls, so we no-op instead. Tests that need a clean slate
      // should use __resetForTesting().
      this.logger.debug(
        'cleanup() called without executionId — no-op (use __resetForTesting in tests)',
      );
      return;
    }
    const state = this.executionState.get(ctx.executionId);
    if (!state) return;
    // Release one retain per (executionId, sid) — symmetric with the
    // single retain in buildTools. Other executions that hold the same
    // sid keep matches() returning true until their own cleanup runs.
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
        { resource: Cafe24Resource; operation: Cafe24OperationMetadata }
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

  // W-30 — `parseMcpToolName` (mcp-tool-provider.ts) 와 동일 분해 로직을 두
  // provider 에 별도로 작성해 PREFIX / SEP 변경 시 한쪽만 갱신되는 위험이 있었다.
  // 단일 source 로 위임.
  private extractSid(toolName: string): string | null {
    return parseMcpToolName(toolName)?.sid ?? null;
  }

  private extractOperationId(toolName: string): string | null {
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
    op: Cafe24OperationMetadata,
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

    // Compose `required` + `oneOf` constraints (spec §2 "MCP/JSON Schema 매핑").
    // - No oneOf constraint: emit plain top-level `required`.
    // - Has oneOf constraint(s): wrap in `allOf` so the AND of requiredFields
    //   plus the AND of each oneOf (each itself an `anyOf` of single-field
    //   `required` clauses) compose cleanly. JSON Schema's own `oneOf` means
    //   "exactly one" — we deliberately use `anyOf` for at-least-one.
    // - `allOrNone` / `implies` kinds intentionally do NOT translate to JSON
    //   Schema; their `not` encodings trip LLM tool-call validators. They
    //   are enforced via description suffix + runtime `validateCafe24Constraints`.
    const oneOfConstraints = (op.constraints ?? []).filter(
      (c): c is Extract<Cafe24FieldConstraint, { kind: 'oneOf' }> =>
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
    if (status === 404) return 'CAFE24_404';
    if (status === 422) return 'CAFE24_422';
    if (status >= 500 && status < 600) return 'CAFE24_5XX';
    if (status === 401 || status === 403) return 'CAFE24_AUTH_FAILED';
    if (status === 429) return 'CAFE24_RATE_LIMITED';
    return 'CAFE24_4XX';
  }

  private classifyError(err: unknown): {
    code: string;
    message: string;
    response?: unknown;
  } {
    if (err instanceof Cafe24AuthFailedError) {
      return {
        code: 'CAFE24_AUTH_FAILED',
        message: err.message,
        response: err.responseBody,
      };
    }
    if (err instanceof Cafe24RateLimitedError) {
      return { code: 'CAFE24_RATE_LIMITED', message: err.message };
    }
    if (err instanceof Cafe24TransportFailedError) {
      return { code: 'CAFE24_TRANSPORT_FAILED', message: err.message };
    }
    return {
      code: 'CAFE24_CALL_FAILED',
      message: err instanceof Error ? err.message : String(err),
    };
  }

  private errMsg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * Read the granted Cafe24 scopes from an Integration. Returns a Set so
 * the lookup is O(1) per operation. Falls back to an empty Set when
 * scopes are missing — that yields zero tools, which is correct for an
 * unknown-permission integration (better than letting the AI Agent
 * blindly 403 every endpoint).
 */
function extractGrantedScopes(integration: Integration): Set<string> {
  const creds = integration.credentials as Record<string, unknown> | undefined;
  const scopes = creds?.scopes;
  if (!Array.isArray(scopes)) return new Set();
  return new Set(
    scopes.filter((s): s is string => typeof s === 'string' && s.length > 0),
  );
}

/**
 * Build the LLM-readable MCP tool description for a cafe24 operation.
 * Order (spec §2 "MCP/JSON Schema 매핑" + §5.3):
 *   base description → "(Cafe24 METHOD path — via Internal Bridge: name)"
 *   → constraint suffix lines (0..N, one per Cafe24FieldConstraint)
 *   → CAFE24_TIMEZONE_SUFFIX (last line).
 * Sections separated by a blank line.
 */
export function buildToolDescription(
  op: Cafe24OperationMetadata,
  integrationName: string,
): string {
  const constraintLines = (op.constraints ?? []).map(constraintToSuffixLine);
  const parts = [
    op.description,
    `(Cafe24 ${op.method} ${op.path} — via Internal Bridge: ${integrationName})`,
    ...constraintLines,
    CAFE24_TIMEZONE_SUFFIX,
  ];
  return parts.join('\n\n');
}

/**
 * Format a single Cafe24FieldConstraint as a one-line LLM suffix per
 * spec §2 "MCP/JSON Schema 매핑" table.
 */
export function constraintToSuffixLine(c: Cafe24FieldConstraint): string {
  if (c.kind === 'oneOf') {
    return `Constraint: at least one of ${c.fields.join(', ')} must be provided.`;
  }
  if (c.kind === 'allOrNone') {
    return `Constraint: ${c.fields.join(', ')} must be provided together (all or none).`;
  }
  // implies
  return `Constraint: when ${c.if} is provided, ${c.then.join(', ')} are also required.`;
}

/**
 * Coerce a tool-argument value to a path-safe scalar string. AI Agent
 * argument objects can arrive as numbers, booleans, or even nested
 * objects (LLM occasionally passes them) — we keep scalars verbatim and
 * JSON-encode the rest so the eventual Cafe24 4xx carries an actionable
 * URL rather than `[object Object]`.
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
 * non-alphanumeric → underscore. UUID v4 의 random 영역에서 16자를 가져오므로
 * 충돌 확률은 birthday paradox 기준 ~10^9 row 단위에서야 우려된다. 옛 8자
 * prefix 는 SaaS 규모 (~10^4 integration) 에서 비현실적으로 충돌이 가까웠다.
 * `McpToolProvider` 의 SID_LENGTHS 사다리 (8/12/32) 와는 별 namespace —
 * cafe24 사이드는 단일 사다리 끊고 16자로 고정 확장.
 */
export function sanitizeSid(integrationId: string): string {
  return integrationId.slice(0, 16).replace(/[^a-z0-9]/gi, '_');
}
