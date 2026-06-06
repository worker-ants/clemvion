// 위젯 상태기계 reducer. SoT: spec/7-channel-web-chat/1-widget-app §3·§3.1.
// phase: collapsed → (open) booting(eager 시작) → streaming ↔ awaiting_user_message → ended.
// 워크플로우는 패널 open 시 시작한다(eager, §R6) — 첫 사용자 입력을 기다리지 않으며 firstMessage 미사용.

import type { DisplayMessage } from "./conversation";
import type { ExternalInteractionType } from "./eia-types";

export type WidgetPhase =
  | "collapsed"
  | "panel"
  | "booting"
  | "streaming"
  | "awaiting_user_message"
  | "ended"
  // 임베드 allowlist soft 검증 실패 — 렌더/시작 거부(4-security §3-①).
  | "blocked";

export interface PendingInteraction {
  type: ExternalInteractionType;
  config?: Record<string, unknown>;
  nodeId?: string;
}

export interface WidgetState {
  phase: WidgetPhase;
  /** 패널 가시성. close 해도 대화(phase)는 유지(§3.1). */
  open: boolean;
  /**
   * 위젯(런처) 가시성 — host `hide`/`show` 로 토글하는 **open/close 와 직교한 축**(§3.2).
   * `hidden` 이면 런처+패널 모두 미렌더(대화·SSE 는 유지). `blocked`(정책 거부)와 달리 host 가 복구 가능.
   */
  hidden: boolean;
  messages: DisplayMessage[];
  pending: PendingInteraction | null;
  unread: number;
  executionId?: string;
  error?: string;
}

export const initialState: WidgetState = {
  phase: "collapsed",
  open: false,
  hidden: false,
  messages: [],
  pending: null,
  unread: 0,
};

export type WidgetAction =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  /** I11: eager 시작(§R6) — open 시 발행. userText 없음. phase → booting. */
  | { type: "START" }
  | { type: "RESTORED"; executionId: string }
  | { type: "BOOTED"; executionId: string }
  | { type: "WAITING"; interaction: PendingInteraction; threadMessages?: DisplayMessage[] }
  | { type: "AI_MESSAGE"; text: string; presentations?: Array<Record<string, unknown>> }
  | { type: "USER_MESSAGE"; text: string }
  | { type: "ENDED"; reason?: string }
  | { type: "ERROR"; message: string }
  | { type: "BLOCKED"; reason?: "origin_not_allowed" | string }
  | { type: "SHOW" }
  | { type: "HIDE" }
  | { type: "NEW_CHAT" };

function assistantMsg(
  text: string,
  presentations?: Array<Record<string, unknown>>,
): DisplayMessage {
  return {
    role: "assistant",
    text,
    source: "live",
    presentations: presentations?.length ? presentations : undefined,
  };
}
function userMsg(text: string): DisplayMessage {
  return { role: "user", text, source: "live" };
}

export function widgetReducer(state: WidgetState, action: WidgetAction): WidgetState {
  switch (action.type) {
    case "OPEN":
      return {
        ...state,
        open: true,
        unread: 0,
        phase: state.phase === "collapsed" ? "panel" : state.phase,
      };
    case "CLOSE":
      return { ...state, open: false, phase: state.phase === "panel" ? "collapsed" : state.phase };
    case "START":
      // eager 시작(패널 open 시) — 사용자 입력/메시지 없이 execution 만 시작(§R6).
      return {
        ...state,
        phase: "booting",
        open: true,
        pending: null,
      };
    case "RESTORED":
      return { ...state, executionId: action.executionId, phase: "streaming" };
    case "BOOTED":
      return { ...state, executionId: action.executionId, phase: "streaming" };
    case "WAITING":
      return {
        ...state,
        phase: "awaiting_user_message",
        pending: action.interaction,
        messages: action.threadMessages
          ? mergeMessages(state.messages, action.threadMessages)
          : state.messages,
      };
    case "AI_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, assistantMsg(action.text, action.presentations)],
        // 패널 닫힌 채 도착한 in-flight 메시지 → unread(N4).
        unread: state.open ? state.unread : state.unread + 1,
      };
    case "USER_MESSAGE":
      return {
        ...state,
        phase: "streaming",
        pending: null,
        messages: [...state.messages, userMsg(action.text)],
      };
    case "ENDED":
      return { ...state, phase: "ended", pending: null };
    case "ERROR":
      return { ...state, phase: "ended", pending: null, error: action.message };
    case "BLOCKED":
      // 임베드 허용 안 된 호스트 — 위젯을 띄우지 않는다(렌더 거부 + 시작 차단).
      return {
        ...state,
        phase: "blocked",
        open: false,
        pending: null,
        error: action.reason,
      };
    case "HIDE":
      // 위젯(런처) 자체를 페이지에서 숨김 — 대화 phase·open 은 그대로 유지(§3.2).
      return { ...state, hidden: true };
    case "SHOW":
      return { ...state, hidden: false };
    case "NEW_CHAT":
      return {
        ...initialState,
        open: true,
        phase: "panel",
      };
    default:
      return state;
  }
}

/** thread snapshot 과 로컬 메시지를 합치되 중복(동일 role+text 연속)을 회피. */
function mergeMessages(local: DisplayMessage[], snapshot: DisplayMessage[]): DisplayMessage[] {
  if (snapshot.length >= local.length) return snapshot;
  return local;
}
