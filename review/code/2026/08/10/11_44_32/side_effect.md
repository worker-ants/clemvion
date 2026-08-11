# 부작용(Side Effect) Review

## 리뷰 범위

`typescript-toolchain-followups.md` §1(공유 프리미티브 `_shared.ts` 분리)·§2(`validateWorkspacePatterns`
순수 함수 분리)·§4(타입 정리) 구현분. 대상은 `codebase/frontend/src/lib/repo-guards/__tests__/`
아래 6개 TS 파일(신규 `_shared.ts`/`shared.test.ts`, 리팩터된 `internal-package-registration-guard.ts`/
`typescript-toolchain-guard.ts`와 대응 테스트)과 `plan/in-progress/typescript-toolchain-followups.md`.
나머지(파일 8~18)는 이전 라운드(`review/code/2026/08/10/11_22_14/`)의 산출물(SUMMARY/RESOLUTION/
개별 reviewer 리포트/meta/`_retry_state.json`)이 신규 파일로 추가된 것으로, 리뷰 워크플로가 정상적으로
남기는 기록 아티팩트일 뿐 실행 코드가 아니라 부작용 관점에서 별도 발견사항이 없다.

`fs.writeFileSync`/`unlinkSync`/`rmSync`/`mkdirSync`/`child_process`/`fetch`/`http`/`https`/
`process.env`/`global`/`globalThis` 를 대상 6개 TS 파일에서 전수 grep 했고 매치 없음(파일읽기 계열
`.exec()` 정규식 매치만 걸림) — 파일시스템 쓰기·네트워크 호출·환경 변수 접근이 이번 diff 에 없다.

## 발견사항

- **[INFO]** `_shared.ts` 신설로 이전엔 비공개였던 심볼 3개(`MAX_ROOT_SEARCH_DEPTH`/`blockRange`/`findKeyLine`)가 모듈 공개 표면이 됐다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:26`(`MAX_ROOT_SEARCH_DEPTH`), `:74`(`blockRange`), `:87`(`findKeyLine`)
  - 상세: 종전 `internal-package-registration-guard.ts` 에서 `blockRange`/`findKeyLine` 은 파일-scope 비공개 `function` 이었고 `MAX_DEPTH` 는 `repoRoot()` 함수 내부 지역 상수였다. `_shared.ts` 는 이 셋을 모듈 최상위 `export` 로 공개한다. 소비 가드 쪽(`internal-package-registration-guard.ts:50-51`)은 `ROOT`/`listAtPath`/`repoRoot`/`PackageManifest` 넷만 재export 하고 이 셋은 재export 하지 않도록 의도적으로 좁혔지만(주석에 명시), `_shared.ts` 파일 자신을 상대경로로 직접 import 하면 이 심볼들에 접근 가능한 것은 사실이다.
  - 제안: `_shared.ts` 가 `__tests__/` 아래에 있어 tsconfig `exclude` 로 tsc/next build 대상에서 빠지고 vitest 자동 include 대상도 아니라 실질 위험은 낮다. 조치 불요 — 참고용 기록.

- **[INFO]** `repoRoot`/`discoverWorkspaceDirs` 두 함수의 시그니처가 선택적 매개변수 추가로 넓어졌다(default 값이 종전 동작과 동일해 기존 호출부는 회귀 없음)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:40-43` (`repoRoot(startDir: string = __dirname, exists: (p: string) => boolean = fs.existsSync)`), `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:141-145` (`discoverWorkspaceDirs(readLines: () => string[] = () => fs.readFileSync(WORKSPACE_YAML, "utf8").split("\n"))`)
  - 상세: `repoRoot()` 는 인자 0개로 호출하던 이전 정의(이관 전 `internal-package-registration-guard.ts`)에서 두 선택적 주입 인자를 갖는 형태로 바뀌었다. 기본값 `startDir = __dirname` 은 JS 시맨틱상 함수가 **정의된 모듈**(`_shared.ts`) 기준으로 평가되는데, `_shared.ts` 와 이관 전 `internal-package-registration-guard.ts` 가 물리적으로 같은 디렉터리(`repo-guards/__tests__/`)라 탐색 시작점이 동일하게 유지된다(직접 확인). `discoverWorkspaceDirs()` 무인자 호출부(`typescript-toolchain.test.ts:47`)도 기본값이 종전 인라인 코드와 동일해 그대로 통과한다.
  - 제안: 순수 확장(optional param, default 보존)이라 기존 호출자 영향 없음. 조치 불요.

