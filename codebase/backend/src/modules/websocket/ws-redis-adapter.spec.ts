import { EventEmitter } from 'node:events';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';
import {
  WS_REDIS_ADAPTER_KEY,
  WS_REDIS_FAILURE_LOG_INTERVAL_MS,
  WsRedisAdapterProvider,
  buildWsRedisAdapter,
  guardRedisCommands,
} from './ws-redis-adapter';

/**
 * 여러 연결이 같은 Redis 를 쓰는 상황을 흉내 내는 메모리 pub/sub. ioredis 처럼
 * `pmessageBuffer`(pattern, channel, message) · `messageBuffer`(channel, message) 를 낸다.
 * 패턴은 adapter 가 쓰는 끝 `*` 하나만 지원한다.
 */
class FakeRedisBus {
  readonly clients = new Set<FakeRedis>();
  readonly published: string[] = [];
}

class FakeRedis extends EventEmitter {
  readonly patterns = new Set<string>();
  readonly channels = new Set<string>();

  constructor(private readonly bus: FakeRedisBus) {
    super();
    bus.clients.add(this);
  }

  async publish(channel: string, message: Buffer | string): Promise<number> {
    this.bus.published.push(channel);
    let receivers = 0;
    for (const client of this.bus.clients) {
      for (const pattern of client.patterns) {
        if (channel.startsWith(pattern.slice(0, -1))) {
          receivers++;
          client.emit(
            'pmessageBuffer',
            Buffer.from(pattern),
            Buffer.from(channel),
            message,
          );
        }
      }
      if (client.channels.has(channel)) {
        receivers++;
        client.emit('messageBuffer', Buffer.from(channel), message);
      }
    }
    return receivers;
  }

  async psubscribe(pattern: string): Promise<number> {
    this.patterns.add(pattern);
    return this.patterns.size;
  }

  async subscribe(channels: string[]): Promise<number> {
    for (const c of channels) this.channels.add(c);
    return this.channels.size;
  }

  async punsubscribe(pattern: string): Promise<number> {
    this.patterns.delete(pattern);
    return this.patterns.size;
  }

  async unsubscribe(channels: string[]): Promise<number> {
    for (const c of channels) this.channels.delete(c);
    return this.channels.size;
  }
}

interface Instance {
  io: Server;
  http: HttpServer;
  url: string;
}

/** 서버 인스턴스 하나. 연결 때 `auth.room` 의 room 에 소켓을 넣는다. */
async function startInstance(
  adapter: ReturnType<typeof buildWsRedisAdapter>,
): Promise<Instance> {
  const http = createServer();
  const io = new Server(http, { transports: ['websocket'] });
  io.adapter(adapter);
  io.of('/ws').on('connection', (socket) => {
    const room = (socket.handshake.auth as { room?: string }).room;
    if (room) void socket.join(room);
  });
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const { port } = http.address() as AddressInfo;
  return { io, http, url: `http://127.0.0.1:${port}` };
}

async function connectClient(
  instance: Instance,
  room: string,
): Promise<ClientSocket> {
  const client = ioClient(`${instance.url}/ws`, {
    transports: ['websocket'],
    auth: { room },
    reconnection: false,
    forceNew: true,
  });
  await new Promise<void>((resolve, reject) => {
    client.once('connect', () => resolve());
    client.once('connect_error', reject);
  });
  return client;
}

