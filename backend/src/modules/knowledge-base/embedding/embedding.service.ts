import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Document } from '../entities/document.entity';
import { DocumentChunk } from '../entities/document-chunk.entity';
import { KnowledgeBase } from '../entities/knowledge-base.entity';
import { S3Service } from '../../../common/services/s3.service';
import { LlmService } from '../../llm/llm.service';
import { WebsocketService } from '../../websocket/websocket.service';
import { parseDocument } from '../parsers/parser.factory';
import { chunkText } from '../chunking/text-chunker';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentChunk)
    private readonly chunkRepository: Repository<DocumentChunk>,
    @InjectRepository(KnowledgeBase)
    private readonly kbRepository: Repository<KnowledgeBase>,
    private readonly s3Service: S3Service,
    private readonly llmService: LlmService,
    @Inject(forwardRef(() => WebsocketService))
    private readonly websocketService: WebsocketService,
    private readonly dataSource: DataSource,
  ) {}

  // 동시 실행 상한은 BullMQ DocumentEmbeddingProcessor 의 worker concurrency 가
  // 담당 (다중 인스턴스 환경에서도 Redis 가 분산 동시성을 제공).
  // 본 메서드는 큐 워커 또는 테스트에서 직접 호출되는 단일 작업 처리 진입점.
  async processDocument(documentId: string, reEmbed = false): Promise<void> {
    try {
      await this.doProcess(documentId, reEmbed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Embedding failed for document ${documentId}: ${message}`,
      );
      await this.documentRepository.update(documentId, {
        embeddingStatus: 'error',
        metadata: { error: message },
      });
      this.emitEvent(documentId, 'document:embedding_error', {
        error: message,
      });
    }
  }

  private async doProcess(documentId: string, reEmbed: boolean): Promise<void> {
    const doc = await this.documentRepository.findOne({
      where: { id: documentId },
    });
    if (!doc) {
      throw new Error(`Document ${documentId} not found`);
    }

    const kb = await this.kbRepository.findOne({
      where: { id: doc.knowledgeBaseId },
    });
    if (!kb) {
      throw new Error(`Knowledge base ${doc.knowledgeBaseId} not found`);
    }

    // Update status
    await this.documentRepository.update(documentId, {
      embeddingStatus: 'processing',
    });
    this.emitEvent(documentId, 'document:embedding_started', {
      knowledgeBaseId: kb.id,
    });

    // Delete existing chunks if re-embedding
    if (reEmbed) {
      await this.chunkRepository.delete({ documentId });
    }

    // 1. Download file from S3
    const fileBuffer = await this.s3Service.download(doc.fileUrl);

    // 2. Parse file to text
    const text = await parseDocument(fileBuffer, doc.fileType);
    if (!text.trim()) {
      await this.documentRepository.update(documentId, {
        embeddingStatus: 'completed',
        chunkCount: 0,
      });
      this.emitEvent(documentId, 'document:embedding_completed', {
        chunkCount: 0,
      });
      return;
    }

    // 3. Chunk text
    const chunks = chunkText(text, {
      chunkSize: kb.chunkSize,
      chunkOverlap: kb.chunkOverlap,
    });

    if (chunks.length === 0) {
      await this.documentRepository.update(documentId, {
        embeddingStatus: 'completed',
        chunkCount: 0,
      });
      this.emitEvent(documentId, 'document:embedding_completed', {
        chunkCount: 0,
      });
      return;
    }

    // 4. Resolve embedding LLM config (KB 가 지정한 config 우선, 없으면 ws default)
    const llmConfig = await this.llmService.resolveConfig(
      kb.embeddingLlmConfigId ?? undefined,
      kb.workspaceId,
    );

    // 5. Batch embed + INSERT 인터리빙 (스트리밍 처리)
    // 같은 KB 의 모든 청크는 동일 차원이어야 한다 (spec/5-system/8-embedding-pipeline.md §5.3).
    // 첫 임베딩이면 첫 vector 의 차원을 채택, 이후엔 일관성을 강제한다.
    //
    // 메모리 효율: 모든 임베딩을 누적 후 한 번에 INSERT 하던 방식을 batch 단위 즉시
    // INSERT 로 바꿔, 메모리 보유량을 batch(20개 청크) × dim 으로 일정하게 유지한다.
    // 부분 실패 시 chunk 가 일부만 저장될 수 있으나, document.embedding_status 가
    // 'error' 로 표시되고 사용자가 reEmbed=true 로 재실행하면 모든 chunk 가 깨끗히
    // 정리된다 (processDocument 시작부에서 reEmbed=true 면 chunk 전체 삭제).
    const batchSize = 20;
    let expectedDim: number | null = kb.embeddingDimension;
    let dimensionPersisted = kb.embeddingDimension != null;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map((c) => c.content);
      const embeddings = await this.llmService.embed(
        llmConfig,
        texts,
        kb.embeddingModel,
      );

      for (const v of embeddings) {
        if (!v || v.length === 0) {
          throw new Error('Embedding vector is empty');
        }
        if (expectedDim == null) {
          expectedDim = v.length;
        } else if (v.length !== expectedDim) {
          throw new Error(
            `Embedding dimension mismatch for KB ${kb.id} (model=${kb.embeddingModel}): expected ${expectedDim}, got ${v.length}. KB-wide re-embedding is required.`,
          );
        }
      }

      // 첫 batch 임베딩 직후 KB.embedding_dimension 을 race-free 하게 채운다.
      // `WHERE embedding_dimension IS NULL OR embedding_dimension = $1` 조건으로
      // 동일 KB 의 동시 첫 임베딩 두 트랜잭션이 같은 dim 을 set 해도 무해.
      // 다른 dim 을 시도하면 0행 RETURNING + 다음 일관성 검증에서 throw 로 거른다.
      if (!dimensionPersisted && expectedDim != null) {
        await this.dataSource.query(
          `UPDATE knowledge_base SET embedding_dimension = $1
           WHERE id = $2 AND (embedding_dimension IS NULL OR embedding_dimension = $1)`,
          [expectedDim, kb.id],
        );
        dimensionPersisted = true;
      }

      // 즉시 bulk INSERT (트랜잭션 외부 — 부분 실패는 reEmbed 로 정리)
      const values: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embedding = embeddings[j];
        const vectorStr = `[${embedding.join(',')}]`;
        values.push(
          `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}::vector, $${paramIdx + 5}, $${paramIdx + 6})`,
        );
        params.push(
          documentId,
          kb.id,
          chunk.content,
          chunk.index,
          vectorStr,
          chunk.tokenCount,
          JSON.stringify({}),
        );
        paramIdx += 7;
      }
      await this.dataSource.query(
        `INSERT INTO document_chunk (document_id, knowledge_base_id, content, chunk_index, embedding, token_count, metadata)
         VALUES ${values.join(', ')}`,
        params,
      );

      // Emit progress
      const progress = Math.round(((i + batch.length) / chunks.length) * 100);
      this.emitEvent(documentId, 'document:embedding_progress', {
        progress,
      });
    }

    // 7. Update document status
    await this.documentRepository.update(documentId, {
      embeddingStatus: 'completed',
      chunkCount: chunks.length,
    });

    this.emitEvent(documentId, 'document:embedding_completed', {
      chunkCount: chunks.length,
    });

    this.logger.log(
      `Embedding completed for document ${documentId}: ${chunks.length} chunks`,
    );
  }

  private emitEvent(
    documentId: string,
    event: string,
    payload: Record<string, unknown>,
  ): void {
    try {
      // Use workspace-level channel for KB events
      this.websocketService.emitExecutionEvent(
        `kb:${documentId}`,
        event as never,
        { documentId, ...payload },
      );
    } catch {
      // WebSocket emission is best-effort
    }
  }
}
