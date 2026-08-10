import { describe, it, expect } from "vitest";
import {
  REQUIRED_COMPILER_API,
  missingCompilerApi,
  parseMajor,
  typescriptRangeOf,
  expandWorkspaceGlobs,
  discoverWorkspaceDirs,
  typescriptDecls,
  readManifestAt,
  majorSpread,
  loadTypescriptFrom,
  validateWorkspacePatterns,
} from "./typescript-toolchain-guard";

// Guard: 워크스페이스가 쓰는 typescript 가 **JS compiler API 계약**을 지키는지, 그리고 전
// 워크스페이스가 같은 major 로 묶여 있는지.
//
// 배경 — PR #1047 (`484ee9509`, dependabot): typescript `5.9.3` → **`7.0.2`**. TS7 은 Go
// 네이티브 재작성판이고 JS compiler API 를 `typescript/unstable/*` 로 옮겼다. 그 결과
// `require('typescript')` 가 `{version, versionMajorMinor}` 스텁만 돌려준다:
//
//   backend   @nestjs/cli 의 TypeScriptBinaryLoader 가 `require.resolve('typescript',
//             {paths:[process.cwd(), …]})` 로 **cwd 의** typescript 를 집는다 → `nest build` 가
//             "tsBinary.getParsedCommandLineOfConfigFile is not a function" 으로 죽었다.
//             (@nestjs/cli 자신은 deps 로 typescript@5 를 갖고 있지만 cwd 가 먼저라 무효)
//   frontend  packages/sdk 의 `prepare` tsc 가 @types/node 자동 포함에 실패해
//             `pnpm install` **자체가** 중단됐다.
//
// Jenkins Clemvion/337 (main) 의 backend·frontend 이미지가 둘 다 실패했고 migrate 만 살았다.
//
// 왜 버전 숫자가 아니라 능력을 보나 — "typescript major 는 5 여야 한다" 는 상한은 언젠가 반드시
// 거짓이 되고, 그때 이 가드는 정당한 상향을 막는 마찰이 된다. 실제로 깨진 것은 **계약**이므로
// 계약을 검사한다: TS8 이 API 를 되살리면 통과하고, 어떤 버전이든 API 가 없으면 실패한다.
//
// 왜 여기(frontend vitest)인가 — 형제 가드 `internal-package-registration.test.ts` 헤더와 같은
// 근거다: GitHub Actions 가 repo 레벨에서 꺼져 있어(`packages-checks.yml`·`harness-checks.yml`
// 런 수 0) CI job 은 inert 다. 실제로 도는 유일한 게이트는 `.claude/tools/run-test.sh` →
// `cmd_unit` → `pnpm --filter frontend test` 이고, vitest 는 `*.test.ts` 를 glob 으로 자동
// 발견하므로 이 가드에는 지워질 수 있는 호출부가 없다. #1047 은 정확히 "아무 게이트도 안 도는
// 경로로 머지된" 사고다.
//
// 파서·판정 순수 로직은 형제 모듈 `typescript-toolchain-guard.ts`. 본 파일은 실측 대조와 합성
// fixture 회귀만 담당한다. tsconfig 가 `__tests__/**` 를 exclude 하므로 전부 런타임 단언이다.

describe("typescript 툴체인 계약 가드 (실측)", () => {
  const dirs = discoverWorkspaceDirs();
  const decls = typescriptDecls(dirs, readManifestAt);

  it("워크스페이스를 실제로 발견한다", () => {
    // vacuity 방지 — 발견이 0/소수로 무너지면 아래 단언이 전부 공허해진다.
    // pnpm-workspace.yaml 의 고정 3개(backend·frontend·channel-web-chat) + packages/* 확장.
    expect(dirs.length).toBeGreaterThanOrEqual(4);
    expect(dirs).toContain("codebase/backend");
    expect(dirs).toContain("codebase/frontend");
    expect(dirs).toContain("codebase/channel-web-chat");
    expect(dirs.filter((d) => d.startsWith("codebase/packages/")).length).toBeGreaterThan(0);
  });

  it("typescript 선언을 실제로 수집한다", () => {
    // vacuity 방지 — 선언 수집이 0 이면 lockstep·능력 검사가 통째로 무의미해진다.
    expect(decls.length).toBeGreaterThanOrEqual(4);
    expect(decls.map((d) => d.dir)).toContain("codebase/backend");
    expect(decls.map((d) => d.dir)).toContain("codebase/frontend");
  });

  it("모든 typescript range 의 major 를 판정할 수 있다", () => {
    // 파싱 실패를 조용히 넘기면 드리프트 검사가 빈 집합 위에서 통과한다 — fail-closed.
    expect(majorSpread(decls).unparsable).toEqual([]);
  });

  it("전 워크스페이스가 같은 typescript major 로 묶여 있다 (lockstep)", () => {
    // 일부만 올라가 컴파일러가 갈리는 상태를 막는다. major 값 자체는 고정하지 않는다 —
    // 정당한 상향을 막지 않기 위해서다. 상향의 안전성은 아래 능력 검사가 판정한다.
    const { majors } = majorSpread(decls);
    expect(majors).toHaveLength(1);
  });

  it("해소되는 typescript 가 JS compiler API 를 노출한다", () => {
    const loaded = decls
      .map((d) => ({ dir: d.dir, mod: loadTypescriptFrom(d.dir) }))
      .filter((x) => x.mod !== null);

    // vacuity 방지 — install 스코프에 따라 일부 워크스페이스는 미설치일 수 있으나, 이 테스트가
    // 도는 frontend 자신은 반드시 해소된다. 0건이면 "전부 미설치" 라 검사가 공허하다.
    expect(loaded.length).toBeGreaterThan(0);
    expect(loaded.map((x) => x.dir)).toContain("codebase/frontend");

    // 로드된 것이 진짜 typescript 인지 — 임의 객체를 통과시키지 않는다.
    for (const { dir, mod } of loaded) {
      expect(typeof (mod as { version?: unknown }).version, `${dir}: version 부재`).toBe("string");
    }

    const broken = loaded
      .map((x) => ({ dir: x.dir, missing: missingCompilerApi(x.mod) }))
      .filter((x) => x.missing.length > 0);
    expect(broken).toEqual([]);
  });
});

