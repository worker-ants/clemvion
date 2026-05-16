import {
  IntegrationExpiryScannerService,
  JOB_CONNECTED_EXPIRY,
  JOB_PENDING_INSTALL_TTL,
  JOB_USAGE_LOG_PRUNE,
  JOB_CAFE24_BACKGROUND_REFRESH,
} from './integration-expiry-scanner.service';
import { REFRESH_PROACTIVE_THRESHOLD_DAYS } from './cafe24-token-refresh.constants';

type Mock = jest.Mock;

function repo(): Record<string, Mock> {
  return {
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockResolvedValue(undefined),
    insert: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockImplementation((data: unknown) => data),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
  };
}

describe('IntegrationExpiryScannerService.run', () => {
  let scanner: IntegrationExpiryScannerService;
  let integrationRepo: Record<string, Mock>;
  let dispatchRepo: Record<string, Mock>;
  let usageLogRepo: Record<string, Mock>;
  let userRepo: Record<string, Mock>;
  let workspacesService: { findAdminUserIds: Mock };
  let notificationsService: { createMany: Mock };
  let queue: Record<string, Mock>;
  let cafe24RefreshQueue: { add: Mock };

  beforeEach(() => {
    integrationRepo = repo();
    dispatchRepo = repo();
    usageLogRepo = repo();
    userRepo = repo();
    userRepo.find.mockResolvedValue([]);
    workspacesService = { findAdminUserIds: jest.fn().mockResolvedValue([]) };
    notificationsService = {
      createMany: jest.fn().mockResolvedValue(undefined),
    };
    queue = { upsertJobScheduler: jest.fn() };
    cafe24RefreshQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };

    scanner = new IntegrationExpiryScannerService(
      integrationRepo as never,
      dispatchRepo as never,
      usageLogRepo as never,
      userRepo as never,
      workspacesService as never,
      notificationsService as never,
      queue as never,
      cafe24RefreshQueue as never,
    );
  });

  it('creates a 7d notification for a personal integration expiring in 5 days', async () => {
    const now = new Date('2026-04-12T00:00:00Z');
    const expires = new Date('2026-04-17T00:00:00Z');
    integrationRepo.find.mockResolvedValue([
      {
        id: 'int-1',
        workspaceId: 'ws-1',
        name: 'My Service',
        scope: 'personal',
        status: 'connected',
        createdBy: 'user-1',
        tokenExpiresAt: expires,
      },
    ]);
    userRepo.find.mockResolvedValue([
      { id: 'user-1', notificationPreferences: {} },
    ]);

    const count = await scanner.run(now);
    expect(count).toBe(1);
    expect(dispatchRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ threshold: '7d', integrationId: 'int-1' }),
    );
    expect(notificationsService.createMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'user-1',
          channel: 'in_app',
          resourceId: 'int-1',
        }),
      ]),
    );
  });

  it('uses channel=both when user opts into email', async () => {
    integrationRepo.find.mockResolvedValue([
      {
        id: 'int-1',
        workspaceId: 'ws-1',
        name: 'My Service',
        scope: 'personal',
        status: 'connected',
        createdBy: 'user-1',
        tokenExpiresAt: new Date('2026-04-14T00:00:00Z'),
      },
    ]);
    userRepo.find.mockResolvedValue([
      {
        id: 'user-1',
        notificationPreferences: { integrationExpiryEmail: true },
      },
    ]);
    await scanner.run(new Date('2026-04-12T00:00:00Z'));
    expect(notificationsService.createMany).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ channel: 'both' })]),
    );
  });

  it('escalates to expired status and notifies at 0d', async () => {
    const now = new Date('2026-04-12T00:00:00Z');
    integrationRepo.find.mockResolvedValue([
      {
        id: 'int-2',
        workspaceId: 'ws-1',
        name: 'Drive',
        scope: 'personal',
        status: 'connected',
        createdBy: 'user-2',
        tokenExpiresAt: new Date('2026-04-11T23:59:00Z'),
      },
    ]);
    userRepo.find.mockResolvedValue([
      { id: 'user-2', notificationPreferences: {} },
    ]);

    await scanner.run(now);
    expect(integrationRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ status: 'expired' })]),
    );
  });

  it('skips thresholds already dispatched (unique violation)', async () => {
    integrationRepo.find.mockResolvedValue([
      {
        id: 'int-3',
        workspaceId: 'ws-1',
        name: 'GitHub',
        scope: 'personal',
        status: 'connected',
        createdBy: 'user-3',
        tokenExpiresAt: new Date('2026-04-14T00:00:00Z'),
      },
    ]);
    dispatchRepo.insert.mockRejectedValue(
      Object.assign(new Error('dup'), { code: '23505' }),
    );

    const count = await scanner.run(new Date('2026-04-12T00:00:00Z'));
    expect(count).toBe(0);
    expect(notificationsService.createMany).toHaveBeenCalledWith([]);
  });

  it('notifies all admins for organization-scope integrations', async () => {
    integrationRepo.find.mockResolvedValue([
      {
        id: 'int-4',
        workspaceId: 'ws-1',
        name: 'Team Integration',
        scope: 'organization',
        status: 'connected',
        createdBy: 'user-1',
        tokenExpiresAt: new Date('2026-04-14T00:00:00Z'),
      },
    ]);
    workspacesService.findAdminUserIds.mockResolvedValue([
      'u-owner',
      'u-admin',
    ]);
    userRepo.find.mockResolvedValue([
      { id: 'u-owner', notificationPreferences: {} },
      { id: 'u-admin', notificationPreferences: {} },
    ]);

    const count = await scanner.run(new Date('2026-04-12T00:00:00Z'));
    expect(count).toBe(2);
    const entries = notificationsService.createMany.mock.calls[0][0] as Array<{
      userId: string;
    }>;
    expect(entries.map((e) => e.userId).sort()).toEqual(['u-admin', 'u-owner']);
  });

  it('skips integrations without tokenExpiresAt', async () => {
    integrationRepo.find.mockResolvedValue([
      {
        id: 'int-x',
        workspaceId: 'ws-1',
        name: 'x',
        scope: 'personal',
        status: 'connected',
        createdBy: 'user-1',
        tokenExpiresAt: null,
      },
    ]);
    const count = await scanner.run(new Date());
    expect(count).toBe(0);
  });

  it('does not notify when organization has no admins', async () => {
    integrationRepo.find.mockResolvedValue([
      {
        id: 'int-5',
        workspaceId: 'ws-1',
        name: 'x',
        scope: 'organization',
        status: 'connected',
        createdBy: 'user-1',
        tokenExpiresAt: new Date('2026-04-14T00:00:00Z'),
      },
    ]);
    workspacesService.findAdminUserIds.mockResolvedValue([]);
    const count = await scanner.run(new Date('2026-04-12T00:00:00Z'));
    expect(count).toBe(0);
  });

  // REQ-C1 — spec §11.1 + §2.4: pending_install 은 만료 알림 대상에서 명시
  // 제외. find()의 where 절 status filter 가 `Not(In([..., 'pending_install']))`
  // 을 포함하는지 확인. TypeORM `FindOperator` 의 public API (`.type` 문자열
  // 식별자, `.value` getter) 만 사용 — underscore 필드 직접 접근 없이 검증.
  // `Not(In([...]))` 는 outer.value 로 inner `In` 의 배열을 직접 노출한다
  // (실측 확인) 이므로 한 레이어만 풀면 된다.
  it('excludes pending_install from the run() candidate query (REQ-C1)', async () => {
    integrationRepo.find.mockResolvedValue([]);
    await scanner.run(new Date('2026-04-12T00:00:00Z'));
    expect(integrationRepo.find).toHaveBeenCalledTimes(1);
    const whereArg = (
      integrationRepo.find.mock.calls[0][0] as {
        where: Record<string, unknown>;
      }
    ).where;
    const statusOp = whereArg.status as { type: string; value: string[] };
    expect(statusOp.type).toBe('not');
    expect(statusOp.value).toEqual(
      expect.arrayContaining(['expired', 'error', 'pending_install']),
    );
  });
});

