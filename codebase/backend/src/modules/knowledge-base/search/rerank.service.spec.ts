import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RerankService, RerankCandidate, RerankParams } from './rerank.service';
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

  // injectCap(주입 ceiling) + tokenBudget(§3.4) default 를 채워주는 헬퍼.
  function params(overrides: Partial<RerankParams>): RerankParams {
    return {
      query: 'q',
      candidates,
      workspaceId: 'ws1',
      rerankConfigId: null,
      injectCap: 10,
      tokenBudget: 8000,
      scoreThreshold: null,
      mode: 'cross_encoder',
      ...overrides,
    };
  }

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

    const res = await service.rerankCandidates(params({}));

    expect(res.results.map((r) => r.chunkId)).toEqual(['c2', 'c0', 'c1']);
    expect(res.results[0].score).toBe(0.99);
    expect(res.results.every((r) => r.origin === 'reranked')).toBe(true);
    expect(res.diagnostics).toMatchObject({
      mode: 'cross_encoder',
      candidateCount: 3,
      returnedCount: 3,
      llmGradingApplied: false,
      gradingNoGrounding: false,
      cutoffApplied: false,
      error: null,
    });
    // 모든 후보를 재점수화 요청 (작은 topK 로 미리 굶기지 않음).
    expect(client.rerank).toHaveBeenCalledWith(
      'q',
      expect.any(Array),
      'bge-reranker-v2-m3',
      {
        topK: 3,
      },
    );
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

    const res = await service.rerankCandidates(params({ scoreThreshold: 0.4 }));

    expect(res.results.map((r) => r.chunkId)).toEqual(['c0', 'c1']);
    expect(res.diagnostics.cutoffApplied).toBe(true);
    expect(res.diagnostics.returnedCount).toBe(2);
  });

  it('inject-cap(maxCount) ceiling 으로 초과분 drop', async () => {
    client.rerank.mockResolvedValueOnce([
      { index: 0, score: 0.9 },
      { index: 1, score: 0.8 },
      { index: 2, score: 0.7 },
    ]);

    const res = await service.rerankCandidates(params({ injectCap: 2 }));

    expect(res.results).toHaveLength(2);
    expect(res.results.map((r) => r.chunkId)).toEqual(['c0', 'c1']);
    expect(res.diagnostics.cutoffApplied).toBe(true);
  });

  it('token-budget 초과 시 동적 컷 (cutoffApplied)', async () => {
    // 각 후보 content 를 크게 만들어 budget 으로 컷되게 한다.
    const big: RerankCandidate[] = [
      { chunkId: 'b0', content: 'x'.repeat(120), score: 0.9 }, // 40 tok
      { chunkId: 'b1', content: 'x'.repeat(120), score: 0.8 },
      { chunkId: 'b2', content: 'x'.repeat(120), score: 0.7 },
    ];
    client.rerank.mockResolvedValueOnce([
      { index: 0, score: 0.9 },
      { index: 1, score: 0.8 },
      { index: 2, score: 0.7 },
    ]);

    const res = await service.rerankCandidates(
      params({ candidates: big, tokenBudget: 50 }),
    );

    // 40 + 40 > 50 → 1개만 (최소 보장 + 다음에서 중단).
    expect(res.results).toHaveLength(1);
    expect(res.diagnostics.cutoffApplied).toBe(true);
  });

  it('falls back to cosine order with RERANK_ENDPOINT_FAILED on client error', async () => {
    client.rerank.mockRejectedValueOnce(new Error('endpoint down'));

    const res = await service.rerankCandidates(
      params({ scoreThreshold: 0.45 }),
    );

    // cosine desc: c0(0.5), c1(0.4), c2(0.3)
    expect(res.results.map((r) => r.chunkId)).toEqual(['c0', 'c1', 'c2']);
    expect(res.diagnostics.error).toBe('RERANK_ENDPOINT_FAILED');
    expect(res.diagnostics.cutoffApplied).toBe(false);
    expect(res.diagnostics.gradingNoGrounding).toBe(false);
  });

  it('falls back with RERANK_CONFIG_INVALID when config resolution fails', async () => {
    configService.resolveConfig.mockRejectedValueOnce(
      new BadRequestException({ code: 'RERANK_CONFIG_NOT_FOUND' }),
    );

    const res = await service.rerankCandidates(params({}));

    expect(res.results.map((r) => r.chunkId)).toEqual(['c0', 'c1', 'c2']);
    expect(res.diagnostics.error).toBe('RERANK_CONFIG_INVALID');
    expect(factory.create).not.toHaveBeenCalled();
  });

  it('falls back with RERANK_NO_VALID_RESULTS when all indices are out of range (R4)', async () => {
    client.rerank.mockResolvedValueOnce([
      { index: 99, score: 0.9 },
      { index: -1, score: 0.8 },
    ]);

    const res = await service.rerankCandidates(params({}));

    expect(res.results.map((r) => r.chunkId)).toEqual(['c0', 'c1', 'c2']);
    expect(res.diagnostics.error).toBe('RERANK_NO_VALID_RESULTS');
  });

  it('preserves cross_encoder_llm mode in diagnostics (no silent downgrade, R2)', async () => {
    // 단일 후보 + 높은 점수 → escalate 안 됨 → grading 미실행.
    client.rerank.mockResolvedValueOnce([{ index: 0, score: 0.9 }]);

    const res = await service.rerankCandidates(
      params({ mode: 'cross_encoder_llm' }),
    );

    expect(res.diagnostics.mode).toBe('cross_encoder_llm');
    expect(res.diagnostics.llmGradingApplied).toBe(false);
    expect(llmService.chat).not.toHaveBeenCalled();
  });

  it('never throws — fallback respects inject-cap', async () => {
    configService.resolveConfig.mockRejectedValueOnce(new Error('x'));

    const res = await service.rerankCandidates(params({ injectCap: 1 }));

    expect(res.results).toHaveLength(1);
    expect(res.results[0].chunkId).toBe('c0');
  });

  describe('cross_encoder_llm — conditional escalate + listwise grading', () => {
    // 평탄한 점수(top1-top2 상대격차 작음) → escalate 진입.
    function flatScores() {
      client.rerank.mockResolvedValue([
        { index: 0, score: 0.9 },
        { index: 1, score: 0.89 },
        { index: 2, score: 0.88 },
      ]);
    }

    it('escalate 진입 조건(평탄): survivors 를 LLM ranking 으로 재정렬 + 점수(1-10→0-1) 치환', async () => {
      flatScores();
      // LLM: survivor 1-based id 기준 c2(3) best, c0(1) 다음. c1 은 누락(무관).
      llmService.chat.mockResolvedValueOnce({
        content: '{"ranking":[{"id":3,"score":9},{"id":1,"score":7}]}',
      });

      const res = await service.rerankCandidates(
        params({ rerankLlmConfigId: 'lc1', mode: 'cross_encoder_llm' }),
      );

      expect(llmService.chat).toHaveBeenCalledTimes(1);
      expect(res.results.map((r) => r.chunkId)).toEqual(['c2', 'c0']);
      expect(res.results[0].score).toBeCloseTo(0.9); // 9/10
      expect(res.diagnostics.llmGradingApplied).toBe(true);
      expect(res.diagnostics.gradingNoGrounding).toBe(false);
      expect(res.diagnostics.error).toBeNull();
    });

    it('escalate 미진입(상위 점수 변별력 충분): grading 미실행, cross-encoder 결과 유지', async () => {
      // top=0.9, gap (0.9-0.5)/0.9=0.44 ≫ 0.05, top≥0.6 → escalate 안 함.
      client.rerank.mockResolvedValueOnce([
        { index: 0, score: 0.9 },
        { index: 1, score: 0.5 },
        { index: 2, score: 0.3 },
      ]);

      const res = await service.rerankCandidates(
        params({ rerankLlmConfigId: 'lc1', mode: 'cross_encoder_llm' }),
      );

      expect(llmService.chat).not.toHaveBeenCalled();
      expect(res.results.map((r) => r.chunkId)).toEqual(['c0', 'c1', 'c2']);
      expect(res.diagnostics.llmGradingApplied).toBe(false);
      expect(res.diagnostics.error).toBeNull();
    });

    it('escalate 진입(상위 점수 낮음/모호): grading 실행', async () => {
      // top=0.5 < 0.6 floor → escalate.
      client.rerank.mockResolvedValueOnce([
        { index: 0, score: 0.5 },
        { index: 1, score: 0.2 },
      ]);
      llmService.chat.mockResolvedValueOnce({
        content: '{"ranking":[{"id":1,"score":6}]}',
      });

      const res = await service.rerankCandidates(
        params({ rerankLlmConfigId: 'lc1', mode: 'cross_encoder_llm' }),
      );

      expect(llmService.chat).toHaveBeenCalledTimes(1);
      expect(res.diagnostics.llmGradingApplied).toBe(true);
    });

    it('grader 가 빈 ranking(모두 무관) → gradingNoGrounding=true, 결과 비움', async () => {
      flatScores();
      llmService.chat.mockResolvedValueOnce({ content: '{"ranking":[]}' });

      const res = await service.rerankCandidates(
        params({ rerankLlmConfigId: 'lc1', mode: 'cross_encoder_llm' }),
      );

      expect(res.results).toHaveLength(0);
      expect(res.diagnostics.llmGradingApplied).toBe(true);
      expect(res.diagnostics.gradingNoGrounding).toBe(true);
      expect(res.diagnostics.error).toBeNull();
    });

    it('LLM 파싱 실패 시 cross-encoder 결과 유지 + RERANK_LLM_GRADING_FAILED (no_grounding 와 구분)', async () => {
      flatScores();
      llmService.chat.mockResolvedValueOnce({ content: 'not json at all' });

      const res = await service.rerankCandidates(
        params({ rerankLlmConfigId: 'lc1', mode: 'cross_encoder_llm' }),
      );

      // cross-encoder 순서 유지, 전체 cosine 강등 아님.
      expect(res.results.map((r) => r.chunkId)).toEqual(['c0', 'c1', 'c2']);
      expect(res.diagnostics.llmGradingApplied).toBe(false);
      expect(res.diagnostics.gradingNoGrounding).toBe(false);
      expect(res.diagnostics.error).toBe('RERANK_LLM_GRADING_FAILED');
    });

    it('LLM chat 호출 자체가 throw 해도 cross-encoder 결과로 graceful', async () => {
      flatScores();
      llmService.chat.mockRejectedValueOnce(new Error('llm down'));

      const res = await service.rerankCandidates(
        params({ rerankLlmConfigId: null, mode: 'cross_encoder_llm' }),
      );

      expect(res.results.map((r) => r.chunkId)).toEqual(['c0', 'c1', 'c2']);
      expect(res.diagnostics.llmGradingApplied).toBe(false);
      expect(res.diagnostics.error).toBe('RERANK_LLM_GRADING_FAILED');
    });

    it('cross_encoder 모드는 LLM grading 을 호출하지 않는다', async () => {
      flatScores();
      const res = await service.rerankCandidates(
        params({ mode: 'cross_encoder' }),
      );

      expect(llmService.chat).not.toHaveBeenCalled();
      expect(res.diagnostics.llmGradingApplied).toBe(false);
      expect(res.diagnostics.error).toBeNull();
    });
  });
});
