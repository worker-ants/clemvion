/**
 * BullMQ 큐 손상 job 정리 스크립트 (운영 + 개발 공용).
 *
 * `documentId` 가 비어있는(undefined/null/'' /공백/non-string) job 만 찾아낸다.
 * - 정상 흐름의 producer 는 항상 DB UUID 를 채워 enqueue 하므로 false-positive 없음
 * - Redis 에 누적된 손상/레거시 job 또는 `InvalidJobPayloadError` 가드로 `failed`
 *   상태로 보존된 잔재를 청소
 *
 * 본 스크립트는 NestJS AppModule 을 부팅하지 않고 BullMQ Queue 만 직접 생성하므로
 * `@Processor` 워커가 활성화되지 않는다. DB 자격증명도 메모리에 로드되지 않는다.
 *
 * 사용 (개발 환경, ts-node 가 devDependencies 에 있을 때):
 *
 *   # dry-run — 출력만, 삭제 없음
 *   npx ts-node backend/src/scripts/cleanup-invalid-queue-jobs.ts
 *
 *   # apply — 손상 job 만 remove()
 *   npx ts-node backend/src/scripts/cleanup-invalid-queue-jobs.ts --apply
 *
 *   # apply + sweep 동안 큐 자동 pause (TOCTOU 방지)
 *   npx ts-node backend/src/scripts/cleanup-invalid-queue-jobs.ts --apply --pause-during-sweep
 *
 * 사용 (운영 환경, 컴파일된 dist 산출물 사용):
 *
 *   # 권장: 컨테이너 안에서 npm script 호출 (dry-run / apply 분리)
 *   docker compose exec backend npm run cleanup:queue-jobs           # dry-run
 *   docker compose exec backend npm run cleanup:queue-jobs:apply     # --apply --pause-during-sweep
 *
 *   # 또는 dist 직접 (수동으로 flag 조합이 필요할 때)
 *   node backend/dist/scripts/cleanup-invalid-queue-jobs.js --apply --pause-during-sweep
 *
 * 운영 절차:
 *   1) `--pause-during-sweep` 사용 시 스크립트가 sweep 직전 `queue.pause()`,
 *      종료 시 `queue.resume()` 을 자동 수행해 TOCTOU 를 차단한다. 워커 인스턴스
 *      자체를 별도로 stop 할 필요 없음.
 *   2) 옵션 없이 dry-run → 출력 검토 (jobId / name / timestamp / payloadKeys)
 *   3) --apply 로 정리
 *
 * 마지막 줄에는 grep 친화적인 JSON summary 가 큐별 + 합계로 출력된다 (한 줄씩).
 * 예: `{"queue":"document-embedding","invalid":3,"removed":3,"applied":true}`
 *
 * 본 스크립트는 회귀 재발 대비로 보존한다 — 운영자가 동일 증상을 마주칠 때 재실행 가능.
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Queue } from 'bullmq';

/**
 * `.env` 로드는 `main()` 진입 시에만 수행 — module import 만으로 `process.env`
 * 가 오염되면 단위 테스트나 본 모듈을 import 하는 코드가 통제 불가능해진다
 * (migrate-button-ids.ts 와 동일 패턴).
 */
function loadDotenv(): void {
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.warn(`[cleanup-invalid-queue-jobs] no .env at ${envPath}`);
  }
}

import { DOCUMENT_EMBEDDING_QUEUE } from '../modules/knowledge-base/queues/document-embedding.queue';
import { GRAPH_EXTRACTION_QUEUE } from '../modules/knowledge-base/queues/graph-extraction.queue';
import {
  formatSummaryLine,
  parseCleanupArgs,
  sweepInvalidJobs,
  type CleanupSummary,
} from '../modules/knowledge-base/queues/cleanup-invalid-jobs.util';

function createQueue(name: string): Queue {
  const host = process.env.REDIS_HOST ?? 'localhost';
  const port = Number(process.env.REDIS_PORT ?? 6379);
  return new Queue(name, { connection: { host, port } });
}

async function main(): Promise<void> {
  loadDotenv();
  const { apply, pauseDuringSweep } = parseCleanupArgs(process.argv.slice(2));
  const queues = [DOCUMENT_EMBEDDING_QUEUE, GRAPH_EXTRACTION_QUEUE].map(
    (name) => ({ name, queue: createQueue(name) }),
  );

  const summaries: CleanupSummary[] = [];
  try {
    for (const { name, queue } of queues) {
      const summary = await sweepInvalidJobs({
        name,
        queue,
        apply,
        pauseDuringSweep,
        logger: { log: console.log, warn: console.warn },
      });
      summaries.push(summary);
    }
  } finally {
    // queue.close() 실패가 JSON summary 출력을 가리지 않도록, summary 먼저 출력
    // → 그 다음 close. close 자체 실패는 warn 으로 강등 (이미 sweep 자체는 끝났음).
    let totalInvalid = 0;
    let totalRemoved = 0;
    for (const s of summaries) {
      console.log(formatSummaryLine(s));
      totalInvalid += s.invalid;
      totalRemoved += s.removed;
    }
    console.log(
      formatSummaryLine({
        total: true,
        invalid: totalInvalid,
        removed: totalRemoved,
        applied: apply,
      }),
    );

    await Promise.all(
      queues.map(({ name, queue }) =>
        queue.close().catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[${name}] queue.close() failed: ${msg}`);
        }),
      ),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
