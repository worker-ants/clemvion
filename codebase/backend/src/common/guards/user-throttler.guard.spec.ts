import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerException,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import { UserThrottlerGuard } from './user-throttler.guard';

/**
 * UserThrottlerGuard.getTracker 4분기 단위 테스트 (spec §12 사용자당 rate-limit).
 * getTracker 는 protected 라 서브클래스로 노출해 직접 호출한다. ThrottlerGuard
 * 의 생성자 의존성은 본 테스트에서 사용하지 않으므로 Object.create 로 우회한다.
 */
class TestableGuard extends UserThrottlerGuard {
  public track(req: Record<string, unknown>): Promise<string> {
    return this.getTracker(req);
  }
}

describe('UserThrottlerGuard.getTracker', () => {
  let guard: TestableGuard;

  beforeEach(() => {
    guard = Object.create(TestableGuard.prototype) as TestableGuard;
  });

  it('returns user:<sub> when req.user.sub is present', async () => {
    await expect(
      guard.track({ user: { sub: 'u-1' }, ip: '1.2.3.4' }),
    ).resolves.toBe('user:u-1');
  });

  it('falls back to user:<userId> when sub is absent', async () => {
    await expect(
      guard.track({ user: { userId: 'u-2' }, ip: '1.2.3.4' }),
    ).resolves.toBe('user:u-2');
  });

  it('prefers sub over userId when both present', async () => {
    await expect(
      guard.track({ user: { sub: 'u-sub', userId: 'u-id' } }),
    ).resolves.toBe('user:u-sub');
  });

  it('returns the IP when there is no user', async () => {
    await expect(guard.track({ ip: '9.9.9.9' })).resolves.toBe('9.9.9.9');
  });

  it("returns 'unknown' when neither user nor ip is present", async () => {
    await expect(guard.track({})).resolves.toBe('unknown');
  });
});

/**
 * NestJS 12 부터 APP_GUARD 가 WebSocket 게이트웨이 핸들러에도 붙는다. 그 컨텍스트의 "요청" 은
 * 소켓이라 `user` · `ip` 가 없어 tracker 가 모두 `'unknown'` 이 된다. 그대로 두면 모든 사용자의
 * WS 메시지가 핸들러마다 한 버킷을 나눠 써서 서버 전체가 분당 limit 건에 막힌다. WS 빈도 제한은
 * 소켓당 `WsRateLimitGuard` 가 맡는다(CLE-API-WS §7.1).
 */
describe('UserThrottlerGuard — HTTP 가 아닌 컨텍스트', () => {
  class Gateway {
    handleSubscribe(): void {}
  }

  const buildGuard = async (): Promise<UserThrottlerGuard> => {
    const guard = new UserThrottlerGuard(
      { throttlers: [{ name: 'default', ttl: 60_000, limit: 1 }] },
      new ThrottlerStorageService(),
      new Reflector(),
    );
    await guard.onModuleInit();
    return guard;
  };

  const buildContext = (type: 'http' | 'ws', req: Record<string, unknown>) =>
    ({
      getType: () => type,
      getHandler: () => Gateway.prototype.handleSubscribe,
      getClass: () => Gateway,
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({ header: jest.fn() }),
      }),
    }) as unknown as ExecutionContext;

  it('WS 메시지는 limit 을 넘겨도 통과시킨다(세지 않는다)', async () => {
    const guard = await buildGuard();
    const socket = { id: 'socket-1' };
    await expect(guard.canActivate(buildContext('ws', socket))).resolves.toBe(
      true,
    );
    await expect(guard.canActivate(buildContext('ws', socket))).resolves.toBe(
      true,
    );
  });

  it('HTTP 요청은 limit 을 넘으면 막는다 — 위 단언이 vacuous 하지 않다', async () => {
    const guard = await buildGuard();
    const req = { ip: '9.9.9.9' };
    await expect(guard.canActivate(buildContext('http', req))).resolves.toBe(
      true,
    );
    await expect(
      guard.canActivate(buildContext('http', req)),
    ).rejects.toBeInstanceOf(ThrottlerException);
  });
});
