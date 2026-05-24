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
import {
  SLACK_SIGNING_SECRET_REGEX,
  DISCORD_PUBLIC_KEY_REGEX,
} from '@workflow/chat-channel-validation';

export type TriggerDetail = Trigger & {
  cronExpression?: string;
  timezone?: string;
  nextRunAt?: Date | null;
};

/**
 * [Spec Chat Channel §5.4.2 + secret-store.md §5.5 SS-SE-01] 응답에서 strip 해야 하는
 * chat-channel 필드 allow-list. 신규 plaintext / 내부 ref 필드 추가 시 본 상수에
 * 반드시 키 추가 — destructure 누락 위험 회피. `sanitizeChatChannelForResponse` 가
 * 단일 진실로 참조한다.
 */
const CHAT_CHANNEL_RESPONSE_STRIP_KEYS = new Set<string>([
  // 내부 secret store ref — UI 에 노출 X. derived `hasBotToken` 만 제공.
  'botTokenRef',
  'inboundSigningRef',
  // 입력 전용 plaintext — 응답에 절대 노출 X (SS-SE-01).
  'botToken',
  'inboundSigning',
  'inboundSigningPlaintext',
]);

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
    // [SS-SE-01] mergeExternalConfig 호출 전 plaintext (botToken / inboundSigningPlaintext)
    // 를 strip — 첫 triggerRepository.save 시 plaintext 가 DB JSONB 에 일시 기록되지 않도록.
    // setupChatChannel 은 원본 dto.chatChannel (plaintext 포함) 을 별도 전달 받아 secret store
    // 로 옮긴 뒤 ref 만 config 에 반영.
    const safeChatChannel = chatChannel
      ? this.stripChatChannelPlaintext(chatChannel)
      : undefined;
    const mergedConfig = this.mergeExternalConfig(
      config ?? {},
      notification,
      interaction,
      safeChatChannel,
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
      // setupChatChannel 은 별도 triggerRepository.update 로 botTokenRef / inboundSigningRef /
      // chatChannelHealth 등을 갱신. in-memory `saved` 는 그 update 를 모르므로 응답 stale
      // 회귀 (hasBotToken=false). 재조회로 최신 상태 반영.
      const refreshed = await this.triggerRepository.findOne({
        where: { id: saved.id, workspaceId },
      });
      if (refreshed) return this.sanitizeChatChannelForResponse(refreshed);
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
    // [SS-SE-01] mergeExternalConfig 호출 전 plaintext strip (create() 와 동일 정책).
    const safeChatChannel = chatChannel
      ? this.stripChatChannelPlaintext(chatChannel)
      : undefined;
    // notification/interaction/chatChannel 이 명시된 경우만 config 안의 해당 키를 교체.
    const baseConfig = config ?? trigger.config ?? {};
    const mergedConfig = this.mergeExternalConfig(
      baseConfig,
      notification,
      interaction,
      safeChatChannel,
    );
    Object.assign(trigger, rest, { config: mergedConfig });
    const saved = await this.triggerRepository.save(trigger);
    await this.normalizeNotificationSecretRef(saved);
    if (chatChannel) {
      // chatChannel 갱신 — 새 webhook URL 등록 (idempotent).
      await this.setupChatChannel(saved, chatChannel);
      // setupChatChannel 은 별도 triggerRepository.update — in-memory `saved` 는 stale.
      // 응답 hasBotToken / inboundSigningRef 가 최신 반영되도록 재조회.
      const refreshed = await this.triggerRepository.findOne({
        where: { id: saved.id, workspaceId },
      });
      if (refreshed) return this.sanitizeChatChannelForResponse(refreshed);
    }
    return this.sanitizeChatChannelForResponse(saved);
  }

  /**
   * [Spec Chat Channel §5.4.1 single-path + 2-trigger-list §3] — 외부 입력 가드 + provider 분기.
   *
   * 내부 필드 (외부 입력 금지):
   * - `botTokenRef` — 토큰 변경은 항상 `POST /api/triggers/:id/chat-channel/rotate-bot-token`
   *   (24h grace 적용).
   * - `inboundSigningRef` — service 가 secret store ref 를 set. 외부 입력 무시.
   * - `inboundSigning` — server-issued 자료 (Telegram). provider-issued 입력은 신규
   *   `inboundSigningPlaintext` 필드 사용.
   *
   * Provider-issued plaintext 분기 (`inboundSigningPlaintext`):
   * - telegram: 본 필드 입력 시 400 (server-issued randomBytes 만, 사용자 secret 보호).
   * - slack: 필수. hex 32 chars.
   * - discord: 필수. hex 64 chars (ed25519 public key 32 bytes).
   *
   * DTO 단에서도 @IsEmpty / @IsString / @MaxLength 로 1차 검증되지만, error envelope 형식을
   * spec 의 VALIDATION_ERROR 와 정합시키기 위해 service 단 추가 검증 + provider 분기.
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
    if (typeof blocked.inboundSigningRef !== 'undefined') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'inboundSigningRef 는 외부 입력이 금지된 내부 필드입니다.',
        details: { field: 'inboundSigningRef' },
      });
    }
    if (typeof blocked.inboundSigning !== 'undefined') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'inboundSigning 은 setupChannel 시 자동 발급되는 내부 필드입니다. provider-issued (Slack signing secret / Discord public key) 입력은 inboundSigningPlaintext 를 사용하세요.',
        details: { field: 'inboundSigning' },
      });
    }
    this.assertInboundSigningPlaintextByProvider(chatChannel);
  }

  /**
   * [SS-SE-01 — spec/conventions/secret-store.md §5.5] plaintext (botToken /
   * inboundSigningPlaintext) 를 chatChannel 객체에서 제거. setupChatChannel 호출 전 config 에
   * 흘러가는 것을 차단해 첫 triggerRepository.save 시 DB JSONB 에 일시 기록되는 시간 창을
   * 제거한다. adapter 미등록 early-return 경로에서도 plaintext 가 영구 잔류하지 않음을 보장.
   *
   * 원본 plaintext 는 호출자가 별도 변수로 보관해 setupChatChannel 에 전달 — SecretResolver.store
   * 로 옮긴 뒤 ref 만 config 에 반영.
   */
  private stripChatChannelPlaintext(
    chatChannel: ChatChannelConfigDto,
  ): ChatChannelConfigDto {
    const {
      botToken: _bt,
      inboundSigningPlaintext: _isp,
      ...rest
    } = chatChannel as ChatChannelConfigDto & {
      botToken?: string;
      inboundSigningPlaintext?: string;
    };
    return rest as ChatChannelConfigDto;
  }

  /**
   * Provider 별 `inboundSigningPlaintext` 요구/금지 + 형식 분기.
   * SoT: spec/4-nodes/7-trigger/providers/{slack,discord}.md §6 + spec/conventions/secret-store.md §5.5.
   *
   * 분기:
   *   - telegram → server-issued (randomBytes 자동 발급). 외부 입력 시 400.
   *   - slack / discord → provider-issued (사용자 manual 입력). 필수 + hex 형식 검증.
   *
   * **신규 provider 추가 시**: 본 함수에 명시적 분기 추가 의무. CHAT_CHANNEL_PROVIDERS 가
   * 4번째 값을 가지면 아래 "provider-issued 필수" 가정이 무음 적용되어 잘못된 검증을 통과시킬
   * 위험. 신규 provider 의 inbound-signing 발급 모델 (server-issued vs provider-issued) 을
   * 결정 후 본 함수에 case 추가 필요.
   */
  private assertInboundSigningPlaintextByProvider(
    chatChannel: ChatChannelConfigDto,
  ): void {
    const plaintext = chatChannel.inboundSigningPlaintext;
    const provider = chatChannel.provider;

    if (provider === 'telegram') {
      if (typeof plaintext === 'string' && plaintext.length > 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message:
            'Telegram inboundSigning 은 server-issued 입니다. inboundSigningPlaintext 를 입력하지 마세요 (setupChannel 의 randomBytes 가 자동 발급).',
          details: { field: 'inboundSigningPlaintext' },
        });
      }
      return;
    }

    // slack / discord — provider-issued, 사용자 입력 필수 (위 doc 의 신규 provider 의무 참조).
    if (typeof plaintext !== 'string' || plaintext.length === 0) {
      const label =
        provider === 'slack'
          ? 'Slack signing secret'
          : 'Discord application public key';
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `${label} 가 필요합니다. inboundSigningPlaintext 를 입력하세요.`,
        details: { field: 'inboundSigningPlaintext' },
      });
    }

    // [provider 발급 표준] Slack signing secret / Discord public key 는 모두 lowercase hex 로
    // 발급된다. uppercase 입력은 외부 provider HMAC / ed25519 검증 실패를 유발하므로 사전 차단.
    // SoT: `@workflow/chat-channel-validation` 패키지 — backend / frontend 가 동일 정규식 사용.
    if (provider === 'slack' && !SLACK_SIGNING_SECRET_REGEX.test(plaintext)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'Slack signing secret 형식이 올바르지 않습니다 (lowercase hex 32 chars 필요).',
        details: { field: 'inboundSigningPlaintext' },
      });
    }

    if (provider === 'discord' && !DISCORD_PUBLIC_KEY_REGEX.test(plaintext)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'Discord application public key 형식이 올바르지 않습니다 (ed25519 public key lowercase hex 64 chars 필요).',
        details: { field: 'inboundSigningPlaintext' },
      });
    }
  }

  /**
   * [Spec Chat Channel §5.4.2 + secret-store.md §5.5 SS-SE-01] — 응답 DTO 전용 derived 필드
   * + 내부 ref + plaintext strip.
   *
   * Strip 키 집합 (`CHAT_CHANNEL_RESPONSE_STRIP_KEYS`) 은 module-level 상수로 단일 진실.
   * 신규 plaintext / 내부 ref 필드 추가 시 본 상수에 키를 추가해야 응답 sanitize 가 적용됨
   * (allow-list 패턴 — destructure 시 누락 위험 회피).
   *
   * - `hasBotToken: boolean` derived 필드 주입 (`botTokenRef IS NOT NULL → true`).
   * - Trigger entity 는 변경하지 않음 — 새 객체로 반환 (DB 저장에 영향 없도록).
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
    const botTokenRef = cfg.chatChannel.botTokenRef;
    const sanitizedChatChannel: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(cfg.chatChannel)) {
      if (CHAT_CHANNEL_RESPONSE_STRIP_KEYS.has(key)) continue;
      sanitizedChatChannel[key] = value;
    }
    sanitizedChatChannel.hasBotToken =
      typeof botTokenRef === 'string' && botTokenRef.length > 0;
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

    // secret store ref 생성 — spec/conventions/secret-store.md §1 URI scheme 단일 진입점.
    const botTokenRef = buildSecretRef({
      scope: 'triggers',
      resourceId: trigger.id,
      name: 'bot-token',
    });
    const inboundSigningRef = buildSecretRef({
      scope: 'triggers',
      resourceId: trigger.id,
      name: 'inbound-signing',
    });

    // secret store 에 botToken 저장 (UPSERT — 재시도 안전).
    await this.secrets.rotate(
      botTokenRef,
      trigger.workspaceId,
      chatChannelCfg.botToken ?? '',
    );

    // [secret-store.md §5.5 (b)] provider-issued inbound-signing plaintext 처리.
    // Slack signing secret / Discord public key — 사용자가 외부 portal 에서 입력한 값을
    // secret store 로 옮기고 plaintext 는 config 에 절대 흘리지 않음 (SS-SE-01).
    const providerIssuedPlaintext = chatChannelCfg.inboundSigningPlaintext;
    let providerIssuedStored = false;
    if (
      typeof providerIssuedPlaintext === 'string' &&
      providerIssuedPlaintext.length > 0
    ) {
      await this.secrets.rotate(
        inboundSigningRef,
        trigger.workspaceId,
        providerIssuedPlaintext,
      );
      providerIssuedStored = true;
    }

    // chatChannelCfg 에서 plaintext 필드들을 제거 — config 에 흘러가지 않음 (SS-SE-01).
    // create()/update() 의 stripChatChannelPlaintext 와 의도적으로 이중 방어 — adapter
    // 코드가 dto.botToken 을 직접 mutate 하는 회귀에 대비.
    const sanitizedCfg = this.stripChatChannelPlaintext(chatChannelCfg);
    const internalCfg: ChatChannelConfig = {
      ...(sanitizedCfg as ChatChannelConfig),
      botTokenRef,
      ...(providerIssuedStored ? { inboundSigningRef } : {}),
    };

    try {
      const result = await adapter.setupChannel(internalCfg, callbackUrl);

      // issuedInboundSigning (server-issued, Telegram) → secret store 저장.
      // provider-issued (slack/discord) 인 경우 setupChannel 의 issuedInboundSigning 은 비어 있음
      // — 이미 위에서 사용자 입력 plaintext 를 저장했으므로 noop.
      if (result.issuedInboundSigning) {
        await this.secrets.rotate(
          inboundSigningRef,
          trigger.workspaceId,
          result.issuedInboundSigning,
        );
      }

      // setupChannel 결과 — botIdentity 등을 config 에 머지.
      const mergedChannel: ChatChannelConfig = {
        ...internalCfg,
        ...(result.configUpdates ?? {}),
        botTokenRef,
        ...(result.issuedInboundSigning || providerIssuedStored
          ? { inboundSigningRef }
          : {}),
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
      // fallbackConfig: botTokenRef + (provider-issued 라면 inboundSigningRef 도) config 에 반영.
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
   * 4. 새 token 으로 adapter.setupChannel 재호출 — inbound-signing 자료 새로 발급 (Telegram: secret_token)
   * 5. issuedInboundSigning plaintext → inboundSigningRef 에 저장
   * 6. trigger 컬럼 갱신 (chat_channel_token_v2, chat_channel_rotated_at, health)
   *
   * Controller 는 input validation + workspaceId 검증 + 본 메서드 호출만 담당.
   *
   * @throws BadRequestException `CHAT_CHANNEL_NOT_CONFIGURED` / `CHAT_CHANNEL_PROVIDER_UNKNOWN` /
   *   `CHAT_CHANNEL_ENDPOINT_REQUIRED` / `BOT_TOKEN_INVALID` (setupChannel 401/403) /
   *   `CHAT_CHANNEL_SETUP_FAILED` (기타 setupChannel 실패)
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
    const inboundSigningRef =
      chatChannelCfg.inboundSigningRef ??
      buildSecretRef({
        scope: 'triggers',
        resourceId: trigger.id,
        name: 'inbound-signing',
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
    // [Spec Chat Channel §5.4] 외부 API 401/403 (인증 실패) 은 BOT_TOKEN_INVALID 400 으로,
    // 그 외 setupChannel 실패는 CHAT_CHANNEL_SETUP_FAILED 502 로 변환.
    const mergedConfig: ChatChannelConfig = { ...chatChannelCfg, botTokenRef };
    const callbackUrl = this.buildCallbackUrl(trigger.endpointPath);
    let result;
    try {
      result = await adapter.setupChannel(mergedConfig, callbackUrl);
    } catch (err) {
      throw this.translateSetupChannelError(err);
    }
    const mergedChannel: ChatChannelConfig = {
      ...mergedConfig,
      ...(result.configUpdates ?? {}),
      botTokenRef,
      inboundSigningRef,
    };

    // 5. issuedInboundSigning plaintext → secret store.
    if (result.issuedInboundSigning) {
      await this.secrets.rotate(
        inboundSigningRef,
        trigger.workspaceId,
        result.issuedInboundSigning,
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

  /**
   * [Spec Chat Channel §5.4 에러 표] adapter.setupChannel 의 외부 API 에러를 spec 에 정의된
   * BadRequestException 으로 변환.
   *
   * - 401 / 403 (외부 provider 인증 실패) → `BOT_TOKEN_INVALID` 400
   * - 기타 (5xx / 네트워크 등) → `CHAT_CHANNEL_SETUP_FAILED` 502
   *
   * adapter 가 throw 하는 Error 의 message 에 status code 가 포함됨을 가정 (provider client 들의
   * 표준 error message 패턴: "Slack auth.test failed: 401", "Discord getApplicationMe failed:
   * 403", "Telegram setWebhook failed: ..." 등). 정확도가 낮을 경우 default 가 SETUP_FAILED 라
   * fail-safe.
   */
  private translateSetupChannelError(err: unknown): BadRequestException {
    const message = err instanceof Error ? err.message : String(err);
    if (/\b(401|403)\b/.test(message)) {
      return new BadRequestException({
        code: 'BOT_TOKEN_INVALID',
        message: 'Bot token is invalid (401/403 from provider).',
        details: { reason: message.slice(0, 256) },
      });
    }
    return new BadRequestException({
      code: 'CHAT_CHANNEL_SETUP_FAILED',
      message: 'Chat channel setup failed after rotation.',
      details: { reason: message.slice(0, 256) },
    });
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

  /**
   * [Spec CCH-SE-04-C] — 24h grace 가 경과한 chat channel bot token 회전 cleanup.
   *   - `chat_channel_token_v2` ref 의 secret_store row 삭제 (`secrets.delete(v2Ref)`)
   *   - provider 별 `auth.revoke` best-effort 호출 (Slack 만 지원, Discord/Telegram 미지원)
   *   - `chat_channel_token_v2 = NULL` / `chat_channel_rotated_at = NULL` 갱신
   *
   * Idempotent — v2 가 null 이면 no-op. 매시간 cron (ChatChannelTokenRotatorService).
   * NotificationSecretRotator 와 동일 패턴.
   */
  async cleanupRotatedChatChannelTokens(
    nowMs: number = Date.now(),
  ): Promise<{ cleaned: number }> {
    const graceMs = 24 * 60 * 60 * 1000;
    const candidates = await this.triggerRepository
      .createQueryBuilder('t')
      .where('t.chat_channel_token_v2 IS NOT NULL')
      .andWhere('t.chat_channel_rotated_at <= :cutoff', {
        cutoff: new Date(nowMs - graceMs),
      })
      .getMany();
    let cleaned = 0;
    for (const trigger of candidates) {
      const v2Ref = trigger.chatChannelTokenV2;
      if (!v2Ref) continue;

      // provider 별 auth.revoke best-effort — 실패는 cleanup 진행 차단 안 함.
      const chatChannelCfg = (
        trigger.config as { chatChannel?: ChatChannelConfig }
      ).chatChannel;
      if (chatChannelCfg?.provider) {
        await this.tryRevokeOldBotToken(chatChannelCfg, v2Ref, trigger.id);
      }

      // secret_store v2 row 삭제 (best-effort — 미존재 ref 는 noop).
      try {
        await this.secrets.delete(v2Ref);
      } catch (err) {
        this.logger.warn(
          `ChatChannel v2 ref delete 실패 (trigger=${trigger.id}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // 컬럼 갱신.
      trigger.chatChannelTokenV2 = null;
      trigger.chatChannelRotatedAt = null;
      await this.triggerRepository.save(trigger);
      cleaned++;
    }
    return { cleaned };
  }

  /**
   * 24h grace 종료 시점에 old bot token 을 외부 provider 측에서도 revoke (가능한 경우).
   *
   * Adapter 인터페이스의 `revokeBotToken?` 옵션 메서드를 활용 — SoT:
   * [spec/conventions/chat-channel-adapter.md §1] Adapter Interface.
   *   - Slack: `auth.revoke` API 호출 (SlackAdapter.revokeBotToken 구현)
   *   - Telegram: revocation API 미지원 — adapter 미구현 (undefined)
   *   - Discord: token revoke endpoint 없음 — adapter 미구현 (undefined)
   *
   * 실패는 secret_store cleanup 을 차단하지 않는다 (best-effort).
   * Service 단에 provider 별 분기 없음 — adapter 의 메서드 존재 여부가 분기 역할 (OCP 정합).
   */
  private async tryRevokeOldBotToken(
    config: ChatChannelConfig,
    v2Ref: string,
    triggerId: string,
  ): Promise<void> {
    if (!this.channelAdapterRegistry.has(config.provider)) return;
    const adapter = this.channelAdapterRegistry.get(config.provider);
    if (typeof adapter.revokeBotToken !== 'function') return; // provider 가 revocation 미지원.
    try {
      const oldToken = await this.secrets.resolve(v2Ref);
      await adapter.revokeBotToken(oldToken);
      this.logger.log(
        `Adapter revokeBotToken 호출 — trigger=${triggerId} provider=${config.provider} 의 old bot token 무효화 완료`,
      );
    } catch (err) {
      this.logger.warn(
        `Adapter revokeBotToken best-effort 실패 (trigger=${triggerId}, provider=${config.provider}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
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
