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

export interface WaitingForInputEvent {
  type: "execution.waiting_for_input";
  node?: { id: string; type: string; interactionType: ExternalInteractionType };
  context?: {
    formConfig?: Record<string, unknown>;
    buttonConfig?: Record<string, unknown>;
    conversationConfig?: Record<string, unknown>;
    conversationThread?: ConversationThread;
  };
  seq?: number;
}

export interface AiMessageEvent {
  type: "execution.ai_message";
  text?: string;
  presentations?: Array<Record<string, unknown>>;
  seq?: number;
}

/** /interact 명령. retry_last_turn 은 외부 미지원(EIA-IN-02). */
export type InteractCommand =
  | { command: "submit_message"; nodeId?: string; message: string }
  | { command: "click_button"; nodeId?: string; buttonId: string }
  | { command: "submit_form"; nodeId?: string; data: Record<string, unknown> }
  | { command: "end_conversation"; nodeId?: string; reason?: string }
  | { command: "cancel"; reason?: string };
