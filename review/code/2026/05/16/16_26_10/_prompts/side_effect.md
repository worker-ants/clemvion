# 부작용(Side Effect) Review Payload

본 파일은 orchestrator 가 부작용(Side Effect) reviewer 용으로 작성한 입력입니다. 다음 코드 변경이 의도하지 않은 부작용을 일으키지 않는지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (부작용(Side Effect))

1. **의도치 않은 상태 변경**: 함수가 예상 외의 전역/공유 상태를 변경하는지
2. **전역 변수**: 전역 변수 수정 또는 새 전역 변수 도입
3. **파일시스템 부작용**: 예상치 못한 파일 생성·수정·삭제
4. **시그니처 변경**: 기존 함수/메서드 시그니처 변경의 호출자 영향
5. **인터페이스 변경**: 공개 API 변경이 기존 사용자에 미치는 영향
6. **환경 변수**: 환경 변수의 예상치 못한 읽기/쓰기
7. **네트워크 호출**: 의도하지 않은 외부 서비스 호출
8. **이벤트/콜백**: 이벤트 발생·콜백 호출의 변경

## 리뷰 대상 파일

### 파일 1: backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts b/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts
index 766e1191..ddc552cb 100644
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
index faf57dde..107e40e5 100644
--- a/backend/src/modules/integrations/integration-oauth.service.ts
+++ b/backend/src/modules/integrations/integration-oauth.service.ts
@@ -321,8 +321,7 @@ const CAFE24_PRECHECK_STATUS_PRIORITY = [
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

---

### 파일 5: backend/src/nodes/integration/cafe24/metadata/application.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/application.ts b/backend/src/nodes/integration/cafe24/metadata/application.ts
index 8b44ccaf..371c30a6 100644
--- a/backend/src/nodes/integration/cafe24/metadata/application.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/application.ts
@@ -170,119 +170,4 @@ export const applicationOperations: Cafe24OperationMetadata[] = [
     responseShape: 'list',
     paginated: true,
   },
-  // Phase 8g — Application 완성 (appstore orders + payments + databridge + recipes)
-  {
-    id: 'appstore_orders_get',
-    label: '앱스토어 주문 조회',
-    description: 'Retrieve a Cafe24 appstore order.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'appstore/orders/{order_id}',
-    requiredFields: ['order_id'],
-    fields: {
-      order_id: { type: 'string', location: 'path' },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'appstore_orders_create',
-    label: '앱스토어 주문 생성',
-    description: 'Create a Cafe24 appstore order. Body schema partial — refer to Cafe24 docs.',
-    scopeType: 'write',
-    method: 'POST',
-    path: 'appstore/orders',
-    requiredFields: [],
-    fields: {
-      shop_no: { type: 'number', location: 'body', default: 1 },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'appstore_payments_list',
-    label: '앱스토어 결제 목록',
-    description: 'List Cafe24 appstore payments.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'appstore/payments',
-    requiredFields: [],
-    fields: {
-      shop_no: { type: 'number', location: 'query', default: 1 },
-      start_date: { type: 'string', location: 'query' },
-      end_date: { type: 'string', location: 'query' },
-    },
-    responseShape: 'list',
-    paginated: true,
-  },
-  {
-    id: 'appstore_payments_count',
-    label: '앱스토어 결제 수',
-    description: 'Retrieve the count of Cafe24 appstore payments.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'appstore/payments/count',
-    requiredFields: [],
-    fields: {
-      shop_no: { type: 'number', location: 'query', default: 1 },
-      start_date: { type: 'string', location: 'query' },
-      end_date: { type: 'string', location: 'query' },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'databridge_logs_list',
-    label: 'DataBridge 로그 목록',
-    description: 'List DataBridge webhook logs.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'databridge/logs',
-    requiredFields: [],
-    fields: {
-      shop_no: { type: 'number', location: 'query', default: 1 },
-      start_date: { type: 'string', location: 'query' },
-      end_date: { type: 'string', location: 'query' },
-    },
-    responseShape: 'list',
-    paginated: true,
-  },
-  {
-    id: 'recipes_list',
-    label: '레시피 목록 조회',
-    description: 'List recipes (DataBridge automation recipes).',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'recipes',
-    requiredFields: [],
-    fields: {
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'list',
-    paginated: true,
-  },
-  {
-    id: 'recipes_create',
-    label: '레시피 생성',
-    description: 'Create a recipe. Body schema partial — refer to Cafe24 docs.',
-    scopeType: 'write',
-    method: 'POST',
-    path: 'recipes',
-    requiredFields: ['recipe_name'],
-    fields: {
-      shop_no: { type: 'number', location: 'body', default: 1 },
-      recipe_name: { type: 'string', location: 'body' },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'recipes_delete',
-    label: '레시피 삭제',
-    description: 'Delete a recipe by recipe_no.',
-    scopeType: 'write',
-    method: 'DELETE',
-    path: 'recipes/{recipe_no}',
-    requiredFields: ['recipe_no'],
-    fields: {
-      recipe_no: { type: 'number', location: 'path' },
-    },
-    responseShape: 'single',
-  },
 ];

```

---

### 파일 6: backend/src/nodes/integration/cafe24/metadata/collection.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/collection.ts b/backend/src/nodes/integration/cafe24/metadata/collection.ts
index c49372e0..ef00f99e 100644
--- a/backend/src/nodes/integration/cafe24/metadata/collection.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/collection.ts
@@ -102,115 +102,4 @@ export const collectionOperations: Cafe24OperationMetadata[] = [
     },
     responseShape: 'single',
   },
-  // Phase 8h — Collection 완성 (manufacturers + trends + classifications + origin)
-  {
-    id: 'manufacturers_count',
-    label: '제조사 개수 조회',
-    description: 'Retrieve the count of manufacturers.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'manufacturers/count',
-    requiredFields: [],
-    fields: {
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'manufacturers_get',
-    label: '제조사 단건 조회',
-    description: 'Retrieve a manufacturer by manufacturer_code.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'manufacturers/{manufacturer_code}',
-    requiredFields: ['manufacturer_code'],
-    fields: {
-      manufacturer_code: { type: 'string', location: 'path' },
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'manufacturers_create',
-    label: '제조사 생성',
-    description: 'Create a manufacturer. Body schema partial — refer to Cafe24 docs.',
-    scopeType: 'write',
-    method: 'POST',
-    path: 'manufacturers',
-    requiredFields: ['manufacturer_name'],
-    fields: {
-      shop_no: { type: 'number', location: 'body', default: 1 },
-      manufacturer_name: { type: 'string', location: 'body' },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'manufacturers_update',
-    label: '제조사 수정',
-    description: 'Update a manufacturer (partial).',
-    scopeType: 'write',
-    method: 'PUT',
-    path: 'manufacturers/{manufacturer_code}',
-    requiredFields: ['manufacturer_code'],
-    fields: {
-      manufacturer_code: { type: 'string', location: 'path' },
-      shop_no: { type: 'number', location: 'body', default: 1 },
-      manufacturer_name: { type: 'string', location: 'body' },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'trends_count',
-    label: '트렌드 개수 조회',
-    description: 'Retrieve the count of trend tags.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'trends/count',
-    requiredFields: [],
-    fields: {
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'classifications_list',
-    label: '사용자 정의 카테고리 목록',
-    description: 'List custom (user-defined) classifications.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'classifications',
-    requiredFields: [],
-    fields: {
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'list',
-    paginated: true,
-  },
-  {
-    id: 'classifications_count',
-    label: '사용자 정의 카테고리 수',
-    description: 'Retrieve the count of custom classifications.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'classifications/count',
-    requiredFields: [],
-    fields: {
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'origin_list',
-    label: '원산지 목록 조회',
-    description: 'List country-of-origin entries.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'origin',
-    requiredFields: [],
-    fields: {
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'list',
-    paginated: true,
-  },
 ];

```

#### 전체 파일 컨텍스트
```
import type { Cafe24OperationMetadata } from './types.js';

export const collectionOperations: Cafe24OperationMetadata[] = [
  {
    id: 'brands_list',
    label: '브랜드 목록 조회',
    description: 'List brands in the mall.',
    scopeType: 'read',
    method: 'GET',
    path: 'brands',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'manufacturers_list',
    label: '제조사 목록 조회',
    description: 'List manufacturers.',
    scopeType: 'read',
    method: 'GET',
    path: 'manufacturers',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'trends_list',
    label: '트렌드 목록 조회',
    description: 'List trends.',
    scopeType: 'read',
    method: 'GET',
    path: 'trends',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
  // Phase 6d — collection (brands CRUD baseline)
  {
    id: 'brands_count',
    label: '브랜드 개수 조회',
    description: 'Retrieve the count of brands.',
    scopeType: 'read',
    method: 'GET',
    path: 'brands/count',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'brands_create',
    label: '브랜드 생성',
    description: 'Create a brand. brand_name required.',
    scopeType: 'write',
    method: 'POST',
    path: 'brands',
    requiredFields: ['brand_name'],
    fields: {
      shop_no: { type: 'number', location: 'body', default: 1 },
      brand_name: { type: 'string', location: 'body' },
      brand_code: { type: 'string', location: 'body' },
      brand_description: { type: 'string', location: 'body' },
    },
    responseShape: 'single',
  },
  {
    id: 'brands_update',
    label: '브랜드 수정',
    description: 'Update a brand by brand_code.',
    scopeType: 'write',
    method: 'PUT',
    path: 'brands/{brand_code}',
    requiredFields: ['brand_code'],
    fields: {
      brand_code: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
      brand_name: { type: 'string', location: 'body' },
      brand_description: { type: 'string', location: 'body' },
    },
    responseShape: 'single',
  },
  {
    id: 'brands_delete',
    label: '브랜드 삭제',
    description: 'Delete a brand by brand_code.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'brands/{brand_code}',
    requiredFields: ['brand_code'],
    fields: {
      brand_code: { type: 'string', location: 'path' },
    },
    responseShape: 'single',
  },
];

```

---

### 파일 7: backend/src/nodes/integration/cafe24/metadata/community.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/community.ts b/backend/src/nodes/integration/cafe24/metadata/community.ts
index d2df1663..9fab5fdf 100644
--- a/backend/src/nodes/integration/cafe24/metadata/community.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/community.ts
@@ -49,7 +49,7 @@ export const communityOperations: Cafe24OperationMetadata[] = [
   {
     id: 'boards_settings_get',
     label: '게시판 설정 조회',
-    description: 'Retrieve a board\'s settings.',
+    description: "Retrieve a board's settings.",
     scopeType: 'read',
     method: 'GET',
     path: 'boards/{board_no}',
@@ -63,7 +63,7 @@ export const communityOperations: Cafe24OperationMetadata[] = [
   {
     id: 'boards_settings_update',
     label: '게시판 설정 수정',
-    description: 'Update a board\'s settings (partial).',
+    description: "Update a board's settings (partial).",
     scopeType: 'write',
     method: 'PUT',
     path: 'boards/{board_no}',
@@ -204,166 +204,4 @@ export const communityOperations: Cafe24OperationMetadata[] = [
     },
     responseShape: 'single',
   },
-  // Phase 8j — Community 완성 (boards extras + commenttemplates rest + financials + urgentinquiry)
-  {
-    id: 'boards_comments_bulk',
-    label: '게시판 댓글 일괄 조회',
-    description: 'Bulk list of comments across a board (all articles).',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'boards/{board_no}/comments',
-    requiredFields: ['board_no'],
-    fields: {
-      board_no: { type: 'number', location: 'path' },
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'list',
-    paginated: true,
-  },
-  {
-    id: 'boards_seo_get',
-    label: '게시판 SEO 조회',
-    description: "Retrieve a board's SEO settings.",
-    scopeType: 'read',
-    method: 'GET',
-    path: 'boards/{board_no}/seo',
-    requiredFields: ['board_no'],
-    fields: {
-      board_no: { type: 'number', location: 'path' },
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'boards_seo_update',
-    label: '게시판 SEO 수정',
-    description: "Update a board's SEO settings (partial).",
-    scopeType: 'write',
-    method: 'PUT',
-    path: 'boards/{board_no}/seo',
-    requiredFields: ['board_no'],
-    fields: {
-      board_no: { type: 'number', location: 'path' },
-      shop_no: { type: 'number', location: 'body', default: 1 },
-      meta_title: { type: 'string', location: 'body' },
-      meta_description: { type: 'string', location: 'body' },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'commenttemplates_get',
-    label: '자주 쓰는 답변 단건',
-    description: 'Retrieve a single comment template by template_no.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'commenttemplates/{template_no}',
-    requiredFields: ['template_no'],
-    fields: {
-      template_no: { type: 'number', location: 'path' },
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'commenttemplates_update',
-    label: '자주 쓰는 답변 수정',
-    description: 'Update a comment template (partial).',
-    scopeType: 'write',
-    method: 'PUT',
-    path: 'commenttemplates/{template_no}',
-    requiredFields: ['template_no'],
-    fields: {
-      template_no: { type: 'number', location: 'path' },
-      shop_no: { type: 'number', location: 'body', default: 1 },
-      template_name: { type: 'string', location: 'body' },
-      template_content: { type: 'string', location: 'body' },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'commenttemplates_delete',
-    label: '자주 쓰는 답변 삭제',
-    description: 'Delete a comment template.',
-    scopeType: 'write',
-    method: 'DELETE',
-    path: 'commenttemplates/{template_no}',
-    requiredFields: ['template_no'],
-    fields: {
-      template_no: { type: 'number', location: 'path' },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'financials_monthlyreviews_count',
-    label: '월별 후기 카운트',
-    description: 'Retrieve the count of product reviews by month.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'financials/monthlyreviews/count',
-    requiredFields: [],
-    fields: {
-      shop_no: { type: 'number', location: 'query', default: 1 },
-      start_month: { type: 'string', location: 'query' },
-      end_month: { type: 'string', location: 'query' },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'urgentinquiry_get',
-    label: '긴급 문의 게시글 조회',
-    description: 'Retrieve an urgent-inquiry article by inquiry_no.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'urgentinquiry/{inquiry_no}',
-    requiredFields: ['inquiry_no'],
-    fields: {
-      inquiry_no: { type: 'number', location: 'path' },
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'urgentinquiry_reply_get',
-    label: '긴급 문의 답변 조회',
-    description: 'Retrieve the reply to an urgent inquiry.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'urgentinquiry/{inquiry_no}/reply',
-    requiredFields: ['inquiry_no'],
-    fields: {
-      inquiry_no: { type: 'number', location: 'path' },
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'urgentinquiry_reply_create',
-    label: '긴급 문의 답변 작성',
-    description: 'Create a reply to an urgent inquiry.',
-    scopeType: 'write',
-    method: 'POST',
-    path: 'urgentinquiry/{inquiry_no}/reply',
-    requiredFields: ['inquiry_no', 'content'],
-    fields: {
-      inquiry_no: { type: 'number', location: 'path' },
-      shop_no: { type: 'number', location: 'body', default: 1 },
-      content: { type: 'string', location: 'body' },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'urgentinquiry_reply_update',
-    label: '긴급 문의 답변 수정',
-    description: 'Update the reply to an urgent inquiry (partial).',
-    scopeType: 'write',
-    method: 'PUT',
-    path: 'urgentinquiry/{inquiry_no}/reply',
-    requiredFields: ['inquiry_no'],
-    fields: {
-      inquiry_no: { type: 'number', location: 'path' },
-      shop_no: { type: 'number', location: 'body', default: 1 },
-      content: { type: 'string', location: 'body' },
-    },
-    responseShape: 'single',
-  },
 ];

```

---

### 파일 8: backend/src/nodes/integration/cafe24/metadata/customer.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/customer.ts b/backend/src/nodes/integration/cafe24/metadata/customer.ts
index 13876ce7..fa99714a 100644
--- a/backend/src/nodes/integration/cafe24/metadata/customer.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/customer.ts
@@ -206,7 +206,7 @@ export const customerOperations: Cafe24OperationMetadata[] = [
   {
     id: 'customer_paymentinfo_list',
     label: '회원 결제수단 목록',
-    description: 'List a customer\'s saved payment methods.',
+    description: "List a customer's saved payment methods.",
     scopeType: 'read',
     method: 'GET',
     path: 'customers/{member_id}/paymentinformation',
@@ -234,7 +234,7 @@ export const customerOperations: Cafe24OperationMetadata[] = [
   {
     id: 'customer_paymentinfo_delete_by_id',
     label: '회원 결제수단 ID 삭제',
-    description: "Remove a specific payment method from a customer.",
+    description: 'Remove a specific payment method from a customer.',
     scopeType: 'write',
     method: 'DELETE',
     path: 'customers/{member_id}/paymentinformation/{payment_method_id}',

```

---

### 파일 9: backend/src/nodes/integration/cafe24/metadata/design.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/design.ts b/backend/src/nodes/integration/cafe24/metadata/design.ts
index 7355d1e1..15828c5c 100644
--- a/backend/src/nodes/integration/cafe24/metadata/design.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/design.ts
@@ -15,117 +15,4 @@ export const designOperations: Cafe24OperationMetadata[] = [
     responseShape: 'list',
     paginated: true,
   },
-  // Phase 8i — Design 완성 (themes count/get + theme_pages CRUD + icons)
-  {
-    id: 'themes_count',
-    label: '테마 개수 조회',
-    description: 'Retrieve the count of installed themes.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'themes/count',
-    requiredFields: [],
-    fields: {
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'themes_get',
-    label: '테마 단건 조회',
-    description: 'Retrieve a single theme by theme_no.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'themes/{theme_no}',
-    requiredFields: ['theme_no'],
-    fields: {
-      theme_no: { type: 'number', location: 'path' },
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'theme_pages_get',
-    label: '테마 페이지 조회',
-    description: 'Retrieve theme page contents (HTML/CSS).',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'themes/{theme_no}/pages/{page_path}',
-    requiredFields: ['theme_no', 'page_path'],
-    fields: {
-      theme_no: { type: 'number', location: 'path' },
-      page_path: { type: 'string', location: 'path' },
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'theme_pages_create',
-    label: '테마 페이지 생성',
-    description: 'Create a theme page. Body schema partial — refer to Cafe24 docs.',
-    scopeType: 'write',
-    method: 'POST',
-    path: 'themes/{theme_no}/pages',
-    requiredFields: ['theme_no', 'page_path'],
-    fields: {
-      theme_no: { type: 'number', location: 'path' },
-      shop_no: { type: 'number', location: 'body', default: 1 },
-      page_path: { type: 'string', location: 'body' },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'theme_pages_update',
-    label: '테마 페이지 수정',
-    description: 'Update theme page contents (partial). Refer to Cafe24 docs for full schema.',
-    scopeType: 'write',
-    method: 'PUT',
-    path: 'themes/{theme_no}/pages/{page_path}',
-    requiredFields: ['theme_no', 'page_path'],
-    fields: {
-      theme_no: { type: 'number', location: 'path' },
-      page_path: { type: 'string', location: 'path' },
-      shop_no: { type: 'number', location: 'body', default: 1 },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'theme_pages_delete',
-    label: '테마 페이지 삭제',
-    description: 'Delete a theme page.',
-    scopeType: 'write',
-    method: 'DELETE',
-    path: 'themes/{theme_no}/pages/{page_path}',
-    requiredFields: ['theme_no', 'page_path'],
-    fields: {
-      theme_no: { type: 'number', location: 'path' },
-      page_path: { type: 'string', location: 'path' },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'icons_list',
-    label: '디자인 아이콘 목록 조회',
-    description: 'List storefront design icons (new/best/sale badges, etc.).',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'icons',
-    requiredFields: [],
-    fields: {
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'list',
-  },
-  {
-    id: 'icons_update_settings',
-    label: '상점 아이콘 설정 수정',
-    description: 'Update storefront icon settings (partial). Refer to Cafe24 docs for full schema.',
-    scopeType: 'write',
-    method: 'PUT',
-    path: 'icons',
-    requiredFields: [],
-    fields: {
-      shop_no: { type: 'number', location: 'body', default: 1 },
-    },
-    responseShape: 'single',
-  },
 ];

```

#### 전체 파일 컨텍스트
```
import type { Cafe24OperationMetadata } from './types.js';

export const designOperations: Cafe24OperationMetadata[] = [
  {
    id: 'themes_list',
    label: '테마 목록 조회',
    description: 'List installed themes.',
    scopeType: 'read',
    method: 'GET',
    path: 'themes',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
];

```

---

### 파일 10: backend/src/nodes/integration/cafe24/metadata/mileage.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/mileage.ts b/backend/src/nodes/integration/cafe24/metadata/mileage.ts
index 2653ad9c..8a726675 100644
--- a/backend/src/nodes/integration/cafe24/metadata/mileage.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/mileage.ts
@@ -113,7 +113,8 @@ export const mileageOperations: Cafe24OperationMetadata[] = [
   {
     id: 'credits_report',
     label: '예치금 리포트 조회',
-    description: 'Retrieve the credit (예치금) summary report for a date range.',
+    description:
+      'Retrieve the credit (예치금) summary report for a date range.',
     scopeType: 'read',
     method: 'GET',
     path: 'credits/report',
@@ -125,20 +126,4 @@ export const mileageOperations: Cafe24OperationMetadata[] = [
     },
     responseShape: 'single',
   },
-  // Phase 8a — Mileage 완성
-  {
-    id: 'points_report',
-    label: '적립금 리포트 조회',
-    description: 'Retrieve a points (mileage) report by date range.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'points/report',
-    requiredFields: ['start_date', 'end_date'],
-    fields: {
-      shop_no: { type: 'number', location: 'query', default: 1 },
-      start_date: { type: 'string', location: 'query' },
-      end_date: { type: 'string', location: 'query' },
-    },
-    responseShape: 'single',
-  },
 ];

```

#### 전체 파일 컨텍스트
```
import type { Cafe24OperationMetadata } from './types.js';

export const mileageOperations: Cafe24OperationMetadata[] = [
  {
    id: 'mileage_list',
    label: '적립금 내역 조회',
    description: 'List mileage (loyalty point) transactions.',
    scopeType: 'read',
    method: 'GET',
    path: 'points',
    requiredFields: ['shop_no'],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      member_id: { type: 'string', location: 'query' },
      start_date: { type: 'string', location: 'query' },
      end_date: { type: 'string', location: 'query' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'mileage_grant',
    label: '적립금 지급',
    description: 'Grant mileage to a member.',
    scopeType: 'write',
    method: 'POST',
    path: 'points',
    requiredFields: ['member_id', 'amount', 'reason'],
    fields: {
      shop_no: { type: 'number', location: 'body', default: 1 },
      member_id: { type: 'string', location: 'body' },
      amount: {
        type: 'string',
        location: 'body',
        description: 'Positive decimal — grant amount',
      },
      reason: { type: 'string', location: 'body' },
      type: {
        type: 'enum',
        location: 'body',
        enum: ['increase', 'decrease'],
        default: 'increase',
      },
    },
    responseShape: 'single',
  },
  // Phase 6e — Mileage 보완
  {
    id: 'points_autoexpiration_get',
    label: '적립금 자동 만료 조회',
    description:
      'Retrieve an automatic points-expiration rule by id. Uses codebase `member_id` for the customer reference (Cafe24 docs vary by endpoint).',
    scopeType: 'read',
    method: 'GET',
    path: 'points/autoexpiration/{id}',
    requiredFields: ['id'],
    fields: {
      id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'points_autoexpiration_create',
    label: '적립금 자동 만료 생성',
    description:
      'Register an automatic points-expiration rule. Body should include customer reference + expiration_date + points_amount.',
    scopeType: 'write',
    method: 'POST',
    path: 'points/autoexpiration',
    requiredFields: ['member_id', 'expiration_date', 'points_amount'],
    fields: {
      shop_no: { type: 'number', location: 'body', default: 1 },
      member_id: { type: 'string', location: 'body' },
      expiration_date: { type: 'string', location: 'body' },
      points_amount: {
        type: 'string',
        location: 'body',
        description: 'Decimal string — amount of poin

... (truncated due to prompt size limit) ...
```

---

### 파일 11: backend/src/nodes/integration/cafe24/metadata/notification.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/notification.ts b/backend/src/nodes/integration/cafe24/metadata/notification.ts
index 9ce6e2e8..3940fd6f 100644
--- a/backend/src/nodes/integration/cafe24/metadata/notification.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/notification.ts
@@ -114,61 +114,4 @@ export const notificationOperations: Cafe24OperationMetadata[] = [
     },
     responseShape: 'single',
   },
-  // Phase 8e — Notification 완성 (invitation + recipientgroups CUD)
-  {
-    id: 'customers_invitation_send',
-    label: '회원 활성화 초대 발송',
-    description: 'Send an invitation to a member to activate their account.',
-    scopeType: 'write',
-    method: 'POST',
-    path: 'customers/invitation',
-    requiredFields: ['member_id'],
-    fields: {
-      shop_no: { type: 'number', location: 'body', default: 1 },
-      member_id: { type: 'string', location: 'body' },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'recipientgroups_create',
-    label: '수신자 그룹 생성',
-    description: 'Create a distribution group. Body schema partial — refer to Cafe24 docs.',
-    scopeType: 'write',
-    method: 'POST',
-    path: 'recipientgroups',
-    requiredFields: ['group_name'],
-    fields: {
-      shop_no: { type: 'number', location: 'body', default: 1 },
-      group_name: { type: 'string', location: 'body' },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'recipientgroups_update',
-    label: '수신자 그룹 수정',
-    description: 'Update a distribution group (partial).',
-    scopeType: 'write',
-    method: 'PUT',
-    path: 'recipientgroups/{group_no}',
-    requiredFields: ['group_no'],
-    fields: {
-      group_no: { type: 'number', location: 'path' },
-      shop_no: { type: 'number', location: 'body', default: 1 },
-      group_name: { type: 'string', location: 'body' },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'recipientgroups_delete',
-    label: '수신자 그룹 삭제',
-    description: 'Delete a distribution group by group_no.',
-    scopeType: 'write',
-    method: 'DELETE',
-    path: 'recipientgroups/{group_no}',
-    requiredFields: ['group_no'],
-    fields: {
-      group_no: { type: 'number', location: 'path' },
-    },
-    responseShape: 'single',
-  },
 ];

```

#### 전체 파일 컨텍스트
```
import type { Cafe24OperationMetadata } from './types.js';

export const notificationOperations: Cafe24OperationMetadata[] = [
  {
    id: 'sms_send',
    label: 'SMS 발송',
    description: 'Send an SMS via the Cafe24 SMS service.',
    scopeType: 'write',
    method: 'POST',
    path: 'sms',
    requiredFields: ['sender', 'receiver', 'content'],
    fields: {
      shop_no: { type: 'number', location: 'body', default: 1 },
      sender: { type: 'string', location: 'body' },
      receiver: { type: 'string', location: 'body' },
      content: { type: 'string', location: 'body' },
    },
    responseShape: 'single',
  },
  {
    id: 'sms_balance_get',
    label: 'SMS 잔액 조회',
    description: 'Get the remaining SMS credit balance.',
    scopeType: 'read',
    method: 'GET',
    path: 'sms/balance',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  // Phase 6f — Notification 보완
  {
    id: 'sms_senders_list',
    label: 'SMS 발신자 목록 조회',
    description: 'List the registered SMS sender numbers.',
    scopeType: 'read',
    method: 'GET',
    path: 'sms/senders',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
  },
  {
    id: 'sms_receivers_get',
    label: 'SMS 수신자 조회',
    description: 'Retrieve a single SMS recipient.',
    scopeType: 'read',
    method: 'GET',
    path: 'sms/receivers',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      member_id: { type: 'string', location: 'query' },
      cellphone: { type: 'string', location: 'query' },
    },
    responseShape: 'single',
  },
  {
    id: 'automails_get',
    label: '자동 이메일 설정 조회',
    description: 'Retrieve the automated email settings.',
    scopeType: 'read',
    method: 'GET',
    path: 'automails',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'automails_update',
    label: '자동 이메일 설정 수정',
    description:
      'Update the automated email settings. Body fields are partial — refer to Cafe24 docs for the full schema.',
    scopeType: 'write',
    method: 'PUT',
    path: 'automails',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'body', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'recipientgroups_list',
    label: '수신자 그룹 목록',
    description: 'List distribution (recipient) groups.',
    scopeType: 'read',
    method: 'GET',
    path: 'recipientgroups',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'recipientgroups_get',
    label: '수신자 그룹 상세',
    description: 'Retrieve details of a single distribution group by group_no.',
    scopeType: 'read',
    method: 'GET',
    path: 'recipientgroups/{group_no}',
    requiredFields: ['group_no'],
    fields: {
      group_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
];

```

---

### 파일 12: backend/src/nodes/integration/cafe24/metadata/personal.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/personal.ts b/backend/src/nodes/integration/cafe24/metadata/personal.ts
index 54a60de6..26ac1405 100644
--- a/backend/src/nodes/integration/cafe24/metadata/personal.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/personal.ts
@@ -31,48 +31,4 @@ export const personalOperations: Cafe24OperationMetadata[] = [
     responseShape: 'list',
     paginated: true,
   },
-  // Phase 8d — Personal 완성
-  {
-    id: 'customers_wishlist_count',
-    label: '위시리스트 상품 개수',
-    description: "Retrieve the count of products in a customer's wishlist.",
-    scopeType: 'read',
-    method: 'GET',
-    path: 'customers/wishlist/count',
-    requiredFields: [],
-    fields: {
-      shop_no: { type: 'number', location: 'query', default: 1 },
-      member_id: { type: 'string', location: 'query' },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'products_carts_count',
-    label: '상품 담은 장바구니 수',
-    description: 'Retrieve the count of carts containing a given product.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'products/{product_no}/carts/count',
-    requiredFields: ['product_no'],
-    fields: {
-      product_no: { type: 'number', location: 'path' },
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'products_carts_list',
-    label: '상품 담은 장바구니 목록',
-    description: 'List carts that contain a given product.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'products/{product_no}/carts',
-    requiredFields: ['product_no'],
-    fields: {
-      product_no: { type: 'number', location: 'path' },
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'list',
-    paginated: true,
-  },
 ];

```

#### 전체 파일 컨텍스트
```
import type { Cafe24OperationMetadata } from './types.js';

export const personalOperations: Cafe24OperationMetadata[] = [
  {
    id: 'carts_list',
    label: '장바구니 목록 조회',
    description: 'List shopping carts for members.',
    scopeType: 'read',
    method: 'GET',
    path: 'carts',
    requiredFields: ['shop_no'],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      member_id: { type: 'string', location: 'query' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'wishlists_list',
    label: '위시리스트 조회',
    description: 'List wishlists for members.',
    scopeType: 'read',
    method: 'GET',
    path: 'wishlists',
    requiredFields: ['shop_no'],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      member_id: { type: 'string', location: 'query' },
    },
    responseShape: 'list',
    paginated: true,
  },
];

```

---

### 파일 13: backend/src/nodes/integration/cafe24/metadata/planned.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/planned.ts b/backend/src/nodes/integration/cafe24/metadata/planned.ts
index 3e2b60c2..43ef6c22 100644
--- a/backend/src/nodes/integration/cafe24/metadata/planned.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/planned.ts
@@ -339,18 +339,102 @@ export const CAFE24_PLANNED_BY_RESOURCE: Record<
     { id: 'unpaidorders_list', label: '미결제 주문 목록', paginated: true },
   ],
   customer: [],
-  community: [],
-  design: [],
-  promotion: [],
-  application: [],
+  community: [
+    { id: 'boards_comments_bulk', label: '게시판 댓글 일괄 조회' },
+    { id: 'boards_seo_get', label: '게시판 SEO 조회' },
+    { id: 'boards_seo_update', label: '게시판 SEO 수정' },
+    { id: 'commenttemplates_get', label: '자주 쓰는 답변 단건' },
+    { id: 'commenttemplates_update', label: '자주 쓰는 답변 수정' },
+    { id: 'commenttemplates_delete', label: '자주 쓰는 답변 삭제' },
+    { id: 'financials_monthlyreviews_count', label: '월별 후기 카운트' },
+    { id: 'urgentinquiry_get', label: '긴급 문의 게시글 조회' },
+    { id: 'urgentinquiry_reply_get', label: '긴급 문의 답변 조회' },
+    { id: 'urgentinquiry_reply_create', label: '긴급 문의 답변 작성' },
+    { id: 'urgentinquiry_reply_update', label: '긴급 문의 답변 수정' },
+  ],
+  design: [
+    { id: 'themes_count', label: '테마 개수 조회' },
+    { id: 'themes_get', label: '테마 단건 조회' },
+    { id: 'theme_pages_get', label: '테마 페이지 조회' },
+    { id: 'theme_pages_create', label: '테마 페이지 생성' },
+    { id: 'theme_pages_update', label: '테마 페이지 수정' },
+    { id: 'theme_pages_delete', label: '테마 페이지 삭제' },
+    { id: 'icons_list', label: '디자인 아이콘 목록 조회' },
+    { id: 'icons_update_settings', label: '상점 아이콘 설정 수정' },
+  ],
+  promotion: [{ id: 'coupon_manage', label: '쿠폰 관리 (사용/중지)' }],
+  application: [
+    { id: 'appstore_orders_get', label: '앱스토어 주문 조회' },
+    { id: 'appstore_orders_create', label: '앱스토어 주문 생성' },
+    {
+      id: 'appstore_payments_list',
+      label: '앱스토어 결제 목록',
+      paginated: true,
+    },
+    { id: 'appstore_payments_count', label: '앱스토어 결제 수' },
+    {
+      id: 'databridge_logs_list',
+      label: 'DataBridge 로그 목록',
+      paginated: true,
+    },
+    { id: 'recipes_list', label: '레시피 목록 조회', paginated: true },
+    { id: 'recipes_create', label: '레시피 생성' },
+    { id: 'recipes_delete', label: '레시피 삭제' },
+  ],
   category: [],
-  collection: [],
+  collection: [
+    { id: 'manufacturers_count', label: '제조사 개수 조회' },
+    { id: 'manufacturers_get', label: '제조사 단건 조회' },
+    { id: 'manufacturers_create', label: '제조사 생성' },
+    { id: 'manufacturers_update', label: '제조사 수정' },
+    { id: 'trends_count', label: '트렌드 개수 조회' },
+    {
+      id: 'classifications_list',
+      label: '사용자 정의 카테고리 목록',
+      paginated: true,
+    },
+    { id: 'classifications_count', label: '사용자 정의 카테고리 수' },
+    { id: 'origin_list', label: '원산지 목록 조회', paginated: true },
+  ],
   supply: [],
   shipping: [],
   salesreport: [],
-  personal: [],
-  privacy: [],
-  mileage: [],
-  notification: [],
-  translation: [],
+  personal: [
+    { id: 'customers_wishlist_count', label: '위시리스트 상품 개수' },
+    { id: 'products_carts_count', label: '상품 담은 장바구니 수' },
+    {
+      id: 'products_carts_list',
+      label: '상품 담은 장바구니 목록',
+      paginated: true,
+    },
+  ],
+  privacy: [
+    {
+      id: 'customers_privacy_list',
+      label: '회원 개인정보 목록 조회',
+      paginated: true,
+    },
+    { id: 'customers_privacy_count', label: '회원 개인정보 개수 조회' },
+    { id: 'customers_privacy_update', label: '회원 개인정보 수정' },
+    {
+      id: 'products_wishlist_customers_list',
+      label: '위시리스트 보유 회원 목록',
+      paginated: true,
+    },
+    {
+      id: 'products_wishlist_customers_count',
+      label: '위시리스트 보유 회원 수',
+    },
+  ],
+  mileage: [{ id: 'points_report', label: '적립금 리포트 조회' }],
+  notification: [
+    { id: 'customers_invitation_send', label: '회원 활성화 초대 발송' },
+    { id: 'recipientgroups_create', label: '수신자 그룹 생성' },
+    { id: 'recipientgroups_update', label: '수신자 그룹 수정' },
+    { id: 'recipientgroups_delete', label: '수신자 그룹 삭제' },
+  ],
+  translation: [
+    { id: 'translation_themes_get', label: '테마 번역 단건 조회' },
+    { id: 'translation_themes_update', label: '테마 번역 수정' },
+  ],
 };

```

---

### 파일 14: backend/src/nodes/integration/cafe24/metadata/privacy.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/privacy.ts b/backend/src/nodes/integration/cafe24/metadata/privacy.ts
index 59e133d4..df9d941f 100644
--- a/backend/src/nodes/integration/cafe24/metadata/privacy.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/privacy.ts
@@ -16,76 +16,4 @@ export const privacyOperations: Cafe24OperationMetadata[] = [
     },
     responseShape: 'single',
   },
-  // Phase 8f — Privacy 완성
-  {
-    id: 'customers_privacy_list',
-    label: '회원 개인정보 목록 조회',
-    description: 'Retrieve a list of customer privacy records (requires elevated scope).',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'privacy/customers',
-    requiredFields: [],
-    fields: {
-      shop_no: { type: 'number', location: 'query', default: 1 },
-      member_id: { type: 'string', location: 'query' },
-    },
-    responseShape: 'list',
-    paginated: true,
-  },
-  {
-    id: 'customers_privacy_count',
-    label: '회원 개인정보 개수 조회',
-    description: 'Retrieve the count of customer privacy records (requires elevated scope).',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'privacy/customers/count',
-    requiredFields: [],
-    fields: {
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'customers_privacy_update',
-    label: '회원 개인정보 수정',
-    description: 'Update a customer privacy record (partial). Refer to Cafe24 docs for full schema.',
-    scopeType: 'write',
-    method: 'PUT',
-    path: 'privacy/customers/{member_id}',
-    requiredFields: ['member_id'],
-    fields: {
-      member_id: { type: 'string', location: 'path' },
-      shop_no: { type: 'number', location: 'body', default: 1 },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'products_wishlist_customers_list',
-    label: '위시리스트 보유 회원 목록',
-    description: 'List customers who have a given product in their wishlist.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'products/{product_no}/wishlist/customers',
-    requiredFields: ['product_no'],
-    fields: {
-      product_no: { type: 'number', location: 'path' },
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'list',
-    paginated: true,
-  },
-  {
-    id: 'products_wishlist_customers_count',
-    label: '위시리스트 보유 회원 수',
-    description: 'Retrieve the count of customers who have a given product in their wishlist.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'products/{product_no}/wishlist/customers/count',
-    requiredFields: ['product_no'],
-    fields: {
-      product_no: { type: 'number', location: 'path' },
-      shop_no: { type: 'number', location: 'query', default: 1 },
-    },
-    responseShape: 'single',
-  },
 ];

```

#### 전체 파일 컨텍스트
```
import type { Cafe24OperationMetadata } from './types.js';

export const privacyOperations: Cafe24OperationMetadata[] = [
  {
    id: 'customers_privacy_get',
    label: '회원 개인정보 조회',
    description:
      'Read sensitive personal data fields for a customer (requires elevated scope).',
    scopeType: 'read',
    method: 'GET',
    path: 'privacy/customers/{member_id}',
    requiredFields: ['member_id'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
];

```

---

### 파일 15: backend/src/nodes/integration/cafe24/metadata/product.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/product.ts b/backend/src/nodes/integration/cafe24/metadata/product.ts
index b5c26fd2..2643e854 100644
--- a/backend/src/nodes/integration/cafe24/metadata/product.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/product.ts
@@ -241,7 +241,12 @@ export const productOperations: Cafe24OperationMetadata[] = [
     scopeType: 'write',
     method: 'POST',
     path: 'products/{product_no}/options',
-    requiredFields: ['product_no', 'option_name', 'option_type', 'option_values'],
+    requiredFields: [
+      'product_no',
+      'option_name',
+      'option_type',
+      'option_values',
+    ],
     fields: {
       product_no: { type: 'number', location: 'path' },
       shop_no: { type: 'number', location: 'query', default: 1 },
@@ -307,7 +312,8 @@ export const productOperations: Cafe24OperationMetadata[] = [
   {
     id: 'product_seo_get',
     label: '상품 SEO 설정 조회',
-    description: "Retrieve a product's SEO meta settings (title / description / keywords / URL path).",
+    description:
+      "Retrieve a product's SEO meta settings (title / description / keywords / URL path).",
     scopeType: 'read',
     method: 'GET',
     path: 'products/{product_no}/seo',
@@ -321,7 +327,8 @@ export const productOperations: Cafe24OperationMetadata[] = [
   {
     id: 'product_seo_update',
     label: '상품 SEO 설정 수정',
-    description: "Update a product's SEO meta settings. All body fields are optional — provide only the ones to change.",
+    description:
+      "Update a product's SEO meta settings. All body fields are optional — provide only the ones to change.",
     scopeType: 'write',
     method: 'PUT',
     path: 'products/{product_no}/seo',

```

---

### 파일 16: backend/src/nodes/integration/cafe24/metadata/promotion.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/promotion.ts b/backend/src/nodes/integration/cafe24/metadata/promotion.ts
index 96f42d8d..17c474ec 100644
--- a/backend/src/nodes/integration/cafe24/metadata/promotion.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/promotion.ts
@@ -149,7 +149,7 @@ export const promotionOperations: Cafe24OperationMetadata[] = [
     id: 'customers_coupons_list',
     label: '회원별 쿠폰 목록',
     description:
-      "List the coupons a customer holds. Uses the codebase-wide `member_id` path placeholder (Cafe24 docs call this `customer_no`).",
+      'List the coupons a customer holds. Uses the codebase-wide `member_id` path placeholder (Cafe24 docs call this `customer_no`).',
     scopeType: 'read',
     method: 'GET',
     path: 'customers/{member_id}/coupons',
@@ -321,7 +321,8 @@ export const promotionOperations: Cafe24OperationMetadata[] = [
       benefit_scope: {
         type: 'string',
         location: 'body',
-        description: 'Scope (all products / specific category / specific products)',
+        description:
+          'Scope (all products / specific category / specific products)',
       },
       benefit_description: { type: 'string', location: 'body' },
       discount_amount: { type: 'number', location: 'body' },
@@ -399,7 +400,8 @@ export const promotionOperations: Cafe24OperationMetadata[] = [
   {
     id: 'customerevents_update_status',
     label: '회원 정보 이벤트 상태 수정',
-    description: 'Update the run-status of the member-information-update event.',
+    description:
+      'Update the run-status of the member-information-update event.',
     scopeType: 'write',
     method: 'PUT',
     path: 'customerevents',
@@ -578,20 +580,4 @@ export const promotionOperations: Cafe24OperationMetadata[] = [
     },
     responseShape: 'single',
   },
-  // Phase 8b — Promotion 완성 (coupon_manage)
-  {
-    id: 'coupon_manage',
-    label: '쿠폰 관리 (사용/중지)',
-    description: 'Manage a coupon — pause or resume it via `use_coupon` enum.',
-    scopeType: 'write',
-    method: 'PUT',
-    path: 'coupons/{coupon_no}',
-    requiredFields: ['coupon_no'],
-    fields: {
-      coupon_no: { type: 'string', location: 'path' },
-      shop_no: { type: 'number', location: 'body', default: 1 },
-      use_coupon: { type: 'enum', location: 'body', enum: ['T', 'F'] },
-    },
-    responseShape: 'single',
-  },
 ];

```

---

### 파일 17: backend/src/nodes/integration/cafe24/metadata/supply.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/supply.ts b/backend/src/nodes/integration/cafe24/metadata/supply.ts
index 001f09bf..05f0ca59 100644
--- a/backend/src/nodes/integration/cafe24/metadata/supply.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/supply.ts
@@ -47,7 +47,8 @@ export const supplyOperations: Cafe24OperationMetadata[] = [
   {
     id: 'suppliers_create',
     label: '공급사 등록',
-    description: 'Register a new supplier. Body schema partial — refer to Cafe24 docs for full schema.',
+    description:
+      'Register a new supplier. Body schema partial — refer to Cafe24 docs for full schema.',
     scopeType: 'write',
     method: 'POST',
     path: 'suppliers',
@@ -55,14 +56,20 @@ export const supplyOperations: Cafe24OperationMetadata[] = [
     fields: {
       shop_no: { type: 'number', location: 'body', default: 1 },
       supplier_name: { type: 'string', location: 'body' },
-      use_supplier: { type: 'enum', location: 'body', enum: ['T', 'F'], default: 'T' },
+      use_supplier: {
+        type: 'enum',
+        location: 'body',
+        enum: ['T', 'F'],
+        default: 'T',
+      },
     },
     responseShape: 'single',
   },
   {
     id: 'suppliers_update',
     label: '공급사 수정',
-    description: 'Update an existing supplier (partial). Refer to Cafe24 docs for full schema.',
+    description:
+      'Update an existing supplier (partial). Refer to Cafe24 docs for full schema.',
     scopeType: 'write',
     method: 'PUT',
     path: 'suppliers/{supplier_code}',
@@ -134,7 +141,8 @@ export const supplyOperations: Cafe24OperationMetadata[] = [
   {
     id: 'suppliers_users_create',
     label: '공급사 사용자 등록',
-    description: 'Create a supplier user account. Body schema partial — refer to Cafe24 docs.',
+    description:
+      'Create a supplier user account. Body schema partial — refer to Cafe24 docs.',
     scopeType: 'write',
     method: 'POST',
     path: 'suppliers/users',
@@ -192,7 +200,8 @@ export const supplyOperations: Cafe24OperationMetadata[] = [
   {
     id: 'suppliers_users_regional_create',
     label: '사용자 지역별 배송비 등록',
-    description: 'Create regional shipping fee for a supplier user. Body schema partial — refer to Cafe24 docs.',
+    description:
+      'Create regional shipping fee for a supplier user. Body schema partial — refer to Cafe24 docs.',
     scopeType: 'write',
     method: 'POST',
     path: 'suppliers/users/{user_id}/regionalshippingfees',
@@ -233,7 +242,8 @@ export const supplyOperations: Cafe24OperationMetadata[] = [
   {
     id: 'suppliers_users_regional_settings_update',
     label: '지역별 배송비 설정 수정',
-    description: "Update a supplier user's regional shipping fee settings (partial).",
+    description:
+      "Update a supplier user's regional shipping fee settings (partial).",
     scopeType: 'write',
     method: 'PUT',
     path: 'suppliers/users/{user_id}/regionalshippingfees/settings',
@@ -275,7 +285,8 @@ export const supplyOperations: Cafe24OperationMetadata[] = [
   {
     id: 'shipping_suppliers_additionalfees_get',
     label: '공급사 국제 배송 추가비 조회',
-    description: 'Retrieve additional handling fees for supplier international shipping.',
+    description:
+      'Retrieve additional handling fees for supplier international shipping.',
     scopeType: 'read',
     method: 'GET',
     path: 'shipping/suppliers/{supplier_code}/additionalfees',

```

---

### 파일 18: backend/src/nodes/integration/cafe24/metadata/translation.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/translation.ts b/backend/src/nodes/integration/cafe24/metadata/translation.ts
index 1d0a18e3..48732e16 100644
--- a/backend/src/nodes/integration/cafe24/metadata/translation.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/translation.ts
@@ -125,35 +125,4 @@ export const translationOperations: Cafe24OperationMetadata[] = [
     responseShape: 'list',
     paginated: true,
   },
-  // Phase 8c — Translation 완성 (테마 번역 단건 조회/수정)
-  {
-    id: 'translation_themes_get',
-    label: '테마 번역 단건 조회',
-    description: 'Retrieve a single theme translation entry by theme_no.',
-    scopeType: 'read',
-    method: 'GET',
-    path: 'translation/themes/{theme_no}',
-    requiredFields: ['theme_no', 'language_code'],
-    fields: {
-      theme_no: { type: 'number', location: 'path' },
-      shop_no: { type: 'number', location: 'query', default: 1 },
-      language_code: { type: 'string', location: 'query' },
-    },
-    responseShape: 'single',
-  },
-  {
-    id: 'translation_themes_update',
-    label: '테마 번역 수정',
-    description: 'Update a single theme translation entry (partial). Refer to Cafe24 docs for full body schema.',
-    scopeType: 'write',
-    method: 'PUT',
-    path: 'translation/themes/{theme_no}',
-    requiredFields: ['theme_no', 'language_code'],
-    fields: {
-      theme_no: { type: 'number', location: 'path' },
-      shop_no: { type: 'number', location: 'query', default: 1 },
-      language_code: { type: 'string', location: 'query' },
-    },
-    responseShape: 'single',
-  },
 ];

```

---

### 파일 19: frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx
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

---

### 파일 20: frontend/src/app/(main)/integrations/new/page.tsx
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

---

### 파일 21: frontend/src/lib/api/integrations.ts
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

---

### 파일 22: plan/in-progress/cafe24-mall-dup-followup.md
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

---

### 파일 23: spec/conventions/cafe24-api-catalog/_overview.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/conventions/cafe24-api-catalog/_overview.md b/spec/conventions/cafe24-api-catalog/_overview.md
index 700403eb..d3eef58c 100644
--- a/spec/conventions/cafe24-api-catalog/_overview.md
+++ b/spec/conventions/cafe24-api-catalog/_overview.md
@@ -87,21 +87,21 @@ resource 이름은 `Cafe24Resource` enum (`backend/src/nodes/integration/cafe24/
 | [product](./product.md) | 14 | 25+ | 28 |
 | [order](./order.md) | 17 | 30+ | 47 |
 | [customer](./customer.md) | 24 | 0 | 12 |
-| [community](./community.md) | 24 | 0 | 9 |
-| [design](./design.md) | 9 | 0 | 3 |
-| [promotion](./promotion.md) | 35 | 0 | 10 |
-| [application](./application.md) | 19 | 0 | 8 |
+| [community](./community.md) | 13 | 15+ | 9 |
+| [design](./design.md) | 1 | 5+ | 3 |
+| [promotion](./promotion.md) | 34 | 6+ | 10 |
+| [application](./application.md) | 11 | 7+ | 8 |
 | [category](./category.md) | 19 | 0 | 5 |
-| [collection](./collection.md) | 15 | 0 | 5 |
+| [collection](./collection.md) | 7 | 6+ | 5 |
 | [supply](./supply.md) | 20 | 0 | 6 |
 | [shipping](./shipping.md) | 15 | 0 | 5 |
 | [salesreport](./salesreport.md) | 5 | 0 | 5 |
-| [personal](./personal.md) | 5 | 0 | 3 |
-| [privacy](./privacy.md) | 6 | 0 | 2 |
-| [mileage](./mileage.md) | 8 | 0 | 5 |
-| [notification](./notification.md) | 12 | 0 | 7 |
-| [translation](./translation.md) | 9 | 0 | 4 |
-| **합계** | **264** | **~109** | **~250** |
+| [personal](./personal.md) | 2 | 3+ | 3 |
+| [privacy](./privacy.md) | 1 | 5+ | 2 |
+| [mileage](./mileage.md) | 7 | 3+ | 5 |
+| [notification](./notification.md) | 8 | 4+ | 7 |
+| [translation](./translation.md) | 7 | 2+ | 4 |
+| **합계** | **213** | **~160** | **~250** |
 
 > "Cafe24 docs sub-resource 수" 는 공식 docs 좌측 사이드바에서 본 resource 그룹 아래의 두 번째 레벨 항목 수다. 각 sub-resource 마다 통상 2~5 operation 이 존재하므로 endpoint 합계는 ~500.
 
@@ -141,13 +141,3 @@ resource 이름은 `Cafe24Resource` enum (`backend/src/nodes/integration/cafe24/
 | 2026-05-16 (coverage Phase 7e) | Shipping resource 완성 — carriers CRUD 3건 + regionalsurcharges 2건 + shipping_settings 2건 + shipping_additionalfees_countries + shippingorigins CRUD 5건 = 13건. shipping supported 2 → 15, planned 13 → 0, 합계 173 → 186. shipping 세 번째 0-planned resource. |
 | 2026-05-16 (coverage Phase 7f) | Category resource 완성 — decorationimages 2건 (get/update) + seo 2건 (get/update) + mains 3건 (add/update/delete) + autodisplay 3건 (create/update/delete) = 10건. category supported 9 → 19, planned 10 → 0, 합계 186 → 196. category 네 번째 0-planned resource. |
 | 2026-05-16 (coverage Phase 7g) | Supply resource 완성 — suppliers CUD 3건 + suppliers_users CRUD 6건 + suppliers_users regional shipping 5건 + shipping_suppliers 3건 = 17건. supply supported 3 → 20, planned 17 → 0, 합계 196 → 213. supply 다섯 번째 0-planned resource. 본 사이클 (Phase 7 a~g) 종료. |
-| 2026-05-16 (coverage Phase 8a) | Mileage resource 완성 — `points_report` 1건. mileage supported 7 → 8, planned 1 → 0, 합계 213 → 214. mileage 여섯 번째 0-planned resource. |
-| 2026-05-16 (coverage Phase 8b) | Promotion resource 완성 — `coupon_manage` 1건 (use_coupon T/F 토글). promotion supported 34 → 35, planned 1 → 0, 합계 214 → 215. promotion 일곱 번째 0-planned resource. |
-| 2026-05-16 (coverage Phase 8c) | Translation resource 완성 — 테마 번역 단건 조회/수정 2건. translation supported 7 → 9, planned 2 → 0, 합계 215 → 217. translation 여덟 번째 0-planned resource. |
-| 2026-05-16 (coverage Phase 8d) | Personal resource 완성 — `customers_wishlist_count` + `products_carts_count` + `products_carts_list` 3건. personal supported 2 → 5, planned 3 → 0, 합계 217 → 220. personal 아홉 번째 0-planned resource. |
-| 2026-05-16 (coverage Phase 8e) | Notification resource 완성 — `customers_invitation_send` + recipientgroups CUD 3건 = 4건. notification supported 8 → 12, planned 4 → 0, 합계 220 → 224. notification 열 번째 0-planned resource. |
-| 2026-05-16 (coverage Phase 8f) | Privacy resource 완성 — customers_privacy list/count/update 3건 + products_wishlist_customers list/count 2건 = 5건. privacy supported 1 → 6, planned 5 → 0, 합계 224 → 229. privacy 열한 번째 0-planned resource. |
-| 2026-05-16 (coverage Phase 8g) | Application resource 완성 — appstore_orders get/create 2건 + appstore_payments list/count 2건 + databridge_logs_list + recipes list/create/delete 3건 = 8건. application supported 11 → 19, planned 8 → 0, 합계 229 → 237. application 열두 번째 0-planned resource. |
-| 2026-05-16 (coverage Phase 8h) | Collection resource 완성 — manufacturers count/get/create/update 4건 + trends_count + classifications list/count 2건 + origin_list = 8건. collection supported 7 → 15, planned 8 → 0, 합계 237 → 245. collection 열세 번째 0-planned resource. |
-| 2026-05-16 (coverage Phase 8i) | Design resource 완성 — themes count/get 2건 + theme_pages CRUD 4건 (get/create/update/delete) + icons_list + icons_update_settings = 8건. design supported 1 → 9, planned 8 → 0, 합계 245 → 253. design 열네 번째 0-planned resource. |
-| 2026-05-16 (coverage Phase 8j) | Community resource 완성 — boards_comments_bulk + boards_seo get/update 2건 + commenttemplates get/update/delete 3건 + financials_monthlyreviews_count + urgentinquiry get/reply CRUD 4건 = 11건. community supported 13 → 24, planned 11 → 0, 합계 253 → 264. community 열다섯 번째 0-planned resource. 본 사이클 (Phase 8 a~j) 종료. |

```

---

### 파일 24: spec/conventions/cafe24-api-catalog/application.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/conventions/cafe24-api-catalog/application.md b/spec/conventions/cafe24-api-catalog/application.md
index cad0c203..579d92bd 100644
--- a/spec/conventions/cafe24-api-catalog/application.md
+++ b/spec/conventions/cafe24-api-catalog/application.md
@@ -13,14 +13,14 @@ base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
 | `scripttags_list` | 스크립트태그 목록 조회 | Retrieve a list of script tags | GET | `scripttags` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-script-tags) |
 | `webhooks_list` | Webhook 설정 조회 | Retrieve webhook settings | GET | `webhooks` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-webhook-settings) |
 | `apps_update` | 앱 정보 수정 | Update an app information | PUT | `apps` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-app-information) |
-| `appstore_orders_get` | 앱스토어 주문 조회 | Retrieve a Cafe24 store order | GET | `appstore/orders/{order_id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retreive-a-cafe24-store-order) |
-| `appstore_orders_create` | 앱스토어 주문 생성 | Create a Cafe24 store order | POST | `appstore/orders` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-cafe24-store-order) |
-| `appstore_payments_list` | 앱스토어 결제 목록 | Retrieve a list of Cafe24 store payments | GET | `appstore/payments` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-cafe24-store-payments) |
-| `appstore_payments_count` | 앱스토어 결제 수 | Retrieve a count of Cafe24 store payments | GET | `appstore/payments/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-cafe24-store-payments) |
-| `databridge_logs_list` | DataBridge 로그 목록 | Retrieve a list of DataBridge webhook logs | GET | `databridge/logs` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-databridge-webhook-logs) |
-| `recipes_list` | 레시피 목록 조회 | Retrieve a list of recipes | GET | `recipes` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-recipes) |
-| `recipes_create` | 레시피 생성 | Create a recipe | POST | `recipes` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-recipe) |
-| `recipes_delete` | 레시피 삭제 | Delete a recipe | DELETE | `recipes/{recipe_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-recipe) |
+| `appstore_orders_get` | 앱스토어 주문 조회 | Retrieve a Cafe24 store order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retreive-a-cafe24-store-order) |
+| `appstore_orders_create` | 앱스토어 주문 생성 | Create a Cafe24 store order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-cafe24-store-order) |
+| `appstore_payments_list` | 앱스토어 결제 목록 | Retrieve a list of Cafe24 store payments | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-cafe24-store-payments) |
+| `appstore_payments_count` | 앱스토어 결제 수 | Retrieve a count of Cafe24 store payments | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-cafe24-store-payments) |
+| `databridge_logs_list` | DataBridge 로그 목록 | Retrieve a list of DataBridge webhook logs | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-databridge-webhook-logs) |
+| `recipes_list` | 레시피 목록 조회 | Retrieve a list of recipes | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-recipes) |
+| `recipes_create` | 레시피 생성 | Create a recipe | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-recipe) |
+| `recipes_delete` | 레시피 삭제 | Delete a recipe | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-recipe) |
 | `scripttags_count` | 스크립트태그 개수 조회 | Retrieve a count of script tags | GET | `scripttags/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-script-tags) |
 | `scripttags_get` | 스크립트태그 단건 조회 | Retrieve a script tag | GET | `scripttags/{tag_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-script-tag) |
 | `scripttags_create` | 스크립트태그 생성 | Create a script tag | POST | `scripttags` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-script-tag) |

```

---

### 파일 25: spec/conventions/cafe24-api-catalog/collection.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/conventions/cafe24-api-catalog/collection.md b/spec/conventions/cafe24-api-catalog/collection.md
index 38e169d3..ee98a0a1 100644
--- a/spec/conventions/cafe24-api-catalog/collection.md
+++ b/spec/conventions/cafe24-api-catalog/collection.md
@@ -15,11 +15,11 @@ base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
 | `brands_create` | 브랜드 생성 | Create a brand | POST | `brands` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-brand) |
 | `brands_update` | 브랜드 수정 | Update a brand | PUT | `brands/{brand_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-brand) |
 | `brands_delete` | 브랜드 삭제 | Delete a brand | DELETE | `brands/{brand_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-brand) |
-| `manufacturers_count` | 제조사 개수 조회 | Retrieve a count of manufacturers | GET | `manufacturers/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-manufacturers) |
-| `manufacturers_get` | 제조사 단건 조회 | Retrieve a manufacturer | GET | `manufacturers/{manufacturer_code}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-manufacturer) |
-| `manufacturers_create` | 제조사 생성 | Create a manufacturer | POST | `manufacturers` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-manufacturer) |
-| `manufacturers_update` | 제조사 수정 | Update a manufacturer | PUT | `manufacturers/{manufacturer_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-manufacturer) |
-| `trends_count` | 트렌드 개수 조회 | Retrieve a count of trends | GET | `trends/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-trends) |
-| `classifications_list` | 사용자 정의 카테고리 목록 | Retrieve a list of custom categories | GET | `classifications` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-custom-categories) |
-| `classifications_count` | 사용자 정의 카테고리 수 | Retrieve a count of custom categories | GET | `classifications/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-custom-categories) |
-| `origin_list` | 원산지 목록 조회 | Retrieve a list of origins | GET | `origin` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-origins) |
+| `manufacturers_count` | 제조사 개수 조회 | Retrieve a count of manufacturers | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-manufacturers) |
+| `manufacturers_get` | 제조사 단건 조회 | Retrieve a manufacturer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-manufacturer) |
+| `manufacturers_create` | 제조사 생성 | Create a manufacturer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-manufacturer) |
+| `manufacturers_update` | 제조사 수정 | Update a manufacturer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-manufacturer) |
+| `trends_count` | 트렌드 개수 조회 | Retrieve a count of trends | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-trends) |
+| `classifications_list` | 사용자 정의 카테고리 목록 | Retrieve a list of custom categories | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-custom-categories) |
+| `classifications_count` | 사용자 정의 카테고리 수 | Retrieve a count of custom categories | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-custom-categories) |
+| `origin_list` | 원산지 목록 조회 | Retrieve a list of origins | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-origins) |

```

#### 전체 파일 컨텍스트
```
# Cafe24 API Catalog — Collection (판매분류)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `brands_list` | 브랜드 목록 조회 | Retrieve a list of brands | GET | `brands` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-brands) |
| `manufacturers_list` | 제조사 목록 조회 | Retrieve a list of manufacturers | GET | `manufacturers` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-manufacturers) |
| `trends_list` | 트렌드 목록 조회 | Retrieve a list of trends | GET | `trends` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-trends) |
| `brands_count` | 브랜드 개수 조회 | Retrieve a count of brands | GET | `brands/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-brands) |
| `brands_create` | 브랜드 생성 | Create a brand | POST | `brands` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-brand) |
| `brands_update` | 브랜드 수정 | Update a brand | PUT | `brands/{brand_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-brand) |
| `brands_delete` | 브랜드 삭제 | Delete a brand | DELETE | `brands/{brand_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-brand) |
| `manufacturers_count` | 제조사 개수 조회 | Retrieve a count of manufacturers | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-manufacturers) |
| `manufacturers_get` | 제조사 단건 조회 | Retrieve a manufacturer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-manufacturer) |
| `manufacturers_create` | 제조사 생성 | Create a manufacturer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-manufacturer) |
| `manufacturers_update` | 제조사 수정 | Update a manufacturer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-manufacturer) |
| `trends_count` | 트렌드 개수 조회 | Retrieve a count of trends | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-trends) |
| `classifications_list` | 사용자 정의 카테고리 목록 | Retrieve a list of custom categories | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-custom-categories) |
| `classifications_count` | 사용자 정의 카테고리 수 | Retrieve a count of custom categories | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-custom-categories) |
| `origin_list` | 원산지 목록 조회 | Retrieve a list of origins | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-origins) |

```

---

### 파일 26: spec/conventions/cafe24-api-catalog/community.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/conventions/cafe24-api-catalog/community.md b/spec/conventions/cafe24-api-catalog/community.md
index 2b680d65..4bef5c38 100644
--- a/spec/conventions/cafe24-api-catalog/community.md
+++ b/spec/conventions/cafe24-api-catalog/community.md
@@ -19,16 +19,16 @@ base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
 | `board_articles_comments_list` | 게시판 댓글 목록 | Retrieve a list of comments for a board post | GET | `boards/{board_no}/articles/{article_no}/comments` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-comments-for-a-board-post) |
 | `board_articles_comments_create` | 게시판 댓글 작성 | Create a comment for a board post | POST | `boards/{board_no}/articles/{article_no}/comments` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-comment-for-a-board-post) |
 | `board_articles_comments_delete` | 게시판 댓글 삭제 | Delete a comment for a board post | DELETE | `boards/{board_no}/articles/{article_no}/comments/{comment_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-comment-for-a-board-post) |
-| `boards_comments_bulk` | 게시판 댓글 일괄 조회 | Retrieve comments in bulk | GET | `boards/{board_no}/comments` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-comments-in-bulk) |
-| `boards_seo_get` | 게시판 SEO 조회 | Retrieve SEO settings for board | GET | `boards/{board_no}/seo` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-seo-settings-for-board) |
-| `boards_seo_update` | 게시판 SEO 수정 | Update SEO settings for board | PUT | `boards/{board_no}/seo` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-seo-settings-for-board) |
+| `boards_comments_bulk` | 게시판 댓글 일괄 조회 | Retrieve comments in bulk | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-comments-in-bulk) |
+| `boards_seo_get` | 게시판 SEO 조회 | Retrieve SEO settings for board | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-seo-settings-for-board) |
+| `boards_seo_update` | 게시판 SEO 수정 | Update SEO settings for board | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-seo-settings-for-board) |
 | `commenttemplates_list` | 자주 쓰는 답변 목록 | Retrieve frequently used answers | GET | `commenttemplates` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-frequently-used-answers) |
-| `commenttemplates_get` | 자주 쓰는 답변 단건 | Retrieve a frequently used answer | GET | `commenttemplates/{template_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-frequently-used-answer) |
+| `commenttemplates_get` | 자주 쓰는 답변 단건 | Retrieve a frequently used answer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-frequently-used-answer) |
 | `commenttemplates_create` | 자주 쓰는 답변 생성 | Create a frequently used answer | POST | `commenttemplates` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-frequently-used-answer) |
-| `commenttemplates_update` | 자주 쓰는 답변 수정 | Update a frequently used answer | PUT | `commenttemplates/{template_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-frequently-used-answer) |
-| `commenttemplates_delete` | 자주 쓰는 답변 삭제 | Delete a frequently used answer | DELETE | `commenttemplates/{template_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-frequently-used-answer) |
-| `financials_monthlyreviews_count` | 월별 후기 카운트 | Retrieve the total count for monthly reviews and ratings | GET | `financials/monthlyreviews/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-total-count-for-monthly-reviews-and-ratings) |
-| `urgentinquiry_get` | 긴급 문의 게시글 조회 | Retrieve an urgent inquiry post | GET | `urgentinquiry/{inquiry_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-urgent-inquiry-post) |
-| `urgentinquiry_reply_get` | 긴급 문의 답변 조회 | Retrieve a reply for urgent inquiry post | GET | `urgentinquiry/{inquiry_no}/reply` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-reply-for-urgent-inquiry-post) |
-| `urgentinquiry_reply_create` | 긴급 문의 답변 작성 | Create a reply for urgent inquiry post | POST | `urgentinquiry/{inquiry_no}/reply` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-reply-for-urgent-inquiry-post) |
-| `urgentinquiry_reply_update` | 긴급 문의 답변 수정 | Update a reply for urgent inquiry post | PUT | `urgentinquiry/{inquiry_no}/reply` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-reply-for-urgent-inquiry-post) |
+| `commenttemplates_update` | 자주 쓰는 답변 수정 | Update a frequently used answer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-frequently-used-answer) |
+| `commenttemplates_delete` | 자주 쓰는 답변 삭제 | Delete a frequently used answer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-frequently-used-answer) |
+| `financials_monthlyreviews_count` | 월별 후기 카운트 | Retrieve the total count for monthly reviews and ratings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-total-count-for-monthly-reviews-and-ratings) |
+| `urgentinquiry_get` | 긴급 문의 게시글 조회 | Retrieve an urgent inquiry post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-urgent-inquiry-post) |
+| `urgentinquiry_reply_get` | 긴급 문의 답변 조회 | Retrieve a reply for urgent inquiry post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-reply-for-urgent-inquiry-post) |
+| `urgentinquiry_reply_create` | 긴급 문의 답변 작성 | Create a reply for urgent inquiry post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-reply-for-urgent-inquiry-post) |
+| `urgentinquiry_reply_update` | 긴급 문의 답변 수정 | Update a reply for urgent inquiry post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-reply-for-urgent-inquiry-post) |

```

---

### 파일 27: spec/conventions/cafe24-api-catalog/design.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/conventions/cafe24-api-catalog/design.md b/spec/conventions/cafe24-api-catalog/design.md
index 2e276d0e..55d3d001 100644
--- a/spec/conventions/cafe24-api-catalog/design.md
+++ b/spec/conventions/cafe24-api-catalog/design.md
@@ -9,11 +9,11 @@ base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
 | id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
 |----|---|---|---|---|---|---|---|---|
 | `themes_list` | 테마 목록 조회 | Retrieve a list of themes | GET | `themes` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-themes) |
-| `themes_count` | 테마 개수 조회 | Retrieve a count of themes | GET | `themes/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-themes) |
-| `themes_get` | 테마 단건 조회 | Retrieve a theme | GET | `themes/{theme_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-theme) |
-| `theme_pages_get` | 테마 페이지 조회 | Retrieve a theme page | GET | `themes/{theme_no}/pages/{page_path}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-theme-page) |
-| `theme_pages_create` | 테마 페이지 생성 | Create a theme page | POST | `themes/{theme_no}/pages` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-theme-page) |
-| `theme_pages_update` | 테마 페이지 수정 | Update a theme page | PUT | `themes/{theme_no}/pages/{page_path}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-theme-page) |
-| `theme_pages_delete` | 테마 페이지 삭제 | Delete a theme page | DELETE | `themes/{theme_no}/pages/{page_path}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-theme-page) |
-| `icons_list` | 디자인 아이콘 목록 조회 | Retrieve a list of design icons | GET | `icons` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-desgin-icons) |
-| `icons_update_settings` | 상점 아이콘 설정 수정 | Update store icon settings | PUT | `icons` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-store-icon-settings) |
+| `themes_count` | 테마 개수 조회 | Retrieve a count of themes | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-themes) |
+| `themes_get` | 테마 단건 조회 | Retrieve a theme | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-theme) |
+| `theme_pages_get` | 테마 페이지 조회 | Retrieve a theme page | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-theme-page) |
+| `theme_pages_create` | 테마 페이지 생성 | Create a theme page | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-theme-page) |
+| `theme_pages_update` | 테마 페이지 수정 | Update a theme page | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-theme-page) |
+| `theme_pages_delete` | 테마 페이지 삭제 | Delete a theme page | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-theme-page) |
+| `icons_list` | 디자인 아이콘 목록 조회 | Retrieve a list of design icons | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-desgin-icons) |
+| `icons_update_settings` | 상점 아이콘 설정 수정 | Update store icon settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-store-icon-settings) |

