import {
  AUDIT_ACTIONS,
  AuditActionFor,
} from '../audit-logs/audit-action.const';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  isPostgresUniqueViolation,
  pgErrorConstraint,
} from '../../common/db/pg-error';
import { randomBytes } from 'crypto';
import { Trigger, TriggerChatChannelHealth } from './entities/trigger.entity';
import { Execution } from '../executions/entities/execution.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { ScheduleRunnerService } from '../schedules/schedule-runner.service';
import { AuthConfig } from '../auth-configs/entities/auth-config.entity';
import { CreateTriggerDto } from './dto/create-trigger.dto';
import { UpdateTriggerDto } from './dto/update-trigger.dto';
import {
  NotificationConfigDto,
  validateNotificationUrl,
} from './dto/notification-config.dto';
import { InteractionConfigDto } from './dto/interaction-config.dto';
import {
  ChatChannelConfigDto,
  ChatChannelUpdateConfigDto,
} from './dto/chat-channel-config.dto';

import { ChannelAdapterRegistry } from '../chat-channel/channel-adapter.registry';
import { ChannelListenerRegistry } from '../chat-channel/channel-listener.registry';
import { ChatChannelConfig, SetupResult } from '../chat-channel/types';
import { SecretResolverService } from '../secret-store/secret-resolver.service';
import { buildSecretRef } from '../secret-store/secret-ref';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import {
  SLACK_SIGNING_SECRET_REGEX,
  DISCORD_PUBLIC_KEY_REGEX,
} from '@workflow/chat-channel-validation';
import { CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES } from './chat-channel-rejection-messages.const';
import { ErrorCode } from '../../nodes/core/error-codes';

/**
 * 두 진입점이 보내는 `chatChannel` 을 함께 받는 자리의 타입.
 *
 * `ChatChannelUpdateConfigDto` 는 `botToken` 이 **필수가 아니므로**
 * `ChatChannelConfigDto` 에 대입되지 않는다 — 그게 D-1 의 요점이다. 두 형태를 다 지나가는
 * 헬퍼(`assertChatChannelInputSafe` · `stripChatChannelPlaintext` · `mergeExternalConfig` ·
 * `setupChatChannel`)는 이 합집합을 받는다. **생성 전용 검증**
 * (`assertInboundSigningPlaintextByProvider`)은 좁은 타입 그대로 둔다 — 그 좁음이
 * "PATCH 에서 부르면 안 된다" 를 타입으로 말한다.
 */
type ChatChannelInput = ChatChannelConfigDto | ChatChannelUpdateConfigDto;

/**
 * `chatChannel` 입력 검증이 **어느 진입점**에서 왔는가.
 *
 * 두 경로의 요구가 정반대라 하나의 검증 함수로 묶을 수 없다
 * ([R-CC-21 「구현 시」](../../../../../spec/5-system/15-chat-channel.md)):
 *   - `create` — slack/discord 는 `inboundSigningPlaintext` 가 **필수**
 *   - `update` — 그 필드도 `botToken` 도 **금지**
 *
 * 종전에는 한 함수를 둘이 공유했고, 그래서 *"PATCH 에서 값 필드를 막는다"* 를 그 공유
 * 함수에 넣으면 **slack/discord 생성이 깨졌다.**
 */
type ChatChannelInputMode = 'create' | 'update';

export type TriggerDetail = Trigger & {
  cronExpression?: string;
  timezone?: string;
  nextRunAt?: Date | null;
};

/**
 * [Spec Chat Channel §5.4.2 + secret-store.md §5.5 SS-SE-01] 응답에서 strip 해야 하는
 * chat-channel 필드 allow-list. 신규 plaintext / 내부 ref 필드 추가 시 본 상수에
 * 반드시 키 추가 — destructure 누락 위험 회피. `sanitizeForResponse` 가
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

/**
 * `config.notification.signing` 에서 제거할 키.
 *
 * `secretRef` 는 secret store 참조이고 `secret` 은 정규화 전 평문이 스쳐 가는 자리다
 * (`normalizeNotificationSecretRef` 참조). `botTokenRef`/`inboundSigningRef` 를 이미
 * 빼는 것과 **같은 등급·같은 이유**인데 chat-channel 쪽만 목록에 있었다
 * (`review/code/2026/09/05/18_23_02` W1).
 *
 * 파생 플래그(`hasBotToken` 같은)는 두지 않는다 — 프런트엔드 소비처가 0곳이라
 * 새 필드를 만들 이유가 없다.
 */
const NOTIFICATION_SIGNING_STRIP_KEYS = new Set<string>([
  'secret',
  'secretRef',
]);

/**
 * 응답에서 제거할 **엔티티 컬럼**. `CHAT_CHANNEL_RESPONSE_STRIP_KEYS` ·
 * `NOTIFICATION_SIGNING_STRIP_KEYS` 가 `config` JSONB **안의 키**를 지우는 것과 달리
 * 이쪽은 `trigger` 행의 **컬럼**이다 — 같은 등급의 비밀이 **세 곳**에 산다.
 *
 * `notification_secret_v2` 는 참조가 아니라 **평문 서명 secret** 이다(24h rotation grace
 * 동안 non-null; 엔티티 주석 "본 컬럼이 새 secret 으로 승격" 참조). `chat_channel_token_v2`
 * 는 secret store ref 라 등급이 한 단계 낮지만, 내부 저장 위치를 드러내므로 같이 뺀다 —
 * `botTokenRef` 를 이미 빼는 것과 같은 이유다.
 *
 * **왜 `select: false` 가 아닌가**: 로테이션 스윕(`sweepNotificationRotation` ·
 * `sweepChatChannelRotation`)이 이 컬럼들을 읽어 승격/정리한다. 컬럼 수준에서 끄면 그
 * 경로가 `undefined` 를 받고 **예외 없이** 조용히 오작동한다 — fail-safe 가 아니라
 * fail-silent 다. 응답 경계에서 지우면 읽는 쪽은 그대로 둔 채 나가는 쪽만 막힌다.
 */
const TRIGGER_RESPONSE_STRIP_COLUMNS = [
  'notificationSecretV2',
  'chatChannelTokenV2',
] as const satisfies readonly (keyof Trigger)[];

/**
 * `config.interaction` 에서 제거할 키.
 *
 * `triggerToken`(`itk_*`)은 **영구 평문**으로 JSONB 에 보관되는 per-trigger bearer 토큰이고,
 * [`secret-store.md §1.1`](../../../../../spec/conventions/secret-store.md) 이 응답 노출을
 * **명시적으로 금지**한 세 필드 중 하나다. 나머지 둘(`notification_secret_v2` ·
 * `chat_channel_token_v2`)은 이 PR 이 닫았는데 **이것만 남아 있었다**
 * (`review/consistency/2026/09/05/22_25_00` Critical 1).
 *
 * `§1` 이 이 필드를 secret store 비대상으로 인정한 근거 (c) 가 *"발급 응답에 1회만 노출"*
 * 인데, 목록·상세 응답에 매번 실리면 **그 근거 자체가 무너진다.**
 *
 * 발급·재발급 경로(`revokePerTriggerToken`)의 1회성 평문 반환은 이 스트립과 무관하다 —
 * 그쪽은 서비스가 값을 **직접 반환**하지 트리거 엔티티를 거치지 않는다.
 */
const INTERACTION_RESPONSE_STRIP_KEYS = new Set<string>(['triggerToken']);

