import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, of, from, throwError } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { createHash } from 'crypto';
import type Redis from 'ioredis';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';
import type { RequestWithInteraction } from './interaction.guard';

export const IDEMPOTENCY_HEADER = 'idempotency-key';
const REDIS_KEY_PREFIX = 'interaction:idempotency:';
const TTL_SEC = 24 * 60 * 60; // 24h
const MAX_KEY_LENGTH = 200;

/**
 * `context.switchToHttp().getResponse()` 의 반환 타입. Nest 시그니처가
 * `getResponse<T = any>()` 라 인자를 안 주면 `any` 가 그대로 흘러나온다.
 *
 * 여기에 express `Response` 를 박지 않는 이유: 그러면 아래 `typeof res.status === 'function'`
 * 과 `typeof res.statusCode === 'number'` 가 정적으로 항상 참이 되어 **방어가 죽은 코드**가
 * 된다. 이 인터셉터는 어댑터(express/fastify)와 테스트 mock 을 가리지 않고 도는 자리라
 * 그 방어는 살아 있어야 한다. 그래서 "있으면 이런 모양" 까지만 선언한다 —
 * 두 `typeof` 가 곧 이 타입의 optional 을 좁히는 유일한 수단이다.
 */
interface HttpResponseLike {
  status?: (code: number) => unknown;
  statusCode?: unknown;
}

interface IdempotencyEntry {
  /** SHA-256 hex of request body. 같은 키 + 다른 body → 409. */
  bodyHash: string;
  /** 캐시된 응답 JSON 문자열. 적재 대상은 `2xx`·`409`·`410` ([Spec EIA §R8] 의 닫힌 목록). */
  responseJson: string;
  /** 캐시된 응답의 HTTP 상태 코드. */
  statusCode: number;
}