describe('IntegrationExpiryScannerService.expirePendingInstalls', () => {
  let integrationRepo: Record<string, jest.Mock>;
  let updateBuilder: Record<string, jest.Mock>;
  let scanner: IntegrationExpiryScannerService;
  let executeMock: jest.Mock;

  beforeEach(() => {
    executeMock = jest.fn().mockResolvedValue({ affected: 0 });
    updateBuilder = {
      update: jest.fn(),
      set: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      execute: executeMock,
    };
    updateBuilder.update.mockReturnValue(updateBuilder);
    updateBuilder.set.mockReturnValue(updateBuilder);
    updateBuilder.where.mockReturnValue(updateBuilder);
    updateBuilder.andWhere.mockReturnValue(updateBuilder);
    integrationRepo = {
      ...repo(),
      createQueryBuilder: jest.fn().mockReturnValue(updateBuilder),
    };
    scanner = new IntegrationExpiryScannerService(
      integrationRepo as never,
      repo() as never,
      repo() as never,
      repo() as never,
      { findAdminUserIds: jest.fn() } as never,
      { createMany: jest.fn() } as never,
      { upsertJobScheduler: jest.fn() } as never,
    );
  });

  it('issues a single atomic UPDATE for stale pending_install rows (no find→save race)', async () => {
    executeMock.mockResolvedValue({ affected: 2 });
    const now = new Date('2026-05-14T12:00:00Z');
    const affected = await scanner.expirePendingInstalls(now);
    expect(affected).toBe(2);
    // Bulk UPDATE — predicate is part of the WHERE clause so a concurrent
    // callback that flips the row to `connected` between our read and write
    // is not racy: only rows still pending_install at write time are touched.
    expect(updateBuilder.set).toHaveBeenCalledWith({
      status: 'expired',
      statusReason: 'install_timeout',
      installToken: null,
    });
    expect(updateBuilder.where).toHaveBeenCalledWith('status = :status', {
      status: 'pending_install',
    });
    // Cutoff is exactly now - 24h (PENDING_INSTALL_TTL_HOURS).
    // TTL key is `install_token_issued_at` (V044) with COALESCE fallback to
    // `created_at` for pre-V044 rows — a row reused via begin re-submission
    // gets a fresh 24h window instead of inheriting the original created_at.
    const andWhereArgs = updateBuilder.andWhere.mock.calls[0];
    expect(andWhereArgs[0]).toBe(
      'COALESCE(install_token_issued_at, created_at) < :cutoff',
    );
    const cutoff: Date = andWhereArgs[1].cutoff;
    expect(cutoff.getTime()).toBe(now.getTime() - 24 * 60 * 60 * 1000);
  });

  it('returns 0 when no pending_install rows are stale', async () => {
    executeMock.mockResolvedValue({ affected: 0 });
    const affected = await scanner.expirePendingInstalls(new Date());
    expect(affected).toBe(0);
  });

  it('handles undefined `affected` (driver edge case) as 0', async () => {
    executeMock.mockResolvedValue({});
    const affected = await scanner.expirePendingInstalls(new Date());
    expect(affected).toBe(0);
  });
});

