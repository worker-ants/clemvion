import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { repoRoot } from "./spec-frontmatter-parse";

// Gate C — plan-completion spec-consistency.
//
// When work finishes, the spec↔code consistency decision must be recorded, not
// left implicit. Every completed plan must declare `spec_impact` in its
// frontmatter:
//   spec_impact: none                      # no spec change was needed
//   spec_impact:                           # OR: the spec files this work touched
//     - spec/5-system/4-execution-engine.md
// A list entry must resolve to a real spec file (dangling-ref guard, mirrors
// spec-pending-plan-existence). `none` / `없음` asserts a conscious no-op.
//
// Grandfathered: plans `started` before the cutoff predate this gate and are
// exempt — only completions of work started on/after the cutoff are enforced,
// so the existing backlog is never retro-required (same pattern as the
// spec-only TTL in spec-status-lifecycle). SoT:
// spec/conventions/spec-impl-evidence.md + .claude/docs/plan-lifecycle.md §5.

const GATE_C_CUTOFF = new Date("2026-06-04T00:00:00Z");
const NONE_VALUES = new Set(["none", "없음", "n/a", "na"]);

function startedDate(data: Record<string, unknown>): Date | null {
  const s = data.started;
  if (s instanceof Date) return s;
  if (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T00:00:00Z`);
  }
  return null;
}

function collectCompletePlans(root: string): string[] {
  const dir = path.join(root, "plan", "complete");
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        // `archive/` holds one-off historical docs, not lifecycle plans.
        if (e.name === "archive") continue;
        stack.push(full);
      } else if (
        e.isFile() &&
        e.name.endsWith(".md") &&
        !e.name.startsWith("0-") &&
        !e.name.startsWith("_")
      ) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

describe("Gate C — plan-completion spec-consistency", () => {
  const root = repoRoot();
  const plans = collectCompletePlans(root);

  // Plans started on/after the cutoff that must carry a spec_impact decision.
  const enforced = plans.filter((abs) => {
    let data: Record<string, unknown> = {};
    try {
      data = matter(fs.readFileSync(abs, "utf8")).data ?? {};
    } catch {
      return false;
    }
    const d = startedDate(data);
    return d !== null && d.getTime() >= GATE_C_CUTOFF.getTime();
  });

  it("resolves a real repo root with a complete plan dir", () => {
    // Guard against repoRoot() misresolving → empty scan → vacuous pass of the
    // (currently all-grandfathered) enforcement set.
    expect(
      fs.existsSync(path.join(root, "plan", "complete")),
      `repoRoot missing plan/complete/: ${root}`,
    ).toBe(true);
    expect(plans.length).toBeGreaterThan(10);
  });

  for (const abs of enforced) {
    const rel = path.relative(root, abs).split(path.sep).join("/");
    describe(rel, () => {
      const data = matter(fs.readFileSync(abs, "utf8")).data ?? {};
      const impact = (data as Record<string, unknown>).spec_impact;

      it("declares `spec_impact`", () => {
        const ok =
          (typeof impact === "string" && impact.trim().length > 0) ||
          (Array.isArray(impact) && impact.length > 0);
        expect(
          ok,
          `${rel}: completed plan must declare frontmatter spec_impact (spec path list, or "none")`,
        ).toBe(true);
      });

      it("each `spec_impact` spec path exists (if a list)", () => {
        if (!Array.isArray(impact)) return;
        const dangling = impact.filter(
          (p) => typeof p === "string" && !fs.existsSync(path.join(root, p)),
        );
        expect(
          dangling,
          `${rel}: spec_impact references missing spec file(s): ${dangling.join(", ")}`,
        ).toEqual([]);
      });

      it("string `spec_impact` is an explicit no-op assertion", () => {
        if (Array.isArray(impact)) return;
        if (typeof impact !== "string") return;
        expect(
          NONE_VALUES.has(impact.trim().toLowerCase()),
          `${rel}: string spec_impact must be "none"/"없음" (else use a spec path list)`,
        ).toBe(true);
      });
    });
  }
});
