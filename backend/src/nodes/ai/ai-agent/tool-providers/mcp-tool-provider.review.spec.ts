/**
 * Coverage for issues raised in review/2026-05-04_13-56-08:
 * - Critical: SSRF guard, authType fallthrough
 * - Warning: connect/list timeout, executionId required, SID collision,
 *   isError handling, sanitize-name collision, integration.status check,
 *   meta success paths, cleanup on listTools failure, race in materialize
 *
 * Kept in a separate file from `mcp-tool-provider.spec.ts` so the original
 * spec stays focused on the happy-path behavior it was originally written
 * to verify.
 */

import { McpToolProvider } from './mcp-tool-provider';
import type {
  McpClientService,
  McpSession,
} from '../../../../modules/mcp/mcp-client.service';
import type { IntegrationsService } from '../../../../modules/integrations/integrations.service';
import type { Integration } from '../../../../modules/integrations/entities/integration.entity';

const SAMPLE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeIntegration(o: Partial<Integration> = {}): Integration {
  return {
    id: SAMPLE_ID,
    workspaceId: 'ws-1',
    serviceType: 'mcp',
    name: 'Demo MCP',
    authType: 'bearer_token',
    credentials: { url: 'https://mcp.example.com', token: 'tok' },
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
    ...o,
  } as Integration;
}