describe('IntegrationExpiryScannerService.process — per-job routing', () => {
  // spec/data-flow/integration.md §1.4: each pass is its own BullMQ job
  // so failures are independently retried + visible in queue metrics.
  // process(job) routes by name; failures propagate (no .catch).
  function makeScanner() {
    const integrationRepo = repo();
    const usageLogRepo = repo();
    usageLogRepo.delete.mockResolvedValue({ affected: 0 });
    integrationRepo.createQueryBuilder = jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    });
    const cafe24RefreshQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };
    const scanner = new IntegrationExpiryScannerService(
      integrationRepo as never,
      repo() as never,
      usageLogRepo as never,
      repo() as never,
      { findAdminUserIds: jest.fn().mockResolvedValue([]) } as never,
      { createMany: jest.fn().mockResolvedValue(undefined) } as never,
      { upsertJobScheduler: jest.fn() } as never,
      cafe24RefreshQueue as never,
    );
    return { scanner, integrationRepo, usageLogRepo, cafe24RefreshQueue };
  }

  it('routes JOB_CONNECTED_EXPIRY → run()', async () => {
    const { scanner } = makeScanner();
    const runSpy = jest.spyOn(scanner, 'run').mockResolvedValue(0);
    const expireSpy = jest
      .spyOn(scanner, 'expirePendingInstalls')
      .mockResolvedValue(0);
    const pruneSpy = jest.spyOn(scanner, 'pruneUsageLogs').mockResolvedValue(0);
    await scanner.process({
      name: JOB_CONNECTED_EXPIRY,
      data: { triggeredAt: new Date().toISOString() },
    } as never);
    expect(runSpy).toHaveBeenCalled();
    expect(expireSpy).not.toHaveBeenCalled();
    expect(pruneSpy).not.toHaveBeenCalled();
  });

  it('routes JOB_PENDING_INSTALL_TTL → expirePendingInstalls()', async () => {
    const { scanner } = makeScanner();
    const runSpy = jest.spyOn(scanner, 'run').mockResolvedValue(0);
    const expireSpy = jest
      .spyOn(scanner, 'expirePendingInstalls')
      .mockResolvedValue(0);
    const pruneSpy = jest.spyOn(scanner, 'pruneUsageLogs').mockResolvedValue(0);
    await scanner.process({
      name: JOB_PENDING_INSTALL_TTL,
      data: { triggeredAt: new Date().toISOString() },
    } as never);
    expect(expireSpy).toHaveBeenCalled();
    expect(runSpy).not.toHaveBeenCalled();
    expect(pruneSpy).not.toHaveBeenCalled();
  });

  it('routes JOB_USAGE_LOG_PRUNE → pruneUsageLogs()', async () => {
    const { scanner } = makeScanner();
    const runSpy = jest.spyOn(scanner, 'run').mockResolvedValue(0);
    const expireSpy = jest
      .spyOn(scanner, 'expirePendingInstalls')
      .mockResolvedValue(0);
    const pruneSpy = jest.spyOn(scanner, 'pruneUsageLogs').mockResolvedValue(0);
    await scanner.process({
      name: JOB_USAGE_LOG_PRUNE,
      data: { triggeredAt: new Date().toISOString() },
    } as never);
    expect(pruneSpy).toHaveBeenCalled();
    expect(runSpy).not.toHaveBeenCalled();
    expect(expireSpy).not.toHaveBeenCalled();
  });

  it('routes JOB_CAFE24_BACKGROUND_REFRESH → enqueueCafe24BackgroundRefresh()', async () => {
    const { scanner } = makeScanner();
    const bgSpy = jest
      .spyOn(scanner, 'enqueueCafe24BackgroundRefresh')
      .mockResolvedValue(0);
    await scanner.process({
      name: JOB_CAFE24_BACKGROUND_REFRESH,
      data: { triggeredAt: new Date().toISOString() },
    } as never);
    expect(bgSpy).toHaveBeenCalled();
  });

  it('propagates failures so BullMQ retries (no .catch swallow)', async () => {
    const { scanner } = makeScanner();
    jest
      .spyOn(scanner, 'expirePendingInstalls')
      .mockRejectedValue(new Error('boom'));
    await expect(
      scanner.process({
        name: JOB_PENDING_INSTALL_TTL,
        data: { triggeredAt: new Date().toISOString() },
      } as never),
    ).rejects.toThrow('boom');
  });

  it('throws on unknown job name (visible scheduler drift)', async () => {
    const { scanner } = makeScanner();
    await expect(
      scanner.process({
        name: 'orphan-pass',
        data: { triggeredAt: new Date().toISOString() },
      } as never),
    ).rejects.toThrow(/Unknown integration-expiry job/);
  });
});

