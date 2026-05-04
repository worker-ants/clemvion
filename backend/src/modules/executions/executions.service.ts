import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Execution, ExecutionStatus } from './entities/execution.entity';
import { NodeExecution } from '../node-executions/entities/node-execution.entity';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { QueryExecutionDto } from './dto/query-execution.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { ExecutionDto } from './dto/responses/execution-response.dto';
import { deriveExecutionTrigger } from './utils/execution-trigger';

@Injectable()
export class ExecutionsService {
  constructor(
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(NodeExecution)
    private readonly nodeExecutionRepository: Repository<NodeExecution>,
    private readonly executionEngineService: ExecutionEngineService,
  ) {}

  async findById(
    id: string,
  ): Promise<Execution & { nodeExecutions: NodeExecution[] }> {
    const execution = await this.executionRepository.findOne({
      where: { id },
      relations: ['workflow'],
    });
    if (!execution) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Execution not found',
      });
    }

    const nodeExecutions = await this.nodeExecutionRepository.find({
      where: { executionId: id },
      relations: ['node'],
      order: { startedAt: 'ASC' },
    });

    return { ...execution, nodeExecutions };
  }

  async findByWorkflow(
    workflowId: string,
    query: QueryExecutionDto,
  ): Promise<PaginatedResponseDto<ExecutionDto>> {
    const {
      page = 1,
      limit = 20,
      sort = 'started_at',
      order = 'desc',
      status,
    } = query;

    // 안전한 컬럼만 선택적으로 join — User.passwordHash 등 민감 필드 노출 방지
    const qb = this.executionRepository
      .createQueryBuilder('e')
      .leftJoin('e.trigger', 'trigger')
      .addSelect(['trigger.id', 'trigger.type', 'trigger.name'])
      .leftJoin('e.executor', 'executor')
      .addSelect(['executor.id', 'executor.name', 'executor.email'])
      .where('e.workflow_id = :workflowId', { workflowId });

    if (status) {
      qb.andWhere('e.status = :status', { status });
    }

    const sortColumn = this.getSortColumn(sort);
    qb.orderBy(`e.${sortColumn}`, order.toUpperCase() as 'ASC' | 'DESC');

    const totalItems = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const parentNameMap = await this.loadParentWorkflowNames(data);
    const dtoList = data.map((e) => this.toExecutionDto(e, parentNameMap));
    return PaginatedResponseDto.create(dtoList, totalItems, page, limit);
  }

  async stop(id: string): Promise<Execution> {
    const execution = await this.executionRepository.findOne({
      where: { id },
    });
    if (!execution) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Execution not found',
      });
    }

    if (
      execution.status !== ExecutionStatus.RUNNING &&
      execution.status !== ExecutionStatus.PENDING &&
      execution.status !== ExecutionStatus.WAITING_FOR_INPUT
    ) {
      throw new BadRequestException({
        code: 'INVALID_STATE',
        message: `Cannot stop execution with status '${execution.status}'`,
      });
    }

    if (execution.status === ExecutionStatus.WAITING_FOR_INPUT) {
      this.executionEngineService.cancelWaitingExecution(id);
      const updated = await this.executionRepository.findOne({
        where: { id },
      });
      return updated ?? execution;
    }

    execution.status = ExecutionStatus.CANCELLED;
    execution.finishedAt = new Date();
    if (execution.startedAt) {
      execution.durationMs =
        execution.finishedAt.getTime() - execution.startedAt.getTime();
    }

    return this.executionRepository.save(execution);
  }

  /**
   * 페이지 내에 서브워크플로우 실행이 있을 때, 부모 실행의 workflow.name 을
   * `parentExecutionId IN (...)` 한 번의 쿼리로 일괄 로드한다.
   */
  private async loadParentWorkflowNames(
    executions: Execution[],
  ): Promise<Map<string, string | null>> {
    const parentIds = Array.from(
      new Set(
        executions
          .map((e) => e.parentExecutionId)
          .filter((v): v is string => !!v),
      ),
    );
    const map = new Map<string, string | null>();
    if (parentIds.length === 0) return map;

    const parents = await this.executionRepository.find({
      where: { id: In(parentIds) },
      relations: ['workflow'],
    });
    for (const p of parents) {
      map.set(p.id, p.workflow?.name ?? null);
    }
    return map;
  }

  private toExecutionDto(
    execution: Execution,
    parentNameMap: Map<string, string | null>,
  ): ExecutionDto {
    const parentName = execution.parentExecutionId
      ? (parentNameMap.get(execution.parentExecutionId) ?? null)
      : null;
    const trigger = deriveExecutionTrigger(execution, parentName);
    return {
      id: execution.id,
      workflowId: execution.workflowId,
      triggerId: execution.triggerId ?? null,
      triggerSource: trigger.source,
      triggerLabel: trigger.label,
      status: execution.status,
      startedAt: this.toIso(execution.startedAt),
      finishedAt: execution.finishedAt
        ? this.toIso(execution.finishedAt)
        : null,
      durationMs: execution.durationMs ?? null,
      inputData: execution.inputData ?? null,
      outputData: execution.outputData ?? null,
      error: execution.error ?? null,
      executedBy: execution.executedBy ?? null,
      parentExecutionId: execution.parentExecutionId ?? null,
      recursionDepth: execution.recursionDepth ?? 0,
      executionPath: execution.executionPath ?? [],
    };
  }

  private toIso(d: Date | string): string {
    return d instanceof Date ? d.toISOString() : d;
  }

  private getSortColumn(sort: string): string {
    const allowed: Record<string, string> = {
      started_at: 'started_at',
      finished_at: 'finished_at',
      status: 'status',
      duration_ms: 'duration_ms',
    };
    return allowed[sort] || 'started_at';
  }
}
