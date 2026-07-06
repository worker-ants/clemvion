import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { InteractionRateLimiterService } from './interaction-rate-limiter.service';

/** rate-limit 버킷 종류 — 라우트 핸들러 메타데이터로 지정. */
export type RateLimitBucket = 'interact' | 'status';

export const RATE_LIMIT_META = 'eia_rate_limit_bucket';

/**
 * 핸들러에 per-execution rate-limit 버킷을 지정한다 (Spec EIA §8.4).
 * 예) `@RateLimit('interact')` → execution 당 분당 60, `@RateLimit('status')` → 분당 120.
 */
export const RateLimit = (bucket: RateLimitBucket): MethodDecorator =>
  SetMetadata(RATE_LIMIT_META, bucket);

/**
 * `@RateLimit(...)` 가 붙은 핸들러에서 `:executionId` per-execution fixed-window 한도를 검사.
 * 초과 시 `429 { error: { code: 'RATE_LIMITED' } }` + `Retry-After` 헤더로 거부한다 —
 * SSE 동시연결 초과의 `TOO_MANY_CONNECTIONS`(§5.2) 와는 별개 표면이다.
 *
 * `InteractionGuard` **뒤에** 배치해 인증된 요청에만 적용한다 (executionId 는 URL param 이라
 * 인증 전에도 얻을 수 있으나, per-execution 한도는 유효 세션 트래픽 억제가 목적).
 * Redis 미가용 시 rate-limiter 가 fail-open 하므로 본 가드도 통과시킨다.
 */
@Injectable()
export class InteractionRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: InteractionRateLimiterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const bucket = this.reflector.get<RateLimitBucket | undefined>(
      RATE_LIMIT_META,
      context.getHandler(),
    );
    if (!bucket) return true; // 한도 미지정 핸들러는 통과

    const req = context.switchToHttp().getRequest<Request>();
    const executionId = (req.params as { executionId?: string }).executionId;
    // executionId 부재 시 통과 — ParseUUIDPipe 가 형식 검증을 담당한다.
    if (!executionId) return true;

    const result =
      bucket === 'interact'
        ? await this.limiter.consumeInteract(executionId)
        : await this.limiter.consumeStatus(executionId);

    if (!result.allowed) {
      const res = context.switchToHttp().getResponse<Response>();
      res.setHeader('Retry-After', String(result.retryAfterSec));
      throw new HttpException(
        {
          error: {
            code: 'RATE_LIMITED',
            message: `요청이 너무 많습니다. ${result.retryAfterSec}초 후 다시 시도해 주세요.`,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
