import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Execution } from '../entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../../node-executions/entities/node-execution.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import {
  BackgroundRunNodeExecutionDto,
  BackgroundRunNodeExecutionsPageDto,
  BackgroundRunNotificationDto,
  BackgroundRunResponseDto,
  BackgroundRunStatus,
} from './dto/background-run-response.dto';
import { QueryBackgroundRunDto } from './dto/query-background-run.dto';

const NODE_EXECUTIONS_DEFAULT_LIMIT = 50;
const NODE_EXECUTIONS_MAX_LIMIT = 200;

interface CursorPayload {
  s: string; // ISO8601 startedAt
  i: string; // NodeExecution.id
}

/**
 * Background 본문 실행 모니터링 read-only API 서비스.
 *
 * spec/4-nodes/1-logic/12-background.md §8 의 조회 키 `meta.backgroundRunId`
 * 를 받아 본문 서브그래프의 NodeExecution 들을 cursor 페이지네이션으로 반환한다.
 * 메인 흐름의 격리 컨트랙트(§4)에 영향을 주지 않는 순수 read.
 *
 * 인덱싱: `node_execution.output_data #>> '{meta,backgroundRunId}'` 부분 expression
 * 인덱스 (V047) 가 Background 노드 NodeExecution 단건 조회를 받친다.
 */
