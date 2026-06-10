import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createTransport } from 'nodemailer';
import { isSmtpHostBlocked } from '../../common/utils/smtp-host-guard';
import { Integration } from './entities/integration.entity';
import { getAppBaseUrl } from '../../common/utils/app-base-url';
import { IntegrationUsageLog } from './entities/integration-usage-log.entity';
import { Node } from '../nodes/entities/node.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  IntegrationOAuthService,
  type BeginResult,
} from './integration-oauth.service';
import {
  buildCafe24InstallUrl,
  buildMakeshopInstallUrl,
} from './third-party-oauth.constants';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import {
  ListIntegrationsQueryDto,
  CreateIntegrationDto,
  UpdateIntegrationDto,
  RotateCredentialsDto,
  RequestScopesDto,
  UpdateScopeDto,
  PreviewTestDto,
} from './dto/integration.dto';
import {
  SERVICE_REGISTRY,
  findService,
  findVariant,
  maskCredentials,
  validateCredentials,
} from './services/service-registry';
import { isUnreadableCredentials } from './services/credentials-transformer';
import {
  ConnectionPreview,
  McpTestConnectionService,
} from '../mcp/mcp-test-connection.service';
import {
  MCP_ERROR_CODES,
  MCP_ERROR_MESSAGE_MAX_LEN,
} from '../mcp/mcp-error-codes';
import {
  McpConnectParams,
  ServerCapabilities,
  ServerInfo,
} from '../mcp/mcp-client.service';
import { listAllCafe24Operations } from '../../nodes/integration/cafe24/metadata';
import { listAllMakeshopOperations } from '../../nodes/integration/makeshop/metadata';
import { OperationCatalogDto } from './dto/responses/integration-response.dto';
import {
  STORE_IDENTIFIER_UNIQUE_CONSTRAINT,
  ALREADY_CONNECTED_BY_SERVICE,
  GENERIC_ALREADY_CONNECTED,
} from './integrations.constants';

/**
 * Public shape returned to the integrations UI for both `previewTest` and
 * `testConnection`. `success`/`message` are universal; `capabilities`,
 * `serverInfo`, `preview` are populated only for `service_type='mcp'`.
 */
export interface IntegrationTestResult {
  success: boolean;
  message: string;
  /** Failure code (e.g. `MCP_*` 또는 email 의 `EMAIL_CONNECT_FAILED`); absent on success. */
  code?: string;
  capabilities?: ServerCapabilities;
  serverInfo?: ServerInfo;
  preview?: ConnectionPreview;
}

/**
 * Strategy for performing the per-service transport test invoked from
 * {@link IntegrationsService.dispatchTest}. New services register a tester
 * here so {@link dispatchTest} stays closed against modification.
 */
type TransportTester = (
  authType: string,
  credentials: Record<string, unknown>,
) => Promise<IntegrationTestResult>;

/**
 * Entity-aware variant — receives the persisted Integration row so the tester
 * can use side-effects like proactive token refresh, status transitions, or
 * DB-backed retry state. Registered out-of-band by infrastructure modules
 * that own these side-effects (e.g. Cafe24Module → registers cafe24's
 * `pingConnection` here so IntegrationsModule never has to depend on
 * `nodes/*`). Falls through to {@link TransportTester} when not registered.
 */
export type EntityAwareTester = (
  integration: Integration,
) => Promise<IntegrationTestResult>;

const ADMIN_ROLES = new Set(['owner', 'admin']);

/**
 * Clamp a free-form error message to {@link MCP_ERROR_MESSAGE_MAX_LEN} so a
 * misbehaving external server cannot inflate the `last_error` JSONB column.
 * The same bound is applied to `IntegrationUsageLog.error.message` for
 * consistency.
 */
/** email(SMTP) 연결 테스트의 connection/greeting/socket 공통 타임아웃 (ms). */
const SMTP_TEST_TIMEOUT_MS = 10_000;

function clampMessage(raw: string | undefined): string {
  if (!raw) return 'Unknown error';
  return raw.length > MCP_ERROR_MESSAGE_MAX_LEN
    ? raw.slice(0, MCP_ERROR_MESSAGE_MAX_LEN)
    : raw;
}

/**
 * `integration_usage_log.api_{label,method,path}` 컬럼의 길이 제약 (각각 128/8/256)
 * 을 넘는 입력은 끝에 `…` (U+2026) 를 부착해 잘라 저장한다. SoT:
 * `spec/conventions/cafe24-api-metadata.md §7.5` 와 INT-US-05. `clampMessage` 와
 * 달리 ellipsis 가 들어가는 이유는 UI 가 잘린 사실을 사용자에게 시각적으로
 * 노출하기 위함 (path 가 미묘하게 다르게 보이면 디버깅 혼란을 막을 수 있다).
 */
function clampApiField(
  raw: string | null | undefined,
  max: number,
): string | null {
  if (raw === null || raw === undefined) return null;
  if (raw.length === 0) return null;
  if (raw.length <= max) return raw;
  if (max <= 1) return raw.slice(0, max);
  return raw.slice(0, max - 1) + '…';
}

/**
 * provider operation 메타데이터 리스트를 `OperationCatalogDto` 로 투영한다.
 * cafe24·makeshop 의 catalog key 조립이 동일해 (`<provider>.<resource>.<id>`)
 * 단일 헬퍼로 묶는다 — `key`/`labelKey` 동일성과 `descriptionKey` suffix
 * 규칙을 한곳에서 보장. 새 provider 추가 시 분기 한 줄만 늘리면 된다.
 */
function buildOperationCatalog(
  provider: 'cafe24' | 'makeshop',
  ops: ReadonlyArray<{
    resource: string;
    operation: { id: string; method: string; path: string };
  }>,
): OperationCatalogDto {
  const operations = ops.map(({ resource, operation }) => {
    const key = `${provider}.${resource}.${operation.id}`;
    return {
      key,
      method: operation.method,
      path: operation.path,
      labelKey: key,
      descriptionKey: `${key}.description`,
    };
  });
  return { operations };
}

export const API_LABEL_MAX = 128;
export const API_METHOD_MAX = 8;
export const API_PATH_MAX = 256;

export interface IntegrationUsageNode {
  id: string;
  label: string;
  type: string;
}

export interface IntegrationUsageWorkflow {
  workflowId: string;
  workflowName: string;
  isActive: boolean;
  nodes: IntegrationUsageNode[];
}

export type CredentialsStatus = 'ok' | 'needs_reauth';

/**
 * Safe-to-expose hints derived from credentials. Frontend must use these
 * instead of poking at the encrypted `credentials` blob — e.g. for deciding
 * whether the Reauthorize button is enabled (Cafe24 Private apps have no
 * reauthorize entry point). Only Cafe24 currently emits anything here.
 */
