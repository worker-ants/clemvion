"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { getWsClient } from "./ws-client";
import type { WsClient } from "./ws-client";
import { useExecutionStore } from "../stores/execution-store";
import { useT, type TFunction } from "@/lib/i18n";
import {
  getExecutionInteractionErrorI18nKey,
  getRetryLastTurnErrorI18nKey,
} from "./execution-error-codes";

/**
 * Sentinel buttonId recognised by the engine's button-interaction handler as
 * "proceed without picking a concrete button" — used for link-only buttons
 * where the user explicitly presses the Continue affordance.
 */
export const CONTINUE_BUTTON_ID = "__continue__";

/**
 * W10 (SUMMARY) — `sendMessage` 는 `user` 타입만, `submitForm` 은 `user` 와
 * `presentation` 타입 모두를 turnIndex 기준으로 계산. 두 함수의 비대칭 필터를
 * 명시하는 헬퍼. sendMessage 는 `isUserInitiatedTurn(m)` 으로, submitForm 은
 * 해당 함수 내부에 이미 인라인으로 처리돼 있다 — 그 의도를 타입 레벨에서 표현.
 *
 * Note: `sendMessage` 와 `submitForm` 의 turnIndex 필터가 의도적으로 다른 이유:
 * - `sendMessage`: AI 대화의 user 메시지 순번 → user 타입만 카운트.
 * - `submitForm`: presentation_user turn 을 추가하므로 user + presentation 모두
 *   카운트해야 correct turnIndex 를 부여할 수 있다.
 */
function isUserInitiatedTurn(
  m: { type: string },
): m is { type: "user" } {
  return m.type === "user";
}

/**
 * 재개 명령 넷(`submit_form` · `click_button` · `submit_message` · `end_conversation`)의
 * ack (`CLE-API-WS-EVENTS` 「재개 명령의 에러」). 실패하면 평면 `error` 문자열과 `errorCode` 를 싣는다.
 */
export interface ContinuationAck {
  success: boolean;
  error?: string;
  /**
   * 평면 client-safe 에러 코드 (4종 continuation 명령, `CLE-API-WS-EVENTS` 「재개 명령의 에러」). frontend 가
   * `execution-error-codes` 맵으로 localize 한다. retry 의 nested `error:{code}` 와 별개.
   */
  errorCode?: string;
}

/**
 * 마지막 턴 재시도(`retry_last_turn`)의 ack (`CLE-API-WS-EVENTS` 「마지막 턴 재시도」). 실패하면 재개
 * 명령 넷과 달리 중첩 `error: { code, message }` 를 싣는다.
 *
 * 두 ack 를 한 타입(`error?: string`)으로 두었을 때 이 객체가 `toast.error` 에 그대로
 * 넘어가 React 렌더 오류가 났고 타입 검사는 잡지 못했다(CLE-T-4BJ3KR). 나눠 두면 같은
 * 실수가 타입 오류로 드러난다. `executionId` · `nodeExecutionId` · `resumed` 도 오지만
 * 클라이언트가 읽지 않아 선언하지 않는다.
 */
export interface RetryLastTurnAck {
  success: boolean;
  error?: { code: string; message: string };
}

/**
 * ack 이벤트 이름 → ack payload 타입. `emitWithAck` 가 이 표로 `onFailure` 인자 타입을
 * 정하므로 호출부가 ack 형태를 잘못 고를 수 없다.
 */
interface AckByEvent {
  "execution.form_submitted": ContinuationAck;
  "execution.click_button.ack": ContinuationAck;
  "execution.submit_message.ack": ContinuationAck;
  "execution.end_conversation.ack": ContinuationAck;
  "execution.retry_last_turn.ack": RetryLastTurnAck;
}

/**
 * continuation ack 의 (error, errorCode) 를 localized 메시지로 변환한다 (`CLE-API-WS-EVENTS` 「재개 명령의 에러」).
 * 매핑된 code 면 localized i18n 메시지, 아니면 backend 의 영문 `error` 문자열로 fallback.
 * backend 는 typed error → 고정 client-safe message, plain error → generic fallback 만
 * 보내므로 `error` 문자열 자체에 내부 정보 누출은 없다.
 */
function localizeContinuationAckError(
  t: TFunction,
  ack: ContinuationAck,
): string {
  const key = getExecutionInteractionErrorI18nKey(ack.errorCode);
  return key ? t(key) : (ack.error ?? "Unknown error");
}

/**
 * `retry_last_turn` 실패 ack 의 중첩 `error` 를 토스트 문구로 바꾼다 (`CLE-API-WS-EVENTS` 「마지막 턴 재시도」).
 * 매핑된 `code` 면 지역화 문구, 아니면 백엔드의 영문 `message`, 그것도 없으면 일반
 * 실패 문구다. ack 는 소켓에서 온 값이라 선언 타입과 다를 수 있어 `message` 는
 * 문자열일 때만 쓴다. 어느 경로든 문자열을 돌려줘 토스트에 객체가 넘어가지 않는다.
 */
