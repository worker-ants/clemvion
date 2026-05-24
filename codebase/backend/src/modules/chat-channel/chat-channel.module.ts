import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Trigger } from '../triggers/entities/trigger.entity';
import { TriggersModule } from '../triggers/triggers.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { ChannelAdapterRegistry } from './channel-adapter.registry';
import { ChannelConversationService } from './channel-conversation.service';
import { ChatChannelDispatcher } from './chat-channel.dispatcher';
import { ChatChannelController } from './chat-channel.controller';
import { TelegramAdapter } from './providers/telegram/telegram.adapter';
import { TelegramClient } from './providers/telegram/telegram-client';
import { SlackAdapter } from './providers/slack/slack.adapter';
import { SlackClient } from './providers/slack/slack-client';
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
    WebsocketModule,
    SecretStoreModule,
    // ChatChannelController 가 TriggersService.rotateBotToken 위임 — 양방향 import 회피.
    forwardRef(() => TriggersModule),
  ],
  controllers: [ChatChannelController],
  providers: [
    ChannelAdapterRegistry,
    ChannelConversationService,
    ChatChannelDispatcher,
    ChatChannelInboundAuthenticator,
    TelegramClient,
    TelegramAdapter,
    SlackClient,
    SlackAdapter,
  ],
  exports: [
    ChannelAdapterRegistry,
    ChannelConversationService,
    ChatChannelInboundAuthenticator,
  ],
})
export class ChatChannelModule {
  constructor(
    private readonly registry: ChannelAdapterRegistry,
    private readonly telegramAdapter: TelegramAdapter,
    private readonly slackAdapter: SlackAdapter,
  ) {
    // onModuleInit 대신 constructor — 어댑터 인스턴스는 NestJS DI 시점에 ready.
    // Telegram: 완전 구현. Slack: Phase 1 stub — 6함수 호출 시 명시적 에러 (Phase 2/3 에서 채움).
    this.registry.register(this.telegramAdapter);
    this.registry.register(this.slackAdapter);
  }
}
