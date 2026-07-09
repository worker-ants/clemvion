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
 * 확인되어 패턴을 확장.
 *
 * 2026-07-09 — Authorization 패턴을 첫 토큰(`\S+`)이 아니라 **줄 끝까지** 마스킹하도록
 * 확장. 종전엔 `Authorization: Basic dXNlcjpwYXNz` 에서 스킴(`Basic`)만 마스킹되고
 * 값에 공백이 있는 스킴(Basic/Digest)의 자격증명이 노출됐다. */
export const SECRET_LEAK_PATTERNS: ReadonlyArray<RegExp> = [
  // OAuth-style bearer tokens
  /\bBearer\s+[A-Za-z0-9._\-+/=]+/gi,
  // Cafe24 token endpoints frequently include the secret in body / URL.
  /"?\b(client[_-]secret|access[_-]token|refresh[_-]token|id[_-]token|api[_-]key|password|passwd|pwd)"?\s*[=:]\s*(?:"[^"]*"|[^\s&'"]+)/gi,
  // 단독 `secret` 키워드
  /"?\bsecret"?\s*[=:]\s*(?:"[^"]*"|[^\s&'"]+)/gi,
  // Authorization header values — mask the entire value to end-of-line so
  // space-containing credentials (Basic/Digest base64) aren't partially exposed.
  /\bAuthorization:[^\r\n]*/gi,
];

/**
 * Mask secret-shaped tokens in `raw` using {@link SECRET_LEAK_PATTERNS}, without
 * length truncation. Safe to call with non-string or empty values — returns the
 * input unchanged.
 *
 * Distinct from {@link sanitizeLastErrorMessage} (which additionally truncates):
 * conversation-thread EIA egress redaction reuses this mask-only variant because
 * turn text is user-visible history with its own char caps, so it must not be
 * clipped to 200 chars. Reuse keeps a single SECRET_LEAK_PATTERNS source of truth.
 *
 * `String.prototype.replace` fully resets each `g`-flagged regex's `lastIndex`
 * per call, so sharing the stateful patterns across callers is safe.
 */
export function redactSecrets(raw: string): string {
  if (typeof raw !== 'string' || raw.length === 0) return raw;
  let masked = raw;
  for (const pattern of SECRET_LEAK_PATTERNS) {
    masked = masked.replace(pattern, '***');
  }
  return masked;
}

/**
 * Mask secret tokens in `raw` and truncate to {@link LAST_ERROR_MESSAGE_MAX_LEN}.
 * Safe to call with non-string or empty values — returns the input unchanged.
 */
export function sanitizeLastErrorMessage(raw: string): string {
  if (typeof raw !== 'string' || raw.length === 0) return raw;
  const masked = redactSecrets(raw);
  return masked.length > LAST_ERROR_MESSAGE_MAX_LEN
    ? masked.slice(0, LAST_ERROR_MESSAGE_MAX_LEN) + '…'
    : masked;
}
