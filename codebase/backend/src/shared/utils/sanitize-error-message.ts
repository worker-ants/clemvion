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
 * 값에 공백이 있는 스킴(Basic/Digest)의 자격증명이 노출됐다.
 *
 * 2026-07-10 — 키워드/접두사 없이 노출되는 두 형태를 추가(EIA §R17 잔여 하드닝):
 * (a) bare JWT(`eyJ...` header.payload[.signature]) — `Bearer` 접두사·`token=` 키워드가
 *     없으면 종전 패턴이 전혀 못 잡았다. (b) URI userinfo(`scheme://user:pass@host`)
 *     — 실행 엔진 sanitizer 의 CONNECTION_STRING_PATTERN 은 DB 스킴만 strip 하고, 키워드
 *     패턴(`password=`)도 URL 내장 자격증명은 매칭 못 해 `https://admin:pw@host` 가 새어나갔다.
 *     userinfo 는 **scheme 보존**(자격증명 `user:pass` 만 `***`)으로 마스킹해 `scheme://***@host`
 *     가 되도록 lookbehind/lookahead 로 좁혔다 — MCP 전용으로 있던 동형 패턴을 이 SoT 로
 *     흡수(파편화 제거, `mcp-error-codes.ts`). */
export const SECRET_LEAK_PATTERNS: ReadonlyArray<RegExp> = [
  // OAuth-style bearer tokens
  /\bBearer\s+[A-Za-z0-9._\-+/=]+/gi,
  // Cafe24 token endpoints frequently include the secret in body / URL.
  // `[A-Za-z0-9_-]*token` is the whole `token` family in one alternative: bare
  // `token=`, and any prefixed form (`access_token` / `refresh-token` / `id_token` /
  // `csrf_token` / `csrfToken`). It REPLACES the three explicit `*[_-]token`
  // alternatives that used to sit here — they are subsumed, and keeping both invites
  // the two spellings to drift.
  /"?\b(client[_-]secret|[A-Za-z0-9_-]*token|api[_-]key|password|passwd|pwd)"?\s*[=:]\s*(?:"[^"]*"|[^\s&'"]+)/gi,
  // 단독 `secret` 키워드
  /"?\bsecret"?\s*[=:]\s*(?:"[^"]*"|[^\s&'"]+)/gi,
  // Authorization header values — mask the entire value to end-of-line so
  // space-containing credentials (Basic/Digest base64) aren't partially exposed.
  /\bAuthorization:[^\r\n]*/gi,
  // Bare JWT (no `Bearer`/`token=` context): `eyJ`-prefixed header.payload with an
  // optional signature segment. The `eyJ` anchor (base64url of `{"`) + two long
  // base64url runs keeps false positives on ordinary prose negligible.
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]+)?/g,
  // URI-embedded userinfo credentials (`scheme://user:pass@host`), any scheme.
  // Lookbehind on `://` + lookahead on `@` match ONLY the `user:pass` credential
  // so the uniform `***` replacement is scheme-preserving → `scheme://***@host`
  // (host/path survive; the password can't leak).
  /(?<=:\/\/)[^/\s:@]+:[^/\s@]+(?=@)/gi,
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
    masked = masked.replace(pattern, VALUE_MASK_MARKER);
  }
  return masked;
}

/**
 * Object keys whose value is masked wholesale (regardless of the value's shape) —
 * a secret stored as a bare value (`{"api_key":"AKIA…"}`) matches no value-level
 * pattern, so key-name matching is the only way to catch it. Mirrors the WS-layer
 * `CREDENTIAL_KEY_PATTERN` (websocket.service) — both defend the same class at
 * different layers — and additionally covers `x-api-key`, an `x-`-prefixed header name
 * common in LLM/tool structured output that the WS layer does not carry.
 *
 * `[a-z0-9_-]*token` covers the whole family in one alternative (bare `token`,
 * `access_token`, `csrf_token`, `csrfToken`, `x-auth-token`). Measured 2026-08-17:
 * the list carried bare `token` but **not** the prefixed forms, so `{csrf_token: …}`
 * went out in the clear on every one of the three masking axes.
 *
 * That family alternative landed in **both** copies, so `x-auth-token` — previously
 * spelled out here only — is now shared with the WS mirror. `x-api-key` is the single
 * remaining asymmetry, and it is deliberate.
 *
 * **Accepted false positive**: opaque cursors (`nextPageToken`, `continuationToken`)
 * are masked too. They are display-only here — masking is egress-only and the DB keeps
 * the raw value, so downstream nodes still read the real cursor. A canary pins this so
 * anyone narrowing the pattern sees the decision rather than rediscovering it.
 */
