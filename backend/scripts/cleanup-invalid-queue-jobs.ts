/* eslint-disable no-console */
/**
 * BullMQ 큐 손상 job 1회성 정리 스크립트.
 *
 * `documentId` 가 비어있는(undefined/null/'' /공백/non-string) job 만 찾아낸다.
 * - 정상 흐름의 producer 는 항상 DB UUID 를 채워 enqueue 하므로 false-positive 없음
 * - Redis 에 누적된 손상/레거시 job 이 worker 부팅 직후 폭주하는 회귀를 청소
 *
 * 사용:
 *   # dry-run — 출력만, 삭제 없음
 *   npx ts-node backend/scripts/cleanup-invalid-queue-jobs.ts
 *
 *   # apply — 손상 job 만 remove()
 *   npx ts-node backend/scripts/cleanup-invalid-queue-jobs.ts --apply
 *
 * 운영 절차:
 *   1) dry-run 실행 → 출력 검토
 *   2) jobId / name / timestamp / payload keys 가 손상 패턴과 일치하는지 확인
 *   3) --apply 로 1회 정리
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue, Job } from 'bullmq';

{
  const envPath = path.resolve(__dirname, '..', '.env');
  const result = dotenv.config({ path: envPath });
  if (result.error && require.main === module) {
    console.warn(`[cleanup-invalid-queue-jobs] no .env at ${envPath}`);
  }
}

import { AppModule } from '../src/app.module';
import { DOCUMENT_EMBEDDING_QUEUE } from '../src/modules/knowledge-base/queues/document-embedding.queue';
import { GRAPH_EXTRACTION_QUEUE } from '../src/modules/knowledge-base/queues/graph-extraction.queue';

const QUEUE_STATES = [
  'waiting',
  'delayed',
  'failed',
  'paused',
] as const;

function isInvalid(job: Job): boolean {
  const id = (job.data as { documentId?: unknown } | undefined)?.documentId;
  return typeof id !== 'string' || id.trim() === '';
}

async function sweepQueue(
  name: string,
  queue: Queue,
  apply: boolean,
): Promise<number> {
  const jobs = await queue.getJobs([...QUEUE_STATES]);
  const invalid = jobs.filter(isInvalid);
  console.log(
    `[${name}] total=${jobs.length} invalid=${invalid.length} states=${QUEUE_STATES.join(',')}`,
  );
  for (const job of invalid) {
    const keys = Object.keys(job.data ?? {}).join(',');
    console.log(
      `  jobId=${job.id} name=${job.name} ts=${job.timestamp} attempts=${job.attemptsMade} payloadKeys=[${keys}]`,
    );
    if (apply) {
      try {
        await job.remove();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`    remove failed for jobId=${job.id}: ${msg}`);
      }
    }
  }
  return invalid.length;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });

  let totalInvalid = 0;
  for (const name of [DOCUMENT_EMBEDDING_QUEUE, GRAPH_EXTRACTION_QUEUE]) {
    const queue = app.get<Queue>(getQueueToken(name));
    totalInvalid += await sweepQueue(name, queue, apply);
  }

  console.log(
    apply
      ? `Removed ${totalInvalid} invalid jobs.`
      : `Found ${totalInvalid} invalid jobs (dry-run — pass --apply to remove).`,
  );

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
