import type { AxiosError } from "axios";
import type { TFunction, TranslationKey } from "@/lib/i18n";
import { extractApiCode, extractApiMessage, type ApiErrorBody } from "./errors";

/**
 * 서버 에러 코드 → 화면 문구 키. 서버 `message` 는 영문 고정 문구라 한국어 화면은 코드로 문구를 고른다
 * (NERV CLE-UI-I18N-BACKEND 규칙 5, Task CLE-T-MNX9KP · CLE-T-CHP94Z).
 *
 * 인증 · 세션 · 워크스페이스 가드처럼 여러 화면이 같은 뜻으로 받는 코드만 두고 키는 모두 `errors.codes.*` 다. 한
 * 화면에서만 다르게 읽어야 하는 코드는 그 화면이 `overrides` 로 먼저 고르고(예: 통합 화면의 역할 거부, 이메일 인증
 * · 비밀번호 재설정 화면의 `VALIDATION_ERROR`), 여기 없는 코드는 서버 문구를 그대로 보인다.
 *
 * 5xx 응답의 `message` 는 전역 예외 필터가 고정 문구로 바꾼다(NERV CLE-API-ERROR, Task CLE-T-KKJ2A0). 그래서
 * 작성자가 문구로 원인을 알리던 5xx 코드(`OAUTH_CONFIG_MISSING`)와 `INTERNAL_ERROR` 는 여기서 문구를 고른다.
 */
export const SERVER_ERROR_CODE_TO_I18N: Readonly<
  Record<string, TranslationKey>
> = {
  NOT_A_MEMBER: "errors.codes.notAMember",
  WORKSPACE_NOT_FOUND: "errors.codes.workspaceNotFound",
  EDITOR_REQUIRED: "errors.codes.editorRequired",
  ADMIN_REQUIRED: "errors.codes.adminRequired",
  OWNER_REQUIRED: "errors.codes.ownerRequired",
  PASSWORD_INVALID: "errors.codes.passwordInvalid",
  TOTP_INVALID: "errors.codes.totpInvalid",
  SESSION_NOT_FOUND: "errors.codes.sessionNotFound",
  CANNOT_REVOKE_CURRENT_SESSION: "errors.codes.cannotRevokeCurrentSession",
  CURRENT_SESSION_REQUIRED: "errors.codes.currentSessionRequired",
  REAUTH_NOT_AVAILABLE: "errors.codes.reauthNotAvailable",
  REAUTH_REQUIRED: "errors.codes.reauthRequired",
  TOTP_NOT_ENABLED: "errors.codes.totpNotEnabled",
  WEBAUTHN_REQUIRED: "errors.codes.webauthnRequired",
  CHALLENGE_METHOD_MISMATCH: "errors.codes.challengeMethodMismatch",
  WEBAUTHN_DISABLED: "errors.codes.webauthnDisabled",
  WEBAUTHN_NOT_REGISTERED: "errors.codes.webauthnNotRegistered",
  WEBAUTHN_COUNTER_REGRESSION: "errors.codes.webauthnCounterRegression",
  INVALID_OPTIONS_TOKEN: "errors.codes.invalidOptionsToken",
  SERVICE_UNAVAILABLE: "errors.codes.serviceUnavailable",
  RATE_LIMITED: "errors.codes.rateLimited",
  USER_NOT_FOUND: "errors.codes.userNotFound",
  TOTP_ALREADY_ENABLED: "errors.codes.totpAlreadyEnabled",
  RECOVERY_CODE_INVALID: "errors.codes.recoveryCodeInvalid",
  CHALLENGE_INVALID: "errors.codes.challengeInvalid",
  OAUTH_CONFIG_MISSING: "errors.codes.oauthConfigMissing",
  INTERNAL_ERROR: "errors.codes.internalError",
  // 워크스페이스 · 사용자 서비스(NERV Task CLE-T-MBMPX5).
  WORKSPACE_NAME_INVALID: "errors.codes.workspaceNameInvalid",
  CANNOT_ASSIGN_OWNER: "errors.codes.cannotAssignOwner",
  ALREADY_A_MEMBER: "errors.codes.alreadyAMember",
  OWNER_ROLE_PROTECTED: "errors.codes.ownerRoleProtected",
  MEMBER_NOT_FOUND: "errors.codes.memberNotFound",
  CANNOT_REMOVE_OWNER: "errors.codes.cannotRemoveOwner",
  INVALID_TIMEZONE: "errors.codes.invalidTimezone",
  CANNOT_DELETE_PERSONAL: "errors.codes.cannotDeletePersonal",
  CANNOT_LEAVE_PERSONAL: "errors.codes.cannotLeavePersonal",
  SOLE_OWNER_CANNOT_LEAVE: "errors.codes.soleOwnerCannotLeave",
  CANNOT_TRANSFER_PERSONAL: "errors.codes.cannotTransferPersonal",
  TARGET_IS_SELF: "errors.codes.targetIsSelf",
  TARGET_ALREADY_OWNER: "errors.codes.targetAlreadyOwner",
  WORKSPACE_TYPE_MISMATCH: "errors.codes.workspaceTypeMismatch",
  PASSWORD_REQUIRED: "errors.codes.passwordNotSet",
  // 초대 흐름은 소문자 코드를 낸다. 철자 그대로 키로 두고 대소문자를 접지 않는다(CLE-T-MBMPX5).
  invitation_not_found: "errors.codes.invitationNotFound",
  workspace_not_found: "errors.codes.workspaceNotFound",
  workspace_type_mismatch: "errors.codes.invitationTeamOnly",
  already_a_member: "errors.codes.alreadyAMember",
  invitation_already_pending: "errors.codes.invitationAlreadyPending",
  invitation_already_accepted: "errors.codes.invitationAlreadyAccepted",
  user_not_found: "errors.codes.userNotFound",
  invitation_email_mismatch: "errors.codes.invitationEmailMismatch",
  invitation_already_used: "errors.codes.invitationAlreadyUsed",
  invitation_expired: "errors.codes.invitationExpired",
  admin_required: "errors.codes.adminRequired",
};

