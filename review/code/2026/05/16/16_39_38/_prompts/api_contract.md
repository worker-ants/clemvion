# API 계약(API Contract) Review Payload

본 파일은 orchestrator 가 API 계약(API Contract) reviewer 용으로 작성한 입력입니다. 다음 코드 변경을 API 계약 관점에서 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

> 변경 코드가 본 reviewer 의 영역과 무관하면 "해당 없음" 으로 응답하고
> 위험도를 NONE 으로 설정해 `STATUS=success ISSUES=0` 으로 반환합니다.

## 점검 관점 (API 계약(API Contract))

1. **하위 호환성**: 기존 API 클라이언트 영향, breaking change 여부
2. **버전 관리**: API 버전이 적절히 관리되는지
3. **응답 형식**: API 응답 구조의 일관성·스키마 준수
4. **에러 응답**: 에러 응답 형식 일관성·HTTP 상태 코드 적절성
5. **요청 검증**: 요청 매개변수·바디 유효성 검증 충분성
6. **URL/경로 설계**: RESTful 원칙·일관된 네이밍
7. **페이지네이션**: 목록 API 의 페이지네이션 적절성
8. **인증/인가**: 엔드포인트의 인증/인가 적용

## 리뷰 대상 파일

### 파일 1: backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts b/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts
index 18015e9f..51270819 100644
--- a/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts
+++ b/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts
@@ -52,6 +52,60 @@ function makeRepo(): Record<string, Mock> {
   };
 }
 
