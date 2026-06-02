// conversation 렌더 규약 (필수). SoT: spec/conventions/conversation-thread §9.4·§9.5,
// spec/7-channel-web-chat/1-widget-app §2.
// - 1차 소스 = waiting_for_input.conversationThread.turns snapshot (ai_message.messages[] raw 직접 노출 금지).
// - 표시 전 [user-input]…[/user-input] 마커 strip.
// - source 마커(live/injected)로 시각 분기.

import type { ConversationThread, ConversationTurn, TurnSource } from "./eia-types";

const USER_INPUT_MARKER = /\[\/?user-input\]/g;

/** LLM-facing prompt-injection 방어 마커를 표시용으로 제거. */
export function stripUserInputMarkers(text: string): string {
  return text.replace(USER_INPUT_MARKER, "");
}

export interface DisplayMessage {
  /** 'user' = 사용자 발화, 'assistant' = 봇. */
  role: "user" | "assistant";
  text: string;
  nodeLabel?: string;
  /** source 마커 — 누락 시 'live' 폴백(conversation-thread §4.4.6). */
  source: TurnSource;
  /** inline presentation 페이로드(carousel/table/chart/template). */
  presentations?: Array<Record<string, unknown>>;
}

function roleOf(turn: ConversationTurn): "user" | "assistant" {
  if (turn.role) return turn.role;
  // source 기반 휴리스틱: injected(system 주입) 는 assistant 측 컨텍스트로 본다.
  return "assistant";
}

/** conversationThread.turns → 표시 메시지. raw text 직접 노출 대신 strip+메타 분기.
 *  텍스트가 비어도 presentation 이 있으면 메시지로 포함(inline presentation 전용 turn). */
export function threadToMessages(thread: ConversationThread | undefined): DisplayMessage[] {
  if (!thread?.turns?.length) return [];
  return thread.turns
    .filter(
      (t) =>
        (typeof t.text === "string" && t.text.length > 0) ||
        (Array.isArray(t.presentations) && t.presentations.length > 0),
    )
    .map((t) => ({
      role: roleOf(t),
      text: typeof t.text === "string" ? stripUserInputMarkers(t.text) : "",
      nodeLabel: t.nodeLabel,
      source: (t.source as TurnSource) ?? "live", // 누락 시 live 폴백
      presentations: Array.isArray(t.presentations) ? t.presentations : undefined,
    }));
}
