# 부작용(Side Effect) 리뷰

## 리뷰 대상

1. `.claude/test-stages.sh` — 주석 추가만 (`INTERNAL_PACKAGES` 배열 자체는 무변경)
2. `.github/workflows/packages-checks.yml` — 주석 추가만 (트리거·매트릭스 무변경)
3. `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` — 신규 vitest 파일 (drift 가드)

## 발견사항

- **[INFO]** 신규 가드 테스트는 파일시스템을 읽기 전용으로만 사용
  - 위치: `internal-package-registration.test.ts` 전체 (`discoverPackages`, `backendWorkflowDeps`, `fs.readFileSync(TEST_STAGES/PACKAGES_CHECKS)` 등)
  - 상세: `fs.readdirSync`/`fs.readFileSync`/`fs.existsSync` 호출만 존재하고 `writeFileSync`/`mkdirSync`/`rmSync` 류는 전무. 네트워크 호출·환경변수 read/write·전역 변수 수정·기존 함수 시그니처 변경도 없음(신규 파일이므로 호출자 영향 없음). `.claude/test-stages.sh`·`packages-checks.yml` 두 파일의 diff 도 주석(`#`)만 추가돼 `INTERNAL_PACKAGES` 배열·`on.paths`·`matrix.pkg` 등 실행 경로에는 어떤 동작 변화도 없음.
  - 제안: 없음 (side-effect 관점에서 문제 없음).

- **[INFO]** 모듈 최상단 `repoRoot()` 즉시 실행 + `describe` 콜백 내부(비-`beforeAll`) 동기 fs 읽기
  - 위치: `internal-package-registration.test.ts:940`(`const ROOT = repoRoot();`, 모듈 top-level), `internal-package-registration.test.ts:1164-1168`(`describe(...)` 콜백 안의 `discoverPackages()`/`fs.readFileSync(TEST_STAGES)`/`fs.readFileSync(PACKAGES_CHECKS)`/`backendWorkflowDeps()`가 `it` 이 아니라 describe 본문에서 즉시 실행)
  - 상세: 이 I/O 들은 "테스트 실행" 이 아니라 "테스트 수집(collection)/모듈 로드" 시점에 즉시 실행된다. 저장소 레이아웃이 예상과 다르면(예: `pnpm-workspace.yaml` 미발견, `.claude/test-stages.sh` 부재) 개별 `it` 실패가 아니라 파일 로드 자체가 throw 되어 이 테스트 파일 전체가 한꺼번에 깨진다. 코드 주석에 "조용히 틀리느니 깨지게 만든다"는 의도가 명시돼 있어 **설계된 fail-loud** 이지 버그는 아니지만, 통상적인 vitest 관례(`beforeAll` 로 지연)와 다르다는 점은 부작용 관점에서 기록해 둘 만하다. 실행 환경(CI `actions/checkout@v7`, 로컬 `run-test.sh`)은 항상 풀 체크아웃이므로 실질적 위험은 낮음.
  - 제안: 현행 유지 가능. 다만 이 테스트가 vitest 전체 스위트의 한 워커 프로세스에서 다른 파일들과 병행 수집될 때, 이 파일의 throw 가 (vitest 설정에 따라) 다른 무관 테스트 파일의 리포팅에 영향을 주지 않는지 한 번 로컬에서 `pnpm --filter frontend test` 전체 실행으로 확인 권장(문서상 이미 실측했다면 스킵 가능).

- **[INFO]** frontend 테스트 스위트가 `codebase/frontend/` 경계를 넘어 리포지토리 루트(`.claude/`, `.github/workflows/`, `codebase/backend/package.json`, `codebase/packages/*`)를 읽음
  - 위치: `internal-package-registration.test.ts` 의 `TEST_STAGES`/`PACKAGES_CHECKS`/`PACKAGES_DIR`/`codebase/backend/package.json` 경로 상수들
  - 상세: `codebase/frontend/src/lib/**` 아래 vitest 가 자신의 워크스페이스 밖 파일을 읽는 것은 이례적인 결합(coupling)이다. 파일 헤더 주석이 이 선택의 이유(Actions 비활성·python harness 비활성·frontend vitest 만이 실제로 도는 유일한 게이트)를 상세히 근거 제시하고 있어 의도적 설계로 판단됨. 부작용(파일 변경·오염) 리스크는 없음 — 순수 read. 다만 이 프런트엔드 패키지가 향후 모노레포 밖에서 독립적으로 테스트되는 시나리오(예: 패키지 추출·standalone CI)가 생기면 `repoRoot()` 탐색이 실패해 이 테스트만 깨지는 지점이 됨.
  - 제안: 없음. 현재 모노레포 구조가 유지되는 한 문제 없음.

- **[INFO]** CI 트리거 경로(`frontend-checks.yml`) 는 `.claude/**`/`.github/workflows/**` 변경을 커버하지 않음 — 그러나 실질 게이트는 로컬 `run-test.sh` 이므로 영향 미미
  - 위치: `.github/workflows/frontend-checks.yml` (`on.pull_request.paths`/`on.push.paths`, 이번 diff 범위 밖) vs 신규 가드가 검사하는 `.claude/test-stages.sh`
  - 상세: 향후 어떤 PR 이 `.claude/test-stages.sh` 의 `INTERNAL_PACKAGES` 만 수정(신규 패키지 디렉터리 생성 없이, 예: 항목 실수 삭제)하고 `codebase/frontend/**`/`codebase/packages/**` 를 건드리지 않으면, `frontend-checks.yml` 자체가 CI 에서 트리거되지 않아 이 신규 가드가 그 PR 에서 돌지 않는다. 다만 파일 자체 주석에 명시된 대로 GitHub Actions 는 repo 레벨에서 이미 꺼져 있고(`packages-checks.yml`·`harness-checks.yml` 런 수 0), 실질 enforcement 는 diff 무관하게 항상 전체 스위트를 도는 로컬 `.claude/tools/run-test.sh` → `pnpm --filter frontend test` 이므로 이 gap 의 실질 영향은 낮다.
  - 제안: 없음(현재 Actions 비활성 상태를 감안하면 자연 해소). Actions 재활성화 시점에 함께 재검토할 사항으로 메모만.

## 요약

세 파일 변경 모두 부작용 관점에서 안전하다. `.claude/test-stages.sh`·`.github/workflows/packages-checks.yml` 은 주석만 추가되어 실행 경로·트리거·매트릭스에 아무 동작 변화가 없고, 신규 vitest 파일은 리포지토리 여러 위치(`test-stages.sh`, `packages-checks.yml`, `codebase/packages/*/package.json`, `codebase/backend/package.json`)를 읽지만 전부 읽기 전용(fs.readFileSync/readdirSync/existsSync)이며 쓰기·네트워크·환경변수·전역 상태 변경·기존 시그니처/인터페이스 변경이 전혀 없다. 유일하게 기록해 둘 만한 점은 (1) 모듈 로드/테스트 수집 시점의 즉시 fs I/O(설계된 fail-loud, `beforeAll` 미사용)와 (2) frontend 테스트가 자신의 워크스페이스 경계를 넘어 레포 루트 파일을 읽는 결합인데, 둘 다 파일 내 주석에서 의도적 트레이드오프로 명시돼 있고 실제 위험은 낮다. CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 위험도

LOW
