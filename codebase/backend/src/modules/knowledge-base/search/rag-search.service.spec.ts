import { RagSearchService } from './rag-search.service';

// 테스트의 KB row mock 을 만들 때 새 컬럼 default 를 자동 채워주는 helper.
// vector 모드 KB 가 기본. graph 모드 KB 는 ragMode='graph' 를 명시적으로 override.
function makeKbRow(overrides: Partial<KbRowFixture>): KbRowFixture {
  return {
    embeddingModel: 'text-embedding-3-small',
    embeddingDimension: 1536,
    ragMode: 'vector',
    maxHops: 1,
    vectorSeedTopK: 5,
    expandedChunkLimit: 15,
    rerankMode: 'off',
    rerankConfigId: null,
    rerankCandidateK: 50,
    rerankScoreThreshold: null,
    rerankLlmConfigId: null,
    ...overrides,
  } as KbRowFixture;
}

interface KbRowFixture {
  id: string;
  embeddingModel: string;
  embeddingDimension: number | null;
  ragMode: 'vector' | 'graph';
  maxHops: number;
  vectorSeedTopK: number;
  expandedChunkLimit: number;
  rerankMode: 'off' | 'cross_encoder' | 'cross_encoder_llm';
  rerankConfigId: string | null;
  rerankCandidateK: number;
  rerankScoreThreshold: number | null;
  rerankLlmConfigId: string | null;
}

