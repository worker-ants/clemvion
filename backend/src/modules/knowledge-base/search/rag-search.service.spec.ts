import { RagSearchService } from './rag-search.service';

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

  describe('search', () => {
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
      mockDataSource.query.mockResolvedValueOnce([
        {
          id: 'kb-1',
          embeddingModel: 'text-embedding-3-small',
          embeddingDimension: 1536,
        },
      ]);
      mockLlmService.resolveConfig.mockRejectedValue(
        new Error('Config not found'),
      );

      const result = await service.search('query', ['kb-1'], 'ws-1');
      expect(result).toEqual([]);
    });

    it("should pass each KB's embeddingModel to llmService.embed", async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          {
            id: 'kb-1',
            embeddingModel: 'text-embedding-3-large',
            embeddingDimension: 3072,
          },
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
          {
            id: 'kb-1',
            embeddingModel: 'text-embedding-3-small',
            embeddingDimension: 1536,
          },
          {
            id: 'kb-2',
            embeddingModel: 'text-embedding-3-large',
            embeddingDimension: 3072,
          },
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
        {
          id: 'kb-1',
          embeddingModel: 'text-embedding-3-small',
          embeddingDimension: null,
        },
      ]);

      const result = await service.search('query', ['kb-1'], 'ws-1');

      expect(result).toEqual([]);
      expect(mockLlmService.embed).not.toHaveBeenCalled();
    });

    it('should skip KBs with unsupported embedding_dimension (no partial index)', async () => {
      mockDataSource.query.mockResolvedValueOnce([
        {
          id: 'kb-1',
          embeddingModel: 'custom-model',
          embeddingDimension: 512, // not in SUPPORTED_EMBEDDING_DIMS
        },
      ]);

      const result = await service.search('query', ['kb-1'], 'ws-1');

      expect(result).toEqual([]);
      expect(mockLlmService.embed).not.toHaveBeenCalled();
    });

    it('should merge results across groups and respect topK', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          {
            id: 'kb-1',
            embeddingModel: 'text-embedding-3-small',
            embeddingDimension: 1536,
          },
          {
            id: 'kb-2',
            embeddingModel: 'text-embedding-3-large',
            embeddingDimension: 3072,
          },
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
