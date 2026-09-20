import {
  SSRF_BLOCKED_CLIENT_MESSAGE,
  SsrfBlockedError,
  assertSafeOutboundHostResolved,
  assertSafeOutboundUrl,
} from '../../nodes/integration/http-request/http-safety';
import { appendQueryParams } from '../../nodes/integration/http-request/http-credentials';
import { MAX_REDIRECT_HOPS } from '../../nodes/integration/http-request/http-redirect';
import { MCP_ERROR_MESSAGE_MAX_LEN } from '../mcp/mcp-error-codes';
import {
  HTTP_TEST_TIMEOUT_MS,
  testHttpConnection,
} from './http-connection-tester';

jest.mock('../../nodes/integration/http-request/http-safety', () => ({
  ...jest.requireActual('../../nodes/integration/http-request/http-safety'),
  assertSafeOutboundUrl: jest.fn(),
  assertSafeOutboundHostResolved: jest.fn(),
}));

/**
 * spec/2-navigation/4-integration.md §5.3 — HTTP/REST 연결 테스트. 노드와 같은 방식으로 자격증명을 붙여 `GET base_url`,
 * 리다이렉트는 노드처럼 5홉(홉마다 SSRF), 10초. 2xx 성공 · 401/403 `HTTP_AUTH_FAILED` · 그 밖 4xx 는 성공이되 «확인 못 함» ·
 * 5xx `HTTP_SERVER_ERROR` · 차단 `HTTP_BLOCKED` · 전송 실패 `HTTP_CONNECT_FAILED`. 종전에는 이 테스터가 없어 구조만 맞으면 성공이었다.
 */
