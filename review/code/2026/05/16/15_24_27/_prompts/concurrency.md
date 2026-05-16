# 동시성(Concurrency) Review Payload

본 파일은 orchestrator 가 동시성(Concurrency) reviewer 용으로 작성한 입력입니다. 다음 코드 변경을 동시성/병렬 처리 관점에서 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

> 변경 코드가 본 reviewer 의 영역과 무관하면 "해당 없음" 으로 응답하고
> 위험도를 NONE 으로 설정해 `STATUS=success ISSUES=0` 으로 반환합니다.

## 점검 관점 (동시성(Concurrency))

1. **경쟁 조건(Race Condition)**: 공유 자원 동시 접근으로 인한 경쟁 조건
2. **데드락**: 여러 락 사용 시 데드락 가능성
3. **동기화**: 공유 자원에 대한 적절한 동기화 (mutex/semaphore/lock)
4. **스레드 안전성**: 변수·컬렉션·객체의 스레드 세이프 여부
5. **async/await**: 비동기 코드의 올바른 사용, await 누락
6. **원자성**: 복합 연산의 원자성 보장
7. **이벤트 루프**: 이벤트 루프 블로킹·콜백 지옥·Promise 체인 관리
8. **리소스 풀링**: 스레드 풀·커넥션 풀의 크기·관리

## 리뷰 대상 파일

### 파일 1: backend/src/modules/integrations/dto/integration.dto.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/dto/integration.dto.ts b/backend/src/modules/integrations/dto/integration.dto.ts
index 2c203f96..a4392b5a 100644
--- a/backend/src/modules/integrations/dto/integration.dto.ts
+++ b/backend/src/modules/integrations/dto/integration.dto.ts
@@ -390,3 +390,30 @@ export class ActivityQueryDto {
   @Max(30)
   days?: number;
 }
+
+/**
+ * Cafe24 mall_id 사전 중복 감지 query.
+ *
+ * 프론트엔드가 `/integrations/new` 의 cafe24 step 에서 mall_id 입력 시점에
+ * debounce 호출. 같은 워크스페이스에 이미 같은 mall 의 cafe24 통합이 있는지
+ * 확인해 inline 경고 배너를 띄운다. begin 단계 사전 가드와 동일 SELECT 를
+ * 노출하므로 throttle (분당 60회) 로 brute-force enumeration 차단.
+ */
+export class Cafe24PrecheckQueryDto {
+  @ApiProperty({
+    description:
+      'Cafe24 mall identifier — lowercase letters / digits / hyphens, 3–50자',
+    example: 'myshop',
+    pattern: '^[a-z0-9-]{3,50}$',
+  })
+  @IsString()
+  @MinLength(3)
+  @MaxLength(50)
+  // SSRF 방어와 begin DTO 와 동일한 정규식을 사용.
+  // CAFE24_MALL_ID_PATTERN = /^[a-z0-9-]{3,50}$/
+  @Matches(/^[a-z0-9-]{3,50}$/, {
+    message:
+      'mallId must match /^[a-z0-9-]{3,50}$/ — lowercase letters, digits, and hyphens only',
+  })
+  mallId!: string;
+}

```

---

### 파일 2: backend/src/modules/integrations/dto/responses/integration-response.dto.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/dto/responses/integration-response.dto.ts b/backend/src/modules/integrations/dto/responses/integration-response.dto.ts
index 72d48c49..1fa308d1 100644
--- a/backend/src/modules/integrations/dto/responses/integration-response.dto.ts
+++ b/backend/src/modules/integrations/dto/responses/integration-response.dto.ts
@@ -231,6 +231,42 @@ export class OAuthBeginCafe24PendingResultDto {
   scopesAdded?: string[];
 }
 
+/**
+ * Cafe24 mall_id 사전 중복 감지 응답.
+ *
+ * 프론트엔드가 mall_id 입력 시점에 350ms debounce 로 호출해 inline 경고
+ * 배너를 띄우는 read-only endpoint. 동일 (workspaceId, mall_id) cafe24 row 의
+ * 상태를 가장 제한적인 것부터 (`connected > pending_install > error > expired`)
+ * 반환. 인증 정보 누설 방지를 위해 (id, name, status) 만 노출 — 자격 증명·
+ * 토큰·timestamps 비포함. spec/2-navigation/4-integration.md §9.2 Rationale
+ * "precheck endpoint — mall_id 입력 단계 사전 감지 UX".
+ */
+export class Cafe24PrecheckResultDto {
+  @ApiProperty({
+    description:
+      '동일 (workspaceId, mall_id) cafe24 통합이 이미 존재하면 true. false 면 begin 호출이 안전.',
+  })
+  conflict!: boolean;
+
+  @ApiPropertyOptional({
+    format: 'uuid',
+    description: '충돌 대상 통합의 UUID. conflict=true 일 때만 채워진다.',
+  })
+  existingIntegrationId?: string;
+
+  @ApiPropertyOptional({
+    description: '충돌 대상 통합의 표시 이름. conflict=true 일 때만 채워진다.',
+  })
+  existingName?: string;
+
+  @ApiPropertyOptional({
+    enum: ['connected', 'pending_install', 'expired', 'error'],
+    description:
+      '충돌 대상 통합의 현재 상태. 프론트엔드 inline 안내 메시지 분기 기준.',
+  })
+  status?: 'connected' | 'pending_install' | 'expired' | 'error';
+}
+
 /** 사용처 조회 응답 */
 export class IntegrationUsageItemDto {
   @ApiProperty({ format: 'uuid' })

```

---

### 파일 3: backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts b/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts
index 7fc8f87f..36ba9e6a 100644
--- a/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts
+++ b/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts
@@ -506,6 +506,209 @@ describe('IntegrationOAuthService — Cafe24', () => {
     });
   });
 
+  // Public 흐름 사전 가드 (2026-05-16). 옛 코드는 public begin 단계에서
+  // 중복 체크가 없어 사용자가 Cafe24 동의까지 마친 뒤 finalize 단계의
+  // V045 partial UNIQUE 위반이 500 으로 빠지던 UX 결함을 막는다.
+  // 동일 mall_id 의 `connected` row 가 존재하면 begin 자체가 409 로 거부.
+  describe('begin — public app duplicate prevention', () => {
+    function publicBeginParams() {
+      return {
+        workspaceId: 'ws-1',
+        userId: 'u-1',
+        service: 'cafe24',
+        scopes: ['mall.read_product'],
+        mode: 'new' as const,
+        providerMeta: {
+          mall_id: 'pub-shop',
+          app_type: 'public' as const,
+        },
+      };
+    }
+
+    it('rejects with 409 when a connected public integration exists for the same mall_id', async () => {
+      integrationRepo.find = jest.fn().mockResolvedValue([
+        {
+          id: 'existing-public-connected',
+          workspaceId: 'ws-1',
+          status: 'connected',
+          serviceType: 'cafe24',
+          mallId: 'pub-shop',
+          credentials: { mall_id: 'pub-shop', app_type: 'public' },
+        },
+      ]);
+
+      const error = await service
+        .begin(publicBeginParams())
+        .catch((e: Error) => e);
+      const response = (error as { response?: { code?: string } }).response;
+      expect(response?.code).toBe('CAFE24_PRIVATE_APP_ALREADY_CONNECTED');
+      // No OAuth state row created — the guard fires before save.
+      expect(stateRepo.save).not.toHaveBeenCalled();
+    });
+
+    it('rejects with 409 when a connected private integration exists for the same mall_id (app_type 무관)', async () => {
+      integrationRepo.find = jest.fn().mockResolvedValue([
+        {
+          id: 'existing-private-connected',
+          workspaceId: 'ws-1',
+          status: 'connected',
+          serviceType: 'cafe24',
+          mallId: 'pub-shop',
+          credentials: { mall_id: 'pub-shop', app_type: 'private' },
+        },
+      ]);
+
+      const error = await service
+        .begin(publicBeginParams())
+        .catch((e: Error) => e);
+      const response = (error as { response?: { code?: string } }).response;
+      expect(response?.code).toBe('CAFE24_PRIVATE_APP_ALREADY_CONNECTED');
+      expect(stateRepo.save).not.toHaveBeenCalled();
+    });
+
+    it('proceeds when only non-connected rows exist (pending/expired/error — V045 backstop handles finalize)', async () => {
+      integrationRepo.find = jest.fn().mockResolvedValue([
+        {
+          id: 'existing-expired',
+          status: 'expired',
+          serviceType: 'cafe24',
+          mallId: 'pub-shop',
+          credentials: { mall_id: 'pub-shop', app_type: 'public' },
+        },
+      ]);
+
+      const result = await service.begin(publicBeginParams());
+      // Begin succeeds (returns authorize URL); duplicate is caught at
+      // POST /api/integrations finalize by `throwIfUniqueViolation` against
+      // `idx_integration_cafe24_workspace_mall`.
+      expect((result as { authUrl: string }).authUrl).toMatch(
+        /^https:\/\/pub-shop\.cafe24api\.com\/api\/v2\/oauth\/authorize\?/,
+      );
+      expect(stateRepo.save).toHaveBeenCalledTimes(1);
+    });
+
+    it('proceeds when no cafe24 row exists for this mall', async () => {
+      integrationRepo.find = jest.fn().mockResolvedValue([]);
+      const result = await service.begin(publicBeginParams());
+      expect((result as { authUrl: string }).authUrl).toContain(
+        'pub-shop.cafe24api.com',
+      );
+    });
+
+    it('matches legacy rows (mall_id stored in credentials JSONB only)', async () => {
+      // V045 이전 row 는 plain `mall_id` 컬럼이 NULL — JSONB 의 mall_id 로
+      // 매칭. find() 가 두 번 호출되며 첫 번째 (mallId='pub-shop') 는 빈
+      // 배열, 두 번째 (mallId IS NULL) 는 legacy row 를 반환.
+      let callCount = 0;
+      integrationRepo.find = jest.fn().mockImplementation(() => {
+        callCount += 1;
+        if (callCount === 1) return Promise.resolve([]);
+        return Promise.resolve([
+          {
+            id: 'legacy-connected',
+            status: 'connected',
+            serviceType: 'cafe24',
+            mallId: null,
+            credentials: { mall_id: 'pub-shop', app_type: 'public' },
+          },
+        ]);
+      });
+
+      const error = await service
+        .begin(publicBeginParams())
+        .catch((e: Error) => e);
+      expect((error as { response?: { code?: string } }).response?.code).toBe(
+        'CAFE24_PRIVATE_APP_ALREADY_CONNECTED',
+      );
+    });
+  });
+
+  // precheck — frontend 의 사전 감지 inline 알림을 위한 read-only API.
+  // 동일 (workspaceId, mallId) cafe24 row 의 status / id / name 을 반환.
+  // priority: connected > pending_install > error > expired.
+  describe('precheckCafe24Mall', () => {
+    it('returns conflict=false when no cafe24 row exists', async () => {
+      integrationRepo.find = jest.fn().mockResolvedValue([]);
+      const result = await service.precheckCafe24Mall('ws-1', 'fresh-mall');
+      expect(result).toEqual({ conflict: false });
+    });
+
+    it('returns conflict=true with status=connected when a connected row exists', async () => {
+      integrationRepo.find = jest.fn().mockResolvedValue([
+        {
+          id: 'conn-1',
+          name: 'priv-shop (Cafe24 Private)',
+          status: 'connected',
+          serviceType: 'cafe24',
+          mallId: 'priv-shop',
+          credentials: { mall_id: 'priv-shop', app_type: 'private' },
+        },
+      ]);
+      const result = await service.precheckCafe24Mall('ws-1', 'priv-shop');
+      expect(result).toEqual({
+        conflict: true,
+        existingIntegrationId: 'conn-1',
+        existingName: 'priv-shop (Cafe24 Private)',
+        status: 'connected',
+      });
+    });
+
+    it('prefers connected over pending_install when both exist', async () => {
+      integrationRepo.find = jest.fn().mockResolvedValue([
+        {
+          id: 'pending-1',
+          name: 'pending',
+          status: 'pending_install',
+          serviceType: 'cafe24',
+          mallId: 'priv-shop',
+          credentials: { mall_id: 'priv-shop', app_type: 'private' },
+        },
+        {
+          id: 'conn-1',
+          name: 'connected',
+          status: 'connected',
+          serviceType: 'cafe24',
+          mallId: 'priv-shop',
+          credentials: { mall_id: 'priv-shop', app_type: 'private' },
+        },
+      ]);
+      const result = await service.precheckCafe24Mall('ws-1', 'priv-shop');
+      expect(result.status).toBe('connected');
+      expect(result.existingIntegrationId).toBe('conn-1');
+    });
+
+    it('returns status=pending_install when only pending row exists', async () => {
+      integrationRepo.find = jest.fn().mockResolvedValue([
+        {
+          id: 'pending-1',
+          name: 'pending',
+          status: 'pending_install',
+          serviceType: 'cafe24',
+          mallId: 'priv-shop',
+          credentials: { mall_id: 'priv-shop', app_type: 'private' },
+        },
+      ]);
+      const result = await service.precheckCafe24Mall('ws-1', 'priv-shop');
+      expect(result.status).toBe('pending_install');
+      expect(result.existingIntegrationId).toBe('pending-1');
+    });
+
+    it('returns status=error when only error row exists', async () => {
+      integrationRepo.find = jest.fn().mockResolvedValue([
+        {
+          id: 'err-1',
+          name: 'broken',
+          status: 'error',
+          serviceType: 'cafe24',
+          mallId: 'priv-shop',
+          credentials: { mall_id: 'priv-shop', app_type: 'private' },
+        },
+      ]);
+      const result = await service.precheckCafe24Mall('ws-1', 'priv-shop');
+      expect(result.status).toBe('error');
+    });
+  });
+
   describe('handleInstall — Cafe24 private app App URL', () => {
     const clientSecret = 'test-private-secret';
     // 16바이트 base64url = 22자 (spec/2-navigation/4-integration.md §9.2)

```

---

### 파일 4: backend/src/modules/integrations/integration-oauth.service.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integration-oauth.service.ts b/backend/src/modules/integrations/integration-oauth.service.ts
index 97352d7d..71fa7731 100644
--- a/backend/src/modules/integrations/integration-oauth.service.ts
+++ b/backend/src/modules/integrations/integration-oauth.service.ts
@@ -393,6 +393,26 @@ export class IntegrationOAuthService {
           });
         }
         clientId = envClientId;
+        // Public-flow begin pre-check (2026-05-16): block before any OAuth
+        // round-trip if `(workspaceId, mall_id)` already has a `connected`
+        // cafe24 Integration. Without this, the user would only learn of
+        // the conflict at finalize (`POST /api/integrations`) — *after*
+        // completing the consent flow — where V045 partial UNIQUE rejects
+        // the INSERT. spec/2-navigation/4-integration.md §9.2 Rationale
+        // "Cafe24 Public 흐름의 begin-time 사전 가드 추가". 코드 재사용:
+        // private 흐름과 동일한 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` —
+        // spec line 725 가 이미 "app_type 무관" 으로 정의해 의미상 정합.
+        const existingConnected = await this.findConnectedCafe24MallIntegration(
+          params.workspaceId,
+          meta.mall_id,
+        );
+        if (existingConnected) {
+          throw new ConflictException({
+            code: 'CAFE24_PRIVATE_APP_ALREADY_CONNECTED',
+            message: `A Cafe24 integration for mall_id "${meta.mall_id}" already exists and is connected. Use the existing integration or delete it first.`,
+            integrationId: existingConnected.id,
+          });
+        }
       }
       providerMeta = {
         mall_id: meta.mall_id,
@@ -1025,41 +1045,13 @@ export class IntegrationOAuthService {
   ): Promise<BeginResult> {
     const appUrl = process.env.APP_URL || 'http://localhost:3011';
 
-    // Duplicate-prevention.
-    //
-    // C2 + E2 (2026-05-16) — 두 가지 동시 개선:
-    //   • C2 (REQ HIGH-5): spec §9.2 는 중복 감지를 "app_type 무관" 으로
-    //     정의한다. 옛 in-memory 필터는 `row.credentials?.app_type ===
-    //     'private'` 까지 AND 로 걸어, public 으로 이미 연결된 동일 mall_id
-    //     에 대해 Private 앱 begin 을 허용하던 결함이 있었다. 이 조건을
-    //     제거해 spec 일치.
-    //   • E2 (DB H-2): 옛 코드는 workspace 의 모든 cafe24 row 를 in-memory
-    //     로 가져온 뒤 mall_id 비교. V045 의 plain mall_id 컬럼 + V046
-    //     partial UNIQUE 가 있는 지금은 SQL 직접 조회가 가능하므로
-    //     `{ workspaceId, serviceType, mallId }` 조건으로 단일 쿼리.
-    //     workspace 당 cafe24 통합이 많아도 O(1) 행만 가져온다.
-    //
-    // 단 V045 이전 row (`mallId IS NULL`) 의 fallback 은 별도 보정 쿼리로
-    // 처리한다. 이는 곧 backfill 완료 후 제거 예정.
-    const sameMall = await this.integrationRepository.find({
-      where: {
-        workspaceId: params.workspaceId,
-        serviceType: 'cafe24',
-        mallId: meta.mall_id,
-      },
-    });
-    // V045 이전 row 보정 — plain mall_id 컬럼이 NULL 인 행은 credentials
-    // JSONB 의 mall_id 로 매칭. backfill 완료 후 제거 예정.
-    const sameMallLegacy = (
-      await this.integrationRepository.find({
-        where: {
-          workspaceId: params.workspaceId,
-          serviceType: 'cafe24',
-          mallId: IsNull(),
-        },
-      })
-    ).filter((row) => row.credentials?.mall_id === meta.mall_id);
-    const allSameMall = [...sameMall, ...sameMallLegacy];
+    // Duplicate-prevention — shared helper (also used by public-flow begin
+    // and the precheck endpoint). 동일 (workspaceId, mall_id) 의 `connected`
+    // cafe24 row 가 있으면 즉시 409 로 거부. spec §9.2 "app_type 무관".
+    const allSameMall = await this.findAllCafe24RowsForMall(
+      params.workspaceId,
+      meta.mall_id,
+    );
     const alreadyConnected = allSameMall.find(
       (row) => row.status === 'connected',
     );
@@ -1470,6 +1462,109 @@ export class IntegrationOAuthService {
     );
   }
 
+  // ---------------------------------------------------------------------
+  // Cafe24 duplicate-detection — begin pre-check + precheck endpoint
+  // ---------------------------------------------------------------------
+
+  /**
+   * Return all cafe24 Integration rows for `(workspaceId, mallId)`.
+   *
+   * Primary path: SQL filter on the V045 plain `mall_id` column (O(1) rows).
+   * Legacy fallback: rows from before V045 still have `mall_id IS NULL` —
+   * match them via the encrypted `credentials.mall_id` JSONB field. backfill
+   * 완료 후 fallback 제거 예정.
+   *
+   * Shared by `createPrivatePendingIntegration` (begin private guard +
+   * pending_install reuse), the public-flow begin guard, and
+   * `precheckCafe24Mall` (frontend pre-detection endpoint).
+   */
+  private async findAllCafe24RowsForMall(
+    workspaceId: string,
+    mallId: string,
+  ): Promise<Integration[]> {
+    const direct = await this.integrationRepository.find({
+      where: { workspaceId, serviceType: 'cafe24', mallId },
+    });
+    const legacy = (
+      await this.integrationRepository.find({
+        where: { workspaceId, serviceType: 'cafe24', mallId: IsNull() },
+      })
+    ).filter((row) => row.credentials?.mall_id === mallId);
+    return [...direct, ...legacy];
+  }
+
+  /**
+   * Return the first `connected` cafe24 row for `(workspaceId, mallId)`,
+   * or null if none exists. Used by both public-flow and private-flow
+   * begin pre-checks to block duplicate adds before any OAuth round-trip.
+   */
+  private async findConnectedCafe24MallIntegration(
+    workspaceId: string,
+    mallId: string,
+  ): Promise<Integration | null> {
+    const all = await this.findAllCafe24RowsForMall(workspaceId, mallId);
+    return all.find((row) => row.status === 'connected') ?? null;
+  }
+
+  /**
+   * Read-only conflict snapshot for the frontend's mall_id input precheck.
+   *
+   * Returns the most-restrictive cafe24 row for `(workspaceId, mallId)` —
+   * priority `connected > pending_install > error > expired` — so the UI
+   * can render context-aware inline warnings *before* the user clicks
+   * Connect. spec/2-navigation/4-integration.md §9.2 Rationale "precheck
+   * endpoint — mall_id 입력 단계 사전 감지 UX".
+   *
+   * Never exposes credentials/tokens/timestamps — only the bare
+   * (id, name, status) tuple needed for the inline alert + deep link.
+   */
+  async precheckCafe24Mall(
+    workspaceId: string,
+    mallId: string,
+  ): Promise<{
+    conflict: boolean;
+    existingIntegrationId?: string;
+    existingName?: string;
+    status?: 'connected' | 'pending_install' | 'expired' | 'error';
+  }> {
+    const all = await this.findAllCafe24RowsForMall(workspaceId, mallId);
+    if (all.length === 0) return { conflict: false };
+    // priority: connected > pending_install > error > expired (most-
+    // restrictive first — `connected` is a true duplicate, `pending_install`
+    // indicates an in-progress install that should reuse, error/expired are
+    // recoverable via reauthorize / delete + re-add).
+    const PRIORITY = [
+      'connected',
+      'pending_install',
+      'error',
+      'expired',
+    ] as const;
+    for (const status of PRIORITY) {
+      const hit = all.find((row) => row.status === status);
+      if (hit) {
+        return {
+          conflict: true,
+          existingIntegrationId: hit.id,
+          existingName: hit.name,
+          status,
+        };
+      }
+    }
+    // Fallback: any other status (e.g. transitional). Surface as conflict so
+    // the user knows a row exists and the V045 UNIQUE will reject finalize.
+    const fallback = all[0];
+    return {
+      conflict: true,
+      existingIntegrationId: fallback.id,
+      existingName: fallback.name,
+      status: fallback.status as
+        | 'connected'
+        | 'pending_install'
+        | 'expired'
+        | 'error',
+    };
+  }
+
   // ---------------------------------------------------------------------
   // Maintenance
   // ---------------------------------------------------------------------

```

---

### 파일 5: backend/src/modules/integrations/integrations.controller.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integrations.controller.ts b/backend/src/modules/integrations/integrations.controller.ts
index 32bdaa95..77f043b5 100644
--- a/backend/src/modules/integrations/integrations.controller.ts
+++ b/backend/src/modules/integrations/integrations.controller.ts
@@ -34,6 +34,7 @@ import {
   ApiOkWrappedResponse,
 } from '../../common/swagger';
 import {
+  Cafe24PrecheckResultDto,
   IntegrationActivityDto,
   IntegrationDto,
   IntegrationUsagesDto,
@@ -49,6 +50,7 @@ import { CurrentUser, WorkspaceId } from '../../common/decorators';
 import type { JwtPayload } from '../../common/decorators';
 import {
   ActivityQueryDto,
+  Cafe24PrecheckQueryDto,
   CreateIntegrationDto,
   ListIntegrationsQueryDto,
   OAuthBeginDto,
@@ -167,7 +169,7 @@ export class IntegrationsController {
   @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
   @ApiConflictResponse({
     description:
-      'CAFE24_PRIVATE_APP_ALREADY_CONNECTED — 동일 (workspaceId, mall_id, app_type=private) 의 connected 통합이 이미 존재. 기존 통합을 사용하거나 삭제 후 재등록.',
+      'CAFE24_PRIVATE_APP_ALREADY_CONNECTED — 동일 (workspaceId, mall_id) 의 connected cafe24 통합이 이미 존재 (app_type 무관 — public/private 둘 다). 기존 통합을 사용하거나 삭제 후 재등록. spec/2-navigation/4-integration.md §9.2.',
   })
   async oauthBegin(
     @WorkspaceId() workspaceId: string,
@@ -206,6 +208,35 @@ export class IntegrationsController {
   // `ThirdPartyOAuthController` (`/api/3rd-party/...`) 가 담당.
   // spec/2-navigation/4-integration.md §9.2.
 
+  // ※ 라우트 선언 순서 주의: `cafe24/precheck` 는 동적 경로
+  // `@Get(':id')` / `@Get(':id/usages')` / `@Get(':id/activity')` 보다
+  // **앞에** 선언되어야 한다. NestJS 는 Express 라우터 순서를 따르므로
+  // `:id` 가 먼저 매칭되면 `cafe24/precheck` 가 `id='cafe24'` 의
+  // `ParseUUIDPipe` 위반으로 400 을 받는다. 빌드 타임에 탐지되지 않으므로
+  // 향후 리팩토링 시 본 주석을 보존할 것.
+  @Throttle({ default: { limit: 60, ttl: 60_000 } })
+  @Get('cafe24/precheck')
+  @ApiOperation({
+    summary: 'Cafe24 mall_id 중복 사전 감지',
+    description:
+      '현재 워크스페이스에 같은 mall_id 의 cafe24 통합이 이미 있는지 사전 확인합니다. 프론트엔드가 mall_id 입력 단계에서 debounce 호출해 inline 경고 배너를 띄우는 용도. 자격 증명·토큰은 포함되지 않으며, 가장 제한적인 상태 (connected > pending_install > error > expired) 만 반환합니다. 분당 60회 제한.',
+  })
+  @ApiOkWrappedResponse(Cafe24PrecheckResultDto, {
+    description:
+      'conflict 여부 + (존재 시) 충돌 대상 통합의 id/name/status. 자격 증명 미포함',
+  })
+  @ApiBadRequestResponse({
+    description: 'mallId 형식 위반 (^[a-z0-9-]{3,50}$)',
+  })
+  @ApiTooManyRequestsResponse({ description: '요청 한도 초과 (분당 60회)' })
+  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
+  async cafe24Precheck(
+    @WorkspaceId() workspaceId: string,
+    @Query() query: Cafe24PrecheckQueryDto,
+  ) {
+    return this.oauthService.precheckCafe24Mall(workspaceId, query.mallId);
+  }
+
   @Get(':id')
   @ApiOperation({
     summary: '통합 단건 조회',

```

---

### 파일 6: backend/src/modules/integrations/integrations.service.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integrations.service.spec.ts b/backend/src/modules/integrations/integrations.service.spec.ts
index 0168e76e..e1d0d212 100644
--- a/backend/src/modules/integrations/integrations.service.spec.ts
+++ b/backend/src/modules/integrations/integrations.service.spec.ts
@@ -860,6 +860,65 @@ describe('IntegrationsService', () => {
       };
       expect(createArg.lastRotatedAt).toBeInstanceOf(Date);
     });
+
+    // V045 partial UNIQUE `idx_integration_cafe24_workspace_mall` race
+    // backstop (2026-05-16) — Cafe24 Public 흐름은 begin 단계에서 row 를
+    // 만들지 않으므로 finalize (`POST /api/integrations`) 의 INSERT 가 동시
+    // 진입 시 V045 UNIQUE 위반을 일으킬 수 있다. 옛 `throwIfUniqueViolation`
+    // 은 `integration_workspace_name_unique` 만 처리해 raw QueryFailedError
+    // 가 500 으로 빠지던 결함을 해결. 두 race 경로 (public finalize +
+    // private begin 동시 신청) 모두 동일한 409 코드로 변환.
+    it('translates cafe24 mall_id unique violation to CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)', async () => {
+      integrationRepo.save = jest.fn().mockRejectedValueOnce(
+        Object.assign(
+          new Error('duplicate key value violates unique constraint'),
+          {
+            code: '23505',
+            constraint: 'idx_integration_cafe24_workspace_mall',
+          },
+        ),
+      );
+      const error = await service
+        .create('ws-1', 'user-1', 'member', {
+          serviceType: 'http',
+          authType: 'api_key',
+          name: 'My API',
+          credentials: {
+            location: 'header',
+            key_name: 'X-Api-Key',
+            value: 'secret',
+          },
+        })
+        .catch((e: Error) => e);
+      const response = (error as { response?: { code?: string } }).response;
+      expect(response?.code).toBe('CAFE24_PRIVATE_APP_ALREADY_CONNECTED');
+    });
+
+    it('translates integration name unique violation to INTEGRATION_NAME_TAKEN (409)', async () => {
+      integrationRepo.save = jest.fn().mockRejectedValueOnce(
+        Object.assign(
+          new Error('duplicate key value violates unique constraint'),
+          {
+            code: '23505',
+            constraint: 'integration_workspace_name_unique',
+          },
+        ),
+      );
+      const error = await service
+        .create('ws-1', 'user-1', 'member', {
+          serviceType: 'http',
+          authType: 'api_key',
+          name: 'My API',
+          credentials: {
+            location: 'header',
+            key_name: 'X-Api-Key',
+            value: 'secret',
+          },
+        })
+        .catch((e: Error) => e);
+      const response = (error as { response?: { code?: string } }).response;
+      expect(response?.code).toBe('INTEGRATION_NAME_TAKEN');
+    });
   });
 
   // -----------------------------------------------------------------

