import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { NODE_TYPES } from '../../../nodes/core/node-types.constants';
import {
  Execution,
  ExecutionStatus,
} from '../../executions/entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../../node-executions/entities/node-execution.entity';
import {
  ContinuationBusService,
  RECOVERY_LOCK_KEY,
} from '../continuation/continuation-bus.service';
import { resolveQueueWaitTimeoutMs } from '../execution-limits';
import {
  ORPHAN_NODE_PARENT_CHAIN_MAX_DEPTH,
  ORPHAN_RUNNING_NODE_EXECUTION_IDS_SQL,
} from './orphan-running-node-executions.sql';

/**
 * Recovery 의 stale 임계값 — RUNNING execution 이 이 시간보다 오래되면
 * worker heartbeat 가 끊긴 stuck 으로 간주한다. WAITING_FOR_INPUT 은 본
 * 임계값과 무관하며 recovery 대상이 아니다 (사용자 입력은 며칠 후 도착할
 * 수도 있으므로 무기한 보존, §7.5 rehydration 으로 자연 재개).
 * 다중 인스턴스 환경에서 다른 인스턴스가 활발히 처리 중인 정상 RUNNING 을
 * 잘못 FAIL 시키지 않도록 보수적 가드 (heartbeat 간격 5초의 360배).
 *
 * SoT: `CLE-EXEC-RECOVERY` 「부팅 복구 스캔」.
 */
export const STUCK_RECOVERY_STALE_MS = 30 * 60 * 1000;

/**
 * 분산 lock 의 TTL (초). 부팅 동시 진행 시 다른 인스턴스가 lock 을 획득해
 * 본 인스턴스의 recovery 가 skip 되더라도, lock 보유자가 죽었을 때 60초
 * 후 lock 이 expire 되어 다음 부팅에서 다시 시도 가능.
 */
export const RECOVERY_LOCK_TTL_SECONDS = 60;

/**
 * 부팅 스캔이 엔진에 맡기는 동작. 셋 다 실행 그래프 · 실행 상태 전이를 다루는 엔진
 * 내부 동작이라 엔진이 호출마다 넘긴다. 이 서비스가 엔진을 주입받지 않으므로 DI 순환이
 * 생기지 않는다.
 */
export interface StuckRecoveryEnginePort {
  /**
   * 재점유한 stale RUNNING 실행을 §7.5 case B rehydration 으로 다시 구동한다. 스캔은
   * 결과를 기다리지 않는다.
   */
  redriveStuckExecution(executionId: string): Promise<void>;
  /** 재구동 세그먼트의 §8 active-running 기준 시각을 남긴다. */
  recordRunningSegmentStart(executionId: string): void;
  /** 대기 한도를 넘긴 `pending` 실행을 wait-timeout `cancelled` 로 마감한다(§8). */
  markQueueWaitTimeout(executionId: string): Promise<void>;
}

/**
 * 부팅 복구 스캔(CLE-EXEC-RECOVERY). CLE-T-S03WEV 에서 `ExecutionEngineService` 에서
 * 옮겼다. 엔진의 `onApplicationBootstrap` 과 e2e 전용 트리거 `runStuckRecoveryScan` 이
 * {@link recoverStuckExecutions} 를 부른다.
 */
@Injectable()
export class StuckExecutionRecoveryService {
  private readonly logger = new Logger(StuckExecutionRecoveryService.name);

  constructor(
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(NodeExecution)
    private readonly nodeExecutionRepository: Repository<NodeExecution>,
    private readonly continuationBus: ContinuationBusService,
  ) {}

