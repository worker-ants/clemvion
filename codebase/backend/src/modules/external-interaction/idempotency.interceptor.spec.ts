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
 * optional 이 지탱하는 `typeof` 가드 회귀 고정, 손상 캐시 fallback(**바깥 엔트리와 안쪽
 * `responseJson` 두 겹** · 각각 warn 을 남기는지 · 안쪽 손상이 **에러 재현 분기에서도** 500 이
 * 되지 않는지 · payload 파싱이 `bodyHash` 판정보다 **뒤**라는 순서 캐너리), **형태 검증**
 * (`isIdempotencyEntry()` — 문법은 유효하지만 엔트리 형태가 아닌 값: `null`·원시값·배열·필드
 * 누락/타입 불일치), 그리고 Spec EIA §R8 의 **캐시 대상 닫힌 목록**(`2xx`·`409`·`410`)을
 * 고정하는 회귀 테스트를 담는다.
 *
 * 형태 검증이 별도 축인 이유는 `JSON.parse` 가 **문법 오류에만** 던지기 때문이다 — `'null'` 은
 * 유효한 JSON 이라 `try/catch` 를 통과한 뒤 필드 접근에서 `TypeError`(→500)를 냈다.
 * `409`·`410` 은 **error 채널**로 행사한다 — 서비스가 예외로 던지므로 성공 채널 mock 은
 * 실제로 발생하지 않는 상태를 검사하게 된다(`16_29_45` CRITICAL 의 교훈).
 *
 * 세 번째 describe 는 **Redis 런타임 장애 fail-open** — 조회 실패(`get()` reject)를 캐시
 * 미스로 강등하는 경로, 적재 실패(`set()` reject), 비-`Error` reject, 그 fail-open 이
 * 409 충돌까지 삼키지 않는지(= `catchError` 가 `switchMap` 앞인지) 고정하는 캐너리, 그리고
 * **직렬화 불가 payload** 가 원 예외를 500 으로 대체하지 않는지(양 채널)를 담는다.
 * 그중 **적재·직렬화가 조용히 실패할 수 있는 4건**(GET 실패 · SET 실패 · 직렬화 실패 양
 * 채널)은 `Logger.prototype.warn` 을 함께 단언한다 — fail-open 은 "요청을 살린다" 와 "장애를
 * 보이게 한다" 가 한 쌍이고, 로그 한 줄이 사라지는 회귀는 응답만 봐서는 안 잡히기 때문이다.
 * 나머지 3건은 각각 다른 것을 본다(캐시 미스 강등 후 재적재 · `catchError` 위치 · 비-`Error`
 * reject 에서 로그 조립이 죽지 않는지)이라 warn 단언을 붙이지 않았다.
 *
 * 네 번째 describe 는 **캐시 키 스코프**(Spec EIA §R8) — 키가 `<executionId>:<route>:<key>` 로
 * 갈리는지를 **execution 축과 route 축 각각** 고정하고, 조회(GET)와 적재(SET)를 **둘 다**
 * 단언한다(한쪽만 스코프하는 회귀가 실제 가능한 형태다). ctx 부재 시 전역 키로 fallback 하지
 * 않고 캐시 자체를 건너뛰는 것도 여기서 고정한다.
 * 다만 이 블록의 `getHandler()` 는 mock 이 만들어 낸 것이라 **실 파이프라인의 route 이름**은
 * 검증할 수 없다 — 그 자리는 e2e `IDEM-5` 다.
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

/** 기본 execution scope — 스코프를 명시하지 않는 테스트가 공유한다. */
const DEFAULT_EXECUTION_ID = 'exec-aaa';
/** 기본 route — 컨트롤러의 `interact` 핸들러명. */
const DEFAULT_ROUTE = 'interact';

/**
 * 인터셉터가 조립할 것으로 기대하는 스코프 키. 테스트가 손으로 문자열을 짜지 않게 한다.
 *
 * **인자 순서는 e2e 의 `idempotencyCacheKey(executionId, rawKey, route)` 와 같다.** 세 인자가
 * 전부 `string` 이라 순서를 뒤집어도 타입이 잡아 주지 못하는데, 두 헬퍼가 서로 반대 순서면
 * 한쪽을 보고 다른 쪽을 쓰는 순간 **조용히 틀린 키를 단언**하게 된다 (`21_02_30` WARNING 1).
 */
function scopedKey(
  executionId: string,
  rawKey: string,
  route: string = DEFAULT_ROUTE,
): string {
  return `interaction:idempotency:${executionId}:${route}:${rawKey}`;
}

