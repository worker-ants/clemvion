import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';
import { ChannelConversationState } from './types';

/**
 * 저장된 값이 읽은 값과 같을 때만 새 값으로 바꾼다(compare-and-set). JSON 을 Lua 에서 다시 만들지
 * 않고 문자열 그대로 비교한다. cjson 은 빈 배열을 객체로 바꿔 `pendingFormModal.fields` 같은 값을
 * 망가뜨린다.
 */
export const COMPARE_AND_SET_SCRIPT =
  "if redis.call('get',KEYS[1])==ARGV[1] then redis.call('set',KEYS[1],ARGV[2],'EX',ARGV[3]) return 1 else return 0 end";

/** compare-and-set 이 다른 쓰기에 밀렸을 때 다시 읽는 횟수 상한. */
const COMPARE_AND_SET_MAX_ATTEMPTS = 3;

/**
 * `acquireLock` 으로 잡은 lock 을 소유자(token)가 맞을 때만 지운다. TTL 이 지나 다른 요청이 잡은 lock 을
 * 잘못 지우지 않으려는 것이다. 테스트의 Redis 모사가 스크립트 문자열로 분기하도록 내보낸다.
 */
export const RELEASE_LOCK_SCRIPT =
  "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end";

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
   * 활성 executionId 를 **무조건** 새 값으로 바꾼다 (lookup-then-upsert). 읽은 뒤 다른 요청이 대화를
   * 바꿔도 덮어쓴다. executionId 를 비우는 호출(`/cancel` · 실행의 종결 이벤트)은 이 메서드가 아니라
   * `clearExecutionIdIfMatches` 를 쓴다. 지금 운영 코드의 호출자는 없다.
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
   * 대화가 아직 `executionId` 를 가리킬 때만 executionId 를 비운다. 실행의 종결 이벤트가 쓴다.
   *
   * `/start` 는 기존 실행을 취소하고 새 실행을 대화에 잇는다(NERV Task `CLE-T-V4WVF2`). 옛 실행의
   * 종결 이벤트는 그 뒤에 올 수 있다. 무조건 비우면 새 실행의 매핑이 지워져 다음 메시지가 대기 중인
   * 새 실행으로 가지 않고 또 다른 실행을 시작한다. 읽은 값과 저장된 값을 비교해 바꾸므로 읽은 뒤에
   * 다른 요청이 새 실행을 이어도 덮어쓰지 않는다.
   *
   * Redis 미가용 · 오류 시 false (graceful degradation). 비우지 못한 executionId 는 이미 종결된
   * 실행을 가리키므로 다음 메시지가 활성 실행 없음으로 판정한다.
   *
   * @returns 비웠으면 true.
   */
  async clearExecutionIdIfMatches(
    triggerId: string,
    conversationKey: string,
    executionId: string,
  ): Promise<boolean> {
    if (!this.redis) return false;
    const key = this.buildKey(triggerId, conversationKey);
    try {
      for (let attempt = 0; attempt < COMPARE_AND_SET_MAX_ATTEMPTS; attempt++) {
        const raw = await this.redis.get(key);
        if (!raw) return false;
        const state = JSON.parse(raw) as ChannelConversationState;
        if (state.executionId !== executionId) return false;
        state.executionId = null;
        state.lastUpdateAt = new Date().toISOString();
        const swapped = await this.redis.eval(
          COMPARE_AND_SET_SCRIPT,
          1,
          key,
          raw,
          JSON.stringify(state),
          ChannelConversationService.TTL_SEC,
        );
        if (swapped === 1) return true;
      }
      this.logger.warn(
        `ChannelConversationService.clearExecutionIdIfMatches — 동시 쓰기가 이어져 비우지 못했다 (trigger=${triggerId}, execution=${executionId})`,
      );
      return false;
    } catch (err) {
      this.logger.warn(
        `ChannelConversationService.clearExecutionIdIfMatches 실패 — graceful degradation: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
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
      await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, lockKey, token);
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
