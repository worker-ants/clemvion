import { forwardRef, Module, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { Trigger } from '../triggers/entities/trigger.entity';
import { TriggersModule } from '../triggers/triggers.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { ChannelAdapterRegistry } from './channel-adapter.registry';
import { ChannelListenerRegistry } from './channel-listener.registry';
import { ChannelConversationService } from './channel-conversation.service';
import { ChatChannelDispatcher } from './chat-channel.dispatcher';
import { ChatChannelController } from './chat-channel.controller';
import {
  ChatChannelTokenRotatorService,
  CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE,
} from './chat-channel-token-rotator.service';
import { TelegramAdapter } from './providers/telegram/telegram.adapter';
import { TelegramClient } from './providers/telegram/telegram-client';
import { SlackAdapter } from './providers/slack/slack.adapter';
import { SlackClient } from './providers/slack/slack-client';
import { DiscordAdapter } from './providers/discord/discord.adapter';
import { DiscordClient } from './providers/discord/discord-client';
import { SecretStoreModule } from '../secret-store/secret-store.module';
import { ChatChannelInboundAuthenticator } from './chat-channel-inbound-authenticator';

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
    BullModule.registerQueue({ name: CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE }),
    WebsocketModule,
    SecretStoreModule,
    // ChatChannelController 가 TriggersService.rotateBotToken 위임 — 양방향 import 회피.
    forwardRef(() => TriggersModule),
  ],
  controllers: [ChatChannelController],
  providers: [
    ChannelAdapterRegistry,
    ChannelListenerRegistry,
    ChannelConversationService,
    ChatChannelDispatcher,
    ChatChannelInboundAuthenticator,
    TelegramClient,
    TelegramAdapter,
    SlackClient,
    SlackAdapter,
    DiscordClient,
    DiscordAdapter,
    ChatChannelTokenRotatorService,
  ],
  exports: [
    ChannelAdapterRegistry,
    ChannelListenerRegistry,
    ChannelConversationService,
    ChatChannelInboundAuthenticator,
  ],
})
export class ChatChannelModule implements OnApplicationBootstrap {
  constructor(
    private readonly registry: ChannelAdapterRegistry,
    private readonly listenerRegistry: ChannelListenerRegistry,
    private readonly telegramAdapter: TelegramAdapter,
    private readonly slackAdapter: SlackAdapter,
    private readonly discordAdapter: DiscordAdapter,
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
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
   */
  async onApplicationBootstrap(): Promise<void> {
    const activeTriggers = await this.triggerRepository
      .createQueryBuilder('t')
      .where('t.is_active = true')
      .andWhere("t.config ->> 'chatChannel' IS NOT NULL")
      .select(['t.id', 't.config'])
      .getMany();

    const entries: Array<{ triggerId: string; provider: string }> = [];
    for (const trigger of activeTriggers) {
      const cfg = trigger.config as
        | { chatChannel?: { provider?: string } }
        | null
        | undefined;
      const provider = cfg?.chatChannel?.provider;
      if (typeof provider !== 'string' || provider.length === 0) continue;
      entries.push({ triggerId: trigger.id, provider });
    }
    this.listenerRegistry.bulkRegister(entries);
  }
}
