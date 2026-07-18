# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 모듈 최상위(top-level)에서 동기 파일시스템 탐색이 즉시 실행됨
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:359` (`export const ROOT = repoRoot();`)
  - 상세: `repoRoot()`는 함수가 아니라 모듈 로드 시점에 즉시 호출되는 top-level 상수 초기화이며, 내부에서 `fs.existsSync`로 최대 12단계 상위 디렉터리를 탐색한다. `pnpm-workspace.yaml`을 못 찾으면 **import 시점에 throw**한다. 현재는 `internal-package-registration.test.ts`에서만 import되므로 영향 범위가 테스트 컨텍스트로 국한되지만, 향후 다른 모듈이 이 파일을 재사용(import)할 경우 "함수 호출" 이 아니라 "import 그 자체"가 실패를 유발하는 부작용을 갖는다는 점은 문서화해 둘 가치가 있다.
  - 제안: 현재 구조(테스트 전용, throw-fast 의도)로도 문제는 없음 — 다만 이 모듈이 `__tests__/` 밖에서 재사용될 가능성이 생기면 `repoRoot()` 호출을 지연 평가(lazy, 예: getter 또는 memoized 함수)로 바꾸는 것을 고려.

- **[INFO]** 테스트 파일이 `describe` 블록 최상위(테스트 바디 밖)에서 파일 I/O 수행
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts:1002-1006` (`discoverPackages()`, `fs.readFileSync(TEST_STAGES, ...)`, `fs.readFileSync(PACKAGES_CHECKS, ...)`, `internalPackages(sh)`, `backendWorkflowDeps()`)
  - 상세: 이 호출들은 `it()`/`beforeAll()` 안이 아니라 `describe()` 콜백 본문에서 직접 실행되므로, vitest의 **테스트 수집(collection) 단계**에 동기 파일 I/O가 발생한다. 파일 부재나 파싱 실패(예: `fnBody`가 함수 선언을 못 찾아 throw) 시 개별 테스트 실패가 아니라 `describe` 블록 자체가 예외를 던져 그 파일의 모든 테스트가 뭉뚱그려 실패한다. 의도(fail-loud)와 부합하지만, 실패 시 원인 파악 난이도가 개별 `it` 실패보다 약간 높아질 수 있다.
  - 제안: 현재 설계 의도(가드가 조용히 무력화되는 것을 막는다)에 부합하므로 필수 수정 아님 — 정보 제공 목적.

- **[INFO]** 파일시스템 부작용은 전부 읽기 전용
  - 위치: `internal-package-registration-guard.ts` 전체 (`fs.readdirSync`, `fs.existsSync`, `fs.readFileSync`)
  - 상세: 신규 모듈이 접근하는 파일(`codebase/packages/*/package.json`, `codebase/backend/package.json`, `.claude/test-stages.sh`, `.github/workflows/packages-checks.yml`)은 모두 읽기만 하며 쓰기·삭제 경로가 없다. 예상치 못한 파일 생성·수정·삭제 부작용 없음.

- **[INFO]** `.claude/test-stages.sh`, `.github/workflows/packages-checks.yml` 변경은 주석 전용
  - 위치: 두 diff의 `+` 라인 전부가 `#`로 시작하는 주석
  - 상세: `INTERNAL_PACKAGES` 배열 값, CI workflow 의 `on.paths`/`matrix.pkg` 등 실행 경로에는 어떤 라인도 추가/삭제되지 않았다. 두 파일 모두 기존 동작(로컬 wrapper 실행 순서, GitHub Actions 트리거 조건)에 변화 없음 — 시그니처/인터페이스/환경변수/네트워크/이벤트 영향 없음.

## 요약

이번 변경은 신규 drift 가드(순수 파서/비교 함수 모듈 + vitest 테스트)와 기존 두 파일에 대한 주석 추가로 구성된다. 상태 변경·전역 변수 도입·기존 함수 시그니처 변경·공개 API 파괴적 변경·환경 변수 조작·네트워크 호출·이벤트/콜백 변경 중 해당하는 항목이 없다. 유일하게 주목할 지점은 신규 모듈이 파일시스템을 (읽기 전용으로) 건드리며, 그중 `repoRoot()`가 모듈 로드 시점에 즉시 실행되는 top-level 부작용이라는 점과, 테스트 파일이 `describe` 블록 최상위에서 파일 I/O를 수행해 실패 시 파일 단위로 뭉뚱그려 실패한다는 점인데, 둘 다 이 가드의 "조용히 무력화되지 않는다(fail-loud)"는 설계 의도와 일치하며 실질적 위험은 낮다.

## 위험도

LOW
