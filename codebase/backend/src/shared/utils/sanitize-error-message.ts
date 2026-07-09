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
 * Object keys whose (string) value is masked wholesale, regardless of the value's
 * own shape — a secret stored as a bare value (`{"api_key":"AKIA…"}`) matches no
 * value-level pattern, so key-name matching is the only way to catch it. Mirrors
 * the WS-layer `CREDENTIAL_KEY_PATTERN` (websocket.service) intentionally; both
 * defend the same class at different layers.
 */
const CREDENTIAL_KEY_PATTERN =
  /^(password|passwd|pwd|api[_-]?key|secret|token|access[_-]?token|refresh[_-]?token|private[_-]?key|client[_-]?secret|authorization|cookie)$/i;

/**
 * Recursively mask secrets in a structured value (objects/arrays walked
 * depth-first): every **string leaf** is run through {@link redactSecrets}
 * (value-pattern masking), and any string value under a credential-named key
 * ({@link CREDENTIAL_KEY_PATTERN}) is masked wholesale to `***`. Non-string
 * leaves pass through. **Copy-on-change**: subtrees with nothing masked are
 * returned by the same reference (mirrors `sanitizePayloadForWs`), so the input
 * is never mutated and unchanged structures keep their identity.
 *
 * Use for structured public-surface fields (e.g. conversation-thread
 * `turns[].data` / `presentations[].payload`, `ai_message.messages[]`) where a
 * flat string-level `redactSecrets` cannot reach nested string values.
 */
export function deepRedactSecrets(value: unknown): unknown {
  if (typeof value === 'string') return redactSecrets(value);
  if (Array.isArray(value)) {
    let mutated = false;
    const out = value.map((v) => {
      const r = deepRedactSecrets(v);
      if (r !== v) mutated = true;
      return r;
    });
    return mutated ? out : value;
  }
  if (value !== null && typeof value === 'object') {
    let result: Record<string, unknown> | null = null;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const r =
        typeof v === 'string' && v.length > 0 && CREDENTIAL_KEY_PATTERN.test(k)
          ? '***'
          : deepRedactSecrets(v);
      if (r !== v) {
        if (!result) result = { ...(value as Record<string, unknown>) };
        result[k] = r;
      }
    }
    return result ?? value;
  }
  return value;
}

/**
 * JSON-safe secret masking for a **raw JSON string** (e.g. an LLM tool call's
 * `arguments`). Token-level masking of the raw string would corrupt the JSON
 * (`{"api_key":"x"}` → `{***}`), so we parse → {@link deepRedactSecrets} the
 * string leaves → re-serialize. When the input is not valid JSON it is plain
 * text, so `redactSecrets` is applied directly (no structure to corrupt).
 * Returns the input unchanged when nothing was masked.
 */
export function redactSecretsInJsonString(raw: string): string {
  if (typeof raw !== 'string' || raw.length === 0) return raw;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return redactSecrets(raw);
  }
  const red = deepRedactSecrets(parsed);
  return red === parsed ? raw : JSON.stringify(red);
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
