import { registerAs } from '@nestjs/config';

/**
 * Automatically derive the cookie domain from frontend and backend URLs.
 * - Same host or localhost → empty (cookie scoped to backend origin)
 * - Shared parent domain (e.g. *.mbiflare.com) → '.mbiflare.com'
 * - Different root domains → empty (rely on withCredentials for cross-origin)
 */
function computeCookieDomain(frontendUrl: string, backendUrl: string): string {
  let frontendHost: string;
  let backendHost: string;
  try {
    frontendHost = new URL(frontendUrl).hostname;
    backendHost = new URL(backendUrl).hostname;
  } catch {
    return '';
  }

  // localhost or IP → no domain
  if (
    frontendHost === 'localhost' ||
    backendHost === 'localhost' ||
    /^\d+\.\d+\.\d+\.\d+$/.test(frontendHost) ||
    /^\d+\.\d+\.\d+\.\d+$/.test(backendHost)
  ) {
    return '';
  }

  // Same host → no domain needed
  if (frontendHost === backendHost) return '';

  // Find common parent domain from right to left
  const fParts = frontendHost.split('.');
  const bParts = backendHost.split('.');
  const common: string[] = [];
  while (fParts.length > 0 && bParts.length > 0) {
    const f = fParts.pop()!;
    const b = bParts.pop()!;
    if (f === b) {
      common.unshift(f);
    } else {
      break;
    }
  }

  // Need at least 2 parts for a valid domain (e.g. mbiflare.com)
  if (common.length >= 2) {
    return '.' + common.join('.');
  }

  // Completely different domains → no shared cookie domain
  return '';
}

export const appConfig = registerAs('app', () => {
  // canonical 포트는 codebase/backend/.env.example 의 APP_PORT=3011 / FRONTEND_URL=:3012 (C-8).
  const url = process.env.APP_URL || 'http://localhost:3011';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3012';

  return {
    port: parseInt(process.env.APP_PORT || '3011', 10),
    url,
    frontendUrl,
    encryptionKey: process.env.ENCRYPTION_KEY || '',
    cookieDomain: computeCookieDomain(frontendUrl, url),
    // expression `$env` 노출 allowlist — 운영자 opt-in 콤마 구분 키 목록
    // (spec/5-system/5-expression-language.md §4.5). 미설정이면 $env = {}.
    // 배포 운영자만 설정 가능하므로 이 opt-in 이 self-hosting 게이팅 역할을 한다.
    expressionEnvAllowlist: process.env.EXPRESSION_ENV_ALLOWLIST || '',
  };
});