  /**
   * On server restart, **re-drive** stale RUNNING executions **and cancel orphan
   * PENDING** executions (§7.1/§7.2 point 3 / §7.4 / §7.5 case B / §8 — PR3
   * 2026-07-04, orphan pending backstop 2026-07-04).
   *
   * 옛 동작(일괄 `failed` 마킹)을 **제어된 re-drive** 로 전환한다: stale RUNNING 을
   * `started_at` 조건부 원자 re-claim(`reclaimStuckRunningExecution`) 한 뒤 각 row 를
   * §7.5 case B rehydration 으로 재구동(완료 노드 이후부터 그래프 forward, node-type
   * 무관). §7.2 point 3("재시작 시 running 을 체크포인트에서 resume")의 일반 노드 구현.
   *
   * **같은 스캔이 orphan `pending` 도 회수한다**(`recoverOrphanPendingExecutions`, §8):
   * admission 재큐 job 이 소실된 대기 초과 `pending` 을 wait-timeout `cancelled` 로 마감.
   * RUNNING 은 진행 흔적이 있어 re-drive, PENDING 은 없어 cancel(§Rationale "orphan
   * pending backstop"). running 재점유 유무와 무관하게 항상 수행한다.
   *
   * 다중 인스턴스 환경에서:
   * - SET NX 분산 boot-lock(`exec:recover:lock`)으로 동시 스캔 시작을 가드.
   * - row 단위 `started_at` 조건부 re-claim(affected=1)은 그 안의 defense-in-depth —
   *   lock 만료·늦은 부팅 스캔 겹침에도 같은 row 를 두 번 re-drive 하지 않는다.
   * - `status='running' AND started_at < now() - 30분` 인 row 만 대상.
   * - **WAITING_FOR_INPUT 은 절대 건드리지 않는다** — 사용자 입력은 며칠 후 도착할
   *   수 있고, 입력 도착 시 §7.5 case A rehydration 으로 자연 재개.
   *
   * **PR4 이후 = backstop**: 운영 중 워커 크래시는 BullMQ stalled-job 자동 재배달
   * (`runExecutionFromQueue` RUNNING 분기)이 즉시 인계하므로, 본 부팅 스캔은 **stalled
   * 이 놓치는 케이스의 안전망**이다 — (a) 전체 재시작·Redis 비영속으로 active job 이
   * 소실된 경우, (b) enqueue 후 job 유실, (c) stalled 창(>30분)보다 오래된 잔류.
   * 이 경우엔 재배달할 stalled job 자체가 없어 DB 부팅 스캔만 복구 가능하다(은퇴 불가 —
   * KB `stuck-document-recovery` 와 동형). boot-only 트리거라 poison 세그먼트 re-drive
   * 는 부팅당 최대 1회로 자연 rate-limit 된다.
   *
   * **단계** (이 순서로 돈다):
   *   1. stale RUNNING 원자 re-claim 과 재구동(위 (a)(b)(c) 는 stalled 이 놓치는 원인 목록이다).
   *   2. orphan pending 회수(`recoverOrphanPendingExecutions`).
   *   3. 종결된 실행 아래 남은 노드 실행 행 정리(`closeOrphanRunningNodeExecutions`, CLE-T-CCEQEC).
   *      실행이 먼저 끝나고 노드 행만 `running` 으로 남은 경우를 `failed` 로 닫는다.
   *
   * SoT: `CLE-EXEC-RECOVERY` 「부팅 복구 스캔」 · 「종결된 실행 아래 남은 노드 실행 행」, CLE-T-CCEQEC.
   *
   * @param engine 재구동 · 세그먼트 기록 · 대기 초과 취소를 맡을 엔진 동작
   */
  async recoverStuckExecutions(engine: StuckRecoveryEnginePort): Promise<void> {
    const acquired = await this.continuationBus.acquireLock(
      RECOVERY_LOCK_KEY,
      RECOVERY_LOCK_TTL_SECONDS,
    );
    if (!acquired) {
      // 다른 인스턴스가 이미 처리 중. 본 인스턴스는 skip — lock 이 expire
      // 된 다음 부팅이나 다른 인스턴스의 후속 호출에서 처리된다.
      return;
    }

    try {
      const staleThreshold = new Date(Date.now() - STUCK_RECOVERY_STALE_MS);
      // 단계 1: stale RUNNING 을 원자 re-claim(started_at 조건부 UPDATE … RETURNING).
      //     affected rows = 본 인스턴스가 소유권을 획득한 재구동 대상.
      const reclaimedIds = await this.reclaimStuckRunningExecution(
        staleThreshold,
        engine,
      );
      if (reclaimedIds.length > 0) {
        this.logger.warn(
          `Re-claimed ${reclaimedIds.length} stale RUNNING execution(s) (>30min) for crash re-drive (§7.5 case B)`,
        );
        // 각 재구동은 fire-and-forget — 부팅을 그래프 실행으로 막지 않는다.
        //     redriveStuckExecution 이 내부 try/catch/finally 로 단말 상태를
        //     자기 마킹하므로 reject 하지 않으나, 방어적 .catch 로 unhandled
        //     rejection 을 차단한다. 각 row 는 이미 started_at 이 갱신돼 다른
        //     인스턴스가 재-picking 하지 않으므로 lock 을 곧 풀어도 안전하다.
        for (const executionId of reclaimedIds) {
          void engine
            .redriveStuckExecution(executionId)
            .catch((err: unknown) => {
              this.logger.error(
                `Crash re-drive failed for execution ${executionId}: ${
                  err instanceof Error ? err.message : String(err)
                }`,
              );
            });
        }
      }
      // 단계 2: orphan pending backstop (§8) — admission 재큐 job 이 소실돼(예: Redis
      //     비영속·job 유실) 다시 pick up 되지 않는 pending row 를 회수한다. running
      //     재점유 유무와 무관하게 항상 스캔한다(위 early-return 제거).
      await this.recoverOrphanPendingExecutions(engine);
      // 단계 3: 종결된 실행 아래 남은 노드 실행 행 정리 (CLE-T-CCEQEC). 이미 끝난 실행 아래
      //     running 으로 남은 행을 닫는다. 단계 1 의 재구동은 실행이 running 일 때만 옛 행을 닫으므로
      //     (엔진의 failOrphanRunningNodeExecutions) 이 행들은 여기서만 닫힌다. 실패해도 부팅을 막지 않는다.
      await this.closeOrphanRunningNodeExecutions(staleThreshold);
    } finally {
      // 작업 완료 후 lock 을 명시 해제 — TTL 60초 만료 대기 없이 다음
      // 인스턴스가 즉시 처리할 수 있다. owner 검증이 들어가 있어 이미
      // expire 되어 다른 인스턴스가 잡은 lock 은 절대 삭제하지 않는다.
      await this.continuationBus.releaseLock(RECOVERY_LOCK_KEY);
    }
  }

