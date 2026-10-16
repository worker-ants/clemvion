/**
 * ChatChannelModule 의 listener 레지스트리 복원 단위 테스트.
 *
 * 채팅 채널 「R8 트리거 단위 listener 정책」: 재시작하면 `isActive=true AND config.chatChannel`
 * 트리거를 한 번에 등록한다. NERV Task `CLE-T-PXTGVQ` 부터는 listener 구독 연결이 (다시)
 * 붙을 때마다 같은 복원을 한다.
 */
import type { Repository } from 'typeorm';
import { ChatChannelModule } from './chat-channel.module';
import { ChannelListenerRegistry } from './channel-listener.registry';
import {
  ChannelListenerBus,
  type ChannelListenerSubscribedHandler,
} from './channel-listener.bus';
import type { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';
import type { ChannelAdapterRegistry } from './channel-adapter.registry';
import type { TelegramAdapter } from './providers/telegram/telegram.adapter';
import type { SlackAdapter } from './providers/slack/slack.adapter';
import type { DiscordAdapter } from './providers/discord/discord.adapter';
import type { Trigger } from '../triggers/entities/trigger.entity';

function makeRepo(rows: Array<Pick<Trigger, 'id' | 'config'>>) {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(rows),
  };
  const repo = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  } as unknown as Repository<Trigger>;
  return { repo, qb };
}

function makeBus() {
  const handlers: ChannelListenerSubscribedHandler[] = [];
  const bus = {
    onChange: jest.fn(),
    publish: jest.fn().mockResolvedValue(undefined),
    onSubscribed: jest.fn((h: ChannelListenerSubscribedHandler) =>
      handlers.push(h),
    ),
  } as unknown as ChannelListenerBus;
  return {
    bus,
    resubscribed: async () => {
      for (const h of handlers) await h();
    },
  };
}

function makeModule(
  repo: Repository<Trigger>,
  listenerRegistry: ChannelListenerRegistry,
  bus: ChannelListenerBus,
): ChatChannelModule {
  const adapterRegistry = {
    register: jest.fn(),
  } as unknown as ChannelAdapterRegistry;
  return new ChatChannelModule(
    adapterRegistry,
    listenerRegistry,
    {} as TelegramAdapter,
    {} as SlackAdapter,
    {} as DiscordAdapter,
    repo,
    bus,
  );
}

