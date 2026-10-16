/**
 * ChannelListenerBus 단위 테스트 (NERV Task `CLE-T-PXTGVQ`).
 *
 * 트리거 단위 listener 레지스트리(`ChannelListenerRegistry`)의 등록 · 해제를 모든 인스턴스에
 * 알리는 Redis pub/sub 채널이다. 본보기는 `IntegrationCacheBus` 이고 같은 fake 로 본다.
 *
 *  - publish: 공유 command 연결로 JSON 메시지를 보낸다. 실패와 Redis 미가용은 삼킨다
 *  - 수신: 다른 인스턴스가 보낸 메시지만 handler 로 넘기고 자기 메시지 · 깨진 메시지는 버린다
 *  - 다시 붙을 때: 구독 연결이 `ready` 가 되면 SUBSCRIBE 응답을 받은 뒤 handler 를 부른다
 *  - onModuleDestroy: 구독 연결을 닫는다
 */
import { Logger } from '@nestjs/common';
import {
  CHAT_CHANNEL_LISTENER_CHANNEL,
  ChannelListenerBus,
} from './channel-listener.bus';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';

interface FakeRedis {
  publish: jest.Mock;
  duplicate: jest.Mock;
  subscribe: jest.Mock;
  quit: jest.Mock;
  on: jest.Mock;
  emit: (event: string, ...args: unknown[]) => void;
}

function makeFakeRedis(): FakeRedis {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    publish: jest.fn().mockResolvedValue(1),
    subscribe: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
      handlers[event] = cb;
    }),
    duplicate: jest.fn(),
    // 진짜 `EventEmitter` 처럼, 리스너 없는 'error' 는 던진다(프로세스를 죽이는 unhandled error).
    emit: (event: string, ...args: unknown[]) => {
      const handler = handlers[event];
      if (handler) return handler(...args);
      if (event === 'error') {
        throw args[0] instanceof Error ? args[0] : new Error(String(args[0]));
      }
    },
  };
}

function makeProvider(client: FakeRedis | null): RedisConnectionProvider {
  return {
    getClientOrNull: jest.fn().mockReturnValue(client),
  } as unknown as RedisConnectionProvider;
}

/** 구독까지 마친 bus 와 그 연결들. */
function makeSubscribedBus() {
  const sub = makeFakeRedis();
  const base = makeFakeRedis();
  base.duplicate.mockReturnValue(sub);
  const bus = new ChannelListenerBus(makeProvider(base));
  bus.onModuleInit();
  return { bus, base, sub };
}

/** 다른 인스턴스가 보낸 것처럼 보이는 메시지. */
function remote(body: Record<string, unknown>): string {
  return JSON.stringify({ v: 1, origin: 'other-instance', ...body });
}

/**
 * 마이크로태스크 대기열이 빌 때까지 기다린다. 틱 수를 세지 않는다 — `subscribe().then(…)` 체인이
 * 길어져도, 그리고 «호출되지 않는다» 를 확인하는 테스트에서도 깊이가 모자란 채 통과하지 않는다.
 */
