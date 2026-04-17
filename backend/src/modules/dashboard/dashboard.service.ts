import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from '../workflows/entities/workflow.entity';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';

export interface DashboardSummary {
  totalWorkflows: number;
  activeWorkflows: number;
  runs7d: number;
  runs7dPrevious: number;
  runs7dChangePercent: number | null;
  successRate: number;
  avgExecutionTime: number;
}

export interface RecentWorkflow {
  id: string;
  name: string;
  isActive: boolean;
  updatedAt: Date;
}

export interface RecentExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  durationMs: number | null;
  startedAt: Date;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
  ) {}

  async getSummary(workspaceId: string): Promise<DashboardSummary> {
    const totalWorkflows = await this.workflowRepository.count({
      where: { workspaceId },
    });

    const activeWorkflows = await this.workflowRepository.count({
      where: { workspaceId, isActive: true },
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const fourteenDaysAgo = new Date(sevenDaysAgo);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 7);

    const [runs7dResult, runs7dPrevious] = await Promise.all([
      this.executionRepository
        .createQueryBuilder('e')
        .innerJoin('e.workflow', 'w')
        .where('w.workspace_id = :workspaceId', { workspaceId })
        .andWhere('e.started_at >= :sevenDaysAgo', { sevenDaysAgo })
        .getCount(),
      this.executionRepository
        .createQueryBuilder('e')
        .innerJoin('e.workflow', 'w')
        .where('w.workspace_id = :workspaceId', { workspaceId })
        .andWhere('e.started_at >= :fourteenDaysAgo', { fourteenDaysAgo })
        .andWhere('e.started_at < :sevenDaysAgo', { sevenDaysAgo })
        .getCount(),
    ]);

    const runs7dChangePercent =
      runs7dPrevious > 0
        ? Math.round(
            ((runs7dResult - runs7dPrevious) / runs7dPrevious) * 10000,
          ) / 100
        : null;

    const successCount = await this.executionRepository
      .createQueryBuilder('e')
      .innerJoin('e.workflow', 'w')
      .where('w.workspace_id = :workspaceId', { workspaceId })
      .andWhere('e.started_at >= :sevenDaysAgo', { sevenDaysAgo })
      .andWhere('e.status = :status', { status: ExecutionStatus.COMPLETED })
      .getCount();

    const successRate =
      runs7dResult > 0
        ? Math.round((successCount / runs7dResult) * 10000) / 100
        : 0;

    const avgResult = await this.executionRepository
      .createQueryBuilder('e')
      .innerJoin('e.workflow', 'w')
      .select('AVG(e.duration_ms)', 'avg')
      .where('w.workspace_id = :workspaceId', { workspaceId })
      .andWhere('e.started_at >= :sevenDaysAgo', { sevenDaysAgo })
      .andWhere('e.duration_ms IS NOT NULL')
      .getRawOne<{ avg: string | number | null }>();

    const avgExecutionTime = avgResult?.avg
      ? Math.round(Number(avgResult.avg))
      : 0;

    return {
      totalWorkflows,
      activeWorkflows,
      runs7d: runs7dResult,
      runs7dPrevious,
      runs7dChangePercent,
      successRate,
      avgExecutionTime,
    };
  }

  async getRecentWorkflows(workspaceId: string): Promise<RecentWorkflow[]> {
    const workflows = await this.workflowRepository
      .createQueryBuilder('w')
      .select(['w.id', 'w.name', 'w.isActive', 'w.updatedAt'])
      .where('w.workspace_id = :workspaceId', { workspaceId })
      .orderBy('w.updated_at', 'DESC')
      .limit(5)
      .getMany();

    return workflows.map((w) => ({
      id: w.id,
      name: w.name,
      isActive: w.isActive,
      updatedAt: w.updatedAt,
    }));
  }

  async getRecentExecutions(workspaceId: string): Promise<RecentExecution[]> {
    const executions = await this.executionRepository
      .createQueryBuilder('e')
      .innerJoinAndSelect('e.workflow', 'w')
      .where('w.workspace_id = :workspaceId', { workspaceId })
      .orderBy('e.started_at', 'DESC')
      .limit(10)
      .getMany();

    return executions.map((e) => ({
      id: e.id,
      workflowId: e.workflowId,
      workflowName: e.workflow.name,
      status: e.status,
      durationMs: e.durationMs,
      startedAt: e.startedAt,
    }));
  }
}
