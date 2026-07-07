import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';

/**
 * Outbound notification 발송 빈도 감지 — **trigger 당 분당 60건** (Spec EIA §8.4 / §3.1
 * EIA-NX-11).
 *
 * 스펙 의도는 "throttle(폐기)"가 아니라 **폭주 감지 → `notificationHealth=degraded` 표시**다:
 * 초과분도 폐기하지 않고 계속 발송하되, 한도를 넘으면 trigger 를 degraded 로 표시해
 * 사용자가 endpoint 폭주를 인지하게 한다. 따라서 본 서비스는 카운트+초과여부만 반환하고,
 * degraded 표시·발송은 호출부(`NotificationWebhookProcessor`)가 담당한다.
 *
 * 구현: Redis fixed-window 카운터 (`INCR` + `EXPIRE ... NX` 단일 pipeline — 매 요청 함께
 * 보내 TTL 유실 시에도 self-heal, [[public-webhook-quota-service]] 와 동일 패턴). Redis
 * 미가용/오류 시 **fail-open**(초과 아님) — outbound 는 trigger 의 부수 기능이라 인프라 장애로
 * degraded 오탐을 내지 않는다.
 */
@Injectable()
export class OutboundNotificationRateLimiterService {
  private readonly logger = new Logger(
    OutboundNotificationRateLimiterService.name,
  );
  private readonly redis: Redis | null;

  /** trigger 당 분당 outbound 발송 한도 (Spec §8.4). */
  static readonly LIMIT_PER_MINUTE = 60;
  static readonly WINDOW_SEC = 60;

  constructor(
    // `OUTBOUND_NOTIF_RL_REDIS` 토큰은 **프로덕션 provider 에 등록하지 않는다** — 유닛
    // 테스트가 fake Redis 를 주입하기 위한 확장점일 뿐이라 런타임에는 항상 `undefined`
    // 로 해석된다. 실제 연결은 `@Global RedisModule` 이 export 하는 `RedisConnectionProvider`
    // 로 fallback 한다(sibling `InteractionRateLimiterService` 와 동일 패턴). 토큰 미등록은
    // 버그가 아니라 의도된 설계다.
    @Optional()
    @Inject('OUTBOUND_NOTIF_RL_REDIS')
    injectedRedis?: Redis,
    @Optional() redisConn?: RedisConnectionProvider,
  ) {
    this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;
  }

  /** Redis 가용성(관찰/테스트용). */
  isAvailable(): boolean {
    return this.redis !== null;
  }

  /**
   * trigger 의 이번 발송을 카운트하고 분당 한도 초과 여부를 반환한다.
   * Redis 미가용/오류 시 fail-open → `false`(초과 아님).
   */
  async consume(triggerId: string): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const key = makeOutboundKey(triggerId);
      const pipeline = this.redis.pipeline();
      pipeline.incr(key);
      pipeline.expire(
        key,
        OutboundNotificationRateLimiterService.WINDOW_SEC,
        'NX',
      );
      const results = await pipeline.exec();
      if (!results || results.length === 0) return false;
      const [incrErr, count] = results[0] as [Error | null, number];
      if (incrErr) throw incrErr;
      return count > OutboundNotificationRateLimiterService.LIMIT_PER_MINUTE;
    } catch (err) {
      this.logger.warn(
        `OutboundNotificationRateLimiterService.consume 실패 — fail-open: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }
}

/** trigger 당 outbound 발송 분 키. 테스트에서 import 해 직접 문자열 의존 방지. */
export const makeOutboundKey = (triggerId: string): string =>
  `eia:notif:rl:${triggerId}`;