  /**
   * §7.5 case B — stale RUNNING 세그먼트의 원자 re-claim. `started_at` 조건부
   * 단일 UPDATE(`… SET started_at=now() WHERE status='running' AND started_at <
   * :threshold RETURNING id`)로 소유권을 획득한다. affected rows 만 반환 — 두
   * 인스턴스가 같은 stale row 를 동시에 잡아도 affected=1 인 쪽만 재구동한다
   * (§1.3 `_retryState` "affected=1 인 쪽만 진행" 패턴의 일반화). `started_at`
   * 갱신은 (i) 재-picking 방지(더 이상 stale 아님)와 (ii) recordRunningSegmentStart
   * 로 §8 active-running 세그먼트 tracking baseline 을 겸한다.
   *
   * 상태 enum 은 `running → running` 불변(소유권 이전만)이라 §1.1 전이표 무변경.
   */
  private async reclaimStuckRunningExecution(
    staleThreshold: Date,
    engine: StuckRecoveryEnginePort,
  ): Promise<string[]> {
    const result = await this.executionRepository
      .createQueryBuilder()
      .update(Execution)
      .set({ startedAt: () => 'NOW()' })
      .where('status = :status', { status: ExecutionStatus.RUNNING })
      .andWhere('started_at < :threshold', { threshold: staleThreshold })
      .returning('id')
      .execute();
    const ids = ((result.raw as Array<{ id?: string }> | undefined) ?? [])
      .map((r) => r.id)
      .filter((id): id is string => typeof id === 'string');
    // §8 — 재구동 세그먼트의 active-running tracking baseline. claimResumeEntry 가
    // waiting 재개에서 하는 것과 동일(assertActiveTimeWithinLimit 의 in-progress 경과분).
    for (const id of ids) engine.recordRunningSegmentStart(id);
    return ids;
  }

