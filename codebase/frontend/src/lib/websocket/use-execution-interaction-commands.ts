"use client";

import { useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { getWsClient } from "./ws-client";
import type { WsClient } from "./ws-client";
import { useExecutionStore } from "../stores/execution-store";
import { executionsApi } from "../api/executions";
import {
  extractApiCode,
  extractApiMessage,
  type ApiErrorBody,
} from "../api/errors";
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
function isUserInitiatedTurn(m: { type: string }): m is { type: "user" } {
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
 * ack 이벤트 이름 → ack payload 타입. `emitWithAck` 가 이 표로 `onFailure` · `onSuccess`
 * 인자 타입을 정하므로 호출부가 ack 형태를 잘못 고를 수 없다.
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
 * REST `POST /executions/:id/continue` 실패를 토스트 문구로 바꾼다(CLE-T-5P1ADY).
 * 422 `INVALID_STATE` 는 WS `INVALID_EXECUTION_STATE` 와 같은 뜻이라 같은 지역화 문구를 쓴다.
 * 400 `VALIDATION_ERROR` 는 서버가 준 필드 검증 문구를 그대로 쓴다. 다시 고쳐 낼 수 있는
 * 오류라 어느 필드가 틀렸는지 알려야 한다. 그 밖(네트워크 · 5xx · 401/403/404)은 일반 실패 문구다.
 */
function localizeContinueRestError(t: TFunction, err: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(err)) {
    const code = extractApiCode(err);
    if (code === "INVALID_STATE") {
      return t("executions.interactionError.invalidState");
    }
    if (code === "VALIDATION_ERROR") {
      const message: unknown = extractApiMessage(err);
      if (typeof message === "string" && message.trim() !== "") return message;
    }
  }
  return t("executions.interactionError.internalError");
}

/**
 * 실시간 연결이 끊긴 동안 폼 값을 REST 로 보낸다(CLE-T-5P1ADY). 성공 응답은 접수만 뜻하므로
 * store 는 건드리지 않는다. 이어 진행된 상태는 폴링 응답이 `applyExecutionSnapshot` 으로 넣는다.
 * 실패하면 WS ack 실패처럼 응답 대기 표시를 끄고 토스트를 띄운다.
 *
 * 응답 대기 표시는 store 가 제출한 입력 대기(같은 실행 · 같은 `waitingNodeId`)에 그대로 있을
 * 때만 끈다. 그 사이 다른 실행으로 바뀌었거나 같은 실행이 다음 입력 대기로 넘어가 표시가 다시
 * 켜졌으면 그 표시는 이 제출의 것이 아니므로 두고 토스트만 띄운다.
 */
function submitFormOverRest(
  t: TFunction,
  executionId: string,
  waitingNodeId: string | null,
  formData: Record<string, unknown>,
): void {
  executionsApi
    .continueExecution(executionId, formData)
    .catch((err: unknown) => {
      const store = useExecutionStore.getState();
      if (
        store.executionId === executionId &&
        store.waitingNodeId === waitingNodeId
      ) {
        store.setWaitingAiResponse(false);
      }
      toast.error(localizeContinueRestError(t, err));
    });
}

/** 입력 대기 명령을 보낼 실행과 소켓. 소켓이 끊겨 있으면 `ws` 가 `null` 이다. */
interface CommandTarget {
  executionId: string;
  ws: WsClient | null;
}

/**
 * 입력 대기 명령의 전송 가드. 연결 여부는 여기서만 본다. 실행 ID 가 없으면 `null` 이다.
 * 폼은 `ws` 가 `null` 이면 REST 로 보내고, 그 밖의 명령은 `requireRealtime` 으로 막는다.
 */
function resolveCommandTarget(
  executionId: string | null | undefined,
): CommandTarget | null {
  if (!executionId) return null;
  const ws = getWsClient();
  return { executionId, ws: ws.isConnected() ? ws : null };
}

/**
 * 버튼 · 대화 · 재시도 명령의 공통 가드. 실행 ID 가 있고 소켓이 이어져 있을 때만 보낼 대상을
 * 돌려준다. 실행 ID 가 없으면 조용히 `null`, 소켓이 끊겼으면 안내 토스트와 `null` 이다
 * (CLE-T-5P1ADY). 이 명령들에는 REST 경로가 없다. 끊긴 채 보내면 Socket.IO 가 재연결까지
 * 버퍼에 쌓아 두므로 사용자는 보냈는지 알 수 없다.
 */
function requireRealtime(
  executionId: string | null | undefined,
  t: TFunction,
): { executionId: string; ws: WsClient } | null {
  const target = resolveCommandTarget(executionId);
  if (!target) return null;
  if (!target.ws) {
    toast.error(t("executions.realtimeRequiredForInput"));
    return null;
  }
  return { executionId: target.executionId, ws: target.ws };
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
 *
 * `onSuccess` 는 `success: true` ack 에서만 부른다. 지금은 마지막 턴 재시도만 쓴다.
 */
function emitWithAck<E extends keyof AckByEvent>(
  ws: WsClient,
  event: string,
  data: unknown,
  ackEvent: E,
  onFailure: (ack: AckByEvent[E]) => void,
  onSuccess?: (ack: AckByEvent[E]) => void,
): void {
  ws.once(ackEvent, (...args: unknown[]) => {
    const response = args[0] as AckByEvent[E] | undefined;
    if (response && response.success === false) {
      onFailure(response);
    } else if (response?.success === true) {
      onSuccess?.(response);
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
   *
   * 소켓이 끊겨 있으면 3 대신 REST `POST /executions/:id/continue` 로 보낸다(CLE-T-5P1ADY,
   * `submitFormOverRest`). 1 · 2 는 같다.
   *
   * 보냈으면 `true`, 실행 ID 가 없어 보내지 않았으면 `false` 다.
   */
  submitForm: (formData: Record<string, unknown>) => boolean;
  /**
   * Click a specific port-type button in a waiting buttons node.
   * 아래 넷과 같이 소켓이 끊겨 있으면 보내지 않고 안내 토스트를 띄운다(`requireRealtime`).
   * 보냈으면 `true` 다. 호출자는 `false` 면 입력 대기 표시를 풀지 않는다.
   */
  clickButton: (buttonId: string) => boolean;
  /** Bypass a buttons-waiting node using the `__continue__` sentinel. */
  clickContinue: () => boolean;
  /**
   * Append a user message and emit it to a live AI conversation node.
   * 보내지 않았으면(`false`) 메시지 항목도 응답 대기 표시도 남기지 않는다. 입력창은 글을 지우지 않는다.
   */
  sendMessage: (nodeId: string, message: string) => boolean;
  /** Gracefully terminate a live AI conversation node. */
  endConversation: (nodeId: string) => boolean;
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
   *
   * 성공 ack 면 store 에 재시도 대기를 남긴다(`markLastTurnRetryPending`). 실행은 재시도
   * 턴이 끝날 때까지 `failed` 라서 REST 폴링 대체 경로가 이 표시를 보고 폴링을 다시 켠다
   * (CLE-T-GKVH1B). ack 전에 store 가 다른 실행으로 바뀌었으면 남기지 않는다.
   */
  retryLastTurn: (nodeExecutionId: string) => boolean;
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
      const target = resolveCommandTarget(executionId);
      if (!target) return false;
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
      const { conversationMessages, waitingNodeId, nodeResults } =
        useExecutionStore.getState();
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
      if (!target.ws) {
        submitFormOverRest(t, target.executionId, waitingNodeId, formData);
        return true;
      }
      emitWithAck(
        target.ws,
        "execution.submit_form",
        { executionId: target.executionId, formData },
        "execution.form_submitted",
        (ack) => {
          // Server rejected. `sendMessage` 와 평행으로 spinner 만 해제 +
          // toast. optimistic presentation_user 는 유지 (사용자가 제출한
          // 내용 가시화 — 재시도 안내 차원). spec §Rationale.
          setWaitingAiResponse(false);
          toast.error(localizeContinuationAckError(t, ack));
        },
      );
      return true;
    },
    [executionId, addConversationMessage, setWaitingAiResponse, t],
  );

  const clickButton = useCallback(
    (buttonId: string) => {
      const target = requireRealtime(executionId, t);
      if (!target) return false;
      emitWithAck(
        target.ws,
        "execution.click_button",
        { executionId: target.executionId, buttonId },
        "execution.click_button.ack",
        (ack) => toast.error(localizeContinuationAckError(t, ack)),
      );
      return true;
    },
    [executionId, t],
  );

  const clickContinue = useCallback(() => {
    const target = requireRealtime(executionId, t);
    if (!target) return false;
    emitWithAck(
      target.ws,
      "execution.click_button",
      { executionId: target.executionId, buttonId: CONTINUE_BUTTON_ID },
      "execution.click_button.ack",
      (ack) => toast.error(localizeContinuationAckError(t, ack)),
    );
    return true;
  }, [executionId, t]);

  const sendMessage = useCallback(
    (nodeId: string, message: string) => {
      const target = requireRealtime(executionId, t);
      if (!target) return false;
      const { conversationMessages } = useExecutionStore.getState();
      addConversationMessage({
        type: "user",
        content: message,
        // W10: user 타입만 카운트 (isUserInitiatedTurn). submitForm 의
        // user|presentation 필터와 의도적 비대칭 — 주석 참고.
        turnIndex: conversationMessages.filter(isUserInitiatedTurn).length + 1,
        timestamp: new Date().toISOString(),
        // 이 로컬 optimistic 버블은 backend 의 `execution.user_message` echo
        // (서버 receivedAt) 와 dedup 키가 다르다. 플래그로 표시해 echo 핸들러
        // (appendOptimisticUserMessage) 가 중복 append 대신 reconcile 하게 한다
        // (ConversationItem.optimisticPending 주석 / 중복 버블 회귀 차단).
        optimisticPending: true,
      });
      setWaitingAiResponse(true);
      emitWithAck(
        target.ws,
        "execution.submit_message",
        { executionId: target.executionId, nodeId, message },
        "execution.submit_message.ack",
        (ack) => {
          // Server rejected the message (oversize / no pending continuation /
          // not authorised). Release the "AI is responding" indicator so the
          // user can retry instead of staring at a frozen spinner.
          setWaitingAiResponse(false);
          toast.error(localizeContinuationAckError(t, ack));
        },
      );
      return true;
    },
    [executionId, addConversationMessage, setWaitingAiResponse, t],
  );

  const endConversation = useCallback(
    (nodeId: string) => {
      const target = requireRealtime(executionId, t);
      if (!target) return false;
      emitWithAck(
        target.ws,
        "execution.end_conversation",
        { executionId: target.executionId, nodeId },
        "execution.end_conversation.ack",
        (ack) => toast.error(localizeContinuationAckError(t, ack)),
      );
      return true;
    },
    [executionId, t],
  );

  const retryLastTurn = useCallback(
    (nodeExecutionId: string) => {
      const target = requireRealtime(executionId, t);
      if (!target) return false;
      // optimistic — user 가 [다시 시도] 를 누르는 순간 spinner 노출.
      // ack 실패 시 release.
      setWaitingAiResponse(true);
      emitWithAck(
        target.ws,
        "execution.retry_last_turn",
        { executionId: target.executionId, nodeExecutionId },
        "execution.retry_last_turn.ack",
        (ack) => {
          setWaitingAiResponse(false);
          toast.error(localizeRetryAckError(t, ack));
        },
        () => {
          const store = useExecutionStore.getState();
          if (store.executionId !== target.executionId) return;
          store.markLastTurnRetryPending(nodeExecutionId);
        },
      );
      return true;
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
