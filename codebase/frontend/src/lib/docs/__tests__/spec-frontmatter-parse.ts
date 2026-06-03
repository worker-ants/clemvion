// Shared helpers for spec-frontmatter / spec-code-paths /
// spec-status-lifecycle / spec-pending-plan-existence guards.
// SoT: spec/conventions/spec-impl-evidence.md

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export type SpecStatus =
  | "backlog"
  | "spec-only"
  | "partial"
  | "implemented"
  | "archived";

export const SPEC_STATUS_VALUES: SpecStatus[] = [
  "backlog",
  "spec-only",
  "partial",
  "implemented",
  "archived",
];

export interface SpecFrontmatter {
  id?: string;
  status?: SpecStatus;
  code?: string[];
  pending_plans?: string[];
  user_guide?: string[];
}

export interface SpecRecord {
  absPath: string;
  relPath: string;
  basename: string;
  frontmatter: SpecFrontmatter | null;
  body: string;
  parseError: string | null;
}

// repo root = 5 levels up from codebase/frontend/src/lib/docs/__tests__
export function repoRoot(): string {
  return path.resolve(__dirname, "../../../../../..");
}

// Applicable spec files per spec-impl-evidence.md §1.
const INCLUDE_PREFIXES = [
  "spec/2-navigation/",
  "spec/3-workflow-editor/",
  "spec/4-nodes/",
  "spec/5-system/",
  "spec/7-channel-web-chat/",
  "spec/conventions/",
];

const EXCLUDE_BASENAMES = new Set<string>([
  "0-overview.md",
  "1-data-model.md",
  "6-brand.md",
]);

// API reference catalogs (e.g. cafe24-api-catalog) hold generated field-level
// reference files (frontmatter: resource/entity/cafe24_docs/source), not
// lifecycle-tracked specs. The top-level `<resource>.md` index files ARE specs
// (id + status: implemented) and stay validated; only the nested per-entity
// catalog files are excluded. SoT: spec/conventions/spec-impl-evidence.md §1
// 제외 + Rationale R-7. Matches `spec/conventions/<name>-api-catalog/<seg>/…md`
// (a path segment AFTER the catalog dir → nested field file), so a top-level
// `<name>-api-catalog/<resource>.md` does not match and stays validated.
const CATALOG_FIELD_FILE =
  /^spec\/conventions\/[^/]+-api-catalog\/[^/]+\/.+\.md$/;

export function isApplicable(relPath: string): boolean {
  if (!relPath.endsWith(".md")) return false;
  if (!INCLUDE_PREFIXES.some((p) => relPath.startsWith(p))) return false;
  const base = path.basename(relPath);
  if (base.startsWith("_")) return false;
  if (EXCLUDE_BASENAMES.has(base)) return false;
  if (CATALOG_FIELD_FILE.test(relPath)) return false;
  return true;
}

export function collectApplicableSpecs(root: string): SpecRecord[] {
  const out: SpecRecord[] = [];
  const specDir = path.join(root, "spec");
  if (!fs.existsSync(specDir)) return out;

  const stack: string[] = [specDir];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && full.endsWith(".md")) {
        const rel = path.relative(root, full);
        if (!isApplicable(rel)) continue;
        out.push(parseSpecFile(full, rel));
      }
    }
  }
  out.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return out;
}

function parseSpecFile(absPath: string, relPath: string): SpecRecord {
  const raw = fs.readFileSync(absPath, "utf8");
  let fm: SpecFrontmatter | null = null;
  let body = raw;
  let parseError: string | null = null;
  try {
    const parsed = matter(raw);
    body = parsed.content;
    if (parsed.data && Object.keys(parsed.data).length > 0) {
      fm = parsed.data as SpecFrontmatter;
    }
  } catch (e) {
    parseError = e instanceof Error ? e.message : String(e);
  }
  return {
    absPath,
    relPath,
    basename: path.basename(relPath),
    frontmatter: fm,
    body,
    parseError,
  };
}

// Simple glob matcher — supports `**` (any path segments) and `*`
// (single segment chars). Anchored to repo root. Returns true if at
// least one real file matches the pattern.
export function globMatchesAny(pattern: string, root: string): boolean {
  // Find a literal prefix (the part before the first `*`) so we know where
  // to start walking. If the whole pattern is literal, just check the file.
  const starIdx = pattern.search(/[*?]/);
  if (starIdx === -1) {
    return fs.existsSync(path.join(root, pattern));
  }
  const literalPrefix = pattern.slice(0, starIdx);
  // Walk from the deepest existing directory of the prefix.
  let walkRoot = path.join(root, literalPrefix);
  while (walkRoot !== root && !fs.existsSync(walkRoot)) {
    walkRoot = path.dirname(walkRoot);
  }
  if (!fs.existsSync(walkRoot)) return false;

  const re = globToRegex(pattern);

  const stack: string[] = [walkRoot];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      const rel = path.relative(root, full);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.isFile()) {
        if (re.test(rel)) return true;
      }
    }
  }
  return false;
}

function globToRegex(glob: string): RegExp {
  // Order matters: handle ** first, then *.
  let re = "";
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += ".*";
      i += 2;
      if (glob[i] === "/") i += 1;
    } else if (c === "*") {
      re += "[^/]*";
      i += 1;
    } else if (c === "?") {
      re += "[^/]";
      i += 1;
    } else if ("\\^$+.()|{}[]".includes(c)) {
      re += "\\" + c;
      i += 1;
    } else {
      re += c;
      i += 1;
    }
  }
  return new RegExp("^" + re + "$");
}
