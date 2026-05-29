import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { InvalidExecutionStateError } from '../execution-engine/workflow-errors';
import { ExecutionsService } from '../executions/executions.service';
import { InteractionTokenService } from './interaction-token.service';
import { InteractDto } from './dto/interact.dto';
import {
  ExecutionStatusDto,
  InteractAckDto,
  RefreshTokenResponseDto,
} from './dto/responses.dto';
import {
  ExternalInteractionRequestContext,
  InteractionRequestContext,
} from './interaction.guard';

const TERMINAL_STATUSES: ReadonlySet<ExecutionStatus> = new Set([
  ExecutionStatus.COMPLETED,
  ExecutionStatus.FAILED,
  ExecutionStatus.CANCELLED,
]);

/**
 * [Spec EIA §5] — Inbound interaction REST endpoint 의 비즈니스 로직.
 *
 * 본 service 는 facade — 토큰 검증은 InteractionGuard 가 이미 통과시킨 상태에서 호출된다.
 * 각 dispatch 는 ExecutionEngineService / ExecutionsService 의 기존 public 메서드를 그대로
 * 재사용 (WebSocket gateway 의 명령 경로와 동일 — Spec EIA §R5/§R10 의 facade 원칙).
 *
 * dispatch 매핑 ([Spec EIA §11]):
 *   submit_form      → ExecutionEngineService.continueExecution(executionId, data)
 *   click_button     → ExecutionEngineService.continueButtonClick(executionId, buttonId)
 *   submit_message   → ExecutionEngineService.continueAiConversation(executionId, message)
 *   end_conversation → ExecutionEngineService.endAiConversation(executionId)
 *   cancel           → ExecutionsService.stop(executionId)
 */
@Injectable()
export class InteractionService {
  constructor(
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    private readonly executionEngineService: ExecutionEngineService,
    private readonly executionsService: ExecutionsService,
    private readonly tokenService: InteractionTokenService,
  ) {}

  async interact(
    ctx: InteractionRequestContext,
    dto: InteractDto,
  ): Promise<InteractAckDto> {
    const execution = await this.loadAndAssertAlive(ctx.executionId);
    switch (dto.command) {
      case 'submit_form':
        this.assertNodeId(dto);
        if (!dto.data || typeof dto.data !== 'object') {
          throw badRequest(
            'INVALID_COMMAND',
            'submit_form requires `data` object',
          );
        }
        this.assertWaiting(execution);
        await this.dispatchContinuation(
          this.executionEngineService.continueExecution(
            ctx.executionId,
            dto.data,
          ),
        );
        break;
      case 'click_button':
        this.assertNodeId(dto);
        if (!dto.buttonId) {
          throw badRequest(
            'INVALID_COMMAND',
            'click_button requires `buttonId`',
          );
        }
        this.assertWaiting(execution);
        await this.dispatchContinuation(
          this.executionEngineService.continueButtonClick(
            ctx.executionId,
            dto.buttonId,
          ),
        );
        break;
      case 'submit_message':
        this.assertNodeId(dto);
        if (typeof dto.message !== 'string' || dto.message.length === 0) {
          throw badRequest(
            'INVALID_COMMAND',
            'submit_message requires `message`',
          );
        }
        this.assertWaiting(execution);
        await this.dispatchContinuation(
          this.executionEngineService.continueAiConversation(
            ctx.executionId,
            dto.message,
          ),
        );
        break;
      case 'end_conversation':
        this.assertNodeId(dto);
        this.assertWaiting(execution);
        await this.dispatchContinuation(
          this.executionEngineService.endAiConversation(ctx.executionId),
        );
        break;
      case 'cancel':
        // cancel 은 nodeId 불필요. running / waiting / pending 모두 허용.
        await this.executionsService.stop(ctx.executionId);
        break;
      default:
        throw badRequest(
          'INVALID_COMMAND',
          `Unsupported command: ${dto.command as string}`,
        );
    }
    // 명령은 비동기 dispatch — 즉시 종료 확정은 아니므로 현재 status 를 다시 읽어 반환.
    const refreshed = await this.executionRepository.findOne({
      where: { id: ctx.executionId },
      select: ['id', 'status'],
    });
    return {
      executionId: ctx.executionId,
      accepted: true,
      currentStatus:
        (refreshed?.status as InteractAckDto['currentStatus']) ?? 'running',
    };
  }

  async cancel(ctx: InteractionRequestContext): Promise<InteractAckDto> {
    await this.loadAndAssertAlive(ctx.executionId);
    await this.executionsService.stop(ctx.executionId);
    return {
      executionId: ctx.executionId,
      accepted: true,
      currentStatus: 'cancelled',
    };
  }

