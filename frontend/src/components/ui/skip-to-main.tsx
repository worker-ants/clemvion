"use client";

import { useT } from "@/lib/i18n";

/**
 * 첫 Tab 시 노출되는 "본문 바로가기" 링크. Stage 10 a11y — 키보드 사용자가
 * Sidebar 의 모든 nav 항목을 거치지 않고 바로 main content 영역으로 이동.
 *
 * Visible only on focus (sr-only by default → focus 시 일반 위치로 표시).
 * `<main id="main-content">` 와 짝으로 동작 — `MainContent` 가 이 id 를 부여한다.
 */
export function SkipToMain() {
  const t = useT();
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[hsl(var(--primary))] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-[hsl(var(--primary-foreground))] focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
    >
      {t("sidebar.aria.skipToMain")}
    </a>
  );
}
