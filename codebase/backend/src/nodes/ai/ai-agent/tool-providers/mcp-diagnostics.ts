/**
 * MCP diagnostics — spec/5-system/11-mcp-client.md §6.2
 * `meta.mcpDiagnostics` 의 backend 타입 + 누적 helper.
 *
 * AI Agent 노드 실행의 buildTools/execute 단계에서 각 `mcpServers[]` 항목의
 * 결과·호출 통계를 사용자에게 노출하기 위한 정적 스냅샷. provider 가 build 단계에
 * serverSummary/error 를 push 하고, 핸들러(executor)가 execute 단계에서 호출
 * 카운터를 누적한 뒤 `meta.mcpDiagnostics` 구조화 객체로 emit 한다.
 *
 * 의미: 사용자가 "왜 내가 등록한 통합이 AI Agent 에 안 보이지?" / "MCP 도구가 몇 번
 * 호출됐지?" 의문을 즉시 식별할 수 있도록 한다. (예: cafe24 가 expired(install_timeout)
 * 이면 catalog 가 비어있고, skipReason 으로 사유가 표면화됨.)
 *
 * 2026-07-06 (spec-sync mcp-client 타입 확장): `serverSummaries[]` 단일 배열에서
 * 구조화 객체 (`attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/
 * `serverSummaries`/`errors`) 로 승격. `errors[]` 는 build-phase(connect/`tools/list`,
 * `ctx.mcpDiagnosticErrors` 경유)와 call-phase(`tools/call`/`resources/read`/`prompts/get`
 * 등, `AgentToolResult.mcpErrorDelta` 경유) 양쪽의 서버측 실패를 granular code + phase 로
 * 누적한다 (#840 build-phase + 후속 call-phase). client-side 실패는 tool_result 로만.
 */

/**
 * `skipReason` vocabulary — spec/5-system/11-mcp-client.md §6.2 와 일치.
 *
 * 명명 규칙: 모두 `lower_snake_case`. `Integration.status_reason` (예:
 * `auth_failed`, `install_timeout`) 와 의도적으로 표기 일치 — 일부 값
 * (`expired_install_timeout`, `expired_refresh_failed`) 이 status_reason
 * 의 의미를 그대로 캐리하기 때문. MCP 에러 코드 vocabulary (`MCP_AUTH_FAILED`
 * 등 UPPER_SNAKE_CASE) 와는 다른 enum.
 */
export type McpSkipReason =
  | 'expired_install_timeout'
  | 'expired_refresh_failed'
  | 'expired_no_refresh_token'
  | 'error'
  | 'pending_install'
  | 'lookup_failed'
  | 'not_capable';

export interface McpServerSummary {
  integrationId: string;
  serviceType: string;
  status: 'connected' | 'skipped';
  /** `status === 'skipped'` 일 때만 채워짐. */
  skipReason?: McpSkipReason;
  /** catalog 에 등록된 도구 수. skipped 행은 항상 0. */
  toolCount: number;
}

/**
 * 실패가 발생한 MCP RPC 단계 — spec/5-system/11-mcp-client.md §8.1 의 단계
 * vocabulary 와 일치. build 단계(`connect`/`initialize`/`tools/list`)와
 * call 단계(`tools/call`/`resources/read`/`prompts/get`)를 구분한다.
 */
export type McpErrorPhase =
  | 'connect'
  | 'initialize'
  | 'tools/list'
  | 'tools/call'
  | 'resources/list'
  | 'resources/read'
  | 'prompts/list'
  | 'prompts/get';

/**
 * 서버별 격리된 부분 실패 1건 — spec §6.2 `mcpDiagnostics.errors[]` 원소.
 *
 * `code` 는 `string` — 외부 MCP 는 §8.2 vocabulary (`MCP_TIMEOUT` 등
 * UPPER_SNAKE_CASE), Internal Bridge(cafe24/makeshop)는 자체 vocabulary
 * (`CAFE24_AUTH_FAILED` 등)를 그대로 캐리하므로(spec §2.3) union 이 아닌
 * 자유 문자열이다.
 */
export interface McpDiagnosticError {
  integrationId: string;
  phase: McpErrorPhase;
  code: string;
  message: string;
}

/**
 * spec §6.2 `meta.mcpDiagnostics` 로 emit 되는 최종 구조화 객체.
 *
 * `errors` 는 비어있으면 omit (정상 케이스에 noise 추가 안 함). 나머지 필드는
 * 노드 실행에서 MCP 가 1회 이상 시도됐을 때(`attempted`)만 객체 자체가 emit 되며,
 * emit 시 항상 존재한다.
 */
export interface McpDiagnostics {
  /** MCP 도구가 1번 이상 노출(build)되었거나 호출(execute)되었는지. */
  attempted: boolean;
  /** 성공적으로 connect 된 서버 수 (= serverSummaries 중 status='connected'). */
  serverCount: number;
  /** `tools/call` (일반 도구) 누적 호출 수. */
  toolCalls: number;
  /** `resources/read` (read_resource 메타도구) 누적 호출 수. */
  resourceReads: number;
  /** `prompts/get` (get_prompt 메타도구) 누적 호출 수. */
  promptGets: number;
  /** 각 `mcpServers[]` 항목의 build 결과 스냅샷. */
  serverSummaries: McpServerSummary[];
  /**
   * 서버별 격리된 부분 실패 기록. 실패가 없어도 항상 존재(`[]`) — 소비자가
   * 안정된 shape 를 가정할 수 있도록(spec/4-nodes/3-ai/1-ai-agent.md §7.1
   * 예시가 `"errors": []` 로 명시).
   */
  errors: McpDiagnosticError[];
}