describe("missingCompilerApi (합성)", () => {
  const ok = Object.fromEntries(REQUIRED_COMPILER_API.map((k) => [k, () => {}]));

  it("계약을 지키는 모듈은 누락 0", () => {
    expect(missingCompilerApi({ ...ok, version: "5.9.3" })).toEqual([]);
  });

  it("TS7 의 실제 형태를 잡는다", () => {
    // `require('typescript')` 가 TS7 에서 반환하는 것 그대로(실측).
    expect(missingCompilerApi({ version: "7.0.2", versionMajorMinor: "7.0" })).toEqual([
      ...REQUIRED_COMPILER_API,
    ]);
  });

  it("#1047 의 그 심볼 하나만 빠져도 잡는다", () => {
    const { getParsedCommandLineOfConfigFile: _drop, ...rest } = ok;
    expect(missingCompilerApi(rest)).toEqual(["getParsedCommandLineOfConfigFile"]);
  });

  it("함수가 아닌 동명 프로퍼티를 통과시키지 않는다", () => {
    expect(missingCompilerApi({ ...ok, createProgram: true })).toEqual(["createProgram"]);
  });

  it("비-객체는 전부 누락으로 친다 (fail-closed)", () => {
    for (const bad of [null, undefined, 42, "typescript", () => {}]) {
      expect(missingCompilerApi(bad)).toEqual([...REQUIRED_COMPILER_API]);
    }
  });
});

describe("parseMajor (합성)", () => {
  it("이 저장소가 쓰는 형태를 읽는다", () => {
    expect(parseMajor("^5.7.3")).toBe(5);
    expect(parseMajor("^5")).toBe(5);
    expect(parseMajor("~7.0.2")).toBe(7);
    expect(parseMajor("5.9.3")).toBe(5);
    expect(parseMajor("5.x")).toBe(5);
    expect(parseMajor("  ^5.7.3 ")).toBe(5);
  });

  it("두 자리 major 를 자르지 않는다", () => {
    expect(parseMajor("^10.1.0")).toBe(10);
  });

  it("해석하지 않는 형태는 null (→ 호출부 fail-closed)", () => {
    for (const bad of ["workspace:*", ">=5 <6", "latest", "", "^", "npm:typescript@5"]) {
      expect(parseMajor(bad), bad).toBeNull();
    }
  });
});

describe("typescriptRangeOf (합성)", () => {
  it("devDependencies 를 우선 읽고 dependencies 도 본다", () => {
    expect(typescriptRangeOf({ devDependencies: { typescript: "^5.7.3" } })).toBe("^5.7.3");
    expect(typescriptRangeOf({ dependencies: { typescript: "^5" } })).toBe("^5");
    expect(
      typescriptRangeOf({ devDependencies: { typescript: "^5" }, dependencies: { typescript: "^7" } }),
    ).toBe("^5");
  });

  it("선언이 없으면 null", () => {
    expect(typescriptRangeOf({ devDependencies: { eslint: "^9" } })).toBeNull();
    expect(typescriptRangeOf({})).toBeNull();
  });
});

