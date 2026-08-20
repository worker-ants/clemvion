import {
  deepRedactSecrets,
  deepRedactSecretsPreserving,
  isMaskedMarker,
  LAST_ERROR_MESSAGE_MAX_LEN,
  MASKED_MARKERS,
  redactSecrets,
  redactSecretsInJsonString,
  sanitizeLastErrorMessage,
  VALUE_MASK_MARKER,
} from './sanitize-error-message';

/**
 * **`MASKED_MARKERS` 는 실제로 불변이어야 한다** (`02_04_38` maintainability W3).
 *
 * 이 상수는 `export` 로 승격돼 **두 판정기가 공유**한다 — egress 마스킹(`isMaskedMarker`)과
 * 재제출 거부(`findMaskedResubmissions`). 변형되면 둘이 동시에 오염된다.
 *
 * > **`Object.freeze(new Set(...))` 는 플라시보였다.** `Set` 의 데이터는 own property 가
 * > 아니라 **내부 슬롯**에 있어서 `freeze` 가 `.add()` 를 전혀 막지 못한다(실측: freeze 후
 * > `.add('c')` 성공, size 증가). 그런데 직전 라운드 RESOLUTION 은 *"런타임에서도 막았다"*
 * > 고 적었다 — **존재하지 않는 보장을 문서가 서술**한 것이다.
 * >
 * > `readonly string[]` + `Object.freeze` 로 바꿔 실제 불변성을 확보했고, 이 캐너리가 그
 * > 보장을 기계에 맡긴다. `Set` 으로 되돌리면 여기가 RED 다.
 */
describe('MASKED_MARKERS 불변성', () => {
  it('[캐너리] 런타임 변형이 실제로 차단된다', () => {
    expect(Object.isFrozen(MASKED_MARKERS)).toBe(true);
    expect(() => {
      (MASKED_MARKERS as string[]).push('injected');
    }).toThrow(TypeError);
    expect(isMaskedMarker('injected')).toBe(false);
  });

  it('마커 집합이 이 리터럴에서 이탈하지 않는다 (프런트 미러 대조용)', () => {
    expect([...MASKED_MARKERS]).toEqual([
      '***',
      '[REDACTED]',
      '[REDACTED_DEPTH]',
    ]);
    expect(isMaskedMarker(VALUE_MASK_MARKER)).toBe(true);
    expect(isMaskedMarker('a***b')).toBe(false);
  });
});

