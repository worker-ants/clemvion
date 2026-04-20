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
  UseGuards,
} from '@nestjs/common';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiConsumes,
  ApiBody,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiPayloadTooLargeResponse,
} from '@nestjs/swagger';
import {
  ApiAcceptedWrappedResponse,
  ApiCreatedWrappedResponse,
  ApiOkPaginatedResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import { KnowledgeBaseService } from './knowledge-base.service';
import { EmbeddingService } from './embedding/embedding.service';
import { RagSearchService } from './search/rag-search.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { RagSearchDto } from './dto/rag-search.dto';
import {
  DocumentDto,
  KnowledgeBaseDto,
  RagSearchResultDto,
  ReEmbedAcceptedDto,
} from './dto/responses/knowledge-base-response.dto';
import { WorkspaceId } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Knowledge Base')
@ApiBearerAuth('access-token')
@Controller('knowledge-bases')
@UseGuards(RolesGuard)
export class KnowledgeBaseController {
  private readonly logger = new Logger(KnowledgeBaseController.name);

  constructor(
    private readonly kbService: KnowledgeBaseService,
    private readonly embeddingService: EmbeddingService,
    private readonly ragSearchService: RagSearchService,
  ) {}

  // ── Knowledge Base CRUD ──

  @Get()
  @ApiOperation({
    summary: '지식 베이스 목록 조회',
    description:
      '워크스페이스에 속한 지식 베이스 목록을 페이지네이션으로 조회합니다.',
  })
  @ApiOkPaginatedResponse(KnowledgeBaseDto, {
    description: '지식 베이스 목록 및 페이지네이션 메타',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.kbService.findAll(workspaceId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: '지식 베이스 단건 조회',
    description: 'ID로 지식 베이스 상세를 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '지식 베이스 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(KnowledgeBaseDto, { description: '지식 베이스 상세' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 지식 베이스를 찾을 수 없음' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.kbService.findById(id, workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('editor')
  @ApiOperation({
    summary: '지식 베이스 생성',
    description:
      '새 지식 베이스를 생성합니다. 이후 문서 업로드 시 자동으로 청킹·임베딩이 수행됩니다.',
  })
  @ApiCreatedWrappedResponse(KnowledgeBaseDto, {
    description: '생성된 지식 베이스',
  })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateKnowledgeBaseDto,
  ) {
    return this.kbService.create(workspaceId, dto);
  }

  @Patch(':id')
  @Roles('editor')
  @ApiOperation({
    summary: '지식 베이스 수정',
    description:
      '지식 베이스를 부분 수정합니다. chunkSize/chunkOverlap 변경 시 재임베딩이 필요합니다.',
  })
  @ApiParam({ name: 'id', description: '지식 베이스 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(KnowledgeBaseDto, { description: '수정된 지식 베이스' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 지식 베이스를 찾을 수 없음' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Body() dto: UpdateKnowledgeBaseDto,
  ) {
    return this.kbService.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('editor')
  @ApiOperation({
    summary: '지식 베이스 삭제',
    description: '지식 베이스와 소속 문서·임베딩을 모두 영구 삭제합니다.',
  })
  @ApiParam({ name: 'id', description: '지식 베이스 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '삭제 성공' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 지식 베이스를 찾을 수 없음' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.kbService.remove(id, workspaceId);
  }

  // ── Document endpoints ──

  @Get(':id/documents')
  @ApiOperation({
    summary: '문서 목록 조회',
    description: '지식 베이스에 속한 문서 목록을 페이지네이션으로 반환합니다.',
  })
  @ApiParam({ name: 'id', description: '지식 베이스 UUID', format: 'uuid' })
  @ApiOkPaginatedResponse(DocumentDto, {
    description: '문서 목록 및 페이지네이션 메타',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 지식 베이스를 찾을 수 없음' })
  async findDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.kbService.findDocuments(id, workspaceId, query);
  }

  @Get(':id/documents/:docId')
  @ApiOperation({
    summary: '문서 단건 조회',
    description: 'ID로 문서 상세를 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '지식 베이스 UUID', format: 'uuid' })
  @ApiParam({ name: 'docId', description: '문서 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(DocumentDto, {
    description: '문서 상세 (청크/임베딩 상태 포함)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 문서를 찾을 수 없음' })
  async findDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.kbService.findDocument(docId, id, workspaceId);
  }

  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  @Roles('editor')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  @ApiOperation({
    summary: '문서 업로드',
    description:
      '파일(최대 50MB)을 업로드해 지식 베이스에 추가합니다. 업로드 직후 비동기로 청킹·임베딩이 수행됩니다. 지원 포맷: PDF, Markdown, 일반 텍스트 등.',
  })
  @ApiParam({ name: 'id', description: '지식 베이스 UUID', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '업로드할 파일',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '업로드 파일 (최대 50MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiCreatedWrappedResponse(DocumentDto, {
    description: '생성된 문서 메타 (임베딩은 비동기 진행)',
  })
  @ApiBadRequestResponse({ description: '파일 누락 또는 지원하지 않는 포맷' })
  @ApiPayloadTooLargeResponse({ description: '파일 크기 초과 (50MB)' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 지식 베이스를 찾을 수 없음' })
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
  @Roles('editor')
  @ApiOperation({
    summary: '문서 삭제',
    description: '문서와 해당 문서의 임베딩 청크를 모두 영구 삭제합니다.',
  })
  @ApiParam({ name: 'id', description: '지식 베이스 UUID', format: 'uuid' })
  @ApiParam({ name: 'docId', description: '문서 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '삭제 성공' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 문서를 찾을 수 없음' })
  async removeDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.kbService.removeDocument(docId, id, workspaceId);
  }

  @Post(':id/documents/:docId/re-embed')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles('editor')
  @ApiOperation({
    summary: '문서 재임베딩',
    description:
      '기존 청크·임베딩을 삭제하고 문서를 처음부터 다시 처리합니다. 비동기로 수행되므로 즉시 202를 반환합니다.',
  })
  @ApiParam({ name: 'id', description: '지식 베이스 UUID', format: 'uuid' })
  @ApiParam({ name: 'docId', description: '문서 UUID', format: 'uuid' })
  @ApiAcceptedWrappedResponse(ReEmbedAcceptedDto, {
    description: '재임베딩 작업이 큐잉됨',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 문서를 찾을 수 없음' })
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
  @ApiOperation({
    summary: 'RAG 검색 (디버그)',
    description:
      '지정한 지식 베이스들을 대상으로 벡터 유사도 기반 검색을 수행합니다. 디버깅/테스트 용도이며 실제 워크플로우 실행에서는 노드 엔진이 직접 호출합니다.',
  })
  @ApiOkWrappedResponse(RagSearchResultDto, {
    description: '검색 결과 (유사 청크 목록)',
  })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async search(@WorkspaceId() workspaceId: string, @Body() body: RagSearchDto) {
    return this.ragSearchService.search(
      body.query,
      body.knowledgeBaseIds,
      workspaceId,
      { topK: body.topK, threshold: body.threshold },
    );
  }
}
