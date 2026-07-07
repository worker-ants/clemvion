/**
 * Sanitisation policy for HTTP header **values** — reused across three
 * surfaces (name-based blacklist, so it applies to request or response
 * headers alike):
 *   1. integration nodes' `NodeHandlerOutput.output.responseHeaders`
 *      (CONVENTIONS Principle 7) — the original use;
 *   2. webhook **request** headers at ingestion
 *      (`HooksService`, spec/5-system/12-webhook.md §5.3);
 *   3. the `$trigger.headers` expression view (`buildTriggerView`).
 *
 * Echoing auth/secret headers verbatim would leak credentials into the
 * NodeExecution / Execution row, websocket events, execution-history reads,
 * and expression auto-complete data.
 *
 * Strategy — header **names** are preserved (so the consumer can still see
 * which headers were present) but the **value** is replaced with
 * `'[REDACTED]'` when:
 *   1. the lowercased name matches an exact-match blacklist; or
 *   2. the lowercased name contains a credential-shaped substring.
 *
 * Decision recorded in `plan/in-progress/engine-raw-config-exposure.md`
 * (§결정 보강).
 */

const REDACTED = '[REDACTED]';

const EXACT_BLACKLIST = new Set<string>([
  'authorization',
  'proxy-authorization',
  'www-authenticate',
  'proxy-authenticate',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-csrf-token',
  'x-amz-security-token',
  // 3xx redirect target — surfacing the next URL on `output.responseHeaders`
  // would re-introduce the URL-credential leak that sanitizeUrlCredentials
  // guards against on `output.error.details.url`. Keep symmetry.
  'location',
]);

const SUBSTRING_BLACKLIST = [
  'auth',
  'token',
  'api-key',
  'apikey',
  'secret',
  'cookie',
  'credential',
  'password',
  // 서명 헤더 — `X-Hub-Signature-256`(webhook HMAC), `X-Slack-Signature`,
  // `X-Signature-Ed25519`/`X-Signature-Timestamp`(Discord) 등 request-bound digest.
  // 인증 검증은 마스킹 전 raw 로 완료되고 다운스트림 raw 소비처가 없으므로 값 마스킹.
  'signature',
];

function isSensitiveHeaderName(name: string): boolean {
  const lower = name.toLowerCase();
  if (EXACT_BLACKLIST.has(lower)) return true;
  return SUBSTRING_BLACKLIST.some((needle) => lower.includes(needle));
}

type HeaderEntries = Iterable<[string, string]>;

/**
 * Accepts `fetch` `Headers`, a plain `Record<string, string>`, or any
 * iterable of `[name, value]` tuples and returns a sanitised plain record.
 * Multi-valued headers (e.g. multiple `Set-Cookie`) are concatenated by the
 * source `Headers` object before reaching us, which is acceptable here —
 * the value is redacted regardless.
 *
 * Returns an empty object for `null` / `undefined` and for mock-like inputs
 * that lack the iteration protocol — callers (handlers in test harnesses)
 * may pass partial mocks that only stub `.get()`.
 */
export function sanitizeResponseHeaders(
  source: Headers | Record<string, string> | HeaderEntries | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  const entries = iterateHeaders(source);
  if (entries === null) return out;
  for (const [name, value] of entries) {
    out[name] = isSensitiveHeaderName(name) ? REDACTED : String(value);
  }
  return out;
}

function iterateHeaders(
  source: Headers | Record<string, string> | HeaderEntries | null | undefined,
): Iterable<[string, string]> | null {
  if (source === null || source === undefined) return null;
  if (typeof Headers !== 'undefined' && source instanceof Headers) {
    return source.entries();
  }
  if (typeof source === 'object' && Symbol.iterator in (source as object)) {
    return source as HeaderEntries;
  }
  if (typeof source === 'object') {
    return Object.entries(source as Record<string, string>);
  }
  return null;
}