function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('ChannelListenerBus', () => {
  describe('publish', () => {
    it('공유 연결로 register 메시지를 보낸다', async () => {
      const client = makeFakeRedis();
      const bus = new ChannelListenerBus(makeProvider(client));

      await bus.publish({
        op: 'register',
        triggerId: 't-1',
        provider: 'telegram',
      });

      expect(client.publish).toHaveBeenCalledTimes(1);
      const [channel, message] = client.publish.mock.calls[0] as [
        string,
        string,
      ];
      expect(channel).toBe(CHAT_CHANNEL_LISTENER_CHANNEL);
      expect(JSON.parse(message)).toEqual({
        v: 1,
        origin: expect.any(String),
        op: 'register',
        triggerId: 't-1',
        provider: 'telegram',
      });
    });

    it('unregister 메시지에는 provider 가 없다', async () => {
      const client = makeFakeRedis();
      const bus = new ChannelListenerBus(makeProvider(client));

      await bus.publish({ op: 'unregister', triggerId: 't-1' });

      const message = (client.publish.mock.calls[0] as [string, string])[1];
      expect(JSON.parse(message)).toEqual({
        v: 1,
        origin: expect.any(String),
        op: 'unregister',
        triggerId: 't-1',
      });
    });

    it('Redis 가 없으면 아무것도 하지 않고 끝난다', async () => {
      const bus = new ChannelListenerBus(makeProvider(null));

      await expect(
        bus.publish({ op: 'unregister', triggerId: 't-1' }),
      ).resolves.toBeUndefined();
    });

    it('PUBLISH 가 실패해도 던지지 않는다', async () => {
      const client = makeFakeRedis();
      client.publish.mockRejectedValueOnce(new Error('redis down'));
      const bus = new ChannelListenerBus(makeProvider(client));

      await expect(
        bus.publish({ op: 'register', triggerId: 't-1', provider: 'slack' }),
      ).resolves.toBeUndefined();
    });

    // 공유 연결이 끊겨 있으면 ioredis 는 명령을 쌓아 두었다가 한참 뒤에 거부한다. 변경은 이미 커밋됐고
    // 자기 `Map` 에도 반영돼서 기다려도 얻는 것이 없다.
    describe('PUBLISH 가 응답하지 않을 때', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });
      afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
      });

      it('상한을 넘으면 warn 만 남기고 끝낸다', async () => {
        const warn = jest
          .spyOn(Logger.prototype, 'warn')
          .mockImplementation(() => undefined);
        const client = makeFakeRedis();
        client.publish.mockReturnValue(new Promise(() => undefined)); // 응답이 오지 않는다
        const bus = new ChannelListenerBus(makeProvider(client));

        let done = false;
        const publishing = bus
          .publish({ op: 'unregister', triggerId: 't-1' })
          .then(() => {
            done = true;
          });

        await jest.advanceTimersByTimeAsync(1999);
        expect(done).toBe(false); // 상한 안에서는 응답을 기다린다
        await jest.advanceTimersByTimeAsync(1);
        await publishing;

        expect(done).toBe(true);
        expect(warn).toHaveBeenCalledTimes(1);
        const [message] = warn.mock.calls[0] as [string];
        expect(message).toContain('t-1');
        expect(message).toContain('2000ms');
      });

      it('응답이 상한 안에 오면 타이머를 남기지 않는다', async () => {
        const client = makeFakeRedis();
        const bus = new ChannelListenerBus(makeProvider(client));

        await bus.publish({ op: 'unregister', triggerId: 't-1' });

        expect(jest.getTimerCount()).toBe(0);
      });

      it('상한을 넘긴 뒤 늦게 거부돼도 처리되지 않은 거부로 새지 않는다', async () => {
        jest
          .spyOn(Logger.prototype, 'warn')
          .mockImplementation(() => undefined);
        const client = makeFakeRedis();
        let rejectLate: (err: Error) => void = () => undefined;
        client.publish.mockReturnValue(
          new Promise((_resolve, reject) => {
            rejectLate = reject;
          }),
        );
        const unhandled = jest.fn();
        process.on('unhandledRejection', unhandled);
        try {
          const bus = new ChannelListenerBus(makeProvider(client));
          const publishing = bus.publish({
            op: 'unregister',
            triggerId: 't-1',
          });
          await jest.advanceTimersByTimeAsync(2000);
          await publishing;

          jest.useRealTimers(); // 가짜 타이머는 setImmediate 도 막는다
          rejectLate(new Error('late redis down'));
          await new Promise<void>((resolve) => setImmediate(resolve));

          expect(unhandled).not.toHaveBeenCalled();
        } finally {
          process.off('unhandledRejection', unhandled);
        }
      });
    });
  });

  describe('수신', () => {
    it('전용 duplicate 연결로 채널을 구독한다', () => {
      const { base, sub } = makeSubscribedBus();

      expect(base.duplicate).toHaveBeenCalledTimes(1);
      expect(sub.subscribe).toHaveBeenCalledWith(CHAT_CHANNEL_LISTENER_CHANNEL);
      // PUBLISH 는 공유 연결로만 간다 — 구독 연결은 subscriber 모드라 command 를 못 보낸다.
      expect(base.subscribe).not.toHaveBeenCalled();
    });

    it('다른 인스턴스의 register · unregister 를 handler 로 넘긴다', () => {
      const { bus, sub } = makeSubscribedBus();
      const handler = jest.fn();
      bus.onChange(handler);

      sub.emit(
        'message',
        CHAT_CHANNEL_LISTENER_CHANNEL,
        remote({ op: 'register', triggerId: 't-1', provider: 'discord' }),
      );
      sub.emit(
        'message',
        CHAT_CHANNEL_LISTENER_CHANNEL,
        remote({ op: 'unregister', triggerId: 't-1' }),
      );

      expect(handler.mock.calls).toEqual([
        [{ op: 'register', triggerId: 't-1', provider: 'discord' }],
        [{ op: 'unregister', triggerId: 't-1' }],
      ]);
    });

    it('자기가 보낸 메시지는 건너뛴다', async () => {
      const { bus, base, sub } = makeSubscribedBus();
      const handler = jest.fn();
      bus.onChange(handler);

      await bus.publish({ op: 'unregister', triggerId: 't-1' });
      const own = (base.publish.mock.calls[0] as [string, string])[1];
      sub.emit('message', CHAT_CHANNEL_LISTENER_CHANNEL, own);

      expect(handler).not.toHaveBeenCalled();
    });

    it('다른 채널의 메시지는 버린다', () => {
      const { bus, sub } = makeSubscribedBus();
      const handler = jest.fn();
      bus.onChange(handler);

      sub.emit(
        'message',
        'integration:cache:invalidate',
        remote({ op: 'unregister', triggerId: 't-1' }),
      );

      expect(handler).not.toHaveBeenCalled();
    });

    it.each([
      ['JSON 이 아니다', 'not-json'],
      [
        '버전이 다르다',
        JSON.stringify({
          v: 2,
          origin: 'x',
          op: 'unregister',
          triggerId: 't-1',
        }),
      ],
      ['op 를 모른다', remote({ op: 'clear', triggerId: 't-1' })],
      ['triggerId 가 비었다', remote({ op: 'unregister', triggerId: '' })],
      [
        'register 에 provider 가 없다',
        remote({ op: 'register', triggerId: 't-1' }),
      ],
      [
        'provider 가 문자열이 아니다',
        remote({ op: 'register', triggerId: 't-1', provider: 7 }),
      ],
      [
        'origin 이 없다',
        JSON.stringify({ v: 1, op: 'unregister', triggerId: 't-1' }),
      ],
      ['배열이다', '[]'],
    ])('깨진 메시지는 버린다 (%s)', (_label, message) => {
      const { bus, sub } = makeSubscribedBus();
      const handler = jest.fn();
      bus.onChange(handler);

      expect(() =>
        sub.emit('message', CHAT_CHANNEL_LISTENER_CHANNEL, message),
      ).not.toThrow();
      expect(handler).not.toHaveBeenCalled();
    });

    it('handler 하나가 던져도 다른 handler 는 받는다', () => {
      const { bus, sub } = makeSubscribedBus();
      const ok = jest.fn();
      bus.onChange(() => {
        throw new Error('boom');
      });
      bus.onChange(ok);

      expect(() =>
        sub.emit(
          'message',
          CHAT_CHANNEL_LISTENER_CHANNEL,
          remote({ op: 'unregister', triggerId: 't-1' }),
        ),
      ).not.toThrow();
      expect(ok).toHaveBeenCalledTimes(1);
    });

    it('Redis 가 없으면 구독하지 않고 던지지도 않는다', () => {
      const bus = new ChannelListenerBus(makeProvider(null));

      expect(() => bus.onModuleInit()).not.toThrow();
    });

    it('SUBSCRIBE 가 실패해도 던지지 않는다', async () => {
      const sub = makeFakeRedis();
      sub.subscribe.mockRejectedValueOnce(new Error('subscribe failed'));
      const base = makeFakeRedis();
      base.duplicate.mockReturnValue(sub);
      const bus = new ChannelListenerBus(makeProvider(base));

      expect(() => bus.onModuleInit()).not.toThrow();
      await flush();
    });

    it('구독 연결의 error 이벤트가 프로세스를 죽이지 않고 로그로 남는다', () => {
      const { sub } = makeSubscribedBus();
      const error = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      try {
        // 리스너가 없으면 fake 도 진짜 EventEmitter 처럼 던진다 — `sub.on('error', …)` 를 지우면 여기서 실패한다.
        expect(() =>
          sub.emit('error', new Error('connection reset')),
        ).not.toThrow();
        expect(error).toHaveBeenCalledWith(
          expect.stringContaining('connection reset'),
        );
      } finally {
        error.mockRestore();
      }
    });
  });

  describe('구독 연결이 ready 가 될 때', () => {
    it('SUBSCRIBE 응답을 받은 뒤 onSubscribed handler 를 부른다', async () => {
      const { bus, sub } = makeSubscribedBus();
      const order: string[] = [];
      let ack: (n: number) => void = () => undefined;
      sub.subscribe.mockImplementationOnce(() => {
        order.push('subscribe');
        return new Promise<number>((resolve) => {
          ack = resolve;
        });
      });
      bus.onSubscribed(() => {
        order.push('handler');
      });

      sub.emit('ready');
      await flush();
      // 응답 전에는 부르지 않는다 — 그 사이 다른 인스턴스가 보낸 메시지를 놓칠 수 있다.
      expect(order).toEqual(['subscribe']);

      ack(1);
      await flush();
      expect(order).toEqual(['subscribe', 'handler']);
    });

    it('다시 붙을 때마다 부른다', async () => {
      const { bus, sub } = makeSubscribedBus();
      const handler = jest.fn();
      bus.onSubscribed(handler);

      sub.emit('ready');
      await flush();
      sub.emit('ready');
      await flush();

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('SUBSCRIBE 가 실패하면 handler 를 부르지 않는다', async () => {
      const { bus, sub } = makeSubscribedBus();
      sub.subscribe.mockRejectedValueOnce(new Error('subscribe failed'));
      const handler = jest.fn();
      bus.onSubscribed(handler);

      sub.emit('ready');
      await flush();

      expect(handler).not.toHaveBeenCalled();
    });

    it('handler 하나가 거부해도 다음 handler 를 부른다', async () => {
      const { bus, sub } = makeSubscribedBus();
      const rejecting = jest.fn().mockRejectedValue(new Error('db down'));
      const next = jest.fn();
      bus.onSubscribed(rejecting);
      bus.onSubscribed(next);

      sub.emit('ready');
      await flush();

      expect(rejecting).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('동기로 던지는 handler 도 다음 handler 를 막지 않는다', async () => {
      const { bus, sub } = makeSubscribedBus();
      const next = jest.fn();
      bus.onSubscribed(() => {
        throw new Error('sync boom');
      });
      bus.onSubscribed(next);

      sub.emit('ready');
      await flush();

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('onModuleDestroy', () => {
    it('구독 연결을 닫는다', async () => {
      const { bus, sub } = makeSubscribedBus();

      await bus.onModuleDestroy();

      expect(sub.quit).toHaveBeenCalled();
    });

    it('구독 연결이 없어도 안전하다', async () => {
      const bus = new ChannelListenerBus(makeProvider(null));

      await expect(bus.onModuleDestroy()).resolves.toBeUndefined();
    });
  });
});
