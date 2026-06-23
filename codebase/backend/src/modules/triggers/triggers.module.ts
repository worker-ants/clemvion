import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { Trigger } from './entities/trigger.entity';
import { Execution } from '../executions/entities/execution.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { AuthConfig } from '../auth-configs/entities/auth-config.entity';
import { TriggersController } from './triggers.controller';
import { TriggersService } from './triggers.service';
import {
  NotificationSecretRotatorService,
  NOTIFICATION_SECRET_ROTATOR_QUEUE,
} from './notification-secret-rotator.service';
import {
  ChatChannelTokenRotatorService,
  CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE,
} from './chat-channel-token-rotator.service';
import { ChatChannelModule } from '../chat-channel/chat-channel.module';
import { SecretStoreModule } from '../secret-store/secret-store.module';
import { SchedulesModule } from '../schedules/schedules.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trigger, Execution, Schedule, AuthConfig]),
    ConfigModule,
    BullModule.registerQueue(
      { name: NOTIFICATION_SECRET_ROTATOR_QUEUE },
      { name: CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE },
    ),
    // TriggersService 가 ChannelAdapterRegistry/ChannelListenerRegistry 를 주입(단방향).
    // (C-2: chat-channel→triggers 역방향 의존 2곳[rotate-bot-token 엔드포인트 +
    //  ChatChannelTokenRotatorService→cleanupRotatedChatChannelTokens]을 triggers 로
    //  이전해 제거 → forwardRef → 일반 import, chat-channel↔triggers 순환 해소.)
    ChatChannelModule,
    SecretStoreModule,
    // [data-flow 10-triggers §1.4] 역방향(Trigger→Schedule) 동기화 — ScheduleRunnerService 주입.
    SchedulesModule,
  ],
  controllers: [TriggersController],
  providers: [
    TriggersService,
    NotificationSecretRotatorService,
    ChatChannelTokenRotatorService,
  ],
  exports: [TriggersService],
})
export class TriggersModule {}
