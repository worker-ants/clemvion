# Review Router Payload

본 파일은 orchestrator 가 review-router 용으로 작성한 입력입니다. 아래 변경 코드를 보고, 13명의 reviewer 후보 중 어떤 reviewer 를 실제로 실행할지 결정하세요.

## 결정 규칙
- 아래 **강제 포함** 목록은 router_safety 가 결정한 것으로, router 가 끄지 못합니다 (selected=true 고정).
- 그 외 reviewer 는 변경 코드의 실제 의미를 보고 판단. **확신 없으면 selected=true** (false-negative 가 false-positive 보다 위험).
- selected 수가 0 또는 1 이면 호출자가 본 결정을 폐기하고 전체 reviewer fallback 합니다 (역시 false-negative 방어).
- 변경 코드 본문을 직접 분석할 수 있도록 변경 파일 컨텍스트가 함께 전달됩니다. 추가 탐색이 필요하면 Read/Grep/Glob/Bash 를 자유롭게 사용해도 됩니다.

## 강제 포함 (router 가 끄지 못함)

- **documentation** (문서화(Documentation)) — 문서 파일(.md/.txt/.rst/.adoc/LICENSE/CHANGELOG 등) 변경: plan/in-progress/cafe24-ai-agent-allowlist-ui.md, plan/in-progress/cafe24-backlog-residual.md, plan/in-progress/cafe24-oauth-invalid-scope-handler.md (외 35건)
- **maintainability** (유지보수성(Maintainability)) — 소스 코드 변경 — 코드 변경 시 항상 적용: backend/src/modules/integrations/integration-oauth.service.ts, backend/src/modules/integrations/integration-status-reason.ts, backend/src/modules/integrations/services/service-registry.ts (외 19건)
- **requirement** (요구사항(Requirement)) — spec 본문 변경 — documentation 외에도 요구사항 일관성 검증 필요: spec/1-data-model.md, spec/2-navigation/4-integration.md, spec/4-nodes/4-integration/4-cafe24.md (외 7건) / 소스 코드 변경 — 코드 변경 시 항상 적용: backend/src/modules/integrations/integration-oauth.service.ts, backend/src/modules/integrations/integration-status-reason.ts, backend/src/modules/integrations/services/service-registry.ts (외 19건)
- **scope** (변경 범위(Scope)) — 소스 코드 변경 — 코드 변경 시 항상 적용: backend/src/modules/integrations/integration-oauth.service.ts, backend/src/modules/integrations/integration-status-reason.ts, backend/src/modules/integrations/services/service-registry.ts (외 19건)
- **security** (보안(Security)) — 소스 코드 변경 — 코드 변경 시 항상 적용: backend/src/modules/integrations/integration-oauth.service.ts, backend/src/modules/integrations/integration-status-reason.ts, backend/src/modules/integrations/services/service-registry.ts (외 19건)
- **side_effect** (부작용(Side Effect)) — 소스 코드 변경 — 코드 변경 시 항상 적용: backend/src/modules/integrations/integration-oauth.service.ts, backend/src/modules/integrations/integration-status-reason.ts, backend/src/modules/integrations/services/service-registry.ts (외 19건)
- **testing** (테스트(Testing)) — 소스 코드 변경 — 코드 변경 시 항상 적용: backend/src/modules/integrations/integration-oauth.service.ts, backend/src/modules/integrations/integration-status-reason.ts, backend/src/modules/integrations/services/service-registry.ts (외 19건)

## 13 reviewer 후보와 관점

- `security` — 보안(Security): 다음 코드 변경을 보안 관점에서 분석한다.
- `performance` — 성능(Performance): 다음 코드 변경을 성능 관점에서 분석한다.
- `architecture` — 아키텍처(Architecture): 다음 코드 변경을 아키텍처 관점에서 분석한다.
- `requirement` — 요구사항(Requirement): 다음 코드 변경이 의도한 기능을 충족하는지 분석한다.
- `scope` — 변경 범위(Scope): 다음 코드 변경이 의도된 범위를 벗어나지 않는지 분석한다.
- `side_effect` — 부작용(Side Effect): 다음 코드 변경이 의도하지 않은 부작용을 일으키지 않는지 분석한다.
- `maintainability` — 유지보수성(Maintainability): 다음 코드 변경을 유지보수성 관점에서 분석한다.
- `testing` — 테스트(Testing): 다음 코드 변경을 테스트 관점에서 분석한다.
- `documentation` — 문서화(Documentation): 다음 코드 변경을 문서화 관점에서 분석한다.
- `dependency` — 의존성(Dependency): 다음 코드 변경을 의존성 관점에서 분석한다.
- `database` — 데이터베이스(Database) (영역 무관 시 NONE 가능): 다음 코드 변경을 데이터베이스 관점에서 분석한다.
- `concurrency` — 동시성(Concurrency) (영역 무관 시 NONE 가능): 다음 코드 변경을 동시성/병렬 처리 관점에서 분석한다.
- `api_contract` — API 계약(API Contract) (영역 무관 시 NONE 가능): 다음 코드 변경을 API 계약 관점에서 분석한다.

## 변경 파일 컨텍스트

### 파일 1: backend/src/modules/integrations/integration-oauth.service.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integration-oauth.service.ts b/backend/src/modules/integrations/integration-oauth.service.ts
index b891c115..594f1843 100644
--- a/backend/src/modules/integrations/integration-oauth.service.ts
+++ b/backend/src/modules/integrations/integration-oauth.service.ts
@@ -788,6 +788,7 @@ export class IntegrationOAuthService {
     workspaceId: string,
     errorCode: string,
     errorMessage: string,
+    extra?: { requiresCafe24Approval?: string[] },
   ): Promise<void> {
     try {
       const integration = await this.integrationRepository.findOne({
@@ -797,10 +798,15 @@ export class IntegrationOAuthService {
         // Row was deleted or workspace mismatch — nothing to update.
         return;
       }
+      const detailsObj: Record<string, unknown> | undefined =
+        extra?.requiresCafe24Approval && extra.requiresCafe24Approval.length > 0
+          ? { requiresCafe24Approval: extra.requiresCafe24Approval }
+          : undefined;
       const lastError = {
         code: errorCode,
         message: sanitizeLastErrorMessage(errorMessage),
         at: new Date().toISOString(),
+        ...(detailsObj ? { details: detailsObj } : {}),
       };
       integration.lastError = lastError;
       if (integration.status === 'pending_install') {
@@ -808,7 +814,9 @@ export class IntegrationOAuthService {
         // B-3-4: errorCode.toLowerCase() 를 union 화이트리스트로 정규화.
         // 알 수 없는 코드는 `unknown_error` 로 fallback 해 UI/응답이 union
         // 밖 값을 노출하지 않게 한다.
-        integration.statusReason = normalizeStatusReason(errorCode.toLowerCase());
+        integration.statusReason = normalizeStatusReason(
+          errorCode.toLowerCase(),
+        );
       } else if (
         integration.status === 'connected' &&
         errorCode === 'OAUTH_TOKEN_EXCHANGE_FAILED'

```

---

### 파일 2: backend/src/modules/integrations/integration-status-reason.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integration-status-reason.ts b/backend/src/modules/integrations/integration-status-reason.ts
index ba592ed0..d7f88f06 100644
--- a/backend/src/modules/integrations/integration-status-reason.ts
+++ b/backend/src/modules/integrations/integration-status-reason.ts
@@ -24,11 +24,18 @@ export const INTEGRATION_STATUS_REASONS = [
   'oauth_token_exchange_failed',
   'oauth_preview_invalid',
   'oauth_preview_expired',
+  // Cafe24 refused the requested scope at authorize / token exchange.
+  // Carries `last_error.details.requiresCafe24Approval: string[]` when the
+  // refused scope(s) are part of the partner-approval list. Distinct from
+  // `oauth_token_exchange_failed` (catch-all for other token failures).
+  // spec/conventions/cafe24-restricted-scopes.md §4.3.
+  'oauth_invalid_scope',
   // 미분류 fallback — 운영 알람 신호. 새 케이스는 위 union 에 추가.
   'unknown_error',
 ] as const;
 
-export type IntegrationStatusReason = (typeof INTEGRATION_STATUS_REASONS)[number];
+export type IntegrationStatusReason =
+  (typeof INTEGRATION_STATUS_REASONS)[number];
 
 const STATUS_REASON_SET: ReadonlySet<string> = new Set(
   INTEGRATION_STATUS_REASONS as readonly string[],
@@ -39,7 +46,9 @@ const STATUS_REASON_SET: ReadonlySet<string> = new Set(
  * 으로 넘길 때, union 에 포함되면 그대로 쓰고 아니면 `unknown_error` 로
  * 정규화한다. UI/API 응답이 union 밖 값을 노출하지 않도록 보장.
  */
-export function normalizeStatusReason(raw: string | null | undefined): IntegrationStatusReason {
+export function normalizeStatusReason(
+  raw: string | null | undefined,
+): IntegrationStatusReason {
   if (!raw) return 'unknown_error';
   return STATUS_REASON_SET.has(raw)
     ? (raw as IntegrationStatusReason)

```

---

### 파일 3: backend/src/modules/integrations/services/service-registry.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/services/service-registry.ts b/backend/src/modules/integrations/services/service-registry.ts
index 4463f7f9..c0e6d460 100644
--- a/backend/src/modules/integrations/services/service-registry.ts
+++ b/backend/src/modules/integrations/services/service-registry.ts
@@ -38,6 +38,13 @@ export interface ScopeOption {
   value: string;
   label: string;
   recommended?: boolean;
+  /**
+   * Cafe24 partner-approval flag — true when this scope (e.g.
+   * `mall.read_mileage`) requires explicit Cafe24 approval before the
+   * OAuth consent will succeed. Frontend renders a ⚠ badge + tooltip.
+   * SoT: `spec/conventions/cafe24-restricted-scopes.md` §1.
+   */
+  requiresApproval?: boolean;
 }
 
 export interface ServiceDefinition {
@@ -135,15 +142,23 @@ const CAFE24_SCOPES: ScopeOption[] = [
   { value: 'mall.write_category', label: '카테고리 수정' },
   { value: 'mall.read_promotion', label: '프로모션 조회' },
   { value: 'mall.write_promotion', label: '프로모션 수정' },
-  { value: 'mall.read_mileage', label: '적립금 조회' },
-  { value: 'mall.write_mileage', label: '적립금 수정' },
+  { value: 'mall.read_mileage', label: '적립금 조회', requiresApproval: true },
+  { value: 'mall.write_mileage', label: '적립금 수정', requiresApproval: true },
   { value: 'mall.read_shipping', label: '배송 조회' },
   { value: 'mall.write_shipping', label: '배송 수정' },
   { value: 'mall.read_salesreport', label: '매출 통계 조회' },
   { value: 'mall.read_translation', label: '번역 조회' },
   { value: 'mall.write_translation', label: '번역 수정' },
-  { value: 'mall.read_notification', label: '알림 조회' },
-  { value: 'mall.write_notification', label: '알림 발송' },
+  {
+    value: 'mall.read_notification',
+    label: '알림 조회',
+    requiresApproval: true,
+  },
+  {
+    value: 'mall.write_notification',
+    label: '알림 발송',
+    requiresApproval: true,
+  },
   // Less common — kept under the "고급" toggle in the UI
   { value: 'mall.read_application', label: '앱 관리 조회' },
   { value: 'mall.write_application', label: '앱 관리 수정' },
@@ -159,8 +174,12 @@ const CAFE24_SCOPES: ScopeOption[] = [
   { value: 'mall.write_supply', label: '공급사 수정' },
   { value: 'mall.read_personal', label: '개인화 조회' },
   { value: 'mall.write_personal', label: '개인화 수정' },
-  { value: 'mall.read_privacy', label: '개인정보 조회' },
-  { value: 'mall.write_privacy', label: '개인정보 수정' },
+  { value: 'mall.read_privacy', label: '개인정보 조회', requiresApproval: true },
+  {
+    value: 'mall.write_privacy',
+    label: '개인정보 수정',
+    requiresApproval: true,
+  },
 ];
 
 const HTTP_COMMON: CredentialField[] = [

```

---

### 파일 4: backend/src/nodes/integration/cafe24/cafe24-api.client.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/cafe24-api.client.ts b/backend/src/nodes/integration/cafe24/cafe24-api.client.ts
index 7616fd9e..e0961313 100644
--- a/backend/src/nodes/integration/cafe24/cafe24-api.client.ts
+++ b/backend/src/nodes/integration/cafe24/cafe24-api.client.ts
@@ -13,6 +13,10 @@ import {
 } from '../../../modules/integrations/cafe24-token-refresh.constants.js';
 import { sanitizeLastErrorMessage } from '../../../modules/integrations/integration-oauth.service.js';
 import { IntegrationActionRequiredNotifier } from '../../../modules/integrations/integration-action-required-notifier.service.js';
+import {
+  extractCafe24ScopeTokens,
+  pickRestrictedApprovalScopes,
+} from './metadata/restricted-approval.js';
 
 /**
  * Optional DI tokens for swapping the network / sleep primitives in tests.
@@ -799,11 +803,24 @@ export class Cafe24ApiClient {
   private async markAuthFailed(
     integration: Integration,
     reason: 'auth_failed' | 'insufficient_scope' = 'auth_failed',
+    errBody?: unknown,
   ): Promise<void> {
     // A-1: error 도메인 신규 진입에만 알림. 이미 같은 reason 으로 error 였으면
     // 알림 emit 을 건너뛴다 (notifier 의 24h dedup 으로 추가 보호도 있음).
     const transitioning =
       integration.status !== 'error' || integration.statusReason !== reason;
+    // requiresCafe24Approval — Cafe24 응답에서 mall.<read|write>_<r> 토큰을
+    // 뽑아 별도 승인 명단 (`cafe24-restricted-scopes.md` §1) 과 교차한다.
+    // 매칭이 비어 있으면 details 자체를 omit 해 다른 reason 의 last_error
+    // shape 과 분리. spec/2-navigation/4-integration.md §10.4 정책.
+    const requiresApproval =
+      reason === 'insufficient_scope'
+        ? pickRestrictedApprovalScopes(extractCafe24ScopeTokens(errBody))
+        : undefined;
+    const lastErrorDetails =
+      requiresApproval !== undefined
+        ? { requiresCafe24Approval: requiresApproval }
+        : undefined;
     try {
       await this.integrationRepository.update(integration.id, {
         status: 'error',
@@ -815,6 +832,7 @@ export class Cafe24ApiClient {
               ? 'Cafe24 returned 403 (insufficient scope)'
               : 'Cafe24 returned 401/403',
           at: new Date().toISOString(),
+          ...(lastErrorDetails ? { details: lastErrorDetails } : {}),
         },
       });
       integration.status = 'error';
@@ -1057,7 +1075,7 @@ export class Cafe24ApiClient {
         response.status === 403 && this.detectInsufficientScope(errBody)
           ? 'insufficient_scope'
           : 'auth_failed';
-      await this.markAuthFailed(integration, reason);
+      await this.markAuthFailed(integration, reason, errBody);
       throw new Cafe24AuthFailedError(response.status, mallId, errBody);
     }
 
@@ -1087,10 +1105,7 @@ export class Cafe24ApiClient {
         url.searchParams.append(k, stringifyQueryValue(v));
       }
     }
-    if (
-      url.protocol !== 'https:' ||
-      !url.hostname.endsWith('.cafe24api.com')
-    ) {
+    if (url.protocol !== 'https:' || !url.hostname.endsWith('.cafe24api.com')) {
       throw new Error(
         `Cafe24ApiClient: refusing to call non-Cafe24 host ${url.hostname} (SSRF guard)`,
       );

```

---

### 파일 5: backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts b/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts
index 5d120914..ade4c429 100644
--- a/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts
@@ -25,6 +25,9 @@ import type { Cafe24Resource } from './types.js';
  * 6. status 는 `supported` | `planned` | `deprecated` 중 하나
  * 7. `status: planned` row 는 `CAFE24_PLANNED_BY_RESOURCE` (planned.ts) 에 매칭
  *    되어야 하고 `paginated` 가 일치해야 함 (양방향)
+ * 8. **`restricted` 컬럼 ↔ `restrictedApproval` 양방향 동기** — catalog `scope`/`operation` ↔ metadata `level='scope'/'operation'`.
+ *    `level='program'` 인 메타데이터는 catalog 대상이 아니라 본 검증에서 제외.
+ *    명단 SoT: `spec/conventions/cafe24-restricted-scopes.md`.
  */
 
 const CATALOG_DIR = join(
@@ -41,6 +44,7 @@ const CATALOG_DIR = join(
 );
 
 type CatalogStatus = 'supported' | 'planned' | 'deprecated';
+type CatalogRestricted = 'scope' | 'operation' | '';
 
 interface CatalogRow {
   id: string;
@@ -49,30 +53,78 @@ interface CatalogRow {
   method: string;
   path: string;
   scope: string;
+  restricted: CatalogRestricted;
   paginated: boolean;
   status: CatalogStatus;
   docsUrl: string;
 }
 
+// Header-based dynamic column indexing — supports catalog files with or without
+// the optional `restricted` column. See `_overview.md` §2 for canonical order:
+// `id | 라벨 (한) | English title | method | path | scope | restricted? | paginated | status | docs`.
+const CANONICAL_HEADERS = [
+  'id',
+  '라벨 (한)',
+  'english title',
+  'method',
+  'path',
+  'scope',
+  'restricted',
+  'paginated',
+  'status',
+  'docs',
+];
+
+function parseHeaderCells(line: string): string[] {
+  return line
+    .split('|')
+    .slice(1, -1)
+    .map((c) => c.trim().toLowerCase().replace(/`/g, ''));
+}
+
+function buildColumnIndex(headerCells: string[]): Record<string, number> {
+  const idx: Record<string, number> = {};
+  for (const name of CANONICAL_HEADERS) {
+    const found = headerCells.indexOf(name);
+    if (found >= 0) idx[name] = found;
+  }
+  return idx;
+}
+
+function cellOr(
+  cells: string[],
+  idx: number | undefined,
+  fallback = '',
+): string {
+  if (idx === undefined || idx < 0 || idx >= cells.length) return fallback;
+  return cells[idx];
+}
+
 function parseCatalogFile(filePath: string): CatalogRow[] {
   const raw = readFileSync(filePath, 'utf-8');
   const lines = raw.split('\n');
   const rows: CatalogRow[] = [];
   let inTable = false;
   let headerSeen = false;
+  let columnIndex: Record<string, number> = {};
 
   for (const line of lines) {
     if (!line.trim().startsWith('|')) {
       if (inTable) inTable = false;
       headerSeen = false;
+      columnIndex = {};
       continue;
     }
     if (!inTable) {
       inTable = true;
       headerSeen = false;
+      // First row is the header
+      const headerCells = parseHeaderCells(line);
+      columnIndex = buildColumnIndex(headerCells);
+      continue;
     }
     if (!headerSeen) {
-      // First two `|`-rows are header + separator
+      // Second row is the separator `|---|---|...|`
       if (/^\s*\|[\s-:|]+\|\s*$/.test(line)) {
         headerSeen = true;
       }
@@ -84,33 +136,30 @@ function parseCatalogFile(filePath: string): CatalogRow[] {
       .slice(1, -1)
       .map((c) => c.trim());
     if (cells.length < 9) continue;
-    const [
-      idCell,
-      labelKoCell,
-      englishTitleCell,
-      methodCell,
-      pathCell,
-      scopeCell,
-      paginatedCell,
-      statusCell,
-      docsCell,
-    ] = cells;
 
+    const idCell = cellOr(cells, columnIndex.id);
     const id = idCell.replace(/^`|`$/g, '').trim();
     if (!id) continue;
-    const path = pathCell.replace(/^`|`$/g, '').trim();
-    const status = statusCell as CatalogStatus;
+
+    const pathCell = cellOr(cells, columnIndex.path);
+    const docsCell = cellOr(cells, columnIndex.docs);
     const docsMatch = docsCell.match(/\((https?:\/\/[^)]+)\)/);
+    const restrictedRaw = cellOr(cells, columnIndex.restricted);
+    const restricted: CatalogRestricted =
+      restrictedRaw === 'scope' || restrictedRaw === 'operation'
+        ? restrictedRaw
+        : '';
 
     rows.push({
       id,
-      labelKo: labelKoCell,
-      englishTitle: englishTitleCell,
-      method: methodCell,
-      path,
-      scope: scopeCell,
-      paginated: paginatedCell === '✓',
-      status,
+      labelKo: cellOr(cells, columnIndex['라벨 (한)']),
+      englishTitle: cellOr(cells, columnIndex['english title']),
+      method: cellOr(cells, columnIndex.method),
+      path: pathCell.replace(/^`|`$/g, '').trim(),
+      scope: cellOr(cells, columnIndex.scope),
+      restricted,
+      paginated: cellOr(cells, columnIndex.paginated) === '✓',
+      status: cellOr(cells, columnIndex.status) as CatalogStatus,
       docsUrl: docsMatch?.[1] ?? docsCell,
     });
   }
@@ -341,4 +390,82 @@ describe('Cafe24 API catalog ↔ metadata sync', () => {
       }
     });
   });
+
+  // Rule 8 — restrictedApproval ↔ catalog `restricted` two-way sync.
+  // SoT: spec/conventions/cafe24-restricted-scopes.md.
+  describe('catalog `restricted` ↔ metadata `restrictedApproval`', () => {
+    it('supported row with restricted=scope|operation has metadata.restrictedApproval', () => {
+      for (const resource of CAFE24_RESOURCES) {
+        for (const row of catalog[resource]) {
+          if (row.status !== 'supported') continue;
+          if (row.restricted === '') continue;
+          const op = findCafe24Operation(resource, row.id)!;
+          if (!op.restrictedApproval) {
+            throw new Error(
+              `${resource}.md row "${row.id}": catalog restricted="${row.restricted}" but metadata.restrictedApproval is undefined`,
+            );
+          }
+        }
+      }
+    });
+
+    it('supported row restricted column matches metadata.restrictedApproval.level', () => {
+      for (const resource of CAFE24_RESOURCES) {
+        for (const row of catalog[resource]) {
+          if (row.status !== 'supported') continue;
+          const op = findCafe24Operation(resource, row.id)!;
+          const expected = op.restrictedApproval?.level;
+          if (expected === undefined) {
+            if (row.restricted !== '') {
+              throw new Error(
+                `${resource}.md row "${row.id}": catalog restricted="${row.restricted}" but metadata has no restrictedApproval`,
+              );
+            }
+            continue;
+          }
+          // `program` level rows are not catalog-tracked
+          if (expected === 'program') continue;
+          if (expected !== row.restricted) {
+            throw new Error(
+              `${resource}.md row "${row.id}": restricted mismatch (catalog="${row.restricted}", metadata.level="${expected}")`,
+            );
+          }
+        }
+      }
+    });
+
+    it('metadata operations with restrictedApproval (excluding program level) are flagged in catalog', () => {
+      for (const resource of CAFE24_RESOURCES) {
+        const supportedRowsById = new Map(
+          catalog[resource]
+            .filter((r) => r.status === 'supported')
+            .map((r) => [r.id, r] as const),
+        );
+        for (const op of CAFE24_OPERATIONS_BY_RESOURCE[resource]) {
+          if (!op.restrictedApproval) continue;
+          if (op.restrictedApproval.level === 'program') continue;
+          const row = supportedRowsById.get(op.id);
+          if (!row) continue; // caught by metadata→catalog test above
+          if (row.restricted === '') {
+            throw new Error(
+              `${resource}.md row "${op.id}": metadata.restrictedApproval set but catalog restricted column is empty`,
+            );
+          }
+        }
+      }
+    });
+
+    it('restrictedApproval.inquiryUrl is non-empty when set', () => {
+      for (const resource of CAFE24_RESOURCES) {
+        for (const op of CAFE24_OPERATIONS_BY_RESOURCE[resource]) {
+          if (!op.restrictedApproval) continue;
+          if (!op.restrictedApproval.inquiryUrl) {
+            throw new Error(
+              `${resource} ${op.id}: restrictedApproval.inquiryUrl must be non-empty`,
+            );
+          }
+        }
+      }
+    });
+  });
 });

```

---

### 파일 6: backend/src/nodes/integration/cafe24/metadata/mileage.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/mileage.ts b/backend/src/nodes/integration/cafe24/metadata/mileage.ts
index 2653ad9c..12774d23 100644
--- a/backend/src/nodes/integration/cafe24/metadata/mileage.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/mileage.ts
@@ -1,4 +1,5 @@
 import type { Cafe24OperationMetadata } from './types.js';
+import { RESTRICTED_APPROVAL } from './restricted-approval.js';
 
 export const mileageOperations: Cafe24OperationMetadata[] = [
   {
@@ -17,6 +18,7 @@ export const mileageOperations: Cafe24OperationMetadata[] = [
     },
     responseShape: 'list',
     paginated: true,
+    restrictedApproval: RESTRICTED_APPROVAL.mileage,
   },
   {
     id: 'mileage_grant',
@@ -43,6 +45,7 @@ export const mileageOperations: Cafe24OperationMetadata[] = [
       },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.mileage,
   },
   // Phase 6e — Mileage 보완
   {
@@ -59,6 +62,7 @@ export const mileageOperations: Cafe24OperationMetadata[] = [
       shop_no: { type: 'number', location: 'query', default: 1 },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.mileage,
   },
   {
     id: 'points_autoexpiration_create',
@@ -80,6 +84,7 @@ export const mileageOperations: Cafe24OperationMetadata[] = [
       },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.mileage,
   },
   {
     id: 'points_autoexpiration_delete',
@@ -93,6 +98,7 @@ export const mileageOperations: Cafe24OperationMetadata[] = [
       id: { type: 'string', location: 'path' },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.mileage,
   },
   {
     id: 'credits_list',
@@ -109,11 +115,13 @@ export const mileageOperations: Cafe24OperationMetadata[] = [
     },
     responseShape: 'list',
     paginated: true,
+    restrictedApproval: RESTRICTED_APPROVAL.mileage,
   },
   {
     id: 'credits_report',
     label: '예치금 리포트 조회',
-    description: 'Retrieve the credit (예치금) summary report for a date range.',
+    description:
+      'Retrieve the credit (예치금) summary report for a date range.',
     scopeType: 'read',
     method: 'GET',
     path: 'credits/report',
@@ -124,6 +132,7 @@ export const mileageOperations: Cafe24OperationMetadata[] = [
       end_date: { type: 'string', location: 'query' },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.mileage,
   },
   // Phase 8a — Mileage 완성
   {
@@ -140,5 +149,6 @@ export const mileageOperations: Cafe24OperationMetadata[] = [
       end_date: { type: 'string', location: 'query' },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.mileage,
   },
 ];

```

---

### 파일 7: backend/src/nodes/integration/cafe24/metadata/notification.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/notification.ts b/backend/src/nodes/integration/cafe24/metadata/notification.ts
index 9ce6e2e8..01bd1ae8 100644
--- a/backend/src/nodes/integration/cafe24/metadata/notification.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/notification.ts
@@ -1,4 +1,5 @@
 import type { Cafe24OperationMetadata } from './types.js';
+import { RESTRICTED_APPROVAL } from './restricted-approval.js';
 
 export const notificationOperations: Cafe24OperationMetadata[] = [
   {
@@ -16,6 +17,7 @@ export const notificationOperations: Cafe24OperationMetadata[] = [
       content: { type: 'string', location: 'body' },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.notification,
   },
   {
     id: 'sms_balance_get',
@@ -29,6 +31,7 @@ export const notificationOperations: Cafe24OperationMetadata[] = [
       shop_no: { type: 'number', location: 'query', default: 1 },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.notification,
   },
   // Phase 6f — Notification 보완
   {
@@ -43,6 +46,7 @@ export const notificationOperations: Cafe24OperationMetadata[] = [
       shop_no: { type: 'number', location: 'query', default: 1 },
     },
     responseShape: 'list',
+    restrictedApproval: RESTRICTED_APPROVAL.notification,
   },
   {
     id: 'sms_receivers_get',
@@ -58,6 +62,7 @@ export const notificationOperations: Cafe24OperationMetadata[] = [
       cellphone: { type: 'string', location: 'query' },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.notification,
   },
   {
     id: 'automails_get',
@@ -71,6 +76,7 @@ export const notificationOperations: Cafe24OperationMetadata[] = [
       shop_no: { type: 'number', location: 'query', default: 1 },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.notification,
   },
   {
     id: 'automails_update',
@@ -85,6 +91,7 @@ export const notificationOperations: Cafe24OperationMetadata[] = [
       shop_no: { type: 'number', location: 'body', default: 1 },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.notification,
   },
   {
     id: 'recipientgroups_list',
@@ -99,6 +106,7 @@ export const notificationOperations: Cafe24OperationMetadata[] = [
     },
     responseShape: 'list',
     paginated: true,
+    restrictedApproval: RESTRICTED_APPROVAL.notification,
   },
   {
     id: 'recipientgroups_get',
@@ -113,6 +121,7 @@ export const notificationOperations: Cafe24OperationMetadata[] = [
       shop_no: { type: 'number', location: 'query', default: 1 },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.notification,
   },
   // Phase 8e — Notification 완성 (invitation + recipientgroups CUD)
   {
@@ -128,11 +137,13 @@ export const notificationOperations: Cafe24OperationMetadata[] = [
       member_id: { type: 'string', location: 'body' },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.notification,
   },
   {
     id: 'recipientgroups_create',
     label: '수신자 그룹 생성',
-    description: 'Create a distribution group. Body schema partial — refer to Cafe24 docs.',
+    description:
+      'Create a distribution group. Body schema partial — refer to Cafe24 docs.',
     scopeType: 'write',
     method: 'POST',
     path: 'recipientgroups',
@@ -142,6 +153,7 @@ export const notificationOperations: Cafe24OperationMetadata[] = [
       group_name: { type: 'string', location: 'body' },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.notification,
   },
   {
     id: 'recipientgroups_update',
@@ -157,6 +169,7 @@ export const notificationOperations: Cafe24OperationMetadata[] = [
       group_name: { type: 'string', location: 'body' },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.notification,
   },
   {
     id: 'recipientgroups_delete',
@@ -170,5 +183,6 @@ export const notificationOperations: Cafe24OperationMetadata[] = [
       group_no: { type: 'number', location: 'path' },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.notification,
   },
 ];

```

---

### 파일 8: backend/src/nodes/integration/cafe24/metadata/privacy.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/privacy.ts b/backend/src/nodes/integration/cafe24/metadata/privacy.ts
index 59e133d4..e76869cf 100644
--- a/backend/src/nodes/integration/cafe24/metadata/privacy.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/privacy.ts
@@ -1,4 +1,5 @@
 import type { Cafe24OperationMetadata } from './types.js';
+import { RESTRICTED_APPROVAL } from './restricted-approval.js';
 
 export const privacyOperations: Cafe24OperationMetadata[] = [
   {
@@ -15,12 +16,14 @@ export const privacyOperations: Cafe24OperationMetadata[] = [
       shop_no: { type: 'number', location: 'query', default: 1 },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.privacy,
   },
   // Phase 8f — Privacy 완성
   {
     id: 'customers_privacy_list',
     label: '회원 개인정보 목록 조회',
-    description: 'Retrieve a list of customer privacy records (requires elevated scope).',
+    description:
+      'Retrieve a list of customer privacy records (requires elevated scope).',
     scopeType: 'read',
     method: 'GET',
     path: 'privacy/customers',
@@ -31,11 +34,13 @@ export const privacyOperations: Cafe24OperationMetadata[] = [
     },
     responseShape: 'list',
     paginated: true,
+    restrictedApproval: RESTRICTED_APPROVAL.privacy,
   },
   {
     id: 'customers_privacy_count',
     label: '회원 개인정보 개수 조회',
-    description: 'Retrieve the count of customer privacy records (requires elevated scope).',
+    description:
+      'Retrieve the count of customer privacy records (requires elevated scope).',
     scopeType: 'read',
     method: 'GET',
     path: 'privacy/customers/count',
@@ -44,11 +49,13 @@ export const privacyOperations: Cafe24OperationMetadata[] = [
       shop_no: { type: 'number', location: 'query', default: 1 },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.privacy,
   },
   {
     id: 'customers_privacy_update',
     label: '회원 개인정보 수정',
-    description: 'Update a customer privacy record (partial). Refer to Cafe24 docs for full schema.',
+    description:
+      'Update a customer privacy record (partial). Refer to Cafe24 docs for full schema.',
     scopeType: 'write',
     method: 'PUT',
     path: 'privacy/customers/{member_id}',
@@ -58,6 +65,7 @@ export const privacyOperations: Cafe24OperationMetadata[] = [
       shop_no: { type: 'number', location: 'body', default: 1 },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.privacy,
   },
   {
     id: 'products_wishlist_customers_list',
@@ -73,11 +81,13 @@ export const privacyOperations: Cafe24OperationMetadata[] = [
     },
     responseShape: 'list',
     paginated: true,
+    restrictedApproval: RESTRICTED_APPROVAL.privacy,
   },
   {
     id: 'products_wishlist_customers_count',
     label: '위시리스트 보유 회원 수',
-    description: 'Retrieve the count of customers who have a given product in their wishlist.',
+    description:
+      'Retrieve the count of customers who have a given product in their wishlist.',
     scopeType: 'read',
     method: 'GET',
     path: 'products/{product_no}/wishlist/customers/count',
@@ -87,5 +97,6 @@ export const privacyOperations: Cafe24OperationMetadata[] = [
       shop_no: { type: 'number', location: 'query', default: 1 },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.privacy,
   },
 ];

```

---

### 파일 9: backend/src/nodes/integration/cafe24/metadata/public-meta.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/public-meta.ts b/backend/src/nodes/integration/cafe24/metadata/public-meta.ts
index 5ea3e31e..aa5ab407 100644
--- a/backend/src/nodes/integration/cafe24/metadata/public-meta.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/public-meta.ts
@@ -19,6 +19,7 @@ import {
   type Cafe24FieldSpec,
   type Cafe24OperationMetadata,
   type Cafe24Resource,
+  type Cafe24RestrictedApproval,
 } from './index.js';
 import {
   CAFE24_PLANNED_BY_RESOURCE,
@@ -47,6 +48,12 @@ export interface PublicCafe24OperationSupported {
   paginated: boolean;
   requiredFields: readonly string[];
   fields: readonly PublicCafe24Field[];
+  /**
+   * Cafe24 partner-approval marker. Present iff backend metadata declares
+   * `restrictedApproval` for this operation. Frontend renders a ⚠ badge
+   * + tooltip when set. SoT: `spec/conventions/cafe24-restricted-scopes.md`.
+   */
+  restrictedApproval?: Cafe24RestrictedApproval;
 }
 
 export interface PublicCafe24OperationPlanned {
@@ -100,6 +107,9 @@ export function toPublicSupportedOperation(
     paginated: op.paginated === true,
     requiredFields: op.requiredFields,
     fields,
+    ...(op.restrictedApproval
+      ? { restrictedApproval: op.restrictedApproval }
+      : {}),
   };
 }
 

```

---

### 파일 10: backend/src/nodes/integration/cafe24/metadata/restricted-approval.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/restricted-approval.ts b/backend/src/nodes/integration/cafe24/metadata/restricted-approval.ts
new file mode 100644
index 00000000..890928a9
--- /dev/null
+++ b/backend/src/nodes/integration/cafe24/metadata/restricted-approval.ts
@@ -0,0 +1,135 @@
+import type { Cafe24RestrictedApproval } from './types.js';
+
+/**
+ * Shared partner-approval flags for the Cafe24 Admin API operations that
+ * Cafe24 only authorizes to specific clients. The canonical list lives in
+ * `spec/conventions/cafe24-restricted-scopes.md`; this module is the
+ * single place where backend metadata builders import the marker.
+ *
+ * Keep the `inquiryUrl` identical across groups so the UI message bucket
+ * stays consistent. Per-group `docsUrl` anchors the tooltip's deep link.
+ */
+const INQUIRY_URL = 'https://developers.cafe24.com';
+const SCOPE_GUIDE_URL =
+  'https://developers.cafe24.com/app/front/app/develop/api/scope';
+
+/**
+ * Cafe24 scope tokens whose OAuth consent itself requires partner approval.
+ * Used at runtime to decide whether to attach `requiresCafe24Approval` to
+ * an error response body (`INSUFFICIENT_SCOPE` / `oauth_invalid_scope`).
+ *
+ * Mirrors `spec/conventions/cafe24-restricted-scopes.md` §1 — keep these
+ * two lists in sync when the spec changes.
+ */
+export const SCOPE_LEVEL_RESTRICTED_SCOPES: ReadonlySet<string> = new Set([
+  'mall.read_mileage',
+  'mall.write_mileage',
+  'mall.read_notification',
+  'mall.write_notification',
+  'mall.read_privacy',
+  'mall.write_privacy',
+]);
+
+/**
+ * Filter an arbitrary list of scope tokens down to those that need Cafe24
+ * partner approval. Stable order, deduplicated. Returns `undefined` when
+ * no candidate scopes match — caller should omit the field entirely in
+ * that case so other-provider integrations stay clean.
+ */
+export function pickRestrictedApprovalScopes(
+  scopes: readonly string[] | undefined,
+): string[] | undefined {
+  if (!scopes || scopes.length === 0) return undefined;
+  const out: string[] = [];
+  const seen = new Set<string>();
+  for (const s of scopes) {
+    if (!s || seen.has(s)) continue;
+    seen.add(s);
+    if (SCOPE_LEVEL_RESTRICTED_SCOPES.has(s)) out.push(s);
+  }
+  return out.length > 0 ? out : undefined;
+}
+
+/**
+ * Extract `mall.read_<r>` / `mall.write_<r>` tokens from a free-form Cafe24
+ * error body (string or shallow object). Returns all tokens found, even
+ * those that do not match the restricted list — `pickRestrictedApprovalScopes`
+ * is the filter step.
+ */
+export function extractCafe24ScopeTokens(body: unknown): string[] {
+  const sources: string[] = [];
+  if (typeof body === 'string') {
+    sources.push(body);
+  } else if (body && typeof body === 'object') {
+    for (const v of Object.values(body as Record<string, unknown>)) {
+      if (typeof v === 'string') sources.push(v);
+      else if (v && typeof v === 'object') {
+        for (const inner of Object.values(v as Record<string, unknown>)) {
+          if (typeof inner === 'string') sources.push(inner);
+        }
+      }
+    }
+  }
+  const out: string[] = [];
+  const seen = new Set<string>();
+  const TOKEN_RE = /mall\.(?:read|write)_[a-z_]+/g;
+  for (const text of sources) {
+    let m: RegExpExecArray | null;
+    TOKEN_RE.lastIndex = 0;
+    while ((m = TOKEN_RE.exec(text)) !== null) {
+      const tok = m[0];
+      if (seen.has(tok)) continue;
+      seen.add(tok);
+      out.push(tok);
+    }
+  }
+  return out;
+}
+
+export const RESTRICTED_APPROVAL: Record<string, Cafe24RestrictedApproval> = {
+  // Scope-level — `mall.read_<r>` / `mall.write_<r>` itself needs approval
+  mileage: {
+    level: 'scope',
+    approvalGroup: 'mileage',
+    docsUrl: SCOPE_GUIDE_URL,
+    inquiryUrl: INQUIRY_URL,
+  },
+  notification: {
+    level: 'scope',
+    approvalGroup: 'notification',
+    docsUrl: SCOPE_GUIDE_URL,
+    inquiryUrl: INQUIRY_URL,
+  },
+  privacy: {
+    level: 'scope',
+    approvalGroup: 'privacy',
+    docsUrl: SCOPE_GUIDE_URL,
+    inquiryUrl: INQUIRY_URL,
+  },
+  // Operation-level — inside the general `mall.read_store`/`mall.write_store`
+  store_activitylogs: {
+    level: 'operation',
+    approvalGroup: 'activitylogs',
+    inquiryUrl: INQUIRY_URL,
+  },
+  store_menus: {
+    level: 'operation',
+    approvalGroup: 'menus',
+    inquiryUrl: INQUIRY_URL,
+  },
+  store_naverpay_setting: {
+    level: 'operation',
+    approvalGroup: 'naverpay_setting',
+    inquiryUrl: INQUIRY_URL,
+  },
+  store_kakaopay_setting: {
+    level: 'operation',
+    approvalGroup: 'kakaopay_setting',
+    inquiryUrl: INQUIRY_URL,
+  },
+  store_pg_settings: {
+    level: 'operation',
+    approvalGroup: 'pg_settings',
+    inquiryUrl: INQUIRY_URL,
+  },
+} as const;

```

---

### 파일 11: backend/src/nodes/integration/cafe24/metadata/store.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/store.ts b/backend/src/nodes/integration/cafe24/metadata/store.ts
index f40a795f..eb17c48a 100644
--- a/backend/src/nodes/integration/cafe24/metadata/store.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/store.ts
@@ -1,4 +1,5 @@
 import type { Cafe24OperationMetadata } from './types.js';
+import { RESTRICTED_APPROVAL } from './restricted-approval.js';
 
 export const storeOperations: Cafe24OperationMetadata[] = [
   {
@@ -66,6 +67,7 @@ export const storeOperations: Cafe24OperationMetadata[] = [
       shop_no: { type: 'number', location: 'query', default: 1 },
     },
     responseShape: 'list',
+    restrictedApproval: RESTRICTED_APPROVAL.store_pg_settings,
   },
   {
     id: 'paymentgateway_create',
@@ -89,6 +91,7 @@ export const storeOperations: Cafe24OperationMetadata[] = [
       authentication_key: { type: 'string', location: 'body' },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.store_pg_settings,
   },
   {
     id: 'paymentgateway_update',
@@ -106,6 +109,7 @@ export const storeOperations: Cafe24OperationMetadata[] = [
       authentication_key: { type: 'string', location: 'body' },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.store_pg_settings,
   },
   {
     id: 'paymentgateway_delete',
@@ -119,5 +123,6 @@ export const storeOperations: Cafe24OperationMetadata[] = [
       paymentgateway_id: { type: 'string', location: 'path' },
     },
     responseShape: 'single',
+    restrictedApproval: RESTRICTED_APPROVAL.store_pg_settings,
   },
 ];

```

---

### 파일 12: backend/src/nodes/integration/cafe24/metadata/types.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/metadata/types.ts b/backend/src/nodes/integration/cafe24/metadata/types.ts
index 88e69e8c..d9b798d2 100644
--- a/backend/src/nodes/integration/cafe24/metadata/types.ts
+++ b/backend/src/nodes/integration/cafe24/metadata/types.ts
@@ -27,6 +27,43 @@ export interface Cafe24FieldSpec {
 
 export type Cafe24ResponseShape = 'list' | 'single' | 'empty';
 
+/**
+ * `approvalGroup` (not `category`) intentionally — avoids collision with
+ * `Cafe24Resource` (the catalog category) and `Node.category` enum
+ * (`integration` / `logic` / `ai` / ...). Same anti-collision pattern as
+ * `scopeType` on `Cafe24OperationMetadata`.
+ *
+ * SoT for the actual list: `spec/conventions/cafe24-restricted-scopes.md`.
+ */
+export type Cafe24ApprovalGroup =
+  | 'mileage'
+  | 'notification'
+  | 'privacy'
+  | 'activitylogs'
+  | 'menus'
+  | 'naverpay_setting'
+  | 'kakaopay_setting'
+  | 'pg_settings'
+  | 'analytics';
+
+export interface Cafe24RestrictedApproval {
+  /**
+   * `scope`: the entire OAuth scope requires Cafe24 partner approval — all
+   * sibling operations in the same resource share the label.
+   * `operation`: only this single row needs approval (used inside the
+   * general `mall.read_store` / `mall.write_store` scope).
+   * `program`: a different track (e.g. Cafe24 Analytics) that is not part
+   * of the Admin API catalog — these rows are skipped by catalog-sync.
+   */
+  level: 'scope' | 'operation' | 'program';
+  /** UI message bucket. See `spec/conventions/cafe24-api-metadata.md` §2. */
+  approvalGroup: Cafe24ApprovalGroup;
+  /** Optional anchor in Cafe24 developer docs. */
+  docsUrl?: string;
+  /** Required link to the Cafe24 developer center inquiry form. */
+  inquiryUrl: string;
+}
+
 /**
  * `scopeType` (not `category`) intentionally — avoids collision with
  * `Node.category` enum (`integration` / `logic` / `ai` / ...).
@@ -44,6 +81,12 @@ export interface Cafe24OperationMetadata {
   fields: Record<string, Cafe24FieldSpec>;
   responseShape?: Cafe24ResponseShape;
   paginated?: boolean;
+  /**
+   * Cafe24 partner-approval requirement marker. When set, frontend renders
+   * a ⚠ badge + tooltip on the Operation dropdown / AI agent allowlist /
+   * scope checkboxes. SoT: `spec/conventions/cafe24-restricted-scopes.md`.
+   */
+  restrictedApproval?: Cafe24RestrictedApproval;
 }
 
 export type Cafe24Resource =

```

---

### 파일 13: frontend/src/app/(main)/integrations/[id]/scope-tab.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/app/(main)/integrations/[id]/scope-tab.tsx b/frontend/src/app/(main)/integrations/[id]/scope-tab.tsx
index 5c90f525..0ca6e22b 100644
--- a/frontend/src/app/(main)/integrations/[id]/scope-tab.tsx
+++ b/frontend/src/app/(main)/integrations/[id]/scope-tab.tsx
@@ -12,6 +12,10 @@ import {
 } from "@/lib/api/integrations";
 import { type TFunction } from "@/lib/i18n";
 import { openOAuthPopup } from "./open-oauth-popup";
+import {
+  ApprovalRequiredBadge,
+  RestrictedScopeNotice,
+} from "@/components/integrations/approval-required-badge";
 
 export function ScopeTab({
   integration,
@@ -34,6 +38,16 @@ export function ScopeTab({
     allOptions.length > 0
       ? allOptions.filter((s) => !currentScopes.includes(s.value))
       : [];
+  const approvalLookup = new Map(
+    allOptions.map((s) => [s.value, s.requiresApproval === true] as const),
+  );
+  // last_error.details.requiresCafe24Approval — backend (`markAuthFailed` 또는
+  // `markIntegrationCallbackError`) 가 별도 승인 명단 ∩ 누락 scope 교집합을 채움.
+  // spec/2-navigation/4-integration.md §9.4 / cafe24-restricted-scopes.md §4.3.
+  const requiresApprovalFromError =
+    (integration.lastError?.details as
+      | { requiresCafe24Approval?: string[] }
+      | undefined)?.requiresCafe24Approval ?? [];
 
   const [selected, setSelected] = useState<string[]>([]);
   const [cafe24Pending, setCafe24Pending] = useState<{
@@ -89,9 +103,10 @@ export function ScopeTab({
           {currentScopes.map((s) => (
             <li
               key={s}
-              className="rounded-full bg-[hsl(var(--muted))] px-2.5 py-1 text-xs"
+              className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] px-2.5 py-1 text-xs"
             >
               {s}
+              {approvalLookup.get(s) && <ApprovalRequiredBadge t={t} />}
             </li>
           ))}
         </ul>
@@ -106,12 +121,20 @@ export function ScopeTab({
             {missingScopes.map((s) => (
               <li
                 key={s.value}
-                className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800 dark:bg-red-900 dark:text-red-200"
+                className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800 dark:bg-red-900 dark:text-red-200"
               >
                 {s.value}
+                {s.requiresApproval && <ApprovalRequiredBadge t={t} />}
               </li>
             ))}
           </ul>
+          {requiresApprovalFromError.length > 0 && (
+            <p className="mt-2 text-xs text-red-900 dark:text-red-200">
+              {t("integrations.cafe24RestrictedApprovalApiError", {
+                scopes: requiresApprovalFromError.join(", "),
+              })}
+            </p>
+          )}
         </section>
       )}
 
@@ -172,10 +195,11 @@ export function ScopeTab({
                     disabled={isGranted}
                   />
                   <div className="flex-1">
-                    <div className="font-medium">
-                      {s.label}
+                    <div className="flex items-center gap-2 font-medium">
+                      <span>{s.label}</span>
+                      {s.requiresApproval && <ApprovalRequiredBadge t={t} />}
                       {isGranted && (
-                        <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
+                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                           {t("integrations.alreadyGranted")}
                         </span>
                       )}
@@ -189,6 +213,14 @@ export function ScopeTab({
             })
           )}
         </div>
+        <RestrictedScopeNotice
+          count={
+            allOptions.filter(
+              (s) => s.requiresApproval && selected.includes(s.value),
+            ).length
+          }
+          t={t}
+        />
         <div className="flex justify-end">
           <Button
             onClick={() => requestMutation.mutate()}

```

---

### 파일 14: frontend/src/app/(main)/integrations/new/page.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/app/(main)/integrations/new/page.tsx b/frontend/src/app/(main)/integrations/new/page.tsx
index db4189ec..5208b052 100644
--- a/frontend/src/app/(main)/integrations/new/page.tsx
+++ b/frontend/src/app/(main)/integrations/new/page.tsx
@@ -33,6 +33,10 @@ import { ServiceIcon } from "../_shared/service-icons";
 import { CredentialsForm } from "../_shared/credentials-form";
 import { useT, type TFunction, type TranslationKey } from "@/lib/i18n";
 import { useCafe24PendingPolling } from "@/lib/integrations/use-cafe24-pending-polling";
+import {
+  ApprovalRequiredBadge,
+  RestrictedScopeNotice,
+} from "@/components/integrations/approval-required-badge";
 
 interface OAuthCallbackPayload {
   type: "oauth_callback";
@@ -671,6 +675,7 @@ function AuthStep({
                     {s.value}
                   </div>
                 </div>
+                {s.requiresApproval && <ApprovalRequiredBadge t={t} />}
                 {s.recommended && (
                   <span className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                     {t("integrations.recommendedBadge")}
@@ -679,6 +684,14 @@ function AuthStep({
               </label>
             ))}
           </div>
+          <RestrictedScopeNotice
+            count={
+              service.scopes.filter(
+                (s) => s.requiresApproval && selectedScopes.includes(s.value),
+              ).length
+            }
+            t={t}
+          />
         </div>
       )}
 

```

---

### 파일 15: frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx b/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx
index 3532cb3d..621acbb2 100644
--- a/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx
+++ b/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx
@@ -481,7 +481,9 @@ export function Cafe24Config({
         },
         ...supportedListForResource.map((op) => ({
           value: op.id,
-          label: op.label,
+          label: op.restrictedApproval
+            ? `${op.label} ⚠ ${t("nodeConfigs.integration.cafe24OperationApprovalSuffix")}`
+            : op.label,
         })),
         ...plannedListForResource.map((op) => ({
           value: op.id,
@@ -550,6 +552,11 @@ export function Cafe24Config({
           {t("nodeConfigs.integration.cafe24OperationPlannedHint")}
         </p>
       )}
+      {supportedOp?.restrictedApproval && (
+        <p className="text-[10px] text-amber-700 dark:text-amber-300">
+          ⚠ {t("integrations.approvalRequiredTooltip")}
+        </p>
+      )}
       {!supportedOp && !plannedOp && operation && resource && extras && (
         <p className="text-[10px] text-amber-500">
           {t("nodeConfigs.integration.cafe24OperationUnknown")}

```

---

### 파일 16: frontend/src/components/integrations/approval-required-badge.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/components/integrations/approval-required-badge.tsx b/frontend/src/components/integrations/approval-required-badge.tsx
new file mode 100644
index 00000000..5e4f8da6
--- /dev/null
+++ b/frontend/src/components/integrations/approval-required-badge.tsx
@@ -0,0 +1,64 @@
+"use client";
+
+import { AlertTriangle } from "lucide-react";
+import { type TFunction } from "@/lib/i18n";
+
+/**
+ * Reusable ⚠ badge for Cafe24 partner-approval scopes/operations.
+ *
+ * Rendered next to scope checkbox labels (wizard Step 2 + integration
+ * detail Scope & Permissions tab) and next to Cafe24 node Operation
+ * dropdown rows (AI Agent allowlist). SoT for the underlying list:
+ * `spec/conventions/cafe24-restricted-scopes.md`.
+ */
+export function ApprovalRequiredBadge({ t }: { t: TFunction }) {
+  return (
+    <span
+      role="img"
+      aria-label={t("integrations.approvalRequiredBadge")}
+      title={t("integrations.approvalRequiredTooltip")}
+      className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900 dark:bg-amber-900/60 dark:text-amber-100"
+    >
+      <AlertTriangle aria-hidden="true" className="h-3 w-3" />
+      {t("integrations.approvalRequiredBadge")}
+    </span>
+  );
+}
+
+/**
+ * Inline notice rendered under a list of scope checkboxes when ≥1 of the
+ * selected items requires Cafe24 partner approval. Counts are computed by
+ * the caller — this component only renders the message + inquiry link.
+ */
+export function RestrictedScopeNotice({
+  count,
+  inquiryUrl = "https://developers.cafe24.com",
+  t,
+}: {
+  count: number;
+  inquiryUrl?: string;
+  t: TFunction;
+}) {
+  if (count <= 0) return null;
+  return (
+    <div
+      role="note"
+      className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
+    >
+      <p className="flex items-start gap-2">
+        <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
+        <span>
+          {t("integrations.cafe24RestrictedScopeNotice", { count })}{" "}
+          <a
+            href={inquiryUrl}
+            target="_blank"
+            rel="noreferrer"
+            className="underline underline-offset-2"
+          >
+            {t("integrations.approvalInquiryLink")}
+          </a>
+        </span>
+      </p>
+    </div>
+  );
+}

```

---

### 파일 17: frontend/src/lib/api/integrations.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/api/integrations.ts b/frontend/src/lib/api/integrations.ts
index e42a5e23..bc0117b8 100644
--- a/frontend/src/lib/api/integrations.ts
+++ b/frontend/src/lib/api/integrations.ts
@@ -50,7 +50,21 @@ export interface IntegrationDto {
   tokenExpiresAt: string | null;
   lastUsedAt: string | null;
   lastRotatedAt: string | null;
-  lastError: { code?: string; message?: string; at?: string } | Record<string, unknown> | null;
+  lastError:
+    | {
+        code?: string;
+        message?: string;
+        at?: string;
+        /**
+         * Free-form additional context per status_reason. Currently used by
+         * Cafe24 to carry `requiresCafe24Approval: string[]` when the
+         * underlying scope failure overlaps the partner-approval list.
+         * SoT: `spec/conventions/cafe24-restricted-scopes.md` §4.3.
+         */
+        details?: Record<string, unknown>;
+      }
+    | Record<string, unknown>
+    | null;
   meta: IntegrationMeta;
   /**
    * Cafe24 Private 통합 한정의 actionable URL. Cafe24 Developers Console
@@ -89,6 +103,12 @@ export interface ScopeOption {
   value: string;
   label: string;
   recommended?: boolean;
+  /**
+   * Cafe24 partner-approval marker — true when this scope requires explicit
+   * approval from Cafe24 before consent succeeds. Frontend renders a ⚠
+   * badge + tooltip. SoT: `spec/conventions/cafe24-restricted-scopes.md` §1.
+   */
+  requiresApproval?: boolean;
 }
 
 export interface ServiceDefinition {

```

---

### 파일 18: frontend/src/lib/i18n/dict/en/integrations.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/i18n/dict/en/integrations.ts b/frontend/src/lib/i18n/dict/en/integrations.ts
index 6c2004b6..c3fb26ea 100644
--- a/frontend/src/lib/i18n/dict/en/integrations.ts
+++ b/frontend/src/lib/i18n/dict/en/integrations.ts
@@ -152,6 +152,14 @@ export const integrations: Dict["integrations"] = {
   authTypeLabel2: "Authentication Type",
   oauthScopesLabel: "OAuth Scopes",
   recommendedBadge: "Recommended",
+  approvalRequiredBadge: "Approval required",
+  approvalRequiredTooltip:
+    "This permission requires Cafe24 partner approval. Without approval, the OAuth flow may reject it as invalid_scope, or API calls may return 403.",
+  approvalInquiryLink: "Contact Cafe24 Developer Center →",
+  cafe24RestrictedScopeNotice:
+    "{{count}} of your selected scopes require Cafe24 partner approval. Without approval, the OAuth flow or subsequent API calls may fail.",
+  cafe24RestrictedApprovalApiError:
+    "This permission requires Cafe24 partner approval — {{scopes}}",
   cafe24ScopeWarning:
     "Cafe24 only allows OAuth requests for scopes pre-registered on the app. Every scope you tick here must also be enabled at Cafe24 Developers → My App → Permissions (Scope) — if even one is missing, the OAuth call is rejected with invalid_scope. Start with a single scope and add more once it works.",
   cafe24PrivatePendingTitle: "Complete the Cafe24 Developers setup",

```

---

### 파일 19: frontend/src/lib/i18n/dict/en/nodeConfigs.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/i18n/dict/en/nodeConfigs.ts b/frontend/src/lib/i18n/dict/en/nodeConfigs.ts
index 681a4cc7..35c84d86 100644
--- a/frontend/src/lib/i18n/dict/en/nodeConfigs.ts
+++ b/frontend/src/lib/i18n/dict/en/nodeConfigs.ts
@@ -139,6 +139,7 @@ export const nodeConfigs: Dict["nodeConfigs"] = {
     cafe24OperationSelectPlaceholder: "— Select operation —",
     cafe24OperationSelectResourceFirst: "Select a resource first",
     cafe24OperationPlannedSuffix: "(coming soon)",
+    cafe24OperationApprovalSuffix: "Approval required",
     cafe24OperationCoverageHint:
       "{{ supported }} supported · {{ planned }} planned",
     cafe24OperationPlannedHint:

```

---

### 파일 20: frontend/src/lib/i18n/dict/ko/integrations.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/i18n/dict/ko/integrations.ts b/frontend/src/lib/i18n/dict/ko/integrations.ts
index 103e966c..f04df49b 100644
--- a/frontend/src/lib/i18n/dict/ko/integrations.ts
+++ b/frontend/src/lib/i18n/dict/ko/integrations.ts
@@ -150,6 +150,14 @@ export const integrations = {
   authTypeLabel2: "인증 유형",
   oauthScopesLabel: "OAuth 권한",
   recommendedBadge: "권장",
+  approvalRequiredBadge: "별도 승인",
+  approvalRequiredTooltip:
+    "카페24 본사 승인이 필요한 권한입니다. 미승인 상태로 동의를 시도하면 invalid_scope 로 실패하거나, 인증 후 호출 시 403 이 반환될 수 있어요.",
+  approvalInquiryLink: "Cafe24 개발자센터 문의 →",
+  cafe24RestrictedScopeNotice:
+    "선택한 권한 중 카페24 본사 승인이 필요한 항목이 있습니다 ({{count}}개). 미승인 상태로 진행하면 OAuth 또는 호출 단계에서 실패할 수 있어요.",
+  cafe24RestrictedApprovalApiError:
+    "이 권한은 카페24 별도 승인이 필요합니다 — {{scopes}}",
   cafe24ScopeWarning:
     "Cafe24 는 앱 설정에 사전 등록된 권한만 OAuth 요청을 허용해요. 선택한 권한이 Cafe24 Developers → 내 앱 → 사용 권한(Scope) 에 모두 체크돼 있어야 하며, 하나라도 누락되면 OAuth 가 invalid_scope 로 거부돼요. 처음에는 1개만 켜고 동작을 확인한 뒤 점진적으로 늘리길 권해요.",
   cafe24PrivatePendingTitle: "Cafe24 Developers 설정을 완료해 주세요",

```

---

### 파일 21: frontend/src/lib/i18n/dict/ko/nodeConfigs.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/i18n/dict/ko/nodeConfigs.ts b/frontend/src/lib/i18n/dict/ko/nodeConfigs.ts
index b0c38e19..1ee7b225 100644
--- a/frontend/src/lib/i18n/dict/ko/nodeConfigs.ts
+++ b/frontend/src/lib/i18n/dict/ko/nodeConfigs.ts
@@ -137,6 +137,7 @@ export const nodeConfigs = {
     cafe24OperationSelectPlaceholder: "— 작업 선택 —",
     cafe24OperationSelectResourceFirst: "리소스를 먼저 선택하세요",
     cafe24OperationPlannedSuffix: "(지원 예정)",
+    cafe24OperationApprovalSuffix: "별도 승인 필요",
     cafe24OperationCoverageHint:
       "지원 {{ supported }}개 · 추후 지원 {{ planned }}개",
     cafe24OperationPlannedHint:

```

---

### 파일 22: frontend/src/lib/node-definitions/types.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/node-definitions/types.ts b/frontend/src/lib/node-definitions/types.ts
index 0c231cde..faba08e7 100644
--- a/frontend/src/lib/node-definitions/types.ts
+++ b/frontend/src/lib/node-definitions/types.ts
@@ -221,6 +221,24 @@ export type Cafe24OperationField = {
   default?: unknown;
 };
 
+export type Cafe24ApprovalGroup =
+  | "mileage"
+  | "notification"
+  | "privacy"
+  | "activitylogs"
+  | "menus"
+  | "naverpay_setting"
+  | "kakaopay_setting"
+  | "pg_settings"
+  | "analytics";
+
+export type Cafe24RestrictedApproval = {
+  level: "scope" | "operation" | "program";
+  approvalGroup: Cafe24ApprovalGroup;
+  docsUrl?: string;
+  inquiryUrl: string;
+};
+
 export type Cafe24SupportedOperation = {
   status: "supported";
   id: string;
@@ -230,6 +248,11 @@ export type Cafe24SupportedOperation = {
   paginated: boolean;
   requiredFields: readonly string[];
   fields: readonly Cafe24OperationField[];
+  /**
+   * Cafe24 partner-approval marker — present iff backend metadata declared it.
+   * SoT: `spec/conventions/cafe24-restricted-scopes.md`.
+   */
+  restrictedApproval?: Cafe24RestrictedApproval;
 };
 
 export type Cafe24PlannedOperation = {

```

---

### 파일 23: plan/in-progress/cafe24-ai-agent-allowlist-ui.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/cafe24-ai-agent-allowlist-ui.md b/plan/in-progress/cafe24-ai-agent-allowlist-ui.md
new file mode 100644
index 00000000..00812a4a
--- /dev/null
+++ b/plan/in-progress/cafe24-ai-agent-allowlist-ui.md
@@ -0,0 +1,27 @@
+---
+worktree: TBD (follow-up)
+started: 2026-05-17
+owner: TBD
+type: follow-up
+---
+
+# PLAN: AI Agent allowlist UI 의 ⚠ 별도 승인 라벨링
+
+## 배경
+
+`spec/4-nodes/4-integration/4-cafe24.md §8.3` AI Agent allowlist UI 가 카테고리 단위 grouping 으로 enabledTools 를 편집할 때 카페24 별도 승인 대상 카테고리/operation 에 ⚠ 라벨을 노출해야 한다.
+
+현재 frontend (`components/integrations/mcp-server-selector.tsx`) 는 server (Integration) 단위 picker 만 제공하고 operation 단위 grouping UI 는 아직 advanced surface 로 구현 전. 본 PR (cafe24-restricted-scopes-a1b2c3) 의 범위 외로 분리.
+
+## 본 PR 에서 이미 준비된 것
+
+- backend `Cafe24OperationMetadata.restrictedApproval` + `public-meta.PublicCafe24OperationSupported.restrictedApproval` — frontend 가 사용 가능한 데이터는 이미 응답에 노출됨.
+- frontend `Cafe24SupportedOperation.restrictedApproval` 타입 + 공통 컴포넌트 `ApprovalRequiredBadge`, `RestrictedScopeNotice` — 신규 화면에서도 그대로 재사용.
+- i18n 키 (`integrations.approvalRequiredBadge` 등) — 이미 등록됨.
+
+## 작업 항목 (advanced surface 도입 시)
+
+- [ ] AI Agent allowlist UI 신설 (mcp-server-selector 에 expand 또는 별도 페이지)
+- [ ] 카테고리 단위 grouping — `restrictedApproval.level==='scope'` 면 그룹 헤더 ⚠
+- [ ] operation 단위 row — `restrictedApproval.level==='operation'` 면 행 단위 ⚠
+- [ ] 공통 컴포넌트 재사용

```

---

### 파일 24: plan/in-progress/cafe24-backlog-residual.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/cafe24-backlog-residual.md b/plan/in-progress/cafe24-backlog-residual.md
index 54cfc0a3..fa11d327 100644
--- a/plan/in-progress/cafe24-backlog-residual.md
+++ b/plan/in-progress/cafe24-backlog-residual.md
@@ -49,6 +49,7 @@ owner: developer (다음 진입자)
 - [ ] **E-1**: `buildIntegrationMeta` 직접 단위 테스트 — cafe24 외 serviceType / unreadable credentials 경계. (ai-review batch 2 W14)
 - [ ] **E-3**: `callbackContextOf` 단독 단위 테스트 — null/primitive 등 엣지. (이전 review Info 6)
 - [ ] **F-2**: `spec/2-navigation/4-integration.md §6` mermaid 에 `install_token` 보존 정책 명시 (data-flow §1.2.1 에는 이미 있음). (이전 review I3)
+  > ※ 같은 파일을 `plan/in-progress/cafe24-restricted-scopes.md` (worktree `cafe24-restricted-scopes-a1b2c3`) 가 §3.2 / §4.4 / §5 / §9.4 / §10.4 / Rationale 영역에서 동시 수정 중이다. consistency-check (`review/consistency/2026/05/17/12_12_46/`) W-8 으로 검출. **머지 순서 권장**: F-2 는 cafe24-restricted-scopes 가 main 에 머지된 후 착수 (영역은 §6 mermaid 로 분리되나 안전 확보).
 - [ ] **F-3**: `spec/conventions/swagger.md §2-4` 실재 확인 및 cross-link 정정. (이전 review I5)
 
 ## 처리 후

```

---

### 파일 25: plan/in-progress/cafe24-oauth-invalid-scope-handler.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/cafe24-oauth-invalid-scope-handler.md b/plan/in-progress/cafe24-oauth-invalid-scope-handler.md
new file mode 100644
index 00000000..b8732eff
--- /dev/null
+++ b/plan/in-progress/cafe24-oauth-invalid-scope-handler.md
@@ -0,0 +1,40 @@
+---
+worktree: TBD (follow-up — 별도 worktree)
+started: 2026-05-17
+owner: TBD
+type: follow-up
+parent_session: review/consistency/2026/05/17/12_37_41/
+---
+
+# PLAN: OAuth `invalid_scope` callback 분기 backend 구현
+
+## 배경
+
+`spec/2-navigation/4-integration.md §10.4` 에 신설된 `Cafe24 invalid_scope` 에러 매핑 행은 다음을 명세:
+
+- Cafe24 가 `?error=invalid_scope` 로 callback redirect 했을 때 `Integration.statusReason='oauth_invalid_scope'` + `last_error.details.requiresCafe24Approval: string[]` 기록
+- frontend 가 통합 상세 페이지에서 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지 노출
+
+`spec/1-data-model.md §2.10` 의 status_reason enum 에 `oauth_invalid_scope` 추가됨 (PR cafe24-restricted-scopes-a1b2c3 에서 완료).
+
+## 본 PR 에서 제외한 이유
+
+`integration-oauth.service.ts handleCallback` 의 `query.error` 분기 (현재 `OAUTH_DENIED` 단일 매핑) 를 `invalid_scope` 만 별도로 분기하려면 다음이 필요:
+
+- state row 를 invalid_scope 케이스에서만 소비해 `integrationId` + `requestedScopes` 식별
+- `handleCallbackWithErrorCapture` 가 새 errorCode `OAUTH_INVALID_SCOPE` 를 받아 `requestedScopes ∩ restricted 명단` 을 `markIntegrationCallbackError` 의 `extra` 인자로 전달
+- `markIntegrationCallbackError` 의 statusReason 매핑에 `OAUTH_INVALID_SCOPE → 'oauth_invalid_scope'` 추가 (현재 일반 lowercase 매핑은 normalize 단계에서 unknown_error 로 fallback)
+
+상기 변경은 OAuth 콜백 전체 흐름의 분기를 손대는 작업이라 본 PR (안내 메타데이터 + UI 라벨링) 의 의도와 변경 범위가 다르다. 호출 단계의 `INSUFFICIENT_SCOPE` 보강 (`cafe24-api.client.ts markAuthFailed` 의 `requiresCafe24Approval` 추가) 만으로도 사용자가 위저드 체크 → OAuth 통과 → 호출 시 403 시점에서 안내를 받을 수 있어 UX 의 가치 대부분이 확보된다.
+
+## 작업 항목
+
+- [ ] `handleCallback` 에서 `query.error === 'invalid_scope'` 분기 추가 + state 소비 + context 첨부 throw
+- [ ] `handleCallbackWithErrorCapture` 에서 OAUTH_INVALID_SCOPE 시 state 의 requestedScopes 를 읽어 `pickRestrictedApprovalScopes` 호출 + `markIntegrationCallbackError({ requiresCafe24Approval })` 호출
+- [ ] `markIntegrationCallbackError` 의 statusReason 매핑에 명시적 분기 추가 (`oauth_invalid_scope`)
+- [ ] integration-oauth.service.cafe24.spec.ts 에 케이스 추가
+- [ ] frontend: 통합 상세 페이지가 `Integration.statusReason==='oauth_invalid_scope'` + `last_error.details.requiresCafe24Approval` 를 읽어 분기 메시지 노출 (별도 컴포넌트 — 이미 본 PR 에서 INSUFFICIENT_SCOPE 메시지를 만들었다면 재사용)
+
+## 비목표
+
+- 새 에러 코드 추가 (사용자 facing UX 는 status_reason + details 로 충분)

```

---

### 파일 26: plan/in-progress/cafe24-restricted-scopes.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/cafe24-restricted-scopes.md b/plan/in-progress/cafe24-restricted-scopes.md
new file mode 100644
index 00000000..25eb8349
--- /dev/null
+++ b/plan/in-progress/cafe24-restricted-scopes.md
@@ -0,0 +1,153 @@
+---
+worktree: cafe24-restricted-scopes-a1b2c3
+started: 2026-05-17
+owner: project-planner → developer
+---
+
+# PLAN: Cafe24 별도 승인 scope/operation 식별·안내 장치
+
+## 1. 배경
+
+Cafe24 Admin API 중 일부 scope·operation 은 카페24 본사가 별도 승인한 클라이언트만 사용할 수 있다 (공식 문서 안내 — `"해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요."`). 현 spec/구현에는 이를 표현하는 차원이 없어:
+
+1. 사용자가 통합 추가 위저드에서 mileage / notification / privacy 카테고리를 일반 카테고리처럼 체크 → `invalid_scope` 또는 호출 시 `INSUFFICIENT_SCOPE (403)` 으로 좌초. 원인이 "별도 승인 부재" 라는 점을 안내해 줄 장치 없음.
+2. `mall.read_store` 같이 일반 권한 안에 일부 sub-resource (Activitylogs, Menus, Naverpay/Kakaopay setting, PG settings 등) 만 별도 승인 대상인 케이스가 있어 **scope 단위 라벨링** 외에 **operation 단위 라벨링**도 필요하다.
+3. Cafe24 Analytics API 는 **별도 프로그램 승인**이 필요한 전혀 다른 트랙. (현 spec 범위 외이나 placeholder 등재 — 향후 도입 시 동일 메타데이터 차원 재사용)
+
+## 2. 목표 (Outcome)
+
+- Cafe24 별도 승인 대상이 **메타데이터 SoT 한 곳에 등재**되어 UI/노드/AI Agent/에러 메시지로 자동 전파된다.
+- 위저드 Scope 체크박스, 통합 상세 §4.4 Scope & Permissions, Cafe24 노드 Operation 드롭다운, AI Agent allowlist UI 4 군데에서 **동일 ⚠ 배지·tooltip** 으로 노출된다.
+- 사용자는 체크 시점에 별도 승인 필요 사실을 인지하고, OAuth 또는 호출 단계에서 실패하더라도 원인을 안내받는다.
+- 차단은 하지 않는다 (이미 승인받은 사용자도 있을 수 있음) — "알고 누른다" 보장.
+
+## 3. 영향 범위 (spec)
+
+| 파일 | 변경 |
+|------|------|
+| `spec/conventions/cafe24-restricted-scopes.md` | **신설** — 별도 승인 대상 scope/operation/program SoT 표 |
+| `spec/conventions/cafe24-api-metadata.md` | `Cafe24OperationMetadata.restrictedApproval?` optional 필드 형식 추가 (§2 갱신) + §5 추가 절차에 카탈로그 row 의 `restricted` 컬럼 갱신 단계 추가 + CHANGELOG |
+| `spec/conventions/cafe24-api-catalog/_overview.md` | §2 표 컬럼 정의에 `restricted` 컬럼 추가 + §4 동기 정책에 검증 규칙 추가 + Coverage Matrix 또는 별표 + CHANGELOG |
+| `spec/conventions/cafe24-api-catalog/mileage.md` | scope 단위 restricted 표기 (전체 row) |
+| `spec/conventions/cafe24-api-catalog/notification.md` | scope 단위 restricted 표기 (전체 row) |
+| `spec/conventions/cafe24-api-catalog/privacy.md` | scope 단위 restricted 표기 (전체 row) |
+| `spec/conventions/cafe24-api-catalog/store.md` | operation 단위 restricted 표기 (영향 row 만: paymentgateway_*, paymentgateway_paymentmethods_*, naverpay_setting_*, kakaopay_setting_*, menus_*, activitylogs_*, financials_paymentgateway_get) |
+| `spec/2-navigation/4-integration.md` | §5 Scope 권장 프리셋 표에 "별도 승인" 컬럼; §3.2 Cafe24 Public/Private Step 2 폼 안내 추가; §4.4 Scope & Permissions 탭 ⚠ 배지 노출; §9.4 `INSUFFICIENT_SCOPE` 응답에 `details.requiresCafe24Approval: string[]` 보강 필드; Rationale 항목 신설 |
+| `spec/4-nodes/4-integration/4-cafe24.md` | §2 설정 UI 의 Operation 드롭다운 라벨링, §8.3 allowlist UI 의 ⚠ 배지 노출 명세 추가, Rationale 항목 신설 |
+
+## 4. 의사결정 (정책)
+
+- **차원**: 메타데이터 필드 `restrictedApproval` (optional)
+  ```ts
+  restrictedApproval?: {
+    level: 'scope' | 'operation' | 'program';
+    category:
+      | 'mileage' | 'notification' | 'privacy'         // scope 전체
+      | 'activitylogs' | 'menus' | 'pg_settings'        // operation 단위 (store 안)
+      | 'naverpay_setting' | 'kakaopay_setting'
+      | 'analytics';                                     // 별도 프로그램 (placeholder)
+    docsUrl?: string;
+    inquiryUrl: string;
+  };
+  ```
+- **카탈로그 표 컬럼**: `restricted` 추가. 값 enum:
+  - `scope` — scope 전체가 승인 대상이라 자기 자신과 자매 row 모두 영향
+  - `op` — 같은 scope 안에서 본 row 만 승인 대상 (store 케이스)
+  - (빈칸) — 일반 사용 가능
+- **scope 단위 매핑** (mileage/notification/privacy resource 의 모든 supported row):
+  - 카탈로그 row 의 `restricted` 컬럼 = `scope`
+  - backend 메타데이터 row 의 `restrictedApproval.level = 'scope'`
+  - 동일 resource 의 모든 operation 이 자동으로 같은 라벨을 받도록 한다.
+- **operation 단위 매핑** (store resource 안):
+  - 영향 row 만 `restricted: op` 라벨 (다른 store row 는 그대로 빈칸)
+  - 백엔드는 row 별 `restrictedApproval.level = 'operation'`
+- **차단 정책**: 체크/저장 차단 없음. UI ⚠ 배지 + 경고 배너 + tooltip 만 노출. 사용자가 인지하고 진행.
+- **에러 메시지 보강**: `INSUFFICIENT_SCOPE (403)` 응답 `details` 에 `requiresCafe24Approval: string[]` (사용자가 요청했던 scope/operation 중 별도 승인이 필요한 항목 목록). 신규 에러 코드는 추가하지 않음 (하위 호환).
+- **OAuth `invalid_scope` 처리**: backend 의 OAuth callback 핸들러가 Cafe24 응답을 파싱 후 요청 scopes ∩ restricted 명단의 교집합을 `status_reason='oauth_invalid_scope'` 와 함께 `last_error.details.requiresCafe24Approval` 로 기록 → 통합 상세 페이지에서 안내. (단, OAuth begin 단계의 사전 검증은 하지 않음 — 사용자가 이미 알고 누를 수 있게 안내만)
+- **i18n**: 한국어/영어 메시지 2종 (기존 통합 spec 의 i18n 관용에 맞춤).
+
+## 5. 작업 순서 (체크리스트)
+
+### Spec phase (project-planner) — 완료
+
+- [x] worktree 생성 (`.claude/worktrees/cafe24-restricted-scopes-a1b2c3`) — 본 plan
+- [x] **`/consistency-check --spec`** 호출 — `review/consistency/2026/05/17/12_12_46/` (BLOCK: NO, WARNING 10건 — 모두 spec 반영 단계에서 흡수)
+- [x] `spec/conventions/cafe24-restricted-scopes.md` 신설 (사용자 제공 3개 표 등재 + ## Rationale 섹션 — W-9)
+- [x] `spec/conventions/cafe24-api-metadata.md` §2 + §5 + CHANGELOG (W-4: `category` 묶음 매핑 표 + W-5: `level='program'` 검증 제외 명시)
+- [x] `spec/conventions/cafe24-api-catalog/_overview.md` §2 + §4 + CHANGELOG (I-3: status 직교 명시 + W-5: program 제외 규칙)
+- [x] `spec/conventions/cafe24-api-catalog/mileage.md` 표 row 갱신 (scope 단위, 8 row)
+- [x] `spec/conventions/cafe24-api-catalog/notification.md` 표 row 갱신 (scope 단위, 12 row)
+- [x] `spec/conventions/cafe24-api-catalog/privacy.md` 표 row 갱신 (scope 단위, 6 row)
+- [x] `spec/conventions/cafe24-api-catalog/store.md` 표 row 갱신 (operation 단위, 16 row, 나머지 빈칸)
+- [x] `spec/2-navigation/4-integration.md` §3.2 / §4.4 / §5 / §9.4 / §10.4 / Rationale (W-1·W-3·I-12 흡수)
+- [x] `spec/4-nodes/4-integration/4-cafe24.md` §2 / §8.3 / §9.11 Rationale / CHANGELOG
+- [x] `spec/1-data-model.md` §2.10 Integration.status_reason 에 `oauth_invalid_scope` 추가 + `last_error` 스키마에 `details?` 확장 (W-1, W-2)
+- [x] `plan/in-progress/cafe24-backlog-residual.md` F-2 와 cross-reference (W-8)
+
+### Implementation phase (developer)
+
+- [ ] `/consistency-check --impl-prep` (구현 착수 직전 의무)
+- [ ] backend: `Cafe24OperationMetadata` 타입에 `restrictedApproval` 필드 추가
+- [ ] backend: 영향 resource (mileage / notification / privacy / store) 메타데이터 row 에 `restrictedApproval` 채움
+- [ ] backend: `catalog-sync.spec.ts` 에 카탈로그 `restricted` 컬럼 ↔ 메타데이터 `restrictedApproval` 양방향 동기 검증 규칙 추가
+- [ ] backend: `oauth/begin` 응답 또는 services 메타데이터에 restricted 정보 노출 (frontend 가 ⚠ 배지를 렌더하기 위함)
+- [ ] backend: `INSUFFICIENT_SCOPE` 에러 응답에 `details.requiresCafe24Approval` 채움
+- [ ] backend: Cafe24 OAuth callback 의 `invalid_scope` 분기에 status_reason + last_error.details.requiresCafe24Approval 기록
+- [ ] frontend: ⚠ 배지 공통 컴포넌트 (Cafe24ScopeRestrictionBadge or 유사)
+- [ ] frontend: 통합 추가 위저드 Step 2 Cafe24 폼 — 카테고리 옆 ⚠ + 경고 배너
+- [ ] frontend: 통합 상세 §4.4 Scope & Permissions 탭 — 같은 컴포넌트 재사용
+- [ ] frontend: Cafe24 노드 설정 UI Operation 드롭다운 — 같은 컴포넌트
+- [ ] frontend: AI Agent allowlist UI — 같은 컴포넌트
+- [ ] frontend: `INSUFFICIENT_SCOPE` 응답 처리 시 `requiresCafe24Approval` 가 채워져 있으면 "별도 승인 필요" 분기 메시지
+- [ ] frontend: i18n 한/영 번역 키
+- [ ] tests: unit + integration (메타데이터 동기, OAuth 에러 분기, frontend snapshot/RTL)
+- [ ] **`/ai-review`** 사후 호출 → SUMMARY 반영
+
+## 6. 사용자 제공 자료 (factual sources)
+
+### 6.1 Scope 전체 별도 승인
+
+| Scope | 설명 |
+|---|---|
+| `mall.read_mileage` | 적립금 조회 |
+| `mall.write_mileage` | 적립금 수정 |
+| `mall.read_notification` | 알림 조회 |
+| `mall.write_notification` | 알림 발송 |
+| `mall.read_privacy` | 개인정보 조회 |
+| `mall.write_privacy` | 개인정보 수정 |
+
+### 6.2 store scope 안의 operation 단위 별도 승인
+
+| Operation 영역 | Scope | 설명 |
+|---|---|---|
+| Activitylogs | `mall.read_store` | 활동 로그 목록/상세 조회 |
+| Financials paymentgateway | `mall.read_store` | PG사 계약정보 조회 |
+| Menus | `mall.read_store` | 메뉴 모드/경로 조회 |
+| Naverpay setting | `mall.read_store` / `mall.write_store` | 네이버페이 설정 조회·등록·수정 |
+| Kakaopay setting | `mall.read_store` / `mall.write_store` | 카카오페이 설정 조회·수정 |
+| Paymentgateway | `mall.read_store` / `mall.write_store` | PG 생성·수정·삭제 |
+| Paymentgateway paymentmethods | `mall.read_store` / `mall.write_store` | PG 결제수단 생성·수정·삭제 |
+
+### 6.3 별도 프로그램 승인
+
+| API | 설명 |
+|---|---|
+| Cafe24 Analytics API | 카페24 승인 제휴사에만 제공. 쇼핑몰 사용자 행동 데이터 제공 서비스 제작 용도 (현 spec 범위 외 — placeholder 등재) |
+
+### 6.4 참고 링크
+
+- Cafe24 Admin API 공식 문서: https://developers.cafe24.com/docs/api/admin/
+- Scope별 사용 동의 가이드: https://developers.cafe24.com/app/front/app/develop/api/scope
+- Cafe24 Analytics API: https://developers.cafe24.com/docs/ko/api/cafe24data/
+- 카페24 개발자센터 문의: https://developers.cafe24.com
+
+## 6.5 동시 수정 인지 (W-8 cross-reference)
+
+같은 `spec/2-navigation/4-integration.md` 를 `plan/in-progress/cafe24-backlog-residual.md` 의 **F-2** 항목 (§6 mermaid `install_token` 보존 정책 명시) 이 별도로 수정 대상으로 들고 있다. consistency-check (`review/consistency/2026/05/17/12_12_46/`) W-8 으로 검출되어 양쪽 plan 에 상호 인식을 명시한다. 본 plan 이 먼저 main 머지 → F-2 후행 권장 (영역 분리: 본 plan 은 §3.2/§4.4/§5/§9.4/§10.4/Rationale, F-2 는 §6 mermaid — 라인 충돌 가능성 낮지만 머지 순서로 안전 확보).
+
+## 7. 비목표 (Out of scope)
+
+- Cafe24 Analytics API 실제 구현 — placeholder 등재만. 실제 호출 경로는 별도 plan.
+- OAuth begin 단계에서 restricted scope 사용을 사전 차단 — 본 plan 은 "안내만, 차단 없음" 정책.
+- 카페24 본사 승인을 자동화 — 사용자가 직접 개발자센터 문의 진행.
+- mileage resource 안의 `credits_*` (예치금) 가 정확히 `mall.read_mileage` 를 쓰는지 vs 별도 scope 인지의 검증 — 사용자 자료 기준으로는 mileage resource 전체를 scope-level restricted 로 다룬다. 향후 카페24 공식 문서로 분리 확인되면 별도 plan 으로 정정.

```

---

### 파일 27: plan/in-progress/cafe24-store-privacy-prefix-rename.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/cafe24-store-privacy-prefix-rename.md b/plan/in-progress/cafe24-store-privacy-prefix-rename.md
new file mode 100644
index 00000000..9f6b5cda
--- /dev/null
+++ b/plan/in-progress/cafe24-store-privacy-prefix-rename.md
@@ -0,0 +1,35 @@
+---
+worktree: TBD (follow-up — 본 작업은 별도 worktree 에서 진행 권장)
+started: 2026-05-17
+owner: TBD
+type: follow-up
+parent_session: review/consistency/2026/05/17/12_37_41/ (W-7)
+---
+
+# PLAN: store 카탈로그의 `privacy_*` planned operation id 재명명
+
+## 배경
+
+impl-prep consistency-check (`review/consistency/2026/05/17/12_37_41/` W-7) 가 `spec/conventions/cafe24-api-catalog/store.md` 의 6 planned row 가 `privacy_` 접두사를 사용해 별개 resource 인 `privacy.md` 와 명명 혼동을 유발한다고 지적.
+
+영향 row (모두 `status=planned`):
+
+- `privacy_boards_get` / `privacy_boards_update`
+- `privacy_join_get` / `privacy_join_update`
+- `privacy_orders_get` / `privacy_orders_update`
+
+## 결정 필요 사항
+
+1. 새 prefix 선택 — `store_privacy_*` (resource prefix 유지) vs `policy_privacy_*` (정책 그룹 명시) vs 기타.
+2. catalog row 갱신 + 향후 backend 메타데이터 row 추가 시 일관성 유지.
+3. `cafe24-restricted-scopes.md` / `cafe24-api-metadata.md` 본문에 별도 영향 없음 (별도 승인 대상 아님 — 일반 store scope).
+
+## 진행 조건
+
+- 본 작업은 본 worktree 의 spec 변경에 종속되지 않음 (별도 worktree 에서 가능).
+- `cafe24-restricted-scopes-a1b2c3` PR 머지 후 진행 권장 (catalog 표 수정 충돌 회피).
+
+## 비목표
+
+- backend 메타데이터 변경 — 본 6 row 가 planned 라 backend metadata 미존재.
+- 다른 resource 의 명명 일관성 점검 — 별도 plan.

```

---

### 파일 28: plan/in-progress/spec-draft-cafe24-restricted-scopes.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/spec-draft-cafe24-restricted-scopes.md b/plan/in-progress/spec-draft-cafe24-restricted-scopes.md
new file mode 100644
index 00000000..f78e21e9
--- /dev/null
+++ b/plan/in-progress/spec-draft-cafe24-restricted-scopes.md
@@ -0,0 +1,431 @@
+---
+worktree: cafe24-restricted-scopes-a1b2c3
+started: 2026-05-17
+owner: project-planner
+type: spec-draft
+target_specs:
+  - spec/conventions/cafe24-restricted-scopes.md (NEW)
+  - spec/conventions/cafe24-api-metadata.md
+  - spec/conventions/cafe24-api-catalog/_overview.md
+  - spec/conventions/cafe24-api-catalog/mileage.md
+  - spec/conventions/cafe24-api-catalog/notification.md
+  - spec/conventions/cafe24-api-catalog/privacy.md
+  - spec/conventions/cafe24-api-catalog/store.md
+  - spec/2-navigation/4-integration.md
+  - spec/4-nodes/4-integration/4-cafe24.md
+---
+
+# SPEC DRAFT: Cafe24 별도 승인 scope/operation 식별 메타데이터 도입
+
+본 draft 는 `/consistency-check --spec` 사전 검토용 변경안 본문이다. 승인 후 각 target_spec 에 반영한다.
+
+---
+
+## D1. NEW — `spec/conventions/cafe24-restricted-scopes.md`
+
+```markdown
+# CONVENTION: Cafe24 별도 승인이 필요한 Scope · Operation
+
+> 관련 문서: [Cafe24 API Metadata 컨벤션](./cafe24-api-metadata.md) · [Cafe24 API Catalog](./cafe24-api-catalog/_overview.md) · [Spec 통합 화면 §5.8 Cafe24](../2-navigation/4-integration.md#58-cafe24)
+
+Cafe24 Admin API 의 일부 scope·operation 은 카페24 본사가 별도로 승인한 클라이언트만 사용할 수 있다. 공식 문서가 다음 문구로 명시한다:
+
+> "해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요."
+
+본 컨벤션은 그 명단을 single-source-of-truth 로 박제한다. backend 메타데이터의 `restrictedApproval` 필드 (cafe24-api-metadata 컨벤션 §2) 와 catalog 파일의 `restricted` 컬럼 (cafe24-api-catalog _overview §2) 이 본 명단과 일치해야 하며, `catalog-sync.spec.ts` 가 동기 검증을 강제한다.
+
+---
+
+## 1. Scope 단위 별도 승인 (resource 전체 영향)
+
+해당 scope 가 부여된 OAuth 동의 자체가 본사 승인 없이는 실패한다. 자매 operation 모두 영향을 받는다.
+
+| Scope | Resource (catalog 파일) | 설명 |
+|---|---|---|
+| `mall.read_mileage` | [mileage.md](./cafe24-api-catalog/mileage.md) | 적립금 조회 |
+| `mall.write_mileage` | [mileage.md](./cafe24-api-catalog/mileage.md) | 적립금 수정 |
+| `mall.read_notification` | [notification.md](./cafe24-api-catalog/notification.md) | 알림 조회 |
+| `mall.write_notification` | [notification.md](./cafe24-api-catalog/notification.md) | 알림 발송 |
+| `mall.read_privacy` | [privacy.md](./cafe24-api-catalog/privacy.md) | 개인정보 조회 |
+| `mall.write_privacy` | [privacy.md](./cafe24-api-catalog/privacy.md) | 개인정보 수정 |
+
+> 위 카탈로그의 모든 row 는 catalog 표의 `restricted` 컬럼 = `scope`, backend 메타데이터의 `restrictedApproval.level='scope'` 로 표기된다.
+
+## 2. Operation 단위 별도 승인 (store scope 안의 일부)
+
+`mall.read_store` / `mall.write_store` 자체는 일반 사용 가능하지만, 안의 일부 operation 만 별도 승인 대상이다. 카탈로그 표에서 해당 row 만 `restricted: op` 로 표기한다.
+
+| 영역 | 영향 operation id (catalog [store.md](./cafe24-api-catalog/store.md)) | 설명 |
+|---|---|---|
+| Activitylogs | `activitylogs_list`, `activitylogs_get` | 활동 로그 목록/상세 조회 |
+| Financials paymentgateway | `financials_paymentgateway_get` | PG사 계약정보 조회 |
+| Menus | `menus_get` | 메뉴 조회 |
+| Naverpay setting | `naverpay_setting_get`, `naverpay_setting_create`, `naverpay_setting_update` | 네이버페이 설정 조회·등록·수정 |
+| Kakaopay setting | `kakaopay_setting_get`, `kakaopay_setting_update` | 카카오페이 설정 조회·수정 |
+| Paymentgateway | `paymentgateway_create`, `paymentgateway_update`, `paymentgateway_delete` | PG 생성·수정·삭제 |
+| Paymentgateway paymentmethods | `paymentgateway_paymentmethods_list`, `paymentgateway_paymentmethods_create`, `paymentgateway_paymentmethods_update`, `paymentgateway_paymentmethods_delete` | PG 결제수단 목록/생성·수정·삭제 |
+
+## 3. 별도 프로그램 승인
+
+카페24 승인 제휴사에만 제공되는 별도 트랙. 본 프로젝트는 현재 직접 호출 경로를 구현하지 않으며, 본 명단은 향후 도입을 위한 placeholder 다.
+
+| API | 설명 |
+|---|---|
+| Cafe24 Analytics API | 카페24 승인 제휴사에만 제공. 쇼핑몰 사용자 행동 데이터 제공 서비스 제작 용도 |
+
+## 4. 사용 정책
+
+### 4.1 사용자 안내 (UI)
+
+위 §1·§2 의 항목은 다음 4 화면에서 동일한 ⚠ 배지·tooltip 으로 표기된다:
+
+1. **통합 추가 위저드 Step 2 Scope 체크박스** (Spec 통합 화면 §3.2 Cafe24 Public/Private)
+2. **통합 상세 §4.4 Scope & Permissions 탭** (현재 scope · 권장 scope · 누락 scope 모두)
+3. **Cafe24 노드 Operation 드롭다운** (Spec Cafe24 노드 §2)
+4. **AI Agent allowlist UI** (Spec Cafe24 노드 §8.3, Spec MCP Client §5.6)
+
+배지 hover 시 tooltip 문구 (한국어):
+
+> "카페24 본사 승인이 필요한 권한입니다. 미승인 상태로 동의를 시도하면 `invalid_scope` 로 실패하거나, 인증 후 호출 시 403 이 반환될 수 있어요. [Cafe24 개발자센터 문의 →]"
+
+영어 (i18n):
+
+> "This permission requires Cafe24 partner approval. Without approval, the OAuth flow may reject it as `invalid_scope`, or API calls may return 403. [Contact Cafe24 Developer Center →]"
+
+### 4.2 차단 정책
+
+체크/저장은 **차단하지 않는다**. 이미 본사 승인을 받은 사용자가 있을 수 있으므로 "알고 누른다" 만 보장. 단 체크된 권한 중 별도 승인 필요 항목이 1개 이상이면 위저드 Step 2 폼 하단에 **영구 amber 경고 배너**를 띄운다 (사용자가 인지하지 못한 채 진행하는 사례 차단).
+
+### 4.3 에러 안내 (에러 발생 후)
+
+- **OAuth `invalid_scope`**: backend 의 cafe24 OAuth callback 이 응답을 파싱 후 요청한 scopes ∩ 본 명단 §1 의 교집합이 비어있지 않으면 `Integration.status_reason='oauth_invalid_scope'` 와 함께 `last_error.details.requiresCafe24Approval: string[]` 에 영향 scope 를 기록. 통합 상세 페이지가 본 단서를 읽어 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지 노출.
+- **노드 실행 중 `INSUFFICIENT_SCOPE (403)`**: 응답 `details.requiresCafe24Approval: string[]` 에 사용 scope ∩ 본 명단의 교집합을 채워 보낸다. frontend 가 본 필드가 비어있지 않으면 별도 승인 안내 분기 메시지를 노출.
+
+### 4.4 신규 코드 추가 없음
+
+기존 `OAuth invalid_scope` 분기, `INSUFFICIENT_SCOPE (403)` 응답 모두 그대로 유지하고 `details.requiresCafe24Approval` 보강 필드로만 표현. 새 HTTP 상태/에러 코드 vocabulary 추가는 하지 않는다 (하위 호환).
+
+## 5. 명단 갱신 절차
+
+1. Cafe24 공식 문서를 다시 확인해 본 명단의 진위·추가/삭제를 검증.
+2. 본 문서의 §1·§2·§3 표 갱신.
+3. 영향받는 catalog 파일 (`mileage.md` / `notification.md` / `privacy.md` / `store.md` / 추가 영향 resource) 의 `restricted` 컬럼 갱신.
+4. backend 메타데이터의 `restrictedApproval` 필드 동시 갱신.
+5. `npm test --workspace backend -- catalog-sync` 로 양방향 동기 확인.
+6. UI 4 화면에서 ⚠ 표기가 새 명단을 따라 자동 갱신되는지 시각 회귀 (해당 컴포넌트는 메타데이터 기반 자동 렌더링).
+
+## 6. 참고 링크
+
+- Cafe24 Admin API 공식 문서: https://developers.cafe24.com/docs/api/admin/
+- Scope별 사용 동의 가이드: https://developers.cafe24.com/app/front/app/develop/api/scope
+- Cafe24 Analytics API: https://developers.cafe24.com/docs/ko/api/cafe24data/
+- 카페24 개발자센터 문의: https://developers.cafe24.com
+
+## 7. CHANGELOG
+
+| 일자 | 변경 |
+|------|------|
+| 2026-05-17 | 신규 컨벤션 — 사용자 보고 (질문에서 제공한 표) 와 공식 문서 안내 문구를 기반으로 별도 승인 대상 명단 정식 등재. backend 메타데이터 `restrictedApproval` 필드 + catalog `restricted` 컬럼과 함께 도입. consistency-check 세션: (예정). |
+```
+
+---
+
+## D2. EDIT — `spec/conventions/cafe24-api-metadata.md`
+
+### D2.1 §2 Operation 메타데이터 형식 — 필드 추가
+
+기존 인터페이스 정의 (§2) 의 끝에 추가:
+
+```diff
+  responseShape?: 'list' | 'single' | 'empty';
+  paginated?: boolean;
++
++  // 별도 승인 라벨링 — [cafe24-restricted-scopes 컨벤션](./cafe24-restricted-scopes.md)
++  // 의 명단과 일치해야 하며, catalog-sync.spec.ts 가 카탈로그 row 의
++  // `restricted` 컬럼과 양방향 동기를 검증한다.
++  restrictedApproval?: {
++    level: 'scope' | 'operation' | 'program';
++    category:
++      | 'mileage' | 'notification' | 'privacy'         // scope 전체
++      | 'activitylogs' | 'menus' | 'pg_settings'        // store 안 operation 단위
++      | 'naverpay_setting' | 'kakaopay_setting'
++      | 'analytics';                                    // 별도 프로그램 (placeholder)
++    docsUrl?: string;
++    inquiryUrl: string;                                 // 카페24 개발자센터 안내 링크
++  };
+}
+```
+
+§2 본문 아래에 다음 문단 추가:
+
+```markdown
+**`restrictedApproval` 의 의미**
+
+본 필드는 카페24 본사가 별도 승인한 클라이언트만 호출할 수 있는 operation 을 식별한다. 명단의 single-source-of-truth 는 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md). UI 4 화면 (위저드 / 통합 상세 Scope 탭 / Cafe24 노드 Operation 드롭다운 / AI Agent allowlist) 이 본 필드를 읽어 ⚠ 배지·tooltip 을 자동 렌더한다. `level='scope'` 인 row 는 같은 resource (mileage/notification/privacy) 의 모든 자매 operation 에 같은 라벨이 자동 적용되므로 backend 메타데이터에서는 row 별로 빠짐없이 채운다.
+```
+
+### D2.2 §5 신규 endpoint 추가 절차 — 단계 추가
+
+기존 §5 의 step 5 (카탈로그 row 갱신) 본문에 다음 항목 추가:
+
+```diff
+5. [`cafe24-api-catalog/<resource>.md`](./cafe24-api-catalog/_overview.md) 의 표에 해당 row 의 `status` 를 `planned → supported` 로 갱신하고 `method` / `path` / `scope` / `paginated` 컬럼을 채운다. 카탈로그에 row 자체가 없으면 새로 추가.
++   - 추가로 별도 승인 대상인 경우 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md) 명단과 비교해 catalog 의 `restricted` 컬럼(`scope` / `op` / 빈칸) 과 backend 메타데이터의 `restrictedApproval` 필드를 동시 갱신한다.
+```
+
+§5 의 step 7 (백엔드 단위 테스트 검증) 본문에 다음 줄 추가:
+
+```diff
+   - **카탈로그 ↔ 메타데이터 양방향 동기** (`catalog-sync.spec.ts`)
++   - **restricted 컬럼 ↔ `restrictedApproval` 양방향 동기** (`catalog-sync.spec.ts`) — catalog 가 `scope` 또는 `op` 면 메타데이터에 `restrictedApproval` 존재, 그 역도 동일.
+```
+
+### D2.3 §8 CHANGELOG 추가
+
+```markdown
+| 2026-05-17 | §2 `Cafe24OperationMetadata.restrictedApproval` optional 필드 추가 + §5 절차에 catalog `restricted` 컬럼 동시 갱신 의무 명문화. SoT 는 신규 컨벤션 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md). 사용자 보고 — 카페24 본사 승인 필요 권한이 사용자에게 식별되지 않는 UX 문제 해소. consistency-check 세션: (예정). |
+```
+
+---
+
+## D3. EDIT — `spec/conventions/cafe24-api-catalog/_overview.md`
+
+### D3.1 §2 표 컬럼 정의 — 컬럼 추가
+
+기존 표에서 `status` 행 위에 다음 행 삽입:
+
+```markdown
+| `restricted` | — | `scope` / `op` / 빈칸. `scope` = 본 scope 자체가 카페24 별도 승인 대상이라 같은 resource 의 모든 row 가 영향. `op` = 본 row 만 단독 승인 대상 (store 안 케이스). 빈칸 = 일반 사용 가능. 명단의 SoT 는 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md) |
+```
+
+### D3.2 §4 동기 정책 — 검증 규칙 추가
+
+기존 검증 규칙 7번 뒤에 8번 추가:
+
+```markdown
+8. **`restricted` 컬럼 ↔ 메타데이터 `restrictedApproval` 동기**: catalog row 의 `restricted` 컬럼이 `scope` 또는 `op` 이면 그 row 에 대응하는 backend 메타데이터에 `restrictedApproval` 필드가 존재해야 하고 그 역도 동일. 컬럼 값과 메타데이터 `level` 의 매핑은: `scope` ↔ `level='scope'`, `op` ↔ `level='operation'`. `level='program'` 은 본 catalog 와 별개로 다뤄진다 (Analytics 등 catalog 화 대상이 아닌 트랙).
+```
+
+### D3.3 §7 CHANGELOG 추가
+
+```markdown
+| 2026-05-17 | §2 에 `restricted` 컬럼 추가 + §4 에 검증 규칙 8 신설. 카페24 별도 승인 대상 식별 — SoT 는 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md). 사용자 보고 (질문에서 제공한 표) 후속. |
+```
+
+---
+
+## D4. EDIT — catalog 표 (영향 resource)
+
+### D4.1 `mileage.md` — 표 헤더 + 모든 row 갱신
+
+표 헤더에 `restricted` 컬럼 추가 (scope 와 paginated 사이):
+
+```diff
+- | id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
+- |----|---|---|---|---|---|---|---|---|
++ | id | 라벨 (한) | English title | method | path | scope | restricted | paginated | status | docs |
++ |----|---|---|---|---|---|---|---|---|---|
+```
+
+모든 supported row 의 `restricted` 컬럼 = `scope`. 예:
+
+```markdown
+| `mileage_list` | 적립금 내역 조회 | Retrieve points | GET | `points` | read | scope | ✓ | supported | [↗](...) |
+| `mileage_grant` | 적립금 지급 | Issue and deduct points | POST | `points` | write | scope |  | supported | [↗](...) |
+| `points_autoexpiration_get` | 적립금 자동 만료 조회 | Retrieve an automatic points expiration | GET | `points/autoexpiration/{id}` | read | scope |  | supported | [↗](...) |
+| `points_autoexpiration_create` | 적립금 자동 만료 생성 | Create an automatic points expiration | POST | `points/autoexpiration` | write | scope |  | supported | [↗](...) |
+| `points_autoexpiration_delete` | 적립금 자동 만료 삭제 | Delete an automatic points expiration | DELETE | `points/autoexpiration/{id}` | write | scope |  | supported | [↗](...) |
+| `points_report` | 적립금 리포트 조회 | Retrieve a points report by date range | GET | `points/report` | read | scope |  | supported | [↗](...) |
+| `credits_list` | 예치금 내역 조회 | Retrieve a list of credits by date range | GET | `credits` | read | scope | ✓ | supported | [↗](...) |
+| `credits_report` | 예치금 리포트 조회 | Retrieve a credit report by date range | GET | `credits/report` | read | scope |  | supported | [↗](...) |
+```
+
+### D4.2 `notification.md` — 동일 패턴
+
+12 supported row 모두 `restricted: scope`.
+
+### D4.3 `privacy.md` — 동일 패턴
+
+6 supported row 모두 `restricted: scope`.
+
+### D4.4 `store.md` — 영향 row 만 갱신
+
+전체 헤더에 `restricted` 컬럼 추가. 빈칸이 기본이며 다음 row 만 `restricted: op`:
+
+- `activitylogs_list` (planned)
+- `activitylogs_get` (planned)
+- `financials_paymentgateway_get` (planned)
+- `menus_get` (planned)
+- `naverpay_setting_get` (planned)
+- `naverpay_setting_create` (planned)
+- `naverpay_setting_update` (planned)
+- `kakaopay_setting_get` (planned)
+- `kakaopay_setting_update` (planned)
+- `paymentgateway_create` (supported)
+- `paymentgateway_update` (supported)
+- `paymentgateway_delete` (supported)
+- `paymentgateway_paymentmethods_list` (supported)
+- `paymentgateway_paymentmethods_create` (planned)
+- `paymentgateway_paymentmethods_update` (planned)
+- `paymentgateway_paymentmethods_delete` (planned)
+
+> 참고: `paymentmethods_list` / `paymentmethods_paymentproviders_list` 는 사용자 자료에 명시되지 않았으므로 빈칸 유지. 향후 공식 문서 재검증 시 갱신.
+
+---
+
+## D5. EDIT — `spec/2-navigation/4-integration.md`
+
+### D5.1 §3.2 Cafe24 Public 흐름 — Step 2 폼 안내 추가
+
+기존 Step 2 의 끝에 다음 노트 추가:
+
+```markdown
+> **별도 승인 필요 권한 안내** — 체크박스 옆 ⚠ 아이콘이 표시된 카테고리·operation 은 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. 명단의 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md). 체크 자체는 차단하지 않으나, 체크된 권한 중 별도 승인 대상이 1개 이상이면 폼 하단에 영구 amber 경고 배너를 띄운다. 미승인 상태로 진행하면 OAuth 단계에서 `invalid_scope` 또는 호출 시 `INSUFFICIENT_SCOPE (403)` 으로 실패할 수 있음을 안내. tooltip 문구 / 경고 배너 / 에러 분기 메시지의 i18n 키 정의는 같은 컨벤션 §4 참고.
+```
+
+### D5.2 §5 Scope 권장 프리셋 표 — "별도 승인" 컬럼 추가
+
+기존 표:
+
+```diff
+- | 카테고리 | scope 값 (R / W) |
+- |---------|------------------|
++ | 카테고리 | scope 값 (R / W) | 별도 승인 |
++ |---------|------------------|----------|
+```
+
+각 행의 마지막 컬럼:
+
+- 일반 카테고리 (Product, Order, Customer, Category, Promotion, Shipping, Sales report, Translation, Application, Design, Community, Collection, Supply, Personal): 빈칸
+- Mileage, Notification, Privacy: `⚠ 필요` (R/W 모두)
+- Store: `⚠ 일부 sub-resource` (Activitylogs, Menus, Naverpay/Kakaopay/PG settings — 자세한 명단은 [`cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md) 링크)
+
+표 아래 본문 추가:
+
+```markdown
+> "⚠" 표기된 카테고리는 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. 일반 사용자가 무심코 체크 후 OAuth 진행 시 `invalid_scope` 로 실패할 수 있어, UI 에서 체크박스 옆에 ⚠ 아이콘 + tooltip + 폼 하단 경고 배너로 인지를 보장한다. Store 의 부분 제한은 scope 단위가 아닌 operation 단위라 노드 Operation 드롭다운 ([Spec Cafe24 노드 §2](../4-nodes/4-integration/4-cafe24.md#2-설정-ui)) 의 ⚠ 라벨이 1차 안내 지점이다. 명단 SoT 는 [`cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md).
+```
+
+### D5.3 §4.4 Scope & Permissions 탭 — 표에 행 추가
+
+기존 표:
+
+```diff
+| 요소 | 설명 |
+|------|------|
+| 현재 scope 목록 | `credentials.scopes[]` 전체를 체크된 상태로 표시 |
+| 권장 scope 목록 | 서비스별 프리셋. 현재 scope에 없는 항목은 체크 해제 상태 |
+| 누락 scope 배지 | `status_reason = insufficient_scope`일 때 누락 scope 목록을 빨간 뱃지로 강조 |
++ | 별도 승인 필요 ⚠ 배지 | 현재 scope·권장 scope·누락 scope 의 각 항목 옆에 `restrictedApproval` (메타데이터) 가 있는 scope/operation 만 ⚠ 배지 자동 노출. tooltip 본문은 [`cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md) §4.1 의 i18n 문구. `[Request scopes]` 버튼 위쪽에 "추가하려는 scope 중 N개는 카페24 별도 승인 필요" 보조 텍스트 (N=교집합 크기) |
+| `[Request scopes]` 버튼 | (기존 그대로) |
+```
+
+### D5.4 §9.4 공통 응답 포맷 — `INSUFFICIENT_SCOPE` 보강 필드 명시
+
+기존 `INSUFFICIENT_SCOPE (403)` 행 본문 갱신:
+
+```diff
+-  - `INSUFFICIENT_SCOPE` (403) — 노드 실행 중 감지 시 `Integration.status`도 갱신
++  - `INSUFFICIENT_SCOPE` (403) — 노드 실행 중 감지 시 `Integration.status` 도 갱신. `details.missingScopes: string[]` 에 누락 scope 목록을 담고, 그 중 카페24 별도 승인이 필요한 항목은 추가로 `details.requiresCafe24Approval: string[]` 에 채워 반환한다 (Cafe24 통합에 한정 — 다른 통합은 본 필드 미포함). frontend 는 `requiresCafe24Approval` 가 비어있지 않으면 에러 메시지에 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지를 추가 노출. 본 필드는 신규 에러 코드 없이 보강만 — 하위 호환 유지. 명단 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md).
+```
+
+### D5.5 §10.4 에러 매핑 — OAuth `invalid_scope` 분기 보강
+
+기존 §10.4 (에러 매핑) 에 다음 행 추가:
+
+```markdown
+| `oauth_invalid_scope` | OAuth callback 이 Cafe24 의 `invalid_scope` 응답을 받음. `last_error.details.requiresCafe24Approval: string[]` 에 요청 scope ∩ [`cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md) §1 의 교집합을 기록. 통합 상세 페이지가 본 단서를 읽어 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지 노출. status 는 보존 (재인증으로 회복 가능) |
+```
+
+### D5.6 Rationale — 신규 항목 추가
+
+`## Rationale` 섹션의 끝에 추가:
+
+```markdown
+### Cafe24 별도 승인 scope 의 식별·안내 (2026-05-17)
+
+**문제**: Cafe24 Admin API 중 mileage/notification/privacy 의 모든 scope 와 store 안 일부 operation (activitylogs, menus, naverpay/kakaopay/PG settings 등) 은 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. spec 에 이를 표현하는 차원이 없어 사용자가 위저드에서 일반 카테고리처럼 체크 → OAuth `invalid_scope` 거부 또는 호출 시 `INSUFFICIENT_SCOPE (403)` 으로 좌초. 원인 안내 장치 부재.
+
+**채택**: backend 메타데이터의 `Cafe24OperationMetadata.restrictedApproval` 필드와 catalog 의 `restricted` 컬럼을 SoT 로 두고, UI 4 화면 (위저드 / 상세 §4.4 / 노드 Operation 드롭다운 / AI Agent allowlist) 이 같은 필드를 읽어 ⚠ 배지·tooltip·경고 배너를 자동 렌더. 명단 SoT 는 신규 컨벤션 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md).
+
+**기각 대안**:
+- (A) 사용자가 체크 시 차단 — 이미 승인받은 합법 사용자 케이스를 막아버린다. 안내만, 차단 없음 정책 채택.
+- (B) 신규 에러 코드 추가 (`CAFE24_APPROVAL_REQUIRED`) — 기존 `INSUFFICIENT_SCOPE (403)` / `invalid_scope` 처리 경로를 분기시켜 client 코드 호환성에 영향. `details.requiresCafe24Approval` 보강 필드만으로 충분.
+- (C) catalog 의 `status` enum 에 `restricted` 값 추가 — supported / planned / deprecated 와는 직교 차원이라 enum 확장은 의미 오염. 별도 컬럼이 정답.
+
+**Trade-off**: mileage resource 안의 `credits_*` (예치금) 가 정확히 `mall.read_mileage` 를 쓰는지 vs 별도 scope (`mall.read_deposits` 등) 인지의 공식 분리 확인은 사용자 자료 범위 밖이므로, scope 단위 라벨링 (level='scope') 을 mileage resource 전체에 적용. 향후 공식 문서로 분리 확인되면 본 결정 정정.
+
+출처: 사용자 보고 (2026-05-17). consistency-check 세션: (예정).
+```
+
+---
+
+## D6. EDIT — `spec/4-nodes/4-integration/4-cafe24.md`
+
+### D6.1 §2 설정 UI — Operation 드롭다운 라벨링 추가
+
+기존 §2 의 Operation 드롭다운 설명 줄에 추가:
+
+```diff
+- Operation 후보 표시: 카탈로그 (`spec/conventions/cafe24-api-catalog/`) 의 `status: planned` 행도 dropdown 에 노출하되 disabled + "(지원 예정)" 접미사로 구분. resource 옆에 "지원 N개 · 추후 지원 M개" coverage hint.
++ Operation 후보 표시: 카탈로그 (`spec/conventions/cafe24-api-catalog/`) 의 `status: planned` 행도 dropdown 에 노출하되 disabled + "(지원 예정)" 접미사로 구분. resource 옆에 "지원 N개 · 추후 지원 M개" coverage hint.
++ - **별도 승인 라벨**: 메타데이터 row 에 `restrictedApproval` 이 있는 operation 은 라벨 우측에 ⚠ 아이콘 + 보조 텍스트 ("별도 승인 필요") 표시. resource 가 scope 단위 restricted (mileage/notification/privacy) 면 같은 resource 의 모든 operation 에 자동 적용. tooltip 본문·문의 링크는 [`spec/conventions/cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md) §4.1.
+```
+
+### D6.2 §8.3 allowlist — UI 라벨링 추가
+
+기존 §8.3 끝에 다음 문단 추가:
+
+```markdown
+**별도 승인 라벨 (UI)**: AI Agent allowlist 의 카테고리 단위 grouping UI 에서, scope 전체가 별도 승인 대상인 카테고리 (mileage/notification/privacy) 는 그룹 헤더에 ⚠ + "별도 승인 필요". store 안 일부 operation 단위 restricted (paymentgateway_*, activitylogs_*, menus_*, naverpay_setting_*, kakaopay_setting_*, financials_paymentgateway_get 등) 는 operation 행 단위로 같은 ⚠ 표기. backend 가 `mcpServers` 메타데이터 응답에 `restrictedApproval` 을 통과시켜 frontend 가 자동 렌더한다. 명단 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md).
+```
+
+### D6.3 §10 CHANGELOG 추가
+
+```markdown
+| 2026-05-17 | §2 Operation 드롭다운에 별도 승인 ⚠ 라벨 명세 + §8.3 AI Agent allowlist UI 의 동일 ⚠ 라벨 명세 추가. 메타데이터 `Cafe24OperationMetadata.restrictedApproval` 신설 ([cafe24-api-metadata 컨벤션 §2](../../conventions/cafe24-api-metadata.md#2-operation-메타데이터-형식)) + 카탈로그 `restricted` 컬럼 ([_overview §2](../../conventions/cafe24-api-catalog/_overview.md#2-표-컬럼-정의)) + SoT 컨벤션 [`cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md) 신설과 한 세트. 사용자 보고 (2026-05-17) — 카페24 본사 승인 필요 권한이 사용자에게 식별되지 않는 UX 문제 해소. consistency-check 세션: (예정). |
+```
+
+### D6.4 Rationale — 신규 항목 추가
+
+`## 9. Rationale` 의 끝에 추가:
+
+```markdown
+### 9.11 별도 승인 라벨 — 노드 Operation / AI Agent allowlist 의 ⚠ 표기
+
+UI 4 화면 (통합 위저드 / 통합 상세 §4.4 / 노드 Operation 드롭다운 / AI Agent allowlist) 의 라벨링은 같은 메타데이터 SoT (`Cafe24OperationMetadata.restrictedApproval`) 에서 자동 렌더. 명단의 진위는 [`cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md) 가 유일 출처이며, 본 노드 spec 은 그 라벨이 노드/AI Agent 의 어디에서 시각화되는지만 명시한다 — 명단을 직접 enumerate 하지 않는 이유는 drift 방지 (cafe24-api-metadata.md §3 의 "endpoint enumeration 을 spec 본문에 인라인하지 않는다" 정책과 동일).
+```
+
+---
+
+## D7. 영향 요약
+
+### 신규 파일
+
+- `spec/conventions/cafe24-restricted-scopes.md`
+
+### 수정 파일
+
+- `spec/conventions/cafe24-api-metadata.md` (§2 / §5 / CHANGELOG)
+- `spec/conventions/cafe24-api-catalog/_overview.md` (§2 / §4 / CHANGELOG)
+- `spec/conventions/cafe24-api-catalog/mileage.md` (헤더 + 전체 row)
+- `spec/conventions/cafe24-api-catalog/notification.md` (헤더 + 전체 row)
+- `spec/conventions/cafe24-api-catalog/privacy.md` (헤더 + 전체 row)
+- `spec/conventions/cafe24-api-catalog/store.md` (헤더 + 영향 16 row)
+- `spec/2-navigation/4-integration.md` (§3.2 / §4.4 / §5 / §9.4 / §10.4 / Rationale)
+- `spec/4-nodes/4-integration/4-cafe24.md` (§2 / §8.3 / §10 CHANGELOG / Rationale 9.11)
+
+### 신규 식별자 (충돌 검토 대상)
+
+- `restrictedApproval` (메타데이터 필드명)
+- `restricted` (catalog 표 컬럼명)
+- `requiresCafe24Approval` (API 에러 details 필드명)
+- `oauth_invalid_scope` (Integration.status_reason 값)
+- `level` enum: `scope` / `operation` / `program`
+- `category` enum: `mileage` / `notification` / `privacy` / `activitylogs` / `menus` / `pg_settings` / `naverpay_setting` / `kakaopay_setting` / `analytics`
+
+### 기각된 대안 (Rationale 에 기록)
+
+- 차단 정책 (사용자 안내만, 차단 없음)
+- 신규 에러 코드 (`CAFE24_APPROVAL_REQUIRED` 등 — 보강 필드로 대체)
+- catalog `status` enum 확장 (별도 컬럼이 정답)

```

---

### 파일 29: review/consistency/2026/05/17/12_12_46/SUMMARY.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/17/12_12_46/SUMMARY.md b/review/consistency/2026/05/17/12_12_46/SUMMARY.md
new file mode 100644
index 00000000..cd430fba
--- /dev/null
+++ b/review/consistency/2026/05/17/12_12_46/SUMMARY.md
@@ -0,0 +1,75 @@
+# Consistency Check 통합 보고서
+
+**BLOCK: NO** — Critical 발견 없음. WARNING 수준 이슈 다수 존재하나 작업 차단 요건 미충족.
+
+세션: `review/consistency/2026/05/17/12_12_46/`
+모드: `--spec plan/in-progress/spec-draft-cafe24-restricted-scopes.md`
+
+---
+
+## 전체 위험도
+**MEDIUM** — 데이터 모델 spec 불일치(`oauth_invalid_scope` 미등재, `last_error.details` 스키마 미정의)와 병렬 worktree 직렬화 조건 미확인이 주요 위험. 기존 spec 핵심 구조와 충돌하거나 합의된 invariant 를 위반하는 항목은 없음.
+
+## Critical 위배 (BLOCK 사유)
+없음
+
+## 경고 (WARNING)
+
+| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
+|---|---------|------|-------------|-----------|------|
+| W-1 | Cross-Spec / Naming-Collision | `oauth_invalid_scope` 가 `Integration.status_reason` 기존 열거에 미등재 — 어느 status 버킷(`pending_install` / `error`)에 귀속되는지 불명확 | D1 §4.3, D5.5 §10.4 | `spec/1-data-model.md §2.10` status_reason 컬럼 정의 | `spec/1-data-model.md §2.10` status_reason 열거에 `oauth_invalid_scope` 를 추가하고 귀속 status 버킷을 명시 |
+| W-2 | Cross-Spec / Naming-Collision | `last_error.details.requiresCafe24Approval` — 기존 `last_error { code, message, at }` 스키마에 `details` 키 없음 | D1 §4.3, D5.4 §9.4 | `spec/1-data-model.md §2.10` Integration.last_error 정의 | `last_error` 스키마를 `{ code, message, at, details? }` 로 확장 |
+| W-3 | Cross-Spec | `INSUFFICIENT_SCOPE (403)` 응답 보강 범위 모호 | D5.4 §9.4 | `spec/2-navigation/4-integration.md §9.4` 기존 정의 | `details.missingScopes` 가 기존 필드인지 신규인지 한 줄 명시 |
+| W-4 | Cross-Spec / Naming-Collision | `category` enum 값 `pg_settings` 의 적용 범위 모호 | D2.1, D6 §8.3 | D1 §2 operation 목록 | `pg_settings` 가 포괄하는 operation id 집합 주석 명시 |
+| W-5 | Cross-Spec | `level='program'` — catalog `restricted` 컬럼 값 집합에 없으며 catalog-sync 처리 방침 미명시 | D2.1, D3.2 | D3.1 §2 컬럼 정의 | 검증 규칙 8 에 program 제외 조항 추가 |
+| W-6 | Plan-Coherence | `spec/2-navigation/4-integration.md` 동시 수정 — 3 worktree 머지 여부 미확인 | D5 전체 | `plan/in-progress/spec-update-cafe24-test-connection.md` | 착수 전 머지 여부 확인 |
+| W-7 | Plan-Coherence | `full-review-fixes-a1b2c3` W-69 머지 여부 미확인 | D6 전체 | `plan/in-progress/20260516-full-review/RESOLUTION.md` W-69 | 머지 여부 확인 후 착수 |
+| W-8 | Plan-Coherence | `cafe24-backlog-residual.md` F-2 와 동일 파일 동시 수정 | D5.4·D5.5 | `plan/in-progress/cafe24-backlog-residual.md` F-2 | 양쪽 plan 상호 인식 명시 |
+| W-9 | Convention-Compliance | 신규 컨벤션 파일에 `## Rationale` 섹션 없음 | D1 초안 전체 | CLAUDE.md 권장 3섹션 구성 | Rationale 섹션 추가 |
+| W-10 | Convention-Compliance | `_overview.md` 파일명 — 기존 파일 문제, 본 draft 범위 외 | D3 | CLAUDE.md 명명 컨벤션 | 향후 housekeeping |
+
+## 참고 (INFO)
+
+| # | Checker | 항목 | 처리 |
+|---|---------|------|------|
+| I-1 | Naming-Collision | `details` 하위 구조 공식 정의 필요 | W-2 와 함께 처리 (last_error 스키마 확장) |
+| I-2 | Naming-Collision | `restricted: op` 와 메타데이터 `restrictedApproval` 동시 채움 강조 | 영향 요약에 명시 |
+| I-3 | Naming-Collision | `restricted` 컬럼과 기각 대안 `status: restricted` 동음이의어 혼동 | 컬럼 설명에 직교 명시 |
+| I-4 | Cross-Spec | `category` enum ↔ operation id 패턴 매핑 | W-4 와 함께 처리 |
+| I-5 | Cross-Spec | `paymentmethods_paymentproviders_list` 추적 필요 | store.md 안내 |
+| I-6 | Rationale-Continuity | `details.missingScopes` 기존 여부 명시 | W-3 과 함께 처리 |
+| I-7 | Rationale-Continuity | Analytics placeholder 미완 상태 명시 | §3 한 줄 추가 |
+| I-8 | Convention-Compliance | CHANGELOG 섹션 번호 실제 확인 | 본 spec 반영에서 확인 |
+| I-9 | Convention-Compliance | plan frontmatter `type` 필드 비표준 | 현 상태 유지 가능 |
+| I-10 | Plan-Coherence | spec-update-impl-prep-findings C2 이중 추적 | 본 plan 범위 외 (별도 정리) |
+| I-11 | Plan-Coherence | `catalog-sync.spec.ts` 구현용 developer plan | implementation phase 에서 처리 |
+| I-12 | Rationale-Continuity | `oauth_invalid_scope` vs `oauth_token_exchange_failed` 진입 경로 구분 | §10.4 한 줄 명시 (W-1 과 함께) |
+
+## Checker별 위험도
+
+| Checker | 위험도 | 핵심 발견 |
+|---------|--------|-----------|
+| Cross-Spec | MEDIUM | `oauth_invalid_scope` 데이터 모델 미등재, `last_error.details` 스키마 불일치 |
+| Rationale-Continuity | LOW | 기존 합의 원칙 위반 없음 |
+| Convention-Compliance | LOW | 신규 컨벤션 파일 Rationale 누락 |
+| Plan-Coherence | MEDIUM | 인접 worktree 머지 여부 미확인 |
+| Naming-Collision | MEDIUM | `oauth_invalid_scope` 데이터 모델 불일치, `pg_settings` 범위 모호 |
+
+## 처리 결과 (spec 반영 단계에서)
+
+- W-6, W-7 — 인접 worktree (`cafe24-spec-sync-e2a8b9`, `cafe24-app-url-reuse-f9a2e3`, `prod-rereview-fix-a7c93f`, `full-review-fixes-a1b2c3`) 모두 main 머지 완료 확인 ✓
+- W-1, W-2 — `spec/1-data-model.md §2.10` 의 `status_reason` 에 `oauth_invalid_scope` 추가 + `last_error` 스키마에 `details?: Record<string, unknown>` 확장
+- W-3, I-6 — `spec/2-navigation/4-integration.md §9.4` 의 `INSUFFICIENT_SCOPE` 본문에 `missingScopes`/`requiresCafe24Approval` 양쪽 형식 명시 + 신규 보강 필드 표기
+- W-4, I-4 — `spec/conventions/cafe24-api-metadata.md §2` 에 `category` 묶음 매핑 표 추가
+- W-5 — `spec/conventions/cafe24-api-catalog/_overview.md §4` 검증 규칙 8 에 `level='program'` 제외 조항 명시
+- W-8 — `plan/in-progress/cafe24-backlog-residual.md` F-2 와 본 plan 양쪽에 cross-reference 추가
+- W-9 — `spec/conventions/cafe24-restricted-scopes.md` 에 `## Rationale` 섹션 신설 (기각 대안 + trade-off + 출처)
+- I-3 — `_overview.md §2` 의 `restricted` 컬럼 설명에 "status 와 직교" 한 줄 추가
+- I-7 — `spec/conventions/cafe24-restricted-scopes.md §3` 에 Analytics placeholder 미완 상태 명시
+- I-12 — `spec/2-navigation/4-integration.md §10.4` 의 `Cafe24 invalid_scope` 행에 `oauth_token_exchange_failed` 와의 진입 경로 분리 한 줄 명시
+
+W-10 (catalog 파일명) 은 본 draft 범위 외 — 향후 housekeeping. I-10 (impl-prep-findings C2) 도 본 plan 범위 외.
+
+## 후속
+
+- I-11 — implementation phase 에서 `catalog-sync.spec.ts` 갱신을 developer 작업 항목으로 포함.

```

---

### 파일 30: review/consistency/2026/05/17/12_12_46/_prompts/convention_compliance.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/17/12_12_46/_prompts/convention_compliance.md b/review/consistency/2026/05/17/12_12_46/_prompts/convention_compliance.md
new file mode 100644
index 00000000..a7dd1916
--- /dev/null
+++ b/review/consistency/2026/05/17/12_12_46/_prompts/convention_compliance.md
@@ -0,0 +1,736 @@
+# 정식 규약 준수 Check Payload
+
+본 파일은 orchestrator 가 정식 규약 준수 checker 용으로 작성한 입력입니다. target 문서가 정식 규약(`spec/conventions/**`) 을 따르고 있는지 분석한다.
+sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
+따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
+인자가 가리키는 경로에 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.
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
+spec draft 검토 (--spec)
+
+## Target 문서
+경로: `plan/in-progress/spec-draft-cafe24-restricted-scopes.md`
+
+```
+---
+worktree: cafe24-restricted-scopes-a1b2c3
+started: 2026-05-17
+owner: project-planner
+type: spec-draft
+target_specs:
+  - spec/conventions/cafe24-restricted-scopes.md (NEW)
+  - spec/conventions/cafe24-api-metadata.md
+  - spec/conventions/cafe24-api-catalog/_overview.md
+  - spec/conventions/cafe24-api-catalog/mileage.md
+  - spec/conventions/cafe24-api-catalog/notification.md
+  - spec/conventions/cafe24-api-catalog/privacy.md
+  - spec/conventions/cafe24-api-catalog/store.md
+  - spec/2-navigation/4-integration.md
+  - spec/4-nodes/4-integration/4-cafe24.md
+---
+
+# SPEC DRAFT: Cafe24 별도 승인 scope/operation 식별 메타데이터 도입
+
+본 draft 는 `/consistency-check --spec` 사전 검토용 변경안 본문이다. 승인 후 각 target_spec 에 반영한다.
+
+---
+
+## D1. NEW — `spec/conventions/cafe24-restricted-scopes.md`
+
+```markdown
+# CONVENTION: Cafe24 별도 승인이 필요한 Scope · Operation
+
+> 관련 문서: [Cafe24 API Metadata 컨벤션](./cafe24-api-metadata.md) · [Cafe24 API Catalog](./cafe24-api-catalog/_overview.md) · [Spec 통합 화면 §5.8 Cafe24](../2-navigation/4-integration.md#58-cafe24)
+
+Cafe24 Admin API 의 일부 scope·operation 은 카페24 본사가 별도로 승인한 클라이언트만 사용할 수 있다. 공식 문서가 다음 문구로 명시한다:
+
+> "해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요."
+
+본 컨벤션은 그 명단을 single-source-of-truth 로 박제한다. backend 메타데이터의 `restrictedApproval` 필드 (cafe24-api-metadata 컨벤션 §2) 와 catalog 파일의 `restricted` 컬럼 (cafe24-api-catalog _overview §2) 이 본 명단과 일치해야 하며, `catalog-sync.spec.ts` 가 동기 검증을 강제한다.
+
+---
+
+## 1. Scope 단위 별도 승인 (resource 전체 영향)
+
+해당 scope 가 부여된 OAuth 동의 자체가 본사 승인 없이는 실패한다. 자매 operation 모두 영향을 받는다.
+
+| Scope | Resource (catalog 파일) | 설명 |
+|---|---|---|
+| `mall.read_mileage` | [mileage.md](./cafe24-api-catalog/mileage.md) | 적립금 조회 |
+| `mall.write_mileage` | [mileage.md](./cafe24-api-catalog/mileage.md) | 적립금 수정 |
+| `mall.read_notification` | [notification.md](./cafe24-api-catalog/notification.md) | 알림 조회 |
+| `mall.write_notification` | [notification.md](./cafe24-api-catalog/notification.md) | 알림 발송 |
+| `mall.read_privacy` | [privacy.md](./cafe24-api-catalog/privacy.md) | 개인정보 조회 |
+| `mall.write_privacy` | [privacy.md](./cafe24-api-catalog/privacy.md) | 개인정보 수정 |
+
+> 위 카탈로그의 모든 row 는 catalog 표의 `restricted` 컬럼 = `scope`, backend 메타데이터의 `restrictedApproval.level='scope'` 로 표기된다.
+
+## 2. Operation 단위 별도 승인 (store scope 안의 일부)
+
+`mall.read_store` / `mall.write_store` 자체는 일반 사용 가능하지만, 안의 일부 operation 만 별도 승인 대상이다. 카탈로그 표에서 해당 row 만 `restricted: op` 로 표기한다.
+
+| 영역 | 영향 operation id (catalog [store.md](./cafe24-api-catalog/store.md)) | 설명 |
+|---|---|---|
+| Activitylogs | `activitylogs_list`, `activitylogs_get` | 활동 로그 목록/상세 조회 |
+| Financials paymentgateway | `financials_paymentgateway_get` | PG사 계약정보 조회 |
+| Menus | `menus_get` | 메뉴 조회 |
+| Naverpay setting | `naverpay_setting_get`, `naverpay_setting_create`, `naverpay_setting_update` | 네이버페이 설정 조회·등록·수정 |
+| Kakaopay setting | `kakaopay_setting_get`, `kakaopay_setting_update` | 카카오페이 설정 조회·수정 |
+| Paymentgateway | `paymentgateway_create`, `paymentgateway_update`, `paymentgateway_delete` | PG 생성·수정·삭제 |
+| Paymentgateway paymentmethods | `paymentgateway_paymentmethods_list`, `paymentgateway_paymentmethods_create`, `paymentgateway_paymentmethods_update`, `paymentgateway_paymentmethods_delete` | PG 결제수단 목록/생성·수정·삭제 |
+
+## 3. 별도 프로그램 승인
+
+카페24 승인 제휴사에만 제공되는 별도 트랙. 본 프로젝트는 현재 직접 호출 경로를 구현하지 않으며, 본 명단은 향후 도입을 위한 placeholder 다.
+
+| API | 설명 |
+|---|---|
+| Cafe24 Analytics API | 카페24 승인 제휴사에만 제공. 쇼핑몰 사용자 행동 데이터 제공 서비스 제작 용도 |
+
+## 4. 사용 정책
+
+### 4.1 사용자 안내 (UI)
+
+위 §1·§2 의 항목은 다음 4 화면에서 동일한 ⚠ 배지·tooltip 으로 표기된다:
+
+1. **통합 추가 위저드 Step 2 Scope 체크박스** (Spec 통합 화면 §3.2 Cafe24 Public/Private)
+2. **통합 상세 §4.4 Scope & Permissions 탭** (현재 scope · 권장 scope · 누락 scope 모두)
+3. **Cafe24 노드 Operation 드롭다운** (Spec Cafe24 노드 §2)
+4. **AI Agent allowlist UI** (Spec Cafe24 노드 §8.3, Spec MCP Client §5.6)
+
+배지 hover 시 tooltip 문구 (한국어):
+
+> "카페24 본사 승인이 필요한 권한입니다. 미승인 상태로 동의를 시도하면 `invalid_scope` 로 실패하거나, 인증 후 호출 시 403 이 반환될 수 있어요. [Cafe24 개발자센터 문의 →]"
+
+영어 (i18n):
+
+> "This permission requires Cafe24 partner approval. Without approval, the OAuth flow may reject it as `invalid_scope`, or API calls may return 403. [Contact Cafe24 Developer Center →]"
+
+### 4.2 차단 정책
+
+체크/저장은 **차단하지 않는다**. 이미 본사 승인을 받은 사용자가 있을 수 있으므로 "알고 누른다" 만 보장. 단 체크된 권한 중 별도 승인 필요 항목이 1개 이상이면 위저드 Step 2 폼 하단에 **영구 amber 경고 배너**를 띄운다 (사용자가 인지하지 못한 채 진행하는 사례 차단).
+
+### 4.3 에러 안내 (에러 발생 후)
+
+- **OAuth `invalid_scope`**: backend 의 cafe24 OAuth callback 이 응답을 파싱 후 요청한 scopes ∩ 본 명단 §1 의 교집합이 비어있지 않으면 `Integration.status_reason='oauth_invalid_scope'` 와 함께 `last_error.details.requiresCafe24Approval: string[]` 에 영향 scope 를 기록. 통합 상세 페이지가 본 단서를 읽어 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지 노출.
+- **노드 실행 중 `INSUFFICIENT_SCOPE (403)`**: 응답 `details.requiresCafe24Approval: string[]` 에 사용 scope ∩ 본 명단의 교집합을 채워 보낸다. frontend 가 본 필드가 비어있지 않으면 별도 승인 안내 분기 메시지를 노출.
+
+### 4.4 신규 코드 추가 없음
+
+기존 `OAuth invalid_scope` 분기, `INSUFFICIENT_SCOPE (403)` 응답 모두 그대로 유지하고 `details.requiresCafe24Approval` 보강 필드로만 표현. 새 HTTP 상태/에러 코드 vocabulary 추가는 하지 않는다 (하위 호환).
+
+## 5. 명단 갱신 절차
+
+1. Cafe24 공식 문서를 다시 확인해 본 명단의 진위·추가/삭제를 검증.
+2. 본 문서의 §1·§2·§3 표 갱신.
+3. 영향받는 catalog 파일 (`mileage.md` / `notification.md` / `privacy.md` / `store.md` / 추가 영향 resource) 의 `restricted` 컬럼 갱신.
+4. backend 메타데이터의 `restrictedApproval` 필드 동시 갱신.
+5. `npm test --workspace backend -- catalog-sync` 로 양방향 동기 확인.
+6. UI 4 화면에서 ⚠ 표기가 새 명단을 따라 자동 갱신되는지 시각 회귀 (해당 컴포넌트는 메타데이터 기반 자동 렌더링).
+
+## 6. 참고 링크
+
+- Cafe24 Admin API 공식 문서: https://developers.cafe24.com/docs/api/admin/
+- Scope별 사용 동의 가이드: https://developers.cafe24.com/app/front/app/develop/api/scope
+- Cafe24 Analytics API: https://developers.cafe24.com/docs/ko/api/cafe24data/
+- 카페24 개발자센터 문의: https://developers.cafe24.com
+
+## 7. CHANGELOG
+
+| 일자 | 변경 |
+|------|------|
+| 2026-05-17 | 신규 컨벤션 — 사용자 보고 (질문에서 제공한 표) 와 공식 문서 안내 문구를 기반으로 별도 승인 대상 명단 정식 등재. backend 메타데이터 `restrictedApproval` 필드 + catalog `restricted` 컬럼과 함께 도입. consistency-check 세션: (예정). |
+```
+
+---
+
+## D2. EDIT — `spec/conventions/cafe24-api-metadata.md`
+
+### D2.1 §2 Operation 메타데이터 형식 — 필드 추가
+
+기존 인터페이스 정의 (§2) 의 끝에 추가:
+
+```diff
+  responseShape?: 'list' | 'single' | 'empty';
+  paginated?: boolean;
++
++  // 별도 승인 라벨링 — [cafe24-restricted-scopes 컨벤션](./cafe24-restricted-scopes.md)
++  // 의 명단과 일치해야 하며, catalog-sync.spec.ts 가 카탈로그 row 의
++  // `restricted` 컬럼과 양방향 동기를 검증한다.
++  restrictedApproval?: {
++    level: 'scope' | 'operation' | 'program';
++    category:
++      | 'mileage' | 'notification' | 'privacy'         // scope 전체
++      | 'activitylogs' | 'menus' | 'pg_settings'        // store 안 operation 단위
++      | 'naverpay_setting' | 'kakaopay_setting'
++      | 'analytics';                                    // 별도 프로그램 (placeholder)
++    docsUrl?: string;
++    inquiryUrl: string;                                 // 카페24 개발자센터 안내 링크
++  };
+}
+```
+
+§2 본문 아래에 다음 문단 추가:
+
+```markdown
+**`restrictedApproval` 의 의미**
+
+본 필드는 카페24 본사가 별도 승인한 클라이언트만 호출할 수 있는 operation 을 식별한다. 명단의 single-source-of-truth 는 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md). UI 4 화면 (위저드 / 통합 상세 Scope 탭 / Cafe24 노드 Operation 드롭다운 / AI Agent allowlist) 이 본 필드를 읽어 ⚠ 배지·tooltip 을 자동 렌더한다. `level='scope'` 인 row 는 같은 resource (mileage/notification/privacy) 의 모든 자매 operation 에 같은 라벨이 자동 적용되므로 backend 메타데이터에서는 row 별로 빠짐없이 채운다.
+```
+
+### D2.2 §5 신규 endpoint 추가 절차 — 단계 추가
+
+기존 §5 의 step 5 (카탈로그 row 갱신) 본문에 다음 항목 추가:
+
+```diff
+5. [`cafe24-api-catalog/<resource>.md`](./cafe24-api-catalog/_overview.md) 의 표에 해당 row 의 `status` 를 `planned → supported` 로 갱신하고 `method` / `path` / `scope` / `paginated` 컬럼을 채운다. 카탈로그에 row 자체가 없으면 새로 추가.
++   - 추가로 별도 승인 대상인 경우 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md) 명단과 비교해 catalog 의 `restricted` 컬럼(`scope` / `op` / 빈칸) 과 backend 메타데이터의 `restrictedApproval` 필드를 동시 갱신한다.
+```
+
+§5 의 step 7 (백엔드 단위 테스트 검증) 본문에 다음 줄 추가:
+
+```diff
+   - **카탈로그 ↔ 메타데이터 양방향 동기** (`catalog-sync.spec.ts`)
++   - **restricted 컬럼 ↔ `restrictedApproval` 양방향 동기** (`catalog-sync.spec.ts`) — catalog 가 `scope` 또는 `op` 면 메타데이터에 `restrictedApproval` 존재, 그 역도 동일.
+```
+
+### D2.3 §8 CHANGELOG 추가
+
+```markdown
+| 2026-05-17 | §2 `Cafe24OperationMetadata.restrictedApproval` optional 필드 추가 + §5 절차에 catalog `restricted` 컬럼 동시 갱신 의무 명문화. SoT 는 신규 컨벤션 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md). 사용자 보고 — 카페24 본사 승인 필요 권한이 사용자에게 식별되지 않는 UX 문제 해소. consistency-check 세션: (예정). |
+```
+
+---
+
+## D3. EDIT — `spec/conventions/cafe24-api-catalog/_overview.md`
+
+### D3.1 §2 표 컬럼 정의 — 컬럼 추가
+
+기존 표에서 `status` 행 위에 다음 행 삽입:
+
+```markdown
+| `restricted` | — | `scope` / `op` / 빈칸. `scope` = 본 scope 자체가 카페24 별도 승인 대상이라 같은 resource 의 모든 row 가 영향. `op` = 본 row 만 단독 승인 대상 (store 안 케이스). 빈칸 = 일반 사용 가능. 명단의 SoT 는 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md) |
+```
+
+### D3.2 §4 동기 정책 — 검증 규칙 추가
+
+기존 검증 규칙 7번 뒤에 8번 추가:
+
+```markdown
+8. **`restricted` 컬럼 ↔ 메타데이터 `restrictedApproval` 동기**: catalog row 의 `restricted` 컬럼이 `scope` 또는 `op` 이면 그 row 에 대응하는 backend 메타데이터에 `restrictedApproval` 필드가 존재해야 하고 그 역도 동일. 컬럼 값과 메타데이터 `level` 의 매핑은: `scope` ↔ `level='scope'`, `op` ↔ `level='operation'`. `level='program'` 은 본 catalog 와 별개로 다뤄진다 (Analytics 등 catalog 화 대상이 아닌 트랙).
+```
+
+### D3.3 §7 CHANGELOG 추가
+
+```markdown
+| 2026-05-17 | §2 에 `restricted` 컬럼 추가 + §4 에 검증 규칙 8 신설. 카페24 별도 승인 대상 식별 — SoT 는 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md). 사용자 보고 (질문에서 제공한 표) 후속. |
+```
+
+---
+
+## D4. EDIT — catalog 표 (영향 resource)
+
+### D4.1 `mileage.md` — 표 헤더 + 모든 row 갱신
+
+표 헤더에 `restricted` 컬럼 추가 (scope 와 paginated 사이):
+
+```diff
+- | id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
+- |----|---|---|---|---|---|---|---|---|
++ | id | 라벨 (한) | English title | method | path | scope | restricted | paginated | status | docs |
++ |----|---|---|---|---|---|---|---|---|---|
+```
+
+모든 supported row 의 `restricted` 컬럼 = `scope`. 예:
+
+```markdown
+| `mileage_list` | 적립금 내역 조회 | Retrieve points | GET | `points` | read | scope | ✓ | supported | [↗](...) |
+| `mileage_grant` | 적립금 지급 | Issue and deduct points | POST | `points` | write | scope |  | supported | [↗](...) |
+| `points_autoexpiration_get` | 적립금 자동 만료 조회 | Retrieve an automatic points expiration | GET | `points/autoexpiration/{id}` | read | scope |  | supported | [↗](...) |
+| `points_autoexpiration_create` | 적립금 자동 만료 생성 | Create an automatic points expiration | POST | `points/autoexpiration` | write | scope |  | supported | [↗](...) |
+| `points_autoexpiration_delete` | 적립금 자동 만료 삭제 | Delete an automatic points expiration | DELETE | `points/autoexpiration/{id}` | write | scope |  | supported | [↗](...) |
+| `points_report` | 적립금 리포트 조회 | Retrieve a points report by date range | GET | `points/report` | read | scope |  | supported | [↗](...) |
+| `credits_list` | 예치금 내역 조회 | Retrieve a list of credits by date range | GET | `credits` | read | scope | ✓ | supported | [↗](...) |
+| `credits_report` | 예치금 리포트 조회 | Retrieve a credit report by date range | GET | `credits/report` | read | scope |  | supported | [↗](...) |
+```
+
+### D4.2 `notification.md` — 동일 패턴
+
+12 supported row 모두 `restricted: scope`.
+
+### D4.3 `privacy.md` — 동일 패턴
+
+6 supported row 모두 `restricted: scope`.
+
+### D4.4 `store.md` — 영향 row 만 갱신
+
+전체 헤더에 `restricted` 컬럼 추가. 빈칸이 기본이며 다음 row 만 `restricted: op`:
+
+- `activitylogs_list` (planned)
+- `activitylogs_get` (planned)
+- `financials_paymentgateway_get` (planned)
+- `menus_get` (planned)
+- `naverpay_setting_get` (planned)
+- `naverpay_setting_create` (planned)
+- `naverpay_setting_update` (planned)
+- `kakaopay_setting_get` (planned)
+- `kakaopay_setting_update` (planned)
+- `paymentgateway_create` (supported)
+- `paymentgateway_update` (supported)
+- `paymentgateway_delete` (supported)
+- `paymentgateway_paymentmethods_list` (supported)
+- `paymentgateway_paymentmethods_create` (planned)
+- `paymentgateway_paymentmethods_update` (planned)
+- `paymentgateway_paymentmethods_delete` (planned)
+
+> 참고: `paymentmethods_list` / `paymentmethods_paymentproviders_list` 는 사용자 자료에 명시되지 않았으므로 빈칸 유지. 향후 공식 문서 재검증 시 갱신.
+
+---
+
+## D5. EDIT — `spec/2-navigation/4-integration.md`
+
+### D5.1 §3.2 Cafe24 Public 흐름 — Step 2 폼 안내 추가
+
+기존 Step 2 의 끝에 다음 노트 추가:
+
+```markdown
+> **별도 승인 필요 권한 안내** — 체크박스 옆 ⚠ 아이콘이 표시된 카테고리·operation 은 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. 명단의 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md). 체크 자체는 차단하지 않으나, 체크된 권한 중 별도 승인 대상이 1개 이상이면 폼 하단에 영구 amber 경고 배너를 띄운다. 미승인 상태로 진행하면 OAuth 단계에서 `invalid_scope` 또는 호출 시 `INSUFFICIENT_SCOPE (403)` 으로 실패할 수 있음을 안내. tooltip 문구 / 경고 배너 / 에러 분기 메시지의 i18n 키 정의는 같은 컨벤션 §4 참고.
+```
+
+### D5.2 §5 Scope 권장 프리셋 표 — "별도 승인" 컬럼 추가
+
+기존 표:
+
+```diff
+- | 카테고리 | scope 값 (R / W) |
+- |---------|------------------|
++ | 카테고리 | scope 값 (R / W) | 별도 승인 |
++ |---------|------------------|----------|
+```
+
+각 행의 마지막 컬럼:
+
+- 일반 카테고리 (Product, Order, Customer, Category, Promotion, Shipping, Sales report, Translation, Application, Design, Community, Collection, Supply, Personal): 빈칸
+- Mileage, Notification, Privacy: `⚠ 필요` (R/W 모두)
+- Store: `⚠ 일부 sub-resource` (Activitylogs, Menus, Naverpay/Kakaopay/PG settings — 자세한 명단은 [`cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md) 링크)
+
+표 아래 본문 추가:
+
+```markdown
+> "⚠" 표기된 카테고리는 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. 일반 사용자가 무심코 체크 후 OAuth 진행 시 `invalid_scope` 로 실패할 수 있어, UI 에서 체크박스 옆에 ⚠ 아이콘 + tooltip + 폼 하단 경고 배너로 인지를 보장한다. Store 의 부분 제한은 scope 단위가 아닌 operation 단위라 노드 Operation 드롭다운 ([Spec Cafe24 노드 §2](../4-nodes/4-integration/4-cafe24.md#2-설정-ui)) 의 ⚠ 라벨이 1차 안내 지점이다. 명단 SoT 는 [`cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md).
+```
+
+### D5.3 §4.4 Scope & Permissions 탭 — 표에 행 추가
+
+기존 표:
+
+```diff
+| 요소 | 설명 |
+|------|------|
+| 현재 scope 목록 | `credentials.scopes[]` 전체를 체크된 상태로 표시 |
+| 권장 scope 목록 | 서비스별 프리셋. 현재 scope에 없는 항목은 체크 해제 상태 |
+| 누락 scope 배지 | `status_reason = insufficient_scope`일 때 누락 scope 목록을 빨간 뱃지로 강조 |
++ | 별도 승인 필요 ⚠ 배지 | 현재 scope·권장 scope·누락 scope 의 각 항목 옆에 `restrictedApproval` (메타데이터) 가 있는 scope/operation 만 ⚠ 배지 자동 노출. tooltip 본문은 [`cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md) §4.1 의 i18n 문구. `[Request scopes]` 버튼 위쪽에 "추가하려는 scope 중 N개는 카페24 별도 승인 필요" 보조 텍스트 (N=교집합 크기) |
+| `[Request scopes]` 버튼 | (기존 그대로) |
+```
+
+### D5.4 §9.4 공통 응답 포맷 — `INSUFFICIENT_SCOPE` 보강 필드 명시
+
+기존 `INSUFFICIENT_SCOPE (403)` 행 본문 갱신:
+
+```diff
+-  - `INSUFFICIENT_SCOPE` (403) — 노드 실행 중 감지 시 `Integration.status`도 갱신
++  - `INSUFFICIENT_SCOPE` (403) — 노드 실행 중 감지 시 `Integration.status` 도 갱신. `details.missingScopes: string[]` 에 누락 scope 목록을 담고, 그 중 카페24 별도 승인이 필요한 항목은 추가로 `details.requiresCafe24Approval: string[]` 에 채워 반환한다 (Cafe24 통합에 한정 — 다른 통합은 본 필드 미포함). frontend 는 `requiresCafe24Approval` 가 비어있지 않으면 에러 메시지에 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지를 추가 노출. 본 필드는 신규 에러 코드 없이 보강만 — 하위 호환 유지. 명단 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md).
+```
+
+### D5.5 §10.4 에러 매핑 — OAuth `invalid_scope` 분기 보강
+
+기존 §10.4 (에러 매핑) 에 다음 행 추가:
+
+```markdown
+| `oauth_invalid_scope` | OAuth callback 이 Cafe24 의 `invalid_scope` 응답을 받음. `last_error.details.requiresCafe24Approval: string[]` 에 요청 scope ∩ [`cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md) §1 의 교집합을 기록. 통합 상세 페이지가 본 단서를 읽어 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지 노출. status 는 보존 (재인증으로 회복 가능) |
+```
+
+### D5.6 Rationale — 신규 항목 추가
+
+`## Rationale` 섹션의 끝에 추가:
+
+```markdown
+### Cafe24 별도 승인 scope 의 식별·안내 (2026-05-17)
+
+**문제**: Cafe24 Admin API 중 mileage/notification/privacy 의 모든 scope 와 store 안 일부 operation (activitylogs, menus, naverpay/kakaopay/PG settings 등) 은 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. spec 에 이를 표현하는 차원이 없어 사용자가 위저드에서 일반 카테고리처럼 체크 → OAuth `invalid_scope` 거부 또는 호출 시 `INSUFFICIENT_SCOPE (403)` 으로 좌초. 원인 안내 장치 부재.
+
+**채택**: backend 메타데이터의 `Cafe24OperationMetadata.restrictedApproval` 필드와 catalog 의 `restricted` 컬럼을 SoT 로 두고, UI 4 화면 (위저드 / 상세 §4.4 / 노드 Operation 드롭다운 / AI Agent allowlist) 이 같은 필드를 읽어 ⚠ 배지·tooltip·경고 배너를 자동 렌더. 명단 SoT 는 신규 컨벤션 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md).
+
+**기각 대안**:
+- (A) 사용자가 체크 시 차단 — 이미 승인받은 합법 사용자 케이스를 막아버린다. 안내만, 차단 없음 정책 채택.
+- (B) 신규 에러 코드 추가 (`CAFE24_APPROVAL_REQUIRED`) — 기존 `INSUFFICIENT_SCOPE (403)` / `invalid_scope` 처리 경로를 분기시켜 client 코드 호환성에 영향. `details.requiresCafe24Approval` 보강 필드만으로 충분.
+- (C) catalog 의 `status` enum 에 `restricted` 값 추가 — supported / planned / deprecated 와는 직교 차원이라 enum 확장은 의미 오염. 별도 컬럼이 정답.
+
+**Trade-off**: mileage resource 안의 `credits_*` (예치금) 가 정확히 `mall.read_mileage` 를 쓰는지 vs 별도 scope (`mall.read_deposits` 등) 인지의 공식 분리 확인은 사용자 자료 범위 밖이므로, scope 단위 라벨링 (level='scope') 을 mileage resource 전체에 적용. 향후 공식 문서로 분리 확인되면 본 결정 정정.
+
+출처: 사용자 보고 (2026-05-17). consistency-check 세션: (예정).
+```
+
+---
+
+## D6. EDIT — `spec/4-nodes/4-integration/4-cafe24.md`
+
+### D6.1 §2 설정 UI — Operation 드롭다운 라벨링 추가
+
+기존 §2 의 Operation 드롭다운 설명 줄에 추가:
+
+```diff
+- Operation 후보 표시: 카탈로그 (`spec/conventions/cafe24-api-catalog/`) 의 `status: planned` 행도 dropdown 에 노출하되 disabled + "(지원 예정)" 접미사로 구분. resource 옆에 "지원 N개 · 추후 지원 M개" coverage hint.
++ Operation 후보 표시: 카탈로그 (`spec/conventions/cafe24-api-catalog/`) 의 `status: planned` 행도 dropdown 에 노출하되 disabled + "(지원 예정)" 접미사로 구분. resource 옆에 "지원 N개 · 추후 지원 M개" coverage hint.
++ - **별도 승인 라벨**: 메타데이터 row 에 `restrictedApproval` 이 있는 operation 은 라벨 우측에 ⚠ 아이콘 + 보조 텍스트 ("별도 승인 필요") 표시. resource 가 scope 단위 restricted (mileage/notification/privacy) 면 같은 resource 의 모든 operation 에 자동 적용. tooltip 본문·문의 링크는 [`spec/conventions/cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md) §4.1.
+```
+
+### D6.2 §8.3 allowlist — UI 라벨링 추가
+
+기존 §8.3 끝에 다음 문단 추가:
+
+```markdown
+**별도 승인 라벨 (UI)**: AI Agent allowlist 의 카테고리 단위 grouping UI 에서, scope 전체가 별도 승인 대상인 카테고리 (mileage/notification/privacy) 는 그룹 헤더에 ⚠ + "별도 승인 필요". store 안 일부 operation 단위 restricted (paymentgateway_*, activitylogs_*, menus_*, naverpay_setting_*, kakaopay_setting_*, financials_paymentgateway_get 등) 는 operation 행 단위로 같은 ⚠ 표기. backend 가 `mcpServers` 메타데이터 응답에 `restrictedApproval` 을 통과시켜 frontend 가 자동 렌더한다. 명단 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md).
+```
+
+### D6.3 §10 CHANGELOG 추가
+
+```markdown
+| 2026-05-17 | §2 Operation 드롭다운에 별도 승인 ⚠ 라벨 명세 + §8.3 AI Agent allowlist UI 의 동일 ⚠ 라벨 명세 추가. 메타데이터 `Cafe24OperationMetadata.restrictedApproval` 신설 ([cafe24-api-metadata 컨벤션 §2](../../conventions/cafe24-api-metadata.md#2-operation-메타데이터-형식)) + 카탈로그 `restricted` 컬럼 ([_overview §2](../../conventions/cafe24-api-catalog/_overview.md#2-표-컬럼-정의)) + SoT 컨벤션 [`cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md) 신설과 한 세트. 사용자 보고 (2026-05-17) — 카페24 본사 승인 필요 권한이 사용자에게 식별되지 않는 UX 문제 해소. consistency-check 세션: (예정). |
+```
+
+### D6.4 Rationale — 신규 항목 추가
+
+`## 9. Rationale` 의 끝에 추가:
+
+```markdown
+### 9.11 별도 승인 라벨 — 노드 Operation / AI Agent allowlist 의 ⚠ 표기
+
+UI 4 화면 (통합 위저드 / 통합 상세 §4.4 / 노드 Operation 드롭다운 / AI Agent allowlist) 의 라벨링은 같은 메타데이터 SoT (`Cafe24OperationMetadata.restrictedApproval`) 에서 자동 렌더. 명단의 진위는 [`cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md) 가 유일 출처이며, 본 노드 spec 은 그 라벨이 노드/AI Agent 의 어디에서 시각화되는지만 명시한다 — 명단을 직접 enumerate 하지 않는 이유는 drift 방지 (cafe24-api-metadata.md §3 의 "endpoint enumeration 을 spec 본문에 인라인하지 않는다" 정책과 동일).
+```
+
+---
+
+## D7. 영향 요약
+
+### 신규 파일
+
+- `spec/conventions/cafe24-restricted-scopes.md`
+
+### 수정 파일
+
+- `spec/conventions/cafe24-api-metadata.md` (§2 / §5 / CHANGELOG)
+- `spec/conventions/cafe24-api-catalog/_overview.md` (§2 / §4 / CHANGELOG)
+- `spec/conventions/cafe24-api-catalog/mileage.md` (헤더 + 전체 row)
+- `spec/conventions/cafe24-api-catalog/notification.md` (헤더 + 전체 row)
+- `spec/conventions/cafe24-api-catalog/privacy.md` (헤더 + 전체 row)
+- `spec/conventions/cafe24-api-catalog/store.md` (헤더 + 영향 16 row)
+- `spec/2-navigation/4-integration.md` (§3.2 / §4.4 / §5 / §9.4 / §10.4 / Rationale)
+- `spec/4-nodes/4-integration/4-cafe24.md` (§2 / §8.3 / §10 CHANGELOG / Rationale 9.11)
+
+### 신규 식별자 (충돌 검토 대상)
+
+- `restrictedApproval` (메타데이터 필드명)
+- `restricted` (catalog 표 컬럼명)
+- `requiresCafe24Approval` (API 에러 details 필드명)
+- `oauth_invalid_scope` (Integration.status_reason 값)
+- `level` enum: `scope` / `operation` / `program`
+- `category` enum: `mileage` / `notification` / `privacy` / `activitylogs` / `menus` / `pg_settings` / `naverpay_setting` / `kakaopay_setting` / `analytics`
+
+### 기각된 대안 (Rationale 에 기록)
+
+- 차단 정책 (사용자 안내만, 차단 없음)
+- 신규 에러 코드 (`CAFE24_APPROVAL_REQUIRED` 등 — 보강 필드로 대체)
+- catalog `status` enum 확장 (별도 컬럼이 정답)
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
+테스트는 카탈로그 MD 의 표를 파싱한다 — MD 표 구문이 깨지면 곧장 fail. 따라서 본 카탈로그는 **사람이 직접 손으로 수정하는 SoT** 이며, 코드 변경 시점에 반드시 카탈로그 동기 갱신을 함께 commit 해야 한다(`spec/conventions/cafe24-api-metadata.md` §5 의 신규 endpoint 추가 절차에 인용).
+
+## 5. Coverage Matrix
+
+2026-05-16 기준. 본 매트릭스는 카탈로그 row 수 + 메타데이터 row 수의 한 화면 요약이다 — 위 동기 테스트와 별개의 휴먼 가독성 보조 정보다. row 추가/삭제 시 본 표도 손으로 갱신한다.
+
+| Resource | Supported | Planned | Cafe24 docs sub-resource 수 |
+|----------|-----------|---------|---|
+| [store](./store.md) | 8 | 50+ | 50+ |
+| [product](./product.md) | 14 | 25+ | 28 |
+| [order](./order.md) | 17 | 30+ | 47 |
+| [customer](./customer.md) | 24 | 0 | 12 |
+| [community](./community.md) | 24 | 0 | 9 |
+| [design](./design.md) | 9 | 0 | 3 |
+| [promotion](./promotion.md) | 35 | 0 | 10 |
+| [application](./application.md) | 19 | 0 | 8 |
+| [category](./category.md) | 19 | 0 | 5 |
+| [collection](./collection.md) | 15 | 0 | 5 |
+| [supply](./supply.md) | 20 | 0 | 6 |
+| [shipping](./shipping.md) | 15 | 0 | 5 |
+| [salesreport](./salesreport.md) | 5 | 0 | 5 |
+| [personal](./personal.md) | 5 | 0 | 3 |
+| [privacy](./privacy.md) | 6 | 0 | 2 |
+| [mileage](./mileage.md) | 8 | 0 | 5 |
+| [notification](./notification.md) | 12 | 0 | 7 |
+| [translation](./translation.md) | 9 | 0 | 4 |
+| **합계** | **264** | **~109** | **~250** |
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
+> `spec/conventions/cafe24-api-metadata.md` §5 의 신규 endpoint 추가 절차도 본 카탈로그 row 갱신을 step 으로 포함한다.
+
+## 7. CHANGELOG
+
+| 일자 | 변경 |
+|------|------|
+| 2026-05-16 | 신규 컨벤션 — 18 resource 카탈로그 + 양방향 동기 테스트 도입. 사용자 결정(2026-05-16) "Cafe24 docs 전수 등재" 에 따라 supported 53 + planned ~300 으로 초기 채움. |
+| 2026-05-16 (coverage Phase 5a) | Order resource — `order_count`, `order_status_update`, `order_status_update_multiple` 3건을 planned → supported 로 승격 (backend metadata + planned.ts mirror 동시 갱신). order supported 6 → 9, 합계 53 → 56. |
+| 2026-05-16 (coverage Phase 5b) | Product resource — `product_count`, `product_options_list/create/update/delete`, `product_seo_get/update` 7건을 planned → supported 로 승격. product supported 7 → 14, 합계 56 → 63. |
+| 2026-05-16 (coverage Phase 5c) | Customer resource — 회원 메모 CRUD 완성: `customer_memos_count/list/get/update/delete` 5건을 planned → supported 로 승격. customer supported 5 → 10, 합계 63 → 68. |
+| 2026-05-16 (coverage Phase 5d) | Promotion resource — 쿠폰 보완: `coupon_count`, `coupon_issues_list`, `coupon_issuance_customers_list`, `customers_coupons_list`, `customers_coupons_count` 5건을 planned → supported 로 승격. promotion supported 5 → 10, 합계 68 → 73. |
+| 2026-05-16 (coverage Phase 5e) | Salesreport resource 완성 — `salesreport_monthly`, `salesreport_hourly`, `salesreport_volume` 3건을 planned → supported 로 승격. salesreport supported 2 → 5, planned 3 → 0, 합계 73 → 76. salesreport resource 의 첫 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 5f) | Promotion resource — 시리얼쿠폰 5건 (`serialcoupons_list`, `serialcoupons_generate`, `serialcoupons_delete`, `serialcoupons_issues_get`, `serialcoupons_issues_register`) 를 planned → supported 로 승격. promotion supported 10 → 15, 합계 76 → 81. |
+| 2026-05-16 (coverage Phase 6a) | Order resource — A/S 자동화 8건 (`refunds_list/get`, `cancellation_get/create_multiple`, `exchange_get/create_multiple`, `return_get/create_multiple`) 를 planned → supported 로 승격. order supported 9 → 17, 합계 81 → 89. |
+| 2026-05-16 (coverage Phase 6b) | Store resource — 결제 설정 6건 (`paymentmethods_list`, `paymentmethods_paymentproviders_list`, `paymentgateway_paymentmethods_list`, `paymentgateway_create/update/delete`) 를 planned → supported 로 승격. store supported 2 → 8, 합계 89 → 95. |
+| 2026-05-16 (coverage Phase 6c) | Promotion resource — 회원 혜택 CRUD 6건 + 회원 정보 이벤트 3건 + customers_coupons_delete 1건 = 10건. promotion supported 15 → 25, 합계 95 → 105. |
+| 2026-05-16 (coverage Phase 6d) | Category/Collection/Supply/Shipping baseline 10건 — category(category_count/mains_list/autodisplay_list), collection(brands count/create/update/delete), supply(suppliers_count/get), shipping(carriers_get). 합계 105 → 115. |
+| 2026-05-16 (coverage Phase 6e) | Mileage resource — 적립금 자동 만료 3건 (`points_autoexpiration_get/create/delete`) + 예치금 2건 (`credits_list`, `credits_report`) = 5건. mileage supported 2 → 7, 합계 115 → 120. |
+| 2026-05-16 (coverage Phase 6f) | Notification resource — SMS 2건 (`sms_senders_list`, `sms_receivers_get`) + automails 2건 (`automails_get/update`) + recipientgroups 2건 (`recipientgroups_list/get`) = 6건. notification supported 2 → 8, 합계 120 → 126. |
+| 2026-05-16 (coverage Phase 6g) | Translation resource — products_update + categories list/update + store list/update + themes list 6건. translation supported 1 → 7, 합계 126 → 132. 본 사이클 (Phase 6 a~g) 종료. |
+| 2026-05-16 (coverage Phase 7a) | Promotion resource — discountcodes CRUD 5건 + commonevents CRUD 4건 = 9건. promotion supported 25 → 34, 합계 132 → 141. |
+| 2026-05-16 (coverage Phase 7b) | Customer resource 완성 — 회원 14건 (paymentinfo 3 + properties 2 + customergroups 4 + delete + autoupdate + plusapp + social + social_list). customer supported 10 → 24, planned 14 → 0, 합계 141 → 155. customer 두 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 7c) | Community resource — boards 설정 2건 + boards 글 CRUD 3건 + comments 3건 + commenttemplates 2건 = 10건. community supported 3 → 13, 합계 155 → 165. |
+| 2026-05-16 (coverage Phase 7d) | Application resource — apps_update + scripttags CRUD 5건 + webhooks_update + webhooks_logs_list = 8건. application supported 3 → 11, 합계 165 → 173. |
+| 2026-05-16 (coverage Phase 7e) | Shipping resource 완성 — carriers CRUD 3건 + regionalsurcharges 2건 + shipping_settings 2건 + shipping_additionalfees_countries + shippingorigins CRUD 5건 = 13건. shipping supported 2 → 15, planned 13 → 0, 합계 173 → 186. shipping 세 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 7f) | Category resource 완성 — decorationimages 2건 (get/update) + seo 2건 (get/update) + mains 3건 (add/update/delete) + autodisplay 3건 (create/update/delete) = 10건. category supported 9 → 19, planned 10 → 0, 합계 186 → 196. category 네 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 7g) | Supply resource 완성 — suppliers CUD 3건 + suppliers_users CRUD 6건 + suppliers_users regional shipping 5건 + shipping_suppliers 3건 = 17건. supply supported 3 → 20, planned 17 → 0, 합계 196 → 213. supply 다섯 번째 0-planned resource. 본 사이클 (Phase 7 a~g) 종료. |
+| 2026-05-16 (coverage Phase 8a) | Mileage resource 완성 — `points_report` 1건. mileage supported 7 → 8, planned 1 → 0, 합계 213 → 214. mileage 여섯 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 8b) | Promotion resource 완성 — `coupon_manage` 1건 (use_coupon T/F 토글). promotion supported 34 → 35, planned 1 → 0, 합계 214 → 215. promotion 일곱 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 8c) | Translation resource 완성 — 테마 번역 단건 조회/수정 2건. translation supported 7 → 9, planned 2 → 0, 합계 215 → 217. translation 여덟 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 8d) | Personal resource 완성 — `customers_wishlist_count` + `products_carts_count` + `products_carts_list` 3건. personal supported 2 → 5, planned 3 → 0, 합계 217 → 220. personal 아홉 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 8e) | Notification resource 완성 — `customers_invitation_send` + recipientgroups CUD 3건 = 4건. notification supported 8 → 12, planned 4 → 0, 합계 220 → 224. notification 열 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 8f) | Privacy resource 완성 — customers_privacy list/count/update 3건 + products_wishlist_customers list/count 2건 = 5건. privacy supported 1 → 6, planned 5 → 0, 합계 224 → 229. privacy 열한 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 8g) | Application resource 완성 — appstore_orders get/create 2건 + appstore_payments list/count 2건 + databridge_logs_list + recipes list/create/delete 3건 = 8건. application supported 11 → 19, planned 8 → 0, 합계 229 → 237. application 열두 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 8h) | Collection resource 완성 — manufacturers count/get/create/update 4건 + trends_count + classifications list/count 2건 + origin_list = 8건. collection supported 7 → 15, planned 8 → 0, 합계 237 → 245. collection 열세 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 8i) | Design resource 완성 — themes count/get 2건 + theme_pages CRUD 4건 (get/create/update/delete) + icons_list + icons_update_settings = 8건. design supported 1 → 9, planned 8 → 0, 합계 245 → 253. design 열네 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 8j) | Community resource 완성 — boards_comments_bulk + boards_seo get/update 2건 + commenttemplates get/update/delete 3건 + financials_monthlyreviews_count + urgentinquiry get/reply CRUD 4건 = 11건. community supported 13 → 24, planned 11 → 0, 합계 253 → 264. community 열다섯 번째 0-planned resource. 본 사이클 (Phase 8 a~j) 종료. |
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
+| `apps_update` | 앱 정보 수정 | Update an app information | PUT | `apps` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-app-information) |
+| `appstore_orders_get` | 앱스토어 주문 조회 | Retrieve a Cafe24 store order | GET | `appstore/orders/{order_id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retreive-a-cafe24-store-order) |
+| `appstore_orders_create` | 앱스토어 주문 생성 | Create a Cafe24 store order | POST | `appstore/orders` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-cafe24-store-order) |
+| `appstore_payments_list` | 앱스토어 결제 목록 | Retrieve a list of Cafe24 store payments | GET | `appstore/payments` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-cafe24-store-payments) |
+| `appstore_payments_count` | 앱스토어 결제 수 | Retrieve a count of Cafe24 store payments | GET | `appstore/payments/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-cafe24-store-payments) |
+| `databridge_logs_list` | DataBridge 로그 목록 | Retrieve a list of DataBridge webhook logs | GET | `databridge/logs` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-databridge-webhook-logs) |
+| `recipes_list` | 레시피 목록 조회 | Retrieve a list of recipes | GET | `recipes` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-recipes) |
+| `recipes_create` | 레시피 생성 | Create a recipe | POST | `recipes` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-recipe) |
+| `recipes_delete` | 레시피 삭제 | Delete a recipe | DELETE | `recipes/{recipe_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-recipe) |
+| `scripttags_count` | 스크립트태그 개수 조회 | Retrieve a count of script tags | GET | `scripttags/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-script-tags) |
+| `scripttags_get` | 스크립트태그 단건 조회 | Retrieve a script tag | GET | `scripttags/{tag_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-script-tag) |
+| `scripttags_create` | 스크립트태그 생성 | Create a script tag | POST | `scripttags` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-script-tag) |
+| `scripttags_update` | 스크립트태그 수정 | Update a script tag | PUT | `scripttags/{tag_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-script-tag) |
+| `scripttags_delete` | 스크립트태그 삭제 | Delete a script tag | DELETE | `scripttags/{tag_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-script-tag) |
+| `webhooks_logs_list` | Webhook 로그 목록 | Retrieve a list of webhook logs | GET | `webhooks/logs` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-webhook-logs) |
+| `webhooks_update` | Webhook 설정 수정 | Edit webhook settings | PUT | `webhooks` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-webhook-settings) |
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
+| `category_count` | 카테고리 개수 조회 | Retrieve a count of product categories | GET | `categories/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-product-categories) |
+| `category_decorationimages_get` | 카테고리 꾸미기 이미지 조회 | Retrieve decoration image settings by category | GET | `categories/{category_no}/decorationimages` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-decoration-image-settings-by-category) |
+| `category_decorationimages_update` | 카테고리 꾸미기 이미지 수정 | Update decoration images of a product category | PUT | `categories/{category_no}/decorationimages` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-decoration-images-of-a-product-category) |
+| `category_seo_get` | 카테고리 SEO 조회 | Retrieve SEO settings by category | GET | `categories/{category_no}/seo` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-seo-settings-by-category) |
+| `category_seo_update` | 카테고리 SEO 수정 | Update a product category SEO | PUT | `categories/{category_no}/seo` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-category-seo) |
+| `mains_list` | 메인 카테고리 목록 조회 | Retrieve a list of main categories | GET | `mains` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-main-categories) |
+| `mains_add` | 메인 카테고리 추가 | Add main category | POST | `mains` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#add-main-category) |
+| `mains_update` | 메인 카테고리 수정 | Update main category | PUT | `mains/{main_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-main-category) |
+| `mains_delete` | 메인 카테고리 삭제 | Delete main category | DELETE | `mains/{main_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-main-category) |
+| `autodisplay_list` | 자동 진열 목록 조회 | Retrieve a list of auto layouts | GET | `autodisplay` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-auto-layouts) |
+| `autodisplay_create` | 자동 진열 생성 | Create auto layout for selected product category | POST | `autodisplay` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-auto-layout-for-selected-product-category) |
+| `autodisplay_update` | 자동 진열 수정 | Update auto layout for selected product category | PUT | `autodisplay/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-auto-layout-for-selected-product-category) |
+| `autodisplay_delete` | 자동 진열 삭제 | Delete auto layout for selected product category | DELETE | `autodisplay/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-auto-layout-for-selected-product-category) |
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
+| `brands_count` | 브랜드 개수 조회 | Retrieve a count of brands | GET | `brands/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-brands) |
+| `brands_create` | 브랜드 생성 | Create a brand | POST | `brands` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-brand) |
+| `brands_update` | 브랜드 수정 | Update a brand | PUT | `brands/{brand_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-brand) |
+| `brands_delete` | 브랜드 삭제 | Delete a brand | DELETE | `brands/{brand_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-brand) |
+| `manufacturers_count` | 제조사 개수 조회 | Retrieve a count of manufacturers | GET | `manufacturers/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-manufacturers) |
+| `manufacturers_get` | 제조사 단건 조회 | Retrieve a manufacturer | GET | `manufacturers/{manufacturer_code}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-manufacturer) |
+| `manufacturers_create` | 제조사 생성 | Create a manufacturer | POST | `manufacturers` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-manufacturer) |
+| `manufacturers_update` | 제조사 수정 | Update a manufacturer | PUT | `manufacturers/{manufacturer_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-manufacturer) |
+| `trends_count` | 트렌드 개수 조회 | Retrieve a count of trends | GET | `trends/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-trends) |
+| `classifications_list` | 사용자 정의 카테고리 목록 | Retrieve a list of custom categories | GET | `classifications` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-custom-categories) |
+| `classifications_count` | 사용자 정의 카테고리 수 | Retrieve a count of custom categories | GET | `classifications/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-custom-categories) |
+| `origin_list` | 원산지 목록 조회 | Retrieve a list of origins | GET | `origin` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-origins) |
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
+| `boards_settings_get` | 게시판 설정 조회 | Retrieve the board settings | GET | `boards/{board_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-board-settings) |
+| `boards_settings_update` | 게시판 설정
+
+... (truncated due to size limit) ...

```

---

### 파일 31: review/consistency/2026/05/17/12_12_46/_prompts/cross_spec.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 32: review/consistency/2026/05/17/12_12_46/_prompts/naming_collision.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 33: review/consistency/2026/05/17/12_12_46/_prompts/plan_coherence.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/17/12_12_46/_prompts/plan_coherence.md b/review/consistency/2026/05/17/12_12_46/_prompts/plan_coherence.md
new file mode 100644
index 00000000..a6c25455
--- /dev/null
+++ b/review/consistency/2026/05/17/12_12_46/_prompts/plan_coherence.md
@@ -0,0 +1,899 @@
+# Plan 정합성 Check Payload
+
+본 파일은 orchestrator 가 Plan 정합성 checker 용으로 작성한 입력입니다. `plan/in-progress/**` 의 진행 중 작업·미해결 결정과 target 문서가 정합한지 분석한다.
+sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
+따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
+인자가 가리키는 경로에 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.
+
+## 점검 관점 (Plan 정합성)
+
+1. **미해결 결정과의 충돌** — target 이 plan 에서 "결정 필요" 로 남겨둔 항목과 충돌하는 결정을 일방적으로 내리고 있지 않은가
+2. **중복 작업** — target 이 이미 다른 plan 에서 진행 중인 작업과 동일한 영역을 손대고 있는가 (병렬 worktree 경합 위험)
+3. **선행 plan 미해소** — target 이 가정하는 사전 조건이 plan 에서 아직 해결되지 않았는가
+4. **후속 항목 누락** — target 변경이 다른 plan 의 후속 항목을 무효화하거나 새로 만들어야 하는데 반영되지 않았는가
+5. **worktree 충돌** — 동일 spec 파일을 target plan 과 다른 worktree 가 동시에 손대고 있는지 (plan frontmatter `worktree` 필드 확인)
+
+## 검토 모드
+spec draft 검토 (--spec)
+
+## Target 문서
+경로: `plan/in-progress/spec-draft-cafe24-restricted-scopes.md`
+
+```
+---
+worktree: cafe24-restricted-scopes-a1b2c3
+started: 2026-05-17
+owner: project-planner
+type: spec-draft
+target_specs:
+  - spec/conventions/cafe24-restricted-scopes.md (NEW)
+  - spec/conventions/cafe24-api-metadata.md
+  - spec/conventions/cafe24-api-catalog/_overview.md
+  - spec/conventions/cafe24-api-catalog/mileage.md
+  - spec/conventions/cafe24-api-catalog/notification.md
+  - spec/conventions/cafe24-api-catalog/privacy.md
+  - spec/conventions/cafe24-api-catalog/store.md
+  - spec/2-navigation/4-integration.md
+  - spec/4-nodes/4-integration/4-cafe24.md
+---
+
+# SPEC DRAFT: Cafe24 별도 승인 scope/operation 식별 메타데이터 도입
+
+본 draft 는 `/consistency-check --spec` 사전 검토용 변경안 본문이다. 승인 후 각 target_spec 에 반영한다.
+
+---
+
+## D1. NEW — `spec/conventions/cafe24-restricted-scopes.md`
+
+```markdown
+# CONVENTION: Cafe24 별도 승인이 필요한 Scope · Operation
+
+> 관련 문서: [Cafe24 API Metadata 컨벤션](./cafe24-api-metadata.md) · [Cafe24 API Catalog](./cafe24-api-catalog/_overview.md) · [Spec 통합 화면 §5.8 Cafe24](../2-navigation/4-integration.md#58-cafe24)
+
+Cafe24 Admin API 의 일부 scope·operation 은 카페24 본사가 별도로 승인한 클라이언트만 사용할 수 있다. 공식 문서가 다음 문구로 명시한다:
+
+> "해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요."
+
+본 컨벤션은 그 명단을 single-source-of-truth 로 박제한다. backend 메타데이터의 `restrictedApproval` 필드 (cafe24-api-metadata 컨벤션 §2) 와 catalog 파일의 `restricted` 컬럼 (cafe24-api-catalog _overview §2) 이 본 명단과 일치해야 하며, `catalog-sync.spec.ts` 가 동기 검증을 강제한다.
+
+---
+
+## 1. Scope 단위 별도 승인 (resource 전체 영향)
+
+해당 scope 가 부여된 OAuth 동의 자체가 본사 승인 없이는 실패한다. 자매 operation 모두 영향을 받는다.
+
+| Scope | Resource (catalog 파일) | 설명 |
+|---|---|---|
+| `mall.read_mileage` | [mileage.md](./cafe24-api-catalog/mileage.md) | 적립금 조회 |
+| `mall.write_mileage` | [mileage.md](./cafe24-api-catalog/mileage.md) | 적립금 수정 |
+| `mall.read_notification` | [notification.md](./cafe24-api-catalog/notification.md) | 알림 조회 |
+| `mall.write_notification` | [notification.md](./cafe24-api-catalog/notification.md) | 알림 발송 |
+| `mall.read_privacy` | [privacy.md](./cafe24-api-catalog/privacy.md) | 개인정보 조회 |
+| `mall.write_privacy` | [privacy.md](./cafe24-api-catalog/privacy.md) | 개인정보 수정 |
+
+> 위 카탈로그의 모든 row 는 catalog 표의 `restricted` 컬럼 = `scope`, backend 메타데이터의 `restrictedApproval.level='scope'` 로 표기된다.
+
+## 2. Operation 단위 별도 승인 (store scope 안의 일부)
+
+`mall.read_store` / `mall.write_store` 자체는 일반 사용 가능하지만, 안의 일부 operation 만 별도 승인 대상이다. 카탈로그 표에서 해당 row 만 `restricted: op` 로 표기한다.
+
+| 영역 | 영향 operation id (catalog [store.md](./cafe24-api-catalog/store.md)) | 설명 |
+|---|---|---|
+| Activitylogs | `activitylogs_list`, `activitylogs_get` | 활동 로그 목록/상세 조회 |
+| Financials paymentgateway | `financials_paymentgateway_get` | PG사 계약정보 조회 |
+| Menus | `menus_get` | 메뉴 조회 |
+| Naverpay setting | `naverpay_setting_get`, `naverpay_setting_create`, `naverpay_setting_update` | 네이버페이 설정 조회·등록·수정 |
+| Kakaopay setting | `kakaopay_setting_get`, `kakaopay_setting_update` | 카카오페이 설정 조회·수정 |
+| Paymentgateway | `paymentgateway_create`, `paymentgateway_update`, `paymentgateway_delete` | PG 생성·수정·삭제 |
+| Paymentgateway paymentmethods | `paymentgateway_paymentmethods_list`, `paymentgateway_paymentmethods_create`, `paymentgateway_paymentmethods_update`, `paymentgateway_paymentmethods_delete` | PG 결제수단 목록/생성·수정·삭제 |
+
+## 3. 별도 프로그램 승인
+
+카페24 승인 제휴사에만 제공되는 별도 트랙. 본 프로젝트는 현재 직접 호출 경로를 구현하지 않으며, 본 명단은 향후 도입을 위한 placeholder 다.
+
+| API | 설명 |
+|---|---|
+| Cafe24 Analytics API | 카페24 승인 제휴사에만 제공. 쇼핑몰 사용자 행동 데이터 제공 서비스 제작 용도 |
+
+## 4. 사용 정책
+
+### 4.1 사용자 안내 (UI)
+
+위 §1·§2 의 항목은 다음 4 화면에서 동일한 ⚠ 배지·tooltip 으로 표기된다:
+
+1. **통합 추가 위저드 Step 2 Scope 체크박스** (Spec 통합 화면 §3.2 Cafe24 Public/Private)
+2. **통합 상세 §4.4 Scope & Permissions 탭** (현재 scope · 권장 scope · 누락 scope 모두)
+3. **Cafe24 노드 Operation 드롭다운** (Spec Cafe24 노드 §2)
+4. **AI Agent allowlist UI** (Spec Cafe24 노드 §8.3, Spec MCP Client §5.6)
+
+배지 hover 시 tooltip 문구 (한국어):
+
+> "카페24 본사 승인이 필요한 권한입니다. 미승인 상태로 동의를 시도하면 `invalid_scope` 로 실패하거나, 인증 후 호출 시 403 이 반환될 수 있어요. [Cafe24 개발자센터 문의 →]"
+
+영어 (i18n):
+
+> "This permission requires Cafe24 partner approval. Without approval, the OAuth flow may reject it as `invalid_scope`, or API calls may return 403. [Contact Cafe24 Developer Center →]"
+
+### 4.2 차단 정책
+
+체크/저장은 **차단하지 않는다**. 이미 본사 승인을 받은 사용자가 있을 수 있으므로 "알고 누른다" 만 보장. 단 체크된 권한 중 별도 승인 필요 항목이 1개 이상이면 위저드 Step 2 폼 하단에 **영구 amber 경고 배너**를 띄운다 (사용자가 인지하지 못한 채 진행하는 사례 차단).
+
+### 4.3 에러 안내 (에러 발생 후)
+
+- **OAuth `invalid_scope`**: backend 의 cafe24 OAuth callback 이 응답을 파싱 후 요청한 scopes ∩ 본 명단 §1 의 교집합이 비어있지 않으면 `Integration.status_reason='oauth_invalid_scope'` 와 함께 `last_error.details.requiresCafe24Approval: string[]` 에 영향 scope 를 기록. 통합 상세 페이지가 본 단서를 읽어 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지 노출.
+- **노드 실행 중 `INSUFFICIENT_SCOPE (403)`**: 응답 `details.requiresCafe24Approval: string[]` 에 사용 scope ∩ 본 명단의 교집합을 채워 보낸다. frontend 가 본 필드가 비어있지 않으면 별도 승인 안내 분기 메시지를 노출.
+
+### 4.4 신규 코드 추가 없음
+
+기존 `OAuth invalid_scope` 분기, `INSUFFICIENT_SCOPE (403)` 응답 모두 그대로 유지하고 `details.requiresCafe24Approval` 보강 필드로만 표현. 새 HTTP 상태/에러 코드 vocabulary 추가는 하지 않는다 (하위 호환).
+
+## 5. 명단 갱신 절차
+
+1. Cafe24 공식 문서를 다시 확인해 본 명단의 진위·추가/삭제를 검증.
+2. 본 문서의 §1·§2·§3 표 갱신.
+3. 영향받는 catalog 파일 (`mileage.md` / `notification.md` / `privacy.md` / `store.md` / 추가 영향 resource) 의 `restricted` 컬럼 갱신.
+4. backend 메타데이터의 `restrictedApproval` 필드 동시 갱신.
+5. `npm test --workspace backend -- catalog-sync` 로 양방향 동기 확인.
+6. UI 4 화면에서 ⚠ 표기가 새 명단을 따라 자동 갱신되는지 시각 회귀 (해당 컴포넌트는 메타데이터 기반 자동 렌더링).
+
+## 6. 참고 링크
+
+- Cafe24 Admin API 공식 문서: https://developers.cafe24.com/docs/api/admin/
+- Scope별 사용 동의 가이드: https://developers.cafe24.com/app/front/app/develop/api/scope
+- Cafe24 Analytics API: https://developers.cafe24.com/docs/ko/api/cafe24data/
+- 카페24 개발자센터 문의: https://developers.cafe24.com
+
+## 7. CHANGELOG
+
+| 일자 | 변경 |
+|------|------|
+| 2026-05-17 | 신규 컨벤션 — 사용자 보고 (질문에서 제공한 표) 와 공식 문서 안내 문구를 기반으로 별도 승인 대상 명단 정식 등재. backend 메타데이터 `restrictedApproval` 필드 + catalog `restricted` 컬럼과 함께 도입. consistency-check 세션: (예정). |
+```
+
+---
+
+## D2. EDIT — `spec/conventions/cafe24-api-metadata.md`
+
+### D2.1 §2 Operation 메타데이터 형식 — 필드 추가
+
+기존 인터페이스 정의 (§2) 의 끝에 추가:
+
+```diff
+  responseShape?: 'list' | 'single' | 'empty';
+  paginated?: boolean;
++
++  // 별도 승인 라벨링 — [cafe24-restricted-scopes 컨벤션](./cafe24-restricted-scopes.md)
++  // 의 명단과 일치해야 하며, catalog-sync.spec.ts 가 카탈로그 row 의
++  // `restricted` 컬럼과 양방향 동기를 검증한다.
++  restrictedApproval?: {
++    level: 'scope' | 'operation' | 'program';
++    category:
++      | 'mileage' | 'notification' | 'privacy'         // scope 전체
++      | 'activitylogs' | 'menus' | 'pg_settings'        // store 안 operation 단위
++      | 'naverpay_setting' | 'kakaopay_setting'
++      | 'analytics';                                    // 별도 프로그램 (placeholder)
++    docsUrl?: string;
++    inquiryUrl: string;                                 // 카페24 개발자센터 안내 링크
++  };
+}
+```
+
+§2 본문 아래에 다음 문단 추가:
+
+```markdown
+**`restrictedApproval` 의 의미**
+
+본 필드는 카페24 본사가 별도 승인한 클라이언트만 호출할 수 있는 operation 을 식별한다. 명단의 single-source-of-truth 는 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md). UI 4 화면 (위저드 / 통합 상세 Scope 탭 / Cafe24 노드 Operation 드롭다운 / AI Agent allowlist) 이 본 필드를 읽어 ⚠ 배지·tooltip 을 자동 렌더한다. `level='scope'` 인 row 는 같은 resource (mileage/notification/privacy) 의 모든 자매 operation 에 같은 라벨이 자동 적용되므로 backend 메타데이터에서는 row 별로 빠짐없이 채운다.
+```
+
+### D2.2 §5 신규 endpoint 추가 절차 — 단계 추가
+
+기존 §5 의 step 5 (카탈로그 row 갱신) 본문에 다음 항목 추가:
+
+```diff
+5. [`cafe24-api-catalog/<resource>.md`](./cafe24-api-catalog/_overview.md) 의 표에 해당 row 의 `status` 를 `planned → supported` 로 갱신하고 `method` / `path` / `scope` / `paginated` 컬럼을 채운다. 카탈로그에 row 자체가 없으면 새로 추가.
++   - 추가로 별도 승인 대상인 경우 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md) 명단과 비교해 catalog 의 `restricted` 컬럼(`scope` / `op` / 빈칸) 과 backend 메타데이터의 `restrictedApproval` 필드를 동시 갱신한다.
+```
+
+§5 의 step 7 (백엔드 단위 테스트 검증) 본문에 다음 줄 추가:
+
+```diff
+   - **카탈로그 ↔ 메타데이터 양방향 동기** (`catalog-sync.spec.ts`)
++   - **restricted 컬럼 ↔ `restrictedApproval` 양방향 동기** (`catalog-sync.spec.ts`) — catalog 가 `scope` 또는 `op` 면 메타데이터에 `restrictedApproval` 존재, 그 역도 동일.
+```
+
+### D2.3 §8 CHANGELOG 추가
+
+```markdown
+| 2026-05-17 | §2 `Cafe24OperationMetadata.restrictedApproval` optional 필드 추가 + §5 절차에 catalog `restricted` 컬럼 동시 갱신 의무 명문화. SoT 는 신규 컨벤션 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md). 사용자 보고 — 카페24 본사 승인 필요 권한이 사용자에게 식별되지 않는 UX 문제 해소. consistency-check 세션: (예정). |
+```
+
+---
+
+## D3. EDIT — `spec/conventions/cafe24-api-catalog/_overview.md`
+
+### D3.1 §2 표 컬럼 정의 — 컬럼 추가
+
+기존 표에서 `status` 행 위에 다음 행 삽입:
+
+```markdown
+| `restricted` | — | `scope` / `op` / 빈칸. `scope` = 본 scope 자체가 카페24 별도 승인 대상이라 같은 resource 의 모든 row 가 영향. `op` = 본 row 만 단독 승인 대상 (store 안 케이스). 빈칸 = 일반 사용 가능. 명단의 SoT 는 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md) |
+```
+
+### D3.2 §4 동기 정책 — 검증 규칙 추가
+
+기존 검증 규칙 7번 뒤에 8번 추가:
+
+```markdown
+8. **`restricted` 컬럼 ↔ 메타데이터 `restrictedApproval` 동기**: catalog row 의 `restricted` 컬럼이 `scope` 또는 `op` 이면 그 row 에 대응하는 backend 메타데이터에 `restrictedApproval` 필드가 존재해야 하고 그 역도 동일. 컬럼 값과 메타데이터 `level` 의 매핑은: `scope` ↔ `level='scope'`, `op` ↔ `level='operation'`. `level='program'` 은 본 catalog 와 별개로 다뤄진다 (Analytics 등 catalog 화 대상이 아닌 트랙).
+```
+
+### D3.3 §7 CHANGELOG 추가
+
+```markdown
+| 2026-05-17 | §2 에 `restricted` 컬럼 추가 + §4 에 검증 규칙 8 신설. 카페24 별도 승인 대상 식별 — SoT 는 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md). 사용자 보고 (질문에서 제공한 표) 후속. |
+```
+
+---
+
+## D4. EDIT — catalog 표 (영향 resource)
+
+### D4.1 `mileage.md` — 표 헤더 + 모든 row 갱신
+
+표 헤더에 `restricted` 컬럼 추가 (scope 와 paginated 사이):
+
+```diff
+- | id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
+- |----|---|---|---|---|---|---|---|---|
++ | id | 라벨 (한) | English title | method | path | scope | restricted | paginated | status | docs |
++ |----|---|---|---|---|---|---|---|---|---|
+```
+
+모든 supported row 의 `restricted` 컬럼 = `scope`. 예:
+
+```markdown
+| `mileage_list` | 적립금 내역 조회 | Retrieve points | GET | `points` | read | scope | ✓ | supported | [↗](...) |
+| `mileage_grant` | 적립금 지급 | Issue and deduct points | POST | `points` | write | scope |  | supported | [↗](...) |
+| `points_autoexpiration_get` | 적립금 자동 만료 조회 | Retrieve an automatic points expiration | GET | `points/autoexpiration/{id}` | read | scope |  | supported | [↗](...) |
+| `points_autoexpiration_create` | 적립금 자동 만료 생성 | Create an automatic points expiration | POST | `points/autoexpiration` | write | scope |  | supported | [↗](...) |
+| `points_autoexpiration_delete` | 적립금 자동 만료 삭제 | Delete an automatic points expiration | DELETE | `points/autoexpiration/{id}` | write | scope |  | supported | [↗](...) |
+| `points_report` | 적립금 리포트 조회 | Retrieve a points report by date range | GET | `points/report` | read | scope |  | supported | [↗](...) |
+| `credits_list` | 예치금 내역 조회 | Retrieve a list of credits by date range | GET | `credits` | read | scope | ✓ | supported | [↗](...) |
+| `credits_report` | 예치금 리포트 조회 | Retrieve a credit report by date range | GET | `credits/report` | read | scope |  | supported | [↗](...) |
+```
+
+### D4.2 `notification.md` — 동일 패턴
+
+12 supported row 모두 `restricted: scope`.
+
+### D4.3 `privacy.md` — 동일 패턴
+
+6 supported row 모두 `restricted: scope`.
+
+### D4.4 `store.md` — 영향 row 만 갱신
+
+전체 헤더에 `restricted` 컬럼 추가. 빈칸이 기본이며 다음 row 만 `restricted: op`:
+
+- `activitylogs_list` (planned)
+- `activitylogs_get` (planned)
+- `financials_paymentgateway_get` (planned)
+- `menus_get` (planned)
+- `naverpay_setting_get` (planned)
+- `naverpay_setting_create` (planned)
+- `naverpay_setting_update` (planned)
+- `kakaopay_setting_get` (planned)
+- `kakaopay_setting_update` (planned)
+- `paymentgateway_create` (supported)
+- `paymentgateway_update` (supported)
+- `paymentgateway_delete` (supported)
+- `paymentgateway_paymentmethods_list` (supported)
+- `paymentgateway_paymentmethods_create` (planned)
+- `paymentgateway_paymentmethods_update` (planned)
+- `paymentgateway_paymentmethods_delete` (planned)
+
+> 참고: `paymentmethods_list` / `paymentmethods_paymentproviders_list` 는 사용자 자료에 명시되지 않았으므로 빈칸 유지. 향후 공식 문서 재검증 시 갱신.
+
+---
+
+## D5. EDIT — `spec/2-navigation/4-integration.md`
+
+### D5.1 §3.2 Cafe24 Public 흐름 — Step 2 폼 안내 추가
+
+기존 Step 2 의 끝에 다음 노트 추가:
+
+```markdown
+> **별도 승인 필요 권한 안내** — 체크박스 옆 ⚠ 아이콘이 표시된 카테고리·operation 은 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. 명단의 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md). 체크 자체는 차단하지 않으나, 체크된 권한 중 별도 승인 대상이 1개 이상이면 폼 하단에 영구 amber 경고 배너를 띄운다. 미승인 상태로 진행하면 OAuth 단계에서 `invalid_scope` 또는 호출 시 `INSUFFICIENT_SCOPE (403)` 으로 실패할 수 있음을 안내. tooltip 문구 / 경고 배너 / 에러 분기 메시지의 i18n 키 정의는 같은 컨벤션 §4 참고.
+```
+
+### D5.2 §5 Scope 권장 프리셋 표 — "별도 승인" 컬럼 추가
+
+기존 표:
+
+```diff
+- | 카테고리 | scope 값 (R / W) |
+- |---------|------------------|
++ | 카테고리 | scope 값 (R / W) | 별도 승인 |
++ |---------|------------------|----------|
+```
+
+각 행의 마지막 컬럼:
+
+- 일반 카테고리 (Product, Order, Customer, Category, Promotion, Shipping, Sales report, Translation, Application, Design, Community, Collection, Supply, Personal): 빈칸
+- Mileage, Notification, Privacy: `⚠ 필요` (R/W 모두)
+- Store: `⚠ 일부 sub-resource` (Activitylogs, Menus, Naverpay/Kakaopay/PG settings — 자세한 명단은 [`cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md) 링크)
+
+표 아래 본문 추가:
+
+```markdown
+> "⚠" 표기된 카테고리는 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. 일반 사용자가 무심코 체크 후 OAuth 진행 시 `invalid_scope` 로 실패할 수 있어, UI 에서 체크박스 옆에 ⚠ 아이콘 + tooltip + 폼 하단 경고 배너로 인지를 보장한다. Store 의 부분 제한은 scope 단위가 아닌 operation 단위라 노드 Operation 드롭다운 ([Spec Cafe24 노드 §2](../4-nodes/4-integration/4-cafe24.md#2-설정-ui)) 의 ⚠ 라벨이 1차 안내 지점이다. 명단 SoT 는 [`cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md).
+```
+
+### D5.3 §4.4 Scope & Permissions 탭 — 표에 행 추가
+
+기존 표:
+
+```diff
+| 요소 | 설명 |
+|------|------|
+| 현재 scope 목록 | `credentials.scopes[]` 전체를 체크된 상태로 표시 |
+| 권장 scope 목록 | 서비스별 프리셋. 현재 scope에 없는 항목은 체크 해제 상태 |
+| 누락 scope 배지 | `status_reason = insufficient_scope`일 때 누락 scope 목록을 빨간 뱃지로 강조 |
++ | 별도 승인 필요 ⚠ 배지 | 현재 scope·권장 scope·누락 scope 의 각 항목 옆에 `restrictedApproval` (메타데이터) 가 있는 scope/operation 만 ⚠ 배지 자동 노출. tooltip 본문은 [`cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md) §4.1 의 i18n 문구. `[Request scopes]` 버튼 위쪽에 "추가하려는 scope 중 N개는 카페24 별도 승인 필요" 보조 텍스트 (N=교집합 크기) |
+| `[Request scopes]` 버튼 | (기존 그대로) |
+```
+
+### D5.4 §9.4 공통 응답 포맷 — `INSUFFICIENT_SCOPE` 보강 필드 명시
+
+기존 `INSUFFICIENT_SCOPE (403)` 행 본문 갱신:
+
+```diff
+-  - `INSUFFICIENT_SCOPE` (403) — 노드 실행 중 감지 시 `Integration.status`도 갱신
++  - `INSUFFICIENT_SCOPE` (403) — 노드 실행 중 감지 시 `Integration.status` 도 갱신. `details.missingScopes: string[]` 에 누락 scope 목록을 담고, 그 중 카페24 별도 승인이 필요한 항목은 추가로 `details.requiresCafe24Approval: string[]` 에 채워 반환한다 (Cafe24 통합에 한정 — 다른 통합은 본 필드 미포함). frontend 는 `requiresCafe24Approval` 가 비어있지 않으면 에러 메시지에 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지를 추가 노출. 본 필드는 신규 에러 코드 없이 보강만 — 하위 호환 유지. 명단 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md).
+```
+
+### D5.5 §10.4 에러 매핑 — OAuth `invalid_scope` 분기 보강
+
+기존 §10.4 (에러 매핑) 에 다음 행 추가:
+
+```markdown
+| `oauth_invalid_scope` | OAuth callback 이 Cafe24 의 `invalid_scope` 응답을 받음. `last_error.details.requiresCafe24Approval: string[]` 에 요청 scope ∩ [`cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md) §1 의 교집합을 기록. 통합 상세 페이지가 본 단서를 읽어 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지 노출. status 는 보존 (재인증으로 회복 가능) |
+```
+
+### D5.6 Rationale — 신규 항목 추가
+
+`## Rationale` 섹션의 끝에 추가:
+
+```markdown
+### Cafe24 별도 승인 scope 의 식별·안내 (2026-05-17)
+
+**문제**: Cafe24 Admin API 중 mileage/notification/privacy 의 모든 scope 와 store 안 일부 operation (activitylogs, menus, naverpay/kakaopay/PG settings 등) 은 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. spec 에 이를 표현하는 차원이 없어 사용자가 위저드에서 일반 카테고리처럼 체크 → OAuth `invalid_scope` 거부 또는 호출 시 `INSUFFICIENT_SCOPE (403)` 으로 좌초. 원인 안내 장치 부재.
+
+**채택**: backend 메타데이터의 `Cafe24OperationMetadata.restrictedApproval` 필드와 catalog 의 `restricted` 컬럼을 SoT 로 두고, UI 4 화면 (위저드 / 상세 §4.4 / 노드 Operation 드롭다운 / AI Agent allowlist) 이 같은 필드를 읽어 ⚠ 배지·tooltip·경고 배너를 자동 렌더. 명단 SoT 는 신규 컨벤션 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md).
+
+**기각 대안**:
+- (A) 사용자가 체크 시 차단 — 이미 승인받은 합법 사용자 케이스를 막아버린다. 안내만, 차단 없음 정책 채택.
+- (B) 신규 에러 코드 추가 (`CAFE24_APPROVAL_REQUIRED`) — 기존 `INSUFFICIENT_SCOPE (403)` / `invalid_scope` 처리 경로를 분기시켜 client 코드 호환성에 영향. `details.requiresCafe24Approval` 보강 필드만으로 충분.
+- (C) catalog 의 `status` enum 에 `restricted` 값 추가 — supported / planned / deprecated 와는 직교 차원이라 enum 확장은 의미 오염. 별도 컬럼이 정답.
+
+**Trade-off**: mileage resource 안의 `credits_*` (예치금) 가 정확히 `mall.read_mileage` 를 쓰는지 vs 별도 scope (`mall.read_deposits` 등) 인지의 공식 분리 확인은 사용자 자료 범위 밖이므로, scope 단위 라벨링 (level='scope') 을 mileage resource 전체에 적용. 향후 공식 문서로 분리 확인되면 본 결정 정정.
+
+출처: 사용자 보고 (2026-05-17). consistency-check 세션: (예정).
+```
+
+---
+
+## D6. EDIT — `spec/4-nodes/4-integration/4-cafe24.md`
+
+### D6.1 §2 설정 UI — Operation 드롭다운 라벨링 추가
+
+기존 §2 의 Operation 드롭다운 설명 줄에 추가:
+
+```diff
+- Operation 후보 표시: 카탈로그 (`spec/conventions/cafe24-api-catalog/`) 의 `status: planned` 행도 dropdown 에 노출하되 disabled + "(지원 예정)" 접미사로 구분. resource 옆에 "지원 N개 · 추후 지원 M개" coverage hint.
++ Operation 후보 표시: 카탈로그 (`spec/conventions/cafe24-api-catalog/`) 의 `status: planned` 행도 dropdown 에 노출하되 disabled + "(지원 예정)" 접미사로 구분. resource 옆에 "지원 N개 · 추후 지원 M개" coverage hint.
++ - **별도 승인 라벨**: 메타데이터 row 에 `restrictedApproval` 이 있는 operation 은 라벨 우측에 ⚠ 아이콘 + 보조 텍스트 ("별도 승인 필요") 표시. resource 가 scope 단위 restricted (mileage/notification/privacy) 면 같은 resource 의 모든 operation 에 자동 적용. tooltip 본문·문의 링크는 [`spec/conventions/cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md) §4.1.
+```
+
+### D6.2 §8.3 allowlist — UI 라벨링 추가
+
+기존 §8.3 끝에 다음 문단 추가:
+
+```markdown
+**별도 승인 라벨 (UI)**: AI Agent allowlist 의 카테고리 단위 grouping UI 에서, scope 전체가 별도 승인 대상인 카테고리 (mileage/notification/privacy) 는 그룹 헤더에 ⚠ + "별도 승인 필요". store 안 일부 operation 단위 restricted (paymentgateway_*, activitylogs_*, menus_*, naverpay_setting_*, kakaopay_setting_*, financials_paymentgateway_get 등) 는 operation 행 단위로 같은 ⚠ 표기. backend 가 `mcpServers` 메타데이터 응답에 `restrictedApproval` 을 통과시켜 frontend 가 자동 렌더한다. 명단 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md).
+```
+
+### D6.3 §10 CHANGELOG 추가
+
+```markdown
+| 2026-05-17 | §2 Operation 드롭다운에 별도 승인 ⚠ 라벨 명세 + §8.3 AI Agent allowlist UI 의 동일 ⚠ 라벨 명세 추가. 메타데이터 `Cafe24OperationMetadata.restrictedApproval` 신설 ([cafe24-api-metadata 컨벤션 §2](../../conventions/cafe24-api-metadata.md#2-operation-메타데이터-형식)) + 카탈로그 `restricted` 컬럼 ([_overview §2](../../conventions/cafe24-api-catalog/_overview.md#2-표-컬럼-정의)) + SoT 컨벤션 [`cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md) 신설과 한 세트. 사용자 보고 (2026-05-17) — 카페24 본사 승인 필요 권한이 사용자에게 식별되지 않는 UX 문제 해소. consistency-check 세션: (예정). |
+```
+
+### D6.4 Rationale — 신규 항목 추가
+
+`## 9. Rationale` 의 끝에 추가:
+
+```markdown
+### 9.11 별도 승인 라벨 — 노드 Operation / AI Agent allowlist 의 ⚠ 표기
+
+UI 4 화면 (통합 위저드 / 통합 상세 §4.4 / 노드 Operation 드롭다운 / AI Agent allowlist) 의 라벨링은 같은 메타데이터 SoT (`Cafe24OperationMetadata.restrictedApproval`) 에서 자동 렌더. 명단의 진위는 [`cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md) 가 유일 출처이며, 본 노드 spec 은 그 라벨이 노드/AI Agent 의 어디에서 시각화되는지만 명시한다 — 명단을 직접 enumerate 하지 않는 이유는 drift 방지 (cafe24-api-metadata.md §3 의 "endpoint enumeration 을 spec 본문에 인라인하지 않는다" 정책과 동일).
+```
+
+---
+
+## D7. 영향 요약
+
+### 신규 파일
+
+- `spec/conventions/cafe24-restricted-scopes.md`
+
+### 수정 파일
+
+- `spec/conventions/cafe24-api-metadata.md` (§2 / §5 / CHANGELOG)
+- `spec/conventions/cafe24-api-catalog/_overview.md` (§2 / §4 / CHANGELOG)
+- `spec/conventions/cafe24-api-catalog/mileage.md` (헤더 + 전체 row)
+- `spec/conventions/cafe24-api-catalog/notification.md` (헤더 + 전체 row)
+- `spec/conventions/cafe24-api-catalog/privacy.md` (헤더 + 전체 row)
+- `spec/conventions/cafe24-api-catalog/store.md` (헤더 + 영향 16 row)
+- `spec/2-navigation/4-integration.md` (§3.2 / §4.4 / §5 / §9.4 / §10.4 / Rationale)
+- `spec/4-nodes/4-integration/4-cafe24.md` (§2 / §8.3 / §10 CHANGELOG / Rationale 9.11)
+
+### 신규 식별자 (충돌 검토 대상)
+
+- `restrictedApproval` (메타데이터 필드명)
+- `restricted` (catalog 표 컬럼명)
+- `requiresCafe24Approval` (API 에러 details 필드명)
+- `oauth_invalid_scope` (Integration.status_reason 값)
+- `level` enum: `scope` / `operation` / `program`
+- `category` enum: `mileage` / `notification` / `privacy` / `activitylogs` / `menus` / `pg_settings` / `naverpay_setting` / `kakaopay_setting` / `analytics`
+
+### 기각된 대안 (Rationale 에 기록)
+
+- 차단 정책 (사용자 안내만, 차단 없음)
+- 신규 에러 코드 (`CAFE24_APPROVAL_REQUIRED` 등 — 보강 필드로 대체)
+- catalog `status` enum 확장 (별도 컬럼이 정답)
+
+```
+
+## 진행 중 plan 문서 모음 (plan/in-progress/)
+
+### plan/in-progress 진행 중 문서
+
+#### `plan/in-progress/0-unimplemented-overview.md`
+```
+# 미구현 항목 오버뷰 (PRD/Spec 기준)
+
+> 작성일: 2026-05-11
+> 출처: `prd/0-overview.md` §6.2~§6.3, 각 PRD/Spec 문서의 ❌·🚧 표기, 코드베이스 spot-check
+> 검증 일자 기준: 2026-05-11. 본 문서의 "현재 상태"는 본 시점의 코드/스펙 비교 결과이며, 진행 시점에 다시 확인할 것
+
+본 문서는 `prd/`와 `spec/`을 전수 정독해 식별한 **아직 구현되지 않았거나 부분 구현 상태인 항목**의 인덱스다. 각 항목은 카테고리별 plan 문서로 분리해 추적한다.
+
+---
+
+## 작업 흐름 권장 순서
+
+다음 순서로 plan을 소화하면 의존성 충돌이 적다.
+
+1. **`ai-agent-tool-connection-rewrite.md`** — AI Agent 도구 연결은 의도적으로 제거되어 재설계 대기 중. 사용자 가치 큼, 다른 plan과 독립적.
+2. **`parallel-p2.md`** — 중첩 Parallel, `waitAll: false`, `errorPolicy` schema 노출. `logic-node-followups`와 별개로 진행 가능.
+2-1. **`merge-p2-async-fanin.md`** (신규) — Merge `timeout` / `partialOnTimeout` P2 활성화. `logic-node-followups` D3 의 fallback 분리 — 엔진 비동기 dispatch 모델 도입 PoC 가 선결 조건.
+3. **`background-monitoring-api.md`** — Background 노드는 ✅ 구현됐으나 `meta.backgroundRunId` 모니터링 API는 미구현.
+4. **`replay-rerun.md`** — Re-run (재실행) 정책 도입.
+5. **`team-workspace-followups.md`** — 공유 워크플로우 표시 + 미가입자 초대 토큰.
+6. **`2fa-webauthn.md`** — WebAuthn 2FA.
+7. **`accessibility-voiceover-validation.md`** — macOS VoiceOver 수동 검증.
+8. **`self-hosting-deployment.md`** — Docker Compose 셀프 호스팅 풀 번들, Helm Chart, 운영·보안 가이드.
+9. **`marketplace-and-plugin-sdk.md`** — 마켓플레이스 + 커스텀 노드 SDK (가장 큰 미구현 덩어리).
+
+> 각 plan에는 배경 / 관련 PRD-Spec 참조 / 작업 단위 / 수용 기준이 포함된다. 본 인덱스는 plan 간 우선순위·의존 관계만 정리한다.
+
+### 최근 완료
+
+- ✅ **`prd-spec-sync.md`** (2026-05-11, `plan/complete/prd-spec-sync.md`) — Graph RAG ❌→✅, NF-OB-05 cron ✅, EH-NAV-04 ✅, Background spec 4문서 정합화, 매뉴얼 (knowledge-base.mdx 한·영) 정합화.
+- ✅ **`logic-node-followups.md`** (2026-05-11, `plan/complete/logic-node-followups.md`) — D1 If/Else `is_type`/`regex` evaluator 통합 ✅, D2 Loop breakCondition + meta.exitReason ✅, D3 Merge P2 → 별도 plan (`merge-p2-async-fanin.md`) 분리 ✅, D4 Switch `meta.value` alias 제거 + 마이그레이션 ✅, D5 Variable Modification recordValues opt-in + 마스킹 유틸 ✅, D6 보류 ✅, D7 case id reserved word 검증 ✅. spec/4-nodes/1-logic 의 P0/P1 미구현 표기 모두 정리 (Merge dormant 표기는 별도 plan 분리에 따른 의도적 잔존).
+- ✅ **`llm-provider-followups.md`** (2026-05-11, `plan/complete/llm-provider-followups.md`) — Azure OpenAI 스트리밍 ✅ / Local LLM (Ollama·vLLM) 검증 ✅. `AzureOpenAIClient`·`LocalClient` 가 `OpenAIClient.stream()` 을 상속하여 자동 지원. spec 2종(7-llm-client.md §8.2, 4-ai-assistant.md §1.2/§11/§13/§15) 🚧·❌→✅, PRD 0 §6.1, 매뉴얼 4종(llm-config.mdx 한·영 + overview.mdx 한·영) 정합화.
+
+---
+
+## 카테고리별 미구현 항목 매핑
+
+### A. 제품 기능 (사용자 가치 큰 기능)
+
+| PRD/Spec 항목 | 상태 | 처리 plan |
+|---------------|------|-----------|
+| **PRD 1 §3.9 NAV-MP-01~07 Marketplace** | ❌ 전체 미구현 (i18n 사전에만 등장) | `marketplace-and-plugin-sdk.md` |
+| **PRD 4 §4 MP-CT/CS/PB-***| ❌ 전체 미구현 | `marketplace-and-plugin-sdk.md` |
+| **PRD 3 §10 ND-EX-01~03 노드 확장성 SDK** | ❌ 우선순위 3 | `marketplace-and-plugin-sdk.md` |
+| **PRD 5 NF-EX-04 노드 플러그인 시스템** | ❌ | `marketplace-and-plugin-sdk.md` |
+| **PRD 2 §4 ED-PL-05 마켓 커스텀 노드 팔레트 표시** | (마켓 의존) | `marketplace-and-plugin-sdk.md` |
+| **PRD 3 §6.1 ND-AG-06/10/21 AI Agent 도구 연결** | 🚧 의도적 제거, 재작성 예정 | `ai-agent-tool-connection-rewrite.md` |
+| **PRD 3 §4.9 ND-PL-03 Parallel 결과 합산 / 중첩 Parallel / waitAll=false** | 🚧 P2 예정 | `parallel-p2.md` |
+| **Spec 4-nodes/1-logic/3-loop §1 / §6 breakCondition** | ✅ 활성화 (D2, meta.exitReason 추가) | `complete/logic-node-followups.md` |
+| **Spec 4-nodes/1-logic/1-if-else `is_type` / `regex` 연산자** | ✅ 구현 (D1, evaluator 통합) | `complete/logic-node-followups.md` |
+| **Spec 4-nodes/1-logic/0-common If/Else, Switch `meta.matchedConditions` / `meta.matchedCaseIndex`** | ✅ 핸들러 구현 + spec 정합 (PR-1) | `complete/logic-node-followups.md` |
+| **Spec 4-nodes/1-logic/0-common Variable Decl/Mod meta** | ✅ 핸들러 구현 + recordValues opt-in (D5) | `complete/logic-node-followups.md` |
+| **Spec 4-nodes/1-logic/11-merge `timeout` / `partialOnTimeout`** | 🚧 P2 dormant (엔진 비동기 모델 선결) | `merge-p2-async-fanin.md` |
+| **Spec 4-nodes/1-logic/12-background 모니터링 API** | ❌ 미구현 (`meta.backgroundRunId` 키만 발급) | `background-monitoring-api.md` |
+| **Spec 5-system/4-execution-engine §6.3 Re-run** | 🚧 미구현 (future PRD) | `replay-rerun.md` |
+| **PRD 1 §3.11 NAV-UP-05 미가입자 초대 토큰** | 🚧 후속 (가입 사용자 추가만 ✅) | `team-workspace-followups.md` |
+| **PRD 1 §3.1 NAV-WF-07 공유 워크플로우 표시** | 🚧 백엔드만 존재, UI 미노출 | `team-workspace-followups.md` |
+| **PRD 5 NF-SC-10 2FA WebAuthn** | 🚧 TOTP만 ✅, WebAuthn 후속 | `2fa-webauthn.md` |
+
+### B. 인프라/배포 (셀프 호스팅)
+
+| PRD 항목 | 상태 | 처리 plan |
+|----------|------|-----------|
+| **PRD 5 NF-SC-08 셀프 호스팅 보안 가이드** | ❌ | `self-hosting-deployment.md` |
+| **PRD 5 NF-EX-03 단일~클러스터 셀프 호스팅** | ❌ | `self-hosting-deployment.md` |
+| **PRD 5 NF-DP-02 Docker Compose 셀프 호스팅 번들** | ❌ (현재 docker-compose.yml은 dev infra만) | `self-hosting-deployment.md` |
+| **PRD 5 NF-DP-03 Kubernetes Helm Chart** | ❌ | `self-hosting-deployment.md` |
+| **PRD 5 NF-DP-06 셀프 호스팅 설치/운영 문서** | ❌ | `self-hosting-deployment.md` |
+
+### C. LLM Provider 확장 — ✅ 완료 (2026-05-11)
+
+본 카테고리는 `plan/complete/llm-provider-followups.md` 에서 모두 처리됨. 결과:
+
+| Spec 항목 | 처리 결과 |
+|-----------|-----------|
+| **Spec 3-workflow-editor/4 §11 Azure OpenAI 스트리밍** | 🚧 → ✅ (`AzureOpenAIClient extends OpenAIClient` 상속으로 자동 지원, deployment name + `api-version` 매핑) |
+| **Spec 5-system/7 §8.2 LLM Client Local (Ollama/vLLM) 스트리밍** | 🚧 → ✅ (`LocalClient extends OpenAIClient` 로 OpenAI 호환 엔드포인트 자동 지원. Ollama 11434 / vLLM OpenAI-compat 모드 검증 완료) |
+
+### D. 접근성
+
+| PRD 항목 | 상태 | 처리 plan |
+|----------|------|-----------|
+| **PRD 5 NF-A11Y-03 macOS VoiceOver 수동 검증** | 🚧 자동화 ✅, 수동 체크리스트 사용자 수행 대기 | `accessibility-voiceover-validation.md` |
+
+### E. PRD/Spec ↔ 코드 정합성 정리 (실제로는 구현 끝) — ✅ 완료 (2026-05-11)
+
+본 카테고리는 `plan/complete/prd-spec-sync.md` 에서 모두 처리됨. 결과:
+
+| 항목 | 처리 결과 |
+|------|-----------|
+| **PRD 9 Graph RAG 전체** | ❌ 로드맵 → ✅ P0~P2 구현 완료 (KB-GR-MD/EX/DM/SR/PA/UI/OB-* 모든 ID 에 상태 컬럼 추가). `prd/9-graph-rag.md` §2.1·§3·§6·§7 + `prd/0-overview.md` §6.1 갱신 |
+| **PRD 5 NF-OB-05 알림 cron** | 🚧 → ✅ (5분 BullMQ repeatable + cooldown 명시) |
+| **PRD 7 EH-NAV-04 AI Assistant read-only 도구** | ❌ → ✅ (`get_workflow_executions` / `get_execution_details` 가 ED-AI-35~38 모두 충족) |
+| **Spec Background 노드 (5문서)** | 5-system/4-execution-engine §3.3, 1-data-model.md, 3-workflow-editor/0-canvas.md (3건), 1-node-common.md, 2-edge.md 모두 "🚧 미구현" 제거 + 평면 구현(ND-BG-05) 으로 통일 |
+| **AI Agent Tool Area spec 박스** | 재작성 plan(`ai-agent-tool-connection-rewrite.md`) 와 상호 링크 추가 |
+| **사용자 매뉴얼** | `frontend/src/content/docs/06-integrations-and-config/knowledge-base.mdx` 한·영 — Graph 모드 "로드맵" 안내 → 실제 사용법 + 검색 파라미터 + Entity/Relation 관리 가이드로 재작성 |
+
+---
+
+## plan 문서 목록
+
+```
+plan/in-progress/
+├── 0-unimplemented-overview.md        ← 본 문서 (인덱스)
+├── ai-agent-tool-connection-rewrite.md ← AI Agent 일반 도구 연결 재설계
+├── merge-p2-async-fanin.md            ← Merge timeout/partialOnTimeout — 엔진 비동기 모델 선결
+├── parallel-p2.md                     ← 중첩 Parallel·waitAll=false·errorPolicy 노출
+├── background-monitoring-api.md       ← meta.backgroundRunId 모니터링 API
+├── replay-rerun.md                    ← Re-run 재실행 기능 도입
+├── team-workspace-followups.md        ← 공유 워크플로우 표시 + 미가입자 초대 토큰
+├── 2fa-webauthn.md                    ← WebAuthn 2FA 추가
+├── accessibility-voiceover-validation.md ← macOS VoiceOver 수동 체크리스트
+├── self-hosting-deployment.md         ← Docker Compose 풀 번들·Helm·가이드 문서
+└── marketplace-and-plugin-sdk.md      ← 마켓플레이스 전체 + 노드 플러그인 SDK
+
+plan/complete/
+├── prd-spec-sync.md                   ← §E "PRD/Spec ↔ 코드 정합성 정리" 완료 (2026-05-11)
+├── llm-provider-followups.md          ← §C "LLM Provider 확장" 완료 (2026-05-11)
+└── logic-node-followups.md            ← Logic 노드 잔여 P0/P1 (D1·D2·D4·D5·D7) 완료, D3 → merge-p2-async-fanin.md 분리 (2026-05-11)
+```
+
+각 plan 문서는 다음 구조를 따른다:
+
+- **배경** — PRD/Spec의 어떤 항목이 미구현인지, 현 코드 상태
+- **관련 문서** — PRD·Spec·메모리·기존 plan 링크
+- **작업 단위** — 체크박스 todo 목록 (SDD: spec → 테스트 → 구현 순서)
+- **수용 기준** — Definition of Done
+- **의존성·리스크** — 다른 plan, 외부 시스템 영향
+
+---
+
+## 참고: 이미 완료되어 본 plan에 포함되지 않은 영역
+
+- `plan/complete/feature-roadmap/stages.md` Stage 1~11 (LLM 토큰 추적 / Parallel P1 / Background 평면 구현 / 팀 워크스페이스 UI / RBAC / 2FA TOTP / 조직 Integration 공유 / OTel 트레이싱 / 알림 룰 CRUD / 접근성 자동화 / 매뉴얼 검색)
+- `plan/complete/node-architecture/*` (handler colocation, schema audit, sub-workflow execution 등)
+- `plan/complete/workflow-assistant/*` (Workflow AI Assistant 본체)
+- `plan/complete/ai-knowledge-base/*` (Phase 2 KB + Graph RAG PRD 단계 — 코드 구현은 ✅, PRD 표기 갱신은 본 plan의 `prd-spec-sync.md`에서 처리)
+
+```
+
+#### `plan/in-progress/20260516-full-review/RESOLUTION.md`
+```
+---
+worktree: full-review-fixes-a1b2c3
+started: 2026-05-16
+owner: developer
+---
+
+# Full-Review Resolution — 2026-05-16
+
+> 기준 보고서: `plan/in-progress/20260516-full-review/SUMMARY.md`
+> 작업 worktree: `.claude/worktrees/full-review-fixes-a1b2c3` / branch `claude/full-review-fixes-a1b2c3`
+> 사용자 요청: "우선순위가 높은 순서대로 의사결정이 필요 없는 부분을 순차적으로 경고 단계까지 모두 처리해줘"
+> 검증: 백엔드 단위 테스트 3,762/3,762 통과, `tsc --noEmit -p tsconfig.build.json` 통과
+
+본 문서는 위 SUMMARY 의 발견사항 중 "의사결정 불필요 + 위험도 Critical~Warning" 항목을 1회 작업으로 일괄 처리한 결과를 기록한다. 후속 의사결정이 필요한 항목과 deferred 항목은 마지막 두 절에서 명시한다.
+
+---
+
+## 처리 완료 (Critical)
+
+| # | 위치 | 변경 |
+|---|------|------|
+| C-5 | `backend/src/modules/execution-engine/execution-engine.service.ts:3637,3679,3735` | `planContainerBody` 안의 `allNodes.find()` 를 함수 도입부에서 1회 생성한 `nodeMap` 의 `nodeMap.get()` 호출로 전환. 동일 `nodeMap` 을 반환 plan 에 재사용해 중복 Map 생성 제거 |
+| C-7 | spec/*.md 11곳 | `11-mcp-client.md#23-internal-bridge` 깨진 앵커를 실제 헤딩(`### 2.3 Internal Bridge (in-process)`) 의 GFM slug `#23-internal-bridge-in-process` 로 일괄 치환 |
+| C-9 | `backend/migrations/V052__notification_type_integration_action_required.sql` (신규) | `notification.type` CHECK 제약에 `integration_action_required` 추가. `IntegrationActionRequiredNotifierService` INSERT 가 check_violation 으로 실패하던 결함 해소 |
+| C-11 (부분) | `backend/src/main.ts`, `backend/src/modules/hooks/hooks.service.spec.ts` | `NestFactory.create(AppModule, { rawBody: true })` 적용 (HMAC 서명 검증 활성화). HMAC + bearer 경로 단위 테스트 9건 추가 (length mismatch / equal-length mismatch / valid match / missing signature / missing rawBody / signature mismatch / valid sha256 / unsupported algorithm 등) |
+| C-13 | `backend/package.json` | `overrides` 에 `protobufjs ^7.5.6`, `fast-uri ^3.1.2` 추가. `npm audit` 결과 fast-uri/protobufjs 다중 CVE 해소 (잔여: hono via @modelcontextprotocol/sdk W-57, OTel breaking W-54/W-56 — deferred) |
+| C-14 | `spec/conventions/conversation-thread.md:3` | `[Spec AI 공통 §11](.../0-common.md#11-conversation-context)` → `[Spec AI 공통 §10](.../0-common.md#10-conversation-context-자동-컨텍스트-주입)`. 실제 헤딩 번호 10 과 동기화 |
+| C-15 | `spec/2-navigation/4-integration.md:951` | `[Spec Cafe24 API 메타데이터 §6](.../cafe24-api-metadata.md#6-allowlist-와의-관계)` → `§7` / `#7-allowlist-와의-관계`. 실제 헤딩 번호 7 과 동기화 |
+
+W-60 (V049 파일-디렉토리 충돌) 은 현 base 커밋(`3f5457aa`) 에 빈 V049 디렉토리가 존재하지 않아 별도 조치 없이 already-resolved 로 분류한다.
+
+---
+
+## 처리 완료 (Warning)
+
+| # | 위치 | 변경 |
+|---|------|------|
+| W-2 | `backend/src/modules/hooks/hooks.service.ts:18,159` | HMAC 알고리즘 허용 목록 `Set(['sha256','sha512'])` 신설. `verifyAuth` 안에서 외부 입력 algorithm 을 허용 목록 외 값일 때 `UnauthorizedException`. 단위 테스트 1건 추가 |
+| W-15 | `spec/5-system/10-graph-rag.md:236` | `graph_extraction_status` Enum 값에 `failed` 추가 + 부연 설명. §7/§3.2 의 영구 실패 분기와 자체 모순 해소 |
+| W-21 | `backend/src/modules/statistics/statistics.service.ts:80` | `getSummary` 의 unconditional 워크스페이스 집계 쿼리 + workflowId 별 재집계 패턴을 단일 QueryBuilder 로 통합. workflowId 가 있을 때만 `andWhere` 추가, 첫 쿼리 결과 폐기 제거 |
+| W-22 | `backend/src/modules/executions/executions.service.ts:20,127` | `executionPath` 조회에 `MAX_EXECUTION_PATH_ROWS=10000` 상한 (`take`). 대규모 ForEach 로그 행 메모리 적재량 안전망. 관련 spec 테스트 갱신 |
+| W-25 | `backend/src/modules/websocket/websocket.service.ts:92` | `sanitizePayloadForWs` 가 자식 mutation 없는 경우 원본 참조를 반환하도록 변경. GC pressure 감소 + emit hot path 의 객체 할당 제거 |
+| W-31 (5건) | `backend/src/modules/integrations/services/credentials-transformer.ts`, `backend/src/modules/integrations/integrations.service.ts:702`, `backend/src/modules/integrations/integration-oauth.service.ts:282,307`, `backend/src/nodes/presentation/table/table.handler.ts:264` | `console.warn` / `console.error` 5곳을 NestJS `Logger` 인스턴스로 교체. 모듈 수준 인스턴스가 필요한 곳은 `new Logger('<name>')` 로 import |
+| W-37 | `backend/src/modules/hooks/hooks.service.spec.ts` | `constantTimeEquals` 분기 (length mismatch / equal-length / 성공) 단위 테스트가 bearer + HMAC 시나리오로 9건 추가 (C-11 와 합쳐 한 번에 작성) |
+| W-41 | `backend/test/webhook-trigger.e2e-spec.ts:74,95,112,134` | `e2e-X-${Date.now()}` 4곳을 `crypto.randomBytes(8).toString('hex')` 기반으로 전환. 동시 e2e 실행 시 endpointPath 충돌 방지 |
+| W-46 | `backend/src/common/dto/pagination.dto.ts:11,53` | `PaginationQueryDto.sort` 에 `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)` + `@MaxLength(64)` 적용. 서비스별 `getSortColumn()` 화이트리스트를 보조하는 DTO 레벨 1차 차단 |
+| W-55 | `backend/package.json` | C-13 와 함께 `fast-uri` overrides 추가. `npm audit` GHSA-q3j6-qgpj-74h6 / GHSA-v39h-62p7-jpjc 해소 |
+| W-63 | `backend/migrations/V053__notification_workspace_type_resource_idx.{sql,conf}` (신규) | `notification(workspace_id, type, resource_id, created_at DESC)` 복합 인덱스를 `CONCURRENTLY` 로 추가. `NotificationsService.hasRecentByResource` idempotency 쿼리 hot path 인덱스 보강 |
+| W-68 | `backend/src/modules/websocket/websocket.gateway.ts:217` | `authorize()` await 경계 이후 `clientSubs.size >= MAX_SUBSCRIPTIONS_PER_CONNECTION` 재검사 추가. 동시 subscribe 가 한도 검사를 interleave 하는 race 해소 |
+| W-69 | `spec/4-nodes/4-integration/4-cafe24.md:23,90` | `pagination` 필드의 `cursor?: string` 제거 + 사유 문구 추가. §3, §4.2 의 cursor 언급 동시 삭제 |
+| W-77 | `frontend/README.md:7` | `yarn dev` / `pnpm dev` / `bun dev` 명령 제거. 루트 CLAUDE.md "패키지 매니저" 규약(npm 전용) 과 정합 |
+| W-79 | `packages/expression-engine/README.md`, `packages/node-summary/README.md` (신규) | 두 패키지의 목적·빌드·사용·boundary 를 정리한 최소 README 작성 |
+| W-80 | `README.md:333` | h1 `# integration (SSO)` 을 h2 로 강등. 직속 자식 `## Google OAuth 연동 설정` 도 h3 로 동시 강등 |
+
+> 자료의 단일 진실 원칙 상, 본 표의 변경은 모두 동일 branch (`claude/full-review-fixes-a1b2c3`) 의 단일 작업 단위로 묶여 있다.
+
+---
+
+## 의사결정 보류 (사용자/스펙 합의 필요)
+
+| # | 사유 |
+|---|------|
+| C-1 / C-2 | Re-run 기능 백엔드·프론트엔드 완전 미구현. 신규 worktree 에서 `replay-rerun.md` PR2 단위로 별도 진행 필요 |
+| C-3 | AI Agent 일반 도구 연결 모델 결정 — 사용자 합의 필요 |
+| C-4 | `sanitizePayloadForWs` 설정 레이어 이동 — emit hot path 의 trust boundary 재설계 필요 (allowlist 정의가 의사결정 사안) |
+| C-6 | `ExecutionEngineService` God-Object 분해 — 4단계 분리안 (`AiConversationOrchestrator` 등) 별도 plan 으로 진행 |
+| C-8 | README 포트 혼재 — 환경별(host dev=3000 vs docker fullstack=3012) 매핑 정확도 확인이 필요 |
+| C-10 | `AuthConfig.config` 평문 → encryptedJsonTransformer + 평문 행 마이그레이션 스크립트 — 데이터 마이그레이션 절차 사용자 합의 필요 |
+| C-12 | Cafe24 OAuth callback/refresh e2e — HTTP stub 컨테이너 추가가 e2e 인프라 변경 사안 |
+| W-1 | WebSocket CORS `*` → frontendUrl 화이트리스트 — 환경 분기(`NODE_ENV==='production'`) 외의 조건 결정 필요 |
+| W-3 | DOMPurify `ALLOWED_ATTR` 의 `style` 제거 — CSS 정책 결정 필요 |
+| W-4 / W-5 | DNS rebinding / DB 호스트 SSRF — 보안 정책 결정 필요 |
+| W-6 | sub-workflow workspace 격리 — 엔진 invariant 변경, 별도 plan 권장 |
+| W-7~W-14 | 요구사항 항목 (`errorPolicy`, marketplace SDK, integration_action_required UI 등) — 각각 별도 plan |
+| W-16 | API 경로 prefix `/api/v1/` vs `/api/` — 정책 확정 필요 |
+| W-18 | spec §2.2 API 직호출 대비 — 별도 spec 보강 |
+| W-19 | i18n parity main 병합 여부 확인 (다른 worktree 상태 검증) |
+| W-23 | `deriveContainerAssignments` 16 패스 — 자료구조 재설계 필요 |
+| W-24 | `appendExecutionPath` 배치 INSERT 전환 — 별도 PR 권장 |
+| W-26 / W-27 | expression-resolver/ws snapshot 캐시 — 별도 PR 권장 |
+| W-28 / W-29 / W-30 / W-33~W-36 | 대형 파일 분해·헬퍼 단일화 리팩토링 — 영역별 별도 PR |
+| W-44 / W-47 / W-48 | API 계약 변경 (controller 단 IDOR 보강, throttle, PATCH 패턴) — 호환성·spec 동시 갱신 필요 |
+| W-49~W-53 | 아키텍처 디커플링 (DI 토큰, 순환 의존 해소, common/shared 경계, Cafe24ApiClient 분해) — 별도 plan |
+| W-54 / W-56 | OpenTelemetry 0.76.0 업데이트 — breaking change, 호환성 검증 필요 |
+| W-57 | `@modelcontextprotocol/sdk` 최신화 → hono 취약점 해소 — SDK breaking 확인 필요 |
+| W-58 / W-59 | Playwright/MinIO 이미지 버전 정렬 — 사용자 환경 검증 |
+| W-61 / W-62 / W-64 | DB·entity·service 변경 — 호출자 영향 확인 필요 |
+| W-65 / W-66 / W-67 | 동시성 (boot race, schedule runner, foreach context clone) — invariant 변경, 별도 PR |
+| W-70 / W-71 | 커밋 원자성 원칙 수립 — 프로세스 차원의 합의 |
+| W-72 / W-73 / W-74 / W-75 | 부작용 (redis config 확장, OnModuleDestroy, OAUTH_STUB_MODE 가드 통합, mock 보강) — 영향 범위 확인 필요 |
+| W-76 | `INTEGRATION_ENCRYPTION_KEY` README 보강 — C-8 README 포트 결정과 함께 처리 권장 |
+| W-78 | spec Rationale 56개 보강 — 우선순위별 별도 plan |
+
+---
+
+## 검증
+
+```bash
+cd backend
+npx tsc --noEmit -p tsconfig.build.json   # exit 0 (src 빌드 그래프 클린)
+npx jest --no-coverage --silent           # 210 suites / 3,762 tests / all passed
+npm audit                                 # fast-uri / protobufjs CVE 해소 (잔여: hono via mcp/sdk W-57, OTel W-54/W-56)
+```
+
+후속 작업으로 commit + PR 작성은 사용자 confirm 후 진행한다.
+
+---
+
+## 후속 조치 (`/ai-review` 통합 후 처리)
+
+PR #126 commit `13d21fcd` 에 대한 `/ai-review` (router 11/13 선별, Critical 0 / Warning 15 / Info 27) 결과 발견된 Warning 항목을 추가 처리했다. 검증: tsc clean, 211 suites / 3,772 tests 통과.
+
+| # | 영역 | 위치 | 변경 |
+|---|------|------|------|
+| F-A | 부작용/DB | `backend/migrations/V052__*.{sql,conf}` | `ALTER TABLE ADD CONSTRAINT NOT VALID` + `VALIDATE CONSTRAINT` 2단계 + 화이트리스트 외 행 pre-flight 검사 (`RAISE EXCEPTION`). `executeInTransaction=false` 로 짧은 ACCESS EXCLUSIVE lock 만 사용 |
+| F-B | 동시성 | `backend/src/modules/websocket/websocket.gateway.ts` | `authorize()` 후 한도 검사·`Set.add`·tentative-add 롤백 패턴으로 묶음. 단위 테스트: deferred authorize 동시 2건에서 정확히 1건만 성공하는지 검증 |
+| F-C | 보안 | `backend/src/modules/hooks/hooks.service.ts` | 미허용 HMAC 알고리즘 응답에서 알고리즘 명 제거 (`"Authentication failed"` 고정). 진단은 `this.logger.warn` 으로만. 단위 테스트로 응답에 `md5` 노출 안 됨 검증 |
+| F-D | 보안 | `backend/src/modules/websocket/websocket.service.ts` | `sanitizePayloadForWs` 가 `depth > MAX_SANITIZE_DEPTH` 도달 시 원본 대신 `'[REDACTED_DEPTH]'` 반환. 단위 테스트로 깊이 12 페이로드에서 평문 secret 직렬화 미노출 검증 |
+| F-E | 요구사항/문서 | `backend/src/modules/executions/executions.service.ts`, `executions.service.spec.ts` | `MAX_EXECUTION_PATH_ROWS` export + 응답에 `executionPathTruncated: boolean` 노출. 테스트에서 10,000 행 case 추가 |
+| F-F | 테스트 | `websocket.service.spec.ts`, `websocket.gateway.spec.ts`, `hooks.service.spec.ts`, `pagination.dto.spec.ts` (신규) | 참조 동일성 / depth-redact / sha512 성공 / HMAC 응답 비누출 / WS race / pagination 식별자 패턴 양·음성 케이스 추가 (+10 testcase) |
+| F-G | 문서 | `spec/5-system/12-webhook.md` §4.2, `backend/src/common/dto/pagination.dto.ts` | HMAC 알고리즘 허용 목록·information leakage 차단·rawBody 요구를 spec 에 명시. `@ApiPropertyOptional` 에 `pattern`/`maxLength` 메타데이터 추가 |
+| F-INFO | 유지보수성 | `backend/src/modules/integrations/integration-oauth.service.ts` | 모듈 수준 logger 변수명 `moduleLogger` → `logger` (다른 파일과 일관성) |
+| F-호환성 | 프론트엔드 | grep 결과 | `frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx:152` 의 `sort: "started_at"` 가 신규 `@Matches` 패턴에 적합. 기존 클라이언트 호환성 영향 없음 |
+
+여전히 보류되는 deferred 항목은 위 §의사결정 보류 표 그대로 유지된다.
+
+```
+
+#### `plan/in-progress/20260516-full-review/SUMMARY.md`
+```
+# Code Review 통합 보고서
+
+> 기준 커밋: `bbd838ef` (main)
+> 검토 일시: 2026-05-16
+> 범위: spec/, backend/, frontend/, packages/ 전체
+> 리뷰 세션: `plan/in-progress/20260516-full-review/`
+> 세션 메타: 13/13 reviewer 성공, 총 154 issue
+
+---
+
+## 세션 개요
+
+본 세션은 표준 `review/code/<...>` 경로가 아닌 `plan/in-progress/20260516-full-review/`에서 실행된 전체 코드베이스 audit 세션이다. 사용자 강조 관점은 **일관성**, **스펙 준수**, **보안**, **리팩토링** 4개 축이다.
+
+---
+
+## 전체 위험도
+
+**HIGH** — Critical 보안/데이터 결함 9건, 구현 미완성(Re-run) 3건, 테스트 커버리지 공백 2건 포함. 즉각 조치가 필요한 CRITICAL 항목이 다수 존재하며, 특히 AuthConfig 평문 저장과 HMAC 웹훅 인증 무동작은 운영 환경 보안에 직결된다.
+
+---
+
+## Critical 발견사항
+
+| # | 카테고리 | 발견사항 | 위치 | 제안 |
+|---|----------|----------|------|------|
+| C-1 | 요구사항/스펙 | Re-run 기능 백엔드·프론트엔드 완전 미구현. `POST /executions/:id/re-run`, chain API, 권한 가드, rate limit, audit log, 프론트 UI 모두 없음 | `executions.controller.ts` 전체; `spec/5-system/13-replay-rerun.md`; `plan/in-progress/replay-rerun.md` §3/4/5 전체 미체크 | 새 worktree에서 `replay-rerun.md` PR2 착수. DB 마이그레이션(`re_run_of`, `chain_id` 컬럼) 선행 |
+| C-2 | 요구사항/데이터모델 | `Execution` 엔티티에 Re-run 추적 컬럼(`re_run_of`, `chain_id`) 누락 — spec RR-PL-05 및 `spec/1-data-model.md §2.13` 정의 미반영 | `execution.entity.ts:21-81`; `spec/5-system/13-replay-rerun.md §9.1` | TypeORM migration으로 컬럼 추가 + `spec/1-data-model.md §2.13` 갱신 |
+| C-3 | 요구사항/AI | AI Agent 일반 도구 연결(ND-AG-06/10/21) 의도적 제거 후 재설계 완전 미결 — 핵심 AI 기능 무기한 보류 | `plan/in-progress/ai-agent-tool-connection-rewrite.md §1`; `spec/4-nodes/3-ai/1-ai-agent.md` | 도구 연결 모델 결정을 위한 사용자 합의를 우선 진행 |
+| C-4 | 성능 | `sanitizePayloadForWs`가 모든 WS emit 경로에서 재귀 순회 실행 — 대규모 ForEach(5000+ emit) 시 CPU 병목 | `backend/src/modules/websocket/websocket.service.ts:92-107` | 설정 레이어에서 한 번만 적용하고 WS emit 시 재검사 생략; `messages` 배열 등 신뢰된 필드는 allowlist 방식으로 skip |
+| C-5 | 성능 | ForEach 내부 `allNodes.find()` O(N) 선형 탐색이 매 iteration 반복 — 1000회 ForEach × 500노드 시 500,000회 비교 발생 | `execution-engine.service.ts:3679`; `planContainerBody` 내 여러 곳 | `nodeMap.get(id)` O(1) 조회로 전환 (Map이 이미 존재함) |
+| C-6 | 아키텍처 | `ExecutionEngineService` 4,733줄 God-Object — 그래프 순회·노드 dispatch·상태 머신·WS 이벤트·AI 대화·분산 continuation을 단일 파일에 집중 | `execution-engine.service.ts:377` 전체 | `AiConversationOrchestrator`, `UserInteractionService`, `GraphTraversalService`, `ExecutionEventEmitter`로 분리 |
+| C-7 | 문서 | `spec/5-system/11-mcp-client.md` 헤딩 변경으로 앵커 링크 13건 전 코드베이스에서 파손 (`#23-internal-bridge` → `#23-internal-bridge-in-process`) | `spec/1-data-model.md:247`, `spec/0-overview.md:101`, `spec/4-nodes/4-integration/4-cafe24.md:3,11,337` 외 8개 파일 | 헤딩을 `### 2.3 Internal Bridge`로 단순화하거나 11개 참조 파일 앵커 일괄 수정 |
+| C-8 | 문서/보안 | README `FRONTEND_URL` 포트 3000·3002·3012 세 가지 혼재 — OAuth redirect URI 오등록 위험 | `README.md:183, 217, 354-357`; `docker-compose.yml:176` | 환경별(host dev=3000, docker fullstack=3012) 명확히 구분해 기재 |
+| C-9 | 데이터베이스/보안 | `integration_action_required` 알림 타입이 DB CHECK constraint에 없어 INSERT 시 `check_violation` 오류로 알림 발사 전체 실패 | `backend/migrations/V001__initial_schema.sql:338`; `integration-action-required-notifier.service.ts:76` | `V052__notification_type_integration_action_required.sql` 마이그레이션 즉시 추가 |
+| C-10 | 데이터베이스/보안 | `AuthConfig.config` JSONB가 평문 저장 — spec은 `JSONB (encrypted)` 명시, Webhook Bearer Token/API Key 등 민감 인증 정보 노출 위험 | `auth-config.entity.ts:31`; `auth-configs.service.ts` | `Integration.credentials`와 동일한 `encryptedJsonTransformer` 적용 + 기존 평문 행 마이그레이션 스크립트 |
+| C-11 | 테스트/보안 | `HooksService.verifyAuth` HMAC 분기 단위 테스트 전무 + `main.ts`에 `rawBody: true` 미설정으로 HMAC 인증이 운영에서 실제로 동작하지 않을 가능성 | `main.ts`; `hooks.service.spec.ts`; `webhook-trigger.e2e-spec.ts:133-167` | `NestFactory.create(AppModule, { rawBody: true })` 추가; HMAC 단위 테스트 5개 시나리오 추가 |
+| C-12 | 테스트 | Cafe24 OAuth callback/BullMQ refresh e2e 미존재 — 핵심 토큰 획득·갱신 경로의 회귀 안전망 부재 | `backend/test/` (관련 파일 없음) | `docker-compose.e2e.yml`에 HTTP stub 컨테이너 추가 후 `integration-cafe24-callback.e2e-spec.ts` 작성 |
+| C-13 | 의존성/보안 | `protobufjs <=7.5.5` 다중 CVE — 코드 인젝션, DoS, Prototype pollution 5건 이상 | `backend/package.json` 간접 dep (`@google/genai`, `@opentelemetry/*`) | `npm audit fix` 또는 `"overrides": { "protobufjs": "^7.5.6" }` 추가 |
+| C-14 | 문서 | `spec/4-nodes/3-ai/0-common.md#11-conversation-context` 앵커 오기재(실제 섹션 번호 10) | `spec/conventions/conversation-thread.md:3` | 앵커를 `#10-conversation-context-자동-컨텍스트-주입`으로 수정 |
+| C-15 | 문서 | `spec/conventions/cafe24-api-metadata.md#6-allowlist-와의-관계` 앵커 불일치(실제 섹션 번호 7) | `spec/2-navigation/4-integration.md:951` | 앵커를 `#7-allowlist-와의-관계`로 수정 |
+
+---
+
+## 경고 (WARNING)
+
+| # | 카테고리 | 발견사항 | 위치 | 제안 |
+|---|----------|----------|------|------|
+| W-1 | 보안 | WebSocket 게이트웨이 CORS 와일드카드(`*`) | `websocket.gateway.ts:52` | `NODE_ENV=production`에서 `origin: configService.get('app.frontendUrl')`로 제한 |
+| W-2 | 보안 | 웹훅 HMAC `hmacAlgorithm` 허용 목록 없음 | `hooks.service.ts:144`; `create-trigger.dto.ts:61` | `@IsIn(['sha256', 'sha512'])` 검증 추가 |
+| W-3 | 보안 | DOMPurify `ALLOWED_ATTR`에 `style` 포함 — CSS 클릭재킹·데이터 유출 벡터 | `presentation-renderers.tsx:45` | `style` 속성 제거; 필요시 `afterSanitizeAttributes` hook으로 CSS 속성 단위 허용 |
+| W-4 | 보안 | HTTP Request 노드 DNS rebinding 2차 공격 미차단 | `http-safety.ts:8-12` | `dns.lookup` 결과 IP 재검사 또는 egress 방화벽 보완 |
+| W-5 | 보안 | Database Query 노드 사용자 제공 DB 호스트 SSRF 검증 없음 | `database-query.handler.ts:333` | `isPrivateHost`+`resolvesToPrivate` 검증 추가 |
+| W-6 | 보안/아키텍처 | sub-workflow 실행 시 workspace 격리 검증 누락 — 교차 workspace 실행 가능 | `execution-engine.service.ts:1049-1054, 1155-1160, 718-725` | `executeSync/Async/Inline` 내부에서 대상 workflow의 `workspaceId` 비교 검증 |
+| W-7 | 요구사항 | Parallel 노드 `errorPolicy` schema 미노출 — 항상 기본값 `stop` 동작 | `parallel.schema.ts`; `spec/4-nodes/1-logic/10-parallel.md §1` | `parallel-p2.md §1` 처리 — schema에 `errorPolicy` 노출 |
+| W-8 | 요구사항 | Merge 노드 `timeout`/`partialOnTimeout` dormant — 설정해도 warn 로그만 | `merge.handler.ts:89-101` | 프론트엔드 설정 패널에 disabled + 툴팁; 또는 validate 경고 룰 추가 |
+| W-9 | 요구사항 | 마켓플레이스·플러그인 SDK 전체 미구현 | `spec/2-navigation/8-marketplace.md`; `plan/in-progress/marketplace-and-plugin-sdk.md` | `0-unimplemented-overview.md` 권장 순서로 Phase A부터 진행 |
+| W-10 | 요구사항 | `integration_action_required` 프론트엔드 type-specific 처리 미구현 | `frontend/src/components/` (notification 관련) | frontend notification 컴포넌트에 type-specific 분기 추가 |
+| W-11 | 요구사항 | `0-unimplemented-overview.md` 인덱스가 실제 구현 현황과 불일치 | `plan/in-progress/0-unimplemented-overview.md:54, 108-120` | background 모니터링 API 항목 ✅ 갱신 + plan 목록 재동기 |
+| W-12 | 보안 | install endpoint IP 기반 rate limiting 미구현 | `cafe24-backlog-residual.md §A-3` | nginx 또는 ThrottlerModule IP 기반 rate limit 추가 |
+| W-13 | 요구사항 | Cafe24 BullMQ refresh 실패 시 Sentry/외부 오류 추적 미정의 | `cafe24-backlog-residual.md §D-2` | 에러 격리 정책 spec 명시 + 외부 오류 추적 결정 |
+| W-14 | 테스트 | `exchangeCodeForToken`/`refreshAccessToken` fetch 단위 테스트 5개 시나리오 전체 미체크 | `cafe24-backlog-residual.md §B-5-8` | mock fetch + fixture 기반 단위 테스트 추가 |
+| W-15 | 스펙 | `graph_extraction_status` Enum에 `failed` 누락(§2.2 vs §7·§3.2 자체 모순) | `spec/5-system/10-graph-rag.md §2.2` | `§2.2` Enum에 `failed` 추가; consistency-check C2 처리 |
+| W-16 | 스펙 | API 경로 prefix 혼재 `/api/v1/` vs `/api/` | `spec/5-system/2-api-convention.md` | prefix 정책 확정 + 전체 spec 경로 통일 |
+| W-17 | 유지보수성 | `workflow.handler.ts` 에러 분류 문자열 매칭 — 메시지 변경 시 silent regression | `workflow.handler.ts:216-220` | Typed error 계층 도입 후 `instanceof` 분기 전환 |
+| W-18 | 스펙 | Cafe24 install endpoint `pending_install` 상태 보호 미명시 | `spec-update-cafe24-test-connection.md §9.1` | spec §2.2 API 직호출 대비 조항 추가 + 구현 확인 |
+| W-19 | 요구사항 | i18n ko↔en dict parity 자동 가드 main 병합 여부 불명확 | `harness-i18n-userguide-gap.md`; `harness-review-router-c4f1a2` worktree | worktree 상태 확인 → main 병합 완료 여부 검증 |
+| W-20 | 문서/API | Cafe24 신규 에러 코드 2종 Swagger `@ApiResponse` 미명시 | `cafe24-backlog-residual.md §D-1` | 관련 controller에 `@ApiResponse` 데코레이터 추가 |
+| W-21 | 성능 | `getSummary`에서 `workflowId` 필터 시 동일 쿼리 두 번 실행 — 첫 번째 결과를 버림 | `statistics.service.ts:80-123` | 단일 쿼리로 통합 |
+| W-22 | 성능 | `executionPath` 조회 — 수천 행 메모리 적재 후 `nodeId`만 추출 | `executions.service.ts:123-127` | `MAX_PATH_ROWS` 상한 + LIMIT SQL 절 추가 |
+| W-23 | 성능 | `deriveContainerAssignments` 엣지 변경마다 최대 16 패스 × 전체 엣지 동기 순회 — 대형 워크플로 UI 렉 | `frontend/src/lib/stores/editor-store.ts:281-304` | containerId를 엣지에 embed하거나 증분 방식 전환; 단기: pass 상한 축소 |
+| W-24 | 성능 | `appendExecutionPath` 노드 실행 시마다 개별 INSERT — 100노드 × 50 ForEach = 5000 INSERT | `execution-engine.service.ts:1554-1567` | 완료 시점에 배치 INSERT로 전환 |
+| W-25 | 성능 | `sanitizePayloadForWs` 재귀 호출마다 빈 `result` 객체 새로 생성 — GC pressure | `websocket.service.ts:98` | 민감 키 없으면 원본 참조 반환 |
+| W-26 | 성능 | `resolveString`에서 `FULL_EXPRESSION_PATTERN` 중복 정규식 매칭 | `expression-resolver.service.ts:239-245` | 단일 패스 처리 또는 `evaluate` 반환값에 플래그 포함 |
+| W-27 | 성능 | `emitExecutionSnapshot` REPEATABLE READ + `findById` 전체 조회 — 동시 구독자 多일 때 반복 heavy 조회 | `websocket.gateway.ts:258-284` | 완료된 실행 snapshot Redis 캐시; 장기: snapshot 전용 경량 쿼리 |
+| W-28 | 유지보수성 | `APP_URL` 폴백 리터럴 두 파일 6곳 분산 + `replace(/\/$/, '')` 체인 누락 | `integrations.service.ts:830,1076`; `integration-oauth.service.ts:490,968,1079,1359` | `getAppBaseUrl()` 단일 함수로 통합 |
+| W-29 | 유지보수성 | 메시지 길이 상한 불일치 — `LAST_ERROR_MESSAGE_MAX_LEN=200` vs `MCP_ERROR_MESSAGE_MAX_LEN=2048`, 클램프 함수 이중 구현 | `integration-oauth.service.ts:193,220`; `mcp-error-codes.ts:35` | `integrations-error-utils.ts`로 통합 |
+| W-30 | 유지보수성 | `extractSid`/`extractOperationId` 파싱 로직 두 provider에 별도 구현 | `cafe24-mcp-tool-provider.ts:454-468`; `mcp-tool-provider.ts:150-161` | `parseMcpToolName` 재사용으로 중복 제거 |
+| W-31 | 유지보수성 | `console.warn`/`console.error`가 NestJS Logger 대신 사용된 위치 5곳 이상 | `integrations.service.ts:702`; `integration-oauth.service.ts:307`; `credentials-transformer.ts:45,58`; `table.handler.ts:264-269` | `this.logger.warn/error` 또는 `new Logger(...)` 교체 |
+| W-32 | 유지보수성 | `EXPIRING_SOON_INTERVAL` SQL 내장 vs 프론트엔드 `EXPIRING_SOON_DAYS=7` 주석으로만 동기화 | `integrations.service.ts:250` | 공유 상수로 추출 |
+| W-33 | 유지보수성 | `integration-oauth.service.ts`(1,818줄) 단일 클래스에 OAuth 흐름 전반과 Cafe24 특화 로직 혼재 | `integration-oauth.service.ts` 전체 | Cafe24 특화 로직을 `cafe24-oauth.service.ts`로 분리 |
+| W-34 | 유지보수성 | `ai-agent.handler.ts`(2,099줄) 단일 파일에 AI 에이전트 거의 모든 책임 집중 | `ai-agent.handler.ts` 전체 | `RagAccumulator`, 렌더링 유틸, 멀티-턴 상태 관리 분리 |
+| W-35 | 유지보수성 | `IntegrationOAuthService.begin()` Cafe24 private/public 3단 중첩 — 순환 복잡도 높음 | `integration-oauth.service.ts:364` | `beginCafe24(params, meta)`로 추출 + 얼리 리턴 패턴 |
+| W-36 | 유지보수성 | `credentials-transformer.ts` 모듈 수준 전역 boolean 플래그 — 테스트 간 상태 오염 가능 | `credentials-transformer.ts:38-39` | `resetWarningFlags()` hook 제공 또는 Logger rate-limiter 활용 |
+| W-37 | 테스트 | `HooksService.constantTimeEquals` 분기 미커버 | `hooks.service.ts:176-181` | 길이 불일치·성공 케이스 단위 테스트 추가 |
+| W-38 | 테스트 | Cafe24 install e2e `mall_id 불일치 → 403` 케이스 명시됐으나 미구현 | `integration-cafe24-install.e2e-spec.ts:20` | `rejection paths` describe 블록에 케이스 추가 |
+| W-39 | 테스트 | Nonce cache Redis 키 HMAC 앞 8자 prefix 충돌 위험 미테스트 | `cafe24-install-nonce-cache.service.ts:108` | 동일 prefix 두 HMAC 독립성 검증; 또는 전체 HMAC 해시로 키 설계 변경 검토 |
+| W-40 | 테스트 | `cafe24-token-refresh.processor.spec.ts` `Date.now()` fake timer 없이 사용 | `cafe24-token-refresh.processor.spec.ts:32,48` | `jest.useFakeTimers()` + `jest.setSystemTime()` 사용 |
+| W-41 | 테스트 | 웹훅 e2e `Date.now()` 기반 `endpointPath` 생성 — 병렬 실행 시 충돌 가능 | `webhook-trigger.e2e-spec.ts:74,95,112,134` | `randomBytes(8).toString('hex')` 사용 |
+| W-42 | 테스트 | `integration-cafe24-install.e2e-spec.ts` credentials 암호화 transformer 우회 — production 경로 미커버 | `integration-cafe24-install.e2e-spec.ts:84-111` | `credentials-transformer.spec.ts`에 암호화/비암호화 경로 통합 추가 |
+| W-43 | 테스트 | 웹훅 HMAC 양성 케이스가 `hooks.service.spec.ts`에 위임된다고 명시됐으나 실제로는 없음 — 참조 단절 | `webhook-trigger.e2e-spec.ts:155` | `hooks.service.spec.ts`에 올바른 rawBody+HMAC 서명 케이스 추가 |
+| W-44 | API 계약 | `GET /executions/:id`, `GET /executions/workflow/:workflowId` workspaceId 소유권 미검증 IDOR | `executions.controller.ts:56-79` | `@WorkspaceId()` 파라미터 추가 + `verifyOwnership()` 호출 |
+| W-45 | API 계약 | webhook spec(§5.2) 에러 응답 형식이 실제 GlobalExceptionFilter envelope과 불일치 | `spec/5-system/12-webhook.md:248-254`; `http-exception.filter.ts:63-72` | spec §5.2를 실제 envelope(`{ error: { code, message, details } }`)과 동기화 |
+| W-46 | API 계약 | `PaginationQueryDto.sort` 허용 값 미검증 — 서비스별 `getSortColumn()` 누락 위험 | `pagination.dto.ts:46-51` | DTO 레벨에 `@IsIn([...])` 공통 허용 값 추가 |
+| W-47 | API 계약/보안 | `POST /auth/login`/`POST /auth/register`에 개별 throttle 미적용 — spec 10 req/min 대신 100 req/min | `auth.controller.ts:165-200,104-135` | `@Throttle({ default: { ttl: 60_000, limit: 10 } })` 추가 |
+| W-48 | API 계약 | `PATCH /notifications/:id/read` — spec §12.1 상태 토글 패턴 위반 | `notifications.controller.ts:73` | `PATCH /notifications/:id` + body `{ isRead: true }`로 변경 또는 spec 예외 명문화 |
+| W-49 | 아키텍처 | `ExecutionEngineService` 생성자 16개 의존성 과부하 | `execution-engine.service.ts:421-457` | `HandlerDependenciesFactory` 분리 또는 `NodeRuntimeContext` 인터페이스 추상화 |
+| W-50 | 아키텍처 | `ExecutionEngineModule`이 `Cafe24Module` 직접 import — OCP 위반 | `execution-engine.module.ts:25` | `CAFE24_API_CLIENT` DI 토큰 추상화, AppModule conditional provider 등록 |
+| W-51 | 아키텍처 | `WebsocketModule` ↔ `ExecutionEngineModule` ↔ `KnowledgeBaseModule` 양방향 순환 의존성 | `execution-engine.module.ts:43`; `websocket.module.ts:22-26`; `knowledge-base.module.ts:38` | `EventEmitter2` 기반 이벤트 분리로 순환 해소 |
+| W-52 | 아키텍처 | `backend/src/common` vs `backend/src/shared` 역할 경계 미명시 — `S3Service`가 `common/`에 위치 | `backend/src/common/`, `backend/src/shared/` | `common/` = HTTP/NestJS 레이어, `shared/` = 레이어 독립 타입으로 정의, `S3Service` 이동, ADR 명문화 |
+| W-53 | 아키텍처 | `Cafe24ApiClient`(1,271줄) HTTP 요청, rate-limit, OAuth 토큰 갱신, 상태 전이 혼재 | `cafe24-api.client.ts` 전체 | `Cafe24HttpTransport`, `Cafe24TokenManager`, `Cafe24RateLimiter`로 분해 |
+| W-54 | 의존성 | OTel 패키지 두 버전 공존(`sdk-node@0.205.0` + `0.57.2`) — trace context 전파 단절 위험 | `backend/package.json` | `@opentelemetry/auto-instrumentations-node`를 `^0.76.0`으로 업데이트 |
+| W-55 | 의존성/보안 | `fast-uri` path traversal·host confusion 취약점(CVSS 7.5 HIGH) | `backend/package.json` 간접 dep | `"overrides": { "fast-uri": ">=3.2.0" }` 추가 |
+| W-56 | 의존성/보안 | OTel Prometheus DoS 취약점(CVSS 7.5 HIGH) | `@opentelemetry/auto-instrumentations-node@0.55.3` | `^0.76.0`으로 업데이트 |
+| W-57 | 의존성 | `hono` JWT 검증 오류·CSS 인젝션·cross-user 캐시 누수 | `backend/package.json` 간접 dep | `@modelcontextprotocol/sdk` 최신 버전으로 업데이트 |
+| W-58 | 의존성/테스트 | Playwright docker 이미지(v1.47.0)와 devDependencies(`^1.59.1`) 12 minor 버전 불일치 | `docker-compose.e2e.yml:169`; `frontend/package.json` | docker 이미지를 lock 파일 기준 버전과 일치하도록 업데이트 |
+| W-59 | 의존성 | `minio/minio:latest` 태그 미고정 | `docker-compose.yml`, `docker-compose.e2e.yml` | 특정 date-tagged release로 고정 |
+| W-60 | 데이터베이스 | V049 마이그레이션 파일-디렉토리 명충돌 — Flyway Linux 환경 예측 불가 동작 | `backend/migrations/V049__integration_consecutive_network_failures.sql` | `git rm -r`로 빈 디렉토리 제거 |
+| W-61 | 데이터베이스 | `NotificationsService.findByResource` workspaceId 격리 없음 — 향후 재사용 시 IDOR 위험 | `notifications.service.ts:22-30` | 선택적 `workspaceId` 파라미터 추가 |
+| W-62 | 데이터베이스 | `install_token` 컬럼 `VARCHAR(64)` vs spec "길이 제약 없음" 서술 불일치 | `integration.entity.ts:62`; `V042__cafe24_private_app_pending_install.sql:13` | spec Rationale 수정 또는 마이그레이션으로 `TEXT` 변경 |
+| W-63 | 데이터베이스 | `hasRecentByResource` 복합 조건 쿼리 인덱스 누락 — 알림 발사 시마다 seq scan | `notifications.service.ts:125-134` | `CREATE INDEX CONCURRENTLY idx_notification_workspace_type_resource` 추가 |
+| W-64 | 데이터베이스 | `duplicate`(Workflow 복사) 시 Nodes/Edges 미복사 — 메서드명과 동작 불일치 가능 | `workflows.service.ts:171-188` | spec 의도 확인; 전체 복사라면 `dataSource.transaction` + Node/Edge 복사 |
+| W-65 | 동시성 | `pendingContinuations` Map 핸들러 등록 타이밍 race — 부팅 직후 cancel 메시지 drop 가능 | `execution-engine.service.ts:459-526` | 메시지 버퍼 + handler 등록 시 flush 패턴; 또는 `OnApplicationBootstrap`으로 통일 |
+| W-66 | 동시성 | `ScheduleRunnerService.onModuleInit` 다중 인스턴스 중복 upsert 동작 가정 미명시 | `schedule-runner.service.ts:107-126` | 동작 가정을 코드 주석에 명시 또는 lock 활용 |
+| W-67 | 동시성 | `ForEachExecutor` context 직접 mutate — Parallel 조합 시 잠재 오염 위험 | `foreach-executor.ts:78-83` | `{ ...context, itemContext: { ... } }` shallow clone 전달 |
+| W-68 | 동시성 | `handleSubscribe` async await 경계에서 MAX_SUBSCRIPTIONS 한도 재검사 누락 | `websocket.gateway.ts:64` | `authorizer.authorize` 완료 후 `clientSubs.size` 재검사 |
+| W-69 | 변경 범위 | B-3-7 cursor 제거 후 `spec/4-nodes/4-integration/4-cafe24.md` §3/§4.2 미갱신 | `spec/4-nodes/4-integration/4-cafe24.md:23,90` | spec에서 `cursor` 언급 제거 + Rationale 결정 근거 명문화 |
+| W-70 | 변경 범위 | `test(cafe24)` 커밋에 프로덕션 런타임 동작 변경(`logUsage` try/catch) 혼입 | `d6baf89a`; `integration-handler-base.ts` | fix/test 성격 분리 커밋 원칙 수립 |
+| W-71 | 변경 범위 | refactor 커밋에 review 아카이브 파일 26개 혼입 — 코드 히스토리 가독성 저하 | `eacbd45e`, `bb038f90` | review 산출물은 별도 `chore(review):` 커밋으로 분리 |
+| W-72 | 부작용 | `Cafe24InstallNonceCache` 독립 Redis 연결 생성 — `redis.config.ts`에 `password/tls` 키 미정의로 인증 Redis 도입 시 replay 방어 무음 비활성화 | `cafe24-install-nonce-cache.service.ts:43-65` | `redisConfig`에 `password/tls` 키 추가 또는 공유 ioredis 인스턴스 DI |
+| W-73 | 부작용 | `Cafe24InstallNonceCache.close()` NestJS `OnModuleDestroy` 미등록 — 정상 종료 시 Redis 연결 누수 | `cafe24-install-nonce-cache.service.ts:115-121` | `implements OnModuleDestroy` + `async onModuleDestroy() { await this.close(); }` |
+| W-74 | 부작용 | `OAUTH_STUB_MODE` 가드 로직이 세 곳에 서로 다른 허용 목록으로 중복 | `integration-oauth.service.ts:66-70`; `main.ts:27-35` | `isStubModeAllowed()` 공통 유틸로 추출 |
+| W-75 | 부작용 | `NotificationsService.hasRecentByResource` 신규 공개 메서드가 기존 부분 mock 테스트에서 누락 시 런타임 오류 | `notifications.service.ts:117-138` | 기존 mock에 `hasRecentByResource: jest.fn()` 추가 |
+| W-76 | 문서 | README `INTEGRATION_ENCRYPTION_KEY` 누락 — 신규 개발자가 설정 시 통합 자격증명 암호화 실패 | `README.md:155-196` | `backend/.env` 예시에 `INTEGRATION_ENCRYPTION_KEY=<32-byte-hex>` 추가 |
+| W-77 | 문서 | `frontend/README.md` yarn/pnpm/bun 명령 나열 — 프로젝트 규약(npm 전용)과 충돌 | `frontend/README.md:10-14` | yarn/pnpm/bun 줄 제거, npm 단일 명령만 유지 |
+| W-78 | 문서 | spec 파일 85개 중 56개(66%)에 `## Rationale` 섹션 부재 | `spec/4-nodes/1-logic/` 외 다수 | 비자명한 complex 노드와 핵심 시스템 스펙부터 우선 추가 |
+| W-79 | 문서 | `packages/expression-engine`, `packages/node-summary` README 없음 | `packages/expression-engine/`, `packages/node-summary/` | 최소한의 README(목적, 빌드/사용법, export API) 추가 |
+| W-80 | 문서 | `README.md:328` `# integration (SSO)` h1 헤딩 수준 오류 | `README.md:328` | `## integration (SSO)`로 변경 |
+
+---
+
+## 참고 (INFO)
+
+개별 항목은 생략하고 카테고리별 건수를 집계한다. 대표 항목만 인용한다.
+
+| 카테고리 | 건수 | 대표 항목 |
+|----------|------|-----------|
+| 요구사항 | 7 | ED-AI-39 legacy fallback 만료 기준 미명시(`review-workflow.ts:716`); `buildIntegrationMeta` provider 레지스트리 패턴 필요 시점 미명시 |
+| 보안 | 5 | bcrypt 라운드 12 상수 여러 파일 분산; expression-engine AST 샌드박스 확인됨(긍정); `.env` git 추적 제외 확인됨(긍정) |
+| 성능 | 4 | `TO_CHAR` GROUP BY 인덱스 미활용 (`statistics.service.ts:135-154`); `Evaluator` new 인스턴스 매 expression 생성; `sortByStartedAt` 매 WS 이벤트마다 전체 배열 정렬 |
+| 유지보수성 | 5 | `sanitizeId`/`sanitizeToolName` 동일 정규식 중복; `Cafe24McpToolProvider.__resetForTesting()` public API 노출; `result-detail.tsx` 1,111줄 |
+| 테스트 | 5 | 프론트엔드 Cafe24 Private App 설치 흐름 e2e 미커버; Zustand 전역 상태 초기화 패턴 누락; fix ↔ test 추적성(`// 회귀 안전망: <issue-ref>` 주석) 낮음 |
+| API 계약 | 4 | `DELETE /workspaces/:id` 204 대신 200; OAuth 콜백 access_token URL 노출(`?token=...`); `GET /login-history` cursor DTO 미사용 |
+| 아키텍처 | 3 | `nodes/core/node-component.interface.ts`가 `modules/` 구체 서비스 타입 import; frontend 컴포넌트 레이어 직접 API 호출; `packages/*` 경계 건전함(긍정) |
+| 의존성 | 4 | `expression-engine` `dayjs` 버전 낮음; `react`/`react-dom` exact pin; `cron-parser` 중복 설치; `p-limit@7` ESM/CJS 혼용 |
+| 데이터베이스 | 3 | `AuthConfig.type` CHECK constraint ORM 미반영; `LlmConfig.apiKey` VARCHAR(500) 암호화 후 근접 가능성; `findByResource` N+1 잠재 + 인덱스 누락 |
+| 동시성 | 4 | `WebsocketGateway.subscriptions` async 핸들러 interleave; Nonce SETNX 원자성 확인됨(긍정); `ContinuationBusService` 분산 락 확인됨(긍정); `ParallelExecutor.nodeOutputCache` shallow copy invariant 런타임 검증 없음 |
+| 변경 범위 | 3 | `pg-error.ts` 공통 헬퍼 신설 conventions 미언급; Phase 8 spec 동시 갱신 확인됨(긍정); plan/complete 이동 시 spec 링크 갱신 여부 미확인 |
+| 부작용 | 2 | `logUsage` swallow 메트릭 연동 없음; `CAFE24_MALL_ID_PATTERN` 정규식 3중 중복 |
+| 문서 | 6 | spec 내 `prd/` 경로 참조 역사 표기로 잔존; spec 내 `memory/` 경로 5곳 잔존; CHANGELOG 단일 "Unreleased" 섹션; `backend/README.md` 환경변수 불완전; backend 핵심 서비스 JSDoc 밀도 저조; `frontend/README.md` 보일러플레이트 잔존 |
+
+---
+
+## 에이전트별 위험도 요약
+
+| 에이전트 | 위험도 | 핵심 발견 |
+|----------|--------|-----------|
+| requirement | HIGH | Re-run 완전 미구현(C-1/C-2), AI Agent 도구 연결 무기한 보류(C-3), spec-코드-plan 3축 드리프트 |
+| security | HIGH | Database Query 노드 SSRF 무방어(W-5), WebSocket CORS 와일드카드(W-1), protobufjs CVE 5건(C-13) |
+| performance | HIGH | `sanitizePayloadForWs` CPU 병목(C-4), ForEach O(N) 선형 탐색(C-5), 프론트 16패스 동기 순회(W-23) |
+| maintainability | MEDIUM | `APP_URL` 6곳 분산(W-28), 메시지 클램프 이중 구현(W-29), 대형 파일 2건(W-33/W-34) |
+| testing | HIGH | HMAC 웹훅 운영 미동작 + 테스트 전무(C-11), Cafe24 OAuth callback e2e 부재(C-12) |
+| documentation | HIGH | spec 앵커 링크 13건 파손(C-7/C-14/C-15), README 포트 혼재(C-8), `INTEGRATION_ENCRYPTION_KEY` 누락(W-76) |
+
+... (truncated due to size limit) ...

```

---

### 파일 34: review/consistency/2026/05/17/12_12_46/_prompts/rationale_continuity.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/17/12_12_46/_prompts/rationale_continuity.md b/review/consistency/2026/05/17/12_12_46/_prompts/rationale_continuity.md
new file mode 100644
index 00000000..a18ee05a
--- /dev/null
+++ b/review/consistency/2026/05/17/12_12_46/_prompts/rationale_continuity.md
@@ -0,0 +1,905 @@
+# Rationale 연속성 Check Payload
+
+본 파일은 orchestrator 가 Rationale 연속성 checker 용으로 작성한 입력입니다. target 문서가 기존 spec 의 `## Rationale` 에서 이미 기각·폐기된 결정을 다시 도입하거나 합의 원칙을 무시하지 않는지 분석한다.
+sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
+따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
+인자가 가리키는 경로에 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.
+
+## 점검 관점 (Rationale 연속성)
+
+1. **기각된 대안의 재도입** — target 이 과거 Rationale 에서 명시적으로 거부한 대안을 다시 채택하고 있는가 (이유 명시 없이)
+2. **합의된 원칙 위반** — Rationale 에 박혀있는 설계 원칙을 따르지 않고 있는가
+3. **결정의 무근거 번복** — 과거 결정을 뒤집으면서 새 Rationale 를 함께 작성하지 않고 있는가
+4. **암묵적 가정 충돌** — Rationale 에 기록된 시스템 invariant 를 우회하는 설계가 들어와 있는가
+
+## 검토 모드
+spec draft 검토 (--spec)
+
+## Target 문서
+경로: `plan/in-progress/spec-draft-cafe24-restricted-scopes.md`
+
+```
+---
+worktree: cafe24-restricted-scopes-a1b2c3
+started: 2026-05-17
+owner: project-planner
+type: spec-draft
+target_specs:
+  - spec/conventions/cafe24-restricted-scopes.md (NEW)
+  - spec/conventions/cafe24-api-metadata.md
+  - spec/conventions/cafe24-api-catalog/_overview.md
+  - spec/conventions/cafe24-api-catalog/mileage.md
+  - spec/conventions/cafe24-api-catalog/notification.md
+  - spec/conventions/cafe24-api-catalog/privacy.md
+  - spec/conventions/cafe24-api-catalog/store.md
+  - spec/2-navigation/4-integration.md
+  - spec/4-nodes/4-integration/4-cafe24.md
+---
+
+# SPEC DRAFT: Cafe24 별도 승인 scope/operation 식별 메타데이터 도입
+
+본 draft 는 `/consistency-check --spec` 사전 검토용 변경안 본문이다. 승인 후 각 target_spec 에 반영한다.
+
+---
+
+## D1. NEW — `spec/conventions/cafe24-restricted-scopes.md`
+
+```markdown
+# CONVENTION: Cafe24 별도 승인이 필요한 Scope · Operation
+
+> 관련 문서: [Cafe24 API Metadata 컨벤션](./cafe24-api-metadata.md) · [Cafe24 API Catalog](./cafe24-api-catalog/_overview.md) · [Spec 통합 화면 §5.8 Cafe24](../2-navigation/4-integration.md#58-cafe24)
+
+Cafe24 Admin API 의 일부 scope·operation 은 카페24 본사가 별도로 승인한 클라이언트만 사용할 수 있다. 공식 문서가 다음 문구로 명시한다:
+
+> "해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요."
+
+본 컨벤션은 그 명단을 single-source-of-truth 로 박제한다. backend 메타데이터의 `restrictedApproval` 필드 (cafe24-api-metadata 컨벤션 §2) 와 catalog 파일의 `restricted` 컬럼 (cafe24-api-catalog _overview §2) 이 본 명단과 일치해야 하며, `catalog-sync.spec.ts` 가 동기 검증을 강제한다.
+
+---
+
+## 1. Scope 단위 별도 승인 (resource 전체 영향)
+
+해당 scope 가 부여된 OAuth 동의 자체가 본사 승인 없이는 실패한다. 자매 operation 모두 영향을 받는다.
+
+| Scope | Resource (catalog 파일) | 설명 |
+|---|---|---|
+| `mall.read_mileage` | [mileage.md](./cafe24-api-catalog/mileage.md) | 적립금 조회 |
+| `mall.write_mileage` | [mileage.md](./cafe24-api-catalog/mileage.md) | 적립금 수정 |
+| `mall.read_notification` | [notification.md](./cafe24-api-catalog/notification.md) | 알림 조회 |
+| `mall.write_notification` | [notification.md](./cafe24-api-catalog/notification.md) | 알림 발송 |
+| `mall.read_privacy` | [privacy.md](./cafe24-api-catalog/privacy.md) | 개인정보 조회 |
+| `mall.write_privacy` | [privacy.md](./cafe24-api-catalog/privacy.md) | 개인정보 수정 |
+
+> 위 카탈로그의 모든 row 는 catalog 표의 `restricted` 컬럼 = `scope`, backend 메타데이터의 `restrictedApproval.level='scope'` 로 표기된다.
+
+## 2. Operation 단위 별도 승인 (store scope 안의 일부)
+
+`mall.read_store` / `mall.write_store` 자체는 일반 사용 가능하지만, 안의 일부 operation 만 별도 승인 대상이다. 카탈로그 표에서 해당 row 만 `restricted: op` 로 표기한다.
+
+| 영역 | 영향 operation id (catalog [store.md](./cafe24-api-catalog/store.md)) | 설명 |
+|---|---|---|
+| Activitylogs | `activitylogs_list`, `activitylogs_get` | 활동 로그 목록/상세 조회 |
+| Financials paymentgateway | `financials_paymentgateway_get` | PG사 계약정보 조회 |
+| Menus | `menus_get` | 메뉴 조회 |
+| Naverpay setting | `naverpay_setting_get`, `naverpay_setting_create`, `naverpay_setting_update` | 네이버페이 설정 조회·등록·수정 |
+| Kakaopay setting | `kakaopay_setting_get`, `kakaopay_setting_update` | 카카오페이 설정 조회·수정 |
+| Paymentgateway | `paymentgateway_create`, `paymentgateway_update`, `paymentgateway_delete` | PG 생성·수정·삭제 |
+| Paymentgateway paymentmethods | `paymentgateway_paymentmethods_list`, `paymentgateway_paymentmethods_create`, `paymentgateway_paymentmethods_update`, `paymentgateway_paymentmethods_delete` | PG 결제수단 목록/생성·수정·삭제 |
+
+## 3. 별도 프로그램 승인
+
+카페24 승인 제휴사에만 제공되는 별도 트랙. 본 프로젝트는 현재 직접 호출 경로를 구현하지 않으며, 본 명단은 향후 도입을 위한 placeholder 다.
+
+| API | 설명 |
+|---|---|
+| Cafe24 Analytics API | 카페24 승인 제휴사에만 제공. 쇼핑몰 사용자 행동 데이터 제공 서비스 제작 용도 |
+
+## 4. 사용 정책
+
+### 4.1 사용자 안내 (UI)
+
+위 §1·§2 의 항목은 다음 4 화면에서 동일한 ⚠ 배지·tooltip 으로 표기된다:
+
+1. **통합 추가 위저드 Step 2 Scope 체크박스** (Spec 통합 화면 §3.2 Cafe24 Public/Private)
+2. **통합 상세 §4.4 Scope & Permissions 탭** (현재 scope · 권장 scope · 누락 scope 모두)
+3. **Cafe24 노드 Operation 드롭다운** (Spec Cafe24 노드 §2)
+4. **AI Agent allowlist UI** (Spec Cafe24 노드 §8.3, Spec MCP Client §5.6)
+
+배지 hover 시 tooltip 문구 (한국어):
+
+> "카페24 본사 승인이 필요한 권한입니다. 미승인 상태로 동의를 시도하면 `invalid_scope` 로 실패하거나, 인증 후 호출 시 403 이 반환될 수 있어요. [Cafe24 개발자센터 문의 →]"
+
+영어 (i18n):
+
+> "This permission requires Cafe24 partner approval. Without approval, the OAuth flow may reject it as `invalid_scope`, or API calls may return 403. [Contact Cafe24 Developer Center →]"
+
+### 4.2 차단 정책
+
+체크/저장은 **차단하지 않는다**. 이미 본사 승인을 받은 사용자가 있을 수 있으므로 "알고 누른다" 만 보장. 단 체크된 권한 중 별도 승인 필요 항목이 1개 이상이면 위저드 Step 2 폼 하단에 **영구 amber 경고 배너**를 띄운다 (사용자가 인지하지 못한 채 진행하는 사례 차단).
+
+### 4.3 에러 안내 (에러 발생 후)
+
+- **OAuth `invalid_scope`**: backend 의 cafe24 OAuth callback 이 응답을 파싱 후 요청한 scopes ∩ 본 명단 §1 의 교집합이 비어있지 않으면 `Integration.status_reason='oauth_invalid_scope'` 와 함께 `last_error.details.requiresCafe24Approval: string[]` 에 영향 scope 를 기록. 통합 상세 페이지가 본 단서를 읽어 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지 노출.
+- **노드 실행 중 `INSUFFICIENT_SCOPE (403)`**: 응답 `details.requiresCafe24Approval: string[]` 에 사용 scope ∩ 본 명단의 교집합을 채워 보낸다. frontend 가 본 필드가 비어있지 않으면 별도 승인 안내 분기 메시지를 노출.
+
+### 4.4 신규 코드 추가 없음
+
+기존 `OAuth invalid_scope` 분기, `INSUFFICIENT_SCOPE (403)` 응답 모두 그대로 유지하고 `details.requiresCafe24Approval` 보강 필드로만 표현. 새 HTTP 상태/에러 코드 vocabulary 추가는 하지 않는다 (하위 호환).
+
+## 5. 명단 갱신 절차
+
+1. Cafe24 공식 문서를 다시 확인해 본 명단의 진위·추가/삭제를 검증.
+2. 본 문서의 §1·§2·§3 표 갱신.
+3. 영향받는 catalog 파일 (`mileage.md` / `notification.md` / `privacy.md` / `store.md` / 추가 영향 resource) 의 `restricted` 컬럼 갱신.
+4. backend 메타데이터의 `restrictedApproval` 필드 동시 갱신.
+5. `npm test --workspace backend -- catalog-sync` 로 양방향 동기 확인.
+6. UI 4 화면에서 ⚠ 표기가 새 명단을 따라 자동 갱신되는지 시각 회귀 (해당 컴포넌트는 메타데이터 기반 자동 렌더링).
+
+## 6. 참고 링크
+
+- Cafe24 Admin API 공식 문서: https://developers.cafe24.com/docs/api/admin/
+- Scope별 사용 동의 가이드: https://developers.cafe24.com/app/front/app/develop/api/scope
+- Cafe24 Analytics API: https://developers.cafe24.com/docs/ko/api/cafe24data/
+- 카페24 개발자센터 문의: https://developers.cafe24.com
+
+## 7. CHANGELOG
+
+| 일자 | 변경 |
+|------|------|
+| 2026-05-17 | 신규 컨벤션 — 사용자 보고 (질문에서 제공한 표) 와 공식 문서 안내 문구를 기반으로 별도 승인 대상 명단 정식 등재. backend 메타데이터 `restrictedApproval` 필드 + catalog `restricted` 컬럼과 함께 도입. consistency-check 세션: (예정). |
+```
+
+---
+
+## D2. EDIT — `spec/conventions/cafe24-api-metadata.md`
+
+### D2.1 §2 Operation 메타데이터 형식 — 필드 추가
+
+기존 인터페이스 정의 (§2) 의 끝에 추가:
+
+```diff
+  responseShape?: 'list' | 'single' | 'empty';
+  paginated?: boolean;
++
++  // 별도 승인 라벨링 — [cafe24-restricted-scopes 컨벤션](./cafe24-restricted-scopes.md)
++  // 의 명단과 일치해야 하며, catalog-sync.spec.ts 가 카탈로그 row 의
++  // `restricted` 컬럼과 양방향 동기를 검증한다.
++  restrictedApproval?: {
++    level: 'scope' | 'operation' | 'program';
++    category:
++      | 'mileage' | 'notification' | 'privacy'         // scope 전체
++      | 'activitylogs' | 'menus' | 'pg_settings'        // store 안 operation 단위
++      | 'naverpay_setting' | 'kakaopay_setting'
++      | 'analytics';                                    // 별도 프로그램 (placeholder)
++    docsUrl?: string;
++    inquiryUrl: string;                                 // 카페24 개발자센터 안내 링크
++  };
+}
+```
+
+§2 본문 아래에 다음 문단 추가:
+
+```markdown
+**`restrictedApproval` 의 의미**
+
+본 필드는 카페24 본사가 별도 승인한 클라이언트만 호출할 수 있는 operation 을 식별한다. 명단의 single-source-of-truth 는 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md). UI 4 화면 (위저드 / 통합 상세 Scope 탭 / Cafe24 노드 Operation 드롭다운 / AI Agent allowlist) 이 본 필드를 읽어 ⚠ 배지·tooltip 을 자동 렌더한다. `level='scope'` 인 row 는 같은 resource (mileage/notification/privacy) 의 모든 자매 operation 에 같은 라벨이 자동 적용되므로 backend 메타데이터에서는 row 별로 빠짐없이 채운다.
+```
+
+### D2.2 §5 신규 endpoint 추가 절차 — 단계 추가
+
+기존 §5 의 step 5 (카탈로그 row 갱신) 본문에 다음 항목 추가:
+
+```diff
+5. [`cafe24-api-catalog/<resource>.md`](./cafe24-api-catalog/_overview.md) 의 표에 해당 row 의 `status` 를 `planned → supported` 로 갱신하고 `method` / `path` / `scope` / `paginated` 컬럼을 채운다. 카탈로그에 row 자체가 없으면 새로 추가.
++   - 추가로 별도 승인 대상인 경우 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md) 명단과 비교해 catalog 의 `restricted` 컬럼(`scope` / `op` / 빈칸) 과 backend 메타데이터의 `restrictedApproval` 필드를 동시 갱신한다.
+```
+
+§5 의 step 7 (백엔드 단위 테스트 검증) 본문에 다음 줄 추가:
+
+```diff
+   - **카탈로그 ↔ 메타데이터 양방향 동기** (`catalog-sync.spec.ts`)
++   - **restricted 컬럼 ↔ `restrictedApproval` 양방향 동기** (`catalog-sync.spec.ts`) — catalog 가 `scope` 또는 `op` 면 메타데이터에 `restrictedApproval` 존재, 그 역도 동일.
+```
+
+### D2.3 §8 CHANGELOG 추가
+
+```markdown
+| 2026-05-17 | §2 `Cafe24OperationMetadata.restrictedApproval` optional 필드 추가 + §5 절차에 catalog `restricted` 컬럼 동시 갱신 의무 명문화. SoT 는 신규 컨벤션 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md). 사용자 보고 — 카페24 본사 승인 필요 권한이 사용자에게 식별되지 않는 UX 문제 해소. consistency-check 세션: (예정). |
+```
+
+---
+
+## D3. EDIT — `spec/conventions/cafe24-api-catalog/_overview.md`
+
+### D3.1 §2 표 컬럼 정의 — 컬럼 추가
+
+기존 표에서 `status` 행 위에 다음 행 삽입:
+
+```markdown
+| `restricted` | — | `scope` / `op` / 빈칸. `scope` = 본 scope 자체가 카페24 별도 승인 대상이라 같은 resource 의 모든 row 가 영향. `op` = 본 row 만 단독 승인 대상 (store 안 케이스). 빈칸 = 일반 사용 가능. 명단의 SoT 는 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md) |
+```
+
+### D3.2 §4 동기 정책 — 검증 규칙 추가
+
+기존 검증 규칙 7번 뒤에 8번 추가:
+
+```markdown
+8. **`restricted` 컬럼 ↔ 메타데이터 `restrictedApproval` 동기**: catalog row 의 `restricted` 컬럼이 `scope` 또는 `op` 이면 그 row 에 대응하는 backend 메타데이터에 `restrictedApproval` 필드가 존재해야 하고 그 역도 동일. 컬럼 값과 메타데이터 `level` 의 매핑은: `scope` ↔ `level='scope'`, `op` ↔ `level='operation'`. `level='program'` 은 본 catalog 와 별개로 다뤄진다 (Analytics 등 catalog 화 대상이 아닌 트랙).
+```
+
+### D3.3 §7 CHANGELOG 추가
+
+```markdown
+| 2026-05-17 | §2 에 `restricted` 컬럼 추가 + §4 에 검증 규칙 8 신설. 카페24 별도 승인 대상 식별 — SoT 는 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md). 사용자 보고 (질문에서 제공한 표) 후속. |
+```
+
+---
+
+## D4. EDIT — catalog 표 (영향 resource)
+
+### D4.1 `mileage.md` — 표 헤더 + 모든 row 갱신
+
+표 헤더에 `restricted` 컬럼 추가 (scope 와 paginated 사이):
+
+```diff
+- | id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
+- |----|---|---|---|---|---|---|---|---|
++ | id | 라벨 (한) | English title | method | path | scope | restricted | paginated | status | docs |
++ |----|---|---|---|---|---|---|---|---|---|
+```
+
+모든 supported row 의 `restricted` 컬럼 = `scope`. 예:
+
+```markdown
+| `mileage_list` | 적립금 내역 조회 | Retrieve points | GET | `points` | read | scope | ✓ | supported | [↗](...) |
+| `mileage_grant` | 적립금 지급 | Issue and deduct points | POST | `points` | write | scope |  | supported | [↗](...) |
+| `points_autoexpiration_get` | 적립금 자동 만료 조회 | Retrieve an automatic points expiration | GET | `points/autoexpiration/{id}` | read | scope |  | supported | [↗](...) |
+| `points_autoexpiration_create` | 적립금 자동 만료 생성 | Create an automatic points expiration | POST | `points/autoexpiration` | write | scope |  | supported | [↗](...) |
+| `points_autoexpiration_delete` | 적립금 자동 만료 삭제 | Delete an automatic points expiration | DELETE | `points/autoexpiration/{id}` | write | scope |  | supported | [↗](...) |
+| `points_report` | 적립금 리포트 조회 | Retrieve a points report by date range | GET | `points/report` | read | scope |  | supported | [↗](...) |
+| `credits_list` | 예치금 내역 조회 | Retrieve a list of credits by date range | GET | `credits` | read | scope | ✓ | supported | [↗](...) |
+| `credits_report` | 예치금 리포트 조회 | Retrieve a credit report by date range | GET | `credits/report` | read | scope |  | supported | [↗](...) |
+```
+
+### D4.2 `notification.md` — 동일 패턴
+
+12 supported row 모두 `restricted: scope`.
+
+### D4.3 `privacy.md` — 동일 패턴
+
+6 supported row 모두 `restricted: scope`.
+
+### D4.4 `store.md` — 영향 row 만 갱신
+
+전체 헤더에 `restricted` 컬럼 추가. 빈칸이 기본이며 다음 row 만 `restricted: op`:
+
+- `activitylogs_list` (planned)
+- `activitylogs_get` (planned)
+- `financials_paymentgateway_get` (planned)
+- `menus_get` (planned)
+- `naverpay_setting_get` (planned)
+- `naverpay_setting_create` (planned)
+- `naverpay_setting_update` (planned)
+- `kakaopay_setting_get` (planned)
+- `kakaopay_setting_update` (planned)
+- `paymentgateway_create` (supported)
+- `paymentgateway_update` (supported)
+- `paymentgateway_delete` (supported)
+- `paymentgateway_paymentmethods_list` (supported)
+- `paymentgateway_paymentmethods_create` (planned)
+- `paymentgateway_paymentmethods_update` (planned)
+- `paymentgateway_paymentmethods_delete` (planned)
+
+> 참고: `paymentmethods_list` / `paymentmethods_paymentproviders_list` 는 사용자 자료에 명시되지 않았으므로 빈칸 유지. 향후 공식 문서 재검증 시 갱신.
+
+---
+
+## D5. EDIT — `spec/2-navigation/4-integration.md`
+
+### D5.1 §3.2 Cafe24 Public 흐름 — Step 2 폼 안내 추가
+
+기존 Step 2 의 끝에 다음 노트 추가:
+
+```markdown
+> **별도 승인 필요 권한 안내** — 체크박스 옆 ⚠ 아이콘이 표시된 카테고리·operation 은 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. 명단의 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md). 체크 자체는 차단하지 않으나, 체크된 권한 중 별도 승인 대상이 1개 이상이면 폼 하단에 영구 amber 경고 배너를 띄운다. 미승인 상태로 진행하면 OAuth 단계에서 `invalid_scope` 또는 호출 시 `INSUFFICIENT_SCOPE (403)` 으로 실패할 수 있음을 안내. tooltip 문구 / 경고 배너 / 에러 분기 메시지의 i18n 키 정의는 같은 컨벤션 §4 참고.
+```
+
+### D5.2 §5 Scope 권장 프리셋 표 — "별도 승인" 컬럼 추가
+
+기존 표:
+
+```diff
+- | 카테고리 | scope 값 (R / W) |
+- |---------|------------------|
++ | 카테고리 | scope 값 (R / W) | 별도 승인 |
++ |---------|------------------|----------|
+```
+
+각 행의 마지막 컬럼:
+
+- 일반 카테고리 (Product, Order, Customer, Category, Promotion, Shipping, Sales report, Translation, Application, Design, Community, Collection, Supply, Personal): 빈칸
+- Mileage, Notification, Privacy: `⚠ 필요` (R/W 모두)
+- Store: `⚠ 일부 sub-resource` (Activitylogs, Menus, Naverpay/Kakaopay/PG settings — 자세한 명단은 [`cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md) 링크)
+
+표 아래 본문 추가:
+
+```markdown
+> "⚠" 표기된 카테고리는 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. 일반 사용자가 무심코 체크 후 OAuth 진행 시 `invalid_scope` 로 실패할 수 있어, UI 에서 체크박스 옆에 ⚠ 아이콘 + tooltip + 폼 하단 경고 배너로 인지를 보장한다. Store 의 부분 제한은 scope 단위가 아닌 operation 단위라 노드 Operation 드롭다운 ([Spec Cafe24 노드 §2](../4-nodes/4-integration/4-cafe24.md#2-설정-ui)) 의 ⚠ 라벨이 1차 안내 지점이다. 명단 SoT 는 [`cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md).
+```
+
+### D5.3 §4.4 Scope & Permissions 탭 — 표에 행 추가
+
+기존 표:
+
+```diff
+| 요소 | 설명 |
+|------|------|
+| 현재 scope 목록 | `credentials.scopes[]` 전체를 체크된 상태로 표시 |
+| 권장 scope 목록 | 서비스별 프리셋. 현재 scope에 없는 항목은 체크 해제 상태 |
+| 누락 scope 배지 | `status_reason = insufficient_scope`일 때 누락 scope 목록을 빨간 뱃지로 강조 |
++ | 별도 승인 필요 ⚠ 배지 | 현재 scope·권장 scope·누락 scope 의 각 항목 옆에 `restrictedApproval` (메타데이터) 가 있는 scope/operation 만 ⚠ 배지 자동 노출. tooltip 본문은 [`cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md) §4.1 의 i18n 문구. `[Request scopes]` 버튼 위쪽에 "추가하려는 scope 중 N개는 카페24 별도 승인 필요" 보조 텍스트 (N=교집합 크기) |
+| `[Request scopes]` 버튼 | (기존 그대로) |
+```
+
+### D5.4 §9.4 공통 응답 포맷 — `INSUFFICIENT_SCOPE` 보강 필드 명시
+
+기존 `INSUFFICIENT_SCOPE (403)` 행 본문 갱신:
+
+```diff
+-  - `INSUFFICIENT_SCOPE` (403) — 노드 실행 중 감지 시 `Integration.status`도 갱신
++  - `INSUFFICIENT_SCOPE` (403) — 노드 실행 중 감지 시 `Integration.status` 도 갱신. `details.missingScopes: string[]` 에 누락 scope 목록을 담고, 그 중 카페24 별도 승인이 필요한 항목은 추가로 `details.requiresCafe24Approval: string[]` 에 채워 반환한다 (Cafe24 통합에 한정 — 다른 통합은 본 필드 미포함). frontend 는 `requiresCafe24Approval` 가 비어있지 않으면 에러 메시지에 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지를 추가 노출. 본 필드는 신규 에러 코드 없이 보강만 — 하위 호환 유지. 명단 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md).
+```
+
+### D5.5 §10.4 에러 매핑 — OAuth `invalid_scope` 분기 보강
+
+기존 §10.4 (에러 매핑) 에 다음 행 추가:
+
+```markdown
+| `oauth_invalid_scope` | OAuth callback 이 Cafe24 의 `invalid_scope` 응답을 받음. `last_error.details.requiresCafe24Approval: string[]` 에 요청 scope ∩ [`cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md) §1 의 교집합을 기록. 통합 상세 페이지가 본 단서를 읽어 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지 노출. status 는 보존 (재인증으로 회복 가능) |
+```
+
+### D5.6 Rationale — 신규 항목 추가
+
+`## Rationale` 섹션의 끝에 추가:
+
+```markdown
+### Cafe24 별도 승인 scope 의 식별·안내 (2026-05-17)
+
+**문제**: Cafe24 Admin API 중 mileage/notification/privacy 의 모든 scope 와 store 안 일부 operation (activitylogs, menus, naverpay/kakaopay/PG settings 등) 은 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. spec 에 이를 표현하는 차원이 없어 사용자가 위저드에서 일반 카테고리처럼 체크 → OAuth `invalid_scope` 거부 또는 호출 시 `INSUFFICIENT_SCOPE (403)` 으로 좌초. 원인 안내 장치 부재.
+
+**채택**: backend 메타데이터의 `Cafe24OperationMetadata.restrictedApproval` 필드와 catalog 의 `restricted` 컬럼을 SoT 로 두고, UI 4 화면 (위저드 / 상세 §4.4 / 노드 Operation 드롭다운 / AI Agent allowlist) 이 같은 필드를 읽어 ⚠ 배지·tooltip·경고 배너를 자동 렌더. 명단 SoT 는 신규 컨벤션 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md).
+
+**기각 대안**:
+- (A) 사용자가 체크 시 차단 — 이미 승인받은 합법 사용자 케이스를 막아버린다. 안내만, 차단 없음 정책 채택.
+- (B) 신규 에러 코드 추가 (`CAFE24_APPROVAL_REQUIRED`) — 기존 `INSUFFICIENT_SCOPE (403)` / `invalid_scope` 처리 경로를 분기시켜 client 코드 호환성에 영향. `details.requiresCafe24Approval` 보강 필드만으로 충분.
+- (C) catalog 의 `status` enum 에 `restricted` 값 추가 — supported / planned / deprecated 와는 직교 차원이라 enum 확장은 의미 오염. 별도 컬럼이 정답.
+
+**Trade-off**: mileage resource 안의 `credits_*` (예치금) 가 정확히 `mall.read_mileage` 를 쓰는지 vs 별도 scope (`mall.read_deposits` 등) 인지의 공식 분리 확인은 사용자 자료 범위 밖이므로, scope 단위 라벨링 (level='scope') 을 mileage resource 전체에 적용. 향후 공식 문서로 분리 확인되면 본 결정 정정.
+
+출처: 사용자 보고 (2026-05-17). consistency-check 세션: (예정).
+```
+
+---
+
+## D6. EDIT — `spec/4-nodes/4-integration/4-cafe24.md`
+
+### D6.1 §2 설정 UI — Operation 드롭다운 라벨링 추가
+
+기존 §2 의 Operation 드롭다운 설명 줄에 추가:
+
+```diff
+- Operation 후보 표시: 카탈로그 (`spec/conventions/cafe24-api-catalog/`) 의 `status: planned` 행도 dropdown 에 노출하되 disabled + "(지원 예정)" 접미사로 구분. resource 옆에 "지원 N개 · 추후 지원 M개" coverage hint.
++ Operation 후보 표시: 카탈로그 (`spec/conventions/cafe24-api-catalog/`) 의 `status: planned` 행도 dropdown 에 노출하되 disabled + "(지원 예정)" 접미사로 구분. resource 옆에 "지원 N개 · 추후 지원 M개" coverage hint.
++ - **별도 승인 라벨**: 메타데이터 row 에 `restrictedApproval` 이 있는 operation 은 라벨 우측에 ⚠ 아이콘 + 보조 텍스트 ("별도 승인 필요") 표시. resource 가 scope 단위 restricted (mileage/notification/privacy) 면 같은 resource 의 모든 operation 에 자동 적용. tooltip 본문·문의 링크는 [`spec/conventions/cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md) §4.1.
+```
+
+### D6.2 §8.3 allowlist — UI 라벨링 추가
+
+기존 §8.3 끝에 다음 문단 추가:
+
+```markdown
+**별도 승인 라벨 (UI)**: AI Agent allowlist 의 카테고리 단위 grouping UI 에서, scope 전체가 별도 승인 대상인 카테고리 (mileage/notification/privacy) 는 그룹 헤더에 ⚠ + "별도 승인 필요". store 안 일부 operation 단위 restricted (paymentgateway_*, activitylogs_*, menus_*, naverpay_setting_*, kakaopay_setting_*, financials_paymentgateway_get 등) 는 operation 행 단위로 같은 ⚠ 표기. backend 가 `mcpServers` 메타데이터 응답에 `restrictedApproval` 을 통과시켜 frontend 가 자동 렌더한다. 명단 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md).
+```
+
+### D6.3 §10 CHANGELOG 추가
+
+```markdown
+| 2026-05-17 | §2 Operation 드롭다운에 별도 승인 ⚠ 라벨 명세 + §8.3 AI Agent allowlist UI 의 동일 ⚠ 라벨 명세 추가. 메타데이터 `Cafe24OperationMetadata.restrictedApproval` 신설 ([cafe24-api-metadata 컨벤션 §2](../../conventions/cafe24-api-metadata.md#2-operation-메타데이터-형식)) + 카탈로그 `restricted` 컬럼 ([_overview §2](../../conventions/cafe24-api-catalog/_overview.md#2-표-컬럼-정의)) + SoT 컨벤션 [`cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md) 신설과 한 세트. 사용자 보고 (2026-05-17) — 카페24 본사 승인 필요 권한이 사용자에게 식별되지 않는 UX 문제 해소. consistency-check 세션: (예정). |
+```
+
+### D6.4 Rationale — 신규 항목 추가
+
+`## 9. Rationale` 의 끝에 추가:
+
+```markdown
+### 9.11 별도 승인 라벨 — 노드 Operation / AI Agent allowlist 의 ⚠ 표기
+
+UI 4 화면 (통합 위저드 / 통합 상세 §4.4 / 노드 Operation 드롭다운 / AI Agent allowlist) 의 라벨링은 같은 메타데이터 SoT (`Cafe24OperationMetadata.restrictedApproval`) 에서 자동 렌더. 명단의 진위는 [`cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md) 가 유일 출처이며, 본 노드 spec 은 그 라벨이 노드/AI Agent 의 어디에서 시각화되는지만 명시한다 — 명단을 직접 enumerate 하지 않는 이유는 drift 방지 (cafe24-api-metadata.md §3 의 "endpoint enumeration 을 spec 본문에 인라인하지 않는다" 정책과 동일).
+```
+
+---
+
+## D7. 영향 요약
+
+### 신규 파일
+
+- `spec/conventions/cafe24-restricted-scopes.md`
+
+### 수정 파일
+
+- `spec/conventions/cafe24-api-metadata.md` (§2 / §5 / CHANGELOG)
+- `spec/conventions/cafe24-api-catalog/_overview.md` (§2 / §4 / CHANGELOG)
+- `spec/conventions/cafe24-api-catalog/mileage.md` (헤더 + 전체 row)
+- `spec/conventions/cafe24-api-catalog/notification.md` (헤더 + 전체 row)
+- `spec/conventions/cafe24-api-catalog/privacy.md` (헤더 + 전체 row)
+- `spec/conventions/cafe24-api-catalog/store.md` (헤더 + 영향 16 row)
+- `spec/2-navigation/4-integration.md` (§3.2 / §4.4 / §5 / §9.4 / §10.4 / Rationale)
+- `spec/4-nodes/4-integration/4-cafe24.md` (§2 / §8.3 / §10 CHANGELOG / Rationale 9.11)
+
+### 신규 식별자 (충돌 검토 대상)
+
+- `restrictedApproval` (메타데이터 필드명)
+- `restricted` (catalog 표 컬럼명)
+- `requiresCafe24Approval` (API 에러 details 필드명)
+- `oauth_invalid_scope` (Integration.status_reason 값)
+- `level` enum: `scope` / `operation` / `program`
+- `category` enum: `mileage` / `notification` / `privacy` / `activitylogs` / `menus` / `pg_settings` / `naverpay_setting` / `kakaopay_setting` / `analytics`
+
+### 기각된 대안 (Rationale 에 기록)
+
+- 차단 정책 (사용자 안내만, 차단 없음)
+- 신규 에러 코드 (`CAFE24_APPROVAL_REQUIRED` 등 — 보강 필드로 대체)
+- catalog `status` enum 확장 (별도 컬럼이 정답)
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
+### Attention 가상 필터값 — Expired ∪ Expiring ∪ Error 를 단일 칩으로 노출 (2026-05-16)
+
+§2.4 "Need attention" 배너의 클릭 동작이 spec 텍스트("`Expiring | Expired | Error` 로 자동 전환")와 구현 사이에서 어긋나 사용자가 알림에 표시된 항목을 필터 페이지에서 찾지 못하는 사례가 보고됐다. 원인은 (a) UI 의 상태 칩 모델이 단일 선택이라 세 상태를 동시에 전환할 표현이 없었고, (b) 구현이 차선책으로 `?status=expiring` 단일 필터로만 보냈기 때문이다. 본 spec 개정에서 두 가지를 정리한다.
+
+**1. UI: `Attention` 칩 신설.** `Expired ∪ Expiring ∪ Error` 합집합을 단일 값으로 추가해 단일 선택 칩 모델을 유지하면서 합집합을 제공한다. 멀티 선택 칩 도입이나 `?status=expiring&status=expired` 같은 multi-value 쿼리도 검토했으나 (a) URL 공유성 저하, (b) 다른 단일 필터(`scope`, `q`)와의 일관성 깨짐, (c) 분석/감사 시 "사용자가 어떤 카테고리를 봤는지" 의 의도 신호가 흐려짐 으로 기각.
+
+**2. 백엔드: 가상 필터값(virtual filter) 규약.** `Integration.status` DB Enum 은 `connected` / `expired` / `error` / `pending_install` 4개로 유지하고, API 필터의 `status` 파라미터 값 공간은 이를 포함하면서 추가로 `expiring`(이미 도입), `attention` 두 가상값을 갖는다. 가상값은 영속화되는 상태가 아니라 화면 필터링용 술어 — 백엔드 쿼리 빌더가 WHERE 절을 합성한다. 다음 두 원칙을 따른다:
+
+- **이름 분리**: 가상값 이름은 DB Enum 과 겹치지 않는다 (`expiring`, `attention` 모두 DB 에 없음). 사용자가 칩 라벨에서 본 단어가 그대로 URL 파라미터로 들어간다.
+- **DB 엔티티 비확장**: 가상값을 위해 Enum 을 늘리지 않는다 — 영속 상태와 화면 술어를 섞으면 state machine(§6) 이 비대해진다.
+
+**3. 배너 톤·점프 동작 보강.** 분해 카운트(만료 X · 만료 임박 Y · 오류 Z) 를 한 줄에 표시해 어떤 카테고리가 몇 건인지 한눈에 보이게 한다. `error ≥ 1` 일 때 dot 색을 amber 에서 red 로 미세 강조 — 사용자가 "어떤 종류가 섞여있는지" 를 카피 읽기 전에 시각적으로 인지하게 한다. 합계 = 1 일 때는 필터링 단계가 잉여이므로 그 한 건의 detail 로 직접 점프 — 사용자가 어차피 그 건을 열어볼 것이므로 단축이 자연스럽다. "1건일 때만" 의 분기는 합계 ≥ 2 일 때 필터링이 필요한 일반 케이스와 명확히 분리된다 (필터링 → detail 의 한 클릭을 줄임).
+
+(개정 전 텍스트는 "클릭 시 상태 필터를 `Expiring | Expired | Error`로 자동 전환" 한 줄로, 단일 선택 칩과 모순되는 의도만 남기고 구현 표현은 위임 상태였다. 본 개정으로 의도가 실제 구현 가능한 형태(`Attention` 단일 칩 + `?status=attention`)로 닫힌다.)
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
+**TTL 기준 (2026-05-15 갱신, 2026-05-16 보강)**: `install_token_issued_at` 컬럼 (V044) 을 기준으로 한다 — `created_at` 이 아닌 토큰 발급 시각. 변경 3 (중복 pending_install 재사용) 으로 같은 mall_id 의 begin 재호출이 기존 row 의 install_token 만 갱신할 때, 새 토큰이 발급되자마자 24h 카운트가 끝나 있는 문제를 해소. callback 성공 시 `install_token` 과 `install_token_issued_at` 모두 **보존**된다 (2026-05-16 갱신 — 옛 NULL 처리 기술은 "install_token persistent 격상" 결정과 미정합 표기 잔존이었다) — post-install navigation 의 식별 키이며, 24h TTL 스캐너는 `status='pending_install'` row 만 대상으로 하므로 connected 전이 후의 값이 잘못된 만료 처리에 영향을 주지 않는다. NULL 처리는 `pending_install → expired (install_timeout)` 만료 경로에서만 발생한다. 옛 (V044 이전) 행은 `install_token_issued_at` NULL — 스캐너 SQL 이 `COALESCE(install_token_issued_at, created_at)` 로 fallback 해 legacy 의미를 유지.
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
+**TOCTOU 부재**: 회복 분기는 SELECT + HMAC verify 만 수행하는 read-only 조회로 INSERT/UPDATE 가 없어 race 자체가 발생하지 않는다. begin 핸들러의 V045 partial UNIQUE backstop (`CAFE24_PRIVATE_APP_ALREADY_CONNECTED` Rationale 참조) 은 INSERT 단계의 동시 신청 차단을 담당하는 보완 보증이며, 본 분기와는 다른 시점의 보증.
+
+**보안 분석**: HMAC 위조에는 client_secret 이 필요. client_secret 보유자는 정상 흐름으로도 동일 행위 가능 → 회복 흐름이 추가 권한을 부여하지 않음. install_token capability-token 가정 ("CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제" 항 참조) 는 그대로 유지 — 옛 URL 이 leak 되어도 HMAC 위조 없이는 진행 불가.
+
+**모호 케이스 (2개+ HMAC 매칭)**: 같은 mall_id 가 두 workspace 에 등록되어 있고 동일 client_secret 을 공유하는 경우 (드문 케이스 — 한 Cafe24 앱을 우리 서비스의 둘 이상 workspace 에서 동시에 사용). 어느 row 를 선택할지 결정 불가 → 회복 포기 + 404. 회복 운영로그 (`[cafe24-install-recovery] ambiguous: N rows passed HMAC`) 가 진단을 보조.
+
+**HTML 에러 페이지**: 404 (회복 실패 포함) 시 요청의 `Accept: text/html` 일 때 minimal styled HTML 페이지 렌더. error code/message + 회복 안내 ("통합 상세 페이지에서 현재 App URL 을 확인해 Cafe24 Developers 를 갱신하세요"). API 클라이언트 (JSON 기대) 는 기존 JSON 응답 유지.
+
+### Cafe24 Public app 가용성 — env 기반 노출 (2026-05-15 후속)
+
+Cafe24 Public app 흐름은 우리 서버의 `CAFE24_CLIENT_ID` / `CAFE24_CLIENT_SECRET` env 가 등록된 경우에만 동작 (앱스토어 등록 앱의 OAuth client credentials). env 가 미설정이면 Public 옵션을 선택해도 begin 이 `OAUTH_CONFIG_MISSING` 으로 거부 — 사용자 입장에서 dead-end UX.
+
+**결정**: `/api/integrations/services` 응답의 cafe24 항목에 `meta.publicAppAvailable: boolean` 노출. `CAFE24_CLIENT_ID && CAFE24_CLIENT_SECRET` 둘 다 set 이면 true. Frontend 의 신규 통합 폼이 false 일 때 Public 옵션 토글에서 제거 + 기본값 `private` 강제 + 안내 문구 갱신.
+
+**Private 는 항상 노출**: env 와 무관. 사용자가 직접 client_id/secret 입력하므로 deployment 의 env 상태에 의존하지 않음. Public 만 env 게이트 (사용자 명시 결정).
+
+**왜 server-side 게이트인가**: 클라이언트가 env 를 알 길이 없으므로 server 가 single source of truth. `meta` 객체에 담아 향후 다른 가용성 hints (예: GitHub Enterprise URL 설정 여부 등) 도 같은 통로로 노출 가능.
+
+### BullMQ `cafe24-token-refresh` 큐 — 멀티 인스턴스 race 해소 (2026-05-16)
+
+[`spec/4-nodes/4-integration/4-cafe24.md` §9.6](../4-nodes/4-integration/4-cafe24.md#96-rate-limit-의-범위-한정) 가 "Redis 기반 분산 mutex 도입은 별도 spec 으로" 라는 미결로 남겼던 cross-pod refresh race 가 PR #56 의 BullMQ 큐 도입으로 해소됐다. 새 큐 `cafe24-token-refresh` 가 모든 cafe24 refresh 호출을 `jobId = integrationId` dedup 으로 클러스터 전체에서 직렬화한다.
+
+**문제 정의 (옛 미결)**: 두 backend pod 이 같은 통합에 대해 동시에 refresh 를 시도하면 둘 다 Cafe24 `/oauth/token` 에 같은 old refresh_token 으로 요청을 보내 last-write-wins 로 한쪽 토큰이 orphan 되거나, Cafe24 의 rotation 정책에 따라 한쪽이 `invalid_grant` 401 을 받고 잘못 `error(auth_failed)` 격하될 수 있었다.
+
+**채택 — BullMQ `jobId` dedup**:
+- 같은 통합에 대한 동시 enqueue 가 `Queue.add({ jobId: integrationId })` 의 dedup 로 단일 worker 실행으로 모임. 모든 호출자가 `waitUntilFinished` 로 동일 worker 결과 공유.
+- Worker (`Cafe24TokenRefreshProcessor`) 는 DB 재로드 + 재확인 short-circuit 후 `refreshAccessToken` 호출 → atomic 4-field UPDATE.
+- proactive (API 호출 직전) + background (일일 스캐너) 양쪽 진입점이 동일 큐를 사용.
+
+**기각된 대안**:
+- **PostgreSQL advisory lock** (`pg_advisory_xact_lock(hashtext(integrationId))`): 코드 단순하지만 lock 보유 중 HTTP 요청(Cafe24 endpoint)을 transaction 안에 묶어야 해 DB 커넥션 점유 시간이 늘고, BullMQ 가 이미 스택에 있어 별도 메커니즘 추가의 운영 부담이 더 큼.
+- **Redis redlock**: 인프라 의존성 추가, BullMQ 와 Redis 를 공유하긴 하지만 별도 lock 메커니즘 운영.
+- **In-memory mutex (`withIntegrationLock`) 유지만**: 옛 single-pod 한계 그대로. 멀티 pod 배포 시 race 미해소.
+
+**경계**:
+- 본 큐는 **refresh 호출의 cross-pod 직렬화**만 담당. API 호출 자체 (Cafe24 leaky bucket 관리) 는 여전히 `Cafe24ApiClient` in-memory mutex 가 같은 pod 내에서만 직렬화 — Cafe24 leaky bucket 이 per-mall quota 라 cross-pod 직렬화 불필요 (per-pod backoff 신호로 충분). 자세한 분리는 §9.6 참고.
+- 큐 미바인딩 환경 (unit test) 에서는 fallback 으로 in-process `refreshAccessToken` 직접 호출. production wiring 은 항상 큐 경유.
+
+### `cafe24-background-refresh` 10일 임계 (2026-05-16)
+
+Cafe24 의 `refresh_token` 은 14일 유효이며, Cafe24 가 매 refresh 마다 새 refresh_token 을 발급 (rotation). 활성 통합 (주 1회 이상 사용) 은 매 사용 시점에 proactive refresh 가 일어나 사실상 영구 유효하다. 그러나 14일 이상 idle 인 통합은 refresh_token 까지 만료되어 사용자가 재인증해야 한다.
+
+**결정**: 일일 `cafe24-background-refresh` 잡이 `lastRotatedAt < now - 10d OR IS NULL` 인 connected cafe24 통합을 자동 refresh.
+
+**임계 10일 근거**:
+- 14일 유효 - 4일 안전 마진 = 10일. 갱신 실패 / 큐 적체 / 일일 잡 한 번 누락 시에도 마감 전 재시도 여지.
+- 더 짧게 (예: 매일) 잡으면 Cafe24 leaky bucket 에 불필요한 부담. 운영 부하 vs 안전 마진 trade-off.
+- 더 길게 (예: 12일) 잡으면 안전 마진 부족.
+
+**신규 통합 NULL 처리**:
+- `integrations.service.create()` 가 cafe24 신규 통합 row 생성 시 `lastRotatedAt = new Date()` 로 명시 초기화 (PR #67 DB-1 fix).
+- 옛 row (PR #67 이전) 또는 다른 진입점에서 NULL 로 저장된 경우를 대비해 쿼리 조건이 `Or(LessThan(cutoff), IsNull())` belt-and-suspenders.
+
+**경계**: 본 잡은 enqueuer 역할이며 실제 refresh 는 `cafe24-token-refresh` 큐의 worker 가 수행 (역할 분리). proactive call 과 같은 jobId dedup 으로 충돌 없이 협력.
+
+### Cafe24 install_token mismatch 회복 흐름 — 보안 전제 (2026-05-16)
+
+`tryRecoverByMallId` (Rationale "Cafe24 install_token mismatch 회복 흐름" 의 회복 분기) 가 production 코드에 존재한다. 이는 옛 spec §9.8 의 "100건 스캔 + trial HMAC 폐기" 와 **표현상 충돌**하나 본질적으로 다른 경로다.
+
+**구분**:
+- 옛 폐기 흐름: install_token 자체가 없던 시절의 **모든 호출에 적용**되는 식별 전략. mall_id 만으로 매칭하고 HMAC trial 로 row 를 골랐다.
+- 새 회복 흐름: **단일 row 조회 실패 시에만** fall-back 으로 작동. 정상 흐름은 install_token 단일 row 조회 그대로.
+
+**보안 전제 — HMAC 검증 유지**: 회복 분기에서도 mall_id 매칭 후보 row 들의 client_secret 으로 HMAC 검증을 1회씩 수행. HMAC 통과는 client_secret 보유의 증명이므로 권한 escalation 없음. install_token capability-token 가정 ("CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제" 항) 은 본 회복 흐름이 깨뜨리지 않는다 — 옛 install_token 이 leak 되어도 HMAC 위조 없이는 회복 분기를 통과 못 함.
+
+**DoS 보호**: 코드 상수 `RECOVERY_CANDIDATE_LIMIT = 5`. 후보 overflow 시 회복 포기 (404) — workspace 횡단으로 같은 mall_id 가 5개 이상이면 HMAC trial 자체를 거부해 amplification 차단. 정상 운영에서 같은 mall_id 의 cafe24 row 는 보통 1~2개라 영향 없음.
+
+**로그 정책 (PR #67 SEC H-2)**: 회복 시도·결과 로그에서 cross-tenant Integration UUID 와 install_token prefix 를 제거. mall_id + status 만 로깅해 enumeration 단서를 줄임.
+
+### refresh 실패 시 status_reason 통일 (2026-05-16)
+
+spec §6 가 옛 표기 `connected → expired | refresh fail` 로 명시했으나, 구현은 refresh 실패 시 `error(auth_failed)` 로 전이했었다. UI 분기·재인증 안내 문구·`Notification.type` 발사 정책 (§11.2) 에 일관성 결손.
+
+**결정**: `error(auth_failed)` 채택. 옛 `expired (refresh_failed)` 분기 폐기. `expired` status 는 두 경로로 한정 — (1) refresh_token 없는 일반 OAuth provider (예: GitHub) 의 `token_expires_at` 만료 (`status_reason='token_expired'`), (2) Cafe24 Private 의 `pending_install → expired (install_timeout)`. 즉 본 변경은 cafe24 등 refresh_token 보유 provider 의 refresh 실패 경로에만 영향을 주고, `token_expires_at` 만료 자체 (§11.1 `connected-expiry` 스캐너) 는 그대로 유지된다.
+
+**이유**:
+- (a) UI 가 reauthorize 액션을 권장하기에 더 자연스러움. `expired` 는 "자동 재발급 시도 후 만료" 의미가 강해, terminal refresh_token 만료 (사용자 재인증 필요) 와 의미가 어긋남.
+- (b) refresh_token 자체 만료 (terminal — Cafe24 가 14일 후 invalidate) 와 access_token 만료 (자동 회복 가능 — refresh 가능) 를 의미적으로 구분 보존. `error(auth_failed)` 는 전자 (사용자 액션 필요), `expired` 는 일반 OAuth provider 의 후자 신호로 분리.
+- (c) PR #67 의 REQ-C2 (transport 3회 → `error(network)`) 와 같은 `error(*)` 도메인에서 일관 분류.
+
+**데이터 모델 변경 없음** — `Integration.status_reason` 컬럼 값 정의만 갱신 (`spec/1-data-model.md §2.10` 참고): `expired` 의 사유에서 `refresh_failed` 제거, `error` 의 사유에 `auth_failed` / `insufficient_scope` / `network` 보존. `token_expired` 는 일반 OAuth provider 의 `expired` 경로 (refresh_token 없는 provider) 용으로 유지.
+
+**알림 정책 (§11.2)**: `integration_expired` 알림은 `expired` 전이 중에서도 `token_expired` 경로에만 발사. `install_timeout` 도 `expired` 전이지만 별도 결정으로 미발사 — 아래 ["install_timeout 알림 미발사"](#install_timeout-알림-미발사-2026-05-16) 항 참조. `error(*)` 전이는 별도 알림 없이 UI 배지로만 통지. 향후 별도 알림 타입 필요 시 `integration_action_required` 등 신설 검토.
+
+### install_timeout 알림 미발사 (2026-05-16)
+
+PR #75/#76 의 spec 표현 ("expired 전이 두 경로 — token_expired, install_timeout — 모두 발사") 이 코드 미확인 상태에서 기재된 오기. `expirePendingInstalls()` (`backend/src/modules/integrations/integration-expiry-scanner.service.ts:251-287`) 는 bulk UPDATE 만 수행하고 `notificationsService.createMany` 호출이 없으며, 본 결정으로 그 동작이 의도임을 명문화한다.
+
+**결정**: `pending_install → expired (install_timeout)` 전이는 `integration_expired` 알림 **미발사**.
+
+**이유**:
+- (a) **사용자 인지** — `pending_install` 상태는 사용자가 외부 흐름 (Cafe24 Developers 의 "테스트 실행") 을 직접 진행 중인 명시적 상태. 24h 안에 install 을 완료하지 못했다는 건 본인이 시작점·진행 상황을 알고 있을 가능성이 큼.
+- (b) **UI 통지 충분** — 통합 상세 페이지의 status 배지 + 목록 페이지의 "Need attention" 배너로 통지. 별도 알림은 over-noise.
+- (c) **일관성** — `pending_install` 의 다른 callback 실패 분기 (`oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`) 도 알림 미발사. install_timeout 만 발사하면 일관성 결손.
+- (d) **"조용한 전이" 원칙의 연장선** — `install_token=NULL` 소거 (Rationale "install_token TTL 24h") 와 같은 결정 흐름. 외부 흐름 미완료가 자명한 상태 변화는 외부에서 들어오는 새 시도가 아닌 한 알림 가치 낮음.
+
+기각된 옵션 (install_timeout 알림 발사): UI 배지로 충분히 통지되는 자기-시작 상태에 알림을 더하면 over-noise. 향후 별도 도메인 알림 (예: `integration_action_required`) 신설 시 재검토 가능.
+
+**범위**: 본 결정은 `Notification.type='integration_expired'` 미발사만 다룬다. UI 배지·다음 install 시도 시 `install_token=NULL` 로 인한 404 등 다른 동작은 영향 없음.
+
+### Cafe24 App URL 상세 페이지 표시 (2026-05-16)
+
+Cafe24 admin "앱으로 가기" / Cafe24 Developers "테스트 실행" 의 HMAC 검증 실패 에러 페이지(`renderInstallErrorHtml`) 는 사용자에게 "통합 상세 페이지에 표시된 URL 과 일치하는지 확인하세요" 라고 안내한다. 그러나 옛 상세 페이지에는 App URL 이 표시되지 않아 안내가 실효성을 잃었다 (2026-05-16 사용자 보고 — App URL 호출이 `CAFE24_INSTALL_INVALID_HMAC` 으로 거부됐을 때 비교 기준이 없었다).
+
+**해결안**: 상세 페이지 Overview 탭에 `Cafe24AppUrlCard` 를 추가해 App URL/Redirect URI 를 복사 버튼과 함께 노출 (§4.2 표 참조). 백엔드는 `IntegrationDto.appUrl: string | null` 필드를 Cafe24 Private 한정으로 계산해 응답에 포함하며, `install_token` 자체는 별도 필드로 노출하지 않는다 — App URL path segment 안에 이미 포함되며 별도 필드 노출은 (a) 중복, (b) 식별자가 두 곳에 분산되어 클라이언트가 어느 값으로 비교해야 할지 혼동, (c) 향후 path 형식 변경 시 양쪽 필드 동기화 부담, 세 가지 이유로 회피.
+
+**새 등록 흐름과의 일관성**: `frontend/src/app/(main)/integrations/new/page.tsx` 의 `Cafe24PrivatePending` 컴포넌트와 동일한 복사 UX 패턴(라벨 + 모노스페이스 URL + 복사 버튼 + 1줄 안내) 을 재사용해 사용자 혼동을 줄인다.
+
+**HMAC 검증 진단 로그 보강**: 본 변경과 함께 `handleInstall` 의 HMAC 실패 3 분기 (mall_id 불일치 / client_secret 부재 / HMAC 자체 불일치) 가 동일 `CAFE24_INSTALL_INVALID_HMAC` 응답을 반환하는 옛 동작은 유지하되 (응답 코드 단일화 정책 유지 — capability-token 가정 보호), `logger.warn` 로 어느 분기인지·URL mall_id 와 DB mall_id 의 일치 여부·DB app_type/status/status_reason·install_token prefix+suffix 4자를 기록한다. `client_secret` 자체는 절대 로그에 남기지 않는다 — `SECRET_LEAK_PATTERNS` 정책과 일관 (보안 로깅 규약의 spec/conventions 정식화는 별도 plan).
+
+### HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)
+
+PR #67 의 SEC H-1 (2026-05-16) 가 HMAC 검증을 "Java `URLEncoder.encode(value, "UTF-8")` 호환 (공백 `+`)" 으로 정정했으나, 운영 환경에서 **신규 통합 직후 즉시 HMAC 실패** 가 재현됐다 (사용자 보고, 2026-05-16 — PR #89 의 진단 로그가 `reason=hmac_verify_failed` 를 정확히 식별). mall_id / app_type / install_token / client_secret 모두 매칭하는데 HMAC 자체만 불일치 — 알고리즘 자체의 결함.
+
+**근본 원인**: Cafe24 의 공식 `validationCheckHmac` Java 샘플은 `request.getQueryString()` 을 `&` 로 split → `=` 로 한 번만 split → TreeMap 에 **raw value 그대로** 저장한 뒤 concat 한다. 즉 **URL value 를 decode 하지 않으며 re-encode 도 하지 않는다**. 우리 SEC H-1 fix 는 "Cafe24 가 URLEncoder 를 호출한다" 라고 가정했지만, 실제로는 URL 의 raw byte sequence 를 그대로 HMAC 메시지에 넣는다.
+
+**증거**: 사용자 보고 URL 의 `user_name=%EB%8C%80%ED%91%9C%20%EA%B4%80%EB%A6%AC%EC%9E%90` — Cafe24 가 공백을 `%20` 으로 보낸다. 만약 Cafe24 가 HMAC 계산에 URLEncoder 를 호출한다면 메시지 안의 값은 `%EB%8C%80%ED%91%9C+%EA%B4%80%EB%A6%AC%EC%9E%90` 가 되어야 하고, 그 결과 Cafe24 자신의 HMAC 도 자기네 URL 과 매칭이 안 되어 검증이 동작하지 않을 것이다. 따라서 Cafe24 는 raw 값을 사용한다 (이론적 추론 + 운영 재현 동시 확인).
+
+**해결**: `buildHmacMessage` 가 `URLSearchParams` 로 decode 하지 않고 `rawQuery.split('&')` 로 직접 파싱해 key/value 의 raw byte string 을 그대로 보존한다. sort 는 key 만 알파벳 순. value 인코딩은 Cafe24 가 어떤 인코더로 URL 을 만들었든 무관 — byte 단위로 일치하기만 하면 된다.
+
+```typescript
+function buildHmacMessage(rawQuery: string): string {
+  return rawQuery
+    .split('&')
+    .map((part) => {
+      const eqIdx = part.indexOf('=');
+      const key = eqIdx === -1 ? part : part.slice(0, eqIdx);
+      return { key, raw: part };
+    })
+    .filter((p) => p.key.length > 0 && p.key !== 'hmac')
+    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
+    .map((p) => p.raw)
+    .join('&');
+}
+```
+
+**기각된 옵션 (raw 보존 대신 다양한 인코더 시도)**: `encodeURIComponent` / `URLEncoder` 호환 / browser fetch encoding 등 후보 인코더가 매번 차이가 있어 (`%20` vs `+`, `*` vs `%2A`, `!` vs `%21` 등) 어느 하나로 매칭이 보장되지 않는다. Cafe24 자체도 향후 인코더를 바꿀 수 있다. raw byte 보존은 인코더 invariant 다.
+
+**보안 영향 없음**: HMAC 자체의 cryptographic strength 는 변하지 않는다. capability-token 보호 ([Rationale "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제"](#cafe24_install_invalid_token404-의-보안-전제-2026-05-14)) 도 그대로. 옛 PR #67 의 SEC H-2 (workspace 횡단 enumeration 방지) 도 그대로.
+
+**테스트 보강**: 사용자 실제 URL (`user_name=...%20...` + 실제 timestamp 패턴) 의 회귀 보호 테스트 추가. 옛 `accepts HMAC for queries containing space-encoded values` 테스트는 `John+Doe` 형식을 사용했으나 — 그건 우리 옛 알고리즘의 self-fulfilling 검증 (compute 와 verify 가 같은 broken 알고리즘 사용) 이라 실제 Cafe24 동작 검증이 안 됐다. 새 테스트는 **Cafe24 가 보내는 형식 (`%20`) 그대로** raw query 를 만들어 검증한다.
+
+**관련 history**:
+- 2026-05-14: HMAC 알고리즘 최초 도입 (`encodeURIComponent` 사용, 운영 양호)
+- 2026-05-16 (PR #67 SEC H-1): `formUrlEncode` 로 변경 (잘못된 가정에 기반한 회귀)
+- 2026-05-16 (본 결정): raw-value 보존으로 재정정 (Cafe24 실제 동작 반영)
+
+### Cafe24 Public 흐름의 begin-time 사전 가드 추가 (2026-05-16)
+
+Public 흐름은 begin 단계에서 Integration row 를 만들지 않으므로 V045 partial UNIQUE 가 발사되는 시점이 `POST /api/integrations` finalize 단계로 미뤄진다. 사용자가 Cafe24 동의 페이지까지 마친 뒤에야 충돌이 드러나고, `IntegrationsService.throwIfUniqueViolation` 의 옛 분기는 `integration_workspace_name_unique` 만 처리해 `idx_integration_cafe24_workspace_mall` 위반은 raw `QueryFailedError` → 500 으로 빠지던 UX 결함이 있었다.
+
+조치:
+
+- **begin 단계 사전 가드** — Public 분기에도 Private 와 동일한 `(workspaceId, mall_id)` connected row 사전 SELECT 추가. `IntegrationOAuthService.findConnectedCafe24MallIntegration` 헬퍼로 두 흐름 공유.
+- **race backstop 확장** — `throwIfUniqueViolation` 에 `idx_integration_cafe24_workspace_mall` 분기 추가. begin pre-check 통과 후 동시 INSERT race / finalize 시점 충돌도 동일 409 코드로 변환.
+
+**다른 status (`pending_install`/`expired`/`error`) 가 begin 단계에서 차단되지 않는 이유**:
+
+- `pending_install` 은 Private 흐름의 idempotent begin 정책 (같은 row 를 reuse 해 install_token 보존) 과 호환되어야 한다 ([CAFE24_PRIVATE_APP_ALREADY_CONNECTED 의 mall_id 비교 경로](#cafe24_private_app_already_connected-의-mall_id-비교-경로-2026-05-15-갱신) 항 참조). Public 흐름은 begin 단계에서 row 를 만들지 않으므로 pending_install 이 있더라도 begin 자체는 무영향 — V045 가 finalize 단계에서 차단.
+- `expired`/`error` 는 사용자의 재연동 의도를 반영해 begin 진입 자체는 허용하되, 한 workspace 안에서 같은 mall_id 의 cafe24 통합이 최대 1행이라는 invariant 는 V045 partial UNIQUE 가 finalize 단계에서 보장 (사용자는 기존 행을 먼저 삭제해야 새 통합 등록 가능).
+- 결과적으로 모든 비-connected status 의 race / 충돌은 finalize 의 V045 backstop 이 동일 409 코드로 변환 → 클라이언트는 단일 분기.
+
+### CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드명 유지 결정 (2026-05-16)
+
+본 코드를 Public 흐름에도 재사용하면서 `→ CAFE24_MALL_ALREADY_CONNECTED` rename 안이 ai-review 와 consistency-check 양쪽에서 제기됐으나 사용자 지시로 **기각**. 사유:
+
+- **(a) 클라이언트 호환성** — 기존 클라이언트(프론트엔드, integration 사용자)는 코드의 *의미* (mall_id 기준 중복) 로 분기 처리하므로 이름 변경으로 얻는 가독성 이득은 없다. rename 시 deprecated 처리·alias 추가 등 호환성 부담만 발생.
+- **(b) swagger 규약 정합** — `spec/conventions/swagger.md §2-4` 의 중복/충돌 409 정책과 `INTEGRATION_IN_USE(409)` 선례에 부합. 이름 토큰의 정확성보다 상태 코드·의미의 정확성이 우선.
+- **(c) 의미 기반 명명 선례 예외** — `spec/conventions/swagger.md` 의 의미 기반 명명 원칙에서 본 코드는 historical artifact 예외로 등록한다. 신규 코드는 이 예외를 따르지 않으며 처음부터 의미 정확한 이름을 부여한다.
+
+장기적으로 본 코드가 다른 mall_id 충돌 케이스 (예: cross-workspace 정책 변경) 와 분리해야 할 필요가 생기면 별도 코드 신설을 고려하되, 그 시점까지는 본 코드의 정의를 spec 으로 명확화해 유지한다.
+
+### precheck endpoint — mall_id 입력 단계 사전 감지 UX (2026-05-16)
+
+사용자가 mall_id 를 다 입력하기 전(타이핑 중)에 conflict 를 감지해 inline 경고 배너로 보여주는 read-only endpoint (`GET /api/integrations/cafe24/precheck`). begin 의 pre-check 와 동일한 SELECT 를 노출하되, 다음 설계 결정을 반영한다.
+
+- **응답 shape 최소화** — `{ conflict, existingIntegrationId?, existingName?, status? }` 만 반환. 자격 증명·토큰·timestamps·workspace 메타 비포함.
+- **노출 범위 격리** — 인증된 사용자의 current workspace (X-Workspace-Id 헤더 기준) 소속 cafe24 row 만 반환. cross-workspace enumeration 경로 아님. Organization-scope 도입 후에도 current workspace 의 정의가 변경되면 본 endpoint 가 자동 추종 (별도 RBAC 처리 불필요).
+- **priority status 단일 반환** — `connected > pending_install > error > expired` 순서로 가장 제한적인 status 만 반환 (전체 row 목록이 아닌 단일 status). frontend i18n 메시지 분기 4종이 priority 순으로 일치.
+- **enum 범위 밖 status 처리** — 미래에 추가될 수 있는 transitional status (예: `initializing`) 가 들어오면 `status` 필드를 omit. 강제 캐스팅으로 frontend 가 unknown enum 을 silent fallthrough 하는 위험 차단.
+- **throttle** — 분당 60회. **이 endpoint 전용 상한** (일반 API rate limit 위에 더해지지 않고 본 값으로 대체 — `@Throttle` decorator). 사용자 입력 350ms debounce 기준 정상 호출 1~2회/입력으로 충분한 여유. mall_id 패턴 정규식 매칭이 frontend 에서 사전 1차 차단되므로 backend 호출 자체가 압축됨. brute-force enumeration 의 비용은 회당 1 SQL 조회 + JWT 검증으로 낮으나 throttle 이 backstop.
+
+**O(N) 폐기와의 관계** — [install_token 을 App URL path 식별 키로 승격](#install_token-을-app-url-path-식별-키로-승격-2026-05-14) 항에서 폐기된 "전방위 O(N) mall_id 스캔 + HMAC trial" 패턴과 본 endpoint 는 다르다. precheck 는 V045 plain mall_id 컬럼의 단일 인덱스 lookup (`(workspace_id, mall_id) WHERE service_type='cafe24'`) 으로 O(1) row 만 가져온다. legacy `mall_id IS NULL` fallback 만 backfill 완료 전 임시로 추가 쿼리 발행 — 향후 backfill 종료 시 제거된다 (구현 코드 주석 `findAllCafe24RowsForMall` 참조).
+
+라우트 선언 순서 주의 — `@Get('cafe24/precheck')` 는 동적 경로 `@Get(':id')` 보다 **앞에** 선언되어야 NestJS 가 `cafe24` 를 `:id` 로 소비해 `ParseUUIDPipe` 위반 400 을 일으키지 않는다. controller 코드 주석에 회귀 안전망으로 명시.
+
+#### `spec/2-navigation/9-user-profile.md` 의 Rationale
+
+## Rationale
+
+### `/profile` 편집 인터랙션의 분리 (§2)
+
+초기 와이어프레임은 사용자 정보·환경설정·비밀번호 변경을 한 페이지의 폼으로 묶고 하단 단일 `[Save Changes]` 버튼으로 모두 커밋하는 형태였다. 다음과 같은 footgun 이 식별되어 현재의 하이브리드 편집 패턴(인라인 토글 + sub-route + diff 확인 모달) 으로 개정했다.
+
+- **이질적 변경의 의도 충돌** — 자격증명(비밀번호)·개인정보(이름·아바타)·환경설정(언어·테마) 은 위험 수준이 서로 다른데도 한 번의 클릭이 모두를 동시에 PATCH 하는 구조였다. 사용자 의도와 실제 결과가 어긋날 가능성이 컸다.
+- **무방비 편집 활성화** — 모든 input 이 디폴트로 활성화되어 있어 단순 탐색 중에도 실수 입력이 그대로 저장 대상이 되었다.
+- **세션 강제 종료 패턴과의 톤 불일치** — `/profile/sessions` 의 강제 종료는 이미 `RevokeConfirmDialog`(password/TOTP 재인증) 로 명시적 의도를 분리해 안전하게 운영 중인데, 같은 영역의 다른 민감 동작은 그 톤을 따르지 못하고 있었다.
+
+해법으로 (a) `/profile` 을 디폴트 readonly 로 두고 카드 단위 [편집] 토글로 의도를 분리, (b) 저위험 항목(이름·환경설정) 도 저장 직전 변경 전·후 diff 확인 모달을 한 단계 거치게 해 실수 방지, (c) 고위험 항목(비밀번호) 은 별도 sub-route 진입 자체가 의도 표명 역할을 하도록 채택했다. 이메일은 기존 결정대로 "별도 변경 (확인 메일)" 으로 본 화면에서 분리한 상태를 유지한다.
+
+폐기된 대안:
+
+- **모달 일원화** — 모든 편집을 모달로 처리(인라인 토글 없음). 환경설정처럼 자주 만지는 항목까지 매번 모달이 떠야 해 마찰이 과도하다고 판단.
+- **전 항목 sub-route** — 환경설정·이름까지 모두 별도 라우트로 분리. 라우팅·뒤로가기 비용이 가치 대비 과도. 위험 수준에 비례한 마찰이 더 합리적.
+- **단일 페이지 + 섹션별 Save 버튼** — 폼은 그대로 두고 Save 만 섹션 단위로 쪼개기. "폼이 디폴트로 노출되어 무방비" 라는 핵심 문제를 해결하지 못함.
+
+#### `spec/2-navigation/_layout.md` 의 Rationale
+
+## Rationale
+
+### R-1. 사이드바 로고 변종 규칙 (2026-05-15)
+
+§2.1 로고 행에 expanded/collapsed 변종 규칙을 추가한 이유: 본 문서는 사이드바의 **자리**만 정의하고, 자리에 들어가는 로고 변종·색은 `spec/6-brand.md §8.4` (brand spec) 가 단일 진실로 결정한다. 본 행은 brand spec §8.4.6 의 결정(expanded → Full logo / collapsed → Icon mark)을 자리 정의에 반영한 것이다.
+
+근거 출처: `spec/6-brand.md §8.4.6` (로고 노출 자리) 및 동 문서 R-9 (브랜드 spec 의 라우트 spec 우선권). 사전 일관성 검토 세션: `review/consistency/2026/05/15/18_36_51/`.
+
+### R-2. §2.1 로고 행 정정 (2026-05-15 롤백)
+
+§8.2 컬러 토큰 정식화 폐기(`spec/6-brand.md` R-13) 와 함께, 본 §2.1 의 *"Full logo (light)"* 표현에서 *(light)* 한정을 제거. 라이트/다크 자산 선택은 노출 자리(surface) 의 배경 톤에 따라 brand spec §8.4 가 결정한다. R-1 의 §8.4.6 참조는 본 롤백 후에도 유효하며, 다만 §8.4.6 표 자체가 *"라이트/다크 자산 선택은 노출 자리에 맞춤"* 표현으로 정정되었다.
+
+사전 일관성 검토 세션: `review/consistency/2026/05/15/23_45_11/`.
+
+#### `spec/3-workflow-editor/4-ai-assistant.md` 의 Rationale
+
+## Rationale
+
+본 spec 결정 사항의 배경·근거. memory/ 에 남아있던 작업 메모를 inline 흡수한 것이며, 폐기된 대안과 1회성 분석 자료는 `plan/complete/archive/from-memory/` 를 참조.
+
+_원본 메모: memory/workflow-ai-assistant-decisions.md_
+
+### Workflow AI Assistant — 기획 결정 메모
+
+Workflow AI Assistant(에디터 내 채팅형 AI) 스펙 작성 시 사용자와 합의한 결정 사항을 구현자가 재참조할 수 있도록 정리한다.
+
+#### 확정된 결정 사항
+
+| 항목 | 결정 | 근거 |
+|------|------|------|
+| 제품 명칭 | **Workflow AI Assistant** / 워크플로우 AI 어시스턴트 | PRD/Spec/i18n 전 영역에서 통일 사용. "Copilot", "AI Workflow Builder" 후보는 기각 |
+| PRD 배치 | `prd/2-workflow-editor.md` §10, 요구사항 ID 접두사 `ED-AI-*` | 에디터 내부 UI/UX가 주 영역이므로 에디터 문서에 포함. PRD 6에서는 cross-ref만 |
+| 채팅 세션 영속화 | **서버 저장** (신규 엔티티 `AssistantSession`, `AssistantMessage`) | 페이지 새로고침·재접속 시 이어서 대화 지원. 관련: `spec/1-data-model.md` §2.20~2.21 |
+| 변경 적용 방식 | 즉시 반영 + Undo (`editor-store` 재사용) | 기존 자동 저장/Ctrl+S 흐름과 일관. DB 영구 기록은 사용자의 Save를 통해서만 |
+| 스트리밍 | SSE + `LLMClient.stream()` 신규 메서드 | 관련: `spec/5-system/7-llm-client.md` §8 |
+| 스트리밍 v1 지원 provider | OpenAI, Anthropic만 | Google/Azure는 Tool-use 포맷 차이로 후속. 미지원 provider 선택 시 `ASSISTANT_STREAMING_UNSUPPORTED` 에러 |
+| NodeSettings Panel과 동시 오픈 | **상호 배타** (Assistant 열면 Settings 닫힘) | MVP 단순화. 사용자 피드백에 따라 후속 버전에서 나란히 배치 가능 |
+| Assistant의 편집 권한 | `editor` 역할 이상 | 기존 RBAC 규약 재사용 |
+
+#### 구현 시 유의 사항 (승인된 기술 플랜 `~/.claude/plans/ui-partitioned-porcupine.md` 대비 변경점)
+
+원래 기술 플랜에는 "채팅 히스토
+
+... (truncated due to size limit) ...

```

---

### 파일 35: review/consistency/2026/05/17/12_12_46/_retry_state.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/17/12_12_46/_retry_state.json b/review/consistency/2026/05/17/12_12_46/_retry_state.json
new file mode 100644
index 00000000..72dc05c5
--- /dev/null
+++ b/review/consistency/2026/05/17/12_12_46/_retry_state.json
@@ -0,0 +1,58 @@
+{
+  "session_dir": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_12_46",
+  "summary_subagent_type": "consistency-summary",
+  "summary_output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_12_46/SUMMARY.md",
+  "subagent_invocations": [
+    {
+      "name": "cross_spec",
+      "subagent_type": "cross-spec-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_12_46/_prompts/cross_spec.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_12_46/cross_spec.md"
+    },
+    {
+      "name": "rationale_continuity",
+      "subagent_type": "rationale-continuity-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_12_46/_prompts/rationale_continuity.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_12_46/rationale_continuity.md"
+    },
+    {
+      "name": "convention_compliance",
+      "subagent_type": "convention-compliance-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_12_46/_prompts/convention_compliance.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_12_46/convention_compliance.md"
+    },
+    {
+      "name": "plan_coherence",
+      "subagent_type": "plan-coherence-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_12_46/_prompts/plan_coherence.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_12_46/plan_coherence.md"
+    },
+    {
+      "name": "naming_collision",
+      "subagent_type": "naming-collision-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_12_46/_prompts/naming_collision.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_12_46/naming_collision.md"
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
+  "agent_history": {
+    "cross_spec": [{"status": "success", "issues": 6}],
+    "rationale_continuity": [{"status": "success", "issues": 5}],
+    "convention_compliance": [{"status": "success", "issues": 3}],
+    "plan_coherence": [{"status": "success", "issues": 6}],
+    "naming_collision": [{"status": "success", "issues": 6}]
+  },
+  "rate_limit_episodes": 0,
+  "total_wait_sec": 0,
+  "wake_history": [],
+  "last_reset_hint_sec": null,
+  "loop_mode": false
+}

```

---

### 파일 36: review/consistency/2026/05/17/12_12_46/convention_compliance.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/17/12_12_46/convention_compliance.md b/review/consistency/2026/05/17/12_12_46/convention_compliance.md
new file mode 100644
index 00000000..71a18460
--- /dev/null
+++ b/review/consistency/2026/05/17/12_12_46/convention_compliance.md
@@ -0,0 +1,116 @@
+# 정식 규약 준수 검토 결과
+
+대상 문서: `plan/in-progress/spec-draft-cafe24-restricted-scopes.md`
+검토 모드: spec draft 검토 (--spec)
+
+---
+
+## 발견사항
+
+### 1. 신규 파일 명명 규약 — 완전 준수
+
+- **[INFO]** `spec/conventions/cafe24-restricted-scopes.md` 신규 파일명 준수
+  - target 위치: D1 섹션 / frontmatter `target_specs`
+  - 위반 규약: `spec/conventions/*.md` — "평문" 패턴 (CLAUDE.md 명명 컨벤션 표)
+  - 상세: 신규 컨벤션 파일 `cafe24-restricted-scopes.md` 는 `spec/conventions/` 하위 평문 파일명 패턴을 올바르게 따르고 있다. 숫자 prefix 없이 평문명으로 두는 것이 해당 위치의 정식 규약이며 일치한다.
+  - 제안: 변경 없음.
+
+---
+
+### 2. D1 문서 내부 구조 — `## CHANGELOG` 섹션 포함, `## Rationale` 없음
+
+- **[WARNING]** 신규 컨벤션 파일에 `## Rationale` 섹션 없음
+  - target 위치: D1 `spec/conventions/cafe24-restricted-scopes.md` 전체 구조
+  - 위반 규약: CLAUDE.md §프로젝트 스펙 문서 — "각 spec 문서는 권장 3섹션 구성을 따른다: 1. Overview (제품 정의) / 2. 본문 (스펙) / 3. Rationale — 결정의 배경·근거·폐기된 대안"
+  - 상세: D1 초안 문서는 §1 ~ §7 본문 + `## 7. CHANGELOG` 로 구성되어 있으나 `## Rationale` 섹션이 없다. 기각된 대안(차단 정책 / 신규 에러 코드 / status enum 확장 등)은 D7 의 "기각된 대안" 항목에만 열거되어 있으며, 컨벤션 파일 본문 내부 Rationale 섹션으로 끌어들이지 않았다. 규약은 "권장"이지만, 같은 draft 내 `spec/2-navigation/4-integration.md` (D5.6) 와 `spec/4-nodes/4-integration/4-cafe24.md` (D6.4) 는 모두 Rationale 섹션 추가를 명시하고 있어 일관성 차이가 발생한다.
+  - 제안: D1 초안 `## 6. 참고 링크` 뒤에 `## Rationale` 섹션을 추가하고, D7 의 기각 대안(차단 정책, 신규 에러 코드, status enum 확장)과 trade-off 내용을 이곳으로 옮기는 것을 권장한다. `## 7. CHANGELOG` 는 Rationale 뒤에 위치시킨다.
+
+---
+
+### 3. catalog `_overview.md` 내부 구조 — `_` prefix 파일이 아닌 디렉토리 내 `_overview.md`
+
+- **[WARNING]** `spec/conventions/cafe24-api-catalog/_overview.md` 파일명이 CLAUDE.md 컨벤션과 부분 불일치
+  - target 위치: D3 섹션 / frontmatter `target_specs`의 `spec/conventions/cafe24-api-catalog/_overview.md`
+  - 위반 규약: CLAUDE.md 명명 컨벤션 표 — `spec/<영역>/_product-overview.md` (언더스코어 prefix = "영역의 제품 정의") / `spec/<영역>/0-overview.md` (`0-` prefix = "영역 안의 기술 아키텍처 개요"). 평문 conventions 파일은 `spec/conventions/*.md`
+  - 상세: `spec/conventions/cafe24-api-catalog/_overview.md` 의 `_overview.md` 라는 파일명은 CLAUDE.md 의 컨벤션 표에 정의된 어느 패턴과도 정확히 일치하지 않는다. `_product-overview.md` 는 "영역의 제품 정의" 전용이며, 아키텍처 개요라면 `0-overview.md` 가 옳다. `_overview.md` 는 기존 실제 파일(`spec/conventions/cafe24-api-catalog/_overview.md`)로 이미 존재하며 본 draft 는 해당 파일을 수정하는 것이므로, 이 이슈는 이번 draft 가 만든 것이 아니라 기존 파일 문제임을 명시한다. draft 자체는 기존 규약에 따라 해당 파일을 참조·수정하고 있다.
+  - 제안: 이번 draft 범위 내에서는 수정 불필요. 단, 향후 conventions 파일 housekeeping 시 `_overview.md` → `0-overview.md` 로 rename 을 고려할 것을 INFO 수준으로 기록한다. 규약 자체를 `_overview.md` 를 허용하는 패턴으로 명문화하는 것도 대안.
+
+---
+
+### 4. `spec/conventions/cafe24-api-catalog/_overview.md` — `_` prefix 파일 기존 존재 확인 (INFO)
+
+- **[INFO]** 이미 존재하는 파일 패턴이며, draft 는 이를 변경하지 않음
+  - target 위치: D3, D3.1 ~ D3.3
+  - 위반 규약: 위 §3 참고
+  - 상세: draft 가 `_overview.md` 를 새로 만드는 것이 아니라 기존 파일을 편집하는 것이므로 이 draft 의 직접 위반은 아님. 기록용.
+  - 제안: 변경 없음.
+
+---
+
+### 5. D2 — `spec/conventions/cafe24-api-metadata.md` §8 CHANGELOG 참조
+
+- **[INFO]** 실제 파일의 CHANGELOG 섹션 번호 확인 필요
+  - target 위치: D2.3 "§8 CHANGELOG 추가"
+  - 위반 규약: 출력 포맷 규약 — 정식 문서 내 섹션 번호 일치 (spec/conventions/cafe24-api-metadata.md 의 실제 섹션 구조와 대조)
+  - 상세: draft 는 `cafe24-api-metadata.md` 의 "§8 CHANGELOG" 에 항목을 추가한다고 명시하나, 해당 파일의 실제 CHANGELOG 섹션 번호가 §8 인지 확인이 필요하다. 현재 열람된 파일 범위(§1~§4 일부)에서는 §8 의 존재를 확인할 수 없었다. 만약 실제 섹션 번호가 다르면 위치 지정 오류.
+  - 제안: `spec/conventions/cafe24-api-metadata.md` 전체를 열람해 CHANGELOG 의 실제 섹션 번호를 확인하고 D2.3 의 §8 표기를 실제 번호로 정정할 것.
+
+---
+
+### 6. plan 문서 frontmatter — `type` 필드
+
+- **[INFO]** frontmatter 에 비표준 `type` 필드 사용
+  - target 위치: plan 문서 frontmatter `type: spec-draft`
+  - 위반 규약: CLAUDE.md §PLAN 문서 라이프사이클 — frontmatter 는 `worktree`, `started`, `owner` 세 필드를 표준으로 정의
+  - 상세: frontmatter 에 `type: spec-draft` 필드가 추가되어 있다. 이 필드는 CLAUDE.md 가 정의한 표준 frontmatter 에 없는 확장 필드다. 금지된 것은 아니며, 추가 메타데이터로 유용할 수 있으나, 표준화되지 않은 필드임을 기록한다.
+  - 제안: 현 상태 유지 가능. 필요하다면 CLAUDE.md 의 frontmatter 정의에 `type` 선택 필드를 추가해 명문화하는 것을 권장.
+
+---
+
+### 7. 금지 경로 — 위반 없음
+
+- **[INFO]** 옛 `prd/`, `memory/`, `user_memo/` 경로 사용 없음
+  - target 위치: 전체 draft
+  - 위반 규약: CLAUDE.md — "옛 `prd/`, `memory/`, `user_memo/` 폴더는 docs-consolidation(2026-05-12)으로 모두 `spec/` 또는 `plan/complete/archive/` 로 흡수. 신규 문서를 옛 경로 컨벤션으로 만들지 않는다."
+  - 상세: draft 내 모든 파일 경로는 `spec/`, `plan/in-progress/` 를 사용하며 금지된 옛 경로는 사용하지 않는다.
+  - 제안: 변경 없음.
+
+---
+
+### 8. API 에러 응답 필드 명명 — `details.requiresCafe24Approval`
+
+- **[INFO]** 에러 응답 보강 필드 명명 스타일 확인
+  - target 위치: D5.4, D4.3의 `details.requiresCafe24Approval: string[]`
+  - 위반 규약: `spec/conventions/node-output.md` (에러 응답 형식) — 해당 컨벤션 파일 내용을 직접 열람하지 않았으나, camelCase 필드 명명은 기존 `details.missingScopes: string[]` 과 일관된 패턴을 따름
+  - 상세: `details.requiresCafe24Approval` 는 camelCase 로 기존 `details.missingScopes` 와 동일 스타일이다. 기존 패턴과 일치하므로 출력 포맷 규약 위반 가능성은 낮다.
+  - 제안: `spec/conventions/node-output.md` 를 열람해 `details.*` 필드 명명 규칙을 명시적으로 확인할 것을 권장하나, 현재 범위 내 이슈로 분류하지 않음.
+
+---
+
+### 9. Rationale 배치 — D5 / D6 는 올바름
+
+- **[INFO]** D5.6 / D6.4 Rationale 신설 항목은 규약 준수
+  - target 위치: D5.6 `## Rationale` 끝 추가 / D6.4 `## 9. Rationale` 끝 추가
+  - 위반 규약: CLAUDE.md §프로젝트 스펙 문서 — spec 문서 끝의 `## Rationale` 섹션 권장
+  - 상세: 기존 spec 파일에 Rationale 섹션이 있음을 전제하고 해당 섹션 끝에 신규 항목을 추가하는 방식은 규약에 부합한다.
+  - 제안: 변경 없음.
+
+---
+
+### 10. `_overview.md` 내 §4 동기 정책 신규 규칙 번호
+
+- **[INFO]** D3.2 에서 추가하는 규칙 번호 8번이 기존 7번 규칙과 연속 — 확인 권장
+  - target 위치: D3.2 `기존 검증 규칙 7번 뒤에 8번 추가`
+  - 위반 규약: spec/conventions/cafe24-api-catalog/_overview.md §4 동기 정책
+  - 상세: 현재 정식 파일에 실제로 7개의 검증 규칙이 있는지 확인됐다 (읽은 범위: 규칙 1~7 명시). 8번 추가는 올바른 연번이다. 이슈 없음.
+  - 제안: 변경 없음.
+
+---
+
+## 요약
+
+본 spec draft 는 전반적으로 정식 규약을 준수하고 있다. 금지된 경로(prd/, memory/, user_memo/) 사용 없음, plan 문서 frontmatter 핵심 3 필드(worktree/started/owner) 모두 포함, 신규 컨벤션 파일은 `spec/conventions/` 평문 패턴 준수, 영향 spec 파일들은 기존 Rationale 섹션에 의사결정 근거를 추가하는 방식으로 규약에 부합한다. 주요 주의 사항은 두 가지다: (1) 신규 컨벤션 파일 `cafe24-restricted-scopes.md` 자체에 `## Rationale` 섹션이 없어 권장 3섹션 구성에서 이탈하고 있으며(WARNING), (2) `spec/conventions/cafe24-api-catalog/_overview.md` 의 `_overview.md` 파일명이 CLAUDE.md 가 정의한 명명 패턴 어디에도 정확히 해당하지 않는 기존 파일 문제가 있다(WARNING, 이번 draft 가 만든 것은 아님). `cafe24-api-metadata.md` 의 실제 CHANGELOG 섹션 번호도 확인 후 D2.3 의 §8 표기를 정정할 필요가 있다(INFO).
+
+## 위험도
+
+LOW

```

---

### 파일 37: review/consistency/2026/05/17/12_12_46/cross_spec.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/17/12_12_46/cross_spec.md b/review/consistency/2026/05/17/12_12_46/cross_spec.md
new file mode 100644
index 00000000..99aa2c64
--- /dev/null
+++ b/review/consistency/2026/05/17/12_12_46/cross_spec.md
@@ -0,0 +1,56 @@
+# Cross-Spec 일관성 검토 결과
+
+검토 대상: `plan/in-progress/spec-draft-cafe24-restricted-scopes.md`
+검토 시각: 2026-05-17
+
+---
+
+### 발견사항
+
+- **[WARNING]** `oauth_invalid_scope` 가 기존 `status_reason` 열거에 없음
+  - target 위치: D1 §4.3, D5.5 (§10.4 에러 매핑)
+  - 충돌 대상: `spec/1-data-model.md` §2.10 Integration.status_reason 정의
+  - 상세: 데이터 모델의 `status_reason` 허용값 목록은 `error` 계열(`insufficient_scope`, `auth_failed`, `network`, `unknown`), `expired` 계열(`token_expired`, `install_timeout`), `pending_install` 계열(`oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`)로 명시되어 있다. draft 의 D1 §4.3 과 D5.5 는 `oauth_invalid_scope` 를 `Integration.status_reason` 으로 기록한다고 기술하나, 이 값은 어느 `status` 버킷에 귀속되는지 명시하지 않으며 기존 데이터 모델 열거에도 없다. 특히 `pending_install` 계열 callback 실패 코드(`oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`)와 어떻게 공존 또는 분리되는지 불명확하다.
+  - 제안: D1 §4.3 의 상태 전이 명세를 보강해 `oauth_invalid_scope` 가 `status='pending_install'`(callback 실패) 인지, `status='error'`(connected 후 scope 거부) 인지 명시. `spec/1-data-model.md` §2.10 `status_reason` 열거에 `oauth_invalid_scope` 를 추가하거나(pending_install 계열 또는 error 계열), draft D5.5 에서 정확히 어느 버킷인지 규정.
+
+- **[WARNING]** `details.requiresCafe24Approval` 필드 — `last_error` JSONB 스키마와의 관계 미정의
+  - target 위치: D1 §4.3, D5.4 (§9.4 공통 응답 포맷)
+  - 충돌 대상: `spec/1-data-model.md` §2.10 Integration.last_error `{ code, message, at }` 정의
+  - 상세: 데이터 모델은 `last_error` 의 형태를 `{ code, message, at }` 로 고정한다. draft D1 §4.3 은 `last_error.details.requiresCafe24Approval: string[]` 를 기록한다고 명시하는데, 기존 스키마에는 `details` 키가 없다. 한편 D5.4 는 `INSUFFICIENT_SCOPE (403)` HTTP 응답의 `details.requiresCafe24Approval` 를 별도로 다루고 있어, DB 컬럼 `last_error` 와 API 응답 `details` 가 혼용되는지 분리되는지 불명확하다.
+  - 제안: `last_error` JSONB 스키마를 `{ code, message, at, details?: object }` 로 확장하는 방향을 `spec/1-data-model.md` §2.10 에 반영하거나, DB 저장 시에는 `last_error.details` 를 생략하고 API 응답에서만 `details.requiresCafe24Approval` 를 추가한다는 계층 분리 정책을 draft 에 명시. 어느 쪽이든 데이터 모델 spec 과 동기 갱신 필요.
+
+- **[WARNING]** `level='program'` 항목이 catalog `restricted` 컬럼 값 집합에서 누락
+  - target 위치: D1 §3, D2.1 (restrictedApproval.level 정의), D3.1 (restricted 컬럼 정의)
+  - 충돌 대상: D3.2 §4 검증 규칙 8, D3.1 §2 컬럼 정의 (동일 draft 내부)
+  - 상세: `restrictedApproval.level` 은 `'scope' | 'operation' | 'program'` 세 값을 정의하지만, catalog `restricted` 컬럼은 `scope` / `op` / 빈칸 만 사용한다. D3.2 검증 규칙 8 은 "`level='program'` 은 본 catalog 와 별개로 다뤄진다" 고 후주를 달았으나, 이 경우 `level='program'` 을 가진 메타데이터 row 가 catalog 에 없을 때 `catalog-sync.spec.ts` 가 어떻게 처리하는지(무시? 경고? 오류?) 명시가 없다. 이는 동일 draft 내부의 검증 규칙과 메타데이터 level enum 사이의 긴장이다.
+  - 제안: D3.2 검증 규칙 8 에 "level='program' 인 메타데이터는 catalog row 대응 검증 대상에서 제외한다" 는 명시적 예외 조항 추가. 또는 Analytics API placeholder 전용으로 `restricted='program'` 컬럼 값을 catalog 에도 허용하는 방향으로 컬럼 정의 확장.
+
+- **[WARNING]** `INSUFFICIENT_SCOPE (403)` — 기존 에러 코드 어휘 확장 범위 모호
+  - target 위치: D5.4 (§9.4 공통 응답 포맷)
+  - 충돌 대상: `spec/2-navigation/4-integration.md` §9.4 (기존 `INSUFFICIENT_SCOPE` 정의), `spec/1-data-model.md` §2.10 status_reason `insufficient_scope`
+  - 상세: draft D5.4 는 `INSUFFICIENT_SCOPE (403)` 응답에 `details.missingScopes` 와 `details.requiresCafe24Approval` 두 필드를 동시에 담는다고 기술한다. 기존 spec 의 `INSUFFICIENT_SCOPE` 정의에 `details.missingScopes` 가 이미 명시되어 있는지, 혹은 이 필드도 신규 추가인지 draft 에서 명확하지 않다. `details.missingScopes` 가 기존 정의에 없다면 두 필드 모두 신규이며, 기존 spec 과의 충돌 범위가 draft 에 기술된 것보다 넓어진다.
+  - 제안: `spec/2-navigation/4-integration.md` §9.4 의 현행 `INSUFFICIENT_SCOPE` 응답 형태를 draft 에 인용해, `details.missingScopes` 가 기존에 있었는지 신규 추가인지 명시. 신규라면 D5.4 의 diff 범위를 `+details.missingScopes` 포함으로 확장.
+
+- **[INFO]** `category` enum 값 `pg_settings` — operation id 집합과 명명 비일관성
+  - target 위치: D2.1 (`restrictedApproval.category` 정의), D1 §2 (operation 단위 표)
+  - 충돌 대상: D4.4 (`store.md` 영향 row) — 동일 draft 내부
+  - 상세: `restrictedApproval.category` 에 `pg_settings` 가 단일 enum 값으로 정의되어 있으나, D1 §2 의 operation 목록은 `Paymentgateway`, `Paymentgateway paymentmethods`, `Financials paymentgateway`, `Naverpay setting`, `Kakaopay setting` 등 여러 하위 영역을 포괄한다. `pg_settings` 라는 단일 범주가 `naverpay_setting`·`kakaopay_setting` 과 별도 category enum 으로 분리되어 있음에도 불구하고, `financials_paymentgateway_get` 을 `pg_settings` 에 묶는지 별도 값으로 두는지 불명확하다. 향후 메타데이터 row 를 작성할 때 category 값 선택 기준이 모호해질 수 있다.
+  - 제안: `category` enum 각 값이 어느 operation id 집합에 대응하는지 D2.1 의 주석이나 별도 매핑 표를 추가. 특히 `pg_settings` 가 `paymentgateway_*`·`paymentgateway_paymentmethods_*`·`financials_paymentgateway_get` 을 모두 포괄하는지 명시.
+
+- **[INFO]** `paymentmethods_paymentproviders_list` 누락 처리 방침 — 공식 문서 재검증 전까지 placeholder 표기 권장
+  - target 위치: D4.4 (store.md 영향 row 목록 마지막 note)
+  - 충돌 대상: 없음 (미래 drift 예방 목적)
+  - 상세: draft 는 `paymentmethods_list` / `paymentmethods_paymentproviders_list` 에 대해 "사용자 자료에 명시되지 않았으므로 빈칸 유지" 라고 기술한다. 이는 합리적이나, 향후 `paymentgateway_paymentmethods_*` restricted 집합과 `paymentmethods_paymentproviders_list` 가 연관될 경우 catalog-sync 검증이 누락을 잡지 못할 수 있다.
+  - 제안: 해당 row 에 `restricted` 컬럼 빈칸을 유지하되, store.md 에 `<!-- TODO: Cafe24 공식 문서에서 paymentmethods_paymentproviders_list restricted 여부 재확인 필요 -->` 형태의 인라인 주석을 추가해 리뷰 시점에 추적 가능하게 관리.
+
+---
+
+### 요약
+
+이 draft 는 Cafe24 별도 승인 scope·operation 식별을 위한 새로운 메타데이터 레이어를 체계적으로 도입하며, 기존 spec 의 핵심 구조(Integration 엔티티, catalog 패턴, 통합 화면 에러 처리)와 큰 틀에서 정합하다. 다만 두 가지 WARNING 이 즉각 해소되어야 한다. 첫째, `oauth_invalid_scope` 를 `Integration.status_reason` 값으로 사용하려면 `spec/1-data-model.md` 의 공식 열거에 등재하고 어느 `status` 버킷에 귀속되는지 명확히 해야 한다 — 기존 `pending_install` 계열과 충돌 여지가 있다. 둘째, `last_error.details.requiresCafe24Approval` 기록 계획은 현행 `last_error { code, message, at }` 스키마를 벗어나므로, 데이터 모델 spec 갱신을 이번 draft 의 수정 파일 목록(`spec/1-data-model.md`)에 명시적으로 추가해야 한다. 나머지 WARNING/INFO 는 draft 내부 정합성 보강 수준으로, 기존 spec 과의 직접 모순은 아니다.
+
+---
+
+### 위험도
+
+MEDIUM

```

---

### 파일 38: review/consistency/2026/05/17/12_12_46/meta.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/17/12_12_46/meta.json b/review/consistency/2026/05/17/12_12_46/meta.json
new file mode 100644
index 00000000..9ee45611
--- /dev/null
+++ b/review/consistency/2026/05/17/12_12_46/meta.json
@@ -0,0 +1,12 @@
+{
+  "timestamp": "2026-05-17T12:12:46.600306",
+  "mode": "spec draft 검토 (--spec)",
+  "target_path": "plan/in-progress/spec-draft-cafe24-restricted-scopes.md",
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

### 파일 39: review/consistency/2026/05/17/12_12_46/naming_collision.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/17/12_12_46/naming_collision.md b/review/consistency/2026/05/17/12_12_46/naming_collision.md
new file mode 100644
index 00000000..b2cbfc87
--- /dev/null
+++ b/review/consistency/2026/05/17/12_12_46/naming_collision.md
@@ -0,0 +1,63 @@
+# 신규 식별자 충돌 검토 — Cafe24 별도 승인 scope/operation 메타데이터
+
+> target: `plan/in-progress/spec-draft-cafe24-restricted-scopes.md`
+> 검토 일시: 2026-05-17
+> 점검 대상 식별자: `restrictedApproval`, `restricted`, `requiresCafe24Approval`, `oauth_invalid_scope`, `level` enum(`scope`/`operation`/`program`), `category` enum 8종, 신규 파일 경로
+
+---
+
+### 발견사항
+
+- **[WARNING]** `oauth_invalid_scope` — `Integration.status_reason` 신규 값, 기존 값 명세와 상태 매핑 불일치 가능성
+  - target 신규 식별자: `oauth_invalid_scope` (`Integration.status_reason` 의 새 값)
+  - 기존 사용처: `spec/1-data-model.md §2.10` `status_reason` 컬럼 정의. 기존 명세에서 `status_reason` 값은 상태(`status`)별로 엄격하게 나뉜다 — `error` 상태의 사유 코드(`insufficient_scope` / `auth_failed` / `network` / `unknown`), `expired` 상태의 사유 코드(`token_expired` / `install_timeout`), `pending_install` 상태의 사유 코드(`oauth_token_exchange_failed` / `oauth_state_mismatch` / `oauth_state_expired`), `connected` 상태 → NULL. 해당 필드 정의 어느 상태 버킷에도 `oauth_invalid_scope` 가 명시되어 있지 않다.
+  - 상세: target D5.5 §10.4 에는 `oauth_invalid_scope` 가 `Integration.status_reason` 값으로 추가되며, D1 §4.3 에도 `Integration.status_reason='oauth_invalid_scope'` 로 기재된다. 그런데 데이터 모델(`spec/1-data-model.md`)의 `status_reason` 필드 정의는 이 값을 어떤 `status` 값에 대응시킬지 명시하지 않는다. target D5.5 본문은 "status 는 보존 (재인증으로 회복 가능)"이라 서술하지만, `error` / `expired` / `pending_install` 어느 버킷에 속하는지 불명확하다. `pending_install` 상태의 기존 콜백 실패 코드(`oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`)와 명명 패턴은 유사하나, `oauth_invalid_scope` 는 OAuth 흐름 중 scope 거부로 발생하므로 의미 계층이 다르다. `data-model.md` 갱신 없이 spec/conventions 에만 도입되면 두 spec 간 불일치가 생긴다.
+  - 제안: `spec/1-data-model.md §2.10` `status_reason` 컬럼 정의에 `pending_install` 또는 `error` 상태 버킷 안에 `oauth_invalid_scope` 를 명시적으로 추가해 status 매핑을 완성한다. target 에서 이미 "status 는 보존"이라 기술하고 있으므로, 재인증으로 회복 가능한 `pending_install` 계열 값으로 분류하거나, 별도 상태 버킷(`error` 안의 새 사유)으로 명시한다.
+
+- **[WARNING]** `details.missingScopes` — `INSUFFICIENT_SCOPE` 에러 응답 신규 필드, 기존 spec 의 `details` 구조와 정합 확인 필요
+  - target 신규 식별자: `details.missingScopes: string[]` (D5.4, `INSUFFICIENT_SCOPE (403)` 응답의 보강 필드)
+  - 기존 사용처: `spec/2-navigation/4-integration.md §9.4` 에는 `INSUFFICIENT_SCOPE (403)` 기존 설명이 있으며, `spec/1-data-model.md §2.14 NodeExecution.error` 는 `{ code, message, stack? }` 구조로 정의되어 있다. 기존 `Integration.last_error` 는 `{ code, message, at }` 구조다.
+  - 상세: target D5.4 에서 `details.missingScopes` 와 `details.requiresCafe24Approval` 을 `INSUFFICIENT_SCOPE` 응답에 추가하는데, 기존 에러 응답의 `details` 구조가 spec 어디에도 정식으로 정의되어 있지 않다. `NodeExecution.error` 는 `{ code, message, stack? }`, `Integration.last_error` 는 `{ code, message, at }` 이며 둘 다 `details` 하위 구조가 없다. `details` 라는 중간 레이어가 어떤 에러 코드에서 발생하는지, 그 스키마가 어디에 정의되는지 기존 spec 에서 찾기 어렵다. 반면 `requiresCafe24Approval` 는 D1 §4.3 에서 `last_error.details.requiresCafe24Approval` 로도 쓰이는데, 이는 `Integration.last_error` 의 `{ code, message, at }` 구조와 맞지 않는다.
+  - 제안: `details` 하위 구조를 `spec/5-system/2-api-convention.md` 또는 `spec/2-navigation/4-integration.md §9` 에 공식 정의하거나, `Integration.last_error` 스키마를 `{ code, message, at, details?: Record<string, unknown> }` 로 확장한다는 명시를 `spec/1-data-model.md §2.10` 에 추가한다. `missingScopes` 는 이번에 spec 에 처음 등장하므로, `requiresCafe24Approval` 와 함께 에러 응답 `details` 의 카탈로그에 등재해야 한다.
+
+- **[WARNING]** `category` enum 값 `pg_settings` — catalog/Rationale 의 실제 operation 그룹명과 불일치
+  - target 신규 식별자: `restrictedApproval.category` enum 값 `'pg_settings'` (D2.1 인터페이스 정의)
+  - 기존 사용처: target D1 §2 표 및 D6 §8.3 에서 실제로 열거되는 제한 operation 은 `Paymentgateway`, `Paymentgateway paymentmethods`, `Financials paymentgateway` 세 그룹으로 나뉜다. D6.2 §8.3 에서는 `paymentgateway_*`, `financials_paymentgateway_get` 을 모두 같은 범주로 묶지만, D2.1 의 `category` 열거에는 `pg_settings` 만 있어 `financials_paymentgateway_get` 의 귀속 범주가 명확하지 않다. catalog `store.md` 의 D4.4 에서도 `Financials paymentgateway` 는 별도 영역으로 열거된다.
+  - 상세: `pg_settings` 가 `paymentgateway_*` 와 `financials_paymentgateway_get` 을 모두 포괄하는 값인지, 아니면 `paymentgateway_*` 만 가리키고 `financials_paymentgateway_get` 은 다른 `category` 값(예: `financials_pg`)이 필요한지 명확하지 않다. 이 모호함은 backend 메타데이터 구현 시 `category` 값 부여에 혼란을 줄 수 있다.
+  - 제안: `pg_settings` 의 적용 범위를 주석에 명시하거나(`paymentgateway_* + financials_paymentgateway_get 포함`), `financials_paymentgateway_get` 을 별도 `category` 값(예: `financials_pg`)으로 분리한다. 또는 D1 §2 의 "Financials paymentgateway" 영역을 `pg_settings` category 에 포함되는 것으로 명문화한다.
+
+- **[INFO]** `restricted` — catalog 표 컬럼명, 기존 `status` enum 관련 용어와 혼동 가능성
+  - target 신규 식별자: `restricted` (catalog 표 컬럼명, 값: `scope` / `op` / 빈칸)
+  - 기존 사용처: `spec/conventions/cafe24-api-catalog/_overview.md §3` `status` enum 의 내부 검토 기록에 "catalog 의 `status` enum 에 `restricted` 값 추가" 대안이 기각된 것으로 Rationale(D5.6)에 언급된다. 기각 대안으로 명기되어 `restricted` 가 `status` 값으로 오해될 소지가 있다.
+  - 상세: target 자체적으로 "별도 컬럼이 정답"이라 설명하여 구분은 되어 있지만, catalog 파일을 처음 보는 개발자 또는 자동 파서가 `restricted` 컬럼을 `status` 의 추가 값으로 혼동하거나 `status: restricted` 로 잘못 기입할 여지가 있다. 특히 D3.3 `§4` 의 검증 규칙 7번("status 가 enum 중 하나: `supported` / `planned` / `deprecated` 외의 값이 있으면 fail")의 `catalog-sync.spec.ts` 파서가 `restricted` 를 `status` 컬럼으로 오독하지 않는지 확인이 필요하다.
+  - 제안: `_overview.md §3` status enum 정의 바로 위 또는 `§2` 컬럼 정의 내 `restricted` 항목 설명에 "이 컬럼은 `status` 와 직교(orthogonal)하며, `status` 의 값이 아니다"를 한 줄 명시한다. `catalog-sync.spec.ts` 파서가 `restricted` 컬럼을 `status` 컬럼과 분리하는 로직이 D3.2 검증 규칙 8에 추가되는 것은 적절하다.
+
+- **[INFO]** `restrictedApproval` — `Cafe24OperationMetadata` 인터페이스 신규 필드, 기존 필드명 공간과 충돌 없음 (확인)
+  - target 신규 식별자: `restrictedApproval` (D2.1, `Cafe24OperationMetadata` 인터페이스 optional 필드)
+  - 기존 사용처: `spec/conventions/cafe24-api-metadata.md §2` 기존 필드는 `responseShape`, `paginated` 등이며, `restrictedApproval` 또는 이와 유사한 이름은 코퍼스 전체에서 발견되지 않는다.
+  - 상세: 충돌 없음. optional 필드로 추가되어 기존 구현과 하위 호환된다. 단, `catalog-sync.spec.ts` 에서 `restrictedApproval` 존재 여부를 `restricted` 컬럼과 양방향 검증하는 규칙(검증 규칙 8)이 추가되므로, 기존에 이미 구현된 `paymentgateway_create`, `paymentgateway_update`, `paymentgateway_delete`, `paymentgateway_paymentmethods_list`(D4.4 에 `supported` 상태로 언급) 가 `restrictedApproval` 없이 `restricted: op` 로 표기되면 테스트가 즉시 실패하는 점을 구현 단계에서 유의해야 한다.
+  - 제안: 구현 착수 시 `supported` 이면서 `restricted: op` 로 표기되는 기존 store operation 에 대해 backend 메타데이터의 `restrictedApproval` 필드를 동시에 채워야 한다는 점을 D7 영향 요약 또는 D4.4 본문에 명시적으로 강조한다.
+
+- **[INFO]** `requiresCafe24Approval` — `last_error.details` 와 API 에러 응답 두 곳에서 사용, 컨텍스트별 스키마 구조 상이
+  - target 신규 식별자: `requiresCafe24Approval` (D1 §4.3, D5.4, D5.5 에서 사용)
+  - 기존 사용처: 기존 spec 어디에도 동일 식별자 없음.
+  - 상세: 충돌은 없으나 `requiresCafe24Approval` 가 두 컨텍스트에서 동일 이름으로 쓰인다. (1) `Integration.last_error.details.requiresCafe24Approval: string[]` — OAuth callback 에러 기록용 (DB 저장), (2) `INSUFFICIENT_SCOPE` API 응답의 `details.requiresCafe24Approval: string[]` — 노드 실행 중 실시간 응답. 두 컨텍스트에서 같은 이름을 쓰는 것은 일관성 측면에서 좋으나, `Integration.last_error` 의 기존 스키마(`{ code, message, at }`)에 `details` 중첩 구조가 추가된다는 점이 명시되어야 한다(WARNING 2번 항목과 동일 맥락). 이름 자체의 충돌은 없다.
+  - 제안: `spec/1-data-model.md §2.10` `last_error` 컬럼 정의에 `details` 하위 확장 스키마를 명시한다.
+
+- **[INFO]** 신규 파일 `spec/conventions/cafe24-restricted-scopes.md` — 경로 및 명명 컨벤션 준수 여부 확인
+  - target 신규 식별자: `spec/conventions/cafe24-restricted-scopes.md` (신규 파일 경로)
+  - 기존 사용처: `spec/conventions/` 하위 기존 파일: `cafe24-api-metadata.md`, `cafe24-api-catalog/` (디렉토리), `node-output.md`, `conversation-thread.md` 등. 언더스코어 prefix 없는 평문 파일명이 기존 컨벤션에 부합한다 (`CLAUDE.md §명명 컨벤션` — `spec/conventions/*.md` 는 평문 명명).
+  - 상세: 충돌 없음. 기존 `cafe24-api-metadata.md` 와 같은 `cafe24-` prefix 패밀리에 속하므로 일관성도 있다. 파일명 자체는 기존 파일과 겹치지 않는다.
+  - 제안: 해당 없음.
+
+---
+
+### 요약
+
+신규 식별자 충돌 관점에서 가장 주의가 필요한 사항은 두 가지다. 첫째, `oauth_invalid_scope` 는 `Integration.status_reason` 의 새 값으로 추가되지만, `spec/1-data-model.md §2.10` 의 status_reason 버킷 정의에 포함되어 있지 않아 데이터 모델 spec 과의 불일치가 발생한다. 해당 값을 어느 `status` 상태에 귀속시킬지 명확히 해야 한다. 둘째, `details.missingScopes` / `details.requiresCafe24Approval` 은 기존 `NodeExecution.error` 및 `Integration.last_error` 스키마에 `details` 하위 구조가 없었으므로, 이 확장을 데이터 모델 spec 에 공식화해야 한다. `pg_settings` category 값의 적용 범위 모호성은 구현 단계에서 메타데이터 오기입으로 이어질 수 있는 WARNING 수준의 명확화 필요 사항이다. 그 외 `restrictedApproval`, `restricted`, `requiresCafe24Approval`, 신규 파일 경로는 기존 식별자와 충돌하지 않으며 코퍼스 내 동일 식별자가 다른 의미로 쓰이는 사례가 없다.
+
+---
+
+### 위험도
+
+MEDIUM

```

---

### 파일 40: review/consistency/2026/05/17/12_12_46/plan_coherence.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/17/12_12_46/plan_coherence.md b/review/consistency/2026/05/17/12_12_46/plan_coherence.md
new file mode 100644
index 00000000..f6dbfa45
--- /dev/null
+++ b/review/consistency/2026/05/17/12_12_46/plan_coherence.md
@@ -0,0 +1,49 @@
+### 발견사항
+
+- **[WARNING]** `spec/2-navigation/4-integration.md` 동시 수정 가능성 — `spec-update-cafe24-test-connection.md` 의 직렬화 조건 충족 여부 불명확
+  - target 위치: D5 전체 (`spec/2-navigation/4-integration.md` §3.2 / §4.4 / §5 / §9.4 / §10.4 / Rationale)
+  - 관련 plan: `plan/in-progress/spec-update-cafe24-test-connection.md` — 해당 문서 "머지 의존성 — 착수 전 직렬화 필수" 섹션에서 `spec/2-navigation/4-integration.md` 를 동시 수정하는 세 worktree(`cafe24-spec-sync-e2a8b9`, `cafe24-app-url-reuse-f9a2e3`, `prod-rereview-fix-a7c93f`)가 머지되기 전에는 착수하면 안 된다고 명시하고 있다.
+  - 상세: `spec-update-cafe24-test-connection.md` 가 직렬화 선행 조건으로 열거한 세 worktree의 머지 완료 여부를 prompt_file 에서 확인할 수 없다. 이 plan 의 직렬화 조건이 현재 해소되었는지 확인되지 않은 상태에서 target plan(`cafe24-restricted-scopes-a1b2c3`) 도 `spec/2-navigation/4-integration.md` 의 다수 섹션(§3.2·§4.4·§5·§9.4·§10.4·Rationale) 을 수정한다.
+  - 제안: target plan 착수 전 `spec-update-cafe24-test-connection.md` 에 명시된 직렬화 조건(3 worktree 머지 여부)이 해소되었는지 확인할 것. 아직 머지되지 않은 worktree가 있다면 해당 PR 머지 후 착수.
+
+- **[WARNING]** `spec/4-nodes/4-integration/4-cafe24.md` 수정과 `20260516-full-review/RESOLUTION.md` 의 W-69 처리 후속 가능 드리프트
+  - target 위치: D6 전체 (`spec/4-nodes/4-integration/4-cafe24.md` §2 / §8.3 / §10 CHANGELOG / Rationale 9.11)
+  - 관련 plan: `plan/in-progress/20260516-full-review/RESOLUTION.md` — W-69 항목: "`spec/4-nodes/4-integration/4-cafe24.md:23,90`의 `pagination` 필드의 `cursor?: string` 제거 + 사유 문구 추가. §3, §4.2 의 cursor 언급 동시 삭제" 가 full-review-fixes-a1b2c3 worktree 에서 처리됨.
+  - 상세: W-69 는 이미 처리 완료로 표시되어 있으나(`full-review-fixes-a1b2c3` branch), 해당 PR 이 main 에 머지되었는지 확인되지 않는다. target plan 이 같은 파일의 §2 와 §8.3 을 수정할 때 W-69 가 포함된 변경이 병합되어 있어야 충돌이 없다. 또한 target plan 이 §2 에 `별도 승인 라벨` 스펙을 추가할 때 cursor 제거 커밋과 충돌이 발생할 수 있다.
+  - 제안: `full-review-fixes-a1b2c3` branch(PR)의 main 머지 여부를 확인하고, 미머지라면 해당 PR 이후에 target 을 작성하거나, 동일 파일을 수정할 때 cursor 관련 변경 내용도 반영되어야 함을 plan 에 명시할 것.
+
+- **[WARNING]** `cafe24-backlog-residual.md` — F-2 항목(`spec/2-navigation/4-integration.md §6` mermaid 갱신) 과 target D5 의 §9.4·§10.4 변경이 동일 파일을 건드릴 가능성
+  - target 위치: D5.4·D5.5 (`spec/2-navigation/4-integration.md §9.4·§10.4`)
+  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` — F-2: "`spec/2-navigation/4-integration.md §6` mermaid 에 `install_token` 보존 정책 명시" (미완료 `[ ]`)
+  - 상세: target plan 은 §9.4·§10.4 를 수정하고, backlog plan 의 F-2 는 §6 을 수정한다. 서로 다른 섹션이므로 직접 충돌은 낮지만, 두 plan 이 같은 파일을 동시에 수정 중임을 양쪽 plan 에 명시해야 한다. `cafe24-backlog-residual.md` 의 worktree 필드가 `TBD` 로 되어 있어 작업이 아직 시작되지 않았을 가능성이 높다.
+  - 제안: `cafe24-backlog-residual.md` 의 F-2 착수 시 target plan 과 같은 파일이라는 사실을 worktree 배정 전 확인할 것. target plan 이 먼저 머지된 후 F-2 를 처리하거나, 같은 PR 에 묶는 방안 검토.
+
+- **[WARNING]** `spec-update-impl-prep-findings.md` — C1 항목(`spec/1-data-model.md §2.13` `re_run_of`/`chain_id` 컬럼 추가) 이 미완료 상태로 target plan 의 선행 조건과 무관하나 동시 spec 수정 세션의 혼잡도를 높임
+  - target 위치: 해당 없음 (직접 영향 없음)
+  - 관련 plan: `plan/in-progress/spec-update-impl-prep-findings.md` — C1·C2 체크박스 미완료. C2 (`spec/5-system/10-graph-rag.md §2.2` `graph_extraction_status` `failed` 추가) 는 `full-review-fixes-a1b2c3` RESOLUTION.md W-15 에서 이미 처리됨으로 표시되어 있어 이중 추적 가능성 있음.
+  - 상세: `spec-update-impl-prep-findings.md` C2 항목은 full-review RESOLUTION.md W-15 에서 이미 완료 처리되었으나 spec-update-impl-prep-findings.md 의 체크박스는 여전히 `[ ]`. 이는 target plan 과 직접 충돌하지 않지만, plan 상태 정합성이 흐트러져 있다.
+  - 제안: `spec-update-impl-prep-findings.md` 의 C2 체크박스를 완료로 갱신하고, C1 이 target plan 과 직접 겹치지 않음을 확인한 뒤 처리 순서를 정할 것.
+
+- **[INFO]** target plan 의 `catalog-sync.spec.ts` 양방향 동기 검증 테스트는 plan/in-progress 어느 파일에서도 ownership 이 명시되지 않음
+  - target 위치: D1 §5 "명단 갱신 절차" step 5 / D2.1 / D3.2 검증 규칙 8
+  - 관련 plan: 해당 없음
+  - 상세: `catalog-sync.spec.ts` 신설·갱신은 backend 코드 변경이므로 developer 역할이 별도 worktree에서 구현해야 한다. 현재 target plan 이 spec draft 임에도 테스트 파일 위치까지 명시하고 있으나, 이를 위한 developer plan 이나 이슈가 아직 없다. spec 승인 후 후속 developer plan 생성이 필요하다.
+  - 제안: `/consistency-check --spec` 통과 후 spec 를 실제 파일에 반영하는 planner 작업과, `catalog-sync.spec.ts` 구현을 위한 developer plan 을 각각 신설할 것.
+
+- **[INFO]** `spec-update-cafe24-test-connection.md` 의 §9.1 — `pending_install` 상태 보호 조항이 target D5 와 동일 파일(`spec/2-navigation/4-integration.md`) 내 다른 섹션에 추가될 예정이나 좌표가 겹치지 않음
+  - target 위치: D5 전체
+  - 관련 plan: `plan/in-progress/spec-update-cafe24-test-connection.md` §9.1 — §9.1 또는 §14.1 에 `pending_install` 보호 추가 (권장). 아직 미착수 상태 (직렬화 조건 미해소).
+  - 상세: target plan D5 는 §3.2·§4.4·§5·§9.4·§10.4·Rationale 를 수정하고, `spec-update-cafe24-test-connection.md` 는 §5.8·§9.1(또는 §14.1) 을 수정한다. §9.4 와 §9.1 이 다른 섹션이므로 직접 충돌보다는 HEAD diff merge 정도의 문제. 하지만 두 plan 이 모두 같은 파일을 수정하므로 순서 조율이 권장된다.
+  - 제안: target plan 이 먼저 머지되거나, 두 plan 을 같은 worktree에서 처리하는 방안을 고려. 순서 결정 후 plan 에 명시.
+
+---
+
+### 요약
+
+target plan(`spec-draft-cafe24-restricted-scopes.md`, worktree `cafe24-restricted-scopes-a1b2c3`) 의 핵심 변경 파일인 `spec/2-navigation/4-integration.md` 와 `spec/4-nodes/4-integration/4-cafe24.md` 는 이미 다른 plan·worktree 들과 충돌 위험이 있다. 가장 중요한 이슈는 `spec-update-cafe24-test-connection.md` 에 명시된 직렬화 선행 조건(세 worktree 머지 여부)이 현재 해소되었는지 알 수 없다는 점이다 — 그 조건이 아직 미해소라면 target plan 의 D5 변경은 동일 파일에 대한 병렬 worktree 경합을 유발한다. `full-review-fixes-a1b2c3` 의 `spec/4-nodes/4-integration/4-cafe24.md` W-69 변경이 main 에 머지된 이후에 target 을 작성해야 변경 내용이 누락되지 않는다. 나머지 이슈(backlog F-2, spec-update-impl-prep-findings C2 이중 추적, catalog-sync.spec.ts developer plan 부재)는 WARNING/INFO 수준으로 직접 차단 사유는 아니나 plan 갱신을 통한 명시가 권장된다. 신규 식별자(`restrictedApproval`, `restricted`, `requiresCafe24Approval`, `oauth_invalid_scope`)와 기존 plan 간 직접 충돌은 발견되지 않았고, 미해결 결정을 일방적으로 우회하는 결정도 없다.
+
+---
+
+### 위험도
+
+MEDIUM

```

---

### 파일 41: review/consistency/2026/05/17/12_12_46/rationale_continuity.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/17/12_12_46/rationale_continuity.md b/review/consistency/2026/05/17/12_12_46/rationale_continuity.md
new file mode 100644
index 00000000..c3f4c455
--- /dev/null
+++ b/review/consistency/2026/05/17/12_12_46/rationale_continuity.md
@@ -0,0 +1,48 @@
+# Rationale 연속성 검토 결과
+
+검토 대상: `plan/in-progress/spec-draft-cafe24-restricted-scopes.md`
+검토 기준: `spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/4-cafe24.md` 및 관련 Rationale 발췌
+
+---
+
+### 발견사항
+
+- **[INFO]** `oauth_invalid_scope` status_reason 신규 값 — 기존 snake_case 컨벤션 정합 확인
+  - target 위치: D1 §4.3 / D5.5 §10.4 에러 매핑
+  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "Cafe24 Private 의 callback 실패는 왜 status 를 보존하나" 및 "status_reason `oauth_token_exchange_failed` 와 auth 도메인의 `token_exchange_failed` 구분"
+  - 상세: 기존 Rationale 는 `status_reason` 저장값을 `snake_case` 로 표기한다고 명문화하고 있고(`auth_failed`, `token_expired`, `install_timeout`, `oauth_token_exchange_failed` 등), `oauth_` prefix 를 domain 구분용으로 의도적으로 도입했다. target 이 신규로 추가하는 `oauth_invalid_scope` 는 이 컨벤션을 그대로 따른다. 형식 정합에는 문제가 없다.
+  - 제안: 현행 그대로 진행 가능. 다만 §10.4 에러 매핑 표에서 기존 `oauth_token_exchange_failed` 와 `oauth_invalid_scope` 가 나란히 보이도록 진입 경로 구분을 한 줄 더 명시하면 미래 검토자의 혼동을 줄일 수 있다.
+
+- **[INFO]** `details.requiresCafe24Approval` 보강 필드 — 신규 에러 코드 없음 원칙 명시 필요
+  - target 위치: D1 §4.4 "신규 코드 추가 없음" / D5.4 §9.4 보강 / D6 draft Rationale D5.6·D6.4
+  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale 내 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 코드명 유지 결정 (의미보다 하위 호환성 우선) 및 `INSUFFICIENT_SCOPE (403)` 처리 경로
+  - 상세: target D1 §4.4 가 "신규 HTTP 상태/에러 코드 vocabulary 추가는 하지 않는다" 라고 명시하고, D5.6 기각 대안 (B) 로 `CAFE24_APPROVAL_REQUIRED` 신규 에러 코드를 명시적으로 거부한다. 이는 기존 Rationale 의 하위 호환 우선·코드명 변경 최소화 기조와 완전히 일치한다. 추가로 target D5.4 의 `details.missingScopes` 와 `details.requiresCafe24Approval` 두 필드가 `INSUFFICIENT_SCOPE` 에 함께 실리는데, `details.missingScopes` 가 기존 spec 어디에 정의돼 있는지 본 draft 는 명시하지 않는다. 기존 spec 에 이미 있는 필드라면 표기 일관성 확인이 필요하다.
+  - 제안: D5.4 에서 `details.missingScopes` 가 기존부터 있던 필드임을 한 줄 명시(혹은 원래 spec 섹션 링크)하면 draft 가 "보강만" 임을 더 명확히 보증한다.
+
+- **[INFO]** catalog `status` enum 과 `restricted` 컬럼의 직교성 — Rationale 에 기각 사유 명시됨
+  - target 위치: D3.1 §2 표 컬럼 정의, D7 기각된 대안
+  - 과거 결정 출처: D7 "기각된 대안" + D5.6 기각 대안 (C) "catalog 의 `status` enum 에 `restricted` 값 추가"
+  - 상세: target 자체가 "supported / planned / deprecated 와 직교 차원이라 enum 확장은 의미 오염" 임을 명시적 기각 사유로 적시한다. 기존 Rationale 에는 `status` enum 확장 거부 판례가 직접 박혀있지 않으나, 기존 컨벤션이 `status` 를 lifecycle 상태로만 쓰는 선례를 따르고 있다. 별도 컬럼 신설은 그 원칙의 자연스러운 연장이다.
+  - 제안: target 에 이미 기각 사유가 적시되어 있어 Rationale 정합 보강은 불필요하다. 정상.
+
+- **[INFO]** endpoint 명단 인라인 열거 회피 원칙 — D6.4 Rationale 9.11 에서 재확인됨
+  - target 위치: D6.4 Rationale 9.11
+  - 과거 결정 출처: `spec/conventions/cafe24-api-metadata.md` §3 "endpoint enumeration 을 spec 본문에 인라인하지 않는다" 정책
+  - 상세: D6.4 는 "명단을 직접 enumerate 하지 않는 이유는 drift 방지 (cafe24-api-metadata.md §3 의 정책과 동일)" 라고 명시해 기존 합의 원칙을 능동적으로 인용한다. 충돌 없음.
+  - 제안: 불필요. 이 항목은 검토 통과.
+
+- **[INFO]** `level='program'` — Analytics API placeholder 처리 방식 검토
+  - target 위치: D1 §3, D2.1 `restrictedApproval.level: 'scope' | 'operation' | 'program'`
+  - 과거 결정 출처: 관련 Rationale 에 Analytics API 관련 기존 기각/채택 결정 없음
+  - 상세: `level='program'` 은 "현재 직접 호출 경로를 구현하지 않으며 placeholder" 라고 명시한다. D3.2 의 검증 규칙 8 에서도 "`level='program'` 은 본 catalog 와 별개로 다뤄진다" 라고 범위를 한정한다. 기존 Rationale 어디에도 이 analytics 트랙에 대한 명시적 폐기 결정이 없어 재도입 여부를 판단하기 어렵다. 다만 "향후 도입을 위한 placeholder" 이므로 아직 결정 전 상태이며, 채택도 기각도 아닌 보류로 보는 것이 타당하다. 위험은 낮다.
+  - 제안: §3 하단에 "본 Analytics placeholder 는 Cafe24 측 계약 후 별도 spec 으로 상세화한다" 한 줄을 추가해 미완 상태임을 명확히 하면 향후 consistency-check 에서 불필요한 CRITICAL 을 방지한다.
+
+---
+
+### 요약
+
+target draft 는 기존 spec Rationale 에서 명시적으로 기각된 결정을 재도입하지 않는다. 핵심 기각 대안 세 가지(차단 정책, 신규 에러 코드 `CAFE24_APPROVAL_REQUIRED`, `status` enum 확장)가 draft 자체의 Rationale 에 재확인·기록되어 있으며, 하위 호환 우선 원칙과 endpoint 명단 비인라인 원칙도 모두 존중된다. `oauth_invalid_scope` 신규 status_reason 값은 기존 `snake_case` + `oauth_` prefix 컨벤션에 정합하고, `details.requiresCafe24Approval` 보강 필드는 신규 에러 코드 없음 방침과 일치한다. 미비 사항은 `details.missingScopes` 출처 명시 누락, Analytics placeholder 의 미완 상태 표기 부재 등 소규모 INFO 수준이며, 설계 원칙이나 합의된 invariant 를 위반하는 항목은 발견되지 않았다.
+
+### 위험도
+
+LOW

```

---

### 파일 42: review/consistency/2026/05/17/12_37_41/SUMMARY.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/17/12_37_41/SUMMARY.md b/review/consistency/2026/05/17/12_37_41/SUMMARY.md
new file mode 100644
index 00000000..e8333103
--- /dev/null
+++ b/review/consistency/2026/05/17/12_37_41/SUMMARY.md
@@ -0,0 +1,50 @@
+# Consistency Check 통합 보고서 (impl-prep)
+
+**BLOCK: YES** (초기) → **BLOCK: NO** (정정 후) — CRITICAL 2건은 spec drift 정정 + impl phase parser 수정으로 해소
+
+세션: `review/consistency/2026/05/17/12_37_41/`
+모드: `--impl-prep spec/conventions/`
+
+---
+
+## Critical 위배
+
+| # | Checker | 위배 | 해소 |
+|---|---------|------|------|
+| C-1 | Convention Compliance | `_overview.md §2` 컬럼 정의 순서(paginated→restricted)와 실제 4 catalog 파일 헤더 순서(scope→restricted→paginated) 역전 | spec drift 정정 commit 에서 _overview §2 표 순서를 실제 파일 기준으로 통일 |
+| C-2 | Naming Collision | `catalog-sync.spec.ts parseCatalogFile()` 9-cell 하드코딩 — 10-column 표 파싱 깨짐 | impl phase 1단계 — `CatalogRow.restricted` 필드 + 헤더 기반 동적 인덱싱 + 규칙 8 검증 실제 구현 |
+
+## 경고 (WARNING) — spec drift fix commit 에서 함께 흡수
+
+| # | 항목 | 처리 |
+|---|------|------|
+| W-1 | `requiresCafe24Approval` 교집합 범위 §1 vs 명단 전체 표현 불일치 | §9.4 본문에 §1·§2 구분 명시 |
+| W-2 | 동일 | W-1 과 함께 |
+| W-3 | §6 상태 전이 다이어그램 `pending_install → pending_install` 에 `oauth_invalid_scope` 누락 | 다이어그램 행에 추가 |
+| W-4 | Coverage Matrix 날짜 미갱신 | 2026-05-16 → 2026-05-17 |
+| W-5 | `cafe24-restricted-scopes.md` 도입부 비섹션화 | `## Overview` 로 감싸기 |
+| W-6 | 4 catalog 파일에 `## Rationale` 섹션 없음 | 각 파일 하단에 `_overview.md` cross-reference 한 줄 |
+| W-7 | `store.md` `privacy_*` planned operation id 혼동 소지 | **별도 follow-up plan 분리** — 본 작업 의도와 거리 있음 (planned 라 비차단) |
+| W-8 | `restrictedApproval.category` ↔ `Cafe24Resource.category` 명명 충돌 | `category` → `approvalGroup` 재명명 (backend 미반영, 비용 낮음) |
+| W-9 | catalog `op` ↔ metadata `level='operation'` 표기 비일관성 | catalog 값도 `operation` 으로 통일 + parser 가 새 값 인식 (C-2 와 한 묶음) |
+
+## 참고 (INFO)
+
+| # | 항목 | 처리 |
+|---|------|------|
+| I-1 | 작업 추적 plan 부재 (cafe24-restricted-scopes-a1b2c3.md) | 이미 `plan/in-progress/cafe24-restricted-scopes.md` 가 frontmatter `worktree: cafe24-restricted-scopes-a1b2c3` 포함 — 충족 |
+| I-2 | cafe24-backlog-residual cross-reference | 이미 W-8 (--spec 세션) 으로 양쪽 plan 에 추가됨 |
+| I-3 | full-review-fixes-a1b2c3 머지 여부 | 머지 완료 확인 (앞 단계에서) |
+| I-4 | 규칙 8 의 `category` 필드 검증 여부 모호 | impl phase parser 구현 시 명확화 |
+| I-5 | `level='program'` 제외 정책 중복 | INFO — canonical 위치 추후 정리 |
+| I-6 | store.md `paymentmethods_list` 빈칸 | 이미 store.md 안내문 + cafe24-restricted-scopes.md §2 trade-off 에 양쪽 명시 |
+| I-7 | `_overview.md` 파일명 컨벤션 불일치 | 본 PR 범위 외 (기존 파일) |
+| I-8 | `_overview.md` Rationale 없음 | CHANGELOG 가 결정 기록 담당 — 본 PR 범위 외 |
+| I-9 | `oauth_invalid_scope` 와 `insufficient_scope` 의미 구분 | backend 구현 시 주석 추가 |
+| I-10 | `requiresCafe24Approval` details 키 충돌 없음 | — |
+
+## 처리 결과
+
+- spec drift fix commit 으로 BLOCK 해소 (C-1, W-1~W-6, W-8, W-9 흡수, W-7 분리)
+- impl phase 1단계로 C-2 (`parseCatalogFile` 갱신 + 규칙 8 검증 구현) 해소
+- W-7 은 `plan/in-progress/cafe24-store-privacy-prefix-rename.md` follow-up 으로 분리

```

---

### 파일 43: review/consistency/2026/05/17/12_37_41/_prompts/convention_compliance.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/17/12_37_41/_prompts/convention_compliance.md b/review/consistency/2026/05/17/12_37_41/_prompts/convention_compliance.md
new file mode 100644
index 00000000..58f15017
--- /dev/null
+++ b/review/consistency/2026/05/17/12_37_41/_prompts/convention_compliance.md
@@ -0,0 +1,669 @@
+# 정식 규약 준수 Check Payload
+
+본 파일은 orchestrator 가 정식 규약 준수 checker 용으로 작성한 입력입니다. target 문서가 정식 규약(`spec/conventions/**`) 을 따르고 있는지 분석한다.
+sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
+따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
+인자가 가리키는 경로에 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.
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
+구현 착수 전 검토 (--impl-prep, scope=spec/conventions/)
+
+## Target 문서
+경로: `spec/conventions/`
+
+```
+### 구현 대상 영역: `spec/conventions/`
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
+| `restricted` | — | `scope` / `op` / 빈칸. `scope` = 본 scope 자체가 카페24 별도 승인 대상이라 같은 resource 의 모든 row 가 영향. `op` = 본 row 만 단독 승인 대상 (store 안 케이스). 빈칸 = 일반 사용 가능. **이 컬럼은 `status` 와 직교하며 `status` 의 값이 아니다** — `supported` + `restricted: op` 조합이 정상이다. 명단 SoT 는 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md) |
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
+8. **`restricted` 컬럼 ↔ 메타데이터 `restrictedApproval` 동기**: catalog row 의 `restricted` 컬럼이 `scope` 또는 `op` 이면 그 row 에 대응하는 backend 메타데이터에 `restrictedApproval` 필드가 존재해야 하고, 그 역도 동일. 컬럼 값 ↔ 메타데이터 `level` 매핑: `scope` ↔ `level='scope'`, `op` ↔ `level='operation'`. **`level='program'` 인 메타데이터 row 는 catalog 화 대상이 아닌 별도 트랙 (Analytics 등) 이므로 본 검증에서 제외**된다 — catalog 에 대응 row 가 없는 것이 정상. SoT 명단의 진위 검증은 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md) §5 절차에서 별도로 다룬다.
+
+테스트는 카탈로그 MD 의 표를 파싱한다 — MD 표 구문이 깨지면 곧장 fail. 따라서 본 카탈로그는 **사람이 직접 손으로 수정하는 SoT** 이며, 코드 변경 시점에 반드시 카탈로그 동기 갱신을 함께 commit 해야 한다(`spec/conventions/cafe24-api-metadata.md` §5 의 신규 endpoint 추가 절차에 인용).
+
+## 5. Coverage Matrix
+
+2026-05-16 기준. 본 매트릭스는 카탈로그 row 수 + 메타데이터 row 수의 한 화면 요약이다 — 위 동기 테스트와 별개의 휴먼 가독성 보조 정보다. row 추가/삭제 시 본 표도 손으로 갱신한다.
+
+| Resource | Supported | Planned | Cafe24 docs sub-resource 수 |
+|----------|-----------|---------|---|
+| [store](./store.md) | 8 | 50+ | 50+ |
+| [product](./product.md) | 14 | 25+ | 28 |
+| [order](./order.md) | 17 | 30+ | 47 |
+| [customer](./customer.md) | 24 | 0 | 12 |
+| [community](./community.md) | 24 | 0 | 9 |
+| [design](./design.md) | 9 | 0 | 3 |
+| [promotion](./promotion.md) | 35 | 0 | 10 |
+| [application](./application.md) | 19 | 0 | 8 |
+| [category](./category.md) | 19 | 0 | 5 |
+| [collection](./collection.md) | 15 | 0 | 5 |
+| [supply](./supply.md) | 20 | 0 | 6 |
+| [shipping](./shipping.md) | 15 | 0 | 5 |
+| [salesreport](./salesreport.md) | 5 | 0 | 5 |
+| [personal](./personal.md) | 5 | 0 | 3 |
+| [privacy](./privacy.md) | 6 | 0 | 2 |
+| [mileage](./mileage.md) | 8 | 0 | 5 |
+| [notification](./notification.md) | 12 | 0 | 7 |
+| [translation](./translation.md) | 9 | 0 | 4 |
+| **합계** | **264** | **~109** | **~250** |
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
+> `spec/conventions/cafe24-api-metadata.md` §5 의 신규 endpoint 추가 절차도 본 카탈로그 row 갱신을 step 으로 포함한다.
+
+## 7. CHANGELOG
+
+| 일자 | 변경 |
+|------|------|
+| 2026-05-16 | 신규 컨벤션 — 18 resource 카탈로그 + 양방향 동기 테스트 도입. 사용자 결정(2026-05-16) "Cafe24 docs 전수 등재" 에 따라 supported 53 + planned ~300 으로 초기 채움. |
+| 2026-05-16 (coverage Phase 5a) | Order resource — `order_count`, `order_status_update`, `order_status_update_multiple` 3건을 planned → supported 로 승격 (backend metadata + planned.ts mirror 동시 갱신). order supported 6 → 9, 합계 53 → 56. |
+| 2026-05-16 (coverage Phase 5b) | Product resource — `product_count`, `product_options_list/create/update/delete`, `product_seo_get/update` 7건을 planned → supported 로 승격. product supported 7 → 14, 합계 56 → 63. |
+| 2026-05-16 (coverage Phase 5c) | Customer resource — 회원 메모 CRUD 완성: `customer_memos_count/list/get/update/delete` 5건을 planned → supported 로 승격. customer supported 5 → 10, 합계 63 → 68. |
+| 2026-05-16 (coverage Phase 5d) | Promotion resource — 쿠폰 보완: `coupon_count`, `coupon_issues_list`, `coupon_issuance_customers_list`, `customers_coupons_list`, `customers_coupons_count` 5건을 planned → supported 로 승격. promotion supported 5 → 10, 합계 68 → 73. |
+| 2026-05-16 (coverage Phase 5e) | Salesreport resource 완성 — `salesreport_monthly`, `salesreport_hourly`, `salesreport_volume` 3건을 planned → supported 로 승격. salesreport supported 2 → 5, planned 3 → 0, 합계 73 → 76. salesreport resource 의 첫 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 5f) | Promotion resource — 시리얼쿠폰 5건 (`serialcoupons_list`, `serialcoupons_generate`, `serialcoupons_delete`, `serialcoupons_issues_get`, `serialcoupons_issues_register`) 를 planned → supported 로 승격. promotion supported 10 → 15, 합계 76 → 81. |
+| 2026-05-16 (coverage Phase 6a) | Order resource — A/S 자동화 8건 (`refunds_list/get`, `cancellation_get/create_multiple`, `exchange_get/create_multiple`, `return_get/create_multiple`) 를 planned → supported 로 승격. order supported 9 → 17, 합계 81 → 89. |
+| 2026-05-16 (coverage Phase 6b) | Store resource — 결제 설정 6건 (`paymentmethods_list`, `paymentmethods_paymentproviders_list`, `paymentgateway_paymentmethods_list`, `paymentgateway_create/update/delete`) 를 planned → supported 로 승격. store supported 2 → 8, 합계 89 → 95. |
+| 2026-05-16 (coverage Phase 6c) | Promotion resource — 회원 혜택 CRUD 6건 + 회원 정보 이벤트 3건 + customers_coupons_delete 1건 = 10건. promotion supported 15 → 25, 합계 95 → 105. |
+| 2026-05-16 (coverage Phase 6d) | Category/Collection/Supply/Shipping baseline 10건 — category(category_count/mains_list/autodisplay_list), collection(brands count/create/update/delete), supply(suppliers_count/get), shipping(carriers_get). 합계 105 → 115. |
+| 2026-05-16 (coverage Phase 6e) | Mileage resource — 적립금 자동 만료 3건 (`points_autoexpiration_get/create/delete`) + 예치금 2건 (`credits_list`, `credits_report`) = 5건. mileage supported 2 → 7, 합계 115 → 120. |
+| 2026-05-16 (coverage Phase 6f) | Notification resource — SMS 2건 (`sms_senders_list`, `sms_receivers_get`) + automails 2건 (`automails_get/update`) + recipientgroups 2건 (`recipientgroups_list/get`) = 6건. notification supported 2 → 8, 합계 120 → 126. |
+| 2026-05-16 (coverage Phase 6g) | Translation resource — products_update + categories list/update + store list/update + themes list 6건. translation supported 1 → 7, 합계 126 → 132. 본 사이클 (Phase 6 a~g) 종료. |
+| 2026-05-16 (coverage Phase 7a) | Promotion resource — discountcodes CRUD 5건 + commonevents CRUD 4건 = 9건. promotion supported 25 → 34, 합계 132 → 141. |
+| 2026-05-16 (coverage Phase 7b) | Customer resource 완성 — 회원 14건 (paymentinfo 3 + properties 2 + customergroups 4 + delete + autoupdate + plusapp + social + social_list). customer supported 10 → 24, planned 14 → 0, 합계 141 → 155. customer 두 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 7c) | Community resource — boards 설정 2건 + boards 글 CRUD 3건 + comments 3건 + commenttemplates 2건 = 10건. community supported 3 → 13, 합계 155 → 165. |
+| 2026-05-16 (coverage Phase 7d) | Application resource — apps_update + scripttags CRUD 5건 + webhooks_update + webhooks_logs_list = 8건. application supported 3 → 11, 합계 165 → 173. |
+| 2026-05-16 (coverage Phase 7e) | Shipping resource 완성 — carriers CRUD 3건 + regionalsurcharges 2건 + shipping_settings 2건 + shipping_additionalfees_countries + shippingorigins CRUD 5건 = 13건. shipping supported 2 → 15, planned 13 → 0, 합계 173 → 186. shipping 세 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 7f) | Category resource 완성 — decorationimages 2건 (get/update) + seo 2건 (get/update) + mains 3건 (add/update/delete) + autodisplay 3건 (create/update/delete) = 10건. category supported 9 → 19, planned 10 → 0, 합계 186 → 196. category 네 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 7g) | Supply resource 완성 — suppliers CUD 3건 + suppliers_users CRUD 6건 + suppliers_users regional shipping 5건 + shipping_suppliers 3건 = 17건. supply supported 3 → 20, planned 17 → 0, 합계 196 → 213. supply 다섯 번째 0-planned resource. 본 사이클 (Phase 7 a~g) 종료. |
+| 2026-05-16 (coverage Phase 8a) | Mileage resource 완성 — `points_report` 1건. mileage supported 7 → 8, planned 1 → 0, 합계 213 → 214. mileage 여섯 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 8b) | Promotion resource 완성 — `coupon_manage` 1건 (use_coupon T/F 토글). promotion supported 34 → 35, planned 1 → 0, 합계 214 → 215. promotion 일곱 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 8c) | Translation resource 완성 — 테마 번역 단건 조회/수정 2건. translation supported 7 → 9, planned 2 → 0, 합계 215 → 217. translation 여덟 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 8d) | Personal resource 완성 — `customers_wishlist_count` + `products_carts_count` + `products_carts_list` 3건. personal supported 2 → 5, planned 3 → 0, 합계 217 → 220. personal 아홉 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 8e) | Notification resource 완성 — `customers_invitation_send` + recipientgroups CUD 3건 = 4건. notification supported 8 → 12, planned 4 → 0, 합계 220 → 224. notification 열 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 8f) | Privacy resource 완성 — customers_privacy list/count/update 3건 + products_wishlist_customers list/count 2건 = 5건. privacy supported 1 → 6, planned 5 → 0, 합계 224 → 229. privacy 열한 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 8g) | Application resource 완성 — appstore_orders get/create 2건 + appstore_payments list/count 2건 + databridge_logs_list + recipes list/create/delete 3건 = 8건. application supported 11 → 19, planned 8 → 0, 합계 229 → 237. application 열두 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 8h) | Collection resource 완성 — manufacturers count/get/create/update 4건 + trends_count + classifications list/count 2건 + origin_list = 8건. collection supported 7 → 15, planned 8 → 0, 합계 237 → 245. collection 열세 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 8i) | Design resource 완성 — themes count/get 2건 + theme_pages CRUD 4건 (get/create/update/delete) + icons_list + icons_update_settings = 8건. design supported 1 → 9, planned 8 → 0, 합계 245 → 253. design 열네 번째 0-planned resource. |
+| 2026-05-16 (coverage Phase 8j) | Community resource 완성 — boards_comments_bulk + boards_seo get/update 2건 + commenttemplates get/update/delete 3건 + financials_monthlyreviews_count + urgentinquiry get/reply CRUD 4건 = 11건. community supported 13 → 24, planned 11 → 0, 합계 253 → 264. community 열다섯 번째 0-planned resource. 본 사이클 (Phase 8 a~j) 종료. |
+| 2026-05-17 | §2 에 `restricted` 컬럼 추가 + §4 검증 규칙 8 신설 — 카페24 별도 승인 대상 식별. SoT 는 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md). 영향 카탈로그 (mileage / notification / privacy / store) 표 헤더·row 동시 갱신. 사용자 보고 (질문에서 제공한 3종 표) 후속. consistency-check 세션: `review/consistency/2026/05/17/12_12_46/` (BLOCK: NO). |
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
+| `apps_update` | 앱 정보 수정 | Update an app information | PUT | `apps` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-app-information) |
+| `appstore_orders_get` | 앱스토어 주문 조회 | Retrieve a Cafe24 store order | GET | `appstore/orders/{order_id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retreive-a-cafe24-store-order) |
+| `appstore_orders_create` | 앱스토어 주문 생성 | Create a Cafe24 store order | POST | `appstore/orders` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-cafe24-store-order) |
+| `appstore_payments_list` | 앱스토어 결제 목록 | Retrieve a list of Cafe24 store payments | GET | `appstore/payments` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-cafe24-store-payments) |
+| `appstore_payments_count` | 앱스토어 결제 수 | Retrieve a count of Cafe24 store payments | GET | `appstore/payments/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-cafe24-store-payments) |
+| `databridge_logs_list` | DataBridge 로그 목록 | Retrieve a list of DataBridge webhook logs | GET | `databridge/logs` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-databridge-webhook-logs) |
+| `recipes_list` | 레시피 목록 조회 | Retrieve a list of recipes | GET | `recipes` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-recipes) |
+| `recipes_create` | 레시피 생성 | Create a recipe | POST | `recipes` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-recipe) |
+| `recipes_delete` | 레시피 삭제 | Delete a recipe | DELETE | `recipes/{recipe_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-recipe) |
+| `scripttags_count` | 스크립트태그 개수 조회 | Retrieve a count of script tags | GET | `scripttags/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-script-tags) |
+| `scripttags_get` | 스크립트태그 단건 조회 | Retrieve a script tag | GET | `scripttags/{tag_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-script-tag) |
+| `scripttags_create` | 스크립트태그 생성 | Create a script tag | POST | `scripttags` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-script-tag) |
+| `scripttags_update` | 스크립트태그 수정 | Update a script tag | PUT | `scripttags/{tag_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-script-tag) |
+| `scripttags_delete` | 스크립트태그 삭제 | Delete a script tag | DELETE | `scripttags/{tag_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-script-tag) |
+| `webhooks_logs_list` | Webhook 로그 목록 | Retrieve a list of webhook logs | GET | `webhooks/logs` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-webhook-logs) |
+| `webhooks_update` | Webhook 설정 수정 | Edit webhook settings | PUT | `webhooks` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-webhook-settings) |
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
+| `category_count` | 카테고리 개수 조회 | Retrieve a count of product categories | GET | `categories/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-product-categories) |
+| `category_decorationimages_get` | 카테고리 꾸미기 이미지 조회 | Retrieve decoration image settings by category | GET | `categories/{category_no}/decorationimages` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-decoration-image-settings-by-category) |
+| `category_decorationimages_update` | 카테고리 꾸미기 이미지 수정 | Update decoration images of a product category | PUT | `categories/{category_no}/decorationimages` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-decoration-images-of-a-product-category) |
+| `category_seo_get` | 카테고리 SEO 조회 | Retrieve SEO settings by category | GET | `categories/{category_no}/seo` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-seo-settings-by-category) |
+| `category_seo_update` | 카테고리 SEO 수정 | Update a product category SEO | PUT | `categories/{category_no}/seo` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-category-seo) |
+| `mains_list` | 메인 카테고리 목록 조회 | Retrieve a list of main categories | GET | `mains` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-main-categories) |
+| `mains_add` | 메인 카테고리 추가 | Add main category | POST | `mains` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#add-main-category) |
+| `mains_update` | 메인 카테고리 수정 | Update main category | PUT | `mains/{main_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-main-category) |
+| `mains_delete` | 메인 카테고리 삭제 | Delete main category | DELETE | `mains/{main_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-main-category) |
+| `autodisplay_list` | 자동 진열 목록 조회 | Retrieve a list of auto layouts | GET | `autodisplay` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-auto-layouts) |
+| `autodisplay_create` | 자동 진열 생성 | Create auto layout for selected product category | POST | `autodisplay` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-auto-layout-for-selected-product-category) |
+| `autodisplay_update` | 자동 진열 수정 | Update auto layout for selected product category | PUT | `autodisplay/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-auto-layout-for-selected-product-category) |
+| `autodisplay_delete` | 자동 진열 삭제 | Delete auto layout for selected product category | DELETE | `autodisplay/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-auto-layout-for-selected-product-category) |
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
+| `brands_count` | 브랜드 개수 조회 | Retrieve a count of brands | GET | `brands/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-brands) |
+| `brands_create` | 브랜드 생성 | Create a brand | POST | `brands` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-brand) |
+| `brands_update` | 브랜드 수정 | Update a brand | PUT | `brands/{brand_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-brand) |
+| `brands_delete` | 브랜드 삭제 | Delete a brand | DELETE | `brands/{brand_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-brand) |
+| `manufacturers_count` | 제조사 개수 조회 | Retrieve a count of manufacturers | GET | `manufacturers/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-manufacturers) |
+| `manufacturers_get` | 제조사 단건 조회 | Retrieve a manufacturer | GET | `manufacturers/{manufacturer_code}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-manufacturer) |
+| `manufacturers_create` | 제조사 생성 | Create a manufacturer | POST | `manufacturers` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-manufacturer) |
+| `manufacturers_update` | 제조사 수정 | Update a manufacturer | PUT | `manufacturers/{manufacturer_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-manufacturer) |
+| `trends_count` | 트렌드 개수 조회 | Retrieve a count of trends | GET | `trends/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-trends) |
+| `classifications_list` | 사용자 정의 카테고리 목록 | Retrieve a list of custom categories | GET | `classifications` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-custom-categories) |
+| `classifications_count` | 사용자 정의 카테고리 수 | Retrieve a count of custom categories | GET | `classifications/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-custom-categories) |
+| `origin_list` | 원산지 목록 조회 | Retrieve a list of origins | GET | `origin` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-origins) |
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
+| `boards_settings_get` | 게시판 설정 조회 | Retrieve the board settings | GET | `boards/{board_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-board-settings) |
+| `boards_settings_update` | 게시판 설정 수정 | Update the board settings | PUT | `boards/{board_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-the-board-settings) |
+| `board_articles_create` | 게시판 글 작성 | Create a board post | POST | `boards/{board_no}/articles` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-board-post) |
+| `board_articles_update` | 게시판 글 수정 | Update a board post | PUT | `boards/{board_no}/articles/{article_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-board-post) |
+| `board_articles_delete` | 게시판 글 삭제 | Delete a board post | DELETE | `boards/{board_no}/articles/{article_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-board-post) |
+| `board_articles_comments_list` | 게시판 댓글 목록 | Retrieve a list of comments for a board post | GET | `boards/{board_no}/articles/{article_no}/comments` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-comments-for-a-board-post) |
+| `board_articles_comments_create` | 게시판 댓글 작성 | Create a comment for a board post | POST | `boards/{board_no}/articles/{article_no}/comments` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-comment-for-a-board-post) |
+| `board_articles_comments_delete` | 게시판 댓글 삭제 | Delete a comment for a board post | DELETE | `boards/{board_no}/articles/{article_no}/comments/{comment_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-comment-for-a-board-post) |
+| `boards_comments_bulk` | 게시판 댓글 일괄 조회 | Retrieve comments in bulk | GET | `boards/{board_no}/comments` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-comments-in-bulk) |
+| `boards_seo_get` | 게시판 SEO 조회 | Retrieve SEO settings for board | GET | `boards/{board_no}/seo` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-seo-settings-for-board) |
+| `boards_seo_update` | 게시판 SEO 수정 | Update SEO settings for board | PUT | `boards/{board_no}/seo` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-seo-settings-for-board) |
+| `commenttemplates_list` | 자주 쓰는 답변 목록 | Retrieve frequently used answers | GET | `commenttemplates` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-frequently-used-answers) |
+| `commenttemplates_get` | 자주 쓰는 답변 단건 | Retrieve a frequently used answer | GET | `commenttemplates/{template_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-frequently-used-answer) |
+| `commenttemplates_create` | 자주 쓰는 답변 생성 | Create a frequently used answer | POST | `commenttemplates` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-frequently-used-answer) |
+| `commenttemplates_update` | 자주 쓰는 답변 수정 | Update a frequently used answer | PUT | `commenttemplates/{template_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-frequently-used-answer) |
+| `commenttemplates_delete` | 자주 쓰는 답변 삭제 | Delete a frequently used answer | DELETE | `commenttemplates/{template_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-frequently-used-answer) |
+| `financials_monthlyreviews_count` | 월별 후기 카운트 | Retrieve the total count for monthly reviews and ratings | GET | `financials/monthlyreviews/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-total-count-for-monthly-reviews-and-ratings) |
+| `urgentinquiry_get` | 긴급 문의 게시글 조회 | Retrieve an urgent inquiry post | GET | `urgentinquiry/{inquiry_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-urgent-inquiry-post) |
+| `urgentinquiry_reply_get` | 긴급 문의 답변 조회 | Retrieve a reply for urgent inquiry post | GET | `urgentinquiry/{inquiry_no}/reply` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-reply-for-urgent-inquiry-post) |
+| `urgentinquiry_reply_create` | 긴급 문의 답변 작성 | Create a reply for urgent inquiry post | POST | `urgentinquiry/{inquiry_no}/reply` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-reply-for-urgent-inquiry-post) |
+| `urgentinquiry_reply_update` | 긴급 문의 답변 수정 | Update a reply for urgent inquiry post | PUT | `urgentinquiry/{inquiry_no}/reply` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-reply-for-urgent-inquiry-post) |
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
+| `customer_delete` | 회원 탈퇴 처리 | Delete an account | DELETE | `customers/{member_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-account) |
+| `customer_autoupdate_get` | 회원 등급 자동 갱신 조회 | Retrieve customer tier auto-update details | GET | `customers/autoupdate` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-customer-tier-auto-update-details) |
+| `customer_memos_count` | 회원 메모 개수 | Retrieve a count of customer memos | GET | `customers/{member_id}/memos/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-memos) |
+| `customer_memos_list` | 회원 메모 목록 | Retrieve a list of customer memos | GET | `customers/{member_id}/memos` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-memos) |
+| `customer_memos_get` | 회원 메모 단건 조회 | Retrieve a customer memo | GET | `customers/{member_id}/memos/{memo_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-memo) |
+| `customer_memos_update` | 회원 메모 수정 | Update a customer memo | PUT | `customers/{member_id}/memos/{memo_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-memo) |
+| `customer_memos_delete` | 회원 메모 삭제 | Delete a customer memo | DELETE | `customers/{member_id}/memos/{memo_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-customer-memo) |
+| `customer_paymentinfo_list` | 회원 결제수단 목록 | Retrieve a customer's list of payment methods | GET | `customers/{member_id}/paymentinformation` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-s-list-of-payment-methods) |
+| `customer_paymentinfo_delete` | 회원 결제수단 삭제 | Delete customer's payment information | DELETE | `customers/{member_id}/paymentinformation` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-customer-s-payment-information) |
+| `customer_paymentinfo_delete_by_id` | 회원 결제수단 ID 삭제 | Delete customer's payment information by payment method ID | DELETE | `customers/{member_id}/paymentinformation/{payment_method_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-customer-s-payment-information-by-payment-method-id) |
+| `customer_plusapp_get` | Plus 앱 설치 정보 조회 | Retrieve app installation information | GET | `customers/{member_id}/plusapp` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-app-installation-information) |
+| `customer_social_get` | 소셜 계정 조회 | Retrieve a customer's social account | GET | `customers/{member_id}/social` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-s-social-account) |
+| `customers_properties_view` | 회원가입 필드 조회 | View account signup fields | GET | `customers/properties` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#view-account-signup-fields) |
+| `customers_properties_edit` | 회원가입 필드 수정 | Edit account signup fields | PUT | `customers/properties` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-account-signup-fields) |
+| `social_list` | 소셜 연동 목록 | List all social | GET | `social` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#list-all-social) |
+| `customergroups_list` | 회원 등급 목록 | Retrieve a list of customer tiers | GET | `customergroups` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-tiers) |
+| `customergroups_count` | 회원 등급 개수 | Retrieve a count of customer tiers | GET | `customergroups/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-tiers) |
+| `customergroups_get` | 회원 등급 단건 조회 | Retrieve a customer tier | GET | `customergroups/{group_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-tier) |
+| `customergroups_settings_get` | 회원 등급 설정 조회 | Retrieve customer tier settings | GET | `customergroups/setting` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-customer-tier-settings) |
+
+```
+
+#### `spec/conventions/cafe24-api-catalog/design.md`
+```
+# Cafe24 API Catalog — Design (디자인)
+
+> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md). 본 파일은 `design` resource 의 모든 operation enumeration.
+
+base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
+
+## 표
+
+| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
+|----|---|---|---|---|---|---|---|---|
+| `themes_list` | 테마 목록 조회 | Retrieve a list of themes | GET | `themes` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-themes) |
+| `themes_count` | 테마 개수 조회 | Retrieve a count of themes | GET | `themes/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-themes) |
+| `themes_get` | 테마 단건 조회 | Retrieve a theme | GET | `themes/{theme_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-theme) |
+| `theme_pages_get` | 테마 페이지 조회 | Retrieve a theme page | GET | `themes/{theme_no}/pages/{page_path}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-theme-page) |
+| `theme_pages_create` | 테마 페이지 생성 | Create a theme page | POST | `themes/{theme_no}/pages` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-theme-page) |
+| `theme_pages_update` | 테마 페이지 수정 | Update a theme page | PUT | `themes/{theme_no}/pages/{page_path}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-theme-page) |
+| `theme_pages_delete` | 테마 페이지 삭제 | Delete a theme page | DELETE | `themes/{theme_no}/pages/{page_path}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-theme-page) |
+| `icons_list` | 디자인 아이콘 목록 조회 | Retrieve a list of design icons | GET | `icons` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-desgin-icons) |
+| `icons_update_settings` | 상점 아이콘 설정 수정 | Update store icon settings | PUT | `icons` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-store-icon-settings) |
+
+```
+
+#### `spec/conventions/cafe24-api-catalog/mileage.md`
+```
+# Cafe24 API Catalog — Mileage (적립금)
+
+> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).
+
+base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
+
+> **별도 승인 필요** — 본 resource 의 `mall.read_mileage` / `mall.write_mileage` scope 는 카페24 본사가 별도 승인한 클라이언트만 사용할 수 있다 (명단 SoT: [`cafe24-restricted-scopes.md §1`](../cafe24-restricted-scopes.md#1-scope-단위-별도-승인-resource-전체-영향)). 모든 row 의 `restricted` 컬럼 = `scope`, 대응 backend 메타데이터 `restrictedApproval.level='scope'`, `category='mileage'`.
+
+## 표
+
+| id | 라벨 (한) | English title | method | path | scope | restricted | paginated | status | docs |
+|----|---|---|---|---|---|---|---|---|---|
+| `mileage_list` | 적립금 내역 조회 | Retrieve points | GET | `points` | read | scope | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-points) |
+| `mileage_grant` | 적립금 지급 | Issue and deduct points | POST | `points` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#issue-and-deduct-points) |
+| `points_autoexpiration_get` | 적립금 자동 만료 조회 | Retrieve an automatic points expiration | GET | `points/autoexpiration/{id}` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-automatic-points-expiration) |
+| `points_autoexpiration_create` | 적립금 자동 만료 생성 | Create an automatic points expiration | POST | `points/autoexpiration` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-automatic-points-expiration) |
+| `points_autoexpiration_delete` | 적립금 자동 만료 삭제 | Delete an automatic points expiration | DELETE | `points/autoexpiration/{id}` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-automatic-points-expiration) |
+| `points_report` | 적립금 리포트 조회 | Retrieve a points report by date range | GET | `points/report` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-points-report-by-date-range) |
+| `credits_list` | 예치금 내역 조회 | Retrieve a list of credits by date range | GET | `credits` | read | scope | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-credits-by-date-range) |
+| `credits_report` | 예치금 리포트 조회 | Retrieve a credit report by date range | GET | `credits/report` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-credit-report-by-date-range) |
+
+```
+
+#### `spec/conventions/cafe24-api-catalog/notification.md`
+```
+# Cafe24 API Catalog — Notification (알림)
+
+> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).
+
+base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
+
+> **별도 승인 필요** — 본 resource 의 `mall.read_notification` / `mall.write_notification` scope 는 카페24 본사가 별도 승인한 클라이언트만 사용할 수 있다 (명단 SoT: [`cafe24-restricted-scopes.md §1`](../cafe24-restricted-scopes.md#1-scope-단위-별도-승인-resource-전체-영향)). 모든 row 의 `restricted` 컬럼 = `scope`, 대응 backend 메타데이터 `restrictedApproval.level='scope'`, `category='notification'`.
+
+## 표
+
+| id | 라벨 (한) | English title | method | path | scope | restricted | paginated | status | docs |
+|----|---|---|---|---|---|---|---|---|---|
+| `sms_send` | SMS 발송 | Send a SMS | POST | `sms` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#send-a-sms) |
+| `sms_balance_get` | SMS 잔액 조회 | Retrieve the SMS balance | GET | `sms/balance` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-sms-balance) |
+| `sms_receivers_get` | SMS 수신자 조회 | Retrieve a SMS recipient | GET | `sms/receivers` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-sms-recipient) |
+| `sms_senders_list` | SMS 발신자 목록 조회 | Retrieve a list of SMS senders | GET | `sms/senders` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-sms-senders) |
+| `automails_get` | 자동 이메일 설정 조회 | Retrieve automated email settings | GET | `automails` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-automated-email-settings) |
+| `automails_update` | 자동 이메일 설정 수정 | Update automated email settings | PUT | `automails` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-automated-email-settings) |
+| `customers_invitation_send` | 회원 활성화 초대 발송 | Send an invitation to activate account | POST | `customers/invitation` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#send-an-invitation-to-activate-account) |
+| `recipientgroups_list` | 수신자 그룹 목록 | Retrieve distribution group list | GET | `recipientgroups` | read | scope | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-distribution-group-list) |
+| `recipientgroups_get` | 수신자 그룹 상세 | Retrieve distribution group details | GET | `recipientgroups/{group_no}` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-distribution-group-details) |
+| `recipientgroups_create` | 수신자 그룹 생성 | Create a distribution group | POST | `recipientgroups` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-distribution-group) |
+| `recipientgroups_update` | 수신자 그룹 수정 | Edit distribution group | PUT | `recipientgroups/{group_no}` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-distribution-group) |
+| `recipientgroups_delete` | 수신자 그룹 삭제 | Delete distribution group | DELETE | `recipientgroups/{group_no}` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-distribution-group) |
+
+```
+
+#### `spec/conventions/cafe24-api-catalog/order.md`
+```
+# Cafe24 API Catalog — Order (주문)
+
+> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).
+
+base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
+
+## 표
+
+| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
+|----|---|---|---|---|---|---|---|---|
+| `order_list` | 주문 목록 조회 | Retrieve a list of orders | GET | `orders` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-orders) |
+| `order_get` | 주문 단건 조회 | Retrieve an order | GET | `orders/{order_id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-order) |
+| `order_items_list` | 주문 상품 목록 조회 | Retrieve a list of order items | GET | `orders/{order_id}/items` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-order-items) |
+| `order_shipments_create` | 주문 배송 정보 등록 | Create an order shipping information | POST | `orders/{order_id}/shipments` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-shipping-information) |
+| `order_buyer_update` | 주문자 정보 수정 | Update customer information of an order | PUT | `orders/{order_id}/buyer` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-customer-information-of-an-order) |
+| `order_memos_create` | 주문 메모 작성 | Create an order memo | POST | `orders/{order_id}/memos` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-memo) |
+| `order_count` | 주문 개수 조회 | Retrieve a count of orders | GET | `orders/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-orders) |
+| `order_status_update_multiple` | 주문 상태 일괄 변경 | Update status for multiple orders | PUT | `orders/status` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-status-for-multiple-orders) |
+| `order_status_update` | 주문 상태 변경 | Update an order status | PUT | `orders/{order_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-status) |
+| `order_autocalculation_delete` | 주문 자동 계산 해제 | Remove auto calculation setting of an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#remove-auto-calculation-setting-of-an-order) |
+| `order_buyer_get` | 주문자 정보 조회 | Retrieve customer details of an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-customer-details-of-an-order) |
+| `order_buyer_history_list` | 주문자 정보 변경 이력 | Retrieve a list of customer history of an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-history-of-an-order) |
+| `order_cancellation_create` | 주문 취소 생성 | Create an order cancellation | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-cancellation) |
+| `order_cancellation_update` | 주문 취소 상세 변경 | Change cancellation details | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#change-cancellation-details) |
+| `order_completions_complete` | PG 결제 후 주문 완료 | Complete an order after PG payment | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#complete-an-order-after-pg-payment) |
+| `order_exchange_create` | 주문 교환 생성 | Create an order exchange | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-exchange) |
+| `order_exchange_update` | 주문 교환 수정 | Update an order exchange | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-exchange) |
+| `order_exchangerequests_reject` | 교환 요청 반려 | Reject an exchange request | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#reject-an-exchange-request) |
+| `order_items_create` | 주문 상품 추가 | Create an order item | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-item) |
+| `order_items_update` | 주문 상품 수정 | Update an order item | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-item) |
+| `order_items_labels_get` | 주문 상품 라벨 조회 | Retrieve an order label | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-order-label) |
+| `order_items_labels_create` | 주문 상품 라벨 생성 | Create an order label | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-label) |
+| `order_items_labels_update` | 주문 상품 라벨 수정 | Update an order label | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-label) |
+| `order_items_labels_delete` | 주문 상품 라벨 삭제 | Delete an order label | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-order-label) |
+| `order_items_options_create` | 주문 상품 옵션 생성 | Create order item options | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-order-item-options) |
+| `order_items_options_update` | 주문 상품 옵션 수정 | Edit order item options | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-order-item-options) |
+| `order_memos_list` | 주문 메모 목록 | Retrieve a list of order memos | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-order-memos) |
+| `order_memos_update` | 주문 메모 수정 | Update an order memo | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-memo) |
+| `order_memos_delete` | 주문 메모 삭제 | Delete an order memo | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-order-memo) |
+| `order_payments_status_update` | 주문 결제 상태 수정 | Update an order payment status | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-payment-status) |
+| `order_paymenttimeline_history` | 결제 이력 조회 | Retrieve payment history of an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-payment-history-of-an-order) |
+| `order_paymenttimeline_details` | 결제 상세 조회 | Retrieve payment details of an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-payment-details-of-an-order) |
+| `order_receivers_list` | 받는 사람 목록 | Retrieve a list of recipients of an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-recipients-of-an-order) |
+| `order_receivers_update` | 받는 사람 수정 | Update order recipients | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-order-recipients) |
+| `order_receivers_change_shipping` | 받는 사람 배송지 변경 | Change shipping information | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#change-shipping-information) |
+| `order_receivers_history_list` | 받는 사람 변경 이력 | Retrieve a list of recipient history of an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-recipient-history-of-an-order) |
+| `order_refunds_update` | 주문 환불 수정 | Update an order refund | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-refund) |
+| `order_return_create` | 주문 반품 생성 | Create an order return | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-return) |
+| `order_return_update` | 주문 반품 수정 | Update an order return | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-return) |
+| `order_shipments_list` | 주문 배송 정보 목록 | Retrieve a list of shipping information of an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-shipping-information-of-an-order) |
+| `order_shipments_update` | 주문 배송 정보 수정 | Update an order shipping | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-shipping) |
+| `order_shipments_delete` | 주문 배송 정보 삭제 | Delete an order shipping | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-order-shipping) |
+| `order_shippingfeecancellation_get` | 배송비 취소 상세 | Retrieve shipping fee cancellation details of an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-shipping-fee-cancellation-details-of-an-order) |
+| `order_shippingfeecancellation_create` | 배송비 취소 생성 | Create an order shipping fee cancellation | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-shipping-fee-cancellation) |
+| `order_shortagecancellation_create` | 재고 부족 취소 생성 | Create an order cancellation on stock shortage | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-cancellation-on-stock-shortage) |
+| `orders_benefits_list` | 주문 혜택 목록 | Retrieve a list of order benefits applied to an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-order-benefits-applied-to-an-order) |
+| `orders_calculation_total` | 주문 결제 금액 계산 | Calculate total due | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#calculate-total-due) |
+| `orders_coupons_list` | 주문 쿠폰 목록 | Retrieve a list of coupons applied to an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-coupons-applied-to-an-order) |
+| `orders_dashboard_list` | 주문 대시보드 | List all orders dashboard | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#list-all-orders-dashboard) |
+| `orders_inflowgroups_list` | 유입 그룹 목록 | Retrieve a list of traffic source groups | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-traffic-source-groups) |
+| `orders_inflowgroups_create` | 유입 그룹 생성 | Create a traffic source group | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-traffic-source-group) |
+| `orders_inflowgroups_update` | 유입 그룹 수정 | Update a traffic source group | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-traffic-source-group) |
+| `orders_inflowgroups_delete` | 유입 그룹 삭제 | Delete a traffic source group | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-traffic-source-group) |
+| `orders_inflows_list` | 유입 출처 목록 | Retrieve a list of group traffic sources | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-group-traffic-sources) |
+| `orders_inflows_create` | 유입 출처 생성 | Create a group traffic source | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-group-traffic-source) |
+| `orders_inflows_update` | 유입 출처 수정 | Update a group traffic source | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-group-traffic-source) |
+| `orders_inflows_delete` | 유입 출처 삭제 | Delete a group traffic source | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-group-traffic-source) |
+| `orders_memos_list` | 관리자 메모 목록 | Retrieve a list of admin memos for an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-admin-memos-for-an-order) |
+| `orders_migrations_get` | 이관 주문 조회 | Retrieve order from migrated store | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-order-from-migrated-store) |
+| `orders_migrations_create` | 이관 주문 생성 | Create order from migrated store | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-order-from-migrated-store) |
+| `orders_migrations_update` | 이관 주문 수정 | Update order from migrated store | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-order-from-migrated-store) |
+| `orders_migrations_delete` | 이관 주문 삭제 | Delete order from migrated store | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-order-from-migrated-store) |
+| `orders_paymentamount_get` | 결제 금액 조회 | Retrieve a payment amount | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-payment-amount) |
+| `orders_saleschannels_list` | 판매 채널 목록 | Retrieve a list of sales channels | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-sales-channels) |
+| `orders_saleschannels_create` | 판매 채널 생성 | Create a sales channel | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-sales-channel) |
+| `orders_saleschannels_update` | 판매 채널 수정 | Update a sales channel | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-sales-channel) |
+| `orders_saleschannels_delete` | 판매 채널 삭제 | Delete a sales channel | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-sales-channel) |
+| `payments_status_update_multiple` | 결제 상태 일괄 변경 | Update payment status for multiple orders | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-payment-status-for-multiple-orders) |
+| `refunds_list` | 환불 목록 | Retrieve a list of refunds | GET | `refunds` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-refunds) |
+| `refunds_get` | 환불 단건 조회 | Retrieve a refund | GET | `refunds/{refund_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-refund) |
+| `reservations_get` | 예약 상품 조회 | Retrieve a booked item | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-booked-item) |
+| `return_get` | 반품 조회 | Retrieve a return | GET | `return/{return_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-return) |
+| `return_create_multiple` | 반품 일괄 생성 | Create multiple order returns | POST | `return` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-multiple-order-returns) |
+| `return_update` | 반품 수정 | Update a return | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-return) |
+| `returnrequests_create` | 반품 요청 생성 | Create a return request for multiple items | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-return-request-for-multiple-items) |
+| `returnrequests_reject` | 반품 요청 거부 | Reject a return request for multiple items | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#reject-a-return-request-for-multiple-items) |
+| `cancellation_get` | 취소 조회 | Retrieve an order cancellation | GET | `cancellation/{cancellation_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-order-cancellation) |
+| `cancellation_create_multiple` | 취소 일괄 생성 | Create multiple order cancellations | POST | `cancellation` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-multiple-order-cancellations) |
+| `cancellation_update_bulk` | 취소 상세 일괄 변경 | Change cancellation details in bulk | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#change-cancellation-details-in-bulk) |
+| `cancellationrequests_create` | 취소 요청 생성 | Create a cancellation request for multiple items | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-cancellation-request-for-multiple-items) |
+| `cancellationrequests_reject` | 취소 요청 거부 | Reject a cancellation request for multiple items | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#reject-a-cancellation-request-for-multiple-items) |
+| `cashreceipt_list` | 현금영수증 목록 | Retrieve a list of cash receipts | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-cash-receipts) |
+| `cashreceipt_create` | 현금영수증 발행 | Create a cash receipt | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-cash-receipt) |
+| `cashreceipt_update` | 현금영수증 수정 | Update a cash receipt | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-cash-receipt) |
+| `cashreceipt_cancel` | 현금영수증 취소 | Update a cash receipt cancellation | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-cash-receipt-cancellation) |
+| `collectrequests_update` | 수거 요청 수정 | Update a collection request | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-collection-request) |
+| `control` | 주문 컨트롤 | Order control | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#order-control) |
+| `exchange_get` | 교환 조회 | Retrieve an exchange | GET | `orders/exchange/{order_id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-exchange) |
+| `exchange_create_multiple` | 교환 일괄 생성 | Create multiple exchanges | POST | `orders/exchanges` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-multiple-exchanges) |
+| `exchange_update_multiple` | 교환 일괄 수정 | Update multiple order exchanges | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-multiple-order-exchanges) |
+| `exchangerequests_create_bulk` | 교환 요청 일괄 생성 | Bulk exchange request API | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#bulk-exchange-request-api) |
+| `exchangerequests_reject_multiple` | 교환 요청 일괄 거부 | Reject an exchange request for multiple items | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#reject-an-exchange-request-for-multiple-items) |
+| `fulfillments_create` | 풀필먼트 배송 생성 | Create shipping information for multiple orders via fulfillment | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-shipping-information-for-multiple-orders-via-fulfillment) |
+| `labels_list` | 주문 라벨 목록 | Retrieve order labels | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-order-labels) |
+| `labels_create_multiple` | 주문 라벨 일괄 생성 | Create multiple order labels | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-multiple-order-labels) |
+| `orderform_properties_get` | 주문서 추가 필드 조회 | Retrieve an additional checkout field | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-additional-checkout-field) |
+| `orderform_properties_create` | 주문서 추가 필드 생성 | Create an additional checkout field | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-additional-checkout-field) |
+| `orderform_properties_update` | 주문서 추가 필드 수정 | Update an additional checkout field | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-additional-checkout-field) |
+| `orderform_properties_delete` | 주문서 추가 필드 삭제 | Delete an additional checkout field | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-additional-checkout-field) |
+| `shipments_create_multiple` | 배송 일괄 생성 | Create shipping information for multiple orders | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-shipping-information-for-multiple-orders) |
+| `shipments_update_multiple` | 배송 일괄 수정 | Update multiple order shippings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-multiple-order-shippings) |
+| `subscription_shipments_get` | 정기배송 조회 | Retrieve a subscription | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-subscription) |
+| `subscription_shipments_create` | 정기배송 생성 | Create a subscription | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-subscription) |
+| `subscription_shipments_update` | 정기배송 수정 | Update a subscription | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-subscription) |
+| `subscription_shipments_items_update` | 정기배송 상품 옵션 수정 | Update product variants in subscription | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-product-variants-in-subscription) |
+| `unpaidorders_list` | 미결제 주문 목록 | Retrieve unpaid orders | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-unpaid-orders) |
+
+```
+
+#### `spec/conventions/cafe24-api-catalog/personal.md`
+```
+# Cafe24 API Catalog — Personal (개인화)
+
+> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).
+
+base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
+
+## 표
+
+| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
+|----|---|---|---|---|---|---|---|---|
+| `carts_list` | 장바구니 목록 조회 | Retrieve a shopping cart | GET | `carts` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-shopping-cart) |
+| `wishlists_list` | 위시리스트 조회 | Retrieve a list of products in customer wishlist | GET | `wishlists` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-products-in-customer-wishlist) |
+| `customers_wishlist_count` | 위시리스트 상품 개수 | Retrieve a count of products in customer wishlist | GET | `customers/wishlist/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-products-in-customer-wishlist) |
+| `products_carts_count` | 상품 담은 장바구니 수 | Retrieve a count of carts containing a product | GET | `products/{product_no}/carts/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-carts-containing-a-product) |
+| `products_carts_list` | 상품 담은 장바구니 목록 | Retrieve a list of carts containing a product | GET | `products/{product_no}/carts` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-carts-containing-a-product) |
+
+```
+
+#### `spec/conventions/cafe24-api-catalog/privacy.md`
+```
+# Cafe24 API Catalog — Privacy (개인정보)
+
+> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).
+
+base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
+
+> **별도 승인 필요** — 본 resource 의 `mall.read_privacy` / `mall.write_privacy` scope 는 카페24 본사가 별도 승인한 클라이언트만 사용할 수 있다 (명단 SoT: [`cafe24-restricted-scopes.md §1`](../cafe24-restricted-scopes.md#1-scope-단위-별도-승인-resource-전체-영향)). 모든 row 의 `restricted` 컬럼 = `scope`, 대응 backend 메타데이터 `restrictedApproval.level='scope'`, `category='privacy'`.
+
+## 표
+
+| id | 라벨 (한) | English title | method | path | scope | restricted | paginated | status | docs |
+|----|---|---|---|---|---|---|---|---|---|
+| `customers_privacy_get` | 회원 개인정보 조회 | Retrieve a customer information | GET | `privacy/customers/{member_id}` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-information) |
+| `customers_privacy_list` | 회원 개인정보 목록 조회 | Retrieve a list of customer information | GET | `privacy/customers` | read | scope | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-information) |
+| `customers_privacy_count` | 회원 개인정보 개수 조회 | Retrieve a count of customer information | GET | `privacy/customers/count` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-information) |
+| `customers_privacy_update` | 회원 개인정보 수정 | Update a customer information | PUT | `privacy/customers/{member_id}` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-information) |
+| `products_wishlist_customers_list` | 위시리스트 보유 회원 목록 | Retrieve a list of customers with a product in wishlist | GET | `products/{product_no}/wishlist/customers` | read | scope | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers-with-a-product-in-wishlist) |
+| `products_wishlist_customers_count` | 위시리스트 보유 회원 수 | Retrieve a count of customers with a product in wishlist | GET | `products/{product_no}/wishlist/customers/count` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customers-with-a-product-in-wishlist) |
+
+```
+
+#### `spec/conventions/cafe24-api-catalog/product.md`
+```
+# Cafe24 API Catalog — Product (상품)
+
+> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).
+
+base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
+
+## 표
+
+| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
+|----|---|---|---|---|---|---|---|---|
+| `product_list` | 상품 목록 조회 | Retrieve a list of products | GET | `products` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-products) |
+| `product_get` | 상품 단건 조회 | Retrieve a product resource | GET | `products/{product_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-resource) |
+| `product_create` | 상품 생성 | Create a product | POST | `products` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-product) |
+| `product_update` | 상품 수정 | Update a product | PUT | `products/{product_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product) |
+| `product_delete` | 상품 삭제 | Delete a product | DELETE | `products/{product_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product) |
+| `product_variants_list` | 상품 품목(옵션) 목록 조회 | Retrieve a list of product variants | GET | `products/{product_no}/variants` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-variants) |
+| `product_variants_inventory_update` | 상품 품목 재고 수정 | Update a product variant inventory | PUT | `products/{product_no}/variants/{variant_code}/inventories` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-variant-inventory) |
+| `product_count` | 상품 개수 조회 | Retrieve a count of products | GET | `products/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api

... (truncated due to prompt size limit) ...

---

### 파일 44: review/consistency/2026/05/17/12_37_41/_prompts/cross_spec.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 45: review/consistency/2026/05/17/12_37_41/_prompts/naming_collision.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 46: review/consistency/2026/05/17/12_37_41/_prompts/plan_coherence.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 47: review/consistency/2026/05/17/12_37_41/_prompts/rationale_continuity.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 48: review/consistency/2026/05/17/12_37_41/_retry_state.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/17/12_37_41/_retry_state.json b/review/consistency/2026/05/17/12_37_41/_retry_state.json
new file mode 100644
index 00000000..a36879f9
--- /dev/null
+++ b/review/consistency/2026/05/17/12_37_41/_retry_state.json
@@ -0,0 +1,52 @@
+{
+  "session_dir": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_37_41",
+  "summary_subagent_type": "consistency-summary",
+  "summary_output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_37_41/SUMMARY.md",
+  "subagent_invocations": [
+    {
+      "name": "cross_spec",
+      "subagent_type": "cross-spec-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_37_41/_prompts/cross_spec.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_37_41/cross_spec.md"
+    },
+    {
+      "name": "rationale_continuity",
+      "subagent_type": "rationale-continuity-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_37_41/_prompts/rationale_continuity.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_37_41/rationale_continuity.md"
+    },
+    {
+      "name": "convention_compliance",
+      "subagent_type": "convention-compliance-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_37_41/_prompts/convention_compliance.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_37_41/convention_compliance.md"
+    },
+    {
+      "name": "plan_coherence",
+      "subagent_type": "plan-coherence-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_37_41/_prompts/plan_coherence.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_37_41/plan_coherence.md"
+    },
+    {
+      "name": "naming_collision",
+      "subagent_type": "naming-collision-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_37_41/_prompts/naming_collision.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-restricted-scopes-a1b2c3/review/consistency/2026/05/17/12_37_41/naming_collision.md"
+    }
+  ],
+  "agents_pending": [
+    "cross_spec",
+    "rationale_continuity",
+    "convention_compliance",
+    "plan_coherence",
+    "naming_collision"
+  ],
+  "agents_success": [],
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

### 파일 49: review/consistency/2026/05/17/12_37_41/convention_compliance.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/17/12_37_41/convention_compliance.md b/review/consistency/2026/05/17/12_37_41/convention_compliance.md
new file mode 100644
index 00000000..8d399319
--- /dev/null
+++ b/review/consistency/2026/05/17/12_37_41/convention_compliance.md
@@ -0,0 +1,56 @@
+# Convention Compliance Check
+
+대상: `spec/conventions/` (cafe24-restricted-scopes 작업 — worktree `cafe24-restricted-scopes-a1b2c3`)
+검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/conventions/)
+
+---
+
+### 발견사항
+
+- **[CRITICAL]** `_overview.md` §2 컬럼 정의 순서와 실제 카탈로그 파일 컬럼 순서 불일치
+  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §2 "표 컬럼 정의" 정의 표 vs `mileage.md`, `notification.md`, `privacy.md`, `store.md` 표 헤더 행
+  - 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md` §2 (catalog 파일의 표준 컬럼 순서를 단일 진실로 정의)
+  - 상세: `_overview.md` §2 정의 표는 컬럼을 `... scope | paginated | restricted | status | docs` 순서로 열거한다 (`paginated` 다음에 `restricted` 가 온다). 그러나 이번 PR 에서 갱신된 4개 카탈로그 파일(mileage.md / notification.md / privacy.md / store.md) 은 모두 헤더를 `... scope | restricted | paginated | status | docs` 로 구현했다 (`restricted` 가 `paginated` 앞에 위치). `catalog-sync.spec.ts` 가 MD 표를 파싱하므로, 컬럼 순서가 두 곳에서 다르면 파서 구현 시 정의 표를 기준으로 삼을 것인지 실제 파일을 기준으로 삼을 것인지 혼동이 생기고, 향후 다른 resource 에 `restricted` 컬럼을 추가할 때 어느 순서를 따라야 할지 알 수 없다. _overview.md 가 single source of truth 임에도 실제 파일과 어긋나 있다.
+  - 제안: 정의 표와 실제 파일 중 하나를 기준으로 통일한다. 현재 4개 파일이 `scope | restricted | paginated` 순서를 사용하고 있으므로, `_overview.md` §2 의 정의 표에서 `paginated` 행과 `restricted` 행의 순서를 뒤바꿔 `scope → restricted → paginated → status → docs` 로 맞추는 것이 최소 수정이다. 변경 후 CHANGELOG에도 기록한다.
+
+- **[WARNING]** `_overview.md` §5 Coverage Matrix 기준 날짜가 갱신되지 않음
+  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §5 "Coverage Matrix" 첫 줄
+  - 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md` §5 자체 규칙 — "row 추가/삭제 시 본 표도 손으로 갱신한다"
+  - 상세: §5 에 "2026-05-16 기준" 이라고 명시되어 있으나, 이번 PR(2026-05-17) 에서 `restricted` 컬럼을 mileage / notification / privacy / store 4개 파일의 헤더에 추가했다. row 수는 변동이 없더라도 표의 의미론적 내용(restricted 컬럼 추가)은 변경되었으므로 기준 날짜를 2026-05-17 로 갱신하는 것이 일관성에 부합한다. 기준 날짜가 오래된 상태로 남으면 독자가 매트릭스의 최신성을 신뢰할 수 없다.
+  - 제안: `_overview.md` §5 첫 줄의 "2026-05-16 기준" 을 "2026-05-17 기준" 으로 갱신한다.
+
+- **[WARNING]** `cafe24-restricted-scopes.md` 에 `## Overview` 섹션 없음
+  - target 위치: `spec/conventions/cafe24-restricted-scopes.md` 문서 전체 구조
+  - 위반 규약: CLAUDE.md "프로젝트 스펙 문서" — "각 spec 문서는 권장 3섹션 구성을 따른다: 1. Overview(제품 정의) 2. 본문(스펙) 3. Rationale"
+  - 상세: 본 문서는 `## Rationale` 섹션(§110)과 `## CHANGELOG` 는 존재하지만 `## Overview` 섹션이 없다. 대신 도입부 단락이 제목 바로 아래에 비섹션화된 채 놓여 있다. 정식 규약 문서(`spec/conventions/*.md`)에 대해 CLAUDE.md 의 3섹션 권장은 규범적으로 적용되므로, 도입부를 `## Overview` 로 명시하거나 단일 파일 영역에서 본문 상단에 `## Overview` 를 두는 패턴을 따라야 한다.
+  - 제안: 도입부 단락(Cafe24 Admin API 설명 + "본 컨벤션은..." 문장)을 `## Overview` 섹션으로 감싼다. 단, `spec/conventions/*.md` 가 일반적으로 Overview 섹션 없이 바로 본문 번호 섹션으로 시작하는 기존 관례(node-output.md, swagger.md 등)를 따르고 있다면, 규약 자체를 갱신해 conventions 파일의 3섹션 의무를 명시적으로 면제하는 것도 대안이다.
+
+- **[WARNING]** 갱신된 resource 카탈로그 파일들에 `## Rationale` 섹션 없음
+  - target 위치: `spec/conventions/cafe24-api-catalog/mileage.md`, `notification.md`, `privacy.md`, `store.md` 의 전체 구조
+  - 위반 규약: CLAUDE.md "프로젝트 스펙 문서" — "각 spec 문서는 권장 3섹션 구성을 따른다 ... 3. Rationale — 결정의 배경·근거·폐기된 대안"
+  - 상세: 이번 PR 에서 4개 카탈로그 파일에 `restricted` 컬럼이 추가됐다. 해당 결정의 배경(왜 별도 컬럼인가, 왜 `status` enum 확장이 아닌가)은 `_overview.md` 와 `cafe24-restricted-scopes.md` Rationale 에 분산되어 있으나, 각 resource 파일 자체에는 없다. CLAUDE.md 권장 구조상 `## Rationale` 섹션을 두는 것이 바람직하다. 다만 resource 파일은 표(SoT) 자체가 본문의 전부인 성격이므로 `_overview.md` 의 Rationale 로 위임하는 구조도 허용될 수 있다 — 그 경우 각 resource 파일 상단에 "결정 근거: `_overview.md` §Rationale 참고" 형태의 주석이라도 두는 것이 권장된다.
+  - 제안: 각 resource 파일에 `## Rationale` 섹션을 추가하거나, 대신 "설계 근거는 [`_overview.md`](./_overview.md) 참고" 주석을 명시한다. 혹은 `_overview.md` 에 `## Rationale` 섹션(현재 없음)을 신설하고 resource 파일에서 참조한다.
+
+- **[INFO]** `_overview.md` 파일명이 CLAUDE.md 명명 컨벤션 표의 exact 패턴과 불일치
+  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` 파일명
+  - 위반 규약: CLAUDE.md "명명 컨벤션" — 언더스코어 prefix 파일은 `_product-overview.md` (영역의 제품 정의) 또는 `_layout.md` (영역 공통 레이아웃)만 예시로 명시
+  - 상세: `_overview.md` 는 CLAUDE.md 명명 규약 표에서 예시로 등장하는 `_product-overview.md` 나 `_layout.md` 와 다른 이름이다. 카탈로그 개요 문서이므로 `_product-overview.md` 보다는 `0-overview.md` (기술 아키텍처 개요) 패턴에 더 가깝다. 그러나 이 파일은 이번 PR 이전부터 존재하며, 파일명 변경 시 기존 참조 링크 전체를 갱신해야 하는 부담이 크다. 또한 기존 일관성 검토 세션(12_12_46) 에서 이미 허용된 패턴일 수 있다.
+  - 제안: 현재 파일명을 유지하되, CLAUDE.md 명명 컨벤션 표에 `spec/conventions/<하위폴더>/_overview.md` 패턴을 카탈로그형 conventions 의 허용 예외로 명시하거나, 향후 신설 시 `0-overview.md` 패턴을 따르도록 주석을 남긴다.
+
+- **[INFO]** `_overview.md` 에 `## Rationale` 섹션 없음 (CHANGELOG 만 존재)
+  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` 섹션 구조
+  - 위반 규약: CLAUDE.md "프로젝트 스펙 문서" — 권장 3섹션 중 Rationale 포함
+  - 상세: `_overview.md` 는 `## 7. CHANGELOG` 를 보유하나 `## Rationale` 이 없다. 설계 결정 근거(왜 18 resource 분리인지, 왜 양방향 동기 테스트인지 등)는 CHANGELOG 안에 일부 서술되어 있으나 전용 Rationale 섹션으로 구분되어 있지 않다.
+  - 제안: 기존 CHANGELOG 직전에 `## Rationale` 섹션을 신설하고, CHANGELOG 에 산재된 결정 배경 서술을 이동하거나 요약한다. 또는 `cafe24-restricted-scopes.md` 의 Rationale 에서 이미 충분히 다뤄진 내용은 링크로 위임해도 무방하다.
+
+---
+
+### 요약
+
+`spec/conventions/cafe24-restricted-scopes.md` (신규) 와 `spec/conventions/cafe24-api-catalog/` 4개 파일 갱신은 전반적으로 conventions 구조(SoT 분리, catalog-sync 연계, `restricted` 컬럼 도입)를 올바르게 따르고 있으나, **CRITICAL 1건**: `_overview.md` §2 의 컬럼 정의 순서(`paginated → restricted`)와 실제 4개 파일의 헤더 순서(`restricted → paginated`)가 역전되어 있어 single source of truth 원칙이 깨진다. 이 불일치는 `catalog-sync.spec.ts` 파서 구현 시 혼동을 야기하고 향후 다른 resource 파일에 `restricted` 컬럼 추가 시 어느 순서를 따라야 할지 명확하지 않게 만든다. WARNING 3건(Coverage Matrix 날짜 미갱신, cafe24-restricted-scopes.md 의 Overview 섹션 누락, 갱신된 resource 파일의 Rationale 섹션 부재)은 규약 준수 의도가 명확하므로 빠른 보정이 가능하다. INFO 2건은 기존 관행과의 minor 불일치로 긴급도 낮음.
+
+---
+
+### 위험도
+
+MEDIUM

```

---

### 파일 50: review/consistency/2026/05/17/12_37_41/cross_spec.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/17/12_37_41/cross_spec.md b/review/consistency/2026/05/17/12_37_41/cross_spec.md
new file mode 100644
index 00000000..602f9d9d
--- /dev/null
+++ b/review/consistency/2026/05/17/12_37_41/cross_spec.md
@@ -0,0 +1,57 @@
+# Cross-Spec 일관성 검토 결과
+
+**검토 대상**: `spec/conventions/` (주 초점: `cafe24-restricted-scopes.md` + `cafe24-api-catalog/` 의 `restricted` 컬럼 관련 변경)
+**검토 모드**: `--impl-prep` (구현 착수 전)
+**검토일**: 2026-05-17
+
+---
+
+### 발견사항
+
+- **[WARNING]** `requiresCafe24Approval` 교집합 범위: §1(scope 단위) vs 전체 명단
+  - target 위치: `cafe24-restricted-scopes.md §4.3` — "요청한 scopes ∩ 본 명단 **§1** 의 교집합"
+  - 충돌 대상: `spec/2-navigation/4-integration.md §9.4` (INSUFFICIENT_SCOPE 행) — "`missingScopes` ∩ **§1** 의 교집합"; `spec/2-navigation/4-integration.md §10.4` (Cafe24 `invalid_scope` 행) — "요청 scopes ∩ **§1** 의 교집합"; `spec/1-data-model.md §2.10` `last_error` 설명 — "§1 의 교집합"
+  - 상세: 세 문서 모두 §1(scope 단위 제한 — mileage/notification/privacy) 과의 교집합만 `requiresCafe24Approval` 에 채운다고 명시한다. 그러나 §2(operation 단위 — store 의 activitylogs, menus, PG settings 등) 는 scope 레벨이 아닌 operation 레벨이므로 OAuth `invalid_scope` 에서는 이론상 scope 키가 아니라 operation 호출 시 403으로 감지된다. 따라서 §2 항목이 `requiresCafe24Approval` 에 들어가지 않는 이유가 스펙 본문에 **명시적으로 서술되어 있지 않다**. 구현자는 "왜 §1만?" 을 추론해야 한다.
+  - 제안: `cafe24-restricted-scopes.md §4.3` 에 "§2(operation 단위) 는 scope 자체는 일반 승인 가능하므로 OAuth `invalid_scope` 단계에서 탐지되지 않는다 — `INSUFFICIENT_SCOPE (403)` 에서만 감지되며, 해당 시점의 `requiresCafe24Approval` 는 §1·§2 모두 포함한다" 는 한 줄 보충 권장.
+
+- **[WARNING]** `INSUFFICIENT_SCOPE (403)` 의 `requiresCafe24Approval` 교집합 범위 불일치
+  - target 위치: `cafe24-restricted-scopes.md §4.3` — "노드 실행 중 `INSUFFICIENT_SCOPE (403)`: 누락 scope ∩ 본 명단의 교집합" (명단 전체, §1·§2 모두)
+  - 충돌 대상: `spec/2-navigation/4-integration.md §9.4` — "`missingScopes` ∩ **§1** 의 교집합"
+  - 상세: `cafe24-restricted-scopes.md §4.3` 는 403 케이스에서 "본 명단" (§1 + §2 전체)과의 교집합을 `requiresCafe24Approval` 에 기록한다고 서술한다. 반면 `4-integration.md §9.4` 는 `missingScopes ∩ §1 의 교집합` 이라고 §1만 언급한다. 이 표현 차이가 구현 의도와 다른 동작을 낳을 수 있다(§2 operation 에 해당하는 store scopes 는 operation 레벨이어서 `missingScopes` 자체에 scope 문자열로 들어오지 않지만, 차후 §2 항목이 scope 레벨로 변경되거나 새 resource 가 §2에 추가되면 두 기술이 달리 해석된다).
+  - 제안: `spec/2-navigation/4-integration.md §9.4` 의 `requiresCafe24Approval` 설명을 "§1 의 교집합" → "본 명단 §1·§2 와의 교집합 — 단, scope 기준이므로 §2(operation 단위) 항목의 scope(`mall.read_store`/`mall.write_store`)는 제한 없이 승인되므로 일반적으로 빈 교집합" 으로 보강한다.
+
+- **[WARNING]** `oauth_invalid_scope` 상태 보존 규칙과 state machine 표현 간 기술 불일치
+  - target 위치: `cafe24-restricted-scopes.md §4.3` — "status 는 `pending_install` 그대로 유지하여 사용자가 다시 시도 가능"
+  - 충돌 대상: `spec/2-navigation/4-integration.md §6` 상태 전이 다이어그램 — `pending_install → pending_install (callback 실패 보존)` 행
+  - 상세: 두 문서 모두 `pending_install` 보존을 명시하므로 내용 충돌은 없다. 그러나 `4-integration.md §6` 의 상태 전이 다이어그램 주석(`pending_install → pending_install` 행)이 `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired` 세 코드만 열거하고 `oauth_invalid_scope` 는 누락하고 있다(`spec/1-data-model.md §2.10` 에는 `oauth_invalid_scope` 가 추가되었으나 `4-integration.md §6` 다이어그램에는 반영 미완).
+  - 제안: `spec/2-navigation/4-integration.md §6` 의 `pending_install → pending_install` 상태 전이 행에 `oauth_invalid_scope` 를 추가 열거한다.
+
+- **[INFO]** `cafe24-api-catalog/_overview.md §4` 검증 규칙 8 — `level='scope'`/`'operation'` 매핑 표현
+  - target 위치: `cafe24-api-catalog/_overview.md §4` 검증 규칙 8 — "`scope` ↔ `level='scope'`, `op` ↔ `level='operation'`"
+  - 충돌 대상: `spec/conventions/cafe24-api-metadata.md §2` `category` 테이블 — 동일 내용을 훨씬 더 상세히 기술
+  - 상세: 두 문서의 매핑 자체는 일치한다. 다만 `_overview.md §4` 는 `category` 필드의 의미를 전혀 언급하지 않아 메타데이터의 `restrictedApproval.category` 가 검증 대상인지 아닌지 모호하다. `catalog-sync.spec.ts` 구현 시 `category` 필드까지 검증 대상인지 판단하기 어렵다.
+  - 제안: `_overview.md §4` 검증 규칙 8에 "`category` 필드는 sync 검증 대상에서 제외 (값의 의미는 `cafe24-api-metadata.md §2` 참조)" 한 줄 추가.
+
+- **[INFO]** `cafe24-restricted-scopes.md §3` `level='program'` 카탈로그 제외 정책 — 중복 기술
+  - target 위치: `cafe24-restricted-scopes.md §3` — "`restrictedApproval.level='program'` 인 row 는 catalog 의 `restricted` 컬럼 정합성 검증 대상에서 제외"
+  - 충돌 대상: `cafe24-api-catalog/_overview.md §4` 검증 규칙 8 — 동일 예외 정책 기술; `cafe24-api-metadata.md §2` `restrictedApproval` 의미 항 — 동일 내용 반복
+  - 상세: 동일 정책이 세 파일에 중복 기술되어 있다. 모순 자체는 없으나 한 곳을 수정할 때 다른 두 곳도 수동 동기해야 하는 유지보수 부담이 있다.
+  - 제안: 정책의 canonical 위치를 `cafe24-api-catalog/_overview.md §4` 검증 규칙 8 으로 고정하고 나머지 두 문서는 해당 항 링크로 대체한다 (중요도 낮음 — 삼중 기술이라 실수가 드러나기 쉬워 즉시 수정 불요).
+
+- **[INFO]** `cafe24-restricted-scopes.md §2` — `paymentmethods_list` / `paymentmethods_paymentproviders_list` 미확정
+  - target 위치: `cafe24-restricted-scopes.md Rationale "Trade-off"` — "빈칸 유지, 향후 확인 시 갱신"
+  - 충돌 대상: `spec/conventions/cafe24-api-catalog/store.md` — 동 두 operation 에 `restricted` 컬럼이 빈칸(일반 사용 가능으로 표시)
+  - 상세: 모순은 없다. 단 `store.md` 주석("`paymentmethods_list` / `paymentmethods_paymentproviders_list` / `paymentmethods_paymentproviders_update_display` 는 사용자 자료에 명시되지 않아 빈칸 유지")과 `cafe24-restricted-scopes.md` Rationale의 설명이 내용상 일치하므로, `store.md` 에서 이미 해당 주석을 적고 있어 양쪽 관리가 필요한 정보가 분산된 상태다.
+  - 제안: `store.md` 의 주석을 `cafe24-restricted-scopes.md §2` 로 cross-reference 로 단순화해 동기 포인트를 하나로 줄이는 것을 고려한다.
+
+---
+
+### 요약
+
+`spec/conventions/cafe24-restricted-scopes.md` 는 신규 컨벤션으로 기존 `spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/conventions/cafe24-api-metadata.md`, `cafe24-api-catalog/_overview.md` 와의 참조가 전반적으로 잘 정합되어 있다. CRITICAL 수준의 직접 모순은 없다. 발견된 WARNING 2건은 모두 `requiresCafe24Approval` 의 교집합 범위에 대한 §1-only vs 명단-전체 표현 불일치로, 구현자가 두 문서를 동시에 읽지 않으면 잘못 구현할 가능성이 있다. 특히 `INSUFFICIENT_SCOPE (403)` 케이스에서 `4-integration.md §9.4` 가 §1만 언급한다는 점은 §2 operation들의 403 응답에서 `requiresCafe24Approval` 를 채워야 하는지 여부를 모호하게 만든다. 나머지 WARNING 1건(상태 전이 다이어그램의 `oauth_invalid_scope` 누락)과 INFO 3건은 문서 간 동기 미완 또는 중복 기술 사항으로 구현에 직접 영향은 없으나 정비를 권장한다.
+
+---
+
+### 위험도
+
+MEDIUM

```

---

### 파일 51: review/consistency/2026/05/17/12_37_41/meta.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/17/12_37_41/meta.json b/review/consistency/2026/05/17/12_37_41/meta.json
new file mode 100644
index 00000000..0b444715
--- /dev/null
+++ b/review/consistency/2026/05/17/12_37_41/meta.json
@@ -0,0 +1,12 @@
+{
+  "timestamp": "2026-05-17T12:37:41.515312",
+  "mode": "구현 착수 전 검토 (--impl-prep, scope=spec/conventions/)",
+  "target_path": "spec/conventions/",
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

### 파일 52: review/consistency/2026/05/17/12_37_41/naming_collision.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/17/12_37_41/naming_collision.md b/review/consistency/2026/05/17/12_37_41/naming_collision.md
new file mode 100644
index 00000000..1dec079b
--- /dev/null
+++ b/review/consistency/2026/05/17/12_37_41/naming_collision.md
@@ -0,0 +1,74 @@
+# 신규 식별자 충돌 검토 결과
+
+검토 모드: 구현 착수 전 (--impl-prep)
+검토 대상: `spec/conventions/` — `cafe24-restricted-scopes.md` 신규 컨벤션 + `cafe24-api-catalog/_overview.md` §2·§4 개정 + `mileage.md` / `notification.md` / `privacy.md` / `store.md` 표 헤더·row 갱신
+
+---
+
+### 발견사항
+
+- **[CRITICAL]** `catalog-sync.spec.ts` 의 9-cell 파서가 10-column 표를 잘못 파싱
+  - target 신규 식별자: `restricted` 컬럼 (catalog 표에 6번째 열로 삽입 — `scope` 다음, `paginated` 앞)
+  - 기존 사용처: `backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts` 의 `parseCatalogFile()` 함수 (lines 86-97). `cells.length < 9` 기준으로 행을 건너뛰고, 9개 셀을 고정 순서로 destructure 한다 (`[idCell, labelKoCell, englishTitleCell, methodCell, pathCell, scopeCell, paginatedCell, statusCell, docsCell]`).
+  - 상세: `mileage.md` / `notification.md` / `privacy.md` / `store.md` 표는 이제 10컬럼(`id | 라벨 | English title | method | path | scope | restricted | paginated | status | docs`)이다. 기존 파서는 7번째 셀(index 6)을 `paginatedCell`로 읽는데, 신규 포맷에서 index 6은 `restricted` 값(`scope` / `op` / 빈칸)이다. 결과적으로 `paginated` 컬럼이 `statusCell`에, `status` 컬럼이 `docsCell`에 할당된다. `paginated` 값인 `✓` 또는 공백이 status 로 파싱되면 `VALID_STATUSES` 검사(`supported | planned | deprecated`)를 통과하지 못해 테스트가 오작동하거나, 이 4개 catalog 파일의 supported rows가 전부 누락 판정될 수 있다. 더 위험한 것은 `cells.length < 9` 조건 자체는 10-column 행을 통과시키므로 파싱이 조용히 진행되어 오염된 데이터로 검증이 실행될 수 있다는 점이다. `_overview.md` §4 검증 규칙 8(`restricted` 컬럼 ↔ `restrictedApproval` 동기)도 파서 미갱신으로 인해 실제로는 수행되지 않는다.
+  - 제안: `catalog-sync.spec.ts` 의 `CatalogRow` 인터페이스에 `restricted?: 'scope' | 'op' | ''` 필드를 추가하고, `parseCatalogFile()` 를 10-column 표도 파싱할 수 있도록 개정한다. 간단한 접근: 헤더 행에서 컬럼 이름을 읽어 동적으로 인덱스를 매핑하거나, `cells.length >= 10` 분기를 두어 `restricted` 셀을 skip-파싱한다. 또한 규칙 8 검증 로직(`restricted` ↔ `metadata.restrictedApproval` 양방향)을 실제로 구현하여 명세와 동기화한다.
+
+---
+
+- **[WARNING]** store.md 내 `privacy_*` operation id 접두사와 `privacy` resource 명 혼동 가능
+  - target 신규 식별자: store 카탈로그에 등재된 `privacy_boards_get`, `privacy_boards_update`, `privacy_join_get`, `privacy_join_update`, `privacy_orders_get`, `privacy_orders_update` (6건, 모두 `planned`)
+  - 기존 사용처: `spec/conventions/cafe24-api-catalog/privacy.md` — Cafe24 Privacy (개인정보) resource 카탈로그. 본 resource 의 operation id는 `customers_privacy_get`, `customers_privacy_list`, `customers_privacy_count`, `customers_privacy_update`, `products_wishlist_customers_list`, `products_wishlist_customers_count` 이다. `privacy` 가 resource 이름으로도 사용된다 (`Cafe24Resource` enum 값 `'privacy'`).
+  - 상세: catalog id 고유성은 resource 파일 내에서만 보장된다(규칙 6: resource 내 unique). `privacy_boards_get` 등이 `store.md` 안에 있고 `privacy.md` 안에는 없으므로 기술적 충돌은 아니다. 그러나 `privacy_` 접두사는 관례적으로 `privacy` resource 의 operation을 연상시키고, Cafe24 공식 docs에서도 해당 endpoint는 Store resource 하위의 "개인정보 정책" 관련 sub-resource(경로: `store/boards/privacy`, `store/join/privacy`, `store/orders/privacy`) 이다. 개발자가 `privacy_*` ID를 보면 `privacy.md` 를 먼저 찾을 가능성이 높아 메타데이터 탐색 시 혼동이 생긴다.
+  - 제안: store 카탈로그 내 privacy 정책 관련 operation id 를 `store_privacy_boards_get`, `store_privacy_boards_update` 등 `store_` prefix를 명시하거나, `policy_boards_get` / `policy_join_get` 등 별개 용어를 사용하는 방향으로 재명명을 검토한다. 현재는 `planned` status이므로 변경 영향이 작다.
+
+---
+
+- **[WARNING]** `category` 필드명이 `restrictedApproval` 내부에 재사용 — 기존 `Cafe24Resource` enum 값과 혼동 가능
+  - target 신규 식별자: `Cafe24OperationMetadata.restrictedApproval.category` 필드 (`cafe24-api-metadata.md` §2 에 정의). 값: `'mileage' | 'notification' | 'privacy' | 'activitylogs' | 'menus' | 'naverpay_setting' | 'kakaopay_setting' | 'pg_settings' | 'analytics'`
+  - 기존 사용처: `backend/src/nodes/integration/cafe24/metadata/types.ts` 의 `Cafe24Resource` type — `'category'` 가 멤버로 존재 (Category 상품분류 resource). `CAFE24_RESOURCE_LABELS['category'] = 'Category (상품분류)'`. `Node.category` 엔티티 필드도 `logic | flow | ai | integration | data | presentation` enum.
+  - 상세: `restrictedApproval.category` 의 실제 값 집합에는 `'category'` 가 없으므로 런타임 충돌은 없다. 그러나 `category` 필드 이름 자체가 세 곳(`Cafe24Resource` 타입, `Node.category`, `restrictedApproval.category`)에서 각기 다른 의미로 쓰인다. `Cafe24OperationMetadata` 타입 내에서 `category` 는 "승인 묶음 식별자"를 의미하는데, 같은 파일 내에서 `scopeType` 이 `category` 충돌 우려로 이미 `category` 대신 쓴 사례(`types.ts` 주석: `scopeType (not category) intentionally — avoids collision with Node.category enum`)가 있다. `restrictedApproval.category` 는 다른 인터페이스의 서브필드라 직접 충돌은 아니지만, 일관성 차원에서 `approvalGroup` 또는 `approvalCategory` 처럼 더 구체적인 이름이 혼동 예방에 유리하다.
+  - 제안: `restrictedApproval.category` 를 `restrictedApproval.approvalGroup` 으로 재명명하는 것을 고려한다. 현재는 `cafe24-api-metadata.md` spec에만 정의되어 있고 backend 코드에 아직 반영되지 않아 변경 비용이 낮다.
+
+---
+
+- **[WARNING]** `restricted` 컬럼 값 `op` — `_overview.md` 와 `store.md` 간 표기 불일치 가능성
+  - target 신규 식별자: catalog `restricted` 컬럼의 값 `op`(`_overview.md` §2 정의: `op` = 본 row 만 단독 승인 대상), `scope` = resource 전체 영향
+  - 기존 사용처: `_overview.md` §2 컬럼 설명 에는 `scope` / `op` / 빈칸 세 값만 명시. `store.md` 표에서도 동일하게 사용.
+  - 상세: `cafe24-api-metadata.md` §2 의 `restrictedApproval.level` 은 `'scope' | 'operation' | 'program'` 이고, catalog 의 `restricted` 컬럼 값은 `scope` / `op` / 빈칸이다. 매핑: `scope` ↔ `level='scope'`, `op` ↔ `level='operation'`. 값이 동일하지 않다 — catalog 는 `op`을, 메타데이터는 `operation`을 쓴다. `_overview.md` §4 규칙 8에 매핑이 명시되어 있으나, `parseCatalogFile()`이 `restricted` 컬럼을 아직 파싱하지 않으므로 동기 검증이 실제로 수행되지 않는다. 개발자가 메타데이터 level 값을 `op`으로 쓰는 실수가 생길 수 있다.
+  - 제안: catalog `restricted` 컬럼 값을 `operation`으로 통일하거나, 메타데이터 `level` 값을 `op`로 단축하는 방향 중 하나로 정렬한다. 현재처럼 상이한 표기가 유지된다면 `_overview.md` §4 규칙 8의 매핑 표 (`scope` ↔ `level='scope'`, `op` ↔ `level='operation'`)를 자동 검증하는 linting 또는 catalog-sync 규칙을 즉시 구현해야 drift를 막을 수 있다.
+
+---
+
+- **[INFO]** `cafe24-restricted-scopes.md` 파일 경로 — 기존 컨벤션 파일 명명 패턴과 일치
+  - target 신규 식별자: `spec/conventions/cafe24-restricted-scopes.md`
+  - 기존 사용처: `spec/conventions/cafe24-api-metadata.md`, `spec/conventions/cafe24-api-catalog/` (디렉토리), `spec/conventions/conversation-thread.md`, `spec/conventions/migrations.md`, `spec/conventions/node-output.md`, `spec/conventions/swagger.md`
+  - 상세: `cafe24-` prefix 패턴이 `cafe24-api-metadata.md`, `cafe24-api-catalog/` 와 일관된다. 기존 파일과 이름이 겹치지 않으며 파일 경로 충돌은 없다. 신규 파일이 다수의 기존 문서(`1-data-model.md`, `2-navigation/4-integration.md`, `4-nodes/4-integration/4-cafe24.md`, `cafe24-api-metadata.md`, `cafe24-api-catalog/_overview.md`)에서 앵커 링크로 참조되고 있어 링크 타깃이 존재하는지 확인이 필요하다. 실제 파일은 이미 생성되어 있으므로 링크 누락 위험은 없다.
+  - 제안: 추가 조치 불필요. 참고로 `spec/conventions/` 내 `cafe24-` prefix 파일이 세 번째로 추가되는 것이므로, 향후 더 늘어날 경우 `cafe24-api-catalog/` 처럼 별도 디렉토리로 묶는 것을 고려할 수 있다.
+
+---
+
+- **[INFO]** `oauth_invalid_scope` status_reason 값 — 기존 status_reason enum 에 추가
+  - target 신규 식별자: `Integration.status_reason = 'oauth_invalid_scope'` (2026-05-17 추가)
+  - 기존 사용처: `spec/1-data-model.md §2.10` 의 `status_reason` 값 목록 — `insufficient_scope`, `auth_failed`, `network`, `unknown`, `token_expired`, `install_timeout`, `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`. `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 에 `reason: 'auth_failed' | 'insufficient_scope'` 타입 사용.
+  - 상세: `oauth_invalid_scope` 는 기존 값과 겹치지 않으며 snake_case 규칙을 준수한다. `oauth_` prefix 패턴이 `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired` 와 일관된다. 충돌 없음.
+  - 제안: backend 코드(`integration.entity.ts` 등)에서 `status_reason` 타입 유니온에 `'oauth_invalid_scope'` 를 추가할 때 기존 `'insufficient_scope'` 와 의미를 명확히 구분하는 주석을 달 것을 권장한다 (`oauth_invalid_scope` = OAuth 단계에서 scope 거부, `insufficient_scope` = 노드 실행 중 403).
+
+---
+
+- **[INFO]** `requiresCafe24Approval` — `last_error.details` 의 신규 키
+  - target 신규 식별자: `Integration.last_error.details.requiresCafe24Approval: string[]`
+  - 기존 사용처: `spec/1-data-model.md §2.10` `last_error` JSONB 스키마 — `{ code, message, at, details? }`. `details` 는 `Record<string, unknown>`. 기존에 정의된 다른 `details` 키는 별도 명시 없음(자유 형식).
+  - 상세: 기존 `details` 키와 겹치지 않으며 camelCase 규칙을 준수한다. 충돌 없음.
+  - 제안: 추가 조치 불필요.
+
+---
+
+### 요약
+
+신규 식별자 충돌 관점에서 가장 심각한 문제는 `catalog-sync.spec.ts` 파서가 10-column 표를 파싱하지 못하도록 하드코딩되어 있다는 점이다 (CRITICAL). `restricted` 컬럼이 `mileage` / `notification` / `privacy` / `store` 4개 카탈로그에 삽입됨으로써 기존 9-cell 파서는 `paginated`, `status`, `docs` 셀을 각각 한 칸씩 오판독하게 되어, 해당 resource의 supported row 동기 검증이 전부 비정상 작동한다. `_overview.md` §4 규칙 8로 명세된 `restricted` ↔ `restrictedApproval` 양방향 동기 검증도 파서 미갱신으로 실제로는 수행되지 않는 상태다. WARNING 3건은 `privacy_*` 접두사 혼동, `category` 필드명 중복 사용, `op` vs `operation` 표기 비일관성으로, 즉각 오류를 유발하지는 않으나 코드 작성 및 명세 해석 시 혼란 소지가 있다. 새 파일 경로(`cafe24-restricted-scopes.md`)와 신규 status_reason 값(`oauth_invalid_scope`), details 키(`requiresCafe24Approval`)는 기존 식별자와 충돌하지 않는다.
+
+### 위험도
+
+**HIGH**
+
+> CRITICAL 1건(`catalog-sync.spec.ts` 파서 10-column 미지원)이 테스트 무결성을 직접 훼손한다. 이 상태로 구현을 진행하면 `catalog-sync` 테스트가 4개 resource의 `restricted` 승인 동기 여부를 실제로 검증하지 못한 채 통과하여, 메타데이터 미갱신 상태가 CI에서 걸러지지 않는다.

```

---

### 파일 53: review/consistency/2026/05/17/12_37_41/plan_coherence.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/17/12_37_41/plan_coherence.md b/review/consistency/2026/05/17/12_37_41/plan_coherence.md
new file mode 100644
index 00000000..772b222f
--- /dev/null
+++ b/review/consistency/2026/05/17/12_37_41/plan_coherence.md
@@ -0,0 +1,27 @@
+### 발견사항
+
+- **[INFO]** target 작업에 대응하는 plan 문서 부재
+  - target 위치: `spec/conventions/` 전반 — `cafe24-restricted-scopes.md` 신규 생성 + `cafe24-api-catalog/_overview.md` §2·§4·§7 갱신 + `mileage.md` / `notification.md` / `privacy.md` / `store.md` 표 헤더·row `restricted` 컬럼 추가
+  - 관련 plan: `plan/in-progress/` 어디에도 `cafe24-restricted-scopes-a1b2c3` worktree 를 frontmatter `worktree` 필드로 추적하는 plan 문서가 없음
+  - 상세: worktree `cafe24-restricted-scopes-a1b2c3` 에서 진행 중인 spec 갱신을 추적하는 plan 파일이 존재하지 않는다. CLAUDE.md 규약에 따르면 `plan/in-progress/<name>.md` 상단에 `worktree: <task_name>-<slug>` frontmatter 를 명시해야 한다.
+  - 제안: `plan/in-progress/cafe24-restricted-scopes-a1b2c3.md` (또는 유사한 이름)를 생성해 본 worktree 와 작업 범위를 등록한다. 작업 완료 후 `plan/complete/` 로 `git mv`.
+
+- **[INFO]** `cafe24-backlog-residual.md` 의 미해소 항목과 target 영역 간 간접 관련성
+  - target 위치: `spec/conventions/cafe24-api-catalog/store.md` — `paymentgateway_paymentmethods_list` row 가 `restricted: op` 로 표기됨
+  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` §A-3 (install endpoint rate limiting), §D-1 (신규 에러 코드 Swagger 명시), §D-2 (BullMQ refresh 실패 정책 spec 명시)
+  - 상세: `cafe24-backlog-residual.md` 에는 cafe24 관련 미해소 항목이 다수 남아 있으나, 이번 target 변경(`restricted` 컬럼 추가 및 `cafe24-restricted-scopes.md` 신설) 은 해당 백로그 항목과 직접 충돌하거나 중복되지 않는다. 다만 `paymentgateway_paymentmethods_list` 는 Phase 6b 에서 이미 `supported` 로 승격된 row 이며, `store.md` 에 `restricted: op` 컬럼이 추가되었으므로 `catalog-sync.spec.ts` 검증 대상 범위가 확장된다. 백로그 §D-2 의 BullMQ refresh 실패 정책 spec 명시 작업은 `spec/4-nodes/4-integration/4-cafe24.md` 대상이므로 본 target 과 파일 충돌 없음.
+  - 제안: 추적 메모 수준. `cafe24-backlog-residual.md` 에 `restricted` 컬럼 및 `catalog-sync.spec.ts` 검증 규칙 8 신설 사실을 언급해 두면 다음 개발자가 컨텍스트를 파악하기 쉽다.
+
+- **[INFO]** `20260516-full-review/RESOLUTION.md` W-69 처리와 target 의 `store.md` 변경 간 관계
+  - target 위치: `spec/conventions/cafe24-api-catalog/store.md` — `restricted` 컬럼 추가 및 store 표 헤더 갱신
+  - 관련 plan: `plan/in-progress/20260516-full-review/RESOLUTION.md` W-69 (`spec/4-nodes/4-integration/4-cafe24.md §3/§4.2` cursor 제거)
+  - 상세: W-69 는 `4-cafe24.md` 를 수정했고, target 은 `cafe24-api-catalog/store.md` 를 수정한다. 두 파일은 다르므로 직접 충돌 없음. 단, `4-cafe24.md` 와 `cafe24-api-catalog/_overview.md` 모두 `cafe24-restricted-scopes.md` 를 cross-link 하므로, 해당 링크가 RESOLUTION 작업 worktree (`full-review-fixes-a1b2c3`) 에서 이미 처리된 `spec/4-nodes/4-integration/4-cafe24.md` 파일에 영향을 미치는지 확인이 필요하다. `_overview.md` §7 CHANGELOG 의 2026-05-17 항목이 consistency-check 세션(`review/consistency/2026/05/17/12_12_46/`) 을 참조한다.
+  - 제안: 추적 메모 수준. `full-review-fixes-a1b2c3` worktree 가 이미 main 에 merge 되었는지, 혹은 아직 PR 중인지 확인해 둘 것.
+
+### 요약
+
+이번 target(`spec/conventions/` 하위 `cafe24-restricted-scopes.md` 신설 및 4개 카탈로그 파일 `restricted` 컬럼 추가)은 현재 `plan/in-progress/` 의 어떤 plan 과도 직접 충돌하거나 선행 조건을 위반하지 않는다. 미해결 결정 우회(CRITICAL)나 worktree 간 동일 파일 동시 수정(CRITICAL)은 발견되지 않았다. 단, 본 작업을 추적하는 plan 문서(frontmatter `worktree: cafe24-restricted-scopes-a1b2c3` 포함)가 부재하므로 CLAUDE.md 규약 위반 상태이며, 이를 INFO 로 기록한다. `cafe24-backlog-residual.md` 의 미해소 항목 및 `full-review-fixes-a1b2c3` 의 관련 변경과 간접적으로 연결되지만 실질적 충돌 위험은 없다.
+
+### 위험도
+
+LOW

```

---

### 파일 54: review/consistency/2026/05/17/12_37_41/rationale_continuity.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/17/12_37_41/rationale_continuity.md b/review/consistency/2026/05/17/12_37_41/rationale_continuity.md
new file mode 100644
index 00000000..ce6705f6
--- /dev/null
+++ b/review/consistency/2026/05/17/12_37_41/rationale_continuity.md
@@ -0,0 +1,42 @@
+# Rationale 연속성 검토 결과
+
+검토 대상: `spec/conventions/` (cafe24-restricted-scopes 작업 — impl-prep)
+검토 기준 Rationale: `spec/2-navigation/4-integration.md §Rationale — Cafe24 별도 승인 scope 의 식별·안내 (2026-05-17)`
+
+---
+
+### 발견사항
+
+이번 검토에서 CRITICAL 또는 WARNING 등급의 Rationale 연속성 위반은 발견되지 않았다. 아래는 검토 과정에서 확인된 정합 사항과 INFO 수준 보완 제안이다.
+
+- **[INFO]** `restricted` 컬럼 순서 — `_overview.md §2` 기재 순서와 개별 파일 헤더 일치 여부
+  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md §2` 컬럼 표 (restricted 항목 기술), 개별 파일 mileage/notification/privacy 표 헤더
+  - 과거 결정 출처: Rationale "Cafe24 별도 승인 scope 의 식별·안내" — `restricted` 컬럼을 `status` 와 직교하는 별도 컬럼으로 정의
+  - 상세: `_overview.md §2` 의 컬럼 나열 순서는 `scope | paginated | restricted | status | docs` 순이지만(표에서 paginated 뒤에 restricted 기재), mileage/notification/privacy/store 파일의 실제 테이블 헤더는 `scope | restricted | paginated | status` 순서를 사용한다. 두 표현이 컬럼 기재 순서에서 미묘하게 다르다. 의미 충돌은 아니며 파싱·동기 테스트는 컬럼 이름 기반이므로 순서 차이가 runtime 오류를 유발하지는 않는다. 그러나 사람이 새 카탈로그 파일을 추가할 때 _overview.md 를 참조 표준으로 쓴다면 순서 혼동이 생길 수 있다.
+  - 제안: `_overview.md §2` 컬럼 표의 순서를 실제 파일들의 헤더 순서(`scope | restricted | paginated`)와 맞추거나, 반대로 파일들의 헤더를 _overview.md 기준(`scope | paginated | restricted`)으로 통일한다. 어느 쪽이든 한 방향으로 통일하면 충분하다.
+
+---
+
+### Rationale 정합 확인 사항 (위반 없음)
+
+1. **기각 대안 C (status enum 확장) 미채택 확인**: `_overview.md §2` 가 "이 컬럼은 `status` 와 직교하며 `status` 의 값이 아니다 — `supported` + `restricted: op` 조합이 정상이다" 를 명시하여, Rationale 에서 기각한 "catalog `status` enum 확장" 대안을 재도입하지 않았다. 정합.
+
+2. **기각 대안 A (차단 정책) 미채택 확인**: 카탈로그의 `restricted` 컬럼은 안내 데이터(WarningBadge·tooltip 렌더 재료)로 설계되어 있으며, 차단 동작을 카탈로그 spec 자체에 포함하지 않는다. Rationale 의 "차단 없음, 안내만" 원칙과 일치.
+
+3. **기각 대안 B (신규 에러 코드 추가) 미채택 확인**: 카탈로그 파일에 새 에러 코드 정의가 없다. 에러 경로는 기존 `INSUFFICIENT_SCOPE(403)` + `details.requiresCafe24Approval` 보강 필드 경로를 사용하는 Rationale 결정과 충돌하지 않는다.
+
+4. **동기 규칙 8 신설**: `_overview.md §4` 의 검증 규칙 8 (`restricted` 컬럼 ↔ 메타데이터 `restrictedApproval` 동기)은 Rationale 에 명시된 "backend 메타데이터의 `restrictedApproval` 필드와 catalog 의 `restricted` 컬럼을 SoT 로" 결정의 직접 구현이다. `level='program'` 메타데이터 row 를 카탈로그 검증 대상에서 제외한 것도 Rationale 의 "별도 트랙 (Analytics 등)" 처리와 정합.
+
+5. **기존 Rationale 의 invariant (install_token / OAuth 흐름 / status machine 등)**: 이번 target 변경 (카탈로그 `restricted` 컬럼 추가) 은 OAuth 흐름·install_token·status machine 과 무관한 metadata 레이어 변경이다. 관련 invariant 를 우회하거나 충돌하는 내용 없음.
+
+---
+
+### 요약
+
+`spec/conventions/cafe24-api-catalog/` 의 `restricted` 컬럼 추가 및 개별 리소스 파일(mileage/notification/privacy/store) 갱신은 `spec/2-navigation/4-integration.md` Rationale "Cafe24 별도 승인 scope 의 식별·안내 (2026-05-17)" 의 결정을 충실히 구현하고 있으며, 해당 Rationale 에서 명시적으로 기각된 세 대안(A 차단 정책·B 신규 에러 코드·C status enum 확장) 중 어느 것도 재도입하지 않았다. 과거 결정의 직교 컬럼 원칙과 동기 테스트 규칙도 spec 본문에 명확히 반영되어 있다. 유일한 관찰 사항은 `_overview.md §2` 컬럼 나열 순서와 개별 파일 헤더 순서 사이의 표기 불일치(INFO 수준)로, 의미 충돌이나 테스트 오류를 유발하지는 않으나 사람이 신규 파일을 추가할 때 혼동을 방지하기 위해 통일을 권장한다.
+
+---
+
+### 위험도
+
+NONE

```

---

### 파일 55: spec/1-data-model.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/1-data-model.md b/spec/1-data-model.md
index acec8308..59b4a54a 100644
--- a/spec/1-data-model.md
+++ b/spec/1-data-model.md
@@ -253,12 +253,12 @@ Schedule은 Trigger의 서브타입이다. 양쪽의 라이프사이클과 상
 | install_token | String? | Cafe24 Private 앱 설치 흐름 식별 키. `oauth/begin (app_type=private)` 시 **16바이트를 `base64url` (no padding, 22자) 인코딩**해 발급. 통합 lifetime 동안 **보존** (post-install navigation 의 식별 키) — callback 성공 시 보존, `pending_install → expired (install_timeout)` 24h TTL 만료 또는 통합 삭제 시에만 NULL/소거. Cafe24 private 전용 — 다른 service_type 에서는 항상 NULL. **형식 변경 (2026-05-15)**: 옛 32바이트 hex (64자) 는 Cafe24 App URL 100자 한도 초과로 폐기 — 본 문서 Rationale 의 "install_token 형식" 항 참조. 정식 라이프사이클은 [Spec 통합 화면 §6 상태 전이](./2-navigation/4-integration.md#6-상태-전이) 와 [§9.2 API](./2-navigation/4-integration.md#92-인증--회전--scope) 및 Rationale "install_token TTL 24h" |
 | install_token_issued_at | Timestamp? | Cafe24 Private `install_token` 발급 시각. TTL 스캐너 (`pending-install-ttl` job) 가 `now - 24h` 와 비교해 만료 판단 — 초과 시 `status='expired', status_reason='install_timeout', install_token=NULL` 로 전이. 재사용/새 발급 시 갱신, **callback 성공 시 보존** (`install_token` 과 동행 — `spec/2-navigation/4-integration.md` Rationale "install_token TTL 24h" 참조). TTL 만료 / 통합 삭제 경로에서만 NULL 처리. 옛 (V044 이전) 행은 NULL → 스캐너가 `created_at` 으로 fallback 하여 동일 24h TTL 적용 (배포 직후 일괄 expired 처리 없음 — `created_at` 이 이미 24h 이상 지난 행만 자연스럽게 expired 됨). V044 추가 |
 | mall_id | String? | Cafe24 `mall_id` 의 plain projection — `credentials.mall_id` 와 동일 값을 plain 컬럼으로 복제. `(workspace_id, mall_id)` 부분 UNIQUE 인덱스가 SQL 레벨에서 중복 cafe24 통합을 거부하고, decrypt 없이 O(1) lookup 가능. cafe24 외 service_type 에서는 항상 NULL. 옛 (V045 이전) 행은 NULL — 다음 ORM save (callback / reauth) 시 backfill. **비즈니스 규칙**: 같은 workspace 내 같은 `mall_id` 의 cafe24 통합은 `app_type` 무관 최대 1행 — 한 mall 에 public·private 을 동시에 보유하면 토큰·webhook 처리 주체가 분기되어 사용자 혼란과 회계 충돌을 유발하므로 spec 차원에서 금지. Public App 지원 시 재검토 대상. V045 추가 |
-| status_reason | String? | 상태별 사유 코드 (모두 `snake_case`). `error` → `insufficient_scope` / `auth_failed` / `network` / `unknown` (현행) — `credentials_unreadable` 은 기존 분기로 정합성 유지. **(2026-05-16 갱신)** `auth_failed` 는 401/403 외에 refresh `invalid_grant` 도 포함 (옛 `expired(refresh_failed)` 가 본 사유로 이행 — REQ HIGH-2). `network` 는 transport 3회 연속 실패 카운터 (`consecutive_network_failures` 컬럼) 가 3 도달 시 전이. `expired` → `token_expired` (refresh_token 없는 provider 의 token_expires_at 만료) / `install_timeout` (Cafe24 Private 24h TTL). **`refresh_failed` 는 제거 — `error(auth_failed)` 로 이행 (REQ HIGH-2).** `pending_install` → callback 실패 분기 코드 (`oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`). `resource_not_found` 는 row 가 사라진 케이스라 DB 갱신 불가 → 후보값 제외 ([Spec 통합 화면 §10.4](./2-navigation/4-integration.md#104-에러-매핑)). `connected` → NULL. ※ DB 저장값은 `snake_case`, 동일 의미의 API 에러 코드는 `OAUTH_*` `UPPER_SNAKE_CASE` (의도적 분리) |
+| status_reason | String? | 상태별 사유 코드 (모두 `snake_case`). `error` → `insufficient_scope` / `auth_failed` / `network` / `unknown` (현행) — `credentials_unreadable` 은 기존 분기로 정합성 유지. **(2026-05-16 갱신)** `auth_failed` 는 401/403 외에 refresh `invalid_grant` 도 포함 (옛 `expired(refresh_failed)` 가 본 사유로 이행 — REQ HIGH-2). `network` 는 transport 3회 연속 실패 카운터 (`consecutive_network_failures` 컬럼) 가 3 도달 시 전이. `expired` → `token_expired` (refresh_token 없는 provider 의 token_expires_at 만료) / `install_timeout` (Cafe24 Private 24h TTL). **`refresh_failed` 는 제거 — `error(auth_failed)` 로 이행 (REQ HIGH-2).** `pending_install` → callback 실패 분기 코드 (`oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`, **`oauth_invalid_scope`** — 2026-05-17 추가, Cafe24 가 authorize/token exchange 단계에서 `invalid_scope` 응답을 돌려준 케이스. status 보존 + `last_error.details.requiresCafe24Approval` 동행 — 자세한 진입 경로·UI 분기는 [Spec 통합 화면 §10.4](./2-navigation/4-integration.md#104-에러-매핑) `Cafe24 invalid_scope` 행 + [`spec/conventions/cafe24-restricted-scopes.md §4.3`](./conventions/cafe24-restricted-scopes.md#43-에러-안내-에러-발생-후) 참고). `resource_not_found` 는 row 가 사라진 케이스라 DB 갱신 불가 → 후보값 제외 ([Spec 통합 화면 §10.4](./2-navigation/4-integration.md#104-에러-매핑)). `connected` → NULL. ※ DB 저장값은 `snake_case`, 동일 의미의 API 에러 코드는 `OAUTH_*` `UPPER_SNAKE_CASE` (의도적 분리) |
 | consecutive_network_failures | int | 노드 실행 / 토큰 갱신 중 transport 실패 카운터. 성공 시 0 으로 리셋, 3 도달 시 `status='error', status_reason='network'` 로 전이 + 카운터 0 리셋. spec §6 `connected → error(network)` 전이의 구현 기반. V049 추가 (PR #67 REQ-C2). NOT NULL DEFAULT 0 — 기존 행은 0 으로 backfill |
 | token_expires_at | Timestamp? | 토큰 만료 시각 (OAuth) |
 | last_used_at | Timestamp? | 마지막 노드 실행에서 사용된 시각 (캐시) |
 | last_rotated_at | Timestamp? | 자격 증명 마지막 회전 시각 (OAuth 재인증 또는 비OAuth 교체) |
-| last_error | JSONB? | 최근 호출 실패의 요약 `{ code, message, at }` |
+| last_error | JSONB? | 최근 호출 실패의 요약 `{ code, message, at, details? }`. `details` 는 자유 형식 `Record<string, unknown>` 으로 사유 별 추가 컨텍스트를 담는다 (예: `oauth_invalid_scope` 에서 `details.requiresCafe24Approval: string[]` — 요청 scopes ∩ [`cafe24-restricted-scopes.md §1`](./conventions/cafe24-restricted-scopes.md#1-scope-단위-별도-승인-resource-전체-영향) 의 교집합. 다른 status_reason 에서는 미사용 또는 별개 키 집합 — 새 사유 도입 시 본 spec 행에 키 정의를 inline 추가). API 응답의 `details` 키 집합과 형식적으로 같은 shape 이지만 DB 와 API 의 노출 정책은 각 spec 본문 (§10.4 등) 이 별도 통제 — 본 컬럼은 저장 책임만 진다. |
 | created_by | UUID | FK → User |
 | created_at | Timestamp | 생성 시각 |
 | updated_at | Timestamp | 수정 시각 |

```

---

### 파일 56: spec/2-navigation/4-integration.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/2-navigation/4-integration.md b/spec/2-navigation/4-integration.md
index 446fe4bf..cd9a4eaa 100644
--- a/spec/2-navigation/4-integration.md
+++ b/spec/2-navigation/4-integration.md
@@ -153,6 +153,8 @@ Step 2 auth     ──submit──▶ Step 3 test
    - `Mall ID` (예: `myshop` — `https://myshop.cafe24api.com` 의 hostname prefix). 형식: `/^[a-z0-9-]{3,50}$/` ([§5.8 credentials JSONB](#58-cafe24) validation rule).
    - `App type` 라디오: **Public** 선택.
 2. **Scope 카테고리 프리셋** (체크박스, 카테고리 단위): Product (R/W), Order (R/W), Customer (R/W), Category (R/W), Promotion (R/W), Mileage (R/W), Shipping (R/W), Salesreport (R), Translation (R/W), Notification (R/W), 기타 카테고리는 "고급" 토글 아래. 각 체크박스가 Cafe24 scope (`mall.read_<category>` / `mall.write_<category>`) 와 매핑.
+
+   > **별도 승인 필요 권한 안내** — 체크박스 옆 ⚠ 아이콘이 표시된 카테고리는 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다 (Mileage / Notification / Privacy 의 R·W 전부, Store 안 일부 sub-resource). 명단의 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md). 체크 자체는 차단하지 않으나, 체크된 권한 중 별도 승인 대상이 1개 이상이면 폼 하단에 영구 amber 경고 배너를 띄운다 — 미승인 상태로 진행하면 OAuth 단계에서 `invalid_scope` 또는 호출 시 `INSUFFICIENT_SCOPE (403)` 으로 실패할 수 있다. tooltip 문구·경고 배너 i18n 키는 같은 컨벤션 §4.1.
 3. **[Connect with Cafe24]** 클릭 → 백엔드 `POST /api/integrations/oauth/begin` 호출. body:
    ```jsonc
    {
@@ -279,6 +281,7 @@ Step 2 auth     ──submit──▶ Step 3 test
 | 현재 scope 목록 | `credentials.scopes[]` 전체를 체크된 상태로 표시 |
 | 권장 scope 목록 | 서비스별 프리셋. 현재 scope에 없는 항목은 체크 해제 상태 |
 | 누락 scope 배지 | `status_reason = insufficient_scope`일 때 누락 scope 목록을 빨간 뱃지로 강조 |
+| 별도 승인 ⚠ 배지 | 현재 scope · 권장 scope · 누락 scope 의 각 항목 옆에 backend 메타데이터의 `restrictedApproval` (또는 `oauth/begin` 응답의 동등 정보) 가 있는 scope/operation 만 ⚠ 배지 자동 노출. tooltip 본문은 [`cafe24-restricted-scopes.md §4.1`](../conventions/cafe24-restricted-scopes.md#41-사용자-안내-ui) 의 i18n 문구. `[Request scopes]` 버튼 위쪽에 "추가하려는 scope 중 N개는 카페24 별도 승인 필요" 보조 텍스트 (N=교집합 크기). `status_reason='oauth_invalid_scope'` 또는 `INSUFFICIENT_SCOPE` 응답의 `details.requiresCafe24Approval` 가 채워져 있으면 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지 추가 노출 (§10.4 참조) |
 | `[Request scopes]` 버튼 | 체크된 추가 scope 와 함께 `POST /api/integrations/:id/request-scopes` 호출. 응답 분기는 아래 두 가지 — provider 분기는 backend 가 응답 shape 으로 결정하므로 frontend 는 응답 shape 만 보고 UI 를 분기한다. 응답 필드 전체 정의는 §9.2 참조. |
 
 **분기 ① — 일반 OAuth provider (Google / GitHub / Cafe24 Public)**
@@ -550,26 +553,28 @@ AI Agent 노드가 활용하는 외부 [Model Context Protocol](https://modelcon
 
 **Scope 권장 프리셋**
 
-| 카테고리 | scope 값 (R / W) |
-|---------|------------------|
-| Product | `mall.read_product` / `mall.write_product` |
-| Order | `mall.read_order` / `mall.write_order` |
-| Customer | `mall.read_customer` / `mall.write_customer` |
-| Category | `mall.read_category` / `mall.write_category` |
-| Promotion | `mall.read_promotion` / `mall.write_promotion` |
-| Mileage | `mall.read_mileage` / `mall.write_mileage` |
-| Shipping | `mall.read_shipping` / `mall.write_shipping` |
-| Sales report | `mall.read_salesreport` / — (write 없음) |
-| Translation | `mall.read_translation` / `mall.write_translation` |
-| Notification | `mall.read_notification` / `mall.write_notification` |
-| Application | `mall.read_application` / `mall.write_application` |
-| Store | `mall.read_store` / `mall.write_store` |
-| Design | `mall.read_design` / `mall.write_design` |
-| Community | `mall.read_community` / `mall.write_community` |
-| Collection | `mall.read_collection` / `mall.write_collection` |
-| Supply | `mall.read_supply` / `mall.write_supply` |
-| Personal | `mall.read_personal` / `mall.write_personal` |
-| Privacy | `mall.read_privacy` / `mall.write_privacy` |
+| 카테고리 | scope 값 (R / W) | 별도 승인 |
+|---------|------------------|----------|
+| Product | `mall.read_product` / `mall.write_product` | |
+| Order | `mall.read_order` / `mall.write_order` | |
+| Customer | `mall.read_customer` / `mall.write_customer` | |
+| Category | `mall.read_category` / `mall.write_category` | |
+| Promotion | `mall.read_promotion` / `mall.write_promotion` | |
+| Mileage | `mall.read_mileage` / `mall.write_mileage` | ⚠ 필요 (R/W) |
+| Shipping | `mall.read_shipping` / `mall.write_shipping` | |
+| Sales report | `mall.read_salesreport` / — (write 없음) | |
+| Translation | `mall.read_translation` / `mall.write_translation` | |
+| Notification | `mall.read_notification` / `mall.write_notification` | ⚠ 필요 (R/W) |
+| Application | `mall.read_application` / `mall.write_application` | |
+| Store | `mall.read_store` / `mall.write_store` | ⚠ 일부 sub-resource |
+| Design | `mall.read_design` / `mall.write_design` | |
+| Community | `mall.read_community` / `mall.write_community` | |
+| Collection | `mall.read_collection` / `mall.write_collection` | |
+| Supply | `mall.read_supply` / `mall.write_supply` | |
+| Personal | `mall.read_personal` / `mall.write_personal` | |
+| Privacy | `mall.read_privacy` / `mall.write_privacy` | ⚠ 필요 (R/W) |
+
+> "⚠" 표기된 카테고리는 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. 일반 사용자가 무심코 체크 후 OAuth 진행 시 `invalid_scope` 로 실패할 수 있어, UI 에서 체크박스 옆에 ⚠ 아이콘 + tooltip + 폼 하단 경고 배너로 인지를 보장한다. Store 의 "일부 sub-resource" 는 scope 단위가 아닌 operation 단위 (Activitylogs, Menus, Naverpay/Kakaopay setting, Paymentgateway 관련, Financials paymentgateway) 라 노드 Operation 드롭다운 ([Spec Cafe24 노드 §2](../4-nodes/4-integration/4-cafe24.md#2-설정-ui)) 의 ⚠ 라벨이 1차 안내 지점이다. 명단의 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md).
 
 UI 는 카테고리 단위 체크박스(R / W 두 컬럼) + "고급" 토글 아래 개별 scope 추가 입력란.
 
@@ -609,7 +614,7 @@ UI 는 카테고리 단위 체크박스(R / W 두 컬럼) + "고급" 토글 아
 |------|--------------|
 | pending_install → connected | Cafe24 Private 앱 "테스트 실행" → HMAC 검증 → OAuth callback 성공. `install_token` 은 **보존** (post-install navigation 의 식별 키로 계속 사용 — Rationale "Cafe24 App URL 재호출 흐름" 항 참조). |
 | **pending_install → expired** | install_token 발급 후 24시간 내 callback 미성공 — 일일 스캐너가 `status='expired'`, `status_reason='install_timeout'`, `install_token=NULL` 로 자동 전이. 재시도하려면 사용자가 새로 통합을 등록한다 (단 private 앱은 reauthorize 불가 → 권장: 삭제 후 재등록) |
-| **pending_install → pending_install (callback 실패 보존)** | OAuth callback 처리 중 token exchange 실패 / state mismatch / state expired 등이 발생하면 status 는 보존되고 `last_error` + `status_reason` (`oauth_token_exchange_failed` / `oauth_state_mismatch` / `oauth_state_expired`, 모두 snake_case) 만 갱신된다. 사용자가 cafe24 측 설정을 고치고 "테스트 실행" 을 다시 누르면 새 OAuthState 가 생성되어 재시도 가능. ※ row 자체가 사라진 `resource_not_found` 케이스는 갱신 대상이 없어 §10.4 "변경 불가" 행으로만 다룬다. |
+| **pending_install → pending_install (callback 실패 보존)** | OAuth callback 처리 중 token exchange 실패 / state mismatch / state expired 등이 발생하면 status 는 보존되고 `last_error` + `status_reason` (`oauth_token_exchange_failed` / `oauth_state_mismatch` / `oauth_state_expired` / `oauth_invalid_scope`, 모두 snake_case) 만 갱신된다. 사용자가 cafe24 측 설정을 고치고 "테스트 실행" 을 다시 누르면 새 OAuthState 가 생성되어 재시도 가능. `oauth_invalid_scope` 는 Cafe24 가 요청 scope 를 거부한 케이스이며 `last_error.details.requiresCafe24Approval` 에 영향 scope 가 동행된다 (§10.4 / [`cafe24-restricted-scopes.md §4.3`](../conventions/cafe24-restricted-scopes.md#43-에러-안내-에러-발생-후)). ※ row 자체가 사라진 `resource_not_found` 케이스는 갱신 대상이 없어 §10.4 "변경 불가" 행으로만 다룬다. |
 | connected → error(auth_failed) | 노드 실행 중 401/403 또는 매일 스캐너 / 노드 실행 직전 토큰 갱신 시 `refresh_token` 자체 무효 (`invalid_grant`). (2026-05-16 갱신 — 옛 `connected → expired (refresh fail)` 경로를 본 행으로 통합; expired 는 이제 `pending_install → expired (install_timeout)` 한 경로만 사용. [Rationale "refresh 실패 시 status_reason 통일"](#rationale) 참고) |
 | connected → error(insufficient_scope) | 노드 실행 중 403 + 서비스별 `missing_scope` 시그널 |
 | connected → error(network) | 노드 실행 중 또는 토큰 갱신 중 transport 실패가 3회 연속 (PR #67 V049 컬럼 `consecutive_network_failures` 카운터로 판정) |
@@ -718,7 +723,7 @@ Please replace or remove these node references first.
   - `INTEGRATION_TEST_FAILED` (422) — 연결 테스트 실패
   - `OAUTH_STATE_MISMATCH` (400)
   - `OAUTH_CONFIG_MISSING` (500)
-  - `INSUFFICIENT_SCOPE` (403) — 노드 실행 중 감지 시 `Integration.status`도 갱신
+  - `INSUFFICIENT_SCOPE` (403) — 노드 실행 중 감지 시 `Integration.status` 도 `error(insufficient_scope)` 로 갱신. 응답 `details` 는 다음 필드를 포함한다: `missingScopes: string[]` (Cafe24 응답에서 추출한 누락 scope 목록 — 본 코드 도입 시 신설된 필드), 그리고 `requiresCafe24Approval?: string[]` (Cafe24 통합에 한정 — `missingScopes` ∩ [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md) **§1·§2 명단 전체** 의 교집합. §1 (scope 단위) 과 §2 (operation 단위, store 안) 양쪽을 모두 본다. 단 §2 항목들은 scope 자체가 일반 사용 가능 (`mall.read_store`/`mall.write_store`) 이라 `missingScopes` 가 그 scope 토큰만 갖고 있는 한 교집합은 비어있고, frontend 가 안내 메시지를 띄울 트리거는 §1 항목들이 주가 된다. 다른 provider 통합에서는 본 필드 자체를 omit). frontend 는 `requiresCafe24Approval` 가 비어있지 않으면 에러 메시지에 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지를 추가 노출한다. 본 보강은 기존 코드를 분기시키지 않는 추가 필드일 뿐 — 신규 에러 코드 미추가 (하위 호환 유지).
   - `CAFE24_INSTALL_MISSING_PARAMS` (400) — App URL 호출에 `mall_id` / `timestamp` / `hmac` 중 하나라도 누락. capability-token 가정(install_token 추측 불가) 에 영향 없는 파라미터 누락 분기로 별도 코드 (404/403 합산 정책과 무관 — Rationale 참조).
   - `CAFE24_INSTALL_INVALID_TOKEN` (404) — App URL 의 `install_token` 미존재 (통합 삭제 또는 24h TTL 만료로 소거). callback 성공만으로는 소거되지 않음 (post-install navigation 의 식별 키로 보존). 직접 매칭 실패 시 `tryRecoverByMallId` 회복 흐름 fall-back 후에도 미매칭이면 본 코드 반환 ([Rationale "Cafe24 install_token mismatch 회복 흐름"](#rationale) 참조).
   - `CAFE24_INSTALL_INVALID_HMAC` (403) — App URL HMAC 검증 실패
@@ -791,6 +796,7 @@ window.close();
 | 사용자 거부 | `Authorization was denied.` | 변경 없음 |
 | 코드 교환 실패 (mode=`reauthorize`, status=`connected`) | `Failed to connect to {provider}.` (auto-close 3~5초 지연 — 사용자가 메시지 읽도록) | `error(auth_failed)` + `last_error` 기록 |
 | 코드 교환 실패 (mode=`reauthorize`, status=`pending_install` — Cafe24 Private 초기 install) | 동일 | **status 보존 (`pending_install` 유지)** + `status_reason='oauth_token_exchange_failed'` + `last_error.code='OAUTH_TOKEN_EXCHANGE_FAILED'` 기록. cafe24 측 설정 수정 후 재시도 가능 |
+| Cafe24 `invalid_scope` (authorize / token exchange 단계 양쪽) | `Authorization rejected: invalid scope.` (안내 본문에 별도 승인 안내 분기) | **status 보존** + `status_reason='oauth_invalid_scope'` ([Spec Integration 데이터 모델 §2.10](../1-data-model.md#210-integration) status_reason 열거 참조) + `last_error.code='OAUTH_INVALID_SCOPE'` + `last_error.details.requiresCafe24Approval: string[]` (요청 scopes ∩ [`cafe24-restricted-scopes.md §1`](../conventions/cafe24-restricted-scopes.md#1-scope-단위-별도-승인-resource-전체-영향) 의 교집합) 기록. 통합 상세 페이지가 본 단서를 읽어 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지 노출. 진입 경로는 `oauth_token_exchange_failed` 와 분리 — 본 사유는 Cafe24 가 명시적으로 scope 거부한 케이스이고, `oauth_token_exchange_failed` 는 그 외 토큰 교환 실패 전부 (네트워크, 서버 오류, 알 수 없는 invalid_grant 등). |
 | state mismatch / expired (state row 소비 후) | `Security validation failed.` / `OAuth state has expired.` | integrationId 가 식별되면 `status_reason='oauth_state_mismatch'` 또는 `oauth_state_expired` 만 기록, status 보존 |
 | 토큰 발급 후 row 조회 실패 (resource not found) | `Integration not found.` | 변경 불가 (row 가 사라진 케이스. integrationId 만 식별, row 가 없으니 갱신 대상 없음) |
 | 네트워크 오류 | `Connection error.` | integrationId 식별되면 `last_error` 만 기록, status 보존 |
@@ -1280,3 +1286,22 @@ Public 흐름은 begin 단계에서 Integration row 를 만들지 않으므로 V
 **O(N) 폐기와의 관계** — [install_token 을 App URL path 식별 키로 승격](#install_token-을-app-url-path-식별-키로-승격-2026-05-14) 항에서 폐기된 "전방위 O(N) mall_id 스캔 + HMAC trial" 패턴과 본 endpoint 는 다르다. precheck 는 V045 plain mall_id 컬럼의 단일 인덱스 lookup (`(workspace_id, mall_id) WHERE service_type='cafe24'`) 으로 O(1) row 만 가져온다. legacy `mall_id IS NULL` fallback 만 backfill 완료 전 임시로 추가 쿼리 발행 — 향후 backfill 종료 시 제거된다 (구현 코드 주석 `findAllCafe24RowsForMall` 참조).
 
 라우트 선언 순서 주의 — `@Get('cafe24/precheck')` 는 동적 경로 `@Get(':id')` 보다 **앞에** 선언되어야 NestJS 가 `cafe24` 를 `:id` 로 소비해 `ParseUUIDPipe` 위반 400 을 일으키지 않는다. controller 코드 주석에 회귀 안전망으로 명시.
+
+### Cafe24 별도 승인 scope 의 식별·안내 (2026-05-17)
+
+**문제**: Cafe24 Admin API 중 mileage/notification/privacy 의 모든 scope 와 store 안 일부 operation (activitylogs, menus, naverpay/kakaopay/PG settings 등) 은 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. spec 에 이를 표현하는 차원이 없어 사용자가 위저드에서 일반 카테고리처럼 체크 → OAuth `invalid_scope` 거부 또는 호출 시 `INSUFFICIENT_SCOPE (403)` 으로 좌초. 원인 안내 장치 부재.
+
+**채택**: backend 메타데이터의 `Cafe24OperationMetadata.restrictedApproval` 필드와 catalog 의 `restricted` 컬럼을 SoT 로 두고, UI 4 화면 (위저드 §3.2 / 통합 상세 §4.4 / Cafe24 노드 Operation 드롭다운 / AI Agent allowlist) 이 같은 필드를 읽어 ⚠ 배지·tooltip·경고 배너를 자동 렌더. 명단 자체의 진위 SoT 는 신규 컨벤션 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md). 에러 안내는 §10.4 의 `oauth_invalid_scope` 행과 §9.4 의 `INSUFFICIENT_SCOPE` 의 `details.requiresCafe24Approval` 보강 필드 2 경로로 분리 (OAuth 단계 vs 호출 단계).
+
+**기각 대안**:
+
+- (A) **차단 정책** — 체크 시점에 사용자 진행을 막는다. 이미 본사 승인을 받은 합법 사용자 케이스를 막아버려 기각. 안내만, 차단 없음 정책 채택. 단 amber 경고 배너로 인지를 강제한다.
+- (B) **신규 에러 코드 추가** (`CAFE24_APPROVAL_REQUIRED` 등) — 기존 `INSUFFICIENT_SCOPE (403)` / OAuth `invalid_scope` 처리 경로를 분기시켜 client 코드 호환성에 영향. `details.requiresCafe24Approval` 보강 필드 + `status_reason='oauth_invalid_scope'` 의 enum 확장만으로 표현 가능.
+- (C) **catalog `status` enum 확장** — `supported` / `planned` / `deprecated` 와는 직교 차원이라 enum 확장은 의미 오염. 별도 컬럼 `restricted` 가 정답.
+
+**Trade-off / 미해결**:
+
+- mileage resource 안의 `credits_*` (예치금) 가 정확히 `mall.read_mileage` 를 쓰는지 vs 별도 scope 인지의 공식 분리 확인은 사용자 자료 범위 밖. scope 단위 라벨링 (`level='scope'`) 을 mileage resource 전체에 적용. 향후 공식 문서로 분리 확인되면 정정 ([`cafe24-restricted-scopes.md §5`](../conventions/cafe24-restricted-scopes.md#5-명단-갱신-절차)).
+- `paymentmethods_list` / `paymentmethods_paymentproviders_list` / `paymentmethods_paymentproviders_update_display` 는 별도 승인 여부 미확인 — 빈칸 유지.
+
+**출처**: 사용자 보고 (2026-05-17). consistency-check 세션: `review/consistency/2026/05/17/12_12_46/` (BLOCK: NO).

```

---

### 파일 57: spec/4-nodes/4-integration/4-cafe24.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/4-nodes/4-integration/4-cafe24.md b/spec/4-nodes/4-integration/4-cafe24.md
index 28e416d8..4debab97 100644
--- a/spec/4-nodes/4-integration/4-cafe24.md
+++ b/spec/4-nodes/4-integration/4-cafe24.md
@@ -57,6 +57,7 @@
 - Fields: Operation 선택 시 메타데이터의 입력 스키마(JSON Schema 호환 형식) 로 동적 폼 렌더. Required / Optional 두 그룹으로 분리. 각 필드는 `ExpressionInput` 베이스 위젯을 사용하여 표현식(`{{ }}`) 입력을 모든 칸에서 허용하며, `enum` / `boolean` / `default` 정보는 hint 텍스트로 표면화한다. 키는 메타데이터로 고정되므로 사용자가 임의 key 를 추가하는 경로는 없다 (배경: §9.9).
   - **호환 키 보존**: Operation 변경 시 새 op 의 `fields[].name` 과 교집합인 키만 유지하고 무관 키는 drop. 예) `product_get` (shop_no 만) → `product_list` (shop_no + display + ...) 전환 시 `shop_no` 값은 유지된다.
 - Operation 후보 표시: 카탈로그 (`spec/conventions/cafe24-api-catalog/`) 의 `status: planned` 행도 dropdown 에 노출하되 disabled + "(지원 예정)" 접미사로 구분. resource 옆에 "지원 N개 · 추후 지원 M개" coverage hint.
+  - **별도 승인 라벨**: 메타데이터 row 에 `restrictedApproval` ([cafe24-api-metadata 컨벤션 §2](../../conventions/cafe24-api-metadata.md#2-operation-메타데이터-형식)) 이 있는 operation 은 라벨 우측에 ⚠ 아이콘 + 보조 텍스트 ("별도 승인 필요") 표시. resource 가 scope 단위 restricted (mileage / notification / privacy — `restrictedApproval.level='scope'`) 면 같은 resource 의 모든 operation 에 자동 적용. store resource 의 `restrictedApproval.level='operation'` row (paymentgateway_*, paymentgateway_paymentmethods_*, financials_paymentgateway_get, menus_get, activitylogs_*, naverpay_setting_*, kakaopay_setting_*) 는 해당 row 만 ⚠. tooltip 본문·문의 링크는 [`spec/conventions/cafe24-restricted-scopes.md §4.1`](../../conventions/cafe24-restricted-scopes.md#41-사용자-안내-ui). `approvalGroup` 필드 (메시지 묶음 식별자) 별 문구는 frontend i18n dict 가 관리한다.
 - Pagination: operation 메타데이터에 `paginated: true` 가 있을 때만 표시. supported 가 아닌 operation (planned / unknown) 선택 시 fields/pagination 미렌더.
 
 ## 3. 포트
@@ -356,6 +357,8 @@ Cafe24 MCP Bridge 는 `listTools` 만 보고하고 `resources` / `prompts` capab
 
 AI Agent config 의 `mcpServers[i].enabledTools` 는 `['product_list', 'order_list', ...]` 형식의 bare operation id 배열로 저장한다 ([Spec MCP Client §5.6](../../5-system/11-mcp-client.md#56-도구-allowlist)). UI 에서는 카테고리 단위 grouping 으로 사용성 보강 — "Product (read/write 전부 허용)" 같은 short form 을 frontend 가 enabledTools 배열로 펼쳐 저장한다 (용어 정의는 [Spec Cafe24 API 메타데이터 §7](../../conventions/cafe24-api-metadata.md#7-allowlist-와의-관계)).
 
+**별도 승인 라벨 (UI)**: AI Agent allowlist 의 카테고리 단위 grouping UI 에서, scope 전체가 별도 승인 대상인 카테고리 (mileage / notification / privacy) 는 그룹 헤더에 ⚠ + "별도 승인 필요". store 카테고리 안 operation 단위 restricted (paymentgateway_*, paymentgateway_paymentmethods_*, financials_paymentgateway_get, menus_get, activitylogs_*, naverpay_setting_*, kakaopay_setting_*) 는 operation 행 단위로 같은 ⚠ 표기. backend 가 `tools/list` 응답 메타데이터에 `restrictedApproval` 을 통과시켜 frontend 가 자동 렌더한다. 명단 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md). 차단 없음 — 사용자가 인지하고 선택할 수 있게 안내만.
+
 ### 8.4 Rate Limit 공유 (동일 프로세스 인스턴스 내)
 
 노드 호출 / MCP `tools/call` 모두 같은 `Cafe24ApiClient` wrapper 를 통과한다 → 같은 Integration credential 에 대한 leaky bucket 공유. AI Agent multi-turn 도중 LLM 이 빠르게 연속 호출하면 다른 워크플로의 같은 Integration 사용도 함께 대기한다 (§4.1 의 동일 프로세스 인스턴스 mutex). 격리는 Integration 단위 — 서로 다른 `mall_id` 의 Integration 간에는 공유되지 않는다.
@@ -521,6 +524,12 @@ POST/PUT 외 method 는 allowlist 로 강제 — 미래 method (PATCH 등) 추
 
 이중 래핑 throw 가드의 전제: 현재 모든 caller (노드 핸들러·MCP Bridge) 는 flat body 만 사용하므로 pre-wrap 은 반드시 오류 신호다. 향후 wrapper 외부에서 envelope 을 미리 적용해야 하는 새 caller 가 생기면 본 가드의 전제가 깨지므로 그 시점에 가드 정책을 재검토한다.
 
+### 9.11 별도 승인 라벨 — 노드 Operation / AI Agent allowlist 의 ⚠ 표기
+
+UI 4 화면 (통합 추가 위저드 / 통합 상세 §4.4 Scope & Permissions / 본 노드 Operation 드롭다운 / AI Agent allowlist) 의 ⚠ 라벨링은 모두 같은 메타데이터 SoT (`Cafe24OperationMetadata.restrictedApproval`) 에서 자동 렌더한다. 명단의 진위 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md) 가 유일 출처이며, 본 노드 spec 은 그 라벨이 노드/AI Agent 의 어디에서 시각화되는지만 명시한다 — 명단을 spec 본문에 직접 enumerate 하지 않는 이유는 drift 방지 ([§9.3](#93-노드의-resource-operation-메타데이터-위치) 의 "endpoint enumeration 을 spec 본문에 인라인하지 않는다" 정책과 동일).
+
+차단 정책 채택 안 한 이유는 [Spec 통합 화면 ## Rationale](../../2-navigation/4-integration.md#cafe24-별도-승인-scope-의-식별안내-2026-05-17) 의 "Cafe24 별도 승인 scope 의 식별·안내" 항 참조. 신규 에러 코드 미추가 + `INSUFFICIENT_SCOPE` 의 `details.requiresCafe24Approval` 보강 필드만 사용한다.
+
 ## 10. CHANGELOG
 
 | 일자 | 변경 |
@@ -537,3 +546,5 @@ POST/PUT 외 method 는 allowlist 로 강제 — 미래 method (PATCH 등) 추
 | 2026-05-16 (ux-cleanup) | §2 / §9.9 본문 정리 — Phase 3 (PR #88, Cafe24Config 재작성) 가 옛 KeyValueEditor + 편집 버퍼 패턴을 완전히 폐기했으므로 §2 의 "편집 버퍼" 줄을 제거하고 메타데이터 기반 typed 동적 폼 + 호환 키 보존 동작으로 교체. §9.9 도 (A) 옛 자유 key/value 입력 / (B) 메타데이터 기반 동적 폼 두 안의 비교로 재작성하여 채택안을 (B) 로 명시. 옛 §9.9 의 "object-shaped contract + 편집 버퍼" 패턴은 본 프로젝트에서 더 이상 사용되지 않음을 명시. 호환 키 보존 결정 추가. consistency-check 세션: `review/consistency/2026/05/16/13_29_47/`. |
 | 2026-05-16 (hmac-raw-fix) | §9.8 HMAC 검증 알고리즘 **재정정** — PR #67 SEC H-1 의 "Java URLEncoder 호환 (공백 `+`)" 가정이 오류였음. Cafe24 공식 샘플은 URL 의 값을 decode/re-encode 없이 raw 그대로 HMAC 메시지에 사용한다 (`request.getQueryString()` split → TreeMap 보존). 운영 사용자 보고 (2026-05-16) — Cafe24 가 URL 에 `%20` 으로 공백을 인코딩해 보내는데 우리는 `+` 로 변환해 메시지 불일치. raw-value 보존 방식으로 재정정. 자세한 결정 배경은 [Spec 통합 화면 ## Rationale](../../2-navigation/4-integration.md#rationale) "HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)" 항. consistency-check 세션: `review/consistency/2026/05/16/14_06_49/`. |
 | 2026-05-16 (envelope) | §4 step 8/9 본문 보강 + §4.2 신설 + §9.10 Rationale 추가 — Cafe24 POST/PUT 본문의 `request` envelope 책임을 wrapper (`Cafe24ApiClient`) 단일 지점으로 명문화 (코드 fix PR #102 와 결속). 운영 사고 (`product_update` 가 `400 "Please enter the Request parameter."` 반환) 후속. 규약 본문 단일 진실은 [`spec/conventions/cafe24-api-metadata.md` §4](../../conventions/cafe24-api-metadata.md#4-wire-format-규약--postput-request-envelope). §8.1·§8.3 의 cafe24-api-metadata anchor (`#5-mcp-…` / `#6-allowlist-…`) 도 절 번호 +1 이동에 맞춰 `#6-mcp-…` / `#7-allowlist-…` 로 갱신. consistency-check 세션: `review/consistency/2026/05/16/15_45_35/` (BLOCK: NO). |
+| 2026-05-17 | §2 Operation 드롭다운에 별도 승인 ⚠ 라벨 명세 + §8.3 AI Agent allowlist UI 의 동일 ⚠ 라벨 명세 + §9.11 Rationale 신설. 메타데이터 `Cafe24OperationMetadata.restrictedApproval` 신설 ([cafe24-api-metadata 컨벤션 §2](../../conventions/cafe24-api-metadata.md#2-operation-메타데이터-형식)) + 카탈로그 `restricted` 컬럼 ([_overview §2](../../conventions/cafe24-api-catalog/_overview.md#2-표-컬럼-정의)) + SoT 컨벤션 [`cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md) 신설과 한 세트. 사용자 보고 (2026-05-17) — 카페24 본사 승인 필요 권한이 사용자에게 식별되지 않는 UX 문제 해소. consistency-check 세션: `review/consistency/2026/05/17/12_12_46/` (BLOCK: NO). |
+| 2026-05-17 (drift fix) | §2 별도 승인 라벨 설명에 `approvalGroup` 명명 명시 (옛 `category` 충돌 회피, W-8). impl-prep consistency-check 세션: `review/consistency/2026/05/17/12_37_41/`. |

```

---

### 파일 58: spec/conventions/cafe24-api-catalog/_overview.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/conventions/cafe24-api-catalog/_overview.md b/spec/conventions/cafe24-api-catalog/_overview.md
index 700403eb..85c2d7f5 100644
--- a/spec/conventions/cafe24-api-catalog/_overview.md
+++ b/spec/conventions/cafe24-api-catalog/_overview.md
@@ -45,6 +45,7 @@ resource 이름은 `Cafe24Resource` enum (`backend/src/nodes/integration/cafe24/
 | `method` | supported 시 ✓ | `GET` / `POST` / `PUT` / `DELETE`. planned 시 `?` 허용 |
 | `path` | supported 시 ✓ | path template (예: `products/{product_no}`). `/api/v2/admin/` 접두는 생략. planned 시 `?` 허용 |
 | `scope` | supported 시 ✓ | `read` / `write`. `mall.<scope>_<resource>` 의 가운데 토큰. planned 시 `?` 허용 |
+| `restricted` | — | `scope` / `operation` / 빈칸. `scope` = 본 scope 자체가 카페24 별도 승인 대상이라 같은 resource 의 모든 row 가 영향. `operation` = 본 row 만 단독 승인 대상 (store 안 케이스). 빈칸 = 일반 사용 가능. **이 컬럼은 `status` 와 직교하며 `status` 의 값이 아니다** — `supported` + `restricted: operation` 조합이 정상이다. 컬럼 값은 backend 메타데이터 `restrictedApproval.level` 과 동일 토큰 (`'scope'` / `'operation'`) 으로 통일. 명단 SoT 는 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md) |
 | `paginated` | — | `✓` 또는 빈 칸. `paginated: true` 인 operation 만 표시 |
 | `status` | ✓ | §3 의 enum 중 하나 |
 | `docs` | ✓ | Cafe24 공식 docs anchor URL — `https://developers.cafe24.com/docs/ko/api/admin/#<anchor>` |
@@ -74,12 +75,13 @@ resource 이름은 `Cafe24Resource` enum (`backend/src/nodes/integration/cafe24/
 5. **`scope` 일치**: `supported` row 의 `scope` 가 메타데이터 `scopeType` 과 일치.
 6. **id 의 resource 내 unique**: 한 카탈로그 파일 안에 같은 `id` 가 두 번 나오면 fail.
 7. **status 가 enum 중 하나**: `supported` / `planned` / `deprecated` 외의 값이 있으면 fail.
+8. **`restricted` 컬럼 ↔ 메타데이터 `restrictedApproval` 동기**: catalog row 의 `restricted` 컬럼이 `scope` 또는 `operation` 이면 그 row 에 대응하는 backend 메타데이터에 `restrictedApproval` 필드가 존재해야 하고, 그 역도 동일. 컬럼 값과 메타데이터 `level` 은 동일 토큰 (`'scope'` ↔ `'scope'`, `'operation'` ↔ `'operation'`). `restrictedApproval.approvalGroup` 필드 (UI 메시지·tooltip 묶음 식별자) 는 catalog 컬럼으로 노출하지 않으므로 본 검증 대상이 아니다 — 정의는 [`cafe24-api-metadata.md §2`](../cafe24-api-metadata.md#2-operation-메타데이터-형식) 참고. **`level='program'` 인 메타데이터 row 는 catalog 화 대상이 아닌 별도 트랙 (Analytics 등) 이므로 본 검증에서 제외**된다 — catalog 에 대응 row 가 없는 것이 정상. SoT 명단의 진위 검증은 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md) §5 절차에서 별도로 다룬다.
 
 테스트는 카탈로그 MD 의 표를 파싱한다 — MD 표 구문이 깨지면 곧장 fail. 따라서 본 카탈로그는 **사람이 직접 손으로 수정하는 SoT** 이며, 코드 변경 시점에 반드시 카탈로그 동기 갱신을 함께 commit 해야 한다(`spec/conventions/cafe24-api-metadata.md` §5 의 신규 endpoint 추가 절차에 인용).
 
 ## 5. Coverage Matrix
 
-2026-05-16 기준. 본 매트릭스는 카탈로그 row 수 + 메타데이터 row 수의 한 화면 요약이다 — 위 동기 테스트와 별개의 휴먼 가독성 보조 정보다. row 추가/삭제 시 본 표도 손으로 갱신한다.
+2026-05-17 기준. 본 매트릭스는 카탈로그 row 수 + 메타데이터 row 수의 한 화면 요약이다 — 위 동기 테스트와 별개의 휴먼 가독성 보조 정보다. row 추가/삭제 시 본 표도 손으로 갱신한다.
 
 | Resource | Supported | Planned | Cafe24 docs sub-resource 수 |
 |----------|-----------|---------|---|
@@ -151,3 +153,5 @@ resource 이름은 `Cafe24Resource` enum (`backend/src/nodes/integration/cafe24/
 | 2026-05-16 (coverage Phase 8h) | Collection resource 완성 — manufacturers count/get/create/update 4건 + trends_count + classifications list/count 2건 + origin_list = 8건. collection supported 7 → 15, planned 8 → 0, 합계 237 → 245. collection 열세 번째 0-planned resource. |
 | 2026-05-16 (coverage Phase 8i) | Design resource 완성 — themes count/get 2건 + theme_pages CRUD 4건 (get/create/update/delete) + icons_list + icons_update_settings = 8건. design supported 1 → 9, planned 8 → 0, 합계 245 → 253. design 열네 번째 0-planned resource. |
 | 2026-05-16 (coverage Phase 8j) | Community resource 완성 — boards_comments_bulk + boards_seo get/update 2건 + commenttemplates get/update/delete 3건 + financials_monthlyreviews_count + urgentinquiry get/reply CRUD 4건 = 11건. community supported 13 → 24, planned 11 → 0, 합계 253 → 264. community 열다섯 번째 0-planned resource. 본 사이클 (Phase 8 a~j) 종료. |
+| 2026-05-17 | §2 에 `restricted` 컬럼 추가 + §4 검증 규칙 8 신설 — 카페24 별도 승인 대상 식별. SoT 는 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md). 영향 카탈로그 (mileage / notification / privacy / store) 표 헤더·row 동시 갱신. 사용자 보고 (질문에서 제공한 3종 표) 후속. consistency-check 세션: `review/consistency/2026/05/17/12_12_46/` (BLOCK: NO). |
+| 2026-05-17 (drift fix) | §2 컬럼 정의 순서를 실제 파일 헤더 (`scope→restricted→paginated→status→docs`) 기준으로 정정 (C-1) + `restricted` 값 `op` → `operation` 으로 토큰 통일 (메타데이터 `level` 과 일치, W-9) + §4 검증 규칙 8 에 `approvalGroup` 비검증 명시 (W-8 재명명) + Coverage Matrix 기준일 갱신 (W-4). impl-prep consistency-check 세션: `review/consistency/2026/05/17/12_37_41/`. |

```

---

### 파일 59: spec/conventions/cafe24-api-catalog/mileage.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/conventions/cafe24-api-catalog/mileage.md b/spec/conventions/cafe24-api-catalog/mileage.md
index c5b6b4e3..f1c04758 100644
--- a/spec/conventions/cafe24-api-catalog/mileage.md
+++ b/spec/conventions/cafe24-api-catalog/mileage.md
@@ -4,15 +4,21 @@
 
 base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
 
+> **별도 승인 필요** — 본 resource 의 `mall.read_mileage` / `mall.write_mileage` scope 는 카페24 본사가 별도 승인한 클라이언트만 사용할 수 있다 (명단 SoT: [`cafe24-restricted-scopes.md §1`](../cafe24-restricted-scopes.md#1-scope-단위-별도-승인-resource-전체-영향)). 모든 row 의 `restricted` 컬럼 = `scope`, 대응 backend 메타데이터 `restrictedApproval.level='scope'`, `approvalGroup='mileage'`.
+
 ## 표
 
-| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
-|----|---|---|---|---|---|---|---|---|
-| `mileage_list` | 적립금 내역 조회 | Retrieve points | GET | `points` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-points) |
-| `mileage_grant` | 적립금 지급 | Issue and deduct points | POST | `points` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#issue-and-deduct-points) |
-| `points_autoexpiration_get` | 적립금 자동 만료 조회 | Retrieve an automatic points expiration | GET | `points/autoexpiration/{id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-automatic-points-expiration) |
-| `points_autoexpiration_create` | 적립금 자동 만료 생성 | Create an automatic points expiration | POST | `points/autoexpiration` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-automatic-points-expiration) |
-| `points_autoexpiration_delete` | 적립금 자동 만료 삭제 | Delete an automatic points expiration | DELETE | `points/autoexpiration/{id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-automatic-points-expiration) |
-| `points_report` | 적립금 리포트 조회 | Retrieve a points report by date range | GET | `points/report` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-points-report-by-date-range) |
-| `credits_list` | 예치금 내역 조회 | Retrieve a list of credits by date range | GET | `credits` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-credits-by-date-range) |
-| `credits_report` | 예치금 리포트 조회 | Retrieve a credit report by date range | GET | `credits/report` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-credit-report-by-date-range) |
+| id | 라벨 (한) | English title | method | path | scope | restricted | paginated | status | docs |
+|----|---|---|---|---|---|---|---|---|---|
+| `mileage_list` | 적립금 내역 조회 | Retrieve points | GET | `points` | read | scope | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-points) |
+| `mileage_grant` | 적립금 지급 | Issue and deduct points | POST | `points` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#issue-and-deduct-points) |
+| `points_autoexpiration_get` | 적립금 자동 만료 조회 | Retrieve an automatic points expiration | GET | `points/autoexpiration/{id}` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-automatic-points-expiration) |
+| `points_autoexpiration_create` | 적립금 자동 만료 생성 | Create an automatic points expiration | POST | `points/autoexpiration` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-automatic-points-expiration) |
+| `points_autoexpiration_delete` | 적립금 자동 만료 삭제 | Delete an automatic points expiration | DELETE | `points/autoexpiration/{id}` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-automatic-points-expiration) |
+| `points_report` | 적립금 리포트 조회 | Retrieve a points report by date range | GET | `points/report` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-points-report-by-date-range) |
+| `credits_list` | 예치금 내역 조회 | Retrieve a list of credits by date range | GET | `credits` | read | scope | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-credits-by-date-range) |
+| `credits_report` | 예치금 리포트 조회 | Retrieve a credit report by date range | GET | `credits/report` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-credit-report-by-date-range) |
+
+## Rationale
+
+설계 근거 (컬럼 정의·동기 정책·status enum) 는 [`_overview.md`](./_overview.md) 의 §2·§4·§7. 별도 승인 라벨링의 의사결정 배경은 [`cafe24-restricted-scopes.md ## Rationale`](../cafe24-restricted-scopes.md#rationale).

```

---

### 파일 60: spec/conventions/cafe24-api-catalog/notification.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/conventions/cafe24-api-catalog/notification.md b/spec/conventions/cafe24-api-catalog/notification.md
index 5201f484..63e36ba7 100644
--- a/spec/conventions/cafe24-api-catalog/notification.md
+++ b/spec/conventions/cafe24-api-catalog/notification.md
@@ -4,19 +4,25 @@
 
 base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
 
+> **별도 승인 필요** — 본 resource 의 `mall.read_notification` / `mall.write_notification` scope 는 카페24 본사가 별도 승인한 클라이언트만 사용할 수 있다 (명단 SoT: [`cafe24-restricted-scopes.md §1`](../cafe24-restricted-scopes.md#1-scope-단위-별도-승인-resource-전체-영향)). 모든 row 의 `restricted` 컬럼 = `scope`, 대응 backend 메타데이터 `restrictedApproval.level='scope'`, `approvalGroup='notification'`.
+
 ## 표
 
-| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
-|----|---|---|---|---|---|---|---|---|
-| `sms_send` | SMS 발송 | Send a SMS | POST | `sms` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#send-a-sms) |
-| `sms_balance_get` | SMS 잔액 조회 | Retrieve the SMS balance | GET | `sms/balance` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-sms-balance) |
-| `sms_receivers_get` | SMS 수신자 조회 | Retrieve a SMS recipient | GET | `sms/receivers` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-sms-recipient) |
-| `sms_senders_list` | SMS 발신자 목록 조회 | Retrieve a list of SMS senders | GET | `sms/senders` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-sms-senders) |
-| `automails_get` | 자동 이메일 설정 조회 | Retrieve automated email settings | GET | `automails` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-automated-email-settings) |
-| `automails_update` | 자동 이메일 설정 수정 | Update automated email settings | PUT | `automails` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-automated-email-settings) |
-| `customers_invitation_send` | 회원 활성화 초대 발송 | Send an invitation to activate account | POST | `customers/invitation` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#send-an-invitation-to-activate-account) |
-| `recipientgroups_list` | 수신자 그룹 목록 | Retrieve distribution group list | GET | `recipientgroups` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-distribution-group-list) |
-| `recipientgroups_get` | 수신자 그룹 상세 | Retrieve distribution group details | GET | `recipientgroups/{group_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-distribution-group-details) |
-| `recipientgroups_create` | 수신자 그룹 생성 | Create a distribution group | POST | `recipientgroups` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-distribution-group) |
-| `recipientgroups_update` | 수신자 그룹 수정 | Edit distribution group | PUT | `recipientgroups/{group_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-distribution-group) |
-| `recipientgroups_delete` | 수신자 그룹 삭제 | Delete distribution group | DELETE | `recipientgroups/{group_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-distribution-group) |
+| id | 라벨 (한) | English title | method | path | scope | restricted | paginated | status | docs |
+|----|---|---|---|---|---|---|---|---|---|
+| `sms_send` | SMS 발송 | Send a SMS | POST | `sms` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#send-a-sms) |
+| `sms_balance_get` | SMS 잔액 조회 | Retrieve the SMS balance | GET | `sms/balance` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-sms-balance) |
+| `sms_receivers_get` | SMS 수신자 조회 | Retrieve a SMS recipient | GET | `sms/receivers` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-sms-recipient) |
+| `sms_senders_list` | SMS 발신자 목록 조회 | Retrieve a list of SMS senders | GET | `sms/senders` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-sms-senders) |
+| `automails_get` | 자동 이메일 설정 조회 | Retrieve automated email settings | GET | `automails` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-automated-email-settings) |
+| `automails_update` | 자동 이메일 설정 수정 | Update automated email settings | PUT | `automails` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-automated-email-settings) |
+| `customers_invitation_send` | 회원 활성화 초대 발송 | Send an invitation to activate account | POST | `customers/invitation` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#send-an-invitation-to-activate-account) |
+| `recipientgroups_list` | 수신자 그룹 목록 | Retrieve distribution group list | GET | `recipientgroups` | read | scope | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-distribution-group-list) |
+| `recipientgroups_get` | 수신자 그룹 상세 | Retrieve distribution group details | GET | `recipientgroups/{group_no}` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-distribution-group-details) |
+| `recipientgroups_create` | 수신자 그룹 생성 | Create a distribution group | POST | `recipientgroups` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-distribution-group) |
+| `recipientgroups_update` | 수신자 그룹 수정 | Edit distribution group | PUT | `recipientgroups/{group_no}` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-distribution-group) |
+| `recipientgroups_delete` | 수신자 그룹 삭제 | Delete distribution group | DELETE | `recipientgroups/{group_no}` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-distribution-group) |
+
+## Rationale
+
+설계 근거 (컬럼 정의·동기 정책·status enum) 는 [`_overview.md`](./_overview.md) 의 §2·§4·§7. 별도 승인 라벨링의 의사결정 배경은 [`cafe24-restricted-scopes.md ## Rationale`](../cafe24-restricted-scopes.md#rationale).

```

---

### 파일 61: spec/conventions/cafe24-api-catalog/privacy.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/conventions/cafe24-api-catalog/privacy.md b/spec/conventions/cafe24-api-catalog/privacy.md
index c97f8277..50b3d0ac 100644
--- a/spec/conventions/cafe24-api-catalog/privacy.md
+++ b/spec/conventions/cafe24-api-catalog/privacy.md
@@ -4,13 +4,19 @@
 
 base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
 
+> **별도 승인 필요** — 본 resource 의 `mall.read_privacy` / `mall.write_privacy` scope 는 카페24 본사가 별도 승인한 클라이언트만 사용할 수 있다 (명단 SoT: [`cafe24-restricted-scopes.md §1`](../cafe24-restricted-scopes.md#1-scope-단위-별도-승인-resource-전체-영향)). 모든 row 의 `restricted` 컬럼 = `scope`, 대응 backend 메타데이터 `restrictedApproval.level='scope'`, `approvalGroup='privacy'`.
+
 ## 표
 
-| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
-|----|---|---|---|---|---|---|---|---|
-| `customers_privacy_get` | 회원 개인정보 조회 | Retrieve a customer information | GET | `privacy/customers/{member_id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-information) |
-| `customers_privacy_list` | 회원 개인정보 목록 조회 | Retrieve a list of customer information | GET | `privacy/customers` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-information) |
-| `customers_privacy_count` | 회원 개인정보 개수 조회 | Retrieve a count of customer information | GET | `privacy/customers/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-information) |
-| `customers_privacy_update` | 회원 개인정보 수정 | Update a customer information | PUT | `privacy/customers/{member_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-information) |
-| `products_wishlist_customers_list` | 위시리스트 보유 회원 목록 | Retrieve a list of customers with a product in wishlist | GET | `products/{product_no}/wishlist/customers` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers-with-a-product-in-wishlist) |
-| `products_wishlist_customers_count` | 위시리스트 보유 회원 수 | Retrieve a count of customers with a product in wishlist | GET | `products/{product_no}/wishlist/customers/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customers-with-a-product-in-wishlist) |
+| id | 라벨 (한) | English title | method | path | scope | restricted | paginated | status | docs |
+|----|---|---|---|---|---|---|---|---|---|
+| `customers_privacy_get` | 회원 개인정보 조회 | Retrieve a customer information | GET | `privacy/customers/{member_id}` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-information) |
+| `customers_privacy_list` | 회원 개인정보 목록 조회 | Retrieve a list of customer information | GET | `privacy/customers` | read | scope | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-information) |
+| `customers_privacy_count` | 회원 개인정보 개수 조회 | Retrieve a count of customer information | GET | `privacy/customers/count` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-information) |
+| `customers_privacy_update` | 회원 개인정보 수정 | Update a customer information | PUT | `privacy/customers/{member_id}` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-information) |
+| `products_wishlist_customers_list` | 위시리스트 보유 회원 목록 | Retrieve a list of customers with a product in wishlist | GET | `products/{product_no}/wishlist/customers` | read | scope | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers-with-a-product-in-wishlist) |
+| `products_wishlist_customers_count` | 위시리스트 보유 회원 수 | Retrieve a count of customers with a product in wishlist | GET | `products/{product_no}/wishlist/customers/count` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customers-with-a-product-in-wishlist) |
+
+## Rationale
+
+설계 근거 (컬럼 정의·동기 정책·status enum) 는 [`_overview.md`](./_overview.md) 의 §2·§4·§7. 별도 승인 라벨링의 의사결정 배경은 [`cafe24-restricted-scopes.md ## Rationale`](../cafe24-restricted-scopes.md#rationale).

```

---

### 파일 62: spec/conventions/cafe24-api-catalog/store.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/conventions/cafe24-api-catalog/store.md b/spec/conventions/cafe24-api-catalog/store.md
index f6671121..1c5e770f 100644
--- a/spec/conventions/cafe24-api-catalog/store.md
+++ b/spec/conventions/cafe24-api-catalog/store.md
@@ -4,113 +4,121 @@
 
 base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`
 
+> **일부 operation 별도 승인 필요** — `mall.read_store` / `mall.write_store` 자체는 일반 사용 가능하지만, 안의 일부 operation (Activitylogs, Menus, Naverpay/Kakaopay setting, Paymentgateway 관련, Financials paymentgateway) 은 카페24 본사가 별도 승인한 클라이언트만 사용할 수 있다. 해당 row 만 `restricted: operation` 으로 표기되며, 대응 backend 메타데이터의 `restrictedApproval.level='operation'` + `approvalGroup` 이 `activitylogs` / `menus` / `naverpay_setting` / `kakaopay_setting` / `pg_settings` 중 하나로 채워진다. 자매 일반 operation 의 `restricted` 컬럼은 빈칸 유지. 명단 SoT: [`cafe24-restricted-scopes.md §2`](../cafe24-restricted-scopes.md#2-operation-단위-별도-승인-store-scope-안의-일부).
+
+## Rationale
+
+설계 근거 (컬럼 정의·동기 정책·status enum) 는 [`_overview.md`](./_overview.md) 의 §2·§4·§7. 별도 승인 라벨링의 의사결정 배경은 [`cafe24-restricted-scopes.md ## Rationale`](../cafe24-restricted-scopes.md#rationale).
+>
+> ※ `paymentmethods_list` / `paymentmethods_paymentproviders_list` / `paymentmethods_paymentproviders_update_display` 는 사용자 자료에 명시되지 않아 빈칸 유지. 공식 문서 재검증 후 별도 승인 대상으로 확인되면 동시 갱신.
+
 ## 표
 
-| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
-|----|---|---|---|---|---|---|---|---|
-| `store_get` | 상점 정보 조회 | Retrieve store details | GET | `store` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-store-details) |
-| `shops_list` | 멀티쇼핑몰 목록 조회 | Retrieve a list of shops | GET | `shops` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-shops) |
-| `shops_get` | 멀티쇼핑몰 단건 조회 | Retrieve a shop | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-shop) |
-| `activitylogs_list` | 액션 로그 목록 | Retrieve a list of action logs | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-action-logs) |
-| `activitylogs_get` | 액션 로그 단건 조회 | Retrieve an action log | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-action-log) |
-| `automessages_arguments_get` | 자동 메시지 변수 목록 | Retrieve the list of available variables for automated messages | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-list-of-available-variables-for-automated-messages) |
-| `automessages_setting_get` | 자동 메시지 설정 조회 | Retrieve the automated message settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-automated-message-settings) |
-| `automessages_setting_update` | 자동 메시지 설정 수정 | Update an automated message | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-automated-message) |
-| `benefits_setting_get` | 혜택 설정 조회 | Retrieve incentive settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-incentive-settings) |
-| `benefits_setting_update` | 혜택 설정 수정 | Update incentive settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-incentive-settings) |
-| `boards_setting_get` | 게시판 설정 조회 (store) | Retrieve board settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-board-settings) |
-| `boards_setting_update` | 게시판 설정 수정 (store) | Update board settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-board-settings) |
-| `carts_setting_get` | 장바구니 설정 조회 | Retrieve carts settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-carts-settings) |
-| `carts_setting_update` | 장바구니 설정 수정 | Update carts settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-carts-settings) |
-| `categories_properties_setting_get` | 카테고리 진열 추가 설정 조회 | Retrieve additional settings for products in the list | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-additional-settings-for-products-in-the-list) |
-| `categories_properties_setting_update` | 카테고리 진열 추가 설정 수정 | Update additional settings for products in the list | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-additional-settings-for-products-in-the-list) |
-| `coupons_setting_get` | 쿠폰 설정 조회 | Retrieve coupon settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-coupon-settings) |
-| `coupons_setting_update` | 쿠폰 설정 수정 | Update coupon settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-coupon-settings) |
-| `currency_get` | 통화 설정 조회 | Retrieve currency settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-currency-settings) |
-| `currency_update` | 통화 수정 | Update a currency | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-currency) |
-| `customers_setting_get` | 회원 관련 설정 조회 | Retrieve member related settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-member-related-settings) |
-| `customers_setting_update` | 회원 관련 설정 수정 | Update customers setting | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-customers-setting) |
-| `dashboard_get` | 대시보드 조회 | Retrieve a dashboard | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-dashboard) |
-| `financials_paymentgateway_get` | 결제대행사 계약 정보 조회 | Retrieve a list of payment gateway contract details | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-payment-gateway-contract-details) |
-| `financials_store_get` | 상점 거래 정보 조회 | Retrieve the transaction information of a store | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-transaction-information-of-a-store) |
-| `images_setting_get` | 상품 이미지 크기 설정 조회 | Retrieve product image size settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-product-image-size-settings) |
-| `images_setting_update` | 상품 이미지 크기 설정 수정 | Update product image size settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-product-image-size-settings) |
-| `information_get` | 상점 정책 조회 | Retrieve store policies | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-store-policies) |
-| `information_update` | 상점 정책 수정 | Update store policies | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-store-policies) |
-| `kakaoalimtalk_profile_get` | 카카오 채널 발신자 프로필 키 조회 | Retrieve a Kakao channel sender profile key | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-kakao-channel-sender-profile-key) |
-| `kakaoalimtalk_setting_get` | 카카오 알림톡 설정 조회 | Retrieve the Kakao info talk settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-kakao-info-talk-settings) |
-| `kakaoalimtalk_setting_update` | 카카오 알림톡 설정 수정 | Update the Kakao info talk settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-the-kakao-info-talk-settings) |
-| `kakaopay_setting_get` | 카카오페이 주문 설정 조회 | Retrieve settings for kakaopay orders | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-settings-for-kakaopay-orders) |
-| `kakaopay_setting_update` | 카카오페이 주문 설정 수정 | Update settings for kakaopay orders | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-settings-for-kakaopay-orders) |
-| `mains_properties_setting_get` | 메인 진열 추가 설정 조회 | Retrieve additional settings for products on the main screen | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-additional-settings-for-products-on-the-main-screen) |
-| `mains_properties_setting_update` | 메인 진열 추가 설정 수정 | Update additional settings for products on the main screen | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-additional-settings-for-products-on-the-main-screen) |
-| `menus_get` | 메뉴 조회 | Retrieve menus | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-menus) |
-| `mobile_setting_get` | 모바일 설정 조회 | Retrieve mobile settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-mobile-settings) |
-| `mobile_setting_update` | 모바일 설정 수정 | Update mobile settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-mobile-settings) |
-| `naverpay_setting_get` | 네이버페이 설정 조회 | Retrieve Naver Pay settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-naver-pay-settings) |
-| `naverpay_setting_create` | 네이버페이 설정 생성 | Create Naver Pay settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-naver-pay-settings) |
-| `naverpay_setting_update` | 네이버페이 설정 수정 | Update Naver Pay settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-naver-pay-settings) |
-| `orderform_setting_get` | 주문서 양식 설정 조회 | Retrieve the order order form settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-order-order-form-settings) |
-| `orderform_setting_update` | 주문서 양식 설정 수정 | Update the order order form settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-the-order-order-form-settings) |
-| `orders_setting_get` | 주문 설정 조회 | Retrieve order settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-order-settings) |
-| `orders_setting_update` | 주문 설정 수정 | Update order settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-order-settings) |
-| `orders_status_get` | 주문 상태 표기 조회 | Retrieve order status displayed | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-order-status-displayed) |
-| `orders_status_update` | 주문 상태 표기 수정 | Update order status displayed | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-order-status-displayed) |
-| `payment_setting_get` | 결제 설정 조회 | Retrieve payment settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-payment-settings) |
-| `payment_setting_update` | 결제 설정 수정 | Update payment settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-payment-settings) |
-| `paymentgateway_create` | 결제대행사 생성 | Create a payment gateway | POST | `paymentgateway` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-payment-gateway) |
-| `paymentgateway_update` | 결제대행사 수정 | Update a payment gateway | PUT | `paymentgateway/{paymentgateway_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-payment-gateway) |
-| `paymentgateway_delete` | 결제대행사 삭제 | Delete a payment gateway | DELETE | `paymentgateway/{paymentgateway_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-payment-gateway) |
-| `paymentgateway_paymentmethods_list` | 결제대행사 결제수단 목록 | Retrieve a list of payment gateway methods | GET | `paymentgateway/paymentmethods` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-payment-gateway-methods) |
-| `paymentgateway_paymentmethods_create` | 결제대행사 결제수단 생성 | Create a payment gateway method | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-payment-gateway-method) |
-| `paymentgateway_paymentmethods_update` | 결제대행사 결제수단 수정 | Update a payment method of a payment gateway | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-payment-method-of-a-payment-gateway) |
-| `paymentgateway_paymentmethods_delete` | 결제대행사 결제수단 삭제 | Delete a payment method of a payment gateway | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-payment-method-of-a-payment-gateway) |
-| `paymentmethods_list` | 결제수단 목록 | Retrieve a list of payment methods | GET | `paymentmethods` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-payment-methods) |
-| `paymentmethods_paymentproviders_list` | 결제수단별 제공사 목록 | Retrieve a list of providers by payment method | GET | `paymentmethods/paymentproviders` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-providers-by-payment-method) |
-| `paymentmethods_paymentproviders_update_display` | 결제수단 노출 상태 수정 | Update the display status of a payment method | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-the-display-status-of-a-payment-method) |
-| `paymentservices_get` | PG 설정 목록 조회 | Retrieve a list of PG settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-pg-settings) |
-| `points_setting_get` | 적립금 설정 조회 | Retrieve points settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-points-settings) |
-| `points_setting_update` | 적립금 설정 수정 | Update points settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-points-settings) |
-| `policy_get` | 상점 프로필 조회 | Retrieve a store profile | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-store-profile) |
-| `policy_update` | 상점 프로필 수정 | Update a store profile | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-store-profile) |
-| `privacy_boards_get` | 게시판 개인정보 정책 조회 | Retrieve privacy policy for posting on board | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-privacy-policy-for-posting-on-board) |
-| `privacy_boards_update` | 게시판 개인정보 정책 수정 | Update privacy policy for posting on board | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-privacy-policy-for-posting-on-board) |
-| `privacy_join_get` | 회원가입 개인정보 정책 조회 | Retrieve privacy policy for signup | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-privacy-policy-for-signup) |
-| `privacy_join_update` | 회원가입 개인정보 정책 수정 | Update privacy policy for signup | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-privacy-policy-for-signup) |
-| `privacy_orders_get` | 주문 개인정보 정책 조회 | Retrieve privacy policy for checkout | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-privacy-policy-for-checkout) |
-| `privacy_orders_update` | 주문 개인정보 정책 수정 | Update privacy policy for checkout | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-privacy-policy-for-checkout) |
-| `products_display_setting_list` | 상품 진열 설정 목록 | List all products display setting | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#list-all-products-display-setting) |
-| `products_display_setting_update` | 상품 진열 설정 수정 | Update a products display setting | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-products-display-setting) |
-| `products_properties_setting_get` | 상품 상세 추가 설정 조회 | Retrieve additional settings for product details | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-additional-settings-for-product-details) |
-| `products_properties_setting_update` | 상품 상세 추가 설정 수정 | Update additional settings for product details | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-additional-settings-for-product-details) |
-| `products_setting_get` | 상품 설정 조회 | Retrieve product settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-product-settings) |
-| `redirects_list` | 리다이렉트 목록 | Retrieve a list of redirects | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-redirects) |
-| `redirects_create` | 리다이렉트 생성 | Create a redirect | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-redirect) |
-| `redirects_update` | 리다이렉트 수정 | Update a redirect | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-redirect) |
-| `redirects_delete` | 리다이렉트 삭제 | Delete a redirect | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-redirect) |
-| `restocknotification_setting_get` | 재입고 알림 설정 조회 | Retrieve restocknotification settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-restocknotification-settings) |
-| `restocknotification_setting_update` | 재입고 알림 설정 수정 | Update restocknotification settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#updated-restocknotification-settings) |
-| `seo_setting_get` | SEO 설정 조회 | Retrieve SEO settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-seo-settings) |
-| `seo_setting_update` | SEO 설정 수정 | Update store SEO settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-store-seo-settings) |
-| `shippingmanager_get` | 배송 매니저 활성화 정보 | Retrieve activation information for shipping manager | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-activation-information-for-shipping-manager) |
-| `sms_setting_get` | SMS 설정 조회 | Retrieve SMS settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-sms-settings) |
-| `sms_setting_update` | SMS 설정 수정 | Update SMS settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-sms-settings) |
-| `socials_apple_get` | Apple 로그인 연동 상세 | Apple login sync details | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#apple-login-sync-details) |
-| `socials_apple_settings_get` | Apple 로그인 연동 설정 | Apple login sync settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#apple-login-sync-settings) |
-| `socials_kakaosync_get` | 카카오 싱크 상세 | Kakao sync details | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#kakao-sync-details) |
-| `socials_kakaosync_update` | 카카오 싱크 수정 | Kakao sync updates | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#kakao-sync-updates) |
-| `socials_naverlogin_get` | 네이버 로그인 상세 | Naver login details | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#naver-login-details) |
-| `socials_naverlogin_update` | 네이버 로그인 수정 | Update Naver login settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-naver-login-settings) |
-| `socials_navershopping_get` | 네이버 쇼핑 설정 | Naver shopping settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#naver-shopping-settings) |
-| `store_accounts_list` | 상점 계좌 목록 | Retrieve a list of store bank accounts | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-store-bank-accounts) |
-| `store_dropshipping_get` | 위탁배송 설정 조회 | Retrieve dropshipping settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-dropshipping-settings) |
-| `store_dropshipping_manage` | 위탁배송 설정 관리 | Manage dropshipping settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#manage-dropshipping-settings) |
-| `store_setting_get` | 상점 보안 설정 조회 | Retrieve store security settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-store-security-settings) |
-| `store_setting_update` | 상점 보안 설정 수정 | Edit store security settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-store-security-settings) |
-| `subscription_shipments_setting_list` | 정기배송 상품 목록 | Retrieve a list of subscription products | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-subscription-products) |
-| `subscription_shipments_setting_create_rule` | 정기배송 결제 규칙 생성 | Create a subscription payment rule | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-subscription-payment-rule) |
-| `subscription_shipments_setting_update` | 정기배송 상품 수정 | Update subscription products | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-subscription-products) |
-| `subscription_shipments_setting_delete` | 정기배송 상품 삭제 | Delete subscription products | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-subscription-products) |
-| `taxmanager_get` | 세금 매니저 활성화 정보 | Retrieve activation information for tax manager | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-activation-information-for-tax-manager) |
-| `users_list` | 운영자 사용자 목록 | Retrieve a list of admin users | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-admin-users) |
-| `users_get` | 운영자 사용자 상세 | Retrieve admin user details | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-admin-user-details) |
+| id | 라벨 (한) | English title | method | path | scope | restricted | paginated | status | docs |
+|----|---|---|---|---|---|---|---|---|---|
+| `store_get` | 상점 정보 조회 | Retrieve store details | GET | `store` | read |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-store-details) |
+| `shops_list` | 멀티쇼핑몰 목록 조회 | Retrieve a list of shops | GET | `shops` | read |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-shops) |
+| `shops_get` | 멀티쇼핑몰 단건 조회 | Retrieve a shop | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-shop) |
+| `activitylogs_list` | 액션 로그 목록 | Retrieve a list of action logs | ? | ? | ? | operation | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-action-logs) |
+| `activitylogs_get` | 액션 로그 단건 조회 | Retrieve an action log | ? | ? | ? | operation |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-action-log) |
+| `automessages_arguments_get` | 자동 메시지 변수 목록 | Retrieve the list of available variables for automated messages | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-list-of-available-variables-for-automated-messages) |
+| `automessages_setting_get` | 자동 메시지 설정 조회 | Retrieve the automated message settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-automated-message-settings) |
+| `automessages_setting_update` | 자동 메시지 설정 수정 | Update an automated message | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-automated-message) |
+| `benefits_setting_get` | 혜택 설정 조회 | Retrieve incentive settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-incentive-settings) |
+| `benefits_setting_update` | 혜택 설정 수정 | Update incentive settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-incentive-settings) |
+| `boards_setting_get` | 게시판 설정 조회 (store) | Retrieve board settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-board-settings) |
+| `boards_setting_update` | 게시판 설정 수정 (store) | Update board settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-board-settings) |
+| `carts_setting_get` | 장바구니 설정 조회 | Retrieve carts settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-carts-settings) |
+| `carts_setting_update` | 장바구니 설정 수정 | Update carts settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-carts-settings) |
+| `categories_properties_setting_get` | 카테고리 진열 추가 설정 조회 | Retrieve additional settings for products in the list | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-additional-settings-for-products-in-the-list) |
+| `categories_properties_setting_update` | 카테고리 진열 추가 설정 수정 | Update additional settings for products in the list | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-additional-settings-for-products-in-the-list) |
+| `coupons_setting_get` | 쿠폰 설정 조회 | Retrieve coupon settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-coupon-settings) |
+| `coupons_setting_update` | 쿠폰 설정 수정 | Update coupon settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-coupon-settings) |
+| `currency_get` | 통화 설정 조회 | Retrieve currency settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-currency-settings) |
+| `currency_update` | 통화 수정 | Update a currency | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-currency) |
+| `customers_setting_get` | 회원 관련 설정 조회 | Retrieve member related settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-member-related-settings) |
+| `customers_setting_update` | 회원 관련 설정 수정 | Update customers setting | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-customers-setting) |
+| `dashboard_get` | 대시보드 조회 | Retrieve a dashboard | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-dashboard) |
+| `financials_paymentgateway_get` | 결제대행사 계약 정보 조회 | Retrieve a list of payment gateway contract details | ? | ? | ? | operation |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-payment-gateway-contract-details) |
+| `financials_store_get` | 상점 거래 정보 조회 | Retrieve the transaction information of a store | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-transaction-information-of-a-store) |
+| `images_setting_get` | 상품 이미지 크기 설정 조회 | Retrieve product image size settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-product-image-size-settings) |
+| `images_setting_update` | 상품 이미지 크기 설정 수정 | Update product image size settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-product-image-size-settings) |
+| `information_get` | 상점 정책 조회 | Retrieve store policies | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-store-policies) |
+| `information_update` | 상점 정책 수정 | Update store policies | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-store-policies) |
+| `kakaoalimtalk_profile_get` | 카카오 채널 발신자 프로필 키 조회 | Retrieve a Kakao channel sender profile key | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-kakao-channel-sender-profile-key) |
+| `kakaoalimtalk_setting_get` | 카카오 알림톡 설정 조회 | Retrieve the Kakao info talk settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-kakao-info-talk-settings) |
+| `kakaoalimtalk_setting_update` | 카카오 알림톡 설정 수정 | Update the Kakao info talk settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-the-kakao-info-talk-settings) |
+| `kakaopay_setting_get` | 카카오페이 주문 설정 조회 | Retrieve settings for kakaopay orders | ? | ? | ? | operation |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-settings-for-kakaopay-orders) |
+| `kakaopay_setting_update` | 카카오페이 주문 설정 수정 | Update settings for kakaopay orders | ? | ? | ? | operation |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-settings-for-kakaopay-orders) |
+| `mains_properties_setting_get` | 메인 진열 추가 설정 조회 | Retrieve additional settings for products on the main screen | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-additional-settings-for-products-on-the-main-screen) |
+| `mains_properties_setting_update` | 메인 진열 추가 설정 수정 | Update additional settings for products on the main screen | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-additional-settings-for-products-on-the-main-screen) |
+| `menus_get` | 메뉴 조회 | Retrieve menus | ? | ? | ? | operation |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-menus) |
+| `mobile_setting_get` | 모바일 설정 조회 | Retrieve mobile settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-mobile-settings) |
+| `mobile_setting_update` | 모바일 설정 수정 | Update mobile settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-mobile-settings) |
+| `naverpay_setting_get` | 네이버페이 설정 조회 | Retrieve Naver Pay settings | ? | ? | ? | operation |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-naver-pay-settings) |
+| `naverpay_setting_create` | 네이버페이 설정 생성 | Create Naver Pay settings | ? | ? | ? | operation |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-naver-pay-settings) |
+| `naverpay_setting_update` | 네이버페이 설정 수정 | Update Naver Pay settings | ? | ? | ? | operation |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-naver-pay-settings) |
+| `orderform_setting_get` | 주문서 양식 설정 조회 | Retrieve the order order form settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-order-order-form-settings) |
+| `orderform_setting_update` | 주문서 양식 설정 수정 | Update the order order form settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-the-order-order-form-settings) |
+| `orders_setting_get` | 주문 설정 조회 | Retrieve order settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-order-settings) |
+| `orders_setting_update` | 주문 설정 수정 | Update order settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-order-settings) |
+| `orders_status_get` | 주문 상태 표기 조회 | Retrieve order status displayed | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-order-status-displayed) |
+| `orders_status_update` | 주문 상태 표기 수정 | Update order status displayed | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-order-status-displayed) |
+| `payment_setting_get` | 결제 설정 조회 | Retrieve payment settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-payment-settings) |
+| `payment_setting_update` | 결제 설정 수정 | Update payment settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-payment-settings) |
+| `paymentgateway_create` | 결제대행사 생성 | Create a payment gateway | POST | `paymentgateway` | write | operation |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-payment-gateway) |
+| `paymentgateway_update` | 결제대행사 수정 | Update a payment gateway | PUT | `paymentgateway/{paymentgateway_id}` | write | operation |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-payment-gateway) |
+| `paymentgateway_delete` | 결제대행사 삭제 | Delete a payment gateway | DELETE | `paymentgateway/{paymentgateway_id}` | write | operation |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-payment-gateway) |
+| `paymentgateway_paymentmethods_list` | 결제대행사 결제수단 목록 | Retrieve a list of payment gateway methods | GET | `paymentgateway/paymentmethods` | read | operation |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-payment-gateway-methods) |
+| `paymentgateway_paymentmethods_create` | 결제대행사 결제수단 생성 | Create a payment gateway method | ? | ? | ? | operation |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-payment-gateway-method) |
+| `paymentgateway_paymentmethods_update` | 결제대행사 결제수단 수정 | Update a payment method of a payment gateway | ? | ? | ? | operation |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-payment-method-of-a-payment-gateway) |
+| `paymentgateway_paymentmethods_delete` | 결제대행사 결제수단 삭제 | Delete a payment method of a payment gateway | ? | ? | ? | operation |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-payment-method-of-a-payment-gateway) |
+| `paymentmethods_list` | 결제수단 목록 | Retrieve a list of payment methods | GET | `paymentmethods` | read |  | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-payment-methods) |
+| `paymentmethods_paymentproviders_list` | 결제수단별 제공사 목록 | Retrieve a list of providers by payment method | GET | `paymentmethods/paymentproviders` | read |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-providers-by-payment-method) |
+| `paymentmethods_paymentproviders_update_display` | 결제수단 노출 상태 수정 | Update the display status of a payment method | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-the-display-status-of-a-payment-method) |
+| `paymentservices_get` | PG 설정 목록 조회 | Retrieve a list of PG settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-pg-settings) |
+| `points_setting_get` | 적립금 설정 조회 | Retrieve points settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-points-settings) |
+| `points_setting_update` | 적립금 설정 수정 | Update points settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-points-settings) |
+| `policy_get` | 상점 프로필 조회 | Retrieve a store profile | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-store-profile) |
+| `policy_update` | 상점 프로필 수정 | Update a store profile | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-store-profile) |
+| `privacy_boards_get` | 게시판 개인정보 정책 조회 | Retrieve privacy policy for posting on board | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-privacy-policy-for-posting-on-board) |
+| `privacy_boards_update` | 게시판 개인정보 정책 수정 | Update privacy policy for posting on board | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-privacy-policy-for-posting-on-board) |
+| `privacy_join_get` | 회원가입 개인정보 정책 조회 | Retrieve privacy policy for signup | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-privacy-policy-for-signup) |
+| `privacy_join_update` | 회원가입 개인정보 정책 수정 | Update privacy policy for signup | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-privacy-policy-for-signup) |
+| `privacy_orders_get` | 주문 개인정보 정책 조회 | Retrieve privacy policy for checkout | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-privacy-policy-for-checkout) |
+| `privacy_orders_update` | 주문 개인정보 정책 수정 | Update privacy policy for checkout | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-privacy-policy-for-checkout) |
+| `products_display_setting_list` | 상품 진열 설정 목록 | List all products display setting | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#list-all-products-display-setting) |
+| `products_display_setting_update` | 상품 진열 설정 수정 | Update a products display setting | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-products-display-setting) |
+| `products_properties_setting_get` | 상품 상세 추가 설정 조회 | Retrieve additional settings for product details | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-additional-settings-for-product-details) |
+| `products_properties_setting_update` | 상품 상세 추가 설정 수정 | Update additional settings for product details | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-additional-settings-for-product-details) |
+| `products_setting_get` | 상품 설정 조회 | Retrieve product settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-product-settings) |
+| `redirects_list` | 리다이렉트 목록 | Retrieve a list of redirects | ? | ? | ? |  | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-redirects) |
+| `redirects_create` | 리다이렉트 생성 | Create a redirect | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-redirect) |
+| `redirects_update` | 리다이렉트 수정 | Update a redirect | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-redirect) |
+| `redirects_delete` | 리다이렉트 삭제 | Delete a redirect | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-redirect) |
+| `restocknotification_setting_get` | 재입고 알림 설정 조회 | Retrieve restocknotification settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-restocknotification-settings) |
+| `restocknotification_setting_update` | 재입고 알림 설정 수정 | Update restocknotification settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#updated-restocknotification-settings) |
+| `seo_setting_get` | SEO 설정 조회 | Retrieve SEO settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-seo-settings) |
+| `seo_setting_update` | SEO 설정 수정 | Update store SEO settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-store-seo-settings) |
+| `shippingmanager_get` | 배송 매니저 활성화 정보 | Retrieve activation information for shipping manager | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-activation-information-for-shipping-manager) |
+| `sms_setting_get` | SMS 설정 조회 | Retrieve SMS settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-sms-settings) |
+| `sms_setting_update` | SMS 설정 수정 | Update SMS settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-sms-settings) |
+| `socials_apple_get` | Apple 로그인 연동 상세 | Apple login sync details | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#apple-login-sync-details) |
+| `socials_apple_settings_get` | Apple 로그인 연동 설정 | Apple login sync settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#apple-login-sync-settings) |
+| `socials_kakaosync_get` | 카카오 싱크 상세 | Kakao sync details | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#kakao-sync-details) |
+| `socials_kakaosync_update` | 카카오 싱크 수정 | Kakao sync updates | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#kakao-sync-updates) |
+| `socials_naverlogin_get` | 네이버 로그인 상세 | Naver login details | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#naver-login-details) |
+| `socials_naverlogin_update` | 네이버 로그인 수정 | Update Naver login settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-naver-login-settings) |
+| `socials_navershopping_get` | 네이버 쇼핑 설정 | Naver shopping settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#naver-shopping-settings) |
+| `store_accounts_list` | 상점 계좌 목록 | Retrieve a list of store bank accounts | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-store-bank-accounts) |
+| `store_dropshipping_get` | 위탁배송 설정 조회 | Retrieve dropshipping settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-dropshipping-settings) |
+| `store_dropshipping_manage` | 위탁배송 설정 관리 | Manage dropshipping settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#manage-dropshipping-settings) |
+| `store_setting_get` | 상점 보안 설정 조회 | Retrieve store security settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-store-security-settings) |
+| `store_setting_update` | 상점 보안 설정 수정 | Edit store security settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-store-security-settings) |
+| `subscription_shipments_setting_list` | 정기배송 상품 목록 | Retrieve a list of subscription products | ? | ? | ? |  | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-subscription-products) |
+| `subscription_shipments_setting_create_rule` | 정기배송 결제 규칙 생성 | Create a subscription payment rule | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-subscription-payment-rule) |
+| `subscription_shipments_setting_update` | 정기배송 상품 수정 | Update subscription products | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-subscription-products) |
+| `subscription_shipments_setting_delete` | 정기배송 상품 삭제 | Delete subscription products | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-subscription-products) |
+| `taxmanager_get` | 세금 매니저 활성화 정보 | Retrieve activation information for tax manager | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-activation-information-for-tax-manager) |
+| `users_list` | 운영자 사용자 목록 | Retrieve a list of admin users | ? | ? | ? |  | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-admin-users) |
+| `users_get` | 운영자 사용자 상세 | Retrieve admin user details | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-admin-user-details) |

```

---

### 파일 63: spec/conventions/cafe24-api-metadata.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/conventions/cafe24-api-metadata.md b/spec/conventions/cafe24-api-metadata.md
index ea9b76b2..31f0b308 100644
--- a/spec/conventions/cafe24-api-metadata.md
+++ b/spec/conventions/cafe24-api-metadata.md
@@ -63,9 +63,44 @@ interface Cafe24OperationMetadata {
 
   responseShape?: 'list' | 'single' | 'empty';
   paginated?: boolean;
+
+  // 별도 승인 라벨링 — 명단 SoT 는 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md).
+  // catalog-sync.spec.ts 가 카탈로그 row 의 `restricted` 컬럼과 양방향 동기 검증.
+  restrictedApproval?: {
+    level: 'scope' | 'operation' | 'program';
+    // approvalGroup — UI 메시지/tooltip 묶음 식별자. `Cafe24Resource.category` enum 및
+    // `Node.category` 와의 명명 충돌을 회피하기 위해 `category` 가 아닌 `approvalGroup` 채택
+    // (cafe24-api-metadata 컨벤션의 `scopeType` 채택 선례와 동일 패턴).
+    approvalGroup:
+      | 'mileage' | 'notification' | 'privacy'         // scope 전체 (resource 단위)
+      | 'activitylogs' | 'menus'                        // store 안 operation 단위
+      | 'naverpay_setting' | 'kakaopay_setting'
+      | 'pg_settings'                                   // paymentgateway_* + paymentgateway_paymentmethods_* + financials_paymentgateway_get 묶음
+      | 'analytics';                                    // 별도 프로그램 (placeholder, catalog 대상 외)
+    docsUrl?: string;
+    inquiryUrl: string;                                 // 카페24 개발자센터 안내 링크
+  };
 }
 ```
 
+**`restrictedApproval` 의 의미**
+
+본 필드는 카페24 본사가 별도 승인한 클라이언트만 호출할 수 있는 operation 을 식별한다. 명단의 single-source-of-truth 는 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md). UI 4 화면 (위저드 / 통합 상세 Scope 탭 / Cafe24 노드 Operation 드롭다운 / AI Agent allowlist) 이 본 필드를 읽어 ⚠ 배지·tooltip 을 자동 렌더한다. `level='scope'` 인 row 는 같은 resource (mileage/notification/privacy) 의 모든 자매 operation 에 같은 라벨이 자동 적용되므로 backend 메타데이터에서는 row 별로 빠짐없이 채운다. `level='program'` (Analytics 등) 인 row 는 catalog 대상이 아니므로 catalog-sync 의 `restricted` 컬럼 정합성 검증에서 **제외**된다 ([_overview §4](./cafe24-api-catalog/_overview.md#4-동기-정책-sync-contract) 검증 규칙 8 참고).
+
+**`approvalGroup` 이 묶는 operation 집합**
+
+| `approvalGroup` 값 | 묶이는 operation id 패턴 |
+|---|---|
+| `mileage` | mileage resource 의 모든 supported row |
+| `notification` | notification resource 의 모든 supported row |
+| `privacy` | privacy resource 의 모든 supported row |
+| `activitylogs` | store resource 의 `activitylogs_list`, `activitylogs_get` |
+| `menus` | store resource 의 `menus_get` |
+| `naverpay_setting` | store resource 의 `naverpay_setting_*` |
+| `kakaopay_setting` | store resource 의 `kakaopay_setting_*` |
+| `pg_settings` | store resource 의 `paymentgateway_*` + `paymentgateway_paymentmethods_*` + `financials_paymentgateway_get` (UI 메시지 단일화 위해 PG 관련 3 영역 묶음) |
+| `analytics` | Cafe24 Analytics API (catalog 외 트랙, placeholder) |
+
 ## 3. 예시 — `product` Resource 일부
 
 ```ts
@@ -155,12 +190,14 @@ Cafe24 Admin API 의 모든 **POST/PUT** 본문은 다음 형태로 직렬화된
 3. `id` 는 `<resource>_<verb>` 형식 (예: `product_list`, `order_update_status`). 중복 금지 (resource 내).
 4. `scopeType` 은 read/write 결정 — scope 매핑에 사용.
 5. [`cafe24-api-catalog/<resource>.md`](./cafe24-api-catalog/_overview.md) 의 표에 해당 row 의 `status` 를 `planned → supported` 로 갱신하고 `method` / `path` / `scope` / `paginated` 컬럼을 채운다. 카탈로그에 row 자체가 없으면 새로 추가.
+   - 추가로 별도 승인 대상인 경우 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md) 명단과 비교해 catalog 의 `restricted` 컬럼(`scope` / `op` / 빈칸) 과 backend 메타데이터의 `restrictedApproval` 필드를 동시 갱신한다.
 6. `_overview.md` §5 의 coverage matrix 카운트도 갱신.
 7. 백엔드 단위 테스트가 자동으로 검증:
    - 모든 `id` 의 unique (resource 내)
    - 모든 `path` 의 `{placeholder}` 가 `fields` 에 정의됐는지
    - `requiredFields` 가 `fields` 의 키 부분집합인지
    - **카탈로그 ↔ 메타데이터 양방향 동기** (`catalog-sync.spec.ts`)
+   - **`restricted` 컬럼 ↔ `restrictedApproval` 양방향 동기** (`catalog-sync.spec.ts`) — catalog 가 `scope` 또는 `op` 면 메타데이터에 `restrictedApproval` 존재, 그 역도 동일. `level='program'` 은 검증 대상 제외 ([_overview §4](./cafe24-api-catalog/_overview.md#4-동기-정책-sync-contract) 검증 규칙 8 참고).
 8. **spec 본문 수정 불요** — `4-cafe24.md` 는 형식만 정의.
 
 ## 6. MCP Bridge 와의 매핑
@@ -200,3 +237,5 @@ AI Agent `mcpServers[].enabledTools` 가 비어있으면 모든 operation 이 
 | 2026-05-13 | 신규 컨벤션 — Cafe24 API metadata 의 형식·디렉토리·추가 절차 정의. `scopeType` 필드명 채택 (`Node.category` 와의 명명 충돌 회피) |
 | 2026-05-16 | 자매 카탈로그 [`cafe24-api-catalog/`](./cafe24-api-catalog/_overview.md) 신설을 반영 — §5 (옛 §4) 추가 절차에 카탈로그 row 갱신·coverage matrix 갱신·양방향 동기 테스트 단계 명시. 도입 결정은 사용자 요청 "Cafe24 docs 전수 등재" (2026-05-16). |
 | 2026-05-16 (envelope) | §4 신설 — Cafe24 Admin API 의 POST/PUT 본문 `request` envelope 규약 명문화. 코드 fix (PR #102) 와 결속. 운영에서 `product_update` 가 `400 "Please enter the Request parameter."` 로 실패한 사례 후속. 기존 §4–§7 은 §5–§8 로 번호 +1 이동. consistency-check 세션: `review/consistency/2026/05/16/15_45_35/` (BLOCK: NO). |
+| 2026-05-17 | §2 `Cafe24OperationMetadata.restrictedApproval` optional 필드 추가 + §5 절차에 catalog `restricted` 컬럼 동시 갱신 의무 명문화 + §5 step 7 에 양방향 동기 검증 규칙 추가. SoT 는 신규 컨벤션 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md). 사용자 보고 — 카페24 본사 승인 필요 권한이 사용자에게 식별되지 않는 UX 문제 해소. consistency-check 세션: `review/consistency/2026/05/17/12_12_46/` (BLOCK: NO). |
+| 2026-05-17 (drift fix) | §2 `restrictedApproval.category` → `approvalGroup` 재명명 — `Cafe24Resource.category` enum 및 `Node.category` 와의 명명 충돌 회피 (`scopeType` 채택 선례와 동일 패턴). impl-prep consistency-check 의 W-8 흡수. catalog `restricted` 값 `op` 도 `operation` 으로 통일하여 메타데이터 `level='operation'` 과 토큰 일치. consistency-check 세션: `review/consistency/2026/05/17/12_37_41/` (초기 BLOCK YES → 정정 후 NO). |

```

---

### 파일 64: spec/conventions/cafe24-restricted-scopes.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/conventions/cafe24-restricted-scopes.md b/spec/conventions/cafe24-restricted-scopes.md
new file mode 100644
index 00000000..75f7ed62
--- /dev/null
+++ b/spec/conventions/cafe24-restricted-scopes.md
@@ -0,0 +1,144 @@
+# CONVENTION: Cafe24 별도 승인이 필요한 Scope · Operation
+
+> 관련 문서: [Cafe24 API Metadata 컨벤션](./cafe24-api-metadata.md) · [Cafe24 API Catalog](./cafe24-api-catalog/_overview.md) · [Spec 통합 화면 §5.8 Cafe24](../2-navigation/4-integration.md#58-cafe24) · [Spec Cafe24 노드](../4-nodes/4-integration/4-cafe24.md) · [Spec Integration 데이터 모델](../1-data-model.md#210-integration)
+
+## Overview
+
+Cafe24 Admin API 의 일부 scope·operation 은 카페24 본사가 별도로 승인한 클라이언트만 사용할 수 있다. 공식 문서가 다음 문구로 명시한다:
+
+> "해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요."
+
+본 컨벤션은 그 명단을 single-source-of-truth 로 박제한다. backend 메타데이터의 `restrictedApproval` 필드 ([cafe24-api-metadata 컨벤션 §2](./cafe24-api-metadata.md#2-operation-메타데이터-형식)) 와 catalog 파일의 `restricted` 컬럼 ([cafe24-api-catalog _overview §2](./cafe24-api-catalog/_overview.md#2-표-컬럼-정의)) 이 본 명단과 일치해야 하며, `catalog-sync.spec.ts` 가 동기 검증을 강제한다.
+
+---
+
+## 1. Scope 단위 별도 승인 (resource 전체 영향)
+
+해당 scope 가 부여된 OAuth 동의 자체가 본사 승인 없이는 실패한다. 자매 operation 모두 영향을 받는다.
+
+| Scope | Resource (catalog 파일) | 설명 |
+|---|---|---|
+| `mall.read_mileage` | [mileage.md](./cafe24-api-catalog/mileage.md) | 적립금 조회 |
+| `mall.write_mileage` | [mileage.md](./cafe24-api-catalog/mileage.md) | 적립금 수정 |
+| `mall.read_notification` | [notification.md](./cafe24-api-catalog/notification.md) | 알림 조회 |
+| `mall.write_notification` | [notification.md](./cafe24-api-catalog/notification.md) | 알림 발송 |
+| `mall.read_privacy` | [privacy.md](./cafe24-api-catalog/privacy.md) | 개인정보 조회 |
+| `mall.write_privacy` | [privacy.md](./cafe24-api-catalog/privacy.md) | 개인정보 수정 |
+
+> 위 카탈로그의 모든 row 는 catalog 표의 `restricted` 컬럼 = `scope`, backend 메타데이터의 `restrictedApproval.level='scope'` 로 표기된다.
+
+## 2. Operation 단위 별도 승인 (store scope 안의 일부)
+
+`mall.read_store` / `mall.write_store` 자체는 일반 사용 가능하지만, 안의 일부 operation 만 별도 승인 대상이다. 카탈로그 표에서 해당 row 만 `restricted: op` 로 표기한다.
+
+| 영역 | 영향 operation id (catalog [store.md](./cafe24-api-catalog/store.md)) | 설명 |
+|---|---|---|
+| Activitylogs | `activitylogs_list`, `activitylogs_get` | 활동 로그 목록/상세 조회 |
+| Financials paymentgateway | `financials_paymentgateway_get` | PG사 계약정보 조회 |
+| Menus | `menus_get` | 메뉴 조회 |
+| Naverpay setting | `naverpay_setting_get`, `naverpay_setting_create`, `naverpay_setting_update` | 네이버페이 설정 조회·등록·수정 |
+| Kakaopay setting | `kakaopay_setting_get`, `kakaopay_setting_update` | 카카오페이 설정 조회·수정 |
+| Paymentgateway | `paymentgateway_create`, `paymentgateway_update`, `paymentgateway_delete` | PG 생성·수정·삭제 |
+| Paymentgateway paymentmethods | `paymentgateway_paymentmethods_list`, `paymentgateway_paymentmethods_create`, `paymentgateway_paymentmethods_update`, `paymentgateway_paymentmethods_delete` | PG 결제수단 목록/생성·수정·삭제 |
+
+> 카탈로그 `restricted: operation` 과 메타데이터 `restrictedApproval.approvalGroup` 의 매핑은 다음과 같다:
+>
+> - Activitylogs → `approvalGroup: 'activitylogs'`
+> - Menus → `approvalGroup: 'menus'`
+> - Naverpay setting → `approvalGroup: 'naverpay_setting'`
+> - Kakaopay setting → `approvalGroup: 'kakaopay_setting'`
+> - **Paymentgateway / Paymentgateway paymentmethods / Financials paymentgateway** → `approvalGroup: 'pg_settings'` (세 영역을 하나의 PG 설정 범주로 묶어 i18n 메시지와 tooltip 을 단일화)
+
+## 3. 별도 프로그램 승인
+
+카페24 승인 제휴사에만 제공되는 별도 트랙. 본 프로젝트는 현재 직접 호출 경로를 구현하지 않으며, 본 명단은 향후 도입을 위한 placeholder 다. Cafe24 측 계약 후 별도 spec 으로 상세화한다 — 그 시점에 카탈로그 / backend 메타데이터에도 들어간다.
+
+| API | 설명 |
+|---|---|
+| Cafe24 Analytics API | 카페24 승인 제휴사에만 제공. 쇼핑몰 사용자 행동 데이터 제공 서비스 제작 용도 |
+
+> `restrictedApproval.level='program'` 인 row 는 catalog 의 `restricted` 컬럼 정합성 검증 대상에서 **제외**된다 (catalog 화 대상이 아닌 트랙). 메타데이터에는 별도 분류만 두고, UI 라벨링은 향후 도입 시 동일 메타데이터 차원을 재사용한다.
+
+## 4. 사용 정책
+
+### 4.1 사용자 안내 (UI)
+
+위 §1·§2 의 항목은 다음 4 화면에서 동일한 ⚠ 배지·tooltip 으로 표기된다:
+
+1. **통합 추가 위저드 Step 2 Scope 체크박스** ([Spec 통합 화면 §3.2 Cafe24 Public/Private](../2-navigation/4-integration.md#32-step-2-인증-정보-입력))
+2. **통합 상세 §4.4 Scope & Permissions 탭** (현재 scope · 권장 scope · 누락 scope 모두) ([Spec 통합 화면 §4.4](../2-navigation/4-integration.md#44-scope--permissions-탭-oauth-한정))
+3. **Cafe24 노드 Operation 드롭다운** ([Spec Cafe24 노드 §2](../4-nodes/4-integration/4-cafe24.md#2-설정-ui))
+4. **AI Agent allowlist UI** ([Spec Cafe24 노드 §8.3](../4-nodes/4-integration/4-cafe24.md#83-allowlist-mcpservers-enabledtools))
+
+배지 hover 시 tooltip 문구 (한국어):
+
+> "카페24 본사 승인이 필요한 권한입니다. 미승인 상태로 동의를 시도하면 `invalid_scope` 로 실패하거나, 인증 후 호출 시 403 이 반환될 수 있어요. [Cafe24 개발자센터 문의 →]"
+
+영어 (i18n):
+
+> "This permission requires Cafe24 partner approval. Without approval, the OAuth flow may reject it as `invalid_scope`, or API calls may return 403. [Contact Cafe24 Developer Center →]"
+
+### 4.2 차단 정책
+
+체크/저장은 **차단하지 않는다**. 이미 본사 승인을 받은 사용자가 있을 수 있으므로 "알고 누른다" 만 보장. 단 체크된 권한 중 별도 승인 필요 항목이 1개 이상이면 위저드 Step 2 폼 하단에 **영구 amber 경고 배너**를 띄운다 (사용자가 인지하지 못한 채 진행하는 사례 차단).
+
+### 4.3 에러 안내 (에러 발생 후)
+
+- **OAuth `invalid_scope`**: backend 의 cafe24 OAuth callback 이 응답을 파싱 후 요청한 scopes ∩ 본 명단 §1 의 교집합이 비어있지 않으면 `Integration.status_reason='oauth_invalid_scope'` 와 함께 `last_error.details.requiresCafe24Approval: string[]` 에 영향 scope 를 기록 ([Spec 통합 화면 §10.4](../2-navigation/4-integration.md#104-에러-매핑), [Spec Integration 데이터 모델 §2.10](../1-data-model.md#210-integration) `last_error` JSONB 스키마). 통합 상세 페이지가 본 단서를 읽어 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지 노출. status 는 `pending_install` 그대로 유지하여 사용자가 다시 시도 가능.
+- **노드 실행 중 `INSUFFICIENT_SCOPE (403)`**: 응답 `details` 의 기존 `missingScopes: string[]` 옆에 추가로 `requiresCafe24Approval: string[]` (누락 scope ∩ 본 명단의 교집합) 을 채워 보낸다. frontend 가 본 필드가 비어있지 않으면 별도 승인 안내 분기 메시지를 노출.
+
+### 4.4 신규 코드 추가 없음
+
+기존 `OAuth invalid_scope` 분기, `INSUFFICIENT_SCOPE (403)` 응답 모두 그대로 유지하고 `details.requiresCafe24Approval` 보강 필드 + `status_reason='oauth_invalid_scope'` 의 status_reason 열거 확장만으로 표현. 새 HTTP 상태/에러 코드 vocabulary 추가는 하지 않는다 (하위 호환).
+
+## 5. 명단 갱신 절차
+
+1. Cafe24 공식 문서를 다시 확인해 본 명단의 진위·추가/삭제를 검증.
+2. 본 문서의 §1·§2·§3 표 갱신.
+3. 영향받는 catalog 파일 (`mileage.md` / `notification.md` / `privacy.md` / `store.md` / 추가 영향 resource) 의 `restricted` 컬럼 갱신.
+4. backend 메타데이터의 `restrictedApproval` 필드 동시 갱신.
+5. `npm test --workspace backend -- catalog-sync` 로 양방향 동기 확인.
+6. UI 4 화면에서 ⚠ 표기가 새 명단을 따라 자동 갱신되는지 시각 회귀 (해당 컴포넌트는 메타데이터 기반 자동 렌더링).
+
+## 6. 참고 링크
+
+- Cafe24 Admin API 공식 문서: https://developers.cafe24.com/docs/api/admin/
+- Scope별 사용 동의 가이드: https://developers.cafe24.com/app/front/app/develop/api/scope
+- Cafe24 Analytics API: https://developers.cafe24.com/docs/ko/api/cafe24data/
+- 카페24 개발자센터 문의: https://developers.cafe24.com
+
+---
+
+## Rationale
+
+### 메타데이터 SoT 한 곳, UI 4 화면 자동 전파 (2026-05-17)
+
+**문제**: Cafe24 Admin API 중 mileage/notification/privacy 의 모든 scope 와 store 안 일부 operation 은 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. spec 에 이를 표현하는 차원이 없어 사용자가 위저드에서 일반 카테고리처럼 체크 → OAuth `invalid_scope` 거부 또는 호출 시 `INSUFFICIENT_SCOPE (403)` 으로 좌초. 원인 안내 장치 부재.
+
+**채택**: backend 메타데이터의 `Cafe24OperationMetadata.restrictedApproval` 필드와 catalog 의 `restricted` 컬럼을 SoT 로 두고, UI 4 화면 (위저드 / 통합 상세 §4.4 / 노드 Operation 드롭다운 / AI Agent allowlist) 이 같은 필드를 읽어 ⚠ 배지·tooltip·경고 배너를 자동 렌더. 명단 자체의 진위 SoT 는 본 컨벤션이 단독으로 보유한다. catalog-sync 테스트가 catalog ↔ 메타데이터 양방향 동기를 강제하므로 명단을 한 곳에서 갱신하면 코드/UI 양쪽이 자동 정합.
+
+### 기각된 대안
+
+- **(A) 사용자가 체크 시 차단** — 이미 본사 승인을 받은 합법 사용자 케이스를 막아버린다. "안내만, 차단 없음" 정책 채택. 단 체크된 항목 중 1개 이상이 별도 승인 대상이면 amber 경고 배너로 인지를 강제한다.
+- **(B) 신규 에러 코드 추가 (`CAFE24_APPROVAL_REQUIRED` 등)** — 기존 `INSUFFICIENT_SCOPE (403)` / OAuth `invalid_scope` 처리 경로를 분기시켜 client 코드 호환성에 영향. `details.requiresCafe24Approval` 보강 필드만으로 충분.
+- **(C) catalog 의 `status` enum 에 `restricted` 값 추가** — `supported` / `planned` / `deprecated` 와는 직교 차원이라 enum 확장은 의미 오염. 별도 컬럼이 정답이며, 이는 catalog _overview §2 의 `restricted` 컬럼 설명에도 "이 컬럼은 `status` 와 직교하며 `status` 의 값이 아니다" 로 명시한다.
+- **(D) 명단을 spec 본문에 직접 enumerate** — drift 위험. `cafe24-api-metadata.md` §3 의 "endpoint enumeration 을 spec 본문에 인라인하지 않는다" 정책과 동일 사유로 본 컨벤션 파일 하나에 집중.
+
+### Trade-off
+
+- mileage resource 안의 `credits_*` (예치금) 가 정확히 `mall.read_mileage` 를 쓰는지 vs 별도 scope (`mall.read_deposits` 등) 인지의 공식 분리 확인은 사용자 자료 범위 밖이다. 본 컨벤션은 사용자 자료를 1차 SoT 로 받아 scope 단위 라벨링 (`level='scope'`) 을 mileage resource 전체에 적용한다. 향후 공식 문서로 분리 확인되면 본 결정을 정정한다 (§5 명단 갱신 절차).
+- `paymentmethods_list` / `paymentmethods_paymentproviders_list` 는 사용자 자료에 명시되지 않았으므로 빈칸 유지. 별도 승인 대상으로 확인되면 §2 표 + catalog `restricted` 컬럼 + backend 메타데이터를 동시 갱신.
+
+### 출처
+
+- 사용자 보고 (2026-05-17) — 카페24 본사 승인 필요 권한이 사용자에게 식별되지 않는 UX 문제 + 별도 승인 명단 3종 표 제공.
+- consistency-check 세션: `review/consistency/2026/05/17/12_12_46/` (BLOCK: NO, WARNING 10건 — 모두 본 spec 반영 단계에서 흡수).
+
+---
+
+## CHANGELOG
+
+| 일자 | 변경 |
+|------|------|
+| 2026-05-17 | 신규 컨벤션 — 사용자 보고와 공식 문서 안내 문구를 기반으로 별도 승인 대상 명단 정식 등재. backend 메타데이터 `restrictedApproval` 필드 + catalog `restricted` 컬럼과 함께 도입. consistency-check 세션: `review/consistency/2026/05/17/12_12_46/`. |
+| 2026-05-17 (drift fix) | `restrictedApproval.category` → `approvalGroup` 재명명 + catalog `restricted` 값 `op` → `operation` 통일 (메타데이터 `level='operation'` 토큰과 일치). impl-prep consistency-check (`review/consistency/2026/05/17/12_37_41/`) C-1·W-8·W-9 흡수. 도입부에 `## Overview` 섹션 신설 (W-5). |

```
