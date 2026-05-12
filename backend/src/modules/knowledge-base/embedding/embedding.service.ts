import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Document } from '../entities/document.entity';
import { DocumentChunk } from '../entities/document-chunk.entity';
import { KnowledgeBase } from '../entities/knowledge-base.entity';
import { S3Service } from '../../../common/services/s3.service';
import { LlmService } from '../../llm/llm.service';
import { sanitizeLlmErrorMessage } from '../../llm/utils/sanitize-error.util';
import { WebsocketService } from '../../websocket/websocket.service';
import { parseDocument } from '../parsers/parser.factory';
import { chunkText } from '../chunking/text-chunker';
import {
  isRetryableLlmError,
  retryWithBackoff,
} from '../utils/retry-with-backoff.util';
import { isValidDocumentId } from '../queues/job-payload.util';

// 한 batch (20 청크) 임베딩에 적용할 timeout. provider socket hang 방지.
const EMBED_TIMEOUT_MS = 60_000;
// 자동 재시도 횟수 + 지수 백오프 base. baseDelayMs * 4^i → 1s, 4s, 16s (+ ±30% jitter).
const EMBED_MAX_RETRIES = 3;
const EMBED_BASE_DELAY_MS = 1_000;
// error_message 컬럼에 저장할 최대 길이. provider 가 비정상 거대 응답을 반환해도 스토리지 폭발 방지.
const ERROR_MESSAGE_MAX_LEN = 2_000;

function capErrorMessage(message: string): string {
  return message.length > ERROR_MESSAGE_MAX_LEN
    ? message.slice(0, ERROR_MESSAGE_MAX_LEN)
    : message;
}

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
  //
  // 재시도 정책 (spec/5-system/8-embedding-pipeline.md "Retry & Failure"):
  // - 1차 시도에서 LLM timeout / 5xx / network 같은 일시 오류 발생 시 1s / 4s / 16s 백오프로 최대 3회 자동 재시도
  // - 재시도가 발생한 attempt 마다 `embedding_status='error'` + `embedding_retry_count++` + WS `document:embedding_retry`
  // - 모든 재시도 소진 또는 비재시도성 오류 (401/403/422/차원 mismatch 등) 발생 시 `embedding_status='failed'` 로 최종 전환 + WS `document:embedding_failed`
  // - 성공 시 `embedding_status='completed'`, `embedding_retry_count=0`, `embedding_error_message=NULL` 로 리셋
  // - 2차 시도 이상에서는 chunk 상태 idempotency 보장을 위해 `reEmbed=true` 강제 (chunk 삭제 후 다시 처리)
  async processDocument(documentId: string, reEmbed = false): Promise<void> {
    // 큐 워커 경로에서는 processor 가 검증. 본 가드는 직접 호출 경로(테스트/스크립트) 방어용.
    if (!isValidDocumentId(documentId)) {
      this.logger.error(
        `processDocument called with invalid documentId: ${String(documentId)} ` +
          `(typeof=${typeof documentId})`,
      );
      return;
    }
    // attemptIndex: 0 = 1차 시도. retryWithBackoff 의 onAttempt 가 실패 직후 호출되며
    // idx+1 로 다음 시도 번호를 세팅한다. doProcess 는 2차+ attempt 에서 reEmbed=true 를 강제해
    // 부분 INSERT 된 chunk 를 깨끗히 정리 (idempotency 보장).
    let attemptIndex = 0;
    try {
      await retryWithBackoff(
        () => this.doProcess(documentId, reEmbed || attemptIndex > 0),
        {
          maxRetries: EMBED_MAX_RETRIES,
          baseDelayMs: EMBED_BASE_DELAY_MS,
          isRetryable: isRetryableLlmError,
          onAttempt: async (idx, err, willRetry) => {
            attemptIndex = idx + 1;
            const safe = capErrorMessage(
              sanitizeLlmErrorMessage(
                err instanceof Error ? err.message : String(err),
              ),
            );
            this.logger.warn(
              `Embedding attempt ${idx + 1} failed for document ${documentId}` +
                (willRetry ? ' — scheduling retry' : ' — final failure') +
                `: ${safe}`,
            );
            // retry_count 는 모든 attempt 실패마다 누적 (사용자 진단용).
            await this.documentRepository.increment(
              { id: documentId },
              'embeddingRetryCount',
              1,
            );
            if (willRetry) {
              // 일시 오류 단계: status='error' + retry 이벤트 emit. 최종 실패는 outer catch 에서 'failed'.
              await this.documentRepository.update(documentId, {
                embeddingStatus: 'error',
                embeddingErrorMessage: safe,
                embeddingLastAttemptedAt: new Date(),
              });
              this.emitEvent(documentId, 'document:embedding_retry', {
                attempt: idx + 1,
                maxAttempts: EMBED_MAX_RETRIES + 1,
                error: safe,
              });
            }
            // willRetry=false: outer catch 가 곧 'failed' 로 단일 UPDATE → 이중 DB 쓰기 회피
          },
        },
      );
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const safe = capErrorMessage(sanitizeLlmErrorMessage(raw));
      this.logger.error(
        `Embedding failed permanently for document ${documentId}: ${raw}`,
      );
      await this.documentRepository.update(documentId, {
        embeddingStatus: 'failed',
        embeddingErrorMessage: safe,
        embeddingLastAttemptedAt: new Date(),
      });
      this.emitEvent(documentId, 'document:embedding_failed', {
        error: safe,
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

    // Update status — 재시도 진입 시점에도 processing 으로 reset.
    await this.documentRepository.update(documentId, {
      embeddingStatus: 'processing',
      embeddingLastAttemptedAt: new Date(),
    });
    this.emitEvent(documentId, 'document:embedding_started', {
      knowledgeBaseId: kb.id,
    });

    // Delete existing chunks if re-embedding (수동 재실행 또는 2차+ 재시도 attempt).
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
        embeddingRetryCount: 0,
        embeddingErrorMessage: null,
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
        embeddingRetryCount: 0,
        embeddingErrorMessage: null,
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
    // 부분 실패 시 chunk 가 일부만 저장될 수 있으나, 2차 attempt 부터 reEmbed=true 가
    // 강제되어 chunk 가 깨끗히 정리되므로 idempotent.
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
        // disableInnerRetry: 외부 retryWithBackoff 가 재시도를 통제하므로 LlmService 내부의
        // rate-limit-only withRetry 와 겹쳐 호출이 비선형 증폭되는 것을 막는다.
        { timeoutMs: EMBED_TIMEOUT_MS, disableInnerRetry: true },
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

    // 7. Update document status — 성공 시 retry/error 메타데이터 리셋.
    await this.documentRepository.update(documentId, {
      embeddingStatus: 'completed',
      chunkCount: chunks.length,
      embeddingRetryCount: 0,
      embeddingErrorMessage: null,
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
      // `kb:${documentId}` 채널로 직접 broadcast (V038 fix — 기존 emitExecutionEvent 는
      // 채널을 `execution:` prefix 로 변환해 frontend 의 `kb:` subscribe 와 매칭 안 됐음).
      this.websocketService.emitKbEvent(
        documentId,
        event as Parameters<typeof this.websocketService.emitKbEvent>[1],
        payload,
      );
    } catch {
      // WebSocket emission is best-effort
    }
  }
}
