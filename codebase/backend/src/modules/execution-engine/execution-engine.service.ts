import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../node-executions/entities/node-execution.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import { Edge } from '../edges/entities/edge.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { ExecutionNodeLog } from './entities/execution-node-log.entity';
import {
  WorkflowNotFoundError,
  SubWorkflowTimeoutError,
} from './workflow-errors';
import {
  ContinuationBusService,
  ContinuationMessage,
  RECOVERY_LOCK_KEY,
} from './continuation/continuation-bus.service';
import { ConversationThreadService } from './conversation-thread/conversation-thread.service';
import { createEmptyConversationThread } from '../../shared/conversation-thread/conversation-thread.types';
import { cloneThread } from '../../shared/conversation-thread/thread-renderer';
import { buildGraph, GraphEdge } from './graph/graph-builder';
import { topologicalSort } from './graph/topological-sort';
import { identifyBackEdges } from './graph/back-edge-identifier';
import { ForEachExecutor } from './containers/foreach-executor';
import { LoopExecutor } from './containers/loop-executor';
import {
  ParallelExecutor,
  ParallelErrorPolicy,
} from './containers/parallel-executor';
import { assertTransition } from './state/state-machine';
import { NodeHandlerRegistry } from '../../nodes/core/node-handler.registry';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';
import { ALL_NODE_COMPONENTS } from '../../nodes';
import { ExecutionContextService } from './context/execution-context.service';
import {
  ErrorPolicyHandler,
  ErrorPolicyConfig,
} from './error/error-policy.handler';
import { ExpressionResolverService } from './expression/expression-resolver.service';
import { evaluate } from '@workflow/expression-engine';
import {
  coerceContainerBoolean,
  coerceContainerNumber,
  coerceContainerNumberOptional,
  coerceErrorPolicy,
} from './utils/coerce-container-param';
import { extractBackgroundRunId } from './utils/extract-background-run-id';
import {
  ExecutionContext,
  isResumableNodeHandler,
  NodeHandler,
  NodeHandlerOutput,
} from '../../nodes/core/node-handler.interface';
import { NODE_TYPES } from '../../nodes/core/node-types.constants';
import {
  ExecutionEventType,
  NodeEventType,
} from '../websocket/websocket.service';
import { ExecutionEventEmitter } from './events/execution-event-emitter.service';
import { GraphTraversalService } from './graph/graph-traversal.service';
import { NodeHandlerDependenciesProvider } from './handlers/node-handler-dependencies.provider';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { LlmService } from '../llm/llm.service';
import {
  AI_LLM_PROVIDER_NODE_TYPES,
  AI_NO_LLM_PROVIDER_MESSAGE,
} from '../../nodes/ai/llm-provider-rule';
import {
  BACKGROUND_EXECUTION_QUEUE,
  BackgroundExecutionJob,
} from './queues/background-execution.queue';
import {
  adaptHandlerReturn,
  toEngineFlatShape,
} from './handler-output.adapter';
import { ButtonConfig } from '../../nodes/presentation/_shared/button.types';
import {
  WorkflowExecutor,
  SubWorkflowOptions,
  SubWorkflowResult,
  InlineExecutionOptions,
} from '../../nodes/core/workflow-executor.interface';

interface ContainerBodyPlan {
  childIds: Set<string>;
  bodyEntryNodeIds: Set<string>;
  emitSourceNodeId: string;
  internalEdges: GraphEdge[];
  sortedNodeIds: string[];
  outgoingEdgeMap: Map<string, GraphEdge[]>;
  // INFO #6 — `executeContainerBody` 가 매 iteration 마다 `new Map(allNodes)`
  // 를 재생성하던 비용을 plan 단위로 1회 캐시한다 (ForEach 1,000 아이템 시
  // 1,000회 → 1회).
  nodeMap: Map<string, Node>;
}

/**
 * Bounds for Parallel node config fields. `branchCount` is min 2 (single-
 * branch Parallel makes no sense) and max 16 (sane upper bound on
 * concurrent branch fan-out). `maxConcurrency` allows 0 as "unbounded
 * within branchCount" (the executor maps 0 → branchCount internally).
 */
const PARALLEL_BRANCH_COUNT_MIN = 2;
const PARALLEL_BRANCH_COUNT_MAX = 16;
const PARALLEL_MAX_CONCURRENCY_MIN = 0;
const PARALLEL_MAX_CONCURRENCY_MAX = 16;

type WaitingInteractionType = 'form' | 'buttons' | 'ai_conversation';

/**
 * NodeExecution.outputData (envelope `{config, output, meta?, port?, status?}`)
 * 의 `meta.interactionType` 을 명시 보장. 페이지 재마운트 시
 * `execution.snapshot` reconcile (frontend) 이 이 필드로 store 의
 * `waitingInteractionType` 을 set 해 form/buttons/ai_conversation 분기를
 * 정확히 hydrate 한다. 누락 시 카테고리 선택 (Carousel) 의 Preview 탭
 * 버튼이 callback 없이 disabled 로 그려지는 회귀가 발생.
 */
function withInteractionMeta(
  output: Record<string, unknown>,
  interactionType: WaitingInteractionType,
): Record<string, unknown> {
  const next = { ...output };
  const prevMeta = (next.meta as Record<string, unknown> | undefined) ?? {};
  next.meta = { ...prevMeta, interactionType };
  return next;
}

/**
 * Per-branch subgraph plan for the Parallel logic node.
 *
 * `bodyNodeIds` — nodes exclusive to this branch (reachable from this
 *   `branch_N` target but not from any other `branch_M`). Shared downstream
 *   nodes (typical Merge join points) live in {@link ParallelPlan.joinNodeIds}.
 * `sortedNodeIds` — forward-edge topological order of `bodyNodeIds`.
 * `entryNodeIds` — direct targets of `branch_N` edges; seed the reachability
 *   set for the sequential body traversal.
 * `exitNodeIds` — body nodes that have at least one outgoing edge to a node
 *   outside the body (join nodes or unrelated downstream). After the branch
 *   completes, propagation from these nodes re-activates the main loop's
 *   `reachable` set.
 */
interface ParallelBranchPlan {
  branchIndex: number;
  branchPort: string;
  bodyNodeIds: Set<string>;
  sortedNodeIds: string[];
  entryNodeIds: Set<string>;
  exitNodeIds: Set<string>;
  internalEdges: GraphEdge[];
  outgoingEdgeMap: Map<string, GraphEdge[]>;
}

interface ParallelPlan {
  branches: ParallelBranchPlan[];
  joinNodeIds: Set<string>;
  allBodyNodeIds: Set<string>;
}

class ExecutionCancelledError extends Error {
  constructor() {
    super('Execution cancelled while waiting for input');
    this.name = 'ExecutionCancelledError';
  }
}

/**
 * Conversation 노드가 진행 중일 때 frontend run-results UI 의 References /
 * LLM Usage / Meta 탭이 동작하도록 _resumeState 의 누적 통계와 turn 단위 RAG
 * delta 를 `meta.*` 로 펼쳐 노출한다. _resumeState 자체는 system prompt /
 * llmConfigId 등 internal 필드를 포함하므로 client 에 그대로 보내지 않는다.
 *
 * 첫 waiting (사용자 첫 메시지 전) 에서는 turnCount=0 이고 turnDebugHistory
 * 도 없으므로 turnDebug=[] / ragSources=[] 로 채워져 References 탭은 자동
 * 숨김 (`hasReferences=false`).
 *
 * @internal — 테스트 보조용으로 공개. 외부 모듈에서 직접 import 하지 않는다.
 */
export function buildConversationMetaFromResumeState(
  state: Record<string, unknown>,
): Record<string, unknown> {
  const inputTokens = (state.totalInputTokens as number) ?? 0;
  const outputTokens = (state.totalOutputTokens as number) ?? 0;
  return {
    interactionType: 'ai_conversation',
    model: state.model,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    thinkingTokens: (state.totalThinkingTokens as number) ?? 0,
    toolCalls: (state.toolCalls as number) ?? 0,
    ragSources: (state.ragSources as unknown[]) ?? [],
    ragDiagnostics: state.ragLastDiagnostics,
    turnDebug: (state.turnDebugHistory as unknown[]) ?? [],
  };
}

/**
 * Single LLM call trace (request / response / latency) — one entry per call
 * inside a turn. A turn produces multiple entries when tool loops occur.
 * Mirrors `LlmCallTrace` defined in the AI handlers.
 */
interface LlmCallRecord {
  requestPayload?: unknown;
  responsePayload?: unknown;
  durationMs?: number;
}

/** One entry of `state.turnDebugHistory`. `totalDurationMs` is the wall-clock
 * sum across all LLM calls + tool calls in the turn; `durationMs` on each
 * `llmCalls[]` item is the per-call latency. */
interface TurnDebugEntry {
  turnIndex: number;
  llmCalls?: LlmCallRecord[];
  totalDurationMs?: number;
}

/**
 * Extract per-turn LLM debug payload from the last entry of
 * `state.turnDebugHistory`, for the `execution.ai_message` WebSocket event.
 * Both the waiting_for_input emit and the terminal emit use this so the two
 * branches stay in lockstep — the frontend's debug timeline (Response /
 * Request / LLM Usage tabs) can match assistant messages to their LLM calls
 * regardless of whether the conversation is still in flight.
 *
 * Field mapping:
 *  - `lastTurn.llmCalls` → `llmCalls` (shallow-copied so later turns mutating
 *    the resumeState array can't retroactively change a buffered emit)
 *  - `lastTurn.totalDurationMs` → top-level `durationMs` (turn total)
 *
 * Returns an object with optional fields so callers can spread it into
 * the event payload without emitting `llmCalls: undefined` keys when no
 * turns have run yet.
 *
 * @internal — 테스트 보조용으로 공개. 외부 모듈에서 직접 import 하지 않는다.
 */
export function buildAiMessageDebugFromResumeState(
  state: Record<string, unknown>,
): { llmCalls?: LlmCallRecord[]; durationMs?: number } {
  const turnDebugArray = Array.isArray(state.turnDebugHistory)
    ? (state.turnDebugHistory as TurnDebugEntry[])
    : [];
  const lastTurnDebug =
    turnDebugArray.length > 0
      ? turnDebugArray[turnDebugArray.length - 1]
      : undefined;
  const result: { llmCalls?: LlmCallRecord[]; durationMs?: number } = {};
  // Array.isArray rejects null / undefined / non-array values so `llmCalls:
  // null` in resumeState (defensive against legacy state shapes) doesn't
  // leak into the payload as a non-array value.
  if (Array.isArray(lastTurnDebug?.llmCalls)) {
    result.llmCalls = [...lastTurnDebug.llmCalls];
  }
  if (typeof lastTurnDebug?.totalDurationMs === 'number') {
    result.durationMs = lastTurnDebug.totalDurationMs;
  }
  return result;
}

/**
 * Backfill `source: 'live'` on any non-system message that lacks the marker.
 * The handler's `messages.push` sites leave `source` undefined so the
 * 'live' default applies here in one place; injection results from
 * `mapTurnsToChatMessages` already set `'injected'` and are preserved.
 * System messages are skipped — they're filtered out before reaching the
 * emit payload anyway, but the explicit guard makes the function safe to
 * call regardless of filter ordering.
 * Spec: spec/5-system/6-websocket-protocol.md §4.4.6.
 */
function withSourceMarker(
  messages: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return messages.map((m) => {
    if (m.role === 'system') return m;
    return m.source === 'injected' || m.source === 'live'
      ? m
      : { ...m, source: 'live' as const };
  });
}

/**
 * Build the WS-event `conversationConfig` block from a NodeHandlerOutput's
 * `output`. System messages are filtered out for client display, and each
 * remaining message is guaranteed to carry a `source: 'live' | 'injected'`
 * marker per spec/5-system/6-websocket-protocol.md §4.4.6.
 *
 * D6 (2026-05-17) — multi-turn 의 `message` / `messages` / `turnCount` /
 * `maxTurns` 는 waiting/resumed/ended 모두 `output.result.*` 단일 경로로
 * 통일됐다. 이 함수는 waiting / 첫 진입 시점에서 호출되며 핸들러가 push 한
 * `output.result.*` 를 그대로 읽어야 한다 (spec/4-nodes/3-ai/1-ai-agent.md
 * §7.4/§7.5). `output.partial.*` (info-extractor 의 부분 수집 진행 상태)
 * 은 D6 에서 의미 분리 유지로 top-level 그대로.
 */
export function buildConversationConfigFromOutput(
  output: Record<string, unknown> | undefined,
): {
  message: string;
  turnCount: number;
  maxTurns?: number;
  messages: Array<Record<string, unknown>>;
  extracted?: Record<string, unknown>;
  missingFields?: string[];
  collectionRetryCount?: number;
} {
  const o = output ?? {};
  const r = (o.result as Record<string, unknown> | undefined) ?? {};
  const partial = (o.partial as Record<string, unknown> | undefined) ?? {};
  const messagesAll =
    (r.messages as Array<Record<string, unknown>> | undefined) ?? [];
  const result: {
    message: string;
    turnCount: number;
    maxTurns?: number;
    messages: Array<Record<string, unknown>>;
    extracted?: Record<string, unknown>;
    missingFields?: string[];
    collectionRetryCount?: number;
  } = {
    message: (r.message as string | undefined) ?? '',
    turnCount: (r.turnCount as number | undefined) ?? 0,
    messages: withSourceMarker(messagesAll.filter((m) => m.role !== 'system')),
  };
  const maxTurns = r.maxTurns as number | undefined;
  if (maxTurns !== undefined) result.maxTurns = maxTurns;
  if (partial.extracted !== undefined)
    result.extracted = partial.extracted as Record<string, unknown>;
  if (partial.missingFields !== undefined)
    result.missingFields = partial.missingFields as string[];
  if (partial.collectionRetryCount !== undefined)
    result.collectionRetryCount = partial.collectionRetryCount as number;
  return result;
}

/**
 * `ExecutionEngineService.execute()` 호출 시점의 트리거 메타데이터.
 *
 * 판별 유니온으로 `executedBy` (수동 실행) 와 `triggerId` (schedule/webhook
 * 발화) 가 동시에 truthy 로 전달되는 것을 컴파일 타임에 차단한다. 두 컬럼이
 * 동시에 채워지면 deriveExecutionTrigger 분기가 manual 로 흐르며 트리거 출처
 * 정보가 손실되기 때문.
 */
export type ExecuteOptions =
  | { executedBy: string; triggerId?: never }
  | { executedBy?: never; triggerId: string }
  | { executedBy?: never; triggerId?: never };

/**
 * 워크플로우 실행 엔진의 단일 진입점.
 *
 * 책임 범위 (spec/5-system/4-execution-engine.md 참조):
 *
 *  - **그래프 순회**: 토폴로지 정렬 + back-edge 식별 → `runExecution` /
 *    `executeInline` 의 while-loop dispatch.
 *  - **노드 dispatch**: container (foreach/loop/map) / parallel / background /
 *    blocking (form/buttons/ai_conversation) / standard 분기. Strategy 패턴은
 *    NodeHandlerRegistry 가 type → handler 만 lookup 하고, 라이프사이클별
 *    dispatch 는 본 서비스가 담당.
 *  - **상태 머신**: PENDING → RUNNING → (WAITING_FOR_INPUT ↔ RUNNING)* → COMPLETED
 *    / FAILED / CANCELLED. `updateExecutionStatus` 가 NodeExecution 변경과
 *    함께 단일 트랜잭션으로 묶음 (§1.1, WARN #4).
 *  - **이벤트 발행**: WebsocketService 를 canonical sink 로 emit (§4.4 — 추가
 *    추상화 도입하지 않음).
 *  - **분산 실행**: ContinuationBusService (Redis pub/sub) 가 사용자 입력 fan-out,
 *    `execution_node_log` 테이블 (BIGSERIAL) 이 인스턴스 간 노드 순서 보장
 *    (§7.4).
 *  - **공개 API**: `execute` / `executeSync` / `executeAsync` / `executeInline` /
 *    `continueExecution` / `continueButtonClick` / `continueAiConversation` /
 *    `endAiConversation` / `cancelWaitingExecution`. 본 서비스는 ~4200줄로
 *    크기가 크므로 PR-H/I 에서 점진적으로 책임 분해 예정.
 */
