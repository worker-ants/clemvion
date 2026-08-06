# 문서화(Documentation) Review — round 12 (CI backstop)

## 발견사항

- **[WARNING]** plan 문서의 "라운드를 거듭한 경화 이력" 표가 10R 에서 멈춰 있다 — 이번 라운드의 핵심 CRITICAL(actions/checkout 위상에서 base 해석이 네트워크로 떨어지고, 그게 실패하면 "codebase 변경 없음 — 허용"으로 읽히는 결함, 즉 백스톱이 정작 CI 환경에서는 무력했던 그 결함)이 이 표에 행으로 없다.
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:18` (상단 상태 요약 "배선 가드 경화 | **1R~10R 진행 중**"), `plan/in-progress/harness-review-gate-ci-backstop.md:24-46` (라운드별 표, 1R~10R까지만 있고 11R/12R 행이 없음)
  - 상세: 이 표는 문서 자체가 "실제 어려움은 전부 '이 배선이 조용히 꺼지지 않음'을 어떻게 강제하느냐였고, 매 라운드 뚫렸다"고 밝히는, 이 티켓의 핵심 서술 장치다. 그런데 `.claude/_shared/git_probe.py`의 `_default_branch()` 주석(146-163행)과 `.claude/tests/test_review_guard_hardening.py`의 `ActionsCheckoutTopologyTest`(812-948행, docstring: "이 층은 CI 를 위해 만들어졌는데, **정작 CI 환경에서 아무것도 안 하고 있었다**")가 상세히 기록하는 이 결함 — 오케스트레이터 CONTEXT 자체가 "the one that mattered most"라고 부르는 바로 그 결함 — 이 표에는 등재돼 있지 않다. 문서 내에서 유일하게 이 결함을 언급하는 자리는 13번 항목("테스트 픽스처가 공유 `.git/config` 를 오염시킬 수 있다")인데, 그마저도 **결함 자체가 아니라 그 결함을 재현하던 중 생긴 부수 사고(fixture 가 공유 config 를 오염시킨 사고)**만 서술한다. 표만 읽는 독자는 "10R 에서 손-작성 목록을 AST 도출로 바꿨다"까지만 알고, 그 뒤에 발견된 가장 심각한 결함(백스톱이 실제 CI 위상에서 inert 했다는 것)은 전혀 모르게 된다.
  - 제안: 11R(또는 다음 라운드 번호) 행을 표에 추가해 `_default_branch()`의 네트워크 폴백 실패 → "변경 없음"으로 오독되는 결함과 `refs/remotes/origin/<name>` 프로빙으로의 수정을 기록하고, 상단 상태 줄의 "1R~10R"도 갱신할 것.

- **[WARNING]** `.claude/tests/README.md`의 `test_review_guard_hardening.py` 행이 이 라운드에 추가된 `ActionsCheckoutTopologyTest` 를 전혀 언급하지 않는다.
  - 위치: `.claude/tests/README.md:57`
  - 상세: 해당 행은 "checkout-/rebase-immune freshness rework", "rebase author-date regression", "resolution-in-flight suppression" 등은 서술하지만, 파일에 실제로 있는 `ActionsCheckoutTopologyTest`(actions/checkout 위상을 `init`+`remote add`+`fetch`로 직접 재현해 `_default_branch()`가 네트워크 없이 정답을 내는지, 그리고 미리뷰 변경이 "변경 없음"으로 오독되지 않는지 검증하는 클래스)는 등재돼 있지 않다. `.claude/tests/test_tests_readme_catalog.py`는 파일명 행의 유무만 검사하고(코드 확인함: `_ROW` 정규식으로 `test_*.py` 파일명 존재 여부만 대조) 행 **내용**의 최신성은 검사하지 않으므로, 이 누락은 어떤 가드에도 걸리지 않는다.
  - 제안: 해당 행에 `ActionsCheckoutTopologyTest` 한 문장을 추가 — 이 클래스가 백스톱이 CI 환경에서 실제로 판정을 내는지 증명하는, 이 라운드의 가장 중요한 회귀 테스트이기 때문에 우선순위가 높다.

- **[WARNING]** `.claude/tests/README.md`의 `test_plan_guard.py` 행이 `GitProbesAreNotReDuplicatedTest`를 라운드 9 시점 모습으로 서술한다 — 실제로는 라운드 10에서 열거식(hand-written list) 검사가 AST 도출식 검사로 전면 재작성됐다.
  - 위치: `.claude/tests/README.md:62`
  - 상세: README는 "both object identity and the absence of a local `def` are asserted"라고 적는데, 실제 `test_plan_guard.py`의 `GitProbesAreNotReDuplicatedTest`(파일 내 334-404행)는 이제 (a) 세 모듈의 AST를 서로 비교해 본문이 동일한 함수가 남아 있으면 실패시키는 `test_no_identical_function_survives_in_two_guards`와 (b) `_shared`에 노출된 모든 프로브가 각 훅에서 실제로 같은 객체(위임)인지 확인하는 `test_the_shared_probes_are_the_same_objects_everywhere` 두 테스트로 구성돼 있다. 그리고 그 docstring은 "9R 이 다섯 개를 옮겼는데 **10R 이 여섯 번째(`_current_branch`)를 찾아냈다** — 통합도 그것을 지키는 가드도 손으로 쓴 목록이었기 때문이다. 그래서 이제 목록을 쓰지 않는다"고 명시한다. README는 이 라운드-10 재설계("목록 → 도출")와 그 계기가 된 CRITICAL(`_current_branch` 누락)을 언급하지 않고 라운드 7~9까지만 서술해 stale 하다.
  - 제안: "round 9 found a third in `branch_guard.py`" 뒤에 "round 10 found a sixth (`_current_branch`) still missed by the hand-written list, so the guard now derives duplicates via AST comparison instead of enumerating them" 정도를 추가.

- **[INFO]** `.claude/_shared/git_probe.py`의 `_default_branch()` 주석(actions/checkout 위상 결함 설명)이 이 파일의 다른 모든 이력 주석과 달리 라운드 번호를 명시하지 않는다.
  - 위치: `.claude/_shared/git_probe.py:146-163` (비교 대상: 같은 파일 10-18행 "Round 7"/"Round 8", 24행 "Round 9"/"round 10")
  - 상세: 이 파일의 모듈 docstring과 `_run_git()` 위 주석은 모든 역사적 결함을 "Round 7", "round 8", "Round 9", "round 10" 식으로 명시적으로 인용해 plan 문서의 라운드 표와 대조 가능하게 해 왔다. 그런데 정작 (오케스트레이터 CONTEXT가 "the one that mattered most"라 부르는) 가장 중대한 결함을 설명하는 `_default_branch()`의 주석 블록에는 그 관례가 깨져 라운드 번호가 없다. 코드 정확성에는 영향 없지만, 이 파일 자체가 세운 인용 관례를 스스로 어겨 plan 문서의 이력 표와 교차 참조하기 어렵게 만든다 — 위 첫 번째 WARNING(표에 해당 라운드 행이 없음)과 같은 뿌리의 증상이다.
  - 제안: 실제 라운드 번호(plan 문서 항목 13이 "11R"로 특정하고 있음)를 이 주석에도 명시.

- **[INFO]** plan 문서의 "신규 후속 (defer)" 항목이 `branch_guard._origin_default_branch()`를 "정본(canonical)"이라 표기하는데, `git_probe.py` 자신의 docstring은 그 함수가 이제 `_shared`로 이전됐다고 명시해 표현이 어긋난다.
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:210-216`
  - 상세: 해당 항목은 "origin 기본 브랜치 해석이 4곳에 독립 구현돼 있다: `branch_guard._origin_default_branch()`(정본) · `review_guard._default_branch()` · `code_review_orchestrator._default_branch_ref()`(이번 신설) · `consistency_orchestrator` 의 리터럴"이라 적는다. 그러나 `.claude/_shared/git_probe.py` 모듈 docstring(27-29행)은 "`branch_guard`'s `_origin_default_branch` moved here too, so `_shared` no longer reaches back into `hooks/_lib` to borrow it"라고 명시하고, `branch_guard.py`(58행) 자신도 `_origin_default_branch = _git_probe._origin_default_branch`로 위임만 한다 — 즉 이 함수의 정본 위치는 이미 `branch_guard.py`가 아니라 `_shared/git_probe.py`다. `review_guard._default_branch`도 마찬가지로 `git_probe._default_branch`에 위임한다(review_guard.py 208행). "4곳에 독립 구현"이라는 서술은 두 함수(`_origin_default_branch`, `_default_branch`)가 서로 다른 반환 계약을 갖는다는 실질적 요점은 여전히 유효하지만, "어디에 구현이 사는가"에 대한 서술은 라운드 9/10 통합 이후로 정확하지 않다.
  - 제안: "정본" 표기를 `branch_guard._origin_default_branch()`에서 `_shared/git_probe._origin_default_branch()`(그리고 `_default_branch()`)로 정정 — 실제 독립 구현으로 남은 것은 `code_review_orchestrator._default_branch_ref()`와 `consistency_orchestrator`의 리터럴 2곳뿐임을 명시하면 백로그 항목의 범위가 더 정확해진다.

## 요약

코드가 결정하는 판정 로직(git_probe.py, plan_guard.py, branch_guard.py, review_guard.py, check-review-gate.py, 워크플로 YAML)의 인라인 문서화는 이번 라운드에도 이례적으로 두텁고 정확하다 — 각 함수·분기·주석이 "왜"를 라운드 번호와 함께 구체적으로 기록하고, 새 CI-토폴로지 결함은 전용 회귀 테스트(`ActionsCheckoutTopologyTest`)로도 고정돼 있다. 문제는 코드 자체가 아니라 이 프로젝트의 **이력을 요약하는 두 문서** — plan 파일의 "라운드별 경화 이력" 표와 `.claude/tests/README.md`의 "What's covered" 표 — 가 정확히 이번 라운드가 고친 그 결함(및 그 결함을 증명하는 신규 테스트 클래스)을 반영하지 못했다는 점이다. 둘 다 어떤 자동 가드도 잡지 못하는 형태의 drift라, 다음 라운드에서 "이미 고쳐진 결함"을 재발견하거나 신규 테스트 클래스의 존재를 놓치기 쉽다. 기능적 결함은 없으며 전부 문서 갱신으로 닫힌다.

## 위험도

LOW
