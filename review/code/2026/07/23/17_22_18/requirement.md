# 요구사항(Requirement) 리뷰

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_guard_review_before_push_main.py`, `plan/in-progress/harness-guard-followups.md` (+ 이전 리뷰 라운드(16_55_04) 산출물 재수록분)

이 diff 는 `review/code/2026/07/23/16_55_04/RESOLUTION.md` 가 기록한 9건의 WARNING(§E 리뷰)을 코드에 반영한 결과물이다. W1(`__main__` 중복)·W3(`_run_gates` 진입 전 예외 미관측)·W5~W7(테스트 갭)·W8/W9(문서 동기화)는 실제 코드/테스트/plan 을 직접 열어 대조한 결과 **모두 정확히 반영되어 있음을 확인**했다(`__main__` 블록 1개만 남음: L559-560, `main()` 전체가 try/except/finally 로 감싸져 DETECTION 게이트가 계수됨: L536-556, plan 체크리스트 L342 가 `[x]` 로 갱신됨). 32개 테스트 전부 통과, harness 전체 스위트도 통과(479 passed / 249 subtests, `pytest .claude/tests`).

그러나 W2(BYPASS 가 활성 streak 를 리셋하는 문제)의 수정 자체가 **불완전**하다 — 아래 CRITICAL 참고.

## 발견사항

- **[CRITICAL]** streak 리셋 조건이 "두 게이트 모두 답했다"를 실제로 보장하지 못함 — REVIEW 가 정상적으로 **차단**하면(즉 `_run_gates` 가 조기 `return 2`) PLAN 은 이번 실행에서 **아예 평가되지 않는데도** 기존에 누적된 (PLAN 쪽) fail-open streak 가 리셋된다
  - 위치: `.claude/hooks/guard_review_before_push.py` `_run_gates()` L500-504 (REVIEW 의 `decision.blocked` 조기 `return 2`가 PLAN 블록(L507 이하)에 도달하기 전에 함수를 빠져나감) ↔ `_report_fail_open()` L431-433 (`if not degraded: if outcome.bypassed or not outcome.answered: return` — reset 을 막는 조건이 "bypass 없음 AND answered 가 하나라도 있음"만 확인하고, "PLAN 이 이번에 실제로 answered 목록에 들어갔는지"는 확인하지 않음)
  - 상세: `_report_fail_open()`의 docstring(L413-421)은 명시적으로 "clearing it takes positive evidence that the gates are working: a push where **BOTH** ran and answered" 라고 선언하고, `_Outcome` 은 REVIEW/PLAN 두 게이트를 각각 `degraded`/`answered`/`bypassed` 세 집합 중 정확히 하나에 넣는다는 암묵적 불변식 위에서 설계됐다. 그런데 REVIEW 가 `blocked=True` 로 정상 판정하면 `_run_gates()`가 `return 2`로 즉시 빠져나가면서 **PLAN 은 이 세 집합 중 어디에도 들어가지 않는다** — degraded 도 bypassed 도 answered 도 아닌, "이번 실행에서 아예 건드려지지 않음"이라는 네 번째 상태가 코드에 존재하지 않는데도 실제로는 발생한다. `_report_fail_open()`의 리셋 판정은 이 네 번째 상태를 "문제 없음"으로 오인한다: `degraded`가 비어 있고 `bypassed`도 비어 있으면(REVIEW 만 answered 에 들어 있어도) 무조건 리셋해 버린다.

    직접 재현(hook 을 실제로 subprocess 로 실행, `_lib` 스텁 사용):
    ```
    # 1) PLAN 이 두 번 연속 degraded (import_error) → streak == 2
    run(PUSH, review="clean",   plan="import_error")
    run(PUSH, review="clean",   plan="import_error")
    # streak == 2 확인됨

    # 2) REVIEW 가 정상적으로 차단(PLAN 은 여전히 import_error 지만 평가되지 않음)
    r = run(PUSH, review="blocked", plan="import_error")
    # returncode == 2 (정상, review gate 가 막음)
    # → streak 파일이 통째로 삭제됨 (streak == None)
    ```
    PLAN 의 `_lib/plan_guard.py` 는 이 순간에도 여전히 import 조차 안 되는 상태(실제로 고쳐지지 않음)인데, 단지 REVIEW 가 (이 push 와 무관한 사유로) 정상적으로 차단했다는 이유만으로 PLAN 의 2회 연속 degraded 기록이 통째로 사라진다. 이것은 W2 가 고치려던 것과 **정확히 같은 클래스의 결함**(무관한 게이트가 답했다는 사실이 다른 게이트의 건강 증거로 오인됨)이 BYPASS 경로가 아니라 REVIEW 의 조기-return(블록) 경로에서 재발한 것이다 — RESOLUTION.md 자신이 "여기서 내 첫 수정도 틀렸고 테스트가 잡았다"고 기록한 바로 그 실수 패턴이 다른 코드 경로로 다시 들어왔다.

    실사용 관점에서 이 결함의 파급력은 작지 않다: REVIEW 게이트가 "리뷰 안 된 codebase 변경을 막는다"는 정상 동작으로 차단되는 것은 이 훅의 **가장 흔한 일상적 이벤트**다. 즉 PLAN 쪽 게이트가 실제로 몇 주간 고장나 있어도, 그 사이 REVIEW 가 정상적으로(무관한 사유로) 한 번이라도 차단하면 PLAN 의 degraded 카운트가 0 으로 리셋되어 "3회 연속 시 에스컬레이션"이 사실상 영원히 발동하지 않을 수 있다 — 이 기능 전체의 존재 목적("게이트가 꺼져 있는데 아무도 모른다"를 막는 것)을 정확히 무력화한다. 확률적 레이스(concurrency WARNING #4, read-increment-write lost-update)보다 결정론적이고 재현 가능하다는 점에서 그보다 더 심각하다.
  - 제안: 리셋 조건을 "두 게이트가 실제로 answered 되었는가"로 명시적으로 강제할 것. 예: `_KNOWN_GATES = {"REVIEW", "PLAN"}` 을 두고 `if outcome.bypassed or set(outcome.answered) != _KNOWN_GATES: return` 처럼 **완전성(completeness)**을 확인하거나, 더 근본적으로는 REVIEW 가 차단을 결정한 뒤에도 (메시지는 출력하지 않되) PLAN 의 `evaluate_plan()` 을 계속 호출해 `outcome.answered`/`degraded` 를 채우도록 `_run_gates()` 를 조정할 것(단, `test_review_gate_precedes_plan_gate` 가 "PLAN 메시지가 stderr 에 나타나지 않아야 한다"만 요구하므로, PLAN 평가 자체를 계속하는 것은 기존 테스트 계약과 상충하지 않는다 — PLAN 의 판정 메시지만 억제하면 됨).

## 참고 (INFO)

- **[INFO]** plan §E 본문의 "테스트 7건" 서술이 실제 diff 로 추가된 테스트 개수(12개 신규, 파일 전체 32개)와 불일치
  - 위치: `plan/in-progress/harness-guard-followups.md` §E 본문(약 L232행대, "테스트 7건(...)")
  - 상세: 나열된 문구("import 실패·evaluate 예외 각각 계수 / 연속 누적·에스컬레이션 / 정상 시 리셋 / BYPASS 미계수 / 차단 경로에서도 보고 / 쓰기 실패 무해")를 카테고리 단위로 세면 7개가 맞지만, 실제 테스트 **메서드** 수는 12개(`grep -c "    def test_"` = 32, 이 diff 이전 대비 신규 추가분 12개)다. RESOLUTION.md 의 "32건" 은 정확함. 기능에는 영향 없는 문서 정밀도 문제.
  - 제안: 조치 불요(선택: "7개 시나리오"로 문구를 명확히 하면 혼동 방지).
- **[INFO]** `spec/` 에는 이 기능(fail-open 관측성)을 정의하는 문서가 없음 — SoT 는 `plan/in-progress/harness-guard-followups.md` §E 본문과 코드 자체의 docstring/주석이다. 이 파일들은 `.claude/` 하네스 도구이며 `codebase/` 제품 코드가 아니므로 SDD spec 체계 밖(관례와 일치, 결함 아님).

## 요약

이전 리뷰 라운드(16_55_04)가 지적한 9건의 WARNING은 코드·테스트·plan 문서 전반에 걸쳐 정확히 반영되었음을 직접 실행·대조로 확인했다(`__main__` 중복 제거, DETECTION 게이트 신설, plan 체크리스트 동기화, 테스트 갭 보강 등). 다만 그 중 W2("BYPASS 가 살아있는 streak 를 리셋")의 수정은 **BYPASS 경로만 막았을 뿐 같은 근본 원인(한 게이트의 결과가 다른 게이트의 건강을 증명하지 못한다)이 REVIEW 게이트의 정상 차단(조기 return) 경로에서 그대로 재발**하는 것을 실측으로 확인했다: PLAN 쪽이 실제로 여전히 degraded 상태(import 실패)여도 REVIEW 가 (무관한 사유로) 정상 차단하면 streak 파일이 통째로 삭제된다. 이는 이 diff 가 추가하려는 핵심 안전장치("연속 N회 fail-open 을 놓치지 않고 LOUD 하게 알리는 것")를, 이 훅의 가장 흔한 일상 이벤트(REVIEW 차단) 하나로 결정론적으로 무력화할 수 있는 기능적 결함이며, RESOLUTION.md 가 이미 한 번 발견·수정했다고 기록한 것과 동일 클래스의 버그가 다른 코드 경로로 재발한 것이므로 반드시 후속 수정이 필요하다.

## 위험도

CRITICAL
