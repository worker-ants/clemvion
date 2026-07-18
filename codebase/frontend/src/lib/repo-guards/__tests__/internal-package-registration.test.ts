import { describe, it, expect } from "vitest";
import fs from "node:fs";
import {
  TEST_STAGES,
  PACKAGES_CHECKS,
  collectPackages,
  discoverPackages,
  workflowDepsOf,
  backendWorkflowDeps,
  internalPackages,
  fnBody,
  explicitFilterCalls,
  listAtPath,
  packageDirsInPaths,
  missingFromStage,
  expectedBackendSharedDirs,
  staleEntries,
} from "./internal-package-registration-guard";

// Guard: 신규 내부 공유 패키지(`codebase/packages/*`) 추가 시 손으로 갱신해야 하는
// 등록 목록 4곳이 실제 패키지 집합과 어긋나면 red.
//
//   1. `.claude/test-stages.sh` 의 `INTERNAL_PACKAGES` (+ 특수 스텝)
//   2. `.github/workflows/packages-checks.yml` `on.pull_request.paths`
//   3. 같은 파일 `on.push.paths`
//   4. 같은 파일 `strategy.matrix.pkg`
//
// 배경: PR #968(`@workflow/ai-end-reason` 신설)에서 1·3 이 누락된 채 진행됐다.
// 특히 1 이 빠지면 로컬 `run-test.sh` 의 lint/unit/build 3단계에서 그 패키지가
// **한 번도 실행되지 않는데 wrapper 는 status=PASS 를 반환**한다 — 조용한 무검증.
// #968 은 그 PR 의 `/ai-review` sub-agent 9종 중 아무도 못 봤고(사람 리뷰 아님) 작성자의
// 수동 grep 으로 뒤늦게 잡혔다.
//
// 왜 여기(frontend vitest)인가 — 이 가드 자신이 반드시 돌아야 하기 때문이다:
//   - GitHub Actions 는 repo 레벨에서 꺼져 있다(`actions/permissions` → enabled:false).
//     `packages-checks.yml`·`harness-checks.yml` 은 총 런 수 0 이다. CI job 으로
//     만들면 "가드가 안 도는" 자기모순이 된다.
//   - `.claude/tests/**`(python unittest)는 `harness-checks.yml` 로만 실행돼 역시 inert 다.
//     로컬 러너가 없다.
//   - 실제로 도는 유일한 게이트는 `.claude/tools/run-test.sh` → `cmd_unit` →
//     `pnpm --filter frontend test` 다. vitest 는 `src/**/*.test.ts` 를 **glob 으로
//     자동 발견**하므로 이 가드에는 호출부(=손으로 지울 수 있는 배선)가 없다.
//     `scripts/*.py` 로 만들면 호출부가 또 하나의 손 유지 목록이 된다 — 고치려는 버그 그 자체.
//
// 파서·비교 순수 로직과 그 근거(모집단 차이·js-yaml 미사용·tsc 제외)는 형제 모듈
// `internal-package-registration-guard.ts` 로 분리돼 있다. 본 파일은 그 로직에 대한
// "실측 대조"(현재 저장소 상태)와 "합성 fixture 회귀"만 담당한다. tsconfig 가 `*.test.ts`·
// `__tests__/**` 를 둘 다 exclude 하므로 tsc/next build 는 이 파일을 보지 않고 vitest 는 타입을
// strip 한다 → 전부 런타임 단언.

const STAGES = [
  { fn: "cmd_lint", script: "lint" },
  { fn: "cmd_unit", script: "test" },
  { fn: "cmd_build", script: "build" },
] as const;