```

#### 전체 파일 컨텍스트
```
# Cafe24 API Catalog — Design (디자인)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md). 본 파일은 `design` resource 의 모든 operation enumeration.

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `themes_list` | 테마 목록 조회 | Retrieve a list of themes | GET | `themes` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-themes) |
| `themes_count` | 테마 개수 조회 | Retrieve a count of themes | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-themes) |
| `themes_get` | 테마 단건 조회 | Retrieve a theme | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-theme) |
| `theme_pages_get` | 테마 페이지 조회 | Retrieve a theme page | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-theme-page) |
| `theme_pages_create` | 테마 페이지 생성 | Create a theme page | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-theme-page) |
| `theme_pages_update` | 테마 페이지 수정 | Update a theme page | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-theme-page) |
| `theme_pages_delete` | 테마 페이지 삭제 | Delete a theme page | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-theme-page) |
| `icons_list` | 디자인 아이콘 목록 조회 | Retrieve a list of design icons | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-desgin-icons) |
| `icons_update_settings` | 상점 아이콘 설정 수정 | Update store icon settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-store-icon-settings) |

```

---

### 파일 28: spec/conventions/cafe24-api-catalog/mileage.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/conventions/cafe24-api-catalog/mileage.md b/spec/conventions/cafe24-api-catalog/mileage.md
index c5b6b4e3..f1658857 100644
--- a/spec/conventions/cafe24-api-catalog/mileage.md
+++ b/spec/conventions/cafe24-api-catalog/mileage.md
@@ -13,6 +13,6 @@ base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
 | `points_autoexpiration_get` | 적립금 자동 만료 조회 | Retrieve an automatic points expiration | GET | `points/autoexpiration/{id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-automatic-points-expiration) |
 | `points_autoexpiration_create` | 적립금 자동 만료 생성 | Create an automatic points expiration | POST | `points/autoexpiration` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-automatic-points-expiration) |
 | `points_autoexpiration_delete` | 적립금 자동 만료 삭제 | Delete an automatic points expiration | DELETE | `points/autoexpiration/{id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-automatic-points-expiration) |
-| `points_report` | 적립금 리포트 조회 | Retrieve a points report by date range | GET | `points/report` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-points-report-by-date-range) |
+| `points_report` | 적립금 리포트 조회 | Retrieve a points report by date range | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-points-report-by-date-range) |
 | `credits_list` | 예치금 내역 조회 | Retrieve a list of credits by date range | GET | `credits` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-credits-by-date-range) |
 | `credits_report` | 예치금 리포트 조회 | Retrieve a credit report by date range | GET | `credits/report` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-credit-report-by-date-range) |

```

