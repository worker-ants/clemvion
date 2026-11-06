import { Logger } from '@nestjs/common';
import { NotificationDispatcher } from './notification-dispatcher.service';
import {
  NOTIFICATION_BACKOFF_TYPE,
  notificationBackoffDelayMs,
} from './notification-dispatcher.types';
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
      // base-4 custom backoff (§6.6) — worker settings.backoffStrategy 가 지연 계산.
      backoff: { type: NOTIFICATION_BACKOFF_TYPE },
    });
  });

  it('base-4 backoff 지연 — 1s / 4s / 16s / 64s / 256s (§6.6)', () => {
    expect(notificationBackoffDelayMs(1)).toBe(1_000);
    expect(notificationBackoffDelayMs(2)).toBe(4_000);
    expect(notificationBackoffDelayMs(3)).toBe(16_000);
    expect(notificationBackoffDelayMs(4)).toBe(64_000);
    expect(notificationBackoffDelayMs(5)).toBe(256_000);
    // 방어: 0/음수 attemptsMade 는 최소 1s (BullMQ 는 1-indexed 로만 호출).
    expect(notificationBackoffDelayMs(0)).toBe(1_000);
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

// CLE-T-AB21M6 — 큐 적재(`queue.add`)가 거부되면 dispatcher 가 받아 경고 로그를 남기고 건너뛴 결과를 돌려준다.
// Redis 연결이 끊긴 뒤 ioredis 가 재연결을 다 쓰면 `MaxRetriesPerRequestError` 로 거부된다(CLE-EIA-DATA Rationale
// 「알림 적재 실패를 경고 로그로 받는다」의 측정). 다시 적재하지 않는다.
describe('NotificationDispatcher.enqueue — 적재 실패', () => {
  const job = {
    triggerId: 'trg-1',
    eventType: 'execution.completed',
    executionId: 'exec-1',
    workflowId: 'wf-1',
    eventBody: { ok: true },
  };
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('queue.add 가 거부되면 reason="enqueue_failed" 로 건너뛰고 경고를 남긴다', async () => {
    const { queue, add } = makeQueueMock();
    const err = Object.assign(
      new Error(
        'Reached the max retries per request limit (which is 20). Refer to "maxRetriesPerRequest" option for details.',
      ),
      { name: 'MaxRetriesPerRequestError' },
    );
    add.mockRejectedValue(err);
    const d = new NotificationDispatcher(queue);

    await expect(d.enqueue({ ...job, deliveryId: 'dlv-9' })).resolves.toEqual({
      skipped: true,
      reason: 'enqueue_failed',
    });

    expect(add).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0][0]);
    expect(message).toContain('dlv-9');
    expect(message).toContain('trg-1');
    expect(message).toContain('max retries per request');
  });

  it('Error 가 아닌 값으로 거부돼도 건너뛴다', async () => {
    const { queue, add } = makeQueueMock();
    add.mockRejectedValue('connection is closed');
    const d = new NotificationDispatcher(queue);

    await expect(d.enqueue(job)).resolves.toEqual({
      skipped: true,
      reason: 'enqueue_failed',
    });
    expect(String(warn.mock.calls[0][0])).toContain('connection is closed');
  });

  it('다시 적재하지 않는다(add 는 한 번만 부른다)', async () => {
    const { queue, add } = makeQueueMock();
    add.mockRejectedValue(new Error('Connection is closed.'));
    const d = new NotificationDispatcher(queue);
    await d.enqueue(job);
    expect(add).toHaveBeenCalledTimes(1);
  });
});
