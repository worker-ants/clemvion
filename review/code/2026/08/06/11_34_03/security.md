# 보안(Security) Review — CI 백스톱 6R

## 발견사항

- **[CRITICAL]** `harness-checks.yml`의 `on.pull_request` 트리거 자체가 무방비 — `types`/`branches` 한 줄로 CI 백스톱 전체(831개 하네스 테스트, `WorkflowWiringTest`·`OneJudgeTest`·`VerdictComesFromTheGateTest`·`test_harness_checks_paths_coverage.py` 포함)를 영구·침묵 무력화할 수 있고, **로컬 유닛 테스트 스위트는 831/831 그대로 GREEN**이다. 실제로 mktemp 사본에서 실증했다.

  - 위치: `.github/workflows/harness-checks.yml:9-11` (`on: / pull_request: / paths:` 블록 — 이 트리거를 문서 형태로 고정하는 가드가 없다). 대조 지점(존재하는 유일한 유사 방어): `.claude/tests/test_review_gate_ci.py:471-474`(`WorkflowWiringTest.test_the_expectation_still_describes_a_gate_that_runs` 안의 `self.assertEqual(set(trigger), {"paths"}, "pull_request 에 paths 외 키가 있다…")`) — 이 한 줄은 **`review-gate.yml` 에만** 걸려 있고 `harness-checks.yml` 에는 짝이 없다.

  - 상세:

    5라운드에 걸친 배선 경화 스토리(`if:`/`continue-on-error`/discovery 패턴/`environ` 접근)는 전부 "`review-gate.yml` 자신" 또는 "`check-review-gate.py` 스크립트"를 겨냥한 우회였고, 그래서 방어도 그 두 대상에 집중됐다: `review-gate.yml` 은 `WorkflowWiringTest` 로 **문서 전체**가 정확 일치로 고정됐고, `check-review-gate.py` 는 `OneJudgeTest`/`VerdictComesFromTheGateTest` 로 import·호출·환경접근·행위가 고정됐다.

    그런데 이 모든 방어 테스트는 **`.github/workflows/harness-checks.yml` 이 트리거돼야만** CI 에서 실행된다. `harness-checks.yml` 자신의 `on.pull_request` 트리거 도형(`types`, `branches` 등 `paths` 의 형제 키)은 **어느 가드도 보지 않는다**:

    - `test_harness_checks_paths_coverage.py` 는 `paths:` **리스트의 내용**(어떤 파일이 커버되는가)만 본다 — `on.pull_request` 에 `types`/`branches` 같은 **형제 키**가 추가돼 트리거 이벤트 자체를 좁혀도 이 가드는 `paths:` 파서(`parse_paths_block`)가 `paths:` 헤더 이후 줄만 읽으므로 그 존재를 전혀 감지하지 못한다.
    - `test_workflow_yaml_structure.py` 의 전 워크플로 스캔(`test_no_guard_workflow_swallows_its_own_failure`, `test_job_conditions_are_registered`)은 **`jobs.*.continue-on-error`/`jobs.*.if`** 만 본다 — `on:` 블록은 아예 순회하지 않는다.
    - `test_review_gate_ci.py::WorkflowWiringTest` 는 `review-gate.yml` **한 파일**만 정확 일치로 고정한다. `harness-checks.yml` 에는 이런 문서-전체 고정이 없다.

    즉 `harness-checks.yml` 의 `on.pull_request:` 에 `types: [closed]` 한 줄(또는 `branches: ['없는-브랜치']`)을 추가하면:

    - GitHub Actions 는 `types` 를 명시하는 순간 기본값(`[opened, synchronize, reopened]`)을 **완전히 대체**한다 — `closed` 는 PR 이 머지/닫힌 **후**에만 발화하므로, 리뷰가 진행 중인 어떤 push 에도 이 워크플로는 트리거되지 않는다. (`branches: ['없는-브랜치']` 도 동일 효과 — 실제 base 브랜치와 절대 매치되지 않는다.) 이는 정확히 4R 에서 `review-gate.yml` 자신에 대해 실증됐던 그 우회 클래스이며, `review-gate.yml` 은 `WorkflowWiringTest` 로 이미 닫혔지만 **그 방어를 CI 로 실어 나르는 워크플로 자신에는 같은 클래스가 재발**한 것이다 — 5R 커밋 메시지가 "우회가 두 층 밖으로 이동" 이라고 적은 바로 그 패턴이 한 층 더 밖으로 이동했다.
    - `harness-checks.yml` 이 트리거되지 않으면 `WorkflowWiringTest`(`review-gate.yml` 문서 고정) · `OneJudgeTest`/`VerdictComesFromTheGateTest`(`check-review-gate.py` 판정자 단일성) · `test_harness_checks_paths_coverage.py`(paths 커버리지 자체) · 그 밖에 이 파일이 실어 나르는 826개 이상의 하네스 테스트 전부가 **그 어떤 PR 에서도 다시는 실행되지 않는다.**
    - 이후 별도(또는 같은) PR 에서 `review-gate.yml` 에 `continue-on-error: true` 를 추가하거나 `if:` 조건을 무력화해도, 그것을 잡을 유일한 검사(`WorkflowWiringTest`)가 CI 에서 다시는 안 돌므로 아무도 모른다. `review-gate.yml` 자신의 트리거(`paths: ['codebase/**', …, '.github/workflows/review-gate.yml']`)는 별개로 살아있어 "review-gate / gate" 체크 자체는 여전히 PR 에 나타나지만, `continue-on-error: true` 덕에 내부 스크립트가 exit 1 을 내도 그 체크는 **success** 로 보고된다.

  - 실증 (mktemp 사본, 워킹트리 비변경):

    ```bash
    SCRATCH=$(mktemp -d)
    git clone --local --no-hardlinks /Volumes/project/private/clemvion/.claude/worktrees/harness-review-ci-backstop-91f379 "$SCRATCH/repo"
    cd "$SCRATCH/repo"
    python3 - .github/workflows/harness-checks.yml <<'PY'
    import sys
    p = sys.argv[1]; t = open(p, encoding="utf-8").read()
    old = "on:\n  pull_request:\n    paths:\n"
    t = t.replace(old, "on:\n  pull_request:\n    types: [closed]\n    paths:\n", 1)
    open(p, "w", encoding="utf-8").write(t)
    PY
    python3 -m unittest discover -s .claude/tests -p 'test_*.py'
    ```

    출력(꼬리): `Ran 831 tests in 101.320s` / `OK` — **전부 GREEN**. `branches: ['없는-브랜치']` 로 바꿔도 관련 3개 파일(`test_harness_checks_paths_coverage.py` 26/26, `test_workflow_yaml_structure.py` 9/9, `test_review_gate_ci.py` 16/16)이 동일하게 전부 GREEN 이었다.

  - 유의(정직하게 밝힘): 이 시나리오의 실 피해 크기는 저장소에 없는 정보(GitHub 저장소의 branch protection 설정 — `harness-checks / unittest` 가 required check 인지)에 달려 있어 실제 GH Actions 러너 없이는 확정할 수 없다(프롬프트가 배제한 `Fetch base ref` 항목과 같은 종류의 한계). 두 경우 모두 나쁘다: required 가 아니면 이 PR 은 조용히 머지 가능해지고, required 면 그 체크가 영원히 "Expected — waiting for status" 로 멎어 admin 이 override 를 학습하게 만든다(그 자체가 별도의 운영 리스크). 어느 쪽이든 **로컬 스위트가 831/831 GREEN 을 낸다는 사실은 변하지 않는다** — 이것이 이번 라운드가 찾아야 했던 "판정이 아니라 트리거" 층의 실제 사례다.

  - 제안: `test_review_gate_ci.py::WorkflowWiringTest.test_the_expectation_still_describes_a_gate_that_runs` 가 이미 `review-gate.yml` 에 걸어 둔 바로 그 불변식 —
    `self.assertEqual(set(trigger), {"paths"}, "pull_request 에 paths 외 키가 있다 — 트리거 범위가 좁혀졌다")`
    — 을 `harness-checks.yml` 에도 똑같이 건다(`test_harness_checks_paths_coverage.py` 또는 `test_workflow_yaml_structure.py` 어느 쪽이든, `on.pull_request` 의 키 집합이 `{"paths"}` 뿐인지 전 워크플로에 대해 등재제로 검사하는 편이 재발을 한 번 더 막는다 — `e2e.yml` 은 의도적으로 `paths-ignore` 를 쓰므로 블랭킷 금지가 아니라 워크플로별 허용 키 등재가 맞다). `harness-checks.yml` 은 이 저장소의 831개 하네스 테스트 전부의 유일한 CI 진입점이므로, 이 트리거 도형이야말로 `review-gate.yml` 자신보다 먼저 고정됐어야 하는 자리다.

