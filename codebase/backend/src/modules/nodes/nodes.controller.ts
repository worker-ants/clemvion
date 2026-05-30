import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import {
  ApiCreatedWrappedResponse,
  ApiOkWrappedArrayResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import { NodesService } from './nodes.service';
import { CreateNodeDto } from './dto/create-node.dto';
import { UpdateNodeDto } from './dto/update-node.dto';
import {
  NodeDefinitionsResponseDto,
  NodeDto,
} from './dto/responses/node-response.dto';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';
import { WorkspaceId } from '../../common/decorators';

@ApiTags('Nodes')
@ApiBearerAuth('access-token')
@Controller()
export class NodesController {
  constructor(
    private readonly nodesService: NodesService,
    private readonly componentRegistry: NodeComponentRegistry,
  ) {}

  @Get('nodes/definitions')
  @ApiOperation({
    summary: '노드 컴포넌트 정의 목록 조회',
    description:
      '시스템에 등록된 모든 노드 컴포넌트의 메타데이터, 포트, JSON Schema 와 카테고리 메타를 반환합니다. 프론트엔드는 이 응답으로 팔레트/설정 폼을 생성합니다.',
  })
  @ApiOkWrappedResponse(NodeDefinitionsResponseDto, {
    description: '노드 정의 및 카테고리',
  })
  listDefinitions() {
    return {
      definitions: this.componentRegistry.listDefinitions(),
      categories: this.componentRegistry.listCategories(),
    };
  }

  @Get('workflows/:workflowId/nodes')
  @ApiOperation({
    summary: '워크플로우 노드 목록 조회',
    description:
      '지정한 워크플로우에 포함된 모든 노드를 생성 순으로 반환합니다.',
  })
  @ApiParam({
    name: 'workflowId',
    description: '워크플로우 UUID',
    format: 'uuid',
  })
  @ApiOkWrappedArrayResponse(NodeDto, { description: '노드 목록' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({
    description: '워크플로우를 찾을 수 없음 또는 접근 권한 없음',
  })
  async findByWorkflow(
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.nodesService.findByWorkflow(workflowId, workspaceId);
  }

  @Post('workflows/:workflowId/nodes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '노드 생성',
    description:
      '지정한 워크플로우에 신규 노드를 추가합니다. 라벨은 워크플로우 내에서 유일해야 합니다.',
  })
  @ApiParam({
    name: 'workflowId',
    description: '워크플로우 UUID',
    format: 'uuid',
  })
  @ApiCreatedWrappedResponse(NodeDto, { description: '생성된 노드' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({
    description: '워크플로우를 찾을 수 없음 또는 접근 권한 없음',
  })
  @ApiConflictResponse({ description: '동일 워크플로우 내 라벨 중복' })
  async create(
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateNodeDto,
  ) {
    return this.nodesService.create(workflowId, workspaceId, dto);
  }

  @Patch('nodes/:id')
  @ApiOperation({
    summary: '노드 수정',
    description: '노드의 라벨·위치·설정·설명 등을 부분 수정합니다.',
  })
  @ApiParam({ name: 'id', description: '노드 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(NodeDto, { description: '수정된 노드' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 노드를 찾을 수 없음' })
  @ApiConflictResponse({ description: '동일 워크플로우 내 라벨 중복' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Body() dto: UpdateNodeDto,
  ) {
    return this.nodesService.update(id, workspaceId, dto);
  }

  @Delete('nodes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '노드 삭제',
    description:
      '지정한 노드를 삭제합니다. 연관된 엣지는 DB cascade로 함께 제거됩니다.',
  })
  @ApiParam({ name: 'id', description: '노드 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '삭제 완료' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 노드를 찾을 수 없음' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.nodesService.remove(id, workspaceId);
  }
}
