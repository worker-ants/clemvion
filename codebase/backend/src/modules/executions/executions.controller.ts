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
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { CurrentUser } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';
import { Roles } from '../../common/guards/roles.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiUnprocessableEntityResponse,
  ApiForbiddenResponse,
  ApiConflictResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import {
  ApiOkPaginatedResponse,
  ApiOkWrappedResponse,
  ApiOkWrappedArrayResponse,
  ApiCreatedWrappedResponse,
} from '../../common/swagger';
import { Throttle } from '@nestjs/throttler';
import { ReRunRequestDto } from './dto/re-run.dto';
import { ExecutionsService } from './executions.service';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import {
  InvalidExecutionStateError,
  FormValidationError,
} from '../execution-engine/workflow-errors';
import { ErrorCode } from '../../nodes/core/error-codes';
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
  @ApiBadRequestResponse({
    description:
      'VALIDATION_ERROR (form field 검증 실패 — details[{field,message,code:INVALID_FIELD}], 현재 단계 FIRST 오류만)',
  })
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
    } catch (err: unknown) {
      if (err instanceof InvalidExecutionStateError) {
        throw new UnprocessableEntityException({
          error: { code: 'INVALID_STATE', message: err.message },
        });
      }
      // form §4·§6.2 — field 검증 실패는 400 VALIDATION_ERROR + details[] (재제출 가능,
      // waiting 유지). publisher 가 publish 전 throw.
      if (err instanceof FormValidationError) {
        throw new BadRequestException({
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: err.message,
            details: err.toHttpDetails(),
          },
        });
      }
      throw err;
    }
    return { success: true };
  }

  /**
   * **e2e 전용 backdoor — 프로덕션 표면 아님.** §7.1/§7.5 case B 크래시/재시작
   * re-drive 는 부팅 시(onApplicationBootstrap)에만 트리거된다. in-network e2e 러너는
   * backend 를 재시작할 수 없어 이 경로를 HTTP 로 검증할 수 없으므로, test 환경에서만
   * on-demand 스캔을 트리거한다. (운영용 on-demand trigger 는 PR4 관측성 트랙에서 별도
   * 검토 — 그때 route/scope 인가를 정식 설계한다.)
   *
   * **다층 방어 (ai-review security/api_contract W)**: (1) `NODE_ENV==='test'` **그리고**
   * (2) 명시 플래그 `E2E_TEST_HOOKS==='1'` 둘 다일 때만 동작 — 단일 env 오설정으로는
   * 활성화되지 않는다(프로덕션 이미지는 `NODE_ENV=production`, 플래그 미설정). 어느 하나라도
   * 아니면 404 로 라우트 부재처럼 취급. (3) `@Roles('owner')` 로 게이트가 뚫려도 임의
   * 인증 사용자가 아니라 워크스페이스 owner 만 트리거 가능(인가 이중화). recoverStuck
   * Executions 는 전역 스캔이나 재구동은 idempotent(re-claim affected 가드)라 부작용 제한적.
   */
  @Post('_test/recover-stuck-executions')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles('owner')
  @ApiExcludeEndpoint()
  async triggerStuckRecoveryForTest() {
    if (process.env.NODE_ENV !== 'test' || process.env.E2E_TEST_HOOKS !== '1') {
      throw new NotFoundException();
    }
    await this.executionEngineService.runStuckRecoveryScan();
    return { success: true };
  }

  @Post(':id/re-run')
  @HttpCode(HttpStatus.CREATED)
  @Roles('editor')
  // Rate limit — 사용자당 분당 10회 (spec §12). UserThrottlerGuard 가 user.sub
  // 로 키를 만들어 사용자 단위로 카운트한다 (429 TOO_MANY_REQUESTS).
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: '실행 재실행 (Re-run)',
    description:
      '원본 실행을 기반으로 새 Execution 을 시작합니다 (현재 시점 워크플로 정의 사용). 입력은 원본 그대로 또는 inputOverride 로 대체 가능. spec/5-system/13-replay-rerun.md §8.1.',
  })
  @ApiParam({ name: 'id', description: '원본 실행 UUID', format: 'uuid' })
  @ApiCreatedWrappedResponse(ExecutionDetailDto, {
    description: '새로 생성된 실행 (reRunOf / chainId / dryRun 포함)',
  })
  @ApiBadRequestResponse({
    description: 'INVALID_INPUT / RERUN_DRY_RUN_NOT_APPLICABLE',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'RERUN_PERMISSION_DENIED (RR-PL-06)' })
  @ApiNotFoundResponse({
    description: 'RERUN_EXECUTION_NOT_FOUND / RERUN_WORKFLOW_DELETED',
  })
  @ApiConflictResponse({
    description: 'RERUN_CHAIN_DEPTH_EXCEEDED (깊이 32 초과)',
  })
  async reRun(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReRunRequestDto,
  ) {
    return this.executionsService.reRun(id, workspaceId, user, dto);
  }

  @Get(':id/chain')
  @ApiOperation({
    summary: '실행 chain 조회',
    description:
      '같은 re-run chain 의 모든 실행을 started_at ASC 로 반환합니다 (chain badge / View chain). spec §8.2.',
  })
  @ApiParam({ name: 'id', description: '실행 UUID', format: 'uuid' })
  @ApiOkWrappedArrayResponse(ExecutionDto, {
    description: 'chain 내 실행 목록 (nodeExecutions 생략)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'RERUN_PERMISSION_DENIED (RR-PL-06)' })
  @ApiNotFoundResponse({ description: 'RERUN_EXECUTION_NOT_FOUND' })
  async getChain(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.executionsService.getChain(id, workspaceId, user);
  }
}
