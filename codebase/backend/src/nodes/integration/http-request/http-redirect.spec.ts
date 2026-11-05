import {
  SsrfBlockedError,
  assertSafeOutboundHostResolved,
  assertSafeOutboundUrl,
} from './http-safety.js';
import type { HttpCredentials } from './http-credentials.js';
import { followRedirectsSafely, outboundBlockReason } from './http-redirect.js';

// 가드 함수 **둘 다** mock 한다 — DNS 해석 가드를 실물로 두면 통과 케이스가 `node:dns` 로 실제 조회를 나가 네트워크 없는
// 환경에서 flaky·hang 이 된다. `SsrfBlockedError` 는 실물을 남긴다: 판정을 그 클래스로 가르므로 클래스를 가리면 어떤
// 오류도 «판정 아님» 이 되어 차단 테스트가 통과 이유를 잃는다.
jest.mock('./http-safety.js', () => ({
  ...jest.requireActual('./http-safety.js'),
  assertSafeOutboundUrl: jest.fn(),
  assertSafeOutboundHostResolved: jest.fn(),
}));

/**
 * `outboundBlockReason` 은 나가는 URL 을 두 가드로 검사해 «막힌 사유 또는 null» 을 돌려준다. 여기서 보는 것은 그 계약의 경계다 —
 * **차단 판정만 사유가 된다**. 가드가 판정 아닌 오류를 던지면(가드의 고장) 사유로 둔갑시키지 않고 그대로 던져, 호출자가 각자의
 * 실패 경로(노드 `HTTP_TRANSPORT_FAILED` · 연결 테스트 `HTTP_CONNECT_FAILED`)로 분류하게 한다.
 */
describe('outboundBlockReason', () => {
  const mockedUrlGuard = assertSafeOutboundUrl as unknown as jest.Mock;
  const mockedHostGuard =
    assertSafeOutboundHostResolved as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedHostGuard.mockResolvedValue(undefined);
  });

  it('통과하면 null', async () => {
    mockedUrlGuard.mockImplementation((u: string) => new URL(u));
    expect(await outboundBlockReason('https://api.example.com/v1')).toBeNull();
  });

  it('차단 판정은 사유 문자열 — 원문(차단된 host/IP 포함)을 그대로 돌려 서버 로그에만 쓰이게 한다', async () => {
    mockedUrlGuard.mockImplementation(() => {
      throw new SsrfBlockedError('hostname "10.0.0.9" is restricted');
    });

    const reason = await outboundBlockReason('http://10.0.0.9/admin');

    expect(reason).toBe('SSRF_BLOCKED: hostname "10.0.0.9" is restricted');
  });

  it('판정 아닌 오류는 사유로 삼키지 않고 그대로 던진다', async () => {
    mockedUrlGuard.mockImplementation(() => {
      throw new TypeError('hostname.toLowerCase is not a function');
    });

    await expect(
      outboundBlockReason('https://api.example.com/v1'),
    ).rejects.toThrow(TypeError);
  });
});

/**
 * [CLE-NODE-HTTP] 리다이렉트 홉의 자격 증명 처리(NERV Task `CLE-T-FC2BWA`). 첫 요청과 출처(scheme · host · port)가 다른
 * 홉부터는 통합 자격 증명 헤더 · 공용 헤더 · 인증 성격 헤더와 자격 증명 query 를 싣지 않는다. 한 번 출처가 바뀌면 원래
 * 출처로 돌아와도 다시 싣지 않는다. 303 과 301 · 302 의 POST 는 Fetch 표준처럼 본문 없는 GET 으로 바꾼다.
 */
