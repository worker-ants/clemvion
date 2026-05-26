"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu } from "lucide-react";
import type { DocsSection, DocsSearchEntry } from "@/lib/docs/registry";
import {
  localizedDocsHref,
  localizedSectionLabel,
  localizedTitle,
} from "@/lib/docs/locale";
import { SlideDrawer } from "@/components/ui/slide-drawer";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { DocsSearch } from "@/components/docs/docs-search";
import { useLocale, useT } from "@/lib/i18n";
import { type Locale } from "@/lib/i18n/types";

interface DocsMobileSidebarProps {
  sections: DocsSection[];
  entriesByLocale: Record<Locale, DocsSearchEntry[]>;
}

/**
 * `lg` 미만 화면에서 가이드 사이드바·검색에 접근하기 위한 진입점.
 * 데스크탑은 layout 의 `<aside hidden lg:block>` 이 그대로 담당하므로 본 컴포넌트는
 * `lg:hidden` 으로 모바일/태블릿에서만 sticky 토글을 노출하고, 토글 클릭 시
 * 좌측 `SlideDrawer` 안에 동일한 `DocsSidebar` + `DocsSearch` 를 재사용해 띄운다.
 *
 * 부수 동작:
 *  - `usePathname` 변경 시 자동 close (페이지 이동 후 drawer 가 남는 회귀 방지)
 *  - 열림 시 활성 페이지 항목으로 `scrollIntoView({ block: "center" })` —
 *    긴 가이드 트리에서 사용자가 자신의 현재 위치를 한 번에 확인 가능
 */
export function DocsMobileSidebar({
  sections,
  entriesByLocale,
}: DocsMobileSidebarProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // pathname 이 바뀌면 drawer 를 자동으로 닫는다. 첫 마운트에서도 setOpen(false)
  // 가 호출되지만 open 초기값이 false 라 무해.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 열릴 때 활성 페이지 항목으로 스크롤. drawer 의 transition 이 끝나기 전에
  // 호출되면 layout 이 비어있을 수 있으므로 next tick 으로 미룬다.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const root = drawerRef.current;
      if (!root) return;
      const active = root.querySelector<HTMLElement>('[aria-current="page"]');
      active?.scrollIntoView({ block: "center" });
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  const { sectionLabel, pageTitle } = useMemo(() => {
    for (const section of sections) {
      for (const page of section.pages) {
        if (localizedDocsHref(page.slug, locale) === pathname) {
          return {
            sectionLabel: localizedSectionLabel(section.key, locale),
            pageTitle: localizedTitle(page.frontmatter, locale),
          };
        }
      }
    }
    return { sectionLabel: "", pageTitle: "" };
  }, [sections, pathname, locale]);

  const toggleLabel = t("docs.mobileSidebarToggle");
  const drawerTitle = t("docs.mobileSidebarTitle");

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={toggleLabel}
        aria-expanded={open}
        className="sticky top-0 z-30 -mx-4 flex w-[calc(100%+2rem)] items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 px-4 py-2.5 text-sm backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background))]/80"
      >
        <Menu className="h-4 w-4 shrink-0" aria-hidden />
        <span className="font-semibold">{toggleLabel}</span>
        {sectionLabel || pageTitle ? (
          <>
            <ChevronRight
              className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]"
              aria-hidden
            />
            <span className="truncate text-[hsl(var(--muted-foreground))]">
              {sectionLabel}
              {sectionLabel && pageTitle ? (
                <span className="px-1.5 opacity-60">·</span>
              ) : null}
              {pageTitle}
            </span>
          </>
        ) : null}
      </button>

      <SlideDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={drawerTitle}
        side="left"
      >
        <div ref={drawerRef} className="flex flex-col gap-4">
          <DocsSearch entriesByLocale={entriesByLocale} />
          <DocsSidebar sections={sections} />
        </div>
      </SlideDrawer>
    </div>
  );
}