  async refreshToken(
    ctx: ExternalInteractionRequestContext,
    bearerToken: string,
  ): Promise<RefreshTokenResponseDto> {
    if (ctx.tokenFamily !== 'iext') {
      // itk 는 refresh 대상 아님 — 영구 토큰.
      throw new ForbiddenException({
        error: {
          code: 'TOKEN_REFRESH_FORBIDDEN',
          message: 'per_trigger 토큰은 refresh 대상이 아닙니다.',
        },
      });
    }
    // 본 endpoint 에 도달했다는 사실 자체가 Guard 통과 = 토큰 valid. 그러나 만료 임박 윈도우 검사를
    // 위해 service 의 refresh 가 다시 verify + window 검사 수행.
    const result = await this.tokenService.refreshPerExecution(bearerToken);
    if ('valid' in result && result.valid === false) {
      // not_in_window — 아직 갱신 시점이 아님.
      throw new BadRequestException({
        error: {
          code: 'TOKEN_REFRESH_NOT_IN_WINDOW',
          message: `Refresh window not reached (reason: ${result.reason ?? 'unknown'})`,
        },
      });
    }
    if (!('token' in result)) {
      // 안전 net — 위 if 로 분기 처리됐어야 함.
      throw new BadRequestException({
        error: { code: 'TOKEN_REFRESH_FAILED', message: 'Refresh failed' },
      });
    }
    // execution 이 이미 종료된 경우 refresh 거부 (살아있는 execution 만 갱신).
    const execution = await this.executionRepository.findOne({
      where: { id: ctx.executionId },
      select: ['id', 'status'],
    });
    if (!execution || TERMINAL_STATUSES.has(execution.status)) {
      throw new GoneException({
        error: {
          code: 'EXECUTION_TERMINATED',
          message: 'Execution is already terminated; refresh is not allowed',
        },
      });
    }
    return { token: result.token, expiresAt: result.expiresAt };
  }

  async getStatus(ctx: InteractionRequestContext): Promise<ExecutionStatusDto> {
    const execution = await this.executionRepository.findOne({
      where: { id: ctx.executionId },
    });
    if (!execution) {
      throw new NotFoundException({
        error: { code: 'EXECUTION_NOT_FOUND', message: 'Execution not found' },
      });
    }
    // 단발 상태 조회 응답 — currentNode / context 는 V1 에서 최소 정보만 노출. 자세한 context 는
    // SSE 의 waiting_for_input 페이로드가 권위. 본 응답은 클라이언트 복구용.
    return {
      id: execution.id,
      workflowId: execution.workflowId,
      status: execution.status as ExecutionStatusDto['status'],
      currentNode: null,
      context: null,
      result:
        execution.status === ExecutionStatus.COMPLETED
          ? ((execution.outputData ?? null) as Record<string, unknown> | null)
          : null,
      error:
        execution.status === ExecutionStatus.FAILED
          ? ((execution.outputData ?? null) as Record<string, unknown> | null)
          : null,
      // V1 의 단발 응답에는 seq 최신값을 알 길이 없음 (WebsocketService 의 in-memory counter 는
      // 직접 access 안 함). 0 으로 placeholder — 클라이언트는 SSE Last-Event-Id 로 보정.
      seq: 0,
      updatedAt: (
        execution.finishedAt ??
        execution.startedAt ??
        new Date()
      ).toISOString(),
    };
  }

  private async loadAndAssertAlive(executionId: string): Promise<Execution> {
    const execution = await this.executionRepository.findOne({
      where: { id: executionId },
      select: ['id', 'status'],
    });
    if (!execution) {
      throw new NotFoundException({
        error: { code: 'EXECUTION_NOT_FOUND', message: 'Execution not found' },
      });
    }
    if (TERMINAL_STATUSES.has(execution.status)) {
      throw new GoneException({
        error: {
          code: 'EXECUTION_TERMINATED',
          message: 'Execution is already terminated',
        },
      });
    }
    return execution;
  }

  private assertNodeId(dto: InteractDto): void {
    if (!dto.nodeId) {
      throw badRequest(
        'INVALID_COMMAND',
        `nodeId is required for command "${dto.command}"`,
      );
    }
  }

  /**
   * spec §7.5.1 — continuation publish 의 publisher 측 사전 검증 (resolveWaiting
   * NodeExecutionId) 이 throw 하는 `INVALID_EXECUTION_STATE` 를 EIA 외부 진입점의
   * 409 `STATE_MISMATCH` 로 매핑한다 (assertWaiting 과 동일 의미 — assertWaiting
   * 통과 후의 race window 보강). 그 외 에러는 그대로 전파.
   */
  private async dispatchContinuation(promise: Promise<unknown>): Promise<void> {
    try {
      await promise;
    } catch (error: unknown) {
      if (error instanceof InvalidExecutionStateError) {
        throw new ConflictException({
          error: { code: 'STATE_MISMATCH', message: error.message },
        });
      }
      throw error;
    }
  }

  private assertWaiting(execution: Execution): void {
    if (execution.status !== ExecutionStatus.WAITING_FOR_INPUT) {
      throw new ConflictException({
        error: {
          code: 'STATE_MISMATCH',
          message: `Execution is not waiting for input (current=${execution.status})`,
        },
      });
    }
  }
}

function badRequest(code: string, message: string): BadRequestException {
  return new BadRequestException({ error: { code, message } });
}