describe('ChatChannelModule listener 레지스트리 복원', () => {
  it('부팅 때 활성 채팅 채널 트리거만 고르는 조건으로 DB 를 읽는다', async () => {
    const { repo, qb } = makeRepo([]);
    const { bus } = makeBus();
    const registry = new ChannelListenerRegistry(bus);

    await makeModule(repo, registry, bus).onApplicationBootstrap();

    expect(qb.where).toHaveBeenCalledWith('t.is_active = true');
    expect(qb.andWhere).toHaveBeenCalledWith(
      "t.config ->> 'chatChannel' IS NOT NULL",
    );
  });

  it('provider 가 있는 행만 등록한다', async () => {
    const { repo } = makeRepo([
      { id: 't-tg', config: { chatChannel: { provider: 'telegram' } } },
      { id: 't-empty', config: { chatChannel: { provider: '' } } },
      { id: 't-none', config: { chatChannel: {} } },
      { id: 't-null', config: null },
    ] as Array<Pick<Trigger, 'id' | 'config'>>);
    const { bus } = makeBus();
    const registry = new ChannelListenerRegistry(bus);

    await makeModule(repo, registry, bus).onApplicationBootstrap();

    expect(registry.size()).toBe(1);
    expect(registry.get('t-tg')?.provider).toBe('telegram');
  });

  // Redis 가 없으면 구독이 붙지 않아 `onSubscribed` handler 는 한 번도 불리지 않는다.
  it('구독이 붙지 않아도 부팅 때 복원한다', async () => {
    const { repo } = makeRepo([
      { id: 't-1', config: { chatChannel: { provider: 'slack' } } },
    ] as Array<Pick<Trigger, 'id' | 'config'>>);
    const { bus } = makeBus();
    const registry = new ChannelListenerRegistry(bus);

    await makeModule(repo, registry, bus).onApplicationBootstrap();

    expect(registry.has('t-1')).toBe(true);
  });

  it('구독이 다시 붙으면 DB 를 다시 읽어 그 사이 켜진 트리거를 등록한다', async () => {
    const rows: Array<Pick<Trigger, 'id' | 'config'>> = [];
    const { repo, qb } = makeRepo(rows);
    qb.getMany.mockImplementation(() => Promise.resolve([...rows]));
    const { bus, resubscribed } = makeBus();
    const registry = new ChannelListenerRegistry(bus);

    await makeModule(repo, registry, bus).onApplicationBootstrap();
    expect(registry.has('t-late')).toBe(false);

    // 구독이 끊긴 사이 다른 인스턴스가 켠 트리거 — 알림은 놓쳤고 DB 에만 있다.
    rows.push({
      id: 't-late',
      config: { chatChannel: { provider: 'discord' } },
    } as Pick<Trigger, 'id' | 'config'>);
    await resubscribed();

    expect(registry.get('t-late')?.provider).toBe('discord');
    expect(qb.getMany).toHaveBeenCalledTimes(2);
  });

  it('복원은 다른 인스턴스에 알리지 않는다', async () => {
    const { repo } = makeRepo([
      { id: 't-1', config: { chatChannel: { provider: 'telegram' } } },
    ] as Array<Pick<Trigger, 'id' | 'config'>>);
    const { bus, resubscribed } = makeBus();
    const registry = new ChannelListenerRegistry(bus);

    await makeModule(repo, registry, bus).onApplicationBootstrap();
    await resubscribed();

    expect(registry.has('t-1')).toBe(true);
    expect(bus.publish).not.toHaveBeenCalled();
  });
});

/**
 * 첫 연결의 순서. 구독은 `ChannelListenerBus.onModuleInit` 에서 시작하고 handler 는 모든
 * `onModuleInit` 이 끝난 뒤 `onApplicationBootstrap` 에서 등록된다. 첫 SUBSCRIBE 응답이 어느 쪽에
 * 오든 «응답 뒤의 DB 읽기가 적어도 한 번 있어야» 구독이 확립되기 전에 DB 를 읽고 발행을 놓친
 * 등록이 남지 않는다. 진짜 bus 와 fake Redis 연결로 두 순서를 모두 본다.
 */
