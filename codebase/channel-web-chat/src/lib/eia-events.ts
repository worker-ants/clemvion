// SSE 이벤트(wire 형태) → 위젯 도메인 매핑. 순수 함수라 단위 테스트로 필드 매핑 회귀를 고정한다.
// SoT: 백엔드 execution-engine 가 emit 하는 wire envelope (sse-adapter 가 raw 전송) — 프론트엔드 store 와 동일.
// EIA §6.2 notification 형태(`node.id`/`context.*`)가 아님에 주의.

import type {
  AiMessageEvent,
  ConversationThread,
  ExternalInteractionType,
  WaitingForInputEvent,
} from "./eia-types";

export interface ParsedWaiting {
  type: ExternalInteractionType;
  config?: Record<string, unknown>;
  nodeId?: string;
  conversationThread?: ConversationThread;
}

/**
 * `execution.waiting_for_input`(wire) → pending interaction.
 * - nodeId: `waitingNodeId` (submit_message 의 nodeId 로 그대로 사용 — backend 가 요구)
 * - type: top-level `interactionType` (fallback `nodeOutput.interactionType`)
 * - config: ai_conversation → `nodeOutput.conversationConfig`, buttons → `buttonConfig`,
 *   form → `nodeOutput.formConfig ?? nodeOutput`
 */
export function parseWaitingForInput(ev: WaitingForInputEvent): ParsedWaiting {
  const type = (ev.interactionType ??
    ev.nodeOutput?.interactionType ??
    "ai_conversation") as ExternalInteractionType;
  const config =
    type === "buttons"
      ? ev.buttonConfig
      : type === "form"
        ? (ev.nodeOutput?.formConfig ?? ev.nodeOutput)
        : ev.nodeOutput?.conversationConfig;
  return {
    type,
    config: config as Record<string, unknown> | undefined,
    nodeId: ev.waitingNodeId,
    conversationThread: ev.conversationThread,
  };
}

export interface ParsedAiMessage {
  text: string;
  presentations?: Array<Record<string, unknown>>;
}

/** `execution.ai_message`(wire) → 말풍선. 어시스턴트 텍스트는 `message`(not `text`). */
export function parseAiMessage(ev: AiMessageEvent): ParsedAiMessage {
  const presentations =
    Array.isArray(ev.presentations) && ev.presentations.length ? ev.presentations : undefined;
  return { text: ev.message ?? "", presentations };
}
