import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StatisticsService } from './statistics.service';
import { Workflow } from '../workflows/entities/workflow.entity';
import { Execution } from '../executions/entities/execution.entity';
import { NodeExecution } from '../node-executions/entities/node-execution.entity';
import { LlmUsageLog } from '../llm/entities/llm-usage-log.entity';

describe('StatisticsService.getSummary', () => {
  let service: StatisticsService;
  let andWhere: jest.Mock;
  let where: jest.Mock;
  let select: jest.Mock;
  let innerJoin: jest.Mock;
  let getRawOne: jest.Mock;
  let getCount: jest.Mock;
  let createQueryBuilder: jest.Mock;

  beforeEach(async () => {
    getRawOne = jest.fn();
    getCount = jest.fn().mockResolvedValue(0);
    andWhere = jest.fn().mockImplementation(() => qb);
    where = jest.fn().mockImplementation(() => qb);
    select = jest.fn().mockImplementation(() => qb);
    innerJoin = jest.fn().mockImplementation(() => qb);
    const qb = {
      innerJoin,
      select,
      where,
      andWhere,
      getRawOne,
      getCount,
    };
    // getSummary 는 현재 구간(getRawOne) + 직전 구간(getCount) 2개의 QB 를 만든다.
    createQueryBuilder = jest.fn().mockReturnValue(qb);

    const moduleRef = await Test.createTestingModule({
      providers: [
        StatisticsService,
        {
          provide: getRepositoryToken(Workflow),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Execution),
          useValue: { createQueryBuilder },
        },
        {
          provide: getRepositoryToken(NodeExecution),
          useValue: {},
        },
        {
          provide: getRepositoryToken(LlmUsageLog),
          useValue: {},
        },
      ],
    }).compile();

    service = moduleRef.get(StatisticsService);
  });

  it('workflowId 미지정 — workspace 전체 집계, 쿼리 1회 실행', async () => {
    getRawOne.mockResolvedValue({
      totalExecutions: 10,
      successCount: 7,
      failedCount: 2,
      cancelledCount: 1,
      avgDurationMs: 250.5,
    });

    const summary = await service.getSummary('ws-1', {});

    // 현재 구간 집계(getRawOne) + 직전 구간 카운트(getCount) 로 QB 2개.
    expect(createQueryBuilder).toHaveBeenCalledTimes(2);
    expect(getRawOne).toHaveBeenCalledTimes(1);
    expect(getCount).toHaveBeenCalledTimes(1);

    // workflowId 분기는 추가 andWhere 가 없어야 한다.
    const workflowIdCalls = andWhere.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('e.workflow_id'),
    );
    expect(workflowIdCalls).toHaveLength(0);

    expect(summary.totalExecutions).toBe(10);
    expect(summary.successCount).toBe(7);
    expect(summary.successRate).toBe(70); // 백분율 단위
    // 직전 구간 실행 0 → 증감률 null.
    expect(summary.totalExecutionsChangeRate).toBeNull();
  });

  it('workflowId 지정 — 단일 쿼리에 e.workflow_id 조건 추가, 중복 쿼리 미발생', async () => {
    getRawOne.mockResolvedValue({
      totalExecutions: 4,
      successCount: 4,
      failedCount: 0,
      cancelledCount: 0,
      avgDurationMs: 100,
    });

    const summary = await service.getSummary('ws-1', { workflowId: 'wf-A' });

    // 현재 구간 + 직전 구간 QB 2개 (각 구간당 단일 쿼리).
    expect(createQueryBuilder).toHaveBeenCalledTimes(2);
    expect(getRawOne).toHaveBeenCalledTimes(1);
    expect(getCount).toHaveBeenCalledTimes(1);

    // workflowId 조건이 현재·직전 구간에 각각 한 번씩 추가됐는지 검증.
    const workflowIdCalls = andWhere.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('e.workflow_id'),
    );
    expect(workflowIdCalls).toHaveLength(2);
    expect(workflowIdCalls[0][1]).toEqual({ workflowId: 'wf-A' });

    expect(summary.totalExecutions).toBe(4);
    expect(summary.successRate).toBe(100);
  });

  it('getRawOne 가 빈 결과를 반환하면 buildSummary 가 모두 0/null 반환', async () => {
    getRawOne.mockResolvedValue(undefined);

    const summary = await service.getSummary('ws-1', { workflowId: 'wf-Z' });

    expect(summary).toMatchObject({
      totalExecutions: 0,
      successCount: 0,
      failedCount: 0,
      cancelledCount: 0,
      successRate: 0,
      avgDurationMs: 0,
    });
  });

  it('직전 구간 실행이 있으면 증감률(%)을 계산한다', async () => {
    getRawOne.mockResolvedValue({
      totalExecutions: 120,
      successCount: 100,
      failedCount: 15,
      cancelledCount: 5,
      avgDurationMs: 200,
    });
    getCount.mockResolvedValue(100); // 직전 구간 100건

    const summary = await service.getSummary('ws-1', { period: '7d' });

    // (120 - 100) / 100 * 100 = 20%
    expect(summary.totalExecutionsChangeRate).toBe(20);
  });

  it('직전 구간 대비 감소도 음수 증감률로 표현한다', async () => {
    getRawOne.mockResolvedValue({
      totalExecutions: 75,
      successCount: 70,
      failedCount: 5,
      cancelledCount: 0,
      avgDurationMs: 200,
    });
    getCount.mockResolvedValue(100);

    const summary = await service.getSummary('ws-1', { period: '30d' });

    // (75 - 100) / 100 * 100 = -25%
    expect(summary.totalExecutionsChangeRate).toBe(-25);
  });

  it('직전 구간을 현재 범위와 동일 길이의 직전 윈도우로 잡는다', async () => {
    getRawOne.mockResolvedValue({
      totalExecutions: 10,
      successCount: 10,
      failedCount: 0,
      cancelledCount: 0,
      avgDurationMs: 0,
    });
    getCount.mockResolvedValue(5);

    await service.getSummary('ws-1', { period: '7d' });

    const startCall = andWhere.mock.calls.find(
      ([sql]) =>
        typeof sql === 'string' && sql.includes('e.started_at >= :startDate'),
    );
    const prevStartCall = andWhere.mock.calls.find(
      ([sql]) =>
        typeof sql === 'string' &&
        sql.includes('e.started_at >= :prevStartDate'),
    );
    const prevEndCall = andWhere.mock.calls.find(
      ([sql]) =>
        typeof sql === 'string' && sql.includes('e.started_at < :prevEndDate'),
    );
    expect(startCall).toBeDefined();
    expect(prevStartCall).toBeDefined();
    expect(prevEndCall).toBeDefined();

    const { startDate } = startCall![1] as { startDate: Date };
    const { prevStartDate } = prevStartCall![1] as { prevStartDate: Date };
    const { prevEndDate } = prevEndCall![1] as { prevEndDate: Date };

    // 직전 윈도우의 끝은 현재 윈도우의 시작과 일치.
    expect(prevEndDate.getTime()).toBe(startDate.getTime());
    // 직전 윈도우 길이 == 현재 윈도우(약 7일) 길이.
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const prevDuration = prevEndDate.getTime() - prevStartDate.getTime();
    expect(prevDuration).toBeGreaterThanOrEqual(7 * ONE_DAY - 5_000);
    expect(prevDuration).toBeLessThanOrEqual(7 * ONE_DAY + 5_000);
  });

  // C-9: '1d'(오늘) 프리셋이 프론트에만 있고 백엔드 enum/range 에 없어 거부되던 회귀 가드.
  it("period='1d' 는 약 1일 전 startDate 로 범위를 좁힌다", async () => {
    getRawOne.mockResolvedValue({
      totalExecutions: 0,
      successCount: 0,
      failedCount: 0,
      cancelledCount: 0,
      avgDurationMs: 0,
    });

    const after = Date.now();
    await service.getSummary('ws-1', { period: '1d' });

    const startCall = andWhere.mock.calls.find(
      ([sql]) =>
        typeof sql === 'string' && sql.includes('e.started_at >= :startDate'),
    );
    expect(startCall).toBeDefined();
    const { startDate } = startCall![1] as { startDate: Date };
    const diffMs = after - startDate.getTime();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    // 약 1일 (오차 허용). 기본 7일 구간과 명확히 구분된다.
    expect(diffMs).toBeGreaterThanOrEqual(ONE_DAY - 5_000);
    expect(diffMs).toBeLessThan(2 * ONE_DAY);
  });
});
