import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { WorkflowVersionsService } from './workflow-versions.service';

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
  @ApiOkResponse({ description: '버전 이력 목록 (최신순)' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async findByWorkflow(@Param('wfId', ParseUUIDPipe) wfId: string) {
    return this.workflowVersionsService.findByWorkflow(wfId);
  }
}
