import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { TriggersService } from '../triggers/triggers.service';

export const CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE = 'chat-channel-token-rotator';
const CLEANUP_JOB = 'cleanup-rotated-chat-channel-tokens';

/**
 * [Spec CCH-SE-04-C] — Chat Channel bot token 회전 24h grace 종료 스케줄.
 *
 * 매시간 0분 실행. `chat_channel_token_v2` 가 null 이 아니고 `chat_channel_rotated_at` 가
 * 24h 이전인 trigger 의 v2 ref 를 secret_store 에서 삭제 + provider 별 `auth.revoke` 호출 +
 * 컬럼 null 갱신.
 *
 * `NotificationSecretRotatorService` 와 동일 패턴 — 멱등 (v2 null 이면 no-op). BullMQ repeatable
 * scheduler 로 Redis 중앙 등록 + 워커 락 → k8s `replicas:2` 멀티 인스턴스에서도 전역 1회만 실행
 * (각 candidate trigger 별 save 가 row-level 멱등이라 이중 안전).
 *
 * 본 service 는 scheduler/worker 어댑터만 — 실 비즈니스 로직은 `TriggersService.cleanupRotatedChatChannelTokens`.
 */
@Injectable()
@Processor(CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE)
export class ChatChannelTokenRotatorService
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(ChatChannelTokenRotatorService.name);

  constructor(
    private readonly triggersService: TriggersService,
    @InjectQueue(CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE)
    private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'chat-channel-token-rotator-hourly',
      { pattern: '0 * * * *' },
      {
        name: CLEANUP_JOB,
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