/** `audit_log.resource_type` 값 — 액션 prefix 와 동일 어휘. */
const TRIGGER_RESOURCE_TYPE = 'trigger';

/**
 * `strip` 에 든 키를 뺀 **얕은 복사본**을 만든다.
 *
 * `config.interaction` 축과 `config.notification.signing` 축은 후처리가 없어 루프가 문자
 * 그대로 같았다 (`review/code/2026/09/05/23_30_00` W2). `chatChannel` 축만 결과에
 * `hasBotToken` 을 얹으므로 그쪽은 호출부에서 한 줄 더 한다.
 */
function omitKeys(
  source: Record<string, unknown>,
  strip: ReadonlySet<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (strip.has(key)) continue;
    out[key] = value;
  }
  return out;
}

/**
 * 축 1 — `config.chatChannel`. **이 축만 후처리가 있다**: 남은 객체에 `botTokenRef` 존재
 * 여부에서 파생한 `hasBotToken` 을 얹는다.
 */
function stripChatChannelSecrets(
  chatChannel: Record<string, unknown>,
): Record<string, unknown> {
  const botTokenRef = chatChannel.botTokenRef;
  const out = omitKeys(chatChannel, CHAT_CHANNEL_RESPONSE_STRIP_KEYS);
  out.hasBotToken = typeof botTokenRef === 'string' && botTokenRef.length > 0;
  return out;
}

/** 축 2 — `config.interaction`. 발급된 평문 `triggerToken` 을 뺀다. */
function stripInteractionSecrets(
  interaction: Record<string, unknown>,
): Record<string, unknown> {
  return omitKeys(interaction, INTERACTION_RESPONSE_STRIP_KEYS);
}

/**
 * 축 3 — `config.notification.signing`. 감싸는 `notification` 을 통째로 새로 만들어
 * 돌려준다 (원본을 제자리에서 고치지 않는다).
 */
function stripNotificationSigningSecrets(
  notification: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...notification,
    signing: omitKeys(
      notification.signing as Record<string, unknown>,
      NOTIFICATION_SIGNING_STRIP_KEYS,
    ),
  };
}

/**
 * 축 4 — 엔티티 컬럼. **제자리 변형**이라 정화 *사본*에만 부른다.
 *
 * `undefined` 대입이 아니라 **키 자체를 제거**한다 — `undefined` 로 두면
 * `JSON.stringify` 는 지우더라도 중간 소비자(로깅·직렬화 우회)가 볼 수 있다.
 */
function deleteSecretColumns(target: Record<string, unknown>): void {
  for (const column of TRIGGER_RESPONSE_STRIP_COLUMNS) {
    delete target[column];
  }
}

/**
 * 조인된 `workflow` 를 **참조 2필드로** 좁힌다 — 엔티티 전체가 선언 없이 실려 나가고
 * 있었다 (`review/code/2026/09/05/21_40_37` W1). 소비처는 `id`·`name` 뿐이다.
 */
function narrowWorkflowRef(wf: { id: string; name: string }): {
  id: string;
  name: string;
} {
  return { id: wf.id, name: wf.name };
}

/**
 * `(workspace_id, endpoint_path)` UNIQUE 인덱스 위반인가.
 *
 * `V002__indexes.sql` 의 `idx_trigger_workspace_endpoint` — partial unique
 * (`WHERE endpoint_path IS NOT NULL`). **인덱스 이름으로 좁힌다**: SQLSTATE 23505 만
 * 보면 이 테이블의 다른 UNIQUE 위반까지 `endpoint_path` 충돌로 오보한다.
 *
 * 이름이 바뀌면 이 술어는 **조용히 false 를 돌려주고** 전역 `RESOURCE_CONFLICT` 로
 * 되돌아간다 — 안전한 방향이지만 계약이 조용히 좁아지므로, 그 이름을 상수로 고정하고
 * 단위 테스트가 두 방향(맞는 이름 → 좁힘 / 다른 이름 → 통과)을 모두 문다.
 */
const TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX = 'idx_trigger_workspace_endpoint';

/**
 * **SQLSTATE·인덱스명 추출은 `common/db/pg-error.ts` 가 SoT 다.** 첫 판은 여기서
 * `err.driverError?.code` 를 손으로 읽었는데, 그것은 저장소의 **4번째 사본**이었고
 * 게다가 **한 표면만** 봤다 — TypeORM 은 호출 경로(raw / `insert` / `save`)에 따라
 * wrap 깊이가 달라서 `err.code` 로 올라오는 경우가 있고, SoT 는 정확히 그 이유로
 * 두 표면을 모두 흡수한다 (`review/code/2026/09/06/14_59_48` W1).
 */
