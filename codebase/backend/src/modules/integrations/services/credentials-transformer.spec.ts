import {
  encryptJson,
  decryptJson,
  encryptedJsonTransformer,
  isUnreadableCredentials,
} from './credentials-transformer';

describe('credentials-transformer', () => {
  const ORIGINAL_KEY = process.env.INTEGRATION_ENCRYPTION_KEY;

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) {
      delete process.env.INTEGRATION_ENCRYPTION_KEY;
    } else {
      process.env.INTEGRATION_ENCRYPTION_KEY = ORIGINAL_KEY;
    }
  });

  it('roundtrips JSON with encryption enabled', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'unit-test-secret';
    const value = { access_token: 'secret', scopes: ['a', 'b'] };
    const enc = encryptJson(value);
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(enc).not.toContain('secret');
    expect(decryptJson(enc)).toEqual(value);
  });

  it('emits plain JSON string when key is missing', () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    const enc = encryptJson({ foo: 1 });
    expect(enc).toBe('{"foo":1}');
    expect(decryptJson(enc)).toEqual({ foo: 1 });
  });

  it('reads legacy JSONB object values transparently', () => {
    expect(decryptJson({ foo: 'bar' })).toEqual({ foo: 'bar' });
  });

  it('returns sentinel (does NOT throw) for tampered ciphertext', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'unit-test-secret';
    const enc = encryptJson({ a: 1 });
    const tampered = enc.slice(0, -4) + 'AAAA';
    const result = decryptJson(tampered);
    expect(isUnreadableCredentials(result)).toBe(true);
  });

  it('returns sentinel when ciphertext was written with a different key', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'old-key';
    const enc = encryptJson({ secret: 'value' });
    process.env.INTEGRATION_ENCRYPTION_KEY = 'new-key';
    const result = decryptJson(enc);
    expect(isUnreadableCredentials(result)).toBe(true);
  });

  it('returns sentinel when envelope is too short', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'unit-test-secret';
    const result = decryptJson('enc:v1:AQ==');
    expect(isUnreadableCredentials(result)).toBe(true);
  });

  it('returns sentinel for invalid base64 inside envelope', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'unit-test-secret';
    const result = decryptJson('enc:v1:!!!not-base64!!!');
    expect(isUnreadableCredentials(result)).toBe(true);
  });

  it('returns sentinel for unsupported version byte', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'unit-test-secret';
    // Build a syntactically valid envelope length with a non-0x01 version byte.
    const buf = Buffer.alloc(1 + 12 + 16 + 4);
    buf[0] = 0x99;
    const result = decryptJson('enc:v1:' + buf.toString('base64'));
    expect(isUnreadableCredentials(result)).toBe(true);
  });

  it('returns sentinel when env key is missing but stored value is encrypted', () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    const result = decryptJson('enc:v1:AAAAAAAA');
    expect(isUnreadableCredentials(result)).toBe(true);
  });

  it('returns sentinel for legacy plaintext that fails JSON.parse', () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    const result = decryptJson('not json at all');
    expect(isUnreadableCredentials(result)).toBe(true);
  });

  it('returns null for null/undefined input', () => {
    expect(decryptJson(null)).toBeNull();
    expect(decryptJson(undefined)).toBeNull();
  });

  it('sentinel value does not collide with real credential field names', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'unit-test-secret';
    // Encrypt a payload that itself uses common credential keys to make sure
    // we are not accidentally mistaking healthy decrypted data for a sentinel.
    const value = {
      access_token: 'a',
      refresh_token: 'r',
      scopes: ['x'],
      token: 't',
      value: 'v',
      header_name: 'X',
      url: 'https://x',
    };
    const enc = encryptJson(value);
    const result = decryptJson(enc);
    expect(isUnreadableCredentials(result)).toBe(false);
    expect(result).toEqual(value);
  });

  it('transformer to/from symmetry', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'unit-test-secret';
    const value = { x: 42 };
    const stored = encryptedJsonTransformer.to(value);
    expect(typeof stored).toBe('string');
    expect(encryptedJsonTransformer.from(stored)).toEqual(value);
  });

  it('transformer.from returns sentinel for unreadable stored value', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'unit-test-secret';
    const result = encryptedJsonTransformer.from('enc:v1:AQ==');
    expect(isUnreadableCredentials(result)).toBe(true);
  });

  // W-42 — e2e (integration-cafe24-install) 가 credentials 를 raw JSONB 로
  // INSERT 해 production 의 transformer 경로(encrypt → store as string →
  // decrypt) 를 우회한다. 그 갭을 unit 에서 메우기 위해 양 모드 (KEY 있음 /
  // 없음) 에서 transformer.to/from 이 동일한 row payload round-trip 보장을
  // 명시적으로 검증.
  it('transformer.to/from is symmetric in encryption mode (production path)', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'unit-test-secret';
    const credentials = {
      mall_id: 'shop',
      client_id: 'e2e-client-id',
      client_secret: 'super-secret',
      scopes: ['mall.read_product'],
    };
    const stored = encryptedJsonTransformer.to(credentials);
    expect(typeof stored).toBe('string');
    expect(stored as string).toMatch(/^enc:v1:/);
    expect(stored as string).not.toContain('super-secret');
    expect(encryptedJsonTransformer.from(stored)).toEqual(credentials);
  });

  it('transformer.to/from is symmetric in plaintext mode (KEY unset — dev / e2e raw insert)', () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    const credentials = {
      mall_id: 'shop',
      client_id: 'e2e-client-id',
      client_secret: 'super-secret',
      scopes: ['mall.read_product'],
    };
    const stored = encryptedJsonTransformer.to(credentials);
    expect(typeof stored).toBe('string');
    expect(stored as string).not.toMatch(/^enc:v1:/);
    expect(encryptedJsonTransformer.from(stored)).toEqual(credentials);
  });

  it('transformer.from accepts row written in either mode interchangeably', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'unit-test-secret';
    const credentials = { token: 't' };
    const encStored = encryptedJsonTransformer.to(credentials);
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    const plainStored = encryptedJsonTransformer.to(credentials);

    process.env.INTEGRATION_ENCRYPTION_KEY = 'unit-test-secret';
    expect(encryptedJsonTransformer.from(encStored)).toEqual(credentials);
    expect(encryptedJsonTransformer.from(plainStored)).toEqual(credentials);
  });

  it('round-trips unreadable rows verbatim instead of destroying ciphertext', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'old-key';
    const originalCipher = encryptJson({ secret: 'value' });
    process.env.INTEGRATION_ENCRYPTION_KEY = 'new-key';

    // Read with the wrong key — returns the sentinel.
    const sentinel = decryptJson(originalCipher);
    expect(isUnreadableCredentials(sentinel)).toBe(true);

    // Write back without modification — should preserve the original ciphertext
    // exactly, so the row remains recoverable if the operator later restores the
    // old key.
    const rewritten = encryptedJsonTransformer.to(sentinel);
    expect(rewritten).toBe(originalCipher);

    // And restoring the old key recovers the original payload.
    process.env.INTEGRATION_ENCRYPTION_KEY = 'old-key';
    expect(decryptJson(originalCipher)).toEqual({ secret: 'value' });
  });
});