+/**
+ * Cafe24 Integration row 의 in-memory mock 객체 factory.
+ *
+ * 기존 spec 파일 곳곳에 흩어져 있던 인라인 mock object 의 반복 선언을 통일.
+ * V045 plain mall_id 와 JSONB `credentials.mall_id` 가 다른 legacy 케이스도
+ * 지원 — `credentialsMallId` override 로 명시. ai-review W20 (2026-05-16) 조치.
+ */
+function buildFakeCafe24Integration(
+  overrides: Partial<{
+    id: string;
+    name: string;
+    status: string;
+    /** plain `mall_id` 컬럼. null 이면 V045 이전 legacy row */
+    mallId: string | null;
+    appType: 'public' | 'private';
+    /** credentials.mall_id (legacy 케이스에서 plain mallId 와 다를 수 있음) */
+    credentialsMallId: string;
+    clientId: string;
+    clientSecret: string;
+    scopes: string[];
+    installToken: string | null;
+    installTokenIssuedAt: Date | null;
+    statusReason: string | null;
+    lastError: unknown;
+  }> = {},
+): Record<string, unknown> {
+  const mallId =
+    overrides.mallId === undefined ? 'priv-shop' : overrides.mallId;
+  const credentialsMallId =
+    overrides.credentialsMallId ?? mallId ?? 'priv-shop';
+  const appType = overrides.appType ?? 'private';
+  const credentials: Record<string, unknown> = {
+    mall_id: credentialsMallId,
+    app_type: appType,
+  };
+  if (overrides.clientId !== undefined)
+    credentials.client_id = overrides.clientId;
+  if (overrides.clientSecret !== undefined)
+    credentials.client_secret = overrides.clientSecret;
+  if (overrides.scopes !== undefined) credentials.scopes = overrides.scopes;
+  return {
+    id: overrides.id ?? 'fake-integration-1',
+    name: overrides.name ?? `${credentialsMallId} (Cafe24)`,
+    status: overrides.status ?? 'connected',
+    serviceType: 'cafe24',
+    mallId,
+    installToken: overrides.installToken,
+    installTokenIssuedAt: overrides.installTokenIssuedAt,
+    statusReason: overrides.statusReason ?? null,
+    lastError: overrides.lastError ?? null,
+    credentials,
+  };
+}
+
 describe('IntegrationOAuthService — Cafe24', () => {
   let service: IntegrationOAuthService;
   let integrationRepo: Record<string, Mock>;
@@ -311,13 +365,10 @@ describe('IntegrationOAuthService — Cafe24', () => {
 
     it('rejects with 409 when a connected private integration exists for the same mall_id', async () => {
       integrationRepo.find = jest.fn().mockResolvedValue([
-        {
+        buildFakeCafe24Integration({
           id: 'existing-connected',
-          workspaceId: 'ws-1',
           status: 'connected',
-          serviceType: 'cafe24',
-          credentials: { mall_id: 'priv-shop', app_type: 'private' },
-        },
+        }),
       ]);
       const error = await service
         .begin(privateBeginParams())
@@ -490,12 +541,11 @@ describe('IntegrationOAuthService — Cafe24', () => {
     // public 이든 private 이든 모두 ConflictException.
     it('rejects when same mall_id is already connected as public (spec §9.2 — app_type 무관)', async () => {
       integrationRepo.find = jest.fn().mockResolvedValue([
-        {
+        buildFakeCafe24Integration({
           id: 'public-row',
           status: 'connected',
-          mallId: 'priv-shop',
-          credentials: { mall_id: 'priv-shop', app_type: 'public' },
-        },
+          appType: 'public',
+        }),
       ]);
 
       await expect(service.begin(privateBeginParams())).rejects.toMatchObject({
@@ -527,14 +577,12 @@ describe('IntegrationOAuthService — Cafe24', () => {
 
     it('rejects with 409 when a connected public integration exists for the same mall_id', async () => {
       integrationRepo.find = jest.fn().mockResolvedValue([
-        {
+        buildFakeCafe24Integration({
           id: 'existing-public-connected',
-          workspaceId: 'ws-1',
           status: 'connected',
-          serviceType: 'cafe24',
           mallId: 'pub-shop',
-          credentials: { mall_id: 'pub-shop', app_type: 'public' },
-        },
+          appType: 'public',
+        }),
       ]);
 
       const error = await service
@@ -548,14 +596,12 @@ describe('IntegrationOAuthService — Cafe24', () => {
 
     it('rejects with 409 when a connected private integration exists for the same mall_id (app_type 무관)', async () => {
       integrationRepo.find = jest.fn().mockResolvedValue([
-        {
+        buildFakeCafe24Integration({
           id: 'existing-private-connected',
-          workspaceId: 'ws-1',
           status: 'connected',
-          serviceType: 'cafe24',
           mallId: 'pub-shop',
-          credentials: { mall_id: 'pub-shop', app_type: 'private' },
-        },
+          appType: 'private',
+        }),
       ]);
 
       const error = await service
@@ -568,13 +614,12 @@ describe('IntegrationOAuthService — Cafe24', () => {
 
     it('proceeds when only non-connected rows exist (pending/expired/error — V045 backstop handles finalize)', async () => {
       integrationRepo.find = jest.fn().mockResolvedValue([
-        {
+        buildFakeCafe24Integration({
           id: 'existing-expired',
           status: 'expired',
-          serviceType: 'cafe24',
           mallId: 'pub-shop',
-          credentials: { mall_id: 'pub-shop', app_type: 'public' },
-        },
+          appType: 'public',
+        }),
       ]);
 
       const result = await service.begin(publicBeginParams());
@@ -604,13 +649,13 @@ describe('IntegrationOAuthService — Cafe24', () => {
         callCount += 1;
         if (callCount === 1) return Promise.resolve([]);
         return Promise.resolve([
-          {
+          buildFakeCafe24Integration({
             id: 'legacy-connected',
             status: 'connected',
-            serviceType: 'cafe24',
             mallId: null,
-            credentials: { mall_id: 'pub-shop', app_type: 'public' },
-          },
+            credentialsMallId: 'pub-shop',
+            appType: 'public',
+          }),
         ]);
       });
 
@@ -635,14 +680,11 @@ describe('IntegrationOAuthService — Cafe24', () => {
 
     it('returns conflict=true with status=connected when a connected row exists', async () => {
       integrationRepo.find = jest.fn().mockResolvedValue([
-        {
+        buildFakeCafe24Integration({
           id: 'conn-1',
           name: 'priv-shop (Cafe24 Private)',
           status: 'connected',
-          serviceType: 'cafe24',
-          mallId: 'priv-shop',
-          credentials: { mall_id: 'priv-shop', app_type: 'private' },
-        },
+        }),
       ]);
       const result = await service.precheckCafe24Mall('ws-1', 'priv-shop');
       expect(result).toEqual({
@@ -655,22 +697,16 @@ describe('IntegrationOAuthService — Cafe24', () => {
 
     it('prefers connected over pending_install when both exist', async () => {
       integrationRepo.find = jest.fn().mockResolvedValue([
-        {
+        buildFakeCafe24Integration({
           id: 'pending-1',
           name: 'pending',
           status: 'pending_install',
-          serviceType: 'cafe24',
-          mallId: 'priv-shop',
-          credentials: { mall_id: 'priv-shop', app_type: 'private' },
-        },
-        {
+        }),
+        buildFakeCafe24Integration({
           id: 'conn-1',
           name: 'connected',
           status: 'connected',
-          serviceType: 'cafe24',
-          mallId: 'priv-shop',
-          credentials: { mall_id: 'priv-shop', app_type: 'private' },
-        },
+        }),
       ]);
       const result = await service.precheckCafe24Mall('ws-1', 'priv-shop');
       expect(result.status).toBe('connected');
@@ -679,14 +715,11 @@ describe('IntegrationOAuthService — Cafe24', () => {
 
     it('returns status=pending_install when only pending row exists', async () => {
       integrationRepo.find = jest.fn().mockResolvedValue([
-        {
+        buildFakeCafe24Integration({
           id: 'pending-1',
           name: 'pending',
           status: 'pending_install',
-          serviceType: 'cafe24',
-          mallId: 'priv-shop',
-          credentials: { mall_id: 'priv-shop', app_type: 'private' },
-        },
+        }),
       ]);
       const result = await service.precheckCafe24Mall('ws-1', 'priv-shop');
       expect(result.status).toBe('pending_install');
@@ -695,14 +728,11 @@ describe('IntegrationOAuthService — Cafe24', () => {
 
     it('returns status=error when only error row exists', async () => {
       integrationRepo.find = jest.fn().mockResolvedValue([
-        {
+        buildFakeCafe24Integration({
           id: 'err-1',
           name: 'broken',
           status: 'error',
-          serviceType: 'cafe24',
-          mallId: 'priv-shop',
-          credentials: { mall_id: 'priv-shop', app_type: 'private' },
-        },
+        }),
       ]);
       const result = await service.precheckCafe24Mall('ws-1', 'priv-shop');
       expect(result.status).toBe('error');
@@ -710,14 +740,11 @@ describe('IntegrationOAuthService — Cafe24', () => {
 
     it('returns status=expired when only expired row exists', async () => {
       integrationRepo.find = jest.fn().mockResolvedValue([
-        {
+        buildFakeCafe24Integration({
           id: 'exp-1',
           name: 'gone',
           status: 'expired',
-          serviceType: 'cafe24',
-          mallId: 'priv-shop',
-          credentials: { mall_id: 'priv-shop', app_type: 'private' },
-        },
+        }),
       ]);
       const result = await service.precheckCafe24Mall('ws-1', 'priv-shop');
       expect(result.status).toBe('expired');
@@ -731,14 +758,11 @@ describe('IntegrationOAuthService — Cafe24', () => {
      */
     it('omits status when row has a status outside the priority enum (fallback)', async () => {
       integrationRepo.find = jest.fn().mockResolvedValue([
-        {
+        buildFakeCafe24Integration({
           id: 'tx-1',
           name: 'unknown-state',
           status: 'initializing',
-          serviceType: 'cafe24',
-          mallId: 'priv-shop',
-          credentials: { mall_id: 'priv-shop', app_type: 'private' },
-        },
+        }),
       ]);
       const result = await service.precheckCafe24Mall('ws-1', 'priv-shop');
       expect(result.conflict).toBe(true);
@@ -757,14 +781,14 @@ describe('IntegrationOAuthService — Cafe24', () => {
         callCount += 1;
         if (callCount === 1) return Promise.resolve([]);
         return Promise.resolve([
-          {
+          buildFakeCafe24Integration({
             id: 'legacy-conn',
             name: 'legacy',
             status: 'connected',
-            serviceType: 'cafe24',
             mallId: null,
-            credentials: { mall_id: 'priv-shop', app_type: 'public' },
-          },
+            credentialsMallId: 'priv-shop',
+            appType: 'public',
+          }),
         ]);
       });
       const result = await service.precheckCafe24Mall('ws-1', 'priv-shop');

```

---

### 파일 2: backend/src/modules/integrations/integration-oauth.service.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integration-oauth.service.ts b/backend/src/modules/integrations/integration-oauth.service.ts
index d88a5397..1dfcfda3 100644
--- a/backend/src/modules/integrations/integration-oauth.service.ts
+++ b/backend/src/modules/integrations/integration-oauth.service.ts
@@ -332,8 +332,7 @@ const CAFE24_PRECHECK_STATUS_PRIORITY = [
   'error',
   'expired',
 ] as const;
-type Cafe24PrecheckStatus =
-  (typeof CAFE24_PRECHECK_STATUS_PRIORITY)[number];
+type Cafe24PrecheckStatus = (typeof CAFE24_PRECHECK_STATUS_PRIORITY)[number];
 
 @Injectable()
 export class IntegrationOAuthService {

```

---

### 파일 3: backend/src/modules/integrations/integrations.controller.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integrations.controller.ts b/backend/src/modules/integrations/integrations.controller.ts
index 853625d2..db5a91c9 100644
--- a/backend/src/modules/integrations/integrations.controller.ts
+++ b/backend/src/modules/integrations/integrations.controller.ts
@@ -219,7 +219,7 @@ export class IntegrationsController {
   @ApiOperation({
     summary: 'Cafe24 mall_id 중복 사전 감지',
     description:
-      '현재 워크스페이스에 같은 mall_id 의 cafe24 통합이 이미 있는지 사전 확인합니다. 프론트엔드가 mall_id 입력 단계에서 debounce 호출해 inline 경고 배너를 띄우는 용도. 자격 증명·토큰은 포함되지 않으며, 가장 제한적인 상태 (connected > pending_install > error > expired) 만 반환합니다. 분당 60회 제한.',
+      "현재 워크스페이스에 같은 mall_id 의 cafe24 통합이 이미 있는지 사전 확인합니다. 프론트엔드가 mall_id 입력 단계에서 debounce 호출해 inline 경고 배너를 띄우는 용도. 자격 증명·토큰은 포함되지 않으며, 가장 제한적인 상태 (connected > pending_install > error > expired) 만 반환합니다. 분당 60회 제한. **Route order note**: 본 경로는 동적 `GET /api/integrations/:id` 보다 **앞에** 선언되어야 한다 — 뒤에 선언되면 `cafe24` 가 `:id` 로 소비돼 `ParseUUIDPipe` 가 400 을 일으킨다. controller 코드 주석에 회귀 안전망 명시. spec/2-navigation/4-integration.md §9.2 Rationale 'precheck endpoint' 참조.",
   })
   @ApiOkWrappedResponse(Cafe24PrecheckResultDto, {
     description:

```

#### 전체 파일 컨텍스트
```
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../common/guards/roles.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import {
  ApiCreatedWrappedResponse,
  ApiOkPaginatedResponse,
  ApiOkWrappedOneOfResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import {
  Cafe24PrecheckResultDto,
  IntegrationActivityDto,
  IntegrationDto,
  IntegrationUsagesDto,
  OAuthBeginCafe24PendingResultDto,
  OAuthBeginPopupResultDto,
  PreviewTestResultDto,
  ServiceCatalogDto,
  TestConnectionResultDto,
} from './dto/responses/integration-response.dto';
import { IntegrationsService } from './integrations.service';
import { IntegrationOAuthService } from './integration-oauth.service';
import { CurrentUser, WorkspaceId } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';
import {
  ActivityQueryDto,
  Cafe24PrecheckQueryDto,
  CreateIntegrationDto,
  ListIntegrationsQueryDto,
  OAuthBeginDto,
  PreviewTestDto,
  RequestScopesDto,
  RotateCredentialsDto,
  UpdateIntegrationDto,
  UpdateScopeDto,
} from './dto/integration.dto';
import { findVariant } from './services/service-registry';

/**
 * OAuth begin / reauthorize / request-scopes 세 엔드포인트가 동일한 분기
 * 응답을 갖는다 (popup `{ authUrl, state }` vs Cafe24 Private
 * `{ mode, integrationId, appUrl, callbackUrl, scopesAdded? }`). DTO 가 추가될
 * 때 세 데코레이터를 따로 수정하지 않도록 공유 상수로 추출 (shotgun surgery
 * 방지).
 */
const OAUTH_BEGIN_RESULT_DTOS = [
  OAuthBeginPopupResultDto,
  OAuthBeginCafe24PendingResultDto,
] as const;

/**
 * Swagger description SoT — 세 엔드포인트의 oneOf 응답 설명을 한 곳에서 관리.
 * `scopesAdded` 는 `request_scopes` mode 에서만 채워지므로 표기 일관성을 위해
 * 항상 optional 마커 (`scopesAdded?`) 로 노출한다 (spec §9.2 §9.3).
 */
const OAUTH_BEGIN_RESULT_DESCRIPTION =
  '일반 흐름은 { authUrl, state }, Cafe24 Private 흐름은 { mode, integrationId, appUrl, callbackUrl, scopesAdded? }.';

@ApiTags('Integrations')
@ApiBearerAuth('access-token')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly oauthService: IntegrationOAuthService,
  ) {}

  @Get()
  @ApiOperation({
    summary: '통합 목록 조회',
    description:
      '현재 워크스페이스에 등록된 통합 목록을 페이지네이션으로 조회합니다. 서비스 타입, 상태, 범위(개인/조직)로 필터링할 수 있습니다.',
  })
  @ApiOkPaginatedResponse(IntegrationDto, {
    description: '통합 목록 및 페이지네이션 메타',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: ListIntegrationsQueryDto,
  ) {
    return this.integrationsService.findAll(workspaceId, query);
  }

  @Get('services')
  @ApiOperation({
    summary: '지원 서비스 카탈로그',
    description:
      '플랫폼이 통합 가능한 서비스 메타데이터(서비스 타입, 인증 방식, 스코프 등)를 반환합니다.',
  })
  @ApiOkWrappedResponse(ServiceCatalogDto, {
    description: '지원 서비스 카탈로그',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  getAvailableServices() {
    return this.integrationsService.getAvailableServices();
  }

  /**
   * Structural validation of credentials before persistence.
   *
   * Throttled because this endpoint otherwise lets a user repeatedly submit
   * arbitrary payloads. Credentials are schema-validated against the static
   * SERVICE_REGISTRY — no outbound HTTP is performed (the actual probe lives
   * in per-service handlers in the execution engine).
   */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('preview-test')
  @ApiOperation({
    summary: '자격 증명 사전 검증',
    description:
      '자격 증명을 저장하기 전에 구조적 유효성을 검증합니다. 외부 네트워크 호출은 수행하지 않으며, 남용 방지를 위해 분당 20회로 제한됩니다.',
  })
  @ApiOkWrappedResponse(PreviewTestResultDto, {
    description: '검증 결과 (마스킹된 자격 증명 포함)',
  })
  @ApiBadRequestResponse({
    description:
      '지원하지 않는 serviceType/authType 조합 또는 자격 증명 검증 실패',
  })
  @ApiTooManyRequestsResponse({ description: '요청 한도 초과 (분당 20회)' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  previewTest(@Body() body: PreviewTestDto) {
    if (!findVariant(body.serviceType, body.authType)) {
      throw new BadRequestException({
        code: 'INTEGRATION_INVALID_SERVICE',
        message: `Unsupported service/auth combination: ${body.serviceType}/${body.authType}`,
      });
    }
    return this.integrationsService.previewTest(body);
  }

  @Post('oauth/begin')
  @ApiOperation({
    summary: 'OAuth 인증 시작',
    description:
      'OAuth 흐름을 시작해 인증 URL과 state 토큰을 반환합니다. new/reauthorize/request_scopes 모드를 지원합니다.',
  })
  @ApiOkWrappedOneOfResponse(OAUTH_BEGIN_RESULT_DTOS, {
    description: OAUTH_BEGIN_RESULT_DESCRIPTION,
  })
  @ApiBadRequestResponse({ description: '입력값 검증 실패 또는 미지원 서비스' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiConflictResponse({
    description:
      'CAFE24_PRIVATE_APP_ALREADY_CONNECTED — 동일 (workspaceId, mall_id) 의 connected cafe24 통합이 이미 존재 (app_type 무관 — public/private 둘 다). 에러 코드 이름의 `PRIVATE` 토큰은 historical artifact 이며 spec §9.2 가 "app_type 무관" 으로 의미를 정의한다. 클라이언트는 코드 이름이 아닌 명시된 의미 (mall_id 기준 중복) 로 분기해야 한다. 기존 통합을 사용하거나 삭제 후 재등록. spec/2-navigation/4-integration.md §9.2 + §9.4.',
  })
  async oauthBegin(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: OAuthBeginDto,
  ) {
    const mode = body.mode === 'request-scopes' ? 'request_scopes' : body.mode;
    const providerMeta =
      body.service === 'cafe24'
        ? {
            mall_id: body.mallId,
            app_type: body.appType,
            ...(body.appType === 'private'
              ? {
                  client_id: body.clientId,
                  client_secret: body.clientSecret,
                }
              : {}),
          }
        : undefined;
    return this.oauthService.begin({
      workspaceId,
      userId: user.sub,
      service: body.service,
      scopes: body.scopes,
      mode,
      integrationId: body.integrationId,
      integrationName: body.integrationName,
      scope: body.scope,
      providerMeta,
    });
  }

  // 본 controller 는 사용자가 호출하는 통합 관리 API 전용. 3rd-party
  // 가 호출하는 endpoints (Cafe24 install + OAuth callback) 는
  // `ThirdPartyOAuthController` (`/api/3rd-party/...`) 가 담당.
  // spec/2-navigation/4-integration.md §9.2.

  // ※ 라우트 선언 순서 주의: `cafe24/precheck` 는 동적 경로
  // `@Get(':id')` / `@Get(':id/usages')` / `@Get(':id/activity')` 보다
  // **앞에** 선언되어야 한다. NestJS 는 Express 라우터 순서를 따르므로
  // `:id` 가 먼저 매칭되면 `cafe24/precheck` 가 `id='cafe24'` 의
  // `ParseUUIDPipe` 위반으로 400 을 받는다. 빌드 타임에 탐지되지 않으므로
  // 향후 리팩토링 시 본 주석을 보존할 것.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('cafe24/precheck')
  @ApiOperation({
    summary: 'Cafe24 mall_id 중복 사전 감지',
    description:
      "현재 워크스페이스에 같은 mall_id 의 cafe24 통합이 이미 있는지 사전 확인합니다. 프론트엔드가 mall_id 입력 단계에서 debounce 호출해 inline 경고 배너를 띄우는 용도. 자격 증명·토큰은 포함되지 않으며, 가장 제한적인 상태 (connected > pending_install > error > expired) 만 반환합니다. 분당 60회 제한. **Route order note**: 본 경로는 동적 `GET /api/integrations/:id` 보다 **앞에** 선언되어야 한다 — 뒤에 선언되면 `cafe24` 가 `:id` 로 소비돼 `ParseUUIDPipe` 가 400 을 일으킨다. controller 코드 주석에 회귀 안전망 명시. spec/2-navigation/4-integration.md §9.2 Rationale 'precheck endpoint' 참조.",
  })
  @ApiOkWrappedResponse(Cafe24PrecheckResultDto, {
    description:
      'conflict 여부 + (존재 시) 충돌 대상 통합의 id/name/status. 자격 증명 미포함',
  })
  @ApiBadRequestResponse({
    description: 'mallId 형식 위반 (^[a-z0-9-]{3,50}$)',
  })
  @ApiTooManyRequestsResponse({ description: '요청 한도 초과 (분당 60회)' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async cafe24Precheck(
    @WorkspaceId() workspaceId: string,
    @Query() query: Cafe24PrecheckQueryDto,
  ) {
    return this.oauthService.precheckCafe24Mall(workspaceId, query.mallId);
  }

  @Get(':id')
  @ApiOperation({
    summary: '통합 단건 조회',
    description:
      'ID로 통합 상세를 조회합니다. 자격 증명은 마스킹되어 반환됩니다.',
  })
  @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(IntegrationDto, {
    description: '통합 상세 정보 (마스킹된 자격 증명 포함)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.integrationsService.findById(id, workspaceId);
  }

  @Get(':id/usages')
  @ApiOperation({
    summary: '통합 사용처 조회',
    description:
      '해당 통합을 사용 중인 워크플로우·노드 목록을 반환합니다. 삭제 영향도 확인용.',
  })
  @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(IntegrationUsagesDto, {
    description: '통합이 사용 중인 워크플로우·노드 목록',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
  async listUsages(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.integrationsService.getUsages(id, workspaceId);
  }

  @Get(':id/activity')
  @ApiOperation({
    summary: '통합 최근 활동 조회',
    description:
      '지정 기간(일) 동안의 호출 성공/실패 등 최근 활동 로그를 반환합니다.',
  })
  @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(IntegrationActivityDto, {
    description: '최근 활동 로그 목록',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
  async activity(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Query() query: ActivityQueryDto,
  ) {
    return this.integrationsService.getActivity(
      id,
      workspaceId,
      query.limit ?? 20,
      query.days ?? 7,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('editor')
  @ApiOperation({
    summary: '통합 생성',
    description:
      '자격 증명(API Key/토큰) 또는 OAuth preview 토큰을 사용해 새 통합을 생성합니다. scope=organization으로 생성하려면 관리자 권한이 필요합니다.',
  })
  @ApiCreatedWrappedResponse(IntegrationDto, {
    description: '생성된 통합 정보 (자격 증명 마스킹)',
  })
  @ApiBadRequestResponse({
    description: '입력값 검증 실패 또는 자격 증명 유효성 오류',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'organization 범위 생성 권한 부족' })
  @ApiConflictResponse({ description: '동일 조건의 통합이 이미 존재' })
  async create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateIntegrationDto,
  ) {
    const role = await this.integrationsService.resolveRole(
      workspaceId,
      user.sub,
    );
    return this.integrationsService.create(workspaceId, user.sub, role, body);
  }

  @Patch(':id')
  @Roles('editor')
  @ApiOperation({
    summary: '통합 수정',
    description: '통합의 이름 등 메타 정보를 수정합니다.',
  })
  @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(IntegrationDto, { description: '수정된 통합 정보' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateIntegrationDto,
  ) {
    return this.integrationsService.update(id, workspaceId, user.sub, body);
  }

  @Post(':id/test')
  @ApiOperation({
    summary: '통합 연결 테스트',
    description:
      '저장된 자격 증명을 사용해 실제 외부 서비스에 테스트 호출을 수행합니다.',
  })
  @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(TestConnectionResultDto, {
    description: '연결 테스트 결과 (성공 여부, 메타 정보)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
  async testConnection(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.integrationsService.testConnection(id, workspaceId);
  }

  @Post(':id/rotate')
  @Roles('editor')
  @ApiOperation({
    summary: '자격 증명 교체(rotate)',
    description:
      '저장된 자격 증명을 새 값으로 교체합니다. 관리자 권한이 필요할 수 있습니다.',
  })
  @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(IntegrationDto, {
    description: '교체 후 통합 정보 (마스킹된 자격 증명)',
  })
  @ApiBadRequestResponse({
    description: '입력값 검증 실패 또는 자격 증명 유효성 오류',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '교체 권한 부족' })
  @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
  async rotate(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: RotateCredentialsDto,
  ) {
    const role = await this.integrationsService.resolveRole(
      workspaceId,
      user.sub,
    );
    return this.integrationsService.rotate(
      id,
      workspaceId,
      user.sub,
      role,
      body,
    );
  }

  @Post(':id/reauthorize')
  @ApiOperation({
    summary: '재인증(reauthorize) 시작',
    description:
      '만료되었거나 오류 상태인 OAuth 통합에 대해 재인증 플로우를 트리거합니다.',
  })
  @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
  @ApiOkWrappedOneOfResponse(OAUTH_BEGIN_RESULT_DTOS, {
    description: OAUTH_BEGIN_RESULT_DESCRIPTION,
  })
  @ApiBadRequestResponse({ description: 'OAuth 기반 통합이 아님' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
  async reauthorize(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.integrationsService.reauthorize(id, workspaceId, user.sub);
  }

  @Post(':id/request-scopes')
  @ApiOperation({
    summary: '추가 스코프 요청',
    description:
      '기존 OAuth 통합에 추가 스코프를 요청합니다. provider가 incremental auth를 지원해야 합니다.',
  })
  @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
  @ApiOkWrappedOneOfResponse(OAUTH_BEGIN_RESULT_DTOS, {
    description: OAUTH_BEGIN_RESULT_DESCRIPTION,
  })
  @ApiBadRequestResponse({
    description: '입력값 검증 실패 또는 incremental auth 미지원',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '스코프 요청 권한 부족' })
  @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
  async requestScopes(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: RequestScopesDto,
  ) {
    const role = await this.integrationsService.resolveRole(
      workspaceId,
      user.sub,
    );
    return this.integrationsService.requestScopes(
      id,
      workspaceId,
      user.sub,
      role,
      body,
    );
  }

  @Patch(':id/scope')
  @ApiOperation({
    summary: '통합 범위 변경',
    description:
      '개인(personal) ↔ 조직(organization) 범위를 변경합니다. 조직 범위로 올리려면 관리자 권한이 필요합니다.',
  })
  @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(IntegrationDto, {
    description: '범위가 변경된 통합 정보',
  })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '범위 변경 권한 부족' })
  @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
  async updateScope(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateScopeDto,
  ) {
    const role = await this.integrationsService.resolveRole(
      workspaceId,
      user.sub,
    );
    return this.integrationsService.updateScope(
      id,
      workspaceId,
      user.sub,
      role,
      body,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('editor')
  @ApiOperation({
    summary: '통합 삭제',
    description:
      '통합을 영구 삭제합니다. 이 통합을 사용 중인 노드는 실행 시 오류가 발생할 수 있으니 사전에 `/usages`로 확인하세요.',
  })
  @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '삭제 성공' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '삭제 권한 부족' })
  @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.integrationsService.remove(id, workspaceId, user.sub);
  }
}

```

---

### 파일 4: backend/src/modules/integrations/integrations.service.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integrations.service.ts b/backend/src/modules/integrations/integrations.service.ts
index 8f324f8c..e2c50555 100644
--- a/backend/src/modules/integrations/integrations.service.ts
+++ b/backend/src/modules/integrations/integrations.service.ts
@@ -371,6 +371,16 @@ export class IntegrationsService {
       lastRotatedAt: new Date(),
     });
 
+    // 트랜잭션 미적용 의도 (2026-05-16 — ai-review W23 검토 결과):
+    //   1. `save()` 단일 INSERT 실패 시 row 미생성 — 자체로 atomic.
+    //   2. `auditLogsService.record` 는 step 1 성공 후에만 호출 — 실패 row 의
+    //      audit 없음.
+    //   3. preview_token 은 본 메서드 진입 전 `consumePreviewToken` 에서 이미
+    //      `DELETE…RETURNING` 으로 원자 소비된 capability token. V045
+    //      UNIQUE race loser 가 토큰을 재사용해도 보안상 위험 — 의도적으로
+    //      재사용 차단 (race-loser 는 OAuth 재실행 필요, 이는 spec 의도).
+    // 따라서 본 try/catch 블록을 dataSource.transaction 으로 감쌀 implementational
+    // 이득이 없다. 향후 audit log 외 부작용이 추가되면 재검토.
     try {
       const saved = await this.integrationRepository.save(entity);
       await this.auditLogsService.record({

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
    //      audit 없음.
    //   3. preview_token 은 본 메서드 진입 전 `consumePreviewToken` 에서 이미
    //      `DELETE…RETURNING` 으로 원자 소비된 capability token. V045
    //      UNIQUE race loser 가 토큰을 재사용해도 보안상 위험 — 의도적으로
    //      재사용 차단 (race-loser 는 OAuth 재실행 필요, 이는 spec 의도).
    // 따라서 본 try/catch 블록을 dataSource.transaction 으로 감쌀 implementational
    // 이득이 없다. 향후 audit log 외 부작용이 추가되면 재검토.
    try {
      const saved = await this.integrationRepository.save(entity);
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
      return this.toPublic(saved);
    } catch (err) {
      this.throwIfUniqueViolation(err);
      throw err;
    }
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
      this.throwIfUniqueViolation(err);
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
      console.warn(
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

      const appBaseUrl = process.env.APP_URL || 'http://localhost:3011';
      return {
        mode: 'cafe24_private_pending',
        integrationId: entity.id,
        appUrl: `${appBaseUrl.replace(/\/$/, '')}/api/3rd-party/cafe24/install/${entity.installToken}`,
        callbackUrl: `${appBaseUrl.replace(/\/$/, '')}/api/3rd-party/cafe24/callback`,
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
    const meta = this.buildIntegrationMeta(entity, credsUnreadable);
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
    const appUrl = this.buildCafe24AppUrl(entity, credsUnreadable);
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
    };
  }

  /**
   * Cafe24 Private 통합의 App URL 을 계산. 그 외 service_type / app_type 은
   * 항상 `null`. credentials 가 unreadable 이면 app_type 판별 불가이므로 `null`.
   * spec/2-navigation/4-integration.md §4.2 + §9.1 + Rationale "Cafe24 App
   * URL 상세 페이지 표시".
   */
  private buildCafe24AppUrl(
    entity: Integration,
    credsUnreadable: boolean,
  ): string | null {
    if (credsUnreadable) return null;
    if (entity.serviceType !== 'cafe24') return null;
    const appType = entity.credentials?.app_type;
    if (appType !== 'private') return null;
    if (
      typeof entity.installToken !== 'string' ||
      entity.installToken.length === 0
    ) {
      return null;
    }
    const appBaseUrl = (process.env.APP_URL || 'http://localhost:3011').replace(
      /\/$/,
      '',
    );
    return buildCafe24InstallUrl(appBaseUrl, entity.installToken);
  }

  /**
   * Build the safe-to-expose meta hints. Currently only cafe24 emits anything
   * (`appType`) — extracted so FE can decide flow gating (e.g. Reauthorize
   * button visibility) without ever touching the encrypted credentials blob.
   * `credsUnreadable` lets the caller skip a duplicate
   * `isUnreadableCredentials` call when it already has the result.
   */
  private buildIntegrationMeta(
    entity: Integration,
    credsUnreadable: boolean = isUnreadableCredentials(entity.credentials),
  ): IntegrationMeta {
    if (entity.serviceType === 'cafe24' && !credsUnreadable) {
      const appType = entity.credentials?.app_type;
      if (appType === 'public' || appType === 'private') {
        return { appType };
      }
    }
    return { appType: null };
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

  private throwIfUniqueViolation(err: unknown): void {
    const code = (err as { code?: string })?.code;
    const constraint = (err as { constraint?: string })?.constraint;
    if (code !== '23505') return;
    if (constraint === 'integration_workspace_name_unique') {
      throw new ConflictException({
        code: 'INTEGRATION_NAME_TAKEN',
        message: 'Integration name is already in use within this workspace',
      });
    }
    // V045 partial UNIQUE `(workspace_id, mall_id) WHERE service_type='cafe24'`
    // — Cafe24 Public 흐름은 begin 단계에서 row 를 만들지 않아 finalize
    // 단계의 동시 신청 race 또는 begin pre-check 통과 후 DB-level race 가
    // 본 constraint 로 잡힌다. 옛 코드는 본 분기를 누락해 raw QueryFailedError
    // 가 500 으로 빠지던 결함이 있었다. spec/2-navigation/4-integration.md
    // §9.4 — `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 의 race backstop 분기.
    if (constraint === 'idx_integration_cafe24_workspace_mall') {
      throw new ConflictException({
        code: 'CAFE24_PRIVATE_APP_ALREADY_CONNECTED',
        message:
          'A Cafe24 integration with this mall_id already exists in this workspace. Use the existing integration or delete it first.',
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

```

---

### 파일 5: frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx b/frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx
index 0ade7f61..19487543 100644
--- a/frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx
+++ b/frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx
@@ -105,7 +105,52 @@ describe("/integrations/new — Cafe24 mall_id 사전 중복 감지", () => {
       vi.advanceTimersByTime(360);
     });
     await waitFor(() => {
-      expect(precheckMock).toHaveBeenCalledWith("myshop");
+      // 두 번째 인자는 AbortController.signal (INFO 6 — 2026-05-16)
+      expect(precheckMock).toHaveBeenCalledWith(
+        "myshop",
+        expect.any(AbortSignal),
+      );
+    });
+  });
+
+  it("mall_id 가 바뀌면 in-flight precheck 요청을 abort (INFO 6 — 2026-05-16)", async () => {
+    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
+    // 첫 요청이 resolve 되지 않은 상태에서 두 번째 입력이 들어오면 첫 요청
+    // 의 AbortController.signal 이 aborted 가 되어야 한다.
+    let firstSignal: AbortSignal | undefined;
+    precheckMock.mockImplementationOnce(
+      (_mallId: string, signal: AbortSignal) => {
+        firstSignal = signal;
+        return new Promise(() => {}); // 영원히 resolve 안 됨
+      },
+    );
+    precheckMock.mockResolvedValueOnce({ conflict: false });
+
+    await renderPage();
+    await screen.findByLabelText(/Mall ID/i);
+    const mallIdInput = screen.getByLabelText(/Mall ID/i);
+
+    // 첫 mall_id 입력 → 350ms debounce → fetch 시작 (응답 보류)
+    await user.type(mallIdInput, "shop-a");
+    await act(async () => {
+      vi.advanceTimersByTime(360);
+    });
+    await waitFor(() => {
+      expect(precheckMock).toHaveBeenCalledTimes(1);
+    });
+    expect(firstSignal?.aborted).toBe(false);
+
+    // 두 번째 입력 → 첫 요청 abort + 새 debounce 시작
+    await user.clear(mallIdInput);
+    await user.type(mallIdInput, "shop-b");
+    // abort 는 동기적으로 발생 (effect cleanup)
+    expect(firstSignal?.aborted).toBe(true);
+    // 새 debounce 만료 후 두 번째 호출
+    await act(async () => {
+      vi.advanceTimersByTime(360);
+    });
+    await waitFor(() => {
+      expect(precheckMock).toHaveBeenCalledTimes(2);
     });
   });
 

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
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
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
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
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
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
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
    await act(async () => {
      vi.advanceTimersByTime(360);
    });

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
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
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
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
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
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
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
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
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
    await act(async () => {
      vi.advanceTimersByTime(360);
    });

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
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
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
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
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

### 파일 6: frontend/src/app/(main)/integrations/new/page.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/app/(main)/integrations/new/page.tsx b/frontend/src/app/(main)/integrations/new/page.tsx
index 95880a37..346ae251 100644
--- a/frontend/src/app/(main)/integrations/new/page.tsx
+++ b/frontend/src/app/(main)/integrations/new/page.tsx
@@ -120,23 +120,33 @@ export default function NewIntegrationPage() {
     }
     // mall_id 가 바뀔 때마다 350ms debounce — 짧으면 brute-force 호출,
     // 길면 사용자가 Connect 클릭 시 stale 결과를 보게 됨.
-    let cancelled = false;
+    //
+    // `AbortController` 로 in-flight 요청도 cancel — 사용자가 빠르게 타이핑하면
+    // 직전 fetch 가 backend 까지 도달했어도 응답을 기다리지 않고 abort 해
+    // throttle 카운터·서버 부하를 절약 (ai-review INFO #6, 2026-05-16).
+    const controller = new AbortController();
+    let aborted = false;
     setCafe24PrecheckLoading(true);
     const t = setTimeout(async () => {
       try {
-        const result = await integrationsApi.cafe24Precheck(cafe24MallIdInput);
-        if (!cancelled) setCafe24Conflict(result);
-      } catch {
-        // precheck 자체 실패는 silent — Connect 시점의 backend 가드가
-        // backstop. inline 배너를 띄우지 못해도 안전.
-        if (!cancelled) setCafe24Conflict(null);
+        const result = await integrationsApi.cafe24Precheck(
+          cafe24MallIdInput,
+          controller.signal,
+        );
+        if (!aborted) setCafe24Conflict(result);
+      } catch (err) {
+        // AbortError 는 정상 cancel 시그널 — silent. 그 외는 backend 가드가
+        // backstop 이므로 inline 배너를 띄우지 못해도 안전 (silent fail).
+        if (!aborted) setCafe24Conflict(null);
+        void err;
       } finally {
-        if (!cancelled) setCafe24PrecheckLoading(false);
+        if (!aborted) setCafe24PrecheckLoading(false);
       }
     }, 350);
     return () => {
-      cancelled = true;
+      aborted = true;
       clearTimeout(t);
+      controller.abort();
     };
   }, [isCafe24OAuth, cafe24MallIdInput]);
 

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

  // Cafe24 mall_id 사전 중복 감지 상태 (2026-05-16).
  // mall_id 입력 시 350ms debounce 로 backend precheck endpoint 호출 →
  // conflict 발견 시 inline 경고 배너 + Connect 버튼 disable.
  // spec/2-navigation/4-integration.md §9.2.
  const [cafe24Conflict, setCafe24Conflict] =
    useState<Cafe24PrecheckResult | null>(null);
  const [cafe24PrecheckLoading, setCafe24PrecheckLoading] = useState(false);
  const cafe24MallIdInput = String(credentials.mall_id ?? "").trim();
  const isCafe24OAuth =
    variant?.authType === "oauth2" && serviceType === "cafe24";

  // mall_id 패턴 매칭이 안 되면 precheck 호출 자체를 skip — backend 가
  // 400 으로 거부할 페이로드를 보낼 필요 없음. 패턴이 풀리는 순간
  // 이전 conflict 표시·로딩 상태도 클리어해 사용자 입력 도중 잘못된
  // 빨간 배너 또는 영구 spinner 가 남지 않도록.
  useEffect(() => {
    if (!isCafe24OAuth) {
      setCafe24Conflict(null);
      setCafe24PrecheckLoading(false);
      return;
    }
    if (!/^[a-z0-9-]{3,50}$/.test(cafe24MallIdInput)) {
      setCafe24Conflict(null);
      setCafe24PrecheckLoading(false);
      return;
    }
    // mall_id 가 바뀔 때마다 350ms debounce — 짧으면 brute-force 호출,
    // 길면 사용자가 Connect 클릭 시 stale 결과를 보게 됨.
    //
    // `AbortController` 로 in-flight 요청도 cancel — 사용자가 빠르게 타이핑하면
    // 직전 fetch 가 backend 까지 도달했어도 응답을 기다리지 않고 abort 해
    // throttle 카운터·서버 부하를 절약 (ai-review INFO #6, 2026-05-16).
    const controller = new AbortController();
    let aborted = false;
    setCafe24PrecheckLoading(true);
    const t = setTimeout(async () => {
      try {
        const result = await integrationsApi.cafe24Precheck(
          cafe24MallIdInput,
          controller.signal,
        );
        if (!aborted) setCafe24Conflict(result);
      } catch (err) {
        // AbortError 는 정상 cancel 시그널 — silent. 그 외는 backend 가드가
        // backstop 이므로 inline 배너를 띄우지 못해도 안전 (silent fail).
        if (!aborted) setCafe24Conflict(null);
        void err;
      } finally {
        if (!aborted) setCafe24PrecheckLoading(false);
      }
    }, 350);
    return () => {
      aborted = true;
      clearTimeout(t);
      controller.abort();
    };
  }, [isCafe24OAuth, cafe24MallIdInput]);

  /**
   * 에러 토스트 — `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 는 한글 i18n
   * 메시지를 primary 로, backend 의 영문 message 는 괄호 안 보조 정보로
   * 노출. 다른 코드는 기존 동작 유지 (backend message 우선).
   * 사용자가 "괄호 등을 이용해서 보조 안내로 사용" 지시 (2026-05-16).
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
    if (backendCode === "CAFE24_PRIVATE_APP_ALREADY_CONNECTED") {
      const primary = t("integrations.cafe24DuplicateMallToast");
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
          return "Mall ID must be 3-50 lowercase letters, digits, or hyphens.";
        }
        const appType = credentials.app_type as
          | "public"
          | "private"
          | undefined;
        if (appType !== "public" && appType !== "private") {
          return "Cafe24 app type must be 'public' or 'private'.";
        }
        if (appType === "private") {
          if (!String(credentials.client_id ?? "").trim()) {
            return "Private apps require client_id.";
          }
          if (!String(credentials.client_secret ?? "").trim()) {
            return "Private apps require client_secret.";
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
 * Cafe24-only extra fields for 

... (truncated due to prompt size limit) ...
```

---

### 파일 7: frontend/src/lib/api/integrations.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/api/integrations.ts b/frontend/src/lib/api/integrations.ts
index 2cf79edd..e42a5e23 100644
--- a/frontend/src/lib/api/integrations.ts
+++ b/frontend/src/lib/api/integrations.ts
@@ -287,11 +287,18 @@ export const integrationsApi = {
    *
    * 응답에는 자격 증명·토큰·timestamps 가 포함되지 않으며, 가장 제한적인
    * 상태 (`connected > pending_install > error > expired`) 만 반환된다.
-   * spec/2-navigation/4-integration.md §9.2.
+   *
+   * `signal` 인자로 AbortController.signal 을 받으면 호출자가 unmount /
+   * 사용자 입력 변경 시 in-flight 요청을 cancel 할 수 있다 (backend 호출
+   * 자체를 차단해 부하·throttle 카운터 절약). spec/2-navigation/4-integration.md §9.2.
    */
-  async cafe24Precheck(mallId: string): Promise<Cafe24PrecheckResult> {
+  async cafe24Precheck(
+    mallId: string,
+    signal?: AbortSignal,
+  ): Promise<Cafe24PrecheckResult> {
     const { data } = await apiClient.get("/integrations/cafe24/precheck", {
       params: { mallId },
+      signal,
     });
     return unwrap<Cafe24PrecheckResult>(data);
   },

```

#### 전체 파일 컨텍스트
```
import { apiClient } from "./client";

export type IntegrationStatus = "connected" | "expired" | "error" | "pending_install";
export type IntegrationScope = "personal" | "organization";
// `expiring` and `attention` are virtual filter values — spec
// /2-navigation/4-integration.md §2.3, §9.1, Rationale "Attention 가상
// 필터값". The DB Integration.status enum holds only `connected`/`expired`/
// `error`/`pending_install`; the backend rewrites these two virtual values
// into union WHERE clauses.
export type ListStatusFilter =
  | "all"
  | "attention"
  | "connected"
  | "expiring"
  | "expired"
  | "error";

export type CredentialsStatus = "ok" | "needs_reauth";

export interface Cafe24PrivatePendingBase {
  mode: "cafe24_private_pending";
  integrationId: string;
  appUrl: string;
  callbackUrl: string;
}

export type OAuthBeginResult =
  | { authUrl: string; state: string }
  | Cafe24PrivatePendingBase;

export type RequestScopesResult =
  | { authUrl: string; state: string }
  | (Cafe24PrivatePendingBase & { scopesAdded: string[] });

export interface IntegrationMeta {
  appType: "public" | "private" | null;
}

export interface IntegrationDto {
  id: string;
  workspaceId: string;
  serviceType: string;
  name: string;
  authType: string;
  credentials: Record<string, unknown>;
  scope: IntegrationScope;
  status: IntegrationStatus;
  statusReason: string | null;
  credentialsStatus: CredentialsStatus;
  tokenExpiresAt: string | null;
  lastUsedAt: string | null;
  lastRotatedAt: string | null;
  lastError: { code?: string; message?: string; at?: string } | Record<string, unknown> | null;
  meta: IntegrationMeta;
  /**
   * Cafe24 Private 통합 한정의 actionable URL. Cafe24 Developers Console
   * 의 "앱 URL" 갱신용으로 상세 페이지 App URL 카드가 노출.
   * `${APP_URL}/api/3rd-party/cafe24/install/:installToken` 형식이며, 그 외
   * 통합은 항상 `null`. `installToken` 은 본 URL 의 path segment 안에만
   * 존재하며 별도 필드로 노출되지 않는다 — 식별자 분산 방지.
   * spec/2-navigation/4-integration.md §9.1 + Rationale "Cafe24 App URL
   * 상세 페이지 표시".
   */
  appUrl: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialField {
  key: string;
  label: string;
  type: "string" | "number" | "enum" | "record";
  required: boolean;
  secret?: boolean;
  enum?: string[];
  default?: string | number;
  placeholder?: string;
  description?: string;
}

export interface AuthVariant {
  authType: string;
  label: string;
  fields: CredentialField[];
}

export interface ScopeOption {
  value: string;
  label: string;
  recommended?: boolean;
}

export interface ServiceDefinition {
  type: string;
  name: string;
  oauthProvider: "google" | "github" | null;
  authTypes: string[];
  authVariants: AuthVariant[];
  scopes: ScopeOption[];
  /**
   * Service-specific availability hints derived server-side from env / runtime
   * config. Currently populated only for cafe24 — `publicAppAvailable` reflects
   * whether the deployment has `CAFE24_CLIENT_ID` / `CAFE24_CLIENT_SECRET` set
   * (i.e. whether the app-store public-app OAuth flow is usable). Private apps
   * are always available because the user supplies their own client_id/secret.
   */
  meta?: { publicAppAvailable?: boolean };
}

export interface UsageWorkflow {
  workflowId: string;
  workflowName: string;
  isActive: boolean;
  nodes: { id: string; label: string; type: string }[];
}

export interface ActivityItem {
  id: string;
  integrationId: string;
  nodeExecutionId: string;
  workflowId: string;
  status: "success" | "failed";
  error: Record<string, unknown> | null;
  durationMs: number;
  at: string;
}

export interface ActivityResponse {
  items: ActivityItem[];
  summary: {
    totalCalls: number;
    successRate: number;
    dailyCounts: { date: string; count: number; failed: number }[];
  };
}

export interface ListParams {
  page?: number;
  limit?: number;
  q?: string;
  scope?: "personal" | "organization" | "all";
  serviceType?: string[];
  status?: ListStatusFilter;
}

function unwrap<T>(raw: { data?: T } | T): T {
  if (raw && typeof raw === "object" && "data" in (raw as Record<string, unknown>)) {
    const d = (raw as { data?: T }).data;
    if (d !== undefined) return d;
  }
  return raw as T;
}

export const integrationsApi = {
  async list(params: ListParams = {}) {
    const { data } = await apiClient.get("/integrations", { params });
    // Paginated response: { data: IntegrationDto[], pagination }
    return data as {
      data: IntegrationDto[];
      pagination: { page: number; limit: number; totalItems: number; totalPages: number };
    };
  },

  async services(): Promise<ServiceDefinition[]> {
    const { data } = await apiClient.get("/integrations/services");
    return unwrap<ServiceDefinition[]>(data);
  },

  async get(id: string): Promise<IntegrationDto> {
    const { data } = await apiClient.get(`/integrations/${id}`);
    return unwrap<IntegrationDto>(data);
  },

  async usages(id: string): Promise<UsageWorkflow[]> {
    const { data } = await apiClient.get(`/integrations/${id}/usages`);
    return unwrap<UsageWorkflow[]>(data);
  },

  async activity(id: string, params: { limit?: number; days?: number } = {}) {
    const { data } = await apiClient.get(`/integrations/${id}/activity`, {
      params,
    });
    return unwrap<ActivityResponse>(data);
  },

  async create(body: {
    serviceType: string;
    name: string;
    authType: string;
    credentials?: Record<string, unknown>;
    scope?: IntegrationScope;
    previewToken?: string;
  }): Promise<IntegrationDto> {
    const { data } = await apiClient.post("/integrations", body);
    return unwrap<IntegrationDto>(data);
  },

  async previewTest(body: {
    serviceType: string;
    authType: string;
    credentials: Record<string, unknown>;
  }): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.post("/integrations/preview-test", body);
    return unwrap<{ success: boolean; message: string }>(data);
  },

  async oauthBegin(body: {
    service: string;
    scopes: string[];
    mode: "new" | "reauthorize" | "request_scopes";
    integrationId?: string;
    integrationName?: string;
    scope?: IntegrationScope;
    // Cafe24-only fields — backend ignores them for other services.
    // mall_id is part of the base URL, so it must be supplied before the
    // authorize popup opens. Public apps read client_id/secret from server
    // env; private apps pass them in here for the state-row TTL.
    mallId?: string;
    appType?: "public" | "private";
    clientId?: string;
    clientSecret?: string;
  }): Promise<OAuthBeginResult> {
    const { data } = await apiClient.post("/integrations/oauth/begin", body);
    return unwrap<OAuthBeginResult>(data);
  },

  async update(
    id: string,
    body: { name?: string },
  ): Promise<IntegrationDto> {
    const { data } = await apiClient.patch(`/integrations/${id}`, body);
    return unwrap<IntegrationDto>(data);
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/integrations/${id}`);
  },

  async test(id: string): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.post(`/integrations/${id}/test`);
    return unwrap<{ success: boolean; message: string }>(data);
  },

  async rotate(
    id: string,
    credentials: Record<string, unknown>,
  ): Promise<IntegrationDto> {
    const { data } = await apiClient.post(`/integrations/${id}/rotate`, {
      credentials,
    });
    return unwrap<IntegrationDto>(data);
  },

  async reauthorize(id: string): Promise<OAuthBeginResult> {
    const { data } = await apiClient.post(`/integrations/${id}/reauthorize`);
    return unwrap<OAuthBeginResult>(data);
  },

  async requestScopes(
    id: string,
    scopes: string[],
  ): Promise<RequestScopesResult> {
    const { data } = await apiClient.post(
      `/integrations/${id}/request-scopes`,
      { scopes },
    );
    return unwrap<RequestScopesResult>(data);
  },

  async updateScope(
    id: string,
    scope: IntegrationScope,
  ): Promise<IntegrationDto> {
    const { data } = await apiClient.patch(`/integrations/${id}/scope`, {
      scope,
    });
    return unwrap<IntegrationDto>(data);
  },

  /**
   * Cafe24 mall_id 사전 중복 감지.
   *
   * `/integrations/new` 의 cafe24 step 에서 mall_id 입력 시점에 debounce 로
   * 호출. 같은 워크스페이스에 같은 mall_id 의 cafe24 통합이 이미 존재하면
   * inline 경고 배너를 띄워 OAuth 진입 자체를 사전 차단한다.
   *
   * 응답에는 자격 증명·토큰·timestamps 가 포함되지 않으며, 가장 제한적인
   * 상태 (`connected > pending_install > error > expired`) 만 반환된다.
   *
   * `signal` 인자로 AbortController.signal 을 받으면 호출자가 unmount /
   * 사용자 입력 변경 시 in-flight 요청을 cancel 할 수 있다 (backend 호출
   * 자체를 차단해 부하·throttle 카운터 절약). spec/2-navigation/4-integration.md §9.2.
   */
  async cafe24Precheck(
    mallId: string,
    signal?: AbortSignal,
  ): Promise<Cafe24PrecheckResult> {
    const { data } = await apiClient.get("/integrations/cafe24/precheck", {
      params: { mallId },
      signal,
    });
    return unwrap<Cafe24PrecheckResult>(data);
  },
};

export interface Cafe24PrecheckResult {
  conflict: boolean;
  existingIntegrationId?: string;
  existingName?: string;
  status?: "connected" | "pending_install" | "expired" | "error";
}

```

---

### 파일 8: plan/in-progress/cafe24-mall-dup-followup.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/cafe24-mall-dup-followup.md b/plan/in-progress/cafe24-mall-dup-followup.md
new file mode 100644
index 00000000..1e728dc0
--- /dev/null
+++ b/plan/in-progress/cafe24-mall-dup-followup.md
@@ -0,0 +1,52 @@
+---
+worktree: cafe24-mall-dup-followup-9b3c5a
+started: 2026-05-16
+owner: developer
+---
+
+# Cafe24 mall_id 중복 감지 UX — Quick bundle follow-up
+
+PR #107 (`cafe24-mall-dup-ux-a7f2c8`) 의 ai-review RESOLUTION.md 에서 deferred 한
+7건 중 작은 항목 4건을 하나의 PR 로 묶어 처리한다. 큰 리팩토링 (W9 / W11 / W19)
+은 별도 worktree.
+
+## 대상 항목
+
+- **W20** — `buildFakeIntegration(overrides)` 테스트 factory 추출. 현재
+  `integration-oauth.service.cafe24.spec.ts` 의 인라인 mock 객체 (것의 반복 선언)
+  를 단일 helper 로 통일.
+- **W21** — `cafe24/precheck` controller 의 `@ApiOperation.description` 에
+  라우트 순서 주의 한 줄 추가 (Swagger 문서에 회귀 안전망).
+- **W23** — `IntegrationsService.create` 의 트랜잭션 경계 확인. audit log
+  기록과 `throwIfUniqueViolation` 발사 사이에 중간 부작용 커밋 위험이 있는지
+  점검 후 필요 시 트랜잭션 적용 / 또는 의도 명시 주석.
+- **INFO 6** — `page.tsx` 의 precheck debounce 에 `AbortController` 도입.
+  현재 `cancelled` flag 로 효과 무시는 가능하나, backend 호출 자체는 완료된
+  뒤 응답이 버려진다. AbortController 로 실제 요청을 cancel.
+
+## 범위 외 (별도 PR)
+
+- W9 — `useCafe24MallIdPrecheck` 커스텀 훅 추출 — page.tsx 전반의 훅 추출
+  리팩토링과 함께 일괄 처리.
+- W11 — `formatErrorToast` 의 에러 코드 분기 → 도메인 상수 — 다른 에러 코드도
+  함께 동일 패턴 적용 시 일관성 보장.
+- W19 — status 유니온 타입 중앙화 — `packages/integration-shared` 신설 검토와
+  함께.
+
+## consistency-check 생략 사유
+
+- PR #107 에서 `spec/2-navigation/4-integration.md` §9.2/§9.4/Rationale 가 이미
+  정합화 완료된 상태.
+- 본 follow-up 은 spec 변경 없는 **순수 내부 코드 리팩토링·safety 보강**.
+- RESOLUTION.md 의 deferred 명단에 명시된 항목으로 ai-review 가 이미 사전
+  approval 한 변경.
+
+## 진행 상태
+
+- [x] W20 test factory (`buildFakeCafe24Integration`)
+- [x] W21 Swagger note (`@ApiOperation.description` 에 라우트 순서 명시)
+- [x] W23 transaction check (분석 후 의도 주석 추가, 실제 트랜잭션 미적용)
+- [x] INFO 6 AbortController (api client + page.tsx + 신규 abort 검증 테스트)
+- [x] TEST WORKFLOW — backend 3731 / frontend 1425 / e2e 79 통과
+- [ ] AI-REVIEW
+- [ ] PR

```

#### 전체 파일 컨텍스트
```
---
worktree: cafe24-mall-dup-followup-9b3c5a
started: 2026-05-16
owner: developer
---

# Cafe24 mall_id 중복 감지 UX — Quick bundle follow-up

PR #107 (`cafe24-mall-dup-ux-a7f2c8`) 의 ai-review RESOLUTION.md 에서 deferred 한
7건 중 작은 항목 4건을 하나의 PR 로 묶어 처리한다. 큰 리팩토링 (W9 / W11 / W19)
은 별도 worktree.

## 대상 항목

- **W20** — `buildFakeIntegration(overrides)` 테스트 factory 추출. 현재
  `integration-oauth.service.cafe24.spec.ts` 의 인라인 mock 객체 (것의 반복 선언)
  를 단일 helper 로 통일.
- **W21** — `cafe24/precheck` controller 의 `@ApiOperation.description` 에
  라우트 순서 주의 한 줄 추가 (Swagger 문서에 회귀 안전망).
- **W23** — `IntegrationsService.create` 의 트랜잭션 경계 확인. audit log
  기록과 `throwIfUniqueViolation` 발사 사이에 중간 부작용 커밋 위험이 있는지
  점검 후 필요 시 트랜잭션 적용 / 또는 의도 명시 주석.
- **INFO 6** — `page.tsx` 의 precheck debounce 에 `AbortController` 도입.
  현재 `cancelled` flag 로 효과 무시는 가능하나, backend 호출 자체는 완료된
  뒤 응답이 버려진다. AbortController 로 실제 요청을 cancel.

## 범위 외 (별도 PR)

- W9 — `useCafe24MallIdPrecheck` 커스텀 훅 추출 — page.tsx 전반의 훅 추출
  리팩토링과 함께 일괄 처리.
- W11 — `formatErrorToast` 의 에러 코드 분기 → 도메인 상수 — 다른 에러 코드도
  함께 동일 패턴 적용 시 일관성 보장.
- W19 — status 유니온 타입 중앙화 — `packages/integration-shared` 신설 검토와
  함께.

## consistency-check 생략 사유

- PR #107 에서 `spec/2-navigation/4-integration.md` §9.2/§9.4/Rationale 가 이미
  정합화 완료된 상태.
- 본 follow-up 은 spec 변경 없는 **순수 내부 코드 리팩토링·safety 보강**.
- RESOLUTION.md 의 deferred 명단에 명시된 항목으로 ai-review 가 이미 사전
  approval 한 변경.

## 진행 상태

- [x] W20 test factory (`buildFakeCafe24Integration`)
- [x] W21 Swagger note (`@ApiOperation.description` 에 라우트 순서 명시)
- [x] W23 transaction check (분석 후 의도 주석 추가, 실제 트랜잭션 미적용)
- [x] INFO 6 AbortController (api client + page.tsx + 신규 abort 검증 테스트)
- [x] TEST WORKFLOW — backend 3731 / frontend 1425 / e2e 79 통과
- [ ] AI-REVIEW
- [ ] PR

```
