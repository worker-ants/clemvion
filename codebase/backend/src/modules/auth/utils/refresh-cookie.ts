import type Express from 'express';

const REFRESH_COOKIE_NAME = 'refreshToken';
const COOKIE_PATH = '/';
const REMEMBER_ME_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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
    secure: true,
    sameSite: 'none',
    maxAge,
    path: COOKIE_PATH,
    ...(options.cookieDomain ? { domain: options.cookieDomain } : {}),
  });
}

export function clearRefreshTokenCookie(
  res: Express.Response,
  options: { cookieDomain: string },
): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    path: COOKIE_PATH,
    ...(options.cookieDomain ? { domain: options.cookieDomain } : {}),
  });
}
