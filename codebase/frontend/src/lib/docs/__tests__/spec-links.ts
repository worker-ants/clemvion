// Shared helpers for the spec-link-integrity guard.
//
// Validates in-repo markdown links in `spec/**` narrative docs:
//   - the relative path target exists, and
//   - any `#anchor` fragment resolves to a real heading slug in the target.
//
// The heading-slug algorithm mirrors github-slugger (the renderer used by the
// in-app docs viewer): lowercase, drop punctuation but KEEP CJK + underscores,
// spaces → single hyphens (no run-collapse), duplicate headings get `-1`/`-2`.
// This port was cross-validated against 1200+ known-good in-repo anchor links.
//
// SoT for spec evidence conventions: spec/conventions/spec-impl-evidence.md.

import fs from "node:fs";
import path from "node:path";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toString as mdToString } from "mdast-util-to-string";
import GithubSlugger from "github-slugger";
import type { Root, RootContent, Heading } from "mdast";

// Heading-anchor slugs are computed with the EXACT renderer pipeline the in-app
// docs viewer uses — remark/mdast parse (so emphasis, code spans, and inline
// markdown are resolved as CommonMark, e.g. `render_*` keeps its underscore but
// `_emph_` is stripped) → github-slugger (the lib behind rehype-slug). Hand-
// rolled slug regexes drift from this on edge cases (lone `_` before
// punctuation), so we delegate to the real libraries instead.

function collectHeadings(node: Root | RootContent, out: Heading[]): void {
  if (node.type === "heading") out.push(node);
  if ("children" in node && Array.isArray(node.children)) {
    for (const child of node.children) collectHeadings(child as RootContent, out);
  }
}

/**
 * GitHub-flavoured anchor slug for a single heading's text. The text is parsed
 * in heading context (so a leading `1.` is inline text, not an ordered-list
 * marker) then slugged with github-slugger.
 */
export function slugify(heading: string): string {
  const tree = fromMarkdown(`# ${heading}`);
  const headings: Heading[] = [];
  collectHeadings(tree, headings);
  const text = headings.length > 0 ? mdToString(headings[0]) : heading;
  return new GithubSlugger().slug(text);
}

/** Set of valid heading anchor slugs for a markdown file (with `-1`/`-2` dups). */
export function headingSlugs(absPath: string): Set<string> {
  let text: string;
  try {
    text = fs.readFileSync(absPath, "utf8");
  } catch {
    return new Set();
  }
  const tree = fromMarkdown(text);
  const headings: Heading[] = [];
  collectHeadings(tree, headings);
  // One slugger per file → github-slugger appends `-1`/`-2` to duplicate
  // headings exactly as rehype-slug does, in document order.
  const slugger = new GithubSlugger();
  const slugs = new Set<string>();
  for (const h of headings) {
    const slug = slugger.slug(mdToString(h));
    if (slug) slugs.add(slug);
  }
  return slugs;
}

export interface MdLink {
  line: number;
  raw: string;
  target: string; // url part only (title and surrounding ws stripped)
}

const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
const FENCE_RE = /^(\s*)(```|~~~)/;

/** Extract markdown links outside fenced/inline code. */
export function extractLinks(absPath: string): MdLink[] {
  const text = fs.readFileSync(absPath, "utf8");
  const out: MdLink[] = [];
  let inFence = false;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const noCode = line.replace(/`[^`]*`/g, "");
    LINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LINK_RE.exec(noCode)) !== null) {
      const rawTarget = m[2].trim();
      // Strip an optional title:  (url "title")
      const tm = /^(\S+)(\s+"[^"]*")?$/.exec(rawTarget);
      const url = tm ? tm[1] : rawTarget.split(/\s+/)[0];
      out.push({ line: i + 1, raw: m[0], target: url });
    }
  }
  return out;
}

export function isExternal(target: string): boolean {
  const t = target.toLowerCase();
  return (
    t.startsWith("http://") ||
    t.startsWith("https://") ||
    t.startsWith("mailto:") ||
    t.startsWith("tel:") ||
    /^[a-z][a-z0-9+.\-]*:\/\//.test(t)
  );
}

export interface SpecMdFile {
  absPath: string;
  relPath: string;
}

// Generated API reference catalogs (cafe24-api-catalog, makeshop-api-catalog, …)
// are not narrative specs; their cross-links are machine-generated and out of
// scope for the link-integrity guard.
function inGeneratedCatalog(relPath: string): boolean {
  return relPath.includes("-api-catalog/");
}

/** All narrative markdown under `spec/` (excludes generated catalogs). */
export function collectSpecMarkdown(root: string): SpecMdFile[] {
  const specDir = path.join(root, "spec");
  const out: SpecMdFile[] = [];
  if (!fs.existsSync(specDir)) return out;
  const stack: string[] = [specDir];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && full.endsWith(".md")) {
        const rel = path.relative(root, full).split(path.sep).join("/");
        if (inGeneratedCatalog(rel)) continue;
        out.push({ absPath: full, relPath: rel });
      }
    }
  }
  out.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return out;
}

export type LinkViolationKind = "DEAD" | "ANCHOR";

export interface LinkViolation {
  kind: LinkViolationKind;
  source: string; // relPath
  line: number;
  target: string;
}

interface LinkScanOptions {
  /**
   * Validate pure same-file `#anchor` links against the file's own headings.
   * Spec markdown docs self-reference their own headings; code sources have no
   * headings, so their same-file anchors are skipped.
   */
  checkSelfAnchors: boolean;
  /**
   * Restrict path-target links to those whose path part (sans `#fragment`)
   * matches this predicate. Omit to check every in-repo relative link.
   */
  targetFilter?: (pathPart: string) => boolean;
}

