/**
 * Shared sanitizer for error messages that may contain OAuth tokens, API keys,
 * and other secrets. Originally defined in integration-oauth.service; extracted
 * to this neutral location so execution-engine and other non-OAuth modules can
 * import without creating a cross-layer dependency.
 *
 * 2026-05-19 (arch-C2) — moved from modules/integrations/integration-oauth.service.ts.
 */

import {
  DEPTH_MASK_MARKER,
  isMaskedMarker,
  KEY_MASK_MARKER,
  MASKED_MARKERS,
  MAX_MASK_DEPTH,
  VALUE_MASK_MARKER,
} from '@workflow/masked-markers';

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
 *     흡수(파편화 제거, `mcp-error-codes.ts`).
 *
 * 2026-10-05 — fetch(undici) 헤더 값 검증 오류의 따옴표 안을 통째로 가리는 패턴을 추가했다
 * (NERV Task `CLE-T-H0GF4K`). 줄바꿈을 넘어 잡는 유일한 패턴이라 길이 상한(2048)을 둬서
 * 선형 시간을 지킨다. */
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
  // fetch(undici) 의 헤더 값 검증 오류: `Headers.append: "<값>" is an invalid header value.`
  // 값 전체(봇 토큰 등)가 따옴표 안에 실린다. `Bearer` 패턴은 값 안의 CR · LF · NUL 에서
  // 멈추므로 따옴표 안을 통째로 가린다. 상한 안에서 마지막 종결 문구까지 greedy 로 잡아 값 안에
  // 종결 문구가 끼어도 뒷부분이 남지 않는다. 결과는 `Headers.append: "***" is an invalid header value.`
  // (2026-10-05, NERV Task `CLE-T-H0GF4K`, Node 24 실측 원문).
  // 상한(2048자)은 시간 복잡도 때문이다. 상한 없는 `[\s\S]*` 는 여는 모양마다 문자열 끝까지
  // 갔다 돌아와 종결 문구 없는 적대 입력에서 이차 시간이었다(192KB 4.3초 → 상한 2048 은 77ms).
  // 헤더 값이 2048자를 넘으면 이 패턴은 걸리지 않는다. 봇 토큰은 DTO 가 256자로 막는다.
  /(?<=\bHeaders\.[A-Za-z]+: ")[\s\S]{0,2048}(?=" is an invalid header value)/g,
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
 * **`redactSecrets` 의 대용이 아니다.** 호출한 쪽이 이미 들고 있는 비밀(시크릿 저장소에서 푼
 * 평문)과 글자 그대로 같은 부분을 모두 {@link VALUE_MASK_MARKER} 로 바꾼다. 값 패턴을 추측하지
 * 않으므로 접두 없는 토큰도 가리고 오탐이 없다.
 *
 * 쓰는 자리는 나가는 시점이 아니라 **만든 자리**다. 외부 API 클라이언트가 실패 원문을 돌려주거나
 * 로그에 남기기 전에 그 호출에 쓴 비밀을 지운다. 그 원문은 진단 필드(예: 트리거의
 * `chat_channel_last_error`)에 저장되고 로그로도 가는데, 시크릿 저장소 평문은 DB 와 로그에
 * 닿으면 안 된다. 나가는 시점의 {@link redactSecrets} 는 미리 알 수 없는 모양을 막는 두 번째
 * 층으로 따로 건다.
 *
 * fetch 는 헤더 값의 양끝 HTTP 공백(SP · TAB · CR · LF)을 떼고 검증해 **뗀 값**을 오류 원문에
 * 싣는다. 여러 줄을 붙여 넣은 토큰(`xoxb-…\n…\n`)이 그렇다. 그래서 원문 그대로의 비밀과 함께
 * 양끝 공백을 뗀 변형도 가린다. 긴 변형부터 바꿔 원문에 그대로 실린 경우 끝 공백까지 가린다.
 *
 * `secret` 이 비었거나 공백뿐이거나 문자열이 아니면 아무것도 바꾸지 않는다(빈 문자열로 쪼개면
 * 원문 전체가 깨진다). 아주 짧은 비밀은 원문의 다른 글자까지 바꿔 문장이 읽기 어려워질 수 있다.
 * 그런 값은 쓸 수 있는 자격 증명이 아니라 받아들인다.
 */
export function replaceKnownSecret(text: string, secret: string): string {
  if (typeof text !== 'string' || typeof secret !== 'string') return text;
  let out = text;
  for (const variant of knownSecretVariants(secret)) {
    out = out.split(variant).join(VALUE_MASK_MARKER);
  }
  return out;
}

