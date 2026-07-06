import { WsRateLimiterService } from './ws-rate-limiter.service';

describe('WsRateLimiterService', () => {
  let svc: WsRateLimiterService;

  beforeEach(() => {
    svc = new WsRateLimiterService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('한도(60/min) 이내는 allow, 초과(61번째)는 deny', () => {
    for (let i = 0; i < WsRateLimiterService.LIMIT_PER_MINUTE; i++) {
      expect(svc.consume('sock-1')).toBe(true);
    }
    // 61번째 — 한도 초과
    expect(svc.consume('sock-1')).toBe(false);
    // 이후에도 계속 deny (같은 윈도우)
    expect(svc.consume('sock-1')).toBe(false);
  });

  it('socket 별 독립 카운트', () => {
    for (let i = 0; i < WsRateLimiterService.LIMIT_PER_MINUTE; i++) {
      svc.consume('sock-1');
    }
    expect(svc.consume('sock-1')).toBe(false);
    // 다른 소켓은 fresh
    expect(svc.consume('sock-2')).toBe(true);
  });

  it('윈도우(60s) 경과 시 카운터 리셋', () => {
    const base = 1_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(base);
    for (let i = 0; i < WsRateLimiterService.LIMIT_PER_MINUTE; i++) {
      svc.consume('sock-1');
    }
    expect(svc.consume('sock-1')).toBe(false); // 초과

    // 윈도우 경과
    nowSpy.mockReturnValue(base + WsRateLimiterService.WINDOW_MS);
    expect(svc.consume('sock-1')).toBe(true); // 리셋되어 다시 allow
  });

  it('윈도우 경계 직전(WINDOW_MS-1)에는 리셋되지 않는다 (off-by-one 가드)', () => {
    const base = 2_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(base);
    for (let i = 0; i < WsRateLimiterService.LIMIT_PER_MINUTE; i++) {
      svc.consume('sock-1');
    }
    // 경계 직전 — 아직 같은 윈도우라 초과 상태 유지(deny).
    nowSpy.mockReturnValue(base + WsRateLimiterService.WINDOW_MS - 1);
    expect(svc.consume('sock-1')).toBe(false);
  });

  it('release 로 카운터 정리(누수 방지)', () => {
    svc.consume('sock-1');
    expect(svc.trackedCount).toBe(1);
    svc.release('sock-1');
    expect(svc.trackedCount).toBe(0);
    // release 후 재개 시 fresh 윈도우
    for (let i = 0; i < WsRateLimiterService.LIMIT_PER_MINUTE; i++) {
      expect(svc.consume('sock-1')).toBe(true);
    }
  });
});
