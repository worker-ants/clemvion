import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import pLimit from 'p-limit';
import { KnowledgeBase } from './entities/knowledge-base.entity';
import { Document } from './entities/document.entity';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { S3Service } from '../../common/services/s3.service';
import { EmbeddingService } from './embedding/embedding.service';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

// 동시 fire-and-forget 폭발 방지: KB 단위 재임베딩 시 한 번에 큐잉할 promise 수의 상한.
// 초과분은 p-limit 큐에 대기하므로 메모리·이벤트루프 부담을 일정하게 유지.
const REEMBED_DISPATCH_CONCURRENCY = 5;

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
  // 같은 프로세스 안에서 동일 KB 의 reEmbedAll 이 중복 진입하는 것을 차단한다.
  // (다중 인스턴스 환경의 분산 잠금은 별도 후속 작업.)
  private readonly inFlightReEmbeds = new Set<string>();

  constructor(
    @InjectRepository(KnowledgeBase)
    private readonly kbRepository: Repository<KnowledgeBase>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly s3Service: S3Service,
    private readonly dataSource: DataSource,
    private readonly embeddingService: EmbeddingService,
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
    return this.kbRepository.save(kb);
  }

  // 모델 변경 등으로 KB 전체 재임베딩이 필요할 때 호출.
  // - embedding_dimension 을 NULL 로 초기화 (다음 첫 청크 INSERT 에서 새 차원으로 채워짐)
  // - 모든 문서를 fire-and-forget 으로 재임베딩 (단, p-limit 으로 동시 큐잉 상한)
  // - 같은 KB 의 중복 호출은 in-memory 잠금으로 차단해 청크 이중 삽입 레이스를 막는다
  async reEmbedAll(
    id: string,
    workspaceId: string,
  ): Promise<{ documentCount: number }> {
    await this.findById(id, workspaceId);

    if (this.inFlightReEmbeds.has(id)) {
      throw new ConflictException({
        code: 'KB_REEMBED_IN_PROGRESS',
        message: 'A KB re-embedding is already in progress',
      });
    }
    this.inFlightReEmbeds.add(id);

    let docs: Array<{ id: string }>;
    try {
      await this.dataSource.query(
        `UPDATE knowledge_base SET embedding_dimension = NULL WHERE id = $1`,
        [id],
      );

      docs = await this.documentRepository.find({
        where: { knowledgeBaseId: id },
        select: ['id'],
      });
    } catch (err) {
      this.inFlightReEmbeds.delete(id);
      throw err;
    }

    const limit = pLimit(REEMBED_DISPATCH_CONCURRENCY);
    const tasks = docs.map((doc) =>
      limit(() =>
        this.embeddingService.processDocument(doc.id, true).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `KB re-embedding failed for document ${doc.id}: ${msg}`,
          );
        }),
      ),
    );
    void Promise.allSettled(tasks).finally(() => {
      this.inFlightReEmbeds.delete(id);
    });

    return { documentCount: docs.length };
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
