"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { getWsClient } from "./ws-client";
import type { WsClient } from "./ws-client";
import { useExecutionStore } from "../stores/execution-store";

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

interface InteractionAck {
  success: boolean;
  error?: string;
}

/**
 * Emit a command and listen for its ack event exactly once. The gateway
 * replies with `{ event, data: { success, error? } }` — NestJS surfaces this
 * to the client as `socket.on(event, data)`, not as a Socket.IO ack callback,
 * so we attach a one-shot listener.
 *
 * Each interaction command is gated by the user (one in-flight at a time —
 * the UI disables further input until the AI response arrives), so a single
 * one-shot ack listener is enough to match the latest emit.
 */
function emitWithAck(
  ws: WsClient,
  event: string,
  data: unknown,
  ackEvent: string,
  onFailure: (error: string) => void,
): void {
  ws.once(ackEvent, (...args: unknown[]) => {
    const response = args[0] as InteractionAck | undefined;
    if (response && response.success === false) {
      onFailure(response.error ?? "Unknown error");
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
   *    ack 실패 시 `toast.error(error)` 표시.
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
   * SoT: spec/5-system/6-websocket-protocol.md §4.2 +
   * spec/conventions/conversation-thread.md §9.10 CT-S11.
   *
   * Distinct from workflow Re-run (§13 replay-rerun) — this stays inside
   * the same Execution and only re-attempts the last failed LLM turn.
   *
   * On failure (3 error codes — RETRY_STATE_NOT_FOUND /
   * NODE_NOT_RETRYABLE / RETRY_TOO_EARLY) shows a localized toast.
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
        (error) => {
          // Server rejected. `sendMessage` 와 평행으로 spinner 만 해제 +
          // toast. optimistic presentation_user 는 유지 (사용자가 제출한
          // 내용 가시화 — 재시도 안내 차원). spec §Rationale.
          setWaitingAiResponse(false);
          toast.error(error);
        },
      );
    },
    [executionId, addConversationMessage, setWaitingAiResponse],
  );

  const clickButton = useCallback(
    (buttonId: string) => {
      if (!executionId) return;
      emitWithAck(
        getWsClient(),
        "execution.click_button",
        { executionId, buttonId },
        "execution.click_button.ack",
        (error) => toast.error(error),
      );
    },
    [executionId],
  );

  const clickContinue = useCallback(() => {
    if (!executionId) return;
    emitWithAck(
      getWsClient(),
      "execution.click_button",
      { executionId, buttonId: CONTINUE_BUTTON_ID },
      "execution.click_button.ack",
      (error) => toast.error(error),
    );
  }, [executionId]);

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
        (error) => {
          // Server rejected the message (oversize / no pending continuation /
          // not authorised). Release the "AI is responding" indicator so the
          // user can retry instead of staring at a frozen spinner.
          setWaitingAiResponse(false);
          toast.error(error);
        },
      );
    },
    [executionId, addConversationMessage, setWaitingAiResponse],
  );

  const endConversation = useCallback(
    (nodeId: string) => {
      if (!executionId) return;
      emitWithAck(
        getWsClient(),
        "execution.end_conversation",
        { executionId, nodeId },
        "execution.end_conversation.ack",
        (error) => toast.error(error),
      );
    },
    [executionId],
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
        (error) => {
          setWaitingAiResponse(false);
          toast.error(error);
        },
      );
    },
    [executionId, setWaitingAiResponse],
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
