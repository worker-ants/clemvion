import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';

/** update dedup 키. 테스트가 import 해 문자열 중복 정의를 피한다. */
export const makeChatDedupKey = (
  triggerId: string,
  idempotencyKey: string,
): string => `cc:dedup:${triggerId}:${idempotencyKey}`;

/** [Spec CCH-SE-02] "동일 `update_id` **30초** 안 재도착은 무시". */
export const CHAT_DEDUP_WINDOW_SEC = 30;

/**
 * [Spec CCH-SE-02] — chat-channel inbound update 의 **재도착 억제**.
 *
 * provider 는 webhook 이 2xx 를 못 받으면 같은 update 를 재전송한다(텔레그램·Slack·Discord
 * 공통). 재전송이 그대로 처리되면 사용자의 같은 입력이 **두 번 dispatch** 돼 workflow 가
 * 중복 재개된다.
 *
 * **HTTP 의 `IdempotencyInterceptor` 로는 못 막는다.** chat-channel inbound 는
 * `scope: 'in_process_trusted'` 로 `InteractionService` 를 **직접** 호출하므로(EIA-AU-08)
 * 그 인터셉터를 통과하지 않는다. 그래서 이 자리에 별도 dedup 이 필요하다 —
 * `ChannelUpdate.idempotencyKey`(provider 의 update id)가 이미 그 목적으로 파싱돼 있었으나
 * **읽는 곳이 없어 dead field 였다**.
 *
 * `SET NX EX` 단일 호출이라 원자적이다 — 두 인스턴스가 같은 재전송을 동시에 받아도 하나만
 * 통과한다(rate-limiter 의 INCR+EXPIRE pipeline 과 달리 여기서는 "최초 1회" 자체가 계약).
 *
 * Redis 미가용/에러 시 **fail-open**(중복 억제 포기, 처리 진행) — 같은 모듈의 rate-limiter ·
 * `PublicWebhookQuotaService` 와 동일 정책이다. 방어 기능 부재가 정상 트래픽을 끊는 것보다
 * 낫다. 다만 그 구간에는 중복 처리가 가능하다는 뜻이므로 warn 을 남긴다.
 */
@Injectable()
export class ChatChannelDedupService {
  private readonly logger = new Logger(ChatChannelDedupService.name);
  private readonly redis: Redis | null;

  constructor(
    @Optional()
    @Inject('CHAT_CHANNEL_DEDUP_REDIS')
    injectedRedis?: Redis,
    @Optional() redisConn?: RedisConnectionProvider,
  ) {
    this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;
  }

  /**
   * 이 update 를 **처음 보는가**.
   *
   * @returns `true` = 최초 도착(처리 진행) / `false` = 30초 안 재도착(호출자가 skip).
   *   Redis 미가용·에러 시 `true` (fail-open).
   */
  async claim(triggerId: string, idempotencyKey: string): Promise<boolean> {
    if (!this.redis) return true; // fail-open
    // 빈 키는 dedup 대상이 아니다 — provider 가 update id 를 못 준 경우까지 한 키로 뭉치면
    // 서로 다른 update 가 서로를 지운다. 그 상황에서는 억제 없이 통과가 맞다.
    if (!idempotencyKey) return true;
    try {
      // `SET key 1 EX 30 NX` — 최초 1회만 'OK', 재도착은 null.
      const result = await this.redis.set(
        makeChatDedupKey(triggerId, idempotencyKey),
        '1',
        'EX',
        CHAT_DEDUP_WINDOW_SEC,
        'NX',
      );
      return result === 'OK';
    } catch (err) {
      this.logger.warn(
        `chat-channel update dedup 실패 — fail-open(중복 처리 가능): ${err instanceof Error ? err.message : String(err)}`,
      );
      return true; // fail-open
    }
  }
}
