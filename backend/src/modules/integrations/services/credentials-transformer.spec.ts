import {
  encryptJson,
  decryptJson,
  encryptedJsonTransformer,
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

  it('rejects tampered ciphertext', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'unit-test-secret';
    const enc = encryptJson({ a: 1 });
    const tampered = enc.slice(0, -4) + 'AAAA';
    expect(() => decryptJson(tampered)).toThrow();
  });

  it('transformer to/from symmetry', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'unit-test-secret';
    const value = { x: 42 };
    const stored = encryptedJsonTransformer.to(value);
    expect(typeof stored).toBe('string');
    expect(encryptedJsonTransformer.from(stored)).toEqual(value);
  });
});
