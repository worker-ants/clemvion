# 테스트(Testing) Review — CI 백스톱 6R

## 요약 (먼저): 다음 층 우회를 찾았고, 재현했다

`harness-checks.yml`의 **"Run harness unit tests" step 에 `if:` 조건을 하나 추가하면**,
그 step 이 실행되지 않고(skip) job 은 그대로 success 로 보고되는데, 이 스위트 안의
**어떤 테스트도 이 조건의 존재를 검사하지 않는다.** 831개 테스트 전부가 이 변형이 적용된
사본에서도 그대로 GREEN 이었다. 이것이 5R 까지 닫힌 축(워크플로 파일 자체 → 그것을 실어
나르는 CI 배선 → 스크립트 입력 축) 바깥의 **다음 층**이다: "배선이 맞는 워크플로 파일이
실제로 도는가" 를 지키는 것이 하나도 없다.

---

## 발견사항

- **[CRITICAL]** `harness-checks.yml`의 테스트 실행 step 에 step-level `if:` 를 달면
  이 백스톱 스위트 전체(831 테스트, `test_review_gate_ci.py`·`test_workflow_yaml_structure.py`·
  `test_block_integrity.py` 포함)가 실제 CI 에서 조용히 안 돌고, 어떤 테스트도 RED 로
  바뀌지 않는다.
  - 위치: `.github/workflows/harness-checks.yml` — `jobs.unittest.steps` 중
    `name: Run harness unit tests` step (현재 88~91행 부근, `- name: Run harness unit tests` /
    `run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'`).
    가드 부재 지점: `.claude/tests/test_workflow_yaml_structure.py`
    `WorkflowStructureTest.test_job_conditions_are_registered`
    (job-level `if:` 만 `_JOB_CONDITIONS` 로 등재를 강제하고, **step-level `if:` 는
    이 테스트도 다른 어떤 테스트도 보지 않는다**) 및
    `test_the_harness_suite_is_invoked_over_every_test_file`
    (그 step 의 `run:` 문자열이 **존재하는지만** 확인하고, 그 step 이 조건부로 skip 될 수
    있는지는 확인하지 않는다).
  - 상세 (재현):
    1. `mktemp -d` 로 만든 격리 사본(`git clone --local`, HEAD 는 review 대상과 동일한
       `8ce96e72b`, 그리고 재검증 시점의 최신 `e46f5382c` 양쪽에서 재현)에서 다음 diff 를 적용:

       ```diff
       --- a/.github/workflows/harness-checks.yml
       +++ b/.github/workflows/harness-checks.yml
       @@ -88,6 +88,7 @@ jobs:
                run: pip install "pyyaml>=6,<7"

              - name: Run harness unit tests
       +        if: vars.HARNESS_TESTS_ENABLED == 'true'
                run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'

              # The workflow scripts' report-return parsing decides BLOCK/RISK, so it gets real
       ```

       `vars.HARNESS_TESTS_ENABLED` 는 정의된 적 없는 repo/environment variable 이라
       GitHub Actions `vars` 컨텍스트에서 빈 문자열로 평가된다(공식 문서화된 동작 —
       "Fetch base ref" 필요성 질문과 달리 실제 러너가 있어야만 알 수 있는 사안이 아니다).
       즉 조건은 항상 false 이고, 이 step 은 **항상 skip** 된다. GH Actions 는 step skip 을
       job 실패로 치지 않으므로 `unittest` job 은 그대로 success 로 뜬다 — "리뷰를 안 했다"
       가 아니라 "게이트가 초록인 채로 아무것도 안 했다" 는, 이 저장소가 4R/5R 에서 이미
       겪은 것과 같은 실패 형태를, 지켜지지 않은 새 자리에서 재현한다.

    2. 이 변형을 적용한 채로 전체 스위트를 돌린다:

       ```
       $ cd <scratch-clone>/repo && python3 -m unittest discover -s .claude/tests -p 'test_*.py'
       ----------------------------------------------------------------------
       Ran 831 tests in 95.762s

       OK
       ```

       831/831 GREEN — 이 변형을 만든 그 스위트 자신을 포함해서.

    3. "이걸 잡아야 할" 개별 가드를 지목해서 따로 돌려도 전부 통과한다:

       ```
       $ python3 -m unittest -v \
           test_workflow_yaml_structure.WorkflowStructureTest.test_job_conditions_are_registered \
           test_workflow_yaml_structure.WorkflowStructureTest.test_the_harness_suite_is_invoked_over_every_test_file \
           test_workflow_yaml_structure.WorkflowStructureTest.test_no_guard_workflow_swallows_its_own_failure \
           test_harness_checks_paths_coverage
       ...
       Ran 29 tests in 0.400s

       OK
       ```

    4. 대조 실험 — **같은 변형을 `review-gate.yml`의 `Review coverage backstop` step 에 걸면
       즉시 RED 다:**

       ```
       $ python3 -m unittest test_review_gate_ci
       ...
       FAIL: test_the_whole_workflow_matches_the_expected_wiring
         (test_review_gate_ci.WorkflowWiringTest.test_the_whole_workflow_matches_the_expected_wiring)
       AssertionError: {...'if': "vars.HARNESS_TESTS_ENABLED == 'true'"...} != {... no 'if' key ...}
       ```

       `review-gate.yml`은 `WorkflowWiringTest`가 파싱된 문서 **전체**를 리터럴과 정확
       일치시키므로 이 축이 막혀 있다. **동일한 방어가 `harness-checks.yml`에는 없다** —
       이 스위트를 실제로 실행하는 그 워크플로 파일 자신은 문서-전체 고정도, step-level
       `if:` 등재제도 받지 못했다. 비대칭이 정확히 뚫린 지점이다.

  - 왜 심각한가: `harness-checks.yml`이 실행하는 831개 테스트는 이 저장소가 5라운드에
    걸쳐 쌓은 방어(문서 전체 고정, 호출 표면 화이트리스트, `continue-on-error` 전 워크플로
    금지, `environ`/`getenv`/`argv` 금지, 행위 기반 순함수 검증) **전부**다. 이 하나의
    step 을 조건부로 만드는 순간 그 방어들은 로컬에서는 여전히 통과하지만(`python3 -m
    unittest discover`를 직접 돌리면 걸리는 게 없다 — 위 실험이 보여준 그대로) **실제 PR 에서는
    한 번도 실행되지 않는다.** 그 상태에서는 1R~5R 의 어떤 우회를 `review-gate.yml`에
    다시 넣어도 그것을 잡을 테스트 자체가 CI 에서 안 돈다. 즉 이 결함 하나가 다른 모든
    결함의 재발을 무기한 은폐할 수 있다.
  - 제안: 두 방향 중 하나(또는 둘 다) —
    1. `harness-checks.yml`에도 `test_review_gate_ci.py::WorkflowWiringTest`와 같은
       "파싱된 문서 전체를 리터럴과 정확 일치" 테스트를 추가한다. `review-gate.yml`에서
       이미 검증된 패턴이라 신뢰할 수 있다.
    2. 또는 `_JOB_CONDITIONS`(job-level `if:` 등재제)와 같은 설계를 **step-level `if:`**
       로 확장한다 — `test_no_guard_workflow_swallows_its_own_failure`가 이미 모든
       워크플로의 모든 job/step 을 순회하며 `continue-on-error`를 검사하는 것과 동일한
       모양으로, "이 저장소 어디에도 등재 안 된 step-level `if:`는 실패"를 전 워크플로에
       건다. 이렇게 하면 `harness-checks.yml`뿐 아니라 미래에 추가될 다른 워크플로의
       같은 구멍도 한 번에 막는다.
    두 수정 모두 이번 라운드에 이미 있는 코드(리터럴 딕셔너리, 등재 셋)를 그대로 재사용하는
    변경이라 새 파싱 로직이 필요 없다.

