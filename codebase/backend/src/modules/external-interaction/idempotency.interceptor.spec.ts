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
import { createHash } from 'crypto';
import { lastValueFrom, of, type Observable } from 'rxjs';
import {
  IdempotencyInterceptor,
  IDEMPOTENCY_HEADER,
} from './idempotency.interceptor';
import { ConflictException } from '@nestjs/common';
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

/**
 * ExecutionContext mock — header / body / response status 를 노출.
 *
 * `responseOverride` 는 `getResponse()` 가 돌려줄 객체를 통째로 갈아끼운다. 두 용도:
 * 호출 인자를 단언하려고 `res` 를 테스트가 직접 쥐어야 할 때, 그리고 `status`/
 * `statusCode` 가 **없는** 응답에서 인터셉터의 `typeof` 방어가 살아 있는지 고정할 때.
 */
function makeContext(opts: {
  idempotencyKey?: string;
  body?: unknown;
  statusCode?: number;
  responseOverride?: unknown;
}): ExecutionContext {
  const res = opts.responseOverride ?? {
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

/**
 * 캐시 **히트** 경로 + 응답 객체 형태 방어.
 *
 * 위 W-4 스펙 4건은 전부 캐시 **미스** 경로만 돈다(`get` 이 null). 그래서
 * `getResponse()` 로 얻은 응답을 만지는 두 자리 — 히트 시 `res.status(...)` 재생과
 * 적재 시 `res.statusCode` 판독 — 이 한 번도 실행되지 않았다. 그 두 자리가 곧
 * 인터셉터가 `HttpResponseLike` 로 좁힌 지점이라 여기서 함께 고정한다.
 */
describe('IdempotencyInterceptor (캐시 히트 · 응답 형태 방어)', () => {
  const bodyHashOf = (body: unknown) =>
    createHash('sha256')
      .update(typeof body === 'string' ? body : JSON.stringify(body ?? null))
      .digest('hex');

  it('같은 key + 같은 body → 캐시된 응답·상태코드를 그대로 재생한다', async () => {
    const body = { a: 1 };
    const redis = makeRedis();
    redis.get.mockResolvedValue(
      JSON.stringify({
        bodyHash: bodyHashOf(body),
        responseJson: JSON.stringify({ cached: true }),
        statusCode: 201,
      }),
    );
    const res = { statusCode: 200, status: jest.fn() };
    const interceptor = new IdempotencyInterceptor(
      undefined,
      redis as never,
      undefined,
    );
    const handler = makeCallHandler({ fresh: true });
    const handleSpy = jest.spyOn(handler, 'handle');

    const result = await lastValueFrom(
      interceptor.intercept(
        makeContext({ idempotencyKey: 'hit-1', body, responseOverride: res }),
        handler,
      ),
    );

    expect(result).toEqual({ cached: true });
    // 캐시 재생이므로 downstream 핸들러는 아예 돌지 않아야 한다.
    expect(handleSpy).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('같은 key + 다른 body → 409 IDEMPOTENCY_KEY_CONFLICT', async () => {
    const redis = makeRedis();
    redis.get.mockResolvedValue(
      JSON.stringify({
        bodyHash: bodyHashOf({ a: 1 }),
        responseJson: JSON.stringify({ cached: true }),
        statusCode: 200,
      }),
    );
    const interceptor = new IdempotencyInterceptor(
      undefined,
      redis as never,
      undefined,
    );
    await expect(
      lastValueFrom(
        interceptor.intercept(
          // 같은 키인데 body 가 다르다.
          makeContext({ idempotencyKey: 'hit-1', body: { a: 2 } }),
          makeCallHandler({ fresh: true }),
        ),
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('4xx 응답은 캐시하지 않는다 (Spec EIA §R8)', async () => {
    const redis = makeRedis();
    const interceptor = new IdempotencyInterceptor(
      undefined,
      redis as never,
      undefined,
    );
    await lastValueFrom(
      interceptor.intercept(
        makeContext({ idempotencyKey: 'e-1', body: {}, statusCode: 400 }),
        makeCallHandler({ error: 'VALIDATION_ERROR' }),
      ),
    );
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('`status`/`statusCode` 가 없는 응답에서도 죽지 않고 200 으로 적재한다', async () => {
    // **이 테스트가 `HttpResponseLike` 의 optional 을 지탱한다.** 인터셉터에 express
    // `Response` 를 통째로 박으면 `typeof res.status === 'function'` /
    // `typeof res.statusCode === 'number'` 가 정적으로 항상 참이 되어 방어가 죽은
    // 코드가 되는데, 이 자리는 어댑터(express/fastify)와 테스트 mock 을 가리지 않고
    // 돈다. 형태 없는 응답을 실제로 흘려 그 방어가 살아 있음을 고정한다.
    const redis = makeRedis();
    const interceptor = new IdempotencyInterceptor(
      undefined,
      redis as never,
      undefined,
    );
    const result = await lastValueFrom(
      interceptor.intercept(
        makeContext({
          idempotencyKey: 'bare-1',
          body: {},
          responseOverride: {}, // status·statusCode 둘 다 없음
        }),
        makeCallHandler({ ok: true }),
      ),
    );
    expect(result).toEqual({ ok: true });
    expect(redis.set).toHaveBeenCalledTimes(1);
    // statusCode 를 읽을 수 없으면 200 으로 간주해 적재한다(4xx 로 오판해 버리지 않음).
    const stored = JSON.parse(redis.set.mock.calls[0][1] as string) as {
      statusCode: number;
    };
    expect(stored.statusCode).toBe(200);
  });

  it('캐시 히트 재생 시 `status` 가 없는 응답이어도 throw 하지 않는다', async () => {
    const body = { a: 1 };
    const redis = makeRedis();
    redis.get.mockResolvedValue(
      JSON.stringify({
        bodyHash: bodyHashOf(body),
        responseJson: JSON.stringify({ cached: true }),
        statusCode: 201,
      }),
    );
    const interceptor = new IdempotencyInterceptor(
      undefined,
      redis as never,
      undefined,
    );
    const result = await lastValueFrom(
      interceptor.intercept(
        makeContext({
          idempotencyKey: 'bare-2',
          body,
          responseOverride: {}, // status 없음 — 상태코드 재생은 조용히 생략
        }),
        makeCallHandler({ fresh: true }),
      ),
    );
    expect(result).toEqual({ cached: true });
  });
});
