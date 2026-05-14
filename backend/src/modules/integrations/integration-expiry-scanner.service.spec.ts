import { IntegrationExpiryScannerService } from './integration-expiry-scanner.service';

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

    scanner = new IntegrationExpiryScannerService(
      integrationRepo as never,
      dispatchRepo as never,
      usageLogRepo as never,
      userRepo as never,
      workspacesService as never,
      notificationsService as never,
      queue as never,
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
    const andWhereArgs = updateBuilder.andWhere.mock.calls[0];
    expect(andWhereArgs[0]).toBe('created_at < :cutoff');
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

describe('IntegrationExpiryScannerService.process — error isolation', () => {
  // Spec/data-flow/integration.md §1.4: one failed pass must not block the
  // others. Verify the queue handler doesn't propagate so BullMQ won't keep
  // retrying for a hopeless run (and we still get the next pass executed).
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
    const scanner = new IntegrationExpiryScannerService(
      integrationRepo as never,
      repo() as never,
      usageLogRepo as never,
      repo() as never,
      { findAdminUserIds: jest.fn().mockResolvedValue([]) } as never,
      { createMany: jest.fn().mockResolvedValue(undefined) } as never,
      { upsertJobScheduler: jest.fn() } as never,
    );
    return { scanner, integrationRepo, usageLogRepo };
  }

  it('runs pruneUsageLogs even when expirePendingInstalls throws', async () => {
    const { scanner, usageLogRepo } = makeScanner();
    jest
      .spyOn(scanner, 'expirePendingInstalls')
      .mockRejectedValue(new Error('boom'));
    await scanner.process({
      data: { triggeredAt: new Date().toISOString() },
    } as never);
    expect(usageLogRepo.delete).toHaveBeenCalled();
  });

  it('runs expirePendingInstalls even when run() throws', async () => {
    const { scanner } = makeScanner();
    const runSpy = jest
      .spyOn(scanner, 'run')
      .mockRejectedValue(new Error('boom'));
    const expireSpy = jest
      .spyOn(scanner, 'expirePendingInstalls')
      .mockResolvedValue(0);
    await scanner.process({
      data: { triggeredAt: new Date().toISOString() },
    } as never);
    expect(runSpy).toHaveBeenCalled();
    expect(expireSpy).toHaveBeenCalled();
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
    );
    const affected = await scanner.pruneUsageLogs(new Date());
    expect(affected).toBe(42);
    expect(usageLogRepo.delete).toHaveBeenCalled();
  });
});