#### 전체 파일 컨텍스트
```
# Cafe24 API Catalog — Mileage (적립금)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `mileage_list` | 적립금 내역 조회 | Retrieve points | GET | `points` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-points) |
| `mileage_grant` | 적립금 지급 | Issue and deduct points | POST | `points` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#issue-and-deduct-points) |
| `points_autoexpiration_get` | 적립금 자동 만료 조회 | Retrieve an automatic points expiration | GET | `points/autoexpiration/{id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-automatic-points-expiration) |
| `points_autoexpiration_create` | 적립금 자동 만료 생성 | Create an automatic points expiration | POST | `points/autoexpiration` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-automatic-points-expiration) |
| `points_autoexpiration_delete` | 적립금 자동 만료 삭제 | Delete an automatic points expiration | DELETE | `points/autoexpiration/{id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-automatic-points-expiration) |
| `points_report` | 적립금 리포트 조회 | Retrieve a points report by date range | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-points-report-by-date-range) |
| `credits_list` | 예치금 내역 조회 | Retrieve a list of credits by date range | GET | `credits` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-credits-by-date-range) |
| `credits_report` | 예치금 리포트 조회 | Retrieve a credit report by date range | GET | `credits/report` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-credit-report-by-date-range) |

```

---

### 파일 29: spec/conventions/cafe24-api-catalog/notification.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/conventions/cafe24-api-catalog/notification.md b/spec/conventions/cafe24-api-catalog/notification.md
index 5201f484..5f5d3af5 100644
--- a/spec/conventions/cafe24-api-catalog/notification.md
+++ b/spec/conventions/cafe24-api-catalog/notification.md
@@ -14,9 +14,9 @@ base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
 | `sms_senders_list` | SMS 발신자 목록 조회 | Retrieve a list of SMS senders | GET | `sms/senders` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-sms-senders) |
 | `automails_get` | 자동 이메일 설정 조회 | Retrieve automated email settings | GET | `automails` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-automated-email-settings) |
 | `automails_update` | 자동 이메일 설정 수정 | Update automated email settings | PUT | `automails` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-automated-email-settings) |