describe('redactSecrets (mask-only)', () => {
  it('masks Bearer tokens', () => {
    const out = redactSecrets('sent Bearer sk-live-abc123.DEF-456 to provider');
    expect(out).not.toContain('sk-live-abc123.DEF-456');
    expect(out).toContain('***');
  });

  it('masks Authorization header values', () => {
    expect(redactSecrets('Authorization: Bearer xyz')).not.toContain('xyz');
  });

  it('masks space-containing Authorization credentials (Basic/Digest) to end of line', () => {
    // Regression: a `\S+`-terminated pattern only masked the scheme, leaking the
    // base64 credential. Full-value masking must hide `dXNlcjpwYXNz`.
    const out = redactSecrets('Authorization: Basic dXNlcjpwYXNz');
    expect(out).not.toContain('dXNlcjpwYXNz');
    expect(out).toContain('***');
    // ...but not bleed past the line.
    const two = redactSecrets(
      'Authorization: Basic dXNlcjpwYXNz\nnext line ok',
    );
    expect(two).toContain('next line ok');
    expect(two).not.toContain('dXNlcjpwYXNz');
  });

  it.each([
    ['client_secret=super', 'super'],
    ['access_token: "abc123"', 'abc123'],
    ['api-key=AKIAEXAMPLE', 'AKIAEXAMPLE'],
    ['password: hunter2', 'hunter2'],
    ['secret=topsecret', 'topsecret'],
  ])('masks secret-keyword assignment %s', (input, leak) => {
    const out = redactSecrets(input);
    expect(out).not.toContain(leak);
    expect(out).toContain('***');
  });

  it('leaves non-secret text unchanged', () => {
    const clean = 'user clicked the submit button on the form';
    expect(redactSecrets(clean)).toBe(clean);
  });

  it('masks a bare JWT (no Bearer prefix)', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const out = redactSecrets(`invalid token: ${jwt}`);
    expect(out).not.toContain(jwt);
    expect(out).toContain('***');
  });

  it('masks URI userinfo scheme-preservingly (only user:pass → ***, scheme/host survive)', () => {
    const out = redactSecrets(
      'connect https://admin:supersecret@internal.example.com/path failed',
    );
    expect(out).not.toContain('supersecret');
    expect(out).not.toContain('admin:');
    // scheme-preserving: `scheme://***@host/path`.
    expect(out).toContain('https://***@internal.example.com/path');
  });

  it('masks non-DB URI userinfo too (redis/custom schemes)', () => {
    expect(redactSecrets('redis://u:p4ss@cache:6379')).toContain(
      'redis://***@cache:6379',
    );
    expect(redactSecrets('amqp://guest:s3cr3t@mq')).toContain('amqp://***@mq');
  });

  it('masks a password containing an embedded colon (whole credential → ***)', () => {
    // Password segment allows ':' (bounded by the `@` lookahead), so the full
    // `user:pa:ss` credential is masked rather than leaving a tail exposed.
    const out = redactSecrets('https://admin:pa:ss@host/x');
    expect(out).not.toContain('pa:ss');
    expect(out).toContain('https://***@host/x');
  });

  it('masks an alg=none JWT (empty/absent signature segment)', () => {
    const jwt = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1c2VyLTEyMyJ9.';
    const out = redactSecrets(`token=${jwt} rejected`);
    expect(out).not.toContain('eyJzdWIiOiJ1c2VyLTEyMyJ9');
    expect(out).toContain('***');
  });

  it('masks userinfo before an IPv6 host', () => {
    const out = redactSecrets('https://admin:s3cret@[::1]:8080/x');
    expect(out).not.toContain('s3cret');
    expect(out).not.toContain('admin:');
    expect(out).toContain('[::1]:8080/x'); // host survives
  });

  it.each([
    'the eyeball tracker eyJustKidding word', // `ey`-word, not a JWT triple
    'visit https://example.com/eyJ-looks-like for docs', // URL, no userinfo
    'ratio was 3:4 at scale', // colon in prose
    'see http://localhost:3000/health', // host:port, no userinfo `user:pass@`
    'ipv6 endpoint https://[::1]:8080/health up', // IPv6 host, no userinfo
    'clone git@github.com:org/repo.git done', // SSH shorthand (no `://`)
  ])('does not false-positive on %s', (clean) => {
    expect(redactSecrets(clean)).toBe(clean);
  });

  it('does NOT truncate long masked output (unlike sanitizeLastErrorMessage)', () => {
    const long = 'clean prose. '.repeat(50); // > 200 chars, no secrets
    expect(long.length).toBeGreaterThan(LAST_ERROR_MESSAGE_MAX_LEN);
    expect(redactSecrets(long)).toBe(long);
    expect(redactSecrets(long)).not.toContain('…');
  });

  it('returns non-string / empty input unchanged', () => {
    expect(redactSecrets('')).toBe('');
    expect(redactSecrets(undefined as never)).toBeUndefined();
  });

  it('is idempotent across repeated calls (shared g-flag regex lastIndex reset)', () => {
    const input = 'Authorization: Bearer tok123 and api_key=k456';
    const first = redactSecrets(input);
    expect(redactSecrets(input)).toBe(first);
    expect(redactSecrets(input)).toBe(first);
  });
});

