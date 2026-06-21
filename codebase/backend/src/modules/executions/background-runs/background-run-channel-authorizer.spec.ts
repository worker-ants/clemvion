import { BackgroundRunChannelAuthorizer } from './background-run-channel-authorizer';
import { BackgroundRunsService } from './background-runs.service';

const VALID_ID = '22222222-2222-4222-8222-222222222222';

function makeAuthorizer(
  verifyBackgroundRunOwnership: jest.Mock,
): BackgroundRunChannelAuthorizer {
  return new BackgroundRunChannelAuthorizer({
    verifyBackgroundRunOwnership,
  } as unknown as BackgroundRunsService);
}

describe('BackgroundRunChannelAuthorizer', () => {
  it('matches only background:run: channels', () => {
    const authorizer = makeAuthorizer(jest.fn());
    expect(authorizer.matches('background:run:abc')).toBe(true);
    // execution: 와 prefix 가 겹치지 않는다.
    expect(authorizer.matches('execution:abc')).toBe(false);
  });

  it('rejects non-UUID id before DB lookup (비-UUID 선차단)', async () => {
    const verify = jest.fn();
    const authorizer = makeAuthorizer(verify);

    const result = await authorizer.authorize('background:run:nope', {
      workspaceId: 'ws-1',
      userId: 'u-1',
    });

    expect(result).toEqual({ error: 'Not authorized for this background run' });
    expect(verify).not.toHaveBeenCalled();
  });

  it('allows when ownership verified', async () => {
    const verify = jest.fn().mockResolvedValue(true);
    const authorizer = makeAuthorizer(verify);

    const result = await authorizer.authorize(`background:run:${VALID_ID}`, {
      workspaceId: 'ws-1',
      userId: 'u-1',
    });

    expect(result).toBeNull();
    expect(verify).toHaveBeenCalledWith(VALID_ID, 'ws-1');
  });

  it('rejects when ownership check resolves false', async () => {
    const verify = jest.fn().mockResolvedValue(false);
    const authorizer = makeAuthorizer(verify);

    const result = await authorizer.authorize(`background:run:${VALID_ID}`, {
      workspaceId: 'ws-1',
      userId: 'u-1',
    });

    expect(result).toEqual({ error: 'Not authorized for this background run' });
  });

  it('rejects when ownership check throws (catch → false)', async () => {
    const verify = jest.fn().mockRejectedValue(new Error('PG error'));
    const authorizer = makeAuthorizer(verify);

    const result = await authorizer.authorize(`background:run:${VALID_ID}`, {
      workspaceId: 'ws-1',
      userId: 'u-1',
    });

    expect(result).toEqual({ error: 'Not authorized for this background run' });
  });
});
