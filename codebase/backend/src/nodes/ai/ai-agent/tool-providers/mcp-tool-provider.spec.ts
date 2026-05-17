import {
  McpToolProvider,
  mcpToolName,
  parseMcpToolName,
} from './mcp-tool-provider';
import type {
  McpClientService,
  McpSession,
} from '../../../../modules/mcp/mcp-client.service';
import type { IntegrationsService } from '../../../../modules/integrations/integrations.service';
import type { Integration } from '../../../../modules/integrations/entities/integration.entity';

function makeIntegration(overrides: Partial<Integration> = {}): Integration {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    workspaceId: 'ws-1',
    serviceType: 'mcp',
    name: 'Demo MCP',
    authType: 'bearer_token',
    credentials: {
      url: 'https://mcp.example.com',
      token: 'tok',
    },
    scope: 'organization',
    status: 'connected',
    statusReason: null,
    tokenExpiresAt: null,
    lastUsedAt: null,
    lastRotatedAt: null,
    lastError: null,
    createdBy: 'u-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Integration;
}

function makeSession(overrides: Partial<McpSession> = {}): McpSession {
  return {
    capabilities: { tools: {} },
    serverInfo: { name: 's', version: '1.0.0' },
    listTools: jest.fn().mockResolvedValue({
      tools: [
        {
          name: 'echo',
          description: 'Echo a message back',
          inputSchema: {
            type: 'object',
            properties: { msg: { type: 'string' } },
            required: ['msg'],
          },
        },
        {
          name: 'now',
          description: 'Return the current time',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    }),
    callTool: jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'hello' }],
    }),
    listResources: jest.fn().mockResolvedValue({ resources: [] }),
    readResource: jest.fn().mockResolvedValue({ contents: [] }),
    listPrompts: jest.fn().mockResolvedValue({ prompts: [] }),
    getPrompt: jest.fn().mockResolvedValue({ messages: [] }),
    close: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as McpSession;
}

