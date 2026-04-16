import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AlertRule } from './entities/alert-rule.entity';
import { Execution } from '../executions/entities/execution.entity';
import { LlmUsageLog } from '../llm/entities/llm-usage-log.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import {
  AlertsEvaluatorService,
  ALERTS_EVALUATOR_QUEUE,
} from './alerts-evaluator.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    // Execution, LlmUsageLog, Workflow are queried by the evaluator for
    // per-rule aggregation. AlertRule is the evaluator's own domain.
    TypeOrmModule.forFeature([AlertRule, Execution, LlmUsageLog, Workflow]),
    BullModule.registerQueue({ name: ALERTS_EVALUATOR_QUEUE }),
    NotificationsModule,
  ],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsEvaluatorService],
  exports: [AlertsService],
})
export class AlertsModule {}
