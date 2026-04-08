import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { KnowledgeBase } from './entities/knowledge-base.entity';
import { Document } from './entities/document.entity';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { S3Service } from '../../common/services/s3.service';
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
    return this.kbRepository.save(kb);
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
