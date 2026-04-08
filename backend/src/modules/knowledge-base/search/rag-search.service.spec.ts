import { RagSearchService } from './rag-search.service';

describe('RagSearchService', () => {
  let service: RagSearchService;
  let mockDataSource: Record<string, jest.Mock>;
  let mockLlmService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockDataSource = {
      query: jest.fn().mockResolvedValue([]),
    };

    mockLlmService = {
      resolveConfig: jest.fn().mockResolvedValue({
        id: 'config-1',
        provider: 'openai',
        defaultModel: 'text-embedding-3-small',
      }),
      embed: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
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
      mockLlmService.resolveConfig.mockRejectedValue(
        new Error('Config not found'),
      );

      const result = await service.search('query', ['kb-1'], 'ws-1');
      expect(result).toEqual([]);
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
