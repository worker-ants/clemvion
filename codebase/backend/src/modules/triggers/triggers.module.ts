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

@Module({
  imports: [
    TypeOrmModule.forFeature([Trigger, Execution, Schedule]),
    ConfigModule,
    ChatChannelModule,
  ],
  controllers: [TriggersController],
  providers: [TriggersService, NotificationSecretRotatorService],
  exports: [TriggersService],
})
export class TriggersModule {}
