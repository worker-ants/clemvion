// repo-guard 공유 프리미티브 — 워크스페이스 루트 탐색과 YAML 서브셋 추출기.
//
// 이 파일이 생긴 이유는 소유권이다. `typescript-toolchain-guard.ts` 는 `ROOT` ·
// `listAtPath` · `PackageManifest` 세 심볼만 필요한데, 그것을 얻으려고
// `internal-package-registration-guard.ts` 의 **전체 export 표면**(패키지 발견,
// test-stages.sh bash 파서, 워크플로 매트릭스 대조 등)에 의존하고 있었다. 그 형제
// 모듈이 자기 책임 안에서 리팩터되면 의미상 무관한 툴체인 가드가 덩달아 깨진다.
//
// 그래서 "둘 다 필요한 것" 만 중립 자리로 옮긴다. 파서를 **복제**하지 않는 것이
// 요점이다 — 같은 저장소에 같은 일을 하는 파서를 두 벌 두면 한쪽만 고쳐지는
// 드리프트가 생기고, 이 저장소의 가드들이 반복해 겪은 실패 클래스가 정확히 그것이다.
//
// 이 파일도 `__tests__/` 아래라 tsconfig 의 `src/**/__tests__/**` exclude 에 걸려
// tsc/next build 에서 제외되고, vitest 의 test include 는 `*.{test,spec}.ts` 뿐이라
// 테스트로 실행되지도 않는다 — 두 가드가 import 해서만 쓴다.
//
// **여기 두는 기준**: 두 가드가 *실제로* 공유하는 것만. 한쪽만 쓰는 것은 그쪽에
// 남긴다(예: `PACKAGES_DIR`·`TEST_STAGES` 는 등록 가드 전용, `WORKSPACE_YAML` 은
// 툴체인 가드 전용). "언젠가 공유할지도" 로 끌어오면 이 모듈이 두 번째 잡동사니가 된다.

import fs from "node:fs";
import path from "node:path";

/** 무한 루프 방지 상한. 현재 실제 깊이(worktree 루트→이 파일 7단계)의 약 1.7배 여유라
 *  정확한 값이 중요하지 않다 — 소진되면 조용히 빈 값을 내지 않고 throw 한다. */
export const MAX_ROOT_SEARCH_DEPTH = 12;

/**
 * `pnpm-workspace.yaml` 를 marker 로 위로 탐색해 workspace 루트 절대경로를 찾는다.
 *
 * 고정 `../../..` 카운트 대신 marker 로 탐색한다 — 파일이 이동해도 조용히 오해소되지 않는다.
 *
 * `startDir`/`exists` 주입은 같은 파일 `discoverWorkspaceDirs(readLines)` 와 **대칭**이다.
 * 그쪽만 주입 가능하게 만들었을 때 리뷰가 이 비대칭을 지적했고, 지적이 옳았다: 이 함수의
 * fail-closed throw 는 `__dirname` 하드코딩 때문에 합성 입력으로 겨냥할 방법이 없어
 * **테스트가 불가능**했다. 이 모듈은 두 가드의 공용 기반(`ROOT`)이라 조용히 깨지면 파급이
 * 가장 크다.
 */
export function repoRoot(
  startDir: string = __dirname,
  exists: (p: string) => boolean = fs.existsSync,
): string {
  let dir = startDir;
  for (let i = 0; i < MAX_ROOT_SEARCH_DEPTH; i++) {
    if (exists(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`repoRoot: pnpm-workspace.yaml 를 찾지 못함 (from ${startDir})`);
}

export const ROOT = repoRoot();

export type PackageManifest = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

// ---------------------------------------------------------------------------
// YAML 서브셋 추출기.
//
// 완전한 YAML 파서를 들이지 않는 이유는 등록 가드 헤더가 적어 둔 그대로다: 필요한
// 목록이 전부 알려진 경로에 있고, 추출 실패는 null/빈 배열 → vacuity 단언에서 red
// 가 되어 fail-closed 다.
// ---------------------------------------------------------------------------

const indentOf = (line: string) => line.length - line.trimStart().length;
const isSkippable = (line: string) => !line.trim() || line.trim().startsWith("#");

/** `key:` 선언 줄의 자식 블록 범위 [from, to) — key 보다 깊게 들여쓴 연속 구간. */
export function blockRange(lines: string[], keyIdx: number): [number, number] {
  const base = indentOf(lines[keyIdx]);
  let end = keyIdx + 1;
  while (end < lines.length && (isSkippable(lines[end]) || indentOf(lines[end]) > base)) end++;
  return [keyIdx + 1, end];
}

/**
 * `[from, to)` 범위에서 `key:` **선언 줄**의 인덱스. 미발견 시 -1.
 *
 * 리스트 항목(`- name: x`)은 건너뛴다 — 형태상 `key:` 를 포함하지만 선언이 아니라 값이다.
 * 그 구분이 없으면 `jobs.*.steps[].name` 같은 흔한 매트릭스에서 엉뚱한 줄을 잡는다.
 */
export function findKeyLine(
  lines: string[],
  key: string,
  from: number,
  to: number,
): number {
  for (let i = from; i < to; i++) {
    if (isSkippable(lines[i])) continue;
    const t = lines[i].trim();
    // 리스트 항목(`- name: x`)은 키 선언이 아니다.
    if (t.startsWith("- ")) continue;
    if (t === `${key}:` || t.startsWith(`${key}:`)) return i;
  }
  return -1;
}

/** 예: listAtPath(lines, ["jobs", "packages", "strategy", "matrix", "pkg"]). 미발견 시 null. */
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
