import { Inject, Injectable, Logger } from '@nestjs/common';
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
import { Node } from '../nodes/entities/node.entity';
import { ExecutionContext } from '../../nodes/core/node-handler.interface';
import { ExecutionContextService } from './context/execution-context.service';
import { ConversationThreadService } from './conversation-thread/conversation-thread.service';
import { ExecutionEventEmitter } from './events/execution-event-emitter.service';
import {
  ExecutionEventType,
  NodeEventType,
} from '../websocket/websocket.service';
import { redactThreadForPublic } from '../../shared/conversation-thread/thread-renderer';
import { toEngineFlatShape } from './handler-output.adapter';
import {
  PARK_RELEASED,
  type ProcessTurnResult,
} from '../../shared/execution-resume/process-turn-result';
import { withInteractionMeta } from './ai-conversation-helpers';
import {
  ENGINE_DRIVER,
  type InteractionEngineDriver,
} from './engine-driver.interface';

/**
 * C-1 step3 (strangler-fig) — Form blocking-interaction 생명주기를 god-class
 * `ExecutionEngineService` 에서 추출한 전담 서비스.
 *
 * **책임**: Form 노드 park(`waitForFormSubmission`) + §7.5 rehydration 의 폼 제출
 * 직접 처리(`processFormResumeTurn`). 엔진 잔류 상태/라이프사이클 메서드는
 * `InteractionEngineDriver`(소비자별 ISP slice; token `ENGINE_DRIVER`,
 * `useExisting: ExecutionEngineService`)
 * 경유로 호출한다 (PR2 `AiTurnOrchestrator` 선례와 동일 패턴). 메서드 본문은
 * 추출 전과 **완전히 동일**하게 보존됐고, `this.<engine-stays>` 호출만
 * `this.driver.<…>` 로 재배선됐다.
 *
 * 엔진의 dispatch-loop park 진입(top-level/중첩 executeInline)과 resume
 * registry 의 `form` 항목은 본 서비스로 위임한다. continuation-bus PUBLISHER
 * (`continueExecution`)와 publisher 측 검증(`assertFormSubmissionValid` /
 * `coerceFormValue`)은 PR2 가 `continueAiConversation` 을 엔진에 남긴 것과
 * 동일하게 엔진에 잔류한다.
 */
@Injectable()
export class FormInteractionService {
  private readonly logger = new Logger(FormInteractionService.name);

  constructor(
    private readonly contextService: ExecutionContextService,
    private readonly conversationThreadService: ConversationThreadService,
    private readonly eventEmitter: ExecutionEventEmitter,
    @InjectRepository(NodeExecution)
    private readonly nodeExecutionRepository: Repository<NodeExecution>,
    @Inject(ENGINE_DRIVER)
    private readonly driver: InteractionEngineDriver,
  ) {}

