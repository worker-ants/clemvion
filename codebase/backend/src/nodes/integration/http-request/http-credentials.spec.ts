import { resolveHttpCredentials } from './http-credentials';

/**
 * `resolveHttpCredentials` — HTTP Request 노드와 HTTP 통합 연결 테스트가 공유한다. 실패는 값으로 돌려주고
 * (`INTEGRATION_INCOMPLETE` · `INTEGRATION_AUTH_UNSUPPORTED`), 연결 테스트는 그 code 를 preview-test · `:id/test`
 * 응답에 그대로 싣는다.
 */
describe('resolveHttpCredentials', () => {
  const incomplete = { ok: false, code: 'INTEGRATION_INCOMPLETE' };

  describe('api_key — location · key_name · value 셋 중 하나라도 없으면 INTEGRATION_INCOMPLETE', () => {
    const full = { location: 'header', key_name: 'X-Api-Key', value: 'k-1' };

    it.each(['location', 'key_name', 'value'])('%s 없음', (missing) => {
      const raw: Record<string, unknown> = { ...full };
      delete raw[missing];
      expect(resolveHttpCredentials('api_key', raw)).toMatchObject({
        ...incomplete,
        message:
          'HTTP integration (api_key) is missing location/key_name/value',
      });
    });

    it('header 위치는 헤더로, query 위치는 query 로', () => {
      expect(resolveHttpCredentials('api_key', full)).toEqual({
        ok: true,
        credentials: {
          headers: { 'X-Api-Key': 'k-1' },
          defaultHeaders: undefined,
        },
        baseUrl: undefined,
      });
      expect(
        resolveHttpCredentials('api_key', { ...full, location: 'query' }),
      ).toEqual({
        ok: true,
        credentials: {
          queryParams: { 'X-Api-Key': 'k-1' },
          defaultHeaders: undefined,
        },
        baseUrl: undefined,
      });
    });
  });

  it('bearer_token — token 이 없으면 INTEGRATION_INCOMPLETE', () => {
    expect(resolveHttpCredentials('bearer_token', {})).toMatchObject({
      ...incomplete,
      message: 'HTTP integration (bearer) is missing token',
    });
  });

  it.each(['username', 'password'])(
    'basic — %s 가 없으면 INTEGRATION_INCOMPLETE',
    (missing) => {
      const raw: Record<string, unknown> = { username: 'u', password: 'p' };
      delete raw[missing];
      expect(resolveHttpCredentials('basic', raw)).toMatchObject({
        ...incomplete,
        message: 'HTTP integration (basic) is missing username/password',
      });
    },
  );

  it('지원하지 않는 인증 방식은 INTEGRATION_AUTH_UNSUPPORTED', () => {
    expect(resolveHttpCredentials('oauth2', {})).toEqual({
      ok: false,
      code: 'INTEGRATION_AUTH_UNSUPPORTED',
      message: 'HTTP integration auth type "oauth2" is not supported',
    });
  });

  it('base_url 이 빈 문자열이면 없는 것으로, default_headers 는 객체일 때만 싣는다', () => {
    expect(
      resolveHttpCredentials('bearer_token', {
        token: 't',
        base_url: '',
        default_headers: 'not-an-object',
      }),
    ).toEqual({
      ok: true,
      credentials: {
        headers: { Authorization: 'Bearer t' },
        defaultHeaders: undefined,
      },
      baseUrl: undefined,
    });
    expect(
      resolveHttpCredentials('bearer_token', {
        token: 't',
        base_url: 'https://api.example.com',
        default_headers: { Accept: 'application/json' },
      }),
    ).toMatchObject({
      ok: true,
      credentials: { defaultHeaders: { Accept: 'application/json' } },
      baseUrl: 'https://api.example.com',
    });
  });
});
