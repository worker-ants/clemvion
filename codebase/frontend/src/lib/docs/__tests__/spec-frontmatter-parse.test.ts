import { describe, it, expect } from "vitest";
import { isApplicable, matterNoCache } from "./spec-frontmatter-parse";

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

// gray-matter 캐시 우회 계약. NERV 전환 단계 3 에서 `plan-scan.ts` 와 그 테스트를 지우며
// 이 함수를 여기로 옮겼고 계약 테스트도 함께 옮긴다. 이 테스트가 없으면 `{}` 를 빠뜨린
// `matter(raw)` 로 되돌려도 아무것도 실패하지 않는다.
describe("matterNoCache", () => {
  const BROKEN = "---\n: : bad yaml for the parse contract : :\n---\n";

  it("throws on unparseable frontmatter — on every call, not just the first", () => {
    // gray-matter 는 옵션 없이 부르면 파싱 **전에** 캐시를 등록해, throw 한 내용의
    // 2회차 호출이 조용히 `data={}` 로 성공한다. 깨진 frontmatter 가 호출 순서에 따라
    // 빈 값으로 보이면 `parseError` 가 리포트에서 사라진다.
    expect(() => matterNoCache(BROKEN)).toThrow();
    expect(() => matterNoCache(BROKEN), "2회차가 조용히 성공했다 — 캐시 우회가 깨졌다").toThrow();
    expect(() => matterNoCache(BROKEN)).toThrow();
  });

  it("parses a valid document and treats no frontmatter as empty", () => {
    expect(matterNoCache("---\nid: x\n---\n# Doc\n").data).toEqual({ id: "x" });
    expect(matterNoCache("# 제목만 있는 문서\n").data).toEqual({});
  });
});