/**
 * ExecutionContext mock — header / body / response status / **interaction ctx · route** 를 노출.
 *
 * `responseOverride` 는 `getResponse()` 가 돌려줄 객체를 통째로 갈아끼운다. 두 용도:
 * 호출 인자를 단언하려고 `res` 를 테스트가 직접 쥐어야 할 때, 그리고 `status`/
 * `statusCode` 가 **없는** 응답에서 인터셉터의 `typeof` 방어가 살아 있는지 고정할 때.
 *
 * `executionId: null` 은 **Guard 가 ctx 를 세팅하지 않은 상태**다 (`undefined` 는 "명시 안 함"
 * 이라 기본값이 들어간다 — 두 경우를 갈라야 캐시 skip 경로를 테스트할 수 있다).
 *
 * `getHandler()` 는 **이름이 붙은 진짜 함수**를 돌려준다. `{ name }` 리터럴로 흉내내면
 * `getHandler().name` 이 아닌 다른 경로로 route 를 얻는 회귀를 이 mock 이 덮어 준다.
 */
function makeContext(opts: {
  idempotencyKey?: string;
  body?: unknown;
  statusCode?: number;
  responseOverride?: unknown;
  executionId?: string | null;
  route?: string;
}): ExecutionContext {
  const res = opts.responseOverride ?? {
    statusCode: opts.statusCode ?? 200,
    status: jest.fn(),
  };
  const executionId =
    opts.executionId === undefined ? DEFAULT_EXECUTION_ID : opts.executionId;
  const req = {
    headers: opts.idempotencyKey
      ? { [IDEMPOTENCY_HEADER]: opts.idempotencyKey }
      : {},
    // **`opts.body ?? {}` 를 쓰지 않는다.** 그러면 `body: undefined`·`body: null` 을 명시해도
    // mock 이 `{}` 로 정규화해 인터셉터가 그 경로를 아예 못 본다 — `hashBody` 의 `body ?? null`
    // 을 지워도 테스트가 통과하는 상태였다(뮤테이션 실측). "명시 안 함" 과 "명시적 nullish" 는
    // 다른 입력이므로 키 존재 여부로 가른다.
    body: 'body' in opts ? opts.body : {},
    ...(executionId === null
      ? {}
      : { interaction: { executionId, tokenFamily: 'iext' as const } }),
  };
  const routeName = opts.route ?? DEFAULT_ROUTE;
  const handler = { [routeName]: () => undefined }[routeName];
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
    getHandler: () => handler,
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
    // 공유 client 로 캐시 lookup 이 발생. 키는 **정확히** 스코프 형태여야 한다 —
    // `stringContaining` 으로 두면 스코프 세그먼트가 빠져도 통과한다.
    expect(sharedRedis.get).toHaveBeenCalledWith(
      scopedKey(DEFAULT_EXECUTION_ID, 'key-1'),
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
 *
 * 손상 캐시는 **두 층**으로 본다: 문법(`JSON.parse` 가 던지는 경우)과 **형태**
 * (`isIdempotencyEntry()` — 문법은 유효한데 엔트리가 아닌 값). 후자의 fixture 는 조건을
 * **하나씩만** 위반하도록 짜여 있다 — 여러 개를 한꺼번에 위반하면 가드의 어느 절도 고정되지
 * 않는다(뮤테이션 실측으로 확인한 실패 형태다).
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
    //
    // warn 은 아래 전용 테스트가 단언한다. 여기서 `Logger.warn` 을 mock 하는 것은 그 경로가
    // 이제 warn 을 남기기 때문 — 안 하면 테스트 실행 중 실제 로그가 콘솔로 샌다.
    // **`try/finally` 로 감싼다** — 단언이 실패하면 `mockRestore()` 가 안 돌아 mock 이 뒤
    // 테스트로 샌다. `jest.config.ts` 에 `restoreMocks` 안전망이 없어 이 파일이 스스로 지켜야
    // 하고, 형제 테스트 3건은 이미 이 패턴이다.
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    try {
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
    } finally {
      warnSpy.mockRestore();
    }
  });

  // **fixture 는 조건을 하나씩만 위반해야 한다.** 처음엔 전부 여러 조건을 동시에 위반해서,
  // 세 필드 검사 중 **어느 하나를 지워도 죽는 테스트가 없었다**(뮤테이션 실측). 나머지 검사가
  // 대신 잡아 주기 때문이다 — 매트릭스가 채워져 보여도 각 항은 별도 표면이다.
  // 아래 뒤쪽 세 fixture 는 정확히 한 필드만 타입이 틀리다.
  it.each([
    ['null', 'null', 'null'],
    ['숫자', '42', 'number'],
    ['배열', '[]', 'array'],
    ['문자열', '"str"', 'string'],
    ['필드 누락 객체', '{"bodyHash":"x"}', 'object'],
    [
      'bodyHash 만 타입 불일치',
      '{"bodyHash":1,"responseJson":"{}","statusCode":200}',
      'object',
    ],
    [
      'responseJson 만 타입 불일치',
      '{"bodyHash":"x","responseJson":1,"statusCode":200}',
      'object',
    ],
    [
      'statusCode 만 타입 불일치',
      '{"bodyHash":"x","responseJson":"{}","statusCode":"200"}',
      'object',
    ],
  ])(
    '문법은 유효하지만 엔트리 형태가 아닌 캐시(%s) → 500 이 아니라 신규 처리',
    async (_label, cachedJson, expectedShape) => {
      // **`try/catch` 만으로는 부족했다.** `JSON.parse` 는 **문법 오류에만** 던지므로 이 값들은
      // 전부 통과한 뒤 필드 접근 단계에서 깨진다. 무수정 프로브 실측:
      //
      //   'null'  → TypeError: Cannot read properties of null (reading 'bodyHash') → **500**
      //   '42' · '[]' · '"str"' → 오토박싱으로 `undefined` 비교 → 엉뚱한 **409**
      //
      // `'null'` 은 이 클래스가 없애려는 바로 그 실패 형태(캐시 손상 → 요청 실패)가 좁은 틈으로
      // 남아 있던 것이다. 나머지도 "손상 엔트리는 버리고 신규 처리" 가 맞는 답이라 함께 고정한다.
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      try {
        const redis = makeRedis();
        redis.get.mockResolvedValue(cachedJson);
        const handler = makeCallHandler({ fresh: true });
        const handleSpy = jest.spyOn(handler, 'handle');

        const result = await lastValueFrom(
          makeInterceptor(redis).intercept(
            makeContext({ idempotencyKey: 'shape', body: { a: 1 } }),
            handler,
          ),
        );

        expect(result).toEqual({ fresh: true });
        expect(handleSpy).toHaveBeenCalled();
        expect(redis.set).toHaveBeenCalledTimes(1);
        // 로그가 **어떤 형태였는지**까지 단언한다. `cache 엔트리 손상` 만 보면
        // `describeShape()` 를 상수로 치환해도 통과한다(리뷰어가 뮤테이션으로 실측) —
        // 운영이 원인을 좁히는 데 쓰는 정보라 값 자체를 고정한다. 캐시 payload 는 로그에
        // 싣지 않으므로 이 한 단어가 유일한 단서다.
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            `cache 엔트리 손상 — 무시하고 신규 처리: 형태 불일치 (${expectedShape})`,
          ),
        );
      } finally {
        warnSpy.mockRestore();
      }
    },
  );

  it('엔트리 손상은 조용히 넘어가지 않는다 — warn 을 남긴다', async () => {
    // 위 테스트는 "요청이 산다" 만 본다. fail-open 은 **요청을 살린다 + 장애를 보이게 한다**
    // 가 한 쌍이라, 로그가 사라지는 회귀는 응답만 봐서는 잡히지 않는다. 이 클래스의 다른 세
    // 실패 경로(GET·SET·직렬화)는 이미 warn 을 단언하는데 이 자리만 빠져 있었다.
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    try {
      const redis = makeRedis();
      redis.get.mockResolvedValue('not-valid-json{');

      await lastValueFrom(
        makeInterceptor(redis).intercept(
          makeContext({ idempotencyKey: 'broken-warn', body: {} }),
          makeCallHandler({ fresh: true }),
        ),
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('cache 엔트리 손상'),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('엔트리는 멀쩡한데 안쪽 `responseJson` 이 깨진 경우 → 500 이 아니라 신규 처리', async () => {
    // **선재 갭**: 바깥 JSON 은 `try/catch` 로 막으면서 안쪽 `responseJson` 은 재현 분기
    // 두 자리에서 맨몸으로 파싱했다. 깨져 있으면 그 `SyntaxError` 가 그대로 올라가
    // `GlobalExceptionFilter` 가 **500 으로 마스킹**한다 — 캐시 손상이 요청 실패가 되는 것은
    // 이 인터셉터의 fail-open 원칙과 정반대다.
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    try {
      const body = { a: 1 };
      const redis = makeRedis();
      redis.get.mockResolvedValue(
        JSON.stringify({
          bodyHash: bodyHashOf(body),
          responseJson: 'not-valid-json{', // 안쪽만 깨졌다
          statusCode: 200,
        }),
      );
      const handler = makeCallHandler({ fresh: true });
      const handleSpy = jest.spyOn(handler, 'handle');

      const result = await lastValueFrom(
        makeInterceptor(redis).intercept(
          makeContext({ idempotencyKey: 'inner-broken', body }),
          handler,
        ),
      );

      expect(result).toEqual({ fresh: true });
      expect(handleSpy).toHaveBeenCalled(); // downstream 이 실제로 돌았다
      expect(redis.set).toHaveBeenCalledTimes(1); // 손상 항목을 온전한 것으로 덮는다
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('cache payload 손상'),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('안쪽이 깨졌어도 body 가 다르면 여전히 409 — 판정 순서를 고정한다', async () => {
    // **이 테스트가 파싱 순서를 지탱한다.** payload 파싱을 `bodyHash` 판정보다 앞에 두면
    // 손상된 엔트리에서 409 가 조용히 사라지고, 두 번째 body 가 새 응답을 받는다 —
    // `Idempotency-Key` 재사용 검출이 캐시 손상에 의해 무력화되는 셈이다.
    // payload 가 깨졌든 아니든 "이 키가 이미 다른 body 로 쓰였다" 는 사실은 그대로다.
    const redis = makeRedis();
    redis.get.mockResolvedValue(
      JSON.stringify({
        bodyHash: bodyHashOf({ original: true }),
        responseJson: 'not-valid-json{',
        statusCode: 200,
      }),
    );
    const handler = makeCallHandler({ fresh: true });
    const handleSpy = jest.spyOn(handler, 'handle');

    await expect(
      lastValueFrom(
        makeInterceptor(redis).intercept(
          makeContext({
            idempotencyKey: 'inner-broken-conflict',
            body: { different: true },
          }),
          handler,
        ),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    // 409 로 끝났으므로 downstream 은 돌지 않고 캐시도 덮이지 않는다.
    expect(handleSpy).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('안쪽이 깨진 409 엔트리도 500 이 아니라 신규 처리 — 에러 재현 분기도 같은 방어를 받는다', async () => {
    // **지금은 200 케이스와 같은 코드 라인을 탄다** — payload 파싱을 한 곳으로 끌어올렸기
    // 때문이다. 그래도 남겨 두는 이유는 재분기 회귀 대비다: 재현 경로가 다시 둘로 갈리면
    // (에러 채널 `HttpException` 재throw · 성공 채널 `of()`) 한쪽만 방어하는 형태가 되기
    // 쉽고, 이 세션에서 그 자매 누락이 반복됐다. 통합 이전 모델을 서술하지 않도록 적어 둔다.
    //
    // **단언은 형제 테스트와 동형이어야 한다** — "같은 방어를 받는다" 가 이 테스트의 주장인데
    // 응답만 보면 그 주장을 스스로 증명하지 못한다. 응답이 `{fresh:true}` 인 것은 "방어가
    // 걸렸다" 말고 다른 이유로도 성립할 수 있으므로 warn·재적재까지 함께 본다.
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    try {
      const body = { a: 1 };
      const redis = makeRedis();
      redis.get.mockResolvedValue(
        JSON.stringify({
          bodyHash: bodyHashOf(body),
          responseJson: 'not-valid-json{',
          statusCode: 409, // 에러 재현 분기로 들어가는 상태코드
        }),
      );
      const handler = makeCallHandler({ fresh: true });
      const handleSpy = jest.spyOn(handler, 'handle');

      const result = await lastValueFrom(
        makeInterceptor(redis).intercept(
          makeContext({ idempotencyKey: 'inner-broken-409', body }),
          handler,
        ),
      );

      expect(result).toEqual({ fresh: true });
      expect(handleSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('cache payload 손상'),
      );
      // 손상 항목을 온전한 것으로 덮는다 — 값까지 봐야 다음 요청이 히트한다는 것을 안다.
      expect(redis.set).toHaveBeenCalledTimes(1);
      const stored = JSON.parse(redis.set.mock.calls[0][1] as string) as {
        bodyHash: string;
        responseJson: string;
        statusCode: number;
      };
      expect(stored.bodyHash).toBe(bodyHashOf(body));
      expect(stored.statusCode).toBe(200);
      expect(JSON.parse(stored.responseJson)).toEqual({ fresh: true });
    } finally {
      warnSpy.mockRestore();
    }
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
    // 클래스 docstring 의 fail-open 경로 표(현재 다섯 경로)가 적재 실패도 포함한다고
    // 주장하는데 그 경로만 검증이 없었다 — 주장한 보장은 전부 테스트로 받쳐야 한다.
    // (문구를 그대로 인용하지 않는다. 종전에 "세 경로" 를 인용했다가 docstring 이 다섯으로
    //  갱신되면서 이 주석만 옛 상태로 남았다 — 인용은 원본이 바뀌면 조용히 거짓이 된다.)
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

  it('직렬화 불가 payload 여도 원 예외가 그대로 나간다 (500 으로 대체되지 않는다)', async () => {
    // `storeEntry` 의 `JSON.stringify` 는 `catchError` **셀렉터 안**에서 불린다. 거기서
    // throw 하면 그 새 에러가 원 409 를 **대체**해 클라이언트가 500 을 받고, 이 클래스가
    // 스스로 약속한 "응답을 기록할 뿐 삼키지 않는다" 가 깨진다.
    //
    // 방어(try/catch)를 지난 라운드에 넣고 **테스트는 안 붙였다** — 방어를 만들고 검증을
    // 빠뜨리는 이 세션의 반복 패턴이라 여기서 닫는다(`18_07_36` WARNING).
    //
    // **warn 단언은 형제 테스트(GET/SET 실패)와 같은 이유다** — 응답만 보면 catch 안의
    // `logger.warn` 한 줄을 지워도 GREEN 이라 "적재가 조용히 실패하는" 회귀를 못 잡는다.
    // 이 파일의 다른 fail-open 테스트는 전부 그 패턴인데 신규 2건만 빠져 있었다
    // (`18_37_45` WARNING, 뮤테이션 생존 실측).
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    try {
      const circular: Record<string, unknown> = { code: 'STATE_MISMATCH' };
      circular.self = circular; // JSON.stringify 가 TypeError 를 던진다
      const redis = makeRedis();
      const interceptor = makeInterceptor(redis);

      await expect(
        lastValueFrom(
          interceptor.intercept(
            makeContext({
              idempotencyKey: 'circ-1',
              body: {},
              statusCode: 202,
            }),
            makeThrowingHandler(new ConflictException(circular)),
          ),
        ),
      ).rejects.toThrow(ConflictException); // 500 이 아니라 원 예외

      // 적재만 포기한다 — 그리고 그 사실이 로그에 남아야 한다.
      expect(redis.set).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('cache 직렬화 실패'),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('성공 채널에서도 직렬화 불가 응답이 요청을 죽이지 않는다', async () => {
    // 같은 방어의 자매 자리 — 2xx 경로는 `tap({next})` 라 throw 하면 스트림이 error 로
    // 뒤집혀 정상 응답이 사라진다. 한쪽만 고정하면 다른 쪽이 남는다.
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    try {
      const circular: Record<string, unknown> = { ok: true };
      circular.self = circular;
      const redis = makeRedis();
      const interceptor = makeInterceptor(redis);

      const result = await lastValueFrom(
        interceptor.intercept(
          makeContext({ idempotencyKey: 'circ-2', body: {}, statusCode: 200 }),
          makeCallHandler(circular),
        ),
      );

      expect(result).toBe(circular);
      expect(redis.set).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('cache 직렬화 실패'),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});

/**
 * [Spec EIA §R8 "캐시 키 스코프"] — 캐시 키가 **execution + route** 로 스코프되는지.
 *
 * 종전 키는 `Idempotency-Key` 헤더 값 단독이라 네임스페이스를 **모든 execution 이 공유**했다.
 * 요청자 B 가 자기 execution 에 정당한 토큰으로 A 와 같은 키·같은 body 를 쓰면 캐시 hit 이
 * 되어 B 의 명령이 서비스에 닿지도 않은 채 A 의 응답이 반환된다 — 게다가 B 는 `202 accepted`
 * 를 받으므로 유실을 인지하지 못한다.
 *
 * **두 축을 따로 고정한다.** 한 축만 두면 다른 축이 조용히 열린 채 남는다:
 * - execution 축 — 서로 다른 execution 이 같은 키를 써도 분리되는가
 * - route 축 — 같은 인터셉터가 붙은 `interact`·`cancel` 이 분리되는가
 *   (`CancelDto` 는 전 필드 optional 이라 body `{}` 가 interact 의 `{}` 와 hash 가 같다)
 *
 * 조회(GET)와 적재(SET)를 **둘 다** 단언한다 — 한쪽만 스코프하는 회귀가 실제 가능한 형태다.
 */
describe('IdempotencyInterceptor — 캐시 키 스코프 (Spec EIA §R8)', () => {
  it('execution 축 — 다른 executionId 는 같은 키를 써도 다른 엔트리를 본다', async () => {
    const redisA = makeRedis();
    const redisB = makeRedis();

    await lastValueFrom(
      makeInterceptor(redisA).intercept(
        makeContext({
          idempotencyKey: 'shared-key',
          body: { same: true },
          executionId: 'exec-A',
        }),
        makeCallHandler({ from: 'A' }),
      ),
    );
    await lastValueFrom(
      makeInterceptor(redisB).intercept(
        makeContext({
          idempotencyKey: 'shared-key',
          body: { same: true },
          executionId: 'exec-B',
        }),
        makeCallHandler({ from: 'B' }),
      ),
    );

    expect(redisA.get).toHaveBeenCalledWith(scopedKey('exec-A', 'shared-key'));
    expect(redisB.get).toHaveBeenCalledWith(scopedKey('exec-B', 'shared-key'));
    // 적재도 스코프돼야 한다 — GET 만 스코프하고 SET 이 전역이면 다음 요청이 남의 것을 읽는다.
    expect(redisA.set).toHaveBeenCalledWith(
      scopedKey('exec-A', 'shared-key'),
      expect.any(String),
      'EX',
      expect.any(Number),
    );
    expect(redisB.set).toHaveBeenCalledWith(
      scopedKey('exec-B', 'shared-key'),
      expect.any(String),
      'EX',
      expect.any(Number),
    );
  });

  it('route 축 — 같은 execution 이라도 interact 와 cancel 은 분리된다', async () => {
    const redis = makeRedis();
    const interceptor = makeInterceptor(redis);
    // body 를 동일하게 둔다 — bodyHash 가 같아지므로 route 가 유일한 구분자다.
    const body = {};

    await lastValueFrom(
      interceptor.intercept(
        makeContext({ idempotencyKey: 'k', body, route: 'interact' }),
        makeCallHandler({ ok: 'interact' }),
      ),
    );
    await lastValueFrom(
      interceptor.intercept(
        makeContext({ idempotencyKey: 'k', body, route: 'cancel' }),
        makeCallHandler({ ok: 'cancel' }),
      ),
    );

    const getKeys = redis.get.mock.calls.map((c) => c[0] as string);
    expect(getKeys).toEqual([
      scopedKey(DEFAULT_EXECUTION_ID, 'k', 'interact'),
      scopedKey(DEFAULT_EXECUTION_ID, 'k', 'cancel'),
    ]);
    expect(new Set(getKeys).size).toBe(2);

    // 적재 키도 route 로 갈려야 한다. 이 블록의 docstring 이 "GET·SET 을 둘 다 단언한다" 고
    // 적어 놓고 execution 축 테스트에만 지켜지고 있었다 (`21_02_30` WARNING 2) — 문서한 보장이
    // 실제 단언보다 넓은 상태였다.
    const setKeys = redis.set.mock.calls.map((c) => c[0] as string);
    expect(setKeys).toEqual([
      scopedKey(DEFAULT_EXECUTION_ID, 'k', 'interact'),
      scopedKey(DEFAULT_EXECUTION_ID, 'k', 'cancel'),
    ]);
  });

  it('캐시 hit 재현도 스코프 키로 조회한 엔트리에서만 일어난다', async () => {
    const redis = makeRedis();
    const cachedBody = { replayed: true };
    const body = { a: 1 };
    redis.get.mockImplementation((key: string) =>
      key === scopedKey('exec-owner', 'hit-key')
        ? Promise.resolve(
            JSON.stringify({
              bodyHash: bodyHashOf(body),
              responseJson: JSON.stringify(cachedBody),
              statusCode: 200,
            }),
          )
        : Promise.resolve(null),
    );
    const interceptor = makeInterceptor(redis);

    // 소유 execution — 캐시가 재현된다.
    const owner = await lastValueFrom(
      interceptor.intercept(
        makeContext({
          idempotencyKey: 'hit-key',
          body,
          executionId: 'exec-owner',
        }),
        makeCallHandler({ fresh: true }),
      ),
    );
    expect(owner).toEqual(cachedBody);

    // 다른 execution — 같은 키·같은 body 인데도 캐시를 보지 못하고 핸들러가 돈다.
    const other = await lastValueFrom(
      interceptor.intercept(
        makeContext({
          idempotencyKey: 'hit-key',
          body,
          executionId: 'exec-other',
        }),
        makeCallHandler({ fresh: true }),
      ),
    );
    expect(other).toEqual({ fresh: true });
  });

  it('interaction ctx 부재 → 전역 키 fallback 없이 캐시 자체를 건너뛴다', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    try {
      const redis = makeRedis();
      const interceptor = makeInterceptor(redis);

      const result = await lastValueFrom(
        interceptor.intercept(
          makeContext({
            idempotencyKey: 'no-ctx',
            body: { a: 1 },
            executionId: null, // Guard 가 ctx 를 세팅하지 않은 상태
          }),
          makeCallHandler({ ok: true }),
        ),
      );

      // 요청은 통과한다 (fail-open).
      expect(result).toEqual({ ok: true });
      // 스코프를 못 만들면 **아무 키로도** 캐시하지 않는다 — 전역 키 fallback 은 §R8 이 닫은
      // 표면을 되살리므로, 여기서 `get`/`set` 이 한 번이라도 불리면 회귀다.
      expect(redis.get).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
      // 멱등성을 조용히 포기하지 않는다.
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('interaction ctx 부재'),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});

/**
 * `readKey()` · `hashBody()` **경계값** — 둘 다 module-private 라 `intercept()` 를 통해 본다.
 *
 * 헬퍼를 직접 부르는 테스트는 **호출부 테스트가 아니다.** 헬퍼가 옳아도 `intercept()` 가
 * 반환값을 잘못 쓰면(예: `null` 을 truthy 로 다루면) 갭이 그대로 남는다. 여기서 보는 것은
 * "이 경계에서 **인터셉터가** 어떻게 행동하는가" 다.
 *
 * `readKey` 의 경계는 전부 **fail-open 방향**(키를 못 읽으면 캐시를 아예 안 쓴다)이라
 * 관측점은 `redis.get` 호출 여부다 — 응답만 보면 캐시 미적용과 캐시 미스가 구분되지 않는다.
 */
describe('IdempotencyInterceptor — readKey / hashBody 경계값', () => {
  const key200 = 'k'.repeat(200); // MAX_KEY_LENGTH 경계 (허용)
  const key201 = 'k'.repeat(201); // 한 칸 초과 (거부)

  it('키 길이 상한 — 200자는 쓰고 201자는 캐시 자체를 안 쓴다 (경계 양쪽)', async () => {
    // **양쪽을 한 테스트에서 본다.** 한쪽만 두면 `>=` / `>` 를 뒤집는 off-by-one 이 통과한다.
    const accepted = makeRedis();
    await lastValueFrom(
      makeInterceptor(accepted).intercept(
        makeContext({ idempotencyKey: key200, body: {} }),
        makeCallHandler({ ok: true }),
      ),
    );
    expect(accepted.get).toHaveBeenCalledWith(
      scopedKey(DEFAULT_EXECUTION_ID, key200),
    );

    const rejected = makeRedis();
    const handler = makeCallHandler({ ok: true });
    const handleSpy = jest.spyOn(handler, 'handle');
    const result = await lastValueFrom(
      makeInterceptor(rejected).intercept(
        makeContext({ idempotencyKey: key201, body: {} }),
        handler,
      ),
    );
    expect(result).toEqual({ ok: true }); // 요청은 통과한다 (fail-open)
    expect(handleSpy).toHaveBeenCalled();
    expect(rejected.get).not.toHaveBeenCalled();
    expect(rejected.set).not.toHaveBeenCalled();
  });

  it.each([
    ['공백뿐인 키', '   '],
    ['탭·개행뿐인 키', '\t\n '],
  ])('%s → 캐시 미적용 (trim 후 빈 문자열)', async (_label, rawKey) => {
    const redis = makeRedis();
    const result = await lastValueFrom(
      makeInterceptor(redis).intercept(
        makeContext({ idempotencyKey: rawKey, body: {} }),
        makeCallHandler({ ok: true }),
      ),
    );
    expect(result).toEqual({ ok: true });
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('앞뒤 공백은 trim 된다 — `" k "` 와 `"k"` 가 같은 엔트리를 본다', async () => {
    // trim 이 사라지면 두 요청이 **다른 키**가 되어 멱등성이 조용히 깨진다.
    // 키 문자열을 직접 단언해야 잡힌다 — 응답만 보면 둘 다 정상이다.
    const redis = makeRedis();
    await lastValueFrom(
      makeInterceptor(redis).intercept(
        makeContext({ idempotencyKey: '  spaced  ', body: {} }),
        makeCallHandler({ ok: true }),
      ),
    );
    expect(redis.get).toHaveBeenCalledWith(
      scopedKey(DEFAULT_EXECUTION_ID, 'spaced'),
    );
  });

  it('헤더가 배열이면(중복 전송) 캐시 미적용 — express 는 중복 헤더를 string[] 로 준다', async () => {
    // `readKey` 의 `typeof raw !== 'string'` 분기. 실제로 도달하는 경로다: 클라이언트가
    // `Idempotency-Key` 를 두 번 보내면 express 가 배열을 넘긴다. 지금 동작은 "멱등성을
    // 조용히 끄고 통과" 인데, 아무도 고정해 두지 않아 바뀌어도 눈치채지 못한다.
    const redis = makeRedis();
    const ctx = makeContext({ body: {} });
    // makeContext 는 문자열만 받으므로 헤더를 직접 배열로 바꿔 끼운다.
    (
      ctx.switchToHttp().getRequest() as { headers: Record<string, unknown> }
    ).headers[IDEMPOTENCY_HEADER] = ['a', 'b'];

    const result = await lastValueFrom(
      makeInterceptor(redis).intercept(ctx, makeCallHandler({ ok: true })),
    );
    expect(result).toEqual({ ok: true });
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('같은 body 라도 키 순서가 다르면 다른 hash → 409 (문서화된 계약)', async () => {
    // `hashBody` 의 주석이 "키 순서가 다른 동일 의미 객체는 다른 hash 가 되어 의도치 않은
    // 409 발생 가능 — 클라이언트 책임" 이라고 **명시**한다. 문서화된 동작은 테스트로 받쳐야
    // 한다 — 안 그러면 나중에 정규화를 넣어도(계약 변경) 아무도 모른다.
    const redis = makeRedis();
    redis.get.mockResolvedValue(
      JSON.stringify({
        bodyHash: bodyHashOf({ a: 1, b: 2 }),
        responseJson: JSON.stringify({ cached: true }),
        statusCode: 200,
      }),
    );

    await expect(
      lastValueFrom(
        makeInterceptor(redis).intercept(
          makeContext({ idempotencyKey: 'order', body: { b: 2, a: 1 } }),
          makeCallHandler({ fresh: true }),
        ),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('body 가 `undefined` 든 `null` 이든 같은 hash — 둘 다 `"null"` 로 직렬화된다', async () => {
    // `hashBody` 의 `body ?? null`. 이 동등성이 깨지면 body 없는 재요청이 409 가 된다.
    //
    // 종전엔 mock 이 `opts.body ?? {}` 라 **양쪽 다 `{}`** 가 넘어갔다 — 이중으로 vacuous
    // 했고, 뮤테이션(`body ?? null` 제거)이 생존해서야 드러났다. mock 을 `'body' in opts` 로
    // 고쳐 명시적 `undefined`/`null` 이 그대로 전달된다.
    const first = makeRedis();
    await lastValueFrom(
      makeInterceptor(first).intercept(
        makeContext({ idempotencyKey: 'nobody', body: undefined }),
        makeCallHandler({ ok: true }),
      ),
    );
    const second = makeRedis();
    await lastValueFrom(
      makeInterceptor(second).intercept(
        makeContext({ idempotencyKey: 'nobody', body: null }),
        makeCallHandler({ ok: true }),
      ),
    );

    const hashOf = (r: RedisStub) =>
      (JSON.parse(r.set.mock.calls[0][1] as string) as { bodyHash: string })
        .bodyHash;
    expect(hashOf(first)).toBe(hashOf(second));
  });

  it.each([
    ['음수', -1],
    ['0', 0],
    ['범위 밖(600)', 600],
    ['정수 아님', 200.5],
  ])(
    '엔트리의 statusCode 가 HTTP 코드가 아니면(%s) 손상으로 보고 신규 처리',
    async (_label, statusCode) => {
      // `typeof === 'number'` 만 보면 이 값들이 통과해 `res.status(-1)` / `HttpException(_, -1)`
      // 로 흘러가고, express 가 전송 시점에 `RangeError` 를 내 **500** 이 된다 — 손상 엔트리
      // 하나가 요청을 죽이는, 이 클래스가 없애려는 형태 그대로다.
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      try {
        const body = { a: 1 };
        const redis = makeRedis();
        redis.get.mockResolvedValue(
          JSON.stringify({
            bodyHash: bodyHashOf(body),
            responseJson: JSON.stringify({ cached: true }),
            statusCode,
          }),
        );
        const handler = makeCallHandler({ fresh: true });
        const handleSpy = jest.spyOn(handler, 'handle');

        const result = await lastValueFrom(
          makeInterceptor(redis).intercept(
            makeContext({ idempotencyKey: 'bad-status', body }),
            handler,
          ),
        );

        expect(result).toEqual({ fresh: true });
        expect(handleSpy).toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('cache 엔트리 손상'),
        );
      } finally {
        warnSpy.mockRestore();
      }
    },
  );

  it.each([
    ['하한 100', 100],
    ['상한 599', 599],
  ])(
    '유효 범위 경계(%s)는 손상으로 보지 않는다 — 범위 검사가 너무 좁아지는 회귀 방지',
    async (_label, statusCode) => {
      // 위 테스트만 두면 범위를 `=== 200` 으로 좁혀도 통과한다. 경계 양쪽을 함께 고정한다.
      //
      // **긍정 단언으로 본다.** "핸들러가 안 돌았다" 는 부정 단언은 다른 이유로 실패했을 때도
      // 참이라 제3상태를 못 가른다 — 캐시된 payload 가 **실제로 재현되는지**를 본다.
      // `100`·`599` 는 `isErrorStatusCacheable` 밖이라 둘 다 성공 채널로 재현된다(throw 없음).
      const body = { a: 1 };
      const cached = { cached: true };
      const redis = makeRedis();
      redis.get.mockResolvedValue(
        JSON.stringify({
          bodyHash: bodyHashOf(body),
          responseJson: JSON.stringify(cached),
          statusCode,
        }),
      );
      const handler = makeCallHandler({ fresh: true });
      const handleSpy = jest.spyOn(handler, 'handle');

      const result = await lastValueFrom(
        makeInterceptor(redis).intercept(
          makeContext({ idempotencyKey: 'edge-status', body }),
          handler,
        ),
      );

      expect(result).toEqual(cached); // 캐시가 재현됐다 = 손상 처리로 빠지지 않았다
      expect(handleSpy).not.toHaveBeenCalled();
    },
  );
});
