import { forwardRef, Module } from '@nestjs/common';
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
import { ChatChannelModule } from '../chat-channel/chat-channel.module';
import { SecretStoreModule } from '../secret-store/secret-store.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trigger, Execution, Schedule, AuthConfig]),
    ConfigModule,
    BullModule.registerQueue({ name: NOTIFICATION_SECRET_ROTATOR_QUEUE }),
    // ChatChannelController 가 TriggersService.rotateBotToken 을 호출하므로 양방향 의존.
    forwardRef(() => ChatChannelModule),
    SecretStoreModule,
  ],
  controllers: [TriggersController],
  providers: [TriggersService, NotificationSecretRotatorService],
  exports: [TriggersService],
})
export class TriggersModule {}
