import { AlertsEvaluatorService } from './alerts-evaluator.service';
import type { AlertRule } from './entities/alert-rule.entity';

type Mock = jest.Mock;

function makeRule(partial: Partial<AlertRule>): AlertRule {
  return {
    id: 'rule-1',
    workspaceId: 'ws-1',
    workflowId: null,
    type: 'failure_rate',
    threshold: '50',
    window: 'PT1H',
    channel: 'in_app',
    enabled: true,
    lastTriggeredAt: null,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

interface QbStub {
  innerJoin: Mock;
  select: Mock;
  where: Mock;
  andWhere: Mock;
  clone: Mock;
  getCount: Mock;
  getRawOne: Mock;
}

function createQbStub(opts: {
  totalCount?: number;
  failedCount?: number;
  rawAvg?: string | null;
  rawSum?: string | null;
}): QbStub {
  const stub: QbStub = {
    innerJoin: jest.fn(() => stub),
    select: jest.fn(() => stub),
    where: jest.fn(() => stub),
    andWhere: jest.fn(() => stub),
    clone: jest.fn(),
    getCount: jest.fn(),
    getRawOne: jest.fn(),
  };
  // Distinguish "total" call from "failed" call: getCount is called twice for
  // failure_rate (once before clone, once on the cloned qb). The cloned stub
  // returns `failedCount`.
  let totalCallCount = 0;
  stub.getCount.mockImplementation(() => {
    totalCallCount += 1;
    return Promise.resolve(opts.totalCount ?? 0);
  });
  stub.clone.mockImplementation(() => {
    const failedStub = { ...stub };
    failedStub.andWhere = jest.fn(() => failedStub);
    failedStub.getCount = jest.fn().mockResolvedValue(opts.failedCount ?? 0);
    return failedStub;
  });
  stub.getRawOne.mockResolvedValue(
    opts.rawAvg !== undefined
      ? { avg: opts.rawAvg }
      : opts.rawSum !== undefined
        ? { sum: opts.rawSum }
        : null,
  );
  // touch totalCallCount to keep it referenced
  void totalCallCount;
  return stub;
}

describe('AlertsEvaluatorService.run', () => {
  let evaluator: AlertsEvaluatorService;
  let ruleRepo: Record<string, Mock>;
  let executionRepo: Record<string, Mock>;
  let llmUsageRepo: Record<string, Mock>;
  let workflowRepo: Record<string, Mock>;
  let notificationsService: { createMany: Mock; hasRecentByResource: Mock };
  let workspacesService: { findAdminUserIds: Mock };
  let queue: Record<string, Mock>;

  beforeEach(() => {
    ruleRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((r: unknown) => r),
    };
    executionRepo = { createQueryBuilder: jest.fn() };
    llmUsageRepo = { createQueryBuilder: jest.fn() };
    workflowRepo = {};
    notificationsService = {
      createMany: jest.fn().mockResolvedValue(undefined),
      // W-75 — 후속 신규 메서드. 본 spec 은 직접 호출하지 않아도 NotificationsService
      // 가 변경되어도 런타임 에러가 나지 않도록 mock surface 를 동기화한다.
      hasRecentByResource: jest.fn().mockResolvedValue(false),
    };
    workspacesService = {
      findAdminUserIds: jest.fn().mockResolvedValue(['admin-1', 'admin-2']),
    };
    queue = { upsertJobScheduler: jest.fn() };

    evaluator = new AlertsEvaluatorService(
      ruleRepo as never,
      executionRepo as never,
      llmUsageRepo as never,
      workflowRepo as never,
      notificationsService as never,
      workspacesService as never,
      queue as never,
    );
  });

  it('does nothing when there are no enabled rules', async () => {
    const count = await evaluator.run(new Date());
    expect(count).toBe(0);
    expect(notificationsService.createMany).not.toHaveBeenCalled();
  });

  it('skips failure_rate evaluation when sample size is too small', async () => {
    ruleRepo.find.mockResolvedValue([
      makeRule({ type: 'failure_rate', threshold: '10' }),
    ]);
    executionRepo.createQueryBuilder.mockReturnValue(
      createQbStub({ totalCount: 3, failedCount: 3 }),
    );

    const count = await evaluator.run(new Date('2026-04-16T00:00:00Z'));
    expect(count).toBe(0);
    expect(notificationsService.createMany).not.toHaveBeenCalled();
  });

  it('dispatches notifications when failure rate exceeds threshold', async () => {
    ruleRepo.find.mockResolvedValue([
      makeRule({ type: 'failure_rate', threshold: '50' }),
    ]);
    executionRepo.createQueryBuilder.mockReturnValue(
      createQbStub({ totalCount: 10, failedCount: 7 }),
    );

    const count = await evaluator.run(new Date('2026-04-16T00:00:00Z'));
    expect(count).toBe(2); // two admins
    expect(notificationsService.createMany).toHaveBeenCalledTimes(1);
    const entries = notificationsService.createMany.mock.calls[0][0] as Array<{
      type: string;
      userId: string;
    }>;
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe('alert_failure_rate');
    expect(ruleRepo.save).toHaveBeenCalled();
  });

  it('does not refire while still in cooldown window', async () => {
    const now = new Date('2026-04-16T00:30:00Z');
    // lastTriggered 10 minutes ago, window is PT1H, so still cooling down
    const lastTriggered = new Date(now.getTime() - 10 * 60 * 1000);
    ruleRepo.find.mockResolvedValue([
      makeRule({
        type: 'failure_rate',
        threshold: '50',
        window: 'PT1H',
        lastTriggeredAt: lastTriggered,
      }),
    ]);
    executionRepo.createQueryBuilder.mockReturnValue(
      createQbStub({ totalCount: 10, failedCount: 9 }),
    );

    const count = await evaluator.run(now);
    expect(count).toBe(0);
    expect(notificationsService.createMany).not.toHaveBeenCalled();
  });

  it('dispatches when avg duration exceeds threshold', async () => {
    ruleRepo.find.mockResolvedValue([
      makeRule({ type: 'duration', threshold: '1000' }),
    ]);
    executionRepo.createQueryBuilder.mockReturnValue(
      createQbStub({ rawAvg: '2500' }),
    );

    const count = await evaluator.run(new Date('2026-04-16T00:00:00Z'));
    expect(count).toBe(2);
    const entries = notificationsService.createMany.mock.calls[0][0] as Array<{
      type: string;
    }>;
    expect(entries[0].type).toBe('alert_duration');
  });

  it('dispatches when LLM cost exceeds threshold', async () => {
    ruleRepo.find.mockResolvedValue([
      makeRule({ type: 'llm_cost', threshold: '5', window: 'P1D' }),
    ]);
    llmUsageRepo.createQueryBuilder.mockReturnValue(
      createQbStub({ rawSum: '12.34' }),
    );

    const count = await evaluator.run(new Date('2026-04-16T00:00:00Z'));
    expect(count).toBe(2);
    const entries = notificationsService.createMany.mock.calls[0][0] as Array<{
      type: string;
    }>;
    expect(entries[0].type).toBe('alert_llm_cost');
  });

  it('continues other rules when one rule throws', async () => {
    ruleRepo.find.mockResolvedValue([
      makeRule({ id: 'rule-bad', type: 'failure_rate' }),
      makeRule({ id: 'rule-good', type: 'duration', threshold: '1000' }),
    ]);
    let callIdx = 0;
    executionRepo.createQueryBuilder.mockImplementation(() => {
      if (callIdx++ === 0) throw new Error('boom');
      return createQbStub({ rawAvg: '5000' });
    });

    const count = await evaluator.run(new Date('2026-04-16T00:00:00Z'));
    expect(count).toBe(2);
  });
});
