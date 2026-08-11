# 요구사항(Requirement) Review

## 대상

`typescript-toolchain-followups` 플랜 §1(공유 프리미티브 `_shared.ts` 분리)·§2(`validateWorkspacePatterns`
fail-closed 분리 + synthetic 테스트) 구현. `codebase/frontend/src/lib/repo-guards/__tests__/` 하위
6개 TS 파일 + 추적 plan 문서 1개.

## 검증 방법

- `pnpm vitest run src/lib/repo-guards/__tests__` → 3 files / 82 tests 전부 pass.
- `npx tsc --noEmit` → 0 errors (단 `__tests__/**` 는 tsconfig exclude 대상이라 이 파일들 자체는 타입체크
  범위 밖 — 파일 헤더 주석의 "tsc/next build 에서 제외" 주장과 tsconfig 실측 일치 확인).
- `npx eslint src/lib/repo-guards/__tests__/` → 0 errors, 기존 warning 1건(unused `_drop`, 의도된
  destructure-omit 패턴).
- `vitest.config.ts` 의 `include: ["src/**/*.{test,spec}.{ts,tsx}"]` 확인 → `_shared.ts`·
  `*-guard.ts` (비-test 파일)는 vitest 자동 발견 대상이 아니라는 주석 주장과 일치.
- `spec/` 전체에서 `repo-guard`/`test-stages`/`packages-checks`/`typescript-toolchain`/
  `internal-package-registration` grep → 0건. 이 영역을 정의하는 spec 문서 없음(제품 기능이 아니라
  내부 CI/테스트 하네스 코드).

## 발견사항

