import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import {
  ApiOkWrappedArrayResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import { WorkflowVersionsService } from './workflow-versions.service';
import { WorkspaceId } from '../../common/decorators';
import { WorkflowVersionDto } from './dto/responses/workflow-version-response.dto';

@ApiTags('Workflow Versions')
@ApiBearerAuth('access-token')
@Controller('workflows/:wfId/versions')
export class WorkflowVersionsController {
  constructor(
    private readonly workflowVersionsService: WorkflowVersionsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: '워크플로우 버전 이력 조회',
    description:
      '지정한 워크플로우의 버전 이력을 최신순(version DESC)으로 반환합니다. 각 버전에는 스냅샷과 변경 작성자 정보가 포함됩니다.',
  })
  @ApiParam({ name: 'wfId', description: '워크플로우 UUID', format: 'uuid' })
  @ApiOkWrappedArrayResponse(WorkflowVersionDto, {
    description: '버전 이력 목록 (최신순)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({
    description: '워크플로우가 현재 워크스페이스에 속하지 않음',
  })
  async findByWorkflow(
    @Param('wfId', ParseUUIDPipe) wfId: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.workflowVersionsService.assertWorkspaceOwnership(
      wfId,
      workspaceId,
    );
    return this.workflowVersionsService.findByWorkflow(wfId);
  }

  @Get(':versionId')
  @ApiOperation({
    summary: '워크플로우 버전 상세 조회',
    description:
      '지정한 버전의 스냅샷(노드/엣지 포함)과 메타데이터를 반환합니다.',
  })
  @ApiParam({ name: 'wfId', description: '워크플로우 UUID', format: 'uuid' })
  @ApiParam({ name: 'versionId', description: '버전 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(WorkflowVersionDto, {
    description: '버전 상세 (snapshot 포함)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({
    description: '해당 버전을 찾을 수 없거나 다른 워크스페이스 소속',
  })
  async findOne(
    @Param('wfId', ParseUUIDPipe) wfId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.workflowVersionsService.assertWorkspaceOwnership(
      wfId,
      workspaceId,
    );
    return this.workflowVersionsService.findOne(wfId, versionId);
  }
}
