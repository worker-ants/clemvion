import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export interface DocFrontmatter {
  title: string;
  section: string;
  order: number;
  summary: string;
  spec?: string[];
  code?: string[];
  draft?: boolean;
}

export interface DocMeta {
  slug: string[];
  href: string;
  filePath: string;
  frontmatter: DocFrontmatter;
}

export interface DocsSection {
  key: string;
  label: string;
  pages: DocMeta[];
}

export interface DocsIndex {
  sections: DocsSection[];
  byHref: Map<string, DocMeta>;
}

export interface LoadOptions {
  includeDrafts?: boolean;
}

// 섹션 키(디렉터리명)별 한글 레이블. 새 섹션 디렉터리를 추가하면 여기에도 등록해요.
const SECTION_LABELS: Record<string, string> = {
  "01-getting-started": "시작하기",
  "02-nodes": "노드 가이드",
  "03-expression-language": "표현식 언어",
  "04-run-and-debug": "실행과 디버깅",
  "05-integrations-and-config": "통합과 설정",
  "06-faq": "자주 묻는 질문",
};

export function stripNumberPrefix(segment: string): string {
  return segment.replace(/^\d+-/, "");
}

export function humanize(segment: string): string {
  return stripNumberPrefix(segment)
    .split("-")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function sectionLabel(key: string): string {
  return SECTION_LABELS[key] ?? humanize(key);
}

function assertFrontmatter(
  raw: Record<string, unknown>,
  relId: string,
): DocFrontmatter {
  const requiredKeys: Array<keyof DocFrontmatter> = [
    "title",
    "section",
    "order",
    "summary",
  ];
  for (const key of requiredKeys) {
    if (raw[key] === undefined || raw[key] === null) {
      throw new Error(
        `[docs registry] ${relId}: frontmatter '${key}' 필드가 필요해요.`,
      );
    }
  }
  if (typeof raw.title !== "string") {
    throw new Error(`[docs registry] ${relId}: 'title'은 문자열이어야 해요.`);
  }
  if (typeof raw.section !== "string") {
    throw new Error(`[docs registry] ${relId}: 'section'은 문자열이어야 해요.`);
  }
  if (typeof raw.order !== "number") {
    throw new Error(`[docs registry] ${relId}: 'order'는 숫자여야 해요.`);
  }
  if (typeof raw.summary !== "string") {
    throw new Error(`[docs registry] ${relId}: 'summary'는 문자열이어야 해요.`);
  }
  return raw as unknown as DocFrontmatter;
}

function listSectionDirs(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));
}

// "_" 접두 파일은 내비게이션에서 제외해요 (예: _glossary.md, _meta.mdx).
function listMdxFiles(sectionDir: string): string[] {
  if (!fs.existsSync(sectionDir)) return [];
  return fs
    .readdirSync(sectionDir, { withFileTypes: true })
    .filter(
      (d) =>
        d.isFile() && d.name.endsWith(".mdx") && !d.name.startsWith("_"),
    )
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));
}

export function loadDocsIndex(
  root: string,
  options: LoadOptions = {},
): DocsIndex {
  const { includeDrafts = false } = options;
  const sections: DocsSection[] = [];
  const byHref = new Map<string, DocMeta>();

  for (const sectionKey of listSectionDirs(root)) {
    const sectionDir = path.join(root, sectionKey);
    const pages: DocMeta[] = [];
    for (const fileName of listMdxFiles(sectionDir)) {
      const filePath = path.join(sectionDir, fileName);
      const relId = `${sectionKey}/${fileName}`;
      const source = fs.readFileSync(filePath, "utf8");
      const parsed = matter(source, { engines: { javascript: () => ({}) } });
      const frontmatter = assertFrontmatter(
        parsed.data as Record<string, unknown>,
        relId,
      );
      if (frontmatter.draft && !includeDrafts) continue;
      const slugName = fileName.replace(/\.mdx$/, "");
      const slug = [sectionKey, slugName];
      const href = `/docs/${slug.join("/")}`;
      const meta: DocMeta = { slug, href, filePath, frontmatter };
      pages.push(meta);
      byHref.set(href, meta);
    }
    if (pages.length === 0) continue;
    pages.sort((a, b) => a.frontmatter.order - b.frontmatter.order);
    sections.push({
      key: sectionKey,
      label: sectionLabel(sectionKey),
      pages,
    });
  }

  return { sections, byHref };
}

export function getDocBySlug(
  index: DocsIndex,
  slug: readonly string[],
): DocMeta | null {
  const href = `/docs/${slug.join("/")}`;
  return index.byHref.get(href) ?? null;
}

export function getAllSlugs(index: DocsIndex): string[][] {
  const slugs: string[][] = [];
  for (const section of index.sections) {
    for (const page of section.pages) {
      slugs.push([...page.slug]);
    }
  }
  return slugs;
}

export interface DocsSearchEntry {
  href: string;
  title: string;
  section: string;
  sectionLabel: string;
  summary: string;
  headings: string[];
}

/** MDX 본문에서 `#`~`###` 헤딩을 뽑아요 (`#` 문자 포함한 라인만). */
export function extractHeadings(mdxSource: string): string[] {
  const headings: string[] = [];
  for (const rawLine of mdxSource.split(/\r?\n/)) {
    const m = /^(#{1,3})\s+(.+?)\s*$/.exec(rawLine);
    if (m) headings.push(m[2].replace(/[*_`]/g, ""));
  }
  return headings;
}

/**
 * 모든 문서에 대해 fuzzy 검색용 평면 인덱스를 반환해요.
 * 본문 전체 대신 title·summary·headings만 담아 클라이언트 번들 크기를 제한해요.
 */
export function buildSearchIndex(index: DocsIndex): DocsSearchEntry[] {
  const entries: DocsSearchEntry[] = [];
  for (const section of index.sections) {
    for (const page of section.pages) {
      const source = fs.readFileSync(page.filePath, "utf8");
      const parsed = matter(source, {
        engines: { javascript: () => ({}) },
      });
      const body =
        typeof parsed.content === "string" ? parsed.content : "";
      entries.push({
        href: page.href,
        title: page.frontmatter.title,
        section: section.key,
        sectionLabel: section.label,
        summary: page.frontmatter.summary,
        headings: extractHeadings(body),
      });
    }
  }
  return entries;
}

const DEFAULT_DOCS_ROOT = path.join(process.cwd(), "src", "content", "docs");

// Next.js HMR에서 모듈 캐시가 재평가되지 않아 stale 인덱스를 반환하는 것을 막기 위해
// 개발 환경에서는 캐싱하지 않고 매번 새로 읽어요.
type DocsIndexGlobal = typeof globalThis & { __docsIndex?: DocsIndex | null };
const g = globalThis as DocsIndexGlobal;

/**
 * 프로젝트 기본 경로(`src/content/docs`)의 문서 인덱스를 반환해요.
 * - production: 최초 1회만 스캔하고 globalThis에 캐싱
 * - development: 매 호출마다 새로 스캔(HMR 안전)
 */
export function getDocsIndex(): DocsIndex {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    return loadDocsIndex(DEFAULT_DOCS_ROOT, { includeDrafts: true });
  }
  if (!g.__docsIndex) {
    g.__docsIndex = loadDocsIndex(DEFAULT_DOCS_ROOT, { includeDrafts: false });
  }
  return g.__docsIndex;
}

/** 테스트 및 HMR을 위해 캐시를 초기화해요. */
export function resetDocsIndexCache(): void {
  g.__docsIndex = null;
}