function makeSession(o: Partial<McpSession> = {}): McpSession {
  return {
    capabilities: { tools: {} },
    serverInfo: { name: 's', version: '1.0.0' },
    listTools: jest.fn().mockResolvedValue({
      tools: [
        {
          name: 'echo',
          description: 'Echo',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    }),
    callTool: jest.fn().mockResolvedValue({ content: [] }),
    listResources: jest.fn().mockResolvedValue({ resources: [] }),
    readResource: jest.fn().mockResolvedValue({ contents: [] }),
    listPrompts: jest.fn().mockResolvedValue({ prompts: [] }),
    getPrompt: jest.fn().mockResolvedValue({ messages: [] }),
    close: jest.fn().mockResolvedValue(undefined),
    ...o,
  } as McpSession;
}

describe('McpToolProvider — review issues', () => {
  let mcpClient: { connect: jest.Mock<Promise<McpSession>, [unknown]> };
  let integrations: {
    getForExecution: jest.Mock<Promise<Integration>, [string, string]>;
  };
  let provider: McpToolProvider;

  beforeEach(() => {
    jest.useRealTimers();
    mcpClient = { connect: jest.fn() };
    integrations = { getForExecution: jest.fn() };
    provider = new McpToolProvider(
      mcpClient as unknown as McpClientService,
      integrations as unknown as IntegrationsService,
    );
  });

  // -------------------------------------------------------------------
  // CRITICAL — authType fallthrough
  // -------------------------------------------------------------------

  describe('toConnectParams (via openServer) — auth_type validation', () => {
    it('rejects unknown authType instead of falling back to none', async () => {
      integrations.getForExecution.mockResolvedValue(
        makeIntegration({
          authType: 'oauth2', // not in SUPPORTED_AUTH_TYPES
          credentials: { url: 'https://mcp.example.com' },
        }),
      );
      mcpClient.connect.mockResolvedValue(makeSession());

      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SAMPLE_ID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      // openServer threw before connect, so no tools surfaced AND mcpClient
      // was never asked to connect with an unknown authType.
      expect(tools).toEqual([]);
      expect(mcpClient.connect).not.toHaveBeenCalled();
    });

    it('connects with authType="api_key"', async () => {
      integrations.getForExecution.mockResolvedValue(
        makeIntegration({
          authType: 'api_key',
          credentials: {
            url: 'https://mcp.example.com',
            header_name: 'X-Api-Key',
            value: 'k',
          },
        }),
      );
      mcpClient.connect.mockResolvedValue(makeSession());
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: SAMPLE_ID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(mcpClient.connect).toHaveBeenCalledWith({
        authType: 'api_key',
        url: 'https://mcp.example.com',
        headerName: 'X-Api-Key',
        value: 'k',
        defaultHeaders: undefined,
      });
    });

    it('connects with authType="none"', async () => {
      integrations.getForExecution.mockResolvedValue(
        makeIntegration({
          authType: 'none',
          credentials: { url: 'https://mcp.example.com' },
        }),
      );
      mcpClient.connect.mockResolvedValue(makeSession());
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: SAMPLE_ID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(mcpClient.connect).toHaveBeenCalledWith({
        authType: 'none',
        url: 'https://mcp.example.com',
        defaultHeaders: undefined,
      });
    });

    it('rejects bearer_token with missing token', async () => {
      integrations.getForExecution.mockResolvedValue(
        makeIntegration({
          authType: 'bearer_token',
          credentials: { url: 'https://mcp.example.com' },
        }),
      );
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SAMPLE_ID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(tools).toEqual([]);
      expect(mcpClient.connect).not.toHaveBeenCalled();
    });

    it('rejects api_key with missing header_name', async () => {
      integrations.getForExecution.mockResolvedValue(
        makeIntegration({
          authType: 'api_key',
          credentials: { url: 'https://mcp.example.com', value: 'k' },
        }),
      );
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SAMPLE_ID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(tools).toEqual([]);
      expect(mcpClient.connect).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------
  // CRITICAL — URL validation defense in depth
  // -------------------------------------------------------------------

  describe('toConnectParams — URL validation', () => {
    it('rejects non-HTTPS URLs at the provider boundary', async () => {
      integrations.getForExecution.mockResolvedValue(
        makeIntegration({
          credentials: { url: 'http://insecure.example.com', token: 't' },
        }),
      );
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SAMPLE_ID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(tools).toEqual([]);
      expect(mcpClient.connect).not.toHaveBeenCalled();
    });

    it('rejects missing URL', async () => {
      integrations.getForExecution.mockResolvedValue(
        makeIntegration({ credentials: { token: 't' } }),
      );
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SAMPLE_ID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(tools).toEqual([]);
      expect(mcpClient.connect).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------
  // WARNING — Integration.status sanity check
  // -------------------------------------------------------------------

  it('skips integrations whose status is not "connected"', async () => {
    integrations.getForExecution.mockResolvedValue(
      makeIntegration({ status: 'expired' }),
    );
    const tools = await provider.buildTools({
      config: { mcpServers: [{ integrationId: SAMPLE_ID }] },
      workspaceId: 'ws-1',
      executionId: 'exec-1',
    });
    expect(tools).toEqual([]);
  });

  // -------------------------------------------------------------------
  // WARNING — executionId required
  // -------------------------------------------------------------------

  describe('executionId requirement', () => {
    it('returns [] from buildTools when executionId is missing', async () => {
      integrations.getForExecution.mockResolvedValue(makeIntegration());
      mcpClient.connect.mockResolvedValue(makeSession());
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SAMPLE_ID }] },
        workspaceId: 'ws-1',
      });
      expect(tools).toEqual([]);
      expect(mcpClient.connect).not.toHaveBeenCalled();
    });

    it('execute without executionId returns MCP_UNKNOWN_TOOL', async () => {
      const result = await provider.execute(
        { id: 'tc-1', name: 'mcp_aaaaaaaa__echo', arguments: '{}' },
        { config: {}, workspaceId: 'ws-1' },
      );
      const parsed = JSON.parse(result.content);
      expect(parsed.error).toBe('MCP_UNKNOWN_TOOL');
    });

    it('cleanup with undefined executionId is a no-op (no global wipe)', async () => {
      const session = makeSession();
      mcpClient.connect.mockResolvedValueOnce(session);
      integrations.getForExecution.mockResolvedValueOnce(makeIntegration());

      await provider.buildTools({
        config: { mcpServers: [{ integrationId: SAMPLE_ID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      await provider.cleanup({}); // no executionId
      expect(session.close).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------
  // WARNING — connect timeout
  // -------------------------------------------------------------------

  it('connect timeout produces a MCP server build failure (no orphan session)', async () => {
    jest.useFakeTimers();
    integrations.getForExecution.mockResolvedValue(makeIntegration());
    // Connect never resolves — withTimeout should reject after CONNECT_TIMEOUT_MS.
    mcpClient.connect.mockImplementationOnce(
      () => new Promise<McpSession>(() => undefined),
    );
    const buildPromise = provider.buildTools({
      config: { mcpServers: [{ integrationId: SAMPLE_ID }] },
      workspaceId: 'ws-1',
      executionId: 'exec-1',
    });
    // Fast-forward past the 10s default connect timeout.
    await jest.advanceTimersByTimeAsync(11_000);
    const tools = await buildPromise;
    expect(tools).toEqual([]);
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------
  // WARNING — listTools failure closes the session (no orphan SSE stream)
  // -------------------------------------------------------------------

  it('closes the open session if listTools throws after connect succeeds', async () => {
    integrations.getForExecution.mockResolvedValue(makeIntegration());
    const session = makeSession({
      listTools: jest.fn().mockRejectedValue(new Error('list failed')),
    });
    mcpClient.connect.mockResolvedValueOnce(session);

    const tools = await provider.buildTools({
      config: { mcpServers: [{ integrationId: SAMPLE_ID }] },
      workspaceId: 'ws-1',
      executionId: 'exec-1',
    });
    expect(tools).toEqual([]);
    expect(session.close).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------
  // WARNING — TOCTOU race on materializeServer
  // -------------------------------------------------------------------

  it('concurrent buildTools for the same (executionId, integrationId) opens one session', async () => {
    integrations.getForExecution.mockResolvedValue(makeIntegration());
    let resolveConnect!: (s: McpSession) => void;
    const session = makeSession();
    mcpClient.connect.mockImplementationOnce(
      () =>
        new Promise<McpSession>((r) => {
          resolveConnect = r;
        }),
    );

    const config = { mcpServers: [{ integrationId: SAMPLE_ID }] };
    const ctx = { config, workspaceId: 'ws-1', executionId: 'exec-race' };
    const p1 = provider.buildTools(ctx);
    const p2 = provider.buildTools(ctx);

    // Drain pending microtasks so both buildTools have reached the in-flight
    // cache lookup (which is what we're testing the dedup of).
    await new Promise((r) => setImmediate(r));

    resolveConnect(session);
    await Promise.all([p1, p2]);
    expect(mcpClient.connect).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------
  // WARNING — SID collision handling
  // -------------------------------------------------------------------

  it('extends sid length when two integrations share the first 8 chars', async () => {
    // Two different integrations whose UUIDs collide in the first 8 hex chars
    // (after stripping dashes) but diverge by char 9. The provider must
    // produce distinct mcp_<sid> names so execute() routes correctly.
    const idA = 'aaaaaaaa-bbbb-1111-1111-111111111111';
    const idB = 'aaaaaaaa-cccc-2222-2222-222222222222';
    const integrationA = makeIntegration({
      id: idA,
      name: 'Server A',
    });
    const integrationB = makeIntegration({
      id: idB,
      name: 'Server B',
      credentials: { url: 'https://b.example.com', token: 'tb' },
    });
    integrations.getForExecution.mockImplementation((id: string) =>
      Promise.resolve(id === idA ? integrationA : integrationB),
    );
    const sessionA = makeSession();
    const sessionB = makeSession({
      listTools: jest.fn().mockResolvedValue({
        tools: [
          {
            name: 'echo',
            description: 'Echo (B)',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      }),
    });
    mcpClient.connect
      .mockResolvedValueOnce(sessionA)
      .mockResolvedValueOnce(sessionB);

    const tools = await provider.buildTools({
      config: {
        mcpServers: [{ integrationId: idA }, { integrationId: idB }],
      },
      workspaceId: 'ws-1',
      executionId: 'exec-1',
    });

    const names = tools.map((t) => t.name);
    // Both servers expose echo; their full mcp tool names must differ.
    expect(names.length).toBe(2);
    expect(new Set(names).size).toBe(2);
    // The shared 8-char prefix forces a 12-char sid for at least one.
    const longerSidUsed = names.some((n) => /^mcp_[a-z0-9]{12}__/.test(n));
    expect(longerSidUsed).toBe(true);
  });

  // -------------------------------------------------------------------
  // WARNING — sanitize collision warning (best-effort)
  // -------------------------------------------------------------------

  it('keeps the first tool when two upstream names sanitize to the same string', async () => {
    integrations.getForExecution.mockResolvedValue(makeIntegration());
    mcpClient.connect.mockResolvedValueOnce(
      makeSession({
        listTools: jest.fn().mockResolvedValue({
          tools: [
            {
              name: 'foo.bar',
              description: 'A',
              inputSchema: { type: 'object', properties: {} },
            },
            {
              name: 'foo_bar',
              description: 'B',
              inputSchema: { type: 'object', properties: {} },
            },
          ],
        }),
      }),
    );

    const tools = await provider.buildTools({
      config: { mcpServers: [{ integrationId: SAMPLE_ID }] },
      workspaceId: 'ws-1',
      executionId: 'exec-1',
    });
    expect(tools).toHaveLength(1);
    expect(tools[0].description).toContain('A');
  });

  // -------------------------------------------------------------------
  // WARNING — isError handling on callTool
  // -------------------------------------------------------------------

  it('marks isError=true responses as MCP_TOOL_ERROR', async () => {
    integrations.getForExecution.mockResolvedValue(makeIntegration());
    mcpClient.connect.mockResolvedValueOnce(
      makeSession({
        callTool: jest.fn().mockResolvedValue({
          isError: true,
          content: [{ type: 'text', text: 'tool failed internally' }],
        }),
      }),
    );
    await provider.buildTools({
      config: { mcpServers: [{ integrationId: SAMPLE_ID }] },
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
        config: { mcpServers: [{ integrationId: SAMPLE_ID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      },
    );
    const parsed = JSON.parse(result.content);
    expect(parsed.error).toBe('MCP_TOOL_ERROR');
    expect(parsed.content[0].text).toBe('tool failed internally');
  });

  // -------------------------------------------------------------------
  // WARNING — meta tool happy paths (read_resource, list_prompts, get_prompt)
  // -------------------------------------------------------------------

  describe('meta tool success paths', () => {
    beforeEach(async () => {
      integrations.getForExecution.mockResolvedValue(makeIntegration());
      mcpClient.connect.mockResolvedValueOnce(
        makeSession({
          capabilities: { tools: {}, resources: {}, prompts: {} },
          listResources: jest.fn().mockResolvedValue({
            resources: [{ uri: 'file://a', name: 'a' }],
          }),
          readResource: jest.fn().mockResolvedValue({
            contents: [{ uri: 'file://a', text: 'body' }],
          }),
          listPrompts: jest.fn().mockResolvedValue({
            prompts: [{ name: 'p1' }],
          }),
          getPrompt: jest.fn().mockResolvedValue({
            messages: [{ role: 'user', content: 'hi' }],
          }),
        }),
      );
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: SAMPLE_ID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
    });

    it('read_resource returns contents', async () => {
      const res = await provider.execute(
        {
          id: 'tc-1',
          name: 'mcp_aaaaaaaa__read_resource',
          arguments: JSON.stringify({ uri: 'file://a' }),
        },
        {
          config: { mcpServers: [{ integrationId: SAMPLE_ID }] },
          workspaceId: 'ws-1',
          executionId: 'exec-1',
        },
      );
      const parsed = JSON.parse(res.content);
      expect(parsed.contents[0].uri).toBe('file://a');
    });

    it('list_prompts returns prompt list', async () => {
      const res = await provider.execute(
        {
          id: 'tc-1',
          name: 'mcp_aaaaaaaa__list_prompts',
          arguments: '{}',
        },
        {
          config: { mcpServers: [{ integrationId: SAMPLE_ID }] },
          workspaceId: 'ws-1',
          executionId: 'exec-1',
        },
      );
      const parsed = JSON.parse(res.content);
      expect(parsed.prompts[0].name).toBe('p1');
    });

    it('get_prompt returns messages', async () => {
      const res = await provider.execute(
        {
          id: 'tc-1',
          name: 'mcp_aaaaaaaa__get_prompt',
          arguments: JSON.stringify({ name: 'p1' }),
        },
        {
          config: { mcpServers: [{ integrationId: SAMPLE_ID }] },
          workspaceId: 'ws-1',
          executionId: 'exec-1',
        },
      );
      const parsed = JSON.parse(res.content);
      expect(parsed.messages[0].content).toBe('hi');
    });
  });

  // -------------------------------------------------------------------
  // WARNING — description sanitization (newlines stripped, length capped)
  // -------------------------------------------------------------------

  it('strips newlines from integration name and tool description', async () => {
    integrations.getForExecution.mockResolvedValue(
      makeIntegration({
        name: 'Server\nWith\rEvil',
      }),
    );
    mcpClient.connect.mockResolvedValueOnce(
      makeSession({
        listTools: jest.fn().mockResolvedValue({
          tools: [
            {
              name: 'echo',
              description: 'Line1\nLine2',
              inputSchema: { type: 'object', properties: {} },
            },
          ],
        }),
      }),
    );
    const tools = await provider.buildTools({
      config: { mcpServers: [{ integrationId: SAMPLE_ID }] },
      workspaceId: 'ws-1',
      executionId: 'exec-1',
    });
    expect(tools[0].description).not.toContain('\n');
    expect(tools[0].description).not.toContain('\r');
  });
});
