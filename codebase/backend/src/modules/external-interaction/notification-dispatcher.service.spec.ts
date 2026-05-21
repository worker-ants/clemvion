import { NotificationDispatcher } from './notification-dispatcher.service';
import type { Queue } from 'bullmq';

type AnyMock = jest.Mock;

function makeQueueMock(): { queue: jest.Mocked<Queue>; add: AnyMock } {
  const add = jest.fn().mockResolvedValue({ id: 'job-1' });
  return { queue: { add } as never, add };
}

describe('NotificationDispatcher.enqueue', () => {
  it('skip — queue 미가용 시 reason="queue_unavailable" 반환', async () => {
    const d = new NotificationDispatcher(undefined);
    const result = await d.enqueue({
      triggerId: 'trg-1',
      eventType: 'execution.completed',
      executionId: 'exec-1',
      workflowId: 'wf-1',
      eventBody: { ok: true },
    });
    expect(result).toEqual({ skipped: true, reason: 'queue_unavailable' });
  });

  it('성공 — UUID 자동 발급 + jobId=deliveryId 로 dedup', async () => {
    const { queue, add } = makeQueueMock();
    const d = new NotificationDispatcher(queue);
    const result = await d.enqueue({
      triggerId: 'trg-1',
      eventType: 'execution.completed',
      executionId: 'exec-1',
      workflowId: 'wf-1',
      eventBody: { ok: true },
    });
    if ('skipped' in result) throw new Error('expected delivery');
    expect(result.deliveryId).toMatch(/^[0-9a-f-]{36}$/);
    expect(add).toHaveBeenCalledTimes(1);
    const [name, payload, opts] = add.mock.calls[0];
    expect(name).toBe('notify:execution.completed');
    expect(payload).toMatchObject({
      deliveryId: result.deliveryId,
      triggerId: 'trg-1',
      eventType: 'execution.completed',
      executionId: 'exec-1',
      workflowId: 'wf-1',
      eventBody: { ok: true },
    });
    expect(opts).toMatchObject({
      jobId: result.deliveryId,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
    });
  });

  it('명시 deliveryId 가 있으면 그대로 사용 (재시도 시 동일 키)', async () => {
    const { queue, add } = makeQueueMock();
    const d = new NotificationDispatcher(queue);
    const result = await d.enqueue({
      deliveryId: 'fixed-id',
      triggerId: 'trg-1',
      eventType: 'execution.waiting_for_input',
      executionId: 'exec-1',
      workflowId: 'wf-1',
      eventBody: { foo: 'bar' },
    });
    if ('skipped' in result) throw new Error('expected delivery');
    expect(result.deliveryId).toBe('fixed-id');
    expect(add.mock.calls[0][2]).toMatchObject({ jobId: 'fixed-id' });
  });

  it('attempts override — 호출자가 trigger config 의 maxAttempts 를 반영', async () => {
    const { queue, add } = makeQueueMock();
    const d = new NotificationDispatcher(queue);
    await d.enqueue(
      {
        triggerId: 'trg-1',
        eventType: 'execution.completed',
        executionId: 'exec-1',
        workflowId: 'wf-1',
        eventBody: {},
      },
      { attempts: 3 },
    );
    expect(add.mock.calls[0][2]).toMatchObject({ attempts: 3 });
  });
});
