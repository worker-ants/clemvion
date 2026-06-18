import { Inject, Injectable } from '@nestjs/common';
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
  NodeHandlerOutput,
} from '../../nodes/core/node-handler.interface';
import { ExecutionContextService } from './context/execution-context.service';
import { ConversationThreadService } from './conversation-thread/conversation-thread.service';
import { ExecutionEventEmitter } from './events/execution-event-emitter.service';
import {
  ExecutionEventType,
  NodeEventType,
} from '../websocket/websocket.service';
import { cloneThread } from '../../shared/conversation-thread/thread-renderer';
import {
  PARK_RELEASED,
  type ProcessTurnResult,
} from '../../shared/execution-resume/process-turn-result';
import { withInteractionMeta } from './ai-conversation-helpers';
import { ButtonConfig } from '../../nodes/presentation/_shared/button.types';
import type { GraphEdge } from './graph/graph-builder';
import { ENGINE_DRIVER, type EngineDriver } from './engine-driver.interface';

/**
 * 버튼 클릭 재개 payload 의 판별유니온 (continuation-bus 가 publish 하는 wire-shape).
 *
 * 코드가 **실제로 읽는 필드만** 반영한다 (`type` 판별 + `button_click` 변형의
 * `buttonId`). 옛 캐스팅 `payload as { type; buttonId?; action? }` 의 `action?` 는
 * 어디서도 읽히지 않으므로 의도적으로 제외한다. fallback 변형(그 외 type)은
 * `buttonId` 를 읽지 않으므로 필드를 두지 않는다.
 */
export type ButtonClickPayload =
  | { type: 'button_click'; buttonId?: string }
  | { type: string };

/**
 * 런타임 narrowing — payload 가 `button_click` 변형인지 판별한다. 가드가 false 면
 * 기존 fallback(`type !== 'button_click'` → continue) 경로를 그대로 탄다 (동작 불변).
 */
export function isButtonClickPayload(
  payload: ButtonClickPayload,
): payload is { type: 'button_click'; buttonId?: string } {
  return payload.type === 'button_click';
}

/**
 * {@link resolveButtonInteraction} 가 산출하는 순수 결정 결과. I/O 는 일절 포함하지
 * 않으며, {@link ButtonInteractionService.processButtonResumeTurn} 이 이 값으로
 * (기존과 동일한 순서의) context/DB/emit 부수효과를 수행한다.
 *
 * `updatedStructured`(structured NodeHandlerOutput)는 의도적으로 **여기 없다**:
 * 원본 메서드가 그것을 `setNodeOutput()` **이후**의 `structuredOutputCache[nodeId]`
 * (= setNodeOutput 이 `updatedOutput` 으로 재파생한 view) 로부터 구성하므로,
 * read-timing 이 동작의 일부다. 따라서 structured 구성은 메서드에 잔류하되 순수
 * 헬퍼 {@link buildResumedStructuredOutput} 로 분리했다.
 */
export interface ButtonInteractionResolution {
  /** 라우팅 포트 (`continue` 또는 base def port). */
  selectedPort: string;
  /** NodeExecution.interactionData 에 실리는 legacy wire-shape. */
  interactionData: Record<string, unknown>;
  /** flat nodeOutput cache 에 set 되는 `_selectedPort` 동봉 결과. */
  updatedOutput: Record<string, unknown>;
  /** ConversationThread / structured cache 의 통합 `{type,data,receivedAt}` 형태. */
  structuredInteraction: StructuredInteraction;
}

/** 통합 상호작용 형태 (CONVENTIONS §4.5 — `$node["X"].output.interaction.*`). */
export interface StructuredInteraction {
  type:
    | 'form_submitted'
    | 'button_click'
    | 'button_continue'
    | 'message_received';
  data: Record<string, unknown>;
  receivedAt: string;
}

