# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** 동일한 반복 문자열이 파일마다 다른 표기(`\uXXXX` escape vs 리터럴 UTF-8)로 흩어져 grep 이 깨진다
  - 위치: `.claude/tests/test_review_gate_ci.py:207`
  - 상세: `"⚠️  세션X: 하향 감지"` 라는 동일 문자열이 이 스위트 전역에서 advisory 를 나타내는 관용구로 반복 등장한다(`.claude/tests/test_block_integrity.py:333`, `:348`, `:370` 모두 리터럴 한글로 기재). 그런데 `test_review_gate_ci.py:207` 한 곳만
    `"        return ('⚠️  세션X: 하향 감지',)\n"` 처럼 `\uXXXX` escape 로 적혀 있다. 기능적으로는 동일한 문자열로 디코딩되어 테스트는 통과하지만(217행의 `assertIn("하향 감지", r.stdout)` 도 리터럴이라 문제없이 매칭됨), **소스 상에서는** 같은 개념을 찾는 `grep "하향 감지"` / `grep "세션X"` 가 이 발생 지점을 건너뛴다. 이 저장소는 "손-동기 쌍은 드리프트한다" 는 교훈을 여러 번 문서화해 온 만큼(README `test_review_gate_ci.py` 행 자체가 그 사례를 나열), 같은 리터럴을 찾을 때 파일마다 표기가 갈리는 것은 바로 그 부류의 마찰이다.
  - 제안: 다른 3곳과 동일하게 리터럴 `"⚠️  세션X: 하향 감지"` 로 바꾼다. 이 문자열을 담은 소스-문자열(stub 소스)이므로 이스케이프가 필요했다는 기술적 이유는 없어 보인다(다른 파일들도 같은 방식으로 소스-문자열 안에 리터럴 한글을 그대로 쓴다).

- **[WARNING]** 테스트 메서드 하나가 서로 독립적인 여러 불변식을 한꺼번에 검증 — 함수 길이·책임 과다
  - 위치: `.claude/tests/test_review_gate_ci.py:265` (`OneJudgeTest.test_the_import_and_call_surface_stays_small`, 265~355행, 약 91줄) 및 `.claude/tests/test_review_gate_ci.py:440` (`WorkflowWiringTest.test_the_expectation_still_describes_a_gate_that_runs`, 440~474행)
  - 상세: 두 메서드 모두 명확히 구분되는 여러 성질을 한 함수 안에서 각각 별도의 `ast.walk`/루프로 검증한다.
    - `test_the_import_and_call_surface_stays_small` : (1) import 허용목록, (2) 지역 별칭을 정본으로 되돌린 뒤의 호출 허용목록, (3) `getattr` 을 통한 모듈 속성 추출 금지, (4) 속성을 대입 대상으로 쓰는 것 금지, (5) `evaluate_review` 를 실제로 가져오는지 — 5개의 독립된 불변식이 하나의 테스트 이름 아래 묶여 있다.
    - `test_the_expectation_still_describes_a_gate_that_runs` : 게이트 step 정확히 1개 / `continue-on-error`·`if`·`timeout-minutes: 0` 부재(job+모든 step) / `pull_request` 트리거 키가 `paths` 뿐 / checkout 정확히 1개·`fetch-depth: 0`·게이트보다 앞순서 / `--enforce` 부재(관측 모드) — 6개의 독립된 불변식.
    라운드 4 이전에는 이런 성질들이 `test_the_gate_step_cannot_be_skipped_or_have_its_failure_swallowed`, `test_the_job_condition_is_exactly_the_bot_exemption`, `test_it_is_still_observation_only` 처럼 각각 이름 붙은 별도 테스트였다(이번 diff 에서 삭제됨). 특히 `test_it_is_still_observation_only` 는 자기 docstring에서 "켤 때 저자가 마주치는 이름이 이거여야 '지금 계약을 바꾸는 중' 임이 드러난다" 고 이름 자체의 발견 가능성을 설계 근거로 들었는데, 이번 통합으로 그 성질은 `test_the_expectation_still_describes_a_gate_that_runs` 안의 마지막 `assertNotIn("--enforce", ...)` 한 줄로 축소되어, `--enforce` 를 켰을 때 실패하는 테스트 이름만으로 "관측 모드 계약을 건드렸다" 는 것을 알아채기 어려워졌다.
  - 제안: 각 불변식을 이름이 곧 실패 사유가 되는 별도 assert 헬퍼(`_assert_no_failure_swallowing_keys(job, steps)`, `_assert_checkout_precedes_gate(...)` 등)로 추출하거나, 최소한 각각을 개별 `test_*` 메서드로 유지한다. 이번 파일이 이미 증명했듯(4라운드에 걸친 우회) 실패 메시지의 구체성과 이름의 발견 가능성이 이 스위트의 핵심 가치이므로, 통합이 그 가치를 깎지 않는 선에서 이뤄져야 한다.

