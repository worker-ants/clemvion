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
        name: 'My Slack',
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
        name: 'My Slack',
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
        name: 'Team Slack',
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
