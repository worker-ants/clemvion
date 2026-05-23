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
import { SecretResolverService } from '../secret-store/secret-resolver.service';
import { buildSecretRef } from '../secret-store/secret-ref';
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
    private readonly secrets: SecretResolverService,
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

    return PaginatedResponseDto.create(
      data.map((t) => this.sanitizeChatChannelForResponse(t)),
      totalItems,
      page,
      limit,
    );
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
    if (trigger.type !== 'schedule') {
      return this.sanitizeChatChannelForResponse(trigger);
    }
    const schedule = await this.scheduleRepository.findOne({
      where: { triggerId: id, workspaceId },
    });
    if (!schedule) return this.sanitizeChatChannelForResponse(trigger);
    return this.sanitizeChatChannelForResponse(
      Object.assign(trigger, {
        cronExpression: schedule.cronExpression,
        timezone: schedule.timezone,
        nextRunAt: schedule.nextRunAt,
      }),
    );
  }

  async create(workspaceId: string, dto: CreateTriggerDto): Promise<Trigger> {
    // notification/interaction/chatChannel 은 Trigger entity 의 1급 컬럼이 아니라 `config` JSONB.
    // (영속 컬럼은 health/secret rotation 추적용 9개만; spec EIA §7.1 + spec CCH §4.2).
    const { notification, interaction, chatChannel, config, ...rest } = dto;
    this.assertNotificationUrlSafe(notification);
    this.assertChatChannelInputSafe(chatChannel);
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
    // notification.signing.secret plaintext 가 config 에 들어왔으면 secret store 로 마이그레이션.
    await this.normalizeNotificationSecretRef(saved);
    // Chat Channel 어댑터 setup — CCH-AD-02.
    if (chatChannel) {
      await this.setupChatChannel(saved, chatChannel);
    }
    return this.sanitizeChatChannelForResponse(saved);
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateTriggerDto,
  ): Promise<Trigger> {
    const trigger = await this.findById(id, workspaceId);
    const { notification, interaction, chatChannel, config, ...rest } = dto;
    // [Spec 2-trigger-list §3] Schedule 타입 트리거는 name·isActive 만 PATCH 허용.
    // endpointPath / config / authConfigId / notification / interaction / chatChannel 변경은
    // 데이터 모델 §2.9.1 (Trigger ↔ Schedule 동기화 규칙) 보호를 위해 거부.
    if (trigger.type === 'schedule') {
      const disallowed: string[] = [];
      if (rest.endpointPath !== undefined) disallowed.push('endpointPath');
      if (rest.authConfigId !== undefined) disallowed.push('authConfigId');
      if (config !== undefined) disallowed.push('config');
      if (notification !== undefined) disallowed.push('notification');
      if (interaction !== undefined) disallowed.push('interaction');
      if (chatChannel !== undefined) disallowed.push('chatChannel');
      if (disallowed.length > 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `Schedule 타입 트리거는 name·isActive 만 수정할 수 있어요 (거부 필드: ${disallowed.join(', ')}). cron·timezone 등 스케줄 메타는 Schedule 화면에서 편집하세요.`,
          details: { field: 'type', disallowed },
        });
      }
    }
    this.assertNotificationUrlSafe(notification);
    this.assertChatChannelInputSafe(chatChannel);
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
    await this.normalizeNotificationSecretRef(saved);
    if (chatChannel) {
      // chatChannel 갱신 — 새 webhook URL 등록 (idempotent).
      await this.setupChatChannel(saved, chatChannel);
    }
    return this.sanitizeChatChannelForResponse(saved);
  }

  /**
   * [Spec Chat Channel §5.4.1 single-path] — 외부 입력으로 들어올 수 없는 내부 필드를 차단.
   *
   * - `botTokenRef` — 토큰 변경은 항상 `POST /api/triggers/:id/chat-channel/rotate-bot-token`
   *   (24h grace 적용). PATCH/POST body 직접 변경 시 grace 없는 즉시 교체가 되어 정책 일관성 깨짐.
   * - `secretTokenRef` / `secretToken` — setupChannel 시 어댑터가 자동 발급. 외부 입력 무시.
   *
   * DTO 단에서도 @IsEmpty() 로 차단되지만, error envelope 형식을 spec 의 VALIDATION_ERROR 와
   * 정합시키기 위해 service 단 추가 검증.
   */
  private assertChatChannelInputSafe(
    chatChannel: ChatChannelConfigDto | undefined,
  ): void {
    if (!chatChannel) return;
    const blocked = chatChannel as unknown as Record<string, unknown>;
    if (typeof blocked.botTokenRef !== 'undefined') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'botTokenRef 는 외부 입력이 금지된 내부 필드입니다. 토큰 변경은 POST /api/triggers/:id/chat-channel/rotate-bot-token 을 사용하세요.',
        details: { field: 'botTokenRef' },
      });
    }
    if (typeof blocked.secretTokenRef !== 'undefined') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'secretTokenRef 는 외부 입력이 금지된 내부 필드입니다.',
        details: { field: 'secretTokenRef' },
      });
    }
    if (typeof blocked.secretToken !== 'undefined') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'secretToken 은 setupChannel 시 자동 발급되는 내부 필드입니다. 외부 입력은 허용되지 않습니다.',
        details: { field: 'secretToken' },
      });
    }
  }

  /**
   * [Spec Chat Channel §5.4.2] — 응답 DTO 전용 derived 필드 + 내부 ref strip.
   *
   * - `botTokenRef` / `secretTokenRef` / `secretToken` 응답에서 제거 (UI 에 노출 X).
   * - `hasBotToken: boolean` derived 필드 주입 (`botTokenRef IS NOT NULL → true`).
   *
   * Trigger entity 는 변경하지 않음 — 새 객체로 반환 (DB 저장에 영향 없도록).
   */
  private sanitizeChatChannelForResponse<T extends Trigger>(trigger: T): T {
    const cfg = trigger.config as
      | {
          chatChannel?: Record<string, unknown>;
          [k: string]: unknown;
        }
      | null
      | undefined;
    if (!cfg?.chatChannel) return trigger;
    const {
      botTokenRef,
      secretTokenRef: _secretTokenRef,
      secretToken: _secretToken,
      ...rest
    } = cfg.chatChannel;
    const sanitizedChatChannel = {
      ...rest,
      hasBotToken: typeof botTokenRef === 'string' && botTokenRef.length > 0,
    };
    const sanitizedConfig = {
      ...cfg,
      chatChannel: sanitizedChatChannel,
    };
    // entity 의 메서드/getter 를 보존하기 위해 prototype 유지하면서 config 만 교체.
    return Object.assign(
      Object.create(Object.getPrototypeOf(trigger)),
      trigger,
      {
        config: sanitizedConfig,
      },
    ) as T;
  }

  /**
   * [Spec EIA §7.1] — notification.signing.secret plaintext 정규화.
   *
   * config 에 `signing.secret` plaintext 가 포함됐을 때 secret store 로 마이그레이션하고
   * config 에는 `signing.secretRef` 만 남긴다. plaintext 가 DB JSONB / 로그에 영구 노출되지
   * 않도록 보장 (SS-SE-01).
   *
   * 이미 `secretRef` 만 있는 경우 noop. signing 자체가 없는 경우도 noop.
   */
  private async normalizeNotificationSecretRef(
    trigger: Trigger,
  ): Promise<void> {
    const notificationCfg = (trigger.config as { notification?: unknown })
      ?.notification;
    if (!notificationCfg || typeof notificationCfg !== 'object') return;
    const signing = (notificationCfg as { signing?: unknown }).signing;
    if (!signing || typeof signing !== 'object') return;
    const plaintext = (signing as { secret?: unknown }).secret;
    if (typeof plaintext !== 'string' || plaintext.length === 0) return;

    const ref = buildSecretRef({
      scope: 'triggers',
      resourceId: trigger.id,
      name: 'notification-signing',
    });
    await this.secrets.rotate(ref, trigger.workspaceId, plaintext);

    const updatedSigning: Record<string, unknown> = {
      ...(signing as Record<string, unknown>),
      secretRef: ref,
    };
    delete updatedSigning.secret;
    trigger.config = {
      ...trigger.config,
      notification: {
        ...(notificationCfg as Record<string, unknown>),
        signing: updatedSigning,
      },
    };
    await this.triggerRepository.save(trigger);
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
    chatChannel?: ChatChannelConfigDto,
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

    // secret store 에 botToken 저장 (UPSERT — 재시도 안전).
    const botTokenRef = `secret://triggers/${trigger.id}/bot-token`;
    await this.secrets.rotate(
      botTokenRef,
      trigger.workspaceId,
      (chatChannelCfg as ChatChannelConfig & { botToken?: string }).botToken ??
        '',
    );

    const internalCfg: ChatChannelConfig = {
      ...(chatChannelCfg as ChatChannelConfig),
      botTokenRef,
    };

    try {
      const result = await adapter.setupChannel(internalCfg, callbackUrl);

      // issuedSecretToken → secret store 저장.
      const secretTokenRef = `secret://triggers/${trigger.id}/webhook-secret`;
      if (result.issuedSecretToken) {
        await this.secrets.rotate(
          secretTokenRef,
          trigger.workspaceId,
          result.issuedSecretToken,
        );
      }

      // setupChannel 결과 — botIdentity 등을 config 에 머지.
      const mergedChannel: ChatChannelConfig = {
        ...internalCfg,
        ...(result.configUpdates ?? {}),
        botTokenRef,
        ...(result.issuedSecretToken ? { secretTokenRef } : {}),
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
      // SUMMARY#24: secret_store 에 botToken 저장 완료 후 setupChannel 실패 — trigger 는
      // degraded 로 저장되지만 secret_store row 는 남아 있음. remove() 시 deleteByPrefix 로 정리.
      this.logger.warn(
        `TriggersService: secret_store 에 botToken 저장 완료 후 setupChannel 실패 — trigger=${trigger.id} 는 degraded 상태로 저장됨.`,
      );
      this.logger.warn(
        `TriggersService: setupChannel 실패 (trigger=${trigger.id}, provider=${chatChannelCfg.provider}): ${message}`,
      );
      // fallbackConfig: botTokenRef 만 config 에 반영 (secretTokenRef 없음).
      const fallbackConfig = {
        ...(trigger.config ?? {}),
        chatChannel: internalCfg,
      };
      await this.triggerRepository.update(
        { id: trigger.id },
        {
          config: fallbackConfig,
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
    const chatChannelCfg = (
      trigger.config as { chatChannel?: ChatChannelConfig }
    ).chatChannel;
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
    // SUMMARY#13: trigger 삭제 시 secret_store 의 모든 관련 row 삭제 (application-level cascade).
    await this.secrets.deleteByPrefix(`secret://triggers/${trigger.id}/`);
    await this.triggerRepository.remove(trigger);
  }

  /**
   * [Spec EIA §3.1 EIA-NX-12 / plan/in-progress/eia-secret-rotation-revoke-api.md]
   * Outbound notification 의 HMAC secret 을 회전.
   *
   * 동작:
   * 1. 새 32-byte hex secret 생성 (`wsk_<hex>`).
   * 2. 기존 `config.notification.signing.secretRef` 는 그대로 두고, `trigger.notification_secret_v2`
   *    컬럼에 새 secret 평문 저장 + `notification_rotated_at = NOW()`.
   * 3. 24h grace 동안 NotificationWebhookProcessor 가 두 secret 으로 모두 서명 (v1= 두 개 동봉).
   *    24h 경과 후 별도 cron 이 v2 → config.signing.secretRef 로 승격 + v2/rotated_at 클리어.
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
   * [Spec CCH-SE-04] — Chat Channel bot token rotation 의 6단계 오케스트레이션.
   *
   * 1. 기존 botToken resolve (실패 시 skip — 최초 rotation 케이스)
   * 2. 기존 token 이 있으면 v2 ref 에 백업 (24h grace)
   * 3. primary botTokenRef 의 plaintext 를 새 token 으로 교체 (UPSERT)
   * 4. 새 token 으로 adapter.setupChannel 재호출 — webhook secret_token 새로 발급
   * 5. issuedSecretToken plaintext → secretTokenRef 에 저장
   * 6. trigger 컬럼 갱신 (chat_channel_token_v2, chat_channel_rotated_at, health)
   *
   * Controller 는 input validation + workspaceId 검증 + 본 메서드 호출만 담당.
   *
   * @throws BadRequestException `CHAT_CHANNEL_NOT_CONFIGURED` / `CHAT_CHANNEL_PROVIDER_UNKNOWN` / `CHAT_CHANNEL_ENDPOINT_REQUIRED`
   */
  async rotateBotToken(
    id: string,
    workspaceId: string,
    newBotToken: string,
  ): Promise<{ rotatedAt: string }> {
    const trigger = await this.findById(id, workspaceId);
    const chatChannelCfg = (
      trigger.config as { chatChannel?: ChatChannelConfig }
    ).chatChannel;
    if (!chatChannelCfg) {
      throw new BadRequestException({
        code: 'CHAT_CHANNEL_NOT_CONFIGURED',
        message: 'Trigger has no chat channel configuration',
      });
    }
    if (!this.channelAdapterRegistry.has(chatChannelCfg.provider)) {
      throw new BadRequestException({
        code: 'CHAT_CHANNEL_PROVIDER_UNKNOWN',
        message: `Unknown provider: ${chatChannelCfg.provider}`,
      });
    }
    if (!trigger.endpointPath) {
      throw new BadRequestException({
        code: 'CHAT_CHANNEL_ENDPOINT_REQUIRED',
        message: 'Trigger endpointPath is required for rotation',
      });
    }
    const adapter = this.channelAdapterRegistry.get(chatChannelCfg.provider);

    const botTokenRef =
      chatChannelCfg.botTokenRef ??
      buildSecretRef({
        scope: 'triggers',
        resourceId: trigger.id,
        name: 'bot-token',
      });
    const v2Ref = buildSecretRef({
      scope: 'triggers',
      resourceId: trigger.id,
      name: 'bot-token.v2',
    });
    const secretTokenRef =
      chatChannelCfg.secretTokenRef ??
      buildSecretRef({
        scope: 'triggers',
        resourceId: trigger.id,
        name: 'webhook-secret',
      });

    // 1. 기존 botToken resolve (실패 시 skip — 최초 rotation).
    let oldPlaintext: string | null = null;
    try {
      oldPlaintext = await this.secrets.resolve(botTokenRef);
    } catch {
      // 최초 rotation: secret store 에 아직 row 없음. v2 백업 skip.
    }

    // 2. 기존 token 이 있으면 v2Ref 에 백업.
    let v2RefUsed: string | null = null;
    if (oldPlaintext !== null) {
      await this.secrets.rotate(v2Ref, trigger.workspaceId, oldPlaintext);
      v2RefUsed = v2Ref;
    }

    // 3. primary botTokenRef 에 새 token 저장 (UPSERT).
    await this.secrets.rotate(botTokenRef, trigger.workspaceId, newBotToken);

    // 4. 새 token 으로 setupChannel 재호출 — adapter 가 resolveBotToken 으로 신 token 자동 사용.
    const mergedConfig: ChatChannelConfig = { ...chatChannelCfg, botTokenRef };
    const callbackUrl = this.buildCallbackUrl(trigger.endpointPath);
    const result = await adapter.setupChannel(mergedConfig, callbackUrl);
    const mergedChannel: ChatChannelConfig = {
      ...mergedConfig,
      ...(result.configUpdates ?? {}),
      botTokenRef,
      secretTokenRef,
    };

    // 5. issuedSecretToken plaintext → secret store.
    if (result.issuedSecretToken) {
      await this.secrets.rotate(
        secretTokenRef,
        trigger.workspaceId,
        result.issuedSecretToken,
      );
    }

    // 6. trigger 컬럼 갱신.
    const rotatedAt = new Date();
    await this.triggerRepository.update(
      { id: trigger.id },
      {
        config: { ...(trigger.config ?? {}), chatChannel: mergedChannel },
        chatChannelTokenV2: v2RefUsed,
        chatChannelRotatedAt: rotatedAt,
        chatChannelHealth: 'healthy',
        chatChannelLastError: null,
      },
    );
    return { rotatedAt: rotatedAt.toISOString() };
  }

  /** publicBaseUrl 결합 — setupChatChannel 과 공용 헬퍼. */
  private buildCallbackUrl(endpointPath: string): string {
    const baseUrl =
      this.configService.get<string>('app.publicBaseUrl') ??
      this.configService.get<string>('publicBaseUrl') ??
      'http://localhost:3000';
    return `${baseUrl.replace(/\/$/, '')}/api/hooks/${endpointPath.replace(/^\//, '')}`;
  }

  /**
   * 24h grace 가 경과한 trigger 의 notification_secret_v2 → config.notification.signing.secretRef
   * 승격. 별도 scheduled job (NotificationSecretRotatorService) 이 매시간 호출.
   * trigger 단위 idempotent — v2 가 null 이면 no-op.
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