const CREDENTIAL_KEY_PATTERN =
  /^(password|passwd|pwd|api[_-]?key|secret|[a-z0-9_-]*token|private[_-]?key|client[_-]?secret|authorization|cookie|x[_-]api[_-]?key)$/i;

/**
 * Recursion depth cap. Beyond this, a subtree is masked wholesale to `***` rather
 * than trusted — mirrors `sanitizePayloadForWs`'s `MAX_SANITIZE_DEPTH`, which was
 * added because an unbounded walk over low-trust LLM/tool output can blow the
 * stack (or hide a secret past the depth an audit reaches).
 */
export const MAX_REDACT_DEPTH = 10;

/** 값-패턴 마스커가 남기는 마커. 집합 의미는 {@link MASKED_MARKERS} 참조. */
export const VALUE_MASK_MARKER = '***';
/** 키-이름 마스커(`sanitizePayloadForWs` · webhook ingestion)가 남기는 마커. */
export const KEY_MASK_MARKER = '[REDACTED]';
/** 깊이 상한 초과 서브트리를 통째로 대체하는 마커. */
export const DEPTH_MASK_MARKER = '[REDACTED_DEPTH]';

/**
 * 앞선 마스킹 층이 이미 남긴 마커들. 이 값들을 **다시 마스킹하지 않는다.**
 *
 * ## 왜 필요한가 — 마커를 덮으면 계약이 깨진다
 *
 * 이 저장소에는 값-마스커가 **여럿**이고 서로 다른 마커를 쓴다. 그래서 두 층이 겹치면
 * 뒤에 도는 쪽이 앞 층의 마커를 지운다:
 *
 * | 앞선 층 | 마커 | 겹치는 자리 |
 * |---|---|---|
 * | webhook ingestion (`sanitizeResponseHeaders`) | `[REDACTED]` | `Execution.inputData.headers.*` — 읽기 경로 마스킹과 겹친다 |
 * | `sanitizePayloadForWs` (WS 키-이름) | `[REDACTED]` | fanout 분기 직전 — emit 값-마스킹과 겹친다 |
 * | `sanitizePayloadForWs` 깊이 상한 | `[REDACTED_DEPTH]` | 같은 위 |
 *
 * `[REDACTED]` 는 **문서화된 계약**이다 — [12-webhook §5.3](../../../../../spec/5-system/12-webhook.md)
 * 이 규정하고 `1-manual-trigger.md`·`5-expression-language.md`·`4-execution-engine.md`·
 * `data-flow/10-triggers.md` 가 그 전제를 공유한다. 재마스킹하면 같은 헤더가 읽는 경로마다
 * 다르게 보인다 — 이 저장소가 마스킹 연쇄 작업으로 없애 온 바로 그 병이다.
 *
 * **안전 방향은 한쪽으로만 열린다**: 절대 unmask 하지 않고, 이미 마스킹된 값을 다시 덮지
 * 않을 뿐이다. 마커 문자열 자체는 시크릿이 아니므로 보존해도 노출이 늘지 않는다.
 *
 * > **프런트 미러가 있다**: `frontend/src/lib/utils/masked-markers.ts` 의 `MASKED_MARKERS`
 * > 가 같은 집합을 복제해 **마스킹된 값을 프리필·제출하지 않는** 가드 셋(폼 프리필 ·
 * > Re-run 모달 · 에디터 히스토리 로드)에 쓴다. 이 집합을 바꾸면 그쪽도 함께 갱신해야
 * > 한다 — 어긋나면 그 가드들이 조용히 뚫린다.
 * >
 * > 2026-08-20 에 `dynamic-form-ui.tsx` 안에서 `lib/utils/` 로 승격됐다(소비처 셋).
 */
