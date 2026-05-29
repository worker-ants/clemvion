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
  UnprocessableEntityException,
} from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  ApiOkPaginatedResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import { ExecutionsService } from './executions.service';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { InvalidExecutionStateError } from '../execution-engine/workflow-errors';
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
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    // W-44 — IDOR 차단. findById 는 workspace 필터를 적용하지 않으므로
    // ID 만 추측한 다른 workspace 사용자에게 상세를 회신할 수 있었다.
    //
    // `@WorkspaceId()` 가 `X-Workspace-Id` 헤더 우선 + JWT 폴백 (W-44-FU).
    // 옛 `@CurrentUser('workspaceId')` 는 JWT 만 읽어 워크스페이스 스위칭 후
    // 팀 워크스페이스의 실행 조회가 항상 404. workflows / background-runs
    // controller 와 동일한 표준 패턴으로 정렬.
    await this.executionsService.verifyOwnership(id, workspaceId);
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
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryExecutionDto,
  ) {
    // W-44 — IDOR 차단. workflow 가 사용자의 workspace 에 속하는지 검증한 뒤에만
    // 실행 목록을 반환한다. 일치하지 않으면 NotFound 로 ID enumeration 도 방지.
    await this.executionsService.verifyWorkflowOwnership(
      workflowId,
      workspaceId,
    );
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
    @WorkspaceId() workspaceId: string,
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
  @ApiUnprocessableEntityResponse({
    description:
      '실행이 입력 대기(waiting_for_input) 상태가 아님 (INVALID_STATE)',
  })
  async continueExecution(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Body() body?: { formData?: unknown },
  ) {
    // CRIT #1 — IDOR 차단.
    await this.executionsService.verifyOwnership(id, workspaceId);
    // spec §7.5.1 — publisher 측 사전 검증 실패는 동기 422 INVALID_STATE 로 surface.
    // WS gateway 의 INVALID_EXECUTION_STATE 와 동일 의미, REST 진입점은 422.
    try {
      await this.executionEngineService.continueExecution(id, body?.formData);
    } catch (error: unknown) {
      if (error instanceof InvalidExecutionStateError) {
        throw new UnprocessableEntityException({
          error: { code: 'INVALID_STATE', message: error.message },
        });
      }
      throw error;
    }
    return { success: true };
  }
}
