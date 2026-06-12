import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';

/** per-chat fixed-window rate-limit 키. 테스트가 import 해 직접 의존 방지. */
export const makeChatRateLimitKey = (
  triggerId: string,
  conversationKey: string,
): string => `cc:rl:${triggerId}:${conversationKey}`;

/** fixed-window 초 (분당 한도이므로 60s). */
export const CHAT_RATE_LIMIT_WINDOW_SEC = 60;

/** CCH-NF-03 default 분당 한도 (config.chatChannel.rateLimitPerMinute 미설정 시). */
export const CHAT_RATE_LIMIT_DEFAULT_PER_MIN = 60;

/**
 * CCH-NF-03 — chat-channel inbound 의 per-chat 분당 rate-limit.
 *
 * Redis fixed-window 카운터 (`INCR` + 첫 증가 시 `EXPIRE`) — `PublicWebhookQuotaService`
 * 와 동일 패턴을 **별도 per-chat 키** (`cc:rl:{triggerId}:{conversationKey}`) 로 적용한다.
 * Redis 기반이라 멀티 인스턴스에서도 전역 카운트가 정확하다.
 *
 * Redis 미가용/에러 시 **fail-open** (항상 허용) — rate-limit 은 방어적 기능이라 부재 시
 * 차단보다 통과가 안전 (R-CC-19, `PublicWebhookQuotaService` 동일 정책).
 *
 * 한도 초과분의 처리(skip + `chat_channel_health=degraded`)는 호출자(HooksService)의 책임.
 */
@Injectable()
export class ChatChannelRateLimiterService {
  private readonly logger = new Logger(ChatChannelRateLimiterService.name);
  private readonly redis: Redis | null;

  constructor(
    @Optional()
    @Inject('CHAT_CHANNEL_RATE_LIMIT_REDIS')
    injectedRedis?: Redis,
    @Optional() redisConn?: RedisConnectionProvider,
  ) {
    // 테스트 주입 우선, 아니면 공유 command connection, 미가용 시 null (fail-open).
    this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;
  }

  /**
   * inbound update 1건을 per-chat 분당 윈도우에 카운트하고 한도 내인지 반환.
   *
   * @returns `true` = 한도 내(처리 진행) / `false` = 초과(호출자가 skip + degraded).
   *   Redis 미가용·에러 시 `true` (fail-open).
   */
  async consume(
    triggerId: string,
    conversationKey: string,
    limitPerMinute: number,
  ): Promise<boolean> {
    if (!this.redis) return true; // fail-open
    const key = makeChatRateLimitKey(triggerId, conversationKey);
    try {
      const pipeline = this.redis.pipeline();
      pipeline.incr(key);
      const results = await pipeline.exec();
      if (!results || results.length === 0) return true; // fail-open
      const [incrErr, count] = results[0] as [Error | null, number];
      if (incrErr) throw incrErr;
      // 키가 방금 생성된 첫 증가(=1)일 때만 TTL 설정 (fixed-window 시작).
      if (count === 1) {
        await this.redis.expire(key, CHAT_RATE_LIMIT_WINDOW_SEC);
      }
      return count <= limitPerMinute;
    } catch (err) {
      this.logger.warn(
        `chat-channel rate-limit consume 실패 (fail-open): ${err instanceof Error ? err.message : String(err)}`,
      );
      return true; // fail-open
    }
  }
}
