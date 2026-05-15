# 의존성(Dependency) Review Payload

본 파일은 orchestrator 가 의존성(Dependency) reviewer 용으로 작성한 입력입니다. 다음 코드 변경을 의존성 관점에서 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (의존성(Dependency))

1. **새 의존성**: 새 외부 패키지/라이브러리 추가 여부와 필요성
2. **버전 고정**: 의존성 버전 고정(pinning) 여부
3. **라이선스**: 새 의존성의 라이선스가 프로젝트와 호환되는지
4. **취약점**: 알려진 보안 취약점이 있는 의존성 사용 여부
5. **불필요한 의존성**: 표준 라이브러리·기존 의존성으로 대체 가능한지
6. **의존성 크기**: 번들 크기·빌드 시간 영향
7. **호환성**: 기존 의존성과의 버전 충돌·호환성
8. **내부 의존성**: 프로젝트 내부 모듈 간 의존 관계

## 리뷰 대상 파일

### 파일 1: frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
commit 6db2d5df66df8b0e8f2ea34730b1c016390ea3c9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 01:00:10 2026 +0900

    fix(integrations): cafe24 Private request-scopes 응답에 대한 UI 안내 표시
    
    상세 페이지에서 추가 권한을 요청하면 백엔드는 `cafe24_private_pending` 모드와
    `scopesAdded` 를 반환하지만 onSuccess 가 `authUrl` 분기만 처리하고 있어 사용자는
    화면 변화 없이 "아무 일도 안 일어남" 으로 인식하던 버그를 수정한다.
    
    - ScopeTab 을 별도 모듈 `scope-tab.tsx` 로 추출 (Next.js page 파일에 named
      export 가 금지되어 단위 테스트가 직접 import 할 수 없는 제약 해소).
    - requestMutation.onSuccess 에 `mode === 'cafe24_private_pending'` 분기 추가.
      → inline amber alert 로 "Cafe24 Developers 에서 권한 추가 → 테스트 실행"
      안내문(spec §4.4 의 안내 문구)과 `scopesAdded` 목록을 표시 + `toast.info`
      로 즉시 알림.
    - `OAuthBeginResult` 와 분리된 `RequestScopesResult` 타입 신설 — Cafe24
      Private 분기에서 `scopesAdded: string[]` 를 type-safe 하게 노출.
    - i18n 키 추가 (ko/en): `cafe24PrivateScopeRequestTitle` /
      `cafe24PrivateScopeRequestDesc` / `cafe24PrivateScopeRequestScopesAdded`.
      consistency-checker W-3 권고에 따라 신규 통합의 `cafe24PrivatePending*`
      계열과 prefix 분리.
    - `openOAuthPopup` 도 공용 모듈로 추출.
    - 단위 테스트 2건 추가 (cafe24 분기 / authUrl 분기).
    
    사전 일관성 검토 BLOCK: NO — `review/consistency/2026/05/16/00_36_35/SUMMARY.md`.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx b/frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx
new file mode 100644
index 00000000..c933834f
--- /dev/null
+++ b/frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx
@@ -0,0 +1,171 @@
+import { describe, it, expect, beforeEach, vi } from "vitest";
+import { render, screen, act, cleanup, waitFor } from "@testing-library/react";
+import userEvent from "@testing-library/user-event";
+import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
+import { useLocaleStore } from "@/lib/stores/locale-store";
+import type {
+  IntegrationDto,
+  RequestScopesResult,
+  ServiceDefinition,
+} from "@/lib/api/integrations";
+import { useT } from "@/lib/i18n";
+
+const requestScopesMock = vi.fn();
+vi.mock("next/navigation", () => ({
+  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
+}));
+vi.mock("@/lib/api/integrations", async () => {
+  const actual = await vi.importActual<typeof import("@/lib/api/integrations")>(
+    "@/lib/api/integrations",
+  );
+  return {
+    ...actual,
+    integrationsApi: {
+      requestScopes: (...args: unknown[]) => requestScopesMock(...args),
+    },
+  };
+});
+
+import { ScopeTab } from "../scope-tab";
+
+function buildIntegration(overrides: Partial<IntegrationDto> = {}): IntegrationDto {
+  return {
+    id: "int-cafe24-1",
+    workspaceId: "ws-1",
+    serviceType: "cafe24",
+    name: "My Mall",
+    authType: "oauth2",
+    credentials: {
+      app_type: "private",
+      mall_id: "demoshop",
+      scopes: ["mall.read_product"],
+    },
+    scope: "personal",
+    status: "connected",
+    statusReason: null,
+    credentialsStatus: "ok",
+    tokenExpiresAt: null,
+    lastUsedAt: null,
+    lastRotatedAt: null,
+    lastError: null,
+    meta: { appType: "private" },
+    createdBy: "user-1",
+    createdAt: "2026-05-16T00:00:00Z",
+    updatedAt: "2026-05-16T00:00:00Z",
+    ...overrides,
+  };
+}
+
+function buildService(): ServiceDefinition {
+  return {
+    type: "cafe24",
+    name: "Cafe24",
+    oauthProvider: null,
+    authTypes: ["oauth2"],
+    authVariants: [],
+    scopes: [
+      { value: "mall.read_product", label: "Read product" },
+      { value: "mall.write_product", label: "Write product" },
+      { value: "mall.read_order", label: "Read order" },
+    ],
+  };
+}
+
+function Wrapper({ children }: { children: React.ReactNode }) {
+  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
+  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
+}
+
+function HostedScopeTab() {
+  const t = useT();
+  return (
+    <ScopeTab
+      integration={buildIntegration()}
+      service={buildService()}
+      onChanged={() => {}}
+      t={t}
+    />
+  );
+}
+
+describe("ScopeTab — Cafe24 Private request-scopes UI", () => {
+  beforeEach(() => {
+    vi.clearAllMocks();
+    useLocaleStore.setState({ locale: "en" });
+    cleanup();
+  });
+
+  it("renders the Cafe24 pending alert with scopesAdded when the server signals cafe24_private_pending", async () => {
+    const response: RequestScopesResult = {
+      mode: "cafe24_private_pending",
+      integrationId: "int-cafe24-1",
+      appUrl: "https://example.com/api/3rd-party/cafe24/install/abc",
+      callbackUrl: "https://example.com/api/3rd-party/cafe24/callback",
+      scopesAdded: ["mall.write_product", "mall.read_order"],
+    };
+    requestScopesMock.mockResolvedValue(response);
+
+    await act(async () => {
+      render(<HostedScopeTab />, { wrapper: Wrapper });
+    });
+
+    const writeProductLabel = await screen.findByText("Write product");
+    const writeProductCheckbox = writeProductLabel
+      .closest("label")!
+      .querySelector("input[type='checkbox']") as HTMLInputElement;
+    const readOrderLabel = screen.getByText("Read order");
+    const readOrderCheckbox = readOrderLabel
+      .closest("label")!
+      .querySelector("input[type='checkbox']") as HTMLInputElement;
+
+    await userEvent.click(writeProductCheckbox);
+    await userEvent.click(readOrderCheckbox);
+    await userEvent.click(screen.getByRole("button", { name: "Request scopes" }));
+
+    await waitFor(() => {
+      expect(requestScopesMock).toHaveBeenCalledWith("int-cafe24-1", [
+        "mall.write_product",
+        "mall.read_order",
+      ]);
+    });
+
+    const alert = await screen.findByRole("status");
+    expect(alert).toHaveTextContent(
+      /Grant the additional scopes in Cafe24 Developers/i,
+    );
+    expect(alert).toHaveTextContent(/Test run/i);
+    expect(alert).toHaveTextContent("mall.write_product");
+    expect(alert).toHaveTextContent("mall.read_order");
+  });
+
+  it("falls back to the existing OAuth popup flow when authUrl is returned", async () => {
+    const response: RequestScopesResult = {
+      authUrl: "https://oauth.example/authorize?...",
+      state: "state-token",
+    };
+    requestScopesMock.mockResolvedValue(response);
+
+    const openSpy = vi
+      .spyOn(window, "open")
+      .mockImplementation(() => ({ closed: false }) as Window);
+
+    await act(async () => {
+      render(<HostedScopeTab />, { wrapper: Wrapper });
+    });
+
+    const writeProductLabel = await screen.findByText("Write product");
+    const writeProductCheckbox = writeProductLabel
+      .closest("label")!
+      .querySelector("input[type='checkbox']") as HTMLInputElement;
+    await userEvent.click(writeProductCheckbox);
+    await userEvent.click(screen.getByRole("button", { name: "Request scopes" }));
+
+    await waitFor(() => {
+      expect(openSpy).toHaveBeenCalled();
+    });
+
+    expect(screen.queryByRole("status")).toBeNull();
+
+    openSpy.mockRestore();
+  });
+});

```

---

### 파일 2: frontend/src/app/(main)/integrations/[id]/open-oauth-popup.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 6db2d5df66df8b0e8f2ea34730b1c016390ea3c9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 01:00:10 2026 +0900

    fix(integrations): cafe24 Private request-scopes 응답에 대한 UI 안내 표시
    
    상세 페이지에서 추가 권한을 요청하면 백엔드는 `cafe24_private_pending` 모드와
    `scopesAdded` 를 반환하지만 onSuccess 가 `authUrl` 분기만 처리하고 있어 사용자는
    화면 변화 없이 "아무 일도 안 일어남" 으로 인식하던 버그를 수정한다.
    
    - ScopeTab 을 별도 모듈 `scope-tab.tsx` 로 추출 (Next.js page 파일에 named
      export 가 금지되어 단위 테스트가 직접 import 할 수 없는 제약 해소).
    - requestMutation.onSuccess 에 `mode === 'cafe24_private_pending'` 분기 추가.
      → inline amber alert 로 "Cafe24 Developers 에서 권한 추가 → 테스트 실행"
      안내문(spec §4.4 의 안내 문구)과 `scopesAdded` 목록을 표시 + `toast.info`
      로 즉시 알림.
    - `OAuthBeginResult` 와 분리된 `RequestScopesResult` 타입 신설 — Cafe24
      Private 분기에서 `scopesAdded: string[]` 를 type-safe 하게 노출.
    - i18n 키 추가 (ko/en): `cafe24PrivateScopeRequestTitle` /
      `cafe24PrivateScopeRequestDesc` / `cafe24PrivateScopeRequestScopesAdded`.
      consistency-checker W-3 권고에 따라 신규 통합의 `cafe24PrivatePending*`
      계열과 prefix 분리.
    - `openOAuthPopup` 도 공용 모듈로 추출.
    - 단위 테스트 2건 추가 (cafe24 분기 / authUrl 분기).
    
    사전 일관성 검토 BLOCK: NO — `review/consistency/2026/05/16/00_36_35/SUMMARY.md`.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/frontend/src/app/(main)/integrations/[id]/open-oauth-popup.ts b/frontend/src/app/(main)/integrations/[id]/open-oauth-popup.ts
new file mode 100644
index 00000000..e31bb434
--- /dev/null
+++ b/frontend/src/app/(main)/integrations/[id]/open-oauth-popup.ts
@@ -0,0 +1,11 @@
+export function openOAuthPopup(url: string) {
+  const width = 600;
+  const height = 700;
+  const left = window.screenX + (window.outerWidth - width) / 2;
+  const top = window.screenY + (window.outerHeight - height) / 2;
+  window.open(
+    url,
+    "integration-oauth",
+    `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
+  );
+}

