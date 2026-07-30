import type {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import type { NodeExecution } from '../node-executions/entities/node-execution.entity';
import type { Node } from '../nodes/entities/node.entity';
import type { ExecutionContext } from '../../nodes/core/node-handler.interface';
import type { ContinuationPayload } from './queues/continuation-execution.queue';
import type { GraphEdge } from './graph/graph-builder';
// C-1 후속 — graph/dispatch 헬퍼 타입을 leaf 모듈에서 가져온다 (이전엔 execution-engine.service.ts 에서 import → 타입 레벨 순환).
import type {
  ExecutionGraphState,
  NodeDispatchLoopParams,
} from './types/graph-dispatch.types';

/**
 * C-1 step2~4 — god-class(`ExecutionEngineService`) 분해로 추출된 서비스들이
 * 엔진 잔류 capability 를 주입받는 **엔진 내부 전용 계약**.
 *
 * `WorkflowExecutor`(노드 레이어용, 과적)를 재사용하지 않고 별도 최소 seam 으로
 * 둔다 — 각 소비자가 필요로 하는 정확한 표면만 노출해 god-class 분해 후에도
 * 엔진↔서비스 결합을 DI 경계로 한정한다 (PR1 `WORKFLOW_EXECUTOR` 선례).
 *
 * 구현체는 canonical 엔진(`ExecutionEngineService`) 1개뿐이며, 모듈에서
 * `{ provide: ENGINE_DRIVER, useExisting: ExecutionEngineService }` 로 바인딩한다.
 * 메서드 시그니처는 **엔진을 단일 진실(source of truth)** 로 그대로 미러링한다 —
 * 동작은 추출 전과 완전히 동일하게 보존된다.
 *
 * **C-1 후속 ④ (ISP)**: 당시 12-멤버였던 단일 `EngineDriver` 를 소비자별 부분
 * 인터페이스로 분해했다. 각 추출 서비스는 자신이 실제 호출하는 표면만
 * (`AiTurnEngineDriver` / `InteractionEngineDriver` / `RetryEngineDriver`) 주입받는다.
 * 런타임 바인딩(`ENGINE_DRIVER` useExisting)·동작은 불변 — 컴파일 타임 가시성만 좁힌다.
 * 모든 멤버는 `ENGINE_DRIVER` 토큰을 통해서만 호출되는 엔진 내부 전용 표면이며,
 * step4 멤버 5개는 impl 측과 대칭으로 `@internal` 을 명시한다.
 *
 * 현재 멤버 수(2026-07-26 3차 라운드 실측): `EngineDriver` distinct **15**
 * (Core 2 + Interaction 1 + ReentryState 1 + AiTurn 자체 6 + Retry 자체 5),
 * `AiTurnEngineDriver` 합계 **10**. ai-review WARNING #1(3차 라운드) 로
 * `assertActiveExecutionAndSaveNodeExec`(4차 라운드에 `tryLockActiveExecution
 * AndSaveNodeExec` 로 개명 — 아래 참조) 가 추가돼 이전 라운드의 14/9 에서
 * 다시 갱신됐다. `execution-engine.md ## Rationale` §C-1 의 수치는 아직
 * 12/7 로 stale — `spec-update-node-cancellation-shutdown-classification.md`
 * #7 보강 8번 항목이 이제 15/10 을 목표로 정정 위임돼 있다(코드/spec 이 서로
 * 다른 값으로 갈라지지 않도록, plan 문서도 이번 라운드에 함께 갱신).
 * 4차 라운드 개명은 멤버 **수**를 바꾸지 않는다(rename-only) — 위 수치는
 * 그대로 유효하다.
 */
export interface CoreEngineDriver {
  /**
   * Execution 상태 전이의 단일 choke point. guarded 전이 + §8 segmentStartMs
   * active-time 추적. `false` 는 동시 cancel/park 가 DB 를 이미 terminal 로 옮겨
   * 전이가 적용되지 않은 경우 — 호출부는 이때 terminal/park emit 을 **건너뛰어야
   * 한다**(규범). else 분기(linkedNodeExec 없음)는 guarded UPDATE 0행 매칭(M-3),
   * 짝 전이 분기는 트랜잭션 내 행 잠금 조회가 0행(2026-07-26 후속).
   *
   * ai-review WARNING #3 (2026-07-26) — 실제 소비 현황: `AiTurnOrchestrator`
   * 의 re-park/첫 turn park/retry-last-turn RUNNING 재claim 3곳만 반환값을
   * 확인해 `ExecutionCancelledError` 로 전파한다({@link AiTurnEngineDriver}
   * 계약). Form/Button interaction 의 park·재claim 4곳은 아직 반환값을
   * 소비하지 않는다 — DB 는 이 가드로 안전하나 표시상 중복 이벤트 emit 이
   * 남는 후속 항목이다 (plan `ie-resume-turn-boundary-cancel.md`
   * "후속(본 PR 밖)" 참조).
   *
   * **choke point 예외 (ai-review WARNING #1, 2026-07-27, 7차 라운드)** —
   * `ExecutionEngineService.failFirstSegmentSetup` / `executeSync` timeout
   * catch 는 이 choke point 경유로 FAILED 마킹하도록 전환됐으나, reload 한
   * `Execution.status` 가 **PENDING** 이면(설정 자체가 RUNNING 진입 전에
   * 실패한 극단 케이스 — 이중 DB 장애 또는 극히 좁은 소-timeoutMs 레이스)
   * `assertTransition` 이 throw 한다. 상태머신이 PENDING→FAILED 를 의도적으로
   * 금지하기 때문(`state-machine.spec.ts` "disallow pending -> failed", 상태
   * 표는 spec/5-system/4-execution-engine.md §1.2 대칭). 두 호출자 모두 이
   * throw 를 best-effort 로 흡수해 마킹만 skip 하고(강제로 우회하지 않음), 잔류
   * PENDING 은 §7.1 stale 스윕에 위임한다. 즉 이 choke point 가 보호하는 건
   * "RUNNING/WAITING_FOR_INPUT 소스" 뿐이고 "PENDING 소스"는 원천적으로 이
   * choke point 밖 — 상태머신의 명시적 설계 결정이라 별도 완화 불필요.
   * @param opts.allowRetryReentry — `execution.retry_last_turn` 재진입 전용
   *   (2026-07-30 ai-review CRITICAL #1). 상태머신 opt-in(`FAILED → RUNNING` /
   *   `FAILED → WAITING_FOR_INPUT`)과 **DB 가드**(짝 전이의 `FOR UPDATE` 잠금 ·
   *   else 분기 guarded UPDATE) 양쪽에 함께 적용된다 — 둘 중 하나만 반영하면
   *   전이가 항상 0행으로 막힌다(이 파라미터가 신설된 원인이 정확히 그 결함이다).
   *   opt-in 시에도 COMPLETED/CANCELLED 는 배제되므로 진짜 동시 취소는 계속 막힌다.
   *   기본(미전달)은 종전과 동일하게 FAILED 배제.
   */
  updateExecutionStatus(
    execution: Execution,
    newStatus: ExecutionStatus,
    linkedNodeExec?: NodeExecution,
    opts?: { allowRetryReentry?: boolean },
  ): Promise<boolean>;

  /** in-memory context Map 키 (원칙 4) — background 본문은 bgKey, 그 외 executionId. */
  contextKeyOf(context: ExecutionContext): string;
}

/**
 * Form/Button blocking-interaction 서비스(`FormInteractionService` /
 * `ButtonInteractionService`)가 소비하는 표면 — core + durable resume 스테이징.
 */
export interface InteractionEngineDriver extends CoreEngineDriver {
  /**
   * §7.5 durable resume snapshot(V084/V085/V087) 를 Execution 행에 스테이징한다
   * (conversation_thread / user_variables / resume_call_stack). 이후 상태 전이
   * 트랜잭션과 원자적으로 durable commit.
   */
  stageDurableResumeSnapshot(
    execution: Execution,
    context: ExecutionContext,
  ): void;
}

/**
 * AI resume(§7.5) ↔ retry-last-turn 재진입이 공유하는 `_resumeState` 재구성기.
 * `AiTurnEngineDriver` 와 `RetryEngineDriver` 가 함께 소비한다.
 */
export interface ReentryStateDriver {
  /**
   * AI resume(§7.5) ↔ retry-last-turn 재진입이 공유하는 `_resumeState`
   * 재구성기. `_resumeCheckpoint`/`_retryState` 로 turn-state 를 복원하고,
   * retry 모드에서는 replay 용 initialAction 을 함께 만든다.
   *
   * @param opts.nodeExecutionId 대기/재시도 NodeExecution row 의 PK. checkpoint
   *   allow-list 로 persist 되지 않아 재개 시 호출측이 주입한다. 재구성 state 에
   *   재유도돼 resume 턴 provider-tool 의 통합 usage-log attribution(§4.6)에 쓰인다(#501).
   */
  buildRetryReentryState(
    execution: Execution,
    node: Node,
    context: ExecutionContext,
    retryState: Record<string, unknown>,
    opts?: { resumeMode?: boolean; nodeExecutionId?: string },
  ): {
    resumeState: Record<string, unknown>;
    initialAction: ContinuationPayload | undefined;
  };
}

/**
 * `AiTurnOrchestrator` 가 소비하는 표면 — interaction(core + durable resume) +
 * reentry-state + checkpoint/port-selection 헬퍼.
 */
export interface AiTurnEngineDriver
  extends InteractionEngineDriver, ReentryStateDriver {
  /**
   * §2.3 외부 cancel 관측 가드 — Execution 행을 다시 읽어 `CANCELLED` 면
   * `ExecutionCancelledError` 를 throw 한다. 사용자 Stop 은 `AbortController` 를
   * 만들지 않고 DB row 만 UPDATE 하므로, 재조회가 유일한 관측 수단이다.
   *
   * 엔진 dispatch 루프는 **노드 경계**마다 호출하지만, AI multi-turn 은 park 가
   * 세그먼트를 끝내 그 경계에 닿지 않는다 → orchestrator 가 **turn 경계**에서
   * 직접 호출한다.
   *
   * ai-review WARNING #9 (2026-07-26, side_effect) — 실제 호출자가
   * `AiTurnOrchestrator` 뿐이라 `CoreEngineDriver`(Form/Button/Retry 공유
   * 기반)가 아닌 이 표면으로 좁혔다(ISP). 런타임 바인딩은 불변 — 컴파일
   * 타임 가시성만 좁아진다.
   */
  assertExecutionNotCancelled(executionId: string): Promise<void>;

  /**
   * §1.3 allow-list 서브셋(credential-free)으로 DB 영속용 `_resumeCheckpoint`
   * 부분집합을 만든다.
   */
  buildResumeCheckpoint(
    resumeState: Record<string, unknown> | undefined,
  ): Record<string, unknown> | undefined;

  /** `_resumeCheckpoint` 저장·재개 허용 노드 타입 가드(§1.3 allow-list). */
  isCheckpointEligibleNodeType(t: string): boolean;

  /** legacy `{port, data}` envelope → `_selectedPort` 라우팅 flat shape 으로 변환. */
  applyPortSelection(output: unknown): unknown;

  /**
   * 노드 단위 취소 종결 — `NodeExecution` 을 CANCELLED 로 마킹(finishedAt/
   * durationMs 계산 + save)하고 `NODE_CANCELLED` 를 emit 한다. `errorEnvelope`
   * 미전달 시 client-facing 필드에 내부 message(executionId 포함 가능)를
   * 싣지 않는다(W15/W19).
   *
   * ai-review WARNING #1 (2026-07-26, concurrency) — `updateExecutionStatus`
   * 짝 전이 가드가 no-op(`false`)일 때(동시 Stop 이 선점) 짝이었던
   * `NodeExecution` 을 terminal 로 마킹하는 데 재사용한다 — 그렇지 않으면
   * 영구 RUNNING(non-terminal) 로 잔류한다.
   */
  markNodeCancelled(
    nodeExecution: NodeExecution,
    node: Node,
    context: ExecutionContext,
    executionId: string,
    errorEnvelope?: { code: string; message: string },
  ): Promise<void>;

  /**
   * ai-review WARNING #1 (2026-07-26, 3차 라운드) — `finalizeAiNode` 의 "이미
   * RUNNING 유지" 분기용으로 도입. Execution.status 가 RUNNING→RUNNING 이라
   * `updateExecutionStatus` 의 짝 전이(FOR UPDATE) choke point 를 타지 않는데,
   * 짝 `nodeExec` COMPLETED save 는 여전히 필요하다 — 그 save 를 형제 분기와
   * 동일하게 같은 트랜잭션의 행 잠금 안에서 원자화해, 단순 SELECT
   * (`assertExecutionNotCancelled`) 확인 뒤 별도 save 사이의 검사-후-사용
   * race 를 닫는다.
   *
   * ai-review CRITICAL #2 (2026-07-27) — `finalizeAiNode` 의 `isFailed` 분기도
   * 동일한 계약(Execution.status 미전이 + 짝 `nodeExec` save 만 필요)이라 이
   * 헬퍼를 공유한다 — 두 분기 모두의 소비처.
   *
   * ai-review WARNING #4 (2026-07-26, 4차 라운드 — maintainability) —
   * `assert*` 접두는 이 코드베이스 관례상 "조건 위반 시 throw" 를 뜻하는데
   * 이 메서드는 throw 하지 않고 `Promise<boolean>` 을 반환한다 — 이 PR 이
   * 고친 CRITICAL(반환값 미확인으로 조용히 진행)과 동형의 실수를 유도할 수
   * 있어 non-throwing/bool 반환임이 드러나는 이름으로 개명했다(이전 이름
   * `assertActiveExecutionAndSaveNodeExec`).
   *
   * @returns `true` 면 Execution 이 non-terminal 이라 `nodeExec` 를 save 했다.
   *   `false` 는 동시 cancel 이 선점해 save 를 건너뛴 경우 — 호출부는
   *   `assertLinkedTransitionApplied` 로 짝 `nodeExec` 를 CANCELLED
   *   재마킹해야 한다.
   * @param opts.allowRetryReentry — `execution.retry_last_turn` 재진입 전용
   *   (2026-07-30 ai-review CRITICAL #1). `true` 일 때만 잠금 조회 대상에 FAILED 를
   *   포함한다 — retry 재진입은 Execution 이 FAILED 인 상태에서 turn 을 돌리므로,
   *   이 opt-in 없이는 잠금이 항상 0행이 되어 **살아있는 spawn row 가 "동시 cancel
   *   선점" 으로 오판**된다. opt-in 시에도 COMPLETED/CANCELLED 는 배제되므로 진짜
   *   동시 취소는 계속 막힌다. 기본(미전달)은 종전과 동일하게 FAILED 배제.
   */
  tryLockActiveExecutionAndSaveNodeExec(
    executionId: string,
    nodeExec: NodeExecution | null,
    opts?: { allowRetryReentry?: boolean },
  ): Promise<boolean>;
}

/**
 * C-1 step4 — `RetryTurnService` 가 소비하는 표면 — core + reentry-state +
 * graph rebuild / dispatch loop / context rehydration / cache 정리. step4 멤버
 * 5개는 `@internal`(엔진 내부 전용, 모듈 외부 직접 참조 금지).
 */
export interface RetryEngineDriver
  extends CoreEngineDriver, ReentryStateDriver {
  /**
   * waiting/spawned NodeExecution 으로부터 live ExecutionContext 를 확보한다 —
   * in-memory 면 그대로, 아니면 DB(`_resumeCheckpoint` / conversation_thread /
   * user_variables / resume_call_stack) 에서 재구성(§7.5). retry 재진입
   * (`applyRetryLastTurn`)이 spawn 된 RUNNING row 로 호출한다.
   *
   * @internal — EngineDriver 계약(ENGINE_DRIVER)을 통해서만 호출. 모듈 외부 직접 참조 금지.
   */
  rehydrateContext(
    execution: Execution,
    waitingNodeExec: NodeExecution,
  ): Promise<ExecutionContext>;

  /**
   * Workflow 의 노드/엣지를 로드해 graph state (topological sort + edge index 등)
   * 를 빌드한다. `runExecution` / `resumeFromCheckpoint` / `resumeGraphAfterRetry`
   * 3 호출자 공통.
   *
   * @internal — EngineDriver 계약(ENGINE_DRIVER)을 통해서만 호출. 모듈 외부 직접 참조 금지.
   */
  loadAndBuildGraph(workflowId: string): Promise<ExecutionGraphState>;

  /**
   * pointer 기반 node dispatch loop — `resumeFromCheckpoint` 와 retry 성공 후
   * downstream 진행(`resumeGraphAfterRetry`)이 공유한다. 호출자가 graph rebuild +
   * reachability seed 를 마친 뒤 본 loop 에 위임하고, 결과 `parked` 로 세그먼트
   * 종료(WAITING) 여부를 받는다.
   *
   * @internal — EngineDriver 계약(ENGINE_DRIVER)을 통해서만 호출. 모듈 외부 직접 참조 금지.
   */
  runNodeDispatchLoop(
    params: NodeDispatchLoopParams,
  ): Promise<{ parked: boolean }>;

  /**
   * back-edge(loop) 후보 중 source 노드의 출력 포트가 통과시킨 첫 활성 back-edge
   * 를 찾는다. retry 성공 후 graph 재진입(`resumeGraphAfterRetry`)의 cyclic
   * workflow 처리에 사용.
   *
   * @internal — EngineDriver 계약(ENGINE_DRIVER)을 통해서만 호출. 모듈 외부 직접 참조 금지.
   */
  findActivatedBackEdge(
    sourceNodeId: string,
    backEdges: Array<{ edge: GraphEdge; targetIndex: number }>,
    nodeOutputCache: Record<string, unknown>,
  ): { edge: GraphEdge; targetIndex: number } | null;

  /**
   * 해당 execution 의 per-node LLM default config 캐시 항목을 모두 제거한다.
   * retry 재진입(`applyRetryLastTurn`)의 finally 에서 context 해제와 함께 호출.
   *
   * @internal — EngineDriver 계약(ENGINE_DRIVER)을 통해서만 호출. 모듈 외부 직접 참조 금지.
   */
  clearLlmDefaultConfigCache(executionId: string): void;
}

/**
 * 엔진(`ExecutionEngineService`)이 구현하는 전체 표면 — 소비자별 부분
 * 인터페이스의 합집합. 엔진만 `implements EngineDriver` 하며, 각 소비
 * 서비스는 자신의 부분 인터페이스로만 주입받는다.
 */
export interface EngineDriver extends AiTurnEngineDriver, RetryEngineDriver {}

/**
 * DI 토큰 — {@link EngineDriver} capability 를 주입받기 위한 토큰.
 * `ExecutionEngineModule` 에서 canonical 엔진(`ExecutionEngineService`)에
 * `useExisting` 으로 바인딩한다. `AiTurnOrchestrator` 가 본 토큰으로 엔진 잔류
 * 메서드 capability 만 주입받아, 추출 후에도 orchestrator↔엔진 결합을 DI 경계로
 * 한정한다 (PR1 `WORKFLOW_EXECUTOR` 선례).
 */
export const ENGINE_DRIVER = 'ENGINE_DRIVER';
