import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Schedule } from './entities/schedule.entity';
import { Trigger } from '../triggers/entities/trigger.entity';
import { Node } from '../nodes/entities/node.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import {
  ScheduleRunnerService,
  SCHEDULE_QUEUE,
} from './schedule-runner.service';
import { ExecutionEngineModule } from '../execution-engine/execution-engine.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    // Workflow: schedule_failed 알림의 owner(createdBy) 조회용. NotificationsModule:
    // schedule_failed 발사(순환 무관 — NotificationsModule 은 MailModule/forFeature 만 의존).
    TypeOrmModule.forFeature([Schedule, Trigger, Node, Workflow]),
    BullModule.registerQueue({ name: SCHEDULE_QUEUE }),
    ExecutionEngineModule,
    NotificationsModule,
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService, ScheduleRunnerService],
  exports: [SchedulesService, ScheduleRunnerService],
})
export class SchedulesModule {}
