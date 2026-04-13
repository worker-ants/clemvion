import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Schedule } from './entities/schedule.entity';
import { Trigger } from '../triggers/entities/trigger.entity';
import { Node } from '../nodes/entities/node.entity';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import {
  ScheduleRunnerService,
  SCHEDULE_QUEUE,
} from './schedule-runner.service';
import { ExecutionEngineModule } from '../execution-engine/execution-engine.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Schedule, Trigger, Node]),
    BullModule.registerQueue({ name: SCHEDULE_QUEUE }),
    ExecutionEngineModule,
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService, ScheduleRunnerService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