  /**
   * Park execution at a Form node (waiting_for_input) — durable 영속
   * (stageDurableResumeSnapshot + WAITING 전이 + resume_call_stack) 후 즉시
   * `PARK_RELEASED` 반환(코루틴 해제; top-level dispatch + 중첩 executeInline 공통,
   * exec-park D6 full B3). 폼 제출 재개는 §7.5 rehydration 의 직접 처리기
   * {@link processFormResumeTurn} 가 payload 로 수행한다.
   */
  async waitForFormSubmission(
    savedExecution: Execution,
    executionId: string,
    node: Node,
    context: ExecutionContext,
  ): Promise<ProcessTurnResult> {
    // Emit waiting event so frontend can render the form. Prefer the
    // structured cache entry (new NodeHandlerOutput shape) so the frontend
    // can read the form declaration from `.config`; fall back to the flat
    // cache for legacy handlers that still stash declarations at the root.
    const nodeOutput =
      context.structuredOutputCache?.[node.id] ??
      context.nodeOutputCache[node.id];

    // Update the node execution to waiting_for_input AND persist the output
    // shape so REST polling reconciliation stays consistent with WS —
    // otherwise polling would overwrite the WS-delivered outputData with
    // `null`, making the rendered form declaration disappear between polls.
    const nodeExec = await this.nodeExecutionRepository.findOne({
      where: { executionId, nodeId: node.id },
      order: { startedAt: 'DESC' },
    });
    if (nodeExec) {
      nodeExec.status = NodeExecutionStatus.WAITING_FOR_INPUT;
      // outputData 의 meta.interactionType 을 명시 보장 — 페이지 재마운트 시
      // execution.snapshot reconcile (use-execution-events.ts) 이 이 필드로
      // store 의 waitingInteractionType 을 set. 누락 시 prev/page 마운트 race
      // 에서 'buttons'/'form'/'ai_conversation' 분기를 못 잡아 Preview 탭의
      // 버튼이 disabled 로 그려진다.
      nodeExec.outputData = withInteractionMeta(
        nodeOutput as unknown as Record<string, unknown>,
        'form',
      );
    }
    // park 직전 conversationThread 스냅샷을 Execution 행에 실어, 아래 상태 전이
    // 트랜잭션과 원자적으로 durable commit 한다 (§7.5 rehydration 복원처).
    this.driver.stageDurableResumeSnapshot(savedExecution, context);
    // Atomic: Execution → WAITING_FOR_INPUT + NodeExecution save (WARN #4)
    await this.driver.updateExecutionStatus(
      savedExecution,
      ExecutionStatus.WAITING_FOR_INPUT,
      nodeExec ?? undefined,
    );
    await this.eventEmitter.emitExecution(
      executionId,
      ExecutionEventType.EXECUTION_WAITING_FOR_INPUT,
      {
        status: ExecutionStatus.WAITING_FOR_INPUT,
        waitingNodeId: node.id,
        waitingNodeType: node.type,
        waitingNodeLabel: node.label ?? node.type,
        nodeExecutionId: nodeExec?.id,
        // 프론트엔드 store 가 NODE_STARTED 를 ws subscribe 완료 전에 놓친
        // 시나리오에서도 row 의 startedAt 을 채울 수 있도록 항상 동봉한다 —
        // 누락 시 selectSortedNodeResults 이 해당 row 를 timeline 마지막으로 보냄.
        startedAt: nodeExec?.startedAt?.toISOString?.(),
        // 3 waiting emit (Buttons / Form / AI) 모두 top-level interactionType
        // 을 명시 — frontend 의 handleWaitingForInput 가 첫 fallback (즉
        // payload.interactionType) 만으로 정확히 분기하도록 일관화. (Carousel
        // 버튼 disabled stuck 버그의 defense-in-depth.)
        interactionType: 'form',
        nodeOutput,
        // Live ConversationThread snapshot so UI can render the running
        // thread panel (spec/conventions/conversation-thread.md §4 +
        // spec/5-system/6-websocket-protocol.md §4.4.5). Secret-masked at this
        // public EIA egress boundary (EIA §R17 / conversation-thread §8.4).
        conversationThread: redactThreadForPublic(context.conversationThread),
      },
    );

    // park = 세그먼트 종료 — durable 영속(stageDurableResumeSnapshot + WAITING 전이
    // + resume_call_stack)이 끝났으므로 대기 없이 즉시 PARK_RELEASED 반환(코루틴 해제,
    // top-level / 중첩 executeInline 공통 — exec-park D6 full B3). 재개(폼 제출)는
    // §7.5 rehydration 의 직접 처리기 {@link processFormResumeTurn} 가 payload 로
    // 수행한다 — 옛 in-memory pendingContinuations + firePayload 경로는 제거됐다.
    return PARK_RELEASED;
  }

  /**
   * spec §10.9 — `continueExecution` 이 publish 하는 sentinel 형태인지 확인.
   * `{ type: 'form_submitted', formData }` 구조를 type-safe 하게 판별.
   * W7 (SUMMARY): sentinel 언래핑 이중 타입 단언 → 헬퍼 추출.
   */
  private static isFormSubmittedSentinel(
    v: unknown,
  ): v is { type: 'form_submitted'; formData: unknown } {
    return (
      v !== null &&
      typeof v === 'object' &&
      (v as Record<string, unknown>)['type'] === 'form_submitted'
    );
  }

