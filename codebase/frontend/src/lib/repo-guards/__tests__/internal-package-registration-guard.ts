// 내부 패키지 등록 목록 drift 가드 — 파서·비교 순수 로직.
//
// 소비처(테스트/게이트)는 형제 파일 `internal-package-registration.test.ts`. 가드의 목적과
// 배치 근거(왜 frontend vitest 인가)는 그 파일 헤더에 있다. 본 모듈은 그 가드가 쓰는 파서
// (bash / YAML 서브셋)와 비교 로직만 담는다 — 단일 파일이 다중 책임을 지지 않도록 분리(리뷰
// WARNING). 테스트 파일은 이 모듈을 import 해 "실측 대조" + "합성 fixture 회귀"만 담당한다.
//
// 이 파일도 `__tests__/` 아래라 tsconfig 의 `src/**/__tests__/**` exclude 에 걸려 tsc/next build
// 에서 제외된다(런타임 전용 — 컴파일타임 단언은 무의미). vitest 의 test include 는
// `*.{test,spec}.ts` 뿐이라 본 모듈(비-test)은 테스트로 실행되지 않고, 위 테스트가 import 해서만 쓴다.
//
// 각 목록의 **의도된 모집단이 다르다**. 단순히 `ls codebase/packages/` 전체와 비교하면 오탐이다.
//   - `INTERNAL_PACKAGES` = "특수 스텝이 없는" 패키지만 담는 의도(test-stages.sh 헤더). 따라서
//     `@workflow/web-chat` 처럼 전용 스텝을 가진 패키지는 여기 없는 게 **정상**이다.
//     → 목록 자체를 비교하지 않고, "모든 패키지가 lint/test/build 3단계에 어떤 경로로든
//        커버되는가" 라는 상위 불변식을 검증한다(등록 방식은 자유). `missingFromStage` 참고.
//   - `packages-checks.yml` = backend-공유 패키지만 대상(그 파일 헤더). 하드코딩 대신
//     `codebase/backend/package.json` 의 `@workflow/*` 의존에서 **파생**한다. 그래야 목록이 또
//     하나의 손 유지 사본이 되지 않는다. (실측: 이 클로저는 flat — 5개 중 `@workflow/*` 를
//     재의존하는 것은 없다. `@workflow/web-chat` → `@workflow/sdk` 만 전이 의존이고 backend 밖.)
//
// 대조 로직은 `scripts/check-e2e-playwright-config.py`(frontend `@workflow` 클로저 ↔
// docker-compose 볼륨 마스킹 대조)에서 빌려왔다. 그 스크립트의 담당 범위(Dockerfile COPY·compose
// 마스킹)는 여기서 중복 검사하지 않는다.

import fs from "node:fs";
import path from "node:path";

export function repoRoot(): string {
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

export const ROOT = repoRoot();
export const PACKAGES_DIR = path.join(ROOT, "codebase", "packages");
export const TEST_STAGES = path.join(ROOT, ".claude", "test-stages.sh");
export const PACKAGES_CHECKS = path.join(ROOT, ".github", "workflows", "packages-checks.yml");

export type PackageManifest = {
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
export function collectPackages(
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
export function discoverPackages(): { dir: string; name: string }[] {
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
export function workflowDepsOf(pkg: PackageManifest): string[] {
  return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
    .filter((d) => d.startsWith("@workflow/"))
    .sort();
}

/** backend 가 실제로 의존하는 `@workflow/*` — packages-checks.yml 의 모집단 SoT. */
export function backendWorkflowDeps(): string[] {
  return workflowDepsOf(
    JSON.parse(
      fs.readFileSync(path.join(ROOT, "codebase", "backend", "package.json"), "utf8"),
    ) as PackageManifest,
  );
}

// ─── test-stages.sh 파싱 ────────────────────────────────────────────────────

export function internalPackages(sh: string): string[] {
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
export function fnBody(sh: string, fn: string): string {
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
 * **명령 위치**의 pnpm 만 실제 실행으로 친다: 각 줄을 주석(`#`) 제거 후 명령 구분자
 * (`&&`·`||`·`;`·`|`)로 분절하고, 분절이 `pnpm --filter …` 로 **시작**할 때만 매치한다.
 * 이렇게 하지 않으면 설명 주석(`# pnpm --filter …`)이나 로그 문자열(`echo "… pnpm --filter …"`)
 * 안의 텍스트를 실제 커버로 오인해, 이 가드가 막으려는 #968급 "조용한 무검증 통과"를 파서
 * 자신이 재현한다(리뷰 WARNING 실측 재현). YAML 파서(`listAtPath`)가 인라인 `#` 를 제거하는
 * 것과 대칭이다.
 *
 * 전제: 한 호출은 한 분절(=한 줄, 백슬래시 줄바꿈 앞) 안에 있어야 한다. 어긋나면 대조에서
 * "누락"으로 드러나므로(fail-loud) 조용한 오인식은 아니다. 변수형(`"$pkg"`)은 캡처 클래스
 * `[^\s"$]` 가 `$` 를 배제해 자연히 제외된다.
 */
export function explicitFilterCalls(body: string): { name: string; script: string }[] {
  const calls: { name: string; script: string }[] = [];
  for (const rawLine of body.split("\n")) {
    // 라인 주석 제거: 라인 시작 또는 공백 뒤의 `#` 이후 전부 (bash 주석 규약의 실무 근사).
    const line = rawLine.replace(/(^|\s)#.*$/, "$1");
    for (const seg of line.split(/&&|\|\||[;|]/)) {
      const m = /^\s*pnpm\s+--filter\s+"?([^\s"$]+)"?\s+"?([\w:-]+)"?/.exec(seg);
      if (m) calls.push({ name: m[1], script: m[2] });
    }
  }
  return calls;
}

// ─── packages-checks.yml 파싱 ───────────────────────────────────────────────
//
// 범용 YAML 파서를 쓰지 않는다: `js-yaml` 은 frontend 의 직접 의존이 아니고 workspace 루트
// hoist 로만 해소된다(실측: `codebase/frontend/node_modules/js-yaml` 부재, `require.resolve`
// → 루트). 전이 의존에 기대면 install 모드가 바뀔 때 조용히 깨진다. 대신 **경로 스코프 리스트
// 추출기**만 둔다 — 필요한 3개 목록이 전부 알려진 위치라 충분하다. 추출 실패는 null/빈 배열 →
// vacuity 단언에서 red (fail-closed).

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
export function listAtPath(lines: string[], keys: string[]): string[] | null {
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
export function packageDirsInPaths(paths: string[]): string[] {
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
 * 순수 함수로 분리한 이유(리뷰 WARNING): 이 비교가 인라인이면 저장소 현재(=이미 정렬된)
 * 상태만 읽어, `missing` 계산·Set 멤버십·커버 경로 판정에 회귀가 생겨도 스위트가 못 잡는다.
 * 합성 fixture 테스트가 이 함수에 직접 mutation 성 입력을 넣어 true-positive 를 고정한다.
 */
export function missingFromStage(
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
