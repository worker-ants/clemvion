# 테스트(Testing) 리뷰 — push guard fail-open observability (2회차, RESOLUTION 반영 후)

## 발견사항

- **[WARNING]** `test_unwritable_state_dir_does_not_break_the_guard` 가 실제로 검증해야 할 것(관측 배너 생존)을 검증하지 않는다 — 실측 결과 **state 쓰기 실패 시 fail-open 배너 자체가 완전히 사라짐**
  - 위치: `.claude/hooks/guard_review_before_push.py` `_report_fail_open()` 440-462행(`streak = _read_streak() + 1` → `_write_streak(streak, degraded)` → 배너 `lines` 구성 → `print(...)`) / 테스트 `.claude/tests/test_guard_review_before_push_main.py:412-423` (`test_unwritable_state_dir_does_not_break_the_guard`)
  - 상세: `_report_fail_open()` 는 `streak = _read_streak() + 1` 다음 줄에서 바로 `_write_streak()` 를 호출하고, 배너 텍스트 조립과 `print(..., file=sys.stderr)` 는 그 **뒤**에 나온다. `_write_streak()` 가 예외를 던지면(예: `.claude/state` 자리에 파일이 있어 `os.makedirs` 가 `FileExistsError` 를 던지는 경우) 함수 전체를 감싼 `except Exception: pass` 가 조용히 삼키므로 판정(`returncode`)은 영향받지 않지만, **배너 print 문 자체에 도달하지 못해 관측 신호가 완전히 사라진다**. 이 파일의 docstring(`_report_fail_open` 431-427행)은 "the PRIMARY signal — the per-push banner below — is printed unconditionally and cannot be lost to that race"(레이스에도 배너는 무조건 출력된다)라고 명시적으로 주장하는데, "state 디렉토리 자체가 쓰기 불가능"인 케이스에서는 이 주장이 실제로는 거짓임을 직접 재현으로 확인했다 (`STUB_REVIEW=import_error`, `.claude/state` 를 디렉토리 대신 파일로 만든 뒤 훅을 subprocess 로 실행하면 stderr 에 import 트레이스백만 남고 `⚠️ push guard: 게이트가 판정하지 못하고...` 배너는 전혀 출력되지 않으며 state 파일도 생기지 않음. 아래 "검증" 참고). 즉 "관측 가능하게 만든다"는 이 PR 의 목적 자체가, 그 목적을 지키기 위해 새로 만든 실패 처리 코드 안에서 **한 겹 더 안쪽에서 조용히 무너질 수 있다** — 정확히 이 기능이 없애려던 "게이트가 꺼져 있는데 아무도 모른다" 패턴이 관측 계층 자체에서 재현된 것.
    현재 테스트는 이 정확한 시나리오(state 디렉토리 쓰기 실패)를 실행하면서도 `r.returncode == 0` 만 단언하고 `"fail-open" in r.stderr` 또는 배너 텍스트를 단언하지 않는다 — 테스트 docstring 은 "Observability must never break the thing it observes" 라고 말하지만, 실제로는 "판정(verdict)이 깨지지 않는다"만 확인하고 "관측(observability) 자체가 살아남는다"는 확인하지 않아 이 회귀를 놓친다.
  - 제안: (a) 최소한 테스트 보강 — 이 케이스에서 배너가 실제로 나오는지(`assertIn("fail-open", r.stderr)`) 단언을 추가해 현재 갭을 드러낸다(현재 코드로는 FAIL 할 것). (b) 코드 수정 — 배너 `lines` 조립 + `print()` 를 `_write_streak()` **이전**으로 옮기거나, `_write_streak()` 호출을 자체 `try/except`로 감싸 쓰기 실패가 print 를 막지 못하게 한다. 이렇게 하면 "state 파일 쓰기가 실패해도 최소한 이번 push 에 대한 배너는 뜬다"는, 이 기능의 존재 이유에 더 부합하는 보장이 생긴다.

- **[INFO]** 연속 fail-open 도중 **어느 게이트가 깨졌는지 바뀌는** 경우(예: push1=REVIEW 만 degraded, push2=PLAN 만 degraded)에 대한 테스트가 없음
  - 위치: `.claude/hooks/guard_review_before_push.py` `_report_fail_open()` 429-441행 (`if not degraded: ... else: streak = _read_streak() + 1`) — 어느 게이트가 degraded 인지와 무관하게 리스트가 비어있지 않기만 하면 증가시키는 설계
  - 상세: 코드 자체는 "게이트 종류 무관, degraded 가 하나라도 있으면 증가"로 단순하고 버그 가능성이 낮아 보이지만, 신규 테스트 12건 중 이 조합(연속 push 사이에서 degraded 되는 게이트가 바뀜)을 실행하는 것은 없다 — 전부 "같은 게이트가 반복 degrade" 또는 "두 게이트가 동시에 degrade" 조합만 커버한다. `_write_streak` 가 매번 `degraded` 리스트를 최신 값으로 덮어쓰므로(과거 게이트 기록이 누적되지 않음) 동작은 맞겠지만, 이 특정 분기 조합을 직접 찌르는 테스트는 없다.
  - 제안: (우선순위 낮음) push1(REVIEW degraded, PLAN clean) → streak 1, push2(REVIEW clean, PLAN degraded) → streak 2 이고 state 파일의 `gates` 가 최신 push 의 게이트(PLAN)만 담고 있음을 확인하는 테스트 1건 추가.