-| `customers_invitation_send` | 회원 활성화 초대 발송 | Send an invitation to activate account | POST | `customers/invitation` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#send-an-invitation-to-activate-account) |
+| `customers_invitation_send` | 회원 활성화 초대 발송 | Send an invitation to activate account | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#send-an-invitation-to-activate-account) |
 | `recipientgroups_list` | 수신자 그룹 목록 | Retrieve distribution group list | GET | `recipientgroups` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-distribution-group-list) |
 | `recipientgroups_get` | 수신자 그룹 상세 | Retrieve distribution group details | GET | `recipientgroups/{group_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-distribution-group-details) |
-| `recipientgroups_create` | 수신자 그룹 생성 | Create a distribution group | POST | `recipientgroups` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-distribution-group) |
-| `recipientgroups_update` | 수신자 그룹 수정 | Edit distribution group | PUT | `recipientgroups/{group_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-distribution-group) |
-| `recipientgroups_delete` | 수신자 그룹 삭제 | Delete distribution group | DELETE | `recipientgroups/{group_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-distribution-group) |
+| `recipientgroups_create` | 수신자 그룹 생성 | Create a distribution group | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-distribution-group) |
+| `recipientgroups_update` | 수신자 그룹 수정 | Edit distribution group | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-distribution-group) |
+| `recipientgroups_delete` | 수신자 그룹 삭제 | Delete distribution group | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-distribution-group) |

```

