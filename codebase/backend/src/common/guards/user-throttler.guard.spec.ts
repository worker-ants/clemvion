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
