import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getAllSlugs,
  getDocBySlug,
  getDocsIndex,
} from "@/lib/docs/registry";
import { isSafeDocsSlug } from "@/lib/docs/links";

export const dynamicParams = false;

type RouteParams = { slug: string[] };

export function generateStaticParams(): RouteParams[] {
  const index = getDocsIndex();
  return getAllSlugs(index).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isSafeDocsSlug(slug)) return {};
  const index = getDocsIndex();
  const doc = getDocBySlug(index, slug);
  if (!doc) return {};
  return {
    title: `${doc.frontmatter.title} · 사용자 매뉴얼`,
    description: doc.frontmatter.summary,
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  // 슬러그 정규식 검증: 디렉터리 탐색/비인덱스 경로 차단
  if (!isSafeDocsSlug(slug)) notFound();

  const index = getDocsIndex();
  const doc = getDocBySlug(index, slug);
  if (!doc) notFound();
  // production 환경에서 draft 문서 URL 직접 접근 방어
  if (doc.frontmatter.draft && process.env.NODE_ENV === "production") {
    notFound();
  }

  const slugPath = slug.join("/");
  const { default: MDXContent } = await import(
    `@/content/docs/${slugPath}.mdx`
  );

  return (
    <>
      <header className="mb-6 border-b border-[hsl(var(--border))] pb-4">
        <h1 className="text-3xl font-semibold">{doc.frontmatter.title}</h1>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          {doc.frontmatter.summary}
        </p>
      </header>
      <MDXContent />
    </>
  );
}
