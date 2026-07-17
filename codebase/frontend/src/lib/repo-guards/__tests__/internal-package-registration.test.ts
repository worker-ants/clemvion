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
// 주의: tsconfig 가 `src/**/__tests__/**` 를 exclude 하므로 tsc/next build 는 이 파일을
// 보지 않고, vitest 는 타입을 strip 한다. → 컴파일타임 단언은 무의미하다. 전부 런타임 단언.

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
  let dir = __dirname;
  for (let i = 0; i < 12; i++) {
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

/** `codebase/packages/<dir>/package.json` 실측 → dir ↔ name 양방향. */
function discoverPackages(): { dir: string; name: string }[] {
  return fs
    .readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const manifest = path.join(PACKAGES_DIR, e.name, "package.json");
      if (!fs.existsSync(manifest)) return null;
      const name = JSON.parse(fs.readFileSync(manifest, "utf8")).name as string;
      return { dir: e.name, name };
    })
    .filter((p): p is { dir: string; name: string } => p !== null)
    .sort((a, b) => a.dir.localeCompare(b.dir));
}

/** backend 가 실제로 의존하는 `@workflow/*` — packages-checks.yml 의 모집단 SoT. */
function backendWorkflowDeps(): string[] {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, "codebase", "backend", "package.json"), "utf8"),
  );
  return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
    .filter((d) => d.startsWith("@workflow/"))
    .sort();
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
  if (/^\s*(\{|[A-Za-z_]\w*\(\)\s*\{)\s*$/m.test(body)) {
    throw new Error(
      `fnBody: ${fn} 본문에 라인 시작 블록 '{' 이 있어 "첫 라인 시작 '}' = 함수 끝" 휴리스틱이 ` +
        `더 이상 안전하지 않다(본문 조기 절단 → 조용한 오판). 파서를 브레이스 카운팅으로 교체할 것.`,
    );
  }
  return body;
}

/** 본문 안의 명시적 `pnpm --filter <pkg> <script>` 호출. `"$pkg"` 같은 변수형은 무시. */
function explicitFilterCalls(body: string): { name: string; script: string }[] {
  return [...body.matchAll(/pnpm\s+--filter\s+"?([^\s"$]+)"?\s+"?([\w:-]+)"?/g)]
    .map((m) => ({ name: m[1], script: m[2] }))
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
        const viaInternal = new RegExp(`_run_internal\\s+${script}\\b`).test(body);
        const explicit = new Set(
          explicitFilterCalls(body)
            .filter((c) => c.script === script)
            .map((c) => c.name),
        );

        const missing = packages
          .filter((p) => !explicit.has(p.name) && !(viaInternal && internal.includes(p.name)))
          .map((p) => p.name);

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
