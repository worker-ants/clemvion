import {
  MakeshopMcpToolProvider,
  buildToolDescription,
  constraintToSuffixLine,
  sanitizeOperationId,
} from './makeshop-mcp-tool-provider';
import type {
  MakeshopFieldConstraint,
  MakeshopOperationMetadata,
} from '../../../integration/makeshop/metadata/index';
import {
  MakeshopApiClient,
  MakeshopAuthFailedError,
  MakeshopRateLimitedError,
  MakeshopTransportFailedError,
} from '../../../integration/makeshop/makeshop-api.client';
import { listAllMakeshopOperations } from '../../../integration/makeshop/metadata/index';
import type { Integration } from '../../../../modules/integrations/entities/integration.entity';
import type { ToolCall } from '../../../../modules/llm/interfaces/llm-client.interface';

type Mock = jest.Mock;

function makeIntegration(overrides: Partial<Integration> = {}): Integration {
  return {
    id: 'abcdef1234567890',
    workspaceId: 'ws-1',
    serviceType: 'makeshop',
    name: 'My MakeShop',
    authType: 'oauth2',
    credentials: {
      shop_uid: 'myshop',
      client_id: 'cid',
      client_secret: 'csec',
      access_token: 't',
      refresh_token: 'r',
    },
    scope: 'personal',
    status: 'connected',
    statusReason: null,
    tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    ...overrides,
  } as Integration;
}

function makeCall(name: string, args: Record<string, unknown> = {}): ToolCall {
  return {
    id: 'call-1',
    name,
    arguments: JSON.stringify(args),
  };
}

const SID = 'abcdef1234567890';

// `get-product` (product) — GET, requiredFields [], used as the canonical
// success witness. Its api.label must use the BARE operationId (`get-product`).
const GET_PRODUCT_API = {
  label: 'makeshop.product.get-product',
  method: 'GET',
  path: expect.any(String),
} as const;