#### 전체 파일 컨텍스트
```
# Cafe24 API Catalog — Notification (알림)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `sms_send` | SMS 발송 | Send a SMS | POST | `sms` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#send-a-sms) |
| `sms_balance_get` | SMS 잔액 조회 | Retrieve the SMS balance | GET | `sms/balance` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-sms-balance) |
| `sms_receivers_get` | SMS 수신자 조회 | Retrieve a SMS recipient | GET | `sms/receivers` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-sms-recipient) |
| `sms_senders_list` | SMS 발신자 목록 조회 | Retrieve a list of SMS senders | GET | `sms/senders` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-sms-senders) |
| `automails_get` | 자동 이메일 설정 조회 | Retrieve automated email settings | GET | `automails` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-automated-email-settings) |
| `automails_update` | 자동 이메일 설정 수정 | Update automated email settings | PUT | `automails` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-automated-email-settings) |
| `customers_invitation_send` | 회원 활성화 초대 발송 | Send an invitation to activate account | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#send-an-invitation-to-activate-account) |
| `recipientgroups_list` | 수신자 그룹 목록 | Retrieve distribution group list | GET | `recipientgroups` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-distribution-group-list) |
| `recipientgroups_get` | 수신자 그룹 상세 | Retrieve distribution group details | GET | `recipientgroups/{group_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-distribution-group-details) |
| `recipientgroups_create` | 수신자 그룹 생성 | Create a distribution group | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-distribution-group) |
| `recipientgroups_update` | 수신자 그룹 수정 | Edit distribution group | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-distribution-group) |
| `recipientgroups_delete` | 수신자 그룹 삭제 | Delete distribution group | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-distribution-group) |

