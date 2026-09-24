import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  collectApplicableSpecs,
  isPendingPlanPath,
  repoRoot,
} from "./spec-frontmatter-parse";

// Guard 4/4: every path in `pending_plans:` of a spec frontmatter MUST
// (1) BE a work plan — `plan/in-progress/**.md` or `plan/complete/**.md` — and
// (2) exist there (an in-progress path also resolves via its complete/ twin;
// status-lifecycle guard handles the "all completed but status still partial"
// case separately).
// SoT: spec/conventions/spec-impl-evidence.md §2.1 (`pending_plans` row) · §4.
//
// (1) was missing until 2026-09-24. The guard checked only that the path
// existed, so `spec/5-system/10-graph-rag.md` kept three migration `.sql` paths
// in `pending_plans:` for weeks with CI green — the `.sql` files are real. That
// is the documented contract (a plan under in-progress/complete) being wider
// than the enforced one (anything on disk).

describe("spec-pending-plan-existence guard", () => {
  const root = repoRoot();
  const specs = collectApplicableSpecs(root);

  it("collects applicable specs (precondition)", () => {
    expect(specs.length).toBeGreaterThan(0);
  });

  const specsWithPending = specs.filter((s) => {
    const p = s.frontmatter?.pending_plans;
    return Array.isArray(p) && p.length > 0;
  });

  if (specsWithPending.length === 0) {
    it("no specs use pending_plans — guard idle", () => {
      expect(specsWithPending.length).toBe(0);
    });
    return;
  }

  for (const spec of specsWithPending) {
    describe(spec.relPath, () => {
      const pending = spec.frontmatter!.pending_plans!;
      for (const planRel of pending) {
        // Two assertions, two jobs. "is a work plan" owns the SHAPE (a plan
        // under in-progress/complete); "path resolves" only checks EXISTENCE.
        // Existence alone passed a real `.sql` for weeks — do not let the
        // second assertion stand in for the first.
        it(`pending_plan is a work plan — ${planRel}`, () => {
          expect(
            isPendingPlanPath(planRel),
            `${spec.relPath}: pending_plans 의 "${planRel}" 는 plan 이 아니다 — ` +
              `plan/in-progress/**.md 또는 plan/complete/**.md 여야 한다 ` +
              `(구현 산출물 경로라면 code: 로 옮길 것)`,
          ).toBe(true);
        });

        it(`pending_plan path resolves — ${planRel}`, () => {
          const inProgressAbs = path.join(root, planRel);
          const completeAbs = path.join(
            root,
            planRel.replace("/in-progress/", "/complete/"),
          );
          const exists =
            fs.existsSync(inProgressAbs) || fs.existsSync(completeAbs);
          expect(exists).toBe(true);
        });
      }
    });
  }
});
