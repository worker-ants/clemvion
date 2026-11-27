import type { AxiosError } from "axios";
import type { TFunction, TranslationKey } from "@/lib/i18n";
import { extractApiCode, extractApiMessage, type ApiErrorBody } from "./errors";

/**
 * 서버 에러 코드 → 화면 문구 키. 서버 `message` 는 영문 고정 문구라 한국어 화면은 코드로 문구를 고른다
 * (NERV CLE-UI-I18N-BACKEND 규칙 5, Task CLE-T-MNX9KP · CLE-T-CHP94Z).
 *
 * 인증 · 세션 · 워크스페이스 가드처럼 여러 화면이 같은 뜻으로 받는 코드만 둔다. 한 화면에서만 다르게 읽어야 하는
 * 코드는 그 화면이 먼저 고르고(예: 로그인 2단계의 `TOTP_INVALID`, owner 이양의 `OWNER_REQUIRED`), 여기 없는 코드는
 * 서버 문구를 그대로 보인다. 통합 화면의 토스트는 따로 `integration-error-codes.ts` 가 조립한다.
 */
export const SERVER_ERROR_CODE_TO_I18N: Readonly<
  Record<string, TranslationKey>
> = {
  NOT_A_MEMBER: "errors.codes.notAMember",
  WORKSPACE_NOT_FOUND: "errors.codes.workspaceNotFound",
  EDITOR_REQUIRED: "errors.codes.editorRequired",
  ADMIN_REQUIRED: "errors.codes.adminRequired",
  OWNER_REQUIRED: "errors.codes.ownerRequired",
  PASSWORD_INVALID: "profile.security.passwordInvalid",
  TOTP_INVALID: "auth.login.invalidTotp",
  SESSION_NOT_FOUND: "errors.codes.sessionNotFound",
  CANNOT_REVOKE_CURRENT_SESSION: "profile.sessions.revokeCurrentHint",
  CURRENT_SESSION_REQUIRED: "errors.codes.currentSessionRequired",
  REAUTH_NOT_AVAILABLE: "profile.sessions.dialogReauthUnavailable",
  REAUTH_REQUIRED: "errors.codes.reauthRequired",
  TOTP_NOT_ENABLED: "errors.codes.totpNotEnabled",
  WEBAUTHN_REQUIRED: "auth.login.webauthnRequired",
  CHALLENGE_METHOD_MISMATCH: "errors.codes.challengeMethodMismatch",
  WEBAUTHN_DISABLED: "errors.codes.webauthnDisabled",
  WEBAUTHN_NOT_REGISTERED: "errors.codes.webauthnNotRegistered",
  WEBAUTHN_COUNTER_REGRESSION: "errors.codes.webauthnCounterRegression",
  INVALID_OPTIONS_TOKEN: "errors.codes.invalidOptionsToken",
  SERVICE_UNAVAILABLE: "errors.codes.serviceUnavailable",
};

function asApiError(err: unknown): AxiosError<ApiErrorBody> | undefined {
  if (typeof err !== "object" || err === null || !("response" in err))
    return undefined;
  return err as AxiosError<ApiErrorBody>;
}

/** 서버 에러 코드에 맞는 화면 문구 키. 응답이 아니거나 모르는 코드면 `undefined`. */
export function serverErrorKey(err: unknown): TranslationKey | undefined {
  const apiError = asApiError(err);
  const code = apiError && extractApiCode(apiError);
  return code ? SERVER_ERROR_CODE_TO_I18N[code] : undefined;
}

/**
 * 에러를 화면 문구로 바꾼다. 아는 코드면 사전 문구, 모르는 코드면 서버 `message`, 응답 본문이 없으면 `fallback` 이다.
 * 응답이 오지 않은 네트워크 오류도 `fallback` 이다(axios 의 영문 오류 문구를 보이지 않는다).
 */
export function serverErrorMessage(
  err: unknown,
  t: TFunction,
  fallback: string,
): string {
  const key = serverErrorKey(err);
  if (key) return t(key);
  const apiError = asApiError(err);
  return (apiError && extractApiMessage(apiError)) || fallback;
}