export interface IntegrationMeta {
  appType: 'public' | 'private' | null;
}

/**
 * Service-specific derived fields exposed on the API response — `meta.appType`
 * (this `IntegrationMeta`) plus the top-level `appUrl` (built in `toPublic`).
 * C-6: these were cafe24-hardcoded; now each service registers its own
 * derivation fn in {@link INTEGRATION_DERIVED_REGISTRY} keyed by `serviceType`.
 */
export interface IntegrationDerivedFields {
  appType: IntegrationMeta['appType'];
  /**
   * Actionable install/App URL for the integration's detail page, or `null`.
   * cafe24 Private 통합은 `${APP_URL}/api/3rd-party/cafe24/install/:installToken`.
   * makeshop ShopStore 설치 URL 은 Phase 3 (install controller) 에서 채운다.
   */
  appUrl: string | null;
}

/**
 * Context threaded into a service's derivation fn for fields that need
 * request-time inputs not present on the entity itself (the configured app
 * base URL, the install token, etc.). `buildIntegrationMeta` (appType-only,
 * standalone) passes no context — only `toPublic` supplies it when it also
 * needs `appUrl`.
 */
export interface IntegrationDerivedContext {
  appBaseUrl: string;
}

/**
 * Per-service derivation of {@link IntegrationDerivedFields}. Registered by
 * `serviceType` so adding a provider no longer means editing a cafe24-shaped
 * `if` chain. Each fn receives the entity (with already-decrypted credentials)
 * and an optional context; it returns only the fields it owns — callers merge
 * over a `{ appType: null, appUrl: null }` baseline. Implementations assume
 * `credentials` is readable (the dispatcher short-circuits unreadable rows to
 * the all-null baseline before calling).
 *
 * SoT: spec/2-navigation/4-integration.md §9.2 (C-6 derived-field 일반화),
 * spec/4-nodes/4-integration/5-makeshop.md §9.8.
 */
/**
 * The minimal entity shape a derivation fn reads. `installToken` is optional so
 * the standalone `buildIntegrationMeta` (appType-only, no install URL) can pass
 * a row projection without it.
 */
type DerivedEntityInput = Pick<Integration, 'serviceType' | 'credentials'> & {
  installToken?: Integration['installToken'];
};

type IntegrationDerivedFn = (
  entity: DerivedEntityInput,
  ctx?: IntegrationDerivedContext,
) => Partial<IntegrationDerivedFields>;

const DERIVED_BASELINE: IntegrationDerivedFields = {
  appType: null,
  appUrl: null,
};

export const INTEGRATION_DERIVED_REGISTRY = new Map<
  string,
  IntegrationDerivedFn
>([
  // cafe24 — behavior-preserving: appType from credentials.app_type, appUrl
  // for Private apps with an install_token (verbatim from the old hardcoded
  // paths). spec/2-navigation/4-integration.md §4.2 + §9.1 + Rationale
  // "Cafe24 App URL 상세 페이지 표시".
  [
    'cafe24',
    (entity, ctx): Partial<IntegrationDerivedFields> => {
      const appTypeRaw = entity.credentials?.app_type;
      const appType =
        appTypeRaw === 'public' || appTypeRaw === 'private' ? appTypeRaw : null;
      let appUrl: string | null = null;
      if (
        appType === 'private' &&
        ctx &&
        typeof entity.installToken === 'string' &&
        entity.installToken.length > 0
      ) {
        appUrl = buildCafe24InstallUrl(ctx.appBaseUrl, entity.installToken);
      }
      return { appType, appUrl };
    },
  ],
  // makeshop — no app_type (confidential-client single form). appUrl is the
  // ShopStore install App URL (`${APP_URL}/api/3rd-party/makeshop/install/
  // :installToken`), built when the row has an install_token (Phase 3 install
  // controller now exists). autoRefresh / mall_id (=shop_uid) projection flow
  // through the generic service-registry paths, not here.
  // spec/2-navigation/4-integration.md §5.9 설치(ShopStore) + makeshop node §9.8.
  [
    'makeshop',
    (entity, ctx): Partial<IntegrationDerivedFields> => {
      let appUrl: string | null = null;
      if (
        ctx &&
        typeof entity.installToken === 'string' &&
        entity.installToken.length > 0
      ) {
        appUrl = buildMakeshopInstallUrl(ctx.appBaseUrl, entity.installToken);
      }
      return { appType: null, appUrl };
    },
  ],
]);

/**
 * Compute the full set of service-specific derived fields for a row. Unreadable
 * credentials short-circuit to the all-null baseline (no decrypt → no peek, and
 * appUrl needs app_type which we cannot read). Services without a registry
 * entry also get the baseline.
 */
export function buildDerivedFields(
  entity: DerivedEntityInput,
  ctx?: IntegrationDerivedContext,
  credsUnreadable: boolean = isUnreadableCredentials(entity.credentials),
): IntegrationDerivedFields {
  if (credsUnreadable) return { ...DERIVED_BASELINE };
  const fn = INTEGRATION_DERIVED_REGISTRY.get(entity.serviceType);
  if (!fn) return { ...DERIVED_BASELINE };
  return { ...DERIVED_BASELINE, ...fn(entity, ctx) };
}

/**
 * Build the safe-to-expose meta hints (`appType`). Thin wrapper over
 * {@link buildDerivedFields} that projects out just the `meta` slice — kept as
 * a named export so existing callers/tests stay stable. `credsUnreadable` lets
 * the caller skip a duplicate `isUnreadableCredentials` call.
 *
 * Pure helper (no class state) — directly unit-testable.
 */
export function buildIntegrationMeta(
  entity: DerivedEntityInput,
  credsUnreadable: boolean = isUnreadableCredentials(entity.credentials),
): IntegrationMeta {
  // appType needs no context — install URL is the only ctx-dependent field.
  const { appType } = buildDerivedFields(entity, undefined, credsUnreadable);
  return { appType };
}

export type PublicIntegration = Omit<
  Integration,
  'credentials' | 'installToken' | 'installTokenIssuedAt'
