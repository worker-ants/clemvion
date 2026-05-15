import type { Job, Queue } from 'bullmq';

import { isValidDocumentId } from './job-payload.util';

type InvalidJobCandidate = Job<
  { documentId?: unknown } & Record<string, unknown>
>;

/**
 * sweep 대상 BullMQ 큐 상태. `active` 는 처리 중인 job 을 sweep 해 데이터 손상이
 * 나는 것을 막기 위해 제외, `completed` 는 어차피 자동 만료되므로 비대상.
 * `paused` 는 운영자가 일시 정지한 큐의 잔재까지 청소할 수 있게 포함.
 */
export const CLEANUP_QUEUE_STATES = [
  'waiting',
  'delayed',
  'failed',
  'paused',
] as const;
const CLEANUP_QUEUE_STATES_MUTABLE: Array<
  (typeof CLEANUP_QUEUE_STATES)[number]
> = [...CLEANUP_QUEUE_STATES];

export const CLEANUP_PAGE_SIZE = 1000;

export interface CleanupArgs {
  apply: boolean;
  pauseDuringSweep: boolean;
}

export interface SweepOptions {
  name: string;
  queue: Queue;
  /** true 면 손상 job 을 실제로 `remove()`. false 면 출력만(dry-run). */
  apply: boolean;
  /** true 면 sweep 직전 `queue.pause()`, finally `queue.resume()` — 워커가 sweep 대상 job 을 동시 처리해 TOCTOU 가 나는 것을 차단. */
  pauseDuringSweep: boolean;
  logger?: CleanupLogger;
}

export interface CleanupLogger {
  log: (line: string) => void;
  warn: (line: string) => void;
}

/**
 * sweep 결과. queue 별 한 줄 + 합계 한 줄(`total: true`) 로 사용한다.
 * 운영 로그 grep 친화를 위해 `formatSummaryLine` 으로 한 줄 JSON 화.
 */
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

/** `--apply` / `--pause-during-sweep` 두 flag 의 boolean 만 본다. 알 수 없는 인자는 무시 (npm/node 의 `--` 전달용). */
export function parseCleanupArgs(argv: readonly string[]): CleanupArgs {
  return {
    apply: argv.includes('--apply'),
    pauseDuringSweep: argv.includes('--pause-during-sweep'),
  };
}

/** `CleanupSummary` 를 한 줄 JSON 으로 직렬화. 운영자가 `grep '"applied":true'` 등으로 사후 추적 가능하도록 줄바꿈을 끼우지 않는다. */
export function formatSummaryLine(record: CleanupSummary): string {
  return JSON.stringify(record);
}

/**
 * 단일 큐를 sweep 한다. `pauseDuringSweep=true` 일 때 `queue.pause()` 와 `queue.resume()`
 * 으로 sweep 구간 동안 워커 처리를 막아 false-positive 를 차단. sweep 도중 예외가 나도
 * `finally` 가 resume 을 보장한다.
 *
 * 주의 — 본 함수는 큐 하나의 단위 sweep 이며, 호출자가 큐 여러 개를 순차 처리하는 경우
 * 다음 큐의 pause 직전까지 짧은 gap 이 존재한다. 호출자는 sweep 도중 비정상 종료가 발생하면
 * 잔존하는 paused 상태가 있을 수 있음을 인지해야 한다 (자동 복구 책임은 호출자에 위임).
 */
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
      CLEANUP_QUEUE_STATES_MUTABLE,
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

    let removedThisPage = 0;
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
      removedThisPage = results.filter(Boolean).length;
      removedTotal += removedThisPage;
    }

    if (page.length < CLEANUP_PAGE_SIZE) break;
    // apply 시 페이지 안에서 일부 job 이 제거되면 큐의 offset 도 그만큼 앞당겨진다.
    // 다음 페이지 호출에서 같은 인덱스를 다시 묻지 않도록 제거된 수만큼 보정.
    start += CLEANUP_PAGE_SIZE - removedThisPage;
  }

  logger.log(`[${name}] invalid=${invalidTotal} removed=${removedTotal}`);

  return {
    queue: name,
    invalid: invalidTotal,
    removed: removedTotal,
    applied: apply,
  };
}
