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
 * continuation ack 의 `errorCode` 를 매핑된 i18n 키로 반환. 매핑 없으면 `null`
 * (호출자는 backend 의 영문 `error` 문자열로 fallback).
 */
export function getExecutionInteractionErrorI18nKey(
  errorCode: string | null | undefined,
): TranslationKey | null {
  if (!errorCode) return null;
  if (
    Object.prototype.hasOwnProperty.call(
      EXECUTION_INTERACTION_ERROR_CODE_TO_I18N,
      errorCode,
    )
  ) {
    return EXECUTION_INTERACTION_ERROR_CODE_TO_I18N[errorCode];
  }
  return null;
}
