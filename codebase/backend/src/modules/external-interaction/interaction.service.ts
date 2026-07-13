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
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../node-executions/entities/node-execution.entity';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import {
  InvalidExecutionStateError,
  MessageTooLongError,
  FormValidationError,
} from '../execution-engine/workflow-errors';
import type { ValidationDetail } from '../execution-engine/workflow-errors';
import { ErrorCode } from '../../nodes/core/error-codes';
import { ExecutionsService } from '../executions/executions.service';
import { InteractionTokenService } from './interaction-token.service';
import { InteractDto } from './dto/interact.dto';
import {
  ExecutionStatusDto,
  type WaitingContextBaseDto,
} from './dto/responses/execution-status-response.dto';
import { InteractAckDto } from './dto/responses/interact-ack-response.dto';
import { RefreshTokenResponseDto } from './dto/responses/refresh-token-response.dto';
import {
  ExternalInteractionRequestContext,
  InteractionRequestContext,
  isInternalCtx,
} from './interaction.guard';
import { redactThreadForPublic } from '../../shared/conversation-thread/thread-renderer';
import { deepRedactSecrets } from '../../shared/utils/sanitize-error-message';

const TERMINAL_STATUSES: ReadonlySet<ExecutionStatus> = new Set([
  ExecutionStatus.COMPLETED,
  ExecutionStatus.FAILED,
  ExecutionStatus.CANCELLED,
]);

/**
 * `getStatus()` 반환의 `seq` 필드 placeholder 값.
 *
 * REST V1 단발 응답에는 in-memory SSE seq 카운터에 접근할 방법이 없다.
 * 클라이언트는 이 값이 아니라 SSE `Last-Event-Id` 로 실제 seq 를 보정한다 (EIA §5.3).
 */
const SSE_SEQ_PLACEHOLDER = 0;

/**
 * `getStatus()` 1단계 조회가 읽는 컬럼 — 응답 조립에 실제로 쓰이는 것만.
 *
 * `satisfies` 로 `keyof Execution` 을 강제한다: 컬럼명을 오기하면(예: snake_case `output_data`)
 * 런타임에 `undefined` 가 되어 조용히 잘못된 응답이 나가는 대신 **컴파일이 깨진다**.
 * 반환 DTO 에 필드를 추가할 때 이 배열도 함께 늘려야 한다 —
 * 특히 `updatedAt` 은 `finishedAt ?? startedAt ?? new Date()` 라 누락 시 "현재 시각" 으로 침묵 회귀한다.
 *
 * `conversation_thread` 는 의도적으로 제외 — `waiting_for_input` 에서만 2단계로 읽는다.
 */
const STATUS_PROJECTION_COLUMNS = [
  'id',
  'status',
  'workflowId',
  'startedAt',
  'finishedAt',
  'outputData',
] satisfies (keyof Execution)[];

/**
 * [Spec EIA §5] — Inbound interaction REST endpoint 의 비즈니스 로직.
 *
 * 본 service 는 facade — 토큰 검증은 InteractionGuard 가 이미 통과시킨 상태에서 호출된다.
 * 각 dispatch 는 ExecutionEngineService / ExecutionsService 의 기존 public 메서드를 그대로
 * 재사용 (WebSocket gateway 의 명령 경로와 동일 — Spec EIA §R5/§R10 의 facade 원칙).
 *
 * dispatch 매핑 ([Spec EIA §11]). 외부 scope 는 `expectedNodeId`(=`dto.nodeId`)를 함께
 * 넘겨 publisher 가 실제 대기 노드와 대조하고(§7.5.1 F-1), in_process_trusted 는 undefined:
 *   submit_form      → ExecutionEngineService.continueExecution(executionId, data, expectedNodeId)
 *   click_button     → ExecutionEngineService.continueButtonClick(executionId, buttonId, expectedNodeId)
 *   submit_message   → ExecutionEngineService.continueAiConversation(executionId, message, expectedNodeId)
 *   end_conversation → ExecutionEngineService.endAiConversation(executionId, expectedNodeId)
 *   cancel           → ExecutionsService.stop(executionId)
 *
 * **대기 표면 검증은 본 service 가 하지 않는다** — `assertWaiting` 은 execution 이
 * `waiting_for_input` 인지만 본다. "명령이 현재 대기 노드의 인터랙션 표면에 허용되는가"
 * (예: Form 대기 중 `end_conversation` 거부) 는 4종 명령이 공유하는 publisher chokepoint
 * (`resolveWaitingNodeExecutionId` → `assertCommandMatchesWaitingSurface`, 실행 엔진
 * §7.5.1) 가 검증하며, throw 된 `InvalidExecutionStateError` 를 아래 `dispatchContinuation`
 * 이 409 `STATE_MISMATCH` 로 매핑한다. WS gateway 도 같은 chokepoint 를 지나므로 두 표면이
 * 자동으로 정합한다 (facade 원칙 §R5/§R10).
 */
