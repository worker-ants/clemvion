import {
  ToolCall,
  ToolDef,
} from '../../../../modules/llm/interfaces/llm-client.interface';

/**
 * AgentToolProvider — AI Agent 노드가 LLM 에 노출하는 "핸들러 내부 실행형" tool 의
 * 추상화. 외부 워크플로 노드를 호출하는 `tool_<nodeId>` 메커니즘과 달리, 핸들러가
 * tool_use 응답을 intercept 해서 직접 결과를 만들어 다음 LLM turn 에 주입한다.
 *
 * 현재 구현체:
 *  - {@link KbToolProvider} — `kb_<sanitizedKbId>` tool 로 KB 검색을 노출
 *  - {@link McpToolProvider} — `mcp_<sid>__<name>` tool 로 MCP 서버 도구 노출
 *
 * 추가 후보 (follow-up): workspace 변수 조회, 외부 vector store 등.
 */
export interface AgentToolProvider {
  /** Provider 식별자 — 로깅/디버깅용. tool name prefix 와 별개. */
  readonly key: string;

  /**
   * LLM 응답의 tool_call name 이 이 provider 가 처리할 대상인지 판단.
   * 일반적으로 `name.startsWith('<prefix>_')` 형태.
   */
  matches(toolName: string): boolean;

  /**
   * 노드 config 와 실행 컨텍스트로부터 LLM 에 노출할 ToolDef 배열을 생성.
   * 빈 배열 반환 시 이 provider 의 tool 은 LLM 에 노출되지 않는다.
   */
  buildTools(ctx: ProviderBuildCtx): Promise<ToolDef[]>;

  /**
   * LLM 이 호출한 tool_use 를 실행해 다음 turn 에 넘길 tool_result 메시지를 만든다.
   * `matches(call.name) === false` 일 때는 호출되지 않는다.
   */
  execute(call: ToolCall, ctx: ProviderExecCtx): Promise<AgentToolResult>;

  /**
   * 노드 실행이 끝났을 때 (또는 multi-turn `waiting_for_input` 으로 일시중단될 때)
   * provider 가 보유한 외부 자원(MCP 세션, 임시 파일 등) 을 정리하는 hook.
   *
   * 핸들러는 single-turn `execute` 의 finally, multi-turn 의 매 turn 종료 지점
   * (waiting_for_input · ended · error) 마다 모든 provider 의 cleanup 을 호출한다.
   * 호출은 `executionId` 단위이며, 같은 execution 내에서 여러 번 호출되어도
   * 안전(idempotent)해야 한다. 자원이 없는 provider 는 구현 생략 가능 (optional).
   */
  cleanup?(ctx: ProviderCleanupCtx): Promise<void>;
}

export interface ProviderBuildCtx {
  /** AI Agent 노드 config 또는 multi-turn resume state. */
  config: Record<string, unknown>;
  workspaceId: string;
  /**
   * 외부 자원 캐싱 단위. `executionId` 가 같은 buildTools/execute 호출은 같은
   * 노드 실행에 속한다 — provider 는 이 키로 세션 등을 캐시해 한 노드 실행 내에서
   * 외부 connect 가 1회만 일어나도록 보장한다 (spec/5-system/11-mcp-client.md §4.3).
   */
  executionId?: string;
}

export interface ProviderExecCtx {
  config: Record<string, unknown>;
  workspaceId: string;
  /** {@link ProviderBuildCtx.executionId} 와 동일 단위. */
  executionId?: string;
}

export interface ProviderCleanupCtx {
  /** 정리할 자원의 scope key. `undefined` 이면 provider 의 모든 자원 정리. */
  executionId?: string;
}

/**
 * Provider.execute 결과. `content` 는 LLM 에 그대로 전달되는 tool_result 메시지의
 * content (대부분 JSON 문자열). `*Delta` 필드는 핸들러가 노드 meta 에 누적할
 * 부수 정보 — provider 가 직접 핸들러 상태를 변경하지 않도록 분리한다.
 */
export interface AgentToolResult {
  toolCallId: string;
  content: string;
  /** `meta.ragSources` 에 push 할 항목들. */
  ragSourcesDelta?: unknown[];
  /** `meta.ragDiagnostics` 누적용 — kbId 단위 검색 1회 기록. */
  ragDiagnosticsDelta?: KbSearchDiagnostic;
}

export interface KbSearchDiagnostic {
  kbId: string;
  query: string;
  resultCount: number;
}