function localizeRetryAckError(t: TFunction, ack: RetryLastTurnAck): string {
  const key = getRetryLastTurnErrorI18nKey(ack.error?.code);
  if (key) return t(key);
  const message: unknown = ack.error?.message;
  if (typeof message === "string" && message.trim() !== "") return message;
  return t("editor.conversation.systemErrorRetryFailed");
}

/**
 * Emit a command and listen for its ack event exactly once. The gateway
 * replies with `{ event, data: { success, ... } }` — NestJS surfaces this
 * to the client as `socket.on(event, data)`, not as a Socket.IO ack callback,
 * so we attach a one-shot listener. The ack payload type follows the ack
 * event name (`AckByEvent`).
 *
 * Each interaction command is gated by the user (one in-flight at a time —
 * the UI disables further input until the AI response arrives), so a single
 * one-shot ack listener is enough to match the latest emit.
 */
function emitWithAck<E extends keyof AckByEvent>(
  ws: WsClient,
  event: string,
  data: unknown,
  ackEvent: E,
  onFailure: (ack: AckByEvent[E]) => void,
): void {
  ws.once(ackEvent, (...args: unknown[]) => {
    const response = args[0] as AckByEvent[E] | undefined;
    if (response && response.success === false) {
      onFailure(response);
    }
  });
  ws.emit(event, data);
}

export interface ExecutionInteractionCommands {
  /**
   * Submit a form waiting node's filled values and resume the execution.
   *
   * Side effects (optimistic UI):
   * 1. `addConversationMessage` — presentation_user turn (interactionType:
   *    'form_submitted') 을 chat thread 에 즉시 추가. WS 응답의 authoritative
   *    snapshot 이 도착하면 setConversationMessages 가 덮어씀 (dedup 자연 처리).
   * 2. `setWaitingAiResponse(true)` — AI 응답 인디케이터 활성. ack 실패 시
   *    `setWaitingAiResponse(false)` 로 해제 (spinner 만 해제, optimistic turn 유지).
   * 3. WS emit `execution.submit_form` → ack event `execution.form_submitted`.
   *    ack 실패 시 `localizeContinuationAckError` 로 지역화한 문구를 `toast.error` 로 표시.
   */
  submitForm: (formData: Record<string, unknown>) => void;
  /** Click a specific port-type button in a waiting buttons node. */
  clickButton: (buttonId: string) => void;
  /** Bypass a buttons-waiting node using the `__continue__` sentinel. */
  clickContinue: () => void;
  /** Append a user message and emit it to a live AI conversation node. */
  sendMessage: (nodeId: string, message: string) => void;
  /** Gracefully terminate a live AI conversation node. */
  endConversation: (nodeId: string) => void;
  /**
   * Re-enter a multi-turn AI Agent node that ended with retryable error by
   * spawning a new NodeExecution row from the persisted `_retryState`.
   *
   * SoT: `CLE-API-WS-EVENTS` 「마지막 턴 재시도」 + CLE-EXEC-PREVIEW CT-S11.
   *
   * Distinct from workflow Re-run (§13 replay-rerun) — this stays inside
   * the same Execution and only re-attempts the last failed LLM turn.
   *
   * On failure the ack carries a nested `error: { code, message }`. The codes
   * in the `CLE-API-WS-EVENTS` retry table map to localized toasts, an unmapped
   * code falls back to the backend `message`, then to a generic "retry failed"
   * string.
   */
  retryLastTurn: (nodeExecutionId: string) => void;
}

/**
 * Wraps WebSocket commands used to resume a `waiting_for_input` execution.
 * Also updates the conversation store for AI chat so the user's own message
 * appears immediately, mirroring how the editor's run-results drawer behaves.
 */
