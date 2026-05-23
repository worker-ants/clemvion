import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  collectApplicableSpecs,
  repoRoot,
} from "./spec-frontmatter-parse";

// Guard 3/4: status lifecycle invariants per spec/conventions/spec-impl-evidence.md §3:
//   (a) `spec-only` TTL — 90 days counted from convention introduction
//       commit (2026-05-23). After that, the spec must move to partial /
//       implemented / backlog / archived.
//   (b) `partial` MUST have `pending_plans:` (at least one).
//   (c) `partial` whose pending_plans are ALL moved to plan/complete/ MUST
//       graduate to `implemented` (not stay partial).
//   (d) `backlog` SHOULD have its `id:` appear in spec/0-overview.md §6.3
//       roadmap text (warning — not enforced when overview lacks §6.3).

const CONVENTION_INTRODUCED = new Date("2026-05-23T00:00:00Z");
const SPEC_ONLY_TTL_DAYS = 90;
const TTL_MS = SPEC_ONLY_TTL_DAYS * 24 * 60 * 60 * 1000;
const TTL_DEADLINE = new Date(CONVENTION_INTRODUCED.getTime() + TTL_MS);

describe("spec-status-lifecycle guard", () => {
  const root = repoRoot();
  const specs = collectApplicableSpecs(root);

  // Load roadmap text once for `backlog` matching.
  const overviewPath = path.join(root, "spec/0-overview.md");
  const overviewText = fs.existsSync(overviewPath)
    ? fs.readFileSync(overviewPath, "utf8")
    : "";

  it("collects applicable specs (precondition)", () => {
    expect(specs.length).toBeGreaterThan(0);
  });

  for (const spec of specs) {
    const fm = spec.frontmatter;
    if (!fm || !fm.status) continue;
    describe(`${spec.relPath} (status=${fm.status})`, () => {
      if (fm.status === "spec-only") {
        it(`(a) within TTL — current date < ${TTL_DEADLINE.toISOString().slice(0, 10)}`, () => {
          expect(Date.now()).toBeLessThan(TTL_DEADLINE.getTime());
        });
        return;
      }

      if (fm.status === "partial") {
        const pending = Array.isArray(fm.pending_plans) ? fm.pending_plans : [];
        it("(b) `pending_plans:` is a non-empty list", () => {
          expect(pending.length).toBeGreaterThan(0);
        });
        it("(c) not all pending_plans completed (else must graduate to implemented)", () => {
          if (pending.length === 0) return;
          const allCompleted = pending.every((p) => {
            const inProgressAbs = path.join(root, p);
            if (fs.existsSync(inProgressAbs)) return false;
            const completeAbs = path.join(root, p.replace("/in-progress/", "/complete/"));
            return fs.existsSync(completeAbs);
          });
          expect(allCompleted).toBe(false);
        });
        return;
      }

      if (fm.status === "backlog") {
        const id = fm.id ?? "";
        it("(d) `id:` is mentioned in spec/0-overview.md (roadmap match — warn-only when overview missing)", () => {
          if (overviewText.length === 0) return;
          expect(overviewText.includes(id)).toBe(true);
        });
        return;
      }

      // implemented / archived — lifecycle guard idle (no TTL / pending_plans constraint).
      it("lifecycle guard idle for this status", () => {
        expect(["implemented", "archived"]).toContain(fm.status);
      });
    });
  }
});
