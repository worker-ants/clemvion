import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { toTerminalErrorPayload } from '../../shared/utils/terminal-error-payload';
import { resolveTerminalDurationMs } from '../../shared/utils/terminal-duration';
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
import type { RetryState } from './utils/resume-state.schema';
import { ExecutionEventEmitter } from './events/execution-event-emitter.service';
import { GraphTraversalService } from './graph/graph-traversal.service';
import {
  ExecutionEventType,
  NodeEventType,
} from '../websocket/websocket.service';
import { PARK_RELEASED } from '../../shared/execution-resume/process-turn-result';
import { canTransition } from './state/state-machine';
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
 * `_retryState` JSONB 키 리터럴의 단일 진실 지점 (ai-review WARNING #3,
 * `review/code/2026/07/28/20_32_57`). `retryLastTurn` 의 atomic-consume 과
 * `applyRetryLastTurn`/`claimSpawnedRetryRow` 의 2차 claim 양쪽에서 raw SQL
 * (`... - '_retryState'`, `jsonb_exists(..., '_retryState')`)과 TS 프로퍼티
 * 접근에 리터럴로 4곳 이상 중복됐었다 — 한쪽만 리네임되면 조용히 drift 한다.
 */
const RETRY_STATE_KEY = '_retryState';

/**
 * C-1 step4 (strangler-fig, FINAL) — `execution.retry_last_turn` lifecycle 를
 * god-class `ExecutionEngineService` 에서 추출한 전담 서비스.
 *
 * **책임**: retryable error 로 종결된 AI multi-turn 노드의 보존된 `_retryState`
 * 를 lookup·검증·atomic-consume 하고 (`retryLastTurn`), worker handoff 로 spawn
 * 된 RUNNING row 를 **2차 원자 claim**(`claimSpawnedRetryRow`)으로 중복 배달을
 * 차단한 뒤 multi-turn loop 에 재진입시켜 마지막 실패 turn 을 replay 하고
 * (`applyRetryLastTurn`) downstream graph 로 진행하거나 (`resumeGraphAfterRetry`)
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
   * shape 변환 후 `processAiResumeTurn`(AiTurnOrchestrator 경유, turn-park
   * 단발 처리 + 계속되면 `PARK_RELEASED` re-park)으로 재진입. INFO#1: 이전
   * "재진입 미완 갭" 주석은 현 구현을 반영해 삭제함. W3 정정(ai-review 7R): 옛
   * `runAiConversationLoop` 장수 루프 replay 는 exec-park D6 로 이미 제거됐다
   * — 아래 "재진입 절차" 목록 참조. 남은 문서화된 갭은 downstream graph
   * traversal (성공 후 후속 노드 재개) — `applyRetryLastTurn` 의 docstring 참조.
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
    // `output` 이 `Record<string, unknown>` 이라 `output.error` 는 `unknown` 이고,
    // 이 assertion 이 아래 `.details.retryable`/`.retryAfterSec` 접근을 가능하게 한다 —
    // 제거하면 타입이 `{}` 로 좁혀져 TS2339 3건으로 깨진다.
    // no-unnecessary-type-assertion 의 오탐이며 `nest build` 로 반증됐다.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
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
    const retryState = outputData[RETRY_STATE_KEY] as RetryState | undefined;
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
    const seededInput = { [RETRY_STATE_KEY]: retryState };
    let spawned: NodeExecution | null = null;
    await this.dataSource.transaction(async (manager) => {
      const consume = await manager
        .createQueryBuilder()
        .update(NodeExecution)
        .set({
          // JSONB `-` 연산자로 `_retryState` 키만 제거. 다른 outputData 키 보존.
          outputData: () => `output_data - '${RETRY_STATE_KEY}'`,
        })
        .where('id = :id', { id: nodeExecutionId })
        // JSONB key-existence guard. `jsonb_exists(col, key)` is used instead
        // of the `?` operator so the pg driver doesn't mistake `?` for a bound
        // parameter placeholder. affected=1 only for the writer that still saw
        // the key present — concurrent retry gets affected=0.
        .andWhere(`jsonb_exists(output_data, '${RETRY_STATE_KEY}')`)
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
        inputData: seededInput,
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
   *   2. **2차 원자 claim**(`claimSpawnedRetryRow`) — `inputData._retryState`
   *      키를 원자 제거해 동시 배달을 차단한다(claim 실패 시 discard, 이후
   *      단계 미진입; ai-review CRITICAL #1/#2, 2026-07-28).
   *   3. ExecutionContext 확보 (`rehydrateContext` 재사용 — live 면 그대로).
   *   4. `_retryState` → `_resumeState` shape 변환 후 nodeOutputCache /
   *      structuredOutputCache 에 주입.
   *   5. NODE_STARTED (spawn 된 row) emit. Execution FAILED → RUNNING 전이는
   *      `finalizeAiNode` 의 COMPLETED 분기가 담당 (W4: JSDoc 정합).
   *   6. `processAiResumeTurn`(AiTurnOrchestrator 경유)으로 마지막 user
   *      message replay(initialAction = `ai_message`) 를 단발 처리 →
   *      실패했던 LLM turn 재실행. 대화가 계속되면 `PARK_RELEASED` 로
   *      re-park 해 세그먼트 종료(다음 turn 은 §7.5 rehydration 재개), 종료면
   *      다음 단계로 진행(W3 정정, ai-review 7R: 옛 `runAiConversationLoop`
   *      장수 루프는 exec-park D6 로 제거됨).
   *   7. `finalizeAiNode` 로 spawn row 마감 + Execution 을 RUNNING 으로 전이.
   *   8. 성공 종결이면 `resumeGraphAfterRetry` 가 downstream graph 로 진행
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
    // fast path — 이미 다른 worker 가 마감해 RUNNING 이 아니면 즉시 discard.
    // **이것은 레이스 결정자가 아니다.** 실제 claim 은 아래 원자 UPDATE
    // (`claimSpawnedRetryRow`)이며, 이 체크는 흔한 경우를 싸게 걸러내고 로그를
    // 명확히 하는 역할만 한다. (과거 이 체크가 "자체 멱등 가드" 로 서술돼
    // `continuation-execution.processor.ts` 가 `retry_last_turn` 을 원자 claim
    // 대상에서 제외하는 근거가 됐고, 그 자기모순이 ai-review 5차 라운드 CRITICAL
    // 이었다.)
    if (spawnedRow.status !== NodeExecutionStatus.RUNNING) {
      this.logger.debug(
        `applyRetryLastTurn: spawned row ${spawnedNodeExecutionId} is ${spawnedRow.status} (not RUNNING) — already handled, ack-and-discard`,
      );
      return;
    }

    // in-memory `_retryState` 값 확보 — claim(아래)이 이 값을 지우기 **전에** 미리
    // 읽어 둔다. `retryLastTurn` 이 spawn 시 항상 seed 하므로 claim 성공 이후에는
    // 이 값의 존재가 구조적으로 보장된다 — claim 을 앞으로 당겨도 후속 로직
    // (`buildRetryReentryState` 등)에는 영향이 없다.
    const seededInput = spawnedRow.inputData ?? {};
    const retryState = seededInput[RETRY_STATE_KEY] as RetryState | undefined;

    // ATOMIC CLAIM — ai-review CRITICAL #1 (2026-07-28, `review/code/2026/07/28/20_32_57`):
    // 이 claim 은 반드시 "손상 판정" 보다 **먼저** 실행돼야 한다. `_retryState` 를
    // 지우는 유일한 경로가 이 claim 자신이므로, RUNNING row 에서 그 값이 없다는 것은
    // 실질적으로 100% "다른/이전 delivery 가 이미 이 claim 으로 가져갔다" 는 뜻이지
    // 손상이 아니다. (예전엔 이 claim **뒤에** "`_retryState` 부재 → FAILED" 판정이
    // 있어, claim 이 만들어내는 바로 그 정상 상태를 손상으로 오판해 살아있는 row 를
    // 덮어썼다 — 진짜 동시성 없이도 BullMQ 기본 재시도(claim 성공 후 try 진입 전
    // 구간의 일시 예외 → 재배달 → fresh 조회가 이미 지워진 값을 관측)만으로
    // 결정적으로 재현됐다. 상세 근거·백스톱 갭은 `claimSpawnedRetryRow` JSDoc 참조.)
    const claimed = await this.claimSpawnedRetryRow(spawnedNodeExecutionId);
    if (!claimed) {
      // 원인 구분 없이 항상 ack-and-discard — 절대 save() 하지 않는다. "이미 다른
      // delivery 가 가져감" 과 "애초에 seed 안 됨"(구조적으로 발생하지 않음 —
      // `retryLastTurn` 이 항상 seed) 을 굳이 구분하지 않는다. `jsonb_exists` 조건이
      // 두 경우를 이미 동일하게 흡수하므로 별도의 파괴적 종결 분기가 불필요하다
      // (예전의 "부재 → FAILED" 분기는 삭제됐다).
      this.logger.debug(
        `applyRetryLastTurn: spawned row ${spawnedNodeExecutionId} claim 실패(affected=0) — ` +
          `다른 delivery 가 이미 가져갔거나 그 사이 종결됨. ack-and-discard (정상 race)`,
      );
      return;
    }
    if (!retryState) {
      // 구조적으로 도달 불가능해야 하는 방어 분기 — claim 이 성공했다는 것은 그
      // 순간 DB 의 `jsonb_exists` 가 키 존재를 확인했다는 뜻이므로, 바로 위에서
      // 읽은 in-memory 값도 존재해야 한다. 그래도 **FAILED 로 마킹하지 않는다** —
      // 살아있는 row 를 죽이는 오판(Critical #1)을 다른 형태로 재도입하지 않기
      // 위해 로그만 남기고 discard 한다.
      this.logger.error(
        `applyRetryLastTurn: spawned row ${spawnedNodeExecutionId} claim 성공했으나 in-memory _retryState 부재 — ` +
          `불변식 위반(이론상 도달 불가능), FAILED 마킹 없이 ack-and-discard`,
      );
      return;
    }
    // claim 이 DB 의 `input_data` 에서만 키를 원자 제거하므로, in-memory
    // `spawnedRow` 도 동일하게 맞춘다 — ai-review CRITICAL #2 (2026-07-28): 이
    // delete 가 없으면 이후 not-found 분기의 `save(spawnedRow)`(full-entity)가
    // stale 값(키 있음)을 그대로 써, TypeORM 0.3.30 기준으로 확인된 jsonb
    // diff 가 DB 를 재-SELECT 해 옛 값과 비교하고 claim 이 방금 지운
    // `_retryState` 를 부활시킨다(`status=FAILED` 인데 `_retryState` 가
    // 살아있는 모순 row) — 이 delete 자체는 버전-불문 방어라 이후 patch
    // 버전에서도 유지한다(W9). 이 한 줄이 이 메서드의 **모든** 하위
    // `save(spawnedRow)` 호출을 함께 보호한다. W6(ai-review 7R) — 이 delete
    // 는 아래 `emitNode`(`NODE_STARTED`) 의 `input` 페이로드에도 영향한다:
    // `_retryState` 가 더 이상 포함되지 않는다 — spec 의 "internal 필드
    // 비노출" 원칙과 부합하는 의도된 변경이며, 회귀 테스트로 잠갔다(아래
    // `emitNode` 호출부 참조).
    delete spawnedRow.inputData[RETRY_STATE_KEY];

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
      // #501 회귀 — 재시도 턴의 통합 usage-log attribution 을 위해 spawn 된
      // RUNNING NodeExecution row id 를 재구성 state 에 재주입한다 (checkpoint 미영속).
      { nodeExecutionId: spawnedRow.id },
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
        // W6(ai-review 7R) — `_retryState` 는 위 claim 직후 delete 로 이미
        // 제거됨(internal 필드 비노출 의도, 회귀 테스트로 잠금).
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
   * ATOMIC CLAIM (06 C-2 계열, W6 — ai-review WARNING #6 helper 추출) —
   * `applyRetryLastTurn` 재진입의 동시 배달 가드. `inputData._retryState` 키를
   * JSONB `-` 로 **원자 제거**하고 affected=1 인 delivery 만 진행한다.
   * `retryLastTurn` 이 원본 row 의 `outputData` 에 쓰는 것과 동일한 패턴이다.
   *
   * 두 조건을 **모두** 걸어야 한다:
   *   - `jsonb_exists(input_data, '_retryState')` — 레이스 결정자. 키를 먼저
   *     지운 쪽만 진행.
   *   - `status = 'running'` — 없으면 **완료된 턴을 재실행한다.** `inputData`
   *     에 쓰는 곳은 spawn 시점뿐이라 턴이 COMPLETED 로 끝나도 이 키는 남는다.
   *     `applyRetryLastTurn` 의 fast path 통과 후 다른 worker 가 턴을 마치는
   *     창이 실재하므로 claim 자체가 상태까지 CAS 해야 한다.
   *
   * 대가(의도된 트레이드오프): 크래시로 중단된 턴의 BullMQ 재배달도 함께
   * 막힌다. 형제 continuation 4종(`claimResumeEntry`)은 `recoverStuckExecutions`
   * (stale RUNNING Execution 재claim) 백스톱이 커버하지만, **이 2차 claim
   * 경로는 그 백스톱이 닿지 않는다** — 실측 근거는 아래 "알려진 백스톱 갭"
   * 참조 (W2 정정, ai-review 7R `review/code/2026/07/30/11_41_20`: 이 문단의
   * 구 서술이 아래 실측 결과와 자기모순으로 공존해 앞부분만 읽으면 정반대로
   * 오독할 소지가 있었다).
   *
   * **claim 은 반드시 "`_retryState` 부재 → 손상 판정" 보다 먼저 호출돼야 한다**
   * (ai-review CRITICAL #1, 2026-07-28, `review/code/2026/07/28/20_32_57`) —
   * `_retryState` 를 지우는 유일한 경로가 이 claim 자신이므로, RUNNING row 에서
   * 그 값이 없다는 것은 실질적으로 100% "다른/이전 delivery 가 이미 이 claim 으로
   * 가져갔다" 는 뜻이지 손상이 아니다. 그 판정을 이 claim 뒤에 두면 살아있는(다른
   * delivery 가 처리 중인) row 를 FAILED 로 오마킹한다 — 진짜 동시성 없이도
   * BullMQ 기본 재시도(claim 성공 후 try 진입 전 구간의 일시 예외 → 재배달 →
   * fresh 조회가 이미 지워진 값을 관측)만으로 결정적으로 재현된다. 그래서 claim
   * 실패(affected!==1)는 원인을 더 따지지 않고 **항상** ack-and-discard 한다 —
   * `jsonb_exists` 조건이 "한 번도 seed 안 된 진짜 corruption" 과 "이미 소비됨"
   * 을 모두 같은 방식(discard)으로 흡수하므로 별도의 파괴적 종결 분기가
   * 불필요하다.
   *
   * **알려진 백스톱 갭(리뷰어 제안과 다름 — 실측으로 확정)** — 리뷰어는 "진짜
   * corruption 방어는 `recoverStuckExecutions` 류 backstop 에 위임" 하라 했으나,
   * 실측 결과 그 백스톱은 이 케이스에 닿지 않는다: `failOrphanRunningNodeExecutions`
   * 는 `recoverStuckExecutions` 의 stale RUNNING **Execution** 재구동 경로에서만
   * 호출되는데, discard 후 Execution 은 이미 `failed`(terminal) 로 남아 재구동
   * 대상이 아니다 — 그 spawn row 는 RUNNING orphan 으로 영구 잔류할 수 있다
   * (타임라인/진행률 집계 오염). 그래도 discard 가 옳다: 이전 코드(claim 이전
   * FAILED 마킹)는 **살아있는 작업을 죽이는** 활성 피해를 내지만, discard 는
   * 이론적 orphan row 만 남긴다 — 그리고 `retryLastTurn` 이 항상 `_retryState`
   * 를 seed 하므로 "한 번도 seed 안 된 진짜 corruption" 은 구조적으로 발생하지
   * 않는다. 이 갭은 `plan/in-progress/retry-turn-terminal-guard.md` 에 별도
   * 후속으로 등재했다.
   *
   * @returns `true` 면 이 delivery 가 claim 했다(DB 의 `_retryState` 키가 원자
   *   제거됨 — caller 는 in-memory `spawnedRow.inputData` 도 함께 동기화해야
   *   한다). `false` 면 다른 delivery 가 이미 가져갔거나 그 사이 종결됐다 —
   *   caller 는 로그만 남기고 어떤 `save()` 도 호출하지 않아야 한다.
   */
  private async claimSpawnedRetryRow(
    spawnedNodeExecutionId: string,
  ): Promise<boolean> {
    const claim = await this.nodeExecutionRepository
      .createQueryBuilder()
      .update(NodeExecution)
      .set({ inputData: () => `input_data - '${RETRY_STATE_KEY}'` })
      .where('id = :id', { id: spawnedNodeExecutionId })
      .andWhere('status = :running', {
        running: NodeExecutionStatus.RUNNING,
      })
      .andWhere(`jsonb_exists(input_data, '${RETRY_STATE_KEY}')`)
      .execute();
    return (claim.affected ?? 0) === 1;
  }

  /**
   * 2026-07-27 — 종결 2경로(`completeRetryExecution` / `failRetryExecution`)의 공통
   * guarded 마감. 무가드 full-entity `save()` 는 stale in-memory 엔티티로 DB 를 덮어써,
   * 동시 Stop 이 이미 `cancelled` 로 마감한 실행을 `COMPLETED`/`FAILED` 로 되돌리고
   * 종결 이벤트까지 발행했다 (`#1022` 가 엔진 종결 경로에서 닫은 것과 같은 결함 클래스).
   *
   * **왜 DB 를 다시 읽나.** 이 서비스의 `execution` 은 재진입 시작 시점에 로드된 뒤
   * 갱신되지 않는다 — `failed → running` 재진입 전이는 orchestrator 가 **다른 엔티티
   * 인스턴스**에 적용하므로, 여기 도달했을 때 `execution.status` 는 stale `failed` 일 수
   * 있다. 그 값을 그대로 `updateExecutionStatus` 에 넘기면 상태머신이 `failed → failed`
   * 자기 전이를 보고 throw 한다. stale 을 신뢰하지 않는 것이 이 수정의 요지이므로
   * **행을 다시 읽어 in-memory 를 정본으로 맞춘 뒤** 전이를 요청한다.
   *
   * @returns `true` 면 전이가 영속됐다(호출부는 종결 이벤트를 emit 한다).
   *   `false` 는 (a) row 부재, (b) 정본 상태에서 목표로의 전이가 상태머신상 불가
   *   (= DB 가 이미 terminal — 동시 cancel 선점), (c) guarded UPDATE 0행 매칭.
   *   어느 경우든 **저장·emit 을 모두 건너뛴다.** terminal 집합을 인라인 열거하지 않고
   *   `canTransition` 에 위임해, 상태머신이 바뀌면 자동으로 따라오게 한다.
   */
  private async finalizeGuarded(
    execution: Execution,
    executionId: string,
    target: ExecutionStatus,
    caller: string,
  ): Promise<boolean> {
    const live = await this.executionRepository.findOneBy({ id: executionId });
    if (!live) {
      this.logger.warn(`${caller}(${executionId}): Execution row 부재 — skip`);
      return false;
    }
    execution.status = live.status;
    // 이미 목표 상태면 **멱등 no-op** 이다 — 쓸 것이 없으니 lost update 위험도 없고,
    // 호출부의 종결 이벤트는 기존대로 발행해야 한다. 실제로 재진입이 턴 시작 전에
    // 실패하면 Execution 이 `failed` 인 채로 `failRetryExecution(FAILED)` 에 도달한다.
    // (상태머신은 자기 전이를 금지하므로 `canTransition` 에 맡기면 여기서 걸린다.)
    if (live.status === target) {
      // ai-review CRITICAL (2026-07-27, 2차 라운드) — 상태만 같을 뿐 **이번 시도의
      // lifecycle 필드는 새 값**이다. 재진입이 즉시 재실패하면 `error` 는 이번 실패
      // 메시지이고 `finishedAt`/`durationMs` 도 갱신돼야 하는데, 여기서 그냥 `true` 를
      // 반환하면 그 값들이 조용히 버려진다 — WS 는 새 에러를 emit 하는데 REST
      // 재조회는 최초 실패 메시지를 돌려주는 불일치가 생기고 소요시간도 축소 보고된다.
      // (무가드 `save()` 였던 이전 코드에는 없던 회귀다.)
      //   상태는 그대로 두고 lifecycle 컬럼만 **관측한 상태를 조건으로** 건다 —
      //   그 사이 동시 cancel 이 상태를 바꿨다면 0행 매칭으로 조용히 무효화된다.
      //
      // ai-review CRITICAL #1 (2026-07-27, 3차 라운드) — "0행이 실제로 가능한가":
      // terminal(COMPLETED/FAILED/CANCELLED) 은 통상 outgoing 전이가 없어 이
      // guarded UPDATE 가 항상 매칭될 것처럼 보이지만, FAILED → RUNNING 전이는
      // `allowRetryReentry` opt-in 으로 예외 허용된다 (state/state-machine.ts 의
      // ALLOWED_TRANSITIONS 주석 + `canTransition` 의 `allowRetryReentry` 분기;
      // 호출부는 ai-turn-orchestrator.service.ts 의
      // `allowRetryReentry ? { allowRetryReentry: true } : undefined`). 즉 동시
      // retry 재진입이 위 SELECT 와 이 UPDATE 사이에 row 를 FAILED → RUNNING 으로
      // 옮기면 `andWhere('status = :status', { status: target })` 가 0행에
      // 매칭된다 — 그때 무조건 `true` 를 반환하면 DB 는 RUNNING(새 턴 진행 중)인데
      // caller 가 종결 이벤트를 발행하는 "사후 오시그널" 이 된다(이 PR 이 닫으려던
      // 결함 클래스 그 자체). `affected` 를 확인해 아래 두 분기와 대칭 처리한다.
      //
      // ai-review CRITICAL #1 (2026-07-27, 4차 라운드) — CANCELLED 재진입은 위 두
      // 라운드가 세운 "이번 시도 값이 최신 진실" 전제가 성립하지 않는다. `stop()`
      // 이 사용자가 Stop 을 누른 정확한 시각(T1)을 이미 이 guarded UPDATE 로
      // 커밋했는데, AI 턴은 다음 turn 경계(`assertExecutionNotCancelled`)에서야
      // 취소를 감지하므로 여기 도달했을 때 `execution.finishedAt` 은 그보다 늦은
      // 재진입 catch 시각(T2)이다. FAILED 처럼 무조건 새 값을 쓰면
      // `finalizeCancelledExecution`(execution-engine.service.ts)의 `??` 병합과
      // 어긋나 그 JSDoc 이 명시하는 §2.3 계약("stop 이 쓴 finishedAt/durationMs 가
      // 보존된다")을 이 경로만 깬다. SELECT(`live`)~UPDATE 사이 창을 신뢰하지
      // 않기 위해(WARNING #3 ABA 계열과 같은 이유) 앱 레벨 `??` 병합이 아니라
      // UPDATE 문 자체의 SQL `COALESCE` 로 "그 순간의" DB 값을 재평가한다 — 이미
      // 있으면(NOT NULL) 보존하고, 처음이면(NULL, 레이스로 이 경로가 최초
      // 관측자가 되는 극단 케이스) 이번 값을 쓴다. `error` 는 SET 절에서 아예
      // 제외한다 — W16(취소 시 error 미저장)과 동일 원칙이고, 덤으로 이전 시도의
      // stale `execution.error` 가 취소 row 에 재기록되는 문제(testing WARNING #1)
      // 도 함께 닫는다. FAILED/COMPLETED 분기(else, 아래)는 2R CRITICAL 수정
      // 그대로 무조건 새 값을 쓴다 — 재진입이 다시 실패한 경우 이번 시도의
      // error/finishedAt/durationMs 가 최신 진실이기 때문이다(되돌리지 않는다).
      if (target === ExecutionStatus.CANCELLED) {
        const result = await this.executionRepository
          .createQueryBuilder()
          .update(Execution)
          .set({
            finishedAt: () => 'COALESCE(finished_at, :newFinishedAt)',
            durationMs: () => 'COALESCE(duration_ms, :newDurationMs)',
          })
          .where('id = :id', { id: executionId })
          .andWhere('status = :status', { status: target })
          .setParameter('newFinishedAt', execution.finishedAt)
          .setParameter('newDurationMs', execution.durationMs)
          .execute();
        return (result.affected ?? 0) > 0;
      }
      const result = await this.executionRepository
        .createQueryBuilder()
        .update(Execution)
        .set({
          // jsonb 컬럼이라 QueryBuilder 의 DeepPartial 타입과 맞지 않는다 —
          // 저장소 관용(raw 파라미터 캐스팅)을 따른다.
          error: (execution.error ?? null) as never,
          finishedAt: execution.finishedAt,
          durationMs: execution.durationMs,
        })
        .where('id = :id', { id: executionId })
        .andWhere('status = :status', { status: target })
        .execute();
      return (result.affected ?? 0) > 0;
    }
    if (!canTransition(live.status, target)) {
      this.logger.warn(
        `${caller}(${executionId}): 정본 상태 '${live.status}' 에서 '${target}' 로 ` +
          `전이 불가 — 동시 cancel 선점으로 보고 마킹·emit 을 모두 skip`,
      );
      return false;
    }
    const persisted = await this.driver.updateExecutionStatus(
      execution,
      target,
    );
    if (!persisted) {
      this.logger.warn(
        `${caller}(${executionId}): guarded UPDATE 0행 — 동시 cancel 선점, ` +
          `마킹·emit 을 모두 skip`,
      );
    }
    return persisted;
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
   * ai-review WARNING #7 (2026-07-27, 4차 라운드) — 동시 cancel 선점 시 저장·
   * 이벤트 emit 을 모두 건너뛰고 조용히 반환할 수 있다 (`finalizeGuarded` 참조).
   *
   * @internal 이 메서드는 `resumeGraphAfterRetry` 의 defensive fallback 에서만
   * 호출된다. 다른 경로에서 직접 호출하지 말 것.
   */
  private async completeRetryExecution(
    execution: Execution,
    executionId: string,
  ): Promise<void> {
    execution.finishedAt = new Date();
    execution.durationMs =
      resolveTerminalDurationMs(execution) ?? execution.durationMs;
    if (
      !(await this.finalizeGuarded(
        execution,
        executionId,
        ExecutionStatus.COMPLETED,
        'completeRetryExecution',
      ))
    ) {
      return;
    }
    await this.eventEmitter.emitExecution(
      executionId,
      ExecutionEventType.EXECUTION_COMPLETED,
      {
        status: ExecutionStatus.COMPLETED,
        durationMs: resolveTerminalDurationMs(execution),
      },
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
    // input 은 retry 경로엔 의미 없으므로 빈 객체 — **의도적으로** 다른 재진입
    // 경로(`ExecutionEngineService.reentryWorkflowInput`)와 달리
    // `savedExecution.inputData` 를 쓰지 않는다. 사유·spec 근거는 그 helper 의
    // "의도적 예외" 주석 참조(요약: 완료된 중간 AI 노드만 `_retryState` 로 재구동,
    // 진입 트리거는 재실행 안 됨, `$input.*` 미해소는 §retry 문서화 동작).
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
          Record<string, unknown> | undefined) ?? {};
    }
    // 조건 밖 — `outputData` 만 마지막 노드에 의존한다 (engine 과 동일 처방).
    savedExecution.finishedAt = new Date();
    savedExecution.durationMs =
      resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs;
    const completed = await this.driver.updateExecutionStatus(
      savedExecution,
      ExecutionStatus.COMPLETED,
    );
    if (completed) {
      await this.eventEmitter.emitExecution(
        executionId,
        ExecutionEventType.EXECUTION_COMPLETED,
        {
          status: ExecutionStatus.COMPLETED,
          durationMs: resolveTerminalDurationMs(savedExecution),
        },
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
   * ai-review WARNING #7 (2026-07-27, 4차 라운드) — 동시 cancel 선점 시 저장·
   * 이벤트 emit 을 모두 건너뛰고 조용히 반환할 수 있다 (`finalizeGuarded` 참조).
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
    // 목표 상태는 **별도 변수**로 둔다 — `execution.status` 에 미리 대입하면
    // `updateExecutionStatus` 가 그것을 *현재* 상태로 읽어 `assertTransition` 이
    // 자기 자신으로의 전이(FAILED→FAILED)를 보게 된다.
    const finalStatus = isCancelled
      ? ExecutionStatus.CANCELLED
      : ExecutionStatus.FAILED;
    const errMessage = error instanceof Error ? error.message : String(error);
    // ai-review W16 (2026-07-26) — 취소 시 execution.error 를 DB 에 저장하지 않는다.
    // WS emit 은 이미 `!isCancelled` 일 때만 error 를 포함해 안전한데(아래), DB 저장은
    // 무조건 이었다 — REST `GET /executions/:id` 로 내부 message 가 노출되고
    // `finalizeCancelledExecution`(runExecution/재개 경로, 취소 시 error 를 비움)과도
    // 불일치했다. 같은 판정(isCancelled)을 재사용해 두 경로를 일치시킨다.
    if (!isCancelled) {
      execution.error = { message: errMessage };
    }
    execution.finishedAt = new Date();
    execution.durationMs =
      resolveTerminalDurationMs(execution) ?? execution.durationMs;
    // 2026-07-27 — `completeRetryExecution` 과 동일 이유의 guarded 전환. 특히 FAILED
    // 분기가 위험하다: 턴 진행 중 도착한 Stop 이 DB 를 `cancelled` 로 마감했는데 그
    // 턴이 (429/timeout 등으로) 자연 실패하면, 무가드 save 가 취소를 **FAILED 로
    // 덮어쓰고** 실패 이벤트를 사후 발행했다 (#1022 `finalizeFailedExecution` 과 동형).
    if (
      !(await this.finalizeGuarded(
        execution,
        executionId,
        finalStatus,
        'failRetryExecution',
      ))
    ) {
      return;
    }
    await this.eventEmitter.emitExecution(
      executionId,
      isCancelled
        ? ExecutionEventType.EXECUTION_CANCELLED
        : ExecutionEventType.EXECUTION_FAILED,
      {
        status: finalStatus,
        durationMs: resolveTerminalDurationMs(execution),
        // 위에서 `execution.error` 에 쓴 객체를 그대로 싣는다.
        ...(!isCancelled
          ? { error: toTerminalErrorPayload(execution.error) }
          : {}),
      },
    );
  }
}
