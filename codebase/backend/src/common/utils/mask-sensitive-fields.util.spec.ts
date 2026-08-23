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

  // ── `token` 계열 — 이 목록은 **키 이름 완전 일치**라 계열을 정규식처럼 못 접는다.
  //    2026-08-16 실측: bare `token` 만 잡히고 접두형 넷이 평문 통과했다.
  //
  //    **여기 캐너리를 두는 이유**: 이 목록의 다른 소비처(`handler-output.adapter.ts` 의
  //    노드 `config` echo)는 값-패턴 층을 겹치지 않는다. workflow-assistant 쪽 테스트는
  //    겹친 층이 같은 키를 덮어 버려 **목록에서 항목을 빼도 GREEN 이다**(뮤테이션으로 확인).
  //    즉 이 목록을 지키는 가드는 이 자리뿐이다.
  it.each([
    ['csrfToken'],
    ['csrf_token'],
    ['authToken'],
    ['auth_token'],
    ['sessionToken'],
    ['session_token'],
    ['idToken'],
    ['id_token'],
  ])('masks the `%s` key (token family, not just bare `token`)', (key) => {
    const masked = maskSensitiveFields({ [key]: 'AAAABBBB9999' }) as Record<
      string,
      unknown
    >;
    expect(masked[key]).toBe('****9999');
  });

  it('leaves a non-credential key that merely contains "token" as a substring', () => {
    // 대조군 — 목록은 **완전 일치**다. 넓히다 이 성질을 잃으면 여기가 RED 가 된다.
    expect(maskSensitiveFields({ tokenCount: 12345 })).toEqual({
      tokenCount: 12345,
    });
  });
});
