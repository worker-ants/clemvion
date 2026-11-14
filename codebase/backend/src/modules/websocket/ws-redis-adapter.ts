import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import type Redis from 'ioredis';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';

/**
 * Socket.IO Redis adapter 가 쓰는 Redis pub/sub 채널 접두. 채널 이름은 라이브러리가
 * `<접두>#<namespace>#[<room>#]` 형식으로 만든다(예: `ws:sio#/ws#execution:<id>#`).
 * CLE-API-WS-MSG §4.6 「여러 서버 인스턴스에서의 전달」이 정한 값이다.
 */
export const WS_REDIS_ADAPTER_KEY = 'ws:sio';

/** 같은 Redis 명령의 실패 로그를 한 번 남긴 뒤 다시 남기기까지 기다리는 시간. */
export const WS_REDIS_FAILURE_LOG_INTERVAL_MS = 10_000;

/** adapter 가 PUBLISH 하는 명령. 실패를 삼켜 처리되지 않은 rejection 을 막는다. */
const PUBLISHER_GUARDED_METHODS = ['publish'] as const;

/**
 * adapter 가 구독 연결에 보내는 명령. 생성자에서 구독하고 `close()` 에서 해제한다.
 * 앱 종료 때 Nest 는 모듈 destroy 훅(구독 연결 quit)을 소켓 서버 close 보다 먼저 부르므로
 * `close()` 의 해제 명령은 닫힌 연결에서 reject 된다.
 */
const SUBSCRIBER_GUARDED_METHODS = [
  'psubscribe',
  'subscribe',
  'punsubscribe',
  'unsubscribe',
] as const;

export type WsRedisFailureHandler = (method: string, err: unknown) => void;

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { catch?: unknown }).catch === 'function'
  );
}

type SocketIoAdapterFactory = ReturnType<typeof createAdapter>;

/**
 * Redis 클라이언트를 감싸 지정한 명령의 실패(동기 throw · 비동기 reject)를 `onFailure` 로
 * 넘기고 `undefined` 로 끝낸다. 나머지 속성은 원본 클라이언트에 그대로 묶는다.
 *
 * `@socket.io/redis-adapter` 는 `publish` · `psubscribe` 등의 Promise 를 받지 않고 버린다.
 * ioredis 명령은 연결이 끊긴 동안 재시도 한도를 넘기면 reject 하고, 처리되지 않은
 * rejection 은 Node 프로세스를 끝낸다. 이 래퍼가 그 경로를 막는다.
 */
export function guardRedisCommands<T extends object>(
  client: T,
  methods: readonly string[],
  onFailure: WsRedisFailureHandler,
): T {
  return new Proxy(client, {
    get(target, prop) {
      const value: unknown = Reflect.get(target, prop, target);
      // `constructor` 는 묶지 않는다. 라이브러리가 `constructor.name` 으로 클라이언트
      // 종류(Cluster 여부)를 가른다.
      if (typeof value !== 'function' || prop === 'constructor') return value;
      const fn = value as (...args: unknown[]) => unknown;
      if (typeof prop !== 'string' || !methods.includes(prop)) {
        return fn.bind(target) as (...args: unknown[]) => unknown;
      }
      return (...args: unknown[]): unknown => {
        let result: unknown;
        try {
          result = fn.apply(target, args);
        } catch (err) {
          onFailure(prop, err);
          return undefined;
        }
        if (isPromiseLike(result)) {
          return result.catch((err: unknown) => {
            onFailure(prop, err);
            return undefined;
          });
        }
        return result;
      };
    },
  });
}

/**
 * 발행 연결과 구독 연결로 Socket.IO Redis adapter 생성자를 만든다. 두 연결 모두
 * {@link guardRedisCommands} 로 감싸 Redis 장애가 프로세스를 끝내지 않게 한다.
 * 로컬 소켓으로 보내는 일은 adapter 가 PUBLISH 결과와 상관없이 한다.
 */
export function buildWsRedisAdapter(
  publisher: object,
  subscriber: object,
  onFailure: WsRedisFailureHandler,
): SocketIoAdapterFactory {
  return createAdapter(
    guardRedisCommands(publisher, PUBLISHER_GUARDED_METHODS, onFailure),
    guardRedisCommands(subscriber, SUBSCRIBER_GUARDED_METHODS, onFailure),
    { key: WS_REDIS_ADAPTER_KEY },
  );
}

