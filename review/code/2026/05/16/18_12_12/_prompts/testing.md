# 테스트(Testing) Review Payload

본 파일은 orchestrator 가 테스트(Testing) reviewer 용으로 작성한 입력입니다. 다음 코드 변경을 테스트 관점에서 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (테스트(Testing))

1. **테스트 존재 여부**: 변경 코드에 대한 테스트 존재·추가 필요성
2. **커버리지 갭**: 테스트로 커버되지 않는 코드 경로
3. **엣지 케이스 테스트**: 경계값·예외 상황·null 처리 테스트 필요 여부
4. **Mock 적절성**: mock/stub 사용 적절성, 실제 동작과의 괴리
5. **테스트 격리**: 테스트 간 의존성 없이 독립 실행 가능한지
6. **테스트 가독성**: 테스트 코드가 명확하고 의도를 잘 표현
7. **회귀 테스트**: 기존 테스트가 변경 후에도 유효한지
8. **테스트 용이성**: 코드가 테스트하기 쉬운 구조인지 (의존성 주입 등)

## 리뷰 대상 파일

### 파일 1: backend/src/modules/integrations/integrations.service.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integrations.service.spec.ts b/backend/src/modules/integrations/integrations.service.spec.ts
index e1d0d212..f712b157 100644
--- a/backend/src/modules/integrations/integrations.service.spec.ts
+++ b/backend/src/modules/integrations/integrations.service.spec.ts
@@ -7,6 +7,7 @@ import {
 import {
   IntegrationsService,
   IntegrationCredentialsUnreadableError,
+  type PublicIntegration,
 } from './integrations.service';
 import type { Integration } from './entities/integration.entity';
 import { UNREADABLE_KEY } from './services/credentials-transformer';
@@ -919,6 +920,45 @@ describe('IntegrationsService', () => {
       const response = (error as { response?: { code?: string } }).response;
       expect(response?.code).toBe('INTEGRATION_NAME_TAKEN');
     });
+
+    // 트랜잭션 미적용 결정 (W23 검토 결과) 의 회귀 안전망 — ai-review INFO 10
+    // (2026-05-16). `auditLogsService.record` 가 내부 try/catch 로 모든
+    // exception 을 swallow 하므로 audit 기록 실패는 user-visible 흐름에
+    // 영향을 주지 않는다. 향후 audit log 가 throw 하도록 변경되면 본 테스트가
+    // 회귀를 감지 — Integration row 는 commit 되었으므로 사용자에게 결과를
+    // 정상 반환해야 한다 (audit 누락은 best-effort 정책).
+    it('returns integration even when audit log record throws internally (best-effort audit)', async () => {
+      // record() 가 내부 try/catch 를 통과하지 못하고 throw 한다고 가정.
+      // (실제 record() 구현은 내부에서 swallow 하므로 본 시나리오는 회귀 시
+      // 만 발생.)
+      auditLogsService.record = jest
+        .fn()
+        .mockRejectedValueOnce(new Error('audit DB unreachable'));
+
+      // save() 는 정상 — row 가 commit 된 상태.
+      const result = await service
+        .create('ws-1', 'user-1', 'member', {
+          serviceType: 'http',
+          authType: 'api_key',
+          name: 'My API (audit fail)',
+          credentials: {
+            location: 'header',
+            key_name: 'X-Api-Key',
+            value: 'secret',
+          },
+        })
+        .catch((e: Error) => e);
+
+      // 호출자에게는 row 가 정상 반환되어야 한다 (audit 실패는 swallow).
+      // 만약 audit 실패가 user-visible 500 으로 빠지면 본 단언이 실패해
+      // 회귀를 감지.
+      expect(result).not.toBeInstanceOf(Error);
+      expect((result as PublicIntegration).name).toBe('My API (audit fail)');
+      // audit 시도는 반드시 일어났어야 한다 (best-effort 의무).
+      expect(auditLogsService.record).toHaveBeenCalledWith(
+        expect.objectContaining({ action: 'integration.created' }),
+      );
+    });
   });
 
   // -----------------------------------------------------------------

```

---

### 파일 2: backend/src/modules/integrations/integrations.service.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integrations.service.ts b/backend/src/modules/integrations/integrations.service.ts
index e2c50555..968306c0 100644
--- a/backend/src/modules/integrations/integrations.service.ts
+++ b/backend/src/modules/integrations/integrations.service.ts
@@ -374,15 +374,27 @@ export class IntegrationsService {
     // 트랜잭션 미적용 의도 (2026-05-16 — ai-review W23 검토 결과):
     //   1. `save()` 단일 INSERT 실패 시 row 미생성 — 자체로 atomic.
     //   2. `auditLogsService.record` 는 step 1 성공 후에만 호출 — 실패 row 의
-    //      audit 없음.
+    //      audit 없음. 또한 best-effort 로 swallow (아래 별도 try/catch) — row
+    //      가 이미 commit 된 상태에서 audit 실패가 user-visible 500 으로
+    //      빠지지 않도록 한다 (ai-review INFO 10 — 2026-05-16).
     //   3. preview_token 은 본 메서드 진입 전 `consumePreviewToken` 에서 이미
     //      `DELETE…RETURNING` 으로 원자 소비된 capability token. V045
     //      UNIQUE race loser 가 토큰을 재사용해도 보안상 위험 — 의도적으로
     //      재사용 차단 (race-loser 는 OAuth 재실행 필요, 이는 spec 의도).
     // 따라서 본 try/catch 블록을 dataSource.transaction 으로 감쌀 implementational
     // 이득이 없다. 향후 audit log 외 부작용이 추가되면 재검토.
+    let saved: Integration;
+    try {
+      saved = await this.integrationRepository.save(entity);
+    } catch (err) {
+      this.throwIfUniqueViolation(err);
+      throw err;
+    }
+    // audit 기록은 best-effort — row 는 이미 commit 됐으므로 audit 실패가
+    // 호출자에게 500 으로 노출되면 안 된다. AuditLogsService.record 자체도
+    // 내부 try/catch 로 swallow 하지만, 방어선을 본 메서드에도 둬서 향후
+    // record 구현이 throw 하도록 변경돼도 회귀 없게 한다.
     try {
-      const saved = await this.integrationRepository.save(entity);
       await this.auditLogsService.record({
         workspaceId,
         userId,
@@ -395,11 +407,14 @@ export class IntegrationsService {
           scope: saved.scope,
         },
       });
-      return this.toPublic(saved);
     } catch (err) {
-      this.throwIfUniqueViolation(err);
-      throw err;
+      this.logger.warn(
+        `Failed to record audit log for integration.created id=${saved.id}: ${
+          err instanceof Error ? err.message : String(err)
+        }`,
+      );
     }
+    return this.toPublic(saved);
   }
 
   async update(

```

#### 전체 파일 컨텍스트
```
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
import { Integration } from './entities/integration.entity';
import { IntegrationUsageLog } from './entities/integration-usage-log.entity';
import { Node } from '../nodes/entities/node.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  IntegrationOAuthService,
  type BeginResult,
} from './integration-oauth.service';
import { buildCafe24InstallUrl } from './third-party-oauth.constants';
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

/**
 * Public shape returned to the integrations UI for both `previewTest` and
 * `testConnection`. `success`/`message` are universal; `capabilities`,
 * `serverInfo`, `preview` are populated only for `service_type='mcp'`.
 */
export interface IntegrationTestResult {
  success: boolean;
  message: string;
  /** Failure code in the `MCP_*` vocabulary; absent on success. */
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
function clampMessage(raw: string | undefined): string {
  if (!raw) return 'Unknown error';
  return raw.length > MCP_ERROR_MESSAGE_MAX_LEN
    ? raw.slice(0, MCP_ERROR_MESSAGE_MAX_LEN)
    : raw;
}

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

    // 트랜잭션 미적용 의도 (2026-05-16 — ai-review W23 검토 결과):
    //   1. `save()` 단일 INSERT 실패 시 row 미생성 — 자체로 atomic.
    //   2. `auditLogsService.record` 는 step 1 성공 후에만 호출 — 실패 row 의
    //      audit 없음. 또한 best-effort 로 swallow (아래 별도 try/catch) — row
    //      가 이미 commit 된 상태에서 audit 실패가 user-visible 500 으로
    //      빠지지 않도록 한다 (ai-review INFO 10 — 2026-05-16).
    //   3. preview_token 은 본 메서드 진입 전 `consumePreviewToken` 에서 이미
    //      `DELETE…RETURNING` 으로 원자 소비된 capability token. V045
    //      UNIQUE race loser 가 토큰을 재사용해도 보안상 위험 — 의도적으로
    //      재사용 차단 (race-loser 는 OAuth 재실행 필요, 이는 spec 의도).
    // 따라서 본 try/catch 블록을 dataSource.transaction 으로 감쌀 implementational
    // 이득이 없다. 향후 audit log 외 부작용이 추가되면 재검토.
    let saved: Integration;
    try {
      saved = await this.integrationRepository.save(entity);
    } catch (err) {
      this.throwIfUniqueViolation(err);
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
          serviceType: sav

... (truncated due to prompt size limit) ...
```

---

### 파일 3: frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx b/frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx
index 19487543..423844b6 100644
--- a/frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx
+++ b/frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx
@@ -76,6 +76,20 @@ async function renderPage() {
   });
 }
 
