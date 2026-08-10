import { describe, it, expect } from "vitest";
import path from "node:path";
import { MAX_ROOT_SEARCH_DEPTH, listAtPath, repoRoot } from "./_shared";

// `_shared.ts` 는 두 repo-guard 의 공용 기반이다. `ROOT` 가 조용히 틀리면 두 가드가 함께
// 엉뚱한 트리를 읽으므로 파급이 가장 크다.
//
// 왜 이 파일이 따로 있나 — 소유 모듈에 회귀 테스트가 없고 한 소비자 스위트
// (`internal-package-registration.test.ts`)에만 간접 커버리지가 있는 상태였다. 소비자가
// 자기 사정으로 그 단언을 줄이면 공유 프리미티브가 조용히 무방비가 된다.
//
// `repoRoot` 의 fail-closed throw 는 종전에 **테스트가 불가능**했다: 시작 디렉터리가
// `__dirname` 하드코딩이라 marker 없는 트리를 만들 방법이 없었다. 같은 PR 이
// `discoverWorkspaceDirs` 에는 `readLines` 주입을 넣고 여기엔 안 넣은 비대칭을 리뷰가
// 지적했고, 그 지적이 맞아 주입점을 대칭으로 열었다.
//
// **커버리지 경계 (의도)**: `_shared.ts` 의 공개 심볼은 여기서 자기 완결적으로 방어한다.
// 처음엔 `repoRoot` 만 다뤘는데 그건 이 파일이 세운 원칙을 자기가 절반만 지킨 것이라
// (리뷰 지적) `listAtPath` 합성 회귀도 소비자 스위트에서 **옮겨 왔다**. `blockRange`·
// `findKeyLine` 은 두 가드 어느 쪽의 공개 표면도 아닌 내부 헬퍼라 `listAtPath` /
// `blockScalarAtPath` 를 통해 간접 검증한다 — 이건 실수가 아니라 판단이다. 그 둘이
// 언젠가 직접 소비되면 그때 여기로 올린다.

describe("repoRoot — marker 탐색", () => {
  const marker = (dir: string) => path.join(dir, "pnpm-workspace.yaml");

  it("시작 디렉터리에 marker 가 있으면 그 자리를 돌려준다", () => {
    const start = path.resolve("/a/b/c");
    expect(repoRoot(start, (p) => p === marker(start))).toBe(start);
  });

  it("위로 올라가며 찾는다 — 가장 가까운 marker 에서 멈춘다", () => {
    const root = path.resolve("/a");
    const start = path.resolve("/a/b/c/d");
    // `/a` 와 `/a/b` 둘 다 marker 를 가지면 **가까운 쪽**이 이겨야 한다.
    const near = path.resolve("/a/b");
    const exists = (p: string) => p === marker(root) || p === marker(near);
    expect(repoRoot(start, exists)).toBe(near);
  });

  it("못 찾으면 조용히 빈 값을 내지 않고 throw 한다 (fail-closed)", () => {
    // 이 분기가 이 파일이 생긴 이유다. 빈 문자열이나 `/` 를 돌려주면 두 가드가 엉뚱한
    // 트리를 훑고도 "발견 0" 이 아니라 "그런 파일 없음" 으로 조용히 통과할 수 있다.
    const start = path.resolve("/a/b/c");
    expect(() => repoRoot(start, () => false)).toThrow(/pnpm-workspace.yaml 를 찾지 못함/);
    // 어디서 시작했는지가 메시지에 있어야 진단이 된다.
    expect(() => repoRoot(start, () => false)).toThrow(start);
  });

  it("파일시스템 루트에 닿으면 상한을 다 쓰기 전에 멈춘다", () => {
    // `path.dirname("/") === "/"` 라 상한만으로는 무한 루프를 막지 못한다 — 부모가
    // 자기 자신이면 끊는 분기가 따로 있어야 한다. 그게 없으면 이 케이스가 12회를
    // 헛돌고, 얕은 트리에서 상한을 키우면 그대로 비용이 된다.
    let calls = 0;
    const start = path.resolve("/a");
    expect(() =>
      repoRoot(start, () => {
        calls += 1;
        return false;
      }),
    ).toThrow();
    // `/a` → `/` 두 번만 본다. 상한(12)까지 가면 조기 종료 분기가 죽은 것이다.
    expect(calls).toBeLessThan(MAX_ROOT_SEARCH_DEPTH);
  });

  it("상한을 넘겨 탐색하지 않는다", () => {
    // marker 가 아주 위에만 있는 깊은 트리. 상한이 곧 계약이므로 넘어서 찾으면 안 된다.
    const deep = path.resolve("/" + Array.from({ length: 30 }, (_, i) => `d${i}`).join("/"));
    let calls = 0;
    expect(() =>
      repoRoot(deep, () => {
        calls += 1;
        return false;
      }),
    ).toThrow();
    expect(calls).toBe(MAX_ROOT_SEARCH_DEPTH);
  });

  it("기본 인자로 부르면 이 저장소의 실제 루트를 찾는다", () => {
    // 주입점을 열면서 기본값이 틀어지면 두 가드가 전부 죽는다 — 합성 테스트만 두면
    // 그 회귀를 못 잡는다(호출부는 전부 기본 인자로 쓴다).
    const root = repoRoot();
    expect(path.isAbsolute(root)).toBe(true);
    expect(root.length).toBeGreaterThan(1);
  });
});