- **[INFO]** (검증된 방어 — 참고용) `harness-checks.yml` 의 `.github/workflows/**` 필터를 제거·치환하는 시도 두 가지는 **현재 실제로 막힌다**. (1) 넓은 필터를 개별 파일 나열로 바꾸면 `test_harness_checks_paths_coverage.py::test_each_historical_leak_is_load_bearing` 이 "removing '.github/workflows/**' left .github/workflows/e2e.yml covered by another filter" 로 실패한다(그 픽스처가 "`e2e.yml` 은 오직 그 한 필터로만 커버돼야 한다"를 암묵적으로 강제하기 때문). (2) `- '!.github/workflows/review-gate.yml'` 같은 GH Actions 부정 패턴을 끼워 넣는 시도는 `test_no_filter_is_dead` 가 "그 패턴이 어떤 추적 파일도 매치하지 않는다"며 dead-filter 로 잡는다(로컬 파서가 `!` 부정 문법을 모르는 채로 문자 그대로 매치를 시도하기 때문 — 우연이지만 결과적으로 안전). 두 시도 모두 mktemp 사본에서 직접 돌려 실패를 확인했다. 다만 이 두 방어는 **의도적으로 설계된 것이 아니라 다른 목적의 픽스처·파서 한계의 부산물**이므로, 향후 그 픽스처(예: `KNOWN_COVERAGE_DEPENDENCIES` 재구성)나 파서가 바뀌면 조용히 사라질 수 있다 — 위 CRITICAL 항목처럼 명시적 불변식으로 옮겨두는 편이 안전하다.

