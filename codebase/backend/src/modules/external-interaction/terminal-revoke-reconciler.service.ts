import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InteractionTokenService } from './interaction-token.service';

export const TERMINAL_REVOKE_RECONCILE_QUEUE = 'terminal-revoke-reconcile';
const RECONCILE_JOB = 'reconcile-terminal-revocations';

/**
 * [Spec EIA §3.4 EIA-RL-06 / §9.3 / §Rationale R15] terminal token revoke 의 at-least-once 보강.
 *
 * live fast-path(`NotificationFanout` 의 terminal 이벤트 구독 → `revokeAllForExecution`)는 버퍼 없는
 * RxJS Subject 라 process 재시작/크래시 시 in-flight 이벤트가 소실돼 revoke 가 누락될 수 있다. 본
 * 워커는 BullMQ repeatable scheduler 로 분 단위로 깨어나 `execution_token` 을 terminal `execution` 과
 * join 해 잔존 토큰을 회수한다 (`InteractionTokenService.reconcileTerminalRevocations`).
 *
 * - 멀티 인스턴스 안전 — BullMQ repeatable scheduler 는 Redis 중앙 스케줄에 단일 entry 로 등록되고
 *   워커가 Redis 락으로 한 잡을 한 워커만 집어가므로 `replicas:N` 에서도 전역 1회만 실행된다
 *   (login-history-pruner 와 동일 패턴 — 옛 `@Cron` 인메모리 타이머는 replica 수만큼 중복 발화).
 * - `execution_token` 이 곧 durable outbox — 별도 outbox 테이블을 두지 않는다 (§Rationale R15).
 * - 본 service 는 scheduler/worker 어댑터만 — 실 로직은 `InteractionTokenService`.
 */
@Injectable()
@Processor(TERMINAL_REVOKE_RECONCILE_QUEUE)
export class TerminalRevokeReconcilerService
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(TerminalRevokeReconcilerService.name);

  constructor(
    private readonly tokenService: InteractionTokenService,
    @InjectQueue(TERMINAL_REVOKE_RECONCILE_QUEUE)
    private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // 분 단위 reconciliation. upsertJobScheduler 는 idempotent — 같은 ID 를 여러 번 등록해도
    // Redis 에 단일 repeatable entry 만 남아 멀티 인스턴스에서도 중복되지 않는다. scheduler ID 는
    // 큐 이름에서 파생 — 큐 상수 변경 시 ID 가 함께 따라가 orphan entry 회귀를 차단한다.
    await this.queue.upsertJobScheduler(
      `${TERMINAL_REVOKE_RECONCILE_QUEUE}-every-minute`,
      { pattern: '* * * * *' },
      {
        name: RECONCILE_JOB,
        opts: {
          removeOnComplete: { age: 24 * 60 * 60 },
          removeOnFail: { age: 7 * 24 * 60 * 60 },
        },
      },
    );
  }

  async process(_job: Job): Promise<void> {
    await this.reconcile();
  }

  async reconcile(): Promise<void> {
    try {
      const { swept, revoked } =
        await this.tokenService.reconcileTerminalRevocations();
      if (swept > 0) {
        this.logger.log(
          `terminal-revoke reconciliation swept ${swept} execution(s), revoked ${revoked} jti`,
        );
      }
    } catch (err) {
      // fail-open — 다음 tick 에서 재시도. 부팅을 막지 않는다.
      this.logger.error(
        `terminal-revoke reconciliation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
