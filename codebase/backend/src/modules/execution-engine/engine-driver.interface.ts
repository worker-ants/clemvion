import type {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import type { NodeExecution } from '../node-executions/entities/node-execution.entity';
import type { Node } from '../nodes/entities/node.entity';
import type { ExecutionContext } from '../../nodes/core/node-handler.interface';
import type { ContinuationPayload } from './queues/continuation-execution.queue';
import type { GraphEdge } from './graph/graph-builder';
import type {
  ExecutionGraphState,
  NodeDispatchLoopParams,
} from './execution-engine.service';

/**
 * C-1 step2 — `AiTurnOrchestrator` 가 추출되면서, 엔진(`ExecutionEngineService`)
 * 에 잔류하는 라이프사이클/상태 메서드를 orchestrator 로 노출하는 **엔진 내부
 * capability 계약**.
 *
 * `WorkflowExecutor`(노드 레이어용, 과적)를 재사용하지 않고 별도 최소 seam 으로
 * 둔다 — orchestrator 가 필요로 하는 정확한 표면만 노출해 god-class 분해 후에도
 * 엔진↔orchestrator 결합을 DI 경계로 한정한다 (PR1 `WORKFLOW_EXECUTOR` 선례).
 *
 * 구현체는 canonical 엔진(`ExecutionEngineService`) 1개뿐이며, 모듈에서
 * `{ provide: ENGINE_DRIVER, useExisting: ExecutionEngineService }` 로 바인딩한다.
 * 메서드 시그니처는 **엔진을 단일 진실(source of truth)** 로 그대로 미러링한다 —
 * 동작은 추출 전과 완전히 동일하게 보존된다.
 */
export interface EngineDriver {
  /**
   * Execution 상태 전이의 단일 choke point. guarded 전이 + §8 segmentStartMs
   * active-time 추적. `false` 는 else 분기(linkedNodeExec 없음)에서 동시
   * cancel/park 가 DB 를 이미 terminal 로 옮겨 guarded UPDATE 가 0행 매칭(no-op)된
   * 경우 — 호출부는 terminal emit 을 skip 한다 (M-3).
   */
  updateExecutionStatus(
    execution: Execution,
    newStatus: ExecutionStatus,
    linkedNodeExec?: NodeExecution,
    opts?: { allowRetryReentry?: boolean },
  ): Promise<boolean>;

  /**
   * §7.5 durable resume snapshot(V084/V085/V087) 를 Execution 행에 스테이징한다
   * (conversation_thread / user_variables / resume_call_stack). 이후 상태 전이
   * 트랜잭션과 원자적으로 durable commit.
   */
  stageDurableResumeSnapshot(
    execution: Execution,
    context: ExecutionContext,
  ): void;

  /**
   * AI resume(§7.5) ↔ retry-last-turn 재진입이 공유하는 `_resumeState`
   * 재구성기. `_resumeCheckpoint`/`_retryState` 로 turn-state 를 복원하고,
   * retry 모드에서는 replay 용 initialAction 을 함께 만든다.
   */
  buildRetryReentryState(
    execution: Execution,
    node: Node,
    context: ExecutionContext,
    retryState: Record<string, unknown>,
    opts?: { resumeMode?: boolean },
  ): {
    resumeState: Record<string, unknown>;
    initialAction: ContinuationPayload | undefined;
  };

  /**
   * §1.3 allow-list 서브셋(credential-free)으로 DB 영속용 `_resumeCheckpoint`
   * 부분집합을 만든다.
   */
  buildResumeCheckpoint(
    resumeState: Record<string, unknown> | undefined,
  ): Record<string, unknown> | undefined;

  /** `_resumeCheckpoint` 저장·재개 허용 노드 타입 가드(§1.3 allow-list). */
  isCheckpointEligibleNodeType(t: string): boolean;

  /** in-memory context Map 키 (원칙 4) — background 본문은 bgKey, 그 외 executionId. */
  contextKeyOf(context: ExecutionContext): string;

  /** legacy `{port, data}` envelope → `_selectedPort` 라우팅 flat shape 으로 변환. */
  applyPortSelection(output: unknown): unknown;

  // ──────────────────────────────────────────────────────────────────────────
  // C-1 step4 — `RetryTurnService` 가 필요로 하는 엔진 잔류 capability.
  // `applyRetryLastTurn` / `resumeGraphAfterRetry` 가 호출하는 graph rebuild +
  // dispatch loop + context rehydration + cache 정리 표면만 최소 노출한다.
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * waiting/spawned NodeExecution 으로부터 live ExecutionContext 를 확보한다 —
   * in-memory 면 그대로, 아니면 DB(`_resumeCheckpoint` / conversation_thread /
   * user_variables / resume_call_stack) 에서 재구성(§7.5). retry 재진입
   * (`applyRetryLastTurn`)이 spawn 된 RUNNING row 로 호출한다.
   */
  rehydrateContext(
    execution: Execution,
    waitingNodeExec: NodeExecution,
  ): Promise<ExecutionContext>;

  /**
   * Workflow 의 노드/엣지를 로드해 graph state (topological sort + edge index 등)
   * 를 빌드한다. `runExecution` / `resumeFromCheckpoint` / `resumeGraphAfterRetry`
   * 3 호출자 공통.
   */
  loadAndBuildGraph(workflowId: string): Promise<ExecutionGraphState>;

  /**
   * pointer 기반 node dispatch loop — `resumeFromCheckpoint` 와 retry 성공 후
   * downstream 진행(`resumeGraphAfterRetry`)이 공유한다. 호출자가 graph rebuild +
   * reachability seed 를 마친 뒤 본 loop 에 위임하고, 결과 `parked` 로 세그먼트
   * 종료(WAITING) 여부를 받는다.
   */
  runNodeDispatchLoop(
    params: NodeDispatchLoopParams,
  ): Promise<{ parked: boolean }>;

  /**
   * back-edge(loop) 후보 중 source 노드의 출력 포트가 통과시킨 첫 활성 back-edge
   * 를 찾는다. retry 성공 후 graph 재진입(`resumeGraphAfterRetry`)의 cyclic
   * workflow 처리에 사용.
   */
  findActivatedBackEdge(
    sourceNodeId: string,
    backEdges: Array<{ edge: GraphEdge; targetIndex: number }>,
    nodeOutputCache: Record<string, unknown>,
  ): { edge: GraphEdge; targetIndex: number } | null;

  /**
   * 해당 execution 의 per-node LLM default config 캐시 항목을 모두 제거한다.
   * retry 재진입(`applyRetryLastTurn`)의 finally 에서 context 해제와 함께 호출.
   */
  clearLlmDefaultConfigCache(executionId: string): void;
}

/**
 * DI 토큰 — {@link EngineDriver} capability 를 주입받기 위한 토큰.
 * `ExecutionEngineModule` 에서 canonical 엔진(`ExecutionEngineService`)에
 * `useExisting` 으로 바인딩한다. `AiTurnOrchestrator` 가 본 토큰으로 엔진 잔류
 * 메서드 capability 만 주입받아, 추출 후에도 orchestrator↔엔진 결합을 DI 경계로
 * 한정한다 (PR1 `WORKFLOW_EXECUTOR` 선례).
 */
export const ENGINE_DRIVER = 'ENGINE_DRIVER';
