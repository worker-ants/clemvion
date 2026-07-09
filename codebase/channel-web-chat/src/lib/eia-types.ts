// EIA 외부 표면 타입 (위젯이 소비하는 부분). SoT: spec/5-system/14-external-interaction-api,
// spec/7-channel-web-chat/0-architecture §3.

export interface InteractionEndpoints {
  stream: string;
  submit: string;
  status: string;
  cancel: string;
  refresh: string;
}

export interface InteractionGrant {
  token: string;
  expiresAt: string;
  endpoints: InteractionEndpoints;
}

/** POST /api/hooks/:endpointPath 의 202 응답. */
export interface HookStartResponse {
  executionId: string;
  status?: string;
  interaction?: InteractionGrant;
}

/** EIA 외부 interactionType — 3값(form/buttons/ai_conversation). render_form 은 ai_conversation 통합. */
export type ExternalInteractionType = "form" | "buttons" | "ai_conversation";

/**
 * conversationThread.turns 의 source 마커.
 *
 * wire(WS §4.4.5 / EIA §5.3 getStatus)의 `conversationThread.turns[i].source` 는 백엔드
 * `ConversationTurnSource` 5값(`presentation_user`/`ai_user`/`ai_assistant`/`ai_tool`/`system`,
 * [conversation-thread §1.1](../../../../spec/conventions/conversation-thread.md))이다. 위젯은 이를
 * 말풍선 role 로 축약해 렌더한다(매핑 SoT: `conversation.roleOf` + [1-widget-app §2](../../../../spec/7-channel-web-chat/1-widget-app.md)).
 * `live`/`injected` 는 emit `messages[].source`(§4.4.6) 및 위젯 로컬 라이브 dispatch 의 2값 마커로,
 * 하위 호환·테스트 fixture 를 위해 union 에 함께 유지한다.
 */
export type TurnSource =
  | "live"
  | "injected"
  | "presentation_user"
  | "ai_user"
  | "ai_assistant"
  | "ai_tool"
  | "system";

export interface ConversationTurn {
  source?: TurnSource;
  text?: string;
  nodeLabel?: string;
  data?: Record<string, unknown>;
  /** 명시 role — 있으면 source 매핑보다 우선(라이브 dispatch·구형 fixture 호환). */
  role?: "user" | "assistant";
  /** carousel/table/chart/template presentation 페이로드(메시지 타임라인 inline 렌더). */
  presentations?: Array<Record<string, unknown>>;
}

export interface ConversationThread {
  turns: ConversationTurn[];
}

/** SSE 이벤트(위젯이 처리하는 부분). */
export type EiaEventName =
  | "execution.started"
  | "execution.waiting_for_input"
  | "execution.ai_message"
  | "execution.message"
  | "execution.resumed"
  | "execution.completed"
  | "execution.failed"
  | "execution.cancelled"
  | "execution.replay_unavailable";

/**
 * SSE `execution.waiting_for_input` — **WS wire 형태**. SSE 스트림은 fanout envelope 를
 * 그대로 전송하므로 EIA §6.2 notification 형태(`node.id`/`context.*`)가 아니라 백엔드
 * `execution-engine` 가 emit 하는 wire 필드명을 그대로 받는다(프론트엔드 store 와 동일 SoT).
 * 매핑: nodeId=`waitingNodeId`, 타입=`interactionType`(top-level), ai config=`nodeOutput.conversationConfig`,
 * buttons=`buttonConfig`, form=`nodeOutput`, thread=`conversationThread`(top-level).
 */
export interface WaitingForInputEvent {
  status?: string;
  waitingNodeId?: string;
  waitingNodeType?: string;
  interactionType?: ExternalInteractionType;
  conversationThread?: ConversationThread;
  /** AI(ai_conversation/ai_form_render): `conversationConfig` 동봉. form: form 선언. */
  nodeOutput?: {
    interactionType?: ExternalInteractionType;
    config?: Record<string, unknown>;
    conversationConfig?: Record<string, unknown>;
    formConfig?: Record<string, unknown>;
    /** form: nodeOutput 자체를 config 로 사용할 때 임의 필드 허용 (parseWaitingForInput fallback). */
    [k: string]: unknown;
  };
  /** buttons interactionType 전용 — `{ buttons, nodeOutput }`. */
  buttonConfig?: Record<string, unknown>;
  seq?: number;
}

/** SSE `execution.ai_message` — wire 형태. 어시스턴트 텍스트는 `message`(not `text`). */
export interface AiMessageEvent {
  message?: string;
  nodeId?: string;
  turnCount?: number;
  presentations?: Array<Record<string, unknown>>;
  seq?: number;
}

/**
 * SSE `execution.message` — wire 형태. 표시-전용 presentation 노드(carousel/table/chart/template)가
 * 버튼 없이 자동 진행 완료할 때 백엔드가 발행하는 표시 메시지. `presentations[i]` 는 위젯
 * `classifyPresentation` 입력과 동일한 `{ config, output }` envelope (AI render_* 와 같은 렌더 경로).
 * AI 가 생성한 메시지가 아니므로 `AiMessageEvent` 와 구분한다 (DOM 전역 `MessageEvent` 와도 별개).
 */
export interface ExecutionMessageEvent {
  nodeId?: string;
  nodeType?: string;
  presentations?: Array<Record<string, unknown>>;
  seq?: number;
}

/**
 * GET /api/external/executions/:id 단발 상태 조회 응답 (EIA §5.3 / EIA-IN-04).
 * 전역 TransformInterceptor 봉투(`{ data }`) 언랩 후의 shape.
 */
export interface ExecutionStatus {
  id: string;
  workflowId?: string;
  status: string;
  currentNode?: string | null;
  context?: Record<string, unknown> | null;
  result?: unknown;
  error?: unknown;
  seq?: number;
  updatedAt?: string;
}

/** /interact 명령. retry_last_turn 은 외부 미지원(EIA-IN-02). */
export type InteractCommand =
  | { command: "submit_message"; nodeId?: string; message: string }
  | { command: "click_button"; nodeId?: string; buttonId: string }
  | { command: "submit_form"; nodeId?: string; data: Record<string, unknown> }
  | { command: "end_conversation"; nodeId?: string; reason?: string }
  | { command: "cancel"; reason?: string };
