import axios from "axios";
import { extractApiCode } from "@/lib/api/errors";
import type { TranslationKey } from "@/lib/i18n";

// 비밀번호를 다시 확인하는 폼(TOTP 설정 시작 · Passkey 등록 · Passkey 복구 코드 재발급 · Passkey 삭제)은 같은 실패 안내를 쓴다
// (NERV CLE-ACCT-SIGNIN, CLE-T-94FTMV · CLE-T-FRCRF7). 비밀번호가 없는 계정(OAuth 전용)은 비밀번호 재설정으로
// 먼저 비밀번호를 만들어야 한다.
const PASSWORD_RECHECK_ERRORS: Partial<Record<string, TranslationKey>> = {
  PASSWORD_INVALID: "profile.security.passwordInvalid",
  PASSWORD_REQUIRED: "profile.security.passwordNotSet",
};

/**
 * 2단계 인증 폼이 요청 한도를 넘었는지(429). 이 폼들은 비밀번호나 인증 코드를 싣고 있어 자동으로 다시 보내지 않고
 * 잠시 뒤 다시 시도하라고 안내만 한다(NERV CLE-ACCT-SIGNIN, CLE-T-FRCRF7).
 */
export function isRateLimited(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 429;
}

/** TOTP 활성화 검증이 설정 시작 전이거나 설정 시작 뒤 10분이 지나 거부됐는지(400 `TOTP_NOT_INITIALIZED`). */
export function isTotpSetupExpired(err: unknown): boolean {
  return (
    axios.isAxiosError(err) && extractApiCode(err) === "TOTP_NOT_INITIALIZED"
  );
}

/**
 * 비밀번호를 다시 확인하는 폼의 실패 안내 키. 429 면 요청 한도 안내, 비밀번호 실패면 그 이유,
 * 그 밖에는 `fallback` 이다.
 */
export function passwordRecheckErrorKey(
  err: unknown,
  fallback: TranslationKey,
): TranslationKey {
  if (!axios.isAxiosError(err)) return fallback;
  if (isRateLimited(err)) return "profile.security.rateLimited";
  const code = extractApiCode(err);
  return (code && PASSWORD_RECHECK_ERRORS[code]) || fallback;
}
