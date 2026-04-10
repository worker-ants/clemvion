import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from './entities/schedule.entity';
import { Trigger } from '../triggers/entities/trigger.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CronExpressionParser } from 'cron-parser';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { ScheduleRunnerService } from './schedule-runner.service';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
    private readonly executionEngineService: ExecutionEngineService,
    private readonly scheduleRunnerService: ScheduleRunnerService,
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
      .offset((page - 1) * limit)
      .limit(limit)
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

    const timezone = dto.timezone ?? 'Asia/Seoul';
    const isActive = dto.isActive ?? true;
    const [nextRun] = this.computeNextRuns(dto.cronExpression, timezone, 1);

    const schedule = this.scheduleRepository.create({
      workspaceId,
      triggerId: savedTrigger.id,
      cronExpression: dto.cronExpression,
      timezone,
      isActive,
      nextRunAt: nextRun ? new Date(nextRun) : undefined,
    });
    const saved = await this.scheduleRepository.save(schedule);

    // Register BullMQ repeatable job
    if (isActive) {
      saved.trigger = savedTrigger;
      await this.scheduleRunnerService.registerJob(saved);
    }

    return saved;
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

    // Recalculate nextRunAt if cron or timezone changed
    if (dto.cronExpression || dto.timezone) {
      const [nextRun] = this.computeNextRuns(
        schedule.cronExpression,
        schedule.timezone,
        1,
      );
      schedule.nextRunAt = nextRun ? new Date(nextRun) : (null as unknown as Date);
    }

    const saved = await this.scheduleRepository.save(schedule);

    // Update BullMQ job
    if (schedule.isActive) {
      saved.trigger = trigger ?? schedule.trigger;
      await this.scheduleRunnerService.registerJob(saved);
    } else {
      await this.scheduleRunnerService.removeJob(saved.id);
    }

    return saved;
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const schedule = await this.findById(id, workspaceId);
    // Remove BullMQ job
    await this.scheduleRunnerService.removeJob(schedule.id);
    // Cascade delete trigger
    if (schedule.triggerId) {
      await this.triggerRepository.delete(schedule.triggerId);
    }
    await this.scheduleRepository.remove(schedule);
  }

  async getPreview(
    id: string,
    workspaceId: string,
    count: number = 5,
  ): Promise<{ nextRuns: string[] }> {
    const schedule = await this.findById(id, workspaceId);
    const nextRuns = this.computeNextRuns(
      schedule.cronExpression,
      schedule.timezone,
      count,
    );
    return { nextRuns };
  }

  getPreviewFromExpression(
    cronExpression: string,
    timezone: string = 'Asia/Seoul',
    count: number = 5,
  ): { nextRuns: string[] } {
    const nextRuns = this.computeNextRuns(cronExpression, timezone, count);
    return { nextRuns };
  }

  async runNow(
    id: string,
    workspaceId: string,
    userId: string,
  ): Promise<{ executionId: string }> {
    const schedule = await this.findById(id, workspaceId);
    const workflowId = this.getWorkflowIdForSchedule(schedule);
    if (!workflowId) {
      throw new BadRequestException('Schedule has no associated workflow');
    }
    const executionId = await this.executionEngineService.execute(
      workflowId,
      undefined,
      userId,
    );
    return { executionId };
  }

  getWorkflowIdForSchedule(schedule: Schedule): string | null {
    return schedule.trigger?.workflowId ?? null;
  }

  private computeNextRuns(
    cronExpression: string,
    timezone: string,
    count: number,
  ): string[] {
    const safeCount = Math.min(Math.max(count, 1), 20);
    try {
      const interval = CronExpressionParser.parse(cronExpression, {
        tz: timezone,
        currentDate: new Date(),
      });
      const runs: string[] = [];
      for (let i = 0; i < safeCount; i++) {
        const next = interval.next();
        runs.push(next.toISOString() ?? new Date().toISOString());
      }
      return runs;
    } catch {
      throw new BadRequestException(
        `Invalid cron expression: "${cronExpression}"`,
      );
    }
  }
}