@Injectable()
export class ExecutionEngineService
  implements OnModuleInit, OnApplicationBootstrap, WorkflowExecutor
{
  private readonly logger = new Logger(ExecutionEngineService.name);

  /**
   * Stores pending continuation resolvers for Form nodes that are
   * waiting for user input. Key: executionId.
   */
  private readonly pendingContinuations = new Map<
    string,
    {
      nodeId: string;
      resolve: (data?: unknown) => void;
      reject: (err: Error) => void;
    }
  >();

  /**
   * INFO #10 (Concurrency) — 실행 단위 LLM-default-config lookup 캐시.
   * Key: `${executionId}:${workspaceId}` → cached `Promise<boolean>`.
   *
   * 이전 구현은 `context.variables['__hasDefaultLlmConfig:<wsId>']` 에 저장
   * 했으나 parallel branch 가 `variables` 를 deep clone 한 뒤 (WARN #14) 부터
   * 브랜치별로 독립 호출이 발생해 N+1 회피 효과가 약화됐다. 인스턴스 필드로
   * 옮겨 모든 branch 가 같은 Promise 를 await 하도록 한다.
   *
   * Promise 자체를 저장하므로 동일 키에 대한 동시 호출이 한 번의 DB
   * findDefault 만 발동시킨다 (single-flight).
   *
   * 정리: `runExecution` 의 finally 블록에서 같은 executionId prefix 의
   * 항목을 일괄 삭제 (메모리 누수 차단).
   */
  private readonly llmDefaultConfigCache = new Map<string, Promise<boolean>>();

  /**
   * Sub-Workflow 재귀 호출 깊이 상한. WARN #9 (Security) — workflow A 가 자기
   * 자신을 sub-workflow 로 부르면 무한 재귀 발생, 메모리·DB 폭주. spec/PRD 의
   * 명시 한도가 없으므로 보수적으로 10. executeSync / executeAsync / 인라인
   * 실행 경로 진입 시 검증.
   */
  private static readonly MAX_RECURSION_DEPTH = 10;

  /**
   * Sub-workflow 진입점에서 호출자-피호출자 workspace 격리를 강제한다 (W-6).
   *
   * 호출자 workspaceId 가 비어 있으면(옛 진입 경로, 트리거에서 직접 실행 등)
   * 진단 로그만 남기고 통과 — 점진적 도입을 위함. 향후 모든 호출자가
   * `parentWorkspaceId` 를 전달하도록 정착되면 unknown 진입을 fail-closed 로
   * 전환한다.
   */
  private assertSameWorkspace(
    targetWorkspaceId: string,
    callerWorkspaceId: string | undefined,
  ): void {
    if (!callerWorkspaceId) {
      // 진입점 누락 — 트리거 / 옛 호출자. 로그만 남기고 통과.
      this.logger.warn(
        `[workspace-isolation] Sub-workflow invoked without parentWorkspaceId (target=${targetWorkspaceId}). Update caller to pass workspace context.`,
      );
      return;
    }
    if (targetWorkspaceId !== callerWorkspaceId) {
      throw new Error(
        `WORKFLOW_FORBIDDEN_WORKSPACE: Sub-workflow ${targetWorkspaceId} is not accessible from workspace ${callerWorkspaceId}`,
      );
    }
  }

  constructor(
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(NodeExecution)
    private readonly nodeExecutionRepository: Repository<NodeExecution>,
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
    @InjectRepository(Edge)
    private readonly edgeRepository: Repository<Edge>,
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    @InjectRepository(ExecutionNodeLog)
    private readonly executionNodeLogRepository: Repository<ExecutionNodeLog>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly handlerRegistry: NodeHandlerRegistry,
    private readonly componentRegistry: NodeComponentRegistry,
    private readonly contextService: ExecutionContextService,
    private readonly errorPolicyHandler: ErrorPolicyHandler,
    private readonly expressionResolver: ExpressionResolverService,
    private readonly eventEmitter: ExecutionEventEmitter,
    private readonly graphTraversal: GraphTraversalService,
    @Inject(forwardRef(() => NodeHandlerDependenciesProvider))
    private readonly handlerDeps: NodeHandlerDependenciesProvider,
    private readonly configService: ConfigService,
    private readonly llmService: LlmService,
    private readonly foreachExecutor: ForEachExecutor,
    private readonly loopExecutor: LoopExecutor,
    private readonly parallelExecutor: ParallelExecutor,
    @InjectQueue(BACKGROUND_EXECUTION_QUEUE)
    private readonly backgroundQueue: Queue<BackgroundExecutionJob>,
    private readonly continuationBus: ContinuationBusService,
    private readonly conversationThreadService: ConversationThreadService,
  ) {}

  onModuleInit(): void {
    this.registerHandlers();
    this.registerContinuationHandlers();
  }

  /**
   * `recoverStuckExecutions` 는 같은 모듈의 `ContinuationBusService.publisher`
   * 가 초기화된 뒤에야 분산 lock 을 잡을 수 있다. NestJS 는 같은 모듈 내
   * providers 의 `onModuleInit` 호출 순서를 등록 순서로만 보장하므로,
   * `OnApplicationBootstrap` (모든 모듈의 `onModuleInit` 완료 후) 단계로
   * 미루어 race 를 원천적으로 회피한다.
   */
  async onApplicationBootstrap(): Promise<void> {
    // PR-G — `NodeHandlerRegistry.register` 가 이미 끝난 시점 (모든 모듈 init
    // 완료 후) 에서 metadata 정합성 일괄 검증. 누락 시 명시적 throw 로 부팅
    // 단계 차단 — silent skip 방지.
    this.handlerRegistry.assertConsistency();
    await this.recoverStuckExecutions();
  }

  /**
   * 다중 인스턴스 환경에서 사용자 입력 (form / button / ai-message / cancel)
   * 은 어느 인스턴스로도 들어올 수 있다. ContinuationBusService 가 모든
   * 인스턴스로 메시지를 fan-out 하고, 로컬 `pendingContinuations` Map 에
   * 키가 있는 인스턴스만 실제 resolve 를 수행한다 (호스팅 인스턴스).
   *
   * Map 에 키가 없는 인스턴스는 silent skip — 같은 메시지를 두 곳에서
   * 처리하지 않도록 보장한다.
   */
  private registerContinuationHandlers(): void {
    this.continuationBus.on('continue', (msg) => {
      this.resolvePending(msg.executionId, msg.payload);
    });

    this.continuationBus.on('cancel', (msg) => {
      this.rejectPending(msg.executionId, new ExecutionCancelledError());
    });

    this.continuationBus.on('button_click', (msg) => {
      const buttonId = (msg.payload as { buttonId?: string } | undefined)
        ?.buttonId;
      this.resolvePending(msg.executionId, { type: 'button_click', buttonId });
    });

    this.continuationBus.on('ai_message', (msg) => {
      const message = (msg.payload as { message?: string } | undefined)
        ?.message;
      // 서비스 레이어와 별개로 핸들러 내부에서도 길이 재검증 — Redis 직접
      // publish 우회 시에도 가드. 초과 메시지는 silent drop.
      if (
        typeof message === 'string' &&
        message.length > ExecutionEngineService.MAX_MESSAGE_LENGTH
      ) {
        this.logger.warn(
          `ai_message 길이 초과로 drop — execution=${msg.executionId}, length=${message.length}`,
        );
        return;
      }
      this.resolvePending(msg.executionId, { type: 'ai_message', message });
    });

    this.continuationBus.on(
      'ai_end_conversation',
      (msg: ContinuationMessage) => {
        this.resolvePending(msg.executionId, { type: 'ai_end_conversation' });
      },
    );
  }

  /**
   * 로컬 `pendingContinuations` Map 의 resolver 호출 헬퍼. 키가 없으면
   * silent skip — 다른 인스턴스가 호스팅 중이거나 이미 처리된 상태.
   */
  private resolvePending(executionId: string, value: unknown): void {
    const pending = this.pendingContinuations.get(executionId);
    if (!pending) return;
    this.pendingContinuations.delete(executionId);
    pending.resolve(value);
  }

  /**
   * 로컬 `pendingContinuations` Map 의 reject 헬퍼. 키가 없으면 silent skip.
   */
  private rejectPending(executionId: string, error: Error): void {
    const pending = this.pendingContinuations.get(executionId);
    if (!pending) return;
    this.pendingContinuations.delete(executionId);
    pending.reject(error);
  }

  /**
   * Recovery 의 stale 임계값 — WAITING_FOR_INPUT 가 이 시간보다 오래되면
   * 정상적으로 진행 중인 입력 대기로 보지 않고 stuck 으로 간주한다. 다중
   * 인스턴스 환경에서 다른 인스턴스가 활발히 처리 중인 정상 대기를 잘못
   * FAIL 시키는 것을 방지하는 보수적 가드.
   */
  private static readonly STUCK_RECOVERY_STALE_MS = 30 * 60 * 1000;

  /**
   * 분산 lock 의 TTL (초). 부팅 동시 진행 시 다른 인스턴스가 lock 을 획득해
   * 본 인스턴스의 recovery 가 skip 되더라도, lock 보유자가 죽었을 때 60초
   * 후 lock 이 expire 되어 다음 부팅에서 다시 시도 가능.
   */
  private static readonly RECOVERY_LOCK_TTL_SECONDS = 60;

  /**
   * On server restart, mark executions stuck in WAITING_FOR_INPUT as FAILED.
   * 다중 인스턴스 환경에서:
   * - SET NX 분산 lock 으로 동시에 여러 인스턴스가 recovery 를 수행하지 않게
   *   가드.
   * - `startedAt < now() - 30분` 인 row 만 FAIL 처리 — 다른 인스턴스가 정상
   *   처리 중인 신규 대기는 보존한다.
   */
  private async recoverStuckExecutions(): Promise<void> {
    const acquired = await this.continuationBus.acquireLock(
      RECOVERY_LOCK_KEY,
      ExecutionEngineService.RECOVERY_LOCK_TTL_SECONDS,
    );
    if (!acquired) {
      // 다른 인스턴스가 이미 처리 중. 본 인스턴스는 skip — lock 이 expire
      // 된 다음 부팅이나 다른 인스턴스의 후속 호출에서 처리된다.
      return;
    }

    try {
      // WARN #1 (DB) — N건의 개별 save 대신 단일 atomic UPDATE. SQL 단일
      // 문장은 내부적으로 트랜잭션 이므로 정합성 보장. durationMs 는 stuck
      // recovery 의 정확도가 중요하지 않아 일괄 NULL 유지.
      const finishedAt = new Date();
      const staleThreshold = new Date(
        finishedAt.getTime() - ExecutionEngineService.STUCK_RECOVERY_STALE_MS,
      );
      const updateResult = await this.executionRepository
        .createQueryBuilder()
        .update(Execution)
        .set({
          status: ExecutionStatus.FAILED,
          error: {
            message:
              'Execution failed: server restarted while waiting for user input',
          },
          finishedAt,
        })
        .where('status = :status', {
          status: ExecutionStatus.WAITING_FOR_INPUT,
        })
        .andWhere('started_at < :threshold', { threshold: staleThreshold })
        .execute();

      const affected = updateResult.affected ?? 0;
      if (affected > 0) {
        this.logger.warn(
          `Recovered ${affected} stale execution(s) (>30min) stuck in WAITING_FOR_INPUT`,
        );
      }
    } finally {
      // 작업 완료 후 lock 을 명시 해제 — TTL 60초 만료 대기 없이 다음
      // 인스턴스가 즉시 처리할 수 있다. owner 검증이 들어가 있어 이미
      // expire 되어 다른 인스턴스가 잡은 lock 은 절대 삭제하지 않는다.
      await this.continuationBus.releaseLock(RECOVERY_LOCK_KEY);
    }
  }

  private registerHandlers() {
    this.componentRegistry.bootstrap(
      ALL_NODE_COMPONENTS,
      this.handlerDeps.build(this),
    );
  }

  /**
   * Execute a workflow. Creates the execution record and starts execution
   * in the background so the caller gets the execution ID immediately.
   *
   * `options.executedBy` 는 수동 실행(사용자가 ▶ 누름)일 때, `options.triggerId`
   * 는 schedule/webhook 트리거 발화일 때 채운다. 두 값은 Execution 행에 저장되어
   * "최근 실행" 화면이 출처를 분류하는 데 쓰인다 (deriveExecutionTrigger).
   * 판별 유니온이라 둘이 동시에 truthy 로 전달될 수 없다.
   */
  async execute(
    workflowId: string,
    input?: unknown,
    options?: ExecuteOptions,
  ): Promise<string> {
    // 1. Validate workflow exists
    const workflow = await this.workflowRepository.findOneBy({
      id: workflowId,
    });
    if (!workflow) {
      throw new WorkflowNotFoundError(workflowId);
    }

    // 2. Create Execution record
    const execution = this.executionRepository.create({
      workflowId,
      status: ExecutionStatus.PENDING,
      inputData: (input as Record<string, unknown>) ?? {},
      executedBy: options?.executedBy,
      triggerId: options?.triggerId,
    });
    const savedExecution = await this.executionRepository.save(execution);
    const executionId = savedExecution.id;

    // 3. Run execution in background (fire-and-forget)
    this.runExecution(savedExecution, input).catch((error: unknown) => {
      this.logger.error(
        `Background execution failed for ${executionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });

    return executionId;
  }

  /**
   * Execute a sub-workflow inline within the parent execution.
   * Shares the same executionId, nodeOutputCache, and nodeMap so that
   * $node references work seamlessly and node executions appear in the
   * same history timeline.
   */
  async executeInline(
    workflowId: string,
    input: unknown,
    options: InlineExecutionOptions,
  ): Promise<unknown> {
    const {
      executionId,
      context,
      executedNodes,
      recursionDepth,
      parentNodeExecutionId,
    } = options;

    // Strip _selectedPort from input — this is parent execution metadata
    // that must not leak into the sub-workflow (it would cause all downstream
    // nodes to be port-routing-skipped).
    let cleanInput = input;
    if (
      input &&
      typeof input === 'object' &&
      '_selectedPort' in (input as Record<string, unknown>)
    ) {
      const { _selectedPort, ...rest } = input as Record<string, unknown>;
      void _selectedPort;
      cleanInput = rest;
    }

    this.logger.log(
      `[executeInline] Starting inline execution of workflow ${workflowId} within execution ${executionId}`,
    );

    // Workspace 격리: target workflow 가 호출자와 다른 workspace 면 차단 (W-6).
    // context.variables.__workspaceId 는 runExecution 이 부모 workflow.workspaceId
    // 로 주입한다 (line 1238 참고).
    const callerWorkspaceId =
      (context.variables?.__workspaceId as string | undefined) || undefined;
    const targetWorkflow = await this.workflowRepository.findOneBy({
      id: workflowId,
    });
    if (!targetWorkflow) {
      throw new WorkflowNotFoundError(workflowId);
    }
    this.assertSameWorkspace(targetWorkflow.workspaceId, callerWorkspaceId);

    // Load target workflow's nodes and edges
    const subNodes = await this.nodeRepository.findBy({ workflowId });
    const subEdges = await this.edgeRepository.findBy({ workflowId });

    if (subNodes.length === 0) {
      return cleanInput;
    }

    // Build graph for the sub-workflow
    const { graphNodes, graphEdges } = buildGraph(subNodes, subEdges);
    const { forwardEdges, backEdges } = identifyBackEdges(
      graphNodes,
      graphEdges,
    );
    const sortedNodeIds = topologicalSort(graphNodes, forwardEdges);

    if (sortedNodeIds.length === 0) {
      return cleanInput;
    }

    // Pre-compute sorted-index map for back-edge jumps + edge lookups (CRIT #2).
    const sortedIndexMap = new Map<string, number>();
    for (let i = 0; i < sortedNodeIds.length; i++) {
      sortedIndexMap.set(sortedNodeIds[i], i);
    }
    const { backEdgeMap, outgoingEdgeMap, incomingEdgeMap } =
      this.graphTraversal.buildEdgeIndexes(
        graphEdges,
        backEdges,
        sortedIndexMap,
      );

    // Use target-only nodeMap for expression resolution.
    // $node references in the target workflow should resolve against the
    // target workflow's own nodes only, not the parent (source) workflow.
    const subNodeMap = new Map(subNodes.map((n) => [n.id, n]));

    // Debug: log node labels and execution order. INFO #8 — 매 노드 실행마다
    // O(N) `.map().join()` 비용을 프로덕션에서 회피. `logger.debug` 는 Nest
    // 의 debug level (process.env.LOG_LEVEL='debug') 일 때만 직렬화된다.
    this.logger.debug(
      `[executeInline] Target workflow nodes: ${subNodes.map((n) => `${n.label}(${n.type})`).join(', ')}`,
    );
    this.logger.debug(
      `[executeInline] Sorted execution order (${sortedNodeIds.length} nodes): ${sortedNodeIds.map((id) => subNodeMap.get(id)?.label ?? id).join(' → ')}`,
    );

    // Update context recursionDepth for nested sub-workflow calls
    const prevDepth = context.recursionDepth;
    context.recursionDepth = recursionDepth;

    // Stamp parentNodeExecutionId so every NodeExecution created during this
    // inline run records the invoking Sub-Workflow row id. Restored in
    // the finally block so sibling nodes of the parent don't inherit it.
    const prevParentNodeExecutionId = context.parentNodeExecutionId;
    if (parentNodeExecutionId) {
      context.parentNodeExecutionId = parentNodeExecutionId;
    }

    const maxNodeIterations = this.configService.get<number>(
      'MAX_NODE_ITERATIONS',
      100,
    );
    const nodeExecutionCount = new Map<string, number>();
    // Seed reachability (CRIT #2 — runExecution 과 동일한 helper). Background
    // processor 는 explicit entry ids (targets of `background`-port edges) 를
    // 전달하고, 그 외에는 trigger-first / no-incoming-edge fallback 사용.
    const reachable = this.graphTraversal.seedInitialReachability(
      sortedNodeIds,
      subNodeMap,
      forwardEdges,
      options.entryNodeIds,
    );

    // Retrieve execution meta for expression context
    const execution = await this.executionRepository.findOneBy({
      id: executionId,
    });

    let lastOutput: unknown = cleanInput;
    let pointer = 0;

    try {
      while (pointer < sortedNodeIds.length) {
        const nodeId = sortedNodeIds[pointer];
        const node = subNodeMap.get(nodeId);
        if (!node) {
          pointer++;
          continue;
        }

        // Skip unreachable nodes (not on any activated branch)
        if (!reachable.has(nodeId)) {
          pointer++;
          continue;
        }

        // Max iteration guard
        const count = (nodeExecutionCount.get(nodeId) ?? 0) + 1;
        nodeExecutionCount.set(nodeId, count);
        if (maxNodeIterations > 0 && count > maxNodeIterations) {
          throw new Error(
            `Node "${node.label ?? node.type}" exceeded maximum iteration count (${maxNodeIterations}).`,
          );
        }

        // Skip disabled nodes (don't propagate reachability to downstream).
        // CRIT #2 — runExecution 과 동일한 helper 로 통일.
        if (node.isDisabled) {
          await this.handleDisabledNode(
            executionId,
            nodeId,
            node,
            context,
            executedNodes,
          );
          pointer++;
          continue;
        }

        // Skip trigger nodes in sub-workflows (they are entry points only).
        //
        // WARN #17 (Architecture) — sub-workflow 의 trigger 는 `manual_trigger` 만
        // 허용한다. webhook/schedule trigger 는 외부 이벤트 (HTTP / cron) 와
        // 결합된 출처 분류 의미를 가지므로 부모 Execution 의 출처를 silently
        // 덮어쓰면 안 된다. spec/4-nodes/2-flow/1-workflow.md (Workflow node)
        // 의 box 참조. 다른 trigger 타입을 만나면 fail-fast.
        if (node.category === NodeCategory.TRIGGER) {
          if (node.type !== NODE_TYPES.MANUAL_TRIGGER) {
            throw new Error(
              `INVALID_SUB_WORKFLOW_TRIGGER: Sub-workflow can only contain "manual_trigger" entry points. ` +
                `Found "${node.type}" (label="${node.label ?? node.type}"). ` +
                `webhook_trigger / schedule_trigger 등은 외부 이벤트와 결합된 ` +
                `출처 분류를 가지므로 sub-workflow 진입점으로 사용할 수 없다.`,
            );
          }
          executedNodes.add(nodeId);
          // Pass clean input through trigger node's output slot
          this.contextService.setNodeOutput(executionId, nodeId, cleanInput);
          this.graphTraversal.propagateReachability(
            nodeId,
            outgoingEdgeMap,
            context.nodeOutputCache,
            reachable,
          );
          pointer++;
          continue;
        }

        // Gather input from predecessor nodes within the sub-workflow graph
        const nodeInput = this.gatherNodeInput(
          nodeId,
          graphEdges,
          executedNodes,
          context.nodeOutputCache,
          cleanInput,
          incomingEdgeMap,
        );

        // Execute the node using the parent execution's context but
        // target-only nodeMap for $node expression resolution.
        this.logger.log(
          `[executeInline] Executing node "${node.label}" (type=${node.type}, id=${node.id})`,
        );
        await this.executeNode(
          executionId,
          node,
          nodeInput,
          context,
          executedNodes,
          subNodeMap,
          {
            startedAt: execution?.startedAt?.toISOString(),
            mode: 'manual',
          },
        );

        // PR-G — metadata flag dispatch (CRIT #3 시나리오 D). hard-coded
        // node.type 분기를 NodeHandlerRegistry.getMetadata 의 kind 로 통일.
        const dispatchKind = this.handlerRegistry.getMetadata(node.type).kind;

        // Container dispatch for sub-workflow inline execution.
        if (dispatchKind === 'container') {
          await this.runContainer(
            node,
            subNodes,
            subEdges,
            context,
            executionId,
            executedNodes,
            {
              startedAt: execution?.startedAt?.toISOString(),
              mode: 'manual',
            },
          );
        }

        // Background dispatch — enqueue body subgraph and continue main flow.
        if (dispatchKind === 'background') {
          await this.scheduleBackgroundBody(
            node,
            subEdges,
            context,
            executionId,
            cleanInput,
          );
        }

        // Debug: log $node keys available after this node executed
        const availableLabels = [...subNodeMap.entries()]
          .filter(([nid]) => context.nodeOutputCache[nid] !== undefined)
          .map(([, n]) => n.label);
        this.logger.log(
          `[executeInline] After "${node.label}": $node labels available = [${availableLabels.join(', ')}]`,
        );

        // Blocking nodes: pause execution until user interaction
        // (same logic as runExecution — Form, Button, AI Conversation)
        const nodeOutput = context.nodeOutputCache[node.id] as
          | Record<string, unknown>
          | undefined;
        const interactionType = this.getInteractionType(context, node.id);
        const statusForLog =
          typeof nodeOutput?.status === 'string' ? nodeOutput.status : 'none';
        this.logger.log(
          `[executeInline] Node "${node.label}" output status=${statusForLog}, execution=${execution ? 'found' : 'NULL'}`,
        );
        // WARN #19 (Requirement) — execution 이 null 인데 노드가 blocking
        // 상태로 진입하면 user interaction guard 가 통과되지 않아 silent skip.
        // 명시적 에러로 fail-fast 하여 시스템 환경 문제를 빠르게 진단 가능하게.
        if (!execution && nodeOutput?.status === 'waiting_for_input') {
          throw new Error(
            `[executeInline] Cannot enter blocking state for node "${node.label ?? node.type}": Execution record not found (executionId=${executionId}). Sub-workflow blocking nodes require an active Execution row.`,
          );
        }
        if (execution) {
          if (nodeOutput?.status === 'waiting_for_input') {
            this.logger.log(
              `[executeInline] BLOCKING: "${node.label}" is waiting_for_input (type=${node.type})`,
            );
            const blocking = this.handlerRegistry.getMetadata(node.type);
            if (
              blocking.kind === 'blocking' &&
              blocking.interaction === 'form'
            ) {
              await this.waitForFormSubmission(
                execution,
                executionId,
                node,
                context,
              );
            } else if (interactionType === 'buttons') {
              await this.waitForButtonInteraction(
                execution,
                executionId,
                node,
                context,
                graphEdges,
              );
            } else if (interactionType === 'ai_conversation') {
              await this.waitForAiConversation(
                execution,
                executionId,
                node,
                context,
              );
            }
          }
        }

        lastOutput = context.nodeOutputCache[node.id];

        // Propagate reachability to downstream nodes through activated edges
        this.graphTraversal.propagateReachability(
          nodeId,
          outgoingEdgeMap,
          context.nodeOutputCache,
          reachable,
        );

        // Back-edge handling
        const backEdgesFromNode = backEdgeMap.get(nodeId);
        if (backEdgesFromNode?.length) {
          const activated = this.findActivatedBackEdge(
            nodeId,
            backEdgesFromNode,
            context.nodeOutputCache,
          );
          if (activated) {
            for (let i = activated.targetIndex; i <= pointer; i++) {
              reachable.delete(sortedNodeIds[i]);
            }
            reachable.add(sortedNodeIds[activated.targetIndex]);
            pointer = activated.targetIndex;
            continue;
          }
        }

        pointer++;
      }
    } finally {
      // Restore parent's recursion depth
      context.recursionDepth = prevDepth;
      context.parentNodeExecutionId = prevParentNodeExecutionId;
    }

    return lastOutput;
  }

  /**
   * Execute a sub-workflow synchronously (blocking).
   * Creates an Execution record, runs it inline, and returns the output.
   *
   * **Timeout TOCTOU 주의 (WARN #13)**: timeout 분기에서 인-flight runExecution
   * 은 즉시 중단되지 않고 백그라운드에서 계속 진행될 수 있다. 따라서 짧은 시점
   * 동안:
   *   1) executeSync 가 FAILED 로 마킹 → 호출부에 throw
   *   2) 백그라운드 runExecution 이 완료되면 COMPLETED 로 다시 마킹
   * 의 race window 가 존재한다. 현재는 timeout 후 reload → 상태 비교로 보호하나
   * 완전 차단 X. 완전한 cancel 은 AbortSignal 주입 + 워커 협력이 필요하며 별도
   * 인프라 PR (CRIT/WARN backlog) 로 분리.
   */
  async executeSync(
    workflowId: string,
    input?: unknown,
    options?: SubWorkflowOptions,
  ): Promise<SubWorkflowResult> {
    // WARN #9 (Security) — recursion 폭주 차단.
    const depth = options?.recursionDepth ?? 0;
    if (depth > ExecutionEngineService.MAX_RECURSION_DEPTH) {
      throw new Error(
        `Sub-workflow recursion depth ${depth} exceeds maximum ${ExecutionEngineService.MAX_RECURSION_DEPTH}`,
      );
    }

    const workflow = await this.workflowRepository.findOneBy({
      id: workflowId,
    });
    if (!workflow) {
      throw new WorkflowNotFoundError(workflowId);
    }
    this.assertSameWorkspace(workflow.workspaceId, options?.parentWorkspaceId);

    const execution = this.executionRepository.create({
      workflowId,
      status: ExecutionStatus.PENDING,
      inputData: (input as Record<string, unknown>) ?? {},
      parentExecutionId: options?.parentExecutionId ?? undefined,
      recursionDepth: depth,
    });
    const savedExecution = await this.executionRepository.save(execution);

    const timeoutMs = options?.timeoutMs ?? 300_000;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    // timeoutMs === 0 means "no timeout" per spec; skip Promise.race entirely.
    const timeoutPromise =
      timeoutMs > 0
        ? new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => {
              reject(new SubWorkflowTimeoutError(timeoutMs));
            }, timeoutMs);
          })
        : null;

    try {
      if (timeoutPromise) {
        await Promise.race([
          this.runExecution(savedExecution, input),
          timeoutPromise,
        ]);
      } else {
        await this.runExecution(savedExecution, input);
      }
    } catch (error: unknown) {
      // On timeout, mark the sub-execution as failed
      const reloaded = await this.executionRepository.findOneBy({
        id: savedExecution.id,
      });
      if (
        reloaded &&
        reloaded.status !== ExecutionStatus.COMPLETED &&
        reloaded.status !== ExecutionStatus.FAILED
      ) {
        reloaded.status = ExecutionStatus.FAILED;
        reloaded.error = {
          message: error instanceof Error ? error.message : String(error),
        };
        reloaded.finishedAt = new Date();
        if (reloaded.startedAt) {
          reloaded.durationMs =
            reloaded.finishedAt.getTime() - reloaded.startedAt.getTime();
        }
        await this.executionRepository.save(reloaded);
      }
      throw error;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }

    // INFO #19 — 성공 path 의 findOneBy 재조회 제거. runExecution 은 자신이 받은
    // savedExecution 참조를 in-place mutation 하므로 (status / outputData /
    // finishedAt / durationMs) 별도 SELECT 없이 in-memory 값을 그대로 사용한다.
    // catch block 의 reloaded 재조회는 timeout TOCTOU 방어를 위해 유지한다 —
    // runExecution 이 background 에서 완료했을 가능성을 DB 에서 확인해야 한다.
    if (savedExecution.status === ExecutionStatus.FAILED) {
      const errRecord = savedExecution.error as Record<string, string> | null;
      const errMsg: string = errRecord?.message ?? 'Unknown error';
      throw new Error(`Sub-workflow execution failed: ${errMsg}`);
    }

    if (savedExecution.status === ExecutionStatus.CANCELLED) {
      throw new Error('Sub-workflow execution was cancelled');
    }

    return {
      executionId: savedExecution.id,
      output: savedExecution.outputData ?? {},
      status: savedExecution.status,
    };
  }

  /**
   * Execute a sub-workflow asynchronously (fire-and-forget).
   * Returns the execution ID immediately.
   */
  async executeAsync(
    workflowId: string,
    input?: unknown,
    options?: Omit<SubWorkflowOptions, 'timeoutMs'>,
  ): Promise<string> {
    // WARN #9 (Security) — recursion 폭주 차단.
    const depth = options?.recursionDepth ?? 0;
    if (depth > ExecutionEngineService.MAX_RECURSION_DEPTH) {
      throw new Error(
        `Sub-workflow recursion depth ${depth} exceeds maximum ${ExecutionEngineService.MAX_RECURSION_DEPTH}`,
      );
    }

    const workflow = await this.workflowRepository.findOneBy({
      id: workflowId,
    });
    if (!workflow) {
      throw new WorkflowNotFoundError(workflowId);
    }
    this.assertSameWorkspace(workflow.workspaceId, options?.parentWorkspaceId);

    const execution = this.executionRepository.create({
      workflowId,
      status: ExecutionStatus.PENDING,
      inputData: (input as Record<string, unknown>) ?? {},
      parentExecutionId: options?.parentExecutionId ?? undefined,
      recursionDepth: depth,
    });
    const savedExecution = await this.executionRepository.save(execution);
    const executionId = savedExecution.id;

    this.runExecution(savedExecution, input).catch((error: unknown) => {
      this.logger.error(
        `Background sub-workflow execution failed for ${executionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });

    return executionId;
  }

  /**
   * Runs the actual execution logic. Called in background after execute()
   * returns the execution ID to the caller.
   */
  private async runExecution(
    savedExecution: Execution,
    input: unknown,
  ): Promise<void> {
    const executionId = savedExecution.id;
    const workflowId = savedExecution.workflowId;

    try {
      // 3. Transition to RUNNING
      await this.updateExecutionStatus(savedExecution, ExecutionStatus.RUNNING);
      this.eventEmitter.emitExecution(
        executionId,
        ExecutionEventType.EXECUTION_STARTED,
        { status: ExecutionStatus.RUNNING },
      );

      // 4. Load nodes and edges
      const nodes = await this.nodeRepository.findBy({ workflowId });
      const edges = await this.edgeRepository.findBy({ workflowId });

      // 5. Build graph (filters container children & tool area nodes)
      const { graphNodes, graphEdges } = buildGraph(nodes, edges);

      // 6. Identify back-edges (edges that create cycles) and separate forward-edges
      const { forwardEdges, backEdges } = identifyBackEdges(
        graphNodes,
        graphEdges,
      );

      // 7. Topological sort on forward-edges-only graph (guaranteed DAG)
      const sortedNodeIds = topologicalSort(graphNodes, forwardEdges);

      // Pre-compute node-id → sorted-index map for O(1) lookup
      const sortedIndexMap = new Map<string, number>();
      for (let i = 0; i < sortedNodeIds.length; i++) {
        sortedIndexMap.set(sortedNodeIds[i], i);
      }

      // CRIT #2 — executeInline 과 동일한 helper. back / outgoing / incoming
      // edge lookup 을 한 곳에 빌드. Pointer 이동·O(1) gatherNodeInput·port
      // routing 에 사용.
      const { backEdgeMap, outgoingEdgeMap, incomingEdgeMap } =
        this.graphTraversal.buildEdgeIndexes(
          graphEdges,
          backEdges,
          sortedIndexMap,
        );

      // 8. Create execution context (inject workspaceId for AI handlers)
      const workflow = await this.workflowRepository.findOneBy({
        id: workflowId,
      });
      const context = this.contextService.createContext(
        executionId,
        workflowId,
        { __workspaceId: workflow?.workspaceId ?? '' },
        savedExecution.recursionDepth,
      );

      // 9. Build lookup maps
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      // 10. Execute nodes with pointer-based loop (supports back-edge jumps)
      // Inject runtime state into context for sub-workflow inline execution
      const maxNodeIterations = this.configService.get<number>(
        'MAX_NODE_ITERATIONS',
        100,
      );
      if (maxNodeIterations === 0 && backEdges.length > 0) {
        this.logger.warn(
          `MAX_NODE_ITERATIONS=0 (unlimited) with ${backEdges.length} back-edge(s). ` +
            `Cyclic workflows may run indefinitely if no exit condition is met.`,
        );
      }
      const nodeExecutionCount = new Map<string, number>();
      // NOTE: executedNodes is intentionally NOT cleared on back-edge jumps.
      // Re-executed nodes overwrite their output in nodeOutputCache, and
      // gatherNodeInput uses executedNodes to confirm predecessor completion.
      // Keeping them in the set ensures downstream nodes see predecessor output.
      const executedNodes = new Set<string>();
      context._executedNodes = executedNodes;
      // CRIT #2 — executeInline 과 동일한 helper. trigger-first / no-incoming
      // fallback 으로 reachable seed.
      const reachable = this.graphTraversal.seedInitialReachability(
        sortedNodeIds,
        nodeMap,
        forwardEdges,
      );

      let pointer = 0;
      while (pointer < sortedNodeIds.length) {
        const nodeId = sortedNodeIds[pointer];
        const node = nodeMap.get(nodeId);
        if (!node) {
          pointer++;
          continue;
        }

        // Skip unreachable nodes (not on any activated branch)
        if (!reachable.has(nodeId)) {
          pointer++;
          continue;
        }

        // Max iteration guard (0 = unlimited)
        const count = (nodeExecutionCount.get(nodeId) ?? 0) + 1;
        nodeExecutionCount.set(nodeId, count);
        if (maxNodeIterations > 0 && count > maxNodeIterations) {
          // noinspection ExceptionCaughtLocallyJS — intentional: delegates to the catch block's failure handling
          throw new Error(
            `Node "${node.label ?? node.type}" exceeded maximum iteration count (${maxNodeIterations}). ` +
              `Set MAX_NODE_ITERATIONS=0 for unlimited.`,
          );
        }

        // Skip disabled nodes (don't propagate reachability to downstream).
        // CRIT #2 — executeInline 과 동일한 helper 로 통일.
        if (node.isDisabled) {
          await this.handleDisabledNode(
            executionId,
            nodeId,
            node,
            context,
            executedNodes,
          );
          pointer++;
          continue;
        }

        // Gather input from predecessor nodes
        const nodeInput = this.gatherNodeInput(
          nodeId,
          graphEdges,
          executedNodes,
          context.nodeOutputCache,
          input,
          incomingEdgeMap,
        );

        // Execute the node
        await this.executeNode(
          executionId,
          node,
          nodeInput,
          context,
          executedNodes,
          nodeMap,
          {
            startedAt: savedExecution.startedAt?.toISOString(),
            mode: 'manual',
          },
        );

        // PR-G — metadata flag dispatch (CRIT #3 시나리오 D).
        const dispatchKind = this.handlerRegistry.getMetadata(node.type).kind;

        // Container dispatch: after the handler runs (which resolves config),
        // iterate the body subgraph and overwrite container output with the
        // collected results so `done`-port edges see the right value.
        if (dispatchKind === 'container') {
          await this.runContainer(
            node,
            nodes,
            edges,
            context,
            executionId,
            executedNodes,
            {
              startedAt: savedExecution.startedAt?.toISOString(),
              mode: 'manual',
            },
          );
        }

        // Background dispatch — enqueue body subgraph and continue main flow.
        if (dispatchKind === 'background') {
          await this.scheduleBackgroundBody(
            node,
            edges,
            context,
            executionId,
            input,
          );
        }

        // Parallel dispatch (PARALLEL_ENGINE=v1): run branch subgraphs
        // concurrently. In the default 'off' mode the Parallel handler's
        // `port: string[]` return value is handled by the legacy sequential
        // propagateReachability path below, preserving existing semantics.
        if (
          dispatchKind === 'parallel' &&
          this.configService.get<string>('PARALLEL_ENGINE', 'off') === 'v1'
        ) {
          const nodeInput = this.gatherNodeInput(
            nodeId,
            graphEdges,
            executedNodes,
            context.nodeOutputCache,
            input,
            incomingEdgeMap,
          );
          await this.runParallel(
            node,
            nodes,
            edges,
            forwardEdges,
            backEdges,
            outgoingEdgeMap,
            context,
            executionId,
            executedNodes,
            {
              startedAt: savedExecution.startedAt?.toISOString(),
              mode: 'manual',
            },
            reachable,
            nodeInput,
          );
          // Skip downstream checks — runParallel already handled
          // branch bodies, reachability propagation, and neutralized
          // the Parallel node's _selectedPort sentinel so that the
          // default propagateReachability below is a harmless no-op.
          // However, we explicitly skip blocking/back-edge checks that
          // don't apply to the Parallel node itself.
          pointer++;
          continue;
        }

        // Blocking nodes: pause execution until user interaction
        const nodeOutput = context.nodeOutputCache[node.id] as
          | Record<string, unknown>
          | undefined;
        const interactionType = this.getInteractionType(context, node.id);
        if (nodeOutput?.status === 'waiting_for_input') {
          const blocking = this.handlerRegistry.getMetadata(node.type);
          if (blocking.kind === 'blocking' && blocking.interaction === 'form') {
            await this.waitForFormSubmission(
              savedExecution,
              executionId,
              node,
              context,
            );
          } else if (interactionType === 'buttons') {
            await this.waitForButtonInteraction(
              savedExecution,
              executionId,
              node,
              context,
              graphEdges,
            );
          } else if (interactionType === 'ai_conversation') {
            await this.waitForAiConversation(
              savedExecution,
              executionId,
              node,
              context,
            );
          }
        }

        // Propagate reachability to downstream nodes through activated edges.
        // Must happen after blocking interactions which may set _selectedPort.
        this.graphTraversal.propagateReachability(
          nodeId,
          outgoingEdgeMap,
          context.nodeOutputCache,
          reachable,
        );

        // Check for activated back-edges (cyclic workflow support)
        const backEdgesFromNode = backEdgeMap.get(nodeId);
        if (backEdgesFromNode?.length) {
          const activated = this.findActivatedBackEdge(
            nodeId,
            backEdgesFromNode,
            context.nodeOutputCache,
          );
          if (activated) {
            // Clear reachability for nodes in the re-execution range
            for (let i = activated.targetIndex; i <= pointer; i++) {
              reachable.delete(sortedNodeIds[i]);
            }
            // Re-add the back-edge target so it executes on the next pass
            reachable.add(sortedNodeIds[activated.targetIndex]);
            pointer = activated.targetIndex;
            continue;
          }
        }

        pointer++;
      }

      // 11. Mark execution as completed
      await this.updateExecutionStatus(
        savedExecution,
        ExecutionStatus.COMPLETED,
      );

      // Set output data from the last executed node
      const lastNodeId = sortedNodeIds[sortedNodeIds.length - 1];
      if (lastNodeId) {
        savedExecution.outputData =
          (context.nodeOutputCache[lastNodeId] as Record<string, unknown>) ??
          {};
        savedExecution.finishedAt = new Date();
        savedExecution.durationMs =
          savedExecution.finishedAt.getTime() -
          savedExecution.startedAt.getTime();
        await this.executionRepository.save(savedExecution);
      }

      // Emit after all DB writes are complete
      this.eventEmitter.emitExecution(
        executionId,
        ExecutionEventType.EXECUTION_COMPLETED,
        { status: ExecutionStatus.COMPLETED },
      );
    } catch (error: unknown) {
      // Cancelled while waiting for user input — mark as cancelled, not failed
      if (error instanceof ExecutionCancelledError) {
        savedExecution.status = ExecutionStatus.CANCELLED;
        savedExecution.finishedAt = new Date();
        savedExecution.durationMs =
          savedExecution.finishedAt.getTime() -
          savedExecution.startedAt.getTime();
        await this.executionRepository.save(savedExecution);
        this.eventEmitter.emitExecution(
          executionId,
          ExecutionEventType.EXECUTION_CANCELLED,
          { status: ExecutionStatus.CANCELLED },
        );
        return;
      }

      // Mark execution as failed
      savedExecution.status = ExecutionStatus.FAILED;
      // WARN #7 (Security) — error.stack 은 파일 경로·모듈명·내부 구조를 노출하므로
      // DB 에 저장하지 않는다. 디버깅이 필요한 stack 정보는 서버 로그로만 기록.
      const errMessage = error instanceof Error ? error.message : String(error);
      if (error instanceof Error && error.stack) {
        this.logger.error(
          `Execution ${savedExecution.id} failed: ${errMessage}`,
          error.stack,
        );
      }
      savedExecution.error = { message: errMessage };
      savedExecution.finishedAt = new Date();
      savedExecution.durationMs =
        savedExecution.finishedAt.getTime() -
        savedExecution.startedAt.getTime();
      await this.executionRepository.save(savedExecution);
      this.eventEmitter.emitExecution(
        executionId,
        ExecutionEventType.EXECUTION_FAILED,
        {
          status: ExecutionStatus.FAILED,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    } finally {
      this.pendingContinuations.delete(executionId);
      this.contextService.deleteContext(executionId);
      this.clearLlmDefaultConfigCache(executionId);
    }
  }

  /**
   * Append a node id to the execution's ordered log. Each row's BIGSERIAL
   * `id` is concurrency-safe across instances, so the (execution_id, id)
   * order is the canonical execution sequence. Errors are caught locally so
   * one failing append cannot poison subsequent appends.
   */
  private async appendExecutionPath(
    executionId: string,
    nodeId: string,
  ): Promise<void> {
    try {
      await this.executionNodeLogRepository.insert({ executionId, nodeId });
    } catch (error) {
      this.logger.warn(
        `Failed to append executionPath for ${executionId}/${nodeId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Read the blocking node's interaction type, preferring the structured
   * cache (new NodeHandlerOutput shape: `meta.interactionType`) and falling
   * back to the legacy flat output root. Single source of truth for the two
   * callers (runExecution blocking dispatch and executeInline resume).
   */
  private getInteractionType(
    context: ExecutionContext,
    nodeId: string,
  ): string | undefined {
    const structuredMeta = context.structuredOutputCache?.[nodeId]?.meta;
    const structuredType = structuredMeta?.interactionType;
    if (typeof structuredType === 'string') return structuredType;
    const flat = context.nodeOutputCache[nodeId] as
      | Record<string, unknown>
      | undefined;
    const flatType = flat?.interactionType;
    return typeof flatType === 'string' ? flatType : undefined;
  }

  /**
   * Pause execution at a Form node and wait for the user to submit form data.
   * Transitions Execution → WAITING_FOR_INPUT, emits WS event, awaits Promise.
   * On resume: merges formData into node output, transitions back to RUNNING.
   */
  private async waitForFormSubmission(
    savedExecution: Execution,
    executionId: string,
    node: Node,
    context: ExecutionContext,
  ): Promise<void> {
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
    // Atomic: Execution → WAITING_FOR_INPUT + NodeExecution save (WARN #4)
    await this.updateExecutionStatus(
      savedExecution,
      ExecutionStatus.WAITING_FOR_INPUT,
      nodeExec ?? undefined,
    );
    this.eventEmitter.emitExecution(
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
        // 누락 시 sortByStartedAt 이 해당 row 를 timeline 마지막으로 보냄.
        startedAt: nodeExec?.startedAt?.toISOString?.(),
        // 3 waiting emit (Buttons / Form / AI) 모두 top-level interactionType
        // 을 명시 — frontend 의 handleWaitingForInput 가 첫 fallback (즉
        // payload.interactionType) 만으로 정확히 분기하도록 일관화. (Carousel
        // 버튼 disabled stuck 버그의 defense-in-depth.)
        interactionType: 'form',
        nodeOutput,
        // Live ConversationThread snapshot so UI can render the running
        // thread panel (spec/conventions/conversation-thread.md §4 +
        // spec/5-system/6-websocket-protocol.md §4.4.5).
        conversationThread: cloneThread(context.conversationThread),
      },
    );

    // Await user submission indefinitely; external cancel is the only exit.
    const formData = await new Promise<unknown>((resolve, reject) => {
      this.pendingContinuations.set(executionId, {
        nodeId: node.id,
        resolve,
        reject,
      });
    });

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
      ...(prevStructured?.meta !== undefined
        ? { meta: prevStructured.meta }
        : {}),
    };
    this.contextService.setStructuredOutput(
      executionId,
      node.id,
      updatedStructured,
    );
    this.contextService.setNodeOutput(
      executionId,
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
      nodeExec.finishedAt = new Date();
      nodeExec.durationMs =
        nodeExec.finishedAt.getTime() - nodeExec.startedAt.getTime();
    }

    // Atomic: NodeExecution COMPLETED + Execution RUNNING (WARN #4)
    await this.updateExecutionStatus(
      savedExecution,
      ExecutionStatus.RUNNING,
      nodeExec ?? undefined,
    );

    if (nodeExec) {
      this.eventEmitter.emitNode(
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
          // sortByStartedAt 정합성).
          startedAt: nodeExec.startedAt?.toISOString?.(),
          finishedAt: nodeExec.finishedAt?.toISOString?.(),
        },
      );
    }
    this.eventEmitter.emitExecution(
      executionId,
      ExecutionEventType.EXECUTION_RESUMED,
      { status: ExecutionStatus.RUNNING },
    );
  }

  /**
   * Resume a paused execution by submitting form data.
   *
   * 다중 인스턴스 환경에서 호출자가 어느 인스턴스로 라우팅됐는지 모르므로,
   * 항상 ContinuationBusService 를 통해 모든 인스턴스에 publish 한다. 실제
   * resolve 는 `pendingContinuations` Map 에 키가 있는 단일 호스팅 인스턴스
   * 에서만 일어난다 (registerContinuationHandlers).
   *
   * "No pending continuation" 즉시 에러는 단일 인스턴스 어디에서도 정확히
   * 판단할 수 없으므로 폐기됐다. WAITING_FOR_INPUT 상태 검증은 publisher
   * 측 (controller / WS gateway) 의 책임이다.
   */
  continueExecution(executionId: string, formData?: unknown): void {
    void this.continuationBus.publish({
      type: 'continue',
      executionId,
      payload: formData,
    });
  }

  /**
   * Cancel a waiting execution by rejecting the pending continuation.
   */
  cancelWaitingExecution(executionId: string): void {
    void this.continuationBus.publish({ type: 'cancel', executionId });
  }

  /**
   * Resume a paused execution by clicking a button.
   * Called from WebSocket handler.
   */
  continueButtonClick(executionId: string, buttonId: string): void {
    void this.continuationBus.publish({
      type: 'button_click',
      executionId,
      payload: { buttonId },
    });
  }

  /**
   * Submit a user message in a multi-turn AI conversation.
   */
  private static readonly MAX_MESSAGE_LENGTH = 10_000;

  continueAiConversation(executionId: string, message: string): void {
    if (message.length > ExecutionEngineService.MAX_MESSAGE_LENGTH) {
      throw new Error(
        `Message exceeds maximum length of ${ExecutionEngineService.MAX_MESSAGE_LENGTH} characters`,
      );
    }
    void this.continuationBus.publish({
      type: 'ai_message',
      executionId,
      payload: { message },
    });
  }

  /**
   * End a multi-turn AI conversation.
   */
  endAiConversation(executionId: string): void {
    void this.continuationBus.publish({
      type: 'ai_end_conversation',
      executionId,
    });
  }

  /**
   * Pause execution at an AI Agent / Information Extractor node in multi-turn
   * mode. Loops: emit AI response → wait for user message → process → repeat.
   * Exits when user ends conversation or handler returns terminal status.
   *
   * WARN #25 (Maintainability) — 본 메서드는 PR-H 에서 4개 sub-method 로 분해
   * 됐다 ({@link emitAiWaitingForInput} / {@link handleAiMessageTurn} /
   * {@link handleAiEndConversation} / {@link finalizeAiNode}). 본 메서드는
   * orchestration (resumeState 준비 + while 루프) 만 담당.
   */
  private async waitForAiConversation(
    savedExecution: Execution,
    executionId: string,
    node: Node,
    context: ExecutionContext,
  ): Promise<void> {
    const nodeOutput = context.nodeOutputCache[node.id] as Record<
      string,
      unknown
    >;
    // WARN #18 — resumeState 가 undefined 일 때 buildConversationMetaFromResumeState
    // 호출이 TypeError 던지던 문제 해소. 핸들러가 _resumeState 를 누락한 비정상
    // 상황에서도 빈 객체로 fallback 하여 nullable propagation 차단.
    let resumeState =
      (nodeOutput._resumeState as Record<string, unknown>) ?? {};

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

    // Conversation loop — exits when user ends OR handler returns terminal.
    let conversationEnded = false;
    while (!conversationEnded) {
      // Wait for user message or end signal (no timeout — external cancel only)
      const userData = await new Promise<unknown>((resolve, reject) => {
        this.pendingContinuations.set(executionId, {
          nodeId: node.id,
          resolve,
          reject,
        });
      });

      const action = userData as Record<string, unknown>;

      if (action.type === 'ai_end_conversation') {
        this.handleAiEndConversation(executionId, node, resumeState);
        conversationEnded = true;
      } else if (action.type === 'ai_message') {
        const turn = await this.handleAiMessageTurn(
          executionId,
          node,
          action.message as string,
          resumeState,
          nodeExec,
        );
        resumeState = turn.resumeState;
        conversationEnded = turn.ended;
      }
    }

    await this.finalizeAiNode(
      savedExecution,
      executionId,
      node,
      context,
      nodeExec,
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

    if (nodeExec) {
      nodeExec.status = NodeExecutionStatus.WAITING_FOR_INPUT;
      // Persist the canonical structured shape (config/output/meta/status)
      // so REST polling reconciliation surfaces a NodeHandler-Output-compliant
      // document. Falls back to the flat cache for legacy in-flight rows.
      // WARN #6 (Security) — _resumeState 는 engine-internal 한 turn debug,
      // model state, rawConfig (잠재 credential 포함) 등을 담으므로 DB 에
      // 저장하지 않는다. Multi-turn 상태는 in-memory nodeOutputCache 에서만
      // 유지되며 server restart 시 recoverStuckExecutions 가 FAILED 로 전환.
      const persistedOutput: Record<string, unknown> = {
        ...(structured ?? nodeOutput),
      };
      delete persistedOutput._resumeState;
      // meta.interactionType='ai_conversation' 명시 — snapshot reconcile 이
      // 정확한 분기로 hydrate.
      nodeExec.outputData = withInteractionMeta(
        persistedOutput,
        'ai_conversation',
      );
    }
    // Atomic: Execution → WAITING_FOR_INPUT + NodeExecution save (WARN #4)
    await this.updateExecutionStatus(
      savedExecution,
      ExecutionStatus.WAITING_FOR_INPUT,
      nodeExec ?? undefined,
    );

    const initialConv = buildConversationConfigFromOutput(structuredOutput);

    this.eventEmitter.emitExecution(
      executionId,
      ExecutionEventType.EXECUTION_WAITING_FOR_INPUT,
      {
        status: ExecutionStatus.WAITING_FOR_INPUT,
        waitingNodeId: node.id,
        waitingNodeType: node.type,
        waitingNodeLabel: node.label ?? node.type,
        nodeExecutionId: nodeExec?.id,
        // 프론트엔드 store 가 NODE_STARTED 를 놓친 경우에도 row 의 startedAt
        // 을 채울 수 있도록 동봉 (sortByStartedAt 정렬 정합성 보장).
        startedAt: nodeExec?.startedAt?.toISOString?.(),
        // 3 waiting emit (Buttons / Form / AI) 모두 top-level interactionType
        // 명시 — frontend 의 handleWaitingForInput 가 첫 fallback 만으로 정확히
        // 분기하도록 일관화. nodeOutput.interactionType 도 backward compat 으로
        // 유지 (snapshot reconcile 의 nested 읽기 / 기존 e2e assertion 안전 보존).
        interactionType: 'ai_conversation',
        // Live thread snapshot for UI (spec/conventions/conversation-thread.md §4
        // + spec/5-system/6-websocket-protocol.md §4.4.5).
        conversationThread: cloneThread(context.conversationThread),
        nodeOutput: {
          interactionType: 'ai_conversation',
          ...(structuredConfig && Object.keys(structuredConfig).length > 0
            ? { config: structuredConfig }
            : {}),
          conversationConfig: initialConv,
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
    node: Node,
    message: string,
    resumeState: Record<string, unknown>,
    nodeExec: NodeExecution | null,
  ): Promise<{ resumeState: Record<string, unknown>; ended: boolean }> {
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
    const result = await handler.processMultiTurnMessage(message, resumeState);
    const resultObj = result as Record<string, unknown>;

    if (resultObj.status === 'waiting_for_input') {
      // Run the canonical adapter once so production-strict validation
      // is enforced and the structured cache stays consistent for the
      // next emit cycle / REST polling reconciliation.
      const adaptedNext = adaptHandlerReturn(result);
      this.contextService.setStructuredOutput(
        executionId,
        node.id,
        adaptedNext,
      );
      const flatNext = this.applyPortSelection(toEngineFlatShape(adaptedNext));
      this.contextService.setNodeOutput(executionId, node.id, flatNext);

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
      // WARN #6 — strip `_resumeState` before persisting. It carries
      // engine-internal turn debug, model state, and rawConfig (potential
      // credentials). Multi-turn state lives in the in-memory cache only;
      // server restart triggers `recoverStuckExecutions` → FAILED.
      if (nodeExec) {
        const persistedOutput: Record<string, unknown> = { ...adaptedNext };
        delete persistedOutput._resumeState;
        nodeExec.outputData = withInteractionMeta(
          persistedOutput,
          'ai_conversation',
        );
        await this.nodeExecutionRepository.save(nodeExec);
      }

      // Update state for next turn
      const nextResumeState = adaptedNext._resumeState as Record<
        string,
        unknown
      >;

      const adaptedOutput = adaptedNext.output as
        | Record<string, unknown>
        | undefined;
      const adaptedConfig = (adaptedNext.config ?? undefined) as
        | Record<string, unknown>
        | undefined;
      const nextConv = buildConversationConfigFromOutput(adaptedOutput);

      // Emit AI response event (filter system prompts from client).
      // Shape mirrors the terminal-emit branch below so the frontend
      // debug timeline (Response / Request / LLM Usage tabs) can match
      // assistant messages to their LLM calls during live waiting too.
      // The earlier flat fields (lastTurnRequest / lastTurnResponse /
      // lastTurnDurationMs on resumeState) are intentionally not emitted —
      // turnDebugHistory's last entry already carries the same data and
      // additionally preserves the per-call sequence in tool loops.
      this.eventEmitter.emitExecution(
        executionId,
        ExecutionEventType.AI_MESSAGE,
        {
          // Sub-Workflow 안에서 같은 nodeId 의 AI Agent 가 여러 번 도달
          // 할 수 있으므로 nodeExecutionId 를 명시 — frontend store 가
          // 정확한 row 에 message 를 라우팅한다.
          nodeExecutionId: nodeExec?.id,
          nodeId: node.id,
          message: nextConv.message,
          turnCount: nextConv.turnCount,
          messages: nextConv.messages,
          metadata: {
            model: nextResumeState.model,
            inputTokens: nextResumeState.totalInputTokens,
            outputTokens: nextResumeState.totalOutputTokens,
          },
          ...buildAiMessageDebugFromResumeState(nextResumeState),
        },
      );

      // Emit waiting_for_input again
      this.eventEmitter.emitExecution(
        executionId,
        ExecutionEventType.EXECUTION_WAITING_FOR_INPUT,
        {
          status: ExecutionStatus.WAITING_FOR_INPUT,
          waitingNodeId: node.id,
          waitingNodeType: node.type,
          waitingNodeLabel: node.label ?? node.type,
          nodeExecutionId: nodeExec?.id,
          // sortByStartedAt 정합성 — store 가 prior NODE_STARTED 를
          // 놓친 시나리오 대비 항상 동봉.
          startedAt: nodeExec?.startedAt?.toISOString?.(),
          // top-level interactionType — emitAiWaitingForInput 와 동일 shape
          // 유지 (multi-turn 후속 waiting emit). nested 도 backward compat 유지.
          interactionType: 'ai_conversation',
          // Live thread snapshot for UI (multi-turn 후속 waiting tick — 새
          // ai_user/ai_assistant turn 이 push 된 직후 UI 가 확인할 수 있도록).
          // handleAiMessageTurn doesn't carry ExecutionContext, so we look it
          // up via contextService — single Map access.
          conversationThread: (() => {
            const t =
              this.contextService.getContext(executionId)?.conversationThread;
            return t ? cloneThread(t) : undefined;
          })(),
          nodeOutput: {
            interactionType: 'ai_conversation',
            // Pass through handler's echoed node config so the Config
            // tab can render during the waiting state. Conversation
            // handlers (AI Agent / Info Extractor multi-turn) add this.
            ...(adaptedConfig && Object.keys(adaptedConfig).length > 0
              ? { config: adaptedConfig }
              : {}),
            conversationConfig: nextConv,
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
    this.eventEmitter.emitExecution(
      executionId,
      ExecutionEventType.AI_MESSAGE,
      {
        // 종료 turn 도 nodeExecutionId 동봉 — Sub-Workflow nesting 에서
        // 같은 nodeId 의 conversation 이 여러 row 일 수 있다.
        nodeExecutionId: nodeExec?.id,
        nodeId: node.id,
        message: responseText,
        turnCount,
        messages: condMessages,
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
    this.contextService.setStructuredOutput(executionId, node.id, adaptedConv);
    const portRouted = this.applyPortSelection(toEngineFlatShape(adaptedConv));
    this.contextService.setNodeOutput(executionId, node.id, portRouted);
    return { resumeState, ended: true };
  }

  /**
   * PR-H — 사용자가 명시적으로 대화 종료 (`ai_end_conversation`) 했을 때.
   * 핸들러의 `endMultiTurnConversation` 호출 → 결과 정규화 → cache 갱신.
   * 핸들러는 `ResumableNodeHandler` 를 구현해야 한다 (CRIT #4).
   */
  private handleAiEndConversation(
    executionId: string,
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
    this.contextService.setStructuredOutput(executionId, node.id, adaptedEnd);
    const flatEnd = toEngineFlatShape(adaptedEnd);
    const routedEnd = this.applyPortSelection(flatEnd);
    this.contextService.setNodeOutput(executionId, node.id, routedEnd);
  }

  /**
   * PR-H — conversation 종료 후 NodeExecution 을 COMPLETED 로 finalize
   * + Execution 을 RUNNING 으로 atomic 전이 (WARN #4) + 클라이언트 emit
   * (`NODE_COMPLETED` + `EXECUTION_RESUMED`).
   *
   * `_resumeState` 는 DB 저장 시 strip (WARN #6 — credential / 내부 state 노출 차단).
   */
  private async finalizeAiNode(
    savedExecution: Execution,
    executionId: string,
    node: Node,
    context: ExecutionContext,
    nodeExec: NodeExecution | null,
  ): Promise<void> {
    if (nodeExec) {
      nodeExec.status = NodeExecutionStatus.COMPLETED;
      // Persist the canonical structured cache. Terminal handler returns
      // (buildMultiTurnFinalOutput / buildConditionOutput / buildErrorOutput)
      // do not carry _resumeState, but defensively strip it in case a future
      // handler bug leaks it.
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
    }

    // Atomic: NodeExecution COMPLETED + Execution RUNNING (WARN #4)
    await this.updateExecutionStatus(
      savedExecution,
      ExecutionStatus.RUNNING,
      nodeExec ?? undefined,
    );

    if (nodeExec) {
      this.eventEmitter.emitNode(
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
    this.eventEmitter.emitExecution(
      executionId,
      ExecutionEventType.EXECUTION_RESUMED,
      { status: ExecutionStatus.RUNNING },
    );
  }

  /**
   * Pause execution at a Presentation node with buttons and wait for user interaction.
   * Transitions Execution → WAITING_FOR_INPUT, emits WS event, awaits Promise.
   * On resume: sets _selectedPort for port routing, transitions back to RUNNING.
   */
  private async waitForButtonInteraction(
    savedExecution: Execution,
    executionId: string,
    node: Node,
    context: ExecutionContext,

    _graphEdges: GraphEdge[],
  ): Promise<void> {
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
    // Atomic: Execution → WAITING_FOR_INPUT + NodeExecution save (WARN #4)
    await this.updateExecutionStatus(
      savedExecution,
      ExecutionStatus.WAITING_FOR_INPUT,
      nodeExec ?? undefined,
    );

    // Emit waiting event so frontend can render buttons
    this.eventEmitter.emitExecution(
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
        // startedAt 이 채워지도록 항상 동봉 — sortByStartedAt 이 startedAt
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

    // Await user button click indefinitely; external cancel is the only exit.
    const clickData = await new Promise<unknown>((resolve, reject) => {
      this.pendingContinuations.set(executionId, {
        nodeId: node.id,
        resolve,
        reject,
      });
    });

    // Process the interaction result
    const click = clickData as {
      type: string;
      buttonId?: string;
      action?: string;
    };
    const now = new Date().toISOString();

    let selectedPort: string;
    let interactionData: Record<string, unknown>;
    let updatedOutput: Record<string, unknown>;

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

    // `interactionData` carries the legacy wire-shape (interactionType +
    // flat fields) used by the WS button event. `structuredInteraction`
    // carries the unified `{type, data, receivedAt}` shape exposed through
    // `$node["X"].output.interaction.*` (CONVENTIONS §4.5).
    let structuredInteraction: {
      type:
        | 'form_submitted'
        | 'button_click'
        | 'button_continue'
        | 'message_received';
      data: Record<string, unknown>;
      receivedAt: string;
    };

    if (click.type === 'button_click') {
      const buttonId = click.buttonId!;
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

    // Update node output cache with port selection. The flat-shape
    // `updatedOutput` carries `_selectedPort` so existing routing logic
    // (applyPortSelection / hasPortMismatch / stripControlFields) keeps
    // operating without changes.
    this.contextService.setNodeOutput(executionId, node.id, updatedOutput);

    // Mirror the interaction result into the structured NodeHandlerOutput
    // cache so `$node["<label>"].output.interaction.buttonId` and
    // `.output.selectedItem` resolve predictably. `setNodeOutput` above
    // already derived a legacy structured view; we overwrite it with a
    // richer shape that preserves the handler's original `config`/`meta`.
    const prevStructured = context.structuredOutputCache?.[node.id];
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
    const updatedStructured: NodeHandlerOutput = {
      config: prevConfig,
      output: structuredOutputPayload,
      port: selectedPort,
      status: 'resumed',
      ...(prevMeta !== undefined ? { meta: prevMeta } : {}),
    };
    this.contextService.setStructuredOutput(
      executionId,
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
    await this.updateExecutionStatus(
      savedExecution,
      ExecutionStatus.RUNNING,
      nodeExec ?? undefined,
    );

    if (nodeExec) {
      this.eventEmitter.emitNode(
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
    this.eventEmitter.emitExecution(
      executionId,
      ExecutionEventType.EXECUTION_RESUMED,
      { status: ExecutionStatus.RUNNING },
    );
  }

  /**
   * 단일 노드의 핸들러를 실행하고 결과를 컨텍스트 / DB / WS 로 전파한다.
   *
   * 책임 (`runExecution` / `executeInline` / `executeContainerBody` 가 호출):
   *
   *  1. NodeExecution 생성 (RUNNING) + `NODE_STARTED` emit
   *  2. 노드 config 의 expression 평가 → resolvedConfig
   *  3. handler.validate (필요 시) — INVALID_NODE_CONFIG throw
   *  4. handler.execute(input, resolvedConfig, context) 를 retry 정책과 함께 호출
   *  5. 반환값을 `adaptHandlerReturn` 으로 canonical NodeHandlerOutput 정규화
   *     (credential 자동 마스킹 — INFO #5)
   *  6. nodeOutputCache / structuredOutputCache 갱신, NodeExecution finalize,
   *     `NODE_COMPLETED` emit
   *  7. error 시 ErrorPolicyHandler 위임 → SKIP / FAIL / STOP_WORKFLOW
   *
   * @param executionId    부모 Execution UUID (NodeExecution 귀속, WS 채널)
   * @param node           실행할 노드 entity (type, config, label, category)
   * @param nodeInput      gatherNodeInput 으로 수집된 입력 (이전 노드 출력 합집합)
   * @param context        ExecutionContext — variables / nodeOutputCache / itemContext / ...
   * @param executedNodes  본 실행에서 이미 완료된 노드 id 집합 (중복 실행 차단)
   * @param nodeMap        $node expression 해석용 (target workflow 한정)
   * @param executionMeta  startedAt / mode (replay / live)
   *
   * blocking 노드 (form/buttons/ai_conversation) 의 waiting 진입은 본 메서드가
   * 아니라 호출 측 (waitForFormSubmission / waitForButtonInteraction /
   * waitForAiConversation) 가 별도로 다룬다.
   */
  private async executeNode(
    executionId: string,
    node: Node,
    nodeInput: unknown,
    context: ExecutionContext,
    executedNodes: Set<string>,
    nodeMap?: Map<string, Node>,
    executionMeta?: { startedAt?: string; mode?: string },
  ): Promise<void> {
    const nodeExecution = await this.createNodeExecution(
      executionId,
      node.id,
      NodeExecutionStatus.RUNNING,
      context.parentNodeExecutionId,
      nodeInput,
    );
    this.eventEmitter.emitNode(
      executionId,
      node.id,
      NodeEventType.NODE_STARTED,
      {
        // Surface the DB row id so the frontend can distinguish iterations of
        // the same body node — without this, multiple runs of the same nodeId
        // collapse into one entry in the run-results timeline.
        nodeExecutionId: nodeExecution.id,
        // Sub-Workflow grouping: when the node runs inside an inline
        // Sub-Workflow, the frontend uses this to nest it under the
        // invoking Sub-Workflow row as a card child.
        parentNodeExecutionId: context.parentNodeExecutionId,
        status: NodeExecutionStatus.RUNNING,
        nodeType: node.type,
        nodeLabel: node.label ?? node.type,
        // Resolved predecessor input — included so the frontend can show
        // input data on the detail panel without a separate REST refetch.
        input: nodeInput,
        startedAt: nodeExecution.startedAt?.toISOString?.(),
      },
    );

    try {
      // Get handler
      const handler = this.handlerRegistry.get(node.type);

      // Validate config
      const validationResult = handler.validate(node.config);
      if (!validationResult.valid) {
        // AI 노드의 'no-llm-provider' 규칙은 schema-level 에서 워크스페이스
        // 컨텍스트를 알 수 없어 항상 발사된다. 프론트엔드 캔버스가
        // hasDefaultLlmConfig 으로 경고를 억제하는 것과 동일한 의미를
        // 실행 시점에 부여하기 위해 워크스페이스에 기본 LLM 이 등록돼 있다면
        // 이 메시지만 필터링한다. 다른 종류의 에러가 함께 있으면 그대로 throw.
        const filteredErrors = await this.filterAiNoLlmProviderError(
          node.type,
          validationResult.errors,
          context,
        );
        if (filteredErrors.length > 0) {
          // noinspection ExceptionCaughtLocallyJS — intentional: delegates to the catch block's error policy handler
          throw new Error(`INVALID_NODE_CONFIG: ${filteredErrors.join(', ')}`);
        }
      }

      // Resolve expressions in config
      let resolvedConfig: Record<string, unknown>;
      let exprContextForNode: Record<string, unknown> | undefined;
      if (nodeMap) {
        const exprContext = this.expressionResolver.buildExpressionContext(
          nodeInput,
          context,
          nodeMap,
          executionMeta,
        );

        // For template nodes, spread input data as root-level variables
        // so that {{ name }} works in addition to {{ $input.name }}.
        // This must run after buildExpressionContext() which populates
        // the built-in $-prefixed variables that take precedence.
        if (
          node.type === NODE_TYPES.TEMPLATE &&
          typeof nodeInput === 'object' &&
          nodeInput !== null &&
          !Array.isArray(nodeInput)
        ) {
          for (const [key, value] of Object.entries(
            nodeInput as Record<string, unknown>,
          )) {
            if (!Object.hasOwn(exprContext, key)) {
              exprContext[key] = value;
            }
          }
        }

        resolvedConfig = this.expressionResolver.resolveConfig(
          node.config,
          exprContext,
          node.type,
        );

        exprContextForNode = exprContext;
      } else {
        resolvedConfig = node.config;
      }

      // INFO #7 — 3개로 분리돼 있던 nodeContext 스프레드를 단일 spread 로 병합
      // (중간 객체 2개 생성 제거).
      //
      // 포함되는 필드:
      // - `expressionContext` — 핸들러가 per-item 평가를 다시 수행할 때 사용 (Table 등)
      // - `rawConfig` — ENG-RC-* / CONVENTIONS Principle 7. 핸들러가 NodeHandlerOutput.config
      //   echo 시 사용할 **원본(pre-evaluation) config**. shallow `Object.freeze` 로
      //   top-level mutation 차단 (중첩 객체는 read-only 로 다루어야 함; 필요 시
      //   structuredClone 복제). spec: 4-execution-engine.md §5.5 / §6.1
      // - `nodeId` / `nodeExecutionId` — 핸들러가 부수효과를 행/노드에 귀속 (IntegrationUsageLog,
      //   AI Agent tool_call_* WS 이벤트 키 등)
      const nodeContext: ExecutionContext = {
        ...context,
        ...(exprContextForNode
          ? { expressionContext: exprContextForNode }
          : {}),
        rawConfig: Object.freeze({ ...(node.config ?? {}) }),
        nodeId: node.id,
        nodeExecutionId: nodeExecution.id,
      };

      // Execute with potential retry
      const output = await this.executeWithRetry(
        handler,
        nodeInput,
        resolvedConfig,
        nodeContext,
        node,
        nodeExecution,
      );

      // Normalize handler return into the unified NodeHandlerOutput shape.
      // Structured cache powers `$node[X].config/.output/.meta/.port/.status`
      // expressions; the flat cache preserves pre-migration engine internals.
      const adapted = adaptHandlerReturn(output);
      this.contextService.setStructuredOutput(executionId, node.id, adapted);
      // Echo channel (structured.config = raw per Principle 7) and engine-
      // side action-parameter channel are now separated. Container paths
      // (runContainer/runParallel) read the evaluated snapshot from this
      // cache instead of `structured.config`, which would otherwise be raw
      // `{{...}}` and Number()/typeof checks would fail (Loop count → NaN,
      // Parallel branchCount → silent default).
      this.contextService.setEngineResolvedConfig(
        executionId,
        node.id,
        resolvedConfig,
      );
      const flatForCache = toEngineFlatShape(adapted);

      // If handler returned port-based output ({ port, data }), set _selectedPort
      // so that downstream routing filters edges correctly.
      const finalOutput = this.applyPortSelection(flatForCache);
      this.contextService.setNodeOutput(executionId, node.id, finalOutput);
      executedNodes.add(node.id);

      // Check if this is a blocking node (waiting_for_input).
      // If so, defer NODE_COMPLETED — it will be emitted after user interaction.
      // Emitting it now would cause the frontend to mark the node as done
      // before the WAITING_FOR_INPUT event arrives.
      const isBlocking =
        output &&
        typeof output === 'object' &&
        (output as Record<string, unknown>).status === 'waiting_for_input';

      if (!isBlocking) {
        // Update node execution record
        nodeExecution.status = NodeExecutionStatus.COMPLETED;
        nodeExecution.outputData = (output as Record<string, unknown>) ?? {};
        nodeExecution.finishedAt = new Date();
        nodeExecution.durationMs =
          nodeExecution.finishedAt.getTime() -
          nodeExecution.startedAt.getTime();
        await this.nodeExecutionRepository.save(nodeExecution);
        this.eventEmitter.emitNode(
          executionId,
          node.id,
          NodeEventType.NODE_COMPLETED,
          {
            nodeExecutionId: nodeExecution.id,
            parentNodeExecutionId: context.parentNodeExecutionId,
            status: NodeExecutionStatus.COMPLETED,
            duration: nodeExecution.durationMs,
            nodeType: node.type,
            nodeLabel: node.label ?? node.type,
            output: nodeExecution.outputData,
            input: nodeExecution.inputData,
            startedAt: nodeExecution.startedAt?.toISOString?.(),
            finishedAt: nodeExecution.finishedAt?.toISOString?.(),
          },
        );
      } else {
        // Save output for blocking nodes (waitForButtonInteraction will update status)
        nodeExecution.outputData = (output as Record<string, unknown>) ?? {};
        await this.nodeExecutionRepository.save(nodeExecution);
      }

      // Update execution path — serialized per execution to tolerate
      // ParallelExecutor branches finishing concurrently.
      await this.appendExecutionPath(executionId, node.id);
    } catch (error: unknown) {
      // Apply error policy
      const errorPolicyConfig = this.getErrorPolicyConfig(node);
      const result = this.errorPolicyHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        errorPolicyConfig,
        nodeExecution.retryCount,
      );

      switch (result.action) {
        case 'skip':
          nodeExecution.status = NodeExecutionStatus.SKIPPED;
          nodeExecution.error = {
            message: error instanceof Error ? error.message : String(error),
          };
          nodeExecution.finishedAt = new Date();
          nodeExecution.durationMs =
            nodeExecution.finishedAt.getTime() -
            nodeExecution.startedAt.getTime();
          await this.nodeExecutionRepository.save(nodeExecution);
          this.eventEmitter.emitNode(
            executionId,
            node.id,
            NodeEventType.NODE_SKIPPED,
            {
              nodeExecutionId: nodeExecution.id,
              parentNodeExecutionId: context.parentNodeExecutionId,
              status: NodeExecutionStatus.SKIPPED,
              nodeType: node.type,
              nodeLabel: node.label ?? node.type,
              error: nodeExecution.error.message,
              input: nodeExecution.inputData,
              startedAt: nodeExecution.startedAt?.toISOString?.(),
              finishedAt: nodeExecution.finishedAt?.toISOString?.(),
            },
          );
          executedNodes.add(node.id);
          break;

        case 'use_default':
          this.contextService.setNodeOutput(
            executionId,
            node.id,
            result.output,
          );
          nodeExecution.status = NodeExecutionStatus.COMPLETED;
          nodeExecution.outputData =
            (result.output as Record<string, unknown>) ?? {};
          nodeExecution.finishedAt = new Date();
          nodeExecution.durationMs =
            nodeExecution.finishedAt.getTime() -
            nodeExecution.startedAt.getTime();
          await this.nodeExecutionRepository.save(nodeExecution);
          executedNodes.add(node.id);
          break;

        case 'route_error':
          this.contextService.setNodeOutput(
            executionId,
            node.id,
            result.output,
          );
          nodeExecution.status = NodeExecutionStatus.FAILED;
          nodeExecution.error = {
            message: error instanceof Error ? error.message : String(error),
          };
          nodeExecution.finishedAt = new Date();
          nodeExecution.durationMs =
            nodeExecution.finishedAt.getTime() -
            nodeExecution.startedAt.getTime();
          await this.nodeExecutionRepository.save(nodeExecution);
          executedNodes.add(node.id);
          break;

        case 'stop':
        default:
          nodeExecution.status = NodeExecutionStatus.FAILED;
          nodeExecution.error = {
            message: error instanceof Error ? error.message : String(error),
          };
          nodeExecution.finishedAt = new Date();
          nodeExecution.durationMs =
            nodeExecution.finishedAt.getTime() -
            nodeExecution.startedAt.getTime();
          await this.nodeExecutionRepository.save(nodeExecution);
          this.eventEmitter.emitNode(
            executionId,
            node.id,
            NodeEventType.NODE_FAILED,
            {
              nodeExecutionId: nodeExecution.id,
              parentNodeExecutionId: context.parentNodeExecutionId,
              status: NodeExecutionStatus.FAILED,
              error: error instanceof Error ? error.message : String(error),
              nodeType: node.type,
              nodeLabel: node.label ?? node.type,
              input: nodeExecution.inputData,
              startedAt: nodeExecution.startedAt?.toISOString?.(),
              finishedAt: nodeExecution.finishedAt?.toISOString?.(),
            },
          );
          throw error;
      }
    }
  }

  /**
   * AI 노드(ai_agent / text_classifier / information_extractor) 의 schema 가
   * declarative 로 fire 시키는 `no-llm-provider` 메시지를, 워크스페이스에 기본
   * LLM 이 등록돼 있을 때 한정해 필터링한다.
   *
   * 캔버스에서 hasDefaultLlmConfig === true 일 때 동일 경고를 억제하는 것과
   * 의미를 일치시키기 위함이다. 다른 에러 메시지가 함께 있으면 그대로 두고,
   * 후처리 후에도 남은 에러가 있으면 호출부에서 INVALID_NODE_CONFIG 로 throw 한다.
   *
   * @param nodeType 노드 타입 (AI 노드 3종이 아니면 즉시 통과)
   * @param errors handler.validate 가 반환한 blocking error 배열
   * @param context 실행 컨텍스트. `variables.__workspaceId` 에서 워크스페이스
   *   ID 를 읽는다. 이 필드는 `runExecution` 이 DB 의 `workflow.workspaceId`
   *   로부터 직접 채우며 (server-trusted), 사용자 입력으로 덮어쓰지 않는다 —
   *   AI 핸들러들도 동일 출처를 쓴다.
   *
   * Fail-safe: hasDefaultLlmConfig 호출이 throw 하면 원본 errors 를 그대로
   * 반환해 INVALID_NODE_CONFIG 가 정상 발사되도록 한다 (DB 장애가 노드 실행
   * 오류로 "변형" 되는 것을 막는다 — 명시적 검증 실패가 더 안전).
   *
   * 캐싱: 동일 실행 안에서 N 개 AI 노드가 들어있어도 DB findDefault 는 1 회만
   * 일어나도록 `context.variables[__hasDefaultLlmConfig:<wsId>]` 에 결과를
   * 메모이즈한다 (N+1 회피).
   */
  private async filterAiNoLlmProviderError(
    nodeType: string,
    errors: string[],
    context: ExecutionContext,
  ): Promise<string[]> {
    if (!AI_LLM_PROVIDER_NODE_TYPES.has(nodeType)) return errors;
    if (!errors.includes(AI_NO_LLM_PROVIDER_MESSAGE)) return errors;
    const workspaceId =
      (context.variables?.__workspaceId as string | undefined) || '';
    if (!workspaceId) return errors;
    let hasDefault: boolean;
    try {
      hasDefault = await this.resolveHasDefaultLlmConfigCached(
        workspaceId,
        context,
      );
    } catch (e) {
      this.logger.warn(
        `filterAiNoLlmProviderError: hasDefaultLlmConfig lookup failed (workspaceId=${workspaceId}); keeping original validation errors. ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      return errors;
    }
    if (!hasDefault) return errors;
    return errors.filter((err) => err !== AI_NO_LLM_PROVIDER_MESSAGE);
  }

  private async resolveHasDefaultLlmConfigCached(
    workspaceId: string,
    context: ExecutionContext,
  ): Promise<boolean> {
    // INFO #10 — 인스턴스 필드 캐시 (executionId:workspaceId) 로 parallel
    // 브랜치 간 single-flight 보장. context.variables 캐시 (deep clone 영향)
    // 의 한계 회피.
    const cacheKey = `${context.executionId}:${workspaceId}`;
    const existing = this.llmDefaultConfigCache.get(cacheKey);
    if (existing) return existing;
    const promise = this.llmService.hasDefaultLlmConfig(workspaceId);
    this.llmDefaultConfigCache.set(cacheKey, promise);
    return promise;
  }

  /**
   * INFO #10 — `runExecution` 의 finally 에서 호출. 본 실행에 속한 캐시 항목
   * 을 일괄 정리하여 장기 메모리 누수를 차단한다.
   */
  private clearLlmDefaultConfigCache(executionId: string): void {
    const prefix = `${executionId}:`;
    for (const key of this.llmDefaultConfigCache.keys()) {
      if (key.startsWith(prefix)) {
        this.llmDefaultConfigCache.delete(key);
      }
    }
  }

  private async executeWithRetry(
    handler: NodeHandler,
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
    node: Node,
    nodeExecution: NodeExecution,
  ): Promise<unknown> {
    const errorPolicyConfig = this.getErrorPolicyConfig(node);

    if (errorPolicyConfig.policy !== 'retry') {
      return handler.execute(input, config, context);
    }

    const retryConfig = errorPolicyConfig.retryConfig ?? {
      maxRetries: 3,
      retryInterval: 1000,
      backoffMultiplier: 2,
    };

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        return await handler.execute(input, config, context);
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        nodeExecution.retryCount = attempt + 1;

        if (attempt < retryConfig.maxRetries) {
          const delay =
            retryConfig.retryInterval *
            Math.pow(retryConfig.backoffMultiplier, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error('All retry attempts exhausted');
  }

  private getErrorPolicyConfig(node: Node): ErrorPolicyConfig {
    const config = node.config ?? {};
    const errorHandling = config['errorHandling'] as
      | Record<string, unknown>
      | undefined;

    if (!errorHandling) {
      return { policy: 'stop_workflow' };
    }

    return {
      policy:
        (errorHandling['policy'] as ErrorPolicyConfig['policy']) ??
        'stop_workflow',
      defaultOutput: errorHandling['defaultOutput'],
      retryConfig: errorHandling['retryConfig'] as
        | ErrorPolicyConfig['retryConfig']
        | undefined,
    };
  }

  private gatherNodeInput(
    nodeId: string,
    edges: GraphEdge[],
    executedNodes: Set<string>,
    nodeOutputCache: Record<string, unknown>,
    workflowInput: unknown,
    incomingEdgeMap?: Map<string, GraphEdge[]>,
  ): unknown {
    // Prefer pre-built map (O(1) lookup) — caller threads it from
    // runExecution / executeInline / planContainerBody startup. Fallback to
    // O(M) filter for legacy call sites that haven't been migrated.
    const incomingEdges =
      incomingEdgeMap?.get(nodeId) ??
      edges.filter((e) => e.targetNodeId === nodeId);

    if (incomingEdges.length === 0) {
      // Start node - use workflow input
      return workflowInput;
    }

    if (incomingEdges.length === 1) {
      const sourceId = incomingEdges[0].sourceNodeId;
      if (executedNodes.has(sourceId)) {
        const sourceOutput = nodeOutputCache[sourceId];
        // Port-aware filtering: if source has _selectedPort, only pass data
        // if the edge's sourcePort matches the selected port
        if (
          this.graphTraversal.isPortFiltered(
            sourceOutput,
            incomingEdges[0].sourcePort,
          )
        ) {
          return undefined;
        }
        return this.stripControlFields(sourceOutput);
      }
      // No executed predecessor (e.g., back-edge target on first run) → use workflow input
      return workflowInput;
    }

    // Multiple inputs - merge into object keyed by source node ID
    const merged: Record<string, unknown> = {};
    let hasAnyInput = false;
    for (const edge of incomingEdges) {
      if (executedNodes.has(edge.sourceNodeId)) {
        const sourceOutput = nodeOutputCache[edge.sourceNodeId];
        // Port-aware filtering for multi-input nodes
        if (this.graphTraversal.isPortFiltered(sourceOutput, edge.sourcePort)) {
          continue;
        }
        merged[edge.sourceNodeId] = this.stripControlFields(sourceOutput);
        hasAnyInput = true;
      }
    }
    // If no predecessor has produced output yet (e.g., all incoming are back-edges
    // and none have executed), fall back to workflow input
    return hasAnyInput ? merged : workflowInput;
  }

  /**
   * If a handler returned { port, data, ... }, convert to { ...data, _selectedPort }
   * so downstream routing can filter edges by port.
   * Extra root-level fields (e.g. expression, value) are preserved for the execution record.
   *
   * **Array guard**: 5필드 모델(`{config, output, port, ...}`)에서 user 가
   * `output: { data: [array] }` 처럼 `data` 키 (배열) 를 직접 사용하는 경우,
   * `toEngineFlatShape` 가 envelope 의 `output` 키를 spread 해 `{ data: [array],
   * port }` 형태로 만든다. 그러면 본 함수가 legacy `{port, data}` envelope 으로
   * 오인하고 `{...data}` 로 array 를 인덱스 키로 spread (`{0: ..., 1: ...}`).
   * 그 결과 다음 노드 input 이 깨진 객체로 도착해 `dataField='data'` 추출이 실패.
   * 따라서 **`data` 가 plain object 일 때만 unwrap**, array/primitive 는 `data`
   * 키 그대로 보존하고 `port → _selectedPort` 만 변환.
   */
  private applyPortSelection(output: unknown): unknown {
    if (
      output &&
      typeof output === 'object' &&
      !Array.isArray(output) &&
      'port' in output &&
      'data' in output
    ) {
      const { port, data, ...extra } = output as Record<string, unknown>;
      // Legacy {port, data} envelope: data 가 plain object 일 때만 unwrap.
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const base = data as Record<string, unknown>;
        return { ...base, ...extra, _selectedPort: port };
      }
      // data 가 array / primitive / null: unwrap 시 array spread 가 발생해
      // next input 이 `{0:..., 1:...}` 로 깨지므로 키 보존.
      return { ...extra, data, _selectedPort: port };
    }
    return output;
  }

  /**
   * Strip routing / lifecycle control fields from output before passing it
   * as input to the next node.
   *
   * These fields are metadata for the current node's engine-level bookkeeping
   * and must not leak into downstream `$input`:
   *  - `_selectedPort`: routing marker for the current node's outgoing edges.
   *    Leaking it causes pass-through successors (e.g. Variable) to have
   *    their own successors incorrectly skipped.
   *  - `port`: handler's declared output port. Leaking it into downstream
   *    `output: input` pass-throughs makes the adapter think a stale port
   *    is the new node's routing decision.
   *  - `status`: lifecycle marker (`waiting_for_input` / `resumed` / `ended`).
   *    Leaking `"resumed"` confuses blocking detection on successors.
   *  - `_resumeState`: per-node interaction state. Strictly owned by the
   *    node that emitted it.
   *
   * The `structuredOutputCache` (what `$node["X"].port` resolves against)
   * is not touched — downstream expressions can still read the predecessor's
   * control fields explicitly by node reference.
   */
  private stripControlFields(output: unknown): unknown {
    if (!output || typeof output !== 'object' || Array.isArray(output)) {
      return output;
    }
    const o = output as Record<string, unknown>;
    if (
      !('_selectedPort' in o) &&
      !('port' in o) &&
      !('status' in o) &&
      !('_resumeState' in o)
    ) {
      return output;
    }
    const {
      _selectedPort: _sp,
      port: _p,
      status: _st,
      _resumeState: _rs,
      ...rest
    } = o;
    void _sp;
    void _p;
    void _st;
    void _rs;
    return rest;
  }

  /**
   * Check if any back-edge from the given source node should be activated.
   * A back-edge is activated when its sourcePort matches the selected port
   * (or the source has no port selection at all).
   */
  private findActivatedBackEdge(
    sourceNodeId: string,
    backEdges: Array<{ edge: GraphEdge; targetIndex: number }>,
    nodeOutputCache: Record<string, unknown>,
  ): { edge: GraphEdge; targetIndex: number } | null {
    const sourceOutput = nodeOutputCache[sourceNodeId];
    for (const backEdge of backEdges) {
      if (
        !this.graphTraversal.isPortFiltered(
          sourceOutput,
          backEdge.edge.sourcePort,
        )
      ) {
        return backEdge;
      }
    }
    return null;
  }

  /**
   * CRIT #2 — disabled 노드 SKIPPED 처리 공통화. NodeExecution 생성 → SKIPPED
   * mark → WS emit → executedNodes 등록까지 양 경로가 정확히 동일했다.
   */
  private async handleDisabledNode(
    executionId: string,
    nodeId: string,
    node: Node,
    context: ExecutionContext,
    executedNodes: Set<string>,
  ): Promise<void> {
    const skipped = await this.createNodeExecution(
      executionId,
      nodeId,
      NodeExecutionStatus.SKIPPED,
      context.parentNodeExecutionId,
    );
    this.eventEmitter.emitNode(
      executionId,
      nodeId,
      NodeEventType.NODE_SKIPPED,
      {
        nodeExecutionId: skipped.id,
        parentNodeExecutionId: context.parentNodeExecutionId,
        status: NodeExecutionStatus.SKIPPED,
        nodeType: node.type,
        nodeLabel: node.label ?? node.type,
        startedAt: skipped.startedAt?.toISOString?.(),
      },
    );
    executedNodes.add(nodeId);
  }

  /**
   * Execute the body subgraph of a container node for a single iteration.
   *
   * Phase 1 behavior:
   * - Runs the body children in topological order.
   * - Supports port-based routing and unreachable branch skipping.
   * - Does NOT support back-edges inside the body or blocking nodes
   *   (form/buttons/ai_conversation) — both raise an error if encountered.
   * - Collects leaf-node outputs per spec §3.1.2: single leaf → value as-is,
   *   multiple leaves → merged object keyed by nodeId. Phase 2 replaces this
   *   with explicit emit-port collection.
   */
  private async executeContainerBody(
    containerNode: Node,
    plan: ContainerBodyPlan,
    context: ExecutionContext,
    executionId: string,
    executedNodes: Set<string>,
    executionMeta: { startedAt?: string; mode?: string },
    iterInput: unknown,
  ): Promise<unknown> {
    const {
      childIds,
      bodyEntryNodeIds,
      emitSourceNodeId,
      internalEdges,
      sortedNodeIds,
      outgoingEdgeMap,
      nodeMap,
    } = plan;
    if (sortedNodeIds.length === 0) {
      return undefined;
    }

    // Seed reachability: body entry nodes OR (if none via port) children
    // with no incoming internal edge.
    const reachable = new Set<string>();
    if (bodyEntryNodeIds.size > 0) {
      for (const id of bodyEntryNodeIds) {
        if (childIds.has(id)) reachable.add(id);
      }
    } else {
      const childrenWithIncoming = new Set(
        internalEdges.map((e) => e.targetNodeId),
      );
      for (const id of sortedNodeIds) {
        if (!childrenWithIncoming.has(id)) reachable.add(id);
      }
    }

    for (const nodeId of sortedNodeIds) {
      if (!reachable.has(nodeId)) continue;
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      if (node.isDisabled) {
        const skipped = await this.createNodeExecution(
          executionId,
          nodeId,
          NodeExecutionStatus.SKIPPED,
          context.parentNodeExecutionId,
        );
        this.eventEmitter.emitNode(
          executionId,
          nodeId,
          NodeEventType.NODE_SKIPPED,
          {
            nodeExecutionId: skipped.id,
            parentNodeExecutionId: context.parentNodeExecutionId,
            status: NodeExecutionStatus.SKIPPED,
            nodeType: node.type,
            nodeLabel: node.label ?? node.type,
            startedAt: skipped.startedAt?.toISOString?.(),
          },
        );
        executedNodes.add(nodeId);
        continue;
      }

      const nodeInput = this.gatherNodeInput(
        nodeId,
        internalEdges,
        executedNodes,
        context.nodeOutputCache,
        iterInput,
      );

      await this.executeNode(
        executionId,
        node,
        nodeInput,
        context,
        executedNodes,
        nodeMap,
        executionMeta,
      );

      const nodeOutput = context.nodeOutputCache[node.id] as
        | Record<string, unknown>
        | undefined;
      if (nodeOutput?.status === 'waiting_for_input') {
        throw new Error(
          `Blocking node "${node.label ?? node.type}" inside container "${containerNode.label ?? containerNode.type}" is not supported.`,
        );
      }

      this.graphTraversal.propagateReachability(
        nodeId,
        outgoingEdgeMap,
        context.nodeOutputCache,
        reachable,
      );
    }

    // If the emit source didn't run this iteration (e.g. port routing
    // short-circuited before reaching it), there is no collectable value.
    // Returning undefined avoids leaking stale output from a previous iter.
    if (!reachable.has(emitSourceNodeId)) {
      return undefined;
    }
    return context.nodeOutputCache[emitSourceNodeId];
  }

  /**
   * Resolve the container body plan: child nodes, internal edges, body entry
   * points, emit source. Validated once at the start of {@link runContainer}
   * so every iteration shares the same wiring and errors surface upfront.
   */
  /**
   * Walk the containerId chain from each container's children upward to make
   * sure no container is its own (transitive) ancestor. Throws when a cycle
   * is found so the engine surfaces a stable, named error instead of looping.
   */
  private assertNoContainerCycle(containerNode: Node, allNodes: Node[]): void {
    const byId = new Map(allNodes.map((n) => [n.id, n]));
    for (const node of allNodes) {
      if (node.containerId !== containerNode.id) continue;
      const visited = new Set<string>();
      let cursor: Node | undefined = node;
      while (cursor?.containerId) {
        if (visited.has(cursor.id)) {
          throw new Error(
            `CONTAINER_CYCLE: Container "${containerNode.label ?? containerNode.type}" is part of a containerId cycle involving node "${cursor.label ?? cursor.type}".`,
          );
        }
        visited.add(cursor.id);
        cursor = byId.get(cursor.containerId);
      }
    }
  }

  private planContainerBody(
    containerNode: Node,
    allNodes: Node[],
    allEdges: Edge[],
  ): ContainerBodyPlan {
    // Detect a containerId cycle (e.g. A.containerId=B && B.containerId=A)
    // before doing any work so the user gets a clear error instead of an
    // infinite loop or stack overflow.
    this.assertNoContainerCycle(containerNode, allNodes);

    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
    const children = allNodes.filter((n) => n.containerId === containerNode.id);
    const childIds = new Set(children.map((c) => c.id));

    // Trigger nodes can never live inside a container body — their semantics
    // (workflow entry point) conflict with iterative re-execution.
    const triggerChild = children.find(
      (n) => n.category === NodeCategory.TRIGGER,
    );
    if (triggerChild) {
      throw new Error(
        `CONTAINER_INVALID_CHILD: Trigger node "${triggerChild.label ?? triggerChild.type}" cannot be placed inside container "${containerNode.label ?? containerNode.type}".`,
      );
    }

    const bodyEntryNodeIds = new Set(
      allEdges
        .filter(
          (e) => e.sourceNodeId === containerNode.id && e.sourcePort === 'body',
        )
        .map((e) => e.targetNodeId),
    );

    // Emit edges: source is a child, target is the container itself with
    // targetPort='emit'. Exactly one is required — multiple or zero would
    // be ambiguous and are rejected upfront.
    const emitEdges = allEdges.filter(
      (e) =>
        e.targetNodeId === containerNode.id &&
        e.targetPort === 'emit' &&
        childIds.has(e.sourceNodeId),
    );
    if (emitEdges.length === 0) {
      // Distinguish "wire missing" from "wire present but the source isn't
      // tagged as a body child" — the latter is the more common gotcha and
      // pointing the user at the offending node + container assignment helps
      // them recover quickly.
      const orphanEmitEdges = allEdges.filter(
        (e) => e.targetNodeId === containerNode.id && e.targetPort === 'emit',
      );
      if (orphanEmitEdges.length > 0) {
        const sourceLabels = orphanEmitEdges
          .map((e) => {
            const sourceNode = nodeMap.get(e.sourceNodeId);
            return sourceNode?.label ?? sourceNode?.type ?? e.sourceNodeId;
          })
          .join(', ');
        throw new Error(
          `CONTAINER_MISSING_EMIT: Container "${containerNode.label ?? containerNode.type}" has an "emit" wire from "${sourceLabels}" but that node isn't a body child of this container. Open its settings panel and set its "Container" to "${containerNode.label ?? containerNode.type}".`,
        );
      }
      throw new Error(
        `CONTAINER_MISSING_EMIT: Container "${containerNode.label ?? containerNode.type}" has no body node wired to its "emit" port. Connect the node whose output should be collected.`,
      );
    }
    if (emitEdges.length > 1) {
      throw new Error(
        `CONTAINER_MULTIPLE_EMIT: Container "${containerNode.label ?? containerNode.type}" has ${emitEdges.length} nodes wired to its "emit" port. Only one emit source is allowed.`,
      );
    }
    const emitSourceNodeId = emitEdges[0].sourceNodeId;

    const internalEdges: GraphEdge[] = allEdges
      .filter(
        (e) => childIds.has(e.sourceNodeId) && childIds.has(e.targetNodeId),
      )
      .map((e) => ({
        sourceNodeId: e.sourceNodeId,
        sourcePort: e.sourcePort,
        targetNodeId: e.targetNodeId,
        targetPort: e.targetPort,
      }));

    const graphNodes = children.map((n) => ({ id: n.id }));
    const { forwardEdges, backEdges } = identifyBackEdges(
      graphNodes,
      internalEdges,
    );
    if (backEdges.length > 0) {
      throw new Error(
        `Container "${containerNode.label ?? containerNode.type}" body contains back-edges, which are not yet supported inside containers.`,
      );
    }
    const sortedNodeIds = topologicalSort(graphNodes, forwardEdges);

    const outgoingEdgeMap = new Map<string, GraphEdge[]>();
    for (const edge of internalEdges) {
      const list = outgoingEdgeMap.get(edge.sourceNodeId) ?? [];
      list.push(edge);
      outgoingEdgeMap.set(edge.sourceNodeId, list);
    }

    return {
      childIds,
      bodyEntryNodeIds,
      emitSourceNodeId,
      internalEdges,
      sortedNodeIds,
      outgoingEdgeMap,
      nodeMap,
    };
  }

  /**
   * After a Background node executes (handler returned `port: 'main'`),
   * snapshot the current execution context and enqueue the `background`-port
   * body subgraph for asynchronous execution. The main flow continues without
   * waiting. Failures inside the body never affect the main execution.
   */
  private async scheduleBackgroundBody(
    node: Node,
    allEdges: Edge[],
    context: ExecutionContext,
    executionId: string,
    mainInput: unknown,
  ): Promise<void> {
    const bodyEntryNodeIds = allEdges
      .filter(
        (e) => e.sourceNodeId === node.id && e.sourcePort === 'background',
      )
      .map((e) => e.targetNodeId);
    if (bodyEntryNodeIds.length === 0) return;

    const config = (node.config ?? {}) as {
      notifyOnFailure?: boolean;
      maxDurationMs?: number;
    };

    // Resolve the Background node's NodeExecution id so children can be
    // grouped under it in the timeline.
    const parentNodeExecution = await this.nodeExecutionRepository.findOne({
      where: { executionId, nodeId: node.id },
      order: { startedAt: 'DESC' },
    });
    const parentNodeExecutionId = parentNodeExecution?.id ?? '';

    // 핸들러가 발급한 backgroundRunId (모니터링 API 의 조회 키) 를 outputData
    // JSONB 에서 꺼내 job 으로 전달. 옛 NodeExecution / 비정상 메타 형태에
    // 대비한 추출 로직은 `extractBackgroundRunId` 가 단일 sink 로 책임진다
    // (W-18 회귀 잠금 — utils/extract-background-run-id.spec.ts).
    const backgroundRunId = extractBackgroundRunId(
      parentNodeExecution?.outputData,
    );

    // workspaceId 는 `context.variables.__workspaceId` 에 저장된다 (line 1210
    // 의 initialVariables). 옛 코드가 `context.expressionContext.workspaceId`
    // 를 읽었지만 이 경로에는 아무도 쓰지 않아 항상 빈 문자열이 되었고,
    // 결과적으로 dispatchFailureNotification 의 `if (!data.workspaceId) return;`
    // 가드가 알림을 건너뛰었다 (Background body 모니터링 e2e 가 회귀로 발견).
    const workspaceId =
      typeof context.variables?.['__workspaceId'] === 'string'
        ? context.variables['__workspaceId']
        : '';

    // Snapshot relevant context. Shallow-clone is enough — the body
    // executes against these values, and any mutations the main flow makes
    // afterwards stay isolated to the main flow.
    //
    // For the conversationThread we additionally clone the `turns` array
    // (not just the wrapper object) so the background body cannot reach
    // through and push to the main flow's turn list. ConversationTurn
    // objects themselves are immutable once pushed, so a deeper clone is
    // unnecessary (spec/conventions/conversation-thread.md §3.2).
    const threadSnapshot = cloneThread(context.conversationThread);
    const job: BackgroundExecutionJob = {
      executionId,
      parentNodeExecutionId,
      backgroundRunId,
      workspaceId,
      workflowId: context.workflowId,
      bodyEntryNodeIds,
      input: mainInput,
      variables: { ...context.variables },
      nodeOutputCache: { ...context.nodeOutputCache },
      expressionContext: { ...(context.expressionContext ?? {}) },
      conversationThread: threadSnapshot,
      config: {
        notifyOnFailure: config.notifyOnFailure === true,
        maxDurationMs:
          typeof config.maxDurationMs === 'number' && config.maxDurationMs >= 0
            ? config.maxDurationMs
            : 300000,
      },
    };

    await this.backgroundQueue.add('background-run', job, {
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }

  /**
   * Run a Background node's body subgraph. Called by the BullMQ processor
   * with the snapshot captured at enqueue time. Reuses {@link executeInline}
   * with `entryNodeIds` so the existing scheduler/topo-sort handles
   * traversal — we just rebuild the context and apply the timeout.
   */
  async executeBackgroundSubgraph(job: BackgroundExecutionJob): Promise<void> {
    const context = this.contextService.createContext(
      job.executionId,
      job.workflowId,
    );
    context.variables = { ...job.variables };
    context.nodeOutputCache = { ...job.nodeOutputCache };
    context.expressionContext = { ...job.expressionContext };
    // Use the enqueue-time snapshot (already turns-cloned) — pushes from
    // here onward stay inside the background subgraph (§3.2 isolation).
    // Backward-compat: jobs enqueued before the conversationThread field was
    // added (legacy BullMQ payloads) lack the field; fall back to an empty
    // thread instead of crashing on `undefined.turns`.
    context.conversationThread =
      job.conversationThread ?? createEmptyConversationThread();

    const run = this.executeInline(job.workflowId, job.input, {
      executionId: job.executionId,
      context,
      executedNodes: new Set<string>(),
      recursionDepth: 0,
      parentNodeExecutionId: job.parentNodeExecutionId || undefined,
      entryNodeIds: job.bodyEntryNodeIds,
    });

    if (job.config.maxDurationMs > 0) {
      await Promise.race([
        run,
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `Background body exceeded maxDurationMs (${job.config.maxDurationMs}ms)`,
                ),
              ),
            job.config.maxDurationMs,
          ),
        ),
      ]);
    } else {
      await run;
    }
  }

  /**
   * Compute per-branch subgraph plans for a Parallel node.
   *
   * Strategy: for each `branch_N` port of the Parallel node, BFS forward
   * across `forwardEdges` to collect reachable nodes. A node reached from
   * multiple branches is a join (Merge) and excluded from every branch
   * body; a node reached from exactly one branch is in that branch's body.
   *
   * Fails fast with `PARALLEL_INVALID_CHILD` / `PARALLEL_BACK_EDGE` /
   * `PARALLEL_NESTED_NOT_SUPPORTED` so the user sees a named error at
   * dispatch time instead of a mid-flight surprise.
   */
  private planParallelBody(
    parallelNode: Node,
    allNodes: Node[],
    forwardEdges: GraphEdge[],
    backEdges: GraphEdge[],
    branchCount: number,
  ): ParallelPlan {
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
    const forwardAdj = new Map<string, GraphEdge[]>();
    for (const edge of forwardEdges) {
      const list = forwardAdj.get(edge.sourceNodeId) ?? [];
      list.push(edge);
      forwardAdj.set(edge.sourceNodeId, list);
    }

    // Direct `branch_N` targets — branch entry points.
    const branchEntries: Set<string>[] = Array.from(
      { length: branchCount },
      () => new Set<string>(),
    );
    const parallelOutgoing = forwardAdj.get(parallelNode.id) ?? [];
    for (const edge of parallelOutgoing) {
      const match = /^branch_(\d+)$/.exec(edge.sourcePort);
      if (!match) continue;
      const idx = Number(match[1]);
      if (idx >= 0 && idx < branchCount) {
        branchEntries[idx].add(edge.targetNodeId);
      }
    }

    // Forward-BFS reach set from each branch's entries, staying strictly
    // within the DAG (back-edges are excluded so we never loop).
    const reachPerBranch: Set<string>[] = branchEntries.map(() => new Set());
    for (let i = 0; i < branchCount; i++) {
      const queue = [...branchEntries[i]];
      while (queue.length > 0) {
        const nodeId = queue.shift();
        if (nodeId === undefined) break;
        if (reachPerBranch[i].has(nodeId)) continue;
        reachPerBranch[i].add(nodeId);
        for (const edge of forwardAdj.get(nodeId) ?? []) {
          if (!reachPerBranch[i].has(edge.targetNodeId)) {
            queue.push(edge.targetNodeId);
          }
        }
      }
    }

    // Ownership: which branches reach each node.
    const owners = new Map<string, Set<number>>();
    for (let i = 0; i < branchCount; i++) {
      for (const id of reachPerBranch[i]) {
        const set = owners.get(id) ?? new Set<number>();
        set.add(i);
        owners.set(id, set);
      }
    }

    const joinNodeIds = new Set<string>();
    const allBodyNodeIds = new Set<string>();
    for (const [id, set] of owners) {
      if (set.size > 1) joinNodeIds.add(id);
      else allBodyNodeIds.add(id);
    }

    // Back-edges inside any branch body are rejected to keep semantics
    // consistent with the Container pattern (which also forbids cyclic bodies).
    for (const edge of backEdges) {
      if (
        allBodyNodeIds.has(edge.sourceNodeId) ||
        allBodyNodeIds.has(edge.targetNodeId)
      ) {
        throw new Error(
          `PARALLEL_BACK_EDGE: Parallel node "${parallelNode.label ?? parallelNode.type}" body contains back-edges, which are not supported.`,
        );
      }
    }

    const branches: ParallelBranchPlan[] = [];
    for (let i = 0; i < branchCount; i++) {
      const bodyNodeIds = new Set<string>();
      for (const id of reachPerBranch[i]) {
        if (allBodyNodeIds.has(id)) bodyNodeIds.add(id);
      }

      // Reject disallowed child types inside this branch body.
      // PR-G — metadata flag (CRIT #3). buttons / ai_conversation 은 runtime
      // interactionType (handler 가 결정) 이라 정적 reject 불가 — handler 가
      // status:'waiting_for_input' 반환 시 위 PARALLEL_INVALID_CHILD 가
      // executeParallelBranchBody 에서 재차 차단한다.
      for (const id of bodyNodeIds) {
        const node = nodeMap.get(id);
        if (!node) continue;
        const childKind = this.handlerRegistry.getMetadata(node.type);
        if (childKind.kind === 'parallel') {
          throw new Error(
            `PARALLEL_NESTED_NOT_SUPPORTED: Parallel node "${parallelNode.label ?? parallelNode.type}" body contains nested Parallel node "${node.label ?? node.type}". Nested Parallel is reserved for a later phase.`,
          );
        }
        if (childKind.kind === 'blocking') {
          throw new Error(
            `PARALLEL_INVALID_CHILD: Blocking node "${node.label ?? node.type}" inside Parallel node "${parallelNode.label ?? parallelNode.type}" is not supported.`,
          );
        }
      }

      const internalEdges = forwardEdges.filter(
        (e) =>
          bodyNodeIds.has(e.sourceNodeId) && bodyNodeIds.has(e.targetNodeId),
      );
      const graphNodes = Array.from(bodyNodeIds).map((id) => ({ id }));
      const sortedNodeIds = topologicalSort(graphNodes, internalEdges);

      const outgoingEdgeMap = new Map<string, GraphEdge[]>();
      for (const edge of internalEdges) {
        const list = outgoingEdgeMap.get(edge.sourceNodeId) ?? [];
        list.push(edge);
        outgoingEdgeMap.set(edge.sourceNodeId, list);
      }

      // Exit nodes: body nodes whose outgoing edges leave the body (typically
      // into a join node such as a Merge). Used after dispatch to propagate
      // reachability into the main loop's `reachable` set.
      const exitNodeIds = new Set<string>();
      for (const id of bodyNodeIds) {
        const out = forwardAdj.get(id) ?? [];
        for (const edge of out) {
          if (!bodyNodeIds.has(edge.targetNodeId)) {
            exitNodeIds.add(id);
            break;
          }
        }
        // A body node with no outgoing edges at all is still a terminal leaf;
        // no propagation needed, so we don't add it to exitNodeIds.
      }

      branches.push({
        branchIndex: i,
        branchPort: `branch_${i}`,
        bodyNodeIds,
        sortedNodeIds,
        entryNodeIds: branchEntries[i],
        exitNodeIds,
        internalEdges,
        outgoingEdgeMap,
      });
    }

    return { branches, joinNodeIds, allBodyNodeIds };
  }

  /**
   * Execute a single branch's body subgraph sequentially — the engine runs
   * branches *between* each other in parallel (via ParallelExecutor), but
   * each branch's own nodes remain in topological order inside the branch.
   *
   * Mirrors {@link executeContainerBody}: seeds reachability with the branch
   * entry nodes, routes by port, and rejects any blocking node encountered
   * mid-flight (validation in {@link planParallelBody} covers statically-
   * declared blocking nodes; this guards against ones emitted via
   * `waiting_for_input` at runtime).
   */
  private async executeParallelBranchBody(
    parallelNode: Node,
    plan: ParallelBranchPlan,
    allNodes: Node[],
    allEdges: Edge[],
    context: ExecutionContext,
    executionId: string,
    executedNodes: Set<string>,
    executionMeta: { startedAt?: string; mode?: string },
    branchInput: unknown,
  ): Promise<void> {
    if (plan.sortedNodeIds.length === 0) return;
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

    const reachable = new Set<string>();
    for (const id of plan.entryNodeIds) {
      if (plan.bodyNodeIds.has(id)) reachable.add(id);
    }

    for (const nodeId of plan.sortedNodeIds) {
      if (!reachable.has(nodeId)) continue;
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      if (node.isDisabled) {
        const skipped = await this.createNodeExecution(
          executionId,
          nodeId,
          NodeExecutionStatus.SKIPPED,
          context.parentNodeExecutionId,
        );
        this.eventEmitter.emitNode(
          executionId,
          nodeId,
          NodeEventType.NODE_SKIPPED,
          {
            nodeExecutionId: skipped.id,
            parentNodeExecutionId: context.parentNodeExecutionId,
            status: NodeExecutionStatus.SKIPPED,
            nodeType: node.type,
            nodeLabel: node.label ?? node.type,
            startedAt: skipped.startedAt?.toISOString?.(),
          },
        );
        executedNodes.add(nodeId);
        continue;
      }

      const nodeInput = this.gatherNodeInput(
        nodeId,
        plan.internalEdges,
        executedNodes,
        context.nodeOutputCache,
        branchInput,
      );

      await this.executeNode(
        executionId,
        node,
        nodeInput,
        context,
        executedNodes,
        nodeMap,
        executionMeta,
      );

      // PR-G — metadata flag dispatch (CRIT #3 시나리오 D).
      const branchDispatchKind = this.handlerRegistry.getMetadata(
        node.type,
      ).kind;

      // Container dispatch inside a branch body — mirrors the main loop so
      // ForEach/Loop/Map inside a Parallel branch still iterates its body.
      if (branchDispatchKind === 'container') {
        await this.runContainer(
          node,
          allNodes,
          allEdges,
          context,
          executionId,
          executedNodes,
          executionMeta,
        );
      }

      // Background inside a branch just enqueues its body; the main flow
      // (this branch) continues without waiting, which matches the top-level
      // Background contract.
      if (branchDispatchKind === 'background') {
        await this.scheduleBackgroundBody(
          node,
          allEdges,
          context,
          executionId,
          branchInput,
        );
      }

      const nodeOutput = context.nodeOutputCache[node.id] as
        | Record<string, unknown>
        | undefined;
      if (nodeOutput?.status === 'waiting_for_input') {
        throw new Error(
          `PARALLEL_INVALID_CHILD: Blocking node "${node.label ?? node.type}" inside Parallel node "${parallelNode.label ?? parallelNode.type}" is not supported.`,
        );
      }

      this.graphTraversal.propagateReachability(
        nodeId,
        plan.outgoingEdgeMap,
        context.nodeOutputCache,
        reachable,
      );
    }
  }

  /**
   * Run a Parallel node when `PARALLEL_ENGINE=v1` is active.
   *
   * 1. Plan each branch's exclusive body subgraph.
   * 2. Hand the branches to {@link ParallelExecutor} which enforces
   *    `maxConcurrency` via p-limit and aggregates failures per
   *    `errorPolicy`.
   * 3. After all branches settle, replace the Parallel node's output with
   *    `_selectedPort: ['done']` so the main loop's propagateReachability
   *    activates only the `done` port edges while suppressing `branch_N`
   *    edges (preventing re-execution of branch body nodes).
   * 4. Re-propagate reachability from each branch's exit nodes into the
   *    caller-provided `reachable` set so join nodes (typical Merge) become
   *    executable in the main loop.
   *
   * Called only when the feature flag is `v1`; otherwise the legacy
   * sequential behavior applies (branch edges activate via `propagateReachability`
   * and run one-by-one through the main pointer loop).
   */

  /**
   * Read the post-expression-evaluation config snapshot for a container
   * node. In the happy path the engine populated this cache right after the
   * handler returned; if a caller bypasses `executeNode` (rare in prod but
   * possible in test fixtures or future code paths) we fall back to the raw
   * `node.config` and emit a warning so the regression is observable rather
   * than silently coercing raw `{{...}}` templates downstream.
   */
  private readEngineResolvedConfig(
    context: ExecutionContext,
    node: Node,
  ): Record<string, unknown> {
    const cached = context.engineResolvedConfigCache?.[node.id];
    if (cached) return cached;
    this.logger.warn(
      `engineResolvedConfigCache miss for node "${node.label ?? node.type}" (${node.id}); ` +
        `falling back to raw node.config — expression-bearing fields will fail strict coercion.`,
    );
    return node.config ?? {};
  }

  /**
   * Build a per-iteration `breakCondition` closure for {@link LoopExecutor}.
   *
   * The expression `template` (raw `{{ ... }}` string) is **re-evaluated**
   * every iteration with a freshly built expression context, so it sees the
   * current `$loop.index`, `$var.*` mutations from body nodes, and
   * `$node[...].output` for nodes that ran inside the body. Truthy result →
   * loop exits early with `meta.exitReason='break'`.
   *
   * Evaluation errors (undefined variables, type mismatches, syntax) are
   * swallowed and treated as `false` — same defensive policy Filter uses
   * for per-item expression failures (`filter.handler.ts:217-223`). The
   * loop continues; users diagnose silent failures via run logs.
   *
   * Spec: `4-nodes/1-logic/3-loop.md` §6 (post-iteration evaluation).
   */
  private buildLoopBreakConditionEvaluator(
    template: string,
    parentContext: ExecutionContext,
    allNodes: Node[],
    executionMeta: { startedAt?: string; mode?: string },
  ): (context: ExecutionContext) => boolean {
    const nodeMap = new Map(allNodes.map((node) => [node.id, node]));
    return (context: ExecutionContext) => {
      const exprContext = this.expressionResolver.buildExpressionContext(
        // Loop body has no per-iteration `$input` (body re-uses
        // previousOutput internally), so we pass the parent's `$input`
        // unchanged — users typically reference `$loop.*`, `$var.*`, or
        // `$node[...].output` here, not `$input`.
        parentContext.expressionContext?.$input ?? null,
        context,
        nodeMap,
        executionMeta,
      );
      try {
        const result = evaluate(template, exprContext);
        return Boolean(result);
      } catch (err) {
        this.logger.debug(
          `Loop breakCondition evaluation failed (treated as false): ${err instanceof Error ? err.message : String(err)}`,
        );
        return false;
      }
    };
  }

  private async runParallel(
    parallelNode: Node,
    allNodes: Node[],
    allEdges: Edge[],
    forwardEdges: GraphEdge[],
    backEdges: GraphEdge[],
    outgoingEdgeMap: Map<string, GraphEdge[]>,
    context: ExecutionContext,
    executionId: string,
    executedNodes: Set<string>,
    executionMeta: { startedAt?: string; mode?: string },
    reachable: Set<string>,
    input: unknown,
  ): Promise<void> {
    const structured = context.structuredOutputCache?.[parallelNode.id];
    // `structured?.config` carries the handler's raw echo per CONVENTIONS
    // Principle 7 (`{{...}}` preserved). Reading raw here used to fail every
    // typeof guard and silently fall back to defaults (branchCount=2,
    // maxConcurrency=0, waitAll=true) for any expression input. The engine-
    // resolved cache holds the evaluated values.
    const echoConfig = structured?.config ?? parallelNode.config ?? {};
    const engineResolvedConfig = this.readEngineResolvedConfig(
      context,
      parallelNode,
    );

    const branchCount = Math.max(
      PARALLEL_BRANCH_COUNT_MIN,
      Math.min(
        PARALLEL_BRANCH_COUNT_MAX,
        Math.floor(
          coerceContainerNumber(
            engineResolvedConfig.branchCount ?? PARALLEL_BRANCH_COUNT_MIN,
            'branchCount',
            'parallel',
          ),
        ),
      ),
    );
    const maxConcurrencyRaw = coerceContainerNumberOptional(
      engineResolvedConfig.maxConcurrency,
      'maxConcurrency',
      'parallel',
    );
    const maxConcurrency =
      maxConcurrencyRaw === undefined
        ? PARALLEL_MAX_CONCURRENCY_MIN
        : Math.max(
            PARALLEL_MAX_CONCURRENCY_MIN,
            Math.min(
              PARALLEL_MAX_CONCURRENCY_MAX,
              Math.floor(maxConcurrencyRaw),
            ),
          );
    const waitAll = coerceContainerBoolean(
      engineResolvedConfig.waitAll,
      'waitAll',
      'parallel',
      true,
    );
    if (!waitAll) {
      this.logger.warn(
        `Parallel node "${parallelNode.label ?? parallelNode.type}" has waitAll=false, but Phase P1 always waits for all branches. ` +
          `Use the Background node for fire-and-forget semantics.`,
      );
    }

    // W-7: parallel-specific `config.errorPolicy` 가 1순위. 미지정 시 공통
    // `errorHandling.policy` 의 매핑으로 fallback (옛 동선 호환). 둘 다 미지정
    // 이면 'stop'.
    const parallelErrorPolicyRaw = engineResolvedConfig.errorPolicy;
    let errorPolicy: ParallelErrorPolicy;
    if (
      parallelErrorPolicyRaw === 'stop' ||
      parallelErrorPolicyRaw === 'continue'
    ) {
      errorPolicy = parallelErrorPolicyRaw;
    } else {
      const errorPolicyConfig = this.getErrorPolicyConfig(parallelNode);
      errorPolicy =
        errorPolicyConfig.policy === 'skip_node' ||
        errorPolicyConfig.policy === 'use_default_output' ||
        errorPolicyConfig.policy === 'route_to_error_port'
          ? 'continue'
          : 'stop';
    }

    const plan = this.planParallelBody(
      parallelNode,
      allNodes,
      forwardEdges,
      backEdges,
      branchCount,
    );

    // Resolve the Parallel node's current NodeExecution row so branch
    // children can be grouped under it in the run-results timeline
    // (mirrors the Background node's parentNodeExecutionId stamping).
    const parentNodeExecution = await this.nodeExecutionRepository.findOne({
      where: { executionId, nodeId: parallelNode.id },
      order: { startedAt: 'DESC' },
    });
    const parentNodeExecutionId = parentNodeExecution?.id;
    const branchParentContext: ExecutionContext = parentNodeExecutionId
      ? { ...context, parentNodeExecutionId }
      : context;

    await this.parallelExecutor.execute(
      { branchCount, maxConcurrency, waitAll, errorPolicy },
      branchParentContext,
      async (branchIndex, branchContext) => {
        const branchPlan = plan.branches[branchIndex];
        await this.executeParallelBranchBody(
          parallelNode,
          branchPlan,
          allNodes,
          allEdges,
          branchContext,
          executionId,
          executedNodes,
          executionMeta,
          input,
        );
      },
    );

    // Collect each branch's terminal output for the `done` port.
    // The last node in each branch's topological order is the terminal.
    const branchResults: unknown[] = [];
    for (const branch of plan.branches) {
      if (branch.sortedNodeIds.length === 0) {
        branchResults.push(undefined);
        continue;
      }
      const lastNodeId = branch.sortedNodeIds[branch.sortedNodeIds.length - 1];
      const rawOutput = context.nodeOutputCache[lastNodeId];
      branchResults.push(this.stripControlFields(rawOutput));
    }

    // Replace Parallel's output: `_selectedPort: ['done']` ensures only the
    // `done` port fires while branch_N edges stay suppressed. The `done`
    // downstream node receives `{ branches, count }` (CONVENTIONS §9.2).
    context.nodeOutputCache[parallelNode.id] = {
      _selectedPort: ['done'],
      branches: branchResults,
      count: branchResults.length,
    };
    this.contextService.setStructuredOutput(executionId, parallelNode.id, {
      config: echoConfig,
      output: { branches: branchResults, count: branchResults.length },
      port: ['done'],
    });

    // Activate `done` downstream via the main outgoingEdgeMap (Parallel →
    // done-port edges). Branch exit → join (Merge) edges are also activated.
    this.graphTraversal.propagateReachability(
      parallelNode.id,
      outgoingEdgeMap,
      context.nodeOutputCache,
      reachable,
    );
    for (const branch of plan.branches) {
      for (const exitId of branch.exitNodeIds) {
        this.graphTraversal.propagateReachability(
          exitId,
          outgoingEdgeMap,
          context.nodeOutputCache,
          reachable,
        );
      }
    }
  }

  /**
   * Run the container executor (ForEach/Loop) for a container node, wiring
   * the per-iteration callback to {@link executeContainerBody}. Reads the
   * resolved input array / count from the container handler's output, which
   * was just stored in the structured cache by executeNode. The resulting
   * collected array overwrites the container's output so downstream
   * `done`-port edges carry the body results.
   */
  private async runContainer(
    containerNode: Node,
    allNodes: Node[],
    allEdges: Edge[],
    context: ExecutionContext,
    executionId: string,
    executedNodes: Set<string>,
    executionMeta: { startedAt?: string; mode?: string },
  ): Promise<void> {
    try {
      await this.runContainerInner(
        containerNode,
        allNodes,
        allEdges,
        context,
        executionId,
        executedNodes,
        executionMeta,
      );
    } catch (error) {
      // Container-level failure happens AFTER executeNode has already marked
      // the container as COMPLETED (handler's initial return succeeded). We
      // overwrite that to FAILED with the real error so the UI surfaces the
      // reason (e.g. CONTAINER_MISSING_EMIT) on the container node itself
      // instead of leaving it looking "completed with null output".
      const message = error instanceof Error ? error.message : String(error);
      const nodeExec = await this.nodeExecutionRepository.findOne({
        where: { executionId, nodeId: containerNode.id },
        order: { startedAt: 'DESC' },
      });
      if (nodeExec) {
        nodeExec.status = NodeExecutionStatus.FAILED;
        nodeExec.error = { message };
        nodeExec.finishedAt = new Date();
        if (nodeExec.startedAt) {
          nodeExec.durationMs =
            nodeExec.finishedAt.getTime() - nodeExec.startedAt.getTime();
        }
        await this.nodeExecutionRepository.save(nodeExec);
      }
      this.eventEmitter.emitNode(
        executionId,
        containerNode.id,
        NodeEventType.NODE_FAILED,
        {
          nodeExecutionId: nodeExec?.id,
          parentNodeExecutionId: nodeExec?.parentNodeExecutionId ?? undefined,
          status: NodeExecutionStatus.FAILED,
          error: message,
          nodeType: containerNode.type,
          nodeLabel: containerNode.label ?? containerNode.type,
          input: nodeExec?.inputData,
          startedAt: nodeExec?.startedAt?.toISOString?.(),
          finishedAt: nodeExec?.finishedAt?.toISOString?.(),
        },
      );
      throw error;
    }
  }

  private async runContainerInner(
    containerNode: Node,
    allNodes: Node[],
    allEdges: Edge[],
    context: ExecutionContext,
    executionId: string,
    executedNodes: Set<string>,
    executionMeta: { startedAt?: string; mode?: string },
  ): Promise<void> {
    // Resolve and validate the container wiring once upfront. planContainerBody
    // throws on missing/duplicate emit edges or back-edges so the user sees
    // the error immediately rather than mid-iteration.
    const plan = this.planContainerBody(containerNode, allNodes, allEdges);

    const runIter = async (iterInput: unknown) => {
      return this.executeContainerBody(
        containerNode,
        plan,
        context,
        executionId,
        executedNodes,
        executionMeta,
        iterInput,
      );
    };

    const structured = context.structuredOutputCache?.[containerNode.id];
    // Two distinct config views are needed here:
    //   * `echoConfig` (raw `{{ ... }}` per CONVENTIONS Principle 7) —
    //     preserved in the final structuredOutputCache so `$node["X"].config`
    //     expressions keep returning the original templates.
    //   * `engineResolvedConfig` (expression-evaluated) — drives iteration
    //     parameters (`count`, `maxIterations`, `errorPolicy`). Reading raw
    //     here would feed Number()/typeof guards the un-evaluated string and
    //     produce NaN (Loop) or silent default fallback (Parallel).
    const echoConfig = structured?.config ?? containerNode.config ?? {};
    const engineResolvedConfig = this.readEngineResolvedConfig(
      context,
      containerNode,
    );
    let structuredOutput: Record<string, unknown>;
    let structuredMeta: Record<string, unknown> | undefined;

    if (containerNode.type === 'foreach') {
      const handlerOutput = structured?.output;
      const array = Array.isArray(handlerOutput) ? handlerOutput : [];
      const collected = await this.foreachExecutor.execute(
        {
          array,
          errorPolicy: coerceErrorPolicy(
            engineResolvedConfig.errorPolicy,
            'errorPolicy',
            containerNode.type,
            'stop',
          ),
          collectResults: true,
        },
        context,
        runIter,
      );
      // CONVENTIONS §9.2 — `foreach` finalises as `{ items, count }` so
      // downstream expressions can uniformly read `output.items[i]` / .count
      // across container kinds.
      //
      // Phase 1 (D — spec/4-nodes/1-logic/9-foreach.md §5.3): on
      // `errorPolicy = 'skip' | 'continue'` the executor separates failed
      // iterations into `skipped: [{ index, error }]`. `items[index]` is left
      // as a `null` placeholder so success/skip slots still align by index
      // with the input array. `meta.skippedCount` mirrors `skipped.length`.
      const foreachOutput: Record<string, unknown> = {
        items: collected.items,
        count: collected.items.length,
      };
      if (collected.skipped.length > 0) {
        foreachOutput.skipped = collected.skipped;
      }
      structuredOutput = foreachOutput;
      // Phase 2 (C — spec/4-nodes/1-logic/9-foreach.md §5.2): expose runtime
      // metric `meta.iterations` (Container metric, Principle 2 — meta is
      // execution metrics, not config echoes). This is the body launch count
      // and matches `output.items.length` (skip-policy `null` placeholders
      // are still counted, since the body did run for those indices).
      // Additive / non-breaking; coexists with Phase 1 D `meta.skippedCount`.
      const foreachMeta: Record<string, unknown> = {
        iterations: collected.items.length,
      };
      if (collected.skippedCount > 0) {
        foreachMeta.skippedCount = collected.skippedCount;
      }
      structuredMeta = foreachMeta;
    } else if (containerNode.type === 'map') {
      const handlerOutput = structured?.output;
      const array = Array.isArray(handlerOutput) ? handlerOutput : [];
      const collected = await this.foreachExecutor.execute(
        {
          array,
          errorPolicy: coerceErrorPolicy(
            engineResolvedConfig.errorPolicy,
            'errorPolicy',
            containerNode.type,
            'stop',
          ),
          collectResults: true,
        },
        context,
        runIter,
      );
      // CONVENTIONS §9.2 — `map` finalises as `{ mapped, count }`.
      //
      // Map keeps the legacy inline `_skipped` marker shape (per
      // spec/4-nodes/1-logic/7-map.md §5.4) since Map's intent is "uniform
      // type transformation array" where downstream typically iterates
      // mapped[i] regardless of skip status. Reconstruct the inline marker
      // from the executor's separated struct.
      const mapped: unknown[] = [...collected.items];
      for (const entry of collected.skipped) {
        mapped[entry.index] = { _skipped: true, error: entry.error };
      }
      structuredOutput = {
        mapped,
        count: mapped.length,
      };
    } else if (containerNode.type === 'loop') {
      const count = coerceContainerNumber(
        engineResolvedConfig.count,
        'count',
        'loop',
      );
      const maxIterations = coerceContainerNumberOptional(
        engineResolvedConfig.maxIterations,
        'maxIterations',
        'loop',
      );
      // breakCondition is a `{{ ... }}` boolean expression (frontend ships it
      // as a string). The engine's pre-dispatch resolveConfig would substitute
      // it once with the *initial* loop context (i=0), losing per-iteration
      // reactivity, so we read the **raw** template here and re-resolve every
      // iteration via `expressionResolver.buildExpressionContext` — that's
      // what gives `$loop.index` / `$var.*` / `$node[...].output` their fresh
      // values per tick (spec/4-nodes/1-logic/3-loop.md §6).
      const rawConfig = containerNode.config ?? {};
      const rawBreakExpr = rawConfig.breakCondition;
      const breakCondition =
        typeof rawBreakExpr === 'string' && rawBreakExpr.trim().length > 0
          ? this.buildLoopBreakConditionEvaluator(
              rawBreakExpr,
              context,
              allNodes,
              executionMeta,
            )
          : undefined;
      const collected = await this.loopExecutor.execute(
        { count, maxIterations, breakCondition },
        context,
        runIter,
      );
      const iterations = collected.iterations.map((r) => r.output);
      // CONVENTIONS §9.2 — `loop` finalises as `{ iterations, count }`.
      structuredOutput = { iterations, count: iterations.length };
      // Phase 2 (C — spec/4-nodes/1-logic/3-loop.md §5.2): expose runtime
      // metrics via `meta.*` (Principle 2). `meta.exitReason` distinguishes
      // natural completion from early break / safety-cap termination so
      // observability tools can flag loops that terminated unexpectedly.
      // `meta.maxIterationsReached` is retained for back-compat — true iff
      // the loop ran to its safety cap without breaking.
      structuredMeta = {
        iterations: iterations.length,
        maxIterationsReached: collected.exitReason === 'maxIterations',
        exitReason: collected.exitReason,
      };
    } else {
      return;
    }

    // Merge container-side `meta.*` (e.g. foreach `skippedCount`) with any
    // pre-existing structured meta (engine-injected `durationMs`, prior
    // handler-stage meta, etc.). Container-side keys take precedence on
    // conflict — they describe the just-finalised iteration semantics.
    const prevStructuredMeta = structured?.meta;
    const mergedMeta =
      prevStructuredMeta || structuredMeta
        ? { ...(prevStructuredMeta ?? {}), ...(structuredMeta ?? {}) }
        : undefined;

    this.contextService.setStructuredOutput(executionId, containerNode.id, {
      config: echoConfig,
      output: structuredOutput,
      ...(mergedMeta !== undefined ? { meta: mergedMeta } : {}),
    });
    this.contextService.setNodeOutput(
      executionId,
      containerNode.id,
      structuredOutput,
    );
  }

  /**
   * 상태 전이를 NodeExecution 변경과 함께 단일 트랜잭션으로 묶어 실행한다.
   *
   * WARN #4 (DB) — RUNNING ↔ WAITING_FOR_INPUT 전이 시 Execution 과 NodeExecution
   * 의 두 save 사이 crash window 가 존재해 상태 불일치가 발생할 수 있다. 동일
   * 트랜잭션으로 묶어 둘 다 commit 되거나 둘 다 rollback 되도록 보장한다.
   * (spec/5-system/4-execution-engine.md §1.1)
   *
   * `linkedNodeExec` 가 주어지면 호출 측이 in-memory 로 mutation 한 NodeExecution
   * 을 동일 트랜잭션 안에서 함께 저장한다. 주어지지 않으면 Execution save 만
   * 수행 (transaction overhead 회피).
   *
   * WebSocket emit 은 본 헬퍼 호출 후 (트랜잭션 commit 후) 수행해야 한다 — 그렇지
   * 않으면 rollback 된 상태를 클라이언트가 잠시 관측할 수 있다.
   */
  private async updateExecutionStatus(
    execution: Execution,
    newStatus: ExecutionStatus,
    linkedNodeExec?: NodeExecution,
  ): Promise<void> {
    assertTransition(execution.status, newStatus);
    if (linkedNodeExec) {
      await this.dataSource.transaction(async (manager) => {
        execution.status = newStatus;
        await manager.save(Execution, execution);
        await manager.save(NodeExecution, linkedNodeExec);
      });
    } else {
      execution.status = newStatus;
      await this.executionRepository.save(execution);
    }
  }

  private async createNodeExecution(
    executionId: string,
    nodeId: string,
    status: NodeExecutionStatus,
    parentNodeExecutionId?: string | null,
    inputData?: unknown,
  ): Promise<NodeExecution> {
    const nodeExecution = this.nodeExecutionRepository.create({
      executionId,
      nodeId,
      status,
      inputData: (inputData ?? {}) as Record<string, unknown>,
      parentNodeExecutionId: parentNodeExecutionId ?? null,
    });
    return this.nodeExecutionRepository.save(nodeExecution);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
