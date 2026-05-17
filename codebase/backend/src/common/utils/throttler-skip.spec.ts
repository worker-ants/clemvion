import { shouldSkipThrottle } from './throttler-skip';

describe('shouldSkipThrottle', () => {
  const original = process.env.NODE_ENV;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = original;
    }
  });

  it('NODE_ENV=test → true (e2e RATE_LIMITED 사전 결함 우회)', () => {
    process.env.NODE_ENV = 'test';
    expect(shouldSkipThrottle()).toBe(true);
  });

  it('NODE_ENV=production → false (실제 강제)', () => {
    process.env.NODE_ENV = 'production';
    expect(shouldSkipThrottle()).toBe(false);
  });

  it('NODE_ENV=development → false (로컬에서도 100/60s 그대로)', () => {
    process.env.NODE_ENV = 'development';
    expect(shouldSkipThrottle()).toBe(false);
  });

  it('NODE_ENV 미설정 → false (fail-closed — 모르는 환경은 throttle 강제)', () => {
    delete process.env.NODE_ENV;
    expect(shouldSkipThrottle()).toBe(false);
  });

  it('NODE_ENV=staging 같은 임의 값 → false (test 라는 정확 일치만 skip)', () => {
    process.env.NODE_ENV = 'staging';
    expect(shouldSkipThrottle()).toBe(false);
  });
});
