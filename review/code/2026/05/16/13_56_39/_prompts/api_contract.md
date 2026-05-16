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

### 파일 1: backend/src/modules/integrations/dto/integration.dto.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/dto/integration.dto.ts b/backend/src/modules/integrations/dto/integration.dto.ts
index a6c87b11..2c203f96 100644
--- a/backend/src/modules/integrations/dto/integration.dto.ts
+++ b/backend/src/modules/integrations/dto/integration.dto.ts
@@ -17,11 +17,18 @@ import { Type, Transform } from 'class-transformer';
 import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
 import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
 
+// Filter parameter values accepted by GET /api/integrations#status.
+// Includes two virtual filter values (spec/2-navigation/4-integration.md
+// §2.3 + §9.1 + Rationale "Attention 가상 필터값"):
+//   - `expiring`  = status='connected' AND token_expires_at within 7d
+//   - `attention` = Expired ∪ Expiring ∪ Error (single chip surface)
+// Neither exists in the Integration.status DB enum.
 export const INTEGRATION_STATUSES = [
   'connected',
   'expiring',
   'expired',
   'error',
+  'attention',
 ] as const;
 export type IntegrationStatusFilter = (typeof INTEGRATION_STATUSES)[number];
 
@@ -66,9 +73,9 @@ export class ListIntegrationsQueryDto extends PaginationQueryDto {
   /** 통합 상태 필터 */
   @ApiPropertyOptional({
     description:
-      '통합 상태 필터. connected=정상, expiring=만료 임박, expired=만료, error=오류',
+      '통합 상태 필터. connected=정상, expiring=만료 임박(가상), expired=만료, error=오류, attention=주의 필요(가상 — expired ∪ expiring ∪ error). expiring/attention 은 DB Enum 에 없는 가상 필터값으로 서버에서 합집합 WHERE 절로 변환된다 (spec §9.1).',
     enum: INTEGRATION_STATUSES,
-    example: 'connected',
+    example: 'attention',
   })
   @IsOptional()
   @IsIn(INTEGRATION_STATUSES)

```

---

### 파일 2: backend/src/modules/integrations/integrations.service.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integrations.service.spec.ts b/backend/src/modules/integrations/integrations.service.spec.ts
index 0a11407c..64515e7e 100644
--- a/backend/src/modules/integrations/integrations.service.spec.ts
+++ b/backend/src/modules/integrations/integrations.service.spec.ts
@@ -672,6 +672,41 @@ describe('IntegrationsService', () => {
       const sql = qb.andWhere.mock.calls.map((c) => c[0]).join(' | ');
       expect(sql).not.toContain('service_type IN');
     });
+
+    // attention is a virtual filter value (spec/2-navigation/4-integration.md
+    // §2.4 + §9.1 Rationale "Attention 가상 필터값"). It compiles to the
+    // union of expired ∪ error ∪ (connected within 7d), and never matches
+    // pending_install rows — those are an explicit external-flow state.
+    it('status=attention emits union WHERE covering expired, error, and connected within 7d', async () => {
+      const qb = makeQueryBuilder({ count: 0, many: [] });
+      integrationRepo.createQueryBuilder.mockReturnValue(qb);
+      await service.findAll('ws-1', { status: 'attention' });
+      const sql = qb.andWhere.mock.calls.map((c) => c[0]).join(' | ');
+      expect(sql).toContain("'expired'");
+      expect(sql).toContain("'error'");
+      expect(sql).toContain("'connected'");
+      expect(sql).toContain('token_expires_at IS NOT NULL');
+      expect(sql).toContain('token_expires_at > NOW()');
+      expect(sql).toContain("7 days");
+    });
+
+    it('status=attention does not include pending_install rows', async () => {
+      const qb = makeQueryBuilder({ count: 0, many: [] });
+      integrationRepo.createQueryBuilder.mockReturnValue(qb);
+      await service.findAll('ws-1', { status: 'attention' });
+      const sql = qb.andWhere.mock.calls.map((c) => c[0]).join(' | ');
+      expect(sql).not.toContain("'pending_install'");
+    });
+
+    it('status=attention does not also pin status to a single value', async () => {
+      const qb = makeQueryBuilder({ count: 0, many: [] });
+      integrationRepo.createQueryBuilder.mockReturnValue(qb);
+      await service.findAll('ws-1', { status: 'attention' });
+      const sqls = qb.andWhere.mock.calls.map((c) => c[0]) as string[];
+      // The single-value branch (used for expired/error/connected filters)
+      // would emit `i.status = :s`. Attention's union must not also pin it.
+      expect(sqls.some((s) => /i\.status\s*=\s*:s\b/.test(s))).toBe(false);
+    });
   });
 
   // -----------------------------------------------------------------

```

---

### 파일 3: backend/src/modules/integrations/integrations.service.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integrations.service.ts b/backend/src/modules/integrations/integrations.service.ts
index 67240b35..b376dd8c 100644
--- a/backend/src/modules/integrations/integrations.service.ts
+++ b/backend/src/modules/integrations/integrations.service.ts
@@ -200,6 +200,18 @@ export class IntegrationsService {
       qb.andWhere('i.status = :s', { s: 'expired' });
     } else if (status === 'error') {
       qb.andWhere('i.status = :s', { s: 'error' });
+    } else if (status === 'attention') {
+      // Virtual filter — Expired ∪ Error ∪ (Connected within 7d).
+      // pending_install is excluded by design (spec §2.4): it represents an
+      // active external flow (Cafe24 Developers "Test Run") in progress, not
+      // a state that needs the user's attention here.
+      qb.andWhere(
+        `(i.status IN ('expired', 'error')
+          OR (i.status = 'connected'
+              AND i.token_expires_at IS NOT NULL
+              AND i.token_expires_at > NOW()
+              AND i.token_expires_at <= NOW() + INTERVAL '7 days'))`,
+      );
     }
 
     qb.orderBy('i.created_at', 'DESC');

```

---

### 파일 4: frontend/src/app/(main)/integrations/__tests__/integrations-page.test.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/app/(main)/integrations/__tests__/integrations-page.test.tsx b/frontend/src/app/(main)/integrations/__tests__/integrations-page.test.tsx
index 3e56e6ea..c5500366 100644
--- a/frontend/src/app/(main)/integrations/__tests__/integrations-page.test.tsx
+++ b/frontend/src/app/(main)/integrations/__tests__/integrations-page.test.tsx
@@ -105,3 +105,143 @@ describe("IntegrationsPage — pagination (post-component-migration)", () => {
     expect(url).toContain("page=2");
   });
 });
+
+// spec/2-navigation/4-integration.md §2.4 — "Need attention" banner
+describe("IntegrationsPage — attention banner", () => {
+  beforeEach(() => {
+    vi.clearAllMocks();
+    currentSearchParams = new URLSearchParams();
+    useLocaleStore.setState({ locale: "en" });
+    cleanup();
+    servicesMock.mockResolvedValue([]);
+  });
+
+  function attentionRow(overrides: Record<string, unknown> = {}) {
+    return {
+      id: "x",
+      workspaceId: "w",
+      name: "Acme",
+      serviceType: "google",
+      scope: "personal",
+      status: "error",
+      authType: "oauth",
+      credentials: {},
+      statusReason: "auth_failed",
+      credentialsStatus: "ok",
+      lastError: null,
+      meta: { appType: null },
+      tokenExpiresAt: null,
+      lastUsedAt: null,
+      lastRotatedAt: null,
+      createdBy: "u",
+      createdAt: "",
+      updatedAt: "",
+      ...overrides,
+    };
+  }
+
+  it("shows a breakdown (Expired/Expiring/Error counts) when multiple categories are present", async () => {
+    listMock.mockResolvedValue({
+      data: [
+        attentionRow({ id: "a", name: "Acme A", status: "expired" }),
+        attentionRow({ id: "b", name: "Acme B", status: "error" }),
+        attentionRow({
+          id: "c",
+          name: "Acme C",
+          status: "connected",
+          tokenExpiresAt: new Date(
+            Date.now() + 2 * 24 * 60 * 60 * 1000,
+          ).toISOString(),
+        }),
+      ],
+      pagination: { page: 1, limit: 30, totalItems: 3, totalPages: 1 },
+    });
+    await renderPage();
+    await screen.findByText("Acme A");
+    // Title plural form
+    expect(
+      screen.getByText(/3 integrations need attention/i),
+    ).toBeInTheDocument();
+    // Each non-zero category appears with its count
+    expect(screen.getByText(/Expired 1/i)).toBeInTheDocument();
+    expect(screen.getByText(/Expiring 1/i)).toBeInTheDocument();
+    expect(screen.getByText(/Error 1/i)).toBeInTheDocument();
+  });
+
+  it("clicking the banner with 2+ rows applies ?status=attention", async () => {
+    listMock.mockResolvedValue({
+      data: [
+        attentionRow({ id: "a", name: "Acme A", status: "expired" }),
+        attentionRow({ id: "b", name: "Acme B", status: "error" }),
+      ],
+      pagination: { page: 1, limit: 30, totalItems: 2, totalPages: 1 },
+    });
+    await renderPage();
+    await screen.findByText("Acme A");
+    const banner = screen.getByRole("button", {
+      name: /integrations need attention/i,
+    });
+    await userEvent.click(banner);
+    expect(mockReplace).toHaveBeenCalled();
+    const url = mockReplace.mock.calls.at(-1)?.[0] as string;
+    expect(url).toContain("status=attention");
+  });
+
+  it("clicking the banner with exactly 1 row jumps to that integration's detail page", async () => {
+    listMock.mockResolvedValue({
+      data: [attentionRow({ id: "lonely", status: "error" })],
+      pagination: { page: 1, limit: 30, totalItems: 1, totalPages: 1 },
+    });
+    await renderPage();
+    await screen.findByText("Acme");
+    const banner = screen.getByRole("button", {
+      name: /integration needs attention/i,
+    });
+    await userEvent.click(banner);
+    // detail jump uses push, not replace, since it's a navigation, not a
+    // filter URL update.
+    const lastPush = mockPush.mock.calls.at(-1)?.[0] as string | undefined;
+    const lastReplace = mockReplace.mock.calls.at(-1)?.[0] as string | undefined;
+    const jumpedTo = lastPush ?? lastReplace ?? "";
+    expect(jumpedTo).toContain("/integrations/lonely");
+  });
+
+  it("uses the red error tone when at least one error row is present", async () => {
+    listMock.mockResolvedValue({
+      data: [attentionRow({ id: "a", status: "error" })],
+      pagination: { page: 1, limit: 30, totalItems: 1, totalPages: 1 },
+    });
+    await renderPage();
+    await screen.findByText("Acme");
+    const banner = screen.getByRole("button", {
+      name: /integration needs attention/i,
+    });
+    expect(banner.className).toMatch(/red/);
+  });
+
+  it("uses the amber warn tone when no error rows are present", async () => {
+    listMock.mockResolvedValue({
+      data: [attentionRow({ id: "a", status: "expired" })],
+      pagination: { page: 1, limit: 30, totalItems: 1, totalPages: 1 },
+    });
+    await renderPage();
+    await screen.findByText("Acme");
+    const banner = screen.getByRole("button", {
+      name: /integration needs attention/i,
+    });
+    expect(banner.className).toMatch(/yellow|amber/);
+    expect(banner.className).not.toMatch(/red/);
+  });
+
+  it("hides the banner when there are no attention rows", async () => {
+    listMock.mockResolvedValue({
+      data: [attentionRow({ id: "ok", status: "connected" })],
+      pagination: { page: 1, limit: 30, totalItems: 1, totalPages: 1 },
+    });
+    await renderPage();
+    await screen.findByText("Acme");
+    expect(
+      screen.queryByText(/needs? attention/i),
+    ).not.toBeInTheDocument();
+  });
+});

```

---

### 파일 5: frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx b/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx
index 661d9815..042642ae 100644
--- a/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx
+++ b/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx
@@ -1,5 +1,10 @@
 import { describe, it, expect } from "vitest";
-import { computeStatus, isReauthorizeDisabled } from "../status-badge";
+import {
+  computeStatus,
+  isReauthorizeDisabled,
+  computeAttentionBreakdown,
+  needsAttention,
+} from "../status-badge";
 import type { IntegrationDto } from "@/lib/api/integrations";
 
 function row(overrides: Partial<IntegrationDto>): IntegrationDto {
@@ -142,3 +147,65 @@ describe("isReauthorizeDisabled", () => {
     ).toBe(false);
   });
 });
+
+// spec/2-navigation/4-integration.md §2.4 + Rationale "Attention 가상 필터값"
+describe("computeAttentionBreakdown", () => {
+  // 7d ahead → expiring; 1d ahead → expiring; past → not expiring on its own.
+  const inDays = (days: number) =>
+    new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
+
+  it("counts expired/expiring/error separately and totals them", () => {
+    const items: IntegrationDto[] = [
+      row({ id: "a", status: "expired" }),
+      row({ id: "b", status: "error", statusReason: "auth_failed" }),
+      row({
+        id: "c",
+        status: "connected",
+        tokenExpiresAt: inDays(2), // expiring (within 7d)
+      }),
+      row({
+        id: "d",
+        status: "connected",
+        tokenExpiresAt: inDays(30), // not expiring
+      }),
+      row({ id: "e", status: "pending_install" }), // explicitly excluded
+    ];
+    const br = computeAttentionBreakdown(items);
+    expect(br.expired).toBe(1);
+    expect(br.error).toBe(1);
+    expect(br.expiring).toBe(1);
+    expect(br.total).toBe(3);
+  });
+
+  it("returns 0 totals for a list with no attention rows", () => {
+    const items: IntegrationDto[] = [
+      row({ id: "a", status: "connected" }),
+      row({ id: "b", status: "pending_install" }),
+    ];
+    expect(computeAttentionBreakdown(items).total).toBe(0);
+  });
+
+  // The single-row UX (banner → detail jump) needs a deterministic target.
+  it("exposes mostUrgentId when exactly one row needs attention", () => {
+    const items: IntegrationDto[] = [
+      row({ id: "only-one", status: "error" }),
+      row({ id: "ok", status: "connected" }),
+    ];
+    const br = computeAttentionBreakdown(items);
+    expect(br.total).toBe(1);
+    expect(br.mostUrgentId).toBe("only-one");
+  });
+
+  // When multiple categories are present, error > expired > expiring is the
+  // priority order so the most actionable case wins. mostUrgentId is only
+  // meaningful when total === 1, but we still expose a deterministic value.
+  it("agrees with needsAttention's single-row predicate", () => {
+    const items: IntegrationDto[] = [
+      row({ id: "a", status: "expired" }),
+      row({ id: "b", status: "connected" }),
+    ];
+    const br = computeAttentionBreakdown(items);
+    const filtered = items.filter(needsAttention);
+    expect(br.total).toBe(filtered.length);
+  });
+});

```

---

### 파일 6: frontend/src/app/(main)/integrations/_shared/status-badge.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/app/(main)/integrations/_shared/status-badge.tsx b/frontend/src/app/(main)/integrations/_shared/status-badge.tsx
index 9b875595..cd25591b 100644
--- a/frontend/src/app/(main)/integrations/_shared/status-badge.tsx
+++ b/frontend/src/app/(main)/integrations/_shared/status-badge.tsx
@@ -92,6 +92,64 @@ export function needsAttention(integration: IntegrationDto): boolean {
   return true;
 }
 
+export interface AttentionBreakdown {
+  expired: number;
+  expiring: number;
+  error: number;
+  total: number;
+  /**
+   * id of the single attention row when `total === 1`. Used by the banner's
+   * single-row UX (direct jump to detail instead of filter). `null` when the
+   * banner-as-filter UX applies. With multiple attention rows the field
+   * surfaces the most urgent one (error > expired > expiring) — callers that
+   * want strict single-row semantics must guard on `total === 1`.
+   */
+  mostUrgentId: string | null;
+}
+
+/**
+ * Single source of truth for the "Need attention" set on the integrations
+ * list page. Delegates to `needsAttention()` so the predicate stays
+ * consistent between per-row badges, the banner aggregate count, and the
+ * `?status=attention` server filter. spec §2.4.
+ */
+export function computeAttentionBreakdown(
+  integrations: IntegrationDto[],
+): AttentionBreakdown {
+  let expired = 0;
+  let expiring = 0;
+  let error = 0;
+  let mostUrgent: { id: string; rank: number } | null = null;
+
+  for (const i of integrations) {
+    if (!needsAttention(i)) continue;
+    let rank: number;
+    if (i.status === "error") {
+      error += 1;
+      rank = 3;
+    } else if (i.status === "expired") {
+      expired += 1;
+      rank = 2;
+    } else {
+      // connected + expiring-soon — needsAttention guarantees this branch.
+      expiring += 1;
+      rank = 1;
+    }
+    if (!mostUrgent || rank > mostUrgent.rank) {
+      mostUrgent = { id: i.id, rank };
+    }
+  }
+
+  const total = expired + expiring + error;
+  return {
+    expired,
+    expiring,
+    error,
+    total,
+    mostUrgentId: mostUrgent?.id ?? null,
+  };
+}
+
 interface StatusBadgeProps {
   integration: IntegrationDto;
   className?: string;

```

---

### 파일 7: frontend/src/app/(main)/integrations/page.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/app/(main)/integrations/page.tsx b/frontend/src/app/(main)/integrations/page.tsx
index 414d7177..8c17fd4b 100644
--- a/frontend/src/app/(main)/integrations/page.tsx
+++ b/frontend/src/app/(main)/integrations/page.tsx
@@ -23,7 +23,11 @@ import {
   type ListStatusFilter,
 } from "@/lib/api/integrations";
 import { ServiceIcon, prettyAuthType } from "./_shared/service-icons";
-import { StatusBadge, needsAttention } from "./_shared/status-badge";
+import {
+  StatusBadge,
+  computeAttentionBreakdown,
+  type AttentionBreakdown,
+} from "./_shared/status-badge";
 import { ServicePickerModal } from "./_shared/service-picker-modal";
 import { useT, type TranslationKey } from "@/lib/i18n";
 
