import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';

/** 비밀번호 재확인 실패 카운터 키. 사용자마다 하나다. 어느 라우트에서 틀렸든 같은 키를 센다. */
export const makePasswordRecheckFailureKey = (userId: string): string =>
  `auth:password-recheck-failures:${userId}`;

/** 고정 창 길이(초). */
export const PASSWORD_RECHECK_FAILURE_WINDOW_SEC = 60;

/**
 * 창 안에서 허용하는 비밀번호 재확인 실패 수. 이만큼 틀리면 창이 끝날 때까지 비밀번호를 대조하지 않고 429 로 답한다.
 * 라우트마다 거는 `SENSITIVE_ACTION_THROTTLE`(분당 10회)과 같은 값이다. 그 한도는 라우트마다 따로 세서 재확인 라우트가 다섯이면
 * 한 사용자의 추측 예산이 분당 50회가 된다. 이 카운터가 그 예산을 사용자 단위 10회로 묶는다.
 */
export const PASSWORD_RECHECK_FAILURE_LIMIT_PER_MIN = 10;

/**
 * 실패 하나를 세고 센 값을 돌려주는 Lua 스크립트. 첫 실패이거나 키에 TTL 이 없으면 창 길이로 TTL 을 건다.
 * INCR 과 TTL 확인을 한 번에 실행하므로 TTL 없는 키가 남지 않는다. 고정 창이라 이미 TTL 이 있으면 늘리지 않는다.
 * 채팅 채널 서명 검증 실패 카운터(`RECORD_SIGNATURE_FAILURE_LUA`)와 같은 스크립트다.
 */
export const RECORD_PASSWORD_RECHECK_FAILURE_LUA = `
local c = redis.call('INCR', KEYS[1])
if c == 1 or redis.call('TTL', KEYS[1]) == -1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return c
`;

/**
 * 비밀번호 재확인(`AuthService.verifyPasswordForUser`) 실패를 사용자 단위로 센다
 * ([HTTP API 규약 — 요청 빈도 제한](CLE-API-CONV-RATE), NERV Task `CLE-T-CJ7HB1`).
 *
 * 탈취한 액세스 토큰만 가진 사람은 `PASSWORD_INVALID` 응답을 보고 비밀번호를 추측할 수 있다. 라우트별 `@Throttle` 은 라우트마다
 * 따로 세므로 재확인 라우트가 늘수록 추측 예산도 는다. 그래서 실패를 사용자 하나에 묶어 세고, 한도에 닿은 사용자는 창이 끝날 때까지
 * 비밀번호를 대조하지 않는다. 맞힌 시도는 세지 않는다.
 *
 * Redis 가 없거나 오류면 막지 않는다(fail-open). 이때는 라우트별 `@Throttle` 만 남는다. Redis 오류는 경고 로그로만 남긴다.
 * 한 사용자가 한도에 닿으면 그 창에서 한 번 경고 로그를 남긴다.
 */
@Injectable()
export class PasswordRecheckFailureLimiterService {
  private readonly logger = new Logger(
    PasswordRecheckFailureLimiterService.name,
  );
  private readonly redis: Redis | null;

  constructor(
    @Optional()
    @Inject('PASSWORD_RECHECK_FAILURE_REDIS')
    injectedRedis?: Redis,
    @Optional() redisConn?: RedisConnectionProvider,
  ) {
    this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;
  }

  /**
   * 이 사용자가 지금 창에서 한도에 닿았는지 본다. 세지 않는다.
   *
   * @returns 한도에 닿았으면 `true`. Redis 가 없거나 오류면 `false`(fail-open).
   */
  async isBlocked(userId: string): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const raw = await this.redis.get(makePasswordRecheckFailureKey(userId));
      const count = raw === null ? 0 : Number.parseInt(raw, 10);
      return (
        Number.isFinite(count) &&
        count >= PASSWORD_RECHECK_FAILURE_LIMIT_PER_MIN
      );
    } catch (err) {
      this.logger.warn(
        `비밀번호 재확인 실패 한도 조회 실패 (fail-open): ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  /**
   * 비밀번호 재확인 실패 한 건을 센다. 이 실패로 한도에 닿으면 경고 로그를 한 번 남긴다. 오류는 삼킨다.
   */
  async recordFailure(userId: string): Promise<void> {
    if (!this.redis) return;
    try {
      const count = Number(
        await this.redis.eval(
          RECORD_PASSWORD_RECHECK_FAILURE_LUA,
          1,
          makePasswordRecheckFailureKey(userId),
          String(PASSWORD_RECHECK_FAILURE_WINDOW_SEC),
        ),
      );
      if (count !== PASSWORD_RECHECK_FAILURE_LIMIT_PER_MIN) return;
      this.logger.warn(
        `비밀번호 재확인 실패가 한도(${PASSWORD_RECHECK_FAILURE_LIMIT_PER_MIN}회/${PASSWORD_RECHECK_FAILURE_WINDOW_SEC}초)에 닿았다. ` +
          `창이 끝날 때까지 이 사용자의 비밀번호 재확인은 대조 없이 429 로 답한다 (user=${userId})`,
      );
    } catch (err) {
      this.logger.warn(
        `비밀번호 재확인 실패 기록 실패 (fail-open): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
