import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Trigger } from './entities/trigger.entity';
import { Execution } from '../executions/entities/execution.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { TriggersController } from './triggers.controller';
import { TriggersService } from './triggers.service';
import { NotificationSecretRotatorService } from './notification-secret-rotator.service';
import { ChatChannelModule } from '../chat-channel/chat-channel.module';
import { SecretStoreModule } from '../secret-store/secret-store.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trigger, Execution, Schedule]),
    ConfigModule,
    ChatChannelModule,
    // SUMMARY#19: ChatChannelModule 은 SecretStoreModule 을 re-export 하지 않으므로
    // TriggersService 가 SecretResolverService 를 직접 inject 하려면 직접 import 필요.
    SecretStoreModule,
  ],
  controllers: [TriggersController],
  providers: [TriggersService, NotificationSecretRotatorService],
  exports: [TriggersService],
})
export class TriggersModule {}