/**
 * **순수함수** — 버튼 클릭 재개의 결정 로직 (payload 분석 → port 선택 → flat
 * `updatedOutput` / `interactionData` / `structuredInteraction` 구성).
 * driver/repository/eventEmitter/contextService 등 I/O 의존성은 받지 않으며,
 * 호출자({@link ButtonInteractionService.processButtonResumeTurn})가 그 지점까지
 * 확보한 순수 값만 입력으로 받는다. 부수효과 없음 — 결과({@link
 * ButtonInteractionResolution})만 반환.
 *
 * 4개 분기를 보존한다:
 *  (a) `button_click` port 버튼 — `_selectedPort=buttonId` (item-level 은
 *      `buttonId.split('__item_')[0]` 로 base def port).
 *  (b) `button_click` link 버튼 — `_selectedPort='continue'` + `button_continue`
 *      상호작용 (`url?`/`selectedItem?` 조건부 동봉).
 *  (c) item-level — `buttonItemMap → outputItems → selectedItem` 해석.
 *  (d) fallback — `type !== 'button_click'` → `continue`.
 *
 * 에러 throw 보존: 알 수 없는 buttonId 면 `INVALID_BUTTON_ID`.
 *
 * @param payload      버튼 클릭 payload (판별유니온).
 * @param buttons      `buttonConfig.buttons` 배열.
 * @param buttonItemMap item-level 버튼 id → item index 매핑 (없으면 undefined).
 * @param outputItems  item-level 해석용 items 배열 (없으면 undefined).
 * @param cleanNodeOutput 내부 필드(status/interactionType) 제거된 flat nodeOutput.
 * @param now          클릭 시각 ISO8601 문자열 (호출자가 1회 산출해 전달 — 결정성).
 */
export function resolveButtonInteraction(
  payload: ButtonClickPayload,
  buttons: ButtonConfig['buttons'],
  buttonItemMap: ButtonConfig['buttonItemMap'],
  outputItems: unknown[] | undefined,
  cleanNodeOutput: Record<string, unknown>,
  now: string,
): ButtonInteractionResolution {
  let selectedPort: string;
  let interactionData: Record<string, unknown>;
  let updatedOutput: Record<string, unknown>;

  // `interactionData` carries the legacy wire-shape (interactionType +
  // flat fields) used by the WS button event. `structuredInteraction`
  // carries the unified `{type, data, receivedAt}` shape exposed through
  // `$node["X"].output.interaction.*` (CONVENTIONS §4.5).
  let structuredInteraction: StructuredInteraction;

  if (isButtonClickPayload(payload)) {
    const buttonId = payload.buttonId!;
    const clickedButton = buttons.find((b) => b.id === buttonId);

    if (!clickedButton) {
      throw new Error(`INVALID_BUTTON_ID: Button ${buttonId} not found`);
    }

    // Determine selected item for item-level buttons
    const itemIndex =
      buttonItemMap != null ? buttonItemMap[buttonId] : undefined;
    const selectedItem =
      itemIndex != null && outputItems ? outputItems[itemIndex] : undefined;

    if (clickedButton.type === 'port') {
      // Dynamic item buttons have IDs like "{defId}__item_{idx}".
      // Route to the base definition port so editor edges match.
      selectedPort = buttonId.includes('__item_')
        ? buttonId.split('__item_')[0]
        : buttonId;
      interactionData = {
        interactionType: 'button_click',
        buttonId,
        buttonLabel: clickedButton.label,
        clickedAt: now,
      };
      structuredInteraction = {
        type: 'button_click',
        data: {
          buttonId,
          buttonLabel: clickedButton.label,
          ...(selectedItem !== undefined && { selectedItem }),
        },
        receivedAt: now,
      };
      updatedOutput = {
        type: 'button_click',
        buttonId,
        buttonLabel: clickedButton.label,
        clickedAt: now,
        ...(selectedItem !== undefined && { selectedItem }),
        nodeOutput: cleanNodeOutput,
        _selectedPort: selectedPort,
      };
    } else {
      // __continue__ for link-only "Continue" click
      selectedPort = 'continue';
      interactionData = {
        interactionType: 'button_continue',
        clickedAt: now,
      };
      structuredInteraction = {
        type: 'button_continue',
        data: {
          buttonId,
          buttonLabel: clickedButton.label,
          ...(clickedButton.url ? { url: clickedButton.url } : {}),
          ...(selectedItem !== undefined && { selectedItem }),
        },
        receivedAt: now,
      };
      updatedOutput = {
        type: 'button_continue',
        clickedAt: now,
        ...(selectedItem !== undefined && { selectedItem }),
        nodeOutput: cleanNodeOutput,
        _selectedPort: selectedPort,
      };
    }
  } else {
    // Fallback: treat as continue
    selectedPort = 'continue';
    interactionData = {
      interactionType: 'button_continue',
      clickedAt: now,
    };
    structuredInteraction = {
      type: 'button_continue',
      data: {},
      receivedAt: now,
    };
    updatedOutput = {
      type: 'button_continue',
      clickedAt: now,
      nodeOutput: cleanNodeOutput,
      _selectedPort: selectedPort,
    };
  }

  return {
    selectedPort,
    interactionData,
    updatedOutput,
    structuredInteraction,
  };
}