describe('sanitizeLastErrorMessage (mask + truncate)', () => {
  it('masks secrets like redactSecrets', () => {
    const out = sanitizeLastErrorMessage('failed: Bearer sk-leak-999');
    expect(out).not.toContain('sk-leak-999');
    expect(out).toContain('***');
  });

  it('truncates masked output beyond the cap with an ellipsis', () => {
    const long = 'x'.repeat(LAST_ERROR_MESSAGE_MAX_LEN + 50);
    const out = sanitizeLastErrorMessage(long);
    expect(out.length).toBe(LAST_ERROR_MESSAGE_MAX_LEN + 1); // +1 for the '…'
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('deepRedactSecrets (recursive, copy-on-change)', () => {
  it('masks value-pattern secrets in nested string leaves', () => {
    const input = {
      a: 'clean',
      b: { note: 'Authorization: Bearer sk-DEEP-1' },
      c: ['plain', 'api_key=AKIADEEP2'],
    };
    const out = deepRedactSecrets(input) as typeof input;
    expect(out.b.note).not.toContain('sk-DEEP-1');
    expect(out.c[1]).not.toContain('AKIADEEP2');
    expect(out.a).toBe('clean');
  });

  it('masks bare values under credential-named keys (key-based)', () => {
    const input = { config: { api_key: 'AKIABARE1', name: 'ok' } };
    const out = deepRedactSecrets(input) as typeof input;
    expect(out.config.api_key).toBe('***');
    expect(out.config.name).toBe('ok'); // non-credential key untouched
  });

  it('returns the same reference when nothing is masked (copy-on-change)', () => {
    const input = { a: 'clean', b: { c: ['no', 'secrets', 'here'] } };
    expect(deepRedactSecrets(input)).toBe(input);
  });

  it('does not mutate the input', () => {
    const input = { note: 'Bearer sk-NOMUT-3' };
    deepRedactSecrets(input);
    expect(input.note).toBe('Bearer sk-NOMUT-3');
  });

  it('passes through non-string primitives', () => {
    expect(deepRedactSecrets(42)).toBe(42);
    expect(deepRedactSecrets(null)).toBe(null);
    expect(deepRedactSecrets(true)).toBe(true);
  });

  it('masks a credential-named key whose value is an object/array (wholesale, any type)', () => {
    const input = {
      token: { nested: 'AKIAOBJ1', deeper: { x: 1 } },
      list_secret: ['a', 'b'],
    };
    const out = deepRedactSecrets(input) as Record<string, unknown>;
    // Named credential keys are masked wholesale regardless of value shape,
    // mirroring sanitizePayloadForWs.
    expect(out.token).toBe('***');
  });

  it('handles a JSON-string leaf JSON-safely (no corruption)', () => {
    // A string leaf that is itself JSON (tool-call arguments) must not be
    // flat-masked into invalid JSON.
    const input = { args: '{"Authorization":"Bearer sk-LEAF-1"}' };
    const out = deepRedactSecrets(input) as { args: string };
    expect(() => JSON.parse(out.args)).not.toThrow();
    expect(out.args).not.toContain('sk-LEAF-1');
  });

  it('caps recursion depth (deep nesting is masked wholesale, no stack blowup)', () => {
    // Build nesting deeper than MAX_REDACT_DEPTH.
    let deep: Record<string, unknown> = { leaf: 'Bearer sk-DEEP-END' };
    for (let i = 0; i < 25; i++) deep = { n: deep };
    expect(() => deepRedactSecrets(deep)).not.toThrow();
  });

  it('caches by object identity (repeated calls return the same masked result)', () => {
    const input = { note: 'Bearer sk-CACHE-1', ok: 'plain' };
    const first = deepRedactSecrets(input) as { note: string };
    // Same input object → cached result reference (walked once).
    expect(deepRedactSecrets(input)).toBe(first);
    expect(first.note).not.toContain('sk-CACHE-1');
  });
});

describe('redactSecretsInJsonString (JSON-safe)', () => {
  it('masks a secret inside a JSON string while keeping it valid JSON', () => {
    const json = '{"headers":{"Authorization":"Bearer sk-JSON-9"},"n":1}';
    const out = redactSecretsInJsonString(json);
    expect(out).not.toContain('sk-JSON-9');
    const parsed = JSON.parse(out) as {
      headers: { Authorization: string };
      n: number;
    };
    expect(parsed.headers.Authorization).toContain('***');
    expect(parsed.n).toBe(1);
  });

  it('does NOT corrupt JSON structure (regression: `{"api_key":"x"}` must not become `{***}`)', () => {
    const json = '{"api_key":"AKIAJSON10"}';
    const out = redactSecretsInJsonString(json);
    expect(() => JSON.parse(out)).not.toThrow();
    expect(out).not.toContain('AKIAJSON10');
  });

  it('falls back to flat masking for non-JSON input', () => {
    const out = redactSecretsInJsonString('not json: Bearer sk-FLAT-11');
    expect(out).not.toContain('sk-FLAT-11');
    expect(out).toContain('***');
  });

  it('returns input unchanged when the JSON has no secrets', () => {
    const json = '{"a":1,"b":"hello"}';
    expect(redactSecretsInJsonString(json)).toBe(json);
  });

  it('does not JSON-parse bare numeric strings (avoids large-integer precision loss)', () => {
    // A big-int-as-text is not a JSON object/array, so it must be treated as flat
    // text (unchanged), NOT parsed and re-serialized (which would lose precision).
    const bigIntStr = '900719925474099123';
    expect(redactSecretsInJsonString(bigIntStr)).toBe(bigIntStr);
  });
});

/**
 * **앞선 마스킹 층의 마커를 덮지 않는다** — 계약 캐너리.
 *
 * 이 저장소에는 값-마스커가 여럿이고 마커가 다르다. 뒤에 도는 쪽이 앞 층의 마커를
 * 덮으면 *같은 값이 읽는 경로마다 다르게 보인다* — 마스킹 연쇄 작업이 없애 온 병이다.
 * 특히 `[REDACTED]` 는 [12-webhook §5.3] 이 규정하고 4개 문서가 전제를 공유하는
 * **문서화된 계약**이라, 여기가 RED 로 바뀌면 그 계약이 깨졌다는 뜻이다.
 */
describe('deepRedactSecrets — 기존 마스킹 마커 보존 (계약 캐너리)', () => {
  it('webhook ingestion 의 `[REDACTED]` 헤더 마커를 `***` 로 덮지 않는다', () => {
    const stored = {
      headers: {
        authorization: '[REDACTED]',
        cookie: '[REDACTED]',
        'content-type': 'application/json',
      },
    };
    expect(deepRedactSecrets(stored)).toEqual(stored);
  });

  it('WS 키-마스킹의 `[REDACTED]` · 깊이 상한의 `[REDACTED_DEPTH]` 도 보존', () => {
    const wire = {
      apiKey: '[REDACTED]',
      nested: { token: '[REDACTED_DEPTH]' },
    };
    expect(deepRedactSecrets(wire)).toEqual(wire);
  });

  it('이미 `***` 인 값도 그대로 (멱등)', () => {
    const once = deepRedactSecrets({ api_key: 'k-1' });
    expect(deepRedactSecrets(once)).toEqual({ api_key: '***' });
  });

  it('**마커가 아닌** 진짜 값은 여전히 마스킹한다 (보존이 구멍이 되지 않음)', () => {
    // 이 단언이 없으면 위 세 테스트는 "전부 보존" 구현으로도 초록이 된다.
    expect(deepRedactSecrets({ authorization: 'Bearer sk-live-real' })).toEqual(
      {
        authorization: '***',
      },
    );
    expect(
      deepRedactSecrets({ api_key: '[REDACTED_BUT_NOT_A_MARKER]' }),
    ).toEqual({ api_key: '***' });
  });
});

/**
 * `preserveKeys` — 내부 WS wire 가 에디터 전용 raw 디버그(`llmCalls`)를 지키는 장치.
 * 이 예외가 없으면 값-마스킹이 WS §Rationale 의 strip-only 결정이 기각한 상태
 * (*"값-레벨 마스킹은 에디터 디버깅 가치를 훼손"*)를 만든다.
 */
describe('deepRedactSecretsPreserving', () => {
  const PRESERVE: ReadonlySet<string> = new Set(['llmCalls']);

  it('preserveKeys 하위 트리는 원문 그대로 (참조까지 동일)', () => {
    const llmCalls = [
      { requestPayload: { system: 'Authorization: Bearer raw-abc' } },
    ];
    const out = deepRedactSecretsPreserving(
      { message: 'auth failed: Bearer sk-live-xyz', llmCalls },
      PRESERVE,
    ) as Record<string, unknown>;
    // 보존 — 에디터가 원문을 본다
    expect(out.llmCalls).toBe(llmCalls);
    // 그 밖은 정상 마스킹 — 보존이 전체를 무력화하지 않는다
    expect(out.message).toBe('auth failed: ***');
  });

  it('깊이 무관하게 보존한다 (중첩 turnDebug 경로)', () => {
    const nested = {
      nodeOutput: {
        meta: { turnDebug: [{ llmCalls: [{ raw: 'Bearer q' }] }] },
      },
    };
    const out = deepRedactSecretsPreserving(nested, PRESERVE) as {
      nodeOutput: {
        meta: { turnDebug: Array<{ llmCalls: Array<{ raw: string }> }> };
      };
    };
    expect(out.nodeOutput.meta.turnDebug[0].llmCalls[0].raw).toBe('Bearer q');
  });

  it('preserveKeys 가 비면 deepRedactSecrets 와 같은 결과', () => {
    const input = { message: 'Bearer sk-live-xyz', api_key: 'k' };
    expect(deepRedactSecretsPreserving(input, new Set())).toEqual(
      deepRedactSecrets(input),
    );
  });

  it('캐시를 공유하지 않는다 — 같은 객체를 두 모드로 불러도 서로 오염되지 않는다', () => {
    // deepRedactSecrets 는 depth-0 을 WeakMap 캐시한다. 그 캐시를 preserving 변형이
    // 함께 쓰면 먼저 부른 쪽 결과가 반대편으로 새어 나간다.
    const shared = { llmCalls: [{ raw: 'Bearer keep-me' }] };
    const masked = deepRedactSecrets(shared) as { llmCalls: [{ raw: string }] };
    const preserved = deepRedactSecretsPreserving(shared, PRESERVE) as {
      llmCalls: [{ raw: string }];
    };
    expect(masked.llmCalls[0].raw).toBe('***');
    expect(preserved.llmCalls[0].raw).toBe('Bearer keep-me');
  });
});

/**
 * `token` 계열 — **두 축**을 각각 겨눈다 (2026-08-17).
 *
 * 착수 전 무수정 프로브로 실측한 결함: 값-패턴 목록은 `access_token` 은 담으면서
 * bare `token` 이 없었고(단독 `secret` 패턴은 있는데 `token` 은 없는 비대칭), 키-이름
 * 목록은 반대로 bare `token` 만 있고 **접두형이 전부 빠져** `{csrf_token: …}` 이 평문으로
 * 나갔다. 한 축만 고치면 다른 축이 조용히 남으므로 **양쪽을 같은 표로 고정**한다.
 */
describe('token 계열 — 값 축과 키 축을 같은 표로 고정', () => {
  const FAMILY = [
    'token',
    'access_token',
    'refresh-token',
    'id_token',
    'csrf_token',
    'csrfToken',
    'session_token',
    'x-auth-token',
  ];

  it.each(FAMILY)('값 축: `%s=…` 를 마스킹한다', (key) => {
    expect(redactSecrets(`${key}=sk-live-abc123`)).toBe('***');
  });

  it.each(FAMILY)('키 축: `{%s: …}` 를 마스킹한다', (key) => {
    expect(deepRedactSecrets({ [key]: 'sk-live-abc123' })).toEqual({
      [key]: '***',
    });
  });

  it('값 축: 따옴표·쿼리스트링 형태도 잡는다', () => {
    expect(redactSecrets('{"csrf_token":"sk-live-abc123"}')).toContain('***');
    // 자매 테스트(`mcp-error-codes.spec.ts`)처럼 **비-시크릿 파라미터 보존**도 함께
    // 단언한다. 이것이 없으면 패턴이 줄 전체를 삼키도록 넓어져도 초록이다.
    const qs = redactSecrets('cb?token=sk-live-abc123&state=x');
    expect(qs).not.toContain('sk-live-abc123');
    expect(qs).toContain('state=x');
  });

  /**
   * **오탐 경계** — `token` 으로 *시작하지만* 자격증명이 아닌 식별자는 건드리지 않는다.
   * 패턴은 `token` 으로 **끝나는** 이름만 겨눈다. 이 캐너리가 없으면 누가 부분일치로
   * 넓혔을 때 정상 설정값이 조용히 `***` 가 된다.
   */
  it('[캐너리] `tokenizer=` 처럼 token 으로 시작만 하는 키는 보존한다', () => {
    expect(redactSecrets('tokenizer=lodash')).toBe('tokenizer=lodash');
    expect(redactSecrets('tokenized text here')).toBe('tokenized text here');
  });

  /**
   * **받아들이는 오탐** — 불투명 커서(`nextPageToken`)도 마스킹된다. 마스킹은 egress
   * 전용이고 DB 는 원문을 갖고 있어 다운스트림 노드는 실제 커서를 그대로 읽는다. 즉
   * 비용은 화면 가시성 하나뿐이다. 이 캐너리는 그 결정을 **기록**한다 — 좁히려는 사람이
   * 재발견 대신 결정을 먼저 보게 된다.
   */
  it('[캐너리] 불투명 커서도 마스킹된다 — 의도된 오탐', () => {
    expect(deepRedactSecrets({ nextPageToken: 'CURSOR-123' })).toEqual({
      nextPageToken: '***',
    });
  });
});
