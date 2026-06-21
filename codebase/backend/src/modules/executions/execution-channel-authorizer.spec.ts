import { ExecutionChannelAuthorizer } from './execution-channel-authorizer';
import { ExecutionsService } from './executions.service';

const VALID_ID = '11111111-1111-4111-8111-111111111111';

function makeAuthorizer(
  verifyOwnership: jest.Mock,
): ExecutionChannelAuthorizer {
  return new ExecutionChannelAuthorizer({
    verifyOwnership,
  } as unknown as ExecutionsService);
}

describe('ExecutionChannelAuthorizer', () => {
  it('matches only execution: channels', () => {
    const authorizer = makeAuthorizer(jest.fn());
    expect(authorizer.matches('execution:abc')).toBe(true);
    expect(authorizer.matches('workflow:abc')).toBe(false);
    expect(authorizer.matches('background:run:abc')).toBe(false);
  });

  it('rejects non-UUID id before DB lookup', async () => {
    const verifyOwnership = jest.fn();
    const authorizer = makeAuthorizer(verifyOwnership);

    const result = await authorizer.authorize('execution:not-a-uuid', {
      workspaceId: 'ws-1',
      userId: 'u-1',
    });

    expect(result).toEqual({ error: 'Not authorized for this execution' });
    expect(verifyOwnership).not.toHaveBeenCalled();
  });

  it('allows when ownership verified', async () => {
    const verifyOwnership = jest.fn().mockResolvedValue(undefined);
    const authorizer = makeAuthorizer(verifyOwnership);

    const result = await authorizer.authorize(`execution:${VALID_ID}`, {
      workspaceId: 'ws-1',
      userId: 'u-1',
    });

    expect(result).toBeNull();
    expect(verifyOwnership).toHaveBeenCalledWith(VALID_ID, 'ws-1');
  });

  it('rejects when ownership throws (NotFound — IDOR/enumeration 차단)', async () => {
    const verifyOwnership = jest.fn().mockRejectedValue(new Error('not found'));
    const authorizer = makeAuthorizer(verifyOwnership);

    const result = await authorizer.authorize(`execution:${VALID_ID}`, {
      workspaceId: 'ws-other',
      userId: 'u-1',
    });

    expect(result).toEqual({ error: 'Not authorized for this execution' });
  });
});
