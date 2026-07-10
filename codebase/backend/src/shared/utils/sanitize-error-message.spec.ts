import {
  deepRedactSecrets,
  LAST_ERROR_MESSAGE_MAX_LEN,
  redactSecrets,
  redactSecretsInJsonString,
  sanitizeLastErrorMessage,
} from './sanitize-error-message';

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
