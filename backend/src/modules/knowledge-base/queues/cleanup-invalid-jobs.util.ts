import type { Job, Queue } from 'bullmq';

import { isValidDocumentId } from './job-payload.util';

type InvalidJobCandidate = Job<
  { documentId?: unknown } & Record<string, unknown>
>;

export const CLEANUP_QUEUE_STATES = [
  'waiting',
  'delayed',
  'failed',
  'paused',
] as const;

export const CLEANUP_PAGE_SIZE = 1000;

export interface CleanupArgs {
  apply: boolean;
  pauseDuringSweep: boolean;
}

export interface SweepOptions {
  name: string;
  queue: Queue;
  apply: boolean;
  pauseDuringSweep: boolean;
  logger?: CleanupLogger;
}

export interface CleanupLogger {
  log: (line: string) => void;
  warn: (line: string) => void;
}

export type CleanupSummary =
  | {
      queue: string;
      invalid: number;
      removed: number;
      applied: boolean;
    }
  | {
      total: true;
      invalid: number;
      removed: number;
      applied: boolean;
    };

const SILENT_LOGGER: CleanupLogger = { log: () => {}, warn: () => {} };

export function parseCleanupArgs(argv: readonly string[]): CleanupArgs {
  return {
    apply: argv.includes('--apply'),
    pauseDuringSweep: argv.includes('--pause-during-sweep'),
  };
}

export function formatSummaryLine(record: CleanupSummary): string {
  return JSON.stringify(record);
}

export async function sweepInvalidJobs(
  options: SweepOptions,
): Promise<CleanupSummary> {
  const { name, queue, apply, pauseDuringSweep } = options;
  const logger = options.logger ?? SILENT_LOGGER;

  if (pauseDuringSweep) {
    await queue.pause();
  }
  try {
    return await runSweep(name, queue, apply, logger);
  } finally {
    if (pauseDuringSweep) {
      await queue.resume();
    }
  }
}

async function runSweep(
  name: string,
  queue: Queue,
  apply: boolean,
  logger: CleanupLogger,
): Promise<CleanupSummary> {
  logger.log(`[${name}] scanning states=${CLEANUP_QUEUE_STATES.join(',')}`);

  let invalidTotal = 0;
  let removedTotal = 0;
  let start = 0;
  while (true) {
    const page = (await queue.getJobs(
      [...CLEANUP_QUEUE_STATES],
      start,
      start + CLEANUP_PAGE_SIZE - 1,
    )) as InvalidJobCandidate[];
    if (page.length === 0) break;

    const invalidPage = page.filter(
      (j) => !isValidDocumentId(j.data?.documentId),
    );
    for (const job of invalidPage) {
      const keys = Object.keys(job.data ?? {}).join(',');
      logger.log(
        `  jobId=${job.id} name=${job.name} ts=${job.timestamp} attempts=${job.attemptsMade} payloadKeys=[${keys}]`,
      );
    }
    invalidTotal += invalidPage.length;

    if (apply && invalidPage.length > 0) {
      const results = await Promise.all(
        invalidPage.map((j) =>
          j
            .remove()
            .then(() => true)
            .catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              logger.warn(`    remove failed for jobId=${j.id}: ${msg}`);
              return false;
            }),
        ),
      );
      removedTotal += results.filter(Boolean).length;
    }

    if (page.length < CLEANUP_PAGE_SIZE) break;
    start += CLEANUP_PAGE_SIZE;
  }

  logger.log(`[${name}] invalid=${invalidTotal} removed=${removedTotal}`);

  return {
    queue: name,
    invalid: invalidTotal,
    removed: removedTotal,
    applied: apply,
  };
}
