import type { TranslationKey } from "@/lib/i18n";

/**
 * Backend integration 에러 코드 중 frontend 가 도메인-aware 메시지로 remap 하는
 * 화이트리스트. 각 코드는 한글 primary 메시지 (i18n 키) 와 매핑되며,
 * `formatErrorToast` 등 toast 헬퍼가 본 매핑을 조회한다 — backend 의 영문
 * `message` 는 (괄호) 안 보조 정보로 노출.
 *
 * 새 매핑 추가 시:
 *   1. INTEGRATION_LOCALIZED_ERROR_CODES 에 의미 기반 alias + 실제 backend 코드
 *   2. INTEGRATION_ERROR_CODE_TO_I18N 에 i18n 키 추가 (ko/en parity 유지)
 *   3. 호출자(`formatErrorToast` 등)는 본 모듈만 import — 코드 문자열을
 *      컴포넌트에 직접 박지 않는다 (ai-review W11 — 2026-05-16).
 *
 * spec/2-navigation/4-integration.md §9.4 (errors).
 */
export const INTEGRATION_LOCALIZED_ERROR_CODES = {
  /**
   * 동일 (workspaceId, mall_id) cafe24 통합이 이미 존재 — app_type 무관.
   * 코드 이름의 `PRIVATE` 토큰은 historical artifact (2026-05-15 신설 당시
   * Private 흐름 한정이었음). spec/2-navigation/4-integration.md §9.4
   * Rationale "CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드명 유지 결정" 참조.
   */
  CAFE24_DUPLICATE_MALL: "CAFE24_PRIVATE_APP_ALREADY_CONNECTED",
} as const;

export type IntegrationLocalizedErrorCode =
  (typeof INTEGRATION_LOCALIZED_ERROR_CODES)[keyof typeof INTEGRATION_LOCALIZED_ERROR_CODES];

/** Backend 에러 코드 → 한글 primary 메시지 i18n 키. */
export const INTEGRATION_ERROR_CODE_TO_I18N: Readonly<
  Record<IntegrationLocalizedErrorCode, TranslationKey>
> = {
  [INTEGRATION_LOCALIZED_ERROR_CODES.CAFE24_DUPLICATE_MALL]:
    "integrations.cafe24DuplicateMallToast",
};

/**
 * Backend 에러 응답에서 `code` 를 꺼내 매핑된 i18n 키를 반환.
 * 매핑 없는 코드면 `null` 반환 — 호출자는 fallback 처리.
 */
export function getIntegrationErrorI18nKey(
  errorCode: string | null | undefined,
): TranslationKey | null {
  if (!errorCode) return null;
  if (Object.prototype.hasOwnProperty.call(INTEGRATION_ERROR_CODE_TO_I18N, errorCode)) {
    return INTEGRATION_ERROR_CODE_TO_I18N[
      errorCode as IntegrationLocalizedErrorCode
    ];
  }
  return null;
}