/**
 * **순수함수** — 재개 tick 의 structured NodeHandlerOutput 을 구성한다. 직전
 * structured view (`prevStructured`)·통합 상호작용·선택 포트로부터 파생하며
 * 부수효과 없음. 원본 메서드는 이것을 `setNodeOutput()` **이후**의
 * `structuredOutputCache[nodeId]` 로부터 구성했으므로, 호출자는 반드시 그
 * 시점(= setNodeOutput 호출 후)의 view 를 `prevStructured` 로 넘겨 read-timing
 * 동작을 보존한다.
 *
 * @param prevStructured `setNodeOutput()` 직후의 structured view (config/meta/output
 *   보존 원천).
 * @param structuredInteraction `output.interaction` 에 append 될 통합 형태.
 * @param selectedPort 결정된 포트 (`NodeHandlerOutput.port`).
 * @param cleanNodeOutput `prevStructured?.output` 부재 시 fallback.
 */
export function buildResumedStructuredOutput(
  prevStructured: NodeHandlerOutput | undefined,
  structuredInteraction: StructuredInteraction,
  selectedPort: string,
  cleanNodeOutput: Record<string, unknown>,
): NodeHandlerOutput {
  // Mirror the interaction result into the structured NodeHandlerOutput
  // cache so `$node["<label>"].output.interaction.buttonId` and
  // `.output.selectedItem` resolve predictably. `setNodeOutput` (called by
  // the caller before this helper) already derived a legacy structured view;
  // we overwrite it with a richer shape that preserves the handler's original
  // `config`/`meta`.
  const prevConfig = prevStructured?.config ?? {};
  const prevMeta = prevStructured?.meta;
  const rawPrevOutput = prevStructured?.output ?? cleanNodeOutput;
  // Strip any nested `previousOutput` so repeated resume cycles (loops,
  // retries) don't produce `previousOutput.previousOutput.…` chains that
  // grow unbounded in memory and DB rows.
  const prevOutput =
    rawPrevOutput &&
    typeof rawPrevOutput === 'object' &&
    !Array.isArray(rawPrevOutput)
      ? Object.fromEntries(
          Object.entries(rawPrevOutput as Record<string, unknown>).filter(
            ([key]) => key !== 'previousOutput',
          ),
        )
      : rawPrevOutput;
  // Structured output at the resumed tick: previous runtime fields are
  // retained (per CONVENTIONS §4.4 — "immutable snapshot") and
  // `output.interaction` is appended with the unified `{type, data,
  // receivedAt}` shape.
  //
  // `previousOutput` is a legacy transitional field (CONVENTIONS §4.2
  // explicitly marks it for retirement). Do NOT add new consumers — use
  // the top-level runtime fields directly. Removal is tracked as a
  // Phase 3 precondition in `memory/node-specs-improvement-progress.md`.
  const structuredOutputPayload: Record<string, unknown> = {
    ...(prevOutput as Record<string, unknown>),
    interaction: structuredInteraction,
    previousOutput: prevOutput,
  };
  return {
    config: prevConfig,
    output: structuredOutputPayload,
    port: selectedPort,
    status: 'resumed',
    ...(prevMeta !== undefined ? { meta: prevMeta } : {}),
  };
}

