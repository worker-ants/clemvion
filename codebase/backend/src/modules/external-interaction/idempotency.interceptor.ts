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
import { switchMap, tap } from 'rxjs/operators';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import type { Request } from 'express';

export const IDEMPOTENCY_HEADER = 'idempotency-key';
const REDIS_KEY_PREFIX = 'interaction:idempotency:';
const TTL_SEC = 24 * 60 * 60; // 24h
const MAX_KEY_LENGTH = 200;

interface IdempotencyEntry {
  /** SHA-256 hex of request body. 같은 키 + 다른 body → 409. */
  bodyHash: string;
  /** 캐시된 정상 응답 JSON 문자열 (2xx). 4xx 중 VALIDATION_FAILED 는 캐시 제외 (Spec EIA §R8). */
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
 * - `400 VALIDATION_FAILED` 응답은 캐시 제외 — 사용자가 form 수정 후 동일 키로 재제출 가능
 *   ([Spec EIA §R8] / 실행 엔진 §1.3 의 "waiting_for_input 유지" 컨벤션).
 * - 키 미설정 시 캐시 적용 안 함 (옵션).
 *
 * Redis 미가용 시 fail-open + warn 로그 — 멱등성은 클라이언트 측 retry 정책으로 보강해야 함.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  private readonly redis: Redis | null;

  constructor(
    @Optional() configService?: ConfigService,
    @Optional() @Inject('IDEMPOTENCY_REDIS') injectedRedis?: Redis,
  ) {
    if (injectedRedis) {
      this.redis = injectedRedis;
    } else if (configService) {
      const host = configService.get<string>('redis.host');
      const port = configService.get<number>('redis.port');
      if (host && port) {
        try {
          this.redis = new Redis({
            host,
            port,
            ...(configService.get<string>('redis.password')
              ? { password: configService.get<string>('redis.password') }
              : {}),
            ...(configService.get<boolean>('redis.tls') ? { tls: {} } : {}),
            lazyConnect: true,
            maxRetriesPerRequest: 2,
          });
          this.redis.on('error', (err) => {
            this.logger.warn(
              `IdempotencyInterceptor Redis error — fail-open: ${err.message}`,
            );
          });
        } catch (err) {
          this.logger.warn(
            `IdempotencyInterceptor Redis init 실패 — fail-open: ${err instanceof Error ? err.message : String(err)}`,
          );
          this.redis = null;
        }
      } else {
        this.redis = null;
      }
    } else {
      this.redis = null;
    }
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
          const res = context.switchToHttp().getResponse();
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
   * 4xx 는 캐시 제외 (Spec EIA §R8) — 사용자가 재시도해야 함.
   */
  private cacheTapped(
    redisKey: string,
    bodyHash: string,
    context: ExecutionContext,
  ) {
    return tap({
      next: (value: unknown) => {
        if (!this.redis) return;
        const res = context.switchToHttp().getResponse();
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
      // error 분기는 catch 안 함 — 4xx/5xx 모두 캐시 제외 (특히 400 VALIDATION_FAILED 는 R8 으로 명시 제외).
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
