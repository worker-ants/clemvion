import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';

import { BusinessMetricsService } from '../../modules/metrics/business-metrics.service';
import { RedisConnectionProvider } from '../redis/redis-connection.provider';
import { withTimeout } from '../utils/with-timeout';

/**
 * Redis 명령 하나를 기다리는 최대 시간(ms). 요청마다 한 번 도는 경로라 짧게 둔다.
 *
 * 공유 연결은 `maxRetriesPerRequest: 3` 이라 Redis 가 응답하지 않으면 명령이 재연결을 기다리며 오래 걸린다.
 * 그동안 모든 요청이 멈추지 않도록 이 시간이 지나면 메모리 저장소로 센다.
 */
export const REDIS_THROTTLER_COMMAND_TIMEOUT_MS = 250;

/**
 * Redis 명령이 실패한 뒤 Redis 를 다시 부르지 않고 메모리 저장소로만 세는 시간(ms).
 *
 * 장애 중에 요청마다 제한 시간을 기다리지 않게 한다. 이 시간이 지나면 다음 요청이 Redis 를 다시 부른다.
 */
export const REDIS_THROTTLER_RETRY_AFTER_FAILURE_MS = 5_000;

/**
 * 요청 수를 세는 키. `key` 는 `ThrottlerGuard` 가 만든 SHA-256 hex 라 IP · 사용자 id 원문이 없다.
 *
 * 두 키를 Lua 스크립트 하나에서 함께 쓰므로 단일 노드 Redis 를 전제한다. Redis Cluster 로 옮기면 두 키가
 * 다른 슬롯에 들어가 스크립트가 CROSSSLOT 으로 실패하고 메모리 저장소로 센다. 그때는 키 규칙(NERV
 * `CLE-ENG-REDIS`)에 해시 태그를 먼저 정한다.
 */
export function throttleHitKey(key: string): string {
  return `throttle:hit:${key}`;
}

/** 한도를 넘은 뒤 차단 중임을 나타내는 키. 값은 차단할 때의 요청 수다. */
export function throttleBlockKey(key: string): string {
  return `throttle:block:${key}`;
}

/**
 * 고정 창 카운터와 차단 상태를 한 번에 판정한다. 원자적으로 돌아야 여러 인스턴스가 같은 키를 동시에
 * 세도 한도를 넘겨 통과시키지 않는다.
 *
 * - 차단 키가 살아 있으면 세지 않고 차단으로 답한다.
 * - `blockDuration <= 0` 이면 차단 상태를 두지 않는다. 창 안에서 한도에 닿은 뒤의 요청은 세지 않고
 *   거절하고, 창이 끝나면 다시 받는다(`@nestjs/throttler` 메모리 저장소와 같다).
 * - 그 밖에는 hit 키를 1 올린다. 창의 첫 요청이면 창 길이(`ttl`)만큼 만료를 건다.
 * - 한도를 넘으면 차단 키를 `blockDuration` 만큼 두고 hit 키를 지운다. 차단이 끝나면 새 창에서 1부터
 *   센다(메모리 저장소의 차단 해제 동작과 같다).
 *
 * 반환은 `{요청 수, 창 남은 ms, 차단 여부(0|1), 차단 남은 ms}` 다.
 */
const INCREMENT_SCRIPT = `
local hitKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local blockTtl = redis.call('PTTL', blockKey)
if blockTtl > 0 then
  return {tonumber(redis.call('GET', blockKey)) or 0, blockTtl, 1, blockTtl}
end

if blockDuration <= 0 then
  local current = tonumber(redis.call('GET', hitKey)) or 0
  if current >= limit then
    local windowTtl = redis.call('PTTL', hitKey)
    if windowTtl < 0 then windowTtl = ttl end
    return {current + 1, windowTtl, 1, windowTtl}
  end
end

local hits = redis.call('INCR', hitKey)
local hitTtl = redis.call('PTTL', hitKey)
if hitTtl < 0 then
  redis.call('PEXPIRE', hitKey, ttl)
  hitTtl = ttl
end

if blockDuration > 0 and hits > limit then
  redis.call('SET', blockKey, hits, 'PX', blockDuration)
  redis.call('DEL', hitKey)
  return {hits, hitTtl, 1, blockDuration}
end

return {hits, hitTtl, 0, 0}
`;

/** `@nestjs/throttler` 가 index 에서 내보내지 않는 저장소 레코드 타입. */
type ThrottlerStorageRecord = Awaited<
  ReturnType<ThrottlerStorage['increment']>
>;

function toSeconds(ms: number): number {
  return Math.ceil(ms / 1000);
}

