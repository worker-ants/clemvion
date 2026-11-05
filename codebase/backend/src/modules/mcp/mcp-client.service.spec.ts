import type { LookupAddress } from 'node:dns';
import { lookup } from 'node:dns/promises';
import { Logger } from '@nestjs/common';
import {
  McpClientService,
  McpHttpsRequiredError,
  McpInvalidHeaderError,
} from './mcp-client.service';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { TimeoutError } from '../../common/utils/with-timeout';

const mockClientInstances: Array<{
  connect: jest.Mock;
  close: jest.Mock;
  listTools: jest.Mock;
  callTool: jest.Mock;
  listResources: jest.Mock;
  readResource: jest.Mock;
  listPrompts: jest.Mock;
  getPrompt: jest.Mock;
  getServerCapabilities: jest.Mock;
  getServerVersion: jest.Mock;
}> = [];

const mockTransportInstances: Array<{
  url: URL;
  options: Record<string, unknown>;
}> = [];

jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn().mockImplementation(() => {
    const instance = {
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      listTools: jest.fn().mockResolvedValue({ tools: [] }),
      callTool: jest
        .fn()
        .mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] }),
      listResources: jest.fn().mockResolvedValue({ resources: [] }),
      readResource: jest.fn().mockResolvedValue({ contents: [] }),
      listPrompts: jest.fn().mockResolvedValue({ prompts: [] }),
      getPrompt: jest.fn().mockResolvedValue({ messages: [] }),
      getServerCapabilities: jest
        .fn()
        .mockReturnValue({ tools: {}, resources: {} }),
      getServerVersion: jest
        .fn()
        .mockReturnValue({ name: 'test-server', version: '1.0.0' }),
    };
    mockClientInstances.push(instance);
    return instance;
  }),
}));

jest.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: jest
    .fn()
    .mockImplementation((url: URL, options: Record<string, unknown>) => {
      mockTransportInstances.push({ url, options });
      return { url, options };
    }),
}));

// DNS 는 가짜로 둔다. `connect` 는 IP literal 이 아닌 호스트를 해석해 사설망 주소인지 본다(NERV Task `CLE-T-RAPNHB`).
// 실물로 두면 `mcp.example.com` 을 쓰는 테스트가 실제 조회를 나가 네트워크 없는 환경에서 flaky 가 된다. 기본값은 공인
// 주소 하나로 답하고, 해석 결과로 막는 경로는 테스트마다 정한다.
jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}));
// `lookup(host, { all: true })` 오버로드만 쓴다 — `jest.mocked(lookup)` 은 단일 주소 오버로드로 잡혀 배열을 거부한다.
const mockedLookup = lookup as unknown as jest.MockedFunction<
  (
    hostname: string,
    options: { all: true; verbatim?: boolean },
  ) => Promise<LookupAddress[]>
>;
const PUBLIC_ADDRESS: LookupAddress = { address: '93.184.216.34', family: 4 };