/**
 * C-1 step3 (strangler-fig) — Button(Presentation) blocking-interaction
 * 생명주기를 god-class `ExecutionEngineService` 에서 추출한 전담 서비스.
 *
 * **책임**: 버튼 보유 Presentation 노드 park(`waitForButtonInteraction`) + §7.5
 * rehydration 의 버튼 클릭 직접 처리(`processButtonResumeTurn` — port 선택·
 * output 갱신·thread append). 엔진 잔류 상태/라이프사이클 메서드는 `EngineDriver`
 * (token `ENGINE_DRIVER`, `useExisting: ExecutionEngineService`) 경유로 호출한다
 * (PR2 `AiTurnOrchestrator` 선례와 동일 패턴). 메서드 본문은 추출 전과 **완전히
 * 동일**하게 보존됐고, `this.<engine-stays>` 호출만 `this.driver.<…>` 로
 * 재배선됐다.
 *
 * 엔진의 dispatch-loop park 진입(top-level/중첩 executeInline)과 resume
 * registry 의 `buttons` 항목은 본 서비스로 위임한다. continuation-bus PUBLISHER
 * (`continueButtonClick`)는 PR2 가 `continueAiConversation` 을 엔진에 남긴 것과
 * 동일하게 엔진에 잔류한다.
 */
@Injectable()
export class ButtonInteractionService {
  constructor(
    private readonly contextService: ExecutionContextService,
    private readonly conversationThreadService: ConversationThreadService,
    private readonly eventEmitter: ExecutionEventEmitter,
    @InjectRepository(NodeExecution)
    private readonly nodeExecutionRepository: Repository<NodeExecution>,
    @Inject(ENGINE_DRIVER)
    private readonly driver: EngineDriver,
  ) {}