describe('ChatChannelModule 첫 연결의 SUBSCRIBE 응답 순서', () => {
  /** 이벤트를 순서대로 기록하는 구독 연결 · DB 대역. 응답은 `ack()` 로 줄 때까지 오지 않는다. */
  function setup() {
    const events: string[] = [];
    const rows: Array<Pick<Trigger, 'id' | 'config'>> = [];
    const { repo, qb } = makeRepo(rows);
    qb.getMany.mockImplementation(() => {
      events.push('db-read');
      return Promise.resolve([...rows]);
    });

    const handlers: Record<string, (...args: unknown[]) => void> = {};
    let respond: (n: number) => void = () => undefined;
    const response = new Promise<number>((resolve) => {
      respond = resolve;
    });
    const sub = {
      on: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
        handlers[event] = cb;
      }),
      subscribe: jest.fn().mockReturnValue(response),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    const base = { duplicate: jest.fn().mockReturnValue(sub) };
    const bus = new ChannelListenerBus({
      getClientOrNull: () => base,
    } as unknown as RedisConnectionProvider);
    const registry = new ChannelListenerRegistry(bus);
    const module = makeModule(repo, registry, bus);

    // 이벤트 루프를 한 바퀴 돌려 SUBSCRIBE 응답 뒤에 이어지는 처리까지 끝낸다.
    const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
    return {
      events,
      rows,
      qb,
      registry,
      module,
      /** `ChannelListenerBus.onModuleInit` 을 부르고 연결이 `ready` 가 됐다고 알린다. */
      connect: () => {
        bus.onModuleInit();
        handlers.ready?.();
      },
      ack: async () => {
        events.push('ack');
        respond(1);
        await settle();
      },
      settle,
    };
  }

  const dbReadsAfterAck = (events: string[]) =>
    events.slice(events.indexOf('ack') + 1).filter((e) => e === 'db-read')
      .length;

  it('응답이 handler 등록보다 먼저 오면 등록 직후의 부팅 복원이 응답 뒤에 DB 를 읽는다', async () => {
    const { events, rows, registry, module, connect, ack } = setup();

    connect();
    await ack(); // handler 가 없는 채로 응답이 지나간다

    // 응답 뒤, 부팅 복원 전에 다른 인스턴스가 켠 트리거 — 알림은 구독 확립 전이라 놓쳤다.
    rows.push({
      id: 't-between',
      config: { chatChannel: { provider: 'telegram' } },
    } as Pick<Trigger, 'id' | 'config'>);
    await module.onApplicationBootstrap();

    expect(events).toEqual(['ack', 'db-read']);
    expect(dbReadsAfterAck(events)).toBeGreaterThanOrEqual(1);
    expect(registry.get('t-between')?.provider).toBe('telegram');
  });

  it('응답이 handler 등록보다 늦으면 응답 뒤에 handler 가 DB 를 다시 읽는다', async () => {
    const { events, rows, registry, module, connect, ack } = setup();

    connect(); // 응답이 아직 오지 않았다
    await module.onApplicationBootstrap(); // 응답 앞의 DB 읽기

    // 부팅 복원이 읽은 뒤 응답이 오기 전에 다른 인스턴스가 켠 트리거.
    rows.push({
      id: 't-between',
      config: { chatChannel: { provider: 'discord' } },
    } as Pick<Trigger, 'id' | 'config'>);
    expect(registry.has('t-between')).toBe(false);
    await ack();

    expect(events).toEqual(['db-read', 'ack', 'db-read']);
    expect(dbReadsAfterAck(events)).toBeGreaterThanOrEqual(1);
    expect(registry.get('t-between')?.provider).toBe('discord');
  });

  // 위 두 경우는 응답을 부팅 복원이 «끝나기 전» 이나 «끝난 뒤» 에만 보낸다. 읽기가 진행 중인 동안
  // 응답이 오는 경우가 handler 등록과 복원 시작의 순서를 바꿨을 때 놓침이 생기는 유일한 인터리빙이다.
  // 복원을 먼저 시작하고 handler 를 나중에 등록하면 이 응답은 handler 없이 지나가고, 응답 앞에서
  // 시작한 읽기만 남는다.
  it('응답이 DB 읽기 도중에 오면 그 읽기가 끝난 뒤 응답 뒤의 읽기를 한 번 더 한다', async () => {
    const { events, rows, qb, registry, module, connect, ack } = setup();
    let finishFirstRead: () => void = () => undefined;
    qb.getMany.mockImplementationOnce(() => {
      events.push('db-read');
      const snapshot = [...rows]; // 읽기가 시작될 때의 DB
      return new Promise((resolve) => {
        finishFirstRead = () => resolve(snapshot);
      });
    });

    connect(); // 응답이 아직 오지 않았다
    const booting = module.onApplicationBootstrap(); // 첫 읽기가 끝나지 않은 채로 둔다

    // 읽기가 시작된 뒤 다른 인스턴스가 켠 트리거 — 알림은 구독 확립 전이라 놓쳤고 첫 읽기도 못 본다.
    rows.push({
      id: 't-between',
      config: { chatChannel: { provider: 'slack' } },
    } as Pick<Trigger, 'id' | 'config'>);
    await ack(); // 읽는 도중에 응답이 온다
    finishFirstRead();
    await booting;

    expect(events).toEqual(['db-read', 'ack', 'db-read']);
    expect(dbReadsAfterAck(events)).toBeGreaterThanOrEqual(1);
    expect(registry.get('t-between')?.provider).toBe('slack');
  });
});