@@ -35,6 +39,7 @@ const SCOPE_OPTIONS: { value: "all" | "personal" | "organization"; labelKey: Tra
 
 const STATUS_FILTERS: { value: ListStatusFilter; labelKey: TranslationKey }[] = [
   { value: "all", labelKey: "integrations.statusAll" },
+  { value: "attention", labelKey: "integrations.statusAttention" },
   { value: "connected", labelKey: "integrations.statusConnected" },
   { value: "expiring", labelKey: "integrations.statusExpiring" },
   { value: "expired", labelKey: "integrations.statusExpired" },
@@ -115,8 +120,8 @@ export default function IntegrationsPage() {
   const integrations = useMemo(() => listData?.data ?? [], [listData]);
   const pagination = listData?.pagination;
 
-  const attentionCount = useMemo(
-    () => integrations.filter(needsAttention).length,
+  const attention = useMemo(
+    () => computeAttentionBreakdown(integrations),
     [integrations],
   );
 
@@ -165,19 +170,19 @@ export default function IntegrationsPage() {
         </RoleGate>
       </div>
 
-      {attentionCount > 0 && (
-        <button
-          type="button"
-          onClick={() => updateParam("status", "expiring")}
-          className="flex w-full items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-left text-sm text-yellow-900 hover:bg-yellow-100 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200"
-        >
-          <AlertTriangle className="h-5 w-5 shrink-0" />
-          <span>
-            <strong>{attentionCount}</strong> {t("integrations.attentionPrefix")}
-            {" "}
-            {t("integrations.attentionSuffix")}
-          </span>
-        </button>
+      {attention.total > 0 && (
+        <AttentionBanner
+          breakdown={attention}
+          onActivate={() => {
+            // spec §2.4 — single row jumps to detail, multi-row applies the
+            // attention virtual filter.
+            if (attention.total === 1 && attention.mostUrgentId) {
+              router.push(`/integrations/${attention.mostUrgentId}`);
+            } else {
+              updateParam("status", "attention");
+            }
+          }}
+        />
       )}
 
       <div className="flex flex-col gap-3">
@@ -333,6 +338,75 @@ export default function IntegrationsPage() {
   );
 }
 
+// spec/2-navigation/4-integration.md §2.4 — "Need attention" banner.
+// Breakdown-aware title + per-category counts, red tone when any error row
+// is present (amber otherwise). Click action is owned by the parent so the
+// 1-row → detail-jump vs. N-row → attention-filter branch lives where it
+// reads naturally (next to the rest of the URL handling).
+function AttentionBanner({
+  breakdown,
+  onActivate,
+}: {
+  breakdown: AttentionBreakdown;
+  onActivate: () => void;
+}) {
+  const t = useT();
+  const hasError = breakdown.error > 0;
+  const isSingle = breakdown.total === 1;
+  const title = isSingle
+    ? t("integrations.attentionTitleSingle")
+    : t("integrations.attentionTitlePlural", { count: breakdown.total });
+  const callToAction = isSingle
+    ? t("integrations.attentionClickToOpen")
+    : t("integrations.attentionClickToFilter");
+  return (
+    <button
+      type="button"
+      onClick={onActivate}
+      className={cn(
+        "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
+        hasError
+          ? "border-red-300 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
+          : "border-yellow-300 bg-yellow-50 text-yellow-900 hover:bg-yellow-100 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200",
+      )}
+    >
+      <AlertTriangle
+        className={cn(
+          "mt-0.5 h-5 w-5 shrink-0",
+          hasError
+            ? "text-red-600 dark:text-red-400"
+            : "text-yellow-600 dark:text-yellow-400",
+        )}
+      />
+      <span className="flex flex-col gap-0.5">
+        <strong className="font-semibold">{title}</strong>
+        <span className="text-xs opacity-90">
+          {[
+            breakdown.expired > 0
+              ? t("integrations.attentionBreakdownExpired", {
+                  count: breakdown.expired,
+                })
+              : null,
+            breakdown.expiring > 0
+              ? t("integrations.attentionBreakdownExpiring", {
+                  count: breakdown.expiring,
+                })
+              : null,
+            breakdown.error > 0
+              ? t("integrations.attentionBreakdownError", {
+                  count: breakdown.error,
+                })
+              : null,
+            callToAction,
+          ]
+            .filter((s): s is string => Boolean(s))
+            .join(" · ")}
+        </span>
+      </span>
+    </button>
+  );
+}
+
 function Chip({
   active,
   onClick,

```

---

### 파일 8: frontend/src/lib/api/integrations.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/api/integrations.ts b/frontend/src/lib/api/integrations.ts
index cf13cbd0..b099dd1d 100644
--- a/frontend/src/lib/api/integrations.ts
+++ b/frontend/src/lib/api/integrations.ts
@@ -2,8 +2,14 @@ import { apiClient } from "./client";
 
 export type IntegrationStatus = "connected" | "expired" | "error" | "pending_install";
 export type IntegrationScope = "personal" | "organization";
+// `expiring` and `attention` are virtual filter values — spec
+// /2-navigation/4-integration.md §2.3, §9.1, Rationale "Attention 가상
+// 필터값". The DB Integration.status enum holds only `connected`/`expired`/
+// `error`/`pending_install`; the backend rewrites these two virtual values
+// into union WHERE clauses.
 export type ListStatusFilter =
   | "all"
+  | "attention"
   | "connected"
   | "expiring"
   | "expired"

```

---

### 파일 9: frontend/src/lib/i18n/dict/en/integrations.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/i18n/dict/en/integrations.ts b/frontend/src/lib/i18n/dict/en/integrations.ts
index ff890cdf..77ea1987 100644
--- a/frontend/src/lib/i18n/dict/en/integrations.ts
+++ b/frontend/src/lib/i18n/dict/en/integrations.ts
@@ -45,8 +45,14 @@ export const integrations: Dict["integrations"] = {
   allServices: "All services",
   statusExpiring: "Expiring",
   statusError: "Error",
-  attentionPrefix: "integrations need attention",
-  attentionSuffix: "(expiring, expired, or error). Click to filter.",
+  statusAttention: "Attention",
+  attentionTitlePlural: "{{count}} integrations need attention",
+  attentionTitleSingle: "1 integration needs attention",
+  attentionBreakdownExpired: "Expired {{count}}",
+  attentionBreakdownExpiring: "Expiring {{count}}",
+  attentionBreakdownError: "Error {{count}}",
+  attentionClickToFilter: "Click to filter",
+  attentionClickToOpen: "Click to open",
   loadFailedHint: "Failed to load integrations.",
   retry: "Retry",
   emptyTitle: "No integrations yet",
@@ -54,7 +60,6 @@ export const integrations: Dict["integrations"] = {
   sectionOrg: "Organization",
   sectionPersonal: "Personal",
   paginationSummary: "Page {{page}} of {{totalPages}} · {{totalItems}} total",
-  attentionSingle: "1 integration needs attention",
   backToList: "Back to integrations",
   notFound: "Integration not found.",
   inUseError: "Integration is still in use. See the Usage tab for details.",

```

---

### 파일 10: frontend/src/lib/i18n/dict/ko/integrations.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/i18n/dict/ko/integrations.ts b/frontend/src/lib/i18n/dict/ko/integrations.ts
index de45e030..eee0792f 100644
--- a/frontend/src/lib/i18n/dict/ko/integrations.ts
+++ b/frontend/src/lib/i18n/dict/ko/integrations.ts
@@ -43,8 +43,14 @@ export const integrations = {
   allServices: "모든 서비스",
   statusExpiring: "만료 임박",
   statusError: "오류",
-  attentionPrefix: "개의 통합이 주의가 필요해요",
-  attentionSuffix: "(만료, 만료 임박, 또는 오류). 필터링하려면 클릭하세요.",
+  statusAttention: "주의 필요",
+  attentionTitlePlural: "통합 {{count}}건이 주의가 필요해요",
+  attentionTitleSingle: "통합 1건이 주의가 필요해요",
+  attentionBreakdownExpired: "만료 {{count}}",
+  attentionBreakdownExpiring: "만료 임박 {{count}}",
+  attentionBreakdownError: "오류 {{count}}",
+  attentionClickToFilter: "필터링하려면 클릭",
+  attentionClickToOpen: "열려면 클릭",
   loadFailedHint: "통합을 불러올 수 없어요.",
   retry: "다시 시도",
   emptyTitle: "아직 통합이 없어요",
@@ -52,7 +58,6 @@ export const integrations = {
   sectionOrg: "조직",
   sectionPersonal: "개인",
   paginationSummary: "{{page}} / {{totalPages}} 페이지 · 전체 {{totalItems}}",
-  attentionSingle: "1개의 통합이 주의가 필요해요",
   backToList: "통합 목록으로",
   notFound: "통합을 찾을 수 없어요.",
   inUseError: "사용 중인 통합이에요. Usage 탭에서 확인해 주세요.",

```

---

### 파일 11: plan/in-progress/integration-attention-filter.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/integration-attention-filter.md b/plan/in-progress/integration-attention-filter.md
new file mode 100644
index 00000000..fe24f2f9
--- /dev/null
+++ b/plan/in-progress/integration-attention-filter.md
@@ -0,0 +1,107 @@
+---
+worktree: integration-attention-filter-053b74
+started: 2026-05-16
+owner: developer
+---
+
+# Integrations 페이지 "주의 필요" 배너 — Attention 필터 도입
+
+## 배경
+
+`/integrations` 페이지 상단의 "주의 필요" 배너가 spec 의도와 어긋남:
+
+- `needsAttention()` (frontend/src/app/(main)/integrations/_shared/status-badge.tsx:89) 은 `expiring + expired + error` 3종 합산
+- 알림 문구도 "(만료, 만료 임박, 또는 오류)" 로 3종 언급
+- 그러나 클릭 핸들러는 `updateParam("status", "expiring")` 하드코딩 → 만료 임박 1종 필터로만 이동
+- 결과: 사용자가 알림에 표시된 만큼의 항목을 필터 화면에서 보지 못함 (특히 `error` 케이스)
+
+Spec `spec/2-navigation/4-integration.md` §2.4 는 이미 "클릭 시 상태 필터를 `Expiring | Expired | Error`로 자동 전환" 을 명시 → 구현 버그 + spec 의 운용 모드(단일 선택 칩 vs. 합집합) 명세가 미진함.
+
+## 적용 안 (안 A — "주의 필요" 통합 필터)
+
+### 백엔드
+
+- `INTEGRATION_STATUSES` 에 `'attention'` 추가 (backend/src/modules/integrations/dto/integration.dto.ts:20)
+- `IntegrationsService.findAll` 의 status 분기에 `attention` 추가 (backend/src/modules/integrations/integrations.service.ts:190 부근):
+
+  ```ts
+  else if (status === 'attention') {
+    qb.andWhere(
+      `(i.status IN ('expired','error')
+        OR (i.status = 'connected'
+            AND i.token_expires_at IS NOT NULL
+            AND i.token_expires_at > NOW()
+            AND i.token_expires_at <= NOW() + INTERVAL '7 days'))`
+    );
+  }
+  ```
+
+  > `pending_install` 은 spec §2.4 에 따라 attention 에서 제외.
+
+- DTO Swagger description 갱신 — `attention=주의 필요(만료/만료 임박/오류 합집합)` 추가
+
+### 프론트
+
+- `ListStatusFilter` 에 `"attention"` 추가 (frontend/src/lib/api/integrations.ts:5-10)
+- `STATUS_FILTERS` 에 `{ value: "attention", labelKey: "integrations.statusAttention" }` 추가 (frontend/src/app/(main)/integrations/page.tsx:36)
+- 알림 배너 (line 168-181):
+  - 클릭 시 `updateParam("status", "attention")` 으로 변경
+  - **분해 카운트** 표시: "통합 N건이 주의가 필요해요 — 만료 X · 만료 임박 Y · 오류 Z"
+  - **단일 건일 때**: 클릭 시 `/integrations/<id>` detail 페이지로 직접 점프 (필터링 단계 생략)
+  - **error 가 포함된 경우**: 배너 톤을 amber → red 미세 강조 (좌측 dot/border 색만 변경)
+- `status-badge.tsx` 에 `attentionBreakdown(integrations)` 헬퍼 추가 — `{ expired, expiring, error, total, mostUrgentId }` 반환
+
+### i18n
+
+- `dict/{ko,en}/integrations.ts` 에 신규 키:
+  - `statusAttention` — `"주의 필요"` / `"Attention"`
+  - `attentionTitlePlural` — `"통합 {{count}}건이 주의가 필요해요"`
+  - `attentionTitleSingle` — `"통합 1건이 주의가 필요해요"`
+  - `attentionBreakdown` — `"만료 {{expired}} · 만료 임박 {{expiring}} · 오류 {{error}}"`
+  - `attentionClickToFilter` — `"필터링하려면 클릭"` / `"Click to filter"`
+  - `attentionClickToOpen` — `"열려면 클릭"` / `"Click to open"`
+- 옛 키 `attentionPrefix`, `attentionSuffix`, `attentionSingle` 은 제거 (사용처 한 곳뿐).
+
+### Spec 갱신 (project-planner 위임 예정)
+
+- §2.1 ascii: 상태 칩 라인에 `[Attention]` 칩 추가, 배너 카피를 분해 카운트 형태로 수정
+- §2.3 상태 칩 옵션에 `Attention` (= `Expiring | Expired | Error` 합집합) 추가, 단일 선택 의미 유지
+- §2.4 배너:
+  - 클릭 동작을 "Attention 필터(=합집합)로 전환" 으로 명확화
+  - 본문에 분해 카운트(만료/만료 임박/오류 별 N) 표시 명세 추가
+  - 단일 건일 때는 detail 페이지로 점프 명세 추가
+  - error 가 ≥1 포함되면 톤 강조 명세 추가
+- Rationale 보강 — "왜 합집합 필터를 단일 상태로 노출하는가" (단일 칩 + 다중 status 의 표현 한계)
+
+## 작업 체크리스트
+
+- [x] (developer) plan 노트 작성 — 본 파일
+- [x] (developer) /consistency-check --impl-prep — `review/consistency/2026/05/16/13_26_15/`. BLOCK: NO. WARNING 7건은 (a) spec 갱신 선행 (W2/W1/W3 → 처리됨), (b) 본 plan 과 함께 처리할 네이밍 충돌 (W6/W7 → 구현 단계에서 처리), (c) 별 plan 영향 (W4/W5 → 본 plan 자체에 spec phase 격상)
+- [x] (developer in-skill) spec 갱신 §2.1/§2.3/§2.4/§9.1/§11.4 + Rationale "Attention 가상 필터값"
+- [x] (developer) /consistency-check --spec — `review/consistency/2026/05/16/13_36_06/`. BLOCK: NO. WARNING 9건 중 본 작업 관련 W3/W7 처리. 나머지(W1·W2·W4·W5·W6·W8·W9)는 [follow-up](#follow-up--본-작업-범위-밖) 참고
+- [ ] (developer) i18n dict 갱신 (ko/en parity) — 신규 키 `statusAttention`, `attentionTitlePlural`, `attentionTitleSingle`, `attentionBreakdown`, `attentionClickToFilter`, `attentionClickToOpen`; 옛 키 `attentionPrefix`/`attentionSuffix`/`attentionSingle` 제거
+- [ ] (developer) backend status='attention' 분기 + 단위 테스트
+- [ ] (developer) frontend banner/filter/jump 구현 + 단위 테스트
+  - `computeAttentionBreakdown(integrations)` 헬퍼 — `needsAttention()` 재사용해 단일 진실 유지 (W7 해소)
+  - i18n 키 `attentionBreakdown` 과 함수 `computeAttentionBreakdown` 의 prefix 분리 — W6 해소
+- [ ] (developer) TEST WORKFLOW (lint·unit·build·e2e)
+- [ ] (developer) /ai-review + RESOLUTION
+
+## Follow-up — 본 작업 범위 밖
+
+본 worktree 의 PR 범위 밖이며, 별 plan 또는 본 plan 머지 후 후속 정리 대상:
+
+- **W1 (cross_spec)**: `spec/5-system/4-execution-engine.md §10` Integration handler 계약과 본 spec §14.1 의 `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` 구분 cross-link 확인. 별 spec consistency 작업.
+- **W2 (cross_spec)**: `spec/5-system/11-mcp-client.md` Internal Bridge 의 `IntegrationSelector` 가 `pending_install` 을 선택 불가 처리하는지 spec 명시. 별 spec 작업.
+- **W4 (cross_spec/convention)**: `spec/5-system/2-api-convention.md` 또는 `spec/conventions/swagger.md` 에 "가상 필터값" 규약 추가. 본 spec §2.3 와 §9.1 에는 명시했으나 규약 문서 자체에 박제 필요.
+- **W5 (convention)**: §9.4 에러 응답 포맷 `{ code, message }` vs `{ error: { code, message } }` 모순. 본 spec 갱신과 무관한 기존 이슈.
+- **W6 (convention)**: spec 본문 상단 `## Overview` 섹션 누락 — 영역 패턴(다중 spec 파일에서 `_product-overview.md` 가 담당) 으로 의도된 것일 수 있음. CLAUDE.md 권장 3섹션 규약에 예외 명문화 필요.
+- **W8 (plan_coherence)**: `spec-update-cafe24-background-refresh.md` 가 산출물 반영 완료지만 체크박스 미갱신. `git mv` 로 `plan/complete/` 이동 — 본 worktree 와 무관한 별 plan 의 housekeeping.
+- **W9 (plan_coherence)**: `spec-update-cafe24-app-url-reuse.md` (worktree `cafe24-app-url-reuse-f9a2e3`) 가 동일 spec 파일의 §3.2·§4.4·§6·§9.2 를 다룸 — 본 worktree 와 수정 영역(§2.x, §9.1, §11.4) 이 겹치지 않으므로 merge 시 conflict risk 낮음. 본 PR merge 시점에 재확인.
+
+## 영향 범위
+
+- 백엔드: `backend/src/modules/integrations/` (DTO + service + spec)
+- 프론트: `frontend/src/app/(main)/integrations/page.tsx`, `_shared/status-badge.tsx`, `lib/api/integrations.ts`, `lib/i18n/dict/{ko,en}/integrations.ts`
+- spec: `spec/2-navigation/4-integration.md`
+- 기존 동작과의 호환성: 옛 URL `?status=expiring` 은 그대로 동작 (filter 옵션 일부로 남음). 신규 `?status=attention` 은 추가 옵션.

```

---

### 파일 12: review/consistency/2026/05/16/13_26_15/SUMMARY.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_26_15/SUMMARY.md b/review/consistency/2026/05/16/13_26_15/SUMMARY.md
new file mode 100644
index 00000000..0aa5bdc3
--- /dev/null
+++ b/review/consistency/2026/05/16/13_26_15/SUMMARY.md
@@ -0,0 +1,38 @@
+# Consistency Check 통합 보고서 (impl-prep)
+
+**Mode**: `--impl-prep spec/2-navigation/4-integration.md`
+**Target**: 구현 착수 전 검토 — 통합 페이지 Attention 필터 신설
+**BLOCK: NO** — Critical 발견 없음. WARNING 7건 해소 또는 수용 결정 후 구현 착수 권장.
+
+## 전체 위험도
+**MEDIUM** — spec 갱신 선행 미완료 상태에서 구현이 착수될 경우 spec-코드 불일치 구간 발생, 동일 spec 파일을 손대는 다수 활성 plan 과의 section-level 충돌 위험.
+
+## Critical 위배 (BLOCK 사유)
+없음
+
+## 경고 (WARNING)
+
+| # | Checker | 위배 | 제안 |
+|---|---------|------|------|
+| W1 | Cross-Spec / Rationale | `status='attention'` 가상 집계값의 API 계약 미기재 | spec §9.1 + Rationale 에 "가상 필터값" 규약 신설 |
+| W2 | Cross-Spec / Rationale | 배너 클릭 동작이 spec §2.4 텍스트와 구현 의도 불일치 | spec §2.3/§2.4 개정 선행 |
+| W3 | Cross-Spec | `Expiring` 도 가상 필터값인데 규약 부재 | §9.1 규약 신설 시 `expiring` 도 포함 |
+| W4 | Plan-Coherence | 동일 spec 파일 동시 수정 plan 3개 존재 | 진행 상태 확인 후 직렬화 |
+| W5 | Plan-Coherence | spec 갱신이 "외부 위임" 한 줄로 처리됨 | plan 에 spec 갱신 phase 격상 |
+| W6 | Naming-Collision | `attentionBreakdown` 함수명 vs i18n 키 혼재 | 함수명 `computeAttentionBreakdown` 으로 분리 |
+| W7 | Naming-Collision | `needsAttention` 단건 vs `attentionBreakdown` 집계 이원화 위험 | `computeAttentionBreakdown` 이 `needsAttention` 재사용 |
+
+## 처리 결과 (developer skill 내)
+
+- W1/W2/W3: spec/2-navigation/4-integration.md §2.1/§2.3/§2.4/§9.1/§11.4 + Rationale "Attention 가상 필터값" 항으로 즉시 해소 → `/consistency-check --spec` 재검토 통과 (review/consistency/2026/05/16/13_36_06/SUMMARY.md, BLOCK: NO).
+- W4: `cafe24-pending-polish` 는 PR #18 머지 대기 + followup 으로 split 됨 — §2.4 텍스트 작업이 끝난 상태. 다른 두 plan(`cafe24-background-refresh`, `cafe24-app-url-reuse`) 은 §2.4 와 무관. 실재 충돌 risk 낮음.
+- W5: plan/in-progress/integration-attention-filter.md 에 spec 갱신을 명시적 체크리스트 phase 로 격상.
+- W6/W7: 구현 단계에서 `computeAttentionBreakdown` 명칭 + `needsAttention` 재사용 구조로 처리 예정 (plan 체크리스트에 명시).
+
+## 산출물 위치
+- `cross_spec/review.md` (5)
+- `rationale_continuity/review.md` (4)
+- `convention_compliance/review.md` (4)
+- `plan_coherence/review.md` (5)
+- `naming_collision/review.md` (5)
+- `_retry_state.json` — 모든 checker success

```

---

### 파일 13: review/consistency/2026/05/16/13_26_15/_prompts/convention_compliance.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_26_15/_prompts/convention_compliance.md b/review/consistency/2026/05/16/13_26_15/_prompts/convention_compliance.md
new file mode 100644
index 00000000..a065af03
--- /dev/null
+++ b/review/consistency/2026/05/16/13_26_15/_prompts/convention_compliance.md
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
+| `board_articles_list` | 게시판 글 목록 조회 | Retrie

... (truncated due to prompt size limit) ...

---

### 파일 14: review/consistency/2026/05/16/13_26_15/_prompts/cross_spec.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 15: review/consistency/2026/05/16/13_26_15/_prompts/naming_collision.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 16: review/consistency/2026/05/16/13_26_15/_prompts/plan_coherence.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 17: review/consistency/2026/05/16/13_26_15/_prompts/rationale_continuity.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 18: review/consistency/2026/05/16/13_26_15/_retry_state.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_26_15/_retry_state.json b/review/consistency/2026/05/16/13_26_15/_retry_state.json
new file mode 100644
index 00000000..9522ed59
--- /dev/null
+++ b/review/consistency/2026/05/16/13_26_15/_retry_state.json
@@ -0,0 +1,58 @@
+{
+  "session_dir": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_26_15",
+  "summary_subagent_type": "consistency-summary",
+  "summary_output_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_26_15/SUMMARY.md",
+  "subagent_invocations": [
+    {
+      "name": "cross_spec",
+      "subagent_type": "cross-spec-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_26_15/_prompts/cross_spec.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_26_15/cross_spec/review.md"
+    },
+    {
+      "name": "rationale_continuity",
+      "subagent_type": "rationale-continuity-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_26_15/_prompts/rationale_continuity.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_26_15/rationale_continuity/review.md"
+    },
+    {
+      "name": "convention_compliance",
+      "subagent_type": "convention-compliance-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_26_15/_prompts/convention_compliance.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_26_15/convention_compliance/review.md"
+    },
+    {
+      "name": "plan_coherence",
+      "subagent_type": "plan-coherence-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_26_15/_prompts/plan_coherence.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_26_15/plan_coherence/review.md"
+    },
+    {
+      "name": "naming_collision",
+      "subagent_type": "naming-collision-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_26_15/_prompts/naming_collision.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_26_15/naming_collision/review.md"
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
+    "cross_spec": [{"status": "success", "issues": 5}],
+    "rationale_continuity": [{"status": "success", "issues": 4}],
+    "convention_compliance": [{"status": "success", "issues": 4}],
+    "plan_coherence": [{"status": "success", "issues": 5}],
+    "naming_collision": [{"status": "success", "issues": 5}]
+  },
+  "rate_limit_episodes": 0,
+  "total_wait_sec": 0,
+  "wake_history": [],
+  "last_reset_hint_sec": null,
+  "loop_mode": false
+}

```

---

### 파일 19: review/consistency/2026/05/16/13_26_15/convention_compliance/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_26_15/convention_compliance/review.md b/review/consistency/2026/05/16/13_26_15/convention_compliance/review.md
new file mode 100644
index 00000000..d80aa97f
--- /dev/null
+++ b/review/consistency/2026/05/16/13_26_15/convention_compliance/review.md
@@ -0,0 +1,44 @@
+# 정식 규약 준수 Review — `spec/2-navigation/4-integration.md`
+
+검토 모드: 구현 착수 전 (--impl-prep)
+검토 일시: 2026-05-16
+
+---
+
+## 발견사항
+
+- **[INFO]** 문서 구조 — `## Rationale` 섹션은 문서 말미에 올바르게 배치되어 있으나, Overview 섹션이 명시적 `## Overview` 헤딩 없이 본문 도입부로 처리됨
+  - target 위치: 파일 최상단 (라인 1~5, 헤더 + 관련 문서 링크 직후 바로 § 1 라우트 구성으로 진입)
+  - 위반 규약: `CLAUDE.md` §프로젝트 스펙 문서 — "각 spec 문서는 권장 3섹션 구성을 따른다: 1. Overview (제품 정의), 2. 본문 (스펙), 3. Rationale"
+  - 상세: 단일 spec 파일 영역의 경우 "본문 상단에 직접 `## Overview` 섹션을 둔다"고 규약이 명시한다. 본 문서는 `2-navigation` 영역에서 다중 spec 파일 중 하나이므로 `_product-overview.md` 가 Overview 역할을 하여 본 파일 자체에는 Overview 섹션이 없어도 규약상 허용된다. 단, 현재 헤더 링크가 PRD를 `_product-overview.md` 로 참조하고 있어 구조는 양호하다. 완전한 준수를 위해서는 현 상태를 문서 도입 코멘트로 명시하거나 규약 자체가 다중파일 영역에 대한 예외를 이미 포함하고 있으므로 추가 조치 필요도는 낮다.
+  - 제안: 필수 조치 아님. `2-navigation` 이 다중 spec 파일 영역이고 `_product-overview.md` 가 존재하므로 현 구조는 규약 허용 범주. 변경 불필요.
+
+- **[INFO]** API 경로 명명 — `§9.1` 의 `GET /api/integrations/services` 가 `:id` 없는 collection-level endpoint 임에도 다른 resource-level 엔드포인트보다 뒤에 나열되어 라우팅 충돌 가능성이 독자에게 모호하게 보일 수 있음
+  - target 위치: §9.1 목록·CRUD 표 (라인 678)
+  - 위반 규약: `spec/conventions/swagger.md` — 직접 금지 항목은 아니나, Controller 패턴(§2)의 "collection → :id → sub-resource" 순서 관행과 불일치
+  - 상세: NestJS 라우팅에서 `/integrations/services` 는 `/integrations/:id` 보다 먼저 선언되어야 `services` 가 `:id` 파라미터로 캡처되지 않는다. spec 문서의 순서는 구현 순서를 암시하지 않으나 혼동을 줄 수 있다.
+  - 제안: spec 표에서 `GET /api/integrations/services` 를 `:id` 기반 엔드포인트보다 앞에 배치하거나, spec 주석으로 "구현 시 `/integrations/:id` 보다 먼저 선언 필요" 를 기재. 규약 위반이 아닌 모범 사례 제안.
+
+- **[INFO]** error code 대소문자 혼재 — `§9.4` 공통 응답 포맷의 에러 코드와 `§14.1` 에러 코드 vocabulary 가 일부 다른 패턴을 사용함
+  - target 위치: §9.4 실패 코드 목록 (`OAUTH_STATE_MISMATCH`, `OAUTH_CONFIG_MISSING`, `INSUFFICIENT_SCOPE` 등) vs. §14.1 (`INTEGRATION_NOT_FOUND`, `INTEGRATION_TYPE_MISMATCH` 등)
+  - 위반 규약: `spec/conventions/swagger.md` — 에러 코드 형식 관련 직접 규약은 없으나, `spec/conventions/node-output.md` 가 `meta.errorCode` 를 참조하며 에러 코드의 일관성 있는 표기를 전제
+  - 상세: 두 섹션 모두 `UPPER_SNAKE_CASE` 를 사용하고 있어 실제로 일관된다. Rationale 에서 `status_reason` (snake_case) vs. API 응답 `UPPER_SNAKE_CASE` 의 의도적 구분도 §Rationale 에 명시되어 있다. 위반 아님. INFO 수준 확인 사항.
+  - 제안: 변경 불필요. 의도적 구분이 Rationale 에 문서화되어 있음.
+
+- **[INFO]** `§14.2` 의 MCP 서버 시각적 분리 레이블에 이모지 사용
+  - target 위치: §14.2 워크플로우 에디터 (라인 918 — `🌐 Generic MCP (HTTP) servers` / `🛒 Cafe24 stores`)
+  - 위반 규약: CLAUDE.md 주석 "이모지를 사용하지 않는다" — 단, 이는 Claude 의 **출력 파일**에 이모지 사용 금지 지침이며, UI 문자열 스펙으로서의 이모지 표기는 별개
+  - 상세: spec 문서 본문이 UI 에서 표시될 문자열을 정의하는 것이므로 CLAUDE.md 의 이모지 금지는 적용되지 않는다. 위반 아님.
+  - 제안: 변경 불필요.
+
+---
+
+## 요약
+
+`spec/2-navigation/4-integration.md` 는 정식 규약(`spec/conventions/**`, `CLAUDE.md`) 관점에서 전반적으로 양호하다. 파일 명명(`4-integration.md`, 숫자 prefix)·배치(`spec/2-navigation/`)·문서 말미 `## Rationale` 섹션·API 경로 표기·에러 코드 표기 모두 규약을 준수하며, 금지 항목(옛 `prd/`, `memory/`, `user_memo/` 경로 사용, 직접 금지 패턴)도 없다. 발견된 사항은 모두 INFO 수준의 모범 사례 제안이며 구현 착수를 차단하는 CRITICAL 또는 WARNING 이슈는 존재하지 않는다.
+
+---
+
+## 위험도
+
+NONE

```

---

### 파일 20: review/consistency/2026/05/16/13_26_15/cross_spec/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_26_15/cross_spec/review.md b/review/consistency/2026/05/16/13_26_15/cross_spec/review.md
new file mode 100644
index 00000000..a0f5f39c
--- /dev/null
+++ b/review/consistency/2026/05/16/13_26_15/cross_spec/review.md
@@ -0,0 +1,50 @@
+# Cross-Spec 일관성 검토 — `spec/2-navigation/4-integration.md`
+
+검토 모드: `--impl-prep` (구현 착수 전)
+구현 대상: `integration-attention-filter` — `attention` 합집합 필터 도입
+
+---
+
+## 발견사항
+
+- **[WARNING]** `status='attention'` 가상 값이 spec §9.1 API 계약과 불일치
+  - target 위치: `plan/in-progress/integration-attention-filter.md` §백엔드 — `INTEGRATION_STATUSES` 에 `'attention'` 추가, `GET /api/integrations?status=attention`
+  - 충돌 대상: `spec/2-navigation/4-integration.md §9.1` — `GET /api/integrations` 의 `status` 쿼리 파라미터가 `q`, `scope`, `serviceType`, `status` 라고만 서술하며 유효 status 값 목록을 명시하지 않음. 그러나 §2.3 상태 칩 정의(`Connected / Expiring / Expired / Error` 단일 선택)와 §6 상태 전이 다이어그램이 `Integration.status` Enum (`connected / expired / error / pending_install`) 에서 직접 파생된 필터를 전제로 설계되어 있어, 실제 DB 컬럼값이 아닌 가상 집계값(`attention`)을 같은 `status` 파라미터로 수용하는 설계가 spec 어디에도 기술되어 있지 않음.
+  - 상세: 기존 필터 칩은 `Connected / Expiring / Expiry / Error` 4종으로 각 값이 `Integration.status` (또는 `token_expires_at`) 와 1:1 대응한다. `attention` 은 복수 status 의 OR 합집합으로 성격이 다르다. 이 두 종류의 값이 동일 `status` 쿼리 파라미터 공간에 혼재할 경우, 다른 클라이언트 또는 외부 연동이 `status=attention` 의 의미를 추론하기 어렵고 Swagger 스키마가 혼란스러워진다.
+  - 제안: spec §9.1 의 `GET /api/integrations` 설명을 확장해 `status` 의 유효값 목록과 가상 집계값의 의미를 명시하거나, 별도 쿼리 파라미터(`filter=attention`)로 분리하는 방안을 spec 갱신 단계에서 확정한 뒤 구현해야 함. 현재 계획의 spec 갱신 항목(§65-74)이 이를 포함하도록 보강 필요.
+
+- **[WARNING]** 배너 클릭 동작 정의가 spec §2.4 와 충돌
+  - target 위치: `plan/in-progress/integration-attention-filter.md` §프론트 — "클릭 시 `updateParam("status", "attention")`"
+  - 충돌 대상: `spec/2-navigation/4-integration.md §2.4` — "클릭 시 상태 필터를 `Expiring | Expired | Error`로 자동 전환"
+  - 상세: 현행 spec §2.4 는 배너 클릭이 세 상태를 **동시에** 활성화하는 멀티 선택 전환(`Expiring | Expired | Error`)이라고 명시한다. 그러나 §2.3 은 상태 칩이 **단일 선택**이라고 정의한다. 이 두 문장은 현재 스펙 내부에서도 이미 모순이다. 구현 계획은 `attention` 단일 가상값으로 이 모순을 해소하는 것인데, spec이 먼저 개정되지 않은 상태에서 구현하면 구현이 spec과 다른 동작을 하게 된다.
+  - 제안: 구현 착수 전 spec §2.3 (상태 칩 목록) 과 §2.4 (배너 동작) 을 먼저 개정해 `Attention` 칩 추가 + 배너 클릭 = `?status=attention` 전환으로 일치시킨다. 계획의 "Spec 갱신 (project-planner 위임 예정)" 항목이 이 순서를 지켜야 함.
+
+- **[WARNING]** `Expiring` 상태 칩이 `expiring` 이라는 실제 DB Enum 값을 전제하고 있으나 `Integration.status` Enum에 해당 값 부재
+  - target 위치: `spec/2-navigation/4-integration.md §2.3` — 상태 칩 `Expiring (7일 이내)` 및 §11.4 UI 배지 조건 `token_expires_at <= now() + 7d`
+  - 충돌 대상: `spec/1-data-model.md §2.10 Integration.status` Enum — `connected / expired / error / pending_install` 4종. `expiring` 값이 없음.
+  - 상세: 스펙 §2.3 은 `Expiring` 칩을 서술하지만, 이는 `status='expiring'` DB 값이 아니라 `status='connected' AND token_expires_at <= now() + 7d` 조건의 별칭이다. 구현 계획의 `INTEGRATION_STATUSES` 에 `'expiring'` 이 이미 포함되어 있을 가능성이 있으며, 신규 `attention` 도입 시 동일 가상 필터 패턴이 두 개 생겨 일관성 규약이 필요해진다. 이 쟁점은 신규 `attention` 도입 전에 이미 존재하던 것이나, attention 구현 과정에서 같은 패턴을 재사용하므로 명시적 규약이 spec에 없다는 점이 위험으로 부각된다.
+  - 제안: spec §9.1 (또는 §2.3) 에 "가상 필터값" 규약 항목 신설 — `expiring`, `attention` 이 DB Enum 아닌 백엔드 쿼리 빌더 내부 집계 조건임을 명시. 데이터 모델 §2.10 의 status Enum 목록과 API 필터 파라미터의 status 값이 어떻게 다른지 단일 진실 지점에 기술.
+
+- **[INFO]** 분해 카운트 표시 형식이 spec §2.1 ascii diagram 및 §2.4 본문과 동기화 필요
+  - target 위치: `plan/in-progress/integration-attention-filter.md` §프론트 — "분해 카운트 표시: 통합 N건이 주의가 필요해요 — 만료 X · 만료 임박 Y · 오류 Z"
+  - 충돌 대상: `spec/2-navigation/4-integration.md §2.1 ascii diagram` — 배너 문구 `"⚠ 3 integrations need attention  (expiring / error)"`. `pending_install` 제외 근거만 §2.4 에 서술되어 있으며 분해 카운트 포맷 정의 없음.
+  - 상세: 구현 계획에서 배너 문구가 상세화되었으나 spec §2.1 ascii 와 §2.4 본문은 갱신 전이다. 실제로 이는 spec 갱신 예정 항목이나, 갱신 전에 구현이 먼저 진행되면 구현과 spec이 불일치하는 기간이 생긴다.
+  - 제안: spec 갱신이 구현보다 선행하도록 순서 준수. 계획 체크리스트의 "spec 갱신" 항목이 "developer 구현" 항목보다 앞에 배치되어 있는 것은 적절하나 실제 실행 순서를 지켜야 한다.
+
+- **[INFO]** 단일 건 배너 클릭 시 detail 페이지 직접 점프 — spec §2.4 에 부재
+  - target 위치: `plan/in-progress/integration-attention-filter.md` §프론트 — "단일 건일 때: 클릭 시 `/integrations/<id>` detail 페이지로 직접 점프"
+  - 충돌 대상: `spec/2-navigation/4-integration.md §2.4` — 배너 클릭 동작이 "필터 전환" 으로만 기술되어 있고 단일 건 예외 흐름 없음.
+  - 상세: 기능상 개선이나, spec §2.4 에 이 동작이 없으므로 구현이 spec 보다 앞서간다. 단일 건이 필터 대신 detail로 점프하는 동작은 `mostUrgentId` 필드를 필요로 하며 이는 새로운 UI 상태 기계를 뜻한다.
+  - 제안: spec §2.4 갱신 시 이 분기도 명시적으로 포함. 구현 착수 전 spec 갱신에 포함할 것.
+
+---
+
+## 요약
+
+`integration-attention-filter` 구현은 기존 spec `spec/2-navigation/4-integration.md` 에서 이미 미진한 부분(§2.3 단일 선택 칩 vs. §2.4 멀티 상태 전환 모순)을 해소하려는 올바른 방향이다. 그러나 핵심 API 계약 — `GET /api/integrations?status=` 파라미터에 가상 집계값 `attention` 을 수용하는 것 — 이 spec 어디에도 정의되어 있지 않으며, `Integration.status` DB Enum 과 API 필터 파라미터 값 공간의 의도적 분리 규약도 없다. 구현 전 spec §2.3 / §2.4 / §9.1 을 개정해 가상 필터값 규약을 명시하는 것이 필수다. 모순 항목 두 건(WARNING)은 구현 착수를 막아야 하는 수준이며, spec 갱신(project-planner 위임)이 선행되어야 한다.
+
+---
+
+## 위험도
+
+MEDIUM

```

---

### 파일 21: review/consistency/2026/05/16/13_26_15/meta.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_26_15/meta.json b/review/consistency/2026/05/16/13_26_15/meta.json
new file mode 100644
index 00000000..52d6bf9c
--- /dev/null
+++ b/review/consistency/2026/05/16/13_26_15/meta.json
@@ -0,0 +1,12 @@
+{
+  "timestamp": "2026-05-16T13:26:15.961906",
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

### 파일 22: review/consistency/2026/05/16/13_26_15/naming_collision/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_26_15/naming_collision/review.md b/review/consistency/2026/05/16/13_26_15/naming_collision/review.md
new file mode 100644
index 00000000..76acf229
--- /dev/null
+++ b/review/consistency/2026/05/16/13_26_15/naming_collision/review.md
@@ -0,0 +1,64 @@
+# 신규 식별자 충돌 검토 — integration-attention-filter
+
+검토 모드: `--impl-prep`
+대상 scope: `spec/2-navigation/4-integration.md` + 관련 구현 파일
+검토 일시: 2026-05-16
+
+---
+
+## 발견사항
+
+### [WARNING] `attentionBreakdown` — i18n 키와 함수명 동일
+
+- **target 신규 식별자**: `attentionBreakdown` (i18n 키, plan `dict/{ko,en}/integrations.ts`)와 `attentionBreakdown(integrations)` (헬퍼 함수, plan `status-badge.tsx`)
+- **기존 사용처**: 두 식별자가 각각 신규이므로 직접 충돌은 없으나, 같은 이름이 동일 파일 범위(`status-badge.tsx`의 export 함수)와 i18n 딕셔너리 키(`integrations.attentionBreakdown`)로 동시에 존재하게 된다.
+- **상세**: TypeScript 코드에서 `attentionBreakdown`은 함수 이름이고, i18n 딕셔너리에서 `integrations.attentionBreakdown`은 문자열 키다. 직접적인 런타임 충돌은 없지만, 코드 검색·자동완성 시 함수와 키가 동일 이름으로 혼재해 개발자가 혼동할 수 있다. i18n 키를 `attentionBreakdownLabel` 또는 `attentionDetail`로 구분하거나, 함수명을 `computeAttentionBreakdown`으로 명확히 구분하는 것이 바람직하다.
+- **제안**: i18n 키를 `attentionDetail` 또는 `attentionBreakdownText`로 변경하거나, 함수명을 `computeAttentionBreakdown`으로 변경해 네임스페이스를 분리한다.
+
+---
+
+### [WARNING] `needsAttention` — 기존 per-item 함수와 신규 `attentionBreakdown` 함수의 역할 분리 불명확
+
+- **target 신규 식별자**: `attentionBreakdown(integrations)` 헬퍼 (plan `status-badge.tsx`)
+- **기존 사용처**: `needsAttention(integration: IntegrationDto): boolean` — `frontend/src/app/(main)/integrations/_shared/status-badge.tsx:89`, `page.tsx:26,119`
+- **상세**: 기존 `needsAttention`은 단건 판정 술어(predicate)로, `page.tsx`에서 `.filter(needsAttention).length`로 `attentionCount`를 계산하는 데 사용된다. 신규 `attentionBreakdown`은 전체 목록을 받아 `{ expired, expiring, error, total, mostUrgentId }`를 반환하는 집계 함수다. 두 함수가 "attention" 판단 로직을 각각 구현하면 로직이 이원화될 수 있다. `attentionBreakdown`이 내부적으로 `needsAttention`을 호출하거나, `attentionCount` 계산을 `breakdown.total`로 대체하지 않으면 두 곳에서 attention 조건을 별도로 유지해야 하는 부담이 생긴다.
+- **제안**: `attentionBreakdown`이 `needsAttention`을 내부에서 활용하거나, `page.tsx`의 `attentionCount` 계산을 `attentionBreakdown(integrations).total`로 교체해 단일 진실 원칙을 유지한다.
+
+---
+
+### [WARNING] `nodeConfigs.integrationSelector.needsAttention` — 기존 i18n 키와 신규 `statusAttention` 키의 의미 중첩
+
+- **target 신규 식별자**: `statusAttention` (i18n 키, `integrations.statusAttention = "주의 필요"`)
+- **기존 사용처**: `nodeConfigs.integrationSelector.needsAttention = "주의 필요"` (`frontend/src/lib/i18n/dict/ko/nodeConfigs.ts:174`, `en/nodeConfigs.ts:176`)
+- **상세**: 두 키 모두 한국어로 "주의 필요" / 영어로 "needs attention"을 의미하나 서로 다른 딕셔너리 네임스페이스에 위치한다. 현재는 사용 맥락이 달라(노드 설정 패널의 통합 셀렉터 vs. 통합 목록 필터 칩 라벨) 직접 충돌은 없다. 그러나 i18n 키 검색 시 동일 의미어가 두 곳에 분산되어 있어 일관성 갱신이 누락될 수 있다.
+- **제안**: 두 키가 의미상 동일하다면 공통 키로 통합을 검토한다. 맥락이 달라 분리가 필요하다면 차이를 주석으로 명시해 혼동을 예방한다.
+
+---
+
+### [INFO] 삭제 예정 키(`attentionPrefix`, `attentionSuffix`, `attentionSingle`) — 기존 참조 잔존 가능성
+
+- **target 신규 식별자**: 삭제 대상 — `attentionPrefix`, `attentionSuffix`, `attentionSingle` (plan에서 제거 명시)
+- **기존 사용처**: `frontend/src/lib/i18n/dict/ko/integrations.ts:46-47,55`, `en/integrations.ts:48-49,57`. `page.tsx:176-178`에서 `t("integrations.attentionPrefix")`, `t("integrations.attentionSuffix")` 를 직접 참조 중
+- **상세**: 삭제 키가 `page.tsx`에서 직접 참조되고 있으므로, 딕셔너리에서 키를 제거하면서 `page.tsx` 사용처도 함께 교체해야 한다. 교체 누락 시 런타임에 i18n 미스 키(missing key) 오류 또는 키 문자열이 그대로 노출된다.
+- **제안**: 키 삭제와 `page.tsx` 참조 교체를 단일 PR에서 원자적으로 처리한다. 타입 안전 i18n(`TranslationKey` 타입)을 사용 중이라면 빌드 타임에 감지된다.
+
+---
+
+### [INFO] `'attention'` — 백엔드 `INTEGRATION_STATUSES`에 추가 시 `Integration.status` DB 컬럼과의 의미 분리
+
+- **target 신규 식별자**: `'attention'` — `INTEGRATION_STATUSES` 배열 및 `IntegrationStatusFilter` 타입 (backend DTO), `ListStatusFilter` 타입 (frontend)
+- **기존 사용처**: `Integration.status` DB 컬럼의 실제 저장 값 목록은 `connected | expired | error | pending_install` (`spec/1-data-model.md §2.10`). `INTEGRATION_STATUSES`는 현재 `connected | expiring | expired | error` — DB 저장 상태가 아닌 필터 전용 값(`expiring`)을 이미 포함하는 구조다.
+- **상세**: `'attention'` 역시 DB에 저장되지 않는 필터 전용 집합 값이므로 기존 `expiring`과 동일한 패턴을 따른다. 직접 충돌은 없으나, `INTEGRATION_STATUSES` 이름이 DB 상태(`Integration.status`)와 혼동될 수 있다. DTO Swagger description 갱신이 계획에 포함되어 있어 적절하다.
+- **제안**: DTO Swagger description에 "`attention`은 DB 저장 상태가 아닌 필터 전용 집합 값(`expired + error + expiring`)임"을 명시해 API 소비자 혼동을 방지한다.
+
+---
+
+## 요약
+
+이번 구현이 도입하는 신규 식별자(`'attention'` 필터 값, `attentionBreakdown` 함수·i18n 키, `statusAttention` i18n 키)는 기존 동일 이름의 다른 의미 식별자와 직접 충돌하는 CRITICAL 케이스는 없다. 다만 `attentionBreakdown` 이름이 함수와 i18n 키에 동시에 사용되는 점(WARNING), 기존 `needsAttention` 함수와 신규 `attentionBreakdown` 함수의 로직 이원화 위험(WARNING), `nodeConfigs.integrationSelector.needsAttention`과 신규 `statusAttention`의 의미 중첩(WARNING), 삭제 예정 키의 참조 잔존 가능성(INFO), `'attention'`의 DB 저장 상태와의 혼동(INFO) 등 5건이 발견되었다. CRITICAL 차단 요인은 없으므로 구현 착수 가능하나, WARNING 3건의 명명 정리를 구현과 동시에 진행하도록 권고한다.
+
+---
+
+## 위험도
+
+LOW

```

---

### 파일 23: review/consistency/2026/05/16/13_26_15/plan_coherence/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_26_15/plan_coherence/review.md b/review/consistency/2026/05/16/13_26_15/plan_coherence/review.md
new file mode 100644
index 00000000..8407bfb4
--- /dev/null
+++ b/review/consistency/2026/05/16/13_26_15/plan_coherence/review.md
@@ -0,0 +1,54 @@
+# Plan 정합성 Review
+
+검토 모드: `--impl-prep` (구현 착수 전)
+Target: `spec/2-navigation/4-integration.md`
+Target plan: `plan/in-progress/integration-attention-filter.md` (worktree: `integration-attention-filter-053b74`)
+
+---
+
+### 발견사항
+
+- **[WARNING]** `spec/2-navigation/4-integration.md` 를 동시에 수정하는 다른 활성 plan 다수 존재
+  - target 위치: `integration-attention-filter.md` §"Spec 갱신" — §2.1, §2.3, §2.4 수정 예정
+  - 관련 plan:
+    - `plan/in-progress/spec-update-cafe24-background-refresh.md` (worktree: `prod-rereview-fix-a7c93f`) — §11 (만료 스캐너) 갱신 항목 3개 미완료 (`[ ]`)
+    - `plan/in-progress/spec-update-cafe24-app-url-reuse.md` (worktree: `cafe24-app-url-reuse-f9a2e3`) — §3.2, §4.4, §6, §9, §10.2, Rationale 갱신 항목 미완료 (`[ ]`)
+    - `plan/in-progress/cafe24-pending-polish.md` (worktree: `cafe24-pending-polish-7fdb7e`) — §9.2/§9.4/§9.8/§2.4 갱신 항목 미완료 (`[ ]`)
+  - 상세: 위 세 plan 은 모두 `spec/2-navigation/4-integration.md` 의 서로 다른 절을 수정 예정이며 아직 미완 상태다. `integration-attention-filter` 가 같은 파일의 §2.1, §2.3, §2.4 를 동시에 개정하면 이들 worktree 가 PR merge 시 conflict 를 발생시킬 가능성이 있다. 특히 `cafe24-pending-polish` 의 §2.4 갱신 미완 항목은 target plan 의 §2.4 배너 명세 변경과 동일 절을 건드린다.
+  - 제안: 착수 전에 위 세 plan 의 진행 상태를 확인하고, 이미 merge 된 worktree 라면 해당 plan 을 `complete/` 로 이동한다. 아직 진행 중이라면 spec 수정 순서를 직렬화하거나, 각 plan 의 `worktree` 담당자와 수정 절(section)이 겹치지 않도록 명시적으로 조율한 뒤 착수한다.
+
+- **[WARNING]** `spec/2-navigation/4-integration.md` §2.4 가 미결 상태로 충돌 가능
+  - target 위치: `integration-attention-filter.md` §"Spec 갱신" — §2.4 배너 동작 명세
+  - 관련 plan: `plan/in-progress/cafe24-pending-polish.md` §"남은 작업" item `[ ] spec 갱신 적용 완료 (spec/2-navigation/4-integration.md §9.2/§9.4/§9.8/§2.4…)` (worktree: `cafe24-pending-polish-7fdb7e`)
+  - 상세: `cafe24-pending-polish` plan 은 §2.4 의 배너/필터 동작을 pending_install / callback 실패 정책 관점에서 수정하는 항목을 미완으로 보유하고 있다. `integration-attention-filter` 는 동일한 §2.4 를 `attention` 합집합 필터 동작 관점에서 개정한다. 두 개정이 동시에 진행되면 spec 내용이 혼합되거나 한쪽이 다른 쪽의 갱신을 덮어쓸 수 있다.
+  - 제안: `cafe24-pending-polish` 의 §2.4 관련 항목이 실제로 미완인지, 아니면 이미 처리된 내용인지 확인 후 plan 상태를 정리한다. 처리 완료라면 체크박스를 갱신하고 `complete/` 로 이동한다.
+
+- **[WARNING]** target plan 에 frontmatter `worktree` 필드는 있으나, spec 갱신을 "project-planner 위임 예정" 으로만 처리하고 별도 plan 신설 없음
+  - target 위치: `integration-attention-filter.md` §"Spec 갱신 (project-planner 위임 예정)"
+  - 관련 plan: 해당 없음 (신설 plan 없음)
+  - 상세: spec 갱신은 project-planner 의 쓰기 권한 영역이고, 구현 plan 과 별도 worktree 에서 진행하는 것이 프로젝트 규약이다. 현재 target plan 은 spec 갱신을 한 줄 메모로 위임만 선언하고, 별도 plan/worktree 를 신설하지 않았다. 구현이 spec 개정보다 먼저 착수되면 spec 과 코드가 일시적으로 불일치한다. (CLAUDE.md: "plan 은 spec 갱신까지 정식 phase 로 포함, 외부 위임 한 줄로 묶지 말 것" 메모리 항목 참고)
+  - 제안: spec 갱신을 위한 별도 plan 항목(또는 별도 plan 파일)을 신설하고, project-planner worktree 에서 spec 수정 후 `/consistency-check --spec` 을 통과하면 구현 착수 순서로 직렬화한다.
+
+- **[INFO]** `spec/2-navigation/4-integration.md` 의 target 내용이 비어 있음 (orchestrator payload 에 `(없음)` 표기)
+  - target 위치: prompt_file 의 "Target 문서" 블록
+  - 관련 plan: 해당 없음
+  - 상세: orchestrator 가 수집한 target spec 파일 내용이 `(없음)` 으로 표기되어 있다. 파일 자체는 존재하나 diff 범위에 포함되지 않은 것으로 보인다 (구현 착수 전이므로 아직 수정되지 않은 상태). plan 과의 정합성은 plan 문서 기반으로 분석하였다.
+  - 제안: 추가 조치 불필요. 구현 착수 후 spec 갱신이 진행될 때 다시 `--spec` 모드로 검토한다.
+
+- **[INFO]** `cafe24-node-resource-operation-ux.md` 가 `spec/2-navigation/4-integration.md` 수정 중인 `cafe24-spec-sync-e2a8b9` worktree 를 위험 요소로 명시
+  - target 위치: `cafe24-node-resource-operation-ux.md` 의존성·리스크 절
+  - 관련 plan: `plan/in-progress/cafe24-node-resource-operation-ux.md`
+  - 상세: 해당 plan 이 언급한 `cafe24-spec-sync-e2a8b9` worktree 의 현황이 plan 목록에 명확히 반영되어 있지 않다. 이미 merge 완료됐다면 해당 메모를 제거해야 하고, 아직 활성이라면 target plan 과의 충돌 여부를 추가 확인해야 한다.
+  - 제안: `cafe24-spec-sync-e2a8b9` worktree 의 상태를 확인하고 plan 메모를 최신화한다.
+
+---
+
+### 요약
+
+`integration-attention-filter` plan 이 수정 예정인 `spec/2-navigation/4-integration.md` §2.1, §2.3, §2.4 는 현재 최소 3개 다른 활성 plan (`spec-update-cafe24-background-refresh`, `spec-update-cafe24-app-url-reuse`, `cafe24-pending-polish`) 이 동시에 미완 상태로 손대고 있는 파일이다. 특히 §2.4 는 `cafe24-pending-polish` 와 직접 겹쳐 content-level 충돌 위험이 있다. 또한 spec 갱신이 "project-planner 위임 예정" 한 줄로 처리되어 별도 plan/phase 로 분리되지 않은 점이 프로젝트 규약(plan 은 spec 갱신까지 정식 phase 로 포함)과 어긋난다. CRITICAL 수준의 결정 우회나 worktree 직접 충돌은 확인되지 않으나, 동시 수정 위험과 spec-갱신 순서 미정이 WARNING 수준의 위험을 형성한다. 착수 전에 타 plan 의 완료 여부를 정리하고 spec 갱신 phase 를 명시적으로 계획한 뒤 순차 진행을 권장한다.
+
+---
+
+### 위험도
+
+MEDIUM

```

---

### 파일 24: review/consistency/2026/05/16/13_26_15/rationale_continuity/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_26_15/rationale_continuity/review.md b/review/consistency/2026/05/16/13_26_15/rationale_continuity/review.md
new file mode 100644
index 00000000..4933b9ff
--- /dev/null
+++ b/review/consistency/2026/05/16/13_26_15/rationale_continuity/review.md
@@ -0,0 +1,45 @@
+# Rationale 연속성 검토 — integration-attention-filter
+
+검토 모드: `--impl-prep`
+대상 문서: `spec/2-navigation/4-integration.md`
+구현 계획: `plan/in-progress/integration-attention-filter.md`
+
+> **참고**: target 문서 diff 가 "(없음)" — `spec/2-navigation/4-integration.md` 자체는 아직 변경되지 않았다. 본 검토는 구현 계획서(`integration-attention-filter.md`)가 기존 spec Rationale 에 기록된 결정과 충돌하지 않는지를 사전 점검한다.
+
+---
+
+### 발견사항
+
+- **[WARNING]** `§2.4` 배너 클릭 동작 번복 — Rationale 신규 작성 예고 있으나 아직 미작성
+  - target 위치: `plan/in-progress/integration-attention-filter.md` §적용 안 A > 프론트 (배너 클릭 동작), §Spec 갱신 (project-planner 위임 예정) §2.4
+  - 과거 결정 출처: `spec/2-navigation/4-integration.md §2.4` 현행 텍스트 — "클릭 시 상태 필터를 `Expiring | Expired | Error`로 자동 전환"
+  - 상세: 현행 spec §2.4 는 클릭 시 `Expiring | Expired | Error` 세 개의 개별 상태로 필터가 전환된다고 명시한다. 구현 계획은 이를 단일 `attention` 합집합 필터(`updateParam("status", "attention")`)로 교체하는 방향이다. 이것은 기존 상태 필터 동작 방식의 번복(개별 세 칩 전환 → 단일 합집합 칩 전환)이며, spec의 운용 모델이 바뀌는 것이다. 계획서 내에 "Spec 갱신 (project-planner 위임 예정)" 항목이 있어 의도된 번복임은 분명하나, 아직 spec §2.4 와 Rationale 에 그 이유("왜 합집합 필터를 단일 상태로 노출하는가 — 단일 칩 + 다중 status 의 표현 한계")가 반영되지 않은 상태로 구현이 먼저 착수될 위험이 있다.
+  - 제안: 구현 착수 전 `project-planner` 를 통해 spec §2.4 및 Rationale 를 선행 갱신한다. `consistency-checker --spec` 이 그 갱신 이후에 통과해야 구현 계획의 spec 정합 조건이 완성된다. 계획서가 이 순서를 "project-planner 위임 예정"으로 열거하고 있으므로, 해당 spec 갱신 PR 이 merge 되기 전 구현 코드 PR 이 선행되지 않도록 순서를 잠가야 한다.
+
+- **[WARNING]** 단일 건 점프(`/integrations/<id>` 직행) 결정에 대한 Rationale 부재
+  - target 위치: `plan/in-progress/integration-attention-filter.md` §적용 안 A > 프론트 — "단일 건일 때: 클릭 시 `/integrations/<id>` detail 페이지로 직접 점프 (필터링 단계 생략)"
+  - 과거 결정 출처: `spec/2-navigation/4-integration.md §2.4` — 기존 Rationale 에는 배너 클릭의 네비게이션 패턴(목록 필터 vs 직행) 에 대한 결정 근거가 없음
+  - 상세: 이것은 신규 UX 결정이다. 기각된 대안을 재도입하는 것은 아니지만, "건 수에 따라 클릭 목적지가 달라진다"는 동작 분기는 사용자가 직관적으로 이해해야 하는 인터랙션 패턴이다. 이 결정을 설명하는 Rationale("필터 거치는 것이 1건일 때는 마찰, 직행이 더 유용")이 spec 문서에 존재하지 않으므로 향후 유지보수 시 번복 위험이 있다.
+  - 제안: spec §2.4 갱신 시 "단일 건일 때 detail 직행" 결정과 그 근거를 Rationale 에 함께 명시한다.
+
+- **[INFO]** `install_timeout` expired 행이 `attention` 필터에 포함되는 의도 확인 필요
+  - target 위치: `plan/in-progress/integration-attention-filter.md` §백엔드 — `status IN ('expired','error')` 쿼리
+  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "install_timeout 알림 미발사" (§11.2) — "(b) UI 통지 충분 — 통합 상세 페이지의 status 배지 + 목록 페이지의 'Need attention' 배너로 통지"
+  - 상세: `install_timeout` Rationale 은 알림을 미발사하되 "Need attention 배너로 통지 충분"이라고 명시해, `expired(install_timeout)` 행이 배너에 노출되어야 함을 의도한다. 구현 계획의 `status IN ('expired','error')` 쿼리는 `status_reason` 구분 없이 모든 `expired` 행을 포함하므로 `install_timeout` 도 자동으로 포함된다. 이는 Rationale 의도와 일치한다. 다만 plan 의 §배경 설명("spec §2.4 는 이미 'Expiring | Expired | Error'로 자동 전환을 명시")과 이 세 상태가 attention 에 합산되는 정의 사이에서 `install_timeout expired` 가 명시적으로 언급되지 않아 구현자가 의도를 오인할 여지가 있다.
+  - 제안: spec §2.4 갱신 시 "expired(install_timeout) 포함 의도" 를 명시하거나 백엔드 코드 주석으로 안내한다.
+
+- **[INFO]** 옛 폐기된 "100건 mall_id 스캔 + trial HMAC" 과 회복 분기의 형태 유사성 — 구현 간 혼동 주의
+  - target 위치: 본 구현 계획 범위 외 사항이나, 이번 impl-prep 의 Rationale 코퍼스에 포함됨
+  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "install_token 을 App URL path 식별 키로 승격" 및 "Cafe24 install_token mismatch 회복 흐름 — 보안 전제"
+  - 상세: 기존 Rationale 가 폐기된 O(N) 스캔과 현재 `tryRecoverByMallId` 회복 분기를 "형태는 비슷하나 본질적으로 다른 경로"로 구분해 명시적으로 설명하고 있다. 이번 attention-filter 구현 자체와는 직접 충돌하지 않으나, 동일 서비스 파일을 수정할 때 개발자가 두 경로를 혼동할 수 있으므로 Rationale 구분 주석을 코드 레벨에서도 확인할 것을 권장한다.
+  - 제안: 구현 시 `tryRecoverByMallId` 인근 코드에 "폐기된 O(N) 스캔 아님 — fallback only" 주석이 존재하는지 확인한다.
+
+---
+
+### 요약
+
+이번 구현 계획(`integration-attention-filter`)이 제안하는 핵심 변경 — `attention` 합집합 필터 신설, 배너 클릭 동작 변경, 분해 카운트 표시 — 은 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 시스템 invariant 를 깨는 문제는 없다. 다만 spec §2.4 의 현행 클릭 동작("세 개 필터 전환") 이 "단일 attention 필터 전환"으로 번복되는 것이 구현보다 spec Rationale 갱신이 선행되지 않은 상태이고, 단일 건 직행 결정에 대한 Rationale 도 아직 미기재 상태다. 계획서가 이를 인식하고 "project-planner 위임 예정"으로 명시한 점은 긍정적이나, spec PR 과 구현 PR 의 순서가 뒤바뀌지 않도록 주의해야 한다. `pending_install` 을 attention 에서 제외한 결정은 기존 Rationale ("pending_install 은 필터 칩에 추가하지 않는다") 과 정합하며, `install_timeout expired` 포함 의도도 Rationale 과 일치한다.
+
+### 위험도
+
+LOW

```

---

### 파일 25: review/consistency/2026/05/16/13_36_06/SUMMARY.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_36_06/SUMMARY.md b/review/consistency/2026/05/16/13_36_06/SUMMARY.md
new file mode 100644
index 00000000..2c44ac33
--- /dev/null
+++ b/review/consistency/2026/05/16/13_36_06/SUMMARY.md
@@ -0,0 +1,44 @@
+# Consistency Check 통합 보고서 (spec)
+
+**Mode**: `--spec spec/2-navigation/4-integration.md`
+**Target**: spec 갱신 후 재검토 — Attention 가상 필터값 도입
+**BLOCK: NO** — Critical 발견 없음.
+
+## 전체 위험도
+**MEDIUM** — 런타임 에러와 연결될 수 있는 WARNING 4건, 본 작업 무관한 별 영역 spec 정합성 항목 다수. Critical 수준의 기능 파괴적 모순은 없음.
+
+## Critical 위배 (BLOCK 사유)
+없음
+
+## 경고 (WARNING) — 본 작업 관련
+
+| # | Checker | 위배 | 처리 |
+|---|---------|------|------|
+| W3 | Cross-Spec | §11.4 사이드바 배지 조건이 §2.4 배너 포함 조건과 정밀도 불일치 (`IS NOT NULL`, `> NOW()` 누락) | spec §11.4 갱신 완료 — §2.4 와 동일한 술어로 통일 |
+| W7 | Plan-Coherence | `integration-attention-filter.md` plan 의 spec 갱신 체크박스 미체크인데 spec 에는 이미 반영됨 | plan 체크박스 `[x]` 갱신 + 본 세션 경로 기록 완료 |
+
+## 경고 (WARNING) — 본 작업 범위 밖 (Follow-up)
+
+| # | Checker | 항목 | 후속 처리 |
+|---|---------|------|-----------|
+| W1 | Cross-Spec | `spec/5-system/4-execution-engine.md §10` 의 `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` 구분 cross-link 미확인 | 별 spec consistency 작업으로 분리 |
+| W2 | Cross-Spec | `spec/5-system/11-mcp-client.md` Internal Bridge 의 pending_install 처리 미명시 | 별 spec 작업 |
+| W4 | Cross-Spec / Convention | `spec/conventions/swagger.md` 또는 `spec/5-system/2-api-convention.md` 에 가상 필터값 규약 미박제 | 본 spec §2.3/§9.1 에는 명시했으나 규약 문서에 박제 필요 — follow-up |
+| W5 | Convention | §9.4 에러 응답 포맷 `{ code, message }` vs `{ error: { code, message } }` 모순 | 기존 이슈, 별 정리 |
+| W6 | Convention | 본문 상단 `## Overview` 섹션 누락 — 영역 패턴인지 규약 누락인지 모호 | 규약 문서에 예외 명문화 필요 — follow-up |
+| W8 | Plan-Coherence | `spec-update-cafe24-background-refresh.md` 미체크박스 다수, 산출물은 spec 반영 완료 | 별 plan housekeeping |
+| W9 | Plan-Coherence | `spec-update-cafe24-app-url-reuse.md` 가 동일 파일 §3.2·§4.4·§6·§9.2 수정 — 본 worktree 와 영역 비중첩 | merge 시점에 재확인 |
+
+## 처리 요약
+
+- 본 작업 관련 W3/W7 즉시 해소.
+- 본 작업 범위 밖 W1/W2/W4/W5/W6/W8/W9 는 `plan/in-progress/integration-attention-filter.md` 의 "Follow-up — 본 작업 범위 밖" 섹션에 명시적으로 기록 (별 plan 또는 본 PR 머지 후 후속 정리 대상).
+- INFO 17건은 대부분 다른 spec 문서와의 cross-reference 보강 항목 — 별 plan 으로 점진 처리.
+
+## 산출물 위치
+- `cross_spec/review.md` (9)
+- `rationale_continuity/review.md` (9)
+- `convention_compliance/review.md` (6)
+- `plan_coherence/review.md` (6)
+- `naming_collision/review.md` (4)
+- `_retry_state.json` — 모든 checker success

```

---

### 파일 26: review/consistency/2026/05/16/13_36_06/_prompts/convention_compliance.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 27: review/consistency/2026/05/16/13_36_06/_prompts/cross_spec.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 28: review/consistency/2026/05/16/13_36_06/_prompts/naming_collision.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 29: review/consistency/2026/05/16/13_36_06/_prompts/plan_coherence.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 30: review/consistency/2026/05/16/13_36_06/_prompts/rationale_continuity.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 31: review/consistency/2026/05/16/13_36_06/_retry_state.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_36_06/_retry_state.json b/review/consistency/2026/05/16/13_36_06/_retry_state.json
new file mode 100644
index 00000000..246de76b
--- /dev/null
+++ b/review/consistency/2026/05/16/13_36_06/_retry_state.json
@@ -0,0 +1,58 @@
+{
+  "session_dir": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_36_06",
+  "summary_subagent_type": "consistency-summary",
+  "summary_output_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_36_06/SUMMARY.md",
+  "subagent_invocations": [
+    {
+      "name": "cross_spec",
+      "subagent_type": "cross-spec-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_36_06/_prompts/cross_spec.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_36_06/cross_spec/review.md"
+    },
+    {
+      "name": "rationale_continuity",
+      "subagent_type": "rationale-continuity-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_36_06/_prompts/rationale_continuity.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_36_06/rationale_continuity/review.md"
+    },
+    {
+      "name": "convention_compliance",
+      "subagent_type": "convention-compliance-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_36_06/_prompts/convention_compliance.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_36_06/convention_compliance/review.md"
+    },
+    {
+      "name": "plan_coherence",
+      "subagent_type": "plan-coherence-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_36_06/_prompts/plan_coherence.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_36_06/plan_coherence/review.md"
+    },
+    {
+      "name": "naming_collision",
+      "subagent_type": "naming-collision-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_36_06/_prompts/naming_collision.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/integration-attention-filter-053b74/review/consistency/2026/05/16/13_36_06/naming_collision/review.md"
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
+    "cross_spec": [{"status": "success", "issues": 9}],
+    "rationale_continuity": [{"status": "success", "issues": 9}],
+    "convention_compliance": [{"status": "success", "issues": 6}],
+    "plan_coherence": [{"status": "success", "issues": 6}],
+    "naming_collision": [{"status": "success", "issues": 4}]
+  },
+  "rate_limit_episodes": 0,
+  "total_wait_sec": 0,
+  "wake_history": [],
+  "last_reset_hint_sec": null,
+  "loop_mode": false
+}
\ No newline at end of file

```

---

### 파일 32: review/consistency/2026/05/16/13_36_06/convention_compliance/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_36_06/convention_compliance/review.md b/review/consistency/2026/05/16/13_36_06/convention_compliance/review.md
new file mode 100644
index 00000000..80026950
--- /dev/null
+++ b/review/consistency/2026/05/16/13_36_06/convention_compliance/review.md
@@ -0,0 +1,66 @@
+# 정식 규약 준수 Review — `spec/2-navigation/4-integration.md`
+
+검토일: 2026-05-16
+검토 모드: spec draft 검토 (--spec)
+
+---
+
+## 발견사항
+
+### 1. **[WARNING]** `## Rationale` 섹션이 존재하나 `## Overview` 섹션이 없음
+- **target 위치**: 문서 최상단 (`# Spec: 통합 관리 화면`)
+- **위반 규약**: `CLAUDE.md` §프로젝트 스펙 문서 — 권장 3섹션 구성 (Overview / 본문 / Rationale). "각 spec 문서는 권장 3섹션 구성을 따른다."
+- **상세**: 문서는 `## Rationale` 섹션(§962 이후)으로 결론 배경을 잘 다루고 있으나, 영역의 사용자 가치·요구사항·목표를 기술하는 `## Overview (제품 정의)` 섹션이 누락되어 있다. 본 파일은 `spec/2-navigation/` 하위의 numbered spec 파일(`4-integration.md`)이므로 단일 파일 내 `## Overview` 섹션이 권장된다. `_product-overview.md`가 별도로 존재하기 때문에 본 파일에서 Overview를 생략한 것으로 보이지만, 규약은 "단일 spec 파일 영역은 본문 상단에 직접 `## Overview` 섹션을 둔다"고 명시하고 있다. `spec/2-navigation/`는 다중 spec 파일을 가진 영역이므로 `_product-overview.md`에 Overview를 별도 두는 패턴이 적용될 수 있으나, 그렇다면 본 문서 상단에 `_product-overview.md` 링크만으로 충분한지 명시적 안내가 없다. 링크는 있으나 명시적 Overview 섹션이나 짧은 제품 정의 문단이 없어 문서 자립도가 낮다.
+- **제안**: 본문 상단(라우트 구성 앞)에 `## Overview` 섹션을 추가하거나, 문서 상단의 링크 블록에 "제품 정의는 `_product-overview.md#34-integration-통합` 참조" 안내를 소절 형태로 명시한다. 또는 `_product-overview.md`가 다중 spec 영역 Overview를 책임지는 패턴이 본 파일에도 의도적으로 적용된 것이라면, 규약 자체에 "numbered spec 파일은 다중 영역일 때 Overview 생략 가능" 예외를 명문화하는 것을 권장한다.
+
+---
+
+### 2. **[WARNING]** 에러 응답 포맷이 규약의 `{ error: { code, message, details? } }` 구조와 불일치
+- **target 위치**: §9.4 공통 응답 포맷 — "실패: `{ code, message, details? }`"
+- **위반 규약**: `spec/conventions/swagger.md` §2-4 / `spec/5-system/2-api-convention.md` §5.3 — 에러 응답은 `{ "error": { "code": "...", "message": "...", "details": [...] } }` 형식이 정식 규약.
+- **상세**: §9.4에서 실패 응답을 `{ code, message, details? }` (최상위 필드 나열)로 표기하고 있으나, 정식 API 규약(`spec/5-system/2-api-convention.md §5.3`)은 에러를 반드시 `{ "error": { ... } }` 래퍼 안에 담도록 정의한다. swagger.md §2-5는 성공 응답이 `TransformInterceptor`로 `{ data: ... }` 래핑됨을 명시한다. 에러 응답 래퍼 구조 상이는 구현·문서 일관성을 해친다. swagger.md §2-4의 `@ApiConflictResponse` 선례도 본 에러 포맷과 연결된다.
+- **제안**: §9.4의 실패 응답 표기를 `{ "error": { "code": "...", "message": "...", "details"?: ... } }` 형식으로 수정한다. 단, 실제 `GlobalExceptionFilter`의 출력이 `{ code, message }` 최상위 형식이라면 `spec/5-system/2-api-convention.md §5.3`을 현행 구현에 맞게 갱신해야 한다. 두 spec 사이의 모순을 먼저 정리한 뒤 본 문서에 반영한다.
+
+---
+
+### 3. **[INFO]** API endpoint 명명 — URL 쿼리 파라미터 `serviceType` camelCase vs 규약 케밥/snake 경향
+- **target 위치**: §9.1 목록·CRUD — `GET /api/integrations` 쿼리 파라미터 `serviceType`
+- **위반 규약**: `spec/5-system/2-api-convention.md` §2.2 — "케밥 케이스" 규칙은 URL 경로에 명시되어 있으나, 쿼리 파라미터 케이스에 대한 명시적 규칙은 없음. 다만 §4.1에서 `sort`, `order`, `search` 등 모두 snake/lowercase 단순어를 사용하고 있어 camelCase(`serviceType`)는 이질적이다.
+- **상세**: `serviceType`은 camelCase이나 `page`, `limit`, `sort`, `order`, `search` 등 기존 파라미터들은 모두 lowercase/snake_case 스타일이다. 또한 §2.3 `serviceType`과 §9.1의 `status` 파라미터 허용값 목록(`connected`, `expiring`, `expired`, `error`, `attention`)은 모두 snake/lowercase인데 `serviceType`만 camelCase로 일관성이 어긋난다.
+- **제안**: 쿼리 파라미터를 `service_type` 또는 `serviceType` 중 하나로 프로젝트 전체를 통일하고, API 규약(`spec/5-system/2-api-convention.md`)에 쿼리 파라미터 케이스 규칙을 명문화한다. 현행 다른 API와 `serviceType`이 이미 정합하다면 INFO로 무시 가능.
+
+---
+
+### 4. **[INFO]** `§9.4 공통 응답 포맷` — 성공 응답 래퍼 언급이 모호
+- **target 위치**: §9.4 — "성공: `{ data: ... }` 또는 `{ data: ..., pagination: ... }` (기존 컨벤션 준수)"
+- **위반 규약**: `spec/conventions/swagger.md` §5-2 — `ApiOkPaginatedResponse`의 정확한 래퍼 형식은 `{ data: { data: [...], pagination: { page, limit, totalItems, totalPages } } }` (이중 래핑). `spec/5-system/2-api-convention.md §5.2`는 `{ data: [...], pagination: { ... } }` (단일 래핑).
+- **상세**: 두 규약 문서 간에도 pagination 래퍼 구조가 서로 다르다 (`swagger.md §5-2`의 `ApiOkPaginatedResponse`는 이중 래핑, API 규약 §5.2는 단일 래핑). 본 target 문서는 "기존 컨벤션 준수"로만 언급해 어느 규약을 따르는지 불명확하다. 단, 이 불일치는 target 문서보다 두 convention 문서 간 모순이 근본 원인이다.
+- **제안**: target 문서 §9.4는 "페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수"를 명시하고 있으므로(§9.1에 이미 참조 있음) 이 링크로 일단 충분하다. 근본 해결은 `swagger.md §5-2`와 `spec/5-system/2-api-convention.md §5.2`의 pagination 래퍼 형식을 일치시키는 convention 갱신이 필요하다.
+
+---
+
+### 5. **[INFO]** 문서 내 `prd/`, `memory/` 경로 사용 여부 — 없음 (이상 없음)
+- **target 위치**: 전체 문서
+- **위반 규약**: `CLAUDE.md` — 옛 `prd/`, `memory/`, `user_memo/` 경로 사용 금지.
+- **상세**: 문서 전체에서 옛 `prd/`, `memory/`, `user_memo/` 경로를 사용하지 않는다. 관련 링크는 모두 `spec/`, `../1-data-model.md`, `../4-nodes/`, `../5-system/` 등 정식 경로를 사용하고 있어 이상 없음.
+- **제안**: 해당 없음.
+
+---
+
+### 6. **[INFO]** Rationale 내 `review/consistency/` 경로 참조 — 과거 flat 형식 경로
+- **target 위치**: §Rationale — "Cafe24 Private 앱의 callback 실패는 왜 status 를 보존하나" 항: `(참고: review/consistency/2026/05/14/18_23_55)`
+- **위반 규약**: `CLAUDE.md` 명명 컨벤션 — `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` (nested ISO). 언급된 경로 `review/consistency/2026/05/14/18_23_55`는 nested ISO 형식으로 보이나 끝에 `/` 가 없고 파일명이 없어 경로가 불완전하다.
+- **상세**: 해당 경로는 기록용 참조이므로 실제 경로 이동을 강제하지는 않는다(`CLAUDE.md`도 "역사 기록" 성격의 review 문서는 옛 경로 그대로 두도록 허용). 다만 경로 형식이 올바른 nested ISO이고 단지 trailing slash와 파일명이 생략된 것이므로 기술적 위반이라기보다 표기 부정확이다.
+- **제안**: 참조 형식을 `review/consistency/2026/05/14/18_23_55/SUMMARY.md` 처럼 완전한 경로로 기재하거나, 단순 날짜 참조(`2026-05-14 일관성 검토`)로 단순화한다.
+
+---
+
+## 요약
+
+`spec/2-navigation/4-integration.md`는 전반적으로 정식 규약을 충실히 따르고 있다. 파일명(`4-integration.md`)은 숫자 prefix 컨벤션에 정합하고, `## Rationale` 섹션이 적절히 배치되어 있으며, 옛 `prd/`·`memory/` 경로 사용은 없다. API 엔드포인트 경로(`/api/integrations/...`, `/api/3rd-party/...`)는 복수형·케밥 케이스 규칙을 준수한다. 주요 지적은 두 가지다: (1) 다중 spec 파일 영역에서 `_product-overview.md`가 별도로 존재함에도 `## Overview` 섹션이 본 문서에 없어 권장 3섹션 구성이 충족되지 않는다는 점, (2) §9.4의 에러 응답 포맷 표기(`{ code, message, details? }` 최상위 나열)가 정식 API 규약의 `{ error: { ... } }` 래퍼 구조와 불일치한다는 점. 두 사항 모두 규약 갱신 또는 문서 수정으로 명확히 해소할 수 있으며, 다른 시스템의 invariant를 직접 파괴하는 CRITICAL 수준 위반은 발견되지 않았다.
+
+---
+
+## 위험도
+
+LOW

```

---

### 파일 33: review/consistency/2026/05/16/13_36_06/cross_spec/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_36_06/cross_spec/review.md b/review/consistency/2026/05/16/13_36_06/cross_spec/review.md
new file mode 100644
index 00000000..9d35200d
--- /dev/null
+++ b/review/consistency/2026/05/16/13_36_06/cross_spec/review.md
@@ -0,0 +1,117 @@
+# Cross-Spec 일관성 검토
+
+**Target**: `spec/2-navigation/4-integration.md`
+**검토 일시**: 2026-05-16
+
+---
+
+## 발견사항
+
+### [INFO] `Attention` 칩 신설 — `spec/2-navigation/_product-overview.md` 동기화 미확인
+
+- target 위치: §2.3 상태 칩 목록 (`[All] [Attention] [Connected] [Expiring] [Expired] [Error]`)
+- 충돌 대상: `spec/2-navigation/_product-overview.md` — 내비게이션 PRD의 Integration 화면 요구사항 섹션 (prompt corpus 에 포함되지 않아 직접 확인 불가)
+- 상세: target 본문의 Rationale "Attention 가상 필터값" 항(2026-05-16)은 `Attention` 칩을 신설하며 기존 칩 모델이 변경되었다고 명시한다. 내비게이션 PRD(`_product-overview.md §3.4 Integration`)에 기재된 상태 필터 목록이 아직 갱신되지 않았을 경우 두 문서가 동기화 불일치 상태가 된다.
+- 제안: `spec/2-navigation/_product-overview.md`의 Integration 요구사항(상태 칩 목록 기술 부분)에 `Attention` 칩 및 `?status=attention` 가상 필터값 추가를 확인·반영한다.
+
+---
+
+### [INFO] `spec/1-data-model.md §2.19 Notification.type` 알림 발사 정책과 target §11.2의 정합성 — 이미 동기화됨
+
+- target 위치: §11.2 알림 생성 — "알림 발사 정책 (2026-05-16 정정)"
+- 충돌 대상: `spec/1-data-model.md §2.19 Notification` (corpus 포함)
+- 상세: target §11.2는 `integration_expired` 알림을 "refresh_token 없는 provider의 `token_expires_at` 만료(`status_reason='token_expired'`)에만 발사"로 정정하고, `install_timeout`, `error(auth_failed)`, `error(network)`, `error(insufficient_scope)` 전이는 미발사로 명시한다. `spec/1-data-model.md §2.19`의 `Notification.type` 설명에서도 동일한 정책("2026-05-16 두 차례 정정 후")을 이미 반영하고 있다. 두 영역 간 직접 모순은 없으나, 검색 편의를 위해 data-model 쪽 설명의 cross-reference 링크(`§11.2`)가 이미 존재하는 점을 확인.
+- 제안: 추가 수정 불필요. 양쪽 동기화 완료 상태.
+
+---
+
+### [INFO] `spec/1-data-model.md §2.10 Integration.status_reason` — `refresh_failed` 제거 명시와 target §6 상태 전이 일치 확인
+
+- target 위치: §6 상태 전이 표 — "connected → error(auth_failed)" 행 (2026-05-16 갱신)
+- 충돌 대상: `spec/1-data-model.md §2.10 Integration.status_reason` (corpus 포함)
+- 상세: target §6과 data-model §2.10 모두 `refresh_failed` 를 `error(auth_failed)`로 이행 처리하고 `expired` status에서 `refresh_failed` 사유를 제거한다. 양쪽 모두 동일한 "REQ HIGH-2" 결정을 반영하고 있어 직접 충돌 없음.
+- 제안: 추가 수정 불필요.
+
+---
+
+### [INFO] `connected-expiry` 스캐너 대상 조건 — target §11.1과 data-model §3 인덱스 표의 경미한 표현 차이
+
+- target 위치: §11.1 스캐너 잡 표 — `connected-expiry` 대상: `status NOT IN (expired, error, pending_install) AND token_expires_at IS NOT NULL`
+- 충돌 대상: `spec/1-data-model.md §3 인덱스 전략` — `Integration (token_expires_at)` 인덱스 목적: "만료 스캐너 배치 조회"
+- 상세: 인덱스 표는 스캐너 쿼리를 `token_expires_at` 단일 컬럼 인덱스로 지원한다고만 기술하며, 실제 WHERE 절(`status NOT IN ...`)을 명시하지 않는다. 이는 표현 수준의 차이로 기능 충돌은 아니지만, 부분 인덱스로 범위를 좁히면 더 효율적임을 알 수 있다.
+- 제안: 선택적 개선 — 인덱스 목적 설명에 스캐너 필터 조건 요약을 추가하거나, 부분 인덱스(`WHERE status = 'connected' AND token_expires_at IS NOT NULL`)로 전환하는 것을 고려.
+
+---
+
+### [INFO] `spec/2-navigation/_product-overview.md` 의 `NAV-INT-*` 요구사항 ID — `Attention` 필터 요구사항 ID 부재 가능성
+
+- target 위치: §2.3, §2.4 (Attention 칩 / 배너 클릭 동작 상세), Rationale "Attention 가상 필터값"
+- 충돌 대상: `spec/2-navigation/_product-overview.md` Integration 섹션의 `NAV-INT-*` 요구사항 ID (corpus 미포함)
+- 상세: target의 Rationale은 기존 spec 텍스트를 정정하면서 새 동작("합계 = 1일 때 detail 직접 점프", "Attention 칩 신설")을 기술하지만, 이 변경사항에 대응하는 요구사항 ID(`NAV-INT-*`)가 `_product-overview.md`에 등록되었는지 확인할 수 없다. 관련 PRD ID가 없으면 추적성이 낮아진다.
+- 제안: `spec/2-navigation/_product-overview.md`의 Integration 요구사항 목록에 Attention 칩·배너 동작에 대응하는 요구사항 항목이 추가되었는지 확인한다. 누락 시 신규 `NAV-INT-*` ID를 부여한다.
+
+---
+
+### [INFO] `spec/4-nodes/4-integration/_product-overview.md` — `pending_install` 필터 칩 미포함 결정의 PRD 반영 여부
+
+- target 위치: §2.3 상태 칩 — "`pending_install`은 포함하지 않는다" (※ 주석), Rationale "`pending_install`은 필터 칩에 추가하지 않는다"
+- 충돌 대상: `spec/4-nodes/4-integration/_product-overview.md` (corpus 미포함)
+- 상세: target은 `pending_install` 칩 미포함 결정을 Rationale에 명시하며 "별도 수요 발생 시 후속 plan으로 재검토"라고 남긴다. 이 결정이 Integration PRD(`4-nodes/4-integration/_product-overview.md`)에도 반영되어 있는지, 혹은 기존 PRD에 해당 칩이 포함된 상태로 남아 있는지 확인이 필요하다.
+- 제안: `spec/4-nodes/4-integration/_product-overview.md`의 통합 관리 화면 요구사항에서 `pending_install` 필터 칩 부재가 명시적으로 기술되어 있는지 확인하고, 누락 시 동기화한다.
+
+---
+
+### [INFO] `spec/data-flow/5-integration.md` — 네 개의 독립 BullMQ job 명칭 동기화
+
+- target 위치: §11 만료 스캐너 및 알림 — "네 개의 독립 BullMQ job (`connected-expiry` / `pending-install-ttl` / `usage-log-prune` / `cafe24-background-refresh`)"
+- 충돌 대상: `spec/data-flow/5-integration.md §1.4 OAuth 만료 스캐너 BullMQ integration-expiry` (target §11 본문 cross-reference로 언급)
+- 상세: target §11이 data-flow spec을 교차 참조하지만, data-flow spec이 네 개 잡 분리 결정(target §11의 개정사항)을 동일하게 반영하고 있는지 corpus에서 확인 불가. data-flow spec의 `integration-expiry` 단일 job 표현이 남아 있으면 명칭 불일치가 발생한다.
+- 제안: `spec/data-flow/5-integration.md §1.4`에서 `connected-expiry` / `pending-install-ttl` / `usage-log-prune` / `cafe24-background-refresh` 네 잡 명칭으로 갱신되었는지 확인한다.
+
+---
+
+### [WARNING] `spec/5-system/4-execution-engine.md §10` — `INTEGRATION_NOT_CONNECTED` 에러 코드의 상태 커버리지
+
+- target 위치: §14.1 에러 코드 vocabulary — `INTEGRATION_NOT_CONNECTED`: "Integration 상태가 `expired`/`error`"
+- 충돌 대상: `spec/5-system/4-execution-engine.md §10 Integration handler 계약` (target §14.1 cross-reference로 언급)
+- 상세: target §14.1은 `INTEGRATION_NOT_CONNECTED` 에러가 `expired` / `error` 상태에서 발생한다고 정의한다. 그런데 §6 상태 전이에서 `pending_install` 상태도 노드·AI Agent에서 사용 불가(`INTEGRATION_INCOMPLETE` — §4.2)라고 명시한다. 두 에러 코드 중 `INTEGRATION_NOT_CONNECTED`의 커버리지(expired/error)와 `INTEGRATION_INCOMPLETE`의 커버리지(pending_install 또는 credentials JSONB 필수 필드 누락)가 분리되어 있는데, 실행 엔진 spec이 이 분리를 동일하게 정의하고 있는지 확인이 필요하다. 만약 실행 엔진 spec에서 `pending_install`을 `INTEGRATION_NOT_CONNECTED`로 처리하면 불일치가 된다.
+- 제안: `spec/5-system/4-execution-engine.md §10`에서 `INTEGRATION_NOT_CONNECTED`(expired/error)와 `INTEGRATION_INCOMPLETE`(pending_install 포함)의 구분이 target §14.1과 일치하는지 확인하고, 불일치 시 실행 엔진 spec을 갱신한다.
+
+---
+
+### [WARNING] `spec/5-system/2-api-convention.md` — `GET /api/integrations`의 `status` 파라미터 허용값과 API 규약 충돌 가능성
+
+- target 위치: §9.1 목록·CRUD — `GET /api/integrations` `status` 파라미터 허용값에 `expiring`, `attention` 두 가상 필터값 포함
+- 충돌 대상: `spec/5-system/2-api-convention.md` (target §9.1 cross-reference로 언급 — 페이지네이션 응답 형식 §5.2)
+- 상세: `GET /api/integrations`의 `status` 파라미터는 DB Enum 값(`connected`, `expired`, `error`, `pending_install`)에 더해 `expiring`과 `attention`이라는 가상 필터값을 허용한다. API 규약에 "enum 파라미터는 DB Enum과 일치해야 한다"거나 "허용값 집합을 Swagger에 명시해야 한다"는 규칙이 있는 경우, 가상 필터값이 해당 규약을 위반할 수 있다. 또한 `spec/conventions/swagger.md`에 정의된 Swagger 문서화 규약 관점에서도 가상 필터값의 schema 정의(예: `enum` 또는 `oneOf`) 방식이 명확히 결정되어 있어야 한다.
+- 제안: `spec/5-system/2-api-convention.md` 또는 `spec/conventions/swagger.md`에서 "가상 필터값(virtual filter)을 API 파라미터로 허용하는 경우의 문서화 방식"을 명시하거나, target §9.1의 Swagger 표현 방식(예: `description`에 가상값 명시, `enum` 배열에 포함)을 해당 규약 문서에 추가한다.
+
+---
+
+### [WARNING] `spec/5-system/11-mcp-client.md §2.3` — Internal Bridge의 `pending_install` 상태 Integration 처리
+
+- target 위치: §14.2 워크플로우 에디터 — AI Agent의 `mcpServers` 셀렉트가 `service_type='mcp'`와 `service_type='cafe24'`를 모두 받음; §6 상태 전이 — `pending_install`은 노드·AI Agent 사용 불가
+- 충돌 대상: `spec/5-system/11-mcp-client.md §2.3 Internal Bridge` (target §14.2 cross-reference)
+- 상세: target §6은 `pending_install` 상태의 Integration이 노드·AI Agent에서 사용 불가라고 명시하고 §4.2에서 `INTEGRATION_INCOMPLETE` 에러를 언급한다. MCP Client spec의 Internal Bridge가 `IntegrationSelector`에서 `pending_install` 상태를 제외(비활성 표시 또는 목록 제거)하는 로직을 명시하는지 확인이 필요하다. `pending_install` 상태 Cafe24 Integration이 `mcpServers` 드롭다운에 선택 가능 상태로 노출되면 런타임 에러(`INTEGRATION_INCOMPLETE`)가 발생한다.
+- 제안: `spec/5-system/11-mcp-client.md`의 `IntegrationSelector` 관련 섹션 또는 Internal Bridge 섹션에서, `pending_install` 상태 Integration은 선택 불가(비활성 또는 목록 제외)로 처리함을 명시한다.
+
+---
+
+### [WARNING] 상태 배지 §11.4 UI 배지 조건과 §2.4 "Need attention" 배너 포함 조건의 미세 차이
+
+- target 위치: §11.4 UI 배지 — 사이드바 카운트: `status IN (expired, error) OR (token_expires_at <= now() + 7d)`; §2.4 배너 포함 조건: `status IN (expired, error)` OR `(status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d')`
+- 충돌 대상: 동일 문서 내 §11.4와 §2.4의 표현 차이
+- 상세: §11.4의 사이드바 배지 조건 `token_expires_at <= now() + 7d`는 `token_expires_at IS NOT NULL` 조건과 `token_expires_at > NOW()`(이미 만료되지 않음) 조건을 명시하지 않는다. 반면 §2.4 배너 조건은 두 조건을 명시한다. 이미 `expired` 처리된 행은 `status IN (expired)` 브랜치에서 카운트되어 중복은 없지만, `token_expires_at IS NULL`인 행(MCP 등)이 §11.4 조건에서 의도치 않게 포함될 위험이 있다(실제로 NULL은 비교에서 false를 반환하므로 동작상 차이는 없으나 읽는 사람에게 혼동을 준다). 또한 `token_expires_at < NOW()`(과거 = 만료)인 connected 행이 배너에는 제외되지만 사이드바 공식에서는 포함될 수 있다.
+- 제안: §11.4의 사이드바 배지 조건을 §2.4와 동일한 정밀도로 기술하도록 갱신한다: `status IN (expired, error) OR (status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d')`.
+
+---
+
+## 요약
+
+`spec/2-navigation/4-integration.md` draft는 2026-05-16 기준의 대규모 개정(Attention 가상 필터값 도입, refresh 실패 시 `error(auth_failed)` 통일, `install_timeout` 알림 미발사 명문화)을 포함한다. 분석된 corpus(데이터 모델 spec, 아키텍처 개요, 인증 흐름 spec 등) 내에서 직접적인 CRITICAL 충돌(기능이 작동 불가한 수준의 모순)은 발견되지 않았다. 주요 우려 사항은 두 가지 WARNING 영역으로: (1) 실행 엔진 spec의 `INTEGRATION_NOT_CONNECTED` vs `INTEGRATION_INCOMPLETE` 상태 구분이 target과 일치하는지, (2) Internal MCP Bridge의 `pending_install` 상태 Cafe24 Integration 처리 명시 여부다. 이 두 항목은 런타임 에러와 연결될 수 있으므로 구현 착수 전 확인이 권장된다. 나머지 INFO 항목들은 관련 PRD 및 data-flow spec과의 동기화 권장 사항으로, draft 채택 자체를 차단하지 않는다.
+
+---
+
+## 위험도
+
+MEDIUM

```

---

### 파일 34: review/consistency/2026/05/16/13_36_06/meta.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_36_06/meta.json b/review/consistency/2026/05/16/13_36_06/meta.json
new file mode 100644
index 00000000..d82d05de
--- /dev/null
+++ b/review/consistency/2026/05/16/13_36_06/meta.json
@@ -0,0 +1,12 @@
+{
+  "timestamp": "2026-05-16T13:36:06.408739",
+  "mode": "spec draft 검토 (--spec)",
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

### 파일 35: review/consistency/2026/05/16/13_36_06/naming_collision/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_36_06/naming_collision/review.md b/review/consistency/2026/05/16/13_36_06/naming_collision/review.md
new file mode 100644
index 00000000..206f52c0
--- /dev/null
+++ b/review/consistency/2026/05/16/13_36_06/naming_collision/review.md
@@ -0,0 +1,50 @@
+# 신규 식별자 충돌 검토 — `spec/2-navigation/4-integration.md`
+
+검토 일시: 2026-05-16
+검토 모드: spec draft (--spec)
+
+---
+
+## 발견사항
+
+- **[INFO]** `attention` 가상 필터값 — URL 파라미터 공간 내 명확한 문서화 필요
+  - target 신규 식별자: `status=attention` (API 쿼리 파라미터 가상값)
+  - 기존 사용처: `spec/2-navigation/4-integration.md §9.1` 의 기존 가상값 `expiring` 과 같은 파라미터 공간을 공유. `spec/1-data-model.md §2.10` 의 `Integration.status` Enum (`connected / expired / error / pending_install`) 에는 없음.
+  - 상세: target 문서 자체가 `attention` 과 `expiring` 두 가상값을 명확히 "DB Enum 에 없는 virtual filter" 로 정의하고 있어 의미 충돌은 없다. 다만 `spec/1-data-model.md §2.10` 의 `status` 필드 설명과 `spec/0-overview.md` 에는 가상 필터값 목록이 별도로 기술되지 않아, 구현자가 해당 파라미터 공간의 전체 허용값을 데이터 모델만 보고 파악하기 어렵다.
+  - 제안: `spec/1-data-model.md §2.10` 의 `status` 필드 설명에 "API 필터 파라미터로는 `expiring` / `attention` 이 추가로 허용되는 가상값" 임을 주석으로 명시하거나, §9.1 의 가상값 정의를 cross-reference 링크로 명확히 연결한다.
+
+- **[INFO]** `notifyIntegrationExpiryByEmail` 설정키 — 기존 User 필드 목록에 미등재
+  - target 신규 식별자: `notifyIntegrationExpiryByEmail` (사용자 프로필 설정 토글 키)
+  - 기존 사용처: `spec/1-data-model.md §2.1 User` 엔티티 필드 목록. 해당 목록에 이 필드가 없음.
+  - 상세: target §11.3 이 "사용자별 프로필 설정에 `notifyIntegrationExpiryByEmail` 토글" 이라고 기술하지만, `spec/1-data-model.md §2.1` 의 User 엔티티 정의에는 이 컬럼이 없다. User 엔티티에 추가해야 하는지, 아니면 `User.settings` JSONB 나 별도 Preference 구조 안에 담기는지 명시되지 않아 구현 시 혼선 가능성이 있다.
+  - 제안: `spec/1-data-model.md §2.1` 에 `notifyIntegrationExpiryByEmail` (Boolean, default false) 필드를 추가하거나, `User.settings` JSONB 하위 키로 수용한다는 규약을 target 문서 §11.3 에 명기한다.
+
+- **[INFO]** `integration.scope_changed` AuditLog action — 기존 action 목록에 미등재
+  - target 신규 식별자: `integration.scope_changed` (AuditLog.action 값)
+  - 기존 사용처: `spec/1-data-model.md §2.18 AuditLog` 의 action 예시 (`workflow.create`, `trigger.update` 등). 기존 integration 관련 action 으로는 target §14.3 이 `integration.created`, `integration.deleted`, `integration.rotated`, `integration.reauthorized` 를 열거하고 있음.
+  - 상세: target §14.3 은 위 5가지 action 을 정의하나, `spec/1-data-model.md §2.18` 의 AuditLog 설명에는 integration action 목록이 박제되지 않고 예시로만 처리되어 있다. `integration.scope_changed` 는 다른 action 들과 네이밍 패턴(`<resource>.<verb_past>`)이 일치하므로 충돌은 없다.
+  - 제안: `spec/1-data-model.md §2.18` 또는 별도 AuditLog action vocabulary 문서에 integration 도메인 action 전체 목록(`integration.created`, `integration.deleted`, `integration.rotated`, `integration.reauthorized`, `integration.scope_changed`)을 명시해 구현자가 action string 을 발명하지 않도록 한다.
+
+- **[INFO]** `oauth_callback` postMessage 이벤트 — 인증 도메인 OAuth 콜백과 동명 이벤트 혼동 가능
+  - target 신규 식별자: `type: "oauth_callback"` (window.postMessage 이벤트 type 값, §10.2 §3.5)
+  - 기존 사용처: `spec/2-navigation/10-auth-flow.md §5.3` 의 소셜 로그인 OAuth 콜백(`/api/auth/oauth/:provider/callback`). 해당 콜백은 팝업 방식이 아닌 전체 창 리다이렉트 방식이나, 프론트엔드 `/callback` 페이지 처리 코드에서 `oauth_callback` 이벤트를 리스닝하는 로직이 있다면 두 흐름의 postMessage 가 혼용될 수 있다.
+  - 상세: target 의 Integration OAuth 팝업은 `type: "oauth_callback"` postMessage 를 사용하고, auth-flow 의 소셜 로그인은 전체 창 리다이렉트 → `/callback` 페이지 수신이므로 postMessage 채널 자체가 다르다. 그러나 향후 소셜 로그인을 팝업 방식으로 전환하거나, 두 흐름의 콜백 처리 코드가 한 페이지에서 공존할 경우 `type: "oauth_callback"` 이 충돌할 수 있다.
+  - 제안: Integration OAuth 팝업의 postMessage type 을 `"integration_oauth_callback"` 으로 구체화해 auth 도메인의 oauth 이벤트와 명시적으로 구분한다. 특히 `provider` 필드가 동일한 `"google"` / `"github"` 를 담을 수 있어 수신 측 필터링 로직 혼용 위험이 있다.
+
+- **[INFO]** `INTEGRATION_NOT_CONNECTED` 에러 코드 — status 전이 범위와 코드 의미 범위 불일치
+  - target 신규 식별자: `INTEGRATION_NOT_CONNECTED` (§14.1 에러 코드 vocabulary)
+  - 기존 사용처: `spec/1-data-model.md §2.10` Integration.status Enum 은 `connected / expired / error / pending_install` 4개.
+  - 상세: `INTEGRATION_NOT_CONNECTED` 는 "Integration 상태가 `expired`/`error`" 일 때 발생한다고 §14.1 에 정의되어 있다. 그런데 상태 전이 §6 에 따르면 `pending_install` 도 노드·AI Agent 에서 사용 불가 상태다 (`INTEGRATION_INCOMPLETE` 로 처리). `pending_install` 은 `INTEGRATION_NOT_CONNECTED` 가 아니라 `INTEGRATION_INCOMPLETE` 로 따로 처리되어 있어 코드 의미 범위가 일관성 있게 정의되어 있다. 다만 `error(*)` 의 세부 사유(`auth_failed`, `insufficient_scope`, `network`) 에 따라 사용자에게 제공해야 할 복구 안내가 다르므로, 노드 실행 엔진이 단일 코드로 집약하면 세분화된 안내가 불가능하다는 설계 trade-off 가 spec 에 명기되지 않았다.
+  - 제안: `INTEGRATION_NOT_CONNECTED` 의 적용 범위에 `pending_install` 제외 이유를 주석으로 명기하거나, 세부 `error.reason` 필드를 통해 클라이언트가 `status_reason` 을 재현할 수 있도록 에러 응답 스키마를 확장하는 방향을 검토한다.
+
+---
+
+## 요약
+
+target 문서 `spec/2-navigation/4-integration.md` 가 도입하는 신규 식별자들은 기존 코퍼스와 **CRITICAL 또는 WARNING 수준의 실질적 충돌이 없다**. 가상 필터값 `attention` / `expiring` 은 DB Enum 과 명확히 분리된 API 파라미터 공간에 정의되어 있고, BullMQ job 명(`connected-expiry`, `pending-install-ttl`, `usage-log-prune`, `cafe24-background-refresh`), 에러 코드, API 엔드포인트, AuditLog action 모두 기존 동명 식별자와 충돌하지 않는다. 다만 네 가지 INFO 항목이 발견되었다: (1) 가상 필터값이 데이터 모델 문서에 cross-reference 없이 누락된 점, (2) `notifyIntegrationExpiryByEmail` 필드가 User 엔티티 정의에 미등재된 점, (3) Integration AuditLog action vocabulary 가 데이터 모델에 미박제된 점, (4) `oauth_callback` postMessage type 이 auth 도메인 소셜 로그인 흐름의 동명 이벤트와 장기적으로 혼동될 소지가 있는 점. 이들은 즉각적인 구현 충돌보다는 문서 정합성 및 미래 확장 시 혼선 방지를 위한 보완 사항이다.
+
+---
+
+## 위험도
+
+LOW

```

---

### 파일 36: review/consistency/2026/05/16/13_36_06/plan_coherence/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_36_06/plan_coherence/review.md b/review/consistency/2026/05/16/13_36_06/plan_coherence/review.md
new file mode 100644
index 00000000..2c51f58c
--- /dev/null
+++ b/review/consistency/2026/05/16/13_36_06/plan_coherence/review.md
@@ -0,0 +1,76 @@
+# Plan 정합성 검토 — `spec/2-navigation/4-integration.md`
+
+검토 모드: spec draft (`--spec`)
+검토 일시: 2026-05-16
+
+---
+
+## 발견사항
+
+### 발견사항 1
+
+- **[WARNING]** `integration-attention-filter.md` 의 "Spec 갱신" 단계가 미체크인데 target spec 에 이미 반영됨
+  - target 위치: §2.1 ASCII 다이어그램 (`[Attention]` 칩 라인), §2.3 상태 칩 표 (`Attention` 항목), §2.4 "Need attention" 배너 (분해 카운트·단일 건 직접 점프·톤 강조), §9.1 `attention` 가상 필터값, Rationale "Attention 가상 필터값" 항
+  - 관련 plan: `plan/in-progress/integration-attention-filter.md` §"작업 체크리스트" — `(project-planner) spec 갱신 + /consistency-check --spec` 항목이 `[ ]` 상태
+  - 상세: plan 의 spec 갱신 체크박스(`[ ] (project-planner) spec 갱신 + /consistency-check --spec`)는 아직 미체크이나, target spec draft 는 이미 해당 변경을 완전히 반영하고 있다. `/consistency-check --spec` 통과 확인도 plan 에 기록되어 있지 않다. plan 과 실제 작업 상태가 불일치하여 추적이 끊겨 있다.
+  - 제안: target spec 이 정합 상태라면 plan 의 해당 체크박스를 `[x]`로 갱신하고, `/consistency-check --spec` 세션 경로를 plan 에 기록한다. 본 consistency-check 세션 자체가 그 통과 증거가 된다.
+
+---
+
+### 발견사항 2
+
+- **[WARNING]** `spec-update-cafe24-background-refresh.md` 에서 요청한 §11 `cafe24-background-refresh` job 기술이 target 에 추가되었으나 plan 이 미완료 상태
+  - target 위치: §11 상단 안내문 (네 번째 job `cafe24-background-refresh`), §11.1 스캐너 잡 표, Rationale "BullMQ `cafe24-token-refresh` 큐 — 멀티 인스턴스 race 해소" 및 "`cafe24-background-refresh` 10일 임계" 항
+  - 관련 plan: `plan/in-progress/spec-update-cafe24-background-refresh.md` (worktree: `prod-rereview-fix-a7c93f`) — 진행 상태의 체크박스 3개 모두 `[ ]`
+  - 상세: plan 이 요청한 4개 항목(§11 안내문 정정, §11.x 신규 소절, §11.1 표 추가, Rationale 항목)이 target 에 이미 기술되어 있다. 단, plan 의 체크박스가 전혀 완료 표기되지 않았고 plan 이 `complete/` 로 이동되지도 않았다. plan 상태와 실제 산출물이 불일치.
+  - 제안: plan 체크박스를 `[x]`로 갱신하고, `/consistency-check --spec` 통과 확인 후 `git mv plan/in-progress/spec-update-cafe24-background-refresh.md plan/complete/`로 이동한다.
+
+---
+
+### 발견사항 3
+
+- **[WARNING]** `cafe24-pending-polish-followup.md` 그룹 F — §6 mermaid `install_token` 보존 정책 명시 항목 미반영
+  - target 위치: §6 상태 전이 다이어그램 및 전이 표
+  - 관련 plan: `plan/in-progress/cafe24-pending-polish-followup.md` §"그룹 F" — `[ ] §6 mermaid install_token 보존 정책 명시. callback 실패 시 install_token 유지 → 재시도 가능 (data-flow §1.2.1 에는 이미 명시).`
+  - 상세: target §6 는 `pending_install → connected` 전이 표 항에서 "install_token 은 **보존**" 텍스트를 설명 열에 담고 있으나, 상단 ASCII 상태 머신 다이어그램 자체에 이 보존 사실이 명시적으로 표현되지 않는다. plan 이 "mermaid `install_token` 보존 정책 명시" 라고 요청한 사항과 현재 다이어그램이 일치하는지 모호하다. 해당 항목은 여전히 미체크.
+  - 제안: §6 ASCII 다이어그램 또는 전이 표에 `install_token` NULL 화 예외 경로(`pending_install → expired` 만 NULL)를 주석으로 추가하거나, 이미 충분하다고 판단되면 plan 체크박스를 `[x]`로 갱신해 추적을 닫는다.
+
+---
+
+### 발견사항 4
+
+- **[WARNING]** `spec-update-cafe24-app-url-reuse.md` plan 이 동일 파일(`spec/2-navigation/4-integration.md`)을 다루고 있으며, 해당 내용이 target 에 이미 반영됨 — plan 상태 확인 필요
+  - target 위치: §3.2 Cafe24 Private 흐름 step 6 ("install_token 은 **보존**"), §4.4 Scope & Permissions 분기 ② (`cafe24_private_pending` 응답, inline alert 패턴), §6 전이 표, §9.2 `install_token` 관련 설명, Rationale "Cafe24 App URL 재호출 흐름 — install_token persistent 격상" 및 "Cafe24 Private request-scopes 흐름"
+  - 관련 plan: `plan/in-progress/spec-update-cafe24-app-url-reuse.md` (worktree: `cafe24-app-url-reuse-f9a2e3`) — 영향 받는 spec 섹션으로 §3.2, §4.4, §6, §9.2 가 명시되어 있음. 본 worktree(`integration-attention-filter-053b74`)의 spec draft 가 이 변경을 포함하고 있다.
+  - 상세: `spec-update-cafe24-app-url-reuse.md` 의 worktree(`cafe24-app-url-reuse-f9a2e3`)와 본 target 의 worktree(`integration-attention-filter-053b74`)가 동일 파일의 같은 섹션에 변경을 기록하고 있을 가능성이 있다. 두 worktree 가 병렬로 해당 파일을 수정 중이라면 merge 시 충돌이 발생할 수 있다. 다만, spec-update-cafe24-app-url-reuse.md 에는 "Spec 갱신" Phase가 완료 여부가 불명확하다.
+  - 제안: `spec-update-cafe24-app-url-reuse.md` 의 실제 진행 상태를 확인하고, 해당 spec 변경이 이미 다른 PR 으로 main 에 merge 되었다면 plan 을 `complete/`로 이동한다. 아직 미머지라면 target spec 의 동일 섹션 변경과 충돌 범위를 사전 식별해 직렬화한다.
+
+---
+
+### 발견사항 5
+
+- **[INFO]** `integration-attention-filter.md` 의 `/consistency-check --impl-prep` 단계가 미체크 — target spec 개정과 관계
+  - target 위치: 전체 spec draft
+  - 관련 plan: `plan/in-progress/integration-attention-filter.md` 작업 체크리스트 `[ ] (developer) /consistency-check --impl-prep`
+  - 상세: plan 은 developer 단계에서 `--impl-prep` 을 먼저 수행하도록 규정하고 있으나, 본 세션은 `--spec` 모드로 호출됐다. spec draft 단계에서 `--spec` 으로 시작하는 흐름은 정상이나, 이후 구현 착수 시 `--impl-prep` 을 빠뜨리지 않도록 plan 에 명시적으로 표기해 두는 것이 좋다.
+  - 제안: 현재 단계(spec 검토)는 정상이므로 즉각 조치 불필요. 이후 developer 가 구현 착수 시 plan 에 따라 `--impl-prep` 을 반드시 수행한다.
+
+---
+
+### 발견사항 6
+
+- **[INFO]** `cafe24-pending-polish-followup.md` 그룹 F — `spec/conventions/swagger.md §2-4` 실재 확인 및 cross-link 정정 항목 미반영
+  - target 위치: §9.4 에러 코드 표의 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)` 항 ("swagger 규약(spec/conventions/swagger.md §2-4)" 참조)
+  - 관련 plan: `plan/in-progress/cafe24-pending-polish-followup.md` 그룹 F `[ ] spec/conventions/swagger.md §2-4 실재 확인 및 cross-link 정정`
+  - 상세: target §9.4 에서 `spec/conventions/swagger.md §2-4` 를 인라인 참조하고 있으나, 해당 파일의 실재 여부 및 섹션 번호가 확인되지 않았다. 이 항목은 plan 에서 미체크로 남아 있다.
+  - 제안: plan 의 해당 항목이 처리되기 전까지 target 의 인라인 참조가 broken link 일 수 있음을 인지한다. 구현 착수 전 또는 spec merge 전에 해당 경로 존재 여부를 확인한다.
+
+---
+
+## 요약
+
+Target(`spec/2-navigation/4-integration.md`) draft 는 `integration-attention-filter.md` 가 요청한 Attention 필터·배너 개선, `spec-update-cafe24-background-refresh.md` 가 요청한 `cafe24-background-refresh` job 문서화, `spec-update-cafe24-app-url-reuse.md` 가 요청한 `install_token` persistent 처리 및 request-scopes 분기를 모두 적절히 반영하고 있다. 미결 결정을 일방적으로 우회하거나 다른 plan 이 진행 중인 영역과 직접 충돌하는 CRITICAL 수준 이슈는 없다. 주요 위험은 관련 plan 3건(`integration-attention-filter`, `spec-update-cafe24-background-refresh`, `spec-update-cafe24-app-url-reuse`)의 체크박스와 완료 상태가 실제 산출물과 불일치한다는 추적 단절이다. `cafe24-pending-polish-followup.md` 의 §6 다이어그램 보완·swagger cross-link 확인 항목도 여전히 미체크로 남아 있어 후속 처리 시 누락 위험이 있다. worktree 경합 관점에서는 `spec-update-cafe24-app-url-reuse.md`(worktree `cafe24-app-url-reuse-f9a2e3`)가 동일 파일을 다루고 있어 merge 충돌 가능성을 사전에 확인해야 한다.
+
+## 위험도
+
+LOW

```

---

### 파일 37: review/consistency/2026/05/16/13_36_06/rationale_continuity/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_36_06/rationale_continuity/review.md b/review/consistency/2026/05/16/13_36_06/rationale_continuity/review.md
new file mode 100644
index 00000000..d9ea157d
--- /dev/null
+++ b/review/consistency/2026/05/16/13_36_06/rationale_continuity/review.md
@@ -0,0 +1,73 @@
+# Rationale 연속성 검토 결과
+
+대상 문서: `spec/2-navigation/4-integration.md`
+
+---
+
+### 발견사항
+
+- **[INFO]** `Attention` 필터 칩의 단일 선택 모델 — 기각된 멀티 선택 방식이 재도입되지 않았음을 확인
+  - target 위치: §2.3 검색·필터, §2.4 클릭 동작, §9.1 목록 API
+  - 과거 결정 출처: `## Rationale` "Attention 가상 필터값 — Expired ∪ Expiring ∪ Error 를 단일 칩으로 노출 (2026-05-16)"
+  - 상세: Rationale 에서 `?status=expiring&status=expired` 같은 multi-value 쿼리 및 멀티 선택 칩 도입이 명시적으로 기각됐다. target 문서는 `Attention` 단일 칩(`?status=attention`)을 채택해 합집합을 제공하며 기각된 대안과 충돌하지 않는다.
+  - 제안: 현재 구현이 Rationale 의 의도에 부합하므로 조치 불필요. Rationale 자체가 충분히 명문화되어 있어 향후 개발자가 multi-value 쿼리로 회귀하지 않도록 보호되고 있다.
+
+- **[INFO]** `install_token` 단일 row 조회 우선 + `tryRecoverByMallId` fallback 구조 — 폐기된 "100건 전수 스캔" 패턴과의 충돌 여부
+  - target 위치: §9.2 `GET /api/3rd-party/cafe24/install/:installToken` 엔드포인트, §9.4 `CAFE24_INSTALL_INVALID_TOKEN` 에러
+  - 과거 결정 출처: `## Rationale` "install_token 을 App URL path 식별 키로 승격 (2026-05-14)", "Cafe24 install_token mismatch 회복 흐름 — 보안 전제 (2026-05-16)"
+  - 상세: 옛 100건 스캔 방식은 install_token 이 없던 시절의 "모든 호출에 적용된 식별 전략"으로 폐기됐다. 새 회복 흐름(`tryRecoverByMallId`)은 단일 row 조회 실패 시에만 fallback으로 작동하고 HMAC 검증을 동반하며, Rationale "Cafe24 install_token mismatch 회복 흐름 — 보안 전제" 항에서 이 구분이 명시적으로 설명돼 있다. target 문서도 "직접 매칭 실패 시 `tryRecoverByMallId` 회복 흐름 fall-back" 이라고 표기해 우선순위를 올바르게 기술하고 있다.
+  - 제안: 조치 불필요. Rationale 에서 "이 회복 흐름은 폐기된 전략과 본질적으로 다른 경로"임을 충분히 설명하고 있어 혼동 위험이 낮다.
+
+- **[WARNING]** `pending_install → expired` 상태 전이에서 `install_token=NULL` 소거가 target §6과 §9.2 간 일관성 미세 불일치
+  - target 위치: §6 상태 전이 표 `pending_install → expired` 행 ("install_token=NULL 로 자동 전이"), Rationale "Cafe24 App URL 재호출 흐름" 항의 "NULL 처리 유지 경로"
+  - 과거 결정 출처: `## Rationale` "Cafe24 App URL 재호출 흐름 — install_token persistent 격상 (2026-05-15)", "install_token TTL 24h (2026-05-14)"
+  - 상세: Rationale "Cafe24 App URL 재호출 흐름" 항은 "`pending_install → connected` 전이 시 token 보존 (옛: NULL 처리 → 새: 그대로)"을 명시했고, "NULL 처리 유지 경로" 섹션에서 "TTL 만료는 token 을 NULL 로 소거 유지"라고 별도로 명시했다. §6 전이 표에는 `pending_install → expired` 행에 `install_token=NULL` 이 표기되어 있고, §9.2 엔드포인트 설명에는 `install_token` 이 NULL 이 아닌 경우에 `CAFE24_INSTALL_INVALID_TOKEN(404)` 라고 설명되어 있어 두 섹션이 모순 없이 일치한다. 그러나 Rationale 에는 두 경로("connected 시 보존" vs "TTL 만료 시 NULL")가 한 섹션 안에 인접 서술되어 있어 코드 작성자가 혼동할 소지가 있다.
+  - 제안: Rationale 에 "install_token NULL 처리 매트릭스 — 전이 경로별 처리" 소절을 추가해 각 전이에서 `install_token` 의 상태를 표로 정리하면 혼동을 예방할 수 있다. target 본문 자체는 수정 불필요.
+
+- **[INFO]** `refresh 실패 → error(auth_failed)` 번복 — Rationale 신규 작성 여부 확인
+  - target 위치: §6 상태 전이 표 `connected → error(auth_failed)` 행 (2026-05-16 갱신 주석), §10.5 토큰 자동 갱신 (갱신 실패 시)
+  - 과거 결정 출처: `## Rationale` "refresh 실패 시 status_reason 통일 (2026-05-16)"
+  - 상세: 기존 spec §6 가 명시한 `connected → expired (refresh fail)` 경로를 번복해 `error(auth_failed)` 로 통일했으며, Rationale 섹션에 이유 (a)(b)(c) 가 명시적으로 기재되어 있다. target 본문의 §6 전이 행에 "(2026-05-16 갱신 — 옛 `connected → expired (refresh fail)` 경로를 본 행으로 통합; Rationale 참고)" 인라인 참조가 있다. 번복이 Rationale 과 함께 제대로 기록되어 있어 "결정의 무근거 번복" 기준에 해당하지 않는다.
+  - 제안: 조치 불필요.
+
+- **[INFO]** `install_timeout` 알림 미발사 — Rationale 근거 존재 여부 확인
+  - target 위치: §11.1 스캐너 잡 `pending-install-ttl` 행 ("알림 미발사"), §11.2 알림 발사 정책
+  - 과거 결정 출처: `## Rationale` "install_timeout 알림 미발사 (2026-05-16)"
+  - 상세: spec 문서가 코드의 의도적 동작을 사후 명문화한 케이스로, Rationale 에 (a)~(d) 사유와 기각된 옵션(install_timeout 알림 발사)까지 충실히 기재되어 있다. target 본문과 Rationale 가 완전히 정합한다.
+  - 제안: 조치 불필요.
+
+- **[INFO]** `pending_install` 칩 미추가 — Rationale 일관성 확인
+  - target 위치: §2.3 상태 칩, Rationale "Attention 가상 필터값" 내 pending_install 관련 주석
+  - 과거 결정 출처: `## Rationale` "`pending_install` 은 필터 칩에 추가하지 않는다 (2026-05-14)"
+  - 상세: §2.3 본문에 "※ 상태 칩에 `pending_install` 은 포함하지 않는다 — 외부 흐름 진행 중 정상 전환 상태이며, 사용자가 명시적으로 필터링할 수요가 낮다" 라는 명시적 설명이 있고 Rationale 항도 있다. 정합한다.
+  - 제안: 조치 불필요.
+
+- **[WARNING]** `Attention` 배너 클릭: "합계 = 1 → detail 직접 이동" 동작의 Rationale 근거가 본문 인라인 설명에만 있음
+  - target 위치: §2.4 클릭 동작 (`합계 = 1 → 그 한 건의 detail 페이지로 직접 이동`)
+  - 과거 결정 출처: `## Rationale` "Attention 가상 필터값" 3번 항 ("합계 = 1 일 때는 필터링 단계가 잉여이므로 그 한 건의 detail 로 직접 점프")
+  - 상세: 이 UX 분기 결정은 §2.4 본문에 약식 설명("UX 단축 — 1건이면 사용자가 어차피 그 건으로 갈 것")으로 기재됐으며, Rationale 에도 동일 내용이 담겨 있다. 그러나 "합계 = 1" 과 "합계 ≥ 2" 분기가 다른 동작을 하는 edge case로서, 향후 개발자가 배너 클릭 로직을 변경할 때 Rationale 참조 없이 본문만 보면 의도를 놓칠 수 있다.
+  - 제안: §2.4 해당 항에 `(Rationale "Attention 가상 필터값" §3 참고)` 같은 명시적 cross-reference 를 추가하면 연속성이 강화된다.
+
+- **[INFO]** `OAuthState.mode='reauthorize'` 를 Cafe24 Private 초기 install 에 재사용 — 기각된 별도 mode 신설안 관련
+  - target 위치: §10.2 step 4 모드별 분기 (`reauthorize` 항), §3.2 Cafe24 Private 흐름
+  - 과거 결정 출처: `## Rationale` "OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유 (2026-05-14)"
+  - 상세: `mode='cafe24_private_install'` 별도 enum 신설을 기각한 결정이 Rationale 에 기재되어 있고, target 문서는 기존 `reauthorize` mode 를 재사용하는 방향으로 일관되게 기술하고 있다. 기각된 대안이 재도입되지 않았다.
+  - 제안: 조치 불필요.
+
+- **[INFO]** Cafe24 scope 인코딩 — 공백 구분이 아닌 콤마 구분 사용 (다른 provider 와 다름)
+  - target 위치: §3.2 OAuth2 흐름 (Cafe24 Public 앱) step 4 "scope 인코딩"
+  - 과거 결정 출처: target 문서 내 인라인 설명 (Cafe24 자체 규약으로 명시됨)
+  - 상세: 이 결정은 외부 플랫폼 제약(Cafe24 API 규약)에 의한 것으로, 기존 spec Rationale 와 충돌하지 않는다. 다만 이 규칙이 `## Rationale` 항이 아닌 본문 인라인 주석으로만 설명되어 있다. Google/GitHub 가 공백 구분을 사용하는 반면 Cafe24 만 예외라는 사실이 미래 구현자에게 놀라움의 원인이 될 수 있다.
+  - 제안: `## Rationale` 에 "Cafe24 scope 구분자 — RFC 6749 공백 대신 콤마" 소절을 신설하여 외부 플랫폼 제약임을 명시하면 invariant 문서화가 강화된다.
+
+---
+
+### 요약
+
+`spec/2-navigation/4-integration.md` 의 target 문서는 과거 Rationale 에서 명시적으로 기각된 설계 대안(멀티 선택 칩 방식, 100건 전수 스캔 식별, `mode='cafe24_private_install'` 신설, install timeout 자동 삭제 등)을 재도입하지 않았으며, 합의된 원칙(영속 상태 vs 화면 필터 술어 분리, install_token persistent 식별자, reauthorize 버튼 비활성 조건 등)도 충실히 따르고 있다. 결정 번복(`refresh 실패 → error(auth_failed)`, install_timeout 알림 미발사)이 포함되어 있으나 모두 Rationale 신규 근거와 함께 기재되어 있다. 발견된 이슈는 주로 인라인 설명에 머물고 있는 결정을 Rationale 섹션으로 격상하거나 cross-reference 를 보강하는 수준의 정합 보완 제안이며, CRITICAL 또는 합의된 invariant 직접 위반에 해당하는 항목은 없다.
+
+---
+
+### 위험도
+
+LOW

```

---

### 파일 38: spec/2-navigation/4-integration.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/2-navigation/4-integration.md b/spec/2-navigation/4-integration.md
index 3feb804b..e62638f3 100644
--- a/spec/2-navigation/4-integration.md
+++ b/spec/2-navigation/4-integration.md
@@ -24,13 +24,14 @@
 ┌─────────────────────────────────────────────────────────┐
 │  Integrations                    [+ Add Integration]    │
 │                                                         │
-│  ⚠ 3 integrations need attention  (expiring / error)   │
+│  ⚠ 3 integrations need attention                        │
+│     Expired 1 · Expiring 1 · Error 1 · Click to filter  │
 │                                                         │
 │  ┌──────────────────┐  ┌──────────────────┐             │
 │  │ 🔍 Search...     │  │ Scope: All ▼     │             │
 │  └──────────────────┘  └──────────────────┘             │
 │  [All] [Google] [GitHub] [HTTP] [DB] [Email] [Webhook]
-│  [All] [Connected] [Expiring] [Expired] [Error]         │
+│  [All] [Attention] [Connected] [Expiring] [Expired] [Error] │
 │                                                         │
 │  Organization                                           │
 │  ┌─────────────────────────────────────────────────────┐ │
@@ -65,7 +66,11 @@
 | 검색 입력 | 별칭(`name`) ILIKE 부분 일치 |
 | Scope 셀렉트 | `All` / `Personal` / `Organization` |
 | 서비스 유형 칩 | 다중 선택 가능. 선택 없음 = 전체 |
-| 상태 칩 | `All` / `Connected` / `Expiring` (7일 이내) / `Expired` / `Error`. 단일 선택 |
+| 상태 칩 | `All` / `Attention` / `Connected` / `Expiring` (7일 이내) / `Expired` / `Error`. 단일 선택 |
+
+`Attention` 은 §2.4 배너와 동일한 합집합 — `Expired ∪ Expiring ∪ Error` — 을 단일 칩으로 노출한다. 한 칩만 누르면 "지금 손봐야 하는 통합" 을 모두 보여주는 게 사용자 멘탈 모델에 맞고, 단일 선택 칩 모델을 깨지 않으면서 합집합을 제공할 수 있는 유일한 표현이다 (Rationale "Attention 가상 필터값" 항 참고).
+
+※ `expiring` 과 `attention` 두 값은 DB `Integration.status` Enum 에는 존재하지 않는 **가상 필터값(virtual filter)** 이다 — 백엔드 쿼리 빌더가 §9.1 의 `status` 파라미터를 받아 합집합 WHERE 절로 변환한다. DB Enum (`connected`/`expired`/`error`/`pending_install`) 자체를 확장하지 않는 것은 영속화되는 상태와 화면 필터링용 술어를 분리하기 위함이다.
 
 ※ 상태 칩에 `pending_install` 은 포함하지 않는다 — 외부 흐름(Cafe24 Developers "테스트 실행") 진행 중 정상 전환 상태이며, 사용자가 명시적으로 필터링할 수요가 낮다. 별도 수요 발생 시 후속 plan 으로 재검토 (Rationale 참고).
 
@@ -73,9 +78,14 @@
 
 ### 2.4 "Need attention" 배너
 
-- 조건: `status IN (expired, error)` OR `token_expires_at <= now() + 7d`. `pending_install` 은 사용자가 외부(Cafe24 Developers)에서 흐름을 진행 중인 정상 상태로 보고 배너에서 제외한다 — `status_reason` 이 채워진 케이스도 동일 (재시도가 cafe24 측에서 일어나므로 우리 화면의 attention 으로는 잡지 않음).
-- 클릭 시 상태 필터를 `Expiring | Expired | Error`로 자동 전환
-- 배너는 해당 조건의 연동이 0건이면 비표시
+- **포함 조건**: `status IN (expired, error)` OR `(status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d')`. `pending_install` 은 사용자가 외부(Cafe24 Developers)에서 흐름을 진행 중인 정상 상태로 보고 배너에서 제외 — `status_reason` 이 채워진 케이스도 동일. `install_timeout` 사유로 `expired` 가 된 Cafe24 Private 행은 attention 에 포함된다 (사용자 조치(삭제 후 재등록)가 필요한 정상 운영 신호).
+- **표시 내용 (분해 카운트)**: 한 줄 요약 (`"통합 N건이 주의가 필요해요"`) + 그 아래에 분해 카운트 (`"만료 X · 만료 임박 Y · 오류 Z"`). 카운트가 0 인 카테고리는 표시하지 않는다.
+- **톤 강조**: 기본 톤은 amber (warning). 분해 카운트의 `error ≥ 1` 이면 좌측 dot / border 색을 red 로 강조해 가장 시급한 사유를 시각적으로 알린다 — 텍스트는 동일.
+- **클릭 동작**:
+  - 합계 ≥ 2 → `?status=attention` 으로 URL 갱신 (§9.1 가상 필터값) → 같은 페이지에 합집합 결과 표시.
+  - 합계 = 1 → 그 한 건의 detail 페이지(`/integrations/<id>`) 로 직접 이동. 필터링 단계는 우회한다 (UX 단축 — 1건이면 사용자가 어차피 그 건으로 갈 것).
+- **0건이면 비표시**.
+- URL 직접 진입 (`/integrations?status=attention`) 도 동일 합집합 결과를 보여준다 (`Attention` 칩이 활성화된 상태).
 
 ### 2.5 Add Integration 모달 (Step 1)
 
@@ -669,7 +679,7 @@ Please replace or remove these node references first.
 
 | 메서드 | 경로 | 설명 |
 |--------|------|------|
-| GET | `/api/integrations` | 목록 조회. 쿼리: `q`, `scope`, `serviceType`, `status`, `page`, `limit`. 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수 |
+| GET | `/api/integrations` | 목록 조회. 쿼리: `q`, `scope`, `serviceType`, `status`, `page`, `limit`. `status` 허용값 = `connected` / `expiring` / `expired` / `error` / `attention` — 이 중 `expiring` 과 `attention` 은 **가상 필터값** 으로 DB Enum 에는 없고 백엔드 쿼리 빌더가 합집합 WHERE 절로 변환한다 (`expiring` = `status='connected' AND token_expires_at within 7d`, `attention` = `Expired ∪ Expiring ∪ Error`). 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수. |
 | POST | `/api/integrations` | 연동 생성. OAuth는 `preview_token`으로 서버 임시 저장 토큰 참조 |
 | GET | `/api/integrations/:id` | 상세 조회 (credentials는 마스킹) |
 | PATCH | `/api/integrations/:id` | 별칭 등 메타 수정 |
@@ -846,7 +856,7 @@ for each integration:
 
 ### 11.4 UI 배지
 
-- 사이드바 Integration 메뉴: `status IN (expired, error) OR (token_expires_at <= now() + 7d)` 카운트
+- 사이드바 Integration 메뉴: `status IN (expired, error) OR (status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d')` 카운트 — §2.4 배너 포함 조건 및 §9.1 `?status=attention` 가상 필터값과 동일한 술어. `pending_install` 은 제외.
 - 목록 페이지: 카드 모서리 뱃지 + "Need attention" 배너 (§2.4)
 - 상세 헤더: 상태 배지 + 만료 임박일 경우 `Expires in Nd` 표시
 
@@ -929,6 +939,21 @@ Integration 생성·삭제·회전·재인증·scope 전환 이벤트를 `resour
 
 ## Rationale
 
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
 ### Cafe24 Private 앱의 callback 실패는 왜 status 를 보존하나 (2026-05-14)
 
 `pending_install` 상태의 Integration 이 callback 처리 중 token exchange 실패 등으로 떨어졌을 때, 자연스러운 선택지는 `error(auth_failed)` 로 전이하는 것이다. 그러나 Private 앱은 `reauthorize` 액션이 불가능하다 — OAuth 재시작은 **Cafe24 Developers 의 "테스트 실행"** 만 정식 진입점이고, 그 진입점은 우리가 발급한 `install_token` 을 path 에 그대로 사용한다. status 를 `error` 로 바꾸면 (a) UI 가 "reauthorize" 액션을 권장하지만 실제로 그 액션이 무력하고, (b) 사용자는 cafe24 측 설정을 고친 뒤 다시 "테스트 실행" 을 누르는 외부 흐름을 진행 중인데 우리 화면이 이를 "error" 로 표기해 흐름 단계를 오인하게 된다. 따라서 callback 실패는 `status_reason` + `last_error` 만 채우고 status 는 `pending_install` 그대로 유지한다. (참고: `review/consistency/2026/05/14/18_23_55`)

```
