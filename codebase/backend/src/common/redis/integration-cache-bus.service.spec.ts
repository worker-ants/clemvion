/**
 * IntegrationCacheBus 단위 테스트 (refactor 04 m-4).
 *
 * credential 회전의 멀티 인스턴스 캐시 무효화 bus 의 전 분기를 검증한다:
 *  - register + 수신 메시지 → 등록 invalidator 실행 (동기/비동기/throw 격리)
 *  - publish: 공유 command 연결로 채널·integrationId PUBLISH
 *  - publish fail-safe: Redis 미가용(null)·publish reject 시 throw 안 함
 *  - onModuleInit: duplicate() 전용 구독 연결 + subscribe, 매칭 채널만 dispatch
 *  - onModuleInit fail-safe: Redis 미가용 시 구독 비활성 (no throw)
 *  - onModuleDestroy: 구독 연결 quit
 *
 * `RedisConnectionProvider` 는 fake 로 대체 — 실제 Redis 없이 publish/duplicate/
 * subscribe/on/quit 호출과 'message' 핸들러 dispatch 만 관찰한다.
 */
import {
  IntegrationCacheBus,
  INTEGRATION_CACHE_INVALIDATE_CHANNEL,
} from './integration-cache-bus.service';
import { RedisConnectionProvider } from './redis-connection.provider';

interface FakeRedis {
  publish: jest.Mock;
  duplicate: jest.Mock;
  subscribe: jest.Mock;
  quit: jest.Mock;
  on: jest.Mock;
  emitMessage: (channel: string, message: string) => void;
  emitError: (err: Error) => void;
}

function makeFakeRedis(): FakeRedis {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const sub: FakeRedis = {
    publish: jest.fn().mockResolvedValue(1),
    subscribe: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
      handlers[event] = cb;
    }),
    duplicate: jest.fn(),
    emitMessage: (channel: string, message: string) =>
      handlers['message']?.(channel, message),
    emitError: (err: Error) => handlers['error']?.(err),
  };
  return sub;
}

function makeProvider(client: FakeRedis | null): RedisConnectionProvider {
  return {
    getClientOrNull: jest.fn().mockReturnValue(client),
  } as unknown as RedisConnectionProvider;
}

