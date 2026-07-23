# 유지보수성(Maintainability) 코드 리뷰

대상: `.claude/hooks/guard_review_before_push.py`(§E fail-open 관측가능화), `.claude/tests/test_guard_review_before_push_main.py`. plan/review 산출물 파일(3~16)은 코드가 아닌 프로세스 문서이므로 본 관점 리뷰에서는 스코프 밖으로 취급(내용은 확인함).

## 발견사항

- **[INFO]** `_run_gates()`의 REVIEW/PLAN 게이트 블록이 4단계 중첩에 도달
  - 위치: `.claude/hooks/guard_review_before_push.py:488-504`(REVIEW), `:507-526`(PLAN)
  - 상세: `if BYPASS → else: if <gate>is None → else: try/except 뒤 if decision is not None → if decision.blocked: return 2` 순으로 조건이 4단 깊이까지 쌓인다. "중첩 깊이 과도 여부" 기준으로 보면 상한선(3단)에 걸쳐 있다. 기능은 정확하고 각 분기 의도는 인접 docstring(`_Outcome`)이 설명해 주지만, 새로 합류하는 유지보수자가 `decision`이 어느 분기에서 정의됐는지 추적하려면 4단을 모두 눈으로 따라가야 한다.
  - 제안: 급하지 않음(테스트 12건이 각 분기를 개별적으로 커버). 3번째 게이트가 추가되는 시점에 `_run_one_gate(name, evaluate_fn, bypass_env, is_degraded_react_fn, outcome)` 형태의 헬퍼로 추출해 중첩을 한 단계 줄이는 것을 권장. RESOLUTION의 INFO#6("3번째 게이트 생기면 재검토")과 동일한 결론.

- **[INFO]** REVIEW/PLAN 두 블록이 게이트 이름·호출 함수만 다른 사실상 동일 구조(5단계: bypass 확인 → None 체크 → try/except → answered 기록 → 판정)로 반복
  - 위치: `.claude/hooks/guard_review_before_push.py:487-526`
  - 상세: 이번 diff로 두 블록이 이전(단순 `if…except…if` 8줄)보다 커져(각 18줄) 중복 표면이 넓어졌다. 위 중첩 항목과 원인이 같다.
  - 제안: 상동(3번째 게이트 도입 시 헬퍼 추출). 지금 강행 추출은 과설계일 수 있음(YAGNI) — RESOLUTION도 같은 판단.

- **[INFO]** 예외 사유 문자열 포맷 `f"{type(exc).__name__}: {exc}"`이 3곳에 중복
  - 위치: `.claude/hooks/guard_review_before_push.py:499`(REVIEW), `:518`(PLAN), `:553`(DETECTION, `main()`)
  - 상세: 세 지점 모두 "예외를 사람이 읽을 한 줄 사유로 직렬화"하는 동일 로직을 재구현한다. 사소하지만 향후 포맷을 바꾸려면(예: traceback 요약 추가) 세 곳을 동기화해야 한다.
  - 제안: `_reason(exc: Exception) -> str: return f"{type(exc).__name__}: {exc}"` 헬퍼로 추출. 파급 낮음, 우선순위 낮음.

- **[INFO]** `_Outcome` 클래스가 이를 타입으로 참조하는 `_report_fail_open()`보다 뒤에 정의됨(전방 참조)
  - 위치: `.claude/hooks/guard_review_before_push.py:410`(`def _report_fail_open(outcome: _Outcome)`) vs `:468`(`class _Outcome:`)
  - 상세: `from __future__ import annotations`(파일 상단 36행)로 런타임 오류는 없으나, 위에서 아래로 읽는 독자는 `_Outcome`이 무엇인지 모른 채 `_report_fail_open`의 docstring·바디를 먼저 만난다. 파일 전체가 "왜"를 설명하는 데 공을 들이는 스타일임을 감안하면, 타입을 먼저 정의하고 이를 소비하는 함수를 뒤에 두는 순서가 읽기에 더 자연스럽다.
  - 제안: `class _Outcome` 정의를 `_state_path()` 앞(또는 `_report_fail_open` 바로 앞)으로 이동. 순수 재배치라 리스크 없음.

- **[INFO]** `_Outcome`이 저장소의 기존 관례(`@dataclass(frozen=True)` — `review_guard.ReviewDecision`, `plan_guard.PlanDecision`)와 달리 손으로 작성한 mutable 클래스
  - 위치: `.claude/hooks/guard_review_before_push.py:468-481`; 대조 `.claude/hooks/_lib/review_guard.py:154-155`, `.claude/hooks/_lib/plan_guard.py:77-78`
  - 상세: `_Outcome`은 판정(decision)이 아니라 누적기(accumulator)라 의도적으로 mutable해야 하므로 `frozen=True`는 부적합하지만, `@dataclass`(non-frozen, `field(default_factory=list)`)로도 동일한 의미를 더 짧게 표현할 수 있어 완전한 불일치까지는 아니되 스타일 차이가 눈에 띈다.
  - 제안: 선택 사항. 현재 3개 필드·단순 `__init__`이라 실익은 작음.

## 요약

전반적으로 이 변경은 이 파일 고유의 "왜 이렇게 했는가"를 촘촘히 남기는 스타일을 그대로 유지하며, 네이밍(`_FAILOPEN_*`, `_report_fail_open`, `_Outcome`)과 상수 도입 시 근거 주석을 다는 관례를 일관되게 따른다. 직전 리뷰 라운드(16_55_04)에서 지적된 실질적 결함(BYPASS의 streak 오염, `_run_gates` 진입 전 예외 미관측, 중복 `__main__` 블록, 테스트 경계값 갭)은 모두 RESOLUTION에서 해소되었고 재검증 결과 남아있지 않다. 이번 패스에서 새로 발견한 사항은 전부 INFO 수준으로, `_run_gates`의 게이트당 4단 중첩·REVIEW/PLAN 블록 중복(3번째 게이트 등장 시 재검토가 합리적), 사소한 문자열 포맷 중복, `_Outcome` 클래스의 전방 참조·컨벤션 편차 정도이며 어느 것도 가독성이나 정확성을 실질적으로 해치지 않는다. 테스트 스위트는 각 분기(중첩된 4단계 포함)를 개별적으로 커버하고 있어 복잡도가 은폐되어 있지 않다.

## 위험도
LOW
