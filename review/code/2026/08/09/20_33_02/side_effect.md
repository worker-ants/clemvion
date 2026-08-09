# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `_changed-paths.yml` 은 3개의 기존 소비자(`backend-checks.yml`, `deps-security-checks.yml`, `frontend-checks.yml` — 이번 PR diff 밖)와 5개의 신규 소비자가 공유하는 reusable workflow다. 이번 PR 이 그 `run:` 블록에 `#`-접두 줄 drop 로직(`case "$spec" in '#'*) continue ;;`)을 추가했는데, 이는 diff 에 없는 3개 워크플로의 런타임 판정에도 즉시 영향을 준다.
  - 위치: `.github/workflows/_changed-paths.yml:105-108` (전체 파일 컨텍스트 게이트 기준)
  - 상세: 실측 결과 기존 3개 워크플로의 `pathspecs:` 블록에는 `#`-접두 줄이 없어(위 3개 파일을 직접 grep 확인) 이번 변경으로 인한 실제 동작 차이는 없다. 다만 공유 reusable workflow 수정이 diff 목록에 없는 파일들의 런타임을 조용히 바꿀 수 있는 구조라는 점 자체는 인지해 둘 필요가 있다 — 이 PR 이 정확히 막으려는 "가드-런타임 drift" 클래스와 대칭적인 표면(런타임 변경이 저 멀리 있는 소비자에 조용히 번짐)이다.
  - 제안: 조치 불필요(현재는 무해). 향후 `_changed-paths.yml` 파싱 규칙을 또 바꿀 때는 8개 소비자 전원의 `pathspecs:` 내용을 재확인하는 절차를 관례화할 것.

- **[INFO]** `paths:` 필터 제거로 `harness-checks.yml` / `migration-check.yml` / `packages-checks.yml` / `spec-link-checks.yml` / `web-chat-checks.yml` 5개 워크플로가 이제 **모든 PR** 에서 `changes` 잡(풀 `checkout` `fetch-depth: 0` 포함 — outbound network 호출)을 always 실행한다. 종전에는 무관한 PR 에 대해 워크플로 자체가 트리거되지 않았다.
  - 위치: 각 워크플로의 `on: pull_request:` 섹션(예: `.github/workflows/harness-checks.yml`, `.github/workflows/migration-check.yml` 등, 전체 파일 컨텍스트 게이트 기준 각 파일 상단)
  - 상세: required status check 데드락을 풀기 위한 의도된 설계(§`#1106` 패턴)이고 PR·plan 문서에 명시적으로 기록돼 있다. side-effect 관점에서 언급하는 이유는 "네트워크 호출"이 실질적으로 늘어나는 지점(체크아웃 8건 → 무관 PR 에서도 항상 실행)이기 때문이며, 버그가 아니라 트레이드오프임을 확인차 기록한다.
  - 제안: 조치 불필요. 기존 3개 워크플로에서 이미 채택된 패턴의 확장이라 신규 리스크는 아니다.

- **[INFO]** `.claude/tests/test_harness_checks_paths_coverage.py` 의 `parse_paths_block`/`_yaml_scalar` 가 `parse_pathspecs_block` 로 대체(삭제+신설)됐다. 함수 시그니처·파싱 규칙이 완전히 바뀌었다(YAML 리스트 파싱 → 블록 스칼라 파싱, 따옴표 처리 제거).
  - 위치: `.claude/tests/test_harness_checks_paths_coverage.py` (`parse_pathspecs_block` 함수 정의부, 전체 파일 컨텍스트 미실림 — 함수명으로 식별)
  - 상세: grep 으로 확인한 결과 이 함수들은 해당 테스트 모듈 내부 전용이며 다른 파일에서 import 되지 않는다(`.claude/tests/test_e2e_exemption_paths_sync.py` 가 동명의 `_yaml_scalar` 를 갖고 있지만 독립적으로 정의된 별도 사본이라 영향 없음). 외부 호출자 영향 없음.
  - 제안: 조치 불필요.

