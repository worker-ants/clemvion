# API 계약(API Contract) Review — Round 6 (CI 백스톱 우회 탐색)

## 범위에 대한 메모

이 변경분(`.github/workflows/review-gate.yml`, `harness-checks.yml`, `scripts/check-review-gate.py`,
`.claude/tests/test_review_gate_ci.py`, `test_workflow_yaml_structure.py`, `test_block_integrity.py`,
`.claude/tests/README.md`)에는 REST 엔드포인트·요청/응답 스키마·페이지네이션·인증/인가 같은
전통적 API 계약 표면이 전혀 없다 — 전부 harness/CI 내부 배선이다. 순수 API 계약 체크리스트
기준으로는 "해당 없음"이 맞다.

다만 이번 호출은 orchestrator 가 이 슬롯을 라운드 6 CI 백스톱 레드팀 조사로 재지정했다
(`CONTEXT`/`YOUR JOB`). 그 지시에 따라 실제 조사를 수행했고, **테스트는 전부 GREEN 인 채로
실제 PR 이 받는 검증 결과(shipped verdict)를 바꿀 수 있는 경로**를 하나 찾아 재현했다. 아래에
정리한다.

---

## 발견사항

- **[CRITICAL]** `harness-checks.yml` 의 스텝-레벨 `if:` 는 어떤 가드도 검사하지 않는다 — 831개
  하네스 자체 테스트 전체를 한 줄로 영구 무력화할 수 있다.
  - 위치: `.github/workflows/harness-checks.yml` — `jobs.unittest.steps` 중 `name: Run harness
    unit tests` 스텝 (현재 `run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'`
    한 줄, 90-91번째 줄 부근). 가드 갭 자체는 `.claude/tests/test_workflow_yaml_structure.py`
    의 `WorkflowStructureTest.test_job_conditions_are_registered` (198-208번째 줄)와
    `test_the_harness_suite_is_invoked_over_every_test_file` (215-227번째 줄 부근)에 있다.
  - 상세:
    라운드 6은 두 축을 일반화했다 — `continue-on-error` 는 **모든 워크플로의 모든
    job/step** 에서 금지(`_SWALLOWS_FAILURE`, 등록 예외제)로, job 레벨 `if:` 는
    **모든 워크플로**에 걸친 등록제(`_JOB_CONDITIONS`)로. 그런데 `_JOB_CONDITIONS` 는
    `job.get("if")`, 즉 **job 자체의** `if:` 키만 스캔한다 — `job["steps"]` 안의 개별
    스텝이 갖는 `if:` 는 이 레지스트리도, 다른 어떤 테스트도 순회하지 않는다.

    `review-gate.yml` 만은 예외적으로 안전하다: `test_review_gate_ci.py::WorkflowWiringTest`
    가 그 문서 **전체**를 리터럴과 정확 일치(`assertEqual(self.doc, self.EXPECTED)`)로 고정하고,
    별도로 `test_the_expectation_still_describes_a_gate_that_runs` 가 `scope != "job"` 인 모든
    스텝에서 `assertNotIn("if", d)` 를 명시적으로 확인한다. 하지만 이 스텝-레벨 `if:` 금지는
    **review-gate.yml 전용으로 하드코딩**돼 있고, `continue-on-error` 처럼 전 워크플로로
    일반화되지 않았다. `harness-checks.yml` 은 (a) 문서 전체를 고정하는 리터럴 비교가 없고
    (b) `test_the_harness_suite_is_invoked_over_every_test_file` 는 스텝 딕셔너리에서
    `"run"` 텍스트가 기대 문자열과 같은지만 보고 그 스텝에 `if:` 가 붙어 있는지는 보지 않는다
    — 그래서 스텝이 `if: false` 로 매 실행마다 건너뛰어져도 `run:` 필드 자체는 여전히
    파싱된 문서 안에 존재하므로 이 테스트를 그대로 통과한다.

    GitHub Actions 의 표준 동작(문서화된 동작이라 러너 실측이 필요 없다): 스텝의 `if:` 가
    거짓으로 평가되면 그 스텝은 **skipped** 로 표시되고 실패로 카운트되지 않는다. job 의 다른
    스텝이 전부 성공하면 job 자체는 **성공(초록)** 으로 보고된다. 즉 `harness-checks.yml` /
    `unittest` job 은 실제 PR 에서 계속 초록 체크로 뜨지만, `.claude/tests/` 아래 831개
    테스트 — `test_review_gate_ci.py`, `test_workflow_yaml_structure.py`,
    `test_block_integrity.py` 를 포함해 라운드 1-6이 쌓아 온 모든 방어를 검증하는 바로 그
    테스트들 — 는 단 한 번도 실행되지 않는다. 라운드 5가 "스위트 호출 패턴을 좁혀 11개
    가드 파일이 안 도는" 우회를 막았는데, 이번 것은 패턴을 안 건드리고 그 스텝 자체를
    조건부로 만들어 **패턴이 맞아도 스텝이 안 돈다** — 같은 결함 클래스가 한 층 더 밖으로
    이동한 형태다.

  - 재현 (작업 트리는 건드리지 않음 — `mktemp -d` 스크래치에 로컬 clone):
    ```bash
    SCRATCH=$(mktemp -d)
    git clone --quiet --no-hardlinks \
      /Volumes/project/private/clemvion/.claude/worktrees/harness-review-ci-backstop-91f379 \
      "$SCRATCH/repo"
    cd "$SCRATCH/repo"

    python3 - <<'EOF'
    p = ".github/workflows/harness-checks.yml"
    text = open(p, encoding="utf-8").read()
    old = "      - name: Run harness unit tests\n        run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'\n"
    new = ("      - name: Run harness unit tests\n"
           "        if: github.event.pull_request.number == -1\n"
           "        run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'\n")
    assert old in text
    open(p, "w", encoding="utf-8").write(text.replace(old, new))
    EOF

    python3 -m unittest discover -s .claude/tests -p 'test_*.py'
    ```
    출력 (전체 스위트):
    ```
    ----------------------------------------------------------------------
    Ran 831 tests in 102.583s

    OK
    ```
    타겟 재확인 (실제로 이 갭을 지켜야 할 세 파일만):
    ```bash
    python3 -m unittest discover -s .claude/tests -p 'test_workflow_yaml_structure.py'   # OK — 9 tests
    python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py'             # OK — 16 tests
    python3 -m unittest discover -s .claude/tests -p 'test_harness_checks_paths_coverage.py'  # OK — 26 tests
    ```
    셋 다 `OK` — `github.event.pull_request.number == -1` 는 실제 PR 이벤트에서 PR 번호가
    항상 양수이므로 **항상 거짓**이고, 위 어떤 가드도 이 삽입을 탐지하지 못했다.
    조사 후 스크래치 clone 은 삭제했고(`rm -rf "$SCRATCH"`), 실제 작업 트리는
    `git status` 로 재확인 — untracked `review/` 산출물 외 변경 없음(clean).

  - 부수 변형(더 좁은 폭발반경, 같은 근본원인): 같은 트릭을 `harness-checks.yml` 의 두 번째
    스텝(`name: Run workflow contract unit tests`, `node --test
    .claude/tests/test_agent_return.mjs`)에 걸면 그 한 파일만 무력화되고 위 세 테스트 모두
    여전히 통과한다 — 근본원인이 "스텝-레벨 `if:` 를 아무도 안 본다"이지 특정 스텝에 국한되지
    않는다는 것을 보여준다.

  - 제안: `test_workflow_yaml_structure.py` 의 `_JOB_CONDITIONS` 를 job 레벨뿐 아니라
    **스텝 레벨**까지 스캔하도록 일반화한다 — `continue-on-error` 축(`_SWALLOWS_FAILURE`)이
    이미 job 과 step 을 모두 순회하는 것과 동일한 모양으로: 모든 워크플로의 모든 스텝에서
    `if:` 키를 찾아, `(워크플로, 스텝 이름)` 단위 등록제(`_MAY_SWALLOW` 와 대칭되는
    `_STEP_CONDITIONS` 같은 이름)로 없으면 실패시킨다. `review-gate.yml` 전용으로
    하드코딩된 `test_the_expectation_still_describes_a_gate_that_runs` 의 스텝-`if:` 금지
    로직을 일반 케이스로 승격하면, 이번에 찾은 갭과 "라운드 7에서 다른 워크플로/다른 스텝에
    같은 트릭이 재등장"하는 것을 함께 막는다.

