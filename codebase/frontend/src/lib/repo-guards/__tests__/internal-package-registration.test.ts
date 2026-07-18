import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

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
// #968 은 리뷰어 9명이 못 봤고 작성자의 수동 grep 으로 뒤늦게 잡혔다.
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
// 대조 로직은 `scripts/check-e2e-playwright-config.py`(frontend `@workflow` 클로저 ↔
// docker-compose 볼륨 마스킹 대조)에서 빌려왔다. 그 스크립트의 담당 범위(Dockerfile
// COPY·compose 마스킹)는 여기서 중복 검사하지 않는다.
//
// 주의: tsconfig 가 `src/**/*.test.ts` 와 `src/**/__tests__/**` 를 둘 다 exclude 하므로(이 파일은
// 양쪽에 걸린다) tsc/next build 는 이 파일을 보지 않고, vitest 는 타입을 strip 한다.
// → 컴파일타임 단언은 무의미하다. 전부 런타임 단언.

// 각 목록의 **의도된 모집단이 다르다**. 단순히 `ls codebase/packages/` 전체와 비교하면 오탐이다.
//
//   - `INTERNAL_PACKAGES` = "특수 스텝이 없는" 패키지만 담는 의도(파일 헤더). 따라서
//     `@workflow/web-chat` 처럼 전용 스텝을 가진 패키지는 여기 없는 게 **정상**이다.
//     → 이 목록 자체를 비교하지 않고, "모든 패키지가 lint/test/build 3단계에 어떤
//        경로로든 커버되는가" 라는 상위 불변식을 검증한다. 등록 방식은 자유.
//   - `packages-checks.yml` = backend-공유 패키지만 대상(파일 헤더). 하드코딩 대신
//     `codebase/backend/package.json` 의 `@workflow/*` 의존에서 **파생**한다. 그래야
//     목록이 또 하나의 손 유지 사본이 되지 않는다.
//     (실측: 이 클로저는 flat 하다 — 5개 패키지 중 `@workflow/*` 를 재의존하는 것은 없다.
//      `@workflow/web-chat` → `@workflow/sdk` 만 전이 의존이고 backend 클로저 밖이다.)

function repoRoot(): string {
  // 고정 `../../..` 카운트 대신 marker 로 탐색 — 파일이 이동해도 조용히 오해소되지 않는다.
  // 상한 12 = 현재 실제 깊이(worktree 루트→이 파일 7단계)의 약 1.7배 여유. 무한 루프 방지용 상수라
  // 정확한 값이 중요치 않고, 못 찾으면 아래에서 throw 한다.
  const MAX_DEPTH = 12;
  let dir = __dirname;
  for (let i = 0; i < MAX_DEPTH; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`repoRoot: pnpm-workspace.yaml 를 찾지 못함 (from ${__dirname})`);
}

const ROOT = repoRoot();
const PACKAGES_DIR = path.join(ROOT, "codebase", "packages");
const TEST_STAGES = path.join(ROOT, ".claude", "test-stages.sh");
const PACKAGES_CHECKS = path.join(ROOT, ".github", "workflows", "packages-checks.yml");

type PackageManifest = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

/**
 * 디렉터리명 목록 + name 해석기 → `{dir,name}[]` (dir 정렬).
 *
 * fs 접근과 분리한 순수 코어(리뷰 WARNING). `resolveName` 이 null 이면(=package.json 부재)
 * 그 dir 을 skip 한다. 이 "부재 skip" 분기는 현재 저장소에선 안 도므로(전 패키지가 manifest
 * 보유) 합성 fixture 로만 고정된다.
 */
function collectPackages(
  dirNames: string[],
  resolveName: (dir: string) => string | null,
): { dir: string; name: string }[] {
  return dirNames
    .map((dir) => {
      const name = resolveName(dir);
      return name === null ? null : { dir, name };
    })
    .filter((p): p is { dir: string; name: string } => p !== null)
    .sort((a, b) => a.dir.localeCompare(b.dir));
}

/** `codebase/packages/<dir>/package.json` 실측 → dir ↔ name 양방향. */
function discoverPackages(): { dir: string; name: string }[] {
  const dirNames = fs
    .readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  return collectPackages(dirNames, (dir) => {
    const manifest = path.join(PACKAGES_DIR, dir, "package.json");
    if (!fs.existsSync(manifest)) return null;
    return (JSON.parse(fs.readFileSync(manifest, "utf8")) as PackageManifest).name ?? null;
  });
}

