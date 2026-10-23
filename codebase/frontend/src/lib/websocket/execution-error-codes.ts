import type { TranslationKey } from "@/lib/i18n";

/**
 * Continuation ack 의 평면 `errorCode`(backend `ErrorCode` enum / 시스템 코드)를
 * frontend 의 localized 메시지(i18n 키)로 remap 하는 화이트리스트.
 *
 * 계약 (spec/5-system/4-execution-engine.md §7.5.2): backend 는 **안정 code +
 * 고정 client-safe 영문 message** 만 보내고, frontend 가 code→i18n key 로 localize
 * 한다. 매핑 없는 code 는 `null` → 호출자가 backend 의 영문 `error` 문자열로 graceful
 * fallback (닫힌 enum 으로 단정하지 않는 관례 — `integration-error-codes.ts` 선례).
 *
 * 새 매핑 추가 시: 본 맵 + `executions.interactionError.*` 키(ko/en parity) 동시 갱신.
 */
export const EXECUTION_INTERACTION_ERROR_CODE_TO_I18N: Readonly<
  Record<string, TranslationKey>
> = {
  // publisher 측 사전 검증 — 더 이상 입력 대기 상태가 아님 (§7.5.1).
  INVALID_EXECUTION_STATE: "executions.interactionError.invalidState",
  // submit_message 길이 초과 (§7.5.2 typed MessageTooLongError).
  EXECUTION_MESSAGE_TOO_LONG: "executions.interactionError.messageTooLong",
  // typed 가 아닌 내부 에러의 generic fallback — 내부 message 는 서버 로그 전용 (§7.5.2).
  EXECUTION_INTERNAL_ERROR: "executions.interactionError.internalError",
};

/**
 * 마지막 턴 재시도(`execution.retry_last_turn`) 실패 ack 의 중첩 `error.code` →
 * i18n 키 (`CLE-API-WS-EVENTS` 「마지막 턴 재시도」 표의 코드).
 *
 * 재개 명령 넷의 맵과 따로 둔다. 코드 출처가 셋(`WsErrorCode` · `ErrorCode` 의
 * `RETRY_*` · `InvalidExecutionStateError`)이고, 같은 `INVALID_EXECUTION_STATE` 라도
 * 기대 상태가 달라(재개는 입력 대기, 재시도는 `failed`) 문구가 다르다. 그
 * 에러의 고정 영문 message 도 재개용 문장("not waiting for input")이다.
 * 매핑 없는 code 는 `null` 이고 호출자가 백엔드 `message` 나 일반 실패 문구로 떨어진다.
 */
export const RETRY_LAST_TURN_ERROR_CODE_TO_I18N: Readonly<
  Record<string, TranslationKey>
> = {
  UNAUTHENTICATED: "editor.conversation.systemErrorRetryFailedUnauthenticated",
  NOT_FOUND: "editor.conversation.systemErrorRetryFailedExecutionNotFound",
  RETRY_STATE_NOT_FOUND: "editor.conversation.systemErrorRetryFailedStateExpired",
  NODE_NOT_RETRYABLE: "editor.conversation.systemErrorRetryFailedNodeNotRetryable",
  RETRY_TOO_EARLY: "editor.conversation.systemErrorRetryFailedTooEarly",
  INVALID_EXECUTION_STATE: "editor.conversation.systemErrorRetryFailedInvalidState",
  // 큐 적재 실패 · typed 가 아닌 예외. `_retryState` 는 이미 소비됐으므로 같은 명령을
  // 다시 보내면 `RETRY_STATE_NOT_FOUND` 가 온다. 다시 누르라고 안내하지 않고 워크플로우
  // 재실행을 안내한다(`CLE-API-WS-EVENTS` 「마지막 턴 재시도」 `INTERNAL_ERROR` 행).
  INTERNAL_ERROR: "editor.conversation.systemErrorRetryFailedInternal",
};

function lookupI18nKey(
  map: Readonly<Record<string, TranslationKey>>,
  code: string | null | undefined,
): TranslationKey | null {
  // ack 는 소켓에서 온 값이라 선언 타입과 다를 수 있어 문자열일 때만 조회한다.
  if (typeof code !== "string" || code === "") return null;
  return Object.prototype.hasOwnProperty.call(map, code) ? map[code] : null;
}

/**
 * continuation ack 의 `errorCode` 를 매핑된 i18n 키로 반환. 매핑 없으면 `null`
 * (호출자는 backend 의 영문 `error` 문자열로 fallback).
 */
export function getExecutionInteractionErrorI18nKey(
  errorCode: string | null | undefined,
): TranslationKey | null {
  return lookupI18nKey(EXECUTION_INTERACTION_ERROR_CODE_TO_I18N, errorCode);
}

/**
 * `retry_last_turn` 실패 ack 의 `error.code` 를 매핑된 i18n 키로 반환. 매핑 없으면 `null`.
 */
export function getRetryLastTurnErrorI18nKey(
  code: string | null | undefined,
): TranslationKey | null {
  return lookupI18nKey(RETRY_LAST_TURN_ERROR_CODE_TO_I18N, code);
}
