import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from './entities/schedule.entity';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { CronExpressionParser } from 'cron-parser';

export const SCHEDULE_QUEUE = 'schedule-execution';

interface ScheduleJobData {
  scheduleId: string;
  workspaceId: string;
}

@Injectable()
@Processor(SCHEDULE_QUEUE)
export class ScheduleRunnerService
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(ScheduleRunnerService.name);

  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectQueue(SCHEDULE_QUEUE)
    private readonly queue: Queue<ScheduleJobData>,
    @Inject(ExecutionEngineService)
    private readonly executionEngineService: ExecutionEngineService,
  ) {
    super();
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
      const executionId = await this.executionEngineService.execute(
        workflowId,
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
