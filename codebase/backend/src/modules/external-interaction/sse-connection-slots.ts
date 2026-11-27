// 근거: [EIA 데이터와 흐름 「SSE 스트림」](CLE-EIA-DATA#sse-스트림), NERV Task `CLE-T-Z35F7P` · `CLE-T-8PYFDB`.
// 실행별 SSE 연결 상한(모든 서버 인스턴스 합산). `SseFanoutService` 의 한 부분이다.

import { withTimeout } from '../../common/utils/with-timeout';
import type {
  BusinessMetricsService,
  RedisFailOpenReason,
} from '../metrics/business-metrics.service';
import {
  REDIS_WAIT_TIMEOUT_MS,
  type RedisClientRef,
  type SseFanoutHealth,
} from './sse-fanout-shared';
import { sseConnectionSlotsKey } from './sse-redis-keys';
import { SSE_CONNECTION_SLOT_TTL_MS } from './sse.constants';

/**
 * 연결 자리 하나를 원자적으로 잡는다. 오래된 member 를 지우고, 수를 확인하고, 자리가 있으면 더한다.
 * 시각은 서버 인스턴스의 시계로 넘긴다. 인스턴스 사이의 시계 차이가 TTL(45초)보다 훨씬 작다는 전제다.
 *
 * KEYS[1] 연결 상한 키. ARGV 는 지금 시각, 이보다 오래된 점수를 지울 기준 시각, 상한, member, 키 TTL(ms) 순서다.
 * 잡았으면 1, 상한이면 0 을 돌려준다.
 */
export const SSE_ACQUIRE_SLOT_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', '(' .. ARGV[2])
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then
  return 0
end
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[4])
redis.call('PEXPIRE', KEYS[1], ARGV[5])
return 1
`;

/** 실행별 ZSET {@link sseConnectionSlotsKey} 로 센 연결 자리. 실패는 값으로 알리고 던지지 않는다. */
export class SseConnectionSlots {
  constructor(
    private readonly client: RedisClientRef,
    private readonly health: SseFanoutHealth,
    private readonly metrics?: BusinessMetricsService,
  ) {}

  /**
   * 연결 자리를 잡는다. 잡았으면 `true`, 상한이면 `false` 다. Redis 를 쓸 수 없으면 `null` 이고 호출자가 이 서버
   * 인스턴스 안에서 센다.
   */
  async acquire(
    executionId: string,
    subscriberId: string,
    limit: number,
  ): Promise<boolean | null> {
    const client = this.client();
    if (!client) return null;
    const now = Date.now();
    try {
      const acquired = await withTimeout(
        client.eval(
          SSE_ACQUIRE_SLOT_SCRIPT,
          1,
          sseConnectionSlotsKey(executionId),
          now,
          now - SSE_CONNECTION_SLOT_TTL_MS,
          limit,
          subscriberId,
          SSE_CONNECTION_SLOT_TTL_MS,
        ),
        REDIS_WAIT_TIMEOUT_MS,
        'EVAL',
      );
      this.health.recover('연결 상한');
      return Number(acquired) === 1;
    } catch (err) {
      this.degrade('연결 상한', 'slot_failed', err);
      return null;
    }
  }

  /** heartbeat 때 부른다. 잡은 자리의 시각과 키 TTL 을 갱신한다. 실패는 경고만 남긴다. */
  refresh(executionId: string, subscriberId: string): void {
    const client = this.client();
    if (!client) return;
    const key = sseConnectionSlotsKey(executionId);
    client
      .pipeline()
      .zadd(key, Date.now(), subscriberId)
      .pexpire(key, SSE_CONNECTION_SLOT_TTL_MS)
      .exec()
      .then((results) => {
        // pipeline 은 명령 하나가 실패해도 reject 하지 않는다. ZADD 나 PEXPIRE 가 빠지면 살아 있는 연결의 자리가
        // 45초 뒤 사라져 상한이 느슨해지므로 명령별 결과도 본다(버퍼 쓰기와 같은 기준).
        const failure = results
          ? results.find(([err]) => err)?.[0]
          : new Error('pipeline 결과 없음');
        if (failure) {
          this.degrade('연결 상한 갱신', 'slot_failed', failure);
        } else {
          this.health.recover('연결 상한 갱신');
        }
      })
      .catch((err: unknown) =>
        this.degrade('연결 상한 갱신', 'slot_failed', err),
      );
  }

  /** 연결이 끝나면 부른다. 지우지 못해도 TTL 이 지나면 다음 연결 때 지워진다. */
  release(executionId: string, subscriberId: string): void {
    const client = this.client();
    if (!client) return;
    client
      .zrem(sseConnectionSlotsKey(executionId), subscriberId)
      .catch((err: unknown) =>
        this.degrade('연결 상한 해제', 'slot_failed', err),
      );
  }

  /** 카운터를 세고 경고를 남긴다. `reason` 은 호출부마다 리터럴로 넘긴다(라벨 쌍 가드가 같은 파일의 호출부를 읽는다). */
  private degrade(
    op: string,
    reason: RedisFailOpenReason<'sse_fanout'>,
    err: unknown,
  ): void {
    this.metrics?.recordRedisFailOpen('sse_fanout', reason);
    this.health.markDegraded(op, err);
  }
}
