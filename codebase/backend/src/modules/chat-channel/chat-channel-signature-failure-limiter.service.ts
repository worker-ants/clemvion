import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';

/** 서명 검증 실패 카운터 키. 트리거와 클라이언트 IP 쌍마다 하나다. */
export const makeSignatureFailureKey = (
  triggerId: string,
  clientIp: string,
): string => `cc:sigfail:${triggerId}:${clientIp}`;

/** 고정 창 길이(초). */
export const SIGNATURE_FAILURE_WINDOW_SEC = 60;

/** 창 안에서 허용하는 서명 검증 실패 수. 이만큼 실패하면 창이 끝날 때까지 검증 없이 401 로 답한다. */
export const SIGNATURE_FAILURE_LIMIT_PER_MIN = 20;

/**
 * 채팅 채널 인바운드의 서명 검증 실패 한도
 * ([채팅 채널 「인바운드 관문 순서」](CLE-CHAT-CORE#인바운드-관문-순서), NERV Task `CLE-T-ZC34Y0`).
 *
 * 채팅 채널 트리거는 전역 요청 한도에서 빠진다(REQ-CHAT-079). 그러면 위조 서명 요청이 시크릿 조회와
 * 서명 계산을 한도 없이 일으킨다. 그래서 (트리거, 클라이언트 IP) 쌍의 실패를 분당 세고, 한도에 닿은
 * 쌍은 창이 끝날 때까지 검증하지 않고 401 로 돌려보낸다. 정상 프로바이더 요청은 서명이 맞아 세지 않는다.
 *
 * 키에 트리거를 넣는 이유: 프로바이더는 몇 안 되는 발신 IP 를 여러 테넌트가 함께 쓴다. IP 만으로 세면
 * 서명 시크릿을 잘못 넣은 트리거 하나의 실패가 같은 IP 에서 오는 다른 트리거의 정상 요청까지 막는다.
 *
 * Redis 가 없거나 오류면 막지 않는다(fail-open, `ChatChannelRateLimiterService` 와 같다). Redis 오류는
 * 경고 로그로만 남긴다.
 */
@Injectable()
export class ChatChannelSignatureFailureLimiterService {
  private readonly logger = new Logger(
    ChatChannelSignatureFailureLimiterService.name,
  );
  private readonly redis: Redis | null;

  constructor(
    @Optional()
    @Inject('CHAT_CHANNEL_SIGNATURE_FAILURE_REDIS')
    injectedRedis?: Redis,
    @Optional() redisConn?: RedisConnectionProvider,
  ) {
    this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;
  }

  /**
   * 이 쌍이 지금 창에서 한도에 닿았는지 본다. 세지 않는다.
   *
   * @returns 한도에 닿았으면 `true`. Redis 가 없거나 오류면 `false`(fail-open).
   */
  async isBlocked(triggerId: string, clientIp: string): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const raw = await this.redis.get(
        makeSignatureFailureKey(triggerId, clientIp),
      );
      const count = raw === null ? 0 : Number.parseInt(raw, 10);
      return Number.isFinite(count) && count >= SIGNATURE_FAILURE_LIMIT_PER_MIN;
    } catch (err) {
      this.logger.warn(
        `chat-channel 서명 실패 한도 조회 실패 (fail-open): ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  /** 서명 검증 실패 한 건을 센다. 오류는 삼킨다. */
  async recordFailure(triggerId: string, clientIp: string): Promise<void> {
    if (!this.redis) return;
    const key = makeSignatureFailureKey(triggerId, clientIp);
    try {
      // INCR 과 EXPIRE NX 를 한 pipeline 으로 보낸다. 둘 사이에 끊겨 TTL 없는 키가 남아 영구히 막히는 일을
      // 막는다. NX 라 첫 증가에서만 TTL 을 건다(고정 창).
      const pipeline = this.redis.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, SIGNATURE_FAILURE_WINDOW_SEC, 'NX');
      const results = await pipeline.exec();
      const incrErr = results?.[0]?.[0];
      if (incrErr) throw incrErr;
    } catch (err) {
      this.logger.warn(
        `chat-channel 서명 실패 기록 실패 (fail-open): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
