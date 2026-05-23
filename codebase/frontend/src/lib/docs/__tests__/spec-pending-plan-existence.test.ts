import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  collectApplicableSpecs,
  repoRoot,
} from "./spec-frontmatter-parse";

// Guard 4/4: every path in `pending_plans:` of a spec frontmatter MUST
// either (a) exist under plan/in-progress/ OR (b) exist under
// plan/complete/ (status-lifecycle guard handles the "all completed but
// status still partial" case separately).
// SoT: spec/conventions/spec-impl-evidence.md §4.

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
