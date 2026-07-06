import { WsException } from '@nestjs/websockets';
import type { ExecutionContext } from '@nestjs/common';
import { WsRateLimitGuard } from './ws-rate-limit.guard';
import { WsRateLimiterService } from './ws-rate-limiter.service';
import { WsErrorCode } from './ws-error-codes';

function makeCtx(type: 'ws' | 'http', clientId = 'sock-1'): ExecutionContext {
  return {
    getType: () => type,
    switchToWs: () => ({
      getClient: () => ({ id: clientId }),
    }),
  } as unknown as ExecutionContext;
}

describe('WsRateLimitGuard', () => {
  it('한도 이내면 통과(true)', () => {
    const guard = new WsRateLimitGuard(new WsRateLimiterService());
    expect(guard.canActivate(makeCtx('ws'))).toBe(true);
  });

  it('한도 초과 시 WsException(RATE_LIMITED) throw', () => {
    const limiter = new WsRateLimiterService();
    const guard = new WsRateLimitGuard(limiter);
    // 한도까지 소진
    for (let i = 0; i < WsRateLimiterService.LIMIT_PER_MINUTE; i++) {
      guard.canActivate(makeCtx('ws'));
    }
    let caught: WsException | undefined;
    try {
      guard.canActivate(makeCtx('ws'));
    } catch (err) {
      caught = err as WsException;
    }
    expect(caught).toBeInstanceOf(WsException);
    const payload = caught!.getError() as { code: string; message: string };
    expect(payload.code).toBe(WsErrorCode.RATE_LIMITED);
    expect(typeof payload.message).toBe('string');
  });

  it('non-ws 컨텍스트는 rate-limit 미적용(통과)', () => {
    const limiter = new WsRateLimiterService();
    const consumeSpy = jest.spyOn(limiter, 'consume');
    const guard = new WsRateLimitGuard(limiter);
    expect(guard.canActivate(makeCtx('http'))).toBe(true);
    expect(consumeSpy).not.toHaveBeenCalled();
  });
});
