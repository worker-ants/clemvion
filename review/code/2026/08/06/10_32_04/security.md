# 보안(Security) Review — round 4: CI 백스톱 우회 가능성 실증

## 방법

작업지시에 따라 실제 저장소 워크트리는 건드리지 않았다. `mktemp -d` 로 만든 격리 디렉터리에
`rsync -a --exclude='.git' --exclude='node_modules' --exclude='review/code'` 로 저장소를 복사하고,
그 복사본 안에서만 `git init && git add -A && git commit`(테스트가 요구하는 `git ls-files` 등을
동작시키기 위함) 후 절대경로로 mutation 을 가하고 `python3 -m unittest discover -s .claude/tests
-p 'test_*.py'` (관련 파일은 개별 지정)를 그 복사본 안에서 돌렸다. 원 워크트리의 `git status`는
작업 전후 동일함을 확인했다 (`?? review/code/2026/08/06/` 만 남음 — 이 리포트 자신).

`test_review_gate_ci.py` / `test_workflow_yaml_structure.py` /
`test_harness_checks_paths_coverage.py` / `test_block_integrity.py` /
`test_stop_guard_failopen.py` 가 `review-gate.yml` 을 직간접으로 다루는 유일한 스위트임을
`grep -rln "review-gate.yml\|continue-on-error" .claude/tests/` 로 먼저 확인했다 — 이 다섯 개 밖의
파일은 애초에 이 워크플로를 보지 않으므로 mutation 과 무관하다.

## 발견사항

### [CRITICAL] `WorkflowWiringTest` 의 "실패를 삼키지 못하게" 검사가 **step 딕셔너리에만** 적용되고 **job 딕셔너리**는 보지 않는다 — `continue-on-error: true` 를 job 레벨에 두면 전 테스트가 GREEN인 채로 게이트 실패가 통째로 무력화된다

- 위치:
  - `.claude/tests/test_review_gate_ci.py:404-405` (`self.on = ...` / `self.job = self.doc["jobs"]["gate"]`)
  - `.claude/tests/test_review_gate_ci.py:423,425,434` (`_NEUTERING_KEYS`, `test_the_gate_step_cannot_be_skipped_or_have_its_failure_swallowed`)
  - `.github/workflows/review-gate.yml:44-51` (`jobs.gate` — `runs-on`/`if` 형제 위치)
- 상세:
  라운드 3에서 이미 한 번 뚫렸던 구멍(`continue-on-error: true`를 게이트 **step** 에 붙이면 실패가
  삼켜지는데도 전 스위트가 GREEN)을 라운드 4가 `_NEUTERING_KEYS = ("if", "continue-on-error",
  "timeout-minutes")` 로 막았다. 그런데 이 검사는
  `step = self.steps[self._gate_step_index()]` 하나만 대상으로 하고(425번째 줄 함수, 434번째 줄
  루프), `self.job`(405번째 줄에서 이미 별도로 잡아 두고도) 은 어느 테스트에서도 순회되지 않는다.
  GitHub Actions 는 `jobs.<job_id>.continue-on-error` 를 **job 레벨**에서도 지원하며, 공식 문서
  문구 자체가 step 레벨("job 을 통과시킨다")과 대구를 이룬다("workflow run 을 통과시킨다") — 즉
  job 에 있는 스텝이 실패해도 그 **job 의 체크런 자체가 통과로 보고**된다(matrix 의
  `continue-on-error: ${{ matrix.experimental }}` 로 널리 쓰이는 바로 그 동작). PR 브랜치
  보호(Required status checks)는 워크플로 실행 전체가 아니라 개별 job(체크런)을 기준으로 판정하는
  것이 일반적이므로, `jobs.gate.continue-on-error: true` 하나만 추가하면 `check-review-gate.py
  --enforce` 가 exit 1 을 내더라도 그 사실이 **PR 을 막지 못한다** — 정확히 라운드 3이 막으려던
  결과가, step 대신 job 이라는 한 단계 위에서 재현된다.

  자기 사각지대 실증 (원 저장소는 건드리지 않고 격리 복사본에서 수행):
  ```
  $ python3 - "$REPO/.github/workflows/review-gate.yml" <<'EOF'
  ... "  gate:\n    runs-on: ubuntu-latest\n" 를
      "  gate:\n    runs-on: ubuntu-latest\n    continue-on-error: true\n" 로 치환 ...
  EOF
  mutated OK

  $ cd "$REPO" && python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py'
  ..................
  ----------------------------------------------------------------------
  Ran 18 tests in 2.363s
  OK
  ```
  같은 mutation 을 둔 채로 `test_workflow_yaml_structure.py`(6 tests OK) /
  `test_harness_checks_paths_coverage.py`(26 tests OK) / `test_block_integrity.py`(39 tests OK) /
  `test_stop_guard_failopen.py`(17 tests OK) 도 전부 GREEN — 이 mutation 을 잡는 테스트는
  저장소 어디에도 없다.

  단, **오늘의 관측 모드에서는 이 mutation 이 즉시 가시적 차이를 만들지는 않는다** — 관측
  모드에서는 `check-review-gate.py` 가 원래도 항상 exit 0 이므로 (실패할 게 없다) job-level
  `continue-on-error` 는 "지금 당장 무언가를 통과시키는" 효과가 없다. 그러나 이 백스톱의 존재
  이유는 정확히 그 반대 미래를 위한 것이다 — plan 문서(`plan/in-progress/harness-review-gate-ci-
  backstop.md`)와 스크립트 자체 docstring이 명시하듯 "관측 데이터를 모아 `--enforce` 를 켠다"는
  것이 설계된 다음 단계다. 그 전환 시점에, 혹은 그 전환 없이도 스크립트에 예상 밖의 버그가 생겨
  exit 1 을 내는 순간, 이 job-level 키 하나가 **아무 테스트도 손대지 않고** 조용히 그 실패를
  삼킨다. 라운드 3가 준 명시적 힌트("Assume there are more of that shape")가 정확히 겨냥한 형태다.
