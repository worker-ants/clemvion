import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';
import { ChannelConversationState } from './types';

/**
 * Chat Channel ConversationState 의 Redis CRUD.
 *
 * Spec §4.3 (15-chat-channel.md):
 *   key:   chat-channel:{triggerId}:{conversationKey}
 *   value: ChannelConversationState (JSON)
 *   TTL:   7일 (사용자 이탈 시 자동 만료)
 *
 * Redis 미가용 시 graceful degradation — lookup 은 null, upsert 는 noop (워크플로우 실행 자체
 * 차단 회피). 본 케이스에서는 매 update 가 새 execution 으로 처리됨 (fallback).
 */
@Injectable()
export class ChannelConversationService {
  private readonly logger = new Logger(ChannelConversationService.name);
  private readonly redis: Redis | null;
  /** Spec §4.3 — TTL 7일. */
  static readonly TTL_SEC = 7 * 24 * 60 * 60;

  constructor(
    // _configService: DI 파라미터 순서 고정(하위 호환) — Redis 는 redisConn 으로 대체 (INFO-12).
    @Optional() _configService?: ConfigService,
    @Optional()
    @Inject('CHAT_CHANNEL_CONVERSATION_REDIS')
    injectedRedis?: Redis,
    @Optional() redisConn?: RedisConnectionProvider,
  ) {
    // 테스트 주입(injectedRedis) 우선, 아니면 공유 command connection (INFO-12).
    // 미가용 시 null 로 degrade — lookup null / upsert noop (graceful degradation).
    this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;
  }

  /** Redis 가용성 여부 — 호출자가 graceful degradation 판단에 사용. */
  isAvailable(): boolean {
    return this.redis !== null;
  }

  /**
   * 동일 (triggerId, conversationKey) 의 활성 conversation 조회. 없으면 null.
   * Redis 미가용 시 null (= 새 conversation 으로 처리됨).
   */
  async lookup(
    triggerId: string,
    conversationKey: string,
  ): Promise<ChannelConversationState | null> {
    if (!this.redis) return null;
    const key = this.buildKey(triggerId, conversationKey);
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as ChannelConversationState;
    } catch (err) {
      this.logger.warn(
        `ChannelConversationService.lookup 실패 — graceful degradation: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /**
   * Upsert + TTL 갱신. lastUpdateAt 은 호출자가 새 ISO8601 로 set 한 state 를 그대로 저장.
   */
  async upsert(
    triggerId: string,
    conversationKey: string,
    state: ChannelConversationState,
  ): Promise<void> {
    if (!this.redis) return;
    const key = this.buildKey(triggerId, conversationKey);
    try {
      await this.redis.set(
        key,
        JSON.stringify(state),
        'EX',
        ChannelConversationService.TTL_SEC,
      );
    } catch (err) {
      this.logger.warn(
        `ChannelConversationService.upsert 실패 — graceful degradation: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Conversation 명시적 삭제 (예: /cancel 처리 직후, terminal execution 이 후속 메시지 없이 종료된 직후).
   * TTL 만료를 기다리지 않고 즉시 정리하고 싶을 때만 호출 — 일반적으로는 upsert 의 TTL 만으로 충분.
   */
  async clear(triggerId: string, conversationKey: string): Promise<void> {
    if (!this.redis) return;
    const key = this.buildKey(triggerId, conversationKey);
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(
        `ChannelConversationService.clear 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * 활성 executionId 만 갱신 (terminal 후 null 로 비우거나, 새 execution 으로 교체).
   * lookup-then-upsert 의 atomic 변형 — race condition 가능성은 동일 conversation 의 동시 도착이
   * 드물어 (CCH-NF-03 의 분당 60 cap) 큰 문제 아님.
   */
  async updateExecutionId(
    triggerId: string,
    conversationKey: string,
    executionId: string | null,
  ): Promise<void> {
    const state = await this.lookup(triggerId, conversationKey);
    if (!state) return;
    state.executionId = executionId;
    state.lastUpdateAt = new Date().toISOString();
    await this.upsert(triggerId, conversationKey, state);
  }

  /**
   * §4.1 native modal 동시 제출 방지 lock 획득 (SET NX EX).
   * lockKey = `chat-channel-lock:{triggerId}:{conversationKey}:formsubmit`.
   * `token` 은 호출자가 발급한 고유 값 (release 시 소유권 확인용).
   *
   * Redis 미가용 시 true (fail-open — 기존 graceful degradation 정합, lock 인프라 없음).
   * 오류 시에도 true (fail-open) + logger.warn.
   *
   * @returns true 면 lock 획득 성공, false 면 이미 다른 요청이 보유 중.
   */
  async acquireLock(
    triggerId: string,
    conversationKey: string,
    token: string,
    ttlSec = 30,
  ): Promise<boolean> {
    if (!this.redis) return true;
    const lockKey = this.buildLockKey(triggerId, conversationKey);
    try {
      // ioredis 타입 시그니처는 EX seconds NX 순서 — Redis 명령상 `SET k v NX EX n` 와 동치.
      const result = await this.redis.set(lockKey, token, 'EX', ttlSec, 'NX');
      return result === 'OK';
    } catch (err) {
      this.logger.warn(
        `ChannelConversationService.acquireLock 실패 — fail-open: ${err instanceof Error ? err.message : String(err)}`,
      );
      return true;
    }
  }

  /**
   * acquireLock 으로 획득한 lock 안전 해제. Lua 로 소유권 (token 일치) 확인 후 DEL —
   * TTL 만료 후 다른 요청이 잡은 lock 을 잘못 삭제하지 않도록 보장.
   * Redis 미가용 시 noop. 오류 시 logger.warn (lock 은 TTL 로 자연 만료).
   */
  async releaseLock(
    triggerId: string,
    conversationKey: string,
    token: string,
  ): Promise<void> {
    if (!this.redis) return;
    const lockKey = this.buildLockKey(triggerId, conversationKey);
    try {
      await this.redis.eval(
        "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
        1,
        lockKey,
        token,
      );
    } catch (err) {
      this.logger.warn(
        `ChannelConversationService.releaseLock 실패 (TTL 로 자연 만료): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private buildKey(triggerId: string, conversationKey: string): string {
    return `chat-channel:${triggerId}:${conversationKey}`;
  }

  private buildLockKey(triggerId: string, conversationKey: string): string {
    return `chat-channel-lock:${triggerId}:${conversationKey}:formsubmit`;
  }

  // 공유 connection 은 RedisConnectionProvider 가 소유·종료 (INFO-12) — 본 서비스는 quit 안 함.
}