- **[WARNING]** 리뷰 번들이 리뷰 도중 앞서 나간 커밋을 반영하지 못했다 — "무엇을 리뷰
  중인지" 자체가 세션 동안 바뀌었다.
  - 위치: `.claude/tests/test_review_gate_ci.py` — 이 프롬프트가 보여준 전체 파일 컨텍스트는
    594줄(끝: `if __name__ == "__main__":`)에서 끝나는데, 실제로는 리뷰 도중
    (동시 진행 세션에 의해) 커밋 `e46f5382c`("이 백스톱이 서 있는 전제를 가드 —
    `review/**`가 추적된다는 사실")가 착지해 651줄이 됐다. 추가분은
    `ReviewArtifactsStayTrackedTest` 클래스(`.gitignore`가 리뷰 산출물을 제외하지 않는지,
    실제로 SUMMARY 가 추적되고 있는지 두 축을 잠그는 테스트)다.
  - 상세: 리뷰 시작 시점(`git status`)에는 이 클래스가 **미커밋 diff**로 존재했고, 프롬프트
    본문에는 아예 없었다(`grep`로 확인, 매치 0건). 리뷰가 진행되는 동안 그 diff 가 별도
    커밋으로 착지했다 — `git log`상 병렬 세션의 후속 작업으로 보인다(메모리:
    "다른 세션이 먼저 머지했을 수 있다 — 작업 중에도 머지된다"). 이번 리뷰의 판정은
    프롬프트에 실제로 담긴 9개 파일 스냅샷(HEAD `8ce96e72b`) 기준이며, 위 CRITICAL 은 최신
    커밋(`e46f5382c`)에서도 동일하게 재현됨을 별도로 확인했다.
  - 제안: `ReviewArtifactsStayTrackedTest`는 이번 라운드 번들에 없었으므로 이 리뷰가
    그 클래스 자체의 정확성(예: `_prompts/` 제외 규약과의 정합, `git check-ignore`
    subTest 의 경계값)을 검토했다고 볼 수 없다 — 별도 라운드로 다시 통과시킬 것.

- **[INFO]** `check-review-gate.py`·`review-gate.yml`·`WorkflowWiringTest` 자체의 품질은
  이번 라운드에서 눈에 띄게 좋아졌다. 특히:
  - `OneJudgeTest`(정적 import/호출 표면 화이트리스트)와 `VerdictComesFromTheGateTest`
    (스텁 게이트 × `--enforce` 네 조합에 대한 종료 코드 순함수 검증, "최소 환경"과
    "적대적 환경" 둘 다)의 역할 분담은 "정적 증명은 유한하지 않다"는 이 라운드의 교훈을
    정확히 반영한다 — 정적 검사가 못 닫는 부분을 행위 테스트가 메운다는 설계가 문서화돼
    있고, 실제로 지금 발견한 CRITICAL 도 정적 축(`OneJudgeTest`)이 아니라 **아예 다른
    파일**(`harness-checks.yml`)을 겨눈 것이라 이 설계 자체의 결함은 아니다.
  - `test_stop_guard_failopen.py`의 `SuiteLeavesNoRealStateTest`, `test_block_integrity.py`의
    `GateSurfacesTheContradictionTest`/`NotesFromLaterTargetsSurviveAnEarlierBlockTest`는
    "단언 가능한 성질을 직접 호출하는 테스트"와 "그 호출부가 실제로 배선돼 있는지 확인하는
    테스트"를 분리해서 두는 패턴이 일관적이다(이 저장소가 반복해서 겪은 "함수는 옳은데
    아무도 안 부른다" 결함 클래스에 대한 정확한 대응).
  - Mock 충실도: `_CLEAN_PLAN`/`_CLEAN_REVIEW`/각 스텁이 전부 실제 dataclass/property
    인터페이스(`push_blocks` 포함)를 그대로 비추도록 주석으로 강제하고,
    `PlanStubsMirrorTheRealInterfaceTest`가 그 규율을 소스 텍스트 파싱으로 재확인한다 —
    "스텁이 인터페이스 일부를 빠뜨려 fail-open 경로를 우연히 테스트하는" 이 저장소의
    반복 결함 클래스에 대한 정확한 회귀 방지다.

## 위 CRITICAL 이 나머지 관점에 대해 갖는 의미 (요약)

- **테스트 존재 여부 / 커버리지 갭**: `harness-checks.yml` 자신의 배선(어떤 step 이 실제로
  실행되는가)은 이번 라운드가 다루는 9개 파일 중 **유일하게 문서-전체 고정을 받지 못한
  워크플로**다. `review-gate.yml`에 준 것과 대칭적인 보호가 빠져 있다는 것이 바로 이번
  갭이다.
- **엣지 케이스**: step-level `if:`는 지금까지의 다섯 라운드가 다룬 "if 를 없앤다/false 로
  만든다/`continue-on-error`로 삼킨다"의 변주가 아니라 **새 축**(step 자체가 조건부로
  실행 안 됨)이라, 기존 회귀 테스트 어느 것도 커버 범위 안에 이 케이스를 포함하지 않는다.
