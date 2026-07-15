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
  ServiceUnavailableException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { BadRequestException, Logger } from '@nestjs/common';
import { Roles } from '../../common/guards/roles.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ApiResponse,
} from '@nestjs/swagger';
import {
  ApiAcceptedWrappedResponse,
  ApiCreatedWrappedResponse,
  ApiOkPaginatedResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import { Node } from '../nodes/entities/node.entity';
import { Execution } from '../executions/entities/execution.entity';
import { WorkflowsService } from './workflows.service';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { ShutdownStateService } from '../execution-engine/shutdown/shutdown-state.service';
import { resolveTriggerParameters } from '../execution-engine/utils/resolve-trigger-parameters';
import { loadTriggerParameterSchema } from '../execution-engine/utils/load-trigger-parameter-schema';
import {
  TriggerParameterValidationException,
  toTriggerParameterErrorDetails,
} from '../execution-engine/types/trigger-parameter.types';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { QueryWorkflowDto } from './dto/query-workflow.dto';
import { SaveCanvasDto } from './dto/save-canvas.dto';
import { ImportWorkflowDto } from './dto/import-workflow.dto';
import { ExecuteNodeDto } from './dto/execute-node.dto';
import {
  CanvasSaveResultDto,
  ExecuteAcceptedDto,
  ExportWorkflowDto,
  GraphWarningsResponseDto,
  WorkflowDto,
} from './dto/responses/workflow-response.dto';
import { CurrentUser, WorkspaceId } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';

@ApiTags('Workflows')
@ApiBearerAuth('access-token')
@Controller('workflows')
export class WorkflowsController {
  private readonly logger = new Logger(WorkflowsController.name);

  constructor(
    private readonly workflowsService: WorkflowsService,
    private readonly executionEngineService: ExecutionEngineService,
    private readonly shutdownState: ShutdownStateService,
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
  ) {}

  @Get()
  @ApiOperation({
    summary: '워크플로우 목록 조회',
    description:
      '현재 워크스페이스의 워크플로우 목록을 페이지네이션/검색/태그/폴더/소유 필터로 조회합니다. `ownership` 은 팀 워크스페이스에서만 의미가 있고, 개인 워크스페이스에서는 서버가 무시합니다.',
  })
  @ApiOkPaginatedResponse(WorkflowDto, {
    description: '워크플로우 목록 (페이지네이션 포함)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryWorkflowDto,
  ) {
    return this.workflowsService.findAll(workspaceId, query, user.sub);
  }

  @Get(':id')
  @ApiOperation({
    summary: '워크플로우 단건 조회',
    description:
      '현재 워크스페이스에 속한 워크플로우의 상세 정보를 반환합니다.',
  })
  @ApiParam({ name: 'id', description: '워크플로우 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(WorkflowDto, { description: '워크플로우 상세' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 워크플로우를 찾을 수 없음' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.workflowsService.findById(id, workspaceId);
  }

  @Get(':id/graph-warnings')
  @Roles('viewer')
  @ApiOperation({
    summary: '워크플로우 graph-level warnings 평가',
    description:
      'NodeComponentMetadata 의 graphWarningRules (cross-node) 를 워크플로우 nodes/edges 전체에 대해 평가해 위반 목록을 반환합니다. severity `error` 가 하나라도 있으면 frontend canvas 가 저장 버튼을 disable 하고, `warning` 은 노란 배지로 표시합니다. parallel-p2 결정 D + E + I (2026-05-30) — SoT: spec/conventions/cross-node-warning-rules.md.',
  })
  @ApiParam({ name: 'id', description: '워크플로우 UUID', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'graphWarningRules 평가 결과 (results + summary)',
    type: GraphWarningsResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 워크플로우를 찾을 수 없음' })
  async graphWarnings(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    // SUMMARY#1/2 — Repository 직접 접근 제거. 서비스 메서드로 위임해 레이어 책임 분리.
    await this.workflowsService.findById(id, workspaceId);
    // workspaceId 는 AI Agent 도구 payload 예산 경고(backend-only)가 통합을
    // 테넌트 경계 안에서 조회하는 데 필요하다 (cross-node-warning-rules §5).
    return this.workflowsService.getGraphWarnings(id, workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('editor')
  @ApiOperation({
    summary: '워크플로우 생성',
    description:
      '새로운 워크플로우를 생성하고, 초기 시작 지점으로 Manual Trigger 노드를 함께 생성합니다.',
  })
  @ApiCreatedWrappedResponse(WorkflowDto, {
    description: '생성된 워크플로우 정보',
  })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  async create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateWorkflowDto,
  ) {
    return this.workflowsService.create(workspaceId, user.sub, dto);
  }

  @Patch(':id')
  @Roles('editor')
  @ApiOperation({
    summary: '워크플로우 정보 수정',
    description:
      '워크플로우의 이름·설명·태그·활성여부·폴더·설정을 부분 수정합니다.',
  })
  @ApiParam({ name: 'id', description: '워크플로우 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(WorkflowDto, {
    description: '수정된 워크플로우 정보',
  })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 워크플로우를 찾을 수 없음' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.workflowsService.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('editor')
  @ApiOperation({
    summary: '워크플로우 삭제',
    description:
      '워크플로우를 영구 삭제합니다. 관련 노드·엣지·버전 이력도 함께 제거됩니다.',
  })
  @ApiParam({ name: 'id', description: '워크플로우 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '삭제 완료' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 워크플로우를 찾을 수 없음' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.workflowsService.remove(id, workspaceId);
  }

  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  @Roles('editor')
  @ApiOperation({
    summary: '워크플로우 복제',
    description:
      '기존 워크플로우를 비활성(inactive) 상태의 새 워크플로우로 복제합니다. 이름은 "(Copy)"가 추가됩니다.',
  })
  @ApiParam({ name: 'id', description: '원본 워크플로우 UUID', format: 'uuid' })
  @ApiCreatedWrappedResponse(WorkflowDto, {
    description: '복제된 워크플로우 정보',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '원본 워크플로우를 찾을 수 없음' })
  async duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workflowsService.duplicate(id, workspaceId, user.sub);
  }

  @Post(':id/execute')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles('editor')
  @ApiOperation({
    summary: '워크플로우 수동 실행',
    description:
      '워크플로우를 수동으로 실행 큐에 등록합니다. 트리거 파라미터는 노드 스키마에 따라 검증됩니다.',
  })
  @ApiParam({ name: 'id', description: '워크플로우 UUID', format: 'uuid' })
  @ApiAcceptedWrappedResponse(ExecuteAcceptedDto, {
    description: '실행 큐 등록 완료 (비동기 실행)',
  })
  @ApiBadRequestResponse({ description: '트리거 파라미터 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 워크플로우를 찾을 수 없음' })
  // W-14 fix (SUMMARY#W-14): Graceful Shutdown gate 의 503 응답 문서화.
  @ApiResponse({
    status: 503,
    description: '서버 종료 중 — Retry-After 헤더 초 단위 대기 후 재시도',
    schema: {
      example: {
        statusCode: 503,
        code: 'SERVER_SHUTTING_DOWN',
        message: 'Service temporarily unavailable. Please retry.',
      },
    },
  })
  async execute(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
    @Body()
    body?: {
      input?: Record<string, unknown>;
      parameterValues?: Record<string, unknown>;
    },
  ) {
    // workflow-resumable-execution Phase 1.2 — Graceful Shutdown gate.
    // SoT: spec/5-system/4-execution-engine.md §11. SIGTERM 수신 후에는 신규
    // Execution 시작을 503 으로 거부해 LB drain 동안 다른 인스턴스로 라우팅.
    if (this.shutdownState.isShuttingDown) {
      res.setHeader('Retry-After', String(this.shutdownState.retryAfterSec));
      // W-3 fix (SUMMARY#W-3): 내부 운영 상태("Server is shutting down...")
      // 대신 중립 메시지 사용. code 는 클라이언트 분기용으로 유지.
      throw new ServiceUnavailableException({
        code: 'SERVER_SHUTTING_DOWN',
        message: 'Service temporarily unavailable. Please retry.',
      });
    }

    // Verify workflow belongs to workspace
    await this.workflowsService.findById(id, workspaceId);

    // Resolve trigger parameters against the workflow's trigger node schema.
    // Accepts `parameterValues` (preferred) or `input.parameters` for
    // back-compat with older clients.
    const rawValues =
      body?.parameterValues ??
      (body?.input && typeof body.input === 'object' && body.input !== null
        ? (body.input.parameters as Record<string, unknown> | undefined)
        : undefined) ??
      {};

    const schema = await loadTriggerParameterSchema(
      this.nodeRepository,
      id,
      this.logger,
    );
    let parameters: Record<string, unknown>;
    try {
      parameters = resolveTriggerParameters(schema, rawValues);
    } catch (err) {
      if (err instanceof TriggerParameterValidationException) {
        // `details` so GlobalExceptionFilter surfaces the per-field breakdown
        // in the official envelope's `error.details[]` (parity with the webhook
        // path, spec manual-trigger §6). Field codes are UPPER_SNAKE_CASE.
        throw new BadRequestException({
          code: 'INVALID_TRIGGER_PARAMETERS',
          message: 'Invalid trigger parameters',
          details: toTriggerParameterErrorDetails(err.errors),
        });
      }
      throw err;
    }

    // Stamp the trigger-source marker so the Manual Trigger handler can
    // record `meta.source: 'manual'` deterministically (CONVENTIONS
    // Principle 2). The marker is stripped by the handler before the
    // structured output is exposed to expression resolvers.
    const executionInput = {
      ...(body?.input ?? {}),
      __triggerSource: 'manual' as const,
      parameters,
    };
    const executionId = await this.executionEngineService.execute(
      id,
      executionInput,
      { executedBy: user.sub },
    );
    return { executionId };
  }

  @Post(':id/nodes/:nodeId/execute')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles('editor')
  @ApiOperation({
    summary: '단일 노드 실행 (§1.3)',
    description:
      '대상 노드 1개만 실행 큐에 등록한다(downstream 미진행 — §1.2 Run-from-Selected 와 구분). 입력은 previousExecutionId 의 상류 노드 출력을 자동 주입하며 미지정 시 body.input(수동 입력)으로 대체한다. 결과는 GET /api/executions/:id 로 조회한다.',
  })
  @ApiParam({ name: 'id', description: '워크플로우 UUID', format: 'uuid' })
  @ApiParam({ name: 'nodeId', description: '대상 노드 UUID', format: 'uuid' })
  @ApiAcceptedWrappedResponse(ExecuteAcceptedDto, {
    description: '단일 노드 실행 큐 등록 완료 (비동기 실행)',
  })
  @ApiBadRequestResponse({
    description:
      '대상 노드가 워크플로우에 없거나 previousExecutionId 가 유효하지 않음',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 워크플로우를 찾을 수 없음' })
  @ApiResponse({
    status: 503,
    description: '서버 종료 중 — Retry-After 헤더 초 단위 대기 후 재시도',
    schema: {
      example: {
        statusCode: 503,
        code: 'SERVER_SHUTTING_DOWN',
        message: 'Service temporarily unavailable. Please retry.',
      },
    },
  })
  async executeNode(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
    @Body() body?: ExecuteNodeDto,
  ) {
    // Graceful Shutdown gate (execute 와 동일 — spec/5-system/4-execution-engine.md §11).
    if (this.shutdownState.isShuttingDown) {
      res.setHeader('Retry-After', String(this.shutdownState.retryAfterSec));
      throw new ServiceUnavailableException({
        code: 'SERVER_SHUTTING_DOWN',
        message: 'Service temporarily unavailable. Please retry.',
      });
    }

    // Verify workflow belongs to workspace (404 if not).
    await this.workflowsService.findById(id, workspaceId);

    // 대상 노드가 이 워크플로우에 속하는지 검증 (workflow 스코핑으로 IDOR 방지).
    const node = await this.nodeRepository.findOneBy({
      id: nodeId,
      workflowId: id,
    });
    if (!node) {
      throw new BadRequestException({
        code: 'NODE_NOT_IN_WORKFLOW',
        message: '대상 노드가 해당 워크플로우에 존재하지 않습니다.',
      });
    }

    // previousExecutionId(있으면)가 같은 워크플로우의 실행인지 검증 — 타 워크플로우
    // 실행의 노드 출력을 seed 출처로 지정하는 것을 차단.
    if (body?.previousExecutionId) {
      const prev = await this.executionRepository.findOneBy({
        id: body.previousExecutionId,
        workflowId: id,
      });
      if (!prev) {
        throw new BadRequestException({
          code: 'PREVIOUS_EXECUTION_NOT_FOUND',
          message:
            'previousExecutionId 가 해당 워크플로우의 실행이 아니거나 존재하지 않습니다.',
        });
      }
    }

    const executionInput = {
      ...(body?.input ?? {}),
      __triggerSource: 'manual' as const,
    };
    const executionId = await this.executionEngineService.execute(
      id,
      executionInput,
      {
        executedBy: user.sub,
        singleNodeId: nodeId,
        previousExecutionId: body?.previousExecutionId,
      },
    );
    return { executionId };
  }

  @Post(':id/save')
  @Roles('editor')
  @ApiOperation({
    summary: '캔버스 저장',
    description:
      '캔버스의 노드/엣지 전체 상태를 서버와 동기화합니다. 제출되지 않은 노드는 삭제되고 엣지는 전부 교체되며, Manual Trigger는 정확히 하나 존재해야 합니다.',
  })
  @ApiParam({ name: 'id', description: '워크플로우 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(CanvasSaveResultDto, {
    description: '캔버스 저장 결과 (워크플로우/노드/엣지)',
  })
  @ApiBadRequestResponse({
    description: 'Manual Trigger 누락/중복 또는 입력값 검증 실패',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 워크플로우를 찾을 수 없음' })
  @ApiConflictResponse({ description: '노드 라벨 중복' })
  async saveCanvas(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SaveCanvasDto,
  ) {
    return this.workflowsService.saveCanvas(id, workspaceId, user.sub, dto);
  }

  @Post(':id/versions/:versionId/restore')
  @HttpCode(HttpStatus.OK)
  @Roles('editor')
  @ApiOperation({
    summary: '워크플로우 버전 복원',
    description:
      '지정한 버전의 스냅샷으로 현재 워크플로우를 덮어씁니다. 복원 동작도 새로운 버전으로 기록됩니다.',
  })
  @ApiParam({ name: 'id', description: '워크플로우 UUID', format: 'uuid' })
  @ApiParam({ name: 'versionId', description: '버전 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(CanvasSaveResultDto, {
    description: '복원 결과 (워크플로우/노드/엣지)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '워크플로우 또는 버전을 찾을 수 없음' })
  @ApiConflictResponse({ description: '스냅샷 노드 라벨 충돌' })
  async restoreVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workflowsService.restoreVersion(
      id,
      workspaceId,
      versionId,
      user.sub,
    );
  }

  @Get(':id/export')
  @ApiOperation({
    summary: '워크플로우 내보내기',
    description:
      '노드/엣지를 포함한 워크플로우 정의를 JSON 형태로 내보냅니다. 노드 참조는 인덱스로 치환되어 가져오기(import) 시 재사용 가능합니다.',
  })
  @ApiParam({ name: 'id', description: '워크플로우 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(ExportWorkflowDto, {
    description: '내보내기 JSON 객체',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 워크플로우를 찾을 수 없음' })
  async exportWorkflow(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.workflowsService.exportWorkflow(id, workspaceId);
  }

  @Post('import')
  @Roles('editor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '워크플로우 가져오기',
    description:
      '내보내기 JSON 포맷을 그대로 받아 새 워크플로우·노드·엣지를 생성합니다. 노드 라벨은 페이로드 내에서 유일해야 합니다.',
  })
  @ApiCreatedWrappedResponse(WorkflowDto, {
    description: '생성된 워크플로우 정보',
  })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiConflictResponse({ description: '페이로드 내 노드 라벨 중복' })
  async importWorkflow(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ImportWorkflowDto,
  ) {
    return this.workflowsService.importWorkflow(workspaceId, user.sub, dto);
  }
}
