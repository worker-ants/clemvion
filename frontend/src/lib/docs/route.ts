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
