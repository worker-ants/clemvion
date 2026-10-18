/**
 * `has_session` 세션 힌트 쿠키(CLE-ACCT-SESSION REQ-SESSION-037).
 *
 * API 가 cross-domain 이라 Next 서버 미들웨어(`proxy.ts`)는 백엔드 세션을 직접 알 수 없다. 그래서 로그인하면
 * 프론트엔드 JS 가 이 쿠키를 심고 로그아웃하면 지운다. 인증 수단이 아니라 화면 전환에 쓰는 힌트다.
 *
 * - 심기 · 지우기: `auth-store` 의 `setAuthenticated` · `logout`
 * - 읽기: `proxy.ts`(요청 쿠키), 가입 화면(`document.cookie`)
 *
 * `proxy.ts` 가 import 하므로 브라우저 전용 모듈에 기대지 않는다.
 */

export const SESSION_HINT_COOKIE = "has_session";

/** 30일. */
const SESSION_HINT_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * 쿠키 문자열에 세션 힌트가 있는지 본다. 인자를 주지 않으면 `document.cookie` 를 읽고, 브라우저 밖이면
 * 힌트가 없는 것으로 본다.
 */
export function hasSessionHint(
  cookie: string = typeof document === "undefined" ? "" : document.cookie,
): boolean {
  return cookie.split("; ").includes(`${SESSION_HINT_COOKIE}=1`);
}

export function setSessionHint(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_HINT_COOKIE}=1; path=/; max-age=${SESSION_HINT_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearSessionHint(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_HINT_COOKIE}=; path=/; max-age=0`;
}
