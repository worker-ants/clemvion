import { Cafe24McpToolProvider } from './cafe24-mcp-tool-provider';
import {
  Cafe24ApiClient,
  Cafe24AuthFailedError,
  Cafe24RateLimitedError,
  Cafe24TransportFailedError,
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
  let apiClient: { call: Mock; refreshTokenViaQueue: Mock };
  let provider: Cafe24McpToolProvider;

  beforeEach(() => {
    integrationsService = {
      getForExecution: jest.fn(),
      logUsage: jest.fn().mockResolvedValue(undefined),
    };
    apiClient = {
      call: jest.fn(),
      refreshTokenViaQueue: jest.fn().mockResolvedValue(undefined),
    };
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

    it('appends KST timezone suffix to every tool description (spec §5.3)', async () => {
      // 모든 cafe24 도구의 description 끝에 KST (UTC+9) 명시 한 줄이 자동
      // append 되어야 한다. spec/conventions/cafe24-api-metadata.md §5.3 의
      // CAFE24_TIMEZONE_SUFFIX 단일 정책. AI Agent 가 $now (UTC) 또는 KST/UTC
      // 모호한 시각 문자열을 도구 인자로 넘길 때 9시간 어긋난 결과를 받는
      // 회귀의 1차 방어선이다.
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      const tools = await provider.buildTools({
        config: {
          mcpServers: [{ integrationId: 'abcdef1234567890' }],
        },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
      });

      const KST_SUFFIX =
        'All date/time parameters and response fields use KST (Asia/Seoul, UTC+9)';

      // (1) 대표 도구 (product_list — date filter 있는 케이스) 의 description 을
      // 직접 조회해 suffix 위치·내용을 검증. tools 배열이 비어있어도 find 가
      // undefined 를 반환하므로 가드 + 명시적 assertion 으로 false positive 차단.
      const productList = tools.find(
        (t) => t.name === 'mcp_abcdef1234567890__product_list',
      );
      expect(productList).toBeDefined();
      expect(productList!.description).toContain(KST_SUFFIX);
      // suffix 가 description 의 끝 부분에 위치하는지 (Cafe24 wire-format hint 뒤).
      expect(productList!.description.lastIndexOf(KST_SUFFIX)).toBeGreaterThan(
        productList!.description.indexOf('(Cafe24 '),
      );

      // (2) 모든 도구가 동일 suffix 포함. 길이 가드는 (1) 의 명시 검증으로 보완.
      expect(tools.length).toBeGreaterThan(0);
      for (const t of tools) {
        expect(t.description).toContain(KST_SUFFIX);
      }
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
      expect(provider.matches('mcp_abcdef1234567890__product_list')).toBe(
        false,
      );
    });

    it('skips integrations in error status (refresh-then-include 미적용)', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({ status: 'error', statusReason: 'auth_failed' }),
      );
      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
        mcpDiagnostics: summaries,
      });
      expect(tools).toEqual([]);
      // refresh-then-include 는 error 상태에 적용 안 됨 — 외부 명시 reauth 가 정식.
      expect(apiClient.refreshTokenViaQueue).not.toHaveBeenCalled();
      expect(summaries).toEqual([
        expect.objectContaining({
          status: 'skipped',
          skipReason: 'error',
        }),
      ]);
    });

    it('skips expired + install_timeout (refresh 불가)', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({
          status: 'expired',
          statusReason: 'install_timeout',
          credentials: {
            mall_id: 'myshop',
            app_type: 'private',
            // install_timeout 은 토큰 자체가 비어있을 수 있다.
            scopes: [...ALL_CAFE24_SCOPES],
          },
        }),
      );
      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
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
          credentials: {
            mall_id: 'myshop',
            app_type: 'public',
            access_token: 't',
            // no refresh_token
            scopes: [...ALL_CAFE24_SCOPES],
          },
        }),
      );
      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
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

    // spec/4-nodes/4-integration/4-cafe24.md §8.6 — expired + refresh_token 보유
    // 행은 1회 큐 경유 refresh 시도 후 worker 가 status='connected' 로 전이시키면
    // fresh row 로 tool 등록 계속. 본 테스트는 정상 회복 경로.
    it('refreshes expired+refresh_token integration and includes tools when worker flips to connected', async () => {
      const expiredRow = makeIntegration({ status: 'expired' });
      const freshRow = makeIntegration({ status: 'connected' });
      integrationsService.getForExecution
        .mockResolvedValueOnce(expiredRow) // 첫 조회
        .mockResolvedValueOnce(freshRow); // refresh 후 재조회
      apiClient.refreshTokenViaQueue.mockResolvedValue(undefined);

      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
        mcpDiagnostics: summaries,
      });

      expect(apiClient.refreshTokenViaQueue).toHaveBeenCalledWith(
        expiredRow,
        'background',
      );
      expect(tools.length).toBeGreaterThan(0); // 모든 op 노출
      expect(summaries).toEqual([
        expect.objectContaining({
          status: 'connected',
          serviceType: 'cafe24',
        }),
      ]);
      // 정상 회복이라 skipReason 없음.
      expect(summaries[0].skipReason).toBeUndefined();
    });

    it('skips expired+refresh_token when refresh fails with auth_failed', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({ status: 'expired' }),
      );
      apiClient.refreshTokenViaQueue.mockRejectedValue(
        new Cafe24AuthFailedError('invalid_grant', 401, undefined),
      );

      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
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
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
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

    it('skips pending_install integrations with pending_install skipReason', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({ status: 'pending_install' }),
      );
      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
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

    it('pushes connected summary for healthy integration', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
        mcpDiagnostics: summaries,
      });
      expect(summaries).toEqual([
        expect.objectContaining({
          integrationId: 'abcdef1234567890',
          serviceType: 'cafe24',
          status: 'connected',
        }),
      ]);
      expect(summaries[0].toolCount).toBeGreaterThan(0);
    });

    it('pushes lookup_failed when re-read after successful refresh fails', async () => {
      const expiredRow = makeIntegration({ status: 'expired' });
      integrationsService.getForExecution
        .mockResolvedValueOnce(expiredRow)
        .mockRejectedValueOnce(new Error('replica lag — row gone'));
      apiClient.refreshTokenViaQueue.mockResolvedValue(undefined);

      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
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

    // spec §8.6 — transport / Redis / 기타 non-AuthFailed 오류도 같은 reason
    // 으로 묶는다 (사용자 입장에선 토큰 갱신 실패 = 동일). vocabulary 세분화
    // 는 spec follow-up.
    it('uses expired_refresh_failed for non-auth refresh errors (transport, etc.)', async () => {
      integrationsService.getForExecution.mockResolvedValue(
        makeIntegration({ status: 'expired' }),
      );
      apiClient.refreshTokenViaQueue.mockRejectedValue(new Error('ECONNRESET'));

      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
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

    it('works without mcpDiagnostics array (backward compat — undefined push 무시)', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
        // mcpDiagnostics 미주입.
      });
      expect(tools.length).toBeGreaterThan(0);
    });

    it('pushes lookup_failed when integrations.getForExecution throws', async () => {
      integrationsService.getForExecution.mockRejectedValue(
        new Error('Integration vanished'),
      );
      const summaries: import('./mcp-diagnostics').McpServerSummary[] = [];
      const tools = await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
        workspaceId: 'ws-1',
        executionId: 'exec-1',
        mcpDiagnostics: summaries,
      });
      expect(tools).toEqual([]);
      expect(summaries).toEqual([
        expect.objectContaining({
          integrationId: 'abcdef1234567890',
          status: 'skipped',
          skipReason: 'lookup_failed',
        }),
      ]);
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

    // B-5-5: Cafe24TransportFailedError envelope 변환 — 분류된 코드가
    // CAFE24_TRANSPORT_FAILED 가 되고, 노드 경로와 일관되게 logUsage 가
    // failed 로 기록되는지.
    it('translates Cafe24TransportFailedError into CAFE24_TRANSPORT_FAILED', async () => {
      const { sid } = await setup();
      apiClient.call.mockRejectedValue(
        new Cafe24TransportFailedError(
          new Error('ECONNRESET — connection reset by peer'),
        ),
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
      expect(JSON.parse(res.content).error.code).toBe(
        'CAFE24_TRANSPORT_FAILED',
      );
      expect(integrationsService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error: expect.objectContaining({ code: 'CAFE24_TRANSPORT_FAILED' }),
        }),
      );
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
      expect(provider.matches('mcp_abcdef1234567890__product_list')).toBe(
        false,
      );
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
      expect(provider.matches('mcp_abcdef1234567890__product_list')).toBe(
        false,
      );
    });

    // Regression: B-2-3 from cafe24-followup-backlog. multi-turn AI Agent
    // can invoke buildTools twice on the same executionId before any
    // cleanup. Each retain must be matched by exactly one release —
    // ensuring sidCount never goes negative and stays positive while
    // the execution is alive. Without the `newForThisExecution` guard
    // (already in buildTools), the second buildTools would double-retain
    // and break the invariant.
    it('buildTools twice on same executionId then single cleanup releases sid to 0', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());

      await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
        workspaceId: 'ws-1',
        executionId: 'exec-multi',
      });
      // Second buildTools — simulates multi-turn resume of the same agent.
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
        workspaceId: 'ws-1',
        executionId: 'exec-multi',
      });
      expect(provider.matches('mcp_abcdef1234567890__product_list')).toBe(true);

      await provider.cleanup({ executionId: 'exec-multi' });

      // Single cleanup must take sidCount to 0 — matches() now false.
      // 옛 더블 retain 회귀 시 매치 유지로 새 execution 시 stale state 노출.
      expect(provider.matches('mcp_abcdef1234567890__product_list')).toBe(
        false,
      );
    });

    // Regression: two concurrent executions sharing the same Integration —
    // each retains once, each cleanup releases once. The middle state
    // (after first cleanup) must still see the sid alive for the other
    // execution.
    it('two executions on same Integration — first cleanup keeps sid alive for second', async () => {
      integrationsService.getForExecution.mockResolvedValue(makeIntegration());

      await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
        workspaceId: 'ws-1',
        executionId: 'exec-A',
      });
      await provider.buildTools({
        config: { mcpServers: [{ integrationId: 'abcdef1234567890' }] },
        workspaceId: 'ws-1',
        executionId: 'exec-B',
      });

      await provider.cleanup({ executionId: 'exec-A' });
      expect(provider.matches('mcp_abcdef1234567890__product_list')).toBe(true);

      await provider.cleanup({ executionId: 'exec-B' });
      expect(provider.matches('mcp_abcdef1234567890__product_list')).toBe(
        false,
      );
    });
  });
});
