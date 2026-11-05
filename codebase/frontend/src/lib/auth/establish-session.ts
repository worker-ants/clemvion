import { usersApi, type UserProfile } from "@/lib/api/users";
import { useAuthStore } from "@/lib/stores/auth-store";

/**
 * `GET /api/users/me` 를 기다리는 상한(밀리초). `apiClient` 에는 기본 timeout 이 없어서
 * 응답이 오지 않으면 로그인 화면이 로딩에 머문다. 넘기면 조회 실패로 본다.
 */
export const ESTABLISH_SESSION_TIMEOUT_MS = 10_000;

/** axios 에서 `timeout: 0` 은 시간 상한이 없다는 뜻이다. 로그인 상태 복원 경로가 쓴다. */
export const NO_SESSION_TIMEOUT = 0;

export interface EstablishSessionOptions {
  /**
   * 사용자 조회를 기다리는 상한(밀리초). 기본은 {@link ESTABLISH_SESSION_TIMEOUT_MS}.
   * 호출하는 쪽이 정한다. 로그인 상태 복원은 이전부터 시간 상한 없이 조회했으므로
   * {@link NO_SESSION_TIMEOUT} 을 넘겨, 느린 회선에서 유효한 세션이 로그아웃되지 않게 한다.
   */
  timeoutMs?: number;
}

/**
 * 액세스 토큰을 받은 뒤 로그인 상태를 표시하는 진입점(NERV CLE-ACCT-SESSION REQ-SESSION-037 ·
 * 「로그인 힌트 쿠키」). 토큰을 받는 경로는 모두 이 함수를 쓴다.
 *
 * - 비밀번호 · 2단계 인증 · 복구 코드 로그인(`components/auth/login-form.tsx`)
 * - 소셜 로그인 콜백(`app/(auth)/callback/callback-content.tsx`)
 * - 초대 토큰 가입 자동 로그인(`components/auth/register-form.tsx`)
 * - 이메일 인증 자동 로그인(`app/(auth)/verify-email/verify-email-content.tsx`)
 * - 로그인 상태 복원(`components/auth/auth-provider.tsx`)
 *
 * 순서는 액세스 토큰과 로그인 힌트 쿠키(`has_session`)를 먼저 두고 `GET /api/users/me` 를 읽는 것이다.
 * 토큰을 받았으면 리프레시 쿠키도 이미 있으므로 힌트 쿠키를 심는다. 사용자 조회에 성공하면 로그인 상태를
 * 표시하고 사용자 정보를 돌려준다.
 *
 * 사용자 조회가 실패하거나 시간 상한을 넘기면 `null` 을 돌려준다. 이때 토큰과 힌트 쿠키는 그대로 두고
 * 로그인 상태는 표시하지 않는다. 로그인 화면은 그대로 목적지로 이동한다. 목적지 화면의 AuthProvider 가
 * 로그인 상태가 아닌 것을 보고 리프레시와 사용자 조회로 다시 복원한다. 그것도 실패하면 로그아웃해 힌트
 * 쿠키를 지우고 로그인 화면으로 보낸다. 로그인 상태 복원을 하는 AuthProvider 는 `null` 을 받으면
 * 그 실패 처리로 넘어간다.
 *
 * 워크스페이스 정합(마지막으로 쓴 워크스페이스로 `/switch`)은 하지 않는다. 로그인 뒤 목적지는
 * slug 없는 경로의 리다이렉트(`app/(main)/[...rest]/page.tsx`)가 마지막 워크스페이스의 slug 를 붙이고,
 * `[slug]` layout 이 URL 기준으로 토큰을 맞춘다.
 */
export async function establishSession(
  accessToken: string,
  { timeoutMs = ESTABLISH_SESSION_TIMEOUT_MS }: EstablishSessionOptions = {},
): Promise<UserProfile | null> {
  const { markSessionIssued, setAuthenticated } = useAuthStore.getState();
  markSessionIssued(accessToken);
  try {
    const res = await usersApi.getMe({ timeout: timeoutMs });
    const user = res.data.data;
    if (!user) return null;
    setAuthenticated(accessToken, user);
    return user;
  } catch {
    return null;
  }
}
