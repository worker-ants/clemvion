import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LlmUsageLogService } from './llm-usage-log.service';
import { LlmUsageLog } from './entities/llm-usage-log.entity';
import { BusinessMetricsService } from '../metrics/business-metrics.service';

describe('LlmUsageLogService', () => {
  let service: LlmUsageLogService;
  let insert: jest.Mock;
  let recordLlmTokens: jest.Mock;

  beforeEach(async () => {
    insert = jest.fn().mockResolvedValue({});
    recordLlmTokens = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        LlmUsageLogService,
        {
          provide: getRepositoryToken(LlmUsageLog),
          useValue: { insert },
        },
        {
          provide: BusinessMetricsService,
          useValue: { recordLlmTokens },
        },
      ],
    }).compile();
    service = moduleRef.get(LlmUsageLogService);
  });

  it('NF-OB-07: 토큰 사용량 메트릭을 기록한다 (DB insert 와 무관)', async () => {
    const usage = { inputTokens: 12, outputTokens: 8, totalTokens: 20 };
    await service.record({
      workspaceId: 'ws-1',
      provider: 'openai',
      model: 'gpt-4o',
      usage,
    });
    expect(recordLlmTokens).toHaveBeenCalledWith('gpt-4o', usage);
  });

  it('insert 실패 시에도 메트릭은 기록된다', async () => {
    insert.mockRejectedValueOnce(new Error('db down'));
    await service.record({
      workspaceId: 'ws-1',
      provider: 'openai',
      model: 'gpt-4o',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    });
    expect(recordLlmTokens).toHaveBeenCalledTimes(1);
  });

  it('알려진 모델은 비용을 함께 저장한다', async () => {
    await service.record({
      workspaceId: 'ws-1',
      provider: 'openai',
      model: 'gpt-4o-mini',
      usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
    });
    expect(insert).toHaveBeenCalledTimes(1);
    const args = insert.mock.calls[0][0];
    expect(args.workspaceId).toBe('ws-1');
    expect(args.provider).toBe('openai');
    expect(args.model).toBe('gpt-4o-mini');
    expect(args.promptTokens).toBe(1000);
    expect(args.completionTokens).toBe(500);
    expect(args.totalTokens).toBe(1500);
    expect(args.costUsd).not.toBeNull();
    expect(Number(args.costUsd)).toBeGreaterThan(0);
  });

  it('미등록 모델은 cost가 null', async () => {
    await service.record({
      workspaceId: 'ws-1',
      provider: 'unknown',
      model: 'mystery-1',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });
    const args = insert.mock.calls[0][0];
    expect(args.costUsd).toBeNull();
  });

  it('insert가 실패해도 throw하지 않고 경고만 남긴다', async () => {
    insert.mockRejectedValueOnce(new Error('db down'));
    await expect(
      service.record({
        workspaceId: 'ws-1',
        provider: 'openai',
        model: 'gpt-4o',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      }),
    ).resolves.toBeUndefined();
  });
});
