# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `main()` 뒤에 `if __name__ == "__main__": sys.exit(main())` 블록이 중복 삽입됨 (dead code)
  - 위치: `.claude/hooks/guard_review_before_push.py` L491-492 (신규 추가) / L495-496 (기존, 삭제 안 됨)
  - 상세: 리팩터가 기존 `main()` 본문의 REVIEW/PLAN 인라인 게이트를 `_run_gates()` + `try/finally: _report_fail_open(...)` 로 교체하면서, 그 직후에 새 entry-point 블록(`if __name__ == "__main__": sys.exit(main())`, L491-492)을 삽입했다. 그런데 파일 맨 끝에 원래 있던 동일한 블록(L495-496)이 diff 상 컨텍스트 라인(`|` 뒤 비어있는 게이트)로 남아 삭제되지 않았다. 실제 워크트리 파일을 직접 읽어 확인: 491행과 495행에 각각 `if __name__ == "__main__":` 이 존재한다. 런타임 동작은 무해하다 — `sys.exit()` 이 `SystemExit` 을 던져 프로세스가 즉시 종료되므로 두 번째 블록은 절대 도달하지 않는다. 하지만 diff 정리 실수의 흔적이며, 향후 누군가 첫 블록만 보고 수정하거나(예: cleanup 로직 추가) 두 블록이 갈라지면 "코드가 실행되는 줄 알았는데 안 됨/두 번 됨" 류의 혼란을 유발할 수 있는 구조적 결함이다.
  - 제안: 중복된 블록 중 하나(예: 신규 삽입된 491-493행)를 제거해 파일 끝에 entry point 가 한 번만 남도록 정리.

- **[WARNING]** 새 fail-open 관측 메커니즘이 `_is_git_push()`/`_read_payload()` 의 미처리 예외는 감시하지 못함 — 이 파일이 가장 취약하다고 스스로 기록한 코드 경로가 정확히 커버리지 밖에 남음
  - 위치: `.claude/hooks/guard_review_before_push.py` `main()` L474-488, 특히 L475(`_read_payload()`)·L479(`_is_git_push(command)`) 가 L484-488 의 `try/finally` **밖**에서 실행됨
  - 상세: 이 변경이 구현한 정책(§E, `plan/in-progress/harness-guard-followups.md` L197-232)은 모듈이 안고 있던 "3중 fail-open" — ① `_lib` import 실패, ② `evaluate_review`/`evaluate_plan` 호출 중 예외, ③ `main()` 미처리 예외 — 를 관측 대상으로 명시한다. 실제 구현은 `_run_gates()` 안에서만 ①·②를 `degraded` 리스트로 수집하고, `_report_fail_open()` 호출은 `_run_gates()` 를 감싸는 `try/finally`(L485-488) 안에서만 이뤄진다. 그런데 `_read_payload()`(L475)와 `_is_git_push(command)`(L479)는 이 `try` **이전**에 실행된다. `_is_git_push`/`_redact_inert_text` 는 이 파일 자신의 헤더 주석(L51-127)이 상세히 기록하듯 세 라운드 연속으로 실제 버그(ReDoS 지수 백트래킹, 인용부호 처리 오류, false-negative)가 재현된 코드다. 만약 이 함수(또는 `_read_payload`)에서 향후 미처리 예외가 다시 발생하면, 파이썬 기본 traceback 이 stderr 에 찍히는 것 말고는 — streak 파일 기록도, "게이트가 판정하지 못했다"는 명시 경고도, 연속 3회 escalation 도 — 전혀 발동하지 않는다. 즉 이 기능이 해소하려던 "가장 조용히 무력화될 수 있는" 시나리오(과거 실제로 발생했던 클래스)가 새 관측 레이어의 사각지대에 그대로 남는다. 회귀는 아니다(변경 전에도 이 경로는 관측되지 않았다) — 다만 plan 문서가 열거한 ③ 항목이 실질적으로 미해결로 남은 채 "완료"로 체크됐다는 점에서 설계 의도와 구현 범위 사이 간극이다.
  - 제안: `try` 블록을 `_read_payload()`/`_is_git_push()` 호출까지 확장하거나(단, `_is_git_push` 는 규모가 크면 조기 `return True`(block) 하므로 관측 대상에 넣을 때 그 경로도 함께 고려), 최소한 plan/코드 주석에 "③ 은 `_run_gates` 진입 이전 예외는 커버하지 않는다"는 known-limitation 을 명시.