```

---

### 파일 3: frontend/src/app/(main)/integrations/[id]/page.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
commit 6db2d5df66df8b0e8f2ea34730b1c016390ea3c9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 01:00:10 2026 +0900

    fix(integrations): cafe24 Private request-scopes 응답에 대한 UI 안내 표시
    
    상세 페이지에서 추가 권한을 요청하면 백엔드는 `cafe24_private_pending` 모드와
    `scopesAdded` 를 반환하지만 onSuccess 가 `authUrl` 분기만 처리하고 있어 사용자는
    화면 변화 없이 "아무 일도 안 일어남" 으로 인식하던 버그를 수정한다.
    
    - ScopeTab 을 별도 모듈 `scope-tab.tsx` 로 추출 (Next.js page 파일에 named
      export 가 금지되어 단위 테스트가 직접 import 할 수 없는 제약 해소).
    - requestMutation.onSuccess 에 `mode === 'cafe24_private_pending'` 분기 추가.
      → inline amber alert 로 "Cafe24 Developers 에서 권한 추가 → 테스트 실행"
      안내문(spec §4.4 의 안내 문구)과 `scopesAdded` 목록을 표시 + `toast.info`
      로 즉시 알림.
    - `OAuthBeginResult` 와 분리된 `RequestScopesResult` 타입 신설 — Cafe24
      Private 분기에서 `scopesAdded: string[]` 를 type-safe 하게 노출.
    - i18n 키 추가 (ko/en): `cafe24PrivateScopeRequestTitle` /
      `cafe24PrivateScopeRequestDesc` / `cafe24PrivateScopeRequestScopesAdded`.
      consistency-checker W-3 권고에 따라 신규 통합의 `cafe24PrivatePending*`
      계열과 prefix 분리.
    - `openOAuthPopup` 도 공용 모듈로 추출.
    - 단위 테스트 2건 추가 (cafe24 분기 / authUrl 분기).
    
    사전 일관성 검토 BLOCK: NO — `review/consistency/2026/05/16/00_36_35/SUMMARY.md`.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/frontend/src/app/(main)/integrations/[id]/page.tsx b/frontend/src/app/(main)/integrations/[id]/page.tsx
index 5275647c..6331e281 100644
--- a/frontend/src/app/(main)/integrations/[id]/page.tsx
+++ b/frontend/src/app/(main)/integrations/[id]/page.tsx
@@ -23,7 +23,6 @@ import {
   integrationsApi,
   type IntegrationDto,
   type IntegrationScope,
-  type ServiceDefinition,
   type AuthVariant,
   type UsageWorkflow,
 } from "@/lib/api/integrations";
@@ -32,6 +31,8 @@ import { StatusBadge } from "../_shared/status-badge";
 import { isReauthorizeDisabled } from "@/lib/integrations/reauthorize";
 import { CredentialsForm } from "../_shared/credentials-form";
 import { useT, type TFunction, type TranslationKey } from "@/lib/i18n";
+import { ScopeTab } from "./scope-tab";
+import { openOAuthPopup } from "./open-oauth-popup";
 
 const TABS = [
   "overview",
@@ -507,159 +508,6 @@ function hasInput(obj: Record<string, unknown>): boolean {
   );
 }
 
-function openOAuthPopup(url: string) {
-  const width = 600;
-  const height = 700;
-  const left = window.screenX + (window.outerWidth - width) / 2;
-  const top = window.screenY + (window.outerHeight - height) / 2;
-  window.open(
-    url,
-    "integration-oauth",
-    `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
-  );
-}
-
-// ---------------- Scope & Permissions ----------------
-
-function ScopeTab({
-  integration,
-  service,
-  onChanged,
-  t,
-}: {
-  integration: IntegrationDto;
-  service: ServiceDefinition | undefined;
-  onChanged: () => void;
-  t: TFunction;
-}) {
-  const currentScopes = Array.isArray(integration.credentials.scopes)
-    ? (integration.credentials.scopes as string[])
-    : [];
-
-  const allOptions = service?.scopes ?? [];
-  const missingScopes =
-    integration.statusReason === "insufficient_scope" &&
-    allOptions.length > 0
-      ? allOptions.filter((s) => !currentScopes.includes(s.value))
-      : [];
-
-  const [selected, setSelected] = useState<string[]>([]);
-
-  const requestMutation = useMutation({
-    mutationFn: () => integrationsApi.requestScopes(integration.id, selected),
-    onSuccess: (res) => {
-      if ("authUrl" in res && res.authUrl) {
-        openOAuthPopup(res.authUrl);
-        toast.success(t("integrations.scopeRequestOpened"));
-      }
-      onChanged();
-    },
-    onError: () => toast.error(t("integrations.requestScopesFailed")),
-  });
-
-  if (integration.authType !== "oauth2") {
-    return (
-      <div className="rounded-lg border border-[hsl(var(--border))] p-6 text-sm text-[hsl(var(--muted-foreground))]">
-        {t("integrations.scopeOnlyOauth")}
-      </div>
-    );
-  }
-
-  const toggle = (value: string) => {
-    setSelected((prev) =>
-      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
-    );
-  };
-
-  return (
-    <div className="space-y-6 rounded-lg border border-[hsl(var(--border))] p-6">
-      <section>
-        <h3 className="text-sm font-semibold">{t("integrations.currentScopes")}</h3>
-        <ul className="mt-2 flex flex-wrap gap-2">
-          {currentScopes.length === 0 && (
-            <li className="text-xs text-[hsl(var(--muted-foreground))]">
-              {t("integrations.noScopes")}
-            </li>
-          )}
-          {currentScopes.map((s) => (
-            <li
-              key={s}
-              className="rounded-full bg-[hsl(var(--muted))] px-2.5 py-1 text-xs"
-            >
-              {s}
-            </li>
-          ))}
-        </ul>
-      </section>
-
-      {missingScopes.length > 0 && (
-        <section className="rounded-md border border-red-300 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950">
-          <div className="font-medium text-red-700 dark:text-red-300">
-            {t("integrations.missingScopesDetected")}
-          </div>
-          <ul className="mt-1 flex flex-wrap gap-2">
-            {missingScopes.map((s) => (
-              <li
-                key={s.value}
-                className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800 dark:bg-red-900 dark:text-red-200"
-              >
-                {s.value}
-              </li>
-            ))}
-          </ul>
-        </section>
-      )}
-
-      <section className="space-y-2">
-        <h3 className="text-sm font-semibold">{t("integrations.requestScopesTitle")}</h3>
-        <p className="text-xs text-[hsl(var(--muted-foreground))]">
-          {t("integrations.requestScopesHint")}
-        </p>
-        <div className="space-y-2 rounded-md border border-[hsl(var(--border))] p-3">
-          {allOptions.map((s) => (
-            <label
-              key={s.value}
-              className="flex cursor-pointer items-start gap-2 text-sm"
-            >
-              <input
-                type="checkbox"
-                checked={selected.includes(s.value)}
-                onChange={() => toggle(s.value)}
-                className="mt-0.5"
-                disabled={currentScopes.includes(s.value)}
-              />
-              <div className="flex-1">
-                <div className="font-medium">
-                  {s.label}
-                  {currentScopes.includes(s.value) && (
-                    <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
-                      {t("integrations.alreadyGranted")}
-                    </span>
-                  )}
-                </div>
-                <div className="text-xs text-[hsl(var(--muted-foreground))]">
-                  {s.value}
-                </div>
-              </div>
-            </label>
-          ))}
-        </div>
-        <div className="flex justify-end">
-          <Button
-            onClick={() => requestMutation.mutate()}
-            disabled={selected.length === 0 || requestMutation.isPending}
-          >
-            {requestMutation.isPending ? (
-              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
-            ) : null}
-            {t("integrations.requestScopesBtn")}
-          </Button>
-        </div>
-      </section>
-    </div>
-  );
-}
-
 // ---------------- Usage ----------------
 
 function UsageTab({ integrationId, t }: { integrationId: string; t: TFunction }) {

```

---

### 파일 4: frontend/src/app/(main)/integrations/[id]/scope-tab.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
commit 6db2d5df66df8b0e8f2ea34730b1c016390ea3c9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 01:00:10 2026 +0900

    fix(integrations): cafe24 Private request-scopes 응답에 대한 UI 안내 표시
    
    상세 페이지에서 추가 권한을 요청하면 백엔드는 `cafe24_private_pending` 모드와
    `scopesAdded` 를 반환하지만 onSuccess 가 `authUrl` 분기만 처리하고 있어 사용자는
    화면 변화 없이 "아무 일도 안 일어남" 으로 인식하던 버그를 수정한다.
    
    - ScopeTab 을 별도 모듈 `scope-tab.tsx` 로 추출 (Next.js page 파일에 named
      export 가 금지되어 단위 테스트가 직접 import 할 수 없는 제약 해소).
    - requestMutation.onSuccess 에 `mode === 'cafe24_private_pending'` 분기 추가.
      → inline amber alert 로 "Cafe24 Developers 에서 권한 추가 → 테스트 실행"
      안내문(spec §4.4 의 안내 문구)과 `scopesAdded` 목록을 표시 + `toast.info`
      로 즉시 알림.
    - `OAuthBeginResult` 와 분리된 `RequestScopesResult` 타입 신설 — Cafe24
      Private 분기에서 `scopesAdded: string[]` 를 type-safe 하게 노출.
    - i18n 키 추가 (ko/en): `cafe24PrivateScopeRequestTitle` /
      `cafe24PrivateScopeRequestDesc` / `cafe24PrivateScopeRequestScopesAdded`.
      consistency-checker W-3 권고에 따라 신규 통합의 `cafe24PrivatePending*`
      계열과 prefix 분리.
    - `openOAuthPopup` 도 공용 모듈로 추출.
    - 단위 테스트 2건 추가 (cafe24 분기 / authUrl 분기).
    
    사전 일관성 검토 BLOCK: NO — `review/consistency/2026/05/16/00_36_35/SUMMARY.md`.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/frontend/src/app/(main)/integrations/[id]/scope-tab.tsx b/frontend/src/app/(main)/integrations/[id]/scope-tab.tsx
new file mode 100644
index 00000000..afa16002
--- /dev/null
+++ b/frontend/src/app/(main)/integrations/[id]/scope-tab.tsx
@@ -0,0 +1,193 @@
+"use client";
+
+import { useState } from "react";
+import { useMutation } from "@tanstack/react-query";
+import { toast } from "sonner";
+import { Loader2 } from "lucide-react";
+import { Button } from "@/components/ui/button";
+import {
+  integrationsApi,
+  type IntegrationDto,
+  type ServiceDefinition,
+} from "@/lib/api/integrations";
+import { type TFunction } from "@/lib/i18n";
+import { openOAuthPopup } from "./open-oauth-popup";
+
+export function ScopeTab({
+  integration,
+  service,
+  onChanged,
+  t,
+}: {
+  integration: IntegrationDto;
+  service: ServiceDefinition | undefined;
+  onChanged: () => void;
+  t: TFunction;
+}) {
+  const currentScopes = Array.isArray(integration.credentials.scopes)
+    ? (integration.credentials.scopes as string[])
+    : [];
+
+  const allOptions = service?.scopes ?? [];
+  const missingScopes =
+    integration.statusReason === "insufficient_scope" &&
+    allOptions.length > 0
+      ? allOptions.filter((s) => !currentScopes.includes(s.value))
+      : [];
+
+  const [selected, setSelected] = useState<string[]>([]);
+  const [cafe24Pending, setCafe24Pending] = useState<{
+    scopesAdded: string[];
+  } | null>(null);
+
+  const requestMutation = useMutation({
+    mutationFn: () => integrationsApi.requestScopes(integration.id, selected),
+    onMutate: () => {
+      setCafe24Pending(null);
+    },
+    onSuccess: (res) => {
+      if ("authUrl" in res && res.authUrl) {
+        openOAuthPopup(res.authUrl);
+        toast.success(t("integrations.scopeRequestOpened"));
+      } else if ("mode" in res && res.mode === "cafe24_private_pending") {
+        setCafe24Pending({ scopesAdded: res.scopesAdded });
+        toast.info(t("integrations.cafe24PrivateScopeRequestTitle"));
+      }
+      onChanged();
+    },
+    onError: () => toast.error(t("integrations.requestScopesFailed")),
+  });
+
+  if (integration.authType !== "oauth2") {
+    return (
+      <div className="rounded-lg border border-[hsl(var(--border))] p-6 text-sm text-[hsl(var(--muted-foreground))]">
+        {t("integrations.scopeOnlyOauth")}
+      </div>
+    );
+  }
+
+  const toggle = (value: string) => {
+    setSelected((prev) =>
+      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
+    );
+  };
+
+  return (
+    <div className="space-y-6 rounded-lg border border-[hsl(var(--border))] p-6">
+      <section>
+        <h3 className="text-sm font-semibold">{t("integrations.currentScopes")}</h3>
+        <ul className="mt-2 flex flex-wrap gap-2">
+          {currentScopes.length === 0 && (
+            <li className="text-xs text-[hsl(var(--muted-foreground))]">
+              {t("integrations.noScopes")}
+            </li>
+          )}
+          {currentScopes.map((s) => (
+            <li
+              key={s}
+              className="rounded-full bg-[hsl(var(--muted))] px-2.5 py-1 text-xs"
+            >
+              {s}
+            </li>
+          ))}
+        </ul>
+      </section>
+
+      {missingScopes.length > 0 && (
+        <section className="rounded-md border border-red-300 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950">
+          <div className="font-medium text-red-700 dark:text-red-300">
+            {t("integrations.missingScopesDetected")}
+          </div>
+          <ul className="mt-1 flex flex-wrap gap-2">
+            {missingScopes.map((s) => (
+              <li
+                key={s.value}
+                className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800 dark:bg-red-900 dark:text-red-200"
+              >
+                {s.value}
+              </li>
+            ))}
+          </ul>
+        </section>
+      )}
+
+      {cafe24Pending && (
+        <section
+          role="status"
+          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40"
+        >
+          <div className="font-medium text-amber-900 dark:text-amber-200">
+            {t("integrations.cafe24PrivateScopeRequestTitle")}
+          </div>
+          <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
+            {t("integrations.cafe24PrivateScopeRequestDesc")}
+          </p>
+          {cafe24Pending.scopesAdded.length > 0 && (
+            <div className="mt-2">
+              <span className="text-xs font-medium text-amber-900 dark:text-amber-200">
+                {t("integrations.cafe24PrivateScopeRequestScopesAdded")}:
+              </span>
+              <ul className="mt-1 flex flex-wrap gap-2">
+                {cafe24Pending.scopesAdded.map((s) => (
+                  <li
+                    key={s}
+                    className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/60 dark:text-amber-100"
+                  >
+                    {s}
+                  </li>
+                ))}
+              </ul>
+            </div>
+          )}
+        </section>
+      )}
+
+      <section className="space-y-2">
+        <h3 className="text-sm font-semibold">{t("integrations.requestScopesTitle")}</h3>
+        <p className="text-xs text-[hsl(var(--muted-foreground))]">
+          {t("integrations.requestScopesHint")}
+        </p>
+        <div className="space-y-2 rounded-md border border-[hsl(var(--border))] p-3">
+          {allOptions.map((s) => (
+            <label
+              key={s.value}
+              className="flex cursor-pointer items-start gap-2 text-sm"
+            >
+              <input
+                type="checkbox"
+                checked={selected.includes(s.value)}
+                onChange={() => toggle(s.value)}
+                className="mt-0.5"
+                disabled={currentScopes.includes(s.value)}
+              />
+              <div className="flex-1">
+                <div className="font-medium">
+                  {s.label}
+                  {currentScopes.includes(s.value) && (
+                    <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
+                      {t("integrations.alreadyGranted")}
+                    </span>
+                  )}
+                </div>
+                <div className="text-xs text-[hsl(var(--muted-foreground))]">
+                  {s.value}
+                </div>
+              </div>
+            </label>
+          ))}
+        </div>
+        <div className="flex justify-end">
+          <Button
+            onClick={() => requestMutation.mutate()}
+            disabled={selected.length === 0 || requestMutation.isPending}
+          >
+            {requestMutation.isPending ? (
+              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
+            ) : null}
+            {t("integrations.requestScopesBtn")}
+          </Button>
+        </div>
+      </section>
+    </div>
+  );
+}

```

---

### 파일 5: frontend/src/lib/api/integrations.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 6db2d5df66df8b0e8f2ea34730b1c016390ea3c9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 01:00:10 2026 +0900

    fix(integrations): cafe24 Private request-scopes 응답에 대한 UI 안내 표시
    
    상세 페이지에서 추가 권한을 요청하면 백엔드는 `cafe24_private_pending` 모드와
    `scopesAdded` 를 반환하지만 onSuccess 가 `authUrl` 분기만 처리하고 있어 사용자는
    화면 변화 없이 "아무 일도 안 일어남" 으로 인식하던 버그를 수정한다.
    
    - ScopeTab 을 별도 모듈 `scope-tab.tsx` 로 추출 (Next.js page 파일에 named
      export 가 금지되어 단위 테스트가 직접 import 할 수 없는 제약 해소).
    - requestMutation.onSuccess 에 `mode === 'cafe24_private_pending'` 분기 추가.
      → inline amber alert 로 "Cafe24 Developers 에서 권한 추가 → 테스트 실행"
      안내문(spec §4.4 의 안내 문구)과 `scopesAdded` 목록을 표시 + `toast.info`
      로 즉시 알림.
    - `OAuthBeginResult` 와 분리된 `RequestScopesResult` 타입 신설 — Cafe24
      Private 분기에서 `scopesAdded: string[]` 를 type-safe 하게 노출.
    - i18n 키 추가 (ko/en): `cafe24PrivateScopeRequestTitle` /
      `cafe24PrivateScopeRequestDesc` / `cafe24PrivateScopeRequestScopesAdded`.
      consistency-checker W-3 권고에 따라 신규 통합의 `cafe24PrivatePending*`
      계열과 prefix 분리.
    - `openOAuthPopup` 도 공용 모듈로 추출.
    - 단위 테스트 2건 추가 (cafe24 분기 / authUrl 분기).
    
    사전 일관성 검토 BLOCK: NO — `review/consistency/2026/05/16/00_36_35/SUMMARY.md`.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/frontend/src/lib/api/integrations.ts b/frontend/src/lib/api/integrations.ts
index b4e34ff0..6347f16d 100644
--- a/frontend/src/lib/api/integrations.ts
+++ b/frontend/src/lib/api/integrations.ts
@@ -15,6 +15,16 @@ export type OAuthBeginResult =
   | { authUrl: string; state: string }
   | { mode: "cafe24_private_pending"; integrationId: string; appUrl: string; callbackUrl: string };
 
+export type RequestScopesResult =
+  | { authUrl: string; state: string }
+  | {
+      mode: "cafe24_private_pending";
+      integrationId: string;
+      appUrl: string;
+      callbackUrl: string;
+      scopesAdded: string[];
+    };
+
 export interface IntegrationMeta {
   appType: "public" | "private" | null;
 }
@@ -233,12 +243,12 @@ export const integrationsApi = {
   async requestScopes(
     id: string,
     scopes: string[],
-  ): Promise<OAuthBeginResult> {
+  ): Promise<RequestScopesResult> {
     const { data } = await apiClient.post(
       `/integrations/${id}/request-scopes`,
       { scopes },
     );
-    return unwrap<OAuthBeginResult>(data);
+    return unwrap<RequestScopesResult>(data);
   },
 
   async updateScope(

```

---

### 파일 6: frontend/src/lib/i18n/dict/en.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 6db2d5df66df8b0e8f2ea34730b1c016390ea3c9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 01:00:10 2026 +0900

    fix(integrations): cafe24 Private request-scopes 응답에 대한 UI 안내 표시
    
    상세 페이지에서 추가 권한을 요청하면 백엔드는 `cafe24_private_pending` 모드와
    `scopesAdded` 를 반환하지만 onSuccess 가 `authUrl` 분기만 처리하고 있어 사용자는
    화면 변화 없이 "아무 일도 안 일어남" 으로 인식하던 버그를 수정한다.
    
    - ScopeTab 을 별도 모듈 `scope-tab.tsx` 로 추출 (Next.js page 파일에 named
      export 가 금지되어 단위 테스트가 직접 import 할 수 없는 제약 해소).
    - requestMutation.onSuccess 에 `mode === 'cafe24_private_pending'` 분기 추가.
      → inline amber alert 로 "Cafe24 Developers 에서 권한 추가 → 테스트 실행"
      안내문(spec §4.4 의 안내 문구)과 `scopesAdded` 목록을 표시 + `toast.info`
      로 즉시 알림.
    - `OAuthBeginResult` 와 분리된 `RequestScopesResult` 타입 신설 — Cafe24
      Private 분기에서 `scopesAdded: string[]` 를 type-safe 하게 노출.
    - i18n 키 추가 (ko/en): `cafe24PrivateScopeRequestTitle` /
      `cafe24PrivateScopeRequestDesc` / `cafe24PrivateScopeRequestScopesAdded`.
      consistency-checker W-3 권고에 따라 신규 통합의 `cafe24PrivatePending*`
      계열과 prefix 분리.
    - `openOAuthPopup` 도 공용 모듈로 추출.
    - 단위 테스트 2건 추가 (cafe24 분기 / authUrl 분기).
    
    사전 일관성 검토 BLOCK: NO — `review/consistency/2026/05/16/00_36_35/SUMMARY.md`.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/frontend/src/lib/i18n/dict/en.ts b/frontend/src/lib/i18n/dict/en.ts
index 5423646e..e48a0efc 100644
--- a/frontend/src/lib/i18n/dict/en.ts
+++ b/frontend/src/lib/i18n/dict/en.ts
@@ -1584,6 +1584,11 @@ export const en: Dict = {
     requestScopesBtn: "Request scopes",
     scopeRequestOpened: "Scope request window opened",
     requestScopesFailed: "Failed to request scopes",
+    cafe24PrivateScopeRequestTitle:
+      "Grant the additional scopes in Cafe24 Developers",
+    cafe24PrivateScopeRequestDesc:
+      "Enable the additional scopes in your Cafe24 Developers app permission settings, then click \"Test run\" again to refresh the token with the new scopes. (Private apps cannot initiate the OAuth flow externally, so the action must happen on Cafe24.)",
+    cafe24PrivateScopeRequestScopesAdded: "Scopes added",
     scopeOnlyOauth: "Scope management is only available for OAuth integrations.",
     usageEmpty: "No workflow nodes currently use this integration.",
     usageSummary: "Used by {{nodes}} nodes across {{workflows}} workflows.",

```

---

### 파일 7: frontend/src/lib/i18n/dict/ko.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 6db2d5df66df8b0e8f2ea34730b1c016390ea3c9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 01:00:10 2026 +0900

    fix(integrations): cafe24 Private request-scopes 응답에 대한 UI 안내 표시
    
    상세 페이지에서 추가 권한을 요청하면 백엔드는 `cafe24_private_pending` 모드와
    `scopesAdded` 를 반환하지만 onSuccess 가 `authUrl` 분기만 처리하고 있어 사용자는
    화면 변화 없이 "아무 일도 안 일어남" 으로 인식하던 버그를 수정한다.
    
    - ScopeTab 을 별도 모듈 `scope-tab.tsx` 로 추출 (Next.js page 파일에 named
      export 가 금지되어 단위 테스트가 직접 import 할 수 없는 제약 해소).
    - requestMutation.onSuccess 에 `mode === 'cafe24_private_pending'` 분기 추가.
      → inline amber alert 로 "Cafe24 Developers 에서 권한 추가 → 테스트 실행"
      안내문(spec §4.4 의 안내 문구)과 `scopesAdded` 목록을 표시 + `toast.info`
      로 즉시 알림.
    - `OAuthBeginResult` 와 분리된 `RequestScopesResult` 타입 신설 — Cafe24
      Private 분기에서 `scopesAdded: string[]` 를 type-safe 하게 노출.
    - i18n 키 추가 (ko/en): `cafe24PrivateScopeRequestTitle` /
      `cafe24PrivateScopeRequestDesc` / `cafe24PrivateScopeRequestScopesAdded`.
      consistency-checker W-3 권고에 따라 신규 통합의 `cafe24PrivatePending*`
      계열과 prefix 분리.
    - `openOAuthPopup` 도 공용 모듈로 추출.
    - 단위 테스트 2건 추가 (cafe24 분기 / authUrl 분기).
    
    사전 일관성 검토 BLOCK: NO — `review/consistency/2026/05/16/00_36_35/SUMMARY.md`.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/frontend/src/lib/i18n/dict/ko.ts b/frontend/src/lib/i18n/dict/ko.ts
index d4d9e5d6..5faa63f1 100644
--- a/frontend/src/lib/i18n/dict/ko.ts
+++ b/frontend/src/lib/i18n/dict/ko.ts
@@ -1582,6 +1582,11 @@ export const ko = {
     requestScopesBtn: "권한 요청",
     scopeRequestOpened: "권한 요청 창을 열었어요",
     requestScopesFailed: "권한 요청에 실패했어요",
+    cafe24PrivateScopeRequestTitle:
+      "Cafe24 Developers 에서 권한을 추가해 주세요",
+    cafe24PrivateScopeRequestDesc:
+      "Cafe24 Developers 의 앱 권한 설정에서 추가 scope 를 활성화한 뒤 '테스트 실행' 을 다시 누르면 새 token 으로 갱신됩니다. (Private 앱은 외부에서 OAuth 화면을 띄울 수 없어 Cafe24 측 작업이 필요해요.)",
+    cafe24PrivateScopeRequestScopesAdded: "추가된 권한",
     scopeOnlyOauth: "권한 관리는 OAuth 통합에서만 사용할 수 있어요.",
     usageEmpty: "현재 이 통합을 사용 중인 워크플로우 노드가 없어요.",
     usageSummary: "{{workflows}}개 워크플로우의 {{nodes}}개 노드에서 사용 중이에요.",

```

---

### 파일 8: plan/in-progress/cafe24-request-scopes-ui.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 6db2d5df66df8b0e8f2ea34730b1c016390ea3c9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 01:00:10 2026 +0900

    fix(integrations): cafe24 Private request-scopes 응답에 대한 UI 안내 표시
    
    상세 페이지에서 추가 권한을 요청하면 백엔드는 `cafe24_private_pending` 모드와
    `scopesAdded` 를 반환하지만 onSuccess 가 `authUrl` 분기만 처리하고 있어 사용자는
    화면 변화 없이 "아무 일도 안 일어남" 으로 인식하던 버그를 수정한다.
    
    - ScopeTab 을 별도 모듈 `scope-tab.tsx` 로 추출 (Next.js page 파일에 named
      export 가 금지되어 단위 테스트가 직접 import 할 수 없는 제약 해소).
    - requestMutation.onSuccess 에 `mode === 'cafe24_private_pending'` 분기 추가.
      → inline amber alert 로 "Cafe24 Developers 에서 권한 추가 → 테스트 실행"
      안내문(spec §4.4 의 안내 문구)과 `scopesAdded` 목록을 표시 + `toast.info`
      로 즉시 알림.
    - `OAuthBeginResult` 와 분리된 `RequestScopesResult` 타입 신설 — Cafe24
      Private 분기에서 `scopesAdded: string[]` 를 type-safe 하게 노출.
    - i18n 키 추가 (ko/en): `cafe24PrivateScopeRequestTitle` /
      `cafe24PrivateScopeRequestDesc` / `cafe24PrivateScopeRequestScopesAdded`.
      consistency-checker W-3 권고에 따라 신규 통합의 `cafe24PrivatePending*`
      계열과 prefix 분리.
    - `openOAuthPopup` 도 공용 모듈로 추출.
    - 단위 테스트 2건 추가 (cafe24 분기 / authUrl 분기).
    
    사전 일관성 검토 BLOCK: NO — `review/consistency/2026/05/16/00_36_35/SUMMARY.md`.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/plan/in-progress/cafe24-request-scopes-ui.md b/plan/in-progress/cafe24-request-scopes-ui.md
new file mode 100644
index 00000000..6bc5f040
--- /dev/null
+++ b/plan/in-progress/cafe24-request-scopes-ui.md
@@ -0,0 +1,82 @@
+---
+worktree: cafe24-request-scopes-ui-b6e34d
+started: 2026-05-16
+owner: developer
+---
+
+# Cafe24 Private — `request-scopes` 상세페이지 UI 안내 누락 수정
+
+## 배경
+
+운영 사용자 보고 (2026-05-16):
+
+- Cafe24 Private 통합이 `connected` 인 상태에서 상세 페이지의 `[Request scopes]` 버튼으로 추가 scope 를 요청
+- `POST /api/integrations/:id/request-scopes` 호출은 200 으로 정상 응답 (`mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded`)
+- 그러나 UI 상으로 **아무런 변화가 없음** — popup 도 안 뜨고 toast 도 없음
+- 사용자가 다음에 무엇을 해야 하는지 알 수 없음
+
+## 원인
+
+`frontend/src/app/(main)/integrations/[id]/page.tsx:548-558` 의 `requestMutation.onSuccess`:
+
+```ts
+onSuccess: (res) => {
+  if ("authUrl" in res && res.authUrl) {
+    openOAuthPopup(res.authUrl);
+    toast.success(t("integrations.scopeRequestOpened"));
+  }
+  onChanged();
+},
+```
+
+`mode === 'cafe24_private_pending'` 분기 처리가 빠져 있어 응답이 와도 아무 표시 안 됨.
+
+(비교) `frontend/src/app/(main)/integrations/new/page.tsx:165` 의 신규 통합 흐름은 동일한 응답 shape 에 대해 `Cafe24PrivatePending` 패널로 전환하는 처리가 있음.
+
+## spec 근거
+
+`spec/2-navigation/4-integration.md:270` (§4.4 `[Request scopes]` 행):
+
+> ② **Cafe24 Private** — popup 진입점 없음. 응답: `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded: [...] }` + 사용자 안내 "Cafe24 Developers 의 앱 권한 설정에서 추가 scope 를 활성화한 뒤 '테스트 실행' 을 다시 누르면 새 token 으로 갱신됩니다."
+
+→ 안내 문구는 spec 에 이미 정의되어 있고, UI 가 그것을 표시하지 못하는 버그.
+
+## 결정
+
+- **컴포넌트 재사용 안 함**: `Cafe24PrivatePending` 은 신규 통합의 `pending_install` 상태를 polling 으로 추적하는 컴포넌트 (전체 step 전환). request-scopes 의 경우는 통합이 이미 `connected` 이고 단지 안내만 필요. 별도 inline alert 가 더 적합.
+- **inline alert** 로 상세 페이지의 scope panel 안에 안내문을 표시한다 (modal 보다 영구 표시, 사용자가 cafe24 작업 중 계속 참조 가능).
+- 동시에 `toast.info` 로 즉시 알림.
+
+## 변경 범위
+
+- `frontend/src/app/(main)/integrations/[id]/page.tsx` — `requestMutation.onSuccess` 에 cafe24_private_pending 분기 추가 + inline alert 렌더링
+- `frontend/src/lib/i18n/dict/ko.ts`, `frontend/src/lib/i18n/dict/en.ts` — 안내 문구 i18n 키 추가
+  - `cafe24PrivateScopeRequestTitle`
+  - `cafe24PrivateScopeRequestDesc` (spec §4.4 의 안내 문구)
+  - `cafe24PrivateScopeRequestScopesAdded`
+  - (consistency W-3 권고: 신규 통합 흐름의 `cafe24PrivatePending*` 계열과 맥락 분리를 위해 `cafe24PrivateScopeRequest*` prefix 채택)
+- frontend unit test 보강 — `[id]/page.tsx` 의 ScopesTab 컴포넌트에 대한 RTL 테스트가 있다면 새 분기 추가
+
+## 체크리스트
+
+- [x] spec / plan 분석
+- [x] worktree 생성
+- [x] consistency-check --impl-prep (BLOCK: NO, W-3 반영하여 i18n prefix 조정 — `cafe24PrivateScopeRequest*`)
+- [ ] i18n 키 추가 (ko/en)
+- [ ] requestMutation.onSuccess 분기 + inline alert 렌더링
+- [ ] 단위 테스트 추가 (Cafe24 Private 응답 시 안내 표시)
+- [ ] lint / unit test / build
+- [ ] `[skip-e2e]` 표기 — e2e 범위 아님 (단일 컴포넌트 분기 추가)
+- [ ] ai-review + RESOLUTION
+- [ ] plan complete 이동
+
+## 영향 범위
+
+- backend 변경 없음 (응답 shape 이미 spec 대로 동작)
+- frontend 만 — 한 페이지의 한 mutation onSuccess 분기 추가
+- 신규 통합 흐름의 `Cafe24PrivatePending` 컴포넌트는 건드리지 않음
+
+## 관찰된 사전(pre-existing) 이슈
+
+- `frontend/src/app/(main)/workflows/[id]/executions/__tests__/execution-list-page.test.tsx` 가 본 worktree 의 전체 suite 실행 시 ~20% 확률로 flake (`findByText("Completed")` 또는 row-click navigation 단계의 async 타이밍). 격리 실행은 항상 성공, main worktree(suite 118 files) 도 안정적으로 통과. 본 worktree 가 새 test file 을 추가하면서 vitest 워커 스케줄링이 바뀌어 잠재 timing-flake 가 드러난 것으로 추정. 본 작업 범위 밖 — 별도 flake-fix plan 으로 분리 권고.
+- spec/2-navigation/4-integration.md 의 옛 flat-path Rationale 참조(W-2) 및 폐기 결정 cross-reference 누락(W-1) 은 spec write 권한 밖 — project-planner 에 위임.

```

---

### 파일 9: review/consistency/2026/05/16/00_36_35/SUMMARY.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 6db2d5df66df8b0e8f2ea34730b1c016390ea3c9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 01:00:10 2026 +0900

    fix(integrations): cafe24 Private request-scopes 응답에 대한 UI 안내 표시
    
    상세 페이지에서 추가 권한을 요청하면 백엔드는 `cafe24_private_pending` 모드와
    `scopesAdded` 를 반환하지만 onSuccess 가 `authUrl` 분기만 처리하고 있어 사용자는
    화면 변화 없이 "아무 일도 안 일어남" 으로 인식하던 버그를 수정한다.
    
    - ScopeTab 을 별도 모듈 `scope-tab.tsx` 로 추출 (Next.js page 파일에 named
      export 가 금지되어 단위 테스트가 직접 import 할 수 없는 제약 해소).
    - requestMutation.onSuccess 에 `mode === 'cafe24_private_pending'` 분기 추가.
      → inline amber alert 로 "Cafe24 Developers 에서 권한 추가 → 테스트 실행"
      안내문(spec §4.4 의 안내 문구)과 `scopesAdded` 목록을 표시 + `toast.info`
      로 즉시 알림.
    - `OAuthBeginResult` 와 분리된 `RequestScopesResult` 타입 신설 — Cafe24
      Private 분기에서 `scopesAdded: string[]` 를 type-safe 하게 노출.
    - i18n 키 추가 (ko/en): `cafe24PrivateScopeRequestTitle` /
      `cafe24PrivateScopeRequestDesc` / `cafe24PrivateScopeRequestScopesAdded`.
      consistency-checker W-3 권고에 따라 신규 통합의 `cafe24PrivatePending*`
      계열과 prefix 분리.
    - `openOAuthPopup` 도 공용 모듈로 추출.
    - 단위 테스트 2건 추가 (cafe24 분기 / authUrl 분기).
    
    사전 일관성 검토 BLOCK: NO — `review/consistency/2026/05/16/00_36_35/SUMMARY.md`.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/00_36_35/SUMMARY.md b/review/consistency/2026/05/16/00_36_35/SUMMARY.md
new file mode 100644
index 00000000..b8aaa224
--- /dev/null
+++ b/review/consistency/2026/05/16/00_36_35/SUMMARY.md
@@ -0,0 +1,57 @@
+# Consistency Check 통합 보고서
+
+**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.
+
+검토 모드: `--impl-prep` (구현 착수 전 검토)
+대상: `spec/2-navigation/4-integration.md`
+구현 범위: Cafe24 Private `request-scopes` UI 안내 누락 수정 (frontend-only)
+
+---
+
+## 전체 위험도
+**LOW** — Critical 없음. WARNING 3건(모두 문서 보완 사항, 구현 차단 불필요). INFO 8건.
+
+---
+
+## Critical 위배 (BLOCK 사유)
+
+없음
+
+---
+
+## 경고 (WARNING)
+
+| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
+|---|---------|------|-------------|-----------|------|
+| W-1 | Rationale Continuity | 폐기된 "mall_id 스캔 + trial HMAC" 패턴을 재도입하는 회복 분기가 기존 폐기 Rationale 과의 명시적 cross-reference 없이 추가됨 | `spec/2-navigation/4-integration.md` § Rationale "Cafe24 install_token mismatch 회복 흐름" | 동 문서 § Rationale "install_token 을 App URL path 식별 키로 승격 (2026-05-14)" | 신규 Rationale 에 "(폐기된 '100건 스캔 + trial HMAC' 와의 차이 — 'install_token 을 App URL path 식별 키로 승격' Rationale 참조)" 문장 추가. N ≤ 2 상한의 구조적 강제(V046 부분 UNIQUE)를 명시해 의도적 허용임을 단언 |
+| W-2 | Convention Compliance | Rationale 내 리뷰 경로 참조가 구 flat 형식(`review/consistency/2026-05-14_18-23-55`) 사용 — 현행 nested ISO 경로 규약 불일치 | `spec/2-navigation/4-integration.md` § Rationale "Cafe24 Private 앱의 callback 실패는 왜 status 를 보존하나" 말미 | `CLAUDE.md` 명명 컨벤션 — `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` | 경로를 `review/consistency/2026/05/14/18_23_55/` 로 교정하거나 일자만 기재(`2026-05-14 consistency 검토 결과`)로 대체. 해당 세션 파일 이동 완료 후 갱신 권장 |
+| W-3 | Naming Collision | i18n 키 계열 `requestScopesCafe24PrivatePending*` 가 기존 `cafe24PrivatePending*` 계열과 prefix 패턴이 혼용돼 유지보수 혼동 위험 | `frontend/src/lib/i18n/dict/ko.ts`, `en.ts` (신규 추가 예정 키 3개) | 기존 `cafe24PrivatePendingTitle`, `cafe24PrivatePendingDesc` (신규 통합 등록 흐름, `ko.ts:1623-1624`) | `cafe24PrivateScopeRequestTitle` / `cafe24PrivateScopeRequestDesc` / `cafe24PrivateScopeRequestAdded` 로 rename 검토. 또는 현행 패턴 유지 시 기존 `cafe24PrivatePending*` 계열에 그룹 주석 추가해 의도적 분리 명시 |
+
+→ **본 구현에서 반영**: W-3 권고에 따라 `cafe24PrivateScopeRequest*` prefix 채택. W-1·W-2 는 spec write 권한 밖 (project-planner 위임).
+
+---
+
+## 참고 (INFO)
+
+| # | Checker | 항목 | 위치 | 제안 |
+|---|---------|------|------|------|
+| I-1 | Cross-Spec | i18n 키 `requestScopesCafe24PrivatePendingDesc` 의 영문 안내 문구 기준이 spec §4.4 에 미정의 — 번역자 임의 번역 위험 | `spec/2-navigation/4-integration.md §4.4` | 구현 완료 후 ko/en 번역본을 spec §4.4 에 역반영 |
+| I-2 | Cross-Spec | `scopesAdded` 필드의 UI 표현 방식(목록 나열 여부, 축약 표현 여부)이 spec §4.4 에 미정의 | `spec/2-navigation/4-integration.md §4.4` | 구현 후 실제 UI 형태를 spec §4.4 에 한 줄 추가해 역반영 권장 |
+| I-3 | Cross-Spec | Cafe24 Public vs Private 분기 처리가 spec §9.2 와 §4.4 에서 일관됨 — 이상 없음 | `spec/2-navigation/4-integration.md §9.2`, `§4.4` | 없음 |
+| I-4 | Cross-Spec | inline alert 결정이 spec §4.4 에 미흡수 — spec 은 표시 방식을 열어둔 채 구현이 결정됨 | `plan/in-progress/cafe24-request-scopes-ui.md §결정` | 구현 완료 후 spec §4.4 에 "inline alert(고정 안내문) + toast.info 병행" 방식 한 줄 추가 |
+| I-5 | Rationale Continuity | 회복 분기의 read-only 특성상 TOCTOU 위험 없음을 Rationale 이 명시하지 않음 | `spec/2-navigation/4-integration.md` § Rationale "회복 흐름" | "이 분기는 INSERT 없이 read-only 조회이므로 TOCTOU 위험 없음" 한 문장 추가 권장 |
+| I-6 | Rationale Continuity | "Cafe24 Public app 가용성 — env 기반 노출" Rationale 은 기존 결정과 충돌 없는 순수 신규 결정 | `spec/2-navigation/4-integration.md` § Rationale | 없음 |
+| I-7 | Convention Compliance | §10.4 표에서 API error code(UPPER_SNAKE_CASE) 와 DB status_reason(snake_case) 의 맥락 구분이 컬럼 헤더만으로 불명확 | `spec/2-navigation/4-integration.md §10.4` | 컬럼명 "DB status / status_reason" 으로 구체화하거나 표 하단 주석 추가 |
+| I-8 | Plan Coherence | `spec-update-cafe24-app-url-reuse` plan(worktree: `cafe24-app-url-reuse-f9a2e3`)이 동일 spec §4.4 를 갱신 예정 — 파일 경합 없으나 i18n 재검토 필요 | `plan/in-progress/spec-update-cafe24-app-url-reuse.md` | spec 갱신 완료 후 `requestScopesCafe24PrivatePendingDesc` 안내 문구 일치 여부 재확인 |
+
+---
+
+## Checker별 위험도
+
+| Checker | 위험도 | 핵심 발견 |
+|---------|--------|-----------|
+| Cross-Spec | NONE | spec 과 직접 모순 없음. 4건 모두 INFO(구현 후 역반영 권장) |
+| Rationale Continuity | LOW | WARNING 1건 — 폐기 결정 cross-reference 누락. INFO 2건 |
+| Convention Compliance | LOW | WARNING 1건 — Rationale 내 구 flat 경로 참조. INFO 4건 모두 규약 준수 확인 |
+| Plan Coherence | NONE | 병렬 worktree 경합 없음. INFO 1건(i18n 재검토 권장) |
+| Naming Collision | LOW | WARNING 1건 — i18n 키 prefix 패턴 혼용. 식별자 직접 충돌 없음 |

```

---

### 파일 10: review/consistency/2026/05/16/00_36_35/_prompts/convention_compliance.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 6db2d5df66df8b0e8f2ea34730b1c016390ea3c9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 01:00:10 2026 +0900

    fix(integrations): cafe24 Private request-scopes 응답에 대한 UI 안내 표시
    
    상세 페이지에서 추가 권한을 요청하면 백엔드는 `cafe24_private_pending` 모드와
    `scopesAdded` 를 반환하지만 onSuccess 가 `authUrl` 분기만 처리하고 있어 사용자는
    화면 변화 없이 "아무 일도 안 일어남" 으로 인식하던 버그를 수정한다.
    
    - ScopeTab 을 별도 모듈 `scope-tab.tsx` 로 추출 (Next.js page 파일에 named
      export 가 금지되어 단위 테스트가 직접 import 할 수 없는 제약 해소).
    - requestMutation.onSuccess 에 `mode === 'cafe24_private_pending'` 분기 추가.
      → inline amber alert 로 "Cafe24 Developers 에서 권한 추가 → 테스트 실행"
      안내문(spec §4.4 의 안내 문구)과 `scopesAdded` 목록을 표시 + `toast.info`
      로 즉시 알림.
    - `OAuthBeginResult` 와 분리된 `RequestScopesResult` 타입 신설 — Cafe24
      Private 분기에서 `scopesAdded: string[]` 를 type-safe 하게 노출.
    - i18n 키 추가 (ko/en): `cafe24PrivateScopeRequestTitle` /
      `cafe24PrivateScopeRequestDesc` / `cafe24PrivateScopeRequestScopesAdded`.
      consistency-checker W-3 권고에 따라 신규 통합의 `cafe24PrivatePending*`
      계열과 prefix 분리.
    - `openOAuthPopup` 도 공용 모듈로 추출.
    - 단위 테스트 2건 추가 (cafe24 분기 / authUrl 분기).
    
    사전 일관성 검토 BLOCK: NO — `review/consistency/2026/05/16/00_36_35/SUMMARY.md`.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/00_36_35/_prompts/convention_compliance.md b/review/consistency/2026/05/16/00_36_35/_prompts/convention_compliance.md
new file mode 100644
index 00000000..681c5fe9
--- /dev/null
+++ b/review/consistency/2026/05/16/00_36_35/_prompts/convention_compliance.md
@@ -0,0 +1,689 @@
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
+#### `spec/conventions/cafe24-api-metadata.md`
+```
+# CONVENTION: Cafe24 API Metadata
+
+> 관련 문서: [Spec Cafe24 노드](../4-nodes/4-integration/4-cafe24.md) · [Spec 통합 §5.8 Cafe24](../2-navigation/4-integration.md#58-cafe24) · [Spec MCP Client §2.3 Internal Bridge](../5-system/11-mcp-client.md#23-internal-bridge)
+
+본 컨벤션은 Cafe24 Admin API 의 endpoint 매핑 메타데이터 형식을 정의한다. backend 의 `Cafe24` 노드 핸들러와 `Cafe24McpBridge` 양쪽이 **같은 메타데이터 테이블** 을 소비한다 — 신규 endpoint 추가는 메타데이터 row 1 추가로 끝나야 한다.
+
+---
+
+## 1. 디렉토리 구조
+
+```
+backend/src/nodes/integration/cafe24/metadata/
+  index.ts             # 18 resource 의 종합 export
+  store.ts             # Store (상점)
+  product.ts           # Product (상품)
+  order.ts             # Order (주문)
+  customer.ts          # Customer (회원)
+  community.ts         # Community (게시판)
+  design.ts
+  promotion.ts
+  application.ts       # ⚠ Cafe24 앱 관리 API — OAuth 앱 등록(credentials.app_type)과 무관. naming collision 주의
+  category.ts
+  collection.ts
+  supply.ts
+  shipping.ts
+  salesreport.ts
+  personal.ts
+  privacy.ts
+  mileage.ts
+  notification.ts
+  translation.ts
+```
+
+각 파일은 한 Resource 의 모든 Operation 메타데이터를 export 한다.
+
+## 2. Operation 메타데이터 형식
+
+```ts
+interface Cafe24OperationMetadata {
+  // 식별
+  id: string;                    // 예: 'product_list'. resource 안에서 unique
+  label: string;                 // UI 드롭다운 라벨 (한국어) 예: '상품 목록 조회'
+  description: string;           // MCP tool description (영문 권장) 또는 다국어 키
+  scopeType: 'read' | 'write';   // scope 매핑 — mall.read_<resource> / mall.write_<resource>. Node.category 와의 명명 충돌 회피 위해 'category' 가 아닌 'scopeType' 사용
+
+  // HTTP 매핑
+  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
+  path: string;                  // path template. 예: 'products/{product_no}'
+
+  // 입력 스키마
+  requiredFields: string[];
+  fields: {
+    [fieldName: string]: {
+      type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
+      location: 'path' | 'query' | 'body';
+      enum?: string[];
+      description?: string;
+      default?: unknown;
+    };
+  };
+
+  responseShape?: 'list' | 'single' | 'empty';
+  paginated?: boolean;
+}
+```
+
+## 3. 예시 — `product` Resource 일부
+
+```ts
+export const productOperations: Cafe24OperationMetadata[] = [
+  {
+    id: 'product_list',
+    label: '상품 목록 조회',
+    description: 'List products in the mall. Supports filtering by category, display status, date range.',
+    scopeType: 'read',
+    method: 'GET',
+    path: 'products',
+    requiredFields: ['shop_no'],
+    fields: {
+      shop_no:     { type: 'number',  location: 'query',  description: 'Multi-shop number (default 1)' },
+      category_no: { type: 'number',  location: 'query',  description: 'Filter by category' },
+      display:     { type: 'enum',    location: 'query',  enum: ['T', 'F'] },
+      since:       { type: 'string',  location: 'query',  description: 'ISO8601 date — created_after' },
+    },
+    responseShape: 'list',
+    paginated: true,
+  },
+  {
+    id: 'product_get',
+    label: '상품 단건 조회',
+    description: 'Get a single product by product_no.',
+    scopeType: 'read',
+    method: 'GET',
+    path: 'products/{product_no}',
+    requiredFields: ['product_no'],
+    fields: {
+      product_no:  { type: 'number',  location: 'path' },
+      shop_no:     { type: 'number',  location: 'query' },
+    },
+    responseShape: 'single',
+  },
+  {
+    id: 'product_update',
+    label: '상품 수정',
+    description: 'Update a product (name, price, display, stock, etc).',
+    scopeType: 'write',
+    method: 'PUT',
+    path: 'products/{product_no}',
+    requiredFields: ['product_no'],
+    fields: {
+      product_no:    { type: 'number',  location: 'path' },
+      product_name:  { type: 'string',  location: 'body' },
+      price:         { type: 'string',  location: 'body', description: 'Decimal string (KRW)' },
+      display:       { type: 'enum',    location: 'body', enum: ['T', 'F'] },
+    },
+    responseShape: 'single',
+  },
+];
+```
+
+## 4. 신규 endpoint 추가 절차
+
+1. [Cafe24 공식 문서](https://developers.cafe24.com/docs/ko/api/admin/) 에서 endpoint 의 method / path / 필드 확인.
+2. 해당 resource 의 metadata 파일에 §2 형식으로 row 1 추가.
+3. `id` 는 `<resource>_<verb>` 형식 (예: `product_list`, `order_update_status`). 중복 금지 (resource 내).
+4. `scopeType` 은 read/write 결정 — scope 매핑에 사용.
+5. 백엔드 단위 테스트가 자동으로 검증:
+   - 모든 `id` 의 unique
+   - 모든 `path` 의 `{placeholder}` 가 `fields` 에 정의됐는지
+   - `requiredFields` 가 `fields` 의 키 부분집합인지
+6. **spec 본문 수정 불요** — `4-cafe24.md` 는 형식만 정의.
+
+## 5. MCP Bridge 와의 매핑
+
+> **레이어 경계**: 본 절의 `Cafe24McpBridge.callTool(name, args)` 와 `listTools()` 가 반환하는 도구 `name` 은 **bare operation id** (예: `product_list`) 다. MCP Client 레이어가 외부 노출 시점에 `mcp_<sid>__` prefix 를 자동 부여한다 ([Spec MCP Client §5.2](../5-system/11-mcp-client.md#52-도구-이름-규칙)). AI Agent config 의 `mcpServers[].enabledTools` 도 bare id 배열로 저장된다.
+
+`Cafe24McpBridge.listTools()` 는 메타데이터 테이블을 순회하여 다음을 생성한다:
+
+```ts
+function operationToMcpTool(op: Cafe24OperationMetadata): McpTool {
+  return {
+    name: op.id,                                 // bare id — 예: 'product_list'
+    description: `${op.description}\n\n(Cafe24 ${op.method} ${op.path})`,
+    inputSchema: {
+      type: 'object',
+      properties: Object.fromEntries(
+        Object.entries(op.fields).map(([k, f]) => [k, fieldToJsonSchema(f)])
+      ),
+      required: op.requiredFields,
+    },
+  };
+}
+```
+
+`Cafe24McpBridge.callTool(name, args)` 는 args 를 노드 핸들러의 `fields` 와 동일하게 처리하여 `Cafe24ApiClient` 로 위임 — **노드와 MCP 가 같은 호출 경로를 공유**.
+
+## 6. allowlist 와의 관계
+
+> 용어: **UI grouping 단위 = "카테고리"** (사용자 친화 표기) — 백엔드 메타데이터 파일 구조의 "Resource" 와 동일 범위를 가리키며, 문맥에 따라 혼용한다. spec 본문에서는 UI 맥락이면 "카테고리", 백엔드/Operation 메타데이터 맥락이면 "Resource" 사용. `Node.category` Enum 과는 별개 개념 (이름 충돌은 §2 의 `scopeType` 채택으로 이미 회피).
+
+AI Agent `mcpServers[].enabledTools` 가 비어있으면 모든 operation 이 노출. 사용자가 `['product_list', 'product_get']` 로 좁히면 그 둘만 LLM tool 로 노출 (bare id 비교). UI 는 카테고리 단위 grouping (예: "Product (read 전부)" 체크 → 백엔드는 `['product_list', 'product_get']` 로 저장).
+
+## 7. CHANGELOG
+
+| 일자 | 변경 |
+|------|------|
+| 2026-05-13 | 신규 컨벤션 — Cafe24 API metadata 의 형식·디렉토리·추가 절차 정의. `scopeType` 필드명 채택 (`Node.category` 와의 명명 충돌 회피) |
+
+```
+
+#### `spec/conventions/migrations.md`
+```
+# Flyway 마이그레이션 운영 규약
+
+## Overview
+
+본 규약은 PostgreSQL 스키마 마이그레이션을 다음 세 가지 안전성 기준으로 운영하기 위한 정식 규칙이다.
+
+1. **충돌 방지** — 여러 PR 이 병렬로 진행될 때 같은 V번호를 동시에 점유하는 사고를 사전에 차단한다.
+2. **순서 보장** — 마이그레이션 적용 순서를 작성 의도와 일치시켜, 의존성 (예: `V<N+1>` 이 `V<N>` 컬럼을 참조) 사고를 막는다.
+3. **운영 안전성** — 이미 운영에 적용된 마이그레이션을 수정해 Flyway checksum 불일치로 부팅이 실패하는 일을 막는다.
+
+본문 절차·도구는 모두 위 세 기준을 보장하기 위한 수단이다. 실제 작성 가이드(트랜잭션 모드, NOT VALID 패턴, extension 의존성 등)는 [`backend/migrations/README.md`](../../backend/migrations/README.md) 가 담당하며, 본 문서는 **버전 번호 정책과 머지 race 안전망**에 집중한다.
+
+---
+
+## 1. 명명 규약
+
+```text
+backend/migrations/V<번호>__<snake_case_descriptor>.sql
+backend/migrations/V<번호>__<snake_case_descriptor>.conf  # 필요한 경우만 (executeInTransaction=false 등)
+```
+
+- 번호는 **단조 증가하는 정수**. `V001__initial_schema.sql` 부터 시작해 1씩 증가한다.
+- 설명자는 `snake_case`. 영문 소문자 + 숫자 + `_` 만 사용한다.
+- `.conf` 페어는 항상 `.sql` 과 동일한 base name (`V<NNN>__<descriptor>`) 을 사용한다. 예: `V033__embedding_hnsw_1024.sql` ↔ `V033__embedding_hnsw_1024.conf`.
+- ⚠️ **alphanumeric suffix 금지** — `V035a`, `V035_1` 처럼 정수가 아닌 접미사를 붙이면 Flyway 의 기본 version 파서가 매치에 실패해 schema_history 에 미등록된 채 silent skip 된다. 이 조건은 `backend/src/migrations.spec.ts` 가 빌드/CI 마다 자동 검증한다.
+
+## 2. V번호 정책
+
+- **단조 증가**: 신규 V번호는 항상 현재 main 의 max(V) **+1** 이다.
+- **gap 금지**: 작업 도중 V번호를 건너뛰지 않는다. 두 개를 추가하면 `+1`, `+2` 가 되어야 한다.
+- **재사용 금지**: 한번 main 에 들어간 V번호는 다른 마이그레이션으로 재할당하지 않는다.
+
+작성 시 절차는 [§5 새 마이그레이션 추가 절차](#5-새-마이그레이션-추가-절차) 를 따른다.
+
+## 3. Append-only 원칙
+
+이미 main 에 들어간 V<N> 의 `.sql` / `.conf` 는 **절대 수정하지 않는다**.
+
+- Flyway 는 부팅 시 각 적용된 마이그레이션의 SQL 내용 checksum 을 `flyway_schema_history` 와 비교한다. 파일이 한 글자라도 바뀌면 `Migration checksum mismatch for migration version NNN` 으로 부팅이 실패한다.
+- 컬럼/인덱스/제약 추가·변경·삭제가 필요하면 **새 V<N+k>** 로 `ALTER`·`DROP`·`CREATE` 를 작성한다.
+- 운영 사고로 어쩔 수 없이 checksum 을 재정렬해야 한다면 `migrate-repair` 서비스를 사용한다 (절차는 [`backend/migrations/README.md`](../../backend/migrations/README.md) §4 참고).
+
+## 4. `outOfOrder=false` 유지
+
+Flyway 의 `outOfOrder=true` 옵션은 옛 V번호가 늦게 들어와도 실행을 허용한다. 본 repo 는 이 옵션을 **명시적으로 사용하지 않는다** (Flyway 기본값 `false` 유지).
+
+이유:
+- `outOfOrder=true` 환경에서 두 PR 이 동시에 V<N+1> 을 만들고 한쪽이 V<N+2> 로 양보한 뒤 늦게 머지되면, **의도된 의존성 순서와 실제 적용 순서가 어긋난다**.
+- 본 규약은 PR CI 단계에서 V번호 충돌을 잡아내므로 (`§5`), `outOfOrder` 를 켤 필요가 없다.
+
+## 5. 새 마이그레이션 추가 절차
+
+1. `git fetch origin main && git rebase origin/main` — base 를 최신화한다.
+2. `ls backend/migrations | tail -2` 로 현재 max V 를 확인한다.
+3. `V<max+1>__<descriptor>.sql` 을 작성한다. 필요하면 동일 base name 의 `.conf` 를 함께 둔다 ([`backend/migrations/README.md`](../../backend/migrations/README.md) §4·§5 참고).
+4. 로컬에서 `python3 scripts/check-migration-versions.py --base origin/main` 으로 V번호 가드를 통과시킨다.
+5. `make e2e-test` 로 dry-run — e2e 컨테이너의 Flyway 가 실제 마이그레이션을 적용해 본다.
+6. PR 을 연다. CI 의 `migration-check` 가 동일한 검사를 다시 돌린다.
+
+> PR open 후에는 가능한 빠르게 리뷰·머지하여 다른 PR 과의 V번호 점유 윈도우를 짧게 유지한다.
+
+## 6. 충돌 검출 / 머지 race
+
+본 repo 는 두 단계 안전망으로 V번호 충돌과 merge race 를 모두 차단한다.
+
+### 6.1 PR CI 가드 (`scripts/check-migration-versions.py`)
+
+`pull_request` 이벤트마다 [`/.github/workflows/migration-check.yml`](../../.github/workflows/migration-check.yml) 이 실행되어 다음을 검사한다.
+
+| 검사 | 위반 예시 | 메시지 |
+| --- | --- | --- |
+| 중복 | 같은 V<N>__*.sql 두 개 | `FAIL: V041 is duplicated` |
+| 단조성 | 신규 V<N> 가 main_max 이하 | `FAIL: V040 is not greater than base (origin/main) max V040` |
+| 연속성 | gap 발생 (예: V041 없이 V042) | `FAIL: V042 leaves a gap (expected V041 after base max V040)` |
+| `.conf` 페어 | `.conf` 의 base name 이 `.sql` 과 다름 | `FAIL: V041 .conf base name does not match its .sql` |
+
+위반 시 workflow exit 1 로 PR 머지가 막힌다. 작성자가 rebase 해 V번호를 재할당하면 즉시 재검증된다.
+
+로컬에서 동일 검사를 돌리려면:
+
+```bash
+python3 scripts/check-migration-versions.py --base origin/main
+```
+
+### 6.2 머지 직전 rebase 규약 (운영 규약)
+
+PR CI 가 통과한 직후 다른 PR 이 먼저 머지되어 main 의 max(V) 가 추월되는 **merge race** 가 발생할 수 있다. 본 repo 는 GitHub 무료 플랜의 private 저장소여서 branch protection 의 "Require branches to be up to date before merging" 옵션을 사용할 수 없으므로 (자세한 사유는 [§7 대안 4](#대안-4-github-branch-protection--require-branches-to-be-up-to-date)), race 차단을 다음 운영 규약으로 대체한다.
+
+**머지 직전 확인 (작성자 책임)**
+
+1. `git fetch origin main && git rebase origin/main` 으로 base 를 최신화한다.
+2. push 후 `migration-check` 가 PR 의 latest commit 기준 green 인지 확인한다.
+3. 본 PR 에 `migration-recheck-on-main` 알림 코멘트가 게시되어 있다면, 무조건 위 1·2 단계를 다시 수행한다.
+
+이 규약은 [`/.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md) 의 Migration checklist 와 짝을 이룬다 — 작성자는 체크박스를 통해 self-confirmation 한다.
+
+### 6.3 사후 안전망 — `migration-recheck-on-main`
+
+`backend/migrations/**` 가 main 에 push 될 때 (= migration PR 이 머지된 직후) [`/.github/workflows/migration-recheck-on-main.yml`](../../.github/workflows/migration-recheck-on-main.yml) 이 두 가지를 자동 수행한다.
+
+- **Post-merge sanity** — `python3 scripts/check-migration-versions.py --base HEAD~1` 를 main 에서 실행. dup / gap / 단조성 / `.conf` 페어 위반이 main 에 실제로 도달했으면 워크플로가 fail 하여 Actions 탭에 빨간불이 켜진다 (Slack/Email 알림이 연동되어 있으면 자동 통지).
+- **Auto-nudge** — 열린 PR 중 `backend/migrations/**` 파일이 변경 목록에 포함된 PR 들에 "rebase + CI 재실행 필요" 코멘트를 자동 게시. PR 작성자가 race 가능성을 즉시 인지하고 §6.2 규약을 수행하도록 nudge.
+
+두 작업 모두 머지 자체를 막진 못한다 — 무료 private 환경에서 가능한 최대 강도는 "즉시 가시화 + nudge" 다. 향후 유료 플랜으로 전환 시 [§7 대안 4](#대안-4-github-branch-protection--require-branches-to-be-up-to-date) 의 branch protection 을 §6.2 로 승격하고 본 절은 backup 으로 유지할 수 있다.
+
+## 7. 폐기 대안 (Rationale)
+
+### 대안 1: 타임스탬프 prefix (`V<YYYYMMDDHHMMSS>__...`)
+
+장점은 unique 보장이 자연스럽다는 점이지만, 다음 단점으로 폐기.
+
+- 타임스탬프 순서가 **실제 의도된 실행 순서와 어긋날 수 있다** — 작성자 시계 차이 / merge 순서 / cherry-pick 으로 인해 의존성 깨짐이 발생한다.
+- Flyway 의 단조 정수 모델과 자연스럽게 맞물리지 않아 `outOfOrder` 위험을 흡수하게 된다.
+- 한 PR 의 마이그레이션을 다른 PR 의 마이그레이션 사이에 끼워 넣을 동기가 발생해 (시계 후순위) append-only 원칙이 흔들린다.
+
+### 대안 2: `flyway.outOfOrder=true`
+
+옛 V번호가 늦게 들어와도 실행한다. PR 충돌 부담은 줄지만:
+
+- **의존성 사고 위험** — V<N+1> 이 V<N> 컬럼을 참조하는 코드를 작성해 두었는데, 운영 환경에는 V<N> 이 더 늦게 들어가는 케이스가 가능해진다.
+- 환경별 적용 이력이 비결정적이 되어 디버깅·재현이 어려워진다.
+
+본 규약은 `outOfOrder=false` 를 유지하고 PR CI 가드로 충돌을 사전 차단한다.
+
+### 대안 3: GitHub Merge Queue
+
+자동화 강도는 가장 높지만:
+
+- GitHub plan 의존성 + 셋업 비용이 작지 않다 (private 저장소의 merge queue 는 유료 플랜 한정).
+- 본 repo 규모에서는 §6.2/§6.3 의 규약 + 사후 안전망만으로도 race 빈도 대비 비용 대비 효율이 더 낫다.
+- 향후 PR 동시성이 늘어 race 가 빈번해지면 재검토 후보로 둔다.
+
+### 대안 4: GitHub branch protection — "Require branches to be up to date"
+
+race 차단의 **정공법**이지만 본 repo 는 GitHub 무료 플랜의 private 저장소여서 다음 제약이 있다.
+
+- Settings → Branches → Branch protection rules 의 일부 옵션 (특히 required status checks / "up to date" 강제) 이 무료 private 에서 비활성화되어 있다.
+- `gh api -X PUT repos/<owner>/<repo>/branches/main/protection` CLI 역시 동일한 플랜 제약으로 실패한다.
+
+따라서 현재는 §6.2 (작성자 책임 규약) + §6.3 (`migration-recheck-on-main`) 으로 대체한다. 향후 유료 플랜으로 전환하면 다음 순서로 승격을 검토한다.
+
+1. Settings → Branches → main → "Require branches to be up to date before merging" 활성화.
+2. `migration-check / guard` 를 required status check 로 등록.
+3. §6.2 의 작성자 책임 규약을 자동화 차단으로 흡수.
+4. §6.3 의 `migration-recheck-on-main` 은 backup 으로 유지 — race 가 사후에라도 main 에 도달했을 때 가시화하는 역할은 branch protection 이 대체하지 못한다.
+
+---
+
+## 참고
+
+- 실제 작성 가이드(트랜잭션 모드, NOT VALID 패턴, extension, `.conf` 사용법, repair 절차): [`backend/migrations/README.md`](../../backend/migrations/README.md)
+- 시스템 아키텍처 §2.8 (Flyway 운영): [`spec/0-overview.md`](../0-overview.md)
+- 가드 스크립트: [`scripts/check-migration-versions.py`](../../scripts/check-migration-versions.py)
+- CI workflow: [`.github/workflows/migration-check.yml`](../../.github/workflows/migration-check.yml)
+
+```
+
+#### `spec/conventions/node-output.md`
+```
+# Output 변수 일관성 규칙 (Conventions)
+
+모든 노드 개선 문서가 참조하는 **공통 규칙집**입니다. 각 노드 개선 문서는 이 Principle들 중 위반 사항을 식별하고 그에 대한 구체적인 수정안을 제시합니다.
+
+> **설계 목표**: "워크플로우 작성자가 `$node["노드 이름"].output.*` 로 값을 꺼낼 때, **노드 종류를 몰라도 어디에 무엇이 있을지 예측 가능**하도록 한다."
+
+---
+
+## Principle 0 — `NodeHandlerOutput`의 5필드는 불변
+
+모든 노드 핸들러는 `{ config, output, meta?, port?, status? }` 형태의 객체를 반환합니다.
+- `config`: 해석된 설정값 (자격증명 제거)
+- `output`: 후속 노드에 전달되는 **주 데이터**
+- `meta`: **실행 메타데이터** (duration, statusCode, tokens, logs)
+- `port`: 라우팅 포트 지시 (string | string[])
+- `status`: 흐름 제어 상태 (`waiting_for_input`, `resumed`, `ended` 등)
+
+이 5필드의 의미는 **어떤 노드에서든 동일**해야 합니다.
+
+---
+
+## Principle 1 — `output` 은 "비즈니스 결과물"만 담는다
+
+`output` 아래에는 후속 노드가 로직에 사용할 **도메인 데이터**만 둡니다.
+
+| ✅ `output`에 두는 것 | ❌ `output`에 두지 않는 것 |
+| --- | --- |
+| 응답 본문 / 분류 결과 / 추출된 필드 | 토큰 수 / duration / HTTP status code |
+| 렌더링된 프레젠테이션 뷰 | LLM model 이름 / 디버그 로그 |
+| 사용자 입력 / 버튼 클릭 인터랙션 | 실행 횟수 / retry count |
+
+→ 실행 메트릭은 **Principle 2** 에 따라 `meta`에 둡니다.
+
+---
+
+## Principle 1.1 — `config` 와 `output` 은 **직교**한다 (중복 금지)
+
+사용자가 UI에서 설정한 **리터럴 값**은 **`config` 에만** 존재하고, 해당 값을 `output` 에 중복 복사하지 않습니다.
+
+### 1.1.1. 규칙
+
+| 값의 성격 | 저장 위치 |
+| --- | --- |
+| **사용자가 UI/schema 로 설정한 리터럴 값** (title, submitLabel, layout, chartType, format, columns 정의, fields 정의, systemPrompt, maxTurns, categories 정의 등) | `config` **만** |
+| **런타임에 계산/변형/집계/평가된 값** (resolved items (dynamic), evaluated rows, aggregated chart data, rendered template string, LLM response, extracted fields, normalized HTTP response) | `output` **만** |
+| **사용자 상호작용 데이터** (form submission, button click, user message) | `output.interaction` |
+| **실행 메트릭** (duration, tokens, status code, rowCount) | `meta` (Principle 2) |
+
+### 1.1.2. 식별 기준
+
+다음 질문으로 판단:
+
+> "이 값을 알기 위해 노드를 **실제 실행**해야 하는가?"
+
+- 실행 없이 schema/config 만 보면 알 수 있음 → `config`
+- 실행이 필요함 (input/외부 API/사용자 입력에 의존) → `output`
+
+### 1.1.3. 적용 예
+
+- `form.config.title = "User Profile"` → `output` 에 **echo 금지**. 후속 노드가 필요하면 `$node["F"].config.title` 사용.
+- `carousel.config.layout = "card"` → `output` 에 echo 금지.
+- `chart.config.chartType = "bar"` → `output` 에 echo 금지. 반면 `output.data` 는 input을 집계한 런타임 값이므로 OK.
+- `template.config.content = "Hello {{ name }}"` → `output` 에 echo 금지. 반면 `output.rendered = "Hello Alice"` 는 expression resolver 가 해석한 런타임 결과이므로 OK. **이 패턴은 Principle 7 (config echo 원칙) 과 정확히 정합한다 — `config` 는 원본 템플릿, `output` 은 평가 결과.**
+- `loop.config.count = 10` → `output` 에 echo 금지. 실제로 실행된 횟수는 `meta.iterations` 또는 `output.iterations.length`.
+
+### 1.1.4. 예외 — `output.view` 타입 판별자 패턴은 **사용하지 않는다**
+
+기존 초안에서 제안했던 `output.view.type = 'form' | 'carousel' | ...` 판별자는 **폐기**합니다. 노드 종류는 `$node["X"]` 로 접근하는 시점에 이미 워크플로우 정의상 알 수 있으므로 판별자는 불필요한 중복입니다.
+
+---
+
+## Principle 2 — `meta` 는 "실행 메트릭"만 담는다
+
+| 분류 | 필수/권장 필드 |
+| --- | --- |
+| **공통** | `meta.durationMs: number` |
+| **LLM 계열** | `meta.model`, `meta.inputTokens`, `meta.outputTokens`, `meta.totalTokens`, `meta.thinkingTokens?`, `meta.toolCalls?` |
+| **HTTP** | `meta.statusCode`, `meta.durationMs` |
+| **DB** | `meta.durationMs`, `meta.rowCount` |
+| **Code** | `meta.durationMs`, `meta.success`, `meta.logs?`, `meta.error?`, `meta.errorCode?` |
+| **Container** | `meta.iterations?`, `meta.branches?`, `meta.matchedCount?` |
+
+> `ai_agent` 가 현재 사용하는 `output.metadata.*` 는 **폐지**합니다. 모든 토큰/모델 정보는 `meta.*` 로 이동.
+
+---
+
+## Principle 3 — 에러 컨트랙트 통일
+
+### 3.1. 분류
+
+| 종류 | 처리 방식 |
+| --- | --- |
+| **Pre-flight 에러** (config 오류, credential 누락, SSRF 차단 등) | `throw` → 엔진이 실행 실패로 마킹 |
+| **Runtime 에러** (외부 API 실패, 쿼리 실패 등) | `port: 'error'` + `output.error` |
+| **예상 가능한 비즈니스 실패** (매칭 없음, 빈 결과 등) | 정상 `port` 유지, 결과가 비어있음을 명시 |
+
+### 3.2. `output.error` 표준 형태
+
+```json
+{
+  "output": {
+    "error": {
+      "code": "HTTP_5XX" | "DB_QUERY_FAILED" | "LLM_TIMEOUT" | ...,
+      "message": "사람이 읽는 메시지",
+      "details": { /* optional, 노드별 */ }
+    }
+  },
+  "port": "error"
+}
+```
+
+- `code` 는 `UPPER_SNAKE_CASE`.
+- `message` 는 국제화 고려 없음 (로그/디버깅용 원문).
+- `details` 는 선택적, 노드별 스키마.
+
+### 3.3. 에러 포트 보유 노드
+
+반드시 `error` 포트를 갖는 노드: `http_request`, `database_query`, `send_email`, `cafe24`, `ai_agent`, `information_extractor`, `text_classifier`, `code`, `workflow` (sub-workflow 실패 시).
+`transform` 은 pre-flight(config) 검증만 수행 → throw.
+
+---
+
+## Principle 4 — 블로킹/재개 컨트랙트 통일
+
+### 4.1. 상태 전이
+
+```
+[실행 시작]
+   │
+   ├─ 블로킹 노드 도달
+   │     ↓
+   │  status: "waiting_for_input"
+   │  output: { view: {...} }         ← 렌더링용 뷰
+   │  (엔진이 실행을 일시 중지)
+   │
+   ├─ 사용자 입력 수신
+   │     ↓
+   │  status: "resumed"                ← 통일된 resumed 상태
+   │  output: {
+   │    view: {...},                   ← 이전 뷰 그대로 유지 (immutable snapshot)
+   │    interaction: {
+   │      type: "form_submitted" | "button_click" | "message_received",
+   │      data: {...},                 ← type별 payload
+   │      receivedAt: ISO8601
+   │    }
+   │  }
+   │
+   └─ (multi-turn LLM의 경우) 조건 만족 시
+         ↓
+      status: "ended"
+      port: <condition_id> | "user_ended" | "max_turns" | "out"
+      output: { result: {...}, ... }   ← 최종 결과
+```
+
+### 4.2. 폐기할 필드 / 구조
+
+- `_multiTurnState` → `_resumeState`로 통일. 노출되지 않는 internal 필드임을 문서에 명시.
+- 현재 form의 `output.submittedData` → `output.interaction.data` 로 이동.
+- 현재 carousel/chart/table/template의 `output.previousOutput` → **제거**. 이전 뷰 정보는 `config` + output의 런타임 필드 조합으로 재구성 가능 (Principle 1.1).
+- 초안의 `output.view` 래퍼 → **폐기** (Principle 1.1.4). 런타임 값은 `output` 최상위에 직접 배치.
+- 초안의 `output.view.type` 판별자 → **폐기** (Principle 1.1.4). 노드 타입은 워크플로우 정의에서 파악.
+- 현재 presentation 노드의 `output.type: 'carousel'|'table'|...` 판별자 → **폐기** (동일 이유).
+- 현재 presentation 노드의 `output.rendered` (HTML snapshot) → **프런트 렌더링용** 이라면 유지 가능하나, 후속 노드 로직이 참조할 런타임 값이 아니면 `meta.rendered` 로 이동 검토.
+
+### 4.3. Waiting 상태의 `output` 내용 (노드별)
+
+`output` 에는 **이 실행 시점에 계산된 런타임 값만** 담습니다. 리터럴 config 필드는 echo 금지 (Principle 1.1).
+
+| 노드 | Waiting `output` | 런타임 필드 설명 |
+| --- | --- | --- |
+| `form` | `{}` (빈 객체) | 폼 렌더링에 계산할 값 없음. fields/title/submitLabel 등은 모두 `config` 참조. |
+| `carousel` (static) | `{}` | `items` 가 literal config. 런타임 계산 없음. 후속 노드는 `config.items` 참조. |
+| `carousel` (dynamic) | `{ items }` | `source` 표현식 해석 + `titleField`/`descriptionField`/`imageField` 매핑으로 **런타임 생성**된 items 배열. `config.items` 와 독립. |
+| `table` (static) | `{ rows }` | 핸들러가 `columns[*].field` 기준으로 row 필터링 → 런타임 정규화됨. |
+| `table` (dynamic) | `{ rows, totalRows }` | dataSource 에서 per-row expression 평가 결과. `totalRows` 는 slice 된 페이지 길이. |
+| `chart` | `{ data }` | input 을 xAxis 기준으로 **런타임 집계**한 `[{x, y}, ...]`. chartType/title 은 config. |
+| `template` | `{ rendered }` | 템플릿 문자열이 engine 의 expression resolver 로 **해석된 결과**. `content` / `format` 은 config. |
+| `ai_agent` (multi) | `{ messages }` | 대화 누적. 런타임 상태. |
+| `information_extractor` (multi) | `{ messages, partial? }` | 대화 + 부분적으로 수집된 extracted 필드 (있을 경우). |
+
+### 4.4. Resumed 상태의 `output` 내용
+
+Waiting 시점 output 을 **그대로 유지** (immutable snapshot) 하고 `output.interaction` 을 추가:
+
+```json
+{
+  "output": {
+    ...waiting 시점과 동일한 런타임 필드,
+    "interaction": {
+      "type": "form_submitted" | "button_click" | "button_continue" | "message_received",
+      "data": { /* interaction type별 payload, 아래 참조 */ },
+      "receivedAt": "2026-04-19T12:34:56.789Z"
+    }
+  },
+  "status": "resumed",
+  "port": "<선택된 포트>"
+}
+```
+
+### 4.5. `interaction.data` payload 규격
+
+| `interaction.type` | `data` shape | 적용 노드 |
+| --- | --- | --- |
+| `form_submitted` | `{ [fieldName]: value }` (제출된 필드 값) | `form` |
+| `button_click` | `{ buttonId, buttonLabel, selectedItem? }` | `carousel`, `table`, `chart`, `template` |
+| `button_continue` | `{ buttonId, buttonLabel, url }` | link 타입 버튼의 Continue 포트 (presentation 노드) |
+| `message_received` | `{ content, role: "user" }` | `ai_agent`, `information_extractor` multi-turn |
+
+---
+
+## Principle 5 — `port` 활성화 모델
+
+| 형태 | 의미 | 사용 노드 |
+| --- | --- | --- |
+| `port: undefined` | 기본 단일 출력 (노드 정의상 outputs가 1개) | `transform`, `send_email`, `manual_trigger` |
+| `port: string` | 복수 출력 중 하나 선택 | `if_else`, `switch`, `http_request`, `database_query`, `ai_agent` 등 |
+| `port: string[]` | 복수 출력 동시 활성화 (fan-out) | `parallel` (handler), `text_classifier` (multi-label) |
+
+**금지**: `port` 를 출력 포트 ID 이외의 값으로 사용 (예: 현재 ai_agent가 `output.port` 를 조건 ID 선택에 사용하는 패턴은 Principle 8과 함께 제거).
+
+---
+
+## Principle 6 — 동적 포트 ID 네이밍
+
+- **글로벌 버튼**: `config.buttons[i].id` 그대로 사용. 사용자가 설정한 ID.
+- **Per-item 버튼** (carousel static 모드 등): `${buttonId}__item_${index}` — carousel이 이미 사용 중인 suffix를 공식 규칙으로 승격. 엔진이 `__item_\d+$` 패턴을 분리하여 원본 포트로 라우팅.
+- **시스템 포트 예약어**: `out`, `error`, `default`, `done`, `user_ended`, `max_turns`, `completed`, `fallback`, `continue`. 사용자 설정 ID가 이 값과 충돌하면 프런트엔드에서 거부.
+- **동적으로 생성되는 포트**: `class_0` / `class_1` (classifier), `branch_0` / `branch_1` (parallel) 처럼 `<prefix>_<index>` 형식.
+
+---
+
+## Principle 7 — `config` echo 원칙 (NodeHandlerOutput.config)
+
+> `NodeHandlerOutput.config` 는 워크플로우 작성자가 설정한 **원본(pre-evaluation) 값** 을 그대로 echo 하는 필드입니다. expression(`{{ ... }}`) 이 포함된 필드는 평가 전 형태를 echo 하고, **평가 결과는 `output.*` 에 둡니다**.
+>
+> 후속 노드는:
+> - `$node["X"].config.<field>` — 노드가 **어떻게 설정됐는가** (원본 템플릿)
+> - `$node["X"].output.<field>` — 노드가 **무엇을 실제로 생산/사용했는가** (평가 결과)
+>
+> 두 영역의 직교성은 Principle 1.1 의 핵심 전제입니다. 핸들러가 `context.rawConfig` 를 echo 함으로써 이 직교성이 유지됩니다 (PRD `ENG-RC-*`, Spec [실행 엔진 §5.5](../../spec/5-system/4-execution-engine.md)).
+
+**항상 echo** (NodeHandlerOutput.config 에 raw 형태로): 사용자가 UI 에서 설정한 **비민감** 값
+- `method`, `url` (credential 제거된 raw 형태), `queryType`, `mode`, `model`, `systemPrompt` (raw — `{{ }}` 포함 가능), `userPrompt` (raw), `subject` (raw), `body` (raw), `fields`, `title`, `submitLabel`, `layout`, `items`, `columns`, `chartType`, `conditions`, `categories`, `iterationLimit`, `branchCount`, `maxTurns`, `maxCollectionRetries`, `outputFormat` 등.
+
+**절대 echo 금지**:
+- 자격증명 (password, apiKey, token, secret, oauth credentials).
+- 코드 본문 (`code.config.code` — 이미 `expression-exclusions`에 등록되어 있음).
+- URL 내 임베디드 credential (`https://user:pass@host` → `https://host` 로 sanitize).
+- 파일 업로드 원본 바이너리 (reference만).
+
+**선택적 echo** (크기 문제):
+- `form.config.fields` 가 매우 클 경우 → 그대로 echo (정의상 구조 정보).
+- `ai_agent.config.systemPrompt` 가 수천 줄일 경우에도 그대로 echo (디버깅 목적).
+
+**`config` (raw) ↔ `output` (evaluated) 관계** (Principle 1.1 재확인):
+- 모든 raw config 필드는 **`output` 에 복사되지 않습니다**.
+- expression 평가 결과는 `output.*` 에 단일 보존 (Principle 8.2 의 카테고리별 네이밍 원칙을 따름).
+- expression 미사용 필드 (예: `mode`, `chartType`) 는 raw 와 evaluated 가 동일하므로 본 변경의 영향 없음.
+
+**`context.rawConfig` 의 mutation 보호**:
+- 엔진은 `Object.freeze` 적용한 shallow snapshot 을 주입한다 — top-level 필드 mutation 은 strict 모드에서 TypeError 가 발생한다.
+- **Shallow 임에 유의** — `rawConfig.headers.foo = '...'` 같은 중첩 객체 변이는 차단되지 않는다. 핸들러는 rawConfig 를 read-only 로 다루어야 하며, 변형이 필요하면 `structuredClone` 으로 복제한다.
+
+### 핸들러 구현 가이드
+
+```ts
+// 표준 패턴 — 핸들러는 context.rawConfig 를 echo, evaluated 값으로 동작.
+async execute(input, config /* evaluated */, context /* { rawConfig, ... } */) {
+  const evaluatedSubject = config.subject as string;          // "Hello Alice"
+  const evaluatedBody = config.body as string;
+  await sendMail({ subject: evaluatedSubject, body: evaluatedBody, ... });
+
+  return {
+    config: {
+      // raw 를 echo. 사용자가 expression 으로 작성했다면 "{{ name }}" 을 그대로.
+      integrationId: context.rawConfig?.integrationId,
+      to: context.rawConfig?.to,
+      subject: context.rawConfig?.subject,                    // "Hello {{ name }}"
+      body: context.rawConfig?.body,
+      bodyType: context.rawConfig?.bodyType,
+    },
+    output: {
+      messageId: info.messageId,
+      // evaluated 값. 후속 노드가 실제 발송된 내용을 참조.
+      subject: evaluatedSubject,
+      body: evaluatedBody,
+      bodyType: config.bodyType,
+    },
+  };
+}
+```
+
+---
+
+## Principle 8 — 이중/불필요한 중첩 제거
+
+### 8.1. 금지 패턴
+
+- ❌ `output.output.extracted.*` (현재 `information_extractor`)
+- ❌ `output.data.*` 를 "본 결과" 의 1차 wrapper로 사용 (현재 `ai_agent` conditional)
+- ❌ `output.metadata.tokens` (현재 `ai_agent`) → `meta.tokens` 로 이동
+
+### 8.2. 통일된 1차 네이밍
+
+| 개념 | 권장 위치 |
+| --- | --- |
+| LLM의 응답 텍스트/객체 | `output.result.response` (ai_agent) |
+| 분류된 카테고리 | `output.result.category` (single) / `output.result.categories` (multi) |
+| 추출된 필드 | `output.result.extracted` |
+| HTTP 응답 본문 | `output.response` (그대로 유지, 이미 관용적) + `output.responseHeaders` |
+| HTTP 요청 본문 (evaluated) | `output.requestBody`, `output.requestBodyType` (Principle 7 — config 의 raw 와 직교) |
+| DB 쿼리 결과 | `output.rows`, `output.rowCount`, `output.fields`, `output.insertId?` (그대로 유지) |
+| 이메일 전송 결과 | `output.messageId`, `output.accepted`, `output.rejected`, `output.subject`, `output.body`, `output.bodyType` (subject·body 는 Principle 7 — config 의 raw 와 직교) |
+| 코드 실행 결과 | `output.result` |
+| 프레젠테이션 뷰 | `output.view` (Principle 4 참고) |
+
+> 규칙: **LLM 계열 노드 (ai_agent, text_classifier, information_extractor) 는 `output.result` 아래에 도메인 결과를 모은다.** 이 한 문장이면 3개 노드 모두 일관됩니다.
+
+---
+
+## Principle 9 — Container 노드의 `output` 오버라이트 컨트랙트
+
+Container 노드 (
+
+... (truncated due to size limit) ...

```

---

### 파일 11: review/consistency/2026/05/16/00_36_35/_prompts/cross_spec.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 12: review/consistency/2026/05/16/00_36_35/_prompts/naming_collision.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 13: review/consistency/2026/05/16/00_36_35/_prompts/plan_coherence.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 14: review/consistency/2026/05/16/00_36_35/_prompts/rationale_continuity.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 6db2d5df66df8b0e8f2ea34730b1c016390ea3c9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 01:00:10 2026 +0900

    fix(integrations): cafe24 Private request-scopes 응답에 대한 UI 안내 표시
    
    상세 페이지에서 추가 권한을 요청하면 백엔드는 `cafe24_private_pending` 모드와
    `scopesAdded` 를 반환하지만 onSuccess 가 `authUrl` 분기만 처리하고 있어 사용자는
    화면 변화 없이 "아무 일도 안 일어남" 으로 인식하던 버그를 수정한다.
    
    - ScopeTab 을 별도 모듈 `scope-tab.tsx` 로 추출 (Next.js page 파일에 named
      export 가 금지되어 단위 테스트가 직접 import 할 수 없는 제약 해소).
    - requestMutation.onSuccess 에 `mode === 'cafe24_private_pending'` 분기 추가.
      → inline amber alert 로 "Cafe24 Developers 에서 권한 추가 → 테스트 실행"
      안내문(spec §4.4 의 안내 문구)과 `scopesAdded` 목록을 표시 + `toast.info`
      로 즉시 알림.
    - `OAuthBeginResult` 와 분리된 `RequestScopesResult` 타입 신설 — Cafe24
      Private 분기에서 `scopesAdded: string[]` 를 type-safe 하게 노출.
    - i18n 키 추가 (ko/en): `cafe24PrivateScopeRequestTitle` /
      `cafe24PrivateScopeRequestDesc` / `cafe24PrivateScopeRequestScopesAdded`.
      consistency-checker W-3 권고에 따라 신규 통합의 `cafe24PrivatePending*`
      계열과 prefix 분리.
    - `openOAuthPopup` 도 공용 모듈로 추출.
    - 단위 테스트 2건 추가 (cafe24 분기 / authUrl 분기).
    
    사전 일관성 검토 BLOCK: NO — `review/consistency/2026/05/16/00_36_35/SUMMARY.md`.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/00_36_35/_prompts/rationale_continuity.md b/review/consistency/2026/05/16/00_36_35/_prompts/rationale_continuity.md
new file mode 100644
index 00000000..696e4c78
--- /dev/null
+++ b/review/consistency/2026/05/16/00_36_35/_prompts/rationale_continuity.md
@@ -0,0 +1,612 @@
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
+`pending_install` 상태의 Integration 이 callback 처리 중 token exchange 실패 등으로 떨어졌을 때, 자연스러운 선택지는 `error(auth_failed)` 로 전이하는 것이다. 그러나 Private 앱은 `reauthorize` 액션이 불가능하다 — OAuth 재시작은 **Cafe24 Developers 의 "테스트 실행"** 만 정식 진입점이고, 그 진입점은 우리가 발급한 `install_token` 을 path 에 그대로 사용한다. status 를 `error` 로 바꾸면 (a) UI 가 "reauthorize" 액션을 권장하지만 실제로 그 액션이 무력하고, (b) 사용자는 cafe24 측 설정을 고친 뒤 다시 "테스트 실행" 을 누르는 외부 흐름을 진행 중인데 우리 화면이 이를 "error" 로 표기해 흐름 단계를 오인하게 된다. 따라서 callback 실패는 `status_reason` + `last_error` 만 채우고 status 는 `pending_install` 그대로 유지한다. (참고: `review/consistency/2026-05-14_18-23-55`)
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
+### Cafe24 Private 의 `connected → expired` 복구 경로 (2026-05-14)
+
+일반 OAuth provider 는 `expired → connected` 가 reauthorize 또는 자동 refresh 로 복구된다 (§6 / data-flow §3.1). **Cafe24 Private 앱은 reauthorize 진입점이 없고**, refresh 도 token endpoint 가 mall 별이라 일반 흐름이긴 하지만 만약 refresh 가 실패해 `expired(refresh_failed)` 로 떨어지면 **복구 유일 경로는 삭제 후 재등록** 이다. 이건 Private 앱의 구조적 제약 (우리 서버가 OAuth 를 시작할 수 없음) 의 당연한 귀결이며, §6 전이 표의 `expired → connected (reauthorize)` 항은 Cafe24 Private 에는 적용되지 않음. UI 의 reauthorize 버튼 비활성 (§4.2) 이 이 사실을 반영한다.
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
+비용: O(N) HMAC verify (회복 분기에서만, 정상 흐름 zero impact). 옛 폐기된 "100건 mall_id 스캔 + trial HMAC" 과 형태는 비슷하나 (a) 호출 빈도가 낮고 (404 fallback only), (b) N 이 V046 으로 1~2 수준으로 묶임. 정상 식별은 여전히 install_token 단일 row 조회.
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
+사전 일관성 검토 세션: `re

... (truncated due to prompt size limit) ...

---

### 파일 15: review/consistency/2026/05/16/00_36_35/_retry_state.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
commit 6db2d5df66df8b0e8f2ea34730b1c016390ea3c9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 01:00:10 2026 +0900

    fix(integrations): cafe24 Private request-scopes 응답에 대한 UI 안내 표시
    
    상세 페이지에서 추가 권한을 요청하면 백엔드는 `cafe24_private_pending` 모드와
    `scopesAdded` 를 반환하지만 onSuccess 가 `authUrl` 분기만 처리하고 있어 사용자는
    화면 변화 없이 "아무 일도 안 일어남" 으로 인식하던 버그를 수정한다.
    
    - ScopeTab 을 별도 모듈 `scope-tab.tsx` 로 추출 (Next.js page 파일에 named
      export 가 금지되어 단위 테스트가 직접 import 할 수 없는 제약 해소).
    - requestMutation.onSuccess 에 `mode === 'cafe24_private_pending'` 분기 추가.
      → inline amber alert 로 "Cafe24 Developers 에서 권한 추가 → 테스트 실행"
      안내문(spec §4.4 의 안내 문구)과 `scopesAdded` 목록을 표시 + `toast.info`
      로 즉시 알림.
    - `OAuthBeginResult` 와 분리된 `RequestScopesResult` 타입 신설 — Cafe24
      Private 분기에서 `scopesAdded: string[]` 를 type-safe 하게 노출.
    - i18n 키 추가 (ko/en): `cafe24PrivateScopeRequestTitle` /
      `cafe24PrivateScopeRequestDesc` / `cafe24PrivateScopeRequestScopesAdded`.
      consistency-checker W-3 권고에 따라 신규 통합의 `cafe24PrivatePending*`
      계열과 prefix 분리.
    - `openOAuthPopup` 도 공용 모듈로 추출.
    - 단위 테스트 2건 추가 (cafe24 분기 / authUrl 분기).
    
    사전 일관성 검토 BLOCK: NO — `review/consistency/2026/05/16/00_36_35/SUMMARY.md`.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/00_36_35/_retry_state.json b/review/consistency/2026/05/16/00_36_35/_retry_state.json
new file mode 100644
index 00000000..e391f5ab
--- /dev/null
+++ b/review/consistency/2026/05/16/00_36_35/_retry_state.json
@@ -0,0 +1,58 @@
+{
+  "session_dir": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-request-scopes-ui-b6e34d/review/consistency/2026/05/16/00_36_35",
+  "summary_subagent_type": "consistency-summary",
+  "summary_output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-request-scopes-ui-b6e34d/review/consistency/2026/05/16/00_36_35/SUMMARY.md",
+  "subagent_invocations": [
+    {
+      "name": "cross_spec",
+      "subagent_type": "cross-spec-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-request-scopes-ui-b6e34d/review/consistency/2026/05/16/00_36_35/_prompts/cross_spec.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-request-scopes-ui-b6e34d/review/consistency/2026/05/16/00_36_35/cross_spec/review.md"
+    },
+    {
+      "name": "rationale_continuity",
+      "subagent_type": "rationale-continuity-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-request-scopes-ui-b6e34d/review/consistency/2026/05/16/00_36_35/_prompts/rationale_continuity.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-request-scopes-ui-b6e34d/review/consistency/2026/05/16/00_36_35/rationale_continuity/review.md"
+    },
+    {
+      "name": "convention_compliance",
+      "subagent_type": "convention-compliance-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-request-scopes-ui-b6e34d/review/consistency/2026/05/16/00_36_35/_prompts/convention_compliance.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-request-scopes-ui-b6e34d/review/consistency/2026/05/16/00_36_35/convention_compliance/review.md"
+    },
+    {
+      "name": "plan_coherence",
+      "subagent_type": "plan-coherence-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-request-scopes-ui-b6e34d/review/consistency/2026/05/16/00_36_35/_prompts/plan_coherence.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-request-scopes-ui-b6e34d/review/consistency/2026/05/16/00_36_35/plan_coherence/review.md"
+    },
+    {
+      "name": "naming_collision",
+      "subagent_type": "naming-collision-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-request-scopes-ui-b6e34d/review/consistency/2026/05/16/00_36_35/_prompts/naming_collision.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-request-scopes-ui-b6e34d/review/consistency/2026/05/16/00_36_35/naming_collision/review.md"
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
+    "cross_spec": [{"status": "success", "issues": 4}],
+    "rationale_continuity": [{"status": "success", "issues": 3}],
+    "convention_compliance": [{"status": "success", "issues": 4}],
+    "plan_coherence": [{"status": "success", "issues": 1}],
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

### 파일 16: review/consistency/2026/05/16/00_36_35/convention_compliance/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 6db2d5df66df8b0e8f2ea34730b1c016390ea3c9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 01:00:10 2026 +0900

    fix(integrations): cafe24 Private request-scopes 응답에 대한 UI 안내 표시
    
    상세 페이지에서 추가 권한을 요청하면 백엔드는 `cafe24_private_pending` 모드와
    `scopesAdded` 를 반환하지만 onSuccess 가 `authUrl` 분기만 처리하고 있어 사용자는
    화면 변화 없이 "아무 일도 안 일어남" 으로 인식하던 버그를 수정한다.
    
    - ScopeTab 을 별도 모듈 `scope-tab.tsx` 로 추출 (Next.js page 파일에 named
      export 가 금지되어 단위 테스트가 직접 import 할 수 없는 제약 해소).
    - requestMutation.onSuccess 에 `mode === 'cafe24_private_pending'` 분기 추가.
      → inline amber alert 로 "Cafe24 Developers 에서 권한 추가 → 테스트 실행"
      안내문(spec §4.4 의 안내 문구)과 `scopesAdded` 목록을 표시 + `toast.info`
      로 즉시 알림.
    - `OAuthBeginResult` 와 분리된 `RequestScopesResult` 타입 신설 — Cafe24
      Private 분기에서 `scopesAdded: string[]` 를 type-safe 하게 노출.
    - i18n 키 추가 (ko/en): `cafe24PrivateScopeRequestTitle` /
      `cafe24PrivateScopeRequestDesc` / `cafe24PrivateScopeRequestScopesAdded`.
      consistency-checker W-3 권고에 따라 신규 통합의 `cafe24PrivatePending*`
      계열과 prefix 분리.
    - `openOAuthPopup` 도 공용 모듈로 추출.
    - 단위 테스트 2건 추가 (cafe24 분기 / authUrl 분기).
    
    사전 일관성 검토 BLOCK: NO — `review/consistency/2026/05/16/00_36_35/SUMMARY.md`.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/00_36_35/convention_compliance/review.md b/review/consistency/2026/05/16/00_36_35/convention_compliance/review.md
new file mode 100644
index 00000000..33622506
--- /dev/null
+++ b/review/consistency/2026/05/16/00_36_35/convention_compliance/review.md
@@ -0,0 +1,55 @@
+# 정식 규약 준수 검토 — `spec/2-navigation/4-integration.md`
+
+검토 모드: `--impl-prep` (구현 착수 전)
+
+---
+
+## 발견사항
+
+### 1. [WARNING] Rationale 내 리뷰 경로 참조가 옛 flat 형식 사용
+- **target 위치**: `## Rationale` 섹션, "Cafe24 Private 앱의 callback 실패는 왜 status 를 보존하나" 항 말미 — `(참고: review/consistency/2026-05-14_18-23-55)`
+- **위반 규약**: `CLAUDE.md` "명명 컨벤션" 표 — review 경로 형식은 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` (nested ISO). 구 flat 형식(`review/consistency/<timestamp>/`)은 "이미 누적된 데이터는 사용자가 이동 예정, 새 세션부터 위 형식 강제" 로 명시.
+- **상세**: 참조된 경로 `review/consistency/2026-05-14_18-23-55`는 `review/<timestamp>/` 패턴의 flat 형식이다. 새 규약의 nested ISO 경로(`review/consistency/2026/05/14/18_23_55/`)와 다르다. spec 본문이 구 경로를 인용하면 독자가 옛 경로와 새 경로를 혼용하는 선례가 생길 수 있다.
+- **제안**: Rationale 참조를 `(참고: review/consistency/2026/05/14/18_23_55/)` 형식으로 교정하거나, 경로 참조 없이 일자만 기재(`2026-05-14 consistency 검토 결과`)하도록 수정. 다만 해당 세션 파일이 아직 flat 경로에 실존한다면 이동 완료 후 경로를 갱신하는 순서가 적합하다. 구현 착수 직전이므로 블로킹 요인은 아니나 향후 spec 정합성 유지를 위해 교정 권장.
+
+---
+
+### 2. [INFO] error code 표기 혼용 — `status_reason` snake_case vs API code UPPER_SNAKE_CASE 맥락이 한 표에서 섞임
+- **target 위치**: §9.4 "공통 응답 포맷" — `INTEGRATION_IN_USE`, `INTEGRATION_TEST_FAILED`, `OAUTH_STATE_MISMATCH` 등 API error code 목록, 그리고 §10.4 "에러 매핑" 표의 `status_reason` 컬럼 값(`oauth_token_exchange_failed`, `oauth_state_mismatch`)
+- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 — `"code" 는 UPPER_SNAKE_CASE`. 또한 §10.4 표에서 `status_reason` 값은 `snake_case` 라 명시하고 있음 (Rationale §"status_reason `oauth_token_exchange_failed`…" 참조).
+- **상세**: 규약 및 문서 자체가 두 가지 케이스를 도메인별로 의도적으로 분리(`status_reason` = snake_case DB 컬럼, API code = UPPER_SNAKE_CASE)한다고 Rationale 에 명확히 서술되어 있다. 실제로 문서 내에서도 도메인을 분리해 올바르게 기술하고 있다. 그러나 §10.4 표의 "Integration 상태" 컬럼이 `status_reason='oauth_token_exchange_failed'` 같은 DB 컬럼 표현과 `error(auth_failed)` 같은 상태 레이블을 함께 쓰면서, 표 헤더만으로는 어느 것이 API 응답 code 고 어느 것이 DB 저장 값인지 구분이 어렵다. node-output 규약의 `UPPER_SNAKE_CASE` code 규칙은 API output의 `output.error.code`에 적용되는 것이고, `Integration.status_reason` 컬럼은 DB 도메인이라 별도 컨벤션을 따르므로 규약 위반은 아니다. 다만 독자 혼동을 줄이기 위해 §10.4 표의 컬럼 표기를 명확히 구분하면 좋다.
+- **제안**: §10.4 표에서 "Integration 상태" 컬럼을 "DB status / status_reason" 으로 구체화하거나, 표 하단에 "표기 구분: API 응답 code = UPPER_SNAKE_CASE, DB status_reason = snake_case" 주석을 한 줄 추가. 규약 위반 자체는 없으므로 우선도 낮음.
+
+---
+
+### 3. [INFO] `## Overview` 섹션 부재 — 단일 파일 영역 판단 여부 확인
+- **target 위치**: 문서 전체 구조 — Overview / 본문 / Rationale 3섹션 권장 중 Overview 없음
+- **위반 규약**: `CLAUDE.md` "프로젝트 스펙 문서" — "각 spec 문서는 권장 3섹션 구성을 따른다: 1. Overview (제품 정의), 2. 본문 (스펙), 3. Rationale". 단, `_product-overview.md` 가 별도로 존재하는 다중 spec 파일 영역에서는 Overview 섹션을 해당 파일에 위임하는 것이 정상.
+- **상세**: `spec/2-navigation/` 디렉토리는 `_product-overview.md` 를 보유한 다중 파일 영역(`spec/<영역>/_product-overview.md` 패턴)이고, 본 파일 상단에 `[PRD 내비게이션](./_product-overview.md#34-integration-통합)` 링크로 제품 정의를 명시적으로 참조하고 있다. CLAUDE.md 의 예외 규정과 정합한다. 위반이 아님.
+- **제안**: 현재 구조는 규약에 맞음. 추가 조치 불필요. 참고용 INFO로만 기록.
+
+---
+
+### 4. [INFO] 금지 경로(`prd/`, `memory/`) 참조 없음 — 적정
+- **target 위치**: 전체 문서
+- **위반 규약**: `CLAUDE.md` — "옛 `prd/`, `memory/`, `user_memo/` 폴더 … 신규 문서를 옛 경로 컨벤션으로 만들지 않는다."
+- **상세**: 문서 내 어디에도 `prd/`, `memory/`, `user_memo/` 경로 참조 없음. 금지 항목 준수 확인됨.
+- **제안**: 없음.
+
+---
+
+### 5. [INFO] API 엔드포인트 명명 — REST 패턴 전반적으로 규약 준수
+- **target 위치**: §9 전체 API 표
+- **위반 규약**: `spec/conventions/swagger.md` §2-4 상태 코드 응답 규칙
+- **상세**: §9.4에 나열된 error code (`INTEGRATION_IN_USE` 409, `OAUTH_STATE_MISMATCH` 400, `CAFE24_INSTALL_INVALID_TOKEN` 404 등)는 모두 UPPER_SNAKE_CASE + HTTP 상태 코드 매핑이 swagger 규약 §2-4 의 표와 일치한다. `{ code, message, details? }` 실패 포맷은 node-output.md Principle 3.2 의 `output.error` 형식과 유사한 패턴을 API 응답에서도 일관되게 사용하고 있다.
+- **제안**: 없음.
+
+---
+
+## 요약
+
+`spec/2-navigation/4-integration.md` 는 전체적으로 정식 규약 준수 수준이 높다. 파일명(`4-integration.md`, 숫자 prefix + kebab-case)과 위치(`spec/2-navigation/`)는 CLAUDE.md 명명 컨벤션과 정확히 일치한다. `_product-overview.md` 가 별도 존재하는 다중 파일 영역이므로 `## Overview` 섹션 부재는 규약 예외에 해당하며 적법하다. 문서 말미에 `## Rationale` 섹션이 있고 내용도 풍부하다. API error code 는 UPPER_SNAKE_CASE, DB status_reason 은 snake_case 로 도메인별 분리 표기가 Rationale 에서 명시적으로 근거를 밝히고 있어 node-output 규약과 충돌하지 않는다. 금지된 옛 경로(`prd/`, `memory/`)의 신규 사용은 없다. 유일한 개선 포인트는 Rationale 내 옛 flat 리뷰 경로 참조로, 현재 세션 이후의 정책을 소급 인용하는 형태여서 WARNING 수준으로 기록한다. 구현 착수를 차단하는 CRITICAL 사항은 없다.
+
+## 위험도
+
+LOW

```

---

### 파일 17: review/consistency/2026/05/16/00_36_35/cross_spec/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 6db2d5df66df8b0e8f2ea34730b1c016390ea3c9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 01:00:10 2026 +0900

    fix(integrations): cafe24 Private request-scopes 응답에 대한 UI 안내 표시
    
    상세 페이지에서 추가 권한을 요청하면 백엔드는 `cafe24_private_pending` 모드와
    `scopesAdded` 를 반환하지만 onSuccess 가 `authUrl` 분기만 처리하고 있어 사용자는
    화면 변화 없이 "아무 일도 안 일어남" 으로 인식하던 버그를 수정한다.
    
    - ScopeTab 을 별도 모듈 `scope-tab.tsx` 로 추출 (Next.js page 파일에 named
      export 가 금지되어 단위 테스트가 직접 import 할 수 없는 제약 해소).
    - requestMutation.onSuccess 에 `mode === 'cafe24_private_pending'` 분기 추가.
      → inline amber alert 로 "Cafe24 Developers 에서 권한 추가 → 테스트 실행"
      안내문(spec §4.4 의 안내 문구)과 `scopesAdded` 목록을 표시 + `toast.info`
      로 즉시 알림.
    - `OAuthBeginResult` 와 분리된 `RequestScopesResult` 타입 신설 — Cafe24
      Private 분기에서 `scopesAdded: string[]` 를 type-safe 하게 노출.
    - i18n 키 추가 (ko/en): `cafe24PrivateScopeRequestTitle` /
      `cafe24PrivateScopeRequestDesc` / `cafe24PrivateScopeRequestScopesAdded`.
      consistency-checker W-3 권고에 따라 신규 통합의 `cafe24PrivatePending*`
      계열과 prefix 분리.
    - `openOAuthPopup` 도 공용 모듈로 추출.
    - 단위 테스트 2건 추가 (cafe24 분기 / authUrl 분기).
    
    사전 일관성 검토 BLOCK: NO — `review/consistency/2026/05/16/00_36_35/SUMMARY.md`.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/00_36_35/cross_spec/review.md b/review/consistency/2026/05/16/00_36_35/cross_spec/review.md
new file mode 100644
index 00000000..ef22c6f1
--- /dev/null
+++ b/review/consistency/2026/05/16/00_36_35/cross_spec/review.md
@@ -0,0 +1,55 @@
+# Cross-Spec 일관성 검토
+
+검토 모드: `--impl-prep`
+대상 스펙: `spec/2-navigation/4-integration.md`
+구현 범위: Cafe24 Private `request-scopes` UI 안내 누락 수정 (frontend-only)
+
+---
+
+## 발견사항
+
+### [INFO] `request-scopes` 응답 shape 의 i18n 키 정의가 plan 과 spec 사이 미세 불일치
+
+- **target 위치**: `plan/in-progress/cafe24-request-scopes-ui.md` 변경 범위 → i18n 키 `requestScopesCafe24PrivatePendingDesc`
+- **충돌 대상**: `spec/2-navigation/4-integration.md §4.4` `[Request scopes]` 셀 — 안내 문구 "Cafe24 Developers 의 앱 권한 설정에서 추가 scope 를 활성화한 뒤 '테스트 실행' 을 다시 누르면 새 token 으로 갱신됩니다."
+- **상세**: spec §4.4 는 안내 문구 원문을 한국어로만 명시하고 있으며, plan 은 동일 i18n 키를 ko/en 양쪽에 추가한다고 명시한다. spec 에 영문 대응 안내 문구가 없어 영어 번역본이 spec 과 일치하는지 검증 기준이 없다. spec 의 해당 셀이 영문 안내를 포함하지 않으므로 번역자(또는 LLM)가 임의 번역을 사용할 위험이 있다.
+- **제안**: spec §4.4 의 `[Request scopes]` 셀 안에 영문 안내 문구 예시를 추가하거나, i18n 키 값 확정 후 spec 에 동기화. 구현 완료 후 ko.ts/en.ts 번역본을 spec 에 역반영하는 것으로도 충분하다. CRITICAL 수준이 아닌 명명·동기화 권장 사항이다.
+
+---
+
+### [INFO] `scopesAdded` 필드의 UI 표현 기준 미정의
+
+- **target 위치**: `spec/2-navigation/4-integration.md §4.4` — `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded: [...] }` 응답 shape 정의
+- **충돌 대상**: `plan/in-progress/cafe24-request-scopes-ui.md` — i18n 키 `requestScopesCafe24PrivatePendingScopesAdded` 추가 명시
+- **상세**: spec §4.4 는 `scopesAdded` 의 존재를 응답 shape 에서 언급하지만 이 필드를 UI 에서 어떻게 표시해야 하는지(목록 나열 여부, 축약 표현 여부 등)를 구체화하지 않는다. plan 이 별도 i18n 키를 만든다는 사실은 표시가 존재한다는 것을 암시하지만 spec 의 UI 설명에는 공백이 있다. 다른 영역 spec 과의 충돌은 아니고 단순 표현 미정의다.
+- **제안**: spec §4.4 에 `scopesAdded` 표시 방식 (예: "추가 요청된 scope: `mall.read_product`, `mall.write_order`" 형식으로 inline alert 본문에 나열)을 한 줄 추가하면 구현자가 해석 차이 없이 일관된 UI 를 만들 수 있다. 구현 후 실제 UI 형태가 결정되면 spec 에 역반영 권장.
+
+---
+
+### [INFO] `POST /api/integrations/:id/request-scopes` 의 Cafe24 Public 와 Private 분기 — spec 과 API 계약 일치 확인 (이상 없음, 동기화 권장)
+
+- **target 위치**: `spec/2-navigation/4-integration.md §9.2` — `POST /api/integrations/:id/request-scopes` 설명
+- **충돌 대상**: `spec/2-navigation/4-integration.md §4.4` 동일 문서 내 교차 참조
+- **상세**: §9.2 는 "응답 분기: 일반 provider — `{ authUrl }` (팝업 OAuth). **Cafe24 Private** — `{ mode: 'cafe24_private_pending', ... }`" 로 분기를 일관되게 기술하고, §4.4 UI 설명도 동일 분기를 반영한다. 두 섹션 간 충돌은 없다. 다만 backend 의 해당 handler 가 spec 대로 Cafe24 Public 에 대해서도 begin 을 호출하지 않고 `authUrl` 을 반환하는지 — 즉 Public 과 Private 분기가 backend 에서도 spec §9.2 와 동일하게 처리되는지 — 는 frontend 구현과 무관하게 별도 검증 대상이다. 이번 변경(frontend-only)과 직접 충돌은 없다.
+- **제안**: 구현 PR 의 backend 변경이 없다는 plan 서술(§"영향 범위: backend 변경 없음")이 spec §9.2 와 일치함을 확인. INFO 수준으로 기록하되 CRITICAL/WARNING 없음.
+
+---
+
+### [INFO] `inline alert` 구현 결정이 spec 에 반영되지 않음
+
+- **target 위치**: `plan/in-progress/cafe24-request-scopes-ui.md §결정` — "inline alert 로 scope panel 안에 안내문 표시"
+- **충돌 대상**: `spec/2-navigation/4-integration.md §4.4` — UI 표시 방식을 "사용자 안내" 텍스트로만 서술, modal/toast/alert 구분 없음
+- **상세**: plan 이 "modal 보다 영구 표시" 를 이유로 inline alert 를 채택했는데, spec §4.4 는 이 결정을 반영하지 않는다. spec 은 응답 후 "안내 문구 표시"만 서술하고 구체적인 컴포넌트 선택(inline alert vs modal vs toast)을 열어두고 있다. plan 의 결정이 나중에 다른 개발자가 다른 방식으로 구현할 때 혼란의 여지가 있다.
+- **제안**: 구현 완료 후 spec §4.4 에 "inline alert(고정 안내문) + toast 알림 병행" 방식을 한 줄 추가해 구현 결정을 spec 에 흡수. 구현 착수 전에 차단이 필요한 수준은 아니다.
+
+---
+
+## 요약
+
+Cross-Spec 일관성 관점에서 이번 구현(Cafe24 Private `request-scopes` UI 안내 누락 수정)은 기존 spec 과의 **직접적인 모순이 없다**. `spec/2-navigation/4-integration.md §4.4` 는 Cafe24 Private 분기에서 `{ mode: 'cafe24_private_pending', ... }` 응답을 받았을 때 안내 문구를 표시해야 한다고 명시하고 있으며, 이번 구현은 해당 명세를 그대로 이행한다. 데이터 모델(Integration 엔티티, `request-scopes` API 계약, 상태 전이)은 변경되지 않으며, RBAC 규칙·계층 책임·요구사항 ID 에도 새로운 충돌이 발생하지 않는다. 발견된 4건은 모두 INFO 등급으로, spec ↔ i18n 영문 안내 문구 동기화, `scopesAdded` UI 표현 미정의, inline alert 결정의 spec 미흡수에 관한 **구현 후 동기화 권장** 사항이다. 구현 진행을 차단할 CRITICAL 또는 WARNING 수준 항목은 없다.
+
+---
+
+## 위험도
+
+NONE

```

---

### 파일 18: review/consistency/2026/05/16/00_36_35/meta.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
commit 6db2d5df66df8b0e8f2ea34730b1c016390ea3c9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 01:00:10 2026 +0900

    fix(integrations): cafe24 Private request-scopes 응답에 대한 UI 안내 표시
    
    상세 페이지에서 추가 권한을 요청하면 백엔드는 `cafe24_private_pending` 모드와
    `scopesAdded` 를 반환하지만 onSuccess 가 `authUrl` 분기만 처리하고 있어 사용자는
    화면 변화 없이 "아무 일도 안 일어남" 으로 인식하던 버그를 수정한다.
    
    - ScopeTab 을 별도 모듈 `scope-tab.tsx` 로 추출 (Next.js page 파일에 named
      export 가 금지되어 단위 테스트가 직접 import 할 수 없는 제약 해소).
    - requestMutation.onSuccess 에 `mode === 'cafe24_private_pending'` 분기 추가.
      → inline amber alert 로 "Cafe24 Developers 에서 권한 추가 → 테스트 실행"
      안내문(spec §4.4 의 안내 문구)과 `scopesAdded` 목록을 표시 + `toast.info`
      로 즉시 알림.
    - `OAuthBeginResult` 와 분리된 `RequestScopesResult` 타입 신설 — Cafe24
      Private 분기에서 `scopesAdded: string[]` 를 type-safe 하게 노출.
    - i18n 키 추가 (ko/en): `cafe24PrivateScopeRequestTitle` /
      `cafe24PrivateScopeRequestDesc` / `cafe24PrivateScopeRequestScopesAdded`.
      consistency-checker W-3 권고에 따라 신규 통합의 `cafe24PrivatePending*`
      계열과 prefix 분리.
    - `openOAuthPopup` 도 공용 모듈로 추출.
    - 단위 테스트 2건 추가 (cafe24 분기 / authUrl 분기).
    
    사전 일관성 검토 BLOCK: NO — `review/consistency/2026/05/16/00_36_35/SUMMARY.md`.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/00_36_35/meta.json b/review/consistency/2026/05/16/00_36_35/meta.json
new file mode 100644
index 00000000..44364731
--- /dev/null
+++ b/review/consistency/2026/05/16/00_36_35/meta.json
@@ -0,0 +1,12 @@
+{
+  "timestamp": "2026-05-16T00:36:35.183330",
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

### 파일 19: review/consistency/2026/05/16/00_36_35/naming_collision/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 6db2d5df66df8b0e8f2ea34730b1c016390ea3c9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 01:00:10 2026 +0900

    fix(integrations): cafe24 Private request-scopes 응답에 대한 UI 안내 표시
    
    상세 페이지에서 추가 권한을 요청하면 백엔드는 `cafe24_private_pending` 모드와
    `scopesAdded` 를 반환하지만 onSuccess 가 `authUrl` 분기만 처리하고 있어 사용자는
    화면 변화 없이 "아무 일도 안 일어남" 으로 인식하던 버그를 수정한다.
    
    - ScopeTab 을 별도 모듈 `scope-tab.tsx` 로 추출 (Next.js page 파일에 named
      export 가 금지되어 단위 테스트가 직접 import 할 수 없는 제약 해소).
    - requestMutation.onSuccess 에 `mode === 'cafe24_private_pending'` 분기 추가.
      → inline amber alert 로 "Cafe24 Developers 에서 권한 추가 → 테스트 실행"
      안내문(spec §4.4 의 안내 문구)과 `scopesAdded` 목록을 표시 + `toast.info`
      로 즉시 알림.
    - `OAuthBeginResult` 와 분리된 `RequestScopesResult` 타입 신설 — Cafe24
      Private 분기에서 `scopesAdded: string[]` 를 type-safe 하게 노출.
    - i18n 키 추가 (ko/en): `cafe24PrivateScopeRequestTitle` /
      `cafe24PrivateScopeRequestDesc` / `cafe24PrivateScopeRequestScopesAdded`.
      consistency-checker W-3 권고에 따라 신규 통합의 `cafe24PrivatePending*`
      계열과 prefix 분리.
    - `openOAuthPopup` 도 공용 모듈로 추출.
    - 단위 테스트 2건 추가 (cafe24 분기 / authUrl 분기).
    
    사전 일관성 검토 BLOCK: NO — `review/consistency/2026/05/16/00_36_35/SUMMARY.md`.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/00_36_35/naming_collision/review.md b/review/consistency/2026/05/16/00_36_35/naming_collision/review.md
new file mode 100644
index 00000000..e9417b6a
--- /dev/null
+++ b/review/consistency/2026/05/16/00_36_35/naming_collision/review.md
@@ -0,0 +1,55 @@
+# 신규 식별자 충돌 검토
+
+검토 모드: `--impl-prep`
+대상 범위: `spec/2-navigation/4-integration.md` (구현 착수 전 검토)
+
+---
+
+## 발견사항
+
+### [WARNING] `requestScopesCafe24PrivatePendingTitle` / `requestScopesCafe24PrivatePendingDesc` — 기존 `cafe24PrivatePending*` 계열과 의미 유사
+
+- **target 신규 식별자**: `requestScopesCafe24PrivatePendingTitle`, `requestScopesCafe24PrivatePendingDesc`, `requestScopesCafe24PrivatePendingScopesAdded` (plan/in-progress/cafe24-request-scopes-ui.md §변경 범위)
+- **기존 사용처**:
+  - `frontend/src/lib/i18n/dict/ko.ts:1623` — `cafe24PrivatePendingTitle: "Cafe24 Developers 설정을 완료해 주세요"` (신규 통합 흐름 `new/page.tsx` 의 `Cafe24PrivatePendingStep` 에서 사용)
+  - `frontend/src/lib/i18n/dict/ko.ts:1624` — `cafe24PrivatePendingDesc: "통합이 연결 대기 상태로..."` (동일 컴포넌트)
+  - `frontend/src/lib/i18n/dict/en.ts:1625`, `1626` — 같은 키의 영문 값
+- **상세**: 기존 `cafe24PrivatePending*` 키는 신규 통합 등록 흐름(`pending_install` 상태의 폴링 컴포넌트)에서 사용된다. 새로 도입하는 `requestScopesCafe24PrivatePending*` 키는 이미 `connected` 상태인 통합의 scope 추가 요청 흐름에서 사용된다. 두 상황은 맥락이 다르므로 **키 값이 달라야 하고**, 실제로 plan 이 의도한 문구("Cafe24 Developers 의 앱 권한 설정에서 추가 scope 를 활성화한 뒤 '테스트 실행' 을 다시 누르면 새 token 으로 갱신됩니다.")는 기존 키의 값과 다르다. 식별자 충돌(동일 키명 중복)은 없지만, 네이밍 패턴(`cafe24PrivatePending*` vs `requestScopesCafe24PrivatePending*`)이 혼용될 경우 향후 유지보수자가 두 계열 키를 혼동하거나, 잘못된 키를 참조하는 오류가 발생할 수 있다.
+- **제안**: 충돌 자체는 없으나, 일관성을 위해 `cafe24PrivatePending*` 계열의 prefix 패턴을 따르되 scope-request 맥락을 명확히 구분하는 방안을 검토한다. 예: `cafe24PrivateScopeRequestTitle`, `cafe24PrivateScopeRequestDesc`, `cafe24PrivateScopeRequestAdded`. 또는 현행 plan 의 `requestScopesCafe24PrivatePending*` 패턴을 유지하되, 기존 `cafe24PrivatePending*` 계열에 대한 그룹 주석을 추가해 의도적 분리임을 명시한다.
+
+---
+
+### [INFO] `scopeRequestOpened` 키 — request-scopes 성공 분기 변경 시 toast 메시지 재사용 검토
+
+- **target 신규 식별자**: (없음 — 기존 키 재사용)
+- **기존 사용처**: `frontend/src/lib/i18n/dict/ko.ts:1583`, `en.ts:1585` — `scopeRequestOpened: "권한 요청 창을 열었어요"` / `"Scope request window opened"`. `frontend/src/app/(main)/integrations/[id]/page.tsx` 의 `requestMutation.onSuccess` 에서 `authUrl` 분기에 사용 중.
+- **상세**: plan 이 `onSuccess` 에 `cafe24_private_pending` 분기를 추가하면서 기존 `authUrl` 분기의 `toast.success(t("integrations.scopeRequestOpened"))` 는 그대로 유지된다. 충돌은 없다. 다만 `scopeRequestOpened` 문구("권한 요청 창을 열었어요")는 팝업 창이 열리는 흐름에만 의미가 있으므로, cafe24_private_pending 분기에서 이 키를 재사용하지 않도록 구현 시 주의가 필요하다. plan 이 `toast.info` 로 별도 알림을 추가하는 것으로 기술하고 있으므로 의도는 명확하다.
+- **제안**: 구현 시 `cafe24_private_pending` 분기에서 `scopeRequestOpened` 를 호출하지 않도록 코드 리뷰 시 확인.
+
+---
+
+### [INFO] 신규 API endpoint 없음 — 기존 `POST /api/integrations/:id/request-scopes` 재사용
+
+- **target 신규 식별자**: (없음)
+- **기존 사용처**: `spec/2-navigation/4-integration.md §4.4` — `POST /api/integrations/:id/request-scopes`. `frontend/src/lib/api/integrations.ts` 의 `requestScopes()` 메서드.
+- **상세**: 이번 변경은 이미 정의·구현된 endpoint 를 호출하는 프론트엔드 핸들러 분기 추가만 해당한다. 신규 endpoint 가 없으므로 API 충돌 없음.
+- **제안**: 해당 없음.
+
+---
+
+### [INFO] 신규 컴포넌트명 없음 — 기존 `Cafe24PrivatePendingStep` 재사용 하지 않는 결정이 문서화됨
+
+- **target 신규 식별자**: (없음 — inline alert 방식으로 별도 컴포넌트 미도입)
+- **기존 사용처**: `frontend/src/app/(main)/integrations/new/page.tsx` — `Cafe24PrivatePendingStep` 함수 컴포넌트.
+- **상세**: plan §결정 에서 `Cafe24PrivatePendingStep` 재사용을 명시적으로 배제하고 inline alert 방식을 선택했다. 컴포넌트명 충돌 없음.
+- **제안**: 해당 없음.
+
+---
+
+## 요약
+
+`spec/2-navigation/4-integration.md` 의 구현 범위(`--impl-prep`)에서 target 문서 자체는 변경이 없으며, 구현 대상인 i18n 키 3개(`requestScopesCafe24PrivatePendingTitle`, `requestScopesCafe24PrivatePendingDesc`, `requestScopesCafe24PrivatePendingScopesAdded`)는 기존 키와 동일 이름 충돌이 없다. 다만 기존 `cafe24PrivatePending*` 계열과 유사한 맥락을 다루는 새 계열(`requestScopesCafe24PrivatePending*`)이 생겨 prefix 패턴이 혼용되는 점은 향후 유지보수 혼동 위험이 있어 WARNING 으로 표기했다. 신규 API endpoint, 엔티티명, 이벤트명, 환경변수, 파일 경로 충돌은 발견되지 않았다.
+
+## 위험도
+
+LOW

```

---

### 파일 20: review/consistency/2026/05/16/00_36_35/plan_coherence/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 6db2d5df66df8b0e8f2ea34730b1c016390ea3c9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 01:00:10 2026 +0900

    fix(integrations): cafe24 Private request-scopes 응답에 대한 UI 안내 표시
    
    상세 페이지에서 추가 권한을 요청하면 백엔드는 `cafe24_private_pending` 모드와
    `scopesAdded` 를 반환하지만 onSuccess 가 `authUrl` 분기만 처리하고 있어 사용자는
    화면 변화 없이 "아무 일도 안 일어남" 으로 인식하던 버그를 수정한다.
    
    - ScopeTab 을 별도 모듈 `scope-tab.tsx` 로 추출 (Next.js page 파일에 named
      export 가 금지되어 단위 테스트가 직접 import 할 수 없는 제약 해소).
    - requestMutation.onSuccess 에 `mode === 'cafe24_private_pending'` 분기 추가.
      → inline amber alert 로 "Cafe24 Developers 에서 권한 추가 → 테스트 실행"
      안내문(spec §4.4 의 안내 문구)과 `scopesAdded` 목록을 표시 + `toast.info`
      로 즉시 알림.
    - `OAuthBeginResult` 와 분리된 `RequestScopesResult` 타입 신설 — Cafe24
      Private 분기에서 `scopesAdded: string[]` 를 type-safe 하게 노출.
    - i18n 키 추가 (ko/en): `cafe24PrivateScopeRequestTitle` /
      `cafe24PrivateScopeRequestDesc` / `cafe24PrivateScopeRequestScopesAdded`.
      consistency-checker W-3 권고에 따라 신규 통합의 `cafe24PrivatePending*`
      계열과 prefix 분리.
    - `openOAuthPopup` 도 공용 모듈로 추출.
    - 단위 테스트 2건 추가 (cafe24 분기 / authUrl 분기).
    
    사전 일관성 검토 BLOCK: NO — `review/consistency/2026/05/16/00_36_35/SUMMARY.md`.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/00_36_35/plan_coherence/review.md b/review/consistency/2026/05/16/00_36_35/plan_coherence/review.md
new file mode 100644
index 00000000..973b8afa
--- /dev/null
+++ b/review/consistency/2026/05/16/00_36_35/plan_coherence/review.md
@@ -0,0 +1,57 @@
+# Plan 정합성 검토 결과
+
+- 검토 모드: 구현 착수 전 검토 (--impl-prep)
+- 대상: `spec/2-navigation/4-integration.md`
+- 검토 범위: `plan/in-progress/cafe24-request-scopes-ui.md` (worktree: `cafe24-request-scopes-ui-b6e34d`)
+
+---
+
+## 발견사항
+
+### 발견사항 없음 (INFO 수준 메모 1건)
+
+- **[INFO]** `spec-update-cafe24-app-url-reuse` plan 이 동일 spec §4.4 를 참조하나 직접 충돌 없음
+  - target 위치: `spec/2-navigation/4-integration.md` §4.4 `[Request scopes]` 행 (line 270)
+  - 관련 plan: `plan/in-progress/spec-update-cafe24-app-url-reuse.md` (worktree: `cafe24-app-url-reuse-f9a2e3`)
+  - 상세: `spec-update-cafe24-app-url-reuse` plan 은 §4.4 를 포함해 §3.2, §6, §9, §10.2, Rationale 등 다수 섹션을 갱신 예정이며, 아직 spec 갱신이 미완료 (`[ ] spec 갱신` 체크박스 미체크)이다. target plan (`cafe24-request-scopes-ui`) 이 착수하는 구현은 **frontend 의 `requestMutation.onSuccess` 한 분기 추가 + i18n 키 추가**에 한정된다. 두 plan 이 건드리는 실제 파일이 다르다 — `spec-update-cafe24-app-url-reuse` 는 spec 파일과 backend 코드, target plan 은 `frontend/src/app/(main)/integrations/[id]/page.tsx` 와 i18n 사전. 직접적인 코드·spec 파일 경합은 없다. 다만 `spec-update-cafe24-app-url-reuse` 의 spec 갱신 완료 이후 §4.4 안내 문구가 변경될 경우, target plan 이 추가한 i18n 값(`requestScopesCafe24PrivatePendingDesc`) 과 맞지 않을 수 있다.
+  - 제안: target plan 의 i18n 안내 문구는 현행 `spec/2-navigation/4-integration.md §4.4` 의 안내 문구를 그대로 사용하므로 현재 spec 기준으로는 정합. `spec-update-cafe24-app-url-reuse` spec 갱신이 완료된 시점에 i18n 값을 재검토하면 된다. 작업 차단 불필요.
+
+---
+
+## 5가지 점검 관점 요약
+
+### 1. 미해결 결정과의 충돌
+
+해당 없음. target plan 이 착수하는 결정(inline alert + toast.info 표시, `cafe24_private_pending` 분기 추가)은 spec §4.4 에 이미 명시된 동작이며, 어떤 plan 에서도 "결정 필요"로 남겨 둔 항목이 아니다.
+
+### 2. 중복 작업 (병렬 worktree 경합)
+
+해당 없음. target plan 의 변경 범위는 `frontend/src/app/(main)/integrations/[id]/page.tsx`, `ko.ts`, `en.ts` 세 파일이다. 현재 활성 worktree 중 동일 파일을 다루는 plan 은 없다.
+
+- `cafe24-pending-polish-followup` (worktree: `cafe24-pending-polish-7fdb7e`) — PR #18~21 스택, 이미 완료/머지 대기 단계. `[id]/page.tsx` 의 폴링 훅 관련 항목은 PR #21 에서 처리됐으나, request-scopes onSuccess 분기와 파일 레벨 충돌 가능성은 낮다(서로 다른 mutation).
+- `spec-update-cafe24-app-url-reuse` (worktree: `cafe24-app-url-reuse-f9a2e3`) — spec 및 backend 파일 수정 예정. `[id]/page.tsx` 수정은 포함되지 않는다.
+- `spec-update-cafe24-install-recovery` (worktree: `cafe24-install-recovery-8b3c4d`) — backend + frontend `src/lib/api/integrations.ts` 타입 수정. `[id]/page.tsx` 직접 수정 없음.
+
+### 3. 선행 plan 미해소
+
+해당 없음. target plan 이 전제하는 사전 조건(응답 shape `{ mode: 'cafe24_private_pending', ... }` 이 백엔드에서 정상 반환됨)은 이미 구현 완료 상태이며, spec §4.4 에도 명시되어 있다.
+
+### 4. 후속 항목 누락
+
+해당 없음. target plan 의 변경은 좁은 범위이며, 이로 인해 무효화되거나 새로 생성되어야 하는 다른 plan 의 후속 항목이 없다.
+
+### 5. worktree 충돌 (spec 파일 동시 수정)
+
+해당 없음. target plan (worktree: `cafe24-request-scopes-ui-b6e34d`) 은 `spec/2-navigation/4-integration.md` 를 **읽기 전용으로만 참조**하고 수정하지 않는다 (변경 범위: frontend 코드 + i18n 사전). 현재 해당 spec 파일을 수정 예정인 plan 은 `spec-update-cafe24-app-url-reuse`(worktree: `cafe24-app-url-reuse-f9a2e3`) 이나, target plan 과는 시점·범위가 다르므로 실질적 충돌이 없다.
+
+---
+
+## 요약
+
+`cafe24-request-scopes-ui` plan 은 이미 spec 에 명세된 `cafe24_private_pending` 응답 분기를 UI 에서 처리하지 않는 버그를 수정하는 좁은 범위의 작업이다. 변경 파일이 `frontend/src/app/(main)/integrations/[id]/page.tsx` 와 i18n 사전에 한정되어, 현재 진행 중인 다른 어떤 plan 과도 spec 파일·코드 파일 레벨의 경합이 없다. 미해결 결정과의 충돌, 선행 조건 미해소, 후속 항목 누락 모두 해당 없다. INFO 1건(spec-update-cafe24-app-url-reuse spec 갱신 완료 후 i18n 재검토 권장)이 있으나 작업을 차단하지 않는다.
+
+---
+
+## 위험도
+
+NONE

```

---

### 파일 21: review/consistency/2026/05/16/00_36_35/rationale_continuity/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 6db2d5df66df8b0e8f2ea34730b1c016390ea3c9
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 01:00:10 2026 +0900

    fix(integrations): cafe24 Private request-scopes 응답에 대한 UI 안내 표시
    
    상세 페이지에서 추가 권한을 요청하면 백엔드는 `cafe24_private_pending` 모드와
    `scopesAdded` 를 반환하지만 onSuccess 가 `authUrl` 분기만 처리하고 있어 사용자는
    화면 변화 없이 "아무 일도 안 일어남" 으로 인식하던 버그를 수정한다.
    
    - ScopeTab 을 별도 모듈 `scope-tab.tsx` 로 추출 (Next.js page 파일에 named
      export 가 금지되어 단위 테스트가 직접 import 할 수 없는 제약 해소).
    - requestMutation.onSuccess 에 `mode === 'cafe24_private_pending'` 분기 추가.
      → inline amber alert 로 "Cafe24 Developers 에서 권한 추가 → 테스트 실행"
      안내문(spec §4.4 의 안내 문구)과 `scopesAdded` 목록을 표시 + `toast.info`
      로 즉시 알림.
    - `OAuthBeginResult` 와 분리된 `RequestScopesResult` 타입 신설 — Cafe24
      Private 분기에서 `scopesAdded: string[]` 를 type-safe 하게 노출.
    - i18n 키 추가 (ko/en): `cafe24PrivateScopeRequestTitle` /
      `cafe24PrivateScopeRequestDesc` / `cafe24PrivateScopeRequestScopesAdded`.
      consistency-checker W-3 권고에 따라 신규 통합의 `cafe24PrivatePending*`
      계열과 prefix 분리.
    - `openOAuthPopup` 도 공용 모듈로 추출.
    - 단위 테스트 2건 추가 (cafe24 분기 / authUrl 분기).
    
    사전 일관성 검토 BLOCK: NO — `review/consistency/2026/05/16/00_36_35/SUMMARY.md`.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/00_36_35/rationale_continuity/review.md b/review/consistency/2026/05/16/00_36_35/rationale_continuity/review.md
new file mode 100644
index 00000000..6bd20cff
--- /dev/null
+++ b/review/consistency/2026/05/16/00_36_35/rationale_continuity/review.md
@@ -0,0 +1,39 @@
+# Rationale 연속성 검토 결과
+
+검토 모드: 구현 착수 전 검토 (--impl-prep)
+검토 대상: `spec/2-navigation/4-integration.md`
+변경 범위: 이번 브랜치에서 추가된 두 Rationale 항목 (diff 기준)
+  - "Cafe24 install_token mismatch 회복 흐름 (2026-05-15 후속)"
+  - "Cafe24 Public app 가용성 — env 기반 노출 (2026-05-15 후속)"
+
+---
+
+### 발견사항
+
+- **[WARNING]** O(N) HMAC trial 회복 분기가 이전에 폐기된 "mall_id 스캔 + trial HMAC" 패턴을 부분 재도입
+  - target 위치: `spec/2-navigation/4-integration.md` § Rationale "Cafe24 install_token mismatch 회복 흐름" (라인 1001–1021)
+  - 과거 결정 출처: 동 문서 § Rationale "install_token 을 App URL path 식별 키로 승격 (2026-05-14)" (라인 921–927)
+  - 상세: 2026-05-14 Rationale 은 "원래 설계는 `GET /oauth/install/cafe24` 가 mall_id + HMAC 만 받고 백엔드가 `pending_install` 행을 in-memory 로 100건 스캔하면서 mall_id 일치 candidates 의 client_secret 으로 HMAC 검증을 trial 했다" 는 방식을 두 가지 운영 위험(비결정적 HMAC 매칭, O(N) 비용)을 이유로 명시적으로 폐기하고, install_token path 식별로 대체했다. 이번에 추가된 "회복 분기"는 install_token 직접 매칭 실패 시 "같은 mall_id 의 row 들을 조회한 뒤 각 row 의 client_secret 으로 HMAC trial 검증" 을 수행한다 — 구조적으로 폐기된 패턴과 동일하다. 신규 Rationale 은 이 점을 인식하고 "옛 폐기된 방식과 형태는 비슷하나 (a) 호출 빈도가 낮고 (404 fallback only), (b) N 이 V046 으로 1~2 수준으로 묶임" 을 차별화 근거로 제시하고 있다. 이 설명은 Rationale 본문 내에 있어 근거가 없는 것은 아니다. 그러나 기존 Rationale 이 폐기한 핵심 우려 중 하나인 "비결정적 HMAC 매칭"에 대한 처리(모호 케이스 분기 → 회복 포기)가 Rationale 안에 기술되어 있으나, 기존 폐기 근거와의 명시적 연결이 없다 — 즉 "폐기 항을 읽었고 이 우회를 의도적으로 허용한다"는 cross-reference 가 누락되어 있다.
+  - 제안: 신규 Rationale 의 "비용" 문단에 "기존 '폐기된 설계' 와 핵심 차이는 (1) 정상 흐름은 여전히 install_token 단일 조회이며 이 분기는 fallback 전용, (2) V046 부분 UNIQUE 로 N ≤ 2 로 상한이 구조적으로 강제됨" 을 명시하고, "install_token 을 App URL path 식별 키로 승격" Rationale 의 해당 폐기 판단을 명시적으로 참조할 것. 예: `(폐기된 "100건 스캔 + trial HMAC" 와의 차이 — "install_token 을 App URL path 식별 키로 승격" Rationale 참조)`.
+
+- **[INFO]** 회복 분기의 TOCTOU 위험에 대한 Rationale 언급 없음
+  - target 위치: 동 Rationale "Cafe24 install_token mismatch 회복 흐름", 회복 분기 절차
+  - 과거 결정 출처: 동 문서 § Rationale "CAFE24_PRIVATE_APP_ALREADY_CONNECTED 의 mall_id 비교 경로 (2026-05-15 갱신)"
+  - 상세: 기존 Rationale 은 V045 이전 방식의 두 번째 폐기 근거로 "SELECT 와 INSERT 사이의 TOCTOU 윈도우" 를 명시했다. 회복 분기는 INSERT 가 아닌 install flow 처리이므로 동일한 TOCTOU 위험이 적용되지 않을 수 있으나, Rationale 이 이 점을 명시적으로 언급하지 않는다. 검토자(또는 구현자)가 이 우려를 가질 수 있다.
+  - 제안: "보안 분석" 항에 "이 분기는 INSERT 없이 read-only 조회 + 기존 흐름 fall-through 이므로 TOCTOU 위험이 없음" 한 문장 추가로 Rationale 완전성을 높일 것.
+
+- **[INFO]** "Cafe24 Public app 가용성" Rationale 은 기존 결정과 충돌 없음, 신규 결정임
+  - target 위치: 동 Rationale "Cafe24 Public app 가용성 — env 기반 노출 (2026-05-15 후속)"
+  - 과거 결정 출처: 해당 없음 (기존 Rationale 에 Public/Private 노출 게이팅에 관한 폐기 결정 없음)
+  - 상세: 이 항목은 신규 기능 결정이며 기존 Rationale 에서 다뤄진 적 없다. "Private 는 항상 노출, Public 만 env 게이트" 의 이분 원칙은 기존 스펙 구조("public = 서버 env client_id/secret, private = 사용자 직접 입력") 와 자연스럽게 일관된다. Rationale 연속성 관점에서 충돌 없음.
+  - 제안: 없음. 현행 작성으로 충분.
+
+---
+
+### 요약
+
+이번 브랜치에서 추가된 두 Rationale 항목 중, "Cafe24 Public app 가용성" 은 기존 Rationale 결정과 충돌이 없는 순수 신규 결정이다. "Cafe24 install_token mismatch 회복 흐름" 은 2026-05-14 에 운영 위험을 이유로 명시적으로 폐기된 "mall_id 스캔 + trial HMAC" 패턴과 구조적으로 유사한 회복 분기를 재도입한다. 신규 Rationale 내부에 차별화 근거(fallback 전용 + V046 UNIQUE 로 N 상한 고정)가 제시되어 있어 의도적 결정임은 분명하나, 기존 폐기 Rationale 에 대한 명시적 cross-reference 가 없어 유지보수 시 "왜 이 방식이 다시 허용되는가"를 추적하기 어렵다. WARNING 1건은 Rationale 보완으로 해소 가능하며, 구현 착수를 차단할 CRITICAL 수준은 아니다.
+
+### 위험도
+
+LOW

```
