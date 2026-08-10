// TypeScript 툴체인 계약 가드 — 파서·판정 순수 로직.
//
// 소비처는 형제 파일 `typescript-toolchain.test.ts`. 가드의 목적과 배치 근거는 그 파일 헤더에 있다.
// 본 모듈은 워크스페이스 발견·range 파싱·compiler API 판정만 담는다(단일 파일 다중 책임 회피 —
// 형제 가드 `internal-package-registration-guard.ts` 와 같은 분리 규약).
//
// 워크스페이스 루트 탐색(`ROOT`)·YAML 서브셋 리스트 추출(`listAtPath`)·매니페스트 타입
// (`PackageManifest`) 셋은 중립 모듈 `_shared.ts` 에서 **재사용**한다. 같은 저장소에서 같은
// 일을 하는 파서를 두 벌 두면 한쪽만 고쳐지는 드리프트가 생긴다 — 실제로 이 저장소의
// 가드들이 반복해 겪은 실패 클래스다.
//
// 종전에는 그 셋을 형제 가드(`internal-package-registration-guard.ts`)에서 가져왔다. 파서를
// 공유한다는 목적은 같았지만 **무관한 책임의 전체 export 표면**에 매달리는 대가가 붙었다 —
// 그쪽이 자기 도메인 안에서 리팩터되면 이 가드가 이유 없이 깨진다. 공유해야 할 것만 중립
// 자리로 옮겨 그 결합을 끊었다.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ROOT, listAtPath, type PackageManifest } from "./_shared";

export const WORKSPACE_YAML = path.join(ROOT, "pnpm-workspace.yaml");

/**
 * `@nestjs/cli` · `ts-jest` · `fork-ts-checker` · `typescript-eslint` 가 공통으로 기대하는
 * JS compiler API 표면의 대표 심볼.
 *
 * 전수가 아니라 **대표**다 — 전수 열거는 상류 API 가 정상적으로 넓어질 때마다 거짓 빨간불을
 * 낸다. 셋을 고른 근거:
 *
 *   - `getParsedCommandLineOfConfigFile` — `@nestjs/cli` 의 `TypeScriptBinaryLoader` 가 로드
 *     직후 부르는 바로 그 함수. #1047 사고의 에러 메시지에 그대로 등장한다.
 *   - `createProgram` — 타입체크를 하는 모든 소비자(fork-ts-checker·typescript-eslint)의 진입점.
 *   - `transpileModule` — 타입체크 없이 변환만 하는 소비자(ts-jest 의 isolatedModules 경로).
 *
 * 셋 다 TS 1.x 대부터 있던 안정 표면이라 정상적인 major 상향으로는 사라지지 않는다. TS7 처럼
 * **API 자체를 다른 export 표면으로 옮기면** 셋이 동시에 사라진다 — 그게 이 가드가 잡는 사건이다.
 */
export const REQUIRED_COMPILER_API = [
  "getParsedCommandLineOfConfigFile",
  "createProgram",
  "transpileModule",
] as const;

/**
 * 모듈이 노출하지 **않는** 필수 compiler API 심볼 목록. 빈 배열이면 계약 충족.
 *
 * 비-객체(스텁이 아예 함수·null·undefined 인 경우)는 전부 누락으로 친다 — fail-closed.
 *
 * TS7 의 `require('typescript')` 는 `{version, versionMajorMinor}` **객체**라 위 비-객체
 * 분기가 아니라 아래 `filter` 를 타고, 셋 다 함수가 아니므로 3건을 낸다. (종전 서술이
 * "이 경로로" 라고만 적어 바로 앞 비-객체 분기를 가리키는 것처럼 읽혔다 — 코드와 테스트는
 * 정확했고 문장만 모호했다.)
 */
export function missingCompilerApi(mod: unknown): string[] {
  if (mod === null || typeof mod !== "object") return [...REQUIRED_COMPILER_API];
  const m = mod as Record<string, unknown>;
  return REQUIRED_COMPILER_API.filter((key) => typeof m[key] !== "function");
}

