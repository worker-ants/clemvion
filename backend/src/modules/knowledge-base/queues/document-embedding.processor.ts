import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import type { Job } from 'bullmq';
import { DataSource } from 'typeorm';
import {
  DOCUMENT_EMBEDDING_QUEUE,
  DocumentEmbeddingJob,
} from './document-embedding.queue';
import { EmbeddingService } from '../embedding/embedding.service';

/**
 * 문서 임베딩 큐의 워커.
 *
 * - process 본체: EmbeddingService.processDocument 위임
 * - completed/failed: KB batch 의 마지막 child 였다면 KB.reembed_status 를 idle 로 reset
 *   (해당 KB 의 남은 pending/processing 문서 카운트가 0 일 때만)
 *
 * Worker concurrency 는 단일 프로세스 동시성 한계로, 기존 EmbeddingService 의
 * MAX_CONCURRENT 폴링 limiter 를 대체한다. 다중 인스턴스 환경에서는 Redis 가
 * 인스턴스 간 동시 처리 수를 직접 분산한다.
 */
@Processor(DOCUMENT_EMBEDDING_QUEUE, { concurrency: 3 })
export class DocumentEmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentEmbeddingProcessor.name);

  constructor(
    @Inject(forwardRef(() => EmbeddingService))
    private readonly embeddingService: EmbeddingService,
    private readonly dataSource: DataSource,
  ) {
    super();
  }

  async process(job: Job<DocumentEmbeddingJob>): Promise<void> {
    const { documentId, reEmbed } = job.data;
    await this.embeddingService.processDocument(documentId, reEmbed ?? false);
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job<DocumentEmbeddingJob>): Promise<void> {
    await this.maybeFinalizeKbBatch(job.data);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<DocumentEmbeddingJob>): Promise<void> {
    // 이 child job 이 실패해도 KB batch 의 다른 child 는 별도로 진행되므로,
    // "남은 진행 중 문서가 0 개인지" 만 일관되게 판단한다.
    await this.maybeFinalizeKbBatch(job.data);
  }

  private async maybeFinalizeKbBatch(
    data: DocumentEmbeddingJob | undefined,
  ): Promise<void> {
    if (!data?.isKbBatch || !data.knowledgeBaseId) return;
    try {
      const rows = await this.dataSource.query<{ count: number }[]>(
        `SELECT COUNT(*)::int AS count FROM document
         WHERE knowledge_base_id = $1 AND embedding_status IN ('pending', 'processing')`,
        [data.knowledgeBaseId],
      );
      const remaining = rows[0]?.count ?? 0;
      if (remaining === 0) {
        await this.dataSource.query(
          `UPDATE knowledge_base SET reembed_status = 'idle' WHERE id = $1`,
          [data.knowledgeBaseId],
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to finalize KB batch for ${data.knowledgeBaseId}: ${msg}`,
      );
    }
  }
}
