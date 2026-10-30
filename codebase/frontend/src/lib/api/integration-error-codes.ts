import type { AxiosError } from "axios";
import type { TFunction, TranslationKey } from "@/lib/i18n";
import { formatDate } from "@/lib/utils/date";
import {
  extractApiCode,
  extractApiDetails,
  extractApiMessage,
  type ApiErrorBody,
} from "./errors";

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
  /**
   * `oauth/begin`(`new`)이 다시 쓸 설치 대기 행이 남의 개인 통합이다. `details.pendingInstallExpiresAt` 에 설치 기한이
   * 온다. NERV CLE-INT-OAUTH 「설치 대기 행 재사용의 권한」.
   */
  CAFE24_INSTALL_PENDING_BY_OTHER: "CAFE24_PRIVATE_APP_INSTALL_PENDING",
  MAKESHOP_INSTALL_PENDING_BY_OTHER: "MAKESHOP_INSTALL_PENDING",
  /** 역할 하한 거부. 코드를 고르는 규칙은 NERV CLE-INT-MANAGE 「권한」. */
  EDITOR_REQUIRED: "EDITOR_REQUIRED",
  ADMIN_REQUIRED: "ADMIN_REQUIRED",
  /**
   * 워크스페이스에 같은 이름의 통합이 있다. 생성 · 별칭 수정과 Cafe24 Private · MakeShop `oauth/begin` 이 낸다.
   * NERV CLE-INT-MANAGE 「에러 코드」.
   */
  NAME_TAKEN: "INTEGRATION_NAME_TAKEN",
  /** 통합을 만든 사람이 워크스페이스를 나가 조직 통합을 개인으로 바꿀 수 없다(REQ-INTMGMT-067). */
  OWNER_NOT_MEMBER: "INTEGRATION_OWNER_NOT_MEMBER",
} as const;

export type IntegrationLocalizedErrorCode =
  (typeof INTEGRATION_LOCALIZED_ERROR_CODES)[keyof typeof INTEGRATION_LOCALIZED_ERROR_CODES];

/** Backend 에러 코드 → 한글 primary 메시지 i18n 키. */
export const INTEGRATION_ERROR_CODE_TO_I18N: Readonly<
  Record<IntegrationLocalizedErrorCode, TranslationKey>
> = {
  [INTEGRATION_LOCALIZED_ERROR_CODES.CAFE24_DUPLICATE_MALL]:
    "integrations.cafe24DuplicateMallToast",
  [INTEGRATION_LOCALIZED_ERROR_CODES.CAFE24_INSTALL_PENDING_BY_OTHER]:
    "integrations.cafe24InstallPendingByOtherToast",
  [INTEGRATION_LOCALIZED_ERROR_CODES.MAKESHOP_INSTALL_PENDING_BY_OTHER]:
    "integrations.makeshopInstallPendingByOtherToast",
  [INTEGRATION_LOCALIZED_ERROR_CODES.EDITOR_REQUIRED]:
    "integrations.editorRequiredToast",
  [INTEGRATION_LOCALIZED_ERROR_CODES.ADMIN_REQUIRED]:
    "integrations.adminRequiredToast",
  [INTEGRATION_LOCALIZED_ERROR_CODES.NAME_TAKEN]: "integrations.nameTakenToast",
  [INTEGRATION_LOCALIZED_ERROR_CODES.OWNER_NOT_MEMBER]:
    "integrations.ownerNotMemberToast",
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

/**
 * 오류 응답에서 코드 · 메시지 · details 를 꺼낸다. 응답 본문을 읽는 규칙(전역 예외 필터의 `{error:{code,message,details}}`
 * 래핑과 평탄한 `{code,message}`)은 `lib/api/errors.ts` 의 `extract*` 헬퍼가 갖는다.
 * `serverMessage` 는 응답 본문의 문구, `errorMessage` 는 axios 같은 오류 객체 자체의 문구다.
 */
function readIntegrationError(err: unknown): {
  code?: string;
  serverMessage?: string;
  errorMessage?: string;
  details?: unknown;
} {
  // 호출자는 axios 오류 말고 응답 모양만 맞춘 객체나 Error 도 넘긴다. `extract*` 는 `response?.data` 만 읽는다.
  const e = (err ?? {}) as AxiosError<ApiErrorBody>;
  return {
    code: extractApiCode(e),
    serverMessage: extractApiMessage(e),
    errorMessage: e.message,
    details: extractApiDetails(e),
  };
}

/** 이름 충돌(`INTEGRATION_NAME_TAKEN`) 응답인지 본다. 통합 추가 화면이 이름 칸에 오류를 보일 때 쓴다. */
export function isIntegrationNameTaken(err: unknown): boolean {
  return (
    readIntegrationError(err).code ===
    INTEGRATION_LOCALIZED_ERROR_CODES.NAME_TAKEN
  );
}

/** 설치 대기 409 의 `details.pendingInstallExpiresAt`. 없거나 문자열이 아니면 `null`. */
function pendingInstallExpiresAt(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const value = (details as { pendingInstallExpiresAt?: unknown })
    .pendingInstallExpiresAt;
  return typeof value === "string" && value ? value : null;
}

/**
 * 통합 API 오류를 토스트 문구로 바꾼다. 매핑에 있는 코드는 번역 문구를 앞에 두고 서버 문구를 괄호에 둔다.
 * 설치 대기 409 는 설치 기한을 화면 시각으로 붙인다. 매핑에 없는 코드는 서버 문구, 오류 객체의 문구,
 * `fallbackKey` 순으로 고른다.
 */
export function formatIntegrationErrorToast(
  err: unknown,
  t: TFunction,
  fallbackKey: TranslationKey,
): string {
  const { code, serverMessage, errorMessage, details } =
    readIntegrationError(err);
  const mappedKey = getIntegrationErrorI18nKey(code);
  if (!mappedKey) return serverMessage ?? errorMessage ?? t(fallbackKey);
  const expiresAt = pendingInstallExpiresAt(details);
  const primary = expiresAt
    ? `${t(mappedKey)} ${t("integrations.retryAfterPendingInstallExpiry", {
        expiresAt: formatDate(expiresAt, "datetime"),
      })}`
    : t(mappedKey);
  return serverMessage ? `${primary} (${serverMessage})` : primary;
}