- **[INFO]** 새 파일시스템 부작용: `.claude/state/push_guard_failopen.json` 상시 쓰기/삭제 — 의도된 것이며 이미 격리·가드됨
  - 위치: `.claude/hooks/guard_review_before_push.py` `_state_path()`(L367-369)·`_write_streak()`(L381-388)·`_report_fail_open()`(L391-428)
  - 상세: 이 diff 는 `git push` 시도마다(정확히는 gate 가 degraded 될 때/정상일 때 각각) `$CLAUDE_PROJECT_DIR/.claude/state/push_guard_failopen.json` 을 쓰거나(streak 기록) 지우는(리셋) 새 상시 파일시스템 부작용을 도입한다. 확인 결과: (1) `.claude/state/` 는 `.gitignore:19` 에 이미 등재돼 있어 실수로 커밋될 위험은 없음. (2) `CLAUDE_PROJECT_DIR` 미설정 시 `os.getcwd()` 로 폴백하는 패턴은 `guard_review_before_stop.py`/`guard_default_branch_bash.py`/`clear_resolution_in_flight.py`/`mark_resolution_in_flight.py`/`_lib/review_guard.py` 에 동일하게 이미 존재하는 기존 컨벤션이라 이 diff 가 새로 만든 리스크가 아니다. (3) 쓰기 실패(디렉토리 자리에 파일 존재 등)는 `_report_fail_open` 전체를 감싼 `except Exception: pass` 로 흡수되어 판정에 영향을 주지 않음 — `test_unwritable_state_dir_does_not_break_the_guard` 로 고정됨. (4) 테스트 파일(`test_guard_review_before_push_main.py` L128-132)이 공유 `_run` 헬퍼에 `CLAUDE_PROJECT_DIR` 격리를 추가해, 이 새 부작용이 실제 저장소의 `.claude/state/` 를 오염시키거나 테스트 간 streak 이 누출되는 것을 정확히 차단했다. 조치가 필요한 결함은 아니며, "예상치 못한 파일시스템 부작용"이 아니라 설계·테스트로 통제된 의도된 부작용임을 확인하기 위해 기록.

- **[INFO]** `_run_gates(degraded)` 가 출력을 리턴값이 아니라 인자로 받은 리스트에 append 하는 방식(out-parameter)
  - 위치: `.claude/hooks/guard_review_before_push.py` `_run_gates()` 시그니처 (전체 파일 컨텍스트 기준 L431)
  - 상세: `degraded: list[tuple[str, str]]` 를 호출자가 만들어 넘기고 함수가 그 리스트를 변형(mutate)해 결과를 전달하는 패턴이다. 부작용 관점에서는 "함수가 인자로 받은 가변 객체를 변경한다"는 전형적인 side-channel 이지만, 호출부가 `main()` 하나뿐이고 그 리스트가 함수 밖으로 다시 노출되지 않으며(그 직후 `_report_fail_open`에만 전달), docstring 에 명시돼 있어 실질적 위험은 없다. `_run_gates`가 향후 다른 곳에서도 재사용될 경우 호출자가 매번 빈 리스트를 새로 만들어야 한다는 점만 유의.
  - 제안: 현재로선 조치 불필요. 재사용 시점에 `(exit_code, degraded)` 튜플 반환으로 바꾸는 것을 고려.

- **[INFO]** 시그니처·공개 인터페이스·환경변수·네트워크·이벤트 콜백 관점 — 유의미한 변경 없음
  - 상세: `main()`(공개 계약: exit 0/2/other)은 그대로다. 새로 읽는 환경변수는 없다(기존 `CLAUDE_PROJECT_DIR`/`BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 만 재사용). 네트워크 호출 없음. `_is_git_push(command)` 가 `False` 인 모든(즉 대다수) Bash 호출 경로는 새 코드가 전혀 실행되지 않아(즉시 `return 0`), 이 훅이 붙어있는 PreToolUse(Bash) 전체 트래픽에 부작용 표면이 넓어지지 않았다 — 새 부작용은 `git push` 로 판정된 호출에만 국한된다.

## 요약

이번 diff 는 REVIEW/PLAN 게이트의 fail-open 을 "조용한 무력화"에서 "관측 가능한 이벤트"로 바꾸는 것이 목적이며, 새로 도입한 파일시스템 부작용(`.claude/state/push_guard_failopen.json` 쓰기/삭제)은 gitignore·CLAUDE_PROJECT_DIR 폴백 컨벤션·예외 흡수·테스트 격리 모두 잘 통제되어 있어 "예상치 못한" 부작용이라 보기는 어렵다. 다만 실제 파일에 diff 정리 실수로 보이는 `if __name__ == "__main__":` 중복 삽입(dead code, 기능 영향 없음)이 남아 있고, 더 중요하게는 이 기능이 관측하겠다고 plan 에 명시한 "3중 fail-open" 중 ③(`main()` 미처리 예외)이 실제로는 `_run_gates()` 진입 이전(`_read_payload`/`_is_git_push`)의 예외까지는 커버하지 못해 — 하필 이 파일 자신이 반복적으로 버그가 재현됐다고 기록한 코드 경로가 새 안전망의 사각지대로 남는다. 둘 다 회귀는 아니며 즉시 차단할 수준은 아니지만, 후자는 이 기능의 존재 목적과 직결되므로 문서화 또는 범위 확장이 바람직하다.

## 위험도

LOW
