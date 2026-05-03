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
 *
 * 추가 후보 (follow-up):
 *  - workspace 변수 조회, MCP server, 외부 vector store 등
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
}

export interface ProviderBuildCtx {
  /** AI Agent 노드 config 또는 multi-turn resume state. */
  config: Record<string, unknown>;
  workspaceId: string;
}

export interface ProviderExecCtx {
  config: Record<string, unknown>;
  workspaceId: string;
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