```

---

### 파일 7: backend/src/modules/integrations/integrations.service.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integrations.service.ts b/backend/src/modules/integrations/integrations.service.ts
index 9022e134..8f324f8c 100644
--- a/backend/src/modules/integrations/integrations.service.ts
+++ b/backend/src/modules/integrations/integrations.service.ts
@@ -1098,15 +1098,26 @@ export class IntegrationsService {
   private throwIfUniqueViolation(err: unknown): void {
     const code = (err as { code?: string })?.code;
     const constraint = (err as { constraint?: string })?.constraint;
-    if (
-      code === '23505' &&
-      constraint === 'integration_workspace_name_unique'
-    ) {
+    if (code !== '23505') return;
+    if (constraint === 'integration_workspace_name_unique') {
       throw new ConflictException({
         code: 'INTEGRATION_NAME_TAKEN',
         message: 'Integration name is already in use within this workspace',
       });
     }
+    // V045 partial UNIQUE `(workspace_id, mall_id) WHERE service_type='cafe24'`
+    // — Cafe24 Public 흐름은 begin 단계에서 row 를 만들지 않아 finalize
+    // 단계의 동시 신청 race 또는 begin pre-check 통과 후 DB-level race 가
+    // 본 constraint 로 잡힌다. 옛 코드는 본 분기를 누락해 raw QueryFailedError
+    // 가 500 으로 빠지던 결함이 있었다. spec/2-navigation/4-integration.md
+    // §9.4 — `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 의 race backstop 분기.
+    if (constraint === 'idx_integration_cafe24_workspace_mall') {
+      throw new ConflictException({
+        code: 'CAFE24_PRIVATE_APP_ALREADY_CONNECTED',
+        message:
+          'A Cafe24 integration with this mall_id already exists in this workspace. Use the existing integration or delete it first.',
+      });
+    }
   }
 
   private async dispatchTest(

```

---

### 파일 8: backend/test/integration-cafe24-precheck.e2e-spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/test/integration-cafe24-precheck.e2e-spec.ts b/backend/test/integration-cafe24-precheck.e2e-spec.ts
new file mode 100644
index 00000000..40ce0d6b
--- /dev/null
+++ b/backend/test/integration-cafe24-precheck.e2e-spec.ts
@@ -0,0 +1,180 @@
+import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
+import { Client } from 'pg';
+import request from 'supertest';
+
+import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
+import { registerAndLogin, createTeamWorkspace } from './helpers/auth';
+
+type RegisterResult = Awaited<ReturnType<typeof registerAndLogin>>;
+
+/**
+ * e2e: Cafe24 mall_id precheck endpoint — spec/2-navigation/4-integration.md §9.2.
+ *
+ * 보호 대상:
+ *   - 새로운 mall_id 는 conflict=false (begin 호출 안전)
+ *   - 같은 mall_id 의 connected cafe24 통합이 있으면 conflict=true + status='connected'
+ *   - mallId 형식 위반 시 400 (BadRequest)
+ *   - 자격 증명 / 토큰 / timestamps 미노출 (response shape 검증)
+ *   - 라우트 선언 순서 회귀 — `cafe24/precheck` 가 동적 `@Get(':id')` 보다 먼저 매칭되어야 함
+ *     (NestJS 라우트가 `@Get(':id')` 와 `ParseUUIDPipe` 에 잡혀 400 으로 빠지는 회귀 차단)
+ *   - cross-workspace 격리 — 다른 워크스페이스의 cafe24 통합은 노출되지 않음
+ */
+
+const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
+
+describe('Cafe24 precheck endpoint (e2e)', () => {
+  let db: Client;
+  let owner: RegisterResult;
+  let token: string;
+  let workspaceId: string;
+  let otherWorkspaceId: string;
+
+  beforeAll(async () => {
+    db = createDbClient();
+    await db.connect();
+    owner = await registerAndLogin(BASE_URL, uniqueEmail('cafe24-pre'), db);
+    token = owner.accessToken;
+    workspaceId = await createTeamWorkspace(
+      BASE_URL,
+      token,
+      uniqueName('CAFE24'),
+    );
+    otherWorkspaceId = await createTeamWorkspace(
+      BASE_URL,
+      token,
+      uniqueName('CAFE24-OTHER'),
+    );
+  }, 60_000);
+
+  afterAll(async () => {
+    await db.end();
+  });
+
+  async function insertCafe24Row(opts: {
+    workspaceId: string;
+    mallId: string;
+    status: 'connected' | 'pending_install' | 'expired' | 'error';
+    name?: string;
+  }): Promise<string> {
+    const name = opts.name ?? uniqueName('cafe24');
+    // 직접 DB INSERT — controller 의 cafe24 create 흐름은 OAuth 가 필요해
+    // e2e 에서 시뮬레이션이 번거롭다. precheck endpoint 는 row 의 status /
+    // mallId 만 보므로 minimal row 로 충분.
+    // credentials 는 JSONB (encryptedJsonTransformer 를 우회) — precheck
+    // endpoint 는 credentials 를 읽지 않으므로 빈 객체로 충분. mall_id 는
+    // plain 컬럼이라 별도 매핑 없이 직접 set. created_by 는 NOT NULL 이라
+    // owner 의 userId 를 넘긴다.
+    const r = await db.query<{ id: string }>(
+      `INSERT INTO integration
+        (workspace_id, service_type, auth_type, name, scope, status, mall_id, credentials, created_by)
+       VALUES ($1, 'cafe24', 'oauth2', $2, 'personal', $3, $4, '{}'::jsonb, $5)
+       RETURNING id`,
+      [opts.workspaceId, name, opts.status, opts.mallId, owner.userId],
+    );
+    return r.rows[0].id;
+  }
+
+  it('returns conflict=false when no cafe24 row matches the mall_id', async () => {
+    const res = await request(BASE_URL)
+      .get('/api/integrations/cafe24/precheck')
+      .query({ mallId: 'fresh-mall-' + Date.now().toString(36) })
+      .set('Authorization', `Bearer ${token}`)
+      .set('X-Workspace-Id', workspaceId);
+    expect(res.status).toBe(200);
+    expect(res.body.data).toEqual({ conflict: false });
+  });
+
+  it('returns conflict=true with status=connected when a connected row exists', async () => {
+    const mallId = 'conn-' + Math.random().toString(36).slice(2, 8);
+    const name = uniqueName('Cafe24Conn');
+    const integrationId = await insertCafe24Row({
+      workspaceId,
+      mallId,
+      status: 'connected',
+      name,
+    });
+
+    const res = await request(BASE_URL)
+      .get('/api/integrations/cafe24/precheck')
+      .query({ mallId })
+      .set('Authorization', `Bearer ${token}`)
+      .set('X-Workspace-Id', workspaceId);
+    expect(res.status).toBe(200);
+    expect(res.body.data).toEqual({
+      conflict: true,
+      existingIntegrationId: integrationId,
+      existingName: name,
+      status: 'connected',
+    });
+    // 자격 증명 누설 방어 — 응답 shape 에 (id, name, status, conflict) 외
+    // 어떤 키도 있어서는 안 된다.
+    expect(Object.keys(res.body.data).sort()).toEqual([
+      'conflict',
+      'existingIntegrationId',
+      'existingName',
+      'status',
+    ]);
+  });
+
+  it('rejects mallId with invalid characters (400)', async () => {
+    const res = await request(BASE_URL)
+      .get('/api/integrations/cafe24/precheck')
+      .query({ mallId: 'INVALID_UPPER' })
+      .set('Authorization', `Bearer ${token}`)
+      .set('X-Workspace-Id', workspaceId);
+    expect(res.status).toBe(400);
+  });
+
+  it('rejects missing mallId (400)', async () => {
+    const res = await request(BASE_URL)
+      .get('/api/integrations/cafe24/precheck')
+      .set('Authorization', `Bearer ${token}`)
+      .set('X-Workspace-Id', workspaceId);
+    expect(res.status).toBe(400);
+  });
+
+  /**
+   * 라우트 순서 회귀 — `cafe24/precheck` 가 `@Get(':id')` 보다 앞에 선언되어야
+   * 한다. 뒤에 선언되면 NestJS 가 `id='cafe24'` 의 ParseUUIDPipe 위반을
+   * 먼저 발생시켜 본 endpoint 가 절대 호출되지 않는다. consistency-check
+   * Warning #7 (2026-05-16) 회귀 안전망.
+   */
+  it('route order — cafe24/precheck is matched before @Get(":id") (no ParseUUIDPipe 400)', async () => {
+    const res = await request(BASE_URL)
+      .get('/api/integrations/cafe24/precheck')
+      .query({
+        mallId: 'route-order-' + Math.random().toString(36).slice(2, 8),
+      })
+      .set('Authorization', `Bearer ${token}`)
+      .set('X-Workspace-Id', workspaceId);
+    // route 가 잘못 잡히면 ParseUUIDPipe 가 'cafe24' 를 UUID 로 해석 시도해
+    // 400 (BAD_REQUEST: Validation failed (uuid is expected)) 으로 떨어진다.
+    // 200 인 경우만 정상.
+    expect(res.status).toBe(200);
+  });
+
+  it('isolates conflicts across workspaces — other workspace rows are not visible', async () => {
+    const mallId = 'cross-' + Math.random().toString(36).slice(2, 8);
+    // 다른 워크스페이스에만 row 생성
+    await insertCafe24Row({
+      workspaceId: otherWorkspaceId,
+      mallId,
+      status: 'connected',
+    });
+
+    const res = await request(BASE_URL)
+      .get('/api/integrations/cafe24/precheck')
+      .query({ mallId })
+      .set('Authorization', `Bearer ${token}`)
+      .set('X-Workspace-Id', workspaceId);
+    expect(res.status).toBe(200);
+    expect(res.body.data).toEqual({ conflict: false });
+  });
+
+  it('requires authentication (401 without bearer token)', async () => {
+    const res = await request(BASE_URL)
+      .get('/api/integrations/cafe24/precheck')
+      .query({ mallId: 'unauth-test' });
+    expect(res.status).toBe(401);
+  });
+});

```

---

### 파일 9: frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx b/frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx
new file mode 100644
index 00000000..c74bdded
--- /dev/null
+++ b/frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx
@@ -0,0 +1,240 @@
+/**
+ * Cafe24 mall_id 사전 중복 감지 — `/integrations/new` 의 cafe24 step.
+ * spec/2-navigation/4-integration.md §9.2.
+ *
+ * 검증 대상:
+ *   - 유효 mall_id 입력 시 350ms debounce 후 precheck 호출
+ *   - conflict=true → inline 경고 배너 표시 + Connect 버튼 disabled
+ *   - 기존 통합 deep link 노출
+ *   - status 별 안내 문구 분기 (connected / pending_install / expired / error)
+ *   - mall_id 형식 위반 시 precheck 호출 자체 skip
+ */
+import { describe, it, expect, beforeEach, vi } from "vitest";
+import { render, screen, act, cleanup, waitFor } from "@testing-library/react";
+import userEvent from "@testing-library/user-event";
+import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
+import { useLocaleStore } from "@/lib/stores/locale-store";
+
+const mockPush = vi.fn();
+const mockReplace = vi.fn();
+let currentSearchParams = new URLSearchParams();
+vi.mock("next/navigation", () => ({
+  useRouter: () => ({ push: mockPush, replace: mockReplace, back: vi.fn() }),
+  usePathname: () => "/integrations/new",
+  useSearchParams: () => currentSearchParams,
+}));
+
+const servicesMock = vi.fn();
+const precheckMock = vi.fn();
+const oauthBeginMock = vi.fn();
+vi.mock("@/lib/api/integrations", () => ({
+  integrationsApi: {
+    services: () => servicesMock(),
+    cafe24Precheck: (...args: unknown[]) => precheckMock(...args),
+    oauthBegin: (...args: unknown[]) => oauthBeginMock(...args),
+    create: vi.fn(),
+  },
+}));
+
+// useCafe24PendingPolling 은 본 테스트와 무관하므로 stub.
+vi.mock("@/lib/integrations/use-cafe24-pending-polling", () => ({
+  useCafe24PendingPolling: () => ({ status: "idle" }),
+}));
+
+import NewIntegrationPage from "../page";
+
+const CAFE24_SERVICE = {
+  type: "cafe24",
+  name: "Cafe24",
+  meta: { publicAppAvailable: true },
+  scopes: [
+    { value: "mall.read_product", label: "상품 읽기", recommended: true },
+  ],
+  authVariants: [
+    {
+      authType: "oauth2",
+      label: "OAuth 2.0",
+      fields: [],
+    },
+  ],
+};
+
+function createWrapper() {
+  const queryClient = new QueryClient({
+    defaultOptions: { queries: { retry: false } },
+  });
+  return function Wrapper({ children }: { children: React.ReactNode }) {
+    return (
+      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
+    );
+  };
+}
+
+async function renderPage() {
+  await act(async () => {
+    render(<NewIntegrationPage />, { wrapper: createWrapper() });
+  });
+}
+
+describe("/integrations/new — Cafe24 mall_id 사전 중복 감지", () => {
+  beforeEach(() => {
+    vi.clearAllMocks();
+    vi.useFakeTimers({ shouldAdvanceTime: true });
+    currentSearchParams = new URLSearchParams("service=cafe24");
+    useLocaleStore.setState({ locale: "ko" });
+    cleanup();
+    servicesMock.mockResolvedValue([CAFE24_SERVICE]);
+    precheckMock.mockResolvedValue({ conflict: false });
+  });
+
+  afterEach(() => {
+    vi.useRealTimers();
+  });
+
+  it("도메인 형식이 맞으면 350ms debounce 후 precheck 호출", async () => {
+    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
+    await renderPage();
+    await screen.findByLabelText(/Mall ID/i);
+
+    const mallIdInput = screen.getByLabelText(/Mall ID/i);
+    await user.type(mallIdInput, "myshop");
+
+    // 350ms debounce — 그 전엔 호출 없음
+    expect(precheckMock).not.toHaveBeenCalled();
+    await act(async () => {
+      vi.advanceTimersByTime(360);
+    });
+    await waitFor(() => {
+      expect(precheckMock).toHaveBeenCalledWith("myshop");
+    });
+  });
+
+  it("패턴 위반 mall_id 는 precheck 호출 skip", async () => {
+    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
+    await renderPage();
+    await screen.findByLabelText(/Mall ID/i);
+
+    const mallIdInput = screen.getByLabelText(/Mall ID/i);
+    await user.type(mallIdInput, "AB"); // 3자 미만 + 대문자
+
+    await act(async () => {
+      vi.advanceTimersByTime(500);
+    });
+    expect(precheckMock).not.toHaveBeenCalled();
+  });
+
+  it("conflict=true (status=connected) 면 inline 배너 표시 + 기존 통합 링크", async () => {
+    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
+    precheckMock.mockResolvedValueOnce({
+      conflict: true,
+      existingIntegrationId: "int-abc",
+      existingName: "myshop (Cafe24)",
+      status: "connected",
+    });
+
+    await renderPage();
+    await screen.findByLabelText(/Mall ID/i);
+    const mallIdInput = screen.getByLabelText(/Mall ID/i);
+    await user.type(mallIdInput, "myshop");
+    await act(async () => {
+      vi.advanceTimersByTime(360);
+    });
+
+    // 한글 배너 제목 + 본문 (connected 분기)
+    await waitFor(() => {
+      expect(
+        screen.getByText("이 mall ID 는 이미 연결되어 있어요"),
+      ).toBeInTheDocument();
+    });
+    expect(
+      screen.getByText(/이미 활성 상태로 연결돼 있어요/),
+    ).toBeInTheDocument();
+
+    // 기존 통합 deep link
+    const link = screen.getByRole("link", { name: /기존 통합 열기/ });
+    expect(link).toHaveAttribute("href", "/integrations/int-abc");
+    expect(link.textContent).toContain("myshop (Cafe24)");
+  });
+
+  it("status=pending_install 이면 pending 안내 메시지", async () => {
+    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
+    precheckMock.mockResolvedValueOnce({
+      conflict: true,
+      existingIntegrationId: "int-pending",
+      existingName: "pending shop",
+      status: "pending_install",
+    });
+    await renderPage();
+    await screen.findByLabelText(/Mall ID/i);
+    const mallIdInput = screen.getByLabelText(/Mall ID/i);
+    await user.type(mallIdInput, "myshop");
+    await act(async () => {
+      vi.advanceTimersByTime(360);
+    });
+    await waitFor(() => {
+      expect(
+        screen.getByText(/이미 설치 대기 중이에요/),
+      ).toBeInTheDocument();
+    });
+  });
+
+  it("status=expired 이면 expired 안내", async () => {
+    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
+    precheckMock.mockResolvedValueOnce({
+      conflict: true,
+      existingIntegrationId: "int-exp",
+      existingName: "expired",
+      status: "expired",
+    });
+    await renderPage();
+    await screen.findByLabelText(/Mall ID/i);
+    const mallIdInput = screen.getByLabelText(/Mall ID/i);
+    await user.type(mallIdInput, "myshop");
+    await act(async () => {
+      vi.advanceTimersByTime(360);
+    });
+    await waitFor(() => {
+      expect(
+        screen.getByText(/이미 만료 상태로 존재해요/),
+      ).toBeInTheDocument();
+    });
+  });
+
+  it("status=error 이면 error 안내", async () => {
+    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
+    precheckMock.mockResolvedValueOnce({
+      conflict: true,
+      existingIntegrationId: "int-err",
+      existingName: "broken",
+      status: "error",
+    });
+    await renderPage();
+    await screen.findByLabelText(/Mall ID/i);
+    const mallIdInput = screen.getByLabelText(/Mall ID/i);
+    await user.type(mallIdInput, "myshop");
+    await act(async () => {
+      vi.advanceTimersByTime(360);
+    });
+    await waitFor(() => {
+      expect(
+        screen.getByText(/이미 오류 상태로 존재해요/),
+      ).toBeInTheDocument();
+    });
+  });
+
+  it("precheck 자체 실패 시 silent — 배너 표시되지 않음", async () => {
+    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
+    precheckMock.mockRejectedValueOnce(new Error("network"));
+    await renderPage();
+    await screen.findByLabelText(/Mall ID/i);
+    const mallIdInput = screen.getByLabelText(/Mall ID/i);
+    await user.type(mallIdInput, "myshop");
+    await act(async () => {
+      vi.advanceTimersByTime(360);
+    });
+    // 배너 미표시
+    expect(
+      screen.queryByText("이 mall ID 는 이미 연결되어 있어요"),
+    ).not.toBeInTheDocument();
+  });
+});

```

---

### 파일 10: frontend/src/app/(main)/integrations/new/page.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/app/(main)/integrations/new/page.tsx b/frontend/src/app/(main)/integrations/new/page.tsx
index 1bd5f94f..b05d48b8 100644
--- a/frontend/src/app/(main)/integrations/new/page.tsx
+++ b/frontend/src/app/(main)/integrations/new/page.tsx
@@ -5,7 +5,14 @@ import { useRouter, useSearchParams } from "next/navigation";
 import Link from "next/link";
 import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
 import { toast } from "sonner";
-import { ArrowLeft, CheckCircle2, Copy, Loader2, XCircle } from "lucide-react";
+import {
+  AlertTriangle,
+  ArrowLeft,
+  CheckCircle2,
+  Copy,
+  Loader2,
+  XCircle,
+} from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
@@ -13,12 +20,13 @@ import { cn } from "@/lib/utils/cn";
 import {
   integrationsApi,
   type AuthVariant,
+  type Cafe24PrecheckResult,
   type IntegrationScope,
   type ServiceDefinition,
 } from "@/lib/api/integrations";
 import { ServiceIcon } from "../_shared/service-icons";
 import { CredentialsForm } from "../_shared/credentials-form";
-import { useT, type TFunction } from "@/lib/i18n";
+import { useT, type TFunction, type TranslationKey } from "@/lib/i18n";
 import { useCafe24PendingPolling } from "@/lib/integrations/use-cafe24-pending-polling";
 
 interface OAuthCallbackPayload {
@@ -84,6 +92,75 @@ export default function NewIntegrationPage() {
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [variant]);
 
+  // Cafe24 mall_id 사전 중복 감지 상태 (2026-05-16).
+  // mall_id 입력 시 350ms debounce 로 backend precheck endpoint 호출 →
+  // conflict 발견 시 inline 경고 배너 + Connect 버튼 disable.
+  // spec/2-navigation/4-integration.md §9.2.
+  const [cafe24Conflict, setCafe24Conflict] =
+    useState<Cafe24PrecheckResult | null>(null);
+  const [cafe24PrecheckLoading, setCafe24PrecheckLoading] = useState(false);
+  const cafe24MallIdInput = String(credentials.mall_id ?? "").trim();
+  const isCafe24OAuth =
+    variant?.authType === "oauth2" && serviceType === "cafe24";
+
+  // mall_id 패턴 매칭이 안 되면 precheck 호출 자체를 skip — backend 가
+  // 400 으로 거부할 페이로드를 보낼 필요 없음. 패턴이 풀리는 순간
+  // 이전 conflict 표시도 클리어해 사용자 입력 도중 잘못된 빨간 배너가
+  // 남아있지 않도록.
+  useEffect(() => {
+    if (!isCafe24OAuth) {
+      setCafe24Conflict(null);
+      return;
+    }
+    if (!/^[a-z0-9-]{3,50}$/.test(cafe24MallIdInput)) {
+      setCafe24Conflict(null);
+      return;
+    }
+    // mall_id 가 바뀔 때마다 350ms debounce — 짧으면 brute-force 호출,
+    // 길면 사용자가 Connect 클릭 시 stale 결과를 보게 됨.
+    let cancelled = false;
+    setCafe24PrecheckLoading(true);
+    const t = setTimeout(async () => {
+      try {
+        const result = await integrationsApi.cafe24Precheck(cafe24MallIdInput);
+        if (!cancelled) setCafe24Conflict(result);
+      } catch {
+        // precheck 자체 실패는 silent — Connect 시점의 backend 가드가
+        // backstop. inline 배너를 띄우지 못해도 안전.
+        if (!cancelled) setCafe24Conflict(null);
+      } finally {
+        if (!cancelled) setCafe24PrecheckLoading(false);
+      }
+    }, 350);
+    return () => {
+      cancelled = true;
+      clearTimeout(t);
+    };
+  }, [isCafe24OAuth, cafe24MallIdInput]);
+
+  /**
+   * 에러 토스트 — `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 는 한글 i18n
+   * 메시지를 primary 로, backend 의 영문 message 는 괄호 안 보조 정보로
+   * 노출. 다른 코드는 기존 동작 유지 (backend message 우선).
+   * 사용자가 "괄호 등을 이용해서 보조 안내로 사용" 지시 (2026-05-16).
+   */
+  const formatErrorToast = (
+    err: unknown,
+    fallbackKey: TranslationKey,
+  ): string => {
+    const e = err as {
+      response?: { data?: { message?: string; code?: string } };
+      message?: string;
+    };
+    const backendCode = e.response?.data?.code;
+    const backendMessage = e.response?.data?.message ?? e.message;
+    if (backendCode === "CAFE24_PRIVATE_APP_ALREADY_CONNECTED") {
+      const primary = t("integrations.cafe24DuplicateMallToast");
+      return backendMessage ? `${primary} (${backendMessage})` : primary;
+    }
+    return backendMessage ?? t(fallbackKey);
+  };
+
   const createMutation = useMutation({
     mutationFn: async () => {
       const isOAuth = variant?.authType === "oauth2";
@@ -105,13 +182,9 @@ export default function NewIntegrationPage() {
       router.push(`/integrations/${created.id}`);
     },
     onError: (err: unknown) => {
-      const e = err as {
-        response?: { data?: { message?: string; code?: string } };
-        message?: string;
-      };
-      const msg =
-        e.response?.data?.message ?? e.message ?? t("integrations.integrationCreateFailedDefault");
-      toast.error(msg);
+      toast.error(
+        formatErrorToast(err, "integrations.integrationCreateFailedDefault"),
+      );
     },
   });
 
@@ -187,8 +260,7 @@ export default function NewIntegrationPage() {
       toast.message(t("integrations.oauthContinueInPopup"));
     },
     onError: (err: unknown) => {
-      const e = err as { response?: { data?: { message?: string } } };
-      toast.error(e.response?.data?.message ?? t("integrations.oauthStartFailed"));
+      toast.error(formatErrorToast(err, "integrations.oauthStartFailed"));
     },
   });
 
