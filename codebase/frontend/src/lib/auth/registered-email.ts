import { authApi } from "@/lib/api/auth";

/**
 * 가입 여부 확인(`check-email`)을 기다리는 최대 시간. 초대 가입 화면은 이 확인을 가입 폼을 띄우기 전에
 * 기다리므로 응답이 오지 않으면 폼이 계속 loading 에 머문다. 공용 `apiClient` 에는 기본 timeout 이 없어서
 * 이 호출에만 건다(CLE-ACCT-WS 「초대 가입 화면」 4단계).
 */
export const REGISTERED_EMAIL_CHECK_TIMEOUT_MS = 5_000;

/**
 * 초대 토큰의 이메일이 이미 가입돼 있는지 공개 `check-email` 로 묻는다. 확인하지 못하면(429 · 네트워크 ·
 * 시간 초과) 가입되지 않은 것으로 보고 가입 폼을 띄운다. 그 경우 제출이 409 로 끝나면 그때 로그인으로 보낸다.
 */
export async function isRegisteredEmail(email: string): Promise<boolean> {
  try {
    const response = await authApi.checkEmail(email, {
      timeout: REGISTERED_EMAIL_CHECK_TIMEOUT_MS,
    });
    return response.data.data?.available === false;
  } catch {
    return false;
  }
}
