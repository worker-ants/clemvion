import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Trigger } from '../triggers/entities/trigger.entity';
import { WebsocketModule } from '../websocket/websocket.module';
import { ChannelAdapterRegistry } from './channel-adapter.registry';
import { ChannelListenerRegistry } from './channel-listener.registry';
import { ChannelListenerBus } from './channel-listener.bus';
import { ChannelListenerRestorer } from './channel-listener.restorer';
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

/**
 * 채팅 채널 모듈([채팅 채널](CLE-CHAT-CORE)). 구성:
 *   - ChannelAdapterRegistry: provider 어댑터 등록 · 조회. 이 모듈의 생성자가 어댑터를 등록한다
 *   - providers/telegram · slack · discord: provider 별 어댑터와 API client
 *   - ChannelListenerRegistry: 트리거 단위 listener 레지스트리
 *   - ChannelListenerBus: 레지스트리 변경을 다른 서버 인스턴스와 주고받는 Redis pub/sub
 *   - ChannelListenerRestorer: 부팅과 listener 재구독 때 레지스트리를 DB 에서 복원
 *   - ChannelConversationService: Redis ChannelConversation CRUD
 *   - ChatChannelDispatcher: WebsocketService.executionEvents$ subscribe → adapter.sendMessage
 *   - ChatChannelInboundAuthenticator · ChatChannelDedupService · ChatChannelRateLimiterService:
 *     인바운드 서명 검증 · 중복 제거 · 분당 한도
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
    ChannelListenerRestorer,
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
export class ChatChannelModule {
  constructor(
    private readonly registry: ChannelAdapterRegistry,
    private readonly telegramAdapter: TelegramAdapter,
    private readonly slackAdapter: SlackAdapter,
    private readonly discordAdapter: DiscordAdapter,
  ) {
    // onModuleInit 대신 constructor — 어댑터 인스턴스는 NestJS DI 시점에 ready.
    this.registry.register(this.telegramAdapter);
    this.registry.register(this.slackAdapter);
    this.registry.register(this.discordAdapter);
  }
}
