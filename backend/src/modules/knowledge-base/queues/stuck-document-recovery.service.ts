import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import {
  DOCUMENT_EMBEDDING_QUEUE,
  DocumentEmbeddingJob,
} from './document-embedding.queue';
import {
  GRAPH_EXTRACTION_QUEUE,
  GraphExtractionJob,
} from './graph-extraction.queue';

/**
 * 백엔드 부팅 시점에 `processing` 상태로 멈춰버린 문서를 회수해 다시 큐에 넣는다.
 *
 * BullMQ 자체의 `stalledInterval` 가 워커 OOM/SIGKILL 같은 일부 케이스는 자동 회복하지만,
 * 다음 케이스는 자동 회복되지 않는다:
 *   1. LLM 호출이 timeout 없이 무한 hang → 워커는 살아있지만 잡이 진행 안 됨
 *      (PR2 의 withTimeout / retryWithBackoff 적용 후로는 발생하지 않아야 하지만 방어용)
 *   2. 워커가 정상 종료 후 재부팅 사이에 in-flight 잡이 stalled 인식 전에 process restart
 *   3. 멀티-인스턴스 환경에서 옛 인스턴스가 갑자기 사라진 직후 재배포되는 경우
 *
 * 동작:
 *   - `embedding_last_attempted_at < NOW() - 10min AND embedding_status = 'processing'`
 *     인 문서를 `pending` 으로 되돌려 `document-embedding` 큐에 add (retry_count 보존)
 *   - graph 도 동일하게 `graph_last_attempted_at`·`graph_extraction_status` 기준
 *   - `last_attempted_at` 이 NULL 인 레거시 데이터는 회수 대상에서 제외 (false-positive 방지)
 *
 * 10분 임계 산정:
 *   - BullMQ stalledInterval(30s) × 2 + 부팅 지연 + 마진. 너무 짧으면 정상 임베딩 중인
 *     거대 PDF (50MB 상한) 가 false-positive 로 회수될 수 있음.
 *   - 향후 env 외부화 검토 가능.
 */
@Injectable()
export class StuckDocumentRecoveryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StuckDocumentRecoveryService.name);
  private readonly STUCK_THRESHOLD_MS = 10 * 60 * 1000;

  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue(DOCUMENT_EMBEDDING_QUEUE)
    private readonly embeddingQueue: Queue<DocumentEmbeddingJob>,
    @InjectQueue(GRAPH_EXTRACTION_QUEUE)
    private readonly graphQueue: Queue<GraphExtractionJob>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.recoverStuckEmbedding();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to recover stuck embedding documents: ${msg}`);
    }
    try {
      await this.recoverStuckGraphExtraction();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to recover stuck graph-extraction documents: ${msg}`,
      );
    }
  }

  private async recoverStuckEmbedding(): Promise<void> {
    // SELECT ... FOR UPDATE 없이도 안전 — 다중 인스턴스가 부팅 시점에 같은 SQL 을 돌려도
    // UPDATE 가 행을 'pending' 으로 단일 전환하고, BullMQ 가 job 의 jobId(uuid) 충돌을
    // 명시적으로 처리하지 않으므로 producer 측에서 명시적 jobId 를 두지 않는다.
    // race 발생 시 같은 문서가 두 번 큐잉되어도 worker 단계에서 idempotent (reEmbed=true).
    const rows = await this.dataSource.query<
      { id: string; knowledge_base_id: string; rag_mode: 'vector' | 'graph' }[]
    >(
      `SELECT d.id, d.knowledge_base_id, kb.rag_mode
         FROM document d
         JOIN knowledge_base kb ON kb.id = d.knowledge_base_id
        WHERE d.embedding_status = 'processing'
          AND d.embedding_last_attempted_at IS NOT NULL
          AND d.embedding_last_attempted_at < NOW() - ($1::text || ' ms')::interval`,
      [String(this.STUCK_THRESHOLD_MS)],
    );

    if (rows.length === 0) return;
    this.logger.warn(
      `Recovering ${rows.length} stuck embedding document(s) (>10min in 'processing')`,
    );

    for (const row of rows) {
      await this.dataSource.query(
        `UPDATE document
            SET embedding_status = 'pending',
                embedding_error_message = COALESCE(embedding_error_message, 'Recovered from stuck processing state at boot')
          WHERE id = $1 AND embedding_status = 'processing'`,
        [row.id],
      );
      await this.embeddingQueue.add('embed', {
        documentId: row.id,
        knowledgeBaseId: row.knowledge_base_id,
        ragMode: row.rag_mode,
        reEmbed: true, // chunk idempotent 보장
      });
    }
  }

  private async recoverStuckGraphExtraction(): Promise<void> {
    const rows = await this.dataSource.query<
      { id: string; knowledge_base_id: string }[]
    >(
      `SELECT id, knowledge_base_id
         FROM document
        WHERE graph_extraction_status = 'processing'
          AND graph_last_attempted_at IS NOT NULL
          AND graph_last_attempted_at < NOW() - ($1::text || ' ms')::interval`,
      [String(this.STUCK_THRESHOLD_MS)],
    );

    if (rows.length === 0) return;
    this.logger.warn(
      `Recovering ${rows.length} stuck graph-extraction document(s) (>10min in 'processing')`,
    );

    for (const row of rows) {
      await this.dataSource.query(
        `UPDATE document
            SET graph_extraction_status = 'pending',
                graph_error_message = COALESCE(graph_error_message, 'Recovered from stuck processing state at boot')
          WHERE id = $1 AND graph_extraction_status = 'processing'`,
        [row.id],
      );
      await this.graphQueue.add('extract', {
        documentId: row.id,
        knowledgeBaseId: row.knowledge_base_id,
      });
    }
  }
}