@Injectable()
export class BackgroundRunsService {
  constructor(
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(NodeExecution)
    private readonly nodeExecutionRepository: Repository<NodeExecution>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  /**
   * WebSocket subscribe 가드용 — `background:run:<id>` 채널 구독 시 호출.
   * `backgroundRunId` 가 식별하는 NodeExecution 의 Execution 이 가입자
   * workspace 에 속하는지 검증한다. 메시지 누수 (channel hijacking) 차단.
   *
   * boolean 반환 (kb 채널과 동일 시그니처) — 실패 / 조회 실패 모두 false.
   */
  async verifyBackgroundRunOwnership(
    backgroundRunId: string,
    userWorkspaceId: string,
  ): Promise<boolean> {
    if (!backgroundRunId || !userWorkspaceId) return false;
    // 두 단계 join (NodeExecution → Execution → Workflow) 의 workspace_id 만
    // 필요하므로 relation hydration 을 피하고 raw select 로 단일 컬럼만 조회.
    // V047 의 부분 expression 인덱스가 `meta.backgroundRunId` 단건 조회를 받친다.
    const raw = await this.nodeExecutionRepository
      .createQueryBuilder('ne')
      .innerJoin('execution', 'e', 'e.id = ne.execution_id')
      .innerJoin('workflow', 'w', 'w.id = e.workflow_id')
      .where(
        "ne.output_data #>> '{meta,backgroundRunId}' = :backgroundRunId",
        { backgroundRunId },
      )
      .select('w.workspace_id', 'workspaceId')
      .getRawOne<{ workspaceId: string }>();
    return !!raw?.workspaceId && raw.workspaceId === userWorkspaceId;
  }

  async getBackgroundRun(
    executionId: string,
    backgroundRunId: string,
    query: QueryBackgroundRunDto,
    userWorkspaceId: string,
  ): Promise<BackgroundRunResponseDto> {
    const limit = this.resolveLimit(query.limit);
    const cursor = this.decodeCursor(query.cursor);

    await this.verifyExecutionAccess(executionId, userWorkspaceId);

    const backgroundNodeExecution = await this.findBackgroundNodeExecution(
      executionId,
      backgroundRunId,
    );

    const parentNodeExecutionId = backgroundNodeExecution.id;
    const startedAt = this.extractStartedAt(backgroundNodeExecution);

    const pageRows = await this.fetchBodyPage(
      parentNodeExecutionId,
      cursor,
      limit,
    );
    const { data, nextCursor, hasMore } = this.buildPage(pageRows, limit);

    // status 산정은 본문 전체에 대해 평가하므로 페이지가 아닌 집계 쿼리로 분리.
    const aggregate = await this.aggregateBodyStatus(parentNodeExecutionId);

    const status = this.deriveBackgroundRunStatus(aggregate);
    const completedAt = this.deriveCompletedAt(aggregate, status);
    const durationMs =
      completedAt && startedAt
        ? new Date(completedAt).getTime() - new Date(startedAt).getTime()
        : null;

    const notifications = await this.fetchNotifications(backgroundRunId);

    return {
      backgroundRunId,
      executionId,
      parentNodeExecutionId,
      status,
      startedAt,
      completedAt,
      durationMs,
      nodeExecutions: {
        data,
        nextCursor,
        hasMore,
      },
      notifications,
    };
  }

  private resolveLimit(raw: number | undefined): number {
    const value = raw ?? NODE_EXECUTIONS_DEFAULT_LIMIT;
    if (value < 1 || value > NODE_EXECUTIONS_MAX_LIMIT) {
      throw new BadRequestException({
        code: 'INVALID_LIMIT',
        message: `limit must be between 1 and ${NODE_EXECUTIONS_MAX_LIMIT}`,
      });
    }
    return value;
  }

  private decodeCursor(raw: string | undefined): CursorPayload | null {
    if (!raw) return null;
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded) as CursorPayload;
      if (
        !parsed ||
        typeof parsed.s !== 'string' ||
        typeof parsed.i !== 'string'
      ) {
        throw new Error('cursor missing fields');
      }
      const parsedDate = new Date(parsed.s);
      if (Number.isNaN(parsedDate.getTime())) {
        throw new Error('cursor invalid date');
      }
      return parsed;
    } catch {
      throw new BadRequestException({
        code: 'INVALID_CURSOR',
        message: 'cursor must be a valid opaque token',
      });
    }
  }

  private encodeCursor(payload: CursorPayload): string {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  }

  /**
   * IDOR 차단 + 워크스페이스 검증. ExecutionsService.verifyOwnership 와 동일
   * 의미지만 본 서비스는 별도 모듈에 두기 위해 자체 구현 — 의도적으로
   * NotFound 로 통일해 ID enumeration 방지.
   */
  private async verifyExecutionAccess(
    executionId: string,
    userWorkspaceId: string,
  ): Promise<void> {
    const row = await this.executionRepository
      .createQueryBuilder('e')
      .leftJoin('e.workflow', 'workflow')
      .select(['e.id', 'workflow.workspaceId'])
      .where('e.id = :id', { id: executionId })
      .getOne();
    if (!row || row.workflow?.workspaceId !== userWorkspaceId) {
      throw new NotFoundException({
        code: 'EXECUTION_NOT_FOUND',
        message: 'Execution not found',
      });
    }
  }

  private async findBackgroundNodeExecution(
    executionId: string,
    backgroundRunId: string,
  ): Promise<NodeExecution> {
    // V047 부분 expression 인덱스 (output_data #>> '{meta,backgroundRunId}')
    // 가 본 단건 조회를 받친다. execution_id 필터를 함께 둬 인덱스 매칭 후의
    // row 후처리 비용을 최소화.
    const row = await this.nodeExecutionRepository
      .createQueryBuilder('ne')
      .where('ne.executionId = :executionId', { executionId })
      .andWhere(
        "ne.outputData #>> '{meta,backgroundRunId}' = :backgroundRunId",
        { backgroundRunId },
      )
      .getOne();
    if (!row) {
      throw new NotFoundException({
        code: 'BACKGROUND_RUN_NOT_FOUND',
        message: 'Background run not found in this execution',
      });
    }
    return row;
  }

  private extractStartedAt(backgroundNodeExecution: NodeExecution): string {
    const meta = (backgroundNodeExecution.outputData?.['meta'] ?? {}) as {
      forkedAt?: string;
    };
    if (typeof meta.forkedAt === 'string') return meta.forkedAt;
    // fallback — handler 가 forkedAt 을 발급하기 전 (옛 row) 호환.
    return this.toIso(backgroundNodeExecution.startedAt);
  }

  private async fetchBodyPage(
    parentNodeExecutionId: string,
    cursor: CursorPayload | null,
    limit: number,
  ): Promise<NodeExecution[]> {
    const qb = this.nodeExecutionRepository
      .createQueryBuilder('ne')
      .where('ne.parentNodeExecutionId = :parentNodeExecutionId', {
        parentNodeExecutionId,
      });
    if (cursor) {
      qb.andWhere(
        '(ne.startedAt > :lastStartedAt OR (ne.startedAt = :lastStartedAt AND ne.id > :lastId))',
        {
          lastStartedAt: new Date(cursor.s),
          lastId: cursor.i,
        },
      );
    }
    qb.orderBy('ne.startedAt', 'ASC').addOrderBy('ne.id', 'ASC').take(limit + 1);
    return qb.getMany();
  }

  private buildPage(
    rows: NodeExecution[],
    limit: number,
  ): {
    data: BackgroundRunNodeExecutionDto[];
    nextCursor: string | null;
    hasMore: boolean;
  } {
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const data = slice.map((row) => this.toNodeExecutionDto(row));
    const last = slice[slice.length - 1];
    const nextCursor =
      hasMore && last
        ? this.encodeCursor({
            s: this.toIso(last.startedAt),
            i: last.id,
          })
        : null;
    return { data, nextCursor, hasMore };
  }

  private toNodeExecutionDto(row: NodeExecution): BackgroundRunNodeExecutionDto {
    return {
      id: row.id,
      executionId: row.executionId,
      nodeId: row.nodeId,
      parentNodeExecutionId: row.parentNodeExecutionId ?? '',
      status: row.status,
      startedAt: this.toIso(row.startedAt),
      finishedAt: row.finishedAt ? this.toIso(row.finishedAt) : null,
      durationMs: row.durationMs ?? null,
      inputData: row.inputData ?? null,
      outputData: row.outputData ?? null,
      error: row.error ?? null,
    };
  }

  private async aggregateBodyStatus(
    parentNodeExecutionId: string,
  ): Promise<{
    totalCount: number;
    pendingCount: number;
    runningCount: number;
    completedCount: number;
    failedCount: number;
    skippedCount: number;
    waitingCount: number;
    latestFinishedAt: Date | null;
  }> {
    // 본문 노드 수가 많아도 단일 집계 쿼리로 처리 — 페이지네이션과 분리.
    const raw = await this.nodeExecutionRepository
      .createQueryBuilder('ne')
      .select([
        'COUNT(*) AS total',
        `SUM(CASE WHEN ne.status = 'pending' THEN 1 ELSE 0 END) AS pending`,
        `SUM(CASE WHEN ne.status = 'running' THEN 1 ELSE 0 END) AS running`,
        `SUM(CASE WHEN ne.status = 'completed' THEN 1 ELSE 0 END) AS completed`,
        `SUM(CASE WHEN ne.status = 'failed' THEN 1 ELSE 0 END) AS failed`,
        `SUM(CASE WHEN ne.status = 'skipped' THEN 1 ELSE 0 END) AS skipped`,
        `SUM(CASE WHEN ne.status = 'waiting_for_input' THEN 1 ELSE 0 END) AS waiting`,
        'MAX(ne.finishedAt) AS latestFinished',
      ])
      .where('ne.parentNodeExecutionId = :parentNodeExecutionId', {
        parentNodeExecutionId,
      })
      .getRawOne<{
        total: string | null;
        pending: string | null;
        running: string | null;
        completed: string | null;
        failed: string | null;
        skipped: string | null;
        waiting: string | null;
        latestFinished: Date | null;
      }>();
    return {
      totalCount: Number(raw?.total ?? 0),
      pendingCount: Number(raw?.pending ?? 0),
      runningCount: Number(raw?.running ?? 0),
      completedCount: Number(raw?.completed ?? 0),
      failedCount: Number(raw?.failed ?? 0),
      skippedCount: Number(raw?.skipped ?? 0),
      waitingCount: Number(raw?.waiting ?? 0),
      latestFinishedAt: raw?.latestFinished ?? null,
    };
  }

  private deriveBackgroundRunStatus(aggregate: {
    totalCount: number;
    pendingCount: number;
    runningCount: number;
    completedCount: number;
    failedCount: number;
    skippedCount: number;
    waitingCount: number;
  }): BackgroundRunStatus {
    if (aggregate.totalCount === 0) return 'pending';
    if (aggregate.failedCount > 0) return 'failed';
    if (aggregate.runningCount > 0 || aggregate.waitingCount > 0) {
      return 'running';
    }
    const terminalReached =
      aggregate.completedCount + aggregate.skippedCount + aggregate.failedCount;
    if (
      aggregate.pendingCount === 0 &&
      terminalReached === aggregate.totalCount
    ) {
      return 'completed';
    }
    return 'running';
  }

  private deriveCompletedAt(
    aggregate: { latestFinishedAt: Date | null },
    status: BackgroundRunStatus,
  ): string | null {
    if (status === 'running' || status === 'pending') return null;
    return aggregate.latestFinishedAt
      ? this.toIso(aggregate.latestFinishedAt)
      : null;
  }

  private async fetchNotifications(
    backgroundRunId: string,
  ): Promise<BackgroundRunNotificationDto[]> {
    // resourceType='background_run' 으로 정확 attribution. processor 변경으로
    // 새 알림은 모두 이 형태 — 옛 (resource_type='execution') 알림은 본 API
    // 의 범위 밖.
    const rows = await this.notificationRepository.find({
      where: { resourceType: 'background_run', resourceId: backgroundRunId },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      channel: row.channel,
      createdAt: this.toIso(row.createdAt),
    }));
  }

  private toIso(d: Date | string): string {
    return d instanceof Date ? d.toISOString() : d;
  }
}

// Re-export for test convenience.
export { NodeExecutionStatus };
