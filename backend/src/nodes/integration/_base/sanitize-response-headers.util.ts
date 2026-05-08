/**
 * Sanitisation policy for HTTP response headers echoed on
 * `NodeHandlerOutput.output.responseHeaders` (CONVENTIONS Principle 7).
 *
 * Workflow authors may chain a follow-up node that reads
 * `$node["X"].output.responseHeaders.Authorization` to debug an upstream
 * call. Echoing such headers verbatim would leak credentials into the
 * NodeExecution row, websocket events, and expression auto-complete data.
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
 */
export function sanitizeResponseHeaders(
  source: Headers | Record<string, string> | HeaderEntries,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of iterateHeaders(source)) {
    out[name] = isSensitiveHeaderName(name) ? REDACTED : value;
  }
  return out;
}

function iterateHeaders(
  source: Headers | Record<string, string> | HeaderEntries,
): Iterable<[string, string]> {
  if (typeof Headers !== 'undefined' && source instanceof Headers) {
    return source.entries();
  }
  if (
    source !== null &&
    typeof source === 'object' &&
    Symbol.iterator in (source as object)
  ) {
    return source as HeaderEntries;
  }
  return Object.entries(source as Record<string, string>);
}
