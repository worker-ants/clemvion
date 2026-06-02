import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { TriggersService } from './triggers.service';

export const NOTIFICATION_SECRET_ROTATOR_QUEUE = 'notification-secret-rotator';
const PROMOTE_JOB = 'promote-rotated-notification-secrets';

/**
 * [Spec EIA §3.1 EIA-NX-12 / plan/in-progress/eia-secret-rotation-revoke-api.md]
 *
 * 24h grace 가 경과한 trigger 의 `notification_secret_v2` 를 primary `config.notification.signing.secretRef`
 * 로 승격. 매시간 실행 — 정확한 24h 시점이 아니어도 OK (이미 grace 내 둘 다 서명되므로 외부 검증
 * 측에 가시적 영향 없음).
 *
 * 스케줄: 매시간 0분. BullMQ repeatable scheduler 로 Redis 중앙 등록 + 워커 락 → k8s `replicas:2`
 * 멀티 인스턴스에서도 전역 1회만 실행 (각 trigger 별 v2 가 null 이면 no-op 이라 이중 안전).
 *
 * 본 service 는 scheduler/worker 어댑터만 — 실 비즈니스 로직은 `TriggersService.promoteRotatedNotificationSecrets`.
 */
@Injectable()
@Processor(NOTIFICATION_SECRET_ROTATOR_QUEUE)
export class NotificationSecretRotatorService
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(NotificationSecretRotatorService.name);

  constructor(
    private readonly triggersService: TriggersService,
    @InjectQueue(NOTIFICATION_SECRET_ROTATOR_QUEUE)
    private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // upsertJobScheduler 는 idempotent — 같은 ID 를 여러 번 등록해도 Redis 에 단일
    // repeatable entry 만 남아 멀티 인스턴스에서도 중복되지 않는다. scheduler ID 는 큐
    // 이름에서 파생해 상수 변경 시 orphan entry 회귀를 차단. removeOnComplete 만 실질
    // 동작 (process 가 에러를 swallow 해 잡이 항상 성공 종료) — removeOnFail 은 방어적.
    await this.queue.upsertJobScheduler(
      `${NOTIFICATION_SECRET_ROTATOR_QUEUE}-hourly`,
      { pattern: '0 * * * *' },
      {
        name: PROMOTE_JOB,
        opts: {
          removeOnComplete: { age: 7 * 24 * 60 * 60 },
          removeOnFail: { age: 30 * 24 * 60 * 60 },
        },
      },
    );
  }

  async process(_job: Job): Promise<void> {
    await this.handleHourly();
  }

  async handleHourly(): Promise<void> {
    try {
      const { promoted } =
        await this.triggersService.promoteRotatedNotificationSecrets();
      if (promoted > 0) {
        this.logger.log(
          `NotificationSecretRotator: ${promoted} trigger(s) 의 notification_secret_v2 가 primary 로 승격됨.`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `NotificationSecretRotator: promote 실행 실패 — 다음 시간에 재시도: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
