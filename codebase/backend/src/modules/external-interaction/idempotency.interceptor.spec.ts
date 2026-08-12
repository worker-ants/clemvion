/**
 * IdempotencyInterceptor 단위 테스트 (ai-review W-4).
 *
 * 신규 spec — RedisConnectionProvider 주입 경로 검증이 목적이다:
 *  - Redis source 우선순위: injectedRedis > redisConn.getClientOrNull() > null
 *  - 공유 provider 경로(redisConn) 로 캐시 lookup/store 가 동작
 *  - Redis 미가용(null) 시 fail-open passthrough
 *
 * intercept() 의 RxJS 흐름은 lastValueFrom 으로 단발 검증한다.
 *
 * 아래 두 번째 describe 는 **캐시 히트 경로와 응답 형태 방어** — `HttpResponseLike` 의
 * optional 이 지탱하는 `typeof` 가드 회귀 고정, 손상 캐시 JSON fallback, 그리고 Spec EIA
 * §R8 과 어긋난 현재 캐시 제외 범위를 고정하는 캐너리를 담는다.
 */
import { createHash } from 'crypto';
import { lastValueFrom, of, type Observable } from 'rxjs';
import {
  IdempotencyInterceptor,
  IDEMPOTENCY_HEADER,
} from './idempotency.interceptor';
import { ConflictException, Logger } from '@nestjs/common';
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

/**
 * injectedRedis 경로로 인터셉터를 만든다 — 아래 캐시 히트 블록이 반복해 쓰는 형태로,
 * 세 인자 중 redis 만 다르다. 위 W-4 블록은 `redisConn` 주입 우선순위 자체가 검증 대상이라
 * 생성자를 그대로 노출해 둔다(여기로 묶으면 그 테스트가 무엇을 보는지 가려진다).
 */
function makeInterceptor(redis: RedisStub): IdempotencyInterceptor {
  return new IdempotencyInterceptor(undefined, redis as never, undefined);
}

