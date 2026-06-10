import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { DataSource, Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { KnowledgeBase } from './entities/knowledge-base.entity';
import { Document } from './entities/document.entity';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { EmbeddingProbeDto } from './dto/embedding-probe.dto';
import { LlmService } from '../llm/llm.service';
import { sanitizeLlmErrorMessage } from '../llm/utils/sanitize-error.util';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { S3Service } from '../../common/services/s3.service';
import {
  DOCUMENT_EMBEDDING_QUEUE,
  DocumentEmbeddingJob,
} from './queues/document-embedding.queue';
import {
  GRAPH_EXTRACTION_QUEUE,
  GraphExtractionJob,
} from './queues/graph-extraction.queue';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

const ALLOWED_FILE_TYPES = ['txt', 'md', 'pdf', 'csv'];
const CONTENT_TYPE_MAP: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  pdf: 'application/pdf',
  csv: 'text/csv',
};

/**
 * Multer (busboy) 는 multipart/form-data 의 filename 헤더를 기본적으로 latin1 로 디코딩한다.
 * 브라우저는 RFC 7578 에 따라 UTF-8 로 보내므로 latin1 한 바이트씩 잘려 깨져 보인다 (예: 한글이
 * "á __ ¢á __" 처럼 출력). 원래 바이트열로 되돌려 UTF-8 로 재해석하고, macOS HFS/APFS 가 사용하는
 * NFD (분리형) 를 NFC (결합형) 로 정규화해 전 OS 에서 동일한 글자로 보이게 한다.
 */
