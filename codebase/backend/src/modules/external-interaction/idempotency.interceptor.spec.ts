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
 * optional 이 지탱하는 `typeof` 가드 회귀 고정, 손상 캐시 JSON fallback, 그리고 Spec EIA §R8
 * 의 **캐시 대상 닫힌 목록**(`2xx`·`409`·`410`)을 고정하는 회귀 테스트를 담는다.
 * `409`·`410` 은 **error 채널**로 행사한다 — 서비스가 예외로 던지므로 성공 채널 mock 은
 * 실제로 발생하지 않는 상태를 검사하게 된다(`16_29_45` CRITICAL 의 교훈).
 *
 * 세 번째 describe 는 **Redis 런타임 장애 fail-open** — 조회 실패(`get()` reject)를 캐시
 * 미스로 강등하는 경로, 적재 실패(`set()` reject), 비-`Error` reject, 그리고 그 fail-open 이
 * 409 충돌까지 삼키지 않는지(= `catchError` 가 `switchMap` 앞인지) 고정하는 캐너리를 담는다.
 */
import { createHash } from 'crypto';
import { lastValueFrom, of, throwError, type Observable } from 'rxjs';
import {
  IdempotencyInterceptor,
  IDEMPOTENCY_HEADER,
} from './idempotency.interceptor';
import {
  BadRequestException,
  ConflictException,
  GoneException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
 * **error 채널**로 끝나는 핸들러 — 실제 파이프라인을 재현한다.
 *
 * `interaction.service.ts` 는 409/410 을 `ConflictException`/`GoneException` 으로 **throw**
 * 한다. 성공 채널에 값을 흘리면서 `res.statusCode` 만 409 로 프리셋하는 mock 은 **실제로
 * 발생하지 않는 상태**다 — 컨트롤러가 `@HttpCode(202)` 라 성공 경로의 statusCode 는 202 로
 * 선고정되기 때문이다. 이 헬퍼 없이 쓴 테스트는 vacuous 했다(`16_29_45` CRITICAL).
 */
function makeThrowingHandler(err: unknown): CallHandler {
  return {
    handle: (): Observable<unknown> => throwError(() => err),
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

  it('throw 된 400 VALIDATION_ERROR 는 캐시하지 않는다 (Spec EIA §R8)', async () => {
    // **이 테스트도 error 채널로 행사해야 한다** — 서비스가 `BadRequestException` 을 throw
    // 하므로 성공 채널 mock 은 실제로 발생하지 않는 상태를 검사한다. 종전에는 409·410·5xx·404
    // 만 error 채널로 바꾸고 이 400 만 옛 형태로 남겨 뒀는데, 그 상태에서는
    // `isErrorStatusCacheable` 에 `=== 400` 을 잘못 추가해도 **어떤 테스트도 RED 가 되지
    // 않았다**(`16_53_26` WARNING 실측). 같은 결함 클래스를 자매 자리에 미적용한 것이다.
    const redis = makeRedis();
    const interceptor = makeInterceptor(redis);
    await expect(
      lastValueFrom(
        interceptor.intercept(
          makeContext({ idempotencyKey: 'e-1', body: {}, statusCode: 202 }),
          makeThrowingHandler(
            new BadRequestException({ error: { code: 'VALIDATION_ERROR' } }),
          ),
        ),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('throw 된 409 가 캐시된다 (Spec EIA §R8 — 닫힌 목록)', async () => {
    // `409 STATE_MISMATCH` 는 "이미 다른 명령이 상태를 바꿨다" 는 **확정된 결과**라 같은
    // 키로 재조회하면 같은 답이 나와야 한다(EIA-RL-02).
    //
    // **error 채널로 행사하는 것이 핵심이다** — 서비스가 `ConflictException` 을 throw 하므로
    // 성공 채널 mock 은 실제로 발생하지 않는 상태를 검사한다(`16_29_45` CRITICAL).
    const redis = makeRedis();
    const interceptor = makeInterceptor(redis);
    await expect(
      lastValueFrom(
        interceptor.intercept(
          makeContext({ idempotencyKey: 'c-409', body: {}, statusCode: 202 }),
          makeThrowingHandler(
            new ConflictException({ error: { code: 'STATE_MISMATCH' } }),
          ),
        ),
      ),
    ).rejects.toThrow(ConflictException); // 캐시해도 원 예외는 그대로 나가야 한다

    expect(redis.set).toHaveBeenCalledTimes(1);
    const stored = JSON.parse(redis.set.mock.calls[0][1] as string) as {
      statusCode: number;
      responseJson: string;
    };
    expect(stored.statusCode).toBe(409);
    // 재현에 쓸 body 가 실제 예외 payload 여야 한다.
    expect(JSON.parse(stored.responseJson)).toMatchObject({
      error: { code: 'STATE_MISMATCH' },
    });
  });

  it('throw 된 410 도 캐시된다 (Spec EIA §R8 — 닫힌 목록)', async () => {
    const redis = makeRedis();
    const interceptor = makeInterceptor(redis);
    await expect(
      lastValueFrom(
        interceptor.intercept(
          makeContext({ idempotencyKey: 'c-410', body: {}, statusCode: 202 }),
          makeThrowingHandler(
            new GoneException({ error: { code: 'EXECUTION_TERMINATED' } }),
          ),
        ),
      ),
    ).rejects.toThrow(GoneException);

    expect(redis.set).toHaveBeenCalledTimes(1);
    const stored = JSON.parse(redis.set.mock.calls[0][1] as string) as {
      statusCode: number;
      responseJson: string;
    };
    expect(stored.statusCode).toBe(410);
    // 409 테스트와 동형으로 payload 까지 — 재현에 쓸 body 가 실제 예외 내용이어야 한다.
    expect(JSON.parse(stored.responseJson)).toMatchObject({
      error: { code: 'EXECUTION_TERMINATED' },
    });
  });

  it('캐시된 409 는 재조회 시 **예외로** 재현된다', async () => {
    // 캐시 히트를 성공 응답으로 돌려주면 클라이언트가 202 로 받는다 — 원래 409 였던 것이
    // 200 대로 바뀌는 셈이라 재현이 아니라 **왜곡**이다.
    const body = { a: 1 };
    const redis = makeRedis();
    redis.get.mockResolvedValue(
      JSON.stringify({
        bodyHash: bodyHashOf(body),
        responseJson: JSON.stringify({ error: { code: 'STATE_MISMATCH' } }),
        statusCode: 409,
      }),
    );
    const interceptor = makeInterceptor(redis);
    const handler = makeCallHandler({ fresh: true });
    const handleSpy = jest.spyOn(handler, 'handle');

    await expect(
      lastValueFrom(
        interceptor.intercept(
          makeContext({ idempotencyKey: 'c-409', body }),
          handler,
        ),
      ),
    ).rejects.toMatchObject({ status: 409 });

    // 캐시 재현이므로 downstream 은 돌지 않는다.
    expect(handleSpy).not.toHaveBeenCalled();
  });

  it('캐시된 410 도 재조회 시 **예외로** 재현된다', async () => {
    // 409 만 replay 를 검증하고 410 은 적재까지만 보던 자매 자리 누락을 닫는다
    // (`17_07_45` WARNING). 지금은 둘이 같은 분기를 타지만, 한쪽만 남기는 리팩터가
    // 들어와도 여기서 걸린다.
    const body = { a: 1 };
    const redis = makeRedis();
    redis.get.mockResolvedValue(
      JSON.stringify({
        bodyHash: bodyHashOf(body),
        responseJson: JSON.stringify({
          error: { code: 'EXECUTION_TERMINATED' },
        }),
        statusCode: 410,
      }),
    );
    const interceptor = makeInterceptor(redis);
    const handler = makeCallHandler({ fresh: true });
    const handleSpy = jest.spyOn(handler, 'handle');

    await expect(
      lastValueFrom(
        interceptor.intercept(
          makeContext({ idempotencyKey: 'c-410', body }),
          handler,
        ),
      ),
    ).rejects.toMatchObject({ status: 410 });

    expect(handleSpy).not.toHaveBeenCalled();
  });

  it('throw 된 5xx(HttpException) 는 캐시하지 않는다 (Spec EIA §R8)', async () => {
    // 일시적 서버 오류를 24h 고정하면 재시도해도 계속 같은 실패를 돌려받아 EIA-RL-02 의
    // 취지와 정반대가 된다.
    //
    // **반드시 `HttpException` 으로 던져야 한다** — 순수 `Error` 를 쓰면 구현의
    // `instanceof HttpException` 가드에 먼저 막혀 `isErrorStatusCacheable` 이 **호출조차
    // 되지 않는다.** 그 상태에서는 판정 함수를 `>= 500` 도 캐시하도록 오염시켜도 아무도
    // 잡지 못했다(`17_07_45` WARNING 실측). 우회 경로로 통과하는 테스트는 검증이 아니다.
    const redis = makeRedis();
    const interceptor = makeInterceptor(redis);
    await expect(
      lastValueFrom(
        interceptor.intercept(
          makeContext({ idempotencyKey: 'e-500', body: {}, statusCode: 202 }),
          makeThrowingHandler(
            new InternalServerErrorException({ error: { code: 'INTERNAL' } }),
          ),
        ),
      ),
    ).rejects.toThrow(InternalServerErrorException);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('`HttpException` 이 아닌 예외는 캐시 판정 자체를 거치지 않는다', async () => {
    // 위 테스트가 가드 **뒤**를 본다면 이건 가드 **앞**을 본다 — 상태코드를 알 수 없는
    // 예외는 적재 후보가 아니다. 원 예외가 그대로 나가는지도 함께 고정한다.
    const redis = makeRedis();
    const interceptor = makeInterceptor(redis);
    await expect(
      lastValueFrom(
        interceptor.intercept(
          makeContext({ idempotencyKey: 'e-raw', body: {}, statusCode: 202 }),
          makeThrowingHandler(new Error('boom')),
        ),
      ),
    ).rejects.toThrow('boom');
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('3xx 는 캐시하지 않는다 — 종전 `< 400` 에서 의도적으로 축소됐다', async () => {
    // 종전 조건 `statusCode >= 400` 은 3xx 를 **캐시했다**. §R8 의 닫힌 목록에 3xx 가 없어
    // 함께 빠졌고, 이 API 는 3xx 를 내지 않으므로 실질 영향은 0 이다. 다만 **조용한 축소로
    // 두지 않으려고** 고정한다 — `< 300` 을 `<= 300` 이나 `< 400` 으로 넓히면 여기서 걸린다.
    const redis = makeRedis();
    const interceptor = makeInterceptor(redis);
    await lastValueFrom(
      interceptor.intercept(
        makeContext({ idempotencyKey: 'r-304', body: {}, statusCode: 304 }),
        makeCallHandler({ notModified: true }),
      ),
    );
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('throw 된 404 도 캐시하지 않는다 — 목록이 닫혀 있다', async () => {
    const redis = makeRedis();
    const interceptor = makeInterceptor(redis);
    await expect(
      lastValueFrom(
        interceptor.intercept(
          makeContext({ idempotencyKey: 'e-404', body: {}, statusCode: 202 }),
          makeThrowingHandler(
            new NotFoundException({ error: { code: 'NOT_FOUND' } }),
          ),
        ),
      ),
    ).rejects.toThrow(NotFoundException);
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
  it('`get()` 이 reject 해도 요청은 통과하고 warn 을 남긴다 (fail-open)', async () => {
    // warn 단언은 SET 경로와의 **대칭**을 위한 것이다 — 응답만 보면 `catchError` 안의
    // `logger.warn` 한 줄을 지워도 그대로 GREEN 이라, 장애가 조용해지는 변경을 못 잡는다.
    // fail-open 은 "요청을 살린다" 와 "장애를 보이게 한다" 가 한 쌍이고, 관측이 빠지면
    // Redis 가 죽은 채로 중복 실행이 도는 구간을 아무도 모른다(plan §후속 의 관측 지표 항목).
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    try {
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
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('cache GET 실패'),
      );
    } finally {
      warnSpy.mockRestore();
    }
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