/**
 * Shared DEAD/ANCHOR scan over a set of files. A link is broken when its
 * relative path target does not exist (DEAD) or its `#anchor` does not resolve
 * to a heading slug in the target markdown file (ANCHOR). The two public entry
 * points below differ only in the file set and the two `options` knobs.
 */
function findBrokenLinksInFiles(
  files: SpecMdFile[],
  options: LinkScanOptions,
): LinkViolation[] {
  const violations: LinkViolation[] = [];
  const slugCache = new Map<string, Set<string>>();
  const slugsFor = (absPath: string): Set<string> => {
    let slugs = slugCache.get(absPath);
    if (!slugs) {
      slugs = headingSlugs(absPath);
      slugCache.set(absPath, slugs);
    }
    return slugs;
  };

  for (const f of files) {
    for (const link of extractLinks(f.absPath)) {
      const { target } = link;

      // Pure same-file anchor.
      if (target.startsWith("#")) {
        if (!options.checkSelfAnchors) continue;
        const anchor = target.slice(1);
        if (anchor === "") continue;
        if (!slugsFor(f.absPath).has(decodeAnchor(anchor))) {
          violations.push({
            kind: "ANCHOR",
            source: f.relPath,
            line: link.line,
            target,
          });
        }
        continue;
      }

      if (isExternal(target)) continue;

      const hashIdx = target.indexOf("#");
      const pathPart = hashIdx === -1 ? target : target.slice(0, hashIdx);
      const anchor = hashIdx === -1 ? null : target.slice(hashIdx + 1);
      if (pathPart === "") continue;
      if (options.targetFilter && !options.targetFilter(pathPart)) continue;

      const resolved = path.resolve(path.dirname(f.absPath), pathPart);
      if (!fs.existsSync(resolved)) {
        violations.push({
          kind: "DEAD",
          source: f.relPath,
          line: link.line,
          target,
        });
        continue;
      }

      if (anchor && resolved.toLowerCase().endsWith(".md")) {
        if (!slugsFor(resolved).has(decodeAnchor(anchor))) {
          violations.push({
            kind: "ANCHOR",
            source: f.relPath,
            line: link.line,
            target,
          });
        }
      }
    }
  }

  violations.sort(
    (a, b) => a.source.localeCompare(b.source) || a.line - b.line,
  );
  return violations;
}

/**
 * Validate every in-repo markdown link in `spec/**`. Returns the list of
 * broken links (empty = healthy). A link is broken when its relative path
 * target does not exist (DEAD) or its `#anchor` does not resolve to a heading
 * in the target markdown file (ANCHOR). Same-file `#anchor` links are checked
 * against the file's own headings.
 */
export function findBrokenLinks(root: string): LinkViolation[] {
  return findBrokenLinksInFiles(collectSpecMarkdown(root), {
    checkSelfAnchors: true,
  });
}

// ---------------------------------------------------------------------------
// Codebase-source spec links.
//
// `.ts`/`.tsx` sources (JSDoc, comments) frequently link to spec docs with a
// relative path (`[..](../../../../spec/....md)`). Those depths are hand-counted
// and drift silently — the `spec/**`-only guard above never sees them, so an
// off-by-N `../` resolves to a nonexistent `codebase/spec/...` unnoticed. This
// pair mirrors the same DEAD/ANCHOR checks over the code tree, scoped to links
// that actually target a `spec/**.md` file (non-spec relative links are out of
// scope — this guard only catches spec-link rot).
// ---------------------------------------------------------------------------

const CODEBASE_SOURCE_ROOTS = [
  "codebase/backend/src",
  "codebase/frontend/src",
  "codebase/channel-web-chat/src",
  "codebase/packages",
];
const CODEBASE_SKIP_DIRS = new Set(["node_modules", "dist", "build", ".next"]);
// A relative link whose path part targets a spec markdown file.
const SPEC_MD_TARGET_RE = /(^|\/)spec\/.+\.md$/;

/** All `.ts`/`.tsx` under the codebase source roots (build output dirs excluded). */
export function collectCodebaseSources(root: string): SpecMdFile[] {
  const out: SpecMdFile[] = [];
  for (const rel of CODEBASE_SOURCE_ROOTS) {
    const base = path.join(root, rel);
    if (!fs.existsSync(base)) continue;
    const stack: string[] = [base];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
        const full = path.join(cur, entry.name);
        if (entry.isDirectory()) {
          if (!CODEBASE_SKIP_DIRS.has(entry.name)) stack.push(full);
        } else if (
          entry.isFile() &&
          (full.endsWith(".ts") || full.endsWith(".tsx"))
        ) {
          const relPath = path.relative(root, full).split(path.sep).join("/");
          out.push({ absPath: full, relPath });
        }
      }
    }
  }
  out.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return out;
}

/**
 * Validate every `spec/**.md`-targeting relative link in codebase `.ts`/`.tsx`
 * sources. DEAD = the resolved path does not exist (off-by-N `../`). ANCHOR =
 * the `#fragment` does not resolve to a heading in the target spec. Links that
 * don't target a spec markdown file — and same-file `#anchor` links, since code
 * has no headings — are ignored.
 */
export function findBrokenSpecLinksInSources(root: string): LinkViolation[] {
  return findBrokenLinksInFiles(collectCodebaseSources(root), {
    checkSelfAnchors: false,
    targetFilter: (pathPart) => SPEC_MD_TARGET_RE.test(pathPart),
  });
}

// Anchors in these specs are written raw (CJK, not %-encoded); decode defensively
// in case a link percent-encodes a fragment.
function decodeAnchor(anchor: string): string {
  try {
    return decodeURIComponent(anchor);
  } catch {
    return anchor;
  }
}
