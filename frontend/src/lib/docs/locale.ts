// Pure, client-safe locale helpers for docs metadata.
// Separate from ./registry (which imports node:fs and node:path) so that
// "use client" components can import these without pulling Node APIs into the
// browser bundle.

import type { Locale } from "@/lib/i18n/types";

export interface LocalizedDocFrontmatter {
  title: string;
  title_en?: string;
  summary: string;
  summary_en?: string;
}

// 섹션 키는 `src/content/docs/<dir>` 디렉터리명과 1:1 로 일치한다.
// KO 라벨은 `./registry.ts` 의 `SECTION_LABELS` 와 동일하게 유지한다(검색 인덱스는 이 표,
// 사이드바는 registry.ts 표를 사용하므로 둘이 어긋나면 두 화면이 다른 라벨을 보여준다).
// FAQ 가 항상 사이드바 맨 아래에 위치하도록 `99-faq` 프리픽스를 쓴다 — 자세한 규칙은
// `spec/2-navigation/13-user-guide.md` §5.
const SECTION_LABELS_BY_LOCALE: Record<Locale, Record<string, string>> = {
  ko: {
    "01-getting-started": "시작하기",
    "02-nodes": "노드 가이드",
    "03-workflow-editor": "워크플로우 에디터",
    "04-expression-language": "표현식 언어",
    "05-run-and-debug": "실행과 디버깅",
    "06-integrations-and-config": "통합과 설정",
    "07-workspace-and-team": "워크스페이스와 팀",
    "99-faq": "자주 묻는 질문",
  },
  en: {
    "01-getting-started": "Getting Started",
    "02-nodes": "Node Guide",
    "03-workflow-editor": "Workflow Editor",
    "04-expression-language": "Expression Language",
    "05-run-and-debug": "Run & Debug",
    "06-integrations-and-config": "Integrations & Config",
    "07-workspace-and-team": "Workspace & Team",
    "99-faq": "FAQ",
  },
};

function humanize(segment: string): string {
  return segment
    .replace(/^\d+-/, "")
    .split("-")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function localizedSectionLabel(key: string, locale: Locale): string {
  return SECTION_LABELS_BY_LOCALE[locale][key] ?? humanize(key);
}

export function localizedTitle(
  fm: LocalizedDocFrontmatter,
  locale: Locale,
): string {
  if (locale === "en" && fm.title_en) return fm.title_en;
  return fm.title;
}

export function localizedSummary(
  fm: LocalizedDocFrontmatter,
  locale: Locale,
): string {
  if (locale === "en" && fm.summary_en) return fm.summary_en;
  return fm.summary;
}

/** slug과 locale을 받아 `/docs/<locale>/<section>/<slug>` 형태의 URL을 만들어요.
 *  단일 catch-all 라우트(`/docs/[...slug]/page.tsx`)에서 slug[0]을 locale로 해석해요. */
export function localizedDocsHref(
  slug: readonly string[],
  locale: Locale,
): string {
  return `/docs/${locale}/${slug.join("/")}`;
}