---

## 요약

이 diff 자체는 API 계약 표면이 없어 그 축의 판정은 NONE 이지만, 명시 재지정된 라운드 6
조사 목표("테스트가 전부 GREEN 인 채로 실제 PR 이 받는 판정을 바꿀 수 있는가")에 대해서는
**가능하다**는 것을 재현 가능한 형태로 확인했다. `harness-checks.yml` 의 `Run harness unit
tests` 스텝에 항상-거짓인 `if:` 한 줄을 추가하면, 831개 하네스 자체 테스트 — 라운드 1-6이
쌓아 올린 모든 방어를 검증하는 테스트 포함 — 가 실제 PR 에서 전혀 실행되지 않으면서도
`harness-checks.yml` job 은 초록으로 뜨고, 이 변경분에 포함된 어떤 신규 가드(`_JOB_CONDITIONS`
registry, `_SWALLOWS_FAILURE` 금지, `test_the_harness_suite_is_invoked_over_every_test_file`)
도 이를 탐지하지 못한다. 근본원인은 라운드 6이 "job 레벨 `if:`"와 "모든 스텝의
`continue-on-error`"는 일반화했지만 "스텝 레벨 `if:`"는 `review-gate.yml` 전용으로만 막아
두고 전 워크플로로 일반화하지 않은 데 있다.

