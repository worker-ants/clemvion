import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import { RedisConnectionProvider } from './redis-connection.provider';

/**
 * 인스턴스-로컬 자격증명 캐시를 integrationId 단위로 evict 하는 콜백.
 * 동기/비동기 모두 허용 — 비동기 거부는 bus 가 삼키고 로깅한다.
 */
export type IntegrationCacheInvalidator = (
  integrationId: string,
) => void | Promise<void>;

/**
 * integration 자격증명 변경을 전 인스턴스에 broadcast 하는 Redis pub/sub 채널.
 * payload 는 integrationId 평문 문자열.
 */
export const INTEGRATION_CACHE_INVALIDATE_CHANNEL =
  'integration:cache:invalidate';

/**
 * integration 자격증명 회전의 멀티 인스턴스 캐시 무효화 bus (refactor 04 m-4).
 *
 * **문제**: DB 연결 풀(`database-query.handler`)·이메일 transport(`send-email.handler`)
 * 등은 인스턴스-로컬 in-memory 캐시다. `IntegrationsService` 가 자격증명을 회전해도
 * **회전을 수행한 인스턴스의 캐시만** 갱신되고, 타 인스턴스의 풀에는 회전된(stale)
 * 자격증명으로 맺은 idle 연결이 잔존한다 — 침해 대응(MTTR) 갭.
 *
 * **해법**: 자격증명이 바뀐 integration 의 id 를 채널
 * {@link INTEGRATION_CACHE_INVALIDATE_CHANNEL} 로 publish 하고, 전 인스턴스 구독자가
 * 등록된 invalidator 를 실행해 해당 integrationId 의 로컬 캐시를 즉시 evict 한다.
 *
 * **fail-safe**: pub/sub 는 즉시성 보강 계층일 뿐이다 — Redis 순단으로 메시지가
 * 유실돼도 각 핸들러의 credsHash 비교 evict 가 다음 실행에서 stale 자원을 교체하므로
 * 정합성은 깨지지 않는다(안전 degrade). 따라서 모든 pub/sub 실패는 경고만 남기고 삼킨다.
 *
 * **연결 분리**: 기존 공유 Redis 연결은 command-only 라 단일 연결 multiplexing 안전성을
 * 위해 SUBSCRIBE 를 보내지 않는다 (구독은 연결을 subscriber 모드로 전환). 따라서 구독은
 * 전용 `duplicate()` 연결로 분리하고, PUBLISH 는 일반 command 라 공유 연결로 보낸다.
 */
@Injectable()
export class IntegrationCacheBus implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IntegrationCacheBus.name);
  private readonly invalidators = new Set<IntegrationCacheInvalidator>();
  private subscriber: Redis | null = null;

  constructor(private readonly redis: RedisConnectionProvider) {}

  /**
   * 인스턴스-로컬 자격증명 캐시 evict 콜백을 등록한다. 핸들러가 부팅 시 1회 호출
   * (싱글톤 핸들러 ↔ 싱글톤 bus). 등록 순서·중복은 무관 — Set 이라 idempotent.
   */
  register(invalidator: IntegrationCacheInvalidator): void {
    this.invalidators.add(invalidator);
  }

  /**
   * 자격증명이 바뀐 integration 을 전 인스턴스에 broadcast 한다. fail-safe —
   * Redis 미가용/실패 시 경고만 남기고 반환한다 (로컬 credsHash evict 가 보호).
   */
  async publish(integrationId: string): Promise<void> {
    if (!integrationId) return;
    const client = this.redis.getClientOrNull();
    if (!client) return; // degrade — credsHash evict 가 다음 실행에서 교체
    try {
      await client.publish(INTEGRATION_CACHE_INVALIDATE_CHANNEL, integrationId);
    } catch (err) {
      this.logger.warn(
        `integration cache invalidate publish 실패 (${integrationId}): ${errMessage(
          err,
        )}`,
      );
    }
  }

  onModuleInit(): void {
    const base = this.redis.getClientOrNull();
    if (!base) {
      this.logger.warn(
        'Redis 미가용 — integration cache invalidate 구독 비활성(로컬 credsHash evict 로 degrade)',
      );
      return;
    }
    const sub = base.duplicate();
    sub.on('error', (err: Error) => {
      this.logger.error(
        `integration cache subscriber 연결 오류: ${err.message}`,
      );
    });
    sub.on('message', (channel: string, message: string) => {
      if (channel !== INTEGRATION_CACHE_INVALIDATE_CHANNEL) return;
      this.runInvalidators(message);
    });
    // lazyConnect 연결이라 subscribe 가 connect 를 트리거한다.
    sub
      .subscribe(INTEGRATION_CACHE_INVALIDATE_CHANNEL)
      .catch((err: unknown) => {
        this.logger.warn(
          `integration cache 채널 구독 실패(로컬 evict 로 degrade): ${errMessage(
            err,
          )}`,
        );
      });
    this.subscriber = sub;
  }

  private runInvalidators(integrationId: string): void {
    if (!integrationId) return;
    for (const fn of this.invalidators) {
      try {
        const result = fn(integrationId);
        if (result instanceof Promise) {
          result.catch((err: unknown) => {
            this.logger.warn(
              `integration cache invalidator 실패 (${integrationId}): ${errMessage(
                err,
              )}`,
            );
          });
        }
      } catch (err) {
        this.logger.warn(
          `integration cache invalidator 실패 (${integrationId}): ${errMessage(
            err,
          )}`,
        );
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    const s = this.subscriber;
    this.subscriber = null;
    if (s) await s.quit().catch(() => undefined);
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