describe('IntegrationExpiryScannerService.pruneUsageLogs', () => {
  it('deletes rows older than 90 days', async () => {
    const usageLogRepo = repo();
    usageLogRepo.delete.mockResolvedValue({ affected: 42 });
    const scanner = new IntegrationExpiryScannerService(
      repo() as never,
      repo() as never,
      usageLogRepo as never,
      repo() as never,
      { findAdminUserIds: jest.fn() } as never,
      { createMany: jest.fn() } as never,
      { upsertJobScheduler: jest.fn() } as never,
      { add: jest.fn() } as never,
    );
    const affected = await scanner.pruneUsageLogs(new Date());
    expect(affected).toBe(42);
    expect(usageLogRepo.delete).toHaveBeenCalled();
  });
});

describe('IntegrationExpiryScannerService.enqueueCafe24BackgroundRefresh', () => {
  // 14일 refresh_token 만료 전 자동 갱신 — idle 통합도 영구 유효 유지.
  // lastRotatedAt < now - REFRESH_PROACTIVE_THRESHOLD_DAYS 인 cafe24 통합을
  // refresh 큐로 enqueue. jobId = integrationId 로 proactive 호출과 dedup.
  function makeScanner() {
    const integrationRepo = repo();
    const cafe24RefreshQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };
    const scanner = new IntegrationExpiryScannerService(
      integrationRepo as never,
      repo() as never,
      repo() as never,
      repo() as never,
      { findAdminUserIds: jest.fn() } as never,
      { createMany: jest.fn() } as never,
      { upsertJobScheduler: jest.fn() } as never,
      cafe24RefreshQueue as never,
    );
    return { scanner, integrationRepo, cafe24RefreshQueue };
  }

  it('enqueues refresh jobs for stale (lastRotatedAt < cutoff) connected cafe24 integrations', async () => {
    const { scanner, integrationRepo, cafe24RefreshQueue } = makeScanner();
    const now = new Date('2026-05-16T00:00:00Z');
    integrationRepo.find.mockResolvedValue([
      { id: 'int-a', lastRotatedAt: new Date('2026-05-01T00:00:00Z') },
      { id: 'int-b', lastRotatedAt: new Date('2026-04-20T00:00:00Z') },
    ]);

    const count = await scanner.enqueueCafe24BackgroundRefresh(now);
    expect(count).toBe(2);

    // cutoff 검증: now - 10 days
    const expectedCutoff = new Date(
      now.getTime() - REFRESH_PROACTIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000,
    );
    expect(integrationRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          serviceType: 'cafe24',
          status: 'connected',
        }),
      }),
    );
    const findCall = integrationRepo.find.mock.calls[0][0] as {
      where: { lastRotatedAt: unknown };
    };
    expect(findCall.where.lastRotatedAt).toBeDefined();
    // TypeORM Or(LessThan(cutoff), IsNull()) — Or FindOperator 의 내부
    // shape 에서 LessThan 분기의 cutoff 값을 추출.
    const orOp = findCall.where.lastRotatedAt as {
      type?: string;
      _value?: Array<{ type?: string; _value?: Date }>;
      value?: Array<{ type?: string; value?: Date }>;
    };
    const inner = orOp._value ?? orOp.value ?? [];
    const lessThan = inner.find(
      (op) => (op as { type?: string }).type === 'lessThan',
    ) as { _value?: Date; value?: Date } | undefined;
    const actualCutoff = lessThan?._value ?? lessThan?.value;
    expect(actualCutoff?.getTime()).toBe(expectedCutoff.getTime());

    // 각 통합이 jobId=integrationId 로 enqueue
    expect(cafe24RefreshQueue.add).toHaveBeenCalledTimes(2);
    expect(cafe24RefreshQueue.add).toHaveBeenNthCalledWith(
      1,
      'refresh-cafe24-token',
      { integrationId: 'int-a', source: 'background' },
      expect.objectContaining({ jobId: 'int-a', attempts: 1 }),
    );
    expect(cafe24RefreshQueue.add).toHaveBeenNthCalledWith(
      2,
      'refresh-cafe24-token',
      { integrationId: 'int-b', source: 'background' },
      expect.objectContaining({ jobId: 'int-b', attempts: 1 }),
    );
  });

  it('returns 0 and skips enqueue when no candidates', async () => {
    const { scanner, integrationRepo, cafe24RefreshQueue } = makeScanner();
    integrationRepo.find.mockResolvedValue([]);
    const count = await scanner.enqueueCafe24BackgroundRefresh(new Date());
    expect(count).toBe(0);
    expect(cafe24RefreshQueue.add).not.toHaveBeenCalled();
  });

  // 회귀 — TypeORM `Or(LessThan(cutoff), IsNull())` 가 `lastRotatedAt IS NULL`
  // 통합도 enqueue 대상에 포함하는지 검증. `integrations.service.ts` 의
  // create() 가 `lastRotatedAt = new Date()` 로 명시 초기화하지만 V045 이전
  // legacy row 또는 다른 ETL 진입점이 NULL 로 저장하더라도 background
  // refresh 가 누락하지 않아야 한다. 본 테스트는 production 코드의 `where`
  // 절이 IsNull 분기를 명시 포함하는지를 fixture 형태로 고정.
  it('includes lastRotatedAt=NULL integrations (Or-IsNull belt-and-suspenders)', async () => {
    const { scanner, integrationRepo } = makeScanner();
    await scanner.enqueueCafe24BackgroundRefresh(new Date());
    const findCall = integrationRepo.find.mock.calls[0][0] as {
      where: { lastRotatedAt: { _value?: unknown; type?: string } };
    };
    // TypeORM 의 Or(...) 는 FindOperator 로 직렬화되므로 정확한 내부 shape
    // 보다 type 이름 + value 의 존재를 부드럽게 검증.
    const op = findCall.where.lastRotatedAt as unknown as {
      type?: string;
    };
    expect(op).toBeDefined();
    // Or operator 면 type='or', LessThan(cutoff) 단독이면 type='lessThan'.
    // IsNull 분기 누락 회귀 시 이 expect 가 실패한다.
    expect(op.type).toBe('or');
  });

  // 회귀 — TypeORM where 절이 status='connected' 필터를 가져 error/expired/
  // pending_install 통합은 enqueue 되지 않음을 명시. background 경로가
  // 사용자 reauthorize 의도를 우회하지 않게 보호.
  it('excludes non-connected integrations via where clause filter', async () => {
    const { scanner, integrationRepo } = makeScanner();
    await scanner.enqueueCafe24BackgroundRefresh(new Date());
    const findCall = integrationRepo.find.mock.calls[0][0] as {
      where: { status: string };
    };
    expect(findCall.where.status).toBe('connected');
  });

  // 회귀 — serviceType='cafe24' 필터. 다른 provider 통합이 cutoff 를
  // 만족해도 enqueue 되지 않아야 한다.
  it('limits scan to serviceType=cafe24 only', async () => {
    const { scanner, integrationRepo } = makeScanner();
    await scanner.enqueueCafe24BackgroundRefresh(new Date());
    const findCall = integrationRepo.find.mock.calls[0][0] as {
      where: { serviceType: string };
    };
    expect(findCall.where.serviceType).toBe('cafe24');
  });

  it('survives partial enqueue failures — counts only successful', async () => {
    const { scanner, integrationRepo, cafe24RefreshQueue } = makeScanner();
    integrationRepo.find.mockResolvedValue([
      { id: 'int-a', lastRotatedAt: new Date('2026-04-01T00:00:00Z') },
      { id: 'int-b', lastRotatedAt: new Date('2026-04-02T00:00:00Z') },
      { id: 'int-c', lastRotatedAt: new Date('2026-04-03T00:00:00Z') },
    ]);
    cafe24RefreshQueue.add
      .mockResolvedValueOnce({ id: 'job-a' })
      .mockRejectedValueOnce(new Error('Redis 일시 장애'))
      .mockResolvedValueOnce({ id: 'job-c' });

    const count = await scanner.enqueueCafe24BackgroundRefresh(new Date());
    expect(count).toBe(2);
    expect(cafe24RefreshQueue.add).toHaveBeenCalledTimes(3);
  });
});
