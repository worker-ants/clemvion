import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TriggersService } from '../triggers/triggers.service';

/**
 * [Spec CCH-SE-04-C] — Chat Channel bot token 회전 24h grace 종료 cron.
 *
 * 매시간 0분 실행. `chat_channel_token_v2` 가 null 이 아니고 `chat_channel_rotated_at` 가
 * 24h 이전인 trigger 의 v2 ref 를 secret_store 에서 삭제 + provider 별 `auth.revoke` 호출 +
 * 컬럼 null 갱신.
 *
 * `NotificationSecretRotatorService` 와 동일 패턴 — 멱등 (v2 null 이면 no-op). 다중 인스턴스
 * 환경에서도 안전 (각 candidate trigger 별 save 가 row-level 멱등).
 *
 * 본 service 는 cron trigger 만 — 실 비즈니스 로직은 `TriggersService.cleanupRotatedChatChannelTokens`.
 */
@Injectable()
export class ChatChannelTokenRotatorService {
  private readonly logger = new Logger(ChatChannelTokenRotatorService.name);

  constructor(private readonly triggersService: TriggersService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourly(): Promise<void> {
    try {
      const { cleaned } =
        await this.triggersService.cleanupRotatedChatChannelTokens();
      if (cleaned > 0) {
        this.logger.log(
          `ChatChannelTokenRotator: ${cleaned} trigger(s) 의 chat_channel_token_v2 cleanup 완료.`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `ChatChannelTokenRotator: cleanup 실행 실패 — 다음 시간에 재시도: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
