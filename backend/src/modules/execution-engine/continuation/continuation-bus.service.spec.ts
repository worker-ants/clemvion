import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  ContinuationBusService,
  ContinuationMessage,
} from './continuation-bus.service';

/**
 * ioredis 의 publish/subscribe 만 stub 하는 minimal in-memory Redis double.
 * 같은 instance 가 publisher / subscriber 양쪽으로 새로 생성되지만, 동일한
 * registry 를 공유해 채널-구독자 라우팅을 시뮬레이트한다.
 */
type MessageListener = (channel: string, raw: string) => void;

const subscribers = new Map<string, MessageListener[]>();

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
    const remaining = subscribers.get('execution:continuation') ?? [];
    expect(remaining).toHaveLength(0);
    expect(handler).not.toHaveBeenCalled();
  });
});
