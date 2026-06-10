import { of } from 'rxjs';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggingInterceptor } from './logging.interceptor';

/**
 * LoggingInterceptor 의 health probe 경로 로그 게이팅 (spec/data-flow/9-observability.md §1.1).
 * - health probe 경로(/api/health, /api/health/live):
 *   성공(<400)은 HEALTH_CHECK_LOG=true 일 때만 INFO, 실패(>=400)는 항상 WARN.
 * - 그 외 경로: 기존 동작(항상 INFO).
 */
describe('LoggingInterceptor', () => {
  const buildConfig = (value?: string): ConfigService =>
    ({ get: jest.fn().mockReturnValue(value) }) as unknown as ConfigService;

  const buildContext = (url: string, statusCode: number) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url }),
        getResponse: () => ({ statusCode }),
      }),
    }) as any;

  const createHandler = (data: unknown) => ({ handle: () => of(data) });

  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  const run = (interceptor: LoggingInterceptor, url: string, status: number) =>
    new Promise<void>((resolve) => {
      interceptor
        .intercept(buildContext(url, status), createHandler({ ok: true }))
        .subscribe(() => resolve());
    });

  describe('health probe 경로 (HEALTH_CHECK_LOG 미설정 → 기본 false)', () => {
    it('성공(200)은 로그하지 않는다 — /api/health', async () => {
      const interceptor = new LoggingInterceptor(buildConfig(undefined));
      await run(interceptor, '/api/health', 200);
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('성공(200)은 로그하지 않는다 — /api/health/live', async () => {
      const interceptor = new LoggingInterceptor(buildConfig('false'));
      await run(interceptor, '/api/health/live', 200);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('실패(503)는 HEALTH_CHECK_LOG 와 무관하게 WARN 으로 항상 로그한다', async () => {
      const interceptor = new LoggingInterceptor(buildConfig(undefined));
      await run(interceptor, '/api/health', 503);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('GET /api/health 503');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('쿼리스트링이 붙어도 health 경로로 인식한다', async () => {
      const interceptor = new LoggingInterceptor(buildConfig(undefined));
      await run(interceptor, '/api/health?foo=1', 200);
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe('health probe 경로 (HEALTH_CHECK_LOG=true)', () => {
    it('성공(200)도 INFO 로 로그한다', async () => {
      const interceptor = new LoggingInterceptor(buildConfig('true'));
      await run(interceptor, '/api/health', 200);
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toContain('GET /api/health 200');
    });

    it('실패(503)는 여전히 WARN 으로 로그한다', async () => {
      const interceptor = new LoggingInterceptor(buildConfig('true'));
      await run(interceptor, '/api/health/live', 503);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe('그 외 경로 (게이팅 미적용)', () => {
    it('성공(200)을 항상 INFO 로 로그한다', async () => {
      const interceptor = new LoggingInterceptor(buildConfig(undefined));
      await run(interceptor, '/api/workflows', 200);
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toContain('GET /api/workflows 200');
    });

    it('HEALTH_CHECK_LOG 설정과 무관하게 비-health 경로는 항상 로그한다', async () => {
      const interceptor = new LoggingInterceptor(buildConfig('false'));
      await run(interceptor, '/api/health-records', 200);
      // /api/health-records 는 health probe 경로(정확 매치)가 아니므로 항상 로그
      expect(logSpy).toHaveBeenCalledTimes(1);
    });
  });
});
