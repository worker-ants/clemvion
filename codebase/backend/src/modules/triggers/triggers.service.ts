import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
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
import { ChatChannelConfigDto } from './dto/chat-channel-config.dto';
import { ChannelAdapterRegistry } from '../chat-channel/channel-adapter.registry';
import { ChatChannelConfig } from '../chat-channel/types';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export type TriggerDetail = Trigger & {
  cronExpression?: string;
  timezone?: string;
  nextRunAt?: Date | null;
};

@Injectable()
export class TriggersService {
  private readonly logger = new Logger(TriggersService.name);

  constructor(
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    private readonly channelAdapterRegistry: ChannelAdapterRegistry,
    private readonly configService: ConfigService,
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
    // notification/interaction/chatChannel 은 Trigger entity 의 1급 컬럼이 아니라 `config` JSONB.
    // (영속 컬럼은 health/secret rotation 추적용 9개만; spec EIA §7.1 + spec CCH §4.2).
    const { notification, interaction, chatChannel, config, ...rest } = dto;
    this.assertNotificationUrlSafe(notification);
    const mergedConfig = this.mergeExternalConfig(
      config ?? {},
      notification,
      interaction,
      chatChannel,
    );
    const trigger = this.triggerRepository.create({
      ...rest,
      config: mergedConfig,
      workspaceId,
    });
    const saved = await this.triggerRepository.save(trigger);
    // Chat Channel 어댑터 setup — CCH-AD-02.
    if (chatChannel) {
      await this.setupChatChannel(saved, chatChannel);
    }
    return saved;
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateTriggerDto,
  ): Promise<Trigger> {
    const trigger = await this.findById(id, workspaceId);
    const { notification, interaction, chatChannel, config, ...rest } = dto;
    this.assertNotificationUrlSafe(notification);
    // notification/interaction/chatChannel 이 명시된 경우만 config 안의 해당 키를 교체.
    const baseConfig = config ?? trigger.config ?? {};
    const mergedConfig = this.mergeExternalConfig(
      baseConfig,
      notification,
      interaction,
      chatChannel,
    );
    Object.assign(trigger, rest, { config: mergedConfig });
    const saved = await this.triggerRepository.save(trigger);
    if (chatChannel) {
      // chatChannel 갱신 — 새 webhook URL 등록 (idempotent).
      await this.setupChatChannel(saved, chatChannel);
    }
    return saved;
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
    chatChannel?: ChatChannelConfigDto | undefined,
  ): Record<string, unknown> {
    const next: Record<string, unknown> = { ...base };
    if (notification !== undefined) next.notification = notification;
    if (interaction !== undefined) next.interaction = interaction;
    if (chatChannel !== undefined) next.chatChannel = chatChannel;
    return next;
  }