- 제안:
  `_NEUTERING_KEYS` 검사를 `self.job` 에도 적용한다(`self.assertNotIn("continue-on-error",
  self.job, ...)`, 그리고 원한다면 `timeout-minutes`/`if` 도 job 레벨 재정의를 막는 동일 검사).
  더 근본적으로는, "이 job 이 실패를 보고할 수 있는가"를 시나리오 테스트로 고정하는 편이 낫다 —
  즉 `WorkflowWiringTest` 류의 정적 키 검사를 계속 늘리는 대신, `VerdictComesFromTheGateTest` 가
  스크립트 exit code 에 대해 하듯, review-gate.yml 자체를 실제로 (nektos/act 등으로) 최소
  실행하거나, 최소한 "job 딕셔너리에 이 저장소가 알고 있는 키 집합 밖의 키가 있으면 실패"하는
  화이트리스트 형태로 뒤집는 것을 고려한다 — 지금까지 세 세대가 전부 "이런 키를 금지" 라는
  블랙리스트로 뚫렸다는 이 저장소 자신의 교훈과 같은 결의 문제다.

### [CRITICAL] `on.pull_request` 의 트리거 `types` 는 **어떤 테스트도 검사하지 않는다** — `types: [closed]` 하나로 게이트가 "리뷰가 필요한 순간"엔 절대 돌지 않게 만들 수 있고, 전 테스트가 GREEN이다

- 위치:
  - `.claude/tests/test_review_gate_ci.py:404` (`self.on = self.doc.get("on", ...)`)
  - `.claude/tests/test_review_gate_ci.py:456-459` (`test_trigger_paths_are_exactly_the_expected_set` — `self.on["pull_request"]["paths"]` 만 비교)
  - `.github/workflows/review-gate.yml:22-24` (`on: pull_request: paths:`)
- 상세:
  `WorkflowWiringTest`는 `on.pull_request` 아래 **`paths` 키만** `EXPECTED_PATHS` 와 정확 일치로
  비교한다(459번째 줄). `pull_request` 트리거의 다른 축인 `types`(생략 시 기본값
  `opened, synchronize, reopened` — 즉 PR 이 열리거나 새 커밋이 push 될 때마다 도는 것이 지금의
  암묵적 계약)를 검사하는 테스트는 이 파일에도, 저장소 어디에도 없다
  (`grep -rn "types\b" .claude/tests/test_*.py | grep -i "pull_request\|workflow"` → 결과 없음).

  `types: [closed]` 를 `on.pull_request` 에 추가하면 이 워크플로는 PR 이 **닫힐 때만** 돈다 —
  merge 든 close 든, 이미 병합 여부가 결정된 **후**다. 즉 브랜치 보호가 이 job 을 required 로
  걸어 두었다 해도, PR 이 열려 있는 동안 실행되는 인스턴스가 아예 없으므로(또는 병합 시점에야
  한 번 늦게 실행되므로) 실질적으로 백스톱이 "리뷰를 요구해야 하는 그 시점"에는 절대 개입하지
  못한다. `continue-on-error` 류보다 GitHub Actions 지식이 덜 필요하고, diff 상으로도
  "특정 이벤트 타입만 반응하게 좁힌다"는 흔한 설정처럼 보여 리뷰에서 놓치기 쉬운 형태다.

  실증 (격리 복사본, `continue-on-error` mutation 은 되돌린 뒤 별도로):
  ```
  $ python3 - "$REPO/.github/workflows/review-gate.yml" <<'EOF'
  ... "on:\n  pull_request:\n    paths:\n" 를
      "on:\n  pull_request:\n    types: [closed]\n    paths:\n" 로 치환 ...
  EOF
  mutated OK

  $ cd "$REPO" && python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v
  ... (전 18개) ... ok
  ----------------------------------------------------------------------
  Ran 18 tests in 2.488s
  OK
  ```
  `test_trigger_paths_are_exactly_the_expected_set` 을 포함해 18개 테스트 전원 GREEN — `types` 를
  어떻게 바꿔도(빈 배열 `types: []` 도 동일 효과) 이를 잡는 신호가 없다.