describe('MakeshopMcpToolProvider', () => {
  let integrationsService: { getForExecution: Mock; logUsage: Mock };
  let apiClient: { call: Mock; refreshTokenViaQueue: Mock };
  let provider: MakeshopMcpToolProvider;

  beforeEach(() => {
    integrationsService = {
      getForExecution: jest.fn(),
      logUsage: jest.fn().mockResolvedValue(undefined),
    };
    apiClient = {
      call: jest.fn(),
      refreshTokenViaQueue: jest.fn().mockResolvedValue(undefined),
    };
    provider = new MakeshopMcpToolProvider(
      integrationsService as never,
      apiClient as unknown as MakeshopApiClient,
    );
  });

  describe('buildTools', () => {
    it('emits one ToolDef per makeshop operation with sanitized (hyphen→underscore) names', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());

      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });

      const allOps = listAllMakeshopOperations();
      // One tool per catalog operation (no scope pre-filter, no metatools).
      expect(tools.length).toBe(allOps.length);
      for (const t of tools) {
        expect(t.name.startsWith(`mcp_${SID}__`)).toBe(true);
        // Tool names contain no hyphens — sanitize already applied.
        const token = t.name.slice(`mcp_${SID}__`.length);
        expect(token).not.toContain('-');
        expect(token).toMatch(/^[a-zA-Z0-9_]+$/);
      }
      // `get-product` bare id → `get_product` tool token.
      expect(tools.some((t) => t.name === `mcp_${SID}__get_product`)).toBe(
        true,
      );
      // matches() recognises the sid after buildTools.
      expect(provider.matches(`mcp_${SID}__get_product`)).toBe(true);
      // Foreign sids / non-mcp names do not match.
      expect(provider.matches('mcp_xxxxxxxx__whatever')).toBe(false);
      expect(provider.matches('kb_anything')).toBe(false);
    });

    it('tool token uniqueness within the catalog (sanitize collision guard)', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      const names = tools.map((t) => t.name);
      // No duplicate tool names emitted — confirms the sanitized tokens stay
      // unique across the whole catalog (spec §8.1 metadata guarantee).
      expect(new Set(names).size).toBe(names.length);
    });

    it('emits tools-only capability (no resources/prompts metatools)', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      const names = tools.map((t) => t.name);
      expect(names).not.toContain(`mcp_${SID}__list_resources`);
      expect(names).not.toContain(`mcp_${SID}__read_resource`);
      expect(names).not.toContain(`mcp_${SID}__list_prompts`);
      expect(names).not.toContain(`mcp_${SID}__get_prompt`);
    });

    it('descriptions carry no KST timezone suffix and no ⚠ approval label', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      for (const t of tools) {
        // makeshop must NOT invent the cafe24 KST suffix (spec §4.1).
        expect(t.description).not.toContain(
          'All date/time parameters and response fields use KST',
        );
        // No provider-added restricted-approval label (spec §8.2 / §9.5).
        // NOTE: a ⚠ glyph may legitimately appear inside a MakeShop catalog
        // operation's own source description text — we assert the provider
        // does not APPEND an approval-tier suffix line, not that the source
        // text is glyph-free.
        expect(t.description).not.toContain('Restricted operation');
        expect(t.description).not.toContain('partner approval');
        // Wire-format hint uses "MakeShop", not "Cafe24".
        expect(t.description).toContain('via Internal Bridge:');
      }
      const getProduct = tools.find(
        (t) => t.name === `mcp_${SID}__get_product`,
      );
      expect(getProduct).toBeDefined();
      expect(getProduct!.description).toContain('(MakeShop GET product —');
    });

    it('applies enabledTools allowlist (bare operation ids with hyphens)', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      const tools = await provider.buildTools({
        config: {
          mcpServers: [
            {
              integrationId: SID,
              // Allowlist uses the BARE operationId (hyphenated), spec §8.3.
              enabledTools: ['get-product', 'get-board'],
            },
          ],
        },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      const names = tools.map((t) => t.name);
      // Exactly the two allowlisted operations, sanitized.
      expect(names.sort()).toEqual(
        [`mcp_${SID}__get_product`, `mcp_${SID}__get_board`].sort(),
      );
    });

    it('skips non-makeshop integrations (defers to other providers)', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({ serviceType: 'mcp' }),
      );
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(tools).toEqual([]);
      expect(provider.matches(`mcp_${SID}__get_product`)).toBe(false);
    });

    it('skips integrations in error status (no refresh attempt)', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({ status: 'error', statusReason: 'auth_failed' }),
      );
      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
        mcpDiagnostics: summaries,
      });
      expect(tools).toEqual([]);
      expect(apiClient.refreshTokenViaQueue).not.toHaveBeenCalled();
      expect(summaries).toEqual([
        expect.objectContaining({
          serviceType: 'makeshop',
          status: 'skipped',
          skipReason: 'error',
        }),
      ]);
    });

    it('skips pending_install integrations', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({ status: 'pending_install' }),
      );
      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
        mcpDiagnostics: summaries,
      });
      expect(tools).toEqual([]);
      expect(summaries).toEqual([
        expect.objectContaining({
          status: 'skipped',
          skipReason: 'pending_install',
        }),
      ]);
    });

    it('skips expired + install_timeout (refresh impossible)', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({
          status: 'expired',
          statusReason: 'install_timeout',
          credentials: { shop_uid: 'myshop' },
        }),
      );
      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
        mcpDiagnostics: summaries,
      });
      expect(tools).toEqual([]);
      expect(apiClient.refreshTokenViaQueue).not.toHaveBeenCalled();
      expect(summaries).toEqual([
        expect.objectContaining({
          status: 'skipped',
          skipReason: 'expired_install_timeout',
        }),
      ]);
    });

    it('skips expired + no refresh_token', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({
          status: 'expired',
          credentials: { shop_uid: 'myshop', access_token: 't' },
        }),
      );
      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
        mcpDiagnostics: summaries,
      });
      expect(tools).toEqual([]);
      expect(apiClient.refreshTokenViaQueue).not.toHaveBeenCalled();
      expect(summaries).toEqual([
        expect.objectContaining({
          status: 'skipped',
          skipReason: 'expired_no_refresh_token',
        }),
      ]);
    });

    // spec §8.6 — expired + refresh_token row attempts one queue refresh; on
    // worker flip to connected, tools are exposed from the fresh row.
    it('refreshes expired+refresh_token integration and includes tools when worker flips to connected', async () => {
      const expiredRow = makeIntegration({ status: 'expired' });
      const freshRow = makeIntegration({ status: 'connected' });
      integrationsService.getForExecution
        .mockResolvedValueOnce(expiredRow)
        .mockResolvedValueOnce(freshRow);
      apiClient.refreshTokenViaQueue.mockResolvedValue(undefined);

      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
        mcpDiagnostics: summaries,
      });

      expect(apiClient.refreshTokenViaQueue).toHaveBeenCalledWith(
        expiredRow,
        'background',
      );
      expect(tools.length).toBeGreaterThan(0);
      expect(summaries).toEqual([
        expect.objectContaining({
          status: 'connected',
          serviceType: 'makeshop',
        }),
      ]);
      expect(summaries[0].skipReason).toBeUndefined();
    });

    it('skips expired+refresh_token when refresh fails with auth_failed', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({ status: 'expired' }),
      );
      apiClient.refreshTokenViaQueue.mockRejectedValue(
        new MakeshopAuthFailedError(401, 'myshop', { error: 'invalid_grant' }),
      );

      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
        mcpDiagnostics: summaries,
      });
      expect(tools).toEqual([]);
      expect(apiClient.refreshTokenViaQueue).toHaveBeenCalledTimes(1);
      expect(summaries).toEqual([
        expect.objectContaining({
          status: 'skipped',
          skipReason: 'expired_refresh_failed',
        }),
      ]);
    });

    it('uses expired_refresh_failed for non-auth refresh errors (transport, etc.)', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({ status: 'expired' }),
      );
      apiClient.refreshTokenViaQueue.mockRejectedValue(new Error('ECONNRESET'));

      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
        mcpDiagnostics: summaries,
      });
      expect(tools).toEqual([]);
      expect(summaries).toEqual([
        expect.objectContaining({
          status: 'skipped',
          skipReason: 'expired_refresh_failed',
        }),
      ]);
    });

    it('skips expired+refresh_token when worker did not flip status to connected', async () => {
      const expiredRow = makeIntegration({ status: 'expired' });
      const stillErrorRow = makeIntegration({
        status: 'error',
        statusReason: 'auth_failed',
      });
      integrationsService.getForExecution
        .mockResolvedValueOnce(expiredRow)
        .mockResolvedValueOnce(stillErrorRow);
      apiClient.refreshTokenViaQueue.mockResolvedValue(undefined);

      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
        mcpDiagnostics: summaries,
      });
      expect(tools).toEqual([]);
      expect(summaries).toEqual([
        expect.objectContaining({
          status: 'skipped',
          skipReason: 'expired_refresh_failed',
        }),
      ]);
    });

    it('pushes lookup_failed when re-read after successful refresh fails', async () => {
      const expiredRow = makeIntegration({ status: 'expired' });
      integrationsService.getForExecution
        .mockResolvedValueOnce(expiredRow)
        .mockRejectedValueOnce(new Error('replica lag — row gone'));
      apiClient.refreshTokenViaQueue.mockResolvedValue(undefined);

      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
        mcpDiagnostics: summaries,
      });
      expect(tools).toEqual([]);
      expect(summaries).toEqual([
        expect.objectContaining({
          status: 'skipped',
          skipReason: 'lookup_failed',
        }),
      ]);
    });

    it('pushes connected summary with toolCount for a healthy integration', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
        mcpDiagnostics: summaries,
      });
      expect(summaries).toEqual([
        expect.objectContaining({
          integrationId: SID,
          serviceType: 'makeshop',
          status: 'connected',
        }),
      ]);
      expect(summaries[0].toolCount).toBeGreaterThan(0);
    });

    it('pushes lookup_failed when getForExecution throws', async () => {
      integrationsService.getForExecution.mockRejectedValue(
        new Error('Integration vanished'),
      );
      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
        mcpDiagnostics: summaries,
      });
      expect(tools).toEqual([]);
      expect(summaries).toEqual([
        expect.objectContaining({
          integrationId: SID,
          status: 'skipped',
          skipReason: 'lookup_failed',
        }),
      ]);
    });

    it('works without mcpDiagnostics array (backward compat)', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  describe('execute', () => {
    async function setup(): Promise<void> {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
    }

    it('dispatches to MakeshopApiClient with BARE operationId in api.label', async () => {
      await setup();
      apiClient.call.mockResolvedValue({
        status: 200,
        body: { products: [{ uid: 1 }] },
        headers: {},
        retries: 0,
      });

      const res = await provider.execute(
        makeCall(`mcp_${SID}__get_product`, { limit: '10' }),
        {
          config: {},
          workspaceId: 'ws-1',
          executionId: 'exec-1',
          nodeExecutionId: 'ne-1',
          workflowId: 'wf-1',
        },
      );

      expect(res.status ?? 'success').toBe('success');
      const parsed = JSON.parse(res.content);
      expect(parsed.status).toBe(200);
      expect(parsed.response).toEqual({ products: [{ uid: 1 }] });
      // Dispatched with the metadata method + path.
      expect(apiClient.call).toHaveBeenCalledWith(
        expect.objectContaining({ id: SID }),
        expect.objectContaining({ method: 'GET', path: 'product' }),
      );
      // UsageLog carries the makeshop catalog key (bare operationId).
      expect(integrationsService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          api: GET_PRODUCT_API,
        }),
      );
    });

    it('returns MAKESHOP_MISSING_FIELDS when a required field is absent', async () => {
      await setup();
      // get-board requires InquiryTimeFrom / InquiryTimeTo / BoardCode.
      const res = await provider.execute(
        makeCall(`mcp_${SID}__get_board`, {}),
        { config: {}, workspaceId: 'ws-1', executionId: 'exec-1' },
      );
      expect(res.status).toBe('error');
      expect(JSON.parse(res.content)).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'MAKESHOP_MISSING_FIELDS' }),
        }),
      );
      expect(apiClient.call).not.toHaveBeenCalled();
    });

    it('maps a >=400 API result to an error envelope and logs failed usage', async () => {
      await setup();
      apiClient.call.mockResolvedValue({
        status: 404,
        body: { error_message: 'not found' },
        headers: {},
        retries: 0,
      });
      const res = await provider.execute(
        makeCall(`mcp_${SID}__get_product`, {}),
        {
          config: {},
          workspaceId: 'ws-1',
          executionId: 'exec-1',
          nodeExecutionId: 'ne-1',
          workflowId: 'wf-1',
        },
      );
      expect(res.status).toBe('error');
      const parsed = JSON.parse(res.content);
      expect(parsed.status).toBe(404);
      expect(integrationsService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error: expect.objectContaining({ code: 'MAKESHOP_404' }),
          api: GET_PRODUCT_API,
        }),
      );
    });

    it('translates MakeshopAuthFailedError into MAKESHOP_AUTH_FAILED (§8.4 degrade path)', async () => {
      await setup();
      apiClient.call.mockRejectedValue(
        new MakeshopAuthFailedError(403, 'myshop', { error: 'Forbidden' }),
      );
      const res = await provider.execute(
        makeCall(`mcp_${SID}__get_product`, {}),
        {
          config: {},
          workspaceId: 'ws-1',
          executionId: 'exec-1',
          nodeExecutionId: 'ne-1',
          workflowId: 'wf-1',
        },
      );
      expect(res.status).toBe('error');
      const parsed = JSON.parse(res.content);
      expect(parsed.error.code).toBe('MAKESHOP_AUTH_FAILED');
      // Original MakeShop error body forwarded for LLM reasoning.
      expect(parsed.error.response).toEqual({ error: 'Forbidden' });
      expect(integrationsService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error: expect.objectContaining({ code: 'MAKESHOP_AUTH_FAILED' }),
          api: GET_PRODUCT_API,
        }),
      );
    });

    it('translates MakeshopRateLimitedError into MAKESHOP_RATE_LIMITED', async () => {
      await setup();
      apiClient.call.mockRejectedValue(
        new MakeshopRateLimitedError(2, 5, 'myshop'),
      );
      const res = await provider.execute(
        makeCall(`mcp_${SID}__get_product`, {}),
        {
          config: {},
          workspaceId: 'ws-1',
          executionId: 'exec-1',
          nodeExecutionId: 'ne-1',
          workflowId: 'wf-1',
        },
      );
      expect(res.status).toBe('error');
      expect(JSON.parse(res.content).error.code).toBe('MAKESHOP_RATE_LIMITED');
      expect(integrationsService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error: expect.objectContaining({ code: 'MAKESHOP_RATE_LIMITED' }),
          api: GET_PRODUCT_API,
        }),
      );
    });

    it('translates MakeshopTransportFailedError into MAKESHOP_TRANSPORT_FAILED', async () => {
      await setup();
      apiClient.call.mockRejectedValue(
        new MakeshopTransportFailedError(new Error('ECONNRESET')),
      );
      const res = await provider.execute(
        makeCall(`mcp_${SID}__get_product`, {}),
        {
          config: {},
          workspaceId: 'ws-1',
          executionId: 'exec-1',
          nodeExecutionId: 'ne-1',
          workflowId: 'wf-1',
        },
      );
      expect(res.status).toBe('error');
      expect(JSON.parse(res.content).error.code).toBe(
        'MAKESHOP_TRANSPORT_FAILED',
      );
      expect(integrationsService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error: expect.objectContaining({
            code: 'MAKESHOP_TRANSPORT_FAILED',
          }),
          api: GET_PRODUCT_API,
        }),
      );
    });

    it('returns MAKESHOP_MCP_NO_SESSION when buildTools was not called for this execution', async () => {
      const res = await provider.execute(
        makeCall(`mcp_${SID}__get_product`, {}),
        { config: {}, workspaceId: 'ws-1', executionId: 'other-exec' },
      );
      expect(res.status).toBe('error');
      expect(JSON.parse(res.content).error.code).toBe(
        'MAKESHOP_MCP_NO_SESSION',
      );
    });

    it('returns MAKESHOP_UNKNOWN_OPERATION for an unregistered tool token', async () => {
      await setup();
      const res = await provider.execute(
        makeCall(`mcp_${SID}__not_a_real_op`, {}),
        { config: {}, workspaceId: 'ws-1', executionId: 'exec-1' },
      );
      expect(res.status).toBe('error');
      expect(JSON.parse(res.content).error.code).toBe(
        'MAKESHOP_UNKNOWN_OPERATION',
      );
    });

    it('returns MAKESHOP_MCP_TOOL_ARGS_INVALID for non-JSON arguments', async () => {
      await setup();
      const res = await provider.execute(
        { id: 'c', name: `mcp_${SID}__get_product`, arguments: '{not json' },
        { config: {}, workspaceId: 'ws-1', executionId: 'exec-1' },
      );
      expect(res.status).toBe('error');
      expect(JSON.parse(res.content).error.code).toBe(
        'MAKESHOP_MCP_TOOL_ARGS_INVALID',
      );
    });
  });

  describe('cleanup', () => {
    it('removes execution state and releases sids', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(provider.matches(`mcp_${SID}__get_product`)).toBe(true);

      await provider.cleanup({ executionId: 'exec-1' });
      expect(provider.matches(`mcp_${SID}__get_product`)).toBe(false);
    });

    it('cleanup() without executionId is a no-op (other sessions stay alive)', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-A',
      });
      await provider.cleanup({});
      expect(provider.matches(`mcp_${SID}__get_product`)).toBe(true);
      provider.__resetForTesting();
      expect(provider.matches(`mcp_${SID}__get_product`)).toBe(false);
    });

    it('buildTools twice on same executionId then single cleanup releases sid to 0', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-multi',
      });
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-multi',
      });
      expect(provider.matches(`mcp_${SID}__get_product`)).toBe(true);
      await provider.cleanup({ executionId: 'exec-multi' });
      expect(provider.matches(`mcp_${SID}__get_product`)).toBe(false);
    });

    it('two executions on same Integration — first cleanup keeps sid alive for second', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-A',
      });
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: SID }] },
        workspaceId: 'ws-1',
        executionId: 'exec-B',
      });
      await provider.cleanup({ executionId: 'exec-A' });
      expect(provider.matches(`mcp_${SID}__get_product`)).toBe(true);
      await provider.cleanup({ executionId: 'exec-B' });
      expect(provider.matches(`mcp_${SID}__get_product`)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Pure helper unit tests.
// ---------------------------------------------------------------------------

describe('sanitizeOperationId', () => {
  it('replaces hyphens with underscores, keeps underscores', () => {
    expect(sanitizeOperationId('get-product')).toBe('get_product');
    expect(sanitizeOperationId('get-cart_free_config')).toBe(
      'get_cart_free_config',
    );
    expect(sanitizeOperationId('post-cart-create')).toBe('post_cart_create');
  });
});

describe('constraintToSuffixLine', () => {
  it('formats oneOf', () => {
    const c: MakeshopFieldConstraint = { kind: 'oneOf', fields: ['a', 'b'] };
    expect(constraintToSuffixLine(c)).toBe(
      'Constraint: at least one of a, b must be provided.',
    );
  });
  it('formats allOrNone', () => {
    const c: MakeshopFieldConstraint = {
      kind: 'allOrNone',
      fields: ['since', 'until'],
    };
    expect(constraintToSuffixLine(c)).toBe(
      'Constraint: since, until must be provided together (all or none).',
    );
  });
  it('formats implies', () => {
    const c: MakeshopFieldConstraint = {
      kind: 'implies',
      if: 'x',
      then: ['y'],
    };
    expect(constraintToSuffixLine(c)).toBe(
      'Constraint: when x is provided, y are also required.',
    );
  });
});

describe('buildToolDescription', () => {
  function stubOp(
    constraints?: MakeshopOperationMetadata['constraints'],
  ): MakeshopOperationMetadata {
    return {
      id: 'test-op',
      description: 'Stub description.',
      scopeType: 'read',
      method: 'GET',
      path: 'test/path',
      requiredFields: [],
      fields: {},
      constraints,
    };
  }

  it('assembles base → (MakeShop ...) with NO timezone suffix when no constraints', () => {
    const desc = buildToolDescription(stubOp(), 'MyShop');
    const parts = desc.split('\n\n');
    expect(parts[0]).toBe('Stub description.');
    expect(parts[1]).toBe(
      '(MakeShop GET test/path — via Internal Bridge: MyShop)',
    );
    // Exactly 2 parts — no KST timezone line appended.
    expect(parts).toHaveLength(2);
    expect(desc).not.toContain('KST');
  });

  it('inserts one Constraint line per constraint after the wire-format hint', () => {
    const desc = buildToolDescription(
      stubOp([
        { kind: 'oneOf', fields: ['a', 'b'] },
        { kind: 'allOrNone', fields: ['c', 'd'] },
      ]),
      'MyShop',
    );
    const parts = desc.split('\n\n');
    expect(parts).toHaveLength(4);
    expect(parts[2]).toBe('Constraint: at least one of a, b must be provided.');
    expect(parts[3]).toBe(
      'Constraint: c, d must be provided together (all or none).',
    );
  });
});
