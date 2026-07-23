# 부작용(Side Effect) 리뷰 — guard_review_before_push.py §E fail-open 관측가능화

## 발견사항

- **[CRITICAL]** REVIEW 게이트가 (정상적으로) push 를 차단하면 PLAN 게이트가 실행되기도 전에
  기존 fail-open streak 가 조용히 리셋된다 — "양쪽 게이트가 모두 답했을 때만 리셋" 이라는
  이 기능 자신의 계약을 위반
  - 위치: `.claude/hooks/guard_review_before_push.py:429-438` (`_report_fail_open`, 특히 432행
    `if outcome.bypassed or not outcome.answered:`), 원인이 되는 단락은
    `.claude/hooks/guard_review_before_push.py:487-504` (`_run_gates` REVIEW 블록, 504행
    `return 2` 가 507행 이후 PLAN 블록에 도달하기 전에 함수를 빠져나감)
  - 상세: `_report_fail_open` 의 리셋 분기는 `outcome.answered` 가 **비어있지 않기만 하면**
    통과시켜 `os.remove(_state_path())` 를 호출한다. 그런데 `_run_gates` 는 REVIEW 게이트가
    `decision.blocked == True` 이면 PLAN 게이트 블록(507행부터)에 진입하지도 않고 그대로
    `return 2` 한다 — 이 경로에서 `outcome.answered == ["REVIEW"]` 뿐이고 PLAN 은
    `answered`/`degraded`/`bypassed` 어디에도 기록되지 않는다. 432행의 `not outcome.answered`
    는 리스트가 비어있는지만 보므로 `["REVIEW"]` 는 truthy → 조건 전체가 `False` → 조기
    return 없이 그대로 리셋 분기로 진입한다. 즉 "REVIEW 하나가 건강하게 차단했다" 는 사실이
    "PLAN 도 이번에 재확인되어 건강하다" 는 증거로 잘못 취급된다.
    docstring(413-421행)은 명시적으로 "clearing it takes positive evidence that the gates
    are working: a push where BOTH ran and answered" 라고 선언하지만 코드는 이를 구현하지
    않는다(어느 한쪽만 `answered` 여도 리셋됨).
  - **실측(직접 재현, 실제 subprocess 실행)**: PLAN 이 5회 연속 degraded 상태(streak=5, state
    파일에 `{"gate": "PLAN", ...}` 기록)인 것을 시뮬레이션한 뒤, REVIEW 게이트가 정상적으로
    차단하는 push 를 1회 실행 — exit code 2(정상 차단), stderr 에는 REVIEW 차단 메시지만 있고
    fail-open 배너는 전혀 없음(리셋 분기이므로 당연), 그런데 실행 후 `push_guard_failopen.json`
    이 완전히 삭제됨. PLAN 게이트는 이번 실행에서 **단 한 번도 재평가되지 않았는데** streak
    증거가 사라진 것이다.
  - 왜 심각한가: REVIEW 게이트가 차단하는 상황(미리뷰 `codebase/` 변경)은 일상적으로 발생하는
    흔한 경로다. PLAN 게이트가 실제로 깨져 있어(예: `_lib/plan_guard.py` import 실패) 몇 차례
    연속 degraded 로 기록되고 있더라도, 그 사이 REVIEW 가 정상 차단하는 push 시도가 단 한 번만
    끼어들면 PLAN 의 degraded 이력이 아무 경고도 없이 통째로 사라진다 — 이 기능 전체가 막으려는
    "게이트가 사실상 꺼져 있는데 아무도 모른다" 를 **다른 경로로 재현**한다. RESOLUTION.md 의
    W2(BYPASS 리셋)와 같은 클래스의 결함이지만 W2 의 수정(`degraded`/`bypassed`/`answered`
    3분류)이 놓친 변형이며, 신규 테스트 12건 중 이 조합(REVIEW 정상 차단 + PLAN 미실행 +
    기존 streak 보존)을 검증하는 케이스는 없다(`test_push_blocked_by_review_gate`,
    `test_review_gate_precedes_plan_gate` 모두 stderr 문구만 확인하고 streak 파일은 확인하지
    않음).
  - 제안: 리셋 조건을 "answered 가 비어있지 않음" 이 아니라 "REVIEW 와 PLAN 이 둘 다
    `outcome.answered` 에 있음"(또는 동등하게, degraded/bypassed/answered 어디에도 없는 게이트가
    없음)으로 좁힐 것. 예: `if degraded or set(outcome.answered) != {"REVIEW", "PLAN"}: return`
    (bypassed 는 이미 별도로 걸러짐). 회귀 테스트: 기존 streak>0 상태에서 `review="blocked",
    plan="clean"` 실행 후 streak 파일이 그대로 남아있는지 단언하는 테스트 추가.