+/**
+ * page.tsx 의 debounce 는 350ms (`setTimeout(..., 350)`). 테스트에서
+ * `vi.advanceTimersByTime` 인자는 (debounce + 약간의 buffer) 로 정해
+ * setTimeout 이 fire 한 뒤 후속 마이크로태스크가 flush 될 시간을 확보한다.
+ * 한 곳에 모아 매직 넘버 분산을 막는다 (ai-review INFO 12 — 2026-05-16).
+ */
+const DEBOUNCE_ADVANCE_MS = 360;
+
+async function advanceDebounce() {
+  await act(async () => {
+    vi.advanceTimersByTime(DEBOUNCE_ADVANCE_MS);
+  });
+}
+
 describe("/integrations/new — Cafe24 mall_id 사전 중복 감지", () => {
   beforeEach(() => {
     vi.clearAllMocks();
@@ -101,9 +115,7 @@ describe("/integrations/new — Cafe24 mall_id 사전 중복 감지", () => {
 
     // 350ms debounce — 그 전엔 호출 없음
     expect(precheckMock).not.toHaveBeenCalled();
-    await act(async () => {
-      vi.advanceTimersByTime(360);
-    });
+    await advanceDebounce();
     await waitFor(() => {
       // 두 번째 인자는 AbortController.signal (INFO 6 — 2026-05-16)
       expect(precheckMock).toHaveBeenCalledWith(
@@ -132,9 +144,7 @@ describe("/integrations/new — Cafe24 mall_id 사전 중복 감지", () => {
 
     // 첫 mall_id 입력 → 350ms debounce → fetch 시작 (응답 보류)
     await user.type(mallIdInput, "shop-a");
-    await act(async () => {
-      vi.advanceTimersByTime(360);
-    });
+    await advanceDebounce();
     await waitFor(() => {
       expect(precheckMock).toHaveBeenCalledTimes(1);
     });
@@ -146,9 +156,7 @@ describe("/integrations/new — Cafe24 mall_id 사전 중복 감지", () => {
     // abort 는 동기적으로 발생 (effect cleanup)
     expect(firstSignal?.aborted).toBe(true);
     // 새 debounce 만료 후 두 번째 호출
-    await act(async () => {
-      vi.advanceTimersByTime(360);
-    });
+    await advanceDebounce();
     await waitFor(() => {
       expect(precheckMock).toHaveBeenCalledTimes(2);
     });
@@ -181,9 +189,7 @@ describe("/integrations/new — Cafe24 mall_id 사전 중복 감지", () => {
     await screen.findByLabelText(/Mall ID/i);
     const mallIdInput = screen.getByLabelText(/Mall ID/i);
     await user.type(mallIdInput, "myshop");
-    await act(async () => {
-      vi.advanceTimersByTime(360);
-    });
+    await advanceDebounce();
 
     // 한글 배너 제목 + 본문 (connected 분기)
     await waitFor(() => {
@@ -213,9 +219,7 @@ describe("/integrations/new — Cafe24 mall_id 사전 중복 감지", () => {
     await screen.findByLabelText(/Mall ID/i);
     const mallIdInput = screen.getByLabelText(/Mall ID/i);
     await user.type(mallIdInput, "myshop");
-    await act(async () => {
-      vi.advanceTimersByTime(360);
-    });
+    await advanceDebounce();
     await waitFor(() => {
       expect(
         screen.getByText(/이미 설치 대기 중이에요/),
@@ -235,9 +239,7 @@ describe("/integrations/new — Cafe24 mall_id 사전 중복 감지", () => {
     await screen.findByLabelText(/Mall ID/i);
     const mallIdInput = screen.getByLabelText(/Mall ID/i);
     await user.type(mallIdInput, "myshop");
-    await act(async () => {
-      vi.advanceTimersByTime(360);
-    });
+    await advanceDebounce();
     await waitFor(() => {
       expect(
         screen.getByText(/이미 만료 상태로 존재해요/),
@@ -257,9 +259,7 @@ describe("/integrations/new — Cafe24 mall_id 사전 중복 감지", () => {
     await screen.findByLabelText(/Mall ID/i);
     const mallIdInput = screen.getByLabelText(/Mall ID/i);
     await user.type(mallIdInput, "myshop");
-    await act(async () => {
-      vi.advanceTimersByTime(360);
-    });
+    await advanceDebounce();
     await waitFor(() => {
       expect(
         screen.getByText(/이미 오류 상태로 존재해요/),
@@ -274,9 +274,7 @@ describe("/integrations/new — Cafe24 mall_id 사전 중복 감지", () => {
     await screen.findByLabelText(/Mall ID/i);
     const mallIdInput = screen.getByLabelText(/Mall ID/i);
     await user.type(mallIdInput, "myshop");
-    await act(async () => {
-      vi.advanceTimersByTime(360);
-    });
+    await advanceDebounce();
     // 배너 미표시
     expect(
       screen.queryByText("이 mall ID 는 이미 연결되어 있어요"),
@@ -295,9 +293,7 @@ describe("/integrations/new — Cafe24 mall_id 사전 중복 감지", () => {
     await screen.findByLabelText(/Mall ID/i);
     const mallIdInput = screen.getByLabelText(/Mall ID/i);
     await user.type(mallIdInput, "myshop");
-    await act(async () => {
-      vi.advanceTimersByTime(360);
-    });
+    await advanceDebounce();
 
     await waitFor(() => {
       expect(
@@ -324,9 +320,7 @@ describe("/integrations/new — Cafe24 mall_id 사전 중복 감지", () => {
     const mallIdInput = screen.getByLabelText(/Mall ID/i);
     await user.type(mallIdInput, "myshop");
     // 350ms debounce 직후 fetch 시작 — 응답 보류 중
-    await act(async () => {
-      vi.advanceTimersByTime(360);
-    });
+    await advanceDebounce();
     // 로딩 인디케이터 노출
     await waitFor(() => {
       expect(screen.getByText(/확인 중…/)).toBeInTheDocument();
@@ -371,9 +365,7 @@ describe("/integrations/new — Cafe24 mall_id 사전 중복 감지", () => {
     await user.type(nameInput, "My Cafe24");
     const mallIdInput = screen.getByLabelText(/Mall ID/i);
     await user.type(mallIdInput, "myshop");
-    await act(async () => {
-      vi.advanceTimersByTime(360);
-    });
+    await advanceDebounce();
     // precheck 호출 끝나고 conflict=false 확인
     await waitFor(() => {
       expect(precheckMock).toHaveBeenCalled();

```

#### 전체 파일 컨텍스트
```
/**
 * Cafe24 mall_id 사전 중복 감지 — `/integrations/new` 의 cafe24 step.
 * spec/2-navigation/4-integration.md §9.2.
 *
 * 검증 대상:
 *   - 유효 mall_id 입력 시 350ms debounce 후 precheck 호출
 *   - conflict=true → inline 경고 배너 표시 + Connect 버튼 disabled
 *   - 기존 통합 deep link 노출
 *   - status 별 안내 문구 분기 (connected / pending_install / expired / error)
 *   - mall_id 형식 위반 시 precheck 호출 자체 skip
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";

const mockPush = vi.fn();
const mockReplace = vi.fn();
let currentSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: vi.fn() }),
  usePathname: () => "/integrations/new",
  useSearchParams: () => currentSearchParams,
}));

const servicesMock = vi.fn();
const precheckMock = vi.fn();
const oauthBeginMock = vi.fn();
vi.mock("@/lib/api/integrations", () => ({
  integrationsApi: {
    services: () => servicesMock(),
    cafe24Precheck: (...args: unknown[]) => precheckMock(...args),
    oauthBegin: (...args: unknown[]) => oauthBeginMock(...args),
    create: vi.fn(),
  },
}));

// useCafe24PendingPolling 은 본 테스트와 무관하므로 stub.
vi.mock("@/lib/integrations/use-cafe24-pending-polling", () => ({
  useCafe24PendingPolling: () => ({ status: "idle" }),
}));

import NewIntegrationPage from "../page";

const CAFE24_SERVICE = {
  type: "cafe24",
  name: "Cafe24",
  meta: { publicAppAvailable: true },
  scopes: [
    { value: "mall.read_product", label: "상품 읽기", recommended: true },
  ],
  authVariants: [
    {
      authType: "oauth2",
      label: "OAuth 2.0",
      fields: [],
    },
  ],
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

async function renderPage() {
  await act(async () => {
    render(<NewIntegrationPage />, { wrapper: createWrapper() });
  });
}

/**
 * page.tsx 의 debounce 는 350ms (`setTimeout(..., 350)`). 테스트에서
 * `vi.advanceTimersByTime` 인자는 (debounce + 약간의 buffer) 로 정해
 * setTimeout 이 fire 한 뒤 후속 마이크로태스크가 flush 될 시간을 확보한다.
 * 한 곳에 모아 매직 넘버 분산을 막는다 (ai-review INFO 12 — 2026-05-16).
 */
const DEBOUNCE_ADVANCE_MS = 360;

async function advanceDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(DEBOUNCE_ADVANCE_MS);
  });
}

describe("/integrations/new — Cafe24 mall_id 사전 중복 감지", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    currentSearchParams = new URLSearchParams("service=cafe24");
    useLocaleStore.setState({ locale: "ko" });
    cleanup();
    servicesMock.mockResolvedValue([CAFE24_SERVICE]);
    precheckMock.mockResolvedValue({ conflict: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("도메인 형식이 맞으면 350ms debounce 후 precheck 호출", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderPage();
    await screen.findByLabelText(/Mall ID/i);

    const mallIdInput = screen.getByLabelText(/Mall ID/i);
    await user.type(mallIdInput, "myshop");

    // 350ms debounce — 그 전엔 호출 없음
    expect(precheckMock).not.toHaveBeenCalled();
    await advanceDebounce();
    await waitFor(() => {
      // 두 번째 인자는 AbortController.signal (INFO 6 — 2026-05-16)
      expect(precheckMock).toHaveBeenCalledWith(
        "myshop",
        expect.any(AbortSignal),
      );
    });
  });

  it("mall_id 가 바뀌면 in-flight precheck 요청을 abort (INFO 6 — 2026-05-16)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    // 첫 요청이 resolve 되지 않은 상태에서 두 번째 입력이 들어오면 첫 요청
    // 의 AbortController.signal 이 aborted 가 되어야 한다.
    let firstSignal: AbortSignal | undefined;
    precheckMock.mockImplementationOnce(
      (_mallId: string, signal: AbortSignal) => {
        firstSignal = signal;
        return new Promise(() => {}); // 영원히 resolve 안 됨
      },
    );
    precheckMock.mockResolvedValueOnce({ conflict: false });

    await renderPage();
    await screen.findByLabelText(/Mall ID/i);
    const mallIdInput = screen.getByLabelText(/Mall ID/i);

    // 첫 mall_id 입력 → 350ms debounce → fetch 시작 (응답 보류)
    await user.type(mallIdInput, "shop-a");
    await advanceDebounce();
    await waitFor(() => {
      expect(precheckMock).toHaveBeenCalledTimes(1);
    });
    expect(firstSignal?.aborted).toBe(false);

    // 두 번째 입력 → 첫 요청 abort + 새 debounce 시작
    await user.clear(mallIdInput);
    await user.type(mallIdInput, "shop-b");
    // abort 는 동기적으로 발생 (effect cleanup)
    expect(firstSignal?.aborted).toBe(true);
    // 새 debounce 만료 후 두 번째 호출
    await advanceDebounce();
    await waitFor(() => {
      expect(precheckMock).toHaveBeenCalledTimes(2);
    });
  });

  it("패턴 위반 mall_id 는 precheck 호출 skip", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderPage();
    await screen.findByLabelText(/Mall ID/i);

    const mallIdInput = screen.getByLabelText(/Mall ID/i);
    await user.type(mallIdInput, "AB"); // 3자 미만 + 대문자

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(precheckMock).not.toHaveBeenCalled();
  });

  it("conflict=true (status=connected) 면 inline 배너 표시 + 기존 통합 링크", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    precheckMock.mockResolvedValueOnce({
      conflict: true,
      existingIntegrationId: "int-abc",
      existingName: "myshop (Cafe24)",
      status: "connected",
    });

    await renderPage();
    await screen.findByLabelText(/Mall ID/i);
    const mallIdInput = screen.getByLabelText(/Mall ID/i);
    await user.type(mallIdInput, "myshop");
    await advanceDebounce();

    // 한글 배너 제목 + 본문 (connected 분기)
    await waitFor(() => {
      expect(
        screen.getByText("이 mall ID 는 이미 연결되어 있어요"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/이미 활성 상태로 연결돼 있어요/),
    ).toBeInTheDocument();

    // 기존 통합 deep link
    const link = screen.getByRole("link", { name: /기존 통합 열기/ });
    expect(link).toHaveAttribute("href", "/integrations/int-abc");
    expect(link.textContent).toContain("myshop (Cafe24)");
  });

  it("status=pending_install 이면 pending 안내 메시지", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    precheckMock.mockResolvedValueOnce({
      conflict: true,
      existingIntegrationId: "int-pending",
      existingName: "pending shop",
      status: "pending_install",
    });
    await renderPage();
    await screen.findByLabelText(/Mall ID/i);
    const mallIdInput = screen.getByLabelText(/Mall ID/i);
    await user.type(mallIdInput, "myshop");
    await advanceDebounce();
    await waitFor(() => {
      expect(
        screen.getByText(/이미 설치 대기 중이에요/),
      ).toBeInTheDocument();
    });
  });

  it("status=expired 이면 expired 안내", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    precheckMock.mockResolvedValueOnce({
      conflict: true,
      existingIntegrationId: "int-exp",
      existingName: "expired",
      status: "expired",
    });
    await renderPage();
    await screen.findByLabelText(/Mall ID/i);
    const mallIdInput = screen.getByLabelText(/Mall ID/i);
    await user.type(mallIdInput, "myshop");
    await advanceDebounce();
    await waitFor(() => {
      expect(
        screen.getByText(/이미 만료 상태로 존재해요/),
      ).toBeInTheDocument();
    });
  });

  it("status=error 이면 error 안내", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    precheckMock.mockResolvedValueOnce({
      conflict: true,
      existingIntegrationId: "int-err",
      existingName: "broken",
      status: "error",
    });
    await renderPage();
    await screen.findByLabelText(/Mall ID/i);
    const mallIdInput = screen.getByLabelText(/Mall ID/i);
    await user.type(mallIdInput, "myshop");
    await advanceDebounce();
    await waitFor(() => {
      expect(
        screen.getByText(/이미 오류 상태로 존재해요/),
      ).toBeInTheDocument();
    });
  });

  it("precheck 자체 실패 시 silent — 배너 표시되지 않음", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    precheckMock.mockRejectedValueOnce(new Error("network"));
    await renderPage();
    await screen.findByLabelText(/Mall ID/i);
    const mallIdInput = screen.getByLabelText(/Mall ID/i);
    await user.type(mallIdInput, "myshop");
    await advanceDebounce();
    // 배너 미표시
    expect(
      screen.queryByText("이 mall ID 는 이미 연결되어 있어요"),
    ).not.toBeInTheDocument();
  });

  it("conflict=true 일 때 Connect 버튼이 disabled (ai-review W1·W2 회귀)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    precheckMock.mockResolvedValueOnce({
      conflict: true,
      existingIntegrationId: "int-abc",
      existingName: "myshop (Cafe24)",
      status: "connected",
    });
    await renderPage();
    await screen.findByLabelText(/Mall ID/i);
    const mallIdInput = screen.getByLabelText(/Mall ID/i);
    await user.type(mallIdInput, "myshop");
    await advanceDebounce();

    await waitFor(() => {
      expect(
        screen.getByText("이 mall ID 는 이미 연결되어 있어요"),
      ).toBeInTheDocument();
    });
    const connectBtn = screen.getByRole("button", {
      name: /Cafe24 연결하기/i,
    });
    expect(connectBtn).toBeDisabled();
  });

  it("precheck 로딩 구간 (350ms debounce + fetch) 동안 Connect 버튼 disabled + 인디케이터 노출 (ai-review W1·W8)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    // precheck 호출이 응답하지 않은 상태 시뮬레이션 — Promise 가 resolve 되지 않는다
    let resolvePrecheck: (v: unknown) => void = () => {};
    precheckMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePrecheck = resolve;
      }),
    );
    await renderPage();
    await screen.findByLabelText(/Mall ID/i);
    const mallIdInput = screen.getByLabelText(/Mall ID/i);
    await user.type(mallIdInput, "myshop");
    // 350ms debounce 직후 fetch 시작 — 응답 보류 중
    await advanceDebounce();
    // 로딩 인디케이터 노출
    await waitFor(() => {
      expect(screen.getByText(/확인 중…/)).toBeInTheDocument();
    });
    // Connect 버튼은 disabled (사전 감지 결과 보기 전에 OAuth 시작 race 차단)
    const connectBtn = screen.getByRole("button", {
      name: /Cafe24 연결하기/i,
    });
    expect(connectBtn).toBeDisabled();
    // 응답 도착 → 정상화
    await act(async () => {
      resolvePrecheck({ conflict: false });
    });
    await waitFor(() => {
      expect(screen.queryByText(/확인 중…/)).not.toBeInTheDocument();
    });
  });

  it("CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드는 한글 i18n primary + 영문 backend 메시지 보조 (ai-review W7)", async () => {
    // 사전 감지를 우회해 직접 Connect 흐름 시뮬레이션 — precheck 는 빈 결과로
    // 통과 후 begin 호출이 backend 가드에 걸려 409 를 반환하는 경로 검증.
    precheckMock.mockResolvedValue({ conflict: false });
    oauthBeginMock.mockRejectedValueOnce({
      response: {
        data: {
          code: "CAFE24_PRIVATE_APP_ALREADY_CONNECTED",
          message:
            'A Cafe24 integration for mall_id "myshop" already exists and is connected.',
        },
      },
    });
    const toastSpy = vi.fn();
    const sonnerModule = await import("sonner");
    vi.spyOn(sonnerModule.toast, "error").mockImplementation(toastSpy);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderPage();
    await screen.findByLabelText(/Mall ID/i);

    // 통합 이름 + scope 입력 (Connect 클릭 가능 상태로 만들기)
    const nameInput = document.getElementById("int-name") as HTMLInputElement;
    await user.type(nameInput, "My Cafe24");
    const mallIdInput = screen.getByLabelText(/Mall ID/i);
    await user.type(mallIdInput, "myshop");
    await advanceDebounce();
    // precheck 호출 끝나고 conflict=false 확인
    await waitFor(() => {
      expect(precheckMock).toHaveBeenCalled();
    });

    const connectBtn = screen.getByRole("button", {
      name: /Cafe24 연결하기/i,
    });
    await user.click(connectBtn);

    // toast.error 호출 메시지에 한글 primary + (영문 backend) 가 포함
    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalled();
    });
    const msg = toastSpy.mock.calls[0][0] as string;
    expect(msg).toContain("이 mall ID 는 이미 연결되어 있어 추가할 수 없어요");
    expect(msg).toContain("A Cafe24 integration for mall_id");
  });
});

```

---

### 파일 4: frontend/src/app/(main)/integrations/new/page.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/app/(main)/integrations/new/page.tsx b/frontend/src/app/(main)/integrations/new/page.tsx
index bb5c4bdc..4c637333 100644
--- a/frontend/src/app/(main)/integrations/new/page.tsx
+++ b/frontend/src/app/(main)/integrations/new/page.tsx
@@ -24,6 +24,8 @@ import {
   type IntegrationScope,
   type ServiceDefinition,
 } from "@/lib/api/integrations";
+import { getIntegrationErrorI18nKey } from "@/lib/api/integration-error-codes";
+import { useCafe24MallIdPrecheck } from "@/lib/integrations/use-cafe24-mall-id-precheck";
 import { ServiceIcon } from "../_shared/service-icons";
 import { CredentialsForm } from "../_shared/credentials-form";
 import { useT, type TFunction, type TranslationKey } from "@/lib/i18n";
@@ -92,70 +94,20 @@ export default function NewIntegrationPage() {
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [variant]);
 
-  // Cafe24 mall_id 사전 중복 감지 상태 (2026-05-16).
-  // mall_id 입력 시 350ms debounce 로 backend precheck endpoint 호출 →
-  // conflict 발견 시 inline 경고 배너 + Connect 버튼 disable.
-  // spec/2-navigation/4-integration.md §9.2.
-  const [cafe24Conflict, setCafe24Conflict] =
-    useState<Cafe24PrecheckResult | null>(null);
-  const [cafe24PrecheckLoading, setCafe24PrecheckLoading] = useState(false);
-  const cafe24MallIdInput = String(credentials.mall_id ?? "").trim();
+  // Cafe24 mall_id 사전 중복 감지 — 350ms debounce + AbortController + state 묶음을
+  // `useCafe24MallIdPrecheck` 훅으로 분리해 page.tsx 응집도 향상 (ai-review W9,
+  // 2026-05-16). spec/2-navigation/4-integration.md §9.2.
   const isCafe24OAuth =
     variant?.authType === "oauth2" && serviceType === "cafe24";
-
-  // mall_id 패턴 매칭이 안 되면 precheck 호출 자체를 skip — backend 가
-  // 400 으로 거부할 페이로드를 보낼 필요 없음. 패턴이 풀리는 순간
-  // 이전 conflict 표시·로딩 상태도 클리어해 사용자 입력 도중 잘못된
-  // 빨간 배너 또는 영구 spinner 가 남지 않도록.
-  useEffect(() => {
-    if (!isCafe24OAuth) {
-      setCafe24Conflict(null);
-      setCafe24PrecheckLoading(false);
-      return;
-    }
-    if (!/^[a-z0-9-]{3,50}$/.test(cafe24MallIdInput)) {
-      setCafe24Conflict(null);
-      setCafe24PrecheckLoading(false);
-      return;
-    }
-    // mall_id 가 바뀔 때마다 350ms debounce — 짧으면 brute-force 호출,
-    // 길면 사용자가 Connect 클릭 시 stale 결과를 보게 됨.
-    //
-    // `AbortController` 로 in-flight 요청도 cancel — 사용자가 빠르게 타이핑하면
-    // 직전 fetch 가 backend 까지 도달했어도 응답을 기다리지 않고 abort 해
-    // throttle 카운터·서버 부하를 절약 (ai-review INFO #6, 2026-05-16).
-    // `controller.signal.aborted` 가 cancel 여부의 단일 진실 — 별도 boolean
-    // flag 미사용 (ai-review INFO #11).
-    const controller = new AbortController();
-    const { signal } = controller;
-    setCafe24PrecheckLoading(true);
-    const t = setTimeout(async () => {
-      try {
-        const result = await integrationsApi.cafe24Precheck(
-          cafe24MallIdInput,
-          signal,
-        );
-        if (!signal.aborted) setCafe24Conflict(result);
-      } catch {
-        // AbortError 는 정상 cancel 시그널 — silent (signal.aborted=true 분기).
-        // 그 외 오류도 backend 가드가 backstop 이므로 inline 배너를 띄우지
-        // 못해도 안전 (silent fail).
-        if (!signal.aborted) setCafe24Conflict(null);
-      } finally {
-        if (!signal.aborted) setCafe24PrecheckLoading(false);
-      }
-    }, 350);
-    return () => {
-      clearTimeout(t);
-      controller.abort();
-    };
-  }, [isCafe24OAuth, cafe24MallIdInput]);
+  const cafe24MallIdInput = String(credentials.mall_id ?? "").trim();
+  const { conflict: cafe24Conflict, loading: cafe24PrecheckLoading } =
+    useCafe24MallIdPrecheck(cafe24MallIdInput, isCafe24OAuth);
 
   /**
-   * 에러 토스트 — `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 는 한글 i18n
-   * 메시지를 primary 로, backend 의 영문 message 는 괄호 안 보조 정보로
-   * 노출. 다른 코드는 기존 동작 유지 (backend message 우선).
-   * 사용자가 "괄호 등을 이용해서 보조 안내로 사용" 지시 (2026-05-16).
+   * 에러 토스트 — 도메인-aware 코드 매핑 (`INTEGRATION_ERROR_CODE_TO_I18N`) 에
+   * 등록된 backend 코드는 한글 i18n 메시지를 primary 로, backend 영문 message 는
+   * 괄호 안 보조 정보로 노출. 매핑 없는 코드는 backend message 우선.
+   * 사용자가 "괄호 등을 이용해서 보조 안내로 사용" 지시 (2026-05-16, ai-review W11).
    */
   const formatErrorToast = (
     err: unknown,
@@ -167,8 +119,9 @@ export default function NewIntegrationPage() {
     };
     const backendCode = e.response?.data?.code;
     const backendMessage = e.response?.data?.message ?? e.message;
-    if (backendCode === "CAFE24_PRIVATE_APP_ALREADY_CONNECTED") {
-      const primary = t("integrations.cafe24DuplicateMallToast");
+    const mappedKey = getIntegrationErrorI18nKey(backendCode);
+    if (mappedKey) {
+      const primary = t(mappedKey);
       return backendMessage ? `${primary} (${backendMessage})` : primary;
     }
     return backendMessage ?? t(fallbackKey);
@@ -381,21 +334,21 @@ export default function NewIntegrationPage() {
       if (serviceType === "cafe24") {
         const mallId = String(credentials.mall_id ?? "").trim();
         if (!/^[a-z0-9-]{3,50}$/.test(mallId)) {
-          return "Mall ID must be 3-50 lowercase letters, digits, or hyphens.";
+          return t("integrations.cafe24ValidateMallIdPattern");
         }
         const appType = credentials.app_type as
           | "public"
           | "private"
           | undefined;
         if (appType !== "public" && appType !== "private") {
-          return "Cafe24 app type must be 'public' or 'private'.";
+          return t("integrations.cafe24ValidateAppType");
         }
         if (appType === "private") {
           if (!String(credentials.client_id ?? "").trim()) {
-            return "Private apps require client_id.";
+            return t("integrations.cafe24ValidatePrivateClientIdRequired");
           }
           if (!String(credentials.client_secret ?? "").trim()) {
-            return "Private apps require client_secret.";
+            return t("integrations.cafe24ValidatePrivateClientSecretRequired");
           }
         }
       }

```

#### 전체 파일 컨텍스트
```
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Loader2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import {
  integrationsApi,
  type AuthVariant,
  type Cafe24PrecheckResult,
  type IntegrationScope,
  type ServiceDefinition,
} from "@/lib/api/integrations";
import { getIntegrationErrorI18nKey } from "@/lib/api/integration-error-codes";
import { useCafe24MallIdPrecheck } from "@/lib/integrations/use-cafe24-mall-id-precheck";
import { ServiceIcon } from "../_shared/service-icons";
import { CredentialsForm } from "../_shared/credentials-form";
import { useT, type TFunction, type TranslationKey } from "@/lib/i18n";
import { useCafe24PendingPolling } from "@/lib/integrations/use-cafe24-pending-polling";

interface OAuthCallbackPayload {
  type: "oauth_callback";
  status: "success" | "error";
  mode?: "new" | "reauthorize" | "request_scopes";
  provider?: string;
  integrationId?: string | null;
  previewToken?: string | null;
  error?: string | null;
}

type Step = "auth" | "test";

export default function NewIntegrationPage() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const serviceType = params.get("service") ?? "";
  const rawStep = params.get("step") ?? "auth";
  const step: Step = rawStep === "test" ? "test" : "auth";

  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ["integrations", "services"],
    queryFn: () => integrationsApi.services(),
    staleTime: 5 * 60 * 1000,
  });

  const service: ServiceDefinition | undefined = useMemo(
    () => services?.find((s) => s.type === serviceType),
    [services, serviceType],
  );

  const [variantIndex, setVariantIndex] = useState(0);
  const variant: AuthVariant | undefined = service?.authVariants[variantIndex];

  const [name, setName] = useState("");
  const [scope, setScope] = useState<IntegrationScope>("personal");
  const [credentials, setCredentials] = useState<Record<string, unknown>>({});
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [testError, setTestError] = useState<string | null>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  useEffect(() => {
    if (!variant) {
      setCredentials({});
      setSelectedScopes([]);
      return;
    }
    const nextCreds: Record<string, unknown> = {};
    for (const f of variant.fields) {
      if (f.default !== undefined) nextCreds[f.key] = f.default;
    }
    setCredentials(nextCreds);
    setSelectedScopes(
      variant.authType === "oauth2" && service
        ? service.scopes.filter((s) => s.recommended).map((s) => s.value)
        : [],
    );
    setPreviewToken(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  // Cafe24 mall_id 사전 중복 감지 — 350ms debounce + AbortController + state 묶음을
  // `useCafe24MallIdPrecheck` 훅으로 분리해 page.tsx 응집도 향상 (ai-review W9,
  // 2026-05-16). spec/2-navigation/4-integration.md §9.2.
  const isCafe24OAuth =
    variant?.authType === "oauth2" && serviceType === "cafe24";
  const cafe24MallIdInput = String(credentials.mall_id ?? "").trim();
  const { conflict: cafe24Conflict, loading: cafe24PrecheckLoading } =
    useCafe24MallIdPrecheck(cafe24MallIdInput, isCafe24OAuth);

  /**
   * 에러 토스트 — 도메인-aware 코드 매핑 (`INTEGRATION_ERROR_CODE_TO_I18N`) 에
   * 등록된 backend 코드는 한글 i18n 메시지를 primary 로, backend 영문 message 는
   * 괄호 안 보조 정보로 노출. 매핑 없는 코드는 backend message 우선.
   * 사용자가 "괄호 등을 이용해서 보조 안내로 사용" 지시 (2026-05-16, ai-review W11).
   */
  const formatErrorToast = (
    err: unknown,
    fallbackKey: TranslationKey,
  ): string => {
    const e = err as {
      response?: { data?: { message?: string; code?: string } };
      message?: string;
    };
    const backendCode = e.response?.data?.code;
    const backendMessage = e.response?.data?.message ?? e.message;
    const mappedKey = getIntegrationErrorI18nKey(backendCode);
    if (mappedKey) {
      const primary = t(mappedKey);
      return backendMessage ? `${primary} (${backendMessage})` : primary;
    }
    return backendMessage ?? t(fallbackKey);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const isOAuth = variant?.authType === "oauth2";
      const payload = {
        serviceType,
        name,
        authType: variant!.authType,
        scope,
        credentials: isOAuth
          ? { scopes: selectedScopes }
          : credentials,
        previewToken: isOAuth ? (previewToken ?? undefined) : undefined,
      };
      return integrationsApi.create(payload);
    },
    onSuccess: (created) => {
      toast.success(t("integrations.integrationCreatedToast"));
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      router.push(`/integrations/${created.id}`);
    },
    onError: (err: unknown) => {
      toast.error(
        formatErrorToast(err, "integrations.integrationCreateFailedDefault"),
      );
    },
  });

  const oauthTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [oauthWaiting, setOauthWaiting] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [privatePending, setPrivatePending] = useState<{
    integrationId: string;
    appUrl: string;
    callbackUrl: string;
  } | null>(null);

  const clearOAuthTimeout = () => {
    if (oauthTimeoutRef.current) {
      clearTimeout(oauthTimeoutRef.current);
      oauthTimeoutRef.current = null;
    }
  };

  const oauthBeginMutation = useMutation({
    mutationFn: async () => {
      // Cafe24 needs mall_id + app_type (and private-app credentials) on
      // the begin call so the backend can build the mall-specific
      // authorize URL and persist them on the OAuth state row.
      // spec/2-navigation/4-integration.md §3.2 / §9.2.
      const cafe24Extra =
        serviceType === "cafe24"
          ? {
              mallId: String(credentials.mall_id ?? "").trim(),
              appType:
                (credentials.app_type as "public" | "private" | undefined) ??
                "public",
              ...(credentials.app_type === "private"
                ? {
                    clientId: String(credentials.client_id ?? ""),
                    clientSecret: String(credentials.client_secret ?? ""),
                  }
                : {}),
            }
          : {};
      return integrationsApi.oauthBegin({
        service: serviceType,
        scopes: selectedScopes,
        mode: "new",
        integrationName: name,
        scope,
        ...cafe24Extra,
      });
    },
    onSuccess: (result) => {
      if ("mode" in result && result.mode === "cafe24_private_pending") {
        setPrivatePending({
          integrationId: result.integrationId,
          appUrl: result.appUrl,
          callbackUrl: result.callbackUrl,
        });
        queryClient.invalidateQueries({ queryKey: ["integrations"] });
        return;
      }
      if (!("authUrl" in result)) return;
      popupRef.current = openOAuthPopup(result.authUrl);
      setOauthError(null);
      setOauthWaiting(true);
      clearOAuthTimeout();
      oauthTimeoutRef.current = setTimeout(() => {
        setOauthWaiting(false);
        setOauthError(t("integrations.oauthTimedOutShort"));
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
        }
        toast.error(t("integrations.oauthTimedOutMessage"));
      }, 5 * 60 * 1000);
      toast.message(t("integrations.oauthContinueInPopup"));
    },
    onError: (err: unknown) => {
      toast.error(formatErrorToast(err, "integrations.oauthStartFailed"));
    },
  });

  useEffect(() => {
    const handler = (event: MessageEvent<OAuthCallbackPayload>) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "oauth_callback") return;
      clearOAuthTimeout();
      setOauthWaiting(false);
      if (event.data.status === "error") {
        const msg = event.data.error ?? t("integrations.oauthFailedShort");
        setOauthError(msg);
        toast.error(msg);
        return;
      }
      if (event.data.previewToken) {
        setPreviewToken(event.data.previewToken);
        setOauthError(null);
        toast.success(t("integrations.oauthCompletedToast"));
        goToStep("test");
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
      clearOAuthTimeout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Public-flow safety net: if the popup is closed (manually or after our
  // callback HTML's delayed close) without ever firing the message handler
  // — e.g. the user cancelled at the provider, blocked popups, or origin
  // mismatch silently dropped postMessage — we'd otherwise sit in
  // `oauthWaiting` until the 5-minute timeout. Poll popup.closed and bail
  // out within 5s of close.
  //
  // Refs (not state) feed the closure to avoid stale reads: the success
  // postMessage handler can fire BETWEEN our popup.closed observation and
  // the deferred check, flipping oauthWaiting → false; we must see that
  // latest value or we'd double-fire the error toast.
  const oauthWaitingRef = useRef(oauthWaiting);
  const previewTokenRef = useRef(previewToken);
  useEffect(() => {
    oauthWaitingRef.current = oauthWaiting;
  }, [oauthWaiting]);
  useEffect(() => {
    previewTokenRef.current = previewToken;
  }, [previewToken]);

  useEffect(() => {
    if (!oauthWaiting) return;
    let bailTimer: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      const popup = popupRef.current;
      if (popup && popup.closed) {
        bailTimer = setTimeout(() => {
          if (!oauthWaitingRef.current) return; // success handler already won
          clearOAuthTimeout();
          setOauthWaiting(false);
          if (!previewTokenRef.current) {
            setOauthError(t("integrations.oauthPopupClosedNoResult"));
            toast.error(t("integrations.oauthPopupClosedNoResult"));
          }
        }, 1500);
        clearInterval(interval);
      }
    }, 500);
    return () => {
      clearInterval(interval);
      if (bailTimer) clearTimeout(bailTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauthWaiting]);

  useEffect(() => {
    const isOAuth = variant?.authType === "oauth2";
    const hasUserInput =
      (!isOAuth && Object.values(credentials).some((v) => v)) ||
      name.trim().length > 0 ||
      oauthWaiting;
    if (!hasUserInput) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [variant, credentials, name, oauthWaiting]);

  const goToStep = (next: Step) => {
    const qp = new URLSearchParams();
    qp.set("service", serviceType);
    qp.set("step", next);
    router.replace(`/integrations/new?${qp.toString()}`);
  };

  const validate = (): string | null => {
    if (!variant) return t("integrations.selectAuthType");
    if (!name.trim()) return t("integrations.nameRequired");
    const isOAuth = variant.authType === "oauth2";
    if (isOAuth) {
      // Cafe24 begin-time validation — mirror backend OAuth begin checks
      // so users hit them locally before the popup opens.
      if (serviceType === "cafe24") {
        const mallId = String(credentials.mall_id ?? "").trim();
        if (!/^[a-z0-9-]{3,50}$/.test(mallId)) {
          return t("integrations.cafe24ValidateMallIdPattern");
        }
        const appType = credentials.app_type as
          | "public"
          | "private"
          | undefined;
        if (appType !== "public" && appType !== "private") {
          return t("integrations.cafe24ValidateAppType");
        }
        if (appType === "private") {
          if (!String(credentials.client_id ?? "").trim()) {
            return t("integrations.cafe24ValidatePrivateClientIdRequired");
          }
          if (!String(credentials.client_secret ?? "").trim()) {
            return t("integrations.cafe24ValidatePrivateClientSecretRequired");
          }
        }
      }
      if (selectedScopes.length === 0) return t("integrations.selectAtLeastOneScope");
      if (!previewToken) return t("integrations.completeOauth");
      return null;
    }
    for (const f of variant.fields) {
      if (f.required) {
        const v = credentials[f.key];
        if (v === undefined || v === null || v === "") {
          return t("integrations.fieldRequired", { label: f.label });
        }
      }
    }
    return null;
  };

  if (servicesLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="space-y-4">
        <Link
          href="/integrations"
          className="inline-flex items-center gap-1 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          <ArrowLeft className="h-4 w-4" /> {t("integrations.backToList")}
        </Link>
        <p className="text-sm">
          {t("integrations.unknownService", { type: serviceType || "—" })}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/integrations"
        className="inline-flex items-center gap-1 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-4 w-4" /> {t("integrations.backToList")}
      </Link>

      <div className="flex items-center gap-3">
        <div className="rounded-lg border border-[hsl(var(--border))] p-3">
          <ServiceIcon type={service.type} className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {t("integrations.connectWith", { name: service.name })}
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t("integrations.stepCounter", { current: step === "auth" ? 1 : 2 })}
          </p>
        </div>
      </div>

      {step === "auth" && !privatePending && (
        <AuthStep
          service={service}
          variant={variant}
          variantIndex={variantIndex}
          setVariantIndex={setVariantIndex}
          name={name}
          setName={setName}
          scope={scope}
          setScope={setScope}
          credentials={credentials}
          setCredentials={setCredentials}
          selectedScopes={selectedScopes}
          setSelectedScopes={setSelectedScopes}
          previewToken={previewToken}
          oauthWaiting={oauthWaiting}
          oauthError={oauthError}
          cafe24Conflict={cafe24Conflict}
          cafe24PrecheckLoading={cafe24PrecheckLoading}
          onConnect={() => {
            if (!name.trim()) {
              toast.error(t("integrations.nameRequired"));
              return;
            }
            if (selectedScopes.length === 0) {
              toast.error(t("integrations.selectAtLeastOneScope"));
              return;
            }
            // 사전 감지로 중복이 이미 잡혔으면 backend 왕복 자체를 막는다.
            // backend 도 동일한 가드를 가지지만 사용자 입장에선 toast 만
            // 보고 OAuth 흐름이 시작 안 되니 inline 배너가 더 명확.
            if (cafe24Conflict?.conflict) {
              toast.error(
                t("integrations.cafe24DuplicateMallToast"),
              );
              return;
            }
            oauthBeginMutation.mutate();
          }}
          connecting={oauthBeginMutation.isPending}
          onContinue={() => {
            const err = validate();
            if (err) {
              toast.error(err);
              return;
            }
            setTestError(null);
            goToStep("test");
          }}
          t={t}
        />
      )}

      {privatePending && (
        <Cafe24PrivatePendingStep
          appUrl={privatePending.appUrl}
          callbackUrl={privatePending.callbackUrl}
          integrationId={privatePending.integrationId}
          t={t}
        />
      )}

      {step === "test" && variant && (
        <TestStep
          service={service}
          name={name}
          serviceType={serviceType}
          authType={variant.authType}
          credentials={
            variant.authType === "oauth2"
              ? { scopes: selectedScopes, __has_preview: !!previewToken }
              : credentials
          }
          skipProbe={variant.authType === "oauth2"}
          savedError={testError}
          onTestError={setTestError}
          saving={createMutation.isPending}
          onBack={() => goToStep("auth")}
          onSave={() => createMutation.mutate()}
          t={t}
        />
      )}
    </div>
  );
}

interface AuthStepProps {
  service: ServiceDefinition;
  variant: AuthVariant | undefined;
  variantIndex: number;
  setVariantIndex: (i: number) => void;
  name: string;
  setName: (s: string) => void;
  scope: IntegrationScope;
  setScope: (s: IntegrationScope) => void;
  credentials: Record<string, unknown>;
  setCredentials: (c: Record<string, unknown>) => void;
  selectedScopes: string[];
  setSelectedScopes: (s: string[]) => void;
  previewToken: string | null;
  oauthWaiting: boolean;
  oauthError: string | null;
  cafe24Conflict: Cafe24PrecheckResult | null;
  cafe24PrecheckLoading: boolean;
  onConnect: () => void;
  connecting: boolean;
  onContinue: () => void;
  t: TFunction;
}

function AuthStep({
  service,
  variant,
  variantIndex,
  setVariantIndex,
  name,
  setName,
  scope,
  setScope,
  credentials,
  setCredentials,
  selectedScopes,
  setSelectedScopes,
  previewToken,
  oauthWaiting,
  oauthError,
  cafe24Conflict,
  cafe24PrecheckLoading,
  onConnect,
  connecting,
  onContinue,
  t,
}: AuthStepProps) {
  const isOAuth = variant?.authType === "oauth2";
  const toggleScope = (value: string) => {
    setSelectedScopes(
      selectedScopes.includes(value)
        ? selectedScopes.filter((s) => s !== value)
        : [...selectedScopes, value],
    );
  };

  return (
    <div className="space-y-6 rounded-lg border border-[hsl(var(--border))] p-6">
      <div>
        <Label htmlFor="int-name">
          {t("integrations.nameLabel")} <span className="text-red-500">*</span>
        </Label>
        <Input
          id="int-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("integrations.namePlaceholderWithService", { name: service.name })}
        />
      </div>

      <div>
        <Label>{t("integrations.scopeChangeTitle")}</Label>
        <div className="inline-flex w-full rounded-lg border border-[hsl(var(--border))] p-1">
          {(["personal", "organization"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                scope === opt
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
              )}
              onClick={() => setScope(opt)}
            >
              {opt === "personal"
                ? t("integrations.scopePersonal")
                : t("integrations.scopeOrganization")}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          {t("integrations.scopeHint")}
        </p>
      </div>

      {service.authVariants.length > 1 && (
        <div>
          <Label>{t("integrations.authTypeLabel2")}</Label>
          <div className="flex flex-wrap gap-2">
            {service.authVariants.map((v, i) => (
              <button
                key={v.authType}
                type="button"
                onClick={() => setVariantIndex(i)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  variantIndex === i
                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {variant && !isOAuth && (
        <CredentialsForm
          variant={variant}
          values={credentials}
          onChange={(key, value) =>
            setCredentials({ ...credentials, [key]: value })
          }
        />
      )}

      {variant?.authType === "oauth2" && service.type === "cafe24" && (
        <Cafe24ExtraFields
          credentials={credentials}
          setCredentials={setCredentials}
          publicAppAvailable={service.meta?.publicAppAvailable !== false}
          conflict={cafe24Conflict}
          precheckLoading={cafe24PrecheckLoading}
        />
      )}

      {variant?.authType === "oauth2" && service.scopes.length > 0 && (
        <div>
          <Label>{t("integrations.oauthScopesLabel")}</Label>
          {service.type === "cafe24" && (
            <div
              role="note"
              className="mb-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
            >
              {t("integrations.cafe24ScopeWarning")}
            </div>
          )}
          <div className="space-y-2 rounded-md border border-[hsl(var(--border))] p-3">
            {service.scopes.map((s) => (
              <label
                key={s.value}
                className="flex cursor-pointer items-start gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedScopes.includes(s.value)}
                  onChange={() => toggleScope(s.value)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-medium">{s.label}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    {s.value}
                  </div>
                </div>
                {s.recommended && (
                  <span className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    {t("integrations.recommendedBadge")}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {isOAuth && (
        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-4">
          <div className="mb-2 text-sm font-medium">
            {oauthWaiting
              ? t("integrations.waitingPopup")
              : previewToken
                ? t("integrations.oauthComplete")
                : t("integrations.authorizePrompt")}
          </div>
          {oauthError && (
            <div className="mb-2 text-xs text-red-600 dark:text-red-400">
              {oauthError}
            </div>
          )}
          <Button
            variant={previewToken ? "outline" : "default"}
            onClick={onConnect}
            // Cafe24 사전 중복 감지 — conflict 가 발견된 mall_id 로는 OAuth
            // 진입 자체를 막는다. 사용자가 mall_id 를 다른 값으로 바꾸거나
            // 기존 통합을 삭제하지 않는 한 Connect 비활성. precheck 가
            // 350ms debounce 후 fetching 중인 동안에도 Connect 를 비활성화해
            // "사전 감지 결과를 보기 전에 OAuth 시작" race 를 막는다.
            // backend 가드는 backstop 으로 살아있어 우회 시도도 안전.
            disabled={
              connecting ||
              oauthWaiting ||
              cafe24PrecheckLoading ||
              cafe24Conflict?.conflict === true
            }
          >
            {connecting || oauthWaiting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {previewToken
              ? t("integrations.reauthorizeBtn2")
              : t("integrations.connectWith", { name: service.name })}
          </Button>
          {oauthWaiting && (
            <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
              {t("integrations.timesOutHint")}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onContinue}>{t("integrations.continueBtn")}</Button>
      </div>
    </div>
  );
}

/**
 * Cafe24-only extra fields for OAuth2 — Mall ID + App type (+ private-app
 * client_id / client_secret). Stored on the same `credentials` map so the
 * page-level oauthBegin handler can pluck them out at the call site.
 * spec/2-navigation/4-integration.md §3.2 (OAuth2 Cafe24 흐름).
 */
function Cafe24ExtraFields({
  credentials,
  setCredentials,
  publicAppAvailable,
  conflict,
  precheckLoading,
}: {
  credentials: Record<string, unknown>;
  setCredentials: (c: Record<string, unknown>) => void;
  /** False when server's CAFE24_CLIENT_* env vars are unset → only Private. */
  publicAppAvailable: boolean;
  /** Cafe24 mall_id 사전 중복 감지 결과 (null 이면 미감지 / 진행 중). */
  conflict: Cafe24PrecheckResult | null;
  /** debounce 호출 중 표시용 (배너 자리 안정화). */
  precheckLoading: boolean;
}) {
  // `t` 를 prop 으로 받지 않고 useT 를 직접 호출 — 다른 컴포넌트(`AuthStep` 등)
  // 와의 일관성. ai-review WARNING #10 (2026-05-16) 조치.
  const t = useT();
  const set = (key: string, value: unknown) =>
    setCredentials({ ...credentials, [key]: value });
  const mallId = String(credentials.mall_id ?? "");
  // When Public isn't usable on this deployment, force the form to Private
  // and never even render the toggle so the user can't accidentally pick a
  // dead-end option. Default to "public" only if the deployment supports it.
  const rawAppType = credentials.app_type as
    | "public"
    | "private"
    | undefined;
  const appType: "public" | "private" = !publicAppAvailable
    ? "private"
    : (rawAppType ?? "public");
  // When the deployment forbids Public, coerce the credentials state to
  // "private" exactly once. Done in an effect (not during render) so we
  // don't violate React's "no setState during render" rule.
  useEffect(() => {
    if (!publicAppAvailable && rawAppType !== "private") {
      set("app_type", "private");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicAppAvailable, rawAppType]);
  const clientId = String(credentials.client_id ?? "");
  const clientSecret = String(credentials.client_secret ?? "");
  const appTypeOptions = publicAppAvailable
    ? (["public", "private"] as const)
    : (["private"] as const);

  // 상태별 안내 메시지 분기 — connected 는 가장 강한 차단, pending_install
  // 은 install 진행 중 안내, expired/error 는 정리 후 재등록 안내.
  // spec/2-navigation/4-integration.md §9.2 Rationale "precheck endpoint".
  const conflictDescKey: TranslationKey | null = !conflict?.conflict
    ? null
    : conflict.status === "pending_install"
      ? "integrations.cafe24DuplicateMallPendingDesc"
      : conflict.status === "expired"
        ? "integrations.cafe24DuplicateMallExpiredDesc"
        : conflict.status === "error"
          ? "integrations.cafe24DuplicateMallErrorDesc"
          : "integrations.cafe24DuplicateMallConnectedDesc";

  return (
    <div className="space-y-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 p-4">
      <div>
        <Label htmlFor="cafe24-mall-id">
          Mall ID <span className="text-red-500">*</span>
        </Label>
        <Input
          id="cafe24-mall-id"
          placeholder="myshop"
          value={mallId}
          onChange={(e) => set("mall_id", e.target.value.trim())}
          // `-` is escaped because browsers compile the HTML5 `pattern`
          // attribute with the ES2024 `v` flag, which rejects an
          // unescaped hyphen inside a character class. Same semantic as
          // the backend regex /^[a-z0-9-]{3,50}$/.
          pattern="^[a-z0-9\-]{3,50}$"
          aria-invalid={conflict?.conflict ? true : undefined}
          aria-describedby={
            conflict?.conflict ? "cafe24-mall-dup-banner" : undefined
          }
        />
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          Lower-case letters, digits, and hyphens, 3–50 chars. Forms the
          base URL <code>https://{"{mall_id}"}.cafe24api.com</code>.
        </p>
        {/* 사전 중복 감지 inline 배너 — precheck endpoint 응답에 따라
            상태별 안내 + 기존 통합으로 가는 deep link 노출. */}
        {conflict?.conflict && conflictDescKey && (
          <div
            id="cafe24-mall-dup-banner"
            role="alert"
            className="mt-2 flex gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200"
          >
            <AlertTriangle
              className="mt-0.5 h-4 w-4 flex-shrink-0"
              aria-hidden
            />
            <div className="space-y-1.5">
              <div className="font-semibold">
                {t("integrations.cafe24DuplicateMallTitle")}
              </div>
              <div>{t(conflictDescKey)}</div>
              {conflict.existingIntegrationId && (
                <Link
                  href={`/integrations/${conflict.existingIntegrationId}`}
                  className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
                >
                  {t("integrations.cafe24DuplicateMallViewExisting")}
                  {conflict.existingName ? ` — ${conflict.existingName}` : ""}
                </Link>
              )}
            </div>
          </div>
        )}
        {precheckLoading && !conflict?.conflict && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t("integrations.cafe24DuplicateMallChecking")}
          </p>
        )}
      </div>

      <div>
        <Label>
          App Type <span className="text-red-500">*</span>
        </Label>
        <div className="inline-flex w-full rounded-lg border border-[hsl(var(--border))] p-1">
          {appTypeOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                appType === opt
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
              )}
              onClick={() => set("app_type", opt)}
            >
              {opt === "public" ? "Public (App Store)" : "Private (Self-issued)"}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          {publicAppAvailable ? (
            <>
              <strong>Public</strong> — official Cafe24 app store app
              (server-side credentials). <strong>Private</strong> — paste the
              client_id / client_secret from your shop&apos;s admin.
            </>
          ) : (
            <>
              <strong>Private only</strong> — this deployment has not registered
              a Cafe24 App Store app, so only self-issued Private apps are
              available. Paste your shop&apos;s client_id / client_secret below.
            </>
          )}
        </p>
      </div>

      {appType === "private" && (
        <>
          <div>
            <Label htmlFor="cafe24-client-id">
              Client ID <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cafe24-client-id"
              value={clientId}
              onChange={(e) => set("client_id", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="cafe24-client-secret">
              Client Secret <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cafe24-client-secret"
              type="password"
              autoComplete="new-password"
              value={clientSecret}
              onChange={(e) => set("client_secret", e.target.value)}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Cafe24PrivatePendingStep({
  appUrl,
  callbackUrl,
  integrationId,
  t,
}: {
  appUrl: string;
  callbackUrl: string;
  integrationId: string;
  t: TFunction;
}) {
  const router = useRouter();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copy = (value: string, field: string) => {
    void navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Polling state machine extracted to a hook so it can be unit-tested
  // independently of this presentational shell.
  const { poll, timedOut, lastErrorMessage } =
    useCafe24PendingPolling(integrationId);

  return (
    <div className="space-y-6 rounded-lg border border-[hsl(var(--border))] p-6">
      <div>
        <h2 className="text-lg font-semibold">
          {t("integrations.cafe24PrivatePendingTitle")}
        </h2>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          {t("integrations.cafe24PrivatePendingDesc")}
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {t("integrations.cafe24AppUrlLabel")}
          </Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-[hsl(var(--muted))] px-3 py-2 text-xs">
              {appUrl}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(appUrl, "appUrl")}
              className="shrink-0"
            >
              <Copy className="mr-1 h-3 w-3" />
              {copiedField === "appUrl"
                ? t("integrations.copied")
                : "Copy"}
            </Button>
          </div>
        </div>

        <div>
          <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {t("integrations.cafe24CallbackUrlLabel")}
          </Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-[hsl(var(--muted))] px-3 py-2 text-xs">
              {callbackUrl}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(callbackUrl, "callbackUrl")}
              className="shrink-0"
            >
              <Copy className="mr-1 h-3 w-3" />
              {copiedField === "callbackUrl"
                ? t("integrations.copied")
                : "Copy"}
            </Button>
          </div>
        </div>
      </div>

      {lastErrorMessage ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
        >
          <strong>
            {t("integrations.cafe24PrivatePendingLastErrorLabel")}:
          </strong>{" "}
          {lastErrorMessage}
        </div>
      ) : (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
          {t("integrations.cafe24PrivatePendingSteps")}
        </div>
      )}

      {poll?.status === "pending_install" && !timedOut && (
        <p className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t("integrations.cafe24PrivatePendingWaiting")}
        </p>
      )}
      {timedOut && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {t("integrations.cafe24PrivatePendingTimedOut")}
        </p>
      )}
      {/* Polling stops when status transitions out of pending_install — the
       * user otherwise sees a silent UI. expired (TTL) and error both need
       * an explicit "delete and re-register" hint since Cafe24 Private has
       * no reauthorize entry point. */}
      {poll &&
        poll.status !== "pending_install" &&
        poll.status !== "connected" && (
          <p
            role="status"
            className="text-xs text-amber-700 dark:text-amber-300"
          >
            {poll.status === "expired" &&
            poll.statusReason === "install_timeout"
              ? t("integrations.cafe24PrivatePendingExpired")
              : t("integrations.cafe24PrivatePendingTerminal")}
          </p>
        )}

      <div className="flex justify-end">
        <Button onClick={() => router.push(`/integrations/${integrationId}`)}>
          {t("integrations.cafe24PrivatePendingViewList")}
        </Button>
      </div>
    </div>
  );
}

function openOAuthPopup(url: string): Window | null {
  const width = 600;
  const height = 700;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  return window.open(
    url,
    "integration-oauth",
    `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
  );
}

interface TestStepProps {
  service: ServiceDefinition;
  name: string;
  serviceType: string;
  authType: string;
  credentials: Record<string, unknown>;
  skipProbe: boolean;
  savedError: string | null;
  onTestError: (err: string | null) => void;
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
  t: TFunction;
}

function TestStep({
  service,
  name,
  serviceType,
  authType,
  credentials,
  skipProbe,
  savedError,
  onTestError,
  saving,
  onBack,
  onSave,
  t,
}: TestStepProps) {
  const test = useQuery({
    queryKey: ["integrations", "preview-test", serviceType, authType],
    enabled: !skipProbe,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const result = await integrationsApi.previewTest({
        serviceType,
        authType,
        credentials,
      });
      if (!result.success) {
        throw new Error(result.message);
      }
      return result;
    },
  });

  useEffect(() => {
    if (!skipProbe && test.isError) {
      onTestError((test.error as Error | undefined)?.message ?? t("integrations.validationFailed"));
    } else if (test.isSuccess) {
      onTestError(null);
    }
  }, [skipProbe, test.isError, test.isSuccess, test.error, onTestError, t]);

  const pending = !skipProbe && test.isPending;
  const failed = (!skipProbe && test.isError) || !!savedError;
  const message = savedError
    ? savedError
    : test.isError
      ? (test.error as Error | undefined)?.message
      : null;

  return (
    <div className="space-y-6 rounded-lg border border-[hsl(var(--border))] p-6">
      <div className="flex items-center gap-3">
        {pending ? (
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
        ) : failed ? (
          <XCircle className="h-8 w-8 text-red-500" />
        ) : (
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        )}
        <div>
          <h2 className="text-lg font-semibold">
            {pending
              ? t("integrations.testingCredentials")
              : failed
                ? t("integrations.validationFailed")
                : t("integrations.readyToSave")}
          </h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {pending
              ? t("integrations.runningProbe")
              : failed
                ? message ?? t("integrations.checkAuthRetry")
                : t("integrations.readyMessage", { service: service.name, name })}
          </p>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          {t("integrations.backToAuth")}
        </Button>
        <Button onClick={onSave} disabled={saving || pending || failed}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("integrations.saveIntegration")}
        </Button>
      </div>
    </div>
  );
}

```

---

### 파일 5: frontend/src/lib/api/integration-error-codes.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/api/integration-error-codes.ts b/frontend/src/lib/api/integration-error-codes.ts
new file mode 100644
index 00000000..43485796
--- /dev/null
+++ b/frontend/src/lib/api/integration-error-codes.ts
@@ -0,0 +1,50 @@
+import type { TranslationKey } from "@/lib/i18n";
+
+/**
+ * Backend integration 에러 코드 중 frontend 가 도메인-aware 메시지로 remap 하는
+ * 화이트리스트. 각 코드는 한글 primary 메시지 (i18n 키) 와 매핑되며,
+ * `formatErrorToast` 등 toast 헬퍼가 본 매핑을 조회한다 — backend 의 영문
+ * `message` 는 (괄호) 안 보조 정보로 노출.
+ *
+ * 새 매핑 추가 시:
+ *   1. INTEGRATION_LOCALIZED_ERROR_CODES 에 의미 기반 alias + 실제 backend 코드
+ *   2. INTEGRATION_ERROR_CODE_TO_I18N 에 i18n 키 추가 (ko/en parity 유지)
+ *   3. 호출자(`formatErrorToast` 등)는 본 모듈만 import — 코드 문자열을
+ *      컴포넌트에 직접 박지 않는다 (ai-review W11 — 2026-05-16).
+ *
+ * spec/2-navigation/4-integration.md §9.4 (errors).
+ */
+export const INTEGRATION_LOCALIZED_ERROR_CODES = {
+  /**
+   * 동일 (workspaceId, mall_id) cafe24 통합이 이미 존재 — app_type 무관.
+   * 코드 이름의 `PRIVATE` 토큰은 historical artifact (spec Rationale 참조).
+   */
+  CAFE24_DUPLICATE_MALL: "CAFE24_PRIVATE_APP_ALREADY_CONNECTED",
+} as const;
+
+export type IntegrationLocalizedErrorCode =
+  (typeof INTEGRATION_LOCALIZED_ERROR_CODES)[keyof typeof INTEGRATION_LOCALIZED_ERROR_CODES];
+
+/** Backend 에러 코드 → 한글 primary 메시지 i18n 키. */
+export const INTEGRATION_ERROR_CODE_TO_I18N: Readonly<
+  Record<IntegrationLocalizedErrorCode, TranslationKey>
+> = {
+  [INTEGRATION_LOCALIZED_ERROR_CODES.CAFE24_DUPLICATE_MALL]:
+    "integrations.cafe24DuplicateMallToast",
+};
+
+/**
+ * Backend 에러 응답에서 `code` 를 꺼내 매핑된 i18n 키를 반환.
+ * 매핑 없는 코드면 `null` 반환 — 호출자는 fallback 처리.
+ */
+export function getIntegrationErrorI18nKey(
+  errorCode: string | null | undefined,
+): TranslationKey | null {
+  if (!errorCode) return null;
+  if (Object.prototype.hasOwnProperty.call(INTEGRATION_ERROR_CODE_TO_I18N, errorCode)) {
+    return INTEGRATION_ERROR_CODE_TO_I18N[
+      errorCode as IntegrationLocalizedErrorCode
+    ];
+  }
+  return null;
+}

```

#### 전체 파일 컨텍스트
```
import type { TranslationKey } from "@/lib/i18n";

/**
 * Backend integration 에러 코드 중 frontend 가 도메인-aware 메시지로 remap 하는
 * 화이트리스트. 각 코드는 한글 primary 메시지 (i18n 키) 와 매핑되며,
 * `formatErrorToast` 등 toast 헬퍼가 본 매핑을 조회한다 — backend 의 영문
 * `message` 는 (괄호) 안 보조 정보로 노출.
 *
 * 새 매핑 추가 시:
 *   1. INTEGRATION_LOCALIZED_ERROR_CODES 에 의미 기반 alias + 실제 backend 코드
 *   2. INTEGRATION_ERROR_CODE_TO_I18N 에 i18n 키 추가 (ko/en parity 유지)
 *   3. 호출자(`formatErrorToast` 등)는 본 모듈만 import — 코드 문자열을
 *      컴포넌트에 직접 박지 않는다 (ai-review W11 — 2026-05-16).
 *
 * spec/2-navigation/4-integration.md §9.4 (errors).
 */
export const INTEGRATION_LOCALIZED_ERROR_CODES = {
  /**
   * 동일 (workspaceId, mall_id) cafe24 통합이 이미 존재 — app_type 무관.
   * 코드 이름의 `PRIVATE` 토큰은 historical artifact (spec Rationale 참조).
   */
  CAFE24_DUPLICATE_MALL: "CAFE24_PRIVATE_APP_ALREADY_CONNECTED",
} as const;

export type IntegrationLocalizedErrorCode =
  (typeof INTEGRATION_LOCALIZED_ERROR_CODES)[keyof typeof INTEGRATION_LOCALIZED_ERROR_CODES];

/** Backend 에러 코드 → 한글 primary 메시지 i18n 키. */
export const INTEGRATION_ERROR_CODE_TO_I18N: Readonly<
  Record<IntegrationLocalizedErrorCode, TranslationKey>
> = {
  [INTEGRATION_LOCALIZED_ERROR_CODES.CAFE24_DUPLICATE_MALL]:
    "integrations.cafe24DuplicateMallToast",
};

/**
 * Backend 에러 응답에서 `code` 를 꺼내 매핑된 i18n 키를 반환.
 * 매핑 없는 코드면 `null` 반환 — 호출자는 fallback 처리.
 */
export function getIntegrationErrorI18nKey(
  errorCode: string | null | undefined,
): TranslationKey | null {
  if (!errorCode) return null;
  if (Object.prototype.hasOwnProperty.call(INTEGRATION_ERROR_CODE_TO_I18N, errorCode)) {
    return INTEGRATION_ERROR_CODE_TO_I18N[
      errorCode as IntegrationLocalizedErrorCode
    ];
  }
  return null;
}

```

---

### 파일 6: frontend/src/lib/i18n/dict/en/integrations.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/i18n/dict/en/integrations.ts b/frontend/src/lib/i18n/dict/en/integrations.ts
index 1e6aa9ba..6c2004b6 100644
--- a/frontend/src/lib/i18n/dict/en/integrations.ts
+++ b/frontend/src/lib/i18n/dict/en/integrations.ts
@@ -213,4 +213,11 @@ export const integrations: Dict["integrations"] = {
   cafe24DuplicateMallToast:
     "This mall ID is already connected and cannot be added",
   cafe24DuplicateMallChecking: "Checking…",
+  // ----- Cafe24 begin-time validation (frontend pre-check) -----
+  cafe24ValidateMallIdPattern:
+    "Mall ID must be 3–50 lowercase letters, digits, or hyphens.",
+  cafe24ValidateAppType: "Cafe24 app type must be 'public' or 'private'.",
+  cafe24ValidatePrivateClientIdRequired: "Private apps require client_id.",
+  cafe24ValidatePrivateClientSecretRequired:
+    "Private apps require client_secret.",
 };

```

#### 전체 파일 컨텍스트
```
import type { Dict } from "../types";

export const integrations: Dict["integrations"] = {
  title: "Integrations",
  description: "Connect external services to your workflows",
  new: "New integration",
  marketplace: "Marketplace",
  connected: "Connected",
  notConnected: "Not connected",
  connect: "Connect",
  disconnect: "Disconnect",
  configure: "Configure",
  credentials: "Credentials",
  scopes: "Scopes",
  provider: "Provider",
  status: "Status",
  statusConnected: "Connected",
  statusDisconnected: "Disconnected",
  statusExpired: "Expired",
  reauthorize: "Reauthorize",
  reauthorized: "Reauthorized",
  reauthorizeFailed: "Failed to reauthorize",
  oauthCompleted: "OAuth completed",
  oauthFailed: "OAuth failed",
  created: "Integration created",
  createFailed: "Failed to create integration",
  updated: "Integration updated",
  updateFailed: "Failed to update integration",
  deleted: "Integration deleted",
  deleteFailed: "Failed to delete integration",
  deleteConfirm: "Delete this integration?",
  connectionTest: "Test connection",
  connectionTestSuccess: "Connection test succeeded",
  connectionTestFailed: "Connection failed: {{error}}",
  deletedMcpLabel: "Removed MCP ({{idShort}}…)",
  loadFailed: "Failed to load integrations",
  empty: "No integrations yet",
  addIntegration: "Add Integration",
  searchPlaceholder: "Search integrations...",
  scopeAll: "All",
  statusAll: "All",
  scopePersonal: "Personal",
  scopeOrganization: "Organization",
  refreshAria: "Refresh",
  allServices: "All services",
  statusExpiring: "Expiring",
  statusError: "Error",
  statusAttention: "Attention",
  attentionTitlePlural: "{{count}} integrations need attention",
  attentionTitleSingle: "1 integration needs attention",
  attentionBreakdownExpired: "Expired {{count}}",
  attentionBreakdownExpiring: "Expiring {{count}}",
  attentionBreakdownError: "Error {{count}}",
  attentionClickToFilter: "Click to filter",
  attentionClickToOpen: "Click to open",
  loadFailedHint: "Failed to load integrations.",
  retry: "Retry",
  emptyTitle: "No integrations yet",
  emptyDescription: "Connect external services to use them from your workflows.",
  sectionOrg: "Organization",
  sectionPersonal: "Personal",
  paginationSummary: "Page {{page}} of {{totalPages}} · {{totalItems}} total",
  backToList: "Back to integrations",
  notFound: "Integration not found.",
  inUseError: "Integration is still in use. See the Usage tab for details.",
  tabOverview: "Overview",
  tabSecurity: "Security",
  tabScope: "Scope",
  tabUsage: "Usage",
  tabActivity: "Activity",
  tabDanger: "Danger zone",
  lastUsedRel: "Last used {{relative}}",
  serviceLabel: "Service",
  authTypeLabel: "Auth type",
  nameLabel: "Name",
  saveBtn: "Save",
  cancelBtn: "Cancel",
  editBtn: "Edit",
  createdAtLabel: "Created at",
  lastUsedLabel: "Last used",
  lastRotatedLabel: "Last rotated",
  tokenExpiresLabel: "Token expires",
  testConnectionBtn: "Test connection",
  nameUpdated: "Name updated",
  nameUpdateFailed: "Failed to update name",
  connectionPassed: "Connection test passed",
  connectionFailedMsg: "Test failed: {{error}}",
  testFailedToast: "Test failed",
  authenticationSection: "Authentication",
  reauthorizeSection: "Reauthorize",
  reauthorizeHint: "Open the provider in a new window to refresh tokens.",
  reauthorizeBtn: "Reauthorize",
  reauthorizeDisabledHint:
    "Reauthorize is unavailable for Cafe24 Private apps (use \"Test Run\" in Cafe24 Developers) or for integrations expired via install_timeout (delete and re-register).",
  reauthorizeOpened: "Reauthorization window opened",
  integrationReset: "Integration reset",
  reauthorizeFailedToast: "Failed to start reauthorization",
  rotateSection: "Rotate credentials",
  rotateBtn: "Rotate",
  rotateHint: "Existing values are masked. Enter new values to replace; leave untouched fields blank.",
  credentialsRotated: "Credentials rotated",
  rotateFailedDefault: "Rotation failed",
  never: "Never",
  currentScopes: "Current scopes",
  noScopes: "No scopes recorded.",
  missingScopesDetected: "Missing scopes detected",
  requestScopesTitle: "Request additional scopes",
  requestScopesHint: "Selecting scopes already granted has no effect. Triggers a new OAuth flow.",
  alreadyGranted: "(already granted)",
  requestScopesBtn: "Request scopes",
  scopeRequestOpened: "Scope request window opened",
  requestScopesFailed: "Failed to request scopes",
  cafe24PrivateScopeRequestTitle:
    "Grant the additional scopes in Cafe24 Developers",
  cafe24PrivateScopeRequestDesc:
    "Enable the additional scopes in your Cafe24 Developers app permission settings, then click \"Test run\" again to refresh the token with the new scopes. (Private apps cannot initiate the OAuth flow externally, so the action must happen on Cafe24.)",
  cafe24PrivateScopeRequestScopesAdded: "Scopes added",
  noScopeOptionsAvailable: "No additional scopes are available for this service.",
  scopeOnlyOauth: "Scope management is only available for OAuth integrations.",
  usageEmpty: "No workflow nodes currently use this integration.",
  usageSummary: "Used by {{nodes}} nodes across {{workflows}} workflows.",
  activityEmpty: "No calls recorded in the last 7 days.",
  activitySummary: "Last 7 days: {{total}} calls · {{rate}}% success",
  activityWhen: "When",
  activityStatus: "Status",
  activityDuration: "Duration",
  activityError: "Error",
  scopeChangeTitle: "Change scope",
  scopeChangeHint: "Moving between Personal and Organization shares or un-shares the underlying credentials. Admin only.",
  scopeApply: "Apply",
  scopeChangeConfirm: "Existing credentials will be shared with all workspace members. Continue?",
  scopeUpdated: "Scope updated",
  scopeUpdateFailedDefault: "Failed to update scope",
  dangerDeleteTitle: "Delete integration",
  dangerDeleteHint: "Deletion is blocked if any workflow node references this integration.",
  dangerDeleteBtn: "Delete integration",
  confirmDeleteBtn: "Confirm delete",
  timeJustNow: "just now",
  timeMinutesAgo: "{{minutes}}m ago",
  timeHoursAgo: "{{hours}}h ago",
  timeDaysAgo: "{{days}}d ago",
  unknownService: "Unknown service type: {{type}}",
  stepCounter: "Step {{current}} of 2",
  connectWith: "Connect with {{name}}",
  nameRequired: "Integration name is required",
  selectAtLeastOneScope: "Select at least one scope",
  completeOauth: "Complete OAuth authorization before continuing",
  selectAuthType: "Select an authentication type",
  fieldRequired: "{{label}} is required",
  namePlaceholderWithService: "My {{name}}",
  scopeHint: "Organization scope requires Admin role.",
  authTypeLabel2: "Authentication Type",
  oauthScopesLabel: "OAuth Scopes",
  recommendedBadge: "Recommended",
  cafe24ScopeWarning:
    "Cafe24 only allows OAuth requests for scopes pre-registered on the app. Every scope you tick here must also be enabled at Cafe24 Developers → My App → Permissions (Scope) — if even one is missing, the OAuth call is rejected with invalid_scope. Start with a single scope and add more once it works.",
  cafe24PrivatePendingTitle: "Complete the Cafe24 Developers setup",
  cafe24PrivatePendingDesc:
    "Your integration has been created in pending state. Once you register the URLs below in Cafe24 Developers and complete Test Run, it will activate automatically.",
  cafe24AppUrlLabel: "App URL (register in Cafe24 Developers → Development Info)",
  cafe24CallbackUrlLabel: "Redirect URI (register in Cafe24 Developers → Development Info)",
  cafe24PrivatePendingSteps:
    "① In Cafe24 Developers → My App → Development Info, copy the full URLs above and paste them into App URL and Redirect URI (the App URL value includes the 22-char install_token at the end — paste the whole thing, don't trim). ② Confirm that Permissions (Scope) match the scopes you requested. ③ Click Test Run and enter your mall ID. After consent, the integration activates.",
  cafe24PrivatePendingViewList: "View integration details",
  cafe24PrivatePendingWaiting:
    "Waiting for Cafe24 Test Run to complete… (auto-refresh)",
  cafe24PrivatePendingTimedOut:
    "Still pending after 10 minutes. Reload this page to keep checking, or open the integration details.",
  cafe24PrivatePendingExpired:
    "Install timed out (24h). Delete this integration and register again to retry.",
  cafe24PrivatePendingTerminal:
    "This integration is no longer pending. Open the details for status and next steps.",
  cafe24PrivatePendingLastErrorLabel: "Last callback error",
  cafe24DetailAppUrlTitle: "Cafe24 App URL",
  cafe24DetailAppUrlDesc:
    "Register this URL as the App URL in Cafe24 Developers → My App → Development Info. Cafe24 admin's 'Open app' button and the Developers 'Test run' button both call this URL. If it doesn't match, HMAC verification fails and the call is rejected.",
  oauthPopupClosedNoResult:
    "OAuth popup closed without returning a result. Try again or reload this page.",
  copied: "Copied",
  waitingPopup: "Waiting for the provider popup…",
  oauthComplete: "OAuth authorization complete.",
  authorizePrompt: "Authorize this integration with the provider.",
  timesOutHint: "Times out after 5 minutes.",
  continueBtn: "Continue",
  backToAuth: "Back to auth",
  saveIntegration: "Save integration",
  testingCredentials: "Testing credentials...",
  validationFailed: "Validation failed",
  readyToSave: "Ready to save",
  runningProbe: "Running a preview test against the service registry.",
  checkAuthRetry: "Check the auth step and try again.",
  readyMessage: "{{service}} \"{{name}}\" credentials are ready. Connection will be verified on first use.",
  integrationCreatedToast: "Integration created",
  integrationCreateFailedDefault: "Failed to create integration",
  oauthStartFailed: "Failed to start OAuth",
  oauthContinueInPopup: "Continue in the popup. This window will update when you are done.",
  oauthTimedOutMessage: "OAuth timed out — popup did not return within 5 minutes.",
  oauthTimedOutShort: "Authorization timed out. Please try again.",
  oauthFailedShort: "OAuth failed",
  oauthCompletedToast: "OAuth completed. Continue to save.",
  reauthorizeBtn2: "Reauthorize",
  // ----- Cafe24 mall_id duplicate pre-detection (2026-05-16) -----
  cafe24DuplicateMallTitle: "This mall ID is already connected",
  cafe24DuplicateMallConnectedDesc:
    "A Cafe24 integration for the same mall_id is already active in this workspace. Use the existing integration or delete it first.",
  cafe24DuplicateMallPendingDesc:
    "A Cafe24 integration for the same mall_id is already pending installation. Finish the install on the existing integration, or delete it from integration details and re-register.",
  cafe24DuplicateMallExpiredDesc:
    "A Cafe24 integration for the same mall_id already exists but is expired. Delete the existing one before registering a new one.",
  cafe24DuplicateMallErrorDesc:
    "A Cafe24 integration for the same mall_id already exists in error state. Reauthorize from integration details, or delete it first.",
  cafe24DuplicateMallViewExisting: "Open existing integration",
  cafe24DuplicateMallToast:
    "This mall ID is already connected and cannot be added",
  cafe24DuplicateMallChecking: "Checking…",
  // ----- Cafe24 begin-time validation (frontend pre-check) -----
  cafe24ValidateMallIdPattern:
    "Mall ID must be 3–50 lowercase letters, digits, or hyphens.",
  cafe24ValidateAppType: "Cafe24 app type must be 'public' or 'private'.",
  cafe24ValidatePrivateClientIdRequired: "Private apps require client_id.",
  cafe24ValidatePrivateClientSecretRequired:
    "Private apps require client_secret.",
};

```

---

### 파일 7: frontend/src/lib/i18n/dict/ko/integrations.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/i18n/dict/ko/integrations.ts b/frontend/src/lib/i18n/dict/ko/integrations.ts
index 3f05e711..103e966c 100644
--- a/frontend/src/lib/i18n/dict/ko/integrations.ts
+++ b/frontend/src/lib/i18n/dict/ko/integrations.ts
@@ -213,4 +213,13 @@ export const integrations = {
   // 사후 toast 의 한글 primary 메시지. backend 영문 message 는 (괄호) 안에 보조 표시.
   cafe24DuplicateMallToast: "이 mall ID 는 이미 연결되어 있어 추가할 수 없어요",
   cafe24DuplicateMallChecking: "확인 중…",
+  // ----- Cafe24 begin-time validation (frontend 사전 검증) -----
+  // backend OAuth begin 의 mirror — 사용자가 popup 열기 전에 잡아준다.
+  cafe24ValidateMallIdPattern:
+    "Mall ID 는 3~50자의 영문 소문자·숫자·하이픈만 가능해요.",
+  cafe24ValidateAppType: "Cafe24 앱 유형은 public 또는 private 여야 해요.",
+  cafe24ValidatePrivateClientIdRequired:
+    "Private 앱은 client_id 가 필수예요.",
+  cafe24ValidatePrivateClientSecretRequired:
+    "Private 앱은 client_secret 이 필수예요.",
 } as const;

```

#### 전체 파일 컨텍스트
```
export const integrations = {
  title: "통합",
  description: "외부 서비스와 워크플로우를 연결할 수 있어요",
  new: "새 통합",
  marketplace: "마켓플레이스",
  connected: "연결됨",
  notConnected: "미연결",
  connect: "연결",
  disconnect: "연결 해제",
  configure: "설정",
  credentials: "자격 증명",
  scopes: "권한 범위",
  provider: "제공자",
  status: "상태",
  statusConnected: "연결됨",
  statusDisconnected: "연결 해제됨",
  statusExpired: "만료됨",
  reauthorize: "재인증",
  reauthorized: "재인증을 완료했어요",
  reauthorizeFailed: "재인증에 실패했어요",
  oauthCompleted: "OAuth 인증을 완료했어요",
  oauthFailed: "OAuth 인증에 실패했어요",
  created: "통합을 만들었어요",
  createFailed: "통합 생성에 실패했어요",
  updated: "통합을 수정했어요",
  updateFailed: "통합 수정에 실패했어요",
  deleted: "통합을 삭제했어요",
  deleteFailed: "통합 삭제에 실패했어요",
  deleteConfirm: "이 통합을 삭제할까요?",
  connectionTest: "연결 테스트",
  connectionTestSuccess: "연결 테스트에 성공했어요",
  connectionTestFailed: "연결 테스트에 실패했어요: {{error}}",
  deletedMcpLabel: "삭제된 MCP ({{idShort}}…)",
  loadFailed: "통합을 불러올 수 없어요",
  empty: "연결된 통합이 없어요",
  addIntegration: "통합 추가",
  searchPlaceholder: "통합 검색...",
  scopeAll: "전체",
  statusAll: "전체",
  scopePersonal: "개인",
  scopeOrganization: "조직",
  refreshAria: "새로고침",
  allServices: "모든 서비스",
  statusExpiring: "만료 임박",
  statusError: "오류",
  statusAttention: "주의 필요",
  attentionTitlePlural: "통합 {{count}}건이 주의가 필요해요",
  attentionTitleSingle: "통합 1건이 주의가 필요해요",
  attentionBreakdownExpired: "만료 {{count}}",
  attentionBreakdownExpiring: "만료 임박 {{count}}",
  attentionBreakdownError: "오류 {{count}}",
  attentionClickToFilter: "필터링하려면 클릭",
  attentionClickToOpen: "열려면 클릭",
  loadFailedHint: "통합을 불러올 수 없어요.",
  retry: "다시 시도",
  emptyTitle: "아직 통합이 없어요",
  emptyDescription: "외부 서비스를 연결해 워크플로우에서 사용하세요.",
  sectionOrg: "조직",
  sectionPersonal: "개인",
  paginationSummary: "{{page}} / {{totalPages}} 페이지 · 전체 {{totalItems}}",
  backToList: "통합 목록으로",
  notFound: "통합을 찾을 수 없어요.",
  inUseError: "사용 중인 통합이에요. Usage 탭에서 확인해 주세요.",
  tabOverview: "개요",
  tabSecurity: "보안",
  tabScope: "권한",
  tabUsage: "사용",
  tabActivity: "활동",
  tabDanger: "위험 영역",
  lastUsedRel: "최근 사용: {{relative}}",
  serviceLabel: "서비스",
  authTypeLabel: "인증 유형",
  nameLabel: "이름",
  saveBtn: "저장",
  cancelBtn: "취소",
  editBtn: "수정",
  createdAtLabel: "생성일",
  lastUsedLabel: "최근 사용",
  lastRotatedLabel: "최근 교체",
  tokenExpiresLabel: "토큰 만료",
  testConnectionBtn: "연결 테스트",
  nameUpdated: "이름을 변경했어요",
  nameUpdateFailed: "이름 변경에 실패했어요",
  connectionPassed: "연결 테스트에 성공했어요",
  connectionFailedMsg: "테스트 실패: {{error}}",
  testFailedToast: "연결 테스트에 실패했어요",
  authenticationSection: "인증",
  reauthorizeSection: "재인증",
  reauthorizeHint: "새 창에서 제공자에 로그인해 토큰을 갱신해요.",
  reauthorizeBtn: "재인증",
  reauthorizeDisabledHint:
    "재인증 불가 — Cafe24 Private 앱은 Cafe24 Developers 에서 '테스트 실행'을 다시 누르세요. install_timeout 으로 만료된 통합은 삭제 후 재등록이 필요해요.",
  reauthorizeOpened: "재인증 창을 열었어요",
  integrationReset: "통합을 초기화했어요",
  reauthorizeFailedToast: "재인증을 시작하지 못했어요",
  rotateSection: "자격 증명 교체",
  rotateBtn: "교체",
  rotateHint: "기존 값은 마스킹되어 있어요. 새 값으로 교체할 필드만 입력해 주세요.",
  credentialsRotated: "자격 증명을 교체했어요",
  rotateFailedDefault: "교체에 실패했어요",
  never: "없음",
  currentScopes: "현재 권한",
  noScopes: "기록된 권한이 없어요.",
  missingScopesDetected: "누락된 권한이 감지됐어요",
  requestScopesTitle: "추가 권한 요청",
  requestScopesHint: "이미 허용된 권한을 선택해도 변경되지 않아요. 새 OAuth 흐름이 시작돼요.",
  alreadyGranted: "(이미 허용됨)",
  requestScopesBtn: "권한 요청",
  scopeRequestOpened: "권한 요청 창을 열었어요",
  requestScopesFailed: "권한 요청에 실패했어요",
  cafe24PrivateScopeRequestTitle:
    "Cafe24 Developers 에서 권한을 추가해 주세요",
  cafe24PrivateScopeRequestDesc:
    "Cafe24 Developers 의 앱 권한 설정에서 추가 scope 를 활성화한 뒤 '테스트 실행' 을 다시 누르면 새 token 으로 갱신됩니다. (Private 앱은 외부에서 OAuth 화면을 띄울 수 없어 Cafe24 측 작업이 필요해요.)",
  cafe24PrivateScopeRequestScopesAdded: "추가된 권한",
  noScopeOptionsAvailable: "이 서비스에는 추가로 요청할 권한이 없어요.",
  scopeOnlyOauth: "권한 관리는 OAuth 통합에서만 사용할 수 있어요.",
  usageEmpty: "현재 이 통합을 사용 중인 워크플로우 노드가 없어요.",
  usageSummary: "{{workflows}}개 워크플로우의 {{nodes}}개 노드에서 사용 중이에요.",
  activityEmpty: "최근 7일간 호출 기록이 없어요.",
  activitySummary: "최근 7일: {{total}}회 호출 · 성공률 {{rate}}%",
  activityWhen: "시간",
  activityStatus: "상태",
  activityDuration: "소요",
  activityError: "오류",
  scopeChangeTitle: "공개 범위 변경",
  scopeChangeHint: "개인과 조직 사이를 이동하면 자격 증명의 공유 범위가 바뀝니다. 관리자만 변경할 수 있어요.",
  scopeApply: "적용",
  scopeChangeConfirm: "자격 증명이 워크스페이스 멤버 전체와 공유됩니다. 계속할까요?",
  scopeUpdated: "공개 범위를 변경했어요",
  scopeUpdateFailedDefault: "공개 범위 변경에 실패했어요",
  dangerDeleteTitle: "통합 삭제",
  dangerDeleteHint: "워크플로우 노드가 이 통합을 참조 중이면 삭제가 차단됩니다.",
  dangerDeleteBtn: "통합 삭제",
  confirmDeleteBtn: "삭제 확정",
  timeJustNow: "방금 전",
  timeMinutesAgo: "{{minutes}}분 전",
  timeHoursAgo: "{{hours}}시간 전",
  timeDaysAgo: "{{days}}일 전",
  unknownService: "알 수 없는 서비스 유형: {{type}}",
  stepCounter: "{{current}}/2단계",
  connectWith: "{{name}} 연결하기",
  nameRequired: "통합 이름을 입력해 주세요",
  selectAtLeastOneScope: "하나 이상의 권한을 선택해 주세요",
  completeOauth: "계속하기 전에 OAuth 인증을 완료해 주세요",
  selectAuthType: "인증 유형을 선택해 주세요",
  fieldRequired: "{{label}}은(는) 필수입니다",
  namePlaceholderWithService: "My {{name}}",
  scopeHint: "조직 범위로 설정하려면 관리자 권한이 필요해요.",
  authTypeLabel2: "인증 유형",
  oauthScopesLabel: "OAuth 권한",
  recommendedBadge: "권장",
  cafe24ScopeWarning:
    "Cafe24 는 앱 설정에 사전 등록된 권한만 OAuth 요청을 허용해요. 선택한 권한이 Cafe24 Developers → 내 앱 → 사용 권한(Scope) 에 모두 체크돼 있어야 하며, 하나라도 누락되면 OAuth 가 invalid_scope 로 거부돼요. 처음에는 1개만 켜고 동작을 확인한 뒤 점진적으로 늘리길 권해요.",
  cafe24PrivatePendingTitle: "Cafe24 Developers 설정을 완료해 주세요",
  cafe24PrivatePendingDesc:
    "통합이 연결 대기 상태로 생성됐어요. Cafe24 Developers 에서 아래 URL 을 등록하고 테스트 실행을 완료하면 자동으로 활성화돼요.",
  cafe24AppUrlLabel: "App URL (Cafe24 Developers → 개발 정보에 등록)",
  cafe24CallbackUrlLabel: "Redirect URI (Cafe24 Developers → 개발 정보에 등록)",
  cafe24PrivatePendingSteps:
    "① Cafe24 Developers → 내 앱 → 개발 정보에서 App URL 과 Redirect URI 를 위 값으로 전체 복사해서 등록하세요 (App URL 은 끝의 22자 토큰까지 모두 포함). ② 사용 권한(Scope) 이 요청한 scope 와 일치하는지 확인하세요. ③ 테스트 실행 버튼을 클릭하고 mall_id 를 입력하세요. 동의 후 통합이 활성화됩니다.",
  cafe24PrivatePendingViewList: "통합 상세 보기",
  cafe24PrivatePendingWaiting:
    "Cafe24 테스트 실행 완료를 기다리는 중… (자동 새로고침)",
  cafe24PrivatePendingTimedOut:
    "10분이 지나도 활성화되지 않았어요. 페이지를 새로고침해 다시 확인하거나 통합 상세를 여세요.",
  cafe24PrivatePendingExpired:
    "Install 이 24시간 안에 완료되지 않아 만료됐어요. 통합을 삭제하고 다시 등록해 주세요.",
  cafe24PrivatePendingTerminal:
    "이 통합은 더 이상 대기 상태가 아니에요. 상세 페이지에서 상태와 다음 단계를 확인하세요.",
  cafe24PrivatePendingLastErrorLabel: "마지막 콜백 오류",
  cafe24DetailAppUrlTitle: "Cafe24 App URL",
  cafe24DetailAppUrlDesc:
    "Cafe24 Developers → 내 앱 → 개발 정보의 '앱 URL' 에 이 값을 등록하세요. 카페24 admin 의 '앱으로 가기' / Cafe24 Developers 의 '테스트 실행' 모두 이 URL 을 호출합니다. URL 이 일치하지 않으면 HMAC 검증이 실패해 호출이 거부됩니다.",
  oauthPopupClosedNoResult:
    "OAuth 팝업이 결과 없이 닫혔어요. 다시 시도하거나 페이지를 새로고침 해주세요.",
  copied: "복사됨",
  waitingPopup: "제공자 팝업 응답을 기다리는 중…",
  oauthComplete: "OAuth 인증이 완료됐어요.",
  authorizePrompt: "제공자에서 이 통합을 승인해 주세요.",
  timesOutHint: "5분 후 자동으로 취소돼요.",
  continueBtn: "계속하기",
  backToAuth: "인증으로 돌아가기",
  saveIntegration: "통합 저장",
  testingCredentials: "자격 증명을 테스트 중이에요...",
  validationFailed: "유효성 검사에 실패했어요",
  readyToSave: "저장 준비 완료",
  runningProbe: "서비스 레지스트리에 대한 프리뷰 테스트를 실행하고 있어요.",
  checkAuthRetry: "인증 단계를 확인한 뒤 다시 시도해 주세요.",
  readyMessage: "{{service}} '{{name}}' 자격 증명이 준비됐어요. 첫 사용 시 연결이 검증돼요.",
  integrationCreatedToast: "통합을 만들었어요",
  integrationCreateFailedDefault: "통합 생성에 실패했어요",
  oauthStartFailed: "OAuth 시작에 실패했어요",
  oauthContinueInPopup: "팝업에서 계속 진행해 주세요. 완료되면 이 창이 업데이트돼요.",
  oauthTimedOutMessage: "5분 내에 팝업이 응답하지 않아 OAuth가 취소됐어요.",
  oauthTimedOutShort: "인증 시간이 초과됐어요. 다시 시도해 주세요.",
  oauthFailedShort: "OAuth에 실패했어요",
  oauthCompletedToast: "OAuth가 완료됐어요. 저장을 계속해 주세요.",
  reauthorizeBtn2: "재인증",
  // ----- Cafe24 mall_id 중복 사전 감지 (2026-05-16) -----
  // mall_id 입력 시점에 precheck endpoint 호출 → conflict 발견 시 inline
  // 경고 배너 + Connect 버튼 disable. spec/2-navigation/4-integration.md §9.2.
  cafe24DuplicateMallTitle: "이 mall ID 는 이미 연결되어 있어요",
  cafe24DuplicateMallConnectedDesc:
    "같은 워크스페이스에 같은 mall_id 의 Cafe24 통합이 이미 활성 상태로 연결돼 있어요. 기존 통합을 사용하거나 삭제한 뒤 다시 등록해 주세요.",
  cafe24DuplicateMallPendingDesc:
    "같은 mall_id 의 Cafe24 통합이 이미 설치 대기 중이에요. 기존 통합을 사용해 install 을 마치거나, 통합 상세에서 삭제한 뒤 다시 등록해 주세요.",
  cafe24DuplicateMallExpiredDesc:
    "같은 mall_id 의 Cafe24 통합이 이미 만료 상태로 존재해요. 새 통합을 등록하려면 먼저 기존 통합을 삭제해 주세요.",
  cafe24DuplicateMallErrorDesc:
    "같은 mall_id 의 Cafe24 통합이 이미 오류 상태로 존재해요. 통합 상세에서 재인증을 시도하거나 삭제한 뒤 다시 등록해 주세요.",
  cafe24DuplicateMallViewExisting: "기존 통합 열기",
  // 사후 toast 의 한글 primary 메시지. backend 영문 message 는 (괄호) 안에 보조 표시.
  cafe24DuplicateMallToast: "이 mall ID 는 이미 연결되어 있어 추가할 수 없어요",
  cafe24DuplicateMallChecking: "확인 중…",
  // ----- Cafe24 begin-time validation (frontend 사전 검증) -----
  // backend OAuth begin 의 mirror — 사용자가 popup 열기 전에 잡아준다.
  cafe24ValidateMallIdPattern:
    "Mall ID 는 3~50자의 영문 소문자·숫자·하이픈만 가능해요.",
  cafe24ValidateAppType: "Cafe24 앱 유형은 public 또는 private 여야 해요.",
  cafe24ValidatePrivateClientIdRequired:
    "Private 앱은 client_id 가 필수예요.",
  cafe24ValidatePrivateClientSecretRequired:
    "Private 앱은 client_secret 이 필수예요.",
} as const;

```

---

### 파일 8: frontend/src/lib/integrations/__tests__/use-cafe24-mall-id-precheck.test.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/lib/integrations/__tests__/use-cafe24-mall-id-precheck.test.tsx b/frontend/src/lib/integrations/__tests__/use-cafe24-mall-id-precheck.test.tsx
new file mode 100644
index 00000000..d04b738f
--- /dev/null
+++ b/frontend/src/lib/integrations/__tests__/use-cafe24-mall-id-precheck.test.tsx
@@ -0,0 +1,134 @@
+/**
+ * `useCafe24MallIdPrecheck` 단위 테스트 — page.tsx 통합 테스트가 hook 의
+ * 사용자 흐름을 검증하나, 본 spec 은 hook 자체의 입력/출력 계약을 격리
+ * 검증한다. (ai-review W9 — 2026-05-16)
+ */
+import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
+import { renderHook, waitFor, act } from "@testing-library/react";
+
+const precheckMock = vi.fn();
+vi.mock("@/lib/api/integrations", () => ({
+  integrationsApi: {
+    cafe24Precheck: (...args: unknown[]) => precheckMock(...args),
+  },
+}));
+
+import { useCafe24MallIdPrecheck } from "../use-cafe24-mall-id-precheck";
+
+describe("useCafe24MallIdPrecheck", () => {
+  beforeEach(() => {
+    // resetAllMocks 는 implementation 까지 클리어 — mockResolvedValueOnce
+    // queue 가 테스트 간 leak 되는 것을 막는다.
+    vi.resetAllMocks();
+    vi.useFakeTimers({ shouldAdvanceTime: true });
+    precheckMock.mockResolvedValue({ conflict: false });
+  });
+
+  afterEach(() => {
+    vi.useRealTimers();
+  });
+
+  it("enabled=false 면 fetch 호출 없이 conflict null, loading false", () => {
+    const { result } = renderHook(() =>
+      useCafe24MallIdPrecheck("myshop", false),
+    );
+    expect(result.current.conflict).toBeNull();
+    expect(result.current.loading).toBe(false);
+    expect(precheckMock).not.toHaveBeenCalled();
+  });
+
+  it("패턴 위반 mall_id 는 fetch skip + loading false 유지", () => {
+    const { result } = renderHook(() => useCafe24MallIdPrecheck("AB", true));
+    expect(precheckMock).not.toHaveBeenCalled();
+    expect(result.current.loading).toBe(false);
+  });
+
+  it("유효 mall_id + enabled 면 350ms debounce 후 fetch + 결과 반영", async () => {
+    precheckMock.mockResolvedValueOnce({
+      conflict: true,
+      existingIntegrationId: "int-1",
+      existingName: "myshop (Cafe24)",
+      status: "connected",
+    });
+    const { result } = renderHook(() =>
+      useCafe24MallIdPrecheck("myshop", true),
+    );
+    // debounce 진입 직후엔 loading=true, conflict 미반영
+    expect(result.current.loading).toBe(true);
+    expect(result.current.conflict).toBeNull();
+    await act(async () => {
+      vi.advanceTimersByTime(360);
+    });
+    await waitFor(() => {
+      expect(result.current.conflict).toEqual({
+        conflict: true,
+        existingIntegrationId: "int-1",
+        existingName: "myshop (Cafe24)",
+        status: "connected",
+      });
+      expect(result.current.loading).toBe(false);
+    });
+    // 두 번째 인자는 AbortSignal
+    expect(precheckMock).toHaveBeenCalledWith("myshop", expect.any(AbortSignal));
+  });
+
+  it("mallId 변경 시 직전 in-flight fetch 가 abort", async () => {
+    let firstSignal: AbortSignal | undefined;
+    precheckMock.mockImplementationOnce(
+      (_id: string, signal: AbortSignal) => {
+        firstSignal = signal;
+        return new Promise(() => {}); // resolve 안 됨
+      },
+    );
+    precheckMock.mockResolvedValueOnce({ conflict: false });
+
+    const { rerender } = renderHook(
+      ({ mallId, enabled }) => useCafe24MallIdPrecheck(mallId, enabled),
+      { initialProps: { mallId: "shop-a", enabled: true } },
+    );
+    await act(async () => {
+      vi.advanceTimersByTime(360);
+    });
+    await waitFor(() => expect(precheckMock).toHaveBeenCalledTimes(1));
+    expect(firstSignal?.aborted).toBe(false);
+
+    // mallId 변경 → effect cleanup → abort
+    rerender({ mallId: "shop-b", enabled: true });
+    expect(firstSignal?.aborted).toBe(true);
+  });
+
+  it("enabled=false 로 전환 시 conflict/loading 즉시 클리어", async () => {
+    precheckMock.mockResolvedValueOnce({
+      conflict: true,
+      existingIntegrationId: "int-1",
+      existingName: "x",
+      status: "connected",
+    });
+    const { result, rerender } = renderHook(
+      ({ mallId, enabled }) => useCafe24MallIdPrecheck(mallId, enabled),
+      { initialProps: { mallId: "myshop", enabled: true } },
+    );
+    await act(async () => {
+      vi.advanceTimersByTime(360);
+    });
+    await waitFor(() => expect(result.current.conflict).not.toBeNull());
+
+    rerender({ mallId: "myshop", enabled: false });
+    expect(result.current.conflict).toBeNull();
+    expect(result.current.loading).toBe(false);
+  });
+
+  it("fetch 실패 시 silent — conflict null, loading false", async () => {
+    precheckMock.mockRejectedValueOnce(new Error("network"));
+    const { result } = renderHook(() =>
+      useCafe24MallIdPrecheck("myshop", true),
+    );
+    await act(async () => {
+      vi.advanceTimersByTime(360);
+    });
+    await waitFor(() => {
+      expect(result.current.loading).toBe(false);
+    });
+    expect(result.current.conflict).toBeNull();
+  });
+});

```

#### 전체 파일 컨텍스트
```
/**
 * `useCafe24MallIdPrecheck` 단위 테스트 — page.tsx 통합 테스트가 hook 의
 * 사용자 흐름을 검증하나, 본 spec 은 hook 자체의 입력/출력 계약을 격리
 * 검증한다. (ai-review W9 — 2026-05-16)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const precheckMock = vi.fn();
vi.mock("@/lib/api/integrations", () => ({
  integrationsApi: {
    cafe24Precheck: (...args: unknown[]) => precheckMock(...args),
  },
}));

import { useCafe24MallIdPrecheck } from "../use-cafe24-mall-id-precheck";

describe("useCafe24MallIdPrecheck", () => {
  beforeEach(() => {
    // resetAllMocks 는 implementation 까지 클리어 — mockResolvedValueOnce
    // queue 가 테스트 간 leak 되는 것을 막는다.
    vi.resetAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    precheckMock.mockResolvedValue({ conflict: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("enabled=false 면 fetch 호출 없이 conflict null, loading false", () => {
    const { result } = renderHook(() =>
      useCafe24MallIdPrecheck("myshop", false),
    );
    expect(result.current.conflict).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(precheckMock).not.toHaveBeenCalled();
  });

  it("패턴 위반 mall_id 는 fetch skip + loading false 유지", () => {
    const { result } = renderHook(() => useCafe24MallIdPrecheck("AB", true));
    expect(precheckMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("유효 mall_id + enabled 면 350ms debounce 후 fetch + 결과 반영", async () => {
    precheckMock.mockResolvedValueOnce({
      conflict: true,
      existingIntegrationId: "int-1",
      existingName: "myshop (Cafe24)",
      status: "connected",
    });
    const { result } = renderHook(() =>
      useCafe24MallIdPrecheck("myshop", true),
    );
    // debounce 진입 직후엔 loading=true, conflict 미반영
    expect(result.current.loading).toBe(true);
    expect(result.current.conflict).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
    await waitFor(() => {
      expect(result.current.conflict).toEqual({
        conflict: true,
        existingIntegrationId: "int-1",
        existingName: "myshop (Cafe24)",
        status: "connected",
      });
      expect(result.current.loading).toBe(false);
    });
    // 두 번째 인자는 AbortSignal
    expect(precheckMock).toHaveBeenCalledWith("myshop", expect.any(AbortSignal));
  });

  it("mallId 변경 시 직전 in-flight fetch 가 abort", async () => {
    let firstSignal: AbortSignal | undefined;
    precheckMock.mockImplementationOnce(
      (_id: string, signal: AbortSignal) => {
        firstSignal = signal;
        return new Promise(() => {}); // resolve 안 됨
      },
    );
    precheckMock.mockResolvedValueOnce({ conflict: false });

    const { rerender } = renderHook(
      ({ mallId, enabled }) => useCafe24MallIdPrecheck(mallId, enabled),
      { initialProps: { mallId: "shop-a", enabled: true } },
    );
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
    await waitFor(() => expect(precheckMock).toHaveBeenCalledTimes(1));
    expect(firstSignal?.aborted).toBe(false);

    // mallId 변경 → effect cleanup → abort
    rerender({ mallId: "shop-b", enabled: true });
    expect(firstSignal?.aborted).toBe(true);
  });

  it("enabled=false 로 전환 시 conflict/loading 즉시 클리어", async () => {
    precheckMock.mockResolvedValueOnce({
      conflict: true,
      existingIntegrationId: "int-1",
      existingName: "x",
      status: "connected",
    });
    const { result, rerender } = renderHook(
      ({ mallId, enabled }) => useCafe24MallIdPrecheck(mallId, enabled),
      { initialProps: { mallId: "myshop", enabled: true } },
    );
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
    await waitFor(() => expect(result.current.conflict).not.toBeNull());

    rerender({ mallId: "myshop", enabled: false });
    expect(result.current.conflict).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("fetch 실패 시 silent — conflict null, loading false", async () => {
    precheckMock.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() =>
      useCafe24MallIdPrecheck("myshop", true),
    );
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.conflict).toBeNull();
  });
});

```

---

### 파일 9: frontend/src/lib/integrations/use-cafe24-mall-id-precheck.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/integrations/use-cafe24-mall-id-precheck.ts b/frontend/src/lib/integrations/use-cafe24-mall-id-precheck.ts
new file mode 100644
index 00000000..16beda43
--- /dev/null
+++ b/frontend/src/lib/integrations/use-cafe24-mall-id-precheck.ts
@@ -0,0 +1,75 @@
+import { useEffect, useState } from "react";
+import {
+  integrationsApi,
+  type Cafe24PrecheckResult,
+} from "@/lib/api/integrations";
+
+/**
+ * Mall ID 입력 단계의 사전 중복 감지 훅.
+ *
+ * `mall_id` 가 변경되면 350ms debounce 후 `GET /api/integrations/cafe24/precheck`
+ * 를 호출해 동일 mall_id 의 cafe24 통합 존재 여부를 미리 확인한다. 결과는
+ * inline 경고 배너 + Connect 버튼 disabled 의 입력이 된다.
+ *
+ * 동작 보장:
+ * - `enabled=false` 또는 mall_id 패턴 위반 시 상태를 즉시 클리어 (영구 spinner
+ *   잔존 방지).
+ * - `mallId` 가 바뀌면 직전 in-flight fetch 를 `AbortController.abort()` 로
+ *   취소 — backend throttle 카운터·서버 부하 절약 (ai-review INFO 6).
+ * - 응답 실패는 silent fail (`backend 가드가 backstop`).
+ *
+ * `useCafe24MallIdPrecheck` 는 page.tsx 의 응집도 향상을 위해 ai-review W9
+ * (2026-05-16) 에서 분리. spec/2-navigation/4-integration.md §9.2.
+ */
+
+const CAFE24_MALL_ID_PATTERN = /^[a-z0-9-]{3,50}$/;
+const PRECHECK_DEBOUNCE_MS = 350;
+
+export interface UseCafe24MallIdPrecheckResult {
+  /** 충돌 결과 — null 이면 미감지 / 로딩 중 / enabled=false */
+  conflict: Cafe24PrecheckResult | null;
+  /** 350ms debounce 후 backend fetch 진행 중 여부 */
+  loading: boolean;
+}
+
+export function useCafe24MallIdPrecheck(
+  mallId: string,
+  enabled: boolean,
+): UseCafe24MallIdPrecheckResult {
+  const [conflict, setConflict] = useState<Cafe24PrecheckResult | null>(null);
+  const [loading, setLoading] = useState(false);
+
+  useEffect(() => {
+    if (!enabled) {
+      setConflict(null);
+      setLoading(false);
+      return;
+    }
+    if (!CAFE24_MALL_ID_PATTERN.test(mallId)) {
+      setConflict(null);
+      setLoading(false);
+      return;
+    }
+    const controller = new AbortController();
+    const { signal } = controller;
+    setLoading(true);
+    const t = setTimeout(async () => {
+      try {
+        const result = await integrationsApi.cafe24Precheck(mallId, signal);
+        if (!signal.aborted) setConflict(result);
+      } catch {
+        // AbortError 는 정상 cancel — silent (signal.aborted=true 분기).
+        // 그 외 오류도 backend 가드가 backstop 이므로 inline 배너 없이 안전.
+        if (!signal.aborted) setConflict(null);
+      } finally {
+        if (!signal.aborted) setLoading(false);
+      }
+    }, PRECHECK_DEBOUNCE_MS);
+    return () => {
+      clearTimeout(t);
+      controller.abort();
+    };
+  }, [enabled, mallId]);
+
+  return { conflict, loading };
+}

```

#### 전체 파일 컨텍스트
```
import { useEffect, useState } from "react";
import {
  integrationsApi,
  type Cafe24PrecheckResult,
} from "@/lib/api/integrations";

/**
 * Mall ID 입력 단계의 사전 중복 감지 훅.
 *
 * `mall_id` 가 변경되면 350ms debounce 후 `GET /api/integrations/cafe24/precheck`
 * 를 호출해 동일 mall_id 의 cafe24 통합 존재 여부를 미리 확인한다. 결과는
 * inline 경고 배너 + Connect 버튼 disabled 의 입력이 된다.
 *
 * 동작 보장:
 * - `enabled=false` 또는 mall_id 패턴 위반 시 상태를 즉시 클리어 (영구 spinner
 *   잔존 방지).
 * - `mallId` 가 바뀌면 직전 in-flight fetch 를 `AbortController.abort()` 로
 *   취소 — backend throttle 카운터·서버 부하 절약 (ai-review INFO 6).
 * - 응답 실패는 silent fail (`backend 가드가 backstop`).
 *
 * `useCafe24MallIdPrecheck` 는 page.tsx 의 응집도 향상을 위해 ai-review W9
 * (2026-05-16) 에서 분리. spec/2-navigation/4-integration.md §9.2.
 */

const CAFE24_MALL_ID_PATTERN = /^[a-z0-9-]{3,50}$/;
const PRECHECK_DEBOUNCE_MS = 350;

export interface UseCafe24MallIdPrecheckResult {
  /** 충돌 결과 — null 이면 미감지 / 로딩 중 / enabled=false */
  conflict: Cafe24PrecheckResult | null;
  /** 350ms debounce 후 backend fetch 진행 중 여부 */
  loading: boolean;
}

export function useCafe24MallIdPrecheck(
  mallId: string,
  enabled: boolean,
): UseCafe24MallIdPrecheckResult {
  const [conflict, setConflict] = useState<Cafe24PrecheckResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setConflict(null);
      setLoading(false);
      return;
    }
    if (!CAFE24_MALL_ID_PATTERN.test(mallId)) {
      setConflict(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const result = await integrationsApi.cafe24Precheck(mallId, signal);
        if (!signal.aborted) setConflict(result);
      } catch {
        // AbortError 는 정상 cancel — silent (signal.aborted=true 분기).
        // 그 외 오류도 backend 가드가 backstop 이므로 inline 배너 없이 안전.
        if (!signal.aborted) setConflict(null);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }, PRECHECK_DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [enabled, mallId]);

  return { conflict, loading };
}

```

---

### 파일 10: plan/in-progress/cafe24-mall-dup-followup-b.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/cafe24-mall-dup-followup-b.md b/plan/in-progress/cafe24-mall-dup-followup-b.md
new file mode 100644
index 00000000..51740468
--- /dev/null
+++ b/plan/in-progress/cafe24-mall-dup-followup-b.md
@@ -0,0 +1,49 @@
+---
+worktree: cafe24-mall-dup-followup-b-4d8e2a
+started: 2026-05-16
+owner: developer
+---
+
+# Cafe24 mall-dup-ux follow-up B — frontend 리팩토링 묶음
+
+PR #112 (follow-up A) 의 후속. ai-review RESOLUTION 의 remaining deferred 항목 중
+frontend 영역에 응집된 5건을 하나의 PR 로 묶어 처리.
+
+큰 작업 (W19 status 유니온 중앙화, INFO 7 requestScopes 전략 패턴) 은 별도 worktree.
+
+## 대상 항목
+
+- **W9** — `useCafe24MallIdPrecheck(mallIdInput, enabled)` 커스텀 훅 추출.
+  현재 `page.tsx` 가 debounce + AbortController + state 3가지를 직접 보유.
+  훅으로 분리해 page.tsx 응집도 향상.
+- **W11** — `formatErrorToast` 의 에러 코드 분기 → 도메인 상수 + 매핑.
+  현재 컴포넌트 레벨에서 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 를 하드코딩.
+  공유 위치에 `CAFE24_DUPLICATE_ERROR_CODE` 상수 + i18n 키 매핑.
+- **INFO 10** — `IntegrationsService.create` 의 `save()` 성공 + `auditLogsService.record()`
+  실패 시나리오 단위 테스트 추가. 트랜잭션 미적용 결정의 회귀 안전망.
+- **INFO 12** — `cafe24-precheck.test.tsx` 의 `vi.advanceTimersByTime(360)`
+  반복을 `DEBOUNCE_ADVANCE_MS = 360` 상수 + 헬퍼로 통일.
+- **INFO 13** — `validate()` 의 Cafe24 검증 메시지 4건 (Mall ID 패턴, app type,
+  client_id, client_secret) 을 i18n 키로 추출.
+
+## 범위 외
+
+- W19 status 유니온 중앙화 — shared package 신설 검토 필요, 큰 작업
+- INFO 7 requestScopes Cafe24 분기 → OAuthService 위임 — 전략 패턴 도입
+- INFO 14 error code rename — 사용자 호환성 유지 지시로 기각
+
+## consistency-check 생략 사유
+
+- spec 변경 없음. 모두 frontend 내부 리팩토링 + backend 의 audit fail 테스트 추가.
+- W9/W11 은 ai-review (PR #107 RESOLUTION) 가 이미 사전 approval.
+
+## 진행 상태
+
+- [x] W9 useCafe24MallIdPrecheck 훅 추출 — `frontend/src/lib/integrations/use-cafe24-mall-id-precheck.ts` + 6 단위 테스트
+- [x] W11 formatErrorToast 도메인 상수 분리 — `lib/api/integration-error-codes.ts` 신설, `getIntegrationErrorI18nKey()` 헬퍼
+- [x] INFO 10 save+audit fail 테스트 — 실제 결함 발견 (audit 실패 시 user 500) → `create()` 에 별도 try/catch 추가, 회귀 테스트
+- [x] INFO 12 debounce 상수 — `DEBOUNCE_ADVANCE_MS` + `advanceDebounce()` 헬퍼, 11회 패턴 통일
+- [x] INFO 13 validate() i18n — 4개 메시지 ko/en parity
+- [x] TEST WORKFLOW — backend 3734 / frontend 1431 / build / e2e 79
+- [ ] AI-REVIEW
+- [ ] PR

```

#### 전체 파일 컨텍스트
```
---
worktree: cafe24-mall-dup-followup-b-4d8e2a
started: 2026-05-16
owner: developer
---

# Cafe24 mall-dup-ux follow-up B — frontend 리팩토링 묶음

PR #112 (follow-up A) 의 후속. ai-review RESOLUTION 의 remaining deferred 항목 중
frontend 영역에 응집된 5건을 하나의 PR 로 묶어 처리.

큰 작업 (W19 status 유니온 중앙화, INFO 7 requestScopes 전략 패턴) 은 별도 worktree.

## 대상 항목

- **W9** — `useCafe24MallIdPrecheck(mallIdInput, enabled)` 커스텀 훅 추출.
  현재 `page.tsx` 가 debounce + AbortController + state 3가지를 직접 보유.
  훅으로 분리해 page.tsx 응집도 향상.
- **W11** — `formatErrorToast` 의 에러 코드 분기 → 도메인 상수 + 매핑.
  현재 컴포넌트 레벨에서 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 를 하드코딩.
  공유 위치에 `CAFE24_DUPLICATE_ERROR_CODE` 상수 + i18n 키 매핑.
- **INFO 10** — `IntegrationsService.create` 의 `save()` 성공 + `auditLogsService.record()`
  실패 시나리오 단위 테스트 추가. 트랜잭션 미적용 결정의 회귀 안전망.
- **INFO 12** — `cafe24-precheck.test.tsx` 의 `vi.advanceTimersByTime(360)`
  반복을 `DEBOUNCE_ADVANCE_MS = 360` 상수 + 헬퍼로 통일.
- **INFO 13** — `validate()` 의 Cafe24 검증 메시지 4건 (Mall ID 패턴, app type,
  client_id, client_secret) 을 i18n 키로 추출.

## 범위 외

- W19 status 유니온 중앙화 — shared package 신설 검토 필요, 큰 작업
- INFO 7 requestScopes Cafe24 분기 → OAuthService 위임 — 전략 패턴 도입
- INFO 14 error code rename — 사용자 호환성 유지 지시로 기각

## consistency-check 생략 사유

- spec 변경 없음. 모두 frontend 내부 리팩토링 + backend 의 audit fail 테스트 추가.
- W9/W11 은 ai-review (PR #107 RESOLUTION) 가 이미 사전 approval.

## 진행 상태

- [x] W9 useCafe24MallIdPrecheck 훅 추출 — `frontend/src/lib/integrations/use-cafe24-mall-id-precheck.ts` + 6 단위 테스트
- [x] W11 formatErrorToast 도메인 상수 분리 — `lib/api/integration-error-codes.ts` 신설, `getIntegrationErrorI18nKey()` 헬퍼
- [x] INFO 10 save+audit fail 테스트 — 실제 결함 발견 (audit 실패 시 user 500) → `create()` 에 별도 try/catch 추가, 회귀 테스트
- [x] INFO 12 debounce 상수 — `DEBOUNCE_ADVANCE_MS` + `advanceDebounce()` 헬퍼, 11회 패턴 통일
- [x] INFO 13 validate() i18n — 4개 메시지 ko/en parity
- [x] TEST WORKFLOW — backend 3734 / frontend 1431 / build / e2e 79
- [ ] AI-REVIEW
- [ ] PR

```
