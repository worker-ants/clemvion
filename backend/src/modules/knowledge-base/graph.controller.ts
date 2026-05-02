import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiNoContentResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import {
  ApiAcceptedWrappedResponse,
  ApiOkPaginatedResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import { KnowledgeBaseService } from './knowledge-base.service';
import { GraphQueryService } from './graph/graph-query.service';
import {
  GraphEntityDetailDto,
  GraphEntityDto,
  GraphRelationDto,
  GraphVisualizationDto,
  KbGraphStatsDto,
  KbReExtractAcceptedDto,
  KbReExtractDocumentAcceptedDto,
} from './dto/responses/knowledge-base-response.dto';
import { WorkspaceId } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

/**
 * graph 모드 KB 의 그래프 도메인(entity / relation / re-extract / 시각화 / 통계) 라우트를
 * KnowledgeBaseController 에서 분리한 서브 컨트롤러. URL prefix(`knowledge-bases/:id`) 는
 * 기존과 동일하게 유지하므로 외부 호출자에게 breaking change 없음.
 *
 * 분리 동기 (review/2026-05-02_16-11-51 W15):
 * - KnowledgeBaseController 가 KB CRUD + 문서 + 그래프 + 검색 까지 흡수해 책임이 비대해졌다.
 * - 그래프 라우트만 떼어내 의존(GraphQueryService)을 모듈 안에서 격리.
 */
@ApiTags('Knowledge Base / Graph')
@ApiBearerAuth('access-token')
@Controller('knowledge-bases/:id')
@UseGuards(RolesGuard)
export class GraphController {
  constructor(
    private readonly kbService: KnowledgeBaseService,
    private readonly graphQueryService: GraphQueryService,
  ) {}

  @Post('re-extract')
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

  @Post('documents/:docId/re-extract')
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

  @Get('entities')
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

  @Get('entities/:entityId')
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

  @Delete('entities/:entityId')
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

  @Get('relations')
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

  @Delete('relations/:relationId')
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

  @Get('graph/visualization')
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

  @Get('graph/stats')
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
}