describe('RagSearchService', () => {
  let service: RagSearchService;
  let mockDataSource: Record<string, jest.Mock>;
  let mockLlmService: Record<string, jest.Mock>;
  let mockRerankService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockDataSource = {
      query: jest.fn(),
    };

    mockLlmService = {
      resolveConfig: jest.fn().mockResolvedValue({
        id: 'config-1',
        provider: 'openai',
        workspaceId: 'ws-1',
      }),
      embed: jest.fn(),
    };

    mockRerankService = {
      rerankCandidates: jest.fn(),
    };

    service = new RagSearchService(
      mockDataSource as never,
      mockLlmService as never,
      mockRerankService as never,
    );
  });

  describe('search (vector mode)', () => {
    it('should return empty array for empty knowledgeBaseIds', async () => {
      const result = await service.search('query', [], 'ws-1');
      expect(result).toEqual([]);
      expect(mockLlmService.embed).not.toHaveBeenCalled();
    });

    it('should return empty array for empty query', async () => {
      const result = await service.search('   ', ['kb-1'], 'ws-1');
      expect(result).toEqual([]);
      expect(mockLlmService.embed).not.toHaveBeenCalled();
    });

    it('should gracefully degrade on error and return empty array', async () => {
      mockDataSource.query.mockResolvedValueOnce([makeKbRow({ id: 'kb-1' })]);
      mockLlmService.resolveConfig.mockRejectedValue(
        new Error('Config not found'),
      );

      const result = await service.search('query', ['kb-1'], 'ws-1');
      expect(result).toEqual([]);
    });

    it("should pass each KB's embeddingModel to llmService.embed", async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          makeKbRow({
            id: 'kb-1',
            embeddingModel: 'text-embedding-3-large',
            embeddingDimension: 3072,
          }),
        ])
        .mockResolvedValueOnce([]);
      mockLlmService.embed.mockResolvedValue([new Array(3072).fill(0.1)]);

      await service.search('query', ['kb-1'], 'ws-1');

      expect(mockLlmService.embed).toHaveBeenCalledWith(
        expect.anything(),
        ['query'],
        'text-embedding-3-large',
        undefined,
        'query',
      );
    });

    it('should split KBs by (model, dimension) and embed each group separately', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          makeKbRow({ id: 'kb-1' }),
          makeKbRow({
            id: 'kb-2',
            embeddingModel: 'text-embedding-3-large',
            embeddingDimension: 3072,
          }),
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockLlmService.embed.mockImplementation(
        async (_cfg: unknown, _texts: string[], model: string) => {
          if (model === 'text-embedding-3-small') {
            return [new Array(1536).fill(0.1)];
          }
          return [new Array(3072).fill(0.1)];
        },
      );

      await service.search('query', ['kb-1', 'kb-2'], 'ws-1');

      expect(mockLlmService.embed).toHaveBeenCalledTimes(2);
      const models = mockLlmService.embed.mock.calls.map((c) => c[2]);
      expect(models).toEqual(
        expect.arrayContaining([
          'text-embedding-3-small',
          'text-embedding-3-large',
        ]),
      );
    });

    it('should skip KBs with null embedding_dimension (not yet embedded)', async () => {
      mockDataSource.query.mockResolvedValueOnce([
        makeKbRow({ id: 'kb-1', embeddingDimension: null }),
      ]);

      const result = await service.search('query', ['kb-1'], 'ws-1');

      expect(result).toEqual([]);
      expect(mockLlmService.embed).not.toHaveBeenCalled();
    });

    it('should use halfvec cast for 3072-dim group (matches V023 partial index)', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          makeKbRow({
            id: 'kb-1',
            embeddingModel: 'text-embedding-3-large',
            embeddingDimension: 3072,
          }),
        ])
        .mockResolvedValueOnce([]);
      mockLlmService.embed.mockResolvedValue([new Array(3072).fill(0.1)]);

      await service.search('query', ['kb-1'], 'ws-1');

      const searchSql = mockDataSource.query.mock.calls[1][0] as string;
      expect(searchSql).toContain('halfvec(3072)');
      expect(searchSql).not.toContain('vector(3072)');
      expect(searchSql).toContain('vector_dims(dc.embedding) = 3072');
    });

    it('should use vector cast for sub-2000-dim groups (matches V022 partial indexes)', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([makeKbRow({ id: 'kb-1' })])
        .mockResolvedValueOnce([]);
      mockLlmService.embed.mockResolvedValue([new Array(1536).fill(0.1)]);

      await service.search('query', ['kb-1'], 'ws-1');

      const searchSql = mockDataSource.query.mock.calls[1][0] as string;
      expect(searchSql).toContain('vector(1536)');
      expect(searchSql).not.toContain('halfvec(1536)');
    });

    it('should skip KBs with unsupported embedding_dimension (no partial index)', async () => {
      // 999 차원은 SUPPORTED_EMBEDDING_DIMS 에 없으므로 partial HNSW 인덱스가 없다.
      // 새 차원이 추가되면 본 테스트는 다시 SUPPORTED 외 값으로 갱신한다.
      mockDataSource.query.mockResolvedValueOnce([
        makeKbRow({
          id: 'kb-1',
          embeddingModel: 'custom-model',
          embeddingDimension: 999,
        }),
      ]);

      const result = await service.search('query', ['kb-1'], 'ws-1');

      expect(result).toEqual([]);
      expect(mockLlmService.embed).not.toHaveBeenCalled();
    });

    it('should merge results across groups and respect topK', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          makeKbRow({ id: 'kb-1' }),
          makeKbRow({
            id: 'kb-2',
            embeddingModel: 'text-embedding-3-large',
            embeddingDimension: 3072,
          }),
        ])
        .mockImplementation((sql: string) => {
          if (sql.includes('vector_dims(dc.embedding) = 1536')) {
            return Promise.resolve([
              {
                chunkId: 'c1',
                documentId: 'd1',
                documentName: 'A.txt',
                content: 'a',
                metadata: {},
                score: '0.95',
              },
            ]);
          }
          if (sql.includes('vector_dims(dc.embedding) = 3072')) {
            return Promise.resolve([
              {
                chunkId: 'c2',
                documentId: 'd2',
                documentName: 'B.txt',
                content: 'b',
                metadata: {},
                score: '0.99',
              },
            ]);
          }
          return Promise.resolve([]);
        });

      mockLlmService.embed.mockImplementation(
        async (_cfg: unknown, _texts: string[], model: string) => {
          if (model === 'text-embedding-3-small') {
            return [new Array(1536).fill(0.1)];
          }
          return [new Array(3072).fill(0.1)];
        },
      );

      const result = await service.search('query', ['kb-1', 'kb-2'], 'ws-1', {
        topK: 1,
      });

      expect(result).toHaveLength(1);
      expect(result[0].chunkId).toBe('c2');
      expect(result[0].score).toBeCloseTo(0.99);
    });
  });

  describe('search (graph mode)', () => {
    it('routes graph KB through searchGraphKb (Hybrid SQL with seed/expanded CTEs)', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          makeKbRow({
            id: 'kb-1',
            ragMode: 'graph',
            maxHops: 2,
            vectorSeedTopK: 3,
            expandedChunkLimit: 7,
          }),
        ])
        .mockResolvedValueOnce([
          {
            chunkId: 'c1',
            documentId: 'd1',
            documentName: 'A.txt',
            content: 'seed chunk',
            metadata: {},
            score: '0.91',
            origin: 'seed',
          },
        ])
        .mockResolvedValueOnce([{ count: 5 }]); // traversed entity count

      mockLlmService.embed.mockResolvedValue([new Array(1536).fill(0.1)]);

      const { results, graphTraversal } = await service.searchWithMeta(
        'query',
        ['kb-1'],
        'ws-1',
        { topK: 5 },
      );

      const graphSql = mockDataSource.query.mock.calls[1][0] as string;
      // expanded_entities CTE 가 자기 자신을 참조하므로 WITH RECURSIVE 가 필수.
      // PostgreSQL 은 RECURSIVE 가 없으면 self-reference 를 외부 relation 으로 해석해
      // "relation 'expanded_entities' does not exist" 로 실패한다.
      expect(graphSql).toContain('WITH RECURSIVE seed AS');
      expect(graphSql).toContain('expanded_entities');
      expect(graphSql).toContain('chunk_entity');

      // traversed entity count 메타 SQL 도 동일하게 재귀 CTE — RECURSIVE 키워드 누락 시
      // "relation 'expanded' does not exist" 로 실패한다.
      const metaSql = mockDataSource.query.mock.calls[2][0] as string;
      expect(metaSql).toContain('WITH RECURSIVE seed_entities AS');
      expect(metaSql).toMatch(/expanded\s+AS/);

      expect(results).toHaveLength(1);
      expect(results[0].origin).toBe('seed');
      expect(graphTraversal).toEqual(
        expect.objectContaining({
          mode: 'graph',
          seedChunkCount: 1,
          traversedEntityCount: 5,
          maxDepth: 2,
        }),
      );
    });

    it('skips graph KB with null embedding_dimension', async () => {
      mockDataSource.query.mockResolvedValueOnce([
        makeKbRow({
          id: 'kb-1',
          ragMode: 'graph',
          embeddingDimension: null,
        }),
      ]);

      const result = await service.search('query', ['kb-1'], 'ws-1');
      expect(result).toEqual([]);
      expect(mockLlmService.embed).not.toHaveBeenCalled();
    });

    it('returns empty graphTraversal when no graph KB participates', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([makeKbRow({ id: 'kb-1' })])
        .mockResolvedValueOnce([]);
      mockLlmService.embed.mockResolvedValue([new Array(1536).fill(0.1)]);

      const { graphTraversal } = await service.searchWithMeta(
        'query',
        ['kb-1'],
        'ws-1',
      );
      expect(graphTraversal).toBeUndefined();
    });
  });

  describe('buildContext', () => {
    it('should return empty context for no results', () => {
      const result = service.buildContext([]);
      expect(result.context).toBe('');
      expect(result.sources).toEqual([]);
    });

    it('should format context string correctly', () => {
      const results = [
        {
          chunkId: 'c1',
          documentId: 'doc-1',
          documentName: 'Manual.txt',
          content: 'This is relevant content about the topic.',
          score: 0.92,
          metadata: {},
        },
      ];

      const result = service.buildContext(results);
      expect(result.context).toContain('### Relevant Knowledge');
      expect(result.context).toContain('[Source: Manual.txt]');
      expect(result.context).toContain('relevance: 0.92');
      expect(result.context).toContain(
        'This is relevant content about the topic.',
      );
      expect(result.sources).toHaveLength(1);
    });
  });

  describe('search (cross_encoder rerank)', () => {
    function wideRow(i: number, score: number) {
      return {
        chunkId: `c${i}`,
        documentId: `d${i}`,
        documentName: `Doc ${i}`,
        content: `content ${i}`,
        score: String(score),
        metadata: {},
      };
    }

    it('단일 KB cross_encoder: wide 회수(cosine 임계 0) 후 RerankService 위임 + 리랭크 결과/진단 반환', async () => {
      mockDataSource.query
        // 1) KB 메타
        .mockResolvedValueOnce([
          makeKbRow({
            id: 'kb-1',
            rerankMode: 'cross_encoder',
            rerankConfigId: 'rc-1',
            rerankCandidateK: 50,
          }),
        ])
        // 2) wide vector 회수 (후보 3건)
        .mockResolvedValueOnce([
          wideRow(1, 0.6),
          wideRow(2, 0.55),
          wideRow(3, 0.5),
        ]);
      mockLlmService.embed.mockResolvedValue([new Array(1536).fill(0.1)]);

      mockRerankService.rerankCandidates.mockResolvedValue({
        results: [
          {
            chunkId: 'c3',
            documentId: 'd3',
            documentName: 'Doc 3',
            content: 'content 3',
            score: 0.95,
            metadata: {},
            origin: 'reranked',
          },
          {
            chunkId: 'c1',
            documentId: 'd1',
            documentName: 'Doc 1',
            content: 'content 1',
            score: 0.8,
            metadata: {},
            origin: 'reranked',
          },
        ],
        diagnostics: {
          mode: 'cross_encoder',
          candidateCount: 3,
          returnedCount: 2,
          llmGradingApplied: false,
          cutoffApplied: false,
          error: null,
        },
      });

      const result = await service.searchWithMeta('q', ['kb-1'], 'ws-1', {
        topK: 5,
      });

      // wide 회수 SQL 은 threshold 0, LIMIT candidateK(50) 로 호출돼야 한다.
      const vectorCall = mockDataSource.query.mock.calls[1];
      expect(vectorCall[1]).toEqual(
        expect.arrayContaining([0, 50]), // $3 threshold=0, $4 topK=candidateK
      );

      expect(mockRerankService.rerankCandidates).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'q',
          workspaceId: 'ws-1',
          rerankConfigId: 'rc-1',
          topK: 5,
          // rerankScoreThreshold=null → 런타임 threshold(default 0.7) fallback (R1).
          scoreThreshold: 0.7,
          mode: 'cross_encoder',
          candidates: expect.arrayContaining([
            expect.objectContaining({ chunkId: 'c1' }),
          ]),
        }),
      );

      expect(result.results.map((r) => r.chunkId)).toEqual(['c3', 'c1']);
      expect(result.results[0].origin).toBe('reranked');
      expect(result.rerank).toEqual(
        expect.objectContaining({ mode: 'cross_encoder', returnedCount: 2 }),
      );
    });

    it('후보 0건이면 RerankService 호출 없이 빈 결과 + 진단 반환', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          makeKbRow({ id: 'kb-1', rerankMode: 'cross_encoder' }),
        ])
        .mockResolvedValueOnce([]); // wide 회수 0건
      mockLlmService.embed.mockResolvedValue([new Array(1536).fill(0.1)]);

      const result = await service.searchWithMeta('q', ['kb-1'], 'ws-1');

      expect(mockRerankService.rerankCandidates).not.toHaveBeenCalled();
      expect(result.results).toEqual([]);
      expect(result.rerank?.candidateCount).toBe(0);
    });

    it('R1: rerankScoreThreshold(KB 설정) 가 있으면 그것을 우선해 scoreThreshold 로 전달', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          makeKbRow({
            id: 'kb-1',
            rerankMode: 'cross_encoder',
            rerankScoreThreshold: 0.42,
          }),
        ])
        .mockResolvedValueOnce([wideRow(1, 0.6)]);
      mockLlmService.embed.mockResolvedValue([new Array(1536).fill(0.1)]);
      mockRerankService.rerankCandidates.mockResolvedValue({
        results: [],
        diagnostics: {
          mode: 'cross_encoder',
          candidateCount: 1,
          returnedCount: 0,
          llmGradingApplied: false,
          cutoffApplied: true,
          error: null,
        },
      });

      // 런타임 threshold(0.9)를 넘겨도 KB 설정(0.42)이 우선해야 한다.
      await service.searchWithMeta('q', ['kb-1'], 'ws-1', {
        topK: 5,
        threshold: 0.9,
      });

      expect(mockRerankService.rerankCandidates).toHaveBeenCalledWith(
        expect.objectContaining({ scoreThreshold: 0.42 }),
      );
    });

    it('R1: rerankScoreThreshold 미설정(NULL)이면 런타임/LLM threshold 로 fallback', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          makeKbRow({
            id: 'kb-1',
            rerankMode: 'cross_encoder',
            rerankScoreThreshold: null,
          }),
        ])
        .mockResolvedValueOnce([wideRow(1, 0.6)]);
      mockLlmService.embed.mockResolvedValue([new Array(1536).fill(0.1)]);
      mockRerankService.rerankCandidates.mockResolvedValue({
        results: [],
        diagnostics: {
          mode: 'cross_encoder',
          candidateCount: 1,
          returnedCount: 0,
          llmGradingApplied: false,
          cutoffApplied: true,
          error: null,
        },
      });

      await service.searchWithMeta('q', ['kb-1'], 'ws-1', {
        topK: 5,
        threshold: 0.33,
      });

      expect(mockRerankService.rerankCandidates).toHaveBeenCalledWith(
        expect.objectContaining({ scoreThreshold: 0.33 }),
      );
    });

    it('R2: cross_encoder_llm 도 cross-encoder 재점수화 분기를 타고 mode 가 진단에 보존됨 (cosine 무음 강등 아님)', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          makeKbRow({
            id: 'kb-1',
            rerankMode: 'cross_encoder_llm',
            rerankConfigId: 'rc-1',
          }),
        ])
        .mockResolvedValueOnce([wideRow(1, 0.6), wideRow(2, 0.55)]);
      mockLlmService.embed.mockResolvedValue([new Array(1536).fill(0.1)]);
      mockRerankService.rerankCandidates.mockResolvedValue({
        results: [
          {
            chunkId: 'c1',
            documentId: 'd1',
            documentName: 'Doc 1',
            content: 'content 1',
            score: 0.9,
            metadata: {},
            origin: 'reranked',
          },
        ],
        diagnostics: {
          mode: 'cross_encoder_llm',
          candidateCount: 2,
          returnedCount: 1,
          llmGradingApplied: false,
          cutoffApplied: false,
          error: null,
        },
      });

      const result = await service.searchWithMeta('q', ['kb-1'], 'ws-1', {
        topK: 5,
      });

      // cross-encoder 레이어를 통째로 skip 하지 않고 RerankService 로 위임돼야 한다.
      expect(mockRerankService.rerankCandidates).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'cross_encoder_llm' }),
      );
      expect(result.rerank?.mode).toBe('cross_encoder_llm');
      // LLM grading 단계는 후속 — breadcrumb 으로 false 노출 (무음 강등 아님).
      expect(result.rerank?.llmGradingApplied).toBe(false);
    });

    it('R2: cross_encoder_llm 후보 0건이어도 진단 mode 가 cross_encoder_llm 로 노출', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          makeKbRow({ id: 'kb-1', rerankMode: 'cross_encoder_llm' }),
        ])
        .mockResolvedValueOnce([]);
      mockLlmService.embed.mockResolvedValue([new Array(1536).fill(0.1)]);

      const result = await service.searchWithMeta('q', ['kb-1'], 'ws-1');

      expect(mockRerankService.rerankCandidates).not.toHaveBeenCalled();
      expect(result.rerank?.mode).toBe('cross_encoder_llm');
    });

    it('멀티 KB 면 cross_encoder 라도 리랭크 분기를 타지 않는다 (후속)', async () => {
      mockDataSource.query.mockResolvedValue([]); // 메타 빈 → 일반 경로
      mockDataSource.query
        .mockResolvedValueOnce([
          makeKbRow({ id: 'kb-1', rerankMode: 'cross_encoder' }),
          makeKbRow({ id: 'kb-2', rerankMode: 'cross_encoder' }),
        ])
        .mockResolvedValue([]);
      mockLlmService.embed.mockResolvedValue([new Array(1536).fill(0.1)]);

      await service.searchWithMeta('q', ['kb-1', 'kb-2'], 'ws-1');

      expect(mockRerankService.rerankCandidates).not.toHaveBeenCalled();
    });
  });
});
