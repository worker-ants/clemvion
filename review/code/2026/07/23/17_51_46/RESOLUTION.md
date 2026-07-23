# RESOLUTION — §E 3라운드

리뷰: `review/code/2026/07/23/17_51_46/SUMMARY.md` — RISK=**LOW**, **Critical 0**, Warning 1.
forced 7명 전원 확보(`forced_missing: []`).

2라운드의 CRITICAL(리셋 술어)은 **여러 리뷰어가 독립적으로 재확인**해 해소·고정 판정.
뮤테이션 3건을 주입해 기존 테스트가 전부 포착함도 리뷰어가 실측 검증했다.

## Warning (1) — 반영

**모듈 최상단 docstring 이 방금 고친 v2 버그를 정확한 설명처럼 서술.**
`"A gate that answers cleanly clears the counter"` — 이게 정확히 CRITICAL 로 잡힌 v2 의미론이다.
`_report_fail_open` docstring 과 `.claude/tests/README.md` 는 이미 정확한데 최상단만 stale 이라,
**그것만 읽은 사람이 코드를 버그 쪽으로 "되돌릴" 수 있는 4번째 재발 경로**였다.

→ "EVERY gate 가 답해야 리셋. BYPASS·비-push·한 게이트가 먼저 차단한 push 는 모두 '증거 없음'
이지 '건강함'이 아니다" 로 교정하고, **3회 틀린 이력과 "truthiness 대신 `_ALL_GATES` 집합 비교"
라는 이유까지** 적었다. 숫자는 낡아도 "왜 이렇게 생겼는가" 는 낡지 않는다.

## INFO 중 반영한 것 (재발 위험을 실제로 줄이는 둘)

- **#6 게이트 식별자 상수화** — `"REVIEW"`/`"PLAN"` 리터럴이 8곳에 흩어져 있었다. 오탈자가 나면
  `set(answered) != _ALL_GATES` 가 영구히 참이 되어 **리셋이 조용히 죽는다**(fail-safe 방향이라
  더 안 잡힌다). `_GATE_REVIEW`/`_GATE_PLAN` 상수로 통일. 이 술어에서만 3번 틀렸으니 값싼 보험이다.
  실측: `_GATE_PLAN` 에 오탈자를 넣은 뮤턴트를 테스트가 포착.
- **#9 비-push 불변식 고정** — `main()` 이 이제 **모든** 명령을 `finally` 로 리포터에 통과시킨다.
  현재는 조건 불충족으로 no-op 이지만, 리셋 조건이 완화되면 평범한 명령에 디스크 부작용이 열린다.
  `test_non_push_command_allows` 에 `stdout == ""` + state 파일 미생성 단언 추가.

## INFO 중 미반영(사유)

- #2/#3/#4 (예외 원문 영속화·`CLAUDE_PROJECT_DIR` 미검증·lost update): 이전 두 라운드에서 이미
  검토·승인된 잔여. 특히 #4 는 이번 diff 가 **레이스 영향을 완화하는 방향**(배너를 쓰기보다 먼저)
  이라고 리뷰어가 명시.
- #5 (`_run_gates` 예외가 `DETECTION` 으로 오분류될 여지): `evaluate_*()` 예외는 이미 내부에서
  별도 처리되어 실제 도달 가능성이 낮다고 리뷰어도 판단. 라벨을 늘리면 표면만 늘어난다.
- #7 배너 대소문자 / #8 정책 설명 3중 서술: 둘 다 테스트로 고정된 의도된 배선. #8 은 다음 정책
  변경 시 `grep -n "_ALL_GATES\|EVERY gate"` 로 동시 갱신하라는 리뷰어 조언을 그대로 따른다.
- #10/#11/#12 (손상 state 단위테스트·in-process 단위테스트·BYPASS+degrade 조합): 이전 라운드에서
  의식적 defer. subprocess E2E + 뮤테이션으로 실효성이 확인된 상태.
- #13 docstring 영어 인용구: 이전 라운드 팀 결정 완료.

## 검증

- `test_guard_review_before_push_main.py` **35건**, 전체 하네스 스위트 **501건 OK**.
- 뮤턴트: 게이트 상수 오탈자 → 포착. (이전 라운드의 리셋 술어·배너 순서·채널 뮤턴트도 유효.)

## 수렴 판단

궤적: 1R CRITICAL 3 → 2R Critical 0/W9 → 2R' CRITICAL 1 → **3R Critical 0 / W1(문서 전용)**.
이번 라운드의 유일한 Warning 은 코드가 아니라 서술이었고, 반영 내용도 docstring 교정 +
상수화 + 단언 추가로 **동작 무변경**이다. 여기서 수렴으로 보고 PR 을 올린다.
