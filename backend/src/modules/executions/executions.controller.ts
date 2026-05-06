import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import {
  ApiOkPaginatedResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import { ExecutionsService } from './executions.service';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { QueryExecutionDto } from './dto/query-execution.dto';
import {
  ExecutionContinueResultDto,
  ExecutionDetailDto,
  ExecutionDto,
} from './dto/responses/execution-response.dto';

@ApiTags('Executions')
@ApiBearerAuth('access-token')
@Controller('executions')
export class ExecutionsController {
  constructor(
    private readonly executionsService: ExecutionsService,
    private readonly executionEngineService: ExecutionEngineService,
  ) {}

  @Get(':id')
  @ApiOperation({
    summary: '실행 단건 조회',
    description:
      '실행 ID로 워크플로우 실행 상세 정보와 노드별 실행 이력을 함께 반환합니다.',
  })
  @ApiParam({ name: 'id', description: '실행 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(ExecutionDetailDto, {
    description: '실행 상세 정보 (노드 실행 목록 포함)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 실행을 찾을 수 없음' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.executionsService.findById(id);
  }

  @Get('workflow/:workflowId')
  @ApiOperation({
    summary: '워크플로우별 실행 목록',
    description:
      '특정 워크플로우의 실행 이력을 페이지네이션하여 조회합니다. 상태 필터·정렬 옵션을 지원합니다.',
  })
  @ApiParam({
    name: 'workflowId',
    description: '워크플로우 UUID',
    format: 'uuid',
  })
  @ApiOkPaginatedResponse(ExecutionDto, {
    description: '실행 목록 (페이지네이션)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async findByWorkflow(
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @Query() query: QueryExecutionDto,
  ) {
    return this.executionsService.findByWorkflow(workflowId, query);
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '실행 중지',
    description:
      '진행 중(pending/running/waiting_for_input)인 실행을 취소합니다. 입력 대기 상태인 경우 예약된 이어실행을 취소합니다.',
  })
  @ApiParam({ name: 'id', description: '실행 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(ExecutionDto, {
    description: '중지 처리된 실행 정보',
  })
  @ApiBadRequestResponse({
    description: '중지 불가능한 상태 (이미 완료/실패/취소된 실행)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 실행을 찾을 수 없음' })
  async stop(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    // CRIT #1 — IDOR 차단. 실행 소유 workspace 검증.
    await this.executionsService.verifyOwnership(id, workspaceId);
    return this.executionsService.stop(id);
  }

  @Post(':id/continue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '실행 이어서 진행',
    description:
      '입력 대기(waiting_for_input) 상태의 실행에 폼 데이터를 전달하여 이어 진행시킵니다.',
  })
  @ApiParam({ name: 'id', description: '실행 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(ExecutionContinueResultDto, {
    description: '이어실행 요청 접수',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 실행을 찾을 수 없음' })
  async continueExecution(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('workspaceId') workspaceId: string,
    @Body() body?: { formData?: unknown },
  ) {
    // CRIT #1 — IDOR 차단.
    await this.executionsService.verifyOwnership(id, workspaceId);
    this.executionEngineService.continueExecution(id, body?.formData);
    return { success: true };
  }
}
