import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
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
export class ChannelConversationService implements OnModuleDestroy {
  private readonly logger = new Logger(ChannelConversationService.name);
  private readonly redis: Redis | null;
  /** Spec §4.3 — TTL 7일. */
  static readonly TTL_SEC = 7 * 24 * 60 * 60;

  constructor(
    @Optional() configService?: ConfigService,
    @Optional()
    @Inject('CHAT_CHANNEL_CONVERSATION_REDIS')
    injectedRedis?: Redis,
  ) {
    if (injectedRedis) {
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
        maxRetriesPerRequest: 2,
      });
      this.redis.on('error', (err) => {
        this.logger.warn(
          `ChannelConversationService Redis error — fail-open: ${err.message}`,
        );
      });
    } catch (err) {
      this.logger.warn(
        `ChannelConversationService: Redis 초기화 실패 — graceful degradation: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.redis = null;
    }
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

  private buildKey(triggerId: string, conversationKey: string): string {
    return `chat-channel:${triggerId}:${conversationKey}`;
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.quit();
    } catch {
      // shutdown 중 실패는 무시
    }
  }
}
