import { isLocale, type Locale } from "@/lib/i18n/types";

export interface ParsedDocsRoute {
  locale: Locale;
  docSlug: string[];
}

/**
 * `/docs/[...slug]` 캐치올에 들어온 raw slug 배열을 `{ locale, docSlug }`로 파싱해요.
 * - 정상: `[locale, section, page, ...]` (최소 3개 세그먼트)
 * - 레거시/비로케일 첫 세그먼트: `null` 반환 → 호출부에서 쿠키 로케일로 redirect 처리
 *
 * 분리된 모듈인 이유: page.tsx에서 export하지 않고도 단위 테스트할 수 있도록 분리.
 */
export function parseDocsRoute(
  rawSlug: readonly string[],
): ParsedDocsRoute | null {
  // 최소 구조: locale + section + page. 현재 모든 페이지가 2-depth로 구성됨.
  if (rawSlug.length < 3) return null;
  const [maybeLocale, ...rest] = rawSlug;
  if (!isLocale(maybeLocale)) return null;
  return { locale: maybeLocale, docSlug: rest };
}

/**
 * 통합/이름변경으로 사라진 구 문서 slug → 현행 slug 매핑. 외부 북마크·이메일·알림이
 * 가리키던 구 URL이 404가 되지 않도록 page.tsx가 현행 페이지로 redirect 처리한다.
 * 키는 `docSlug.join("/")` (locale 제외). Unified Model Management:
 * `llm-config`·`rerank-config` 가이드가 단일 `models` 페이지로 통합됨.
 */
const LEGACY_DOC_SLUG_REDIRECTS: Record<string, string[]> = {
  "06-integrations-and-config/llm-config": [
    "06-integrations-and-config",
    "models",
  ],
  "06-integrations-and-config/rerank-config": [
    "06-integrations-and-config",
    "models",
  ],
};

/**
 * 구 문서 slug면 현행 slug(locale 제외 세그먼트 배열)를 반환, 아니면 `null`.
 * 호출부(page.tsx)가 `localizedDocsHref(target, locale)`로 redirect 한다.
 */
export function resolveLegacyDocSlug(
  docSlug: readonly string[],
): string[] | null {
  return LEGACY_DOC_SLUG_REDIRECTS[docSlug.join("/")] ?? null;
}
