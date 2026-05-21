import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TriggersService } from './triggers.service';

/**
 * [Spec EIA §3.1 EIA-NX-12 / plan/in-progress/eia-secret-rotation-revoke-api.md]
 *
 * 24h grace 가 경과한 trigger 의 `notification_secret_v2` 를 primary `config.notification.signing.secret`
 * 으로 승격. 매시간 실행 — 정확한 24h 시점이 아니어도 OK (이미 grace 내 둘 다 서명되므로 외부 검증
 * 측에 가시적 영향 없음).
 *
 * 스케줄: 매시간 0분. 분산 환경에서 다중 instance 가 동시 실행해도 멱등 (각 trigger 별 v2 가 null
 * 이면 no-op).
 */
@Injectable()
export class NotificationSecretRotatorService {
  private readonly logger = new Logger(NotificationSecretRotatorService.name);

  constructor(private readonly triggersService: TriggersService) {}

  @Cron(CronExpression.EVERY_HOUR)
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
