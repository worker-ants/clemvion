import type { Job, Queue } from 'bullmq';

import {
  formatSummaryLine,
  parseCleanupArgs,
  sweepInvalidJobs,
  type CleanupSummary,
} from './cleanup-invalid-jobs.util';

type FakeJob = Pick<Job, 'id' | 'name' | 'timestamp' | 'attemptsMade'> & {
  data: { documentId?: unknown } & Record<string, unknown>;
  remove: jest.Mock;
};

function makeJob(
  id: string,
  documentId: unknown,
  extra: Record<string, unknown> = {},
): FakeJob {
  return {
    id,
    name: `job-${id}`,
    timestamp: 1700000000000,
    attemptsMade: 0,
    data: { documentId, ...extra },
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

interface FakeQueue {
  getJobs: jest.Mock;
  pause: jest.Mock;
  resume: jest.Mock;
}

function makeQueue(pages: FakeJob[][]): FakeQueue {
  const getJobs = jest.fn();
  pages.forEach((p) => getJobs.mockResolvedValueOnce(p));
  getJobs.mockResolvedValue([]); // any further calls
  return {
    getJobs,
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
  };
}

describe('parseCleanupArgs', () => {
  it('default: apply/pauseDuringSweep both false', () => {
    expect(parseCleanupArgs([])).toEqual({
      apply: false,
      pauseDuringSweep: false,
    });
  });

  it('--apply only', () => {
    expect(parseCleanupArgs(['--apply'])).toEqual({
      apply: true,
      pauseDuringSweep: false,
    });
  });

  it('--pause-during-sweep only', () => {
    expect(parseCleanupArgs(['--pause-during-sweep'])).toEqual({
      apply: false,
      pauseDuringSweep: true,
    });
  });

  it('both flags', () => {
    expect(parseCleanupArgs(['--apply', '--pause-during-sweep'])).toEqual({
      apply: true,
      pauseDuringSweep: true,
    });
  });

  it('unknown flags are ignored (npm/node forwards)', () => {
    expect(parseCleanupArgs(['--apply', '--', '/some/path', 'foo'])).toEqual({
      apply: true,
      pauseDuringSweep: false,
    });
  });
});

describe('formatSummaryLine', () => {
  it('serializes per-queue record as single JSON line', () => {
    const rec: CleanupSummary = {
      queue: 'document-embedding',
      invalid: 3,
      removed: 3,
      applied: true,
    };
    const line = formatSummaryLine(rec);
    expect(line).toBe(
      '{"queue":"document-embedding","invalid":3,"removed":3,"applied":true}',
    );
    expect(line.includes('\n')).toBe(false);
  });

  it('serializes total record', () => {
    const line = formatSummaryLine({
      total: true,
      invalid: 5,
      removed: 0,
      applied: false,
    });
    expect(line).toBe('{"total":true,"invalid":5,"removed":0,"applied":false}');
  });
});

describe('sweepInvalidJobs', () => {
  it('dry-run: counts invalid but never calls remove() or pause()', async () => {
    const invalid = makeJob('1', undefined);
    const valid = makeJob('2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    const queue = makeQueue([[invalid, valid]]);

    const summary = await sweepInvalidJobs({
      name: 'document-embedding',
      queue: queue as unknown as Queue,
      apply: false,
      pauseDuringSweep: false,
    });

    expect(summary).toEqual({
      queue: 'document-embedding',
      invalid: 1,
      removed: 0,
      applied: false,
    });
    expect(invalid.remove).not.toHaveBeenCalled();
    expect(valid.remove).not.toHaveBeenCalled();
    expect(queue.pause).not.toHaveBeenCalled();
    expect(queue.resume).not.toHaveBeenCalled();
  });

  it('apply: removes invalid jobs only', async () => {
    const invalidA = makeJob('1', '');
    const invalidB = makeJob('2', '   ');
    const validA = makeJob('3', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    const queue = makeQueue([[invalidA, invalidB, validA]]);

    const summary = await sweepInvalidJobs({
      name: 'document-embedding',
      queue: queue as unknown as Queue,
      apply: true,
      pauseDuringSweep: false,
    });

    expect(summary.invalid).toBe(2);
    expect(summary.removed).toBe(2);
    expect(summary.applied).toBe(true);
    expect(invalidA.remove).toHaveBeenCalledTimes(1);
    expect(invalidB.remove).toHaveBeenCalledTimes(1);
    expect(validA.remove).not.toHaveBeenCalled();
  });

  it('treats non-string documentId as invalid', async () => {
    const numId = makeJob('1', 42 as unknown);
    const nullId = makeJob('2', null);
    const queue = makeQueue([[numId, nullId]]);

    const summary = await sweepInvalidJobs({
      name: 'graph-extraction',
      queue: queue as unknown as Queue,
      apply: false,
      pauseDuringSweep: false,
    });

    expect(summary.invalid).toBe(2);
  });

  it('pauseDuringSweep=true: pauses before sweep, resumes after', async () => {
    const callOrder: string[] = [];
    const queue: FakeQueue = {
      pause: jest.fn(() => {
        callOrder.push('pause');
        return Promise.resolve();
      }),
      getJobs: jest.fn(() => {
        callOrder.push('getJobs');
        return Promise.resolve([] as FakeJob[]);
      }),
      resume: jest.fn(() => {
        callOrder.push('resume');
        return Promise.resolve();
      }),
    };

    await sweepInvalidJobs({
      name: 'document-embedding',
      queue: queue as unknown as Queue,
      apply: false,
      pauseDuringSweep: true,
    });

    expect(callOrder[0]).toBe('pause');
    expect(callOrder[callOrder.length - 1]).toBe('resume');
    expect(callOrder).toContain('getJobs');
  });

  it('pauseDuringSweep=true: resumes even when sweep throws', async () => {
    const queue: FakeQueue = {
      getJobs: jest.fn().mockRejectedValue(new Error('redis down')),
      pause: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
    };

    await expect(
      sweepInvalidJobs({
        name: 'document-embedding',
        queue: queue as unknown as Queue,
        apply: false,
        pauseDuringSweep: true,
      }),
    ).rejects.toThrow('redis down');

    expect(queue.pause).toHaveBeenCalledTimes(1);
    expect(queue.resume).toHaveBeenCalledTimes(1);
  });

  it('paginates: keeps scanning while page is full', async () => {
    const PAGE_SIZE = 1000;
    const page1 = Array.from({ length: PAGE_SIZE }, (_, i) =>
      makeJob(
        `p1-${i}`,
        i % 2 === 0 ? '' : 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      ),
    );
    const page2 = [makeJob('p2-0', undefined)];
    const queue = makeQueue([page1, page2]);

    const summary = await sweepInvalidJobs({
      name: 'document-embedding',
      queue: queue as unknown as Queue,
      apply: false,
      pauseDuringSweep: false,
    });

    expect(queue.getJobs).toHaveBeenCalledTimes(2);
    expect(summary.invalid).toBe(PAGE_SIZE / 2 + 1);
  });

  it('continues counting when individual remove() fails', async () => {
    const a = makeJob('1', undefined);
    a.remove = jest.fn().mockRejectedValue(new Error('boom'));
    const b = makeJob('2', null);
    const queue = makeQueue([[a, b]]);

    const summary = await sweepInvalidJobs({
      name: 'document-embedding',
      queue: queue as unknown as Queue,
      apply: true,
      pauseDuringSweep: false,
    });

    // Both detected; only one successfully removed.
    expect(summary.invalid).toBe(2);
    expect(summary.removed).toBe(1);
  });
});