> & {
  credentials: Record<string, unknown>;
  credentialsStatus: CredentialsStatus;
  meta: IntegrationMeta;
  /**
   * Cafe24 Private 통합 한정의 actionable URL. Cafe24 Developers Console
   * 의 "앱 URL" 갱신용으로 상세 페이지의 Cafe24 App URL 카드가 노출한다.
   * `${APP_URL}/api/3rd-party/cafe24/install/:installToken` 형식이며,
   * 그 외 통합은 항상 `null`. `installToken` 은 본 URL 의 path segment 안
   * 에만 존재하며 별도 필드로 노출되지 않는다 (식별자 분산 방지 —
   * spec/2-navigation/4-integration.md Rationale "Cafe24 App URL 상세
   * 페이지 표시" 참조).
   */
  appUrl: string | null;
  /**
   * Derived 가상 필드 — `ServiceDefinition.supportsTokenAutoRefresh`
   * (`service-registry.ts`) 에서 매 응답 시점에 계산. DB 컬럼 아님.
   * UI 의 attention/expiring 술어, 상세 페이지 헤더의 "Auto-renews"
   * 보조 라벨, Reauthorize hover 안내 분기 신호.
   *
   * spec/2-navigation/4-integration.md §9.1 + Rationale "자동 갱신 통합을
   * attention 술어에서 제외 (2026-05-17)" + spec/1-data-model.md §2.10
   * "응답 DTO 전용 derived 필드".
   */
  autoRefresh: boolean;
};

/**
 * Thrown when execution-engine code paths try to use an integration whose
 * stored credentials cannot be decrypted (key rotation / corruption). The
 * caller must surface this to the user as a 400 with a reconnect hint rather
 * than attempt the outbound call with empty credentials.
 */
