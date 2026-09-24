import { describe, it, expect } from "vitest";
import { isApplicable, isPendingPlanPath } from "./spec-frontmatter-parse";

// Guard for the `isApplicable` scope rules used by all four spec-frontmatter
// guards (frontmatter / code-paths / status-lifecycle / pending-plan).
// SoT: spec/conventions/spec-impl-evidence.md §1.
describe("isApplicable", () => {
  // One sample per INCLUDE_PREFIXES entry — guards against a silent regression
  // if a prefix is dropped from the include list.
  it("includes a sample spec under every INCLUDE_PREFIXES entry", () => {
    expect(isApplicable("spec/2-navigation/10-auth-flow.md")).toBe(true);
    expect(isApplicable("spec/3-workflow-editor/1-overview.md")).toBe(true);
    expect(isApplicable("spec/4-nodes/1-logic/12-background.md")).toBe(true);
    expect(isApplicable("spec/5-system/4-execution-engine.md")).toBe(true);
    expect(isApplicable("spec/7-channel-web-chat/1-overview.md")).toBe(true);
    expect(isApplicable("spec/conventions/execution-context.md")).toBe(true);
  });

  it("excludes paths failing the prefix check", () => {
    expect(isApplicable("spec/5-system/notes.txt")).toBe(false); // not .md
    expect(isApplicable("docs/random.md")).toBe(false); // outside INCLUDE_PREFIXES
  });

  it("excludes underscore-prefixed and named-overview basenames", () => {
    expect(isApplicable("spec/4-nodes/_product-overview.md")).toBe(false);
    expect(isApplicable("spec/conventions/_overview.md")).toBe(false);
    expect(isApplicable("spec/0-overview.md")).toBe(false);
    expect(isApplicable("spec/1-data-model.md")).toBe(false);
    expect(isApplicable("spec/6-brand.md")).toBe(false);
  });

  // cafe24-api-catalog: the top-level <resource>.md files ARE lifecycle specs
  // (id + status) and stay validated; the nested per-entity field catalogs are
  // generated API reference data (frontmatter: resource/entity/...) and are NOT
  // lifecycle-tracked specs. SoT: spec-impl-evidence.md §1 제외 + §Rationale R-7.
  it("keeps the top-level resource index files validated", () => {
    expect(isApplicable("spec/conventions/cafe24-api-catalog/application.md")).toBe(true);
    expect(isApplicable("spec/conventions/cafe24-api-catalog/category.md")).toBe(true);
  });

  it("excludes the nested field-level catalog files (incl. deeper nesting)", () => {
    expect(
      isApplicable("spec/conventions/cafe24-api-catalog/application/apps.md"),
    ).toBe(false);
    expect(
      isApplicable("spec/conventions/cafe24-api-catalog/category/categories.md"),
    ).toBe(false);
    expect(
      isApplicable(
        "spec/conventions/cafe24-api-catalog/category/categories__seo.md",
      ),
    ).toBe(false);
    // 3-level (and deeper) nesting under the catalog is also excluded — the
    // tail `.+\.md` spans any remaining depth.
    expect(
      isApplicable("spec/conventions/cafe24-api-catalog/order/sub/detail.md"),
    ).toBe(false);
  });

  it("only matches the *-api-catalog directory, not look-alike paths", () => {
    // A non-catalog directory that merely sits under conventions stays applicable.
    expect(
      isApplicable("spec/conventions/cafe24/resource/field.md"),
    ).toBe(true);
  });

  it("excludes future *-api-catalog nested field files (e.g. makeshop)", () => {
    expect(
      isApplicable("spec/conventions/makeshop-api-catalog/product/products.md"),
    ).toBe(false);
    // ...while keeping a hypothetical makeshop resource index validated.
    expect(
      isApplicable("spec/conventions/makeshop-api-catalog/product.md"),
    ).toBe(true);
  });
});

// Guard for what a `pending_plans:` entry may point at.
// SoT: spec/conventions/spec-impl-evidence.md §3 (`pending_plans` row — a plan
// path under `plan/in-progress/` or `plan/complete/`) and §4.
//
// Why this exists: the existence guard used to accept ANY path that exists on
// disk. `spec/5-system/10-graph-rag.md` carried three migration `.sql` paths in
// `pending_plans:` for weeks and CI stayed green, because the `.sql` files are
// real. The documented contract (a plan under in-progress/complete) was wider
// than what was enforced (anything that exists).
describe("isPendingPlanPath", () => {
  it("accepts plan files under in-progress/ and complete/", () => {
    expect(isPendingPlanPath("plan/in-progress/foo.md")).toBe(true);
    expect(isPendingPlanPath("plan/complete/foo.md")).toBe(true);
    expect(isPendingPlanPath("plan/complete/archive/from-x/foo.md")).toBe(true);
  });

  it("rejects the incident shape — an existing non-plan file", () => {
    expect(
      isPendingPlanPath("codebase/backend/migrations/V026__graph_rag.sql"),
    ).toBe(false);
  });

  it("rejects plan/ locations that are not work plans", () => {
    // research/ is referenced material with no completion endpoint
    // (CLAUDE.md 정보 저장 위치) — it can never become "implemented".
    expect(isPendingPlanPath("plan/research/foo.md")).toBe(false);
    expect(isPendingPlanPath("plan/foo.md")).toBe(false);
  });

  it("rejects non-markdown and bare directories", () => {
    expect(isPendingPlanPath("plan/in-progress/foo.sql")).toBe(false);
    expect(isPendingPlanPath("plan/in-progress/")).toBe(false);
    expect(isPendingPlanPath("plan/in-progress/foo")).toBe(false);
  });

  it("rejects paths that escape plan/ via `..` despite the prefix", () => {
    // A prefix check on the raw string passes this; normalising first does not.
    expect(isPendingPlanPath("plan/in-progress/../../codebase/x.md")).toBe(
      false,
    );
  });

  it("rejects spec paths listed by mistake", () => {
    expect(isPendingPlanPath("spec/5-system/10-graph-rag.md")).toBe(false);
  });
});
