import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InteractionTokenService } from './interaction-token.service';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import {
  WEBCHAT_IDLE_REAPER_QUEUE,
  resolveWebchatIdleReapGraceMs,
} from './webchat-idle-reaper.types';

const REAP_JOB = 'reap-idle-webchat-executions';
/** repeatable job 보존 — 완료 24h / 실패 7d (reconciler 와 동형). */
const REMOVE_ON_COMPLETE_AGE_SEC = 24 * 60 * 60;
const REMOVE_ON_FAIL_AGE_SEC = 7 * 24 * 60 * 60;
/** execution 단위 bounded-concurrency — 직렬 N+1 왕복 완화 (reconcile 과 동형). */
const REAP_CONCURRENCY = 10;

/**
 * [Spec EIA §3.4 EIA-RL-07 / §R19] 공개 웹채팅 위젯 idle-wait execution 회수 backstop.
 *
 * 위젯 "새 대화" best-effort cancel(§R9-B-1)이 유실된 경로(탭 종료·"닫기"·네트워크)의 잔존
 * park(`waiting_for_input`)을 서버가 회수한다. 익명(`auth_config_id IS NULL`) per_execution
 * execution 중 **발급된 모든 토큰이 영구 만료**(refresh 불가 = provably un-continuable)된 것을
 * `cancelled`(`cancelledBy='timeout'` + `error.code='WEBCHAT_IDLE_TIMEOUT'`)로 마감한다.
 *
 * **EIA-RL-06 `terminal-revoke-reconciler` 와 동일 패턴**(BullMQ repeatable · `execution_token`
 * sweep · 전역 1회)의 형제 — 목적/대상 상태가 달라 별도 큐/서비스로 분리한다. `§1.1` 전이표가
 * 예약한 `waiting_for_input → cancelled` "타임아웃" 사유의 구현이라 §7.4 무기한 보존 불변식과
 * 정합(엔진 recovery scanner 가 아니라 EIA token-lifecycle sweep).
 *
 * - 멀티 인스턴스 안전 — repeatable scheduler 의 Redis 단일 entry + 워커 락으로 `replicas:N`
 *   에서도 전역 1회. scheduler ID 를 큐명에서 파생 → orphan entry 회귀 차단.
 * - 판정 쿼리는 `InteractionTokenService.findIdleWebchatExecutionIds`, cancel+emit 은
 *   `ExecutionEngineService.markWebchatIdleTimeout`(멱등 조건부 UPDATE), 토큰 revoke 는
 *   `revokeAllForExecution`(EIA-RL-06 재사용) — 본 service 는 스케줄러/오케스트레이션 어댑터.
 */
@Injectable()
// concurrency: 1 — 큐 레벨. sweep 내부 per-execution 병렬은 REAP_CONCURRENCY 로 별도 bound.
@Processor(WEBCHAT_IDLE_REAPER_QUEUE, { concurrency: 1 })
export class WebchatIdleReaperService
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(WebchatIdleReaperService.name);

  constructor(
    private readonly tokenService: InteractionTokenService,
    private readonly executionEngineService: ExecutionEngineService,
    @InjectQueue(WEBCHAT_IDLE_REAPER_QUEUE)
    private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // 분 단위 sweep. upsertJobScheduler 는 idempotent — 멀티 인스턴스에서도 Redis 단일 repeatable
    // entry. scheduler ID 는 큐명에서 파생 → 큐 상수 변경 시 함께 따라가 orphan entry 회귀 차단.
    await this.queue.upsertJobScheduler(
      `${WEBCHAT_IDLE_REAPER_QUEUE}-every-minute`,
      { pattern: '* * * * *' },
      {
        name: REAP_JOB,
        opts: {
          removeOnComplete: { age: REMOVE_ON_COMPLETE_AGE_SEC },
          removeOnFail: { age: REMOVE_ON_FAIL_AGE_SEC },
        },
      },
    );
  }

  async process(_job: Job): Promise<void> {
    await this.reap();
  }

  /**
   * 한 sweep tick — 대상 조회 → engine cancel(멱등) → 성공분만 토큰 revoke. 에러는 swallow
   * (fail-open)해 다음 tick 재시도하며 워커를 죽이지 않는다. public 인 것은 단위 테스트 직접 호출용.
   */
  async reap(): Promise<void> {
    try {
      const graceMs = resolveWebchatIdleReapGraceMs();
      const executionIds =
        await this.tokenService.findIdleWebchatExecutionIds(graceMs);
      if (executionIds.length === 0) return;

      let reaped = 0;
      for (let i = 0; i < executionIds.length; i += REAP_CONCURRENCY) {
        const chunk = executionIds.slice(i, i + REAP_CONCURRENCY);
        const results = await Promise.allSettled(
          chunk.map((id) => this.reapOne(id)),
        );
        results.forEach((r, idx) => {
          if (r.status === 'fulfilled') {
            if (r.value) reaped += 1;
          } else {
            this.logger.warn(
              `webchat-idle reap 실패 (executionId=${chunk[idx]}) — fail-open: ${
                r.reason instanceof Error ? r.reason.message : String(r.reason)
              }`,
            );
          }
        });
      }
      this.logger.log(
        `webchat-idle reap: ${executionIds.length} candidate(s), ${reaped} cancelled`,
      );
    } catch (err) {
      // fail-open — 다음 tick 재시도. 부팅/워커를 막지 않는다.
      this.logger.error(
        `webchat-idle reap failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * execution 1건 회수 — 멱등 조건부 cancel 이 실제 전이(true)를 일으켰을 때만 토큰 revoke.
   * cancel 이 no-op(재개로 이미 RUNNING/terminal)이면 revoke 를 건너뛴다(이미 처리된 것).
   * @returns 실제 cancel 전이가 일어났으면 true.
   */
  private async reapOne(executionId: string): Promise<boolean> {
    const cancelled =
      await this.executionEngineService.markWebchatIdleTimeout(executionId);
    if (cancelled) {
      // soft-terminal — 토큰 일괄 revoke(EIA-RL-06 재사용, idempotent).
      await this.tokenService.revokeAllForExecution(executionId);
    }
    return cancelled;
  }
}
