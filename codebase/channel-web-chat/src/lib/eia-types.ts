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

/** conversationThread.turns 의 source 마커 (live/injected). */
export type TurnSource = "live" | "injected";

export interface ConversationTurn {
  source?: TurnSource;
  text?: string;
  nodeLabel?: string;
  data?: Record<string, unknown>;
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
