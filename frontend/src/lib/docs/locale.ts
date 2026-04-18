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

const SECTION_LABELS_BY_LOCALE: Record<Locale, Record<string, string>> = {
  ko: {
    "01-getting-started": "시작하기",
    "02-nodes": "노드 가이드",
    "03-expression-language": "표현식 언어",
    "04-run-and-debug": "실행과 디버깅",
    "05-integrations-and-config": "통합과 설정",
    "06-faq": "자주 묻는 질문",
  },
  en: {
    "01-getting-started": "Getting Started",
    "02-nodes": "Node Guide",
    "03-expression-language": "Expression Language",
    "04-run-and-debug": "Run & Debug",
    "05-integrations-and-config": "Integrations & Config",
    "06-faq": "FAQ",
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