/** 비밀 원문과 양끝 HTTP 공백을 뗀 변형들. 긴 것부터, 비거나 공백뿐인 것은 뺀다. */
function knownSecretVariants(secret: string): string[] {
  if (secret.replace(HTTP_WHITESPACE_EDGES, '').length === 0) return [];
  const variants = new Set([
    secret,
    secret.replace(/[\t\n\r ]+$/, ''),
    secret.replace(/^[\t\n\r ]+/, ''),
    secret.replace(HTTP_WHITESPACE_EDGES, ''),
  ]);
  return [...variants].sort((a, b) => b.length - a.length);
}

const HTTP_WHITESPACE_EDGES = /^[\t\n\r ]+|[\t\n\r ]+$/g;

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
 * than trusted — an unbounded walk over low-trust LLM/tool output can blow the
 * stack (or hide a secret past the depth an audit reaches).
 *
 * **`MAX_MASK_DEPTH` 의 지역 별칭**이다. 이 수는 프런트 마커 스캐너와 **함께 움직여야**
 * 하므로 SoT 는 `@workflow/masked-markers` 에 있다 — 마스커가 이 깊이에서 서브트리를
 * 치환하므로, 스캐너 상한이 더 작으면 그 차이만큼 가드가 조용히 뚫린다.
 *
 * > `sanitizePayloadForWs` 의 `MAX_SANITIZE_DEPTH` 는 **이것이 아니다.** 비교가
 * > `depth > N` 이라 마커를 한 칸 더 깊은 자리에 놓고, 프런트 스캐너는 WS 페이로드를
 * > 스캔하지 않는다(실측). 별개 불변식이므로 함께 움직이지 않는다.
 */
export const MAX_REDACT_DEPTH = MAX_MASK_DEPTH;

export {
  /** 값-패턴 마스커가 남기는 마커. 집합 의미는 {@link MASKED_MARKERS} 참조. */
  VALUE_MASK_MARKER,
  /** 키-이름 마스커(`sanitizePayloadForWs` · webhook ingestion)가 남기는 마커. */
  KEY_MASK_MARKER,
  /** 깊이 상한 초과 서브트리를 통째로 대체하는 마커. */
  DEPTH_MASK_MARKER,
};

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
 * `[REDACTED]` 는 **문서화된 계약**이다 — [웹훅 「수신 헤더 마스킹」](CLE-TRIG-WEBHOOK#수신-헤더-마스킹)
 * 이 규정하고 [수동 트리거 노드 「웹훅 경로 (port `out`)」](CLE-NODE-MANUAL#웹훅-경로-port-out) ·
 * [표현식 언어 「`$trigger`: 웹훅 요청 뷰」](CLE-WF-EXPR#trigger-웹훅-요청-뷰) ·
 * [실행 컨텍스트 「트리거 입력 파라미터 싣기」](CLE-EXEC-CONTEXT#트리거-입력-파라미터-싣기) ·
 * [트리거 데이터와 흐름 「웹훅 진입」](CLE-TRIG-DATA#웹훅-진입) 가 그 전제를 공유한다. 재마스킹하면 같은 헤더가 읽는 경로마다
 * 다르게 보인다 — 이 저장소가 마스킹 연쇄 작업으로 없애 온 바로 그 병이다.
 *
 * **안전 방향은 한쪽으로만 열린다**: 절대 unmask 하지 않고, 이미 마스킹된 값을 다시 덮지
 * 않을 뿐이다. 마커 문자열 자체는 시크릿이 아니므로 보존해도 노출이 늘지 않는다.
 *
 * > **SoT 는 `@workflow/masked-markers` 다.** 프런트가 같은 집합을 보고 *마스킹된 값을
 * > 프리필·제출하지 않는* 가드 셋(폼 프리필 · Re-run 모달 · 에디터 히스토리 로드)을
 * > 돌린다. 예전엔 프런트가 이 파일을 **손으로 복제**했는데, 그 미러를 기계가 대조하게
 * > 하려니 CI 경로 게이팅에 막혀(한쪽 워크플로가 반대쪽 변경 때 검사를 생략한다) 아예
 * > 공유 패키지로 옮겼다. 이제 대조할 미러가 없다.
 */
export { MASKED_MARKERS };

/**
 * 값 전체가 마스킹 마커와 **정확히 일치**하는가.
 *
 * > 재제출 거부 가드(EIA §R17, Manual 실행 경로)와 egress 마스킹이 **같은 판정기**를 쓴다.
 * > 복제하지 않은 이유는 이 시리즈가 미러 발산으로 반복해 뚫렸기 때문이다 — 한쪽만 마커를
 * > 늘리면 다른 쪽이 그 마커에 대해 조용히 fail-open 한다.
 */
export { isMaskedMarker };

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
