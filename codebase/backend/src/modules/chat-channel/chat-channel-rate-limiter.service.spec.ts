import { Logger } from '@nestjs/common';
import {
  ChatChannelRateLimiterService,
  makeChatRateLimitKey,
  CHAT_RATE_LIMIT_WINDOW_SEC,
} from './chat-channel-rate-limiter.service';

/**
 * CCH-NF-03 / R-CC-19 — per-chat fixed-window rate-limit 단위 테스트.
 * mock Redis (pipeline().incr().expire(NX).exec()) 로 카운트·fail-open 시나리오 검증.
 */
describe('ChatChannelRateLimiterService', () => {
  const TRIGGER_ID = 'trig-1';
  const CHAT = 'chat-123';
  const LIMIT = 60;
  const KEY = makeChatRateLimitKey(TRIGGER_ID, CHAT);

  /** exec 가 주어진 incr 결과를 반환하는 mock Redis (incr/expire jest.fn 노출). */
  function makeRedis(execResult: unknown) {
    const incr = jest.fn();
    const expire = jest.fn();
    const exec = jest.fn().mockResolvedValue(execResult);
    const pipeline = jest.fn().mockReturnValue({ incr, expire, exec });
    return { redis: { pipeline } as never, incr, expire, exec };
  }

  it('한도 이내(count < limit) → true + 키 INCR + EXPIRE(NX, 60s) 동일 pipeline', async () => {
    const { redis, incr, expire } = makeRedis([
      [null, 1],
      [null, 1],
    ]);
    const svc = new ChatChannelRateLimiterService(redis);
    await expect(svc.consume(TRIGGER_ID, CHAT, LIMIT)).resolves.toBe(true);
    expect(incr).toHaveBeenCalledWith(KEY);
    expect(expire).toHaveBeenCalledWith(KEY, CHAT_RATE_LIMIT_WINDOW_SEC, 'NX');
  });

  it('한도 경계(count === limit) → true', async () => {
    const { redis } = makeRedis([[null, LIMIT]]);
    const svc = new ChatChannelRateLimiterService(redis);
    await expect(svc.consume(TRIGGER_ID, CHAT, LIMIT)).resolves.toBe(true);
  });

  it('한도 초과(count > limit) → false', async () => {
    const { redis } = makeRedis([[null, LIMIT + 1]]);
    const svc = new ChatChannelRateLimiterService(redis);
    await expect(svc.consume(TRIGGER_ID, CHAT, LIMIT)).resolves.toBe(false);
  });

  it('limit clamp — 0/음수 → 최소 1 로 보정 (전체 차단 방지)', async () => {
    const { redis } = makeRedis([[null, 1]]);
    const svc = new ChatChannelRateLimiterService(redis);
    // count=1, limit=0 이지만 clamp(1) → 1<=1 true.
    await expect(svc.consume(TRIGGER_ID, CHAT, 0)).resolves.toBe(true);
  });

  it('Redis 미가용(null) → fail-open(true), pipeline 미호출', async () => {
    const svc = new ChatChannelRateLimiterService();
    await expect(svc.consume(TRIGGER_ID, CHAT, LIMIT)).resolves.toBe(true);
  });

  it('exec null → fail-open(true)', async () => {
    const { redis } = makeRedis(null);
    const svc = new ChatChannelRateLimiterService(redis);
    await expect(svc.consume(TRIGGER_ID, CHAT, LIMIT)).resolves.toBe(true);
  });

  it('exec 빈 배열 → fail-open(true)', async () => {
    const { redis } = makeRedis([]);
    const svc = new ChatChannelRateLimiterService(redis);
    await expect(svc.consume(TRIGGER_ID, CHAT, LIMIT)).resolves.toBe(true);
  });

  it('INCR 결과 에러(incrErr non-null) → fail-open(true)', async () => {
    const { redis } = makeRedis([[new Error('incr boom'), null]]);
    const svc = new ChatChannelRateLimiterService(redis);
    await expect(svc.consume(TRIGGER_ID, CHAT, LIMIT)).resolves.toBe(true);
  });

  it('Redis 에러(exec reject) → fail-open(true)', async () => {
    const redis = {
      pipeline: jest.fn().mockReturnValue({
        incr: jest.fn(),
        expire: jest.fn(),
        exec: jest.fn().mockRejectedValue(new Error('redis down')),
      }),
    } as never;
    const svc = new ChatChannelRateLimiterService(redis);
    await expect(svc.consume(TRIGGER_ID, CHAT, LIMIT)).resolves.toBe(true);
  });
});

