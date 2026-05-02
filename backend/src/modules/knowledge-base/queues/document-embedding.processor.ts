import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import {
  DOCUMENT_EMBEDDING_QUEUE,
  DocumentEmbeddingJob,
} from './document-embedding.queue';
import {
  GRAPH_EXTRACTION_QUEUE,
  GraphExtractionJob,
} from './graph-extraction.queue';
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
    @InjectQueue(GRAPH_EXTRACTION_QUEUE)
    private readonly graphQueue: Queue<GraphExtractionJob>,
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
    // graph 모드 KB 는 임베딩 완료 직후 graph-extraction 으로 chained dispatch.
    // KB batch 일 때는 isKbBatch 플래그를 함께 전달해, 그래프 child 의 finalize 도
    // KB.reextract_status 를 같이 끌어내릴 수 있게 한다.
    await this.maybeChainGraphExtraction(job.data);
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
      // graph batch 와 동일한 atomic 패턴 — SELECT/UPDATE 분리로 인한 TOCTOU 제거.
      await this.dataSource.query(
        `UPDATE knowledge_base
           SET reembed_status = 'idle'
         WHERE id = $1
           AND reembed_status = 'in_progress'
           AND NOT EXISTS (
             SELECT 1 FROM document
              WHERE knowledge_base_id = $1
                AND embedding_status IN ('pending', 'processing')
           )`,
        [data.knowledgeBaseId],
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to finalize KB batch for ${data.knowledgeBaseId}: ${msg}`,
      );
    }
  }

  // KB.rag_mode === 'graph' 인 경우 graph-extraction 큐로 child job 을 add 한다.
  // payload 에 ragMode 가 미리 주입돼 있으면 DB 조회 없이 분기 (99% no-op 케이스
  // 회피). payload 가 비어 있는 레거시 job 은 fallback 으로 DB JOIN.
  private async maybeChainGraphExtraction(
    data: DocumentEmbeddingJob | undefined,
  ): Promise<void> {
    if (!data?.documentId) return;
    try {
      let ragMode = data.ragMode;
      let knowledgeBaseId = data.knowledgeBaseId;
      if (!ragMode || !knowledgeBaseId) {
        const rows = await this.dataSource.query<
          { rag_mode: 'vector' | 'graph'; knowledge_base_id: string }[]
        >(
          `SELECT kb.rag_mode AS rag_mode, d.knowledge_base_id AS knowledge_base_id
           FROM document d
           JOIN knowledge_base kb ON kb.id = d.knowledge_base_id
           WHERE d.id = $1`,
          [data.documentId],
        );
        const row = rows[0];
        if (!row) return;
        ragMode = row.rag_mode;
        knowledgeBaseId = row.knowledge_base_id;
      }
      if (ragMode !== 'graph' || !knowledgeBaseId) return;
      await this.graphQueue.add('extract', {
        documentId: data.documentId,
        knowledgeBaseId,
        isKbBatch: data.isKbBatch === true,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to chain graph extraction for document ${data.documentId}: ${msg}`,
      );
    }
  }
}
