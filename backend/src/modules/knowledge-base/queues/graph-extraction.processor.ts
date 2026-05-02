import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import type { Job } from 'bullmq';
import { DataSource } from 'typeorm';
import {
  GRAPH_EXTRACTION_QUEUE,
  GraphExtractionJob,
} from './graph-extraction.queue';
import { GraphExtractionService } from '../graph/graph-extraction.service';

/**
 * graph-extraction 큐 워커.
 *
 * - process: GraphExtractionService.extractDocument 위임 (내부에서 try-catch 로
 *   document.graph_extraction_status 를 'error' 로 set 후 정상 종료. process() 자체가
 *   throw 하는 경우는 DB 일시 단절 등 매우 드문 케이스이며 BullMQ 의 attempts/backoff 로
 *   회복).
 * - completed/failed: KB batch 의 마지막 child 였다면 KB.reextract_status 를 idle 로 reset
 *   (해당 KB 의 graph_extraction_status 가 pending/processing 인 문서가 0 건일 때만).
 *
 * Worker concurrency = 2 (LLM API rate limit 보호).
 * stalledInterval = 30s — 워커 OOM/SIGKILL 등 강제 종료 시 BullMQ 가 stalled 로 감지해
 * 자동 재처리. extract 로직은 idempotent (entity/relation 모두 UPSERT, chunk_entity 도
 * (chunk_id, entity_id) PK 충돌 시 무시) 라 재처리에 안전.
 */
@Processor(GRAPH_EXTRACTION_QUEUE, {
  concurrency: 2,
  stalledInterval: 30_000,
})
export class GraphExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(GraphExtractionProcessor.name);

  constructor(
    @Inject(forwardRef(() => GraphExtractionService))
    private readonly extractionService: GraphExtractionService,
    private readonly dataSource: DataSource,
  ) {
    super();
  }

  async process(job: Job<GraphExtractionJob>): Promise<void> {
    const { documentId } = job.data;
    await this.extractionService.extractDocument(documentId);
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job<GraphExtractionJob>): Promise<void> {
    await this.maybeFinalizeKbBatch(job.data);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<GraphExtractionJob>): Promise<void> {
    // 한 child 의 실패가 다른 child 진행을 막지 않도록 동일 finalize 로직 적용.
    await this.maybeFinalizeKbBatch(job.data);
  }

  private async maybeFinalizeKbBatch(
    data: GraphExtractionJob | undefined,
  ): Promise<void> {
    if (!data?.isKbBatch || !data.knowledgeBaseId) return;
    try {
      // SELECT remaining 후 UPDATE 패턴은 두 쿼리 사이 TOCTOU 가 발생할 수 있어
      // 단일 atomic UPDATE 로 통합. NOT EXISTS 가 즉시 평가되므로 동시 child 가
      // 끝나도 race-free 하게 reextract_status 가 idle 로 reset.
      await this.dataSource.query(
        `UPDATE knowledge_base
           SET reextract_status = 'idle'
         WHERE id = $1
           AND reextract_status = 'in_progress'
           AND NOT EXISTS (
             SELECT 1 FROM document
              WHERE knowledge_base_id = $1
                AND graph_extraction_status IN ('pending', 'processing')
           )`,
        [data.knowledgeBaseId],
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to finalize KB graph batch for ${data.knowledgeBaseId}: ${msg}`,
      );
    }
  }
}
