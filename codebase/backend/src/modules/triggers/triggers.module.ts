import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trigger } from './entities/trigger.entity';
import { Execution } from '../executions/entities/execution.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { TriggersController } from './triggers.controller';
import { TriggersService } from './triggers.service';
import { NotificationSecretRotatorService } from './notification-secret-rotator.service';

@Module({
  imports: [TypeOrmModule.forFeature([Trigger, Execution, Schedule])],
  controllers: [TriggersController],
  providers: [TriggersService, NotificationSecretRotatorService],
  exports: [TriggersService],
})
export class TriggersModule {}