  /**
   * Park execution at a Presentation node with buttons (waiting_for_input) —
   * durable 영속 후 즉시 `PARK_RELEASED` 반환(코루틴 해제; top-level + 중첩
   * executeInline 공통, exec-park D6 full B3). 버튼 클릭 재개는 §7.5 rehydration 의
   * 직접 처리기 {@link processButtonResumeTurn} 가 payload 로 _selectedPort 라우팅·
   * output 갱신을 수행한다. (`_graphEdges` 는 호출자 시그니처 호환용 — 미사용.)
   */
  async waitForButtonInteraction(
    savedExecution: Execution,
    executionId: string,
    node: Node,
    context: ExecutionContext,
    _graphEdges: GraphEdge[],
  ): Promise<ProcessTurnResult> {
    // Resolve buttonConfig up front so we can persist it on the node execution
    // before releasing control to the user. This means the REST polling
    // reconciler (which reads `nodeExecution.outputData` every 2s) sees the
    // same structured shape the WebSocket delivers — otherwise polling would
    // overwrite the WS-delivered outputData with `null`, making buttons
    // disappear until NODE_COMPLETED fires on the next event.
    const flatNodeOutput = context.nodeOutputCache[node.id] as Record<
      string,
      unknown
    >;
    const structured = context.structuredOutputCache?.[node.id];
    const structuredConfig = structured?.config;
    const buttonConfig = (structuredConfig?.buttonConfig ??
      flatNodeOutput.buttonConfig) as ButtonConfig | undefined;
    if (!buttonConfig || !Array.isArray(buttonConfig.buttons)) {
      throw new Error(
        `MISSING_BUTTON_CONFIG: Node ${node.id} entered waitForButtonInteraction without a buttonConfig`,
      );
    }
    const buttons = buttonConfig.buttons;
    // Prefer the structured NodeHandlerOutput so the frontend receives
    // `config.buttonConfig` (required by presentation renderers) in the first
    // render pass. Legacy (non-migrated) handlers still fall back to the flat
    // cache.
    const nodeOutputForEvent: unknown = structured ?? flatNodeOutput;

    // Update the node execution to waiting_for_input AND persist the output
    // shape so REST polling reconciliation stays consistent with WS.
    const nodeExec = await this.nodeExecutionRepository.findOne({
      where: { executionId, nodeId: node.id },
      order: { startedAt: 'DESC' },
    });
    if (nodeExec) {
      nodeExec.status = NodeExecutionStatus.WAITING_FOR_INPUT;
      // meta.interactionType='buttons' 명시 — snapshot reconcile 이 store 의
      // waitingInteractionType 을 'buttons' 로 hydrate 해 Preview 탭 버튼이
      // 콜백을 받아 interactive 가 되도록 한다.
      nodeExec.outputData = withInteractionMeta(
        nodeOutputForEvent as Record<string, unknown>,
        'buttons',
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

    // Emit waiting event so frontend can render buttons
    await this.eventEmitter.emitExecution(
      executionId,
      ExecutionEventType.EXECUTION_WAITING_FOR_INPUT,
      {
        status: ExecutionStatus.WAITING_FOR_INPUT,
        waitingNodeId: node.id,
        waitingNodeType: node.type,
        waitingNodeLabel: node.label ?? node.type,
        // Surface the DB row id so the frontend's addNodeResult can match
        // the same timeline entry created by NODE_STARTED, preventing a
        // phantom duplicate row when execution resumes.
        nodeExecutionId: nodeExec?.id,
        // 워크플로 첫 노드는 사용자 "Run" 직후 도달해 ws subscribe 완료 전
        // NODE_STARTED 를 놓칠 race window 가 있다. 그 경우에도 store row 의
        // startedAt 이 채워지도록 항상 동봉 — selectSortedNodeResults 이 startedAt
        // 미정 row 를 timeline 마지막으로 보내는 것을 방지.
        startedAt: nodeExec?.startedAt?.toISOString?.(),
        interactionType: 'buttons',
        // Live thread snapshot for UI (button waiting tick).
        conversationThread: cloneThread(context.conversationThread),
        buttonConfig: {
          buttons,
          nodeOutput: nodeOutputForEvent,
        },
      },
    );

    // park = 세그먼트 종료 — durable 영속 후 즉시 PARK_RELEASED 반환(코루틴 해제,
    // top-level / 중첩 executeInline 공통 — exec-park D6 full B3). 재개(버튼 클릭)는
    // §7.5 rehydration 의 직접 처리기 {@link processButtonResumeTurn} 가 payload 로
    // 수행한다 — 옛 in-memory pendingContinuations + firePayload 경로는 제거됐다.
    return PARK_RELEASED;
  }

  /**
   * §7.5 rehydration — 버튼 클릭 payload 로 waiting Button 노드를 직접 완료 처리한다
   * (exec-park D6 full B3). `driveResumeAwaited`(top-level) / `driveResumeFrame`
   * (중첩 innermost) 가 호출. 옛 `waitForButtonInteraction('await')` +
   * pendingContinuations + firePayload 경로 대체 — buttonConfig/buttons/output 을
   * context 에서 재계산하고 port 선택·structured/flat output·thread append·
   * NodeExecution COMPLETED + RUNNING 전이·NODE_COMPLETED/EXECUTION_RESUMED emit.
   */
  async processButtonResumeTurn(
    savedExecution: Execution,
    executionId: string,
    node: Node,
    context: ExecutionContext,
    payload: unknown,
  ): Promise<void> {
    const flatNodeOutput = context.nodeOutputCache[node.id] as Record<
      string,
      unknown
    >;
    const structured = context.structuredOutputCache?.[node.id];
    const structuredConfig = structured?.config;
    const buttonConfig = (structuredConfig?.buttonConfig ??
      flatNodeOutput?.buttonConfig) as ButtonConfig | undefined;
    if (!buttonConfig || !Array.isArray(buttonConfig.buttons)) {
      throw new Error(
        `MISSING_BUTTON_CONFIG: Node ${node.id} resume without a buttonConfig`,
      );
    }
    const buttons = buttonConfig.buttons;
    const nodeExec = await this.nodeExecutionRepository.findOne({
      where: { executionId, nodeId: node.id },
      order: { startedAt: 'DESC' },
    });

    // Process the interaction result — pure decision logic is extracted into
    // the module-level {@link resolveButtonInteraction}. Only the pure inputs
    // the method has resolved so far are passed; no I/O dependency leaks in.
    const now = new Date().toISOString();

    // Strip internal fields from nodeOutput for downstream consumption
    // Keep buttonConfig so the execution detail page can render all buttons
    const cleanNodeOutput = { ...flatNodeOutput };
    delete cleanNodeOutput.status;
    delete cleanNodeOutput.interactionType;

    // Resolve selected item for item-level buttons (e.g. carousel per-item buttons)
    const buttonItemMap = buttonConfig.buttonItemMap;
    const structuredOutputObj = structured?.output as
      | Record<string, unknown>
      | undefined;
    const outputItems = (structuredOutputObj?.items ??
      flatNodeOutput.items ??
      cleanNodeOutput.items) as unknown[] | undefined;

    const {
      selectedPort,
      interactionData,
      updatedOutput,
      structuredInteraction,
    } = resolveButtonInteraction(
      payload as ButtonClickPayload,
      buttons,
      buttonItemMap,
      outputItems,
      cleanNodeOutput,
      now,
    );

    // Update node output cache with port selection. The flat-shape
    // `updatedOutput` carries `_selectedPort` so existing routing logic
    // (applyPortSelection / hasPortMismatch / stripControlFields) keeps
    // operating without changes.
    this.contextService.setNodeOutput(
      this.driver.contextKeyOf(context),
      node.id,
      updatedOutput,
    );

    // `setNodeOutput` above re-derived `structuredOutputCache[node.id]` from
    // the flat `updatedOutput`; read it back (post-write) so the structured
    // shape is built from the exact same value the pre-refactor method used
    // (read-timing is part of the behavior — see buildResumedStructuredOutput).
    const prevStructured = context.structuredOutputCache?.[node.id];
    const updatedStructured = buildResumedStructuredOutput(
      prevStructured,
      structuredInteraction,
      selectedPort,
      cleanNodeOutput,
    );
    this.contextService.setStructuredOutput(
      this.driver.contextKeyOf(context),
      node.id,
      updatedStructured,
    );
    // Append the button interaction to the ConversationThread so downstream
    // AI Agent nodes with `contextScope` can auto-inject it (single mutation
    // entrypoint per spec/conventions/conversation-thread.md §2.1).
    this.conversationThreadService.appendPresentationInteraction(context, {
      node: {
        id: node.id,
        label: node.label,
        type: node.type,
        config: node.config,
      },
      interaction: structuredInteraction,
    });

    // Update node execution to completed with interaction data
    if (nodeExec) {
      nodeExec.status = NodeExecutionStatus.COMPLETED;
      nodeExec.outputData = updatedStructured as unknown as Record<
        string,
        unknown
      >;
      nodeExec.interactionData = interactionData;
      nodeExec.finishedAt = new Date();
      nodeExec.durationMs =
        nodeExec.finishedAt.getTime() - nodeExec.startedAt.getTime();
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