export function useExecutionInteractionCommands(
  executionId: string | null,
): ExecutionInteractionCommands {
  const addConversationMessage = useExecutionStore(
    (s) => s.addConversationMessage,
  );
  const setWaitingAiResponse = useExecutionStore((s) => s.setWaitingAiResponse);
  const t = useT();

  const submitForm = useCallback(
    (formData: Record<string, unknown>) => {
      if (!executionId) return;
      // 사용자 보고 (2026-05-23): "form submit 후 정상 동작 안 함" — root cause
      // 한 갈래는 `sendMessage` 와 달리 submitForm 이 optimistic UI 를 갱신하지
      // 않아 form 만 사라지고 0 frame visual feedback 이 없는 점. spec/4-nodes/
      // 6-presentation/0-common.md §Rationale (form submission wire format
      // wrap) — frontend 도 `sendMessage` 와 평행 패턴으로 (1) presentation_user
      // 임시 turn 을 chat 에 추가 (2) AI 응답 대기 인디케이터 활성화.
      // 백엔드의 authoritative presentation_user push 가 WS 로 도착하면
      // setConversationMessages 가 thread snapshot 으로 덮어쓴다 (dedup
      // 자연 발생, use-execution-events.ts §threadTurns).
      // W9 (SUMMARY): sendMessage 는 `const { conversationMessages }` 만 구조
      // 분해하지만, submitForm 은 waitingNodeId + nodeResults 도 필요 (form 노드
      // 메타를 presentation turn 에 채우기 위해). 의도적 패턴 차이 — 불일치 아님.
      const {
        conversationMessages,
        waitingNodeId,
        nodeResults,
      } = useExecutionStore.getState();
      const waitingNode = waitingNodeId
        ? nodeResults.find((n) => n.nodeId === waitingNodeId)
        : undefined;
      addConversationMessage({
        type: "presentation",
        content: "",
        presentation: {
          nodeLabel: waitingNode?.nodeLabel ?? "Form",
          nodeType: waitingNode?.nodeType ?? "form",
          interactionType: "form_submitted",
          data: formData,
        },
        // W4 (SUMMARY): turnIndex 는 getState() 호출 시점의 스냅샷. 연속
        // submitForm 호출 시 stale 할 수 있으나 sendMessage 와 동일 패턴으로
        // 의도된 동작 — WS 응답(setConversationMessages)이 authoritative thread
        // snapshot 으로 덮어쓰므로 optimistic 순번의 정확성은 낮은 우선순위.
        turnIndex:
          conversationMessages.filter(
            (m) => m.type === "user" || m.type === "presentation",
          ).length + 1,
        timestamp: new Date().toISOString(),
      });
      setWaitingAiResponse(true);
      emitWithAck(
        getWsClient(),
        "execution.submit_form",
        { executionId, formData },
        "execution.form_submitted",
        (ack) => {
          // Server rejected. `sendMessage` 와 평행으로 spinner 만 해제 +
          // toast. optimistic presentation_user 는 유지 (사용자가 제출한
          // 내용 가시화 — 재시도 안내 차원). spec §Rationale.
          setWaitingAiResponse(false);
          toast.error(localizeContinuationAckError(t, ack));
        },
      );
    },
    [executionId, addConversationMessage, setWaitingAiResponse, t],
  );

  const clickButton = useCallback(
    (buttonId: string) => {
      if (!executionId) return;
      emitWithAck(
        getWsClient(),
        "execution.click_button",
        { executionId, buttonId },
        "execution.click_button.ack",
        (ack) => toast.error(localizeContinuationAckError(t, ack)),
      );
    },
    [executionId, t],
  );

  const clickContinue = useCallback(() => {
    if (!executionId) return;
    emitWithAck(
      getWsClient(),
      "execution.click_button",
      { executionId, buttonId: CONTINUE_BUTTON_ID },
      "execution.click_button.ack",
      (ack) => toast.error(localizeContinuationAckError(t, ack)),
    );
  }, [executionId, t]);

  const sendMessage = useCallback(
    (nodeId: string, message: string) => {
      if (!executionId) return;
      const { conversationMessages } = useExecutionStore.getState();
      addConversationMessage({
        type: "user",
        content: message,
        // W10: user 타입만 카운트 (isUserInitiatedTurn). submitForm 의
        // user|presentation 필터와 의도적 비대칭 — 주석 참고.
        turnIndex:
          conversationMessages.filter(isUserInitiatedTurn).length + 1,
        timestamp: new Date().toISOString(),
        // 이 로컬 optimistic 버블은 backend 의 `execution.user_message` echo
        // (서버 receivedAt) 와 dedup 키가 다르다. 플래그로 표시해 echo 핸들러
        // (appendOptimisticUserMessage) 가 중복 append 대신 reconcile 하게 한다
        // (ConversationItem.optimisticPending 주석 / 중복 버블 회귀 차단).
        optimisticPending: true,
      });
      setWaitingAiResponse(true);
      emitWithAck(
        getWsClient(),
        "execution.submit_message",
        { executionId, nodeId, message },
        "execution.submit_message.ack",
        (ack) => {
          // Server rejected the message (oversize / no pending continuation /
          // not authorised). Release the "AI is responding" indicator so the
          // user can retry instead of staring at a frozen spinner.
          setWaitingAiResponse(false);
          toast.error(localizeContinuationAckError(t, ack));
        },
      );
    },
    [executionId, addConversationMessage, setWaitingAiResponse, t],
  );

  const endConversation = useCallback(
    (nodeId: string) => {
      if (!executionId) return;
      emitWithAck(
        getWsClient(),
        "execution.end_conversation",
        { executionId, nodeId },
        "execution.end_conversation.ack",
        (ack) => toast.error(localizeContinuationAckError(t, ack)),
      );
    },
    [executionId, t],
  );

  const retryLastTurn = useCallback(
    (nodeExecutionId: string) => {
      if (!executionId) return;
      // optimistic — user 가 [다시 시도] 를 누르는 순간 spinner 노출.
      // ack 실패 시 release.
      setWaitingAiResponse(true);
      emitWithAck(
        getWsClient(),
        "execution.retry_last_turn",
        { executionId, nodeExecutionId },
        "execution.retry_last_turn.ack",
        (ack) => {
          setWaitingAiResponse(false);
          toast.error(localizeRetryAckError(t, ack));
        },
      );
    },
    [executionId, setWaitingAiResponse, t],
  );

  return {
    submitForm,
    clickButton,
    clickContinue,
    sendMessage,
    endConversation,
    retryLastTurn,
  };
}
