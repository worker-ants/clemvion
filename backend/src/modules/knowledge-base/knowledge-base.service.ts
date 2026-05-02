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
      chunkSize: dto.chunkSize || 1000,
      chunkOverlap: dto.chunkOverlap || 200,
      ragMode: dto.ragMode || 'vector',
      extractionLlmConfigId: dto.extractionLlmConfigId ?? null,
      maxHops: dto.maxHops ?? 1,
      vectorSeedTopK: dto.vectorSeedTopK ?? 5,
      expandedChunkLimit: dto.expandedChunkLimit ?? 15,
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
    if (dto.maxHops !== undefined) kb.maxHops = dto.maxHops;
    if (dto.vectorSeedTopK !== undefined)
      kb.vectorSeedTopK = dto.vectorSeedTopK;
    if (dto.expandedChunkLimit !== undefined) {
      kb.expandedChunkLimit = dto.expandedChunkLimit;
    }
    return this.kbRepository.save(kb);
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
      // 3) 모든 문서 graph_extraction_status 를 'pending' 으로 reset
      await manager.query(
        `UPDATE document SET graph_extraction_status = 'pending' WHERE knowledge_base_id = $1`,
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
    totalDocumentCount: number;
    reextractStatus: 'idle' | 'in_progress';
  }> {
    const kb = await this.findById(id, workspaceId);
    this.assertGraphMode(kb);

    const rows = await this.dataSource.query<
      {
        extracted: number;
        total: number;
      }[]
    >(
      `SELECT
         COUNT(*) FILTER (WHERE graph_extraction_status = 'completed')::int AS extracted,
         COUNT(*)::int AS total
       FROM document WHERE knowledge_base_id = $1`,
      [id],
    );
    return {
      entityCount: kb.entityCount,
      relationCount: kb.relationCount,
      extractedDocumentCount: rows[0]?.extracted ?? 0,
      totalDocumentCount: rows[0]?.total ?? 0,
      reextractStatus: kb.reextractStatus,
    };
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
  ): Promise<{ documentCount: number }> {
    await this.findById(id, workspaceId);

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
      return { documentCount: 0 };
    }

    await this.embeddingQueue.addBulk(
      docs.map((doc) => ({
        name: 'embed',
        data: {
          documentId: doc.id,
          reEmbed: true,
          isKbBatch: true,
          knowledgeBaseId: id,
        },
      })),
    );

    return { documentCount: docs.length };
  }

  // BullMQ 'document-embedding' 큐에 단발 임베딩 작업을 추가.
  // 컨트롤러의 uploadDocument / 단건 reEmbed 진입점이 사용.
  async enqueueEmbedding(documentId: string, reEmbed = false): Promise<void> {
    await this.embeddingQueue.add('embed', { documentId, reEmbed });
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const kb = await this.findById(id, workspaceId);
    // Delete all docs from S3
    const docs = await this.documentRepository.find({
      where: { knowledgeBaseId: id },
    });
    for (const doc of docs) {
      try {
        await this.s3Service.delete(doc.fileUrl);
      } catch (err) {
        this.logger.warn(`Failed to delete S3 object ${doc.fileUrl}: ${err}`);
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

    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_FILE_TYPES.includes(ext)) {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: `Only ${ALLOWED_FILE_TYPES.join(', ')} files are allowed`,
      });
    }

    const docId = uuidv4();
    const sanitizedFilename = path.basename(file.originalname);
    const s3Key = `kb/${kbId}/${docId}/${sanitizedFilename}`;
    const contentType = CONTENT_TYPE_MAP[ext] || 'application/octet-stream';

    await this.s3Service.upload(s3Key, file.buffer, contentType);

    const doc = this.documentRepository.create({
      id: docId,
      knowledgeBaseId: kbId,
      name: file.originalname,
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
