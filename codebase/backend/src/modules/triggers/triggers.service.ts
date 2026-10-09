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
import { EntityManager, In, Repository } from 'typeorm';
import {
  isPostgresUniqueViolation,
  pgErrorConstraint,
} from '../../common/db/pg-error';
import { randomBytes } from 'crypto';
import { Trigger, TriggerChatChannelHealth } from './entities/trigger.entity';
import {
  acquireTriggerConfigLock,
  rewriteTriggerConfigLocked,
  TRIGGER_DELETE_LOCK_TIMEOUT_MS,
} from './trigger-config-lock';
import { Execution } from '../executions/entities/execution.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { ScheduleRunnerService } from '../schedules/schedule-runner.service';
import { AuthConfig } from '../auth-configs/entities/auth-config.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { CreateTriggerDto } from './dto/create-trigger.dto';
import { UpdateTriggerDto } from './dto/update-trigger.dto';
import {
  NotificationConfigDto,
  validateNotificationUrl,
} from './dto/notification-config.dto';
import { InteractionConfigDto } from './dto/interaction-config.dto';
import { ChannelAdapterRegistry } from '../chat-channel/channel-adapter.registry';
import { ChatChannelConfig, SetupResult } from '../chat-channel/types';
import {
  chatChannelSecretRef,
  pinChatChannelSecretRefs,
} from '../chat-channel/chat-channel-secret-refs';
import {
  SecretResolverService,
  SecretWorkspaceMismatchError,
} from '../secret-store/secret-resolver.service';
import { buildSecretRef } from '../secret-store/secret-ref';
import { notificationSigningSecretRef } from './notification-signing-secret-ref';
import {
  decideNotificationSigning,
  newNotificationSigningSecret,
  notificationWithSigningRef,
  signingWithRef,
} from './notification-signing-secret';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { omitUndefined } from '../../common/utils/omit-undefined';
import { redactSecrets } from '../../shared/utils/sanitize-error-message';
import { assertReferenceInScope } from '../../common/utils/reference-in-scope';
import { ErrorCode } from '../../nodes/core/error-codes';
import {
  assertChatChannelAlreadySetUp,
  assertChatChannelInputSafe,
  stripChatChannelPlaintext,
  translateSetupChannelError,
  extractInboundSigningRef,
} from './chat-channel-input-rules';
import type { ChatChannelInput } from './chat-channel-input-rules';
import { assertConfigCarriesNoInternalFields } from './trigger-config-internal-fields';
import { buildTriggerCallbackUrl } from './trigger-callback-url';
import { ChatChannelBinderService } from './chat-channel-binder.service';
import { TriggerResourceReleaserService } from './trigger-resource-releaser.service';

export type TriggerDetail = Trigger & {
  cronExpression?: string;
  timezone?: string;
  nextRunAt?: Date | null;
};

/**
 * 생성 · PATCH 응답이 한 번만 싣는 일회성 평문. 서버가 첫 알림 서명 시크릿을 발급한 응답에만 있고
 * 그 밖의 응답에는 키가 없다([HTTP API 규약 §5.5](CLE-API-CONV#55-부재-표현-null-과-키-생략) 기준 (b)).
 * 근거: [트리거 관리 「API」](CLE-TRIG-MANAGE#api), [시크릿 저장소 「규칙」](CLE-INT-SECRET#규칙) 규칙 4.
 */
export interface TriggerIssuedSecrets {
  notificationSigningSecret: string;
}

export type TriggerWithIssuedSecrets = Trigger & {
  secrets?: TriggerIssuedSecrets;
};

