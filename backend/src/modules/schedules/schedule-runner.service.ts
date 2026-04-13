import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from './entities/schedule.entity';
import { Node } from '../nodes/entities/node.entity';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { resolveTriggerParameters } from '../execution-engine/utils/resolve-trigger-parameters';
import { loadTriggerParameterSchema } from '../execution-engine/utils/load-trigger-parameter-schema';
import { TriggerParameterValidationException } from '../execution-engine/types/trigger-parameter.types';
import { evaluate } from '@workflow/expression-engine';
import { CronExpressionParser } from 'cron-parser';

export const SCHEDULE_QUEUE = 'schedule-execution';

interface ScheduleJobData {
  scheduleId: string;
  workspaceId: string;
}

@Injectable()
@Processor(SCHEDULE_QUEUE)
export class ScheduleRunnerService extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ScheduleRunnerService.name);

  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
    @InjectQueue(SCHEDULE_QUEUE)
    private readonly queue: Queue<ScheduleJobData>,
    @Inject(ExecutionEngineService)
    private readonly executionEngineService: ExecutionEngineService,
  ) {
    super();
  }

  /**
   * Resolve schedule.parameterValues against a limited expression context
   * (`$now`, `$schedule`) and the workflow's trigger parameter schema.
   *
   * Exposed as a public method primarily for unit testing.
   */
  async resolveScheduleParameters(
    schedule: Schedule,
    workflowId: string,
    now: Date = new Date(),
  ): Promise<Record<string, unknown>> {
    const schema = await loadTriggerParameterSchema(
      this.nodeRepository,
      workflowId,
      this.logger,
    );
    const rawValues = schedule.parameterValues ?? {};
    const ctx = {
      $now: now.toISOString(),
      $schedule: {
        id: schedule.id,
        cronExpression: schedule.cronExpression,
        timezone: schedule.timezone,
      },
    };

    const resolvedRaw: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawValues)) {
      resolvedRaw[key] = this.resolveLimitedExpression(value, ctx);
    }

    try {
      return resolveTriggerParameters(schema, resolvedRaw);
    } catch (err) {
      if (err instanceof TriggerParameterValidationException) {
        this.logger.warn(
          `Schedule ${schedule.id} parameter validation failed: ${err.errors
            .map((e) => `${e.field}(${e.reason})`)
            .join(', ')}`,
        );
        // Fall back to whatever the schema-less resolver would produce so
        // execution still proceeds; the workflow engine may report downstream.
        return resolveTriggerParameters(undefined, resolvedRaw);
      }
      throw err;
    }
  }

  private resolveLimitedExpression(
    value: unknown,
    ctx: Record<string, unknown>,
  ): unknown {
    if (typeof value !== 'string' || !value.includes('{{')) return value;
    try {
      return evaluate(value, ctx);
    } catch (err) {
      this.logger.warn(
        `Failed to evaluate scheduled parameter expression: ${err instanceof Error ? err.message : String(err)}`,
      );
      return value;
    }
  }

  /**
   * On server start, re-register all active schedules with BullMQ.
   * This ensures schedules survive server/Redis restarts.
   */
  async onModuleInit(): Promise<void> {
    const activeSchedules = await this.scheduleRepository.find({
      where: { isActive: true },
      relations: ['trigger'],
    });

    this.logger.log(
      `Registering ${activeSchedules.length} active schedule(s) with BullMQ`,
    );

    for (const schedule of activeSchedules) {
      try {
        await this.registerJob(schedule);
      } catch (error) {
        this.logger.error(
          `Failed to register schedule ${schedule.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Process a scheduled job — execute the linked workflow.
   */
  async process(job: Job<ScheduleJobData>): Promise<void> {
    const { scheduleId, workspaceId } = job.data;
    this.logger.log(`Processing scheduled job for schedule ${scheduleId}`);

    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId, workspaceId },
      relations: ['trigger'],
    });

    if (!schedule) {
      this.logger.warn(`Schedule ${scheduleId} not found, skipping`);
      return;
    }

    if (!schedule.isActive) {
      this.logger.log(`Schedule ${scheduleId} is inactive, skipping`);
      return;
    }

    const workflowId = schedule.trigger?.workflowId;
    if (!workflowId) {
      this.logger.warn(
        `Schedule ${scheduleId} has no associated workflow, skipping`,
      );
      return;
    }

    try {
      const parameters = await this.resolveScheduleParameters(
        schedule,
        workflowId,
      );
      const executionId = await this.executionEngineService.execute(
        workflowId,
        { parameters },
      );
      this.logger.log(
        `Schedule ${scheduleId} triggered execution ${executionId}`,
      );

      // Update lastRunAt and nextRunAt
      const now = new Date();
      schedule.lastRunAt = now;
      try {
        const interval = CronExpressionParser.parse(schedule.cronExpression, {
          tz: schedule.timezone,
          currentDate: now,
        });
        schedule.nextRunAt = interval.next().toDate();
      } catch {
        schedule.nextRunAt = null as unknown as Date;
      }
      await this.scheduleRepository.save(schedule);
    } catch (error) {
      this.logger.error(
        `Failed to execute schedule ${scheduleId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Register (or update) a repeatable job for a schedule.
   */
  async registerJob(schedule: Schedule): Promise<void> {
    await this.queue.upsertJobScheduler(
      `schedule:${schedule.id}`,
      { pattern: schedule.cronExpression, tz: schedule.timezone },
      {
        name: `run:${schedule.id}`,
        data: {
          scheduleId: schedule.id,
          workspaceId: schedule.workspaceId,
        },
      },
    );

    this.logger.log(
      `Registered job scheduler for schedule ${schedule.id} (${schedule.cronExpression} ${schedule.timezone})`,
    );
  }

  /**
   * Remove a repeatable job for a schedule.
   */
  async removeJob(scheduleId: string): Promise<void> {
    await this.queue.removeJobScheduler(`schedule:${scheduleId}`);
    this.logger.log(`Removed job scheduler for schedule ${scheduleId}`);
  }
}