export function isEndpointPathUniqueViolation(err: unknown): boolean {
  return (
    isPostgresUniqueViolation(err) &&
    pgErrorConstraint(err) === TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX
  );
}

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
    @InjectRepository(AuthConfig)
    private readonly authConfigRepository: Repository<AuthConfig>,
    private readonly channelAdapterRegistry: ChannelAdapterRegistry,
    private readonly channelListenerRegistry: ChannelListenerRegistry,
    private readonly configService: ConfigService,
    private readonly secrets: SecretResolverService,
    private readonly auditLogsService: AuditLogsService,
    private readonly scheduleRunner: ScheduleRunnerService,
  ) {}

  async findAll(
    workspaceId: string,
    query: PaginationQueryDto & {
      type?: string;
      status?: string;
      interactionEnabled?: boolean;
    },
  ): Promise<PaginatedResponseDto<TriggerDetail>> {
    const {
      page = 1,
      limit = 20,
      search,
      type,
      status,
      interactionEnabled,
    } = query;

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
    if (interactionEnabled !== undefined) {
      // config(JSONB) -> interaction -> enabled 를 boolean 으로 비교. interaction 미설정/누락
      // 시 `->>'enabled'` 가 null → ::boolean null → 비교 결과 null(제외) — enabled=true 필터에
      // 정확히 부합한다(웹채팅 콘솔이 사용하는 경로).
      qb.andWhere(
        "(t.config->'interaction'->>'enabled')::boolean = :interactionEnabled",
        { interactionEnabled },
      );
    }

    qb.orderBy('t.created_at', 'DESC');

    const totalItems = await qb.getCount();
    const data = await qb
      .offset((page - 1) * limit)
      .limit(limit)
      .getMany();

    // [V-10 / spec 2-trigger-list §2.1] Schedule 타입 행은 목록에서도 cron 식·다음
    // 실행 시각을 표시해야 한다. findOneDetail 의 단건 enrichment 를 목록용으로
    // 일괄화 — 이 페이지의 schedule 트리거 id 를 모아 `triggerId IN (...)` 한 번의
    // 조회로 붙인다(행마다 findOne 하는 N+1 회피). workflow-list §2.4·schedules
    // findAll 의 list-level enrichment 선례와 동일 접근.
    const scheduleTriggerIds = data
      .filter((t) => t.type === 'schedule')
      .map((t) => t.id);
    const scheduleByTriggerId = new Map<string, Schedule>();
    if (scheduleTriggerIds.length > 0) {
      const schedules = await this.scheduleRepository.find({
        where: { triggerId: In(scheduleTriggerIds), workspaceId },
      });
      for (const s of schedules) scheduleByTriggerId.set(s.triggerId, s);
    }

    const enriched: TriggerDetail[] = data.map((t) => {
      if (t.type === 'schedule') {
        const schedule = scheduleByTriggerId.get(t.id);
        if (schedule) {
          return this.sanitizeForResponse(
            Object.assign(t, {
              cronExpression: schedule.cronExpression,
              timezone: schedule.timezone,
              nextRunAt: schedule.nextRunAt,
            }),
          );
        }
      }
      return this.sanitizeForResponse(t);
    });

    return PaginatedResponseDto.create(enriched, totalItems, page, limit);
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
      return this.sanitizeForResponse(trigger);
    }
    const schedule = await this.scheduleRepository.findOne({
      where: { triggerId: id, workspaceId },
    });
    if (!schedule) return this.sanitizeForResponse(trigger);
    return this.sanitizeForResponse(
      Object.assign(trigger, {
        cronExpression: schedule.cronExpression,
        timezone: schedule.timezone,
        nextRunAt: schedule.nextRunAt,
      }),
    );
  }

  /**
   * `trigger.*` 감사 기록. named 필드 — positional 이면 동일 타입(string) 인자 순서 스왑을
   * 컴파일러가 못 잡아 감사 주체·대상이 조용히 뒤바뀐다 (auth-configs W-1 과 동일 근거).
   *
   * `details.type` 을 함께 남긴다: webhook/schedule/chat_channel 은 같은 리소스 타입이지만
   * 노출면이 달라, 이것 없이는 사후 감사에서 어떤 계열이 바뀐 건지 알 수 없다.
   */
  private recordAudit(params: {
    workspaceId: string;
    userId: string;
    action: AuditActionFor<typeof TRIGGER_RESOURCE_TYPE>;
    resourceId: string;
    type: string;
  }): Promise<void> {
    return this.auditLogsService.record({
      workspaceId: params.workspaceId,
      userId: params.userId,
      action: params.action,
      resourceType: TRIGGER_RESOURCE_TYPE,
      resourceId: params.resourceId,
      details: { type: params.type },
    });
  }

  async create(
    workspaceId: string,
    dto: CreateTriggerDto,
    userId: string,
  ): Promise<Trigger> {
    // notification/interaction/chatChannel 은 Trigger entity 의 1급 컬럼이 아니라 `config` JSONB.
    // (영속 컬럼은 health/secret rotation 추적용 9개만; spec EIA §7.1 + spec CCH §4.2).
    const { notification, interaction, chatChannel, config, ...rest } = dto;
    this.assertNotificationUrlSafe(notification);
    this.assertChatChannelInputSafe(chatChannel, 'create');
    // authConfigId 가 주어지면 같은 워크스페이스의 AuthConfig 인지 검증 (cross-workspace 차단).
    if (rest.authConfigId) {
      await this.assertAuthConfigInWorkspace(rest.authConfigId, workspaceId);
    }
    // [SS-SE-01] mergeExternalConfig 호출 전 plaintext (botToken / inboundSigningPlaintext)
    // 를 strip — 첫 triggerRepository.save 시 plaintext 가 DB JSONB 에 일시 기록되지 않도록.
    // setupChatChannel 은 원본 dto.chatChannel (plaintext 포함) 을 별도 전달 받아 secret store
    // 로 옮긴 뒤 ref 만 config 에 반영.
    const safeChatChannel = chatChannel
      ? this.stripChatChannelPlaintext(chatChannel)
      : undefined;
    const mergedConfig = this.mergeExternalConfig(
      this.stripInlineAuthKeys(config ?? {}),
      notification,
      interaction,
      safeChatChannel,
    );
    const trigger = this.triggerRepository.create({
      ...rest,
      config: mergedConfig,
      workspaceId,
    });
    const saved = await this.triggerRepository
      .save(trigger)
      .catch((err: unknown) => this.rethrowEndpointPathConflict(err));
    // **커밋 직후** 기록한다. 아래 secret store 마이그레이션·chatChannel setup 은 실패할 수
    // 있는 외부 호출이라, 그 뒤로 미루면 트리거는 생겼는데 감사는 안 남는다 (리뷰 W6).
    // resourceId 는 커밋된 id 로 확정이고, chatChannel 재조회는 응답 형태만 바꾼다.
    await this.recordAudit({
      workspaceId,
      userId,
      action: AUDIT_ACTIONS.TRIGGER_CREATED,
      resourceId: saved.id,
      type: saved.type,
    });
    // notification.signing.secret plaintext 가 config 에 들어왔으면 secret store 로 마이그레이션.
    await this.normalizeNotificationSecretRef(saved);
    let result = saved;
    // Chat Channel 어댑터 setup — CCH-AD-02.
    if (chatChannel) {
      await this.setupChatChannel(saved, chatChannel, {
        storeUserSuppliedSecrets: true,
      });
      // setupChatChannel 은 별도 triggerRepository.update 로 botTokenRef / inboundSigningRef /
      // chatChannelHealth 등을 갱신. in-memory `saved` 는 그 update 를 모르므로 응답 stale
      // 회귀 (hasBotToken=false). 재조회로 최신 상태 반영.
      const refreshed = await this.triggerRepository.findOne({
        where: { id: saved.id, workspaceId },
      });
      if (refreshed) result = refreshed;
    }
    return this.sanitizeForResponse(result);
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateTriggerDto,
    userId: string,
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
          details: { field: 'type', disallowed, code: ErrorCode.INVALID_FIELD },
        });
      }
    }
    this.assertNotificationUrlSafe(notification);
    this.assertChatChannelInputSafe(chatChannel, 'update');
    // [R-CC-21 / D-1] `chatChannel` 이 실린 PATCH 는 비밀을 받지 않으므로, **최초 setup 을
    // PATCH 로 할 수 없다** — bot token 을 실어 보낼 방법이 없다. 그런데 그냥 두면
    // `setupChannel` 이 secret store 에서 토큰을 못 찾아 실패하고, 그 실패는 CCH-SE-01 의
    // best-effort catch 가 삼켜 `chatChannelHealth=degraded` 로 **조용히** 앉는다.
    // R-CC-21 이 경고한 *"실패가 보이는 형태에서 조용한 형태로 바뀐다"* 와 같은 함정이라
    // 여기서 명시적으로 400 을 낸다. 최초 setup 은 생성 POST 한정 (§5.4.1 표 1행).
    if (chatChannel) {
      this.assertChatChannelAlreadySetUp(trigger, chatChannel);
    }
    // [ref 보존] `mergeExternalConfig` 가 `config.chatChannel` 을 통째로 교체하기 **전에**
    // 집어 둔다. `botTokenRef` 는 trigger id 로 재유도되지만 `inboundSigningRef` 는 그렇지
    // 않아, 여기서 안 집으면 slack/discord PATCH 마다 사라진다 → 인입 서명 검증 fail-open.
    const previousInboundSigningRef = (
      trigger.config as { chatChannel?: { inboundSigningRef?: string } }
    )?.chatChannel?.inboundSigningRef;
    // authConfigId 를 새로 set 하는 경우 같은 워크스페이스의 AuthConfig 인지 검증.
    // null 로 set (인증 제거) 은 검증 대상 아님.
    if (rest.authConfigId) {
      await this.assertAuthConfigInWorkspace(rest.authConfigId, workspaceId);
    }
    // [SS-SE-01] mergeExternalConfig 호출 전 plaintext strip (create() 와 동일 정책).
    const safeChatChannel = chatChannel
      ? this.stripChatChannelPlaintext(chatChannel)
      : undefined;
    // notification/interaction/chatChannel 이 명시된 경우만 config 안의 해당 키를 교체.
    const baseConfig = this.stripInlineAuthKeys(config ?? trigger.config ?? {});
    const mergedConfig = this.mergeExternalConfig(
      baseConfig,
      notification,
      interaction,
      safeChatChannel,
    );
    // `rest` 에는 **값이 없는 optional 필드도 `undefined` 로 존재**한다 — `target: ES2023`
    // 에서 클래스 필드가 own property 로 정의되기 때문이다(`useDefineForClassFields`).
    // 그대로 `Object.assign` 하면 로드된 값을 `undefined` 로 **덮어쓴다** — DB 는 TypeORM
    // 이 undefined 를 건너뛰어 무사하지만 **응답에서 필드가 사라진다.**
    // `PATCH /api/triggers/:id` 응답에 `name` 이 없던 원인이고, §5.4 계약 대조를 그
    // 경로로 넓히자 드러났다 (`review/code/2026/09/05/21_40_37` W1).
    const defined = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined),
    );
    Object.assign(trigger, defined, { config: mergedConfig });
    const saved = await this.triggerRepository
      .save(trigger)
      .catch((err: unknown) => this.rethrowEndpointPathConflict(err));
    // **커밋 직후** 기록한다 — 아래 세 가지(schedule 역동기화의 BullMQ 호출, secret
    // 마이그레이션, chatChannel setup)는 전부 실패할 수 있는 외부 호출이라, 그 뒤로 미루면
    // 트리거는 바뀌었는데 감사는 안 남는다 (리뷰 W6). chatChannel 재조회는 응답 형태만
    // 바꾸므로 감사 내용에 영향이 없다.
    //
    // 처음엔 `syncScheduleActivation` **뒤**에 뒀다가 4차 리뷰가 잡았다 — 같은 함수의 다른 두
    // 외부 호출은 원칙대로 뒤에 두고 이 하나만 앞에 남겨, schedule 타입 트리거의 isActive
    // 변경 경로에서만 불변식이 깨져 있었다.
    await this.recordAudit({
      workspaceId,
      userId,
      action: AUDIT_ACTIONS.TRIGGER_UPDATED,
      resourceId: saved.id,
      type: saved.type,
    });
    // [Spec 1-data-model §2.9.1 / data-flow 10-triggers §1.4] 역방향(Trigger→Schedule) is_active
    // 동기화. ScheduleProcessor 는 schedule.is_active 만 보므로, schedule row + BullMQ job
    // scheduler 에 반영하지 않으면 트리거 쪽 비활성화로는 발사가 멈추지 않는다
    // (정방향 SchedulesService.update 와 대칭).
    if (trigger.type === 'schedule' && rest.isActive !== undefined) {
      await this.syncScheduleActivation(saved, rest.isActive);
    }
    await this.normalizeNotificationSecretRef(saved);
    let result = saved;
    if (chatChannel) {
      // chatChannel 갱신 — 새 webhook URL 등록 (idempotent).
      // **사용자 비밀은 쓰지 않는다** (R-CC-21 / D-2). telegram 의 server-issued 서명은
      // 이 플래그와 무관하게 계속 재저장된다 — 위 setupChatChannel 문서의 3-쓰기 표 참조.
      await this.setupChatChannel(saved, chatChannel, {
        storeUserSuppliedSecrets: false,
        // 병합 **전**의 값이다 — `saved.config.chatChannel` 은 이미 요청 바디로 교체됐다.
        preservedInboundSigningRef: previousInboundSigningRef,
      });
      // setupChatChannel 은 별도 triggerRepository.update — in-memory `saved` 는 stale.
      // 응답 hasBotToken / inboundSigningRef 가 최신 반영되도록 재조회.
      //
      // **`relations` 를 함께 실어야 한다.** 이 재조회가 `saved` 를 통째로 갈아치우므로,
      // 관계를 빼고 읽으면 `chatChannel` 을 포함한 PATCH 응답에서만 `workflow` 가 사라진다
      // — `TriggerDto.workflow` JSDoc 은 *"생성 응답에만 없다"* 고 보장하는데 그 보장이
      // 구현보다 넓었다 (`review/code/2026/09/06/01_13_50` W4). 부재가 §5.4 키 생략형이라
      // 계약 검증자도 못 잡는 자리다.
      const refreshed = await this.triggerRepository.findOne({
        where: { id: saved.id, workspaceId },
        relations: ['workflow'],
      });
      if (refreshed) result = refreshed;
    }
    return this.sanitizeForResponse(result);
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
   *
   * **`mode === 'update'` 에서는 위 provider 분기가 적용되지 않는다.** PATCH 에서는
   * `inboundSigningPlaintext` 가 *필수*가 아니라 **금지**로 뒤집히고(`botToken` 도 함께),
   * 그 축은 `assertPatchCarriesNoSecrets` 가 본다 — R-CC-21 / D-1. 즉 위 "slack: 필수 /
   * discord: 필수" 서술의 주어는 **생성(POST) 한정**이다.
   */
  // 오버로드로 `mode` 와 DTO 타입을 **컴파일 타임에 묶는다.** 문자열 판별자만 두면
  // `('update' 인데 생성용 DTO)` 같은 짝 깨짐을 컴파일러가 못 잡고, 아래 좁히기 캐스팅이
  // 조용히 통과한다 — 이 함수가 지키는 것이 바로 이 PR 이 닫은 보안 결함 클래스라
  // 그 재발은 검출 없이 되살아난다 (`/ai-review` `review/code/2026/09/10/23_55_23` W4).
  private assertChatChannelInputSafe(
    chatChannel: ChatChannelConfigDto | undefined,
    mode: 'create',
  ): void;
  private assertChatChannelInputSafe(
    chatChannel: ChatChannelUpdateConfigDto | undefined,
    mode: 'update',
  ): void;
  private assertChatChannelInputSafe(
    chatChannel: ChatChannelInput | undefined,
    mode: ChatChannelInputMode,
  ): void {
    if (!chatChannel) return;
    const blocked = chatChannel as unknown as Record<string, unknown>;
    if (typeof blocked.botTokenRef !== 'undefined') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES.botTokenRef,
        details: { field: 'botTokenRef', code: ErrorCode.INVALID_FIELD },
      });
    }
    if (typeof blocked.inboundSigningRef !== 'undefined') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES.inboundSigningRef,
        details: { field: 'inboundSigningRef', code: ErrorCode.INVALID_FIELD },
      });
    }
    if (typeof blocked.inboundSigning !== 'undefined') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES.inboundSigning,
        details: { field: 'inboundSigning', code: ErrorCode.INVALID_FIELD },
      });
    }
    if (mode === 'update') {
      // [R-CC-21 / D-1] PATCH 는 **값 필드**도 받지 않는다. 전역 `CustomValidationPipe` +
      // `ChatChannelUpdateConfigDto` 의 `@IsEmpty()` 가 1차로 막지만, 여기서 한 번 더 막는
      // 것은 위 세 내부 필드와 같은 이유다 — 서비스는 컨트롤러 밖에서도 호출될 수 있고,
      // spec 의 `VALIDATION_ERROR` 봉투 형식을 서비스 층에서도 보장한다.
      this.assertPatchCarriesNoSecrets(chatChannel);
      return;
    }
    // 생성 경로 전용 — slack/discord 는 `inboundSigningPlaintext` 가 **필수**다.
    // 이 검사를 PATCH 에도 걸면 두 provider 의 카드 편집이 전부 400 이 된다(그것이 원 결함).
    // `mode === 'create'` 인 자리에서만 도달하므로 좁은 타입으로 좁혀 부른다.
    this.assertInboundSigningPlaintextByProvider(
      chatChannel as ChatChannelConfigDto,
    );
  }

  /**
   * [Spec Chat Channel R-CC-21 / D-1] `chatChannel` 이 실린 PATCH 에 **사용자 비밀이 실렸는지**.
   *
   * 두 축만 본다 — `botToken`(rotate 대상) · `inboundSigningPlaintext`(slack/discord 사용자 입력).
   * telegram 의 server-issued 서명은 body 로 오지 않으므로 여기 없다.
   */
  private assertPatchCarriesNoSecrets(chatChannel: ChatChannelInput): void {
    const carried = chatChannel as unknown as Record<string, unknown>;
    if (typeof carried.botToken !== 'undefined') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES.botToken,
        details: { field: 'botToken', code: ErrorCode.INVALID_FIELD },
      });
    }
    if (typeof carried.inboundSigningPlaintext !== 'undefined') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES.inboundSigningPlaintext,
        details: {
          field: 'inboundSigningPlaintext',
          code: ErrorCode.INVALID_FIELD,
        },
      });
    }
  }

  /**
   * [Spec Chat Channel §5.4.1 표 1행] 최초 setup 은 **생성 POST 한정**이다.
   *
   * PATCH 로 `chatChannel` 을 처음 붙이려는 요청은 비밀을 실을 방법이 없어 반드시 실패하는데,
   * 그 실패가 `setupChatChannel` 의 best-effort catch 에 삼켜지면 `degraded` 로 조용히 앉는다.
   * 사용자에게는 "저장됐다" 로 보이고 봇은 죽어 있다 — 그래서 여기서 먼저 거부한다.
   */
  private assertChatChannelAlreadySetUp(
    trigger: Trigger,
    incoming: ChatChannelInput,
  ): void {
    const current = (trigger.config as { chatChannel?: { provider?: string } })
      ?.chatChannel;
    if (!current?.provider) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'chatChannel 최초 설정은 트리거 생성(POST /api/triggers)에서만 할 수 있어요. PATCH 는 bot token 을 받지 않으므로 채널을 새로 붙일 수 없어요.',
        details: { field: 'chatChannel', code: ErrorCode.INVALID_FIELD },
      });
    }
    // provider 전환도 막는다. 허용하면 **다른 provider 의 토큰을 넘기게 된다** —
    // `botTokenRef` 는 trigger id 로만 재유도되므로 그 ref 뒤의 평문은 여전히 옛 provider 의
    // 토큰이고, 새 adapter 가 그것으로 외부 API 를 때린다. `2-trigger-list.md` `R-12` 도
    // *"변경하려면 트리거 삭제·재생성"* 이라 적는다.
    if (incoming.provider && incoming.provider !== current.provider) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `provider 는 PATCH 로 바꿀 수 없어요 (현재 ${current.provider}). 다른 provider 로 옮기려면 트리거를 삭제 후 다시 만들어 주세요.`,
        details: { field: 'provider', code: ErrorCode.INVALID_FIELD },
      });
    }
  }

  /**
   * [SS-SE-01 — spec/conventions/secret-store.md §5.5] plaintext (botToken /
   * inboundSigningPlaintext) 를 chatChannel 객체에서 제거. setupChatChannel 호출 전 config 에
   * 흘러가는 것을 차단해 첫 triggerRepository.save 시 DB JSONB 에 일시 기록되는 시간 창을
   * 제거한다. adapter 미등록 early-return 경로에서도 plaintext 가 영구 잔류하지 않음을 보장.
   *
   * 원본 plaintext 는 호출자가 별도 변수로 보관해 setupChatChannel 에 전달 — SecretResolver.rotate
   * (UPSERT) 로 옮긴 뒤 ref 만 config 에 반영.
   */
  private stripChatChannelPlaintext(
    chatChannel: ChatChannelInput,
  ): ChatChannelInput {
    // 캐스팅이 필요 없다 — `ChatChannelInput` 의 두 갈래가 이미 두 필드를 갖는다
    // (생성용은 `botToken: string` 필수 · PATCH 용은 둘 다 optional). 종전 `as` 는 좁은
    // 타입 하나만 받던 시절의 잔재라 지금은 lint 가 불필요 단언으로 잡는다.
    const {
      botToken: _bt,
      inboundSigningPlaintext: _isp,
      ...rest
    } = chatChannel;
    return rest;
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
          details: {
            field: 'inboundSigningPlaintext',
            code: ErrorCode.INVALID_FIELD,
          },
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
        details: {
          field: 'inboundSigningPlaintext',
          code: ErrorCode.INVALID_FIELD,
        },
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
        details: {
          field: 'inboundSigningPlaintext',
          code: ErrorCode.INVALID_FIELD,
        },
      });
    }

    if (provider === 'discord' && !DISCORD_PUBLIC_KEY_REGEX.test(plaintext)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'Discord application public key 형식이 올바르지 않습니다 (ed25519 public key lowercase hex 64 chars 필요).',
        details: {
          field: 'inboundSigningPlaintext',
          code: ErrorCode.INVALID_FIELD,
        },
      });
    }
  }

  /**
   * 트리거를 **응답 경계**에서 정화한다 — 비밀이 사는 **네 곳**을 모두 덮는다.
   *
   * [Spec Chat Channel §5.4.2 + secret-store.md §5.5 SS-SE-01]
   *
   * | 축 | 어디 | 목록 | 정화 함수 |
   * |---|---|---|---|
   * | 1 | `config.chatChannel` JSONB | `CHAT_CHANNEL_RESPONSE_STRIP_KEYS` | `stripChatChannelSecrets` |
   * | 2 | `config.notification.signing` | `NOTIFICATION_SIGNING_STRIP_KEYS` | `stripNotificationSigningSecrets` |
   * | 3 | `config.interaction` | `INTERACTION_RESPONSE_STRIP_KEYS` | `stripInteractionSecrets` |
   * | 4 | `trigger` 행의 **엔티티 컬럼** | `TRIGGER_RESPONSE_STRIP_COLUMNS` | `deleteSecretColumns` |
   *
   * **이 메서드는 얇은 오케스트레이터다** — 축마다 이름 있는 순수 함수를 부르고, 조인된
   * `workflow` 좁히기(`narrowWorkflowRef`)까지 다섯 책임이 각자 함수로 갈려 있다
   * (`review/code/2026/09/06/00_00_23` W2 — 78줄 단일 메서드였다).
   *
   * 신규 plaintext / 내부 ref 필드를 추가할 때는 해당 상수에 키를 넣어야 정화가 걸린다
   * (destructure 대신 목록 — 누락 위험 회피).
   *
   * **엔티티를 변경하지 않는다 — 항상 새 객체를 돌려준다** (DB 저장에 영향이 없도록).
   * 조기 return 을 없앤 뒤로는 정화할 것이 없는 트리거도 새 참조를 받는다, 그러니 호출부는
   * 참조 동일성을 전제하지 말 것.
   *
   * ## 왜 세 목록인가 — 이 메서드가 두 번 좁게 틀렸다
   *
   * 처음엔 (1) 만 했고 `config.chatChannel` 이 없으면 **조기 return** 했다. 그래서
   * chat-channel 이 아닌 트리거는 정화를 아예 거치지 않았고, chat-channel 트리거도 컬럼 쪽
   * 비밀(3)은 그대로 나갔다 — `GET /api/triggers` 의 `createQueryBuilder('t')` 가 전 컬럼을
   * select 하므로 로테이션 유예 중이면 `notificationSecretV2` 가 wire 로 나간다.
   * (§5.4 응답-계약 스윕이 `TriggerDto` 미선언 9필드로 검출.)
   *
   * 그것을 고친 뒤에도 (2) 가 빠져 있었다 — `botTokenRef` 를 빼는 것과 **같은 등급·같은
   * 이유**인데 목록이 chat-channel 쪽에만 있었다 (`review/code/2026/09/05/18_23_02` W1).
   * 그리고 (3) 이 또 빠져 있었다 — `secret-store.md §1.1` 이 **이름으로 열거한** 세 필드 중
   * 둘만 닫은 상태였다 (`review/consistency/2026/09/05/22_25_00` Critical 1).
   *
   * **세 번 같은 형태로 좁았다.** 다음에 비밀 축이 하나 더 생기면 목록을 늘리지 말고
   * 선언적 SoT(엔티티 데코레이터)로 옮길 것.
   */
  private sanitizeForResponse<T extends Trigger>(trigger: T): T {
    const cfg = trigger.config as
      | {
          chatChannel?: Record<string, unknown>;
          notification?: Record<string, unknown>;
          [k: string]: unknown;
        }
      | null
      | undefined;

    const overrides: Record<string, unknown> = {};

    if (cfg) {
      const nextConfig: Record<string, unknown> = { ...cfg };
      let configTouched = false;

      if (cfg.chatChannel) {
        nextConfig.chatChannel = stripChatChannelSecrets(cfg.chatChannel);
        configTouched = true;
      }

      const interaction = cfg.interaction as
        Record<string, unknown> | undefined;
      if (interaction && typeof interaction === 'object') {
        nextConfig.interaction = stripInteractionSecrets(interaction);
        configTouched = true;
      }

      // `chatChannel` 이 없어도 여기까지 온다 — 종전에는 조기 return 이라
      // chat-channel 이 아닌 트리거의 config 는 아예 정화되지 않았다.
      const notification = cfg.notification;
      const signing = (notification as { signing?: unknown } | undefined)
        ?.signing;
      if (signing && typeof signing === 'object') {
        nextConfig.notification = stripNotificationSigningSecrets(
          notification as Record<string, unknown>,
        );
        configTouched = true;
      }

      if (configTouched) overrides.config = nextConfig;
    }

    const wf = (trigger as { workflow?: { id: string; name: string } })
      .workflow;
    if (wf) {
      overrides.workflow = narrowWorkflowRef(wf);
    }

    // entity 의 메서드/getter 를 보존하기 위해 prototype 유지하면서 필드만 교체.
    const sanitized = Object.assign(
      Object.create(Object.getPrototypeOf(trigger) as object),
      trigger,
      overrides,
    ) as T;
    deleteSecretColumns(sanitized as unknown as Record<string, unknown>);
    return sanitized;
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
  /**
   * authConfigId 가 호출자의 워크스페이스에 속한 AuthConfig 인지 검증.
   * cross-workspace 참조(다른 워크스페이스 자격증명에 트리거 binding) 를 차단한다.
   */
  private async assertAuthConfigInWorkspace(
    authConfigId: string,
    workspaceId: string,
  ): Promise<void> {
    const found = await this.authConfigRepository.findOne({
      where: { id: authConfigId, workspaceId },
    });
    if (!found) {
      throw new BadRequestException({
        code: 'AUTH_CONFIG_NOT_FOUND',
        message: 'Auth config not found in this workspace',
        details: { field: 'authConfigId', code: ErrorCode.INVALID_FIELD },
      });
    }
  }

  /**
   * 폐기된 inline webhook 인증 키를 config 에서 제거 (방어적 — 인증은 authConfigId 로만).
   * V066 cleanup 과 별개로, 클라이언트가 보낸 평문 secret/bearerToken 이 config JSONB 에
   * 새로 유입되지 않도록 한다 (spec/5-system/12-webhook.md §2.2).
   */
  private stripInlineAuthKeys(
    config: Record<string, unknown>,
  ): Record<string, unknown> {
    const {
      authType: _authType,
      secret: _secret,
      bearerToken: _bearerToken,
      hmacHeader: _hmacHeader,
      hmacAlgorithm: _hmacAlgorithm,
      ...rest
    } = config;
    void _authType;
    void _secret;
    void _bearerToken;
    void _hmacHeader;
    void _hmacAlgorithm;
    return rest;
  }

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
    chatChannel?: ChatChannelInput,
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
   *
   * ## secret store 쓰기는 셋이고, PATCH 에서의 처분이 서로 다르다
   *
   * | 쓰기 | 자원 | `storeUserSuppliedSecrets: false` 일 때 |
   * |---|---|---|
   * | bot token rotate | 사용자가 body 로 보낸 값 | **건너뛴다** |
   * | provider-issued signing (slack/discord) | 사용자가 body 로 보낸 값 | **건너뛴다** |
   * | server-issued signing (telegram) | adapter 가 provider 와 합의해 발급 | **그대로 쓴다** |
   *
   * **세 번째를 함께 막으면 안 된다.** telegram adapter 는 `setupChannel` 마다 새
   * `secret_token` 을 Telegram 에 등록하므로, 저장을 건너뛰면 DB 는 옛 값이 되고
   * `X-Telegram-Bot-Api-Secret-Token` 검증이 어긋나 **그 트리거의 인입이 전부 401** 이 된다.
   * 플래그 이름을 `writeSecrets` 처럼 뭉뚱그리지 않고 `storeUserSuppliedSecrets` 로 둔 이유가
   * 이것이다 — 게이팅 대상이 *"사용자가 보낸"* 비밀임을 이름이 말하게 한다.
   *
   * @see spec/5-system/15-chat-channel.md §5.4.1.1 (inboundSigning — 회전 주체별 분기)
   * @see spec/5-system/15-chat-channel.md R-CC-21 (PATCH 는 비밀을 쓰지 않는다)
   */
  private async setupChatChannel(
    trigger: Trigger,
    chatChannelCfg: ChatChannelInput,
    {
      storeUserSuppliedSecrets,
      preservedInboundSigningRef,
    }: {
      storeUserSuppliedSecrets: boolean;
      /**
       * 이 PATCH **이전에** config 에 있던 `inboundSigningRef`. 호출자가 병합 전에 집어 준다
       * — 병합 후에는 사라져 있어 이 함수가 스스로 알 수 없다. 생성 경로는 `undefined`.
       */
      preservedInboundSigningRef?: string;
    },
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
    const callbackUrl = this.buildCallbackUrl(trigger.endpointPath);

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

    // [쓰기 ①] secret store 에 botToken 저장 (UPSERT — 재시도 안전).
    // **PATCH 에서는 건너뛴다.** 종전에는 조건이 없어서, 값이 없으면 `?? ''` 가 빈 문자열로
    // 회전해 저장된 토큰을 지웠다 — `SecretResolver.rotate` 에 빈 값 가드가 없기 때문이다
    // (R-CC-21 「처방의 함정」). 필드를 막는 것만으로는 그 파괴를 못 막으므로 경로를 막는다.
    if (storeUserSuppliedSecrets) {
      await this.secrets.rotate(
        botTokenRef,
        trigger.workspaceId,
        chatChannelCfg.botToken ?? '',
      );
    }

    // [secret-store.md §5.5 (b)] provider-issued inbound-signing plaintext 처리.
    // Slack signing secret / Discord public key — 사용자가 외부 portal 에서 입력한 값을
    // secret store 로 옮기고 plaintext 는 config 에 절대 흘리지 않음 (SS-SE-01).
    // [쓰기 ②] **PATCH 에서는 건너뛴다** — §5.4.1.1 이 v1 에서 이 회전을 차단한다.
    // 종전 구현은 slack/discord 에서 이 값을 **필수로 요구**해 매 PATCH 마다 회전시켰다.
    const providerIssuedPlaintext = storeUserSuppliedSecrets
      ? chatChannelCfg.inboundSigningPlaintext
      : undefined;
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

    // [ref 보존 — 두 ref 는 **대칭**이어야 한다]
    //
    // `mergeExternalConfig` 가 `config.chatChannel` 을 **통째로 교체**하므로, 요청 바디에 없는
    // 필드는 전부 사라진다. `botTokenRef` 는 `buildSecretRef(trigger.id)` 로 매번 재유도돼
    // 무조건 다시 실리는데, `inboundSigningRef` 는 종전에 *"이번 호출에서 값을 새로 썼을 때만"*
    // 실렸다. D-2 가 그 쓰기를 게이팅하자 **slack/discord PATCH 에서 그 조건이 구조적으로 항상
    // 거짓**이 되어 ref 가 사라졌고, `ChatChannelInboundAuthenticator` 는 세 provider 모두
    // `if (!config.inboundSigningRef) return;` 으로 검증을 건너뛴다 — 카드 편집 PATCH 한 번으로
    // 그 트리거의 인입 웹훅이 **서명 없이 통과**하게 된다(fail-open).
    //
    // **그렇다고 `botTokenRef` 처럼 무조건 싣지는 않는다.** 이 ref 의 존재는 *"signing 비밀이
    // 저장돼 있다"* 는 신호이기도 해서, 행이 없는 트리거(legacy · setupChannel 이전)에 ref 를
    // 붙이면 검증이 resolve 실패로 넘어가 **fail-open 을 fail-closed 로 바꾸는 별개의 동작
    // 변경**이 된다. 그래서 "새로 썼거나 · 이미 있었으면 보존" 으로 좁힌다.
    // **`trigger.config` 에서 읽으면 안 된다** — `update()` 는 `mergeExternalConfig` 로
    // `config.chatChannel` 을 통째로 교체한 뒤 저장하고, 그 결과를 이 함수에 넘긴다. 즉 여기
    // 도착한 시점의 `trigger.config.chatChannel` 은 **이미 요청 바디로 갈아치워져** 옛 ref 가
    // 없다. 그래서 호출자가 **병합 전에** 집어 인자로 넘긴다.
    const inboundSigningRefSurvives =
      providerIssuedStored || Boolean(preservedInboundSigningRef);

    const internalCfg: ChatChannelConfig = {
      ...(sanitizedCfg as ChatChannelConfig),
      botTokenRef,
      ...(inboundSigningRefSurvives ? { inboundSigningRef } : {}),
    };

    try {
      const result = await adapter.setupChannel(internalCfg, callbackUrl);

      // [쓰기 ③] issuedInboundSigning (server-issued, Telegram) → secret store 저장.
      // provider-issued (slack/discord) 인 경우 setupChannel 의 issuedInboundSigning 은 비어 있음
      // — 이미 위에서 사용자 입력 plaintext 를 저장했으므로 noop.
      //
      // **`storeUserSuppliedSecrets` 로 게이팅하지 않는다 — 의도적이다.** 이 값은 사용자가
      // 보낸 것이 아니라 adapter 가 방금 Telegram 에 등록한 값이다. PATCH 에서 저장을
      // 건너뛰면 DB 는 옛 `secret_token`, Telegram 은 새 값으로 서명하게 되어 그 트리거의
      // 인입 웹훅이 **전부 401** 이 된다 (Spec §5.4.1.1 telegram 행 / R-CC-21 caveat).
      // 회귀 캐너리: `triggers.service.spec.ts` 의 *"server-issued 서명은 PATCH 에서도
      // 재저장된다"*.
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
        // 위 `inboundSigningRefSurvives` 와 같은 술어 + 이번 호출의 server-issued 발급.
        // 회귀 캐너리: *"slack/discord — 카드 편집 PATCH 후에도 inboundSigningRef 가 살아남는다"*.
        ...(result.issuedInboundSigning || inboundSigningRefSurvives
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
      // [Spec R8 v1 적용 (2026-05-24)] setup success path 에서만 listener registry register.
      // setupChannel 멱등성 — 동일 triggerId 재호출 시 entry overwrite.
      this.channelListenerRegistry.register(
        trigger.id,
        chatChannelCfg.provider,
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
      // fallbackConfig: `internalCfg` 를 그대로 쓴다 — 위 `inboundSigningRefSurvives` 가
      // 거기서 이미 적용되므로 **실패 경로에서도 두 ref 가 함께 보존된다**.
      // 회귀 캐너리: *"setupChannel 이 실패해도(degraded) inboundSigningRef 를 잃지 않는다"*.
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

  /**
   * [Spec 1-data-model §2.9.1 / data-flow 10-triggers §1.4] Trigger 측 토글의 schedule 동기.
   * schedule row 의 is_active 를 맞추고 BullMQ job scheduler 를 등록/해제한다.
   * 고아 trigger (생성 2-step 중간 실패로 schedule row 부재) 는 graceful skip — 동기 대상이 없다.
   */
  private async syncScheduleActivation(
    trigger: Trigger,
    isActive: boolean,
  ): Promise<void> {
    const schedule = await this.scheduleRepository.findOne({
      where: { triggerId: trigger.id },
    });
    if (!schedule) {
      this.logger.warn(
        `schedule row not found for schedule-type trigger ${trigger.id} — is_active sync skipped`,
      );
      return;
    }
    schedule.isActive = isActive;
    await this.scheduleRepository.save(schedule);
    if (isActive) {
      await this.scheduleRunner.registerJob(schedule);
    } else {
      await this.scheduleRunner.removeJob(schedule.id);
    }
  }

  async remove(id: string, workspaceId: string, userId: string): Promise<void> {
    const trigger = await this.findById(id, workspaceId);
    // [data-flow 10-triggers §1.4] schedule 타입은 trigger 삭제(FK CASCADE 로 schedule row 동반
    // 삭제) 전에 BullMQ job scheduler 엔트리를 해제한다 — 미해제 시 Redis 에 잔존해 cron tick
    // 마다 "Schedule not found" skip 이 반복된다 (정방향 SchedulesService.remove 와 대칭).
    if (trigger.type === 'schedule') {
      const schedule = await this.scheduleRepository.findOne({
        where: { triggerId: trigger.id },
      });
      if (schedule) {
        await this.scheduleRunner.removeJob(schedule.id);
      }
    }
    await this.teardownChatChannel(trigger);
    // [Spec R8 v1 적용 (2026-05-24)] listener registry unregister — trigger 삭제 후 race
    // event 가 dispatcher 에 도달했을 때 안전 가드. unregister 는 graceful (미등록 noop).
    this.channelListenerRegistry.unregister(trigger.id);
    // SUMMARY#13: trigger 삭제 시 secret_store 의 모든 관련 row 삭제 (application-level cascade).
    await this.secrets.deleteByPrefix(`secret://triggers/${trigger.id}/`);
    // type 을 remove 전에 읽어둔다 — TypeORM `remove` 는 엔티티의 id 를 지운다.
    const { type } = trigger;
    await this.triggerRepository.remove(trigger);
    await this.recordAudit({
      workspaceId,
      userId,
      action: AUDIT_ACTIONS.TRIGGER_DELETED,
      resourceId: id,
      type,
    });
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
    userId: string,
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
    await this.recordAudit({
      workspaceId,
      userId,
      action: AUDIT_ACTIONS.TRIGGER_NOTIFICATION_SECRET_ROTATED,
      resourceId: trigger.id,
      type: trigger.type,
    });
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
    userId: string,
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
    await this.recordAudit({
      workspaceId,
      userId,
      action: AUDIT_ACTIONS.TRIGGER_INTERACTION_TOKEN_REVOKED,
      resourceId: trigger.id,
      type: trigger.type,
    });
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
    userId: string,
  ): Promise<{
    rotatedAt: string;
    triggerId: string;
    chatChannelHealth: TriggerChatChannelHealth;
    botIdentity: { botId: number; username: string; teamId?: string } | null;
  }> {
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
    let result: SetupResult;
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
    // **컬럼 갱신이 끝난 뒤에 기록한다.** 위 6단계 중 어디서든 던지면 회전은 일어나지
    // 않은 것이고, 그때 감사 row 만 남으면 "회전됐다" 는 거짓 기록이 된다.
    await this.recordAudit({
      workspaceId,
      userId,
      action: AUDIT_ACTIONS.TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED,
      resourceId: trigger.id,
      type: trigger.type,
    });
    // [Spec Chat Channel §5.4] 성공 응답 3필드 동봉 — triggerId / chatChannelHealth
    // (setupChannel 재호출 결과) / botIdentity (getMe 캐시 갱신 결과, configUpdates 경유).
    return {
      rotatedAt: rotatedAt.toISOString(),
      triggerId: trigger.id,
      chatChannelHealth: 'healthy',
      botIdentity: mergedChannel.botIdentity ?? null,
    };
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

  /**
   * APP_URL 기반 webhook callback URL 조립. setupChatChannel / rotateChatChannelBotToken 공용.
   *
   * `app.url` 은 `common/config/app.config.ts` 가 `APP_URL` env 로부터 등록한 canonical key.
   * Telegram setWebhook 은 HTTPS 만 허용하므로 운영 env 는 반드시 https:// 로 시작해야 한다.
   */
  private buildCallbackUrl(endpointPath: string): string {
    const baseUrl =
      this.configService.get<string>('app.url') ?? 'http://localhost:3011';
    return `${baseUrl.replace(/\/$/, '')}/api/hooks/${endpointPath.replace(/^\//, '')}`;
  }

  /**
   * 24h grace 가 경과한 trigger 의 notification_secret_v2 → primary 승격.
   * 별도 scheduled job (NotificationSecretRotatorService) 이 매시간 호출.
   * trigger 단위 idempotent — v2 가 null 이면 no-op.
   *
   * [리뷰 C3 fix] 승격은 평문을 config 에 쓰지 않고 **secret store 의 canonical ref
   * 내용을 회전**한다 (`normalizeNotificationSecretRef` 와 동일 ref 규약). 과거 구현은
   * `signing.secret` 평문을 썼는데, 발송측 `resolveSigningSecret` 이 `secretRef` 우선이라
   * ref 보유 trigger 는 승격 후에도 구 secret 으로 서명을 지속했다 (rotation 무효).
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
      if (!notificationCfg || typeof notificationCfg !== 'object') {
        // [SUMMARY W-2] notification config 부재 trigger 에 v2 컬럼이 채워진 비정상 데이터.
        // 매 cron 주기 skip 으로 notification_secret_v2 평문이 DB 에 영구 잔류하지 않도록
        // v2/rotatedAt 를 클리어하고 경고 로그를 남긴다.
        this.logger.warn(
          `trigger ${trigger.id} has notificationSecretV2 but no notification config — clearing stale v2 columns`,
        );
        trigger.notificationSecretV2 = null;
        trigger.notificationRotatedAt = null;
        await this.triggerRepository.save(trigger);
        continue;
      }
      const signing = (notificationCfg as { signing?: unknown }).signing;

      const ref = buildSecretRef({
        scope: 'triggers',
        resourceId: trigger.id,
        name: 'notification-signing',
      });
      // ref 기존재 시 내용 회전, 부재 시 신규 생성 — rotate 가 upsert 시맨틱.
      await this.secrets.rotate(ref, trigger.workspaceId, secretV2);

      const updatedSigning: Record<string, unknown> = {
        ...(typeof signing === 'object' && signing !== null
          ? (signing as Record<string, unknown>)
          : {}),
        secretRef: ref,
      };
      // legacy 평문 키는 제거 — 평문은 DB config 에 남기지 않는다.
      delete updatedSigning.secret;
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

  /**
   * `(workspace_id, endpoint_path)` UNIQUE 위반을 **문서한 형태**로 바꿔 던진다.
   *
   * `2-trigger-list.md §3` 이 *"409 `RESOURCE_CONFLICT` (세부 코드
   * `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)"* 를 계약으로
   * 적어 뒀는데 **그 문자열이 저장소 어디에도 없었다** — 실제로는 전역 필터의
   * `isUniqueViolation` 분기가 `details` 없이 `RESOURCE_CONFLICT` 만 발행하고 있었다.
   * 즉 **문서한 보장이 구현보다 넓었다** (`review/consistency/2026/09/06/14_26_32`
   * Critical 1).
   *
   * 전역 분기는 어느 컬럼이 부딪혔는지 모르므로 여기서만 좁힐 수 있다. 다른 UNIQUE
   * 위반은 **그대로 흘려보낸다** — 삼키면 전역 매핑이 하던 일까지 이 자리가 가로챈다.
   */
  private rethrowEndpointPathConflict(err: unknown): never {
    if (isEndpointPathUniqueViolation(err)) {
      throw new ConflictException({
        code: 'RESOURCE_CONFLICT',
        message:
          '같은 워크스페이스에 그 엔드포인트 경로를 쓰는 트리거가 이미 있어요.',
        // **세부 코드는 `details.code` 다.**
        //
        // 두 번 좁혔다. 처음엔 봉투 top-level 에 `subCode` 를 실었는데
        // `GlobalExceptionFilter` 가 `code`·`message`·`requestId`·`details` 만 복사해
        // **wire 에 닿지 않았다**. 그래서 `details` 안으로 옮겼는데, 이번엔 `subCode` 라는
        // **저장소 유일 키**를 새로 만든 꼴이었다 — 도메인 세부 사유는 이미
        // `error-codes.md §4.2` 와 `trigger-parameter.types.ts` 가 **`code`** 로 쓴다
        // (`review/consistency/2026/09/06/14_59_49` W1).
        //
        // top-level `code` 를 특화 코드로 **교체**하는 선례도 7건 있으나, 이 자리는
        // spec 이 *"409 `RESOURCE_CONFLICT` (세부 코드 …)"* 라고 두 층을 나눠 적었으므로
        // 그 서술을 그대로 실현한다. 표현 방식의 정식화는 planner 항목으로 등재했다.
        details: {
          field: 'endpoint_path',
          code: 'TRIGGER_ENDPOINT_PATH_CONFLICT',
        },
      });
    }
    throw err;
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
