### 발견사항

- **[INFO]** 신규 CI 잡(`repo-guards.yml`)이 `paths:` 필터 없이 모든 PR·`push: main` 이벤트에 항상 launch 된다
  - 위치: `.github/workflows/repo-guards.yml:28`-`31` (`on: pull_request: / push: branches: [main]`, 게이트)
  - 상세: `codebase/**`-무관 PR(예: `spec/`·`plan/` 전용 변경)에서도 `changes` 잡과 `mirror-guard` 잡이 항상 launch 되고, `relevant == 'false'` 일 때만 no-op echo 로 조기 종료한다. 이는 "required status check 등록을 위해 `paths:` 를 의도적으로 비운다" 는 저장소 공용 패턴(`CONVERTED` 목록의 다른 8개 워크플로와 동일 메커니즘, `test_pull_request_has_no_paths_filter`/`test_push_has_no_paths_filter_either` 가 강제)과 일치하며 이번 diff 가 새로 만든 예외적 부작용은 아니다. `mirror-guard` 잡은 `needs.changes.outputs.relevant != 'false'` 로 게이팅되므로 무관한 PR 에서는 실제 vitest 실행(외부 이벤트)까지 가지 않는다.
  - 제안: 조치 불요 — 기존 컨벤션 준수, 하네스가 강제.

- **[INFO]** 동일 vitest spec(`masked-marker-mirror.test.ts`)이 frontend-touching PR 에서 두 워크플로(`frontend-checks.yml` 의 전체 vitest 스위트, `repo-guards.yml` 의 `mirror-guard` 전용 실행)에서 중복 실행된다
  - 위치: `.github/workflows/repo-guards.yml:21`-`23`(헤더 주석, 명시적 수용 서술), `:82`-`86`(`mirror-guard` 의 vitest 스텝)
  - 상세: 새로 추가된 반복 CI 이벤트다 — "로컬 `run-test.sh unit` 이 별도 배선 없이 가드를 돌리게 하려는" 목적으로 헤더 주석에 명문화돼 있고 `plan/in-progress/mirror-guard-single-copy.md` §작업에도 동일 근거가 기록돼 있어 미문서화된 부작용은 아니다. 비용은 수 초 수준(단일 vitest 파일)이라 실질적 리스크는 낮다.
  - 제안: 조치 불요(문서화된 트레이드오프). 향후 두 번째 "저장소 전체 스캔" 가드가 이 워크플로에 추가되면 중복 실행 비용이 선형으로 누적되므로, 그 시점에 `frontend-checks.yml` 쪽 중복 실행을 재검토할 가치는 있다.

