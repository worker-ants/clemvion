import { BackgroundExecutionProcessor } from './background-execution.processor';
import type { BackgroundExecutionJob } from './background-execution.queue';

type Mock = jest.Mock;

function makeJob(over: Partial<BackgroundExecutionJob> = {}): {
  data: BackgroundExecutionJob;
} {
  return {
    data: {
      executionId: 'exec-1',
      parentNodeExecutionId: 'pne-1',
      workspaceId: 'ws-1',
      workflowId: 'wf-1',
      bodyEntryNodeIds: ['n-2'],
      input: { foo: 1 },
      variables: {},
      nodeOutputCache: {},
      expressionContext: { workspaceId: 'ws-1' },
      config: { notifyOnFailure: false, maxDurationMs: 0 },
      ...over,
    },
  };
}

describe('BackgroundExecutionProcessor', () => {
  let processor: BackgroundExecutionProcessor;
  let engine: { executeBackgroundSubgraph: Mock };
  let notifications: { createMany: Mock };
  let workspaces: { findAdminUserIds: Mock };

  beforeEach(() => {
    engine = {
      executeBackgroundSubgraph: jest.fn().mockResolvedValue(undefined),
    };
    notifications = { createMany: jest.fn().mockResolvedValue(undefined) };
    workspaces = {
      findAdminUserIds: jest.fn().mockResolvedValue(['admin-a', 'admin-b']),
    };
    processor = new BackgroundExecutionProcessor(
      engine as never,
      notifications as never,
      workspaces as never,
    );
  });

  it('delegates the job to the engine and resolves on success', async () => {
    const job = makeJob();
    await processor.process(job as never);
    expect(engine.executeBackgroundSubgraph).toHaveBeenCalledWith(job.data);
    expect(notifications.createMany).not.toHaveBeenCalled();
  });

  it('does not notify on failure when notifyOnFailure is false', async () => {
    engine.executeBackgroundSubgraph.mockRejectedValueOnce(new Error('boom'));
    const job = makeJob({
      config: { notifyOnFailure: false, maxDurationMs: 0 },
    });
    await expect(processor.process(job as never)).rejects.toThrow('boom');
    expect(notifications.createMany).not.toHaveBeenCalled();
  });

  it('notifies workspace admins on failure when notifyOnFailure is true', async () => {
    engine.executeBackgroundSubgraph.mockRejectedValueOnce(new Error('boom'));
    const job = makeJob({
      config: { notifyOnFailure: true, maxDurationMs: 0 },
    });
    await expect(processor.process(job as never)).rejects.toThrow('boom');
    expect(notifications.createMany).toHaveBeenCalledTimes(1);
    const entries = notifications.createMany.mock.calls[0][0] as Array<{
      userId: string;
      type: string;
    }>;
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe('background_failure');
  });

  it('skips notification when no admins are present', async () => {
    workspaces.findAdminUserIds.mockResolvedValueOnce([]);
    engine.executeBackgroundSubgraph.mockRejectedValueOnce(new Error('boom'));
    const job = makeJob({
      config: { notifyOnFailure: true, maxDurationMs: 0 },
    });
    await expect(processor.process(job as never)).rejects.toThrow('boom');
    expect(notifications.createMany).not.toHaveBeenCalled();
  });

  it('skips notification when workspaceId is missing', async () => {
    engine.executeBackgroundSubgraph.mockRejectedValueOnce(new Error('boom'));
    const job = makeJob({
      workspaceId: '',
      config: { notifyOnFailure: true, maxDurationMs: 0 },
    });
    await expect(processor.process(job as never)).rejects.toThrow('boom');
    expect(workspaces.findAdminUserIds).not.toHaveBeenCalled();
    expect(notifications.createMany).not.toHaveBeenCalled();
  });
});
