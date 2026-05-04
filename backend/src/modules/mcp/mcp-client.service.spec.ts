import {
  McpClientService,
  McpAuthError,
  McpHttpsRequiredError,
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

  describe('connect', () => {
    it('rejects non-HTTPS URLs', async () => {
      await expect(
        service.connect({
          url: 'http://insecure.example.com',
          authType: 'none',
        }),
      ).rejects.toThrow(McpHttpsRequiredError);
      expect(mockTransportInstances).toHaveLength(0);
    });

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

    it('throws McpAuthError when bearer_token credential is missing', async () => {
      await expect(
        service.connect({
          url: 'https://mcp.example.com',
          authType: 'bearer_token',
        }),
      ).rejects.toThrow(McpAuthError);
    });

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

    it('getPrompt forwards name and string-valued arguments', async () => {
      const session = await service.connect({
        url: 'https://mcp.example.com',
        authType: 'none',
      });
      // MCP prompt arguments are spec'd as Record<string,string>; the type
      // narrowing here matches the contract.
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
