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
 * Cafe24 install endpoint 의 timestamp+hmac 재전송 방지 nonce cache.
 *
 * 옛 정책 (B-1-3 잔여 위험): `handleInstall` 의 timestamp ±5분 윈도우 검증
 * 만으로는 같은 윈도우 안에서 동일 (mall_id, timestamp, hmac) 튜플을 재전송
 * 했을 때 OAuth state 행이 중복 생성될 수 있었다. 본 cache 가 valid 한
 * 튜플을 본 적이 있으면 두 번째 호출을 CAFE24_INSTALL_REPLAY 로 거절.
 *
 * 구현:
 * - key 형식: `cafe24:install:nonce:{mall_id}:{timestamp}:{hmac:8}` —
 *   hmac 의 앞 8자만 사용해 키 길이를 제한 (Cafe24 hmac 은 base64 ~44자).
 *   prefix 8자만으로도 충돌 확률은 무시 가능 (64^8 = 2.8e14).
 * - SETNX + EX 10min — 윈도우 (±5분) 의 2배 안전 마진.
 * - Redis 미설정 / 연결 실패 시: warn 로깅 + nonce 검사 자체를 skip
 *   (`isReplay` 가 false 반환). graceful degradation — 보안 강화는 0 이지만
 *   기존 정책 (timestamp 윈도우만) 으로 fallback. 본 cache 가 OFF 여도
 *   spec 의 잔여 위험 절은 그대로 유효.
 *
 * spec/4-nodes/4-integration/4-cafe24.md (HMAC verification / replay 절) 참조.
 */
@Injectable()
export class Cafe24InstallNonceCache implements OnModuleDestroy {
  private readonly logger = new Logger(Cafe24InstallNonceCache.name);
  private readonly redis: Redis | null;
  /** ±5분 윈도우 의 2배 — Cafe24 가 윈도우 안에서 다시 호출하지 못하게 한다. */
  static readonly TTL_SEC = 10 * 60;

  constructor(
    @Optional() configService?: ConfigService,
    @Optional() @Inject('CAFE24_INSTALL_NONCE_REDIS') injectedRedis?: Redis,
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
        `Cafe24InstallNonceCache: Redis 초기화 실패 — graceful degradation: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.redis = null;
    }
  }

  /**
   * 동일 (mall_id, timestamp, hmac) 튜플을 본 적이 있는지 검사 + 새 nonce 면
   * 기록. SETNX EX TTL_SEC — 원자적으로 검사+삽입.
   *
   * @returns true 이면 replay (이미 본 nonce). false 이면 새 nonce (기록됨).
   *          Redis 미설정 / 통신 실패 시 false (graceful degradation).
   */
  async isReplay(params: {
    mallId: string;
    timestamp: string;
    hmac: string;
  }): Promise<boolean> {
    if (!this.redis) return false;
    const key = this.buildKey(params);
    try {
      const result = await this.redis.set(
        key,
        '1',
        'EX',
        Cafe24InstallNonceCache.TTL_SEC,
        'NX',
      );
      // SETNX 가 null 을 반환하면 이미 키가 있다 — replay.
      return result === null;
    } catch (err) {
      this.logger.warn(
        `Cafe24InstallNonceCache: SETNX 실패 — graceful degradation, replay 검사 skip: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  private buildKey(params: {
    mallId: string;
    timestamp: string;
    hmac: string;
  }): string {
    // hmac 앞 8자만 — base64 charset 이므로 그대로 사용 가능 (한 글자가
    // 6비트 정보, 8자 = 48비트 = ~2.8e14 공간).
    const hmacPrefix = params.hmac.slice(0, 8);
    return `cafe24:install:nonce:${params.mallId}:${params.timestamp}:${hmacPrefix}`;
  }

  /**
   * 테스트 / shutdown 용도. Redis 연결을 닫는다.
   */
  async close(): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.quit();
    } catch {
      // shutdown 중 실패는 무시
    }
  }

  /**
   * NestJS lifecycle — graceful shutdown 시 Redis 연결 누수 방지 (W-73).
   * 옛 코드는 close() 만 두고 어디서도 호출하지 않아 SIGTERM 후에도 connection
   * pool 이 dangling 상태였다.
   */
  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