describe('IntegrationCacheBus', () => {
  describe('publish', () => {
    it('publishes the integrationId on the invalidate channel', async () => {
      const client = makeFakeRedis();
      const provider = makeProvider(client);
      const bus = new IntegrationCacheBus(provider);

      await bus.publish('int-1');

      expect(client.publish).toHaveBeenCalledWith(
        INTEGRATION_CACHE_INVALIDATE_CHANNEL,
        'int-1',
      );
    });

    it('is a no-op for an empty integrationId', async () => {
      const client = makeFakeRedis();
      const provider = makeProvider(client);
      const bus = new IntegrationCacheBus(provider);

      await bus.publish('');

      expect(client.publish).not.toHaveBeenCalled();
    });

    it('degrades silently when Redis is unavailable', async () => {
      const provider = makeProvider(null);
      const bus = new IntegrationCacheBus(provider);

      await expect(bus.publish('int-1')).resolves.toBeUndefined();
    });

    it('swallows publish rejection (fail-safe)', async () => {
      const client = makeFakeRedis();
      client.publish.mockRejectedValueOnce(new Error('redis down'));
      const provider = makeProvider(client);
      const bus = new IntegrationCacheBus(provider);

      await expect(bus.publish('int-1')).resolves.toBeUndefined();
    });
  });

  describe('subscribe + register', () => {
    it('runs registered invalidators on a matching channel message', () => {
      const sub = makeFakeRedis();
      const base = makeFakeRedis();
      base.duplicate.mockReturnValue(sub);
      const provider = makeProvider(base);
      const bus = new IntegrationCacheBus(provider);

      const a = jest.fn();
      const b = jest.fn();
      bus.register(a);
      bus.register(b);
      bus.onModuleInit();

      expect(sub.subscribe).toHaveBeenCalledWith(
        INTEGRATION_CACHE_INVALIDATE_CHANNEL,
      );

      sub.emitMessage(INTEGRATION_CACHE_INVALIDATE_CHANNEL, 'int-42');

      expect(a).toHaveBeenCalledWith('int-42');
      expect(b).toHaveBeenCalledWith('int-42');
    });

    it('ignores messages on other channels', () => {
      const sub = makeFakeRedis();
      const base = makeFakeRedis();
      base.duplicate.mockReturnValue(sub);
      const provider = makeProvider(base);
      const bus = new IntegrationCacheBus(provider);

      const fn = jest.fn();
      bus.register(fn);
      bus.onModuleInit();

      sub.emitMessage('some:other:channel', 'int-42');

      expect(fn).not.toHaveBeenCalled();
    });

    it('isolates a throwing invalidator from the others', () => {
      const sub = makeFakeRedis();
      const base = makeFakeRedis();
      base.duplicate.mockReturnValue(sub);
      const provider = makeProvider(base);
      const bus = new IntegrationCacheBus(provider);

      const boom = jest.fn(() => {
        throw new Error('evict failed');
      });
      const ok = jest.fn();
      bus.register(boom);
      bus.register(ok);
      bus.onModuleInit();

      expect(() =>
        sub.emitMessage(INTEGRATION_CACHE_INVALIDATE_CHANNEL, 'int-9'),
      ).not.toThrow();
      expect(ok).toHaveBeenCalledWith('int-9');
    });

    it('swallows an async invalidator rejection', async () => {
      const sub = makeFakeRedis();
      const base = makeFakeRedis();
      base.duplicate.mockReturnValue(sub);
      const provider = makeProvider(base);
      const bus = new IntegrationCacheBus(provider);

      const rejecting = jest.fn().mockRejectedValue(new Error('async evict'));
      bus.register(rejecting);
      bus.onModuleInit();

      expect(() =>
        sub.emitMessage(INTEGRATION_CACHE_INVALIDATE_CHANNEL, 'int-7'),
      ).not.toThrow();
      // microtask flush — rejection must not surface as unhandled.
      await Promise.resolve();
      expect(rejecting).toHaveBeenCalledWith('int-7');
    });

    it('does not subscribe when Redis is unavailable (degrade)', () => {
      const provider = makeProvider(null);
      const bus = new IntegrationCacheBus(provider);

      expect(() => bus.onModuleInit()).not.toThrow();
    });

    it('runs the same invalidator only once (Set idempotency)', () => {
      const sub = makeFakeRedis();
      const base = makeFakeRedis();
      base.duplicate.mockReturnValue(sub);
      const provider = makeProvider(base);
      const bus = new IntegrationCacheBus(provider);

      const fn = jest.fn();
      bus.register(fn);
      bus.register(fn); // same reference — must not double-register
      bus.onModuleInit();

      sub.emitMessage(INTEGRATION_CACHE_INVALIDATE_CHANNEL, 'int-1');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('ignores an empty integrationId message', () => {
      const sub = makeFakeRedis();
      const base = makeFakeRedis();
      base.duplicate.mockReturnValue(sub);
      const provider = makeProvider(base);
      const bus = new IntegrationCacheBus(provider);

      const fn = jest.fn();
      bus.register(fn);
      bus.onModuleInit();

      sub.emitMessage(INTEGRATION_CACHE_INVALIDATE_CHANNEL, '');

      expect(fn).not.toHaveBeenCalled();
    });

    it('does not crash on a subscriber error event', () => {
      const sub = makeFakeRedis();
      const base = makeFakeRedis();
      base.duplicate.mockReturnValue(sub);
      const provider = makeProvider(base);
      const bus = new IntegrationCacheBus(provider);

      bus.onModuleInit();

      // 'error' 핸들러가 등록돼 있어 unhandled 로 프로세스를 죽이지 않는다.
      expect(() => sub.emitError(new Error('connection reset'))).not.toThrow();
    });

    it('swallows a subscribe rejection (fail-safe)', async () => {
      const sub = makeFakeRedis();
      sub.subscribe.mockRejectedValueOnce(new Error('subscribe failed'));
      const base = makeFakeRedis();
      base.duplicate.mockReturnValue(sub);
      const provider = makeProvider(base);
      const bus = new IntegrationCacheBus(provider);

      expect(() => bus.onModuleInit()).not.toThrow();
      await Promise.resolve();
    });
  });

  describe('onModuleDestroy', () => {
    it('quits the subscriber connection', async () => {
      const sub = makeFakeRedis();
      const base = makeFakeRedis();
      base.duplicate.mockReturnValue(sub);
      const provider = makeProvider(base);
      const bus = new IntegrationCacheBus(provider);

      bus.onModuleInit();
      await bus.onModuleDestroy();

      expect(sub.quit).toHaveBeenCalled();
    });

    it('is safe when no subscriber was created', async () => {
      const provider = makeProvider(null);
      const bus = new IntegrationCacheBus(provider);

      await expect(bus.onModuleDestroy()).resolves.toBeUndefined();
    });
  });
});
