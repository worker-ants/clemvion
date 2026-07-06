import { HttpException, HttpStatus } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InteractionRateLimitGuard,
  RATE_LIMIT_META,
  type RateLimitBucket,
} from './interaction-rate-limit.guard';
import type { InteractionRateLimiterService } from './interaction-rate-limiter.service';
import type { RateLimitResult } from './interaction-rate-limiter.service';

function makeContext(
  bucket: RateLimitBucket | undefined,
  executionId: string | undefined,
): {
  ctx: ExecutionContext;
  setHeader: jest.Mock;
} {
  const setHeader = jest.fn();
  const handler = (): void => {};
  if (bucket) Reflect.defineMetadata(RATE_LIMIT_META, bucket, handler);
  const ctx = {
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ params: { executionId } }),
      getResponse: () => ({ setHeader }),
    }),
  } as unknown as ExecutionContext;
  return { ctx, setHeader };
}

function makeGuard(result: RateLimitResult): {
  guard: InteractionRateLimitGuard;
  consumeInteract: jest.Mock;
  consumeStatus: jest.Mock;
} {
  const consumeInteract = jest.fn(async () => result);
  const consumeStatus = jest.fn(async () => result);
  const limiter = {
    consumeInteract,
    consumeStatus,
  } as unknown as InteractionRateLimiterService;
  const guard = new InteractionRateLimitGuard(new Reflector(), limiter);
  return { guard, consumeInteract, consumeStatus };
}

describe('InteractionRateLimitGuard', () => {
  it('@RateLimit 미지정 핸들러는 통과 (limiter 미호출)', async () => {
    const { guard, consumeInteract, consumeStatus } = makeGuard({
      allowed: true,
      retryAfterSec: 0,
    });
    const { ctx } = makeContext(undefined, 'exec-1');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(consumeInteract).not.toHaveBeenCalled();
    expect(consumeStatus).not.toHaveBeenCalled();
  });

  it('interact 버킷 — 허용 시 true, consumeInteract 호출', async () => {
    const { guard, consumeInteract } = makeGuard({
      allowed: true,
      retryAfterSec: 0,
    });
    const { ctx } = makeContext('interact', 'exec-1');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(consumeInteract).toHaveBeenCalledWith('exec-1');
  });

  it('status 버킷 — consumeStatus 로 라우팅', async () => {
    const { guard, consumeStatus } = makeGuard({
      allowed: true,
      retryAfterSec: 0,
    });
    const { ctx } = makeContext('status', 'exec-1');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(consumeStatus).toHaveBeenCalledWith('exec-1');
  });

  it('초과 시 429 RATE_LIMITED + Retry-After 헤더', async () => {
    const { guard } = makeGuard({ allowed: false, retryAfterSec: 42 });
    const { ctx, setHeader } = makeContext('interact', 'exec-1');
    let caught: HttpException | undefined;
    try {
      await guard.canActivate(ctx);
    } catch (e) {
      caught = e as HttpException;
    }
    expect(caught).toBeInstanceOf(HttpException);
    expect(caught!.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    const body = caught!.getResponse() as { error: { code: string } };
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '42');
  });

  it('executionId 부재 시 통과 (ParseUUIDPipe 가 형식 검증 담당)', async () => {
    const { guard, consumeInteract } = makeGuard({
      allowed: false,
      retryAfterSec: 10,
    });
    const { ctx } = makeContext('interact', undefined);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(consumeInteract).not.toHaveBeenCalled();
  });
});