/** 인터셉터의 `hashBody` 와 같은 규칙 — 캐시 엔트리를 손으로 만들 때 쓴다. */
const bodyHashOf = (body: unknown) =>
  createHash('sha256')
    .update(typeof body === 'string' ? body : JSON.stringify(body ?? null))
    .digest('hex');

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
    const interceptor = makeInterceptor(redis);
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
    const interceptor = makeInterceptor(redis);
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

  it('400 VALIDATION_ERROR 는 캐시하지 않는다 (Spec EIA §R8)', async () => {
    const redis = makeRedis();
    const interceptor = makeInterceptor(redis);
    await lastValueFrom(
      interceptor.intercept(
        makeContext({ idempotencyKey: 'e-1', body: {}, statusCode: 400 }),
        makeCallHandler({ error: 'VALIDATION_ERROR' }),
      ),
    );
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('409 도 캐시되지 않는다 — R8 위반 상태를 고정하는 캐너리', async () => {
    // Spec EIA §R8 은 "4xx 중 `400 VALIDATION_ERROR` **만** 제외하고, 그 외
    // (2xx / `409 Conflict` / `410 Gone`) 는 캐시한다" 고 명시한다. 그런데 구현의
    // 제외 조건은 `statusCode >= 400` 이라 409·410 까지 함께 떨군다 — 그만큼
    // EIA-RL-02(동일 키 24h 동일 응답 재현)가 지켜지지 않는다.
    //
    // **선재 결함이다**(2026-05-21 `35ff9c19b` 원본 구현부터). 이 PR 은 lint warning
    // 처분(타입 전용)이라 런타임 동작을 바꾸지 않는 것이 스코프이므로 여기서 고치지
    // 않고, 대신 **현재 동작을 캐너리로 고정**해 둔다. 조건을 R8 에 맞게 좁히면 이
    // 테스트가 RED 가 되고, 그때 이 주석이 무엇을 바꾸는 것인지 알려 준다.
    //
    // 백로그: `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속.
    // 주의: 올바른 조건은 `=== 400` 이 아니다 — R8 은 400 중에서도 VALIDATION_ERROR
    // 를 지목하고 5xx 캐싱 여부는 말하지 않는다. 좁히려면 spec 확인이 먼저다.
    const redis = makeRedis();
    const interceptor = makeInterceptor(redis);
    await lastValueFrom(
      interceptor.intercept(
        makeContext({ idempotencyKey: 'c-409', body: {}, statusCode: 409 }),
        makeCallHandler({ error: 'STATE_MISMATCH' }),
      ),
    );
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('손상된 캐시 JSON → 무시하고 신규 처리 + 정상 적재', async () => {
    // `intercept()` 의 `try { JSON.parse } catch` 분기. 캐시 히트인데 파싱이 깨지는
    // 경우라 위 히트 테스트들과 다른 갈래이고, 실패해도 요청 자체는 살아야 한다
    // (fail-open). 이 분기가 깨지면 캐시 손상이 곧 요청 실패로 번진다.
    const redis = makeRedis();
    redis.get.mockResolvedValue('not-valid-json{');
    const interceptor = makeInterceptor(redis);
    const handler = makeCallHandler({ fresh: true });
    const handleSpy = jest.spyOn(handler, 'handle');

    const result = await lastValueFrom(
      interceptor.intercept(
        makeContext({ idempotencyKey: 'broken-1', body: { a: 1 } }),
        handler,
      ),
    );

    expect(result).toEqual({ fresh: true });
    expect(handleSpy).toHaveBeenCalled(); // downstream 이 실제로 돌았다
    expect(redis.set).toHaveBeenCalledTimes(1); // 손상 항목을 새 응답으로 덮는다
    // 횟수만 보면 `bodyHash` 가 빈 문자열이 돼도 그린이라 저장된 값까지 단언한다 —
    // 손상 항목을 덮어쓰는 자리이므로 새 항목이 온전해야 다음 요청이 히트한다.
    const stored = JSON.parse(redis.set.mock.calls[0][1] as string) as {
      bodyHash: string;
      responseJson: string;
      statusCode: number;
    };
    expect(stored.bodyHash).toBe(bodyHashOf({ a: 1 }));
    expect(stored.statusCode).toBe(200);
    expect(JSON.parse(stored.responseJson)).toEqual({ fresh: true });
  });

  it('`status`/`statusCode` 가 없는 응답에서도 죽지 않고 200 으로 적재한다', async () => {
    // **이 테스트가 `HttpResponseLike` 의 optional 을 지탱한다.** 인터셉터에 express
    // `Response` 를 통째로 박으면 `typeof res.status === 'function'` /
    // `typeof res.statusCode === 'number'` 가 정적으로 항상 참이 되어 방어가 죽은
    // 코드가 되는데, 이 자리는 어댑터(express/fastify)와 테스트 mock 을 가리지 않고
    // 돈다. 형태 없는 응답을 실제로 흘려 그 방어가 살아 있음을 고정한다.
    const redis = makeRedis();
    const interceptor = makeInterceptor(redis);
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
    const interceptor = makeInterceptor(redis);
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

/**
 * Redis 가 **런타임에** 죽었을 때의 fail-open.
 *
 * `spec/data-flow/15-external-interaction.md` 는 "Redis … blacklist · idempotency · seq ·
 * BullMQ. **전 경로 fail-open (warn) — 가용성 우선**" 이라고 명시하고, 이 클래스 docstring
 * 도 "Redis 미가용 시 fail-open" 이라 적는다. 그런데 그 보장은 **생성자 시점 null 체크**
 * (`getClientOrNull()` → null → passthrough)에만 걸려 있었고, 연결이 살아 있다가
 * `get()` 이 reject 하는 경로는 열려 있어 요청이 그대로 500 이 됐다(무수정 프로브로
 * `FAIL-CLOSED — ECONNRESET` 확인). 멱등성은 부가 기능인데 그것 때문에 API 가 죽는 셈이라
 * spec 이 요구한 가용성 우선과 정반대다.
 */
describe('IdempotencyInterceptor (Redis 런타임 장애 fail-open)', () => {
  it('`get()` 이 reject 해도 요청은 통과한다 (fail-open)', async () => {
    const redis = makeRedis();
    redis.get.mockRejectedValue(new Error('ECONNRESET'));
    const interceptor = makeInterceptor(redis);
    const handler = makeCallHandler({ ok: true });
    const handleSpy = jest.spyOn(handler, 'handle');

    const result = await lastValueFrom(
      interceptor.intercept(
        makeContext({ idempotencyKey: 'down-1', body: { a: 1 } }),
        handler,
      ),
    );

    expect(result).toEqual({ ok: true });
    expect(handleSpy).toHaveBeenCalled(); // downstream 이 실제로 돌았다
  });

  it('`get()` 이 reject 하면 캐시 미스로 취급해 새 응답을 적재한다', async () => {
    const redis = makeRedis();
    redis.get.mockRejectedValue(new Error('ECONNRESET'));
    const interceptor = makeInterceptor(redis);

    await lastValueFrom(
      interceptor.intercept(
        makeContext({ idempotencyKey: 'down-2', body: { a: 1 } }),
        makeCallHandler({ ok: true }),
      ),
    );

    // 읽기가 실패했다고 쓰기까지 포기하면 Redis 복구 후에도 그 키는 영영 미스다.
    expect(redis.set).toHaveBeenCalledTimes(1);
    const stored = JSON.parse(redis.set.mock.calls[0][1] as string) as {
      bodyHash: string;
    };
    expect(stored.bodyHash).toBe(bodyHashOf({ a: 1 }));
  });

  it('fail-open 이 409 충돌까지 삼키지 않는다 — catchError 위치 캐너리', async () => {
    // **이 테스트가 fix 의 설계를 고정한다.** fail-open 을 `catchError` 로 넣을 때 그것을
    // `switchMap` **뒤**에 두면 캐시 히트 시 던지는 `ConflictException`(정상 동작)까지
    // 함께 삼켜 **멱등성 충돌 검출이 조용히 죽는다.** `catchError` 는 반드시 `from(get())`
    // 직후·`switchMap` 앞이어야 한다. 위치가 뒤로 가면 이 테스트가 RED 가 된다.
    const redis = makeRedis();
    redis.get.mockResolvedValue(
      JSON.stringify({
        bodyHash: bodyHashOf({ a: 1 }),
        responseJson: JSON.stringify({ cached: true }),
        statusCode: 200,
      }),
    );
    const interceptor = makeInterceptor(redis);

    await expect(
      lastValueFrom(
        interceptor.intercept(
          makeContext({ idempotencyKey: 'down-3', body: { a: 2 } }), // body 불일치
          makeCallHandler({ fresh: true }),
        ),
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('`set()` 이 reject 해도 응답 정상 + warn 로그 (적재 경로 fail-open)', async () => {
    // 클래스 docstring 이 "세 경로 모두 fail-open" 이라 주장하는데 적재 경로만 검증이
    // 없었다 — 주장한 보장은 전부 테스트로 받쳐야 한다.
    //
    // **응답만 단언하면 이 자리를 반만 지킨다** (뮤테이션 2형태 실측):
    //   - `.catch()` **통째 제거** → unhandled rejection 이 jest 를 exit 1 로 만들긴 하지만
    //     요약도 없이 워커가 죽어 무엇이 깨졌는지 안 보인다.
    //   - `.catch(() => {})` 로 **조용히 삼키기** → 응답 단언만으로는 **안 잡힌다.**
    // 그래서 `.catch()` 가 실제로 warn 을 남겼다는 증거를 함께 단언한다 — 후자를 잡고,
    // 전자도 깔끔한 1건 RED 로 바꾼다.
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    try {
      const redis = makeRedis();
      redis.set.mockRejectedValue(new Error('OOM command not allowed'));
      const interceptor = makeInterceptor(redis);

      const result = await lastValueFrom(
        interceptor.intercept(
          makeContext({ idempotencyKey: 'set-fail-1', body: { a: 1 } }),
          makeCallHandler({ ok: true }),
        ),
      );

      expect(result).toEqual({ ok: true });
      expect(redis.set).toHaveBeenCalledTimes(1);
      // `.catch()` 안의 warn 은 마이크로태스크라 한 틱 양보해야 관측된다.
      await Promise.resolve();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('cache SET 실패'),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('비-Error 값으로 reject 해도 로그 조립이 죽지 않는다', async () => {
    // `catchError` 의 `err instanceof Error ? … : String(err)` 중 else 분기. ioredis 가
    // 항상 Error 를 던진다는 보장이 없고, 여기서 죽으면 fail-open 자체가 무너진다.
    const redis = makeRedis();
    redis.get.mockRejectedValue('connection lost');
    const interceptor = makeInterceptor(redis);

    const result = await lastValueFrom(
      interceptor.intercept(
        makeContext({ idempotencyKey: 'nonerr-1', body: { a: 1 } }),
        makeCallHandler({ ok: true }),
      ),
    );

    expect(result).toEqual({ ok: true });
  });
});
