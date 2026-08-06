# 아키텍처(Architecture) 리뷰 — 리뷰 게이트 CI 백스톱 (Round 5)

## 진행 방식

라운드 지시대로 실제 저장소를 `mktemp -d` 로 만든 **별도 git clone**(작업 트리 밖, `/private/tmp/claude-501/.../scratchpad/arch-r5-git.*`)에 복제해 뮤테이션을 실행하고 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 로 전체 하네스 스위트(826개)를 돌렸다. 실제 워크트리는 건드리지 않았다(`git status --short` 로 확인, 아래 참조).

기지정된 두 한계는 그대로 인정한다: (a) `EXPECTED` 리터럴과 워크플로를 같이 고치는 것은 항상 통과한다 — 어떤 테스트도 막을 수 없다. (b) `Fetch base ref` 가 `fetch-depth: 0` 위에서 실제로 필요한지는 실러너 없이는 실측 불가.

## 발견사항

- **[CRITICAL]** `review-gate.yml` 에 적용된 "job/step 이 실패를 삼키거나 스스로 꺼질 수 없다" 불변식이 **`harness-checks.yml` 에는 없다** — 그런데 `harness-checks.yml` 이 바로 `test_review_gate_ci.py`(4라운드에 걸쳐 경화한 그 테스트 자신)를 포함한 하네스 스위트 전체를 실행하는 워크플로다. 즉 "가드를 검증하는 가드"가 정작 자기 자신에게는 그 가드가 적용돼 있지 않다.

  `test_review_gate_ci.py::WorkflowWiringTest.test_the_expectation_still_describes_a_gate_that_runs` 는 `review-gate.yml` 의 job/모든 step 에 `continue-on-error` 가 없고 step 에 `if` 가 없음을 명시로 단언한다(4R 이 바로 `jobs.gate.continue-on-error: true` 로 뚫린 이력 때문). 그런데 이 검사는 `review-gate.yml` 전용이고, 구조적으로 동형인 `harness-checks.yml` 의 `unittest` job/step 에는 아무 대응 검사가 없다. 두 번 실측으로 확인했다(둘 다 별도 git clone 에서, 실제 워크트리는 미변경):

  ```
  $ git clone --local --no-hardlinks -q <repo> $WORK2/repo
  $ cd $WORK2/repo && python3 -m unittest discover -s .claude/tests -p 'test_*.py' 2>&1 | tail -3
  Ran 826 tests in 97.948s
  OK
  ```

  뮤테이션 1 — `.github/workflows/harness-checks.yml` 의 `Run harness unit tests` 스텝(88행 바로 앞)에 `continue-on-error: true` 삽입:

  ```diff
        - name: Run harness unit tests
  +       continue-on-error: true
          run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'
  ```

  ```
  $ python3 -m unittest discover -s .claude/tests -p 'test_*.py' 2>&1 | tail -3
  Ran 826 tests in 93.370s
  OK
  ```

  826개 전부 그대로 통과. 실제 GitHub Actions 에서 이 스텝이 이렇게 되어 있으면, `test_review_gate_ci.py`(또는 다른 26개 스위트 중 무엇이든)가 실패해도 **job 자체는 success 로 보고된다** — 정확히 4R 문서가 `jobs.gate.continue-on-error` 를 "job 은 안 막았다" 라고 지목한 그 실패 형태를, 이번엔 `review-gate.yml` 이 아니라 그 검증자를 실어 나르는 워크플로에 적용한 것이다.

  뮤테이션 2(더 심각한 변형) — `unittest` job 자체에 `if: false` 삽입(69행 앞):

  ```diff
    jobs:
      unittest:
        runs-on: ubuntu-latest
  +     if: false
  ```

  ```
  $ python3 -m unittest discover -s .claude/tests -p 'test_*.py' 2>&1 | tail -3
  Ran 826 tests in <...>s
  OK
  ```

  역시 826개 전부 그대로 통과 — job 전체가 절대 실행되지 않도록 만들어도 이 변경 자체를 잡는 테스트가 없다. GitHub Actions 상에서 `if: false` job 은 (required check 로 지정돼 있지 않다면) 그냥 조용히 skip 되고, PR 은 다른 체크만으로 머지 가능해진다.

  - 위치: `.github/workflows/harness-checks.yml:68`(job 정의) / `:87-88`(unittest 실행 스텝) — 대응하는 가드 부재.
  - 대조: `.claude/tests/test_review_gate_ci.py:440-459`(`test_the_expectation_still_describes_a_gate_that_runs`, 특히 `455-456`행의 `continue-on-error`/`if` 순회 단언) — 이 패턴이 `review-gate.yml` 에는 있고 `harness-checks.yml` 에는 없다.
  - 상세: 4라운드에 걸친 하드닝은 전부 "review-gate.yml 문서 자체를 어떻게 정확히 고정하는가" 에 집중했는데, 그 문서가 애초에 검증되는 **경로**(harness-checks.yml → `test_review_gate_ci.py` → review-gate.yml 검증)의 **첫 관문**은 아무도 고정하지 않았다. `WorkflowWiringTest` 가 사용하는 "파싱된 문서 전체를 하나의 기대값과 비교" 라는 검증된 패턴이 있고, 그 패턴은 `harness-checks.yml` 에도 그대로 적용 가능한데 적용되지 않았다 — 같은 역할(=하네스 스위트를 실행하는 CI job)을 하는 두 산출물이 서로 다른 수준의 보증을 갖는 것은 계층 경계 설계상 비일관성이다("같은 역할에는 같은 계약"의 위반).
  - 제안: `harness-checks.yml` 에도 동일한 전체-문서 골든파일 비교(또는 최소한 `test_the_expectation_still_describes_a_gate_that_runs` 와 동형인 "job/모든 step 에 continue-on-error 없음 · job 에 `if` 없음(또는 명시적으로 화이트리스트) · timeout 이 0 이 아님" 서브셋 불변식)를 추가하는 `test_harness_checks_wiring.py`(또는 `test_harness_checks_paths_coverage.py` 확장)를 신설할 것. `.claude/tests/README.md` 의 "이 파일이 커버하는 대상" 표에도 반영 필요.

