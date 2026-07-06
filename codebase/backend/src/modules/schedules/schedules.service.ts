import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from './entities/schedule.entity';
import { Trigger } from '../triggers/entities/trigger.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { isValidIanaTimezone } from '../../common/utils/timezone';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { QueryScheduleDto } from './dto/query-schedule.dto';
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
    private readonly workspacesService: WorkspacesService,
    private readonly executionEngineService: ExecutionEngineService,
    private readonly scheduleRunnerService: ScheduleRunnerService,
  ) {}

  /**
   * §2.2 — 스케줄 타임존 결정: 명시값 > 워크스페이스 설정(`settings.timezone`) > `'Asia/Seoul'`.
   *
   * `'Asia/Seoul'` 은 Schedule 도메인 전용 제품 기본값이다 (서버 `process.env.TZ`/UTC 가 아니라 — 본
   * 제품의 1차 타겟 사용자 기준). 명시값과 워크스페이스 값 모두 IANA 유효성을 검증해 무효면 다음 단계로
   * 폴백한다 (DTO/저장 검증을 우회한 레거시·직접 호출 방어). 모듈 경계상 Workspace 엔티티를 직접
   * 읽지 않고 `WorkspacesService.getWorkspaceTimezone` 위임 호출을 쓴다.
   */
  private async resolveTimezone(
    workspaceId: string,
    requestedTimezone: string | undefined,
  ): Promise<string> {
    // 명시값이 있으면 IANA 검증 — 무효면 silent fallback 대신 즉시 거부(사용자 입력 오류 명확화).
    if (requestedTimezone) {
      if (!isValidIanaTimezone(requestedTimezone)) {
        throw new BadRequestException({
          code: 'INVALID_TIMEZONE',
          message: `유효하지 않은 타임존입니다: ${requestedTimezone}`,
        });
      }
      return requestedTimezone;
    }
    const wsTz = await this.workspacesService.getWorkspaceTimezone(workspaceId);
    return wsTz ?? 'Asia/Seoul';
  }

  async findAll(
    workspaceId: string,
    query: QueryScheduleDto,
  ): Promise<PaginatedResponseDto<Schedule>> {
    const {
      page = 1,
      limit = 20,
      search,
      triggerId,
      sort = 'created_at',
      order = 'desc',
    } = query;

    const qb = this.scheduleRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.trigger', 't')
      .leftJoinAndSelect('t.workflow', 'w')
      .where('s.workspace_id = :workspaceId', { workspaceId });

    if (search) {
      qb.andWhere('t.name ILIKE :search', { search: `%${search}%` });
    }

    // 트리거 단일 필터 (딥링크 cross-page 포커스). 연결 트리거가 없는 스케줄은
    // t.id 가 null 이라 자연히 제외된다.
    if (triggerId) {
      qb.andWhere('t.id = :triggerId', { triggerId });
    }

    qb.orderBy(
      this.resolveOrderBy(sort),
      order.toUpperCase() as 'ASC' | 'DESC',
    );

    const totalItems = await qb.getCount();
    const data = await qb
      .offset((page - 1) * limit)
      .limit(limit)
      .getMany();

    return PaginatedResponseDto.create(data, totalItems, page, limit);
  }

  /**
   * PaginationQueryDto.sort 를 화이트리스트 컬럼(alias 포함)으로 매핑한다.
   * `name` 은 schedule 자체 컬럼이 아니라 연결된 trigger 명(t.name)으로 정렬한다.
   * 미허용 값은 기본 정렬(s.created_at)로 폴백 — SQL injection 차단.
   */
  private resolveOrderBy(sort: string): string {
    const allowed: Record<string, string> = {
      created_at: 's.created_at',
      updated_at: 's.updated_at',
      next_run_at: 's.next_run_at',
      last_run_at: 's.last_run_at',
      name: 't.name',
    };
    return allowed[sort] || 's.created_at';
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

    const timezone = await this.resolveTimezone(workspaceId, dto.timezone);
    const isActive = dto.isActive ?? true;
    const [nextRun] = this.computeNextRuns(dto.cronExpression, timezone, 1);

    const schedule = this.scheduleRepository.create({
      workspaceId,
      triggerId: savedTrigger.id,
      cronExpression: dto.cronExpression,
      timezone,
      isActive,
      nextRunAt: nextRun ? new Date(nextRun) : undefined,
      parameterValues: dto.parameterValues ?? {},
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
    if (dto.parameterValues !== undefined)
      schedule.parameterValues = dto.parameterValues;

    // Recalculate nextRunAt if cron or timezone changed
    if (dto.cronExpression || dto.timezone) {
      const [nextRun] = this.computeNextRuns(
        schedule.cronExpression,
        schedule.timezone,
        1,
      );
      schedule.nextRunAt = nextRun
        ? new Date(nextRun)
        : (null as unknown as Date);
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
    const parameters =
      await this.scheduleRunnerService.resolveScheduleParameters(
        schedule,
        workflowId,
      );
    // `runNow` runs a Schedule definition on demand — the input still carries
    // schedule-resolved parameters (`$schedule`/`$now` evaluated), so the
    // trigger source is `'schedule'` even though the executor is a user.
    const executionId = await this.executionEngineService.execute(
      workflowId,
      { __triggerSource: 'schedule', parameters },
      { executedBy: userId },
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
