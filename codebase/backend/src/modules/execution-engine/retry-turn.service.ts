import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
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
import { Node } from '../nodes/entities/node.entity';
import { ExecutionContext } from '../../nodes/core/node-handler.interface';
import { ExecutionContextService } from './context/execution-context.service';
import { ExecutionEventEmitter } from './events/execution-event-emitter.service';
import { GraphTraversalService } from './graph/graph-traversal.service';
import {
  ExecutionEventType,
  NodeEventType,
} from '../websocket/websocket.service';
import { PARK_RELEASED } from '../../shared/execution-resume/process-turn-result';
import {
  ExecutionCancelledError,
  InvalidExecutionStateError,
  RetryLastTurnError,
} from './workflow-errors';
import { AiTurnOrchestrator } from './ai-turn-orchestrator.service';
import {
  ENGINE_DRIVER,
  type RetryEngineDriver,
} from './engine-driver.interface';

/**
 * C-1 step4 (strangler-fig, FINAL) — `execution.retry_last_turn` lifecycle 를
 * god-class `ExecutionEngineService` 에서 추출한 전담 서비스.
 *
 * **책임**: retryable error 로 종결된 AI multi-turn 노드의 보존된 `_retryState`
 * 를 lookup·검증·atomic-consume 하고 (`retryLastTurn`), worker handoff 로 spawn
 * 된 RUNNING row 를 multi-turn loop 에 재진입시켜 마지막 실패 turn 을 replay 한
 * 뒤 (`applyRetryLastTurn`) downstream graph 로 진행하거나 (`resumeGraphAfterRetry`)
 * Execution 을 마감한다 (`completeRetryExecution` / `failRetryExecution`).
 *
 * 엔진 잔류 상태/라이프사이클 메서드는 `RetryEngineDriver`(소비자별 ISP slice;
 * token `ENGINE_DRIVER`, `useExisting: ExecutionEngineService`) 경유로 호출한다
 * (PR2 `AiTurnOrchestrator` / PR3 `Form`·`ButtonInteractionService` 선례와 동일
 * 패턴). 메서드 본문은 추출 전과 **완전히 동일**하게 보존됐고,
 * `this.<engine-stays>` 호출만 `this.driver.<…>` 로 재배선됐다.
 *
 * **C-1 후속 ④**: WS gateway / continuation processor 가 호출하는 진입점
 * (`retryLastTurn` / `applyRetryLastTurn`)은 본 서비스의 **public 메서드를 직접
 * 호출**한다 — 엔진의 thin delegator 를 제거하고 engine→Retry 역방향 주입을 없애
 * 양방향 forwardRef 순환 DI 를 단방향(Retry→engine)으로 정리했다. 단발 publisher
 * `publishRetryLastTurn` 은 `continueAiConversation` / `continueButtonClick` 등
 * 자매 publisher 와 함께 엔진의 publisher cluster (engine-private
 * `buildPublishResult` 공유) 에 그대로 잔류한다 — 본 서비스로 이관하지 않는다.
 * `_retryState` → `_resumeState` 재구성기 `buildRetryReentryState` 는 §1.3 공유
 * 계약이자 AI resume 과 공유되는 `ReentryStateDriver` 멤버이므로 엔진에 잔류하고,
 * 본 서비스는 `this.driver.buildRetryReentryState(...)` 로 호출한다.
 */
@Injectable()
export class RetryTurnService {
  private readonly logger = new Logger(RetryTurnService.name);

  constructor(
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(NodeExecution)
    private readonly nodeExecutionRepository: Repository<NodeExecution>,
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly contextService: ExecutionContextService,
    private readonly eventEmitter: ExecutionEventEmitter,
    private readonly graphTraversal: GraphTraversalService,
    // retry 재진입의 single-turn replay 처리기. orchestrator 가 ENGINE_DRIVER(=엔진)
    // 를 주입받고 엔진은 본 서비스를 주입받으므로 transitive 순환 DI → forwardRef.
    @Inject(forwardRef(() => AiTurnOrchestrator))
    private readonly aiTurnOrchestrator: AiTurnOrchestrator,
    // 엔진 잔류 라이프사이클 capability. canonical 엔진에 `useExisting` 바인딩.
    @Inject(ENGINE_DRIVER)
    private readonly driver: RetryEngineDriver,
  ) {}

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
    const context = await this.driver.rehydrateContext(execution, spawnedRow);

    // W6/W7/W13 — `_retryState` → `_resumeState` shape 복원 + replay initialAction
    // 도출은 `buildRetryReentryState` 로 분리 (SRP). 본 메서드는 orchestration
    // (검증 / context rehydrate / emit / loop 구동 / Execution 마감) 만 담당.
    const { resumeState, initialAction } = this.driver.buildRetryReentryState(
      execution,
      node,
      context,
      retryState,
    );
    // nodeOutputCache 에 `{ _resumeState }` envelope 주입 (handleAiMessageTurn /
    // finalizeAiNode 가 읽는다). structuredOutputCache 도 seed 해 finalize 가
    // 종료 turn 의 canonical shape 을 가질 수 있게 한다.
    this.contextService.setNodeOutput(
      this.driver.contextKeyOf(context),
      node.id,
      {
        _resumeState: resumeState,
      },
    );

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
    } catch (err: unknown) {
      await this.failRetryExecution(execution, executionId, err);
    } finally {
      this.contextService.deleteContext(executionId);
      this.driver.clearLlmDefaultConfigCache(executionId);
    }
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
    const graphState = await this.driver.loadAndBuildGraph(
      savedExecution.workflowId,
    );
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
      const activated = this.driver.findActivatedBackEdge(
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
    const dispatchResult = await this.driver.runNodeDispatchLoop({
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
    const completed = await this.driver.updateExecutionStatus(
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
   *
   * @internal — applyRetryLastTurn 의 catch 블록에서만 호출된다.
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
}