describe('followRedirectsSafely — 출처가 바뀐 홉의 자격 증명', () => {
  const mockedUrlGuard = assertSafeOutboundUrl as unknown as jest.Mock;
  const mockedHostGuard =
    assertSafeOutboundHostResolved as unknown as jest.Mock;
  let fetchMock: jest.SpyInstance;

  const START = 'https://api.example.com/v1/items';
  const credentials: HttpCredentials = {
    headers: { Authorization: 'Bearer tok-1' },
    defaultHeaders: { 'X-Tenant': 'acme' },
  };
  const baseHeaders = {
    'X-Tenant': 'acme',
    'X-Request-Id': 'req-1',
    Authorization: 'Bearer tok-1',
  };

  function redirect(status: number, location: string): Response {
    return new Response(null, { status, headers: { location } });
  }

  function hopCall(n: number): [string, RequestInit] {
    return fetchMock.mock.calls[n] as [string, RequestInit];
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUrlGuard.mockImplementation((u: string) => new URL(u));
    mockedHostGuard.mockResolvedValue(undefined);
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }));
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('같은 출처 홉은 헤더와 자격 증명 query 를 그대로 싣는다', async () => {
    const init: RequestInit = { method: 'GET', headers: { ...baseHeaders } };

    const out = await followRedirectsSafely(
      redirect(302, '/v2/items?api_key=k-1'),
      START,
      init,
      { ...credentials, queryParams: { api_key: 'k-1' } },
    );

    expect(out).toMatchObject({
      blocked: false,
      url: 'https://api.example.com/v2/items?api_key=k-1',
    });
    const [url, hopInit] = hopCall(0);
    expect(url).toBe('https://api.example.com/v2/items?api_key=k-1');
    expect(hopInit.headers).toEqual(baseHeaders);
  });

  it('다른 출처 홉은 자격 증명 · 공용 · 인증 성격 헤더를 대소문자와 무관하게 빼고 나머지 헤더는 남긴다', async () => {
    const init: RequestInit = {
      method: 'GET',
      headers: {
        'x-tenant': 'acme',
        'X-Request-Id': 'req-1',
        authorization: 'Bearer tok-1',
        'X-Api-Key': 'k-1',
        Cookie: 'sid=1',
        'Proxy-Authorization': 'Basic cHJveHk=',
      },
    };

    await followRedirectsSafely(
      redirect(302, 'https://cdn.example.net/file'),
      START,
      init,
      {
        headers: { 'x-api-key': 'k-1' },
        defaultHeaders: { 'X-Tenant': 'acme' },
      },
    );

    const [url, hopInit] = hopCall(0);
    expect(url).toBe('https://cdn.example.net/file');
    expect(hopInit.headers).toEqual({ 'X-Request-Id': 'req-1' });
  });

  it('한 번 출처가 바뀌면 원래 출처로 돌아와도 자격 증명을 다시 싣지 않는다', async () => {
    fetchMock
      .mockResolvedValueOnce(redirect(302, `${START}?back=1`))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    await followRedirectsSafely(
      redirect(302, 'https://other.example.org/bounce'),
      START,
      { method: 'GET', headers: { ...baseHeaders } },
      credentials,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(hopCall(0)[1].headers).toEqual({ 'X-Request-Id': 'req-1' });
    expect(hopCall(1)[0]).toBe(`${START}?back=1`);
    expect(hopCall(1)[1].headers).toEqual({ 'X-Request-Id': 'req-1' });
  });

  it.each([
    ['scheme 이 바뀐 홉(https → http)', 'http://api.example.com/v1/items'],
    ['port 가 바뀐 홉', 'https://api.example.com:8443/v1/items'],
    ['하위 도메인이 바뀐 홉', 'https://www.api.example.com/v1/items'],
  ])('%s 도 다른 출처로 본다', async (_label, location) => {
    await followRedirectsSafely(
      redirect(302, location),
      START,
      { method: 'GET', headers: { ...baseHeaders } },
      credentials,
    );

    expect(hopCall(0)[1].headers).toEqual({ 'X-Request-Id': 'req-1' });
  });

  it('기본 port 를 적은 Location 은 같은 출처다', async () => {
    await followRedirectsSafely(
      redirect(302, 'https://api.example.com:443/v2'),
      START,
      { method: 'GET', headers: { ...baseHeaders } },
      credentials,
    );

    expect(hopCall(0)[1].headers).toEqual(baseHeaders);
  });

  it('다른 출처 홉의 URL 에서 자격 증명 query 는 이름과 값이 둘 다 같은 것만 뺀다', async () => {
    const out = await followRedirectsSafely(
      redirect(
        302,
        'https://cb.example.net/done?api_key=k-1&api_key=other&state=s%201',
      ),
      START,
      { method: 'GET', headers: { ...baseHeaders } },
      { ...credentials, queryParams: { api_key: 'k-1' } },
    );

    const [url] = hopCall(0);
    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://cb.example.net');
    expect(parsed.searchParams.getAll('api_key')).toEqual(['other']);
    expect(parsed.searchParams.get('state')).toBe('s 1');
    // 홉 검사와 결과 URL 도 뺀 URL 을 쓴다.
    expect(mockedUrlGuard).toHaveBeenCalledWith(url);
    expect(out).toMatchObject({ blocked: false, url });
  });

  it('자격 증명 query 가 없는 다른 출처 URL 은 문자열을 바꾸지 않는다', async () => {
    await followRedirectsSafely(
      redirect(302, 'https://cb.example.net/done?q=a%20b&x=1'),
      START,
      { method: 'GET', headers: { ...baseHeaders } },
      { ...credentials, queryParams: { api_key: 'k-1' } },
    );

    expect(hopCall(0)[0]).toBe('https://cb.example.net/done?q=a%20b&x=1');
  });

  it.each([
    [303, 'POST'],
    [303, 'PUT'],
    [303, 'DELETE'],
    [302, 'POST'],
    [301, 'POST'],
  ])(
    '%i 응답의 %s 는 본문과 본문 헤더 없는 GET 으로 바꾼다',
    async (status, method) => {
      await followRedirectsSafely(
        redirect(status, '/v1/result'),
        START,
        {
          method,
          body: '{"a":1}',
          headers: {
            ...baseHeaders,
            'Content-Type': 'application/json',
            'content-encoding': 'identity',
            'Content-Language': 'ko',
            'Content-Location': '/v1/items/1',
            'Content-Length': '7',
          },
        },
        credentials,
      );

      const [, hopInit] = hopCall(0);
      expect(hopInit.method).toBe('GET');
      expect(hopInit.body ?? null).toBeNull();
      expect(hopInit.headers).toEqual(baseHeaders);
    },
  );

  it.each([
    [302, 'PUT'],
    [301, 'PATCH'],
    [307, 'POST'],
    [308, 'POST'],
    [303, 'HEAD'],
    [303, 'GET'],
  ])('%i 응답의 %s 는 method 와 본문을 그대로 둔다', async (status, method) => {
    const body = method === 'GET' || method === 'HEAD' ? undefined : 'x=1';
    const headers = { ...baseHeaders, 'Content-Type': 'text/plain' };

    await followRedirectsSafely(
      redirect(status, '/v1/result'),
      START,
      { method, body, headers },
      credentials,
    );

    const [, hopInit] = hopCall(0);
    expect(hopInit.method).toBe(method);
    expect(hopInit.body).toBe(body);
    expect(hopInit.headers).toEqual(headers);
  });

  it('GET 으로 바뀐 뒤의 홉은 GET 으로 남는다(307 이어도)', async () => {
    fetchMock
      .mockResolvedValueOnce(redirect(307, '/v1/final'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    await followRedirectsSafely(
      redirect(303, '/v1/result'),
      START,
      { method: 'POST', body: 'x=1', headers: { ...baseHeaders } },
      credentials,
    );

    expect(hopCall(1)[1].method).toBe('GET');
    expect(hopCall(1)[1].body ?? null).toBeNull();
  });

  it('호출자의 init 을 바꾸지 않는다', async () => {
    const headers = { ...baseHeaders, 'Content-Type': 'application/json' };
    const init: RequestInit = { method: 'POST', body: '{}', headers };

    await followRedirectsSafely(
      redirect(303, 'https://cdn.example.net/x'),
      START,
      init,
      credentials,
    );

    expect(init).toEqual({
      method: 'POST',
      body: '{}',
      headers: { ...baseHeaders, 'Content-Type': 'application/json' },
    });
  });

  it('Headers 객체와 배열 형태의 headers 도 같은 규칙으로 뺀다', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    await followRedirectsSafely(
      redirect(302, 'https://cdn.example.net/a'),
      START,
      { headers: new Headers(baseHeaders) },
      credentials,
    );
    await followRedirectsSafely(
      redirect(302, 'https://cdn.example.net/b'),
      START,
      { headers: Object.entries(baseHeaders) },
      credentials,
    );

    expect(hopCall(0)[1].headers).toEqual({ 'x-request-id': 'req-1' });
    expect(hopCall(1)[1].headers).toEqual({ 'X-Request-Id': 'req-1' });
  });
});