  /**
   * Chat Channel adapter setupChannel 호출 + 결과를 trigger.config 와 health 컬럼에 반영.
   * Spec CCH-AD-02. best-effort — 실패 시 chat_channel_health=degraded, last_error 저장하되 trigger
   * 자체는 비활성화 X (CCH-SE-01 / WH-MG-04).
   */
  private async setupChatChannel(
    trigger: Trigger,
    chatChannelCfg: ChatChannelConfigDto,
  ): Promise<void> {
    if (!this.channelAdapterRegistry.has(chatChannelCfg.provider)) {
      this.logger.warn(
        `TriggersService: chatChannel.provider="${chatChannelCfg.provider}" 미등록 — setupChannel skip`,
      );
      return;
    }
    if (!trigger.endpointPath) {
      throw new BadRequestException({
        code: 'CHAT_CHANNEL_ENDPOINT_REQUIRED',
        message:
          'Chat channel trigger requires endpointPath (callback URL을 만들기 위해 필요).',
      });
    }
    const adapter = this.channelAdapterRegistry.get(chatChannelCfg.provider);
    const baseUrl =
      this.configService.get<string>('app.publicBaseUrl') ??
      this.configService.get<string>('publicBaseUrl') ??
      'http://localhost:3000';
    const callbackUrl = `${baseUrl.replace(/\/$/, '')}/api/hooks/${trigger.endpointPath.replace(/^\//, '')}`;
    try {
      const result = await adapter.setupChannel(
        chatChannelCfg as ChatChannelConfig,
        callbackUrl,
      );
      // setupChannel 결과 — secretToken / botIdentity 등을 config 에 머지.
      const mergedChannel: ChatChannelConfig = {
        ...(chatChannelCfg as ChatChannelConfig),
        ...(result.configUpdates ?? {}),
      };
      const newConfig = {
        ...(trigger.config ?? {}),
        chatChannel: mergedChannel,
      };
      await this.triggerRepository.update(
        { id: trigger.id },
        {
          config: newConfig,
          chatChannelSetupAt: new Date(),
          chatChannelHealth: 'healthy',
          chatChannelLastError: null,
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `TriggersService: setupChannel 실패 (trigger=${trigger.id}, provider=${chatChannelCfg.provider}): ${message}`,
      );
      await this.triggerRepository.update(
        { id: trigger.id },
        {
          chatChannelHealth: 'degraded',
          chatChannelLastError: message.slice(0, 1024),
        },
      );
    }
  }

  /**
   * Chat Channel adapter teardownChannel 호출 — trigger 삭제 / chatChannel 제거 시. best-effort.
   * Spec CCH-AD-03.
   */
  private async teardownChatChannel(trigger: Trigger): Promise<void> {
    const chatChannelCfg = (trigger.config as { chatChannel?: ChatChannelConfig })
      .chatChannel;
    if (!chatChannelCfg) return;
    if (!this.channelAdapterRegistry.has(chatChannelCfg.provider)) return;
    const adapter = this.channelAdapterRegistry.get(chatChannelCfg.provider);
    try {
      await adapter.teardownChannel(chatChannelCfg);
    } catch (err) {
      this.logger.warn(
        `TriggersService: teardownChannel 실패 (best-effort, trigger=${trigger.id}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const trigger = await this.findById(id, workspaceId);
    await this.teardownChatChannel(trigger);
    await this.triggerRepository.remove(trigger);
  }

  /**
   * [Spec EIA §3.1 EIA-NX-12 / plan/in-progress/eia-secret-rotation-revoke-api.md]
   * Outbound notification 의 HMAC secret 을 회전.
   *
   * 동작:
   * 1. 새 32-byte hex secret 생성 (`wsk_<hex>`).
   * 2. 기존 `config.notification.signing.secret` 은 그대로 두고, `trigger.notification_secret_v2`
   *    컬럼에 새 secret 저장 + `notification_rotated_at = NOW()`.
   * 3. 24h grace 동안 NotificationWebhookProcessor 가 두 secret 으로 모두 서명 (v1= 두 개 동봉).
   *    24h 경과 후 별도 cron 이 v2 → config.signing.secret 으로 승격 + v2/rotated_at 컬리어.
   * 4. 응답에 새 secret 평문 1회 반환 (이후 마스킹) — 호출자가 외부 검증자 측에 배포.
   *
   * 요구 권한: trigger 소유 workspace 의 Editor+.
   */
  async rotateNotificationSecret(
    id: string,
    workspaceId: string,
  ): Promise<{ secret: string; rotatedAt: string }> {
    const trigger = await this.findById(id, workspaceId);
    const notificationCfg = (trigger.config as { notification?: unknown })
      .notification;
    if (
      !notificationCfg ||
      typeof notificationCfg !== 'object' ||
      typeof (notificationCfg as { url?: unknown }).url !== 'string'
    ) {
      throw new BadRequestException({
        code: 'NOTIFICATION_NOT_CONFIGURED',
        message:
          'Trigger 에 notification 설정이 없어 secret rotation 을 수행할 수 없습니다.',
      });
    }
    const newSecret = `wsk_${randomBytes(32).toString('hex')}`;
    trigger.notificationSecretV2 = newSecret;
    trigger.notificationRotatedAt = new Date();
    await this.triggerRepository.save(trigger);
    return {
      secret: newSecret,
      rotatedAt: trigger.notificationRotatedAt.toISOString(),
    };
  }

  /**
   * [Spec EIA §3.3 EIA-AU-07 / plan]
   * per_trigger 토큰 (`itk_*`) 재발급. 이전 토큰은 즉시 무효화.
   *
   * 응답에 새 토큰 평문 1회 반환. 호출자가 외부 시스템에 배포.
   *
   * trigger 의 interaction.tokenStrategy 가 'per_trigger' 가 아니면 400.
   */
  async revokePerTriggerToken(
    id: string,
    workspaceId: string,
  ): Promise<{ token: string }> {
    const trigger = await this.findById(id, workspaceId);
    const interactionCfg = (trigger.config as { interaction?: unknown })
      .interaction;
    if (
      !interactionCfg ||
      typeof interactionCfg !== 'object' ||
      (interactionCfg as { tokenStrategy?: unknown }).tokenStrategy !==
        'per_trigger'
    ) {
      throw new BadRequestException({
        code: 'NOT_PER_TRIGGER_STRATEGY',
        message:
          'Trigger 의 interaction.tokenStrategy 가 "per_trigger" 가 아닙니다.',
      });
    }
    const newToken = `itk_${randomBytes(32).toString('hex')}`;
    const updated = {
      ...(interactionCfg as Record<string, unknown>),
      triggerToken: newToken,
    };
    trigger.config = { ...trigger.config, interaction: updated };
    await this.triggerRepository.save(trigger);
    return { token: newToken };
  }

  /**
   * 24h grace 가 경과한 trigger 의 notification_secret_v2 → config.notification.signing.secret
   * 승격. 별도 scheduled job 이 호출. ($ trigger 단위 idempotent — v2 가 null 이면 no-op)
   */
  async promoteRotatedNotificationSecrets(
    nowMs: number = Date.now(),
  ): Promise<{ promoted: number }> {
    const graceMs = 24 * 60 * 60 * 1000;
    const candidates = await this.triggerRepository
      .createQueryBuilder('t')
      .where('t.notification_secret_v2 IS NOT NULL')
      .andWhere('t.notification_rotated_at <= :cutoff', {
        cutoff: new Date(nowMs - graceMs),
      })
      .getMany();
    let promoted = 0;
    for (const trigger of candidates) {
      const secretV2 = trigger.notificationSecretV2;
      if (!secretV2) continue;
      const notificationCfg = (trigger.config as { notification?: unknown })
        .notification;
      if (!notificationCfg || typeof notificationCfg !== 'object') continue;
      const signing = (notificationCfg as { signing?: unknown }).signing;
      const updatedSigning = {
        ...(typeof signing === 'object' && signing !== null
          ? (signing as Record<string, unknown>)
          : {}),
        secret: secretV2,
      };
      const updatedNotification = {
        ...(notificationCfg as Record<string, unknown>),
        signing: updatedSigning,
      };
      trigger.config = {
        ...trigger.config,
        notification: updatedNotification,
      };
      trigger.notificationSecretV2 = null;
      trigger.notificationRotatedAt = null;
      await this.triggerRepository.save(trigger);
      promoted++;
    }
    return { promoted };
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