/**
 * fail-open 경로가 `clemvion.redis.fail_open` 카운터에 `chat_rate_limit/incr_failed` 로 한 번씩
 * 잡히는지 본다. pipeline 거부와 INCR 결과 오류는 같은 catch 로 모이므로 둘 다 한 번만 센다.
 * exec 가 오류 없이 빈 결과를 돌려준 분기와 Redis 미주입은 장애가 아니라서 세지 않는다.
 */
describe('ChatChannelRateLimiterService — fail-open 관측 (metrics)', () => {
  const TRIGGER_ID = 'trig-1';
  const CHAT = 'chat-123';
  const LIMIT = 60;

  function makeMetrics() {
    return { recordRedisFailOpen: jest.fn() };
  }
  function makeRedis(exec: jest.Mock) {
    return {
      pipeline: jest.fn().mockReturnValue({
        incr: jest.fn(),
        expire: jest.fn(),
        exec,
      }),
    };
  }
  function makeSvc(
    redis: unknown,
    metrics?: { recordRedisFailOpen: jest.Mock },
  ): ChatChannelRateLimiterService {
    return new ChatChannelRateLimiterService(
      redis as never,
      undefined,
      metrics as never,
    );
  }

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['exec 거부', () => jest.fn().mockRejectedValue(new Error('redis down'))],
    [
      'INCR 결과 오류',
      () => jest.fn().mockResolvedValue([[new Error('incr boom'), null]]),
    ],
  ])(
    '%s → chat_rate_limit/incr_failed 1번, fail-open(true) 그대로',
    async (_label, makeExec) => {
      const metrics = makeMetrics();
      const svc = makeSvc(makeRedis(makeExec()), metrics);

      await expect(svc.consume(TRIGGER_ID, CHAT, LIMIT)).resolves.toBe(true);
      expect(metrics.recordRedisFailOpen).toHaveBeenCalledTimes(1);
      expect(metrics.recordRedisFailOpen).toHaveBeenCalledWith(
        'chat_rate_limit',
        'incr_failed',
      );
    },
  );

  it.each([
    ['한도 이내', [[null, 1]]],
    ['한도 초과', [[null, LIMIT + 1]]],
    ['exec null', null],
    ['exec 빈 배열', []],
  ])('%s 는 세지 않는다', async (_label, execResult) => {
    const metrics = makeMetrics();
    const svc = makeSvc(
      makeRedis(jest.fn().mockResolvedValue(execResult)),
      metrics,
    );

    await svc.consume(TRIGGER_ID, CHAT, LIMIT);
    expect(metrics.recordRedisFailOpen).not.toHaveBeenCalled();
  });

  it('Redis 미주입이면 세지 않는다 — 장애가 아니라 미설정이다', async () => {
    const metrics = makeMetrics();
    await expect(
      makeSvc(undefined, metrics).consume(TRIGGER_ID, CHAT, LIMIT),
    ).resolves.toBe(true);
    expect(metrics.recordRedisFailOpen).not.toHaveBeenCalled();
  });

  it('metrics 를 주지 않아도 fail-open 이 죽지 않는다 (optional DI)', async () => {
    const svc = makeSvc(
      makeRedis(jest.fn().mockRejectedValue(new Error('redis down'))),
    );
    await expect(svc.consume(TRIGGER_ID, CHAT, LIMIT)).resolves.toBe(true);
  });
});
