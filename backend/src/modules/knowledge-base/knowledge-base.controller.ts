import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeBaseService } from './knowledge-base.service';
import { EmbeddingService } from './embedding/embedding.service';
import { RagSearchService } from './search/rag-search.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { WorkspaceId } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@Controller('knowledge-bases')
export class KnowledgeBaseController {
  private readonly logger = new Logger(KnowledgeBaseController.name);

  constructor(
    private readonly kbService: KnowledgeBaseService,
    private readonly embeddingService: EmbeddingService,
    private readonly ragSearchService: RagSearchService,
  ) {}

  // ── Knowledge Base CRUD ──

  @Get()
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.kbService.findAll(workspaceId, query);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.kbService.findById(id, workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateKnowledgeBaseDto,
  ) {
    return this.kbService.create(workspaceId, dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Body() dto: UpdateKnowledgeBaseDto,
  ) {
    return this.kbService.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.kbService.remove(id, workspaceId);
  }

  // ── Document endpoints ──

  @Get(':id/documents')
  async findDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.kbService.findDocuments(id, workspaceId, query);
  }

  @Get(':id/documents/:docId')
  async findDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.kbService.findDocument(docId, id, workspaceId);
  }

  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  async uploadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const doc = await this.kbService.uploadDocument(id, workspaceId, file);
    // Trigger async embedding
    this.embeddingService.processDocument(doc.id).catch((err) => {
      this.logger.error(
        `Async embedding failed for document ${doc.id}: ${err instanceof Error ? err.message : err}`,
      );
    });
    return doc;
  }

  @Delete(':id/documents/:docId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.kbService.removeDocument(docId, id, workspaceId);
  }

  @Post(':id/documents/:docId/re-embed')
  @HttpCode(HttpStatus.ACCEPTED)
  async reEmbed(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.kbService.findDocument(docId, id, workspaceId);
    this.embeddingService.processDocument(docId, true).catch((err) => {
      this.logger.error(
        `Async re-embedding failed for document ${docId}: ${err instanceof Error ? err.message : err}`,
      );
    });
    return { message: 'Re-embedding started' };
  }

  // ── RAG Search (debug endpoint) ──

  @Post('search')
  async search(
    @WorkspaceId() workspaceId: string,
    @Body()
    body: {
      query: string;
      knowledgeBaseIds: string[];
      topK?: number;
      threshold?: number;
    },
  ) {
    return this.ragSearchService.search(
      body.query,
      body.knowledgeBaseIds,
      workspaceId,
      { topK: body.topK, threshold: body.threshold },
    );
  }
}