function decodeMulterFilename(originalname: string): string {
  return Buffer.from(originalname, 'latin1').toString('utf8').normalize('NFC');
}

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(
    @InjectRepository(KnowledgeBase)
    private readonly kbRepository: Repository<KnowledgeBase>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly s3Service: S3Service,
    private readonly dataSource: DataSource,
    @InjectQueue(DOCUMENT_EMBEDDING_QUEUE)
    private readonly embeddingQueue: Queue<DocumentEmbeddingJob>,
    @InjectQueue(GRAPH_EXTRACTION_QUEUE)
    private readonly graphQueue: Queue<GraphExtractionJob>,
    private readonly llmService: LlmService,
  ) {}

  // ── Knowledge Base CRUD ──

  async findAll(
    workspaceId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<KnowledgeBase>> {
    const { page = 1, limit = 20, search } = query;
    const qb = this.kbRepository
      .createQueryBuilder('kb')
      .where('kb.workspace_id = :workspaceId', { workspaceId });

    if (search) {
      qb.andWhere('kb.name ILIKE :search', { search: `%${search}%` });
    }
    qb.orderBy('kb.created_at', 'DESC');

    const totalItems = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return PaginatedResponseDto.create(data, totalItems, page, limit);
  }

  async findById(id: string, workspaceId: string): Promise<KnowledgeBase> {
    const kb = await this.kbRepository.findOne({
      where: { id, workspaceId },
    });
    if (!kb) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Knowledge base not found',
      });
    }
    return kb;
  }

  async create(
    workspaceId: string,
    dto: CreateKnowledgeBaseDto,
  ): Promise<KnowledgeBase> {
    const kb = this.kbRepository.create({
      workspaceId,
      name: dto.name,
      description: dto.description || undefined,
      embeddingModel: dto.embeddingModel || 'text-embedding-3-small',
      embeddingModelConfigId: dto.embeddingModelConfigId ?? null,
      embeddingLlmConfigId: dto.embeddingLlmConfigId ?? null,
      chunkSize: dto.chunkSize || 1000,
      chunkOverlap: dto.chunkOverlap || 200,
      ragMode: dto.ragMode || 'vector',
      extractionLlmConfigId: dto.extractionLlmConfigId ?? null,
      maxHops: dto.maxHops ?? 1,
      vectorSeedTopK: dto.vectorSeedTopK ?? 5,
      expandedChunkLimit: dto.expandedChunkLimit ?? 15,
      // 검색 후처리(리랭킹) — 검색 시점 적용. 기본 off 면 현행 동작.
      rerankMode: dto.rerankMode ?? 'off',
      rerankConfigId: dto.rerankConfigId ?? null,
      rerankCandidateK: dto.rerankCandidateK ?? 50,
      rerankScoreThreshold: dto.rerankScoreThreshold ?? null,
      rerankLlmConfigId: dto.rerankLlmConfigId ?? null,
    });
    return this.kbRepository.save(kb);
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateKnowledgeBaseDto,
  ): Promise<KnowledgeBase> {
    const kb = await this.findById(id, workspaceId);
    if (dto.name !== undefined) kb.name = dto.name;
    if (dto.description !== undefined) kb.description = dto.description;
    if (dto.chunkSize !== undefined) kb.chunkSize = dto.chunkSize;
    if (dto.chunkOverlap !== undefined) kb.chunkOverlap = dto.chunkOverlap;
    if (
      dto.embeddingModel !== undefined &&
      dto.embeddingModel !== kb.embeddingModel
    ) {
      // 모델이 실제로 바뀌면 차원도 새 모델 첫 임베딩으로 다시 결정해야 한다.
      // dimension 을 미리 NULL 로 초기화해 두면, 재임베딩 전 신규 문서 업로드가
      // 들어와도 EmbeddingService 가 새 모델 차원으로 자연스럽게 채울 수 있다.
      kb.embeddingModel = dto.embeddingModel;
      kb.embeddingDimension = null;
    }
    // graph 검색 파라미터 / 추출 LLMConfig 는 검색 시점에 적용되므로 갱신만 한다.
    if (dto.extractionLlmConfigId !== undefined) {
      kb.extractionLlmConfigId = dto.extractionLlmConfigId;
    }
    // 임베딩 LLMConfig 는 다음 임베딩부터 적용. 차원이 달라지면 첫 임베딩에서
    // dimension mismatch 가 throw 되므로 사용자가 KB 재임베딩을 트리거하면 된다.
    // (사전 안내는 frontend EmbeddingTestButton 의 인라인 경고가 담당.)
    if (dto.embeddingLlmConfigId !== undefined) {
      kb.embeddingLlmConfigId = dto.embeddingLlmConfigId;
    }
    // 1급 embedding config(kind=embedding) 변경 — config 가 바뀌면 모델·차원이 달라질 수
    // 있어 dimension 을 NULL 로 초기화해 첫 임베딩에서 재결정한다(embeddingModel 변경과 동형).
    if (
      dto.embeddingModelConfigId !== undefined &&
      dto.embeddingModelConfigId !== kb.embeddingModelConfigId
    ) {
      kb.embeddingModelConfigId = dto.embeddingModelConfigId;
      kb.embeddingDimension = null;
    }
    if (dto.maxHops !== undefined) kb.maxHops = dto.maxHops;
    if (dto.vectorSeedTopK !== undefined)
      kb.vectorSeedTopK = dto.vectorSeedTopK;
    if (dto.expandedChunkLimit !== undefined) {
      kb.expandedChunkLimit = dto.expandedChunkLimit;
    }
    // 검색 후처리(리랭킹) — 검색 시점 적용이라 갱신만 한다 (재임베딩 불요).
    if (dto.rerankMode !== undefined) kb.rerankMode = dto.rerankMode;
    if (dto.rerankConfigId !== undefined)
      kb.rerankConfigId = dto.rerankConfigId;
    if (dto.rerankCandidateK !== undefined)
      kb.rerankCandidateK = dto.rerankCandidateK;
    if (dto.rerankScoreThreshold !== undefined)
      kb.rerankScoreThreshold = dto.rerankScoreThreshold;
    if (dto.rerankLlmConfigId !== undefined)
      kb.rerankLlmConfigId = dto.rerankLlmConfigId;
    return this.kbRepository.save(kb);
  }

  // ── Embedding probe ──

  /**
   * 사용자가 고른 LLMConfig + 임베딩 모델 조합을 1회 embed("probe") 호출로 검증하고
   * 실제 vector 차원을 측정해 반환한다. 자기호스팅/Azure 처럼 모델명이 같아도 차원이
   * 다른 endpoint 를 KB 저장 전에 사용자에게 시각적으로 알리기 위한 라이브 probe.
   *
   * 자동 호출이 아니라 "임베딩 테스트" 버튼 클릭으로만 트리거되므로 LLM 비용 부담은
   * 사용자 액션에 비례. provider 호출 실패는 BadRequest(EMBEDDING_PROBE_FAILED) 로
   * 변환 + sanitize 해 내부 URL/API key 누출을 방지한다.
   */
  async probeEmbedding(
    workspaceId: string,
    dto: EmbeddingProbeDto,
  ): Promise<{ dimension: number; provider: string }> {
    const cfg = await this.llmService.resolveConfig(
      dto.llmConfigId,
      workspaceId,
    );
    let vectors: number[][];
    try {
      // 차원 감지용 probe — inputType 은 차원에 무관하나 명시적으로 document.
      vectors = await this.llmService.embed(
        cfg,
        ['probe'],
        dto.embeddingModel,
        undefined /* opts */,
        'document',
      );
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      throw new BadRequestException({
        code: 'EMBEDDING_PROBE_FAILED',
        message: sanitizeLlmErrorMessage(raw),
      });
    }
    const dim = vectors[0]?.length ?? 0;
    if (dim === 0) {
      throw new BadRequestException({
        code: 'EMBEDDING_PROBE_FAILED',
        message: 'Embedding probe returned an empty vector',
      });
    }
    return { dimension: dim, provider: cfg.provider };
  }

  // ── Graph RAG ──

  // KB graph 모드 검증 — graph 모드가 아닌 KB 에 그래프 API 호출 시 400.
  private assertGraphMode(kb: KnowledgeBase): void {
    if (kb.ragMode !== 'graph') {
      throw new BadRequestException({
        code: 'KB_NOT_GRAPH_MODE',
        message: 'This API is only available for graph-mode knowledge bases',
      });
    }
  }

  // KB 전체 그래프 재추출 — 모든 entity/relation/chunk_entity 삭제 후 모든 문서를 재추출.
  // atomic compare-and-swap (idle → in_progress) + DELETE + UPDATE + 문서 조회를
  // 모두 단일 트랜잭션으로 묶어 도중 크래시 시 reextract_status 영구 교착을 막는다.
  async reExtractAll(
    id: string,
    workspaceId: string,
  ): Promise<{ documentCount: number }> {
    const kb = await this.findById(id, workspaceId);
    this.assertGraphMode(kb);

    const docIds = await this.dataSource.transaction(async (manager) => {
      // 1) atomic CAS lock
      const acquired = await manager.query<{ id: string }[]>(
        `UPDATE knowledge_base
         SET reextract_status = 'in_progress', entity_count = 0, relation_count = 0
         WHERE id = $1 AND workspace_id = $2 AND reextract_status = 'idle'
         RETURNING id`,
        [id, workspaceId],
      );
      if (acquired.length === 0) {
        throw new ConflictException({
          code: 'KB_REEXTRACT_IN_PROGRESS',
          message: 'A KB graph re-extraction is already in progress',
        });
      }
      // 2) 그래프 데이터 삭제 (relation / chunk_entity 는 CASCADE)
      await manager.query(`DELETE FROM entity WHERE knowledge_base_id = $1`, [
        id,
      ]);
      // 3) 모든 문서 graph_extraction_status 를 'pending' 으로 reset + retry 메타 리셋
      await manager.query(
        `UPDATE document
            SET graph_extraction_status = 'pending',
                graph_retry_count = 0,
                graph_error_message = NULL
          WHERE knowledge_base_id = $1`,
        [id],
      );
      // 4) 문서 ID 회수 (트랜잭션 후 큐잉용)
      const rows = await manager.query<{ id: string }[]>(
        `SELECT id FROM document WHERE knowledge_base_id = $1`,
        [id],
      );
      return rows.map((r) => r.id);
    });

    if (docIds.length === 0) {
      // 빈 KB — finalize 트리거가 없어 즉시 idle 로 되돌림.
      await this.dataSource.query(
        `UPDATE knowledge_base SET reextract_status = 'idle' WHERE id = $1`,
        [id],
      );
      return { documentCount: 0 };
    }

    // 큐잉은 트랜잭션 외부 — DB 상태가 commit 된 뒤에만 worker 가 작업을 본다.
    await this.graphQueue.addBulk(
      docIds.map((docId) => ({
        name: 'extract',
        data: {
          documentId: docId,
          knowledgeBaseId: id,
          isKbBatch: true,
        },
      })),
    );
    return { documentCount: docIds.length };
  }

  // 문서 단건 그래프 재추출. KB 가 batch 재추출 중이면 409.
  async reExtractDocument(
    docId: string,
    kbId: string,
    workspaceId: string,
  ): Promise<void> {
    const kb = await this.findById(kbId, workspaceId);
    this.assertGraphMode(kb);
    if (kb.reextractStatus === 'in_progress') {
      // 배치 진행 중 단건 재추출이 들어오면 finalize 카운트 로직과 충돌해 status 영구 교착 가능.
      throw new ConflictException({
        code: 'KB_REEXTRACT_IN_PROGRESS',
        message:
          'KB graph re-extraction is in progress. Wait until it completes before re-extracting individual documents.',
      });
    }
    const doc = await this.findDocument(docId, kbId, workspaceId);

    await this.documentRepository.update(doc.id, {
      graphExtractionStatus: 'pending',
      graphRetryCount: 0,
      graphErrorMessage: null,
    });
    await this.graphQueue.add('extract', {
      documentId: doc.id,
      knowledgeBaseId: kbId,
    });
  }

  async getGraphStats(
    id: string,
    workspaceId: string,
  ): Promise<{
    entityCount: number;
    relationCount: number;
    extractedDocumentCount: number;
    failedDocumentCount: number;
    pendingDocumentCount: number;
    totalDocumentCount: number;
    reextractStatus: 'idle' | 'in_progress';
  }> {
    const kb = await this.findById(id, workspaceId);
    this.assertGraphMode(kb);

    // pending = pending|processing|error (모두 "최종 실패 전 진행 중" 으로 묶음)
    const rows = await this.dataSource.query<
      {
        extracted: number;
        failed: number;
        pending: number;
        total: number;
      }[]
    >(
      `SELECT
         COUNT(*) FILTER (WHERE graph_extraction_status = 'completed')::int AS extracted,
         COUNT(*) FILTER (WHERE graph_extraction_status = 'failed')::int AS failed,
         COUNT(*) FILTER (WHERE graph_extraction_status IN ('pending','processing','error'))::int AS pending,
         COUNT(*)::int AS total
       FROM document WHERE knowledge_base_id = $1`,
      [id],
    );
    return {
      entityCount: kb.entityCount,
      relationCount: kb.relationCount,
      extractedDocumentCount: rows[0]?.extracted ?? 0,
      failedDocumentCount: rows[0]?.failed ?? 0,
      pendingDocumentCount: rows[0]?.pending ?? 0,
      totalDocumentCount: rows[0]?.total ?? 0,
      reextractStatus: kb.reextractStatus,
    };
  }

  // KB 의 임베딩 진행 통계. vector / graph 모드 무관하게 사용.
  // pending = pending|processing|error (모두 "최종 실패 전 진행/일시 오류" 으로 묶음)
  async getEmbeddingStats(
    id: string,
    workspaceId: string,
  ): Promise<{
    completedDocumentCount: number;
    failedDocumentCount: number;
    pendingDocumentCount: number;
    totalDocumentCount: number;
    reembedStatus: 'idle' | 'in_progress';
  }> {
    const kb = await this.findById(id, workspaceId);

    const rows = await this.dataSource.query<
      {
        completed: number;
        failed: number;
        pending: number;
        total: number;
      }[]
    >(
      `SELECT
         COUNT(*) FILTER (WHERE embedding_status = 'completed')::int AS completed,
         COUNT(*) FILTER (WHERE embedding_status = 'failed')::int AS failed,
         COUNT(*) FILTER (WHERE embedding_status IN ('pending','processing','error'))::int AS pending,
         COUNT(*)::int AS total
       FROM document WHERE knowledge_base_id = $1`,
      [id],
    );
    return {
      completedDocumentCount: rows[0]?.completed ?? 0,
      failedDocumentCount: rows[0]?.failed ?? 0,
      pendingDocumentCount: rows[0]?.pending ?? 0,
      totalDocumentCount: rows[0]?.total ?? 0,
      reembedStatus: kb.reembedStatus,
    };
  }

  // 실패한 (`status = 'failed'`) 문서들을 모아 한 번에 재큐잉. 사용자가 KB 진행 박스의
  // "실패 문서 재시도" 버튼을 누를 때 호출된다.
  //   - scope='embedding' : embedding_status='failed' 문서만 재임베딩 큐로 add
  //   - scope='graph'     : graph_extraction_status='failed' 문서만 graph 큐로 add
  //   - scope='all'       : 둘 다
  // 큐잉 직전 해당 문서들의 retry_count·error_message 를 리셋하고 status 를 'pending' 으로
  // 되돌린다. `isKbBatch=false` 로 둬 KB 전체 잠금 (reembed_status / reextract_status) 은
  // 건드리지 않는다 (부분 재시도는 가벼운 작업).
  // - 100건 단위 chunking 으로 Redis/BullMQ 순간 부하 완화.
  // - addBulk 실패 시 해당 chunk 의 문서를 'failed' 로 롤백 (UPDATE 와 큐 add 비원자성 보완).
  async retryFailedDocuments(
    id: string,
    workspaceId: string,
    scope: 'embedding' | 'graph' | 'all',
  ): Promise<{ embeddingRequeued: number; graphRequeued: number }> {
    const kb = await this.findById(id, workspaceId);
    const CHUNK_SIZE = 100;

    let embeddingRequeued = 0;
    let graphRequeued = 0;

    if (scope === 'embedding' || scope === 'all') {
      const rows = await this.dataSource.query<{ id: string }[]>(
        `UPDATE document
            SET embedding_status = 'pending',
                embedding_retry_count = 0,
                embedding_error_message = NULL
          WHERE knowledge_base_id = $1 AND embedding_status = 'failed'
          RETURNING id`,
        [id],
      );
      embeddingRequeued = rows.length;
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const slice = rows.slice(i, i + CHUNK_SIZE);
        try {
          await this.embeddingQueue.addBulk(
            slice.map((r) => ({
              name: 'embed',
              data: {
                documentId: r.id,
                knowledgeBaseId: id,
                ragMode: kb.ragMode,
                reEmbed: true,
              },
            })),
          );
        } catch (err) {
          // 큐 add 실패 시 해당 chunk 의 문서들을 'failed' 로 되돌려 다음 사용자 재시도 가능 상태로 유지.
          const ids = slice.map((r) => r.id);
          await this.dataSource.query(
            `UPDATE document SET embedding_status = 'failed' WHERE id = ANY($1::uuid[])`,
            [ids],
          );
          embeddingRequeued -= slice.length;
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `Retry embedding addBulk failed for ${ids.length} docs, rolled back to 'failed': ${msg}`,
          );
          throw err;
        }
      }
    }

    if (scope === 'graph' || scope === 'all') {
      if (kb.ragMode !== 'graph') {
        // vector 모드 KB 에 graph scope 요청은 즉시 0건 반환 (에러 throw 하지 않음 — 'all' 호환).
      } else {
        const rows = await this.dataSource.query<{ id: string }[]>(
          `UPDATE document
              SET graph_extraction_status = 'pending',
                  graph_retry_count = 0,
                  graph_error_message = NULL
            WHERE knowledge_base_id = $1 AND graph_extraction_status = 'failed'
            RETURNING id`,
          [id],
        );
        graphRequeued = rows.length;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const slice = rows.slice(i, i + CHUNK_SIZE);
          try {
            await this.graphQueue.addBulk(
              slice.map((r) => ({
                name: 'extract',
                data: {
                  documentId: r.id,
                  knowledgeBaseId: id,
                },
              })),
            );
          } catch (err) {
            const ids = slice.map((r) => r.id);
            await this.dataSource.query(
              `UPDATE document SET graph_extraction_status = 'failed' WHERE id = ANY($1::uuid[])`,
              [ids],
            );
            graphRequeued -= slice.length;
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(
              `Retry graph addBulk failed for ${ids.length} docs, rolled back to 'failed': ${msg}`,
            );
            throw err;
          }
        }
      }
    }

    return { embeddingRequeued, graphRequeued };
  }

  /**
   * WS `kb:${documentId}` 채널 subscribe 권한 검증 — Gateway.handleSubscribe 가 호출.
   * 가입자 workspace 의 KB 에 속한 문서만 가입 가능 — 타 workspace 문서 id 추측 공격 차단.
   *
   * 단일 SELECT 로 결합 검증 (knowledge_base 와 JOIN). 미일치 / 미존재 모두 false 반환 —
   * Gateway 는 success: false 로 ack 하고 socket.io 가 채널 join 을 막는다.
   * 호출 비용: 페이지 진입 시 N 개 문서 → N 회. KB 페이지 한 번 진입에 한정되므로 가벼움.
   */
  async verifyDocumentOwnership(
    documentId: string,
    workspaceId: string,
  ): Promise<boolean> {
    if (!documentId || !workspaceId) return false;
    const rows = await this.dataSource.query<{ id: string }[]>(
      `SELECT d.id
         FROM document d
         JOIN knowledge_base kb ON kb.id = d.knowledge_base_id
        WHERE d.id = $1 AND kb.workspace_id = $2
        LIMIT 1`,
      [documentId, workspaceId],
    );
    return rows.length > 0;
  }

  // 모델 변경 등으로 KB 전체 재임베딩이 필요할 때 호출.
  // - reembed_status 를 atomic compare-and-swap (idle → in_progress) 으로 잠금
  //   (race-free; 다른 요청이 in_progress 면 0행 RETURNING 으로 409 ConflictException)
  // - embedding_dimension 도 같은 UPDATE 에서 NULL 로 초기화 (새 차원으로 다시 채워짐)
  // - 모든 문서를 BullMQ 'document-embedding' 큐에 addBulk 으로 추가
  // - 마지막 child job 의 completed/failed 시점에 DocumentEmbeddingProcessor 가
  //   reembed_status 를 idle 로 reset
  async reEmbedAll(
    id: string,
    workspaceId: string,
  ): Promise<{ documentCount: number; chainedGraphExtraction: boolean }> {
    const kb = await this.findById(id, workspaceId);

    const acquired = await this.dataSource.query<{ id: string }[]>(
      `UPDATE knowledge_base
       SET reembed_status = 'in_progress', embedding_dimension = NULL
       WHERE id = $1 AND workspace_id = $2 AND reembed_status = 'idle'
       RETURNING id`,
      [id, workspaceId],
    );
    if (acquired.length === 0) {
      throw new ConflictException({
        code: 'KB_REEMBED_IN_PROGRESS',
        message: 'A KB re-embedding is already in progress',
      });
    }

    // 모든 문서의 retry / error 메타데이터 리셋 (재시도 카운트 0 부터 다시 시작).
    await this.dataSource.query(
      `UPDATE document
          SET embedding_status = 'pending',
              embedding_retry_count = 0,
              embedding_error_message = NULL
        WHERE knowledge_base_id = $1`,
      [id],
    );

    const docs = await this.documentRepository.find({
      where: { knowledgeBaseId: id },
      select: ['id'],
    });

    if (docs.length === 0) {
      // 빈 KB 는 child job 이 없어 finalize 가 트리거되지 않는다 → 즉시 idle 로 되돌림.
      await this.dataSource.query(
        `UPDATE knowledge_base SET reembed_status = 'idle' WHERE id = $1`,
        [id],
      );
      return {
        documentCount: 0,
        chainedGraphExtraction: kb.ragMode === 'graph',
      };
    }

    await this.embeddingQueue.addBulk(
      docs.map((doc) => ({
        name: 'embed',
        data: {
          documentId: doc.id,
          reEmbed: true,
          isKbBatch: true,
          knowledgeBaseId: id,
          // 이미 KB 를 fetch 했으니 ragMode 도 같이 주입 — worker DB JOIN 회피.
          ragMode: kb.ragMode,
        },
      })),
    );

    return {
      documentCount: docs.length,
      chainedGraphExtraction: kb.ragMode === 'graph',
    };
  }

  // BullMQ 'document-embedding' 큐에 단발 임베딩 작업을 추가.
  // 컨트롤러의 uploadDocument / 단건 reEmbed 진입점이 사용.
  // KB.ragMode 와 knowledgeBaseId 를 payload 에 미리 주입해 worker 가 chained dispatch
  // 판단을 위해 매번 DB JOIN 하지 않도록 한다 (W5).
  async enqueueEmbedding(
    documentId: string,
    options?: {
      reEmbed?: boolean;
      ragMode?: 'vector' | 'graph';
      knowledgeBaseId?: string;
    },
  ): Promise<void> {
    let { ragMode, knowledgeBaseId } = options ?? {};
    if (!ragMode || !knowledgeBaseId) {
      // 호출자가 KB 정보를 모르면 한 번 조회해 채운다 — payload 에 들어가야 worker 가
      // chained dispatch 결정 시 DB 재조회를 회피.
      const rows = await this.dataSource.query<
        { rag_mode: 'vector' | 'graph'; knowledge_base_id: string }[]
      >(
        `SELECT kb.rag_mode AS rag_mode, d.knowledge_base_id AS knowledge_base_id
         FROM document d
         JOIN knowledge_base kb ON kb.id = d.knowledge_base_id
         WHERE d.id = $1`,
        [documentId],
      );
      const row = rows[0];
      if (row) {
        ragMode = ragMode ?? row.rag_mode;
        knowledgeBaseId = knowledgeBaseId ?? row.knowledge_base_id;
      }
    }
    await this.embeddingQueue.add('embed', {
      documentId,
      reEmbed: options?.reEmbed ?? false,
      ragMode,
      knowledgeBaseId,
    });
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const kb = await this.findById(id, workspaceId);
    // Delete all docs from S3. findById 가 이미 KB 소유권을 검증하지만,
    // S3 정리 루프도 defense-in-depth 로 workspace 권한을 명시 검증한다
    // (spec/data-flow/4-file-storage.md Rationale: workspace 격리는 DB 권한 검증으로 보장).
    const docs = await this.documentRepository
      .createQueryBuilder('d')
      .innerJoin('d.knowledgeBase', 'kb')
      .where('d.knowledge_base_id = :id', { id })
      .andWhere('kb.workspace_id = :workspaceId', { workspaceId })
      .getMany();
    // 배치 삭제 (refactor 01-performance #2 B안): 문서 N건 직렬 단건 DELETE
    // 루프를 DeleteObjects 청크(1000키/요청)로 교체 — 왕복 N → ceil(N/1000).
    // best-effort/warn 의미론(data-flow/4-file-storage.md Rationale)은 보존:
    // 부분 실패(Errors)는 errored 로 수집해 일괄 warn, 명령 단위 실패(네트워크
    // 등)도 warn 으로 삼키고 KB row 삭제는 진행한다.
    if (docs.length > 0) {
      try {
        const { errored } = await this.s3Service.deleteMany(
          docs.map((d) => d.fileUrl),
        );
        if (errored.length > 0) {
          this.logger.warn(
            `Failed to delete ${errored.length} S3 object(s) during KB removal: ${errored.join(', ')}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Failed to batch-delete ${docs.length} S3 object(s) during KB removal: ${err}`,
        );
      }
    }
    await this.kbRepository.remove(kb);
  }

  // ── Document CRUD ──

  async findDocuments(
    kbId: string,
    workspaceId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<Document>> {
    await this.findById(kbId, workspaceId);
    const { page = 1, limit = 20, search } = query;
    const qb = this.documentRepository
      .createQueryBuilder('d')
      .where('d.knowledge_base_id = :kbId', { kbId });

    if (search) {
      qb.andWhere('d.name ILIKE :search', { search: `%${search}%` });
    }
    qb.orderBy('d.created_at', 'DESC');

    const totalItems = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return PaginatedResponseDto.create(data, totalItems, page, limit);
  }

  async findDocument(
    docId: string,
    kbId: string,
    workspaceId: string,
  ): Promise<Document> {
    await this.findById(kbId, workspaceId);
    const doc = await this.documentRepository.findOne({
      where: { id: docId, knowledgeBaseId: kbId },
    });
    if (!doc) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Document not found',
      });
    }
    return doc;
  }

  async uploadDocument(
    kbId: string,
    workspaceId: string,
    file: Express.Multer.File,
  ): Promise<Document> {
    await this.findById(kbId, workspaceId);

    const filename = decodeMulterFilename(file.originalname);
    const ext = filename.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_FILE_TYPES.includes(ext)) {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: `Only ${ALLOWED_FILE_TYPES.join(', ')} files are allowed`,
      });
    }

    const docId = uuidv4();
    const sanitizedFilename = path.basename(filename);
    const s3Key = `kb/${kbId}/${docId}/${sanitizedFilename}`;
    const contentType = CONTENT_TYPE_MAP[ext] || 'application/octet-stream';

    await this.s3Service.upload(s3Key, file.buffer, contentType);

    const doc = this.documentRepository.create({
      id: docId,
      knowledgeBaseId: kbId,
      name: filename,
      fileType: ext,
      fileUrl: s3Key,
      fileSize: file.size,
      embeddingStatus: 'pending',
    });

    const saved = await this.documentRepository.save(doc);

    // Update document count atomically
    await this.dataSource.query(
      `UPDATE knowledge_base SET document_count = (SELECT COUNT(*) FROM document WHERE knowledge_base_id = $1) WHERE id = $1`,
      [kbId],
    );

    return saved;
  }

  async removeDocument(
    docId: string,
    kbId: string,
    workspaceId: string,
  ): Promise<void> {
    const doc = await this.findDocument(docId, kbId, workspaceId);
    try {
      await this.s3Service.delete(doc.fileUrl);
    } catch (err) {
      this.logger.warn(`Failed to delete S3 object ${doc.fileUrl}: ${err}`);
    }
    await this.documentRepository.remove(doc);

    // Update document count atomically
    await this.dataSource.query(
      `UPDATE knowledge_base SET document_count = (SELECT COUNT(*) FROM document WHERE knowledge_base_id = $1) WHERE id = $1`,
      [kbId],
    );
  }

  async updateDocumentStatus(
    docId: string,
    status: string,
    chunkCount?: number,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const update: Record<string, unknown> = { embeddingStatus: status };
    if (chunkCount !== undefined) update.chunkCount = chunkCount;
    if (metadata !== undefined) update.metadata = metadata;
    await this.documentRepository.update(docId, update);
  }
}