function nextEvent<T>(
  client: ClientSocket,
  event: string,
  timeoutMs = 2000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${event} 을 ${timeoutMs}ms 안에 받지 못했다`)),
      timeoutMs,
    );
    client.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** 정해진 시간 동안 이벤트가 오지 않았는지 본다. 받은 payload 를 돌려준다. */
async function collectFor(
  client: ClientSocket,
  event: string,
  ms: number,
): Promise<unknown[]> {
  const received: unknown[] = [];
  const listener = (payload: unknown): void => {
    received.push(payload);
  };
  client.on(event, listener);
  await new Promise((resolve) => setTimeout(resolve, ms));
  client.off(event, listener);
  return received;
}

async function stopInstance(instance: Instance): Promise<void> {
  await new Promise<void>((resolve) => {
    void instance.io.close(() => resolve());
  });
}

describe('guardRedisCommands', () => {
  it('지정한 명령의 reject 를 onFailure 로 넘기고 undefined 로 끝낸다', async () => {
    const boom = new Error('Connection is closed.');
    const client = {
      publish: jest.fn().mockRejectedValue(boom),
    };
    const onFailure = jest.fn();
    const guarded = guardRedisCommands(client, ['publish'], onFailure);

    await expect(guarded.publish('c', 'm')).resolves.toBeUndefined();
    expect(onFailure).toHaveBeenCalledWith('publish', boom);
    expect(client.publish).toHaveBeenCalledWith('c', 'm');
  });

  it('지정한 명령의 동기 throw 도 onFailure 로 넘긴다', () => {
    const boom = new Error('sync');
    const client = {
      psubscribe: jest.fn((_pattern: string): Promise<number> => {
        throw boom;
      }),
    };
    const onFailure = jest.fn();
    const guarded = guardRedisCommands(client, ['psubscribe'], onFailure);

    expect(guarded.psubscribe('p*')).toBeUndefined();
    expect(onFailure).toHaveBeenCalledWith('psubscribe', boom);
  });

  it('성공한 명령의 결과는 그대로 돌려준다', async () => {
    const client = { publish: jest.fn().mockResolvedValue(2) };
    const onFailure = jest.fn();
    const guarded = guardRedisCommands(client, ['publish'], onFailure);

    await expect(guarded.publish('c', 'm')).resolves.toBe(2);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('지정하지 않은 메서드는 원본에 묶어 그대로 부르고 실패를 감싸지 않는다', async () => {
    class Client {
      readonly name = 'client';
      whoAmI(): string {
        return this.name;
      }
      async get(): Promise<string> {
        throw new Error('not guarded');
      }
    }
    const onFailure = jest.fn();
    const guarded = guardRedisCommands(new Client(), ['publish'], onFailure);

    const whoAmI = guarded.whoAmI;
    expect(whoAmI()).toBe('client');
    await expect(guarded.get()).rejects.toThrow('not guarded');
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('constructor 는 묶지 않아 클래스 이름을 그대로 읽는다', () => {
    class Cluster {}
    const guarded = guardRedisCommands(new Cluster(), ['publish'], jest.fn());

    expect(guarded.constructor).toBe(Cluster);
    expect(guarded.constructor.name).toBe('Cluster');
  });
});

describe('buildWsRedisAdapter — 서버 인스턴스 둘', () => {
  let bus: FakeRedisBus;
  const instances: Instance[] = [];
  const clients: ClientSocket[] = [];

  beforeEach(() => {
    bus = new FakeRedisBus();
  });

  afterEach(async () => {
    for (const c of clients.splice(0)) c.disconnect();
    for (const i of instances.splice(0)) await stopInstance(i);
  });

  async function instance(
    onFailure: jest.Mock = jest.fn(),
    pub: FakeRedis = new FakeRedis(bus),
  ): Promise<Instance> {
    const started = await startInstance(
      buildWsRedisAdapter(pub, new FakeRedis(bus), onFailure),
    );
    instances.push(started);
    return started;
  }

  async function client(target: Instance, room: string): Promise<ClientSocket> {
    const c = await connectClient(target, room);
    clients.push(c);
    return c;
  }

  it('B 인스턴스가 채널에 낸 이벤트를 A 인스턴스에 붙은 구독 소켓이 받는다', async () => {
    const a = await instance();
    const b = await instance();
    const subscriber = await client(a, 'execution:e1');

    const received = nextEvent<{ seq: number }>(
      subscriber,
      'execution.started',
    );
    b.io.of('/ws').to('execution:e1').emit('execution.started', { seq: 1 });

    await expect(received).resolves.toEqual({ seq: 1 });
    expect(bus.published).toContain(
      `${WS_REDIS_ADAPTER_KEY}#/ws#execution:e1#`,
    );
  });

  it('다른 채널을 구독한 소켓에는 보내지 않는다', async () => {
    const a = await instance();
    const b = await instance();
    const other = await client(a, 'execution:other');
    const target = await client(a, 'execution:e1');

    const received = nextEvent(target, 'execution.started');
    const leaked = collectFor(other, 'execution.started', 200);
    b.io.of('/ws').to('execution:e1').emit('execution.started', { seq: 1 });

    await received;
    await expect(leaked).resolves.toEqual([]);
  });

  it('PUBLISH 가 실패해도 자기 인스턴스의 구독 소켓에는 보내고 실패를 onFailure 로 넘긴다', async () => {
    const onFailure = jest.fn();
    const failingPub = new FakeRedis(bus);
    const boom = new Error('MaxRetriesPerRequestError');
    jest.spyOn(failingPub, 'publish').mockRejectedValue(boom);
    const a = await instance(onFailure, failingPub);
    const b = await instance();
    const local = await client(a, 'execution:e1');
    const remote = await client(b, 'execution:e1');

    const localReceived = nextEvent(local, 'execution.started');
    const remoteReceived = collectFor(remote, 'execution.started', 200);
    a.io.of('/ws').to('execution:e1').emit('execution.started', { seq: 1 });

    await expect(localReceived).resolves.toEqual({ seq: 1 });
    await expect(remoteReceived).resolves.toEqual([]);
    expect(onFailure).toHaveBeenCalledWith('publish', boom);
  });

  it('구독 명령이 실패하면 onFailure 로 넘기고 서버는 계속 동작한다', async () => {
    const onFailure = jest.fn();
    const sub = new FakeRedis(bus);
    const boom = new Error('Connection is closed.');
    jest.spyOn(sub, 'psubscribe').mockRejectedValue(boom);
    jest.spyOn(sub, 'subscribe').mockRejectedValue(boom);
    const started = await startInstance(
      buildWsRedisAdapter(new FakeRedis(bus), sub, onFailure),
    );
    instances.push(started);
    const local = await client(started, 'execution:e1');

    const received = nextEvent(local, 'execution.started');
    started.io
      .of('/ws')
      .to('execution:e1')
      .emit('execution.started', { seq: 1 });

    await expect(received).resolves.toEqual({ seq: 1 });
    expect(onFailure).toHaveBeenCalledWith('psubscribe', boom);
    expect(onFailure).toHaveBeenCalledWith('subscribe', boom);
  });
});

