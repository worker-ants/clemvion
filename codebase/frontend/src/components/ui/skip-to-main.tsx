"use client";

import { useT } from "@/lib/i18n";
import { MAIN_CONTENT_ID } from "@/lib/constants/a11y";

/**
 * 첫 Tab 시 노출되는 "본문 바로가기" 링크. 키보드 사용자가 Sidebar 의 모든
 * nav 항목을 거치지 않고 바로 main content 영역으로 이동.
 *
 * Visible only on focus (sr-only → focus 시 일반 위치로 표시).
 * `<main id={MAIN_CONTENT_ID}>` (`MainContent` 컴포넌트) 와 짝.
 */
export function SkipToMain() {
  const t = useT();
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[hsl(var(--primary))] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-[hsl(var(--primary-foreground))] focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
    >
      {t("sidebar.aria.skipToMain")}
    </a>
  );
}
