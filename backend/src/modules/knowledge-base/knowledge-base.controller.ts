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
import { Throttle } from '@nestjs/throttler';
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
import { RagSearchService } from './search/rag-search.service';
import { GraphQueryService } from './graph/graph-query.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { RagSearchDto } from './dto/rag-search.dto';
import {
  DocumentDto,
  GraphEntityDetailDto,
  GraphEntityDto,
  GraphRelationDto,
  GraphVisualizationDto,
  KbGraphStatsDto,
  KbReEmbedAcceptedDto,
  KbReExtractAcceptedDto,
  KbReExtractDocumentAcceptedDto,
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
    private readonly ragSearchService: RagSearchService,
    private readonly graphQueryService: GraphQueryService,
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

  @Post(':id/re-extract')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles('editor')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary: '지식 베이스 전체 그래프 재추출 (graph 모드)',
    description:
      'graph 모드 KB 의 모든 entity/relation/chunk_entity 를 삭제하고 모든 문서를 처음부터 다시 추출합니다. ' +
      'reextract_status atomic compare-and-swap 으로 잠금 (이미 진행 중이면 409). 비-graph 모드 KB 는 400 KB_NOT_GRAPH_MODE.',
  })
  @ApiParam({ name: 'id', description: '지식 베이스 UUID', format: 'uuid' })
  @ApiAcceptedWrappedResponse(KbReExtractAcceptedDto, {
    description: 'KB 전체 그래프 재추출 작업이 큐잉됨',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 지식 베이스를 찾을 수 없음' })
  async reExtractAll(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ): Promise<KbReExtractAcceptedDto> {
    const { documentCount } = await this.kbService.reExtractAll(
      id,
      workspaceId,
    );
    return {
      message: 'KB graph re-extraction started',
      documentCount,
    } satisfies KbReExtractAcceptedDto;
  }

  @Post(':id/documents/:docId/re-extract')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles('editor')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: '문서 단건 그래프 재추출 (graph 모드)',
    description:
      '문서 하나에 대해서만 그래프 추출을 다시 수행. graph 모드 KB 에서만 유효 (vector 모드는 400). KB 전체 재추출 진행 중에는 409.',
  })
  @ApiParam({ name: 'id', description: '지식 베이스 UUID', format: 'uuid' })
  @ApiParam({ name: 'docId', description: '문서 UUID', format: 'uuid' })
  @ApiAcceptedWrappedResponse(KbReExtractDocumentAcceptedDto, {
    description: '그래프 재추출 작업이 큐잉됨',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 문서를 찾을 수 없음' })
  async reExtractDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @WorkspaceId() workspaceId: string,
  ): Promise<KbReExtractDocumentAcceptedDto> {
    await this.kbService.reExtractDocument(docId, id, workspaceId);
    return {
      message: 'Graph re-extraction started',
    } satisfies KbReExtractDocumentAcceptedDto;
  }

  @Get(':id/entities')
  @ApiOperation({
    summary: 'Entity 목록 (graph 모드)',
    description:
      'graph 모드 KB 의 entity 목록. mention_count desc 정렬. type 필터 / name·display_name 검색 지원.',
  })
  @ApiParam({ name: 'id', description: '지식 베이스 UUID', format: 'uuid' })
  @ApiOkPaginatedResponse(GraphEntityDto, {
    description: 'Entity 목록 + 페이지네이션 메타',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 지식 베이스를 찾을 수 없음' })
  async listEntities(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Query() query: PaginationQueryDto,
    @Query('type') type?: string,
  ) {
    return this.graphQueryService.listEntities(id, workspaceId, {
      page: query.page,
      limit: query.limit,
      search: query.search,
      type,
    });
  }

  @Get(':id/entities/:entityId')
  @ApiOperation({
    summary: 'Entity 상세 (graph 모드) — 등장 chunk 포함',
  })
  @ApiParam({ name: 'id', description: '지식 베이스 UUID', format: 'uuid' })
  @ApiParam({ name: 'entityId', description: 'Entity UUID', format: 'uuid' })
  @ApiOkWrappedResponse(GraphEntityDetailDto, {
    description: 'Entity 상세 + 등장 chunk 미리보기 (최대 100건)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 entity 를 찾을 수 없음' })
  async getEntity(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.graphQueryService.getEntityDetail(id, entityId, workspaceId);
  }

  @Delete(':id/entities/:entityId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('editor')
  @ApiOperation({
    summary: 'Entity 삭제 (graph 모드)',
    description:
      '관련 relation 및 chunk_entity 매핑은 CASCADE 로 함께 삭제됩니다. KB.entity_count / relation_count 캐시도 갱신.',
  })
  @ApiParam({ name: 'id', description: '지식 베이스 UUID', format: 'uuid' })
  @ApiParam({ name: 'entityId', description: 'Entity UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '삭제 성공' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 entity 를 찾을 수 없음' })
  async deleteEntity(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @WorkspaceId() workspaceId: string,
  ): Promise<void> {
    await this.graphQueryService.deleteEntity(id, entityId, workspaceId);
  }

  @Get(':id/relations')
  @ApiOperation({
    summary: 'Relation 목록 (graph 모드)',
    description:
      'weight desc 정렬. predicate / head·tail entity name 검색 지원.',
  })
  @ApiParam({ name: 'id', description: '지식 베이스 UUID', format: 'uuid' })
  @ApiOkPaginatedResponse(GraphRelationDto, {
    description: 'Relation 목록 + 페이지네이션 메타',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 지식 베이스를 찾을 수 없음' })
  async listRelations(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.graphQueryService.listRelations(id, workspaceId, query);
  }

  @Delete(':id/relations/:relationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('editor')
  @ApiOperation({ summary: 'Relation 삭제 (graph 모드)' })
  @ApiParam({ name: 'id', description: '지식 베이스 UUID', format: 'uuid' })
  @ApiParam({
    name: 'relationId',
    description: 'Relation UUID',
    format: 'uuid',
  })
  @ApiNoContentResponse({ description: '삭제 성공' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 relation 을 찾을 수 없음' })
  async deleteRelation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('relationId', ParseUUIDPipe) relationId: string,
    @WorkspaceId() workspaceId: string,
  ): Promise<void> {
    await this.graphQueryService.deleteRelation(id, relationId, workspaceId);
  }

  @Get(':id/graph/visualization')
  @ApiOperation({
    summary: '그래프 시각화 페이로드 (graph 모드, P2)',
    description:
      '상위 mention_count entity (default 50, max 200) 와 그 entity 사이의 relation 을 반환. ' +
      '시각화 컴포넌트(@xyflow/react 등) 가 직접 렌더링할 수 있는 nodes/edges 형태.',
  })
  @ApiParam({ name: 'id', description: '지식 베이스 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(GraphVisualizationDto, {
    description: '그래프 시각화 페이로드',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 지식 베이스를 찾을 수 없음' })
  async graphVisualization(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Query('limit') limit?: string,
  ): Promise<GraphVisualizationDto> {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.graphQueryService.getGraphVisualization(
      id,
      workspaceId,
      Number.isNaN(parsedLimit) ? undefined : parsedLimit,
    );
  }

  @Get(':id/graph/stats')
  @ApiOperation({
    summary: 'KB 그래프 통계 (graph 모드)',
    description:
      'entity / relation 카운트와 추출 진행 상태 요약. graph 모드 KB 에서만 유효.',
  })
  @ApiParam({ name: 'id', description: '지식 베이스 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(KbGraphStatsDto, {
    description: '그래프 통계 + 추출 진행 상태',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 지식 베이스를 찾을 수 없음' })
  async graphStats(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ): Promise<KbGraphStatsDto> {
    return this.kbService.getGraphStats(id, workspaceId);
  }

  @Post(':id/re-embed')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles('editor')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary: '지식 베이스 전체 재임베딩',
    description:
      '지식 베이스의 모든 문서 청크·임베딩을 삭제하고 처음부터 다시 처리합니다. ' +
      '먼저 embedding_dimension 을 NULL 로 초기화한 뒤 문서별 재임베딩을 fire-and-forget 으로 큐잉하고 ' +
      '큐잉된 문서 개수와 함께 즉시 202 를 반환합니다. ' +
      '재임베딩이 완료되기 전까지 해당 KB 는 RAG 검색 대상에서 일시적으로 제외됩니다 ' +
      '(차원 NULL → searchGroup 에서 skip). 동일 KB 에 동시 호출이 들어오면 409 가 반환됩니다.',
  })
  @ApiParam({ name: 'id', description: '지식 베이스 UUID', format: 'uuid' })
  @ApiAcceptedWrappedResponse(KbReEmbedAcceptedDto, {
    description: 'KB 전체 재임베딩 작업이 큐잉됨',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 지식 베이스를 찾을 수 없음' })
  async reEmbedAll(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ): Promise<KbReEmbedAcceptedDto> {
    const { documentCount } = await this.kbService.reEmbedAll(id, workspaceId);
    return {
      message: 'KB re-embedding started',
      documentCount,
    } satisfies KbReEmbedAcceptedDto;
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
    // BullMQ 큐로 라우팅 — 다중 인스턴스 / 프로세스 재시작 환경에서도 작업 유실 없음.
    await this.kbService.enqueueEmbedding(doc.id);
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
    await this.kbService.enqueueEmbedding(docId, true);
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
