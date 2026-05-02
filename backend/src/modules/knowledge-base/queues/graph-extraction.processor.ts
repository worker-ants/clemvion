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
 * - process: GraphExtractionService.extractDocument 위임
 * - completed/failed: KB batch 의 마지막 child 였다면 KB.reextract_status 를 idle 로 reset
 *   (해당 KB 의 graph_extraction_status 가 pending/processing 인 문서가 0 건일 때만)
 *
 * Worker concurrency 는 LLM API rate limit 보호 차원에서 2 로 보수적 설정.
 */
@Processor(GRAPH_EXTRACTION_QUEUE, { concurrency: 2 })
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
      const rows = await this.dataSource.query<{ count: number }[]>(
        `SELECT COUNT(*)::int AS count FROM document
         WHERE knowledge_base_id = $1
           AND graph_extraction_status IN ('pending', 'processing')`,
        [data.knowledgeBaseId],
      );
      const remaining = rows[0]?.count ?? 0;
      if (remaining === 0) {
        await this.dataSource.query(
          `UPDATE knowledge_base SET reextract_status = 'idle' WHERE id = $1`,
          [data.knowledgeBaseId],
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to finalize KB graph batch for ${data.knowledgeBaseId}: ${msg}`,
      );
    }
  }
}
