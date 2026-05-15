import { BackgroundExecutionProcessor } from './background-execution.processor';
import type { BackgroundExecutionJob } from './background-execution.queue';

type Mock = jest.Mock;

function makeJob(
  over: Partial<BackgroundExecutionJob> = {},
  attemptsMade = 0,
): {
  data: BackgroundExecutionJob;
  attemptsMade: number;
} {
  return {
    attemptsMade,
    data: {
      executionId: 'exec-1',
      parentNodeExecutionId: 'pne-1',
      backgroundRunId: 'bg-run-1',
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
  let websocket: { emitBackgroundRunEvent: Mock };

  beforeEach(() => {
    engine = {
      executeBackgroundSubgraph: jest.fn().mockResolvedValue(undefined),
    };
    notifications = { createMany: jest.fn().mockResolvedValue(undefined) };
    workspaces = {
      findAdminUserIds: jest.fn().mockResolvedValue(['admin-a', 'admin-b']),
    };
    websocket = { emitBackgroundRunEvent: jest.fn() };
    processor = new BackgroundExecutionProcessor(
      engine as never,
      notifications as never,
      workspaces as never,
      websocket as never,
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
      resourceType: string;
      resourceId: string;
    }>;
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe('background_failure');
    // Background 모니터링 API 가 정확히 attribute 하도록 backgroundRunId 로 기록.
    expect(entries[0].resourceType).toBe('background_run');
    expect(entries[0].resourceId).toBe('bg-run-1');
  });

  it('emits BACKGROUND_RUN_STARTED and BACKGROUND_RUN_COMPLETED on success', async () => {
    const job = makeJob();
    await processor.process(job as never);
    expect(websocket.emitBackgroundRunEvent).toHaveBeenCalledTimes(2);
    const firstCall = websocket.emitBackgroundRunEvent.mock.calls[0];
    expect(firstCall[0]).toBe('bg-run-1');
    expect(firstCall[1]).toBe('execution.background_run.started');
    const secondCall = websocket.emitBackgroundRunEvent.mock.calls[1];
    expect(secondCall[1]).toBe('execution.background_run.completed');
    const secondPayload = secondCall[2] as { status: string };
    expect(secondPayload.status).toBe('completed');
  });

  it('emits BACKGROUND_RUN_COMPLETED with status=failed on subgraph error', async () => {
    engine.executeBackgroundSubgraph.mockRejectedValueOnce(new Error('boom'));
    const job = makeJob({
      config: { notifyOnFailure: false, maxDurationMs: 0 },
    });
    await expect(processor.process(job as never)).rejects.toThrow('boom');
    // started + completed(failed)
    expect(websocket.emitBackgroundRunEvent).toHaveBeenCalledTimes(2);
    const calls = websocket.emitBackgroundRunEvent.mock.calls;
    const failedPayload = calls[1][2] as { status: string; errorMessage?: string };
    expect(failedPayload.status).toBe('failed');
    expect(failedPayload.errorMessage).toBe('boom');
  });

  it('falls back to executionId for resource attribution when backgroundRunId is empty (legacy NodeExecution)', async () => {
    engine.executeBackgroundSubgraph.mockRejectedValueOnce(new Error('boom'));
    const job = makeJob({
      backgroundRunId: '',
      config: { notifyOnFailure: true, maxDurationMs: 0 },
    });
    await expect(processor.process(job as never)).rejects.toThrow('boom');
    const entries = notifications.createMany.mock.calls[0][0] as Array<{
      resourceType: string;
      resourceId: string;
    }>;
    expect(entries[0].resourceType).toBe('execution');
    expect(entries[0].resourceId).toBe('exec-1');
    // WS emit skipped when backgroundRunId is empty (no channel to route to).
    expect(websocket.emitBackgroundRunEvent).not.toHaveBeenCalled();
  });

  it('skips BACKGROUND_RUN_STARTED on retry (attemptsMade > 0) to keep events idempotent', async () => {
    const retryJob = makeJob({}, 1);
    await processor.process(retryJob as never);
    // only completed is emitted on retry success — started already fired
    // during attemptsMade=0
    const events = websocket.emitBackgroundRunEvent.mock.calls.map(
      (c) => c[1] as string,
    );
    expect(events).toEqual(['execution.background_run.completed']);
  });

  it('sanitizes error messages — stack traces stripped, length capped, connection strings redacted', async () => {
    const longSecret = 'x'.repeat(600);
    const err = new Error(
      `pg connect failed: postgres://user:secret@db.internal:5432/app\n  at Connection.handle (/app/dist/conn.js:42:11)\n  at processTicksAndRejections (node:internal/process:96:5)\n${longSecret}`,
    );
    engine.executeBackgroundSubgraph.mockRejectedValueOnce(err);
    const job = makeJob({
      config: { notifyOnFailure: true, maxDurationMs: 0 },
    });
    await expect(processor.process(job as never)).rejects.toThrow();
    const failedPayload = websocket.emitBackgroundRunEvent.mock
      .calls[1][2] as { errorMessage?: string };
    const errorMessage = failedPayload.errorMessage ?? '';
    expect(errorMessage).not.toContain('postgres://');
    expect(errorMessage).toContain('[REDACTED_URI]');
    expect(errorMessage).not.toContain(' at Connection.handle');
    // length capped at 500 + ellipsis (501)
    expect(errorMessage.length).toBeLessThanOrEqual(501);
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