- **[INFO]** `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts` 에 `blockScalarAtPath` 가 신규 export 되고, 기존 `listAtPath` 는 시그니처·구현 변경 없이 JSDoc 예시만 갱신됐다(순수 추가).
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:248-287` (unified diff 게이트 기준)
  - 상세: `internal-package-registration.test.ts` 안에 남아있는 `listAtPath(yml, ["on", "pull_request", "paths"])` 호출들은 실제 `packages-checks.yml` 을 읽는 게 아니라 그 describe 블록 로컬의 합성(fixture) `yml` 상수를 대상으로 하므로, 실제 파일에서 `paths:` 가 제거된 것과 무관하게 계속 통과한다. 공개 인터페이스 파괴 없음.
  - 제안: 조치 불필요.

- **[INFO]** 4곳(런타임 bash `case`, `test_required_check_skip_jobs.py::parse_pathspecs`, `test_harness_checks_paths_coverage.py::parse_pathspecs_block`, `blockScalarAtPath`)이 "줄 시작 `#`만 주석" 규칙을 각각 독립 구현한다. 코드 중복이지만 side-effect 관점에서는 각 사본이 규칙적으로 정렬돼 있는지가 중요한데, 4곳 모두 `line-initial '#'` 기준으로 일치함을 grep 으로 확인했다. drift 없음.
  - 위치: `.github/workflows/_changed-paths.yml:107`, `.claude/tests/test_required_check_skip_jobs.py:91`, `.claude/tests/test_harness_checks_paths_coverage.py:167`, `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts` (`blockScalarAtPath` 본문)
  - 상세: 향후 이 중 한 곳만 고쳐지면 "가드는 통과하는데 런타임은 다르게 판정" 클래스가 재발한다 — 이는 이미 PR 문서(`plan/in-progress/ci-required-check-skip-jobs.md`)가 명시적으로 경고하고 테스트로 고정해 둔 리스크라 새로 지적할 결함은 아니다.
  - 제안: 조치 불필요(기록 목적).

- **[INFO]** `plan/in-progress/ci-required-check-skip-jobs.md` 체크박스 5건이 `[ ]` → `[x]` 로 전환됐고 새 섹션("나머지 5개 전환")이 추가됐다. 코드가 아닌 plan 문서 갱신으로, 실행에는 영향 없다.
  - 위치: `plan/in-progress/ci-required-check-skip-jobs.md:179-183` (unified diff 게이트 기준)
  - 상세/제안: 해당 없음(부작용 아님).

## 요약

이번 변경은 CI YAML(`_changed-paths.yml` 공유 reusable workflow + 5개 호출부)과 그에 대응하는 하네스/프론트엔드 가드 테스트를 함께 갱신한 인프라 전환이다. 전역 상태·파일시스템·환경변수·공개 런타임 API 관점에서 새로 도입된 위험한 부작용은 발견되지 않았다 — 함수 rename(`parse_paths_block`→`parse_pathspecs_block`, `_yaml_scalar` 삭제)은 해당 테스트 모듈 내부로 스코프가 닫혀 있고, 신규 export(`blockScalarAtPath`)는 순수 추가이며, 공유 워크플로(`_changed-paths.yml`) 수정은 실측상 기존 3개 소비자의 동작을 바꾸지 않는다. 유일하게 실질적인 부작용은 `paths:` 필터 제거로 5개 워크플로의 `changes` 잡(네트워크 체크아웃 포함)이 이제 모든 PR 에서 항상 실행된다는 점인데, 이는 required-check 데드락 해소를 위해 의도적으로 설계·문서화된 트레이드오프이며 기존 3개 워크플로에서 이미 검증된 패턴의 반복 적용이라 신규 리스크로 보지 않는다.

## 위험도

NONE
