import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  getAllSlugs,
  getDocBySlug,
  getDocsIndex,
} from "@/lib/docs/registry";
import {
  localizedDocsHref,
  localizedSummary,
  localizedTitle,
} from "@/lib/docs/locale";
import { isSafeDocsSlug } from "@/lib/docs/links";
import { parseDocsRoute } from "@/lib/docs/route";
import { DocHeader } from "@/components/docs/doc-header";
import { DocBodyNotice } from "@/components/docs/doc-body-notice";
import { DEFAULT_LOCALE, isLocale, LOCALES } from "@/lib/i18n/types";
import { readLocaleCookie } from "@/lib/i18n/server-locale";
import { translate } from "@/lib/i18n/core";

// 단일 catch-all 라우트: slug[0]을 locale로 해석해서 `/docs/<locale>/<...path>`로 매칭해요.
// locale이 아닌 첫 세그먼트가 들어오면 (레거시 북마크 등) 쿠키 locale로 redirect.
export const dynamicParams = true;

type RouteParams = { slug: string[] };

export function generateStaticParams(): RouteParams[] {
  const index = getDocsIndex();
  const docSlugs = getAllSlugs(index);
  const params: RouteParams[] = [];
  for (const locale of LOCALES) {
    for (const docSlug of docSlugs) {
      params.push({ slug: [locale, ...docSlug] });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseDocsRoute(slug);
  if (!parsed) return {};
  if (!isSafeDocsSlug(parsed.docSlug)) return {};
  const index = getDocsIndex();
  const doc = getDocBySlug(index, parsed.docSlug);
  if (!doc) return {};
  const titleSuffix = translate(parsed.locale, "docs.titleSuffix");
  return {
    title: `${localizedTitle(doc.frontmatter, parsed.locale)} · ${titleSuffix}`,
    description: localizedSummary(doc.frontmatter, parsed.locale),
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((loc) => [loc, localizedDocsHref(doc.slug, loc)]),
      ),
    },
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const parsed = parseDocsRoute(slug);

  // 첫 세그먼트가 locale이 아니면 레거시 bookmark — 쿠키 locale을 프리픽스로 붙여 redirect.
  // 첫 세그먼트가 유효한 locale인데 parseDocsRoute가 null을 반환한 경우(세그먼트 수 부족)는
  // 문서 구조가 맞지 않으므로 404로 보내요.
  if (!parsed) {
    if (slug.length === 0) notFound();
    if (isLocale(slug[0])) notFound();
    const cookieLocale = (await readLocaleCookie()) ?? DEFAULT_LOCALE;
    redirect(`/docs/${cookieLocale}/${slug.join("/")}`);
  }

  const { locale, docSlug } = parsed;

  // 슬러그 정규식 검증: 디렉터리 탐색/비인덱스 경로 차단
  if (!isSafeDocsSlug(docSlug)) notFound();

  const index = getDocsIndex();
  const doc = getDocBySlug(index, docSlug);
  if (!doc) notFound();
  // production 환경에서 draft 문서 URL 직접 접근 방어
  if (doc.frontmatter.draft && process.env.NODE_ENV === "production") {
    notFound();
  }

  const slugPath = docSlug.join("/");
  // 요청 locale에 sibling(`<slug>.<locale>.mdx`)이 있으면 번역본, 없으면 canonical(KO)로 폴백
  const hasTranslation =
    locale !== DEFAULT_LOCALE && doc.availableLocales.includes(locale);
  const { default: MDXContent } = hasTranslation
    ? await import(`@/content/docs/${slugPath}.en.mdx`)
    : await import(`@/content/docs/${slugPath}.mdx`);

  const fellBackToKorean = locale !== DEFAULT_LOCALE && !hasTranslation;

  return (
    <>
      <DocHeader frontmatter={doc.frontmatter} />
      <DocBodyNotice fellBackToKorean={fellBackToKorean} />
      <MDXContent />
    </>
  );
}
