import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from '../workflows/entities/workflow.entity';
import { Execution } from '../executions/entities/execution.entity';
import { NodeExecution } from '../node-executions/entities/node-execution.entity';
import { LlmUsageLog } from '../llm/entities/llm-usage-log.entity';
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

export interface LlmUsageByModel {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number | null;
}

export interface LlmUsageSummary {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostUsd: number | null;
  topProvider: string | null;
  byModel: LlmUsageByModel[];
}

export interface LlmUsageTimePoint {
  date: string;
  provider: string;
  totalTokens: number;
  costUsd: number | null;
}

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(NodeExecution)
    private readonly nodeExecutionRepository: Repository<NodeExecution>,
    @InjectRepository(LlmUsageLog)
    private readonly llmUsageLogRepository: Repository<LlmUsageLog>,
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

  async getNodeStats(
    workspaceId: string,
    query: QueryStatisticsDto,
  ): Promise<
    Array<{
      nodeId: string;
      nodeLabel: string;
      nodeType: string;
      executionCount: number;
      avgDurationMs: number;
      errorRate: number;
    }>
  > {
    if (!query.workflowId) {
      return [];
    }

    const { startDate, endDate } = this.resolveDateRange(query);

    const results = await this.nodeExecutionRepository
      .createQueryBuilder('ne')
      .innerJoin('ne.execution', 'e')
      .innerJoin('ne.node', 'n')
      .innerJoin('e.workflow', 'w')
      .select([
        'n.id AS "nodeId"',
        'n.label AS "nodeLabel"',
        'n.type AS "nodeType"',
        'COUNT(*)::int AS "executionCount"',
        'COALESCE(AVG(ne.duration_ms) FILTER (WHERE ne.duration_ms IS NOT NULL), 0)::float AS "avgDurationMs"',
        'CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE ne.status = \'failed\')::numeric / COUNT(*)::numeric * 100, 2)::float ELSE 0 END AS "errorRate"',
      ])
      .where('w.workspace_id = :workspaceId', { workspaceId })
      .andWhere('e.workflow_id = :workflowId', {
        workflowId: query.workflowId,
      })
      .andWhere('e.started_at >= :startDate', { startDate })
      .andWhere('e.started_at <= :endDate', { endDate })
      .groupBy('n.id')
      .addGroupBy('n.label')
      .addGroupBy('n.type')
      .orderBy('"avgDurationMs"', 'DESC')
      .getRawMany();

    return results;
  }

  async exportData(
    workspaceId: string,
    query: QueryStatisticsDto,
    format: 'json' | 'csv' = 'json',
  ): Promise<{ data: string; contentType: string; filename: string }> {
    const [summary, executions, errors, topWorkflows] = await Promise.all([
      this.getSummary(workspaceId, query),
      this.getExecutionsByPeriod(workspaceId, query),
      this.getErrors(workspaceId, query),
      this.getTopWorkflows(workspaceId, query),
    ]);

    const period = query.period || '7d';

    if (format === 'csv') {
      const rows = ['date,total,completed,failed,cancelled'];
      for (const entry of executions) {
        rows.push(
          `${entry.date},${entry.total},${entry.completed},${entry.failed},${entry.cancelled}`,
        );
      }
      return {
        data: rows.join('\n'),
        contentType: 'text/csv',
        filename: `statistics-${period}.csv`,
      };
    }

    return {
      data: JSON.stringify(
        { summary, executions, errors, topWorkflows },
        null,
        2,
      ),
      contentType: 'application/json',
      filename: `statistics-${period}.json`,
    };
  }

  async getLlmUsageSummary(
    workspaceId: string,
    query: QueryStatisticsDto,
  ): Promise<LlmUsageSummary> {
    const { startDate, endDate } = this.resolveDateRange(query);

    const qb = this.llmUsageLogRepository
      .createQueryBuilder('u')
      .select([
        'u.provider AS provider',
        'u.model AS model',
        'COALESCE(SUM(u.prompt_tokens), 0)::int AS "promptTokens"',
        'COALESCE(SUM(u.completion_tokens), 0)::int AS "completionTokens"',
        'COALESCE(SUM(u.total_tokens), 0)::int AS "totalTokens"',
        'SUM(u.cost_usd)::float AS "costUsd"',
      ])
      .where('u.workspace_id = :workspaceId', { workspaceId })
      .andWhere('u.created_at >= :startDate', { startDate })
      .andWhere('u.created_at <= :endDate', { endDate })
      .groupBy('u.provider')
      .addGroupBy('u.model')
      .orderBy('"totalTokens"', 'DESC');

    if (query.workflowId) {
      qb.andWhere('u.workflow_id = :workflowId', {
        workflowId: query.workflowId,
      });
    }

    const rows = await qb.getRawMany<{
      provider: string;
      model: string;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      costUsd: number | null;
    }>();

    const byModel: LlmUsageByModel[] = rows.map((row) => ({
      provider: row.provider,
      model: row.model,
      promptTokens: Number(row.promptTokens) || 0,
      completionTokens: Number(row.completionTokens) || 0,
      totalTokens: Number(row.totalTokens) || 0,
      costUsd: row.costUsd === null ? null : Number(row.costUsd),
    }));

    const totalPromptTokens = byModel.reduce(
      (acc, m) => acc + m.promptTokens,
      0,
    );
    const totalCompletionTokens = byModel.reduce(
      (acc, m) => acc + m.completionTokens,
      0,
    );
    const totalTokens = byModel.reduce((acc, m) => acc + m.totalTokens, 0);
    const totalCostUsd = byModel.some((m) => m.costUsd !== null)
      ? byModel.reduce((acc, m) => acc + (m.costUsd ?? 0), 0)
      : null;

    const providerTotals = new Map<string, number>();
    for (const m of byModel) {
      providerTotals.set(
        m.provider,
        (providerTotals.get(m.provider) ?? 0) + m.totalTokens,
      );
    }
    let topProvider: string | null = null;
    let topProviderTokens = 0;
    for (const [provider, tokens] of providerTotals) {
      if (tokens > topProviderTokens) {
        topProvider = provider;
        topProviderTokens = tokens;
      }
    }

    return {
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      totalCostUsd,
      topProvider,
      byModel,
    };
  }

  async getLlmUsageTimeseries(
    workspaceId: string,
    query: QueryStatisticsDto,
  ): Promise<LlmUsageTimePoint[]> {
    const { startDate, endDate } = this.resolveDateRange(query);

    const qb = this.llmUsageLogRepository
      .createQueryBuilder('u')
      .select([
        "TO_CHAR(u.created_at, 'YYYY-MM-DD') AS date",
        'u.provider AS provider',
        'COALESCE(SUM(u.total_tokens), 0)::int AS "totalTokens"',
        'SUM(u.cost_usd)::float AS "costUsd"',
      ])
      .where('u.workspace_id = :workspaceId', { workspaceId })
      .andWhere('u.created_at >= :startDate', { startDate })
      .andWhere('u.created_at <= :endDate', { endDate })
      .groupBy("TO_CHAR(u.created_at, 'YYYY-MM-DD')")
      .addGroupBy('u.provider')
      .orderBy('date', 'ASC')
      .addOrderBy('provider', 'ASC');

    if (query.workflowId) {
      qb.andWhere('u.workflow_id = :workflowId', {
        workflowId: query.workflowId,
      });
    }

    const rows = await qb.getRawMany<{
      date: string;
      provider: string;
      totalTokens: number;
      costUsd: number | null;
    }>();

    return rows.map((row) => ({
      date: row.date,
      provider: row.provider,
      totalTokens: Number(row.totalTokens) || 0,
      costUsd: row.costUsd === null ? null : Number(row.costUsd),
    }));
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