- **[INFO]** 이전 라운드 WARNING 3건(에스컬레이션 경계, BYPASS+실제 고장 조합, 양쪽 동시 degraded) 재검증 — 전부 올바르게 해소됨
  - 위치: `test_consecutive_fail_opens_accumulate_and_escalate` (292-308행, `assertNotIn("‼️", ...)` 을 streak 1·2 에 추가), `test_bypassing_an_actually_broken_gate_is_still_not_counted` (340-348행, `review="import_error"` + `bypass_review=True` 조합), `test_both_gates_degraded_counts_once_and_names_both` (310-321행, streak==1 + 양쪽 게이트명 + state 파일의 `gates` 집합 검증)
  - 상세: 세 테스트 모두 실제로 실행해 확인했고(`pytest .../test_guard_review_before_push_main.py -q` → 32 passed), 이전 라운드가 지적한 정확한 경계(off-by-one, bypass-vs-degraded 구분, 동시 degraded 카운팅)를 찌른다. `test_bypass_does_not_clear_an_existing_streak`(350-369행)도 W2 회귀(리셋 조건이 "아무 게이트나 답하면"으로 잘못 완화되는 것)를 정확히 재현하는 시나리오(streak=2 상태에서 bypass 후에도 유지, 이후 진짜 clean 에서만 리셋)로 구성돼 신뢰할 수 있다.
  - 조치: 해당 없음 (긍정적 확인).

- **[INFO]** `_run_gates` 진입 전 예외(`_read_payload`/`_is_git_push`) 관측 — `test_detection_failure_is_observed_not_just_swallowed` 검증 방식이 소스 텍스트 치환(monkeypatch-by-string-replace)이라 다소 취약
  - 위치: `.claude/tests/test_guard_review_before_push_main.py:389-410`
  - 상세: 이 테스트는 훅 소스 파일을 통째로 읽어 `"def _is_git_push(command: str) -> bool:\n"` 문자열을 찾아 그 바로 뒤에 `raise RuntimeError(...)` 줄을 주입하는 방식으로 예외를 강제한다. `self.assertNotEqual(broken, source, "the injection point moved")` 가드가 있어 치환이 실패하면(예: 시그니처 문자열이 향후 바뀌면) 즉시 실패로 드러나므로 완전히 조용한 vacuous-pass 는 아니지만, 실제 함수를 감싸는 monkeypatch 대신 소스 텍스트 조작에 의존하는 것은 다소 깨지기 쉬운 접근이다(타입 힌트 문구가 바뀌거나 개행 스타일이 바뀌면 무해하게 실패). 다만 이 파일 전체가 "실제 훅을 subprocess 로 실행"하는 설계 원칙을 고수하고 있어(모듈 top-level 함수를 실행 전에 바꿔치기할 다른 손쉬운 방법이 마땅치 않음: import 시점에 이미 정의된 함수를 바꾸려면 결국 소스를 고치거나 별도 러너가 필요), 이 접근 자체를 문제로 보기보다는 현재 설계 제약 하의 합리적 타협으로 판단된다.
  - 제안: 조치 불요(현행 유지 가능). 향후 시그니처 문자열이 바뀌는 리팩터링 시 이 테스트도 함께 갱신해야 함을 인지.

## 요약

RESOLUTION 이 주장한 이전 라운드 3건의 테스트 갭(에스컬레이션 경계 미검증·BYPASS+실제고장 조합 미검증·양쪽 동시 degraded 미검증)은 신규/수정된 테스트로 정확히, 그리고 실행 확인상(32 passed) 올바르게 해소되었다. 다만 이번 라운드에서 추가된 `test_unwritable_state_dir_does_not_break_the_guard` 는 이름과 docstring 이 약속하는 것("관측이 관측 대상을 깨뜨리면 안 된다")의 절반(판정 불변)만 검증하고, 나머지 절반(관측 신호 자체가 이 실패 모드에서도 살아남는가)은 검증하지 않는다. 실제로 재현해 보면 `.claude/state` 쓰기가 실패하는 바로 그 시나리오에서 fail-open 배너가 완전히 출력되지 않아, 이 PR 의 핵심 목적("fail-open 을 조용히 두지 않는다")이 관측 계층 내부의 미처리 실패 순서(쓰기 → 배너 조립/출력) 때문에 다시 조용해질 수 있음을 확인했다. 이는 테스트 단언 강도 문제이자 동시에 코드 순서 문제(쓰기 실패가 print 도달을 막는 구조)이므로 WARNING 으로 분류한다. 그 외에는 테스트 격리(매 테스트 독립 tmpdir), mock 설계(stub 모듈이 실제 계약보다 의도적으로 좁게 설계돼 필드 추가 시 fail-loud), 가독성(각 테스트 docstring 이 검증 대상 계약을 명확히 서술)이 전반적으로 우수하다.

## 위험도
MEDIUM
