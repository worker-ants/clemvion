import {
  McpClientService,
  McpHttpsRequiredError,
  McpInvalidHeaderError,
} from './mcp-client.service';

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

describe('McpClientService', () => {
  let service: McpClientService;

  beforeEach(() => {
    mockClientInstances.length = 0;
    mockTransportInstances.length = 0;
    service = new McpClientService();
  });

  describe('connect — URL & SSRF policy', () => {
    const ORIGINAL_INSECURE = process.env.MCP_ALLOW_INSECURE_URL;
    afterEach(() => {
      if (ORIGINAL_INSECURE === undefined) {
        delete process.env.MCP_ALLOW_INSECURE_URL;
      } else {
        process.env.MCP_ALLOW_INSECURE_URL = ORIGINAL_INSECURE;
      }
    });

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

    it('allows public HTTPS URLs', async () => {
      await service.connect({
        url: 'https://mcp.example.com',
        authType: 'none',
      });
      expect(mockTransportInstances).toHaveLength(1);
    });

    describe('MCP_ALLOW_INSECURE_URL escape hatch', () => {
      it('allows http://localhost when set to "true"', async () => {
        process.env.MCP_ALLOW_INSECURE_URL = 'true';
        await service.connect({
          url: 'http://localhost:3001/mcp',
          authType: 'none',
        });
        expect(mockTransportInstances).toHaveLength(1);
      });

      it('also allows previously-blocked private IPs when set', async () => {
        process.env.MCP_ALLOW_INSECURE_URL = 'true';
        await service.connect({
          url: 'http://10.0.0.5/mcp',
          authType: 'none',
        });
        expect(mockTransportInstances).toHaveLength(1);
      });

      it('still rejects non-http(s) schemes (file://) even when set', async () => {
        process.env.MCP_ALLOW_INSECURE_URL = 'true';
        await expect(
          service.connect({ url: 'file:///etc/passwd', authType: 'none' }),
        ).rejects.toThrow(McpHttpsRequiredError);
      });

      it('"1" is also accepted as truthy', async () => {
        process.env.MCP_ALLOW_INSECURE_URL = '1';
        await service.connect({
          url: 'http://localhost:3001/mcp',
          authType: 'none',
        });
        expect(mockTransportInstances).toHaveLength(1);
      });

      it('any other value falls back to strict mode', async () => {
        process.env.MCP_ALLOW_INSECURE_URL = 'yes-please';
        await expect(
          service.connect({
            url: 'http://localhost:3001/mcp',
            authType: 'none',
          }),
        ).rejects.toThrow(McpHttpsRequiredError);
      });
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
    | { headers?: HeadersInit }
    | undefined;
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
