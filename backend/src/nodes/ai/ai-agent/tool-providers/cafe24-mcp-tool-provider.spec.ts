import { Cafe24McpToolProvider } from './cafe24-mcp-tool-provider';
import {
  Cafe24ApiClient,
  Cafe24AuthFailedError,
  Cafe24RateLimitedError,
} from '../../../integration/cafe24/cafe24-api.client';
import {
  listAllCafe24Operations,
  scopeForOperation,
} from '../../../integration/cafe24/metadata/index';
import type { Integration } from '../../../../modules/integrations/entities/integration.entity';
import type { ToolCall } from '../../../../modules/llm/interfaces/llm-client.interface';

type Mock = jest.Mock;

// Union of every scope our metadata could possibly require. Default test
// integration starts with all-scopes so the legacy "emits one ToolDef per
// operation" assertions hold. Scope-filter tests override `credentials.scopes`
// explicitly.
const ALL_CAFE24_SCOPES: readonly string[] = Array.from(
  new Set(
    listAllCafe24Operations().map(({ resource, operation }) =>
      scopeForOperation(resource, operation),
    ),
  ),
);

function makeIntegration(overrides: Partial<Integration> = {}): Integration {
  return {
    id: 'abcdef1234567890',
    workspaceId: 'ws-1',
    serviceType: 'cafe24',
    name: 'My Cafe24',
    authType: 'oauth2',
    credentials: {
      mall_id: 'myshop',
      app_type: 'public',
      access_token: 't',
      refresh_token: 'r',
      scopes: [...ALL_CAFE24_SCOPES],
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

describe('Cafe24McpToolProvider', () => {
  let integrationsService: { getForExecution: Mock; logUsage: Mock };
  let apiClient: { call: Mock };
  let provider: Cafe24McpToolProvider;

  beforeEach(() => {
    integrationsService = {
      getForExecution: jest.fn(),
      logUsage: jest.fn().mockResolvedValue(undefined),
    };
    apiClient = { call: jest.fn() };
    provider = new Cafe24McpToolProvider(
      integrationsService as never,
      apiClient as unknown as Cafe24ApiClient,
    );
  });

  describe('buildTools', () => {
    it('emits one ToolDef per cafe24 operation with mcp_<sid>__<op_id> naming', async () => {
      const integration = makeIntegration();
      integrationsService.getForExecution.mockResolvedValue(integration);

      const tools = await provider.buildTools({
        config: {
          mcpServers: [{ integrationId: 'abcdef1234567890' }],
        },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });

      // The first 16 chars of the integration id, sanitised, are the sid.
      const sid = 'abcdef1234567890';
      expect(tools.length).toBeGreaterThan(0);
      for (const t of tools) {
        expect(t.name.startsWith(`mcp_${sid}__`)).toBe(true);
      }
      // After buildTools, matches() recognises the sid.
      expect(provider.matches(`mcp_${sid}__product_list`)).toBe(true);
      // Foreign sids do not match.
      expect(provider.matches('mcp_xxxxxxxx__whatever')).toBe(false);
      // Non-mcp names do not match.
      expect(provider.matches('kb_anything')).toBe(false);
    });

    it('applies enabledTools allowlist (bare operation ids)', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      const tools = await provider.buildTools({
        config: {
          mcpServers: [
            {
              integrationId: 'abcdef1234567890',
              enabledTools: ['product_list', 'product_get'],
            },
          ],
        },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      const names = tools.map((t) => t.name);
      expect(names).toEqual(
        expect.arrayContaining([
          'mcp_abcdef1234567890__product_list',
          'mcp_abcdef1234567890__product_get',
        ]),
      );
      // No other operations exposed.
      expect(
        names.every(
          (n) => n.endsWith('__product_list') || n.endsWith('__product_get'),
        ),
      ).toBe(true);
    });

    it('skips non-cafe24 integrations (defers to McpToolProvider)', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({ serviceType: 'mcp' }),
      );
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(tools).toEqual([]);
      expect(provider.matches('mcp_abcdef1234567890__product_list')).toBe(false);
    });

    it('skips integrations that are not connected', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({ status: 'expired' }),
      );
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(tools).toEqual([]);
    });

    /**
     * 회귀 보호 (2026-05-15) — 사용자 보고: AI 에이전트가
     * `shops_list` (mall.read_store) 를 호출 → 403 insufficient_scope.
     * 사용자 token 권한은 `mall.read_product/write_product/read_order` 만
     * 보유. operation 이 요구하는 scope 가 granted 에 없으면 tool 자체를
     * 노출하지 말아야 한다.
     */
    it('filters operations whose required scope is not in credentials.scopes', async () => {
      const integration = makeIntegration({
        credentials: {
          mall_id: 'myshop',
          app_type: 'public',
          access_token: 't',
          refresh_token: 'r',
          // Only product read — no store, no order, no write_product.
          scopes: ['mall.read_product'],
        },
      });
      integrationsService.getForExecution.mockResolvedValue(integration);

      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      const names = tools.map((t) => t.name);

      // product_list / product_get require mall.read_product — exposed.
      expect(names).toEqual(
        expect.arrayContaining([
          'mcp_abcdef1234567890__product_list',
          'mcp_abcdef1234567890__product_get',
        ]),
      );
      // shops_list requires mall.read_store — NOT in granted → must be
      // filtered out (this is the bug-fix invariant).
      expect(names).not.toContain('mcp_abcdef1234567890__shops_list');
      expect(names).not.toContain('mcp_abcdef1234567890__store_get');
      // product_create requires mall.write_product — NOT granted →
      // filtered.
      expect(names).not.toContain('mcp_abcdef1234567890__product_create');
      // No order ops either — mall.read_order not granted.
      expect(names.some((n) => n.includes('__orders_'))).toBe(false);
    });

    it('exposes zero tools when integration has empty scopes array', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({
          credentials: {
            mall_id: 'myshop',
            app_type: 'public',
            access_token: 't',
            refresh_token: 'r',
            scopes: [],
          },
        }),
      );
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(tools).toEqual([]);
    });

    it('exposes zero tools when integration has no scopes field (legacy / corrupted credentials)', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({
          credentials: {
            mall_id: 'myshop',
            app_type: 'public',
            access_token: 't',
            refresh_token: 'r',
            // scopes field missing entirely.
          },
        }),
      );
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(tools).toEqual([]);
    });
  });

  describe('execute', () => {
    async function setup(): Promise<{ sid: string; integration: Integration }> {
      const integration = makeIntegration();
      integrationsService.getForExecution.mockResolvedValue(integration);
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      return { sid: 'abcdef1234567890', integration };
    }

    it('dispatches to Cafe24ApiClient and returns success payload', async () => {
      const { sid } = await setup();
      apiClient.call.mockResolvedValue({
        status: 200,
        body: { products: [{ product_no: 1 }] },
        headers: {},
        retries: 0,
      });

      const res = await provider.execute(
        makeCall(`mcp_${sid}__product_list`, { shop_no: 1 }),
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
      expect(parsed.response).toEqual({ products: [{ product_no: 1 }] });
      expect(integrationsService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' }),
      );
    });

    it('returns CAFE24_MISSING_FIELDS error when required field absent', async () => {
      const { sid } = await setup();
      const res = await provider.execute(
        makeCall(`mcp_${sid}__product_get`, {}), // product_no missing
        {
          config: {},
          workspaceId: 'ws-1',
          executionId: 'exec-1',
        },
      );
      expect(res.status).toBe('error');
      expect(JSON.parse(res.content)).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'CAFE24_MISSING_FIELDS' }),
        }),
      );
      expect(apiClient.call).not.toHaveBeenCalled();
    });

    it('translates Cafe24AuthFailedError into CAFE24_AUTH_FAILED', async () => {
      const { sid } = await setup();
      apiClient.call.mockRejectedValue(
        new Cafe24AuthFailedError(401, 'myshop', { error: 'Unauthorized' }),
      );
      const res = await provider.execute(
        makeCall(`mcp_${sid}__product_list`, { shop_no: 1 }),
        {
          config: {},
          workspaceId: 'ws-1',
          executionId: 'exec-1',
          nodeExecutionId: 'ne-1',
          workflowId: 'wf-1',
        },
      );
      expect(res.status).toBe('error');
      expect(JSON.parse(res.content).error.code).toBe('CAFE24_AUTH_FAILED');
      expect(integrationsService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error: expect.objectContaining({ code: 'CAFE24_AUTH_FAILED' }),
        }),
      );
    });

    it('translates Cafe24RateLimitedError into CAFE24_RATE_LIMITED', async () => {
      const { sid } = await setup();
      apiClient.call.mockRejectedValue(
        new Cafe24RateLimitedError(2, 5, 'myshop'),
      );
      const res = await provider.execute(
        makeCall(`mcp_${sid}__product_list`, { shop_no: 1 }),
        {
          config: {},
          workspaceId: 'ws-1',
          executionId: 'exec-1',
        },
      );
      expect(res.status).toBe('error');
      expect(JSON.parse(res.content).error.code).toBe('CAFE24_RATE_LIMITED');
    });

    it('returns CAFE24_MCP_NO_SESSION when buildTools was not called for this execution', async () => {
      const res = await provider.execute(
        makeCall('mcp_abcdef1234567890__product_list', { shop_no: 1 }),
        {
          config: {},
          workspaceId: 'ws-1',
          executionId: 'other-exec',
        },
      );
      expect(res.status).toBe('error');
      expect(JSON.parse(res.content).error.code).toBe('CAFE24_MCP_NO_SESSION');
    });
  });

  describe('cleanup', () => {
    it('removes execution state and releases sids', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });
      expect(provider.matches('mcp_abcdef1234567890__product_list')).toBe(true);

      await provider.cleanup({ executionId: 'exec-1' });
      expect(provider.matches('mcp_abcdef1234567890__product_list')).toBe(false);
    });

    it('cleanup() without executionId is a no-op (other sessions stay alive)', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
        workspaceId: 'ws-1',
        executionId: 'exec-A',
      });
      // No executionId — must NOT tear down exec-A.
      await provider.cleanup({});
      expect(provider.matches('mcp_abcdef1234567890__product_list')).toBe(true);
      // __resetForTesting drops everything (tests can use this).
      provider.__resetForTesting();
      expect(provider.matches('mcp_abcdef1234567890__product_list')).toBe(false);
    });
  });
});
