# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `_shared.ts` 신설로 새 공개 심볼(`blockRange`/`findKeyLine`/`MAX_ROOT_SEARCH_DEPTH`)이 생겼다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:26`(`MAX_ROOT_SEARCH_DEPTH`), `:74`(`blockRange`), `:87`(`findKeyLine`)
  - 상세: 종전 `internal-package-registration-guard.ts`에서 `blockRange`/`findKeyLine`은 파일 비공개(`function`, `export` 없음)였고, `MAX_DEPTH`는 `repoRoot()` 함수 스코프 내부 지역 상수였다. 리팩터 후 `_shared.ts`가 이 셋을 모듈 최상위 `export`로 공개한다. `internal-package-registration-guard.ts`는 이 셋을 import 만 하고 재export 하지 않도록 의도적으로 막아 두었다(주석에 명시: "두 가드의 공개 표면에는 올리지 않는다")고 해도, `_shared.ts` 자신의 export 표면은 실질적으로 넓어졌다 — 저장소 어디서든 `./_shared`를 상대경로로 직접 import 하면 이 심볼들에 접근 가능해졌다.
  - 제안: 의도된 설계이고 파일 헤더에 "여기 두는 기준"이 문서화돼 있어 위험은 낮다. 다만 `_shared.ts`가 `__tests__/` 하위에 있어 tsc/next build 제외 대상이라는 전제가 향후 tsconfig 변경으로 깨지면 이 확장된 표면이 프로덕션 번들에 그대로 노출될 수 있다는 점만 인지해 두면 된다(현재 조치 불요).

- **[INFO]** 두 함수의 시그니처가 선택적 매개변수 추가로 넓어졌다(하위 호환 유지)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:40-43` (`repoRoot(startDir = __dirname, exists = fs.existsSync)`), `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:141-145` (`discoverWorkspaceDirs(readLines = () => fs.readFileSync(...))`)
  - 상세: `repoRoot()`는 인자 없이 호출하던 기존 형태(`internal-package-registration-guard.ts`의 옛 정의, 인자 0개)에서 두 개의 선택적 주입 인자를 갖는 형태로 바뀌었다. `discoverWorkspaceDirs()`도 동일 패턴이다. 둘 다 기존 호출부(`discoverWorkspaceDirs()`, `repoRoot()` 무인자 호출)는 default 값이 원래 로직과 동일하게 동작해 회귀 없이 통과한다 — `repoRoot`의 default `startDir=__dirname`은 `_shared.ts` 자신의 디렉터리(`__tests__/`)로, 이관 전 `internal-package-registration-guard.ts`의 `__dirname`과 물리적으로 같은 디렉터리이므로 탐색 시작점도 동일하다. `discoverWorkspaceDirs`의 default `readLines`도 종전 인라인 `fs.readFileSync(WORKSPACE_YAML, "utf8").split("\n")`와 동일 코드를 그대로 default 값으로 옮긴 것이라 실제 파일시스템 읽기 시점·내용에 변화가 없다.
  - 제안: 순수 확장(optional param)이라 호출자 영향 없음. 조치 불요 — 참고용 기록.

- **[INFO]** 모듈 최상위(top-level) 부작용(`ROOT = repoRoot()`)의 소유권이 `internal-package-registration-guard.ts`에서 `_shared.ts`로 이동
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:54`
  - 상세: `export const ROOT = repoRoot();`는 모듈 import 시점에 즉시 실행되어 최대 12단계까지 `fs.existsSync`로 디렉터리를 순회하는 부작용을 가진다. 이 부작용 자체는 리팩터 이전에도 `internal-package-registration-guard.ts` 최상위에 동일하게 존재했으므로 새로 생긴 것은 아니다. 다만 이제 두 가드(`internal-package-registration-guard.ts`, `typescript-toolchain-guard.ts`) 모두 `_shared.ts`를 import 하므로, 이 즉시-실행 탐색의 트리거 지점이 형제 가드가 아니라 중립 모듈로 옮겨졌다는 점만 구조적으로 달라졌다. ES 모듈 캐싱으로 `ROOT` 계산은 여전히 프로세스당 1회만 일어나 중복 실행 위험은 없다.
  - 제안: 동작 동일성이 보존됐으므로 조치 불요.

- **[INFO]** `loadTypescriptFrom` 반환 타입 변경은 타입 레벨 전용, 런타임 영향 없음
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:208`
  - 상세: `unknown | null` → `unknown`으로 시그니처가 바뀌었으나 TS 타입 시스템에서 `unknown | null`은 `unknown`과 동치이므로 컴파일 타임에도 실질적 차이가 없다. 함수 본문(`try { return req(...) } catch { return null; }`)은 무변경이라 반환 값(런타임 동작)도 그대로다.
  - 제안: 순수 문서/타입 정리. 조치 불요.

## 요약

이번 변경은 `codebase/frontend/src/lib/repo-guards/__tests__/` 내부 두 저장소 가드(`internal-package-registration-guard.ts`, `typescript-toolchain-guard.ts`) 사이에 중복 결합돼 있던 공용 프리미티브(`repoRoot`/`ROOT`/`listAtPath`/`PackageManifest`/`blockRange`/`findKeyLine`)를 새 중립 모듈 `_shared.ts`로 이관하고, `internal-package-registration-guard.ts`는 재export로 기존 소비처(`internal-package-registration.test.ts`) 계약을 그대로 유지하는 순수 구조 리팩터다. `discoverWorkspaceDirs`/`repoRoot`에 선택적 주입 매개변수(default 값 보존)를 추가해 fail-closed 분기를 합성 입력으로 테스트 가능하게 만들었고, 신규 `validateWorkspacePatterns` 순수 함수는 사이드이펙트가 없다. 전역 상태 변경·환경 변수·네트워크 호출·파일 쓰기·이벤트/콜백 변경은 발견되지 않았고, 유일하게 눈에 띄는 것은 (a) `_shared.ts`가 이전에 비공개였던 `blockRange`/`findKeyLine`/`MAX_ROOT_SEARCH_DEPTH`를 새 공개 심볼로 노출한 점, (b) `repoRoot`/`discoverWorkspaceDirs`의 시그니처가 선택적 매개변수로 넓어진 점인데, 둘 다 하위 호환이 보존되고 기존 default 동작이 동일해 회귀 위험은 없다. 최상위 `ROOT = repoRoot()`의 즉시-실행 파일시스템 탐색 부작용도 위치만 이동했을 뿐 계산 결과·트리거 시점(모듈 최초 로드)·1회성이 모두 보존된다.

## 위험도

LOW
