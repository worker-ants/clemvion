import type Express from 'express';

const REFRESH_COOKIE_NAME = 'refreshToken';
// 04 M-5 — refresh 쿠키를 auth 라우트(`/api/auth/*`)로 한정해 표면을 축소한다
// (전역 prefix 'api' + `@Controller('auth')`). 다른 엔드포인트는 모두 Bearer access
// token 기반이라 쿠키가 불필요하다. set/clear 가 동일 path 를 써야 clear 가 동작한다.
const COOKIE_PATH = '/api/auth';
const REMEMBER_ME_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type CookieSameSite = 'none' | 'lax' | 'strict';

/**
 * 04 M-5 — refresh 쿠키 `SameSite` 정책.
 *
 * 기본 `'none'`: 프론트와 API 가 사이트 경계(eTLD+1)를 달리하는 cross-site 배포를
 * 지원한다(이 토폴로지에서는 `lax`/`strict` 면 쿠키가 cross-site 요청에 미첨부 →
 * 세션 끊김). 동일 사이트 배포는 `COOKIE_SAMESITE=lax`(또는 `strict`)로 하드닝한다.
 * `'none'` 모드의 CSRF 노출(쿠키 자동 첨부)은 `/auth/refresh` 의 Origin allowlist
 * 검증으로 보완한다(다른 엔드포인트는 Bearer 라 쿠키 CSRF 면역).
 *
 * @param env 검사할 환경변수 맵(기본 `process.env`).
 * @returns `'none' | 'lax' | 'strict'` — 미설정/비인식 값은 `'none'`.
 */
export function getRefreshCookieSameSite(
  env: NodeJS.ProcessEnv = process.env,
): CookieSameSite {
  const v = (env.COOKIE_SAMESITE ?? '').trim().toLowerCase();
  if (v === 'lax' || v === 'strict' || v === 'none') return v;
  return 'none';
}

/**
 * refresh 토큰을 HttpOnly·Secure 쿠키로 설정한다 (04 M-5).
 *
 * @param res Express 응답 — `res.cookie` 로 `Set-Cookie` 발급.
 * @param token 발급할 refresh 토큰 값.
 * @param options.cookieDomain 빈 문자열이면 Domain 미지정(backend origin 한정), 아니면 해당 Domain.
 * @param options.rememberMe `true` 면 30일 maxAge, 아니면 7일(기본).
 * @remarks `SameSite` 는 `COOKIE_SAMESITE` env(기본 `none`)에서 읽고, `Path` 는 `/api/auth`
 *   로 한정한다(표면 축소). `clearRefreshTokenCookie` 와 **동일 Path** 사용 필수 — §2.3/Rationale 2.3.B.
 */
export function setRefreshTokenCookie(
  res: Express.Response,
  token: string,
  options: { cookieDomain: string; rememberMe?: boolean },
): void {
  const maxAge = options.rememberMe
    ? REMEMBER_ME_MAX_AGE_MS
    : DEFAULT_MAX_AGE_MS;
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    // SameSite=None 은 Secure 가 필수 — 항상 Secure 로 둔다(앱은 https 종단 뒤).
    secure: true,
    sameSite: getRefreshCookieSameSite(),
    maxAge,
    path: COOKIE_PATH,
    ...(options.cookieDomain ? { domain: options.cookieDomain } : {}),
  });
}

/**
 * refresh 쿠키를 제거한다. **중요**: `path` 는 `setRefreshTokenCookie` 의 `COOKIE_PATH`
 * (`/api/auth`) 와 반드시 일치해야 한다 — 불일치 시 브라우저가 쿠키를 삭제하지 못해
 * logout 후에도 쿠키가 잔존한다(silent failure).
 */
export function clearRefreshTokenCookie(
  res: Express.Response,
  options: { cookieDomain: string },
): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    path: COOKIE_PATH,
    ...(options.cookieDomain ? { domain: options.cookieDomain } : {}),
  });
}