- **[WARNING]** fail-open 배너가 stderr 로 나가는데, 이 저장소의 기존 관례상 exit 0(비차단)
  경로에서 모델/세션에 실제로 노출되는 채널은 stderr 가 아니라 **stdout** 일 수 있다 — 관측
  기능의 핵심 목적("LOUD")이 실질적으로 조용해질 위험
  - 위치: `.claude/hooks/guard_review_before_push.py:462` (`print("\n".join(lines),
    file=sys.stderr)`, `_report_fail_open` 내부, exit code 0 인 fail-open 경로에서 호출됨)
  - 상세: 이 파일 자신의 Contract docstring(10-13행)은 "exit 2 → block; stderr is shown to
    Claude as the refusal reason. any other → … fail-open." 이라고만 명시해, stderr 가
    모델에게 노출되는 것을 **exit 2(차단) 케이스에 한정**해 서술한다. 반면 같은 저장소의
    `.claude/hooks/guard_default_branch_bash.py` 는 정확히 "차단하지 않지만 모델에게
    알려야 하는" 동일한 문제를 이미 풀어본 선례인데, 그 파일은 명시적으로 `print(reminder)`
    로 **stdout** 에 쓰고 docstring 에 "prints a reminder to stdout … which the harness
    injects into the model's context" 라고 근거를 남겼다. 이 diff 의 배너는 정확히 같은 종류의
    "차단하지 않지만 모델이 알아야 하는 신호" 인데 stderr 를 택했다 — exit 0 에서 stderr 가
    모델 컨텍스트에 주입되는지는 이 코드베이스 자체 문서로 확인되지 않는다(오히려 다른 곳의
    stderr 사용은 전부 `traceback.print_exc` 같은 개발자용 진단이지 모델 대상 신호가 아니다).
  - 영향: 최악의 경우 배너가 사람이 verbose/transcript 모드로 터미널을 직접 들여다볼 때만
    보이고, 실제로 그 순간 작업 중인 모델(수정을 판단·실행할 주체)에게는 전달되지 않아
    "LOUD" 라는 정책 목표가 부분적으로 무력화될 수 있다. state JSON 파일은 여전히 남으므로
    완전한 회귀는 아니지만(다음 세션이 파일을 읽으면 알 수 있음), 실시간 관측이라는 1차
    신호는 약화될 수 있다.
  - 제안: 이 하네스에서 exit 0 시 stderr 가 실제로 모델 컨텍스트에 도달하는지 확인(실측)하고,
    안 된다면 `guard_default_branch_bash.py` 관례와 맞춰 stdout 사용을 검토하거나, JSON
    `hookSpecificOutput`/`additionalContext` 같은 확실한 채널을 쓸 것. 확인이 이미 됐다면 그
    근거를 docstring 에 한 줄 남겨 다음 리뷰가 같은 의문을 반복하지 않게 할 것.

