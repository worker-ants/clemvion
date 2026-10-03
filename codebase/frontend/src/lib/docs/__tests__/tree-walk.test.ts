import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { walkTree } from "./tree-walk";
import { collectCodebaseSources } from "./spec-links";
import { collectMdxFiles } from "./impl-anchor-parse";
import { mirrorKeyPaths } from "./spec-keys";

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

    // mirrorKeyPaths — 키 이름(`CLE-…`) 파일만 고른다. 미러 안내 `README.md` · 키가 아닌 이름 ·
    // 소문자 키 · `.md` 가 아닌 파일은 빠진다. 폴더 깊이는 보지 않는다.
    write(path.join(root, "spec/CLE-X.md"));
    write(path.join(root, "spec/CLE-ACCT/CLE-ACCT.md"));
    write(path.join(root, "spec/CLE-ACCT/CLE-ACCT-SESSION.md"));
    write(path.join(root, "spec/README.md"));
    write(path.join(root, "spec/notes/other.md"));
    write(path.join(root, "spec/CLE-lower.md"));
    write(path.join(root, "spec/CLE-X.txt"));

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

  // 옛 트리 수집기 둘(`collectSpecMarkdown` · `collectApplicableSpecs`)은 전환 단계 5(NERV Task
  // `CLE-T-7M4C4X`)에서 옛 트리와 함께 지웠다. `spec/` 을 훑는 수집기는 미러 키 수집기 하나다.
  it("mirrorKeyPaths — 키 이름 파일만 고른다 (README · 키가 아닌 이름 · 소문자 · 비 .md 제외)", () => {
    expect([...mirrorKeyPaths(path.join(root, "spec")).keys()].sort()).toEqual([
      "CLE-ACCT",
      "CLE-ACCT-SESSION",
      "CLE-X",
    ]);
  });

  it("collectCodebaseSources — build 산출물 4종 제외 + `.ts`/`.tsx` 만", () => {
    expect(collectCodebaseSources(root).map((f) => f.relPath)).toEqual([
      "codebase/frontend/src/keep.ts",
      "codebase/frontend/src/keep.tsx",
    ]);
  });

  it("collectMdxFiles — `_` 접두는 디렉터리에만 걸린다 (파일은 수집된다)", () => {
    // **이 비대칭이 요점이다** — 근거는 `tree-walk.ts` 헤더(SoT). 여기서는 그 선택을
    // 실행 가능한 형태로 고정만 한다.
    expect(
      collectMdxFiles(root, "guide").map((p) => path.relative(root, p)),
    ).toEqual([path.join("guide", "_partial.mdx"), path.join("guide", "page.mdx")]);
  });
});