export const MASKED_MARKERS: ReadonlySet<string> = Object.freeze(
  new Set([VALUE_MASK_MARKER, KEY_MASK_MARKER, DEPTH_MASK_MARKER]),
);

/**
 * 값 전체가 마스킹 마커와 **정확히 일치**하는가.
 *
 * > **2026-08-20 에 export 로 승격했다** — 재제출 거부 가드(EIA §R17, Manual 실행 경로)가
 * > 같은 판정을 서버에서 쓴다. 복제하지 않은 이유는 이 시리즈가 미러 발산으로 반복해
 * > 뚫렸기 때문이다: 한쪽만 마커를 늘리면 다른 쪽이 그 마커에 대해 조용히 fail-open 한다.
 * > 같은 프로세스 안이라 공유하지 못할 이유가 없다.
 */
export function isMaskedMarker(v: unknown): boolean {
  return typeof v === 'string' && MASKED_MARKERS.has(v);
}

/** {@link deepRedactSecretsPreserving} 전용 옵션. 기본 경로는 빈 객체를 쓴다. */
interface DeepRedactOptions {
  /**
   * 이 키의 **하위 트리 전체**를 손대지 않는다. 에디터 전용 raw 디버그 필드
   * (`llmCalls`)를 내부 WS wire 에 원문으로 남기기 위한 것 — 그 필드는 fanout 에서
   * `stripExternalOnlyFields` 가 통째로 제거하므로 외부로는 애초에 나가지 않는다.
   */
  readonly preserveKeys?: ReadonlySet<string>;
}

const NO_OPTS: DeepRedactOptions = {};

/** A string that is itself a JSON object/array (e.g. tool-call `arguments`). */
function looksLikeJson(s: string): boolean {
  const t = s.trimStart();
  return t.startsWith('{') || t.startsWith('[');
}

/**
 * Depth-0 result cache keyed by input object identity — mirrors
 * `sanitizePayloadForWs`'s `SANITIZE_CACHE`. A payload re-emitted N times (e.g.
 * ForEach fanout) is deep-walked once. WeakMap so entries are GC'd with the
 * object; only depth-0 is cached (subtrees are reached via a cache-hit parent).
 */
const DEEP_REDACT_CACHE = new WeakMap<object, unknown>();

/**
 * Recursively mask secrets in a structured value (objects/arrays walked
 * depth-first):
 * - **string leaf**: masked JSON-safely — if it is itself JSON
 *   ({@link looksLikeJson}) it is routed through {@link redactSecretsInJsonString}
 *   so the JSON isn't corrupted; otherwise flat {@link redactSecrets}.
 * - **value under a credential-named key** ({@link CREDENTIAL_KEY_PATTERN}):
 *   masked wholesale to `***`, whatever its type (string / object / array).
 * - depth beyond {@link MAX_REDACT_DEPTH}: masked wholesale (untrusted).
 *
 * **Copy-on-change**: subtrees with nothing masked are returned by the same
 * reference (mirrors `sanitizePayloadForWs`), so the input is never mutated and
 * unchanged structures keep their identity.
 *
 * Use for structured public-surface fields (conversation-thread `turns[].data` /
 * `presentations[].payload`, `ai_message.messages[]`, EIA `nodeOutput`) where a
 * flat string-level `redactSecrets` cannot reach nested string values.
 */
export function deepRedactSecrets(value: unknown, depth = 0): unknown {
  // depth-0 cache: same object identity → walk once (mirrors sanitizePayloadForWs).
  // **캐시는 이 기본 경로 전용이다** — 캐시 키가 객체 identity 뿐이라, 옵션이 다른
  // 변형({@link deepRedactSecretsPreserving})까지 같은 캐시를 쓰면 같은 객체에 대해
  // 다른 옵션의 결과를 돌려준다. 그 변형은 캐시를 쓰지 않는다.
  if (depth === 0 && value !== null && typeof value === 'object') {
    const cached = DEEP_REDACT_CACHE.get(value);
    if (cached !== undefined) return cached;
    const result = deepRedactCore(value, 0, NO_OPTS);
    DEEP_REDACT_CACHE.set(value, result);
    return result;
  }
  return deepRedactCore(value, depth, NO_OPTS);
}

