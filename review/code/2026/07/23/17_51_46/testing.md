# 테스트(Testing) 리뷰

대상: `.claude/hooks/guard_review_before_push.py` §E fail-open 관측가능화 + `.claude/tests/test_guard_review_before_push_main.py` (신규 테스트 15건, 총 35건) + 관련 README/plan 문서. 이 diff 는 이미 2 라운드 리뷰(`16_55_04`: Warning 9, `17_22_18`: Critical 1 + Warning 5)를 거쳐 수정된 최종 상태다. 직접 subprocess 로 스위트를 실행하고, 과거 리뷰가 잡았던 3개 결함(리셋 술어 v1/v2/조기-return, 보고 호출 누락)을 재도입하는 뮤테이션을 걸어 현재 테스트가 여전히 이를 잡는지 재검증했다.

## 검증 재현 (직접 실행)

- `pytest .claude/tests/test_guard_review_before_push_main.py` → **35 passed**.
- `pytest .claude/tests/test_push_guard_allowlist.py` (동일 훅을 `load_module_by_path` 로 직접 로드하는 별도 스위트) → **36 passed, 135 subtests** — 이번 리팩터가 기존 회귀 테스트를 깨지 않음.
- `pytest .claude/tests/` 전체 → **501 passed, 249 subtests**.
- 뮤테이션 3건, 전부 기존 테스트가 포착:
  - `finally: _report_fail_open(...)` 호출 제거 → 13/35 실패.
  - 리셋 술어를 v1(`if not degraded: unconditional reset`)로 되돌림 → 3/35 실패(`test_a_blocking_gate_does_not_reset_the_other_gates_streak`, `test_bypass_does_not_clear_an_existing_streak`, `test_non_push_does_not_clear_an_existing_streak`).
  - 리셋 술어를 v2(`if outcome.bypassed or not outcome.answered`)로 되돌림 → 1/35 실패(`test_a_blocking_gate_does_not_reset_the_other_gates_streak`) — RESOLUTION(`17_22_18`)이 기록한 "세 번째로 틀린" 바로 그 CRITICAL 회귀를 이 한 테스트가 정확히 고립시킨다.

세 뮤테이션 모두 원복 후 35/35 재확인함.

## 발견사항

