import { KbToolProvider, kbToolName } from './kb-tool-provider';
import { ToolCall } from '../../../../modules/llm/interfaces/llm-client.interface';

describe('KbToolProvider', () => {
  let mockRagService: { search: jest.Mock };
  let mockKbService: { findById: jest.Mock };
  let provider: KbToolProvider;

  beforeEach(() => {
    mockRagService = {
      search: jest.fn().mockResolvedValue([]),
    };
    mockKbService = {
      findById: jest.fn(),
    };
    provider = new KbToolProvider(
      mockRagService as never,
      mockKbService as never,
    );
  });

  describe('matches', () => {
    it('matches kb_ prefixed names', () => {
      expect(provider.matches('kb_abc123')).toBe(true);
    });

    it('rejects non-kb names', () => {
      expect(provider.matches('tool_abc')).toBe(false);
      expect(provider.matches('cond_x')).toBe(false);
      expect(provider.matches('search')).toBe(false);
    });
  });

  describe('buildTools', () => {
    it('returns empty when knowledgeBases is empty', async () => {
      const tools = await provider.buildTools({
        config: {},
        workspaceId: 'ws-1',
      });
      expect(tools).toEqual([]);
      expect(mockKbService.findById).not.toHaveBeenCalled();
    });

    it('builds one tool per KB with name + description from KB metadata', async () => {
      mockKbService.findById
        .mockResolvedValueOnce({
          id: 'kb-1',
          name: 'Refund Policy',
          description: 'Customer refund and return policies',
        })
        .mockResolvedValueOnce({
          id: 'kb-2',
          name: 'Product Catalog',
          description: null,
        });

      const tools = await provider.buildTools({
        config: { knowledgeBases: ['kb-1', 'kb-2'], ragTopK: 7 },
        workspaceId: 'ws-1',
      });

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('kb_kb_1');
      expect(tools[0].description).toContain('Refund Policy');
      expect(tools[0].description).toContain('Customer refund');
      expect(tools[1].name).toBe('kb_kb_2');
      // Without description it falls back to name only.
      expect(tools[1].description).toContain('Product Catalog');
      // Schema includes query (required) + top_k + threshold.
      const params = tools[0].parameters as {
        properties: Record<string, unknown>;
        required: string[];
      };
      expect(params.required).toEqual(['query']);
      expect(params.properties).toHaveProperty('query');
      expect(params.properties).toHaveProperty('top_k');
      expect(params.properties).toHaveProperty('threshold');
    });

    it('skips KBs that fail metadata lookup but keeps the rest', async () => {
      mockKbService.findById
        .mockRejectedValueOnce(new Error('not found'))
        .mockResolvedValueOnce({ id: 'kb-2', name: 'Available KB' });

      const tools = await provider.buildTools({
        config: { knowledgeBases: ['kb-missing', 'kb-2'] },
        workspaceId: 'ws-1',
      });

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe(kbToolName('kb-2'));
    });
  });

  describe('execute', () => {
    const baseCtx = {
      config: { knowledgeBases: ['kb-1'], ragTopK: 5, ragThreshold: 0.7 },
      workspaceId: 'ws-1',
    };

    it('returns search results as JSON tool_result content', async () => {
      mockKbService.findById.mockResolvedValue({
        id: 'kb-1',
        name: 'Refund Policy',
      });
      mockRagService.search.mockResolvedValue([
        {
          chunkId: 'c1',
          documentId: 'd1',
          documentName: 'refund-rules.md',
          content: 'You may request a refund within 14 days of purchase.',
          score: 0.872,
          metadata: {},
        },
      ]);

      const call: ToolCall = {
        id: 'tc-1',
        name: kbToolName('kb-1'),
        arguments: '{"query":"refund window"}',
      };
      const result = await provider.execute(call, baseCtx);

      expect(mockRagService.search).toHaveBeenCalledWith(
        'refund window',
        ['kb-1'],
        'ws-1',
        { topK: 5, threshold: 0.7 },
      );
      expect(result.toolCallId).toBe('tc-1');
      const content = JSON.parse(result.content) as {
        kb: string;
        query: string;
        results: Array<{ source: string; score: number; content: string }>;
      };
      expect(content.kb).toBe('Refund Policy');
      expect(content.query).toBe('refund window');
      expect(content.results).toHaveLength(1);
      expect(content.results[0].source).toBe('refund-rules.md');
      expect(content.results[0].score).toBe(0.872);
      expect(result.ragSourcesDelta).toHaveLength(1);
      expect(result.ragDiagnosticsDelta).toEqual({
        kbId: 'kb-1',
        query: 'refund window',
        resultCount: 1,
      });
    });

    it('honors LLM-provided top_k and threshold overrides', async () => {
      mockKbService.findById.mockResolvedValue({ id: 'kb-1', name: 'KB' });
      const call: ToolCall = {
        id: 'tc-2',
        name: kbToolName('kb-1'),
        arguments: '{"query":"x","top_k":10,"threshold":0.5}',
      };
      await provider.execute(call, baseCtx);
      expect(mockRagService.search).toHaveBeenCalledWith(
        'x',
        ['kb-1'],
        'ws-1',
        { topK: 10, threshold: 0.5 },
      );
    });

    it('returns error tool_result when query is missing', async () => {
      mockKbService.findById.mockResolvedValue({ id: 'kb-1', name: 'KB' });
      const call: ToolCall = {
        id: 'tc-3',
        name: kbToolName('kb-1'),
        arguments: '{"top_k":5}',
      };
      const result = await provider.execute(call, baseCtx);
      const content = JSON.parse(result.content) as { error: string };
      expect(content.error).toMatch(/query/i);
      expect(mockRagService.search).not.toHaveBeenCalled();
    });

    it('returns error tool_result when KB id is unknown', async () => {
      const call: ToolCall = {
        id: 'tc-4',
        name: 'kb_unknown',
        arguments: '{"query":"x"}',
      };
      const result = await provider.execute(call, baseCtx);
      const content = JSON.parse(result.content) as { error: string };
      expect(content.error).toMatch(/Unknown/);
      expect(mockRagService.search).not.toHaveBeenCalled();
    });

    it('returns search_failed tool_result and graceful diagnostic when RagSearchService throws', async () => {
      mockKbService.findById.mockResolvedValue({ id: 'kb-1', name: 'KB' });
      mockRagService.search.mockRejectedValue(new Error('db down'));
      const call: ToolCall = {
        id: 'tc-5',
        name: kbToolName('kb-1'),
        arguments: '{"query":"x"}',
      };
      const result = await provider.execute(call, baseCtx);
      const content = JSON.parse(result.content) as {
        error?: string;
        results: unknown[];
      };
      expect(content.error).toBe('search_failed');
      expect(content.results).toEqual([]);
      expect(result.ragDiagnosticsDelta?.resultCount).toBe(0);
    });
  });
});
