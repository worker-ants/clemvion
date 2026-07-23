# 동시성(Concurrency) 리뷰

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_guard_review_before_push_main.py`,
`.claude/tests/README.md`, `plan/in-progress/harness-guard-followups.md`,
`review/code/2026/07/23/{16_55_04,17_22_18}/*`(과거 라운드 산출물 커밋 — 문서이며 동시성 재검토 대상 아님)

이 훅은 스레드가 아니라 **`git push` 시도마다 별도 프로세스로 기동되는 동기 스크립트**다. 실질
동시성 표면은 여전히 하나뿐이다 — 같은 worktree(`CLAUDE_PROJECT_DIR`) 안에서 두 push 시도가
겹칠 때 공유 상태 파일 `.claude/state/push_guard_failopen.json` 에 대한 read-increment-write.
이번 라운드(`review/code/2026/07/23/17_51_46`)의 diff 는 그 파일을 다시 건드리지만, 실제 변경은
**단일 프로세스 내부의 순차 로직**(리셋 술어 수정, 배너 출력 순서, stdout/stderr 채널 선택)에
한정되며, 두 차례 앞선 concurrency 리뷰(`16_55_04`, `17_22_18`)가 이미 분석·승인한 락-없는
잔여 위험의 성격 자체는 바뀌지 않았다.

## 발견사항

- **[INFO]** 공유 streak 파일의 read-increment-write 레이스 — 기존에 2회 독립 리뷰로 식별·수용되었고, 이번 diff 로 코드 주석에 명시적으로 문서화됨 (신규 이슈 아님)
  - 위치: `.claude/hooks/guard_review_before_push.py` `_report_fail_open()` 내 `streak = _read_streak() + 1`(L453) → `_write_streak(streak, degraded)`(L482). 읽기/쓰기 구현은 `_read_streak()`(L389-396), `_write_streak()`(L399-410)
  - 상세: 두 push 프로세스가 겹치는 시간대에 둘 다 degraded 로 끝나면 같은 `streak` 값을 읽어 같은 값+1 을 쓰는 lost-update 가 여전히 가능하다. `16_55_04`/`17_22_18` concurrency 리뷰가 각각 이 지점을 WARNING 으로 지적하며 "판정 자체엔 영향 없고 관측 카운터 정확도에만 영향" 이라는 근거를 코드로 검증까지 마쳤고, RESOLUTION.md(`16_55_04`)는 W4 로 "의도적 잔여로 승인" 처리했다. 이번 diff 는 그 승인 근거를 docstring 안에 직접 못박았다 — `_report_fail_open` docstring L436-440: "Known residual (accepted): the read-increment-write of the streak is not locked, … Not worth `fcntl.flock` for an observability counter." 두 리뷰가 요구했던 "우연히 안전한 것과 의도적으로 받아들인 위험을 구분해 코드에 남겨라" 가 정확히 반영됐다.
  - 부가 실측: 이번 diff 가 바꾼 지점 — 배너 `print`(L475)를 `_write_streak`(L482) **이전**으로 옮긴 것 — 이 read→write 사이 창(window)을 아주 미세하게(문자열 조립+print I/O 시간만큼) 넓히지만, 그 창 안에서 유실될 수 있는 대상은 여전히 카운트 값뿐이고 1차 신호(배너)는 이 재배치로 오히려 더 안전해졌다(state 쓰기 실패가 배너까지 삼키던 구버전 결함(W2, `17_22_18`)의 수정). 즉 이 diff 는 이 레이스의 위험도를 낮추는 방향으로만 움직였다.
  - 제안: 조치 불요. 새 소비처가 streak 값을 정밀 신뢰해야 하는 방향(예: 자동 알림 트리거)으로 확장되면 그때 `fcntl.flock` 재검토 — 기존 두 리뷰의 결론과 동일.

- **[INFO]** state 리셋 경로의 TOCTOU 가 이번 diff 이전에 이미 해소됨 (재확인)
  - 위치: `.claude/hooks/guard_review_before_push.py:447-450` (`try: os.remove(_state_path()) except FileNotFoundError: pass`)
  - 상세: `16_55_04` maintainability/concurrency 리뷰가 `if os.path.exists(_state_path()): os.remove(_state_path())` 형태의 check-then-act 를 지적했었는데(RESOLUTION.md INFO #8), 현재 코드는 이미 `remove`-first + `except FileNotFoundError` 관용구로 정리되어 있다 — 동시 삭제/미존재 상황에서도 예외적으로 안전하다. 이번 diff 는 이 지점을 재변경하지 않았으나, 리셋 조건식만 `outcome.bypassed or not outcome.answered` → `outcome.bypassed or set(outcome.answered) != _ALL_GATES`(L445)로 바뀌었다. 이 조건 변경은 "이번 push 에서 실제로 카운터를 건드릴지" 를 좌우하는 순수 단일-프로세스 로직이며, 동시성 관점에서 새로 여는 창은 없다.
  - 제안: 없음(확인만).

- **[INFO]** 이번 diff 가 손댄 3곳(리셋 술어, 배너/쓰기 순서, stdout/stderr 채널 선택) 모두 프로세스 로컬 상태만 다룸 — 신규 스레드/락/공유 가변 상태 없음
  - 위치: `.claude/hooks/guard_review_before_push.py` `_report_fail_open()`(L413-487), `main()`(L553-584)
  - 상세: `stream = sys.stderr if exit_code == 2 else sys.stdout`(L474)는 프로세스가 소유한 두 파일 객체 중 하나를 고르는 것뿐이라 경쟁 대상이 아니다. `_Outcome`(L490-503)·`degraded`/`answered`/`bypassed` 리스트는 매 `main()` 호출마다 새로 생성되는 로컬 객체이고 전역/모듈 수준 가변 상태가 아니다. 테스트(`test_guard_review_before_push_main.py`)도 여전히 `subprocess` 를 순차 실행할 뿐 실제 동시 기동(`threading`/`multiprocessing`)은 도입하지 않았다 — 이 역시 두 선행 concurrency 리뷰가 이미 "결함이 아니라 합리적 트레이드오프" 로 판단한 부분과 동일하다.
  - 제안: 없음.

그 외 관점 점검: 데드락(락 자체가 없어 해당 없음), 동기화 프리미티브(mutex/semaphore 미사용 — 관측 카운터 목적상 과설계라는 기존 판단 유지), async/await·이벤트 루프·리소스 풀링(코드베이스에 비동기 실행경로·스레드풀·커넥션풀 없음 — 해당 없음)에서 이번 diff 로 인한 신규 지적 사항 없음.

## 요약

이번 라운드의 diff(`_run_gates`/`_report_fail_open` 리셋 술어를 `set(outcome.answered) != _ALL_GATES` 로 좁힌 CRITICAL 수정, 배너를 `_write_streak` 이전으로 옮긴 순서 수정, exit code 기반 stdout/stderr 채널 분기)는 모두 단일 프로세스 내부의 순차 로직 변경이며 스레드 세이프티·데드락·async/await·리소스 풀링에 영향을 주지 않는다. 이 코드의 유일한 동시성 표면인 `.claude/state/push_guard_failopen.json` 에 대한 락 없는 read-increment-write 는 두 차례 앞선 concurrency 리뷰(`16_55_04`, `17_22_18`)가 이미 상세히 분석해 "차단/허용 판정에는 영향 없고 관측 카운터 정확도에만 영향" 이라고 결론지었고, RESOLUTION.md 가 의도적 잔여로 승인한 사안이다. 이번 diff 는 그 트레이드오프를 코드 docstring(L436-440)에 직접 못박아 "우연히 안전함"과 "의도적으로 받아들인 위험"을 명시적으로 구분했고, 배너를 쓰기보다 먼저 출력하도록 재배치해 이 레이스가 1차 신호(배너)에 미칠 수 있는 영향을 오히려 줄였다. 새로 도입된 결함은 없다.

## 위험도

LOW
