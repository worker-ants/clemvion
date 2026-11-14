import type { LookupAddress } from 'node:dns';
import { lookup as connectLookup } from 'node:dns';
import { lookup as precheckLookup } from 'node:dns/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Logger } from '@nestjs/common';
import { fetch as undiciFetch } from 'undici';
import { HttpRequestHandler } from './http-request.handler.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

// DNS rebinding 을 재현한다(CLE-T-BS1WD1). 사전 검사(`assertSafeOutboundHostResolved`, `node:dns/promises`)에는 공인 주소를,
// 실제 연결의 주소 조회(`safeOutboundDispatcher`, `node:dns`)에는 loopback 을 답한다. 서버는 loopback 에 떠 있으므로 연결
// 시점 판정이 없으면 요청이 서버에 닿는다.
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

const context: ExecutionContext = {
  executionId: 'exec-1',
  workflowId: 'wf-1',
  variables: {},
  nodeOutputCache: {},
  structuredOutputCache: {},
  engineResolvedConfigCache: {},
  conversationThread: createEmptyConversationThread(),
  recursionDepth: 0,
};

describe('HTTP Request — connect-time guard against DNS rebinding (real fetch)', () => {
  let server: Server;
  let port: number;
  let requests = 0;
  let originalFetch: typeof global.fetch;

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
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    originalFetch = global.fetch;
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
  });

  it('blocks the request with HTTP_BLOCKED before any byte reaches the internal address', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const before = requests;

    try {
      const result = (await new HttpRequestHandler().execute(
        null,
        { method: 'GET', url: `http://rebind.test:${port}/` },
        context,
      )) as unknown as {
        port: string;
        output: { error: { code: string } };
      };

      expect(mockedPrecheck).toHaveBeenCalledWith('rebind.test', {
        all: true,
      });
      expect(mockedConnect).toHaveBeenCalledWith(
        'rebind.test',
        expect.objectContaining({ all: true }),
        expect.any(Function),
      );
      expect(result.port).toBe('error');
      expect(result.output.error.code).toBe('HTTP_BLOCKED');
      expect(requests).toBe(before);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('resolved to restricted IP "127.0.0.1"'),
      );
    } finally {
      warn.mockRestore();
    }
  });
});
