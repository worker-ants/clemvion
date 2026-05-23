import { describe, it, expect } from "vitest";
import {
  collectApplicableSpecs,
  globMatchesAny,
  repoRoot,
} from "./spec-frontmatter-parse";

// Guard 2/4: every spec with status `partial` or `implemented` MUST have
// at least one `code:` glob that matches at least one real file.
// `spec-only` / `backlog` / `archived` allow empty code.
// SoT: spec/conventions/spec-impl-evidence.md §3.

describe("spec-code-paths guard", () => {
  const root = repoRoot();
  const specs = collectApplicableSpecs(root);

  for (const spec of specs) {
    const fm = spec.frontmatter;
    if (!fm || (fm.status !== "partial" && fm.status !== "implemented")) {
      continue;
    }
    describe(`${spec.relPath} (status=${fm.status})`, () => {
      const codes = Array.isArray(fm.code) ? fm.code : [];
      it("`code:` is a non-empty list", () => {
        expect(codes.length).toBeGreaterThan(0);
      });
      it("at least one `code:` entry resolves to a real file", () => {
        const anyMatch = codes.some((c) => globMatchesAny(c, root));
        expect(anyMatch).toBe(true);
      });
    });
  }
});
