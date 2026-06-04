import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { repoRoot } from "./spec-frontmatter-parse";

// Guard: every top-level in-progress plan carries the lifecycle frontmatter
// (worktree / started / owner) so plan-coherence collision-detection and the
// stale-audit operate on real data. SoT: .claude/docs/plan-lifecycle.md §4.
//
// Scope = `plan/in-progress/*.md` (top level only). Grouped subfolders hold
// working material under a cluster index and are exempt. `0-`/`_`-prefixed
// index files are exempt.
//
// `worktree` accepts a real `<task>-<slug>` name OR the explicit sentinel
// `(unstarted)` for plans with no live worktree yet. Legacy placeholders
// (TBD, "assigned at impl-start", "미정", …) are rejected — they defeat the
// collision check by looking like real-but-dead worktrees.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const WORKTREE_PLACEHOLDER =
  /\bTBD\b|assigned at impl|미정|착수\s*시|^pending$/i;
const WORKTREE_SENTINEL = "(unstarted)";

function collectTopLevelPlans(root: string): string[] {
  const dir = path.join(root, "plan", "in-progress");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(
      (e) =>
        e.isFile() &&
        e.name.endsWith(".md") &&
        !e.name.startsWith("0-") &&
        !e.name.startsWith("_"),
    )
    .map((e) => path.join(dir, e.name))
    .sort();
}

describe("plan-frontmatter guard", () => {
  const root = repoRoot();
  const plans = collectTopLevelPlans(root);

  it("finds top-level in-progress plans to validate", () => {
    // Guard against repoRoot() misresolving → empty scan → vacuous pass.
    expect(
      fs.existsSync(path.join(root, "plan", "in-progress")),
      `repoRoot missing plan/in-progress/: ${root}`,
    ).toBe(true);
    expect(plans.length).toBeGreaterThan(20);
    expect(
      plans.some((p) => path.basename(p) === "knowledge-base-quality-improvements.md"),
      "expected a known plan file to be discovered",
    ).toBe(true);
  });

  for (const abs of plans) {
    const rel = path.relative(root, abs).split(path.sep).join("/");
    describe(rel, () => {
      const raw = fs.readFileSync(abs, "utf8");
      let data: Record<string, unknown> = {};
      let parseOk = true;
      try {
        data = matter(raw).data ?? {};
      } catch {
        parseOk = false;
      }

      it("has a parseable frontmatter block", () => {
        expect(parseOk, `${rel}: frontmatter failed to parse`).toBe(true);
        expect(
          raw.startsWith("---"),
          `${rel}: missing frontmatter block`,
        ).toBe(true);
      });

      it("`worktree` is set and not a legacy placeholder", () => {
        const wt = data.worktree;
        expect(typeof wt === "string" && wt.length > 0, `${rel}: worktree missing`).toBe(true);
        const wtStr = String(wt);
        if (wtStr !== WORKTREE_SENTINEL) {
          expect(
            WORKTREE_PLACEHOLDER.test(wtStr),
            `${rel}: worktree "${wtStr}" is a placeholder — use a real name or the "${WORKTREE_SENTINEL}" sentinel`,
          ).toBe(false);
        }
      });

      it("`started` is an ISO date", () => {
        const s = data.started;
        // js-yaml parses an unquoted YYYY-MM-DD as a Date.
        const ok =
          s instanceof Date ||
          (typeof s === "string" && ISO_DATE.test(s));
        expect(ok, `${rel}: started must be an ISO date (got ${JSON.stringify(s)})`).toBe(true);
      });

      it("`owner` is set", () => {
        const o = data.owner;
        expect(
          typeof o === "string" && o.length > 0,
          `${rel}: owner missing`,
        ).toBe(true);
      });
    });
  }
});
