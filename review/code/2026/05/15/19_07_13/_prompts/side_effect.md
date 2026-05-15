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

### 파일 1: README.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/README.md b/README.md
index 2478f1dc..76cda30e 100644
--- a/README.md
+++ b/README.md
@@ -1,10 +1,14 @@
 # Clemvion
 
+<p align="left">
+  <img src="frontend/public/logo.svg" alt="Clemvion — Agentic Workflow" width="280">
+</p>
+
 AI가 엮고, 실행하고, 성장시키는 워크플로우 시스템.
 
 **Clemvion**은 AI 에이전트와 노코드 워크플로우 빌더를 통합한 실행 플랫폼입니다. 드래그앤드롭 캔버스 에디터에서 워크플로우를 설계하고, 워크플로우 안에 AI 에이전트 노드를 삽입해 각 단계가 단순 실행을 넘어 판단·적응까지 수행합니다. 비기술자부터 개발자까지 모두를 위한 도구입니다.
 
-브랜드 스토리·비주얼 가이드: [`prd/brand.md`](./prd/brand.md).
+브랜드 스토리·비주얼 가이드: [`spec/6-brand.md`](./spec/6-brand.md).
 
 > 참고: git 저장소 URL 과 코드 디렉터리(`backend/`, `frontend/`) 는 인프라 자산으로 그대로 유지됩니다. Docker 이미지 태그(`clemvion/*`), Kubernetes 매니페스트, 문서·UI·이메일·Swagger·인증·OTEL·스토리지 키 등 빌드/배포 자산과 사용자 노출 영역은 모두 `clemvion` 으로 통일되어 있습니다.
 

```

---

### 파일 2: frontend/src/app/(auth)/layout.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/app/(auth)/layout.tsx b/frontend/src/app/(auth)/layout.tsx
index 43f56c41..1911dbcc 100644
--- a/frontend/src/app/(auth)/layout.tsx
+++ b/frontend/src/app/(auth)/layout.tsx
@@ -1,10 +1,25 @@
+import Link from "next/link";
+import { Logo } from "@/components/ui/logo";
+
+/*
+ * Auth layout — spec/6-brand.md §8.4.6 + spec/2-navigation/10-auth-flow.md §1.
+ * Background uses --background (soil-50 in light, vine-dark-bg-base in dark) —
+ * solid color, no gradient (spec §8.4.4 prohibits gradient backgrounds).
+ */
 export default function AuthLayout({
   children,
 }: {
   children: React.ReactNode;
 }) {
   return (
-    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--muted))] to-[hsl(var(--background))] p-4">
+    <div className="flex min-h-screen flex-col items-center justify-center bg-[hsl(var(--background))] p-4">
+      <Link
+        href="/"
+        aria-label="Clemvion"
+        className="mb-6 flex items-center"
+      >
+        <Logo variant="full" theme="auto" size={200} />
+      </Link>
       <div className="w-full max-w-[400px]">{children}</div>
     </div>
   );

```

---

### 파일 3: frontend/src/app/globals.css
- 변경 유형: Review
- 언어: css

#### 변경된 코드
```
diff --git a/frontend/src/app/globals.css b/frontend/src/app/globals.css
index bc742b06..af8a5827 100644
--- a/frontend/src/app/globals.css
+++ b/frontend/src/app/globals.css
@@ -1,56 +1,98 @@
 @import "tailwindcss";
 
-/* ===== Theme Variables ===== */
+/*
+ * ===== Theme Variables =====
+ *
+ * Brand tokens are defined in spec/6-brand.md §8.2 (Visual Identity).
+ * Each Shadcn-style CSS variable is mapped from a spec brand token.
+ * Format: `H S% L%` (Tailwind/Shadcn convention — used inline as `hsl(var(--name))`).
+ * Light/dark pairs follow spec §8.2.3.
+ */
 :root {
-  --background: 0 0% 100%;
-  --foreground: 0 0% 3.9%;
-  --card: 0 0% 100%;
-  --card-foreground: 0 0% 3.9%;
-  --popover: 0 0% 100%;
-  --popover-foreground: 0 0% 3.9%;
-  --primary: 222.2 47.4% 11.2%;
-  --primary-foreground: 210 40% 98%;
-  --secondary: 210 40% 96.1%;
-  --secondary-foreground: 222.2 47.4% 11.2%;
-  --muted: 210 40% 96.1%;
-  /* WCAG 2.1 AA — 본문 텍스트 ≥ 4.5:1 대비비 보장. lightness 35% 로
-     darkening (이전 46.9% 는 흰 배경에서 ~3.5:1 로 위반 위험), saturation
-     16.3% → 25% 로 살짝 강조해 가독성·구분력 보강. */
-  --muted-foreground: 215.4 25% 35%;
-  --accent: 210 40% 96.1%;
-  --accent-foreground: 222.2 47.4% 11.2%;
+  /* soil-50 #f7f8f6 — spec §8.2.2 page background */
+  --background: 90 12.5% 96.9%;
+  /* ink #0e1a12 — spec §8.2.2 body text */
+  --foreground: 140 30% 7.8%;
+  /* soil-100 #eef5ec — spec §8.2.2 card/mark background */
+  --card: 106.7 31% 94.3%;
+  --card-foreground: 140 30% 7.8%;
+  --popover: 90 12.5% 96.9%;
+  --popover-foreground: 140 30% 7.8%;
+  /* vine-700 #1e7a42 — spec §8.2.1 primary action / brand */
+  --primary: 143.5 60.5% 29.8%;
+  /* text-on-dark #e8f5ec — high-contrast text on vine-700 */
+  --primary-foreground: 138.5 39.4% 93.5%;
+  --secondary: 106.7 31% 94.3%;
+  --secondary-foreground: 143.5 60.5% 29.8%;
+  --muted: 106.7 31% 94.3%;
+  /* ink @ ~60% lightness — spec §8.2.2 ink-60 (secondary text).
+     WCAG 2.1 AA 본문 텍스트 ≥ 4.5:1 보장. ink #0e1a12 의 lightness 7.8%
+     를 35% 까지 끌어올려 soil-50 (96.9%) 대비 ~5:1 확보. */
+  --muted-foreground: 140 20% 35%;
+  --accent: 106.7 31% 94.3%;
+  --accent-foreground: 143.5 60.5% 29.8%;
   --destructive: 0 84.2% 60.2%;
   --destructive-foreground: 210 40% 98%;
-  --border: 214.3 31.8% 91.4%;
-  --input: 214.3 31.8% 91.4%;
-  --ring: 222.2 84% 4.9%;
+  /* vine-border #e4e8e0 — spec §8.2.2 */
+  --border: 90 14.8% 89.4%;
+  --input: 90 14.8% 89.4%;
+  /* vine-700 — focus ring matches primary */
+  --ring: 143.5 60.5% 29.8%;
   --radius: 0.5rem;
   --sidebar-width: 240px;
   --sidebar-collapsed-width: 64px;
 }
 
 .dark {
-  --background: 222.2 84% 4.9%;
-  --foreground: 210 40% 98%;
-  --card: 222.2 84% 4.9%;
-  --card-foreground: 210 40% 98%;
-  --popover: 222.2 84% 4.9%;
-  --popover-foreground: 210 40% 98%;
-  --primary: 210 40% 98%;
-  --primary-foreground: 222.2 47.4% 11.2%;
-  --secondary: 217.2 32.6% 17.5%;
-  --secondary-foreground: 210 40% 98%;
-  --muted: 217.2 32.6% 17.5%;
-  /* dark mode 본문 ≥ 4.5:1 보장. lightness 65.1% → 75% 로 밝혀 ~7:1
-     안전 마진. saturation 은 그대로 유지. */
-  --muted-foreground: 215 20.2% 75%;
-  --accent: 217.2 32.6% 17.5%;
-  --accent-foreground: 210 40% 98%;
+  /* vine-dark-bg-base #0e1210 — spec §8.2.3 page background */
+  --background: 150 12.5% 6.3%;
+  /* text-on-dark #e8f5ec — spec §8.2.3 body text */
+  --foreground: 138.5 39.4% 93.5%;
+  /* vine-dark-bg-elevated #111e14 — spec §8.2.3 card background */
+  --card: 133.8 27.7% 9.2%;
+  --card-foreground: 138.5 39.4% 93.5%;
+  --popover: 133.8 27.7% 9.2%;
+  --popover-foreground: 138.5 39.4% 93.5%;
+  /* vine-dark-accent #6edc8e — spec §8.2.3 primary in dark mode */
+  --primary: 137.5 61.1% 64.7%;
+  /* vine-dark-bg-base — text on light-green button = dark bg */
+  --primary-foreground: 150 12.5% 6.3%;
+  --secondary: 133.8 27.7% 9.2%;
+  --secondary-foreground: 138.5 39.4% 93.5%;
+  --muted: 133.8 27.7% 9.2%;
+  /* text-on-dark @ ~75% lightness — dark mode secondary text.
+     dark bg #0e1210 (6.3%) 대비 ~7:1 안전 마진. */
+  --muted-foreground: 138.5 25% 75%;
+  --accent: 133.8 27.7% 9.2%;
+  --accent-foreground: 138.5 39.4% 93.5%;
   --destructive: 0 62.8% 30.6%;
-  --destructive-foreground: 210 40% 98%;
-  --border: 217.2 32.6% 17.5%;
-  --input: 217.2 32.6% 17.5%;
-  --ring: 212.7 26.8% 83.9%;
+  --destructive-foreground: 138.5 39.4% 93.5%;
+  /* vine-dark-mid #1e4a2a — spec §8.2.3 */
+  --border: 136.4 42.3% 20.4%;
+  --input: 136.4 42.3% 20.4%;
+  --ring: 137.5 61.1% 64.7%;
+}
+
+/*
+ * Brand color tokens — Tailwind v4 `@theme` directive.
+ * Names follow spec §8.2.1 / §8.2.3 verbatim.
+ * Dark variants are NOT registered as separate Tailwind keys (per spec R-10 +
+ * impl-prep INFO 10) — they pair through CSS variables (`:root` / `.dark`) only.
+ * Use `bg-primary`, `text-foreground` etc. for theme-aware coloring; use
+ * `bg-vine-700` only when you need the literal brand hue regardless of theme.
+ */
+@theme {
+  --color-vine-900: #1a4f2c;
+  --color-vine-800: #2a7040;
+  --color-vine-700: #1e7a42;
+  --color-vine-600: #2a8a48;
+  --color-vine-500: #3a9a58;
+  --color-vine-400: #4ab868;
+  --color-vine-300: #5ab872;
+  --color-ink: #0e1a12;
+  --color-soil-50: #f7f8f6;
+  --color-soil-100: #eef5ec;
+  --color-vine-border: #e4e8e0;
 }
 
 /* ===== Toast ===== */

```

---

