import { Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Trigger } from '../triggers/entities/trigger.entity';
import { WebsocketModule } from '../websocket/websocket.module';
import { ChannelAdapterRegistry } from './channel-adapter.registry';
import { ChannelListenerRegistry } from './channel-listener.registry';
import { ChannelListenerBus } from './channel-listener.bus';
import { ChannelConversationService } from './channel-conversation.service';
import { ChatChannelRateLimiterService } from './chat-channel-rate-limiter.service';
import { ChatChannelDedupService } from './chat-channel-dedup.service';
import { ChatChannelDispatcher } from './chat-channel.dispatcher';
import { TelegramAdapter } from './providers/telegram/telegram.adapter';
import { TelegramClient } from './providers/telegram/telegram-client';
import { SlackAdapter } from './providers/slack/slack.adapter';
import { SlackClient } from './providers/slack/slack-client';
import { DiscordAdapter } from './providers/discord/discord.adapter';
import { DiscordClient } from './providers/discord/discord-client';
import { SecretStoreModule } from '../secret-store/secret-store.module';
import { ChatChannelInboundAuthenticator } from './chat-channel-inbound-authenticator';
import { readTriggerChatChannelProvider } from './chat-channel-secret-refs';

/**
 * Chat Channel 어댑터 모듈.
 *
 * Spec §7 (15-chat-channel.md) 의 모듈 구조:
 *   - ChannelAdapterRegistry: provider 등록·조회
 *   - ChannelConversationService: Redis ChannelConversation CRUD
 *   - ChatChannelDispatcher: WebsocketService.executionEvents$ subscribe → adapter.sendMessage
 *   - providers/telegram: 텔레그램 어댑터 (Phase 2 에서 구체 구현)
 *
 * `external-interaction` 과 동등한 facade 계층 — 둘 다 엔진 외부.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Trigger]),
    WebsocketModule,
    SecretStoreModule,
  ],
  controllers: [],
  providers: [
    ChannelAdapterRegistry,
    ChannelListenerBus,
    ChannelListenerRegistry,
    ChannelConversationService,
    ChatChannelRateLimiterService,
    ChatChannelDedupService,
    ChatChannelDispatcher,
    ChatChannelInboundAuthenticator,
    TelegramClient,
    TelegramAdapter,
    SlackClient,
    SlackAdapter,
    DiscordClient,
    DiscordAdapter,
  ],
  exports: [
    ChannelAdapterRegistry,
    ChannelListenerRegistry,
    ChannelConversationService,
    ChatChannelRateLimiterService,
    ChatChannelDedupService,
    ChatChannelInboundAuthenticator,
  ],
})
export class ChatChannelModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(ChatChannelModule.name);
  /** 진행 중인 복원. 없으면 `null`. */
  private restoring: Promise<void> | null = null;
  /** 진행 중인 읽기가 시작된 뒤에 복원 요청이 들어왔다. */
  private restoreRequested = false;
  /** 다음 읽기의 로그에 쓸 출처. 요청마다 갱신하므로 합쳐진 읽기는 마지막 요청의 것을 쓴다. */
  private restoreSource = '';

  constructor(
    private readonly registry: ChannelAdapterRegistry,
    private readonly listenerRegistry: ChannelListenerRegistry,
    private readonly telegramAdapter: TelegramAdapter,
    private readonly slackAdapter: SlackAdapter,
    private readonly discordAdapter: DiscordAdapter,
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
    private readonly listenerBus: ChannelListenerBus,
  ) {
    // onModuleInit 대신 constructor — 어댑터 인스턴스는 NestJS DI 시점에 ready.
    this.registry.register(this.telegramAdapter);
    this.registry.register(this.slackAdapter);
    this.registry.register(this.discordAdapter);
  }

  /**
   * [Spec R8 v1 적용 (2026-05-24)] hot reload / process restart 후 listener registry 가
   * 비어있는 상태를 DB 로부터 일괄 복원. active trigger + chatChannel 설정된 것만 register.
   *
   * `onApplicationBootstrap` 은 NestJS 의 모든 모듈 init 완료 + DB 연결 준비 완료 후 실행.
   * `onModuleInit` (constructor 시점) 에서는 typeorm repository 의 query 가 안전하지 않음.
   *
   * listener 구독 연결이 (다시) 붙을 때마다 같은 복원을 한 번 더 한다(NERV Task `CLE-T-PXTGVQ`).
   * 끊긴 사이 다른 인스턴스가 알린 등록은 pub/sub 에 남지 않기 때문이다. 이유와 순서는
   * `ChannelListenerBus` 머리 주석에 있다. 여기서도 바로 복원하는 것은 Redis 가 없어 구독이
   * 붙지 않는 경우에도 이 인스턴스의 레지스트리를 채우기 위해서이고, 첫 SUBSCRIBE 응답이 handler
   * 등록보다 먼저 온 경우의 응답 뒤 DB 읽기도 이 복원이 맡는다. handler 를 먼저 등록하고 그 뒤에
   * 복원을 시작하는 순서가 그 보장의 전제다. 구독이 반복해서 다시 붙어도 읽기가 겹치지 않도록
   * {@link restoreActiveListeners} 가 요청을 합친다.
   */
  async onApplicationBootstrap(): Promise<void> {
    this.listenerBus.onSubscribed(() =>
      this.restoreActiveListeners('listener 재구독 뒤 복원'),
    );
    await this.restoreActiveListeners('bootstrap 복원');
  }

  /**
   * 활성 채팅 채널 트리거를 DB 에서 읽어 레지스트리에 일괄 등록한다. 읽기는 한 번에 하나만 돈다.
   *
   * 구독 연결이 반복해서 끊기면 `ready` 마다 요청이 와서 한 인스턴스 안에서 조회가 겹쳐 돈다.
   * 그래서 읽기가 진행 중일 때 온 요청은 새 읽기를 시작하지 않고, 그 읽기가 끝난 뒤 한 번만 더
   * 읽는 것으로 합친다. 인스턴스끼리 같은 순간에 읽는 것은 막지 못한다. 진행 중인 읽기는 요청보다 먼저 시작했다. 요청이
   * 기다리는 것은 «SUBSCRIBE 응답 뒤에 시작한 읽기» 라서 그 읽기로는 요청을 채울 수 없고, 뒤이은 한
   * 번의 읽기가 그 사이에 쌓인 요청을 모두 채운다. 돌려주는 promise 는 요청이 들어온 뒤에 시작한
   * 읽기까지 끝나야 이행된다.
   */
  private restoreActiveListeners(source: string): Promise<void> {
    this.restoreSource = source;
    this.restoreRequested = true;
    this.restoring ??= this.drainRestoreRequests();
    return this.restoring;
  }

  /** 쌓인 요청이 없어질 때까지 읽는다. 끝나는 자리에서 `restoring` 을 비워 요청을 놓치는 틈이 없다. */
  private async drainRestoreRequests(): Promise<void> {
    try {
      for (;;) {
        this.restoreRequested = false;
        try {
          await this.readAndRegisterActiveListeners(this.restoreSource);
        } catch (err) {
          // 뒤이은 요청이 있으면 그 읽기가 이 실패를 대신한다. 없으면 호출자에게 알린다.
          if (!this.restoreRequested) throw err;
          this.logger.warn(
            `listener 복원 읽기 실패 — 뒤이은 요청의 읽기로 대신한다: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
        if (!this.restoreRequested) return;
      }
    } finally {
      this.restoring = null;
    }
  }

  private async readAndRegisterActiveListeners(source: string): Promise<void> {
    const activeTriggers = await this.triggerRepository
      .createQueryBuilder('t')
      .where('t.is_active = true')
      .andWhere("t.config ->> 'chatChannel' IS NOT NULL")
      .select(['t.id', 't.config'])
      .getMany();

    const entries: Array<{ triggerId: string; provider: string }> = [];
    for (const trigger of activeTriggers) {
      const provider = readTriggerChatChannelProvider(trigger.config);
      if (provider === null) continue;
      entries.push({ triggerId: trigger.id, provider });
    }
    this.listenerRegistry.bulkRegister(entries, source);
  }
}