- **[WARNING]** 리뷰 세션 도중 실제 워킹트리 HEAD 가 이동했다 — 이 프롬프트가 검토 대상으로 준 스냅샷과 지금 저장소 상태가 다르다.

  - 위치: 저장소 루트 `git log -1`
  - 상세: 이 리뷰를 시작한 시점의 `git status`/`git diff HEAD` 는 `.claude/tests/test_review_gate_ci.py` 에 **미커밋 diff**(새 클래스 `ReviewArtifactsStayTrackedTest` 57줄 추가, HEAD=`8ce96e72b`)로 나타났다. 잠시 후 재확인하니 그 diff 가 **새 커밋으로 흡수**돼 있었다(HEAD=`e46f5382c fix(harness): 이 백스톱이 서 있는 전제를 가드 — review/** 가 추적된다는 사실`) — 즉 나 아닌 다른 프로세스(오케스트레이터/개발자 에이전트)가 리뷰 도중 커밋을 만들었다. 이 새 커밋이 추가한 `ReviewArtifactsStayTrackedTest`(`.gitignore` 가 `review/**` 를 제외하지 않는지, 커밋된 트리가 실제로 리뷰 산출물을 담고 있는지 검증)는 **이 프롬프트 번들에 전혀 포함돼 있지 않다** — 즉 지금 저장소에는 이 리뷰가 못 본 새 코드가 이미 들어와 있다. 코드 자체는 훑어본 바 건전해 보이지만(백스톱이 서는 전제 — 리뷰 산출물이 실제로 추적됨 — 를 지키는 합리적인 테스트), 이 드리프트 자체가 "라운드 2-4의 워킹트리 변이" 와 같은 클래스의 재발이라 별도 항목으로 남긴다. 워킹트리를 직접 고치지는 않았다.
  - 제안: 이 리뷰 라운드를 마무리하기 전에, 이번에 반영된 새 커밋(`e46f5382c`)이 이 프롬프트 번들 생성 이후의 변경인지 오케스트레이터 쪽에서 확인하고, 필요하면 번들을 재생성해 다음 리뷰 라운드에 포함시킬 것.

## 요약

라운드 1-5 는 `review-gate.yml`(문서 전체 정확 일치)과 `check-review-gate.py`(AST 허용목록 + 행위 테스트)를 성공적으로 경화했고, 이번 라운드에서 시도한 그 두 표면에 대한 재우회(넓은 필터 치환, GH 부정 패턴 삽입)는 모두 기존 가드에 막혔다 — 그 자체로는 견고하다. 그러나 "다음 층 밖"은 정확히 프롬프트의 CONTEXT 가 예고한 자리, 즉 **판정이 아니라 트리거**였다: 이 모든 방어 테스트를 CI 에 실어 나르는 `harness-checks.yml` 자신의 `on.pull_request` 트리거 도형은 어떤 가드도 지키지 않고 있었다. `types: [closed]` 또는 `branches: ['없는-브랜치']` 한 줄이면 하네스 스위트 831개 테스트 전부가 로컬에서는 여전히 GREEN 인 채로 CI 에서 영구히 실행되지 않게 되고, 그 상태에서 `review-gate.yml` 을 자유롭게 무력화해도 그것을 잡을 유일한 테스트가 다시는 돌지 않는다 — mktemp 사본에서 두 변형 모두 실측했다(831/831 OK). 이는 4R 에서 `review-gate.yml` 자신에 대해 발견·차단됐던 정확히 같은 결함 클래스가, 그 방어를 실어 나르는 워크플로 한 층 밖에서 재발한 것이다. 부수적으로, 리뷰 도중 워킹트리 HEAD 가 이동해 이 번들에 없는 커밋이 이미 저장소에 들어와 있음을 확인했다(코드 자체는 무해해 보이나 프로세스 드리프트로 별도 기록).

## 위험도

CRITICAL
