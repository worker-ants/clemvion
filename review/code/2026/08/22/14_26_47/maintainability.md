# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `REPO_GUARDS_MUST_COVER` 스택 목록이 손으로 나열된 하드코딩 튜플이다
  - 위치: `.claude/tests/test_required_check_skip_jobs.py:178` (`DeadFilterTest.REPO_GUARDS_MUST_COVER`)
  - 상세: `("codebase/backend/", "codebase/frontend/", "codebase/packages/", "codebase/channel-web-chat/")` 4개 스택 경로를 손으로 나열했다. 같은 PR 이 삭제한 `masked-marker-mirror-guard.ts::resolveScanDirs` 의 주석은 "손으로 나열하면 그 목록 자체가 미러가 된다"·"파생으로 바꾸지 않으면 전수처럼 보이지만 아닌 목록이 된다"는 원칙을 명시적으로 세워 놓았는데, 이 새 테스트는 그 원칙과 반대 방향(손 목록)으로 간다. 다만 위험은 낮다 — `repo-guards.yml` 의 실제 pathspec 은 와일드카드(`codebase/**`)라 새 스택이 생겨도 *동작*은 자동으로 커버되고, `REPO_GUARDS_MUST_COVER` 가 갱신되지 않아도 실패(false positive)로 이어지지 않는다. 다만 신규 스택이 생겼을 때 이 회귀 테스트가 그 스택까지 자동으로 검증 범위를 넓히지는 못한다는(조용히 좁은 채로 남는) 잔여 갭은 있다. 같은 파일의 기존 `CONVERTED`/`DEAD_FILTER_EXCEPTIONS` 도 동일하게 "손 목록 + 근거 주석" 패턴을 쓰고 있어(`CONVERTED` 주석: "목록이 곧 계약이다") 이 파일 안에서는 일관된 관례이기도 하다.
  - 제안: 지금 당장 조치는 불요. 다만 `codebase/` 밑에 새 스택 디렉터리가 추가되는 시점에 이 튜플도 함께 갱신해야 한다는 점을, `resolveScanDirs` 의 주석처럼 한 줄로 남겨두면(예: "신규 codebase/<stack> 추가 시 여기도 추가할 것") 향후 드리프트를 줄일 수 있다.

- **[INFO]** `repo-guards.yml` 워크플로 파일명이 기존 `<영역>-checks.yml` 명명 규약에서 벗어남
  - 위치: `.github/workflows/repo-guards.yml` (파일 전체 — job 명 `mirror-guard`, 워크플로 명 `repo-guards`)
  - 상세: `frontend-checks.yml`·`backend-checks.yml`·`packages-checks.yml`·`web-chat-checks.yml`·`spec-link-checks.yml` 등 기존 워크플로는 전부 `<영역>-checks.yml` 패턴을 따르는데 이 파일만 `repo-guards.yml` 이다. `migration-check.yml` 이라는 선례가 있어 완전히 고립된 예외는 아니고, 이전 라운드(`14_02_49`) 리뷰에서 이미 INFO 로 지적되어 "강제 조치 불요"로 처분된 항목이다. 재확인 목적으로만 기록한다.
  - 제안: 조치 불요 (이미 처분됨). 통일을 원하면 `repo-guards-checks.yml` 개명을 후속 항목으로 남겨도 된다.

## 요약

이번 라운드 diff 는 전반적으로 유지보수성 측면에서 우수하다. 핵심 변경(신규 `.github/workflows/repo-guards.yml`, `masked-marker-mirror-guard.ts`/`.test.ts` 헤더 갱신, backend 사본 2파일 삭제, 신규 회귀 테스트 `test_repo_guards_pathspec_covers_every_stack`)은 함수 길이·중첩 깊이·순환 복잡도 모두 낮고, 매직 넘버 없이 상수·주석으로 근거를 남기며, 기존 `test_workflow_yaml_structure.py`/`test_required_check_skip_jobs.py` 의 레지스트리 등재 패턴(알파벳 순서 유지 등)을 정확히 따른다. 특히 backend·frontend 두 사본(각 ~160줄)의 문자 그대로 중복을 제거하고 그 원인(CI 경로 게이팅)을 CI 잡 신설로 없앤 설계는 순수한 유지보수성 개선이다. 유일하게 짚을 점은 신규 테스트의 `REPO_GUARDS_MUST_COVER` 가 이 PR 스스로 다른 곳에서 경계하는 "손 유지 목록" 패턴을 다시 쓴다는 것인데, 기존 파일 관례(`CONVERTED`, `DEAD_FILTER_EXCEPTIONS`)와 일관되고 실패 방향이 안전(fail-open 이 아니라 커버리지 검증 범위가 좁아지는 정도)이라 심각도는 낮다.

## 위험도
NONE