- **[WARNING]** `_shared.ts`의 `repoRoot` JSDoc이 `discoverWorkspaceDirs`를 "같은 파일"로 지칭하지만
  실제로는 형제 모듈(`typescript-toolchain-guard.ts`)에 있다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:33` (`` * `startDir`/`exists` 주입은 같은 파일 `discoverWorkspaceDirs(readLines)` 와 **대칭**이다. ``)
  - 상세: `_shared.ts`에는 `repoRoot`/`blockRange`/`findKeyLine`/`listAtPath`만 있고
    `discoverWorkspaceDirs`는 정의돼 있지 않다(`typescript-toolchain-guard.ts:141`에 정의, `_shared.ts`가
    아니라 그 형제 파일). 대칭 관계 자체(`startDir`/`exists` ↔ `readLines` 주입 규약)는 실제로 맞지만,
    "같은 파일"이라는 위치 지시어가 틀려 독자가 `_shared.ts` 안에서 그 함수를 찾다 못 찾는다. 같은
    파일 안의 반대편 주석(`typescript-toolchain-guard.ts`의 "`readLines` 주입은 같은 파일의
    `expandWorkspaceGlobs(readDir)` · `typescriptDecls(readManifest)` 와 같은 규약")은 실제로 같은 파일이라
    정확함 — 이 파일 쪽만 틀림.
  - 제안: "같은 파일" → "형제 모듈 `typescript-toolchain-guard.ts` 의" 로 정정.

- **[INFO]** 관련 spec 문서 없음 — 정상.
  - 위치: N/A (`spec/` grep 0건)
  - 상세: 이 변경은 제품 기능이 아니라 내부 CI/테스트 하네스(패키지 등록 drift 가드·TS 툴체인 계약
    가드)의 리팩터링이다. `spec/` 어디에도 `repo-guard`/`test-stages.sh`/`packages-checks.yml` 관련
    요구사항 문서가 없다. 이는 결함이 아니라 이 영역이 애초에 spec 통제 밖(개발 도구 코드)이기
    때문으로 판단됨.
  - 제안: 조치 불요.

- **[INFO]** plan 체크리스트의 "TEST WORKFLOW — frontend 282 files / 5862 tests passed" 수치가
  현재 전체 스위트(284 files / 5922 passed + 1 skipped, 실측)와 다르다.
  - 위치: `plan/in-progress/typescript-toolchain-followups.md:118` (`- [x] **TEST WORKFLOW** — frontend 282 files / 5862 tests passed, ...`)
  - 상세: 이 수치는 §1·§2 최초 구현 커밋(`_shared.ts` 신설, `shared.test.ts` 아직 없던 시점) 시점의
    스냅샷이다. 이후 별도 fix 커밋에서 `repoRoot`에도 DI를 추가하며 `shared.test.ts`(신규 6건)가
    생겼고, 그 커밋 자체는 "repo-guard 82건 통과"로 별도 검증됨(직접 재실행해 확인 — 3 files / 82
    tests pass). 전체 스위트 수치만 최초 스냅샷에 고정된 채 미갱신이다. 회귀는 아님(재실행 결과
    전부 green) — 다만 체크리스트 문구가 시점 스냅샷이라는 점이 명시되어 있지 않아 "현재 상태"로
    오독될 여지가 있다.
  - 제안: 조치 불요(참고용 로그 성격). 후속에서 재실측할 일이 있으면 갱신.

## 요구사항 충족 관점 확인 사항 (문제 없음)

- `repoRoot`/`blockRange`/`findKeyLine`/`listAtPath`가 `internal-package-registration-guard.ts`에서
  `_shared.ts`로 **로직 변경 없이** 그대로 이관됐음을 diff로 확인(단순 위치 이동, 알고리즘 동일).
- `internal-package-registration-guard.ts`는 이관된 4개 심볼 중 `blockRange`/`findKeyLine`은
  재export하지 않고 내부적으로만(`blockScalarAtPath`) 사용 — "이관의 부산물로 API가 넓어지면 안 된다"는
  헤더 주석의 의도와 실제 export 목록(`export { ROOT, listAtPath, repoRoot }`)이 일치.
- `validateWorkspacePatterns(patterns: string[] | null): string[]`가 `null`(키 부재)과 `[]`(항목
  부재) 두 실패를 모두 fail-closed throw로 처리하고, 정상 경로에서 값을 변형 없이 그대로 반환함을
  코드·테스트 양쪽에서 확인. `discoverWorkspaceDirs`가 이 검증을 실제로 태우는지("호출부") 별도
  테스트로 고정 — 헬퍼만 테스트하고 호출부를 건너뛰는 뮤턴트(`?? []`)가 살아남았다는 서술이 코드
  구조(디폴트 `readLines` 주입 + 호출부 테스트)와 일치.
  `discoverWorkspaceDirs(readLines: () => string[] = () => fs.readFileSync(WORKSPACE_YAML, ...))`
  형태는 같은 파일의 `expandWorkspaceGlobs(readDir)` 주입 규약과 대칭이며, 기본 인자를 쓰는 실제
  호출부(`discoverWorkspaceDirs()`)의 회귀도 별도 테스트("기본 인자로 부르면 이 저장소의 실제 루트를
  찾는다" 류)로 커버됨.
- `repoRoot(startDir, exists)`의 marker 탐색 로직 — 상한 도달 시 throw(fail-closed), 파일시스템
  루트(`path.dirname("/") === "/"`) 조기 종료, 가장 가까운 marker 우선 — 전부 `shared.test.ts`의
  경계값 테스트(호출 횟수 단언 포함)로 정확히 대응됨을 직접 트레이스해 확인. 반환값 미제공 경로 없음
  (정상 발견 시 문자열 반환, 실패 시 항상 throw — 조용한 빈 문자열/undefined 반환 경로 없음).
- `loadTypescriptFrom` 반환 타입 `unknown | null` → `unknown` 변경은 순수 타입 표기 정리(TS상
  동치)로 런타임 동작 변화 없음. JSDoc 정정(`missingCompilerApi`의 "이 경로" 지시어 모호성 해소)도
  실제 분기(TS7 스텁은 객체이므로 `filter` 경로를 탐)와 일치.
- TODO/FIXME/HACK/XXX 주석 없음(grep 확인).
- 신규 테스트("인라인 주석을 항목에서 떼어낸다" 등)는 기존 코드의 미검증 사각지대(뮤테이션 실측으로
  드러남)를 정확히 겨냥하며, 회귀 방지 목적에 부합.

## 요약

`_shared.ts` 신설(공유 프리미티브 이관)과 `validateWorkspacePatterns` fail-closed 분리는 로직
변경 없이 순수 구조 개선이며, 이관·재export·비공개 유지 범위가 각 파일 헤더의 설계 의도와 정확히
일치한다. fail-closed 3개 축(빈 목록/키 부재, repoRoot marker 미발견, 호출부 검증 우회)이 모두
synthetic 테스트로 고정됐고 82건 전부 통과·tsc/eslint 클린을 직접 재실행으로 확인했다. 이 영역은
spec 통제 밖(개발 도구 코드)이라 spec fidelity 이슈는 없음(INFO). 유일한 실질 결함은 `_shared.ts`
JSDoc의 "같은 파일" 지시어가 형제 파일을 가리키는 사소한 문서 오류(WARNING)이며, plan 체크리스트의
테스트 수치가 최초 스냅샷에서 갱신되지 않은 점은 참고 수준(INFO)이다. 둘 다 동작·계약에 영향 없다.

## 위험도

LOW
