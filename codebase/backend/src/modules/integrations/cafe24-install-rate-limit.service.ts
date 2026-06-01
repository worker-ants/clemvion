import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Cafe24 install endpoint 의 token oracle enumeration 방어 — 실패 시도 페널티
 * (A-3 Layer 2, spec/4-nodes/4-integration/4-cafe24.md §9.8 Rate limiting note).
 *
 * 핵심 비대칭: 정상 사용자는 유효 `install_token` 으로 **성공**(302 redirect)하므로
 * 실패 카운터가 거의 0 이지만, enumeration 공격은 정의상 대량 **실패**
 * (`CAFE24_INSTALL_INVALID_TOKEN` / `CAFE24_INSTALL_INVALID_HMAC`)라 빠르게 임계치에
 * 도달한다. 따라서 **실패한 요청만** IP별로 카운트하고 성공은 카운트하지 않는다 —
 * 정상 사용자 무영향 + enumeration 정조준을 동시에 달성한다.
 *
 * 구현:
 * - key 형식: `cafe24:install:fail:{ip}` — nonce 키(`cafe24:install:nonce:*`)와 세 번째
 *   세그먼트로 분리되어 충돌하지 않는다.
 * - `recordFailure`: 원자적 INCR + (최초 생성 시) EXPIRE — Lua 스크립트로 한 번에 실행해
 *   INCR 직후 크래시로 TTL 누락(영구 키) 되는 race 를 차단. fixed window (최초 실패 시점부터
 *   `FAIL_WINDOW_SEC`) — 정상 사용자의 산발적 재시도에 관대.
 * - `isLockedOut`: GET 후 `FAIL_THRESHOLD` 비교.
 * - Redis 미설정 / 연결 실패 시: warn 로깅 + **fail-open** (`isLockedOut`=false,
 *   `recordFailure`=no-op). nonce-cache 와 동일한 graceful degradation — in-memory 등가물이
 *   없는 순수 강화 layer 라, Redis 부재 시 차단을 끄고 기존 정책(±5분 윈도우 + capability-token)
 *   으로 회귀하는 게 정상 install 을 막지 않아 안전하다 (가용성 우선).
 *
 * 본 서비스는 install endpoint 의 미인증 IP throttle (Layer 1, `@Throttle({ limit: 30,
 * ttl: 60_000 })`) 위에 얹는 보강이다. Layer 1 의 Redis 분산 store 이전은 전역 storage
 * 교체라 별 infra PR 로 분리(deferred).
 */
@Injectable()
export class Cafe24InstallRateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(Cafe24InstallRateLimitService.name);
  private readonly redis: Redis | null;

  /** window 내 허용 실패 횟수. 이 값 이상이면 lockout — `429 CAFE24_INSTALL_RATE_LIMITED`. */
  static readonly FAIL_THRESHOLD = 10;
  /** 실패 카운터(`cafe24:install:fail:{ip}`) Redis TTL(초). nonce TTL(10분)과 동일 마진. */
  static readonly FAIL_WINDOW_SEC = 600;

  /**
   * 원자적 INCR + 최초 생성 시 EXPIRE. INCR 와 EXPIRE 사이 크래시로 TTL 누락되는
   * 영구 키를 차단한다 (fixed window).
   */
  private static readonly INCR_EXPIRE_LUA =
    "local c = redis.call('INCR', KEYS[1]) " +
    "if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end " +
    'return c';

  constructor(
    @Optional() configService?: ConfigService,
    @Optional()
    @Inject('CAFE24_INSTALL_RATE_LIMIT_REDIS')
    injectedRedis?: Redis,
  ) {
    if (injectedRedis) {
      // 테스트가 mock redis 를 주입할 수 있게 한다.
      this.redis = injectedRedis;
      return;
    }
    if (!configService) {
      this.redis = null;
      return;
    }
    const host = configService.get<string>('redis.host');
    const port = configService.get<number>('redis.port');
    if (!host || !port) {
      this.redis = null;
      return;
    }
    const password = configService.get<string>('redis.password');
    const tlsEnabled = configService.get<boolean>('redis.tls');
    try {
      this.redis = new Redis({
        host,
        port,
        ...(password ? { password } : {}),
        ...(tlsEnabled ? { tls: {} } : {}),
        lazyConnect: true,
      });
    } catch (err) {
      this.logger.warn(
        `Cafe24InstallRateLimitService: Redis 초기화 실패 — graceful degradation(fail-open): ${err instanceof Error ? err.message : String(err)}`,
      );
      this.redis = null;
    }
  }

  /**
   * 현재 IP 가 실패 임계치를 초과해 lockout 상태인지 검사.
   *
   * @returns true 이면 lockout (요청 거절 대상). Redis 미설정 / 통신 실패 / ip 부재 시
   *          false (fail-open).
   */
  async isLockedOut(ip: string | undefined): Promise<boolean> {
    if (!this.redis || !ip) return false;
    try {
      const raw = await this.redis.get(this.buildKey(ip));
      if (raw === null) return false;
      const count = Number.parseInt(raw, 10);
      return (
        Number.isFinite(count) &&
        count >= Cafe24InstallRateLimitService.FAIL_THRESHOLD
      );
    } catch (err) {
      this.logger.warn(
        `Cafe24InstallRateLimitService: isLockedOut 실패 — graceful degradation(fail-open): ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  /**
   * install_token 조회/HMAC 검증 **실패** 1건을 기록한다. 성공한 install 은 호출하지 않는다.
   * Redis 미설정 / 통신 실패 / ip 부재 시 no-op (graceful degradation).
   */
  async recordFailure(ip: string | undefined): Promise<void> {
    if (!this.redis || !ip) return;
    try {
      await this.redis.eval(
        Cafe24InstallRateLimitService.INCR_EXPIRE_LUA,
        1,
        this.buildKey(ip),
        String(Cafe24InstallRateLimitService.FAIL_WINDOW_SEC),
      );
    } catch (err) {
      this.logger.warn(
        `Cafe24InstallRateLimitService: recordFailure 실패 — graceful degradation: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private buildKey(ip: string): string {
    return `cafe24:install:fail:${ip}`;
  }

  /** 테스트 / shutdown 용도. Redis 연결을 닫는다. */
  async close(): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.quit();
    } catch {
      // shutdown 중 실패는 무시
    }
  }

  /** NestJS lifecycle — graceful shutdown 시 Redis 연결 누수 방지. */
  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
