import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { walkTree } from "./tree-walk";
import { collectSpecMarkdown, collectCodebaseSources } from "./spec-links";
import { collectMdxFiles } from "./impl-anchor-parse";
import { collectApplicableSpecs } from "./spec-frontmatter-parse";

function write(p: string, body = "x"): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}

/**
 * **왜 이 파일이 필요한가.**
 *
 * 여섯 벌이던 DFS 를 `walkTree` 하나로 모으면서, 각 수집기의 필터는 호출부 옵션이 됐다.
 * 그런데 그 옵션들은 **실저장소 데이터로만** 지나가고 있었다 — `-api-catalog/` 제외도,
 * `node_modules` 제외도, `_` 디렉터리 제외도, 저장소가 마침 그 형태라서 통과할 뿐이지
 * 필터를 지워도 스위트가 초록일 수 있다. 이 폴더가 이미 두 번 데인 형태다.
 *
 * 그래서 합성 트리에 **일부러 걸릴 것을 심어** 각 옵션을 양성으로 겨눈다.
 */
describe("walkTree — 계약", () => {
  let root: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "tree-walk-"));
    write(path.join(root, "a/top.md"));
    write(path.join(root, "a/nested/deep.md"));
    write(path.join(root, "a/nested/deeper/deepest.md"));
    write(path.join(root, "a/skipme/hidden.md"));
    write(path.join(root, "a/skipme/again/hidden2.md"));
    write(path.join(root, "a/other.txt"));
    write(path.join(root, "b/second.md"));
  });

  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  const md = (name: string): boolean => name.endsWith(".md");

  it("재귀 수집 + 상대경로 오름차순", () => {
    expect(walkTree(root, ["a"], { includeFile: md }).map((f) => f.relPath)).toEqual([
      "a/nested/deep.md",
      "a/nested/deeper/deepest.md",
      "a/skipme/again/hidden2.md",
      "a/skipme/hidden.md",
      "a/top.md",
    ]);
  });

  it("skipDir 는 그 디렉터리의 **하위 전체**를 잘라낸다 (한 겹이 아니다)", () => {
    const out = walkTree(root, ["a"], {
      skipDir: (name) => name === "skipme",
      includeFile: md,
    }).map((f) => f.relPath);
    // `again/hidden2.md` 까지 사라져야 한다 — 스택에 push 하지 않으므로.
    expect(out).toEqual([
      "a/nested/deep.md",
      "a/nested/deeper/deepest.md",
      "a/top.md",
    ]);
  });

  it("recurse:false 는 base 자신의 파일만 본다", () => {
    expect(
      walkTree(root, ["a"], { includeFile: md, recurse: false }).map((f) => f.relPath),
    ).toEqual(["a/top.md"]);
  });

  it("includeFile 은 basename 과 상대경로를 **둘 다** 받는다", () => {
    // 둘 중 하나만 주면 기존 여섯 walker 중 일부가 표현되지 않는다 — 접두 판정은
    // basename 이 필요하고 경로 판정은 relPath 가 필요하다.
    const seen: Array<[string, string]> = [];
    walkTree(root, ["b"], {
      includeFile: (name, relPath) => {
        seen.push([name, relPath]);
        return false;
      },
    });
    expect(seen).toEqual([["second.md", "b/second.md"]]);
  });

  it("base 여러 개를 한 번에 순회하고, 없는 base 는 조용히 건너뛴다", () => {
    const out = walkTree(root, ["a", "b", "does-not-exist"], {
      skipDir: (name) => name === "skipme",
      includeFile: md,
      recurse: false,
    }).map((f) => f.relPath);
    expect(out).toEqual(["a/top.md", "b/second.md"]);
  });

  it("skipDir 는 basename 과 상대경로를 둘 다 받는다", () => {
    const seen: string[] = [];
    walkTree(root, ["a"], {
      skipDir: (name, relPath) => {
        seen.push(`${name}|${relPath}`);
        return true; // 전부 잘라 top-level 파일만 남긴다
      },
      includeFile: md,
    });
    expect(seen.sort()).toEqual(["nested|a/nested", "skipme|a/skipme"]);
  });
});

/**
 * 각 수집기의 **옵션 배선**을 양성으로 겨눈다. 여기서 겨누지 않으면 옵션을 지워도
 * 실저장소에 해당 형태가 없어 조용히 통과한다.
 */
