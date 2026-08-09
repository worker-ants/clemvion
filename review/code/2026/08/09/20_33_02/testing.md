# 테스트(Testing) 리뷰 — CI skip-job 패턴 나머지 5개 워크플로 전환

## 발견사항

- **[WARNING]** 새로 전환된 4개 워크플로(harness-checks 제외)의 `pathspecs` 목록에 "죽은 필터(dead
  filter)" 검증이 없다.
  - 위치: `.claude/tests/test_required_check_skip_jobs.py` (누락 — `pathspecs_of()` 헬퍼가 이미
    `CONVERTED` 전 워크플로를 순회하므로 확장이 저비용이다)
  - 상세: `harness-checks.yml` 은 `test_harness_checks_paths_coverage.py::PathsCoverageTest
    .test_no_filter_is_dead` 로 "모든 pathspec 항목이 최소 하나의 tracked 파일과 매치해야 한다"
    를 검증한다. 하지만 이번에 함께 전환된 `migration-check.yml`·`packages-checks.yml`·
    `spec-link-checks.yml`·`web-chat-checks.yml` 4곳의 `changes.with.pathspecs` 목록에는 대응하는
    검증이 없다. 오탈자나 디렉터리 개명 후 잔존 항목이 들어가도(예: `codebase/packages/foo-bar/**`
    가 실제로는 `foo_bar` 로 개명됨) 아무 테스트도 잡지 못한다 — README/plan 문서가 반복해서
    강조하는 "손 목록은 안 지켜지고 테스트만 지킨다" 원칙이 이 4곳에는 아직 적용되지 않았다.
  - 제안: `test_required_check_skip_jobs.py` 에 `_tracked_files()` 류 헬퍼(또는
    `test_harness_checks_paths_coverage.py` 의 `filter_covers_file`/`_tracked_files` 재사용)를
    더해 `CONVERTED` 전체에 대해 "각 pathspec 이 최소 하나의 tracked 파일과 매치" 를 일반화하는
    테스트를 추가할 것.

- **[WARNING]** 워크플로 자기 자신의 경로가 자신의 `pathspecs` 에 등재돼 있는지 강제하는 테스트가
  없다 (harness-checks.yml 제외).
  - 위치: `.claude/tests/test_required_check_skip_jobs.py:296` (`test_converted_workflows_pass_the_script_its_own_path`)
  - 상세: 이 테스트는 `scripts/ci-paths-changed.sh` 와 `.github/workflows/_changed-paths.yml` 두
    항목만 강제한다. 반면 워크플로 자신의 파일 경로(예: `.github/workflows/migration-check.yml`)
    가 자기 pathspecs 안에 있는지는 어떤 테스트도 보지 않는다. `harness-checks.yml` 은 광역
    `.github/workflows/**` glob 이 우연히 이를 커버하지만, `migration-check.yml`·
    `packages-checks.yml`·`spec-link-checks.yml`·`web-chat-checks.yml` 4곳은 각자 개별 한 줄
    (`.github/workflows/<self>.yml`)로만 자기 자신을 커버하며, 이 줄은 손으로 추가된 것이고
    지우는 것을 막는 회귀 가드가 없다. 이 클래스(파일 스스로를 단독 수정하면 자신을 지키는
    가드가 안 도는 것)는 이 PR 의 plan/README 가 "6번 겪은 갭" 으로 명명하는 바로 그 실패
    패턴이며, `_changed-paths.yml` 자신에 대해서는 이미 이름으로 강제하면서 정작 호출부
    워크플로 자기 자신에 대해서는 강제가 빠져 있다.
  - 제안: `test_converted_workflows_pass_the_script_its_own_path` (또는 별도 테스트)에
    `f".github/workflows/{name}"` 이 `specs` 에 있거나 `.github/workflows/**` 같은 상위 glob 으로
    커버됨을 단언하는 분기를 추가.

