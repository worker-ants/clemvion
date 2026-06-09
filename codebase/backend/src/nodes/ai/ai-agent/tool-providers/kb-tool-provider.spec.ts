import { KbToolProvider, kbToolName } from './kb-tool-provider';
import { ToolCall } from '../../../../modules/llm/interfaces/llm-client.interface';

describe('KbToolProvider', () => {
  let mockRagService: { searchWithMeta: jest.Mock };
  let mockKbService: { findById: jest.Mock };
  let provider: KbToolProvider;

  beforeEach(() => {
    mockRagService = {
      searchWithMeta: jest.fn().mockResolvedValue({ results: [] }),
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
      mockRagService.searchWithMeta.mockResolvedValue({
        results: [
          {
            chunkId: 'c1',
            documentId: 'd1',
            documentName: 'refund-rules.md',
            content: 'You may request a refund within 14 days of purchase.',
            score: 0.872,
            metadata: {},
          },
        ],
      });

      const call: ToolCall = {
        id: 'tc-1',
        name: kbToolName('kb-1'),
        arguments: '{"query":"refund window"}',
      };
      const result = await provider.execute(call, baseCtx);

      expect(mockRagService.searchWithMeta).toHaveBeenCalledWith(
        'refund window',
        ['kb-1'],
        'ws-1',
        { topK: 5, threshold: 0.7 },
      );
      expect(result.toolCallId).toBe('tc-1');
      const content = JSON.parse(result.content) as unknown as {
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

    it('returns not_searchable tool_result when KB is unsearchable (reembedding_required)', async () => {
      mockKbService.findById.mockResolvedValue({ id: 'kb-1', name: '요금제' });
      mockRagService.searchWithMeta.mockResolvedValue({
        results: [],
        unsearchable: [{ kbId: 'kb-1', reason: 'reembedding_required' }],
      });
      const call: ToolCall = {
        id: 'tc-ns',
        name: kbToolName('kb-1'),
        arguments: '{"query":"요금제 종류"}',
      };
      const result = await provider.execute(call, baseCtx);

      const content = JSON.parse(result.content) as {
        status?: string;
        reason?: string;
        note?: string;
        error?: string;
        results: unknown[];
      };
      expect(content.status).toBe('not_searchable');
      expect(content.reason).toBe('reembedding_required');
      expect(content.note).toMatch(/re-embed/i);
      expect(content.results).toEqual([]);
      // 일시 실패(search_failed)와 구분 — 에러 봉투가 아니다.
      expect(content.error).toBeUndefined();
      // graceful 신호이지 노드 실패가 아님 — top-level status 'error' 미설정.
      expect(result.status).toBeUndefined();
      expect(result.ragDiagnosticsDelta).toEqual({
        kbId: 'kb-1',
        query: '요금제 종류',
        resultCount: 0,
        unsearchable: true,
      });
      expect(result.ragSourcesDelta).toBeUndefined();
    });

    it('maps reembed in_progress to reembedding_in_progress reason', async () => {
      mockKbService.findById.mockResolvedValue({ id: 'kb-1', name: 'KB' });
      mockRagService.searchWithMeta.mockResolvedValue({
        results: [],
        unsearchable: [{ kbId: 'kb-1', reason: 'reembedding_in_progress' }],
      });
      const call: ToolCall = {
        id: 'tc-ns2',
        name: kbToolName('kb-1'),
        arguments: '{"query":"q"}',
      };
      const result = await provider.execute(call, baseCtx);
      const content = JSON.parse(result.content) as { reason?: string };
      expect(content.reason).toBe('reembedding_in_progress');
    });

    it('includes rerank diagnostics in ragDiagnosticsDelta when rerank_mode is active', async () => {
      mockKbService.findById.mockResolvedValue({ id: 'kb-1', name: 'KB' });
      const rerankDiag = {
        mode: 'cross_encoder',
        candidateCount: 50,
        returnedCount: 3,
        llmGradingApplied: false,
        cutoffApplied: true,
        error: null,
      };
      mockRagService.searchWithMeta.mockResolvedValue({
        results: [],
        rerank: rerankDiag,
      });
      const call: ToolCall = {
        id: 'tc-rerank',
        name: kbToolName('kb-1'),
        arguments: '{"query":"q"}',
      };
      const result = await provider.execute(call, baseCtx);
      expect(result.ragDiagnosticsDelta?.rerank).toEqual(rerankDiag);
    });

    it('honors LLM-provided top_k and threshold overrides', async () => {
      mockKbService.findById.mockResolvedValue({ id: 'kb-1', name: 'KB' });
      const call: ToolCall = {
        id: 'tc-2',
        name: kbToolName('kb-1'),
        arguments: '{"query":"x","top_k":10,"threshold":0.5}',
      };
      await provider.execute(call, baseCtx);
      expect(mockRagService.searchWithMeta).toHaveBeenCalledWith(
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
      const content = JSON.parse(result.content) as unknown as {
        error: string;
      };
      expect(content.error).toMatch(/query/i);
      expect(mockRagService.searchWithMeta).not.toHaveBeenCalled();
      // status='error' surfaces a red badge in the inspector.
      expect(result.status).toBe('error');
      expect(result.error).toMatch(/query/i);
    });

    it('returns fixed-code tool_result when KB id is unknown (LLM-controlled name only logged)', async () => {
      // 보안: LLM 이 만든 tool name 을 다음 prompt context 에 그대로 흘리지 않고
      // 고정 코드 'unknown_kb_tool' 만 반환. 원본 name 은 logger.warn 으로 기록.
      const call: ToolCall = {
        id: 'tc-4',
        name: 'kb_unknown',
        arguments: '{"query":"x"}',
      };
      const result = await provider.execute(call, baseCtx);
      const content = JSON.parse(result.content) as unknown as {
        error: string;
      };
      expect(content.error).toBe('unknown_kb_tool');
      expect(mockRagService.searchWithMeta).not.toHaveBeenCalled();
      expect(result.status).toBe('error');
      expect(result.error).toBe('unknown_kb_tool');
    });

    it('returns search_failed tool_result and graceful diagnostic when RagSearchService throws', async () => {
      mockKbService.findById.mockResolvedValue({ id: 'kb-1', name: 'KB' });
      mockRagService.searchWithMeta.mockRejectedValue(new Error('db down'));
      const call: ToolCall = {
        id: 'tc-5',
        name: kbToolName('kb-1'),
        arguments: '{"query":"x"}',
      };
      const result = await provider.execute(call, baseCtx);
      const content = JSON.parse(result.content) as unknown as {
        error?: string;
        message?: string;
        results: unknown[];
      };
      expect(content.error).toBe('search_failed');
      expect(content.results).toEqual([]);
      // tool_result content 는 LLM 다음 turn 의 user-facing 영역에 흘러갈 수
      // 있으므로 원시 예외 메시지("db down") 를 노출하면 안 된다. 고정된 사용자
      // 안내만 포함되어야 함. 원시 메시지는 result.error 와 logger.warn 에만 보존.
      expect(content.message).toMatch(/일시적으로/);
      expect(result.content).not.toContain('db down');
      expect(result.ragDiagnosticsDelta?.resultCount).toBe(0);
      // The handler relies on this to flag the tool item as 'error' in the
      // debugging timeline rather than mis-rendering as success.
      expect(result.status).toBe('error');
      expect(result.error).toBe('db down');
    });

    it('reuses KB metadata cached by buildTools instead of re-querying findById', async () => {
      // 같은 노드 실행(executionId) 안에서 buildTools 가 KB 메타를 미리
      // 모았으면 후속 execute() 들은 findById 를 재호출하지 않아야 한다.
      // Promise.all 병렬 호출 시 N+1 DB 쿼리 방지의 회귀 가드.
      mockKbService.findById.mockResolvedValueOnce({
        id: 'kb-1',
        name: 'Refund Policy',
        description: 'desc',
      });
      mockRagService.searchWithMeta.mockResolvedValue({ results: [] });

      // 1) buildTools 가 1회 findById (warm cache).
      await provider.buildTools({
        config: { knowledgeBases: ['kb-1'] },
        workspaceId: 'ws-1',
        executionId: 'exec-cache-1',
      });
      expect(mockKbService.findById).toHaveBeenCalledTimes(1);

      // 2) execute() 3회 — 같은 executionId. 모두 cache hit 이어야 한다.
      const ctx = {
        config: { knowledgeBases: ['kb-1'], ragTopK: 5, ragThreshold: 0.7 },
        workspaceId: 'ws-1',
        executionId: 'exec-cache-1',
      };
      for (let i = 0; i < 3; i++) {
        await provider.execute(
          {
            id: `tc-${i}`,
            name: kbToolName('kb-1'),
            arguments: '{"query":"q"}',
          },
          ctx,
        );
      }
      expect(mockKbService.findById).toHaveBeenCalledTimes(1);

      // 3) cleanup 후에는 cache 가 비워져야 한다.
      await provider.cleanup({ executionId: 'exec-cache-1' });
      await provider.execute(
        {
          id: 'tc-after',
          name: kbToolName('kb-1'),
          arguments: '{"query":"q"}',
        },
        ctx,
      );
      // cache miss 이므로 findById 가 1회 추가 발생.
      expect(mockKbService.findById).toHaveBeenCalledTimes(2);
    });

    it('omits status (defaults to success) on a normal search result', async () => {
      mockKbService.findById.mockResolvedValue({ id: 'kb-1', name: 'KB' });
      mockRagService.searchWithMeta.mockResolvedValue({ results: [] });
      const call: ToolCall = {
        id: 'tc-ok',
        name: kbToolName('kb-1'),
        arguments: '{"query":"q"}',
      };
      const result = await provider.execute(call, baseCtx);
      // Successful path leaves status undefined so the handler's default
      // ('success') applies — explicit assertion ensures we don't accidentally
      // start emitting status='error' on the happy path.
      expect(result.status).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('ragTopK 미설정 시 topK 를 undefined 로 전달 (동적 컷이 ceiling 결정)', async () => {
      mockKbService.findById.mockResolvedValue({ id: 'kb-1', name: 'KB' });
      mockRagService.searchWithMeta.mockResolvedValue({ results: [] });
      const ctx = {
        config: { knowledgeBases: ['kb-1'] }, // ragTopK 없음
        workspaceId: 'ws-1',
      };
      await provider.execute(
        { id: 'tc-n', name: kbToolName('kb-1'), arguments: '{"query":"q"}' },
        ctx,
      );
      expect(mockRagService.searchWithMeta).toHaveBeenCalledWith(
        'q',
        ['kb-1'],
        'ws-1',
        { topK: undefined, threshold: 0.7 },
      );
    });

    it('LLM 인자 top_k 는 ragTopK 미설정이어도 명시 override 로 전달', async () => {
      mockKbService.findById.mockResolvedValue({ id: 'kb-1', name: 'KB' });
      mockRagService.searchWithMeta.mockResolvedValue({ results: [] });
      const ctx = { config: { knowledgeBases: ['kb-1'] }, workspaceId: 'ws-1' };
      await provider.execute(
        {
          id: 'tc-o',
          name: kbToolName('kb-1'),
          arguments: '{"query":"q","top_k":8}',
        },
        ctx,
      );
      expect(mockRagService.searchWithMeta).toHaveBeenCalledWith(
        'q',
        ['kb-1'],
        'ws-1',
        { topK: 8, threshold: 0.7 },
      );
    });

    it("gradingNoGrounding 시 tool_result content 에 '근거 없음' 신호 포함 (D2)", async () => {
      mockKbService.findById.mockResolvedValue({ id: 'kb-1', name: 'KB' });
      mockRagService.searchWithMeta.mockResolvedValue({
        results: [],
        rerank: {
          mode: 'cross_encoder_llm',
          candidateCount: 5,
          returnedCount: 0,
          llmGradingApplied: true,
          gradingNoGrounding: true,
          cutoffApplied: false,
          error: null,
        },
      });
      const call: ToolCall = {
        id: 'tc-ng',
        name: kbToolName('kb-1'),
        arguments: '{"query":"q"}',
      };
      const result = await provider.execute(call, baseCtx);
      const content = JSON.parse(result.content) as {
        grounding?: string;
        note?: string;
        results: unknown[];
      };
      expect(content.grounding).toBe('none');
      expect(content.note).toMatch(/no passages|ground/i);
      expect(content.results).toEqual([]);
    });

    it('gradingNoGrounding 아닐 때는 grounding 신호 미포함 (기존 동작 불변)', async () => {
      mockKbService.findById.mockResolvedValue({ id: 'kb-1', name: 'KB' });
      mockRagService.searchWithMeta.mockResolvedValue({
        results: [],
        rerank: {
          mode: 'cross_encoder',
          candidateCount: 5,
          returnedCount: 0,
          llmGradingApplied: false,
          gradingNoGrounding: false,
          cutoffApplied: true,
          error: null,
        },
      });
      const call: ToolCall = {
        id: 'tc-ok2',
        name: kbToolName('kb-1'),
        arguments: '{"query":"q"}',
      };
      const result = await provider.execute(call, baseCtx);
      const content = JSON.parse(result.content) as { grounding?: string };
      expect(content.grounding).toBeUndefined();
    });
  });
});