/** `settleNotificationSigning` 의 결과. 저장할 `config` 와, 발급했으면 일회성 평문, 시크릿 저장소에 썼는지. */
interface SettledNotificationSigning {
  config: Record<string, unknown>;
  issuedSecret?: string;
  wroteSecret: boolean;
}

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
 * [시크릿 저장소 「규칙」](CLE-INT-SECRET#규칙) 이 응답 노출을
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

/** 축 3 — `config.interaction`. 발급된 평문 `triggerToken` 을 뺀다. */
function stripInteractionSecrets(
  interaction: Record<string, unknown>,
): Record<string, unknown> {
  return omitKeys(interaction, INTERACTION_RESPONSE_STRIP_KEYS);
}

/**
 * 축 2 — `config.notification.signing`. 감싸는 `notification` 을 통째로 새로 만들어
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
 * 응답에서 값을 가릴 **진단 원문 컬럼**. 비밀 필드가 아니라 실패 원인을 담은 텍스트라 지우지
 * 않고 값 안의 자격 증명 모양만 가린다(`TRIGGER_RESPONSE_STRIP_COLUMNS` 와 갈래가 다르다).
 * 어댑터 · 알림 발송 실패 원문(프로바이더 응답 포함)이 그대로 저장되는 필드다.
 */
const TRIGGER_RESPONSE_REDACT_COLUMNS = [
  'chatChannelLastError',
  'notificationLastError',
] as const satisfies readonly (keyof Trigger)[];

/**
 * 진단 원문의 응답 마스킹. `redactSecrets`(값 패턴)를 걸어 자격 증명 모양만 `***` 로 바꾼다.
 * 자르지 않는다. **제자리 변형**이라 정화 *사본*에만 부른다. 저장값은 원문으로 남는다.
 */
function redactDiagnosticColumns(target: Record<string, unknown>): void {
  for (const column of TRIGGER_RESPONSE_REDACT_COLUMNS) {
    const value = target[column];
    if (typeof value === 'string') target[column] = redactSecrets(value);
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
 * `endpoint_path` 충돌을 뜻하는 `unique_violation` 의 이름 둘.
 *
 * - `idx_trigger_endpoint_path` — `V132__trigger_endpoint_path_global_unique.sql` 의 partial
 *   unique(`WHERE endpoint_path IS NOT NULL`). 수신 URL `/api/hooks/:endpointPath` 가
 *   워크스페이스 무관 전역 라우팅 키라 유일성도 전역이다 — V002 의 워크스페이스 단위
 *   `idx_trigger_workspace_endpoint` 는 다른 워크스페이스가 알고 있는 경로를 등록하는 것을
 *   막지 못해 V132 가 교체했다(`spec/1-data-model.md` Rationale «Webhook `endpoint_path` 전역
 *   유일»). 같은 워크스페이스의 살아 있는 트리거와 겹칠 때 걸린다.
 * - `webhook_endpoint_reservation_owner` — **실재 제약이 아니라** V133 의 예약 트리거
 *   (`trg_trigger_reserve_endpoint_path`)가 `RAISE … USING CONSTRAINT` 로 붙이는 라벨. 다른
 *   워크스페이스가 예약한 경로(지금 쓰든, 지웠든, 바꿨든)를 쓸 때 걸린다. BEFORE 트리거라 다른
 *   워크스페이스의 **살아 있는** 트리거와 겹칠 때도 인덱스보다 이쪽이 먼저다 — 이 이름을 모르면
 *   그 흔한 경우가 500 으로 나간다(`spec/1-data-model.md` §2.8.1).
 *
 * **이름으로 좁힌다**: SQLSTATE 23505 만 보면 이 테이블의 다른 UNIQUE 위반까지 `endpoint_path`
 * 충돌로 오보한다. 이름이 바뀌면 이 술어는 **조용히 false 를 돌려주고** 전역
 * `RESOURCE_CONFLICT` 로 되돌아간다 — 안전한 방향이지만 계약이 조용히 좁아지므로, 이름을 상수로
 * 고정하고 단위 테스트가 두 방향(맞는 이름 → 좁힘 / 다른 이름 → 통과)을 모두 문다.
 */
const TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES: ReadonlySet<string> = new Set([
  'idx_trigger_endpoint_path',
  'webhook_endpoint_reservation_owner',
]);

/**
 * **SQLSTATE·인덱스명 추출은 `common/db/pg-error.ts` 가 SoT 다.** 첫 판은 여기서
 * `err.driverError?.code` 를 손으로 읽었는데, 그것은 저장소의 **4번째 사본**이었고
 * 게다가 **한 표면만** 봤다 — TypeORM 은 호출 경로(raw / `insert` / `save`)에 따라
 * wrap 깊이가 달라서 `err.code` 로 올라오는 경우가 있고, SoT 는 정확히 그 이유로
 * 두 표면을 모두 흡수한다 (`review/code/2026/09/06/14_59_48` W1).
 */
export function isEndpointPathUniqueViolation(err: unknown): boolean {
  if (!isPostgresUniqueViolation(err)) return false;
  const name = pgErrorConstraint(err);
  return name !== undefined && TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES.has(name);
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
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    private readonly channelAdapterRegistry: ChannelAdapterRegistry,
    private readonly configService: ConfigService,
    private readonly secrets: SecretResolverService,
    private readonly auditLogsService: AuditLogsService,
    private readonly scheduleRunner: ScheduleRunnerService,
    private readonly chatChannelBinder: ChatChannelBinderService,
    private readonly resourceReleaser: TriggerResourceReleaserService,
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

  /**
   * 없으면 `RESOURCE_NOT_FOUND` 로 던진다 — **이 문구가 사는 유일한 자리.**
   *
   * 같은 리터럴이 네 곳으로 늘었었다(`findById` · `findByIdForPatchValidation` · 창 1 의 삭제 경합 ·
   * `rotateBotToken` 의 삭제 경합). 이 PR 이 스스로 반복해 적은 *"복제가 drift 를 부른다"* 와
   * 정면으로 어긋나는 상태였다 (`/ai-review` `review/code/2026/09/14/20_49_15`
   * maintainability WARNING#5).
   */
  private assertTriggerFound(row: Trigger | null | undefined): Trigger {
    if (!row) this.throwTriggerNotFound();
    return row;
  }

  /**
   * 락 안에서 재읽은 `config` 의 **하위 키를 기준으로** 병합한다.
   *
   * ## 왜 이게 따로 필요한가 — 같은 실수를 두 번 했다
   *
   * 1라운드에 *"컨테이너만 다시 읽는 것으로는 부족하다"* 고 직접 적어 놓고, 7라운드에 새로
   * 닫은 자리에서 **그대로 반복**했다: `(freshConfig) => ({ ...freshConfig, notification: X })`
   * 에서 `X` 를 **락 이전 스냅샷**으로 만들어 넘긴 것이다. 최상위 키는 재읽기로 지켜지지만
   * 그 하위(`notification.url` 등)는 옛 값으로 되돌아간다 — 이 PR 이 닫는 것과 같은 클래스다
   * (`/ai-review` `review/code/2026/09/14/22_24_35` database·testing CRITICAL#1).
   *
   * 그래서 «어느 하위 키를, 무엇을 얹어» 를 **인자로 강제**한다. 호출부가 스냅샷 객체를
   * 통째로 대입할 자리를 없애는 것이 요점이다.
   *
   * @param freshConfig 락 안에서 재읽은 `config` 전체.
   * @param key 재읽은 `config` 에서 기준으로 삼을 하위 키.
   * @param patch 그 하위 객체 **위에** 얹을 필드들.
   * @param fallback 재읽은 행에 그 키가 없을 때의 기준(보통 요청 시작 시점 값).
   */
  private mergeIntoFreshSubKey(
    freshConfig: Record<string, unknown>,
    key: string,
    patch: Record<string, unknown>,
    fallback: Record<string, unknown>,
  ): Record<string, unknown> {
    const current = freshConfig?.[key];
    const base =
      typeof current === 'object' && current !== null
        ? (current as Record<string, unknown>)
        : fallback;
    return { ...freshConfig, [key]: { ...base, ...patch } };
  }

  /**
   * «없다» 를 그대로 던진다 — 검증할 행이 아예 없는 자리용.
   *
   * 종전엔 `assertTriggerFound(null)` 로 불렀는데, 그건 «주어진 행을 검증한다» 는 계약을
   * 인자로 우회하는 것이라 다음 사람이 읽을 때 오해한다
   * (`/ai-review` `review/code/2026/09/14/21_18_21` maintainability INFO#6).
   */
  private throwTriggerNotFound(): never {
    throw new NotFoundException({
      code: 'RESOURCE_NOT_FOUND',
      message: 'Trigger not found',
    });
  }

  /** `config.interaction` 이 객체이고 전략이 `per_trigger` 인가. 트리거 단위 토큰은 이때만 의미가 있다. */
  private isPerTriggerInteraction(
    interaction: unknown,
  ): interaction is Record<string, unknown> {
    return (
      typeof interaction === 'object' &&
      interaction !== null &&
      (interaction as { tokenStrategy?: unknown }).tokenStrategy ===
        'per_trigger'
    );
  }

  private throwNotPerTriggerStrategy(): never {
    throw new BadRequestException({
      code: 'NOT_PER_TRIGGER_STRATEGY',
      message:
        'Trigger 의 interaction.tokenStrategy 가 "per_trigger" 가 아닙니다.',
    });
  }

  async findById(id: string, workspaceId: string): Promise<Trigger> {
    return this.assertTriggerFound(
      await this.triggerRepository.findOne({
        where: { id, workspaceId },
        relations: { workflow: true },
      }),
    );
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
  ): Promise<TriggerWithIssuedSecrets> {
    // notification/interaction/chatChannel 은 Trigger entity 의 1급 컬럼이 아니라 `config` JSONB.
    // (영속 컬럼은 health/secret rotation 추적용 9개만; spec EIA §7.1 + spec CCH §4.2).
    const { notification, interaction, chatChannel, config, ...rest } = dto;
    this.assertNotificationUrlSafe(notification);
    assertChatChannelInputSafe(chatChannel, 'create');
    // 원시 `config` 는 `@IsObject` 뿐이라 위 타입 필드 검사를 지나친다(CLE-T-M9QKKX).
    assertConfigCarriesNoInternalFields(config);
    // 연결 워크플로는 같은 워크스페이스의 것만 — 실행 엔진은 워크플로를 id 로만 읽어, 종전엔 다른 워크스페이스의 워크플로가
    // 이 트리거로 그쪽 실행으로 돌았다(spec 1-data-model §1.1).
    await assertReferenceInScope(
      this.workflowRepository,
      { id: rest.workflowId, workspaceId },
      'workflowId',
      'Workflow not found in this workspace',
    );
    // authConfigId 가 주어지면 같은 워크스페이스의 AuthConfig 인지 검증 (cross-workspace 차단).
    if (rest.authConfigId) {
      await this.assertAuthConfigInWorkspace(rest.authConfigId, workspaceId);
    }
    // [SS-SE-01] mergeExternalConfig 호출 전 plaintext (botToken / inboundSigningPlaintext)
    // 를 strip — 첫 triggerRepository.save 시 plaintext 가 DB JSONB 에 일시 기록되지 않도록.
    // setupChatChannel 은 원본 dto.chatChannel (plaintext 포함) 을 별도 전달 받아 secret store
    // 로 옮긴 뒤 ref 만 config 에 반영.
    const safeChatChannel = chatChannel
      ? stripChatChannelPlaintext(chatChannel)
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
    // `config.notification` 이 있으면 알림 서명 시크릿을 정한다 — 원시 `config` 로 보낸 평문은 시크릿 저장소로
    // 옮기고, 평문이 없으면 서버가 첫 시크릿을 발급한다(NERV Task `CLE-T-M6PERB`).
    const issuedSecret = await this.settleCreatedNotificationSigning(saved);
    let result = saved;
    // Chat Channel 어댑터 setup — CCH-AD-02.
    if (chatChannel) {
      await this.chatChannelBinder.setupChatChannel(saved, chatChannel, {
        storeUserSuppliedSecrets: true,
      });
      // setupChatChannel 은 별도 `rewriteTriggerConfigLocked`(락 안 재읽기·머지) 로 botTokenRef / inboundSigningRef /
      // chatChannelHealth 등을 갱신. in-memory `saved` 는 그 update 를 모르므로 응답 stale
      // 회귀 (hasBotToken=false). 재조회로 최신 상태 반영.
      const refreshed = await this.triggerRepository.findOne({
        where: { id: saved.id, workspaceId },
      });
      if (refreshed) result = refreshed;
    }
    return this.withIssuedSecrets(
      this.sanitizeForResponse(result),
      issuedSecret,
    );
  }

  /**
   * 정화한 응답에 일회성 평문을 얹는다. 발급하지 않았으면 키를 싣지 않는다.
   * 근거: [트리거 관리 「API」](CLE-TRIG-MANAGE#api), [시크릿 저장소 「규칙」](CLE-INT-SECRET#규칙) 규칙 4.
   */
  private withIssuedSecrets(
    sanitized: Trigger,
    notificationSigningSecret: string | undefined,
  ): TriggerWithIssuedSecrets {
    if (notificationSigningSecret === undefined) return sanitized;
    return { ...sanitized, secrets: { notificationSigningSecret } };
  }

  /**
   * 생성한 트리거의 알림 서명 시크릿을 정한다 — 발급했으면 평문을 돌려준다.
   *
   * 근거: [EIA 알림 웹훅 「시크릿 교체」](CLE-EIA-NOTIFY#시크릿-교체), [시크릿 저장소 「규칙」](CLE-INT-SECRET#규칙).
   * 판정은 `decideNotificationSigning` 이다 — 원시 `config` 의 평문은 옮기고(`migrate`) 없으면 발급한다
   * (`issue`). 종전의 `normalizeNotificationSecretRef` 는 평문 이전만 했고 발급하지 않아 호출자가 평문을 보내지
   * 않은 트리거에는 주 시크릿이 없었다.
   *
   * **판정 · 시크릿 저장소 쓰기 · `config` 쓰기를 한 트리거 설정 잠금 안에서, 같은 트랜잭션으로 한다.** PATCH 와
   * 같은 규율이다(판정을 잠금 밖에서 하면 동시 요청이 각자 발급해 한쪽 응답의 평문이 쓸모없어진다). 잠금 · 재읽기 ·
   * 0행 판정은 `rewriteTriggerConfigLocked` 가 하고, 시크릿 쓰기는 그 트랜잭션의 매니저로 한다. 그래서 풀 연결을 더
   * 빌리지 않고 쓰기가 던지면 시크릿 쓰기도 함께 롤백된다.
   *
   * 던지지 않고 행만 사라진 경우는 롤백되지 않는다. FK CASCADE 는 advisory lock 을 거치지 않아 `config` 쓰기가 0행일
   * 수 있고, 그때는 시크릿 쓰기가 이미 커밋됐으므로 커밋 뒤 비밀을 되돌린다(시크릿 저장소 규칙 9).
   */
  private async settleCreatedNotificationSigning(
    saved: Trigger,
  ): Promise<string | undefined> {
    const savedNotification = (saved.config as { notification?: unknown })
      ?.notification;
    if (!savedNotification || typeof savedNotification !== 'object') {
      return undefined;
    }
    // 병합이 잠금 안에서 부르는 콜백이라 결과를 바깥으로 꺼낼 자리가 필요하다. 잠금 · 재읽기 · 부재 처리 ·
    // 0행 판정은 `rewriteTriggerConfigLocked` 가 한다.
    const result: { settled?: SettledNotificationSigning } = {};
    const wrote = await rewriteTriggerConfigLocked(
      this.triggerRepository.manager,
      saved.id,
      async (freshConfig, { manager, fresh }) => {
        result.settled = await this.settleNotificationSigning(
          manager,
          fresh,
          freshConfig,
        );
        return result.settled.config;
      },
    );
    if (!wrote || !result.settled) {
      // 행이 사라졌다. 시크릿을 쓴 뒤였으면 커밋 뒤 되돌린다(시크릿 저장소 규칙 9). 쓰기 전이었으면 되돌릴 것이 없다.
      if (result.settled?.wroteSecret) {
        await this.resourceReleaser.undoAbsentWrite(
          saved.id,
          undefined,
          'TriggersService.settleCreatedNotificationSigning',
        );
      }
      return undefined;
    }
    // 호출부가 이 엔티티를 응답에 쓰므로 in-memory 도 맞춰 둔다.
    saved.config = result.settled.config;
    return result.settled.issuedSecret;
  }

  /**
   * 잠금 안에서 다시 읽은 행(`fresh`)을 보고 `config.notification.signing` 을 정한다. 시크릿 저장소 쓰기를
   * 하고 새 `config` 를 돌려준다 — 호출부가 같은 잠금 안에서 그 `config` 를 쓴다.
   *
   * | 결정 | 시크릿 저장소 | `signing` |
   * |---|---|---|
   * | `rederive` | 쓰지 않는다 | `secretRef` 를 트리거 id 로 다시 만든다(행의 값을 복사하지 않는다) |
   * | `migrate` | 행의 옛 평문을 정식 참조에 쓴다 | `secretRef` 를 싣고 옛 평문 키를 뺀다 |
   * | `issue` | 새 `wsk_*` 를 정식 참조에 쓴다 | 위와 같다. 평문을 `issuedSecret` 으로 돌려준다 |
   *
   * @param manager 설정 잠금을 쥔 트랜잭션의 매니저. 시크릿 저장소 쓰기를 같은 트랜잭션에서 하려고
   *   `SecretResolverService.rotate` 에 넘긴다 — 넘기지 않으면 풀에서 연결을 하나 더 빌려 잠금 보유자가 연결 둘을
   *   쥔다. 같은 트랜잭션이므로 뒤따르는 `config` 쓰기가 실패하면 시크릿 쓰기도 함께 롤백된다.
   * @param fresh 판정의 기준이 되는 행(잠금 안 재읽기). 저장된 `notification` 을 여기서 읽는다.
   * @param nextConfig 저장할 `config`. 그 `notification` 위에 `signing` 을 얹는다. PATCH 면 요청 바디로
   *   통째로 바뀐 값이고 생성이면 저장된 값 그대로다.
   */
  private async settleNotificationSigning(
    manager: EntityManager,
    fresh: Trigger,
    nextConfig: Record<string, unknown>,
  ): Promise<SettledNotificationSigning> {
    const ref = notificationSigningSecretRef(fresh.id);
    const decision = decideNotificationSigning(
      (fresh.config as { notification?: unknown } | null)?.notification,
    );
    let issuedSecret: string | undefined;
    if (decision.kind === 'migrate') {
      await this.secrets.rotate(
        ref,
        fresh.workspaceId,
        decision.plaintext,
        manager,
      );
    } else if (decision.kind === 'issue') {
      issuedSecret = newNotificationSigningSecret();
      await this.secrets.rotate(ref, fresh.workspaceId, issuedSecret, manager);
    }
    return {
      // 옛 평문 키는 남기지 않는다 — 평문은 시크릿 저장소에만 둔다(규칙 14).
      config: {
        ...nextConfig,
        notification: notificationWithSigningRef(nextConfig.notification, ref),
      },
      issuedSecret,
      wroteSecret: decision.kind !== 'rederive',
    };
  }

  /**
   * PATCH 결과의 `interaction` 에 트리거 단위 토큰을 정한다.
   *
   * 근거: [트리거 관리 「PATCH 본문 계약」](CLE-TRIG-MANAGE#patch-본문-계약). 결과 전략이 `per_trigger` 면
   * 잠금 안에서 다시 읽은 행의 토큰을 이어받고 아니면 지운다. 다른 전략으로 바꾼 동안 남겨 두면 `per_trigger` 로
   * 되돌릴 때 이미 폐기했다고 여긴 영구 토큰이 재발급 없이 다시 유효해진다. 지웠으면 커밋 뒤 그 토큰으로 연 SSE
   * 스트림을 닫아야 하므로 `dropped` 로 알린다.
   */
  private settleTriggerToken(
    fresh: Trigger,
    nextConfig: Record<string, unknown>,
  ): { config: Record<string, unknown>; dropped: boolean } {
    const storedToken = (
      (fresh.config as { interaction?: { triggerToken?: unknown } } | null)
        ?.interaction ?? {}
    ).triggerToken;
    const hasStoredToken =
      typeof storedToken === 'string' && storedToken.length > 0;
    // 요청 본문의 `interaction: null` 은 검증을 통과해(`@IsOptional()`) 여기까지 온다. 객체가 아니면 그 값을
    // 그대로 저장한다(종전 동작) — 빈 객체로 바꿔 저장하지 않는다. 저장된 토큰은 그 값과 함께 사라지므로 지웠다고
    // 알려 커밋 뒤 스트림을 닫게 한다.
    const requested = nextConfig.interaction;
    if (typeof requested !== 'object' || requested === null) {
      return { config: nextConfig, dropped: hasStoredToken };
    }
    const nextInteraction: Record<string, unknown> = {
      ...(requested as Record<string, unknown>),
    };
    if (nextInteraction.tokenStrategy === 'per_trigger' && hasStoredToken) {
      nextInteraction.triggerToken = storedToken;
      return {
        config: { ...nextConfig, interaction: nextInteraction },
        dropped: false,
      };
    }
    delete nextInteraction.triggerToken;
    return {
      config: { ...nextConfig, interaction: nextInteraction },
      dropped: hasStoredToken,
    };
  }

  /**
   * PATCH 가 `interaction` · `notification` 을 실었을 때 **서버가 만드는 두 값**을 잠금 안에서 정한다.
   *
   * top-level `interaction` · `notification` 은 두 값을 입력으로 받지 않으므로(받으면 전역 검증 파이프가 400) 통째
   * 교체가 그대로 지우던 자리다. 근거: [트리거 관리 「PATCH 본문 계약」](CLE-TRIG-MANAGE#patch-본문-계약).
   *
   * - `interaction` → {@link settleTriggerToken}. 토큰을 지웠으면 `droppedTriggerToken` 으로 알려 커밋 뒤 스트림을 닫게 한다.
   * - `notification` → {@link settleNotificationSigning}. 첫 시크릿을 발급했으면 `issuedSecret` 으로 일회성 평문을 돌려준다.
   *   `notification: null` 은 객체가 아니라 서명을 얹을 자리가 없다 — 껍데기를 만들어 시크릿을 발급하지 않고 종전처럼
   *   그 값을 저장한다.
   *
   * 요청이 싣지 않은 쪽은 건드리지 않는다. 이 함수는 `m` 으로 시크릿 저장소에 쓸 수 있으므로 잠금을 쥔 트랜잭션
   * 안에서만 부른다.
   *
   * @param input.config 요청을 병합한 뒤의 `config`. 그 위에 두 값을 얹은 새 `config` 를 돌려준다.
   * @param input.requestedInteraction 요청 바디의 `interaction`. 싣지 않았으면 `undefined`.
   * @param input.requestedNotification 요청 바디의 `notification`. 싣지 않았으면 `undefined`.
   */
  private async applyServerManagedEiaValues(
    m: EntityManager,
    target: Trigger,
    input: {
      config: Record<string, unknown>;
      requestedInteraction: unknown;
      requestedNotification: unknown;
    },
  ): Promise<{
    config: Record<string, unknown>;
    issuedSecret?: string;
    droppedTriggerToken: boolean;
  }> {
    let config = input.config;
    let droppedTriggerToken = false;
    let issuedSecret: string | undefined;
    if (input.requestedInteraction !== undefined) {
      const settled = this.settleTriggerToken(target, config);
      config = settled.config;
      droppedTriggerToken = settled.dropped;
    }
    const nextNotification = config.notification;
    if (
      input.requestedNotification !== undefined &&
      typeof nextNotification === 'object' &&
      nextNotification !== null
    ) {
      const settled = await this.settleNotificationSigning(m, target, config);
      config = settled.config;
      issuedSecret = settled.issuedSecret;
    }
    return { config, issuedSecret, droppedTriggerToken };
  }

  /**
   * `update()` 전용 — **검증에만 쓰는 가벼운 조회.**
   *
   * `findById` 는 `relations: { workflow: true }` 를 싣는데, `update()` 의 사전 검증(타입 분기 ·
   * chatChannel 설정 여부 · 인증 설정)은 그 관계를 한 번도 보지 않는다. 저장·응답에 쓰이는
   * 엔티티는 **락 안에서 다시 읽으므로**, 여기서 조인을 한 번 더 하면 PATCH 마다 같은 JOIN
   * SELECT 가 두 번 돈다 (`/ai-review` `review/code/2026/09/14/20_17_16` performance WARNING#1).
   *
   * **한때 이름이 `findByIdForUpdate` 였다.** 이 저장소에서 `FOR UPDATE` 는 **진짜 행 잠금**을
   * 뜻하는 SQL 관용구이고 7개 파일이 그 뜻으로 쓴다(execution-engine · webauthn ·
   * integration-oauth 등). 이 메서드는 아무것도 잠그지 않으므로, 락 부재가 결함이었던 바로 그
   * 코드에서 이름이 반대를 말하고 있었다 (`--impl-done`
   * `review/consistency/2026/09/15/01_44_29` naming_collision W4).
   *
   * 접미 패턴은 `AuthConfigsService.findByIdForResponse` 를 따랐다. 제안받은
   * `…ForPatchPrecheck` 는 **쓰지 않았다** — `Precheck` 은 이 저장소에서 Cafe24/MakeShop
   * mall-id 사전검증 전용 어휘라(`PrecheckResultDto` · `MallIdPrecheck` 등) 같은 클래스의
   * 거짓 연상을 다른 이름으로 다시 만든다.
   */
  private async findByIdForPatchValidation(
    id: string,
    workspaceId: string,
  ): Promise<Trigger> {
    return this.assertTriggerFound(
      await this.triggerRepository.findOne({ where: { id, workspaceId } }),
    );
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateTriggerDto,
    userId: string,
  ): Promise<TriggerWithIssuedSecrets> {
    const trigger = await this.findByIdForPatchValidation(id, workspaceId);
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
    assertChatChannelInputSafe(chatChannel, 'update');
    assertConfigCarriesNoInternalFields(config);
    // [R-CC-21 / D-1] `chatChannel` 이 실린 PATCH 는 비밀을 받지 않으므로, **최초 setup 을
    // PATCH 로 할 수 없다** — bot token 을 실어 보낼 방법이 없다. 그런데 그냥 두면
    // `setupChannel` 이 secret store 에서 토큰을 못 찾아 실패하고, 그 실패는 CCH-SE-01 의
    // best-effort catch 가 삼켜 `chatChannelHealth=degraded` 로 **조용히** 앉는다.
    // R-CC-21 이 경고한 *"실패가 보이는 형태에서 조용한 형태로 바뀐다"* 와 같은 함정이라
    // 여기서 명시적으로 400 을 낸다. 최초 setup 은 생성 POST 한정 (§5.4.1 표 1행).
    if (chatChannel) {
      assertChatChannelAlreadySetUp(trigger, chatChannel);
    }
    // [ref 보존] `mergeExternalConfig` 가 `config.chatChannel` 을 통째로 교체하기 **전에**
    // 집어 둔다. `botTokenRef` 는 trigger id 로 재유도되지만 `inboundSigningRef` 는 그렇지
    // 않아, 여기서 안 집으면 slack/discord PATCH 마다 사라진다 → 인입 서명 검증 fail-open.
    //
    // **락 안에서 다시 집는다**(아래 창 1). 여기서 집는 값은 요청 시작 시점의 것이라, 동시
    // 요청이 그 사이 ref 를 처음 확립하면 `undefined` 다 — 그러면 창 1 이 `chatChannel` 을
    // 통째로 교체하며 ref 를 지우고, binder 의 재읽기는 **자기 자신이 방금 쓴 값**(ref 없음)을
    // 보게 되어 보존 게이트가 거짓이 된다. 즉 두 쓰기가 한 요청 안에서 서로를 가린다.
    let previousInboundSigningRef = extractInboundSigningRef(trigger.config);
    // authConfigId 를 새로 set 하는 경우 같은 워크스페이스의 AuthConfig 인지 검증.
    // null 로 set (인증 제거) 은 검증 대상 아님.
    if (rest.authConfigId) {
      await this.assertAuthConfigInWorkspace(rest.authConfigId, workspaceId);
    }
    // [SS-SE-01] mergeExternalConfig 호출 전 plaintext strip (create() 와 동일 정책).
    const safeChatChannel = chatChannel
      ? stripChatChannelPlaintext(chatChannel)
      : undefined;
    // `rest` 의 `undefined` 필드(보내지 않은 optional 필드)를 뺀다 — 이유는 `omitUndefined`
    // JSDoc. `PATCH /api/triggers/:id` 응답에 `name` 이 없던 원인이고, §5.4 계약 대조를 그
    // 경로로 넓히자 드러났다 (`review/code/2026/09/05/21_40_37` W1).
    const defined = omitUndefined(rest);

    // ── 창 1 — 병합과 저장을 **같은 advisory lock 안에서** 한다 ────────────────────────
    //
    // 종전엔 요청 시작 시점의 `trigger.config` 스냅샷으로 병합해 `save` 했다. 그래서
    // **`chatChannel` 을 아예 싣지 않은 PATCH**(이름 변경 등)조차 동시 요청이 방금 확립한
    // `chatChannel.inboundSigningRef` 를 옛 값으로 되돌려, 이 PR 이 닫으려는 fail-open 이
    // 그대로 재현됐다 (`/ai-review` `review/code/2026/09/14/18_17_44` security CRITICAL#1).
    // `Trigger` 에는 `@VersionColumn` 도 없어 낙관적 락으로 막히지도 않는다.
    //
    // **`save(trigger)` 는 그대로 둔다.** 종전에 이 자리를 `update` + 재조회로 바꿨다가
    // 되돌린 이력이 있다 — 반환 엔티티·subscriber·`endpointPath` UNIQUE 충돌 경로의 의미가
    // 함께 달라져 단위 **6개 케이스가 RED** 였다. 여기서 바꾸는 것은 «어느 `config` 위에
    // 병합하는가» 와 «그 구간이 직렬화되는가» 뿐이고, 저장 동사는 건드리지 않는다.
    //
    // 이 구간에 외부 호출이 없다는 것이 락을 여기 둘 수 있는 근거다 — 검증·순수 병합뿐이고
    // `setupChatChannel` 은 저장 **뒤**에 온다 (`trigger-config-lock.ts` JSDoc 의 제약).
    // 예외로 알림 서명 시크릿의 첫 발급 · 옛 평문 이전은 이 잠금 안에서 시크릿 저장소에 쓴다. 지금 백엔드는
    // 같은 DB 의 `secret_store` 테이블이라 HTTP 호출이 아니다([트리거 관리 「동시 쓰기 직렬화」](CLE-TRIG-MANAGE#동시-쓰기-직렬화)).
    // 이 트랜잭션의 매니저로 써서 풀 연결을 더 빌리지 않고, 저장이 실패하면 시크릿 쓰기도 함께 롤백된다.
    const { saved, issuedSecret, droppedTriggerToken } =
      await this.triggerRepository.manager
        .transaction(async (m) => {
          await acquireTriggerConfigLock(m, trigger.id);
          // 락을 잡은 뒤의 행이 «커밋된 최신 상태» 다. 요청이 `config` 를 통째로 보냈으면
          // 그것이 사용자의 의도이므로 그대로 쓰고, 아니면 **재읽은 행**을 기준으로 삼는다.
          //
          // **`findById` 와 같은 관계를 싣는다.** 아래에서 이 엔티티가 저장 대상이자 응답의
          // 원본이 되므로, 관계를 빼고 읽으면 `chatChannel` 없는 PATCH 응답에서만 `workflow`
          // 가 사라진다 — `TriggerDto.workflow` 가 *"생성 응답에만 없다"* 고 보장하는 자리다.
          const fresh = await m.findOne(Trigger, {
            where: { id: trigger.id, workspaceId },
            relations: { workflow: true },
          });
          // 보존 게이트의 **첫 항**도 재읽은 행에서 온다 — 위 선언의 註 참조.
          previousInboundSigningRef =
            extractInboundSigningRef(fresh?.config) ??
            previousInboundSigningRef;
          // notification/interaction/chatChannel 이 명시된 경우만 config 안의 해당 키를 교체.
          const baseConfig = this.stripInlineAuthKeys(
            config ?? fresh?.config ?? trigger.config ?? {},
          );
          let mergedConfig = this.mergeExternalConfig(
            baseConfig,
            notification,
            interaction,
            safeChatChannel,
          );
          // **재읽은 행이 저장의 기준이다 — 저장 대상 자체는 아래에서 부분 객체로 좁힌다.**
          // 요청 시작 시점의 `trigger` 를 기준으로 삼으면 `config` 밖의 컬럼
          // (`chatChannelHealth`·`chatChannelLastError`·`chatChannelSetupAt`·
          // `chatChannelRotatedAt`·`chatChannelTokenV2`)이 **pre-lock 스냅샷 값으로 되돌아갔다**.
          // 같은 락을 공유하는 형제 창(`rotateBotToken`·binder)이 방금 커밋한 부분 UPDATE 를
          // 이 저장이 조용히 덮는 것이었다
          // (`/ai-review` `review/code/2026/09/14/19_07_43` database WARNING#2). 그 뒤 «재읽은
          // 엔티티를 통째로 저장» 으로 막았는데 락 **밖** 쓰기에는 뚫려 있었고, 지금은 아래
          // «저장 대상은 이 요청이 바꾸는 필드뿐» 이 두 경로를 함께 막는다.
          //
          // **행이 사라졌으면 저장하지 않는다.** `save(entity)` 는 PK 로 재조회해 행이 없으면
          // **INSERT** 한다 — 그 사이 삭제된 트리거를 같은 id 로 되살리는 것이다. 삭제 경로는 외부 해제
          // (BullMQ job · provider teardown · listener)를 행 삭제 **전에** 끝내고 비밀은 커밋 **뒤에**
          // 지우므로(spec 트리거 목록 §4.3), 되살아난 행은 그 어느 것도 되돌리지 못한 **고아**가 된다.
          //
          // 이 경로는 이 PR 이 만든 것이 아니다 — `origin/main` 의 `save(trigger)` 도 같은 호출
          // 형태다. 다만 이 PR 이 형제 세 창을 «행이 없으면 쓰지 않고 `false`» 로 만들어 **비대칭**
          // 이 생겼고, 여기는 이미 재읽기를 하고 있으니 같은 규율로 닫는 것이 자연스럽다
          // (`/ai-review` `review/code/2026/09/14/19_44_08` side_effect·concurrency CRITICAL#1).
          // **반환값을 받는다** — 메서드 호출은 타입을 좁혀 주지 않는다(assertion 함수가
          // 아니므로). 헬퍼가 값을 돌려주는 형태인 이유가 이것이다.
          const target = this.assertTriggerFound(fresh);
          // **서버가 만든 EIA 값은 재읽은 행을 보고 정한다**(NERV Task `CLE-T-M6PERB`).
          const eia = await this.applyServerManagedEiaValues(m, target, {
            config: mergedConfig,
            requestedInteraction: interaction,
            requestedNotification: notification,
          });
          mergedConfig = eia.config;
          // **저장 대상은 이 요청이 바꾸는 필드뿐이다 — 재읽은 엔티티를 통째로 넘기지 않는다.**
          //
          // `save` 는 저장 시점에 DB 행을 다시 읽고 **엔티티와 다른 컬럼만** UPDATE 한다. 재읽은
          // 엔티티를 통째로 넘기면, 재읽기 **뒤에** 락 밖에서 커밋된 컬럼
          // (`rotateNotificationSecret` 의 `notificationSecretV2`, 웹훅 인입의 `lastTriggeredAt`,
          // cron 의 `chatChannelTokenV2` null-write, 스케줄 편집의 `name`·`isActive`)이 «엔티티와
          // 다르다» 로 잡혀 **옛 값으로 되써진다.** `#1334` 가 «이론적 TOCTOU» 로 유예한 자리였는데,
          // 실제 Postgres 에 TypeORM 을 붙여 재현하니 두 컬럼이 그대로 `null` 로 되돌아갔다
          // (`test/trigger-update-save-window.e2e-spec.ts` ②).
          //
          // 부분 객체면 넘기지 않은 컬럼이 `undefined` 라 비교에서 빠진다(같은 파일 ②b 실측). 락을
          // 공유하는 형제 창이 커밋한 컬럼도 마찬가지로 보호된다 — 종전엔 «재읽은 값을 그대로
          // 다시 싣는다» 로 막았는데, 싣지 않는 편이 타이밍과 무관하게 막는다.
          //
          // **동사는 `save` 그대로다.** `update` + 재조회로 바꿨다가 반환 엔티티·subscriber·
          // `endpointPath` UNIQUE 충돌 경로가 함께 달라져 되돌린 이력이 위 주석에 있다.
          //
          // **응답은 재읽은 엔티티에 이 요청의 변경을 얹은 것이다 — `save` 반환값을 덮지 않는다.**
          //
          // 부분 객체 `save` 의 반환값은 DB 를 다시 읽은 값이 **아니다**. 넘기지 않은 nullable
          // 컬럼을 전부 `null` 로 채워 돌려주고 실값은 `updatedAt` 뿐이다 — DB 에 `v2-B` 가 있는데
          // 반환값의 `notificationSecretV2` 는 `null` 이었다(실측). 한때 그 반환값을 통째로
          // `Object.assign` 했더니 `endpointPath` 가 `null` 로 덮여 `chatChannel` PATCH 가 전부
          // `CHAT_CHANNEL_ENDPOINT_REQUIRED` 400 이 됐다(e2e 가 잡았고 단위는 mock 이라 못 봤다).
          // 위 `defined` 가 막으려던 «로드된 값을 덮는다» 와 같은 함정이다.
          //
          // 그래서 반환값에서는 `updatedAt` 하나만 취한다. 재읽기 **뒤** 락 밖에서 커밋된 컬럼은
          // 이 응답에 보이지 않는다 — DB 는 보존되고(위) 응답만 한 박자 늦은 읽기다.
          // **저장과 응답이 같은 객체를 쓴다** — 둘을 따로 적으면 필드를 더할 때 한쪽만 고쳐
          // «DB 에 쓴 값» 과 «응답에 얹은 값» 이 조용히 갈린다.
          const patch = { ...defined, config: mergedConfig };
          const written = await m.save(Trigger, { id: target.id, ...patch });
          Object.assign(target, patch);
          // 실제 TypeORM 은 `@UpdateDateColumn` 이라 늘 채워 돌려준다. 가드는 **단위 대역**이
          // 넘긴 객체를 그대로 돌려줄 때(`updatedAt` 없음) 재읽은 값을 `undefined` 로 지우지
          // 않으려는 것이다 — 위 `defined` 와 같은 이유다.
          if (written.updatedAt) target.updatedAt = written.updatedAt;
          return {
            saved: target,
            issuedSecret: eia.issuedSecret,
            droppedTriggerToken: eia.droppedTriggerToken,
          };
        })
        // 시크릿 저장소 쓰기가 이 트랜잭션 안이라 저장이 실패하면 함께 롤백된다 — 따로 되돌릴 것이 없다.
        .catch((err: unknown) => this.rethrowEndpointPathConflict(err));
    // 전략이 바뀌어 토큰을 지웠으면 커밋 뒤 그 토큰으로 연 SSE 스트림을 닫는다(best-effort).
    if (droppedTriggerToken) {
      this.resourceReleaser.closeTriggerTokenStreams(
        [saved.id],
        'TriggersService.update',
      );
    }
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
      // 이 플래그와 무관하게 계속 재저장된다 — 3-쓰기 표는
      // `chat-channel-binder.service.ts` 의 `setupChatChannel` JSDoc 에 있다.
      await this.chatChannelBinder.setupChatChannel(saved, chatChannel, {
        storeUserSuppliedSecrets: false,
        // 병합 **전**의 값이다 — `saved.config.chatChannel` 은 이미 요청 바디로 교체됐다.
        preservedInboundSigningRef: previousInboundSigningRef,
      });
      // setupChatChannel 은 별도 `rewriteTriggerConfigLocked`(락 안 재읽기·머지) — in-memory `saved` 는 stale.
      // 응답 hasBotToken / inboundSigningRef 가 최신 반영되도록 재조회.
      //
      // **`relations` 를 함께 실어야 한다.** 이 재조회가 `saved` 를 통째로 갈아치우므로,
      // 관계를 빼고 읽으면 `chatChannel` 을 포함한 PATCH 응답에서만 `workflow` 가 사라진다
      // — `TriggerDto.workflow` JSDoc 은 *"생성 응답에만 없다"* 고 보장하는데 그 보장이
      // 구현보다 넓었다 (`review/code/2026/09/06/01_13_50` W4). 부재가 §5.4 키 생략형이라
      // 계약 검증자도 못 잡는 자리다.
      const refreshed = await this.triggerRepository.findOne({
        where: { id: saved.id, workspaceId },
        relations: { workflow: true },
      });
      if (refreshed) result = refreshed;
    }
    return this.withIssuedSecrets(
      this.sanitizeForResponse(result),
      issuedSecret,
    );
  }

  /**
   * 트리거를 **응답 경계**에서 정화한다 — 비밀이 사는 **네 곳**을 모두 덮고 진단 원문의
   * 자격 증명 모양을 가린다.
   *
   * 근거: [채팅 채널 「인증과 보안」](CLE-CHAT-CORE#인증과-보안),
   * [시크릿 저장소 「규칙」](CLE-INT-SECRET#규칙), [응답 자격 증명 마스킹 「규칙」](CLE-API-EGRESS#규칙)
   *
   * | 축 | 어디 | 목록 | 정화 함수 |
   * |---|---|---|---|
   * | 1 | `config.chatChannel` JSONB | `CHAT_CHANNEL_RESPONSE_STRIP_KEYS` | `stripChatChannelSecrets` |
   * | 2 | `config.notification.signing` | `NOTIFICATION_SIGNING_STRIP_KEYS` | `stripNotificationSigningSecrets` |
   * | 3 | `config.interaction` | `INTERACTION_RESPONSE_STRIP_KEYS` | `stripInteractionSecrets` |
   * | 4 | `trigger` 행의 **엔티티 컬럼** | `TRIGGER_RESPONSE_STRIP_COLUMNS` | `deleteSecretColumns` |
   *
   * **이 메서드는 얇은 오케스트레이터다** — 축마다 이름 있는 순수 함수를 부르고, 조인된
   * `workflow` 좁히기(`narrowWorkflowRef`)와 진단 원문의 응답 마스킹(`redactDiagnosticColumns`)
   * 까지 책임마다 함수가 갈려 있다(`review/code/2026/09/06/00_00_23` W2 — 78줄 단일 메서드였다).
   *
   * 신규 plaintext / 내부 ref 필드를 추가할 때는 해당 상수에 키를 넣어야 정화가 걸린다
   * (destructure 대신 목록 — 누락 위험 회피).
   *
   * **엔티티를 변경하지 않는다 — 항상 새 객체를 돌려준다** (DB 저장에 영향이 없도록).
   * 조기 return 을 없앤 뒤로는 정화할 것이 없는 트리거도 새 참조를 받는다, 그러니 호출부는
   * 참조 동일성을 전제하지 말 것.
   *
   * ## 진단 원문의 응답 마스킹
   *
   * 표의 축은 비밀 필드를 **지운다**. 마지막 오류 두 필드(`TRIGGER_RESPONSE_REDACT_COLUMNS`)는
   * 지우지 않고 값 안의 자격 증명 모양만 `redactSecrets` 로 가린다. 비밀 필드가 아니라 실패
   * 원인을 보여 주는 진단 텍스트라 strip 목록에 넣지 않았다. 그래서 아래 절 끝의 «비밀 축이 하나
   * 더 생기면 선언적 SoT 로 옮길 것» 에도 해당하지 않는다. 이 조회는 역할 게이트가 없어 뷰어도
   * 받는다. 저장값은 원문이다. 시크릿 저장소 평문(봇 토큰)은 채팅 채널 클라이언트가 원문을 만들 때
   * 이미 지운다(`replaceKnownSecret`). 이 마스킹은 미리 알 수 없는 모양을 막는 두 번째 층이다.
   *
   * ## 왜 세 목록인가 — 이 메서드가 두 번 좁게 틀렸다
   *
   * 처음엔 (1) 만 했고 `config.chatChannel` 이 없으면 **조기 return** 했다. 그래서
   * chat-channel 이 아닌 트리거는 정화를 아예 거치지 않았고, chat-channel 트리거도 컬럼 쪽
   * 비밀(4)은 그대로 나갔다 — `GET /api/triggers` 의 `createQueryBuilder('t')` 가 전 컬럼을
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
    const target = sanitized as unknown as Record<string, unknown>;
    deleteSecretColumns(target);
    redactDiagnosticColumns(target);
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
   *
   * **지금은 `update()` 의 원시 `config` 경로만 쓴다.** 생성은 `settleCreatedNotificationSigning` 이 평문 이전과
   * 첫 발급을 한 잠금 안에서 하고, top-level `notification` 이 실린 PATCH 는 창 1 이 같은 일을 한다
   * (NERV Task `CLE-T-M6PERB`). 원시 `config` 경로의 계약은 NERV Task `CLE-T-EA7B5M` 이 맡는다.
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

    const ref = notificationSigningSecretRef(trigger.id);
    await this.secrets.rotate(ref, trigger.workspaceId, plaintext);

    const updatedSigning = signingWithRef(signing, ref);
    const normalizedNotification = {
      ...(notificationCfg as Record<string, unknown>),
      signing: updatedSigning,
    };
    // 호출부(`update`)가 이 엔티티를 응답에 쓰므로 in-memory 도 맞춰 둔다.
    trigger.config = {
      ...trigger.config,
      notification: normalizedNotification,
    };
    // 재읽은 `config.notification` **위에** `signing` 만 얹는다. 스냅샷으로 만든
    // `normalizedNotification` 을 통째로 대입하면 그 사이 커밋된 `notification.url` 등이
    // 되돌아간다 — `mergeIntoFreshSubKey` JSDoc 참조.
    const wrote = await rewriteTriggerConfigLocked(
      this.triggerRepository.manager,
      trigger.id,
      (freshConfig) =>
        this.mergeIntoFreshSubKey(
          freshConfig,
          'notification',
          { signing: updatedSigning },
          normalizedNotification,
        ),
    );
    // 그 사이 트리거가 삭제됐다 — 위에서 락 밖에 쓴 서명 비밀을 되돌린다(spec 트리거 목록 §3).
    if (!wrote) {
      await this.resourceReleaser.undoAbsentWrite(
        trigger.id,
        undefined,
        'TriggersService.normalizeNotificationSecretRef',
      );
    }
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
      // **이 자리만 top-level 이 도메인 특화 코드다 — §5.3 판정 미해결.**
      //
      // `details[].code` 를 실은 13자리 중 12곳은 top-level 이 400 상태 기본값
      // `VALIDATION_ERROR` 인데 여기만 `AUTH_CONFIG_NOT_FOUND` 다. `2-api-convention.md` §5.3
      // 은 *"둘을 겹쳐 쓰지 않는다"* 고 적지만 그 문면은 **「같은 사유」** 를 양쪽에 넣는 것을
      // 금지한다 — `INVALID_FIELD` 는 *"이 필드가 잘못됐다"* 는 generic 표지라 도메인 사유와
      // 같지 않다. 즉 **이 자리가 그 금지에 걸리는지 자체가 판정 사안**이고 그것은 §5.3 을
      // 고치는 planner 결정이다(`review/code/2026/09/11/12_00_40` W1 ·
      // `review/consistency/2026/09/11/12_18_21` W2).
      //
      // 그때까지 `code` 를 **유지**한다 — 벗기면 `authConfigId` 만 `details.field` 에 generic
      // 표지가 없는 특례가 되어 소비자가 이 필드를 따로 처리해야 한다. 추적:
      // `plan/in-progress/spec-draft-nullable-notation-followups.md`.
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
    // [spec 트리거 목록 §4.3] **외부 자원은 행 삭제 전에** — schedule 타입이면 BullMQ job
    // scheduler(미해제 시 cron tick 마다 "Schedule not found" skip 이 반복된다) · provider
    // teardown · listener registry. 비밀은 여기서 지우지 않는다: teardown 이 비밀을 읽고, 행
    // 삭제 **뒤에** 지워야 그 사이 끼어든 쓰기가 남긴 비밀까지 덮는다(아래).
    await this.resourceReleaser.releaseExternal(trigger);
    // type 을 remove 전에 읽어둔다 — TypeORM `remove` 는 엔티티의 id 를 지운다.
    const { type } = trigger;
    // **삭제도 config 락을 잡는다.** 창 1 은 `save(entity)` 를 쓰는데 그것은 행이 없으면
    // **INSERT** 한다. 읽기 시점 가드(`!fresh`)는 «읽었을 땐 있었는데 저장 직전에 삭제되는»
    // 쓰기 시점 경합을 못 막는다 — 그 창을 닫는 유일한 방법이 삭제를 같은 락으로 직렬화하는
    // 것이다 (`/ai-review` `review/code/2026/09/14/20_17_16` database·concurrency WARNING#2).
    //
    // 위 외부 해제(provider teardown 포함)는 **락 밖**에서 이미 끝났다 — `trigger-config-lock.ts`
    // JSDoc 의 «외부 호출을 락 안에 두지 않는다» 제약을 여기서도 지킨다.
    //
    // **삭제만 대기 상한을 둔다.** 위 해제는 되돌릴 수 없으므로, 락을 무한정 기다리면
    // «외부 등록은 뜯겼는데 행은 남은» 반쯤 삭제된 상태가 굳는다. 상한을 넘기면 그 사실을
    // 소리내어 남기고 던진다 — 조용한 지연보다 드러나는 오류가 낫다.
    await this.triggerRepository.manager
      .transaction(async (m) => {
        await acquireTriggerConfigLock(m, id, {
          timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS,
        });
        // **락을 얻었다고 행이 남아 있는 것은 아니다.** 위 `findById` 는 잠금 없는 선조회라 동시
        // DELETE 두 건이 모두 통과하고, advisory lock 은 둘을 줄 세우기만 한다 — 먼저 커밋한 쪽이
        // 행을 지운 뒤 두 번째가 그대로 진행하면 `m.remove` 는 0행이어도 던지지 않으므로 그 요청도
        // 성공으로 끝나며 `trigger.deleted` 감사를 한 번 더 남긴다(e2e 로 재현: 둘 다 204 · 감사 2건).
        // spec 트리거 목록 §4.4 의 «두 번째 요청은 404» 를 여기서 실제로 지킨다.
        const fresh = await m.findOne(Trigger, {
          select: { id: true },
          where: { id, workspaceId },
        });
        if (!fresh) this.throwTriggerNotFound();
        await m.remove(trigger);
      })
      .catch((err: unknown) => {
        // 동시 삭제로 행이 이미 사라진 경우는 **반쯤 삭제된 상태가 아니다** — 먼저 커밋한 요청이
        // 행도 외부 자원도 정리했다. 아래 로그는 «수동 정리가 필요하다» 고 말하므로 이 경우까지
        // 실으면 거짓 경보가 된다(워크플로·워크스페이스 삭제와 같은 처리).
        if (err instanceof NotFoundException) throw err;
        this.logger.error(
          `TriggersService.remove: trigger=${id} 의 행 삭제가 실패했다 — schedule job·provider ` +
            `teardown·listener 해제는 **이미 끝났으므로** 이 트리거는 반쯤 삭제된 상태다(비밀은 ` +
            `아직 남아 있다). 수동 정리가 필요하다: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw err;
      });
    // **커밋된 뒤에** 비밀을 지운다. 실패는 던지지 않고 남긴다 — 행은 이미 없다.
    await this.resourceReleaser.releaseSecretsAfterCommit(
      [id],
      'TriggersService.remove',
    );
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
    const newSecret = newNotificationSigningSecret();
    trigger.notificationSecretV2 = newSecret;
    trigger.notificationRotatedAt = new Date();
    // **트리거 설정 잠금 안에서 컬럼만 쓴다.** `save(trigger)` 는 엔티티를 통째로 저장해 읽은 시점의 `config`
    // 까지 되쓴다(`hooks.service.ts` 의 `touchLastTriggeredAt` 과 같은 규율). 잠금을 잡는 이유는 승격이 잠금
    // 안에서 같은 컬럼을 비우기 때문이다 — 승격이 v2 를 고른 뒤 교체가 새 값을 쓰면 응답으로 나간 새 시크릿을
    // 승격이 지울 수 있었다(NERV Task `CLE-T-M6PERB`). `config` 를 쓰지 않는 컬럼 한정 쓰기 가운데 이 경로만
    // 잠금을 잡는다. 근거: [트리거 관리 「동시 쓰기 직렬화」](CLE-TRIG-MANAGE#동시-쓰기-직렬화), REQ-TRIG-054.
    // 유예 중 재교체는 앞의 v2 를 덮고 유예를 다시 시작한다([EIA 알림 웹훅 「시크릿 교체」](CLE-EIA-NOTIFY#시크릿-교체)).
    const rotatedAt = trigger.notificationRotatedAt;
    const wroteRotation = await this.triggerRepository.manager.transaction(
      async (m) => {
        await acquireTriggerConfigLock(m, trigger.id);
        const fresh = await m.findOne(Trigger, {
          select: { id: true },
          where: { id: trigger.id, workspaceId },
        });
        if (!fresh) return false;
        const { affected } = await m.update(
          Trigger,
          { id: trigger.id },
          { notificationSecretV2: newSecret, notificationRotatedAt: rotatedAt },
        );
        return (affected ?? 0) > 0;
      },
    );
    // 동기 요청이다 — 그 사이 삭제됐으면 404 로 드러낸다(`revokePerTriggerToken` 과 같다).
    if (!wroteRotation) this.throwTriggerNotFound();
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
    // 잠금 밖 선조회라 빨리 거절하는 용도다. 판정의 기준은 아래 잠금 안 재읽기다.
    if (!this.isPerTriggerInteraction(interactionCfg)) {
      this.throwNotPerTriggerStrategy();
    }
    const newToken = `itk_${randomBytes(32).toString('hex')}`;
    const updated = {
      ...interactionCfg,
      triggerToken: newToken,
    };
    trigger.config = { ...trigger.config, interaction: updated };
    // 락 안 재읽기 위에 `interaction` 만 얹는다. 이 경로는 **동기 요청**이므로, 그 사이
    // 트리거가 삭제됐으면 창 1·`rotateBotToken` 과 같이 404 로 드러낸다.
    const wroteInteraction = await rewriteTriggerConfigLocked(
      this.triggerRepository.manager,
      trigger.id,
      // 재읽은 `config.interaction` **위에** 새 토큰만 얹는다 — 스냅샷을 통째로 대입하면
      // 그 사이 커밋된 `enabled`·`appearance` 등이 되돌아간다(위 C1 과 같은 클래스).
      //
      // **전략도 잠금 안에서 다시 확인한다.** 위 선조회 뒤 PATCH 가 전략을 바꾸고 토큰을 지웠으면, 확인 없이
      // 얹은 토큰이 `per_trigger` 가 아닌 설정에 남는다. 이후 `per_trigger` 로 돌아오는 PATCH 가 그 토큰을
      // 이어받아 «다시 `per_trigger` 로 바꿔도 옛 토큰은 살아나지 않는다» 는 불변식이 깨진다.
      // 던지면 이 트랜잭션이 롤백되고 아무것도 쓰지 않는다.
      (freshConfig) => {
        if (
          !this.isPerTriggerInteraction(
            (freshConfig as { interaction?: unknown }).interaction,
          )
        ) {
          this.throwNotPerTriggerStrategy();
        }
        return this.mergeIntoFreshSubKey(
          freshConfig,
          'interaction',
          { triggerToken: newToken },
          updated,
        );
      },
    );
    if (!wroteInteraction) this.throwTriggerNotFound();
    await this.recordAudit({
      workspaceId,
      userId,
      action: AUDIT_ACTIONS.TRIGGER_INTERACTION_TOKEN_REVOKED,
      resourceId: trigger.id,
      type: trigger.type,
    });
    // 옛 토큰으로 연 SSE 스트림을 닫는다 — 이 서버 인스턴스의 구독자만(best-effort).
    // 근거: [트리거 관리 「API」](CLE-TRIG-MANAGE#api) 의 `revoke-token` 행, REQ-TRIG-041.
    this.resourceReleaser.closeTriggerTokenStreams(
      [trigger.id],
      'TriggersService.revokePerTriggerToken',
    );
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
   *   `CHAT_CHANNEL_ENDPOINT_REQUIRED` / `BOT_TOKEN_INVALID` (setupChannel 이 **자격 증명 거부**로
   *   실패 — §5.4)
   * @throws BadGatewayException `CHAT_CHANNEL_SETUP_FAILED` (그 밖의 setupChannel 실패 — 502)
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
    // **형태를 여기 다시 적지 않는다.** 손으로 적었더니 Discord 가 채우는 `publicKey` 가
    // 빠져 **선언이 실제 반환보다 좁았다**(`review/code/2026/09/12/16_17_57` api_contract WARNING).
    // `mergedChannel.botIdentity` 를 그대로 돌려주므로 그 타입을 그대로 참조한다.
    botIdentity: NonNullable<ChatChannelConfig['botIdentity']> | null;
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

    // 두 ref 는 저장된 `config` 를 믿지 않고 자기 트리거 id 로 유도한다. 저장 경계가 원시 `config` 의
    // 내부 필드를 막기 전에 저장된 행에는 다른 트리거의 ref 가 들어 있을 수 있고, 그 ref 로
    // `rotate` 하면 그 트리거의 비밀을 덮어쓴다(CLE-T-M9QKKX). 정상 행의 ref 는 바인더가 같은 규칙으로
    // 유도한 값이라 결과가 같다.
    const botTokenRef = chatChannelSecretRef(trigger.id, 'botTokenRef');
    const v2Ref = buildSecretRef({
      scope: 'triggers',
      resourceId: trigger.id,
      name: 'bot-token.v2',
    });
    const inboundSigningRef = chatChannelSecretRef(
      trigger.id,
      'inboundSigningRef',
    );

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
    // [Spec Chat Channel §5.4] **자격 증명 거부**는 BOT_TOKEN_INVALID 400, 그 밖의 실패는
    // CHAT_CHANNEL_SETUP_FAILED 502 로 변환. 판별은 adapter 가 부착한 `code` (CCA §1.1.2).
    //
    // 어댑터에 넘기는 설정에도 저장된 참조를 싣지 않는다. Discord 어댑터는 `inboundSigningRef` 를
    // resolve 해 `verify_key` 와 대조하므로 다른 트리거의 참조가 남아 있으면 그 비밀을 읽는다
    // (NERV 발견 `01a106cf-6c26-7005-830d-8b430e6a6d15`). 저장된 행에 참조가 없으면(레거시) 전처럼
    // 키를 넣지 않는다. 넣으면 resolve 가 NotFound 로 바뀐다. 저장값이 이 트리거의 참조와 다르면
    // 읽기 경로와 같은 오류 로그를 남긴다(NERV Task `CLE-T-XYR067`).
    const mergedConfig: ChatChannelConfig = {
      ...pinChatChannelSecretRefs(
        trigger.id,
        chatChannelCfg,
        this.logger,
        'TriggersService.rotateBotToken',
      ),
      botTokenRef,
    };
    const callbackUrl = buildTriggerCallbackUrl({
      baseUrl: this.configService.get<string>('app.url'),
      endpointPath: trigger.endpointPath,
    });
    let result: SetupResult;
    try {
      result = await adapter.setupChannel(mergedConfig, callbackUrl);
    } catch (err) {
      // **provider 원문은 여기서만 남는다** — §5.4 가 응답 본문에 원문을 싣지 못하게 하므로
      // (§7.5.2 보안 게이트와 같은 이유) 진단 단서를 서버 로그로 옮긴다. 변환 함수는
      // `chat-channel-input-rules.ts` 의 순수 함수라 logger 를 갖지 않는다.
      this.logger.warn(
        `rotateBotToken setupChannel 실패 (trigger=${trigger.id} provider=${chatChannelCfg.provider}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw translateSetupChannelError(err);
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

    // 6. trigger 컬럼 갱신 — **락 안에서 config 를 다시 읽어 머지한다.**
    //
    // 위 `adapter.setupChannel` 은 이미 끝났으므로 외부 호출이 임계 구간에 들어가지 않는다
    // (근거는 `trigger-config-lock.ts` JSDoc). `mergedChannel` 은 이 회전의 산출이라 그대로
    // 쓰고, 되살려야 하는 것은 **다른 요청이 그 사이 커밋한 `config` 의 나머지 키**다 —
    // 종전엔 1단계 `findById` 시점의 `trigger.config` 스냅샷으로 통째로 덮어 그것들을 잃었다.
    //
    // 아래 네 컬럼은 «이번 회전의 결과» 라 머지 대상이 아니다.
    const rotatedAt = new Date();
    const wrote = await rewriteTriggerConfigLocked(
      this.triggerRepository.manager,
      trigger.id,
      // 재읽은 `config.chatChannel` **위에** 이번 회전의 산출만 얹는다.
      //
      // **`patch` 는 델타여야 한다 — 스냅샷 전체가 아니다.** 앞 라운드에서 `mergedChannel`
      // 을 `patch` 로 넘겼는데, 그건 함수 시작 시점의 `chatChannelCfg` 를 스프레드한 **전체**
      // 객체라 재읽기로 얻은 `rateLimitPerMinute`·`uiMapping`·`languageLocale` 을 무조건
      // 되돌린다 — 헬퍼를 쓰면서도 헬퍼가 막으려던 결함을 그대로 낸 것이다
      // (`/ai-review` `review/code/2026/09/14/23_38_09` side_effect·maintainability C1).
      //
      // 두 ref 는 델타에 **포함한다** — `chatChannelSecretRef(trigger.id, …)` 로 매번 재유도되는
      // 결정적 값이고, 빠지면 인입 서명 검증이 fail-open 으로 돌아간다(D-3 계약).
      (freshConfig) =>
        this.mergeIntoFreshSubKey(
          freshConfig,
          'chatChannel',
          {
            ...(result.configUpdates ?? {}),
            botTokenRef,
            inboundSigningRef,
          },
          mergedChannel as unknown as Record<string, unknown>,
        ),
      {
        chatChannelTokenV2: v2RefUsed,
        chatChannelRotatedAt: rotatedAt,
        chatChannelHealth: 'healthy',
        chatChannelLastError: null,
      },
    );
    // **쓰기가 skip 됐으면 성공으로 응답하지 않는다.** 그 사이 트리거가 삭제되면 헬퍼는
    // `false` 를 돌려주는데, 종전엔 그것을 무시하고 200 + 감사 row 를 남겼다 — 삭제된
    // 트리거에 대한 **거짓 성공 기록**이다. 창 1 은 같은 조건에서 404 를 내므로 형제
    // 엔드포인트끼리 응답이 갈리기도 했다
    // (`/ai-review` `review/code/2026/09/14/20_17_16` api_contract WARNING#3).
    if (!wrote) {
      // 404 전에 되돌린다 — 새 토큰·v2 백업·issued 서명은 락 밖에서 이미 썼고, provider 에는 새
      // 토큰으로 콜백이 등록됐다. teardown 이 그 토큰을 읽으므로 비밀보다 먼저다.
      await this.resourceReleaser.undoAbsentWrite(
        trigger.id,
        mergedChannel,
        'TriggersService.rotateBotToken',
      );
      this.throwTriggerNotFound();
    }
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
    for (const candidate of candidates) {
      const pickedV2 = candidate.notificationSecretV2;
      if (!pickedV2) continue;
      if (
        (await this.promoteOneLocked(candidate.id, pickedV2)) === 'promoted'
      ) {
        promoted++;
      }
    }
    return { promoted };
  }

  /**
   * 한 트리거의 v2 를 승격한다 — **판정 · 시크릿 저장소 쓰기 · 컬럼 비우기를 한 트리거 설정 잠금 안에서 한다.**
   *
   * 근거: [EIA 알림 웹훅 「시크릿 교체」](CLE-EIA-NOTIFY#시크릿-교체)(승격 조건의 기준), REQ-EIANOTI-036,
   * [EIA 데이터와 흐름 「서명 시크릿 교체와 승격」](CLE-EIA-DATA#서명-시크릿-교체와-승격).
   *
   * - **잠금 안에서 다시 읽은 v2 가 고른 값과 같을 때만** 정식 참조로 옮기고 비운다. 다르면 그사이 교체가 다시
   *   일어난 것이라 옮기지도 비우지도 않는다 — 새 값은 다시 시작한 유예가 끝난 뒤에 승격한다. 종전엔 잠금
   *   밖에서 먼저 옮겼다. 그래서 재교체가 끼면 덮인 옛 v2 가 주 시크릿이 됐다(NERV Task `CLE-T-M6PERB`).
   * - EIA 알림 웹훅 설정이 없는 트리거는 승격하지 않고 v2 와 교체 시각을 비운다 — 매 주기 건너뛰면 v2 평문이
   *   DB 에 계속 남는다(`[SUMMARY W-2]`).
   * - 다른 워크스페이스 소유의 저장소 행이면 이 트리거만 건너뛴다(NERV Task `CLE-T-XYR067`). 그 밖의 실패는
   *   던져 job 재시도에 맡긴다.
   * - 시크릿 저장소 쓰기는 이 트랜잭션의 매니저로 한다 — 풀 연결을 더 빌리지 않고 던지면 함께 롤백된다.
   * - 잠금 안에서도 행이 사라질 수 있다(FK CASCADE 는 advisory lock 을 거치지 않는다). 쓰기가 0행이면 커밋 뒤
   *   시크릿 저장소에 쓴 것을 되돌린다(시크릿 저장소 규칙 9). cron 이라 알릴 상대가 없고 «승격했다» 고 세지 않는다.
   *
   * 승격은 평문을 설정에 쓰지 않는다 — 정식 참조 내용을 바꾸고 `signing.secretRef` 를 연결한다(리뷰 C3).
   */
  private async promoteOneLocked(
    triggerId: string,
    pickedV2: string,
  ): Promise<'promoted' | 'skipped'> {
    let wroteSecret = false;
    const outcome = await this.triggerRepository.manager.transaction(
      async (m): Promise<'promoted' | 'skipped' | 'absent'> => {
        await acquireTriggerConfigLock(m, triggerId);
        const fresh = await m.findOne(Trigger, { where: { id: triggerId } });
        if (!fresh) return 'skipped';
        if (fresh.notificationSecretV2 !== pickedV2) return 'skipped';
        const notificationCfg = (fresh.config as { notification?: unknown })
          ?.notification;
        if (!notificationCfg || typeof notificationCfg !== 'object') {
          this.logger.warn(
            `trigger ${triggerId} has notificationSecretV2 but no notification config — clearing stale v2 columns`,
          );
          // 컬럼만 쓴다 — `config` 를 건드리지 않는다.
          await m.update(
            Trigger,
            { id: triggerId },
            { notificationSecretV2: null, notificationRotatedAt: null },
          );
          return 'skipped';
        }
        const ref = notificationSigningSecretRef(triggerId);
        try {
          // ref 가 있으면 내용 교체, 없으면 신규 생성 — rotate 가 upsert 시맨틱.
          await this.secrets.rotate(ref, fresh.workspaceId, pickedV2, m);
        } catch (err) {
          if (err instanceof SecretWorkspaceMismatchError) {
            this.logger.error(
              `notification secret 승격 건너뜀 — 트리거 ${triggerId} 의 서명 비밀 행이 다른 워크스페이스 소유다. 저장된 행을 점검하세요.`,
            );
            return 'skipped';
          }
          throw err;
        }
        wroteSecret = true;
        // legacy 평문 키는 제거 — 평문은 DB config 에 남기지 않는다.
        const { affected } = await m.update(
          Trigger,
          { id: triggerId },
          {
            config: {
              ...fresh.config,
              notification: notificationWithSigningRef(notificationCfg, ref),
            },
            notificationSecretV2: null,
            notificationRotatedAt: null,
          },
        );
        return (affected ?? 0) > 0 ? 'promoted' : 'absent';
      },
    );
    if (outcome === 'absent') {
      if (wroteSecret) {
        // 위 `rotate` 가 쓴 서명 비밀을 되돌린다 — 삭제 쪽 정리보다 늦었으면 아무도 안 지운다.
        await this.resourceReleaser.undoAbsentWrite(
          triggerId,
          undefined,
          'TriggersService.promoteRotatedNotificationSecrets',
        );
      }
      return 'skipped';
    }
    return outcome;
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

      // 컬럼 갱신 — **컬럼만 쓴다**(위 ② 와 같은 규율).
      trigger.chatChannelTokenV2 = null;
      trigger.chatChannelRotatedAt = null;
      await this.triggerRepository.update(
        { id: trigger.id },
        { chatChannelTokenV2: null, chatChannelRotatedAt: null },
      );
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
   * `endpoint_path` 충돌(전역 UNIQUE 위반 · 다른 워크스페이스의 예약)을 **문서한 형태**로 바꿔
   * 던진다. 두 경우는 **같은 응답**이다 — 가르면 그 경로가 한때 쓰였다는 사실이 새어 나간다
   * (`spec/1-data-model.md` Rationale «지운 · 바꾼 웹훅 경로의 영구 예약»).
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
          // 워크스페이스를 말하지 않는다 — 충돌 상대가 다른 워크스페이스의 트리거일 수 있다.
          // «쓰고 있다» 도 말하지 않는다 — 예약만 남은 경로(지웠거나 바꾼 경로)에는 거짓이다.
          '그 엔드포인트 경로는 쓸 수 없어요. 새 경로를 쓰세요.',
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