- **[INFO]** `_read_streak`/`_write_streak`/`_state_path` 의 손상 입력 경로가 직접 단위 테스트로 커버되지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:383-397` (`_state_path`, `_read_streak`) — 테스트 부재 지점은 `.claude/tests/test_guard_review_before_push_main.py` 전체(해당 함수를 in-process import 하는 테스트 없음, `grep`으로 확인)
  - 상세: `_read_streak`은 `streak` 값이 정수가 아니거나(`"3"`, `3.5`), 음수이거나, JSON 최상위가 dict 가 아니거나, 파일이 깨진 JSON일 때를 모두 `except Exception: return 0` 한 줄로 흡수한다. 이 self-healing 자체는 코드로 보아 타당해 보이지만, 그 판단을 뒷받침하는 직접 단위 테스트가 없다 — 현재는 subprocess E2E(`test_a_clean_run_resets_the_streak` 등 정상 경로만)로 간접 커버될 뿐, 손상된 state 파일을 직접 주입하는 테스트는 없다. `CLAUDE_PROJECT_DIR` 미설정 시 `os.getcwd()` 폴백 분기(385행)도 어떤 테스트에서도 실행되지 않는다.
  - 참고: 동일 갭이 이전 두 라운드(`16_55_04` SUMMARY INFO #9/#10, `17_22_18` RESOLUTION)에서 이미 식별·검토되어 "우선순위 낮음(subprocess e2e 간접 커버, self-heal 설계)"으로 의식적으로 defer 됐다. 새로 발견한 문제가 아니라, 그 판단이 이번 최종 상태에서도 여전히 유효함을 재확인.
  - 제안: 우선순위는 낮음. 손을 대게 되면 `_read_streak`/`_write_streak`를 직접 import 해 `{"streak": "3"}`, `{"streak": -1}`, `[]`(non-dict), 깨진 JSON 문자열 각각에 대해 `0`을 반환함을 확인하는 파라미터라이즈 테스트 1개면 충분.

- **[INFO]** `_run_gates`/`_report_fail_open`/`_Outcome`에 대한 in-process 단위 테스트가 전혀 없음 — 전량 subprocess E2E
  - 위치: `.claude/tests/test_guard_review_before_push_main.py` 전체(해당 심볼을 import 하는 라인 0건, `grep` 확인) / 대상 함수는 `.claude/hooks/guard_review_before_push.py:413`(`_report_fail_open`), `:490`(`_Outcome`), `_run_gates` 정의부
  - 상세: 이는 설계상 의도된 선택으로 보인다 — 테스트 모듈 docstring(`test_guard_review_before_push_main.py:1-17`)이 "REAL hook as a subprocess ... exactly as the harness invokes it"를 명시적으로 채택한 이유를 밝히고 있고, 실제로 하네스는 이 훅을 항상 별도 프로세스로 호출하므로 E2E 가 실제 계약에 가장 가깝다. 다만 그 대가로 개별 함수 단위 실패 지점의 국소화(예: 뮤테이션 시 어느 줄이 깨졌는지)는 stderr/state 파일 문자열 비교로만 가능하다. 위 뮤테이션 검증에서도 실패 메시지는 모두 `AssertionError`/`FileNotFoundError` 형태로 나타나 원인 규명에 약간의 추적이 필요했다(실제로는 어렵지 않았음).
  - 제안: 조치 불요 — E2E 우선 전략이 이 훅의 실제 실행 환경(하네스 subprocess)과 정확히 일치하고, 위 재현으로 실효성이 검증됐다. 다만 향후 세 번째 게이트가 추가되어 `_run_gates`/`_Outcome` 로직이 복잡해지면 순수 함수 단위 테스트 도입을 재검토할 가치는 있다(이미 INFO #5/#6 이 architecture 관점에서 유사 지적).

- **[INFO]** `test_detection_failure_is_observed_not_just_swallowed` 의 소스 문자열 치환 기법은 fragile 하지만 자가 가드가 있어 vacuous 하지 않음
  - 위치: `.claude/tests/test_guard_review_before_push_main.py:389-410`
  - 상세: 이 테스트는 `_is_git_push` 함수 시그니처 문자열을 정확히 매칭해 런타임 예외를 주입하는 방식으로 "탐지 코드 자체의 미처리 예외"를 재현한다. 시그니처가 바뀌면(타입힌트 제거 등) 매칭이 실패할 수 있는데, `self.assertNotEqual(broken, source, "the injection point moved")` 가드가 그 상황을 조용한 통과가 아니라 명시적 테스트 실패로 전환시킨다 — 좋은 방어 패턴. 실제로 실행해 정상 통과함을 확인했다.
  - 제안: 조치 불요. 현재 형태로 충분히 안전하다.

- **[INFO]** Mock 설계 — stub 두 개(`_REVIEW_STUB`/`_PLAN_STUB`)가 실제 dataclass보다 의도적으로 좁게 정의되어 필드 드리프트를 fail-loud 하게 잡음
  - 위치: `.claude/tests/test_guard_review_before_push_main.py:55-99` (docstring 51-54행에 근거 명시)
  - 상세: 실제 `review_guard.evaluate_review()`/`plan_guard.evaluate_plan()`이 반환하는 필드보다 stub 이 더 적은 필드만 노출한다. `main()`이 나중에 새 필드(예: `PlanDecision.complete_but_in_progress`)를 읽기 시작하면, mock 이 조용히 기본값을 주는 대신 `AttributeError`로 즉시 실패하도록 설계됐다 — mock 과 실제 동작 사이의 괴리를 사고가 아니라 계약으로 명시한 좋은 사례.
  - 제안: 조치 불요. 긍정적 발견으로 기록.

## 회귀 테스트 관점

기존 24건(REVIEW/PLAN 순서·BYPASS 격리·fail-open exception/import 경로·stdin 형태)이 이번 diff 이후에도 그대로 유효함을 실행으로 확인(35건 중 이 24건은 로직 변경 없이 통과). `test_push_guard_allowlist.py`(동일 훅을 별도 방식으로 import)도 영향 없음을 확인 — `_is_git_push` 자체의 시그니처·동작이 바뀌지 않았기 때문. `CLAUDE_PROJECT_DIR` 격리(`env["CLAUDE_PROJECT_DIR"] = self.tmp`, `test_guard_review_before_push_main.py:132`)가 `_run` 헬퍼에 추가되어, 신규 fail-open 테스트들이 실제 저장소 `.claude/state/`를 오염시키거나 테스트 간 streak 를 leak 하는 것을 방지 — 테스트 격리 관점에서 필수적이고 올바르게 구현됨(직접 실행으로 확인: 각 테스트가 `self.tmp` 하위의 독립된 state 파일만 건드림).

## 요약

3라운드에 걸쳐 지적된 CRITICAL 1건(리셋 술어 조기-return 취약점) + WARNING 9건이 모두 반영됐고, 반영 후 상태를 직접 재현·뮤테이션 검증한 결과 테스트 스위트(35건, 그중 관측성 15건)가 과거 세 번 재발한 리셋 술어 결함과 보고-호출 누락을 실제로 재현·차단함을 확인했다. 테스트 격리(`CLAUDE_PROJECT_DIR` 임시 디렉토리), 가독성(리뷰 이력을 인용하는 풍부한 docstring), mock 설계(좁은 stub 으로 fail-loud) 모두 우수한 수준이다. 남은 갭은 `_read_streak` 등 내부 함수의 손상-입력 직접 단위 테스트 부재뿐이며, 이는 이미 2차례 리뷰에서 식별·의식적으로 defer 된 낮은 우선순위 항목으로, 이번 재검토에서도 그 판단이 유효함을 재확인했을 뿐 새로운 결함은 아니다. 테스트 관점에서 이 diff 를 막을 이유는 없다.

## 위험도
LOW