- **[INFO]** 손으로 작성한 게이트/플랜 결정 stub 소스 문자열이 여러 파일·여러 지점에 중복 — 필드 하나만 교차 검증됨
  - 위치: `.claude/tests/test_block_integrity.py:640` (`PlanStubsMirrorTheRealInterfaceTest`, 교차 검증 가드) vs 실제 중복 지점들 — `.claude/tests/test_stop_guard_failopen.py:45`(`_CLEAN_REVIEW`)·`:135`(동일 클래스 본문 인라인 재작성) 및 `.claude/tests/test_review_gate_ci.py:195`(`test_notes_are_printed_on_both_verdicts`)·`:1189` 부근(`VerdictComesFromTheGateTest.setUp`)
  - 상세: `class _D: blocked = False\n reason = ''\n push_blocks = False\n def evaluate_review(...): return _D()` 형태의 결정 객체 stub 소스가 여러 파일에 손으로 반복 타이핑돼 있다. `PlanStubsMirrorTheRealInterfaceTest.test_every_plan_stub_defines_push_blocks` 가 모든 `test_*.py` 를 AST 로 훑어 stub 리터럴에 `push_blocks` 문자열이 있는지는 교차 검증하지만, 이는 "지금까지 알려진 결함(그 필드 누락)" 하나만 겨냥한 것이라 `ReviewDecision`/`PlanDecision` 인터페이스에 다른 새 필드(예: `notes`)가 추가되면 각 손-사본에 동일하게 반영해야 하는데 이를 강제하는 장치는 없다. 이 클래스 자체의 docstring 이 이미 "두 파일에서 같은 방식으로 두 번 발견됐다" 고 인정하는 실패 패턴이다.
  - 제안: 이번 변경 범위를 넘는 리팩터이므로 즉시 조치가 필요하진 않지만, `_harness.py` 에 `stub_review_decision(**overrides)` / `stub_plan_decision(**overrides)` 같은 소스-문자열 빌더를 두면 이후 필드가 늘어날 때 한 곳만 고치면 된다. (plan 문서의 §후속 12번 "fresh-interpreter 보일러플레이트 중복" 항목과 같은 성격의 개선이라 함께 트래킹해도 좋다.)

- **[INFO]** `WorkflowWiringTest.EXPECTED` 가 `review-gate.yml` 전체를 Python 리터럴로 재타이핑 — 의도된 트레이드오프이나 이중 유지보수 지점
  - 위치: `.claude/tests/test_review_gate_ci.py:385`~`421` (`EXPECTED`) vs `.github/workflows/review-gate.yml:20`~`73`
  - 상세: 4라운드에 걸쳐 부분 일치 검사가 매번 뚫린 끝에 나온 설계로, 클래스 docstring 이 "배선을 바꾸면 여기 기대값도 같이 바꿔야 하고 그 순간이 판단할 자리" 라고 트레이드오프를 스스로 명시하고 있다. 정당한 설계 선택이지만, 유지보수 관점에서는 워크플로를 고칠 때마다 두 파일(실제 YAML + 테스트 내 리터럴)을 동기화해야 하는 지점이 새로 생겼다는 사실 자체는 남는다.
  - 제안: 별도 조치 불필요 — 다만 향후 `review-gate.yml` 을 편집하는 리뷰어가 이 사실을 놓치지 않도록, PR 체크리스트/CI 실패 메시지에서 두 위치를 명시적으로 안내하는 것으로 충분하다(현재 `test_the_whole_workflow_matches_the_expected_wiring` 은 `assertEqual` 기본 diff 로 위치를 알려주므로 실질적으로는 이미 충족됨).

- **[INFO]** 4-분기 진리표가 이름 없는 위치 인자 튜플로 표현됨
  - 위치: `.claude/tests/test_review_gate_ci.py:493` (`VerdictComesFromTheGateTest._CASES = [(False, False, 0), (False, True, 0), (True, False, 0), (True, True, 1)]`)
  - 상세: `(blocked, enforce, expected_exit)` 의미를 주석으로만 설명하고 실제 자료구조는 익명 튜플이라, 항목을 늘리거나 읽을 때 위치로 의미를 되짚어야 한다. 4행뿐이라 당장 오독 위험은 낮다.
  - 제안: `NamedTuple`/`dataclass` 로 필드명을 부여하면(`Case(blocked=True, enforce=True, expected_exit=1)`) 각 행이 자기 서술적이 된다. 우선순위 낮음.

## 요약

이번 라운드(CI 백스톱 5R)의 핵심 변경 — `WorkflowWiringTest` 를 부분 일치에서 "파싱된 문서 전체를 하나의 기대값과 정확 비교" 로 반전하고, 판정자 단일성을 정적 금지목록 대신 행위 검증(`VerdictComesFromTheGateTest`)으로 고정한 것 — 은 유지보수성 관점에서도 건전한 방향이다. 각 테스트 클래스의 docstring 이 "왜 이런 형태인가" 를 라운드별 우회 이력과 함께 촘촘히 기록하고 있어, 다음 사람이 이 코드를 왜 이렇게 짰는지 재구성할 필요가 없다 — 이 저장소의 관례(서술적 docstring, 실패 메시지에 근거 포함)를 그대로 따른다. 실제 발견사항은 전부 지엽적이다: 한 곳의 유니코드 이스케이프 표기 불일치, 두 개 테스트 메서드가 여러 독립 불변식을 하나로 묶어 함수 길이/책임이 커진 것(그중 하나는 라운드 4까지 있던 이름-발견성 설계를 일부 희생), 그리고 손으로 반복 타이핑된 stub 소스 문자열의 부분적으로만 가드된 중복. 전부 기능에 영향을 주지 않으며 각각 독립적으로 손쉽게 고칠 수 있다.

## 위험도

LOW
