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
}

describe('RagSearchService', () => {
  let service: RagSearchService;
  let mockDataSource: Record<string, jest.Mock>;
  let mockLlmService: Record<string, jest.Mock>;

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

    service = new RagSearchService(
      mockDataSource as never,
      mockLlmService as never,
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
      mockDataSource.query.mockResolvedValueOnce([
        makeKbRow({
          id: 'kb-1',
          embeddingModel: 'custom-model',
          embeddingDimension: 512,
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
      expect(graphSql).toContain('WITH seed AS');
      expect(graphSql).toContain('expanded_entities');
      expect(graphSql).toContain('chunk_entity');

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
});