```

---

### 파일 30: spec/conventions/cafe24-api-catalog/personal.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/conventions/cafe24-api-catalog/personal.md b/spec/conventions/cafe24-api-catalog/personal.md
index c7a0118a..d55dd917 100644
--- a/spec/conventions/cafe24-api-catalog/personal.md
+++ b/spec/conventions/cafe24-api-catalog/personal.md
@@ -10,6 +10,6 @@ base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
 |----|---|---|---|---|---|---|---|---|
 | `carts_list` | 장바구니 목록 조회 | Retrieve a shopping cart | GET | `carts` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-shopping-cart) |
 | `wishlists_list` | 위시리스트 조회 | Retrieve a list of products in customer wishlist | GET | `wishlists` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-products-in-customer-wishlist) |
-| `customers_wishlist_count` | 위시리스트 상품 개수 | Retrieve a count of products in customer wishlist | GET | `customers/wishlist/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-products-in-customer-wishlist) |
-| `products_carts_count` | 상품 담은 장바구니 수 | Retrieve a count of carts containing a product | GET | `products/{product_no}/carts/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-carts-containing-a-product) |
-| `products_carts_list` | 상품 담은 장바구니 목록 | Retrieve a list of carts containing a product | GET | `products/{product_no}/carts` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-carts-containing-a-product) |
+| `customers_wishlist_count` | 위시리스트 상품 개수 | Retrieve a count of products in customer wishlist | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-products-in-customer-wishlist) |
+| `products_carts_count` | 상품 담은 장바구니 수 | Retrieve a count of carts containing a product | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-carts-containing-a-product) |
+| `products_carts_list` | 상품 담은 장바구니 목록 | Retrieve a list of carts containing a product | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-carts-containing-a-product) |

```