/**
 * semver range 의 major 숫자. 판정 불가면 null (→ 호출부에서 fail-closed).
 *
 * 받는 형태: `5.9.3` · `^5.7.3` · `^5` · `~7.0.2` · `5.x`.
 * null 이 되는 형태: `workspace:*` · `>=5 <6` 같은 복합 range · `latest` · 빈 문자열.
 *
 * 복합 range 를 굳이 해석하지 않는 이유: 이 저장소의 매니페스트는 전부 caret 단일 range 이고,
 * 해석 범위를 넓히는 만큼 "조용히 틀린 major" 의 여지가 생긴다. 못 읽으면 **깨지는 쪽**이 낫다.
 */
export function parseMajor(range: string): number | null {
  const m = /^\s*[\^~]?\s*(\d+)(?:\.\d+|\.x)*\s*$/.exec(range);
  return m ? Number(m[1]) : null;
}

/** 매니페스트의 typescript 선언 range. dev/prod 어느 쪽이든. 없으면 null. */
export function typescriptRangeOf(pkg: PackageManifest): string | null {
  return pkg.devDependencies?.typescript ?? pkg.dependencies?.typescript ?? null;
}

/**
 * `pnpm-workspace.yaml` 의 `packages:` 글롭을 실제 디렉터리(루트 상대)로 확장.
 *
 * 지원하는 형태는 이 저장소가 실제로 쓰는 두 가지뿐이다: 고정 경로(`codebase/backend`) 와
 * **말미 단일 `*`**(`codebase/packages/*`). 그 밖(`**`·중간 `*`)이 들어오면 조용히 빈 결과를
 * 내지 않고 throw 한다 — 워크스페이스가 늘었는데 가드가 못 보는 것이 이 파일이 막으려는 사건이다.
 *
 * fs 접근과 분리한 순수 코어(`readDir` 주입) — 합성 fixture 로 확장 로직 자체를 고정한다.
 */
export function expandWorkspaceGlobs(
  patterns: string[],
  readDir: (relDir: string) => string[],
): string[] {
  const out: string[] = [];
  for (const pattern of patterns) {
    if (!pattern.includes("*")) {
      out.push(pattern);
      continue;
    }
    if (!pattern.endsWith("/*") || pattern.slice(0, -2).includes("*")) {
      throw new Error(
        `expandWorkspaceGlobs: 지원하지 않는 글롭 '${pattern}' — 말미 단일 '*' 만 처리한다. ` +
          `pnpm-workspace.yaml 이 넓어졌다면 이 함수를 함께 고칠 것(조용한 누락 방지).`,
      );
    }
    const base = pattern.slice(0, -2);
    for (const child of readDir(base)) out.push(`${base}/${child}`);
  }
  return out.sort();
}

/**
 * 추출된 `packages:` 목록의 fail-closed 검사. 통과하면 그 목록을 그대로 돌려준다.
 *
 * `listAtPath` 가 `null`(키 자체를 못 찾음) 또는 `[]`(찾았으나 항목이 없음)을 내면 던진다 —
 * 추출 실패를 빈 목록으로 흘려보내면 워크스페이스가 0개가 되어 **가드 전체가 조용히
 * vacuous** 해진다. 이 저장소에서 가장 비싼 실패형이 그것이다.
 *
 * `discoverWorkspaceDirs` 안에 있던 것을 순수 함수로 뽑았다. 그 자리에서는 throw 가 실제
 * `fs.readFileSync(WORKSPACE_YAML)` 와 묶여 있어, 저장소가 정상인 한 자연 발동하지 않고
 * **합성 입력으로 겨냥할 방법도 없었다** — 즉 fail-closed 라는 성질 자체가 미검증이었다.
 */
export function validateWorkspacePatterns(patterns: string[] | null): string[] {
  if (patterns === null || patterns.length === 0) {
    throw new Error(
      "validateWorkspacePatterns: pnpm-workspace.yaml 의 packages: 목록을 읽지 못했다 — " +
        "추출 실패를 빈 목록으로 흘려보내면 가드가 통째로 vacuous 해진다.",
    );
  }
  return patterns;
}

