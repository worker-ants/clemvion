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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import {
  ApiCreatedWrappedResponse,
  ApiOkWrappedResponse,
  ApiOkWrappedArrayResponse,
} from '../../common/swagger';
import { Roles } from '../../common/guards/roles.guard';
import { WorkspaceId, CurrentUser } from '../../common/decorators';
import { WorkflowTestDatasetsService } from './workflow-test-datasets.service';
import { CreateWorkflowTestDatasetDto } from './dto/create-workflow-test-dataset.dto';
import { UpdateWorkflowTestDatasetDto } from './dto/update-workflow-test-dataset.dto';
import { WorkflowTestDatasetDto } from './dto/responses/workflow-test-dataset-response.dto';

/**
 * §2.2 테스트 데이터셋 저장 — 워크플로우 Mock Input 을 이름 붙여 저장/재사용.
 * 권한·가시성 모델은 {@link WorkflowTestDatasetsService} 참조. 에디터 surface 라
 * 전 작업 Editor+ ([Spec 인증 §3.2]).
 */
@ApiTags('Workflow Test Datasets')
@ApiBearerAuth('access-token')
@Controller()
export class WorkflowTestDatasetsController {
  constructor(private readonly service: WorkflowTestDatasetsService) {}

  @Get('workflows/:workflowId/test-datasets')
  @Roles('editor')
  @ApiOperation({
    summary: '테스트 데이터셋 목록',
    description:
      '같은 워크플로우의 내 데이터셋 + 워크스페이스 공유본 (최근 갱신순).',
  })
  @ApiParam({ name: 'workflowId', format: 'uuid' })
  @ApiOkWrappedArrayResponse(WorkflowTestDatasetDto, {
    description: '데이터셋 목록',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  @ApiNotFoundResponse({ description: '워크플로우 없음' })
  async list(
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<WorkflowTestDatasetDto[]> {
    return this.service.list(workflowId, workspaceId, userId);
  }

  @Post('workflows/:workflowId/test-datasets')
  @Roles('editor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '테스트 데이터셋 저장' })
  @ApiParam({ name: 'workflowId', format: 'uuid' })
  @ApiCreatedWrappedResponse(WorkflowTestDatasetDto, { description: '생성됨' })
  @ApiBadRequestResponse({ description: '유효성 오류' })
  @ApiConflictResponse({ description: '같은 이름 데이터셋 중복' })
  @ApiNotFoundResponse({ description: '워크플로우 없음' })
  async create(
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: CreateWorkflowTestDatasetDto,
  ): Promise<WorkflowTestDatasetDto> {
    return this.service.create(workflowId, workspaceId, userId, body);
  }

  @Patch('test-datasets/:id')
  @Roles('editor')
  @ApiOperation({
    summary: '테스트 데이터셋 수정 (소유자만)',
    description: 'name·input·visibility 부분 갱신. 소유자가 아니면 403.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkWrappedResponse(WorkflowTestDatasetDto, { description: '수정됨' })
  @ApiForbiddenResponse({ description: '소유자 아님' })
  @ApiNotFoundResponse({ description: '없음' })
  @ApiConflictResponse({ description: '같은 이름 데이터셋 중복' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: UpdateWorkflowTestDatasetDto,
  ): Promise<WorkflowTestDatasetDto> {
    return this.service.update(id, workspaceId, userId, body);
  }

  @Delete('test-datasets/:id')
  @Roles('editor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '테스트 데이터셋 삭제 (소유자만)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: '삭제됨' })
  @ApiForbiddenResponse({ description: '소유자 아님' })
  @ApiNotFoundResponse({ description: '없음' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<void> {
    await this.service.remove(id, workspaceId, userId);
  }

  @Post('test-datasets/:id/clone')
  @Roles('editor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '테스트 데이터셋 복제',
    description:
      '조회 가능한(내 것 또는 워크스페이스 공유본) 데이터셋을 자기 소유 private 사본으로 복제.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedWrappedResponse(WorkflowTestDatasetDto, { description: '복제됨' })
  @ApiNotFoundResponse({ description: '없음 또는 비공유' })
  @ApiConflictResponse({
    description: '동일 이름 복제본 이미 존재 (DUPLICATE_NAME)',
  })
  async clone(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<WorkflowTestDatasetDto> {
    return this.service.clone(id, workspaceId, userId);
  }
}