  /**
   * §8 orphan pending backstop — admission 재큐 job 이 소실된 `pending` Execution 회수.
   *
   * cap 초과로 delayed 재큐된 job(auto-id, jobId 없음)이 Redis 비영속·eviction 등으로
   * 소실되면 그 `pending` row 는 다시 pick up 될 job 이 없어 영구 잔류한다. 큐 대기 5분
   * timeout 은 consumer 가 job 을 pick up 할 때(`admitExecutionOrDefer`)만 검사되므로
   * orphan 은 그 검사를 받지 못한다(§8 "트리거 = admission 시점 검사").
   *
   * **액션 = wait-timeout cancel(re-enqueue 아님)**: 큐 대기 한도를 **이미 초과한**
   * pending(`queued_at < now - resolveQueueWaitTimeoutMs()`)만 대상으로, consumer 가
   * pick up 했다면 admission 이전 timeout 검사로 `cancelled` 마감했을 값을 그대로 적용한다.
   * 재큐→재검사→cancel 과 결과가 같으므로 직접 cancel 이 단순·안전하다(오래된 실행을
   * RUNNING 으로 부활시키지 않는다). 한도 이내 orphan 은 다음 스캔에서 초과 시 회수
   * (낮은 확률 엣지·boot-only 트리거 — best-effort). `markQueueWaitTimeout` 은 조건부
   * UPDATE(`WHERE status='pending'`)라 동시 admit/cancel 과의 race 에 멱등이다.
   *
   * SoT: `CLE-EXEC-RECOVERY` 「부팅 복구 스캔」, `CLE-EXEC-WORKER` 동시 실행 제한 절.
   */
  private async recoverOrphanPendingExecutions(
    engine: StuckRecoveryEnginePort,
  ): Promise<void> {
    const staleThreshold = new Date(Date.now() - resolveQueueWaitTimeoutMs());
    // queued_at IS NULL(레거시 pre-V104 row)은 LessThan 이 자연 제외한다(NULL < x = 미매치).
    // 인덱스: `idx_execution_status(status)`(V002)로 sparse 한 pending 부분집합을 좁힌 뒤
    // queued_at 필터. 전용 `(status, queued_at)` 복합 인덱스는 두지 않는다 — 본 스캔은
    // boot-only/on-demand(hot-path 아님)이고 pending 집합은 admission cap+5분 timeout 으로
    // bound 되며, stale RUNNING backstop(`reclaimStuckRunningExecution`, `status='running'
    // AND started_at<τ`)도 동일하게 전용 복합 인덱스 없이 `idx_execution_status` 에 의존하는
    // 기존 선례와 대칭이다(핫 execution 테이블의 write-path 인덱스 유지비 회피).
    const orphans = await this.executionRepository.find({
      where: {
        status: ExecutionStatus.PENDING,
        queuedAt: LessThan(staleThreshold),
      },
      select: { id: true },
    });
    if (orphans.length === 0) return;
    this.logger.warn(
      `[recovery] orphan pending ${orphans.length}건 (queue-wait 초과, job 소실 추정) — wait-timeout cancel (§8)`,
    );
    for (const { id } of orphans) {
      await engine.markQueueWaitTimeout(id);
    }
  }

