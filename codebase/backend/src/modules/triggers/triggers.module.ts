import { AuditLogsModule } from '../audit-logs/audit-logs.module';
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
import { ChatChannelBinderService } from './chat-channel-binder.service';
import { TriggerResourceReleaserService } from './trigger-resource-releaser.service';
import { TRIGGER_RESOURCE_RELEASER } from './trigger-resource-release';
import { ChatChannelModule } from '../chat-channel/chat-channel.module';
import { SecretStoreModule } from '../secret-store/secret-store.module';
import { SchedulesModule } from '../schedules/schedules.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trigger, Execution, Schedule, AuthConfig]),
    // AuditLogsModule: trigger.* CRUD 감사 기록 (1-auth §4.1).
    AuditLogsModule,
    ConfigModule,
    BullModule.registerQueue(
      { name: NOTIFICATION_SECRET_ROTATOR_QUEUE },
      { name: CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE },
    ),
    // TriggersService · ChatChannelBinderService · TriggerResourceReleaserService 가
    // ChannelAdapterRegistry/ChannelListenerRegistry 를 주입(단방향) — TriggersService 는
    // rotateBotToken 에서, Binder 는 setup/teardown 에서, Releaser 는 삭제 시 unregister 에서.
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
    // chat-channel adapter 바인딩(setup/teardown) 협력자. `TriggersService` 에서 떼어낸 것이라
    // **export 하지 않는다** — 이 모듈 안에서만 쓰인다.
    ChatChannelBinderService,
    // 트리거 행을 없애는 네 경로의 자원 정리(spec 트리거 목록 §4.3). **토큰 별칭**은
    // 워크플로·워크스페이스 삭제가 모듈 import 없이 `ModuleRef.get(TOKEN, { strict: false })` 로
    // 찾는 입구다 — import 하면 WorkflowsModule 과 순환이 닫힌다(`trigger-resource-release.ts`).
    TriggerResourceReleaserService,
    {
      provide: TRIGGER_RESOURCE_RELEASER,
      useExisting: TriggerResourceReleaserService,
    },
    NotificationSecretRotatorService,
    ChatChannelTokenRotatorService,
  ],
  exports: [TriggersService],
})
export class TriggersModule {}