describe('McpClientService', () => {
  let service: McpClientService;
  // refactor M-6: MCP_ALLOW_INSECURE_URL 은 `mcp.allowInsecureUrl`(boolean) config 로 이전 —
  // 'true'/'1' 파싱은 config 레이어 책임(→ mcp.config.spec.ts). 본 spec 은 boolean flag 로 제어.
  // getter 가 호출 시점에 읽으므로 connect 직전 set.
  let allowInsecure: boolean;
  const mockConfigService = {
    get: (key: string) =>
      key === 'mcp.allowInsecureUrl' ? allowInsecure : undefined,
  };

  beforeEach(() => {
    mockClientInstances.length = 0;
    mockTransportInstances.length = 0;
    mockedLookup.mockReset();
    mockedLookup.mockResolvedValue([PUBLIC_ADDRESS]);
    allowInsecure = false;
    service = new McpClientService(mockConfigService as never);
  });

  describe('config injection (refactor M-6)', () => {
    it('생성자가 ConfigService(`mcp.maxConcurrentConnections`/`mcp.connectTimeoutMs`)를 읽어 초기화한다', () => {
      const keysRead: string[] = [];
      const cfg = {
        get: (key: string) => {
          keysRead.push(key);
          return key === 'mcp.maxConcurrentConnections' ? 5 : undefined;
        },
      };
      expect(() => new McpClientService(cfg as never)).not.toThrow();
      expect(keysRead).toContain('mcp.maxConcurrentConnections');
      expect(keysRead).toContain('mcp.connectTimeoutMs');
    });
  });

  describe('connect — URL & SSRF policy', () => {
    it('rejects non-HTTPS URLs', async () => {
      await expect(
        service.connect({
          url: 'http://insecure.example.com',
          authType: 'none',
        }),
      ).rejects.toThrow(McpHttpsRequiredError);
      expect(mockTransportInstances).toHaveLength(0);
    });

    it('rejects malformed URLs', async () => {
      await expect(
        service.connect({ url: 'not-a-url', authType: 'none' }),
      ).rejects.toThrow(McpHttpsRequiredError);
    });

    it('blocks loopback hosts', async () => {
      for (const host of ['localhost', '127.0.0.1', '127.5.5.5', '[::1]']) {
        const url = `https://${host}/mcp`;
        await expect(
          service.connect({ url, authType: 'none' }),
        ).rejects.toThrow(McpHttpsRequiredError);
      }
    });

    it('blocks RFC 1918 / link-local IPv4', async () => {
      for (const host of [
        '10.0.0.1',
        '172.16.5.5',
        '172.31.255.255',
        '192.168.1.1',
        '169.254.169.254', // AWS / GCP metadata
      ]) {
        await expect(
          service.connect({ url: `https://${host}/mcp`, authType: 'none' }),
        ).rejects.toThrow(McpHttpsRequiredError);
      }
    });

    it('blocks cloud metadata hostnames', async () => {
      for (const host of [
        'metadata.google.internal',
        'metadata.azure.com',
        'metadata.amazonaws.com',
      ]) {
        await expect(
          service.connect({ url: `https://${host}/`, authType: 'none' }),
        ).rejects.toThrow(McpHttpsRequiredError);
      }
    });

    // Node 의 URL 은 `[::ffff:127.0.0.1]` 의 hostname 을 `[::ffff:7f00:1]` 로 바꾼다. 점 형만 보던 검사는 이 모양을
    // 지나보냈다(NERV Task `CLE-T-DCQWEB`). IPv4 를 품은 IPv6 리터럴은 품은 IPv4 로 판정한다.
    it.each([
      ['[::ffff:127.0.0.1]', 'IPv4-mapped → loopback'],
      ['[::ffff:169.254.169.254]', 'IPv4-mapped → 메타데이터'],
      ['[::ffff:7f00:1]', 'IPv4-mapped hex 형'],
      ['[::ffff:6440:1]', 'IPv4-mapped → 100.64.0.1 (CGNAT)'],
      ['[::127.0.0.1]', 'IPv4-compatible → loopback'],
      ['[::ffff:0:a00:1]', 'SIIT → 10/8'],
      ['[64:ff9b::a9fe:a9fe]', 'NAT64 → 메타데이터'],
      // 앞뒤 16비트가 달라서 순서를 바꿔 읽으면 `1.1.192.168` 이 되어 통과하는 값
      ['[::ffff:c0a8:101]', 'IPv4-mapped → 192.168.1.1 (hi/lo 비대칭)'],
    ])('blocks IPv6 literal %s (%s)', async (host) => {
      await expect(
        service.connect({ url: `https://${host}/mcp`, authType: 'none' }),
      ).rejects.toThrow(McpHttpsRequiredError);
      expect(mockTransportInstances).toHaveLength(0);
    });

    // 통합 노드의 사설망 허용 플래그는 MCP 에 적용되지 않는다(우회는 MCP_ALLOW_INSECURE_URL 뿐).
    it('blocks an IPv4-mapped loopback even when ALLOW_PRIVATE_HOST_TARGETS=true', async () => {
      const orig = process.env.ALLOW_PRIVATE_HOST_TARGETS;
      process.env.ALLOW_PRIVATE_HOST_TARGETS = 'true';
      try {
        await expect(
          service.connect({
            url: 'https://[::ffff:7f00:1]/mcp',
            authType: 'none',
          }),
        ).rejects.toThrow(McpHttpsRequiredError);
        expect(mockTransportInstances).toHaveLength(0);
      } finally {
        if (orig === undefined) delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
        else process.env.ALLOW_PRIVATE_HOST_TARGETS = orig;
      }
    });

    it('allows an IPv4-mapped literal that carries a public IPv4', async () => {
      await service.connect({
        url: 'https://[::ffff:8.8.8.8]/mcp',
        authType: 'none',
      });
      expect(mockTransportInstances).toHaveLength(1);
    });

    // `1.1.10.0` 은 공인이고 앞뒤를 바꿔 읽은 `10.0.1.1` 은 사설이다. 변환 순서가 뒤집히면 이 연결이 막힌다.
    it('allows an IPv4-mapped literal whose swapped reading would be private', async () => {
      await service.connect({
        url: 'https://[::ffff:101:a00]/mcp',
        authType: 'none',
      });
      expect(mockTransportInstances).toHaveLength(1);
    });

    it('allows public HTTPS URLs', async () => {
      await service.connect({
        url: 'https://mcp.example.com',
        authType: 'none',
      });
      expect(mockTransportInstances).toHaveLength(1);
    });

    // 'true'/'1' → ON, 그 외 → OFF 의 env 문자열 파싱은 config 레이어(mcp.config.spec.ts)가
    // 검증한다. 본 describe 는 서비스가 boolean flag 를 받았을 때의 SSRF 우회 동작을 검증.
    describe('allowInsecureUrl escape hatch', () => {
      it('allowInsecureUrl=true 면 http://localhost 를 허용한다', async () => {
        allowInsecure = true;
        await service.connect({
          url: 'http://localhost:3001/mcp',
          authType: 'none',
        });
        expect(mockTransportInstances).toHaveLength(1);
      });

      it('allowInsecureUrl=true 면 차단되던 사설 IP 도 허용한다', async () => {
        allowInsecure = true;
        await service.connect({
          url: 'http://10.0.0.5/mcp',
          authType: 'none',
        });
        expect(mockTransportInstances).toHaveLength(1);
      });

      it('allowInsecureUrl=true 여도 non-http(s) 스킴(file://)은 거부한다', async () => {
        allowInsecure = true;
        await expect(
          service.connect({ url: 'file:///etc/passwd', authType: 'none' }),
        ).rejects.toThrow(McpHttpsRequiredError);
      });
    });
  });

  // CLE-INT-MCP 「자격 증명과 URL 검증」 3항 — 호스트 이름은 연결 직전에 해석해 나온 주소마다 literal 과 같은 판정을 한다.
  describe('connect — DNS-resolved address check (CLE-T-RAPNHB)', () => {
    it.each([
      ['10.0.0.5', 4],
      ['127.0.0.1', 4],
      ['169.254.169.254', 4],
      ['100.64.1.1', 4],
      ['192.168.0.10', 4],
      ['0.0.0.0', 4],
      ['::1', 6],
      ['fd00::1', 6],
      ['fe80::1', 6],
      ['::ffff:7f00:1', 6],
      ['::ffff:10.0.0.1', 6],
      ['64:ff9b::a9fe:a9fe', 6],
    ])(
      '호스트 이름이 사설망 주소 %s 로 풀리면 막는다',
      async (address, family) => {
        mockedLookup.mockResolvedValue([{ address, family }]);

        await expect(
          service.connect({
            url: 'https://mcp.example.com/mcp',
            authType: 'none',
          }),
        ).rejects.toThrow(McpHttpsRequiredError);
        expect(mockedLookup).toHaveBeenCalledWith('mcp.example.com', {
          all: true,
          verbatim: true,
        });
        expect(mockTransportInstances).toHaveLength(0);
      },
    );

    it('여러 주소 가운데 하나라도 사설망이면 막는다', async () => {
      mockedLookup.mockResolvedValue([
        PUBLIC_ADDRESS,
        { address: '10.1.2.3', family: 4 },
      ]);

      await expect(
        service.connect({ url: 'https://mcp.example.com', authType: 'none' }),
      ).rejects.toThrow(McpHttpsRequiredError);
      expect(mockTransportInstances).toHaveLength(0);
    });

    it('오류 메시지에는 호스트 이름만 싣고 해석된 주소는 서버 로그에만 남긴다', async () => {
      const warnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      mockedLookup.mockResolvedValue([{ address: '10.9.8.7', family: 4 }]);
      try {
        const err = (await service
          .connect({ url: 'https://mcp.example.com/mcp', authType: 'none' })
          .catch((err_: unknown) => err_)) as Error;

        expect(err).toBeInstanceOf(McpHttpsRequiredError);
        expect(err.message).toContain('mcp.example.com');
        expect(err.message).not.toContain('10.9.8.7');
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('10.9.8.7'),
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('공인 주소로만 풀리면 연결한다', async () => {
      mockedLookup.mockResolvedValue([
        PUBLIC_ADDRESS,
        { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
      ]);

      await service.connect({
        url: 'https://mcp.example.com',
        authType: 'none',
      });

      expect(mockedLookup).toHaveBeenCalledTimes(1);
      expect(mockTransportInstances).toHaveLength(1);
    });

    it('IP literal 은 해석하지 않는다', async () => {
      await service.connect({ url: 'https://8.8.8.8/mcp', authType: 'none' });
      await service.connect({
        url: 'https://[2001:4860:4860::8888]/mcp',
        authType: 'none',
      });

      expect(mockedLookup).not.toHaveBeenCalled();
      expect(mockTransportInstances).toHaveLength(2);
    });

    it('DNS 해석이 실패하면 막지 않고 연결을 시도한다(실패는 연결 단계에서 드러난다)', async () => {
      mockedLookup.mockRejectedValue(
        Object.assign(new Error('getaddrinfo ENOTFOUND mcp.example.com'), {
          code: 'ENOTFOUND',
        }),
      );

      await service.connect({
        url: 'https://mcp.example.com',
        authType: 'none',
      });

      expect(mockTransportInstances).toHaveLength(1);
    });

    it('allowInsecureUrl=true 면 해석하지 않는다', async () => {
      allowInsecure = true;
      mockedLookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);

      await service.connect({
        url: 'http://mcp.internal.test/mcp',
        authType: 'none',
      });

      expect(mockedLookup).not.toHaveBeenCalled();
      expect(mockTransportInstances).toHaveLength(1);
    });

    // 통합 노드의 사설망 허용 플래그는 MCP 에 적용되지 않는다(우회는 MCP_ALLOW_INSECURE_URL 뿐).
    it('ALLOW_PRIVATE_HOST_TARGETS=true 여도 해석 결과 검사를 건너뛰지 않는다', async () => {
      const orig = process.env.ALLOW_PRIVATE_HOST_TARGETS;
      process.env.ALLOW_PRIVATE_HOST_TARGETS = 'true';
      mockedLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
      try {
        await expect(
          service.connect({ url: 'https://mcp.example.com', authType: 'none' }),
        ).rejects.toThrow(McpHttpsRequiredError);
      } finally {
        if (orig === undefined) delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
        else process.env.ALLOW_PRIVATE_HOST_TARGETS = orig;
      }
    });
  });

  describe('connect — timeout classification', () => {
    // 전체 mock client shape (connect 만 override) — connect 가 reject 하므로
    // 나머지 메서드는 호출되지 않지만 배열 원소 타입을 만족시킨다.
    const fullMock = (
      connect: jest.Mock,
    ): (typeof mockClientInstances)[number] => ({
      connect,
      close: jest.fn().mockResolvedValue(undefined),
      listTools: jest.fn().mockResolvedValue({ tools: [] }),
      callTool: jest.fn(),
      listResources: jest.fn(),
      readResource: jest.fn(),
      listPrompts: jest.fn(),
      getPrompt: jest.fn(),
      getServerCapabilities: jest.fn().mockReturnValue({}),
      getServerVersion: jest
        .fn()
        .mockReturnValue({ name: 'x', version: '1.0.0' }),
    });

    it('connect 가 deadline 만료(abort)로 실패하면 TimeoutError 를 throw 한다', async () => {
      jest.useFakeTimers();
      try {
        (Client as jest.Mock).mockImplementationOnce(() => {
          // transport 의 abort signal 이 발동하면 reject — connectInner 의 타이머가
          // deadline 만료 시 abort() 를 부른다.
          const instance = fullMock(
            jest.fn().mockImplementation((transport: unknown) => {
              const { signal } = (
                transport as {
                  options: { requestInit: { signal: AbortSignal } };
                }
              ).options.requestInit;
              return new Promise((_resolve, reject) => {
                signal.addEventListener('abort', () =>
                  reject(new Error('The operation was aborted')),
                );
              });
            }),
          );
          mockClientInstances.push(instance);
          return instance;
        });
        const p = service.connect({
          url: 'https://mcp.example.com',
          authType: 'none',
        });
        const assertion = expect(p).rejects.toBeInstanceOf(TimeoutError);
        await jest.advanceTimersByTimeAsync(10_000);
        await assertion;
      } finally {
        jest.useRealTimers();
      }
    });

    it('connect 가 타임아웃 아닌 이유로 실패하면 원본 에러를 전파한다 (TimeoutError 아님)', async () => {
      (Client as jest.Mock).mockImplementationOnce(() => {
        const instance = fullMock(
          jest.fn().mockRejectedValue(new Error('ECONNREFUSED 10.0.0.5')),
        );
        mockClientInstances.push(instance);
        return instance;
      });
      const err = await service
        .connect({ url: 'https://mcp.example.com', authType: 'none' })
        .catch((err_: unknown) => err_);
      expect(err).toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(TimeoutError);
      expect((err as Error).message).toContain('ECONNREFUSED');
    });
  });

  describe('connect — auth header injection', () => {
    it('connects via Streamable HTTP without auth header for authType=none', async () => {
      await service.connect({
        url: 'https://mcp.example.com',
        authType: 'none',
      });

      expect(mockTransportInstances).toHaveLength(1);
      expect(mockTransportInstances[0].url.toString()).toBe(
        'https://mcp.example.com/',
      );
      const headers = readHeaders(mockTransportInstances[0].options);
      expect(headers.authorization).toBeUndefined();
      expect(mockClientInstances[0].connect).toHaveBeenCalledTimes(1);
    });

    it('injects Authorization: Bearer for bearer_token', async () => {
      await service.connect({
        url: 'https://mcp.example.com',
        authType: 'bearer_token',
        token: 'secret-token',
      });

      const headers = readHeaders(mockTransportInstances[0].options);
      expect(headers.authorization).toBe('Bearer secret-token');
    });

    it('injects custom header for api_key', async () => {
      await service.connect({
        url: 'https://mcp.example.com',
        authType: 'api_key',
        headerName: 'X-Api-Key',
        value: 'secret-key',
      });

      const headers = readHeaders(mockTransportInstances[0].options);
      expect(headers['x-api-key']).toBe('secret-key');
    });

    it('merges default_headers (lowest precedence) with auth headers', async () => {
      await service.connect({
        url: 'https://mcp.example.com',
        authType: 'bearer_token',
        token: 'tok',
        defaultHeaders: {
          'X-Tenant': 'acme',
          Authorization: 'should-overwrite',
        },
      });

      const headers = readHeaders(mockTransportInstances[0].options);
      expect(headers['x-tenant']).toBe('acme');
      // bearer_token auth must override any matching default_header
      expect(headers.authorization).toBe('Bearer tok');
    });
  });

  describe('connect — header sanitization', () => {
    it('rejects CRLF in default_headers names', async () => {
      await expect(
        service.connect({
          url: 'https://mcp.example.com',
          authType: 'none',
          defaultHeaders: { 'X-Bad\r\nInjected': 'value' },
        }),
      ).rejects.toThrow(McpInvalidHeaderError);
    });

    it('rejects CRLF in default_headers values', async () => {
      await expect(
        service.connect({
          url: 'https://mcp.example.com',
          authType: 'none',
          defaultHeaders: { 'X-Tenant': 'acme\r\nX-Smuggle: bad' },
        }),
      ).rejects.toThrow(McpInvalidHeaderError);
    });

    it('rejects framing-relevant headers in default_headers', async () => {
      for (const reserved of [
        'Host',
        'Content-Length',
        'Transfer-Encoding',
        'Connection',
        'mcp-session-id',
      ]) {
        await expect(
          service.connect({
            url: 'https://mcp.example.com',
            authType: 'none',
            defaultHeaders: { [reserved]: 'value' },
          }),
        ).rejects.toThrow(McpInvalidHeaderError);
      }
    });

    it('rejects api_key with CRLF in headerName', async () => {
      await expect(
        service.connect({
          url: 'https://mcp.example.com',
          authType: 'api_key',
          headerName: 'X-Api\r\nKey',
          value: 'v',
        } as never),
      ).rejects.toThrow(McpInvalidHeaderError);
    });
  });

  describe('connect — auth credential validation', () => {
    it('throws McpAuthError when bearer_token credential is missing (runtime)', async () => {
      // The TS type forbids token-less bearer_token, but the runtime still
      // guards against malformed callers passing through `as never`.
      await expect(
        service.connect({
          url: 'https://mcp.example.com',
          authType: 'bearer_token',
        } as never),
      ).rejects.toThrow();
    });

    it('throws when api_key headerName is missing (runtime)', async () => {
      await expect(
        service.connect({
          url: 'https://mcp.example.com',
          authType: 'api_key',
          value: 'v',
        } as never),
      ).rejects.toThrow();
    });

    it('throws when api_key value is missing (runtime)', async () => {
      await expect(
        service.connect({
          url: 'https://mcp.example.com',
          authType: 'api_key',
          headerName: 'X-Api-Key',
        } as never),
      ).rejects.toThrow();
    });
  });

  describe('connect — capabilities surface', () => {
    it('returns a session that exposes capabilities + serverInfo', async () => {
      const session = await service.connect({
        url: 'https://mcp.example.com',
        authType: 'none',
      });
      expect(session.capabilities).toEqual({ tools: {}, resources: {} });
      expect(session.serverInfo).toEqual({
        name: 'test-server',
        version: '1.0.0',
      });
    });
  });

  describe('session methods proxy to underlying Client', () => {
    it('listTools forwards to Client.listTools', async () => {
      const session = await service.connect({
        url: 'https://mcp.example.com',
        authType: 'none',
      });
      mockClientInstances[0].listTools.mockResolvedValueOnce({
        tools: [{ name: 'echo', description: 'Echo', inputSchema: {} }],
      });
      const tools = await session.listTools();
      expect(tools.tools[0].name).toBe('echo');
    });

    it('callTool forwards args verbatim', async () => {
      const session = await service.connect({
        url: 'https://mcp.example.com',
        authType: 'none',
      });
      await session.callTool({
        name: 'echo',
        arguments: { message: 'hi' },
      });
      expect(mockClientInstances[0].callTool).toHaveBeenCalledWith(
        { name: 'echo', arguments: { message: 'hi' } },
        undefined,
        undefined,
      );
    });

    it('listResources forwards to Client.listResources', async () => {
      const session = await service.connect({
        url: 'https://mcp.example.com',
        authType: 'none',
      });
      mockClientInstances[0].listResources.mockResolvedValueOnce({
        resources: [{ uri: 'file://x', name: 'X' }],
      });
      const result = await session.listResources({ cursor: 'c1' });
      expect(mockClientInstances[0].listResources).toHaveBeenCalledWith({
        cursor: 'c1',
      });
      expect(result.resources[0].uri).toBe('file://x');
    });

    it('readResource forwards uri', async () => {
      const session = await service.connect({
        url: 'https://mcp.example.com',
        authType: 'none',
      });
      await session.readResource({ uri: 'file://x' });
      expect(mockClientInstances[0].readResource).toHaveBeenCalledWith(
        { uri: 'file://x' },
        undefined,
      );
    });

    it('listPrompts forwards to Client.listPrompts', async () => {
      const session = await service.connect({
        url: 'https://mcp.example.com',
        authType: 'none',
      });
      mockClientInstances[0].listPrompts.mockResolvedValueOnce({
        prompts: [{ name: 'greet' }],
      });
      const result = await session.listPrompts();
      expect(mockClientInstances[0].listPrompts).toHaveBeenCalledWith(
        undefined,
      );
      expect(result.prompts[0].name).toBe('greet');
    });

    it('getPrompt forwards name and string-valued arguments', async () => {
      const session = await service.connect({
        url: 'https://mcp.example.com',
        authType: 'none',
      });
      await session.getPrompt({ name: 'hello', arguments: { who: 'world' } });
      expect(mockClientInstances[0].getPrompt).toHaveBeenCalledWith(
        { name: 'hello', arguments: { who: 'world' } },
        undefined,
      );
    });

    it('close cleans up the underlying Client', async () => {
      const session = await service.connect({
        url: 'https://mcp.example.com',
        authType: 'none',
      });
      await session.close();
      expect(mockClientInstances[0].close).toHaveBeenCalledTimes(1);
    });

    it('close swallows underlying errors and continues', async () => {
      const session = await service.connect({
        url: 'https://mcp.example.com',
        authType: 'none',
      });
      mockClientInstances[0].close.mockRejectedValueOnce(new Error('boom'));
      // close() must NOT throw — that would mask the upstream failure
      // that triggered the close in the first place.
      await expect(session.close()).resolves.toBeUndefined();
    });
  });
});

/**
 * Pull headers out of the StreamableHTTPClientTransport options shape and
 * lowercase keys for case-insensitive assertions.
 */
function readHeaders(
  options: Record<string, unknown>,
): Record<string, string | undefined> {
  const requestInit = options.requestInit as
    { headers?: HeadersInit } | undefined;
  const raw = requestInit?.headers;
  if (!raw) return {};
  const out: Record<string, string | undefined> = {};
  if (raw instanceof Headers) {
    raw.forEach((value, key) => {
      out[key.toLowerCase()] = value;
    });
    return out;
  }
  if (Array.isArray(raw)) {
    for (const [k, v] of raw) out[k.toLowerCase()] = v;
    return out;
  }
  for (const [k, v] of Object.entries(raw)) {
    out[k.toLowerCase()] = v;
  }
  return out;
}
