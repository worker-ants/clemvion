import { maskSensitiveFields } from './mask-sensitive-fields.util';

describe('maskSensitiveFields', () => {
  it('masks apiKey preserving only the last 4 chars', () => {
    expect(maskSensitiveFields({ apiKey: 'sk-abcdef1234' })).toEqual({
      apiKey: '****1234',
    });
  });

  it('masks across case variants (apiKey, api_key, apikey)', () => {
    expect(
      maskSensitiveFields({
        apiKey: 'aaaaaaaa1111',
        api_key: 'bbbbbbbb2222',
        apikey: 'cccccccc3333',
      }),
    ).toEqual({
      apiKey: '****1111',
      api_key: '****2222',
      apikey: '****3333',
    });
  });

  it('masks deeply nested fields inside objects and arrays', () => {
    const input = {
      user: {
        name: 'Alice',
        credentials: { password: 'p@ssw0rdlong' },
      },
      tokens: [{ refresh_token: 'rt-xxyyzz9999' }, { other: 'ok' }],
    };
    expect(maskSensitiveFields(input)).toEqual({
      user: {
        name: 'Alice',
        credentials: { password: '****long' },
      },
      tokens: [{ refresh_token: '****9999' }, { other: 'ok' }],
    });
  });

  it('returns short values as plain "****" without leaking trailing chars', () => {
    expect(maskSensitiveFields({ apiKey: 'abc' })).toEqual({ apiKey: '****' });
  });

  it('masks non-string sensitive values to "****"', () => {
    expect(maskSensitiveFields({ apiKey: { nested: 'secret' } })).toEqual({
      apiKey: '****',
    });
  });

  it('leaves unrelated fields untouched', () => {
    expect(maskSensitiveFields({ name: 'Bob', age: 30 })).toEqual({
      name: 'Bob',
      age: 30,
    });
  });

  it('handles null, undefined, primitives without throwing', () => {
    expect(maskSensitiveFields(null)).toBeNull();
    expect(maskSensitiveFields(undefined)).toBeUndefined();
    expect(maskSensitiveFields(42)).toBe(42);
    expect(maskSensitiveFields('plain')).toBe('plain');
  });

  it('avoids infinite recursion on circular references', () => {
    const obj: Record<string, unknown> = { name: 'loop' };
    obj.self = obj;
    const masked = maskSensitiveFields(obj) as Record<string, unknown>;
    expect(masked.name).toBe('loop');
    expect(masked.self).toBe('[Circular]');
  });

  it('does not mutate the input', () => {
    const input = { apiKey: 'original-key-1234' };
    const masked = maskSensitiveFields(input);
    expect(input.apiKey).toBe('original-key-1234');
    expect(masked).not.toBe(input);
  });
});
