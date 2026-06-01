// 위젯 상태기계 reducer. SoT: spec/7-channel-web-chat/1-widget-app §3·§3.1.
// phase: collapsed → (open) panel → (첫 입력) booting → streaming ↔ awaiting_user_message → ended.

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
  messages: DisplayMessage[];
  pending: PendingInteraction | null;
  unread: number;
  executionId?: string;
  error?: string;
}

export const initialState: WidgetState = {
  phase: "collapsed",
  open: false,
  messages: [],
  pending: null,
  unread: 0,
};

export type WidgetAction =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "START"; userText: string }
  | { type: "RESTORED"; executionId: string }
  | { type: "BOOTED"; executionId: string }
  | { type: "WAITING"; interaction: PendingInteraction; threadMessages?: DisplayMessage[] }
  | { type: "AI_MESSAGE"; text: string }
  | { type: "USER_MESSAGE"; text: string }
  | { type: "ENDED"; reason?: string }
  | { type: "ERROR"; message: string }
  | { type: "BLOCKED"; reason?: string }
  | { type: "NEW_CHAT" };

function assistantMsg(text: string): DisplayMessage {
  return { role: "assistant", text, source: "live" };
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
      return {
        ...state,
        phase: "booting",
        open: true,
        messages: [...state.messages, userMsg(action.userText)],
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
        messages: [...state.messages, assistantMsg(action.text)],
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
