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

describe('DashboardService.getRecentExecutions', () => {
  let service: DashboardService;
  let executionRepo: { createQueryBuilder: jest.Mock };
  let workflowRepo: { count: jest.Mock };

  const buildListQB = (rows: FakeExec[]) => {
    const qb: Record<string, jest.Mock> = {};
    qb.innerJoinAndSelect = jest.fn().mockReturnValue(qb);
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
});
