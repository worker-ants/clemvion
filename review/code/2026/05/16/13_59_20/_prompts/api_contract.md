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

### 파일 1: backend/src/modules/integrations/integrations.service.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit ed11854c9a73575e9fd9e7ef27a24ea5a50b277d
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 13:58:46 2026 +0900

    feat(cafe24): connection test now pings GET /api/v2/admin/apps with 401-refresh-retry
    
    - Add Cafe24ApiClient.pingConnection — GET /api/v2/admin/apps with explicit
      refresh + 1 retry on 401 (race-condition self-recovery for stale tokens
      that proactive ensureFreshToken missed). 403 / transport failures return
      diagnostic results without flipping status or incrementing the
      consecutive_network_failures counter.
    - Add IntegrationsService.registerEntityTester — out-of-band hook so
      Cafe24Module can wire its entity-aware probe without IntegrationsModule
      ever importing from nodes/*.
    - Cafe24Module.onModuleInit registers cafe24's pingConnection so saved
      cafe24 integrations actually round-trip the API on test-connection
      instead of falling through to the structural-only success fallback.
    - Plan + spec-update note: spec §5.8 still says GET /store; the goal-stated
      endpoint is /apps. Update is deferred behind the 3 in-flight cafe24-spec
      worktree merges (consistency-checker session 13_37_23, BLOCK YES).
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/modules/integrations/integrations.service.spec.ts b/backend/src/modules/integrations/integrations.service.spec.ts
index 0a11407c..2b0dd3fa 100644
--- a/backend/src/modules/integrations/integrations.service.spec.ts
+++ b/backend/src/modules/integrations/integrations.service.spec.ts
@@ -246,6 +246,60 @@ describe('IntegrationsService', () => {
         NotFoundException,
       );
     });
+
+    it('uses registered entity-aware tester for matching service_type — wins over dispatchTest', async () => {
+      const cafe24Integration = makeIntegration({
+        serviceType: 'cafe24',
+        authType: 'oauth2',
+        credentials: {
+          mall_id: 'myshop',
+          app_type: 'public',
+          access_token: 't',
+          refresh_token: 'r',
+          scopes: ['mall.read_product'],
+          expires_at: new Date(Date.now() + 1e7).toISOString(),
+          cafe24_operator_id: 'op-1',
+        },
+      });
+      integrationRepo.findOne.mockResolvedValue(cafe24Integration);
+
+      const probe = jest.fn().mockResolvedValue({
+        success: false,
+        message: 'expired',
+        code: 'CAFE24_AUTH_FAILED',
+      });
+      service.registerEntityTester('cafe24', probe);
+
+      const result = await service.testConnection('int-1', 'ws-1');
+
+      expect(probe).toHaveBeenCalledWith(cafe24Integration);
+      expect(result).toEqual({
+        success: false,
+        message: 'expired',
+        code: 'CAFE24_AUTH_FAILED',
+      });
+    });
+
+    it('falls through to dispatchTest when no entity tester is registered for the service_type', async () => {
+      const cafe24Integration = makeIntegration({
+        serviceType: 'cafe24',
+        authType: 'oauth2',
+        credentials: {
+          mall_id: 'myshop',
+          app_type: 'public',
+          access_token: 't',
+          refresh_token: 'r',
+          scopes: ['mall.read_product'],
+          expires_at: new Date(Date.now() + 1e7).toISOString(),
+          cafe24_operator_id: 'op-1',
+        },
+      });
+      integrationRepo.findOne.mockResolvedValue(cafe24Integration);
+
+      // No entity tester registered — fallback path returns structural success.
+      const result = await service.testConnection('int-1', 'ws-1');
+      expect(result.success).toBe(true);
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
commit ed11854c9a73575e9fd9e7ef27a24ea5a50b277d
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 13:58:46 2026 +0900

    feat(cafe24): connection test now pings GET /api/v2/admin/apps with 401-refresh-retry
    
    - Add Cafe24ApiClient.pingConnection — GET /api/v2/admin/apps with explicit
      refresh + 1 retry on 401 (race-condition self-recovery for stale tokens
      that proactive ensureFreshToken missed). 403 / transport failures return
      diagnostic results without flipping status or incrementing the
      consecutive_network_failures counter.
    - Add IntegrationsService.registerEntityTester — out-of-band hook so
      Cafe24Module can wire its entity-aware probe without IntegrationsModule
      ever importing from nodes/*.
    - Cafe24Module.onModuleInit registers cafe24's pingConnection so saved
      cafe24 integrations actually round-trip the API on test-connection
      instead of falling through to the structural-only success fallback.
    - Plan + spec-update note: spec §5.8 still says GET /store; the goal-stated
      endpoint is /apps. Update is deferred behind the 3 in-flight cafe24-spec
      worktree merges (consistency-checker session 13_37_23, BLOCK YES).
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/modules/integrations/integrations.service.ts b/backend/src/modules/integrations/integrations.service.ts
index 67240b35..929d1840 100644
--- a/backend/src/modules/integrations/integrations.service.ts
+++ b/backend/src/modules/integrations/integrations.service.ts
@@ -74,6 +74,18 @@ type TransportTester = (
   credentials: Record<string, unknown>,
 ) => Promise<IntegrationTestResult>;
 
+/**
+ * Entity-aware variant — receives the persisted Integration row so the tester
+ * can use side-effects like proactive token refresh, status transitions, or
+ * DB-backed retry state. Registered out-of-band by infrastructure modules
+ * that own these side-effects (e.g. Cafe24Module → registers cafe24's
+ * `pingConnection` here so IntegrationsModule never has to depend on
+ * `nodes/*`). Falls through to {@link TransportTester} when not registered.
+ */
+export type EntityAwareTester = (
+  integration: Integration,
+) => Promise<IntegrationTestResult>;
+
 const ADMIN_ROLES = new Set(['owner', 'admin']);
 
 /**
@@ -145,6 +157,14 @@ export class IntegrationsService {
    */
   private readonly transportTesters: Map<string, TransportTester>;
 
+  /**
+   * Map of `service_type` → entity-aware test. Populated at runtime by
+   * infrastructure modules via {@link registerEntityTester}. Used only by
+   * {@link testConnection} (saved integration), not by {@link previewTest}
+   * (entity does not yet exist).
+   */
+  private readonly entityTesters = new Map<string, EntityAwareTester>();
+
   constructor(
     @InjectRepository(Integration)
     private readonly integrationRepository: Repository<Integration>,
@@ -162,6 +182,16 @@ export class IntegrationsService {
     ]);
   }
 
+  /**
+   * Out-of-band registration of an entity-aware tester for a given
+   * `service_type`. Called by infrastructure modules at startup
+   * (Cafe24Module.onModuleInit) so this module never has to depend on
+   * `nodes/*` directly. Last registration wins.
+   */
+  registerEntityTester(serviceType: string, tester: EntityAwareTester): void {
+    this.entityTesters.set(serviceType, tester);
+  }
+
   // ---------------------------------------------------------------
   // Listing
   // ---------------------------------------------------------------
@@ -529,6 +559,12 @@ export class IntegrationsService {
           'Credentials cannot be decrypted with the current key. Reconnect to rebuild this integration.',
       };
     }
