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

const ERROR_MESSAGE_MAX_LENGTH = 500;
const STACK_TRACE_PATTERN = /\s+at\s+.*\(.+\)/g;
const CONNECTION_STRING_PATTERN =
  /(postgres|postgresql|redis|mongodb|mysql):\/\/[^\s]+/gi;

/**
 * 본문 실행 실패 메시지를 WS 이벤트 / notification 에 노출하기 전 정리.
 *
 * 길이 제한 + stack trace · connection string 패턴 제거. credential 자체는
 * `WebsocketService.sanitizePayloadForWs` 의 키 기반 마스킹이 추가로 차단하지만,
 * Error.message 안에 평문으로 들어온 경우를 보강 — defense in depth.
 */
function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const stripped = raw
    .replace(STACK_TRACE_PATTERN, '')
    .replace(CONNECTION_STRING_PATTERN, '[REDACTED_URI]')
    .trim();
  return stripped.length > ERROR_MESSAGE_MAX_LENGTH
    ? `${stripped.slice(0, ERROR_MESSAGE_MAX_LENGTH)}…`
    : stripped;
}

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
    // WS emit 은 try-block 안에서 best-effort 로 호출 — emit 실패가 본문
    // 실행이나 알림 발송 흐름을 막지 않는다. `safeEmit*` 가 자체 try/catch
    // 로 logger.warn 만 남기고 swallow.

    try {
      // Started 이벤트는 첫 시도에만 발행 (BullMQ retry 시 중복 차단).
      if (job.attemptsMade === 0) {
        this.safeEmitRunStarted(data, runStartedAt);
      }
      await this.engine.executeBackgroundSubgraph(data);
      this.logger.log(
        `Background job completed · execution=${data.executionId} parent=${data.parentNodeExecutionId}`,
      );
      this.safeEmitRunCompleted(data, 'completed', runStartedAt);
    } catch (err) {
      const message = sanitizeErrorMessage(err);
      this.logger.error(
        `Background job failed · execution=${data.executionId} parent=${data.parentNodeExecutionId}: ${message}`,
      );
      // WS emit 이 throw 해도 알림 발송이 막히지 않도록 분리. 알림이 더
      // 사용자 가시 영향이 크다 (Admin email/in_app).
      this.safeEmitRunCompleted(data, 'failed', runStartedAt, message);
      if (data.config.notifyOnFailure) {
        await this.dispatchFailureNotification(data, message);
      }
      // Re-throw so BullMQ records the job as failed (and retries per its policy).
      throw err;
    }
  }

  private safeEmitRunStarted(
    data: BackgroundExecutionJob,
    startedAt: Date,
  ): void {
    if (!data.backgroundRunId) return;
    try {
      this.websocketService.emitBackgroundRunEvent(
        data.backgroundRunId,
        BackgroundRunEventType.BACKGROUND_RUN_STARTED,
        {
          executionId: data.executionId,
          parentNodeExecutionId: data.parentNodeExecutionId,
          startedAt: startedAt.toISOString(),
        },
      );
    } catch (err) {
      this.logger.warn(
        `Failed to emit BACKGROUND_RUN_STARTED for ${data.backgroundRunId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private safeEmitRunCompleted(
    data: BackgroundExecutionJob,
    status: 'completed' | 'failed',
    startedAt: Date,
    errorMessage?: string,
  ): void {
    if (!data.backgroundRunId) return;
    const completedAt = new Date();
    try {
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
    } catch (err) {
      this.logger.warn(
        `Failed to emit BACKGROUND_RUN_COMPLETED for ${data.backgroundRunId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
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

    // resourceType='background_run', resourceId=backgroundRunId 으로 attribution.
    // 모니터링 API 가 notifications 필드에 정확히 매칭. backgroundRunId 가
    // 빈 문자열이면 (옛 NodeExecution) execution 로 fallback — 옛 데이터 호환.
    const hasRunId = !!data.backgroundRunId;
    const resourceType = hasRunId ? 'background_run' : 'execution';
    const resourceId = hasRunId ? data.backgroundRunId : data.executionId;

    try {
      await this.notificationsService.createMany(
        recipients.map((userId) => ({
          workspaceId: data.workspaceId!,
          userId,
          type: 'background_failed',
          title: 'Background 본문 실패',
          message: `워크플로우 ${data.workflowId}의 Background 본문 실행이 실패했어요: ${message}`,
          resourceType,
          resourceId,
          channel: 'in_app',
        })),
      );
    } catch (err) {
      // 알림 발송 실패가 background body 의 retry 결정을 흔들지 않도록 격리.
      this.logger.error(
        `Failed to dispatch background_failed notification (workspaceId=${data.workspaceId}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
