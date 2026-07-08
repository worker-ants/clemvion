import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from './entities/schedule.entity';
import { Node } from '../nodes/entities/node.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { NotificationsService } from '../notifications/notifications.service';
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
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    @InjectQueue(SCHEDULE_QUEUE)
    private readonly queue: Queue<ScheduleJobData>,
    @Inject(ExecutionEngineService)
    private readonly executionEngineService: ExecutionEngineService,
    private readonly notificationsService: NotificationsService,
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
      } catch (err) {
        this.logger.error(
          `Failed to register schedule ${schedule.id}: ${err instanceof Error ? err.message : String(err)}`,
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
        { __triggerSource: 'schedule', parameters },
        // priority 3-tier(§4.3) — 정기 schedule 자동 발화는 최저 우선순위(schedule).
        // (사용자 "지금 실행" runNow 는 executedBy 경로라 manual 우선순위 유지.)
        { triggerId: schedule.triggerId, triggerType: 'schedule' },
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
    } catch (err) {
      this.logger.error(
        `Failed to execute schedule ${scheduleId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      await this.dispatchScheduleFailedNotification(
        scheduleId,
        workspaceId,
        workflowId,
        err instanceof Error ? err.message : String(err),
      );
      throw err;
    }
  }

  /**
   * 스케줄이 워크플로우 실행을 **시작하지 못했을 때**(파라미터 해석·enqueue 실패)
   * 워크플로우 owner 에게 `schedule_failed` 알림 발사
   * (spec/data-flow/8-notifications.md §1.1). execution 이 시작된 뒤의 async 실패는
   * `execution_failed` 가 별도로 커버한다.
   *
   * **best-effort** — 알림 발사 실패가 BullMQ 재시도 결정(catch 의 rethrow)을
   * 흔들지 않도록 예외를 삼킨다.
   */
  private async dispatchScheduleFailedNotification(
    scheduleId: string,
    workspaceId: string,
    workflowId: string,
    message: string,
  ): Promise<void> {
    try {
      const workflow = await this.workflowRepository.findOne({
        where: { id: workflowId },
      });
      if (!workflow?.createdBy) return;
      const owner = workflow.createdBy;
      // §5.1 기본 인앱+이메일(opt-out) — 사용자가 `scheduleFailedEmail=false` 로 끄면
      // 인앱만. channel 계산은 호출자 책임(data-flow/8-notifications §1).
      const channelByUser =
        await this.notificationsService.resolveOptOutEmailChannels(
          [owner],
          'scheduleFailedEmail',
        );
      await this.notificationsService.notify({
        workspaceId,
        userId: owner,
        type: 'schedule_failed',
        title: '스케줄 실행 실패',
        message: `스케줄이 워크플로우 "${workflow.name}" 실행을 시작하지 못했어요: ${message}`,
        // 딥링크 계약(href.ts, spec/2-navigation/_layout.md §3.1) — schedule_failed 는
        // `/workflows/<resource_id>` 로 라우팅되며 resource_id 가 workflow id 임에 의존.
        resourceType: 'workflow',
        resourceId: workflow.id,
        channel: channelByUser.get(owner) ?? 'both',
      });
    } catch (err) {
      this.logger.error(
        `Failed to dispatch schedule_failed notification (schedule=${scheduleId}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
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
