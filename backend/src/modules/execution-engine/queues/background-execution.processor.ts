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
import {
  BackgroundRunEventType,
  WebsocketService,
} from '../../websocket/websocket.service';

/**
 * Background 노드 큐 워커.
 *
 * Job을 받아 ExecutionEngineService에 위임해 본문 서브그래프를 실행한다.
 * 실패는 메인 워크플로우와 격리 — 실패가 메인 Execution status를 바꾸지 않으며,
 * `notifyOnFailure`가 true면 워크스페이스 Admin에게 인앱 알림을 보낸다.
 *
 * WS 이벤트 (`background:run:<id>` 채널):
 *  - `execution.background_run.started`   — process() 진입 직후
 *  - `execution.background_run.completed` — 본문 종료 (success / failed) 시
 *
 * 본문 안 NodeExecution 의 개별 이벤트는 기존 `execution:<id>` 채널로
 * 발행되므로 본 채널과 별개. 모니터링 spec/4-nodes/1-logic/12-background.md §8.5 참조.
 */
@Processor(BACKGROUND_EXECUTION_QUEUE)
export class BackgroundExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(BackgroundExecutionProcessor.name);

  constructor(
    @Inject(forwardRef(() => ExecutionEngineService))
    private readonly engine: ExecutionEngineService,
    private readonly notificationsService: NotificationsService,
    private readonly workspacesService: WorkspacesService,
    @Inject(forwardRef(() => WebsocketService))
    private readonly websocketService: WebsocketService,
  ) {
    super();
  }

  async process(job: Job<BackgroundExecutionJob>): Promise<void> {
    const data = job.data;
    this.logger.log(
      `Background job received · execution=${data.executionId} parent=${data.parentNodeExecutionId} entries=${data.bodyEntryNodeIds.length}`,
    );

    const runStartedAt = new Date();
    this.emitRunStarted(data, runStartedAt);

    try {
      await this.engine.executeBackgroundSubgraph(data);
      this.logger.log(
        `Background job completed · execution=${data.executionId} parent=${data.parentNodeExecutionId}`,
      );
      this.emitRunCompleted(data, 'completed', runStartedAt);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Background job failed · execution=${data.executionId} parent=${data.parentNodeExecutionId}: ${message}`,
      );
      this.emitRunCompleted(data, 'failed', runStartedAt, message);
      if (data.config.notifyOnFailure) {
        await this.dispatchFailureNotification(data, message);
      }
      // Re-throw so BullMQ records the job as failed (and retries per its policy).
      throw err;
    }
  }

  private emitRunStarted(data: BackgroundExecutionJob, startedAt: Date): void {
    if (!data.backgroundRunId) return;
    this.websocketService.emitBackgroundRunEvent(
      data.backgroundRunId,
      BackgroundRunEventType.BACKGROUND_RUN_STARTED,
      {
        executionId: data.executionId,
        parentNodeExecutionId: data.parentNodeExecutionId,
        startedAt: startedAt.toISOString(),
      },
    );
  }

  private emitRunCompleted(
    data: BackgroundExecutionJob,
    status: 'completed' | 'failed',
    startedAt: Date,
    errorMessage?: string,
  ): void {
    if (!data.backgroundRunId) return;
    const completedAt = new Date();
    this.websocketService.emitBackgroundRunEvent(
      data.backgroundRunId,
      BackgroundRunEventType.BACKGROUND_RUN_COMPLETED,
      {
        executionId: data.executionId,
        parentNodeExecutionId: data.parentNodeExecutionId,
        status,
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
        ...(errorMessage ? { errorMessage } : {}),
      },
    );
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

    // resourceType='background_run', resourceId=backgroundRunId 으로 attribution.
    // 모니터링 API 가 notifications 필드에 정확히 매칭. backgroundRunId 가
    // 빈 문자열이면 (옛 NodeExecution) execution 로 fallback — 옛 데이터 호환.
    const hasRunId = !!data.backgroundRunId;
    const resourceType = hasRunId ? 'background_run' : 'execution';
    const resourceId = hasRunId ? data.backgroundRunId : data.executionId;

    await this.notificationsService.createMany(
      recipients.map((userId) => ({
        workspaceId: data.workspaceId,
        userId,
        type: 'background_failure',
        title: 'Background 본문 실패',
        message: `워크플로우 ${data.workflowId}의 Background 본문 실행이 실패했어요: ${message}`,
        resourceType,
        resourceId,
        channel: 'in_app',
      })),
    );
  }
}