/**
 * 매니페스트의 `dependencies` + `devDependencies` 에서 `@workflow/*` 만 정렬.
 *
 * fs 접근과 분리한 순수 코어(리뷰 WARNING). devDependencies 병합 분기는 현재 backend 가
 * `@workflow/*` 를 전부 `dependencies` 에만 두어 실측으론 안 도므로 합성 fixture 로 고정한다.
 */
function workflowDepsOf(pkg: PackageManifest): string[] {
  return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
    .filter((d) => d.startsWith("@workflow/"))
    .sort();
}

/** backend 가 실제로 의존하는 `@workflow/*` — packages-checks.yml 의 모집단 SoT. */
function backendWorkflowDeps(): string[] {
  return workflowDepsOf(
    JSON.parse(
      fs.readFileSync(path.join(ROOT, "codebase", "backend", "package.json"), "utf8"),
    ) as PackageManifest,
  );
}

// ─── test-stages.sh 파싱 ────────────────────────────────────────────────────

function internalPackages(sh: string): string[] {
  const m = /^INTERNAL_PACKAGES=\(([\s\S]*?)^\)/m.exec(sh);
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

/**
 * `cmd_<name>() { ... }` 본문. 여는 줄과 **라인 시작 `}`** 사이.
 *
 * 이 휴리스틱은 본문에 라인 시작 블록 `{` 가 없을 때만 옳다. bash 의 if/for 는 브레이스가
 * 아니라 then/fi·do/done 을 쓰므로 현재 cmd_* 3개는 안전하다. 다만 중첩 그룹(`{ ...; }`)이나
 * 지역 함수 정의가 들어오면 본문이 조기 절단돼 **커버되는 패키지를 누락으로 오탐**하거나
 * 반대로 뒷부분을 놓쳐 **거짓 통과**한다.
 *
 * 조용히 틀리느니 깨지게 만든다 — 그 조건을 직접 검출해 throw 한다. 가드가 조용히 무력화되는
 * 것이야말로 이 파일이 막으려는 결함이므로(#968), 파서 자신도 같은 기준을 지켜야 한다.
 */
function fnBody(sh: string, fn: string): string {
  const open = new RegExp(`^${fn}\\(\\)\\s*\\{\\s*$`, "m").exec(sh);
  if (!open) throw new Error(`fnBody: ${fn} 선언을 찾지 못함 — .claude/test-stages.sh 구조 변경?`);
  const rest = sh.slice(open.index + open[0].length);
  const close = /^\}$/m.exec(rest);
  if (!close) throw new Error(`fnBody: ${fn} 의 닫는 '}' 를 찾지 못함`);
  const body = rest.slice(0, close.index);
  // 조기 열림(early-open): 본문에 라인 시작 블록 '{' 이 들어오면 "첫 라인 시작 '}' = 함수 끝"
  // 휴리스틱이 뒷부분을 놓친다.
  if (/^\s*(\{|[A-Za-z_]\w*\(\)\s*\{)\s*$/m.test(body)) {
    throw new Error(
      `fnBody: ${fn} 본문에 라인 시작 블록 '{' 이 있어 "첫 라인 시작 '}' = 함수 끝" 휴리스틱이 ` +
        `더 이상 안전하지 않다(본문 조기 절단 → 조용한 오판). 파서를 브레이스 카운팅으로 교체할 것.`,
    );
  }
  // 조기 닫힘(early-close): heredoc 은 라인 시작 '}' 를 본문 내부에 등장시켜 휴리스틱을 실제
  // 함수 끝보다 앞에서 절단시킨다(실측 재현: `cat <<EOF` … 개행 후 단독 '}' … `EOF`). 그 경우
  // opener('<<')는 절단된 body 안에 남으므로 여기서 잡힌다. `<<<`(here-string)는 앞뒤 lookaround
  // 로 제외. fail-loud — 이 가드가 막으려는 "조용한 조기 절단"(#968)을 파서 자신이 재현하지 않도록.
  if (/(?<!<)<<-?(?!<)/.test(body)) {
    throw new Error(
      `fnBody: ${fn} 본문에 heredoc('<<')이 있어 라인 기반 '}' 휴리스틱이 조기 절단될 수 있다 ` +
        `(조용한 패키지 누락). 파서를 heredoc 인식 방식으로 교체할 것.`,
    );
  }
  return body;
}

/**
 * 본문 안의 명시적 `pnpm --filter <pkg> <script>` 호출. `"$pkg"` 같은 변수형은 무시.
 *
 * 전제: 한 호출은 한 줄 안에 있어야 한다(`--filter`·pkg·script 가 백슬래시 줄바꿈으로 분리되면
 * 인식 못 함). 현재 test-stages.sh 는 이 형태를 지키며, 어긋나면 아래 대조에서 "누락"으로
 * 드러나므로(fail-loud) 조용한 오인식은 아니다.
 */
function explicitFilterCalls(body: string): { name: string; script: string }[] {
  return [...body.matchAll(/pnpm\s+--filter\s+"?([^\s"$]+)"?\s+"?([\w:-]+)"?/g)]
    .map((m) => ({ name: m[1], script: m[2] }))
    // 캡처 클래스 `[^\s"$]` 가 이미 `$` 를 배제해 이 필터는 현재 도달 불가능하다. 정규식을 나중에
    // 완화했을 때 변수형이 새지 않도록 남겨 둔 belt-and-suspenders(둘 다 바뀌어야 구멍이 생긴다).
    .filter((c) => !c.name.startsWith("$"));
}

// ─── packages-checks.yml 파싱 ───────────────────────────────────────────────
//
// 범용 YAML 파서를 쓰지 않는다: `js-yaml` 은 frontend 의 직접 의존이 아니고 workspace
// 루트 hoist 로만 해소된다(실측: `codebase/frontend/node_modules/js-yaml` 부재,
// `require.resolve` → 루트). 전이 의존에 기대면 install 모드가 바뀔 때 조용히 깨진다.
// 대신 **경로 스코프 리스트 추출기**만 둔다 — 필요한 3개 목록이 전부 알려진 위치라 충분하다.
// 추출 실패는 null/빈 배열 → 아래 vacuity 단언에서 red (fail-closed).

const indentOf = (line: string) => line.length - line.trimStart().length;
const isSkippable = (line: string) => !line.trim() || line.trim().startsWith("#");

/** `key:` 선언 줄의 자식 블록 범위 [from, to) — key 보다 깊게 들여쓴 연속 구간. */
function blockRange(lines: string[], keyIdx: number): [number, number] {
  const base = indentOf(lines[keyIdx]);
  let end = keyIdx + 1;
  while (end < lines.length && (isSkippable(lines[end]) || indentOf(lines[end]) > base)) end++;
  return [keyIdx + 1, end];
}

function findKeyLine(lines: string[], key: string, from: number, to: number): number {
  for (let i = from; i < to; i++) {
    if (isSkippable(lines[i])) continue;
    const t = lines[i].trim();
    // 리스트 항목(`- name: x`)은 키 선언이 아니다.
    if (t.startsWith("- ")) continue;
    if (t === `${key}:` || t.startsWith(`${key}:`)) return i;
  }
  return -1;
}

/** 예: listAtPath(lines, ["on", "pull_request", "paths"]). 미발견 시 null. */
function listAtPath(lines: string[], keys: string[]): string[] | null {
  let [from, to] = [0, lines.length];
  for (const key of keys) {
    const i = findKeyLine(lines, key, from, to);
    if (i === -1) return null;
    [from, to] = blockRange(lines, i);
  }
  const items: string[] = [];
  for (let i = from; i < to; i++) {
    if (isSkippable(lines[i])) continue;
    const m = /^-\s+(.*)$/.exec(lines[i].trim());
    if (!m) continue;
    items.push(
      m[1]
        .replace(/\s+#.*$/, "") // 인라인 주석
        .trim()
        .replace(/^['"]|['"]$/g, ""),
    );
  }
  return items;
}

/** paths 목록에서 `codebase/packages/<dir>/**` 항목의 dir 만. 그 외(lockfile 등)는 무시. */
function packageDirsInPaths(paths: string[]): string[] {
  return paths
    .map((p) => /^codebase\/packages\/([^/]+)\/\*\*$/.exec(p)?.[1])
    .filter((d): d is string => Boolean(d))
    .sort();
}

/**
 * 한 스테이지(lint/test/build) 본문에서 **실행되지 않는** 패키지명 목록.
 *
 * 커버 경로 두 가지: (a) `_run_internal <script>` 로 도는 `INTERNAL_PACKAGES` 소속,
 * (b) 명시적 `pnpm --filter <pkg> <script>` 호출. 둘 다 아니면 누락.
 *
 * 순수 함수로 분리한 이유(리뷰 WARNING#2): 이 비교가 인라인이면 저장소 현재(=이미 정렬된)
 * 상태만 읽어, `missing` 계산·Set 멤버십·커버 경로 판정에 회귀가 생겨도 스위트가 못 잡는다.
 * 아래 합성 fixture 테스트가 이 함수에 직접 mutation 성 입력을 넣어 true-positive 를 고정한다.
 */
function missingFromStage(
  body: string,
  script: string,
  internal: string[],
  packageNames: string[],
): string[] {
  const viaInternal = new RegExp(`_run_internal\\s+${script}\\b`).test(body);
  const explicit = new Set(
    explicitFilterCalls(body)
      .filter((c) => c.script === script)
      .map((c) => c.name),
  );
  return packageNames.filter(
    (name) => !explicit.has(name) && !(viaInternal && internal.includes(name)),
  );
}

// ─── 단언 ───────────────────────────────────────────────────────────────────

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
      const known = new Set(packages.map((p) => p.name));
      const stale = internal.filter((n) => !known.has(n));
      expect(
        stale,
        `codebase/packages/ 에 없는 항목: ${stale.join(", ")} — 패키지 삭제·개명 후 잔재.`,
      ).toEqual([]);
    });
  });

  // ── 2~4. packages-checks.yml — Actions 가 꺼져 있어 현재 inert. 재활성화 대비 + 규약. ──
  describe(".github/workflows/packages-checks.yml (현재 inert — Actions off)", () => {
    const expectedDirs = () =>
      packages
        .filter((p) => backendShared.includes(p.name))
        .map((p) => p.dir)
        .sort();

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
// 수동 mutation 으로만 확인했던 방어력(#968 클래스)을 스위트 안으로 들여 회귀를 고정한다 (WARNING#2).
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
  });

  describe("missingFromStage — #968 클래스(조용한 무검증)를 박제", () => {
    const internal = ["@workflow/a", "@workflow/b"];
    const bodyInternal = `_ensure_deps && \\\n  _run_internal lint`;

    it("INTERNAL 소속 + _run_internal 커버 → 누락 없음", () => {
      expect(
        missingFromStage(bodyInternal, "lint", internal, ["@workflow/a", "@workflow/b"]),
      ).toEqual([]);
    });
    it("신규 패키지가 INTERNAL 에도 명시 호출에도 없으면 → 누락 (실제 #968 시나리오)", () => {
      const pkgs = ["@workflow/a", "@workflow/b", "@workflow/new"];
      expect(missingFromStage(bodyInternal, "lint", internal, pkgs)).toEqual(["@workflow/new"]);
    });
    it("명시적 `pnpm --filter` 로 커버되면 → 누락 아님 (전용 스텝 경로)", () => {
      const body = `${bodyInternal} && \\\n  pnpm --filter @workflow/special lint`;
      expect(
        missingFromStage(body, "lint", internal, ["@workflow/a", "@workflow/special"]),
      ).toEqual([]);
    });
    it("그 스테이지에 _run_internal 이 없으면 → INTERNAL 전원 누락", () => {
      const body = `_ensure_deps && \\\n  pnpm --filter backend lint`;
      expect(missingFromStage(body, "lint", internal, internal)).toEqual([
        "@workflow/a",
        "@workflow/b",
      ]);
    });
    it("다른 스테이지(build)용 명시 호출은 이 스테이지(lint)를 커버하지 않는다", () => {
      expect(
        missingFromStage(`pnpm --filter @workflow/x build`, "lint", [], ["@workflow/x"]),
      ).toEqual(["@workflow/x"]);
    });
  });
});