@@ -393,6 +465,8 @@ export default function NewIntegrationPage() {
           previewToken={previewToken}
           oauthWaiting={oauthWaiting}
           oauthError={oauthError}
+          cafe24Conflict={cafe24Conflict}
+          cafe24PrecheckLoading={cafe24PrecheckLoading}
           onConnect={() => {
             if (!name.trim()) {
               toast.error(t("integrations.nameRequired"));
@@ -402,6 +476,15 @@ export default function NewIntegrationPage() {
               toast.error(t("integrations.selectAtLeastOneScope"));
               return;
             }
+            // 사전 감지로 중복이 이미 잡혔으면 backend 왕복 자체를 막는다.
+            // backend 도 동일한 가드를 가지지만 사용자 입장에선 toast 만
+            // 보고 OAuth 흐름이 시작 안 되니 inline 배너가 더 명확.
+            if (cafe24Conflict?.conflict) {
+              toast.error(
+                t("integrations.cafe24DuplicateMallToast"),
+              );
+              return;
+            }
             oauthBeginMutation.mutate();
           }}
           connecting={oauthBeginMutation.isPending}
@@ -467,6 +550,8 @@ interface AuthStepProps {
   previewToken: string | null;
   oauthWaiting: boolean;
   oauthError: string | null;
+  cafe24Conflict: Cafe24PrecheckResult | null;
+  cafe24PrecheckLoading: boolean;
   onConnect: () => void;
   connecting: boolean;
   onContinue: () => void;
@@ -489,6 +574,8 @@ function AuthStep({
   previewToken,
   oauthWaiting,
   oauthError,
+  cafe24Conflict,
+  cafe24PrecheckLoading,
   onConnect,
   connecting,
   onContinue,
@@ -581,6 +668,9 @@ function AuthStep({
           credentials={credentials}
           setCredentials={setCredentials}
           publicAppAvailable={service.meta?.publicAppAvailable !== false}
+          conflict={cafe24Conflict}
+          precheckLoading={cafe24PrecheckLoading}
+          t={t}
         />
       )}
 
@@ -641,7 +731,15 @@ function AuthStep({
           <Button
             variant={previewToken ? "outline" : "default"}
             onClick={onConnect}
-            disabled={connecting || oauthWaiting}
+            // Cafe24 사전 중복 감지 — conflict 가 발견된 mall_id 로는 OAuth
+            // 진입 자체를 막는다. 사용자가 mall_id 를 다른 값으로 바꾸거나
+            // 기존 통합을 삭제하지 않는 한 Connect 비활성. backend 가드는
+            // backstop 으로 살아있어 의도적 우회 시도도 안전.
+            disabled={
+              connecting ||
+              oauthWaiting ||
+              cafe24Conflict?.conflict === true
+            }
           >
             {connecting || oauthWaiting ? (
               <Loader2 className="mr-2 h-4 w-4 animate-spin" />
@@ -675,11 +773,19 @@ function Cafe24ExtraFields({
   credentials,
   setCredentials,
   publicAppAvailable,
+  conflict,
+  precheckLoading,
+  t,
 }: {
   credentials: Record<string, unknown>;
   setCredentials: (c: Record<string, unknown>) => void;
   /** False when server's CAFE24_CLIENT_* env vars are unset → only Private. */
   publicAppAvailable: boolean;
+  /** Cafe24 mall_id 사전 중복 감지 결과 (null 이면 미감지 / 진행 중). */
+  conflict: Cafe24PrecheckResult | null;
+  /** debounce 호출 중 표시용 (배너 자리 안정화). */
+  precheckLoading: boolean;
+  t: TFunction;
 }) {
   const set = (key: string, value: unknown) =>
     setCredentials({ ...credentials, [key]: value });
@@ -709,6 +815,19 @@ function Cafe24ExtraFields({
     ? (["public", "private"] as const)
     : (["private"] as const);
 
+  // 상태별 안내 메시지 분기 — connected 는 가장 강한 차단, pending_install
+  // 은 install 진행 중 안내, expired/error 는 정리 후 재등록 안내.
+  // spec/2-navigation/4-integration.md §9.2 Rationale "precheck endpoint".
+  const conflictDescKey: TranslationKey | null = !conflict?.conflict
+    ? null
+    : conflict.status === "pending_install"
+      ? "integrations.cafe24DuplicateMallPendingDesc"
+      : conflict.status === "expired"
+        ? "integrations.cafe24DuplicateMallExpiredDesc"
+        : conflict.status === "error"
+          ? "integrations.cafe24DuplicateMallErrorDesc"
+          : "integrations.cafe24DuplicateMallConnectedDesc";
+
   return (
     <div className="space-y-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 p-4">
       <div>
@@ -725,11 +844,50 @@ function Cafe24ExtraFields({
           // unescaped hyphen inside a character class. Same semantic as
           // the backend regex /^[a-z0-9-]{3,50}$/.
           pattern="^[a-z0-9\-]{3,50}$"
+          aria-invalid={conflict?.conflict ? true : undefined}
+          aria-describedby={
+            conflict?.conflict ? "cafe24-mall-dup-banner" : undefined
+          }
         />
         <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
           Lower-case letters, digits, and hyphens, 3–50 chars. Forms the
           base URL <code>https://{"{mall_id}"}.cafe24api.com</code>.
         </p>
+        {/* 사전 중복 감지 inline 배너 — precheck endpoint 응답에 따라
+            상태별 안내 + 기존 통합으로 가는 deep link 노출. */}
+        {conflict?.conflict && conflictDescKey && (
+          <div
+            id="cafe24-mall-dup-banner"
+            role="alert"
+            className="mt-2 flex gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200"
+          >
+            <AlertTriangle
+              className="mt-0.5 h-4 w-4 flex-shrink-0"
+              aria-hidden
+            />
+            <div className="space-y-1.5">
+              <div className="font-semibold">
+                {t("integrations.cafe24DuplicateMallTitle")}
+              </div>
+              <div>{t(conflictDescKey)}</div>
+              {conflict.existingIntegrationId && (
+                <Link
+                  href={`/integrations/${conflict.existingIntegrationId}`}
+                  className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
+                >
+                  {t("integrations.cafe24DuplicateMallViewExisting")}
+                  {conflict.existingName ? ` — ${conflict.existingName}` : ""}
+                </Link>
+              )}
+            </div>
+          </div>
+        )}
+        {precheckLoading && !conflict?.conflict && (
+          <p className="mt-1 inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
+            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
+            checking…
+          </p>
+        )}
       </div>
 
       <div>

```

---

### 파일 11: frontend/src/lib/api/integrations.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/api/integrations.ts b/frontend/src/lib/api/integrations.ts
index e7979466..2cf79edd 100644
--- a/frontend/src/lib/api/integrations.ts
+++ b/frontend/src/lib/api/integrations.ts
@@ -277,4 +277,29 @@ export const integrationsApi = {
     });
     return unwrap<IntegrationDto>(data);
   },
+
+  /**
+   * Cafe24 mall_id 사전 중복 감지.
+   *
+   * `/integrations/new` 의 cafe24 step 에서 mall_id 입력 시점에 debounce 로
+   * 호출. 같은 워크스페이스에 같은 mall_id 의 cafe24 통합이 이미 존재하면
+   * inline 경고 배너를 띄워 OAuth 진입 자체를 사전 차단한다.
+   *
+   * 응답에는 자격 증명·토큰·timestamps 가 포함되지 않으며, 가장 제한적인
+   * 상태 (`connected > pending_install > error > expired`) 만 반환된다.
+   * spec/2-navigation/4-integration.md §9.2.
+   */
+  async cafe24Precheck(mallId: string): Promise<Cafe24PrecheckResult> {
+    const { data } = await apiClient.get("/integrations/cafe24/precheck", {
+      params: { mallId },
+    });
+    return unwrap<Cafe24PrecheckResult>(data);
+  },
 };
+
+export interface Cafe24PrecheckResult {
+  conflict: boolean;
+  existingIntegrationId?: string;
+  existingName?: string;
+  status?: "connected" | "pending_install" | "expired" | "error";
+}

```

---

### 파일 12: frontend/src/lib/i18n/dict/en/integrations.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/i18n/dict/en/integrations.ts b/frontend/src/lib/i18n/dict/en/integrations.ts
index 8f09c9bf..fe6e35c1 100644
--- a/frontend/src/lib/i18n/dict/en/integrations.ts
+++ b/frontend/src/lib/i18n/dict/en/integrations.ts
@@ -199,4 +199,17 @@ export const integrations: Dict["integrations"] = {
   oauthFailedShort: "OAuth failed",
   oauthCompletedToast: "OAuth completed. Continue to save.",
   reauthorizeBtn2: "Reauthorize",
+  // ----- Cafe24 mall_id duplicate pre-detection (2026-05-16) -----
+  cafe24DuplicateMallTitle: "This mall ID is already connected",
+  cafe24DuplicateMallConnectedDesc:
+    "A Cafe24 integration for the same mall_id is already active in this workspace. Use the existing integration or delete it first.",
+  cafe24DuplicateMallPendingDesc:
+    "A Cafe24 integration for the same mall_id is already pending installation. Finish the install on the existing integration, or delete it from integration details and re-register.",
+  cafe24DuplicateMallExpiredDesc:
+    "A Cafe24 integration for the same mall_id already exists but is expired. Delete the existing one before registering a new one.",
+  cafe24DuplicateMallErrorDesc:
+    "A Cafe24 integration for the same mall_id already exists in error state. Reauthorize from integration details, or delete it first.",
+  cafe24DuplicateMallViewExisting: "Open existing integration",
+  cafe24DuplicateMallToast:
+    "This mall ID is already connected and cannot be added",
 };

```

---

### 파일 13: frontend/src/lib/i18n/dict/ko/integrations.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/i18n/dict/ko/integrations.ts b/frontend/src/lib/i18n/dict/ko/integrations.ts
index a9f5d945..e85f7d6e 100644
--- a/frontend/src/lib/i18n/dict/ko/integrations.ts
+++ b/frontend/src/lib/i18n/dict/ko/integrations.ts
@@ -197,4 +197,19 @@ export const integrations = {
   oauthFailedShort: "OAuth에 실패했어요",
   oauthCompletedToast: "OAuth가 완료됐어요. 저장을 계속해 주세요.",
   reauthorizeBtn2: "재인증",
+  // ----- Cafe24 mall_id 중복 사전 감지 (2026-05-16) -----
+  // mall_id 입력 시점에 precheck endpoint 호출 → conflict 발견 시 inline
+  // 경고 배너 + Connect 버튼 disable. spec/2-navigation/4-integration.md §9.2.
+  cafe24DuplicateMallTitle: "이 mall ID 는 이미 연결되어 있어요",
+  cafe24DuplicateMallConnectedDesc:
+    "같은 워크스페이스에 같은 mall_id 의 Cafe24 통합이 이미 활성 상태로 연결돼 있어요. 기존 통합을 사용하거나 삭제한 뒤 다시 등록해 주세요.",
+  cafe24DuplicateMallPendingDesc:
+    "같은 mall_id 의 Cafe24 통합이 이미 설치 대기 중이에요. 기존 통합을 사용해 install 을 마치거나, 통합 상세에서 삭제한 뒤 다시 등록해 주세요.",
+  cafe24DuplicateMallExpiredDesc:
+    "같은 mall_id 의 Cafe24 통합이 이미 만료 상태로 존재해요. 새 통합을 등록하려면 먼저 기존 통합을 삭제해 주세요.",
+  cafe24DuplicateMallErrorDesc:
+    "같은 mall_id 의 Cafe24 통합이 이미 오류 상태로 존재해요. 통합 상세에서 재인증을 시도하거나 삭제한 뒤 다시 등록해 주세요.",
+  cafe24DuplicateMallViewExisting: "기존 통합 열기",
+  // 사후 toast 의 한글 primary 메시지. backend 영문 message 는 (괄호) 안에 보조 표시.
+  cafe24DuplicateMallToast: "이 mall ID 는 이미 연결되어 있어 추가할 수 없어요",
 } as const;

```

---

### 파일 14: plan/in-progress/cafe24-mall-dup-ux.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/cafe24-mall-dup-ux.md b/plan/in-progress/cafe24-mall-dup-ux.md
new file mode 100644
index 00000000..21c31eb9
--- /dev/null
+++ b/plan/in-progress/cafe24-mall-dup-ux.md
@@ -0,0 +1,73 @@
+---
+worktree: cafe24-mall-dup-ux-a7f2c8
+started: 2026-05-16
+owner: developer
+---
+
+# Cafe24 동일 mall_id 중복 감지 UX 보강
+
+## 문제
+
+기존:
+- **Private begin** 에만 사전 중복 가드 (`connected` 만 차단) → 영문 backend 메시지를 toast 로만 노출.
+- **Public begin** 에는 사전 가드 없음 → 사용자가 Cafe24 동의까지 다 끝낸 뒤 `POST /api/integrations` 의 V045 UNIQUE 충돌이 500 으로 빠짐 (`throwIfUniqueViolation` 이 `idx_integration_cafe24_workspace_mall` 미처리).
+- **사전 감지 없음**: 사용자가 mall_id 입력 단계에서 이미 연결돼 있는지 알 수 없음 — Connect 클릭 후에야 알림.
+
+## 해결안
+
+### Backend (1) Public begin 가드
+`integration-oauth.service.ts` cafe24 public 분기에 private 와 동일한 사전 체크 추가. `connected` row 존재 시 즉시 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)`. 공통 로직은 private/public 공유 helper `findExistingConnectedCafe24Mall(workspaceId, mallId)` 로 추출.
+
+### Backend (2) `throwIfUniqueViolation` 확장
+`integrations.service.ts` 의 `throwIfUniqueViolation` 에 `idx_integration_cafe24_workspace_mall` 분기 추가 — race / public 흐름의 finalize 단계 V045 UNIQUE 충돌을 동일한 409 코드로 변환.
+
+### Backend (3) Precheck endpoint
+```
+GET /api/integrations/cafe24/precheck?mallId=<mall>
+→ 200 { conflict: bool, existingIntegrationId?, existingName?, status? }
+```
+인증된 사용자의 current workspace 기준. throttle 적용 (debounce 호출이라 limit 60/분 수준).
+
+### Frontend (4) 사전 감지 + 한글 toast
+`integrations/new/page.tsx` cafe24 분기:
+- `mall_id` 입력 후 350ms debounce → `GET /api/integrations/cafe24/precheck` 호출.
+- `conflict=true` 시 inline 경고 배너 (`AlertTriangle` 아이콘) + Connect 버튼 disabled + 기존 통합 상세로 가는 링크.
+- `connected` / `pending_install` / `expired` / `error` 별 안내 메시지 분기.
+- 사후 toast 도 한글 i18n 메시지를 primary 로, `e.response?.data?.message` 는 괄호 안 보조 정보.
+- i18n 키 추가 (`ko/integrations.ts` + `en/integrations.ts` parity 유지).
+
+### Spec (5) — 별도 plan 노트로 위임
+`plan/in-progress/spec-update-cafe24-public-dup-guard.md` 작성 → `project-planner` 호출.
+
+## 검증
+
+- backend unit: `integration-oauth.service.cafe24.spec.ts` 에 public-flow duplicate guard 케이스 추가, `integrations.service.spec.ts` 의 race backstop, `precheck` endpoint controller spec.
+- backend e2e: `backend/test/integrations-cafe24.e2e-spec.ts` (또는 기존 spec 에 케이스 추가) — public + private 둘 다 같은 mall 로 시도 시 사전 거부 + precheck 응답.
+- frontend unit: `new/page.tsx` 의 precheck call · 배너 표시 · Connect 비활성화.
+
+## Consistency check 결과 (2026-05-16 14:28)
+
+`review/consistency/2026/05/16/14_28_20/SUMMARY.md` — **BLOCK: YES** (Critical 3건).
+
+- **Critical 1·2** (Attention 칩 삭제, `appUrl` 필드 삭제 ↔ 프론트 코드 충돌) — **본 작업 범위 밖**. spec 의 기존 불일치로 별도 worktree (`integration-attention-filter-053b74` 등) 가 처리 중일 가능성. 본 worktree 는 §9.2 (OAuth begin) + §9.4 (errors) + Rationale 신설만 다루므로 영향 없음.
+- **Critical 3** (`cafe24-hmac-raw-fix-b8e2d1` 가 같은 Rationale 말미 수정 중) — 본 worktree 는 spec 본문을 직접 수정하지 않고 project-planner 에 위임하므로 위임 단계에서 rebase 처리. 코드 구현 자체에는 영향 없음.
+
+### Warning 반영 결정
+
+- **Warning 7** (NestJS route order) — 반영. `@Get('cafe24/precheck')` 를 `@Get(':id')` 위에 선언.
+- **Warning 8** (`CAFE24_PRIVATE_APP_ALREADY_CONNECTED` → `CAFE24_MALL_ALREADY_CONNECTED` rename) — **기각**. 사용자 지시: "에러 코드는 기존 그대로 재사용해 호환성 유지. 메시지 문구만 일반화". spec line 725 가 이미 "app_type 무관" 으로 정의해 의미상 모순 없음.
+- **Warning 9 / INFO 9** (helper 이름) — 반영. `findConnectedCafe24MallIntegration` 사용 (precheck 의 전체 status 조회는 별도 `findAnyCafe24MallIntegration` 으로 분리).
+- **Warning 6** (plan 체크박스) — 본 commit 에서 갱신.
+- 나머지 Warning (배너 조건, errors 표기 컨벤션, §11 expire 표현) — `spec-update-cafe24-public-dup-guard.md` 에 위임 추가 항목으로 기록.
+
+## 진행 상태
+
+- [x] 스펙 / 코드 흐름 파악
+- [x] plan 노트 작성
+- [x] consistency-check --impl-prep
+- [ ] Backend (1) Public begin guard
+- [ ] Backend (2) throwIfUniqueViolation 확장
+- [ ] Backend (3) Precheck endpoint
+- [ ] Frontend (4) Inline pre-detection + Korean toast
+- [ ] TEST + REVIEW WORKFLOW
+- [ ] Spec 위임 (project-planner)

```

---

### 파일 15: plan/in-progress/spec-update-cafe24-public-dup-guard.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/spec-update-cafe24-public-dup-guard.md b/plan/in-progress/spec-update-cafe24-public-dup-guard.md
new file mode 100644
index 00000000..77a457a6
--- /dev/null
+++ b/plan/in-progress/spec-update-cafe24-public-dup-guard.md
@@ -0,0 +1,42 @@
+---
+worktree: cafe24-mall-dup-ux-a7f2c8
+started: 2026-05-16
+owner: developer → project-planner 위임 예정
+---
+
+# Spec 갱신 제안 — Cafe24 Public 흐름 중복 가드 + Precheck endpoint
+
+## 배경
+
+`spec/2-navigation/4-integration.md` §9.2 / §9.4 errors 목록 / Rationale 모두 "Cafe24 **Private** 흐름 진입 시" 만 명시. 실제로는 Public 흐름도 동일한 V045 partial UNIQUE constraint 의 대상이며, 같은 mall_id 의 중복 추가는 app_type 무관으로 금지된다. 사용자가 Cafe24 동의까지 마친 뒤 finalize 단계에서 500 으로 빠지는 UX 결함을 해소하기 위해 begin 단계 사전 가드를 public 에도 추가.
+
+## 변경 요청
+
+### §9.2 OAuth begin 표 한 줄
+> 옛: **※ Cafe24 Private 흐름 진입 시** 동일 `(workspaceId, mall_id)` 의 ...
+>
+> 신: **※ Cafe24 흐름 (app_type 무관) 진입 시** 동일 `(workspaceId, mall_id)` 의 cafe24 Integration 중 `status='connected'` 인 row 가 존재하면 begin 자체가 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)` 으로 즉시 거부된다. 다른 status (`pending_install` / `expired` / `error`) 는 V045 partial UNIQUE 가 finalize 단계에서 동일 409 로 변환한다 (race backstop).
+
+### §9.2 신규 행 추가
+> | GET | `/api/integrations/cafe24/precheck` | 사용자가 mall_id 입력 단계에서 호출하는 사전 중복 감지. 쿼리: `mallId` (`^[a-z0-9-]{3,50}$`). 응답: `{ conflict: bool, existingIntegrationId?: string, existingName?: string, status?: 'connected'\|'pending_install'\|'expired'\|'error' }`. 인증된 사용자의 current workspace 기준. throttle (분당 60회). |
+
+### §9.4 errors 보강
+- `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)` 의 설명에 "**app_type='public' 흐름의 finalize (POST /api/integrations) 단계에서도** 동일 V045 UNIQUE 위반이 본 코드로 변환된다 (race backstop)" 추가.
+
+### Rationale 보강
+신설 항목: "**Cafe24 Public 흐름의 begin-time 사전 가드 추가 (2026-05-16)**"
+> Public 흐름은 begin 단계에서 Integration row 를 만들지 않으므로 V045 partial UNIQUE 가 발사되는 시점이 finalize (`POST /api/integrations`) 단계로 미뤄진다. 사용자가 Cafe24 동의 페이지까지 마친 뒤에야 충돌이 드러나는 UX 결함을 막기 위해 begin 단계에서 `status='connected'` row 를 사전 SELECT 로 검출해 409 로 즉시 거부한다. 다른 status (pending_install/expired/error) 는 정상 진행 → V045 backstop. 이로써 private 흐름의 기존 동작과 정합.
+
+신설 항목: "**precheck endpoint — mall_id 입력 단계 사전 감지 UX**"
+> 사용자가 mall_id 를 다 입력하기 전(타이핑 중)에 conflict 를 감지해 inline 경고로 보여주기 위한 read-only endpoint. begin 의 pre-check 로직과 동일한 SELECT 를 노출하되, 모든 status 정보 (connected/pending_install/expired/error) 를 함께 반환해 프론트가 케이스별 안내 메시지를 분기. 401/403 같은 인증 정보 누설을 방지하기 위해 응답에 `existingName` 만 포함 (자격 증명·토큰·timestamps 비노출). throttle (분당 60회) 로 brute-force enumeration 차단 — 정상 사용자는 350ms debounce 1~2회/입력.
+
+## 영향 범위 점검
+
+- `spec/2-navigation/4-integration.md` — §9.2 (begin 한 줄, precheck 행), §9.4 (error 설명 보강), Rationale 2개 항목 신설
+- `spec/data-flow/5-integration.md` — `integration` 테이블 V045/V046 설명에 변경 없음 (constraint 자체 유지)
+- `spec/1-data-model.md` §3 — 변경 없음
+- `spec/conventions/swagger.md` §2-4 — `INTEGRATION_IN_USE(409)` 와 동일 정책
+
+## 위임
+
+본 변경은 spec 본문 수정이라 developer 권한 밖. project-planner 가 위 변경을 spec 에 반영해야 한다.

```

---

### 파일 16: review/consistency/2026/05/16/14_28_20/SUMMARY.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/14_28_20/SUMMARY.md b/review/consistency/2026/05/16/14_28_20/SUMMARY.md
new file mode 100644
index 00000000..5b0ac35a
--- /dev/null
+++ b/review/consistency/2026/05/16/14_28_20/SUMMARY.md
@@ -0,0 +1,94 @@
+# Consistency Check 통합 보고서
+
+**BLOCK: YES** — Critical 발견이 있어 호출자가 구현 착수를 차단해야 합니다.
+
+검토 모드: `--impl-prep` (구현 착수 전)
+Target: `spec/2-navigation/4-integration.md`
+Worktree: `cafe24-mall-dup-ux-a7f2c8`
+세션: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-mall-dup-ux-a7f2c8/review/consistency/2026/05/16/14_28_20/`
+재시도 필요: 0건
+
+---
+
+## 전체 위험도
+
+**HIGH** — CRITICAL 3건(spec-코드 직접 충돌 2건 + worktree Rationale 병합 충돌 1건). 코드베이스와 정면으로 모순되는 spec 삭제가 있어 방향 결정 없이 구현 착수 불가.
+
+---
+
+## Critical 위배 (BLOCK 사유)
+
+| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
+|---|---------|------|-------------|-----------|------|
+| 1 | Cross-Spec | `Attention` 가상 필터값·`?status=attention` 쿼리값 삭제 — 프론트엔드 코드와 직접 충돌 | `spec/2-navigation/4-integration.md` §2.3 상태 칩, §2.4 배너 동작, §9.1 status 파라미터, Rationale | `frontend/.../integrations/page.tsx` (`attentionCount`, `needsAttention` 사용), `frontend/.../status-badge.tsx` (`export function needsAttention`), 사용자 가이드 MDX 2종 | (A) Attention 칩·`?status=attention`·삭제된 Rationale 를 spec 에 복원 — 또는 — (B) 프론트엔드 코드·MDX 사용자 가이드를 spec 변경에 맞춰 동시 갱신 후 착수 |
+| 2 | Cross-Spec | `GET /api/integrations/:id` 응답에서 `appUrl` 필드 제거 — 프론트엔드 테스트·관련 spec 과 직접 충돌 | `spec/2-navigation/4-integration.md` §9.1 `GET /api/integrations/:id` | `frontend/.../integrations/[id]/__tests__/scope-tab.test.tsx` (mock `appUrl` 3개소), `spec/1-data-model.md` §2.10, `spec/4-nodes/4-integration/4-cafe24.md` §9 | (A) `appUrl` 필드와 Overview 탭 App URL 카드를 spec 에 복원 — 또는 — (B) 프론트엔드 테스트와 Cafe24 노드 spec 에러 복구 안내도 함께 갱신. Cafe24 Private 운영 흐름에서 App URL 접근 필요 여부 재검토 필수 |
+| 3 | Plan Coherence | `cafe24-hmac-raw-fix-b8e2d1` worktree(PR 대기 중, commit `30be2f94`)가 동일 파일 Rationale 말미를 이미 수정 — 병합 충돌 확정 | `spec/2-navigation/4-integration.md` `## Rationale` 섹션 말미 (신규 항목 2개 추가 예정) | `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` (worktree `cafe24-hmac-raw-fix-b8e2d1`, branch `claude/cafe24-hmac-raw-fix-b8e2d1`, 미병합) | `cafe24-hmac-raw-fix-b8e2d1` PR 을 main 에 먼저 병합한 뒤 현재 worktree 를 `git rebase main`으로 갱신하고 Rationale 추가 진행. 병렬 merge 가 불가피하면 `merge-coordinator` 경유 |
+
+---
+
+## 경고 (WARNING)
+
+| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
+|---|---------|------|-------------|-----------|------|
+| 1 | Cross-Spec | 배너 `expiring` 포함 조건 단순화 — `expired` 상태 행이 이중 카운트될 수 있음 | §2.4 배너 조건 `token_expires_at <= now() + 7d` 및 §11.4 UI 배지 조건 | `spec/5-system/4-execution-engine.md` (상태 전이 `connected → expired` 정의) | 배너 조건에 `status NOT IN (expired, error, pending_install)` 가드 추가. §11.4 동시 갱신 |
+| 2 | Cross-Spec | `expiring` 가상 필터값 변환 규칙 삭제 — `Expiring` 칩은 남아 있으나 백엔드 WHERE 절 변환 규칙 없음 | §9.1 `GET /api/integrations` status 파라미터 | §2.3 상태 칩 `Expiring (7일 이내)` | §9.1 에 `status='connected' AND token_expires_at within 7d` 변환 규칙 복원 또는 §2.3 칩 목록에 가상값임을 명시 |
+| 3 | Convention Compliance | API error code `UPPER_SNAKE_CASE` 와 DB `status_reason` `snake_case` 이중 표기 — 의도적이나 구현자 혼동 여지 | §9.4 에러 코드 표, §6 상태 전이 표 | `spec/conventions/swagger.md` | §9.4 상단에 "API error code는 `UPPER_SNAKE_CASE`, DB `status_reason` 값은 `snake_case` — 의도적 구분 (Rationale 참조)" 주석 추가 |
+| 4 | Plan Coherence | `spec-update-cafe24-app-url-reuse.md` 미완 §9 갱신이 target 의 §9.2 수정 범위와 겹침 | §9.2 (begin 표 수정) | `plan/in-progress/spec-update-cafe24-app-url-reuse.md` 미체크 `[ ] spec 갱신` | 해당 plan 에 "§9 갱신 시 `cafe24-mall-dup-ux-a7f2c8` PR 병합 결과 기반으로 시작" 메모 추가 |
+| 5 | Plan Coherence | `spec-update-cafe24-background-refresh.md` 미완 §11 갱신이 같은 파일 대기 중 | §11 (스캐너 잡 목록 + 신규 소절) | `plan/in-progress/spec-update-cafe24-background-refresh.md` 미체크 항목 | `spec-update-cafe24-background-refresh.md` 에 "§9/Rationale 변경은 `cafe24-mall-dup-ux-a7f2c8` PR 병합 이후 기준으로 작업 시작" 메모 추가 |
+| 6 | Plan Coherence | `cafe24-mall-dup-ux.md` 의 `[ ] consistency-check --impl-prep` 체크박스 미갱신 | `plan/in-progress/cafe24-mall-dup-ux.md` 진행 상태 섹션 | 개발자 skill 규약 — 구현 착수 직전 `--impl-prep` 호출 의무 | 본 consistency-check 완료 후 해당 체크박스를 `[x]`로 갱신 |
+| 7 | Naming Collision | `GET /api/integrations/cafe24/precheck` — 기존 `@Get(':id')` / `@Get(':id/usages')` / `@Get(':id/activity')` 와 NestJS 라우트 우선순위 충돌 위험 | `spec-update-cafe24-public-dup-guard.md` §9.2 신규 행 | `backend/.../integrations.controller.ts:209` `@Get(':id')` (`ParseUUIDPipe`) | `@Get('cafe24/precheck')` 핸들러를 동적 경로 핸들러보다 앞에 선언(현재 `@Get('services')` 바로 아래). `ParseUUIDPipe` 미적용 |
+| 8 | Naming Collision | `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 를 Public 흐름에 재사용 — `PRIVATE` 이름이 의미를 오도 | `cafe24-mall-dup-ux.md` §Backend (1), `spec-update-cafe24-public-dup-guard.md` §9.2 | `backend/.../integration-oauth.service.ts:1068` (Private 전용), `backend/.../integrations.controller.ts:170` (Swagger "private" 맥락) | `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` → `CAFE24_MALL_ALREADY_CONNECTED` 로 rename. backend, spec, Swagger doc, 프론트엔드 메시지 키 일괄 변경 |
+| 9 | Rationale Continuity | §11 본문 "expire 처리" 표현이 폐기된 `expired(refresh_failed)` 흐름을 연상시킴 | §11 서두 2번째 문단 | Rationale "refresh 실패 시 status_reason 통일 (2026-05-16)" | 해당 문구를 "갱신 실패한 토큰 셋은 `error(auth_failed)` 로 전이되어 사용자에게 reauthorize 권장"으로 정정 |
+
+---
+
+## 참고 (INFO)
+
+| # | Checker | 항목 | 위치 | 제안 |
+|---|---------|------|------|------|
+| 1 | Cross-Spec | `spec/data-flow/5-integration.md` — 삭제된 `GET /api/integrations/:id` `appUrl` 흐름 기술 여부 점검 | `spec/data-flow/5-integration.md` line 78-79 | `POST /api/integrations/oauth/begin` → `appUrl` 흐름은 유지. `GET` 경로 관련 기술 부분만 존재 시 갱신 |
+| 2 | Cross-Spec | `spec/4-nodes/4-integration/4-cafe24.md` 에러 복구 안내가 삭제된 App URL 카드를 가리킴 | `spec/4-nodes/4-integration/4-cafe24.md` Rationale "Cafe24 install_token mismatch 회복 흐름" | App URL 카드 삭제 확정 시 대체 접근 경로로 안내 문구 갱신 |
+| 3 | Rationale Continuity | Rationale "OAuthState.mode='reauthorize'" 의 "향후 분리 검토" 언급이 이미 처리된 `request_scopes` 분리와 불일치 | Rationale (2026-05-14 항) | 해당 항에 "(2026-05-15 후속) `request_scopes` mode 분리는 'Cafe24 Private request-scopes 흐름' 항 참조 — 분리 방향으로 처리됨" 한 줄 추가 |
+| 4 | Convention Compliance | `## Rationale` 하위 소섹션 앵커 참조 혼용 (`#rationale` vs 실제 소섹션 앵커) | 문서 전체 인라인 참조 | 참조 앵커를 실제 소섹션 헤딩과 일치시켜 마크다운 렌더러 깨짐 방지 |
+| 5 | Convention Compliance | `## Overview` 섹션 없이 `## 1. 라우트 구성`으로 시작 (`_product-overview.md` 가 Overview 역할 수행 중) | 문서 최상단 | `## 1. 라우트 구성` 상단에 1~3문장 목적 설명 추가 가능. 규약 갱신 불필요 |
+| 6 | Convention Compliance | §9.3 activity 응답 예시에 `data:` 래퍼 명시 누락 | §9.3 응답 예시 | `{ data: { items[], summary: { ... } } }` 형태로 명시하거나 §9.4 에 "이하 모든 응답이 `data:` 래퍼를 가짐" 문구 추가 |
+| 7 | Convention Compliance | orchestrator 가 target 파일 내용을 `(없음)`으로 수집 — checker 들이 직접 파일을 Read 해 보완, 이번 검토 신뢰도 영향 없음 | orchestrator 파일 수집 단계 | orchestrator 의 파일 수집 로직에서 `(없음)` 반환 시 에러를 올리도록 보완. checker 의 직접 Read fallback 정책 명문화 권장 |
+| 8 | Plan Coherence | `cafe24-mall-dup-ux.md` 의 `[ ] Spec 위임 (project-planner)` 항목이 미체크인 채로 위임 plan 문서만 작성된 상태 | `plan/in-progress/cafe24-mall-dup-ux.md` | spec 위임 plan 작성 완료를 `[x]`로 표기하고, project-planner 처리 완료 시점에 양쪽 plan 동시 갱신 |
+| 9 | Naming Collision | `findExistingConnectedCafe24Mall` helper 이름이 `connected` 상태만 조회한다는 범위를 내포하나 precheck 는 모든 status 대상 | `cafe24-mall-dup-ux.md` §Backend (1) | `findConnectedCafe24MallIntegration`으로 범위 명확화. precheck 용 전체 status 조회는 별도 로직 또는 `findAnyCafe24MallIntegration`으로 분리 |
+
+---
+
+## Checker별 위험도
+
+| Checker | 위험도 | 핵심 발견 |
+|---------|--------|-----------|
+| Cross-Spec | HIGH | `Attention` 칩·`appUrl` 필드 삭제가 프론트엔드 코드·테스트와 직접 충돌 (CRITICAL 2건). `expiring` 필터 변환 규칙 누락, 배너 조건 이중 카운트 위험 (WARNING 2건) |
+| Plan Coherence | HIGH | `cafe24-hmac-raw-fix-b8e2d1` worktree 가 Rationale 말미를 이미 commit 해 병합 충돌 확정 (CRITICAL 1건). 소멸 worktree 의 §9·§11 미완 갱신 순서 관리 필요 (WARNING 2건) |
+| Naming Collision | MEDIUM | `GET /api/integrations/cafe24/precheck` NestJS 라우트 선언 순서 충돌 위험, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` Public 재사용 시 이름 오도 (WARNING 2건) |
+| Rationale Continuity | LOW | §11 "expire 처리" 표현이 폐기된 `expired(refresh_failed)` 흐름을 연상시킴 (WARNING 1건) |
+| Convention Compliance | LOW | 문서 자체 규약 준수 양호. orchestrator 파일 수집 오류(인프라 버그)를 checker 직접 Read 로 보완함. 이번 검토 신뢰도 영향 없음 |
+
+---
+
+## 권장 조치사항
+
+1. **[BLOCK 해소 — 우선]** `Attention` 칩·`?status=attention` 가상 필터값·삭제된 Rationale 복원(A) 또는 `frontend/.../integrations/page.tsx`, `status-badge.tsx`, 사용자 가이드 MDX 2종 동시 갱신(B) 중 하나를 선택하고 해소한다.
+2. **[BLOCK 해소 — 우선]** `appUrl` 필드·Overview 탭 App URL 카드 복원(A) 또는 `scope-tab.test.tsx` mock 제거·`spec/4-nodes/4-integration/4-cafe24.md` 에러 복구 안내 갱신(B) 중 하나를 선택한다. Cafe24 Private 운영 흐름에서 App URL 접근성 필요 여부를 product owner 와 재검토 권장.
+3. **[BLOCK 해소 — 우선]** `cafe24-hmac-raw-fix-b8e2d1` PR 을 먼저 main 에 병합한 뒤 현재 worktree 를 `git rebase main`으로 갱신하고 Rationale 추가를 진행한다.
+4. **[WARNING — 구현 착수 전]** §9.1 에 `expiring` 가상 필터값 변환 규칙(`status='connected' AND token_expires_at within 7d`)을 복원하고, §2.4 배너 조건과 §11.4 UI 배지 조건에 `status NOT IN (expired, error, pending_install)` 가드를 추가한다.
+5. **[WARNING — 구현 착수 전]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` → `CAFE24_MALL_ALREADY_CONNECTED` rename 결정. backend, spec, Swagger doc, 프론트엔드 메시지 키 일괄 변경.
+6. **[WARNING — 구현 시 필수]** `@Get('cafe24/precheck')` 핸들러를 `@Get(':id')`, `@Get(':id/usages')`, `@Get(':id/activity')` 보다 앞에 선언한다.
+7. **[WARNING — 규약]** 본 consistency-check 완료 후 `plan/in-progress/cafe24-mall-dup-ux.md` 의 `[ ] consistency-check --impl-prep` 체크박스를 `[x]`로 갱신한다.
+8. **[WARNING — 문서 정합]** `spec/2-navigation/4-integration.md` §11 서두 "expire 처리" 문구를 `error(auth_failed)` 전이로 정정한다.
+9. **[INFO — 권장]** orchestrator 파일 수집 로직 보완(`(없음)` 반환 시 에러 처리).
+10. **[INFO — 권장]** `spec/data-flow/5-integration.md` 에서 `GET /api/integrations/:id` → `appUrl` 흐름 기술 여부 확인 및 필요 시 갱신.
+
+---
+
+## 본 worktree 에서의 처리 결정 (developer 판단)
+
+- **Critical 1·2 (Attention 칩, appUrl 필드)**: 본 작업 범위(§9.2 begin + §9.4 errors + Rationale 신설) 밖. spec 의 기존 불일치로 별도 worktree 가 처리해야 함. 본 PR 에 끌어들이지 않음.
+- **Critical 3 (Rationale 말미 충돌)**: 본 worktree 는 spec 본문을 직접 수정하지 않고 project-planner 위임 plan note 만 작성. 위임 단계에서 `cafe24-hmac-raw-fix-b8e2d1` 의 PR merge 결과를 기준으로 rebase 처리. 코드(backend/frontend) 구현 자체에는 영향 없음.
+- **Warning 8 (error code rename)**: 사용자 지시 ("호환성 유지, 메시지 문구만 일반화") 에 따라 기각.
+- **Warning 6·7·9 / INFO 9**: 본 PR 에서 반영.
+- 기타 Warning (배너 조건, errors 표기 컨벤션, §11 expire 표현, §9.1 expiring 변환 규칙): `spec-update-cafe24-public-dup-guard.md` 의 위임 항목에 추가.

```

---

### 파일 17: review/consistency/2026/05/16/14_28_20/_prompts/convention_compliance.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/14_28_20/_prompts/convention_compliance.md b/review/consistency/2026/05/16/14_28_20/_prompts/convention_compliance.md
new file mode 100644
index 00000000..a065af03
--- /dev/null
+++ b/review/consistency/2026/05/16/14_28_20/_prompts/convention_compliance.md
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
+| `commenttemplates_get` | 자주 쓰는 답변 단건 | Retrieve a frequently used answer | ? | ? | ? |  | pl

... (truncated due to prompt size limit) ...

---

### 파일 18: review/consistency/2026/05/16/14_28_20/_prompts/cross_spec.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 19: review/consistency/2026/05/16/14_28_20/_prompts/naming_collision.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 20: review/consistency/2026/05/16/14_28_20/_prompts/plan_coherence.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 21: review/consistency/2026/05/16/14_28_20/_prompts/rationale_continuity.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 22: review/consistency/2026/05/16/14_28_20/_retry_state.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/14_28_20/_retry_state.json b/review/consistency/2026/05/16/14_28_20/_retry_state.json
new file mode 100644
index 00000000..1578f3ae
--- /dev/null
+++ b/review/consistency/2026/05/16/14_28_20/_retry_state.json
@@ -0,0 +1,52 @@
+{
+  "session_dir": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-mall-dup-ux-a7f2c8/review/consistency/2026/05/16/14_28_20",
+  "summary_subagent_type": "consistency-summary",
+  "summary_output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-mall-dup-ux-a7f2c8/review/consistency/2026/05/16/14_28_20/SUMMARY.md",
+  "subagent_invocations": [
+    {
+      "name": "cross_spec",
+      "subagent_type": "cross-spec-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-mall-dup-ux-a7f2c8/review/consistency/2026/05/16/14_28_20/_prompts/cross_spec.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-mall-dup-ux-a7f2c8/review/consistency/2026/05/16/14_28_20/cross_spec/review.md"
+    },
+    {
+      "name": "rationale_continuity",
+      "subagent_type": "rationale-continuity-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-mall-dup-ux-a7f2c8/review/consistency/2026/05/16/14_28_20/_prompts/rationale_continuity.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-mall-dup-ux-a7f2c8/review/consistency/2026/05/16/14_28_20/rationale_continuity/review.md"
+    },
+    {
+      "name": "convention_compliance",
+      "subagent_type": "convention-compliance-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-mall-dup-ux-a7f2c8/review/consistency/2026/05/16/14_28_20/_prompts/convention_compliance.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-mall-dup-ux-a7f2c8/review/consistency/2026/05/16/14_28_20/convention_compliance/review.md"
+    },
+    {
+      "name": "plan_coherence",
+      "subagent_type": "plan-coherence-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-mall-dup-ux-a7f2c8/review/consistency/2026/05/16/14_28_20/_prompts/plan_coherence.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-mall-dup-ux-a7f2c8/review/consistency/2026/05/16/14_28_20/plan_coherence/review.md"
+    },
+    {
+      "name": "naming_collision",
+      "subagent_type": "naming-collision-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-mall-dup-ux-a7f2c8/review/consistency/2026/05/16/14_28_20/_prompts/naming_collision.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-mall-dup-ux-a7f2c8/review/consistency/2026/05/16/14_28_20/naming_collision/review.md"
+    }
+  ],
+  "agents_pending": [],
+  "agents_success": [
+    "cross_spec",
+    "rationale_continuity",
+    "convention_compliance",
+    "plan_coherence",
+    "naming_collision"
+  ],
+  "agents_fatal": [],
+  "agent_history": {},
+  "rate_limit_episodes": 0,
+  "total_wait_sec": 0,
+  "wake_history": [],
+  "last_reset_hint_sec": null,
+  "loop_mode": false
+}
\ No newline at end of file

```

---

### 파일 23: review/consistency/2026/05/16/14_28_20/convention_compliance/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/14_28_20/convention_compliance/review.md b/review/consistency/2026/05/16/14_28_20/convention_compliance/review.md
new file mode 100644
index 00000000..6eff7510
--- /dev/null
+++ b/review/consistency/2026/05/16/14_28_20/convention_compliance/review.md
@@ -0,0 +1,80 @@
+# Convention Compliance Review — `spec/2-navigation/4-integration.md`
+
+검토 모드: --impl-prep (구현 착수 전 검토)
+검토 대상: `spec/2-navigation/4-integration.md`
+
+---
+
+## 발견사항
+
+### 문서 구조 규약
+
+- **[INFO]** `## Rationale` 섹션이 문서 말미에 존재하나, 항목별 앵커(`#rationale`)를 본문에서 직접 참조하는 패턴이 다수 있음
+  - target 위치: §6 상태 전이, §9.4 에러 코드, §10.5 토큰 자동 갱신 등에서 `[Rationale "xxx"](#rationale)` 형태로 참조
+  - 위반 규약: CLAUDE.md 명명 컨벤션 — `spec/<영역>/N-name.md` 은 본문 끝에 `## Rationale` 섹션을 권장함. 규약 자체에는 Rationale 하위 항목의 앵커 명명에 대한 추가 제약이 없음
+  - 상세: `## Rationale` 하위 소섹션(예: `### refresh 실패 시 status_reason 통일 (2026-05-16)`)들은 실제 앵커가 `#refresh-실패-시-status_reason-통일-2026-05-16` 형태이나, 본문 인라인 참조는 `(#rationale)`이나 `(#refresh-실패-시-status_reason-통일-2026-05-16)` 혼용. 앵커가 정확히 다르면 마크다운 렌더러에서 참조가 깨질 수 있음
+  - 제안: 참조 앵커를 실제 소섹션 헤딩과 일치시키거나, 본 spec 문서 자체는 이미 규약을 준수 중이며 INFO 수준의 내부 일관성 문제로 채택 여부를 검토하면 됨. 규약 갱신은 불필요.
+
+- **[INFO]** 문서가 `## Overview` 섹션 없이 `# Spec: 통합 관리 화면` 제목 이후 바로 `## 1. 라우트 구성`으로 시작
+  - target 위치: 문서 최상단 (1~7행)
+  - 위반 규약: CLAUDE.md §프로젝트 스펙 문서 — 각 spec 문서는 권장 3섹션 구성(Overview / 본문 / Rationale)을 따른다. "단일 spec 파일 영역은 본문 상단에 직접 `## Overview` 섹션을 둔다"
+  - 상세: 현재 `4-integration.md`는 Overview 섹션 없이 곧바로 본문(라우트 구성 등)으로 시작한다. 제품 정의·사용자 가치·요구사항 목표를 기술하는 Overview가 누락되어 있다. 다만 문서 상단 링크에 `[PRD 내비게이션](./_product-overview.md#34-integration-통합)` 이 제시되어 PRD 역할을 별도 문서에 위임한 구조임. 이 경우도 `_product-overview.md`가 Overview 역할을 대신하므로, 본 문서 안에서는 Overview 절이 필요 없을 수 있으나, `spec/<영역>/N-name.md`(단순 숫자 prefix 파일)이고 `_product-overview.md`가 별도 존재하는 영역이면 각 N 문서에서 Overview 생략도 관행으로 수용 가능. INFO 수준.
+  - 제안: `## 1. 라우트 구성` 상단에 1~3문장의 간략한 목적 설명을 `## Overview` 로 추가하거나, 별도 Overview가 `_product-overview.md`에 있음을 명시하는 인트로 문단으로 대체 가능. 규약 갱신은 불필요.
+
+---
+
+### 명명 규약
+
+- **[INFO]** API 경로 표기에서 `/:id`와 `/:provider` 등 path parameter에 일관성 있는 표기가 사용됨. spec/conventions/swagger.md §2-3 의 `@ApiParam` 패턴과 부합하며, 구현 시 UUID 파라미터에 `@ApiParam({ format: 'uuid' })` 필요 체크리스트(swagger.md §5-4) 적용 대상이 됨
+  - target 위치: §9 전체 API 표
+  - 위반 규약: spec/conventions/swagger.md §5-4 — "경로 UUID 파라미터는 `@ApiParam({ format: 'uuid' })` 일관 적용"
+  - 상세: spec 문서 자체에서는 경로 표기가 문제 없으나, 구현 시 `/api/integrations/:id` 류의 UUID path param에 `@ApiParam({ format: 'uuid' })`를 빠뜨리지 않도록 주의 필요. 이는 spec 문서 위반이 아니라 구현 시 체크포인트.
+  - 제안: spec 문서에 "구현 시 UUID 파라미터에 `@ApiParam({ format: 'uuid' })` 적용 필요" 주석 추가를 고려. INFO 수준이므로 필수 아님.
+
+---
+
+### 출력 포맷 규약
+
+- **[INFO]** §9.4 공통 응답 포맷에서 성공 응답 표기가 `{ data: ... }` 또는 `{ data: ..., pagination: ... }` 형태로 정의됨
+  - target 위치: §9.4 (702~714행)
+  - 위반 규약: spec/conventions/swagger.md §2-5 — `TransformInterceptor`로 모든 성공 응답을 `{ data: ... }`로 감쌈; §5 — 응답 DTO 클래스 + 공용 래퍼 헬퍼 사용
+  - 상세: spec 문서 자체의 API 응답 포맷 기술은 규약과 정합. 다만 §9.3의 activity 응답 `{ items[], summary: { totalCalls, successRate, dailyCounts[] } }` 표기가 최상위에 `data:` 래퍼 없이 기술되어 있어, 구현 시 `{ data: { items, summary } }` 형태로 래핑되어야 한다는 점이 spec에서 명시되지 않음.
+  - 제안: §9.3의 activity 응답 예시를 `{ data: { items[], summary: { ... } } }` 형태로 명시하거나, §9.4 포맷 절에서 "이하 모든 응답이 `data:` 래퍼를 가짐" 문구를 추가. 규약 갱신은 불필요.
+
+---
+
+### API 문서 규약
+
+- **[WARNING]** §9.4 에러 코드 중 일부가 `UPPER_SNAKE_CASE`로 기술되나, `error(auth_failed)` 등 status 값은 `snake_case` mixed 형태로 병기
+  - target 위치: §9.4 (703~714행), §6 상태 전이 표
+  - 위반 규약: spec/conventions/swagger.md §2-4 — HTTP 에러 응답 코드는 Swagger 규약상 표준 형식 사용; CLAUDE.md 의 단일 진실 원칙 — 동일 개념의 표기가 두 가지 형태로 혼용
+  - 상세: API 응답의 `code` 필드는 `INTEGRATION_IN_USE`, `OAUTH_STATE_MISMATCH`, `CAFE24_INSTALL_REPLAY` 등 `UPPER_SNAKE_CASE`. `Integration.status` 의 값은 `pending_install`, `connected`, `error(auth_failed)` 등 `snake_case`. 이 구분 자체는 §Rationale에서 의도적으로 설명됨("DB 컬럼 컨벤션 전체가 snake_case, API 응답·callback HTML 의 에러 코드는 UPPER_SNAKE_CASE"). 의도적 이중 표기로 Rationale에 근거가 있으므로 CRITICAL이 아닌 WARNING 수준.
+  - 제안: 구현 담당자가 혼동하지 않도록 §9.4 상단에 "API error code는 `UPPER_SNAKE_CASE`, DB `status_reason` 값은 `snake_case` — 의도적 구분 (Rationale 참조)" 한 줄 주석 추가 권장. 규약 자체의 갱신은 불필요.
+
+---
+
+### 금지 항목
+
+- **[CRITICAL]** 대상 파일 경로 `spec/2-navigation/4-integration.md` 자체는 적법한 경로이나, **검토 모드의 target 문서가 실제로 존재하지 않는다**는 것이 orchestrator prompt에 명시됨
+  - target 위치: prompt_file §Target 문서 섹션 — "경로: `spec/2-navigation/4-integration.md` (없음)"
+  - 위반 규약: CLAUDE.md §개발 방법론 — "모든 개발은 반드시 SDD(Spec-Driven Development)로 접근"; 작업 이전: 관련 `spec/` 문서를 먼저 읽는다
+  - 상세: orchestrator의 prompt에는 `spec/2-navigation/4-integration.md` 내용이 "(없음)"으로 표기되어 있으나, 실제 파일시스템에는 동 경로에 파일이 존재함(본 checker가 직접 Read하여 확인). orchestrator가 파일을 수집하지 못한 것으로 추정됨. 즉, **prompt 수집 단계의 오류**이며 파일 자체는 존재. 하지만 prompt의 "없음" 표기에 따라 impl-prep 검토를 진행했다면 실제 spec 내용 없이 검토가 수행될 뻔한 상황이었음. checker가 직접 파일을 읽어 이를 보완함.
+  - 제안: orchestrator의 파일 수집 로직에서 `spec/2-navigation/4-integration.md`가 누락된 원인을 조사할 것. 본 checker는 직접 파일을 읽어 실질적인 검토를 수행했으므로 결과 자체의 신뢰도는 유지됨. 단, 향후 orchestrator 동작을 신뢰할 수 없는 경우 checker가 직접 파일을 읽는 fallback 정책을 명문화하는 것을 권장.
+
+  > **비고**: 위 CRITICAL은 target 문서의 규약 위반이 아니라 검토 인프라(orchestrator)의 파일 수집 오류를 나타냄. `spec/2-navigation/4-integration.md` 문서 자체는 아래 요약과 같이 규약 준수 수준이 양호함.
+
+- **[INFO]** 옛 경로 패턴(`prd/`, `memory/`) 사용 없음 — 문서 내 모든 상호참조가 `spec/`, `plan/` 경로를 사용하거나 `review/consistency/...` 형태를 사용함
+  - target 위치: 문서 전체 링크/참조
+  - 위반 규약: CLAUDE.md — "옛 `prd/`, `memory/`, `user_memo/` 폴더 신규 생성 금지"
+  - 상세: 위반 없음.
+  - 제안: 해당 없음.
+
+---
+
+## 요약
+
+`spec/2-navigation/4-integration.md`는 정식 규약 준수 수준이 전반적으로 양호하다. 파일명은 `N-name.md` 패턴을 준수하고, `## Rationale` 섹션이 문서 말미에 배치되어 있다. API 경로 표기와 에러 코드 체계도 swagger.md 규약과 정합하며, 옛 경로(`prd/`, `memory/`) 사용은 없다. 경미한 개선 여지로는 `## Overview` 섹션 부재, 일부 응답 포맷의 `data:` 래퍼 명시 누락, Rationale 앵커 참조의 정확성 문제가 있으나 모두 INFO 수준이다. 한편, API error code(`UPPER_SNAKE_CASE`)와 DB status_reason 값(`snake_case`)의 이중 표기는 의도적이며 Rationale에 근거가 있어 WARNING 수준으로 분류한다. 가장 주목해야 할 사안은 orchestrator가 target 문서 내용을 수집하지 못한 점(CRITICAL)이며, 이는 문서 자체의 위반이 아닌 인프라 수집 오류다.
+
+## 위험도
+
+LOW

```

---

### 파일 24: review/consistency/2026/05/16/14_28_20/cross_spec/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/14_28_20/cross_spec/review.md b/review/consistency/2026/05/16/14_28_20/cross_spec/review.md
new file mode 100644
index 00000000..b6578861
--- /dev/null
+++ b/review/consistency/2026/05/16/14_28_20/cross_spec/review.md
@@ -0,0 +1,78 @@
+# Cross-Spec 일관성 검토 — `spec/2-navigation/4-integration.md`
+
+검토 모드: `--impl-prep` (구현 착수 전)
+검토 기준: main 브랜치 대비 현재 worktree(`cafe24-mall-dup-ux-a7f2c8`) 의 spec 변경 사항 + 다른 영역 spec 과의 교차 일관성
+
+---
+
+## 발견사항
+
+### 발견사항 1
+- **[CRITICAL]** `Attention` 가상 필터값 삭제 — 프론트엔드 코드·도큐멘테이션과 직접 충돌
+  - target 위치: `spec/2-navigation/4-integration.md` §2.3 상태 칩, §2.4 배너 클릭 동작, §9.1 GET `/api/integrations` status 파라미터, §Rationale ("Attention 가상 필터값" 항 전체 삭제)
+  - 충돌 대상:
+    - `frontend/src/app/(main)/integrations/page.tsx` — `needsAttention` 함수를 import 하고 `attentionCount` 변수로 배너 건수를 계산. 기존 spec 에서 정의한 `Attention` 칩·`?status=attention` 가상 필터값 기반 동작이 코드에 구현되어 있음
+    - `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `export function needsAttention(...)` 함수 존재. 삭제된 Attention 개념의 핵심 술어를 export 함
+    - `frontend/src/content/docs/06-integrations-and-config/integration-management.mdx` · `.en.mdx` — "배너를 누르면 해당 상태 필터로 바로 이동" 사용자 가이드 문구가 `?status=attention` 라우팅을 전제로 기술되어 있음
+  - 상세: 이번 worktree 의 target spec 은 `Attention` 단일 칩과 `?status=attention` 가상 필터값을 **완전히 제거**하고, 배너 클릭 동작을 "상태 필터를 `Expiring|Expired|Error` 로 자동 전환" 한 줄로 단순화했다. 그러나 단일 선택 칩 모델에서 세 상태를 동시에 활성화할 UI 표현이 없다는 것이 삭제된 Rationale 에서 이미 분석된 내용이다. 현재 프론트엔드 코드는 삭제된 Attention 개념에 기반하여 구현되어 있어, 이 spec 을 그대로 구현에 반영하면 (a) 배너 클릭 동작이 정의 불가한 상태가 되고, (b) 기존 `needsAttention` 함수·`attentionCount` 변수가 spec 없이 코드에만 남는 유령 로직이 된다.
+  - 제안: 두 방향 중 하나를 선택해야 한다. (A) `Attention` 칩과 `?status=attention` 가상 필터값을 spec 에 복원하고 삭제된 Rationale 도 함께 복원한다. (B) Attention 개념을 실제로 제거하려면 프론트엔드 코드(`page.tsx`, `status-badge.tsx`)와 도큐멘테이션 MDX 파일도 동시에 갱신해야 한다. 현재 worktree 에서 코드 수정 없이 spec 만 삭제한 상태라면 구현 착수 전 방향 결정이 필수.
+
+---
+
+### 발견사항 2
+- **[CRITICAL]** `GET /api/integrations/:id` 응답에서 `appUrl` 필드 제거 — 프론트엔드 코드와 직접 충돌
+  - target 위치: `spec/2-navigation/4-integration.md` §9.1 `GET /api/integrations/:id` 설명 (이전: `appUrl: string | null` 포함 명시 → 현재: "상세 조회 (credentials는 마스킹)" 한 줄)
+  - 충돌 대상:
+    - `frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx` — `appUrl: "https://example.com/api/3rd-party/cafe24/install/abc"` 필드가 mock 데이터에 포함되어 있음 (line 133, 173, 197). 이 테스트는 `GET /api/integrations/:id` 응답에 `appUrl` 필드가 존재함을 전제로 작성됨
+    - `spec/1-data-model.md` §2.10 Integration — `install_token` 필드가 정의되어 있고, `spec/2-navigation/4-integration.md` Rationale "Cafe24 App URL 상세 페이지 표시" 항(main에 존재, worktree에서 삭제됨)이 이 필드를 `appUrl` 응답 필드로 노출하는 설계를 기술했었음
+    - `spec/4-nodes/4-integration/4-cafe24.md` §9 — App URL 관련 흐름이 `install_token` 기반 URL 을 Cafe24 Developers 에서 조회·복사할 수 있어야 함을 전제함
+  - 상세: 이전 spec(main)은 `GET /api/integrations/:id` 응답의 `IntegrationDto` 에 `appUrl: string | null` 필드를 포함하며, Cafe24 Private 통합의 경우 `${APP_URL}/api/3rd-party/cafe24/install/:installToken` 값을 반환하도록 정의했다. Overview 탭에 "App URL 카드"를 두어 사용자가 복사할 수 있도록 하는 것도 해당 spec 에 명시되어 있었다. 이번 worktree spec 이 두 정의를 모두 삭제했으나, 프론트엔드 테스트 코드는 `appUrl` 필드 존재를 전제로 구성되어 있다. 그대로 구현에 들어가면 Cafe24 Private 앱의 App URL 을 상세 페이지에서 조회·복사할 수 없어 사용자 운영 흐름이 단절된다.
+  - 제안: (A) `appUrl` 필드와 Overview 탭 "App URL 카드"를 spec 에 복원한다. (B) 실제로 제거하려면 프론트엔드 테스트 코드(`scope-tab.test.tsx` 등)도 함께 갱신해야 한다. Cafe24 Private 통합의 운영 흐름에서 App URL 접근성이 필요한지도 재검토 필요.
+
+---
+
+### 발견사항 3
+- **[WARNING]** §2.4 배너 `expiring` 포함 조건 단순화 — 잠재적 범위 확대
+  - target 위치: `spec/2-navigation/4-integration.md` §2.4 "Need attention" 배너 조건: `token_expires_at <= now() + 7d`
+  - 충돌 대상: `spec/2-navigation/4-integration.md` §11.4 UI 배지 조건 (동일 worktree 내 동일 파일) — `status IN (expired, error) OR (token_expires_at <= now() + 7d)` 카운트
+  - 상세: 기존 spec(main)은 배너 조건을 `status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d'` 로 구체화해 `pending_install` 상태의 행과 이미 `expired` 처리된 행이 이중 포함되지 않도록 방어했다. target spec 의 단순화된 `token_expires_at <= now() + 7d` 는 이 방어 조건이 없어 `expired` 상태의 행이 "만료 임박" 로도 집계되는 이중 카운트 가능성이 있다. `spec/5-system/4-execution-engine.md` 는 Integration 상태 전이를 `connected → expired` 로 정의하며, `expired` 상태의 행은 `token_expires_at <= now()` 조건을 이미 만족하므로 `expired ∪ expiring` 이 겹칠 수 있다.
+  - 제안: 배너 조건에 `status NOT IN (expired, error, pending_install)` 가드를 추가하거나, `OR` 구조(`status IN (expired, error)` 별도 + `status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d'`)로 명시적으로 분리한다. §11.4 UI 배지 조건도 동일하게 갱신.
+
+---
+
+### 발견사항 4
+- **[WARNING]** §9.1 `GET /api/integrations` status 파라미터 — `expiring` 가상 필터값 정의 삭제
+  - target 위치: `spec/2-navigation/4-integration.md` §9.1 `GET /api/integrations` 설명 (이전: `status` 허용값 명시·가상 필터값 변환 규칙 기술 → 현재: 허용값 기술 없음)
+  - 충돌 대상: `spec/2-navigation/4-integration.md` §2.3 상태 칩 — `Expiring (7일 이내)` 칩이 여전히 존재하며, 이 칩이 `?status=expiring` 쿼리를 발행한다는 것이 암시되어 있음. 백엔드가 `expiring` 을 WHERE 절로 변환하는 규칙이 없어지면 `?status=expiring` 이 DB Enum 에 없는 값으로 처리될 수 있음
+  - 상세: 상태 칩 `Expiring` 이 남아 있으면 프론트엔드는 여전히 `?status=expiring` 을 백엔드로 보낸다. 그런데 target spec 은 백엔드가 이 가상 필터값을 합집합 WHERE 절로 변환한다는 규칙을 삭제했다. `expiring` 은 `Integration.status` DB Enum (`connected`/`expired`/`error`/`pending_install`)에 없으므로, 변환 규칙 없이 그대로 WHERE `status='expiring'` 이 되면 0건 반환이 된다.
+  - 제안: `expiring` 가상 필터값 정의를 §9.1 에 복원(`status='connected' AND token_expires_at within 7d` 변환 규칙)하거나, §2.3 칩 목록에서 `Expiring` 을 실제 DB Enum 값이 아닌 가상값임을 명시한다. DB 쿼리 빌더의 변환 규칙이 spec 어딘가에 반드시 기술되어야 한다.
+
+---
+
+### 발견사항 5
+- **[INFO]** `spec/data-flow/5-integration.md` — `appUrl` 참조가 target spec 변경과 동기화 필요
+  - target 위치: `spec/2-navigation/4-integration.md` §9.1 `GET /api/integrations/:id` (appUrl 삭제)
+  - 충돌 대상: `spec/data-flow/5-integration.md` — Cafe24 Private 통합 등록 시퀀스 다이어그램에 `appUrl: .../3rd-party/cafe24/install/:installToken` 참조가 있음 (line 78–79)
+  - 상세: data-flow spec 은 별도 문서이지만 `appUrl` 이 `oauth/begin` 응답에 포함된다는 시퀀스를 기술하고 있다. target spec 이 §9.2 `POST /api/integrations/oauth/begin` 에서는 `appUrl` 을 여전히 응답에 포함시키므로 (`cafe24_private_pending` 응답) data-flow 참조는 실제로는 정합하다. 단, 삭제된 `GET /api/integrations/:id` 의 `appUrl` 필드 관련 data-flow 부분이 있다면 동기화 점검이 권장된다.
+  - 제안: `spec/data-flow/5-integration.md` 를 확인해 삭제된 `GET /api/integrations/:id` → `appUrl` 흐름이 기술된 곳이 있으면 해당 부분도 갱신한다. `POST /api/integrations/oauth/begin` → `appUrl` 흐름은 변경 없으므로 그대로 유지.
+
+---
+
+### 발견사항 6
+- **[INFO]** `spec/4-nodes/4-integration/4-cafe24.md` 참조 표기 — target spec 변경 이후도 일관성 유지 확인 필요
+  - target 위치: `spec/2-navigation/4-integration.md` §4.2 Overview 탭 (App URL 카드 제거)
+  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md` §9 — "통합 상세 페이지에서 현재 App URL 을 확인해 Cafe24 Developers 를 갱신하세요" 형태의 안내가 HMAC 에러 페이지 응답(Rationale "Cafe24 install_token mismatch 회복 흐름" §1057)에 참조되어 있음
+  - 상세: target spec 이 Overview 탭의 App URL 카드를 삭제하면, Cafe24 노드 spec 이 에러 복구 안내("통합 상세 페이지에서 현재 App URL 확인")를 가리키는 UX 경로가 실제 UI 에서 사라진다. 사용자는 에러 페이지의 안내를 따르더라도 해당 카드를 찾을 수 없게 된다.
+  - 제안: App URL 카드 삭제가 확정이라면 `spec/4-nodes/4-integration/4-cafe24.md` Rationale 의 에러 복구 안내 문구("통합 상세 페이지에서 현재 App URL 을 확인")를 대체 접근 경로로 갱신한다. App URL 을 상세 페이지 다른 위치(예: Security 탭)로 이동하는 방안도 고려.
+
+---
+
+## 요약
+
+이번 worktree(`cafe24-mall-dup-ux-a7f2c8`)의 target 문서 `spec/2-navigation/4-integration.md` 는 main 대비 (1) `Attention` 가상 필터 칩·`?status=attention` 쿼리값 삭제, (2) `GET /api/integrations/:id` 응답의 `appUrl` 필드 제거, (3) "Need attention" 배너 로직 단순화, (4) `expiring` 가상 필터값 변환 규칙 삭제 등 여러 UX 기능을 축소·제거하는 방향으로 개정되었다. 그러나 프론트엔드 코드(`page.tsx`, `status-badge.tsx`, `scope-tab.test.tsx`)와 사용자 가이드 MDX 파일은 삭제된 개념을 그대로 참조하고 있으며, 노드 spec(`4-cafe24.md`)의 에러 복구 안내도 삭제된 UI 요소를 가리키고 있다. 두 개의 CRITICAL 발견사항은 spec 변경이 코드·테스트와 정면으로 모순되는 상황으로, 구현 착수 전 spec 복원 또는 코드 동시 갱신 방향 결정이 필수적이다.
+
+---
+
+## 위험도
+
+**HIGH**

```

---

### 파일 25: review/consistency/2026/05/16/14_28_20/meta.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/14_28_20/meta.json b/review/consistency/2026/05/16/14_28_20/meta.json
new file mode 100644
index 00000000..1c16d0c5
--- /dev/null
+++ b/review/consistency/2026/05/16/14_28_20/meta.json
@@ -0,0 +1,12 @@
+{
+  "timestamp": "2026-05-16T14:28:20.525057",
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

### 파일 26: review/consistency/2026/05/16/14_28_20/naming_collision/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/14_28_20/naming_collision/review.md b/review/consistency/2026/05/16/14_28_20/naming_collision/review.md
new file mode 100644
index 00000000..5e6c0c35
--- /dev/null
+++ b/review/consistency/2026/05/16/14_28_20/naming_collision/review.md
@@ -0,0 +1,63 @@
+# 신규 식별자 충돌 검토 — `spec/2-navigation/4-integration.md`
+
+> 검토 모드: `--impl-prep` (구현 착수 전)
+> 검토 범위: `cafe24-mall-dup-ux` plan 이 도입하는 신규 식별자
+
+---
+
+## 검토 전제
+
+target 문서(`spec/2-navigation/4-integration.md`) 는 이 worktree 에서 아직 수정되지 않았다 (prompt 의 "구현 대상 영역: (없음)"). 그러나 `plan/in-progress/cafe24-mall-dup-ux.md` 와 `plan/in-progress/spec-update-cafe24-public-dup-guard.md` 에 명시된 구현 의도가 도입할 식별자들을 대상으로 분석한다. 해당 plan 들이 작성된 현 worktree 가 충돌 검토 범위다.
+
+---
+
+## 발견사항
+
+### 발견 1
+
+- **[WARNING]** `GET /api/integrations/cafe24/precheck` — 기존 `@Get(':id')` 라우트와의 정적/동적 경로 충돌 위험
+
+  - **target 신규 식별자**: `GET /api/integrations/cafe24/precheck` (`spec-update-cafe24-public-dup-guard.md` §9.2 신규 행)
+  - **기존 사용처**: `backend/src/modules/integrations/integrations.controller.ts:209` — `@Get(':id')` (`ParseUUIDPipe` 적용). 현재 정적 경로는 `GET /api/integrations` (목록), `GET /api/integrations/services` 두 가지 뿐이며, 이 두 라우트는 `:id` 보다 먼저 선언되어 있다.
+  - **상세**: NestJS 는 컨트롤러 내 라우트를 선언 순서대로 매칭한다. 새 `GET /api/integrations/cafe24/precheck` 를 `@Get(':id')` 보다 위에 선언하지 않으면 `cafe24` 가 `:id` 파라미터로 소비되어 `ParseUUIDPipe` 에서 400 오류가 발생한다. 또한 path segment 가 2개 (`cafe24/precheck`) 이므로 단순 `@Get('cafe24')` 와도 다르다 — 이 경우 `precheck` 가 `@Get(':id/usages')` 또는 `@Get(':id/activity')` 의 `:id=cafe24`, `segment=precheck` 로 해석될 수도 있다. 즉 `@Get('cafe24/precheck')` 를 `@Get(':id/usages')` 와 `@Get(':id/activity')` 보다 앞에 선언해야만 정적 경로가 올바르게 매칭된다.
+  - **제안**: 컨트롤러에 `@Get('cafe24/precheck')` 핸들러를 `@Get(':id')`, `@Get(':id/usages')`, `@Get(':id/activity')` 보다 앞 위치에 선언한다 (현재 `@Get('services')` 바로 아래가 적합). `ParseUUIDPipe` 는 이 라우트에 적용하지 않는다. 라우트 선언 순서 결정은 구현 착수 시 필수 확인 사항이다.
+
+---
+
+### 발견 2
+
+- **[WARNING]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` — Public 흐름에도 동일 에러 코드를 사용하여 이름과 의미가 불일치
+
+  - **target 신규 식별자**: `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 를 Public (`app_type='public'`) 흐름에도 반환하도록 의미 확장 (`cafe24-mall-dup-ux.md` §Backend (1), `spec-update-cafe24-public-dup-guard.md` §9.2 보강)
+  - **기존 사용처**:
+    - `spec/2-navigation/4-integration.md:684` — "Cafe24 Private 흐름 진입 시" 로 기술. 코드 이름에 `PRIVATE` 이 포함.
+    - `spec/2-navigation/4-integration.md:713` — 에러 코드 설명에 "Private" 을 명시.
+    - `backend/src/modules/integrations/integration-oauth.service.ts:1068` — Private begin 분기에서만 throw.
+    - `backend/src/modules/integrations/integrations.controller.ts:170` — Swagger doc 에 "connected 통합이 이미 존재" 와 함께 "private" 맥락으로 기술.
+  - **상세**: 코드 이름 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에 `PRIVATE` 이 포함되어 있어, Public 흐름에서도 동일 코드를 반환하면 API 클라이언트(프론트엔드, 외부 통합)가 코드 이름만 보고 "Private 전용 오류"로 오인할 수 있다. 현재 프론트엔드에서 이 코드를 기반으로 분기 로직을 작성하면 `PRIVATE` 이름 때문에 Public 경로의 409 처리를 누락할 가능성이 높다. `spec-update-cafe24-public-dup-guard.md` 에서도 기존 코드 이름을 그대로 재사용하는 방향으로 기술되어 있어 혼동이 구체적으로 발생한다.
+  - **제안 (두 가지 중 선택)**:
+    - (a) **코드 이름 일반화**: `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` → `CAFE24_MALL_ALREADY_CONNECTED` 로 rename. `PRIVATE` 한정 의미를 제거하면 Public/Private 양쪽에 자연스럽게 적용 가능하다. backend, spec, Swagger doc, 프론트엔드 toast/banner 메시지 키 모두 함께 변경.
+    - (b) **별도 코드 신설**: `CAFE24_MALL_ALREADY_CONNECTED` (app_type 무관) 를 신설하고, 기존 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 는 Private 전용으로 유지. Public begin 가드에는 새 코드 사용. 단, 두 코드가 동일 HTTP 상태(409)와 유사 의미를 갖게 되어 장기적으로 혼란이 가중된다 — 옵션 (a) 가 권장.
+
+---
+
+### 발견 3
+
+- **[INFO]** `findExistingConnectedCafe24Mall` helper — 기존 네이밍 컨벤션과의 일관성 확인 권장
+
+  - **target 신규 식별자**: `findExistingConnectedCafe24Mall(workspaceId, mallId)` (`cafe24-mall-dup-ux.md` §Backend (1) — private/public 공유 helper)
+  - **기존 사용처**: `backend/src/modules/integrations/integration-oauth.service.ts` 의 기존 private method 들 (`_buildCafe24AuthUrl`, `_handleCafe24Callback` 등 추정). 정확한 메서드 명칭은 파일 직접 확인 필요.
+  - **상세**: helper 이름이 `find...Connected` 로 `status='connected'` row만 조회한다는 의미를 내포하는데, `spec-update-cafe24-public-dup-guard.md` 에 따르면 `pending_install` / `expired` / `error` status 도 V045 backstop 이 다루므로 `connected` 만 감지하는 helper 가 전체 중복 방어의 절반만 담당한다. helper 이름에서 범위가 명확히 드러나도록 정합이 필요하다.
+  - **제안**: helper 이름을 `findConnectedCafe24MallIntegration(workspaceId, mallId)` 등 `connected` 상태만 조회한다는 사실을 명확히 드러내도록 유지하되, precheck endpoint 에서는 모든 status 를 반환하기 위해 별도 조회 로직이 필요함을 구현 시 주석으로 명시한다. 또는 `findAnyCafe24MallIntegration(workspaceId, mallId)` 로 범용 helper 를 만들고 caller 가 status 를 필터링하는 방식을 채택한다.
+
+---
+
+## 요약
+
+이번 `cafe24-mall-dup-ux` 구현 착수 전 검토에서 심각한 직접 충돌은 없으나, 두 가지 명명 위험이 발견된다. 첫째, `GET /api/integrations/cafe24/precheck` 는 기존 NestJS 라우터의 동적 경로 `@Get(':id')`, `@Get(':id/usages')`, `@Get(':id/activity')` 와 라우트 우선순위 충돌 위험이 있으며, 핸들러 선언 순서를 잘못 배치하면 런타임에 400 오류나 잘못된 핸들러 호출이 발생한다. 둘째, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 를 Public 흐름에 재사용하면 코드 이름의 `PRIVATE` 이 의미를 오도하여 프론트엔드 분기 로직의 결함으로 이어질 수 있다. 에러 코드를 `CAFE24_MALL_ALREADY_CONNECTED` 로 일반화하는 리네이밍이 구현 착수 전에 결정되어야 한다.
+
+---
+
+## 위험도
+
+**MEDIUM**

```

---

### 파일 27: review/consistency/2026/05/16/14_28_20/plan_coherence/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/14_28_20/plan_coherence/review.md b/review/consistency/2026/05/16/14_28_20/plan_coherence/review.md
new file mode 100644
index 00000000..fd1e77d7
--- /dev/null
+++ b/review/consistency/2026/05/16/14_28_20/plan_coherence/review.md
@@ -0,0 +1,39 @@
+### 발견사항
+
+- **[CRITICAL]** `spec/2-navigation/4-integration.md` Rationale 섹션에 대한 동시 worktree 경합
+  - target 위치: `spec-update-cafe24-public-dup-guard.md` — `spec/2-navigation/4-integration.md` Rationale 신설 항목 2개 ("Cafe24 Public 흐름의 begin-time 사전 가드 추가 (2026-05-16)", "precheck endpoint — mall_id 입력 단계 사전 감지 UX")
+  - 관련 plan: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` (worktree: `cafe24-hmac-raw-fix-b8e2d1`) — 변경 3: `spec/2-navigation/4-integration.md` Rationale 말미에 "HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)" 항 추가. 해당 변경은 브랜치 `claude/cafe24-hmac-raw-fix-b8e2d1` 에 commit `30be2f94` 로 이미 적용된 상태이며, 아직 main 에 미병합.
+  - 상세: 두 worktree(`cafe24-hmac-raw-fix-b8e2d1`, `cafe24-mall-dup-ux-a7f2c8`)가 동일 파일 `spec/2-navigation/4-integration.md` 의 `## Rationale` 섹션 말미를 동시에 수정한다. hmac-raw-fix 가 먼저 commit 을 만들었고 현재 PR 대기 중이므로, cafe24-mall-dup-ux 가 main 기반으로 Rationale 에 새 항목을 추가하면 merge 시 텍스트 충돌이 확정적으로 발생한다. 현재 main 에는 hmac-raw-fix 의 Rationale 변경이 포함되어 있지 않다.
+  - 제안: `cafe24-hmac-raw-fix-b8e2d1` PR 을 먼저 main 에 병합한 뒤, 현재 worktree(`cafe24-mall-dup-ux-a7f2c8`) 를 `git rebase main` 또는 `git merge main` 으로 갱신하고 Rationale 추가를 진행한다. 두 PR 의 병렬 merge 가 불가피하면 `merge-coordinator` 를 경유해 conflict 를 사전 패치로 해소한다.
+
+- **[WARNING]** `spec-update-cafe24-app-url-reuse.md` 의 미완 spec 갱신과 target 이 `spec/2-navigation/4-integration.md` §9 / Rationale 를 공유
+  - target 위치: `spec-update-cafe24-public-dup-guard.md` — `spec/2-navigation/4-integration.md` §9.2 begin 표 수정 + Rationale 신설
+  - 관련 plan: `plan/in-progress/spec-update-cafe24-app-url-reuse.md` (worktree: `cafe24-app-url-reuse-f9a2e3` — 실제로 존재하지 않음) — 미체크 항목 `[ ] spec 갱신` 이 `spec/2-navigation/4-integration.md` §3.2 / §4.4 / §6 / §9 / §10.2 / Rationale 전반을 수정 예정. worktree 가 소멸한 채 spec 갱신이 미완 상태로 남아 있음.
+  - 상세: `spec-update-cafe24-app-url-reuse.md` 의 `[ ] spec 갱신` 은 §9 (status 분기, request-scopes Private 응답 shape) 와 Rationale 를 포함한다. target 이 수정하는 §9.2 는 §9 내부에 있으므로 영역이 겹친다. 해당 plan 의 worktree 가 이미 소멸해 직접적인 git 충돌 위험은 낮으나, 어느 쪽이 먼저 §9 / Rationale 를 갱신하느냐에 따라 나중 작업자가 이전 변경을 모르고 덮어쓸 수 있다. 특히 Rationale 에 신규 항목을 순서 없이 두 군데서 추가하면 항목 순서 불일치가 생긴다.
+  - 제안: `spec-update-cafe24-app-url-reuse.md` 를 담당할 작업자(또는 project-planner)에게 본 target 의 §9.2 변경 내용(public begin 가드 + precheck 행)이 먼저 병합됨을 알린다. 해당 plan 의 §9 갱신 시 target 의 변경 결과를 기반으로 작업하도록 plan 에 메모를 추가한다.
+
+- **[WARNING]** `spec-update-cafe24-background-refresh.md` 의 §11 갱신이 target 과 같은 파일의 다른 섹션을 미완 상태로 대기 중
+  - target 위치: `spec-update-cafe24-public-dup-guard.md` — `spec/2-navigation/4-integration.md` §9.2 / §9.4 / Rationale
+  - 관련 plan: `plan/in-progress/spec-update-cafe24-background-refresh.md` (worktree: `prod-rereview-fix-a7c93f` — 존재하지 않음) — `spec/2-navigation/4-integration.md` §11.1 의 스캐너 잡 목록 + §11.x 신규 소절 추가가 미완 상태 (`[ ] project-planner 진입해 위 4개 항목 작성`).
+  - 상세: 두 plan 이 동일 파일의 서로 다른 섹션(§9 vs §11)을 손대므로 직접 텍스트 충돌 위험은 낮다. 그러나 두 변경이 순서 없이 PR 로 올라오면 §9 와 §11 이 서로 다른 상태의 파일을 base 로 만들어질 수 있다. worktree 소멸 상태에서 plan 이 미완이므로, 다음 담당자가 작업 시 target 의 Rationale/§9 변경이 이미 포함된 파일을 기반으로 시작해야 한다는 점을 plan 에 명시해야 한다.
+  - 제안: `spec-update-cafe24-background-refresh.md` 에 "§9 / Rationale 변경은 `cafe24-mall-dup-ux-a7f2c8` PR 병합 이후 기준으로 작업 시작" 메모 추가. 반대로 target 의 project-planner 작업자도 `spec-update-cafe24-background-refresh.md` 가 §11 을 아직 추가하지 않은 상태라는 것을 인지하고, §11 근방을 건드리지 않도록 주의한다.
+
+- **[WARNING]** 선행 조건인 `consistency-check --impl-prep` 가 아직 미체크
+  - target 위치: `cafe24-mall-dup-ux.md` — `- [ ] consistency-check --impl-prep` (진행 상태 섹션)
+  - 관련 plan: `cafe24-mall-dup-ux.md` 자체 (본 plan 의 체크리스트)
+  - 상세: 개발자 skill 규약에 따라 구현 착수 **직전** 에 `--impl-prep` 호출이 의무이다. 현재 세션은 `spec/2-navigation/4-integration.md` 를 scope 로 하는 `--impl-prep` (구현 착수 전 spec 검토) 이지만, `cafe24-mall-dup-ux.md` 의 `[ ] consistency-check --impl-prep` 체크박스가 미체크인 채로 구현 단계가 진행되면 규약 위반이 된다. 또한, 현재 이 consistency-check 가 그 `--impl-prep` 의 결과이기도 하므로, 본 세션 종료 후 체크박스를 체크하고 plan 을 갱신해야 한다.
+  - 제안: 본 consistency-check 완료 후 `cafe24-mall-dup-ux.md` 의 `[ ] consistency-check --impl-prep` 항목을 `[x]` 로 갱신한다.
+
+- **[INFO]** `cafe24-mall-dup-ux.md` — `- [ ] Spec 위임 (project-planner)` 항목이 미처리 상태인데 target(spec-update-cafe24-public-dup-guard.md) 을 먼저 생성
+  - target 위치: `cafe24-mall-dup-ux.md` — "Spec (5) — 별도 plan 노트로 위임" + `plan/in-progress/spec-update-cafe24-public-dup-guard.md` 생성
+  - 관련 plan: `cafe24-mall-dup-ux.md` 자체
+  - 상세: 개발 plan 이 spec 갱신을 project-planner 에게 위임한다는 내용과 위임 plan 을 직접 작성한 것은 정합하다. 다만 plan 항목 `- [ ] Spec 위임 (project-planner)` 이 체크되지 않은 채로 위임 plan 문서만 작성된 상태다. project-planner 가 실제로 spec 을 반영하기 전이므로 위임 자체는 미완이다. 이 관계를 명시적으로 연결해 두지 않으면 진행 상황 파악이 어렵다.
+  - 제안: `cafe24-mall-dup-ux.md` 의 `Spec (5)` 항목을 "- [x] plan/in-progress/spec-update-cafe24-public-dup-guard.md 작성 완료 (위임 대기 중)" 으로 갱신하거나, `spec-update-cafe24-public-dup-guard.md` 가 project-planner 에 의해 처리 완료되는 시점에 양쪽 plan 을 동시에 갱신한다.
+
+### 요약
+
+검토 대상(`spec/2-navigation/4-integration.md`)을 수정하는 plan 은 현재 4개다. 이 중 `cafe24-hmac-raw-fix-b8e2d1`(worktree 활성, PR 대기) 이 같은 파일의 Rationale 섹션을 이미 commit 한 상태로, target 도 Rationale 에 신규 항목 2개를 추가하려 해 병합 시 텍스트 충돌이 확정적이다(CRITICAL). `spec-update-cafe24-app-url-reuse.md` 와 `spec-update-cafe24-background-refresh.md` 는 각각 §9 및 §11 의 수정이 미완 상태이지만 worktree 가 소멸해 직접 경합은 낮다(WARNING, 순서 관리 필요). `consistency-check --impl-prep` 체크박스 미갱신은 규약 준수 관점에서 즉시 처리가 필요하다(WARNING). `cafe24-hmac-raw-fix-b8e2d1` PR 의 main 병합을 선행하고, 현재 worktree 를 rebase 한 뒤 spec 갱신을 진행하는 것이 가장 안전한 직렬화 경로다.
+
+### 위험도
+
+HIGH

```

---

### 파일 28: review/consistency/2026/05/16/14_28_20/rationale_continuity/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/14_28_20/rationale_continuity/review.md b/review/consistency/2026/05/16/14_28_20/rationale_continuity/review.md
new file mode 100644
index 00000000..d8e08830
--- /dev/null
+++ b/review/consistency/2026/05/16/14_28_20/rationale_continuity/review.md
@@ -0,0 +1,39 @@
+# Rationale 연속성 Review
+
+검토 대상: `spec/2-navigation/4-integration.md`
+검토 모드: `--impl-prep`
+검토 시각: 2026-05-16
+
+---
+
+## 발견사항
+
+- **[WARNING]** §11 본문의 "expire 처리" 표현이 폐기된 `expired(refresh_failed)` 경로를 암시
+  - target 위치: `spec/2-navigation/4-integration.md` §11 서두 2번째 문단 (line 801)
+  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "refresh 실패 시 status_reason 통일 (2026-05-16)"
+  - 상세: Rationale 에서 "refresh 실패 시 `error(auth_failed)` 채택, 옛 `expired (refresh_failed)` 분기 폐기"를 명시했다. 그런데 §11 본문에는 "갱신 실패한 토큰 셋은 그대로 **expire 처리**되어 사용자에게 reauthorize 권장"이라는 문구가 남아 있다. 이 표현은 refresh 실패 시 `expired` 상태로 전이하는 옛 경로를 연상시키며, 현행 동작(`error(auth_failed)` 전이)과 표현이 어긋난다. 구현자가 §11을 읽고 "refresh 실패 → expired" 로 잘못 구현할 여지가 있다.
+  - 제안: §11 해당 문구를 "갱신 실패한 토큰 셋은 `error(auth_failed)` 로 전이되어 사용자에게 reauthorize 권장"으로 정정하거나, `expired` 표현을 제거하고 각주로 "refresh 실패의 status 전이는 Rationale 'refresh 실패 시 status_reason 통일' 참조"를 추가한다.
+
+- **[INFO]** target 문서가 orchestrator 에 `(없음)` 으로 전달됨 — 실제 파일은 존재
+  - target 위치: prompt_file 의 "Target 문서" 섹션
+  - 과거 결정 출처: 해당 없음 (파일 접근 문제)
+  - 상세: orchestrator 가 `spec/2-navigation/4-integration.md` 의 내용을 prompt_file 에 포함시키지 못해 "구현 대상 영역: (없음)"으로 기재됐다. 본 검토에서는 해당 파일을 직접 Read 해 분석을 수행했으므로 분석 결과 자체에는 영향 없다. 단, orchestrator 의 target 문서 수집 로직에 버그가 있을 경우 다른 checker 의 검토가 불완전해질 수 있다.
+  - 제안: orchestrator 의 파일 수집 단계에서 `(없음)` 반환 여부를 검증하고, 파일이 존재하는데도 `(없음)`이 기재되면 에러를 올리도록 보완한다.
+
+- **[INFO]** `OAuthState.mode='reauthorize'` Rationale 의 "향후 분리 검토" 언급과 현재 `request_scopes` 분리 상태 간 정합 보완 필요
+  - target 위치: `spec/2-navigation/4-integration.md` Rationale "OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유"
+  - 과거 결정 출처: 동일 Rationale 항목 (2026-05-14)
+  - 상세: 2026-05-14 Rationale 에서 "향후 reauthorize 와 분리해야 할 동작이 늘어나면 별도 mode 신설 검토"라고 남겼다. 이후 Rationale "Cafe24 Private request-scopes 흐름 (2026-05-15)"에서 `request_scopes` mode 는 Private 에서 `begin` 우회 분기를 별도 처리하도록 분리됐다. `mode='reauthorize'` 와 `mode='request_scopes'` 의 분리 유지 결정이 명시됐으나, 원래 Rationale 의 "향후 검토" 언급은 아직 갱신되지 않아 독자가 "아직 미결 사항"으로 오해할 수 있다.
+  - 제안: Rationale "OAuthState.mode='reauthorize'" 항에 "(2026-05-15 후속) `request_scopes` mode 와의 분리는 'Cafe24 Private request-scopes 흐름' 항 참조 — 분리 방향으로 처리됨" 한 줄을 추가한다.
+
+---
+
+## 요약
+
+`spec/2-navigation/4-integration.md` 는 다수의 Rationale 항목이 풍부하게 작성되어 있으며, 기각된 대안(옛 mall_id 스캔 방식, install timeout 자동 삭제, expired(refresh_failed) 분기 등)의 번복 근거가 해당 Rationale 에 명시되어 있다. 전체적으로 Rationale 연속성이 잘 유지되고 있다. 다만 §11 본문에 "expire 처리"라는 표현이 폐기된 `expired(refresh_failed)` 흐름을 연상시키는 채로 남아 있어 구현자 혼란의 여지가 있다(WARNING 1건). 나머지는 문서 교차 참조 명확화 또는 orchestrator 개선에 관한 INFO 수준 보완 사항이다. 현행 target 문서가 과거 합의 원칙을 직접 위반하거나 기각된 대안을 재도입하는 CRITICAL 수준의 문제는 발견되지 않았다.
+
+---
+
+## 위험도
+
+LOW

```
