import axios from "axios";
import { extractApiCode } from "@/lib/api/errors";
import type { ReauthMode } from "./components/revoke-confirm-dialog";

/**
 * 세션 종료 요청이 실패했을 때 재인증 입력을 어떻게 바꿀지 정한다. 바꿀 필요가 없으면 `null`.
 *
 * - 403 + `REAUTH_NOT_AVAILABLE`: 비밀번호도 TOTP 도 없는 계정이라 `unavailable`.
 * - 400 + `REAUTH_REQUIRED`: 비밀번호를 보냈는데 서버가 비밀번호 없는 계정으로 본 경우다.
 *   처음 비밀번호를 받는 중이고 TOTP 를 켠 계정일 때만 `totp` 로 바꾼다.
 *   비밀번호가 틀린 경우(401 `PASSWORD_INVALID`)는 비밀번호 입력을 유지한다.
 *
 * 근거: [세션과 토큰 REQ-SESSION-025](CLE-ACCT-SESSION)
 */
export function nextReauthMode(
  err: unknown,
  current: ReauthMode,
  hasTotp: boolean,
): ReauthMode | null {
  if (!axios.isAxiosError(err)) return null;
  const status = err.response?.status;
  const code = extractApiCode(err);

  if (status === 403 && code === "REAUTH_NOT_AVAILABLE") return "unavailable";
  if (
    status === 400 &&
    code === "REAUTH_REQUIRED" &&
    current === "password" &&
    hasTotp
  ) {
    return "totp";
  }
  return null;
}
