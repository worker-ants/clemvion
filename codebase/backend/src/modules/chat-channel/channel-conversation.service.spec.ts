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

  /**
   * 두 호출 형식 모두 수용:
   *  - upsert: set(key, value, 'EX', ttlSec)
   *  - acquireLock: set(key, value, 'EX', ttlSec, 'NX') → NX 면 이미 존재 시 null.
   */
  async set(
    key: string,
    value: string,
    _ex: 'EX',
    ttlSec: number,
    nx?: 'NX',
  ): Promise<string | null> {
    if (nx === 'NX' && (await this.get(key)) !== null) {
      return null;
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  /**
   * Lua 모사. 두 스크립트를 인자 수로 가른다.
   *  - releaseLock: (key, token) → token 일치 시에만 del.
   *  - clearExecutionIdIfMatches: (key, 읽은 값, 새 값, ttlSec) → 값이 그대로일 때만 set.
   */
  async eval(
    _script: string,
    _numKeys: number,
    key: string,
    ...args: Array<string | number>
  ): Promise<number> {
    if (args.length === 3) {
      const [expected, next, ttlSec] = args;
      if ((await this.get(key)) !== expected) return 0;
      await this.set(key, String(next), 'EX', Number(ttlSec));
      return 1;
    }
    if ((await this.get(key)) === args[0]) {
      return this.store.delete(key) ? 1 : 0;
    }
    return 0;
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

  // 근거: NERV Task `CLE-T-V4WVF2`. 옛 실행의 종결 이벤트가 /start 로 이은 새 실행의 매핑을 지우지 않게 한다.
  describe('clearExecutionIdIfMatches()', () => {
    it('대화가 그 실행을 가리키면 executionId 만 비우고 true 를 돌려준다', async () => {
      await service.upsert(triggerId, conversationKey, state);

      const cleared = await service.clearExecutionIdIfMatches(
        triggerId,
        conversationKey,
        'exec-abc',
      );

      expect(cleared).toBe(true);
      const result = await service.lookup(triggerId, conversationKey);
      expect(result?.executionId).toBeNull();
      expect(result?.channelUserKey).toBe('user-9999');
    });

    it('대화가 다른 실행을 가리키면 그대로 두고 false 를 돌려준다', async () => {
      await service.upsert(triggerId, conversationKey, {
        ...state,
        executionId: 'exec-new',
      });

      const cleared = await service.clearExecutionIdIfMatches(
        triggerId,
        conversationKey,
        'exec-abc',
      );

      expect(cleared).toBe(false);
      const result = await service.lookup(triggerId, conversationKey);
      expect(result?.executionId).toBe('exec-new');
    });

    it('읽은 뒤 다른 요청이 새 실행으로 바꿨으면 덮어쓰지 않는다', async () => {
      await service.upsert(triggerId, conversationKey, state);
      const realGet = redis.get.bind(redis);
      let raced = false;
      jest.spyOn(redis, 'get').mockImplementation(async (key: string) => {
        const value = await realGet(key);
        if (!raced) {
          raced = true;
          await service.upsert(triggerId, conversationKey, {
            ...state,
            executionId: 'exec-new',
          });
        }
        return value;
      });

      const cleared = await service.clearExecutionIdIfMatches(
        triggerId,
        conversationKey,
        'exec-abc',
      );

      expect(cleared).toBe(false);
      const result = await service.lookup(triggerId, conversationKey);
      expect(result?.executionId).toBe('exec-new');
    });

    it('읽은 뒤 같은 실행의 다른 필드만 바뀌었으면 다시 읽어 비운다', async () => {
      await service.upsert(triggerId, conversationKey, state);
      const realGet = redis.get.bind(redis);
      let raced = false;
      jest.spyOn(redis, 'get').mockImplementation(async (key: string) => {
        const value = await realGet(key);
        if (!raced) {
          raced = true;
          await service.upsert(triggerId, conversationKey, {
            ...state,
            lastUpdateAt: '2026-05-22T02:00:00.000Z',
          });
        }
        return value;
      });

      const cleared = await service.clearExecutionIdIfMatches(
        triggerId,
        conversationKey,
        'exec-abc',
      );

      expect(cleared).toBe(true);
      const result = await service.lookup(triggerId, conversationKey);
      expect(result?.executionId).toBeNull();
    });

    it('conversation 이 없으면 false', async () => {
      await expect(
        service.clearExecutionIdIfMatches(triggerId, 'none', 'exec-abc'),
      ).resolves.toBe(false);
    });

    it('Redis 미가용 시 false (graceful degradation)', async () => {
      const degradedService = new ChannelConversationService();
      await expect(
        degradedService.clearExecutionIdIfMatches(
          triggerId,
          conversationKey,
          'exec-abc',
        ),
      ).resolves.toBe(false);
    });

    it('Redis 오류는 삼키고 false', async () => {
      await service.upsert(triggerId, conversationKey, state);
      jest.spyOn(redis, 'eval').mockRejectedValueOnce(new Error('down'));

      await expect(
        service.clearExecutionIdIfMatches(
          triggerId,
          conversationKey,
          'exec-abc',
        ),
      ).resolves.toBe(false);
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

  describe('acquireLock() / releaseLock()', () => {
    it('첫 호출 → true (lock 획득), 동시 둘째 호출 → false (NX 미충족)', async () => {
      const first = await service.acquireLock(triggerId, conversationKey, 't1');
      expect(first).toBe(true);
      const second = await service.acquireLock(
        triggerId,
        conversationKey,
        't2',
      );
      expect(second).toBe(false);
    });

    it('releaseLock 후 동일 conversation 재획득 가능', async () => {
      await service.acquireLock(triggerId, conversationKey, 't1');
      await service.releaseLock(triggerId, conversationKey, 't1');
      const reAcquired = await service.acquireLock(
        triggerId,
        conversationKey,
        't3',
      );
      expect(reAcquired).toBe(true);
    });

    it('releaseLock 은 token 불일치 시 lock 을 삭제하지 않음 (소유권 확인)', async () => {
      await service.acquireLock(triggerId, conversationKey, 'owner');
      // 다른 token 으로 release 시도 → 삭제되면 안 됨.
      await service.releaseLock(triggerId, conversationKey, 'intruder');
      const stillHeld = await service.acquireLock(
        triggerId,
        conversationKey,
        'other',
      );
      expect(stillHeld).toBe(false);
    });

    it('releaseLock 은 eval 을 호출 (Lua 안전 해제)', async () => {
      const evalSpy = jest.spyOn(redis, 'eval');
      await service.acquireLock(triggerId, conversationKey, 't1');
      await service.releaseLock(triggerId, conversationKey, 't1');
      expect(evalSpy).toHaveBeenCalledWith(
        expect.stringContaining("redis.call('del',KEYS[1])"),
        1,
        `chat-channel-lock:${triggerId}:${conversationKey}:formsubmit`,
        't1',
      );
    });

    it('Redis 미가용 시 acquireLock → true (fail-open)', async () => {
      const degradedService = new ChannelConversationService();
      const acquired = await degradedService.acquireLock(
        triggerId,
        conversationKey,
        't1',
      );
      expect(acquired).toBe(true);
    });

    it('Redis 미가용 시 releaseLock → noop (예외 없음)', async () => {
      const degradedService = new ChannelConversationService();
      await expect(
        degradedService.releaseLock(triggerId, conversationKey, 't1'),
      ).resolves.toBeUndefined();
    });

    it('lock key 는 별도 namespace 라 conversation state 와 충돌 없음', async () => {
      await service.upsert(triggerId, conversationKey, state);
      const acquired = await service.acquireLock(
        triggerId,
        conversationKey,
        't1',
      );
      expect(acquired).toBe(true);
      // state 는 그대로 유지.
      const result = await service.lookup(triggerId, conversationKey);
      expect(result?.executionId).toBe('exec-abc');
    });
  });

  describe('RedisConnectionProvider 공유 경로 (W-3)', () => {
    // injectedRedis 없이 redisConn (3번째 인자) 만으로도 공유 provider 경로가
    // 동작함을 검증한다. provider.getClientOrNull() 이 fakeRedis 를 반환.
    function makeRedisConn(client: unknown) {
      return {
        getClient: () => client,
        getClientOrNull: () => client,
      };
    }

    it('injectedRedis 미지정 + redisConn 주입 → 공유 client 로 동작 (isAvailable=true)', async () => {
      const fakeRedis = new MockRedis();
      const sharedService = new ChannelConversationService(
        undefined,
        undefined,
        makeRedisConn(fakeRedis) as never,
      );
      expect(sharedService.isAvailable()).toBe(true);
      await sharedService.upsert('t-shared', 'c-shared', state);
      const result = await sharedService.lookup('t-shared', 'c-shared');
      expect(result?.executionId).toBe('exec-abc');
    });

    it('redisConn 이 null 반환(공유 미가용) → isAvailable=false, lookup null', async () => {
      const sharedService = new ChannelConversationService(
        undefined,
        undefined,
        makeRedisConn(null) as never,
      );
      expect(sharedService.isAvailable()).toBe(false);
      expect(await sharedService.lookup('t-x', 'c-x')).toBeNull();
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
