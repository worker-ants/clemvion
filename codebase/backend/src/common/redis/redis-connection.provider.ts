import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

/**
 * 공유 command 연결의 per-request 재시도 한도 (INFO-10). 옛 소비자들의
 * maxRetriesPerRequest(2~3) 중 더 관대한 3 으로 통합. command-only 공유
 * 연결이라 BullMQ 의 `null` 정책은 적용하지 않는다.
 */
const SHARED_MAX_RETRIES_PER_REQUEST = 3;

/**
 * 단일 공유 command Redis 연결 provider (ai-review INFO-12).
 *
 * **배경**: 옛 코드는 7~8개 서비스 (`ExecutionSeqAllocator` · `ContinuationBusService` 의
 * lockClient · `InteractionTokenService` · `IdempotencyInterceptor` ·
 * `Cafe24InstallNonceCache` · `ChannelConversationService` · `HealthService` ·
 * `PublicWebhookQuotaService`) 가 각자 `new Redis(config)` 로 **독립 연결**을 만들어
 * 인스턴스당 Redis 연결이 모듈 수만큼 누적됐다.
 *
 * 이들은 **전부 command-only** (get/set/del/incr/expire/pipeline/SET NX) — blocking
 * (brpop/blpop) 이나 pub/sub (subscribe) 가 없어 **단일 연결 multiplexing 이 안전**하다.
 * 본 provider 가 단일 command 연결을 lazy 생성·공유해 연결 수를 8 → 1 로 줄이고
 * 연결 config (host/port/password/tls/retry) 를 한 곳으로 모은다. (BullMQ 연결은 별도 —
 * `maxRetriesPerRequest: null` 등 다른 정책이 필요해 본 provider 가 관리하지 않는다.)
 *
 * **lifecycle**: lazy init (`getClient` 첫 호출 시 connect — onModuleInit race 회피),
 * `onModuleDestroy` 에서 단일 quit. 각 소비자는 더 이상 자기 client 를 quit 하지 않는다.
 *
 * **장애 처리**: 소비자별 try/catch 의 graceful-degrade 는 그대로 유지 (예:
 * seq allocator 의 in-memory fallback). 본 provider 는 `'error'` 이벤트를 한 곳에서
 * 로깅하고, config 누락 시 명시적 throw 한다 (소비자 catch 가 degrade 처리).
 */
@Injectable()
export class RedisConnectionProvider implements OnModuleDestroy {
  private readonly logger = new Logger(RedisConnectionProvider.name);
  private client: Redis | null = null;
  /**
   * config 누락으로 {@link getClientOrNull} 이 이미 warn 을 남겼는지 (INFO-4).
   * 소비자 7~8개가 부팅 직후 각자 getClientOrNull 을 호출해 동일 warn 이
   * 중복 폭주하는 것을 막는다 — 최초 1회만 경고.
   */
  private degradeWarned = false;

  constructor(private readonly configService: ConfigService) {}

  /**
   * 공유 command 연결 반환. 첫 호출 시 lazy connect. 호출자는 반환된 client 로
   * command 를 실행하고, 장애 시 자체 try/catch 로 degrade 한다.
   *
   * @throws redis.host / redis.port 설정 누락 시 (소비자 catch 가 처리)
   */
  getClient(): Redis {
    if (!this.client) {
      const host = this.configService.get<string>('redis.host');
      const port = this.configService.get<number>('redis.port');
      // host 는 빈 문자 falsy 로 "누락" 취급; port 는 0 도 유효값이므로
      // null/undefined 만 "누락" 으로 판별 (W-10).
      if (!host || port == null) {
        throw new Error(
          'redis.host / redis.port 설정이 누락됐습니다. REDIS_HOST / REDIS_PORT 를 확인하세요.',
        );
      }
      const password = this.configService.get<string>('redis.password');
      const tlsEnabled = this.configService.get<boolean>('redis.tls');
      const opts: RedisOptions = {
        host,
        port,
        ...(password ? { password } : {}),
        ...(tlsEnabled ? { tls: {} } : {}),
        // 통합 정책: 옛 소비자들의 maxRetriesPerRequest(2~3) 중 더 관대한 3, ready check on.
        // command-only 공유 연결이라 BullMQ 의 null 정책은 적용하지 않는다.
        enableReadyCheck: true,
        maxRetriesPerRequest: SHARED_MAX_RETRIES_PER_REQUEST,
        // lazyConnect: getClient() 만으론 connect 하지 않고 첫 command 에서 연결.
        // app 부팅 시 Redis 미사용 모듈까지 eager connect 하던 회귀 방지 (옛 소비자 일부가
        // lazyConnect 사용하던 동작 보존).
        lazyConnect: true,
      };
      this.client = new Redis(opts);
      this.client.on('error', (err: Error) => {
        this.logger.error(`shared Redis connection error: ${err.message}`);
      });
    }
    return this.client;
  }

  /**
   * config 누락·생성 실패 시 `null` 을 반환하는 degrade 친화 변형. 소비자가
   * "Redis 미가용 시 graceful degrade" (예: 토큰 blacklist 미적용, idempotency skip)
   * 를 `if (!client) return` 패턴으로 유지할 수 있게 한다. {@link getClient} 와 달리
   * throw 하지 않는다.
   */
  getClientOrNull(): Redis | null {
    try {
      return this.getClient();
    } catch (err) {
      // INFO-4: config 누락은 프로세스 수명 내내 불변 — 소비자 수만큼 warn 을
      // 반복하지 않고 최초 1회만 경고한다.
      if (!this.degradeWarned) {
        this.degradeWarned = true;
        this.logger.warn(
          `shared Redis 미가용 — degrade: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    // W-2: 먼저 참조를 옮겨 null 로 교체한 뒤 quit. quit await 구간에 다른
    // getClient 가 재진입해 새 인스턴스를 만들어도, 그 인스턴스를 null 이
    // 덮어써 quit 되지 않은 채 누수되는 것을 방지한다.
    const c = this.client;
    this.client = null;
    if (c) await c.quit().catch(() => undefined);
  }
}
