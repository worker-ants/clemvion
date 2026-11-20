import {
  guardedLlmFetch,
  llmEndpointAddressGuard,
  llmEndpointDispatcher,
  LlmEndpointBlockedError,
  resetLlmEndpointDispatcherForTest,
} from './llm-endpoint-fetch';

describe('llm-endpoint-fetch — LLM 연결 시점 주소 판정 (CLE-T-PT5YB5)', () => {
  afterEach(async () => {
    jest.restoreAllMocks();
    await resetLlmEndpointDispatcherForTest();
  });

  describe('llmEndpointAddressGuard', () => {
    it.each([
      ['loopback', '127.0.0.1', 4],
      ['사설', '10.1.2.3', 4],
      ['CGNAT', '100.64.0.1', 4],
      ['메타데이터', '169.254.169.254', 4],
      ['미지정 IPv6', '::', 6],
      ['IPv4 를 품은 mapped', '::ffff:192.168.0.1', 6],
    ])(
      '%s 주소(%s)로 풀리면 호스트 이름만 담은 오류를 돌려준다',
      (_l, address, family) => {
        const err = llmEndpointAddressGuard(
          { address, family },
          'llm.example.com',
        );
        expect(err).toBeInstanceOf(LlmEndpointBlockedError);
        expect(err?.message).toContain('llm.example.com');
        expect(err?.message).not.toContain(address);
      },
    );

    it.each([
      ['공인 IPv4', '8.8.8.8', 4],
      ['공인 IPv6', '2606:4700:4700::1111', 6],
    ])('%s 주소(%s)는 통과시킨다', (_l, address, family) => {
      expect(
        llmEndpointAddressGuard({ address, family }, 'llm.example.com'),
      ).toBeNull();
    });
  });

  describe('guardedLlmFetch', () => {
    it('호스트 이름 요청은 연결 시점 판정 dispatcher 를 실어 fetch 에 넘긴다', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(new Response('{}'));
      await guardedLlmFetch('https://llm.example.com/v1/models', {
        method: 'GET',
      });
      const [, init] = fetchSpy.mock.calls[0];
      expect(init?.method).toBe('GET');
      expect((init as { dispatcher?: unknown }).dispatcher).toBe(
        llmEndpointDispatcher(),
      );
    });

    it('SDK 가 redirect 를 넘겨도 error 로 고정한다(리다이렉트 홉이 가드를 우회하지 못한다)', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(new Response('{}'));
      await guardedLlmFetch('https://llm.example.com/v1', {
        redirect: 'follow',
      });
      const [, init] = fetchSpy.mock.calls[0];
      expect(init?.redirect).toBe('error');
    });

    it('Request · URL 입력도 같은 dispatcher 로 넘긴다', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response('{}'));
      await guardedLlmFetch(new URL('https://llm.example.com/a'));
      await guardedLlmFetch(new Request('https://llm.example.com/b'));
      for (const [, init] of fetchSpy.mock.calls) {
        expect((init as { dispatcher?: unknown }).dispatcher).toBe(
          llmEndpointDispatcher(),
        );
      }
    });

    // 연결 조회는 IP 리터럴 호스트에서 불리지 않는다. 63RSH6 전에 저장된 CGNAT 리터럴도 실행 중에 막는다.
    it.each([
      ['http://100.64.0.1/v1/models'],
      ['http://127.0.0.1:11434/v1/models'],
      ['http://[::]/v1/models'],
      ['http://[::ffff:10.0.0.1]/v1/models'],
    ])(
      '막는 대역의 IP 리터럴(%s)은 fetch 를 부르지 않고 거부한다',
      async (url) => {
        const fetchSpy = jest.spyOn(global, 'fetch');
        await expect(guardedLlmFetch(url)).rejects.toBeInstanceOf(
          LlmEndpointBlockedError,
        );
        expect(fetchSpy).not.toHaveBeenCalled();
      },
    );

    it('공인 IP 리터럴은 넘긴다', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(new Response('{}'));
      await guardedLlmFetch('https://8.8.8.8/v1/models');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    // 실제 연결 경로. localhost 는 OS 해석기에서 loopback 으로 풀리므로 소켓을 열기 전에 막힌다.
    // jest 에서는 판정 오류가 테스트 realm 에서 만들어져 Node 내장 fetch 가 `new Error(String(err))` 로 다시
    // 감싼다(guarded-lookup-dispatcher.spec 참고). 그래서 인스턴스 대신 cause 의 문구를 본다.
    it('loopback 으로 풀리는 호스트 이름은 연결 단계에서 막힌다', async () => {
      const err: unknown = await guardedLlmFetch(
        'http://localhost:11434/v1',
      ).then(
        () => undefined,
        (err_: unknown) => err_,
      );
      expect((err as Error | undefined)?.message).toBe('fetch failed');
      expect(String((err as Error).cause)).toContain(
        'LLM endpoint host localhost resolves to a blocked address.',
      );
    });
  });
});
