import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
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
  InvalidExecutionStateError,
  RetryLastTurnError,
  ExecutionTimeLimitError,
  MessageTooLongError,
  FormValidationError,
} from './workflow-errors';
import {
  extractFormFields,
  validateAllFields,
} from '../chat-channel/shared/form-mode';
import { resolveMaxActiveRunningMs } from './execution-limits';
import {
  ContinuationBusService,
  RECOVERY_LOCK_KEY,
} from './continuation/continuation-bus.service';
import type { ContinuationPayload } from './queues/continuation-execution.queue';
import { ShutdownStateService } from './shutdown/shutdown-state.service';
import { BusinessMetricsService } from '../metrics/business-metrics.service';
import {
  createEmptyConversationThread,
  rehydrateConversationThread,
} from '../../shared/conversation-thread/conversation-thread.types';
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
import { ExecutionContextService } from './context/execution-context.service';
// C-1 step2 — sanitizeLastErrorMessage / extractRetryAfterMs 는 AI turn 오류
// 분류(extractAiTurnErrorPayload)에서만 쓰였고 그 cluster 는 AiTurnOrchestrator
// 로 이동했다. 엔진에서는 더 이상 참조하지 않으므로 import 제거.
import {
  ErrorPolicyHandler,
  ErrorPolicyConfig,
} from './error/error-policy.handler';
import { ExpressionResolverService } from './expression/expression-resolver.service';
import { evaluate } from '@workflow/expression-engine';
import {
  coerceContainerNumber,
  coerceContainerNumberOptional,
  coerceErrorPolicy,
} from './utils/coerce-container-param';
import { extractBackgroundRunId } from './utils/extract-background-run-id';
import {
  ExecutionContext,
  NodeHandler,
  ParallelBranchContext,
  ResumableMessageSource,
} from '../../nodes/core/node-handler.interface';
import { NODE_TYPES } from '../../nodes/core/node-types.constants';
import {
  ChatChannelRoutingInfo,
  ExecutionEventType,
  NodeEventType,
} from '../websocket/websocket.service';
import { ExecutionEventEmitter } from './events/execution-event-emitter.service';
import { GraphTraversalService } from './graph/graph-traversal.service';
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
  EXECUTION_RUN_QUEUE,
  EXECUTION_RUN_QUEUE_DEFAULT_OPTS,
  buildExecutionRunJobId,
  resolveExecutionRunPriority,
  type ExecutionRunJob,
} from './queues/execution-run.queue';
import {
  adaptHandlerReturn,
  isCanonicalHandlerOutput,
  toEngineFlatShape,
  wrapBareAsNodeHandlerOutput,
} from './handler-output.adapter';
import {
  WorkflowExecutor,
  SubWorkflowOptions,
  SubWorkflowResult,
  InlineExecutionOptions,
} from '../../nodes/core/workflow-executor.interface';
import type { EngineDriver } from './engine-driver.interface';
// C-1 step2 — AI 멀티턴 생명주기는 AiTurnOrchestrator 로 추출됨. 엔진은 dispatch
// loop·registry·retry 재진입에서 본 orchestrator 로 위임한다. orchestrator 가
// ENGINE_DRIVER(=엔진) 를 주입받으므로 순환 DI → forwardRef 로 해소한다.
// C-1 step3 (W3) — orchestrator 와 공유하던 AI 대화 helper/RehydrationError 는
// `./ai-conversation-helpers` (leaf) 로 분리해, 엔진→orchestrator 값 import
// (forwardRef) 가 단방향이 되도록 ES module 순환을 끊었다. 엔진은 본 helper 를
// 내부적으로 사용하면서, 기존 외부 import 호환을 위해 아래에서 re-export 한다.
import { AiTurnOrchestrator } from './ai-turn-orchestrator.service';
// C-1 step3 — Form/Button blocking-interaction 생명주기는 FormInteractionService /
// ButtonInteractionService 로 추출됨. 엔진은 dispatch loop park 진입·resume registry
// 에서 본 서비스로 위임한다. 두 서비스가 ENGINE_DRIVER(=엔진) 를 주입받으므로
// 순환 DI → forwardRef 로 해소한다 (AiTurnOrchestrator 선례와 동일).
import { FormInteractionService } from './form-interaction.service';
import { ButtonInteractionService } from './button-interaction.service';
// AI 대화 helper·RehydrationError·builder 의 canonical 정의는 leaf 모듈
// `./ai-conversation-helpers` 단일이며, 모든 소비자(엔진·orchestrator·spec)가 거기서
// 직접 import 한다 — re-export 체인 제거(impl-done Critical 해소: `RehydrationError`
// 단일 클래스 식별성으로 `instanceof` 일관 보장). 엔진은 내부 사용분만 값 import.
import { RehydrationError } from './ai-conversation-helpers';
import { ParkReleaseSignal } from '../../shared/execution-resume/park-release-signal';
import {
  PARK_RELEASED,
  type ProcessTurnResult,
} from '../../shared/execution-resume/process-turn-result';
import type {
  ResumeTurnContext,
  ResumeTurnDispatch,
  ResumeTurnSelector,
} from './resume-turn-dispatch';
import {
  CALL_STACK_SCHEMA_VERSION,
  ResumeCallStack,
} from '../../shared/execution-resume/resume-call-stack.types';

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

// C-1 step2 — 추출된 AiTurnOrchestrator 의 emit 메서드가 동일 union 을 타입
// 주석으로 참조하므로 export (interaction-type-registry.md §1.1 의 정의 자체는
// 본 파일에 그대로 잔류 — 이동하지 않는다).
export type WaitingInteractionType =
  | 'form'
  | 'buttons'
  | 'ai_conversation'
  // spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii — AI Agent multi-turn 이
  // `render_form` 도구를 호출해 form 제출 대기 중일 때.
  | 'ai_form_render';

/**
 * `HooksService.handleChatChannelWebhook` 가 execute() 호출 시 input 의
 * top-level 에 주입하는 `chatChannel: {provider, conversationKey, channelUserKey?}`
 * 를 안전하게 추출.
 *
 * **검증 범위**: 필수 두 필드 (`provider`, `conversationKey`) 가 비어있지 않은
 * string 인 경우에만 통과. `channelUserKey` 및 provider-specific 추가 필드는
 * 형식 검증 없이 그대로 통과시킨다 — dispatcher 가 provider 별로 필요한 키를
 * 읽어가므로 본 함수가 shape 을 좁히지 않는다. credential 형 키의 정제는 하위
 * 레이어 (`WebsocketService.attachRoutingContext` → `sanitizePayloadForWs`) 책임.
 */
function extractChatChannelFromInput(
  input: unknown,
): ChatChannelRoutingInfo | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const raw = (input as { chatChannel?: unknown }).chatChannel;
  if (!raw || typeof raw !== 'object') return undefined;
  const provider = (raw as { provider?: unknown }).provider;
  const conversationKey = (raw as { conversationKey?: unknown })
    .conversationKey;
  if (typeof provider !== 'string' || provider.length === 0) return undefined;
  if (typeof conversationKey !== 'string' || conversationKey.length === 0) {
    return undefined;
  }
  return raw as ChatChannelRoutingInfo;
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
 * 노드 핸들러가 런타임 실패를 `port: 'error'` 로 라우팅했으나 그 error 포트에
 * 연결된 엣지가 없을 때 던지는 sentinel. spec/5-system/3-error-handling.md §3.2
 * 동작 규칙: "error 포트에 엣지가 없으면 → ERROR_PORT_FALLBACK 에러 로깅 후
 * Stop Workflow 폴백". top-level catch 가 `code` 를 Execution.error 로 보존한다
 * (§1.4 의 엔진 레벨 코드).
 */
class ErrorPortFallbackError extends Error {
  /** 외부 Execution.error.code 로 직렬화 — FE/알림이 이 값으로 분기 가능. */
  readonly code = 'ERROR_PORT_FALLBACK';
  constructor(message: string) {
    super(message);
    this.name = 'ErrorPortFallbackError';
  }
}

/** error 포트 노드의 `output.error.message` 가 DB(JSONB)·WS payload 를 비대화
 *  시키지 않도록 상한을 둔다. 초과분은 `…` 로 잘라낸다. */
const NODE_ERROR_MESSAGE_MAX_LEN = 2000;

// `PARK_RELEASED` / `ParkSignal` / `ProcessTurnResult` 는
// `shared/execution-resume/process-turn-result.ts` 로 이관됨 (top-level + 중첩 재개
// dispatch 가 공유하는 park return-signal 어휘). 상단 import 참조.

/**
 * `_resumeCheckpoint`(§7.5 rehydration) 의 스키마 버전. checkpoint 구조가
 * 진화할 때 1씩 올린다. `buildResumeCheckpoint` 가 stamp 하고, 재개 시 검사한다:
 * - 부재(기능 배포 이전 row) / 현재 버전 이하 → 누락 필드 기본값 보강해 재구성.
 * - 현재 버전 초과(롤링 배포 중 구 인스턴스가 신 포맷 pickup) → 안전 재구성 불가
 *   → graceful `RESUME_INCOMPATIBLE_STATE`.
 * (spec: 4-execution-engine §1.3 보존 예외 / §7.5 실패 케이스 표)
 */
const CHECKPOINT_SCHEMA_VERSION = 1;

/**
 * `_resumeCheckpoint` 저장·재개 허용 노드 타입 allow-list (spec §1.3 합집합).
 * 새 멀티턴 타입 추가 시 이 한 곳만 갱신하면 3개 가드 모두 반영된다.
 */
const CHECKPOINT_ELIGIBLE_NODE_TYPES = new Set([
  'ai_agent',
  'information_extractor',
]);

/**
 * `information_extractor` 핸들러의 `maxCollectionRetries` 기본값.
 * `CHECKPOINT_SCHEMA_VERSION` 옆에 선언해 checkpoint 스키마 관련 상수를 한곳에
 * 모은다. `buildRetryReentryState` 의 `?? 3` 을 이 상수로 교체해 IE 핸들러
 * 기본값과의 동기화를 문서화한다.
 */
const DEFAULT_IE_MAX_COLLECTION_RETRIES = 3;

function clampNodeErrorMessage(raw: string): string {
  return raw.length > NODE_ERROR_MESSAGE_MAX_LEN
    ? raw.slice(0, NODE_ERROR_MESSAGE_MAX_LEN) + '…'
    : raw;
}

/**
 * Phase 2.5 — continuation publish 결과. WS gateway / REST controller 가 ack
 * 에 즉시 동봉 (`queued: boolean` + 디버깅용 `jobId`).
 *
 * - `queued: true` + `jobId: string` — 정상 enqueue. BullMQ 가 비동기로 처리.
 *   spec §7.4 라우팅 원칙상 모든 정상 publish 는 이 분기.
 * - `queued: false` + `jobId: null` — enqueue 자체 실패 (Redis 장애 등). caller
 *   는 throw 또는 `success: false` ack 로 변환.
 *
 * **불변 조건**: `queued: false` ↔ `jobId: null` — 두 필드는 항상 쌍으로 반전.
 * `queued` 만 확인해도 실패 여부를 판단할 수 있다. `jobId` 는 디버깅 전용.
 */
export interface ContinuationPublishResult {
  queued: boolean;
  jobId: string | null;
}

// InvalidExecutionStateError (변경 2.3) 는 ./workflow-errors 로 이동했다 (review W-7).
// 소비자(controller / gateway / interaction)는 ./workflow-errors 에서 직접 import.

/**
 * `ExecutionEngineService.execute()` 호출 시점의 트리거 메타데이터.
 *
 * 판별 유니온으로 `executedBy` (수동 실행) 와 `triggerId` (schedule/webhook
 * 발화) 가 동시에 truthy 로 전달되는 것을 컴파일 타임에 차단한다. 두 컬럼이
 * 동시에 채워지면 deriveExecutionTrigger 분기가 manual 로 흐르며 트리거 출처
 * 정보가 손실되기 때문.
 */
export type ExecuteOptions =
  | {
      executedBy: string;
      triggerId?: never;
      // Replay/Re-run (decision F2) — 수동 re-run 으로 생성되는 실행에만 세팅.
      reRunOf?: string;
      chainId?: string;
      // dry-run re-run (RR-PL-01) — 외부 부수효과 노드가 mock 출력을 반환한다.
      dryRun?: boolean;
      // 단일 노드 실행 (§1.3) — 수동 실행(executedBy)으로만 진입. singleNodeId 가
      // 세팅되면 runExecution 이 그 노드 1개만 실행하고 downstream 으로 진행하지
      // 않는다. previousExecutionId 의 상류 출력을 입력으로 pre-seed(미지정 시
      // 수동 입력 input 으로 대체). 두 값은 execution 컬럼으로 영속돼 큐 재조회
      // 후 runExecution 이 읽는다(dry_run/source_ip 선례).
      singleNodeId?: string;
      previousExecutionId?: string;
    }
  | {
      executedBy?: never;
      triggerId: string;
      // webhook/chat-channel 발화 시 호출 메타데이터 (§A.3 호출 이력, WH-MG-05).
      // sourceIp: hooks.service 의 extractClientIp 결과. responseCode: webhook 호출이
      // 받는 실제 HTTP 응답 코드(성공 = '202'). 둘 다 optional → schedule 등 비-HTTP
      // 트리거는 미전달(NULL 영속). DI/생성자 불변(추가 인자 아님).
      sourceIp?: string;
      responseCode?: string;
    }
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
// ─── Helper Interfaces (loadAndBuildGraph / runNodeDispatchLoop) ────────────

/**
 * Graph rebuild 결과를 한 번에 운반하는 구조체. `loadAndBuildGraph` 가 반환하며
 * `runExecution` / `resumeFromCheckpoint` / `resumeGraphAfterRetry` 가 traversal
 * 단계에서 사용한다. `runNodeDispatchLoop` 의 입력 `graphState` 이기도 하다.
 *
 * **`GraphTraversalSummary` (knowledge-base RAG) 와 의미 분리** — 본 타입은
 * execution-engine 의 워크플로 graph 재구축 결과만 담는다.
 */
interface ExecutionGraphState {
  /** Workflow 에 속한 모든 노드 (container child / tool area 포함 — runContainer / runParallel 에 그대로 전달). */
  nodes: Node[];
  /** Workflow 에 속한 모든 edge (graph-builder filter 적용 전). */
  edges: Edge[];
  /** 최상위 노드만 필터된 graph edges (buildGraph 결과). */
  graphEdges: GraphEdge[];
  /** identifyBackEdges 가 forward 로 분류한 edges (topologicalSort 입력). */
  forwardEdges: GraphEdge[];
  /** identifyBackEdges 가 back 으로 분류한 edges (cyclic workflow). */
  backEdges: GraphEdge[];
  /** Topological 정렬된 노드 id 순서. */
  sortedNodeIds: string[];
  /** `sortedNodeIds` 의 id → index 역방향 O(1) lookup. */
  sortedIndexMap: Map<string, number>;
  /** sourceNodeId → list of back-edge + target sorted index. */
  backEdgeMap: Map<string, Array<{ edge: GraphEdge; targetIndex: number }>>;
  /** sourceNodeId → forward outgoing edges. */
  outgoingEdgeMap: Map<string, GraphEdge[]>;
  /** targetNodeId → forward incoming edges. */
  incomingEdgeMap: Map<string, GraphEdge[]>;
  /** id → Node 객체 lookup. */
  nodeMap: Map<string, Node>;
  /** `MAX_NODE_ITERATIONS` config (기본 100, 0 = unlimited). */
  maxNodeIterations: number;
}

/**
 * `runNodeDispatchLoop` 의 파라미터. 호출자 (`resumeFromCheckpoint` /
 * `resumeGraphAfterRetry`) 가 시작 단계 (graph rebuild + reachability seed +
 * 시작 노드 전파) 와 종결 단계 (Execution.COMPLETED 마감 + outputData seed) 를
 * 모두 책임지고, 본 helper 는 그 사이의 pointer 기반 node dispatch loop 만
 * 책임진다.
 *
 * **`GraphTraversalService` 와의 책임 분리**: `GraphTraversalService` 는 pure
 * graph reachability / propagation (외부 service 호출 없음). 본 helper 는
 * dispatch (executeNode / runContainer / runParallel / scheduleBackgroundBody)
 * + blocking wait (form / button / AI multi-turn) 까지 포함하므로 도메인 책임
 * 이 다르다.
 */
interface NodeDispatchLoopParams {
  executionId: string;
  savedExecution: Execution;
  context: ExecutionContext;
  graphState: ExecutionGraphState;
  /** Loop 가 mutate — 호출자가 helper 호출 전에 seed (예: completedNode / waitingNode 추가). */
  executedNodes: Set<string>;
  /** Loop 가 mutate — 호출자가 helper 호출 전에 seed (트리거 + no-incoming + executedNodes + 시작 노드). */
  reachable: Set<string>;
  /** Loop 가 mutate (+1 per visit) — 호출자가 helper 호출 전에 초기 entry (시작 노드 = 0) 만 set, 본 helper 의 첫 +1 이 1 이 되도록. */
  nodeExecutionCount: Map<string, number>;
  /** Loop 시작 pointer — 호출자가 시작 노드의 `sortedIndexMap.get(...) + 1` 로 설정 (시작 노드는 helper 호출 전 propagateReachability 가 이미 다음을 reachable 에 추가). */
  pointer: number;
  /** Input 객체 — gatherNodeInput 의 default fallback. resume / retry 경로엔 `{}`. */
  input: Record<string, unknown>;
  /** executeNode 의 meta — startedAt + mode. */
  dispatchMeta: { startedAt?: string; mode: 'manual' };
}

/**
 * `error.name === 'AbortError'` 판별 타입 가드. `AbortSignal.throwIfAborted()` /
 * `AbortController.abort()` / 핸들러의 수동 `err.name = 'AbortError'` 세팅 모두 커버.
 * executeNode catch 블록과 executeWithRetry 루프의 두 호출 지점을 단일 함수로 통일
 * (node-cancellation §5.1 / ai-review W10).
 *
 * `instanceof Error` 만으로는 부족: Jest VM sandbox 등 일부 환경에서 `DOMException`
 * (`AbortSignal.throwIfAborted()` 가 던지는 타입)이 다른 realm 의 `Error` 를 extends
 * 하기 때문에 `instanceof Error` 가 `false` 를 반환할 수 있다. `name` 비교를 우선해
 * 두 경우를 모두 포함한다.
 */
export function isAbortError(err: unknown): err is Error {
  if (err instanceof Error && err.name === 'AbortError') return true;
  // DOMException(AbortError) from AbortSignal.throwIfAborted() — in Jest VM
  // sandbox DOMException may not satisfy `instanceof Error` across realm
  // boundaries. Fallback: duck-type check on `name` only.
  if (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: unknown }).name === 'AbortError'
  ) {
    return true;
  }
  return false;
}

