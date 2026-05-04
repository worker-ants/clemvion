import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trigger } from './entities/trigger.entity';
import { Execution } from '../executions/entities/execution.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { CreateTriggerDto } from './dto/create-trigger.dto';
import { UpdateTriggerDto } from './dto/update-trigger.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export type TriggerDetail = Trigger & {
  cronExpression?: string;
  timezone?: string;
  nextRunAt?: Date | null;
};

@Injectable()
export class TriggersService {
  constructor(
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
  ) {}

  async findAll(
    workspaceId: string,
    query: PaginationQueryDto & { type?: string; status?: string },
  ): Promise<PaginatedResponseDto<Trigger>> {
    const { page = 1, limit = 20, search, type, status } = query;

    const qb = this.triggerRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.workflow', 'w')
      .where('t.workspace_id = :workspaceId', { workspaceId });

    if (search) {
      qb.andWhere('t.name ILIKE :search', { search: `%${search}%` });
    }
    if (type) {
      qb.andWhere('t.type = :type', { type });
    }
    if (status === 'active') {
      qb.andWhere('t.is_active = true');
    } else if (status === 'inactive') {
      qb.andWhere('t.is_active = false');
    }

    qb.orderBy('t.created_at', 'DESC');

    const totalItems = await qb.getCount();
    const data = await qb
      .offset((page - 1) * limit)
      .limit(limit)
      .getMany();

    return PaginatedResponseDto.create(data, totalItems, page, limit);
  }

  async findById(id: string, workspaceId: string): Promise<Trigger> {
    const trigger = await this.triggerRepository.findOne({
      where: { id, workspaceId },
      relations: ['workflow'],
    });
    if (!trigger) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Trigger not found',
      });
    }
    return trigger;
  }

  async findOneDetail(id: string, workspaceId: string): Promise<TriggerDetail> {
    const trigger = await this.findById(id, workspaceId);
    if (trigger.type !== 'schedule') return trigger;
    const schedule = await this.scheduleRepository.findOne({
      where: { triggerId: id, workspaceId },
    });
    if (!schedule) return trigger;
    return Object.assign(trigger, {
      cronExpression: schedule.cronExpression,
      timezone: schedule.timezone,
      nextRunAt: schedule.nextRunAt,
    });
  }

  async create(workspaceId: string, dto: CreateTriggerDto): Promise<Trigger> {
    const trigger = this.triggerRepository.create({
      ...dto,
      workspaceId,
    });
    return this.triggerRepository.save(trigger);
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateTriggerDto,
  ): Promise<Trigger> {
    const trigger = await this.findById(id, workspaceId);
    Object.assign(trigger, dto);
    return this.triggerRepository.save(trigger);
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const trigger = await this.findById(id, workspaceId);
    await this.triggerRepository.remove(trigger);
  }

  async getHistory(
    id: string,
    workspaceId: string,
  ): Promise<
    Array<{
      id: string;
      status: string;
      startedAt: Date;
      durationMs: number | null;
    }>
  > {
    await this.findById(id, workspaceId);
    const executions = await this.executionRepository
      .createQueryBuilder('e')
      .select(['e.id', 'e.status', 'e.started_at', 'e.duration_ms'])
      .where('e.trigger_id = :triggerId', { triggerId: id })
      .orderBy('e.started_at', 'DESC')
      .limit(10)
      .getMany();

    return executions.map((e) => ({
      id: e.id,
      status: e.status,
      startedAt: e.startedAt,
      durationMs: e.durationMs,
    }));
  }

  async findByEndpointPath(
    workspaceId: string,
    endpointPath: string,
  ): Promise<Trigger | null> {
    return this.triggerRepository.findOne({
      where: { workspaceId, endpointPath },
    });
  }
}