function parseReply(reply: unknown): ThrottlerStorageRecord {
  if (
    !Array.isArray(reply) ||
    reply.length !== 4 ||
    !reply.every((v) => typeof v === 'number' && Number.isFinite(v))
  ) {
    throw new Error('unexpected throttler script reply');
  }
  const [totalHits, windowMs, blocked, blockMs] = reply as number[];
  return {
    totalHits,
    timeToExpire: toSeconds(windowMs),
    isBlocked: blocked === 1,
    timeToBlockExpire: toSeconds(blockMs),
  };
}

/**
 * 요청 빈도 제한(`ThrottlerModule`)의 저장소. 공유 Redis 에 세서 여러 서버 인스턴스가 한 한도를 나눠 쓴다.
 *
 * Redis 를 쓸 수 없으면 `@nestjs/throttler` 의 메모리 저장소로 센다. 제한은 꺼지지 않고 인스턴스마다
 * 따로 센다. 경우는 셋이다.
 * - Redis 가 설정되지 않았다(공유 연결 `null`). 구성 상태라 지표는 세지 않는다.
 * - Redis 명령이 실패했거나 {@link REDIS_THROTTLER_COMMAND_TIMEOUT_MS} 안에 답하지 않았다. 그 요청을
 *   메모리로 세고 `clemvion.redis.fail_open{component=throttler, reason=incr_failed}` 를 한 번 센다.
 * - 실패 뒤 {@link REDIS_THROTTLER_RETRY_AFTER_FAILURE_MS} 동안. Redis 를 부르지 않아 실패가 아니므로
 *   지표를 세지 않는다.
 *
 * Redis 쪽은 고정 창이다. 창은 그 키의 첫 요청부터 `ttl` 동안이다. 메모리 저장소는 요청마다 `ttl` 뒤에
 * 빠지는 미끄럼 창이라 경계 근처의 허용 수가 조금 다르다.
 *
 * 정본: NERV `CLE-API-CONV-RATE` §7 요청 빈도 제한.
 */
@Injectable()
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnApplicationShutdown
{
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly memory = new ThrottlerStorageService();
  /** 이 시각(epoch ms) 전에는 Redis 를 부르지 않는다. */
  private redisRetryAt = 0;
  /** 마지막 Redis 명령이 실패했고 아직 성공한 명령이 없다. */
  private degraded = false;

  constructor(
    private readonly redisConn: RedisConnectionProvider,
    @Optional() private readonly metrics?: BusinessMetricsService,
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const client = this.redisConn.getClientOrNull();
    if (!client || Date.now() < this.redisRetryAt) {
      return this.memory.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }
    // 실패 뒤 대기가 끝난 첫 요청만 Redis 를 다시 부른다. 그 응답을 기다리는 동안 들어온 요청은 메모리로 센다.
    const probing = this.degraded;
    if (probing) {
      this.redisRetryAt = Date.now() + REDIS_THROTTLER_RETRY_AFTER_FAILURE_MS;
    }
    try {
      const reply = await withTimeout(
        client.eval(
          INCREMENT_SCRIPT,
          2,
          throttleHitKey(key),
          throttleBlockKey(key),
          ttl,
          limit,
          blockDuration,
        ),
        REDIS_THROTTLER_COMMAND_TIMEOUT_MS,
        'throttler redis increment',
      );
      const record = parseReply(reply);
      if (this.degraded) {
        this.degraded = false;
        this.redisRetryAt = 0;
        this.logger.log('요청 빈도 제한을 다시 Redis 로 센다');
      }
      return record;
    } catch (err) {
      // 제한 시간이 지난 뒤 Redis 가 늦게 스크립트를 실행하면 그 요청이 Redis 와 메모리에 한 번씩 세질 수 있다.
      // 한도를 더 빨리 채우는 쪽이라 그대로 둔다.
      this.redisRetryAt = Date.now() + REDIS_THROTTLER_RETRY_AFTER_FAILURE_MS;
      this.metrics?.recordRedisFailOpen('throttler', 'incr_failed');
      // 동시에 실패한 요청마다 경고를 남기지 않도록 장애가 시작될 때와 재시도가 실패할 때만 남긴다.
      if (!this.degraded || probing) {
        this.logger.warn(
          `요청 빈도 제한을 메모리 저장소로 센다(${REDIS_THROTTLER_RETRY_AFTER_FAILURE_MS}ms 뒤 Redis 재시도): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      this.degraded = true;
      return this.memory.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }
  }

  onApplicationShutdown(): void {
    this.memory.onApplicationShutdown();
  }
}