+    // Entity-aware tester wins when registered (e.g. cafe24's pingConnection
+    // needs the row for proactive refresh + 401 retry against the real API).
+    const entityTester = this.entityTesters.get(entity.serviceType);
+    if (entityTester) {
+      return entityTester(entity);
+    }
     return this.dispatchTest(
       entity.serviceType,
       entity.authType,

```

---

### 파일 3: backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit ed11854c9a73575e9fd9e7ef27a24ea5a50b277d
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 13:58:46 2026 +0900

    feat(cafe24): connection test now pings GET /api/v2/admin/apps with 401-refresh-retry
    
    - Add Cafe24ApiClient.pingConnection — GET /api/v2/admin/apps with explicit
      refresh + 1 retry on 401 (race-condition self-recovery for stale tokens
      that proactive ensureFreshToken missed). 403 / transport failures return
      diagnostic results without flipping status or incrementing the
      consecutive_network_failures counter.
    - Add IntegrationsService.registerEntityTester — out-of-band hook so
      Cafe24Module can wire its entity-aware probe without IntegrationsModule
      ever importing from nodes/*.
    - Cafe24Module.onModuleInit registers cafe24's pingConnection so saved
      cafe24 integrations actually round-trip the API on test-connection
      instead of falling through to the structural-only success fallback.
    - Plan + spec-update note: spec §5.8 still says GET /store; the goal-stated
      endpoint is /apps. Update is deferred behind the 3 in-flight cafe24-spec
      worktree merges (consistency-checker session 13_37_23, BLOCK YES).
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts b/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts
index c012051f..bd6a4e6d 100644
--- a/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts
+++ b/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts
@@ -906,4 +906,314 @@ describe('Cafe24ApiClient', () => {
       ).rejects.toBeInstanceOf(Cafe24TransportFailedError);
     });
   });
+
+  // 사용자 진단용 연결 테스트. spec §5.8 의 ping endpoint 를 호출해
+  // 실제 access_token 유효성을 검증한다. 노드 호출 경로(call())와 달리
+  // 401 시 markAuthFailed 즉시 발사하지 않고 refresh + 1회 재시도 후
+  // 그래도 실패할 때만 auth_failed 로 격하한다 (race-condition 자가 회복).
+  describe('pingConnection (test-connection probe)', () => {
+    function freshIntegration(): Integration {
+      // 토큰이 expiry window 밖에 있어 ensureFreshToken 이 트리거되지 않게
+      // 한다. 401 retry 분기를 명시적으로 검증하기 위함.
+      const farFuture = new Date(Date.now() + 24 * 60 * 60 * 1000);
+      return makeIntegration({
+        credentials: {
+          mall_id: 'myshop',
+          app_type: 'public',
+          access_token: 'old-access',
+          refresh_token: 'old-refresh',
+          scopes: ['mall.read_product'],
+          expires_at: farFuture.toISOString(),
+          cafe24_operator_id: 'op-1',
+        },
+        tokenExpiresAt: farFuture,
+      });
+    }
+
+    it('200 — calls /apps and returns success without touching status', async () => {
+      fetchMock.mockResolvedValueOnce(
+        makeJsonResponse({
+          apps: [{ app_name: 'My App', mall_id: 'myshop' }],
+        }),
+      );
+      const integration = freshIntegration();
+
+      const result = await client.pingConnection(integration);
+
+      expect(result.success).toBe(true);
+      expect(fetchMock).toHaveBeenCalledTimes(1);
+      const url = new URL(fetchMock.mock.calls[0][0] as string);
+      expect(url.origin).toBe('https://myshop.cafe24api.com');
+      expect(url.pathname).toBe('/api/v2/admin/apps');
+      const init = fetchMock.mock.calls[0][1] as RequestInit;
+      expect((init.headers as Record<string, string>).Authorization).toBe(
+        'Bearer old-access',
+      );
+      // markAuthFailed 부작용 없음
+      expect(repo.update).not.toHaveBeenCalledWith(
+        integration.id,
+        expect.objectContaining({ status: 'error' }),
+      );
+      expect(integration.status).toBe('connected');
+    });
+
+    it('401 → refresh → 200 retry — success without flipping status', async () => {
+      const integration = freshIntegration();
+      process.env.CAFE24_CLIENT_ID = 'env-id';
+      process.env.CAFE24_CLIENT_SECRET = 'env-secret';
+
+      // tx mock — refresh 가 실제로 access_token 을 갈아끼우도록.
+      dataSource.transaction.mockImplementation(
+        async (cb: (m: { getRepository: Mock }) => Promise<void>) => {
+          const txRepo = {
+            findOne: jest.fn().mockResolvedValue(integration),
+            save: jest.fn().mockResolvedValue(undefined),
+          };
+          await cb({ getRepository: jest.fn().mockReturnValue(txRepo) });
+        },
+      );
+
+      fetchMock
+        // 1) initial /apps → 401 (stale token)
+        .mockResolvedValueOnce(
+          makeJsonResponse(
+            { error: 'invalid_token', error_description: 'expired' },
+            { status: 401 },
+          ),
+        )
+        // 2) refresh /oauth/token → 200
+        .mockResolvedValueOnce(
+          makeJsonResponse({
+            access_token: 'new-access',
+            refresh_token: 'new-refresh',
+            expires_in: 7200,
+          }),
+        )
+        // 3) retry /apps with new token → 200
+        .mockResolvedValueOnce(
+          makeJsonResponse({ apps: [{ app_name: 'My App' }] }),
+        );
+
+      const result = await client.pingConnection(integration);
+
+      expect(result.success).toBe(true);
+      expect(fetchMock).toHaveBeenCalledTimes(3);
+      // 첫 번째 호출: stale token
+      expect(
+        (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<
+          string,
+          string
+        >,
+      ).toMatchObject({ Authorization: 'Bearer old-access' });
+      // 두 번째: oauth token endpoint
+      expect(fetchMock.mock.calls[1][0]).toBe(
+        'https://myshop.cafe24api.com/api/v2/oauth/token',
+      );
+      // 세 번째: refreshed token 으로 retry
+      expect(
+        (fetchMock.mock.calls[2][1] as RequestInit).headers as Record<
+          string,
+          string
+        >,
+      ).toMatchObject({ Authorization: 'Bearer new-access' });
+      // 1회 성공이므로 markAuthFailed 부작용 없음
+      expect(repo.update).not.toHaveBeenCalledWith(
+        integration.id,
+        expect.objectContaining({ status: 'error' }),
+      );
+      expect(integration.status).toBe('connected');
+
+      delete process.env.CAFE24_CLIENT_ID;
+      delete process.env.CAFE24_CLIENT_SECRET;
+    });
+
+    it('401 → refresh succeeds → retry still 401 — markAuthFailed and returns failure', async () => {
+      const integration = freshIntegration();
+      process.env.CAFE24_CLIENT_ID = 'env-id';
+      process.env.CAFE24_CLIENT_SECRET = 'env-secret';
+
+      dataSource.transaction.mockImplementation(
+        async (cb: (m: { getRepository: Mock }) => Promise<void>) => {
+          const txRepo = {
+            findOne: jest.fn().mockResolvedValue(integration),
+            save: jest.fn().mockResolvedValue(undefined),
+          };
+          await cb({ getRepository: jest.fn().mockReturnValue(txRepo) });
+        },
+      );
+
+      fetchMock
+        .mockResolvedValueOnce(
+          makeJsonResponse(
+            { error: 'invalid_token', error_description: 'expired' },
+            { status: 401 },
+          ),
+        )
+        .mockResolvedValueOnce(
+          makeJsonResponse({
+            access_token: 'new-access',
+            refresh_token: 'new-refresh',
+            expires_in: 7200,
+          }),
+        )
+        .mockResolvedValueOnce(
+          makeJsonResponse(
+            { error: 'invalid_token', error_description: 'still bad' },
+            { status: 401 },
+          ),
+        );
+
+      const result = await client.pingConnection(integration);
+
+      expect(result.success).toBe(false);
+      expect(result.code).toBe('CAFE24_AUTH_FAILED');
+      expect(fetchMock).toHaveBeenCalledTimes(3);
+      // 재시도 후 markAuthFailed 발사
+      expect(repo.update).toHaveBeenCalledWith(
+        integration.id,
+        expect.objectContaining({
+          status: 'error',
+          statusReason: 'auth_failed',
+        }),
+      );
+      expect(integration.status).toBe('error');
+      expect(integration.statusReason).toBe('auth_failed');
+
+      delete process.env.CAFE24_CLIENT_ID;
+      delete process.env.CAFE24_CLIENT_SECRET;
+    });
+
+    it('401 → refresh itself fails (refresh_token invalid) — markAuthFailed and returns failure', async () => {
+      const integration = freshIntegration();
+      process.env.CAFE24_CLIENT_ID = 'env-id';
+      process.env.CAFE24_CLIENT_SECRET = 'env-secret';
+
+      fetchMock
+        .mockResolvedValueOnce(
+          makeJsonResponse(
+            { error: 'invalid_token', error_description: 'expired' },
+            { status: 401 },
+          ),
+        )
+        // refresh endpoint → 401 invalid_grant
+        .mockResolvedValueOnce(
+          makeJsonResponse({ error: 'invalid_grant' }, { status: 401 }),
+        );
+
+      const result = await client.pingConnection(integration);
+
+      expect(result.success).toBe(false);
+      expect(result.code).toBe('CAFE24_AUTH_FAILED');
+      expect(fetchMock).toHaveBeenCalledTimes(2);
+      // refreshAccessToken 의 markAuthFailed 가 이미 status 를 격하시킴
+      expect(repo.update).toHaveBeenCalledWith(
+        integration.id,
+        expect.objectContaining({
+          status: 'error',
+          statusReason: 'auth_failed',
+        }),
+      );
+
+      delete process.env.CAFE24_CLIENT_ID;
+      delete process.env.CAFE24_CLIENT_SECRET;
+    });
+
+    it('403 — returns failure but does NOT mark auth_failed (test is for diagnostics, not status drift)', async () => {
+      const integration = freshIntegration();
+      fetchMock.mockResolvedValueOnce(
+        makeJsonResponse(
+          {
+            error_code: 'INSUFFICIENT_SCOPE',
+            error_message: 'missing mall.read_application',
+          },
+          { status: 403 },
+        ),
+      );
+
+      const result = await client.pingConnection(integration);
+
+      expect(result.success).toBe(false);
+      expect(result.code).toBe('CAFE24_AUTH_FAILED');
+      expect(result.message).toContain('INSUFFICIENT_SCOPE');
+      // 403 은 retry 하지 않고, status 격하도 않는다
+      expect(fetchMock).toHaveBeenCalledTimes(1);
+      expect(repo.update).not.toHaveBeenCalledWith(
+        integration.id,
+        expect.objectContaining({ status: 'error' }),
+      );
+      expect(integration.status).toBe('connected');
+    });
+
+    it('transport failure — returns failure WITHOUT incrementing consecutive_network_failures', async () => {
+      const integration = freshIntegration();
+      integration.consecutiveNetworkFailures = 0;
+      fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
+
+      const result = await client.pingConnection(integration);
+
+      expect(result.success).toBe(false);
+      expect(result.code).toBe('CAFE24_TRANSPORT_FAILED');
+      // 사용자 진단용 호출이라 노드 실행 카운터에 합산하지 않는다
+      expect(repo.update).not.toHaveBeenCalledWith(
+        integration.id,
+        expect.objectContaining({ consecutiveNetworkFailures: 1 }),
+      );
+    });
+
+    it('proactive refresh fires before /apps when token within REFRESH_WINDOW_MS', async () => {
+      const within = new Date(Date.now() + 30_000);
+      const integration = makeIntegration({
+        credentials: {
+          mall_id: 'myshop',
+          app_type: 'public',
+          access_token: 'old-access',
+          refresh_token: 'old-refresh',
+          scopes: ['mall.read_product'],
+          expires_at: within.toISOString(),
+          cafe24_operator_id: 'op-1',
+        },
+        tokenExpiresAt: within,
+      });
+      process.env.CAFE24_CLIENT_ID = 'env-id';
+      process.env.CAFE24_CLIENT_SECRET = 'env-secret';
+
+      dataSource.transaction.mockImplementation(
+        async (cb: (m: { getRepository: Mock }) => Promise<void>) => {
+          const txRepo = {
+            findOne: jest.fn().mockResolvedValue(integration),
+            save: jest.fn().mockResolvedValue(undefined),
+          };
+          await cb({ getRepository: jest.fn().mockReturnValue(txRepo) });
+        },
+      );
+
+      fetchMock
+        // refresh
+        .mockResolvedValueOnce(
+          makeJsonResponse({
+            access_token: 'new-access',
+            refresh_token: 'new-refresh',
+            expires_in: 7200,
+          }),
+        )
+        // /apps with refreshed token
+        .mockResolvedValueOnce(makeJsonResponse({ apps: [] }));
+
+      const result = await client.pingConnection(integration);
+
+      expect(result.success).toBe(true);
+      expect(fetchMock).toHaveBeenCalledTimes(2);
+      expect(fetchMock.mock.calls[0][0]).toBe(
+        'https://myshop.cafe24api.com/api/v2/oauth/token',
+      );
+      const apiCall = fetchMock.mock.calls[1];
+      expect(new URL(apiCall[0] as string).pathname).toBe('/api/v2/admin/apps');
+      expect(
+        (apiCall[1] as RequestInit).headers as Record<string, string>,
+      ).toMatchObject({ Authorization: 'Bearer new-access' });
+
+      delete process.env.CAFE24_CLIENT_ID;
+      delete process.env.CAFE24_CLIENT_SECRET;
+    });
+  });
 });

```

---

### 파일 4: backend/src/nodes/integration/cafe24/cafe24-api.client.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit ed11854c9a73575e9fd9e7ef27a24ea5a50b277d
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 13:58:46 2026 +0900

    feat(cafe24): connection test now pings GET /api/v2/admin/apps with 401-refresh-retry
    
    - Add Cafe24ApiClient.pingConnection — GET /api/v2/admin/apps with explicit
      refresh + 1 retry on 401 (race-condition self-recovery for stale tokens
      that proactive ensureFreshToken missed). 403 / transport failures return
      diagnostic results without flipping status or incrementing the
      consecutive_network_failures counter.
    - Add IntegrationsService.registerEntityTester — out-of-band hook so
      Cafe24Module can wire its entity-aware probe without IntegrationsModule
      ever importing from nodes/*.
    - Cafe24Module.onModuleInit registers cafe24's pingConnection so saved
      cafe24 integrations actually round-trip the API on test-connection
      instead of falling through to the structural-only success fallback.
    - Plan + spec-update note: spec §5.8 still says GET /store; the goal-stated
      endpoint is /apps. Update is deferred behind the 3 in-flight cafe24-spec
      worktree merges (consistency-checker session 13_37_23, BLOCK YES).
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/nodes/integration/cafe24/cafe24-api.client.ts b/backend/src/nodes/integration/cafe24/cafe24-api.client.ts
index 068772da..35263b8d 100644
--- a/backend/src/nodes/integration/cafe24/cafe24-api.client.ts
+++ b/backend/src/nodes/integration/cafe24/cafe24-api.client.ts
@@ -271,6 +271,167 @@ export class Cafe24ApiClient {
     });
   }
 
+  /**
+   * 사용자 진단용 연결 테스트. spec/2-navigation/4-integration.md §5.8 의
+   * `GET /api/v2/admin/apps` 핑으로 access_token 의 유효성을 확인한다.
+   *
+   * `call()` 과 다른 점:
+   * - 401 시 즉시 `markAuthFailed` 를 발사하지 않고 명시적으로 refresh 후
+   *   1회 재시도. proactive `ensureFreshToken` 이 race condition 으로 빗나간
+   *   stale token 을 자가 회복한다.
+   * - transport 실패는 `consecutive_network_failures` 카운터에 합산하지
+   *   않는다. 사용자가 직접 누른 진단 호출이라 노드 자동 호출의 신호로
+   *   섞여서는 안 된다.
+   * - 403 은 retry 하지 않고, status 격하 없이 실패 결과만 반환한다 (스코프
+   *   부족·앱 미설치 같은 진단 정보를 사용자에게 그대로 보여주기 위함).
+   *
+   * 반환값은 throw 하지 않고 항상 IntegrationTestResult 형태:
+   * - 성공: `{ success: true }`
+   * - 실패: `{ success: false, code, message }`
+   */
+  async pingConnection(
+    integration: Integration,
+  ): Promise<{ success: boolean; code?: string; message?: string }> {
+    return withIntegrationLock(integration.id, async () => {
+      const creds = (integration.credentials ?? {}) as Cafe24Credentials;
+      this.assertCredentials(creds);
+
+      // 1차: proactive refresh window 안이면 미리 갱신.
+      try {
+        await this.ensureFreshToken(integration);
+      } catch (err) {
+        // refresh 자체가 401 (refresh_token invalid) — markAuthFailed 가
+        // ensureFreshToken 안에서 이미 발사됐다. 결과만 변환해 반환.
+        if (err instanceof Cafe24AuthFailedError) {
+          return {
+            success: false,
+            code: 'CAFE24_AUTH_FAILED',
+            message: err.message,
+          };
+        }
+        if (err instanceof Cafe24TransportFailedError) {
+          return {
+            success: false,
+            code: 'CAFE24_TRANSPORT_FAILED',
+            message: err.message,
+          };
+        }
+        throw err;
+      }
+
+      const mallId = creds.mall_id!;
+      const tokenAfterProactive =
+        ((integration.credentials ?? {}) as Cafe24Credentials).access_token ??
+        creds.access_token!;
+
+      // 2차: /apps 핑.
+      const first = await this.rawPing(mallId, tokenAfterProactive);
+      if (first.kind === 'success') return { success: true };
+      if (first.kind === 'transport') {
+        return {
+          success: false,
+          code: 'CAFE24_TRANSPORT_FAILED',
+          message: first.message,
+        };
+      }
+      if (first.status === 403) {
+        // 진단용 — status 격하 없이 메시지만 전달.
+        return {
+          success: false,
+          code: 'CAFE24_AUTH_FAILED',
+          message: this.formatAuthFailure(first.status, mallId, first.body),
+        };
+      }
+      // status === 401: 명시적 refresh 후 1회 재시도.
+      try {
+        await this.refreshAccessToken(integration);
+      } catch (err) {
+        if (err instanceof Cafe24AuthFailedError) {
+          return {
+            success: false,
+            code: 'CAFE24_AUTH_FAILED',
+            message: err.message,
+          };
+        }
+        if (err instanceof Cafe24TransportFailedError) {
+          return {
+            success: false,
+            code: 'CAFE24_TRANSPORT_FAILED',
+            message: err.message,
+          };
+        }
+        throw err;
+      }
+
+      const refreshedToken = (
+        (integration.credentials ?? {}) as Cafe24Credentials
+      ).access_token!;
+      const second = await this.rawPing(mallId, refreshedToken);
+      if (second.kind === 'success') return { success: true };
+      if (second.kind === 'transport') {
+        return {
+          success: false,
+          code: 'CAFE24_TRANSPORT_FAILED',
+          message: second.message,
+        };
+      }
+      // 재시도도 401/403 — 토큰 자체 문제로 확정. status 격하.
+      if (second.status === 401 || second.status === 403) {
+        await this.markAuthFailed(integration);
+      }
+      return {
+        success: false,
+        code: 'CAFE24_AUTH_FAILED',
+        message: this.formatAuthFailure(second.status, mallId, second.body),
+      };
+    });
+  }
+
+  /**
+   * 단일 fetch — 카운터·status 격하 부작용 없는 raw probe. pingConnection 의
+   * 401 retry 분기를 명시적으로 제어하기 위해 executeWithRateLimit 와 분리.
+   */
+  private async rawPing(
+    mallId: string,
+    accessToken: string,
+  ): Promise<
+    | { kind: 'success' }
+    | { kind: 'http'; status: number; body: unknown }
+    | { kind: 'transport'; message: string }
+  > {
+    const url = this.buildUrl(mallId, 'apps');
+    const controller = new AbortController();
+    const timer = setTimeout(() => controller.abort(), 30_000);
+    let response: Response;
+    try {
+      response = await this.fetchImpl(url, {
+        method: 'GET',
+        headers: {
+          Authorization: `Bearer ${accessToken}`,
+          Accept: 'application/json',
+        },
+        signal: controller.signal,
+      });
+    } catch (err) {
+      return { kind: 'transport', message: extractErrorMessage(err) };
+    } finally {
+      clearTimeout(timer);
+    }
+    if (response.ok) return { kind: 'success' };
+    const body = await safeReadJson(response);
+    return { kind: 'http', status: response.status, body };
+  }
+
+  private formatAuthFailure(
+    status: number,
+    mallId: string,
+    body: unknown,
+  ): string {
+    const summary = summarizeCafe24ErrorBody(body);
+    const suffix = summary ? ` — ${summary}` : '';
+    return `Cafe24 authentication failed (${status}) for mall ${mallId}${suffix}`;
+  }
+
   private assertCredentials(creds: Cafe24Credentials): void {
     if (!creds.mall_id) {
       throw new Cafe24IncompleteCredentialsError('mall_id is missing');

```

---

### 파일 5: backend/src/nodes/integration/cafe24/cafe24.module.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit ed11854c9a73575e9fd9e7ef27a24ea5a50b277d
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 13:58:46 2026 +0900

    feat(cafe24): connection test now pings GET /api/v2/admin/apps with 401-refresh-retry
    
    - Add Cafe24ApiClient.pingConnection — GET /api/v2/admin/apps with explicit
      refresh + 1 retry on 401 (race-condition self-recovery for stale tokens
      that proactive ensureFreshToken missed). 403 / transport failures return
      diagnostic results without flipping status or incrementing the
      consecutive_network_failures counter.
    - Add IntegrationsService.registerEntityTester — out-of-band hook so
      Cafe24Module can wire its entity-aware probe without IntegrationsModule
      ever importing from nodes/*.
    - Cafe24Module.onModuleInit registers cafe24's pingConnection so saved
      cafe24 integrations actually round-trip the API on test-connection
      instead of falling through to the structural-only success fallback.
    - Plan + spec-update note: spec §5.8 still says GET /store; the goal-stated
      endpoint is /apps. Update is deferred behind the 3 in-flight cafe24-spec
      worktree merges (consistency-checker session 13_37_23, BLOCK YES).
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/nodes/integration/cafe24/cafe24.module.ts b/backend/src/nodes/integration/cafe24/cafe24.module.ts
index a26295de..f805eb15 100644
--- a/backend/src/nodes/integration/cafe24/cafe24.module.ts
+++ b/backend/src/nodes/integration/cafe24/cafe24.module.ts
@@ -3,6 +3,7 @@ import {
   Logger,
   Module,
   OnApplicationShutdown,
+  OnModuleInit,
   Provider,
 } from '@nestjs/common';
 import { TypeOrmModule } from '@nestjs/typeorm';
@@ -16,6 +17,8 @@ import {
   CAFE24_REFRESH_QUEUE,
   CAFE24_REFRESH_QUEUE_EVENTS,
 } from '../../../modules/integrations/cafe24-token-refresh.constants';
+import { IntegrationsModule } from '../../../modules/integrations/integrations.module';
+import { IntegrationsService } from '../../../modules/integrations/integrations.service';
 
 /**
  * QueueEvents provider — Cafe24ApiClient 가 `waitUntilFinished` 로 worker
@@ -57,6 +60,9 @@ const cafe24RefreshQueueEventsProvider: Provider = {
   imports: [
     TypeOrmModule.forFeature([Integration]),
     BullModule.registerQueue({ name: CAFE24_REFRESH_QUEUE }),
+    // IntegrationsService 에 cafe24 entity-aware tester 를 등록하기 위함.
+    // dependency direction 은 nodes → modules 로 유지된다 (역방향 import 없음).
+    IntegrationsModule,
   ],
   providers: [
     Cafe24ApiClient,
@@ -65,14 +71,37 @@ const cafe24RefreshQueueEventsProvider: Provider = {
   ],
   exports: [Cafe24ApiClient],
 })
-export class Cafe24Module implements OnApplicationShutdown {
+export class Cafe24Module implements OnApplicationShutdown, OnModuleInit {
   private readonly logger = new Logger(Cafe24Module.name);
 
   constructor(
     @Inject(CAFE24_REFRESH_QUEUE_EVENTS)
     private readonly queueEvents: QueueEvents,
+    private readonly integrations: IntegrationsService,
+    private readonly cafe24Api: Cafe24ApiClient,
   ) {}
 
+  /**
+   * `POST /api/integrations/:id/test` 의 cafe24 분기를 활성화한다. spec
+   * §5.8 의 `GET /api/v2/admin/apps` 핑 + 401 시 refresh + 1회 재시도 정책.
+   * IntegrationsModule 이 `nodes/*` 를 import 하지 않도록 register 패턴으로
+   * 우회 — dependency direction 보존.
+   */
+  onModuleInit(): void {
+    this.integrations.registerEntityTester('cafe24', async (integration) => {
+      const result = await this.cafe24Api.pingConnection(integration);
+      return {
+        success: result.success,
+        message:
+          result.message ??
+          (result.success
+            ? 'Cafe24 connection successful'
+            : 'Cafe24 connection failed'),
+        code: result.code,
+      };
+    });
+  }
+
   async onApplicationShutdown(): Promise<void> {
     try {
       await this.queueEvents.close();

```

---

### 파일 6: plan/in-progress/cafe24-test-connection.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit ed11854c9a73575e9fd9e7ef27a24ea5a50b277d
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 13:58:46 2026 +0900

    feat(cafe24): connection test now pings GET /api/v2/admin/apps with 401-refresh-retry
    
    - Add Cafe24ApiClient.pingConnection — GET /api/v2/admin/apps with explicit
      refresh + 1 retry on 401 (race-condition self-recovery for stale tokens
      that proactive ensureFreshToken missed). 403 / transport failures return
      diagnostic results without flipping status or incrementing the
      consecutive_network_failures counter.
    - Add IntegrationsService.registerEntityTester — out-of-band hook so
      Cafe24Module can wire its entity-aware probe without IntegrationsModule
      ever importing from nodes/*.
    - Cafe24Module.onModuleInit registers cafe24's pingConnection so saved
      cafe24 integrations actually round-trip the API on test-connection
      instead of falling through to the structural-only success fallback.
    - Plan + spec-update note: spec §5.8 still says GET /store; the goal-stated
      endpoint is /apps. Update is deferred behind the 3 in-flight cafe24-spec
      worktree merges (consistency-checker session 13_37_23, BLOCK YES).
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/plan/in-progress/cafe24-test-connection.md b/plan/in-progress/cafe24-test-connection.md
new file mode 100644
index 00000000..5cdfed6b
--- /dev/null
+++ b/plan/in-progress/cafe24-test-connection.md
@@ -0,0 +1,78 @@
+---
+worktree: cafe24-test-connection-2d7fa4
+started: 2026-05-16
+owner: developer
+---
+
+# Cafe24 연결 테스트 실 구현
+
+## 배경
+
+`POST /api/integrations/:id/test` 의 cafe24 분기는 현재 `IntegrationsService.dispatchTest` 의 transport tester
+맵에 등록돼 있지 않아, 구조적 검증만 통과하면 항상 `success: true` 를 반환한다 (구현 위치:
+`backend/src/modules/integrations/integrations.service.ts:160-162`, `dispatchTest` fallback).
+실제 cafe24 API 401 (`access_token time expired`) 은 노드 실행 시점의
+`Cafe24ApiClient.executeWithRateLimit` 에서만 잡혀서 `markAuthFailed` 로 status 를 `error(auth_failed)` 로
+전이시키지만, "연결 테스트" 버튼으로는 이 상태를 사전에 검출할 수 없다.
+
+스펙 §5.8 은 "저장된 `access_token` 으로 `GET .../store` 핑" 으로 명시했으나, 사용자 지시(2026-05-16) 로
+**`GET /api/v2/admin/apps` 로 변경하고 401 시 refresh + 1회 재시도** 를 추가한다.
+
+## 구현 범위
+
+- `Cafe24ApiClient` 에 `testConnection(integration)` public 메서드 추가
+  - `ensureFreshToken` 으로 사전 refresh
+  - `GET /api/v2/admin/apps` 호출
+  - 200 → `{ success: true }`
+  - 401 → 명시적 `refreshAccessToken` 후 1회 재시도. 재시도도 401 이면 `markAuthFailed` + `{ success: false }`
+  - 403/기타 → `markAuthFailed` 호출하지 않고 `{ success: false, message }` 반환 (테스트 단계는 사용자 진단용)
+  - transport 실패 → `{ success: false }` (consecutiveNetworkFailures 카운터는 노드 호출 정의에 한정 — 테스트는 합산하지 않음)
+- `IntegrationsService` 에 cafe24 transport tester 등록
+  - `transportTesters` 맵 시그니처는 `(authType, credentials)` 만 받지만 cafe24 는 `Integration` entity 가 필요 → testConnection 분기 자체를 entity-aware 로 확장
+  - preview-test (DB 저장 전) cafe24 케이스는 막 발급된 토큰이라 refresh 불필요 — 단순 ping만 수행 (entity 없는 분기)
+- 단위 테스트
+  - `cafe24-api.client.spec.ts` 의 새 메서드 케이스 — 200 / 401-refresh-200 / 401-refresh-401 / transport fail
+  - `integrations.service.spec` 또는 신규 spec 에 cafe24 분기 등록 검증
+
+## 사전 일관성 검토 결과 (2026-05-16 13:37)
+
+`review/consistency/2026/05/16/13_37_23/SUMMARY.md` 참조. **BLOCK: YES** — Critical 2건.
+
+- Critical 1·2: `spec/2-navigation/4-integration.md` 3방향 worktree 동시 편집 경쟁
+  (`cafe24-spec-sync-e2a8b9`, `cafe24-app-url-reuse-f9a2e3`, `prod-rereview-fix-a7c93f`)
+  → **spec 갱신 위임 직렬화 필수**. 본 plan 의 코드 작업은 별도 파일이라 선진행.
+- Naming Collision WARNING: `TransportTester` 타입 시그니처 확장 대신 `dispatchTest` 외부에서
+  cafe24 entity-aware 분기 — 본 plan 의 §구현 범위에 이미 반영됨
+- Naming INFO: `testConnection` 메서드명이 LLM 도메인 전체에 사용 중 → `pingConnection` 으로 명명
+- Cross-Spec WARNING: 테스트 transport 실패는 `consecutive_network_failures` 카운터 합산 제외 — 코드 명시
+
+판단:
+- 코드 구현은 진행 (사용자 직접 지시 + 코드 영역 충돌 없음)
+- spec 갱신 위임 노트(`spec-update-cafe24-test-connection.md`)는 작성하되, "위 3개 worktree 머지 후 착수" 의존성을 본문에 명시
+
+## Spec 갱신 (project-planner 위임 대상)
+
+`spec/2-navigation/4-integration.md` §5.8 "테스트 방법" 항목을 다음으로 갱신해야 한다:
+
+> **테스트 방법**: 저장된 `access_token` 으로 `GET https://{mall_id}.cafe24api.com/api/v2/admin/apps` 핑.
+> 응답 200 + JSON 본문 확인. 401 응답 시 `refresh_token` 으로 access_token 을 갱신한 뒤 1회 재시도하며,
+> 재시도도 401 이면 `auth_failed` 로 확정. 자동 갱신/재시도 흐름은 노드 실행 시점의 `ensureFreshToken`
+> 정책과 동일하다 (§10.5 참조).
+
+근거:
+- `/apps` 는 자기 앱 정보 조회 — 모든 cafe24 통합이 자기 앱이므로 scope 부족 위험이 가장 적다
+- `/store` 는 `mall.read_store` 가 없으면 403 — 사용자가 store scope 를 빼고 다른 카테고리만 사용하는 케이스 존재
+- 401 retry 추가는 spec §10.5 의 proactive refresh 가 race condition 으로 빗나간 경우(현재 mall=gehrig0301 운영 사례) 자가 회복
+
+본 노트는 plan 완료 후 project-planner 에 spec-update-cafe24-test-connection.md 로 위임한다.
+
+## 진행 체크리스트
+
+- [x] worktree 셋업 (`.claude/worktrees/cafe24-test-connection-2d7fa4`)
+- [x] spec 분석 (§3.3, §5.8, §10.5)
+- [x] 사전 일관성 검토 (`/consistency-check --impl-prep`) — BLOCK: YES, spec 위임만 직렬화. 코드 진행
+- [ ] 테스트 선작성
+- [ ] 구현 (`pingConnection`, dispatchTest 외부 분기, 테스트 카운터 합산 제외)
+- [ ] TEST WORKFLOW
+- [ ] REVIEW WORKFLOW
+- [ ] spec 갱신 위임 노트 분리 (`spec-update-cafe24-test-connection.md`) — 본 PR 과 별개로 머지 가능 시점에 작성

```

---

### 파일 7: plan/in-progress/spec-update-cafe24-test-connection.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit ed11854c9a73575e9fd9e7ef27a24ea5a50b277d
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 13:58:46 2026 +0900

    feat(cafe24): connection test now pings GET /api/v2/admin/apps with 401-refresh-retry
    
    - Add Cafe24ApiClient.pingConnection — GET /api/v2/admin/apps with explicit
      refresh + 1 retry on 401 (race-condition self-recovery for stale tokens
      that proactive ensureFreshToken missed). 403 / transport failures return
      diagnostic results without flipping status or incrementing the
      consecutive_network_failures counter.
    - Add IntegrationsService.registerEntityTester — out-of-band hook so
      Cafe24Module can wire its entity-aware probe without IntegrationsModule
      ever importing from nodes/*.
    - Cafe24Module.onModuleInit registers cafe24's pingConnection so saved
      cafe24 integrations actually round-trip the API on test-connection
      instead of falling through to the structural-only success fallback.
    - Plan + spec-update note: spec §5.8 still says GET /store; the goal-stated
      endpoint is /apps. Update is deferred behind the 3 in-flight cafe24-spec
      worktree merges (consistency-checker session 13_37_23, BLOCK YES).
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/plan/in-progress/spec-update-cafe24-test-connection.md b/plan/in-progress/spec-update-cafe24-test-connection.md
new file mode 100644
index 00000000..8d5fc742
--- /dev/null
+++ b/plan/in-progress/spec-update-cafe24-test-connection.md
@@ -0,0 +1,63 @@
+---
+worktree: cafe24-test-connection-2d7fa4
+started: 2026-05-16
+owner: developer (project-planner 위임용)
+---
+
+# Spec 갱신 위임: cafe24 연결 테스트
+
+## 위임 사유
+
+`POST /api/integrations/:id/test` 의 cafe24 분기를 실 API 핑으로 구현했다 (worktree
+`cafe24-test-connection-2d7fa4`, branch `claude/cafe24-test-connection-2d7fa4`).
+spec §5.8 의 기술이 구현과 어긋나서 project-planner 가 spec 본문을 갱신해야 한다.
+
+## 머지 의존성 — **착수 전 직렬화 필수**
+
+본 spec 갱신은 다음 작업이 main 에 머지된 후 착수한다 (consistency-checker 의 plan_coherence
+checker, 2026-05-16 13:37 세션 Critical 1·2):
+
+- `cafe24-spec-sync-e2a8b9` — `spec/2-navigation/4-integration.md` 동시 수정 중
+- `cafe24-app-url-reuse-f9a2e3` — §3.2/§4.4/§6/§9/§10.2/Rationale 다수 절 수정 중
+- `prod-rereview-fix-a7c93f` — §11 전체 재구성 중 (`spec-update-cafe24-background-refresh.md`)
+
+위 3건 머지 전 본 위임을 진행하면 spec 파일에 동시 수정 충돌이 발생한다.
+
+## 갱신 대상
+
+### §5.8 "테스트 방법" 항목 (필수)
+
+**현행**:
+> **테스트 방법**: 저장된 `access_token` 으로 `GET https://{mall_id}.cafe24api.com/api/v2/admin/store` 핑.
+> 응답 200 + JSON 본문 확인.
+
+**갱신 제안**:
+> **테스트 방법**: 저장된 `access_token` 으로 `GET https://{mall_id}.cafe24api.com/api/v2/admin/apps` 핑.
+> 응답 200 + JSON 본문 확인.
+>
+> - **Endpoint 선택 근거**: `/apps` 는 자기 앱 정보 조회로, 모든 cafe24 통합이 자기 앱이므로 scope 부족
+>   위험이 가장 적다. 옛 `/store` 는 `mall.read_store` scope 가 없으면 403 으로 false negative 발생.
+> - **401 자동 회복**: 응답 401 (`access_token time expired` 등) 시 `refresh_token` 으로 access_token
+>   을 갱신한 뒤 1회 재시도. 재시도도 401 이면 `error(auth_failed)` 로 전이.
+>   §10.5 의 proactive `ensureFreshToken` 이 race condition (DB `expires_at` 미동기, 다중 인스턴스 등)
+>   으로 빗나간 경우 자가 회복하기 위함.
+> - **transport 실패는 카운터 합산 제외**: 사용자가 직접 누른 진단용 호출이므로,
+>   `Integration.consecutive_network_failures` (§14.1) 합산 대상에서 제외. 이 카운터는 노드 실행
+>   시점의 자동 호출만 합산한다.
+> - **사전 검증(`POST /api/integrations/preview-test`)** 은 단순 ping 만 수행 — 막 발급된 토큰이라
+>   refresh 가 불필요하다.
+
+### §9.1 또는 §14.1 — `pending_install` 상태 보호 (권장)
+
+`POST /api/integrations/:id/test` 에 `status='pending_install'` 인 integration 이 호출되면
+`422 INTEGRATION_INCOMPLETE` 반환. 현재 §2.2 가 UI 측면에서 버튼 비활성을 명시했으나 API 직호출
+대비 spec 누락.
+
+## 구현 위치 (참조용)
+
+- `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `pingConnection(integration)` 추가
+- `backend/src/modules/integrations/integrations.service.ts` — `dispatchTest` 외부에서 cafe24 entity-aware 분기
+
+## 처리 후
+
+본 노트를 `plan/complete/` 로 이동(`git mv`).

```

---

### 파일 8: review/consistency/2026/05/16/13_37_23/_prompts/convention_compliance.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit ed11854c9a73575e9fd9e7ef27a24ea5a50b277d
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 13:58:46 2026 +0900

    feat(cafe24): connection test now pings GET /api/v2/admin/apps with 401-refresh-retry
    
    - Add Cafe24ApiClient.pingConnection — GET /api/v2/admin/apps with explicit
      refresh + 1 retry on 401 (race-condition self-recovery for stale tokens
      that proactive ensureFreshToken missed). 403 / transport failures return
      diagnostic results without flipping status or incrementing the
      consecutive_network_failures counter.
    - Add IntegrationsService.registerEntityTester — out-of-band hook so
      Cafe24Module can wire its entity-aware probe without IntegrationsModule
      ever importing from nodes/*.
    - Cafe24Module.onModuleInit registers cafe24's pingConnection so saved
      cafe24 integrations actually round-trip the API on test-connection
      instead of falling through to the structural-only success fallback.
    - Plan + spec-update note: spec §5.8 still says GET /store; the goal-stated
      endpoint is /apps. Update is deferred behind the 3 in-flight cafe24-spec
      worktree merges (consistency-checker session 13_37_23, BLOCK YES).
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/13_37_23/_prompts/convention_compliance.md b/review/consistency/2026/05/16/13_37_23/_prompts/convention_compliance.md
new file mode 100644
index 00000000..a065af03
--- /dev/null
+++ b/review/consistency/2026/05/16/13_37_23/_prompts/convention_compliance.md
@@ -0,0 +1,332 @@
+# 정식 규약 준수 Check Payload
+
+본 파일은 orchestrator 가 정식 규약 준수 checker 용으로 작성한 입력입니다. target 문서가 정식 규약(`spec/conventions/**`) 을 따르고 있는지 분석한다.
+sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
+따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
+인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.
+
+## 점검 관점 (정식 규약 준수)
+
+1. **명명 규약** — 파일·식별자·API endpoint 명명이 conventions 규칙과 일치하는가
+2. **출력 포맷 규약** — 노드 Output, API 응답, error code 형식 등이 정식 규약을 따르는가
+3. **문서 구조 규약** — Overview / 본문 / Rationale 3섹션 권장, `_product-overview.md`·`0-` prefix 등 CLAUDE.md 의 명명 컨벤션 준수
+4. **API 문서 규약** — Swagger 패턴·request/response DTO 명명
+5. **금지 항목** — conventions 에서 명시적으로 금지한 패턴(예: 옛 prd/, memory/ 경로 사용)을 답습하고 있지 않은가
+
+## 검토 모드
+구현 착수 전 검토 (--impl-prep, scope=spec/2-navigation/4-integration.md)
+
+## Target 문서
+경로: `spec/2-navigation/4-integration.md`
+
+```
+### 구현 대상 영역: `spec/2-navigation/4-integration.md`
+(없음)
+
+```
+
+## 정식 규약 모음 (spec/conventions/)
+
+### spec/conventions 정식 규약
+
+#### `spec/conventions/cafe24-api-catalog/_overview.md`
+```
+# CONVENTION: Cafe24 API Catalog — Overview
+
+> 관련 문서: [Spec Cafe24 노드](../../4-nodes/4-integration/4-cafe24.md) · [Cafe24 API Metadata 컨벤션](../cafe24-api-metadata.md) · [Cafe24 공식 Admin API 문서](https://developers.cafe24.com/docs/ko/api/admin/)
+
+본 디렉토리(`spec/conventions/cafe24-api-catalog/`) 는 Cafe24 Admin API 의 **모든 endpoint** 를 18 resource 단위로 enumerate 한 단일 진실(single source of truth)이다. 노드 메타데이터(`backend/src/nodes/integration/cafe24/metadata/*.ts`) 가 어디까지 구현됐고 어디가 남았는지가 한 화면에서 보이도록 유지한다.
+
+---
+
+## 1. 디렉토리 구조
+
+```
+spec/conventions/cafe24-api-catalog/
+  _overview.md        # 본 문서 — 인덱스 + 컬럼 정의 + 동기 정책 + coverage matrix
+  store.md            # Store (상점) — 50+ sub-resource
+  product.md          # Product (상품)
+  order.md            # Order (주문)
+  customer.md         # Customer (회원)
+  community.md        # Community (게시판)
+  design.md           # Design (디자인)
+  promotion.md        # Promotion (프로모션)
+  application.md      # Application (앱 관리)
+  category.md         # Category (상품분류)
+  collection.md       # Collection (판매분류)
+  supply.md           # Supply (공급사)
+  shipping.md         # Shipping (배송)
+  salesreport.md      # Salesreport (매출통계)
+  personal.md         # Personal (개인화)
+  privacy.md          # Privacy (개인정보)
+  mileage.md          # Mileage (적립금)
+  notification.md     # Notification (알림)
+  translation.md      # Translation (번역)
+```
+
+resource 이름은 `Cafe24Resource` enum (`backend/src/nodes/integration/cafe24/metadata/types.ts`) 와 1:1 일치한다.
+
+## 2. 표 컬럼 정의
+
+각 resource 파일은 다음 컬럼의 표를 가진다.
+
+| 컬럼 | 필수 | 설명 |
+|------|------|------|
+| `id` | ✓ | 노드 메타데이터의 operation id. `<resource>_<verb>` 또는 `<resource>_<sub>_<verb>` (예: `product_list`, `product_options_create`). 영문 snake_case, resource 내 unique |
+| `라벨 (한)` | ✓ | UI 드롭다운에 노출되는 한국어 라벨 (예: "상품 목록 조회") |
+| `English title` | ✓ | Cafe24 공식 docs 의 영문 제목 (예: "Retrieve a list of products") |
+| `method` | supported 시 ✓ | `GET` / `POST` / `PUT` / `DELETE`. planned 시 `?` 허용 |
+| `path` | supported 시 ✓ | path template (예: `products/{product_no}`). `/api/v2/admin/` 접두는 생략. planned 시 `?` 허용 |
+| `scope` | supported 시 ✓ | `read` / `write`. `mall.<scope>_<resource>` 의 가운데 토큰. planned 시 `?` 허용 |
+| `paginated` | — | `✓` 또는 빈 칸. `paginated: true` 인 operation 만 표시 |
+| `status` | ✓ | §3 의 enum 중 하나 |
+| `docs` | ✓ | Cafe24 공식 docs anchor URL — `https://developers.cafe24.com/docs/ko/api/admin/#<anchor>` |
+
+## 3. status enum
+
+| 값 | 의미 | 백엔드 메타데이터 |
+|-----|------|------|
+| `supported` | 노드/MCP Bridge 에서 호출 가능 | `CAFE24_OPERATIONS_BY_RESOURCE[resource]` 에 row 존재 |
+| `planned` | 카탈로그에 등재만, 미구현. UI 의 Operation 드롭다운에 **disabled + "지원 예정" 배지** 로 노출 | row 없음 |
+| `deprecated` | Cafe24 가 제거 또는 deprecate 했고 우리 노드에서도 더 이상 호출 안 함 | row 없으면 정상. 있으면 마이그레이션 대상 |
+
+`planned` 행의 `method`/`path`/`scope` 가 `?` 인 경우, 구현 시점에 공식 docs 를 다시 검증한 뒤 `supported` 로 승격시키며 정확한 값으로 갱신한다.
+
+## 4. 동기 정책 (Sync Contract)
+
+본 카탈로그는 `backend/src/nodes/integration/cafe24/metadata/*.ts` 와 **양방향 동기 테스트**로 보호된다.
+
+**테스트 위치**: `backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts`
+
+**검증 규칙**:
+
+1. **`supported` row → 메타데이터 존재**: 카탈로그에 `status: supported` 로 적힌 모든 `(resource, id)` 가 `findCafe24Operation(resource, id)` 로 조회되어야 한다. 누락 시 fail.
+2. **메타데이터 → `supported` row 존재**: `CAFE24_OPERATIONS_BY_RESOURCE` 의 모든 operation 이 해당 resource 의 카탈로그에 `status: supported` 행으로 적혀 있어야 한다. 누락 시 fail.
+3. **`paginated` 일치**: `supported` row 의 `paginated` 컬럼(`✓`/공백)이 메타데이터의 `paginated: boolean` 과 일치해야 한다.
+4. **`method`/`path` 일치**: `supported` row 의 `method`·`path` 가 메타데이터와 일치.
+5. **`scope` 일치**: `supported` row 의 `scope` 가 메타데이터 `scopeType` 과 일치.
+6. **id 의 resource 내 unique**: 한 카탈로그 파일 안에 같은 `id` 가 두 번 나오면 fail.
+7. **status 가 enum 중 하나**: `supported` / `planned` / `deprecated` 외의 값이 있으면 fail.
+
+테스트는 카탈로그 MD 의 표를 파싱한다 — MD 표 구문이 깨지면 곧장 fail. 따라서 본 카탈로그는 **사람이 직접 손으로 수정하는 SoT** 이며, 코드 변경 시점에 반드시 카탈로그 동기 갱신을 함께 commit 해야 한다(`spec/conventions/cafe24-api-metadata.md` §4 의 신규 endpoint 추가 절차에 인용).
+
+## 5. Coverage Matrix
+
+2026-05-16 기준. 본 매트릭스는 카탈로그 row 수 + 메타데이터 row 수의 한 화면 요약이다 — 위 동기 테스트와 별개의 휴먼 가독성 보조 정보다. row 추가/삭제 시 본 표도 손으로 갱신한다.
+
+| Resource | Supported | Planned | Cafe24 docs sub-resource 수 |
+|----------|-----------|---------|---|
+| [store](./store.md) | 2 | 50+ | 50+ |
+| [product](./product.md) | 7 | 25+ | 28 |
+| [order](./order.md) | 6 | 40+ | 47 |
+| [customer](./customer.md) | 5 | 15+ | 12 |
+| [community](./community.md) | 3 | 25+ | 9 |
+| [design](./design.md) | 1 | 5+ | 3 |
+| [promotion](./promotion.md) | 5 | 30+ | 10 |
+| [application](./application.md) | 3 | 15+ | 8 |
+| [category](./category.md) | 6 | 15+ | 5 |
+| [collection](./collection.md) | 3 | 10+ | 5 |
+| [supply](./supply.md) | 1 | 20+ | 6 |
+| [shipping](./shipping.md) | 1 | 15+ | 5 |
+| [salesreport](./salesreport.md) | 2 | 3 | 5 |
+| [personal](./personal.md) | 2 | 3+ | 3 |
+| [privacy](./privacy.md) | 1 | 5+ | 2 |
+| [mileage](./mileage.md) | 2 | 8+ | 5 |
+| [notification](./notification.md) | 2 | 10+ | 7 |
+| [translation](./translation.md) | 1 | 8+ | 4 |
+| **합계** | **53** | **~300** | **~250** |
+
+> "Cafe24 docs sub-resource 수" 는 공식 docs 좌측 사이드바에서 본 resource 그룹 아래의 두 번째 레벨 항목 수다. 각 sub-resource 마다 통상 2~5 operation 이 존재하므로 endpoint 합계는 ~500.
+
+## 6. 신규 endpoint 등재 절차
+
+1. Cafe24 공식 문서에서 endpoint 확인.
+2. 본 카탈로그 해당 resource 파일에 표 row 추가:
+   - 처음 등재 시 `status: planned`, `method`/`path` 는 `?` 허용.
+   - 구현 PR 에서 backend 메타데이터 row 1줄 추가 + 카탈로그 row 를 `planned → supported` 로 갱신 + `method`/`path`/`scope`/`paginated` 채움.
+3. `_overview.md` §5 의 coverage matrix 카운트도 함께 갱신.
+4. `npm test --workspace backend -- catalog-sync` 통과 확인.
+
+> `spec/conventions/cafe24-api-metadata.md` §4 의 신규 endpoint 추가 절차도 본 카탈로그 row 갱신을 step 으로 포함한다.
+
+## 7. CHANGELOG
+
+| 일자 | 변경 |
+|------|------|
+| 2026-05-16 | 신규 컨벤션 — 18 resource 카탈로그 + 양방향 동기 테스트 도입. 사용자 결정(2026-05-16) "Cafe24 docs 전수 등재" 에 따라 supported 53 + planned ~300 으로 초기 채움. |
+
+```
+
+#### `spec/conventions/cafe24-api-catalog/application.md`
+```
+# Cafe24 API Catalog — Application (앱 관리)
+
+> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).
+> **주의**: 본 resource 는 Cafe24 앱 관리 API 다. 우리 서비스의 Integration `app_type` (Public/Private OAuth 앱 등록) 과 **무관** — naming collision 회피 참고.
+
+base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
+
+## 표
+
+| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
+|----|---|---|---|---|---|---|---|---|
+| `applications_list` | 설치된 앱 목록 조회 | Retrieve an app information | GET | `applications` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-app-information) |
+| `scripttags_list` | 스크립트태그 목록 조회 | Retrieve a list of script tags | GET | `scripttags` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-script-tags) |
+| `webhooks_list` | Webhook 설정 조회 | Retrieve webhook settings | GET | `webhooks` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-webhook-settings) |
+| `apps_update` | 앱 정보 수정 | Update an app information | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-app-information) |
+| `appstore_orders_get` | 앱스토어 주문 조회 | Retrieve a Cafe24 store order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retreive-a-cafe24-store-order) |
+| `appstore_orders_create` | 앱스토어 주문 생성 | Create a Cafe24 store order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-cafe24-store-order) |
+| `appstore_payments_list` | 앱스토어 결제 목록 | Retrieve a list of Cafe24 store payments | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-cafe24-store-payments) |
+| `appstore_payments_count` | 앱스토어 결제 수 | Retrieve a count of Cafe24 store payments | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-cafe24-store-payments) |
+| `databridge_logs_list` | DataBridge 로그 목록 | Retrieve a list of DataBridge webhook logs | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-databridge-webhook-logs) |
+| `recipes_list` | 레시피 목록 조회 | Retrieve a list of recipes | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-recipes) |
+| `recipes_create` | 레시피 생성 | Create a recipe | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-recipe) |
+| `recipes_delete` | 레시피 삭제 | Delete a recipe | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-recipe) |
+| `scripttags_count` | 스크립트태그 개수 조회 | Retrieve a count of script tags | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-script-tags) |
+| `scripttags_get` | 스크립트태그 단건 조회 | Retrieve a script tag | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-script-tag) |
+| `scripttags_create` | 스크립트태그 생성 | Create a script tag | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-script-tag) |
+| `scripttags_update` | 스크립트태그 수정 | Update a script tag | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-script-tag) |
+| `scripttags_delete` | 스크립트태그 삭제 | Delete a script tag | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-script-tag) |
+| `webhooks_logs_list` | Webhook 로그 목록 | Retrieve a list of webhook logs | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-webhook-logs) |
+| `webhooks_update` | Webhook 설정 수정 | Edit webhook settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-webhook-settings) |
+
+```
+
+#### `spec/conventions/cafe24-api-catalog/category.md`
+```
+# Cafe24 API Catalog — Category (상품분류)
+
+> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).
+
+base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
+
+## 표
+
+| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
+|----|---|---|---|---|---|---|---|---|
+| `category_list` | 카테고리 목록 조회 | Retrieve a list of product categories | GET | `categories` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-categories) |
+| `category_get` | 카테고리 단건 조회 | Retrieve a product category | GET | `categories/{category_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-category) |
+| `category_create` | 카테고리 생성 | Create a product category | POST | `categories` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-product-category) |
+| `category_update` | 카테고리 수정 | Update a product category | PUT | `categories/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-category) |
+| `category_delete` | 카테고리 삭제 | Delete a product category | DELETE | `categories/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product-category) |
+| `category_products_list` | 카테고리별 상품 목록 조회 | Retrieve a list of products by category | GET | `categories/{category_no}/products` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-products-by-category) |
+| `category_count` | 카테고리 개수 조회 | Retrieve a count of product categories | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-product-categories) |
+| `category_decorationimages_get` | 카테고리 꾸미기 이미지 조회 | Retrieve decoration image settings by category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-decoration-image-settings-by-category) |
+| `category_decorationimages_update` | 카테고리 꾸미기 이미지 수정 | Update decoration images of a product category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-decoration-images-of-a-product-category) |
+| `category_seo_get` | 카테고리 SEO 조회 | Retrieve SEO settings by category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-seo-settings-by-category) |
+| `category_seo_update` | 카테고리 SEO 수정 | Update a product category SEO | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-category-seo) |
+| `mains_list` | 메인 카테고리 목록 조회 | Retrieve a list of main categories | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-main-categories) |
+| `mains_add` | 메인 카테고리 추가 | Add main category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#add-main-category) |
+| `mains_update` | 메인 카테고리 수정 | Update main category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-main-category) |
+| `mains_delete` | 메인 카테고리 삭제 | Delete main category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-main-category) |
+| `autodisplay_list` | 자동 진열 목록 조회 | Retrieve a list of auto layouts | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-auto-layouts) |
+| `autodisplay_create` | 자동 진열 생성 | Create auto layout for selected product category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-auto-layout-for-selected-product-category) |
+| `autodisplay_update` | 자동 진열 수정 | Update auto layout for selected product category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-auto-layout-for-selected-product-category) |
+| `autodisplay_delete` | 자동 진열 삭제 | Delete auto layout for selected product category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-auto-layout-for-selected-product-category) |
+
+```
+
+#### `spec/conventions/cafe24-api-catalog/collection.md`
+```
+# Cafe24 API Catalog — Collection (판매분류)
+
+> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).
+
+base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
+
+## 표
+
+| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
+|----|---|---|---|---|---|---|---|---|
+| `brands_list` | 브랜드 목록 조회 | Retrieve a list of brands | GET | `brands` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-brands) |
+| `manufacturers_list` | 제조사 목록 조회 | Retrieve a list of manufacturers | GET | `manufacturers` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-manufacturers) |
+| `trends_list` | 트렌드 목록 조회 | Retrieve a list of trends | GET | `trends` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-trends) |
+| `brands_count` | 브랜드 개수 조회 | Retrieve a count of brands | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-brands) |
+| `brands_create` | 브랜드 생성 | Create a brand | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-brand) |
+| `brands_update` | 브랜드 수정 | Update a brand | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-brand) |
+| `brands_delete` | 브랜드 삭제 | Delete a brand | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-brand) |
+| `manufacturers_count` | 제조사 개수 조회 | Retrieve a count of manufacturers | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-manufacturers) |
+| `manufacturers_get` | 제조사 단건 조회 | Retrieve a manufacturer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-manufacturer) |
+| `manufacturers_create` | 제조사 생성 | Create a manufacturer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-manufacturer) |
+| `manufacturers_update` | 제조사 수정 | Update a manufacturer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-manufacturer) |
+| `trends_count` | 트렌드 개수 조회 | Retrieve a count of trends | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-trends) |
+| `classifications_list` | 사용자 정의 카테고리 목록 | Retrieve a list of custom categories | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-custom-categories) |
+| `classifications_count` | 사용자 정의 카테고리 수 | Retrieve a count of custom categories | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-custom-categories) |
+| `origin_list` | 원산지 목록 조회 | Retrieve a list of origins | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-origins) |
+
+```
+
+#### `spec/conventions/cafe24-api-catalog/community.md`
+```
+# Cafe24 API Catalog — Community (게시판)
+
+> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).
+
+base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
+
+## 표
+
+| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
+|----|---|---|---|---|---|---|---|---|
+| `boards_list` | 게시판 목록 조회 | Retrieve a list of boards | GET | `boards` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-boards) |
+| `board_articles_list` | 게시판 글 목록 조회 | Retrieve a list of posts for a board | GET | `boards/{board_no}/articles` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-posts-for-a-board) |
+| `board_article_get` | 게시판 글 단건 조회 | Retrieve a list of posts for a board (single) | GET | `boards/{board_no}/articles/{article_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-posts-for-a-board) |
+| `boards_settings_get` | 게시판 설정 조회 | Retrieve the board settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-board-settings) |
+| `boards_settings_update` | 게시판 설정 수정 | Update the board settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-the-board-settings) |
+| `board_articles_create` | 게시판 글 작성 | Create a board post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-board-post) |
+| `board_articles_update` | 게시판 글 수정 | Update a board post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-board-post) |
+| `board_articles_delete` | 게시판 글 삭제 | Delete a board post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-board-post) |
+| `board_articles_comments_list` | 게시판 댓글 목록 | Retrieve a list of comments for a board post | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-comments-for-a-board-post) |
+| `board_articles_comments_create` | 게시판 댓글 작성 | Create a comment for a board post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-comment-for-a-board-post) |
+| `board_articles_comments_delete` | 게시판 댓글 삭제 | Delete a comment for a board post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-comment-for-a-board-post) |
+| `boards_comments_bulk` | 게시판 댓글 일괄 조회 | Retrieve comments in bulk | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-comments-in-bulk) |
+| `boards_seo_get` | 게시판 SEO 조회 | Retrieve SEO settings for board | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-seo-settings-for-board) |
+| `boards_seo_update` | 게시판 SEO 수정 | Update SEO settings for board | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-seo-settings-for-board) |
+| `commenttemplates_list` | 자주 쓰는 답변 목록 | Retrieve frequently used answers | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-frequently-used-answers) |
+| `commenttemplates_get` | 자주 쓰는 답변 단건 | Retrieve a frequently used answer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-frequently-used-answer) |
+| `commenttemplates_create` | 자주 쓰는 답변 생성 | Create a frequently used answer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-frequently-used-answer) |
+| `commenttemplates_update` | 자주 쓰는 답변 수정 | Update a frequently used answer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-frequently-used-answer) |
+| `commenttemplates_delete` | 자주 쓰는 답변 삭제 | Delete a frequently used answer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-frequently-used-answer) |
+| `financials_monthlyreviews_count` | 월별 후기 카운트 | Retrieve the total count for monthly reviews and ratings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-total-count-for-monthly-reviews-and-ratings) |
+| `urgentinquiry_get` | 긴급 문의 게시글 조회 | Retrieve an urgent inquiry post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-urgent-inquiry-post) |
+| `urgentinquiry_reply_get` | 긴급 문의 답변 조회 | Retrieve a reply for urgent inquiry post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-reply-for-urgent-inquiry-post) |
+| `urgentinquiry_reply_create` | 긴급 문의 답변 작성 | Create a reply for urgent inquiry post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-reply-for-urgent-inquiry-post) |
+| `urgentinquiry_reply_update` | 긴급 문의 답변 수정 | Update a reply for urgent inquiry post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-reply-for-urgent-inquiry-post) |
+
+```
+
+#### `spec/conventions/cafe24-api-catalog/customer.md`
+```
+# Cafe24 API Catalog — Customer (회원)
+
+> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).
+
+base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
+
+## 표
+
+| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
+|----|---|---|---|---|---|---|---|---|
+| `customer_list` | 회원 목록 조회 | Retrieve a list of customers | GET | `customers` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers) |
+| `customer_get` | 회원 단건 조회 | Retrieve a list of customers (single) | GET | `customers/{member_id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers) |
+| `customer_update` | 회원 정보 수정 | Update a customer | PUT | `customers/{member_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers) |
+| `customer_group_update` | 회원 등급 변경 | Update a customer's customer tier | PUT | `customergroups/customers` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-s-customer-tier) |
+| `customer_memos_create` | 회원 메모 작성 | Create a customer memo | POST | `customers/{member_id}/memos` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-customer-memo) |
+| `customer_delete` | 회원 탈퇴 처리 | Delete an account | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-account) |
+| `customer_autoupdate_get` | 회원 등급 자동 갱신 조회 | Retrieve customer tier auto-update details | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-customer-tier-auto-update-details) |
+| `customer_memos_count` | 회원 메모 개수 | Retrieve a count of customer memos | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-memos) |
+| `customer_memos_list` | 회원 메모 목록 | Retrieve a list of customer memos | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-memos) |
+| `customer_memos_get` | 회원 메모 단건 조회 | Retrieve a customer memo | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-memo) |
+| `customer_memos_update` | 회원 메모 수정 | Update a customer memo | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-memo) |
+| `customer_memos_delete` | 회원 메모 삭제 | Delete a customer memo | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-customer-memo) |
+| `customer_paymentinfo_list` | 회원 결제수단 목록 | Retrieve a customer's list of payment methods | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-s-list-of-payment-methods) |
+| `customer_paymentinfo_delete` | 회원 결제수단 삭제 | Delete customer's payment information | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-customer-s-payment-information) |
+| `customer_paymentinfo_delete_by_id` | 회원 결제수단 ID 삭제 | Delete customer's payment information by payment method ID | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-customer-s-payment-information-by-payment-method-id) |
+| `customer_plusapp_get` | Plus 앱 설치 정보 조회 | Retrieve app installation information | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-app-installation-information) |
+| `customer_social_get` | 소셜 계정 조회 | Retrieve a customer's social account | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-s-social-account) |
+| `customers_properties_view` | 회원가입 필드 조회 | View account signup fields | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#view-account-signup-fields) |
+| `customers_properties_edit` | 회원가입 필드 수정 | Edit account signup fields | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-account-signup-fields) |
+| `social_list` | 소셜 연동 목록 | List all social | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#list-all-social) |
+| `customergroups_list` | 회원 등급 목록 | Retrieve a list of customer tiers | ? | ? | ? | ✓ | planned | [↗](https://d
+
+... (truncated due to size limit) ...

```

---

### 파일 9: review/consistency/2026/05/16/13_37_23/_prompts/cross_spec.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 10: review/consistency/2026/05/16/13_37_23/_prompts/naming_collision.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 11: review/consistency/2026/05/16/13_37_23/_prompts/plan_coherence.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 12: review/consistency/2026/05/16/13_37_23/_prompts/rationale_continuity.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit ed11854c9a73575e9fd9e7ef27a24ea5a50b277d
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 13:58:46 2026 +0900

    feat(cafe24): connection test now pings GET /api/v2/admin/apps with 401-refresh-retry
    
    - Add Cafe24ApiClient.pingConnection — GET /api/v2/admin/apps with explicit
      refresh + 1 retry on 401 (race-condition self-recovery for stale tokens
      that proactive ensureFreshToken missed). 403 / transport failures return
      diagnostic results without flipping status or incrementing the
      consecutive_network_failures counter.
    - Add IntegrationsService.registerEntityTester — out-of-band hook so
      Cafe24Module can wire its entity-aware probe without IntegrationsModule
      ever importing from nodes/*.
    - Cafe24Module.onModuleInit registers cafe24's pingConnection so saved
      cafe24 integrations actually round-trip the API on test-connection
      instead of falling through to the structural-only success fallback.
    - Plan + spec-update note: spec §5.8 still says GET /store; the goal-stated
      endpoint is /apps. Update is deferred behind the 3 in-flight cafe24-spec
      worktree merges (consistency-checker session 13_37_23, BLOCK YES).
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/13_37_23/_prompts/rationale_continuity.md b/review/consistency/2026/05/16/13_37_23/_prompts/rationale_continuity.md
new file mode 100644
index 00000000..3b2c71d5
--- /dev/null
+++ b/review/consistency/2026/05/16/13_37_23/_prompts/rationale_continuity.md
@@ -0,0 +1,541 @@
+# Rationale 연속성 Check Payload
+
+본 파일은 orchestrator 가 Rationale 연속성 checker 용으로 작성한 입력입니다. target 문서가 기존 spec 의 `## Rationale` 에서 이미 기각·폐기된 결정을 다시 도입하거나 합의 원칙을 무시하지 않는지 분석한다.
+sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
+따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
+인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.
+
+## 점검 관점 (Rationale 연속성)
+
+1. **기각된 대안의 재도입** — target 이 과거 Rationale 에서 명시적으로 거부한 대안을 다시 채택하고 있는가 (이유 명시 없이)
+2. **합의된 원칙 위반** — Rationale 에 박혀있는 설계 원칙을 따르지 않고 있는가
+3. **결정의 무근거 번복** — 과거 결정을 뒤집으면서 새 Rationale 를 함께 작성하지 않고 있는가
+4. **암묵적 가정 충돌** — Rationale 에 기록된 시스템 invariant 를 우회하는 설계가 들어와 있는가
+
+## 검토 모드
+구현 착수 전 검토 (--impl-prep, scope=spec/2-navigation/4-integration.md)
+
+## Target 문서
+경로: `spec/2-navigation/4-integration.md`
+
+```
+### 구현 대상 영역: `spec/2-navigation/4-integration.md`
+(없음)
+
+```
+
+## 관련 Rationale 발췌
+
+### Rationale 발췌
+
+#### `spec/1-data-model.md` 의 Rationale
+
+## Rationale
+
+### Execution.execution_path → ExecutionNodeLog (V035 → V036)
+
+옛 `execution.execution_path UUID[]` 컬럼은 단일 인스턴스 환경에서는 동작했으나, 다중 backend 인스턴스가 동시에 `array_append()` 로 갱신할 때 인스턴스 간 절대 순서가 보장되지 않았다. 대체 모델로 append-only 테이블 `execution_node_log` 를 도입했고, BIGSERIAL `id` 가 PostgreSQL sequence (concurrency-safe) 로 부여되므로 `(execution_id, id)` 정렬이 곧 노드 실행 순서가 된다.
+
+이행은 lock 영향 최소화를 위해 두 단계로 분리되었다.
+
+- `backend/migrations/V035__execution_node_log_create.sql` — 테이블 생성 + `UNNEST WITH ORDINALITY` 로 기존 array 데이터 이행. `executeInTransaction=false`.
+- `backend/migrations/V036__execution_drop_execution_path.sql` — 컬럼 DROP. `lock_timeout=3s` 로 운영 영향 최소화.
+
+설계·운영 세부는 [`spec/5-system/4-execution-engine.md §7.4`](./5-system/4-execution-engine.md) 참고. 외부 API 응답의 `executionPath: string[]` 시그니처는 유지되며, `findById` 가 본 테이블의 정렬 쿼리로 채운다.
+
+### install_token 형식 (32byte hex → 16byte base64url, 2026-05-15)
+
+옛 32바이트 hex (64자) 는 Cafe24 Developers App URL 입력 필드의 100자 한도를 path prefix 단축만으로는 못 맞춰 함께 단축. 16바이트 (128-bit) 면 capability token 으로 NIST/OWASP 권장 (96-bit 이상) 을 충분히 상회. DB 컬럼 `install_token` 은 `String?` 으로 길이 제약이 없어 schema 변경 불필요 — 마이그레이션 entry 신규 추가 없음. 상세 배경·대안 비교는 [Spec 통합 화면 §9.2 Rationale "Cafe24 App URL 100자 한도 대응" 항](./2-navigation/4-integration.md#rationale).
+
+#### `spec/2-navigation/1-workflow-list.md` 의 Rationale
+
+## Rationale
+
+### 1. "공유 워크플로우" 의 정의 — 팀 워크스페이스 전체
+
+NAV-WF-07 의 "공유" 기준으로 두 옵션을 검토했다:
+
+- (a) **팀 워크스페이스에 속한 모든 워크플로우** = 공유 (선택)
+- (b) `createdBy ≠ 현재 사용자` 또는 명시적 sharedWith 컬럼 = 공유 (폐기)
+
+(a) 를 채택한 이유:
+
+- PRD 의 NAV-WF-07 원문("팀 워크스페이스에서 공유된 워크플로우 구분 표시")이 워크스페이스 단위의 격리·공유를 전제로 하고 있어, 워크스페이스 = 공유 단위라는 정의와 자연스럽게 부합한다.
+- 데이터 모델상 워크플로우 격리는 이미 `workspaceId` 로 처리되며(`backend/src/modules/workflows/entities/workflow.entity.ts`), `sharedWith` 컬럼이나 추가 마이그레이션 없이 구현 가능하다.
+- (b) 는 같은 팀 안에서 "내 것" 과 "남의 것" 을 다시 분리하는 정의지만, 그 구분은 §2.3 의 **소유 필터** 가 담당하므로 뱃지에서까지 중복으로 표현할 필요가 없다.
+
+결과적으로 뱃지(워크스페이스 = 공유)와 필터(작성자 단위 세분화)가 역할 분담된다.
+
+#### `spec/2-navigation/10-auth-flow.md` 의 Rationale
+
+## Rationale
+
+### R-1. 인증 화면 배경 — 그라데이션 복원 (2026-05-15 롤백)
+
+§1 배경 기술을 *"제품 브랜드 색상 또는 그래디언트"* (main 표현) 로 **복원**. 이전 Stage 1 (commit `b6267429`) 에서 *"`soil-50` 단색, 그라데이션 금지"* 로 구체화했으나, 동일자 §8 부분 롤백 (`spec/6-brand.md` R-13) 에서 `soil-50` 토큰이 §8.2 와 함께 폐기되어 본 표현도 함께 복원했다.
+
+코드 상태: `frontend/src/app/(auth)/layout.tsx` 는 `bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--muted))] to-[hsl(var(--background))]` 패턴 — Shadcn neutral 그라데이션. 로고는 `#111e14` 라운드 컨테이너 안에 별도 배치 (그라데이션 위 dark surface 로 시인성 확보).
+
+### R-2. `[Logo]` 자리 변종 명시 (2026-05-15 정정)
+
+§1 의 `[Logo]` 플레이스홀더에 *"Full logo 변종 사용"* 명시. 이전 Stage 1 에서는 *"Full logo (light)"* 로 라이트 한정했으나, §8 부분 롤백 (`spec/6-brand.md` R-13) 에서 라이트/다크 자산 선택을 노출 자리의 surface 톤에 위임하는 형태로 바뀌어 본 행에서도 라이트 한정을 제거.
+
+본 문서는 로고가 노출되는 **자리**를 정의하고, 자리에 들어가는 변종·라이트/다크 선택은 brand spec §8.4.1 매트릭스 + §8.4.6 의 노출 자리 규정을 따른다 (R-9 — 브랜드 spec 의 라우트 spec 우선권).
+
+근거 출처: `spec/6-brand.md §8.4.1`, `§8.4.6`, `R-13`. 사전 일관성 검토 세션: `review/consistency/2026/05/15/18_36_51/` (Stage 1), `review/consistency/2026/05/15/23_45_11/` (롤백).
+
+#### `spec/2-navigation/4-integration.md` 의 Rationale
+
+## Rationale
+
+### Cafe24 Private 앱의 callback 실패는 왜 status 를 보존하나 (2026-05-14)
+
+`pending_install` 상태의 Integration 이 callback 처리 중 token exchange 실패 등으로 떨어졌을 때, 자연스러운 선택지는 `error(auth_failed)` 로 전이하는 것이다. 그러나 Private 앱은 `reauthorize` 액션이 불가능하다 — OAuth 재시작은 **Cafe24 Developers 의 "테스트 실행"** 만 정식 진입점이고, 그 진입점은 우리가 발급한 `install_token` 을 path 에 그대로 사용한다. status 를 `error` 로 바꾸면 (a) UI 가 "reauthorize" 액션을 권장하지만 실제로 그 액션이 무력하고, (b) 사용자는 cafe24 측 설정을 고친 뒤 다시 "테스트 실행" 을 누르는 외부 흐름을 진행 중인데 우리 화면이 이를 "error" 로 표기해 흐름 단계를 오인하게 된다. 따라서 callback 실패는 `status_reason` + `last_error` 만 채우고 status 는 `pending_install` 그대로 유지한다. (참고: `review/consistency/2026/05/14/18_23_55`)
+
+`status_reason` 의 저장값은 callback 에러 코드를 `snake_case` 로 표기한다 — DB 컬럼 컨벤션 전체가 `auth_failed`, `token_expired` 등 `snake_case` 인 것과 통일. 한편 API 응답·callback HTML 의 에러 코드는 `OAUTH_*`, `CAFE24_*` 같은 `UPPER_SNAKE_CASE` 를 유지한다 (HTTP 컨벤션). 동일 의미 두 표기는 §10.4 에서 매핑.
+
+`last_error.code` 와 `status_reason` 이 같은 값을 중복 보존하는 이유: `last_error` 는 JSONB 라 보존 정책(향후 GDPR 등)에 따라 소거될 수 있다. `status_reason` 은 plain string 컬럼으로 더 가볍게 유지되며, "왜 이 상태에 있는지" 의 핵심 신호로 보존된다. `status_reason` 은 에러 분류 코드만 담아 민감 정보 미포함 → 평문 저장.
+
+### OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유 (2026-05-14)
+
+Cafe24 Private 의 "테스트 실행" 흐름은 `pending_install` 행이 이미 존재하는 상태에서 OAuthState 를 새로 발급해 token 교환을 완료한다 — 의미상 "기존 행에 token 을 채운다" 라는 점에서 `mode='reauthorize'` 와 동일 (`mode='new'` 는 OAuthState 에 integrationId 가 없고 callback 이 previewToken 을 발급하는 다른 흐름). 별도 `mode='cafe24_private_install'` 을 신설하는 안도 검토했으나, callback 의 처리 분기가 동일 (integration row UPDATE) 이고 §10.2 step 4 가 이미 reauthorize 를 "기존 integrationId 의 credentials 갱신" 으로 정의하고 있어 enum 확장으로 얻는 이득이 없다. status 가 `pending_install` 이냐 `connected` 이냐에 따라 callback 의 후처리만 살짝 다를 뿐 (`installToken=null` 처리 등). 단, 향후 reauthorize 와 분리해야 할 동작이 늘어나면 별도 mode 신설 검토.
+
+### CAFE24_PRIVATE_APP_ALREADY_CONNECTED 의 mall_id 비교 경로 (2026-05-15 갱신)
+
+**현행 (V045+)**: `mall_id` 가 plain 컬럼 (`integration.mall_id`) 으로 분리되어 — `credentials.mall_id` (encrypted JSONB) 와 동일 값을 plain 컬럼으로 복제 — SQL WHERE 절로 직접 필터링·UNIQUE 제약 강제가 가능. 부분 UNIQUE 인덱스 `(workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL` 이 같은 workspace 내 중복 cafe24 통합 생성을 SQL constraint violation 으로 거부 (TOCTOU race 차단). begin 핸들러는 in-memory 사전 체크 (connected → 409 / pending → reuse 분기 판단) 와 함께 SQL UNIQUE 를 backstop 으로 사용 — 두 검사를 모두 통과한 동시 INSERT 는 `23505 unique_violation` 으로 변환되어 같은 409 응답을 받는다.
+
+**옛 (V045 이전, 2026-05-14)**: `mall_id` 가 암호화 JSONB 안에만 있어 SQL 필터 불가. begin 시점에 (a) 동일 workspace 의 cafe24 통합을 SQL 로 조회한 뒤 (b) ORM 경계의 자동 복호화로 `credentials.mall_id` 와 in-memory 비교. (a) O(N) decrypt 비용 + (b) SELECT 와 INSERT 사이의 TOCTOU 윈도우 두 가지 운영 위험.
+
+**전환기**: V045 이전 행은 `mall_id` 컬럼이 NULL — 부분 UNIQUE 가 그런 행을 비교 대상에서 제외하므로 새 행과 충돌하지 않는다. 옛 행은 callback / re-auth 시점에 plain 컬럼이 backfill 되어 점진적으로 인덱스 범위로 편입된다. begin 시점의 in-memory 비교도 동일 전환기 동안 `credentials.mall_id` fallback 을 둔다.
+
+### install_token 을 App URL path 식별 키로 승격 (2026-05-14)
+
+원래 설계는 `GET /oauth/install/cafe24` 가 mall_id + HMAC 만 받고, 백엔드가 `pending_install` 행을 in-memory 로 100건 스캔하면서 mall_id 일치 candidates 의 client_secret 으로 HMAC 검증을 trial 했다. 두 가지 운영 위험이 누적됐다 — (a) 동일 mall_id 의 중복 `pending_install` 이 누적되면 HMAC 매칭이 비결정적이고 사용자가 보고 있는 행이 아닌 다른 행이 connected 처리될 수 있다, (b) `pending_install` 수가 커지면 O(N) 매칭 비용. App URL path 에 `install_token` 을 박으면 단일 row 조회로 고정되고, 토큰 자체가 random 이므로 추측 불가능한 식별자 역할도 겸한다. 옛 토큰 없는 경로는 별도 PR 로 즉시 제거됐다 (운영 등록자 0 인 시점에 정리 — 이후 등록자는 새 token-pathed URL 만 발급받는다).
+
+(2026-05-15 후속: 토큰을 16바이트 base64url 22자로 단축 — 보안 동등성은 본 섹션 "Cafe24 App URL 100자 한도 대응" 항 참조)
+
+`install_token` 은 App URL path 에 공개 포함되는 식별자로 평문 저장 — credentials/last_error 암호화 정책 대상 아님.
+
+### CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제 (2026-05-14)
+
+옛 `CAFE24_INSTALL_INVALID_HMAC(403, pending 미발견 포함)` 합산 정책은 토큰이 path 에 없던 시절 "어느 mall_id 에 pending 이 있는지" 정보가 응답 코드로 새지 않게 하는 안전망이었다. 새 디자인에서 `install_token` 은 **128-bit 이상 random** (현행 16바이트 base64url, 2026-05-15 단축 이전엔 32바이트 hex 256-bit) 이라 추측 불가능 — URL path 자체가 capability token 처럼 동작한다. 이 전제 하에서 "토큰 미존재" 케이스를 `CAFE24_INSTALL_INVALID_TOKEN(404)` 로 분리해도 무의미한 enumeration 이 일어나지 않는다. **이 전제가 깨지면** (예: **96-bit (12바이트) 미만으로의 토큰 길이 단축**, PRNG 변경, install_token 노출 사고) 다시 403 으로 통합해야 한다.
+
+### install_token TTL 24h (2026-05-14)
+
+**기존 spec §6 는 install timeout 시 `→ (삭제)` 를 명시했으나 본 개정에서 `→ expired (status_reason='install_timeout')` 로 번복한다.** 이유: 데이터 분석·감사 목적으로 보존이 유리하고, 사용자가 만료된 행을 보고 "왜 install 이 안 됐는지" 를 진단할 단서가 남아야 함. 자동 삭제는 더 이상 일어나지 않으며, manual delete 만 삭제 경로다.
+
+Cafe24 Developers 의 앱 등록 → "테스트 실행" 까지의 사용자 작업 텀을 최대 1일로 가정한다. 더 길면 stale `pending_install` 행이 누적되어 §9.2 의 식별 키 룩업 성능과 §2.4 attention 카운트에 잡음. 더 짧으면 정상 흐름이 끊긴다 (사용자가 점심·미팅·휴일 사이클에 작업이 분할되기 쉬움). 24h 가 지나면 `status='expired'`, `status_reason='install_timeout'`, `install_token=NULL` 로 자동 전이. 만료된 행은 데이터 분석·감사 목적으로 삭제하지 않고 보존한다 (manual delete 별도).
+
+**TTL 기준 (2026-05-15 갱신)**: `install_token_issued_at` 컬럼 (V044) 을 기준으로 한다 — `created_at` 이 아닌 토큰 발급 시각. 변경 3 (중복 pending_install 재사용) 으로 같은 mall_id 의 begin 재호출이 기존 row 의 install_token 만 갱신할 때, 새 토큰이 발급되자마자 24h 카운트가 끝나 있는 문제를 해소. callback 성공 시 `install_token` 과 함께 `install_token_issued_at` 도 NULL 로 비워진다. 옛 (V044 이전) 행은 NULL — 스캐너 SQL 이 `COALESCE(install_token_issued_at, created_at)` 로 fallback 해 legacy 의미를 유지.
+
+`status_reason='install_timeout'` 인 expired 행에서는 reauthorize 버튼이 **비활성** 이다 — Private 앱은 재인증 진입점이 없고 cafe24 "테스트 실행" 만 정식이다. 사용자는 행을 삭제 후 새로 등록한다.
+
+### status_reason `oauth_token_exchange_failed` 와 auth 도메인의 `token_exchange_failed` 구분 (2026-05-14)
+
+소셜 로그인 흐름(`spec/2-navigation/10-auth-flow.md`) 의 URL param `error=token_exchange_failed` 와 본 spec 의 통합 callback `status_reason='oauth_token_exchange_failed'` 는 도메인이 다른 별개 신호다 — 전자는 user authentication 도메인, 후자는 integration credentials 도메인. 의도적으로 prefix `oauth_` 를 두어 grep·index 시 도메인 구분이 자명하도록 분리했다. 이름은 통일하지 않는다.
+
+### Cafe24 Private 의 `connected → error(auth_failed)` 복구 경로 (2026-05-14, 2026-05-16 갱신)
+
+일반 OAuth provider 는 `expired → connected` 가 reauthorize 또는 자동 refresh 로 복구된다 (§6 / data-flow §3.1). **Cafe24 Private 앱은 reauthorize 진입점이 없고**, refresh 도 token endpoint 가 mall 별이라 일반 흐름이긴 하지만 만약 refresh 가 실패해 `error(auth_failed)` 로 떨어지면 **복구 유일 경로는 삭제 후 재등록** 이다. 이건 Private 앱의 구조적 제약 (우리 서버가 OAuth 를 시작할 수 없음) 의 당연한 귀결이며, §6 전이 표의 `expired/error → connected (reauthorize)` 항은 Cafe24 Private 에는 적용되지 않음. UI 의 reauthorize 버튼 비활성 (§4.2) 이 이 사실을 반영한다.
+
+> **(2026-05-16 갱신)** 옛 표기는 `expired(refresh_failed)` 였으나 REQ HIGH-2 로 refresh 실패 전이가 `error(auth_failed)` 로 통일됨 — [Rationale "refresh 실패 시 status_reason 통일"](#refresh-실패-시-status_reason-통일-2026-05-16) 참고. 본문은 새 status 명을 사용하지만 복구 경로의 본질 (삭제 후 재등록) 은 변경 없음.
+
+### `pending_install` 은 필터 칩에 추가하지 않는다 (2026-05-14)
+
+§2.3 상태 필터 칩은 `Connected / Expiring / Expired / Error` 4종 + All 로 운영된다. `Pending install` 은 사용자가 외부 흐름(Cafe24 Developers) 을 진행 중인 **정상 전환 상태** 로 보고 필터 칩에 추가하지 않는다. 별도 필터링 수요가 발생하면 후속 plan 으로 추가 검토.
+
+### Cafe24 App URL 100자 한도 대응 — `/api/3rd-party/<provider>/` namespace 도입 (2026-05-15)
+
+운영 사용자가 Cafe24 Developers 의 앱 URL 입력 필드에서 "허용 길이 초과" 경고를 받아 Private 앱 연동이 막혔다. 수동 테스트 결과 100자 제한이며, 호스트 변동 가능성까지 감안해 90자를 마지노선으로 잡았다. 현행 `/api/integrations/oauth/install/cafe24/<64-hex>` 은 호스트 32자 가정 135자로 한도 초과.
+
+**두 부분을 모두 단축**:
+
+- **path namespace**: `/api/integrations/oauth/install/cafe24/...` (39자) → `/api/3rd-party/cafe24/install/...` (30자). 옛 namespace 는 "사용자가 호출하는 통합 관리 API" 와 "3rd party 가 호출하는 콜백·설치 API" 가 한 prefix 에 섞여 있던 구조. 3rd-party 의미가 명확한 prefix 로 분리하면 IP allowlist · rate limit · 미래 webhook receiver 같은 per-provider 처리가 sub-tree 단위로 모인다.
+- **install_token**: 32바이트 hex (64자) → 16바이트 base64url no-padding (22자). 128-bit 엔트로피는 capability token 으로 충분 (NIST SP 800-63B §A.7 권장 96-bit 이상, OWASP capability token 가이드 128-bit 권장). 옛 256-bit 는 과잉.
+
+**provider-grouped vs action-grouped**: `/api/3rd-party/cafe24/install/:token` (provider-grouped) 대신 `/api/3rd-party/install/cafe24/:token` (action-grouped) 도 검토. 두 안 모두 길이 동일. provider-grouped 채택 이유 — (a) 향후 Cafe24 webhook receiver 등을 추가할 때 `/api/3rd-party/cafe24/webhook` 처럼 같은 sub-tree 에 모임. action-grouped 면 webhook 이 또 다른 top-level segment 가 되어 비일관. (b) 새 provider 가 들어올 때 모듈 단위 (`Cafe24ThirdPartyController` 등) 매핑이 자연스럽다. (c) per-provider 미들웨어 (IP allowlist 등) prefix 가 한 곳.
+
+**google/github callback 도 동시 이동**: cafe24 만 옮기면 callback 경로가 provider 별로 갈라져 비대칭 (`/api/3rd-party/cafe24/callback` vs `/api/integrations/oauth/callback/google`). 일관성 우선 + OAuth 콘솔 재등록을 한 번에 마치는 편이 운영상 깔끔. 운영 영향: Google Cloud Console / GitHub OAuth App / Cafe24 Developers 모두 새 redirect URI 등록 필요 (배포와 동시). 사용자 소셜 로그인용 redirect URI (`/api/auth/oauth/:provider/callback`) 는 **별개로 유지** — 두 URI 가 같은 OAuth 콘솔에 공존한다 (§10.1 참고 노트 참조).
+
+**callback URL 표기 컨벤션**: spec 본문·표·다이어그램은 모두 파라메트릭 단일 형식 `/api/3rd-party/:provider/callback` (`:provider ∈ {cafe24, google, github}`) 만 사용한다. 컨트롤러 구현이 provider 별 분리 (3개) 인지 파라메트릭 (1개) 인지는 구현 plan 의 결정 사항.
+
+**옛 경로 미보전**: `/api/integrations/oauth/install/cafe24/:installToken` 및 `/api/integrations/oauth/callback/:provider` 핸들러는 즉시 제거. 운영자에게 OAuth 콘솔 갱신이 강제로 가시화되는 편이 누락 없이 안전. 이전 동일 패턴 (2026-05-14, 토큰 없는 경로 즉시 제거) 의 선례를 따른다. 옛 토큰 없는 `/api/integrations/oauth/install/cafe24` 의 410 Gone hint 라우트는 현재 코드에 존재하지 않으며 (followup plan 의 가설적 항목이었음), 본 PR 의 변경과 무관.
+
+**기존 `pending_install` 행 마이그레이션 생략**: 옛 64자 hex 토큰을 가진 행은 이미 옛 라우트와 결속되어 있고, 새 라우트는 22자 base64url 만 발급한다. 새 라우트로 호출 자체가 path-format mismatch 로 404 가 되므로 자연 만료 (24h install_timeout 스캐너) 에 맡긴다. 실제 영향 범위는 보고된 사례 자체가 "길이 초과로 등록 못 함" 상태였으므로 거의 0.
+
+### Cafe24 App URL 재호출 흐름 — install_token persistent 격상 (2026-05-15)
+
+Cafe24 Developers Console 에 등록한 App URL 은 **두 가지 진입점** 모두에서 호출된다 — ① 초기 install (테스트 실행), ② **post-install navigation** (카페24 쇼핑몰 관리자의 "앱으로 가기" 버튼). ②번이 새로 발견된 요구사항으로, 옛 spec 의 single-use 가정 (callback 성공 시 `installToken=NULL` 소거) 과 충돌해 운영 사용자가 "앱으로 가기" 클릭 시 `404 CAFE24_INSTALL_INVALID_TOKEN` 을 받았다 (2026-05-15 사용자 보고).
+
+**결정**: `install_token` 을 통합 lifetime 동안 보존되는 persistent identifier 로 격상.
+
+- `pending_install → connected` 전이 시 token 보존 (옛: NULL 처리 → 새: 그대로).
+- `handleInstall` 이 status 분기 — `pending_install` → OAuth authorize, `connected`/`error(*)`/`expired` → 우리 frontend redirect.
+- HMAC 검증은 두 분기 모두 유지 (Cafe24 출처 보증).
+- V045 partial UNIQUE `(install_token) WHERE install_token IS NOT NULL` 은 변경 없음 — 한 워크스페이스 안에서 같은 token 이 한 row 에만 매핑되는 invariant 보존.
+
+**옛 connected 행 호환**: 본 변경 이전에 connected 로 전환되어 token 이 이미 NULL 인 통합은 새 동작이 작동하지 않는다 ("앱으로 가기" 클릭 시 여전히 404). 마이그레이션 plan 없이 자연 해소 — 사용자가 통합을 삭제 후 재등록하면 새 token 이 발급되고 새 동작 적용. 옛 행을 위해 추가 마이그레이션 비용을 들이지 않는 이유는 (a) Cafe24 Private 통합 사용자 수가 적고, (b) 재등록 비용이 SQL 마이그레이션 작성·테스트 비용보다 낮으며, (c) 옛 행의 client_secret 이 credentials 에 그대로 있어 token 재발급 자체는 가능하나 그 시점부터 다시 "테스트 실행" 부터 시작해야 하므로 결국 사용자 작업이 필요해 자동화 가치가 낮다.
+
+**NULL 처리 유지 경로**: `pending_install → expired (install_timeout)` 의 24h TTL 만료는 token 을 NULL 로 소거 유지 — 사용자가 새 통합을 등록해야 하므로 옛 token 무효화가 정당. 통합 삭제 시도 row 삭제로 token 자동 소멸.
+
+**post-install navigation 의 redirect target**: `${FRONTEND_URL}/integrations/<id>` 로 통일. 사용자가 카페24 admin 에서 우리 앱으로 들어올 때 그 통합의 상태·diagnostic 을 바로 확인할 수 있는 화면. 단순 `${FRONTEND_URL}/` 으로의 redirect 도 검토했으나 (워크플로 목록 등) 통합 컨텍스트 보존이 더 유익.
+
+### Cafe24 Private request-scopes 흐름 (2026-05-15)
+
+cafe24 Private 의 OAuth 시작은 우리 서버가 할 수 없어 `mode='reauthorize'` 에서 begin 이 `CAFE24_PRIVATE_APP_USE_TEST_RUN` 으로 거부한다. 옛 `/request-scopes` 는 내부적으로 begin 을 호출하며 mode `request_scopes` 도 같은 거부 분기에 걸려 동작 불가였다 (2026-05-15 운영 사용자 보고 — `CAFE24_INVALID_MALL_ID` 가 noise, 실제로는 Private 흐름이 막혀 있는 본질적 문제). 또한 옛 requestScopes 는 `entity.credentials.mall_id` 를 providerMeta 로 전달하지 않아 begin 의 cafe24 검증부가 missing mall_id 로 reject 도 함께 발생.
+
+**결정**: `requestScopes` 가 cafe24 Private 을 감지하면 begin 우회 — 기존 `installToken` 보존 + `credentials.scopes` merge 갱신 + `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded }` 응답. 사용자가 Cafe24 Developers 의 앱 권한에서 추가 scope 활성화 후 "테스트 실행" 누르면 기존 install handler 가 작동 → callback → token 의 scope 가 확장된 새 token 으로 교체된다.
+
+**왜 begin 우회인가**: begin 의 Private 거부는 정당 (OAuth 시작 불가). request-scopes 는 본질적으로 "OAuth 재시작 + 확장 scope" 인데, Private 에서는 Cafe24 측 진입점만 정식이므로 우리 화면은 안내만 담당. credentials.scopes merge 는 install handler 의 `OAuthState.requestedScopes` 채움에 영향을 주므로 사전에 갱신해 둔다.
+
+**`request_scopes` 와 `reauthorize` 의 분리 유지**: 옛 코드는 두 mode 가 거의 동일 처리. 새 흐름에서도 Private 의 reauthorize 는 여전히 거부 (사용자가 reauthorize 의도로 누르면 안내 — Private 앱은 "테스트 실행" 만 정식). request_scopes 만 위 우회 분기로 처리.
+
+**UI 안내 패턴 결정 (2026-05-16 추가)**: 분기 ② 응답(`cafe24_private_pending`) 에 대한 화면 표시는 modal/dialog 가 아닌 **inline alert + info 토스트** 로 정한다. modal 은 닫히면 잊혀지지만 Cafe24 측 작업(권한 활성화 → 테스트 실행)을 진행하는 동안 사용자가 안내를 계속 참조해야 한다 — 따라서 inline 으로 영구 표시. toast 는 응답 도착 신호로만 사용 (alert 가 본문). alert 생존 주기는 "다음 요청 시작 직전 reset" — `useMutation` 의 `onMutate` 훅에서 비워 옛 안내가 새 요청과 섞이지 않게 한다. 본 분기에서는 부모 페이지의 refetch 콜백을 호출하지 않는다 — token 갱신은 Cafe24 측 후속 callback handler (`handleInstall` 의 status 분기) 가 담당하므로 즉시 refetch 해도 변화 없음. `scopesAdded` 는 alert 안의 칩 목록으로 표시하되 빈 배열이면 칩 영역 자체를 숨긴다. UI 매핑 표는 §4.4.
+
+### Cafe24 install_token mismatch 회복 흐름 (2026-05-15 후속)
+
+운영 사용자 보고 — 새 통합 등록 후 Cafe24 Developers 에 App URL 을 등록했는데, "테스트 실행" 시 우리 endpoint 가 `404 CAFE24_INSTALL_INVALID_TOKEN` 응답. 원인: 사용자가 신규 통합 폼을 여러 번 제출하면서 (예: client_secret 오타 수정) idempotent begin 의 credentials-change 분기로 install_token 이 재발급됨. 마지막에 본 URL 만 옳고, 그 사이 Cafe24 Developers 에 등록한 옛 URL 은 stale.
+
+옛 동작은 단호한 404. 사용자는 통합 상세 페이지에서 현재 App URL 을 확인해 Cafe24 Developers 를 수동 갱신해야 회복 가능. UX 가 뚝뚝 끊기고 운영 문의가 잦음.
+
+**결정**: `handleInstall` 의 install_token 직접 매칭 실패 시 회복 분기 추가.
+
+1. 같은 mall_id 의 cafe24 row 들 조회 (V046 partial UNIQUE 로 보통 1~2건).
+2. 각 row 의 `client_secret` 으로 HMAC trial 검증.
+3. **정확히 1개** validates → 그 row 의 OAuth/navigation 흐름으로 fall-through.
+4. 0개 또는 2개+ → 기존 404 흐름 + HTML 안내 페이지 (사용자가 통합 상세의 현재 App URL 로 갱신).
+
+비용: O(N) HMAC verify (회복 분기에서만, 정상 흐름 zero impact). 옛 폐기된 "100건 mall_id 스캔 + trial HMAC" (Rationale "install_token 을 App URL path 식별 키로 승격" 항 참조) 과 형태는 비슷하나 (a) 호출 빈도가 낮고 (404 fallback only), (b) **같은 workspace 안에서는** V046 partial UNIQUE `(workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL` 이 같은 mall_id row 를 최대 1개로 제한하며, 회복 분기 스캔이 workspace 횡단이라도 같은 mall_id 를 둘 이상 workspace 에서 동시 사용하는 케이스는 드물어 N=1~2 가 실무 값 ("구조적 상한 N≤2" 가 아니라 workspace-scoped 1개 보장 + 실무적으로 소수). 정상 식별은 여전히 install_token 단일 row 조회.
+
+**TOCTOU 부재**: 회복 분기는 SELECT + HMAC verify 만 수행하는 read-only 조회로 INSERT/UPDATE 가 없어 race 자체가 발생하지 않는다. begin 핸들러의 V045 partial UNIQUE backstop (`CAFE24_PRIVATE_APP_ALREADY_CONNECTED` Rationale 참조) 은 INSERT 단계의 동시 신청 차단을 담당하는 보완 보증이며, 본 분기

... (truncated due to prompt size limit) ...

---

### 파일 13: review/consistency/2026/05/16/13_37_23/_retry_state.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
commit ed11854c9a73575e9fd9e7ef27a24ea5a50b277d
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 13:58:46 2026 +0900

    feat(cafe24): connection test now pings GET /api/v2/admin/apps with 401-refresh-retry
    
    - Add Cafe24ApiClient.pingConnection — GET /api/v2/admin/apps with explicit
      refresh + 1 retry on 401 (race-condition self-recovery for stale tokens
      that proactive ensureFreshToken missed). 403 / transport failures return
      diagnostic results without flipping status or incrementing the
      consecutive_network_failures counter.
    - Add IntegrationsService.registerEntityTester — out-of-band hook so
      Cafe24Module can wire its entity-aware probe without IntegrationsModule
      ever importing from nodes/*.
    - Cafe24Module.onModuleInit registers cafe24's pingConnection so saved
      cafe24 integrations actually round-trip the API on test-connection
      instead of falling through to the structural-only success fallback.
    - Plan + spec-update note: spec §5.8 still says GET /store; the goal-stated
      endpoint is /apps. Update is deferred behind the 3 in-flight cafe24-spec
      worktree merges (consistency-checker session 13_37_23, BLOCK YES).
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/13_37_23/_retry_state.json b/review/consistency/2026/05/16/13_37_23/_retry_state.json
new file mode 100644
index 00000000..b68a38a9
--- /dev/null
+++ b/review/consistency/2026/05/16/13_37_23/_retry_state.json
@@ -0,0 +1,52 @@
+{
+  "session_dir": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-test-connection-2d7fa4/review/consistency/2026/05/16/13_37_23",
+  "summary_subagent_type": "consistency-summary",
+  "summary_output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-test-connection-2d7fa4/review/consistency/2026/05/16/13_37_23/SUMMARY.md",
+  "subagent_invocations": [
+    {
+      "name": "cross_spec",
+      "subagent_type": "cross-spec-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-test-connection-2d7fa4/review/consistency/2026/05/16/13_37_23/_prompts/cross_spec.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-test-connection-2d7fa4/review/consistency/2026/05/16/13_37_23/cross_spec/review.md"
+    },
+    {
+      "name": "rationale_continuity",
+      "subagent_type": "rationale-continuity-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-test-connection-2d7fa4/review/consistency/2026/05/16/13_37_23/_prompts/rationale_continuity.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-test-connection-2d7fa4/review/consistency/2026/05/16/13_37_23/rationale_continuity/review.md"
+    },
+    {
+      "name": "convention_compliance",
+      "subagent_type": "convention-compliance-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-test-connection-2d7fa4/review/consistency/2026/05/16/13_37_23/_prompts/convention_compliance.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-test-connection-2d7fa4/review/consistency/2026/05/16/13_37_23/convention_compliance/review.md"
+    },
+    {
+      "name": "plan_coherence",
+      "subagent_type": "plan-coherence-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-test-connection-2d7fa4/review/consistency/2026/05/16/13_37_23/_prompts/plan_coherence.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-test-connection-2d7fa4/review/consistency/2026/05/16/13_37_23/plan_coherence/review.md"
+    },
+    {
+      "name": "naming_collision",
+      "subagent_type": "naming-collision-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-test-connection-2d7fa4/review/consistency/2026/05/16/13_37_23/_prompts/naming_collision.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-test-connection-2d7fa4/review/consistency/2026/05/16/13_37_23/naming_collision/review.md"
+    }
+  ],
+  "agents_pending": [],
+  "agents_success": ["cross_spec", "rationale_continuity", "convention_compliance", "plan_coherence", "naming_collision"],
+  "agents_fatal": [],
+  "agent_history": {
+    "cross_spec": [{"status": "success", "issues": 6}],
+    "rationale_continuity": [{"status": "success", "issues": 5}],
+    "convention_compliance": [{"status": "success", "issues": 4}],
+    "plan_coherence": [{"status": "success", "issues": 6}],
+    "naming_collision": [{"status": "success", "issues": 4}]
+  },
+  "rate_limit_episodes": 0,
+  "total_wait_sec": 0,
+  "wake_history": [],
+  "last_reset_hint_sec": null,
+  "loop_mode": false
+}

```

---

### 파일 14: review/consistency/2026/05/16/13_37_23/convention_compliance/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit ed11854c9a73575e9fd9e7ef27a24ea5a50b277d
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 13:58:46 2026 +0900

    feat(cafe24): connection test now pings GET /api/v2/admin/apps with 401-refresh-retry
    
    - Add Cafe24ApiClient.pingConnection — GET /api/v2/admin/apps with explicit
      refresh + 1 retry on 401 (race-condition self-recovery for stale tokens
      that proactive ensureFreshToken missed). 403 / transport failures return
      diagnostic results without flipping status or incrementing the
      consecutive_network_failures counter.
    - Add IntegrationsService.registerEntityTester — out-of-band hook so
      Cafe24Module can wire its entity-aware probe without IntegrationsModule
      ever importing from nodes/*.
    - Cafe24Module.onModuleInit registers cafe24's pingConnection so saved
      cafe24 integrations actually round-trip the API on test-connection
      instead of falling through to the structural-only success fallback.
    - Plan + spec-update note: spec §5.8 still says GET /store; the goal-stated
      endpoint is /apps. Update is deferred behind the 3 in-flight cafe24-spec
      worktree merges (consistency-checker session 13_37_23, BLOCK YES).
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/13_37_23/convention_compliance/review.md b/review/consistency/2026/05/16/13_37_23/convention_compliance/review.md
new file mode 100644
index 00000000..a4bc8764
--- /dev/null
+++ b/review/consistency/2026/05/16/13_37_23/convention_compliance/review.md
@@ -0,0 +1,49 @@
+# Convention Compliance Review
+
+**검토 모드**: 구현 착수 전 검토 (--impl-prep)
+**검토 대상**: `spec/2-navigation/4-integration.md`
+**정식 규약 참조**: `spec/conventions/swagger.md`, `spec/conventions/node-output.md`, `spec/conventions/cafe24-api-catalog/_overview.md`
+
+---
+
+## 발견사항
+
+- **[INFO]** 문서 구조 — `## Rationale` 섹션 위치 적합
+  - target 위치: 문서 최하단 `## Rationale` 섹션 (line 930~)
+  - 위반 규약: `spec/conventions/` 및 CLAUDE.md 명명 컨벤션 (권장 3섹션: Overview / 본문 / Rationale)
+  - 상세: 문서가 `## 1. 라우트 구성` 으로 시작해 `## Overview (제품 정의)` 섹션이 별도 존재하지 않는다. 대신 서두의 관련 문서 링크가 `_product-overview.md` 를 가리키고, 본 파일이 "기술 명세(스펙) 본문" 역할을 담당하는 구조다. CLAUDE.md 에서 "`spec/<영역>/N-name.md` — 본문 끝에 `## Rationale` 섹션을 권장" 이라고 명시한 규약은 충족되어 있다. `4-integration.md` 의 파일명 패턴(`N-name.md`) 도 적합하다. 다만 스펙 본문의 첫 절 앞에 간략한 `## Overview` 요약 섹션(사용자 가치·목표 2~3문장)이 없어 단일 파일에서 제품 정의 맥락을 바로 확인하기 어렵다.
+  - 제안: 1절 앞에 `## Overview` 섹션 추가를 고려하거나, 현재처럼 링크를 통해 `_product-overview.md` 로 위임하는 구조를 명시적으로 유지한다. 규약상 강제 사항은 아님.
+
+- **[INFO]** API 응답 error code 형식 혼재 — `status_reason` vs HTTP 에러 코드 구분은 의도적
+  - target 위치: `§9.4 공통 응답 포맷` 및 `§10.4 에러 매핑`
+  - 위반 규약: `spec/conventions/swagger.md §2-4` (상태 코드 응답 규칙)
+  - 상세: HTTP 응답 에러 코드 (`INTEGRATION_IN_USE`, `CAFE24_INSTALL_MISSING_PARAMS` 등) 는 `UPPER_SNAKE_CASE` 를 사용하고, DB 컬럼 `status_reason` 값 (`auth_failed`, `install_timeout`, `oauth_token_exchange_failed` 등) 은 `snake_case` 를 사용한다. 두 표기 체계가 혼재하나, Rationale 에서 의도적으로 도메인 분리(HTTP 컨벤션 vs DB 컨벤션)를 명문화하고 있다. `spec/conventions/swagger.md §2-4` 는 HTTP 상태 코드 데코레이터 규칙을 정의하며, 응답 `code` 필드의 casing 규칙은 해당 문서에 명시적으로 정의되어 있지 않다. 실질적인 convention 위반이 아니며 Rationale 문서화로 충분히 설명됨.
+  - 제안: `spec/conventions/swagger.md` 에 "응답 body 의 `code` 필드는 `UPPER_SNAKE_CASE`" 규약을 선택적으로 추가해 문서 간 명시적 일관성을 강화할 수 있음. 본 파일 수정 불필요.
+
+- **[INFO]** `spec/conventions/cafe24-api-catalog` 연동 방향
+  - target 위치: `§5.8 Cafe24` — scope 권장 프리셋 표
+  - 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md §1` (18 resource 단위 enumeration 이 단일 진실)
+  - 상세: `§5.8` 의 Scope 권장 프리셋 표가 `Application`, `Store`, `Design`, `Community`, `Collection`, `Supply`, `Personal`, `Privacy` 를 포함해 총 18 카테고리를 나열하고 있다. 이는 `cafe24-api-catalog/_overview.md §5` 의 18 resource (`store`, `product`, `order`, `customer`, `community`, `design`, `promotion`, `application`, `category`, `collection`, `supply`, `shipping`, `salesreport`, `personal`, `privacy`, `mileage`, `notification`, `translation`) 와 내용상 중복이다. 두 문서가 같은 진실을 다른 맥락에서 서술하는 것은 자연스러우나, 카테고리 목록이 달라질 경우 두 곳을 동시에 갱신해야 하는 동기화 부담이 있다.
+  - 제안: `§5.8` 의 scope 프리셋 표에 `[Cafe24 API 카탈로그 §1](../../conventions/cafe24-api-catalog/_overview.md#1-디렉토리-구조)` 참조 링크를 추가해 SoT 를 명확히 가리키는 것을 권장. 강제 수정은 불필요.
+
+- **[INFO]** 파일명 패턴 준수 확인
+  - target 위치: `spec/2-navigation/4-integration.md` 파일 자체
+  - 위반 규약: CLAUDE.md 명명 컨벤션 `spec/<영역>/N-name.md`
+  - 상세: `4-integration.md` 는 숫자 prefix (`4-`) + 평문 이름 패턴을 따른다. `spec/2-navigation/` 디렉토리 안에 `_product-overview.md`, `_layout.md`, `0-dashboard.md` 등이 적절히 배치되어 있다. 규약 준수 확인 — 이상 없음.
+  - 제안: 없음.
+
+- **[INFO]** 금지 경로 참조 없음 확인
+  - target 위치: 문서 전체 링크 및 참조
+  - 위반 규약: CLAUDE.md "옛 `prd/`, `memory/`, `user_memo/` 폴더 사용 금지"
+  - 상세: 문서 내 링크가 `spec/`, `../`, `plan/` 경로만 참조하며, 폐기된 `prd/`, `memory/`, `user_memo/` 경로를 사용하지 않는다. Rationale 섹션의 review 참조 (`review/consistency/2026/05/14/18_23_55`) 는 역사 기록용 참조로 폐기 경로가 아님. 규약 준수 확인 — 이상 없음.
+  - 제안: 없음.
+
+---
+
+## 요약
+
+`spec/2-navigation/4-integration.md` 는 정식 규약(`spec/conventions/`) 을 전반적으로 잘 준수하고 있다. 파일명 패턴(`N-name.md`), `## Rationale` 섹션 포함, 금지 경로 미사용, HTTP 에러 코드 규약(`UPPER_SNAKE_CASE`) 의 일관된 적용 등 핵심 규약 준수 사항이 모두 충족된다. DB 내부 `status_reason` 값의 `snake_case` 와 HTTP 응답 `code` 의 `UPPER_SNAKE_CASE` 혼재는 Rationale 에서 의도적으로 명문화되어 있어 위반이 아니다. 발견된 사항은 모두 INFO 등급(소규모 형식 일관성 제안) 으로, 구현 착수를 차단하는 CRITICAL 이나 WARNING 은 없다.
+
+## 위험도
+
+NONE

```

---

### 파일 15: review/consistency/2026/05/16/13_37_23/cross_spec/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit ed11854c9a73575e9fd9e7ef27a24ea5a50b277d
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 13:58:46 2026 +0900

    feat(cafe24): connection test now pings GET /api/v2/admin/apps with 401-refresh-retry
    
    - Add Cafe24ApiClient.pingConnection — GET /api/v2/admin/apps with explicit
      refresh + 1 retry on 401 (race-condition self-recovery for stale tokens
      that proactive ensureFreshToken missed). 403 / transport failures return
      diagnostic results without flipping status or incrementing the
      consecutive_network_failures counter.
    - Add IntegrationsService.registerEntityTester — out-of-band hook so
      Cafe24Module can wire its entity-aware probe without IntegrationsModule
      ever importing from nodes/*.
    - Cafe24Module.onModuleInit registers cafe24's pingConnection so saved
      cafe24 integrations actually round-trip the API on test-connection
      instead of falling through to the structural-only success fallback.
    - Plan + spec-update note: spec §5.8 still says GET /store; the goal-stated
      endpoint is /apps. Update is deferred behind the 3 in-flight cafe24-spec
      worktree merges (consistency-checker session 13_37_23, BLOCK YES).
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/13_37_23/cross_spec/review.md b/review/consistency/2026/05/16/13_37_23/cross_spec/review.md
new file mode 100644
index 00000000..dce1b254
--- /dev/null
+++ b/review/consistency/2026/05/16/13_37_23/cross_spec/review.md
@@ -0,0 +1,71 @@
+# Cross-Spec 일관성 검토
+
+**검토 모드**: `--impl-prep`
+**대상 문서**: `spec/2-navigation/4-integration.md`
+**구현 범위**: `plan/in-progress/cafe24-test-connection.md` — Cafe24 연결 테스트(`POST /api/integrations/:id/test`) 실 구현
+
+---
+
+## 발견사항
+
+### [WARNING] §5.8 테스트 방법과 plan 구현 범위의 엔드포인트 불일치
+
+- **target 위치**: `spec/2-navigation/4-integration.md §5.8` — "테스트 방법: 저장된 `access_token` 으로 `GET https://{mall_id}.cafe24api.com/api/v2/admin/store` 핑."
+- **충돌 대상**: `plan/in-progress/cafe24-test-connection.md §구현 범위` — "사용자 지시(2026-05-16)로 **`GET /api/v2/admin/apps` 로 변경**하고 401 시 refresh + 1회 재시도를 추가한다."
+- **상세**: spec §5.8 은 `/store` 엔드포인트를 명시하지만, plan 은 `/apps` 엔드포인트로 변경을 결정했다. 구현이 `/apps` 로 완성되면 spec 과 코드가 상이해진다. plan 자체가 "Spec 갱신 (project-planner 위임 대상)" 섹션에서 갱신 필요를 인지하고 있지만, 구현 완료 전 spec 이 갱신되지 않으면 이 worktree 에서 reviewer 나 다른 contributor 가 잘못된 엔드포인트(`/store`)를 참조할 수 있다.
+- **제안**: 구현 착수 전에 `project-planner` 를 통해 `spec/2-navigation/4-integration.md §5.8` 의 "테스트 방법" 항목을 `/apps` + 401 retry 정책으로 갱신한다. plan 의 "Spec 갱신 위임 노트" 는 구현 완료 후가 아닌 **착수 직전**에 실행되어야 spec 이 단일 진실 역할을 유지한다.
+
+---
+
+### [WARNING] `consecutive_network_failures` 카운터 적용 범위 — 테스트 호출 제외 미명시
+
+- **target 위치**: `spec/2-navigation/4-integration.md §14.1` + `spec/1-data-model.md §2.10` — "`consecutive_network_failures`: 노드 실행 / 토큰 갱신 중 transport 실패 카운터. 성공 시 0으로 리셋, 3 도달 시 `error(network)` 전이."
+- **충돌 대상**: `plan/in-progress/cafe24-test-connection.md §구현 범위` — "transport 실패 → `{ success: false }` (**consecutiveNetworkFailures 카운터는 노드 호출 정의에 한정 — 테스트는 합산하지 않음**)."
+- **상세**: plan 이 테스트 호출의 transport 실패를 카운터에서 제외하기로 결정했으나, `spec/2-navigation/4-integration.md §14.1` 및 `spec/1-data-model.md §2.10` 의 카운터 정의에는 이 제외 규칙이 기술되어 있지 않다. 구현 후 다른 개발자가 spec 을 보면 "왜 테스트 호출이 카운터를 올리지 않는가?"를 spec 에서 확인할 수 없어 행동이 불명확해진다.
+- **제안**: spec §5.8 갱신 시 또는 `spec/1-data-model.md §2.10` `consecutive_network_failures` 설명에 "테스트(`POST /api/integrations/:id/test`) 호출의 transport 실패는 카운터 합산 대상 아님" 을 명시한다.
+
+---
+
+### [WARNING] `POST /api/integrations/:id/test` — `pending_install` 상태에서의 동작 미정의
+
+- **target 위치**: `spec/2-navigation/4-integration.md §9.1` — `POST /api/integrations/:id/test`: "현재 저장된 자격 증명으로 연결 테스트"
+- **충돌 대상**: `spec/2-navigation/4-integration.md §2.2` — "`pending_install` 의 ⋮ 메뉴는 상세 열기 + 삭제만 활성 — 재인증은 cafe24 측 '테스트 실행' 재호출이 정식이며, 연결 테스트는 토큰이 없어 의미가 없다."
+- **상세**: UI 레이어(§2.2)는 `pending_install` 에서 연결 테스트 버튼이 비활성임을 명시하지만, API 레이어(§9.1)에서 `POST /api/integrations/:id/test` 가 `pending_install` 상태의 `integrationId` 로 호출됐을 때 어떤 HTTP 응답을 반환해야 하는지(예: 422 `INTEGRATION_INCOMPLETE`, 400, 무시 등)가 정의되어 있지 않다. plan 이 `testConnection` 을 entity-aware 로 구현한다고 명시하므로, 이 경우의 처리 경계를 spec 에 기술할 필요가 있다.
+- **제안**: `spec/2-navigation/4-integration.md §9.1` 또는 §14.1 에 `pending_install` 상태의 `test` 호출 시 `422 INTEGRATION_INCOMPLETE` (또는 적절한 에러) 를 즉시 반환하도록 명시한다. 기존 `INTEGRATION_INCOMPLETE` 에러 코드(§14.1 에러 vocabulary)가 이미 정의되어 있어 재사용 가능하다.
+
+---
+
+### [WARNING] `preview-test` 의 Cafe24 분기 — entity-aware 확장과의 경계 미정의
+
+- **target 위치**: `spec/2-navigation/4-integration.md §3.3` — "자동으로 `POST /api/integrations/preview-test`를 호출 (DB 저장 없이 메모리상 자격 증명으로 검증)"
+- **충돌 대상**: `plan/in-progress/cafe24-test-connection.md §구현 범위` — "preview-test (DB 저장 전) cafe24 케이스는 막 발급된 토큰이라 refresh 불필요 — 단순 ping만 수행 (entity 없는 분기)"
+- **상세**: plan 이 `POST /api/integrations/:id/test` 는 entity 를 받아 `ensureFreshToken` + retry 를 하고, `preview-test` 는 entity 없이 단순 ping 만 한다고 설계를 구분했다. 그러나 spec §3.3 의 "테스트 방법" 항목(§5.8)은 하나의 "테스트 방법"만 기술하며, 두 경로(`/:id/test` vs `/preview-test`)의 동작 차이가 spec 에 명시되어 있지 않다. 특히 `/apps` 엔드포인트 변경과 401 retry 추가가 `preview-test` 경로에는 적용되지 않는다는 결정이 spec 에 없다.
+- **제안**: spec §5.8 테스트 방법 갱신 시 "저장된 통합(`/:id/test`)은 ensureFreshToken + 401 retry 적용, 사전 검증(`/preview-test`) 은 단순 ping" 이라는 경로 분기를 명시한다.
+
+---
+
+### [INFO] §5.8 `consecutive_network_failures` 와 §14.1 에러 코드 vocabulary 간 Cafe24 전용 에러 코드 부재
+
+- **target 위치**: `spec/2-navigation/4-integration.md §14.1` 에러 코드 vocabulary
+- **충돌 대상**: `plan/in-progress/cafe24-test-connection.md` — "401 → ... 재시도도 401 이면 `markAuthFailed` + `{ success: false }`, 403/기타 → `markAuthFailed` 호출하지 않고 `{ success: false, message }` 반환"
+- **상세**: §14.1 에러 코드 테이블에 Cafe24 전용 테스트 결과 구분(예: 401 재시도 실패 vs 403 scope 오류)을 구분하는 코드가 없다. `INTEGRATION_CALL_FAILED` 나 `INSUFFICIENT_SCOPE` 가 사용 가능하지만, plan 의 "403은 markAuthFailed 없이 단순 실패" 라는 의도가 vocabulary 에 반영되어 있지 않아 구현과 spec 기록 사이의 동기화 갭이 생길 수 있다.
+- **제안**: spec 갱신 시 Cafe24 test connection 의 응답 shape(`{ success, message?, authFailed? }`)을 §9.1 또는 §5.8 에 brief 하게 기술한다.
+
+---
+
+### [INFO] `spec/0-overview.md §6.2` Cafe24 구현 상태 참조 — 테스트 연결 미구현 언급 없음
+
+- **target 위치**: `spec/0-overview.md §6.2` — "Cafe24 통합 ... 모두 구현 완료 (PR #20-#67)."
+- **충돌 대상**: `plan/in-progress/cafe24-test-connection.md §배경` — "`POST /api/integrations/:id/test` 의 cafe24 분기는 현재 항상 `success: true` 를 반환한다 (구현 위치: `integrationsService.ts:160-162`, `dispatchTest` fallback)."
+- **상세**: `spec/0-overview.md` 는 Cafe24 통합이 "모두 구현 완료"라고 기술하지만, 실제로는 연결 테스트(`/test` cafe24 분기)가 stub 상태임이 plan 에서 확인된다. 이는 overview 의 구현 완료 선언이 과도하거나 범위 정의가 부정확함을 나타낸다.
+- **제안**: 구현 완료 후 `spec/0-overview.md §6.2` 의 Cafe24 항목을 갱신하거나, 구현 전이라면 "연결 테스트 stub" 을 `§6.2 🚧` 항목으로 이동한다.
+
+---
+
+## 요약
+
+Cross-Spec 관점에서 `spec/2-navigation/4-integration.md` 자체는 `spec/1-data-model.md`, `spec/4-nodes/4-integration/4-cafe24.md` 등 관련 spec 과 구조적으로 일관성을 갖추고 있다. 직접적인 모순은 없다. 그러나 이번 `--impl-prep` 검토에서 핵심 위험은 **spec 과 plan 사이의 갭**이다: plan 이 spec §5.8 의 테스트 엔드포인트(`/store`)를 `/apps` 로 변경하고 401 retry 정책을 추가하기로 결정했지만, spec 갱신은 구현 완료 후로 미뤄져 있다. SDD(Spec-Driven Development) 원칙상 spec 이 먼저 갱신된 뒤 구현이 이루어져야 한다. 추가로 `consecutive_network_failures` 카운터의 테스트 호출 제외 규칙, `pending_install` 상태에서의 `/:id/test` API 동작, `preview-test` 와 `/:id/test` 의 동작 분기가 spec 에 미정의된 상태로 구현에 진입하면 추후 불일치 위험이 높다. CRITICAL 충돌은 없으나 WARNING 4건이 구현 전에 처리되어야 spec 단일 진실을 유지할 수 있다.
+
+## 위험도
+
+MEDIUM

```

---

### 파일 16: review/consistency/2026/05/16/13_37_23/meta.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
commit ed11854c9a73575e9fd9e7ef27a24ea5a50b277d
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 13:58:46 2026 +0900

    feat(cafe24): connection test now pings GET /api/v2/admin/apps with 401-refresh-retry
    
    - Add Cafe24ApiClient.pingConnection — GET /api/v2/admin/apps with explicit
      refresh + 1 retry on 401 (race-condition self-recovery for stale tokens
      that proactive ensureFreshToken missed). 403 / transport failures return
      diagnostic results without flipping status or incrementing the
      consecutive_network_failures counter.
    - Add IntegrationsService.registerEntityTester — out-of-band hook so
      Cafe24Module can wire its entity-aware probe without IntegrationsModule
      ever importing from nodes/*.
    - Cafe24Module.onModuleInit registers cafe24's pingConnection so saved
      cafe24 integrations actually round-trip the API on test-connection
      instead of falling through to the structural-only success fallback.
    - Plan + spec-update note: spec §5.8 still says GET /store; the goal-stated
      endpoint is /apps. Update is deferred behind the 3 in-flight cafe24-spec
      worktree merges (consistency-checker session 13_37_23, BLOCK YES).
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/13_37_23/meta.json b/review/consistency/2026/05/16/13_37_23/meta.json
new file mode 100644
index 00000000..e3aad587
--- /dev/null
+++ b/review/consistency/2026/05/16/13_37_23/meta.json
@@ -0,0 +1,12 @@
+{
+  "timestamp": "2026-05-16T13:37:23.195761",
+  "mode": "구현 착수 전 검토 (--impl-prep, scope=spec/2-navigation/4-integration.md)",
+  "target_path": "spec/2-navigation/4-integration.md",
+  "checkers": [
+    "cross_spec",
+    "rationale_continuity",
+    "convention_compliance",
+    "plan_coherence",
+    "naming_collision"
+  ]
+}
\ No newline at end of file

```

---

### 파일 17: review/consistency/2026/05/16/13_37_23/naming_collision/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit ed11854c9a73575e9fd9e7ef27a24ea5a50b277d
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 13:58:46 2026 +0900

    feat(cafe24): connection test now pings GET /api/v2/admin/apps with 401-refresh-retry
    
    - Add Cafe24ApiClient.pingConnection — GET /api/v2/admin/apps with explicit
      refresh + 1 retry on 401 (race-condition self-recovery for stale tokens
      that proactive ensureFreshToken missed). 403 / transport failures return
      diagnostic results without flipping status or incrementing the
      consecutive_network_failures counter.
    - Add IntegrationsService.registerEntityTester — out-of-band hook so
      Cafe24Module can wire its entity-aware probe without IntegrationsModule
      ever importing from nodes/*.
    - Cafe24Module.onModuleInit registers cafe24's pingConnection so saved
      cafe24 integrations actually round-trip the API on test-connection
      instead of falling through to the structural-only success fallback.
    - Plan + spec-update note: spec §5.8 still says GET /store; the goal-stated
      endpoint is /apps. Update is deferred behind the 3 in-flight cafe24-spec
      worktree merges (consistency-checker session 13_37_23, BLOCK YES).
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/13_37_23/naming_collision/review.md b/review/consistency/2026/05/16/13_37_23/naming_collision/review.md
new file mode 100644
index 00000000..f51a53d4
--- /dev/null
+++ b/review/consistency/2026/05/16/13_37_23/naming_collision/review.md
@@ -0,0 +1,57 @@
+# 신규 식별자 충돌 검토 — impl-prep (cafe24-test-connection)
+
+검토 모드: 구현 착수 전 (`--impl-prep`)
+대상 spec: `spec/2-navigation/4-integration.md`
+참조 plan: `plan/in-progress/cafe24-test-connection.md`
+
+---
+
+## 발견사항
+
+### [INFO] `testConnection` 메서드명 — 다른 모듈에도 동일 이름 존재
+
+- **target 신규 식별자**: `Cafe24ApiClient.testConnection(integration)` (plan §"구현 범위" 1항)
+- **기존 사용처**:
+  - `LlmClientInterface.testConnection(): Promise<boolean>` — `backend/src/modules/llm/interfaces/llm-client.interface.ts:124`
+  - `LlmService.testConnection(id, workspaceId)` — `backend/src/modules/llm/llm.service.ts:196`
+  - `OpenAiClient.testConnection()`, `AnthropicClient.testConnection()`, `GoogleClient.testConnection()` — 각 LLM 클라이언트 구현체
+  - `LlmConfigController.testConnection()` — `backend/src/modules/llm-config/llm-config.controller.ts:188`
+- **상세**: `testConnection` 은 이미 LLM 도메인 전체에 걸쳐 사용 중인 메서드명이다. `Cafe24ApiClient` 는 `nodes/integration/cafe24/` 모듈에 위치하여 LLM 클라이언트와 클래스 계층이 완전히 분리되므로 런타임 충돌은 없다. 그러나 codebase 검색(`grep testConnection`) 시 LLM 계열과 Cafe24 계열이 섞여 노출된다. 반환 타입도 LLM 쪽은 `Promise<boolean>`, 제안 Cafe24 쪽은 `Promise<{ success: boolean; message?: string }>` 계열로 달라, 혼동 가능성이 있다.
+- **제안**: `Cafe24ApiClient` 의 메서드를 `pingConnection()` 또는 `verifyToken()` 으로 명명해 LLM 계열 `testConnection` 과 시각적으로 구분한다. 또는 `IntegrationsService.dispatchTest` 내부에서만 cafe24 전용 분기를 익명 함수로 처리해 퍼블릭 메서드를 별도로 노출하지 않는 방법도 있다.
+
+---
+
+### [WARNING] `TransportTester` 타입 시그니처 확장 — 기존 계약 위반 위험
+
+- **target 신규 식별자**: cafe24 분기를 위한 entity-aware `TransportTester` 확장 (plan: "testConnection 분기 자체를 entity-aware 로 확장")
+- **기존 사용처**: `TransportTester` 타입 `(authType: string, credentials: Record<string, unknown>) => Promise<IntegrationTestResult>` — `backend/src/modules/integrations/integrations.service.ts:72-75`. 현재 유일한 등록 항목은 `['mcp', this.testMcpTransport.bind(this)]` (line 161)
+- **상세**: 현행 `TransportTester` 는 `(authType, credentials)` 두 인자만 받으며, `dispatchTest` 가 이 시그니처를 강제한다. Plan 은 cafe24 분기가 `Integration` entity 전체를 필요로 한다고 명시하고 있어 현행 타입으로는 수용 불가하다. 타입을 변경하면 기존 `testMcpTransport` 바인딩도 함께 수정해야 한다. 변경 범위가 조용히 확대되는 문제 — `mcp` 분기와 cafe24 분기의 인자 집합이 달라 `Map<string, TransportTester>` 로 단일 타입으로 표현하기 어렵다.
+- **제안**: `TransportTester` 를 확장하기보다, `testConnection` (public, entity 수신) 메서드에서 cafe24 경로를 직접 분기 처리하고 entity 없는 경로(`previewTest`)는 기존 `dispatchTest` 를 그대로 유지한다. 즉, entity-aware 경로와 credentials-only 경로를 분리하여 기존 타입 계약을 보존한다.
+
+---
+
+### [INFO] 테스트 핑 엔드포인트 — 스펙 본문과 구현 계획 불일치
+
+- **target 신규 식별자**: `GET /api/v2/admin/apps` (plan §"구현 범위" 1항 및 §"Spec 갱신" 항)
+- **기존 사용처**: `spec/2-navigation/4-integration.md §5.8` 의 현행 텍스트 — "저장된 `access_token` 으로 `GET https://{mall_id}.cafe24api.com/api/v2/admin/store` 핑. 응답 200 + JSON 본문 확인."
+- **상세**: 구현 계획은 `/api/v2/admin/apps` 로 변경하지만 스펙 본문은 여전히 `/api/v2/admin/store` 를 기재하고 있다. impl-prep 착수 시점에서 스펙과 구현 의도가 엇갈린 상태다. plan 은 spec 갱신을 "project-planner 위임 대상"으로 표기하였으나, 구현 완료 전 스펙이 갱신되지 않으면 코드 리뷰어/신규 기여자가 스펙을 보고 잘못된 엔드포인트를 파악하게 된다.
+- **제안**: 구현 착수 직전 또는 구현과 동시에 `spec/2-navigation/4-integration.md §5.8` 의 테스트 방법 텍스트를 plan 의 "Spec 갱신" 항 내용으로 갱신한다. plan 이 이미 위임 노트를 담고 있으므로 착수 전 project-planner 로 위임하여 스펙을 선(先)갱신한다.
+
+---
+
+### [INFO] `consecutiveNetworkFailures` 카운터 미적용 범위 — 스펙 묵시적 제외 명확화 필요
+
+- **target 신규 식별자**: `testConnection` 호출 시 `consecutiveNetworkFailures` 카운터를 합산하지 않는다는 정책 (plan: "consecutiveNetworkFailures 카운터는 노드 호출 정의에 한정 — 테스트는 합산하지 않음")
+- **기존 사용처**: `spec/1-data-model.md §2.10` — `consecutive_network_failures` 컬럼 설명: "노드 실행 / 토큰 갱신 중 transport 실패 카운터". `spec/2-navigation/4-integration.md §6` 전이 표: "`connected → error(network)` — 노드 실행 중 또는 토큰 갱신 중 transport 실패가 3회 연속"
+- **상세**: 스펙은 카운터 증가 조건을 "노드 실행 / 토큰 갱신 중" 으로 명시하여 연결 테스트를 묵시적으로 제외하고 있다. Plan 의 "합산하지 않음" 정책은 스펙과 일치한다. 다만 스펙 텍스트가 "연결 테스트 제외"를 명시적으로 기재하지 않아, 구현자가 카운터를 합산해야 하는지 혼동할 여지가 있다.
+- **제안**: `spec/2-navigation/4-integration.md §5.8` 또는 §6 의 `error(network)` 전이 조건에 "연결 테스트(`POST /api/integrations/:id/test`) 중 transport 실패는 카운터 합산 제외" 를 한 줄 추가한다. 스펙 갱신 위임(위 INFO 항목)에 합산한다.
+
+---
+
+## 요약
+
+target 문서(`spec/2-navigation/4-integration.md`)는 이번 검토 diff 구간에서 신규 식별자를 도입하지 않는다(`(없음)`). 충돌 분석은 plan(`cafe24-test-connection.md`)이 기술한 구현 의도를 기준으로 수행하였다. 발견된 사항은 모두 INFO/WARNING 수준이다. `testConnection` 메서드명은 LLM 도메인 코드와 시각적으로 혼동될 수 있으나 런타임 충돌은 없으며, `TransportTester` 타입 시그니처 확장은 기존 `mcp` 분기와의 타입 정합성을 검토하여 설계할 필요가 있다. 가장 즉각적인 조치는 구현 착수 전 `spec/2-navigation/4-integration.md §5.8` 의 테스트 핑 엔드포인트(`/admin/store` → `/admin/apps`)를 project-planner 에 선(先) 위임하여 스펙·구현 간 불일치를 해소하는 것이다.
+
+## 위험도
+
+LOW

```

---

### 파일 18: review/consistency/2026/05/16/13_37_23/plan_coherence/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit ed11854c9a73575e9fd9e7ef27a24ea5a50b277d
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 13:58:46 2026 +0900

    feat(cafe24): connection test now pings GET /api/v2/admin/apps with 401-refresh-retry
    
    - Add Cafe24ApiClient.pingConnection — GET /api/v2/admin/apps with explicit
      refresh + 1 retry on 401 (race-condition self-recovery for stale tokens
      that proactive ensureFreshToken missed). 403 / transport failures return
      diagnostic results without flipping status or incrementing the
      consecutive_network_failures counter.
    - Add IntegrationsService.registerEntityTester — out-of-band hook so
      Cafe24Module can wire its entity-aware probe without IntegrationsModule
      ever importing from nodes/*.
    - Cafe24Module.onModuleInit registers cafe24's pingConnection so saved
      cafe24 integrations actually round-trip the API on test-connection
      instead of falling through to the structural-only success fallback.
    - Plan + spec-update note: spec §5.8 still says GET /store; the goal-stated
      endpoint is /apps. Update is deferred behind the 3 in-flight cafe24-spec
      worktree merges (consistency-checker session 13_37_23, BLOCK YES).
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/13_37_23/plan_coherence/review.md b/review/consistency/2026/05/16/13_37_23/plan_coherence/review.md
new file mode 100644
index 00000000..6f347716
--- /dev/null
+++ b/review/consistency/2026/05/16/13_37_23/plan_coherence/review.md
@@ -0,0 +1,56 @@
+# Plan 정합성 검토 — `spec/2-navigation/4-integration.md`
+
+검토 모드: `--impl-prep`
+검토 대상 worktree: `cafe24-test-connection-2d7fa4`
+관련 plan: `plan/in-progress/cafe24-test-connection.md`
+
+---
+
+## 발견사항
+
+- **[CRITICAL]** `spec/2-navigation/4-integration.md` 동시 수정 — worktree 충돌
+  - target 위치: `cafe24-test-connection.md` §"Spec 갱신 (project-planner 위임 대상)" — §5.8 "테스트 방법" 항목 갱신 예정
+  - 관련 plan: `plan/in-progress/spec-update-cafe24-app-url-reuse.md` (worktree: `cafe24-app-url-reuse-f9a2e3`) — `spec/2-navigation/4-integration.md` §3.2 / §4.4 / §6 / §9 / §10.2 / Rationale 다수 절 동시 수정 중. `git diff main --name-only` 기준 `cafe24-spec-sync-e2a8b9` 도 `spec/2-navigation/4-integration.md` 를 직접 수정하고 있음 (커밋 `75126762`).
+  - 상세: `cafe24-spec-sync-e2a8b9` 브랜치가 이미 `spec/2-navigation/4-integration.md` 를 수정한 상태로 존재하며, `cafe24-app-url-reuse-f9a2e3` plan 도 같은 파일의 여러 절을 손대고 있다. 본 plan 이 project-planner 위임을 통해 §5.8 을 추가 갱신하면 세 개 변경이 동시에 해당 파일을 목표로 하는 경합이 발생한다. 현재 `cafe24-spec-sync-e2a8b9` 는 main 보다 앞서 있으며 미머지 상태다.
+  - 제안: 본 plan 의 spec 갱신 위임(`spec-update-cafe24-test-connection.md` 생성)은 `cafe24-spec-sync-e2a8b9` 와 `cafe24-app-url-reuse-f9a2e3` 의 관련 변경이 main 에 머지된 이후로 직렬화한다. 구현(코드) 작업 자체는 별도 파일이므로 선진행 가능하나, spec 갱신 위임 분리는 위 두 PR 머지 후 착수하도록 plan 에 의존성 주석을 추가한다.
+
+- **[CRITICAL]** `spec/2-navigation/4-integration.md §11` 동시 수정 — 별도 plan 충돌
+  - target 위치: `cafe24-test-connection.md` §"Spec 갱신" — 간접적으로 §10.5 참조 + §5.8 신규 기술
+  - 관련 plan: `plan/in-progress/spec-update-cafe24-background-refresh.md` (worktree: `prod-rereview-fix-a7c93f`) — 동일 파일 §11 (`cafe24-background-refresh` BullMQ job 신규 소절) 갱신 예정
+  - 상세: `prod-rereview-fix-a7c93f` plan 은 `spec/2-navigation/4-integration.md §11` 전체를 재구성하는 작업(4개 항목)을 project-planner 에 위임 중이다. 본 plan 은 §5.8 만 건드리지만, 두 위임이 동시에 project-planner 세션에서 진행되면 동일 파일에 순서 없이 편집이 가해질 수 있다. worktree 가 다르므로 git 레벨 충돌은 발생할 수 있다.
+  - 제안: `spec-update-cafe24-background-refresh.md` 의 project-planner 작업이 완료·머지된 후 본 spec 위임을 착수하거나, 두 위임을 동일 project-planner 세션에서 병합 처리한다.
+
+- **[WARNING]** 사전 의무 절차(`/consistency-check --impl-prep`) 미실행
+  - target 위치: `cafe24-test-connection.md` §"진행 체크리스트" — `[ ] 사전 일관성 검토 (/consistency-check --impl-prep)` 체크박스 미체크
+  - 관련 plan: 동일 plan 내 체크리스트 항목
+  - 상세: developer skill 규약은 구현 착수 직전 `--impl-prep` 을 의무 호출로 정한다. 본 consistency-check 가 `--impl-prep` 모드로 호출됐으나 이는 orchestrator 가 실행한 것이며, plan 체크리스트의 해당 항목은 아직 미체크 상태다. 테스트 선작성·구현 체크박스도 모두 미체크이므로 아직 착수 전임을 확인 — 순서 자체는 올바르나 plan 에 이 검토 결과가 기록·체크돼야 다음 단계 착수 근거가 생긴다.
+  - 제안: 본 검토(`--impl-prep`) 결과(CRITICAL 2건)를 plan 에 기록하고, CRITICAL 해소(의존 PR 직렬화 확인) 후 체크박스를 체크한다.
+
+- **[WARNING]** §5.8 엔드포인트 변경 결정의 spec 선행 미반영
+  - target 위치: `cafe24-test-connection.md` §"Spec 갱신" — "사용자 지시(2026-05-16)로 `GET /api/v2/admin/apps` 로 변경" 명시
+  - 관련 plan: 현재 `spec/2-navigation/4-integration.md §5.8` 은 기존 `/store` ping 방식으로 기술됐을 가능성 (cafe24-spec-sync-e2a8b9 의 변경 내역에 §5.8 수정 여부 미확인)
+  - 상세: 사용자 결정으로 테스트 엔드포인트가 `/store` → `/apps` + 401 재시도로 변경됐으나, 이 결정이 spec 에 반영되기 전에 구현이 진행되면 spec ↔ 코드 불일치가 발생한다. 본 plan 은 spec 갱신을 project-planner 에 위임 예정이지만, 구현 착수 순서와 spec 갱신 순서가 역전될 경우 일시적 불일치 구간이 생긴다.
+  - 제안: 구현 PR 과 spec 갱신 위임 plan(`spec-update-cafe24-test-connection.md`)을 동시에 진행하되, spec 갱신 PR 이 구현 PR 과 동시 또는 선행 머지되도록 계획한다. plan 에 이 순서 제약을 명시한다.
+
+- **[INFO]** plan frontmatter `worktree` 필드 기재 — 정상
+  - target 위치: `cafe24-test-connection.md` frontmatter `worktree: cafe24-test-connection-2d7fa4`
+  - 관련 plan: 해당 없음
+  - 상세: worktree 필드가 올바르게 기재되어 있으며 실제 worktree 디렉토리명과 일치한다.
+
+- **[INFO]** `cafe24-spec-sync-e2a8b9` worktree 의 plan 목록에 `cafe24-test-connection.md` 미수록
+  - target 위치: `cafe24-spec-sync-e2a8b9` 의 plan/in-progress 목록
+  - 관련 plan: `plan/in-progress/cafe24-test-connection.md` (본 worktree 에서만 존재)
+  - 상세: `cafe24-spec-sync-e2a8b9` 는 main 보다 앞선 커밋에서 분기했으므로 본 plan 을 알지 못한다. 추후 `cafe24-spec-sync-e2a8b9` 가 머지된 후 main 에서 보면 `cafe24-test-connection.md` 와 spec 변경이 충돌 없이 합쳐지는지 merge-coordinator 가 검토해야 한다.
+  - 제안: `cafe24-spec-sync-e2a8b9` PR merge 시 `spec/2-navigation/4-integration.md` 의 §5.8 관련 내용을 확인한다.
+
+---
+
+## 요약
+
+`spec/2-navigation/4-integration.md` 는 현재 최소 두 개의 독립 worktree(`cafe24-spec-sync-e2a8b9`, `cafe24-app-url-reuse-f9a2e3`)가 동시에 수정 중이며, 추가로 `prod-rereview-fix-a7c93f`(`spec-update-cafe24-background-refresh.md`)도 동일 파일의 §11 을 project-planner 위임으로 갱신 예정이다. 본 plan(`cafe24-test-connection-2d7fa4`)이 구현 완료 후 `spec-update-cafe24-test-connection.md` 를 project-planner 에 위임하면 해당 파일에 대한 동시 편집 경쟁이 최소 3방향으로 가중된다. 이는 CRITICAL 등급의 worktree 충돌이며, 구현 코드 자체는 다른 파일을 건드리므로 선진행이 가능하나 spec 갱신 위임은 반드시 직렬화 이후에 착수해야 한다. 아울러 사전 의무 절차인 `/consistency-check --impl-prep` 결과를 plan 에 기록하고 CRITICAL 해소를 확인해야 구현 착수 요건이 충족된다.
+
+---
+
+## 위험도
+
+CRITICAL

```

---

### 파일 19: review/consistency/2026/05/16/13_37_23/rationale_continuity/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit ed11854c9a73575e9fd9e7ef27a24ea5a50b277d
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 13:58:46 2026 +0900

    feat(cafe24): connection test now pings GET /api/v2/admin/apps with 401-refresh-retry
    
    - Add Cafe24ApiClient.pingConnection — GET /api/v2/admin/apps with explicit
      refresh + 1 retry on 401 (race-condition self-recovery for stale tokens
      that proactive ensureFreshToken missed). 403 / transport failures return
      diagnostic results without flipping status or incrementing the
      consecutive_network_failures counter.
    - Add IntegrationsService.registerEntityTester — out-of-band hook so
      Cafe24Module can wire its entity-aware probe without IntegrationsModule
      ever importing from nodes/*.
    - Cafe24Module.onModuleInit registers cafe24's pingConnection so saved
      cafe24 integrations actually round-trip the API on test-connection
      instead of falling through to the structural-only success fallback.
    - Plan + spec-update note: spec §5.8 still says GET /store; the goal-stated
      endpoint is /apps. Update is deferred behind the 3 in-flight cafe24-spec
      worktree merges (consistency-checker session 13_37_23, BLOCK YES).
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/13_37_23/rationale_continuity/review.md b/review/consistency/2026/05/16/13_37_23/rationale_continuity/review.md
new file mode 100644
index 00000000..7eed548d
--- /dev/null
+++ b/review/consistency/2026/05/16/13_37_23/rationale_continuity/review.md
@@ -0,0 +1,67 @@
+# Rationale 연속성 검토 결과
+
+검토 모드: `--impl-prep` (구현 착수 전)
+Target: `spec/2-navigation/4-integration.md`
+검토 일시: 2026-05-16
+
+---
+
+## 발견사항
+
+### 발견사항 1
+
+- **[WARNING]** `tryRecoverByMallId` 회복 분기와 기각된 "100건 mall_id 스캔 + trial HMAC" 패턴의 표현상 재도입
+  - target 위치: `spec/2-navigation/4-integration.md` 의 Rationale 섹션 "Cafe24 install_token mismatch 회복 흐름 — 보안 전제 (2026-05-16)" 항
+  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "install_token 을 App URL path 식별 키로 승격 (2026-05-14)" — "원래 설계는 O(N) 매칭 비용 + 비결정적 선택 위험으로 폐기, install_token 단일 row 조회로 고정"
+  - 상세: Rationale "install_token mismatch 회복 흐름 — 보안 전제" 항이 스스로 "옛 폐기된 '100건 mall_id 스캔 + trial HMAC'" 와 표현상 충돌함을 인지하고 있으며, "본질적으로 다른 경로" 라 주장한다. 구분 근거는 (a) 정상 흐름 zero impact — install_token 단일 row 조회가 여전히 우선, (b) fallback only, (c) `RECOVERY_CANDIDATE_LIMIT = 5` 로 DoS 보호, (d) workspace-scoped UNIQUE 제약으로 실무 N=1~2 다. 단, 이 구분 근거가 Rationale 내에 충분히 서술되어 있어 "이유 명시 없는 재도입" 은 아니다. 그러나 구현자가 해당 보안 전제 항을 별도로 인지하지 않으면 "폐기된 패턴의 부분 부활"로 혼동할 여지가 있다.
+  - 제안: 구현 시 `tryRecoverByMallId` 에 `RECOVERY_CANDIDATE_LIMIT = 5` 상수가 코드에 명시되어 있는지, 정상 흐름(install_token 직접 조회)이 항상 선행되는지를 코드 레벨에서 반드시 확인. Rationale 의 "구분" 설명이 코드 주석에도 반영되도록 요청.
+
+---
+
+### 발견사항 2
+
+- **[WARNING]** `refresh 실패 → error(auth_failed)` 채택 — 기존 spec §6 `expired (refresh_failed)` 표기 번복
+  - target 위치: `spec/2-navigation/4-integration.md` Rationale "refresh 실패 시 status_reason 통일 (2026-05-16)" 항
+  - 과거 결정 출처: 같은 spec 본문 §6 (상태 전이 표) 의 옛 표기 `connected → expired | refresh fail`
+  - 상세: Rationale 에 번복 이유가 명문화되어 있고 (`error(auth_failed)` 채택 근거 (a)~(c) 열거, `expired (refresh_failed)` 폐기 선언), 데이터 모델 변경 없음 및 알림 정책까지 기술되어 있다. Rationale 갱신 자체는 완료된 것으로 보인다. 그러나 spec §6 본문 상태 전이 표가 실제로 갱신되었는지 — 즉 Rationale 기술 내용과 spec 본문이 동기화되었는지 — 구현 착수 전에 확인이 필요하다. 상태 전이 표와 Rationale 이 불일치하면 구현자가 어느 쪽을 따라야 할지 혼동한다.
+  - 제안: 구현 착수 전, `spec/2-navigation/4-integration.md` §6 상태 전이 표에서 `expired (refresh_failed)` 항목이 `error(auth_failed)` 로 실제 갱신되어 있는지 확인. 불일치 발견 시 project-planner 에게 spec 본문 동기화 요청.
+
+---
+
+### 발견사항 3
+
+- **[INFO]** `install_timeout` 알림 미발사 결정 — 이전 PR #75/#76 기재 내용과의 명시적 충돌 해소
+  - target 위치: `spec/2-navigation/4-integration.md` Rationale "install_timeout 알림 미발사 (2026-05-16)" 항
+  - 과거 결정 출처: PR #75/#76 spec 표현 ("expired 전이 두 경로 — token_expired, install_timeout — 모두 발사")
+  - 상세: Rationale 에 이전 기재가 "코드 미확인 상태에서의 오기"임을 명시하고, 현행 동작(`expirePendingInstalls()` 가 `notificationsService.createMany` 호출 없음) 을 의도로 명문화했다. 기각된 옵션(발사)의 근거도 서술되어 있다. Rationale 연속성 관점에서 적절하게 처리된 번복이다. 추가 조치 불필요.
+  - 제안: 없음 (Rationale 기술 적절). 구현 시 `expirePendingInstalls()` 에 알림 호출이 실수로 추가되지 않도록 테스트 커버리지 확인 권장.
+
+---
+
+### 발견사항 4
+
+- **[INFO]** `OAuthState.mode='reauthorize'` 재사용 — 별도 mode 신설 기각 근거 명시
+  - target 위치: `spec/2-navigation/4-integration.md` Rationale "OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유 (2026-05-14)" 항
+  - 과거 결정 출처: 동일 항 내 — `mode='cafe24_private_install'` 별도 신설 검토 후 기각
+  - 상세: Rationale 에 기각 이유 (callback 처리 분기 동일, enum 확장 이득 없음) 와 향후 재검토 조건 ("분리해야 할 동작이 늘어나면") 이 함께 기술되어 있다. 연속성 위반 아님. 구현 시 `mode='reauthorize'` 분기가 `pending_install` 과 `connected` 상태를 올바르게 구분하는지 확인 필요.
+  - 제안: 없음 (Rationale 기술 적절).
+
+---
+
+### 발견사항 5
+
+- **[INFO]** `install_token` persistent 격상 — 옛 `callback 성공 시 NULL 처리` 가정의 명시적 번복
+  - target 위치: `spec/2-navigation/4-integration.md` Rationale "Cafe24 App URL 재호출 흐름 — install_token persistent 격상 (2026-05-15)" 항
+  - 과거 결정 출처: 동일 spec 의 옛 single-use 가정 ("callback 성공 시 `installToken=NULL` 소거")
+  - 상세: 번복 이유(post-install navigation 신규 요구사항 발견, 운영 사용자 보고) 와 옛 행 호환 처리 방침이 기술되어 있다. NULL 처리가 유지되는 경로(`pending_install → expired`, 삭제)도 명시. Rationale 연속성 관점에서 적절하게 처리된 번복이다.
+  - 제안: 없음 (Rationale 기술 적절). 구현 시 `handleInstall` 의 status 분기가 spec 의 `install_token` persistent 전제와 일치하는지 확인.
+
+---
+
+## 요약
+
+`spec/2-navigation/4-integration.md` Rationale 전반은 기각된 대안·번복 결정에 대해 상당히 상세한 근거 기술을 유지하고 있어, Rationale 연속성 관점에서 큰 위반은 발견되지 않는다. 다만 두 가지 WARNING 이 존재한다: (1) `tryRecoverByMallId` 회복 분기가 기각된 "O(N) mall_id 스캔 + trial HMAC" 패턴과 표현상 유사해, Rationale 의 보안 전제 항을 함께 숙지하지 않은 구현자가 혼동할 위험이 있다 — 구현 시 `RECOVERY_CANDIDATE_LIMIT`, 정상 흐름 선행 보장을 코드 레벨에서 검증해야 한다. (2) `expired (refresh_failed)` → `error(auth_failed)` 번복이 Rationale 에는 서술되어 있으나, spec 본문 §6 상태 전이 표가 실제로 동기화되었는지 착수 전 확인이 필요하다. INFO 3건은 모두 Rationale 기술이 적절히 이루어진 사례로, 구현 레벨 주의 사항만 메모한다. Target 문서 내용이 `(없음)`으로 제공되어 구현 코드 자체의 직접 점검은 불가했으며, 본 검토는 Rationale 발췌 기반 분석에 한정된다.
+
+## 위험도
+
+LOW

```
