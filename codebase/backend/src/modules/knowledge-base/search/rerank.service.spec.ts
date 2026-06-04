import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RerankService, RerankCandidate } from './rerank.service';
import { RerankConfigService } from '../../rerank-config/rerank-config.service';
import { RerankClientFactory } from '../../llm/rerank/rerank-client.factory';

describe('RerankService', () => {
  let service: RerankService;
  let configService: {
    resolveConfig: jest.Mock;
    getDecryptedApiKey: jest.Mock;
  };
  let factory: { create: jest.Mock };
  let client: { rerank: jest.Mock };

  const config = {
    id: 'rc1',
    provider: 'tei',
    defaultModel: 'bge-reranker-v2-m3',
    baseUrl: 'http://tei:8080',
    apiKey: null,
  };

  const candidates: RerankCandidate[] = [
    { chunkId: 'c0', content: 'doc zero', score: 0.5 },
    { chunkId: 'c1', content: 'doc one', score: 0.4 },
    { chunkId: 'c2', content: 'doc two', score: 0.3 },
  ];

  beforeEach(async () => {
    client = { rerank: jest.fn() };
    factory = { create: jest.fn(() => client) };
    configService = {
      resolveConfig: jest.fn().mockResolvedValue(config),
      getDecryptedApiKey: jest.fn().mockReturnValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RerankService,
        { provide: RerankConfigService, useValue: configService },
        { provide: RerankClientFactory, useValue: factory },
      ],
    }).compile();

    service = module.get<RerankService>(RerankService);
  });

  it('reorders candidates by rerank index and replaces score (happy path)', async () => {
    // rerank says: c2 best, then c0, then c1
    client.rerank.mockResolvedValueOnce([
      { index: 2, score: 0.99 },
      { index: 0, score: 0.7 },
      { index: 1, score: 0.6 },
    ]);

    const res = await service.rerankCandidates({
      query: 'q',
      candidates,
      workspaceId: 'ws1',
      rerankConfigId: null,
      topK: 10,
      scoreThreshold: null,
    });

    expect(res.results.map((r) => r.chunkId)).toEqual(['c2', 'c0', 'c1']);
    expect(res.results[0].score).toBe(0.99);
    expect(res.results.every((r) => r.origin === 'reranked')).toBe(true);
    expect(res.diagnostics).toMatchObject({
      mode: 'cross_encoder',
      candidateCount: 3,
      returnedCount: 3,
      llmGradingApplied: false,
      cutoffApplied: false,
      error: null,
    });
    // client built from resolved config
    expect(factory.create).toHaveBeenCalledWith({
      provider: 'tei',
      apiKey: undefined,
      defaultModel: 'bge-reranker-v2-m3',
      baseUrl: 'http://tei:8080',
    });
  });

  it('applies dynamic cutoff dropping below scoreThreshold', async () => {
    client.rerank.mockResolvedValueOnce([
      { index: 0, score: 0.9 },
      { index: 1, score: 0.5 },
      { index: 2, score: 0.1 },
    ]);

    const res = await service.rerankCandidates({
      query: 'q',
      candidates,
      workspaceId: 'ws1',
      rerankConfigId: null,
      topK: 10,
      scoreThreshold: 0.4,
    });

    expect(res.results.map((r) => r.chunkId)).toEqual(['c0', 'c1']);
    expect(res.diagnostics.cutoffApplied).toBe(true);
    expect(res.diagnostics.returnedCount).toBe(2);
  });

  it('slices to topK', async () => {
    client.rerank.mockResolvedValueOnce([
      { index: 0, score: 0.9 },
      { index: 1, score: 0.8 },
      { index: 2, score: 0.7 },
    ]);

    const res = await service.rerankCandidates({
      query: 'q',
      candidates,
      workspaceId: 'ws1',
      rerankConfigId: null,
      topK: 2,
      scoreThreshold: null,
    });

    expect(res.results).toHaveLength(2);
    expect(res.results.map((r) => r.chunkId)).toEqual(['c0', 'c1']);
  });

  it('falls back to cosine order with RERANK_ENDPOINT_FAILED on client error', async () => {
    client.rerank.mockRejectedValueOnce(new Error('endpoint down'));

    const res = await service.rerankCandidates({
      query: 'q',
      candidates,
      workspaceId: 'ws1',
      rerankConfigId: null,
      topK: 10,
      scoreThreshold: 0.45, // ignored on fallback
    });

    // cosine desc: c0(0.5), c1(0.4), c2(0.3)
    expect(res.results.map((r) => r.chunkId)).toEqual(['c0', 'c1', 'c2']);
    expect(res.diagnostics.error).toBe('RERANK_ENDPOINT_FAILED');
    expect(res.diagnostics.cutoffApplied).toBe(false);
  });

  it('falls back with RERANK_CONFIG_INVALID when config resolution fails', async () => {
    configService.resolveConfig.mockRejectedValueOnce(
      new BadRequestException({ code: 'RERANK_CONFIG_NOT_FOUND' }),
    );

    const res = await service.rerankCandidates({
      query: 'q',
      candidates,
      workspaceId: 'ws1',
      rerankConfigId: null,
      topK: 10,
      scoreThreshold: null,
    });

    expect(res.results.map((r) => r.chunkId)).toEqual(['c0', 'c1', 'c2']);
    expect(res.diagnostics.error).toBe('RERANK_CONFIG_INVALID');
    expect(factory.create).not.toHaveBeenCalled();
  });

  it('never throws — fallback respects topK slice', async () => {
    configService.resolveConfig.mockRejectedValueOnce(new Error('x'));

    const res = await service.rerankCandidates({
      query: 'q',
      candidates,
      workspaceId: 'ws1',
      rerankConfigId: null,
      topK: 1,
      scoreThreshold: null,
    });

    expect(res.results).toHaveLength(1);
    expect(res.results[0].chunkId).toBe('c0');
  });
});