- **[INFO]** backend 사본 삭제로 export 표면(`SOT_DIR`·`SOT_SYMBOLS`·`resolveScanDirs`·`listSourceFiles`·`findRedeclaredSymbols`·`findMirrorRedeclarations`·`MirrorRedeclaration`)이 완전히 제거되는 인터페이스 변경 — 잔존 소비처 없음을 직접 재확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts`(전체 삭제), `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts`(전체 삭제)
  - 상세: 이 워크트리에서 직접 `grep -rln "masked-marker-mirror-guard\|masked-marker-mirror\.spec"` 을 재실행해 확인한 결과, 남은 매치는 과거 `review/code/**` 산출물(메타데이터, 소스 아님)과 `codebase/frontend/.../masked-marker-mirror.test.ts:14` 의 로컬 frontend import(`from "./masked-marker-mirror-guard"`, backend 파일이 아님) 뿐이다. backend 트리 어디에서도 이 삭제된 두 파일을 가리키는 import·경로 문자열이 남지 않았고, `codebase/backend/src/repo-guards/__tests__/` 디렉터리에는 삭제 후에도 다른 가드 파일이 남아 있어 backend jest 스위트가 빈 디렉터리로 실패하지도 않는다. 시그니처/인터페이스 파손 없음.
  - 제안: 조치 불요 — 확인 목적의 기록.

- **[INFO]** 하네스 레지스트리 4곳(`_JOB_CONDITIONS`류 dict·`_SKIP_JOB_WORKFLOWS`·`_PULL_REQUEST_KEYS`·`_PERMISSIONS`)이 `repo-guards.yml` 실제 선언과 line-level 로 정확히 일치함을 재확인 — 드리프트 없음
  - 위치: `.claude/tests/test_workflow_yaml_structure.py:260`(`mirror-guard` job 조건 `!cancelled()`), `:294`(`_SKIP_JOB_WORKFLOWS`), `:365`(`_PULL_REQUEST_KEYS`, bare `pull_request` 등재), `:418`(`_PERMISSIONS: {"contents": "read"}`)
  - 상세: 이 워크트리에서 직접 `grep -n "repo-guards.yml"` 로 4개 등록 지점을 재확인했고, 각각이 `.github/workflows/repo-guards.yml` 의 실제 `if: ${{ !cancelled() }}`, bare `pull_request:`, `permissions: contents: read` 와 일치한다. 등록 누락이 있었다면 이 조합을 상호 강제하는 하네스 테스트(`test_the_two_registries_agree` 류)가 이미 RED 였을 것이다.
  - 제안: 조치 불요.

- **[INFO]** 신규 테스트(`test_repo_guards_pathspec_covers_every_stack`)와 그 소비 헬퍼(`test_harness_checks_paths_coverage._tracked_files`)는 `git ls-files` subprocess 호출과 순수 문자열 매칭만 수행 — 파일시스템 쓰기·환경변수 접근·네트워크 호출 없음
  - 위치: `.claude/tests/test_required_check_skip_jobs.py:185`-`208`(`test_repo_guards_pathspec_covers_every_stack`), `.claude/tests/test_harness_checks_paths_coverage.py:281`-`286`(`_tracked_files`)
  - 상세: `_tracked_files()` 는 `subprocess.run(["git", "ls-files"], cwd=REPO_ROOT, capture_output=True, ...)` 로 읽기 전용이고, `filter_covers_file`/`pathspecs_of` 도 문자열 파싱뿐이라 부작용이 없다. 기존 다른 하네스 테스트(캐너리류)가 쓰는 `tempfile`/`fs.mkdtempSync` 임시 디렉터리 패턴과 달리 이 신규 테스트는 실제 저장소 파일을 읽기만 하고 아무 것도 쓰지 않는다.
  - 제안: 조치 불요.

## 이전 라운드(`14_02_49`) WARNING #1 재확인 — 부작용 관점에서 재발 없음

`.github/workflows/frontend-checks.yml` 에서 `codebase/channel-web-chat/**` pathspec 을 지웠다가(근거를 미러 가드 단일 소비처로만 판단) `typescript-toolchain-guard` 소비처 누락이 지적되어 되돌린 이력이 있다. 이 워크트리에서 현재 파일을 직접 열어 확인한 결과 `codebase/channel-web-chat/**` 줄(게이트 54번째)이 실제로 유지돼 있고, 근거 주석만 "미러 가드" → "typescript-toolchain" 로 교체됐다 — pathspec 자체가 다시 지워지는 회귀는 없다.

### 요약

이번 diff 의 실질 변경은 (1) `codebase/**` 전체를 스캔하는 신규 상시 CI 워크플로(`repo-guards.yml`) 도입, (2) backend 미러 가드 사본 2파일(export 표면 포함) 삭제, (3) `frontend-checks.yml` pathspec 근거 주석 교체(pathspec 라인 자체는 무변경), (4) 하네스 레지스트리 4곳·CONVERTED 목록 갱신, (5) 신규 하네스 회귀 테스트 1건 추가다. 신규 워크플로는 파일시스템·환경변수를 건드리지 않고 `git ls-files`/CI 잡 트리거라는 읽기 전용·선언적 부작용만 만들며, 그 트리거 확장(모든 codebase PR 에서 상시 실행, frontend PR 에서 중복 실행)은 워크플로 헤더·plan 문서 양쪽에 명시적으로 문서화된 의도된 부작용이다. backend export 삭제는 이 워크트리에서 직접 재확인한 결과 잔존 참조가 없어 시그니처/인터페이스 파손이 없고, 하네스 레지스트리 4곳도 실제 워크플로 선언과 line-level 로 일치해 드리프트가 없다. 이전 라운드에서 지적됐던 "단일 소비처만 보고 pathspec 을 지운" WARNING 은 되돌려져 재발하지 않았음을 직접 확인했다. Critical/Warning 급 부작용은 발견되지 않았다.

### 위험도
LOW
