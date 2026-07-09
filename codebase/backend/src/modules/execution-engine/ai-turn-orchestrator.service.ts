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
import {
  ExecutionContext,
  ResumableMessageSource,
  ResumableNodeHandler,
  isResumableNodeHandler,
} from '../../nodes/core/node-handler.interface';
import { NodeHandlerRegistry } from '../../nodes/core/node-handler.registry';
import { ExecutionContextService } from './context/execution-context.service';
import type { ResumeState } from './utils/resume-state.schema';
import { ExecutionEventEmitter } from './events/execution-event-emitter.service';
import {
  ExecutionEventType,
  NodeEventType,
} from '../websocket/websocket.service';
import { redactThreadForPublic } from '../../shared/conversation-thread/thread-renderer';
import {
  deepRedactSecrets,
  redactSecrets,
  sanitizeLastErrorMessage,
} from '../../shared/utils/sanitize-error-message';
import { extractRetryAfterMs } from '../../shared/utils/retry-after';
import {
  adaptHandlerReturn,
  toEngineFlatShape,
} from './handler-output.adapter';
import {
  PARK_RELEASED,
  type ProcessTurnResult,
} from '../../shared/execution-resume/process-turn-result';
import type { ResumeTurnContext } from './resume-turn-dispatch';
import type { ContinuationPayload } from './queues/continuation-execution.queue';
import {
  RehydrationError,
  withInteractionMeta,
  withSourceMarker,
  buildConversationConfigFromOutput,
  buildConversationMetaFromResumeState,
  buildAiMessageDebugFromResumeState,
  userMessageSignalApplies,
} from './ai-conversation-helpers';
// C-1 step3 (W3) — `WaitingInteractionType` 정의는 interaction-type-registry.md
// §1.1 핀에 따라 엔진 파일에 잔류한다. 타입 전용 import 라 런타임에 소거되어
// orchestrator→엔진 값 순환을 만들지 않는다 (값 helper 는 위 helper 모듈에서).
import type { WaitingInteractionType } from './execution-engine.service';
import {
  ENGINE_DRIVER,
  type AiTurnEngineDriver,
} from './engine-driver.interface';

/**
 * C-1 step2 (strangler-fig) — AI 멀티턴 생명주기를 god-class
 * `ExecutionEngineService` 에서 추출한 전담 orchestrator.
 *
 * **책임**: first-turn park(`waitForAiConversation`)·§7.5 rehydration resume
 * (`handleAiResumeTurn`/`processAiResumeTurn`)·단발 turn 처리(`handleAiMessageTurn`)·
 * 대화 종료/오류 finalize. 엔진 잔류 상태/라이프사이클 메서드는
 * `AiTurnEngineDriver`(소비자별 ISP slice; token `ENGINE_DRIVER`,
 * `useExisting: ExecutionEngineService`) 경유로 호출한다.
 * 메서드 본문은 추출 전과 **완전히 동일**하게 보존됐고, `this.<engine-stays>`
 * 호출만 `this.driver.<…>` 로 재배선됐다.
 *
 * 엔진의 public 진입점(`continueAiConversation`/`endAiConversation`)과 resume
 * registry(`ai_conversation` 항목)는 본 orchestrator 로 위임한다.
 */
@Injectable()
export class AiTurnOrchestrator {
  private readonly logger = new Logger(AiTurnOrchestrator.name);

  constructor(
    private readonly handlerRegistry: NodeHandlerRegistry,
    private readonly contextService: ExecutionContextService,
    private readonly eventEmitter: ExecutionEventEmitter,
    @InjectRepository(NodeExecution)
    private readonly nodeExecutionRepository: Repository<NodeExecution>,
    @Inject(ENGINE_DRIVER)
    private readonly driver: AiTurnEngineDriver,
  ) {}

