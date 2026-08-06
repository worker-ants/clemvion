# 테스트(Testing) Review — CI 백스톱 (`review-gate.yml` / `check-review-gate.py` / `test_review_gate_ci.py`)

> **운영 관찰 (리뷰 내용과 무관, 즉시 보고) — 예상치 못한 `git status`.** 본 리뷰는 원 워크트리를
> 전혀 쓰지 않고 스크래치 디렉터리 사본에서만 뮤턴트를 실행했다(아래 "방법" 참조). 그런데 리뷰
> 종료 시점에 실행한 `git status --short`가 다음을 보였다:
> ```
>  M scripts/check-review-gate.py
> ?? review/code/2026/08/01/12_06_49/
> ```
> `scripts/check-review-gate.py`의 diff:
> ```diff
> @@ -52,6 +52,10 @@ import argparse
>  import os
>  import sys
>
> +# control case: local Name-to-Name alias of a disallowed call
> +join = os.walk
> +join('review')
> +
>  # `review_guard` 는 `.claude/hooks/_lib/` 에 있고 형제 모듈을 이름으로 import 하므로
> ```
> 이 변경은 **본 세션이 만든 것이 아니다** — 본 세션의 모든 쓰기는 스크래치 사본 경로
> (`/private/tmp/.../scratchpad/repo-copy/...`)로만 향했고, 실제 워크트리 파일에는 `Read` 외의
> 어떤 도구도 쓰지 않았다. 주석 문구("control case: local Name-to-Name alias of a disallowed
> call")는 정확히 `OneJudgeTest`가 막으려는 지역 별칭 우회를 실측하는 형태로, CONTEXT가 언급한
> "라운드 2에서 여섯 명이 관측한, 소스를 직접 뮤테이션하던 관행(지금은 중단됐다는)"과 같은
> 종류의 활동이 **이 세션 진행 중에도 실제 워크트리에서 다시 발생했다**는 뜻으로 읽힌다. 지시대로
> 고치지 않고 있는 그대로 보고한다.

---

방법: 원 워크트리는 건드리지 않고 `.claude`/`.github`/`scripts`를 스크래치 디렉터리로 복사한 뒤
(`_harness.py`가 `parents[2]`를 REPO_ROOT로 계산하므로 같은 상대 깊이로 복사하면 그대로 실행됨),
그 사본에서만 뮤턴트를 넣고 `python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py'`를
직접 실행해 실측했다. 매 실험 전 `python3 -m unittest discover ...`로 기준선(무변경) 그린을 먼저 확인했다:
`Ran 15 tests in 4.943s / OK`. 이후 각 뮤턴트에서도 동일 명령을 그대로 재실행했다.

---

## 발견사항

- **[CRITICAL]** `test_a_step_actually_runs_the_script` / `test_it_is_still_observation_only` 가 주장하는
  "게이트 스크립트가 실제로 실행된다"는 여전히 **substring 판정**이다 — 이 파일의 다른 클래스들이
  이미 "구조로 판정한다, substring 이 아니라"로 재작성된 바로 그 실패 클래스가 이 두 테스트에는
  안 닿아 있다.
  - 위치: `.claude/tests/test_review_gate_ci.py:385-390` (`test_a_step_actually_runs_the_script`),
    `:430-453` (`test_it_is_still_observation_only`). 대상: `.github/workflows/review-gate.yml:74`.
  - 상세: `_run_commands()`가 모은 각 `run:` 텍스트에 `"scripts/check-review-gate.py"`라는
    **문자열**이 들어있는지만 본다. 그 텍스트가 실제로 파이썬을 실행하는지, 아니면 그 파일명을
    **언급만** 하는지는 구분하지 않는다. 실측: `review-gate.yml:74`의
    `run: python3 scripts/check-review-gate.py`를
    `run: echo "scripts/check-review-gate.py temporarily disabled, see incident #X"`로 바꾼 사본에서
    `python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v` 를 실행하면
    **15개 전부 `OK`** — `test_a_step_actually_runs_the_script`도, `test_it_is_still_observation_only`도
    `... ok`. 이 파일이 존재하는 유일한 이유(CI 백스톱이 실제로 도는가)가 이 한 줄 교체로 완전히
    거짓이 되는데 이 파일의 15개 테스트 중 어느 것도 감지하지 못한다. 게다가 관측 모드는 위반이어도
    항상 exit 0이므로, 이 워크플로가 실제로 게이트를 실행했는지 아니면 조용히 disable 됐는지는
    GitHub Actions 로그의 초록 체크에서 **구분되지 않는다** — 유일한 안전망이 바로 이 substring
    테스트인데 그게 뚫려 있다.
  - 제안: `run:` 텍스트가 "그 스크립트를 python 인터프리터로 호출한다"는 형태를 구조적으로 요구하도록
    강화. 예: 주석 제거 후 `re.match(r'(python3?\s+)?scripts/check-review-gate\.py(\s|$)', line)`처럼
    호출부의 **선두 토큰**을 요구하거나, 최소한 `echo`/`cat`/`grep` 등 비-실행 명령으로 감싼 형태를
    실패시키는 부정 케이스를 테스트에 추가.

- **[CRITICAL]** `test_the_job_condition_exempts_dependabot`이 `if:` 조건을 검증하는 정규식은
  `re.search` 방식이라 **조건식 전체가 아니라 부분 문자열 포함**만 확인한다.
  - 위치: `.claude/tests/test_review_gate_ci.py:392-402`. 대상: `.github/workflows/review-gate.yml:51`.
  - 상세: `assertRegex(cond, r"github\.actor\s*!=\s*['\"]dependabot\[bot\]['\"]", ...)`는 `cond` 문자열
    **어딘가에** 그 패턴만 있으면 통과한다. 실측: `review-gate.yml:51`의
    `if: github.actor != 'dependabot[bot]'`를
    `if: (github.actor != 'dependabot[bot]') && false`로 바꾼 사본에서 동일 스위트를 돌리면 **15개
    전부 `OK`**. 그런데 이 조건은 GH Actions 식으로 **항상 false** — 즉 `gate` job 자체가 **봇이든
    사람이든 모든 PR에서 영원히 안 돈다.** 도크스트링이 예시로 든 `!= false` 우회
    (라운드 1이 고쳤다는 그 클래스)보다 한 단계 더 나쁜 변형이 이 시점에도 안 잡힌다 — 봇 예외를
    깨는 정도가 아니라 워크플로 트리거 자체를 죽인다.
  - 제안: PyYAML로 파싱한 `if:` 문자열 전체를 정규식 **`fullmatch`**로 검증(가능하면 앞뒤 괄호까지
    포함해 "이 식이 곧 그 비교식이다"를 요구)하거나, 최소한 `&&`/`||`로 이어붙인 추가 피연산자가
    없는지 별도로 확인.

- **[WARNING]** `test_checkout_fetches_full_history`는 "그 job의 **어느** checkout 스텝이든 하나가
  `fetch-depth: 0`을 가지면" 통과 — 게이트 실행 시점에 실제로 유효한 체크아웃이 그것인지는 안 본다.
  - 위치: `.claude/tests/test_review_gate_ci.py:404-411`. 대상: `.github/workflows/review-gate.yml:55-57`.
  - 상세: `depths = [... for st in steps if uses.startswith('actions/checkout')]`; `assertIn(0, depths)`.
    실측: 기존 `fetch-depth: 0` 체크아웃 **뒤에** `with:` 없는(shallow) 두 번째
    `actions/checkout@v7`를 추가한 사본에서 스위트를 돌리면 15개 전부 `OK`. 순서상 두 번째 체크아웃이
    나중에 실행되므로 게이트 스크립트가 실제로 보는 작업 트리는 **얕은 클론**이 된다 — 정확히 이
    테스트가 막으려는 "merge-base 못 찾아 fail-open"이 재발할 수 있는 배치인데도 `0 in depths`가
    참이라 통과한다.
  - 제안: "게이트를 실행하는 그 run: 스텝 **직전**의 마지막 checkout"을 스텝 순서로 특정해 그 스텝의
    `fetch-depth`만 확인.

- **[WARNING]** `OneJudgeTest.test_the_script_performs_no_judgement_operations_of_its_own`은
  import/call **문법** allowlist만 검증하고, `review_guard.evaluate_review`가 실제로 **호출되어 그
  반환값이 판정에 쓰이는지**(데이터플로)는 검증하지 않는다.
  - 위치: `.claude/tests/test_review_gate_ci.py:220-328` (클래스), `:253` (해당 메서드).
  - 상세: `review_guard`를 import 하고 `_ = review_guard.evaluate_review`처럼 **참조만** 해
    `attrs`에 `"evaluate_review"`를 등장시키되 실제로는 절대 호출하지 않고 `main()`이 상수
    `blocked=False`를 항상 반환하는 뮤턴트 스크립트를 사본에 넣고 이 테스트 하나만 보면 `ok`
    (검증: `-v` 출력에 `test_the_script_performs_no_judgement_operations_of_its_own ... ok`). **단,
    같은 파일의 `ReviewGateCliTest` 8개 테스트는 이 뮤턴트로 즉시 실패**한다
    (`test_unreviewed_branch_is_reported_but_not_failed_by_default`,
    `test_enforce_turns_the_same_verdict_into_a_failure`,
    `test_notes_are_printed_on_both_verdicts` 등) — 파일 전체로는 `FAILED (failures=8)`이라
    이 사본은 실제 CI에서 걸린다. 즉 `OneJudgeTest` **자신의 주장**("판정 로직을 스스로 갖지
    않는다")은 이 뮤턴트로 거짓이 되면서도 정작 그 테스트는 초록이고, 그 사실이 형제 클래스의
    우연한 동반 커버리지로만 가려져 있다 — `OneJudgeTest`의 독스트링은 "이걸로 4차 우회를 전부
    닫았다"고 강하게 서술하는데, 실제로는 "import/call 흉내조차 안 내는" 이 형태는 애초에 그
    범주 밖이다.
  - 제안: `evaluate_review`가 **호출되는 Call 노드**(단순 attrs 등장이 아니라)로 존재하는지,
    그리고 그 호출 결과가 `blocked`/`reason`/`notes`를 채우는 데 쓰이는지를 최소한의 데이터플로
    체크(예: `main` 함수 바디 안에서 `evaluate(...)`가 호출되고 그 결과가 `decision`류 변수에
    바인딩된 뒤 `.blocked`/`.reason`으로 참조됨)로 보강. 최소 비용 대안: 이 클래스 docstring에
    "이 테스트 단독으로는 delegation 을 보증하지 않는다 — `ReviewGateCliTest` 가 실제 호출을
    고정한다"는 문장을 명시해 향후 리팩터가 그 전제를 깨는 것을 막을 것.

- **[INFO]** `_ALLOWED_IMPORTS` 가 동일한 값으로 **두 번** 정의돼 있다 (죽은 코드/복붙 잔재).
  - 위치: `.claude/tests/test_review_gate_ci.py:224`, `:227`.
  - 상세: 두 줄 모두 `_ALLOWED_IMPORTS = {"__future__", "argparse", "os", "sys", "review_guard"}`이고
    바로 위에 동일한 주석("스크립트가 실제로 쓰는 전부…")이 반복돼 있다. 지금은 값이 같아 무해하지만,
    이 클래스 자체가 "금지 목록은 우회를 상상하는 만큼만 강하다"는 교훈으로 4차 재작성된 파일이라
    — 향후 누군가 이 상수를 좁히거나 넓히면서 **첫 번째 줄만** 고치고 리뷰를 통과시키면(두 번째
    줄이 마지막에 평가되어 첫 수정이 조용히 무효화됨) 딱 이 파일이 경계하는 실패 모양 그 자체가
    재현된다.
  - 제안: 중복 줄 제거.

- **[INFO]** 같은 "substring 만으로 실행 여부 판정" 결함 클래스가 이 PR 범위 밖이지만 인접한
  `.github/workflows/harness-checks.yml`의 `Run harness unit tests` 스텝에도 그대로 남아있다 — 이
  스텝이 실제로 `python3 -m unittest discover ...`를 실행하는지 검증하는 테스트가 스위트 어디에도
  없다(`test_workflow_yaml_structure.py`는 구조적 유효성만, `test_harness_checks_paths_coverage.py`는
  `paths:` 커버리지만 본다). 이번 라운드의 변경 범위는 아니라 회귀는 아니지만, CI 백스톱을 다루는
  이 리뷰에서 동일 결함 클래스를 확인했으므로 등재.
  - 위치: `.github/workflows/harness-checks.yml:87-88`.
  - 제안: 별도 후속으로 동일한 구조적 검증을 이 스텝에도 적용할지 검토.

- **[해당 없음 — 확인된 양호 사례]** `ReviewGateCliTest`/`StopGuardFailOpenTest`의 스텁 클래스들이
  실제 `ReviewDecision`/`PlanDecision`의 인터페이스 모양(`push_blocks` 프로퍼티 등)을 의도적으로
  그대로 복제하고, 그 이유를 주석(#1057)으로 남겨둔 점은 "mock이 실제 동작과 괴리"되는 흔한 실패
  모드를 정확히 피하고 있다. 문제 삼을 것 없음.

---

## 요약

이번 라운드의 핵심 신규 파일(`test_review_gate_ci.py`)은 이미 3차례 하드닝을 거친 `OneJudgeTest`
(import+call allowlist)는 실측상 상당히 견고했다 — 2단 체인, 지역 별칭, `getattr`/`__import__` 우회
전부 AST 파서 앞에서 막히거나 `assertIsNotNone`으로 강제 실패했다. 그러나 같은 파일의
`WorkflowWiringTest`는 "구조로 판정한다, substring 이 아니라"는 스스로 적어둔 원칙을 두 개의
핵심 속성 — "그 스텝이 실제로 스크립트를 실행하는가"와 "봇 예외 조건이 정확히 그 비교식인가" —
에는 적용하지 못했다. 두 경우 모두 실측으로 확인했다: `review-gate.yml`의 `run:` 한 줄을 `echo`로
바꾸거나 `if:` 뒤에 `&& false`를 붙이는 것만으로 **CI 백스톱 전체가 영구적으로, 모든 PR에서 조용히
무력화**되는데 15개 테스트가 전부 그린을 유지한다. 관측 모드가 위반 시에도 항상 exit 0이라는 설계와
겹치면 이 무력화는 GitHub Actions 로그에서도 구분되지 않는다 — 즉 이 백스톱이 스스로 막으려던
"놓쳤다는 사실 자체를 인지할 주체가 없다"는 사각지대를, 워크플로 배선 축에서 그대로 재현하고 있다.
`fetch-depth` 검사와 `OneJudgeTest`의 (형제 테스트 의존적인) delegation 미검증은 상대적으로 낮은
severity지만 같은 계열의 갭이다. 나머지(스텁 충실도, 격리, 회귀 커버리지)는 양호하다. 별도로, 리뷰
도중 실제 워크트리에서 본 세션이 만들지 않은 파일 변경(`scripts/check-review-gate.py`)을 발견해
위에 그대로 보고했다.

## 위험도

CRITICAL