- **회귀 테스트**: 위 CRITICAL 을 고치면(문서-전체 고정이든 step-if 등재제든) 이번에
  실증한 diff 가 정확한 회귀 테스트 입력이 된다 — mutation-style 로 그대로 재사용 가능.
- **테스트 용이성**: `review-gate.yml`의 `WorkflowWiringTest` 패턴은 이미 검증됐고 재사용
  비용이 낮다(리터럴 딕셔너리 하나 추가). 구조적으로 어려운 수정이 아니다.

## 요약

이번 라운드 자체가 도입한 코드(스크립트 호출 표면 화이트리스트, 행위 기반 순함수 검증,
job-level `if:` 등재제, 전 워크플로 `continue-on-error` 금지)는 각각 견고하게
테스트돼 있고 실측으로 확인했다. 그러나 그 방어들을 실제로 실행시키는 워크플로 파일
(`harness-checks.yml`)의 배선 자체는 같은 수준의 보호를 받지 못했다 — step-level `if:`를
그 실행 step 에 붙이면 831개 테스트 전부가 격리 사본에서도 그대로 GREEN 인 채로, 그 스위트가
지키는 모든 것(이번 라운드의 방어 포함)이 실제 CI 에서 조용히 안 도는 상태를 만들 수 있음을
재현했다. 부가적으로, 리뷰 세션 도중 병렬 작업이 `test_review_gate_ci.py`에 새 커밋
(`e46f5382c`)을 착지시켜 이번 리뷰 번들이 그 변경을 반영하지 못한 것도 확인했다 —
CRITICAL 은 그 커밋 전후 양쪽에서 동일하게 재현되므로 판정에는 영향이 없지만, 그 새 클래스
자체는 이번 리뷰의 대상이 아니었다는 점은 남겨 둔다.

## 위험도

CRITICAL
