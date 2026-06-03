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

// Word-character boundary used by CommonMark emphasis: ASCII alnum + the CJK
// ranges that actually appear in these specs (Hangul, CJK ideographs, Kana).
const WORDISH = "0-9A-Za-z\\uAC00-\\uD7A3\\u4E00-\\u9FFF\\u3040-\\u30FF";
const EMPH_LEAD = new RegExp(`(?<![${WORDISH}])_+`, "gu");
const EMPH_TRAIL = new RegExp(`_+(?![${WORDISH}])`, "gu");

/**
 * GitHub-flavoured heading → anchor slug. Keeps CJK characters and intra-word
 * underscores; strips emphasis underscores at word boundaries and all other
 * punctuation; collapses each whitespace run-position to a single hyphen.
 */
export function slugify(heading: string): string {
  let s = heading.trim();
  // [text](url) → text  (anchor uses the link text, not the URL)
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  // Mask inline code spans so their content is inert to emphasis parsing
  // (e.g. `_dryRun` keeps its leading underscore).
  const codeSpans: string[] = [];
  s = s.replace(/`([^`]*)`/g, (_m, inner: string) => {
    codeSpans.push(inner);
    return `\x00${codeSpans.length - 1}\x00`;
  });
  // Remove emphasis underscores at word boundaries; keep intra-word ones.
  s = s.replace(EMPH_LEAD, "");
  s = s.replace(EMPH_TRAIL, "");
  // Restore code-span content verbatim.
  s = s.replace(/\x00(\d+)\x00/g, (_m, d: string) => codeSpans[Number(d)] ?? "");
  s = s.toLowerCase();
  // Keep unicode letters/numbers/underscore, space and hyphen; drop the rest
  // (`*`, `.`, `(`, `)`, `/`, `·`, em-dash, … all removed without collapsing).
  s = s.replace(/[^\p{L}\p{N}_ \-]/gu, "");
  s = s.trim();
  s = s.replace(/ /g, "-");
  return s;
}

const FENCE_RE = /^(\s*)(```|~~~)/;

/** Set of valid heading anchor slugs for a markdown file (with `-1`/`-2` dups). */
export function headingSlugs(absPath: string): Set<string> {
  let text: string;
  try {
    text = fs.readFileSync(absPath, "utf8");
  } catch {
    return new Set();
  }
  const slugs = new Set<string>();
  const seen = new Map<string, number>();
  let inFence = false;
  for (const line of text.split(/\r?\n/)) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (!m) continue;
    let title = m[2].trim();
    title = title.replace(/\s+#+\s*$/, ""); // trailing closing #'s
    const base = slugify(title);
    if (base === "") continue;
    const prev = seen.get(base);
    if (prev === undefined) {
      seen.set(base, 0);
      slugs.add(base);
    } else {
      const next = prev + 1;
      seen.set(base, next);
      slugs.add(`${base}-${next}`);
    }
  }
  return slugs;
}

export interface MdLink {
  line: number;
  raw: string;
  target: string; // url part only (title and surrounding ws stripped)
}

const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

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

/**
 * Validate every in-repo markdown link in `spec/**`. Returns the list of
 * broken links (empty = healthy). A link is broken when its relative path
 * target does not exist (DEAD) or its `#anchor` does not resolve to a heading
 * in the target markdown file (ANCHOR).
 */
export function findBrokenLinks(root: string): LinkViolation[] {
  const files = collectSpecMarkdown(root);
  const violations: LinkViolation[] = [];
  const slugCache = new Map<string, Set<string>>();

  for (const f of files) {
    for (const link of extractLinks(f.absPath)) {
      const { target } = link;

      // Pure same-file anchor.
      if (target.startsWith("#")) {
        const anchor = target.slice(1);
        if (anchor === "") continue;
        let slugs = slugCache.get(f.absPath);
        if (!slugs) {
          slugs = headingSlugs(f.absPath);
          slugCache.set(f.absPath, slugs);
        }
        if (!slugs.has(decodeAnchor(anchor))) {
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
        let slugs = slugCache.get(resolved);
        if (!slugs) {
          slugs = headingSlugs(resolved);
          slugCache.set(resolved, slugs);
        }
        if (!slugs.has(decodeAnchor(anchor))) {
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

// Anchors in these specs are written raw (CJK, not %-encoded); decode defensively
// in case a link percent-encodes a fragment.
function decodeAnchor(anchor: string): string {
  try {
    return decodeURIComponent(anchor);
  } catch {
    return anchor;
  }
}
