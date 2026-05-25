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
 *     인 문서를 한 번의 UPDATE ... RETURNING 으로 `pending` 으로 전환 + 회수 대상 id 배열을
 *     동시 회수. 이 후 한 번의 `queue.addBulk` 로 일괄 add 한다 (N+1 회피).
 *   - 다중 인스턴스 부팅 시 동시 실행 안전성: PostgreSQL UPDATE 는 row-level lock 을 사용하므로
 *     두 인스턴스 중 하나만 행을 set 하고 다른 쪽은 RETURNING 결과가 비어 큐잉 자체가 일어나지 않는다.
 *   - graph 도 동일 패턴.
 *   - `last_attempted_at` 이 NULL 인 레거시 데이터는 회수 대상에서 제외 (false-positive 방지).
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
    // UPDATE ... RETURNING 으로 SELECT + UPDATE 를 원자적으로 결합.
    // 다중 인스턴스가 동시에 돌려도 단일 row 의 status='processing' 가드가 mutual exclusion 역할.
    // RETURNING 으로 실제 전환된 행만 회수해 이중 큐잉을 차단한다.
    //
    // TypeORM v0.3 의 `DataSource.query` 는 UPDATE/DELETE 에 대해 `[rows, rowCount]`
    // 튜플을 반환한다 (PostgresQueryRunner). destructure 로 실제 rows 배열만 꺼내지
    // 않으면 `rows.length === 2` 가 항상 참이 되어, 매 부팅마다 `documentId: undefined`
    // 인 가짜 job 2개가 큐잉되고 processor 가 drop 하는 회귀가 발생한다.
    const [rows] = await this.dataSource.query<
      [
        {
          id: string;
          knowledge_base_id: string;
          rag_mode: 'vector' | 'graph';
        }[],
        number,
      ]
    >(
      `UPDATE document d
          SET embedding_status = 'pending',
              embedding_error_message = COALESCE(embedding_error_message, 'Recovered from stuck processing state at boot')
         FROM knowledge_base kb
        WHERE d.knowledge_base_id = kb.id
          AND d.embedding_status = 'processing'
          AND d.embedding_last_attempted_at IS NOT NULL
          AND d.embedding_last_attempted_at < NOW() - ($1::text || ' ms')::interval
        RETURNING d.id, d.knowledge_base_id, kb.rag_mode`,
      [String(this.STUCK_THRESHOLD_MS)],
    );

    if (rows.length === 0) return;
    this.logger.warn(
      `Recovering ${rows.length} stuck embedding document(s) (>10min in 'processing')`,
    );

    // addBulk 단일 호출로 BullMQ 부하 최소화.
    await this.embeddingQueue.addBulk(
      rows.map((row) => ({
        name: 'embed',
        data: {
          documentId: row.id,
          knowledgeBaseId: row.knowledge_base_id,
          ragMode: row.rag_mode,
          reEmbed: true, // chunk idempotent 보장
        },
      })),
    );
  }

  private async recoverStuckGraphExtraction(): Promise<void> {
    // recoverStuckEmbedding 과 동일 — UPDATE/DELETE 시 `DataSource.query` 의
    // `[rows, rowCount]` 튜플 destructure 가 필수.
    const [rows] = await this.dataSource.query<
      [{ id: string; knowledge_base_id: string }[], number]
    >(
      `UPDATE document
          SET graph_extraction_status = 'pending',
              graph_error_message = COALESCE(graph_error_message, 'Recovered from stuck processing state at boot')
        WHERE graph_extraction_status = 'processing'
          AND graph_last_attempted_at IS NOT NULL
          AND graph_last_attempted_at < NOW() - ($1::text || ' ms')::interval
        RETURNING id, knowledge_base_id`,
      [String(this.STUCK_THRESHOLD_MS)],
    );

    if (rows.length === 0) return;
    this.logger.warn(
      `Recovering ${rows.length} stuck graph-extraction document(s) (>10min in 'processing')`,
    );

    await this.graphQueue.addBulk(
      rows.map((row) => ({
        name: 'extract',
        data: {
          documentId: row.id,
          knowledgeBaseId: row.knowledge_base_id,
        },
      })),
    );
  }
}
