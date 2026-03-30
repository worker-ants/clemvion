import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Execution, ExecutionStatus } from './entities/execution.entity';
import { NodeExecution } from '../node-executions/entities/node-execution.entity';
import { QueryExecutionDto } from './dto/query-execution.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@Injectable()
export class ExecutionsService {
  constructor(
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(NodeExecution)
    private readonly nodeExecutionRepository: Repository<NodeExecution>,
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
      order: { startedAt: 'ASC' },
    });

    return { ...execution, nodeExecutions };
  }

  async findByWorkflow(
    workflowId: string,
    query: QueryExecutionDto,
  ): Promise<PaginatedResponseDto<Execution>> {
    const {
      page = 1,
      limit = 20,
      sort = 'started_at',
      order = 'desc',
      status,
    } = query;

    const qb = this.executionRepository
      .createQueryBuilder('e')
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

    return PaginatedResponseDto.create(data, totalItems, page, limit);
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
      execution.status !== ExecutionStatus.PENDING
    ) {
      throw new BadRequestException({
        code: 'INVALID_STATE',
        message: `Cannot stop execution with status '${execution.status}'`,
      });
    }

    execution.status = ExecutionStatus.CANCELLED;
    execution.finishedAt = new Date();
    if (execution.startedAt) {
      execution.durationMs =
        execution.finishedAt.getTime() - execution.startedAt.getTime();
    }

    return this.executionRepository.save(execution);
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
