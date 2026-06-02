/**
 * IdempotencyInterceptor 단위 테스트 (ai-review W-4).
 *
 * 신규 spec — RedisConnectionProvider 주입 경로 검증이 목적이다:
 *  - Redis source 우선순위: injectedRedis > redisConn.getClientOrNull() > null
 *  - 공유 provider 경로(redisConn) 로 캐시 lookup/store 가 동작
 *  - Redis 미가용(null) 시 fail-open passthrough
 *
 * intercept() 의 RxJS 흐름은 lastValueFrom 으로 단발 검증한다.
 */
import { lastValueFrom, of, type Observable } from 'rxjs';
import {
  IdempotencyInterceptor,
  IDEMPOTENCY_HEADER,
} from './idempotency.interceptor';
import type { CallHandler, ExecutionContext } from '@nestjs/common';

type RedisStub = {
  get: jest.Mock;
  set: jest.Mock;
};

function makeRedis(): RedisStub {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  };
}

function makeRedisConn(client: unknown) {
  return {
    getClient: () => client,
    getClientOrNull: () => client,
  };
}

/** ExecutionContext mock — header / body / response status 를 노출. */
function makeContext(opts: {
  idempotencyKey?: string;
  body?: unknown;
  statusCode?: number;
}): ExecutionContext {
  const res = {
    statusCode: opts.statusCode ?? 200,
    status: jest.fn(),
  };
  const req = {
    headers: opts.idempotencyKey
      ? { [IDEMPOTENCY_HEADER]: opts.idempotencyKey }
      : {},
    body: opts.body ?? {},
  };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

function makeCallHandler(value: unknown): CallHandler {
  return {
    handle: (): Observable<unknown> => of(value),
  };
}

describe('IdempotencyInterceptor (W-4 provider 경로)', () => {
  it('injectedRedis 없이 redisConn 주입 → 공유 client 로 캐시 GET 수행', async () => {
    const sharedRedis = makeRedis();
    const interceptor = new IdempotencyInterceptor(
      undefined, // _configService
      undefined, // injectedRedis 없음 — 공유 provider 경로 강제
      makeRedisConn(sharedRedis) as never,
    );
    const ctx = makeContext({ idempotencyKey: 'key-1', body: { a: 1 } });
    const result = await lastValueFrom(
      interceptor.intercept(ctx, makeCallHandler({ ok: true })),
    );
    expect(result).toEqual({ ok: true });
    // 공유 client 로 캐시 lookup 이 발생.
    expect(sharedRedis.get).toHaveBeenCalledWith(
      expect.stringContaining('interaction:idempotency:key-1'),
    );
    // 2xx 응답이므로 캐시 적재(SET) 도 공유 client 로.
    expect(sharedRedis.set).toHaveBeenCalled();
  });

  it('injectedRedis 우선 — 둘 다 주입 시 injectedRedis 사용', async () => {
    const injected = makeRedis();
    const shared = makeRedis();
    const interceptor = new IdempotencyInterceptor(
      undefined,
      injected as never,
      makeRedisConn(shared) as never,
    );
    const ctx = makeContext({ idempotencyKey: 'key-2', body: {} });
    await lastValueFrom(interceptor.intercept(ctx, makeCallHandler({ ok: 1 })));
    expect(injected.get).toHaveBeenCalled();
    expect(shared.get).not.toHaveBeenCalled();
  });

  it('redisConn 이 null 반환(공유 미가용) → fail-open passthrough (캐시 없음)', async () => {
    const interceptor = new IdempotencyInterceptor(
      undefined,
      undefined,
      makeRedisConn(null) as never,
    );
    const ctx = makeContext({ idempotencyKey: 'key-3', body: {} });
    const result = await lastValueFrom(
      interceptor.intercept(ctx, makeCallHandler('passthrough')),
    );
    expect(result).toBe('passthrough');
  });

  it('Idempotency-Key 헤더 없으면 redis 있어도 passthrough (캐시 미적용)', async () => {
    const sharedRedis = makeRedis();
    const interceptor = new IdempotencyInterceptor(
      undefined,
      undefined,
      makeRedisConn(sharedRedis) as never,
    );
    const ctx = makeContext({ body: {} }); // no key
    const result = await lastValueFrom(
      interceptor.intercept(ctx, makeCallHandler('nokey')),
    );
    expect(result).toBe('nokey');
    expect(sharedRedis.get).not.toHaveBeenCalled();
  });
});