describe("expandWorkspaceGlobs (합성)", () => {
  const readDir = (d: string) => (d === "codebase/packages" ? ["sdk", "ai-end-reason"] : []);

  it("고정 경로는 그대로, 말미 '*' 는 확장한다", () => {
    expect(expandWorkspaceGlobs(["codebase/backend", "codebase/packages/*"], readDir)).toEqual([
      "codebase/backend",
      "codebase/packages/ai-end-reason",
      "codebase/packages/sdk",
    ]);
  });

  it("지원하지 않는 글롭은 조용히 빈 결과를 내지 않고 throw", () => {
    // 조용한 누락이야말로 이 가드가 막으려는 사건 — 워크스페이스가 넓어지면 깨져야 한다.
    expect(() => expandWorkspaceGlobs(["codebase/**"], readDir)).toThrow(/지원하지 않는 글롭/);
    expect(() => expandWorkspaceGlobs(["codebase/*/pkg/*"], readDir)).toThrow(/지원하지 않는 글롭/);
  });
});

describe("validateWorkspacePatterns (합성)", () => {
  // 이 fail-closed 는 종전에 `discoverWorkspaceDirs` 안에서 실제
  // `fs.readFileSync(pnpm-workspace.yaml)` 와 묶여 있었다. 저장소가 정상인 한 자연
  // 발동하지 않고 합성 입력으로 겨냥할 수도 없어서, **fail-closed 라는 성질 자체가
  // 미검증**이었다. 순수 함수로 뽑은 이유가 그것이다.
  //
  // 무엇을 지키는가: 추출 실패가 빈 목록으로 흘러가면 워크스페이스가 0개가 되고,
  // 그러면 lockstep·compiler-API 두 축이 **전부 vacuous 하게 통과**한다. 이 가드가
  // 막으려던 #1047 형태의 사고가 그때는 아무 소리 없이 지나간다.

  it("packages: 키를 못 찾으면(null) 던진다", () => {
    expect(() => validateWorkspacePatterns(null)).toThrow(/packages: 목록을 읽지 못했다/);
  });

  it("키는 찾았으나 항목이 없으면(빈 배열) 던진다", () => {
    // null 과 갈라 두는 이유: `listAtPath` 는 두 실패를 다른 값으로 낸다(키 부재 vs
    // 항목 부재). 한쪽만 막으면 나머지 한쪽으로 vacuity 가 그대로 들어온다.
    expect(() => validateWorkspacePatterns([])).toThrow(/packages: 목록을 읽지 못했다/);
  });

  it("정상 목록은 그대로 돌려준다 — 통과 경로에서 값을 바꾸지 않는다", () => {
    const patterns = ["codebase/backend", "codebase/packages/*"];
    expect(validateWorkspacePatterns(patterns)).toEqual(patterns);
  });

  it("discoverWorkspaceDirs 가 실제로 그 검증을 태운다 (호출부)", () => {
    // 헬퍼만 단언하면 호출부가 검증을 건너뛰는 변경이 조용히 통과한다 — 실제로
    // `?? []` 로 바꾼 뮤턴트가 살아남았다. 헬퍼 테스트 ≠ 호출부 테스트.
    expect(() => discoverWorkspaceDirs(() => ["# packages: 키가 없는 YAML", "other: 1"])).toThrow(
      /packages: 목록을 읽지 못했다/,
    );
    expect(() => discoverWorkspaceDirs(() => ["packages:", "  # 항목 없음"])).toThrow(
      /packages: 목록을 읽지 못했다/,
    );
  });
});

describe("typescriptDecls / majorSpread (합성)", () => {
  const manifests: Record<string, { devDependencies?: Record<string, string> }> = {
    a: { devDependencies: { typescript: "^5.7.3" } },
    b: { devDependencies: { typescript: "^5" } },
    c: { devDependencies: { eslint: "^9" } },
  };

  it("typescript 를 선언하지 않은 워크스페이스는 제외한다", () => {
    const decls = typescriptDecls(["a", "b", "c", "missing"], (d) => manifests[d] ?? null);
    expect(decls).toEqual([
      { dir: "a", range: "^5.7.3" },
      { dir: "b", range: "^5" },
    ]);
  });

  it("major 가 갈리면 집합이 2개가 된다 (lockstep 위반 검출)", () => {
    // #1047 의 부분 적용 형태 — 일부만 7 로 올라간 상태.
    const drifted = [
      { dir: "a", range: "^5.7.3" },
      { dir: "b", range: "^7.0.2" },
    ];
    expect(majorSpread(drifted).majors).toEqual([5, 7]);
  });

  it("판정 불가 range 를 majors 에 섞지 않고 따로 돌려준다", () => {
    const mixed = [
      { dir: "a", range: "^5.7.3" },
      { dir: "b", range: "workspace:*" },
    ];
    const { majors, unparsable } = majorSpread(mixed);
    expect(majors).toEqual([5]);
    expect(unparsable).toEqual([{ dir: "b", range: "workspace:*" }]);
  });
});
