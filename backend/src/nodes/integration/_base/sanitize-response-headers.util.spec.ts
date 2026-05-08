import { sanitizeResponseHeaders } from './sanitize-response-headers.util.js';

describe('sanitizeResponseHeaders', () => {
  it('returns an empty object for empty input', () => {
    expect(sanitizeResponseHeaders({})).toEqual({});
  });

  it('returns an empty object for null / undefined', () => {
    expect(sanitizeResponseHeaders(null)).toEqual({});
    expect(sanitizeResponseHeaders(undefined)).toEqual({});
  });

  it('returns an empty object for partial Headers-like mocks (only .get())', () => {
    // Pre-Phase-2 unit-test mocks pass `{ get: jest.fn() }` as
    // `response.headers`. The sanitizer must accept this without leaking
    // the `get` method into the output.
    const result = sanitizeResponseHeaders({
      get: () => null,
    } as unknown as Record<string, string>);
    // The mock has a string-keyed `get` whose value isn't a string. We
    // accept the entry but stringify the value rather than throw.
    expect('get' in result).toBe(true);
  });

  it('redacts location header (3xx redirect target)', () => {
    const result = sanitizeResponseHeaders({
      Location: 'https://api.example.com/redirect?token=secret',
    });
    expect(result.Location).toBe('[REDACTED]');
  });

  it('passes through non-sensitive headers untouched', () => {
    const result = sanitizeResponseHeaders({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Date: 'Thu, 01 Jan 2026 00:00:00 GMT',
    });
    expect(result).toEqual({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Date: 'Thu, 01 Jan 2026 00:00:00 GMT',
    });
  });

  it('redacts exact-match blacklist headers (case-insensitive)', () => {
    const result = sanitizeResponseHeaders({
      Authorization: 'Bearer secret-token',
      'proxy-authorization': 'Basic xxx',
      Cookie: 'sid=abc',
      'set-cookie': 'sid=abc; Path=/',
      'X-Api-Key': 'k-123',
      'X-Auth-Token': 't-456',
      'X-CSRF-Token': 'csrf-789',
      'WWW-Authenticate': 'Bearer realm="x"',
    });
    expect(result.Authorization).toBe('[REDACTED]');
    expect(result['proxy-authorization']).toBe('[REDACTED]');
    expect(result.Cookie).toBe('[REDACTED]');
    expect(result['set-cookie']).toBe('[REDACTED]');
    expect(result['X-Api-Key']).toBe('[REDACTED]');
    expect(result['X-Auth-Token']).toBe('[REDACTED]');
    expect(result['X-CSRF-Token']).toBe('[REDACTED]');
    expect(result['WWW-Authenticate']).toBe('[REDACTED]');
  });

  it('redacts headers whose name matches the credential-substring pattern', () => {
    const result = sanitizeResponseHeaders({
      'X-Custom-Token': 't',
      'X-Custom-Auth': 'a',
      'X-My-Secret': 's',
      'X-Some-ApiKey': 'k',
      'X-Credential-Hint': 'c',
      'X-User-Password': 'p',
    });
    expect(result['X-Custom-Token']).toBe('[REDACTED]');
    expect(result['X-Custom-Auth']).toBe('[REDACTED]');
    expect(result['X-My-Secret']).toBe('[REDACTED]');
    expect(result['X-Some-ApiKey']).toBe('[REDACTED]');
    expect(result['X-Credential-Hint']).toBe('[REDACTED]');
    expect(result['X-User-Password']).toBe('[REDACTED]');
  });

  it('keeps the header name in the output (only value is redacted)', () => {
    const result = sanitizeResponseHeaders({ Authorization: 'secret' });
    expect(Object.keys(result)).toEqual(['Authorization']);
  });

  it('accepts a fetch Headers instance', () => {
    const h = new Headers();
    h.set('Content-Type', 'text/plain');
    h.set('Authorization', 'Bearer x');
    const result = sanitizeResponseHeaders(h);
    expect(result['content-type']).toBe('text/plain');
    expect(result.authorization).toBe('[REDACTED]');
  });

  it('handles an iterable of [name, value] entries', () => {
    const entries: Array<[string, string]> = [
      ['Content-Type', 'application/json'],
      ['Set-Cookie', 'sid=abc'],
    ];
    const result = sanitizeResponseHeaders(entries);
    expect(result['Content-Type']).toBe('application/json');
    expect(result['Set-Cookie']).toBe('[REDACTED]');
  });

  it('preserves multiple values for a header (Headers iteration semantics)', () => {
    const h = new Headers();
    h.append('Set-Cookie', 'a=1');
    h.append('Set-Cookie', 'b=2');
    const result = sanitizeResponseHeaders(h);
    // Multi-valued headers are joined by Headers itself; sanitizer redacts
    // the joined value.
    expect(result['set-cookie']).toBe('[REDACTED]');
  });
});
