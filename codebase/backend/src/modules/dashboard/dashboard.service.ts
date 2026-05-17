import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from '../workflows/entities/workflow.entity';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import {
  deriveExecutionTrigger,
  loadParentWorkflowNames,
  type ExecutionTriggerSource,
} from '../executions/utils';

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
  /** 실행 소요 시간(ms). 실행 중이거나 미기록인 경우 null */
  durationMs: number | null;
  startedAt: Date;
  /** 출처 분류 — manual/schedule/webhook/subworkflow/unknown */
  triggerSource: ExecutionTriggerSource;
  /** 출처 보조 라벨(트리거명/실행자명/부모 워크플로명). 정보가 없을 때 null */
  triggerLabel: string | null;
}

/** 대시보드 최근 실행 목록의 최대 노출 건수 — 백엔드/프론트 단일 출처 */
export const DASHBOARD_RECENT_EXECUTIONS_LIMIT = 10;

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
      .orderBy('w.updatedAt', 'DESC')
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
    // 안전 컬럼만 selective join — User.passwordHash 등 민감 필드 노출 방지.
    // workflow 도 name 만 필요하므로 config 등 대형 JSON 컬럼은 적재하지 않는다.
    const executions = await this.executionRepository
      .createQueryBuilder('e')
      .innerJoin('e.workflow', 'w')
      .addSelect(['w.id', 'w.name'])
      .leftJoin('e.trigger', 'trigger')
      .addSelect(['trigger.id', 'trigger.type', 'trigger.name'])
      .leftJoin('e.executor', 'executor')
      .addSelect(['executor.id', 'executor.name'])
      .where('w.workspace_id = :workspaceId', { workspaceId })
      .orderBy('e.startedAt', 'DESC')
      .limit(DASHBOARD_RECENT_EXECUTIONS_LIMIT)
      .getMany();

    // 페이지 안에 서브워크플로우 실행이 하나라도 있을 때만 부모 이름 배치 쿼리 실행.
    const hasSubworkflow = executions.some((e) => !!e.parentExecutionId);
    const parentNameMap = hasSubworkflow
      ? await loadParentWorkflowNames(this.executionRepository, executions)
      : new Map<string, string | null>();

    return executions.map((e) => {
      const parentName = e.parentExecutionId
        ? (parentNameMap.get(e.parentExecutionId) ?? null)
        : null;
      const trigger = deriveExecutionTrigger(e, parentName);
      return {
        id: e.id,
        workflowId: e.workflowId,
        workflowName: e.workflow.name,
        status: e.status,
        durationMs: e.durationMs,
        startedAt: e.startedAt,
        triggerSource: trigger.source,
        triggerLabel: trigger.label,
      };
    });
  }
}