describe('WsRedisAdapterProvider', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function setup(sub: FakeRedis & { quit?: jest.Mock }): {
    provider: WsRedisAdapterProvider;
    duplicate: jest.Mock;
  } {
    sub.quit = jest.fn().mockResolvedValue('OK');
    const duplicate = jest.fn().mockReturnValue(sub);
    const base = Object.assign(new FakeRedis(new FakeRedisBus()), {
      duplicate,
    });
    const redis = {
      getClientOrNull: () => base,
    } as unknown as RedisConnectionProvider;
    return { provider: new WsRedisAdapterProvider(redis), duplicate };
  }

  it('Redis 설정이 없으면 null 을 돌려주고 경고를 남긴다', () => {
    const redis = {
      getClientOrNull: () => null,
    } as unknown as RedisConnectionProvider;
    const provider = new WsRedisAdapterProvider(redis);

    expect(provider.createAdapter()).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Redis 미설정'));
  });

  it('구독 연결을 maxRetriesPerRequest null 로 duplicate 하고 다시 불러도 같은 생성자를 돌려준다', () => {
    const { provider, duplicate } = setup(new FakeRedis(new FakeRedisBus()));

    const first = provider.createAdapter();
    const second = provider.createAdapter();

    expect(first).toEqual(expect.any(Function));
    expect(second).toBe(first);
    expect(duplicate).toHaveBeenCalledTimes(1);
    expect(duplicate).toHaveBeenCalledWith({ maxRetriesPerRequest: null });
  });

  it('구독 연결 error 이벤트에 핸들러를 달아 처리되지 않은 error 로 번지지 않는다', () => {
    const sub = new FakeRedis(new FakeRedisBus());
    const { provider } = setup(sub);
    provider.createAdapter();

    expect(() => sub.emit('error', new Error('ECONNREFUSED'))).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('subscriber 실패'),
    );
  });

  it('같은 명령의 실패 로그는 간격 안에서 한 번만 남기고 생략 건수를 다음 로그에 붙인다', () => {
    const sub = new FakeRedis(new FakeRedisBus());
    const { provider } = setup(sub);
    provider.createAdapter();
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);

    sub.emit('error', new Error('e1'));
    sub.emit('error', new Error('e2'));
    sub.emit('error', new Error('e3'));
    expect(warn).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_000_000 + WS_REDIS_FAILURE_LOG_INTERVAL_MS);
    sub.emit('error', new Error('e4'));
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenLastCalledWith(
      expect.stringContaining('같은 실패 2건 생략'),
    );
  });

  it('종료 때 구독 연결을 quit 하고 그 뒤의 실패는 남기지 않는다', async () => {
    const sub = new FakeRedis(new FakeRedisBus()) as FakeRedis & {
      quit?: jest.Mock;
    };
    const { provider } = setup(sub);
    provider.createAdapter();

    await provider.onModuleDestroy();
    sub.emit('error', new Error('Connection is closed.'));

    expect(sub.quit).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('adapter 가 붙은 namespace 의 구독 실패를 경고로 남긴다', async () => {
    const sub = new FakeRedis(new FakeRedisBus());
    jest
      .spyOn(sub, 'psubscribe')
      .mockRejectedValue(new Error('Connection is closed.'));
    const { provider } = setup(sub);
    // engine 이 있어야 close() 가 끝난다. 듣지 않는 http 서버에 붙인다.
    const io = new Server(createServer());
    io.adapter(provider.createAdapter()!);
    io.of('/ws');
    await new Promise((resolve) => setImmediate(resolve));

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('psubscribe 실패'),
    );
    await new Promise<void>((resolve) => {
      void io.close(() => resolve());
    });
  });
});
