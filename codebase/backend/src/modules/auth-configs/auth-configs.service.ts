import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Address4, Address6 } from 'ip-address';
import { AuthConfig } from './entities/auth-config.entity';
import { Execution } from '../executions/entities/execution.entity';
import { Trigger } from '../triggers/entities/trigger.entity';
import { User } from '../users/entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  AUDIT_ACTIONS,
  AuditActionFor,
} from '../audit-logs/audit-action.const';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { omitUndefined } from '../../common/utils/omit-undefined';
import {
  InvalidReference,
  throwInvalidReferences,
} from '../../common/utils/reference-in-scope';
import {
  isUnreadableCredentials,
  UNREADABLE_ORIGINAL_KEY,
} from '../integrations/services/credentials-transformer';

// HMAC 알고리즘 허용 목록. 외부 입력(인증 설정)이 crypto.createHmac 에 전달되므로
// 화이트리스트로 좁혀 임의 알고리즘·약한 다이제스트 사용을 차단한다.
const HMAC_ALLOWED_ALGORITHMS = new Set(['sha256', 'sha512']);

// 헤더 이름 · 알고리즘을 정하지 않은 설정의 기본값. 생성 · 읽지 못한 설정의 재생성 · 웹훅 인증이 같은 값을 쓴다.
const API_KEY_DEFAULT_HEADER = 'X-API-Key';
const HMAC_DEFAULT_HEADER = 'X-Hub-Signature-256';
const HMAC_DEFAULT_ALGORITHM = 'sha256';

// 재생성할 수 있는 유형. 제품이 발급한 비밀(key · token · secret)이 있는 유형만이다. Basic Auth 의
// 사용자 이름과 비밀번호는 사용자 입력이라 새로 발급할 값이 없다(REQ-AUTHCFG-029).
const REGENERATABLE_TYPES = new Set(['api_key', 'bearer_token', 'hmac']);

// `__` 로 시작하는 config 키는 복호화하지 못한 설정의 표식(`__unreadable` · `__original_ciphertext`)이 쓰는
// 이름이다. 사용자 입력으로 받지 않는다(REQ-AUTHCFG-032).
const RESERVED_CONFIG_KEY_PREFIX = '__';

// 응답에서 마스킹할 config 키 (spec/1-data-model.md §2.17.2).
const SECRET_CONFIG_KEYS = new Set(['key', 'token', 'secret', 'password']);

// 감사 로그 resourceType — 본 도메인의 모든 record() 호출이 공유.
const AUTH_CONFIG_RESOURCE_TYPE = 'auth_config';

// getUsage 가 반환하는 최근 호출 표시 건수 (목록 API 기본 페이지 크기와 동일).
const USAGE_RECENT_CALLS_LIMIT = 20;

// §A.3 기간별 호출 수 — 롤링 윈도 길이(ms). 24h / 7d / 30d (캘린더 버킷 아님).
const USAGE_PERIOD_WINDOWS_MS = {
  last24h: 24 * 60 * 60 * 1000,
  last7d: 7 * 24 * 60 * 60 * 1000,
  last30d: 30 * 24 * 60 * 60 * 1000,
} as const;

/**
 * periodCounts 의 raw COUNT 문자열을 안전한 음이 아닌 정수로 변환 — DB 드라이버
 * 비정상 반환(NaN/음수/null)을 0 으로 폴백한다 (§A.3 getUsage).
 */
function safeUsageCount(raw: string | undefined | null): number {
  const n = Number(raw ?? 0);
  return isNaN(n) || n < 0 ? 0 : n;
}

/**
 * Basic Auth `config` 에서 `keys` 가운데 빈 값인 것을 모두 모은다(REQ-AUTHCFG-027 · 028). 거부는
 * {@link assertConfigInput} 이 한 번에 한다.
 *
 * «비었다» 는 없음 · 빈 문자열이고, 웹훅 인증(`verifyBasicAuth`)이 빈 기대값을 401 로 거부하는 기준과 같다. 저장 때는
 * 여기에 더해 문자열이 아닌 값도 거부한다. 인증은 문자열이 아닌 기대값도 401 로 거부하므로 그런 값으로는 인증되지 않는다.
 * 공백만 있는 값은 인증이 통과시키므로 받는다.
 */
function emptyBasicAuthFields(
  config: Record<string, unknown>,
  keys: readonly string[],
): InvalidReference[] {
  return keys
    .filter((k) => typeof config[k] !== 'string' || config[k] === '')
    .map((k) => ({
      field: `config.${k}`,
      message: `config.${k} must be a non-empty string`,
    }));
}

/**
 * `config` 의 최상위 키 가운데 `__` 로 시작하는 것을 모은다(REQ-AUTHCFG-032). 이 이름으로 저장되면 읽을 때
 * 표식으로 오인되거나, 저장할 때 `encryptJson` 이 표식으로 보고 입력을 암호화하지 않은 채 쓴다.
 */