- **[INFO]** 모듈 최상위 즉시-실행 부작용(`ROOT = repoRoot()`)의 소유·트리거 지점이 `internal-package-registration-guard.ts` 에서 `_shared.ts` 로 이동
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:54` (`export const ROOT = repoRoot();`)
  - 상세: import 시점에 즉시 실행되어 최대 `MAX_ROOT_SEARCH_DEPTH`(12)단계까지 `fs.existsSync` 로 상위 디렉터리를 순회하는 부작용은 리팩터 이전에도 `internal-package-registration-guard.ts` 최상위에 동일하게 있었다. 이번 변경으로 새로 생긴 부작용이 아니라, 두 가드(`internal-package-registration-guard.ts`, `typescript-toolchain-guard.ts`)가 모두 `_shared.ts` 를 import 하면서 트리거 지점만 형제 가드에서 중립 모듈로 옮겨졌다. ES 모듈 캐싱으로 계산은 여전히 프로세스당 1회다. `typescript-toolchain-guard.ts` 는 종전엔 `internal-package-registration-guard.ts` 를 통째로 import 해 그 모듈의 다른 최상위 코드(`PACKAGES_DIR`/`TEST_STAGES`/`PACKAGES_CHECKS` — 부작용 없는 `path.join`)까지 함께 실행시켰는데, 이제는 `_shared.ts` 만 실행되므로 오히려 결합이 줄었다.
  - 제안: 동작 동일성이 보존됐으므로 조치 불요.

- **[INFO]** `loadTypescriptFrom` 반환 타입 변경은 타입 레벨 전용, 런타임 영향 없음
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:208`
  - 상세: `unknown | null` → `unknown` 으로 시그니처가 바뀌었으나 TS 타입 시스템에서 둘은 동치라 컴파일 타임에도 실질적 차이가 없다. 함수 본문(`try { return req(...) } catch { return null; }`)은 무변경이라 반환 값(런타임 동작)도 그대로다. `createRequire` 를 통한 `require("typescript")` 호출(모듈 로드 부작용) 자체도 이 diff 이전부터 있던 동작으로 변경 없음.
  - 제안: 조치 불요.

CRITICAL·WARNING 급 부작용 없음.

## 요약

이번 변경은 `internal-package-registration-guard.ts`와 `typescript-toolchain-guard.ts` 사이에 결합돼
있던 공용 프리미티브(`repoRoot`/`ROOT`/`listAtPath`/`PackageManifest`/`blockRange`/`findKeyLine`)를
새 중립 모듈 `_shared.ts`로 이관하고, `internal-package-registration-guard.ts`는 재export로 기존
소비처 계약을 유지하는 순수 구조 리팩터다. `fs.writeFileSync`류 파일 쓰기, `child_process`/네트워크
호출, `process.env` 접근은 전수 grep 으로 없음을 확인했다. `repoRoot`/`discoverWorkspaceDirs` 에
추가된 선택적 DI 매개변수는 기본값이 종전 동작과 동일해 기존 호출자에 영향이 없고, 모듈 최상위
`ROOT = repoRoot()` 즉시-실행 파일시스템 탐색 부작용도 위치만 이동했을 뿐 트리거 시점(모듈 최초
로드)·결과·1회성이 모두 보존된다. 유일하게 구조적으로 새로 생긴 것은 `_shared.ts` 자신이 이전에
비공개였던 심볼 3개(`blockRange`/`findKeyLine`/`MAX_ROOT_SEARCH_DEPTH`)를 공개 표면으로 노출한
것인데, 두 소비 가드는 그 확장분을 재export 에서 의도적으로 제외해 각자의 공개 계약은 그대로다.
전부 INFO 수준이며, 이 항목들은 이미 이전 라운드(`review/code/2026/08/10/11_22_14/side_effect.md`)
에서 side_effect 관점으로 동일하게 지적·검토돼 "조치 불요"로 수렴한 상태와 일치한다(RESOLUTION.md
확인 — side_effect 축 WARNING 0건).

## 위험도

LOW
