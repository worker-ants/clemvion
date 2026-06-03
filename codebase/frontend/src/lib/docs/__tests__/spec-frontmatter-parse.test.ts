import { describe, it, expect } from "vitest";
import { isApplicable } from "./spec-frontmatter-parse";

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
  // lifecycle-tracked specs. SoT: spec-impl-evidence.md §1 제외 + Rationale R-7.
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