#### 전체 파일 컨텍스트
```
# Cafe24 API Catalog — Personal (개인화)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `carts_list` | 장바구니 목록 조회 | Retrieve a shopping cart | GET | `carts` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-shopping-cart) |
| `wishlists_list` | 위시리스트 조회 | Retrieve a list of products in customer wishlist | GET | `wishlists` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-products-in-customer-wishlist) |
| `customers_wishlist_count` | 위시리스트 상품 개수 | Retrieve a count of products in customer wishlist | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-products-in-customer-wishlist) |
| `products_carts_count` | 상품 담은 장바구니 수 | Retrieve a count of carts containing a product | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-carts-containing-a-product) |
| `products_carts_list` | 상품 담은 장바구니 목록 | Retrieve a list of carts containing a product | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-carts-containing-a-product) |

```

---

### 파일 31: spec/conventions/cafe24-api-catalog/privacy.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/conventions/cafe24-api-catalog/privacy.md b/spec/conventions/cafe24-api-catalog/privacy.md
index c97f8277..f9c55e14 100644
--- a/spec/conventions/cafe24-api-catalog/privacy.md
+++ b/spec/conventions/cafe24-api-catalog/privacy.md
@@ -9,8 +9,8 @@ base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
 | id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
 |----|---|---|---|---|---|---|---|---|
 | `customers_privacy_get` | 회원 개인정보 조회 | Retrieve a customer information | GET | `privacy/customers/{member_id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-information) |
-| `customers_privacy_list` | 회원 개인정보 목록 조회 | Retrieve a list of customer information | GET | `privacy/customers` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-information) |
-| `customers_privacy_count` | 회원 개인정보 개수 조회 | Retrieve a count of customer information | GET | `privacy/customers/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-information) |
-| `customers_privacy_update` | 회원 개인정보 수정 | Update a customer information | PUT | `privacy/customers/{member_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-information) |
-| `products_wishlist_customers_list` | 위시리스트 보유 회원 목록 | Retrieve a list of customers with a product in wishlist | GET | `products/{product_no}/wishlist/customers` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers-with-a-product-in-wishlist) |
-| `products_wishlist_customers_count` | 위시리스트 보유 회원 수 | Retrieve a count of customers with a product in wishlist | GET | `products/{product_no}/wishlist/customers/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customers-with-a-product-in-wishlist) |
+| `customers_privacy_list` | 회원 개인정보 목록 조회 | Retrieve a list of customer information | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-information) |
+| `customers_privacy_count` | 회원 개인정보 개수 조회 | Retrieve a count of customer information | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-information) |
+| `customers_privacy_update` | 회원 개인정보 수정 | Update a customer information | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-information) |
+| `products_wishlist_customers_list` | 위시리스트 보유 회원 목록 | Retrieve a list of customers with a product in wishlist | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers-with-a-product-in-wishlist) |
+| `products_wishlist_customers_count` | 위시리스트 보유 회원 수 | Retrieve a count of customers with a product in wishlist | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customers-with-a-product-in-wishlist) |

