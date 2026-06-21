import { WorkflowChannelAuthorizer } from './workflow-channel-authorizer';
import { WorkflowsService } from './workflows.service';

const VALID_ID = '33333333-3333-4333-8333-333333333333';

function makeAuthorizer(findById: jest.Mock): WorkflowChannelAuthorizer {
  return new WorkflowChannelAuthorizer({
    findById,
  } as unknown as WorkflowsService);
}

describe('WorkflowChannelAuthorizer', () => {
  it('matches only workflow: channels', () => {
    const authorizer = makeAuthorizer(jest.fn());
    expect(authorizer.matches('workflow:abc')).toBe(true);
    expect(authorizer.matches('execution:abc')).toBe(false);
  });

  it('rejects non-UUID id before DB lookup', async () => {
    const findById = jest.fn();
    const authorizer = makeAuthorizer(findById);

    const result = await authorizer.authorize('workflow:nope', {
      workspaceId: 'ws-1',
      userId: 'u-1',
    });

    expect(result).toEqual({ error: 'Not authorized for this workflow' });
    expect(findById).not.toHaveBeenCalled();
  });

  it('allows when findById resolves (owned)', async () => {
    const findById = jest.fn().mockResolvedValue({ id: VALID_ID });
    const authorizer = makeAuthorizer(findById);

    const result = await authorizer.authorize(`workflow:${VALID_ID}`, {
      workspaceId: 'ws-1',
      userId: 'u-1',
    });

    expect(result).toBeNull();
    expect(findById).toHaveBeenCalledWith(VALID_ID, 'ws-1');
  });

  it('rejects when findById throws (NotFound — enumeration 차단)', async () => {
    const findById = jest.fn().mockRejectedValue(new Error('not found'));
    const authorizer = makeAuthorizer(findById);

    const result = await authorizer.authorize(`workflow:${VALID_ID}`, {
      workspaceId: 'ws-other',
      userId: 'u-1',
    });

    expect(result).toEqual({ error: 'Not authorized for this workflow' });
  });
});
