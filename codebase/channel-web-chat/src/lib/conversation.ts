// conversation 렌더 규약 (필수). SoT: spec/conventions/conversation-thread §9.4·§9.5,
// spec/7-channel-web-chat/1-widget-app §2.
// - 1차 소스 = waiting_for_input.conversationThread.turns snapshot (ai_message.messages[] raw 직접 노출 금지).
// - 표시 전 [user-input]…[/user-input] 마커 strip.
// - turn.source(백엔드 5값)→말풍선 role 축약: presentation_user·ai_user→user, 그 외→assistant (roleOf).
//   명시 turn.role 이 있으면 그것이 우선(라이브 dispatch·구형 fixture 호환).

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

/**
 * 사용자 발화로 취급하는 백엔드 `ConversationTurnSource`(WS §4.4.5 / conversation-thread §1.1):
 * form/carousel 등 presentation 제출(`presentation_user`)과 AI 대화의 사용자 turn(`ai_user`).
 * 그 외(`ai_assistant`/`ai_tool`/`system`, 또는 미상)는 assistant 측으로 본다. (명시 `role` 이 있으면
 * roleOf 가 이 매핑보다 우선하므로, wire 에 존재하지 않는 리터럴을 방어적으로 넣지 않는다.)
 */
const USER_TURN_SOURCES = new Set<TurnSource>(["presentation_user", "ai_user"]);

/**
 * turn → 말풍선 role. 명시 `role`(라이브 dispatch·구형 fixture) 이 있으면 우선하고, 없으면 wire
 * `source`(백엔드 5값)를 user/assistant 로 축약한다 — 새로고침 복원 thread 는 `role` 없이
 * source 만 실려 오므로(EIA getStatus / SSE waiting) 이 매핑이 없으면 전부 assistant 로 렌더된다.
 * 매핑 SoT: spec/7-channel-web-chat/1-widget-app §2.
 */
function roleOf(turn: ConversationTurn): "user" | "assistant" {
  if (turn.role) return turn.role;
  if (turn.source && USER_TURN_SOURCES.has(turn.source)) return "user";
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
