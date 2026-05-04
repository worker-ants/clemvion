import {
  McpTestConnectionService,
  TestConnectionResult,
} from './mcp-test-connection.service';
import {
  McpAuthError,
  McpHttpsRequiredError,
  McpSession,
} from './mcp-client.service';

function makeSession(overrides: Partial<McpSession> = {}): McpSession {
  return {
    capabilities: { tools: {}, resources: {}, prompts: {} },
    serverInfo: { name: 'sample', version: '1.0.0' },
    listTools: jest.fn().mockResolvedValue({
      tools: [
        { name: 'a', description: 'A', inputSchema: {} },
        { name: 'b', description: 'B', inputSchema: {} },
      ],
    }),
    callTool: jest.fn(),
    listResources: jest.fn(),
    readResource: jest.fn(),
    listPrompts: jest.fn(),
    getPrompt: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as McpSession;
}

describe('McpTestConnectionService', () => {
  let connect: jest.Mock<Promise<McpSession>, [unknown]>;
  let service: McpTestConnectionService;

  beforeEach(() => {
    connect = jest.fn();
    service = new McpTestConnectionService({ connect } as never);
  });

  it('reports success with capability preview when initialize succeeds', async () => {
    const session = makeSession();
    connect.mockResolvedValueOnce(session);

    const result = await service.test({
      url: 'https://mcp.example.com',
      authType: 'bearer_token',
      token: 'abc',
    });

    expect(result.success).toBe(true);
    expect(result.capabilities).toEqual({
      tools: {},
      resources: {},
      prompts: {},
    });
    expect(result.serverInfo).toEqual({ name: 'sample', version: '1.0.0' });
    expect(result.preview).toEqual({
      toolCount: 2,
      resourceSupported: true,
      promptSupported: true,
    });
    // Always disconnects to keep the session count bounded.
    expect(session.close).toHaveBeenCalledTimes(1);
  });

  it('omits toolCount when server does not expose tools capability', async () => {
    const session = makeSession({
      capabilities: { resources: {} },
      listTools: jest.fn().mockResolvedValue({ tools: [] }),
    });
    connect.mockResolvedValueOnce(session);

    const result = await service.test({
      url: 'https://mcp.example.com',
      authType: 'none',
    });

    expect(result.success).toBe(true);
    expect(result.preview.toolCount).toBeUndefined();
    expect(result.preview.resourceSupported).toBe(true);
    expect(result.preview.promptSupported).toBe(false);
  });

  it('translates McpHttpsRequiredError to MCP_HTTPS_REQUIRED', async () => {
    connect.mockRejectedValueOnce(
      new McpHttpsRequiredError('http://insecure.example.com'),
    );
    const result = await service.test({
      url: 'http://insecure.example.com',
      authType: 'none',
    });
    expectFailure(result, 'MCP_HTTPS_REQUIRED');
  });

  it('translates McpAuthError to MCP_AUTH_FAILED', async () => {
    connect.mockRejectedValueOnce(
      new McpAuthError('bearer_token credential requires a non-empty token'),
    );
    const result = await service.test({
      url: 'https://mcp.example.com',
      authType: 'bearer_token',
    });
    expectFailure(result, 'MCP_AUTH_FAILED');
  });

  it('translates network errors to MCP_CONNECT_FAILED', async () => {
    connect.mockRejectedValueOnce(
      Object.assign(new Error('fetch failed'), { code: 'ECONNREFUSED' }),
    );
    const result = await service.test({
      url: 'https://mcp.example.com',
      authType: 'none',
    });
    expectFailure(result, 'MCP_CONNECT_FAILED');
    expect(result.message).toContain('fetch failed');
  });

  it('translates initialize-time tools/list failure to MCP_LIST_FAILED', async () => {
    const session = makeSession({
      listTools: jest.fn().mockRejectedValue(new Error('boom')),
    });
    connect.mockResolvedValueOnce(session);

    const result = await service.test({
      url: 'https://mcp.example.com',
      authType: 'none',
    });

    expectFailure(result, 'MCP_LIST_FAILED');
    // Even when listTools fails, the session must still be closed.
    expect(session.close).toHaveBeenCalledTimes(1);
  });

  it('passes through credentials structure into McpClientService.connect', async () => {
    connect.mockResolvedValueOnce(makeSession());
    await service.test({
      url: 'https://mcp.example.com',
      authType: 'api_key',
      headerName: 'X-Api-Key',
      value: 'k',
      defaultHeaders: { 'X-Tenant': 'acme' },
    });
    expect(connect).toHaveBeenCalledWith({
      url: 'https://mcp.example.com',
      authType: 'api_key',
      headerName: 'X-Api-Key',
      value: 'k',
      defaultHeaders: { 'X-Tenant': 'acme' },
    });
  });
});

function expectFailure(result: TestConnectionResult, code: string): void {
  expect(result.success).toBe(false);
  expect(result.code).toBe(code);
  expect(result.message).toBeDefined();
}