  /**
   * §7.5 rehydration — 폼 제출 payload 로 waiting Form 노드를 직접 완료 처리한다
   * (exec-park D6 full B3). `driveResumeAwaited`(top-level) / `driveResumeFrame`
   * (중첩 innermost) 가 도착 continuation payload 와 함께 호출한다. 옛
   * `waitForFormSubmission('await')` + pendingContinuations + firePayload 폴링 경로를
   * 대체 — in-memory 머신 없이 직접 전달. 처리: sentinel unwrap → 필드 화이트리스트 →
   * structured/flat output 갱신 → ConversationThread append → NodeExecution
   * COMPLETED + Execution RUNNING 전이 → NODE_COMPLETED / EXECUTION_RESUMED emit.
   */
  async processFormResumeTurn(
    savedExecution: Execution,
    executionId: string,
    node: Node,
    context: ExecutionContext,
    payload: unknown,
  ): Promise<void> {
    const nodeExec = await this.nodeExecutionRepository.findOne({
      where: { executionId, nodeId: node.id },
      order: { startedAt: 'DESC' },
    });
    // spec §10.9 — sentinel unwrap. continueExecution 이 `{type:'form_submitted',
    // formData}` 로 wrap 해 publish 했으므로 sentinel guard 로 안전하게 unwrap.
    const formData = FormInteractionService.isFormSubmittedSentinel(payload)
      ? payload.formData
      : (() => {
          this.logger.warn(
            `processFormResumeTurn — sentinel 없는 폴백 payload execution=${executionId} (continueExecution 경로 외 비정상).`,
          );
          return payload;
        })();

    // Merge submitted form data into the structured NodeHandlerOutput.
    // The form handler stored `{ config, output: {}, status:
    // 'waiting_for_input', meta }` on the initial execute; here we populate
    // `output.interaction.{type,data,receivedAt}` and flip `status` to the
    // unified `'resumed'` value (CONVENTIONS §4.4 / §4.5).
    const prevStructured = context.structuredOutputCache?.[node.id];
    const receivedAt = new Date().toISOString();
    // WARN #8 (Security) — formData 가 node.config.fields 에 정의된 필드명만
    // 통과하도록 화이트리스트 필터링. 미정의 키 (XSS payload, 외부 통합 키 등)
    // 는 제거. 필드 type / required 는 form handler 의 도메인이므로 여기서는
    // 화이트리스트만 적용 (defense-in-depth).
    const rawData =
      formData === null ||
      formData === undefined ||
      typeof formData !== 'object'
        ? {}
        : (formData as Record<string, unknown>);
    const fieldDefs = (node.config?.fields ?? []) as Array<{
      name?: unknown;
    }>;
    const allowedFieldNames = new Set(
      fieldDefs
        .map((f) => f?.name)
        .filter((n): n is string => typeof n === 'string'),
    );
    const interactionData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawData)) {
      if (allowedFieldNames.size === 0 || allowedFieldNames.has(key)) {
        interactionData[key] = value;
      }
    }
    // §5.5 — resume 시 실제 대기 경과시간으로 meta.durationMs 를 갱신한다. waiting tick 에 저장된
    // prevStructured.meta 의 durationMs 는 0(대기 진입 직후 계산)이라, 재개 시점에 nodeExec.startedAt
    // (대기 진입 시각) 으로부터의 경과로 대체한다. nodeExec 부재 시(테스트 등) prevStructured.meta 보존.
    const resumeFinishedAt = new Date();
    const resumeDurationMs = nodeExec?.startedAt
      ? Math.max(0, resumeFinishedAt.getTime() - nodeExec.startedAt.getTime())
      : undefined;
    const prevMeta =
      typeof prevStructured?.meta === 'object' && prevStructured.meta !== null
        ? prevStructured.meta
        : undefined;
    // 재수화(서버 재시작) 경로에서는 structuredOutputCache 가 비어 prevMeta 가 undefined 일 수 있다.
    // 이 경우에도 form 노드의 meta.interactionType 은 보존돼야 하므로(spec §5.5) fallback 으로 보강한다.
    const fallbackMeta: Record<string, unknown> =
      node.type === 'form' ? { interactionType: 'form' } : {};
    const resumedMeta =
      prevMeta !== undefined ||
      resumeDurationMs !== undefined ||
      Object.keys(fallbackMeta).length > 0
        ? {
            ...fallbackMeta,
            ...(prevMeta ?? {}),
            ...(resumeDurationMs !== undefined
              ? { durationMs: resumeDurationMs }
              : {}),
          }
        : undefined;
    const updatedStructured = {
      config: prevStructured?.config ?? node.config ?? {},
      output: {
        interaction: {
          type: 'form_submitted' as const,
          data: interactionData,
          receivedAt,
        },
      },
      status: 'resumed',
      port: 'out',
      ...(resumedMeta !== undefined ? { meta: resumedMeta } : {}),
    };
    this.contextService.setStructuredOutput(
      this.driver.contextKeyOf(context),
      node.id,
      updatedStructured,
    );
    this.contextService.setNodeOutput(
      this.driver.contextKeyOf(context),
      node.id,
      toEngineFlatShape(updatedStructured),
    );
    // Append the user interaction to the ConversationThread so downstream AI
    // Agent nodes with `contextScope` can auto-inject it. Single mutation
    // entrypoint per spec/conventions/conversation-thread.md §2.1.
    this.conversationThreadService.appendPresentationInteraction(context, {
      node: {
        id: node.id,
        label: node.label,
        type: node.type,
        config: node.config,
      },
      interaction: {
        type: 'form_submitted',
        data: interactionData,
        receivedAt,
      },
    });
    // Keep `updatedOutput` alias for the rest of the function (DB save, emit).
    // Downstream consumers (frontend) receive the structured shape and can
    // unwrap via output-shape helper.
    const updatedOutput = updatedStructured;

    // Update node execution to completed with merged output
    if (nodeExec) {
      nodeExec.status = NodeExecutionStatus.COMPLETED;
      nodeExec.outputData = updatedOutput;
      // §5.5 — meta.durationMs 와 동일 시각·계산을 공유 (structured meta ↔ DB durationMs 일관성).
      // startedAt 부재 시 NaN 회피, 시계 역행 시 Math.max(0) (resumeDurationMs 계산과 동일 가드).
      nodeExec.finishedAt = resumeFinishedAt;
      nodeExec.durationMs =
        resumeDurationMs ??
        (nodeExec.startedAt
          ? Math.max(
              0,
              resumeFinishedAt.getTime() - nodeExec.startedAt.getTime(),
            )
          : 0);
    }

    // Atomic: NodeExecution COMPLETED + Execution RUNNING (WARN #4)
    // 재개 드라이브(driveResumeAwaited / driveResumeFrame)가 진입 시 이미
    // WAITING_FOR_INPUT → RUNNING 전이를 수행했으므로, 이미 RUNNING 이면 상태 전이를
    // 건너뛰고 NodeExecution 만 COMPLETED 영속한다 (RUNNING→RUNNING assertTransition
    // 회피 — finalizeAiNode 의 동일 가드와 대칭).
    if (savedExecution.status === ExecutionStatus.RUNNING) {
      if (nodeExec) {
        await this.nodeExecutionRepository.save(nodeExec);
      }
    } else {
      await this.driver.updateExecutionStatus(
        savedExecution,
        ExecutionStatus.RUNNING,
        nodeExec ?? undefined,
      );
    }

    if (nodeExec) {
      await this.eventEmitter.emitNode(
        executionId,
        node.id,
        NodeEventType.NODE_COMPLETED,
        {
          nodeExecutionId: nodeExec.id,
          parentNodeExecutionId: context.parentNodeExecutionId,
          status: NodeExecutionStatus.COMPLETED,
          duration: nodeExec.durationMs,
          nodeType: node.type,
          nodeLabel: node.label ?? node.type,
          output: nodeExec.outputData,
          input: nodeExec.inputData,
          // ws 의 NODE_STARTED race miss 시에도 store row 의 startedAt 이
          // 누락되지 않도록 모든 NODE_* 이벤트에 startedAt 동봉 (timeline
          // selectSortedNodeResults 정합성).
          startedAt: nodeExec.startedAt?.toISOString?.(),
          finishedAt: nodeExec.finishedAt?.toISOString?.(),
        },
      );
    }
    await this.eventEmitter.emitExecution(
      executionId,
      ExecutionEventType.EXECUTION_RESUMED,
      { status: ExecutionStatus.RUNNING },
    );
  }
}