### 파일 4: frontend/src/app/layout.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/app/layout.tsx b/frontend/src/app/layout.tsx
index 562563a2..197d70a7 100644
--- a/frontend/src/app/layout.tsx
+++ b/frontend/src/app/layout.tsx
@@ -16,6 +16,46 @@ const geistMono = Geist_Mono({
 export const metadata: Metadata = {
   title: "Clemvion",
   description: "AI가 엮고, 실행하고, 성장시키는 워크플로우 시스템",
+  /*
+   * Icon + OG assets — spec/6-brand.md §8.4.1, §8.4.6.
+   * Explicit declaration (instead of Next.js auto-discovery) so the
+   * 16px-optimized vector (spec §8.4.2) is registered alongside the
+   * 32px master icon.svg.
+   *
+   * favicon.ico is intentionally omitted — modern browsers prefer SVG.
+   * Regenerating a multi-size .ico requires raster tooling (sharp /
+   * ImageMagick) and is tracked as a Stage 2 follow-up.
+   *
+   * apple-icon and opengraph-image are served as SVG; PNG variants
+   * are pending the same raster-tooling follow-up.
+   */
+  icons: {
+    icon: [
+      { url: "/favicon-16.svg", type: "image/svg+xml", sizes: "16x16" },
+      { url: "/icon.svg", type: "image/svg+xml", sizes: "32x32" },
+    ],
+    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml", sizes: "180x180" }],
+  },
+  openGraph: {
+    title: "Clemvion — Agentic Workflow",
+    description: "AI가 엮고, 실행하고, 성장시키는 워크플로우 시스템",
+    images: [
+      {
+        url: "/opengraph-image.svg",
+        width: 1200,
+        height: 630,
+        type: "image/svg+xml",
+        alt: "Clemvion — Agentic Workflow",
+      },
+    ],
+    type: "website",
+  },
+  twitter: {
+    card: "summary_large_image",
+    title: "Clemvion — Agentic Workflow",
+    description: "AI가 엮고, 실행하고, 성장시키는 워크플로우 시스템",
+    images: ["/opengraph-image.svg"],
+  },
 };
 
 export default function RootLayout({

```

---

### 파일 5: frontend/src/components/layout/sidebar.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/components/layout/sidebar.tsx b/frontend/src/components/layout/sidebar.tsx
index aae72a27..6e5d8ed0 100644
--- a/frontend/src/components/layout/sidebar.tsx
+++ b/frontend/src/components/layout/sidebar.tsx
@@ -37,6 +37,7 @@ import { authApi } from "@/lib/api/auth";
 import { workspacesApi } from "@/lib/api/workspaces";
 import { apiClient } from "@/lib/api/client";
 import { CreateTeamWorkspaceDialog } from "@/components/workspace/create-team-workspace-dialog";
+import { Logo, LogoMark } from "@/components/ui/logo";
 import { useT, type TranslationKey } from "@/lib/i18n";
 
 import type {
@@ -274,19 +275,25 @@ export function Sidebar() {
           hidden && "-translate-x-full",
         )}
       >
-        {/* Logo */}
+        {/* Logo — spec/6-brand.md §8.4.6 + spec/2-navigation/_layout.md §2.1.
+            expanded → Full logo (auto light/dark); collapsed → Icon mark. */}
         <div className="flex h-14 items-center border-b border-[hsl(var(--border))] px-4">
           {!collapsed && (
-            <Link href="/dashboard" className="text-lg font-semibold">
-              {t("sidebar.productName")}
+            <Link
+              href="/dashboard"
+              aria-label={t("sidebar.productName")}
+              className="flex items-center"
+            >
+              <Logo variant="full" theme="auto" size={150} />
             </Link>
           )}
           {collapsed && (
             <Link
               href="/dashboard"
-              className="mx-auto text-lg font-semibold"
+              aria-label={t("sidebar.productName")}
+              className="mx-auto flex items-center"
             >
-              C
+              <LogoMark theme="auto" size={32} />
             </Link>
           )}
           {isSmall && mobileOpen && (

```

---

### 파일 6: frontend/src/components/ui/__tests__/logo.test.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/components/ui/__tests__/logo.test.tsx b/frontend/src/components/ui/__tests__/logo.test.tsx
new file mode 100644
index 00000000..c2aeaac5
--- /dev/null
+++ b/frontend/src/components/ui/__tests__/logo.test.tsx
@@ -0,0 +1,89 @@
+import { describe, it, expect } from "vitest";
+import { render, screen } from "@testing-library/react";
+import { Logo, LogoMark } from "../logo";
+
+describe("Logo", () => {
+  it("renders full logo by default with sub-copy alt", () => {
+    render(<Logo />);
+    const imgs = screen.getAllByRole("img");
+    expect(imgs.length).toBeGreaterThan(0);
+    // alt contains the Agentic Workflow tagline since sub-copy is always-on (spec §8.4.3)
+    expect(imgs.some((img) => img.getAttribute("alt")?.includes("Agentic Workflow"))).toBe(true);
+  });
+
+  it("renders mark variant (no sub-copy in alt)", () => {
+    render(<Logo variant="mark" theme="light" />);
+    const img = screen.getByRole("img");
+    expect(img.getAttribute("src")).toBe("/logo-mark.svg");
+    expect(img.getAttribute("alt")).toBe("Clemvion");
+  });
+
+  it("renders wordmark variant", () => {
+    render(<Logo variant="wordmark" theme="light" />);
+    const img = screen.getByRole("img");
+    expect(img.getAttribute("src")).toBe("/logo-wordmark.svg");
+  });
+
+  it("renders light theme explicitly with the light asset path", () => {
+    render(<Logo variant="full" theme="light" />);
+    const img = screen.getByRole("img");
+    expect(img.getAttribute("src")).toBe("/logo.svg");
+  });
+
+  it("renders dark theme explicitly with the dark asset path", () => {
+    render(<Logo variant="full" theme="dark" />);
+    const img = screen.getByRole("img");
+    expect(img.getAttribute("src")).toBe("/logo-dark.svg");
+  });
+
+  it("renders both light and dark assets when theme=auto", () => {
+    render(<Logo variant="full" theme="auto" />);
+    const imgs = screen.getAllByRole("img", { hidden: true });
+    const srcs = imgs.map((i) => i.getAttribute("src"));
+    expect(srcs).toContain("/logo.svg");
+    expect(srcs).toContain("/logo-dark.svg");
+    // Light is hidden in dark mode, dark is hidden in light mode — Tailwind `dark:` variant
+    const lightImg = imgs.find((i) => i.getAttribute("src") === "/logo.svg")!;
+    const darkImg = imgs.find((i) => i.getAttribute("src") === "/logo-dark.svg")!;
+    expect(lightImg.className).toContain("dark:hidden");
+    expect(darkImg.className).toContain("hidden");
+    expect(darkImg.className).toContain("dark:block");
+  });
+
+  it("applies size prop as inline width style", () => {
+    render(<Logo variant="full" theme="light" size={200} />);
+    const img = screen.getByRole("img");
+    expect((img as HTMLElement).style.width).toBe("200px");
+  });
+
+  it("respects an explicit alt override", () => {
+    render(<Logo variant="full" theme="light" alt="Custom alt" />);
+    const img = screen.getByRole("img");
+    expect(img.getAttribute("alt")).toBe("Custom alt");
+  });
+
+  it("forwards className to the wrapper", () => {
+    const { container } = render(
+      <Logo variant="mark" theme="light" className="custom-class" />,
+    );
+    const wrapper = container.firstChild as HTMLElement;
+    expect(wrapper.className).toContain("custom-class");
+  });
+});
+
+describe("LogoMark", () => {
+  it("is a convenience for Logo with variant=mark", () => {
+    render(<LogoMark theme="light" />);
+    const img = screen.getByRole("img");
+    expect(img.getAttribute("src")).toBe("/logo-mark.svg");
+    expect(img.getAttribute("alt")).toBe("Clemvion");
+  });
+
+  it("renders both light and dark mark assets when theme=auto", () => {
+    render(<LogoMark theme="auto" />);
+    const imgs = screen.getAllByRole("img", { hidden: true });
+    const srcs = imgs.map((i) => i.getAttribute("src"));
+    expect(srcs).toContain("/logo-mark.svg");
+    expect(srcs).toContain("/logo-mark-dark.svg");
+  });
+});

```

---

### 파일 7: frontend/src/components/ui/logo.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/components/ui/logo.tsx b/frontend/src/components/ui/logo.tsx
new file mode 100644
index 00000000..70dcbd7d
--- /dev/null
+++ b/frontend/src/components/ui/logo.tsx
@@ -0,0 +1,96 @@
+/* eslint-disable @next/next/no-img-element --
+ * Brand SVG assets are tiny static vectors that gain nothing from next/image
+ * optimization (next/image passes SVG through unoptimized anyway). Using
+ * plain <img> keeps the markup synchronous and SSR-friendly for the auto-theme
+ * dual-render pattern below.
+ */
+import * as React from "react";
+import { cn } from "@/lib/utils/cn";
+
+/*
+ * Logo component — renders the Clemvion brand mark per spec/6-brand.md §8.4.
+ *
+ * variant:
+ *   - "full"     : icon mark + wordmark + AGENTIC WORKFLOW sub-copy (spec §8.4.3)
+ *   - "mark"     : icon mark only (spec §8.4.1)
+ *   - "wordmark" : wordmark only, no sub-copy (spec §8.4.1)
+ *
+ * theme:
+ *   - "light" / "dark" : render exactly one asset
+ *   - "auto" (default) : render both light and dark, toggled by Tailwind `dark:` variant
+ *
+ * size: optional pixel width. If omitted, the underlying SVG renders at its
+ *       natural viewBox size.
+ */
+export type LogoVariant = "full" | "mark" | "wordmark";
+export type LogoTheme = "light" | "dark" | "auto";
+
+export interface LogoProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
+  variant?: LogoVariant;
+  theme?: LogoTheme;
+  size?: number;
+  alt?: string;
+}
+
+const ASSET_PATHS: Record<LogoVariant, { light: string; dark: string }> = {
+  full: { light: "/logo.svg", dark: "/logo-dark.svg" },
+  // Wordmark currently has only one tone — the `vi` accent uses vine-700,
+  // which has enough contrast against both light and dark surfaces.
+  // A dedicated dark wordmark can be added later if reviews show contrast issues.
+  wordmark: { light: "/logo-wordmark.svg", dark: "/logo-wordmark.svg" },
+  mark: { light: "/logo-mark.svg", dark: "/logo-mark-dark.svg" },
+};
+
+const DEFAULT_ALT: Record<LogoVariant, string> = {
+  full: "Clemvion — Agentic Workflow",
+  wordmark: "Clemvion",
+  mark: "Clemvion",
+};
+
+export function Logo({
+  variant = "full",
+  theme = "auto",
+  size,
+  alt,
+  className,
+  ...rest
+}: LogoProps) {
+  const paths = ASSET_PATHS[variant];
+  const resolvedAlt = alt ?? DEFAULT_ALT[variant];
+  const style = size != null ? { width: `${size}px`, height: "auto" } : undefined;
+
+  if (theme === "light" || theme === "dark") {
+    const src = paths[theme];
+    return (
+      <span className={cn("inline-block", className)} {...rest}>
+        <img src={src} alt={resolvedAlt} style={style} draggable={false} />
+      </span>
+    );
+  }
+
+  // theme === "auto" — render both, let Tailwind dark: variant toggle visibility.
+  return (
+    <span className={cn("inline-block", className)} {...rest}>
+      <img
+        src={paths.light}
+        alt={resolvedAlt}
+        style={style}
+        draggable={false}
+        className="block dark:hidden"
+      />
+      <img
+        src={paths.dark}
+        alt={resolvedAlt}
+        style={style}
+        draggable={false}
+        className="hidden dark:block"
+      />
+    </span>
+  );
+}
+
+export type LogoMarkProps = Omit<LogoProps, "variant">;
+
+export function LogoMark(props: LogoMarkProps) {
+  return <Logo variant="mark" {...props} />;
+}

```

---

### 파일 8: plan/complete/spec-draft-brand-refresh.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/complete/spec-draft-brand-refresh.md b/plan/complete/spec-draft-brand-refresh.md
new file mode 100644
index 00000000..f779619c
--- /dev/null
+++ b/plan/complete/spec-draft-brand-refresh.md
@@ -0,0 +1,475 @@
+---
+worktree: brand-refresh-7a3f12
+started: 2026-05-15
+owner: project-planner
+---
+
+# Spec Draft: spec/6-brand.md §8 정식 개정 (Visual Identity)
+
+본 draft 는 `spec/6-brand.md` §8 (Visual Identity) 의 정식판이다. 현재 §8 은 *"임시 가이드 — 디자이너 협업으로 정식 비주얼 가이드가 마련되면 교체한다"* 상태이며, 본 draft 가 채택되면 그 자리를 대체한다.
+
+## Drop-in 대체 범위 (BLOCK 해소 — 명시)
+
+본 §8 정식판은 현행 `spec/6-brand.md` 의 다음 하위 섹션 전체를 **삭제하고** 본 draft 의 §8.1–§8.6 으로 **대체**한다. 부분 병합 금지.
+
+- 현행 §8.1 **컬러 (1차 제안)** — 폐기 (6개 토큰 모두 §8.2 신 토큰으로 대체. 매핑 표는 본 draft §8.2.5)
+- 현행 §8.2 **타이포그래피** — 폐기 (워드마크 폰트·weight·자간 정의가 본 draft §8.3 으로 전면 재정의)
+- 현행 §8.3 **로고 사용 규정 (초안)** — 폐기 (특히 *"단색 또는 단색 반전만 허용"* 조항 무효. 본 draft §8.4.4 의 2-tone 시그니처 채택으로 대체)
+- 현행 §8.4 **어조와 스타일** — 본 draft §8.5 로 위치만 이동 (내용 동일)
+
+§8 외 섹션(§1–§7, §9, §10 이하) 은 본 draft 의 영향 범위가 아니며, §9 변경 이력에 행 1개를 추가한다.
+
+## 변경 요약
+
+1. **모티프 전환**: 덩굴 + 잎 곡선 → **노드 그래프 (node graph forming a flow tree)**. 제품의 Core Concept (`Living Workflow`, `Agent-Native Nodes`) 을 형상으로 직접 표현.
+2. **컬러 정식화**: 컨셉 4-step Green ramp 를 정식 토큰으로 도입 (`vine-300 ~ vine-900` + neutral + dark).
+3. **다크 모드 토큰 신설**: 이번 개정에서 light/dark 페어 동시 정식 도입.
+4. **워드마크 2-tone 허용**: `clem**vi**on` 의 `vi` 강조 (weight 600 + vine-700) 를 정식 시그니처로 보존. *"단색만 허용"* 규정 개정.
+5. **서브카피 상시화**: `AGENTIC WORKFLOW` 서브카피를 풀로고에 상시 부착.
+6. **자산 9종 정식화**: full(light/dark), mark(light/dark), wordmark, favicon, app icon, apple-icon, OG image.
+
+원본 컨셉: `temp/clemvion_logo_concepts.html` (gitignored, 사용자 보관).
+
+연관 spec 동기화 (본 Stage 1 안에서 함께 처리):
+
+- `spec/2-navigation/_layout.md` §2.1 사이드바 로고 행 — expanded/collapsed 변종 규칙 추가
+- `spec/2-navigation/10-auth-flow.md` §1 배경 기술 — "브랜드 색상 또는 그래디언트" → "`soil-50` 또는 `vine-700` 단색 (그라데이션 금지, §8.4.4 참조)" 로 구체화. `[Logo]` 자리에 변종 참조 주석 추가.
+
+---
+
+## §8 정식 개정안 (drop-in 대체)
+
+> 본 draft 의 아래 ## 8. ~ ## 9. 와 ## Rationale 가 `spec/6-brand.md` 의 현 §8(임시), §9(변경 이력) 행 추가, 신규 ## Rationale 섹션 본문으로 그대로 들어간다.
+
+---
+
+## 8. Visual Identity
+
+### 8.1 디자인 모티프
+
+Clemvion 의 로고는 워크플로우의 **노드 그래프** 그 자체를 형상화한다. 중앙의 수직 흐름선(spine), 좌우로 뻗은 분기선(branches), 그리고 그래프 위에 흩어진 원형 노드들이 한 덩어리로 잎/흐름의 형태를 이룬다.
+
+- spine — 중앙 수직 흐름 (Living Workflow 의 *변하지 않는 주축*)
+- branches — 좌우로 뻗은 분기 (Agent-Native Nodes 의 *판단·적응*)
+- nodes — 각 단계의 실행 단위 (`Deep Integration`)
+
+이 모티프는 *"흐름은 자라나야 한다"* 는 Brand Story (§2) 의 시각적 환원이다.
+
+### 8.2 컬러 토큰
+
+#### 8.2.1 Vine Ramp — Primary (라이트 모드)
+
+| 토큰 | HEX | 역할 |
+| --- | --- | --- |
+| `vine-900` (Deep Vine) | `#1a4f2c` | 루트 노드, 텍스트 강조, 다크 액션 hover |
+| `vine-800` (Spine) | `#2a7040` | 중앙 흐름 stroke (mark 내부) |
+| `vine-700` (Primary) | `#1e7a42` | **주요 액션**, 워드마크 `vi` 강조, 1차 브랜드 컬러 |
+| `vine-600` (Branch) | `#2a8a48` | 1차 분기 노드 |
+| `vine-500` (Leaf) | `#3a9a58` | 2차 분기 노드, 보조 강조 |
+| `vine-400` (Sprout) | `#4ab868` | 하위 분기 노드, success state |
+| `vine-300` (Mist) | `#5ab872` | 외곽 라인, 서브카피 |
+
+#### 8.2.2 Neutral — 라이트 모드
+
+| 토큰 | HEX | 역할 |
+| --- | --- | --- |
+| `ink` | `#0e1a12` | 본문 텍스트, 워드마크 base |
+| `ink-60` | `#0e1a12` @ 60% opacity | 보조 텍스트 (옛 `Bark` 대체) |
+| `ink-40` | `#0e1a12` @ 40% opacity | 비활성 텍스트, hint |
+| `soil-50` | `#f7f8f6` | 페이지 배경 |
+| `soil-100` | `#eef5ec` | 카드/마크 배경 (라운드된 mark 컨테이너 fill) |
+| `vine-border` | `#e4e8e0` | 카드 보더 (Tailwind/Shadcn `--border` 와 충돌 방지 위해 `vine-border` 로 명명) |
+
+#### 8.2.3 Dark Mode
+
+| 토큰 | HEX | 역할 |
+| --- | --- | --- |
+| `vine-dark-bg-base` | `#0e1210` | 페이지 배경 |
+| `vine-dark-bg-elevated` | `#111e14` | 카드/마크 컨테이너 배경 |
+| `vine-dark-mid` | `#1e4a2a` | 스파인 조인트 (톤 다운된 점) |
+| `vine-dark-spine` | `#3aae58` | 다크 spine stroke |
+| `vine-dark-primary` | `#4fce72` | 다크 액션, 1차 분기 노드 |
+| `vine-dark-leaf` | `#7de890` | 다크 2차 분기 노드 |
+| `vine-dark-accent` | `#6edc8e` | 다크 워드마크 `vi` 강조 |
+| `vine-dark-glow` | `#9efab2` | 루트 노드 (가장 밝은 강조점) |
+| `text-on-dark` | `#e8f5ec` | 다크 본문 텍스트, 워드마크 base (Tailwind `text-{shade}` 및 `dark:` variant 와 충돌 방지 위해 `text-on-dark` 로 명명) |
+
+#### 8.2.4 코드 토큰 매핑 (구현 위임 정책)
+
+본 §8.2 는 **시각 토큰의 의미·HEX 정의**다. CSS 변수 명(`frontend/src/app/globals.css` 의 `--primary`, `--background`, `--foreground`, `--border`, `--muted-foreground` 등) 및 Tailwind theme key 로의 매핑은 `developer` skill 의 Stage 2 (`plan/in-progress/brand-refresh-impl.md`) 에서 수행한다. 그 이유는 §Rationale R-10 참고.
+
+매핑 시 권장 방향 (구현자 결정):
+
+- `vine-700` → `--primary` (현행 HSL `222.2 47.4% 11.2%` 폐기)
+- `ink` → `--foreground`
+- `ink-60` / `ink-40` → `--muted-foreground` 등 보조 토큰
+- `soil-50` → `--background`
+- `soil-100` → `--card`
+- `vine-border` → `--border`
+- `vine-dark-*` → 다크 :root 페어
+- `text-on-dark` → `--foreground` (다크 모드)
+
+#### 8.2.5 폐기된 토큰
+
+이전 §8.1 (임시) 의 다음 토큰은 본 개정 발효와 함께 폐기된다. 코드/문서/디자인 자산에서 발견 시 신 토큰으로 마이그레이션한다. (근거: R-1, R-7 참조)
+
+| 폐기 토큰 | 폐기 HEX | 대체 토큰 |
+| --- | --- | --- |
+| Vine Green (Primary) | `#1F8A4C` | `vine-700` `#1e7a42` |
+| Deep Forest | `#0F3D2A` | `vine-dark-bg-elevated` `#111e14` |
+| Bud Lime | `#A8D86F` | `vine-400` `#4ab868` |
+| Bark | `#6B5544` | 제거. 텍스트 보조는 `ink-60` / `ink-40` (§8.2.2) |
+| Soil | `#F4F1EC` | `soil-50` `#f7f8f6` |
+| Ink | `#111111` | `ink` `#0e1a12` |
+
+> 잔재 검출 명령(Stage 2 마무리 시 0건 확인): `grep -rn 'Vine Green\|Bud Lime\|Deep Forest\|#1F8A4C\|#A8D86F\|#0F3D2A\|#6B5544\|#F4F1EC' spec/ frontend/`
+
+#### 8.2.6 일시 불일치 허용 윈도우
+
+본 §8 발효 시점부터 Stage 2 (`brand-refresh-impl.md`) 완료까지, `frontend/` 의 CSS 변수·SVG 자산은 일시적으로 spec 의 신 토큰과 불일치할 수 있다. 이는 Stage 2 마무리에서 §8.2.5 의 grep 0 건 조건으로 해소된다.
+
+### 8.3 타이포그래피 (현행 §8.2 전면 대체)
+
+| 용도 | 폰트 | 비고 |
+| --- | --- | --- |
+| 본문·UI | **Geist Sans** | 기존 `next/font/google` 유지 |
+| 코드·모노 | **Geist Mono** | 기존 유지 |
+| 워드마크 base | system sans-serif (`Helvetica Neue`, `Helvetica`, `Arial`) | weight **200**, letter-spacing `-0.5px`, font-size 26px (full logo 기준) |
+| 워드마크 accent (`vi`) | 동일 폰트 | weight **600**, color = `vine-700` (light) / `vine-dark-accent` (dark) |
+| 서브카피 (`AGENTIC WORKFLOW`) | monospace (`Courier New`) | font-size 8px, letter-spacing 3px, uppercase, color = `vine-300` (light) / `vine-dark-primary` (dark) |
+
+> 옛 §8.2 "워드마크 = Geist Sans Medium / 자간 `-0.01em`" 정의는 본 표로 **전면 대체**. 워드마크 svg 가 fontFamily 에 시스템 폰트 스택을 명시하는 이유는 Geist 미설치 환경에서의 weight 200/600 fallback 안정성 (R-11 참조).
+
+### 8.4 로고 시스템
+
+#### 8.4.1 변종 매트릭스
+
+| 변종 | 정식 경로 | 사용처

... (truncated due to prompt size limit) ...

---

### 파일 9: plan/in-progress/brand-refresh-impl.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/brand-refresh-impl.md b/plan/in-progress/brand-refresh-impl.md
new file mode 100644
index 00000000..efaedbe2
--- /dev/null
+++ b/plan/in-progress/brand-refresh-impl.md
@@ -0,0 +1,171 @@
+---
+worktree: brand-refresh-7a3f12
+started: 2026-05-15
+owner: developer
+---
+
+# Plan: Brand Refresh — Stage 2 (자산·코드 구현)
+
+Stage 1 (`spec/6-brand.md` §8 정식 개정) 의 인수인계를 받아, 신 brand spec 에 맞게 자산을 생성하고 코드에 통합한다.
+
+## 컨텍스트
+
+- **Stage 1 산출물**: `spec/6-brand.md` §8 정식판 (Visual Identity), `spec/2-navigation/_layout.md` §2.1 동기화, `spec/2-navigation/10-auth-flow.md` §1 동기화.
+- **사전 일관성 검토**: 1차 `review/consistency/2026/05/15/18_25_10/`, 2차 `review/consistency/2026/05/15/18_36_51/` (BLOCK: NO).
+- **원본 컨셉 자산**: `temp/clemvion_logo_concepts.html` (gitignored, 사용자 보관). inline SVG 가 light/dark 페어로 들어있음.
+- **현재 코드 상태**: `frontend/public/logo.svg`·`logo-mark.svg`·`frontend/src/app/icon.svg`·`favicon.ico` 는 옛 덩굴 곡선 자산이며 코드에서 거의 참조되지 않음. `frontend/src/app/globals.css` 의 `--primary` 는 generic HSL — brand spec 과 매핑 안 됨.
+
+## 0. 착수 전 의무 절차
+
+- [ ] **현재 worktree 확인** — main 워크트리에서 진입 금지. 본 plan 의 worktree 는 `brand-refresh-7a3f12`.
+- [ ] **`/consistency-check --impl-prep spec/6-brand.md` 호출** (`developer` skill 의무). Critical 0 건 확인 시 착수.
+- [ ] **Stage 1 산출물 재읽기** — `spec/6-brand.md` §8 (특히 §8.2 컬러 토큰, §8.4 로고 시스템, §8.6 자산 마이그레이션) 과 `_layout.md §2.1`, `10-auth-flow.md §1`.
+
+---
+
+## 1. 자산 생성 (§8.4.1 의 9종)
+
+원본은 `temp/clemvion_logo_concepts.html` 의 inline SVG. 각각 별도 파일로 추출하고 viewBox·색을 spec 토큰과 정렬한다.
+
+### 1.1 SVG 자산 (5종)
+
+- [ ] `frontend/public/logo.svg` — Full logo (light). viewBox `260×80`. mark + wordmark + sub-copy 3요소. 색은 §8.2.1 / §8.2.2 의 light 토큰.
+- [ ] `frontend/public/logo-dark.svg` — Full logo (dark). 동 viewBox. 색은 §8.2.3 의 dark 토큰.
+- [ ] `frontend/public/logo-mark.svg` — Icon mark (light, 96px master).
+- [ ] `frontend/public/logo-mark-dark.svg` — Icon mark (dark, 96px master).
+- [ ] `frontend/public/logo-wordmark.svg` — Wordmark only (sub-copy 없음). 라이트 변종. 다크 변종은 `<Logo />` 컴포넌트의 `currentColor` 활용 또는 추후 분리.
+
+SVG 작성 시 주의:
+- 워드마크 `<text>` 의 fontFamily 에 `Helvetica Neue, Helvetica, Arial, sans-serif` 시스템 스택 명시 (§8.3, R-11).
+- 워드마크 weight: base 200 / accent `vi` 600. `<tspan font-weight="600" fill="...">vi</tspan>` 활용.
+- sub-copy `AGENTIC WORKFLOW` 은 Courier New / 8px / letter-spacing 3px / uppercase.
+
+### 1.2 Favicon multi-size 합성
+
+- [ ] **16px 전용 vector 신규 작성** — 96px master 의 단순 축소 금지 (§8.4.2). 노드 ≤ 4 / 라인 ≤ 3 으로 단순화. SVG 로 작업 후 PNG 16×16 export.
+- [ ] **32px vector** — master 의 축소판 사용 가능.
+- [ ] **48px vector** — master 의 축소판 사용 가능.
+- [ ] `frontend/src/app/favicon.ico` — 위 3개 사이즈를 합성한 multi-size .ico 생성. ImageMagick / `png-to-ico` 등 도구 사용 가능.
+- [ ] `frontend/src/app/icon.svg` — Next.js metadata 용 32px SVG (단일 사이즈).
+
+### 1.3 PNG 자산
+
+- [ ] `frontend/src/app/apple-icon.png` — 180×180 PNG. light 모드 mark 를 배경 padding 16px 정도와 함께 배치. iOS 가 코너 라운드를 자동 적용하므로 SVG mark 의 `rx` 는 제거하거나 0 으로.
+- [ ] `frontend/src/app/opengraph-image.png` — 1200×630 PNG. Full logo (light) 중앙 배치 + 좌상단/우하단 노드 그래프 모티프 배경. soil-50 배경.
+
+---
+
+## 2. CSS 토큰 매핑 (§8.2.4 의 권장 방향 적용)
+
+`frontend/src/app/globals.css` 의 `:root` 와 `.dark` (또는 `[data-theme="dark"]`) 페어를 정리한다.
+
+- [ ] **현행 generic HSL `--primary` (`222.2 47.4% 11.2%`) 폐기** → §8.2.1 의 `vine-700` (`#1e7a42`) HSL 변환값으로 교체.
+- [ ] 라이트 모드 `:root` 매핑:
+  - `--primary` ← `vine-700`
+  - `--background` ← `soil-50`
+  - `--card` ← `soil-100`
+  - `--foreground` ← `ink`
+  - `--muted-foreground` ← `ink-60` 또는 `ink-40`
+  - `--border` ← `vine-border`
+- [ ] 다크 모드 페어:
+  - `--primary` ← `vine-dark-accent`
+  - `--background` ← `vine-dark-bg-base`
+  - `--card` ← `vine-dark-bg-elevated`
+  - `--foreground` ← `text-on-dark`
+  - 기타 §8.2.3 대응표 그대로
+- [ ] **HSL/RGB 표현 일관성** — Tailwind / Shadcn 컨벤션 (`hsl(var(--primary))`) 을 유지하려면 HEX → HSL 변환 후 공백 구분 표기 사용.
+- [ ] **주석으로 매핑 명시** — 각 CSS 변수 옆에 brand 토큰 이름 주석 (`/* vine-700 from spec/6-brand.md §8.2.1 */`).
+- [ ] **Tailwind theme 갱신** (있는 경우) — `tailwind.config` 의 `colors` 에 `vine-300 ~ vine-900` ramp 와 `vine-dark-*` 추가.
+
+검증:
+- [ ] 매핑 후 dev server 가동 → 사이드바·인증 화면이 신 컬러로 렌더되는지 확인.
+
+---
+
+## 3. 컴포넌트 (`<Logo />`, `<LogoMark />`)
+
+새 컴포넌트 위치: `frontend/src/components/ui/logo.tsx` (Shadcn ui 그룹과 일관).
+
+- [ ] `<Logo />` — props:
+  - `variant?: "full" | "mark" | "wordmark"` (default: `"full"`)
+  - `theme?: "light" | "dark" | "auto"` (default: `"auto"` — `prefers-color-scheme` 또는 next-themes provider 사용)
+  - `size?: number` (px, default: full=160 / mark=32 / wordmark=120)
+  - 내부적으로 `<Image src=... alt="Clemvion" />` 또는 직접 `<svg>` 임베드. Next.js `<Image>` 권장 (`unoptimized` 옵션 svg 에서 검토).
+- [ ] alt 속성: full/wordmark = `"Clemvion — Agentic Workflow"`, mark = `"Clemvion"`.
+- [ ] dark variant 자동 전환 시 client component (`"use client"`) 필요. server-side rendering 일관성 위해 className-based 다크모드 (Tailwind `dark:` variant) 활용.
+
+---
+
+## 4. UI 자리 통합 (§8.4.6 의 5개 자리)
+
+### 4.1 사이드바 (`frontend/src/components/layout/sidebar.tsx`)
+
+- [ ] 사이드바 최상단에 로고 슬롯 추가. 현재는 워크스페이스 셀렉터부터 시작 — 그 위에 배치.
+- [ ] expanded (`!collapsed`) → `<Logo variant="full" theme="auto" />`
+- [ ] collapsed → `<Logo variant="mark" theme="auto" />`
+- [ ] 로고 wrapper 에 `<Link href="/dashboard">` 로 감싸 클릭 시 dashboard 이동 (§8.4.6, `_layout.md §2.1`).
+
+### 4.2 인증 화면 (`frontend/src/app/(auth)/layout.tsx` 또는 폼 컴포넌트)
+
+- [ ] `(auth)/layout.tsx` 의 카드 컨테이너 위에 `<Logo variant="full" theme="light" />` 중앙 배치.
+- [ ] 배경을 현재 그라데이션 → `soil-50` 단색으로 교체 (`bg-gradient-to-br ...` 제거, `bg-[hsl(var(--background))]` 또는 `bg-soil-50`).
+- [ ] 영향 받는 페이지: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`.
+
+### 4.3 Next.js metadata (favicon, apple-icon, OG)
+
+- [ ] `frontend/src/app/layout.tsx` 의 `metadata` 객체에 `icons` 명시:
+  ```ts
+  icons: {
+    icon: [
+      { url: "/favicon.ico" },
+      { url: "/icon.svg", type: "image/svg+xml" },
+    ],
+    apple: "/apple-icon.png",
+  },
+  openGraph: {
+    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
+  },
+  ```
+  (Next.js 자동 인식에만 의존하지 않고 명시 — 자산 변경 시 cache 무효화 명확화)
+- [ ] `metadata.title` / `description` 도 §8.5 의 어조와 일치하는지 확인.
+
+### 4.4 README.md
+
+- [ ] 프로젝트 루트 `README.md` 헤더에 full logo (light) svg 임베드 (`<img src="frontend/public/logo.svg" alt="Clemvion — Agentic Workflow">` 또는 마크다운 이미지 문법).
+
+---
+
+## 5. 회귀 테스트 (`make e2e-test`)
+
+- [ ] **Playwright 시각 회귀** — 사이드바 collapsed/expanded, 인증 카드 (login/register/forgot/reset/verify-email), dashboard 헤더. 스냅샷 baseline 갱신은 같은 PR 안에서 처리.
+- [ ] **favicon HTML 검증** — `<head>` 안의 `<link rel="icon">`, `<link rel="apple-touch-icon">` 정상 노출 확인.
+- [ ] **다크 모드 토글 시각 회귀** — theme switcher 가 이미 구현되어 있다면 같이 검증, 없으면 prefers-color-scheme 매뉴얼 토글.
+
+---
+
+## 6. 마무리 검증 (Stage 2 종료 조건)
+
+- [ ] **§8.2.5 grep 0 건**:
+  ```bash
+  grep -rnE '\bVine Green\b|\bBud Lime\b|\bDeep Forest\b|\bBark\b|\bSoil\b|#1F8A4C|#A8D86F|#0F3D2A|#6B5544|#F4F1EC|#111111' spec/ frontend/
+  grep -rnE '\bInk\b' spec/ frontend/
+  ```
+  (단, spec/6-brand.md §8.2.5 의 폐기 매트릭스 자체는 의도적으로 보존되어 잡힘 — 그 행 제외 후 0 건 검증)
+- [ ] **`spec/6-brand.md §8.2.6` 일시 불일치 윈도우 종료** — 코드 토큰과 spec 토큰이 일치함을 확인.
+- [ ] **`/ai-review` 호출** (developer skill 의무) — Critical 0 건 확인.
+- [ ] **본 plan 을 `plan/complete/brand-refresh-impl.md` 로 `git mv`**.
+
+---
+
+## 7. PR 생성
+
+- [ ] PR 제목: `feat(brand): refresh visual identity — node graph logo + Vine ramp tokens`
+- [ ] 본문 요약: Stage 1 (spec) + Stage 2 (자산·코드) 묶음으로 PR 생성. spec/6-brand.md §9 변경 이력 인용.
+- [ ] reviewers: 사용자.
+
+---
+
+## Rationale 검증 (Stage 2 종료 후)
+
+- [ ] `spec/6-brand.md` R-1 ~ R-12 의 의도가 코드/자산에 정확히 반영되었는지 self-review.
+- [ ] 특히 R-8 (네이밍), R-11 (system 폰트 스택), R-6 (16px 별도 vector) 는 구현 디테일이므로 specific 검증.

```

---

### 파일 10: plan/in-progress/spec-update-brand-followup.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/spec-update-brand-followup.md b/plan/in-progress/spec-update-brand-followup.md
new file mode 100644
index 00000000..aa2d03b2
--- /dev/null
+++ b/plan/in-progress/spec-update-brand-followup.md
@@ -0,0 +1,53 @@
+---
+worktree: brand-refresh-7a3f12
+started: 2026-05-15
+owner: developer (proposing to project-planner)
+---
+
+# Spec Update Proposal: Brand Refresh Followup
+
+본 plan 은 `developer` 가 Stage 2 구현 중 spec 수정이 필요하다고 판단한 항목을 `project-planner` 로 위임하기 위한 노트다. 출처: `review/consistency/2026/05/15/18_49_57/SUMMARY.md` (impl-prep 검토).
+
+## 제안 항목
+
+### P-1. `spec/6-brand.md` 제목에서 `PRD:` prefix 제거
+
+**현재**: `# PRD: 브랜드 가이드 — Clemvion`
+
+**제안**: `# 브랜드 가이드 — Clemvion`
+
+**근거**: docs-consolidation (2026-05-12) 이후 *옛 PRD* 라는 표현은 흡수 시점에만 사용하고, 현행 문서 제목에는 두지 않는 것이 CLAUDE.md "정보 저장 위치" 규약 정신. 다른 spec 들(`spec/0-overview.md`, `spec/2-navigation/_layout.md` 등) 은 모두 `PRD:` prefix 없는 평이한 제목.
+
+**영향**: 제목 한 줄 수정. 내부 링크는 깨지지 않음 (앵커는 본문 헤딩 기반).
+
+### P-2. `spec/0-overview.md §3.4` 상태 색상 매핑을 brand 토큰으로 명시
+
+**현재**: §3.4 에서 success/active/error 상태 배지의 색을 일반 단어("초록", "주황" 등) 로만 기술.
+
+**제안**: 각 상태 색이 어느 brand 토큰에 대응하는지 각주 또는 인라인으로 명시 (예: success → `vine-400`).
+
+**근거**: developer 가 상태 배지 구현 시 즉흥 색상 선택을 피하기 위해. 단일 진실은 `spec/6-brand.md §8.2.1`.
+
+**영향**: §3.4 표·텍스트에 토큰명 추가. brand spec §8.4.6 의 노출 자리 매트릭스에도 "상태 배지 색" 행 추가 검토.
+
+### P-3. `spec/2-navigation/10-auth-flow.md §1` HEX 하드코딩 제거
+
+**현재** (Stage 1 에서 본인이 추가한 행):
+
+```
+- 배경: `soil-50` (`#f7f8f6`) 단색. 그라데이션 금지...
+```
+
+**제안**: HEX 부분 제거.
+
+```
+- 배경: `soil-50` 단색. 그라데이션 금지. HEX 정의는 `spec/6-brand.md §8.2.2`...
+```
+
+**근거**: 토큰명만 두면 brand spec 의 HEX 변경 시 자동 동기화. HEX 를 라우트 spec 에 박으면 단일 진실 원칙 위반 위험.
+
+**영향**: 한 줄 수정.
+
+## 우선순위
+
+세 항목 모두 비차단 (BLOCK: NO 확인됨). Stage 2 구현 진행 후 PR 단계에서 함께 처리하거나, 별도 작은 spec PR 로 분리 가능. project-planner 가 정함.

```

---

### 파일 11: review/consistency/2026/05/15/18_25_10/_prompts/convention_compliance.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 12: review/consistency/2026/05/15/18_25_10/_prompts/cross_spec.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 13: review/consistency/2026/05/15/18_25_10/_prompts/naming_collision.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 14: review/consistency/2026/05/15/18_25_10/_prompts/plan_coherence.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 15: review/consistency/2026/05/15/18_25_10/_prompts/rationale_continuity.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 16: review/consistency/2026/05/15/18_25_10/_retry_state.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_25_10/_retry_state.json b/review/consistency/2026/05/15/18_25_10/_retry_state.json
new file mode 100644
index 00000000..e4edc6c6
--- /dev/null
+++ b/review/consistency/2026/05/15/18_25_10/_retry_state.json
@@ -0,0 +1,58 @@
+{
+  "session_dir": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_25_10",
+  "summary_subagent_type": "consistency-summary",
+  "summary_output_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_25_10/SUMMARY.md",
+  "subagent_invocations": [
+    {
+      "name": "cross_spec",
+      "subagent_type": "cross-spec-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_25_10/_prompts/cross_spec.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_25_10/cross_spec/review.md"
+    },
+    {
+      "name": "rationale_continuity",
+      "subagent_type": "rationale-continuity-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_25_10/_prompts/rationale_continuity.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_25_10/rationale_continuity/review.md"
+    },
+    {
+      "name": "convention_compliance",
+      "subagent_type": "convention-compliance-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_25_10/_prompts/convention_compliance.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_25_10/convention_compliance/review.md"
+    },
+    {
+      "name": "plan_coherence",
+      "subagent_type": "plan-coherence-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_25_10/_prompts/plan_coherence.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_25_10/plan_coherence/review.md"
+    },
+    {
+      "name": "naming_collision",
+      "subagent_type": "naming-collision-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_25_10/_prompts/naming_collision.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_25_10/naming_collision/review.md"
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
+    "cross_spec": {"status": "success", "issues": 7, "reset_hint_sec": null},
+    "rationale_continuity": {"status": "success", "issues": 5, "reset_hint_sec": null},
+    "convention_compliance": {"status": "success", "issues": 3, "reset_hint_sec": null},
+    "plan_coherence": {"status": "success", "issues": 4, "reset_hint_sec": null},
+    "naming_collision": {"status": "success", "issues": 5, "reset_hint_sec": null}
+  },
+  "rate_limit_episodes": 0,
+  "total_wait_sec": 0,
+  "wake_history": [],
+  "last_reset_hint_sec": null,
+  "loop_mode": false
+}

```

---

### 파일 17: review/consistency/2026/05/15/18_25_10/convention_compliance/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_25_10/convention_compliance/review.md b/review/consistency/2026/05/15/18_25_10/convention_compliance/review.md
new file mode 100644
index 00000000..32315629
--- /dev/null
+++ b/review/consistency/2026/05/15/18_25_10/convention_compliance/review.md
@@ -0,0 +1,43 @@
+# Convention Compliance Review
+
+**Target**: `plan/in-progress/spec-draft-brand-refresh.md`
+**검토 모드**: spec draft 검토 (--spec)
+**검토 일시**: 2026-05-15
+
+---
+
+## 발견사항
+
+### INFO-1: plan 문서에 spec 본문이 직접 포함된 구조 — spec 파일 경계 혼재
+- **target 위치**: 문서 전체 (`## §8 정식 개정안 (drop-in 대체)` 이하 본문)
+- **위반 규약**: `CLAUDE.md` 명명 컨벤션 및 정보 저장 위치 원칙 — "기술 명세(스펙)는 `spec/<영역>/*.md` 본문"
+- **상세**: `plan/in-progress/` 문서는 작업 추적이 목적이며, 실제 spec 본문(`## 8. Visual Identity` ~ `## Rationale`)이 draft 형태로 plan 문서에 통째로 포함되어 있다. CLAUDE.md 는 spec 본문의 단일 진실 위치를 `spec/<영역>/*.md`로 명시하며 plan 문서는 `plan/in-progress/<name>.md`(진행 추적)로 역할을 구분한다. 단, 문서 자체에 "본 draft 가 채택되면 `spec/6-brand.md` 의 그 자리를 대체한다"고 명시하고 있으므로, 이는 채택 전 임시 보관 목적으로 허용 범위 내라 볼 수 있다. 채택 후 plan 문서에 spec 본문이 잔류한다면 단일 진실 원칙 위반이 된다.
+- **제안**: 현재 draft 상태에서는 허용 가능하나, `spec/6-brand.md`에 반영 완료 후 plan 문서 내 spec 본문은 삭제하거나 링크 참조로 대체한다. "다음 액션 2번" 완료 시점에 plan 본문 정리를 명시적으로 체크리스트에 추가할 것을 권장.
+
+---
+
+### INFO-2: `## Rationale` 섹션 위치 — `## 9` 이후에 별도 최상위 헤딩으로 기술
+- **target 위치**: `## Rationale (신규 섹션 — ## 9 직후 추가)` (line ~231)
+- **위반 규약**: `CLAUDE.md` 프로젝트 스펙 문서 섹션 — "`## Rationale` — 결정의 배경·근거·폐기된 대안. **spec 문서 끝에** 위치"
+- **상세**: CLAUDE.md는 Rationale 을 "해당 spec 문서 끝의 `## Rationale` 섹션"으로 정의한다. 본 draft의 Rationale 는 `## 9. 변경 이력` 직후에 동일 레벨 `## Rationale`로 배치되어 있어 규약 위치와 정합한다. 그러나 draft 문서 안에서는 plan 내용(`## Stage 2 인수인계` 등)이 Rationale 뒤에 이어지므로, 실제 `spec/6-brand.md` 반영 시 Rationale가 해당 spec 파일의 **마지막 섹션**인지 확인이 필요하다.
+- **제안**: `spec/6-brand.md`에 반영 시 `## Rationale`가 파일의 최종 섹션임을 확인한다. 현재 `spec/6-brand.md`에 기존 섹션이 있다면 Rationale 뒤에 다른 섹션이 오지 않도록 배치를 점검한다.
+
+---
+
+### INFO-3: `spec/conventions/` 파일에 대한 직접 참조 없음
+- **target 위치**: draft 전체
+- **위반 규약**: `CLAUDE.md` — "정식 규약(옛 user_memo CONVENTIONS)은 `spec/conventions/<name>.md`에 보관"
+- **상세**: 본 draft는 컬러 토큰, 타이포그래피, 로고 시스템 등 브랜드 시각 규약을 정의하는 문서이다. 현재 `spec/conventions/` 에는 `node-output.md`, `migrations.md`, `cafe24-api-metadata.md`, `swagger.md` 가 있으며, 이 중 본 draft와 직접 연관된 conventions 파일은 없다. 브랜드 규약을 별도 `spec/conventions/brand-tokens.md` 혹은 유사 파일로 분리해야 한다는 요건이 conventions 규약에 명시되어 있지는 않으므로 현재 `spec/6-brand.md` 내 본문 기술은 허용 범위다. 단, 컬러 토큰 네이밍(`vine-700`, `vine-dark-accent` 등)이 CSS/Tailwind 구현 시 conventions 으로 격상될 가능성이 있다.
+- **제안**: 당장 위반은 아니나, Stage 2(developer) 구현 단계에서 CSS 변수 명명 규칙이 확정되면 `spec/conventions/brand-tokens.md`로 분리 여부를 검토한다.
+
+---
+
+## 요약
+
+`plan/in-progress/spec-draft-brand-refresh.md`는 정식 규약(`spec/conventions/**`, `CLAUDE.md`)의 핵심 항목을 직접적으로 위반하지 않는다. 문서 구조(Overview 암묵적 포함, 본문 §8, Rationale R-1~R-8)는 CLAUDE.md 권장 3섹션 구성을 충실히 따르고 있으며, frontmatter에 `worktree`, `started`, `owner` 모두 명시되어 plan 문서 규약도 준수한다. 옛 `prd/`, `memory/` 경로 사용 흔적은 없다. 발견된 3건은 모두 INFO 등급으로, 현재 draft 상태에서 허용 가능하거나 반영 시점 체크리스트 추가를 권장하는 수준이다.
+
+---
+
+## 위험도
+
+LOW

```

---

### 파일 18: review/consistency/2026/05/15/18_25_10/cross_spec/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_25_10/cross_spec/review.md b/review/consistency/2026/05/15/18_25_10/cross_spec/review.md
new file mode 100644
index 00000000..27185cca
--- /dev/null
+++ b/review/consistency/2026/05/15/18_25_10/cross_spec/review.md
@@ -0,0 +1,62 @@
+# Cross-Spec 일관성 검토
+
+검토 대상: `plan/in-progress/spec-draft-brand-refresh.md` (§8 Visual Identity 정식 개정안)
+참조 spec: `spec/6-brand.md`, `spec/2-navigation/_layout.md`, `spec/2-navigation/10-auth-flow.md`, `spec/0-overview.md`
+
+---
+
+## 발견사항
+
+- **[CRITICAL]** 타이포그래피 정의 직접 충돌 — 워드마크 폰트 패밀리
+  - target 위치: §8.3 타이포그래피 표, "워드마크 base" 행
+  - 충돌 대상: `spec/6-brand.md` §8.2 타이포그래피 현행 정의
+  - 상세: 현행 `spec/6-brand.md §8.2` 는 워드마크 폰트를 **"Geist Sans Medium / 자간 `-0.01em`"** 으로 정의한다. draft §8.3 은 동일 자리를 **system sans-serif (`Helvetica Neue`, `Helvetica`, `Arial`) weight 200, letter-spacing `-0.5px`** 으로 완전히 다르게 재정의한다. 폰트 패밀리·weight·자간 세 항목이 모두 불일치한다. draft 가 발효되기 전까지 두 정의가 동시에 존재하며, 구현자는 어느 쪽을 기준으로 삼을지 결정할 수 없다.
+  - 제안: `spec/6-brand.md §8.2` 타이포그래피 섹션 전체를 draft §8.3 내용으로 동시 교체한다. draft §8.3 에 "§8.2 타이포그래피 섹션을 본 내용으로 전면 대체" 문구를 명시적으로 추가해 drop-in 범위를 확정한다.
+
+- **[CRITICAL]** 로고 사용 규정 충돌 — 워드마크 단색 규정 vs 2-tone 허용
+  - target 위치: §8.4.4 워드마크 사용 규정
+  - 충돌 대상: `spec/6-brand.md §8.3 로고 사용 규정 (초안)` — "단색 또는 단색 반전만 허용한다"
+  - 상세: 현행 spec 의 "단색 또는 단색 반전만 허용" 규정은 draft §8.4.4 의 "2-tone 처리 정식 허용, 이전 단색 규정 폐기" 와 직접 모순된다. draft 가 §8 만 대체하더라도, 현행 §8.3 이 같은 파일 안에 남아 있으면 동일 문서 내에 상충 규정이 공존한다.
+  - 제안: `spec/6-brand.md §8.3` 전체를 draft §8.4 로 대체하거나, drop-in 범위에 §8.3 명시적 삭제를 포함한다. draft 본문 도입부의 "본 draft 의 §8 이 현 §8 을 대체" 범위에 §8.3 이 포함됨을 명시한다.
+
+- **[WARNING]** 사이드바 로고 변종 규칙 — `_layout.md §2.1` 과의 동기화 필요
+  - target 위치: §8.4.6 로고 노출 자리, 사이드바 행
+  - 충돌 대상: `spec/2-navigation/_layout.md §2.1 구성` — 로고 영역을 "제품 로고. 클릭 시 대시보드로 이동"으로만 기술하며 expanded/collapsed 변종 분기를 규정하지 않는다.
+  - 상세: draft §8.4.6 은 "expanded → Full logo (light) / collapsed → Icon mark" 를 정식 사양으로 선언하며 "_layout.md §2.1 보다 우선" 을 명시한다. 그러나 `_layout.md §2.1` 자체는 이 분기를 언급하지 않아, 추후 `_layout.md` 만 참조한 구현자는 변종 전환 규칙을 누락할 수 있다. 두 문서가 동시에 살아있는 spec 이므로 각자 독립적으로 참조될 때 일관된 구현이 보장되어야 한다.
+  - 제안: `spec/2-navigation/_layout.md §2.1` 로고 행의 "내용" 컬럼에 "expanded: Full logo (light), collapsed: Icon mark — 변종 상세는 `spec/6-brand.md §8.4.6` 참조" 를 추가한다.
+
+- **[WARNING]** 인증 화면 로고 변종 규정 — `10-auth-flow.md` 와의 동기화 필요
+  - target 위치: §8.4.6, 인증 화면 행
+  - 충돌 대상: `spec/2-navigation/10-auth-flow.md §1 화면 구성 개요` — `[Logo]` 플레이스홀더만 존재하며 어떤 변종을 사용할지 규정 없음
+  - 상세: draft 는 `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` 5개 인증 화면에서 "Full logo (light)" 를 사용하도록 정식 사양화한다. 인증 화면 spec 의 모든 와이어프레임 박스에는 단순히 `[Logo]` 만 표기되어 있어, 두 문서 중 한쪽만 참조하면 사용 변종이 불명확하다. 또한 인증 화면 배경이 "제품 브랜드 색상 또는 그래디언트"로 기술되어 있는데, draft 의 라이트 배경 전용 "Full logo (light)" 만으로 충분한지 배경 색 조합에 따른 예외 여부가 명시되지 않는다.
+  - 제안: `spec/2-navigation/10-auth-flow.md §1` 의 `[Logo]` 관련 설명에 "Full logo (light) 사용 — 상세는 `spec/6-brand.md §8.4.6` 참조" 문구를 추가한다. 배경 색이 다크인 경우를 사용할 계획이 있다면 draft §8.4.6 에 예외 절을 추가한다.
+
+- **[WARNING]** 폐기 토큰의 현행 코드 잔존 — 그라운드 트루스 불일치 가능성
+  - target 위치: §8.2.5 폐기된 토큰, §8.6 임시 자산 마이그레이션
+  - 충돌 대상: `frontend/src/app/globals.css` 및 현행 SVG 자산 (draft 본문 내에서도 언급)
+  - 상세: draft 는 `Vine Green #1F8A4C`, `Deep Forest #0F3D2A`, `Bud Lime #A8D86F`, `Bark #6B5544`, `Soil #F4F1EC`, `Ink #111111` 6개 토큰을 폐기 선언한다. 이 값들은 현재 `frontend/src/app/globals.css` 와 로고 SVG 파일에 하드코딩 되어 있을 가능성이 높다. spec 발효 이후 구현 완료 전 기간 동안 spec 과 코드 사이의 불일치가 발생하며, draft 스스로 §8.6 에서 이 일시 불일치를 허용한다고 기술하고 있다. 그러나 Stage 2 인수인계 항목의 grep 검출 안전망이 plan 문서에만 있고 spec 본문에는 없어, 구현 완료 여부를 spec 만으로는 판단할 수 없다.
+  - 제안: draft §8.6 또는 §8.2.5 에 "본 §8 발효 후 Stage 2 구현 완료 전까지는 코드와 spec 이 일시 불일치 상태다 — `plan/in-progress/brand-refresh-impl.md` 의 완료 확인 후 불일치 해소" 문구를 추가해 관리 상태를 명시한다.
+
+- **[INFO]** `spec/6-brand.md §8` 섹션 번호 체계 변경
+  - target 위치: §8.1 ~ §8.6 (신규), §8.4.5 가 이전 §8.4 어조 가이드를 §8.5 로 밀어냄
+  - 충돌 대상: 현행 `spec/6-brand.md §8.1 컬러` / `§8.2 타이포그래피` / `§8.3 로고 사용 규정` / `§8.4 어조와 스타일`
+  - 상세: 현행 §8.4 "어조와 스타일" 은 draft 에서 §8.5 로 이동된다. draft 는 "§8.4 였던 기존 어조 가이드. 본 개정에서 변경 없음" 이라고 주석을 달지만, 다른 spec 이나 문서가 §8.4 를 직접 앵커 링크(`#84-...`)로 참조하고 있다면 링크가 깨진다. 현재 코퍼스에서 `spec/6-brand.md#8` 을 명시적으로 링크하는 문서는 확인되지 않으나, markdown 앵커는 암묵적 의존 경로이므로 확인 권장이다.
+  - 제안: 개정 적용 전 `grep -r "6-brand.md#8" spec/` 으로 앵커 참조를 확인하고, 발견 시 새 번호로 갱신한다.
+
+- **[INFO]** 인증 화면 배경 서술 — 브랜드 토큰과의 연결 부재
+  - target 위치: (해당 없음 — 기존 spec 의 미정의 영역)
+  - 충돌 대상: `spec/2-navigation/10-auth-flow.md §1` — "배경: 제품 브랜드 색상 또는 그래디언트"
+  - 상세: 인증 화면 배경이 "브랜드 색상 또는 그래디언트" 로 열려 있으나, draft 의 §8.2 에서 그라데이션은 "여전히 금지" (§8.4.4 기준) 이다. 인증 화면 배경에 그라데이션을 적용하면 §8.4.4 의 금지 규정과 충돌할 수 있다.
+  - 제안: `spec/2-navigation/10-auth-flow.md §1` 의 배경 설명을 "soil-50 (`#f7f8f6`) 또는 vine-700 단색 배경 — 그라데이션 금지 (`spec/6-brand.md §8.4.4`)" 로 구체화한다. 또는 draft §8.4.6 의 인증 화면 행에 "배경 색: soil-50 (라이트)" 를 명시한다.
+
+---
+
+## 요약
+
+target draft 는 `spec/6-brand.md §8` 의 Visual Identity 정식 개정안으로, 기술 범위가 브랜드·시각 자산 영역에 집중되어 있어 데이터 모델·API 계약·RBAC 등 다른 spec 영역과의 직접 교차 충돌은 없다. 그러나 동일 파일(`spec/6-brand.md`) 내에 현행 §8.2~§8.3 과의 직접 모순이 두 건 존재한다(CRITICAL): 워드마크 폰트 패밀리·weight·자간의 전면 재정의, 그리고 단색 전용 규정 vs 2-tone 허용의 정면 충돌이다. 이 두 항목은 draft 가 `spec/6-brand.md §8` 에 적용될 때 현행 §8.2~§8.3 이 반드시 동시에 삭제·교체되어야 해소된다 — drop-in 범위 명시가 핵심이다. `_layout.md` 와 `10-auth-flow.md` 에 대해서는 변종 규칙이 draft 에서 새롭게 추가되는 내용이므로 WARNING 수준 동기화가 필요하다. CRITICAL 2건은 draft 를 `spec/6-brand.md` 에 병합하는 순간 자동 해소될 수 있으나, 병합 범위(삭제되는 구 §8 항목 목록)가 draft 에 명시적으로 기술되어야 한다.
+
+---
+
+## 위험도
+
+MEDIUM

```

---

### 파일 19: review/consistency/2026/05/15/18_25_10/meta.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_25_10/meta.json b/review/consistency/2026/05/15/18_25_10/meta.json
new file mode 100644
index 00000000..78992454
--- /dev/null
+++ b/review/consistency/2026/05/15/18_25_10/meta.json
@@ -0,0 +1,12 @@
+{
+  "timestamp": "2026-05-15T18:25:10.887371",
+  "mode": "spec draft 검토 (--spec)",
+  "target_path": "plan/in-progress/spec-draft-brand-refresh.md",
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

### 파일 20: review/consistency/2026/05/15/18_25_10/naming_collision/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_25_10/naming_collision/review.md b/review/consistency/2026/05/15/18_25_10/naming_collision/review.md
new file mode 100644
index 00000000..544dfb1c
--- /dev/null
+++ b/review/consistency/2026/05/15/18_25_10/naming_collision/review.md
@@ -0,0 +1,73 @@
+# 신규 식별자 충돌 검토 — spec-draft-brand-refresh
+
+검토 대상: `plan/in-progress/spec-draft-brand-refresh.md`
+검토 모드: spec draft (--spec)
+검토 일시: 2026-05-15
+
+---
+
+## 발견사항
+
+### [WARNING] `border` — 기존 CSS 변수 `--border` 와 이름 공간 혼동 가능
+
+- **target 신규 식별자**: `border` (Neutral 토큰, `#e4e8e0`, 카드 보더 역할 — §8.2.2)
+- **기존 사용처**: `frontend/src/app/globals.css` 라인 24 / 51 — `--border: 214.3 31.8% 91.4%` (라이트), `--border: 217.2 32.6% 17.5%` (다크). `frontend/src/components/layout/sidebar.tsx` 라인 272 / 278 에서 `border-[hsl(var(--border))]` 클래스로 활성 사용 중.
+- **상세**: target 의 §8.2.2 는 새 Neutral 토큰 이름을 `border` 로 명명하고 있다. 기존 코드베이스에서 `--border` 는 Shadcn/Tailwind 체계의 시맨틱 CSS 변수로 이미 운영 중이다. Stage 2 `developer` 가 이 토큰을 CSS 변수로 매핑할 때 신규 브랜드 `border` 토큰과 기존 `--border` 변수가 같은 이름 공간에서 충돌할 위험이 있다. 브랜드 토큰 `border` → CSS 변수 `--border` 로 1:1 매핑하면 라이트/다크 의미가 달라지고, 두 이름을 구분 없이 사용하면 혼란을 초래한다.
+- **제안**: target 의 Neutral 토큰 이름을 `border` 대신 `vine-border` 또는 `border-default` 처럼 브랜드 네임스페이스를 명시하도록 변경한다. 아니면 §8.2.4 코드 토큰 매핑 절에 "Neutral `border` 토큰은 기존 `--border` CSS 변수로 매핑되어 재정의된다"는 명시적 선언을 추가해 의도적 덮어쓰기임을 문서화한다.
+
+---
+
+### [WARNING] `ink` — 기존 CSS `--foreground` / `--card-foreground` 와 역할 중복·혼동 가능
+
+- **target 신규 식별자**: `ink` (`#0e1a12`, 본문 텍스트·워드마크 base — §8.2.2)
+- **기존 사용처**: `frontend/src/app/globals.css` 라인 6 `--foreground: 0 0% 3.9%` (라이트), `frontend/src/app/icon.svg` 내부에도 임시 브랜드 자산으로 존재하지 않음. `spec/6-brand.md` §8.1 기존 토큰 중 `Ink: #111111` 이 동일 역할로 이미 정의되어 있음.
+- **상세**: `ink` 는 기존 §8.1 의 `Ink (#111111)` 을 계승·재정의한 것이므로 이름 재사용 자체는 의도적이다. 그러나 §8.2.5 폐기 토큰 매트릭스에 `Ink → ink` 교체가 명시되어 있는 반면, CSS 레이어에서 기존 `--foreground` 와의 관계가 명확히 정의되지 않았다. `developer` 가 Stage 2 매핑 시 `ink` 를 별도 변수로 추가할지, `--foreground` 를 재정의할지 스펙에서 결정하지 않으면 두 이름이 병존할 수 있다. 심각도는 CRITICAL 에 미치지 않지만 매핑 명세가 부재해 구현 즉흥화 위험이 있다.
+- **제안**: §8.2.4 에 `ink` → CSS 변수 매핑 방향(예: `--foreground` 재정의 또는 `--ink` 신규 변수 추가 중 선택)을 간략히 주석으로 추가한다. 현재 스펙은 "코드 토큰 이름은 구현 시 결정"으로 위임하고 있으나, `ink` 처럼 기존 변수와 겹칠 수 있는 케이스는 방향성 힌트가 있으면 충돌을 방지한다.
+
+---
+
+### [WARNING] `text-dark` — Tailwind `text-*` 유틸리티 클래스 패턴과 혼동 가능
+
+- **target 신규 식별자**: `text-dark` (다크 모드 본문 텍스트·워드마크 base, `#e8f5ec` — §8.2.3)
+- **기존 사용처**: Tailwind CSS 는 `text-{color}` 패턴을 텍스트 색상 유틸리티 클래스로 예약한다(예: `text-gray-900`, `text-white`). 기존 코드베이스(`frontend/src`) 에서 `text-dark` 클래스 사용 사례는 발견되지 않았으나, Tailwind 의 `text-{shade}` 관례와 이름 구조가 동일하다.
+- **상세**: `text-dark` 를 Tailwind 테마 색상 키로 등록하면 `text-dark` 클래스가 텍스트 색상 유틸리티로 활성화된다. Tailwind 에서 `dark` 는 다크 모드 변형자(variant)로도 사용되므로 `text-dark` 클래스가 `dark:text-*` 패턴과 구분 없이 읽힐 수 있고, 코드 리뷰 시 의미 혼동을 유발한다. CSS 변수로 직접 노출할 경우에도 `--text-dark` 이름은 "dark 테마의 텍스트" 와 "dark 라는 이름의 텍스트 토큰" 중 어느 것인지 불명확하다.
+- **제안**: `text-dark` 를 `text-on-dark` 또는 `wordmark-dark` 처럼 역할을 명시하거나, Vine 네임스페이스를 일관 적용해 `vine-text-dark` 로 변경한다. 기존 `vine-dark-*` 시리즈와 정렬도 맞춰지는 이점이 있다.
+
+---
+
+### [INFO] 폐기 토큰 `Bark` — 대체 지정 없이 `ink opacity 변종` 으로 처리되나 토큰명 미정
+
+- **target 신규 식별자**: §8.2.5 폐기 매트릭스에서 `Bark` → "제거. 텍스트 보조는 `ink` 의 opacity 변종(0.6 / 0.4) 으로 처리"
+- **기존 사용처**: `spec/6-brand.md` §8.1 `Bark (#6B5544)` — 텍스트 보조·보더 역할.
+- **상세**: `Bark` 를 폐기하고 opacity 변종으로 대체하는 전략 자체는 명확하지만, 해당 opacity 변종의 토큰 이름이 본 draft 어디에도 정의되어 있지 않다. Stage 2 `developer` 가 `ink/60`, `--muted-foreground`, `text-[rgba(...)]` 등 제각각으로 구현할 수 있다.
+- **제안**: §8.2.2 Neutral 섹션에 `ink-60` (`ink` at 60% opacity) 와 `ink-40` (`ink` at 40% opacity) 토큰을 명시적으로 추가하거나, 기존 `--muted-foreground` CSS 변수를 `ink` opacity 변종으로 재정의한다는 매핑 방향을 §8.2.4 에 기록한다.
+
+---
+
+### [INFO] 파일 경로 — `logo-wordmark.svg` 신규 추가, 기존 파일 목록과의 중복 확인
+
+- **target 신규 식별자**: `frontend/public/logo-wordmark.svg` (Wordmark only 변종 — §8.4.1)
+- **기존 사용처**: `frontend/public/` 에는 `logo.svg`, `logo-mark.svg` 존재. `logo-wordmark.svg` 는 현재 없음.
+- **상세**: 신규 파일이므로 직접 충돌은 없다. 그러나 §8.6 임시 자산 마이그레이션 항목에 `logo-wordmark.svg` 가 명시되어 있지 않아(기존 4개 자산 교체만 언급), Stage 2 인수인계 목록과 §8.6 이 불일치한다. 누락 발견 시 누락된 자산으로 오인할 수 있다.
+- **제안**: §8.6 의 "신규 추가" 목록에 `logo-wordmark.svg` (및 `logo-dark.svg`, `logo-mark-dark.svg`) 도 명시적으로 포함시켜 Stage 2 항목과 정합성을 맞춘다.
+
+---
+
+### [INFO] `spec/2-navigation/_layout.md` §2.1 — 사이드바 로고 슬롯 기술이 expanded/collapsed 변종을 미정의
+
+- **target 신규 식별자**: §8.4.6 "사이드바 상단 — expanded → Full logo (light) / collapsed → Icon mark"
+- **기존 사용처**: `spec/2-navigation/_layout.md` §2.1 "로고 — 상단. 제품 로고. 클릭 시 `/dashboard`로 이동". 현재 `sidebar.tsx` 라인 280–290 은 `collapsed` 시 텍스트 "C" 를 렌더링.
+- **상세**: `_layout.md` §2.1 은 현재 로고 슬롯을 단순 텍스트 링크로만 기술하며 expanded/collapsed 구분이 없다. target 의 §8.4.6 이 이를 보완하는 정식 사양으로 기능하므로, 두 문서가 같은 슬롯을 다루면서 서로 다른 수준의 명세를 제공한다. 직접적인 식별자 충돌은 아니나, 구현자가 어느 쪽을 우선해야 할지 혼동할 수 있다.
+- **제안**: target §8.4.6 에 "본 규정은 `spec/2-navigation/_layout.md` §2.1 보다 우선한다" 는 명시를 추가하거나, 반영 시 `_layout.md` §2.1 을 expanded/collapsed 표현으로 갱신한다.
+
+---
+
+## 요약
+
+target draft 가 도입하는 신규 색상 토큰(`vine-300~vine-900`, `vine-dark-*`, Neutral 시리즈) 은 코퍼스 전체에서 선점 충돌이 없다. 폐기 토큰 6종과 신 토큰의 1:1 매핑도 §8.2.5 에 정의되어 있어 충돌보다는 교체 의도가 명확하다. 다만 Neutral 토큰 `border` 가 기존 `--border` CSS 변수와, `text-dark` 가 Tailwind `text-{color}` 관례와 이름 구조상 혼동을 일으킬 수 있어 WARNING 2건을 발행한다. `ink` 는 기존 `--foreground` 와의 매핑 방향이 스펙에서 위임되어 있어 구현 즉흥화 위험이 있다. 전반적으로 CRITICAL 수준의 식별자 충돌은 없으며, WARNING 사항을 해소하면 Stage 2 구현 시 충돌 없이 진행 가능하다.
+
+---
+
+## 위험도
+
+LOW

```

---

### 파일 21: review/consistency/2026/05/15/18_25_10/plan_coherence/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_25_10/plan_coherence/review.md b/review/consistency/2026/05/15/18_25_10/plan_coherence/review.md
new file mode 100644
index 00000000..717386b1
--- /dev/null
+++ b/review/consistency/2026/05/15/18_25_10/plan_coherence/review.md
@@ -0,0 +1,44 @@
+# Plan 정합성 검토 — spec-draft-brand-refresh.md
+
+검토 대상: `plan/in-progress/spec-draft-brand-refresh.md`
+검토 모드: spec draft 검토 (--spec)
+검토 일시: 2026-05-15
+
+---
+
+## 발견사항
+
+- **[WARNING]** `spec/2-navigation/_layout.md` §2.1 에 expanded/collapsed 로고 변종 규정 누락
+  - target 위치: `spec-draft-brand-refresh.md` §8.4.6 로고 노출 자리 표 — "사이드바 상단 (`spec/2-navigation/_layout.md` §2.1) | expanded → Full logo (light) / collapsed → Icon mark"
+  - 관련 plan: 직접 관련 plan 없음 (현행 `spec/2-navigation/_layout.md` §2.1 은 "로고 | 상단 | 제품 로고. 클릭 시 대시보드(홈, `/dashboard`)로 이동" 만 명시)
+  - 상세: target draft 는 사이드바 expanded 상태에서 Full logo, collapsed 상태에서 Icon mark 를 쓰도록 정식화하고 있다. 그러나 현재 `spec/2-navigation/_layout.md` §2.1 의 "로고" 행은 클릭 동작만 기술하고, expanded/collapsed 별 변종 전환 규칙을 전혀 담고 있지 않다. 이로 인해 developer 가 Stage 2 구현 시 `spec/6-brand.md` §8.4.6 과 `spec/2-navigation/_layout.md` §2.1 을 동시에 읽을 때 두 spec 이 불일치하는 상황이 발생한다. §8.4.6 은 본 draft 가 `spec/6-brand.md` 에 반영된 뒤에야 확정되므로, `spec/2-navigation/_layout.md` §2.1 의 동반 갱신이 후속 항목으로 누락되어 있다.
+  - 제안: `spec-draft-brand-refresh.md` 의 "다음 액션" 또는 "Stage 2 인수인계 항목"에 "`spec/2-navigation/_layout.md` §2.1 로고 행에 expanded/collapsed 변종 전환 규칙을 추가한다 (project-planner)" 를 명시한다. 또는 `spec/6-brand.md` 반영과 동시에 `spec/2-navigation/_layout.md` §2.1 을 갱신하는 작업을 Stage 1 완료 전에 포함시킨다.
+
+- **[WARNING]** CSS 토큰 이름 확정이 Stage 2 로 완전히 위임되어 있어 Stage 1 spec 의 단일 진실 원칙이 불완전함
+  - target 위치: `spec-draft-brand-refresh.md` §8.2.4 코드 토큰 매핑 — "코드 토큰 이름은 구현 시 결정한다"
+  - 관련 plan: `plan/in-progress/spec-draft-brand-refresh.md` 의 "Stage 2 인수인계 항목 2. CSS 토큰 매핑"
+  - 상세: `spec/6-brand.md` §8.2.4 는 "CSS 변수와 Tailwind theme 으로의 매핑은 developer skill 의 Stage 2 에서 수행한다. 코드 토큰 이름은 구현 시 결정한다" 고 명시한다. 이 자체는 의도된 위임이지만, CLAUDE.md 의 SDD 원칙은 "spec 이 구현보다 선행" 을 요구한다. Stage 2 plan 이 생성되기 전에는 CSS 변수명 결정이 미해결 결정으로 남아 있다. Stage 2 plan 이 생성되지 않은 채로 Stage 1 이 complete 처리될 경우, CSS 변수명을 developer 가 임의로 결정하게 되어 향후 일관성 점검에서 spec 레퍼런스가 없는 토큰이 발생할 수 있다. 현재 `frontend/src/app/globals.css` 의 `--primary` 는 Tailwind 기본(222.2 47.4% 11.2%) 으로 vine-700 과 전혀 다른 값이다.
+  - 제안: `spec-draft-brand-refresh.md` 의 "다음 액션 4번" 을 "본 plan complete 이동 **및** 신규 `plan/in-progress/brand-refresh-impl.md` (Stage 2) 생성을 **동시에** 처리한다" 로 강조한다. Stage 2 plan 생성 전에 본 plan 을 complete 로 이동하지 않도록 순서를 명시적으로 결속한다.
+
+- **[INFO]** `brand-refresh-impl.md` (Stage 2) 가 아직 존재하지 않아 다음 단계 추적이 단절될 가능성
+  - target 위치: `spec-draft-brand-refresh.md` 전체 — "Stage 2 인수인계 항목" 섹션 및 "다음 액션 4번"
+  - 관련 plan: 없음 (Stage 2 plan 미생성 상태)
+  - 상세: target draft 는 Stage 2 에서 처리할 7개 항목(자산 9종 생성·배치, CSS 토큰 매핑, `<Logo />` 컴포넌트 신설, UI 자리 통합, Next.js metadata.icons, 회귀 테스트, README.md 임베드)을 상세히 기술하고 있다. 그러나 해당 항목을 추적할 `plan/in-progress/brand-refresh-impl.md` 가 아직 존재하지 않는다. 본 draft 가 채택(spec 반영)되는 시점과 Stage 2 plan 생성 시점 사이에 공백이 생기면, 7개 구현 항목의 plan 추적이 단절된다.
+  - 제안: 현재 `spec-draft-brand-refresh.md` 의 "Stage 2 인수인계 항목" 내용이 매우 구체적이므로, spec 반영 직후(다음 액션 2번 완료 후) 즉시 `brand-refresh-impl.md` 를 생성하도록 다음 액션 4번에 명시적으로 포함시킨다. 이 메모는 plan 라이프사이클 단절 방지용이다.
+
+- **[INFO]** `bg-monitoring-api-7c2a91` worktree 와 spec/6-brand.md 경합 없음 — 확인 완료
+  - target 위치: target plan frontmatter `worktree: brand-refresh-7a3f12`
+  - 관련 plan: `bg-monitoring-api-7c2a91` worktree 의 `plan/in-progress/` (background-monitoring-api.md 는 해당 worktree 의 `plan/complete/` 에 있음)
+  - 상세: 현재 활성 worktree 는 `brand-refresh-7a3f12` 와 `bg-monitoring-api-7c2a91` 두 개다. `bg-monitoring-api-7c2a91` 는 `spec/6-brand.md` 를 전혀 건드리지 않으며(git diff 확인), 브랜드/로고 관련 plan 도 보유하지 않는다. worktree 충돌 없음.
+
+---
+
+## 요약
+
+target plan `spec-draft-brand-refresh.md` 는 `spec/6-brand.md` §8 임시 가이드를 정식 Visual Identity spec 으로 대체하는 단독 draft 로, 다른 in-progress plan 과의 직접 충돌(미해결 결정 우회, 동일 파일 동시 수정)은 발견되지 않았다. 다만 두 가지 후속 항목 누락이 WARNING 으로 식별된다. 첫째, `spec/2-navigation/_layout.md` §2.1 이 §8.4.6 에서 정식화된 사이드바 expanded/collapsed 로고 변종 규칙을 담고 있지 않아, spec 반영 후 두 문서가 불일치 상태로 남는다. 둘째, CSS 토큰 이름이 "구현 시 결정" 으로 위임된 채 Stage 2 plan 이 미생성 상태이므로, plan complete 이동과 Stage 2 plan 생성이 원자적으로 묶이지 않으면 추적 공백이 생긴다. 두 WARNING 모두 target plan 의 "다음 액션" 또는 plan 라이프사이클 처리 순서를 보완하면 해소 가능하며, spec 반영 자체를 차단할 CRITICAL 사안은 없다.
+
+---
+
+## 위험도
+
+LOW

```

---

### 파일 22: review/consistency/2026/05/15/18_25_10/rationale_continuity/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_25_10/rationale_continuity/review.md b/review/consistency/2026/05/15/18_25_10/rationale_continuity/review.md
new file mode 100644
index 00000000..6260e0aa
--- /dev/null
+++ b/review/consistency/2026/05/15/18_25_10/rationale_continuity/review.md
@@ -0,0 +1,50 @@
+# Rationale 연속성 검토 — brand-refresh spec draft
+
+검토 대상: `plan/in-progress/spec-draft-brand-refresh.md`
+보조 코퍼스: `spec/1-data-model.md`, `spec/2-navigation/1-workflow-list.md`, `spec/2-navigation/4-integration.md`, `spec/2-navigation/9-user-profile.md`, `spec/3-workflow-editor/4-ai-assistant.md` 의 `## Rationale` 발췌
+
+---
+
+### 발견사항
+
+- **[INFO]** 보조 코퍼스 Rationale 과 브랜드 개정안 간 직접적 충돌 없음 — 도메인 분리 확인
+  - target 위치: 문서 전체 (§8.1 ~ §8.6, R-1 ~ R-8)
+  - 과거 결정 출처: `spec/1-data-model.md`, `spec/2-navigation/*.md`, `spec/3-workflow-editor/4-ai-assistant.md` 의 `## Rationale`
+  - 상세: 보조 코퍼스 Rationale 은 execution model, OAuth 통합, user-profile UX, workflow AI 어시스턴트 프롬프트 구조 등 브랜드와 이질적인 도메인을 다루므로, target 문서(Visual Identity 개정)와 직접 충돌하는 항목이 식별되지 않는다.
+  - 제안: 해당 없음.
+
+- **[WARNING]** `§8.4.4` 워드마크 2-tone 허용 — "단색만 허용" 규정 폐기 시 새 Rationale 이 기술됐으나, 폐기 대상 원문 spec 조항이 명시되지 않음
+  - target 위치: `§8.4.4 워드마크 사용 규정` 및 `R-3. 워드마크 2-tone 시그니처 채택 (단색 규정 폐기)`
+  - 과거 결정 출처: 현행 `spec/6-brand.md §8` (임시 가이드) 의 "단색 또는 단색 반전만 허용" 조항
+  - 상세: target 문서 R-3 에서 단색 규정 폐기 근거를 상세히 서술하고 있어 새 Rationale 작성 요건은 충족한다. 그러나 "폐기 대상 원문이 현행 spec 의 어느 섹션·항목이었는지"를 R-3 에서 직접 인용하지 않아, 향후 spec 이력 추적 시 어디서 왔는지 불명확하다.
+  - 제안: R-3 에 "기각된 규정 원출처: `spec/6-brand.md` 구 §8.4 (임시 가이드 시절 조항)" 한 줄을 추가해 이력 추적성을 확보한다.
+
+- **[INFO]** `§8.6 임시 자산 마이그레이션` — 폐기 자산 목록이 코드 경로 레벨에서만 명시되고, 폐기 이유(임시 가이드 출처)가 R-1/R-7 에 분산돼 있음
+  - target 위치: `§8.6` 전체
+  - 과거 결정 출처: 해당 spec 자체의 R-1 (모티프 전환), R-7 (자산 9종 정식화)
+  - 상세: §8.6 본문에서 "이전 임시 자산(덩굴 + 잎 곡선 모티프)은 본 §8 발효와 함께 폐기 대상"이라 명시했고 R-1·R-7 에서 모티프 전환 및 자산 정식화 근거를 기술했다. 연속성 관점에서 Rationale 이 존재하므로 원칙 위반이 아니다. 다만 §8.6 에서 Rationale 항목으로 직접 교차 참조를 달면 문서 간 탐색이 용이해진다.
+  - 제안: §8.6 서두에 `(근거: R-1, R-7 참조)` 한 줄 추가 권장.
+
+- **[INFO]** `§8.2.4 코드 토큰 매핑` — 구현 위임 규약이 spec 본문에 기술됐으나 Rationale 에 별도 언급 없음
+  - target 위치: `§8.2.4 코드 토큰 매핑`
+  - 과거 결정 출처: CLAUDE.md 및 프로젝트 규약 "spec 은 정의, 코드 매핑은 developer skill 이 결정"
+  - 상세: `§8.2.4` 가 "CSS 변수·Tailwind 매핑은 developer skill Stage 2 에서 수행한다. spec 은 HEX 정의를 보유하고 코드 토큰 이름은 구현 시 결정한다"고 명시해 프로젝트 SDD 원칙과 정합한다. Rationale 에 이 결정의 배경을 기록하지 않아도 원칙 위반은 아니지만, 추후 reviewer 가 "왜 코드 이름을 spec 에 고정하지 않았는지" 의문을 가질 수 있다.
+  - 제안: R-7 또는 신규 R-9 에 "spec 은 HEX 의미 토큰만 보유, CSS/Tailwind 이름은 구현 시점 결정 — spec/구현 경계 원칙 준수" 한 줄 추가 권장.
+
+- **[INFO]** `§8.4.6 로고 노출 자리` — `spec/2-navigation/_layout.md §2.1` 과의 우선순위 관계 기술
+  - target 위치: `§8.4.6` 첫 문장 "본 §8 은 다음 자리에서의 로고 노출을 정식 사양으로 둔다 (개별 라우트 spec 보다 우선)"
+  - 과거 결정 출처: `spec/2-navigation/_layout.md §2.1` (직접 Rationale 발췌 미포함이나 관련 spec 으로 참조됨)
+  - 상세: 본 target 이 `_layout.md §2.1` 보다 §8 을 우선 적용한다고 선언하나, 이 우선순위 결정의 근거가 Rationale 에 기록돼 있지 않다. 단, 브랜드 spec 이 개별 라우트 spec 에 우선하는 것은 제품 일관성 원칙상 자연스러운 결정으로, 합의 원칙을 명시적으로 위반하지 않는다.
+  - 제안: R-7 또는 별도 R-8 확장으로 "§8 이 개별 라우트 spec 보다 우선하는 이유: 브랜드 가이드는 제품 전체의 시각 언어 SSOT 이므로 개별 화면 spec 의 로고 처리보다 상위에 둔다" 추가 권장.
+
+---
+
+### 요약
+
+보조 코퍼스로 제공된 spec Rationale 들은 execution model, OAuth/통합, user-profile UX, AI 어시스턴트 등 브랜드와 이질적인 도메인을 다루므로 target 문서(Visual Identity 개정)와 직접적으로 충돌하는 기각된 대안의 재도입이나 합의 원칙 위반은 발견되지 않는다. target 문서 자체의 R-1 ~ R-8 은 모티프 전환·컬러 ramp 확장·2-tone 허용·다크 모드 동시 도입·서브카피 상시 부착·favicon 별도 vector 등 각 결정의 근거와 기각 대안을 충실히 기술해 Rationale 연속성 요건을 대체로 충족한다. 다만 (1) "단색만 허용" 폐기 원문의 spec 내 위치를 R-3 에서 명시하지 않은 점, (2) §8.4.6 우선순위 선언의 Rationale 미기재, (3) §8.2.4 코드 토큰 위임 결정의 Rationale 부재 가 INFO/WARNING 수준의 보완 사항으로 식별된다. 이들은 연속성을 심각하게 훼손하지 않으나, 이력 추적성과 향후 reviewer 가독성을 위해 Rationale 보강이 권장된다.
+
+---
+
+### 위험도
+
+LOW

```

---

### 파일 23: review/consistency/2026/05/15/18_36_51/_prompts/convention_compliance.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 24: review/consistency/2026/05/15/18_36_51/_prompts/cross_spec.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 25: review/consistency/2026/05/15/18_36_51/_prompts/naming_collision.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 26: review/consistency/2026/05/15/18_36_51/_prompts/plan_coherence.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 27: review/consistency/2026/05/15/18_36_51/_prompts/rationale_continuity.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 28: review/consistency/2026/05/15/18_36_51/_retry_state.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_36_51/_retry_state.json b/review/consistency/2026/05/15/18_36_51/_retry_state.json
new file mode 100644
index 00000000..376819ed
--- /dev/null
+++ b/review/consistency/2026/05/15/18_36_51/_retry_state.json
@@ -0,0 +1,52 @@
+{
+  "session_dir": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_36_51",
+  "summary_subagent_type": "consistency-summary",
+  "summary_output_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_36_51/SUMMARY.md",
+  "subagent_invocations": [
+    {
+      "name": "cross_spec",
+      "subagent_type": "cross-spec-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_36_51/_prompts/cross_spec.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_36_51/cross_spec/review.md"
+    },
+    {
+      "name": "rationale_continuity",
+      "subagent_type": "rationale-continuity-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_36_51/_prompts/rationale_continuity.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_36_51/rationale_continuity/review.md"
+    },
+    {
+      "name": "convention_compliance",
+      "subagent_type": "convention-compliance-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_36_51/_prompts/convention_compliance.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_36_51/convention_compliance/review.md"
+    },
+    {
+      "name": "plan_coherence",
+      "subagent_type": "plan-coherence-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_36_51/_prompts/plan_coherence.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_36_51/plan_coherence/review.md"
+    },
+    {
+      "name": "naming_collision",
+      "subagent_type": "naming-collision-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_36_51/_prompts/naming_collision.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_36_51/naming_collision/review.md"
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

### 파일 29: review/consistency/2026/05/15/18_36_51/convention_compliance/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_36_51/convention_compliance/review.md b/review/consistency/2026/05/15/18_36_51/convention_compliance/review.md
new file mode 100644
index 00000000..d71e44a2
--- /dev/null
+++ b/review/consistency/2026/05/15/18_36_51/convention_compliance/review.md
@@ -0,0 +1,93 @@
+# Convention Compliance Review
+
+**대상 문서**: `plan/in-progress/spec-draft-brand-refresh.md`
+**검토 모드**: spec draft 검토 (--spec)
+**검토 시점**: 2026-05-15
+
+---
+
+## 발견사항
+
+### 정식 규약 준수 위반 없음 (주요 항목 모두 통과)
+
+분석 결과, 아래에 명시된 3건의 INFO 수준 개선 제안을 제외하면 정식 규약과의 직접 위반은 발견되지 않았다.
+
+---
+
+- **[INFO]** plan 문서 자체가 spec 본문을 내포하는 혼합 구조
+  - target 위치: 문서 전체 구조 (`## §8 정식 개정안 (drop-in 대체)` 섹션 이하)
+  - 위반 규약: `CLAUDE.md` §정보 저장 위치 — "기술 명세(스펙)"은 `spec/<영역>/*.md` 본문에 두도록 규정
+  - 상세: 현재 plan 문서는 `plan/in-progress/spec-draft-brand-refresh.md` 이지만, `## §8 정식 개정안` 이하에 실제 spec 본문(§8.1~§8.6, §9, Rationale)을 그대로 내장하고 있다. plan 문서가 아닌 `spec/6-brand.md` 에 들어가야 할 내용이 plan 에 통째로 포함된 형태다. 단, 문서 자체가 "draft — 채택 시 spec 에 drop-in 대체" 임을 명확히 선언하고 있으므로 규약 위반이라기보다 draft 운영 패턴으로 용인 가능한 수준이다.
+  - 제안: 현재 구조는 draft 심사·검토 단계이므로 허용 가능하나, `다음 액션` 2번의 "3개 파일 동시 갱신" 이 완료되는 즉시 plan 문서 내 spec 본문 사본이 삭제되거나 `spec/6-brand.md` 로 이동·대체되어야 한다. plan 문서에는 해당 섹션을 "이미 spec 에 반영됨, 상세는 `spec/6-brand.md` §8 참조" 형태로 대체하는 것을 권장한다.
+
+---
+
+- **[INFO]** plan 문서 내 `## Stage 2 인수인계 항목` 섹션 — plan 라이프사이클상 미완 항목 구분 명확화 필요
+  - target 위치: `## Stage 2 인수인계 항목` 및 `## 다음 액션` 섹션
+  - 위반 규약: `CLAUDE.md` §PLAN 문서 라이프사이클 — "미체크 체크박스, TODO, 남은 작업, 다음 단계 등이 하나라도 있으면 `in-progress/`"
+  - 상세: `다음 액션` 1~4번은 numbered list 이며 아직 완료되지 않은 항목들이다. 규약상 `[ ]` 체크박스 형식을 사용해야 complete 판정 자동화(plan_coherence checker)가 가능하다. 현재는 numbered list 로만 표기되어 있어 자동 검출 시 누락될 수 있다.
+  - 제안: `다음 액션` 항목들을 `- [ ]` 체크박스 형식으로 변환한다. Stage 2 인수인계 항목(1~7번)도 동일하게 적용하면 Stage 2 진행 상황 추적이 명확해진다.
+
+---
+
+- **[INFO]** `spec/2-navigation/10-auth-flow.md` §1 갱신안에서 로고 참조 앵커 일관성
+  - target 위치: `## Stage 1 동기화 대상 / S1-B` 섹션, 신규 안 2번째 bullet
+  - 위반 규약: 직접적인 정식 규약 위반은 아니나 `CLAUDE.md` §문서 구조 규약 (단일 진실 원칙)
+  - 상세: S1-B 신규안의 두 번째 bullet 에서 `[spec/6-brand.md §8.4.1]` 를 참조하는 앵커가 `(../6-brand.md#841-변종-매트릭스)` 로 작성되어 있다. `#841-변종-매트릭스` 는 한국어 헤딩 `#### 8.4.1 변종 매트릭스` 를 GitHub Markdown 앵커 규칙으로 변환한 값이어야 하는데, GitHub 는 숫자로 시작하는 헤딩을 앵커 생성 시 숫자 prefix를 포함하지 않을 수 있다. 런타임 링크 깨짐 가능성이 있으나 spec 콘텐츠 품질 문제이지 정식 규약 위반은 아니다.
+  - 제안: S1-B 를 실제 spec 파일에 반영할 때 앵커를 실제 GitHub Markdown 렌더링 결과로 검증한다. 필요시 앵커 없이 파일 경로만 참조하는 방식(`spec/6-brand.md §8.4.1`)으로 단순화한다.
+
+---
+
+## 금지 항목 점검 결과
+
+| 금지 항목 | 점검 결과 |
+| --- | --- |
+| 옛 `prd/` 경로 사용 | 미사용. 위반 없음 |
+| 옛 `memory/` 경로 사용 | 미사용. 위반 없음 |
+| 옛 `user_memo/` 경로 사용 | 미사용. 위반 없음 |
+| `plan/*.md` 최상위 생성 | 미해당 (파일은 `plan/in-progress/` 에 위치) |
+| `plan/complete/archive/from-*/` 신규 생성 | 미해당 |
+| flat 경로 review 생성 (`review/<timestamp>/`) | 미해당 |
+| `claude -p` / SDK 직접 호출 | 미해당 (spec draft 문서) |
+
+## 문서 구조 규약 점검 결과
+
+| 항목 | 점검 결과 |
+| --- | --- |
+| plan frontmatter (worktree, started, owner) | 3필드 모두 존재. 준수 |
+| `plan/in-progress/` 위치 | 준수 |
+| spec draft 내 `## Rationale` 섹션 | `## Rationale` 섹션 존재 (R-1~R-12). 권장 구조 준수 |
+| spec 3섹션 권장 구조 (Overview/본문/Rationale) | draft 내 §8 이 본문 역할, Rationale 별도 섹션. 준수 |
+| `spec/conventions/*.md` 참조 형식 | 해당 없음 (brand spec 은 conventions 를 직접 참조하지 않는 영역) |
+
+## API 문서 규약 점검 결과
+
+본 target 문서는 시각 디자인 spec (색상 토큰, 로고 시스템) 으로 API 문서 규약(Swagger 패턴, request/response DTO 명명)의 적용 대상이 아니다. 해당 없음.
+
+## 출력 포맷 규약 점검 결과
+
+본 target 문서는 노드 Output 또는 API 응답 형식을 정의하지 않는다. `spec/conventions/node-output.md` 및 `spec/conventions/cafe24-api-metadata.md` 의 적용 대상이 아니다. 해당 없음.
+
+## 명명 규약 점검 결과
+
+| 항목 | 기댓값 | 실제값 | 결과 |
+| --- | --- | --- | --- |
+| plan 파일 위치·명명 | `plan/in-progress/<name>.md` (평문) | `plan/in-progress/spec-draft-brand-refresh.md` | 준수 |
+| 참조 spec 경로 | `spec/<영역>/N-name.md` | `spec/6-brand.md` | 준수 |
+| 참조 layout spec 경로 | `spec/<영역>/_layout.md` | `spec/2-navigation/_layout.md` | 준수 |
+| 참조 인증 spec 경로 | `spec/<영역>/N-name.md` | `spec/2-navigation/10-auth-flow.md` | 준수 |
+| Stage 2 plan 경로 (예고) | `plan/in-progress/<name>.md` | `plan/in-progress/brand-refresh-impl.md` | 준수 |
+| worktree 명명 | `<task_name>-<slug>` (kebab-case) | `brand-refresh-7a3f12` | 준수 |
+| logo 자산 경로 | `frontend/public/`, `frontend/src/app/` | §8.4.1 의 9종 경로 모두 해당 경로 준수 | 준수 |
+
+---
+
+## 요약
+
+`plan/in-progress/spec-draft-brand-refresh.md` 는 정식 규약과의 직접적인 충돌 없이 작성되어 있다. frontmatter 의 3필드(worktree, started, owner) 가 모두 채워져 있고, 파일 위치·명명은 CLAUDE.md 규약을 준수한다. 금지된 경로 패턴(`prd/`, `memory/`, `user_memo/`, flat review 경로)은 사용되지 않았으며, 참조하는 spec 파일 경로들도 명명 컨벤션(숫자 prefix, `_layout.md`, `_product-overview.md` 등) 을 따른다. spec 본문과 Rationale 섹션을 plan draft 에 내포하는 구조는 "채택 시 drop-in 대체" 임을 명확히 선언하고 있어 draft 운영 관행으로 용인 가능하다. 발견된 3건은 모두 INFO 수준의 형식 일관성 제안으로, 규약 채택 단계에서의 차단 사유에 해당하지 않는다.
+
+---
+
+## 위험도
+
+**NONE**

```

---

### 파일 30: review/consistency/2026/05/15/18_36_51/cross_spec/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_36_51/cross_spec/review.md b/review/consistency/2026/05/15/18_36_51/cross_spec/review.md
new file mode 100644
index 00000000..5e73c3b3
--- /dev/null
+++ b/review/consistency/2026/05/15/18_36_51/cross_spec/review.md
@@ -0,0 +1,57 @@
+# Cross-Spec 일관성 검토 결과
+
+검토 대상: `plan/in-progress/spec-draft-brand-refresh.md` (spec/6-brand.md §8 정식 개정 draft)
+검토 모드: `--spec`
+검토 시각: 2026-05-15
+
+---
+
+### 발견사항
+
+- **[INFO]** 현행 spec/6-brand.md §8.2 타이포그래피 정의와 draft §8.3의 워드마크 폰트 정의 차이
+  - target 위치: draft §8.3 타이포그래피 표 (워드마크 base 행)
+  - 충돌 대상: `spec/6-brand.md` §8.2 "워드마크 | Geist Sans Medium / 자간 `-0.01em`"
+  - 상세: 현행 §8.2는 워드마크 폰트를 "Geist Sans Medium"으로 정의하지만, draft §8.3은 `system sans-serif (Helvetica Neue, Helvetica, Arial)` weight 200/600 스택으로 전면 대체한다. 이는 의도된 변경(R-11)이며, drop-in 대체 범위에 명시되어 있다. 충돌이 아닌 대체이므로 INFO로 분류.
+  - 제안: 채택 시 §8.3가 §8.2를 완전히 대체함을 확인. 별도 조치 불필요.
+
+- **[INFO]** spec/2-navigation/10-auth-flow.md §1의 배경 기술 "제품 브랜드 색상 또는 그래디언트" 잔존
+  - target 위치: draft S1-B 갱신안 (§426-438)
+  - 충돌 대상: `spec/2-navigation/10-auth-flow.md` §1 "배경: 제품 브랜드 색상 또는 그래디언트"
+  - 상세: 현행 `spec/2-navigation/10-auth-flow.md` §1은 "배경: 제품 브랜드 색상 또는 그래디언트"로 기술되어 있다. Draft는 이를 `soil-50 단색 + 그라데이션 금지`로 구체화하는 S1-B 갱신안을 포함하고 있다. 충돌이 아닌 동기화 대상이며, Stage 1 안에서 함께 처리하도록 draft에 명시되어 있어 처리 경로가 명확하다.
+  - 제안: 채택 시 S1-B를 동일 turn에 `spec/2-navigation/10-auth-flow.md` §1에 반영. 별도 조치 불필요.
+
+- **[INFO]** spec/2-navigation/_layout.md §2.1 로고 행에 expanded/collapsed 변종 규칙 미정의
+  - target 위치: draft §8.4.6 사이드바 행, S1-A 갱신안
+  - 충돌 대상: `spec/2-navigation/_layout.md` §2.1 로고 행 "제품 로고. 클릭 시 대시보드(홈, `/dashboard`)로 이동"
+  - 상세: 현행 `_layout.md` §2.1 로고 행에는 expanded/collapsed 변종 규칙이 없다. Draft §8.4.6은 "expanded → Full logo (light) / collapsed → Icon mark"를 명시하고, S1-A 갱신안이 동기화 텍스트를 제공한다. 충돌이 아닌 추가·구체화이며, Stage 1 동기화 대상으로 명확히 표시되어 있다.
+  - 제안: 채택 시 S1-A를 동일 turn에 `spec/2-navigation/_layout.md` §2.1에 반영.
+
+- **[INFO]** spec/6-brand.md §8.3 "단색 또는 단색 반전만 허용" 조항의 명시적 무효화
+  - target 위치: draft §8.4.4, R-3
+  - 충돌 대상: `spec/6-brand.md` §8.3 "금지: ...단색 또는 단색 반전만 허용한다"
+  - 상세: 현행 §8.3은 워드마크에 단색/단색 반전만 허용한다. Draft §8.4.4는 2-tone 처리를 정식 허용하며 이 조항을 명시적으로 무효화한다. Drop-in 대체 범위에 §8.3 폐기가 명시되어 있고, Rationale R-3에 근거가 기술되어 있다. 의도된 대체이며 충돌이 아니다.
+  - 제안: 채택 후 현행 §8.3 전체가 삭제·대체됨을 확인. 별도 조치 불필요.
+
+- **[INFO]** 폐기 토큰 grep 명령의 spec/ 검색 범위와 `spec/6-brand.md` 자체 잔존 가능성
+  - target 위치: draft §8.2.5 "잔재 검출 명령"
+  - 충돌 대상: `spec/6-brand.md` §8.1 현행 컬러 토큰 정의 (`#1F8A4C`, `#A8D86F`, `#0F3D2A` 등)
+  - 상세: Draft §8.2.5의 grep 명령은 `spec/` 폴더 전체를 대상으로 한다. `spec/6-brand.md` §8 자체가 drop-in 교체될 경우 잔재가 자동 해소되지만, Stage 2 마무리 시점까지 spec/6-brand.md에 현행 §8.1이 남아 있으면 grep 명령이 false positive를 반환할 수 있다. Drop-in 교체가 Stage 1에서 이루어지고 Stage 2 grep은 그 이후에 실행되므로 실질적 문제는 없다.
+  - 제안: Stage 1 spec 반영이 완료된 이후에 grep 검증을 수행하도록 Stage 2 plan에 순서 명시 권장.
+
+- **[INFO]** spec/0-overview.md §3.4 상태 표시 "Active(초록)" 색상과 vine ramp 토큰 매핑 미명시
+  - target 위치: draft §8.2 전체 토큰 정의
+  - 충돌 대상: `spec/0-overview.md` §3.4 "Badge/Tag: Active(초록), ... Success state"
+  - 상세: spec/0-overview.md §3.4는 success/active 상태를 "초록"으로만 기술하고 구체적 HEX/토큰을 명시하지 않는다. Draft §8.2에서 `vine-400 (Sprout)` = success state로 정의한다. 직접 모순은 아니나 향후 구현 시 어느 vine 토큰이 success state인지 두 문서를 교차 확인해야 한다.
+  - 제안: Stage 2 CSS 토큰 매핑 시 `vine-400` → success state 매핑을 명시. spec/0-overview.md §3.4에는 변경 불필요 (상세는 §8에 위임).
+
+---
+
+### 요약
+
+Cross-Spec 일관성 관점에서 이번 draft는 전반적으로 충돌 위험이 낮다. CRITICAL 또는 WARNING 등급의 직접 모순은 발견되지 않았다. 현행 `spec/6-brand.md` §8.1~§8.4, `spec/2-navigation/10-auth-flow.md` §1 배경 기술, `spec/2-navigation/_layout.md` §2.1 로고 행과의 차이는 모두 draft 내에서 명시적 drop-in 대체 범위 및 S1-A/S1-B 갱신안으로 처리 경로가 확보되어 있다. 6건 모두 INFO 수준의 동기화 확인 사항이며, Stage 1에서 3개 파일을 동시 반영하면 잔존 불일치가 해소된다. Stage 2 grep 검증의 실행 순서(Stage 1 spec 반영 완료 후)만 plan에 명시하면 추가 리스크가 없다.
+
+---
+
+### 위험도
+
+LOW

```

---

### 파일 31: review/consistency/2026/05/15/18_36_51/meta.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_36_51/meta.json b/review/consistency/2026/05/15/18_36_51/meta.json
new file mode 100644
index 00000000..158acd86
--- /dev/null
+++ b/review/consistency/2026/05/15/18_36_51/meta.json
@@ -0,0 +1,12 @@
+{
+  "timestamp": "2026-05-15T18:36:51.350291",
+  "mode": "spec draft 검토 (--spec)",
+  "target_path": "plan/in-progress/spec-draft-brand-refresh.md",
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

### 파일 32: review/consistency/2026/05/15/18_36_51/naming_collision/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_36_51/naming_collision/review.md b/review/consistency/2026/05/15/18_36_51/naming_collision/review.md
new file mode 100644
index 00000000..a01b8d19
--- /dev/null
+++ b/review/consistency/2026/05/15/18_36_51/naming_collision/review.md
@@ -0,0 +1,50 @@
+# 신규 식별자 충돌 검토 — spec-draft-brand-refresh.md
+
+검토 대상: `plan/in-progress/spec-draft-brand-refresh.md` (§8 Visual Identity 정식 개정안)
+검토 시각: 2026-05-15
+
+---
+
+## 발견사항
+
+### [WARNING] `ink` 토큰명 — 기존 `Ink` 색상 토큰과 동명 재정의
+- **target 신규 식별자**: `ink` (`#0e1a12`, §8.2.2 Neutral 라이트 모드)
+- **기존 사용처**: `spec/6-brand.md` 현행 §8.1 컬러 표 — 토큰명 `Ink` HEX `#111111` 로 이미 사용 중
+- **상세**: 기존 임시 가이드의 `Ink` 를 신규 `ink` 로 재정의한다. 대소문자만 다른 이름(`Ink` vs `ink`)이며 HEX 값도 달라진다(`#111111` → `#0e1a12`). §8.2.5 폐기 토큰 매트릭스에 `Ink #111111 → ink #0e1a12` 로 명시하여 대체 관계가 선언되어 있으므로 의도된 재정의임은 분명하다. 그러나 동일 파일 내에서 동명(케이스 무시) 토큰이 공존하는 기간(Stage 2 완료 전)에 코드나 디자인 도구가 대소문자를 구분하지 않고 참조할 경우 혼동 위험이 있다.
+- **제안**: §8.2.5 폐기 매트릭스의 "대체 토큰" 열에 `ink (소문자)` 임을 명시해 케이스 차이를 강조한다. 또는 grep 가드 명령에 `Ink\b` (대문자) 를 추가해 잔재 검출을 명확히 한다.
+
+### [WARNING] `soil-50` / `soil-100` 토큰명 — 기존 `Soil` 색상 토큰과 어근 공유
+- **target 신규 식별자**: `soil-50` (`#f7f8f6`), `soil-100` (`#eef5ec`) (§8.2.2 Neutral)
+- **기존 사용처**: `spec/6-brand.md` 현행 §8.1 — `Soil #F4F1EC` (라이트 배경)
+- **상세**: 폐기 토큰 `Soil` 과 어근(`soil`)이 동일하다. `soil-50` 이 `Soil` 을 대체하는 의도(§8.2.5 매핑 표 확인)는 명확하나, 어근이 같기 때문에 Stage 2 마무리 전 grep `Soil` 로 잔재를 검출할 때 `soil-50` / `soil-100` 이 오탐으로 잡힐 수 있다. §8.2.5 의 grep 명령은 현재 `Soil` 을 대소문자 구분으로 포함하고 있어 소문자 `soil-*` 는 검출 대상이 아니므로 오탐 발생 시 혼동이 남는다.
+- **제안**: §8.2.5 의 잔재 검출 grep 명령을 `\bSoil\b` 패턴으로 단어 경계 한정하거나, 대문자로만(`[A-Z]oi`) 한정하여 `soil-50` 신 토큰과 구분한다.
+
+### [INFO] `vine-border` 토큰명 — Tailwind/Shadcn CSS 변수 `--border` 와 의미 중첩
+- **target 신규 식별자**: `vine-border` (§8.2.2 Neutral)
+- **기존 사용처**: `frontend/src/app/globals.css` — CSS 변수 `--border: 214.3 31.8% 91.4%` (라이트), `--border: 217.2 32.6% 17.5%` (다크)
+- **상세**: target 스스로 R-8 에서 이 충돌을 인지하고 prefix `vine-` 를 붙여 회피했음을 명시한다. 명명 충돌 자체는 이미 해소된 상태이나, §8.2.4 의 권장 매핑 방향에서 "`vine-border` → `--border`" 매핑 시 코드에서 `vine-border` 라는 이름의 Tailwind 유틸리티 클래스와 CSS 변수 `--border` 가 동일 색을 가리키게 된다. 구현 시 이 매핑이 명시적 주석 없이 이루어지면 추후 유지보수 담당자에게 혼동의 여지가 있다.
+- **제안**: §8.2.4 매핑 힌트에 "CSS 변수 `--border` 에 매핑 시 Tailwind 유틸리티 `border-vine-border` 가 `--border` 를 가리키게 됨 — globals.css 주석 또는 tailwind.config 에 명시 권장" 한 줄을 추가한다.
+
+### [INFO] `text-on-dark` 토큰명 — Tailwind `dark:` variant 및 `text-{color}` 유틸리티와 구문 유사
+- **target 신규 식별자**: `text-on-dark` (§8.2.3 Dark Mode)
+- **기존 사용처**: `frontend/src/app/globals.css` — Tailwind 기본 유틸리티 패턴 `text-{shade}`, `dark:` variant
+- **상세**: target 스스로 R-8 에서 이 충돌 가능성을 인지하고 `on-dark` 로 네이밍했음을 명시한다. Tailwind 컬러 팔레트에 `on-dark` 시리즈가 없으므로 기존 유틸리티와 실제 이름 충돌은 없다. 다만 Tailwind config 에 `text-on-dark` 를 커스텀 색상으로 등록 시 `dark:text-on-dark` 같은 사용이 생겨 "다크 모드에서 다크 용 텍스트 색상" 이라는 중복 표현이 된다.
+- **제안**: 구현 시 Tailwind config 에 `colors.vine['text-on-dark']` 처럼 `vine` 네임스페이스 아래 두어 `text-vine-text-on-dark` 형태로 사용하거나, 짧은 별칭(예: `vine-text-dark`)을 검토한다. spec 에는 수정 불요.
+
+### [INFO] `vine-dark-*` 토큰 시리즈 — 기존 Tailwind `dark:` prefix 관습과 구문 유사
+- **target 신규 식별자**: `vine-dark-bg-base`, `vine-dark-bg-elevated`, `vine-dark-mid`, `vine-dark-spine`, `vine-dark-primary`, `vine-dark-leaf`, `vine-dark-accent`, `vine-dark-glow` (§8.2.3)
+- **기존 사용처**: `frontend/src/app/globals.css` `.dark { ... }` 블록 — 다크 모드 CSS 변수들
+- **상세**: `vine-dark-primary` 는 기존 라이트 모드의 `vine-700 (Primary)` 와 의미(1차 액션 컬러)가 같지만 이름이 다르다. 구현자가 "primary" 역할의 토큰을 찾을 때 `vine-700` 과 `vine-dark-primary` 두 곳을 인지해야 한다. 충돌은 아니지만 명명 대응 관계가 문서화되어 있지 않으면 혼동 가능성이 있다.
+- **제안**: §8.2.4 매핑 힌트 또는 §8.2.3 표 하단에 light↔dark 페어 대응표(예: `vine-700 ↔ vine-dark-primary`, `vine-300 ↔ vine-dark-leaf` 등)를 한 줄씩 추가하면 구현자의 혼선을 줄일 수 있다. spec 수정은 INFO 등급이므로 필수 아님.
+
+---
+
+## 요약
+
+target `plan/in-progress/spec-draft-brand-refresh.md` 가 도입하는 신규 식별자(컬러 토큰 18종, 파일 경로 9종)는 기존 코퍼스와 CRITICAL 수준의 충돌은 없다. `ink` / `Ink` (대소문자 차이), `soil-50` / `Soil` (어근 공유) 두 케이스는 이미 target §8.2.5 폐기 매트릭스에서 명시적 대체 관계로 선언되어 있어 의미 혼동은 아니지만, Stage 2 이행 기간 중 grep 잔재 검출 또는 디자인 도구 참조 시 오탐·오독 위험이 WARNING 수준으로 남는다. `vine-border`·`text-on-dark` 의 Tailwind/Shadcn 충돌 우려는 target R-8 에서 이미 자인·회피 설계가 완료되어 있어 INFO 수준의 구현 안내 보강으로 충분하다. 전반적으로 target 은 충돌 회피를 명시적으로 설계하고 있어 식별자 충돌 관점의 위험도는 낮다.
+
+---
+
+## 위험도
+
+LOW

```

---

### 파일 33: review/consistency/2026/05/15/18_36_51/plan_coherence/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_36_51/plan_coherence/review.md b/review/consistency/2026/05/15/18_36_51/plan_coherence/review.md
new file mode 100644
index 00000000..2bac7662
--- /dev/null
+++ b/review/consistency/2026/05/15/18_36_51/plan_coherence/review.md
@@ -0,0 +1,37 @@
+# Plan 정합성 Review — spec-draft-brand-refresh
+
+**검토 대상**: `plan/in-progress/spec-draft-brand-refresh.md`
+**worktree**: `brand-refresh-7a3f12`
+**검토 일시**: 2026-05-15
+
+---
+
+### 발견사항
+
+- **[INFO]** `spec/2-navigation/` 동일 디렉토리 내 동시 수정 — 파일 레벨 충돌 없음
+  - target 위치: `## Stage 1 동기화 대상` → S1-A (`spec/2-navigation/_layout.md`), S1-B (`spec/2-navigation/10-auth-flow.md`)
+  - 관련 plan: `plan/in-progress/cafe24-app-url-3rdparty-shorten.md` Phase 3 (worktree: `cafe24-3rdparty-url-503aa0`) — `spec/2-navigation/4-integration.md` 수정 진행 중
+  - 상세: brand-refresh 가 수정하는 `_layout.md`·`10-auth-flow.md` 와 cafe24 plan 이 수정하는 `4-integration.md` 는 **서로 다른 파일**이므로 git merge 충돌 위험은 없다. 그러나 두 plan 이 같은 `spec/2-navigation/` 하위에서 동시 진행 중이라는 사실을 integration PR 리뷰·merge 시 주의해야 한다.
+  - 제안: 별도 조치 불필요. merge-coordinator 가 두 branch 통합 시 `spec/2-navigation/` 영역 변경 목록을 교차 확인하면 충분.
+
+- **[INFO]** Stage 2 plan(`brand-refresh-impl.md`) 미존재 — 선행 조건 아님, 원자적 생성 예정
+  - target 위치: `## 다음 액션` 3항 — "Stage 2 plan 없이 본 draft 만 complete 로 이동 금지"
+  - 관련 plan: 없음 (아직 미생성)
+  - 상세: target 스스로 `brand-refresh-impl.md` 를 이 draft 와 원자적으로 생성하도록 명시하고 있으므로, 현재 미존재는 계획된 상태다. 다만 Stage 2 plan 생성 전에 본 draft 가 실수로 `plan/complete/` 로 이동되는 사고를 방지하기 위해, 이 조건이 plan 내에 이미 명기되어 있음을 확인.
+  - 제안: target plan 의 "다음 액션 3항" 준수로 충분. 추가 조치 불필요.
+
+- **[INFO]** `spec/2-navigation/10-auth-flow.md` 배경색 정의 — 다른 plan 과의 충돌 없음 확인
+  - target 위치: S1-B — "배경: 제품 브랜드 색상 또는 그래디언트" → `soil-50` 단색으로 변경
+  - 관련 plan: `plan/in-progress/2fa-webauthn.md` — `spec/5-system/1-auth.md` 와 `spec/2-navigation/9-user-profile.md` 를 수정할 예정이나, `10-auth-flow.md` 는 범위 외임을 확인
+  - 상세: WebAuthn plan 의 "5. spec / PRD 갱신" 항목 중 `spec/2-navigation/9-user-profile.md` 수정이 포함되어 있으나 `10-auth-flow.md` 는 포함되지 않는다. 충돌 없음.
+  - 제안: 추적 메모 수준. brand-refresh Stage 1 적용 후 WebAuthn plan 이 인증 화면(10-auth-flow.md) 을 참조할 경우 신 배경색(`soil-50`) 을 그대로 사용하면 됨.
+
+---
+
+### 요약
+
+`plan/in-progress/spec-draft-brand-refresh.md` (worktree: `brand-refresh-7a3f12`) 는 진행 중인 다른 plan 들과 실질적인 충돌이 없다. `spec/6-brand.md`, `spec/2-navigation/_layout.md`, `spec/2-navigation/10-auth-flow.md` 를 대상으로 하는 이번 변경은 현재 활성 worktree 들(`cafe24-3rdparty-url-503aa0`, `cafe24-data-model-strengthen-464de9`, `ai-review-subagent-b7c8d9`)이 다루는 파일 영역과 겹치지 않는다. `spec/2-navigation/4-integration.md` 를 수정 중인 cafe24 plan 과 동일 디렉토리를 공유하지만 파일 수준 충돌은 없다. 미해결 결정 우회, 중복 작업, 선행 plan 미해소 항목은 발견되지 않았다. Stage 2 plan 미존재는 target plan 자체가 원자적 생성을 명시한 계획된 상태다.
+
+### 위험도
+
+NONE

```

---

### 파일 34: review/consistency/2026/05/15/18_36_51/rationale_continuity/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_36_51/rationale_continuity/review.md b/review/consistency/2026/05/15/18_36_51/rationale_continuity/review.md
new file mode 100644
index 00000000..9db7c7d8
--- /dev/null
+++ b/review/consistency/2026/05/15/18_36_51/rationale_continuity/review.md
@@ -0,0 +1,55 @@
+# Rationale 연속성 검토 — spec-draft-brand-refresh.md
+
+검토 대상: `plan/in-progress/spec-draft-brand-refresh.md`
+참조 Rationale 원본: `spec/6-brand.md` §8 (현행 임시 가이드)
+검토 모드: spec draft 검토 (--spec)
+
+---
+
+### 발견사항
+
+- **[INFO]** 단색 규정 폐기 — 명시적 근거 있음 (정합)
+  - target 위치: §8.4.4 워드마크 사용 규정, "옛 §8.3 *단색 또는 단색 반전만 허용* 조항은 본 항으로 무효화된다 (R-3 참조)"
+  - 과거 결정 출처: `spec/6-brand.md` §8.3 "금지: 그림자·그라데이션·외곽선·회전·왜곡. 단색 또는 단색 반전만 허용한다."
+  - 상세: 현행 §8.3의 "단색 또는 단색 반전만 허용" 규정은 target draft에서 2-tone 시그니처 채택으로 폐기된다. 그러나 이 폐기는 명시적으로 R-3 Rationale 에서 원출처를 인용하며 근거(임시 가이드의 안전책이었음, 정식 가이드에서는 시그니처 강도가 더 중요, 흑백 출력 예외 절로 처리)를 함께 작성하고 있다. 기각된 대안(전체 단색 유지, `clem` 강조)도 명시되어 있다. Rationale 연속성 원칙을 완전히 준수한 번복이다.
+  - 제안: 현재 처리 방식 유지. 추가 조치 불필요.
+
+- **[INFO]** 덩굴 곡선 모티프 → 노드 그래프 모티프 전환 — 명시적 근거 있음 (정합)
+  - target 위치: §8.1 디자인 모티프, §8.6 임시 자산 마이그레이션, R-1
+  - 과거 결정 출처: `spec/6-brand.md` §8.3 "심볼: 덩굴이 위로 자라는 단순화된 곡선 모티브. favicon·앱 아이콘 용도."
+  - 상세: 현행 §8.3의 덩굴 곡선 모티프는 draft에서 노드 그래프 모티프로 전환된다. R-1에서 전환 근거(제품 정체성 직접 표현, 일반 식물 브랜드와의 차별, Brand Story와의 정합성), 기각된 대안(wordmark only, 추상 기호)이 모두 명시되어 있다. 완전한 Rationale 갱신을 동반한 번복이다.
+  - 제안: 추가 조치 불필요.
+
+- **[INFO]** 워드마크 폰트 정의 전면 대체 — 명시적 근거 있음 (정합)
+  - target 위치: §8.3 타이포그래피 "옛 §8.2 '워드마크 = Geist Sans Medium / 자간 -0.01em' 정의는 본 표로 전면 대체"
+  - 과거 결정 출처: `spec/6-brand.md` §8.2 "워드마크: Geist Sans Medium / 자간 `-0.01em`", §8.2 "별도 브랜드 폰트는 도입하지 않는다."
+  - 상세: 현행 §8.2의 "워드마크 = Geist Sans Medium" 및 "별도 브랜드 폰트는 도입하지 않는다" 방침이 system sans-serif 스택(Helvetica Neue, Helvetica, Arial)으로 대체된다. R-11에서 SVG 정적 자산 환경의 Geist weight 200/600 렌더링 안정성 문제를 근거로 명시했다. 단, "별도 브랜드 폰트 도입 안 함" 원칙이 현행 §8.2에 존재하나 이 원칙 자체가 임시 가이드의 일환으로 명시되어 있어 정식 가이드에서의 대체는 사전 예고된 범주다. R-11이 이 전환을 커버한다.
+  - 제안: R-11에 "현행 §8.2의 '별도 브랜드 폰트 도입 안 함' 방침도 함께 폐기된다"는 명시를 한 줄 추가하면 연속성 추적이 더 명확해진다. 필수는 아니나 권장.
+
+- **[INFO]** `spec/6-brand.md` §8 전체가 임시 가이드임을 명시한 상태 — 번복이 아닌 예정된 대체
+  - target 위치: draft 도입부 "본 §8 은 임시 가이드 — 디자이너 협업으로 정식 비주얼 가이드가 마련되면 교체한다 상태"
+  - 과거 결정 출처: `spec/6-brand.md` §8 서두 "본 섹션은 임시 가이드다. 디자이너 협업으로 정식 비주얼 가이드가 마련되면 교체한다."
+  - 상세: 현행 §8 전체가 "교체 예정" 임을 원본 spec 자체가 선언하고 있다. Draft의 모든 변경(모티프, 컬러, 타이포, 로고 규정)은 이 선언 범위 안의 예정된 대체다. 따라서 각 변경은 "기각된 결정의 재도입"이 아니라 "임시 결정의 정식화"에 해당하며, 각 R-* 항목은 추가 안전장치로 기능한다.
+  - 제안: 추가 조치 불필요. 현행 처리 방식이 적절하다.
+
+- **[WARNING]** `spec/2-navigation/10-auth-flow.md` §1 배경 기술의 번복 — 근거 동반이나 원본 spec Rationale 섹션 부재
+  - target 위치: S1-B "배경: 제품 브랜드 색상 또는 그래디언트" → "`soil-50` 단색. 그라데이션 금지"
+  - 과거 결정 출처: `spec/2-navigation/10-auth-flow.md` §1 "배경: 제품 브랜드 색상 또는 그래디언트"
+  - 상세: `10-auth-flow.md`에는 `## Rationale` 섹션이 없다(현재 확인된 헤딩 목록상 부재). "브랜드 색상 또는 그래디언트"라는 기존 기술이 왜 그렇게 작성되었는지 과거 Rationale 기록이 없어, 이를 번복할 때의 continuity 추적이 약하다. Draft 자체는 §8.4.4 및 R-3(그라데이션 금지 원칙)을 참조 링크로 달고 있어 근거가 없는 것은 아니나, `10-auth-flow.md` 자체의 Rationale 섹션에 "그라데이션 배경에서 단색 배경으로 전환한 이유 = §8.4.4 참조"라는 한 줄이 동반되지 않는 형태라면 향후 auth-flow 단독 검토 시 맥락이 사라질 수 있다.
+  - 제안: S1-B 갱신과 동시에 `spec/2-navigation/10-auth-flow.md` 에 `## Rationale` 섹션을 신설하고, §1 배경 결정 변경 사유("그라데이션 금지는 brand spec §8.4.4 의 그라데이션 금지 원칙 적용")를 한 줄 기록한다. Draft의 Stage 2 인수인계 항목 또는 Stage 1 동기화 범위에 이 항목을 추가하는 것을 권장.
+
+- **[WARNING]** `spec/2-navigation/_layout.md` §2.1 로고 행 번복 — 근거 참조는 있으나 해당 spec Rationale 부재
+  - target 위치: S1-A "_layout.md §2.1 갱신"
+  - 과거 결정 출처: `spec/2-navigation/_layout.md` §2.1 현행 로고 행 "제품 로고. 클릭 시 대시보드(홈, `/dashboard`)로 이동"
+  - 상세: `_layout.md`가 expanded/collapsed 변종 규칙을 갖지 않았던 것은 설계 결정이었을 가능성이 있다. Draft S1-A는 변종 규칙을 추가하면서 `spec/6-brand.md §8.4` 참조를 달고 있어 cross-ref는 존재한다. 그러나 `_layout.md` 자체에 "왜 이 전에는 변종이 없었고 지금 추가하는가"에 대한 Rationale이 남지 않는다.
+  - 제안: S1-A 갱신 시 `_layout.md`에도 해당 변경 사유를 Rationale 또는 인라인 주석으로 남겨 문서 단독 검토 시에도 맥락이 보존되도록 한다.
+
+---
+
+### 요약
+
+Target 문서(spec-draft-brand-refresh.md)는 현행 `spec/6-brand.md` §8의 모든 주요 결정(단색 규정, 덩굴 모티프, Geist 워드마크)을 번복하고 있으나, 현행 §8 자체가 "임시 가이드, 교체 예정"으로 원본 spec에 명시되어 있어 이 번복들은 예정된 대체의 범주에 속한다. 각 번복에 대해 R-1~R-12의 Rationale이 원출처 인용·근거·기각된 대안을 포함하여 작성되어 있어 CRITICAL 또는 고위험 연속성 파단은 발견되지 않는다. 다만 Stage 1 동기화 대상인 `spec/2-navigation/10-auth-flow.md`와 `spec/2-navigation/_layout.md`는 자체 Rationale 섹션이 없어 번복 맥락이 해당 파일 단독 검토 시 소실될 수 있다. 또한 R-11에서 워드마크 폰트 전환의 대상이 되는 현행 §8.2의 "별도 브랜드 폰트 도입 안 함" 방침을 명시적으로 폐기 선언하면 연속성 추적이 완결된다. 전반적으로 Rationale 연속성은 양호하며, 두 WARNING은 해당 파일의 자체 Rationale 보강으로 해소 가능하다.
+
+### 위험도
+
+LOW

```

---

### 파일 35: review/consistency/2026/05/15/18_49_57/_prompts/convention_compliance.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 36: review/consistency/2026/05/15/18_49_57/_prompts/cross_spec.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 37: review/consistency/2026/05/15/18_49_57/_prompts/naming_collision.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 38: review/consistency/2026/05/15/18_49_57/_prompts/plan_coherence.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 39: review/consistency/2026/05/15/18_49_57/_prompts/rationale_continuity.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 40: review/consistency/2026/05/15/18_49_57/_retry_state.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_49_57/_retry_state.json b/review/consistency/2026/05/15/18_49_57/_retry_state.json
new file mode 100644
index 00000000..9e93f51e
--- /dev/null
+++ b/review/consistency/2026/05/15/18_49_57/_retry_state.json
@@ -0,0 +1,58 @@
+{
+  "session_dir": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_49_57",
+  "summary_subagent_type": "consistency-summary",
+  "summary_output_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_49_57/SUMMARY.md",
+  "subagent_invocations": [
+    {
+      "name": "cross_spec",
+      "subagent_type": "cross-spec-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_49_57/_prompts/cross_spec.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_49_57/cross_spec/review.md"
+    },
+    {
+      "name": "rationale_continuity",
+      "subagent_type": "rationale-continuity-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_49_57/_prompts/rationale_continuity.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_49_57/rationale_continuity/review.md"
+    },
+    {
+      "name": "convention_compliance",
+      "subagent_type": "convention-compliance-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_49_57/_prompts/convention_compliance.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_49_57/convention_compliance/review.md"
+    },
+    {
+      "name": "plan_coherence",
+      "subagent_type": "plan-coherence-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_49_57/_prompts/plan_coherence.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_49_57/plan_coherence/review.md"
+    },
+    {
+      "name": "naming_collision",
+      "subagent_type": "naming-collision-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_49_57/_prompts/naming_collision.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/brand-refresh-7a3f12/review/consistency/2026/05/15/18_49_57/naming_collision/review.md"
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
+    "cross_spec": {"status": "success", "issues": 3, "reset_hint_sec": null},
+    "rationale_continuity": {"status": "success", "issues": 5, "reset_hint_sec": null},
+    "convention_compliance": {"status": "success", "issues": 3, "reset_hint_sec": null},
+    "plan_coherence": {"status": "success", "issues": 3, "reset_hint_sec": null},
+    "naming_collision": {"status": "success", "issues": 5, "reset_hint_sec": null}
+  },
+  "rate_limit_episodes": 0,
+  "total_wait_sec": 0,
+  "wake_history": [],
+  "last_reset_hint_sec": null,
+  "loop_mode": false
+}

```

---

### 파일 41: review/consistency/2026/05/15/18_49_57/convention_compliance/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_49_57/convention_compliance/review.md b/review/consistency/2026/05/15/18_49_57/convention_compliance/review.md
new file mode 100644
index 00000000..8cf00780
--- /dev/null
+++ b/review/consistency/2026/05/15/18_49_57/convention_compliance/review.md
@@ -0,0 +1,39 @@
+# 정식 규약 준수 검토 — `spec/6-brand.md`
+
+검토 모드: `--impl-prep` (구현 착수 전 검토)  
+검토 대상: `spec/6-brand.md`  
+검토 규약: `spec/conventions/` 전체 + `CLAUDE.md` 명명 컨벤션
+
+---
+
+## 발견사항
+
+### 1. [WARNING] 문서 제목에 `PRD:` prefix 사용
+- **target 위치**: `spec/6-brand.md` 1행 — `# PRD: 브랜드 가이드 — Clemvion`
+- **위반 규약**: `CLAUDE.md` §정보 저장 위치 — "제품 정의·요구사항(옛 PRD) → `spec/<영역>/_product-overview.md` 또는 영역 진입 문서의 `## Overview (제품 정의)` 섹션"
+- **상세**: docs-consolidation(2026-05-12) 이후 `PRD`라는 용어는 `spec/` 안에서 *"옛 PRD"* 로 대체 지칭된다. 파일 제목에 `PRD:` 를 그대로 노출하면, 신규 문서가 옛 경로 컨벤션을 답습하는 것처럼 오해될 수 있다.
+- **제안**: 제목을 `# 브랜드 가이드 — Clemvion` 으로 변경하거나, `## Overview (제품 정의)` 섹션을 문서 상단에 두고 본문을 이어가는 구조로 전환한다. `PRD:` prefix 삭제가 가장 간단한 수정이다.
+
+### 2. [INFO] 권장 3섹션 구조에서 Overview 섹션 미분리
+- **target 위치**: `spec/6-brand.md` 전체 구조
+- **위반 규약**: `CLAUDE.md` §프로젝트 스펙 문서 — "각 spec 문서는 권장 3섹션 구성(1. Overview / 2. 본문 / 3. Rationale)을 따른다"
+- **상세**: 문서는 `§1~§7` 브랜드 스토리·가치 정의, `§8` 비주얼 아이덴티티 스펙, `Rationale` 의 흐름을 가지며, 3섹션의 정신은 대체로 충족된다. 다만 명시적인 `## Overview` 헤딩이 없어 ① 사용자 가치·목표를 기술하는 "Overview (제품 정의)" 영역과 ② 기술 명세인 "본문" 영역의 경계가 구조적으로 드러나지 않는다. `## Rationale` 섹션은 존재하므로 3번째 섹션은 준수됨.
+- **제안**: `§1~§7` 을 묶는 `## Overview (제품 정의)` 헤딩을 최상단에 추가하고, `§8` 앞에 `## 브랜드 시각 규약 (스펙)` 또는 이에 준하는 본문 섹션 헤딩을 추가한다. 강제 규약은 아니지만 일관성에 도움이 된다.
+
+### 3. [INFO] 파일 위치 패턴 검토 — 단일 spec 파일 영역의 `N-name.md` 규칙 준수 여부
+- **target 위치**: 파일 경로 `spec/6-brand.md`
+- **위반 규약**: `CLAUDE.md` 명명 컨벤션 표 — `spec/<영역>/N-name.md` 패턴은 "정렬 보장된 상세 spec 문서"
+- **상세**: `spec/6-brand.md` 는 `spec/` 루트 직하 파일로, 숫자 prefix `6-` 를 사용하고 있어 컨벤션과 일치한다. `spec/` 루트는 `0-overview.md`, `1-data-model.md` 처럼 숫자 prefix 단일 파일들로 구성된 영역이므로 별도 위반 없음. 확인 차원의 INFO.
+- **제안**: 현행 유지. 이상 없음.
+
+---
+
+## 요약
+
+`spec/6-brand.md` 는 정식 규약(`spec/conventions/` 전체)에 직접 저촉되는 항목이 없다. 본 문서는 브랜드·비주얼 아이덴티티를 정의하는 spec 이므로 노드 Output(`node-output.md`), Swagger(`swagger.md`), Cafe24 API Metadata(`cafe24-api-metadata.md`), 마이그레이션(`migrations.md`) 규약의 적용 범위 바깥이다. `Rationale` 섹션 보유, 숫자 prefix 파일명, 폐기 경로(`prd/`, `memory/`) 미사용 등 주요 규약을 준수하고 있다. 다만 문서 제목에 잔존하는 `PRD:` prefix 는 docs-consolidation 이후 지양되는 표현이므로 제거를 권고한다(WARNING). Overview/본문 섹션 헤딩 미분리는 사소한 형식 제안(INFO) 수준이다.
+
+---
+
+## 위험도
+
+LOW

```

---

### 파일 42: review/consistency/2026/05/15/18_49_57/cross_spec/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_49_57/cross_spec/review.md b/review/consistency/2026/05/15/18_49_57/cross_spec/review.md
new file mode 100644
index 00000000..4223fe8a
--- /dev/null
+++ b/review/consistency/2026/05/15/18_49_57/cross_spec/review.md
@@ -0,0 +1,36 @@
+# Cross-Spec 일관성 검토 — spec/6-brand.md
+
+검토 모드: `--impl-prep` (구현 착수 전, scope=spec/6-brand.md)
+검토 시각: 2026-05-15
+
+---
+
+### 발견사항
+
+- **[INFO]** `spec/0-overview.md` §3.4 상태 배지 색상과 brand 토큰의 명시적 연결 없음
+  - target 위치: `spec/6-brand.md` §8.2.1 — `vine-400` (Sprout) `#4ab868` 을 "success state" 로 정의
+  - 충돌 대상: `spec/0-overview.md` §3.4 공통 UI 패턴 — "Badge/Tag: Active(초록), Error(빨강), Processing(파랑 스피너)"
+  - 상세: `0-overview.md`의 상태 표시 패턴은 "초록"이라는 추상 서술만 있고 구체 토큰을 참조하지 않는다. 충돌은 아니나 구현 시 `vine-400`이 success/active 상태에 매핑된다는 사실을 참조 링크로 명시하면 developer 가 즉흥 결정 없이 구현 가능하다.
+  - 제안: `spec/0-overview.md` §3.4 에 "색 토큰은 `spec/6-brand.md §8.2.1` 참조" 각주 추가 (동기화 권장, 차단 불필요).
+
+- **[INFO]** `spec/2-navigation/_layout.md` §2.1 로고 변종 서술이 brand spec 보다 약간 선행 표현
+  - target 위치: `spec/6-brand.md` §8.4.6 — "사이드바 상단: expanded → Full logo (light) / collapsed → Icon mark"
+  - 충돌 대상: `spec/2-navigation/_layout.md` §2.1 — "사이드바 expanded 상태에서는 **Full logo (light)**, collapsed 상태에서는 **Icon mark**를 표시. 자세한 변종·색은 `spec/6-brand.md §8.4` 참조"
+  - 상세: 내용이 일치하고 단일 진실 참조도 이미 명시되어 있다. 다만 `_layout.md`의 "Icon mark" 표기가 brand spec의 "Icon mark (light, 96px master)" 전체 명칭과 약칭 차이가 있어 오독 가능성이 낮다. 실질 충돌 없음.
+  - 제안: 현행 유지. 필요 시 `_layout.md`에서 "Icon mark (light)" 로 소폭 정교화.
+
+- **[INFO]** `spec/2-navigation/10-auth-flow.md` §1 배경 색 토큰 인라인 기술과 brand spec §8.4.4의 관계
+  - target 위치: `spec/6-brand.md` §8.4.4 및 §8.4.6 — 인증 화면 배경은 `soil-50` 단색, 그라데이션 금지
+  - 충돌 대상: `spec/2-navigation/10-auth-flow.md` §1 — "배경: `soil-50` (`#f7f8f6`) 단색. 그라데이션 금지. 색 토큰·예외 정의는 `spec/6-brand.md §8.4.4` 참조"
+  - 상세: HEX 값 `#f7f8f6` 을 인라인으로 박아 두었다. brand spec §8.2.2에서 `soil-50` = `#f7f8f6` 로 동일하게 정의되어 있어 현재는 일치. 그러나 향후 brand spec에서 `soil-50` HEX가 조정될 경우 `10-auth-flow.md` 의 HEX 하드코딩이 불일치 원인이 된다.
+  - 제안: `10-auth-flow.md` §1 에서 HEX 값 하드코딩을 제거하고 토큰명(`soil-50`)만 유지하도록 brand spec 개정 시 함께 정리 권장 (동기화 권장).
+
+---
+
+### 요약
+
+`spec/6-brand.md` §8 정식 개정안은 기존 spec 영역과 직접 모순되는 항목이 없다. 데이터 모델(`spec/1-data-model.md`)·API 계약·RBAC·상태 전이 영역에는 brand spec 이 개입하지 않으므로 해당 충돌 범주는 해당 없다. 요구사항 ID 체계(`NAV-*`, `ED-AI-*` 등)와도 겹치지 않는다. 라우트 spec(`_layout.md`, `10-auth-flow.md`)은 brand spec 발효 이전에 이미 단일 진실 참조 구조로 정비되어 있고, §8.4.6의 우선권 선언과도 정합한다. 발견된 3건은 모두 INFO 등급으로, 구현 시 즉흥 결정을 예방하기 위한 동기화 권장 사항이며 채택 자체를 차단하는 요소는 없다.
+
+### 위험도
+
+LOW

```

---

### 파일 43: review/consistency/2026/05/15/18_49_57/meta.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_49_57/meta.json b/review/consistency/2026/05/15/18_49_57/meta.json
new file mode 100644
index 00000000..e6113599
--- /dev/null
+++ b/review/consistency/2026/05/15/18_49_57/meta.json
@@ -0,0 +1,12 @@
+{
+  "timestamp": "2026-05-15T18:49:57.842853",
+  "mode": "구현 착수 전 검토 (--impl-prep, scope=spec/6-brand.md)",
+  "target_path": "spec/6-brand.md",
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

### 파일 44: review/consistency/2026/05/15/18_49_57/naming_collision/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_49_57/naming_collision/review.md b/review/consistency/2026/05/15/18_49_57/naming_collision/review.md
new file mode 100644
index 00000000..4541733f
--- /dev/null
+++ b/review/consistency/2026/05/15/18_49_57/naming_collision/review.md
@@ -0,0 +1,60 @@
+# 신규 식별자 충돌 검토 — `spec/6-brand.md`
+
+검토 모드: 구현 착수 전 (--impl-prep, scope=spec/6-brand.md)
+
+---
+
+## 발견사항
+
+### [WARNING] 컬러 토큰 `vine-border` — Tailwind/Shadcn `--border` CSS 변수와의 이름 유사성
+
+- **target 신규 식별자**: `vine-border` (`spec/6-brand.md` §8.2.2)
+- **기존 사용처**: `frontend/src/app/globals.css` 의 `--border` CSS 변수 (Shadcn 기본 컨벤션). plan/in-progress/brand-refresh-impl.md §2 에서 매핑 예정 (`--border` ← `vine-border`)
+- **상세**: brand spec 자체가 §8.2.2 에서 "`vine-border` 로 명명 — Tailwind/Shadcn `--border` 와 충돌 방지 위해"라고 이유를 명시하고 있으므로, 토큰 이름 자체의 충돌은 회피되어 있다. 그러나 구현 시 `--border: <vine-border HEX>;` 형태로 직접 매핑되므로, 개발자가 `vine-border` 와 `--border` 를 동일 개념으로 혼동할 수 있다. 혼동 시 CSS 변수를 spec 토큰 이름으로 잘못 참조하는 오류가 발생할 수 있다.
+- **제안**: brand spec §8.2.4 (코드 토큰 매핑) 에서 `vine-border → --border` 대응을 이미 권장 방향으로 명시하고 있으므로 실제 충돌은 낮다. 구현 시 CSS 변수 옆 주석 (`/* vine-border from spec/6-brand.md §8.2.2 */`) 을 반드시 추가하도록 plan/in-progress/brand-refresh-impl.md §2 에 체크리스트 항목으로 명기하면 충분하다.
+
+---
+
+### [WARNING] 컬러 토큰 `text-on-dark` — Tailwind `text-{shade}` 유틸리티·`dark:` variant와의 이름 유사성
+
+- **target 신규 식별자**: `text-on-dark` (`spec/6-brand.md` §8.2.3)
+- **기존 사용처**: Tailwind CSS 의 `text-*` 유틸리티 클래스 계열 (예: `text-gray-900`, `dark:text-white`), 코드베이스 전반에서 사용 중인 Tailwind `dark:` variant
+- **상세**: brand spec 자체가 §8.2.3 에서 "`text-on-dark` 로 명명 — Tailwind `text-{shade}` 및 `dark:` variant 와 충돌 방지 위해"라고 이유를 명시하므로, Tailwind 유틸리티 클래스와의 직접 충돌은 회피되어 있다. 그러나 `text-on-dark` 라는 이름이 Tailwind 클래스처럼 읽혀 구현자가 `className="text-on-dark"` 로 직접 Tailwind 유틸리티로 사용하려는 시도를 유발할 수 있다. 이 토큰은 CSS 변수 값(`--foreground` 다크 모드 페어)으로 사용되는 것이지, Tailwind 유틸리티 클래스가 아니다.
+- **제안**: brand spec §8.2.4 에서 `text-on-dark → --foreground (다크 모드)` 대응이 이미 명시되어 있다. 구현 시 `tailwind.config` 에 `text-on-dark` 를 별도 색상 키로 등록하지 말고, 오직 CSS 변수 값으로만 사용하도록 plan §2 에 주의사항을 명시하면 충분하다.
+
+---
+
+### [INFO] 파일 경로 `frontend/public/logo-dark.svg` — 기존 파일 없는 신규 추가이지만 명명 컨벤션 확인 권장
+
+- **target 신규 식별자**: `frontend/public/logo-dark.svg`, `frontend/public/logo-mark-dark.svg`, `frontend/public/logo-wordmark.svg` (`spec/6-brand.md` §8.4.1)
+- **기존 사용처**: `frontend/public/logo.svg`, `frontend/public/logo-mark.svg` 가 기존 파일로 존재 (옛 자산, 교체 대상으로 §8.6 에 명시). `frontend/src/app/icon.svg`, `frontend/src/app/favicon.ico` 도 교체 대상.
+- **상세**: 신규 추가 파일 3종(`logo-dark.svg`, `logo-mark-dark.svg`, `logo-wordmark.svg`)은 기존 파일과 충돌하지 않는다. 교체 파일 6종(`logo.svg`, `logo-mark.svg`, `favicon.ico`, `icon.svg`, `apple-icon.png`, `opengraph-image.png`)은 §8.6 에서 폐기 대상으로 명시적으로 선언되어 있으므로, 경로 충돌이 아닌 의도된 덮어쓰기다.
+- **제안**: 별도 조치 불필요. 구현 시 §8.6 의 폐기 목록과 실제 파일 작업이 1:1 대응하는지 확인만 하면 된다.
+
+---
+
+### [INFO] 폐기 토큰 이름 대소문자 (`Vine Green`, `Bud Lime`, `Deep Forest`, `Bark`, `Soil`, `Ink`) — 코드베이스 잔재 검출 필요
+
+- **target 신규 식별자**: §8.2.5 에서 폐기 선언된 옛 토큰명 (`Vine Green`, `Deep Forest`, `Bud Lime`, `Bark`, `Soil`, `Ink`) 및 HEX 값 6개
+- **기존 사용처**: `frontend/` 및 `spec/` 코드베이스에 잔재 가능 (이전 임시 가이드 시절)
+- **상세**: 폐기 토큰은 신 토큰과 대소문자가 달라 grep 패턴으로 구별 가능하도록 설계되어 있다 (§8.2.5 의 grep 명령 명시). 이 자체가 충돌 방지 조치다. 단, 구현 착수 전 grep 0건 확인을 plan 체크리스트에 명시적으로 포함해야 한다.
+- **제안**: `plan/in-progress/brand-refresh-impl.md` §2 의 검증 항목에 §8.2.5 의 grep 명령 실행 및 0건 확인을 체크리스트로 추가하면 충분하다 (§8.2.5 에 명령이 이미 제시되어 있음).
+
+---
+
+### [INFO] Tailwind 컬러 키 `vine-300 ~ vine-900`, `vine-dark-*` — `tailwind.config` 기존 colors 키와 충돌 가능성
+
+- **target 신규 식별자**: `vine-300`, `vine-400`, `vine-500`, `vine-600`, `vine-700`, `vine-800`, `vine-900`, `vine-dark-bg-base`, `vine-dark-bg-elevated`, `vine-dark-mid`, `vine-dark-spine`, `vine-dark-primary`, `vine-dark-leaf`, `vine-dark-accent`, `vine-dark-glow` (`spec/6-brand.md` §8.2.1~§8.2.3)
+- **기존 사용처**: `tailwind.config` 의 `theme.colors` (현재 상세 내용은 코퍼스 외이지만, Tailwind/Shadcn 기본 설정은 `primary`, `secondary`, `muted` 등 Shadcn 키를 사용). `vine` prefix 를 가진 기존 색상 키는 코퍼스에서 발견되지 않음.
+- **상세**: `vine-*` prefix 는 기존 Tailwind 기본 색상 팔레트나 Shadcn 컨벤션에 존재하지 않으므로 직접 충돌 가능성은 낮다. 단, `vine-dark-primary` 는 Tailwind 의 `dark:` prefix 와 결합 시 `dark:vine-dark-primary` 같은 불필요하게 중복된 표현이 나올 수 있다.
+- **제안**: brand spec §8.2.4 에서 구현은 `developer` 에 위임되어 있으므로, `tailwind.config` 에 실제 추가 시 `vine-dark-*` 를 별도 키로 등록하기보다 CSS 변수 페어(`dark:root`)로만 처리하는 것이 Tailwind/Shadcn 컨벤션과 더 정합하다. 이는 구현 단계에서 결정하면 충분하다 (R-10 에서 이미 의도된 위임).
+
+---
+
+## 요약
+
+`spec/6-brand.md` §8 이 도입하는 신규 식별자(컬러 토큰 22개, 파일 경로 9종, 폐기 토큰 6개)는 기존 spec·데이터모델·API endpoint·이벤트명·환경변수와의 **직접 충돌은 발견되지 않는다**. 주목할 부분은 `vine-border` 와 `text-on-dark` 두 토큰이다. 이들은 Tailwind/Shadcn 의 `--border` CSS 변수 및 `text-{shade}` 유틸리티 클래스와 이름이 유사하지만, brand spec 자체가 §8.2.2~§8.2.3 에서 그 이유와 회피 방안을 명시적으로 설명하고 있어 설계상 의도된 명명이다. `vine-300 ~ vine-900` Tailwind 키도 기존 팔레트와 겹치지 않는다. 폐기 토큰 6개는 대소문자 차이로 grep 구별이 가능하며 §8.2.5 에 검출 명령이 제시되어 있다. 충돌 우려가 있는 두 WARNING 항목은 구현 시 CSS 변수 주석과 plan 체크리스트 보강으로 충분히 해소 가능하다.
+
+## 위험도
+
+LOW

```

---

### 파일 45: review/consistency/2026/05/15/18_49_57/plan_coherence/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_49_57/plan_coherence/review.md b/review/consistency/2026/05/15/18_49_57/plan_coherence/review.md
new file mode 100644
index 00000000..59474e76
--- /dev/null
+++ b/review/consistency/2026/05/15/18_49_57/plan_coherence/review.md
@@ -0,0 +1,40 @@
+# Plan 정합성 검토 결과
+
+- **검토 모드**: 구현 착수 전 (`--impl-prep`)
+- **Target**: `spec/6-brand.md`
+- **기준 plan**: `plan/in-progress/brand-refresh-impl.md` (worktree: `brand-refresh-7a3f12`)
+- **검토 일시**: 2026-05-15
+
+---
+
+## 발견사항
+
+### 1. INFO — `brand-refresh-impl.md` 가 main worktree `plan/in-progress/` 에 없음
+- **target 위치**: `plan/in-progress/brand-refresh-impl.md` frontmatter `worktree: brand-refresh-7a3f12`
+- **관련 plan**: `plan/in-progress/brand-refresh-impl.md` (brand-refresh-7a3f12 worktree 전용)
+- **상세**: main worktree(`/Volumes/project/private/clemvion/plan/in-progress/`) 의 파일 목록에 `brand-refresh-impl.md` 가 존재하지 않는다. 이 plan 은 brand-refresh-7a3f12 worktree 안에만 있으므로, 다른 worktree 에서 동일 영역을 점유 중인지 cross-check 이 불완전할 수 있다. 단, main worktree 어느 plan 에도 `spec/6-brand.md`, `globals.css`, `logo.svg`, `vine-*`, `soil-*` 관련 참조가 전혀 없어 실질적 경합은 없음이 확인되었다.
+- **제안**: brand-refresh-impl 작업 완료 후 PR merge 시 main 에 plan 파일이 반입되면 자연 해소된다. 현재는 추적 목적으로만 기록.
+
+### 2. INFO — CSS 변수 명·Tailwind theme key 매핑은 `spec/6-brand.md §8.2.4` 가 명시적으로 developer에게 위임한 미결 항목이며, `brand-refresh-impl.md §2` 가 이를 독자적으로 결정함
+- **target 위치**: `spec/6-brand.md §8.2.4` ("코드 토큰 매핑 (구현 위임 정책)")
+- **관련 plan**: `plan/in-progress/brand-refresh-impl.md §2` (CSS 토큰 매핑 체크리스트)
+- **상세**: `spec/6-brand.md §8.2.4` 는 "CSS 변수 명 및 Tailwind theme key 로의 매핑은 `developer` skill 의 Stage 2 에서 수행한다"고 명시하고, `R-10` 에서 그 이유를 설명한다. 즉 spec 이 의도적으로 매핑 결정을 developer에게 위임한 구조다. `brand-refresh-impl.md §2` 는 그 위임을 정확히 이행하는 체크리스트(`--primary ← vine-700`, `--background ← soil-50` 등)를 담고 있으며, spec 의 §8.2.4 권장 매핑 힌트와도 일치한다. 이는 충돌이 아니라 의도된 위임 이행이다.
+- **제안**: 이슈 없음. 다만 developer 가 구현 중 §8.2.4 권장 힌트와 다른 매핑을 선택할 경우 spec §8.2.4 에 그 근거를 Rationale로 추가해야 한다는 점을 remind 차원에서 기록.
+
+### 3. INFO — `ai-review-subagent.md` (worktree: `ai-review-subagent-b7c8d9`) 의 단계 25 미완료 상태가 brand-refresh-impl 의 `/ai-review` 호출 전제에 영향 가능
+- **target 위치**: `plan/in-progress/brand-refresh-impl.md §6.3` ("/ai-review 호출")
+- **관련 plan**: `plan/in-progress/ai-review-subagent.md` 단계 25 (`[ ] 자동 후속 흐름 commit + push`) 미완
+- **상세**: `brand-refresh-impl.md §6.3` 은 Stage 2 마무리 시 `/ai-review` 를 의무 호출한다. `ai-review-subagent.md` 는 `/ai-review` 파이프라인 전환 plan 이며 단계 25(자동 후속 흐름 commit)가 미완료(`[ ]`)다. 그러나 단계 25 는 SKILL.md 의 자동 후속 흐름 문서화이고, 실제 `/ai-review` 의 핵심 기능(orchestrator --prepare + sub-agent 병렬 invoke) 은 단계 1~22 에서 이미 완료(`[x]`)되었다. 따라서 단계 25 미완료가 brand-refresh-impl 의 `/ai-review` 호출을 블로킹하지는 않는다.
+- **제안**: 낮은 위험. brand-refresh-impl 진행 전 단계 25 가 완료되어 있으면 가장 깔끔하나, 미완료 상태에서도 `/ai-review` 자체는 동작 가능하다. `ai-review-subagent.md` 담당자가 단계 25 를 우선 처리하면 ideal.
+
+---
+
+## 요약
+
+`spec/6-brand.md` 를 대상으로 한 brand-refresh-impl (구현 착수 전) 의 plan 정합성을 검토한 결과, **미해결 결정 우회·worktree 경합·선행 plan 미해소·후속 항목 누락에 해당하는 CRITICAL/WARNING 발견 없음**. `spec/6-brand.md §8.2.4` 가 CSS 변수 매핑 결정을 developer 에게 의도적으로 위임하고 있으며, `brand-refresh-impl.md §2` 가 이를 정확히 이행하는 구조다. 현재 in-progress plan 중 `spec/6-brand.md`, `globals.css`, `logo.svg` 영역을 동시에 손대는 다른 worktree 는 식별되지 않았다. 추적 가치가 있는 INFO 3건(plan 파일 main 부재, 위임 이행 remind, ai-review-subagent 단계 25 미완)만 기록되었으며, 어느 것도 착수 차단 조건이 아니다.
+
+---
+
+## 위험도
+
+NONE

```

---

### 파일 46: review/consistency/2026/05/15/18_49_57/rationale_continuity/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/15/18_49_57/rationale_continuity/review.md b/review/consistency/2026/05/15/18_49_57/rationale_continuity/review.md
new file mode 100644
index 00000000..459d82af
--- /dev/null
+++ b/review/consistency/2026/05/15/18_49_57/rationale_continuity/review.md
@@ -0,0 +1,71 @@
+# Rationale 연속성 검토 — spec/6-brand.md
+
+검토 모드: `--impl-prep` (구현 착수 전)
+검토 일시: 2026-05-15
+검토 대상: `spec/6-brand.md` §8 정식 개정 (옛 "초안" → 정식 Visual Identity)
+
+---
+
+## 발견사항
+
+### [INFO] 단색 워드마크 규정 폐기 — 명시적 Rationale 존재, 위반 없음
+
+- **target 위치**: `spec/6-brand.md §8.4.4` 및 `## Rationale R-3`
+- **과거 결정 출처**: `spec/6-brand.md` 구 §8.3 (임시 가이드 시절) *"단색 또는 단색 반전만 허용"*
+- **상세**: 옛 규정이 명시적으로 2-tone 워드마크를 금지하고 있었으나, 신규 §8.4.4 는 `vi` 강조를 정식 시그니처로 채택하면서 이를 번복했다. 단, R-3 이 폐기 이유(`vi` 어원 강조, 단일 워드마크의 이중 의미 전달, 옛 규정은 임시 가이드의 안전책)를 충분히 서술하고 있고, 기각된 대안(전체 단색 유지, `clem` 강조)도 명시되어 있다.
+- **제안**: Rationale 연속성 문제 없음. 번복의 근거가 문서 내에 완비되어 있어 추가 조치 불필요.
+
+---
+
+### [INFO] 타이포그래피 폰트 스택 변경 — 명시적 부분 폐기, Rationale 존재
+
+- **target 위치**: `spec/6-brand.md §8.3` 워드마크 base 폰트 정의 및 `## Rationale R-11`
+- **과거 결정 출처**: 구 §8.2 *"기존 프런트엔드의 폰트 스택을 그대로 유지한다. 별도 브랜드 폰트는 도입하지 않는다."*
+- **상세**: 본문·UI 는 기존 Geist Sans 를 유지하지만, 워드마크 한정으로 `Helvetica Neue, Helvetica, Arial, sans-serif` 시스템 스택을 채택했다. R-11 이 변경 이유(svg 정적 자산 특성상 Geist 미설치 환경에서 weight 200/600 fallback 보장 필요)를 명확히 서술하고, "부분 폐기"임을 문서화하고 있다.
+- **제안**: Rationale 연속성 문제 없음.
+
+---
+
+### [INFO] 임시 자산 경로 교체 — 옛 파일 폐기 및 신규 파일 추가, Rationale 존재
+
+- **target 위치**: `spec/6-brand.md §8.6`
+- **과거 결정 출처**: 구 §8 (초안) 임시 자산 목록 (`logo.svg`, `logo-mark.svg`, `icon.svg`, `favicon.ico` 4종)
+- **상세**: 옛 4종 자산이 폐기되고 9종으로 교체된다. R-1 (모티프 전환 근거), R-7 (자산 9종 정식화 근거) 에서 이 결정의 배경이 충분히 서술되어 있다.
+- **제안**: Rationale 연속성 문제 없음.
+
+---
+
+### [INFO] spec/2-navigation/_layout.md, spec/2-navigation/10-auth-flow.md 와의 우선권 관계 — 정합 확인
+
+- **target 위치**: `spec/6-brand.md §8.4.6` 및 `## Rationale R-9`
+- **과거 결정 출처**: 각 라우트 spec 의 로고 관련 기술
+- **상세**: `spec/6-brand.md R-9` 는 brand spec 이 개별 라우트 spec 보다 우선한다는 원칙을 명시했다. `spec/2-navigation/_layout.md R-1` 과 `spec/2-navigation/10-auth-flow.md R-1`, `R-2` 가 각각 이 우선권을 인정하고 brand spec 을 출처로 참조하고 있어 정합이 유지된다. `spec/2-navigation/10-auth-flow.md R-1` 은 그라데이션 배경 금지 규정을 §8.4.4 로부터 가져온 것으로, 자율적 추론이 아닌 brand spec 의 단일 진실 원칙을 따른 것이다.
+- **제안**: 정합 완료. 추가 조치 불필요.
+
+---
+
+### [WARNING] 다크 모드 토큰 "후속 plan 분리" 대안 기각 — 적절하나 Rationale 에서 추론 범위 확인
+
+- **target 위치**: `spec/6-brand.md §8.2.3` (Dark Mode 토큰 동시 도입) 및 `## Rationale R-4`
+- **과거 결정 출처**: 구 §8 (초안) 은 다크 모드 토큰을 명시하지 않았으며, 후속 plan 분리가 묵시적 기본값이었다.
+- **상세**: R-4 는 다크 모드 토큰을 동시 도입한 이유(자산이 이미 light/dark 페어로 제공됨, 라이트만 먼저 도입하면 다크 자산을 ad-hoc 으로 만드는 시기 발생, 정식 가이드 시점에 함께 정의하는 비용이 최저)와 기각된 대안(다크 모드 후속 plan 분리)을 명시하고 있다. Rationale 연속성 상 "묵시적 방침 번복" 에 해당하나 근거가 문서화되어 있다.
+- **제안**: 경계선상 WARNING. 구 §8 (초안) 이 다크 모드를 "디자이너 협업 이후 교체" 범주로 미정으로 두었던 점에서, 이 변경이 명시적 기각은 아니므로 CRITICAL 등급은 아니다. 현재 R-4 의 기술로 충분히 정당화된다.
+
+---
+
+### [INFO] 코드 토큰 매핑 구현 위임 — spec 의 직접 결정 기피 여부
+
+- **target 위치**: `spec/6-brand.md §8.2.4` 및 `## Rationale R-10`
+- **과거 결정 출처**: 없음 (신규 정책)
+- **상세**: R-10 은 시각 토큰과 코드 토큰의 책임을 분리한 이유(spec 의 책임은 디자인 의도, 코드 토큰 이름은 기존 코드베이스 컨벤션과의 정합 필요)를 명확히 서술하고, §8.2.4 에 권장 매핑 방향도 제시한다. `developer` skill 의 Stage 2 에 구체적인 매핑 결정을 위임하는 구조가 명시적이다.
+- **제안**: Rationale 연속성 문제 없음.
+
+---
+
+## 요약
+
+`spec/6-brand.md §8` 의 정식 개정은 옛 "초안" 섹션에서 묵시적으로 적용되던 단색 워드마크 규정, 폰트 스택 방침, 임시 자산 목록, 다크 모드 미정 상태를 모두 번복하거나 대체하고 있다. 각 번복 결정은 문서 내 `## Rationale R-1 ~ R-12` 에 명시적 근거와 기각된 대안이 함께 서술되어 있어, Rationale 연속성 원칙을 충실히 준수하고 있다. 관련 라우트 spec (`_layout.md`, `10-auth-flow.md`) 도 brand spec 의 우선권을 인정하는 Rationale 을 신설하여 정합이 유지된다. 유일한 경계 사례는 다크 모드 토큰의 "묵시적 후속 plan 분리" 방침 번복이나, R-4 의 기술로 충분히 정당화된다. 전반적으로 기각된 결정의 무근거 재도입이나 합의된 invariant 위반은 발견되지 않았다.
+
+## 위험도
+
+NONE

```

---

### 파일 47: spec/2-navigation/10-auth-flow.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/2-navigation/10-auth-flow.md b/spec/2-navigation/10-auth-flow.md
index b88daaa0..5677d520 100644
--- a/spec/2-navigation/10-auth-flow.md
+++ b/spec/2-navigation/10-auth-flow.md
@@ -22,7 +22,8 @@
 ```
 
 - 중앙 정렬 카드 형태 (최대 너비 400px)
-- 배경: 제품 브랜드 색상 또는 그래디언트
+- 배경: `soil-50` (`#f7f8f6`) 단색. 그라데이션 금지. 색 토큰·예외 정의는 [`spec/6-brand.md` §8.4.4](../6-brand.md#844-워드마크-사용-규정) 참조
+- 카드 상단의 `[Logo]` 자리에는 **Full logo (light)** 변종을 사용 (변종 매트릭스: [`spec/6-brand.md` §8.4.1](../6-brand.md#841-변종-매트릭스))
 - 반응형: 모바일에서 카드가 전체 너비 확장
 
 ---
@@ -401,3 +402,17 @@
 | GET | /api/auth/oauth/:provider | OAuth 시작 (리다이렉트) |
 | GET | /api/auth/oauth/:provider/callback | OAuth 콜백 |
 | POST | /api/auth/check-email | 이메일 중복 확인 (가입 폼 실시간 검증용) |
+
+---
+
+## Rationale
+
+### R-1. 인증 화면 배경 — `soil-50` 단색 (2026-05-15)
+
+§1 배경 기술을 *"제품 브랜드 색상 또는 그래디언트"* → *"`soil-50` 단색, 그라데이션 금지"* 로 구체화한 이유: `spec/6-brand.md §8.4.4` 의 로고 사용 규정이 *그라데이션 배경* 을 명시적으로 금지(개정 후). 본 문서의 자리 정의는 brand spec 의 규정을 따른다 (`spec/6-brand.md` R-9 — 브랜드 spec 의 라우트 spec 우선권).
+
+### R-2. `[Logo]` 자리 변종 명시 (2026-05-15)
+
+§1 의 `[Logo]` 플레이스홀더에 *"Full logo (light) 변종 사용"* 을 추가한 이유: 본 문서는 로고가 노출되는 **자리**를 정의하고, 자리에 들어가는 변종은 brand spec §8.4.1 매트릭스가 결정한다. 인증 화면은 라이트 배경(`soil-50`)이므로 Full logo (light) 가 매트릭스에서 선택된다.
+
+근거 출처: `spec/6-brand.md §8.4.1`, `§8.4.6`. 사전 일관성 검토 세션: `review/consistency/2026/05/15/18_36_51/`.

```

---

### 파일 48: spec/2-navigation/_layout.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/2-navigation/_layout.md b/spec/2-navigation/_layout.md
index 2d556733..b45dce80 100644
--- a/spec/2-navigation/_layout.md
+++ b/spec/2-navigation/_layout.md
@@ -48,7 +48,7 @@
 
 | 영역 | 위치 | 내용 |
 |------|------|------|
-| 로고 | 상단 | 제품 로고. 클릭 시 대시보드(홈, `/dashboard`)로 이동 |
+| 로고 | 상단 | 제품 로고. 사이드바 expanded 상태에서는 **Full logo (light)** , collapsed 상태에서는 **Icon mark** 를 표시. 클릭 시 대시보드(홈, `/dashboard`)로 이동. 자세한 변종·색은 [`spec/6-brand.md` §8.4](../6-brand.md#84-로고-시스템) 참조 (변종·색의 단일 진실은 brand spec) |
 | 메인 메뉴 | 중앙 | 내비게이션 항목 목록 |
 | 사용자 영역 | 하단 | 아바타 + 사용자 이름 |
 
@@ -134,3 +134,13 @@
 | 페이지 제목 | 현재 페이지 이름 (예: "Workflows", "Schedule") |
 | 설명/브레드크럼 | 하위 페이지의 경우 브레드크럼 표시 |
 | 액션 버튼 | 페이지별 주요 액션 (예: "+ New Workflow", "+ Add Schedule") |
+
+---
+
+## Rationale
+
+### R-1. 사이드바 로고 변종 규칙 (2026-05-15)
+
+§2.1 로고 행에 expanded/collapsed 변종 규칙을 추가한 이유: 본 문서는 사이드바의 **자리**만 정의하고, 자리에 들어가는 로고 변종·색은 `spec/6-brand.md §8.4` (brand spec) 가 단일 진실로 결정한다. 본 행은 brand spec §8.4.6 의 결정(expanded → Full logo / collapsed → Icon mark)을 자리 정의에 반영한 것이다.
+
+근거 출처: `spec/6-brand.md §8.4.6` (로고 노출 자리) 및 동 문서 R-9 (브랜드 spec 의 라우트 spec 우선권). 사전 일관성 검토 세션: `review/consistency/2026/05/15/18_36_51/`.

```

---

### 파일 49: spec/6-brand.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/6-brand.md b/spec/6-brand.md
index 7eed724d..210a1a76 100644
--- a/spec/6-brand.md
+++ b/spec/6-brand.md
@@ -49,51 +49,225 @@ Clemvion은 사람이 모든 흐름을 통제하던 시대에서, **지능이 
 
 ---
 
-## 8. Visual Identity (초안)
+## 8. Visual Identity
 
-> 본 섹션은 임시 가이드다. 디자이너 협업으로 정식 비주얼 가이드가 마련되면 교체한다. 임시 자산:
-> - `frontend/public/logo.svg` — 워드마크
-> - `frontend/public/logo-mark.svg` — 심볼 (덩굴 + 잎)
-> - `frontend/src/app/icon.svg` — Next.js 메타데이터 favicon (svg 지원)
-> - `frontend/src/app/favicon.ico` — 기존 파일 유지
-> - `apple-icon`은 Next.js가 svg를 지원하지 않으므로 정식 PNG 자산 도입 시 추가한다.
+### 8.1 디자인 모티프
 
-### 8.1 컬러 (1차 제안)
+Clemvion 의 로고는 워크플로우의 **노드 그래프** 그 자체를 형상화한다. 중앙의 수직 흐름선(spine), 좌우로 뻗은 분기선(branches), 그리고 그래프 위에 흩어진 원형 노드들이 한 덩어리로 잎/흐름의 형태를 이룬다.
 
-| 토큰 | HEX | 용도 |
+- spine — 중앙 수직 흐름 (Living Workflow 의 *변하지 않는 주축*)
+- branches — 좌우로 뻗은 분기 (Agent-Native Nodes 의 *판단·적응*)
+- nodes — 각 단계의 실행 단위 (`Deep Integration`)
+
+이 모티프는 *"흐름은 자라나야 한다"* 는 Brand Story (§2) 의 시각적 환원이다.
+
+### 8.2 컬러 토큰
+
+#### 8.2.1 Vine Ramp — Primary (라이트 모드)
+
+| 토큰 | HEX | 역할 |
 | --- | --- | --- |
-| Vine Green (Primary) | `#1F8A4C` | 주요 액션·로고·강조 |
-| Deep Forest | `#0F3D2A` | 다크 배경·헤더 |
-| Bud Lime | `#A8D86F` | 보조 강조·success state |
-| Bark | `#6B5544` | 텍스트 보조·보더 |
-| Soil | `#F4F1EC` | 라이트 배경 |
-| Ink | `#111111` | 본문 텍스트 |
+| `vine-900` (Deep Vine) | `#1a4f2c` | 루트 노드, 텍스트 강조, 다크 액션 hover |
+| `vine-800` (Spine) | `#2a7040` | 중앙 흐름 stroke (mark 내부) |
+| `vine-700` (Primary) | `#1e7a42` | **주요 액션**, 워드마크 `vi` 강조, 1차 브랜드 컬러 |
+| `vine-600` (Branch) | `#2a8a48` | 1차 분기 노드 |
+| `vine-500` (Leaf) | `#3a9a58` | 2차 분기 노드, 보조 강조 |
+| `vine-400` (Sprout) | `#4ab868` | 하위 분기 노드, success state |
+| `vine-300` (Mist) | `#5ab872` | 외곽 라인, 서브카피 |
 
-식물·자연 모티브의 톤을 기본으로 한다. 채도를 낮춰 차분하게 유지하고, 강조는 Vine Green / Bud Lime의 대비로 만든다.
+#### 8.2.2 Neutral — 라이트 모드
 
-### 8.2 타이포그래피
+| 토큰 | HEX | 역할 |
+| --- | --- | --- |
+| `ink` | `#0e1a12` | 본문 텍스트, 워드마크 base |
+| `ink-60` | `#0e1a12` @ 60% opacity | 보조 텍스트 (옛 `Bark` 대체) |
+| `ink-40` | `#0e1a12` @ 40% opacity | 비활성 텍스트, hint |
+| `soil-50` | `#f7f8f6` | 페이지 배경 |
+| `soil-100` | `#eef5ec` | 카드/마크 배경 (라운드된 mark 컨테이너 fill) |
+| `vine-border` | `#e4e8e0` | 카드 보더 (Tailwind/Shadcn `--border` 와 충돌 방지 위해 `vine-border` 로 명명) |
+
+#### 8.2.3 Dark Mode
 
-| 용도 | 폰트 |
+| 토큰 | HEX | 역할 |
+| --- | --- | --- |
+| `vine-dark-bg-base` | `#0e1210` | 페이지 배경 |
+| `vine-dark-bg-elevated` | `#111e14` | 카드/마크 컨테이너 배경 |
+| `vine-dark-mid` | `#1e4a2a` | 스파인 조인트 (톤 다운된 점) |
+| `vine-dark-spine` | `#3aae58` | 다크 spine stroke |
+| `vine-dark-primary` | `#4fce72` | 다크 액션, 1차 분기 노드 |
+| `vine-dark-leaf` | `#7de890` | 다크 2차 분기 노드 |
+| `vine-dark-accent` | `#6edc8e` | 다크 워드마크 `vi` 강조 |
+| `vine-dark-glow` | `#9efab2` | 루트 노드 (가장 밝은 강조점) |
+| `text-on-dark` | `#e8f5ec` | 다크 본문 텍스트, 워드마크 base (Tailwind `text-{shade}` 및 `dark:` variant 와 충돌 방지 위해 `text-on-dark` 로 명명) |
+
+light↔dark 페어 대응 (구현 시 prefers-color-scheme / theme provider 가 자동 전환):
+
+| 라이트 | 다크 |
 | --- | --- |
-| 본문·UI | **Geist Sans** (현재 frontend `next/font/google` 적용) |
-| 코드·모노 | **Geist Mono** |
-| 워드마크 | Geist Sans Medium / 자간 `-0.01em` |
+| `soil-50` | `vine-dark-bg-base` |
+| `soil-100` | `vine-dark-bg-elevated` |
+| `ink` | `text-on-dark` |
+| `vine-700` (primary 액션·워드마크 accent) | `vine-dark-accent` |
+| `vine-800` (spine stroke) | `vine-dark-spine` |
+| `vine-600` (1차 branch) | `vine-dark-primary` |
+| `vine-500` (2차 branch) | `vine-dark-leaf` |
+| `vine-900` (루트 노드) | `vine-dark-glow` |
+| `vine-300` (서브카피) | `vine-dark-primary` |
+
+#### 8.2.4 코드 토큰 매핑 (구현 위임 정책)
+
+본 §8.2 는 **시각 토큰의 의미·HEX 정의**다. CSS 변수 명(`frontend/src/app/globals.css` 의 `--primary`, `--background`, `--foreground`, `--border`, `--muted-foreground` 등) 및 Tailwind theme key 로의 매핑은 `developer` skill 의 Stage 2 (`plan/in-progress/brand-refresh-impl.md`) 에서 수행한다. 그 이유는 R-10 참고.
+
+매핑 시 권장 방향 (구현자 결정):
+
+- `vine-700` → `--primary` (현행 HSL `222.2 47.4% 11.2%` 폐기)
+- `ink` → `--foreground`
+- `ink-60` / `ink-40` → `--muted-foreground` 등 보조 토큰
+- `soil-50` → `--background`
+- `soil-100` → `--card`
+- `vine-border` → `--border`
+- `vine-dark-*` → 다크 `:root` 페어
+- `text-on-dark` → `--foreground` (다크 모드)
+
+#### 8.2.5 폐기된 토큰
+
+이전 §8.1 (임시) 의 다음 토큰은 본 개정 발효와 함께 폐기된다. 코드/문서/디자인 자산에서 발견 시 신 토큰으로 마이그레이션한다. (근거: R-1, R-7)
 
-기존 프런트엔드의 폰트 스택을 그대로 유지한다. 별도 브랜드 폰트는 도입하지 않는다.
+| 폐기 토큰 (대문자 원본명) | 폐기 HEX | 대체 토큰 (소문자 신규명) |
+| --- | --- | --- |
+| `Vine Green` (Primary) | `#1F8A4C` | `vine-700` `#1e7a42` |
+| `Deep Forest` | `#0F3D2A` | `vine-dark-bg-elevated` `#111e14` |
+| `Bud Lime` | `#A8D86F` | `vine-400` `#4ab868` |
+| `Bark` | `#6B5544` | 제거. 텍스트 보조는 `ink-60` / `ink-40` (§8.2.2) |
+| `Soil` | `#F4F1EC` | `soil-50` `#f7f8f6` |
+| `Ink` | `#111111` | `ink` `#0e1a12` |
+
+> 잔재 검출 명령 (Stage 2 마무리 시 0건 확인). 신·구 토큰의 대소문자 차이를 활용해 단어 경계·대문자 한정 패턴으로 신 토큰 오탐을 회피한다:
+>
+> ```bash
+> grep -rnE '\bVine Green\b|\bBud Lime\b|\bDeep Forest\b|\bBark\b|\bSoil\b|#1F8A4C|#A8D86F|#0F3D2A|#6B5544|#F4F1EC|#111111' spec/ frontend/
+> grep -rnE '\bInk\b' spec/ frontend/   # 대문자 한정. 신 토큰 'ink' (소문자) 는 제외됨
+> ```
+
+#### 8.2.6 일시 불일치 허용 윈도우
+
+본 §8 발효 시점부터 Stage 2 (`brand-refresh-impl.md`) 완료까지, `frontend/` 의 CSS 변수·SVG 자산은 일시적으로 spec 의 신 토큰과 불일치할 수 있다. 이는 Stage 2 마무리에서 §8.2.5 의 grep 0 건 조건으로 해소된다.
+
+### 8.3 타이포그래피
+
+| 용도 | 폰트 | 비고 |
+| --- | --- | --- |
+| 본문·UI | **Geist Sans** | 기존 `next/font/google` 유지 |
+| 코드·모노 | **Geist Mono** | 기존 유지 |
+| 워드마크 base | system sans-serif (`Helvetica Neue`, `Helvetica`, `Arial`) | weight **200**, letter-spacing `-0.5px`, font-size 26px (full logo 기준) |
+| 워드마크 accent (`vi`) | 동일 폰트 | weight **600**, color = `vine-700` (light) / `vine-dark-accent` (dark) |
+| 서브카피 (`AGENTIC WORKFLOW`) | monospace (`Courier New`) | font-size 8px, letter-spacing 3px, uppercase, color = `vine-300` (light) / `vine-dark-primary` (dark) |
+
+워드마크 svg 가 fontFamily 에 시스템 폰트 스택을 명시하는 이유는 Geist 미설치 환경에서의 weight 200/600 fallback 안정성 (R-11 참조).
+
+### 8.4 로고 시스템
+
+#### 8.4.1 변종 매트릭스
+
+| 변종 | 정식 경로 | 사용처 |
+| --- | --- | --- |
+| Full logo (light) | `frontend/public/logo.svg` | 라이트 배경 풀로고 — mark + wordmark + sub-copy 동반 |
+| Full logo (dark) | `frontend/public/logo-dark.svg` | 다크 배경 풀로고 |
+| Icon mark (light, 96px master) | `frontend/public/logo-mark.svg` | 사이드바, 로딩, 카드 |
+| Icon mark (dark) | `frontend/public/logo-mark-dark.svg` | 다크 배경 mark |
+| Wordmark only | `frontend/public/logo-wordmark.svg` | 좁은 자리 — sub-copy 없이 텍스트만 |
+| Favicon multi (16/32/48 합성) | `frontend/src/app/favicon.ico` | 브라우저 탭 |
+| App icon (Next.js metadata) | `frontend/src/app/icon.svg` | 32px 기본, Next.js 자동 노출 |
+| Apple touch icon | `frontend/src/app/apple-icon.png` (180×180 PNG) | iOS 홈스크린 |
+| OG / Twitter card | `frontend/src/app/opengraph-image.png` (1200×630 PNG) | SNS 공유 미리보기 |
 
-### 8.3 로고 사용 규정 (초안)
+#### 8.4.2 16px 전용 변종 (favicon 가독성)
 
-- **워드마크** (`logo.svg`): 단색 텍스트 "Clemvion". 기본 색상은 Ink (`#111`) 또는 Vine Green. 배경 대비가 부족할 때만 White로 사용한다.
-- **심볼** (`logo-mark.svg`): 덩굴이 위로 자라는 단순화된 곡선 모티브. favicon·앱 아이콘 용도.
-- **여백**: 워드마크 주변에 `x-height` 만큼의 클리어 스페이스를 둔다.
-- **금지**: 그림자·그라데이션·외곽선·회전·왜곡. 단색 또는 단색 반전만 허용한다.
+favicon 16×16 은 96px master 의 단순 축소가 아니라 **별도 vector 자산**으로 둔다. 노드는 4개 이하, 라인은 3개 이하로 단순화한다. OS 탭에서 mark 의 형태가 식별 가능해야 한다.
 
-### 8.4 어조와 스타일
+#### 8.4.3 풀로고 구성
+
+풀로고는 항상 **3요소 동반**:
+
+1. Icon mark (좌)
+2. Wordmark `clem`**`vi`**`on` (중앙)
+3. Sub-copy `AGENTIC WORKFLOW` (wordmark 아래)
+
+Sub-copy 는 풀로고에서 **상시** 부착한다 — 마케팅 페이지·제품 헤더·이메일 서명·OG 이미지 등 풀로고가 노출되는 모든 자리. Sub-copy 없이 wordmark 만 필요한 경우 §8.4.1 의 **Wordmark only** 변종을 별도 사용한다.
+
+풀로고 기본 viewBox: `260 × 80` (icon mark 64×64 + 좌측 여백 16 + wordmark+sub-copy 영역).
+
+#### 8.4.4 워드마크 사용 규정
+
+워드마크는 **2-tone** 처리를 정식 허용한다. 옛 *"단색 또는 단색 반전만 허용"* 조항은 본 항으로 무효화된다 (R-3 참조).
+
+- **Base** — weight 200
+  - 라이트 배경: `ink` (`#0e1a12`)
+  - 다크 배경: `text-on-dark` (`#e8f5ec`)
+- **Accent** (`vi` 두 글자) — weight 600
+  - 라이트 배경: `vine-700` (`#1e7a42`)
+  - 다크 배경: `vine-dark-accent` (`#6edc8e`)
+
+**예외**: 흑백 인쇄·1bit 출력 등 컬러 표현이 불가능한 매체에서는 accent 도 base 와 동일 색으로 합쳐 단색 처리한다. 가능한 한 2-tone 을 유지하는 것이 원칙이다.
+
+여전히 금지: 그라데이션 배경, 외곽선, 그림자, 회전, 왜곡, 임의 색상 치환. 로고가 노출되는 배경에도 그라데이션을 사용하지 않는다.
+
+#### 8.4.5 여백·최소 크기
+
+| 항목 | 규정 |
+| --- | --- |
+| Clear space | 워드마크 `clemvion` 의 x-height 만큼. 풀로고의 모든 외곽에 적용 |
+| 최소 풀로고 너비 | **160px**. 그 이하에서는 icon-only 또는 wordmark-only 로 전환 |
+| 최소 icon mark 변 | **16px**. 그 이하 사용 금지 |
+| 풀로고 / wordmark 표시 | 가로 배치 고정. 세로 스택 변종은 본 가이드에서 다루지 않음 |
+
+#### 8.4.6 로고 노출 자리 (제품 사양 차원)
+
+본 §8 은 다음 자리에서의 로고 노출을 정식 사양으로 둔다. 본 항은 개별 라우트 spec (`spec/2-navigation/_layout.md`, `spec/2-navigation/10-auth-flow.md` 등) 의 로고 기술보다 **우선**한다 — 본 §8 이 단일 진실(single source of truth) 이며, 개별 라우트 spec 은 노출 위치만 정의하고 변종·색은 본 §8 을 따른다 (R-9 참조).
+
+| 자리 | 변종 | 비고 |
+| --- | --- | --- |
+| 사이드바 상단 ([`spec/2-navigation/_layout.md` §2.1](./2-navigation/_layout.md#21-구성)) | expanded → Full logo (light) / collapsed → Icon mark | 클릭 시 `/dashboard` |
+| 인증 화면 (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`) | Full logo (light) | 카드 컨테이너 위 중앙 배치. 배경은 `soil-50` 단색 (그라데이션 금지, §8.4.4). 자세한 자리 정의는 [`spec/2-navigation/10-auth-flow.md` §1](./2-navigation/10-auth-flow.md#1-화면-구성-개요) |
+| 브라우저 탭 | Favicon multi | 라이트/다크 자동 전환은 브라우저 표준 동작에 위임 |
+| iOS 홈스크린 | Apple touch icon | 180×180 PNG |
+| SNS / 외부 공유 | OG image | `/` 와 `/dashboard` 메타데이터 |
+
+다크 모드 적용 시 위 자리들도 dark 변종으로 자동 전환된다 (구현은 `developer` 가 prefers-color-scheme 또는 theme provider 로 처리).
+
+### 8.5 어조와 스타일
 
 - 한국어를 1차 언어로 한다. 영어 표기는 제품명·고유명사에 한정한다.
 - 의인화·유사 자연 비유(자라다, 뻗다, 엮다, 흐름)를 핵심 마케팅 카피에 사용한다.
 - 기능 설명에서는 과장·감탄사 없이 짧고 단정한 문장을 쓴다.
 
+### 8.6 임시 자산 마이그레이션
+
+(근거: R-1, R-7)
+
+이전 임시 자산 (덩굴 + 잎 곡선 모티프) 은 본 §8 발효와 함께 폐기 대상이다:
+
+폐기 (옛 자산):
+
+- `frontend/public/logo.svg` (옛 덩굴 곡선)
+- `frontend/public/logo-mark.svg` (옛 심볼)
+- `frontend/src/app/icon.svg` (옛 32px favicon)
+- `frontend/src/app/favicon.ico` (옛 단일 사이즈)
+
+신규 (§8.4.1 정식 자산 — 9종 전체):
+
+- `frontend/public/logo.svg` *(교체)* — Full logo (light)
+- `frontend/public/logo-dark.svg` *(추가)* — Full logo (dark)
+- `frontend/public/logo-mark.svg` *(교체)* — Icon mark (light, 96px master)
+- `frontend/public/logo-mark-dark.svg` *(추가)* — Icon mark (dark)
+- `frontend/public/logo-wordmark.svg` *(추가)* — Wordmark only
+- `frontend/src/app/favicon.ico` *(교체)* — multi-size 합성 (16/32/48)
+- `frontend/src/app/icon.svg` *(교체)* — Next.js metadata icon
+- `frontend/src/app/apple-icon.png` *(추가)* — Apple touch icon 180×180
+- `frontend/src/app/opengraph-image.png` *(추가)* — OG image 1200×630
+
+마이그레이션 작업은 `plan/in-progress/brand-refresh-impl.md` (Stage 2) 에서 `developer` skill 이 수행한다. 그 동안의 일시 불일치는 §8.2.6 에서 허용 명시.
+
 ---
 
 ## 9. 변경 이력
@@ -101,3 +275,136 @@ Clemvion은 사람이 모든 흐름을 통제하던 시대에서, **지능이 
 | 일자 | 항목 | 비고 |
 | --- | --- | --- |
 | 2026-05-05 | 최초 작성 | 제품명을 Idea Workflow → Clemvion으로 전환하며 브랜드 가이드 신설 |
+| 2026-05-15 | §8 정식 개정 | 옛 *Visual Identity (초안)* §8.1–§8.4 전면 폐기. Node-graph 모티프 정식 채택, Vine ramp 7단계 + Neutral + Dark 토큰 동시 도입, 워드마크 2-tone 허용, `AGENTIC WORKFLOW` 서브카피 상시 부착, 자산 9종 정식화. 옛 6개 토큰(Vine Green/Deep Forest/Bud Lime/Bark/Soil/Ink) 폐기·재정의. 동반 동기화: `spec/2-navigation/_layout.md` §2.1, `spec/2-navigation/10-auth-flow.md` §1 |
+
+---
+
+## Rationale
+
+본 섹션은 §8 정식 개정의 배경·근거·기각된 대안을 inline 으로 보관한다.
+
+### R-1. 덩굴 곡선 → 노드 그래프 모티프 전환
+
+**결정**: 옛 임시 자산의 "덩굴이 위로 자라는 곡선 + 잎" 모티프를 폐기하고, "노드 그래프 형태로 자라난 잎" 모티프로 정식화.
+
+**근거**:
+- 제품 정체성(§3, §4)이 *Agent-Native Nodes* 와 *Living Workflow* 인데, 곡선 모티프는 이 정체성을 전달하지 못했다 — 일반적인 식물·자연 브랜드와 차별이 약하다.
+- 노드 그래프 모티프는 워크플로우 빌더의 캔버스를 그대로 축약한 형태로, 사용자가 *제품의 본질을 그대로 본다*.
+- Brand Story (§2) 의 "*보이지 않는 구조를 따라 유연하게 뻗어 나가며*" 는 곡선보다 노드+분기 구조에서 더 직접적으로 전달된다.
+
+**기각된 대안**:
+- 단순 wordmark only (mark 없음) — favicon·앱 아이콘 자리에서 식별성이 떨어짐.
+- 추상 기호 (단일 도형) — 제품의 워크플로우 정체성과의 연결이 약함.
+
+### R-2. 4-step → 7-step Vine ramp 도입
+
+**결정**: 옛 3색 (Vine Green / Bud Lime / Deep Forest) 체계 → 7단계 Vine ramp (`vine-300 ~ vine-900`) 로 확장.
+
+**근거**:
+- 노드 그래프 mark 자체가 깊이별 다른 톤을 요구한다 (루트 노드 = 가장 짙음, 외곽 분기 = 가장 옅음). 컨셉 자산의 light 모드 mark 가 이미 4톤을 사용하고 있어, 토큰화 없이는 일관성 관리가 불가능하다.
+- 7단계 ramp 는 success state · hover state · disabled state · 차트 시리즈 컬러까지 단일 brand 안에서 처리 가능하게 한다 (별도 Bud Lime 없이도).
+- 코드 매핑 시 `vine-300 ~ vine-900` 의 한 자릿수 차이로 의도를 명확히 표현 가능 (Tailwind 컨벤션과 정합).
+
+**기각된 대안**:
+- 옛 3색 유지 + Bud Lime 강화 — 토큰 부족으로 mark 내부 톤 표현 불가, 다크 모드 매핑 모호.
+
+### R-3. 워드마크 2-tone 시그니처 채택 (단색 규정 폐기)
+
+**결정**: 워드마크 `clem**vi**on` 의 `vi` 두 글자를 별도 weight + 색(vine-700) 으로 강조하는 2-tone 처리를 정식 시그니처로 채택.
+
+**기각된 규정 원출처**: `spec/6-brand.md` 구 §8.3 (임시 가이드 시절 조항) 의 *"단색 또는 단색 반전만 허용"*. 본 개정에서 §8.4.4 로 무효화.
+
+**근거**:
+- `vi` 강조는 "**vi**ne" 어원을 시각적으로 환기하면서, 동시에 *agentic* (AI / vision / vital) 의 머리글자처럼 읽힐 여지를 만든다 — 단일 워드마크가 두 의미를 동시에 전달.
+- 옛 단색 규정은 임시 가이드의 안전책이었고, 정식 가이드에서는 시그니처 강도가 더 중요하다.
+- 흑백·1bit 출력 같은 컬러 표현 불가 매체는 §8.4.4 의 예외 절로 처리.
+
+**기각된 대안**:
+- 워드마크 전체 단색 유지 — 시그니처 약함, 다른 SaaS wordmark 와의 차별성 부족.
+- `clem` 강조 — 어원과 무관해 의미 전달 실패.
+
+### R-4. 다크 모드 토큰 동시 도입
+
+**결정**: 본 개정에서 light/dark 페어를 동시 정식화 (별도 plan 으로 분리하지 않음).
+
+**근거**:
+- 컨셉 자산이 light/dark 페어를 모두 제시했고, 라이트만 먼저 도입할 경우 다크 자산을 ad-hoc 으로 만드는 시기가 생긴다 (브랜드 일관성 위협).
+- 다크 모드는 워크플로우 에디터·코드 편집 화면에서 자주 요구되는 모드라, 정식 가이드 시점에 함께 정의해 두는 비용이 가장 낮다.
+- 토큰 페어(`vine-700` ↔ `vine-dark-accent` 등) 로 §8.2.3 에 명시함으로써, 자동 매핑(prefers-color-scheme, theme provider) 도입이 단순해진다.
+
+**기각된 대안**:
+- 다크 모드를 후속 plan 으로 분리 — 자산이 2회 점프해야 하고, 폐기 토큰 행렬이 두 번 갱신되어 변경 이력이 더 복잡해짐.
+
+### R-5. `AGENTIC WORKFLOW` 서브카피 상시 부착
+
+**결정**: 풀로고에 sub-copy 를 상시 동반. sub-copy 없는 사용처는 별도 wordmark-only 변종으로 분리.
+
+**근거**:
+- 제품명 `Clemvion` 만으로는 카테고리 인지가 어렵다 (식물 어원이 직관적으로 워크플로우/AI 를 떠올리게 하지 않음). 카테고리 디스크립터를 항상 노출해 외부 노출(OG, 이메일, 명함) 에서 즉시 *무엇을 하는 제품인지* 전달.
+- 풀로고에서 sub-copy 를 제거할지 말지를 매번 판단하지 않게 함 → 사용자(디자이너·구현자) 의 결정 비용 감소.
+- sub-copy 가 필요 없는 좁은 자리는 wordmark-only 변종을 쓰면 되므로 손해가 없음.
+
+**기각된 대안**:
+- sub-copy 를 마케팅 노출에서만 사용 — 풀로고 변종이 사실상 2개(with/without) 가 되어 가이드가 복잡해짐.
+
+### R-6. 16px 전용 별도 vector
+
+**결정**: favicon 16×16 은 96px master 의 축소판이 아니라 별도 vector 자산으로 둔다.
+
+**근거**:
+- 컨셉 자산의 16px 카드를 검토한 결과, 96px 의 모든 노드·라인을 그대로 축소하면 OS 탭에서 흙뭉치로 보일 위험이 명백하다 (anti-alias 한계).
+- 노드 ≤ 4 / 라인 ≤ 3 으로 단순화한 별도 vector 를 두면, 어느 사이즈에서도 mark 의 식별성이 보장된다.
+
+### R-7. 자산 9종 정식화 + 폐기 토큰 매트릭스 명시
+
+**결정**: §8.4.1 에 9개 자산 경로를 정식 명시, §8.2.5 에 폐기 토큰 ↔ 대체 토큰 1:1 매핑 명시.
+
+**근거**:
+- Stage 2 (developer) 가 spec 만 보고 어떤 파일을 어디에 배치하고, 옛 토큰을 무엇으로 교체할지 결정할 수 있어야 한다. 모호한 가이드는 구현 시점에 즉흥 결정으로 이어진다.
+- 폐기 매트릭스는 grep 가능한 형태로 두어, 향후 정합성 검토 시 자동 검출 가능하게 함.
+
+### R-8. 토큰 네이밍에서 일반 단어 회피
+
+**결정**: Neutral 토큰의 보더를 `border` 가 아닌 `vine-border` 로, 다크 모드 텍스트를 `text-dark` 가 아닌 `text-on-dark` 로 명명.
+
+**근거**:
+- 코드 베이스의 Tailwind / Shadcn 컨벤션이 `--border` CSS 변수 및 `text-{shade}` 유틸리티 / `dark:` variant 를 광범위하게 사용 중. 동일 이름의 spec 토큰을 두면 구현자가 "재정의" 인지 "별도 토큰" 인지 매번 판단해야 한다.
+- Brand 토큰임을 prefix(`vine-`) 또는 의미(`on-dark`) 로 분명히 함으로써 grep 시 의도 식별이 용이.
+- `vine-border` 가 CSS 변수 `--border` 에 매핑되더라도, 그 매핑은 §8.2.4 에서 명시적으로 선언된다.
+
+### R-9. 브랜드 spec 의 라우트 spec 대비 우선권
+
+**결정**: §8.4.6 (로고 노출 자리) 가 개별 라우트 spec (`spec/2-navigation/_layout.md`, `spec/2-navigation/10-auth-flow.md` 등) 의 로고 기술보다 우선한다.
+
+**근거**:
+- 브랜드 자산의 변종·색은 단일 진실(single source of truth) 원칙상 한 곳에서만 정의되어야 한다. 라우트 spec 에 색·변종을 박으면 brand spec 개정 시 N 군데를 동기화해야 한다.
+- 라우트 spec 은 "로고가 어디에 노출되는가" (자리) 만 정의하고, 변종·색은 brand spec 을 참조하도록 책임 분리.
+- 본 §8.4.6 자체에 자리 매핑이 명시되어 있으므로, 라우트 spec 간 충돌 시 §8.4.6 이 결정권자.
+
+### R-10. 시각 토큰과 코드 토큰의 분리 (구현 위임)
+
+**결정**: §8.2 는 시각 토큰(이름 + HEX) 만 정의하고, CSS 변수 명·Tailwind theme key 는 `developer` 의 Stage 2 가 결정한다.
+
+**근거**:
+- spec 의 책임은 *디자인 의도* 의 표현이고, 구현 토큰 이름은 *기존 코드베이스의 컨벤션* (Shadcn `--primary`, `--background` 등) 과 정합해야 한다. 두 책임을 분리하지 않으면 spec 개정 때마다 코드 검토가 강제된다.
+- §8.2.4 에 권장 매핑 방향을 힌트로 제공함으로써 구현 즉흥화 방지.
+- 코드 토큰 이름 변경 시 spec 을 건드리지 않고도 가능 (개발자 권한 안에서 처리).
+
+### R-11. 워드마크 폰트 스택에 system 명시 (옛 §8.2 "별도 브랜드 폰트 도입 안 함" 방침의 부분 폐기)
+
+**결정**: 워드마크 svg 가 fontFamily 에 `Helvetica Neue, Helvetica, Arial, sans-serif` 시스템 스택을 명시. 워드마크 한정으로 Geist Sans 사용 안 함. 본문·UI 폰트는 여전히 Geist Sans.
+
+**부분 폐기**: 옛 §8.2 의 *"기존 프런트엔드의 폰트 스택을 그대로 유지한다. 별도 브랜드 폰트는 도입하지 않는다"* 방침은 본 결정으로 워드마크 한정 부분 폐기. 본문·UI 영역에는 여전히 유효.
+
+**근거**:
+- svg 는 정적 자산으로 모든 환경에 그대로 임베드되며, 사용자 환경에 Geist 가 설치되어 있지 않을 가능성이 있다. weight 200/600 의 정확한 표현이 깨지면 워드마크 시그니처가 무너진다.
+- 시스템 sans-serif 는 모든 OS 에 weight 200/600 fallback 이 보장된다.
+- 본문·UI 폰트는 여전히 Geist Sans 를 쓴다 (next/font/google 로 안전하게 로드되는 환경 안).
+
+### R-12. 출처
+
+- 컨셉 자산: `temp/clemvion_logo_concepts.html` (gitignored, 사용자 보관)
+- 사전 일관성 검토 세션:
+  - 1차 (Critical 2건 발견): `review/consistency/2026/05/15/18_25_10/` — 동일 파일 내 drop-in 범위 미명시 사유. 해결책으로 draft 도입부에 drop-in 대체 범위 명시.
+  - 2차 (Critical 0건, BLOCK: NO): `review/consistency/2026/05/15/18_36_51/` — 정식 반영 승인.
+- 사용자 결정 (2026-05-15 대화): ramp 정식 도입, vi 강조 보존, sub-copy 상시 부착, 다크 모드 동시 도입.

```
