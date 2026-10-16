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
import type {
  ChannelListenerBus,
  ChannelListenerSubscribedHandler,
} from './channel-listener.bus';
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