describe('testHttpConnection', () => {
  const mockedUrlGuard = assertSafeOutboundUrl as unknown as jest.Mock;
  const mockedHostGuard =
    assertSafeOutboundHostResolved as unknown as jest.Mock;
  let fetchMock: jest.SpyInstance;

  const bearer = { base_url: 'https://api.example.com/v1', token: 'tok-123' };

  function respond(
    status: number,
    headers: Record<string, string> = {},
  ): Response {
    return new Response([204, 205, 304].includes(status) ? null : 'body', {
      status,
      headers,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUrlGuard.mockImplementation((u: string) => new URL(u));
    mockedHostGuard.mockResolvedValue(undefined);
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('base_url 이 없으면 호출하지 않고 성공 + «확인하지 않았다» 안내', async () => {
    const result = await testHttpConnection('bearer_token', {
      token: 'tok-123',
    });

    expect(result.success).toBe(true);
    expect(result.message).toMatch(/base_url/);
    expect(result.message).toMatch(/not checked/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('2xx 면 성공 — GET, 수동 리다이렉트, 대기 신호, 노드와 같은 Bearer 헤더', async () => {
    fetchMock.mockResolvedValue(respond(200));

    const result = await testHttpConnection('bearer_token', bearer);

    expect(result).toEqual({ success: true, message: 'Connection successful' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1');
    expect(init.method).toBe('GET');
    expect(init.redirect).toBe('manual');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok-123' });
    expect(HTTP_TEST_TIMEOUT_MS).toBe(10_000);
  });

  it('api_key(header) 와 default_headers — 자격증명 헤더가 이긴다(노드와 같은 병합 순서)', async () => {
    fetchMock.mockResolvedValue(respond(200));

    await testHttpConnection('api_key', {
      base_url: 'https://api.example.com',
      location: 'header',
      key_name: 'X-Api-Key',
      value: 'k-1',
      default_headers: { 'X-Api-Key': 'stale', Accept: 'application/json' },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({
      'X-Api-Key': 'k-1',
      Accept: 'application/json',
    });
  });

  it('api_key(query) 는 URL query 에 붙는다 — 기존 query 는 보존', async () => {
    fetchMock.mockResolvedValue(respond(200));

    await testHttpConnection('api_key', {
      base_url: 'https://api.example.com/v1?region=kr',
      location: 'query',
      key_name: 'api_key',
      value: 'k 1',
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.searchParams.get('region')).toBe('kr');
    expect(parsed.searchParams.get('api_key')).toBe('k 1');
  });

  it('query 자격증명은 노드와 같은 문자열로 붙는다 — 같은 키가 있어도 덮어쓰지 않고 덧붙인다', async () => {
    fetchMock.mockResolvedValue(respond(200));
    const base = 'https://api.example.com/v1?api_key=stale';

    await testHttpConnection('api_key', {
      base_url: base,
      location: 'query',
      key_name: 'api_key',
      value: 'k-1',
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(appendQueryParams(base, { api_key: 'k-1' }));
    expect(url).toBe('https://api.example.com/v1?api_key=stale&api_key=k-1');
  });

  it('basic 은 Authorization: Basic', async () => {
    fetchMock.mockResolvedValue(respond(200));
    await testHttpConnection('basic', {
      base_url: 'https://api.example.com',
      username: 'u',
      password: 'p',
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from('u:p').toString('base64')}`,
    });
  });

  it.each([401, 403])('%i 은 HTTP_AUTH_FAILED', async (status) => {
    fetchMock.mockResolvedValue(respond(status));

    const result = await testHttpConnection('bearer_token', bearer);

    expect(result.success).toBe(false);
    expect(result.code).toBe('HTTP_AUTH_FAILED');
    expect(result.message).toContain(String(status));
  });

  it.each([404, 405, 400])(
    '%i(401/403 외 4xx)은 성공이되 자격증명을 확인하지 못했다고 알린다',
    async (status) => {
      fetchMock.mockResolvedValue(respond(status));

      const result = await testHttpConnection('bearer_token', bearer);

      expect(result.success).toBe(true);
      expect(result.code).toBeUndefined();
      expect(result.message).toMatch(/could not be verified/i);
      expect(result.message).toContain(String(status));
    },
  );

  it.each([500, 503])('%i(5xx)은 HTTP_SERVER_ERROR', async (status) => {
    fetchMock.mockResolvedValue(respond(status));
    const result = await testHttpConnection('bearer_token', bearer);
    expect(result).toMatchObject({ success: false, code: 'HTTP_SERVER_ERROR' });
  });

  it('전송 실패는 HTTP_CONNECT_FAILED', async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(new Error('connect ECONNREFUSED'), {
          code: 'ECONNREFUSED',
        }),
      }),
    );
    const result = await testHttpConnection('bearer_token', bearer);
    expect(result).toMatchObject({
      success: false,
      code: 'HTTP_CONNECT_FAILED',
    });
  });

  it('전송 실패 메시지는 원인까지 싣되 길이를 제한한다', async () => {
    fetchMock.mockRejectedValueOnce(
      Object.assign(new TypeError('fetch failed'), {
        cause: new Error('getaddrinfo ENOTFOUND api.example.com'),
      }),
    );
    const short = await testHttpConnection('bearer_token', bearer);
    expect(short.message).toBe(
      'fetch failed: getaddrinfo ENOTFOUND api.example.com',
    );

    fetchMock.mockRejectedValueOnce(
      new TypeError('x'.repeat(MCP_ERROR_MESSAGE_MAX_LEN + 50)),
    );
    const long = await testHttpConnection('bearer_token', bearer);
    expect(long).toMatchObject({ success: false, code: 'HTTP_CONNECT_FAILED' });
    expect(long.message).toHaveLength(MCP_ERROR_MESSAGE_MAX_LEN);
  });

  it('대기 초과(TimeoutError)는 HTTP_CONNECT_FAILED — 시간 초과라고 알린다', async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new Error('The operation was aborted due to timeout'), {
        name: 'TimeoutError',
      }),
    );
    const result = await testHttpConnection('bearer_token', bearer);
    expect(result).toMatchObject({
      success: false,
      code: 'HTTP_CONNECT_FAILED',
    });
    expect(result.message).toMatch(/timed out/i);
  });

  it('첫 URL 이 SSRF 가드에 막히면 HTTP_BLOCKED — 호출하지 않고 일반화 문구만', async () => {
    mockedUrlGuard.mockImplementation(() => {
      throw new SsrfBlockedError('169.254.169.254');
    });

    const result = await testHttpConnection('bearer_token', {
      ...bearer,
      base_url: 'http://169.254.169.254/latest',
    });

    expect(result).toEqual({
      success: false,
      code: 'HTTP_BLOCKED',
      message: SSRF_BLOCKED_CLIENT_MESSAGE,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * 전송 타임아웃 신호는 **가드를 통과한 뒤** 만든다 — `AbortSignal.timeout` 은 생성 시점부터 세므로 가드보다 먼저 만들면
   * 가드의 DNS 조회 시간만큼 `fetch` 예산이 깎인다(느린 DNS 에서 정상 연결이 «10초 초과» 로 오분류). 차단돼 fetch 까지
   * 가지 않는 경우 신호가 아예 만들어지지 않는 것으로 그 순서를 관측한다.
   */
  it('가드에 막히면 전송 타임아웃 신호를 만들지 않는다 — 신호는 가드 통과 뒤에 만든다', async () => {
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');
    mockedHostGuard.mockRejectedValue(new SsrfBlockedError('10.0.0.9'));

    const result = await testHttpConnection('bearer_token', bearer);

    expect(result).toMatchObject({ success: false, code: 'HTTP_BLOCKED' });
    expect(timeoutSpy).not.toHaveBeenCalled();
    timeoutSpy.mockRestore();
  });

  it('host 가 사설 IP 로 해석돼도 HTTP_BLOCKED', async () => {
    mockedHostGuard.mockRejectedValue(new SsrfBlockedError('10.0.0.9'));
    const result = await testHttpConnection('bearer_token', bearer);
    expect(result).toMatchObject({ success: false, code: 'HTTP_BLOCKED' });
    expect(result.message).not.toContain('10.0.0.9');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * 판정은 `SsrfBlockedError` 하나뿐이다 — 그 밖의 오류는 가드의 고장이지 차단이 아니다. preflight 호출이 `try` 밖에 있었기에
   * 이 경우 테스터가 던져 «던지지 않는다»(`dispatchTest` 의 tester 계약)를 깼다.
   */
  it('가드가 판정 아닌 오류를 던지면 HTTP_BLOCKED 가 아니라 HTTP_CONNECT_FAILED — 던지지 않는다', async () => {
    mockedUrlGuard.mockImplementation(() => {
      throw new TypeError('hostname.toLowerCase is not a function');
    });

    const result = await testHttpConnection('bearer_token', bearer);

    expect(result).toMatchObject({
      success: false,
      code: 'HTTP_CONNECT_FAILED',
    });
    expect(result.message).toContain('hostname.toLowerCase');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('리다이렉트는 따라가서 마지막 응답으로 판정한다 — 같은 헤더를 싣는다', async () => {
    fetchMock
      .mockResolvedValueOnce(respond(302, { location: '/v2/me' }))
      .mockResolvedValueOnce(respond(200));

    const result = await testHttpConnection('bearer_token', bearer);

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [second, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(second).toBe('https://api.example.com/v2/me');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok-123' });
  });

  it('리다이렉트 뒤에서 거부하면 HTTP_AUTH_FAILED 로 잡는다', async () => {
    fetchMock
      .mockResolvedValueOnce(
        respond(301, { location: 'https://auth.example.com/v1' }),
      )
      .mockResolvedValueOnce(respond(401));

    const result = await testHttpConnection('bearer_token', bearer);

    expect(result).toMatchObject({ success: false, code: 'HTTP_AUTH_FAILED' });
  });

  it('리다이렉트 대상이 SSRF 가드에 막히면 HTTP_BLOCKED — 대상 host 를 싣지 않는다', async () => {
    fetchMock.mockResolvedValueOnce(
      respond(302, { location: 'http://10.1.2.3/admin' }),
    );
    mockedUrlGuard.mockImplementation((u: string) => {
      if (u.includes('10.1.2.3')) throw new SsrfBlockedError('10.1.2.3');
      return new URL(u);
    });

    const result = await testHttpConnection('bearer_token', bearer);

    expect(result).toEqual({
      success: false,
      code: 'HTTP_BLOCKED',
      message: SSRF_BLOCKED_CLIENT_MESSAGE,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('리다이렉트 대상 host 가 사설 IP 로 해석돼도 HTTP_BLOCKED — 홉마다 DNS 가드도 다시 탄다', async () => {
    fetchMock.mockResolvedValueOnce(
      respond(302, { location: 'https://internal.example.com/admin' }),
    );
    mockedHostGuard.mockImplementation(async (host: string) => {
      if (host === 'internal.example.com') {
        throw new SsrfBlockedError('internal.example.com -> 10.0.0.7');
      }
    });

    const result = await testHttpConnection('bearer_token', bearer);

    expect(result).toEqual({
      success: false,
      code: 'HTTP_BLOCKED',
      message: SSRF_BLOCKED_CLIENT_MESSAGE,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it(`리다이렉트가 ${MAX_REDIRECT_HOPS}홉을 넘으면 HTTP_BLOCKED`, async () => {
    fetchMock.mockResolvedValue(respond(302, { location: '/again' }));

    const result = await testHttpConnection('bearer_token', bearer);

    expect(MAX_REDIRECT_HOPS).toBe(5);
    expect(result).toMatchObject({ success: false, code: 'HTTP_BLOCKED' });
    expect(fetchMock).toHaveBeenCalledTimes(MAX_REDIRECT_HOPS + 1);
  });

  it('Location 없는 3xx 는 성공(서버에 닿았다)', async () => {
    fetchMock.mockResolvedValue(respond(304));
    const result = await testHttpConnection('bearer_token', bearer);
    expect(result.success).toBe(true);
  });

  it('형식이 틀린 base_url 은 SSRF 차단이 아니라 HTTP_CONNECT_FAILED 로 분명히 알린다', async () => {
    const result = await testHttpConnection('bearer_token', {
      base_url: 'not a url',
      token: 'tok-123',
    });
    expect(result).toEqual({
      success: false,
      code: 'HTTP_CONNECT_FAILED',
      message: 'base_url is not a valid URL.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('지원하지 않는 인증 방식은 노드와 같은 코드로 실패한다', async () => {
    const result = await testHttpConnection('oauth2', {
      base_url: 'https://api.example.com',
    });
    expect(result).toMatchObject({
      success: false,
      code: 'INTEGRATION_AUTH_UNSUPPORTED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