- **[INFO]** `push.paths` 회귀에 대한 대칭 가드가 없다.
  - 위치: `.claude/tests/test_required_check_skip_jobs.py:149` (`test_pull_request_has_no_paths_filter`)
  - 상세: 이 테스트는 `on.pull_request.paths` 가 되살아나는 것만 막는다. `push:` 트리거를 그대로
    유지한 3개 워크플로(`packages-checks.yml`·`web-chat-checks.yml`·`spec-link-checks.yml`)는
    `on.push.paths` 도 이번에 제거됐지만, 그것이 되살아나는 것을 막는 대칭 테스트는 없다. required
    check 데드락 자체는 PR 트리거에만 해당하므로 심각도는 낮지만, 되살아나면 "항상 실행 +
    changes 잡이 판단" 이라는 설계 계약이 push 이벤트에서만 조용히 깨진다.
  - 제안: 같은 테스트(또는 짝 테스트)에서 `on.push.paths` 부재도 함께 단언.

- **[INFO]** `blockScalarAtPath`(신설 TS 파서)가 재사용하는 `blockRange` 헬퍼는 `isSkippable`
  (빈 줄·`#`-시작 줄)을 들여쓰기 검사보다 우선 적용해, **블록 본문보다 얕게 들여쓴 주석/빈
  줄**을 만나도 종료 조건으로 보지 않고 계속 스캔한다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:230-235`
    (`blockRange`), 소비처 `blockScalarAtPath:263-285`
  - 상세: 현재 fixture(`internal-package-registration.test.ts:367-418`)들은 모두 "정상 들여쓰기의
    주석/빈 줄" 만 다루고, "블록 본문보다 얕게 들여쓴 주석 뒤에 다시 깊게 들여쓴 줄이 오는" 병리적
    입력은 다루지 않는다. 현재는 `blockScalarAtPath` 자체가 그런 줄도 `#`-시작이면 항목 추출
    단계에서 다시 걸러내므로 실사용에서 잘못된 값이 나오진 않지만, 경계 자체가 테스트로 고정돼
    있지 않다. `listAtPath` 가 공유하는 기존 헬퍼라 이번 PR 이 새로 만든 위험은 아니고, 실제
    `packages-checks.yml` 류 YAML 형태에서 발생할 가능성도 낮아 우선순위는 낮다.
  - 제안: 필요시 `blockRange` 에 "얕게 들여쓴 non-key 줄(주석 포함)도 종료로 본다" 는 회귀
    fixture 하나를 추가해 명시적으로 경계를 고정.

## 요약

이번 PR 은 CI skip-job 패턴을 5개 워크플로에 기계적으로 확장하면서, 파싱 로직이 bash/Python
(2곳)/TypeScript 4곳에 흩어지는 구조를 낳았음에도 각 계층을 독립적으로(경계 fixture +
`harness-checks.yml`/`packages-checks.yml` 실제 파일 대조 + 실제 bash 서브프로세스 실행) 촘촘히
테스트했다. `test_workflow_yaml_structure.py`/`test_required_check_skip_jobs.py` 의 "등록부가
서로 어긋나면 fail" 양방향 대조, `_MIN_FILTERS`/`_MIN_TARGETS` vacuity 바닥, plan 문서에 기록된
13/13 뮤테이션 RED 등 회귀 방지 설계 수준이 높다. 다만 harness-checks.yml 전용으로 존재하던 두
가지 보호(죽은 pathspec 검출, 워크플로 자기참조 강제)가 이번에 함께 전환된 나머지 4개 워크플로에는
아직 일반화되지 않아 대칭성 갭이 남아 있다 — 둘 다 기존 헬퍼로 저비용 확장이 가능하고, 정확히 이
PR 이 반복해서 명명하는 "손 목록은 새고 테스트만 지킨다" 클래스이므로 후속으로 닫아 두는 편이
일관적이다. Critical 수준의 결함은 발견되지 않았다.

## 위험도

LOW