  /**
   * Multi-turn AI 재개(§7.5) handler — `_resumeCheckpoint` 로 `_resumeState` 를
   * 재구성(`buildRetryReentryState` 는 retry 재진입과 공유하는 재구성기)해
   * nodeOutputCache 에 seed 한 뒤, 도착 turn(payload)을 단발 처리한다
   * (`processAiResumeTurn`). 계속이면 re-park(`PARK_RELEASED`)로 세그먼트 종료,
   * 종료면 `void` 반환 후 호출측 그래프 순회로 이어진다. 재구성 실패(schema drift /
   * 손상)는 graceful `RESUME_INCOMPATIBLE_STATE`.
   */
  async handleAiResumeTurn(ctx: ResumeTurnContext): Promise<ProcessTurnResult> {
    let resumeState: Record<string, unknown>;
    try {
      ({ resumeState } = this.driver.buildRetryReentryState(
        ctx.savedExecution,
        ctx.node,
        ctx.context,
        ctx.resumeCheckpoint as Record<string, unknown>,
        // #501 회귀 — resume 턴의 통합 usage-log attribution 을 위해 대기
        // NodeExecution row id 를 재구성 state 에 재주입한다 (checkpoint 미영속).
        { resumeMode: true, nodeExecutionId: ctx.nodeExec?.id },
      ));
    } catch (err) {
      throw new RehydrationError(
        'RESUME_INCOMPATIBLE_STATE',
        `Multi-turn AI 노드(${ctx.node.type}) _resumeCheckpoint 재구성 실패: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    // 재구성한 `_resumeState` 를 nodeOutputCache 에 주입 (handleAiMessageTurn /
    // emitAiWaitingForInput 양쪽이 올바른 shape 을 보도록).
    this.contextService.setNodeOutput(
      this.driver.contextKeyOf(ctx.context),
      ctx.node.id,
      {
        ...(ctx.cachedOutput ?? {}),
        _resumeState: resumeState,
      },
    );
    return this.processAiResumeTurn(
      ctx.savedExecution,
      ctx.executionId,
      ctx.node,
      ctx.context,
      ctx.nodeExec,
      resumeState,
      ctx.payload,
    );
  }

  async waitForAiConversation(
    savedExecution: Execution,
    executionId: string,
    node: Node,
    context: ExecutionContext,
  ): Promise<ProcessTurnResult> {
    const nodeOutput = context.nodeOutputCache[node.id] as Record<
      string,
      unknown
    >;
    // WARN #18 — resumeState 가 undefined 일 때 buildConversationMetaFromResumeState
    // 호출이 TypeError 던지던 문제 해소. 핸들러가 _resumeState 를 누락한 비정상
    // 상황에서도 빈 객체로 fallback 하여 nullable propagation 차단.
    const resumeState =
      (nodeOutput._resumeState as ResumeState | undefined) ?? {};

    // ENG-RC-* — multi-turn resume 핸들러는 ExecutionContext 가 아닌 state 만
    // 인자로 받으므로 (`processMultiTurnMessage(message, state)`), 첫 turn 이
    // waiting_for_input 으로 진입할 때 엔진이 raw config snapshot 을 state 에
    // 자동으로 합쳐 후속 turn 에서 `state.rawConfig` 로 일관되게 접근할 수 있게 한다.
    // 핸들러가 명시적으로 설정한 rawConfig 가 있다면 존중한다 (덮어쓰지 않음).
    if (!('rawConfig' in resumeState)) {
      resumeState.rawConfig = Object.freeze({ ...(node.config ?? {}) });
    }

    const nodeExec = await this.nodeExecutionRepository.findOne({
      where: { executionId, nodeId: node.id },
      order: { startedAt: 'DESC' },
    });

    await this.emitAiWaitingForInput(
      savedExecution,
      executionId,
      node,
      context,
      nodeExec,
      nodeOutput,
      resumeState,
    );

    // exec-park D6 full B3 — turn-park: 초기 AI 응답 emit + park 가 끝났으므로 루프
    // 없이 즉시 PARK_RELEASED 반환(세그먼트 종료, 코루틴 해제). top-level / 중첩
    // executeInline 공통. 다음 turn 입력은 새 continuation job → §7.5 rehydration 의
    // 단발 turn 처리({@link processAiResumeTurn})로 재개한다. emitAiWaitingForInput 가
    // _resumeCheckpoint + conversation_thread + user_variables 를 durable 영속했으므로
    // 무손실. 옛 in-memory 장수 루프(runAiConversationLoop)는 제거됐다 — 응답 없는
    // 대화도 in-process 메모리 0 점유(bounded).
    return PARK_RELEASED;
  }

  /**
   * exec-park D4/D6 — §7.5 rehydration 의 멀티턴 AI **단발 turn 처리기**. 옛 in-memory
   * 장수 루프를 대체한다(top-level + 중첩 executeInline 공통, full B3): 도착한
   * continuation `payload` 1건만 처리하고, 대화가 **계속**되면 다음 turn 을 위해
   * re-park(durable 영속 +
   * `waiting_for_input` 전이)한 뒤 `PARK_RELEASED` 를 반환해 세그먼트를 종료한다
   * (코루틴 해제 — 응답 없는 대화도 in-process 메모리 0 점유). 대화가 **종료**되면
   * {@link finalizeAiNode} 로 노드를 단말 마킹하고 `void` 를 반환해 caller
   * (`driveResumeAwaited`)가 남은 그래프 순회를 잇게 한다.
   *
   * 호출 시점 Execution 은 RUNNING(driveResumeAwaited 전이). re-park 시
   * {@link emitAiWaitingForInput} 가 RUNNING→WAITING_FOR_INPUT 으로 되돌리며
   * `_resumeCheckpoint`(§1.3) + `conversation_thread`(V084) + `user_variables`(V085)
   * 를 durable 영속 → 다음 turn rehydration 무손실. (응답은 `handleAiMessageTurn` 가
   * `AI_MESSAGE` 로, 이어 re-park 가 `EXECUTION_WAITING_FOR_INPUT` 로 emit.)
   *
   * @param opts.retryReentry — retry-last-turn 재진입(`applyRetryLastTurn`)에서 true.
   *   종료 turn 의 `finalizeAiNode` 가 FAILED→RUNNING 전이(state-machine retry 전용)를
   *   허용하도록 전파한다. 일반 resume turn 은 미설정.
   * @returns 계속(re-park) 시 `PARK_RELEASED`, 종료 시 `void`.
   */
  async processAiResumeTurn(
    savedExecution: Execution,
    executionId: string,
    node: Node,
    context: ExecutionContext,
    nodeExec: NodeExecution | null,
    resumeState: Record<string, unknown>,
    payload: unknown,
    opts?: { retryReentry?: boolean },
  ): Promise<ProcessTurnResult> {
    const contextKey = this.driver.contextKeyOf(context);
    const finalizeOpts = opts?.retryReentry
      ? { retryReentry: true as const }
      : undefined;
    // W10 (ai-review) — `payload` 는 §7.5 rehydration 의 새 진입점이라 방어적 null
    // guard. null/비객체(또는 `type` 부재) continuation 은 `action.type` 접근 전에
    // 걸러 warn 후 re-park 한다 (옛 loop 의 unknown 분기와 동형 — 대화 alive 유지).
    if (
      payload === null ||
      typeof payload !== 'object' ||
      typeof (payload as { type?: unknown }).type !== 'string'
    ) {
      this.logger.warn(
        `[processAiResumeTurn] malformed continuation payload (type 부재/비객체) for execution=${executionId} — re-park`,
      );
      await this.reparkAiResumeTurn(savedExecution, context, nodeExec);
      return PARK_RELEASED;
    }
    const action = payload as ContinuationPayload;

    // 대화 종료 신호 — 노드 단말 마킹 후 caller 가 그래프 진행.
    if (action.type === 'ai_end_conversation') {
      this.handleAiEndConversation(executionId, contextKey, node, resumeState);
      await this.finalizeAiNode(
        savedExecution,
        executionId,
        node,
        context,
        nodeExec,
        'COMPLETED',
        finalizeOpts,
      );
      return;
    }

    // 정상 turn (ai_message / form_submitted: AI render_form 응답) — 한 turn 처리.
    if (action.type === 'ai_message' || action.type === 'form_submitted') {
      const message =
        action.type === 'form_submitted'
          ? JSON.stringify(action.formData ?? {})
          : action.message;
      const turn = await this.handleAiMessageTurn(
        executionId,
        contextKey,
        node,
        message,
        resumeState,
        nodeExec,
        action.type === 'form_submitted' ? 'form_submitted' : 'ai_message',
      );
      if (turn.finalStatus === 'FAILED') {
        await this.finalizeAiNode(
          savedExecution,
          executionId,
          node,
          context,
          nodeExec,
          'FAILED',
          finalizeOpts,
        );
        return;
      }
      if (turn.ended) {
        await this.finalizeAiNode(
          savedExecution,
          executionId,
          node,
          context,
          nodeExec,
          'COMPLETED',
          finalizeOpts,
        );
        return;
      }
      // 계속 — 다음 turn 을 위해 re-park (durable 영속 + WAITING 전이).
      await this.reparkAiResumeTurn(savedExecution, context, nodeExec);
      return PARK_RELEASED;
    }

    // spec/4-nodes/6-presentation/0-common.md §10.9 line 407 — ai_conversation 대기
    // 중 presentation 본체 버튼은 표시·라우팅 안 됨. 도달(stale telegram
    // inline_keyboard 재시도 등) 시 graceful: 상태 변경 없이 re-park (대화 alive 유지).
    if (action.type === 'button_click') {
      this.logger.warn(
        '[processAiResumeTurn] button_click received during ai_conversation — stale inline_keyboard, re-park',
        { executionId, nodeId: node.id },
      );
      await this.reparkAiResumeTurn(savedExecution, context, nodeExec);
      return PARK_RELEASED;
    }

    // 알 수 없는 action.type — silent skip 회피. warn 후 re-park (다음 입력 대기).
    // (옛 loop 의 MAX_UNKNOWN_SKIPS in-memory 누적 cap 은 turn-park 에선 각 turn 이
    // 별 continuation job 이라 비적용 — BullMQ attempts/dedup 이 폭주를 제한한다.)
    this.logger.warn(
      `[processAiResumeTurn] unknown continuation action.type=${String(
        action.type,
      ).slice(0, 64)} for execution=${executionId} — re-park`,
    );
    await this.reparkAiResumeTurn(savedExecution, context, nodeExec);
    return PARK_RELEASED;
  }

  /**
   * Phase B (PR-B2, exec-park D4) — 계속되는 멀티턴 AI turn 후 **re-park**.
   * `handleAiMessageTurn` 가 이미 credential-strip 된 `_resumeCheckpoint` 를
   * NodeExecution.outputData 에 영속하고 `AI_MESSAGE` 응답을 emit 했으므로, re-park 는
   * (a) `conversation_thread`/`user_variables` durable 스냅샷 스테이징과
   * (b) RUNNING→WAITING_FOR_INPUT 전이(NodeExecution 동반 save)만 수행한다.
   * `emitAiWaitingForInput` 를 재호출하지 않는 이유: 그 persist 는 top-level-only
   * `_resumeState` strip 이라 `handleAiMessageTurn` 의 `setNodeOutput` 가 만든 nested
   * `output._resumeState`(systemPrompt/llmConfigId 포함)를 재영속 시 누락(credential
   * 유출)시킨다 — 재영속 자체를 제거해 회피한다. button_click/unknown(상태 미변경)
   * re-park 도 동일 경로(기존 checkpoint 보존 + WAITING 복귀).
   */
  private async reparkAiResumeTurn(
    savedExecution: Execution,
    context: ExecutionContext,
    nodeExec: NodeExecution | null,
  ): Promise<void> {
    // §7.5 재개 진입 원자 claim(06 C-2) 이후 nodeExec 는 RUNNING 으로 로드된다
    // (claim 이 WFI→RUNNING 페어링 전이). re-park 는 이를 다시 WAITING_FOR_INPUT
    // 으로 되돌려야 한다 — 명시 설정 없이 linkedNodeExec save 만 하면 RUNNING 이
    // 그대로 영속돼 다음 cold rehydration 이 실패한다. (claim 도입 전에는 nodeExec
    // 가 이미 WAITING 이라 이 설정이 불필요했다.)
    if (nodeExec) {
      nodeExec.status = NodeExecutionStatus.WAITING_FOR_INPUT;
    }
    this.driver.stageDurableResumeSnapshot(savedExecution, context);
    await this.driver.updateExecutionStatus(
      savedExecution,
      ExecutionStatus.WAITING_FOR_INPUT,
      nodeExec ?? undefined,
    );
  }

  /**
   * PR-H — `waitForAiConversation` 분해. 첫 turn 에서 NodeExecution 을
   * WAITING_FOR_INPUT 으로 atomic 전이 (WARN #4) + 클라이언트에 초기 waiting
   * 이벤트 emit (`EXECUTION_WAITING_FOR_INPUT`) — turn 1 의 AI response 가
   * 동봉된다.
   */
  private async emitAiWaitingForInput(
    savedExecution: Execution,
    executionId: string,
    node: Node,
    context: ExecutionContext,
    nodeExec: NodeExecution | null,
    nodeOutput: Record<string, unknown>,
    resumeState: Record<string, unknown>,
  ): Promise<void> {
    // Source-of-truth for the waiting payload is `structuredOutputCache` —
    // the canonical NodeHandlerOutput populated when the handler returned.
    const structured = context.structuredOutputCache?.[node.id];
    const structuredOutput = structured?.output as
      | Record<string, unknown>
      | undefined;
    const structuredConfig = structured?.config ?? undefined;
    // spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii — handler may set
    // `meta.interactionType: 'ai_form_render'` when render_form blocked the
    // first turn. Fall back to the regular chat path otherwise.
    const structuredMeta = structured?.meta as
      | { interactionType?: string }
      | undefined;
    const initialInteractionType: WaitingInteractionType =
      structuredMeta?.interactionType === 'ai_form_render'
        ? 'ai_form_render'
        : 'ai_conversation';
    const initialPendingFormToolCall =
      initialInteractionType === 'ai_form_render'
        ? (resumeState.pendingFormToolCall as
            | { toolCallId: string; formConfig: Record<string, unknown> }
            | undefined)
        : undefined;

    if (nodeExec) {
      nodeExec.status = NodeExecutionStatus.WAITING_FOR_INPUT;
      // Persist the canonical structured shape (config/output/meta/status)
      // so REST polling reconciliation surfaces a NodeHandler-Output-compliant
      // document. Falls back to the flat cache for legacy in-flight rows.
      // WARN #6 (Security) — _resumeState 는 engine-internal 한 turn debug,
      // model state, rawConfig (잠재 credential 포함) 등을 담으므로 DB 에
      // 저장하지 않는다. Multi-turn 상태는 in-memory nodeOutputCache 에서만
      // 유지되며 server restart 시 메모리에서 소실된다 — Execution 자체는
      // WAITING_FOR_INPUT 으로 보존되지만 (workflow-resumable-execution
      // Phase 1.1) 후속 turn 입력이 들어와도 §7.5 rehydration 이 구현되기
      // 전까지는 silent skip 된다 (Phase 2 에서 BullMQ continuation-queue +
      // rehydration 으로 본격 해결 예정).
      const persistedOutput: Record<string, unknown> = {
        ...(structured ?? nodeOutput),
      };
      delete persistedOutput._resumeState;
      // §7.5 rehydration — full `_resumeState` 는 위에서 strip 하되, 재시작 후
      // 재개를 위해 credential-strip 부분집합 `_resumeCheckpoint` 를 DB 영속한다.
      // **`ai_agent` · `information_extractor`** (spec §1.3 allow-list 합집합).
      // checkpoint allow-list 는 두 핸들러 runtime state 의 합집합이고 config
      // 필드는 재개 시 node.config 에서 재유도된다. 그 외 ai_conversation 핸들러는
      // 고유 state 미등록이라 미영속 → 재개 시 graceful reset.
      if (this.driver.isCheckpointEligibleNodeType(node.type)) {
        const checkpoint = this.driver.buildResumeCheckpoint(resumeState);
        if (checkpoint) {
          persistedOutput._resumeCheckpoint = checkpoint;
        }
      }
      // meta.interactionType 명시 — snapshot reconcile 이 정확한 분기로 hydrate.
      nodeExec.outputData = withInteractionMeta(
        persistedOutput,
        initialInteractionType,
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

    const initialConv = buildConversationConfigFromOutput(
      structuredOutput,
      structuredConfig,
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
        // 프론트엔드 store 가 NODE_STARTED 를 놓친 경우에도 row 의 startedAt
        // 을 채울 수 있도록 동봉 (selectSortedNodeResults 정렬 정합성 보장).
        startedAt: nodeExec?.startedAt?.toISOString?.(),
        // 3 waiting emit (Buttons / Form / AI) 모두 top-level interactionType
        // 명시 — frontend 의 handleWaitingForInput 가 첫 fallback 만으로 정확히
        // 분기하도록 일관화. nodeOutput.interactionType 도 backward compat 으로
        // 유지 (snapshot reconcile 의 nested 읽기 / 기존 e2e assertion 안전 보존).
        interactionType: initialInteractionType,
        // Live thread snapshot for UI (spec/conventions/conversation-thread.md §4
        // + spec/5-system/6-websocket-protocol.md §4.4.5). Secret-masked at this
        // public EIA egress boundary (EIA §R17 / conversation-thread §8.4).
        conversationThread: redactThreadForPublic(context.conversationThread),
        nodeOutput: {
          interactionType: initialInteractionType,
          ...(structuredConfig && Object.keys(structuredConfig).length > 0
            ? { config: structuredConfig }
            : {}),
          // EIA §R17 — conversationConfig 는 message/messages(같은 AI 텍스트)를
          // 실어 공개 표면으로 나가므로 egress 마스킹(ai_message/thread 우회 차단).
          // turnDebug.llmCalls(에디터 전용 원문)는 건드리지 않도록 여기만 마스킹.
          conversationConfig: deepRedactSecrets({
            ...initialConv,
            ...(initialPendingFormToolCall
              ? { pendingFormToolCall: initialPendingFormToolCall }
              : {}),
          }) as Record<string, unknown>,
          // run-results UI 의 References / LLM Usage 탭이 진행 중에도 동작하도록
          // _resumeState 의 누적치를 meta.* 로 펼쳐 노출. _resumeState 자체는
          // system prompt / llmConfigId 등 internal 필드를 포함하므로 client 에
          // 그대로 보내지 않는다.
          meta: buildConversationMetaFromResumeState(resumeState),
        },
        // Include Turn 1 debug data for initial AI response
        turnDebug: {
          llmCalls:
            ((resumeState.turnDebugHistory as unknown[]) ?? [])[0] ?? undefined,
          metadata: {
            model: resumeState.model,
            inputTokens: resumeState.totalInputTokens,
            outputTokens: resumeState.totalOutputTokens,
          },
        },
      },
    );
  }

  /**
   * 사용자 발화(q)를 다음 턴 LLM 호출 전에 라이브로 노출하는 USER_MESSAGE
   * 진행 신호를 1회 emit 한다. `tool_call_*` 와 동형의 **비권위 라이브 신호**로
   * 영속 대상이 아니다 — 권위 출처는 turn 종료 `AI_MESSAGE.messages` 스냅샷.
   * `nodeExecutionId` 는 현재 `waiting_for_input` NodeExecution row PK,
   * `receivedAt` 은 엔진 수신 시각 (handler 의 `output.interaction.receivedAt`
   * 과 같은 수신 tick). 호출 게이팅은 {@link userMessageSignalApplies}.
   * SoT: spec/5-system/6-websocket-protocol.md §4.4 / spec/4-nodes/3-ai/1-ai-agent.md §7.5.
   */
  private async emitUserMessageLiveSignal(
    executionId: string,
    node: Node,
    nodeExec: NodeExecution | null,
    message: string,
  ): Promise<void> {
    await this.eventEmitter.emitExecution(
      executionId,
      ExecutionEventType.USER_MESSAGE,
      {
        nodeExecutionId: nodeExec?.id,
        nodeId: node.id,
        message,
        receivedAt: new Date().toISOString(),
      },
    );
  }

  /**
   * PR-H — 사용자 메시지 1회 turn 처리. 핸들러 (`processMultiTurnMessage`)
   * 호출 → 결과 정규화 → 분기:
   *  - waiting → AI_MESSAGE + 후속 EXECUTION_WAITING_FOR_INPUT emit, 다음 turn
   *    을 위한 새 resumeState 반환 (`ended: false`)
   *  - terminal → 종료 AI_MESSAGE emit + structured/flat cache 갱신, 같은
   *    resumeState 반환 (`ended: true`)
   *
   * 핸들러는 `ResumableNodeHandler` 인터페이스 (`processMultiTurnMessage`
   * 보유) 를 구현해야 한다. 미구현 시 명시적 throw (CRIT #4 — duck-typing 제거).
   */
  private async handleAiMessageTurn(
    executionId: string,
    // in-memory context Map 키 (원칙 4) — background 본문은 bgKey, 그 외 executionId.
    // 이 메서드는 context 객체를 받지 않으므로 호출자가 contextKeyOf(context) 를 전달.
    contextKey: string,
    node: Node,
    message: string,
    resumeState: Record<string, unknown>,
    nodeExec: NodeExecution | null,
    /**
     * 입력 origin 신호. spec/4-nodes/3-ai/1-ai-agent.md §6.2 step 2.c.bypass —
     * `pendingFormToolCall` set + `source: 'ai_message'` 면 handler 가 cancelled
     * tool_result fallback 으로 분기. dispatch 에서 `'ai_message'` /
     * `'form_submitted'` 를 결정적으로 전달.
     */
    source: ResumableMessageSource = 'ai_message',
  ): Promise<{
    resumeState: Record<string, unknown>;
    ended: boolean;
    /**
     * 2026-05-19 — spec/4-nodes/3-ai/1-ai-agent.md §7.9. turn 처리 중 handler
     * 가 throw 한 경우 (LLM 429 등) 본 필드가 `'FAILED'` 로 set 된다.
     * `waitForAiConversation` 가 이 신호를 `finalizeAiNode(.., finalStatus)` 로
     * 전달해 NodeExecution → FAILED, Execution → FAILED 로 마무리한다.
     * 정상 경로 (waiting → continue, ended success) 는 undefined.
     */
    finalStatus?: 'FAILED';
  }> {
    // Process user message via the node's own handler (so both ai_agent
    // and information_extractor can implement conversational extraction
    // with their own domain logic).
    // CRIT #4 — duck-typing 제거. ResumableNodeHandler 인터페이스로 narrow.
    const handler = this.handlerRegistry.get(node.type);
    if (!isResumableNodeHandler(handler)) {
      throw new Error(
        `Node type "${node.type}" cannot process multi-turn message: ` +
          'handler does not implement ResumableNodeHandler interface',
      );
    }
    // 사용자 발화(q) 조기 노출 — 다음 턴 LLM 호출 전에 1회 emit (§7.5 / WS §4.4).
    if (userMessageSignalApplies(source)) {
      await this.emitUserMessageLiveSignal(
        executionId,
        node,
        nodeExec,
        message,
      );
    }
    // spec §7.9 — handler throw (LLM 429 / timeout / connection 등) 시 conversation
    // loop 를 자연 종료시키고 `finalizeAiNode(.., 'FAILED')` 로 노드 상태를
    // FAILED 전이한다. catch 없이 propagate 하면 `waitForAiConversation` 의
    // while loop 가 throw 를 들고 종료해 `finalizeAiNode` 호출 자체가 누락
    // (NodeExecution.status = WAITING_FOR_INPUT 영구 잔류) — 본 try/catch 가 그
    // 회귀의 차단막. 운영 보고 2026-05-19 (LLM 429 시 frontend 헤더 "실패" +
    // 노드 "Waiting" 모순 상태).
    let result: unknown;
    try {
      result = await handler.processMultiTurnMessage(message, resumeState, {
        source,
      });
    } catch (err) {
      return this.handleAiTurnError(
        executionId,
        contextKey,
        node,
        resumeState,
        nodeExec,
        err,
        handler,
        // spec/4-nodes/3-ai/1-ai-agent.md §7.9 — the failed user message
        // (this turn's input) is NOT in `resumeState.messages` (that snapshot
        // is the pre-turn history). Carry it into `_retryState` so the retry
        // re-entry can replay this exact last turn (re-call the LLM).
        message,
        source,
      );
    }
    const resultObj = result as Record<string, unknown>;

    if (resultObj.status === 'waiting_for_input') {
      // 회귀 ③ 방어 (사용자 보고 2026-05-25): LLM 호출 (`processMultiTurnMessage`)
      // await 도중 외부 path 가 ExecutionContext 를 삭제했을 가능성을 사전 검증.
      // 발생 시 throw 대신 graceful exit — 본 turn 처리는 의미 없음 (execution 이
      // 이미 cancelled/failed 됨). throw 하면 runExecution 의 catch 가 다시 FAILED
      // 마킹하면서 destructive 오류 로그가 production 에 쌓임.
      // tracking 로그: ExecutionContextService.setNodeOutput 의 MISSING 분기가
      // caller stack 을 출력 — `[ctx-trace]` prefix 로 grep.
      if (!this.contextService.getContext(contextKey)) {
        this.logger.warn(
          `handleAiMessageTurn: ExecutionContext absent on LLM-resume — ` +
            `execution=${executionId} node=${node.id}. ` +
            `Treating as graceful no-op (likely cancelled/failed during await). ` +
            `Race source diagnosis: look for [ctx-trace] deleteContext logs prior.`,
        );
        return { resumeState, ended: true, finalStatus: 'FAILED' };
      }

      // Run the canonical adapter once so production-strict validation
      // is enforced and the structured cache stays consistent for the
      // next emit cycle / REST polling reconciliation.
      const adaptedNext = adaptHandlerReturn(result);
      this.contextService.setStructuredOutput(contextKey, node.id, adaptedNext);
      const flatNext = this.driver.applyPortSelection(
        toEngineFlatShape(adaptedNext),
      );
      this.contextService.setNodeOutput(contextKey, node.id, flatNext);

      // Persist the accumulated turn snapshot to `NodeExecution.outputData`
      // (DB SoT — spec/5-system/4-execution-engine.md §646). Without this,
      // a second client (e.g. the execution detail page opened in another
      // tab) reading via REST `/executions/:id` sees only the first turn's
      // messages, because the in-memory `structuredOutputCache` is local to
      // the originating tab's WebSocket subscription.
      //
      // Mirrors `emitAiWaitingForInput` (first-turn entry) and
      // `waitForButtonInteraction` (button waiting) — both already do this.
      // The Execution row stays WAITING_FOR_INPUT (self-transition) so we
      // save just the NodeExecution; no `updateExecutionStatus` needed.
      //
      // WARN #6 — strip `_resumeState` via allowlist destructure (any new
      // internal field at the top level is automatically excluded; matches
      // `emitAiWaitingForInput` policy). `_resumeState` carries engine-
      // internal turn debug, model state, and rawConfig (potential
      // credentials). Multi-turn state lives in the in-memory cache only;
      // server restart loses the in-memory cache. Execution stays in
      // WAITING_FOR_INPUT (workflow-resumable-execution Phase 1.1 — no longer
      // auto-FAILED by recoverStuckExecutions), Phase 2 will introduce §7.5
      // rehydration to actually resume from any instance.
      //
      // `nodeExec` should normally exist here — the first turn entered via
      // `emitAiWaitingForInput` already persisted it. A null arrival means
      // the row was lost between turns (e.g. external truncation, cleanup
      // race); the in-memory cache is still authoritative for the live
      // session, but the cross-tab snapshot cannot be hydrated. Warn loudly
      // instead of silently skipping so the gap shows up in logs.
      if (nodeExec) {
        const { _resumeState: _stripped, ...safe } = adaptedNext as unknown as {
          _resumeState?: unknown;
        } & Record<string, unknown>;
        // §7.5 rehydration — full `_resumeState` 는 strip, credential-strip
        // 부분집합 `_resumeCheckpoint` 만 DB 영속해 재시작 후 재개를 보장한다.
        // `ai_agent` · `information_extractor` (emitAiWaitingForInput 와 동일 —
        // allow-list 합집합, spec §1.3).
        if (this.driver.isCheckpointEligibleNodeType(node.type)) {
          const checkpoint = this.driver.buildResumeCheckpoint(
            _stripped as Record<string, unknown> | undefined,
          );
          if (checkpoint) {
            (safe as Record<string, unknown>)._resumeCheckpoint = checkpoint;
          }
        }
        void _stripped;
        nodeExec.outputData = withInteractionMeta(safe, 'ai_conversation');
        try {
          await this.nodeExecutionRepository.save(nodeExec);
        } catch (err) {
          this.logger.error(
            `handleAiMessageTurn: failed to persist NodeExecution.outputData for ` +
              `executionId=${executionId} nodeId=${node.id}: ${
                err instanceof Error ? err.message : String(err)
              }`,
          );
        }
      } else {
        this.logger.warn(
          `handleAiMessageTurn: nodeExec missing for executionId=${executionId} ` +
            `nodeId=${node.id} — DB outputData persist skipped, cross-tab snapshot ` +
            `will lag in-memory turn state until next NODE_COMPLETED.`,
        );
      }

      // Update state for next turn
      const nextResumeState = adaptedNext._resumeState as ResumeState;

      const adaptedOutput = adaptedNext.output as
        | Record<string, unknown>
        | undefined;
      const adaptedConfig = (adaptedNext.config ?? undefined) as
        | Record<string, unknown>
        | undefined;
      const nextConv = buildConversationConfigFromOutput(
        adaptedOutput,
        adaptedConfig,
      );

      // Emit AI response event (filter system prompts from client).
      // Shape mirrors the terminal-emit branch below so the frontend
      // debug timeline (Response / Request / LLM Usage tabs) can match
      // assistant messages to their LLM calls during live waiting too.
      // The earlier flat fields (lastTurnRequest / lastTurnResponse /
      // lastTurnDurationMs on resumeState) are intentionally not emitted —
      // turnDebugHistory's last entry already carries the same data and
      // additionally preserves the per-call sequence in tool loops.
      await this.eventEmitter.emitExecution(
        executionId,
        ExecutionEventType.AI_MESSAGE,
        {
          // Sub-Workflow 안에서 같은 nodeId 의 AI Agent 가 여러 번 도달
          // 할 수 있으므로 nodeExecutionId 를 명시 — frontend store 가
          // 정확한 row 에 message 를 라우팅한다.
          nodeExecutionId: nodeExec?.id,
          nodeId: node.id,
          // EIA §R17 — `execution.ai_message` 는 SSE·webhook·Chat Channel(외부
          // 발송) 로 나가는 공개 표면이므로 free-text/구조화 필드를 egress 마스킹.
          message: redactSecrets(nextConv.message),
          turnCount: nextConv.turnCount,
          messages: deepRedactSecrets(nextConv.messages) as Array<
            Record<string, unknown>
          >,
          ...(nextConv.presentations
            ? {
                presentations: deepRedactSecrets(
                  nextConv.presentations,
                ) as typeof nextConv.presentations,
              }
            : {}),
          metadata: {
            model: nextResumeState.model,
            inputTokens: nextResumeState.totalInputTokens,
            outputTokens: nextResumeState.totalOutputTokens,
          },
          ...buildAiMessageDebugFromResumeState(nextResumeState),
        },
      );

      // spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii — handler may emit
      // `'ai_form_render'` when render_form blocked the turn. Fall back to
      // `'ai_conversation'` for the normal multi-turn chat path.
      const handlerMeta = adaptedNext.meta as
        | { interactionType?: string }
        | undefined;
      const nextInteractionType: WaitingInteractionType =
        handlerMeta?.interactionType === 'ai_form_render'
          ? 'ai_form_render'
          : 'ai_conversation';
      // When entering ai_form_render, surface the pendingFormToolCall to the
      // client so it can build the `submit_form` payload with matching id.
      const pendingFormToolCall =
        nextInteractionType === 'ai_form_render'
          ? (nextResumeState.pendingFormToolCall as
              | { toolCallId: string; formConfig: Record<string, unknown> }
              | undefined)
          : undefined;

      // Emit waiting_for_input again
      // Live thread snapshot for UI (multi-turn 후속 waiting tick — 새
      // ai_user/ai_assistant turn 이 push 된 직후 UI 가 확인할 수 있도록).
      // handleAiMessageTurn doesn't carry ExecutionContext, so we look it up
      // via contextService — single Map access.
      const liveThread =
        this.contextService.getContext(contextKey)?.conversationThread;
      // Secret-masked at this public EIA egress boundary (multi-turn follow-up
      // waiting emit) — EIA §R17 / conversation-thread §8.4.
      const conversationThreadSnapshot = liveThread
        ? redactThreadForPublic(liveThread)
        : undefined;
      await this.eventEmitter.emitExecution(
        executionId,
        ExecutionEventType.EXECUTION_WAITING_FOR_INPUT,
        {
          status: ExecutionStatus.WAITING_FOR_INPUT,
          waitingNodeId: node.id,
          waitingNodeType: node.type,
          waitingNodeLabel: node.label ?? node.type,
          nodeExecutionId: nodeExec?.id,
          // selectSortedNodeResults 정합성 — store 가 prior NODE_STARTED 를
          // 놓친 시나리오 대비 항상 동봉.
          startedAt: nodeExec?.startedAt?.toISOString?.(),
          // top-level interactionType — emitAiWaitingForInput 와 동일 shape
          // 유지 (multi-turn 후속 waiting emit). nested 도 backward compat 유지.
          interactionType: nextInteractionType,
          conversationThread: conversationThreadSnapshot,
          nodeOutput: {
            interactionType: nextInteractionType,
            // Pass through handler's echoed node config so the Config
            // tab can render during the waiting state. Conversation
            // handlers (AI Agent / Info Extractor multi-turn) add this.
            ...(adaptedConfig && Object.keys(adaptedConfig).length > 0
              ? { config: adaptedConfig }
              : {}),
            // EIA §R17 — conversationConfig egress 마스킹 (위 initial emit 과 동일).
            conversationConfig: deepRedactSecrets({
              ...nextConv,
              ...(pendingFormToolCall ? { pendingFormToolCall } : {}),
            }) as Record<string, unknown>,
            // 진행 중에도 References / LLM Usage 탭이 동작하도록 누적
            // 상태를 meta.* 로 노출. (turn 단위 ragSources 는 turnDebug[]
            // 안에 들어 있어 References 탭이 메시지(턴)별로 그룹핑.)
            meta: buildConversationMetaFromResumeState(nextResumeState),
          },
        },
      );

      return { resumeState: nextResumeState, ended: false };
    }

    // Terminal state — handlers always return canonical
    // `{ config, output, meta, port, status:'ended' }` (built via
    // buildMultiTurnFinalOutput / buildConditionOutput / buildErrorOutput).
    // Route to port and emit the final AI_MESSAGE event.
    const newOutput =
      (resultObj.output as Record<string, unknown> | undefined) ?? {};
    const newResult =
      (newOutput.result as Record<string, unknown> | undefined) ?? {};
    const sourceMessages = Array.isArray(newResult.messages)
      ? (newResult.messages as Array<Record<string, unknown>>)
      : [];
    const condMessages = withSourceMarker(
      sourceMessages.filter((m) => m.role !== 'system'),
    );
    const responseText = (newResult.response as string | undefined) ?? '';
    const turnCount = newResult.turnCount as number | undefined;
    const metaSource =
      (resultObj.meta as Record<string, unknown> | undefined) ?? {};

    // Shared shape with the waiting_for_input emit above — the helper
    // reads `turnDebugHistory`; the terminal path stores the same array
    // under `meta.turnDebug`, so we adapt the key in-line.
    const terminalPresentations = Array.isArray(newResult.presentations)
      ? (newResult.presentations as Array<Record<string, unknown>>)
      : undefined;
    await this.eventEmitter.emitExecution(
      executionId,
      ExecutionEventType.AI_MESSAGE,
      {
        // 종료 turn 도 nodeExecutionId 동봉 — Sub-Workflow nesting 에서
        // 같은 nodeId 의 conversation 이 여러 row 일 수 있다.
        nodeExecutionId: nodeExec?.id,
        nodeId: node.id,
        // EIA §R17 — 공개 표면(SSE·webhook·Chat Channel) egress 마스킹. (위 waiting
        // branch 와 동일 정책; 내부 WS 는 sanitizePayloadForWs 만.)
        message: redactSecrets(responseText),
        turnCount,
        messages: deepRedactSecrets(condMessages) as Array<
          Record<string, unknown>
        >,
        ...(terminalPresentations
          ? {
              presentations: deepRedactSecrets(
                terminalPresentations,
              ) as typeof terminalPresentations,
            }
          : {}),
        metadata: {
          model: metaSource.model,
          inputTokens: metaSource.inputTokens as number | undefined,
          outputTokens: metaSource.outputTokens as number | undefined,
        },
        ...buildAiMessageDebugFromResumeState({
          turnDebugHistory: metaSource.turnDebug,
        }),
      },
    );

    const adaptedConv = adaptHandlerReturn(resultObj);
    this.contextService.setStructuredOutput(contextKey, node.id, adaptedConv);
    const portRouted = this.driver.applyPortSelection(
      toEngineFlatShape(adaptedConv),
    );
    this.contextService.setNodeOutput(contextKey, node.id, portRouted);
    return { resumeState, ended: true };
  }

  /**
   * PR-H — 사용자가 명시적으로 대화 종료 (`ai_end_conversation`) 했을 때.
   * 핸들러의 `endMultiTurnConversation` 호출 → 결과 정규화 → cache 갱신.
   * 핸들러는 `ResumableNodeHandler` 를 구현해야 한다 (CRIT #4).
   */
  private handleAiEndConversation(
    executionId: string,
    // in-memory context Map 키 (원칙 4) — 호출자가 contextKeyOf(context) 전달.
    contextKey: string,
    node: Node,
    resumeState: Record<string, unknown>,
  ): void {
    const endReason = 'user_ended';

    // CRIT #4 — duck-typing 제거. ResumableNodeHandler 인터페이스로 narrow
    // 하여 핸들러가 두 메서드를 구현하지 않으면 명시적 에러 발생.
    const handler = this.handlerRegistry.get(node.type);
    if (!isResumableNodeHandler(handler)) {
      throw new Error(
        `Node type "${node.type}" cannot end multi-turn conversation: ` +
          'handler does not implement ResumableNodeHandler interface ' +
          '(processMultiTurnMessage / endMultiTurnConversation)',
      );
    }

    const finalOutput = handler.endMultiTurnConversation(
      resumeState,
      endReason,
    );

    // Normalize so that both the new NodeHandlerOutput shape (info
    // extractor post Stage 1, which carries its own port/meta) and the
    // legacy bare return (ai_agent) persist uniformly through the
    // structured cache + port selector path.
    const adaptedEnd = adaptHandlerReturn(finalOutput);
    this.contextService.setStructuredOutput(contextKey, node.id, adaptedEnd);
    const flatEnd = toEngineFlatShape(adaptedEnd);
    const routedEnd = this.driver.applyPortSelection(flatEnd);
    this.contextService.setNodeOutput(contextKey, node.id, routedEnd);
  }

  /**
   * 2026-05-19 — spec/4-nodes/3-ai/1-ai-agent.md §7.9 (Multi Turn 모드 — 오류
   * `error` 포트). turn 처리 중 handler 가 throw 하면 (LLM 429 / timeout /
   * connection 등) 본 helper 가 호출돼:
   *
   *  1. throw 된 예외에서 `{ code, message, details }` 를 추출 (message·details
   *     는 `sanitizeLastErrorMessage` 로 token/secret echo 차단).
   *  2. `handler.endMultiTurnConversation(state, 'error', errorPayload)` 호출 —
   *     spec §7.9 shape (`output.error` + 부분 `output.result.*` 병존, `port=
   *     "error"`, `status="ended"`).
   *  3. structured / flat cache + DB outputData 갱신 (`handleAiEndConversation`
   *     과 동일 단일 진입 패턴).
   *
   * conversation loop 는 `{ ended: true, finalStatus: 'FAILED' }` 를 받고 자연
   * 종료. `waitForAiConversation` 가 `finalizeAiNode(.., 'FAILED')` 를 호출해
   * `NodeExecution.status=FAILED` + `Execution.status=FAILED` 로 마무리하고
   * `NODE_FAILED` + `EXECUTION_FAILED` 이벤트를 단발사한다.
   *
   * ConversationThread 에는 직접 mutate 하지 않는다 (spec/conventions/
   * conversation-thread.md §3.1 의 단일 진입점 원칙 — 이전 turn 에서 push 된
   * `ai_user` turn 은 보존되고 추가 push 없이 finalize). continuation bus 도
   * 경유하지 않음 (오류는 엔진 내부 동기 경로).
   */
  private handleAiTurnError(
    executionId: string,
    // in-memory context Map 키 (원칙 4) — handleAiMessageTurn 의 contextKey 전달.
    contextKey: string,
    node: Node,
    resumeState: Record<string, unknown>,
    nodeExec: NodeExecution | null,
    err: unknown,
    handler: ResumableNodeHandler,
    /**
     * spec/4-nodes/3-ai/1-ai-agent.md §7.9 — the user message that triggered
     * the failed turn + its dispatch source. Forwarded into `_retryState` so
     * `applyRetryLastTurn` can replay the exact last turn. `resumeState.messages`
     * does NOT contain this message (it is the pre-turn history snapshot).
     */
    failedUserMessage?: string,
    failedUserMessageSource?: ResumableMessageSource,
  ): {
    resumeState: Record<string, unknown>;
    ended: true;
    finalStatus: 'FAILED';
  } {
    const errorPayload = AiTurnOrchestrator.extractAiTurnErrorPayload(err);
    this.logger.error(
      `AI Agent turn failed (executionId=${executionId} nodeId=${node.id}, ` +
        `code=${errorPayload.code}): ${errorPayload.message}`,
    );

    const errorResult = handler.endMultiTurnConversation(
      resumeState,
      'error',
      errorPayload,
      failedUserMessage,
      failedUserMessageSource,
    );
    const adapted = adaptHandlerReturn(errorResult);
    this.contextService.setStructuredOutput(contextKey, node.id, adapted);
    const portRouted = this.driver.applyPortSelection(
      toEngineFlatShape(adapted),
    );
    this.contextService.setNodeOutput(contextKey, node.id, portRouted);

    if (nodeExec) {
      // WARN #6 — `_resumeState` 는 DB 영속 페이로드에서 strip. 정상 finalize
      // (`finalizeAiNode`) 가 같은 strip 을 수행하지만, 이 시점에 cache 가
      // 새 error shape 으로 갱신됐으므로 일관성 위해 outputData 도 동기 갱신.
      //
      // 보존 예외 — `_retryState` (spec/5-system/4-execution-engine.md §1.3,
      // spec/conventions/node-output.md §4.2.1): retryable error 종결 시
      // buildMultiTurnFinalOutput 이 운반한 top-level `_retryState` 는
      // **strip 하지 않고** outputData 에 보존해 DB 영속한다. 이후 WS
      // `execution.retry_last_turn` 이 nodeExecutionId 로 lookup → 소비한다.
      const { _resumeState: _stripped, ...safe } = adapted as unknown as {
        _resumeState?: unknown;
        _retryState?: unknown;
      } & Record<string, unknown>;
      void _stripped;
      nodeExec.outputData = safe;
      // status / finishedAt / durationMs 는 finalizeAiNode 의 FAILED 분기에서
      // 일괄 처리한다 (단일 commit 지점 유지).
    } else {
      // req W_null — nodeExec 가 null 이면 DB 저장은 건너뛰지만 warn 을 기록해
      // 운영 로그에서 탐지 가능하도록 한다 (finalizeAiNode FAILED 분기와 대칭).
      this.logger.warn(
        `handleAiTurnError: nodeExec is null for executionId=${executionId} ` +
          `nodeId=${node.id} — DB save skipped, FAILED signal still propagated`,
      );
    }

    return { resumeState, ended: true, finalStatus: 'FAILED' };
  }

  /**
   * W12 (Maintainability) — network/timeout 분류용 패턴 상수화. errno 코드
   * (`err.code`) 와 메시지 본문을 각각 매칭한다. `extractAiTurnErrorPayload` /
   * `classifyLlmError` 가 공유.
   */
  private static readonly NETWORK_ERRNO_PATTERN =
    /^(ECONNRESET|ETIMEDOUT|ECONNREFUSED|ECONNABORTED|EAI_AGAIN|ENOTFOUND|EPIPE)$/;

  private static readonly NETWORK_MESSAGE_PATTERN =
    /\b(timed?\s*out|timeout|etimedout|econnreset|econnrefused|socket hang up|network error|fetch failed|connection (?:error|reset|refused))\b/i;

  /**
   * provider SDK 에러에서 HTTP status code 추출. Anthropic / OpenAI `APIError`
   * 는 `.status`, axios 풍은 `.response.status`, 일부 래퍼는 `.statusCode`.
   */
  private static extractHttpStatus(err: unknown): number | undefined {
    if (!err || typeof err !== 'object') return undefined;
    const e = err as {
      status?: unknown;
      statusCode?: unknown;
      response?: { status?: unknown } | null;
    };
    const raw =
      e.status ??
      e.statusCode ??
      (e.response && typeof e.response === 'object'
        ? e.response.status
        : undefined);
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
  }

  /**
   * W12 (Maintainability) — `extractAiTurnErrorPayload` 의 분기 트리를 분리한
   * 순수 분류 함수. HTTP status / explicit code / message 만 보고 spec
   * §10 (4-nodes/3-ai/1-ai-agent.md) 의 `{ code, retryable }` 를 도출한다.
   *
   *  - 429 / rate-limit → `LLM_RATE_LIMIT` (retryable)
   *  - 401 / 403 (auth) → `LLM_CALL_FAILED` (non-retryable — 재시도해도 동일 실패)
   *  - 5xx / network / timeout → `LLM_CALL_FAILED` (retryable — 일시 회복 가능)
   *  - 그 외 명시 code (예: `LLM_RESPONSE_INVALID`) → 보존, non-retryable
   *  - 분류 불가 → `LLM_CALL_FAILED` (보수적 non-retryable fallback — spec §10 은
   *    별도 `AI_*` fallback 코드를 두지 않고 LLM 단일 taxonomy 를 유지한다)
   *
   * client SSE 계층의 `LLM_CONNECTION_ERROR` (spec llm-client §6) 는 멀티턴
   * 경로에 도달하지 않으나, 누출 대비 network 로 매핑한다.
   */
  private static classifyLlmError(
    status: number | undefined,
    explicitCode: unknown,
    rawMessage: string,
  ): { code: string; retryable: boolean } {
    const lowerMsg = rawMessage.toLowerCase();
    const isAuth = status === 401 || status === 403;
    const is5xx = typeof status === 'number' && status >= 500 && status <= 599;
    const is429 =
      status === 429 ||
      explicitCode === 'LLM_RATE_LIMIT' ||
      lowerMsg.includes('429') ||
      lowerMsg.includes('rate limit');
    const isNetwork =
      explicitCode === 'LLM_CONNECTION_ERROR' ||
      (typeof explicitCode === 'string' &&
        AiTurnOrchestrator.NETWORK_ERRNO_PATTERN.test(explicitCode)) ||
      AiTurnOrchestrator.NETWORK_MESSAGE_PATTERN.test(rawMessage);

    if (is429) {
      return { code: 'LLM_RATE_LIMIT', retryable: true };
    }
    if (isAuth) {
      return { code: 'LLM_CALL_FAILED', retryable: false };
    }
    if (is5xx || isNetwork) {
      return { code: 'LLM_CALL_FAILED', retryable: true };
    }
    if (typeof explicitCode === 'string' && explicitCode.length > 0) {
      return { code: explicitCode, retryable: false };
    }
    // 분류 불가 fallback — spec §10 은 별도 AI_* 코드 없이 LLM_CALL_FAILED
    // (non-retryable) 로 통합한다. 재시도 안전성이 확인되지 않은 미상 throw.
    return { code: 'LLM_CALL_FAILED', retryable: false };
  }

  static extractAiTurnErrorPayload(err: unknown): {
    code: string;
    message: string;
    details?: unknown;
  } {
    // Error 가 아닌 throw (string / number / 비-Error 객체) 도 들어올 수 있어
    // typeof 로 안전하게 분기. `String({})` 가 `[object Object]` 가 되는 base
    // stringification 함정을 회피.
    let rawMessage: string;
    if (err instanceof Error) {
      rawMessage = err.message;
    } else if (typeof err === 'string') {
      rawMessage = err;
    } else if (err === null || err === undefined) {
      rawMessage = 'unknown error';
    } else if (
      typeof err === 'number' ||
      typeof err === 'boolean' ||
      typeof err === 'bigint'
    ) {
      rawMessage = String(err);
    } else {
      // Circular-reference or other non-serializable objects: fall back to a
      // safe placeholder rather than letting JSON.stringify throw and re-enter
      // the WAITING_FOR_INPUT regression path (req W_json).
      try {
        rawMessage = JSON.stringify(err);
      } catch {
        rawMessage = '[non-serializable error object]';
      }
    }
    const message = sanitizeLastErrorMessage(rawMessage);
    const explicitCode = (err as { code?: unknown } | null | undefined)?.code;
    const status = AiTurnOrchestrator.extractHttpStatus(err);

    // spec/4-nodes/3-ai/1-ai-agent.md §10 — HTTP status 기반 분류 (스펙이 SoT).
    // retryable 은 코드 문자열 집합이 아니라 status/조건으로 도출 (Principle 3.2.1).
    const { code, retryable } = AiTurnOrchestrator.classifyLlmError(
      status,
      explicitCode,
      rawMessage,
    );
    const rawDetails = (err as { details?: unknown } | null | undefined)
      ?.details;
    let baseDetails: Record<string, unknown> | undefined;
    if (rawDetails !== undefined) {
      // JSON.stringify → sanitize → JSON.parse chain: strips secret tokens from
      // nested details fields. Wrapped in try/catch because rawDetails may be
      // non-serializable (circular refs, BigInt, etc.) — req W_json.
      try {
        const parsed = JSON.parse(
          sanitizeLastErrorMessage(JSON.stringify(rawDetails)),
        ) as unknown;
        baseDetails =
          parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : { details: parsed };
      } catch {
        baseDetails = { details: '[serialization error]' };
      }
    }

    // Retry-After 헤더 → retryAfterSec. ms → s 정수 변환. invariant: retryable
    // === true 일 때만 set (Principle 3.2.1).
    let retryAfterSec: number | undefined;
    if (retryable) {
      const retryAfterMs = extractRetryAfterMs(err);
      if (retryAfterMs !== null && retryAfterMs > 0) {
        retryAfterSec = Math.ceil(retryAfterMs / 1000);
      }
    }

    const mergedDetails: Record<string, unknown> = {
      ...(baseDetails ?? {}),
      retryable,
      ...(retryAfterSec !== undefined ? { retryAfterSec } : {}),
    };

    return { code, message, details: mergedDetails };
  }

  /**
   * PR-H — conversation 종료 후 NodeExecution 을 COMPLETED 로 finalize
   * + Execution 을 RUNNING 으로 atomic 전이 (WARN #4) + 클라이언트 emit
   * (`NODE_COMPLETED` + `EXECUTION_RESUMED`).
   *
   * `_resumeState` 는 DB 저장 시 strip (WARN #6 — credential / 내부 state 노출 차단).
   *
   * 2026-05-19 — `finalStatus` 추가 (spec §7.9). `'FAILED'` 시 NodeExecution.
   * status=FAILED + Execution.status=FAILED + NODE_FAILED + EXECUTION_FAILED
   * 분기로 진입. 기본값 `'COMPLETED'` 는 기존 흐름 유지.
   */
  private async finalizeAiNode(
    savedExecution: Execution,
    executionId: string,
    node: Node,
    context: ExecutionContext,
    nodeExec: NodeExecution | null,
    finalStatus: 'COMPLETED' | 'FAILED' = 'COMPLETED',
    // W5 / WARNING #5 — boolean flag → opts 객체 파라미터 (Flag Parameter 안티패턴 해소).
    // retry 재진입(`applyRetryLastTurn`)에서 호출될 때만 `{ retryReentry: true }`.
    // COMPLETED 분기의 FAILED → RUNNING 전이를 state-machine opt-in 으로 허용한다.
    // 일반 multi-turn 완료(`waitForAiConversation`)는 opts 미전달 (WAITING/RUNNING → RUNNING).
    opts?: { retryReentry?: boolean },
  ): Promise<void> {
    const allowRetryReentry = opts?.retryReentry === true;
    const isFailed = finalStatus === 'FAILED';
    if (nodeExec) {
      nodeExec.status = isFailed
        ? NodeExecutionStatus.FAILED
        : NodeExecutionStatus.COMPLETED;
      // Persist the canonical structured cache. Terminal handler returns
      // (buildMultiTurnFinalOutput / buildConditionOutput / buildErrorOutput)
      // do not carry _resumeState, but defensively strip it in case a future
      // handler bug leaks it.
      //
      // `_retryState` (spec §1.3 / node-output §4.2.1) is the documented
      // preservation exception — only `_resumeState` is deleted here so a
      // retryable error termination keeps `_retryState` in outputData for the
      // later `execution.retry_last_turn` consume path.
      const finalAdapted = context.structuredOutputCache?.[node.id];
      const finalOutput = {
        ...((finalAdapted ??
          context.nodeOutputCache[node.id]) as unknown as Record<
          string,
          unknown
        >),
      };
      delete finalOutput._resumeState;
      nodeExec.outputData = finalOutput;
      nodeExec.finishedAt = new Date();
      nodeExec.durationMs =
        nodeExec.finishedAt.getTime() - nodeExec.startedAt.getTime();
      if (isFailed) {
        // spec/1-data-model.md §2.14 — NodeExecution.error 가 set 되면 상위
        // updateExecutionStatus(FAILED) 가 Execution.error 로 자동 복사한다.
        const errOutput = (finalOutput.output as Record<string, unknown>)
          ?.error as Record<string, unknown> | undefined;
        const errMessage =
          (typeof errOutput?.message === 'string'
            ? errOutput.message
            : undefined) ?? 'AI Agent turn failed';
        nodeExec.error = { message: errMessage };
      }
    }

    if (isFailed) {
      // 2026-05-19 — FAILED 분기에서 Execution.status 전이 + EXECUTION_FAILED
      // 발사는 `runExecution` top-level catch 에 위임한다. 이유:
      //  (1) main dispatch loop 가 conversation 종료 후 다음 노드 진입을 시도
      //      하다 state 전이 충돌 (failed→completed) 을 일으키는 회귀를 차단.
      //  (2) Execution.error 복사 (spec/1-data-model.md §2.14) 와 EXECUTION_
      //      FAILED 페이로드를 단일 진입점으로 모음.
      // 본 분기는 NodeExecution.status=FAILED 만 직접 save 하고 NODE_FAILED
      // 만 발사한 뒤 sentinel error 를 throw — caller (`waitForAiConversation`)
      // 도 그대로 propagate 해 `runExecution` catch 로 흐른다.
      if (nodeExec) {
        await this.nodeExecutionRepository.save(nodeExec);
        const errOutput = nodeExec.outputData?.output as
          | Record<string, unknown>
          | undefined;
        const errFromOutput = errOutput?.error as
          | Record<string, unknown>
          | undefined;
        const fromOutputMessage =
          typeof errFromOutput?.message === 'string'
            ? errFromOutput.message
            : undefined;
        const fromExecError =
          typeof nodeExec.error?.message === 'string'
            ? nodeExec.error.message
            : undefined;
        const errorMessage: string =
          fromOutputMessage ?? fromExecError ?? 'AI Agent turn failed';
        // spec/5-system/6-websocket-protocol.md §3 — `execution.node.failed`
        // 단일 발사. AI_MESSAGE 양발사 안 함 (정상 응답 전용 채널).
        await this.eventEmitter.emitNode(
          executionId,
          node.id,
          NodeEventType.NODE_FAILED,
          {
            nodeExecutionId: nodeExec.id,
            parentNodeExecutionId: context.parentNodeExecutionId,
            status: NodeExecutionStatus.FAILED,
            error: errorMessage,
            duration: nodeExec.durationMs,
            nodeType: node.type,
            nodeLabel: node.label ?? node.type,
            output: nodeExec.outputData,
            input: nodeExec.inputData,
            interactionData: nodeExec.interactionData,
            startedAt: nodeExec.startedAt?.toISOString?.(),
            finishedAt: nodeExec.finishedAt?.toISOString?.(),
          },
        );
        throw new Error(errorMessage);
      }
      // req W_null — nodeExec 가 null 이면 NODE_FAILED 이벤트는 발사하지 못하지만
      // EXECUTION_FAILED 는 sentinel throw → runExecution catch 에서 발사된다.
      // 운영 로그로 탐지 가능하도록 warn 기록.
      this.logger.warn(
        `finalizeAiNode FAILED: nodeExec is null for executionId=${executionId} ` +
          `nodeId=${node.id} — NODE_FAILED event skipped, sentinel throw propagates`,
      );
      throw new Error('AI Agent turn failed');
    }

    // Atomic: NodeExecution COMPLETED + Execution RUNNING (WARN #4)
    // W5 — retry 재진입 경로일 때만 FAILED → RUNNING opt-in 을 전달.
    // Phase B (PR-B2, exec-park D4) — turn-park 재개 경로(`driveResumeAwaited` →
    // `processAiResumeTurn`)는 진입 시 이미 Execution 을 RUNNING 으로 전이했으므로,
    // 대화 종료 turn 에서 finalize 시 RUNNING→RUNNING(assertTransition 금지)을 피한다:
    // 이미 RUNNING 이면 상태 전이를 건너뛰고 NodeExecution 만 COMPLETED 영속한다
    // (활성 시간 누적은 driveResumeAwaited 의 RUNNING 진입 시 이미 시작됐고, 다음
    // 그래프 종결/park 에서 닫힌다). 옛 loop 경로(Execution=WAITING_FOR_INPUT 으로
    // finalize 도달)는 정상 WAITING→RUNNING 전이를 그대로 탄다.
    if (savedExecution.status === ExecutionStatus.RUNNING) {
      if (nodeExec) {
        await this.nodeExecutionRepository.save(nodeExec);
      }
    } else {
      await this.driver.updateExecutionStatus(
        savedExecution,
        ExecutionStatus.RUNNING,
        nodeExec ?? undefined,
        allowRetryReentry ? { allowRetryReentry: true } : undefined,
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
          interactionData: nodeExec.interactionData,
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
