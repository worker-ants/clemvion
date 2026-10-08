import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { Queue } from 'bullmq';

import { sweepInvalidJobs } from '../src/modules/knowledge-base/queues/cleanup-invalid-jobs.util';

/**
 * e2e: 큐 정리 sweep 이 실제 BullMQ · Redis 의 일시 정지 동작과 맞는지 본다.
 *
 * 단위 테스트는 `getJobs` 를 mock 하므로 «BullMQ 6 에서는 일시 정지한 큐의 job 도
 * `waiting` 으로 보인다» 는 전제를 확인하지 못한다. `cleanup:queue-jobs:apply` 는 늘
 * `--pause-during-sweep` 으로 돌기 때문에 이 전제가 깨지면 sweep 이 아무것도 지우지 않고
 * 조용히 끝난다. 그래서 실제 Redis 위의 큐로 두 가지를 고정한다.
 *   1) 일시 정지한 큐의 job 을 `getJobCounts('waiting')` · `getJobs(['waiting'])` 가 돌려준다.
 *   2) `pauseDuringSweep` 으로 돈 sweep 이 손상 job 을 찾아 지우고 큐를 재개한다.
 *
 * 큐 이름은 테스트마다 새로 만들어 backend 워커가 소비하는 큐와 겹치지 않게 한다.
 */

const connection = {
  host: process.env.REDIS_HOST ?? 'redis',
  port: Number(process.env.REDIS_PORT ?? '6379'),
  ...(process.env.REDIS_PASSWORD
    ? { password: process.env.REDIS_PASSWORD }
    : {}),
};

describe('큐 정리 sweep 과 BullMQ 일시 정지 (실제 Redis)', () => {
  let queue: Queue;

  beforeEach(() => {
    queue = new Queue(`e2e-cleanup-sweep-${randomUUID()}`, { connection });
  });

  afterEach(async () => {
    await queue.obliterate({ force: true });
    await queue.close();
  });

  it('일시 정지한 큐의 job 을 waiting 으로 센다', async () => {
    await queue.pause();
    await queue.add('embed', { documentId: 'doc-1' });

    expect(await queue.isPaused()).toBe(true);
    expect(await queue.getJobCounts('waiting')).toEqual({ waiting: 1 });
    expect(await queue.getJobs(['waiting'])).toHaveLength(1);
  });

  it('pauseDuringSweep 으로 돈 sweep 이 손상 job 만 지우고 큐를 재개한다', async () => {
    await queue.add('embed', { documentId: 'doc-1' });
    await queue.add('embed', { knowledgeBaseId: 'kb-1' });

    const summary = await sweepInvalidJobs({
      name: 'document-embedding',
      queue,
      apply: true,
      pauseDuringSweep: true,
    });

    expect(summary).toEqual({
      queue: 'document-embedding',
      invalid: 1,
      removed: 1,
      applied: true,
    });
    expect(await queue.isPaused()).toBe(false);
    const left = await queue.getJobs(['waiting']);
    expect(left.map((j) => j.data)).toEqual([{ documentId: 'doc-1' }]);
  });
});