/**
 * [Spec EIA §3.2 EIA-IN-11 / §R8] — Idempotency-Key 처리.
 *
 * - 클라이언트가 `Idempotency-Key` 헤더를 보내면 첫 응답을 Redis 에 24h 캐시.
 * - 같은 키로 재요청 시 같은 응답을 그대로 재현 (멱등).
 * - 같은 키 + 다른 body 는 `409 Conflict`.
 * - **캐시 키는 `<executionId>:<route>:<key>` 로 스코프** ([Spec EIA §R8] "캐시 키 스코프").
 *   헤더 값 단독으로 키를 만들면 네임스페이스를 모든 execution 이 공유해, 다른 execution 의
 *   응답이 재생되고 그쪽 명령은 서비스에 닿지도 않은 채 `202` 로 유실된다.
 * - `400 VALIDATION_ERROR` 응답은 캐시 제외 — 사용자가 form 수정 후 동일 키로 재제출 가능
 *   ([Spec EIA §R8] / 실행 엔진 §1.3 의 "waiting_for_input 유지" 컨벤션).
 * - 키 미설정 시 캐시 적용 안 함 (옵션).
 *
 * Redis 미가용·캐시 손상 시 fail-open — 멱등성은 클라이언트 측 retry 정책으로 보강해야 함.
 * 이 fail-open 은 **다섯 경로 모두**에 걸리고, **경로 1 을 뺀 넷이 warn 을 남긴다**:
 *
 * | # | 경로 | 처리 | warn |
 * |---|---|---|---|
 * | 1 | 기동 시 미주입 (생성자 `null`) | 캐시 미적용 passthrough | — (설정 상태이지 장애가 아니다) |
 * | 2 | 조회 실패 (`get()` reject) | 캐시 미스로 강등 (`catchError`) | ✓ |
 * | 3 | 적재 실패 (`set()` reject) | 통과 ({@link storeEntry}) | ✓ |
 * | 4 | 직렬화 실패 (순환 참조 등) | 적재만 포기 ({@link storeEntry}) | ✓ |
 * | 5 | 캐시 엔트리·payload 손상 | 무시하고 신규 처리 ({@link discardCorruptEntry}) | ✓ |
 *
 * `spec/data-flow/15-external-interaction.md` 의 "Redis … 전 경로 fail-open (warn) —
 * 가용성 우선" 이 그 요구다. 조회 경로는 종전에 빠져 있어 Redis 장애가 곧 요청 실패였다.
 *
 * > 이 목록은 **개수를 세어 두는 것이 요점**이다. 종전에는 "세 경로" 라고 적혀 있었는데 실제로는
 * > 직렬화 실패가 이미 빠져 있었고, 손상 경로가 더해지며 둘이 더 어긋났다 — 경로를 늘릴 때
 * > 이 표를 함께 갱신하지 않으면 다음 사람이 방어의 범위를 실제보다 좁게 읽는다.
 *
 * **fail-open 의 대가를 분명히 해 둔다** — Redis 장애가 지속되는 동안에는 같은
 * `Idempotency-Key` 로 온 재요청이 전부 캐시 미스로 판정되므로 **중복 억제가 사실상
 * 무력화**되고 다운스트림(execution 생성 등)이 중복 실행될 수 있다. 정상 시에도 GET→SET
 * 이 원자적이지 않아 좁은 창은 있지만, 장애 구간에서는 그 창이 구간 전체로 넓어진다.
 * spec 이 "가용성 우선" 으로 택한 트레이드오프라 여기서 되돌리지 않되, 멱등성이 **보장이
 * 아니라 best-effort** 라는 점은 호출자가 알아야 한다(§EIA-RL-02 는 정상 경로 계약이다).
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  private readonly redis: Redis | null;

  constructor(
    // _configService: DI 파라미터 순서 고정(하위 호환) — Redis 는 redisConn 으로 대체 (INFO-12).
    @Optional() _configService?: ConfigService,
    @Optional() @Inject('IDEMPOTENCY_REDIS') injectedRedis?: Redis,
    @Optional() redisConn?: RedisConnectionProvider,
  ) {
    // Redis: 테스트 주입(injectedRedis) 우선, 아니면 공유 command connection (INFO-12).
    // 미가용(config 누락/장애) 시 null 로 degrade — idempotency fail-open.
    this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestWithInteraction>();
    const rawKey = readKey(req.headers[IDEMPOTENCY_HEADER]);
    if (!rawKey || !this.redis) {
      return next.handle();
    }
    // [Spec EIA §R8 "캐시 키 스코프"] — 키는 헤더 값 단독이 아니라 execution + route 로
    // 스코프한다. `executionId` 는 `InteractionGuard` 가 토큰 검증 후 합성한 값이라
    // 클라이언트가 조작할 수 없다(URL 파라미터 원문을 직접 읽는 것과 다른 점).
    const executionId = req.interaction?.executionId;
    if (!executionId) {
      // **전역 키로 fallback 하지 않는다.** 스코프 없는 키는 캐시 네임스페이스를 전
      // execution 이 공유하게 만들어 §R8 이 닫은 표면을 그대로 되살린다. 멱등성을 포기하는
      // 쪽이 맞다 — 이 인터셉터의 다른 실패 경로(Redis 미주입·GET/SET·직렬화)와 일관된다.
      this.logger.warn(
        'IdempotencyInterceptor — interaction ctx 부재로 캐시 skip (Guard 미적용?). 전역 키 fallback 은 하지 않는다.',
      );
      return next.handle();
    }
    // route 축: 같은 인터셉터가 `interact`·`cancel` 두 자리에 붙는데 `CancelDto` 는 전 필드
    // optional 이라 body `{}` 가 가능하고, 그때 `bodyHash` 가 `{}` 인 interact 요청과 일치한다
    // → cancel 의 ack 가 interact 에 재생된다. 핸들러명이 그 둘을 가르는 값이다.
    //
    // **전제 — 핸들러명이 빌드 후에도 보존된다.** `nest build` 는 순수 tsc 라 minifier 가
    // 없어 성립한다. 번들러/minifier 를 도입하면 두 핸들러명이 함께 뭉개져 이 축이 붕괴할 수
    // 있다(그때도 `executionId` 축은 남는다). e2e `IDEM-5` 가 실 파이프라인에서 이 값을
    // 고정하므로, 그 전제가 깨지면 거기서 RED 가 난다 — 단위 mock 은 `getHandler()` 를 스스로
    // 만들어 내므로 이 자리를 검증하지 못한다.
    const route = context.getHandler().name;
    const bodyHash = hashBody(req.body);
    const redisKey = `${REDIS_KEY_PREFIX}${executionId}:${route}:${rawKey}`;
    return from(this.redis.get(redisKey)).pipe(
      // 캐시 조회 실패는 **캐시 미스로 강등**한다 — 멱등성은 부가 기능인데 Redis 가 죽었다고
      // 요청까지 죽이면 `spec/data-flow/15-external-interaction.md` 의 "Redis … 전 경로
      // fail-open (warn) — 가용성 우선" 과 정반대가 된다. 종전에는 생성자 시점 null 만
      // 막고 런타임 reject 는 그대로 흘려 요청이 500 이 됐다.
      //
      // **위치 주의 — `switchMap` 앞이어야 한다.** 뒤에 두면 아래에서 캐시 충돌 시 던지는
      // `ConflictException`(정상 동작)까지 삼켜 멱등성 검출이 조용히 죽는다. spec 에
      // 그 자리를 고정하는 캐너리 테스트를 뒀다.
      catchError((err: unknown) => {
        this.logger.warn(
          `IdempotencyInterceptor cache GET 실패 — fail-open: ${err instanceof Error ? err.message : String(err)}`,
        );
        return of(null);
      }),
      switchMap((cachedJson) => {
        // 캐시를 못 쓰는 모든 경우의 공통 처리 — 신규 처리 후 적재. 캐시 미스 · 엔트리 손상 ·
        // payload 손상 세 자리가 같은 동작이라 한 곳에 둔다.
        const processFresh = () =>
          next.handle().pipe(this.cacheTapped(redisKey, bodyHash, context));

        if (!cachedJson) return processFresh();

        let cached: IdempotencyEntry;
        try {
          cached = JSON.parse(cachedJson) as IdempotencyEntry;
        } catch (err) {
          return this.discardCorruptEntry('엔트리', err, processFresh);
        }

        // **bodyHash 판정은 payload 파싱보다 먼저다.** payload 가 깨졌든 아니든 "이 키가 이미
        // 다른 body 로 쓰였다" 는 사실은 그대로다 — 순서를 바꾸면 손상된 엔트리에서 409 가
        // 조용히 사라지고 두 번째 body 가 새 응답을 받는다.
        if (cached.bodyHash !== bodyHash) {
          throw new ConflictException({
            error: {
              code: 'IDEMPOTENCY_KEY_CONFLICT',
              message: 'Idempotency-Key 가 이미 다른 body 와 사용되었습니다.',
            },
          });
        }

        // **엔트리 안쪽 `responseJson` 도 깨질 수 있다.** 종전에는 바깥 JSON 만 `try/catch` 로
        // 막고 이 파싱은 재현 분기 두 자리에서 맨몸으로 했다 — 깨져 있으면 그 `SyntaxError` 가
        // 그대로 올라가 `GlobalExceptionFilter` 가 **500 으로 마스킹**했다. 캐시 손상이 요청
        // 실패가 되는 것은 이 인터셉터의 fail-open 원칙과 반대다. 한 번만 파싱해 그 자리에
        // 방어를 둔다(재현 분기의 `JSON.parse` 중복도 함께 사라진다).
        let cachedPayload: unknown;
        try {
          cachedPayload = JSON.parse(cached.responseJson);
        } catch (err) {
          return this.discardCorruptEntry('payload', err, processFresh);
        }

        // 같은 key + 같은 body — 캐시된 응답 그대로 반환.
        //
        // **`409`·`410` 은 예외로 재현해야 한다.** 그 둘은 애초에 `ConflictException`/
        // `GoneException` 으로 던져져 캐시된 것이라, 성공 채널로 돌려주면 클라이언트가
        // 202 로 받는다 — 재현이 아니라 상태코드 왜곡이다.
        if (isErrorStatusCacheable(cached.statusCode)) {
          throw new HttpException(
            cachedPayload as Record<string, unknown>,
            cached.statusCode,
          );
        }
        const res = context.switchToHttp().getResponse<HttpResponseLike>();
        if (typeof res.status === 'function') res.status(cached.statusCode);
        return of(cachedPayload);
      }),
    );
  }

  /**
   * 손상된 캐시 엔트리를 버리고 신규 처리로 강등한다 — warn 을 남기는 것이 요점이다.
   *
   * **두 호출부의 종전 동작은 서로 달랐다.**
   *
   * - `엔트리`(바깥 JSON): 강등 자체는 하고 있었으나 **가시성 없이** 조용히 넘어갔다.
   * - `payload`(안쪽 `responseJson`): 방어가 아예 없어 `SyntaxError` 가 그대로 올라가
   *   `GlobalExceptionFilter` 가 **500 으로 마스킹**했다 — 캐시 손상이 요청 실패가 됐다.
   *
   * 둘을 여기로 모아 동작(신규 처리)과 가시성(warn)을 같게 맞춘다. fail-open 은 "요청을
   * 살린다" 와 "장애를 보이게 한다" 가 한 쌍인데(이 클래스의 다른 세 경로는 이미 warn 한다),
   * 조용한 강등은 멱등성이 사실상 꺼진 상태와 구분되지 않는다.
   */
  private discardCorruptEntry<T>(
    what: '엔트리' | 'payload',
    err: unknown,
    processFresh: () => T,
  ): T {
    this.logger.warn(
      `IdempotencyInterceptor cache ${what} 손상 — 무시하고 신규 처리: ${err instanceof Error ? err.message : String(err)}`,
    );
    return processFresh();
  }

  /**
   * RxJS operator — 응답을 캐시. 대상은 [Spec EIA §R8] 이 **열거한 닫힌 목록**이다:
   * `2xx` · `409 Conflict` · `410 Gone`.
   *
   * **그 셋이 서로 다른 채널로 온다는 점이 이 operator 의 핵심이다.** `2xx` 는 성공(next)
   * 채널이지만 `409`·`410` 은 `interaction.service.ts` 가 던지는 `ConflictException`/
   * `GoneException` 이라 **error 채널**로 온다. 성공 채널의 `res.statusCode` 는 컨트롤러의
   * `@HttpCode(202)` 로 선고정돼 있어 애초에 409 가 될 수 없다 — 그래서 `tap({ next })`
   * 하나로 `statusCode === 409` 를 보려던 접근은 **도달 불가능한 dead code** 였다
   * (`16_29_45` CRITICAL, 무수정 프로브로 `redis.set=0` 확인).
   */
  private cacheTapped(
    redisKey: string,
    bodyHash: string,
    context: ExecutionContext,
  ) {
    return (source: Observable<unknown>): Observable<unknown> =>
      source.pipe(
        tap({
          next: (value: unknown) => {
            const res = context.switchToHttp().getResponse<HttpResponseLike>();
            const statusCode: number =
              typeof res.statusCode === 'number' ? res.statusCode : 200;
            // 성공 채널에서 오는 것은 `2xx` 뿐이다(컨트롤러가 `@HttpCode(202|200)`).
            // `3xx` 는 이 API 가 내지 않으므로 목록에 없다.
            if (statusCode < 200 || statusCode >= 300) return;
            this.storeEntry(redisKey, bodyHash, statusCode, value ?? null);
          },
        }),
        // **§R8 의 `409`·`410` 은 여기로 온다.** `interaction.service.ts` 가 그 둘을
        // `ConflictException`/`GoneException` 으로 **throw** 하기 때문이다 — 성공 채널의
        // `res.statusCode` 는 `@HttpCode(202)` 로 선고정돼 있어 409 가 될 수 없다.
        // 종전 구현은 `tap({ next })` 뿐이라 이 경로를 아예 보지 못했고, 그래서
        // "409·410 을 캐시한다" 는 조건이 도달 불가능한 dead code 였다(`16_29_45` CRITICAL).
        catchError((err: unknown) => {
          if (err instanceof HttpException) {
            const statusCode = err.getStatus();
            if (isErrorStatusCacheable(statusCode)) {
              this.storeEntry(
                redisKey,
                bodyHash,
                statusCode,
                err.getResponse(),
              );
            }
          }
          // 캐시 여부와 무관하게 원 예외는 그대로 흘려보낸다 — 이 인터셉터는 응답을
          // 기록할 뿐 삼키지 않는다.
          return throwError(() => err);
        }),
      );
  }

  /**
   * 캐시 엔트리 적재 — 실패는 warn 후 통과(fail-open).
   *
   * **직렬화 실패도 삼켜야 한다.** 이 메서드는 `catchError` 셀렉터 안에서도 불리는데, 거기서
   * throw 하면 그 새 에러가 **원래 409/410 예외를 대체**해 클라이언트가 500 을 받는다 —
   * 아래 `throwError(() => err)` 조차 실행되지 못하므로 "응답을 기록할 뿐 삼키지 않는다" 는
   * 이 클래스의 불변식이 깨진다. 순환 참조 같은 직렬화 불가 payload 가 그 방아쇠가 될 수
   * 있어(현재 서비스의 4개 throw 는 전부 plain object 지만 계약이 아니다) 적재만 포기한다.
   */
  private storeEntry(
    redisKey: string,
    bodyHash: string,
    statusCode: number,
    payload: unknown,
  ): void {
    if (!this.redis) return;
    let entry: IdempotencyEntry;
    try {
      entry = {
        bodyHash,
        responseJson: JSON.stringify(payload ?? null),
        statusCode,
      };
    } catch (err) {
      this.logger.warn(
        `IdempotencyInterceptor cache 직렬화 실패 — 적재 skip: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }
    void this.redis
      .set(redisKey, JSON.stringify(entry), 'EX', TTL_SEC)
      .catch((err) =>
        this.logger.warn(
          `IdempotencyInterceptor cache SET 실패 — fail-open: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
  }
}

/**
 * **에러 응답 중** idempotency 캐시 대상인 상태코드 — [Spec EIA §R8] 의 닫힌 목록에서
 * 에러 쪽 두 개다. 성공 쪽(`2xx`)은 별도 분기가 본다.
 *
 * `409 STATE_MISMATCH`·`410 EXECUTION_TERMINATED` 는 **확정된 결과**라 재조회하면 같은 답이
 * 나와야 한다(`EIA-RL-02`). 반대로 `400 VALIDATION_ERROR` 는 재제출이 normal flow 라 캐시하면
 * stale 에러를 주고, `5xx`·그 밖의 `4xx` 는 재시도가 의미 있는 실패라 캐시하면 재시도를 막는다.
 *
 * **단일 비교로 축약하지 말 것** — `>= 400` 은 이 둘을 통째로 떨궈 `EIA-RL-02` 를 깨뜨리고,
 * `=== 400` 은 반대로 `401`·`404`·`5xx` 를 캐시한다. 네 경우 모두 spec 에 회귀 테스트가 있다.
 */
function isErrorStatusCacheable(statusCode: number): boolean {
  return statusCode === 409 || statusCode === 410;
}

function readKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_KEY_LENGTH) return null;
  return trimmed;
}

function hashBody(body: unknown): string {
  // JSON.stringify 의 키 순서 의존성을 그대로 받아들임 — 클라이언트가 같은 body 를 보내면 같은 hash.
  // 키 순서가 다른 동일 의미 객체는 다른 hash 가 되어 의도치 않은 409 발생 가능 — 클라이언트 책임.
  const raw = typeof body === 'string' ? body : JSON.stringify(body ?? null);
  return createHash('sha256').update(raw).digest('hex');
}
