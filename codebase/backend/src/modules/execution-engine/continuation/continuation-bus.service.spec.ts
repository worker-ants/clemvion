import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  ContinuationBusService,
  ContinuationMessage,
  CONTINUATION_CHANNEL,
} from './continuation-bus.service';

/**
 * ioredis 의 publish/subscribe 만 stub 하는 minimal in-memory Redis double.
 * 같은 instance 가 publisher / subscriber 양쪽으로 새로 생성되지만, 동일한
 * registry 를 공유해 채널-구독자 라우팅을 시뮬레이트한다.
 */
type MessageListener = (channel: string, raw: string) => void;

const subscribers = new Map<string, MessageListener[]>();
// SET NX 시뮬레이션용 in-memory key store (TTL 무시 — 본 테스트는 ms 내 검증).
const kvStore = new Map<string, string>();

class FakeRedis {
  private listeners: MessageListener[] = [];
  private subscribedChannels = new Set<string>();

  on(event: string, listener: MessageListener): this {
    if (event === 'message') {
      this.listeners.push(listener);
    }
    return this;
  }

  async subscribe(channel: string): Promise<number> {
    this.subscribedChannels.add(channel);
    if (!subscribers.has(channel)) subscribers.set(channel, []);
    // 현재 인스턴스의 listener 들을 채널 구독자 목록에 등록.
    for (const lst of this.listeners) {
      subscribers.get(channel)!.push(lst);
    }
    return 1;
  }

  async publish(channel: string, raw: string): Promise<number> {
    const list = subscribers.get(channel) ?? [];
    let count = 0;
    for (const listener of list) {
      try {
        listener(channel, raw);
        count++;
      } catch {
        /* 일부러 흡수 — dispatch error 는 service 로깅 책임 */
      }
    }
    return count;
  }

  /**
   * SET NX 시뮬레이션 — `set(key, value, 'EX', ttl, 'NX')` 시그니처를
   * 단순화해서 NX 분기만 처리. 이미 존재하면 null, 신규는 'OK' 반환.
   * 다른 옵션 조합은 본 테스트 scope 밖.
   */
  async set(
    key: string,
    value: string,
    ..._args: unknown[]
  ): Promise<'OK' | null> {
    const hasNX = _args.some((a) => a === 'NX');
    if (hasNX && kvStore.has(key)) return null;
    kvStore.set(key, value);
    return 'OK';
  }

  /**
   * Lua eval 시뮬레이션 — releaseLock 의 owner 검증 패턴만 처리.
   */
  async eval(
    script: string,
    _numKeys: number,
    key: string,
    arg: string,
  ): Promise<number> {
    if (script.includes("call('get', KEYS[1]) == ARGV[1]")) {
      const stored = kvStore.get(key);
      if (stored === arg) {
        kvStore.delete(key);
        return 1;
      }
      return 0;
    }
    return 0;
  }

  async quit(): Promise<'OK'> {
    for (const ch of this.subscribedChannels) {
      const list = subscribers.get(ch) ?? [];
      subscribers.set(
        ch,
        list.filter((l) => !this.listeners.includes(l)),
      );
    }
    this.listeners = [];
    this.subscribedChannels.clear();
    return 'OK';
  }
}

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => new FakeRedis()),
}));

