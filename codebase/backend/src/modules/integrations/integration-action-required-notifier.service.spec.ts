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
      find: jest
        .fn()
        .mockResolvedValue([{ id: 'user-1', notificationPreferences: {} }]),
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

  // CLE-T-MQSRDS — 콜백의 코드 교환 실패는 API 가 토큰을 거부한 것과 원인이 달라 문구를 나눈다. 제목은 같아서 클라이언트의
  // `markAuthFailed` 알림과 24시간 중복 방지를 함께 쓴다.
  describe('oauth_callback 계기', () => {
    it('auth_failed 는 같은 제목에 코드 교환 실패 문구를 쓰고 특정 서비스를 적지 않는다', async () => {
      await notifier.notify(
        makeIntegration({ name: 'My Shop' }),
        'auth_failed',
        'oauth_callback',
      );
      const entry = notificationsService.createMany.mock.calls[0][0][0];
      expect(entry.title).toBe('Integration disconnected');
      expect(entry.message).toBe(
        '"My Shop" needs reauthorization — the authorization code could not be exchanged for an access token. Reconnect to resume.',
      );
      expect(notificationsService.hasRecentByResource).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration_action_required',
          title: 'Integration disconnected',
        }),
      );
    });

    it('계기를 넘기지 않으면 API 호출 문구를 그대로 쓴다', async () => {
      await notifier.notify(makeIntegration(), 'auth_failed');
      const entry = notificationsService.createMany.mock.calls[0][0][0];
      expect(entry.message).toContain('rejected the access token');
    });
  });

  // CLE-T-184JJD — MCP 서버가 자격 증명을 거부해 `logUsage` 가 통합을 `error(auth_failed)` 로 바꿨다. Cafe24 문구를 쓰면
  // 다른 서비스 통합에 엉뚱한 서비스 이름이 나가므로 MCP 문구를 따로 둔다. 제목은 같아서 24시간 중복 방지를 함께 쓴다.
  describe('mcp_call 계기', () => {
    it('auth_failed 는 같은 제목에 MCP 서버 거부 문구를 쓰고 Cafe24 를 적지 않는다', async () => {
      await notifier.notify(
        makeIntegration({ name: 'My MCP' }),
        'auth_failed',
        'mcp_call',
      );
      const entry = notificationsService.createMany.mock.calls[0][0][0];
      expect(entry.title).toBe('Integration disconnected');
      expect(entry.message).toBe(
        '"My MCP" needs reauthorization — the MCP server rejected the credentials. Reconnect to resume.',
      );
      expect(entry.message).not.toContain('Cafe24');
      expect(notificationsService.hasRecentByResource).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration_action_required',
          title: 'Integration disconnected',
        }),
      );
    });
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
    workspacesService.findAdminUserIds.mockResolvedValue([
      'admin-1',
      'admin-2',
    ]);
    userRepo.find.mockResolvedValue([
      { id: 'admin-1', notificationPreferences: {} },
      { id: 'admin-2', notificationPreferences: {} },
    ]);
    await notifier.notify(
      makeIntegration({ scope: 'organization', createdBy: 'someone' }),
      'auth_failed',
    );
    const entries = notificationsService.createMany.mock.calls[0][0] as Array<
      Record<string, unknown>
    >;
    expect(entries.map((e) => e.userId).sort()).toEqual(['admin-1', 'admin-2']);
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
