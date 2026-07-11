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
 *
 * **`WaitingContext`(아래)와의 구분**: 본 타입은 **SSE wire** 형태(전 필드 optional + `status`/`seq`
 * 등 SSE 전용 필드 포함)이고, `WaitingContext` 는 REST `getStatus.context` 의 **닫힌 union**(필수 필드
 * 확정)이다. 둘은 같은 대기 상태를 서로 다른 표면에서 본 것으로, `WaitingContext ⊆ WaitingForInputEvent`
 * (assignable)라 위젯이 한 파서(`parseWaitingForInput`)로 양쪽을 처리한다.
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
 * REST `getStatus` 의 `context` 두 변형이 공유하는 봉투 필드.
 *
 * backend `WaitingContextBaseDto`([EIA §5.3](../../../../spec/5-system/14-external-interaction-api.md))
 * 를 미러한다. `context` 는 SSE `waiting_for_input` wire 와 **동일 형식**이라 위젯이 같은
 * `parseWaitingForInput` 을 재사용한다 — 즉 `WaitingContext` 는 `WaitingForInputEvent` 에 assignable 하다.
 */
interface WaitingContextBase {
  interactionType: ExternalInteractionType;
  waitingNodeId: string;
  /**
   * 대화 히스토리 durable 스냅샷. **present-when-available** — 값이 있을 때만 키가 present 하고,
   * 부재 시 키 자체가 생략된다(`| null` 아님, [api-convention §5.4](../../../../spec/5-system/2-api-convention.md)).
   */
  conversationThread?: ConversationThread;
}

/** `interactionType=buttons` 이고 buttonConfig 복원에 성공한 변형. `{ buttons, nodeOutput }`. */
export interface ButtonsContext extends WaitingContextBase {
  buttonConfig: Record<string, unknown>;
}

/** form/ai_conversation, 그리고 **buttonConfig 를 복원하지 못한 buttons** 변형. */
export interface NodeOutputContext extends WaitingContextBase {
  nodeOutput: WaitingForInputEvent["nodeOutput"];
}

/**
 * REST `getStatus` 의 `waiting_for_input` `context` — **판별자 없는 닫힌 2-variant union**.
 *
 * 분기는 discriminator 가 아니라 **키 존재**(`'buttonConfig' in context`)로 한다 — `interactionType`
 * 은 sound 판별자가 아니다(`buttons` 가 buttonConfig 복원에 실패하면 `NodeOutputContext` 로
 * fallthrough 한다). backend `ExecutionStatusDto.context`(`ButtonsContextDto | NodeOutputContextDto`)
 * 미러. [EIA §5.3](../../../../spec/5-system/14-external-interaction-api.md) ·
 * [Swagger 규약 §1-4](../../../../spec/conventions/swagger.md).
 */
export type WaitingContext = ButtonsContext | NodeOutputContext;

/**
 * GET /api/external/executions/:id 단발 상태 조회 응답 (EIA §5.3 / EIA-IN-04).
 * 전역 TransformInterceptor 봉투(`{ data }`) 언랩 후의 shape.
 */
export interface ExecutionStatus {
  id: string;
  workflowId?: string;
  status: string;
  /** waiting_for_input 시에만 실값. 그 외 `null`. 스칼라가 아니라 객체다 (백엔드 `CurrentNodeDto`). */
  currentNode?: {
    id: string;
    type: string;
    interactionType: ExternalInteractionType | null;
  } | null;
  /** waiting_for_input 시에만 실값. 그 외 `null`. 닫힌 2-variant union — 위 `WaitingContext` 참조. */
  context?: WaitingContext | null;
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