- **[WARNING]** `scripts/check-review-gate.py` 가 `.claude/hooks/_lib/review_guard.py` 를 직접 import 하여 `scripts/` 레이어가 `.claude/hooks/` 내부(비공개 구현) 모듈에 결합된다. 이 결합은 문서화된 의도적 트레이드오프이고(두 번째 판정자를 만들지 않기 위해 — `report_paths`/`retry_state` drift 재발 방지), `VerdictComesFromTheGateTest` 가 그 신뢰를 행위로 보증하므로 심각하지 않지만, `review_guard.evaluate_review()` 의 시그니처가 진화하면(예: 새 필수 kwarg) 이 소비자가 조용히 깨질 수 있는 암묵적 인터페이스다. 공식 계약(예: `Protocol`/`ABC` 또는 최소한 이 함수를 "공개 계약"으로 명시하는 docstring)이 없다.
  - 위치: `scripts/check-review-gate.py:69-70`(`import review_guard` / `review_guard.evaluate_review`)
  - 제안: 지금 수준의 결합은 유지하되(정당한 판단), `review_guard.evaluate_review` 시그니처 변경 시 이 소비자도 함께 검토하라는 주석을 `review_guard.py` 쪽에도 남겨 양방향 참조로 만들 것. 현재는 `check-review-gate.py` → `review_guard.py` 방향으로만 "같은 판정자" 근거가 적혀 있다.

- **[INFO]** default-branch 해석 로직이 `branch_guard._origin_default_branch()`(정본) · `review_guard._default_branch()` · `code_review_orchestrator._default_branch_ref()` · `consistency_orchestrator` 의 `"origin/main"` 리터럴 네 곳에 독립 구현돼 있다(반환 계약도 다름: 로컬 `main` vs `origin/main`). 이번 PR 이 새로 만든 문제는 아니며 `plan/in-progress/harness-review-gate-ci-backstop.md` 자체에 "신규 후속(defer)" 로 이미 등재돼 있다. 확장성 관점에서만 재확인: 정책이 바뀌면 4곳을 손으로 동기화해야 하는 DRY 위반이 여전히 열려 있다.
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md` (§신규 후속(defer), "origin 기본 브랜치 해석" 항목) — 코드 변경 없음, 추적만 재확인.

- **[INFO] (긍정적)** `_lib/failopen_state.py` 로의 추출(테스트: `.claude/tests/test_stop_guard_failopen.py`)은 push/stop 두 훅이 공유하던 ~120줄의 fail-open 리포팅을 한 곳으로 모으면서, "Stop 은 항상 stderr, push 는 exit code 로 스트림 선택" 이라는 유일한 차이점을 **스트림을 파라미터로 주입**하는 방식으로 처리했다(하드코딩 대신). 공유 로직 추출 + 정책 차이를 파라미터화하는 정석적인 리팩터링으로, DRY 와 개방-폐쇄 원칙을 모두 지킨 좋은 사례다.

- **[INFO] (긍정적)** `test_block_integrity.py` 의 `CheckerListIsCanonicalTest` 는 오케스트레이터가 자신의 `ALL_CHECKERS` 목록을 `block_integrity` 모듈에서 **파생**하도록 강제하고("정책의 단일 진실"), `_shared` 레이어가 특정 skill 패키지를 import 하지 않는 의존성 방향(스킬 → 공유, 공유 ↛ 스킬)을 명시로 지킨다. 의존성 역전 원칙이 테스트로 고정된 좋은 예다.

## 요약

이번 라운드의 실제 질문(테스트를 전부 초록으로 유지한 채 배선된 동작을 바꿀 수 있는가)에 대한 답은 **그렇다**다 — 단, `review-gate.yml`/`check-review-gate.py`/`test_review_gate_ci.py` 삼각형 내부가 아니라 그 바깥, 그 삼각형을 CI 에 올려 실행시키는 워크플로(`harness-checks.yml`)에서다. 4라운드에 걸쳐 "부분 고정은 여전히 부분 고정" 이라는 교훈으로 `review-gate.yml` 전체 문서를 골든파일로 굳혔지만, 같은 교훈이 그 문서를 검증하는 CI 파이프라인의 다른 절반(harness-checks.yml)에는 아직 적용되지 않았다 — 실측으로 `continue-on-error: true` 삽입과 `if: false` 삽입 둘 다 826개 테스트 전원을 통과시켰다. 이는 단일 파일의 결함이 아니라 "가드를 검증하는 대상(review-gate.yml)은 강하게 고정하면서 가드를 실행하는 매개체(harness-checks.yml)는 같은 수준으로 고정하지 않은" **계층 경계 설계의 비일관성**이며, 이 한 곳이 뚫리면 지금까지의 모든 라운드의 하드닝이 CI 신호로서는 무의미해진다. 그 외 8개 파일 자체의 SOLID/결합도/계층 분리는 대체로 견고하고(특히 `_lib/failopen_state.py` 추출, `block_integrity` 의 의존성 역전) 순환 의존성은 발견되지 않았다.

## 위험도

CRITICAL
