"use client";

import { useEffect, useRef, useState } from "react";
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
  /** 가이드 트리의 섹션 목록. `DocsSidebar` 와 현재 페이지 매칭에 모두 사용. */
  sections: DocsSection[];
  /** 로케일별 검색 인덱스. `DocsSearch` 에 그대로 전달. */
  entriesByLocale: Record<Locale, DocsSearchEntry[]>;
}

/**
 * `lg` 미만 화면에서 가이드 사이드바·검색에 접근하기 위한 진입점.
 * 데스크탑은 layout 의 `<aside hidden lg:block>` 이 그대로 담당하므로 본 컴포넌트는
 * `lg:hidden` 으로 모바일/태블릿에서만 sticky 토글을 노출하고, 토글 클릭 시
 * 좌측 `SlideDrawer` 안에 동일한 `DocsSidebar` + `DocsSearch` 를 재사용해 띄운다.
 *
 * 부수 동작:
 *  - anchor 클릭 시 자동 close (click capture — react-compiler 의 setState-in-effect
 *    규약 준수. useEffect 로 pathname 을 추적하면 규약 위반이라 click capture 방식 채택)
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

  // 현재 페이지 매칭. react-compiler 가 inline 계산도 자동 메모하므로
  // useMemo 를 두지 않는다 (수동 memoization 가 react-compiler 와 충돌).
  let sectionLabel = "";
  let pageTitle = "";
  outer: for (const section of sections) {
    for (const page of section.pages) {
      if (localizedDocsHref(page.slug, locale) === pathname) {
        sectionLabel = localizedSectionLabel(section.key, locale);
        pageTitle = localizedTitle(page.frontmatter, locale);
        break outer;
      }
    }
  }

  const toggleLabel = t("docs.mobileSidebarToggle");
  const drawerTitle = t("docs.mobileSidebarTitle");

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
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
        {/* drawer 안에서 anchor 클릭 시 자동 close — pathname 변경을 effect 로 추적하면
            react-compiler 의 setState-in-effect 규약 위반이라 click capture 로 처리. */}
        <div
          ref={drawerRef}
          className="flex flex-col gap-4"
          onClickCapture={(e) => {
            if (e.target instanceof Element && e.target.closest("a")) {
              setOpen(false);
            }
          }}
        >
          <DocsSearch entriesByLocale={entriesByLocale} />
          <DocsSidebar sections={sections} />
        </div>
      </SlideDrawer>
    </div>
  );
}
