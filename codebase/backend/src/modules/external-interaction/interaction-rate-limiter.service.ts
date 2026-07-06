import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';

/**
 * Inbound interaction API 의 per-execution rate-limiter (Spec EIA §8.4).
 *
 *   - `/interact` (명령 제출)      execution 당 분당 60
 *   - 단발 status 조회 (`GET`)     execution 당 분당 120
 *
 * 이 세부 한도는 전역 `UserThrottlerGuard`(IP 기준 분당 100) **위에** 얹히는 execution 단위
 * 층이다 — 한 IP 가 여러 execution 을 다뤄도 execution 별로 독립 카운트된다.
 *
 * 구현: Redis fixed-window 카운터 (INCR + 첫 증가 시 EXPIRE). Redis 미가용/오류 시 **fail-open**
 * (허용) — 정당한 인터랙션을 인프라 장애로 깨지 않는다 ([[public-webhook-quota-service]] 와 동일
 * graceful degradation). `RedisConnectionProvider` 는 `@Global RedisModule` 이 export 하므로
 * 별도 import 없이 `@Optional()` 주입 (미가용 시 fail-open).
 *
 * 초과 시 호출부(가드)가 `429 RATE_LIMITED` + `Retry-After` 를 반환한다. `Retry-After` 는 현재
 * 윈도우의 잔여 TTL(초)이며, 이는 SSE 동시연결 초과의 `TOO_MANY_CONNECTIONS` 와는 별개 표면이다.
 *
 * config keys (interaction.rateLimit.*):
 *   interaction.rateLimit.interactPerMinute  기본 60
 *   interaction.rateLimit.statusPerMinute    기본 120
 */
@Injectable()
export class InteractionRateLimiterService {
  private readonly logger = new Logger(InteractionRateLimiterService.name);
  private readonly redis: Redis | null;

  static readonly DEFAULT_INTERACT_PER_MINUTE = 60;
  static readonly DEFAULT_STATUS_PER_MINUTE = 120;

  private readonly interactPerMinute: number;
  private readonly statusPerMinute: number;

  constructor(
    @Optional() configService?: ConfigService,
    @Optional()
    @Inject('INTERACTION_RATE_LIMIT_REDIS')
    injectedRedis?: Redis,
    @Optional() redisConn?: RedisConnectionProvider,
  ) {
    this.interactPerMinute =
      configService?.get<number>('interaction.rateLimit.interactPerMinute') ??
      InteractionRateLimiterService.DEFAULT_INTERACT_PER_MINUTE;
    this.statusPerMinute =
      configService?.get<number>('interaction.rateLimit.statusPerMinute') ??
      InteractionRateLimiterService.DEFAULT_STATUS_PER_MINUTE;

    // 테스트 주입 우선, 아니면 공유 command connection. 미가용 시 null → fail-open.
    this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;
  }

  /** Redis 가용성 여부(관찰/테스트용). */
  isAvailable(): boolean {
    return this.redis !== null;
  }

  /** 현재 한도 설정값(테스트/관찰용). */
  get limits(): { interactPerMinute: number; statusPerMinute: number } {
    return {
      interactPerMinute: this.interactPerMinute,
      statusPerMinute: this.statusPerMinute,
    };
  }

  /** `/interact` 명령 한도(execution 당 분당 60)를 검사·증가. */
  consumeInteract(executionId: string): Promise<RateLimitResult> {
    return this.consume(makeInteractKey(executionId), this.interactPerMinute);
  }

  /** 단발 status 조회 한도(execution 당 분당 120)를 검사·증가. */
  consumeStatus(executionId: string): Promise<RateLimitResult> {
    return this.consume(makeStatusKey(executionId), this.statusPerMinute);
  }

  /**
   * fixed-window 카운터를 원자적으로 증가시키고 한도 초과 여부를 반환한다.
   * Redis 미가용/오류 시 fail-open → `{ allowed: true, retryAfterSec: 0 }`.
   */
  private async consume(key: string, limit: number): Promise<RateLimitResult> {
    if (!this.redis) return { allowed: true, retryAfterSec: 0 };
    try {
      const count = await this.incrWithWindow(key, MINUTE_WINDOW_SEC);
      if (count > limit) {
        // 잔여 윈도우 TTL 을 Retry-After 로 사용. TTL 미확정(-1/-2)이면 전체 윈도우로 보수.
        const ttl = await this.redis.ttl(key);
        return {
          allowed: false,
          retryAfterSec: ttl > 0 ? ttl : MINUTE_WINDOW_SEC,
        };
      }
      return { allowed: true, retryAfterSec: 0 };
    } catch (err) {
      this.logger.warn(
        `InteractionRateLimiterService.consume 실패 — fail-open: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { allowed: true, retryAfterSec: 0 };
    }
  }

  /**
   * INCR 후 첫 증가(count=1)일 때만 EXPIRE 를 걸어 fixed-window 를 구성한다.
   * (PublicWebhookQuotaService.incrWithWindow 와 동일 패턴.)
   */
  private async incrWithWindow(
    key: string,
    windowSec: number,
  ): Promise<number> {
    const count = await this.redis!.incr(key);
    if (count === 1) {
      await this.redis!.expire(key, windowSec);
    }
    return count;
  }

  // 공유 connection 은 RedisConnectionProvider 가 소유·종료 — 본 서비스는 quit 안 함.
}

/** 한도 검사 결과. `retryAfterSec` 는 초과 시 `Retry-After` 헤더 값(초). */
export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

/** fixed-window 초 (60 s). */
export const MINUTE_WINDOW_SEC = 60;

/** `/interact` per-execution 분 키. 테스트에서 import 해 직접 문자열 의존 방지. */
export const makeInteractKey = (executionId: string): string =>
  `eia:rl:interact:${executionId}`;
/** status 조회 per-execution 분 키. */
export const makeStatusKey = (executionId: string): string =>
  `eia:rl:status:${executionId}`;
