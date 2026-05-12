/* eslint-disable no-console */
/**
 * BullMQ 큐 손상 job 1회성 정리 스크립트.
 *
 * `documentId` 가 비어있는(undefined/null/'' /공백/non-string) job 만 찾아낸다.
 * - 정상 흐름의 producer 는 항상 DB UUID 를 채워 enqueue 하므로 false-positive 없음
 * - Redis 에 누적된 손상/레거시 job 이 worker 부팅 직후 폭주하는 회귀를 청소
 *
 * 본 스크립트는 NestJS AppModule 을 부팅하지 않고 BullMQ Queue 만 직접 생성하므로
 * `@Processor` 워커가 활성화되지 않는다. DB 자격증명도 메모리에 로드되지 않는다.
 *
 * 사용 (`ts-node` 가 devDependencies 에 있어야 함):
 *   # dry-run — 출력만, 삭제 없음
 *   npx ts-node backend/scripts/cleanup-invalid-queue-jobs.ts
 *
 *   # apply — 손상 job 만 remove()
 *   npx ts-node backend/scripts/cleanup-invalid-queue-jobs.ts --apply
 *
 * 운영 절차:
 *   1) **워커 stop / 큐 pause** — 활성 처리 중 job 이 false-positive 로 잡히는
 *      TOCTOU 를 방지하기 위해 backend 인스턴스를 중지하거나 큐를 paused 상태로 둔다.
 *   2) dry-run 실행 → 출력 검토 (jobId / name / timestamp / payloadKeys)
 *   3) --apply 로 1회 정리
 *   4) 워커 재기동
 *
 * 본 스크립트는 회귀 재발 대비로 `scripts/` 에 보존한다 — 일회성이지만 운영자가
 * 동일 증상을 마주칠 때 재실행 가능.
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Queue, type Job } from 'bullmq';

{
  const envPath = path.resolve(__dirname, '..', '.env');
  const result = dotenv.config({ path: envPath });
  if (result.error && require.main === module) {
    console.warn(`[cleanup-invalid-queue-jobs] no .env at ${envPath}`);
  }
}

import { DOCUMENT_EMBEDDING_QUEUE } from '../src/modules/knowledge-base/queues/document-embedding.queue';
import { GRAPH_EXTRACTION_QUEUE } from '../src/modules/knowledge-base/queues/graph-extraction.queue';
import { isValidDocumentId } from '../src/modules/knowledge-base/queues/job-payload.util';

const QUEUE_STATES = ['waiting', 'delayed', 'failed', 'paused'] as const;
const PAGE_SIZE = 1000;

function createQueue(name: string): Queue {
  const host = process.env.REDIS_HOST ?? 'localhost';
  const port = Number(process.env.REDIS_PORT ?? 6379);
  return new Queue(name, { connection: { host, port } });
}

async function sweepQueue(
  name: string,
  queue: Queue,
  apply: boolean,
): Promise<number> {
  console.log(`[${name}] scanning states=${QUEUE_STATES.join(',')}`);

  let invalidTotal = 0;
  let start = 0;
  // 페이지네이션 — 수만 건 이상 누적 시 OOM 방지.
  while (true) {
    const page = (await queue.getJobs(
      [...QUEUE_STATES],
      start,
      start + PAGE_SIZE - 1,
    )) as Job[];
    if (page.length === 0) break;

    const invalidPage = page.filter(
      (j) =>
        !isValidDocumentId(
          (j.data as { documentId?: unknown } | undefined)?.documentId,
        ),
    );
    for (const job of invalidPage) {
      const keys = Object.keys(job.data ?? {}).join(',');
      console.log(
        `  jobId=${job.id} name=${job.name} ts=${job.timestamp} attempts=${job.attemptsMade} payloadKeys=[${keys}]`,
      );
    }
    if (apply && invalidPage.length > 0) {
      await Promise.all(
        invalidPage.map((j) =>
          j.remove().catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`    remove failed for jobId=${j.id}: ${msg}`);
          }),
        ),
      );
    }
    invalidTotal += invalidPage.length;
    if (page.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }
  console.log(`[${name}] invalid=${invalidTotal}`);
  return invalidTotal;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const queues = [DOCUMENT_EMBEDDING_QUEUE, GRAPH_EXTRACTION_QUEUE].map(
    (name) => ({ name, queue: createQueue(name) }),
  );

  let totalInvalid = 0;
  try {
    for (const { name, queue } of queues) {
      totalInvalid += await sweepQueue(name, queue, apply);
    }
  } finally {
    await Promise.all(queues.map(({ queue }) => queue.close()));
  }

  console.log(
    apply
      ? `Removed ${totalInvalid} invalid jobs.`
      : `Found ${totalInvalid} invalid jobs (dry-run — pass --apply to remove).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