describe('mcpToolName / parseMcpToolName', () => {
  it('produces stable mcp_<sid>__<name> for an integrationId+toolName pair', () => {
    const name = mcpToolName('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'echo');
    expect(name).toBe('mcp_aaaaaaaa__echo');
  });

  it('sanitizes non-alphanumeric chars in tool name', () => {
    const name = mcpToolName(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      'foo.bar-baz',
    );
    expect(name).toBe('mcp_aaaaaaaa__foo_bar_baz');
  });

  it('round-trips a meta tool name (list_resources)', () => {
    const name = mcpToolName(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      'list_resources',
    );
    const parsed = parseMcpToolName(name);
    expect(parsed?.sid).toBe('aaaaaaaa');
    expect(parsed?.toolNameSanitized).toBe('list_resources');
  });

  it('returns null for non-MCP tool names', () => {
    expect(parseMcpToolName('kb_xyz')).toBeNull();
    expect(parseMcpToolName('cond_abc')).toBeNull();
    expect(parseMcpToolName('mcp_only_one_section')).toBeNull(); // missing __
  });
});

describe('McpToolProvider', () => {
  let mcpClient: { connect: jest.Mock<Promise<McpSession>, [unknown]> };
  let integrations: {
    getForExecution: jest.Mock<Promise<Integration>, [string, string]>;
  };
  let provider: McpToolProvider;

  beforeEach(() => {
    mcpClient = { connect: jest.fn() };
    integrations = { getForExecution: jest.fn() };
    provider = new McpToolProvider(
      mcpClient as unknown as McpClientService,
      integrations as unknown as IntegrationsService,
    );
  });

  describe('matches', () => {
    it('returns true for mcp_-prefixed names', () => {
      expect(provider.matches('mcp_abcdef12__echo')).toBe(true);
      expect(provider.matches('mcp_abcdef12__list_resources')).toBe(true);
    });

    it('returns false for other prefixes', () => {
      expect(provider.matches('kb_abc')).toBe(false);
      expect(provider.matches('cond_abc')).toBe(false);
      expect(provider.matches('tool_abc')).toBe(false);
      expect(provider.matches('echo')).toBe(false);
    });
  });

  describe('buildTools — empty / disabled', () => {
    it('returns [] when mcpServers is empty', async () => {
      const tools = await provider.buildTools({
        config: { mcpServers: [] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(tools).toEqual([]);
      expect(integrations.getForExecution).not.toHaveBeenCalled();
    });

    it('returns [] when mcpServers config is missing', async () => {
      const tools = await provider.buildTools({
        config: {},
        workspaceId: 'ws-1',
      });
      expect(tools).toEqual([]);
    });
  });

  describe('buildTools — single server', () => {
    const integration = makeIntegration();

    beforeEach(() => {
      integrations.getForExecution.mockResolvedValue(integration);
      mcpClient.connect.mockResolvedValue(makeSession());
    });

    it('connects via Integration credentials and lists tools', async () => {
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: integration.id }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });

      expect(integrations.getForExecution).toHaveBeenCalledWith(
        integration.id,
        'ws-1',
      );
      expect(mcpClient.connect).toHaveBeenCalledWith({
        authType: 'bearer_token',
        url: 'https://mcp.example.com',
        token: 'tok',
        defaultHeaders: undefined,
      });
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe(`mcp_aaaaaaaa__echo`);
      expect(tools[0].parameters).toEqual({
        type: 'object',
        properties: { msg: { type: 'string' } },
        required: ['msg'],
      });
      expect(tools[0].description).toContain('Echo a message back');
      expect(tools[0].description).toContain('Demo MCP');
    });

    it('skips a tool not in enabledTools allowlist', async () => {
      const tools = await provider.buildTools({
        config: {
          mcpServers: [
            { integrationId: integration.id, enabledTools: ['echo'] },
          ],
        },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(tools.map((t) => t.name)).toEqual(['mcp_aaaaaaaa__echo']);
    });

    it("`['*']` allowlist exposes all tools", async () => {
      const tools = await provider.buildTools({
        config: {
          mcpServers: [{ integrationId: integration.id, enabledTools: ['*'] }],
        },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(tools).toHaveLength(2);
    });

    it('applies toolOverrides description', async () => {
      const tools = await provider.buildTools({
        config: {
          mcpServers: [
            {
              integrationId: integration.id,
              toolOverrides: [{ toolName: 'echo', description: 'OVERRIDE' }],
            },
          ],
        },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      const echoTool = tools.find((t) => t.name === 'mcp_aaaaaaaa__echo');
      expect(echoTool?.description).toContain('OVERRIDE');
      // Override does not strip the server-name suffix — operators still
      // need to see which server a tool came from.
      expect(echoTool?.description).toContain('Demo MCP');
    });

    it('caches the session for reuse by execute()', async () => {
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: integration.id }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      // Second call within the same execution does NOT reconnect.
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: integration.id }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(mcpClient.connect).toHaveBeenCalledTimes(1);
    });

    it('different executionId opens a fresh session', async () => {
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: integration.id }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: integration.id }] },
        workspaceId: 'ws-1',
        executionId: 'exec-2',
      });
      expect(mcpClient.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe('buildTools — capability-based meta tools', () => {
    const integration = makeIntegration();

    beforeEach(() => {
      integrations.getForExecution.mockResolvedValue(integration);
    });

    it('emits resource meta tools when server reports resources capability', async () => {
      mcpClient.connect.mockResolvedValue(
        makeSession({
          capabilities: { tools: {}, resources: {} },
        }),
      );
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: integration.id }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      const names = tools.map((t) => t.name);
      expect(names).toContain('mcp_aaaaaaaa__list_resources');
      expect(names).toContain('mcp_aaaaaaaa__read_resource');
    });

    it('emits prompt meta tools when server reports prompts capability', async () => {
      mcpClient.connect.mockResolvedValue(
        makeSession({
          capabilities: { tools: {}, prompts: {} },
        }),
      );
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: integration.id }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      const names = tools.map((t) => t.name);
      expect(names).toContain('mcp_aaaaaaaa__list_prompts');
      expect(names).toContain('mcp_aaaaaaaa__get_prompt');
    });

    it('omits resource meta tools when includeResources is false', async () => {
      mcpClient.connect.mockResolvedValue(
        makeSession({
          capabilities: { tools: {}, resources: {} },
        }),
      );
      const tools = await provider.buildTools({
        config: {
          mcpServers: [
            { integrationId: integration.id, includeResources: false },
          ],
        },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(
        tools.find((t) => t.name.endsWith('__read_resource')),
      ).toBeUndefined();
    });

    it('omits prompt meta tools when includePrompts is false', async () => {
      mcpClient.connect.mockResolvedValue(
        makeSession({
          capabilities: { tools: {}, prompts: {} },
        }),
      );
      const tools = await provider.buildTools({
        config: {
          mcpServers: [
            { integrationId: integration.id, includePrompts: false },
          ],
        },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(
        tools.find((t) => t.name.endsWith('__get_prompt')),
      ).toBeUndefined();
    });
  });

  describe('buildTools — error isolation', () => {
    it('one server failing does not affect another', async () => {
      const okIntegration = makeIntegration({
        id: 'aaaa1111-bbbb-cccc-dddd-eeeeeeeeeeee',
      });
      const badIntegration = makeIntegration({
        id: 'ffff2222-bbbb-cccc-dddd-eeeeeeeeeeee',
      });
      integrations.getForExecution
        .mockResolvedValueOnce(okIntegration)
        .mockResolvedValueOnce(badIntegration);
      mcpClient.connect
        .mockResolvedValueOnce(makeSession())
        .mockRejectedValueOnce(new Error('connect refused'));

      const tools = await provider.buildTools({
        config: {
          mcpServers: [
            { integrationId: okIntegration.id },
            { integrationId: badIntegration.id },
          ],
        },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });

      // Only the okIntegration's tools come through.
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every((t) => t.name.startsWith('mcp_aaaa1111__'))).toBe(
        true,
      );
    });

    it('skips servers whose Integration cannot be found', async () => {
      integrations.getForExecution.mockRejectedValueOnce(
        new Error('integration not found'),
      );
      const tools = await provider.buildTools({
        config: {
          mcpServers: [{ integrationId: 'missing' }],
        },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(tools).toEqual([]);
      expect(mcpClient.connect).not.toHaveBeenCalled();
    });

    it('skips servers whose serviceType is not "mcp"', async () => {
      integrations.getForExecution.mockResolvedValue(
        makeIntegration({ serviceType: 'http' }),
      );
      const tools = await provider.buildTools({
        config: {
          mcpServers: [{ integrationId: 'wrong-type' }],
        },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(tools).toEqual([]);
      expect(mcpClient.connect).not.toHaveBeenCalled();
    });
  });

  describe('execute', () => {
    const integration = makeIntegration();

    beforeEach(() => {
      integrations.getForExecution.mockResolvedValue(integration);
    });

    it('calls the cached session and serializes content as JSON', async () => {
      const session = makeSession();
      mcpClient.connect.mockResolvedValue(session);
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: integration.id }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });

      const result = await provider.execute(
        {
          id: 'tc-1',
          name: 'mcp_aaaaaaaa__echo',
          arguments: JSON.stringify({ msg: 'hi' }),
        },
        {
          config: { mcpServers: [{ integrationId: integration.id }] },
          workspaceId: 'ws-1',
          executionId: 'exec-1',
        },
      );

      expect(session.callTool).toHaveBeenCalledWith({
        name: 'echo',
        arguments: { msg: 'hi' },
      });
      expect(result.toolCallId).toBe('tc-1');
      const parsed = JSON.parse(result.content);
      expect(parsed.content).toEqual([{ type: 'text', text: 'hello' }]);
    });

    it('returns an error tool_result when callTool throws', async () => {
      mcpClient.connect.mockResolvedValue(
        makeSession({
          callTool: jest.fn().mockRejectedValue(new Error('upstream 500')),
        }),
      );
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: integration.id }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      const result = await provider.execute(
        {
          id: 'tc-1',
          name: 'mcp_aaaaaaaa__echo',
          arguments: '{}',
        },
        {
          config: { mcpServers: [{ integrationId: integration.id }] },
          workspaceId: 'ws-1',
          executionId: 'exec-1',
        },
      );
      const parsed = JSON.parse(result.content);
      expect(parsed.error).toBe('MCP_CALL_FAILED');
      // Generic message — the SDK error ('upstream 500') must NOT leak.
      expect(parsed.message).not.toContain('upstream 500');
    });

    it('returns INVALID_TOOL_ARGUMENTS for non-JSON arguments', async () => {
      mcpClient.connect.mockResolvedValue(makeSession());
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: integration.id }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      const result = await provider.execute(
        {
          id: 'tc-1',
          name: 'mcp_aaaaaaaa__echo',
          arguments: '{ not valid json',
        },
        {
          config: { mcpServers: [{ integrationId: integration.id }] },
          workspaceId: 'ws-1',
          executionId: 'exec-1',
        },
      );
      const parsed = JSON.parse(result.content);
      expect(parsed.error).toBe('INVALID_TOOL_ARGUMENTS');
    });

    it('returns MCP_UNKNOWN_TOOL when the tool name does not map to a session', async () => {
      const result = await provider.execute(
        {
          id: 'tc-1',
          name: 'mcp_zzzzzzzz__echo',
          arguments: '{}',
        },
        {
          config: { mcpServers: [] },
          workspaceId: 'ws-1',
          executionId: 'exec-1',
        },
      );
      const parsed = JSON.parse(result.content);
      expect(parsed.error).toBe('MCP_UNKNOWN_TOOL');
    });

    it('truncates very large content payloads with marker', async () => {
      const giant = 'x'.repeat(200_000);
      mcpClient.connect.mockResolvedValue(
        makeSession({
          callTool: jest.fn().mockResolvedValue({
            content: [{ type: 'text', text: giant }],
          }),
        }),
      );
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: integration.id }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      const result = await provider.execute(
        {
          id: 'tc-1',
          name: 'mcp_aaaaaaaa__echo',
          arguments: '{}',
        },
        {
          config: { mcpServers: [{ integrationId: integration.id }] },
          workspaceId: 'ws-1',
          executionId: 'exec-1',
        },
      );
      // The serialized content carries an explicit truncation marker so the
      // LLM can adapt rather than seeing a silently-cut response.
      expect(result.content).toContain('MCP_RESPONSE_TOO_LARGE');
      expect(result.content.length).toBeLessThan(giant.length);
    });

    describe('meta tools', () => {
      beforeEach(async () => {
        mcpClient.connect.mockResolvedValue(
          makeSession({
            capabilities: { tools: {}, resources: {}, prompts: {} },
            listResources: jest.fn().mockResolvedValue({
              resources: [{ uri: 'file://a.txt', name: 'a.txt' }],
            }),
            readResource: jest.fn().mockResolvedValue({
              contents: [{ uri: 'file://a.txt', text: 'hello' }],
            }),
            listPrompts: jest
              .fn()
              .mockResolvedValue({ prompts: [{ name: 'greet' }] }),
            getPrompt: jest.fn().mockResolvedValue({
              messages: [{ role: 'user', content: 'hi' }],
            }),
          }),
        );
        await provider.buildTools({
          config: { mcpServers: [{ integrationId: integration.id }] },
          workspaceId: 'ws-1',
          executionId: 'exec-1',
        });
      });

      it('list_resources forwards to session.listResources', async () => {
        const result = await provider.execute(
          {
            id: 'tc-1',
            name: 'mcp_aaaaaaaa__list_resources',
            arguments: '{}',
          },
          {
            config: { mcpServers: [{ integrationId: integration.id }] },
            workspaceId: 'ws-1',
            executionId: 'exec-1',
          },
        );
        const parsed = JSON.parse(result.content);
        expect(parsed.resources[0].uri).toBe('file://a.txt');
      });

      it('read_resource requires uri argument', async () => {
        const result = await provider.execute(
          {
            id: 'tc-1',
            name: 'mcp_aaaaaaaa__read_resource',
            arguments: '{}',
          },
          {
            config: { mcpServers: [{ integrationId: integration.id }] },
            workspaceId: 'ws-1',
            executionId: 'exec-1',
          },
        );
        const parsed = JSON.parse(result.content);
        expect(parsed.error).toBe('INVALID_TOOL_ARGUMENTS');
      });

      it('get_prompt requires name argument', async () => {
        const result = await provider.execute(
          {
            id: 'tc-1',
            name: 'mcp_aaaaaaaa__get_prompt',
            arguments: '{}',
          },
          {
            config: { mcpServers: [{ integrationId: integration.id }] },
            workspaceId: 'ws-1',
            executionId: 'exec-1',
          },
        );
        const parsed = JSON.parse(result.content);
        expect(parsed.error).toBe('INVALID_TOOL_ARGUMENTS');
      });
    });
  });

  describe('cleanup', () => {
    const integration = makeIntegration();

    it('closes sessions for the given executionId', async () => {
      const session1 = makeSession();
      mcpClient.connect.mockResolvedValueOnce(session1);
      integrations.getForExecution.mockResolvedValue(integration);

      await provider.buildTools({
        config: { mcpServers: [{ integrationId: integration.id }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });

      await provider.cleanup({ executionId: 'exec-1' });
      expect(session1.close).toHaveBeenCalledTimes(1);

      // Subsequent buildTools with the same executionId reconnects (cache cleared).
      const session2 = makeSession();
      mcpClient.connect.mockResolvedValueOnce(session2);
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: integration.id }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(mcpClient.connect).toHaveBeenCalledTimes(2);
    });

    it('does not close sessions belonging to a different executionId', async () => {
      const sessionA = makeSession();
      const sessionB = makeSession();
      mcpClient.connect
        .mockResolvedValueOnce(sessionA)
        .mockResolvedValueOnce(sessionB);
      integrations.getForExecution.mockResolvedValue(integration);

      await provider.buildTools({
        config: { mcpServers: [{ integrationId: integration.id }] },
        workspaceId: 'ws-1',
        executionId: 'exec-A',
      });
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: integration.id }] },
        workspaceId: 'ws-1',
        executionId: 'exec-B',
      });

      await provider.cleanup({ executionId: 'exec-A' });
      expect(sessionA.close).toHaveBeenCalledTimes(1);
      expect(sessionB.close).not.toHaveBeenCalled();
    });

    it('is idempotent — second cleanup does not re-close', async () => {
      const session = makeSession();
      mcpClient.connect.mockResolvedValueOnce(session);
      integrations.getForExecution.mockResolvedValue(integration);

      await provider.buildTools({
        config: { mcpServers: [{ integrationId: integration.id }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });

      await provider.cleanup({ executionId: 'exec-1' });
      await provider.cleanup({ executionId: 'exec-1' });
      expect(session.close).toHaveBeenCalledTimes(1);
    });

    it('swallows close failures', async () => {
      mcpClient.connect.mockResolvedValueOnce(
        makeSession({
          close: jest.fn().mockRejectedValue(new Error('boom')),
        }),
      );
      integrations.getForExecution.mockResolvedValue(integration);
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: integration.id }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      // cleanup() must NOT throw — close failures are best-effort.
      await expect(
        provider.cleanup({ executionId: 'exec-1' }),
      ).resolves.toBeUndefined();
    });
  });
});