/**
 * WebSocket 게이트웨이(namespace `/ws`)를 여러 서버 인스턴스에 걸쳐 묶는 Redis adapter 를
 * 만든다(CLE-API-WS-MSG §4.6). 채널 발행 패킷만 Redis 를 지나고, 소켓 · 구독 · 구독 한도 ·
 * 빈도 제한 · 토큰 만료 타이머는 인스턴스 로컬이다.
 *
 * - 발행은 공유 command 연결(`RedisConnectionProvider`)로 보낸다. PUBLISH 는 일반 명령이라
 *   공유 연결을 subscriber 모드로 바꾸지 않는다(`IntegrationCacheBus` 와 같은 구성).
 * - 구독은 공유 연결의 `duplicate()` 전용 연결로 받는다. `maxRetriesPerRequest: null` 이라
 *   부팅 때 Redis 가 없으면 PSUBSCRIBE 가 offline queue 에서 연결을 기다린다. 한도(3)를
 *   두면 그 PSUBSCRIBE 가 reject 되고, 연결이 돌아와도 ioredis 의 자동 재구독 목록에 없어
 *   재시작 전까지 다른 인스턴스의 이벤트를 받지 못한다.
 * - Redis 설정이 없으면 `null` 을 돌려주고 게이트웨이는 기본 메모리 adapter 를 쓴다
 *   (단일 인스턴스 동작).
 * - Redis 명령 실패는 로그만 남기고 같은 명령은 {@link WS_REDIS_FAILURE_LOG_INTERVAL_MS}
 *   간격으로 묶는다. 이벤트가 많은 동안 끊기면 PUBLISH 실패가 이벤트마다 나기 때문이다.
 *   놓친 이벤트는 다시 보내지 않는다(구독 때의 `execution.snapshot` 이 상태를 맞춘다).
 */
@Injectable()
export class WsRedisAdapterProvider implements OnModuleDestroy {
  private readonly logger = new Logger(WsRedisAdapterProvider.name);
  private subscriber: Redis | null = null;
  private factory: SocketIoAdapterFactory | null = null;
  private destroyed = false;
  private readonly lastFailureLogAt = new Map<string, number>();
  private readonly suppressedFailures = new Map<string, number>();

  constructor(private readonly redis: RedisConnectionProvider) {}

  /**
   * adapter 생성자를 만든다. Redis 설정이 없으면 `null`. 게이트웨이 초기화 때 부르고,
   * 다시 불러도 구독 연결을 새로 만들지 않고 처음 만든 생성자를 돌려준다.
   */
  createAdapter(): SocketIoAdapterFactory | null {
    if (this.factory) return this.factory;
    const base = this.redis.getClientOrNull();
    if (!base) {
      this.logger.warn(
        'Redis 미설정 — WebSocket 이벤트를 서버 인스턴스 사이에 전달하지 않는다(메모리 adapter).',
      );
      return null;
    }
    const sub = base.duplicate({ maxRetriesPerRequest: null });
    // 연결 단계 오류가 처리되지 않은 'error' 이벤트로 번지지 않게 구독 전에 단다.
    sub.on('error', (err: Error) => {
      this.logFailure('subscriber', err);
    });
    this.subscriber = sub;
    this.factory = buildWsRedisAdapter(base, sub, (method, err) =>
      this.logFailure(method, err),
    );
    return this.factory;
  }

  async onModuleDestroy(): Promise<void> {
    this.destroyed = true;
    const sub = this.subscriber;
    this.subscriber = null;
    if (sub) await sub.quit().catch(() => undefined);
  }

  private logFailure(method: string, err: unknown): void {
    // 종료 중에는 소켓 서버 close 의 구독 해제가 닫힌 연결에서 실패한다. 기대한 실패라 남기지 않는다.
    if (this.destroyed) return;
    const now = Date.now();
    const last = this.lastFailureLogAt.get(method);
    if (last !== undefined && now - last < WS_REDIS_FAILURE_LOG_INTERVAL_MS) {
      this.suppressedFailures.set(
        method,
        (this.suppressedFailures.get(method) ?? 0) + 1,
      );
      return;
    }
    const suppressed = this.suppressedFailures.get(method) ?? 0;
    this.lastFailureLogAt.set(method, now);
    this.suppressedFailures.delete(method);
    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn(
      `WebSocket Redis adapter ${method} 실패 — 서버 인스턴스 사이 전달이 멈출 수 있다: ${message}` +
        (suppressed > 0 ? ` (직전 간격에 같은 실패 ${suppressed}건 생략)` : ''),
    );
  }
}