  /**
   * CLE-T-CCEQEC — 부팅 스캔의 「종결된 실행 아래 남은 노드 실행 행」 정리 단계(단계 3). 종결된 실행(`completed` · `failed` · `cancelled`) 아래
   * `running` 으로 남은 노드 실행 행을 `failed` 로 닫는다.
   *
   * case B 재구동의 엔진 `failOrphanRunningNodeExecutions` 는 실행이 `running` 일 때만 돈다.
   * 실행이 먼저 끝나고 노드 행만 `running` 으로 남는 아래 경로는 그 마감에 닿지 않는다.
   *   1. `retry_last_turn` 2차 claim(`claimSpawnedRetryRow`)이 버린 새 행. 실행은 `failed` 다.
   *   2. 2차 claim 이 성공한 뒤 try 에 들어가기 전의 예외 · 크래시. 재배달은 claim 에 실패해
   *      1 로 끝난다.
   *   3. 짝 전이가 실행을 `cancelled` 로 커밋한 뒤 `markNodeCancelled` 가 끝나기 전의 크래시.
   * 셋 다 "종결된 실행 + `running` 노드 행" 이라 한 조건으로 닫는다. `retryLastTurn` 이 행을
   * 만든 뒤 재진입 작업을 잃은 경우도 같은 모양이라 함께 닫힌다.
   *
   * 살아 있는 작업은 아래 조건으로 뺀다.
   *   - 노드 행 `started_at` 이 {@link STUCK_RECOVERY_STALE_MS}(30분)보다 오래돼야 한다. 재시도
   *     재진입 턴(실행은 `failed`, 새 행은 `running`)과 취소 커밋 뒤 노드 마감 전의 짧은 창이 빠진다.
   *   - 부모 체인에 Background 노드 행이 있는 본문 행은 뺀다. 본문은 부모 실행이 끝난 뒤에도
   *     같은 executionId 로 돌고 `maxDurationMs=0` 이면 끝이 없다. 크래시로 남은 본문 행도
   *     그래서 이 단계가 닫지 않는다.
   *   - 조건부 UPDATE(`status='running'`)라 고른 뒤 그 사이 닫힌 행은 그대로 둔다.
   *
   * 운영 DB 영향: 배포 후 첫 부팅에서는 누적된 고아 행이 한 번에 `failed` 로 닫혀 타임라인 ·
   * 진행률 집계가 바뀔 수 있다. 배치(LIMIT)는 두지 않았다. UPDATE 가 `status='running'` 조건부라
   * recovery lock TTL 을 넘겨 두 인스턴스가 함께 돌아도 같은 행을 두 번 바꾸지 않고, 고른 행은
   * 30분 넘게 종결된 실행 아래 남은 것뿐이다. 첫 배포 때는 `[recovery] 종결된 실행 아래 …` 로그의
   * 건수로 영향 행 수를 확인한다.
   *
   * 노드 이벤트는 내지 않는다. 실행이 이미 끝나 구독자가 기다리는 진행이 없고, 엔진의 형제
   * `failOrphanRunningNodeExecutions` 와 같다. 실패해도 부팅을 막지 않고 error 로그만
   * 남긴다. 다음 부팅 스캔이 같은 행을 다시 본다.
   */
  private async closeOrphanRunningNodeExecutions(
    staleThreshold: Date,
  ): Promise<void> {
    try {
      const result = await this.nodeExecutionRepository
        .createQueryBuilder()
        .update(NodeExecution)
        .set({
          status: NodeExecutionStatus.FAILED,
          error: {
            message:
              'Node run left running under a finished execution; closed by boot recovery scan',
          },
          finishedAt: new Date(),
        })
        .where('status = :running', { running: NodeExecutionStatus.RUNNING })
        .andWhere(`id IN (${ORPHAN_RUNNING_NODE_EXECUTION_IDS_SQL})`, {
          orphanThreshold: staleThreshold,
          orphanTerminalStatuses: [
            ExecutionStatus.COMPLETED,
            ExecutionStatus.FAILED,
            ExecutionStatus.CANCELLED,
          ],
          orphanBackgroundType: NODE_TYPES.BACKGROUND,
          orphanMaxDepth: ORPHAN_NODE_PARENT_CHAIN_MAX_DEPTH,
        })
        .returning('id')
        .execute();
      const closed = (result.raw as unknown[] | undefined)?.length ?? 0;
      if (closed > 0) {
        this.logger.warn(
          `[recovery] 종결된 실행 아래 running 노드 실행 ${closed}건을 failed 로 닫음 (CLE-T-CCEQEC)`,
        );
      }
    } catch (err) {
      this.logger.error(
        `[recovery] 종결된 실행 아래 running 노드 실행 정리 실패: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