/**
 * `pnpm-workspace.yaml` 실측 → 워크스페이스 디렉터리(루트 상대, 정렬).
 *
 * `readLines` 주입은 같은 파일의 `expandWorkspaceGlobs(readDir)` ·
 * `typescriptDecls(readManifest)` 와 같은 규약이다. 여기서도 필요한 이유는 **호출부**
 * 때문이다: `validateWorkspacePatterns` 만 순수 함수로 뽑아 두면 그 헬퍼는 초록인데
 * 이 함수가 검증을 건너뛰는 변경이 조용히 통과한다(실제로 그 뮤턴트가 살아남았다).
 * 주입이 있어야 "이 함수가 정말 그 검증을 태우는가" 를 합성 입력으로 물을 수 있다.
 */
export function discoverWorkspaceDirs(
  readLines: () => string[] = () => fs.readFileSync(WORKSPACE_YAML, "utf8").split("\n"),
): string[] {
  const lines = readLines();
  const patterns = validateWorkspacePatterns(listAtPath(lines, ["packages"]));
  return expandWorkspaceGlobs(patterns, (relDir) =>
    fs
      .readdirSync(path.join(ROOT, relDir), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name),
  );
}

export type TypescriptDecl = { dir: string; range: string };

/** 워크스페이스 디렉터리 목록 → typescript 를 선언한 것만 `{dir, range}`. */
export function typescriptDecls(
  dirs: string[],
  readManifest: (dir: string) => PackageManifest | null,
): TypescriptDecl[] {
  const out: TypescriptDecl[] = [];
  for (const dir of dirs) {
    const pkg = readManifest(dir);
    if (pkg === null) continue;
    const range = typescriptRangeOf(pkg);
    if (range !== null) out.push({ dir, range });
  }
  return out;
}

/** 실측 매니페스트 로더. 파일이 없으면 null(워크스페이스 디렉터리에 manifest 부재 = skip). */
export function readManifestAt(dir: string): PackageManifest | null {
  const file = path.join(ROOT, dir, "package.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as PackageManifest;
}

/**
 * lockstep 판정 — 선언된 range 들의 major 집합.
 *
 * `unparsable` 이 비어 있지 않거나 `majors` 가 2개 이상이면 위반이다. 둘을 한 번에 돌려주는
 * 이유: 호출부가 "파싱 실패" 를 빈 majors 로 오인해 조용히 통과시키는 형태를 막는다.
 */
export function majorSpread(decls: TypescriptDecl[]): {
  majors: number[];
  unparsable: TypescriptDecl[];
} {
  const majors = new Set<number>();
  const unparsable: TypescriptDecl[] = [];
  for (const d of decls) {
    const major = parseMajor(d.range);
    if (major === null) unparsable.push(d);
    else majors.add(major);
  }
  return { majors: [...majors].sort((a, b) => a - b), unparsable };
}

/**
 * `dir` 컨텍스트에서 해소되는 typescript 모듈. 미설치면 null.
 *
 * `@nestjs/cli` 의 `TypeScriptBinaryLoader` 와 **같은 방식**(`require.resolve` + `require`)으로
 * 집는다 — 버전 문자열이 아니라 소비자가 실제로 겪는 것을 재현하는 게 이 축의 요점이다.
 */
// 반환 타입은 `unknown` 이다. 종전 `unknown | null` 은 TS 상 `unknown` 과 동치라 의미가 없고,
// 같은 파일의 `readManifestAt`(`PackageManifest | null`) 처럼 실제로 좁히는 시그니처와 나란히
// 두면 "여기도 null 을 좁혀 준다" 로 오독된다. 미설치 시 `null` 을 준다는 사실은 위 JSDoc 이
// 말하고, 소비처는 어차피 `missingCompilerApi` 로 형태를 판정한다.
export function loadTypescriptFrom(dir: string): unknown {
  const req = createRequire(path.join(ROOT, dir, "package.json"));
  try {
    return req(req.resolve("typescript"));
  } catch {
    return null;
  }
}