describe('ContinuationBusService', () => {
  let bus: ContinuationBusService;

  beforeEach(async () => {
    subscribers.clear();
    kvStore.clear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContinuationBusService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'redis.host') return 'localhost';
              if (key === 'redis.port') return 6379;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    bus = module.get(ContinuationBusService);
    await bus.onModuleInit();
  });

  afterEach(async () => {
    await bus.onModuleDestroy();
    subscribers.clear();
    kvStore.clear();
  });

  it('publish → subscribe round-trip 으로 등록된 핸들러를 호출한다', async () => {
    const handler = jest.fn();
    bus.on('continue', handler);

    await bus.publish({
      type: 'continue',
      executionId: 'exec-1',
      payload: { formData: { name: 'Alice' } },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const msg = handler.mock.calls[0][0] as ContinuationMessage;
    expect(msg).toMatchObject({
      type: 'continue',
      executionId: 'exec-1',
      payload: { formData: { name: 'Alice' } },
    });
  });

  it('5 가지 메시지 타입 각각 등록된 핸들러로 디스패치한다', async () => {
    const types = [
      'continue',
      'cancel',
      'button_click',
      'ai_message',
      'ai_end_conversation',
    ] as const;
    const handlers = Object.fromEntries(types.map((t) => [t, jest.fn()]));
    for (const t of types) bus.on(t, handlers[t]);

    for (const t of types) {
      await bus.publish({ type: t, executionId: 'exec-' + t });
    }

    for (const t of types) {
      expect(handlers[t]).toHaveBeenCalledTimes(1);
      const msg = handlers[t].mock.calls[0][0] as ContinuationMessage;
      expect(msg.type).toBe(t);
      expect(msg.executionId).toBe('exec-' + t);
    }
  });

  it('등록되지 않은 타입은 무시한다 (에러 X)', async () => {
    const handler = jest.fn();
    bus.on('continue', handler);

    // cancel 타입은 핸들러 미등록 — 에러 없이 무시.
    await expect(
      bus.publish({ type: 'cancel', executionId: 'exec-2' }),
    ).resolves.not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it('잘못된 JSON 페이로드는 dispatch 시점에 흡수된다', async () => {
    const handler = jest.fn();
    bus.on('continue', handler);

    // 채널 raw 데이터가 invalid 인 경우 — listener 가 직접 raw 를 받으므로
    // 시뮬레이션 위해 publish 는 정상이지만 JSON.parse 실패를 유도하기 위해
    // 별도 raw subscriber 를 호출.
    const noisy = subscribers.get('execution:continuation');
    expect(noisy).toBeDefined();
    for (const listener of noisy ?? []) {
      listener('execution:continuation', '{invalid');
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it('onModuleDestroy 가 connection 정리 후 publish 가 더 이상 dispatch 되지 않는다', async () => {
    const handler = jest.fn();
    bus.on('continue', handler);

    await bus.onModuleDestroy();

    // 원본 publisher 는 quit 됐고, 채널의 listener 는 비워졌다.
    const remaining = subscribers.get(CONTINUATION_CHANNEL) ?? [];
    expect(remaining).toHaveLength(0);
    expect(handler).not.toHaveBeenCalled();
  });

  it('CONTINUATION_CHANNEL 상수와 동일한 채널을 구독한다 (테스트 하드코딩 제거)', () => {
    expect(CONTINUATION_CHANNEL).toBe('execution:continuation');
    expect(subscribers.get(CONTINUATION_CHANNEL) ?? []).not.toHaveLength(0);
  });

  describe('acquireLock / releaseLock', () => {
    it('SET NX semantics — 첫 획득 true, 보유 중 재획득 false', async () => {
      expect(await bus.acquireLock('test-lock', 60)).toBe(true);
      expect(await bus.acquireLock('test-lock', 60)).toBe(false);
    });

    it('releaseLock 후 다시 acquire 가능', async () => {
      expect(await bus.acquireLock('test-lock', 60)).toBe(true);
      expect(await bus.releaseLock('test-lock')).toBe(true);
      expect(await bus.acquireLock('test-lock', 60)).toBe(true);
    });

    it('releaseLock 은 owner token 미일치 시 삭제하지 않는다', async () => {
      // bus 가 lock 획득 후, 다른 인스턴스가 잡은 것처럼 store 의 값을 변조.
      expect(await bus.acquireLock('test-lock', 60)).toBe(true);
      kvStore.set('test-lock', 'someone-else-token');

      // owner mismatch — Lua script 가 0 반환.
      expect(await bus.releaseLock('test-lock')).toBe(false);
      // 변조된 값은 그대로 유지.
      expect(kvStore.get('test-lock')).toBe('someone-else-token');
    });

    it('publisher 에러 시 acquireLock 은 false 를 반환한다 (process crash X)', async () => {
      const publisher = (bus as unknown as { publisher: { set: jest.Mock } })
        .publisher;
      const original = publisher.set;
      publisher.set = jest.fn().mockRejectedValue(new Error('redis down'));
      try {
        expect(await bus.acquireLock('flaky-lock', 60)).toBe(false);
      } finally {
        publisher.set = original;
      }
    });
  });

  describe('publish 에러 처리', () => {
    it('publisher.publish reject 가 호출자에게 전달되지 않고 null 로 흡수된다', async () => {
      const publisher = (
        bus as unknown as { publisher: { publish: jest.Mock } }
      ).publisher;
      const original = publisher.publish;
      publisher.publish = jest.fn().mockRejectedValue(new Error('redis down'));
      try {
        await expect(
          bus.publish({ type: 'continue', executionId: 'exec-down' }),
        ).resolves.toBeNull();
      } finally {
        publisher.publish = original;
      }
    });
  });

  // onModuleInit 이전 (publisher 가 아직 미할당) 인 상태에서 호출되어도
  // process crash 가 나지 않도록 보호하는 가드. NestJS 라이프사이클 race
  // (다른 service.onModuleInit 이 본 service.onModuleInit 보다 먼저 실행되며
  // continuationBus 메서드를 호출하는 케이스) 회귀 방지용.
  describe('publisher 미초기화 가드 — race 방어', () => {
    /**
     * publisher 를 일시적으로 undefined 로 만들고 fn 실행 후 원복한다.
     * 케이스마다 try/finally 를 반복 작성하던 패턴을 한 곳에 모아 의도와
     * cleanup 보장을 명확히 한다.
     */
    const withUninitializedPublisher = async (
      fn: () => Promise<void>,
    ): Promise<void> => {
      const ref = bus as unknown as { publisher?: unknown };
      const original = ref.publisher;
      ref.publisher = undefined;
      try {
        await fn();
      } finally {
        ref.publisher = original;
      }
    };

    it('acquireLock 은 false 를 반환한다 (TypeError throw 없음)', async () => {
      await withUninitializedPublisher(async () => {
        await expect(bus.acquireLock('early-lock', 60)).resolves.toBe(false);
      });
    });

    it('releaseLock 은 false 를 반환한다 (TypeError throw 없음)', async () => {
      await withUninitializedPublisher(async () => {
        await expect(bus.releaseLock('early-lock')).resolves.toBe(false);
      });
    });

    it('publish 는 null 을 반환한다 (TypeError throw 없음)', async () => {
      await withUninitializedPublisher(async () => {
        await expect(
          bus.publish({ type: 'continue', executionId: 'exec-early' }),
        ).resolves.toBeNull();
      });
    });
  });
});
