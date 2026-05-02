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

    // 4. Resolve embedding LLM config
    const llmConfig = await this.llmService.resolveConfig(
      undefined,
      kb.workspaceId,
    );

    // 5. Batch embed (with dimension consistency check)
    // 같은 KB 의 모든 청크는 동일 차원이어야 한다 (spec/5-system/8-embedding-pipeline.md §5.3).
    // 첫 임베딩이면 첫 vector 의 차원을 채택, 이후엔 일관성을 강제한다.
    const batchSize = 20;
    const allEmbeddings: number[][] = [];
    let expectedDim: number | null = kb.embeddingDimension;
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
      allEmbeddings.push(...embeddings);

      // Emit progress
      const progress = Math.round(((i + batch.length) / chunks.length) * 100);
      this.emitEvent(documentId, 'document:embedding_progress', {
        progress,
      });
    }

    // 6. Save chunks with embeddings using bulk INSERT for performance
    const batchInsertSize = 100;
    const newDim = expectedDim;
    await this.dataSource.transaction(async (manager) => {
      for (let b = 0; b < chunks.length; b += batchInsertSize) {
        const batchChunks = chunks.slice(b, b + batchInsertSize);
        const batchEmbeddings = allEmbeddings.slice(b, b + batchInsertSize);

        const values: string[] = [];
        const params: unknown[] = [];
        let paramIdx = 1;

        for (let i = 0; i < batchChunks.length; i++) {
          const chunk = batchChunks[i];
          const embedding = batchEmbeddings[i];
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

        await manager.query(
          `INSERT INTO document_chunk (document_id, knowledge_base_id, content, chunk_index, embedding, token_count, metadata)
           VALUES ${values.join(', ')}`,
          params,
        );
      }

      // KB 의 embedding_dimension 이 비어 있을 때만 첫 임베딩 차원으로 채운다.
      // (이미 값이 있다면 위의 일관성 검증이 통과한 상태이므로 변경 불필요)
      if (kb.embeddingDimension == null && newDim != null) {
        await manager.query(
          `UPDATE knowledge_base SET embedding_dimension = $1 WHERE id = $2 AND embedding_dimension IS NULL`,
          [newDim, kb.id],
        );
      }
    });

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