- 제안:
  `WorkflowWiringTest.setUp` 에서 `self.on["pull_request"]` 딕셔너리 자체(또는 최소
  `self.on["pull_request"].get("types")`)를 알려진 안전 집합과 정확 일치로 고정한다 — 이 저장소가
  이미 채택한 "허용 목록 + 정확 일치" 원칙(`EXPECTED_IF`, `EXPECTED_PATHS`, `EXPECTED_CONCURRENCY`
  와 동일한 결)을 `pull_request:` 매핑 전체로 넓히는 편이, `paths` 하나만 콕 집어 계속 늘리는 것보다
  다음 우회를 막을 확률이 높다. 이상적으로는 `self.on["pull_request"]`가 알고 있는 키
  (`paths`, 필요시 `types`)만 갖고 있는지, 나머지는 없는지까지 검사한다.

## 요약

Round 3가 명시적으로 남긴 경고("continue-on-error 류가 더 있을 것이라 가정하라")는 정확했다.
`_NEUTERING_KEYS` 검사는 게이트 **step** 딕셔너리에만 적용되어 있어 같은 키를 한 단계 위인
**job** 딕셔너리에 두면(`jobs.gate.continue-on-error: true`) 통과된다 — GitHub Actions 의 실제
의미상 이는 그 job 의 개별 체크런 자체를 "통과로 보고"하게 만드는, step-level 우회와 동급이거나
그보다 넓은 효과를 낸다. 독립적으로, `on.pull_request` 트리거의 `types` 축은 애초에 `paths` 밖에
검사 대상이 아니어서 `types: [closed]` 한 줄로 게이트가 리뷰가 필요한 시점에는 결코 개입하지
못하게 만들 수 있다. 두 mutation 모두 원 저장소가 아닌 격리 복사본에서 만들어 `test_review_gate_ci.py`
전체(및 관련된 `test_workflow_yaml_structure.py`/`test_harness_checks_paths_coverage.py`/
`test_block_integrity.py`/`test_stop_guard_failopen.py`)를 GREEN 상태로 통과시키는 것을 실측했다.
현재는 관측 모드(exit 은 항상 0)라 즉시 가시적 피해는 없지만, 두 구멍 다 "`--enforce` 를 켜는
순간 또는 스크립트에 예기치 않은 실패가 생기는 순간" 백스톱을 조용히 무력화하도록 지금 심을 수
있고, 그 삽입 자체를 잡는 테스트가 없다는 것이 핵심이다. 인젝션/시크릿/인증 등 나머지 OWASP 축은
이번 diff 범위(YAML 배선 + 테스트)에서 해당 사항이 낮다 — `${{ }}` 값을 셸에 직접 보간하지 않고
`env:` 경유로 넘기는 기존 관행(`review-gate.yml:67-70`)은 GH Actions expression-injection 방어로
적절하다.

## 위험도

HIGH — 두 구멍 모두 코드 실행이나 시크릿 탈취로 이어지지는 않지만, 이 백스톱이 존재하는 유일한
이유(로컬 훅이 놓친 리뷰 미커버를 사후에 잡아내는 것)를 정확히 무력화하는 방어 우회이고, 실측상
전 테스트를 통과한 상태로 완성된 PR로 제출 가능하다. 즉시 악용 가능한 데이터 유출/RCE 급은 아니라
CRITICAL 대신 HIGH 로 표기하되, 이 백스톱이 앞으로 `--enforce` 로 전환될 설계임을 고려하면 지금
고치지 않으면 그 전환이 유명무실해진다.

STATUS: SUCCESS