@Injectable()
export class InteractionService {
  constructor(
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(NodeExecution)
    private readonly nodeExecutionRepository: Repository<NodeExecution>,
    private readonly executionEngineService: ExecutionEngineService,
    private readonly executionsService: ExecutionsService,
    private readonly tokenService: InteractionTokenService,
  ) {}

  async interact(
    ctx: InteractionRequestContext,
    dto: InteractDto,
  ): Promise<InteractAckDto> {
    const execution = await this.loadAndAssertAlive(ctx.executionId);
    // [spec §7.5.1] 외부 caller 는 대상 nodeId 를 지정하고 실제 대기 노드와 일치해야
    // publisher 가 수용한다. in_process_trusted(chat-channel 고정 매핑, nodeId 미상)는
    // 면제 — expectedNodeId=undefined 로 publisher 의 nodeId 검사를 건너뛴다.
    const expectedNodeId = isInternalCtx(ctx) ? undefined : dto.nodeId;
    switch (dto.command) {
      case 'submit_form':
        this.assertNodeId(dto, ctx);
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
            expectedNodeId,
          ),
        );
        break;
      case 'click_button':
        this.assertNodeId(dto, ctx);
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
            expectedNodeId,
          ),
        );
        break;
      case 'submit_message':
        this.assertNodeId(dto, ctx);
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
            expectedNodeId,
          ),
        );
        break;
      case 'end_conversation':
        this.assertNodeId(dto, ctx);
        this.assertWaiting(execution);
        await this.dispatchContinuation(
          this.executionEngineService.endAiConversation(
            ctx.executionId,
            expectedNodeId,
          ),
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
      currentStatus: refreshed?.status ?? 'running',
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

  /**
   * [EIA §5.3] 단발 상태 조회 — 현재 execution 상태와 waiting_for_input 컨텍스트 반환.
   *
   * **보안 제약**: `nodeOutput` / `outputData` / `conversationThread` 는 SSE `waiting_for_input`
   * payload 와 동일하게 **공개 EIA 표면**(SSE + 본 REST 엔드포인트)으로 흘러간다. 실행 엔진·노드
   * 핸들러는 민감 중간 결과(API 키, PII 등)를 `NodeExecution.outputData` 또는 conversation turn 텍스트에
   * 기록하면 안 된다. 허용되는 데이터는 EIA 클라이언트가 렌더에 필요한 interaction 메타(버튼 설정,
   * 폼 스키마, conversation config)와 대화 히스토리로 한정한다 (node-execution.entity.ts `@Index` JSDoc 참조).
   * `conversationThread` 의 turn 텍스트 불변식은 SSE 와 공유하는 `redactThreadForPublic` 로 egress 시
   * 런타임 마스킹돼 자동 강제된다 (EIA §R17). `outputData`/`nodeOutput` 키-allowlist 는 별개 잔여 항목.
   *
   * **`conversationThread` (durable 동봉, EIA §R17 재조정 2026-07-09)**: `waiting_for_input` 시
   * durable 스냅샷(`Execution.conversation_thread`)을 SSE 와 동일 wire shape 으로 동봉해 위젯의
   * **새로고침 히스토리 복원**을 5분 SSE buffer·서버 재시작·인스턴스 스위치와 무관하게 지원한다.
   * 이미 SSE `waiting_for_input` 으로 공개 중인 데이터라 신규 민감 표면이 아니다.
   *
   * **조회는 2단계**: 얇은 status projection 으로 먼저 읽고, `waiting_for_input` 일 때만
   * `conversation_thread` 를 재조회한다 (수 MB 까지 자라는 컬럼을 상태 무관하게 싣지 않기 위함).
   * wire 형식은 두 경로 모두 동일 — 조회 최적화일 뿐 응답 계약(§5.3)에는 영향이 없다.
   *
   * `seq` 는 항상 `SSE_SEQ_PLACEHOLDER(0)` — REST 단발 응답에서는 in-memory SSE seq 에
   * 접근할 수 없다. 클라이언트는 SSE `Last-Event-Id` 로 실제 seq 를 보정한다.
   */
  async getStatus(ctx: InteractionRequestContext): Promise<ExecutionStatusDto> {
    // 1단계 — 얇은 status 우선 조회. `conversation_thread` 를 여기서 빼는 것이 핵심이다.
    // 그 jsonb 는 turn 이 최대 500개(§4 storage cap)이고 turn 텍스트는 저장 시점에 truncate 되지
    // 않으므로(4000자 cap 은 LLM 주입 시점 §5.3 전용) 행이 수 MB 까지 자란다. 그런데 응답 동봉은
    // `waiting_for_input` 한정이라, 나머지 상태(폴링이 잦은 running/pending, 종료 후 completed/failed)
    // 에서는 TOAST 청크를 읽어 역직렬화한 뒤 그대로 버리는 비용만 남는다. 2단계에서만 가져온다.
    const execution = await this.executionRepository.findOne({
      where: { id: ctx.executionId },
      select: STATUS_PROJECTION_COLUMNS,
    });
    if (!execution) {
      throw new NotFoundException({
        error: { code: 'EXECUTION_NOT_FOUND', message: 'Execution not found' },
      });
    }
    // waiting_for_input 이면 현재 대기 노드의 표면을 복원해 동봉한다 (EIA §5.3).
    // SSE waiting 이벤트를 구독 전 emit race 로 놓친 클라이언트가 본 응답으로 현재 표면을
    // 시드할 수 있도록, SSE `waiting_for_input` wire payload 와 **동일 형식**(interactionType /
    // waitingNodeId / buttonConfig / nodeOutput)으로 구성한다 → 위젯이 `parseWaitingForInput`
    // 을 그대로 재사용. 아울러 `conversationThread` 는 durable 스냅샷(`Execution.conversation_thread`,
    // park 시 commit)에서 동봉해 **새로고침 히스토리 복원**을 5분 SSE buffer·서버 재시작과 무관하게
    // 지원한다 (EIA §R17 재조정 2026-07-09 — 종전엔 SSE 전용 권위라 생략했음). `seq` 만 SSE 권위.
    let currentNode: ExecutionStatusDto['currentNode'] = null;
    let context: ExecutionStatusDto['context'] = null;
    if (execution.status === ExecutionStatus.WAITING_FOR_INPUT) {
      // 2단계 — durable thread 는 이 분기에서만 필요하므로 여기서 재조회한다. 대기 NodeExecution
      // 조회와 독립이라 병렬로 띄운다. 이 경로의 쿼리 수는 2→3 으로 늘지만 **왕복 depth 는 2 로
      // 그대로**다 (종전에도 execution → nodeExecution 순차 2회였다). 늘어난 1회는 PK 단건 조회다.
      // 1단계와의 간극에 상태가 바뀌어도 응답은 스냅샷이라 무해하고(thread 는 park 커밋 시점에만
      // 갱신된다), row 가 사라지면 아래 null 분기가 "durable thread 없음" graceful 경로로 흡수한다.
      const [threadRow, nodeExec] = await Promise.all([
        this.executionRepository.findOne({
          where: { id: ctx.executionId },
          select: ['id', 'conversationThread'],
        }),
        this.nodeExecutionRepository.findOne({
          where: {
            executionId: ctx.executionId,
            status: NodeExecutionStatus.WAITING_FOR_INPUT,
          },
          order: { startedAt: 'DESC' },
          relations: ['node'],
        }),
      ]);
      // durable park 스냅샷 = SSE `waiting_for_input` 이 싣는 `redactThreadForPublic(context.conversationThread)`
      // 와 동일 wire shape (park 시 stageDurableResumeSnapshot 이 commit). SSE 와 동일 helper 로
      // secret-mask 하여 REST·SSE 양 경로 일관 (EIA §R17 / conversation-thread §8.4). null(배포 이전 row /
      // park 이력 없음)이면 미동봉 — 위젯 threadToMessages 가 undefined 를 빈 배열로 graceful 처리.
      const conversationThread = threadRow?.conversationThread
        ? redactThreadForPublic(threadRow.conversationThread)
        : undefined;
      if (nodeExec?.node) {
        // EIA §R17 — nodeOutput 도 공개 표면. conversationConfig.message/messages
        // 등 자유 텍스트/구조화 필드의 secret 을 마스킹(값 패턴 + credential 키).
        // conversationThread·ai_message 와 동일 데이터가 여기로 우회 노출되던 갭 차단.
        const out = deepRedactSecrets(nodeExec.outputData ?? {}) as Record<
          string,
          unknown
        >;
        const meta = (out.meta ?? {}) as { interactionType?: string };
        const rawInteractionType = meta.interactionType ?? null;
        const interactionType =
          rawInteractionType === 'form' ||
          rawInteractionType === 'buttons' ||
          rawInteractionType === 'ai_conversation'
            ? rawInteractionType
            : null;
        currentNode = {
          id: nodeExec.nodeId,
          type: nodeExec.node.type,
          interactionType,
        };
        // buttons: structured(`config.buttonConfig`) 우선, legacy flat(`buttonConfig`) fallback.
        const structured = out as {
          config?: { buttonConfig?: { buttons?: unknown } };
          buttonConfig?: { buttons?: unknown };
        };
        const bc = structured.config?.buttonConfig ?? structured.buttonConfig;
        if (interactionType) {
          // 공통 필드 선조립 — interactionType/waitingNodeId + (durable) conversationThread top-level.
          // conversationThread 는 값이 있을 때만 키를 얹는다 (present-when-available, API 규약 §5.4).
          // 명시 annotate 필수 — spread 가 interactionType 리터럴을 string 으로 넓힌다.
          // (지우면 아래 context 대입이 컴파일 에러로 드러난다.)
          const base: WaitingContextBaseDto = {
            interactionType,
            waitingNodeId: nodeExec.nodeId,
            ...(conversationThread ? { conversationThread } : {}),
          };
          context =
            interactionType === 'buttons' && bc
              ? // SSE 와 동일 wire: buttonConfig = { buttons, nodeOutput }.
                {
                  ...base,
                  buttonConfig: { buttons: bc.buttons, nodeOutput: out },
                }
              : // form / ai_conversation: parseWaitingForInput 이 nodeOutput.formConfig /
                // nodeOutput.conversationConfig 를 읽는다 → nodeOutput 그대로 동봉.
                // buttonConfig 를 복원하지 못한 buttons 도 여기로 fallthrough 하므로
                // interactionType 은 variant 판별자가 될 수 없다 (Swagger 규약 §1-4).
                { ...base, nodeOutput: out };
        }
      }
    }
    return {
      id: execution.id,
      workflowId: execution.workflowId,
      status: execution.status as ExecutionStatusDto['status'],
      currentNode,
      context,
      // EIA §R17 — terminal outputData(result/error)도 공개 표면. secret-shape 만
      // 마스킹(정상 결과 데이터는 deepRedactSecrets 의 copy-on-change 로 보존).
      result:
        execution.status === ExecutionStatus.COMPLETED
          ? (deepRedactSecrets(execution.outputData ?? null) as Record<
              string,
              unknown
            > | null)
          : null,
      error:
        execution.status === ExecutionStatus.FAILED
          ? (deepRedactSecrets(execution.outputData ?? null) as Record<
              string,
              unknown
            > | null)
          : null,
      seq: SSE_SEQ_PLACEHOLDER,
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

  /**
   * [spec §7.5.1] 외부 caller 는 대상 nodeId 를 반드시 지정한다 (그리고 publisher 가
   * 실제 대기 노드와 일치 검증). `in_process_trusted`(chat-channel 고정 매핑)는 대기
   * nodeId 를 알지 못하므로 nodeId 요구·일치 검사에서 면제된다 (§7.5.1 exemption).
   */
  private assertNodeId(dto: InteractDto, ctx: InteractionRequestContext): void {
    if (isInternalCtx(ctx)) return;
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
   * 통과 후의 race window 보강).
   *
   * I-5 (spec EIA §5.1 / 실행 엔진 §7.5.2): `MessageTooLongError` →
   * 400 `MESSAGE_TOO_LONG`. 내부 길이 수치는 `serverDetail` 전용 — 응답에 미노출.
   *
   * `FormValidationError` (spec form §4·§6.2 / EIA §5.1): `submit_form` field 검증 실패 →
   * 400 `VALIDATION_ERROR` + `details[{field, message, code:'INVALID_FIELD'}]`.
   * execution 은 `waiting_for_input` 유지(재제출 가능) — publisher 가 publish 전 throw.
   * 현재 단계 FIRST 오류만 surface. `details` 배열 길이 항상 1.
   *
   * 그 외 에러는 그대로 전파.
   */
  private async dispatchContinuation(promise: Promise<unknown>): Promise<void> {
    try {
      await promise;
    } catch (err: unknown) {
      if (err instanceof InvalidExecutionStateError) {
        throw new ConflictException({
          error: { code: 'STATE_MISMATCH', message: err.message },
        });
      }
      // I-5 (refactor 04 A-1 후속) — submit_message 길이 초과 typed error 를
      // generic 500 대신 400 으로 매핑한다 (spec §14 §5.1 / 실행 엔진 §7.5.2).
      // `error.message` 는 고정 client-safe 문자열 — 내부 길이 수치는 serverDetail
      // 전용이라 응답에 노출되지 않는다.
      if (err instanceof MessageTooLongError) {
        throw badRequest('MESSAGE_TOO_LONG', err.message);
      }
      // [spec §5.1 / form §4·§6.2] submit_form field 검증 실패 → 400 VALIDATION_ERROR
      // + details[{field, message, code:'INVALID_FIELD'}]. execution 은 waiting 유지
      // (publisher 가 publish 전 throw — 재제출 가능).
      if (err instanceof FormValidationError) {
        throw badRequest(
          ErrorCode.VALIDATION_ERROR,
          err.message,
          err.toHttpDetails(),
        );
      }
      throw err;
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

function badRequest(
  code: string,
  message: string,
  details?: ReadonlyArray<ValidationDetail>,
): BadRequestException {
  return new BadRequestException({
    error: { code, message, ...(details ? { details } : {}) },
  });
}
