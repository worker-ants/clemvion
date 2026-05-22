import {
  ToolCall,
  ToolDef,
} from '../../../../modules/llm/interfaces/llm-client.interface';
import type { McpServerSummary } from './mcp-diagnostics';
import type { PresentationPayload } from '../../../../shared/conversation-thread/conversation-thread.types';

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
  /**
   * MCP build 결과 누적 슬롯 — provider 가 entry 1건을 push 하면 핸들러가
   * `meta.mcpDiagnostics.serverSummaries` 로 emit 한다. 핸들러가 array 를
   * 소유·관리하므로 provider 는 push 만. spec/5-system/11-mcp-client.md §6.2.
   * 미주입 (undefined) 시 provider 는 silently no-op — 진단 비활성 환경 호환.
   */
  mcpDiagnostics?: McpServerSummary[];
}

export interface ProviderExecCtx {
  config: Record<string, unknown>;
  workspaceId: string;
  /** {@link ProviderBuildCtx.executionId} 와 동일 단위. */
  executionId?: string;
  /**
   * 호출이 발생한 NodeExecution 의 id — provider 가
   * `IntegrationsService.logUsage` 등으로 사용 활동을 기록할 때 사용한다.
   * Multi-turn waiting/resume 사이의 호출들은 다른 nodeExecutionId 를 갖는다.
   */
  nodeExecutionId?: string;
  /** logUsage 외래키. nodeExecutionId 와 한 묶음으로 흐름을 따라간다. */
  workflowId?: string;
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
  /**
   * 디버깅 UI 의 success / error 배지 출처. 미지정 시 `'success'` 로 간주.
   * provider 는 LLM 에 넘길 content 에 에러 컨텍스트를 담으면서도 별도 status
   * 로 실패임을 표시할 수 있다. 핸들러가 provider.execute 의 throw 를 캐치한
   * 경우에도 이 필드가 `'error'` 로 채워진다.
   */
  status?: 'success' | 'error';
  /** 사용자에게 보여줄 사람-읽는 에러 메시지. WS 이벤트 / turnDebug.toolCalls
   *  에 그대로 전달돼 인스펙터에서 빨간 배지로 노출. */
  error?: string;
  /** `meta.ragSources` 에 push 할 항목들. */
  ragSourcesDelta?: unknown[];
  /** `meta.ragDiagnostics` 누적용 — kbId 단위 검색 1회 기록. */
  ragDiagnosticsDelta?: KbSearchDiagnostic;
  /**
   * `render_*` display-only 도구가 성공한 경우에만 set. handler 가 이 페이로드를
   * 현재 `ai_assistant` turn 의 top-level `presentations[]` 에 push 한다.
   * SoT: spec/4-nodes/3-ai/1-ai-agent.md §7.10.
   */
  presentationPayload?: PresentationPayload;
  /**
   * `render_form` (interactive) 도구가 호출된 경우에만 set. handler 가 이 신호를
   * 받아 multi-turn `waiting_for_input` (interactionType: 'ai_form_render') 으로
   * 전환하고, 사용자 제출 시 `tool_result` content 에 제출 데이터를 채워 LLM 을
   * 재호출한다. SoT: spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii / §6.2 step 2.
   */
  blockingFormRender?: {
    toolCallId: string;
    /** Defaults overlay 적용 완료한 form 노드 config (`fields`/`title`/...). */
    formConfig: Record<string, unknown>;
  };
  /**
   * Schema 위반·1MB cap 초과 등으로 silent drop 된 시도 trace —
   * `meta.presentationSchemaViolations[]` 에 누적된다.
   * SoT: spec/4-nodes/3-ai/1-ai-agent.md §4.1 "Schema 위반 처리".
   */
  presentationSchemaViolation?: {
    toolName: string;
    issues: string[];
    attempts: number;
  };
  /**
   * `render_*` 호출의 메타 trace — `meta.presentationCalls[]` 에 push.
   * `presentationPayload` 또는 `presentationSchemaViolation` 가 set 일 때 함께 set.
   */
  presentationCall?: {
    toolName: string;
    toolCallId: string;
    status: 'rendered' | 'schema_violation' | 'dropped' | 'form_pending';
    bytes?: number;
  };
}

export interface KbSearchDiagnostic {
  kbId: string;
  query: string;
  resultCount: number;
}