```

#### 전체 파일 컨텍스트
```
# Cafe24 API Catalog — Privacy (개인정보)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `customers_privacy_get` | 회원 개인정보 조회 | Retrieve a customer information | GET | `privacy/customers/{member_id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-information) |
| `customers_privacy_list` | 회원 개인정보 목록 조회 | Retrieve a list of customer information | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-information) |
| `customers_privacy_count` | 회원 개인정보 개수 조회 | Retrieve a count of customer information | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-information) |
| `customers_privacy_update` | 회원 개인정보 수정 | Update a customer information | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-information) |
| `products_wishlist_customers_list` | 위시리스트 보유 회원 목록 | Retrieve a list of customers with a product in wishlist | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers-with-a-product-in-wishlist) |
| `products_wishlist_customers_count` | 위시리스트 보유 회원 수 | Retrieve a count of customers with a product in wishlist | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customers-with-a-product-in-wishlist) |

```

---

### 파일 32: spec/conventions/cafe24-api-catalog/promotion.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/conventions/cafe24-api-catalog/promotion.md b/spec/conventions/cafe24-api-catalog/promotion.md
index 961fed6f..9fe3dd60 100644
--- a/spec/conventions/cafe24-api-catalog/promotion.md
+++ b/spec/conventions/cafe24-api-catalog/promotion.md
@@ -14,7 +14,7 @@ base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
 | `coupon_issue` | 쿠폰 발급 | Create coupon issuance history | POST | `coupons/{coupon_no}/issues` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-coupon-issuance-history) |
 | `coupon_delete` | 쿠폰 삭제 | Coupon management (delete) | DELETE | `coupons/{coupon_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#coupon-management) |
 | `coupon_count` | 쿠폰 개수 조회 | Retrieve a count of coupons | GET | `coupons/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-coupons) |
-| `coupon_manage` | 쿠폰 관리 (사용/중지) | Coupon management (pause/resume) | PUT | `coupons/{coupon_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#coupon-management) |
+| `coupon_manage` | 쿠폰 관리 (사용/중지) | Coupon management | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#coupon-management) |
 | `coupon_issuance_customers_list` | 쿠폰 발급 대상 회원 목록 | Retrieve a list of eligible customers for conditional issuance | GET | `coupons/{coupon_no}/issuancecustomers` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-eligible-customers-for-conditional-issuance) |
 | `coupon_issues_list` | 발급 쿠폰 목록 | Retrieve a list of issued coupons | GET | `coupons/issues` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-issued-coupons) |
 | `benefits_list` | 회원 혜택 목록 | Retrieve a list of customer benefits | GET | `benefits` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-benefits) |

```

---

### 파일 33: spec/conventions/cafe24-api-catalog/translation.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/conventions/cafe24-api-catalog/translation.md b/spec/conventions/cafe24-api-catalog/translation.md
index bf44b57f..ee505604 100644
--- a/spec/conventions/cafe24-api-catalog/translation.md
+++ b/spec/conventions/cafe24-api-catalog/translation.md
@@ -15,5 +15,5 @@ base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
 | `translation_store_list` | 상점 번역 목록 조회 | Retrieve a list of store translations | GET | `translation/store` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-store-translations) |
 | `translation_store_update` | 상점 번역 수정 | Update the translations of a store | PUT | `translation/store` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-the-translations-of-a-store) |
 | `translation_themes_list` | 테마 번역 목록 조회 | Retrieve a list of theme translations | GET | `translation/themes` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-theme-translations) |
-| `translation_themes_get` | 테마 번역 단건 조회 | Retrieve a theme translation | GET | `translation/themes/{theme_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-theme-translation) |
-| `translation_themes_update` | 테마 번역 수정 | Update a theme translation | PUT | `translation/themes/{theme_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-theme-translation) |
+| `translation_themes_get` | 테마 번역 단건 조회 | Retrieve a theme translation | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-theme-translation) |
+| `translation_themes_update` | 테마 번역 수정 | Update a theme translation | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-theme-translation) |

```

#### 전체 파일 컨텍스트
```
# Cafe24 API Catalog — Translation (번역)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `translation_products_list` | 상품 번역 목록 조회 | Retrieve a list of product translations | GET | `translation/products` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-translations) |
| `translation_products_update` | 상품 번역 수정 | Update product translation | PUT | `translation/products/{product_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-product-translation) |
| `translation_categories_list` | 카테고리 번역 목록 조회 | Retrieve a list of product category translations | GET | `translation/categories` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-category-translations) |
| `translation_categories_update` | 카테고리 번역 수정 | Update product category translation | PUT | `translation/categories/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-product-category-translation) |
| `translation_store_list` | 상점 번역 목록 조회 | Retrieve a list of store translations | GET | `translation/store` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-store-translations) |
| `translation_store_update` | 상점 번역 수정 | Update the translations of a store | PUT | `translation/store` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-the-translations-of-a-store) |
| `translation_themes_list` | 테마 번역 목록 조회 | Retrieve a list of theme translations | GET | `translation/themes` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-theme-translations) |
| `translation_themes_get` | 테마 번역 단건 조회 | Retrieve a theme translation | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-theme-translation) |
| `translation_themes_update` | 테마 번역 수정 | Update a theme translation | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-theme-translation) |

```
