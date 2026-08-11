// Shared helpers for spec-frontmatter / spec-code-paths /
// spec-status-lifecycle / spec-pending-plan-existence guards.
// SoT: spec/conventions/spec-impl-evidence.md

import fs from "node:fs";
import path from "node:path";
import { walkTree } from "./tree-walk";
import { matterNoCache } from "./plan-scan";

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
// 제외 + spec-impl-evidence.md §Rationale R-7. Matches
// `spec/conventions/<name>-api-catalog/<seg>/…md`
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
  // 종전에는 상대경로를 `path.relative` 원본 그대로 넘겼다 — POSIX 에서만 우연히
  // `isApplicable`/`CATALOG_FIELD_FILE` 의 `/` 가정과 맞았다. `walkTree` 는 항상 `/` 로
  // 정규화하므로 그 잠복 분기가 사라진다.
  return walkTree(root, ["spec"], {
    includeFile: (_name, relPath) => isApplicable(relPath),
  }).map((f) => parseSpecFile(f.absPath, f.relPath));
}

function parseSpecFile(absPath: string, relPath: string): SpecRecord {
  const raw = fs.readFileSync(absPath, "utf8");
  let fm: SpecFrontmatter | null = null;
  let body = raw;
  let parseError: string | null = null;
  try {
    // 캐시 우회는 `plan-scan.ts` 소관이다 — 종전에는 여기만 옵션 없는 `matter(raw)` 라,
    // 그 파일이 다섯 곳에서 없앤 오염 클래스가 저장소에 한 자리 남아 있었다.
    const parsed = matterNoCache(raw);
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
