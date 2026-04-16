import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  BACKGROUND_EXECUTION_QUEUE,
  BackgroundExecutionJob,
} from './background-execution.queue';
import { ExecutionEngineService } from '../execution-engine.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';

/**
 * Background 노드 큐 워커.
 *
 * Job을 받아 ExecutionEngineService에 위임해 본문 서브그래프를 실행한다.
 * 실패는 메인 워크플로우와 격리 — 실패가 메인 Execution status를 바꾸지 않으며,
 * `notifyOnFailure`가 true면 워크스페이스 Admin에게 인앱 알림을 보낸다.
 */
@Processor(BACKGROUND_EXECUTION_QUEUE)
export class BackgroundExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(BackgroundExecutionProcessor.name);

  constructor(
    @Inject(forwardRef(() => ExecutionEngineService))
    private readonly engine: ExecutionEngineService,
    private readonly notificationsService: NotificationsService,
    private readonly workspacesService: WorkspacesService,
  ) {
    super();
  }

  async process(job: Job<BackgroundExecutionJob>): Promise<void> {
    const data = job.data;
    this.logger.log(
      `Background job received · execution=${data.executionId} parent=${data.parentNodeExecutionId} entries=${data.bodyEntryNodeIds.length}`,
    );

    try {
      await this.engine.executeBackgroundSubgraph(data);
      this.logger.log(
        `Background job completed · execution=${data.executionId} parent=${data.parentNodeExecutionId}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Background job failed · execution=${data.executionId} parent=${data.parentNodeExecutionId}: ${message}`,
      );
      if (data.config.notifyOnFailure) {
        await this.dispatchFailureNotification(data, message);
      }
      // Re-throw so BullMQ records the job as failed (and retries per its policy).
      throw err;
    }
  }

  private async dispatchFailureNotification(
    data: BackgroundExecutionJob,
    message: string,
  ): Promise<void> {
    if (!data.workspaceId) return;
    const recipients = await this.workspacesService.findAdminUserIds(
      data.workspaceId,
    );
    if (recipients.length === 0) return;

    await this.notificationsService.createMany(
      recipients.map((userId) => ({
        workspaceId: data.workspaceId,
        userId,
        type: 'background_failure',
        title: 'Background 본문 실패',
        message: `워크플로우 ${data.workflowId}의 Background 본문 실행이 실패했어요: ${message}`,
        resourceType: 'execution',
        resourceId: data.executionId,
        channel: 'in_app',
      })),
    );
  }
}
