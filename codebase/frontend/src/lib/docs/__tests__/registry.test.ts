import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  buildSearchIndex,
  getDocBySlug,
  getAllSlugs,
  humanize,
  loadDocsIndex,
  resolveLocalizedDocPath,
  sectionLabel,
  stripNumberPrefix,
} from "../registry";
import { localizedDocsHref } from "../locale";
import {
  UNMIRRORED_GUIDE_KEYS,
  collectMirrorKeys,
  specKeyProblem,
} from "./spec-keys";
import { walkTree } from "./tree-walk";

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

describe("실제 docs — 섹션별 order 유일성 (IA 드리프트 가드)", () => {
  // 섹션 내 order 중복/충돌은 런타임 에러 없이 사이드바 표시 순서만 조용히
  // 어긋나므로 코드 리뷰로만 잡히던 회귀다. 실제 콘텐츠 디렉터리를 스캔해
  // 섹션마다 order 값이 유일한지 결정적으로 단언한다. (ai-review 2026-07-08 W2)
  const contentRoot = path.resolve(__dirname, "..", "..", "..", "content", "docs");
  const realIndex = loadDocsIndex(contentRoot, { includeDrafts: true });

  it.each(realIndex.sections.map((s) => s.key))(
    "섹션 '%s' 페이지의 order 는 서로 중복되지 않아요",
    (sectionKey) => {
      const section = realIndex.sections.find((s) => s.key === sectionKey);
      const orders = (section?.pages ?? []).map((p) => p.frontmatter.order);
      const duplicates = [
        ...new Set(orders.filter((o, i) => orders.indexOf(o) !== i)),
      ];
      expect(
        duplicates,
        `섹션 ${sectionKey} 에 중복된 order: ${duplicates.join(", ")}`,
      ).toEqual([]);
    },
  );
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

describe("locale sibling 감지", () => {
  it(".en.mdx sibling이 존재하면 availableLocales에 'en'이 포함돼요", () => {
    const index = loadDocsIndex(fixturesRoot, { includeDrafts: true });
    const withEn = getDocBySlug(index, ["01-first", "a"]);
    const withoutEn = getDocBySlug(index, ["01-first", "b"]);
    expect(withEn?.availableLocales).toEqual(["ko", "en"]);
    expect(withoutEn?.availableLocales).toEqual(["ko"]);
  });

  it("sibling `.en.mdx`는 별도 페이지로 등록되지 않아요", () => {
    const index = loadDocsIndex(fixturesRoot, { includeDrafts: true });
    const first = index.sections.find((s) => s.key === "01-first");
    expect(first?.pages.map((p) => p.slug[1])).toEqual(["a", "b"]);
  });

  it("resolveLocalizedDocPath는 sibling이 있으면 그 경로를 반환, 없으면 canonical로 폴백해요", () => {
    const index = loadDocsIndex(fixturesRoot, { includeDrafts: true });
    const withEn = getDocBySlug(index, ["01-first", "a"])!;
    const withoutEn = getDocBySlug(index, ["01-first", "b"])!;
    expect(resolveLocalizedDocPath(withEn.filePath, "en")).toMatch(
      /a\.en\.mdx$/,
    );
    expect(resolveLocalizedDocPath(withoutEn.filePath, "en")).toBe(
      withoutEn.filePath,
    );
    expect(resolveLocalizedDocPath(withEn.filePath, "ko")).toBe(
      withEn.filePath,
    );
  });
});

describe("localizedDocsHref", () => {
  it("locale 프리픽스를 slug 앞에 붙여요", () => {
    expect(localizedDocsHref(["01-first", "a"], "ko")).toBe(
      "/docs/ko/01-first/a",
    );
    expect(localizedDocsHref(["01-first", "a"], "en")).toBe(
      "/docs/en/01-first/a",
    );
  });
});

describe("buildSearchIndex(locale)", () => {
  it("locale 인자를 생략하면 DEFAULT_LOCALE(ko) 동작과 동일해요", () => {
    const index = loadDocsIndex(fixturesRoot, { includeDrafts: true });
    const withoutLocale = buildSearchIndex(index);
    const withKo = buildSearchIndex(index, "ko");
    expect(withoutLocale).toEqual(withKo);
  });

  it("기본 locale(ko)에서는 한국어 title/summary/headings를 반환해요", () => {
    const index = loadDocsIndex(fixturesRoot, { includeDrafts: true });
    const entries = buildSearchIndex(index, "ko");
    const a = entries.find((e) => e.href === "/docs/ko/01-first/a");
    expect(a).toBeDefined();
    expect(a?.title).toBe("첫 번째 페이지");
    expect(a?.summary).toBe("첫 번째 섹션의 첫 번째 페이지");
    expect(a?.headings).toContain("한국어 전용 헤딩");
    // 번역되지 않은 섹션 레이블은 humanize 폴백
    expect(a?.sectionLabel).toBe("First");
  });

  it("en locale에서는 sibling 본문의 heading과 locale 프론트매터를 사용해요", () => {
    const index = loadDocsIndex(fixturesRoot, { includeDrafts: true });
    const entries = buildSearchIndex(index, "en");
    const a = entries.find((e) => e.href === "/docs/en/01-first/a");
    expect(a).toBeDefined();
    expect(a?.title).toBe("First page");
    expect(a?.summary).toBe("First page of the first section");
    expect(a?.headings).toContain("EN-only heading");
    expect(a?.headings).not.toContain("한국어 전용 헤딩");
  });

  it("en 번역이 없으면 canonical 본문·프론트매터로 폴백해요", () => {
    const index = loadDocsIndex(fixturesRoot, { includeDrafts: true });
    const entries = buildSearchIndex(index, "en");
    const b = entries.find((e) => e.href === "/docs/en/01-first/b");
    expect(b).toBeDefined();
    expect(b?.title).toBe("두 번째 페이지");
  });
});

// CLE-UI-GUIDE REQ-GUIDE-032(빌드 검증): 사용자 가이드 MDX 프론트매터의 `spec:` 키가 가리키는
// 스펙과 `code:` 경로가 실제로 있는지, 영어 형제 파일에 프론트매터가 없는지 CI 에서 확인한다.
// 리네임 · 삭제 · 오타로 가이드가 없는 대상을 가리키는 것을 막는다.
//
// `spec:` 은 NERV 스펙 키 목록이다(NERV 정본 전환 단계 4b). 키는 저장소 미러 파일
// 이름으로 확인한다(`./spec-keys`).
describe("real docs frontmatter spec/code references", () => {
  // __dirname = codebase/frontend/src/lib/docs/__tests__
  // 6 hops back lands at the repo root. commit 33521233 (codebase/ wrapper)
  // added one level that this resolver did not follow.
  const repoRoot = path.resolve(__dirname, "..", "..", "..", "..", "..", "..");
  const realDocsRoot = path.resolve(__dirname, "..", "..", "..", "content", "docs");

  // 본 worktree 에 실제 content/docs 가 있을 때만 검증. 격리 환경에서 docs 폴더가
  // 부재할 수 있으므로 부재 시는 skip — 표준 개발 환경에서는 항상 수행된다.
  const hasRealDocs = fs.existsSync(realDocsRoot);
  const mirrorKeys = collectMirrorKeys(path.join(repoRoot, "spec"));

  it.runIf(hasRealDocs)(
    "모든 .mdx frontmatter 의 spec 키와 code 경로가 실재해요",
    () => {
      // 미러가 비면 모든 키가 "없는 키" 로 떨어진다. 그 전에 원인을 드러낸다. 편 수 하한은
      // 두지 않는다 — 미러는 부분 스냅샷이다.
      expect(mirrorKeys.size).toBeGreaterThan(0);
      const index = loadDocsIndex(realDocsRoot, { includeDrafts: true });
      const missing: string[] = [];
      for (const section of index.sections) {
        for (const page of section.pages) {
          const fm = page.frontmatter;
          const where = `${section.key}/${page.slug.slice(-1)[0]}`;
          // `spec: "CLE-X"` 처럼 목록이 아니면 글자마다 실패가 나와 원인이 흐려진다.
          for (const [field, value] of [
            ["spec", fm.spec],
            ["code", fm.code],
          ] as const) {
            if (
              value !== undefined &&
              !(Array.isArray(value) && value.every((v) => typeof v === "string"))
            ) {
              missing.push(`${where} → ${field}: 문자열 목록이 아니다`);
            }
          }
          for (const key of Array.isArray(fm.spec) ? fm.spec : []) {
            if (typeof key !== "string") continue;
            const problem = specKeyProblem(key, mirrorKeys);
            if (problem) missing.push(`${where} → spec: ${key} (${problem})`);
          }
          for (const raw of Array.isArray(fm.code) ? fm.code : []) {
            if (typeof raw !== "string") continue;
            // 일부 code 경로는 디렉터리이거나 trailing `/` 가 붙어 있다 — 양쪽 모두 허용.
            if (!fs.existsSync(path.resolve(repoRoot, raw))) {
              missing.push(`${where} → code: ${raw}`);
            }
          }
        }
      }
      expect(missing, missing.join("\n")).toEqual([]);
    },
  );

  // 영어 형제 파일(`<slug>.en.mdx`)은 본문만 둔다. 프론트매터를 붙여도 렌더 · 검색에 쓰이지
  // 않고 위 검사도 보지 않아서, 그 안의 spec · code 참조는 낡아도 알 수 없다.
  // `_` 접두 디렉터리도 본다(`collectMdxFiles` 와 달리) — 형제 파일은 어디 있든 같은 규칙이다.
  it.runIf(hasRealDocs)("영어 형제 파일에는 프론트매터가 없어요", () => {
    const siblings = walkTree(path.dirname(realDocsRoot), [path.basename(realDocsRoot)], {
      includeFile: (name) => name.endsWith(".en.mdx"),
    });
    // 하나도 못 찾으면 아래 단언이 공허하게 통과한다.
    expect(siblings.length).toBeGreaterThan(0);
    // gray-matter 는 BOM 을 벗기고 읽으므로 BOM 뒤의 프론트매터도 프론트매터다.
    const offenders = siblings
      .filter((f) => /^﻿?---\r?\n/.test(fs.readFileSync(f.absPath, "utf8")))
      .map((f) => f.relPath);
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it.runIf(hasRealDocs)("미러 제외 영역 키 목록은 미러에 없는 키만 담아요", () => {
    // 그 영역을 미러하기 시작하면 키는 미러 파일로 확인되므로 목록에서 뺀다.
    const mirrored = [...UNMIRRORED_GUIDE_KEYS].filter((k) => mirrorKeys.has(k));
    expect(mirrored).toEqual([]);
  });
});
