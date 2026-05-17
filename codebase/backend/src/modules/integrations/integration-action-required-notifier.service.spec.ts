import { IntegrationActionRequiredNotifier } from './integration-action-required-notifier.service';
import type { Integration } from './entities/integration.entity';

type Mock = jest.Mock;

function makeIntegration(overrides: Partial<Integration> = {}): Integration {
  return {
    id: 'int-1',
    workspaceId: 'ws-1',
    name: 'My Cafe24',
    scope: 'personal',
    createdBy: 'user-1',
    ...overrides,
  } as Integration;
}

describe('IntegrationActionRequiredNotifier', () => {
  let userRepo: Record<string, Mock>;
  let workspacesService: { findAdminUserIds: Mock };
  let notificationsService: Record<string, Mock>;
  let notifier: IntegrationActionRequiredNotifier;

  beforeEach(() => {
    userRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 'user-1', notificationPreferences: {} },
      ]),
    };
    workspacesService = { findAdminUserIds: jest.fn().mockResolvedValue([]) };
    notificationsService = {
      createMany: jest.fn().mockResolvedValue(undefined),
      hasRecentByResource: jest.fn().mockResolvedValue(false),
    };
    notifier = new IntegrationActionRequiredNotifier(
      userRepo as never,
      workspacesService as never,
      notificationsService as never,
    );
  });

  it('emits notification for auth_failed with the proper title/message and channel=in_app by default', async () => {
    await notifier.notify(makeIntegration(), 'auth_failed');
    expect(notificationsService.createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: 'user-1',
        type: 'integration_action_required',
        title: 'Integration disconnected',
        resourceType: 'integration',
        resourceId: 'int-1',
        channel: 'in_app',
      }),
    ]);
    const entry = notificationsService.createMany.mock.calls[0][0][0];
    expect(entry.message).toContain('My Cafe24');
    expect(entry.message).toContain('reauthorization');
  });

  it('uses channel=both when user opted into integrationExpiryEmail', async () => {
    userRepo.find.mockResolvedValue([
      {
        id: 'user-1',
        notificationPreferences: { integrationExpiryEmail: true },
      },
    ]);
    await notifier.notify(makeIntegration(), 'auth_failed');
    expect(notificationsService.createMany).toHaveBeenCalledWith([
      expect.objectContaining({ channel: 'both' }),
    ]);
  });

  it('emits insufficient_scope with distinct title', async () => {
    await notifier.notify(makeIntegration(), 'insufficient_scope');
    const entry = notificationsService.createMany.mock.calls[0][0][0];
    expect(entry.title).toBe('Integration missing permissions');
    expect(entry.message).toContain('scopes');
  });

  it('emits network with distinct title and message', async () => {
    await notifier.notify(makeIntegration(), 'network');
    const entry = notificationsService.createMany.mock.calls[0][0][0];
    expect(entry.title).toBe('Integration network failure');
    expect(entry.message).toContain('3 consecutive network calls');
  });

  it('fans out to admin users for organization scope', async () => {
    workspacesService.findAdminUserIds.mockResolvedValue(['admin-1', 'admin-2']);
    userRepo.find.mockResolvedValue([
      { id: 'admin-1', notificationPreferences: {} },
      { id: 'admin-2', notificationPreferences: {} },
    ]);
    await notifier.notify(
      makeIntegration({ scope: 'organization', createdBy: 'someone' }),
      'auth_failed',
    );
    const entries = notificationsService.createMany.mock
      .calls[0][0] as Array<Record<string, unknown>>;
    expect(entries.map((e) => e.userId).sort()).toEqual([
      'admin-1',
      'admin-2',
    ]);
  });

  it('skips when hasRecentByResource returns true (24h dedup)', async () => {
    notificationsService.hasRecentByResource.mockResolvedValue(true);
    await notifier.notify(makeIntegration(), 'auth_failed');
    expect(notificationsService.createMany).not.toHaveBeenCalled();
  });

  it('swallows notifier errors so status transition does not break', async () => {
    notificationsService.createMany.mockRejectedValue(new Error('db down'));
    await expect(
      notifier.notify(makeIntegration(), 'auth_failed'),
    ).resolves.toBeUndefined();
  });

  it('no-op when no recipients (organization with no admins)', async () => {
    workspacesService.findAdminUserIds.mockResolvedValue([]);
    await notifier.notify(
      makeIntegration({ scope: 'organization' }),
      'network',
    );
    expect(notificationsService.createMany).not.toHaveBeenCalled();
  });
});
