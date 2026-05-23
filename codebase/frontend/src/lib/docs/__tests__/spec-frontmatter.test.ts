import { describe, it, expect } from "vitest";
import {
  collectApplicableSpecs,
  repoRoot,
  SPEC_STATUS_VALUES,
} from "./spec-frontmatter-parse";

// Guard 1/4: every applicable spec MUST have valid frontmatter with the
// required keys `id` (string) and `status` (enum 5 values).
// SoT: spec/conventions/spec-impl-evidence.md §2.1.

describe("spec-frontmatter guard", () => {
  const specs = collectApplicableSpecs(repoRoot());

  it("collects applicable specs (precondition)", () => {
    expect(specs.length).toBeGreaterThan(0);
  });

  for (const spec of specs) {
    describe(spec.relPath, () => {
      it("frontmatter parse succeeds", () => {
        expect(spec.parseError).toBeNull();
      });
      it("frontmatter object exists", () => {
        expect(spec.frontmatter).not.toBeNull();
      });
      it("`id` is a non-empty string", () => {
        expect(typeof spec.frontmatter?.id).toBe("string");
        expect((spec.frontmatter?.id ?? "").length).toBeGreaterThan(0);
      });
      it(`\`status\` is one of ${SPEC_STATUS_VALUES.join("|")}`, () => {
        expect(SPEC_STATUS_VALUES).toContain(spec.frontmatter?.status);
      });
    });
  }
});
