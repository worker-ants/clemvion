import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trigger } from './entities/trigger.entity';
import { Execution } from '../executions/entities/execution.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { CreateTriggerDto } from './dto/create-trigger.dto';
import { UpdateTriggerDto } from './dto/update-trigger.dto';
import {
  NotificationConfigDto,
  validateNotificationUrl,
} from './dto/notification-config.dto';
import { InteractionConfigDto } from './dto/interaction-config.dto';
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
    // notification/interaction 은 Trigger entity 의 1급 컬럼이 아니라 `config` JSONB 안에 보관.
    // (영속 컬럼은 health/secret rotation 추적 용도의 4개만; spec EIA §7.1 / V059).
    const { notification, interaction, config, ...rest } = dto;
    this.assertNotificationUrlSafe(notification);
    const mergedConfig = this.mergeExternalConfig(
      config ?? {},
      notification,
      interaction,
    );
    const trigger = this.triggerRepository.create({
      ...rest,
      config: mergedConfig,
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
    const { notification, interaction, config, ...rest } = dto;
    this.assertNotificationUrlSafe(notification);
    // notification/interaction 이 명시된 경우만 config 안의 해당 키를 교체. 미명시면 기존 유지.
    const baseConfig = config ?? trigger.config ?? {};
    const mergedConfig = this.mergeExternalConfig(
      baseConfig,
      notification,
      interaction,
    );
    Object.assign(trigger, rest, { config: mergedConfig });
    return this.triggerRepository.save(trigger);
  }

  /**
   * notification.url 이 있으면 SSRF safety 를 register-time 에 검증한다. literal IP 사설 대역,
   * loopback, metadata IP 는 거부. 발송 시점의 post-resolve 검증은 NotificationDispatcher 가
   * 추가로 수행 (Spec EIA §8.1).
   */
  private assertNotificationUrlSafe(
    notification: NotificationConfigDto | undefined,
  ): void {
    if (!notification?.url) return;
    const check = validateNotificationUrl(notification.url);
    if (!check.ok) {
      throw new BadRequestException({
        code: 'INVALID_NOTIFICATION_URL',
        message: check.reason ?? 'Notification URL is not allowed',
      });
    }
  }

  private mergeExternalConfig(
    base: Record<string, unknown>,
    notification: NotificationConfigDto | undefined,
    interaction: InteractionConfigDto | undefined,
  ): Record<string, unknown> {
    const next: Record<string, unknown> = { ...base };
    if (notification !== undefined) next.notification = notification;
    if (interaction !== undefined) next.interaction = interaction;
    return next;
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