@Injectable()
export class ExecutionEngineService
  implements
    OnModuleInit,
    OnApplicationBootstrap,
    WorkflowExecutor,
    EngineDriver
{
  /** terminal 상태 집합 — 매 호출마다 재생성 방지 (SUMMARY I-5). */
  private static readonly TERMINAL_STATUSES = new Set<ExecutionStatus>([
    ExecutionStatus.COMPLETED,
    ExecutionStatus.FAILED,
    ExecutionStatus.CANCELLED,
  ]);

  private readonly logger = new Logger(ExecutionEngineService.name);

  /**
   * PR2a — §8 active-running 누적 타임아웃.
   * `maxActiveRunningMs`: 한도(ms, 0=무제한, 기본 30분, env override 가능).
   *   모듈 초기화 시 1회 평가 — 변경은 인스턴스 재시작 후 반영.
   * `segmentStartMs`: 현재 active 세그먼트의 시작 시각(ms). RUNNING 진입 시 기록,
   *   이탈 시 누적분(`Execution.activeRunningMs`)에 합산 후 제거. 세그먼트는 한
   *   인스턴스 안에서 처리되므로 in-memory Map 으로 충분(누적값은 row 에 영속).
   *
   * **설계 불변식 (W5 명시)**:
   *   단일 Execution 은 한 번에 하나의 active 세그먼트만 처리된다(직렬화 불변).
   *   `execution-run` / `execution-continuation` 큐는 동일 Execution 에 대해 동시
   *   job 을 발행하지 않으므로 `segmentStartMs.set/delete` 쌍 상호 배제가 보장된다.
   *   continuation worker concurrency > 1 이어도 서로 다른 Execution 의 job 이므로
   *   동일 `executionId` 에 대한 `segmentStartMs` 경쟁 조건은 발생하지 않는다.
   *
   * **Graceful Shutdown under-count 허용 (W4 명시)**:
   *   SIGTERM 이후 진행 중 세그먼트가 다른 worker 에 재배달되면 해당 세그먼트의
   *   active 시간이 DB 에 누락(under-count)될 수 있다. 이는 over-count(실제보다 길게
   *   측정해 정상 실행을 조기 종료)보다 덜 위험하므로 의도적으로 허용한다.
   *   PR3 stalled-job 재배달 구현 시 세그먼트 flush 훅 추가를 검토한다.
   */
  private readonly maxActiveRunningMs = resolveMaxActiveRunningMs();
  private readonly segmentStartMs = new Map<string, number>();

  // exec-park D6 full B3 (2026-06-06) — in-memory continuation/barrier 머신 제거.
  // 옛 `pendingContinuations` Map(park coroutine resolver) + `firstSegmentBarriers`
  // (worker 슬롯 해제 배리어) + `armFirstSegmentBarrier`/`settleFirstSegment` 는
  // park 가 항상 코루틴을 해제(release)하고 재개가 §7.5 rehydration 단일 경로로
  // 일원화되면서 전부 불필요해졌다. worker 는 `runExecution` 을 직접 await 한다
  // (park=세그먼트 종료이므로 슬롯 점유 없음). SoT: exec-park-durable-resume.md §B3.

  /**
   * ai-review W2 — detached `runExecution` 의 setup 단계 throw(자체 try 진입 전)
   * 로 execution 이 terminal 마킹되지 못한 경우의 best-effort 마감. 이미 terminal
   * 이면(정상 경로 — runExecution 자체 catch 가 처리) no-op. 본 핸들러 자신이 다시
   * throw 해 unhandled rejection 을 만들지 않도록 전체를 격리한다.
   */
  private async failFirstSegmentSetup(
    executionId: string,
    error: unknown,
  ): Promise<void> {
    try {
      const row = await this.executionRepository.findOneBy({ id: executionId });
      if (
        !row ||
        row.status === ExecutionStatus.COMPLETED ||
        row.status === ExecutionStatus.FAILED ||
        row.status === ExecutionStatus.CANCELLED
      ) {
        return;
      }
      const errMessage = error instanceof Error ? error.message : String(error);
      row.status = ExecutionStatus.FAILED;
      row.error = { message: errMessage };
      row.finishedAt = new Date();
      if (row.startedAt) {
        row.durationMs = row.finishedAt.getTime() - row.startedAt.getTime();
      }
      await this.executionRepository.save(row);
      await this.eventEmitter.emitExecution(
        executionId,
        ExecutionEventType.EXECUTION_FAILED,
        { status: ExecutionStatus.FAILED, error: errMessage },
      );
    } catch (markErr) {
      this.logger.error(
        `failFirstSegmentSetup(${executionId}) best-effort 마킹 실패: ${
          markErr instanceof Error ? markErr.message : String(markErr)
        }`,
      );
    }
  }

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
    private readonly contextService: ExecutionContextService,
    private readonly errorPolicyHandler: ErrorPolicyHandler,
    private readonly expressionResolver: ExpressionResolverService,
    private readonly eventEmitter: ExecutionEventEmitter,
    private readonly graphTraversal: GraphTraversalService,
    private readonly configService: ConfigService,
    private readonly llmService: LlmService,
    private readonly foreachExecutor: ForEachExecutor,
    private readonly loopExecutor: LoopExecutor,
    private readonly parallelExecutor: ParallelExecutor,
    @InjectQueue(BACKGROUND_EXECUTION_QUEUE)
    private readonly backgroundQueue: Queue<BackgroundExecutionJob>,
    @InjectQueue(EXECUTION_RUN_QUEUE)
    private readonly executionRunQueue: Queue<ExecutionRunJob>,
    private readonly continuationBus: ContinuationBusService,
    private readonly shutdownState: ShutdownStateService,
    private readonly businessMetrics: BusinessMetricsService,
    // C-1 step2 — AI 멀티턴 생명주기 위임 대상. orchestrator 가 ENGINE_DRIVER(=본
    // 엔진) 를 주입받으므로 순환 DI → forwardRef 로 해소.
    @Inject(forwardRef(() => AiTurnOrchestrator))
    private readonly aiTurnOrchestrator: AiTurnOrchestrator,
    // C-1 step3 — Form/Button blocking-interaction 위임 대상. 두 서비스가
    // ENGINE_DRIVER(=본 엔진) 를 주입받으므로 순환 DI → forwardRef 로 해소.
    @Inject(forwardRef(() => FormInteractionService))
    private readonly formInteraction: FormInteractionService,
    @Inject(forwardRef(() => ButtonInteractionService))
    private readonly buttonInteraction: ButtonInteractionService,
  ) {}

  /**
   * perf #14 — 실행 경로마다 재조회되던 정적 env 2종의 read-once 캐시.
   * spec §1.6/§11 의 자매 env 들("모듈 로드 시 1회 읽음 — 변경은 인스턴스
   * 재시작 시 반영") 과 동일 규약. lifecycle hook 대신 lazy 초기화라 직접
   * 생성되는 단위 테스트에서도 안전하다 (`resolveExecutionRunWorkerConcurrency`
   * 의 read-once 정신과 정렬 — naming W2).
   */
  private maxNodeIterationsOnce: number | null = null;
  private parallelEngineFlagOnce: string | null = null;

  private resolveMaxNodeIterations(): number {
    return (this.maxNodeIterationsOnce ??= this.configService.get<number>(
      'MAX_NODE_ITERATIONS',
      100,
    ));
  }

  private resolveParallelEngineFlag(): string {
    return (this.parallelEngineFlagOnce ??= this.configService.get<string>(
      'PARALLEL_ENGINE',
      'v1',
    ));
  }

  onModuleInit(): void {
    // NOTE: 노드 핸들러 bootstrap (ALL_NODE_COMPONENTS 등록) 은 C-1 step1 에서
    // NodeBootstrapService 로 이전됨. 본 hook 은 큐 깊이 gauge 등록 전용 —
    // 핸들러 등록 책임 없음.
    // NF-OB-07 `clemvion.queue.depth` — 본 서비스가 소유한 두 큐의 깊이를 gauge 에
    // 등록한다 (continuation 큐는 ContinuationDlqMonitorService 가 별도 등록).
    this.businessMetrics.registerQueueDepthProvider(async () => {
      const queues: Array<{ name: string; queue: Queue }> = [
        { name: EXECUTION_RUN_QUEUE, queue: this.executionRunQueue },
        { name: BACKGROUND_EXECUTION_QUEUE, queue: this.backgroundQueue },
      ];
      return Promise.all(
        queues.map(async ({ name, queue }) => {
          const c = await queue.getJobCounts(
            'waiting',
            'active',
            'delayed',
            'failed',
          );
          return {
            queue: name,
            waiting: c.waiting ?? 0,
            active: c.active ?? 0,
            delayed: c.delayed ?? 0,
            failed: c.failed ?? 0,
          };
        }),
      );
    });
    // Phase 2 (workflow-resumable-execution): 옛 ContinuationBusService.on(...)
    // 기반 in-memory listener 등록은 완전 폐기됨 (full B3). continuation 처리는
    // BullMQ Worker (continuation-execution.processor.ts) 가 담당하며 본 서비스의
    // applyContinuation / applyCancellation / isNodeExecutionWaiting public
    // 메서드를 호출한다.
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
  /**
   * Phase 2 — BullMQ Worker (continuation-execution.processor.ts) 가 호출하는
   * dispatch entry. spec/5-system/4-execution-engine.md §7.5.
   *
   * Fast path: 로컬 `pendingContinuations` Map 에 키가 있으면 즉시 resolve.
   * Slow path: 키 miss + WAITING_FOR_INPUT 상태 유효 시 §7.5 rehydration
   *   경로 진입 (rehydrateAndResume).
   *
   * sentinel wrap (spec §10.9 — 'continue' 의 `{type:'form_submitted',formData}`)
   * 은 caller (continueExecution) 가 wrap 한 채로 전달되므로 본 메서드는
   * unwrap 없이 그대로 resolver 에 전달한다.
   *
   * @param executionId Execution UUID
   * @param nodeExecutionId WAITING_FOR_INPUT NodeExecution UUID (rehydration 1차 키)
   * @param payload type 별 형태 (form_submitted sentinel / button_click /
   *                ai_message / ai_end_conversation)
   */
  async applyContinuation(
    executionId: string,
    nodeExecutionId: string,
    payload: unknown,
  ): Promise<void> {
    // ai_message 길이 가드 (인-프로세스 직접 publish 우회 방어)
    if (
      typeof payload === 'object' &&
      payload !== null &&
      (payload as { type?: string }).type === 'ai_message' &&
      typeof (payload as { message?: unknown }).message === 'string' &&
      (payload as { message: string }).message.length >
        ExecutionEngineService.MAX_MESSAGE_LENGTH
    ) {
      this.logger.warn(
        `ai_message 길이 초과로 drop — execution=${executionId}, length=${
          (payload as { message: string }).message.length
        }`,
      );
      return;
    }

    // exec-park D6 full B3 — 단일 재개 경로(slow-path 일원화). park 가 항상
    // 코루틴을 해제(release)하므로 깨울 in-memory resolver 가 없다 →
    // §7.5 rehydration 으로만 재개한다. (옛 pendingContinuations fast-path 제거.)
    await this.rehydrateAndResume(executionId, nodeExecutionId, payload);
  }

  /**
   * Phase 2 — BullMQ Worker 가 호출하는 cancel dispatch.
   * (cancelWaitingExecution → bus.publish → worker pick up → applyCancellation)
   *
   * exec-park D6 full B3 — park 가 항상 코루틴을 해제하므로 깨울 in-memory resolver
   * 가 없다. durable WAITING 행을 `cancelParkedExecution` 으로 직접 CANCELLED 마감한다
   * (WAITING_FOR_INPUT 가드로 멱등 — 이미 terminal/RUNNING 이면 no-op).
   */
  async applyCancellation(executionId: string): Promise<void> {
    await this.cancelParkedExecution(executionId);
  }

  /**
   * Phase B (PR-B1) — park-release 로 in-memory 코루틴이 없는 WAITING 실행을
   * cancel 시 직접 terminal(CANCELLED) 로 마감한다. `WAITING_FOR_INPUT` 가드로
   * 멱등 — 이미 terminal 이거나 재개로 RUNNING 이면 affected=0 → no-op(중복 emit
   * 회피). 옛 fast-path 의 "coroutine 에 ExecutionCancelledError 주입 →
   * runExecution catch 가 CANCELLED + emit" 과 동일 종착점을 코루틴 없이 DB-레벨로
   * 달성한다.
   *
   * NodeExecution 도 함께 CANCELLED 로 마킹한다: Execution 만 CANCELLED 로 전이하고
   * NodeExecution 이 WAITING_FOR_INPUT 으로 잔류하면 UI 가 영구 WAITING 을 표시하고
   * `resolveWaitingNodeExecutionId` 가 stale WAITING row 를 매칭할 수 있다 (W1/W6).
   * `execution_id + status = WAITING_FOR_INPUT` 을 키로 단일 UPDATE — 해당 row 가
   * 없으면(이미 CANCELLED / resume 으로 COMPLETED) 멱등 no-op.
   *
   * PR-B1 범위: form/button top-level park 전용. 멀티턴 AI in-memory 코루틴은
   * `applyCancellation` 이 `rejectPending` 경로로 별도 처리하므로 본 함수에 도달하지
   * 않는다. `finalizeRehydrationCleanup` 에 live AI contextService 가 없어 경합 없음.
   *
   * @remarks DB 오류는 내부 흡수 — 호출자에 예외 전파 없음 (best-effort cancel).
   */
  private async cancelParkedExecution(executionId: string): Promise<void> {
    try {
      const result = await this.executionRepository
        .createQueryBuilder()
        .update(Execution)
        .set({ status: ExecutionStatus.CANCELLED, finishedAt: new Date() })
        .where('id = :id', { id: executionId })
        .andWhere('status = :waiting', {
          waiting: ExecutionStatus.WAITING_FOR_INPUT,
        })
        .execute();
      if ((result.affected ?? 0) === 0) {
        // 이미 terminal / 재개로 RUNNING — 멱등 no-op.
        return;
      }
      // 동반 WAITING NodeExecution 도 CANCELLED 로 마킹한다. Execution UPDATE 가
      // affected:1 이었으므로 여기까지 온 경우만 실행(멱등 안전).
      // `status = WAITING_FOR_INPUT` 가드: resume 으로 이미 COMPLETED/RUNNING 으로
      // 전이된 row 는 건드리지 않는다.
      await this.nodeExecutionRepository
        .createQueryBuilder()
        .update(NodeExecution)
        .set({ status: NodeExecutionStatus.CANCELLED, finishedAt: new Date() })
        .where('execution_id = :executionId', { executionId })
        .andWhere('status = :waiting', {
          waiting: NodeExecutionStatus.WAITING_FOR_INPUT,
        })
        .execute();
      // park 시 이미 해제됐을 수 있는 in-memory 잔여(context/resolver/llm 캐시)를
      // 멱등 정리한다.
      this.finalizeRehydrationCleanup(executionId);
      try {
        await this.eventEmitter.emitExecution(
          executionId,
          ExecutionEventType.EXECUTION_CANCELLED,
          {
            status: ExecutionStatus.CANCELLED,
            result: { cancelledBy: 'user' },
          },
        );
      } catch (emitErr) {
        this.logger.warn(
          `cancelParkedExecution: EXECUTION_CANCELLED emit 실패 (cancel 은 DB 반영됨) — execution=${executionId}: ${
            emitErr instanceof Error ? emitErr.message : String(emitErr)
          }`,
        );
      }
    } catch (err) {
      this.logger.error(
        `cancelParkedExecution 실패 — execution=${executionId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Phase 2 — Worker 멱등성 가드. 처리 전 NodeExecution 이 여전히
   * WAITING_FOR_INPUT 인지 확인. 다른 worker 가 먼저 처리했으면 false 반환
   * → ack-and-discard.
   */
  async isNodeExecutionWaiting(nodeExecutionId: string): Promise<boolean> {
    if (!nodeExecutionId || nodeExecutionId === '__no_node_exec__') {
      // legacy/skipped nodeExecutionId — fast path 만 시도 (status 가드 우회).
      return true;
    }
    const row = await this.nodeExecutionRepository.findOne({
      where: { id: nodeExecutionId },
      select: { id: true, status: true },
    });
    return row?.status === NodeExecutionStatus.WAITING_FOR_INPUT;
  }

  /**
   * §7.5 Resume after Restart (rehydration) — slow path 본체.
   *
   * Phase 2.3a — 진짜 재개 로직. BullMQ Worker 가 user input 을 받은 시점에
   * 로컬 `pendingContinuations` 에 키가 없다면 (instance restart 또는 다른
   * 인스턴스가 publisher 였던 경우) 본 메서드가:
   *   1. Execution / NodeExecution / Node 정의의 invariant 검증
   *   2. `rehydrateContext` — execution_node_log 의 완료 노드 순서와
   *      NodeExecution.outputData 로 ExecutionContext (nodeOutputCache /
   *      executedNodes / variables) 재구성
   *   3. `resumeFromCheckpoint` — 그래프 순회 재개. 적절한 waitForX 메서드를
   *      직접 호출 (executeNode 우회 — 기존 NodeExecution row 가 이미
   *      WAITING_FOR_INPUT). setImmediate 로 등록된 pending resolver 를
   *      payload 와 함께 즉시 fire 해 waitForX 의 await 가 풀린다. 이후
   *      그래프 traversal 을 평소대로 진행.
   *
   * **알려진 한계** (spec §7.5 의 RESUME_INCOMPATIBLE_STATE 사례):
   * - Multi-turn AI 노드의 `_resumeState` 는 보안상 DB 에 저장되지 않으므로
   *   (WARN #6) 인스턴스 재시작 후 재개 불가 — `RESUME_INCOMPATIBLE_STATE`.
   *
   * **에러 분류**:
   * - `RESUME_CHECKPOINT_MISSING` — Execution / NodeExecution / Node 데이터가
   *   부재 또는 invariant 위반 (state mismatch 포함).
   * - `RESUME_INCOMPATIBLE_STATE` — multi-turn AI 등 in-memory 전용 상태가
   *   영속 보존되지 않은 경우.
   * - `RESUME_FAILED` — 일반 런타임 실패. BullMQ attempts 소진 dead-letter.
   *
   * @param payload — sentinel/format wrapped 사용자 입력 (form_submitted,
   *                  button_click, ai_message 등). waitForX 가 unwrap.
   */
  private async rehydrateAndResume(
    executionId: string,
    nodeExecutionId: string,
    payload: unknown,
  ): Promise<void> {
    let resolvedNodeExecutionId: string | null = null;
    try {
      const execution = await this.executionRepository.findOneBy({
        id: executionId,
      });
      if (
        !execution ||
        execution.status !== ExecutionStatus.WAITING_FOR_INPUT
      ) {
        throw new RehydrationError(
          'RESUME_CHECKPOINT_MISSING',
          `Execution ${executionId} not WAITING_FOR_INPUT (status=${execution?.status ?? 'absent'})`,
        );
      }

      // §7.5 / CCH-AD-05 — slow-path 재개 시 in-memory routing context 재등록.
      // execute() 등록과 동일 형태. terminal event 시 WebsocketService 가 자동 release.
      // (spec §4-execution-engine.md §7.5)
      if (execution.triggerId && execution.workflowId) {
        try {
          const chatChannel = extractChatChannelFromInput(execution.inputData);
          this.eventEmitter.registerExecutionRouting(executionId, {
            triggerId: execution.triggerId,
            workflowId: execution.workflowId,
            ...(chatChannel ? { chatChannel } : {}),
          });
        } catch (routingErr) {
          this.logger.warn(
            'routing context 재등록 실패 — best-effort, 실행 계속',
            {
              executionId,
              error:
                routingErr instanceof Error
                  ? routingErr.message
                  : String(routingErr),
            },
          );
        }
      }

      if (nodeExecutionId === '__no_node_exec__') {
        throw new RehydrationError(
          'RESUME_CHECKPOINT_MISSING',
          `Publisher 측 nodeExecutionId 미설정 (legacy path) — execution=${executionId}`,
        );
      }
      const nodeExec = await this.nodeExecutionRepository.findOneBy({
        id: nodeExecutionId,
      });
      if (
        !nodeExec ||
        nodeExec.status !== NodeExecutionStatus.WAITING_FOR_INPUT
      ) {
        throw new RehydrationError(
          'RESUME_CHECKPOINT_MISSING',
          `NodeExecution ${nodeExecutionId} not WAITING_FOR_INPUT (status=${nodeExec?.status ?? 'absent'})`,
        );
      }
      resolvedNodeExecutionId = nodeExec.id;

      const node = await this.nodeRepository.findOneBy({ id: nodeExec.nodeId });
      if (!node) {
        throw new RehydrationError(
          'RESUME_CHECKPOINT_MISSING',
          `Node ${nodeExec.nodeId} 정의 부재 (execution=${executionId})`,
        );
      }

      const context = await this.rehydrateContext(execution, nodeExec);

      this.logger.log(
        `Rehydration start — execution=${executionId} waitingNode=${nodeExec.nodeId} (${node.type})`,
      );
      await this.resumeFromCheckpoint(execution, context, {
        node,
        nodeExec,
        payload,
      });
      // 주의: `resumeFromCheckpoint` 는 내부 드라이브(`driveResumeAwaited` 또는
      // `driveCallStackResume`)를 **await** 해 재개 구동 전체를 완료한다 (exec-park D6
      // full B3 이후 fire-and-forget 모델 제거). 따라서 본 로그는 입력 처리 +
      // 그래프 순회 + 종결이 완료된 시점이다.
      this.logger.log(
        `Rehydration completed (drive awaited) — execution=${executionId} waitingNode=${nodeExec.nodeId}`,
      );
    } catch (err) {
      // 본 catch 는 `resumeFromCheckpoint` 내 드라이브(driveResumeAwaited /
      // driveCallStackResume)가 예외를 완전 흡수하고 반환하므로, invariant 검증 /
      // rehydrateContext / resumeFromCheckpoint 의 pre-check·graph load 단계에서
      // throw 된 경우에 도달한다. rehydrateContext 가 생성한 in-memory context /
      // config 캐시를 여기서 정리한다 — 미정리 시 동일 executionId 재시도가 오염된
      // context 를 재사용한다. (`finalizeRehydrationCleanup` 은 멱등.)
      this.finalizeRehydrationCleanup(executionId);
      if (err instanceof RehydrationError) {
        // W19: internal identifiers は structured params へ — error.message は
        // コード分類のみ。BullMQ DLQ Board / 外部ログ集積への情報漏洩防止.
        this.logger.warn('Rehydration failed', {
          code: err.code,
          executionId,
          nodeExecutionId,
        });
        await this.markExecutionCancelled(executionId, err.code);
        if (resolvedNodeExecutionId) {
          await this.markNodeExecutionFailed(resolvedNodeExecutionId, err.code);
        }
        return;
      }
      // ExecutionCancelledError 는 resumeFromCheckpoint 가 자체적으로 CANCELLED
      // 마킹 후 정상 종결하므로 여기까지 도달하지 않는다 (방어적 분기).
      if (err instanceof ExecutionCancelledError) {
        this.logger.log('Rehydration cancelled mid-flight', { executionId });
        return;
      }
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error('Rehydration unexpected error', stack, {
        executionId,
        nodeExecutionId,
      });
      await this.markExecutionCancelled(executionId, 'RESUME_FAILED');
      if (resolvedNodeExecutionId) {
        await this.markNodeExecutionFailed(
          resolvedNodeExecutionId,
          'RESUME_FAILED',
        );
      }
    }
  }

  /**
   * Phase 2.3a — ExecutionContext 재구성 (spec §7.5).
   *
   * 우선순위:
   *   1. `ExecutionContextService.getContext(executionId)` 가 살아있으면 그대로
   *      사용 (단일 process 재진입 — 거의 발생하지 않음).
   *   2. 없으면 새로 생성하고 DB 의 `execution_node_log` (완료 노드 순서) +
   *      `node_execution.output_data` (각 노드 출력) 로 채운다.
   *
   * 채워지는 항목:
   *   - `variables` — workflow.workspace 의 `__workspaceId / Name / Timezone`.
   *   - `nodeOutputCache` — execution_node_log 의 각 nodeId 의 최신 COMPLETED
   *     `NodeExecution.outputData`. 같은 nodeId 의 loop iteration 은 마지막
   *     COMPLETED 만 보존 (downstream gather 가 그 값만 읽음).
   *   - Waiting node 의 outputData (status=waiting_for_input + meta) — 별도 set
   *     해 graph loop 의 blocking check 가 인식.
   *   - `_executedNodes` (Set) — `gatherNodeInput` 이 predecessor 완료 여부
   *     판단에 사용.
   *   - `conversationThread` — park 시 durable commit 된
   *     `Execution.conversation_thread` 스냅샷에서 `rehydrateConversationThread`
   *     로 무손실 복원 (spec §6.2/§7.5, conversation-thread §4·§8.4). NULL(park
   *     이력 없음/배포 이전 row)이면 빈 thread (회귀 없음).
   *   - `variables` — `Execution.user_variables` 스냅샷에서 사용자 정의 변수를
   *     merge 한 뒤 시스템 `__*` 변수를 덮어쓴다 (spec §6.1/§6.2/§7.5).
   *     반환 context.variables 에는 user_variables 스냅샷이 merge 됨.
   *
   * 채워지지 않는 항목 (의도적):
   *   - `_resumeState` — multi-turn AI 의 in-memory 전용 (WARN #6). 영속 보존 X
   *     → 후속 `resumeFromCheckpoint` 가 ai_conversation 케이스를 거부.
   */
  private async rehydrateContext(
    execution: Execution,
    waitingNodeExec: NodeExecution,
  ): Promise<ExecutionContext> {
    const existing = this.contextService.getContext(execution.id);
    if (existing) return existing;

    const workflow = await this.workflowRepository.findOne({
      where: { id: execution.workflowId },
      relations: ['workspace'],
    });
    if (!workflow) {
      throw new RehydrationError(
        'RESUME_CHECKPOINT_MISSING',
        `Workflow ${execution.workflowId} 부재 (execution=${execution.id})`,
      );
    }
    const workspaceTimezone = workflow.workspace?.settings?.['timezone'];
    const workspaceName = workflow.workspace?.name;

    const context = this.contextService.createContext(
      execution.id,
      execution.workflowId,
      {
        initialVariables: {
          // 사용자 정의 variables 무손실 복원 (spec §6.1/§6.2/§7.5) — park 시
          // `Execution.user_variables` 에 durable commit 된 스냅샷에서 정규화 복원.
          // NULL(park 이력 없음/배포 이전 row)이면 빈 객체(회귀 없음). 시스템 `__*`
          // 는 아래에서 재주입하므로, user vars 를 먼저 펼쳐 충돌 시 `__*` 가 이긴다.
          ...this.rehydrateUserVariables(execution.userVariables),
          __workspaceId: workflow.workspaceId ?? '',
          __workspaceName:
            typeof workspaceName === 'string' ? workspaceName : '',
          __workspaceTimezone:
            typeof workspaceTimezone === 'string' ? workspaceTimezone : '',
          // dry-run 플래그 복원 (rehydration) — spec §7.2. 핸들러는
          // `context.variables.__dryRun === true` 로 mock 분기.
          __dryRun: execution.dryRun ?? false,
        },
        recursionDepth: execution.recursionDepth,
        // conversationThread 무손실 복원 (spec §6.2/§7.5, conversation-thread
        // §4·§8.4). park 시 durable commit 된 `Execution.conversation_thread`
        // 스냅샷에서 thread 를 정규화 복원한다 — 빈 thread 리셋으로 인한 대화
        // 맥락 소실(runningSummary 포함)을 제거. NULL(park 이력 없음/배포 이전
        // row)이면 rehydrateConversationThread 가 빈 thread 를 반환(회귀 없음).
        conversationThread: rehydrateConversationThread(
          execution.conversationThread,
        ),
      },
    );
    const executedNodes = new Set<string>();
    context._executedNodes = executedNodes;

    const logs = await this.executionNodeLogRepository.find({
      where: { executionId: execution.id },
      order: { id: 'ASC' },
    });

    // 같은 nodeId 가 loop iteration 으로 여러 row 일 수 있음 — 1회만 처리.
    // perf #1 — nodeId 당 findOne(N+1) 직렬 왕복을 단일 In() 배치 조회로.
    // startedAt DESC 전역 정렬에서 nodeId 별 첫 등장 row = 그 노드의 최신
    // COMPLETED (기존 per-node findOne(order DESC) 와 동일 의미론 — V034
    // (execution_id, node_id, started_at DESC) 인덱스가 정확히 커버).
    const seenNodeIds: string[] = [];
    const seenNodeIdSet = new Set<string>();
    for (const log of logs) {
      if (seenNodeIdSet.has(log.nodeId)) continue;
      seenNodeIdSet.add(log.nodeId);
      seenNodeIds.push(log.nodeId);
    }
    const latestCompletedByNodeId = new Map<string, NodeExecution>();
    if (seenNodeIds.length > 0) {
      const completedRows = await this.nodeExecutionRepository.find({
        where: {
          executionId: execution.id,
          nodeId: In(seenNodeIds),
          status: NodeExecutionStatus.COMPLETED,
        },
        order: { startedAt: 'DESC' },
      });
      for (const row of completedRows) {
        if (!latestCompletedByNodeId.has(row.nodeId)) {
          latestCompletedByNodeId.set(row.nodeId, row);
        }
      }
    }
    // log 순서(id ASC 의 distinct 순) 순회는 보존 — 복원 순서 의미 불변.
    for (const nodeId of seenNodeIds) {
      const ne = latestCompletedByNodeId.get(nodeId);
      if (!ne) continue;
      if (ne.outputData) {
        this.contextService.setNodeOutput(
          this.contextKeyOf(context),
          nodeId,
          ne.outputData,
        );
      }
      executedNodes.add(nodeId);
    }

    // Waiting node 의 outputData 복원 — runExecution 의 executeNode 가 normally
    // setNodeOutput 으로 nodeOutputCache 에 채운 envelope (status=waiting_for_input
    // + meta.interactionType) 와 동일.
    if (waitingNodeExec.outputData) {
      this.contextService.setNodeOutput(
        this.contextKeyOf(context),
        waitingNodeExec.nodeId,
        waitingNodeExec.outputData,
      );
    }

    return context;
  }

  /**
   * Workflow id 로 graph state 를 한 번에 재구축. `runExecution` /
   * `resumeFromCheckpoint` / `resumeGraphAfterRetry` 3 곳에서 공유 (이전엔
   * 동일 패턴이 3중 복제 — PR #365 ai-review WARNING #11 해소).
   *
   * 책임:
   *   - `nodeRepository.findBy` / `edgeRepository.findBy` 로 DB 로드
   *   - `buildGraph` → topological filtering (container child / tool area 제외)
   *   - `identifyBackEdges` + `topologicalSort` → forward edges 기반 정렬
   *   - `sortedIndexMap` + `graphTraversal.buildEdgeIndexes` (back / outgoing / incoming)
   *   - `nodeMap` 생성 + `MAX_NODE_ITERATIONS` config 로드
   *
   * 본 helper 자체는 호출자의 nodeOutputCache / executedNodes / reachable 등
   * traversal 상태를 다루지 않는다 — 호출자가 helper 결과를 seed 입력으로 사용한다.
   *
   * @throws {Error} DB 조회 실패(`nodeRepository`/`edgeRepository`) 또는 그래프 빌드
   *   단계(`buildGraph` / `topologicalSort` / `buildEdgeIndexes`) 오류 — 호출자의
   *   catch 블록이 처리한다.
   */
  private async loadAndBuildGraph(
    workflowId: string,
  ): Promise<ExecutionGraphState> {
    const nodes = await this.nodeRepository.findBy({ workflowId });
    const edges = await this.edgeRepository.findBy({ workflowId });
    const { graphNodes, graphEdges } = buildGraph(nodes, edges);
    const { forwardEdges, backEdges } = identifyBackEdges(
      graphNodes,
      graphEdges,
    );
    const sortedNodeIds = topologicalSort(graphNodes, forwardEdges);
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
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const maxNodeIterations = this.resolveMaxNodeIterations();
    return {
      nodes,
      edges,
      graphEdges,
      forwardEdges,
      backEdges,
      sortedNodeIds,
      sortedIndexMap,
      backEdgeMap,
      outgoingEdgeMap,
      incomingEdgeMap,
      nodeMap,
      maxNodeIterations,
    };
  }

  /**
   * Pointer 기반 node dispatch loop — `resumeFromCheckpoint` 와
   * `resumeGraphAfterRetry` 가 공유 (이전엔 약 175라인 중복 — PR #365 ai-review
   * WARNING #10 해소).
   *
   * 호출자가 helper 호출 **전에** 처리:
   *   - graph state 구축 (`loadAndBuildGraph`)
   *   - reachable seed (트리거 + no-incoming + executedNodes + 시작 노드)
   *   - 시작 노드의 `executedNodes.add` + `propagateReachability` + back-edge
   *     처리 → params.pointer 도출
   *   - `nodeExecutionCount` 초기 entry — **시작 노드는 0 으로 set** (WARNING #16
   *     해소: 첫 +1 이 1 이 되어 MAX_NODE_ITERATIONS=1 환경에서 false positive
   *     방지. 이전 1 초기값은 back-edge 재방문 시 2 가 되어 곧장 한도 초과)
   *
   * 호출자가 helper 호출 **후에** 처리:
   *   - Execution.COMPLETED 마감 + lastNode outputData seed + EXECUTION_COMPLETED emit
   *
   * Loop 내부 동작 (한 노드 visit 당):
   *   1. pointer / reachable / count 가드 (MAX_NODE_ITERATIONS 초과 시 throw)
   *   2. isDisabled → handleDisabledNode + pointer++
   *   3. gatherNodeInput → executeNode (한 번만 호출, parallel 분기에서도 재사용 — WARNING #14)
   *   4. dispatchKind 별 (container / background / parallel) 후속 처리
   *   5. blocking node (form / button / AI multi-turn) → waitForX
   *   6. propagateReachability + back-edge 처리 → pointer 갱신
   *
   * @returns `{ parked: boolean }` — `parked: true` 이면 루프가 blocking node
   *   (`waitForX`)에서 PARK_RELEASED 를 수신해 park 로 종료(top-level fresh park,
   *   caller 가 세그먼트 종료 처리). `parked: false` 이면 루프가 정상 완료(다음
   *   노드 없음 또는 완료 경로). 양 경우 모두 caller 가 후속 cleanup 을 수행한다.
   *   spec §4.x `runNodeDispatchLoop` 반환 계약 (SPEC-DRIFT W3 — 코드 동작이 옳고
   *   spec 이 따라온다; spec 갱신은 spec-update-execution-engine.md 참조).
   * @throws {Error} `MAX_NODE_ITERATIONS` 초과 — 노드 순환 한도 초과 메시지 포함.
   *   호출자의 catch 블록이 실행 실패로 마감한다.
   * @throws {ExecutionCancelledError} 실행 취소 신호 수신 — 호출자의 catch 블록이
   *   처리한다.
   */
  private async runNodeDispatchLoop(
    params: NodeDispatchLoopParams,
  ): Promise<{ parked: boolean }> {
    const {
      executionId,
      savedExecution,
      context,
      graphState,
      executedNodes,
      reachable,
      nodeExecutionCount,
      input,
      dispatchMeta,
    } = params;
    const {
      nodes,
      edges,
      graphEdges,
      forwardEdges,
      backEdges,
      sortedNodeIds,
      backEdgeMap,
      outgoingEdgeMap,
      incomingEdgeMap,
      nodeMap,
      maxNodeIterations,
    } = graphState;
    let pointer = params.pointer;

    try {
      while (pointer < sortedNodeIds.length) {
        // PR2a — §8 노드 사이마다 active-running 누적 타임아웃 검사 (초과 시 throw).
        this.assertActiveTimeWithinLimit(savedExecution);
        const nodeId = sortedNodeIds[pointer];
        const node = nodeMap.get(nodeId);
        if (!node) {
          pointer++;
          continue;
        }
        if (!reachable.has(nodeId)) {
          pointer++;
          continue;
        }
        const count = (nodeExecutionCount.get(nodeId) ?? 0) + 1;
        nodeExecutionCount.set(nodeId, count);
        if (maxNodeIterations > 0 && count > maxNodeIterations) {
          throw new Error(
            `Node "${node.label ?? node.type}" exceeded maximum iteration count (${maxNodeIterations}). ` +
              `Set MAX_NODE_ITERATIONS=0 for unlimited.`,
          );
        }
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
        const nodeInput = this.gatherNodeInput(
          nodeId,
          graphEdges,
          executedNodes,
          context.nodeOutputCache,
          input,
          incomingEdgeMap,
        );
        await this.executeNode(
          executionId,
          node,
          nodeInput,
          context,
          executedNodes,
          nodeMap,
          dispatchMeta,
          outgoingEdgeMap,
        );
        const dispatchKind = this.handlerRegistry.getMetadata(node.type).kind;
        if (dispatchKind === 'container') {
          await this.runContainer(
            node,
            nodes,
            edges,
            context,
            executionId,
            executedNodes,
            dispatchMeta,
          );
        }
        if (dispatchKind === 'background') {
          await this.scheduleBackgroundBody(
            node,
            edges,
            context,
            executionId,
            input,
          );
        }
        if (
          dispatchKind === 'parallel' &&
          // PR #364 (default ON) 정책 정합 — runExecution / resumeFromCheckpoint
          // 가 모두 'v1' default. helper 도 동일 default 사용해 retry 경로의
          // 우연한 'off' default (PR #365 잔재) 도 동시 통일.
          this.resolveParallelEngineFlag() === 'v1'
        ) {
          // WARNING #14: `gatherNodeInput` 의 두 번째 호출을 제거 — 이미 위에서
          // 동일 인자로 호출한 결과 `nodeInput` 을 재사용.
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
            dispatchMeta,
            reachable,
            nodeInput,
          );
          pointer++;
          continue;
        }

        // Blocking nodes (form / button / AI multi-turn — downstream 에 존재할 수
        // 있음, 정상 흐름과 동일하게 처리).
        const downstreamOutput = context.nodeOutputCache[node.id] as
          | Record<string, unknown>
          | undefined;
        const downstreamInteraction = this.getInteractionType(context, node.id);
        if (downstreamOutput?.status === 'waiting_for_input') {
          const downstreamBlocking = this.handlerRegistry.getMetadata(
            node.type,
          );
          if (
            downstreamBlocking.kind === 'blocking' &&
            downstreamBlocking.interaction === 'form'
          ) {
            // Phase B (PR-B1) — resume/retry 드라이브가 downstream top-level
            // 블로킹 노드에 도달해 fresh park 하면 release 한다. PARK_RELEASED 수신
            // 시 이 드라이브 세그먼트를 종료하고 { parked:true } 를 caller
            // (driveResumeAwaited / resumeGraphAfterRetry)로 올려 코루틴을 해제한다.
            const parkSignal = await this.formInteraction.waitForFormSubmission(
              savedExecution,
              executionId,
              node,
              context,
            );
            if (parkSignal === PARK_RELEASED) return { parked: true };
          } else if (downstreamInteraction === 'buttons') {
            const parkSignal =
              await this.buttonInteraction.waitForButtonInteraction(
                savedExecution,
                executionId,
                node,
                context,
                graphEdges,
              );
            if (parkSignal === PARK_RELEASED) return { parked: true };
          } else if (downstreamInteraction === 'ai_conversation') {
            // Phase B (PR-B2, exec-park D4) — top-level 멀티턴 AI turn-park.
            // resume/retry 드라이브가 downstream AI 노드에 도달해 fresh park 하면
            // release 해 세그먼트 종료(코루틴 해제). 후속 turn 은 rehydration 재개.
            const parkSignal =
              await this.aiTurnOrchestrator.waitForAiConversation(
                savedExecution,
                executionId,
                node,
                context,
              );
            if (parkSignal === PARK_RELEASED) return { parked: true };
          }
        }

        this.graphTraversal.propagateReachability(
          nodeId,
          outgoingEdgeMap,
          context.nodeOutputCache,
          reachable,
        );

        const downstreamBackEdges = backEdgeMap.get(nodeId);
        if (downstreamBackEdges?.length) {
          const activated = this.findActivatedBackEdge(
            nodeId,
            downstreamBackEdges,
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
    } catch (err) {
      // exec-park D6 — 그래프 순회 중 중첩 sub-workflow blocking 노드가 durable
      // release park 하면 executeNode/runParallel/runContainer 가 `ParkReleaseSignal`
      // 을 throw 한다. 세그먼트를 park 로 종료(코루틴 해제)하고 caller
      // (driveResumeAwaited / driveCallStackResume / resumeGraphAfterRetry)가
      // COMPLETED 마감을 건너뛰게 한다. 다른 예외(ExecutionCancelledError /
      // MAX_NODE_ITERATIONS 등)는 그대로 전파.
      if (err instanceof ParkReleaseSignal) {
        return { parked: true };
      }
      throw err;
    }
    // 자연 종결 — 그래프를 끝까지 순회(park 없이). caller 가 completion 진행.
    return { parked: false };
  }

  /**
   * Phase 2.3a — §7.5 resume body. 재구성된 context 로 waitForX 직접 invoke 후
   * 그래프 순회를 이어 진행한다. runExecution 의 setup/loop/completion/catch
   * 구조와 동일 — 차이점:
   *   - graph state 를 새로 build (재시작 후 in-memory 자료 소실)
   *   - reachability 와 executedNodes 를 rehydrated state 로 seed
   *   - executeNode 우회: 기존 NodeExecution row 가 이미 WAITING_FOR_INPUT
   *     이므로 새 row 를 만들지 않고 waitForX 만 호출
   *   - setImmediate polling (최대 50회) 으로 pendingContinuations resolver
   *     등록을 대기 후 payload fire (waitForX 등록 완료 tick 에 실행)
   */
  private async resumeFromCheckpoint(
    savedExecution: Execution,
    context: ExecutionContext,
    opts: { node: Node; nodeExec: NodeExecution; payload: unknown },
  ): Promise<void> {
    // Persisted interaction type — meta.interactionType (preferred) or top-level
    // (legacy / blocking ai_form_render path).
    const cachedOutput = context.nodeOutputCache[opts.node.id] as
      | Record<string, unknown>
      | undefined;
    const cachedMeta =
      (cachedOutput?.meta as Record<string, unknown> | undefined) ?? {};
    const persistedInteractionType =
      (cachedMeta.interactionType as string | undefined) ??
      (cachedOutput?.interactionType as string | undefined);

    // Multi-turn AI 재개 (§7.5) — `_resumeCheckpoint` (credential-strip 부분집합)
    // 가 DB 영속돼 있으면 `node.config` 재평가로 `_resumeState` 를 재구성해 재개한다
    // (아래 ai_conversation 분기). checkpoint 가 **부재**(이 기능 배포 이전 진입한
    // waiting row) 또는 손상이면 재구성 불가 — graceful reset 으로 fail-fast 한다.
    // 채널 어댑터(텔레그램 등)는 `RESUME_INCOMPATIBLE_STATE` 를 raw 에러가 아닌
    // "대화 세션 만료 — 새로 시작" 안내로 사용자에게 표시한다.
    const isAiConversation =
      persistedInteractionType === 'ai_conversation' ||
      persistedInteractionType === 'ai_form_render';
    const resumeCheckpoint = cachedOutput?._resumeCheckpoint as
      | Record<string, unknown>
      | undefined;
    if (isAiConversation && !resumeCheckpoint) {
      throw new RehydrationError(
        'RESUME_INCOMPATIBLE_STATE',
        `Multi-turn AI 노드(${opts.node.type})의 _resumeCheckpoint 부재 — 재구성 불가 (배포 이전 waiting row 또는 손상). graceful reset: 사용자는 새 대화로 시작.`,
      );
    }
    // 스키마 버전 가드 (§1.3 / §7.5) — checkpoint 의 schemaVersion 이 현재 코드
    // 지원 버전을 초과하면(롤링 배포 중 구 인스턴스가 신 포맷 pickup) 안전하게
    // 재구성할 수 없으므로 graceful reset. 버전 부재(구 row)·이하는 호환 처리.
    if (isAiConversation && resumeCheckpoint) {
      const ckptVersion = resumeCheckpoint.schemaVersion;
      if (
        typeof ckptVersion === 'number' &&
        ckptVersion > CHECKPOINT_SCHEMA_VERSION
      ) {
        throw new RehydrationError(
          'RESUME_INCOMPATIBLE_STATE',
          `Multi-turn AI 노드(${opts.node.type})의 _resumeCheckpoint schemaVersion(${ckptVersion}) 이 현재 지원 버전(${CHECKPOINT_SCHEMA_VERSION}) 초과 — 안전 재구성 불가. graceful reset: 사용자는 새 대화로 시작.`,
        );
      }
    }

    // exec-park D6 — 중첩 sub-workflow 안에서 park 한 경우(`resume_call_stack`
    // 영속) frame-by-frame 재진입 드라이브로 분기한다. waiting 노드가 top-level
    // 그래프에 없으므로(서브워크플로 소속) 아래 top-level 경로는 못 쓴다.
    const callStack = savedExecution.resumeCallStack;
    if (
      callStack &&
      Array.isArray(callStack.frames) &&
      callStack.frames.length
    ) {
      // 스키마 버전 가드 — 롤링 배포 중 구 인스턴스가 신 포맷 pickup 방어.
      if (
        typeof callStack.version === 'number' &&
        callStack.version > CALL_STACK_SCHEMA_VERSION
      ) {
        throw new RehydrationError(
          'RESUME_INCOMPATIBLE_STATE',
          `resume_call_stack version(${callStack.version}) 이 지원 버전(${CALL_STACK_SCHEMA_VERSION}) 초과 — 안전 재진입 불가. graceful reset.`,
        );
      }
      // exec-park D6 full B3 — 최내 form/button/AI 모두 직접 처리기(processX /
      // processAiResumeTurn)로 도착 payload 를 전달하므로 in-memory pending/firePayload
      // 폴링이 불필요하다. drive 는 한 세그먼트(또는 re-park 까지)만 처리하고 반환하므로
      // worker 가 직접 await 한다(옛 detach + barrier 제거). drive 는 내부 try/catch/finally
      // 로 단말 상태를 자기 마킹하므로 예외를 worker 로 전파하지 않는다.
      await this.driveCallStackResume(savedExecution, context, {
        node: opts.node,
        nodeExec: opts.nodeExec,
        callStack,
        persistedInteractionType,
        isAiConversation,
        resumeCheckpoint,
        cachedOutput,
        payload: opts.payload,
      });
      return;
    }

    // 그래프 상태 재구축 — `loadAndBuildGraph` 가 3 호출자 공통 (PR #365
    // ai-review WARNING #11 해소).
    const graphState = await this.loadAndBuildGraph(savedExecution.workflowId);
    // graphEdges / backEdgeMap / outgoingEdgeMap 는 detached drive
    // (`driveResumeAwaited`) 가 graphState 에서 직접 destructure — 여기(worker 가
    // await 하는 setup)에서는 reachability seed / pointer 산출만 필요하다.
    const { sortedNodeIds, sortedIndexMap, nodeMap, forwardEdges } = graphState;

    const waitingPointer = sortedIndexMap.get(opts.node.id);
    if (waitingPointer === undefined) {
      throw new RehydrationError(
        'RESUME_CHECKPOINT_MISSING',
        `Waiting node ${opts.node.id} not in sorted graph (workflow=${savedExecution.workflowId})`,
      );
    }

    // reachability seed (트리거 + no-incoming) + 복원된 완료 노드 + waiting node.
    const reachable = this.graphTraversal.seedInitialReachability(
      sortedNodeIds,
      nodeMap,
      forwardEdges,
    );
    const executedNodes = context._executedNodes ?? new Set<string>();
    context._executedNodes = executedNodes;
    for (const nid of executedNodes) reachable.add(nid);
    reachable.add(opts.node.id);

    // nodeExecutionCount — 재시작 후 budget 은 fresh. waiting node 의 초기값은
    // helper 호출 직전에 0 으로 set 한다 (WARNING #16 해소, 위 helper 호출 참조).
    const nodeExecutionCount = new Map<string, number>();

    // exec-park D6 full B3 — top-level resume 구동. 도착 payload 를
    // `driveResumeAwaited` 가 직접 처리기(processFormResumeTurn /
    // processButtonResumeTurn / processAiResumeTurn)로 전달하므로 in-memory
    // pendingContinuations/firePayload 폴링이 제거됐다. drive 는 한 세그먼트(또는
    // 멀티턴 AI 의 한 turn → re-park)만 처리하고 반환하므로 worker 가 직접 await 한다
    // (옛 detach 모델 폐기 — 장수 루프가 사라져 worker 슬롯 deadlock 위험 없음).
    // drive 는 내부 try/catch/finally 로 단말 상태를 자기 마킹하므로 예외를 worker 로
    // 전파하지 않는다.
    await this.driveResumeAwaited(savedExecution, context, {
      node: opts.node,
      nodeExec: opts.nodeExec,
      graphState,
      waitingPointer,
      reachable,
      executedNodes,
      nodeExecutionCount,
      persistedInteractionType,
      isAiConversation,
      resumeCheckpoint,
      cachedOutput,
      payload: opts.payload,
    });
  }

  /**
   * §7.5 rehydration 대기-노드 turn dispatch registry (extension seam, ai-review/
   * exec-park B-1). 등록 순서대로 first-match-wins — 우선순위는 배열 순서가 표현한다
   * (form → buttons → ai_conversation, 추출 전 if/else 와 동일). 새 blocking 노드
   * 타입은 여기에 `ResumeTurnDispatch` 항목 1개를 추가하면 top-level
   * (`driveResumeAwaited`)·중첩(`driveResumeFrame`) 양쪽 재개에 자동 반영된다.
   * 지연 초기화 — `this` 처리기 메서드를 캡처하는 closure 이므로 첫 접근 시 빌드.
   */
  private _resumeTurnRegistry?: readonly ResumeTurnDispatch[];

  private get resumeTurnRegistry(): readonly ResumeTurnDispatch[] {
    return (this._resumeTurnRegistry ??= [
      {
        kind: 'form',
        selects: (sel) => sel.blockingInteraction === 'form',
        // C-1 step3 — form resume turn 처리는 FormInteractionService 로 위임.
        handle: async (ctx) => {
          await this.formInteraction.processFormResumeTurn(
            ctx.savedExecution,
            ctx.executionId,
            ctx.node,
            ctx.context,
            ctx.payload,
          );
        },
      },
      {
        kind: 'buttons',
        selects: (sel) => sel.persistedInteractionType === 'buttons',
        // C-1 step3 — button resume turn 처리는 ButtonInteractionService 로 위임.
        handle: async (ctx) => {
          await this.buttonInteraction.processButtonResumeTurn(
            ctx.savedExecution,
            ctx.executionId,
            ctx.node,
            ctx.context,
            ctx.payload,
          );
        },
      },
      {
        kind: 'ai_conversation',
        // selects 가 `this.isCheckpointEligibleNodeType` 를 캡처한다 — registry 항목
        // 자체가 서비스 인스턴스에서 빌드(handle 도 this.processX 를 호출)되므로 의도된
        // 결합이다. (ai-review W6 — 인터페이스는 순수 데이터지만 본 registry 는
        // service-bound 가 전제. 외부에서 독립 구성할 계약이 아니다.)
        selects: (sel) =>
          sel.isAiConversation &&
          sel.hasResumeCheckpoint &&
          this.isCheckpointEligibleNodeType(sel.node.type),
        // C-1 step2 — AI resume turn 진입점은 AiTurnOrchestrator 로 위임.
        handle: (ctx) => this.aiTurnOrchestrator.handleAiResumeTurn(ctx),
      },
    ]);
  }

  /**
   * §7.5 rehydration — 대기 노드의 도착 continuation payload 를 노드-타입별 resume
   * 처리기로 라우팅하는 **단일 진입점**. top-level(`driveResumeAwaited`)·중첩
   * (`driveResumeFrame`) 양쪽이 공유한다 (추출 전 두 곳에 중복돼 있던 form/buttons/ai
   * if/else 를 `resumeTurnRegistry` 조회로 일원화).
   * @returns `PARK_RELEASED` = (AI) turn 처리 후 re-park 로 세그먼트 종료 ·
   *          `void` = 노드 완료(호출측이 그래프 순회 계속).
   * @throws {RehydrationError} code=`RESUME_CHECKPOINT_MISSING` — 매칭 처리기 없음
   *          (지원하지 않는 interaction). 호출측 outer catch 가 단말 마킹.
   * @throws {RehydrationError} code=`RESUME_INCOMPATIBLE_STATE` — AI handler 의
   *          `_resumeCheckpoint` 재구성 실패(schema drift/손상). graceful reset.
   */
  private async dispatchResumeTurn(
    ctx: ResumeTurnContext,
  ): Promise<ProcessTurnResult> {
    const blockingMeta = this.handlerRegistry.getMetadata(ctx.node.type);
    const selector: ResumeTurnSelector = {
      node: ctx.node,
      blockingInteraction:
        blockingMeta.kind === 'blocking' ? blockingMeta.interaction : undefined,
      persistedInteractionType: ctx.persistedInteractionType,
      isAiConversation: ctx.isAiConversation,
      hasResumeCheckpoint: !!ctx.resumeCheckpoint,
    };
    const handler = this.resumeTurnRegistry.find((h) => h.selects(selector));
    if (!handler) {
      throw new RehydrationError(
        'RESUME_CHECKPOINT_MISSING',
        `Unsupported interaction type for rehydration: ${
          ctx.persistedInteractionType ?? '(unknown)'
        } (node type=${ctx.node.type})`,
      );
    }
    return handler.handle(ctx);
  }

  /**
   * §7.5 rehydration (top-level) — `resumeFromCheckpoint` 가 **await** 하는 전체
   * resume 구동: 도착 continuation payload 를 대기 노드의 직접 처리기
   * (`processFormResumeTurn` / `processButtonResumeTurn` / `processAiResumeTurn`)로
   * 전달 → 남은 그래프 순회(`runNodeDispatchLoop`) → 종결. **park = 세그먼트 종료**
   * (full B3 — 옛 detached coroutine + `waitForAiConversation` 장수 루프 제거)이므로
   * 한 turn(또는 한 세그먼트)만 처리하고 반환한다 → worker(concurrency=1) 슬롯
   * 점유 deadlock 없음. 본 메서드는 단말 상태(COMPLETED/CANCELLED/FAILED)를 스스로
   * 마킹·cleanup 하고, 그 자체의 2차 실패만 호출측(`rehydrateAndResume` outer catch)이
   * 흡수한다. (메서드명은 옛 detach 모델의 잔재 — 현재는 awaited 구동.)
   */
  private async driveResumeAwaited(
    savedExecution: Execution,
    context: ExecutionContext,
    opts: {
      node: Node;
      nodeExec: NodeExecution;
      graphState: ExecutionGraphState;
      waitingPointer: number;
      reachable: Set<string>;
      executedNodes: Set<string>;
      nodeExecutionCount: Map<string, number>;
      persistedInteractionType: string | undefined;
      isAiConversation: boolean;
      resumeCheckpoint: Record<string, unknown> | undefined;
      cachedOutput: Record<string, unknown> | undefined;
      // Phase B (PR-B2) — 멀티턴 AI turn-park 재개의 도착 continuation payload.
      payload: unknown;
    },
  ): Promise<void> {
    const executionId = savedExecution.id;
    const {
      node,
      graphState,
      reachable,
      executedNodes,
      nodeExecutionCount,
      persistedInteractionType,
      isAiConversation,
      resumeCheckpoint,
      cachedOutput,
    } = opts;
    const { sortedNodeIds, outgoingEdgeMap, backEdgeMap } = graphState;
    try {
      // 사전 상태 전이: Execution 은 DB 에서 WAITING_FOR_INPUT 으로 로드됨.
      // waitForX 가 (RUNNING → WAITING_FOR_INPUT) 전이를 시도하므로 먼저 RUNNING
      // 으로 옮긴다 (spec §1.1 의 resume sentinel transition).
      await this.updateExecutionStatus(savedExecution, ExecutionStatus.RUNNING);

      // 직접 처리기 invoke — executeNode 우회 + in-memory 머신 없이 도착 payload 를
      // 직접 전달(exec-park D6 full B3). 노드-타입별 분기는 `resumeTurnRegistry`
      // (form/buttons/ai)로 일원화됐다 (`dispatchResumeTurn` — 중첩 `driveResumeFrame`
      // 과 공유). AI 가 계속(re-park)이면 PARK_RELEASED 반환 → 세그먼트 종료.
      const turnOutcome = await this.dispatchResumeTurn({
        savedExecution,
        executionId,
        node,
        context,
        nodeExec: opts.nodeExec,
        persistedInteractionType,
        isAiConversation,
        resumeCheckpoint,
        cachedOutput,
        payload: opts.payload,
      });
      if (turnOutcome === PARK_RELEASED) {
        return;
      }

      // waitForX 종결 → waiting node 완료. executedNodes 에 등록 + reachability 전파.
      executedNodes.add(node.id);
      this.graphTraversal.propagateReachability(
        node.id,
        outgoingEdgeMap,
        context.nodeOutputCache,
        reachable,
      );

      // back-edge 처리 (cyclic workflow 지원). runExecution 의 동일 부분과 일치.
      let pointer = opts.waitingPointer + 1;
      const backEdgesFromWaiting = backEdgeMap.get(node.id);
      if (backEdgesFromWaiting?.length) {
        const activated = this.findActivatedBackEdge(
          node.id,
          backEdgesFromWaiting,
          context.nodeOutputCache,
        );
        if (activated) {
          for (let i = activated.targetIndex; i <= opts.waitingPointer; i++) {
            reachable.delete(sortedNodeIds[i]);
          }
          reachable.add(sortedNodeIds[activated.targetIndex]);
          pointer = activated.targetIndex;
        }
      }

      // WARNING #16 — nodeExecutionCount 초기값 0 통일. waitingNode 는 위에서
      // executedNodes 에 추가되어 helper 는 그 다음 노드부터 dispatch.
      nodeExecutionCount.set(node.id, 0);

      // 남은 그래프 traversal — `runNodeDispatchLoop` 가 공통 helper
      // (resumeGraphAfterRetry 와 공유, PR #365 ai-review WARNING #10 해소).
      // savedExecution 의 input 은 재기동 후 사라졌으므로 빈 객체로 대체.
      const dispatchResult = await this.runNodeDispatchLoop({
        executionId,
        savedExecution,
        context,
        graphState,
        executedNodes,
        reachable,
        nodeExecutionCount,
        pointer,
        input: {},
        dispatchMeta: {
          startedAt: savedExecution.startedAt?.toISOString(),
          mode: 'manual',
        },
      });

      // Phase B (PR-B1) — 이 resume 드라이브 도중 downstream top-level 블로킹
      // 노드가 fresh park(release)하면 세그먼트가 여기서 종료된다. Execution 은
      // WAITING_FOR_INPUT 으로 남고, 다음 continuation 이 §7.5 rehydration 으로
      // 재개한다. COMPLETED 마감을 건너뛰고 반환 — finally 가 context 해제.
      if (dispatchResult.parked) {
        return;
      }

      // COMPLETED 처리. outputData/finishedAt/durationMs 를 먼저 세팅한 뒤
      // guarded updateExecutionStatus 가 status 와 함께 원자적으로 영속한다 (M-3 —
      // 옛 2-save 를 1 guarded UPDATE 로). affected=0(동시 cancel/park 선점)이면
      // emit skip.
      const lastNodeId = sortedNodeIds[sortedNodeIds.length - 1];
      if (lastNodeId) {
        savedExecution.outputData =
          (context.nodeOutputCache[lastNodeId] as
            | Record<string, unknown>
            | undefined) ?? {};
        savedExecution.finishedAt = new Date();
        savedExecution.durationMs =
          savedExecution.finishedAt.getTime() -
          savedExecution.startedAt.getTime();
      }
      const completed = await this.updateExecutionStatus(
        savedExecution,
        ExecutionStatus.COMPLETED,
      );
      if (completed) {
        await this.eventEmitter.emitExecution(
          executionId,
          ExecutionEventType.EXECUTION_COMPLETED,
          { status: ExecutionStatus.COMPLETED },
        );
      }
    } catch (error: unknown) {
      // 본 메서드는 detached — 에러를 worker 로 전파할 수 없으므로 모두 in-band
      // 단말 처리한다 (BullMQ retry 대상 아님).
      if (error instanceof RehydrationError) {
        // unsupported interaction / ai 재구성 실패 등. 옛 rehydrateAndResume
        // outer catch 와 동일한 graceful reset: Execution cancelled + node failed.
        // markExecutionCancelled 가 EXECUTION_CANCELLED 를 emit → 채널 어댑터
        // (텔레그램 등)에 "세션 만료 — 새 대화 시작" 안내 도달 (#398 routing).
        await this.markExecutionCancelled(executionId, error.code);
        await this.markNodeExecutionFailed(opts.nodeExec.id, error.code);
      } else {
        // 다운스트림 노드 실패 등 — ExecutionCancelledError → cancelled, 그 외
        // → failed. (다운스트림 노드 실패가 continuation 전달을 retry 시키지
        // 않는 게 옳다.)
        await this.finalizeResumedExecutionOutcome(savedExecution, error);
      }
    } finally {
      this.finalizeRehydrationCleanup(executionId);
    }
  }

  /**
   * §7.5 rehydration — 중첩 sub-workflow(executeInline) 안에서 park 한 실행의
   * **frame-by-frame 재진입** 드라이브 (exec-park D6). `Execution.resume_call_stack`
   * (V087) 의 호출 체인을 따라: (1) 최내 frame 에서 waiting 노드 turn 을 처리(payload
   * 전달)하고 그 sub-workflow 를 끝까지 forward, (2) 그 출력을 부모 frame 의
   * invoker(Workflow) 노드 출력(`output.result`)으로 주입하고 부모 graph 를 invoker
   * 다음부터 forward, (3) top-level 까지 bubble-up 후 Execution COMPLETED. 중간에 새
   * blocking 노드가 fresh park 하면(`ParkReleaseSignal` → runNodeDispatchLoop
   * `{parked}`) 세그먼트를 종료(Execution WAITING 유지, 새 call-stack 재영속)하고
   * 다음 continuation 으로 재개한다. `driveResumeAwaited`(top-level 단일 frame)의
   * 중첩 일반화 — detach 호출이라 에러는 in-band 단말 처리(worker 전파 없음).
   */
  private async driveCallStackResume(
    savedExecution: Execution,
    context: ExecutionContext,
    opts: {
      node: Node;
      nodeExec: NodeExecution;
      callStack: ResumeCallStack;
      persistedInteractionType: string | undefined;
      isAiConversation: boolean;
      resumeCheckpoint: Record<string, unknown> | undefined;
      cachedOutput: Record<string, unknown> | undefined;
      payload: unknown;
    },
  ): Promise<void> {
    const executionId = savedExecution.id;
    const frames = opts.callStack.frames;
    const executedNodes = context._executedNodes ?? new Set<string>();
    context._executedNodes = executedNodes;
    try {
      // WARNING #6 — frames 가 빈 배열이면 frames[frames.length - 1] 이 undefined 로
      // silent 접근한다. resumeFromCheckpoint 가 length > 0 을 보장하나, 방어적으로
      // try 블록 안에서 체크해 catch 의 in-band 단말 처리(markExecutionCancelled)를 받게 한다.
      if (!frames.length) {
        throw new RehydrationError(
          'RESUME_CHECKPOINT_MISSING',
          `resume_call_stack frames is empty — execution=${executionId}. 데이터 손상 또는 잘못된 호출 경로.`,
        );
      }

      // 사전 상태 전이: WAITING_FOR_INPUT → RUNNING (waitForX/processAiResumeTurn 의
      // RUNNING→WAITING 전이 전제. driveResumeAwaited 와 동일).
      await this.updateExecutionStatus(savedExecution, ExecutionStatus.RUNNING);

      // ── 최내 frame: waiting 노드 turn 처리 + 그 sub-workflow forward ──
      const innermost = frames[frames.length - 1];
      // 새 park / AI re-park 가 정확한 체인을 영속하도록 call-stack 을 full 로 set.
      context._callStack = frames.map((f) => ({ ...f }));
      context.recursionDepth = innermost.recursionDepth;
      // 새 children 그룹핑: innermost invoker 의 NodeExecution 아래.
      context.parentNodeExecutionId =
        opts.nodeExec.parentNodeExecutionId ?? undefined;

      let frameResult = await this.driveResumeFrame(savedExecution, context, {
        workflowId: innermost.workflowId,
        startNode: opts.node,
        isInnermost: true,
        nodeExec: opts.nodeExec,
        persistedInteractionType: opts.persistedInteractionType,
        isAiConversation: opts.isAiConversation,
        resumeCheckpoint: opts.resumeCheckpoint,
        cachedOutput: opts.cachedOutput,
        payload: opts.payload,
        executedNodes,
      });
      if (frameResult.parked) return;

      // ── bubble up: 외곽 frame f(k-2)..f0 ──
      for (let i = frames.length - 2; i >= 0; i--) {
        context._callStack = frames.slice(0, i + 1).map((f) => ({ ...f }));
        context.recursionDepth = frames[i].recursionDepth;
        const invokerNodeId = frames[i + 1].invokerNodeId;
        const invokerNode = await this.nodeRepository.findOneBy({
          id: invokerNodeId,
        });
        if (!invokerNode) {
          throw new RehydrationError(
            'RESUME_CHECKPOINT_MISSING',
            `중첩 재개 invoker 노드 ${invokerNodeId} 정의 부재 (execution=${executionId})`,
          );
        }
        this.injectInvokerOutput(context, invokerNode, frameResult.output);
        executedNodes.add(invokerNodeId);
        frameResult = await this.driveResumeFrame(savedExecution, context, {
          workflowId: frames[i].workflowId,
          startNode: invokerNode,
          isInnermost: false,
          executedNodes,
        });
        if (frameResult.parked) return;
      }

      // ── top-level (W0): frames[0].invokerNodeId 이후 forward → COMPLETED ──
      context._callStack = [];
      context.recursionDepth = savedExecution.recursionDepth;
      context.parentNodeExecutionId = undefined;
      const topInvokerNode = await this.nodeRepository.findOneBy({
        id: frames[0].invokerNodeId,
      });
      if (!topInvokerNode) {
        throw new RehydrationError(
          'RESUME_CHECKPOINT_MISSING',
          `중첩 재개 top-level invoker 노드 ${frames[0].invokerNodeId} 부재 (execution=${executionId})`,
        );
      }
      this.injectInvokerOutput(context, topInvokerNode, frameResult.output);
      executedNodes.add(topInvokerNode.id);
      const topResult = await this.driveResumeFrame(savedExecution, context, {
        workflowId: savedExecution.workflowId,
        startNode: topInvokerNode,
        isInnermost: false,
        executedNodes,
      });
      if (topResult.parked) return;

      // COMPLETED 마감 (runExecution / driveResumeAwaited 와 동일 형식). 마감 필드를
      // 먼저 세팅한 뒤 guarded updateExecutionStatus 가 원자적으로 영속한다 (M-3).
      savedExecution.outputData =
        (topResult.output as Record<string, unknown> | undefined) ?? {};
      savedExecution.finishedAt = new Date();
      savedExecution.durationMs =
        savedExecution.finishedAt.getTime() -
        savedExecution.startedAt.getTime();
      // terminal 도달 — 중첩 호출 체인은 더 이상 재개 대상이 아니므로
      // resume_call_stack 을 비운다(park 시점 stale 값이 COMPLETED 행에 잔류하지
      // 않도록). guarded UPDATE 가 resume_call_stack 컬럼도 함께 쓴다. 다음 park 가
      // 있었다면 위 forward 가 새 stack 으로 재영속했을 것.
      savedExecution.resumeCallStack = null;
      const completed = await this.updateExecutionStatus(
        savedExecution,
        ExecutionStatus.COMPLETED,
      );
      if (completed) {
        await this.eventEmitter.emitExecution(
          executionId,
          ExecutionEventType.EXECUTION_COMPLETED,
          { status: ExecutionStatus.COMPLETED },
        );
      }
    } catch (error: unknown) {
      // detach 호출 — 에러를 worker 로 전파할 수 없어 in-band 단말 처리.
      if (error instanceof ParkReleaseSignal) {
        // 방어적 — 정상 경로는 runNodeDispatchLoop 가 {parked} 로 흡수.
        return;
      }
      if (error instanceof RehydrationError) {
        await this.markExecutionCancelled(executionId, error.code);
        await this.markNodeExecutionFailed(opts.nodeExec.id, error.code);
      } else {
        await this.finalizeResumedExecutionOutcome(savedExecution, error);
      }
    } finally {
      this.finalizeRehydrationCleanup(executionId);
    }
  }

  /**
   * exec-park D6 — 한 call-stack frame 의 workflow 그래프를 `startNode` 기준으로
   * 재개 구동한다. innermost frame 이면 startNode = waiting 노드(turn 처리), 외곽
   * frame 이면 startNode = invoker(Workflow) 노드(출력 이미 주입됨). 공통 후처리:
   * startNode 를 executedNodes 에 등록 + reachability 전파 + back-edge 처리 후
   * `runNodeDispatchLoop` 로 그 frame 의 남은 그래프를 forward. 반환: `{parked}`
   * (forward 중 새 fresh park) 또는 `{output}` (마지막 노드 출력 = 이 frame 결과).
   */
  private async driveResumeFrame(
    savedExecution: Execution,
    context: ExecutionContext,
    opts: {
      workflowId: string;
      startNode: Node;
      isInnermost: boolean;
      executedNodes: Set<string>;
      nodeExec?: NodeExecution;
      persistedInteractionType?: string | undefined;
      isAiConversation?: boolean;
      resumeCheckpoint?: Record<string, unknown> | undefined;
      cachedOutput?: Record<string, unknown> | undefined;
      payload?: unknown;
    },
  ): Promise<{ parked: boolean; output: unknown }> {
    const executionId = savedExecution.id;
    const graphState = await this.loadAndBuildGraph(opts.workflowId);
    const {
      sortedNodeIds,
      sortedIndexMap,
      nodeMap,
      forwardEdges,
      outgoingEdgeMap,
      backEdgeMap,
    } = graphState;
    const startPointer = sortedIndexMap.get(opts.startNode.id);
    if (startPointer === undefined) {
      throw new RehydrationError(
        'RESUME_CHECKPOINT_MISSING',
        `중첩 재개 노드 ${opts.startNode.id} 가 workflow ${opts.workflowId} sorted graph 에 없음`,
      );
    }
    const reachable = this.graphTraversal.seedInitialReachability(
      sortedNodeIds,
      nodeMap,
      forwardEdges,
    );
    for (const nid of opts.executedNodes) reachable.add(nid);
    reachable.add(opts.startNode.id);
    const nodeExecutionCount = new Map<string, number>();

    // innermost frame: waiting 노드 turn 처리 (payload 전달). 노드-타입별 분기는
    // top-level `driveResumeAwaited` 와 동일한 `dispatchResumeTurn`(resumeTurnRegistry)
    // 으로 공유 — full B3(in-memory 머신 없음). AI 가 계속(re-park)이면 PARK_RELEASED.
    if (opts.isInnermost) {
      const turnOutcome = await this.dispatchResumeTurn({
        savedExecution,
        executionId,
        node: opts.startNode,
        context,
        nodeExec: opts.nodeExec ?? null,
        persistedInteractionType: opts.persistedInteractionType,
        isAiConversation: opts.isAiConversation ?? false,
        resumeCheckpoint: opts.resumeCheckpoint,
        cachedOutput: opts.cachedOutput,
        payload: opts.payload,
      });
      if (turnOutcome === PARK_RELEASED) {
        return { parked: true, output: undefined };
      }
    }

    // startNode 완료 → executedNodes 등록 + reachability 전파 + back-edge.
    opts.executedNodes.add(opts.startNode.id);
    this.graphTraversal.propagateReachability(
      opts.startNode.id,
      outgoingEdgeMap,
      context.nodeOutputCache,
      reachable,
    );
    let pointer = startPointer + 1;
    const backEdgesFromStart = backEdgeMap.get(opts.startNode.id);
    if (backEdgesFromStart?.length) {
      const activated = this.findActivatedBackEdge(
        opts.startNode.id,
        backEdgesFromStart,
        context.nodeOutputCache,
      );
      if (activated) {
        for (let i = activated.targetIndex; i <= startPointer; i++) {
          reachable.delete(sortedNodeIds[i]);
        }
        reachable.add(sortedNodeIds[activated.targetIndex]);
        pointer = activated.targetIndex;
      }
    }
    nodeExecutionCount.set(opts.startNode.id, 0);

    const dispatchResult = await this.runNodeDispatchLoop({
      executionId,
      savedExecution,
      context,
      graphState,
      executedNodes: opts.executedNodes,
      reachable,
      nodeExecutionCount,
      pointer,
      input: {},
      dispatchMeta: {
        startedAt: savedExecution.startedAt?.toISOString(),
        mode: 'manual',
      },
    });
    if (dispatchResult.parked) {
      return { parked: true, output: undefined };
    }
    const lastNodeId = sortedNodeIds[sortedNodeIds.length - 1];
    const output = lastNodeId ? context.nodeOutputCache[lastNodeId] : undefined;
    return { parked: false, output };
  }

  /**
   * exec-park D6 — 중첩 재개 bubble-up 시, 완료된 sub-workflow 의 출력을 부모
   * 그래프의 invoker(Workflow) 노드 출력으로 주입한다. `WorkflowHandler.execute`
   * 의 sync 결과 wrapping(`output.result = subOutput`)과 동형이라, 부모 그래프의
   * downstream 이 `$node["X"].output.result` 로 일관되게 읽는다.
   */
  private injectInvokerOutput(
    context: ExecutionContext,
    invokerNode: Node,
    subOutput: unknown,
  ): void {
    // INFO #9: contextKeyOf 를 지역 변수에 한 번만 계산 (중복 호출 제거).
    const ctxKey = this.contextKeyOf(context);
    const structured = {
      config: invokerNode.config ?? {},
      output: { result: subOutput },
    };
    this.contextService.setStructuredOutput(ctxKey, invokerNode.id, structured);
    this.contextService.setNodeOutput(
      ctxKey,
      invokerNode.id,
      toEngineFlatShape(structured),
    );
  }

  /**
   * Resume(rehydration) 중 입력 처리 / 그래프 구동 실패를 Execution 단말 상태로
   * 마감한다. `ExecutionCancelledError` → `cancelled`, 그 외 → `failed`.
   * `RehydrationError` 는 호출 측(`driveResumeAwaited` catch / `rehydrateAndResume`
   * outer)이 `markExecutionCancelled` 로 직접 처리하므로 여기로 넘기지 않는다
   * (도달 시 방어적으로 failed 처리).
   */
  private async finalizeResumedExecutionOutcome(
    savedExecution: Execution,
    error: unknown,
  ): Promise<void> {
    const executionId = savedExecution.id;
    // terminal 도달 — 재개 routing 상태(중첩 call stack) 비움 (top-level 은 이미 null).
    savedExecution.resumeCallStack = null;
    if (error instanceof ExecutionCancelledError) {
      savedExecution.status = ExecutionStatus.CANCELLED;
      savedExecution.finishedAt = new Date();
      savedExecution.durationMs =
        savedExecution.finishedAt.getTime() -
        savedExecution.startedAt.getTime();
      await this.executionRepository.save(savedExecution);
      await this.eventEmitter.emitExecution(
        executionId,
        ExecutionEventType.EXECUTION_CANCELLED,
        { status: ExecutionStatus.CANCELLED },
      );
      return;
    }
    savedExecution.status = ExecutionStatus.FAILED;
    const errMessage = error instanceof Error ? error.message : String(error);
    if (error instanceof Error && error.stack) {
      this.logger.error(
        `Execution ${executionId} (rehydrated) failed: ${errMessage}`,
        error.stack,
      );
    }
    savedExecution.error = {
      message: errMessage,
      // §1.4 — ErrorPortFallbackError 의 엔진 레벨 code 만 보존. 임의 Error
      // (예: Node `SystemError`) 의 우발적 `.code` 가 Execution.error 로
      // 누수되지 않도록 sentinel 타입으로 좁힌다 (ai-review side-effect WARNING).
      // PR2a — ExecutionTimeLimitError(§8 active-running 타임아웃)도 동일 sentinel 경로.
      ...(error instanceof ErrorPortFallbackError ||
      error instanceof ExecutionTimeLimitError
        ? { code: error.code }
        : {}),
    };
    savedExecution.finishedAt = new Date();
    savedExecution.durationMs =
      savedExecution.finishedAt.getTime() - savedExecution.startedAt.getTime();
    await this.executionRepository.save(savedExecution);
    await this.eventEmitter.emitExecution(
      executionId,
      ExecutionEventType.EXECUTION_FAILED,
      {
        status: ExecutionStatus.FAILED,
        error: errMessage,
      },
    );
  }

  /**
   * rehydration 종결 시 in-memory resolver / context / config 캐시 정리.
   * executionId 키만 다룬다 — background 본문의 bgKey resolver/context 는
   * `executeBackgroundSubgraph` finally 가 독립 정리하며 rehydration 경로와 교차하지 않는다.
   */
  private finalizeRehydrationCleanup(executionId: string): void {
    this.contextService.deleteContext(executionId);
    this.clearLlmDefaultConfigCache(executionId);
  }

  private async markExecutionCancelled(
    executionId: string,
    code:
      | 'RESUME_CHECKPOINT_MISSING'
      | 'RESUME_FAILED'
      | 'RESUME_INCOMPATIBLE_STATE',
  ): Promise<void> {
    try {
      const message = ExecutionEngineService.resumeErrorMessage(code);
      const result = await this.executionRepository
        .createQueryBuilder()
        .update(Execution)
        .set({
          status: ExecutionStatus.CANCELLED,
          error: {
            code,
            message,
          },
          finishedAt: new Date(),
        })
        .where('id = :id', { id: executionId })
        // WAITING_FOR_INPUT **및 RUNNING** 둘 다 cancel 대상. 호출처 중
        // `driveResumeAwaited` 의 RehydrationError 분기(ai_agent _resumeCheckpoint
        // 재구성 실패 등)는 `updateExecutionStatus(RUNNING)` **이후**에 도달하므로
        // 이 시점 Execution.status 는 RUNNING 이다. WAITING_FOR_INPUT 만 매치하면
        // affected=0 → DB cancel 미반영(Execution RUNNING 고착) + EXECUTION_CANCELLED
        // emit 억제 → 채널(텔레그램) graceful "세션 만료" 안내 무음. 나머지 호출처
        // (rehydrateAndResume outer catch = launch 이전 pre-check)는 WAITING_FOR_INPUT.
        // 두 상태 모두 "재개 실패" 의 합법적 cancel 대상이며, 이미 terminal
        // (CANCELLED/COMPLETED/FAILED) 이면 affected=0 으로 idempotent (중복 emit 회피).
        .andWhere('status IN (:...statuses)', {
          statuses: [
            ExecutionStatus.WAITING_FOR_INPUT,
            ExecutionStatus.RUNNING,
          ],
        })
        .execute();
      // §7.5 / 방안 D — rehydration 실패로 cancelled 마킹 시 `EXECUTION_CANCELLED`
      // 를 emit 해 채널 어댑터(텔레그램 등)가 사용자에게 graceful "세션 만료 —
      // 새 대화 시작" 안내를 보낼 수 있게 한다. 과거에는 DB 만 갱신해 채널에
      // 무음이었다 (사용자는 응답 없음 후 다음 메시지가 새 대화로 시작). affected
      // 가 0 (이미 다른 worker 가 처리) 이면 중복 emit 회피.
      if ((result.affected ?? 0) > 0) {
        // emit 은 DB cancel 성공과 독립 — emit 실패가 cancel 자체를 무효화하지
        // 않도록 별도 try/catch 로 격리해 오해 소지 있는 "markExecutionCancelled
        // 실패" 로그를 방지한다 (cancel 은 이미 commit 됨).
        try {
          await this.eventEmitter.emitExecution(
            executionId,
            ExecutionEventType.EXECUTION_CANCELLED,
            {
              status: ExecutionStatus.CANCELLED,
              result: { cancelledBy: 'system' },
              error: { code, message },
            },
          );
        } catch (emitErr) {
          this.logger.warn(
            `markExecutionCancelled(${code}): EXECUTION_CANCELLED emit 실패 ` +
              `(cancel 은 DB 에 반영됨) — execution=${executionId}: ${
                emitErr instanceof Error ? emitErr.message : String(emitErr)
              }`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `markExecutionCancelled(${code}) 실패 — execution=${executionId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async markNodeExecutionFailed(
    nodeExecutionId: string,
    code:
      | 'RESUME_CHECKPOINT_MISSING'
      | 'RESUME_FAILED'
      | 'RESUME_INCOMPATIBLE_STATE',
  ): Promise<void> {
    try {
      await this.nodeExecutionRepository
        .createQueryBuilder()
        .update(NodeExecution)
        .set({
          status: NodeExecutionStatus.FAILED,
          error: {
            code,
            message: ExecutionEngineService.resumeErrorMessage(code),
          },
          finishedAt: new Date(),
        })
        .where('id = :id', { id: nodeExecutionId })
        .andWhere('status = :status', {
          status: NodeExecutionStatus.WAITING_FOR_INPUT,
        })
        .execute();
    } catch (err) {
      this.logger.error(
        `markNodeExecutionFailed(${code}) 실패 — nodeExec=${nodeExecutionId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private static resumeErrorMessage(
    code:
      | 'RESUME_CHECKPOINT_MISSING'
      | 'RESUME_FAILED'
      | 'RESUME_INCOMPATIBLE_STATE',
  ): string {
    switch (code) {
      case 'RESUME_CHECKPOINT_MISSING':
        return 'Execution checkpoint missing — DB row 부재 또는 상태 불일치로 rehydration 불가';
      case 'RESUME_FAILED':
        return 'Execution rehydration failed — continuation queue retry 소진 또는 후속 (Phase 2.3a) 미구현 분기';
      case 'RESUME_INCOMPATIBLE_STATE':
        return '대화 세션을 재개할 수 없습니다 — 새 대화를 시작해 주세요 (재개 체크포인트 부재/손상)';
    }
  }

  /**
   * Recovery 의 stale 임계값 — RUNNING execution 이 이 시간보다 오래되면
   * worker heartbeat 가 끊긴 stuck 으로 간주한다. WAITING_FOR_INPUT 은 본
   * 임계값과 무관하며 recovery 대상이 아니다 (사용자 입력은 며칠 후 도착할
   * 수도 있으므로 무기한 보존, §7.5 rehydration 으로 자연 재개).
   * 다중 인스턴스 환경에서 다른 인스턴스가 활발히 처리 중인 정상 RUNNING 을
   * 잘못 FAIL 시키지 않도록 보수적 가드 (heartbeat 간격 5초의 360배).
   *
   * SoT: spec/5-system/4-execution-engine.md §7.1 / §7.4 Recovery.
   */
  private static readonly STUCK_RECOVERY_STALE_MS = 30 * 60 * 1000;

  /**
   * 분산 lock 의 TTL (초). 부팅 동시 진행 시 다른 인스턴스가 lock 을 획득해
   * 본 인스턴스의 recovery 가 skip 되더라도, lock 보유자가 죽었을 때 60초
   * 후 lock 이 expire 되어 다음 부팅에서 다시 시도 가능.
   */
  private static readonly RECOVERY_LOCK_TTL_SECONDS = 60;

  /**
   * On server restart, mark RUNNING executions whose worker heartbeat is
   * long-gone as FAILED.
   *
   * 다중 인스턴스 환경에서:
   * - SET NX 분산 lock 으로 동시에 여러 인스턴스가 recovery 를 수행하지 않게
   *   가드.
   * - `status='running' AND startedAt < now() - 30분` 인 row 만 FAIL 처리 —
   *   다른 인스턴스가 정상 처리 중인 신규 실행은 보존한다.
   * - **WAITING_FOR_INPUT 은 절대 건드리지 않는다**. 사용자 입력은 며칠 후
   *   도착할 수도 있고 노드별 `formConfig.timeout` 이 별도로 적용되므로,
   *   본 함수가 강제로 종결시키지 않는다. 부팅 후 입력 도착 시 §7.5
   *   rehydration 경로로 자연 재개.
   *
   * SoT: spec/5-system/4-execution-engine.md §7.4 Recovery (workflow-
   * resumable-execution Phase 1.1, 2026-05-25).
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
      // W-21 fix (SUMMARY#W-21): error.code 구조화 — 클라이언트가 code 로
      // 분기 가능. message 는 유지 (기존 log/display 호환).
      const updateResult = await this.executionRepository
        .createQueryBuilder()
        .update(Execution)
        .set({
          status: ExecutionStatus.FAILED,
          error: {
            code: 'WORKER_HEARTBEAT_TIMEOUT',
            message: 'Execution failed: worker heartbeat timeout',
          },
          finishedAt,
        })
        .where('status = :status', {
          status: ExecutionStatus.RUNNING,
        })
        .andWhere('started_at < :threshold', { threshold: staleThreshold })
        .execute();

      const affected = updateResult.affected ?? 0;
      if (affected > 0) {
        this.logger.warn(
          `Recovered ${affected} stale execution(s) (>30min) stuck in RUNNING (worker heartbeat timeout)`,
        );
      }
    } finally {
      // 작업 완료 후 lock 을 명시 해제 — TTL 60초 만료 대기 없이 다음
      // 인스턴스가 즉시 처리할 수 있다. owner 검증이 들어가 있어 이미
      // expire 되어 다른 인스턴스가 잡은 lock 은 절대 삭제하지 않는다.
      await this.continuationBus.releaseLock(RECOVERY_LOCK_KEY);
    }
  }

  /**
   * Execute a workflow. Creates the execution record and enqueues execution
   * start — the caller gets the execution ID immediately (PENDING row).
   *
   * **SUMMARY#15 — 타이밍 계약**: 반환 시 Execution row 는 `pending` 상태이며
   * 실제 실행(노드 dispatch)은 `execution-run` 큐의 워커가 임의 시점·인스턴스에서
   * 비동기로 시작한다. 반환 직후 실행이 곧바로 시작된다는 보장이 없다.
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
    // Re-run 으로 생성된 실행만 chain 정보 세팅 (decision F2). 일반 실행은 null.
    // `in` 내로잉으로 unsafe cast 회피 — reRunOf/chainId 는 executedBy variant 전용.
    const reRunOf =
      options && 'reRunOf' in options ? (options.reRunOf ?? null) : null;
    const chainIdOpt =
      options && 'chainId' in options ? (options.chainId ?? null) : null;
    const dryRun =
      options && 'dryRun' in options ? (options.dryRun ?? false) : false;
    // webhook/chat-channel 트리거 호출 메타데이터 (§A.3). triggerId variant 전용 —
    // `in` 내로잉으로 unsafe cast 회피. 미전달(schedule/manual)은 NULL 영속.
    const sourceIp =
      options && 'sourceIp' in options ? (options.sourceIp ?? null) : null;
    const responseCode =
      options && 'responseCode' in options
        ? (options.responseCode ?? null)
        : null;
    // 단일 노드 실행 (§1.3). executedBy variant 전용 — `in` 내로잉으로 unsafe cast
    // 회피. 미전달(일반/부분 실행)은 NULL 영속. previous_execution_id 는 입력 seed
    // 출처일 뿐 chain 관계가 아니다(re_run_of 와 분리).
    const singleNodeId =
      options && 'singleNodeId' in options
        ? (options.singleNodeId ?? null)
        : null;
    const previousExecutionId =
      options && 'previousExecutionId' in options
        ? (options.previousExecutionId ?? null)
        : null;
    const execution = this.executionRepository.create({
      workflowId,
      status: ExecutionStatus.PENDING,
      inputData: (input as Record<string, unknown>) ?? {},
      executedBy: options?.executedBy,
      triggerId: options?.triggerId,
      reRunOf,
      chainId: chainIdOpt,
      dryRun,
      sourceIp,
      responseCode,
      singleNodeId,
      previousExecutionId,
    });
    const savedExecution = await this.executionRepository.save(execution);
    const executionId = savedExecution.id;

    // 3. Enqueue 실행 시작 to `execution-run` intake 큐 (spec §4.1–4.3).
    //    현 fire-and-forget in-process 호출을 대체 — 임의 backend 인스턴스가
    //    work-stealing 으로 첫 active 세그먼트를 처리한다. row 는 위에서 이미
    //    `pending` 으로 저장됐으므로(executionId 즉시 발급 계약 유지) job 에는
    //    executionId + input 만 싣고, worker(`runExecutionFromQueue`)가 row 재조회
    //    → status 재검증 → routing 재등록 → runExecution 을 수행한다.
    //
    //    routing context 등록을 worker 로 옮긴 이유: registerExecutionRouting 은
    //    in-memory Map 이라 job 을 consume 한 인스턴스에 등록돼야 그 인스턴스의
    //    runExecution 이 emit 하는 terminal event 의 release 와 짝이 맞는다
    //    (work-stealing 으로 다른 인스턴스가 consume 할 수 있음). §7.5 rehydration
    //    slow path 가 routing 을 consumer 측에서 재등록하는 것과 동일 패턴.
    //
    //    jobId = executionId (1:1 enqueue) → BullMQ 가 중복 add 를 자동 dedup.
    //    priority: 수동 실행(executedBy)을 트리거 실행보다 앞세운다(§4.3). webhook
    //    vs schedule 의 세부 3-tier 구분은 ExecuteOptions 가 trigger type 을 싣지
    //    않아 후속(triggerType threading)으로 미룬다 — 현재는 manual > 그 외.
    // TODO(PR2): trigger type threading — ExecuteOptions 에 triggerType 필드 추가 시
    //   'manual' | 'webhook' | 'schedule' 로 세분화. 현재 schedule 실행도 'webhook'
    //   우선순위를 받는다(spec §4.3 3-tier 미완성 — 의도된 임시 처리).
    const triggerType = options?.executedBy ? 'manual' : 'webhook';
    await this.executionRunQueue.add(
      'execution-run',
      { executionId, input },
      {
        jobId: buildExecutionRunJobId(executionId),
        priority: resolveExecutionRunPriority(triggerType),
        ...EXECUTION_RUN_QUEUE_DEFAULT_OPTS,
      },
    );

    return executionId;
  }

  /**
   * PR1 — `execution-run` intake 큐 worker 진입점 (spec §4.1–4.3).
   *
   * @internal — `ExecutionRunProcessor` 전용 진입점. NestJS DI 로 인해 `private`
   *   선언이 불가하나 모듈 외부에서 직접 호출해서는 안 된다.
   *
   * `ExecutionRunProcessor` 가 job 을 pick up 해 호출한다. row 를 재조회하고
   * (executionId), 아직 `pending` 인 경우에만 routing 재등록 후 `runExecution` 을
   * 수행한다. fire-and-forget 시절 `execute()` 의 routing 등록(step 3)·실패 시
   * routing release(step 4 .catch)를 이 곳으로 이동했다 — work-stealing 으로
   * job 을 실제 처리하는 인스턴스에서 등록/해제가 짝을 이루도록.
   *
   * **SUMMARY#7 — input 소유권**: `input` 은 `execute()` 가 job payload 에 실어
   * 보낸 원본 입력이다. row.inputData 와 동일 값이지만, worker 는 job payload 의
   * `input` 을 `runExecution(execution, input)` 에 그대로 전달해 원본 형태를
   * 보존한다. PR3 멱등 rehydration 도입 시 `runExecution(execution, execution.inputData)`
   * 로 일원화하고 job payload 에서 `input` 을 제거 예정. 두 값이 diverge 하는
   * 경우의 동작은 현재 미정의 — PR1 에서는 항상 일치한다고 가정.
   *
   * 멱등성: jobId = executionId 라 중복 enqueue 는 BullMQ 가 차단하지만, 큐 대기
   * 중 cancel 된 경우 등을 위해 `status === pending` 을 재검증해 아니면 ack-discard.
   * 실행 실패는 `runExecution` 이 Execution 을 `failed` 로 마킹하고 정상 반환하므로
   * 본 메서드는 setup 단계 미처리 throw 만 catch 해 routing 을 정리한다 (PR1 은
   * crash-retry 미도입 — job 을 re-throw 없이 ack 하여 비멱등 노드 이중 실행 방지).
   *
   * **SUMMARY#1 — TOCTOU 보류**: status 재검증(`findOneBy`)과 `registerExecutionRouting`
   * 사이에 cancel API / recoverStuckExecutions 가 row 상태를 변경하면 stale routing
   * context 가 Map 에 잔류 가능. PR2 동시성 cap 구현 전 conditional UPDATE 원자화
   * 예정 (현 단계: status 불일치 시 debug 로그로 ack-discard — stale routing 의
   * 실질적 위험은 PR2 동시성 증가 후 구체화).
   */
  async runExecutionFromQueue(
    executionId: string,
    input: unknown,
  ): Promise<void> {
    const execution = await this.executionRepository.findOneBy({
      id: executionId,
    });
    if (!execution) {
      this.logger.warn(
        `[execution-run] Execution ${executionId} 없음 — ack-discard (이미 삭제됐거나 잘못된 job).`,
      );
      return;
    }
    if (execution.status !== ExecutionStatus.PENDING) {
      // 큐 대기 중 cancel 됐거나(=> cancelled) 다른 경로로 이미 진행됨. 재실행 금지.
      this.logger.debug(
        `[execution-run] Execution ${executionId} 상태가 ${execution.status} (pending 아님) — ack-discard.`,
      );
      return;
    }

    // routing context 재등록 (execute() step 3 에서 이동). 트리거 발화 경로만.
    if (execution.triggerId) {
      const chatChannel = extractChatChannelFromInput(input);
      this.eventEmitter.registerExecutionRouting(executionId, {
        triggerId: execution.triggerId,
        workflowId: execution.workflowId,
        ...(chatChannel ? { chatChannel } : {}),
      });
    }

    // §4.x "active 세그먼트 + durable park" (exec-park D6 full B3) — `runExecution`
    // 은 park 시 즉시 반환(코루틴 해제)하므로 worker 는 첫 active 세그먼트(시작 → 첫
    // BLOCK/완료)만 await 하면 BullMQ job 이 park 내내 점유되지 않는다. 옛 detached
    // 코루틴 + firstSegmentBarriers(arm/await/settle) 모델은 제거됐다 — park 가
    // 세그먼트를 종료하므로 단순 `await` 로 동일 효과. setup 단계 throw 는 runExecution
    // 자체 catch 가 못 잡으므로 여기서 best-effort 마감한다.
    try {
      await this.runExecution(execution, input);
    } catch (error: unknown) {
      this.logger.error(
        `Background execution failed for ${executionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      this.eventEmitter.releaseExecutionRouting(executionId);
      // W7 (ai-review) — `failFirstSegmentSetup` 자체가 throw 시 BullMQ worker 로
      // 전파돼 동일 continuation 이중 재시도(double-exec)를 유발한다. best-effort
      // 마감 실패는 worker 레벨 재시도보다 로그로 관측하는 것이 안전하다.
      await this.failFirstSegmentSetup(executionId, error).catch(
        (secondaryErr: unknown) => {
          this.logger.error(
            `failFirstSegmentSetup secondary error for ${executionId}: ${
              secondaryErr instanceof Error
                ? secondaryErr.message
                : String(secondaryErr)
            }`,
          );
        },
      );
    }
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

    // exec-park D6 — 중첩 durable park 호출 체인 추적. 이 inline 진입을
    // `context._callStack` 에 frame 으로 push 한다 (outermost→innermost). sub-workflow
    // 안의 blocking 노드가 release park 하면 `stageDurableResumeSnapshot` 가 이 스택을
    // `Execution.resume_call_stack`(V087) 에 영속하고, §7.5 rehydration 이 frame-by-frame
    // 재진입한다. invokerNodeId 미전달(background body 등 비-Workflow-노드 진입)이면
    // push 하지 않는다 — 그 경로는 외부 재개 대상이 아니다(fire-and-forget). finally 에서 pop.
    const pushedCallStackFrame = options.invokerNodeId !== undefined;
    if (pushedCallStackFrame) {
      if (!context._callStack) context._callStack = [];
      context._callStack.push({
        workflowId,
        invokerNodeId: options.invokerNodeId as string,
        recursionDepth,
      });
    }

    const maxNodeIterations = this.resolveMaxNodeIterations();
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
          this.contextService.setNodeOutput(
            this.contextKeyOf(context),
            nodeId,
            cleanInput,
          );
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
          outgoingEdgeMap,
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
            // exec-park D6 (full B3) — 중첩 blocking 도 top-level 과 동일하게
            // **release park**: durable 영속(thread/variables + `resume_call_stack`)
            // 후 PARK_RELEASED 를 받으면 `ParkReleaseSignal` 을 throw 해 deep call
            // stack 을 unwind(코루틴 해제 → bounded 메모리). 재개는 §7.5 rehydration
            // (`driveCallStackResume`)이 frame-by-frame 으로 재진입한다. 옛 'await'
            // (in-memory pendingContinuations 루프)은 제거됐다.
            const blocking = this.handlerRegistry.getMetadata(node.type);
            let parkSignal: ProcessTurnResult = undefined;
            if (
              blocking.kind === 'blocking' &&
              blocking.interaction === 'form'
            ) {
              parkSignal = await this.formInteraction.waitForFormSubmission(
                execution,
                executionId,
                node,
                context,
              );
            } else if (interactionType === 'buttons') {
              parkSignal =
                await this.buttonInteraction.waitForButtonInteraction(
                  execution,
                  executionId,
                  node,
                  context,
                  graphEdges,
                );
            } else if (
              interactionType === 'ai_conversation' ||
              interactionType === 'ai_form_render'
            ) {
              parkSignal = await this.aiTurnOrchestrator.waitForAiConversation(
                execution,
                executionId,
                node,
                context,
              );
            }
            if (parkSignal === PARK_RELEASED) {
              throw new ParkReleaseSignal();
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
      // exec-park D6 — 이 inline frame 을 call-stack 에서 pop. ParkReleaseSignal
      // unwind 경로에서도 실행되지만, park 시점에 이미 `stageDurableResumeSnapshot`
      // 가 DB 에 frame 을 영속했으므로 in-memory pop 은 무해(context 는 곧 해제).
      if (pushedCallStackFrame) {
        context._callStack?.pop();
      }
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
   * in-memory ExecutionContext Map 라우팅 키 해소 (spec/conventions/execution-context.md
   * 원칙 4). 비-background context 는 `_contextKey === executionId` 이므로 동작 불변,
   * background 본문만 `bg:<executionId>:<backgroundRunId>` 별도 키를 반환한다. 이 키로
   * contextService 에 접근해야 부모의 `deleteContext(executionId)` race 로 본문 context 가
   * 삭제되는 일을 막는다. `context` 미보유 경로(AI 멀티턴 클러스터)는 `contextKey`
   * 파라미터를 직접 받아 동일 키를 전달한다.
   */
  // C-1 step2 — EngineDriver member (AiTurnOrchestrator 가 driver 경유 호출).
  public contextKeyOf(context: ExecutionContext): string {
    return context._contextKey ?? context.executionId;
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
      await this.eventEmitter.emitExecution(
        executionId,
        ExecutionEventType.EXECUTION_STARTED,
        { status: ExecutionStatus.RUNNING },
      );

      // 4-7. Load nodes/edges + build graph + identifyBackEdges +
      // topologicalSort + buildEdgeIndexes + nodeMap + maxNodeIterations —
      // `loadAndBuildGraph` 가 3 호출자 공통 (PR #365 ai-review WARNING #11
      // 해소).
      const {
        nodes,
        edges,
        graphEdges,
        forwardEdges,
        backEdges,
        sortedNodeIds,
        backEdgeMap,
        outgoingEdgeMap,
        incomingEdgeMap,
        nodeMap,
        maxNodeIterations,
      } = await this.loadAndBuildGraph(workflowId);

      // 8. Create execution context (inject workspaceId + workspace timezone
      // for AI handlers — spec/4-nodes/3-ai/0-common.md §11.3 SoT precedence:
      // Workspace.settings.timezone → process.env.TZ → 'UTC'. 엔진이 한 번만
      // 조회해 핸들러에 전달한다 (3 AI 핸들러가 각자 조회하면 N+1 발생).
      const workflow = await this.workflowRepository.findOne({
        where: { id: workflowId },
        relations: ['workspace'],
      });
      const workspaceTimezone = workflow?.workspace?.settings?.['timezone'];
      const workspaceName = workflow?.workspace?.name;
      const context = this.contextService.createContext(
        executionId,
        workflowId,
        {
          initialVariables: {
            __workspaceId: workflow?.workspaceId ?? '',
            __workspaceName:
              typeof workspaceName === 'string' ? workspaceName : '',
            __workspaceTimezone:
              typeof workspaceTimezone === 'string' ? workspaceTimezone : '',
            // dry-run 플래그 주입 — spec §7.2. 핸들러는
            // `context.variables.__dryRun === true` 로 mock 분기.
            __dryRun: savedExecution.dryRun ?? false,
          },
          recursionDepth: savedExecution.recursionDepth,
        },
      );

      // 9-10. nodeMap + maxNodeIterations 는 loadAndBuildGraph 결과를 그대로
      // 사용 (위에서 destructure). Cyclic workflow 가드 경고는 보존.
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
      // 단일 노드 실행 (§1.3) — singleNodeId 가 세팅되면 대상 노드 1개만 reachable
      // seed 하고(explicitEntryIds) downstream 으로 전파하지 않는다(§1.2 구분).
      // previousExecutionId 의 predecessor 출력을 nodeOutputCache 에 pre-seed 해
      // gatherNodeInput 이 상류 출력을 자동 사용(미지정 시 수동 입력 input fallback).
      const singleNodeId = savedExecution.singleNodeId ?? null;
      // CRIT #2 — executeInline 과 동일한 helper. trigger-first / no-incoming
      // fallback 으로 reachable seed. 단일 노드는 대상 노드만 entry.
      const reachable = this.graphTraversal.seedInitialReachability(
        sortedNodeIds,
        nodeMap,
        forwardEdges,
        singleNodeId ? [singleNodeId] : undefined,
      );
      if (singleNodeId) {
        await this.seedSingleNodePredecessorOutputs(
          savedExecution,
          singleNodeId,
          incomingEdgeMap,
          context,
          executedNodes,
        );
      }

      let pointer = 0;
      while (pointer < sortedNodeIds.length) {
        // PR2a — §8 노드 사이마다 active-running 누적 타임아웃 검사 (초과 시 throw).
        this.assertActiveTimeWithinLimit(savedExecution);
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
          outgoingEdgeMap,
        );

        // 단일 노드 실행 (§1.3) — 대상 노드 1개만 실행하고 종결한다. container body
        // 순회·parallel branch·downstream 전파·back-edge 재진입을 일절 수행하지 않는다
        // (§1.2 Run-from-Selected 와 구분). blocking(form/buttons/AI 멀티턴) 대화형
        // 노드의 park 도 진입하지 않으므로 — 단일 노드 테스트는 표준/AI/코드/HTTP 등
        // 비-blocking 노드를 대상으로 한다(blocking 노드는 향후 확장). break 직후
        // 완료 분기가 outputData 를 대상 노드 출력으로 마감한다.
        if (singleNodeId) {
          break;
        }

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
        // concurrently. Default is now 'v1' (parallel-p2 결정 B). Set
        // PARALLEL_ENGINE=off explicitly to roll back to legacy sequential
        // propagateReachability behavior — the Parallel handler's
        // `port: string[]` return value is still handled there, preserving
        // existing semantics as a rollback card.
        if (
          dispatchKind === 'parallel' &&
          this.resolveParallelEngineFlag() === 'v1'
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
            // Phase B (PR-B1) — fresh top-level park → 코루틴 해제. PARK_RELEASED
            // 수신 시 세그먼트를 종료하고 반환한다(finally 가 context cleanup +
            // settleFirstSegment 로 worker job 반환). 재개는 §7.5 rehydration.
            const parkSignal = await this.formInteraction.waitForFormSubmission(
              savedExecution,
              executionId,
              node,
              context,
            );
            if (parkSignal === PARK_RELEASED) return;
          } else if (interactionType === 'buttons') {
            const parkSignal =
              await this.buttonInteraction.waitForButtonInteraction(
                savedExecution,
                executionId,
                node,
                context,
                graphEdges,
              );
            if (parkSignal === PARK_RELEASED) return;
          } else if (interactionType === 'ai_conversation') {
            // Phase B (PR-B2, exec-park D4) — top-level 멀티턴 AI turn-park.
            // 첫 turn 진입에서 초기 AI 응답 emit + park-release → 세그먼트 종료.
            // 후속 turn 은 continuation job → §7.5 rehydration(processAiResumeTurn).
            const parkSignal =
              await this.aiTurnOrchestrator.waitForAiConversation(
                savedExecution,
                executionId,
                node,
                context,
              );
            if (parkSignal === PARK_RELEASED) return;
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

      // 11. Mark execution as completed. outputData/finishedAt/durationMs 를 먼저
      // 세팅한 뒤 guarded updateExecutionStatus 가 status 와 함께 원자적으로 영속
      // (M-3 — 옛 2-save 를 1 guarded UPDATE 로). affected=0(동시 cancel/park 선점)
      // 이면 emit skip.
      // 단일 노드 실행(§1.3)은 topological 최종 노드가 아닌 대상 노드 출력으로 마감
      // (downstream 미진행이라 마지막 실행 노드 = 대상 노드).
      const resultNodeId =
        singleNodeId ?? sortedNodeIds[sortedNodeIds.length - 1];
      if (resultNodeId) {
        savedExecution.outputData =
          (context.nodeOutputCache[resultNodeId] as Record<string, unknown>) ??
          {};
        savedExecution.finishedAt = new Date();
        savedExecution.durationMs =
          savedExecution.finishedAt.getTime() -
          savedExecution.startedAt.getTime();
      }
      const completed = await this.updateExecutionStatus(
        savedExecution,
        ExecutionStatus.COMPLETED,
      );

      // Emit after all DB writes are complete (terminal 선점 시 skip).
      if (completed) {
        await this.eventEmitter.emitExecution(
          executionId,
          ExecutionEventType.EXECUTION_COMPLETED,
          { status: ExecutionStatus.COMPLETED },
        );
      }
    } catch (error: unknown) {
      // exec-park D6 — 중첩 sub-workflow blocking 노드가 durable release park 했다.
      // `waitForX('release')` 가 이미 Execution 을 WAITING_FOR_INPUT + thread/variables
      // + `resume_call_stack` durable 영속했으므로, 여기서는 단지 세그먼트를 깨끗이
      // 종료(return)한다 — FAILED 마킹하면 안 된다. 재개는 §7.5 rehydration
      // (`driveCallStackResume`). finally 가 worker job 반환·context cleanup 처리.
      if (error instanceof ParkReleaseSignal) {
        return;
      }

      // Cancelled while waiting for user input — mark as cancelled, not failed
      if (error instanceof ExecutionCancelledError) {
        savedExecution.status = ExecutionStatus.CANCELLED;
        savedExecution.finishedAt = new Date();
        savedExecution.durationMs =
          savedExecution.finishedAt.getTime() -
          savedExecution.startedAt.getTime();
        await this.executionRepository.save(savedExecution);
        await this.eventEmitter.emitExecution(
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
      savedExecution.error = {
        message: errMessage,
        // §1.4 — ErrorPortFallbackError 의 엔진 레벨 code 만 보존. 임의 Error
        // (예: Node `SystemError`) 의 우발적 `.code` 가 Execution.error 로
        // 누수되지 않도록 sentinel 타입으로 좁힌다 (ai-review side-effect WARNING).
        // PR2a — ExecutionTimeLimitError(§8 active-running 타임아웃)도 동일 sentinel 경로.
        ...(error instanceof ErrorPortFallbackError ||
        error instanceof ExecutionTimeLimitError
          ? { code: error.code }
          : {}),
      };
      savedExecution.finishedAt = new Date();
      savedExecution.durationMs =
        savedExecution.finishedAt.getTime() -
        savedExecution.startedAt.getTime();
      await this.executionRepository.save(savedExecution);
      await this.eventEmitter.emitExecution(
        executionId,
        ExecutionEventType.EXECUTION_FAILED,
        {
          status: ExecutionStatus.FAILED,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    } finally {
      // exec-park D6 full B3 — park 가 세그먼트를 종료하므로 firstSegmentBarriers /
      // pendingContinuations 정리가 불필요하다. in-memory context / llm 캐시만 정리.
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
   * Resume a paused execution by submitting form data.
   *
   * 다중 인스턴스 환경에서 호출자가 어느 인스턴스로 라우팅됐는지 모르므로,
   * 항상 ContinuationBusService 를 통해 publish 한다. 실제 resume 처리는
   * BullMQ Worker (continuation-execution.processor.ts) 가 담당한다.
   *
   * "No pending continuation" 즉시 에러는 단일 인스턴스 어디에서도 정확히
   * 판단할 수 없으므로 폐기됐다. WAITING_FOR_INPUT 상태 검증은 publisher
   * 측 (controller / WS gateway) 의 책임이다.
   */
  async continueExecution(
    executionId: string,
    formData?: unknown,
  ): Promise<ContinuationPublishResult> {
    // spec/4-nodes/6-presentation/0-common.md §10.9 — sentinel wrap 책임.
    // raw formData 를 그대로 publish 하지 않고 `{ type: 'form_submitted',
    // formData }` 로 wrap 한 뒤 publish.
    const nodeExecutionId =
      await this.resolveWaitingNodeExecutionId(executionId);
    // publisher 측 동기 field 검증 — 실패 시 publish 전에 throw 해 execution 을
    // waiting 유지(재제출 가능). EIA 는 400 VALIDATION_ERROR, WS ack 는 errorCode
    // 매핑 (FormValidationError extends ExecutionError). spec form §4·§6.2 / EIA §5.1.
    await this.assertFormSubmissionValid(nodeExecutionId, formData);
    const jobId = await this.continuationBus.publish({
      type: 'continue',
      executionId,
      nodeExecutionId,
      payload: { type: 'form_submitted', formData },
    });
    return ExecutionEngineService.buildPublishResult(jobId);
  }

  /**
   * [spec form §4·§6.2 / EIA §5.1] form 제출 데이터를 노드 field 정의에 대해 검증한다.
   * 적용 규칙: 필수·`type`(email/number)·`validation.minLength`/`maxLength`·`min`/`max`(숫자 범위)·
   * `pattern`(regex)·select/radio 선택지·`type:'file'` MIME/크기/개수.
   * 실패 시 FIRST 오류로 {@link FormValidationError} throw.
   *
   * `validateAllFields` 가 field 정의 순서로 단일 패스(cross-type FIRST 오류 순서 보존) — scalar 는
   * `coerceFormValue` 정규화 후 validateScalarField, `type:'file'` 은 raw metadata 배열로
   * validateFileField. file metadata 는 frontend(`DynamicFormUI`)가 `{name,size,type,lastModified}[]`
   * 로 직렬화한 payload (binary 미전달, §1.5). chat-channel 어댑터(Slack 등)의 다른 file shape 은
   * size/MIME 미보유라 자연 bypass (form §1.5 divergence).
   *
   * 검증 불가(노드/field 정의 부재) 시 통과(기존 whitelist-only 동작 유지) — 방어적.
   */
  private async assertFormSubmissionValid(
    nodeExecutionId: string,
    formData: unknown,
  ): Promise<void> {
    const nodeExec = await this.nodeExecutionRepository.findOne({
      where: { id: nodeExecutionId },
      select: { id: true, nodeId: true },
    });
    if (!nodeExec) return;
    const node = await this.nodeRepository.findOneBy({ id: nodeExec.nodeId });
    if (!node) return;
    const fields = extractFormFields(node.config);
    if (fields.length === 0) return;
    const rawData =
      formData && typeof formData === 'object'
        ? (formData as Record<string, unknown>)
        : {};
    const err = validateAllFields(
      rawData,
      fields,
      ExecutionEngineService.coerceFormValue,
    );
    if (err) {
      throw new FormValidationError(err.field, err.message);
    }
  }

  /**
   * 단일 form 값 → string (no-base-to-string 회피: 객체는 JSON 으로 명시 직렬화).
   *
   * 변환 규칙:
   *   - `null` / `undefined` → `''` (required 판정: 빈 문자열 = 미입력)
   *   - `string` → 원본 유지
   *   - `number` / `boolean` → `String()` 변환
   *   - `Array` — 빈 배열 → `''`; 비어있지 않은 배열 → 각 요소를 문자열화(비문자열은
   *     `JSON.stringify`)한 뒤 콤마 join. multi-value(multi-select 등) 배열 대응.
   *   - 그 외 객체 → `JSON.stringify`. required 통과(`''` 아님), type 규칙 미해당.
   *
   * scalar 필드 전용 — `type:'file'` 은 raw metadata 배열로 {@link validateFileField} 가 별도 검증.
   */
  private static coerceFormValue(v: unknown): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) {
      // multi-value(multi-select 등) — 비어있으면 '', 아니면 요소를 string 화해 join.
      return v.length === 0
        ? ''
        : v
            .map((x) => (typeof x === 'string' ? x : JSON.stringify(x)))
            .join(',');
    }
    // 그 외 객체 — 비어있지 않은 것으로 간주(required 통과), scalar 형식 규칙 미해당.
    // (scalar 전용 — file metadata 는 본 함수를 거치지 않고 validateFileField 가 raw 로 처리.)
    return JSON.stringify(v);
  }

  /**
   * Cancel a waiting execution by rejecting the pending continuation.
   * cancel 은 nodeExecutionId 불필요 (rehydration 대상 아님).
   */
  cancelWaitingExecution(executionId: string): void {
    void this.continuationBus.publish({ type: 'cancel', executionId });
  }

  async continueButtonClick(
    executionId: string,
    buttonId: string,
  ): Promise<ContinuationPublishResult> {
    const nodeExecutionId =
      await this.resolveWaitingNodeExecutionId(executionId);
    const jobId = await this.continuationBus.publish({
      type: 'button_click',
      executionId,
      nodeExecutionId,
      payload: { buttonId },
    });
    return ExecutionEngineService.buildPublishResult(jobId);
  }

  /**
   * Submit a user message in a multi-turn AI conversation.
   */
  private static readonly MAX_MESSAGE_LENGTH = 10_000;

  async continueAiConversation(
    executionId: string,
    message: string,
  ): Promise<ContinuationPublishResult> {
    if (message.length > ExecutionEngineService.MAX_MESSAGE_LENGTH) {
      throw new MessageTooLongError(
        ExecutionEngineService.MAX_MESSAGE_LENGTH,
        message.length,
      );
    }
    const nodeExecutionId =
      await this.resolveWaitingNodeExecutionId(executionId);
    const jobId = await this.continuationBus.publish({
      type: 'ai_message',
      executionId,
      nodeExecutionId,
      payload: { message },
    });
    return ExecutionEngineService.buildPublishResult(jobId);
  }

  /**
   * End a multi-turn AI conversation.
   */
  async endAiConversation(
    executionId: string,
  ): Promise<ContinuationPublishResult> {
    const nodeExecutionId =
      await this.resolveWaitingNodeExecutionId(executionId);
    const jobId = await this.continuationBus.publish({
      type: 'ai_end_conversation',
      executionId,
      nodeExecutionId,
    });
    return ExecutionEngineService.buildPublishResult(jobId);
  }

  /**
   * AI Agent multi-turn 의 `execution.retry_last_turn` (spec/5-system/
   * 6-websocket-protocol.md §4.2, spec/5-system/4-execution-engine.md §1.3,
   * spec/4-nodes/3-ai/1-ai-agent.md §7.9) 진입점.
   *
   * retryable error 로 종결된 NodeExecution 의 보존된 `_retryState` 를 lookup·
   * 검증하고, **동일 트랜잭션 안에서** `_retryState` 키를 제거(소비)하면서 동일
   * nodeId 의 새 NodeExecution row 를 spawn 한다. 키 제거가 affected=1 인 쪽만
   * 진행하므로 동시 retry 의 중복 spawn 이 차단된다 (한 번 소비되면 후속 retry 는
   * `RETRY_STATE_NOT_FOUND`).
   *
   * 검증 순서 (spec §4.2 에러 코드 표):
   *  1. NodeExecution lookup (executionId 소속 확인). 미존재 → INVALID_EXECUTION_STATE.
   *  2. status !== FAILED → INVALID_EXECUTION_STATE.
   *  3. `outputData.output.error.details.retryable !== true` → NODE_NOT_RETRYABLE.
   *  4. `outputData._retryState` 부재 또는 `now > expiresAt` → RETRY_STATE_NOT_FOUND.
   *  5. `retryAfterSec` 카운트다운 미경과 → RETRY_TOO_EARLY.
   *  6. atomic consume + spawn.
   *
   * **본 메서드는 큐를 publish 하지 않음** — caller(WS gateway) 가 spawn 된 row
   * id 로 `publishRetryLastTurn` 을 호출해 `retry_last_turn` continuation job 을
   * BullMQ 에 enqueue 하고, worker 가 `applyRetryLastTurn` 으로 multi-turn loop
   * 에 재진입한다 (INFO#3: "Continuation Bus 미경유" 표현 수정 — 본 메서드 자체가
   * publish 안 할 뿐, caller 가 publish 함).
   *
   * **재진입 구현 완료**: `applyRetryLastTurn` 이 `_retryState` → `_resumeState`
   * shape 변환 후 `runAiConversationLoop` 로 재진입. INFO#1: 이전 "재진입 미완 갭"
   * 주석은 현 구현을 반영해 삭제함. 남은 문서화된 갭은 downstream graph traversal
   * (성공 후 후속 노드 재개) — `applyRetryLastTurn` 의 docstring 참조.
   */
  async retryLastTurn(
    executionId: string,
    nodeExecutionId: string,
  ): Promise<{ spawnedNodeExecutionId: string }> {
    const nodeExec = await this.nodeExecutionRepository.findOneBy({
      id: nodeExecutionId,
    });
    // 1. lookup + executionId 소속 검증.
    if (!nodeExec || nodeExec.executionId !== executionId) {
      throw new InvalidExecutionStateError(
        `retry_last_turn: NodeExecution ${nodeExecutionId} not found for execution ${executionId}`,
      );
    }
    // 2. FAILED 상태 기대.
    if (nodeExec.status !== NodeExecutionStatus.FAILED) {
      throw new InvalidExecutionStateError(
        `retry_last_turn: NodeExecution ${nodeExecutionId} is ${nodeExec.status}, expected FAILED`,
      );
    }

    const outputData: Record<string, unknown> = nodeExec.outputData ?? {};
    const output = (outputData.output ?? {}) as Record<string, unknown>;
    const errorObj = (output.error ?? undefined) as
      | { details?: { retryable?: unknown; retryAfterSec?: unknown } }
      | undefined;
    // 3. retryable 검증.
    if (errorObj?.details?.retryable !== true) {
      throw RetryLastTurnError.notRetryable(
        `retry_last_turn: node ${nodeExecutionId} did not terminate on a retryable error`,
      );
    }

    // 4. _retryState 존재 + TTL.
    const retryState = outputData._retryState as
      | (Record<string, unknown> & { expiresAt?: unknown })
      | undefined;
    if (!retryState) {
      throw RetryLastTurnError.notFound(
        `retry_last_turn: _retryState missing on node ${nodeExecutionId} (already consumed?)`,
      );
    }
    const expiresAtRaw = retryState.expiresAt;
    const expiresAtMs =
      typeof expiresAtRaw === 'string' ? Date.parse(expiresAtRaw) : NaN;
    const now = Date.now();
    if (!Number.isFinite(expiresAtMs) || now > expiresAtMs) {
      throw RetryLastTurnError.notFound(
        `retry_last_turn: _retryState expired on node ${nodeExecutionId} (expiresAt=${String(expiresAtRaw)})`,
      );
    }

    // 5. retryAfterSec 카운트다운 enforcement. 카운트다운 기준 시각은 노드가
    //    종결된 시점 (finishedAt, 없으면 startedAt). retryAfterSec 는
    //    output.error.details 또는 _retryState 어느 쪽에 있든 읽는다.
    const retryAfterSec =
      typeof errorObj.details?.retryAfterSec === 'number'
        ? errorObj.details.retryAfterSec
        : typeof retryState.retryAfterSec === 'number'
          ? retryState.retryAfterSec
          : undefined;
    if (retryAfterSec !== undefined && retryAfterSec > 0) {
      const finishedAtMs = (
        nodeExec.finishedAt ?? nodeExec.startedAt
      )?.getTime?.();
      if (typeof finishedAtMs === 'number') {
        const readyAtMs = finishedAtMs + retryAfterSec * 1000;
        if (now < readyAtMs) {
          throw RetryLastTurnError.tooEarly(
            `retry_last_turn: retryAfterSec=${retryAfterSec}s not elapsed for node ${nodeExecutionId}`,
          );
        }
      }
    }

    // 6. ATOMIC CONSUME + SPAWN — 동일 트랜잭션. `_retryState` 키를 JSONB `-`
    //    연산으로 제거(소비)하되 affected=1 인 writer 만 새 row 를 spawn 한다.
    //    동시 retry 의 두 번째 호출은 affected=0 → RETRY_STATE_NOT_FOUND.
    const seededInput = { _retryState: retryState };
    let spawned: NodeExecution | null = null;
    await this.dataSource.transaction(async (manager) => {
      const consume = await manager
        .createQueryBuilder()
        .update(NodeExecution)
        .set({
          // JSONB `-` 연산자로 `_retryState` 키만 제거. 다른 outputData 키 보존.
          outputData: () => `output_data - '_retryState'`,
        })
        .where('id = :id', { id: nodeExecutionId })
        // JSONB key-existence guard. `jsonb_exists(col, key)` is used instead
        // of the `?` operator so the pg driver doesn't mistake `?` for a bound
        // parameter placeholder. affected=1 only for the writer that still saw
        // the key present — concurrent retry gets affected=0.
        .andWhere(`jsonb_exists(output_data, '_retryState')`)
        .execute();
      if ((consume.affected ?? 0) !== 1) {
        // 이미 다른 retry 가 소비함 (동시성) — 중복 spawn 차단.
        throw RetryLastTurnError.notFound(
          `retry_last_turn: _retryState already consumed for node ${nodeExecutionId}`,
        );
      }
      const fresh = manager.create(NodeExecution, {
        executionId,
        nodeId: nodeExec.nodeId,
        status: NodeExecutionStatus.RUNNING,
        inputData: seededInput as Record<string, unknown>,
        parentNodeExecutionId: nodeExec.parentNodeExecutionId ?? null,
      });
      spawned = await manager.save(NodeExecution, fresh);
    });

    // 본 메서드는 lookup/검증/atomic-consume/spawn 까지를 동기 수행한다. 실제
    // multi-turn loop 재진입은 worker 컨텍스트에서만 가능하므로 (live
    // ExecutionContext 필요), caller (WS gateway) 가 spawn 된 row 의 id 로
    // `publishRetryLastTurn` 을 호출해 continuation bus 로 handoff 한다 →
    // worker processor 가 `applyRetryLastTurn` 으로 재진입한다 (spec §4.2
    // "Continuation Bus 경유 (worker handoff)").
    const spawnedId = (spawned as NodeExecution | null)?.id;
    if (!spawnedId) {
      // transaction 이 throw 없이 끝났는데 spawned 가 null 이면 invariant 위반.
      throw RetryLastTurnError.notFound(
        `retry_last_turn: spawn failed for node ${nodeExecutionId}`,
      );
    }
    return { spawnedNodeExecutionId: spawnedId };
  }

  /**
   * spec/5-system/6-websocket-protocol.md §4.2 "Continuation Bus 경유 (worker
   * handoff)" — `retryLastTurn` 으로 spawn 된 RUNNING row 의 id 를 담아
   * `retry_last_turn` continuation job 을 publish 한다. worker processor 가
   * 이를 받아 `applyRetryLastTurn` 으로 multi-turn loop 에 재진입한다.
   *
   * 기존 continuation 명령과 달리 `nodeExecutionId` 는 대기중 row 가 아니라
   * spawn 된 RUNNING row 를 가리킨다 (worker idempotency 가드는 WAITING 대신
   * RUNNING 을 기대 — processor 가 type 별로 분기).
   */
  async publishRetryLastTurn(
    executionId: string,
    spawnedNodeExecutionId: string,
  ): Promise<ContinuationPublishResult> {
    const jobId = await this.continuationBus.publish({
      type: 'retry_last_turn',
      executionId,
      nodeExecutionId: spawnedNodeExecutionId,
      payload: { spawnedNodeExecutionId },
    });
    return ExecutionEngineService.buildPublishResult(jobId);
  }

  /**
   * W3 보상 — `publishRetryLastTurn` 실패(`queued: false` / throw) 시 WS gateway
   * 가 호출해 spawn 된 RUNNING row 를 FAILED 로 마감한다.
   *
   * `_retryState` 는 이미 소비됐으므로 재시도 시 RETRY_STATE_NOT_FOUND 가 된다.
   * Execution 은 이미 FAILED 상태이므로 row 만 FAILED 로 정리한다.
   */
  async markSpawnedRowFailedOnPublishError(
    spawnedNodeExecutionId: string,
    reason: string,
  ): Promise<void> {
    try {
      await this.nodeExecutionRepository
        .createQueryBuilder()
        .update(NodeExecution)
        .set({
          status: NodeExecutionStatus.FAILED,
          error: { message: `Retry publish failed: ${reason}` },
          finishedAt: new Date(),
        })
        .where('id = :id', { id: spawnedNodeExecutionId })
        .andWhere('status = :status', { status: NodeExecutionStatus.RUNNING })
        .execute();
    } catch (err) {
      this.logger.error(
        `markSpawnedRowFailedOnPublishError: failed to close row ${spawnedNodeExecutionId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * spec/5-system/6-websocket-protocol.md §4.2 / spec/5-system/4-execution-engine.md
   * §1.3 / spec/4-nodes/3-ai/1-ai-agent.md §7.9 — `retry_last_turn` worker 재진입.
   *
   * `retryLastTurn` 이 spawn 한 RUNNING row 를 `_retryState` 로 seed 해 multi-turn
   * loop 에 재진입시킨다. 기존 rehydration (`rehydrateAndResume`) 과 다른 점:
   *   - 대상 Execution 은 FAILED (waiting_for_input 아님), spawn 된 row 는 RUNNING.
   *   - `_retryState` 가 DB (spawn 된 row 의 `inputData`) 에 영속돼 있어 in-memory
   *     `_resumeState` 가 없어도 재구성 가능 (multi-turn rehydration 의 알려진
   *     한계 RESUME_INCOMPATIBLE_STATE 를 retry 는 우회 — _retryState 가 DB SoT).
   *
   * 재진입 절차:
   *   1. spawn 된 row + `inputData._retryState` 로드.
   *   2. ExecutionContext 확보 (`rehydrateContext` 재사용 — live 면 그대로).
   *   3. `_retryState` → `_resumeState` shape 변환 후 nodeOutputCache /
   *      structuredOutputCache 에 주입.
   *   4. NODE_STARTED (spawn 된 row) emit. Execution FAILED → RUNNING 전이는
   *      `finalizeAiNode` 의 COMPLETED 분기가 담당 (W4: JSDoc 정합).
   *   5. `runAiConversationLoop` 를 마지막 user message replay (initialAction =
   *      `ai_message`) 로 구동 → 실패했던 LLM turn 재실행. 이후 정상 loop.
   *   6. `finalizeAiNode` 로 spawn row 마감 + Execution 을 RUNNING 으로 전이.
   *   7. 성공 종결이면 `resumeGraphAfterRetry` 가 downstream graph 로 진행
   *      (WARNING #10 해소; spec/4-nodes/3-ai/1-ai-agent.md §7.9 + §12.8).
   *      실패/취소/`resumeGraphAfterRetry` 내부 예외 등 모든 catch 는
   *      `failRetryExecution` 이 Execution 을 FAILED 또는 CANCELLED 로 마감
   *      (일반 노드 종결 규칙 — spec §10).
   */
  async applyRetryLastTurn(
    executionId: string,
    spawnedNodeExecutionId: string,
  ): Promise<void> {
    const spawnedRow = await this.nodeExecutionRepository.findOneBy({
      id: spawnedNodeExecutionId,
    });
    if (!spawnedRow || spawnedRow.executionId !== executionId) {
      this.logger.warn(
        `applyRetryLastTurn: spawned row ${spawnedNodeExecutionId} not found for execution ${executionId} — ack-and-discard`,
      );
      return;
    }
    // 멱등성 — 이미 다른 worker 가 처리해 RUNNING 이 아니면 discard.
    if (spawnedRow.status !== NodeExecutionStatus.RUNNING) {
      this.logger.debug(
        `applyRetryLastTurn: spawned row ${spawnedNodeExecutionId} is ${spawnedRow.status} (not RUNNING) — already handled, ack-and-discard`,
      );
      return;
    }

    const seededInput = spawnedRow.inputData ?? {};
    const retryState = seededInput._retryState as
      | Record<string, unknown>
      | undefined;
    if (!retryState) {
      this.logger.error(
        `applyRetryLastTurn: spawned row ${spawnedNodeExecutionId} missing _retryState in inputData — cannot re-enter`,
      );
      // re-entry 불가 — spawn 된 row 를 FAILED 로 마감하지 않으면 RUNNING 영구
      // 잔류한다. Execution 은 이미 FAILED 이므로 row 만 정리.
      spawnedRow.status = NodeExecutionStatus.FAILED;
      spawnedRow.error = {
        message: 'Retry re-entry failed: missing _retryState',
      };
      spawnedRow.finishedAt = new Date();
      await this.nodeExecutionRepository.save(spawnedRow);
      return;
    }

    // INFO#4 / W3 — execution + node 조회를 병렬화 (W18) 하고, 각 not-found 에서
    // spawn 된 RUNNING row 를 FAILED 로 마감해 zombie row 방지.
    const [execution, node] = await Promise.all([
      this.executionRepository.findOneBy({ id: executionId }),
      this.nodeRepository.findOneBy({ id: spawnedRow.nodeId }),
    ]);
    if (!execution) {
      this.logger.error(
        `applyRetryLastTurn: execution ${executionId} not found — marking spawned row FAILED to avoid zombie`,
      );
      spawnedRow.status = NodeExecutionStatus.FAILED;
      spawnedRow.error = {
        message: 'Retry re-entry failed: parent execution not found',
      };
      spawnedRow.finishedAt = new Date();
      await this.nodeExecutionRepository.save(spawnedRow);
      return;
    }
    if (!node) {
      this.logger.error(
        `applyRetryLastTurn: node ${spawnedRow.nodeId} not found — marking spawned row FAILED to avoid zombie`,
      );
      spawnedRow.status = NodeExecutionStatus.FAILED;
      spawnedRow.error = {
        message: 'Retry re-entry failed: node definition not found',
      };
      spawnedRow.finishedAt = new Date();
      await this.nodeExecutionRepository.save(spawnedRow);
      return;
    }

    // ExecutionContext — live 면 재사용, 아니면 rehydrate (다른 인스턴스 / 재시작).
    // rehydrateContext 는 waiting node 의 outputData 도 seed 하나, retry 의 spawn
    // row 는 RUNNING (inputData seeded) 이므로 별도로 _resumeState 를 주입한다.
    const context = await this.rehydrateContext(execution, spawnedRow);

    // W6/W7/W13 — `_retryState` → `_resumeState` shape 복원 + replay initialAction
    // 도출은 `buildRetryReentryState` 로 분리 (SRP). 본 메서드는 orchestration
    // (검증 / context rehydrate / emit / loop 구동 / Execution 마감) 만 담당.
    const { resumeState, initialAction } = this.buildRetryReentryState(
      execution,
      node,
      context,
      retryState,
    );
    // nodeOutputCache 에 `{ _resumeState }` envelope 주입 (handleAiMessageTurn /
    // finalizeAiNode 가 읽는다). structuredOutputCache 도 seed 해 finalize 가
    // 종료 turn 의 canonical shape 을 가질 수 있게 한다.
    this.contextService.setNodeOutput(this.contextKeyOf(context), node.id, {
      _resumeState: resumeState,
    });

    // NODE_STARTED (spawn 된 row) emit. Execution status 전이는 finalizeAiNode 가
    // 담당한다 — 성공 종결 시 COMPLETED 분기가 FAILED → RUNNING (state-machine.ts
    // 의 retry 전용 전이) 을 수행하고, 재실패 시 catch 가 FAILED 로 직접 마감한다.
    // 여기서 미리 RUNNING 으로 옮기면 finalizeAiNode 의 RUNNING → RUNNING 전이가
    // invalid 가 되므로 전이를 finalize 단계로 미룬다.
    await this.eventEmitter.emitNode(
      executionId,
      node.id,
      NodeEventType.NODE_STARTED,
      {
        nodeExecutionId: spawnedRow.id,
        parentNodeExecutionId: context.parentNodeExecutionId,
        status: NodeExecutionStatus.RUNNING,
        nodeType: node.type,
        nodeLabel: node.label ?? node.type,
        input: spawnedRow.inputData,
        startedAt: spawnedRow.startedAt?.toISOString?.(),
      },
    );

    try {
      // exec-park D6 full B3 — 옛 runAiConversationLoop(initialAction) 장수 루프 replay
      // 를 turn-park 모델의 단발 처리기로 이관한다. processAiResumeTurn 이 마지막 turn
      // (initialAction)을 외부 대기 없이 즉시 replay 하고, 종료면 finalizeAiNode
      // (retryReentry → FAILED→RUNNING 전이 허용)로 단말 마킹, **계속이면 re-park**
      // (PARK_RELEASED) 해 다음 turn 을 fresh continuation 으로 받는다(코루틴 해제).
      const turnSignal = await this.aiTurnOrchestrator.processAiResumeTurn(
        execution,
        executionId,
        node,
        context,
        spawnedRow,
        resumeState,
        initialAction,
        { retryReentry: true },
      );
      if (turnSignal === PARK_RELEASED) {
        // 대화 계속 — re-park 됨(Execution WAITING). graph 진행 없이 종료, 다음
        // turn 은 §7.5 rehydration 으로 재개.
        return;
      }
      // 종료(COMPLETED/FAILED finalize 완료) — WARNING #10 (spec §7.9 + §12.8):
      // 재진입 성공 후 일반 노드 COMPLETED 와 동일하게 downstream graph 진행.
      // (FAILED 면 processAiResumeTurn 내 finalizeAiNode 가 sentinel throw → 아래 catch.)
      await this.resumeGraphAfterRetry(execution, executionId, context, node);
    } catch (error: unknown) {
      await this.failRetryExecution(execution, executionId, error);
    } finally {
      this.contextService.deleteContext(executionId);
      this.clearLlmDefaultConfigCache(executionId);
    }
  }

  /**
   * W6/W7/W13 — `_retryState` → `_resumeState` shape 복원 + replay initialAction
   * 도출. `applyRetryLastTurn` 의 orchestration 에서 분리한 순수 준비 단계.
   *
   * credential / context-binding 필드는 `_retryState` (DB 영속) 에 미동봉이므로
   * (spec §7.9 masking) node.config + context 에서 재유도한다 —
   * `processMultiTurnMessageInner` 가 state 에서 직접 읽는 필드들. operational
   * 필드는 `resolveRetryNodeConfig` 로 expression 을 best-effort 평가한 값을 쓰고
   * (#11), config echo 용 `rawConfig` 는 spec config-echo 정책상 raw 값을 유지한다.
   *
   * @returns resumeState (loop seed) + initialAction (실패 last turn replay;
   *   lastUserMessage 부재 시 undefined → replay 없이 wait loop 진입).
   *
   * @remarks IE 노드 확장 (PR-A2b) — `information_extractor` 고유 config 필드
   * (`outputSchema` / `examples` / `instructions` / `maxCollectionRetries`) 는
   * node.config 에서 재유도, runtime state(`partialResult` / `collectionRetryCount`)
   * 는 checkpoint 에서 복원한다. ai_agent 재구성에는 inert (기본값만 주입). spec §1.3
   * allow-list 합집합 — `buildResumeCheckpoint` 와 대칭 유지 필수.
   */
  // C-1 step2 — EngineDriver member (AI resume ↔ retry 공유 재구성기).
  public buildRetryReentryState(
    execution: Execution,
    node: Node,
    context: ExecutionContext,
    retryState: Record<string, unknown>,
    opts?: { resumeMode?: boolean },
  ): {
    resumeState: Record<string, unknown>;
    initialAction: ContinuationPayload | undefined;
  } {
    // expiresAt 은 resume state 에 불필요. lastUserMessage/Source 는 replay 용.
    // schemaVersion 은 checkpoint 메타데이터 — 버전 검사는 호출 측(§7.5)이 하고
    // 여기서는 resumeState 본문에서 제외한다.
    const {
      expiresAt: _expiresAt,
      schemaVersion: _schemaVersion,
      lastUserMessage,
      lastUserMessageSource,
      ...resumeFields
    } = retryState as Record<string, unknown> & {
      expiresAt?: unknown;
      schemaVersion?: unknown;
      lastUserMessage?: unknown;
      lastUserMessageSource?: unknown;
    };
    void _expiresAt;
    void _schemaVersion;

    const rawNodeConfig = node.config ?? {};
    const resolvedConfig = this.resolveRetryNodeConfig(
      execution,
      node,
      context,
    );
    const workspaceId =
      (context.variables?.__workspaceId as string | undefined) ?? '';
    const resumeState: Record<string, unknown> = {
      ...resumeFields,
      // 핵심 checkpoint 필드 방어적 기본값 — 구(舊)/부분 손상 checkpoint 가
      // 필드를 누락해도 undefined 가 downstream(loop)으로 새지 않게 정규화.
      // retry 모드(full `_retryState`)에서는 값이 이미 있어 no-op.
      messages: Array.isArray(resumeFields.messages)
        ? resumeFields.messages
        : [],
      turnCount:
        typeof resumeFields.turnCount === 'number' ? resumeFields.turnCount : 0,
      totalInputTokens:
        typeof resumeFields.totalInputTokens === 'number'
          ? resumeFields.totalInputTokens
          : 0,
      totalOutputTokens:
        typeof resumeFields.totalOutputTokens === 'number'
          ? resumeFields.totalOutputTokens
          : 0,
      totalThinkingTokens:
        typeof resumeFields.totalThinkingTokens === 'number'
          ? resumeFields.totalThinkingTokens
          : 0,
      toolCalls:
        typeof resumeFields.toolCalls === 'number' ? resumeFields.toolCalls : 0,
      executionId: execution.id,
      nodeId: node.id,
      workspaceId,
      llmConfigId: resolvedConfig.llmConfigId,
      maxTurns: (resolvedConfig.maxTurns as number | undefined) ?? 20,
      maxToolCalls: (resolvedConfig.maxToolCalls as number | undefined) ?? 10,
      conditions: (resolvedConfig.conditions as unknown[] | undefined) ?? [],
      presentationTools:
        (resolvedConfig.presentationTools as unknown[] | undefined) ?? [],
      mcpServers:
        (resumeFields.mcpServers as unknown[] | undefined) ??
        (resolvedConfig.mcpServers as unknown[] | undefined) ??
        [],
      // information_extractor config 필드 재유도 (node.config) + 고유 runtime
      // state 기본값 보강 (spec §1.3 합집합). ai_agent 재구성에는 inert —
      // ai_agent 핸들러가 읽지 않으며, IE 핸들러만 자기 필드를 소비한다.
      outputSchema:
        (resolvedConfig.outputSchema as unknown[] | undefined) ?? [],
      examples: (resolvedConfig.examples as unknown[] | undefined) ?? [],
      instructions: (resolvedConfig.instructions as string | undefined) ?? '',
      maxCollectionRetries:
        (resolvedConfig.maxCollectionRetries as number | undefined) ??
        DEFAULT_IE_MAX_COLLECTION_RETRIES,
      partialResult:
        (resumeFields.partialResult as Record<string, unknown> | undefined) ??
        {},
      collectionRetryCount:
        typeof resumeFields.collectionRetryCount === 'number'
          ? resumeFields.collectionRetryCount
          : 0,
      conversationThreadRef: context.conversationThread,
    };
    if (!('rawConfig' in resumeState)) {
      resumeState.rawConfig = Object.freeze({ ...rawNodeConfig });
    }

    // 마지막 user message 를 replay 해 실패했던 LLM turn 을 재실행. lastUserMessage
    // 가 없으면 (옛 _retryState 호환) replay 없이 정상 wait loop 진입 — 그 경우
    // 사용자가 다음 메시지를 보내야 진행된다.
    const replayMessage =
      typeof lastUserMessage === 'string' ? lastUserMessage : undefined;
    const replaySource: ResumableMessageSource =
      lastUserMessageSource === 'form_submitted'
        ? 'form_submitted'
        : 'ai_message';
    const initialAction: ContinuationPayload | undefined =
      replayMessage !== undefined
        ? replaySource === 'form_submitted'
          ? {
              type: 'form_submitted',
              formData: this.tryParseJson(replayMessage),
            }
          : { type: 'ai_message', message: replayMessage }
        : undefined;

    // resumeMode (§7.5 rehydration) 에서는 lastUserMessage 부재가 정상이다 —
    // 재개 시 도착한 continuation payload 를 firePayload 가 loop 로 전달하므로
    // replay 가 불필요. retry 재진입(`applyRetryLastTurn`)에서만 anomaly 로 warn.
    if (replayMessage === undefined && !opts?.resumeMode) {
      this.logger.warn(
        `applyRetryLastTurn: _retryState has no lastUserMessage for ` +
          `execution=${execution.id} node=${node.id} — re-entering wait loop without replay ` +
          `(user must send a new message to proceed).`,
      );
    }

    return { resumeState, initialAction };
  }

  /**
   * `_resumeCheckpoint` 저장·재개 허용 노드 타입 가드.
   * `CHECKPOINT_ELIGIBLE_NODE_TYPES` allow-list 를 위임해 가드 3곳의 중복 제거.
   * 새 멀티턴 타입 추가 시 모듈 상수 한 곳만 갱신하면 모든 가드에 반영된다
   * (spec §1.3 allow-list 합집합 의미 보존).
   */
  // C-1 step2 — EngineDriver member (registry selector + orchestrator 공유 가드).
  public isCheckpointEligibleNodeType(t: string): boolean {
    return CHECKPOINT_ELIGIBLE_NODE_TYPES.has(t);
  }

  /**
   * §7.5 rehydration — in-memory `_resumeState` 에서 DB 영속용
   * `_resumeCheckpoint` 부분집합을 만든다. credential / context-binding 필드
   * (`llmConfigId` / `workspaceId` / `executionId` / `nodeId` / `workflowId` /
   * `presentationTools` / `conditions` / `maxTurns` / `maxToolCalls` /
   * `conversationThreadRef` / `rawConfig` 등) 는 **의도적으로 미동봉** — DB 영속
   * 이므로 credential 참조를 담지 않는다 (`AiAgentHandler.buildRetryState` 와
   * 동일 allow-list 정책; 재구성 시 `buildRetryReentryState` 가 node.config 에서
   * 재유도). `_retryState` 와 달리 `expiresAt`(TTL) / `lastUserMessage` 는 없다 —
   * 재개는 도착한 continuation payload 를 그대로 처리하며 장시간 idle 후에도
   * 가능 (waiting Execution 무기한 보존). 부재 시 graceful reset
   * (`RESUME_INCOMPATIBLE_STATE`).
   *
   * NOTE — allow-list 는 `AiAgentHandler.buildRetryState` 의 부분집합과 동기화
   * 유지. 새 비-credential resume 필드 추가 시 양쪽 모두 갱신.
   *
   * NOTE(IE 확장 — PR-A2b) — `partialResult` / `collectionRetryCount` 는 IE 멀티턴
   * 고유 runtime state. ai_agent `_resumeState` 에는 부재이므로 기본값(빈 객체/0)
   * 으로 inert. `buildRetryReentryState` 에서 대칭적으로 복원. allow-list 합집합
   * (spec §1.3). IE 핸들러 state shape 변경 시 양쪽 함수 모두 갱신.
   */
  // C-1 step2 — EngineDriver member (checkpoint 단일 소스, orchestrator 가 driver 경유).
  public buildResumeCheckpoint(
    resumeState: Record<string, unknown> | undefined,
  ): Record<string, unknown> | undefined {
    if (!resumeState || typeof resumeState !== 'object') return undefined;
    const s = resumeState;
    const pendingFormToolCall = s.pendingFormToolCall as
      | Record<string, unknown>
      | undefined;
    // allow-list invariant — 아래 필드는 credential 을 담지 않는다: `ragSources`/
    // `mcpServers` 는 secret-ref 기반(평문 secret 미포함), `pendingFormToolCall`
    // 은 form schema, `messages` 는 이미 `output.result.messages` 로 평문 영속 중.
    // credential 참조(`llmConfigId` 등)는 미동봉하고 재개 시 node.config 에서 재유도.
    return {
      // 스키마 진화 대비 버전 stamp — 재개 시 미래 버전이면 graceful reset (§7.5).
      schemaVersion: CHECKPOINT_SCHEMA_VERSION,
      messages: (s.messages as unknown[] | undefined) ?? [],
      turnCount: (s.turnCount as number | undefined) ?? 0,
      totalInputTokens: (s.totalInputTokens as number | undefined) ?? 0,
      totalOutputTokens: (s.totalOutputTokens as number | undefined) ?? 0,
      totalThinkingTokens: (s.totalThinkingTokens as number | undefined) ?? 0,
      toolCalls: (s.toolCalls as number | undefined) ?? 0,
      model: s.model,
      temperature: s.temperature,
      maxTokens: s.maxTokens,
      knowledgeBases: (s.knowledgeBases as unknown[] | undefined) ?? [],
      ragTopK: s.ragTopK,
      ragThreshold: s.ragThreshold,
      ragSources: (s.ragSources as unknown[] | undefined) ?? [],
      mcpServers: (s.mcpServers as unknown[] | undefined) ?? [],
      // information_extractor 고유 runtime state (credential-free) — IE 멀티턴
      // 재개에 필요. ai_agent 의 _resumeState 에는 부재이므로 기본값(빈 객체/0)
      // 으로 inert. allow-list 합집합 정책 (spec §1.3).
      partialResult:
        (s.partialResult as Record<string, unknown> | undefined) ?? {},
      collectionRetryCount: (s.collectionRetryCount as number | undefined) ?? 0,
      ...(pendingFormToolCall ? { pendingFormToolCall } : {}),
    };
  }

  /**
   * retry 성공 종결 시 Execution 을 직접 COMPLETED 로 마감하는 fallback.
   * 정상 경로(`resumeGraphAfterRetry`)에서 workflow nodes/edges 가 비어있거나
   * completedNode 가 그래프에 없는 등 graph rebuild 불가 시에만 호출된다.
   * (이전엔 정상 경로였으나 WARNING #10 — spec/4-nodes/3-ai/1-ai-agent.md §7.9
   * + §12.8 — 의 해소로 정상 경로는 graph traversal 합류로 교체됨.)
   *
   * downstream 이 없는 leaf AI 노드의 경우에도 본 helper 대신 정상 경로
   * (`resumeGraphAfterRetry`) 가 graph loop 자연 종결을 통해 동일한 결과
   * (Execution.COMPLETED) 를 만든다.
   *
   * **호출 조건**: (1) `resumeGraphAfterRetry` 진입 시 `nodes.length === 0`,
   * 또는 (2) `sortedIndexMap.get(completedNode.id) === undefined`. 이 두 가지
   * defensive fallback 경로 외에서는 호출해서는 안 된다.
   *
   * @internal 이 메서드는 `resumeGraphAfterRetry` 의 defensive fallback 에서만
   * 호출된다. 다른 경로에서 직접 호출하지 말 것.
   */
  private async completeRetryExecution(
    execution: Execution,
    executionId: string,
  ): Promise<void> {
    execution.status = ExecutionStatus.COMPLETED;
    execution.finishedAt = new Date();
    execution.durationMs =
      execution.finishedAt.getTime() - execution.startedAt.getTime();
    await this.executionRepository.save(execution);
    await this.eventEmitter.emitExecution(
      executionId,
      ExecutionEventType.EXECUTION_COMPLETED,
      { status: ExecutionStatus.COMPLETED },
    );
  }

  /**
   * spec/4-nodes/3-ai/1-ai-agent.md §7.9 + §12.8 — retry_last_turn 성공 종결 후
   * 일반 노드 COMPLETED 와 동일하게 출력 포트의 downstream 노드로 그래프 진행을
   * 이어간다 (WARNING #10 해소).
   *
   * 본 메서드는 `applyRetryLastTurn` 의 worker processor 컨텍스트에서 호출되며,
   * 새 BullMQ job 발행 없이 in-process graph loop 합류한다. WS gateway 가 직접
   * graph 동기 실행하는 경로는 본 retry 흐름에 없다.
   *
   * 동작 흐름:
   *   1. workflow nodes/edges 로드 + graph rebuild (buildGraph / topologicalSort
   *      / buildEdgeIndexes — `runExecution` graph rebuild 섹션과 동일 패턴).
   *   2. completedNode 가 그래프에 없거나 nodes 가 비어 있으면 defensive
   *      fallback — `completeRetryExecution` 으로 Execution.COMPLETED 마감.
   *   3. reachable seed (트리거 + no-incoming + context._executedNodes +
   *      completedNode) + propagateReachability + back-edge 처리.
   *   4. 그래프 traversal loop — downstream 노드 dispatch / blocking 노드
   *      (form/button/AI multi-turn) waitForX 진입 등 일반 dispatch 와 동일
   *      (`resumeFromCheckpoint` traversal loop 패턴과 동일).
   *   5. 자연 종결 시 Execution 을 COMPLETED 로 마감 + lastNode 출력 저장.
   *
   * **`executeWithRetry` (노드 에러 정책 자동 재실행) 와 무관** — 본 메서드는
   * 사용자 `execution.retry_last_turn` WS 명령 경로 전용.
   *
   * **multi-turn AI downstream 한계**: downstream 이 또 다른 multi-turn AI
   * 노드인 경우 첫 dispatch 는 정상 진행되나, 그 노드가 waiting 중 인스턴스
   * 재시작 발생 시 spec/5-system/4-execution-engine.md §7.5
   * `RESUME_INCOMPATIBLE_STATE` 한계가 동일하게 적용된다.
   *
   * Throws: ExecutionCancelledError / 기타 graph loop 예외 — caller
   * (`applyRetryLastTurn`) 의 catch 가 `failRetryExecution` 으로 처리한다.
   *
   * @remarks 본 메서드의 traversal loop + completion 코드는 `resumeFromCheckpoint`
   * traversal loop + COMPLETED finalize block 과 거의 동일하다. 공통 helper 추출
   * 리팩토링은 PR2 scope creep 회피를 위해 후속 plan 으로 분리한다.
   */
  private async resumeGraphAfterRetry(
    savedExecution: Execution,
    executionId: string,
    context: ExecutionContext,
    completedNode: Node,
  ): Promise<void> {
    // 1. workflow nodes/edges 로드 + graph rebuild — `loadAndBuildGraph` 가
    // 3 호출자 공통 (PR #365 ai-review WARNING #11 해소).
    const graphState = await this.loadAndBuildGraph(savedExecution.workflowId);
    const {
      nodes,
      sortedNodeIds,
      sortedIndexMap,
      backEdgeMap,
      outgoingEdgeMap,
      nodeMap,
      forwardEdges,
    } = graphState;

    // 2. defensive fallback — graph 없으면 즉시 COMPLETED 마감.
    if (nodes.length === 0) {
      this.logger.warn(
        `resumeGraphAfterRetry: workflow ${savedExecution.workflowId} has no nodes — falling back to Execution.COMPLETED finalize (executionId=${executionId})`,
      );
      await this.completeRetryExecution(savedExecution, executionId);
      return;
    }

    const completedPointer = sortedIndexMap.get(completedNode.id);
    if (completedPointer === undefined) {
      this.logger.warn(
        `resumeGraphAfterRetry: completed node ${completedNode.id} not in sorted graph (workflow=${savedExecution.workflowId}) — falling back to Execution.COMPLETED finalize`,
      );
      await this.completeRetryExecution(savedExecution, executionId);
      return;
    }

    // 3. reachable seed (트리거 + no-incoming + 복원된 완료 노드 + completedNode).
    const reachable = this.graphTraversal.seedInitialReachability(
      sortedNodeIds,
      nodeMap,
      forwardEdges,
    );
    const executedNodes = context._executedNodes ?? new Set<string>();
    context._executedNodes = executedNodes;
    for (const nid of executedNodes) reachable.add(nid);
    reachable.add(completedNode.id);

    // 4. completedNode 를 executedNodes 에 등록 + outgoing reachability 전파 +
    // back-edge 처리. nodeExecutionCount 초기값은 helper 호출 직전 0 으로 set
    // (WARNING #16 — MAX_NODE_ITERATIONS=1 환경 false positive 방지).
    executedNodes.add(completedNode.id);
    this.graphTraversal.propagateReachability(
      completedNode.id,
      outgoingEdgeMap,
      context.nodeOutputCache,
      reachable,
    );

    let pointer = completedPointer + 1;
    const backEdgesFromCompleted = backEdgeMap.get(completedNode.id);
    if (backEdgesFromCompleted?.length) {
      const activated = this.findActivatedBackEdge(
        completedNode.id,
        backEdgesFromCompleted,
        context.nodeOutputCache,
      );
      if (activated) {
        for (let i = activated.targetIndex; i <= completedPointer; i++) {
          reachable.delete(sortedNodeIds[i]);
        }
        reachable.add(sortedNodeIds[activated.targetIndex]);
        pointer = activated.targetIndex;
      }
    }

    const nodeExecutionCount = new Map<string, number>();
    nodeExecutionCount.set(completedNode.id, 0);

    // 5. 그래프 traversal loop — `runNodeDispatchLoop` 가 공통 helper
    // (resumeFromCheckpoint 와 공유, PR #365 ai-review WARNING #10 해소).
    // input 은 retry 경로엔 의미 없으므로 빈 객체.
    const dispatchResult = await this.runNodeDispatchLoop({
      executionId,
      savedExecution,
      context,
      graphState,
      executedNodes,
      reachable,
      nodeExecutionCount,
      pointer,
      input: {},
      dispatchMeta: {
        startedAt: savedExecution.startedAt?.toISOString(),
        mode: 'manual',
      },
    });

    // Phase B (PR-B1) — retry 재진입 후 downstream top-level 블로킹 노드가 fresh
    // park(release)하면 세그먼트 종료. Execution 은 WAITING_FOR_INPUT 으로 남고
    // 다음 continuation 이 rehydration 으로 재개한다. COMPLETED 마감 skip.
    // (호출자 applyRetryLastTurn 의 finally 가 context 해제.)
    if (dispatchResult.parked) {
      return;
    }

    // 6. 자연 종결 — Execution COMPLETED 마감 (resumeFromCheckpoint COMPLETED
    // finalize block 패턴 동일). 마감 필드를 먼저 세팅한 뒤 guarded
    // updateExecutionStatus 가 status 와 함께 원자적으로 영속 (M-3). affected=0
    // (동시 cancel/park 선점)이면 emit skip.
    const lastNodeId = sortedNodeIds[sortedNodeIds.length - 1];
    if (lastNodeId) {
      savedExecution.outputData =
        (context.nodeOutputCache[lastNodeId] as
          | Record<string, unknown>
          | undefined) ?? {};
      savedExecution.finishedAt = new Date();
      savedExecution.durationMs =
        savedExecution.finishedAt.getTime() -
        savedExecution.startedAt.getTime();
    }
    const completed = await this.updateExecutionStatus(
      savedExecution,
      ExecutionStatus.COMPLETED,
    );
    if (completed) {
      await this.eventEmitter.emitExecution(
        executionId,
        ExecutionEventType.EXECUTION_COMPLETED,
        { status: ExecutionStatus.COMPLETED },
      );
    }
  }

  /**
   * W6/W7/W13 — retry 재실패/취소 시 Execution 마감. finalizeAiNode 의 FAILED
   * sentinel throw (또는 loop 내 예외 / cancel) — Execution 을 FAILED 또는
   * CANCELLED 로 마감한다 (runExecution catch 와 동형). NodeExecution 은
   * finalizeAiNode FAILED 분기가 이미 FAILED + NODE_FAILED emit 했고, retryable
   * 재실패면 새 `_retryState` 가 outputData 에 보존돼 재-retry 가능하다.
   */
  private async failRetryExecution(
    execution: Execution,
    executionId: string,
    error: unknown,
  ): Promise<void> {
    // isCancelled 를 상단에서 한 번만 평가해 이중 평가 제거 (WARNING #10).
    const isCancelled = error instanceof ExecutionCancelledError;
    execution.status = isCancelled
      ? ExecutionStatus.CANCELLED
      : ExecutionStatus.FAILED;
    const errMessage = error instanceof Error ? error.message : String(error);
    execution.error = { message: errMessage };
    execution.finishedAt = new Date();
    execution.durationMs =
      execution.finishedAt.getTime() - execution.startedAt.getTime();
    await this.executionRepository.save(execution);
    await this.eventEmitter.emitExecution(
      executionId,
      isCancelled
        ? ExecutionEventType.EXECUTION_CANCELLED
        : ExecutionEventType.EXECUTION_FAILED,
      {
        status: execution.status,
        ...(!isCancelled ? { error: errMessage } : {}),
      },
    );
  }

  /**
   * #11 (followup) — retry 재진입 시 `node.config` 의 `{{ expression }}` 을
   * best-effort 로 평가해 `applyRetryLastTurn` 의 operational 필드 (llmConfigId /
   * maxTurns 등) 가 정상 dispatch 와 동일한 evaluated 값을 보도록 한다.
   *
   * 재진입 경로는 원본 nodeInput 을 영속하지 않으므로 (`_retryState` 최소화
   * 정책 — spec/conventions/node-output.md §4.2.1) `$input.*` 는 해소되지 않는다.
   * `$node` / `$var` / `$thread` / `$execution` / `$now` 는 rehydrated context
   * (`rehydrateContext` 가 upstream 출력을 seed) 에서 정상 해소된다.
   *
   * 평가 실패 시 raw config 로 안전 fallback — static config 회귀 없음.
   * **config echo (`rawConfig`) 는 본 메서드 결과가 아닌 raw 값을 유지해야 한다**
   * (spec/4-nodes/3-ai/1-ai-agent.md §config-echo: 항상 raw echo).
   */
  private resolveRetryNodeConfig(
    execution: Execution,
    node: Node,
    context: ExecutionContext,
  ): Record<string, unknown> {
    const rawConfig = node.config ?? {};
    try {
      // WARNING #4 수정: `findBy({ workflowId })` 로 전체 노드를 조회하던 것을
      // 이미 파라미터로 받은 `node` 한 건만 포함하는 Map 으로 교체.
      // `buildExpressionContext` 가 nodeMap 을 쓰는 목적은 `$node.<id>.output`
      // 참조 해소이며, 재진입 경로에서 upstream 노드의 outputData 는
      // `rehydrateContext` 가 `nodeOutputCache` 에 seed 한다.
      // 개별 노드 설정 expression(`$node`, `$var`, `$execution` 등) 해소에는
      // 현재 노드 하나로 충분하고, 대형 워크플로에서 수십~수백 row 조회 부작용을
      // 제거한다.
      const nodeMap = new Map([[node.id, node]]);
      const exprContext = this.expressionResolver.buildExpressionContext(
        // 재진입엔 원본 nodeInput 미영속 — `$input.*` 미해소 (documented limit).
        {},
        context,
        nodeMap,
        { startedAt: execution.startedAt?.toISOString?.() },
      );
      return this.expressionResolver.resolveConfig(
        rawConfig,
        exprContext,
        node.type,
      );
    } catch (err) {
      this.logger.warn(
        `applyRetryLastTurn: config expression 재평가 실패 — raw config 로 fallback ` +
          `(execution=${execution.id} node=${node.id}): ${
            err instanceof Error ? err.message : String(err)
          }`,
      );
      return rawConfig;
    }
  }

  /** retry replay 의 form_submitted action 용 — JSON 문자열이면 파싱, 아니면 그대로. */
  private tryParseJson(raw: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // not JSON — fall through.
    }
    return { __raw__: raw };
  }

  /**
   * Phase 2.5 — continuation publish 결과 → WS ack `queued` / `jobId` 매핑 helper.
   *
   * Phase 2 의 라우팅 원칙 (spec §7.4 "모든 진입점은 항상 BullMQ enqueue") 상
   * publish 가 정상 enqueue 되면 항상 `queued: true`. jobId 가 null 이면 Redis
   * 장애 등으로 enqueue 자체가 실패한 케이스 — caller (WS gateway / REST
   * controller) 는 이 경우 `success: false` 로 ack 한 뒤 client 재시도 유도.
   */
  private static buildPublishResult(
    jobId: string | null,
  ): ContinuationPublishResult {
    if (jobId === null) {
      // spec §7.4 publish 측 실패 — Redis 장애. queued 값은 의미 없음 (enqueue
      // 자체가 실패). caller 가 throw 로 다루도록 jobId=null + queued=false 반환.
      return { queued: false, jobId: null };
    }
    return { queued: true, jobId };
  }

  /**
   * Phase 2 (workflow-resumable-execution) — publisher 측 책임.
   * `execution_id + status='waiting_for_input'` 으로 NodeExecution 을 lookup.
   *
   * spec/5-system/4-execution-engine.md §7.5.1 — 변경 2.3. 0건 또는 다중 row 는
   * `INVALID_EXECUTION_STATE` 로 즉시 거부한다 ([InvalidExecutionStateError]).
   * caller (continueExecution 등) 는 이 throw 가 발생하면 BullMQ enqueue 를
   * 시도하지 않으므로, 옛 fallback sentinel (`__no_node_exec__`) publish → worker
   * `RESUME_CHECKPOINT_MISSING` (1-2초 지연) 경로 대신 동기 에러로 surface 된다.
   *
   * - 0건 — Execution 이 다른 상태(running / completed / cancelled / failed)거나
   *   nodeId 미일치.
   * - 2건 이상 — invariant 위반 (정상은 1건). race 또는 데이터 손상 의심. warn 후 거부.
   *
   * DB lookup 자체의 infra 실패는 `INVALID_EXECUTION_STATE` 가 아닌 원본 에러로
   * 재던져 caller (WS handler: 일반 실패 ack / REST: 500) 가 재시도하도록 한다.
   */
  private async resolveWaitingNodeExecutionId(
    executionId: string,
  ): Promise<string> {
    let rows: Array<{ id: string }>;
    try {
      rows = await this.nodeExecutionRepository.find({
        where: {
          executionId,
          status: NodeExecutionStatus.WAITING_FOR_INPUT,
        },
        select: { id: true, nodeId: true, startedAt: true },
        order: { startedAt: 'DESC' },
      });
    } catch (err) {
      this.logger.error(
        `resolveWaitingNodeExecutionId DB lookup 실패 — execution=${executionId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw err instanceof Error ? err : new Error(String(err));
    }

    if (rows.length === 0) {
      // 정상적인 client 에러 (execution 이 대기 상태가 아님). 진단용 상세는 서버
      // 로그에만 남기고 (review W-5) client 응답에는 고정 메시지만 surface.
      this.logger.debug(
        `resolveWaitingNodeExecutionId — execution=${executionId} 에 WAITING_FOR_INPUT NodeExecution 없음 — INVALID_EXECUTION_STATE.`,
      );
      throw new InvalidExecutionStateError(
        `no WAITING_FOR_INPUT NodeExecution for execution=${executionId}`,
      );
    }
    if (rows.length > 1) {
      this.logger.warn(
        `resolveWaitingNodeExecutionId — execution=${executionId} 에 WAITING_FOR_INPUT NodeExecution 이 ${rows.length} 건 (정상은 1). invariant 위반 — INVALID_EXECUTION_STATE 거부.`,
      );
      throw new InvalidExecutionStateError(
        `multiple (${rows.length}) WAITING_FOR_INPUT NodeExecutions for execution=${executionId} (invariant violation)`,
      );
    }
    return rows[0].id;
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
   * @param outgoingEdgeMap 노드의 outgoing edge 맵. spec/5-system/3-error-handling.md
   *   §3.2 의 "error 포트 연결 여부" 판정에 쓴다 — 핸들러가 `port: 'error'` 로
   *   라우팅했는데 연결된 error 엣지가 없으면 ERROR_PORT_FALLBACK 으로 Stop
   *   Workflow. **required** — 모든 호출 경로(main loop / rehydrate / container /
   *   parallel)가 자기 그래프 맵을 전달해 fallback 판정이 침묵하지 않도록 강제한다.
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
    nodeMap: Map<string, Node> | undefined,
    executionMeta: { startedAt?: string; mode?: string } | undefined,
    outgoingEdgeMap: Map<string, GraphEdge[]>,
  ): Promise<void> {
    // §3.2 — error 포트 라우팅 + error 엣지 미연결 시 finally 이후 던질 sentinel.
    let errorPortFallbackMessage: string | null = null;
    const nodeExecution = await this.createNodeExecution(
      executionId,
      node.id,
      NodeExecutionStatus.RUNNING,
      context.parentNodeExecutionId,
      nodeInput,
    );
    await this.eventEmitter.emitNode(
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
      // Phase 1.2 — Graceful Shutdown 추적. SIGTERM 수신 시 본 in-flight
      // 등록이 ShutdownStateService 의 drain wait + SERVER_INTERRUPTED 마킹
      // 대상이 된다. try 첫 줄에 배치해야 emitNode throw 후에도 finally 의
      // unregisterInFlight 가 보장됨 (W-1 fix — SUMMARY#W-1).
      this.shutdownState.registerInFlight(nodeExecution.id, executionId);

      // Get handler — wrapped 전체가 finally 의 unregisterInFlight 보장 대상.
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
        nodeLabel: node.label ?? '',
        nodeType: node.type,
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
      this.contextService.setStructuredOutput(
        this.contextKeyOf(context),
        node.id,
        adapted,
      );
      // Echo channel (structured.config = raw per Principle 7) and engine-
      // side action-parameter channel are now separated. Container paths
      // (runContainer/runParallel) read the evaluated snapshot from this
      // cache instead of `structured.config`, which would otherwise be raw
      // `{{...}}` and Number()/typeof checks would fail (Loop count → NaN,
      // Parallel branchCount → silent default).
      this.contextService.setEngineResolvedConfig(
        this.contextKeyOf(context),
        node.id,
        resolvedConfig,
      );
      const flatForCache = toEngineFlatShape(adapted);

      // If handler returned port-based output ({ port, data }), set _selectedPort
      // so that downstream routing filters edges correctly.
      const finalOutput = this.applyPortSelection(flatForCache);
      this.contextService.setNodeOutput(
        this.contextKeyOf(context),
        node.id,
        finalOutput,
      );
      executedNodes.add(node.id);

      // Check if this is a blocking node (waiting_for_input).
      // If so, defer NODE_COMPLETED — it will be emitted after user interaction.
      // Emitting it now would cause the frontend to mark the node as done
      // before the WAITING_FOR_INPUT event arrives.
      const isBlocking =
        output &&
        typeof output === 'object' &&
        (output as Record<string, unknown>).status === 'waiting_for_input';

      if (!isBlocking && this.isErrorPortRouted(finalOutput)) {
        // spec/5-system/3-error-handling.md §3.2 — 핸들러가 런타임 실패를
        // `port: 'error'` 로 라우팅한 경우. D4 결정(2026-05-17) 이후 Integration·
        // LLM·Code·Workflow 노드 8종은 throw 대신 이 경로로 실패를 surface 하므로,
        // 엔진이 COMPLETED 로 오인하지 않도록 FAILED 로 finalize 한다. error 엣지
        // 미연결이면 폴백 메시지를 돌려받아 finally 이후 throw (Stop Workflow).
        errorPortFallbackMessage = await this.finalizeErrorPortNode(
          executionId,
          node,
          nodeExecution,
          context,
          output,
          finalOutput,
          outgoingEdgeMap,
        );
      } else if (!isBlocking) {
        // Update node execution record
        nodeExecution.status = NodeExecutionStatus.COMPLETED;
        nodeExecution.outputData = (output as Record<string, unknown>) ?? {};
        nodeExecution.finishedAt = new Date();
        nodeExecution.durationMs =
          nodeExecution.finishedAt.getTime() -
          nodeExecution.startedAt.getTime();
        await this.nodeExecutionRepository.save(nodeExecution);
        await this.eventEmitter.emitNode(
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
      // spec/conventions/node-cancellation.md §5.1 — abortSignal 로 노드 외부 I/O
      // 가 중단된 경우(AbortError)는 실패가 아니라 취소다. errorPolicy 와 무관하게
      // NodeExecution.status=cancelled 로 기록하고 NODE_CANCELLED 이벤트를 발행한 뒤
      // abort 를 그대로 re-throw 해 생산자(ParallelExecutor cancel-others-on-fail
      // aggregation 등)가 워크플로 흐름을 마감하게 한다 (§5.2). 타임라인이 running
      // 에 영구 잔류하지 않도록 terminal 이벤트를 반드시 발행한다.
      if (isAbortError(error)) {
        // spec/conventions/node-cancellation.md §5.1 — `output.error` 봉투 형식:
        // `{ code: 'AbortError', message }` (node-output.md Principle 3.2 와 동형).
        const errorEnvelope = { code: 'AbortError', message: error.message };
        nodeExecution.status = NodeExecutionStatus.CANCELLED;
        nodeExecution.error = errorEnvelope;
        nodeExecution.finishedAt = new Date();
        nodeExecution.durationMs =
          nodeExecution.finishedAt.getTime() -
          nodeExecution.startedAt.getTime();
        await this.nodeExecutionRepository.save(nodeExecution);
        await this.eventEmitter.emitNode(
          executionId,
          node.id,
          NodeEventType.NODE_CANCELLED,
          {
            nodeExecutionId: nodeExecution.id,
            parentNodeExecutionId: context.parentNodeExecutionId,
            status: NodeExecutionStatus.CANCELLED,
            error: errorEnvelope,
            nodeType: node.type,
            nodeLabel: node.label ?? node.type,
            input: nodeExecution.inputData,
            startedAt: nodeExecution.startedAt?.toISOString?.(),
            finishedAt: nodeExecution.finishedAt?.toISOString?.(),
          },
        );
        throw error;
      }

      // exec-park D6 — 중첩 Workflow 노드의 executeInline 이 sub-workflow blocking
      // park 으로 `ParkReleaseSignal` 을 throw 한 경우. 노드 실패가 아니라 park 신호
      // 이므로 error-policy(skip/use_default/fail)를 적용하지 않고 그대로 re-throw 해
      // 상위(runExecution/runNodeDispatchLoop)가 세그먼트를 종료하게 한다. 이 invoker
      // Workflow 노드의 NodeExecution 은 RUNNING 으로 잔류하고(COMPLETED 안 됨),
      // 재개 시 `driveCallStackResume` 가 executeNode 우회로 frame 을 재진입한다.
      if (error instanceof ParkReleaseSignal) {
        throw error;
      }

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
          await this.eventEmitter.emitNode(
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
            this.contextKeyOf(context),
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
            this.contextKeyOf(context),
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
          await this.eventEmitter.emitNode(
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
    } finally {
      // Phase 1.2 — register 짝. handler 결과·에러·throw 무관 항상 해제.
      this.shutdownState.unregisterInFlight(nodeExecution.id);
    }

    // spec/5-system/3-error-handling.md §3.2 / §1.4 — error 포트로 라우팅됐지만
    // 연결된 엣지가 없는 경우. 노드는 이미 FAILED 로 마킹됐고, 여기서 Stop
    // Workflow 폴백을 트리거한다. throw 가 호출 스택을 타고 runExecution 의
    // top-level catch 로 전파돼 Execution.status=FAILED + EXECUTION_FAILED 가
    // 된다 (errorPolicy `stop` 의 throw 와 동일 메커니즘).
    if (errorPortFallbackMessage !== null) {
      this.logger.warn(
        `Execution ${executionId} node ${node.id} (${node.type}) routed to ` +
          `error port with no connected edge — ERROR_PORT_FALLBACK, stopping workflow`,
      );
      throw new ErrorPortFallbackError(errorPortFallbackMessage);
    }
  }

  /**
   * spec/5-system/3-error-handling.md §3.2 — 핸들러가 `port: 'error'` 로 라우팅한
   * 노드를 FAILED 로 finalize 하고 NODE_FAILED 를 emit 한다.
   *
   * @returns error 포트에 연결된 엣지가 없으면 Stop Workflow 폴백을 트리거할
   *   메시지(호출부가 finally 이후 ErrorPortFallbackError 로 throw), 연결돼 있으면
   *   `null` (Execution 계속 진행).
   */
  private async finalizeErrorPortNode(
    executionId: string,
    node: Node,
    nodeExecution: NodeExecution,
    context: ExecutionContext,
    rawOutput: unknown,
    finalOutput: unknown,
    outgoingEdgeMap: Map<string, GraphEdge[]>,
  ): Promise<string | null> {
    const errorEnvelope = (finalOutput as Record<string, unknown>).error as
      | { code?: unknown; message?: unknown }
      | undefined;
    const errorCode =
      typeof errorEnvelope?.code === 'string' ? errorEnvelope.code : undefined;
    // 외부 서버가 반환한 메시지가 DB(JSONB) 비대화·WS payload 비대화를 일으키지
    // 않도록 길이를 제한한다 (ai-review security WARNING).
    const errorMessage = clampNodeErrorMessage(
      typeof errorEnvelope?.message === 'string'
        ? errorEnvelope.message
        : 'Node routed to error port',
    );
    nodeExecution.status = NodeExecutionStatus.FAILED;
    nodeExecution.outputData = (rawOutput as Record<string, unknown>) ?? {};
    nodeExecution.error = {
      message: errorMessage,
      ...(errorCode ? { code: errorCode } : {}),
    };
    nodeExecution.finishedAt = new Date();
    nodeExecution.durationMs =
      nodeExecution.finishedAt.getTime() - nodeExecution.startedAt.getTime();
    await this.nodeExecutionRepository.save(nodeExecution);
    await this.eventEmitter.emitNode(
      executionId,
      node.id,
      NodeEventType.NODE_FAILED,
      {
        nodeExecutionId: nodeExecution.id,
        parentNodeExecutionId: context.parentNodeExecutionId,
        status: NodeExecutionStatus.FAILED,
        duration: nodeExecution.durationMs,
        error: errorMessage,
        nodeType: node.type,
        nodeLabel: node.label ?? node.type,
        output: nodeExecution.outputData,
        input: nodeExecution.inputData,
        startedAt: nodeExecution.startedAt?.toISOString?.(),
        finishedAt: nodeExecution.finishedAt?.toISOString?.(),
      },
    );
    // §3.2 — error 포트에 연결된 엣지가 없으면 Stop Workflow 폴백.
    return this.hasConnectedErrorEdge(node.id, outgoingEdgeMap)
      ? null
      : errorMessage;
  }

  /**
   * 노드 출력이 error 포트로 라우팅됐는지 판정. `toEngineFlatShape` +
   * `applyPortSelection` 을 거친 flat output 의 `_selectedPort === 'error'`
   * (문자열) 여부로 본다. Parallel 의 `_selectedPort: ['done']` (배열) 등은
   * 매칭되지 않는다.
   */
  private isErrorPortRouted(finalOutput: unknown): boolean {
    return (
      !!finalOutput &&
      typeof finalOutput === 'object' &&
      !Array.isArray(finalOutput) &&
      (finalOutput as Record<string, unknown>)._selectedPort === 'error'
    );
  }

  /**
   * 해당 노드의 outgoing edge 중 `sourcePort === 'error'` 인 것이 하나라도
   * 있으면 true. spec/5-system/3-error-handling.md §3.2 의 "error 포트 엣지
   * 연결 여부" 판정.
   */
  private hasConnectedErrorEdge(
    nodeId: string,
    outgoingEdgeMap: Map<string, GraphEdge[]>,
  ): boolean {
    const edges = outgoingEdgeMap.get(nodeId) ?? [];
    return edges.some((e) => e.sourcePort === 'error');
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

  // C-1 step3 (W5) — orchestrator 가 사용하지 않으므로 EngineDriver 표면에서
  // 제거하고 엔진 내부 전용으로 되돌렸다 (ISP). LLM-default single-flight 캐시.
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
  // C-1 step3 (W5) — orchestrator 미사용으로 EngineDriver 표면에서 제거, 엔진
  // 내부 전용으로 되돌림 (ISP).
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

    // 노드 dispatch 직전 사전 abort 체크 (spec/conventions/node-cancellation.md
    // §5.1). 이미 abort 된 cancellation 컨텍스트(예: cancel-others-on-fail 첫
    // 분기 실패 후)면 핸들러를 실행하지 않고 즉시 AbortError 를 throw — executeNode
    // catch 가 이를 cancelled 로 분류한다. signal 미설정 노드는 무영향.
    context.abortSignal?.throwIfAborted();

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

        // abort 는 재시도 대상이 아님 — cancellation 은 terminal 이므로 즉시 전파.
        if (isAbortError(lastError)) {
          throw lastError;
        }

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

  /**
   * 단일 노드 실행(§1.3) 입력 pre-seed. `previousExecutionId` 가 가리키는 직전
   * 실행에서 대상 노드의 직속 predecessor 들의 출력을 조회해 현재 실행 context 의
   * nodeOutputCache / structuredOutputCache 에 채우고 `executedNodes` 에 등록한다.
   * 그 결과 main loop 의 `gatherNodeInput` 이 정상 실행과 동일하게 상류 출력을
   * 재구성하고, 대상 노드의 `$node['predecessor']` 표현식도 resolve 된다.
   *
   * previousExecutionId 미지정 또는 predecessor 없음 → no-op (gatherNodeInput 이
   * workflowInput=수동 입력으로 fallback). 직속 predecessor 만 seed 하므로 비인접
   * `$node[...]` 참조나 추가 컨텍스트는 복원하지 않는다(디버그 도구 v1 범위 —
   * spec/5-system/13-replay-rerun.md §15 C3 재조정 주석 참조).
   */
  private async seedSingleNodePredecessorOutputs(
    savedExecution: Execution,
    targetNodeId: string,
    incomingEdgeMap: Map<string, GraphEdge[]>,
    context: ExecutionContext,
    executedNodes: Set<string>,
  ): Promise<void> {
    const previousExecutionId = savedExecution.previousExecutionId;
    if (!previousExecutionId) {
      return;
    }
    const predecessorIds = (incomingEdgeMap.get(targetNodeId) ?? []).map(
      (e) => e.sourceNodeId,
    );
    if (predecessorIds.length === 0) {
      return;
    }
    const outputs = await this.getLatestPredecessorOutputs(
      previousExecutionId,
      predecessorIds,
    );
    const ctxKey = this.contextKeyOf(context);
    for (const [predId, storedOutput] of outputs) {
      // NodeExecution.outputData 는 canonical `{config, output, ...}` 형태로
      // 저장되므로(handler raw return / adapted) adaptHandlerReturn 으로 정규화한다.
      // 혹시 비-canonical(legacy/배포 이전 row, scalar/array 등)이면 lenient
      // wrapper 로 폴백한다 — wrapBareAsNodeHandlerOutput 은 null/scalar/array/object
      // 전부 안전 처리하므로 어떤 stored shape 도 throw 없이 복원된다.
      const adapted = isCanonicalHandlerOutput(storedOutput)
        ? adaptHandlerReturn(storedOutput)
        : wrapBareAsNodeHandlerOutput(storedOutput);
      // 정상 실행의 노드 완료 경로(setStructuredOutput → setNodeOutput(flat))를
      // 동일 순서로 재현해 두 캐시 상태를 무손실 복원한다.
      this.contextService.setStructuredOutput(ctxKey, predId, adapted);
      this.contextService.setNodeOutput(
        ctxKey,
        predId,
        this.applyPortSelection(toEngineFlatShape(adapted)),
      );
      executedNodes.add(predId);
    }
  }

  /**
   * 주어진 실행(executionId)에서 지정 노드들의 **최신** 완료 출력(output_data)을
   * 조회한다. 컨테이너 반복 등으로 한 노드가 여러 NodeExecution 을 가질 수 있어
   * finishedAt DESC 정렬 후 노드별 첫 행만 취한다. 단일 노드 실행 입력 pre-seed 전용.
   * 동일 finishedAt 동점 시 순서가 비결정적이지 않도록 id DESC 로 tie-break 한다.
   */
  private async getLatestPredecessorOutputs(
    executionId: string,
    predecessorNodeIds: string[],
  ): Promise<Map<string, Record<string, unknown>>> {
    const result = new Map<string, Record<string, unknown>>();
    if (predecessorNodeIds.length === 0) {
      return result;
    }
    const rows = await this.nodeExecutionRepository.find({
      where: {
        executionId,
        nodeId: In(predecessorNodeIds),
        status: NodeExecutionStatus.COMPLETED,
      },
      order: { finishedAt: 'DESC', id: 'DESC' },
    });
    for (const row of rows) {
      if (!result.has(row.nodeId) && row.outputData != null) {
        result.set(row.nodeId, row.outputData);
      }
    }
    return result;
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
  // C-1 step2 — EngineDriver member (port 라우팅, orchestrator 가 driver 경유).
  public applyPortSelection(output: unknown): unknown {
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
   *  - `_resumeCheckpoint`: DB-persisted credential-strip subset of
   *    `_resumeState` (§7.5 rehydration). Internal-only — downstream nodes
   *    must not receive it (same policy as `_resumeState`).
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
      !('_resumeState' in o) &&
      !('_resumeCheckpoint' in o)
    ) {
      return output;
    }
    const {
      _selectedPort: _sp,
      port: _p,
      status: _st,
      _resumeState: _rs,
      _resumeCheckpoint: _rc,
      ...rest
    } = o;
    void _sp;
    void _p;
    void _st;
    void _rs;
    void _rc;
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
    await this.eventEmitter.emitNode(
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
        await this.eventEmitter.emitNode(
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
        outgoingEdgeMap,
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
  private assertNoContainerCycle(
    containerNode: Node,
    children: Node[],
    byId: Map<string, Node>,
  ): void {
    // perf #5 — 호출자(planContainerBody)가 이미 빌드한 nodeMap/children 을
    // 재사용한다 (Map 이중 생성 + allNodes 전수 스캔 제거). 검사 의미는
    // 동일: 직접 자식 각각에서 containerId 조상 체인을 따라 사이클 검출.
    for (const node of children) {
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
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
    const children = allNodes.filter((n) => n.containerId === containerNode.id);
    // Detect a containerId cycle (e.g. A.containerId=B && B.containerId=A)
    // before doing any further work so the user gets a clear error instead of
    // an infinite loop or stack overflow. (perf #5 — nodeMap/children 빌드만
    // 검사 앞으로 이동: 순수 lookup 자료구조 생성이라 에러 우선순위 불변.)
    this.assertNoContainerCycle(containerNode, children, nodeMap);

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
    // 본문은 메인과 동일한 executionId 를 NodeExecution 그룹핑·WS 채널용으로
    // 공유하되, in-memory context 는 별도 Map 키(bgKey)로 등록해 부모와 격리한다
    // (spec/4-nodes/1-logic/12-background.md §4 / execution-context.md 원칙 4).
    // 이로써 부모 runExecution finally 의 deleteContext(executionId) 가 fire-and-forget
    // 본문이 쓰던 context 를 삭제하던 race ("Execution context not found") 를 차단.
    // backgroundRunId 가 모니터링 전역 유일 키(UUID v4, spec §5.1)이므로 1차 사용.
    // 옛 BullMQ job(빈 backgroundRunId)은 parentNodeExecutionId(Background 노드별
    // NodeExecution id — 동일 execution 내 bg 노드 간 구분)로, 그마저 없으면 'root'
    // 로 폴백한다. 정상 경로는 backgroundRunId 로 항상 유일. (backgroundRunId 가 모든
    // job 레코드에 채워진 이후엔 이 폴백 체인 제거 가능.)
    const bgKeySuffix =
      job.backgroundRunId || job.parentNodeExecutionId || 'root';
    const bgKey = `bg:${job.executionId}:${bgKeySuffix}`;
    const context = this.contextService.createContext(
      job.executionId,
      job.workflowId,
      { contextKey: bgKey },
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

    try {
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
    } catch (err) {
      // exec-park D6 full B3 — 본문이 interactive 노드(form/button/ai)로 park 하면
      // executeInline 이 `ParkReleaseSignal` 을 throw 한다. background 는
      // fire-and-forget 라 외부 continueExecution 으로 재개되지 않으므로(durable park
      // 무의미) 여기서 graceful 하게 종료한다 — 옛 모델은 pendingContinuations(bgKey)에
      // 등록 후 maxDurationMs 까지 hang 했으나, 이제 park 즉시 본문이 종료된다.
      if (err instanceof ParkReleaseSignal) {
        this.logger.debug(
          `[background] body parked at interactive node — fire-and-forget 종료(외부 재개 불가). execution=${job.executionId}`,
        );
      } else {
        throw err;
      }
    } finally {
      // 본문 전용 bgKey context 를 자체 정리 — 메인 runExecution finally 의
      // deleteContext(executionId) 와 독립. (멱등: 미존재 시 no-op.)
      this.contextService.deleteContext(bgKey);
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
   * `PARALLEL_NESTED_DEPTH_EXCEEDED` so the user sees a named error at
   * dispatch time instead of a mid-flight surprise.
   *
   * `currentDepth` (parallel-p2 결정 #3, 2026-05-30) — outermost Parallel 호출
   * 시 1, 외부의 분기 body 안에서 dispatch 되는 내부 Parallel 시 2. depth=1 의
   * 분기 body 에 내부 Parallel 발견 시 허용 (depth=2 가 되는 시점에 dispatch
   * 되어 내부 planParallelBody 가 다시 호출됨). depth=2 의 분기 body 에 또
   * Parallel 발견 시 (= depth 3 시도) `PARALLEL_NESTED_DEPTH_EXCEEDED` throw.
   * `runParallel` 가 context 가 `ParallelBranchContext` 인지 (즉
   * `parentParallelConcurrency` 보유 여부) 로 자기 depth 를 판별.
   */
  private planParallelBody(
    parallelNode: Node,
    allNodes: Node[],
    forwardEdges: GraphEdge[],
    backEdges: GraphEdge[],
    branchCount: number,
    currentDepth: 1 | 2 = 1,
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
      // perf #6 — `queue.shift()`(O(N) 앞당김)를 인덱스 포인터로 교체.
      // 순회 순서는 동일 (FIFO BFS).
      const queue = [...branchEntries[i]];
      let head = 0;
      while (head < queue.length) {
        const nodeId = queue[head++];
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
          // parallel-p2 결정 #3 (2026-05-30): 중첩 Parallel 허용 (깊이 ≤ 2).
          // depth=1 (outermost) 의 분기에 내부 Parallel 발견 시 허용 — 내부
          // Parallel 이 자기 dispatch 시점에 currentDepth=2 로 planParallelBody
          // 를 다시 호출하므로 그때 또 안에 Parallel 이 있으면 reject.
          if (currentDepth >= 2) {
            throw new Error(
              `PARALLEL_NESTED_DEPTH_EXCEEDED: Nested Parallel node "${parallelNode.label ?? parallelNode.type}" body contains another Parallel node "${node.label ?? node.type}". Parallel nesting depth > 2 is not supported.`,
            );
          }
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
        await this.eventEmitter.emitNode(
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
        plan.outgoingEdgeMap,
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
    // 결정 K (2026-05-30): waitAll=false 지원 spec out — schema validate
    // (validateParallelConfig) 가 사전 reject 하므로 engine 도달 불가.
    // ParallelExecutor 의 waitAll 인자는 호환성 위해 hardcoded true 로 전달.

    // W-7: parallel-specific `config.errorPolicy` 가 1순위. 미지정 시 공통
    // `errorHandling.policy` 의 매핑으로 fallback (옛 동선 호환). 둘 다 미지정
    // 이면 'stop'.
    // parallel-p2 §5 (결정 A + H, 2026-05-30): `cancel-others-on-fail` 도 valid.
    const parallelErrorPolicyRaw = engineResolvedConfig.errorPolicy;
    let errorPolicy: ParallelErrorPolicy;
    if (
      parallelErrorPolicyRaw === 'stop' ||
      parallelErrorPolicyRaw === 'continue' ||
      parallelErrorPolicyRaw === 'cancel-others-on-fail'
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

    // parallel-p2 결정 #3 + G (2026-05-30): 중첩 Parallel 깊이 판별. 외부 Parallel
    // 이 자기 effectiveConcurrency 를 branch 의 ParallelBranchContext 에 set 하므로,
    // 본 runParallel 의 context 가 ParallelBranchContext 면 자기는 inner
    // (depth=2). 없으면 outermost (depth=1).
    // `parentParallelConcurrency` 는 더 이상 ExecutionContext 공통 필드가 아니라
    // ParallelBranchContext 전용이므로 (spec/conventions/execution-context.md §원칙 2)
    // `in` 연산자로 좁혀 접근한다.
    const parentParallelConcurrency: number | undefined =
      'parentParallelConcurrency' in context
        ? (context as ParallelBranchContext).parentParallelConcurrency
        : undefined;
    const currentParallelDepth: 1 | 2 =
      parentParallelConcurrency !== undefined ? 2 : 1;

    const plan = this.planParallelBody(
      parallelNode,
      allNodes,
      forwardEdges,
      backEdges,
      branchCount,
      currentParallelDepth,
    );

    // Resolve the Parallel node's current NodeExecution row so branch
    // children can be grouped under it in the run-results timeline
    // (mirrors the Background node's parentNodeExecutionId stamping).
    const parentNodeExecution = await this.nodeExecutionRepository.findOne({
      where: { executionId, nodeId: parallelNode.id },
      order: { startedAt: 'DESC' },
    });
    const parentNodeExecutionId = parentNodeExecution?.id;
    // W-2 (parallel-p2-followups §7): 명시 `: ExecutionContext` 주석 제거 — 추론에
    // 위임. 주석을 달면 context 가 ParallelBranchContext 일 때 spread 로 따라오는
    // `parentParallelConcurrency` ghost field 가 타입에서 은닉돼, 읽는 쪽이 "없는 필드"
    // 로 오인한다. 추론에 맡기면 실제 객체 shape 이 타입에 그대로 드러난다.
    const branchParentContext = parentNodeExecutionId
      ? { ...context, parentNodeExecutionId }
      : context;

    const parallelResult = await this.parallelExecutor.execute(
      { branchCount, maxConcurrency, waitAll: true, errorPolicy },
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
      // 결정 #3 + G: 본 Parallel 이 inner (depth=2) 면 부모 분기가 넘긴
      // effectiveConcurrency 를 executor 에 명시 전달해 자기 concurrency 를
      // floor(32/parent) 로 silent clamp 시킨다. outermost (depth=1) 면 undefined.
      parentParallelConcurrency,
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
    // parallel-p2 결정 #3 + G + D (runtime 부분, 2026-05-30): 중첩 Parallel 의
    // concurrency cap silent clamp 발생 시 meta.clampedConcurrency 에 기록 —
    // run-results timeline + expression `$node["X"].meta.clampedConcurrency` 로
    // 사용자가 "의도 vs 실제" 차이를 즉시 확인. frontend 사전 경고
    // (cross-node-warning-rules.md) 와 별개로 runtime 추적성 확보.
    this.contextService.setStructuredOutput(
      this.contextKeyOf(context),
      parallelNode.id,
      {
        config: echoConfig,
        output: { branches: branchResults, count: branchResults.length },
        port: ['done'],
        ...(parallelResult.clampedConcurrency
          ? { meta: { clampedConcurrency: parallelResult.clampedConcurrency } }
          : {}),
      },
    );

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
      await this.eventEmitter.emitNode(
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

    this.contextService.setStructuredOutput(
      this.contextKeyOf(context),
      containerNode.id,
      {
        config: echoConfig,
        output: structuredOutput,
        ...(mergedMeta !== undefined ? { meta: mergedMeta } : {}),
      },
    );
    this.contextService.setNodeOutput(
      this.contextKeyOf(context),
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
  /**
   * PR2a — §8 active-running 누적 타임아웃 enforce. dispatch loop 가 노드 사이마다
   * 호출한다. 현재까지의 누적 active 시간(영속 `activeRunningMs` + 진행 중 세그먼트의
   * 경과분)이 한도 이상이면 `ExecutionTimeLimitError` throw → run failure 빌더가
   * `Execution.error.code = EXECUTION_TIME_LIMIT_EXCEEDED` 로 종결. 첫 호출은
   * "세그먼트 시작 시 이미 한도 초과" 케이스(multi-segment 누적)를, 이후 호출은
   * 단일 세그먼트가 한도를 넘는 케이스를 잡는다. `maxActiveRunningMs <= 0` 은 무제한.
   * waiting_for_input park 시간은 RUNNING 이 아니라 누적에 포함되지 않는다(불변식).
   */
  private assertActiveTimeWithinLimit(
    execution: Pick<Execution, 'id' | 'activeRunningMs'>,
  ): void {
    if (this.maxActiveRunningMs <= 0) return;
    const segStart = this.segmentStartMs.get(execution.id);
    const inProgress = segStart !== undefined ? Date.now() - segStart : 0;
    const activeNow = (execution.activeRunningMs ?? 0) + inProgress;
    if (activeNow >= this.maxActiveRunningMs) {
      // W3(ai-review SECURITY) — 수치(누적 ms / 한도 ms)는 서버 로그에만 기록.
      // ExecutionTimeLimitError.message 는 고정 문자열이므로 REST/WS 에 수치가 노출되지 않는다.
      this.logger.warn(
        `Execution ${execution.id} active-running limit reached: ` +
          `${activeNow}ms accumulated, limit ${this.maxActiveRunningMs}ms`,
      );
      throw new ExecutionTimeLimitError(activeNow, this.maxActiveRunningMs);
    }
  }

  /**
   * 시스템 변수(`__*` prefix)를 제외한 사용자 정의 변수만 추출한다.
   * `stageDurableResumeSnapshot` 과 `rehydrateUserVariables` 가 공유하는
   * 단일 출처 — `__*` 필터 기준 변경 시 이 한 곳만 수정하면 된다.
   * (INFO #4: `__` prefix 필터 로직 중복 해소)
   */
  private filterUserVariables(
    vars: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(vars)) {
      if (!key.startsWith('__')) out[key] = value;
    }
    return out;
  }

  /**
   * park(waiting_for_input) 직전, durable resume 에 필요한 in-flight 상태
   * (`conversationThread` + 사용자 정의 `variables`)를 Execution 행에 실어 둔다.
   * 호출자가 곧바로 `updateExecutionStatus(..., WAITING_FOR_INPUT, linkedNodeExec)`
   * 를 호출하면 **상태 전이와 같은 트랜잭션**으로 `Execution.conversation_thread`
   * / `Execution.user_variables` 에 durable commit 된다 (추가 DB 왕복 없음).
   * §7.5 rehydration 이 이 스냅샷에서 thread/variables 를 무손실 복원한다.
   * - thread: cloneThread 로 깊은 복사 (이후 turn mutation 격리).
   * - variables: 시스템 `__*` 제외 사용자분만 스냅샷 — rehydration 이 `__*` 를
   *   별도 재주입하므로 미포함. 값은 coerce-type 보장으로 JSON-serializable. stage→
   *   save 가 동기 연속이라 얕은 필터로 충분(중간 mutation 없음).
   * @remarks 호출처: 3개 park 진입 지점 모두에서 updateExecutionStatus 직전 호출
   *   (form park L~3505, button park L~5115, AI park L~6092).
   * (spec: conversation-thread §4·§8.4, 4-execution-engine §6.1/§6.2/§7.5, 1-data-model §2.13)
   */
  // C-1 step2 — EngineDriver member (§7.5 durable snapshot 스테이징).
  public stageDurableResumeSnapshot(
    execution: Execution,
    context: ExecutionContext,
  ): void {
    execution.conversationThread = cloneThread(context.conversationThread);
    execution.userVariables = this.filterUserVariables(context.variables);
    // exec-park D6 — 중첩 sub-workflow(executeInline) 안에서 park 한 경우
    // (`context._callStack` 비어있지 않음) 호출 체인을 함께 영속해 §7.5 rehydration
    // 이 frame-by-frame 재진입할 수 있게 한다. top-level park(빈 스택)은 NULL 로
    // 명시 재설정 — 같은 Execution 행이 이전 중첩 park 의 stale stack 을 보유하지
    // 않도록(예: 중첩 park→재개→top-level 노드 park). version 으로 스키마 가드.
    execution.resumeCallStack = this.snapshotCallStack(context);
  }

  /**
   * exec-park D6 — `context._callStack`(중첩 executeInline 호출 체인)을
   * `Execution.resume_call_stack`(V087) durable envelope 로 직렬화한다. 비어있거나
   * 미설정(top-level park)이면 `null` 을 반환해 컬럼을 명시적으로 비운다.
   * frames 는 cloneFrame(얕은 복사)으로 이후 pop mutation 과 격리한다.
   */
  private snapshotCallStack(context: ExecutionContext): ResumeCallStack | null {
    const stack = context._callStack;
    if (!stack || stack.length === 0) return null;
    return {
      version: CALL_STACK_SCHEMA_VERSION,
      frames: stack.map((f) => ({
        workflowId: f.workflowId,
        invokerNodeId: f.invokerNodeId,
        recursionDepth: f.recursionDepth,
      })),
    };
  }

  /**
   * §7.5 rehydration — `Execution.user_variables` 스냅샷을 안전한 plain object 로
   * 정규화한다. raw 가 null/비객체/배열이면 빈 객체(회귀 없음). 방어적으로 시스템
   * `__*` 키는 제외한다 (스냅샷에 없어야 하나, 손상 대비 — `__*` 는 createContext 가
   * 별도 재주입하므로 사용자 스냅샷이 덮어쓰면 안 됨).
   * Array 입력은 숫자 인덱스 키 유출 방지를 위해 `{}` 반환 (INFO #5).
   */
  private rehydrateUserVariables(raw: unknown): Record<string, unknown> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return this.filterUserVariables(raw as Record<string, unknown>);
  }

  /**
   * Execution 상태 전이의 단일 choke point.
   *
   * @returns `true` 면 전이가 DB 에 반영됨. `false` 는 **else 분기(linkedNodeExec
   *   없음)에서만** 발생 — 동시 cancel/park 가 DB 를 이미 terminal 로 옮겨
   *   guarded UPDATE 가 0행 매칭(no-op)된 경우다. 호출부는 이때 terminal emit 을
   *   skip 해 이벤트 이중 발행/terminal status 전복을 막아야 한다 (M-3).
   *   linkedNodeExec 분기(spec §1.2 짝 전이)는 항상 `true`.
   */
  // C-1 step2 — EngineDriver member (상태 전이 단일 choke point).
  public async updateExecutionStatus(
    execution: Execution,
    newStatus: ExecutionStatus,
    linkedNodeExec?: NodeExecution,
    opts?: { allowRetryReentry?: boolean },
  ): Promise<boolean> {
    assertTransition(execution.status, newStatus, opts);
    // PR2a — §8 active-running 누적 시간 추적. 모든 상태 전이의 단일 choke point.
    // RUNNING 진입(어느 세그먼트 entry point 든) → 세그먼트 시작 시각 기록.
    // RUNNING 이탈(waiting_for_input / completed / failed / cancelled) → 그 세그먼트의
    // active 시간을 Execution.activeRunningMs 에 합산(아래 save 로 영속). waiting_for_input
    // park 동안은 RUNNING 이 아니므로 자연히 제외된다(불변식).
    const prevStatus = execution.status;
    if (newStatus === ExecutionStatus.RUNNING && prevStatus !== newStatus) {
      this.segmentStartMs.set(execution.id, Date.now());
    } else if (
      prevStatus === ExecutionStatus.RUNNING &&
      newStatus !== ExecutionStatus.RUNNING
    ) {
      const segStart = this.segmentStartMs.get(execution.id);
      if (segStart !== undefined) {
        execution.activeRunningMs =
          (execution.activeRunningMs ?? 0) + (Date.now() - segStart);
        this.segmentStartMs.delete(execution.id);
      }
    }
    if (linkedNodeExec) {
      await this.dataSource.transaction(async (manager) => {
        execution.status = newStatus;
        await manager.save(Execution, execution);
        await manager.save(NodeExecution, linkedNodeExec);
      });
      this.emitTerminalExecutionMetrics(execution, newStatus, true);
      return true;
    }

    // M-3 — else 분기: 옛 full-entity save 는 stale 엔티티의 모든 컬럼을 덮어써,
    // 동시 cancel/park 전이를 잃어버리는 lost-update 위험이 있었다. 이를 lifecycle
    // 컬럼만 쓰는 guarded UPDATE 로 교체한다. `status IN (비-terminal)` 가드로 DB 가
    // 이미 terminal 이면 0행 매칭 → no-op + false 반환(호출부 emit skip). 쓰는 컬럼은
    // 옛 full-save 가 쓰던 컬럼의 부분집합(이 엔티티는 full-save 되던 것이므로 안전)
    // 이라, 동시 park 가 기록하는 conversation_thread/user_variables 는 건드리지
    // 않는다. jsonb 는 raw 파라미터에 명시 JSON.stringify(codebase raw-query 관용).
    // else 분기 호출은 RUNNING / COMPLETED 전이뿐이며 FAILED/CANCELLED 직접 마감과
    // linkedNodeExec 짝 전이는 범위 밖.
    execution.status = newStatus;
    const updated: Array<{ id: string }> = await this.executionRepository.query(
      `UPDATE execution
          SET status = $2,
              active_running_ms = $3,
              finished_at = $4,
              duration_ms = $5,
              output_data = $6::jsonb,
              resume_call_stack = $7::jsonb
        WHERE id = $1
          AND status IN ('pending', 'running', 'waiting_for_input')
        RETURNING id`,
      [
        execution.id,
        newStatus,
        execution.activeRunningMs ?? 0,
        execution.finishedAt ?? null,
        execution.durationMs ?? null,
        execution.outputData == null
          ? null
          : JSON.stringify(execution.outputData),
        execution.resumeCallStack == null
          ? null
          : JSON.stringify(execution.resumeCallStack),
      ],
    );
    const persisted = updated.length > 0;
    this.emitTerminalExecutionMetrics(execution, newStatus, persisted);
    return persisted;
  }

  /**
   * NF-OB-07 — 실행이 terminal 로 전이했고 그 전이가 실제 영속됐을 때만 메트릭을
   * 발생시킨다 (guarded UPDATE 가 0행이면 이미 terminal 인 중복 전이라 skip).
   * `clemvion.execution.total{status}` + 실패 시 `clemvion.execution.errors{error_code}`,
   * 그리고 노드 지연 histogram(fire-and-forget)을 기록한다. 메트릭 실패가 실행
   * 경로에 영향을 주지 않도록 전부 무동작-안전하다.
   */
  private emitTerminalExecutionMetrics(
    execution: Execution,
    newStatus: ExecutionStatus,
    persisted: boolean,
  ): void {
    if (!persisted) return;
    if (!ExecutionEngineService.TERMINAL_STATUSES.has(newStatus)) return;
    this.businessMetrics.recordExecutionTerminal(newStatus);
    if (newStatus === ExecutionStatus.FAILED) {
      const code =
        (execution.error?.code as string | undefined)?.trim() || 'unknown';
      this.businessMetrics.recordExecutionError(code);
    }
    // 노드 지연 histogram — 종료된 실행의 node_execution duration 을 비동기로 기록.
    // 실행 마감 경로를 막지 않도록 fire-and-forget (오류 swallow).
    void this.recordNodeLatencyMetrics(execution.id);
  }

  /**
   * 실행의 종료된 node_execution 들의 `duration_ms` 를 node_type·status 라벨로
   * histogram 에 기록한다. terminal 전이 시 1회 호출되는 단일 지점이라 노드별
   * 산발 계측 없이 모든 노드 지연을 모은다.
   *
   * QueryBuilder 로 `ne.id / ne.duration_ms / ne.status / n.type` 4컬럼만 SELECT —
   * 전체 엔티티+JOIN 전량 조회 대신 필요한 최소 컬럼만 projection (SUMMARY W-9).
   * `durationMs == null` 는 미완료·레거시 row (finishedAt 이 기록되지 않은 경우) —
   * histogram 에 의미 없는 값이므로 건너뛴다.
   */
  private async recordNodeLatencyMetrics(executionId: string): Promise<void> {
    try {
      const rows = await this.nodeExecutionRepository
        .createQueryBuilder('ne')
        .select(['ne.id', 'ne.duration_ms', 'ne.status'])
        .leftJoin('ne.node', 'n')
        .addSelect('n.type')
        .where('ne.execution_id = :executionId', { executionId })
        .andWhere('ne.status IN (:...statuses)', {
          statuses: [
            NodeExecutionStatus.COMPLETED,
            NodeExecutionStatus.FAILED,
            NodeExecutionStatus.CANCELLED,
          ],
        })
        .getMany();
      for (const row of rows) {
        if (row.durationMs == null) continue;
        this.businessMetrics.recordNodeDuration(
          row.node?.type ?? 'unknown',
          row.status,
          row.durationMs,
        );
      }
    } catch {
      // 메트릭 수집 실패는 무시 — 실행 결과·후속 처리에 영향 없음.
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
