import { Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import type { Redis } from 'ioredis';
import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';
import { SseFanoutHealth, SseMessageCodec } from './sse-fanout-shared';
import { SseSignalBus, type SseFanoutHandlers } from './sse-signal-bus';
import { SSE_CLOSE_CHANNEL, sseLiveChannel } from './sse-redis-keys';

class FakeSub extends EventEmitter {
  subscribe = jest.fn((..._c: string[]) => Promise.resolve(1));
  unsubscribe = jest.fn((..._c: string[]) => Promise.resolve(1));
  quit = jest.fn(() => Promise.resolve('OK'));
}

const EXEC = '11111111-1111-4111-8111-111111111111';

function evt(seq: number): ExecutionChannelEvent {
  return {
    executionId: EXEC,
    eventType: 'node.completed',
    seq,
    payload: { a: 1 },
  } as ExecutionChannelEvent;
}

function setup(publish?: () => Promise<unknown>) {
  const sub = new FakeSub();
  const base = { duplicate: jest.fn(() => sub) } as unknown as Redis;
  const shared = {
    publish: jest.fn(publish ?? (() => Promise.resolve(1))),
  } as unknown as Redis;
  const logger = new Logger('test');
  const error = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  jest.spyOn(logger, 'log').mockImplementation(() => undefined);
  const metrics = { recordRedisFailOpen: jest.fn() };
  const codec = new SseMessageCodec();
  const bus = new SseSignalBus(
    () => shared,
    codec,
    new SseFanoutHealth(logger),
    logger,
    metrics as never,
  );
  const handlers: jest.Mocked<SseFanoutHandlers> = {
    onLiveEvent: jest.fn(),
    onLiveOmitted: jest.fn(),
    onRemoteClose: jest.fn(),
    onLiveResumed: jest.fn(),
  };
  bus.bind(handlers);
  bus.start(base);
  return { bus, sub, shared, error, metrics, codec, handlers };
}

const flush = () => new Promise((r) => setImmediate(r));

/** 다른 서버 인스턴스가 낸 live 메시지. */
function remoteMessage(codec: SseMessageCodec, seq: number): string {
  return codec
    .encodeEvent(evt(seq))
    .replace(codec.origin, '99999999-9999-4999-8999-999999999999');
}

describe('SseSignalBus', () => {
  describe('재구독', () => {
    it('처음 ready 에서는 닫기 채널과 구독 중인 채널을 구독하되 onLiveResumed 를 부르지 않는다', async () => {
      const { bus, sub, handlers } = setup();
      await bus.retainLive(EXEC);
      sub.emit('ready');
      await flush();
      expect(sub.subscribe).toHaveBeenLastCalledWith(
        SSE_CLOSE_CHANNEL,
        sseLiveChannel(EXEC),
      );
      expect(handlers.onLiveResumed).not.toHaveBeenCalled();
    });

    it('끊겼다가 다시 ready 가 되면 재구독이 확인된 뒤 구독 중인 실행만 onLiveResumed 로 알린다', async () => {
      const { bus, sub, handlers } = setup();
      await bus.retainLive(EXEC);
      sub.emit('ready');
      await flush();
      sub.emit('ready');
      await flush();
      expect(handlers.onLiveResumed).toHaveBeenCalledWith([EXEC]);
    });

    it('재구독이 실패하면 onLiveResumed 를 부르지 않고 카운터를 센다', async () => {
      const { bus, sub, handlers, metrics } = setup();
      await bus.retainLive(EXEC);
      sub.emit('ready');
      await flush();
      sub.subscribe.mockRejectedValueOnce(new Error('resub'));
      sub.emit('ready');
      await flush();
      expect(handlers.onLiveResumed).not.toHaveBeenCalled();
      expect(metrics.recordRedisFailOpen).toHaveBeenCalledWith(
        'sse_fanout',
        'subscribe_failed',
      );
    });
  });

  describe('늦은 SUBSCRIBE 확인', () => {
    beforeEach(() =>
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] }),
    );
    afterEach(() => jest.useRealTimers());

    function slow(sub: FakeSub): () => void {
      let resolve!: (v: number) => void;
      sub.subscribe.mockImplementationOnce(
        () => new Promise<number>((r) => (resolve = r)),
      );
      return () => resolve(1);
    }

    it('상한을 넘겨 false 였다가 늦게 확인되면 onLiveResumed 로 알린다', async () => {
      const { bus, sub, handlers } = setup();
      sub.subscribe.mockClear();
      const confirm = slow(sub);
      const p = bus.retainLive(EXEC);
      jest.advanceTimersByTime(2001);
      await expect(p).resolves.toBe(false);
      confirm();
      await Promise.resolve();
      await Promise.resolve();
      expect(handlers.onLiveResumed).toHaveBeenCalledWith([EXEC]);
    });

    it('늦게 확인되기 전에 구독을 풀었으면 알리지 않는다', async () => {
      const { bus, sub, handlers } = setup();
      const confirm = slow(sub);
      const p = bus.retainLive(EXEC);
      jest.advanceTimersByTime(2001);
      await p;
      bus.releaseLive(EXEC);
      confirm();
      await Promise.resolve();
      await Promise.resolve();
      expect(handlers.onLiveResumed).not.toHaveBeenCalled();
    });
  });

  describe('메시지 받기', () => {
    it('자기가 낸 메시지는 건너뛴다', async () => {
      const { bus, sub, codec, handlers } = setup();
      await bus.retainLive(EXEC);
      sub.emit('message', sseLiveChannel(EXEC), codec.encodeEvent(evt(1)));
      expect(handlers.onLiveEvent).not.toHaveBeenCalled();
    });

    it('다른 서버 인스턴스의 메시지는 onLiveEvent 로 넘긴다', async () => {
      const { bus, sub, codec, handlers } = setup();
      await bus.retainLive(EXEC);
      sub.emit('message', sseLiveChannel(EXEC), remoteMessage(codec, 2));
      expect(handlers.onLiveEvent).toHaveBeenCalledWith(
        expect.objectContaining({ executionId: EXEC, seq: 2 }),
      );
    });

    it('구독하지 않은 실행의 메시지는 버린다', () => {
      const { sub, codec, handlers } = setup();
      sub.emit('message', sseLiveChannel(EXEC), remoteMessage(codec, 3));
      expect(handlers.onLiveEvent).not.toHaveBeenCalled();
    });

    it('다른 서버 인스턴스의 닫기 메시지는 onRemoteClose 로 넘기고 자기 것은 버린다', () => {
      const { sub, codec, handlers } = setup();
      const ids = [
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333',
      ];
      const message = codec.encodeClose(ids);
      sub.emit('message', SSE_CLOSE_CHANNEL, message);
      expect(handlers.onRemoteClose).not.toHaveBeenCalled();
      sub.emit(
        'message',
        SSE_CLOSE_CHANNEL,
        message.replace(codec.origin, '99999999-9999-4999-8999-999999999999'),
      );
      expect(handlers.onRemoteClose).toHaveBeenCalledWith(ids);
    });
  });

  describe('publishClose', () => {
    it('빈 목록이면 발행하지 않는다', async () => {
      const { bus, shared } = setup();
      await bus.publishClose([]);
      expect(shared.publish).not.toHaveBeenCalled();
    });

    it('발행이 실패하면 던지지 않고 호출마다 error 로그와 카운터를 남긴다', async () => {
      const { bus, error, metrics } = setup(() =>
        Promise.reject(new Error('pub boom')),
      );
      await expect(bus.publishClose(['t1'])).resolves.toBeUndefined();
      await expect(bus.publishClose(['t1'])).resolves.toBeUndefined();
      expect(error).toHaveBeenCalledTimes(2);
      expect(error.mock.calls[0][0]).toContain('t1');
      expect(error.mock.calls[0][0]).toContain('pub boom');
      expect(metrics.recordRedisFailOpen).toHaveBeenCalledTimes(2);
      expect(metrics.recordRedisFailOpen).toHaveBeenCalledWith(
        'sse_fanout',
        'publish_failed',
      );
    });
  });
});