describe("내부 공유 패키지 등록 목록 drift 가드", () => {
  const packages = discoverPackages();
  const sh = fs.readFileSync(TEST_STAGES, "utf8");
  const yml = fs.readFileSync(PACKAGES_CHECKS, "utf8").split("\n");
  const internal = internalPackages(sh);
  const backendShared = backendWorkflowDeps();

  // 파싱이 조용히 빈 집합을 반환하면 아래 대조가 전부 vacuous PASS 가 된다.
  // 이 저장소에서 반복된 실패형(#960·#962·#968)이라 먼저 못 박는다.
  describe("vacuity 방지 — 파싱이 실제로 뭔가를 읽었는가", () => {
    it("codebase/packages/* 를 발견한다", () => {
      expect(packages.length).toBeGreaterThan(0);
    });

    it("INTERNAL_PACKAGES 를 파싱한다", () => {
      expect(internal.length).toBeGreaterThan(0);
    });

    it("backend 의 @workflow 의존을 파싱한다", () => {
      expect(backendShared.length).toBeGreaterThan(0);
    });

    it("cmd_lint / cmd_unit / cmd_build 본문을 모두 찾는다", () => {
      for (const { fn } of STAGES) {
        // 파싱 실패·휴리스틱 무효화는 fnBody 가 throw 한다 (조용한 빈 본문 금지).
        expect(() => fnBody(sh, fn), `${fn} 본문 파싱 실패`).not.toThrow();
        expect(fnBody(sh, fn).length, `${fn} 본문이 비어 있음`).toBeGreaterThan(0);
      }
    });

    it("packages-checks.yml 의 3개 목록을 모두 찾는다", () => {
      for (const keys of [
        ["on", "pull_request", "paths"],
        ["on", "push", "paths"],
        ["jobs", "packages", "strategy", "matrix", "pkg"],
      ]) {
        const list = listAtPath(yml, keys);
        expect(list, `${keys.join(".")} 추출 실패`).not.toBeNull();
        expect(list!.length, `${keys.join(".")} 가 비어 있음`).toBeGreaterThan(0);
      }
    });
  });

  // ── 1. test-stages.sh — 유일하게 실효적인 게이트 ──
  describe(".claude/test-stages.sh", () => {
    it.each(STAGES)(
      "$fn 이 모든 내부 패키지를 실행한다 (INTERNAL_PACKAGES 또는 전용 스텝)",
      ({ fn, script }) => {
        const body = fnBody(sh, fn);
        const missing = missingFromStage(
          body,
          script,
          internal,
          packages.map((p) => p.name),
        );

        expect(
          missing,
          `${fn} 에서 실행되지 않는 패키지: ${missing.join(", ")}\n` +
            `→ .claude/test-stages.sh 의 INTERNAL_PACKAGES 에 추가하거나 ${fn} 에 전용 스텝을 넣어라.\n` +
            `   누락 시 run-test.sh 는 이 패키지를 건너뛴 채 status=PASS 를 반환한다 (#968).`,
        ).toEqual([]);
      },
    );

    it("INTERNAL_PACKAGES 에 실재하지 않는 패키지가 없다", () => {
      const stale = staleEntries(
        internal,
        packages.map((p) => p.name),
      );
      expect(
        stale,
        `codebase/packages/ 에 없는 항목: ${stale.join(", ")} — 패키지 삭제·개명 후 잔재.`,
      ).toEqual([]);
    });
  });

  // ── 2~4. packages-checks.yml — Actions 가 꺼져 있어 현재 inert. 재활성화 대비 + 규약. ──
  describe(".github/workflows/packages-checks.yml (현재 inert — Actions off)", () => {
    const expectedDirs = () => expectedBackendSharedDirs(packages, backendShared);

    it.each([
      { label: "on.pull_request.paths", keys: ["on", "pull_request", "paths"] },
      { label: "on.push.paths", keys: ["on", "push", "paths"] },
    ])("$label 가 backend-공유 패키지 집합과 일치한다", ({ label, keys }) => {
      const actual = packageDirsInPaths(listAtPath(yml, keys)!);
      expect(
        actual,
        `${label} 가 backend 의 @workflow 의존과 불일치.\n` +
          `  기대(=codebase/backend/package.json 파생): ${expectedDirs().join(", ")}\n` +
          `  실제: ${actual.join(", ")}`,
      ).toEqual(expectedDirs());
    });

    it("strategy.matrix.pkg 가 backend-공유 패키지 집합과 일치한다", () => {
      const actual = [...listAtPath(yml, ["jobs", "packages", "strategy", "matrix", "pkg"])!].sort();
      expect(
        actual,
        `matrix.pkg 가 backend 의 @workflow 의존과 불일치.\n` +
          `  기대: ${backendShared.join(", ")}\n  실제: ${actual.join(", ")}`,
      ).toEqual(backendShared);
    });
  });
});

