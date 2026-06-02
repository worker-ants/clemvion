import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { LoginHistoryService } from '../login-history.service';

export const LOGIN_HISTORY_PRUNER_QUEUE = 'login-history-pruner';
const PRUNE_JOB = 'prune-login-history';

/**
 * 매일 새벽 3시(Asia/Seoul) 에 180일을 넘긴 login_history 행을 삭제한다.
 *
 * - 명시적 timezone — 서버 로컬 타임존 변동(EC2 이전·CI 머신 등) 으로 인한 시각 표류 차단.
 * - 멀티 인스턴스 안전 — BullMQ repeatable scheduler 가 Redis 중앙 스케줄에 단일 entry 로
 *   등록되고, 워커가 Redis 락으로 한 잡을 한 워커만 집어가므로 k8s `replicas:2` 환경에서도
 *   전역 1회만 실행된다 (옛 `@Cron` 인메모리 타이머는 프로세스마다 독립 발화 → replica 수만큼 중복).
 * - 배치 LIMIT — pruner 자체가 한 번에 너무 많은 row 를 삭제하지 않도록 service 가 배치 루프로 처리.
 *
 * 본 service 는 scheduler/worker 어댑터만 — 실 비즈니스 로직은 `LoginHistoryService.pruneOlderThanRetention`.
 */
@Injectable()
@Processor(LOGIN_HISTORY_PRUNER_QUEUE)
export class LoginHistoryPrunerService
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(LoginHistoryPrunerService.name);

  constructor(
    private readonly loginHistory: LoginHistoryService,
    @InjectQueue(LOGIN_HISTORY_PRUNER_QUEUE)
    private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // 매일 03:00 Asia/Seoul. upsertJobScheduler 는 idempotent — 같은 ID 를 여러 번
    // 등록해도 Redis 에 단일 repeatable entry 만 남아 멀티 인스턴스에서도 중복되지 않는다.
    await this.queue.upsertJobScheduler(
      'login-history-pruner-daily',
      { pattern: '0 3 * * *', tz: 'Asia/Seoul' },
      {
        name: PRUNE_JOB,
        opts: {
          removeOnComplete: { age: 7 * 24 * 60 * 60 },
          removeOnFail: { age: 30 * 24 * 60 * 60 },
        },
      },
    );
  }

  async process(_job: Job): Promise<void> {
    await this.prune();
  }

  async prune(): Promise<void> {
    try {
      const removed = await this.loginHistory.pruneOlderThanRetention();
      if (removed > 0) {
        this.logger.log(
          `login_history pruned ${removed} row(s) past retention`,
        );
      }
    } catch (err) {
      this.logger.error(
        `login_history prune failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
