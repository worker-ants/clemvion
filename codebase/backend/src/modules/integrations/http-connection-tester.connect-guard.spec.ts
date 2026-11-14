import type { LookupAddress } from 'node:dns';
import { lookup as connectLookup } from 'node:dns';
import { lookup as precheckLookup } from 'node:dns/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Logger } from '@nestjs/common';
import { fetch as undiciFetch } from 'undici';
import {
  SSRF_BLOCKED_CLIENT_MESSAGE,
  resetSafeOutboundDispatcherForTesting,
} from '../../nodes/integration/http-request/http-safety';
import { testHttpConnection } from './http-connection-tester';

// DNS rebinding 을 재현한다(CLE-T-NESSYD). 사전 검사(`assertSafeOutboundHostResolved`, `node:dns/promises`)에는 공인 주소를,
// 실제 연결의 주소 조회(`safeOutboundDispatcher`, `node:dns`)에는 loopback 을 답한다. 서버는 loopback 에 떠 있으므로 연결
// 시점 판정이 없으면 요청이 서버에 닿는다. HTTP Request 노드의 `http-request.connect-guard.spec.ts` 와 같은 재현이다.
jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));
jest.mock('node:dns', () => ({
  ...jest.requireActual('node:dns'),
  lookup: jest.fn(),
}));

const mockedPrecheck = precheckLookup as unknown as jest.MockedFunction<
  (hostname: string, options: { all: true }) => Promise<LookupAddress[]>
>;
const mockedConnect = connectLookup as unknown as jest.Mock<
  void,
  [
    string,
    { all: true },
    (err: Error | null, addresses: LookupAddress[]) => void,
  ]
>;

describe('HTTP 통합 연결 테스트 — 연결 시점 판정 (실제 fetch)', () => {
  let server: Server;
  let port: number;
  let requests = 0;
  let originalFetch: typeof global.fetch;
  let originalAllow: string | undefined;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      requests++;
      res.end('internal');
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    // 공용 dispatcher 의 keep-alive 연결을 먼저 닫아야 서버가 바로 닫힌다.
    await resetSafeOutboundDispatcherForTesting();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    originalFetch = global.fetch;
    originalAllow = process.env.ALLOW_PRIVATE_HOST_TARGETS;
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    // 운영은 전역 fetch 를 쓴다. jest 에서는 판정 오류가 테스트 realm 에서 만들어져 Node 내장 fetch 가 그 오류를
    // `new Error(String(err))` 로 다시 감싸고 `cause` 의 클래스가 사라진다. 같은 realm 에 올라오는 npm undici 의
    // fetch 로 바꿔 운영과 같은 `cause` 를 받는다.
    global.fetch = undiciFetch as unknown as typeof global.fetch;
    mockedPrecheck.mockReset();
    mockedConnect.mockReset();
    mockedPrecheck.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    mockedConnect.mockImplementation((_host, _opts, cb) =>
      cb(null, [{ address: '127.0.0.1', family: 4 }]),
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalAllow === undefined) {
      delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    } else {
      process.env.ALLOW_PRIVATE_HOST_TARGETS = originalAllow;
    }
  });

  it('연결할 때 푼 주소가 막힌 대역이면 HTTP_BLOCKED 로 끝나고 요청이 서버에 닿지 않는다', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const before = requests;

    try {
      const result = await testHttpConnection('bearer_token', {
        base_url: `http://rebind.test:${port}/v1`,
        token: 'tok-123',
      });

      expect(mockedPrecheck).toHaveBeenCalledWith('rebind.test', {
        all: true,
      });
      expect(mockedConnect).toHaveBeenCalledWith(
        'rebind.test',
        expect.objectContaining({ all: true }),
        expect.any(Function),
      );
      expect(result).toEqual({
        success: false,
        code: 'HTTP_BLOCKED',
        message: SSRF_BLOCKED_CLIENT_MESSAGE,
      });
      expect(requests).toBe(before);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('resolved to restricted IP "127.0.0.1"'),
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('ALLOW_PRIVATE_HOST_TARGETS=true 면 판정하지 않고 사설 대상에 접속한다', async () => {
    process.env.ALLOW_PRIVATE_HOST_TARGETS = 'true';
    const before = requests;

    const result = await testHttpConnection('bearer_token', {
      base_url: `http://127.0.0.1:${port}/v1`,
      token: 'tok-123',
    });

    expect(result).toEqual({ success: true, message: 'Connection successful' });
    expect(requests).toBe(before + 1);
    expect(mockedPrecheck).not.toHaveBeenCalled();
  });
});
