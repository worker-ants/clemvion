// SSE 이벤트(wire 형태) → 위젯 도메인 매핑. 순수 함수라 단위 테스트로 필드 매핑 회귀를 고정한다.
// SoT: 백엔드 execution-engine 가 emit 하는 wire envelope (sse-adapter 가 raw 전송) — 프론트엔드 store 와 동일.
// EIA §6.2 notification 형태(`node.id`/`context.*`)가 아님에 주의.

import type {
  AiMessageEvent,
  ConversationThread,
  ExecutionMessageEvent,
  ExternalInteractionType,
  WaitingForInputEvent,
} from "./eia-types";

export interface ParsedWaiting {
  /** interactionType 결정 우선순위: top-level → nodeOutput.interactionType → "ai_conversation" */
  type: ExternalInteractionType;
  /**
   * interactionType 별 config shape:
   * - ai_conversation: `nodeOutput.conversationConfig`
   * - buttons: `buttonConfig`
   * - form: `nodeOutput.formConfig` (있을 때) 또는 `nodeOutput` 자체 (formConfig 없는 wire)
   */
  config?: Record<string, unknown>;
  /** submit_message 명령의 nodeId 로 그대로 사용 — backend 가 요구하는 waitingNodeId. */
  nodeId?: string;
  /** AI multi-turn 대화 히스토리 스레드 (선택). */
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
        ? // form: nodeOutput.formConfig 우선, 없으면 nodeOutput 자체가 form 선언
          (ev.nodeOutput?.formConfig ?? ev.nodeOutput)
        : ev.nodeOutput?.conversationConfig;
  return {
    type,
    config: config as Record<string, unknown> | undefined,
    nodeId: ev.waitingNodeId,
    conversationThread: ev.conversationThread,
  };
}

export interface ParsedAiMessage {
  /** 어시스턴트 텍스트 — wire 의 `message` 필드(not `text`). 없으면 빈 문자열. */
  text: string;
  /** carousel/table/chart/template presentation 페이로드. 빈 배열은 undefined 로 정규화. */
  presentations?: Array<Record<string, unknown>>;
}

/** `execution.ai_message`(wire) → 말풍선. 어시스턴트 텍스트는 `message`(not `text`). */
export function parseAiMessage(ev: AiMessageEvent): ParsedAiMessage {
  const presentations =
    Array.isArray(ev.presentations) && ev.presentations.length ? ev.presentations : undefined;
  return { text: ev.message ?? "", presentations };
}

export interface ParsedMessage {
  /**
   * carousel/table/chart/template presentation 페이로드. 빈 배열은 undefined 로 정규화.
   * `ParsedAiMessage.presentations` 와 **동일 규약**(`{config, output}` envelope 배열) — shape/정규화
   * 변경 시 양쪽을 함께 갱신한다.
   */
  presentations?: Array<Record<string, unknown>>;
}

/**
 * `execution.message`(wire) → presentation-only 말풍선. 표시-전용 presentation 노드가 버튼 없이
 * 자동 진행 완료할 때 백엔드가 발행한다. `presentations[i]` 는 `{ config, output }` envelope 로,
 * `parseAiMessage` 와 동일하게 그대로 통과시켜 위젯 presentation 렌더 경로를 재사용한다.
 * 텍스트 필드는 없다 — template 의 본문도 `presentations[0].output.rendered` 안에 있다.
 */
export function parseMessage(ev: ExecutionMessageEvent): ParsedMessage {
  const presentations =
    Array.isArray(ev.presentations) && ev.presentations.length ? ev.presentations : undefined;
  return { presentations };
}
