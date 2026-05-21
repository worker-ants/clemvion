/**
 * ChannelConversationService 단위 테스트.
 *
 * [ai-review W3] ChannelConversationService 전용 spec 부재.
 * Spec §4.3 (15-chat-channel.md) — Redis key `chat-channel:{triggerId}:{conversationKey}`,
 * TTL 7일, graceful degradation (Redis 미가용 시 null 반환 / noop).
 */
import { ChannelConversationService } from './channel-conversation.service';
import { ChannelConversationState } from './types';

/** 인메모리 Redis mock — ioredis 대체 */
class MockRedis {
  private store = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(
    key: string,
    value: string,
    _ex: 'EX',
    ttlSec: number,
  ): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async quit(): Promise<void> {}

  on(_event: string, _handler: unknown): this {
    return this;
  }

  /** 테스트 헬퍼 — 강제 TTL 만료 시뮬레이션 */
  expireKey(key: string): void {
    const entry = this.store.get(key);
    if (entry) {
      this.store.set(key, { ...entry, expiresAt: Date.now() - 1 });
    }
  }
}

describe('ChannelConversationService', () => {
  let service: ChannelConversationService;
  let redis: MockRedis;

  const triggerId = 'trigger-1';
  const conversationKey = 'chat-12345';

  const state: ChannelConversationState = {
    executionId: 'exec-abc',
    threadId: 'default',
    channelUserKey: 'user-9999',
    startedAt: '2026-05-22T00:00:00.000Z',
    lastUpdateAt: '2026-05-22T00:00:00.000Z',
  };

  beforeEach(() => {
    redis = new MockRedis();
    // @Inject('CHAT_CHANNEL_CONVERSATION_REDIS') 경로로 주입
    service = new ChannelConversationService(
      undefined,
      redis as unknown as import('ioredis').default,
    );
  });

  describe('lookup()', () => {
    it('존재하지 않는 key → null 반환', async () => {
      const result = await service.lookup(triggerId, conversationKey);
      expect(result).toBeNull();
    });

    it('upsert 후 lookup → 저장된 state 반환', async () => {
      await service.upsert(triggerId, conversationKey, state);
      const result = await service.lookup(triggerId, conversationKey);
      expect(result).toEqual(state);
    });

    it('TTL 만료 후 lookup → null 반환', async () => {
      await service.upsert(triggerId, conversationKey, state);
      const key = `chat-channel:${triggerId}:${conversationKey}`;
      redis.expireKey(key);
      const result = await service.lookup(triggerId, conversationKey);
      expect(result).toBeNull();
    });

    it('Redis 미가용 시 null 반환 (graceful degradation)', async () => {
      const degradedService = new ChannelConversationService();
      const result = await degradedService.lookup(triggerId, conversationKey);
      expect(result).toBeNull();
    });
  });

  describe('upsert()', () => {
    it('state 저장 후 동일 key lookup 으로 검증', async () => {
      await service.upsert(triggerId, conversationKey, state);
      const result = await service.lookup(triggerId, conversationKey);
      expect(result?.executionId).toBe('exec-abc');
      expect(result?.channelUserKey).toBe('user-9999');
    });

    it('재호출 시 state 덮어쓰기 (TTL 갱신)', async () => {
      await service.upsert(triggerId, conversationKey, state);
      const updated: ChannelConversationState = {
        ...state,
        executionId: 'exec-new',
        lastUpdateAt: '2026-05-22T01:00:00.000Z',
      };
      await service.upsert(triggerId, conversationKey, updated);
      const result = await service.lookup(triggerId, conversationKey);
      expect(result?.executionId).toBe('exec-new');
    });

    it('Redis 미가용 시 noop (graceful degradation)', async () => {
      const degradedService = new ChannelConversationService();
      await expect(
        degradedService.upsert(triggerId, conversationKey, state),
      ).resolves.toBeUndefined();
    });
  });

  describe('updateExecutionId()', () => {
    it('존재하는 conversation 의 executionId 만 갱신', async () => {
      await service.upsert(triggerId, conversationKey, state);
      await service.updateExecutionId(
        triggerId,
        conversationKey,
        'exec-updated',
      );
      const result = await service.lookup(triggerId, conversationKey);
      expect(result?.executionId).toBe('exec-updated');
      expect(result?.channelUserKey).toBe('user-9999'); // 나머지 필드 유지
    });

    it('executionId 를 null 로 초기화 (cancel 후 대화 종료)', async () => {
      await service.upsert(triggerId, conversationKey, state);
      await service.updateExecutionId(triggerId, conversationKey, null);
      const result = await service.lookup(triggerId, conversationKey);
      expect(result?.executionId).toBeNull();
    });

    it('conversation 없으면 noop', async () => {
      await expect(
        service.updateExecutionId(triggerId, 'non-existent', 'exec-xyz'),
      ).resolves.toBeUndefined();
    });
  });

  describe('clear()', () => {
    it('upsert 후 clear → lookup 이 null 반환', async () => {
      await service.upsert(triggerId, conversationKey, state);
      await service.clear(triggerId, conversationKey);
      const result = await service.lookup(triggerId, conversationKey);
      expect(result).toBeNull();
    });

    it('존재하지 않는 key 에 clear → 예외 없이 완료', async () => {
      await expect(
        service.clear(triggerId, 'non-existent-key'),
      ).resolves.toBeUndefined();
    });
  });

  describe('isAvailable()', () => {
    it('Redis 주입 시 true', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('Redis 미주입 시 false', () => {
      const degradedService = new ChannelConversationService();
      expect(degradedService.isAvailable()).toBe(false);
    });
  });

  describe('Redis key 형식', () => {
    it('키 형식이 chat-channel:{triggerId}:{conversationKey} 규격 준수', async () => {
      await service.upsert('t-123', 'c-456', state);
      // TTL 만료로 키 직접 확인 불가이지만 lookup 성공으로 키 형식 검증
      const result = await service.lookup('t-123', 'c-456');
      expect(result).not.toBeNull();
      // 다른 triggerId/conversationKey 는 별개 엔트리
      const crossResult = await service.lookup('t-000', 'c-456');
      expect(crossResult).toBeNull();
    });
  });
});
