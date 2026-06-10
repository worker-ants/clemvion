import { DashboardService } from './dashboard.service';
import { ExecutionStatus } from '../executions/entities/execution.entity';

type FakeExec = {
  id: string;
  workflowId: string;
  workflow: { name: string };
  status: ExecutionStatus;
  startedAt: Date;
  durationMs: number | null;
  triggerId: string | null;
  executedBy: string | null;
  parentExecutionId: string | null;
  trigger: { id: string; type: string; name: string } | null;
  executor: { id: string; name: string | null } | null;
};

const baseFake = (overrides: Partial<FakeExec>): FakeExec => ({
  id: 'e0',
  workflowId: 'w1',
  workflow: { name: 'WF One' },
  status: ExecutionStatus.COMPLETED,
  startedAt: new Date('2026-05-04T10:00:00.000Z'),
  durationMs: 1000,
  triggerId: null,
  executedBy: null,
  parentExecutionId: null,
  trigger: null,
  executor: null,
  ...overrides,
});

describe('DashboardService.getSummary', () => {
  // perf #4 — 동일 범위 6쿼리 5왕복을 집계 2쿼리(workflow 1 + execution 1)로
  // 통합. 파생 계산(반올림·changePercent·분모 의미론)은 기존 로직 그대로다.
  let service: DashboardService;
  let executionRepo: { createQueryBuilder: jest.Mock; count?: jest.Mock };
  let workflowRepo: { createQueryBuilder: jest.Mock; count: jest.Mock };
  let wfQB: Record<string, jest.Mock>;
  let execQB: Record<string, jest.Mock>;

  const buildAggQB = (raw: Record<string, unknown>) => {
    const qb: Record<string, jest.Mock> = {};
    qb.select = jest.fn().mockReturnValue(qb);
    qb.addSelect = jest.fn().mockReturnValue(qb);
    qb.innerJoin = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.andWhere = jest.fn().mockReturnValue(qb);
    qb.setParameters = jest.fn().mockReturnValue(qb);
    qb.getRawOne = jest.fn().mockResolvedValue(raw);
    return qb;
  };

  const setup = (
    wfRaw: Record<string, unknown>,
    execRaw: Record<string, unknown>,
  ) => {
    wfQB = buildAggQB(wfRaw);
    execQB = buildAggQB(execRaw);
    workflowRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(wfQB),
      count: jest.fn(),
    };
    executionRepo = { createQueryBuilder: jest.fn().mockReturnValue(execQB) };
    service = new DashboardService(
      workflowRepo as never,
      executionRepo as never,
    );
  };

  it('workflow 1 + execution 1 — 총 2회 왕복으로 모든 summary 필드를 산출한다', async () => {
    setup(
      { total: '5', active: '2' },
      { total7d: '10', prev7d: '4', success7d: '7', avg7d: '123.6' },
    );

    const summary = await service.getSummary('ws-1');

    expect(summary).toEqual({
      totalWorkflows: 5,
      activeWorkflows: 2,
      runs7d: 10,
      runs7dPrevious: 4,
      runs7dChangePercent: 150,
      successRate: 70,
      avgExecutionTime: 124,
    });
    // 왕복 수 게이트: repo 별 QB 1회씩, count() 미사용.
    expect(workflowRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(executionRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(workflowRepo.count).not.toHaveBeenCalled();
  });

  it('분모 의미론 보존 — successRate 분모는 status 무관 7일 전체(total7d) FILTER 로 계산된다', async () => {
    setup(
      { total: '1', active: '1' },
      { total7d: '4', prev7d: '0', success7d: '1', avg7d: null },
    );

    const summary = await service.getSummary('ws-1');

    // 4건 중 1건 completed → 25% (분모가 completed 한정이면 100% 로 어긋남).
    expect(summary.successRate).toBe(25);
    // FILTER 절이 분모(전체)와 분자(completed 한정)를 분리해 표현하는지 확인.
    const selects = [
      ...execQB.select.mock.calls.map((c: unknown[]) => String(c[0])),
      ...execQB.addSelect.mock.calls.map((c: unknown[]) => String(c[0])),
    ].join('\n');
    expect(selects).toContain('FILTER');
    expect(selects).toMatch(/status/);
  });

  it('경계값: prev7d=0 → changePercent null, total7d=0 → successRate 0, avg null → 0', async () => {
    setup(
      { total: '0', active: '0' },
      { total7d: '0', prev7d: '0', success7d: '0', avg7d: null },
    );

    const summary = await service.getSummary('ws-1');

    expect(summary.runs7dChangePercent).toBeNull();
    expect(summary.successRate).toBe(0);
    expect(summary.avgExecutionTime).toBe(0);
  });

  it('getRawOne 이 undefined(이론상 빈 결과)여도 0 기본값으로 안전 처리한다', async () => {
    setup(
      undefined as unknown as Record<string, unknown>,
      undefined as unknown as Record<string, unknown>,
    );

    const summary = await service.getSummary('ws-1');

    expect(summary).toEqual({
      totalWorkflows: 0,
      activeWorkflows: 0,
      runs7d: 0,
      runs7dPrevious: 0,
      runs7dChangePercent: null,
      successRate: 0,
      avgExecutionTime: 0,
    });
  });
});

describe('DashboardService.getRecentExecutions', () => {
  let service: DashboardService;
  let executionRepo: { createQueryBuilder: jest.Mock };
  let workflowRepo: { count: jest.Mock };

  const buildListQB = (rows: FakeExec[]) => {
    const qb: Record<string, jest.Mock> = {};
    qb.innerJoin = jest.fn().mockReturnValue(qb);
    qb.leftJoin = jest.fn().mockReturnValue(qb);
    qb.addSelect = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.orderBy = jest.fn().mockReturnValue(qb);
    qb.limit = jest.fn().mockReturnValue(qb);
    qb.getMany = jest.fn().mockResolvedValue(rows);
    return qb;
  };

  type ParentRawRow = { parent_id: string; workflow_name: string | null };
  const buildParentNameQB = (rows: ParentRawRow[]) => {
    const qb: Record<string, jest.Mock> = {};
    qb.innerJoin = jest.fn().mockReturnValue(qb);
    qb.select = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.getRawMany = jest.fn().mockResolvedValue(rows);
    return qb;
  };

  beforeEach(() => {
    executionRepo = { createQueryBuilder: jest.fn() };
    workflowRepo = { count: jest.fn() };
    service = new DashboardService(
      workflowRepo as never,
      executionRepo as never,
    );
  });

  it('enriches each row with triggerSource/triggerLabel and never exposes email', async () => {
    const r1 = baseFake({
      id: 'e1',
      executedBy: 'u1',
      executor: { id: 'u1', name: 'Alice' },
    });
    const r2 = baseFake({
      id: 'e2',
      triggerId: 't1',
      trigger: { id: 't1', type: 'schedule', name: '매일 9시 보고서' },
    });
    const r3 = baseFake({
      id: 'e3',
      triggerId: 't2',
      trigger: { id: 't2', type: 'webhook', name: 'Stripe payment hook' },
    });
    executionRepo.createQueryBuilder.mockReturnValueOnce(
      buildListQB([r1, r2, r3]) as unknown,
    );

    const result = await service.getRecentExecutions('ws-1');

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      id: 'e1',
      triggerSource: 'manual',
      triggerLabel: 'Alice',
    });
    expect(result[1]).toMatchObject({
      id: 'e2',
      triggerSource: 'schedule',
      triggerLabel: '매일 9시 보고서',
    });
    expect(result[2]).toMatchObject({
      id: 'e3',
      triggerSource: 'webhook',
      triggerLabel: 'Stripe payment hook',
    });
    expect(JSON.stringify(result)).not.toMatch(/@/);
  });

  it('subworkflow rows: batch-loads parent workflow.name once and uses it as label', async () => {
    const c1 = baseFake({
      id: 'c1',
      workflowId: 'wChild',
      workflow: { name: 'Child WF' },
      parentExecutionId: 'p1',
    });
    const c2 = baseFake({
      id: 'c2',
      workflowId: 'wChild',
      workflow: { name: 'Child WF' },
      parentExecutionId: 'p2',
    });
    const parentNameQB = buildParentNameQB([
      { parent_id: 'p1', workflow_name: 'Parent A' },
      { parent_id: 'p2', workflow_name: 'Parent B' },
    ]);
    executionRepo.createQueryBuilder
      .mockReturnValueOnce(buildListQB([c1, c2]) as unknown)
      .mockReturnValueOnce(parentNameQB as unknown);

    const result = await service.getRecentExecutions('ws-1');
    expect(result.map((r) => [r.id, r.triggerLabel])).toEqual([
      ['c1', 'Parent A'],
      ['c2', 'Parent B'],
    ]);
    expect(parentNameQB.getRawMany).toHaveBeenCalledTimes(1);
  });

  it('uses entity property name for orderBy (not DB column name)', async () => {
    const listQB = buildListQB([]);
    executionRepo.createQueryBuilder.mockReturnValueOnce(listQB as unknown);

    await service.getRecentExecutions('ws-1');
    // 정렬 필드는 e.startedAt (camelCase). e.started_at 으로 넘기면
    // leftJoin 조합에서 TypeORM databaseName lookup 실패가 재발한다.
    expect(listQB.orderBy).toHaveBeenCalledWith('e.startedAt', 'DESC');
  });

  it('returns empty array without parent batch query when there are no executions', async () => {
    const listQB = buildListQB([]);
    executionRepo.createQueryBuilder.mockReturnValueOnce(listQB as unknown);

    const result = await service.getRecentExecutions('ws-1');
    expect(result).toEqual([]);
    expect(executionRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
  });

  it('skips parent batch query when no row has parentExecutionId (hot path)', async () => {
    const r = baseFake({
      id: 'r',
      executedBy: 'u1',
      executor: { id: 'u1', name: 'A' },
    });
    const listQB = buildListQB([r]);
    executionRepo.createQueryBuilder.mockReturnValueOnce(listQB as unknown);

    await service.getRecentExecutions('ws-1');
    // parent IN 쿼리는 만들어지지 않아야 한다 — list QB 만 1 회 생성.
    expect(executionRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
  });

  it('subworkflow with deleted parent → triggerSource=subworkflow, label=null', async () => {
    const child = baseFake({
      id: 'orphan',
      workflowId: 'wChild',
      parentExecutionId: 'p-deleted',
    });
    const parentQB = buildParentNameQB([]); // 부모를 못 찾음
    executionRepo.createQueryBuilder
      .mockReturnValueOnce(buildListQB([child]) as unknown)
      .mockReturnValueOnce(parentQB as unknown);

    const result = await service.getRecentExecutions('ws-1');
    expect(result[0].triggerSource).toBe('subworkflow');
    expect(result[0].triggerLabel).toBeNull();
  });

  it('triggerId set but Trigger relation missing → triggerSource=unknown', async () => {
    const r = baseFake({
      id: 'unk',
      triggerId: 't-zombie',
      trigger: null,
    });
    executionRepo.createQueryBuilder.mockReturnValueOnce(
      buildListQB([r]) as unknown,
    );

    const result = await service.getRecentExecutions('ws-1');
    expect(result[0].triggerSource).toBe('unknown');
    expect(result[0].triggerLabel).toBeNull();
  });
});