export class IntegrationCredentialsUnreadableError extends BadRequestException {
  constructor(integrationId: string) {
    super({
      code: 'INTEGRATION_CREDENTIALS_UNREADABLE',
      message:
        'Integration credentials could not be decrypted — reconnect required',
      integrationId,
    });
  }
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);
  /**
   * Map of `service_type` → transport-level test. Services without an entry
   * fall back to the structural-only validation in {@link dispatchTest}.
   */
  private readonly transportTesters: Map<string, TransportTester>;

  /**
   * Map of `service_type` → entity-aware test. Populated at runtime by
   * infrastructure modules via {@link registerEntityTester}. Used only by
   * {@link testConnection} (saved integration), not by {@link previewTest}
   * (entity does not yet exist).
   */
  private readonly entityTesters = new Map<string, EntityAwareTester>();

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    @InjectRepository(IntegrationUsageLog)
    private readonly usageLogRepository: Repository<IntegrationUsageLog>,
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
    private readonly workspacesService: WorkspacesService,
    private readonly oauthService: IntegrationOAuthService,
    private readonly auditLogsService: AuditLogsService,
    private readonly mcpTestConnection: McpTestConnectionService,
  ) {
    this.transportTesters = new Map<string, TransportTester>([
      ['mcp', this.testMcpTransport.bind(this)],
      ['email', this.testEmailTransport.bind(this)],
    ]);
  }

  /**
   * Out-of-band registration of an entity-aware tester for a given
   * `service_type`. Called by infrastructure modules at startup
   * (Cafe24Module.onModuleInit) so this module never has to depend on
   * `nodes/*` directly.
   *
   * **Calling contract** — invoke once per service_type from the owning
   * module's `onModuleInit`. Re-registration is allowed (test resets) but
   * emits a warning so production wiring drift surfaces in logs. The tester
   * itself MUST not throw — return a failure result instead, since
   * {@link testConnection} surfaces the result as-is to the HTTP response.
   */
  registerEntityTester(serviceType: string, tester: EntityAwareTester): void {
    if (this.entityTesters.has(serviceType)) {
      this.logger.warn(
        `Overwriting existing entity-aware tester for service_type='${serviceType}' — likely duplicate registration in module wiring`,
      );
    }
    this.entityTesters.set(serviceType, tester);
  }

  // ---------------------------------------------------------------
  // Listing
  // ---------------------------------------------------------------

  async findAll(
    workspaceId: string,
    query: ListIntegrationsQueryDto,
  ): Promise<PaginatedResponseDto<PublicIntegration>> {
    const { page = 1, limit = 20, q, scope, serviceType, status } = query;

    const qb = this.integrationRepository
      .createQueryBuilder('i')
      .where('i.workspace_id = :workspaceId', { workspaceId });

    if (q) {
      qb.andWhere('i.name ILIKE :search', { search: `%${q}%` });
    }
    if (scope && scope !== 'all') {
      qb.andWhere('i.scope = :scope', { scope });
    }
    if (serviceType && serviceType.length > 0) {
      qb.andWhere('i.service_type IN (:...serviceTypes)', {
        serviceTypes: serviceType,
      });
    }
    // EXPIRING_SOON_INTERVAL — 7 days threshold shared with frontend
    // `EXPIRING_SOON_DAYS` (status-badge.tsx). Update both layers together.
    // spec/2-navigation/4-integration.md §2.3, §2.4, §11.4.
    const EXPIRING_SOON_INTERVAL = "INTERVAL '7 days'";
    if (status === 'connected') {
      qb.andWhere('i.status = :s', { s: 'connected' }).andWhere(
        `(i.token_expires_at IS NULL OR i.token_expires_at > NOW() + ${EXPIRING_SOON_INTERVAL})`,
      );
    } else if (status === 'expiring') {
      qb.andWhere('i.status = :s', { s: 'connected' })
        .andWhere('i.token_expires_at IS NOT NULL')
        .andWhere(`i.token_expires_at <= NOW() + ${EXPIRING_SOON_INTERVAL}`)
        .andWhere('i.token_expires_at > NOW()');
    } else if (status === 'expired') {
      qb.andWhere('i.status = :s', { s: 'expired' });
    } else if (status === 'error') {
      qb.andWhere('i.status = :s', { s: 'error' });
    } else if (status === 'attention') {
      // Virtual filter — Expired ∪ Error ∪ (Connected within 7d).
      // pending_install is excluded by design (spec §2.4): it represents an
      // active external flow (Cafe24 Developers "Test Run") in progress, not
      // a state that needs the user's attention here.
      qb.andWhere(
        `(i.status IN ('expired', 'error')
          OR (i.status = 'connected'
              AND i.token_expires_at IS NOT NULL
              AND i.token_expires_at > NOW()
              AND i.token_expires_at <= NOW() + ${EXPIRING_SOON_INTERVAL}))`,
      );
    }

    qb.orderBy('i.created_at', 'DESC');

    const totalItems = await qb.getCount();
    const rows = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const data = rows.map((row) => this.toPublic(row));
    return PaginatedResponseDto.create(data, totalItems, page, limit);
  }

  async findById(id: string, workspaceId: string): Promise<PublicIntegration> {
    const row = await this.integrationRepository.findOne({
      where: { id, workspaceId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Integration not found',
      });
    }
    return this.toPublic(row);
  }

  // ---------------------------------------------------------------
  // Create / Update
  // ---------------------------------------------------------------

  async create(
    workspaceId: string,
    userId: string,
    userRole: string | null,
    body: CreateIntegrationDto,
  ): Promise<PublicIntegration> {
    this.validateServiceAndAuth(body.serviceType, body.authType);

    const requestedScope = body.scope ?? 'personal';
    if (requestedScope === 'organization' && !this.isAdmin(userRole)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message:
          'Admin role is required to create organization-scope integrations',
      });
    }

    let credentials: Record<string, unknown> = body.credentials ?? {};
    let tokenExpiresAt: Date | null = null;
    if (body.previewToken) {
      const preview = await this.oauthService.consumePreviewToken(
        body.previewToken,
        workspaceId,
        userId,
      );
      if (preview.serviceType !== body.serviceType) {
        throw new BadRequestException({
          code: 'OAUTH_PREVIEW_MISMATCH',
          message: 'Preview token does not match the selected service',
        });
      }
      credentials = { ...credentials, ...preview.credentials };
      tokenExpiresAt = preview.tokenExpiresAt;
    }

    const errors = validateCredentials(
      body.serviceType,
      body.authType,
      credentials,
    );
    if (errors.length) {
      throw new BadRequestException({
        code: 'INTEGRATION_INVALID_CREDENTIALS',
        message: errors.join('; '),
      });
    }

    const entity = this.integrationRepository.create({
      workspaceId,
      createdBy: userId,
      serviceType: body.serviceType,
      name: body.name,
      authType: body.authType,
      credentials,
      scope: requestedScope,
      status: 'connected',
      tokenExpiresAt,
      // lastRotatedAt 을 명시 초기화한다. 본 컬럼은
      // `IntegrationExpiryScannerService.enqueueCafe24BackgroundRefresh` 의
      // cutoff 비교 (`LessThan(now - 10d)`) 에 사용된다. NULL 로 저장하면
      // PostgreSQL 의 NULL < value = NULL (FALSE) 시맨틱으로 row 가
      // background refresh 대상에서 영원히 제외 → 신규 Cafe24 통합이 14일
      // idle 시 refresh_token 까지 만료되어 PR #56 의 idle 보호가 무력화된다.
      // 발급 시점을 기록해 cutoff 비교가 의도대로 동작하게 한다.
      lastRotatedAt: new Date(),
    });

    // 트랜잭션 미적용 + best-effort audit 의도 — spec/2-navigation/4-integration.md
    // §9.2 Rationale "Cafe24 Public 흐름의 begin-time 사전 가드 추가" 항목 끝의
    // create() 트레이드오프 분석 참조. 요약: (a) save() 단일 INSERT 가 atomic,
    // (b) audit 실패는 row commit 후 swallow (사용자 흐름 깨지지 않음),
    // (c) preview_token 은 capability token 으로 race-loser 재사용 차단이 의도.
    // ai-review W23 (2026-05-16) + INFO 10 (audit 별도 try/catch backstop).
    let saved!: Integration;
    try {
      saved = await this.integrationRepository.save(entity);
    } catch (err) {
      this.throwIfUniqueViolation(err, body.serviceType);
      throw err;
    }
    // audit 기록은 best-effort — row 는 이미 commit 됐으므로 audit 실패가
    // 호출자에게 500 으로 노출되면 안 된다. AuditLogsService.record 자체도
    // 내부 try/catch 로 swallow 하지만, 방어선을 본 메서드에도 둬서 향후
    // record 구현이 throw 하도록 변경돼도 회귀 없게 한다.
    try {
      await this.auditLogsService.record({
        workspaceId,
        userId,
        action: 'integration.created',
        resourceType: 'integration',
        resourceId: saved.id,
        details: {
          serviceType: saved.serviceType,
          authType: saved.authType,
          scope: saved.scope,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to record audit log for integration.created id=${saved.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    return this.toPublic(saved);
  }

  async update(
    id: string,
    workspaceId: string,
    userId: string,
    body: UpdateIntegrationDto,
  ): Promise<PublicIntegration> {
    const entity = await this.integrationRepository.findOne({
      where: { id, workspaceId },
    });
    if (!entity) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Integration not found',
      });
    }
    const changes: Record<string, unknown> = {};
    if (body.name !== undefined && body.name !== entity.name) {
      changes.name = { from: entity.name, to: body.name };
      entity.name = body.name;
    }
    try {
      const saved = await this.integrationRepository.save(entity);
      if (Object.keys(changes).length > 0) {
        await this.auditLogsService.record({
          workspaceId,
          userId,
          action: 'integration.updated',
          resourceType: 'integration',
          resourceId: saved.id,
          details: changes,
        });
      }
      return this.toPublic(saved);
    } catch (err) {
      this.throwIfUniqueViolation(err, entity.serviceType);
      throw err;
    }
  }

  async remove(id: string, workspaceId: string, userId: string): Promise<void> {
    const entity = await this.integrationRepository.findOne({
      where: { id, workspaceId },
    });
    if (!entity) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Integration not found',
      });
    }

    const usages = await this.getUsages(id, workspaceId);
    if (usages.length > 0) {
      throw new ConflictException({
        code: 'INTEGRATION_IN_USE',
        message: 'Integration is still referenced by workflow nodes',
        usages,
      });
    }

    await this.integrationRepository.remove(entity);
    await this.auditLogsService.record({
      workspaceId,
      userId,
      action: 'integration.deleted',
      resourceType: 'integration',
      resourceId: id,
      details: {
        serviceType: entity.serviceType,
        name: entity.name,
      },
    });
  }

  // ---------------------------------------------------------------
  // Usage tracking
  // ---------------------------------------------------------------

  async getUsages(
    id: string,
    workspaceId: string,
  ): Promise<IntegrationUsageWorkflow[]> {
    // Verify integration belongs to workspace (throws if missing).
    await this.findById(id, workspaceId);

    const rows: Array<{
      node_id: string;
      node_label: string;
      node_type: string;
      workflow_id: string;
      workflow_name: string;
      is_active: boolean;
    }> = await this.nodeRepository
      .createQueryBuilder('n')
      .innerJoin(Workflow, 'w', 'w.id = n.workflow_id')
      .where('w.workspace_id = :workspaceId', { workspaceId })
      .andWhere("n.config ->> 'integrationId' = :integrationId", {
        integrationId: id,
      })
      .select('n.id', 'node_id')
      .addSelect('n.label', 'node_label')
      .addSelect('n.type', 'node_type')
      .addSelect('w.id', 'workflow_id')
      .addSelect('w.name', 'workflow_name')
      .addSelect('w.is_active', 'is_active')
      .orderBy('w.name', 'ASC')
      .addOrderBy('n.label', 'ASC')
      .getRawMany();

    const grouped = new Map<string, IntegrationUsageWorkflow>();
    for (const r of rows) {
      let bucket = grouped.get(r.workflow_id);
      if (!bucket) {
        bucket = {
          workflowId: r.workflow_id,
          workflowName: r.workflow_name,
          isActive: r.is_active,
          nodes: [],
        };
        grouped.set(r.workflow_id, bucket);
      }
      bucket.nodes.push({
        id: r.node_id,
        label: r.node_label,
        type: r.node_type,
      });
    }
    return [...grouped.values()];
  }

  async getActivity(
    id: string,
    workspaceId: string,
    limit: number,
    days: number,
  ): Promise<{
    items: IntegrationUsageLog[];
    summary: {
      totalCalls: number;
      successRate: number;
      dailyCounts: Array<{ date: string; count: number; failed: number }>;
    };
  }> {
    await this.findById(id, workspaceId);
    const effectiveLimit = Math.min(Math.max(limit, 1), 100);
    const effectiveDays = Math.min(Math.max(days, 1), 30);

    const since = new Date(Date.now() - effectiveDays * 24 * 60 * 60 * 1000);

    const items = await this.usageLogRepository
      .createQueryBuilder('u')
      .where('u.integration_id = :id', { id })
      .andWhere('u.at >= :since', { since })
      .orderBy('u.at', 'DESC')
      .limit(effectiveLimit)
      .getMany();

    const summaryRows: Array<{
      day: string;
      total: string;
      failed: string;
    }> = await this.usageLogRepository
      .createQueryBuilder('u')
      .where('u.integration_id = :id', { id })
      .andWhere('u.at >= :since', { since })
      .select("DATE_TRUNC('day', u.at)::date::text", 'day')
      .addSelect('COUNT(*)', 'total')
      .addSelect("COUNT(*) FILTER (WHERE u.status = 'failed')", 'failed')
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany();

    const totalCalls = summaryRows.reduce((acc, r) => acc + Number(r.total), 0);
    const failedCalls = summaryRows.reduce(
      (acc, r) => acc + Number(r.failed),
      0,
    );
    const successRate =
      totalCalls === 0 ? 1 : (totalCalls - failedCalls) / totalCalls;

    return {
      items,
      summary: {
        totalCalls,
        successRate,
        dailyCounts: summaryRows.map((r) => ({
          date: r.day,
          count: Number(r.total),
          failed: Number(r.failed),
        })),
      },
    };
  }

  // ---------------------------------------------------------------
  // Testing / Rotation / Scopes
  // ---------------------------------------------------------------

  async testConnection(
    id: string,
    workspaceId: string,
  ): Promise<IntegrationTestResult> {
    const entity = await this.requireEntity(id, workspaceId);
    if (isUnreadableCredentials(entity.credentials)) {
      return {
        success: false,
        code: 'INTEGRATION_CREDENTIALS_UNREADABLE',
        message:
          'Credentials cannot be decrypted with the current key. Reconnect to rebuild this integration.',
      };
    }
    // pending_install: token not yet issued — external probe is meaningless.
    // Backend backstop for the UI's disabled Test-connection button (§4.2).
    // service_type-agnostic: status alone gates the call.
    // spec/2-navigation/4-integration.md §9.1 + Rationale "연결 테스트 endpoint
    // 의 `pending_install` 가드 — 응답 형식 (2026-05-18)".
    if (entity.status === 'pending_install') {
      return {
        success: false,
        code: 'INTEGRATION_INCOMPLETE',
        message:
          'Integration is in pending_install state — complete the install flow before testing the connection.',
      };
    }
    // Entity-aware tester wins when registered (e.g. cafe24's pingConnection
    // needs the row for proactive refresh + 401 retry against the real API).
    const entityTester = this.entityTesters.get(entity.serviceType);
    if (entityTester) {
      return entityTester(entity);
    }
    return this.dispatchTest(
      entity.serviceType,
      entity.authType,
      entity.credentials,
    );
  }

  previewTest(body: PreviewTestDto): Promise<IntegrationTestResult> {
    return this.dispatchTest(body.serviceType, body.authType, body.credentials);
  }

  /**
   * Record an integration call for activity tracking and error surfacing.
   * Invoked by execution engine handlers after they complete an integration
   * call.
   *
   * **Side effect** — `error.code === MCP_AUTH_FAILED` flips
   * `Integration.status` to `error` with `statusReason = 'auth_failed'` so
   * the editor surfaces a "needs reauthorization" badge. Other failure codes
   * only update `lastError`; transient errors do not transition status.
   *
   * **Never throws** — DB failures are swallowed with a console.warn so a
   * logging hiccup cannot break the surrounding tool execution.
   */
  async logUsage(params: {
    integrationId: string;
    nodeExecutionId: string;
    workflowId: string;
    status: 'success' | 'failed';
    durationMs: number;
    error?: { code?: string; message?: string } | null;
    api?: {
      label?: string | null;
      method?: string | null;
      path?: string | null;
    };
  }): Promise<void> {
    try {
      await this.usageLogRepository.save(
        this.usageLogRepository.create({
          integrationId: params.integrationId,
          nodeExecutionId: params.nodeExecutionId,
          workflowId: params.workflowId,
          status: params.status,
          durationMs: params.durationMs,
          error: params.error
            ? {
                code: params.error.code ?? 'unknown',
                message: clampMessage(params.error.message),
              }
            : null,
          apiLabel: clampApiField(params.api?.label, API_LABEL_MAX),
          apiMethod: clampApiField(params.api?.method, API_METHOD_MAX),
          apiPath: clampApiField(params.api?.path, API_PATH_MAX),
        }),
      );

      // Single atomic UPDATE — avoids the read-modify-write race where a
      // concurrent success call's save() would overwrite an in-flight
      // status='error' transition. The patch only touches columns we
      // actually want to update; relation fields are intentionally left
      // out so TypeORM's QueryDeepPartialEntity stays satisfied.
      const patch: Record<string, unknown> = { lastUsedAt: new Date() };
      if (params.status === 'failed') {
        patch.lastError = {
          code: params.error?.code ?? 'unknown',
          message: clampMessage(params.error?.message),
          at: new Date().toISOString(),
        };
        if (params.error?.code === MCP_ERROR_CODES.AUTH_FAILED) {
          patch.status = 'error';
          patch.statusReason = 'auth_failed';
        }
      }
      await this.integrationRepository.update(
        { id: params.integrationId },
        patch,
      );
    } catch (err) {
      // Usage logging must not break execution — swallow and continue.
      this.logger.warn(
        `Failed to log integration usage: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async rotate(
    id: string,
    workspaceId: string,
    userId: string,
    userRole: string | null,
    body: RotateCredentialsDto,
  ): Promise<PublicIntegration> {
    const entity = await this.requireEntity(id, workspaceId);

    if (entity.authType === 'oauth2') {
      throw new BadRequestException({
        code: 'INTEGRATION_ROTATE_UNSUPPORTED',
        message: 'Use the reauthorize endpoint to rotate OAuth credentials',
      });
    }
    if (entity.scope === 'organization' && !this.isAdmin(userRole)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message:
          'Admin role is required to rotate organization-scope integrations',
      });
    }

    // If the existing row's credentials cannot be decrypted (key rotation),
    // start from a clean slate — merging in the sentinel marker would persist
    // it through re-encryption and defeat the rotation.
    const baseCreds = isUnreadableCredentials(entity.credentials)
      ? {}
      : entity.credentials;
    const merged = { ...baseCreds, ...body.credentials };
    const errors = validateCredentials(
      entity.serviceType,
      entity.authType,
      merged,
    );
    if (errors.length) {
      throw new BadRequestException({
        code: 'INTEGRATION_INVALID_CREDENTIALS',
        message: errors.join('; '),
      });
    }

    const test = await this.dispatchTest(
      entity.serviceType,
      entity.authType,
      merged,
    );
    if (!test.success) {
      throw new BadRequestException({
        code: 'INTEGRATION_TEST_FAILED',
        message: test.message,
      });
    }

    entity.credentials = merged;
    entity.lastRotatedAt = new Date();
    entity.status = 'connected';
    entity.statusReason = null;
    entity.lastError = null;

    const saved = await this.integrationRepository.save(entity);
    await this.auditLogsService.record({
      workspaceId,
      userId,
      action: 'integration.rotated',
      resourceType: 'integration',
      resourceId: saved.id,
      details: { authType: saved.authType },
    });
    return this.toPublic(saved);
  }

  async requestScopes(
    id: string,
    workspaceId: string,
    userId: string,
    userRole: string | null,
    body: RequestScopesDto,
  ): Promise<BeginResult> {
    const entity = await this.requireEntity(id, workspaceId);

    if (entity.authType !== 'oauth2') {
      throw new BadRequestException({
        code: 'INTEGRATION_SCOPE_UNSUPPORTED',
        message: 'Scope requests are only supported for OAuth integrations',
      });
    }
    if (entity.scope === 'organization' && !this.isAdmin(userRole)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message:
          'Admin role is required to modify organization-scope integrations',
      });
    }

    const existingScopes = Array.isArray(entity.credentials.scopes)
      ? (entity.credentials.scopes as string[])
      : [];
    const mergedScopes = Array.from(
      new Set([...existingScopes, ...body.scopes]),
    );
    const scopesAdded = mergedScopes.filter((s) => !existingScopes.includes(s));

    // Cafe24 Private 분기 — OAuth popup 진입점이 없어 begin 호출 불가
    // (Private 은 우리 서버가 OAuth 를 시작 못 함). 대신 기존 install_token
    // 을 그대로 두고 `credentials.scopes` 만 merge 갱신한 뒤,
    // 사용자에게 Cafe24 Developers 에서 권한 추가 후 "테스트 실행" 재호출
    // 안내. 자세한 근거는 spec/2-navigation/4-integration.md ## Rationale
    // "Cafe24 Private request-scopes 흐름" 항.
    const creds = entity.credentials;
    if (
      entity.serviceType === 'cafe24' &&
      creds.app_type === 'private' &&
      typeof entity.installToken === 'string' &&
      entity.installToken.length > 0
    ) {
      entity.credentials = {
        ...entity.credentials,
        scopes: mergedScopes,
      };
      await this.integrationRepository.save(entity);

      const appBaseUrl = getAppBaseUrl();
      return {
        mode: 'cafe24_private_pending',
        integrationId: entity.id,
        appUrl: `${appBaseUrl}/api/3rd-party/cafe24/install/${entity.installToken}`,
        callbackUrl: `${appBaseUrl}/api/3rd-party/cafe24/callback`,
        scopesAdded,
      };
    }

    // For cafe24 Public + other OAuth providers (Google/GitHub etc.), we
    // still need to carry mall_id / app_type into begin's providerMeta so
    // the cafe24 begin validation doesn't reject with CAFE24_INVALID_MALL_ID.
    // Without this passthrough the user got "mall_id is required" even though
    // the integration has it in credentials (2026-05-15 사용자 보고).
    const providerMeta: Record<string, unknown> | undefined =
      entity.serviceType === 'cafe24'
        ? {
            mall_id: creds.mall_id,
            app_type: creds.app_type,
          }
        : undefined;

    return this.oauthService.begin({
      workspaceId,
      userId,
      service: entity.serviceType,
      scopes: mergedScopes,
      mode: 'request_scopes',
      integrationId: entity.id,
      ...(providerMeta ? { providerMeta } : {}),
    });
  }

  async updateScope(
    id: string,
    workspaceId: string,
    userId: string,
    userRole: string | null,
    body: UpdateScopeDto,
  ): Promise<PublicIntegration> {
    if (!this.isAdmin(userRole)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Admin role is required to change integration scope',
      });
    }
    const entity = await this.requireEntity(id, workspaceId);
    const from = entity.scope;
    entity.scope = body.scope;
    const saved = await this.integrationRepository.save(entity);
    if (from !== body.scope) {
      await this.auditLogsService.record({
        workspaceId,
        userId,
        action: 'integration.scope_changed',
        resourceType: 'integration',
        resourceId: saved.id,
        details: { from, to: body.scope },
      });
    }
    return this.toPublic(saved);
  }

  // ---------------------------------------------------------------
  // OAuth
  // ---------------------------------------------------------------

  async reauthorize(
    id: string,
    workspaceId: string,
    userId: string,
  ): Promise<BeginResult> {
    const entity = await this.requireEntity(id, workspaceId);
    const service = findService(entity.serviceType);

    if (!service?.oauthProvider) {
      entity.status = 'connected';
      entity.statusReason = null;
      entity.lastError = null;
      await this.integrationRepository.save(entity);
      await this.auditLogsService.record({
        workspaceId,
        userId,
        action: 'integration.reauthorized',
        resourceType: 'integration',
        resourceId: entity.id,
        details: { mode: 'reset' },
      });
      return { authUrl: '', state: '' };
    }

    const existingScopes = Array.isArray(entity.credentials.scopes)
      ? (entity.credentials.scopes as string[])
      : (service.scopes?.filter((s) => s.recommended).map((s) => s.value) ??
        []);

    return this.oauthService.begin({
      workspaceId,
      userId,
      service: entity.serviceType,
      scopes: existingScopes,
      mode: 'reauthorize',
      integrationId: entity.id,
    });
  }

  // ---------------------------------------------------------------
  // Service metadata
  // ---------------------------------------------------------------

  /**
   * `GET /api/integrations/services/:type/catalog` 의 백엔드 로직. 통합
   * 활동 로그의 `api_label` (catalog key) 을 frontend 가 사람 친화
   * 라벨로 변환할 때 참조하는 메타데이터. SoT: `spec/conventions/cafe24-api-metadata.md
   * §7.5` · `spec/conventions/makeshop-api-metadata.md §2` + 통합 spec §9.3.
   *
   * `cafe24` · `makeshop` 은 backend 메타데이터에서 `operations[]` 를 채워
   * 반환한다 (spec §9.3 초기 응답 정책). 그 외 미지원 서비스 타입
   * (http, database, email, mcp, google, github 등) 은 빈 배열 — 활동
   * 로그의 `apiLabel` 이 NULL 이라 lookup 자체가 발생하지 않는다. 완전
   * 미지원 type 도 빈 배열을 반환해 frontend 의 1회 fetch + caching 흐름이
   * 분기 없이 일관 동작.
   */
  getServiceCatalog(serviceType: string): OperationCatalogDto {
    if (serviceType === 'cafe24') {
      return buildOperationCatalog('cafe24', listAllCafe24Operations());
    }
    if (serviceType === 'makeshop') {
      return buildOperationCatalog('makeshop', listAllMakeshopOperations());
    }
    return { operations: [] };
  }

  getAvailableServices() {
    // Cafe24 Public app 흐름은 우리 서버에 `CAFE24_CLIENT_ID` / `CAFE24_CLIENT_SECRET`
    // env 가 등록된 경우에만 동작 (앱스토어 등록 앱의 OAuth client credentials).
    // 미등록이면 신규 통합 폼에서 Public 옵션을 숨겨야 한다 — Private 은 사용자가
    // 직접 client_id/secret 을 입력하므로 항상 사용 가능. spec/2-navigation/4-integration.md
    // §5.8 Cafe24 의 `app_type` 필드 enum 분기 기준.
    const cafe24PublicAvailable = Boolean(
      process.env.CAFE24_CLIENT_ID && process.env.CAFE24_CLIENT_SECRET,
    );
    return SERVICE_REGISTRY.map((s) => {
      const base = {
        type: s.type,
        name: s.name,
        oauthProvider: s.oauthProvider ?? null,
        authTypes: s.authVariants.map((v) => v.authType),
        authVariants: s.authVariants,
        scopes: s.scopes ?? [],
      };
      if (s.type === 'cafe24') {
        return {
          ...base,
          meta: { publicAppAvailable: cafe24PublicAvailable },
        };
      }
      return base;
    });
  }

  /**
   * Fetch the raw entity (with decrypted credentials via the TypeORM
   * transformer) for use by the execution engine.
   *
   * **Authorisation contract** — the caller MUST already have established
   * that the execution has permission to use this integration. This method
   * only enforces the `workspace_id` scope check; it does not verify the
   * individual workflow's ownership, the user triggering the run, or
   * whether the integration is organisation-shared vs. personal. Use
   * exclusively from trusted execution-engine code paths.
   *
   * Credentials on the returned object are NOT masked — callers must treat
   * the result as secret material and avoid logging it.
   */
  async getForExecution(id: string, workspaceId: string): Promise<Integration> {
    const entity = await this.requireEntity(id, workspaceId);
    if (isUnreadableCredentials(entity.credentials)) {
      throw new IntegrationCredentialsUnreadableError(entity.id);
    }
    return entity;
  }

  // ---------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------

  private async requireEntity(
    id: string,
    workspaceId: string,
  ): Promise<Integration> {
    const entity = await this.integrationRepository.findOne({
      where: { id, workspaceId },
    });
    if (!entity) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Integration not found',
      });
    }
    return entity;
  }

  private toPublic(entity: Integration): PublicIntegration {
    const credsUnreadable = isUnreadableCredentials(entity.credentials);
    const lastErrorUnreadable = isUnreadableCredentials(entity.lastError);
    // C-6: service-specific derived fields (meta.appType + top-level appUrl)
    // dispatched via INTEGRATION_DERIVED_REGISTRY keyed by serviceType, instead
    // of the old cafe24-hardcoded branches. The install-URL needs the app base
    // URL so it's threaded through the context.
    const derived = buildDerivedFields(
      entity,
      { appBaseUrl: getAppBaseUrl() },
      credsUnreadable,
    );
    const meta: IntegrationMeta = { appType: derived.appType };
    // `installToken` / `installTokenIssuedAt` 는 PublicIntegration 응답에서
    // 제외 — App URL path segment 안에 이미 포함되어 별도 필드 노출은 식별자
    // 분산을 유발한다. spec/2-navigation/4-integration.md Rationale "Cafe24
    // App URL 상세 페이지 표시" 참조. entity spread 후 명시적 제거.
    const {
      installToken: _installToken,
      installTokenIssuedAt: _installTokenIssuedAt,
      ...sanitizedEntity
    } = entity;
    void _installToken;
    void _installTokenIssuedAt;
    const appUrl = derived.appUrl;
    // autoRefresh — derived from service registry, not a DB column. Computed
    // once per response. credsUnreadable 분기에서도 service 정의 기반이라
    // 일관된 값. spec/2-navigation/4-integration.md §9.1 + Rationale.
    const autoRefresh =
      findService(entity.serviceType)?.supportsTokenAutoRefresh === true;
    if (credsUnreadable) {
      // Single corrupted row must not leak the sentinel marker into the API
      // response and must surface as a reconnect prompt rather than a
      // half-broken "connected" card.
      return {
        ...sanitizedEntity,
        credentials: {},
        lastError: lastErrorUnreadable ? null : entity.lastError,
        status: 'error',
        statusReason: 'credentials_unreadable',
        credentialsStatus: 'needs_reauth',
        meta,
        appUrl,
        autoRefresh,
      };
    }
    return {
      ...sanitizedEntity,
      credentials: maskCredentials(
        entity.credentials,
        entity.serviceType,
        entity.authType,
      ),
      lastError: lastErrorUnreadable ? null : entity.lastError,
      credentialsStatus: 'ok',
      meta,
      appUrl,
      autoRefresh,
    };
  }

  private validateServiceAndAuth(serviceType: string, authType: string): void {
    const variant = findVariant(serviceType, authType);
    if (!variant) {
      throw new BadRequestException({
        code: 'INTEGRATION_INVALID_SERVICE',
        message: `Unsupported service/auth combination: ${serviceType}/${authType}`,
      });
    }
  }

  private isAdmin(role: string | null): boolean {
    return !!role && ADMIN_ROLES.has(role);
  }

  /**
   * Map a Postgres unique-violation (23505) onto the right 409 error.
   *
   * `serviceType` is supplied by the caller (the entity/DTO being saved) so the
   * unified store-identifier UNIQUE index ({@link STORE_IDENTIFIER_UNIQUE_CONSTRAINT},
   * V072 — `(workspace_id, service_type, mall_id)`) can be translated to the
   * per-service "already connected" code via the {@link ALREADY_CONNECTED_BY_SERVICE}
   * `Record<string, {code, message}>` registry (see `integrations.constants.ts`)
   * instead of the old per-service index-name branches. Unknown/unmapped
   * services degrade to {@link GENERIC_ALREADY_CONNECTED} (still a 409).
   *
   * See `spec/1-data-model.md §3` for the full index table.
   *
   * @param err  The raw error thrown by the TypeORM/Postgres driver.
   * @param serviceType  `integration.service_type` of the row being saved
   *   (optional — omitting yields the generic 409 fallback).
   */
  private throwIfUniqueViolation(err: unknown, serviceType?: string): void {
    const code = (err as { code?: string })?.code;
    const constraint = (err as { constraint?: string })?.constraint;
    if (code !== '23505') return;
    if (constraint === 'integration_workspace_name_unique') {
      throw new ConflictException({
        code: 'INTEGRATION_NAME_TAKEN',
        message: 'Integration name is already in use within this workspace',
      });
    }
    // 통일 store-identifier UNIQUE `(workspace_id, service_type, mall_id) WHERE
    // mall_id IS NOT NULL` (V072) — cafe24 Public finalize race / begin pre-check
    // 통과 후 DB-level race / makeshop shop_uid 중복 등 모든 service 의 중복
    // 식별자 INSERT 가 본 constraint 로 잡힌다. serviceType 으로 service 별 코드를
    // 분기 (옛 per-service 인덱스 분기 대체). 미등록 service 는 generic 409 로
    // degrade. spec/2-navigation/4-integration.md §9.4 / §5.9 race backstop.
    if (constraint === STORE_IDENTIFIER_UNIQUE_CONSTRAINT) {
      const mapped =
        (serviceType && ALREADY_CONNECTED_BY_SERVICE[serviceType]) ||
        GENERIC_ALREADY_CONNECTED;
      throw new ConflictException({
        code: mapped.code,
        message: mapped.message,
      });
    }
  }

  private async dispatchTest(
    serviceType: string,
    authType: string,
    credentials: Record<string, unknown>,
  ): Promise<IntegrationTestResult> {
    // Step 1: structural validation always runs first — the transport probe
    // would just fail with a less-actionable error if required fields are
    // missing.
    const errors = validateCredentials(serviceType, authType, credentials);
    if (errors.length) {
      return { success: false, message: errors.join('; ') };
    }
    // Step 2: services with a registered transport tester perform a real
    // round-trip; the rest fall back to the structural-only "ok" until a
    // transport tester is added for them.
    const tester = this.transportTesters.get(serviceType);
    if (tester) {
      return tester(authType, credentials);
    }
    return {
      success: true,
      message: 'Connection successful',
    };
  }

  /**
   * Email(SMTP) 통합 연결 테스트 — `nodemailer` transporter 의 `verify()` 로
   * 실제 SMTP 접속 + 인증 + (STARTTLS/TLS) 핸드셰이크를 검증한다. 종전엔
   * transport tester 가 없어 구조 검증만 통과하면 무조건 "성공" 으로 표시돼,
   * 인증 실패한 자격증명도 연결 성공으로 보이던 문제를 해소한다.
   *
   * 구성은 send-email 핸들러의 `resolveTransport` 와 동일한 매핑을 따른다
   * (`secure: 'tls'` → 암묵 TLS, `'starttls'` → requireTLS). 단 연결 테스트는
   * 1회성이므로 pool 을 쓰지 않고, 매달리지 않도록 짧은 타임아웃을 둔다.
   * `dispatchTest` 가 `validateCredentials` 로 필수 필드(host/port/secure/
   * username/password)를 이미 보장하므로 여기서는 형변환만 한다.
   */
  private async testEmailTransport(
    _authType: string,
    credentials: Record<string, unknown>,
  ): Promise<IntegrationTestResult> {
    // SSRF 완화 (opt-in) — `SMTP_BLOCK_PRIVATE_HOSTS` 정책이 켜진 경우 사설/
    // loopback host 에 대한 연결 시도를 차단. send_email 발송 경로와 동일한 가드.
    if (await isSmtpHostBlocked(credentials.host as string)) {
      return {
        success: false,
        code: 'EMAIL_HOST_BLOCKED',
        message:
          'SMTP host points to a private/loopback address blocked by policy.',
      };
    }
    const secure = credentials.secure as 'none' | 'starttls' | 'tls';
    const transporter = createTransport({
      host: credentials.host as string,
      port: credentials.port as number,
      secure: secure === 'tls',
      requireTLS: secure === 'starttls',
      auth: {
        user: credentials.username as string,
        pass: credentials.password as string,
      },
      // 연결 테스트가 응답 없는 서버에 매달리지 않도록 3종 타임아웃을 동일하게 둔다.
      connectionTimeout: SMTP_TEST_TIMEOUT_MS,
      greetingTimeout: SMTP_TEST_TIMEOUT_MS,
      socketTimeout: SMTP_TEST_TIMEOUT_MS,
    });
    try {
      await transporter.verify();
      return { success: true, message: 'Connection successful' };
    } catch (err) {
      return {
        success: false,
        message: clampMessage(err instanceof Error ? err.message : String(err)),
        code: 'EMAIL_CONNECT_FAILED',
      };
    } finally {
      transporter.close();
    }
  }

  private async testMcpTransport(
    authType: string,
    credentials: Record<string, unknown>,
  ): Promise<IntegrationTestResult> {
    const result = await this.mcpTestConnection.test(
      this.toMcpConnectParams(authType, credentials),
    );
    if (result.success) {
      return {
        success: true,
        message: result.message,
        capabilities: result.capabilities,
        serverInfo: result.serverInfo,
        preview: result.preview,
      };
    }
    return {
      success: false,
      message: result.message,
      code: result.code ?? 'MCP_CONNECT_FAILED',
    };
  }

  /**
   * Converts the validated `Integration.credentials` JSONB shape into the
   * discriminated union {@link McpConnectParams} that {@link McpClientService}
   * accepts. Validation has already ensured required fields exist.
   */
  private toMcpConnectParams(
    authType: string,
    credentials: Record<string, unknown>,
  ): McpConnectParams {
    const url = credentials.url as string;
    const defaultHeaders = credentials.default_headers as
      | Record<string, string>
      | undefined;
    if (authType === 'bearer_token') {
      return {
        authType: 'bearer_token',
        url,
        token: credentials.token as string,
        defaultHeaders,
      };
    }
    if (authType === 'api_key') {
      return {
        authType: 'api_key',
        url,
        headerName: credentials.header_name as string,
        value: credentials.value as string,
        defaultHeaders,
      };
    }
    return { authType: 'none', url, defaultHeaders };
  }

  async resolveRole(
    workspaceId: string,
    userId: string,
  ): Promise<string | null> {
    return this.workspacesService.getMemberRole(workspaceId, userId);
  }
}
