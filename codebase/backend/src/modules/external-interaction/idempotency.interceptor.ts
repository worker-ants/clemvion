import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, of, from } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { createHash } from 'crypto';
import type Redis from 'ioredis';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';
import type { Request } from 'express';

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
 * - `400 VALIDATION_ERROR` 응답은 캐시 제외 — 사용자가 form 수정 후 동일 키로 재제출 가능
 *   ([Spec EIA §R8] / 실행 엔진 §1.3 의 "waiting_for_input 유지" 컨벤션).
 * - 키 미설정 시 캐시 적용 안 함 (옵션).
 *
 * Redis 미가용 시 fail-open + warn 로그 — 멱등성은 클라이언트 측 retry 정책으로 보강해야 함.
 * 이 fail-open 은 **세 경로 모두**에 걸린다: 기동 시 미주입(생성자 null) · 조회 실패
 * (`get()` reject → 캐시 미스로 강등) · 적재 실패(`set()` reject → warn 후 통과).
 * `spec/data-flow/15-external-interaction.md` 의 "Redis … 전 경로 fail-open (warn) —
 * 가용성 우선" 이 그 요구다. 조회 경로는 종전에 빠져 있어 Redis 장애가 곧 요청 실패였다.
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
    const req = context.switchToHttp().getRequest<Request>();
    const rawKey = readKey(req.headers[IDEMPOTENCY_HEADER]);
    if (!rawKey || !this.redis) {
      return next.handle();
    }
    const bodyHash = hashBody(req.body);
    const redisKey = `${REDIS_KEY_PREFIX}${rawKey}`;
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
        if (cachedJson) {
          let cached: IdempotencyEntry;
          try {
            cached = JSON.parse(cachedJson) as IdempotencyEntry;
          } catch {
            // 손상된 캐시 → 무시하고 신규 처리.
            return next
              .handle()
              .pipe(this.cacheTapped(redisKey, bodyHash, context));
          }
          if (cached.bodyHash !== bodyHash) {
            throw new ConflictException({
              error: {
                code: 'IDEMPOTENCY_KEY_CONFLICT',
                message: 'Idempotency-Key 가 이미 다른 body 와 사용되었습니다.',
              },
            });
          }
          // 같은 key + 같은 body — 캐시된 응답 그대로 반환.
          const res = context.switchToHttp().getResponse<HttpResponseLike>();
          if (typeof res.status === 'function') res.status(cached.statusCode);
          return of(JSON.parse(cached.responseJson) as unknown);
        }
        return next
          .handle()
          .pipe(this.cacheTapped(redisKey, bodyHash, context));
      }),
    );
  }

  /**
   * RxJS operator — 응답을 캐시. 대상은 [Spec EIA §R8] 이 **열거한 닫힌 목록**이다:
   * `2xx` · `409 Conflict` · `410 Gone`.
   *
   * `409`·`410` 을 캐시하는 이유는 그것이 **확정된 결과**이기 때문이다 — "이미 다른 명령이
   * 상태를 바꿨다"(`STATE_MISMATCH`) 나 "execution 이 종결됐다"(`EXECUTION_TERMINATED`) 는
   * 사실은 번복되지 않으므로 같은 키로 재조회하면 같은 답이 나와야 한다(`EIA-RL-02`).
   * 반대로 `400 VALIDATION_ERROR` 는 waiting_for_input 이 유지돼 **재제출이 normal flow**
   * 라 캐시하면 stale 에러를 돌려준다(§R8 근거).
   *
   * **단일 비교로 축약하면 안 된다** — `>= 400` 은 `409`·`410` 을 함께 떨궈 그 범위에서
   * `EIA-RL-02` 를 깨뜨리고(2026-05-21 원본부터의 선재 결함, 본 커밋이 해소), `=== 400` 은
   * 반대로 `401`·`404` 같은 다른 4xx 와 `5xx` 를 캐시해 **재시도 자체를 막는다**. 열거를
   * 그대로 옮긴 아래 형태를 유지할 것 — 네 경우 모두 spec 에 회귀 테스트가 있다.
   */
  private cacheTapped(
    redisKey: string,
    bodyHash: string,
    context: ExecutionContext,
  ) {
    return tap({
      next: (value: unknown) => {
        if (!this.redis) return;
        const res = context.switchToHttp().getResponse<HttpResponseLike>();
        const statusCode: number =
          typeof res.statusCode === 'number' ? res.statusCode : 200;
        // §R8 의 열거를 그대로 옮긴 조건. 위 docstring 의 "축약 금지" 참조.
        const isCacheable =
          (statusCode >= 200 && statusCode < 300) ||
          statusCode === 409 ||
          statusCode === 410;
        if (!isCacheable) return;
        const entry: IdempotencyEntry = {
          bodyHash,
          responseJson: JSON.stringify(value ?? null),
          statusCode,
        };
        void this.redis
          .set(redisKey, JSON.stringify(entry), 'EX', TTL_SEC)
          .catch((err) =>
            this.logger.warn(
              `IdempotencyInterceptor cache SET 실패 — fail-open: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
      },
      // error 분기는 catch 안 함 — 예외로 **던져져** 끝난 응답은 캐시하지 않는다.
      // 409·410 이 캐시되는 것은 컨트롤러가 그 상태코드로 **정상 반환**하는 경로이고,
      // 여기(에러 분기)로 오는 것은 그 밖의 실패라 재시도 여지를 남기는 편이 맞다.
    });
  }
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