- **[INFO]** `_run_gates(outcome)` 가 `outcome` 객체(리스트 3개)를 in-place mutate 하는
  출력 파라미터 스타일 — 순수성이 낮음(이미 이전 리뷰 INFO#5 로 식별·부분 개선됨, 신규 아님)
  - 위치: `.claude/hooks/guard_review_before_push.py:468-481`(`_Outcome`), `484-528`
    (`_run_gates`)
  - 상세: `_Outcome` 도입으로 이전의 리스트 3개 out-parameter 보다는 나아졌지만 여전히
    "호출자가 넘긴 객체를 채워서 돌려받는" 패턴이라 함수 자체의 반환값(`int`)만 보고는 어떤
    상태가 변했는지 알 수 없다. `main()` 의 `finally` 블록이 이 mutation 에 의존하므로,
    앞으로 `_run_gates` 를 다른 곳에서 재사용/테스트할 때 `outcome` 채우기를 빠뜨리면
    `_report_fail_open` 이 조용히 "아무 일도 없었다" 로 해석할 위험이 있다.
  - 제안: 조치 불요(현재 유일한 호출자는 `main()` 뿐). 두 번째 호출자가 생기면 `(exit_code,
    outcome)` 튜플 반환으로 전환 고려.

- **[INFO]** state 파일 read-increment-write 에 락 없음(lost-update) — RESOLUTION.md W4 에서
  이미 의식적으로 승인된 잔여 리스크이며 이번 diff 가 새로 만든 문제 아님
  - 위치: `.claude/hooks/guard_review_before_push.py:386-407` (`_read_streak`/`_write_streak`),
    `440-441`(`_report_fail_open` 내부 read-increment-write)
  - 상세: 동시 push 2건이 겹치면 카운트 1회가 유실될 수 있으나, 매 push 마다 무조건 출력되는
    배너(1차 신호)는 이 레이스의 영향을 받지 않는다. `.claude/state/` 는 `.gitignore:19` 로
    이미 제외되어 있고, 이 파일이 새로 쓰는 상태 파일도 그 규칙을 그대로 상속한다(리포지토리
    오염 없음 — 실측 확인).
  - 제안: 조치 불요(문서화된 트레이드오프 유지).

## 요약

`.claude/hooks/guard_review_before_push.py` 의 fail-open 관측가능화는 파일시스템 부작용(상태
JSON 읽기/쓰기/삭제)을 `.claude/state/`(기존 규약·`.gitignore` 상속)로 잘 격리했고, 테스트도
`CLAUDE_PROJECT_DIR` 를 임시 디렉터리로 오버라이드해 실제 저장소를 오염시키지 않도록 격리했으며,
`main()`/`evaluate_review`/`evaluate_plan` 의 공개 시그니처도 바뀌지 않아 기존 호출자(harness
PreToolUse 등록, subprocess 테스트)에 영향이 없다. 다만 이번 리뷰에서 실제로 재현한 **CRITICAL
결함 1건**을 발견했다 — REVIEW 게이트가 정상적으로 push 를 차단하는(PLAN 게이트가 실행되지도
않는) 매우 흔한 경로에서, `_report_fail_open` 의 리셋 조건이 "PLAN 도 이번에 재확인됐다"는
사실이 아니라 "REVIEW 하나만 답했다"는 사실만으로 만족되어, 기존에 쌓여있던 PLAN 게이트의
fail-open streak 를 아무 경고 없이 삭제한다. 이는 docstring 이 스스로 선언한 "BOTH ran and
answered" 불변식을 코드가 어기는 것이고, 이 기능 전체의 존재 이유(조용한 열화 방지)를 정확히
같은 방식으로 재현하는 회귀이므로 머지 전 수정이 필요하다. 부차적으로, fail-open 배너를 stderr
로 출력하는 선택이 exit 0 경로에서 실제로 모델에게 도달하는지 이 코드베이스 자체 관례(같은
저장소의 유사 기능은 stdout 사용)와 어긋날 수 있어 WARNING 으로 남긴다.

## 위험도
CRITICAL