## 위험도

CRITICAL (harness CI 백스톱 신뢰성 관점 — API 계약 축 자체는 NONE)

---

## 부록 — 진행 중 확인한 것 (음성 결과, 참고용)

시간 내에 함께 점검했으나 이번 라운드 방어가 실제로 막고 있는 것으로 확인된 축(별도 보고
불필요, 기록만):
- `review-gate.yml` 문서에 대한 `WorkflowWiringTest.test_the_whole_workflow_matches_the_expected_wiring`
  는 문서 전체 리터럴 비교라 그 파일 안의 어떤 필드 추가/삭제/변경(스텝 순서 포함)도 즉시
  실패로 이어진다 — 라운드 1-4의 우회 축은 이 파일에 한해 막혀 있음을 재확인.
- `continue-on-error` 는 `_SWALLOWS_FAILURE` 스캔이 모든 워크플로의 모든 job·step 을
  순회하므로 `harness-checks.yml` 에 걸어도 즉시 잡힌다(직접 삽입해 `test_no_guard_workflow_swallows_its_own_failure`
  가 실패로 전환되는 것을 확인).
- `scripts/check-review-gate.py` 자체의 `os.environ`/`getenv`/`argv`/속성-재바인딩 축은
  `OneJudgeTest` 의 AST 검사(호출 축 허용목록 + 대입 대상 금지 + `environ`/`getenv`/`argv`
  Attribute 전면 금지)로 막혀 있고, `VerdictComesFromTheGateTest` 가 최소/적대적 두 환경에서
  종료 코드가 스텁 판정의 순함수인지 행위로도 재확인한다 — 5R 리뷰어들이 실증했던 세 변형
  전부 이 두 테스트 조합으로 재현 시 실패한다.

STATUS: SUCCESS