// 위 describe 는 저장소 **현재(=이미 정렬된) 상태**만 읽으므로, 파서·비교 로직 자체에 회귀가
// 생겨도(예: `missing` 계산 반전, Set 멤버십 오류, listAtPath 형제 키 혼동) green 이 유지될 수 있다.
// 아래는 통제된 합성 입력으로 각 순수 함수의 true-positive/negative 를 박제한다 — 리뷰 시점에
// 수동 mutation 으로만 확인했던 방어력(#968 클래스)을 스위트 안으로 들여 회귀를 고정한다.
describe("파서·비교 로직 회귀 가드 (합성 fixture)", () => {
  describe("internalPackages", () => {
    it("따옴표 항목을 순서대로 파싱한다", () => {
      expect(internalPackages(`INTERNAL_PACKAGES=(\n  "@workflow/a"\n  "@workflow/b"\n)\n`)).toEqual([
        "@workflow/a",
        "@workflow/b",
      ]);
    });
    it("배열 선언이 없으면 [] (→ vacuity 단언이 잡는다)", () => {
      expect(internalPackages(`INTERNAL_PKGS=(\n  "@workflow/a"\n)\n`)).toEqual([]);
    });
  });

  describe("fnBody", () => {
    const sh = [
      `cmd_lint() {`,
      `  _ensure_deps && \\`,
      `  pnpm --filter backend lint && \\`,
      `  _run_internal lint`,
      `}`,
      ``,
      `_helper() {`,
      `  :`,
      `}`,
    ].join("\n");

    it("여는 줄과 첫 라인 시작 '}' 사이 본문만 반환한다", () => {
      const body = fnBody(sh, "cmd_lint");
      expect(body).toContain("_run_internal lint");
      expect(body).not.toContain("_helper"); // 첫 '}' 에서 멈춤 — 다음 함수로 새지 않는다
    });
    it("함수 선언이 없으면 throw (조용한 빈 본문 금지)", () => {
      expect(() => fnBody(sh, "cmd_missing")).toThrow(/선언을 찾지 못함/);
    });
    it("본문 내 라인 시작 블록 '{' (조기 열림) → throw", () => {
      const nested = `cmd_x() {\n  {\n    :\n  }\n  pnpm --filter @workflow/a lint\n}\n`;
      expect(() => fnBody(nested, "cmd_x")).toThrow(/라인 시작 블록/);
    });
    it("본문 내 heredoc (조기 닫힘) → throw", () => {
      const hd = `cmd_x() {\n  cat <<EOF\n}\nEOF\n  pnpm --filter @workflow/a lint\n}\n`;
      expect(() => fnBody(hd, "cmd_x")).toThrow(/heredoc/);
    });
    it("tab-strip heredoc '<<-EOF' 변형도 throw", () => {
      const hd = `cmd_x() {\n  cat <<-EOF\n  body\n  EOF\n  _run_internal lint\n}\n`;
      expect(() => fnBody(hd, "cmd_x")).toThrow(/heredoc/);
    });
    it("here-string '<<<' 은 heredoc 으로 오탐하지 않는다", () => {
      const hs = `cmd_x() {\n  grep foo <<<"$bar"\n  _run_internal lint\n}\n`;
      expect(() => fnBody(hs, "cmd_x")).not.toThrow();
    });
  });

  describe("collectPackages / workflowDepsOf (fs 코어 분리)", () => {
    it("collectPackages: name 해석기가 null 인 dir 은 skip 한다 (package.json 부재)", () => {
      const got = collectPackages(["b", "a", "no-manifest"], (dir) =>
        dir === "no-manifest" ? null : `@workflow/${dir}`,
      );
      expect(got).toEqual([
        { dir: "a", name: "@workflow/a" },
        { dir: "b", name: "@workflow/b" },
      ]);
    });
    it("workflowDepsOf: dependencies + devDependencies 를 병합하고 @workflow/* 만 남긴다", () => {
      expect(
        workflowDepsOf({
          dependencies: { "@workflow/b": "*", react: "*" },
          devDependencies: { "@workflow/a": "*", vitest: "*" },
        }),
      ).toEqual(["@workflow/a", "@workflow/b"]);
    });
    it("workflowDepsOf: devDependencies 전용 @workflow 패키지도 누락 없이 포함", () => {
      expect(workflowDepsOf({ devDependencies: { "@workflow/only-dev": "*" } })).toEqual([
        "@workflow/only-dev",
      ]);
    });
    it("workflowDepsOf: @workflow 의존이 없으면 []", () => {
      expect(workflowDepsOf({ dependencies: { react: "*" } })).toEqual([]);
    });
  });

  describe("explicitFilterCalls", () => {
    it("한 줄 `pnpm --filter <pkg> <script>` 를 캡처한다", () => {
      const body = `pnpm --filter @workflow/a lint && \\\n  pnpm --filter backend test`;
      expect(explicitFilterCalls(body)).toEqual([
        { name: "@workflow/a", script: "lint" },
        { name: "backend", script: "test" },
      ]);
    });
    it('변수형 --filter "$pkg" 는 무시한다', () => {
      expect(explicitFilterCalls(`pnpm --filter "$pkg" build`)).toEqual([]);
    });
    // 아래 3건 = 리뷰 WARNING: 주석/로그 문자열 안의 `pnpm --filter` 를 실제 커버로 오인해
    // #968급 false-pass 를 파서가 재현하던 사각지대. "명령 위치" 판정으로 차단한 것을 고정한다.
    it("라인 주석(#) 안의 pnpm --filter 는 실행으로 치지 않는다", () => {
      expect(explicitFilterCalls(`  # pnpm --filter @workflow/ghost lint`)).toEqual([]);
    });
    it("행 끝 주석은 제거하되 앞의 실제 호출은 인식한다", () => {
      expect(explicitFilterCalls(`  pnpm --filter backend lint  # 설명 주석`)).toEqual([
        { name: "backend", script: "lint" },
      ]);
    });
    it("echo 로그 문자열 안의 pnpm --filter 는 실행으로 치지 않는다", () => {
      expect(explicitFilterCalls(`  echo "run: pnpm --filter @workflow/ghost lint"`)).toEqual([]);
    });
    it("따옴표 안에 명령 구분자(;)가 있어도 문자열 안 pnpm 은 실행으로 치지 않는다", () => {
      // 따옴표 span 을 먼저 제거하지 않으면 문자열 내부 `;` 로 분절돼 `pnpm …` 로 시작하는 조각이
      // 생겨 오인식된다(리뷰 WARNING 실측). blind 따옴표 제거로 차단.
      expect(explicitFilterCalls(`  echo "done; pnpm --filter @workflow/ghost lint"`)).toEqual([]);
      expect(explicitFilterCalls(`  echo 'done | pnpm --filter @workflow/ghost lint'`)).toEqual([]);
    });
  });

  describe("expectedBackendSharedDirs / staleEntries (대조 코어)", () => {
    it("expectedBackendSharedDirs: backend-공유만 dir 로, 정렬해 남긴다", () => {
      const pkgs = [
        { dir: "z-dir", name: "@workflow/z" },
        { dir: "a-dir", name: "@workflow/a" },
        { dir: "unshared", name: "@workflow/nope" },
      ];
      expect(expectedBackendSharedDirs(pkgs, ["@workflow/a", "@workflow/z"])).toEqual([
        "a-dir",
        "z-dir",
      ]);
    });
    it("expectedBackendSharedDirs: dir≠name 이어도 dir 를 반환한다 (name 혼동 회귀 고정)", () => {
      expect(
        expectedBackendSharedDirs(
          [{ dir: "web-chat-sdk", name: "@workflow/web-chat" }],
          ["@workflow/web-chat"],
        ),
      ).toEqual(["web-chat-sdk"]);
    });
    it("staleEntries: known 에 없는 항목만 남긴다", () => {
      expect(staleEntries(["@workflow/a", "@workflow/ghost"], ["@workflow/a"])).toEqual([
        "@workflow/ghost",
      ]);
    });
    it("staleEntries: 전부 known 이면 []", () => {
      expect(staleEntries(["@workflow/a"], ["@workflow/a", "@workflow/b"])).toEqual([]);
    });
  });

  describe("listAtPath + packageDirsInPaths", () => {
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
    it("없는 경로는 null (→ vacuity 단언이 잡는다)", () => {
      expect(listAtPath(yml, ["on", "schedule", "paths"])).toBeNull();
    });
    it("packageDirsInPaths 는 packages dir 만 남긴다 (lockfile 제외)", () => {
      const paths = listAtPath(yml, ["on", "pull_request", "paths"])!;
      expect(packageDirsInPaths(paths)).toEqual(["a", "b"]);
    });
    it("5단계 중첩 경로(jobs.packages.strategy.matrix.pkg)도 추출한다 (실 yml 형태)", () => {
      const deep = [
        `jobs:`,
        `  packages:`,
        `    strategy:`,
        `      matrix:`,
        `        pkg:`,
        `          - '@workflow/a'`,
        `          - '@workflow/b'`,
      ]
        .join("\n")
        .split("\n");
      expect(listAtPath(deep, ["jobs", "packages", "strategy", "matrix", "pkg"])).toEqual([
        "@workflow/a",
        "@workflow/b",
      ]);
    });
  });

  describe("missingFromStage — #968 클래스(조용한 무검증)를 박제", () => {
    // 최상위 실측 파싱 결과 `internal` 과 구분되도록 fixture 전용 이름을 쓴다.
    const fixtureInternal = ["@workflow/a", "@workflow/b"];
    const bodyInternal = `_ensure_deps && \\\n  _run_internal lint`;

    it("INTERNAL 소속 + _run_internal 커버 → 누락 없음", () => {
      expect(
        missingFromStage(bodyInternal, "lint", fixtureInternal, ["@workflow/a", "@workflow/b"]),
      ).toEqual([]);
    });
    it("신규 패키지가 INTERNAL 에도 명시 호출에도 없으면 → 누락 (실제 #968 시나리오)", () => {
      const pkgs = ["@workflow/a", "@workflow/b", "@workflow/new"];
      expect(missingFromStage(bodyInternal, "lint", fixtureInternal, pkgs)).toEqual([
        "@workflow/new",
      ]);
    });
    it("명시적 `pnpm --filter` 로 커버되면 → 누락 아님 (전용 스텝 경로)", () => {
      const body = `${bodyInternal} && \\\n  pnpm --filter @workflow/special lint`;
      expect(
        missingFromStage(body, "lint", fixtureInternal, ["@workflow/a", "@workflow/special"]),
      ).toEqual([]);
    });
    it("그 스테이지에 _run_internal 이 없으면 → INTERNAL 전원 누락", () => {
      const body = `_ensure_deps && \\\n  pnpm --filter backend lint`;
      expect(missingFromStage(body, "lint", fixtureInternal, fixtureInternal)).toEqual([
        "@workflow/a",
        "@workflow/b",
      ]);
    });
    it("다른 스테이지(build)용 명시 호출은 이 스테이지(lint)를 커버하지 않는다", () => {
      expect(
        missingFromStage(`pnpm --filter @workflow/x build`, "lint", [], ["@workflow/x"]),
      ).toEqual(["@workflow/x"]);
    });
    it("주석·로그 텍스트 안의 pnpm --filter 로는 커버되지 않는다 (#968급 false-pass 차단)", () => {
      // 신규 패키지가 주석·echo 로만 등장하면 여전히 '누락' 으로 판정돼야 한다.
      const body =
        `_run_internal lint\n` +
        `  # pnpm --filter @workflow/new lint\n` +
        `  echo "pnpm --filter @workflow/new lint"`;
      expect(missingFromStage(body, "lint", ["@workflow/a"], ["@workflow/new"])).toEqual([
        "@workflow/new",
      ]);
    });
  });
});
