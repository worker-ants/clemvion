import {
  ChatChannelRateLimiterService,
  makeChatRateLimitKey,
  CHAT_RATE_LIMIT_WINDOW_SEC,
} from './chat-channel-rate-limiter.service';

/**
 * CCH-NF-03 / R-CC-19 — per-chat fixed-window rate-limit 단위 테스트.
 * mock Redis (pipeline().incr().exec() → [[null, count]]) 로 카운트 시나리오 검증.
 */
describe('ChatChannelRateLimiterService', () => {
  const TRIGGER_ID = 'trig-1';
  const CHAT = 'chat-123';
  const LIMIT = 60;

  function makeRedis(count: number) {
    const incr = jest.fn();
    const exec = jest.fn().mockResolvedValue([[null, count]]);
    const pipeline = jest.fn().mockReturnValue({ incr, exec });
    const expire = jest.fn().mockResolvedValue(1);
    return { pipeline, expire, _incr: incr, _exec: exec } as unknown as {
      pipeline: jest.Mock;
      expire: jest.Mock;
    };
  }

  it('한도 이내(count <= limit) → true', async () => {
    const redis = makeRedis(1);
    const svc = new ChatChannelRateLimiterService(redis as never);
    await expect(svc.consume(TRIGGER_ID, CHAT, LIMIT)).resolves.toBe(true);
  });

  it('한도 경계(count === limit) → true', async () => {
    const redis = makeRedis(LIMIT);
    const svc = new ChatChannelRateLimiterService(redis as never);
    await expect(svc.consume(TRIGGER_ID, CHAT, LIMIT)).resolves.toBe(true);
  });

  it('한도 초과(count > limit) → false', async () => {
    const redis = makeRedis(LIMIT + 1);
    const svc = new ChatChannelRateLimiterService(redis as never);
    await expect(svc.consume(TRIGGER_ID, CHAT, LIMIT)).resolves.toBe(false);
  });

  it('첫 증가(count === 1) 시에만 EXPIRE(60s) 설정', async () => {
    const redis = makeRedis(1);
    const svc = new ChatChannelRateLimiterService(redis as never);
    await svc.consume(TRIGGER_ID, CHAT, LIMIT);
    expect(redis.expire).toHaveBeenCalledWith(
      makeChatRateLimitKey(TRIGGER_ID, CHAT),
      CHAT_RATE_LIMIT_WINDOW_SEC,
    );

    const redis2 = makeRedis(2);
    const svc2 = new ChatChannelRateLimiterService(redis2 as never);
    await svc2.consume(TRIGGER_ID, CHAT, LIMIT);
    expect(redis2.expire).not.toHaveBeenCalled();
  });

  it('Redis 미가용(null) → fail-open(true)', async () => {
    const svc = new ChatChannelRateLimiterService();
    await expect(svc.consume(TRIGGER_ID, CHAT, LIMIT)).resolves.toBe(true);
  });

  it('Redis 에러 → fail-open(true)', async () => {
    const redis = {
      pipeline: jest.fn().mockReturnValue({
        incr: jest.fn(),
        exec: jest.fn().mockRejectedValue(new Error('redis down')),
      }),
      expire: jest.fn(),
    };
    const svc = new ChatChannelRateLimiterService(redis as never);
    await expect(svc.consume(TRIGGER_ID, CHAT, LIMIT)).resolves.toBe(true);
  });
});
