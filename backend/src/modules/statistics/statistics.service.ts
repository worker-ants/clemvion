import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from '../workflows/entities/workflow.entity';
import { Execution } from '../executions/entities/execution.entity';
import { QueryStatisticsDto } from './dto/query-statistics.dto';

export interface StatisticsSummary {
  totalExecutions: number;
  successCount: number;
  failedCount: number;
  cancelledCount: number;
  successRate: number;
  avgDurationMs: number;
}

export interface ExecutionsByPeriod {
  date: string;
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export interface ErrorStat {
  workflowId: string;
  workflowName: string;
  errorCount: number;
  lastErrorAt: string;
}

export interface TopWorkflow {
  workflowId: string;
  workflowName: string;
  executionCount: number;
  successRate: number;
  avgDurationMs: number;
}

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
  ) {}

  async getSummary(
    workspaceId: string,
    query: QueryStatisticsDto,
  ): Promise<StatisticsSummary> {
    const { startDate, endDate } = this.resolveDateRange(query);

    const result = await this.executionRepository
      .createQueryBuilder('e')
      .innerJoin('e.workflow', 'w')
      .select([
        'COUNT(*)::int AS "totalExecutions"',
        'COUNT(*) FILTER (WHERE e.status = \'completed\')::int AS "successCount"',
        'COUNT(*) FILTER (WHERE e.status = \'failed\')::int AS "failedCount"',
        'COUNT(*) FILTER (WHERE e.status = \'cancelled\')::int AS "cancelledCount"',
        'COALESCE(AVG(e.duration_ms) FILTER (WHERE e.duration_ms IS NOT NULL), 0)::float AS "avgDurationMs"',
      ])
      .where('w.workspace_id = :workspaceId', { workspaceId })
      .andWhere('e.started_at >= :startDate', { startDate })
      .andWhere('e.started_at <= :endDate', { endDate })
      .getRawOne();

    if (query.workflowId) {
      // Re-run with workflow filter - done via separate query to keep above clean
      const filtered = await this.executionRepository
        .createQueryBuilder('e')
        .innerJoin('e.workflow', 'w')
        .select([
          'COUNT(*)::int AS "totalExecutions"',
          'COUNT(*) FILTER (WHERE e.status = \'completed\')::int AS "successCount"',
          'COUNT(*) FILTER (WHERE e.status = \'failed\')::int AS "failedCount"',
          'COUNT(*) FILTER (WHERE e.status = \'cancelled\')::int AS "cancelledCount"',
          'COALESCE(AVG(e.duration_ms) FILTER (WHERE e.duration_ms IS NOT NULL), 0)::float AS "avgDurationMs"',
        ])
        .where('w.workspace_id = :workspaceId', { workspaceId })
        .andWhere('e.workflow_id = :workflowId', {
          workflowId: query.workflowId,
        })
        .andWhere('e.started_at >= :startDate', { startDate })
        .andWhere('e.started_at <= :endDate', { endDate })
        .getRawOne();

      return this.buildSummary(filtered);
    }

    return this.buildSummary(result);
  }

  async getExecutionsByPeriod(
    workspaceId: string,
    query: QueryStatisticsDto,
  ): Promise<ExecutionsByPeriod[]> {
    const { startDate, endDate } = this.resolveDateRange(query);

    const qb = this.executionRepository
      .createQueryBuilder('e')
      .innerJoin('e.workflow', 'w')
      .select([
        "TO_CHAR(e.started_at, 'YYYY-MM-DD') AS date",
        'COUNT(*)::int AS total',
        "COUNT(*) FILTER (WHERE e.status = 'completed')::int AS completed",
        "COUNT(*) FILTER (WHERE e.status = 'failed')::int AS failed",
        "COUNT(*) FILTER (WHERE e.status = 'cancelled')::int AS cancelled",
      ])
      .where('w.workspace_id = :workspaceId', { workspaceId })
      .andWhere('e.started_at >= :startDate', { startDate })
      .andWhere('e.started_at <= :endDate', { endDate })
      .groupBy("TO_CHAR(e.started_at, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC');

    if (query.workflowId) {
      qb.andWhere('e.workflow_id = :workflowId', {
        workflowId: query.workflowId,
      });
    }

    return qb.getRawMany();
  }

  async getErrors(
    workspaceId: string,
    query: QueryStatisticsDto,
  ): Promise<ErrorStat[]> {
    const { startDate, endDate } = this.resolveDateRange(query);

    const qb = this.executionRepository
      .createQueryBuilder('e')
      .innerJoin('e.workflow', 'w')
      .select([
        'w.id AS "workflowId"',
        'w.name AS "workflowName"',
        'COUNT(*)::int AS "errorCount"',
        'MAX(e.started_at) AS "lastErrorAt"',
      ])
      .where('w.workspace_id = :workspaceId', { workspaceId })
      .andWhere("e.status = 'failed'")
      .andWhere('e.started_at >= :startDate', { startDate })
      .andWhere('e.started_at <= :endDate', { endDate })
      .groupBy('w.id')
      .addGroupBy('w.name')
      .orderBy('"errorCount"', 'DESC')
      .limit(20);

    if (query.workflowId) {
      qb.andWhere('e.workflow_id = :workflowId', {
        workflowId: query.workflowId,
      });
    }

    return qb.getRawMany();
  }

  async getTopWorkflows(
    workspaceId: string,
    query: QueryStatisticsDto,
  ): Promise<TopWorkflow[]> {
    const { startDate, endDate } = this.resolveDateRange(query);

    const results = await this.executionRepository
      .createQueryBuilder('e')
      .innerJoin('e.workflow', 'w')
      .select([
        'w.id AS "workflowId"',
        'w.name AS "workflowName"',
        'COUNT(*)::int AS "executionCount"',
        'CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE e.status = \'completed\')::numeric / COUNT(*)::numeric * 100, 2)::float ELSE 0 END AS "successRate"',
        'COALESCE(AVG(e.duration_ms) FILTER (WHERE e.duration_ms IS NOT NULL), 0)::float AS "avgDurationMs"',
      ])
      .where('w.workspace_id = :workspaceId', { workspaceId })
      .andWhere('e.started_at >= :startDate', { startDate })
      .andWhere('e.started_at <= :endDate', { endDate })
      .groupBy('w.id')
      .addGroupBy('w.name')
      .orderBy('"executionCount"', 'DESC')
      .limit(10)
      .getRawMany();

    return results;
  }

  private resolveDateRange(query: QueryStatisticsDto): {
    startDate: Date;
    endDate: Date;
  } {
    const endDate = query.endDate ? new Date(query.endDate) : new Date();

    if (query.period === 'custom' && query.startDate) {
      return { startDate: new Date(query.startDate), endDate };
    }

    const startDate = new Date(endDate);
    switch (query.period) {
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '7d':
      default:
        startDate.setDate(startDate.getDate() - 7);
        break;
    }

    return { startDate, endDate };
  }

  private buildSummary(raw: Record<string, unknown>): StatisticsSummary {
    const totalExecutions = Number(raw?.totalExecutions) || 0;
    const successCount = Number(raw?.successCount) || 0;
    const failedCount = Number(raw?.failedCount) || 0;
    const cancelledCount = Number(raw?.cancelledCount) || 0;
    const avgDurationMs = Math.round(Number(raw?.avgDurationMs) || 0);
    const successRate =
      totalExecutions > 0
        ? Math.round((successCount / totalExecutions) * 10000) / 100
        : 0;

    return {
      totalExecutions,
      successCount,
      failedCount,
      cancelledCount,
      successRate,
      avgDurationMs,
    };
  }
}
