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
  /**
   * 캐시된 응답 JSON 문자열. R8 상 캐시 대상은 2xx·`409`·`410` 이지만 현 구현이 적재하는
   * 것은 2xx~3xx 뿐이다 (`cacheTapped()` docstring 의 선재 결함 설명 참조).
   */
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
   * RxJS operator — 정상 응답을 캐시. status 가 200~399 일 때만 적재.
   *
   * **여기서 구현이 Spec EIA §R8 보다 넓다 — 선재 결함이다.** R8 은 "4xx 중
   * `400 VALIDATION_ERROR` **만** 제외하고 그 외(2xx / `409 Conflict` / `410 Gone`)는
   * 캐시한다" 고 명시하는데, 아래 조건은 `>= 400` 이라 409·410 까지 함께 떨군다.
   * 그만큼 `EIA-RL-02`(동일 키 24h 동일 응답 재현)가 그 범위에서 지켜지지 않는다.
   *
   * 2026-05-21 원본 구현부터 있던 것이고, 이 자리를 타입 전용으로 손댄 PR 에서는 고치지
   * 않았다. 대신 `idempotency.interceptor.spec.ts` 의 **409 캐너리**가 현재 동작을 고정한다 —
   * 조건을 R8 쪽으로 좁히면 그 테스트가 RED 로 알린다.
   * 백로그: `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속.
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
        if (statusCode >= 400) return;
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
      // error 분기는 catch 안 함 — 예외로 끝난 응답은 캐시하지 않는다. `400 VALIDATION_ERROR`
      // 는 R8 이 명시 제외한 대상이라 정합하고, 409·410 이 여기서 함께 빠지는 것은 위
      // docstring 에 적은 선재 결함 쪽이다.
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
