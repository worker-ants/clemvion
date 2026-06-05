import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RerankService, RerankCandidate } from './rerank.service';
import { RerankConfigService } from '../../rerank-config/rerank-config.service';
import { RerankClientFactory } from '../../llm/rerank/rerank-client.factory';
import { LlmService } from '../../llm/llm.service';

describe('RerankService', () => {
  let service: RerankService;
  let configService: {
    resolveConfig: jest.Mock;
    getDecryptedApiKey: jest.Mock;
  };
  let factory: { create: jest.Mock };
  let client: { rerank: jest.Mock };
  let llmService: { resolveConfig: jest.Mock; chat: jest.Mock };

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
    llmService = {
      resolveConfig: jest
        .fn()
        .mockResolvedValue({ id: 'lc1', defaultModel: 'gpt-4o' }),
      chat: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RerankService,
        { provide: RerankConfigService, useValue: configService },
        { provide: RerankClientFactory, useValue: factory },
        { provide: LlmService, useValue: llmService },
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
      mode: 'cross_encoder',
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
      mode: 'cross_encoder',
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
      mode: 'cross_encoder',
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
      mode: 'cross_encoder',
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
      mode: 'cross_encoder',
    });

    expect(res.results.map((r) => r.chunkId)).toEqual(['c0', 'c1', 'c2']);
    expect(res.diagnostics.error).toBe('RERANK_CONFIG_INVALID');
    expect(factory.create).not.toHaveBeenCalled();
  });

  it('falls back with RERANK_NO_VALID_RESULTS when all indices are out of range (R4)', async () => {
    // 모든 index 가 후보 범위 밖 → 유효 결과 0건 → cosine 강등.
    client.rerank.mockResolvedValueOnce([
      { index: 99, score: 0.9 },
      { index: -1, score: 0.8 },
    ]);

    const res = await service.rerankCandidates({
      query: 'q',
      candidates,
      workspaceId: 'ws1',
      rerankConfigId: null,
      topK: 10,
      scoreThreshold: null,
      mode: 'cross_encoder',
    });

    expect(res.results.map((r) => r.chunkId)).toEqual(['c0', 'c1', 'c2']);
    expect(res.diagnostics.error).toBe('RERANK_NO_VALID_RESULTS');
  });

  it('preserves cross_encoder_llm mode in diagnostics (no silent downgrade, R2)', async () => {
    client.rerank.mockResolvedValueOnce([{ index: 0, score: 0.9 }]);

    const res = await service.rerankCandidates({
      query: 'q',
      candidates,
      workspaceId: 'ws1',
      rerankConfigId: null,
      topK: 10,
      scoreThreshold: null,
      mode: 'cross_encoder_llm',
    });

    expect(res.diagnostics.mode).toBe('cross_encoder_llm');
    // LLM grading 단계는 후속 — false breadcrumb.
    expect(res.diagnostics.llmGradingApplied).toBe(false);
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
      mode: 'cross_encoder',
    });

    expect(res.results).toHaveLength(1);
    expect(res.results[0].chunkId).toBe('c0');
  });

  describe('cross_encoder_llm — listwise LLM grading', () => {
    beforeEach(() => {
      // cross-encoder: c0,c1,c2 순서 그대로 점수화.
      client.rerank.mockResolvedValue([
        { index: 0, score: 0.9 },
        { index: 1, score: 0.8 },
        { index: 2, score: 0.7 },
      ]);
    });

    it('cross-encoder survivors 를 LLM ranking 으로 재정렬 + 점수(1-10→0-1) 치환', async () => {
      // LLM: survivor 1-based id 기준 c2(3) best, c0(1) 다음. c1 은 누락(무관).
      llmService.chat.mockResolvedValueOnce({
        content: '{"ranking":[{"id":3,"score":9},{"id":1,"score":7}]}',
      });

      const res = await service.rerankCandidates({
        query: 'q',
        candidates,
        workspaceId: 'ws1',
        rerankConfigId: null,
        rerankLlmConfigId: 'lc1',
        topK: 10,
        scoreThreshold: null,
        mode: 'cross_encoder_llm',
      });

      expect(llmService.chat).toHaveBeenCalledTimes(1);
      expect(res.results.map((r) => r.chunkId)).toEqual(['c2', 'c0']);
      expect(res.results[0].score).toBeCloseTo(0.9); // 9/10
      expect(res.diagnostics.llmGradingApplied).toBe(true);
      expect(res.diagnostics.error).toBeNull();
    });

    it('LLM 파싱 실패 시 cross-encoder 결과 유지 + RERANK_LLM_GRADING_FAILED (throw 없음)', async () => {
      llmService.chat.mockResolvedValueOnce({ content: 'not json at all' });

      const res = await service.rerankCandidates({
        query: 'q',
        candidates,
        workspaceId: 'ws1',
        rerankConfigId: null,
        rerankLlmConfigId: 'lc1',
        topK: 10,
        scoreThreshold: null,
        mode: 'cross_encoder_llm',
      });

      // cross-encoder 순서 유지 (c0,c1,c2), 전체 cosine 강등 아님.
      expect(res.results.map((r) => r.chunkId)).toEqual(['c0', 'c1', 'c2']);
      expect(res.diagnostics.llmGradingApplied).toBe(false);
      expect(res.diagnostics.error).toBe('RERANK_LLM_GRADING_FAILED');
    });

    it('LLM chat 호출 자체가 throw 해도 cross-encoder 결과로 graceful', async () => {
      llmService.chat.mockRejectedValueOnce(new Error('llm down'));

      const res = await service.rerankCandidates({
        query: 'q',
        candidates,
        workspaceId: 'ws1',
        rerankConfigId: null,
        rerankLlmConfigId: null,
        topK: 10,
        scoreThreshold: null,
        mode: 'cross_encoder_llm',
      });

      expect(res.results.map((r) => r.chunkId)).toEqual(['c0', 'c1', 'c2']);
      expect(res.diagnostics.llmGradingApplied).toBe(false);
      expect(res.diagnostics.error).toBe('RERANK_LLM_GRADING_FAILED');
    });

    it('cross_encoder 모드는 LLM grading 을 호출하지 않는다', async () => {
      const res = await service.rerankCandidates({
        query: 'q',
        candidates,
        workspaceId: 'ws1',
        rerankConfigId: null,
        topK: 10,
        scoreThreshold: null,
        mode: 'cross_encoder',
      });

      expect(llmService.chat).not.toHaveBeenCalled();
      expect(res.diagnostics.llmGradingApplied).toBe(false);
      expect(res.diagnostics.error).toBeNull();
    });
  });
});