function reservedConfigKeyFields(
  config: Record<string, unknown>,
): InvalidReference[] {
  return Object.keys(config)
    .filter((k) => k.startsWith(RESERVED_CONFIG_KEY_PREFIX))
    .map((k) => ({
      field: `config.${k}`,
      message: `config.${k} uses a reserved key prefix "${RESERVED_CONFIG_KEY_PREFIX}"`,
    }));
}

/**
 * 모은 필드 오류를 한 번에 400 `VALIDATION_ERROR` 로 거부한다. 응답 본문은 `throwInvalidReferences` 가 만든다.
 * `CustomValidationPipe` 와 같은 배열 `[{ field, message, code: 'INVALID_FIELD' }]` 이고, 이름은 «참조» 지만 필드별
 * 400 본문을 만드는 단일 헬퍼다.
 */
function assertConfigInput(problems: InvalidReference[]): void {
  if (problems.length > 0) throwInvalidReferences(problems);
}

/** 유형별로 제품이 발급하는 비밀을 `config` 에 새로 넣는다. 다른 키는 건드리지 않는다. */
function issueSecret(type: string, config: Record<string, unknown>): void {
  if (type === 'api_key') {
    config.key = `wfk_${randomBytes(24).toString('hex')}`;
  } else if (type === 'bearer_token') {
    config.token = `wft_${randomBytes(32).toString('hex')}`;
  } else if (type === 'hmac') {
    config.secret = `whs_${randomBytes(32).toString('hex')}`;
  }
}

/** HMAC 의 서명 헤더와 알고리즘을 정하지 않았으면 기본값을 넣는다. 생성 때와 읽지 못한 설정의 재생성 때만 쓴다. */
function fillHmacDefaults(config: Record<string, unknown>): void {
  if (!config.header) config.header = HMAC_DEFAULT_HEADER;
  if (!config.algorithm) config.algorithm = HMAC_DEFAULT_ALGORITHM;
}

/**
 * 웹훅 인증이 비교할 기대값. 문자열이 아니면 빈 값으로 본다. 저장된 config 는 jsonb 라 숫자 · 객체가 들어 있을 수
 * 있고, 그대로 비교하면 `Buffer.from` · `createHmac` 이 TypeError 를 던져 401 대신 500 이 된다(REQ-WEBHOOK-053).
 */
function expectedString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * 웹훅 인증이 읽을 헤더 이름. 키가 없으면(`undefined` · `null`) 기본 헤더를 쓰고, 있는데 문자열이 아니면 `null`
 * 을 돌려 호출한 쪽이 401 로 거부하게 한다. 기본 헤더로 바꾸면 운영자가 정하지 않은 헤더로 인증이 통과한다.
 */
function headerNameOrNull(value: unknown, fallback: string): string | null {
  if (value === undefined || value === null) return fallback.toLowerCase();
  return typeof value === 'string' ? value.toLowerCase() : null;
}

export interface WebhookAuthContext {
  /** 소문자 키의 요청 헤더 맵 */
  headers: Record<string, string>;
  /** HMAC 검증용 원본 바이트 */
  rawBody?: Buffer;
  /** ip_whitelist 검증용 클라이언트 IP */
  clientIp?: string;
}

