import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from './entities/schedule.entity';
import { Trigger } from '../triggers/entities/trigger.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
  ) {}

  async findAll(
    workspaceId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<Schedule>> {
    const { page = 1, limit = 20, search } = query;

    const qb = this.scheduleRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.trigger', 't')
      .leftJoinAndSelect('t.workflow', 'w')
      .where('s.workspace_id = :workspaceId', { workspaceId });

    if (search) {
      qb.andWhere('t.name ILIKE :search', { search: `%${search}%` });
    }

    qb.orderBy('s.created_at', 'DESC');

    const totalItems = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return PaginatedResponseDto.create(data, totalItems, page, limit);
  }

  async findById(id: string, workspaceId: string): Promise<Schedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id, workspaceId },
      relations: ['trigger', 'trigger.workflow'],
    });
    if (!schedule) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Schedule not found',
      });
    }
    return schedule;
  }

  async create(workspaceId: string, dto: CreateScheduleDto): Promise<Schedule> {
    // Auto-create linked trigger (type=schedule)
    const trigger = this.triggerRepository.create({
      workspaceId,
      workflowId: dto.workflowId,
      type: 'schedule',
      name: dto.name,
      isActive: dto.isActive ?? true,
      config: {},
    });
    const savedTrigger = await this.triggerRepository.save(trigger);

    const schedule = this.scheduleRepository.create({
      workspaceId,
      triggerId: savedTrigger.id,
      cronExpression: dto.cronExpression,
      timezone: dto.timezone ?? 'Asia/Seoul',
      isActive: dto.isActive ?? true,
      // TODO: Calculate next_run_at from cron expression
    });
    return this.scheduleRepository.save(schedule);
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateScheduleDto,
  ): Promise<Schedule> {
    const schedule = await this.findById(id, workspaceId);
    const trigger = schedule.trigger;

    // Sync name
    if (dto.name && trigger) {
      trigger.name = dto.name;
    }
    // Sync is_active bidirectionally
    if (dto.isActive !== undefined && trigger) {
      trigger.isActive = dto.isActive;
    }
    if (trigger) {
      await this.triggerRepository.save(trigger);
    }

    if (dto.cronExpression) schedule.cronExpression = dto.cronExpression;
    if (dto.timezone) schedule.timezone = dto.timezone;
    if (dto.isActive !== undefined) schedule.isActive = dto.isActive;

    return this.scheduleRepository.save(schedule);
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const schedule = await this.findById(id, workspaceId);
    // Cascade delete trigger
    if (schedule.triggerId) {
      await this.triggerRepository.delete(schedule.triggerId);
    }
    await this.scheduleRepository.remove(schedule);
  }
}