describe("listAtPath — YAML 서브셋 추출", () => {
  // 이 블록은 `internal-package-registration.test.ts` 에서 **옮겨 왔다**(복제 아님).
  // `listAtPath` 는 이제 `_shared.ts` 소유인데 테스트만 소비자 파일에 남아 있었다 —
  // 그러면 그 파일의 재export 를 "안 쓰는데 왜 있나" 로 정리하는 순간 커버리지가 함께
  // 사라진다. 이 PR 이 `repoRoot` 에서 막으려던 것과 같은 실패 형태라 대칭을 맞춘다.
  // 소비자 쪽에는 **그 가드의 소비 방식**(`packageDirsInPaths` 로 거르기)만 남겼다.

  const yml = [
    `on:`,
    `  pull_request:`,
    `    paths:`,
    `      - 'codebase/packages/a/**'`,
    `      - 'codebase/packages/b/**'`,
    `      - 'pnpm-lock.yaml'`,
    `  push:`,
    `    paths:`,
    `      - 'codebase/packages/a/**'`,
  ]
    .join("\n")
    .split("\n");

  it("중첩 키 경로의 리스트를 추출한다", () => {
    expect(listAtPath(yml, ["on", "pull_request", "paths"])).toEqual([
      "codebase/packages/a/**",
      "codebase/packages/b/**",
      "pnpm-lock.yaml",
    ]);
  });

  it("형제 키(push)와 혼동하지 않는다", () => {
    expect(listAtPath(yml, ["on", "push", "paths"])).toEqual(["codebase/packages/a/**"]);
  });

  it("없는 경로는 null (→ 소비자의 vacuity 단언이 잡는다)", () => {
    expect(listAtPath(yml, ["on", "schedule", "paths"])).toBeNull();
  });

  it("인라인 주석을 항목에서 떼어낸다", () => {
    // 이 저장소의 실제 목록이 항목마다 "왜 등재했는가" 를 인라인 주석으로 단다.
    // 안 떼면 그 주석이 값의 일부가 되어 대조가 통째로 어긋난다 — 그런데 이 축만
    // 합성 커버리지가 비어 있어서 제거를 지워도 스위트가 초록이었다(뮤테이션 실측).
    const withComments = [
      `paths:`,
      `  - 'codebase/packages/a/**'   # backend 공유`,
      `  - codebase/packages/b/**  # 따옴표 없이도`,
    ];
    expect(listAtPath(withComments, ["paths"])).toEqual([
      "codebase/packages/a/**",
      "codebase/packages/b/**",
    ]);
  });
});