@Injectable()
export class AuthConfigsService {
  constructor(
    @InjectRepository(AuthConfig)
    private readonly authConfigRepository: Repository<AuthConfig>,
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /**
   * auth_config 계열 감사 기록의 단일 래퍼 — resourceType 을 고정하고 best-effort
   * 계약(실패 swallow)은 {@link AuditLogsService.record} 에 위임한다. CRUD 5개
   * 경로(create/update/regenerate/remove/reveal)가 공유한다.
   */
  private recordAudit(params: {
    // `AuditAction`(전체 union)이 아니라 **리소스에 묶인** 타입이다. 맨 union 이면
    // `trigger.created` 같은 다른 리소스의 액션을 `resourceType: 'auth_config'` 로 기록해도
    // 컴파일러가 잡지 못한다 — 실측으로 확인했다(그 상태에서 tsc 0 에러, 같은 프로브가
    // `schedules` 에서는 TS2322). 자매 helper 4개는 이미 이 형태였고 여기만 예외였다.
    action: AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>;
    workspaceId: string;
    userId: string;
    resourceId: string;
    ipAddress?: string;
  }): Promise<void> {
    // named 필드 — positional 시그니처였다면 동일 타입(string) 인자 순서 스왑을
    // 컴파일러가 잡지 못해 감사 주체·대상이 조용히 뒤바뀔 수 있다 (code review W-1).
    return this.auditLogsService.record({
      workspaceId: params.workspaceId,
      userId: params.userId,
      action: params.action,
      resourceType: AUTH_CONFIG_RESOURCE_TYPE,
      resourceId: params.resourceId,
      ipAddress: params.ipAddress,
    });
  }

  async findAll(
    workspaceId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<AuthConfig>> {
    const { page = 1, limit = 20, search } = query;
    const qb = this.authConfigRepository
      .createQueryBuilder('ac')
      .where('ac.workspace_id = :workspaceId', { workspaceId });

    if (search) {
      qb.andWhere('ac.name ILIKE :search', { search: `%${search}%` });
    }
    qb.orderBy('ac.created_at', 'DESC');

    const totalItems = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    // 목록 응답은 secret 류 필드를 마스킹 (평문 노출은 create/regenerate/reveal 만).
    const masked = data.map((ac) => this.toMasked(ac));
    return PaginatedResponseDto.create(masked, totalItems, page, limit);
  }

  /**
   * 내부 전용 — 평문 config 를 그대로 반환. 호출자(실측, `findById(` 전수 grep):
   * findByIdForResponse / update / regenerate / remove / reveal / getUsage.
   */
  async findById(id: string, workspaceId: string): Promise<AuthConfig> {
    const config = await this.authConfigRepository.findOne({
      where: { id, workspaceId },
    });
    if (!config) this.throwAuthConfigNotFound();
    return config;
  }

  /**
   * 이 서비스의 «인증 설정을 찾을 수 없다» 단일 지점. 형제 서비스의
   * `throwTriggerNotFound`/`throwScheduleNotFound`/`throwIntegrationNotFound`/
   * `throwMemberNotFound` 와 같은 형태다.
   *
   * **`triggers.service.ts` 의 `AUTH_CONFIG_NOT_FOUND` 와 다른 자리다.** 그쪽은 트리거가
   * 참조하려는 인증 설정이 같은 워크스페이스에 없을 때의 **400 요청 검증 실패**이고
   * (이름은 `_NOT_FOUND` 지만 404 가 아닌 코드다. 404 가 아닌 `*_NOT_FOUND` 는 이 코드 말고도
   * 있다. 이름과 400 을 그대로 두는 결정은 NERV `CLE-API-ERRCODES` §6.14 에 있다),
   * 이쪽은 인증 설정 자체를 조회·삭제할 때의 **404 `RESOURCE_NOT_FOUND`** 다.
   * 이름이 가깝지만 상태 코드도 코드 문자열도 다르므로 한쪽을 다른 쪽에 맞추면 안 된다.
   */
  private throwAuthConfigNotFound(): never {
    throw new NotFoundException({
      code: 'RESOURCE_NOT_FOUND',
      message: 'Auth config not found',
    });
  }

  /** 외부 응답용 — secret 류 필드를 마스킹한 복제본. */
  async findByIdForResponse(
    id: string,
    workspaceId: string,
  ): Promise<AuthConfig> {
    return this.toMasked(await this.findById(id, workspaceId));
  }

  /**
   * AuthConfig 생성. 주 동작(저장) 성공 후 `auth_config.create` 감사 로그를 남긴다.
   * @param userId 작업 주체 — controller 가 `@CurrentUser('sub')` 로 전파.
   * @param ipAddress 요청 IP(`req.ip`) — 감사 로그에 기록 (auth_config 계열 공통).
   * @remarks 감사 기록은 best-effort 다 — `AuditLogsService.record` 가 실패를 내부에서
   *   swallow 하므로(해당 swallow 는 audit-logs.spec 에서 검증) audit DB 장애가
   *   본 CRUD 를 실패시키지 않는다(롤백 없음). reveal 및 update/regenerate/remove 동일 패턴.
   */
  async create(
    workspaceId: string,
    data: Partial<AuthConfig>,
    userId: string,
    ipAddress?: string,
  ): Promise<AuthConfig> {
    const config: Record<string, unknown> =
      (data.config as Record<string, unknown>) || {};
    assertConfigInput([
      ...(data.type === 'basic_auth'
        ? emptyBasicAuthFields(config, ['username', 'password'])
        : []),
      ...reservedConfigKeyFields(config),
    ]);

    // type 별 비밀값은 항상 제품이 자동 발급 — 사용자 입력 비밀값은 받지 않는다
    // (spec/1-data-model.md §2.17.1 / §2.17.3: "사용자 입력 옵션 제거, 자동 발급 강제").
    // hmac 의 header/algorithm 은 검증 메타라 사용자 입력을 보존하지만 secret 은 강제 발급.
    // basic_auth 는 username/password 사용자 입력 — 자동 발급 없음.
    issueSecret(data.type ?? '', config);
    if (data.type === 'hmac') fillHmacDefaults(config);

    const authConfig = this.authConfigRepository.create({
      ...data,
      config,
      workspaceId,
    });
    const saved = await this.authConfigRepository.save(authConfig);
    await this.recordAudit({
      action: AUDIT_ACTIONS.AUTH_CONFIG_CREATE,
      workspaceId,
      userId,
      resourceId: saved.id,
      ipAddress,
    });
    return saved;
  }

  /**
   * 수정 후 `auth_config.update` 감사 기록. userId/ipAddress·best-effort 계약은 {@link create} 참조.
   *
   * config 는 shallow-merge — 비밀값(key/token/secret/password)은 변경 불가.
   * `SECRET_CONFIG_KEYS` 에 해당하는 키는 configPatch 에 포함돼도 무시한다.
   * `id`·`workspaceId`·`type` 은 편집 폼의 불변 계약이므로 서비스 레이어에서도
   * 명시적으로 제외해 직접 호출 경로에서의 변경 의도 강제를 차단한다.
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<AuthConfig>,
    userId: string,
    ipAddress?: string,
  ): Promise<AuthConfig> {
    const config = await this.findById(id, workspaceId);
    // id·workspaceId·type 을 명시적으로 구조분해 제외 — DTO 레이어가 HTTP 경로를
    // 막지만 서비스 직접 호출 시에도 type 변경 의도를 강제 차단한다.
    // config 은 통째 대체가 아니라 shallow-merge — headerName 등 비-비밀 필드만
    // 보내는 편집 폼이 암호화 비밀값(key/token/secret)을 날리지 않게 한다.
    // 마스킹된 값(`***1234`)이 역류해도 무시해 실 비밀이 파손되지 않게 한다.
    const {
      config: configPatch,
      id: _id,
      workspaceId: _ws,
      type: _type,
      ...rest
    } = data;
    // Basic Auth 편집에서 바뀌는 값은 username 뿐이다(password 는 아래 비밀값 규칙대로 무시). 싣지 않은 PATCH 는 저장된 값을
    // 보지 않는다 — 빈 값으로 저장된 옛 설정도 이름 · 활성 상태는 고칠 수 있어야 한다. `__` 로 시작하는 키도 함께 모아
    // 한 응답으로 거부한다. 읽지 못한 설정이어도 이 검사가 먼저다. 아래 대입보다 먼저 거부해야 `findById` 가 돌려준
    // 엔티티가 반쯤 바뀐 채로 남지 않는다.
    if (configPatch && typeof configPatch === 'object') {
      assertConfigInput([
        ...(config.type === 'basic_auth' &&
        Object.hasOwn(configPatch, 'username')
          ? emptyBasicAuthFields(configPatch, ['username'])
          : []),
        ...reservedConfigKeyFields(configPatch),
      ]);
    }
    // 보내지 않은 필드는 뺀다(이유는 `omitUndefined` JSDoc). 빼지 않으면 응답에 `ipWhitelist` 가 null 로
    // 실리고 `isActive` 가 빠졌다 — `test/patch-partial-body.e2e-spec.ts` 가 고정한다.
    Object.assign(config, omitUndefined(rest));
    // 읽지 못한 설정에는 config 를 병합하지 않는다(REQ-AUTHCFG-031). 표식에 얹은 값은 재저장 때 `encryptJson` 이
    // 원래 저장값을 그대로 다시 써서 저장되지 않는다. 바뀌는 것은 이름 · IP 허용 목록 · 활성 상태뿐이다.
    if (
      configPatch &&
      typeof configPatch === 'object' &&
      !isUnreadableCredentials(config.config)
    ) {
      const merged: Record<string, unknown> = { ...config.config };
      for (const [k, v] of Object.entries(configPatch)) {
        if (SECRET_CONFIG_KEYS.has(k)) continue;
        merged[k] = v;
      }
      config.config = merged;
    }
    const saved = await this.authConfigRepository.save(config);
    await this.recordAudit({
      action: AUDIT_ACTIONS.AUTH_CONFIG_UPDATE,
      workspaceId,
      userId,
      resourceId: id,
      ipAddress,
    });
    return this.toMasked(saved);
  }

  /**
   * 제품이 발급한 비밀(key · token · secret)을 새로 발급하고 `auth_config.regenerate` 감사를 남긴다. 계약은
   * {@link create} 참조. 응답에는 새 비밀을 평문으로 싣는다. 이 응답 말고 다시 볼 길은 평문 보기다.
   *
   * - Basic Auth 는 400 `AUTH_CONFIG_REGENERATE_UNSUPPORTED` 로 거부한다(REQ-AUTHCFG-029). 사용자 이름과 비밀번호는
   *   사용자 입력이라 새로 발급할 값이 없고, 재생성을 통과시키면 평문 보기의 비밀번호 재확인 없이 비밀번호를
   *   돌려주게 된다. 저장 · 감사보다 먼저 거부한다.
   * - 읽을 수 있는 설정은 비밀만 바꾸고 헤더 이름 · 알고리즘은 그대로 둔다.
   * - 읽지 못한 설정은 표식을 버리고 생성 때와 같은 기본값의 새 설정을 저장한다(REQ-AUTHCFG-030). 표식에 새 비밀을
   *   얹으면 `encryptJson` 이 원래 저장값을 그대로 다시 써서 새 비밀이 저장되지 않는다.
   */
  async regenerate(
    id: string,
    workspaceId: string,
    userId: string,
    ipAddress?: string,
  ): Promise<AuthConfig> {
    const config = await this.findById(id, workspaceId);
    if (!REGENERATABLE_TYPES.has(config.type)) {
      throw new BadRequestException({
        code: 'AUTH_CONFIG_REGENERATE_UNSUPPORTED',
        message: `Regenerate is not supported for ${config.type} auth configs`,
      });
    }

    const unreadable = isUnreadableCredentials(config.config);
    const next: Record<string, unknown> = unreadable
      ? {}
      : { ...(config.config ?? {}) };
    issueSecret(config.type, next);
    if (unreadable && config.type === 'hmac') fillHmacDefaults(next);
    config.config = next;
    const saved = await this.authConfigRepository.save(config);
    await this.recordAudit({
      action: AUDIT_ACTIONS.AUTH_CONFIG_REGENERATE,
      workspaceId,
      userId,
      resourceId: id,
      ipAddress,
    });
    return { ...saved, config: this.toResponseConfig(saved.config) };
  }

  /** 삭제 후 `auth_config.delete` 감사 기록 (resourceId 는 삭제 전 id 보존). 계약은 {@link create} 참조. */
  async remove(
    id: string,
    workspaceId: string,
    userId: string,
    ipAddress?: string,
  ): Promise<void> {
    // 아래 `delete()` 의 `affected === 0` 판정과 기능적으로 겹친다(리뷰 INFO 1) — 그래도
    // 남긴다. 이 SELECT 가 «대상이 없으면 DELETE 를 시도하지 않는다» 는 fail-fast 계약이고,
    // 그 계약을 단위 테스트가 고정한다. 저빈도 관리자 액션의 왕복 1회를 아끼자고 그 계약을
    // 줄이는 거래는 하지 않는다.
    await this.findById(id, workspaceId);

    // 위 `findById` 는 잠그지 않으므로 동시 삭제 두 건이 **둘 다** 여기까지 온다. 종전의
    // `remove(config)` 는 0행이어도 던지지 않아 둘 다 감사를 남겼다 (실측: 한 id 에
    // `auth_config.delete` 2건). 형제 여섯(#1369~#1373)과 달리 이 경로엔 잠글 것이 없으므로 —
    // advisory lock 도 행 락도 없다 — 락을 새로 들이지 않고 **단일 원자적 DELETE** 로 가른다.
    // `DELETE … WHERE id = $1 AND workspace_id = $2` 한 문장은 그 자체로 원자적이라
    // 둘 중 하나만 1행을 지운다.
    //
    // 판정은 `affected === 0` **명시 비교**다. `null`·`undefined` 는 드라이버가 «보고하지
    // 않았다» 는 뜻이지 «지우지 못했다» 가 아니며, 그것을 0 과 같이 읽으면 정상 삭제를 404 로
    // 뒤집는다 (같은 규율: `rewriteTriggerConfigLocked`).
    //
    // `remove(entity)` → `delete(criteria)` 전환은 동작을 바꾸지 않는다(실측): `AuthConfig` 에
    // `cascade: true` 도 `@OneToMany` 도 없고, 저장소 전체에 ORM 라이프사이클 훅이 0건이다.
    // `trigger.auth_config_id` 의 `ON DELETE SET NULL`(`V001__initial_schema.sql:210`)은 DB
    // 레벨이라 두 방식 모두 동일하게 발화한다.
    const { affected } = await this.authConfigRepository.delete({
      id,
      workspaceId,
    });
    if (affected === 0) this.throwAuthConfigNotFound();

    await this.recordAudit({
      action: AUDIT_ACTIONS.AUTH_CONFIG_DELETE,
      workspaceId,
      userId,
      resourceId: id,
      ipAddress,
    });
  }

  /**
   * 평문 config 1회 노출. 현재 로그인 사용자의 비밀번호를 재확인하고 audit_log 에
   * 기록한다 (spec/2-navigation/6-config.md §A.4). 권한 게이트(Admin+)는 controller.
   */
  async reveal(
    id: string,
    workspaceId: string,
    userId: string,
    password: string,
    ipAddress?: string,
  ): Promise<{ config: Record<string, unknown> }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    // OAuth 단독 가입 사용자는 passwordHash 가 NULL — 비밀번호 재확인 불가.
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({
        code: 'AUTH_FAILED',
        message: 'Password confirmation required',
      });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'AUTH_FAILED',
        message: 'Password confirmation failed',
      });
    }
    const config = await this.findById(id, workspaceId);
    await this.recordAudit({
      action: AUDIT_ACTIONS.AUTH_CONFIG_REVEAL,
      workspaceId,
      userId,
      resourceId: id,
      ipAddress,
    });
    return { config: this.toResponseConfig(config.config) };
  }

  /**
   * Webhook 수신 시 인증 검증의 단일 진입 (spec/5-system/12-webhook.md §7 step 6).
   * authConfigId 로 AuthConfig 를 조회해 is_active / ip_whitelist / type 별 검증을
   * 수행하고, 성공 시 last_used_at 을 fire-and-forget 으로 갱신한다.
   * 실패는 type 무관 단일 401 AUTH_FAILED (enumeration·information leakage 차단).
   */
  async verifyWebhookRequest(
    authConfigId: string,
    workspaceId: string,
    ctx: WebhookAuthContext,
  ): Promise<void> {
    const ac = await this.authConfigRepository.findOne({
      where: { id: authConfigId, workspaceId },
    });
    if (!ac || !ac.isActive) {
      throw this.authFailed();
    }

    // ip_whitelist — 단일 IP 와 CIDR 표기(예: 10.0.0.0/8, 2001:db8::/32)를 모두 지원
    // (단일 IP 는 /32·/128 호스트로 취급). ip_whitelist 가 설정되면 클라이언트 IP 를 알 수
    // 없는 경우(헤더 strip·직접 연결)에도 거부한다 — 화이트리스트가 silent bypass 되지 않도록
    // (fail-closed). ip_whitelist 는 AuthConfig 종속이라 여기서만 시행.
    if (ac.ipWhitelist?.length) {
      if (!ctx.clientIp || !this.ipInWhitelist(ctx.clientIp, ac.ipWhitelist)) {
        throw this.authFailed();
      }
    }

    switch (ac.type) {
      case 'bearer_token':
        this.verifyBearer(ac, ctx);
        break;
      case 'api_key':
        this.verifyApiKey(ac, ctx);
        break;
      case 'basic_auth':
        this.verifyBasicAuth(ac, ctx);
        break;
      case 'hmac':
        this.verifyHmac(ac, ctx);
        break;
      default:
        throw this.authFailed();
    }

    // 성공 시에만 last_used_at 갱신 (실패 시 미갱신 — 활성 가시성 차단).
    // fire-and-forget: 트랜잭션 외, 실패해도 인증 결과에 영향 없음.
    void this.authConfigRepository
      .update({ id: ac.id }, { lastUsedAt: new Date() })
      .catch(() => undefined);
  }

  /**
   * clientIp 가 ip_whitelist 의 한 항목에 속하는지 검사. 각 항목은 단일 IP
   * (예: 10.0.0.1) 또는 CIDR (예: 10.0.0.0/8, 2001:db8::/32) — 단일 IP 는
   * /32(v4)·/128(v6) 호스트로 취급된다. clientIp 또는 항목이 파싱 불가하면
   * 매칭에서 제외(fail-closed). 서로 다른 주소 패밀리(v4 vs v6)는 교차 매칭하지
   * 않는다. dual-stack 소켓의 IPv4-mapped IPv6 (::ffff:1.2.3.4) 는 IPv4 로
   * 정규화해 v4 항목과 비교한다.
   */
  private ipInWhitelist(clientIp: string, whitelist: string[]): boolean {
    const client = this.parseIp(clientIp);
    if (!client) return false;
    return whitelist.some((entry) => {
      const range = this.parseIp(entry);
      if (!range || range.isV4 !== client.isV4) return false;
      try {
        return client.addr.isInSubnet(range.addr);
      } catch {
        return false;
      }
    });
  }

  /**
   * IP 문자열(단일 또는 CIDR)을 ip-address 객체로 파싱. IPv4-mapped IPv6 는
   * IPv4 로 정규화한다. 파싱 불가 시 null.
   */
  private parseIp(
    value: string,
  ): { addr: Address4 | Address6; isV4: boolean } | null {
    if (Address4.isValid(value)) {
      try {
        return { addr: new Address4(value), isV4: true };
      } catch {
        return null;
      }
    }
    if (Address6.isValid(value)) {
      try {
        const a6 = new Address6(value);
        if (a6.is4()) {
          return { addr: a6.to4(), isV4: true };
        }
        return { addr: a6, isV4: false };
      } catch {
        return null;
      }
    }
    return null;
  }

  private verifyBearer(ac: AuthConfig, ctx: WebhookAuthContext): void {
    const authHeader = ctx.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const expected = expectedString(ac.config?.token);
    if (!token || !expected || !this.constantTimeEquals(token, expected)) {
      throw this.authFailed();
    }
  }

  private verifyApiKey(ac: AuthConfig, ctx: WebhookAuthContext): void {
    const headerName = headerNameOrNull(
      ac.config?.headerName,
      API_KEY_DEFAULT_HEADER,
    );
    const provided = headerName ? (ctx.headers[headerName] ?? '') : '';
    const expected = expectedString(ac.config?.key);
    if (
      !provided ||
      !expected ||
      !this.constantTimeEquals(provided, expected)
    ) {
      throw this.authFailed();
    }
  }

  private verifyBasicAuth(ac: AuthConfig, ctx: WebhookAuthContext): void {
    const authHeader = ctx.headers['authorization'] ?? '';
    if (!authHeader.startsWith('Basic ')) {
      throw this.authFailed();
    }
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    const username = idx >= 0 ? decoded.slice(0, idx) : decoded;
    const passwd = idx >= 0 ? decoded.slice(idx + 1) : '';
    const expectedUser = expectedString(ac.config?.username);
    const expectedPass = expectedString(ac.config?.password);
    // 기대값이 비어 있으면 거부 — `Authorization: Basic Og==`(`:`)가 빈 값끼리 일치해 통과하는
    // 것을 막는다. 키를 바꿔 복호화하지 못한 설정(`__unreadable` 센티넬)과 문자열이 아닌 기대값도
    // 여기서 닫힌다(`verifyBearer` · `verifyApiKey` 와 같은 규칙).
    if (!expectedUser || !expectedPass) {
      throw this.authFailed();
    }
    const userOk = this.constantTimeEquals(username, expectedUser);
    const passOk = this.constantTimeEquals(passwd, expectedPass);
    if (!userOk || !passOk) {
      throw this.authFailed();
    }
  }

  private verifyHmac(ac: AuthConfig, ctx: WebhookAuthContext): void {
    const headerName = headerNameOrNull(ac.config?.header, HMAC_DEFAULT_HEADER);
    const algorithm = ac.config?.algorithm ?? HMAC_DEFAULT_ALGORITHM;
    // 허용 목록의 `has` 는 문자열이 아닌 값에 false 라 그런 algorithm 도 여기서 닫힌다.
    if (
      typeof algorithm !== 'string' ||
      !HMAC_ALLOWED_ALGORITHMS.has(algorithm)
    ) {
      throw this.authFailed();
    }
    const signature = headerName ? (ctx.headers[headerName] ?? '') : '';
    const secret = expectedString(ac.config?.secret);
    // 빈 secret 의 HMAC 은 누구나 계산할 수 있으므로 거부한다. 복호화하지 못한 설정
    // (`__unreadable` 센티넬)과 문자열이 아닌 secret 도 여기서 닫힌다.
    if (!signature || !ctx.rawBody || !secret) {
      throw this.authFailed();
    }
    const expected = `${algorithm}=${crypto
      .createHmac(algorithm, secret)
      .update(ctx.rawBody)
      .digest('hex')}`;
    if (!this.constantTimeEquals(signature, expected)) {
      throw this.authFailed();
    }
  }

  private authFailed(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'AUTH_FAILED',
      message: 'Authentication failed',
    });
  }

  /**
   * 길이가 다르면 즉시 false. timingSafeEqual 은 길이가 다르면 RangeError 를 던지므로
   * 사전 길이 비교가 없으면 외부 입력으로 요청 단위 DoS 가 가능하다.
   */
  private constantTimeEquals(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  }

  private toMasked(ac: AuthConfig): AuthConfig {
    return { ...ac, config: this.maskConfig(this.toResponseConfig(ac.config)) };
  }

  /**
   * 응답에 싣는 config. 복호화 불가 표식이면 원래 저장값(`__original_ciphertext`)을 뺀 복제본을 돌려주고, 표식이
   * 아니면 받은 객체를 그대로 돌려준다. 원래 저장값은 재저장 때 행을 그대로 다시 쓰려고 표식에 붙여 둔 값이다.
   * 옛 키가 공개 예시 값이던 배포라면 풀 수 있으므로 조회 · 편집 · 평문 보기 어느 응답에도 싣지 않는다. 엔티티는
   * 바꾸지 않는다.
   */
  private toResponseConfig(
    config: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!isUnreadableCredentials(config)) return config;
    const { [UNREADABLE_ORIGINAL_KEY]: _original, ...rest } = config;
    return rest;
  }

  private maskConfig(config: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(config ?? {})) {
      if (SECRET_CONFIG_KEYS.has(k) && typeof v === 'string') {
        out[k] = v.length >= 4 ? `***${v.slice(-4)}` : '***';
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  /**
   * §A.3 인증 설정 사용 내역 조회.
   *
   * 반환 shape:
   * - totalCalls: 해당 인증 설정에 연결된 모든 트리거의 누적 실행 수.
   * - lastUsedAt: AuthConfig.last_used_at (webhook 인증 성공 시 갱신).
   * - periodCounts: 롤링 윈도(24h/7d/30d) 기준 호출 건수. 각 윈도는 현재 시각 기준
   *   rolling — 캘린더 버킷(일/주/월 경계) 아님. DB NULL 반환 시 0 폴백.
   * - recentCalls: 최근 20건 실행 목록 (started_at DESC). sourceIp 는 webhook/
   *   chat-channel 발화 시에만 캡처, 비-HTTP 트리거는 null. responseCode 는 webhook 실제
   *   HTTP 코드(성공 경로 = '202'); 저장된 코드가 없으면(비-HTTP 트리거) status enum 으로 폴백.
   *
   * 쿼리 3개(getCount/getRawOne/getMany)는 서로 독립적이므로 Promise.all 로 병렬 실행한다
   * (단, 트리거가 없으면 early return 으로 DB 왕복 자체를 생략).
   *
   * @see spec/2-navigation/6-config.md §A.3
   * @see spec/1-data-model.md §2.13 — AuthConfig 호출 집계 경로 SoT
   */
  async getUsage(
    id: string,
    workspaceId: string,
  ): Promise<{
    totalCalls: number;
    lastUsedAt: Date | null;
    periodCounts: { last24h: number; last7d: number; last30d: number };
    recentCalls: Array<{
      id: string;
      triggerName: string;
      status: string;
      startedAt: Date;
      sourceIp: string | null;
      responseCode: string;
    }>;
  }> {
    const config = await this.findById(id, workspaceId);

    const triggers = await this.triggerRepository.find({
      where: { authConfigId: id },
    });
    const triggerIds = triggers.map((t) => t.id);

    if (triggerIds.length === 0) {
      return {
        totalCalls: 0,
        lastUsedAt: config.lastUsedAt,
        periodCounts: { last24h: 0, last7d: 0, last30d: 0 },
        recentCalls: [],
      };
    }

    // 3개 쿼리는 서로 독립 — Promise.all 로 병렬 실행해 레이턴시 절감 (W-4).
    const now = Date.now();
    const [totalCalls, periodRaw, recentExecutions] = await Promise.all([
      this.executionRepository
        .createQueryBuilder('e')
        .where('e.trigger_id IN (:...triggerIds)', { triggerIds })
        .getCount(),

      // 기간별 호출 수 — 단일 쿼리에서 롤링 윈도 3종을 조건부 집계(COUNT FILTER).
      this.executionRepository
        .createQueryBuilder('e')
        .select('COUNT(*) FILTER (WHERE e.started_at >= :since24h)', 'last24h')
        .addSelect('COUNT(*) FILTER (WHERE e.started_at >= :since7d)', 'last7d')
        .addSelect(
          'COUNT(*) FILTER (WHERE e.started_at >= :since30d)',
          'last30d',
        )
        .where('e.trigger_id IN (:...triggerIds)', { triggerIds })
        .setParameters({
          since24h: new Date(now - USAGE_PERIOD_WINDOWS_MS.last24h),
          since7d: new Date(now - USAGE_PERIOD_WINDOWS_MS.last7d),
          since30d: new Date(now - USAGE_PERIOD_WINDOWS_MS.last30d),
        })
        .getRawOne<{ last24h: string; last7d: string; last30d: string }>(),

      this.executionRepository
        .createQueryBuilder('e')
        .innerJoinAndSelect('e.trigger', 't')
        .where('e.trigger_id IN (:...triggerIds)', { triggerIds })
        .orderBy('e.started_at', 'DESC')
        .limit(USAGE_RECENT_CALLS_LIMIT)
        .getMany(),
    ]);

    const periodCounts = {
      last24h: safeUsageCount(periodRaw?.last24h),
      last7d: safeUsageCount(periodRaw?.last7d),
      last30d: safeUsageCount(periodRaw?.last30d),
    };

    return {
      totalCalls,
      lastUsedAt: config.lastUsedAt,
      periodCounts,
      recentCalls: recentExecutions.map((e) => ({
        id: e.id,
        triggerName: e.trigger?.name ?? 'Unknown',
        status: e.status,
        startedAt: e.startedAt,
        sourceIp: e.sourceIp ?? null,
        // 비-HTTP 트리거(schedule 등)는 response_code NULL → status enum 으로 폴백 표시.
        responseCode: e.responseCode ?? e.status,
      })),
    };
  }
}
