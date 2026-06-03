import { describe, it, expect } from "vitest";
import { isApplicable } from "./spec-frontmatter-parse";

// Guard for the `isApplicable` scope rules used by all four spec-frontmatter
// guards (frontmatter / code-paths / status-lifecycle / pending-plan).
// SoT: spec/conventions/spec-impl-evidence.md §1.
describe("isApplicable", () => {
  it("includes normal area specs", () => {
    expect(isApplicable("spec/4-nodes/1-logic/12-background.md")).toBe(true);
    expect(isApplicable("spec/5-system/4-execution-engine.md")).toBe(true);
    expect(isApplicable("spec/conventions/execution-context.md")).toBe(true);
  });

  it("excludes non-.md, underscore-prefixed, and named overview files", () => {
    expect(isApplicable("spec/5-system/notes.txt")).toBe(false);
    expect(isApplicable("spec/4-nodes/_product-overview.md")).toBe(false);
    expect(isApplicable("spec/0-overview.md")).toBe(false);
    expect(isApplicable("spec/1-data-model.md")).toBe(false);
  });

  // cafe24-api-catalog: the top-level <resource>.md files ARE lifecycle specs
  // (id + status) and stay validated; the nested per-entity field catalogs are
  // generated API reference data (frontmatter: resource/entity/...) and are NOT
  // lifecycle-tracked specs. SoT: spec-impl-evidence.md §1 제외 + Rationale R-7.
  it("keeps the top-level resource index files validated", () => {
    expect(isApplicable("spec/conventions/cafe24-api-catalog/application.md")).toBe(true);
    expect(isApplicable("spec/conventions/cafe24-api-catalog/category.md")).toBe(true);
  });

  it("excludes the nested field-level catalog files", () => {
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
  });

  it("would also exclude future *-api-catalog field files (e.g. makeshop)", () => {
    expect(
      isApplicable("spec/conventions/makeshop-api-catalog/product/products.md"),
    ).toBe(false);
    // ...while keeping a hypothetical makeshop resource index validated.
    expect(
      isApplicable("spec/conventions/makeshop-api-catalog/product.md"),
    ).toBe(true);
  });
});
