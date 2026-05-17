import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertRule, AlertRuleType } from './entities/alert-rule.entity';
import { Execution } from '../executions/entities/execution.entity';
import { LlmUsageLog } from '../llm/entities/llm-usage-log.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

export const ALERTS_EVALUATOR_QUEUE = 'alerts-evaluator';

interface AlertsJobData {
  triggeredAt: string;
}

interface BreachInfo {
  rule: AlertRule;
  observedValue: number;
  windowMs: number;
}

const RUN_PATTERN_EVERY_5_MIN = '*/5 * * * *';

/**
 * Evaluates alert_rule rows on a 5-minute schedule and emits notifications
 * for breached rules. Mirrors the IntegrationExpiryScannerService pattern:
 * a single Worker consumes a repeatable job and runs the evaluation loop.
 *
 * Cooldown: a rule cannot re-fire while still within its own evaluation window
 * after a prior trigger. This prevents notification spam on persistent breaches
 * — the user gets one alert per window, not one per 5-min tick.
 */
@Injectable()
@Processor(ALERTS_EVALUATOR_QUEUE)
export class AlertsEvaluatorService extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(AlertsEvaluatorService.name);

  constructor(
    @InjectRepository(AlertRule)
    private readonly ruleRepository: Repository<AlertRule>,
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(LlmUsageLog)
    private readonly llmUsageRepository: Repository<LlmUsageLog>,
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    private readonly notificationsService: NotificationsService,
    private readonly workspacesService: WorkspacesService,
    @InjectQueue(ALERTS_EVALUATOR_QUEUE)
    private readonly queue: Queue<AlertsJobData>,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'alerts-evaluator-5min',
      { pattern: RUN_PATTERN_EVERY_5_MIN, tz: 'UTC' },
      { name: 'evaluate', data: { triggeredAt: new Date().toISOString() } },
    );
    this.logger.log('Registered alerts evaluator (every 5 minutes)');
  }

  async process(job: Job<AlertsJobData>): Promise<void> {
    this.logger.log(`Running alert evaluation (${job.data.triggeredAt})`);
    await this.run(new Date());
  }

  /**
   * Evaluate all enabled rules and dispatch notifications for breaches.
   * Returns the number of notifications created.
   */
  async run(now: Date): Promise<number> {
    const rules = await this.ruleRepository.find({ where: { enabled: true } });
    if (rules.length === 0) return 0;

    let notificationCount = 0;
    for (const rule of rules) {
      try {
        const breach = await this.evaluateRule(rule, now);
        if (!breach) continue;
        if (this.isInCooldown(rule, breach.windowMs, now)) continue;
        notificationCount += await this.dispatchBreach(breach, now);
      } catch (err) {
        // Per-rule failure must not abort the rest of the batch — log and move on.
        this.logger.error(
          `Failed to evaluate rule ${rule.id} (${rule.type}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    if (notificationCount > 0) {
      this.logger.log(
        `Alert evaluation dispatched ${notificationCount} notification(s)`,
      );
    }
    return notificationCount;
  }

  private async evaluateRule(
    rule: AlertRule,
    now: Date,
  ): Promise<BreachInfo | null> {
    const windowMs = parseIso8601Duration(rule.window);
    const since = new Date(now.getTime() - windowMs);
    const threshold = Number(rule.threshold);

    let observed: number | null;
    switch (rule.type) {
      case 'failure_rate':
        observed = await this.computeFailureRate(rule, since);
        break;
      case 'duration':
        observed = await this.computeAvgDuration(rule, since);
        break;
      case 'llm_cost':
        observed = await this.computeLlmCost(rule, since);
        break;
      default:
        return null;
    }

    if (observed === null || observed <= threshold) return null;
    return { rule, observedValue: observed, windowMs };
  }

  private async computeFailureRate(
    rule: AlertRule,
    since: Date,
  ): Promise<number | null> {
    const qb = this.executionRepository
      .createQueryBuilder('e')
      .innerJoin(Workflow, 'w', 'w.id = e.workflow_id')
      .where('e.started_at >= :since', { since })
      .andWhere('w.workspace_id = :wsId', { wsId: rule.workspaceId });
    if (rule.workflowId) {
      qb.andWhere('e.workflow_id = :wfId', { wfId: rule.workflowId });
    }
    const total = await qb.getCount();
    // Ignore tiny sample sizes — a 1/1 failure shouldn't trip a 50% rule.
    if (total < 5) return null;

    const failedQb = qb.clone().andWhere('e.status = :status', {
      status: 'failed',
    });
    const failed = await failedQb.getCount();
    return (failed / total) * 100;
  }

  private async computeAvgDuration(
    rule: AlertRule,
    since: Date,
  ): Promise<number | null> {
    const qb = this.executionRepository
      .createQueryBuilder('e')
      .innerJoin(Workflow, 'w', 'w.id = e.workflow_id')
      .select('AVG(e.duration_ms)', 'avg')
      .where('e.started_at >= :since', { since })
      .andWhere('w.workspace_id = :wsId', { wsId: rule.workspaceId })
      .andWhere('e.status = :status', { status: 'completed' })
      .andWhere('e.duration_ms IS NOT NULL');
    if (rule.workflowId) {
      qb.andWhere('e.workflow_id = :wfId', { wfId: rule.workflowId });
    }
    const row = await qb.getRawOne<{ avg: string | null }>();
    if (!row?.avg) return null;
    return Number(row.avg);
  }

  private async computeLlmCost(
    rule: AlertRule,
    since: Date,
  ): Promise<number | null> {
    const qb = this.llmUsageRepository
      .createQueryBuilder('u')
      .select('COALESCE(SUM(u.cost_usd), 0)', 'sum')
      .where('u.created_at >= :since', { since })
      .andWhere('u.workspace_id = :wsId', { wsId: rule.workspaceId });
    if (rule.workflowId) {
      qb.andWhere('u.workflow_id = :wfId', { wfId: rule.workflowId });
    }
    const row = await qb.getRawOne<{ sum: string | null }>();
    if (!row?.sum) return 0;
    return Number(row.sum);
  }

  private isInCooldown(rule: AlertRule, windowMs: number, now: Date): boolean {
    if (!rule.lastTriggeredAt) return false;
    return now.getTime() - rule.lastTriggeredAt.getTime() < windowMs;
  }

  private async dispatchBreach(breach: BreachInfo, now: Date): Promise<number> {
    const { rule } = breach;
    const recipients = await this.workspacesService.findAdminUserIds(
      rule.workspaceId,
    );
    if (recipients.length === 0) return 0;

    const title = titleFor(rule.type);
    const message = messageFor(breach);
    const channel: 'in_app' | 'email' | 'both' =
      rule.channel === 'email' ? 'both' : 'in_app';

    await this.notificationsService.createMany(
      recipients.map((userId) => ({
        workspaceId: rule.workspaceId,
        userId,
        type: `alert_${rule.type}`,
        title,
        message,
        resourceType: 'alert_rule',
        resourceId: rule.id,
        channel,
      })),
    );

    rule.lastTriggeredAt = now;
    await this.ruleRepository.save(rule);
    return recipients.length;
  }
}

/**
 * Minimal ISO 8601 duration parser — supports PT?H, PT?M, PT?S, P?D combinations
 * sufficient for the rule.window column (seeded values: 'PT1H', 'PT24H', 'P1D').
 * Returns milliseconds. Falls back to 1 hour for unparseable strings.
 */
function parseIso8601Duration(input: string): number {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    input,
  );
  if (!match) return 60 * 60 * 1000;
  const [, d, h, m, s] = match;
  const days = Number(d ?? 0);
  const hours = Number(h ?? 0);
  const minutes = Number(m ?? 0);
  const seconds = Number(s ?? 0);
  return ((days * 24 + hours) * 60 + minutes) * 60 * 1000 + seconds * 1000;
}

function titleFor(type: AlertRuleType): string {
  switch (type) {
    case 'failure_rate':
      return '실행 실패율 임계값 초과';
    case 'duration':
      return '평균 실행 시간 임계값 초과';
    case 'llm_cost':
      return 'LLM 비용 임계값 초과';
  }
}

function messageFor(breach: BreachInfo): string {
  const { rule, observedValue } = breach;
  const scope = rule.workflowId
    ? `워크플로우(${rule.workflowId})`
    : '워크스페이스 전체';
  switch (rule.type) {
    case 'failure_rate':
      return `${scope} 최근 ${rule.window} 동안 실패율이 ${observedValue.toFixed(1)}% (임계값 ${rule.threshold}%)에 도달했습니다.`;
    case 'duration':
      return `${scope} 최근 ${rule.window} 동안 평균 실행 시간이 ${Math.round(observedValue)}ms (임계값 ${rule.threshold}ms)에 도달했습니다.`;
    case 'llm_cost':
      return `${scope} 최근 ${rule.window} 동안 LLM 비용이 $${observedValue.toFixed(4)} (임계값 $${rule.threshold})에 도달했습니다.`;
  }
}