function asApiError(err: unknown): AxiosError<ApiErrorBody> | undefined {
  if (typeof err !== "object" || err === null || !("response" in err))
    return undefined;
  return err as AxiosError<ApiErrorBody>;
}

/** 코드 → 사전 키 표. 화면이나 모듈이 공용 표보다 먼저 볼 표(`overrides`)도 이 꼴이다. */
export type ServerErrorKeyTable = Readonly<Record<string, TranslationKey>>;

/** 표에 자기 키로 있는 코드만 찾는다. `constructor` 같은 프로토타입 이름은 키로 보지 않는다. */
function lookupKey(
  table: ServerErrorKeyTable,
  code: string,
): TranslationKey | undefined {
  return Object.hasOwn(table, code) ? table[code] : undefined;
}

/** `resolveServerError` 가 고른 결과. */
export interface ResolvedServerError {
  /** 응답 본문의 에러 코드. 응답이 아니거나 코드가 없으면 `undefined`. */
  code?: string;
  /** 고른 사전 키. `overrides` 를 먼저 보고 없으면 공용 표를 본다. 둘 다 없으면 `undefined`. */
  key?: TranslationKey;
  /** `key` 를 어느 표에서 골랐는지. */
  source?: "override" | "shared";
  /** 응답 본문의 서버 문구(영문 고정 문구). */
  serverMessage?: string;
}

/**
 * 에러 응답의 코드로 사전 키를 고른다. 순서는 `overrides`(그 화면 · 모듈의 표) → 공용 표
 * `SERVER_ERROR_CODE_TO_I18N` 이다. 화면 문구를 고르는 함수는 모두 이 함수를 거친다(NERV CLE-UI-I18N-BACKEND 규칙 5,
 * Task CLE-T-7QQPK7).
 */
export function resolveServerError(
  err: unknown,
  overrides?: ServerErrorKeyTable,
): ResolvedServerError {
  const apiError = asApiError(err);
  if (!apiError) return {};
  const code = extractApiCode(apiError);
  const serverMessage = extractApiMessage(apiError);
  if (!code) return { serverMessage };
  const overrideKey = overrides && lookupKey(overrides, code);
  if (overrideKey)
    return { code, key: overrideKey, source: "override", serverMessage };
  const sharedKey = lookupKey(SERVER_ERROR_CODE_TO_I18N, code);
  if (sharedKey)
    return { code, key: sharedKey, source: "shared", serverMessage };
  return { code, serverMessage };
}

/** 서버 에러 코드에 맞는 화면 문구 키. 응답이 아니거나 모르는 코드면 `undefined`. */
export function serverErrorKey(
  err: unknown,
  overrides?: ServerErrorKeyTable,
): TranslationKey | undefined {
  return resolveServerError(err, overrides).key;
}

/**
 * 에러를 화면 문구로 바꾼다. 아는 코드면 사전 문구(`overrides` 먼저), 모르는 코드면 서버 `message`, 응답 본문이 없으면
 * `fallback` 이다. 응답이 오지 않은 네트워크 오류도 `fallback` 이다(axios 의 영문 오류 문구를 보이지 않는다).
 */
export function serverErrorMessage(
  err: unknown,
  t: TFunction,
  fallback: string,
  overrides?: ServerErrorKeyTable,
): string {
  const { key, serverMessage } = resolveServerError(err, overrides);
  if (key) return t(key);
  return serverMessage || fallback;
}
