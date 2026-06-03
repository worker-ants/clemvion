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
  let createQueryBuilder: jest.Mock;

  beforeEach(async () => {
    getRawOne = jest.fn();
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
    };
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

    // createQueryBuilder + getRawOne 각 1회만 호출 (중복 쿼리 제거 검증)
    expect(createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(getRawOne).toHaveBeenCalledTimes(1);

    // workflowId 분기는 추가 andWhere 가 없어야 한다.
    const workflowIdCalls = andWhere.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('e.workflow_id'),
    );
    expect(workflowIdCalls).toHaveLength(0);

    expect(summary.totalExecutions).toBe(10);
    expect(summary.successCount).toBe(7);
    expect(summary.successRate).toBe(70); // 백분율 단위
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

    // 첫번째 PR 에서 두 번 쿼리하던 중복 실행 회귀 방지.
    expect(createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(getRawOne).toHaveBeenCalledTimes(1);

    // workflowId 조건이 정확히 한 번 추가됐는지 검증.
    const workflowIdCalls = andWhere.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('e.workflow_id'),
    );
    expect(workflowIdCalls).toHaveLength(1);
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