/**
 * executor 가 노드 실행 단위(single-turn) 또는 turn 단위(multi-turn)로 소유하는
 * 가변 누적기. provider 는 build 단계에 `serverSummaries`/`errors` 로 push 하고,
 * executor 는 execute choke point 에서 카운터를 증가시킨다. `finalizeMcpDiagnostics`
 * 가 이를 emit 용 {@link McpDiagnostics} 로 환원한다.
 */
export interface McpDiagnosticsAccumulator {
  serverSummaries: McpServerSummary[];
  errors: McpDiagnosticError[];
  toolCalls: number;
  resourceReads: number;
  promptGets: number;
}

/** 빈 누적기 생성 — executor 가 turn/노드 실행 시작 시 1개 만든다. */
export function createMcpDiagnosticsAccumulator(): McpDiagnosticsAccumulator {
  return {
    serverSummaries: [],
    errors: [],
    toolCalls: 0,
    resourceReads: 0,
    promptGets: 0,
  };
}

/**
 * Provider 가 buildTools 단계에서 serverSummary entry 1건을 push 할 때 사용.
 * 핸들러가 생성·소유하는 배열(`acc.serverSummaries`)을 ProviderBuildCtx 로 전달하면
 * provider 는 본 helper 로 안전하게 entry 를 추가한다 (직접 push 도 무방).
 *
 * 시그니처는 `McpServerSummary[] | undefined` 를 유지한다 — 미주입(undefined) 시
 * silently no-op (진단 비활성 환경 호환).
 */
export function pushMcpServerSummary(
  acc: McpServerSummary[] | undefined,
  entry: McpServerSummary,
): void {
  if (!acc) return;
  acc.push(entry);
}

/**
 * Provider 가 buildTools 단계에서 격리된 실패(error) entry 1건을 push 할 때 사용.
 * {@link pushMcpServerSummary} 와 대칭 — 미주입 시 no-op.
 */
export function pushMcpDiagnosticError(
  acc: McpDiagnosticError[] | undefined,
  entry: McpDiagnosticError,
): void {
  if (!acc) return;
  acc.push(entry);
}

/**
 * LLM tool_call name 을 MCP 호출 카운터 분류로 환원한다 (spec §6.2 counters).
 *
 * - `read_resource` 메타도구 → `resource_read`
 * - `get_prompt` 메타도구 → `prompt_get`
 * - `list_resources`/`list_prompts` 메타도구(discovery) → `null` (미집계 — §8.3
 *   에서 usage 로그도 제외되는 내부 discovery 흐름과 정합)
 * - 그 외 일반 MCP 도구(`mcp_<sid>__<toolName>`) → `tool`
 * - `mcp_` prefix 가 아니면(kb_/render_/cond_ 등) → `null`
 *
 * 이름 규칙: `mcp_<sid>__<identifier>` (spec §5.2). sid 는 sanitize 되어 `__` 를
 * 포함하지 않으므로 첫 `__` 이후가 tool identifier.
 */
export function classifyMcpCall(
  name: string,
): 'tool' | 'resource_read' | 'prompt_get' | null {
  if (!name.startsWith('mcp_')) return null;
  const idx = name.indexOf('__');
  const identifier = idx >= 0 ? name.slice(idx + 2) : '';
  if (identifier === 'read_resource') return 'resource_read';
  if (identifier === 'get_prompt') return 'prompt_get';
  if (identifier === 'list_resources' || identifier === 'list_prompts') {
    return null;
  }
  return 'tool';
}

/**
 * 누적기를 emit 용 {@link McpDiagnostics} 로 환원한다.
 *
 * MCP 가 이 노드 실행에서 1회도 시도되지 않았으면 `undefined` — 핸들러가
 * `meta.mcpDiagnostics` 키 자체를 생략해 정상 케이스 meta 를 lean 하게 유지한다
 * (기존 serverSummaries-only 동작의 하위호환). 시도됐으면 항상 전체 구조를 emit
 * (`errors` 는 비어도 `[]` 로 포함 — §7.1 예시와 정합, 안정 shape).
 */
export function finalizeMcpDiagnostics(
  acc: McpDiagnosticsAccumulator | undefined,
): McpDiagnostics | undefined {
  if (!acc) return undefined;
  const attempted =
    acc.serverSummaries.length > 0 ||
    acc.errors.length > 0 ||
    acc.toolCalls > 0 ||
    acc.resourceReads > 0 ||
    acc.promptGets > 0;
  if (!attempted) return undefined;
  const serverCount = acc.serverSummaries.filter(
    (s) => s.status === 'connected',
  ).length;
  return {
    attempted,
    serverCount,
    toolCalls: acc.toolCalls,
    resourceReads: acc.resourceReads,
    promptGets: acc.promptGets,
    serverSummaries: acc.serverSummaries,
    errors: acc.errors,
  };
}