/**
 * {@link deepRedactSecrets} 와 같은 마스킹이되 `preserveKeys` 하위 트리는 **손대지 않는다**.
 *
 * 유일한 호출부는 WS emit 의 내부 wire 분기다 — `llmCalls`(에디터 전용 raw LLM 요청/응답)를
 * 원문으로 남겨야 하기 때문이다. 그 필드는 fanout 에서 `stripExternalOnlyFields` 가 통째로
 * 제거하므로 **외부로는 어차피 안 나간다**. 이 예외가 없으면 값-마스킹이 에디터의 디버깅
 * 탈출구를 파괴해, WS §Rationale `llmCalls` strip-only 결정이 *"값-레벨 마스킹은 에디터
 * 디버깅 가치를 훼손한다"* 며 기각한 그 상태가 된다.
 *
 * **캐시를 쓰지 않는다** — 위 {@link deepRedactSecrets} 주석의 이유.
 */
export function deepRedactSecretsPreserving(
  value: unknown,
  preserveKeys: ReadonlySet<string>,
): unknown {
  return deepRedactCore(value, 0, { preserveKeys });
}

/**
 * 두 공개 진입점이 공유하는 walk. 마스킹 규칙을 한 곳에 두어 변형이 늘어도 규칙이
 * 갈리지 않게 한다 (이 저장소가 반복해 겪은 *"자매 중 하나만"* 방지).
 */
function deepRedactCore(
  value: unknown,
  depth: number,
  opts: DeepRedactOptions,
): unknown {
  if (typeof value === 'string') {
    return looksLikeJson(value)
      ? redactSecretsInJsonString(value, depth)
      : redactSecrets(value);
  }
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_REDACT_DEPTH) return VALUE_MASK_MARKER;
  return deepRedactObject(value, depth, opts);
}

/** Object/array walk for {@link deepRedactCore} (value is a non-null object). */
function deepRedactObject(
  value: object,
  depth: number,
  opts: DeepRedactOptions,
): unknown {
  if (Array.isArray(value)) {
    let mutated = false;
    const out = value.map((v) => {
      const r = deepRedactCore(v, depth + 1, opts);
      if (r !== v) mutated = true;
      return r;
    });
    return mutated ? out : value;
  }
  let result: Record<string, unknown> | null = null;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    let r: unknown;
    if (opts.preserveKeys?.has(k)) {
      // 하위 트리 통째 보존 — 내려가지 않는다.
      r = v;
    } else if (
      v !== null &&
      v !== undefined &&
      v !== '' &&
      CREDENTIAL_KEY_PATTERN.test(k)
    ) {
      // 이미 앞선 층이 마스킹한 값이면 그 마커를 **덮지 않는다** ({@link MASKED_MARKERS}).
      r = isMaskedMarker(v) ? v : VALUE_MASK_MARKER;
    } else {
      r = deepRedactCore(v, depth + 1, opts);
    }
    if (r !== v) {
      if (!result) result = { ...(value as Record<string, unknown>) };
      result[k] = r;
    }
  }
  return result ?? value;
}

/**
 * JSON-safe secret masking for a **raw JSON string** (e.g. an LLM tool call's
 * `arguments`). Token-level masking of the raw string would corrupt the JSON
 * (`{"api_key":"x"}` → `{***}`), so we parse → {@link deepRedactSecrets} the
 * structure → re-serialize. Non-JSON (or not-object/array-looking) input is plain
 * text, so `redactSecrets` is applied directly (no structure to corrupt) — this
 * also avoids `JSON.parse` reinterpreting a bare numeric string and losing large
 * integer precision on re-serialize. Returns the input unchanged when nothing
 * was masked.
 */
export function redactSecretsInJsonString(raw: string, depth = 0): string {
  if (typeof raw !== 'string' || raw.length === 0) return raw;
  if (!looksLikeJson(raw)) return redactSecrets(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return redactSecrets(raw);
  }
  const red = deepRedactSecrets(parsed, depth + 1);
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
