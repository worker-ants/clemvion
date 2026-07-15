import {
  evaluateAiAgentToolPayloadWarnings,
  AI_AGENT_TOOL_PAYLOAD_BUDGET_RULE_ID,
  type ToolBudgetGraphNode,
} from './tool-payload-save-warning';
import type { Integration } from '../../../modules/integrations/entities/integration.entity';
import {
  listAllCafe24Operations,
  scopeForOperation,
} from '../integration/cafe24/metadata/index';

/**
 * AI Agent 저장 시점(config-time) 도구 payload 예산 경고 (spec §4.2 · §10,
 * cross-node-warning-rules §5 · §8) 단위. connected cafe24/makeshop 정적 카탈로그
 * + presentation 재현, best-effort skip(비-connected·generic MCP·미로드),
 * soft→warning / hard→(strict)error 승격, per-node 1건을 고정한다.
 */
describe('tool-payload-save-warning — evaluateAiAgentToolPayloadWarnings', () => {
  const ALL_CAFE24_SCOPES: readonly string[] = Array.from(
    new Set(
      listAllCafe24Operations().map(({ resource, operation }) =>
        scopeForOperation(resource, operation),
      ),
    ),
  );

  // product_list operation 의 required scope — 단일 op 재현용.
  const PRODUCT_LIST_SCOPE = (() => {
    const found = listAllCafe24Operations().find(
      ({ operation }) => operation.id === 'product_list',
    );
    return found ? scopeForOperation(found.resource, found.operation) : '';
  })();

  const ENV_KEYS = [
    'AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES',
    'AI_AGENT_TOOL_PAYLOAD_HARD_BYTES',
    'AI_AGENT_TOOL_COUNT_MAX',
    'AI_AGENT_TOOL_BUDGET_STRICT_SAVE',
  ] as const;
  const savedEnv: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
    // 기본: soft/hard 를 매우 크게 잡아 "예산 이내" 를 기본 상태로 (테스트가
    // 필요 시 낮춘다). count 도 크게.
    process.env.AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES = '100000000';
    process.env.AI_AGENT_TOOL_PAYLOAD_HARD_BYTES = '100000000';
    process.env.AI_AGENT_TOOL_COUNT_MAX = '100000';
    delete process.env.AI_AGENT_TOOL_BUDGET_STRICT_SAVE;
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  function cafe24Integration(
    overrides: Partial<Integration> = {},
  ): Integration {
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
      ...overrides,
    } as Integration;
  }

  function makeshopIntegration(
    overrides: Partial<Integration> = {},
  ): Integration {
    return {
      id: 'fedcba0987654321',
      workspaceId: 'ws-1',
      serviceType: 'makeshop',
      name: 'My MakeShop',
      authType: 'oauth2',
      credentials: { access_token: 't', refresh_token: 'r' },
      scope: 'personal',
      status: 'connected',
      statusReason: null,
      ...overrides,
    } as Integration;
  }

  function aiAgentNode(
    config: Record<string, unknown>,
    over: Partial<ToolBudgetGraphNode> = {},
  ): ToolBudgetGraphNode {
    return { id: 'node-1', type: 'ai_agent', label: 'Agent', config, ...over };
  }

  const noLoad = { loadIntegration: jest.fn().mockResolvedValue(null) };

  it('returns [] when there are no ai_agent nodes', async () => {
    const nodes: ToolBudgetGraphNode[] = [
      { id: 'n1', type: 'manual_trigger', config: {} },
      { id: 'n2', type: 'http', config: { mcpServers: [{ integrationId: 'x' }] } },
    ];
    const res = await evaluateAiAgentToolPayloadWarnings(nodes, noLoad);
    expect(res).toEqual([]);
    // non-ai_agent 노드의 integration 은 조회조차 하지 않는다.
    expect(noLoad.loadIntegration).not.toHaveBeenCalled();
  });

  it('returns [] for an ai_agent node with no tools (empty config)', async () => {
    const res = await evaluateAiAgentToolPayloadWarnings(
      [aiAgentNode({})],
      noLoad,
    );
    expect(res).toEqual([]);
  });

  it('emits a warning when a connected cafe24 catalog exceeds the soft budget', async () => {
    process.env.AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES = '10';
    const loadIntegration = jest
      .fn()
      .mockResolvedValue(cafe24Integration());
    const res = await evaluateAiAgentToolPayloadWarnings(
      [
        aiAgentNode({
          mcpServers: [{ integrationId: 'abcdef1234567890', enabledTools: ['*'] }],
        }),
      ],
      { loadIntegration },
    );
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      ruleId: AI_AGENT_TOOL_PAYLOAD_BUDGET_RULE_ID,
      severity: 'warning',
      nodeId: 'node-1',
    });
    // params 로 노드 라벨·수치가 분리 노출된다 (i18n Principle 3-C).
    expect(res[0].params?.node).toBe('Agent');
    expect(typeof res[0].params?.bytes).toBe('number');
    expect(res[0].params?.culprit).toContain('mcp:');
    expect(loadIntegration).toHaveBeenCalledWith('abcdef1234567890');
  });

  it('stays severity=warning on a hard breach when strict-save is off', async () => {
    process.env.AI_AGENT_TOOL_PAYLOAD_HARD_BYTES = '10';
    const loadIntegration = jest.fn().mockResolvedValue(cafe24Integration());
    const res = await evaluateAiAgentToolPayloadWarnings(
      [
        aiAgentNode({
          mcpServers: [{ integrationId: 'abcdef1234567890', enabledTools: ['product_list'] }],
        }),
      ],
      { loadIntegration },
    );
    expect(res).toHaveLength(1);
    expect(res[0].severity).toBe('warning');
  });

  it('promotes to severity=error on a hard breach when strict-save is on', async () => {
    process.env.AI_AGENT_TOOL_PAYLOAD_HARD_BYTES = '10';
    process.env.AI_AGENT_TOOL_BUDGET_STRICT_SAVE = 'true';
    const loadIntegration = jest.fn().mockResolvedValue(cafe24Integration());
    const res = await evaluateAiAgentToolPayloadWarnings(
      [
        aiAgentNode({
          mcpServers: [{ integrationId: 'abcdef1234567890', enabledTools: ['product_list'] }],
        }),
      ],
      { loadIntegration },
    );
    expect(res).toHaveLength(1);
    expect(res[0].severity).toBe('error');
  });

  it('promotes to error on a tool-count breach under strict-save', async () => {
    process.env.AI_AGENT_TOOL_COUNT_MAX = '0';
    process.env.AI_AGENT_TOOL_BUDGET_STRICT_SAVE = 'true';
    const loadIntegration = jest.fn().mockResolvedValue(cafe24Integration());
    const res = await evaluateAiAgentToolPayloadWarnings(
      [
        aiAgentNode({
          mcpServers: [{ integrationId: 'abcdef1234567890', enabledTools: ['product_list'] }],
        }),
      ],
      { loadIntegration },
    );
    expect(res).toHaveLength(1);
    expect(res[0].severity).toBe('error');
  });

  it('returns [] (under budget) for a small allowlisted catalog with default budgets', async () => {
    const loadIntegration = jest.fn().mockResolvedValue(cafe24Integration());
    const res = await evaluateAiAgentToolPayloadWarnings(
      [
        aiAgentNode({
          mcpServers: [{ integrationId: 'abcdef1234567890', enabledTools: ['product_list'] }],
        }),
      ],
      { loadIntegration },
    );
    expect(res).toEqual([]);
  });

  it('best-effort skips a non-connected integration', async () => {
    process.env.AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES = '10';
    const loadIntegration = jest
      .fn()
      .mockResolvedValue(cafe24Integration({ status: 'error' }));
    const res = await evaluateAiAgentToolPayloadWarnings(
      [
        aiAgentNode({
          mcpServers: [{ integrationId: 'abcdef1234567890', enabledTools: ['*'] }],
        }),
      ],
      { loadIntegration },
    );
    expect(res).toEqual([]);
  });

  it('best-effort skips a generic external MCP (service_type=mcp)', async () => {
    process.env.AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES = '10';
    const loadIntegration = jest
      .fn()
      .mockResolvedValue(cafe24Integration({ serviceType: 'mcp' }));
    const res = await evaluateAiAgentToolPayloadWarnings(
      [
        aiAgentNode({
          mcpServers: [{ integrationId: 'abcdef1234567890', enabledTools: ['*'] }],
        }),
      ],
      { loadIntegration },
    );
    expect(res).toEqual([]);
  });

  it('best-effort skips when the loader returns null (not found / unreadable)', async () => {
    process.env.AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES = '10';
    const loadIntegration = jest.fn().mockResolvedValue(null);
    const res = await evaluateAiAgentToolPayloadWarnings(
      [
        aiAgentNode({
          mcpServers: [{ integrationId: 'missing', enabledTools: ['*'] }],
        }),
      ],
      { loadIntegration },
    );
    expect(res).toEqual([]);
  });

  it('best-effort skips when the loader throws', async () => {
    process.env.AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES = '10';
    const loadIntegration = jest
      .fn()
      .mockRejectedValue(new Error('db down'));
    const res = await evaluateAiAgentToolPayloadWarnings(
      [
        aiAgentNode({
          mcpServers: [{ integrationId: 'x', enabledTools: ['*'] }],
        }),
      ],
      { loadIntegration },
    );
    expect(res).toEqual([]);
  });

  it('reproduces a connected makeshop catalog', async () => {
    process.env.AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES = '10';
    const loadIntegration = jest.fn().mockResolvedValue(makeshopIntegration());
    const res = await evaluateAiAgentToolPayloadWarnings(
      [
        aiAgentNode({
          mcpServers: [{ integrationId: 'fedcba0987654321' }],
        }),
      ],
      { loadIntegration },
    );
    expect(res).toHaveLength(1);
    expect(res[0].severity).toBe('warning');
    expect(res[0].params?.culprit).toContain('mcp:');
  });

  it('counts presentation render_* tools toward the budget', async () => {
    process.env.AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES = '10';
    const res = await evaluateAiAgentToolPayloadWarnings(
      [aiAgentNode({ presentationTools: [{ type: 'table' }, { type: 'chart' }] })],
      noLoad,
    );
    expect(res).toHaveLength(1);
    expect(res[0].params?.culprit).toBe('render');
  });

  it('evaluates each ai_agent node independently (per-node result)', async () => {
    process.env.AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES = '10';
    const nodes: ToolBudgetGraphNode[] = [
      aiAgentNode({ presentationTools: [{ type: 'table' }] }, { id: 'a', label: 'A' }),
      aiAgentNode({}, { id: 'b', label: 'B' }), // no tools → no warning
      aiAgentNode({ presentationTools: [{ type: 'form' }] }, { id: 'c', label: 'C' }),
    ];
    const res = await evaluateAiAgentToolPayloadWarnings(nodes, noLoad);
    expect(res.map((r) => r.nodeId).sort()).toEqual(['a', 'c']);
  });

  it('falls back to node.id for the label when label is empty', async () => {
    process.env.AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES = '10';
    const res = await evaluateAiAgentToolPayloadWarnings(
      [aiAgentNode({ presentationTools: [{ type: 'table' }] }, { label: '' })],
      noLoad,
    );
    expect(res[0].params?.node).toBe('node-1');
  });

  it('PRODUCT_LIST_SCOPE sanity — the product_list operation exists in the catalog', () => {
    // 위 테스트들이 product_list 단일 op 재현에 의존하므로 카탈로그 존재를 고정.
    expect(PRODUCT_LIST_SCOPE.length).toBeGreaterThan(0);
  });
});