describe("수집기 필터 배선 — 합성 트리", () => {
  let root: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "collector-wiring-"));

    // collectSpecMarkdown — 생성형 카탈로그 제외는 **상대경로** 판정이다.
    write(path.join(root, "spec/real.md"));
    write(path.join(root, "spec/conventions/cafe24-api-catalog/order.md"));
    write(
      path.join(root, "spec/conventions/cafe24-api-catalog/order/detail.md"),
    );
    write(path.join(root, "spec/not-md.txt"));

    // collectCodebaseSources — skip 디렉터리 4종 + 확장자.
    write(path.join(root, "codebase/frontend/src/keep.ts"));
    write(path.join(root, "codebase/frontend/src/keep.tsx"));
    write(path.join(root, "codebase/frontend/src/skip.js"));
    write(path.join(root, "codebase/frontend/src/node_modules/dep.ts"));
    write(path.join(root, "codebase/frontend/src/dist/out.ts"));
    write(path.join(root, "codebase/frontend/src/build/out.ts"));
    write(path.join(root, "codebase/frontend/src/.next/out.ts"));
    // 루트 목록에 없는 경로는 애초에 안 본다.
    write(path.join(root, "codebase/frontend/other/stray.ts"));

    // collectMdxFiles — `_` 접두는 **디렉터리**에 걸린다(파일명이 아니다).
    write(path.join(root, "guide/page.mdx"));
    write(path.join(root, "guide/_partial.mdx")); // 파일 접두 → 수집된다
    write(path.join(root, "guide/_hidden/inside.mdx")); // 디렉터리 접두 → 제외
    write(path.join(root, "guide/page.md")); // 확장자 불일치
  });

  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  /**
   * **두 가드는 같은 `spec/` 트리를 서로 다르게 본다.** 이 테스트를 쓰면서 발견했고
   * (기대값을 추측으로 적었다가 둘 다 틀렸다), 통합 전후로 **동일하게 보존된** 선재
   * 차이다. "합치는 김에 맞추는" 것은 이 plan 이 금지하는 조용한 스코프 변경이라
   * 고치지 않고 **차이 자체를 고정**한다.
   *
   * | | `spec/` 루트 파일 | 카탈로그 최상위 인덱스 | 카탈로그 중첩 필드 |
   * |---|---|---|---|
   * | `collectSpecMarkdown` (링크 무결성) | **본다** | **안 본다** | 안 본다 |
   * | `collectApplicableSpecs` (frontmatter) | **안 본다** | **본다** | 안 본다 |
   *
   * 근거가 서로 다르다 — 전자는 `relPath.includes("-api-catalog/")` 라 카탈로그 **전체**를
   * 링크 검사에서 빼고(생성물의 링크는 기계가 만든다), 후자는 `INCLUDE_PREFIXES` 로
   * 영역 폴더만 보되 카탈로그 최상위 `<resource>.md` 는 진짜 spec 이라 남긴다
   * (`spec/conventions/spec-impl-evidence.md §1`).
   */
  it("collectSpecMarkdown — 카탈로그를 **통째로** 뺀다 (최상위 인덱스 포함)", () => {
    expect(collectSpecMarkdown(root).map((f) => f.relPath)).toEqual([
      "spec/real.md",
    ]);
  });

  it("collectApplicableSpecs — 영역 폴더만 보되 카탈로그 최상위 인덱스는 **남긴다**", () => {
    expect(collectApplicableSpecs(root).map((f) => f.relPath)).toEqual([
      "spec/conventions/cafe24-api-catalog/order.md",
    ]);
  });

  it("collectCodebaseSources — build 산출물 4종 제외 + `.ts`/`.tsx` 만", () => {
    expect(collectCodebaseSources(root).map((f) => f.relPath)).toEqual([
      "codebase/frontend/src/keep.ts",
      "codebase/frontend/src/keep.tsx",
    ]);
  });

  it("collectMdxFiles — `_` 접두는 디렉터리에만 걸린다 (파일은 수집된다)", () => {
    // **이 비대칭이 요점이다.** 같은 폴더의 `plan-scan.ts` 는 같은 접두를 파일명에
    // 적용한다(인덱스 제외). 두 규칙이 서로 다른 대상에 걸린다는 사실을 여기서 고정한다 —
    // 종전에는 두 DFS 가 각자 손으로 짜여 있어 어디에도 드러나지 않았다.
    expect(
      collectMdxFiles(root, "guide").map((p) => path.relative(root, p)),
    ).toEqual([path.join("guide", "_partial.mdx"), path.join("guide", "page.mdx")]);
  });
});
