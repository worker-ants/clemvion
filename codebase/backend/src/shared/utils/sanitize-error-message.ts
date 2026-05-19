/**
 * Shared sanitizer for error messages that may contain OAuth tokens, API keys,
 * and other secrets. Originally defined in integration-oauth.service; extracted
 * to this neutral location so execution-engine and other non-OAuth modules can
 * import without creating a cross-layer dependency.
 *
 * 2026-05-19 (arch-C2) — moved from modules/integrations/integration-oauth.service.ts.
 */

/** Hard cap on error message length to keep JSONB columns bounded. */
export const LAST_ERROR_MESSAGE_MAX_LEN = 200;

/** Patterns we mask before persisting error messages — provider errors
 * occasionally echo back tokens or partial secrets.  The match is conservative:
 * regex hits replace the entire matched run with `***`.
 *
 * 2026-05-16 (SEC-C2) — Cafe24 가 token endpoint 에러 응답에 `client-secret`
 * (하이픈) 또는 `secret: ...` 단독 키워드를 echo 하는 사례가 운영 로그에서
 * 확인되어 패턴을 확장. */
export const SECRET_LEAK_PATTERNS: ReadonlyArray<RegExp> = [
  // OAuth-style bearer tokens
  /\bBearer\s+[A-Za-z0-9._\-+/=]+/gi,
  // Cafe24 token endpoints frequently include the secret in body / URL.
  /"?\b(client[_-]secret|access[_-]token|refresh[_-]token|id[_-]token|api[_-]key|password|passwd|pwd)"?\s*[=:]\s*(?:"[^"]*"|[^\s&'"]+)/gi,
  // 단독 `secret` 키워드
  /"?\bsecret"?\s*[=:]\s*(?:"[^"]*"|[^\s&'"]+)/gi,
  // Authorization header values
  /\bAuthorization:\s*\S+/gi,
];

/**
 * Mask secret tokens in `raw` and truncate to {@link LAST_ERROR_MESSAGE_MAX_LEN}.
 * Safe to call with non-string or empty values — returns the input unchanged.
 */
export function sanitizeLastErrorMessage(raw: string): string {
  if (typeof raw !== 'string' || raw.length === 0) return raw;
  let masked = raw;
  for (const pattern of SECRET_LEAK_PATTERNS) {
    masked = masked.replace(pattern, '***');
  }
  return masked.length > LAST_ERROR_MESSAGE_MAX_LEN
    ? masked.slice(0, LAST_ERROR_MESSAGE_MAX_LEN) + '…'
    : masked;
}
