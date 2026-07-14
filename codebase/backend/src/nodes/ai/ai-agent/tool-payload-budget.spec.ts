import {
  enforceToolPayloadBudget,
  estimateAgentToolPayload,
  toolProviderGroupKey,
  toolPayloadHardBytes,
  toolPayloadSoftBytes,
  toolCountMax,
  ToolDefinitionPayloadExceededError,
} from './tool-payload-budget';
import { estimateTextTokens } from '../shared/agent-memory-injection';
import type { ToolDef } from '../../../modules/llm/interfaces/llm-client.interface';

/**
 * AI Agent 도구 정의 payload 예산 가드레일 (spec §4.2 · §10 · §12.15) 단위.
 * estimator 그룹핑 · enforce 의 soft warn / hard throw / count throw · error.details
 * shape · env override 를 직접 고정한다.
 */
describe('tool-payload-budget', () => {
  const tool = (
    name: string,
    description = 'desc',
    parameters: Record<string, unknown> = { type: 'object', properties: {} },
  ): ToolDef => ({ name, description, parameters });

  // env override 함수형(매 호출 process.env 읽기) 이므로 각 테스트 후 원복.
  const ENV_KEYS = [
    'AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES',
    'AI_AGENT_TOOL_PAYLOAD_HARD_BYTES',
    'AI_AGENT_TOOL_COUNT_MAX',
  ] as const;
  const savedEnv: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  describe('toolProviderGroupKey', () => {
    it('maps each tool-name prefix to its provider group key', () => {
      expect(toolProviderGroupKey('mcp_abc12345__get_orders')).toBe(
        'mcp:abc12345',
      );
      expect(toolProviderGroupKey('mcp_def67890__list_products')).toBe(
        'mcp:def67890',
      );
      // sid = 첫 `__` 앞 세그먼트만 (그 뒤 `__` 는 무시).
      expect(toolProviderGroupKey('mcp_sid1__a__b__c')).toBe('mcp:sid1');
      expect(toolProviderGroupKey('kb_workspace_main')).toBe('kb');
      expect(toolProviderGroupKey('render_table')).toBe('render');
      expect(toolProviderGroupKey('cond_abc_1234')).toBe('cond');
      expect(toolProviderGroupKey('some_generic_tool')).toBe('tool');
    });
  });

  describe('estimateAgentToolPayload', () => {
    it('computes bytes / approxTokens / toolCount from the serialized array', () => {
      const tools = [tool('kb_a'), tool('render_table')];
      const serialized = JSON.stringify(tools);
      const est = estimateAgentToolPayload(tools);

      expect(est.bytes).toBe(Buffer.byteLength(serialized));
      expect(est.approxTokens).toBe(estimateTextTokens(serialized));
      expect(est.approxTokens).toBeGreaterThan(0);
      expect(est.toolCount).toBe(2);
    });

    it('groups perProvider by prefix with per-group bytes and count', () => {
      const tools = [
        tool('mcp_abc12345__get_orders'),
        tool('mcp_abc12345__list_products'),
        tool('mcp_def67890__foo'),
        tool('kb_workspace'),
        tool('render_table'),
        tool('cond_x'),
        tool('legacy_tool'),
      ];
      const est = estimateAgentToolPayload(tools);
      const byKey = new Map(est.perProvider.map((p) => [p.key, p]));

      expect(byKey.get('mcp:abc12345')?.toolCount).toBe(2);
      expect(byKey.get('mcp:def67890')?.toolCount).toBe(1);
      expect(byKey.get('kb')?.toolCount).toBe(1);
      expect(byKey.get('render')?.toolCount).toBe(1);
      expect(byKey.get('cond')?.toolCount).toBe(1);
      expect(byKey.get('tool')?.toolCount).toBe(1);

      // 그룹별 bytes = 그 그룹 tool 만 직렬화한 크기.
      const mcpAbcTools = tools.filter((t) =>
        t.name.startsWith('mcp_abc12345__'),
      );
      expect(byKey.get('mcp:abc12345')?.bytes).toBe(
        Buffer.byteLength(JSON.stringify(mcpAbcTools)),
      );
      // perProvider toolCount 합 = 전체 개수.
      const sum = est.perProvider.reduce((a, p) => a + p.toolCount, 0);
      expect(sum).toBe(tools.length);
    });

    it('handles the empty tool set (bytes of "[]", no groups)', () => {
      const est = estimateAgentToolPayload([]);
      expect(est.toolCount).toBe(0);
      expect(est.bytes).toBe(Buffer.byteLength('[]'));
      expect(est.perProvider).toEqual([]);
    });
  });

  describe('enforceToolPayloadBudget', () => {
    it('returns the estimate and does not warn under the soft budget', () => {
      const logger = { warn: jest.fn() };
      const est = enforceToolPayloadBudget([tool('kb_a')], logger);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(est.toolCount).toBe(1);
    });

    it('logs a warning (no throw) when over soft but under hard', () => {
      // soft 를 아주 낮게, hard 는 넉넉히 → warn 만.
      process.env.AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES = '10';
      process.env.AI_AGENT_TOOL_PAYLOAD_HARD_BYTES = '1000000';
      const logger = { warn: jest.fn() };

      const est = enforceToolPayloadBudget(
        [tool('mcp_abc__get'), tool('kb_a')],
        logger,
      );
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn.mock.calls[0][0]).toContain('soft budget');
      expect(est.bytes).toBeGreaterThan(10);
    });

    it('throws TOOL_DEFINITION_PAYLOAD_EXCEEDED when over the hard byte budget', () => {
      process.env.AI_AGENT_TOOL_PAYLOAD_HARD_BYTES = '10';
      const logger = { warn: jest.fn() };
      expect(() =>
        enforceToolPayloadBudget([tool('mcp_abc__get')], logger),
      ).toThrow(ToolDefinitionPayloadExceededError);
    });

    it('throws when the tool count exceeds TOOL_COUNT_MAX even under byte budgets', () => {
      process.env.AI_AGENT_TOOL_COUNT_MAX = '2';
      const tools = [tool('kb_a'), tool('kb_b'), tool('kb_c')];
      expect(() => enforceToolPayloadBudget(tools)).toThrow(
        ToolDefinitionPayloadExceededError,
      );
    });

    it('populates error.details with retryable:false, byte/count totals and culprit', () => {
      process.env.AI_AGENT_TOOL_PAYLOAD_HARD_BYTES = '10';
      const tools = [
        // mcp:big 그룹이 bytes 최대 → culpritProvider 로 지목돼야 한다.
        tool('mcp_big__op', 'x'.repeat(500)),
        tool('kb_small'),
      ];
      let caught: ToolDefinitionPayloadExceededError | undefined;
      try {
        enforceToolPayloadBudget(tools);
      } catch (err) {
        caught = err as ToolDefinitionPayloadExceededError;
      }
      expect(caught).toBeInstanceOf(ToolDefinitionPayloadExceededError);
      expect(caught?.name).toBe('ToolDefinitionPayloadExceededError');
      expect(caught?.code).toBe('TOOL_DEFINITION_PAYLOAD_EXCEEDED');
      // retryable 은 details 안 (spec §7.3 — LLM 계열 필수).
      expect(caught?.details.retryable).toBe(false);
      expect(caught?.details.totalBytes).toBe(
        estimateAgentToolPayload(tools).bytes,
      );
      expect(caught?.details.budgetBytes).toBe(10);
      expect(caught?.details.toolCount).toBe(2);
      expect(caught?.details.culpritProvider).toBe('mcp:big');
      // message 는 해결법 안내를 포함한다.
      expect(caught?.message).toContain('mcpServers[].enabledTools');
      expect(caught?.message).toContain('mcp:big');
    });

    it('budgetBytes is always the hard byte budget even on a count breach', () => {
      process.env.AI_AGENT_TOOL_COUNT_MAX = '1';
      process.env.AI_AGENT_TOOL_PAYLOAD_HARD_BYTES = '999999';
      let caught: ToolDefinitionPayloadExceededError | undefined;
      try {
        enforceToolPayloadBudget([tool('kb_a'), tool('kb_b')]);
      } catch (err) {
        caught = err as ToolDefinitionPayloadExceededError;
      }
      expect(caught?.details.budgetBytes).toBe(999999);
    });

    it('degrades gracefully without a logger on a soft breach', () => {
      process.env.AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES = '1';
      process.env.AI_AGENT_TOOL_PAYLOAD_HARD_BYTES = '1000000';
      expect(() => enforceToolPayloadBudget([tool('kb_a')])).not.toThrow();
    });
  });

  describe('env override / NaN defense', () => {
    it('falls back to defaults when env is unset', () => {
      for (const k of ENV_KEYS) delete process.env[k];
      expect(toolPayloadSoftBytes()).toBe(98304);
      expect(toolPayloadHardBytes()).toBe(262144);
      expect(toolCountMax()).toBe(128);
    });

    it('honors numeric env overrides read on each call', () => {
      process.env.AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES = '111';
      process.env.AI_AGENT_TOOL_PAYLOAD_HARD_BYTES = '222';
      process.env.AI_AGENT_TOOL_COUNT_MAX = '9';
      expect(toolPayloadSoftBytes()).toBe(111);
      expect(toolPayloadHardBytes()).toBe(222);
      expect(toolCountMax()).toBe(9);
    });

    it('falls back to defaults for empty / non-numeric env values', () => {
      process.env.AI_AGENT_TOOL_PAYLOAD_HARD_BYTES = '';
      expect(toolPayloadHardBytes()).toBe(262144);
      process.env.AI_AGENT_TOOL_PAYLOAD_HARD_BYTES = 'not-a-number';
      expect(toolPayloadHardBytes()).toBe(262144);
    });
  });
});
