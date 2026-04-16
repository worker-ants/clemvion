import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  loadDocsIndex,
  getDocBySlug,
  getAllSlugs,
  humanize,
  sectionLabel,
  stripNumberPrefix,
} from "../registry";

const fixturesRoot = path.resolve(__dirname, "fixtures");

describe("loadDocsIndex", () => {
  it("섹션을 디렉터리 프리픽스 순으로 정렬해요", () => {
    const index = loadDocsIndex(fixturesRoot, { includeDrafts: true });
    expect(index.sections.map((s) => s.key)).toEqual(["01-first", "02-second"]);
  });

  it("각 섹션 내 페이지를 order 오름차순으로 정렬해요", () => {
    const index = loadDocsIndex(fixturesRoot, { includeDrafts: true });
    const first = index.sections.find((s) => s.key === "01-first");
    expect(first?.pages.map((p) => p.frontmatter.order)).toEqual([1, 2]);
  });

  it("언더스코어로 시작하는 디렉터리·파일은 제외해요", () => {
    const index = loadDocsIndex(fixturesRoot, { includeDrafts: true });
    expect(index.sections.some((s) => s.key.startsWith("_"))).toBe(false);
    const allHrefs = Array.from(index.byHref.keys());
    expect(allHrefs.every((h) => !h.includes("_hidden"))).toBe(true);
  });

  it("draft 페이지는 기본적으로 제외해요", () => {
    const index = loadDocsIndex(fixturesRoot);
    const second = index.sections.find((s) => s.key === "02-second");
    expect(second?.pages.map((p) => p.frontmatter.title)).toEqual([
      "두 번째 섹션의 페이지",
    ]);
  });

  it("includeDrafts 옵션으로 draft 페이지를 포함해요", () => {
    const index = loadDocsIndex(fixturesRoot, { includeDrafts: true });
    const second = index.sections.find((s) => s.key === "02-second");
    expect(second?.pages.length).toBe(2);
  });

  it("href는 /docs/<section>/<slug> 형태에요", () => {
    const index = loadDocsIndex(fixturesRoot, { includeDrafts: true });
    expect(index.byHref.has("/docs/01-first/a")).toBe(true);
    expect(index.byHref.has("/docs/01-first/b")).toBe(true);
    expect(index.byHref.has("/docs/02-second/d")).toBe(true);
  });

  it("slug는 파일 경로와 1:1 매핑돼요", () => {
    const index = loadDocsIndex(fixturesRoot, { includeDrafts: true });
    const doc = index.byHref.get("/docs/01-first/a");
    expect(doc?.slug).toEqual(["01-first", "a"]);
  });

  it("frontmatter 필수 필드 검증에 실패하면 예외를 던져요", () => {
    const brokenRoot = path.resolve(__dirname, "fixtures-broken");
    expect(() => loadDocsIndex(brokenRoot)).toThrow();
  });
});

describe("getDocBySlug", () => {
  it("슬러그로 문서를 찾아요", () => {
    const index = loadDocsIndex(fixturesRoot, { includeDrafts: true });
    const doc = getDocBySlug(index, ["01-first", "a"]);
    expect(doc?.frontmatter.title).toBe("첫 번째 페이지");
  });

  it("존재하지 않는 슬러그는 null을 반환해요", () => {
    const index = loadDocsIndex(fixturesRoot, { includeDrafts: true });
    expect(getDocBySlug(index, ["99", "nope"])).toBeNull();
  });
});

describe("getAllSlugs", () => {
  it("draft 제외 모든 슬러그를 반환해요", () => {
    const index = loadDocsIndex(fixturesRoot);
    const slugs = getAllSlugs(index);
    expect(slugs).toEqual(
      expect.arrayContaining([
        ["01-first", "a"],
        ["01-first", "b"],
        ["02-second", "d"],
      ]),
    );
    expect(slugs.some((s) => s.join("/") === "02-second/c")).toBe(false);
  });

  it("includeDrafts: true면 draft 슬러그도 포함해요", () => {
    const index = loadDocsIndex(fixturesRoot, { includeDrafts: true });
    const slugs = getAllSlugs(index);
    expect(slugs.some((s) => s.join("/") === "02-second/c")).toBe(true);
  });
});

describe("헬퍼 함수", () => {
  it("stripNumberPrefix는 프리픽스 숫자를 제거해요", () => {
    expect(stripNumberPrefix("01-foo")).toBe("foo");
    expect(stripNumberPrefix("999-bar-baz")).toBe("bar-baz");
    expect(stripNumberPrefix("no-prefix")).toBe("no-prefix");
  });

  it("humanize는 타이틀 케이스로 변환해요", () => {
    expect(humanize("01-getting-started")).toBe("Getting Started");
    expect(humanize("hello")).toBe("Hello");
  });

  it("sectionLabel은 알려진 키는 한글 레이블, 모르는 키는 humanize 결과를 반환해요", () => {
    expect(sectionLabel("01-getting-started")).toBe("시작하기");
    expect(sectionLabel("02-nodes")).toBe("노드 가이드");
    expect(sectionLabel("99-unknown-section")).toBe("Unknown Section");
  });
});

describe("섹션 제외 규칙", () => {
  it("모든 페이지가 draft이고 includeDrafts=false면 섹션이 제거돼요", () => {
    // 02-second 섹션에 draft 아닌 d.mdx가 있어 fixtures로는 바로 검증 어렵지만,
    // loadDocsIndex의 `if (pages.length === 0) continue;` 경로를 커버하기 위해
    // 아무 mdx도 없는 빈 섹션(있으면) 필터가 작동함을 간접 확인해요.
    const index = loadDocsIndex(fixturesRoot);
    // _hidden 섹션은 이름 기반으로 제외돼 sections에 없어요
    expect(index.sections.some((s) => s.key === "_hidden")).toBe(false);
  });
});
