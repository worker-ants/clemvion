import { NotificationsChannelAuthorizer } from './notifications-channel-authorizer';

describe('NotificationsChannelAuthorizer', () => {
  const authorizer = new NotificationsChannelAuthorizer();

  it('matches only notifications: channels', () => {
    expect(authorizer.matches('notifications:u-1')).toBe(true);
    expect(authorizer.matches('execution:u-1')).toBe(false);
  });

  it('allows when JWT userId matches channel userId', async () => {
    const result = await authorizer.authorize('notifications:u-1', {
      workspaceId: 'ws-1',
      userId: 'u-1',
    });
    expect(result).toBeNull();
  });

  it('rejects when channel userId differs from JWT sub (IDOR)', async () => {
    const result = await authorizer.authorize('notifications:u-2', {
      workspaceId: 'ws-1',
      userId: 'u-1',
    });
    expect(result).toEqual({ error: 'Not authorized for these notifications' });
  });

  it('rejects when JWT userId is empty (fail-closed)', async () => {
    const result = await authorizer.authorize('notifications:', {
      workspaceId: 'ws-1',
      userId: '',
    });
    expect(result).toEqual({ error: 'Not authorized for these notifications' });
  });
});
