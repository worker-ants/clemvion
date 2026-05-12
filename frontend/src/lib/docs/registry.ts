import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
} from "@/lib/i18n/types";

export interface DocFrontmatter {
  title: string;
  title_en?: string;
  section: string;
  order: number;
  summary: string;
  summary_en?: string;
  spec?: string[];
  code?: string[];
  draft?: boolean;
}

// Sibling translation files live next to the canonical KO file and carry the
// `<slug>.<locale>.mdx` suffix. The default locale uses the plain `<slug>.mdx`
// form, so `LOCALE_SUFFIX[DEFAULT_LOCALE]` is empty.
const LOCALE_SUFFIX: Record<Locale, string> = { ko: "", en: ".en" };

// Locale helpers live in ./locale (no node:fs/node:path imports, safe for client
// bundles). Consumers should import them directly from `@/lib/docs/locale` —
// intentionally NOT re-exported here to keep the module boundary clear: anything
// re-exported from registry.ts carries node:fs into the caller.
import {
  localizedDocsHref,
  localizedSectionLabel,
  localizedSummary,
  localizedTitle,
} from "./locale";

export interface DocMeta {
  slug: string[];
  /** Canonical href without the locale prefix (e.g. `/docs/01-first/a`).
   *  Locale-aware URLs are built at render time via `localizedDocsHref`. */
  href: string;
  /** Absolute path to the canonical (default-locale) MDX file. */
  filePath: string;
  frontmatter: DocFrontmatter;
  /** Locales for which a translated body exists on disk. Always contains the
   *  default locale; secondary locales are added when a `<slug>.<locale>.mdx`
   *  sibling is present. */
  availableLocales: Locale[];
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
  "03-workflow-editor": "워크플로우 에디터",
  "04-expression-language": "표현식 언어",
  "05-run-and-debug": "실행과 디버깅",
  "06-integrations-and-config": "통합과 설정",
  "07-faq": "자주 묻는 질문",
  "08-workspace-and-team": "워크스페이스와 팀",
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

// "_" 접두 파일과 locale sibling(`foo.en.mdx` 등)을 내비게이션에서 제외해요.
// sibling은 canonical KO 파일(`foo.mdx`)과 같은 슬러그를 쓰므로 중복 등록을
// 방지하기 위함이에요.
function listMdxFiles(sectionDir: string): string[] {
  if (!fs.existsSync(sectionDir)) return [];
  return fs
    .readdirSync(sectionDir, { withFileTypes: true })
    .filter(
      (d) =>
        d.isFile() &&
        d.name.endsWith(".mdx") &&
        !d.name.startsWith("_") &&
        !isLocaleSibling(d.name),
    )
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));
}

/** `foo.en.mdx` 와 같은 locale sibling 파일명인지 판정해요 (기본 locale 제외). */
function isLocaleSibling(fileName: string): boolean {
  // e.g. "foo.en.mdx" → base="foo", locale="en"
  const match = /^(.+)\.([a-z]{2})\.mdx$/.exec(fileName);
  if (!match) return false;
  const locale = match[2];
  return LOCALES.includes(locale as Locale) && locale !== DEFAULT_LOCALE;
}

/** canonical 파일명(`foo.mdx`)에서 같은 섹션 내 존재하는 번역 locale을 탐색해요. */
function detectAvailableLocales(
  sectionDir: string,
  canonicalFileName: string,
): Locale[] {
  const slugName = canonicalFileName.replace(/\.mdx$/, "");
  const available: Locale[] = [DEFAULT_LOCALE];
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    const siblingPath = path.join(
      sectionDir,
      `${slugName}${LOCALE_SUFFIX[locale]}.mdx`,
    );
    if (fs.existsSync(siblingPath)) available.push(locale);
  }
  return available;
}

/** canonical `<slug>.mdx`에 대응하는 locale별 실제 파일 경로를 반환해요.
 *  sibling이 없으면 canonical 경로를 반환해서 호출부가 폴백을 따로 처리하지 않도록 해요. */
export function resolveLocalizedDocPath(
  canonicalFilePath: string,
  locale: Locale,
): string {
  if (locale === DEFAULT_LOCALE) return canonicalFilePath;
  const suffix = LOCALE_SUFFIX[locale];
  const localized = canonicalFilePath.replace(/\.mdx$/, `${suffix}.mdx`);
  return fs.existsSync(localized) ? localized : canonicalFilePath;
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
      const availableLocales = detectAvailableLocales(sectionDir, fileName);
      const meta: DocMeta = {
        slug,
        href,
        filePath,
        frontmatter,
        availableLocales,
      };
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
  /** Locale-prefixed href, ready to navigate to (`/docs/<locale>/<section>/<slug>`). */
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
 * `locale`에 해당하는 번역 sibling이 있으면 그 본문에서 heading을 뽑고,
 * 없으면 canonical(KO) 본문에서 뽑아요. title·summary 역시 locale 프론트매터를 우선 사용.
 *
 * 결과는 `index` 객체 단위(= 같은 `getDocsIndex()` 반환값)로 캐시해요.
 * production에서는 `getDocsIndex()`가 싱글턴이므로 `(locale, index)` 쌍당 1회만 디스크 I/O가 일어나요.
 */
const searchIndexCache = new WeakMap<
  DocsIndex,
  Partial<Record<Locale, DocsSearchEntry[]>>
>();

export function buildSearchIndex(
  index: DocsIndex,
  locale: Locale = DEFAULT_LOCALE,
): DocsSearchEntry[] {
  const cached = searchIndexCache.get(index)?.[locale];
  if (cached) return cached;

  const entries: DocsSearchEntry[] = [];
  for (const section of index.sections) {
    const sectionLabel = localizedSectionLabel(section.key, locale);
    for (const page of section.pages) {
      // availableLocales를 통해 sibling 존재 여부를 알 수 있으므로 불필요한
      // existsSync syscall을 피해요. locale이 목록에 없으면 canonical 경로로 폴백.
      const bodyPath =
        locale === DEFAULT_LOCALE || !page.availableLocales.includes(locale)
          ? page.filePath
          : resolveLocalizedDocPath(page.filePath, locale);
      const source = fs.readFileSync(bodyPath, "utf8");
      const parsed = matter(source, {
        engines: { javascript: () => ({}) },
      });
      const body =
        typeof parsed.content === "string" ? parsed.content : "";
      entries.push({
        href: localizedDocsHref(page.slug, locale),
        title: localizedTitle(page.frontmatter, locale),
        section: section.key,
        sectionLabel,
        summary: localizedSummary(page.frontmatter, locale),
        headings: extractHeadings(body),
      });
    }
  }

  const byLocale = searchIndexCache.get(index) ?? {};
  byLocale[locale] = entries;
  searchIndexCache.set(index, byLocale);
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
