import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, LessThanOrEqual, Not, Repository } from 'typeorm';
import { Integration } from './entities/integration.entity';
import {
  IntegrationExpiryDispatch,
  ExpiryThreshold,
} from './entities/integration-expiry-dispatch.entity';
import { IntegrationUsageLog } from './entities/integration-usage-log.entity';
import { User } from '../users/entities/user.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { NotificationsService } from '../notifications/notifications.service';

export const INTEGRATION_EXPIRY_QUEUE = 'integration-expiry-scanner';

/** Usage-log retention window (spec §2.10.1). */
const USAGE_LOG_RETENTION_DAYS = 90;

interface ExpiryJobData {
  triggeredAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
@Processor(INTEGRATION_EXPIRY_QUEUE)
export class IntegrationExpiryScannerService
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(IntegrationExpiryScannerService.name);

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    @InjectRepository(IntegrationExpiryDispatch)
    private readonly dispatchRepository: Repository<IntegrationExpiryDispatch>,
    @InjectRepository(IntegrationUsageLog)
    private readonly usageLogRepository: Repository<IntegrationUsageLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly workspacesService: WorkspacesService,
    private readonly notificationsService: NotificationsService,
    @InjectQueue(INTEGRATION_EXPIRY_QUEUE)
    private readonly queue: Queue<ExpiryJobData>,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'integration-expiry-daily',
      { pattern: '0 0 * * *', tz: 'UTC' },
      { name: 'scan', data: { triggeredAt: new Date().toISOString() } },
    );
    this.logger.log('Registered integration expiry scanner (daily 00:00 UTC)');
  }

  async process(job: Job<ExpiryJobData>): Promise<void> {
    this.logger.log(
      `Running integration expiry scan (${job.data.triggeredAt})`,
    );
    await this.run(new Date());
    await this.pruneUsageLogs(new Date());
  }

  /**
   * Scan integrations nearing expiry and emit notifications. Returns the
   * number of notifications created.
   */
  async run(now: Date): Promise<number> {
    const horizon = new Date(now.getTime() + 7 * DAY_MS);

    const candidates = await this.integrationRepository.find({
      where: {
        status: Not(In(['expired', 'error'])),
        tokenExpiresAt: LessThanOrEqual(horizon),
      },
    });

    const notifications: Array<{
      workspaceId: string;
      userId: string;
      type: string;
      title: string;
      message: string;
      resourceType: string;
      resourceId: string;
      channel: 'in_app' | 'both';
    }> = [];
    const integrationsToUpdate: Integration[] = [];

    for (const integration of candidates) {
      if (!integration.tokenExpiresAt) continue;
      const remainMs = integration.tokenExpiresAt.getTime() - now.getTime();
      const threshold = classifyThreshold(remainMs);
      if (!threshold) continue;

      const claimed = await this.claimThreshold(
        integration.id,
        threshold,
        integration.tokenExpiresAt,
      );
      if (!claimed) continue;

      if (threshold === '0d' && integration.status !== 'expired') {
        integration.status = 'expired';
        integration.statusReason = null;
        integrationsToUpdate.push(integration);
      }

      const recipients = await this.resolveRecipients(integration);
      if (recipients.length === 0) continue;

      const users = await this.userRepository.find({
        where: { id: In(recipients) },
      });
      const prefsByUser = new Map(
        users.map((u) => [u.id, u.notificationPreferences ?? {}]),
      );

      for (const userId of recipients) {
        const prefs = prefsByUser.get(userId) ?? {};
        const wantsEmail = prefs.integrationExpiryEmail === true;
        notifications.push({
          workspaceId: integration.workspaceId,
          userId,
          type: 'integration_expired',
          title: titleFor(threshold),
          message: messageFor(threshold, integration),
          resourceType: 'integration',
          resourceId: integration.id,
          channel: wantsEmail ? 'both' : 'in_app',
        });
      }
    }

    if (integrationsToUpdate.length) {
      await this.integrationRepository.save(integrationsToUpdate);
    }
    await this.notificationsService.createMany(notifications);
    this.logger.log(
      `Integration expiry scan created ${notifications.length} notifications`,
    );
    return notifications.length;
  }

  /**
   * Delete integration_usage_log rows older than the retention window.
   * Returns the number of rows removed.
   */
  async pruneUsageLogs(now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - USAGE_LOG_RETENTION_DAYS * DAY_MS);
    const result = await this.usageLogRepository.delete({
      at: LessThan(cutoff),
    });
    const affected = result.affected ?? 0;
    if (affected > 0) {
      this.logger.log(
        `Pruned ${affected} integration_usage_log rows older than ${USAGE_LOG_RETENTION_DAYS}d`,
      );
    }
    return affected;
  }

  private async claimThreshold(
    integrationId: string,
    threshold: ExpiryThreshold,
    tokenExpiresAt: Date,
  ): Promise<boolean> {
    try {
      await this.dispatchRepository.insert({
        integrationId,
        threshold,
        tokenExpiresAt,
      });
      return true;
    } catch (err) {
      if ((err as { code?: string })?.code === '23505') return false;
      throw err;
    }
  }

  private async resolveRecipients(integration: Integration): Promise<string[]> {
    if (integration.scope === 'personal') {
      return [integration.createdBy];
    }
    return this.workspacesService.findAdminUserIds(integration.workspaceId);
  }
}

function classifyThreshold(remainMs: number): ExpiryThreshold | null {
  if (remainMs <= 0) return '0d';
  if (remainMs <= 3 * DAY_MS) return '3d';
  if (remainMs <= 7 * DAY_MS) return '7d';
  return null;
}

function titleFor(threshold: ExpiryThreshold): string {
  if (threshold === '0d') return 'Integration expired';
  if (threshold === '3d') return 'Integration expiring in 3 days';
  return 'Integration expiring soon';
}

function messageFor(
  threshold: ExpiryThreshold,
  integration: Integration,
): string {
  const name = `"${integration.name}"`;
  if (threshold === '0d') {
    return `${name} has expired. Reauthorize to continue using it.`;
  }
  const date = integration.tokenExpiresAt?.toISOString().slice(0, 10) ?? '';
  return `${name} will expire on ${date}.`;
}
