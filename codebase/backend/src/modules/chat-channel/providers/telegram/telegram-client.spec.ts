import { describeFetchError, safeHost } from './telegram-client';

describe('describeFetchError', () => {
  it('plain Error → message', () => {
    expect(describeFetchError(new Error('boom'))).toBe('boom');
  });

  it('fetch failed with cause + code → unwraps cause and code', () => {
    const cause = Object.assign(
      new Error('getaddrinfo ENOTFOUND api.telegram.org'),
      {
        code: 'ENOTFOUND',
      },
    );
    const err = new TypeError('fetch failed');
    (err as { cause?: unknown }).cause = cause;
    expect(describeFetchError(err)).toBe(
      'fetch failed ← Error: getaddrinfo ENOTFOUND api.telegram.org [ENOTFOUND]',
    );
  });

  it('fetch failed with cause but no code', () => {
    const cause = new Error('socket hang up');
    const err = new TypeError('fetch failed');
    (err as { cause?: unknown }).cause = cause;
    expect(describeFetchError(err)).toBe(
      'fetch failed ← Error: socket hang up',
    );
  });

  it('fetch failed with non-Error cause', () => {
    const err = new TypeError('fetch failed');
    (err as { cause?: unknown }).cause = 'arbitrary';
    expect(describeFetchError(err)).toBe('fetch failed ← cause=arbitrary');
  });

  it('non-Error throwable → String()', () => {
    expect(describeFetchError('raw string')).toBe('raw string');
    expect(describeFetchError(undefined)).toBe('undefined');
  });
});

describe('safeHost', () => {
  it('extracts host', () => {
    expect(safeHost('https://api.telegram.org/botSECRET/sendMessage')).toBe(
      'api.telegram.org',
    );
  });

  it('non-URL → unknown', () => {
    expect(safeHost('not a url')).toBe('unknown');
  });
});
