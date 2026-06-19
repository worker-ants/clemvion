# Resolution — harness-test-watchdog

> SUMMARY: 같은 디렉토리 `SUMMARY.md` (위험도 MEDIUM, Critical 0 / Warning 3 / INFO 14)
> 처리: main 직접 (worktree subagent write 격리로 resolution-applier 위임 불가 — 메모리 `feedback_subagent_write_isolation_worktree`)
> 처리 일시: 2026-06-19

## 분류

| 발견 | 분류 | 조치 |
|------|------|------|
| WARNING 1 — 워치독 핵심 로직 자동화 테스트 부재 | **fix** | `.claude/tests/test_run_test_watchdog.py` 신설 (7 케이스) |
| WARNING 2 — `on_timeout_<stage>` cleanup hook dispatch 미검증 | **fix** | `test_timeout_dispatches_cleanup_hook` |
| WARNING 3 — TIMEOUT_MARKER 타이밍 의존성 미검증 | **fix** | 프로세스 그룹 kill / KILL 에스컬레이션 / passthrough 테스트로 마커 경로 전수 커버 |
| INFO 3·13 — 폴링 granularity | **fix** | `RUN_TEST_POLL_INTERVAL`(기본 5)·`RUN_TEST_KILL_GRACE`(기본 15) env 노출 + 헤더에 발화 범위 명기 |
| INFO 5·11·14 — forceExit 가 누수 마스킹 → 근본 수정(L3) 추적 | **defer (사용자 협의)** | 본 PR 은 hang 박멸(L1)+통과케이스 즉시종료(L2)까지. L3(`--detectOpenHandles` 진단 후 teardown fix)는 사용자와 별도 진행 |
| INFO 4 — cleanup hang 2차 보호 | **accept** | `\|\| true` 흡수 + 향후 `timeout 60 "$CLEANUP"` 여지. 현재 허용 범위 |
| 나머지 INFO (1·2·6·7·8·9·10·12) | **no-action** | 의도된 설계 확인 |

## 적용 변경

- **신규** `.claude/tests/test_run_test_watchdog.py` — stub `test-stages.sh`(`RUN_TEST_CONFIG` 주입) 로 `run-test.sh` 를 black-box 검증. 7 케이스:
  - `test_fast_pass_reports_pass` / `test_fast_fail_preserves_exit_code` — 워치독 투명성(빠른 경로 비간섭)
  - `test_hang_times_out_with_124` — hang → `status=TIMEOUT` exit 124
  - `test_timeout_dispatches_cleanup_hook` — `on_timeout_<stage>` 디스패치
  - `test_timeout_kills_whole_process_group` — 자식 `sleep` 가 그룹과 함께 사망(orphan 0)
  - `test_stubborn_process_escalates_to_sigkill` — TERM 무시 프로세스 → KILL 에스컬레이션
  - `test_timeout_zero_disables_watchdog` — `RUN_TEST_TIMEOUT=0` legacy passthrough
- **수정** `.claude/tools/run-test.sh` — 워치독 폴링/유예를 `RUN_TEST_POLL_INTERVAL`·`RUN_TEST_KILL_GRACE` env 로 튜닝 가능화(기본값 불변), 헤더 문서 보강.

## TEST 결과

- `.claude/tests` 전체: **106 passed** (기존 99 + 신규 7), 13.9s. 회귀 없음.
- 워치독 신규 스위트 단독: 7 passed, 13.5s.
- (참고) 구현 검증 단계에서: backend unit **7125 passed**(355 suites, forceExit 적용·15s 클린 종료), e2e **205 passed**(95s, `status=PASS` = forceExit 로 hang 없이 종료), 워치독 결정적 수동 검증 4종.

## 잔여 / 후속

- **L3 (forceExit 근본 수정)** — 사용자와 별도 진행. `--detectOpenHandles` 로 실제 누수처(`afterAll` 의 `app.close()`/connection 종료 누락 등) 진단 후 teardown fix.
- **fresh /ai-review (push 게이트)** — 본 후속 fix(테스트 신설 + env 노출)는 원 리뷰 이후 변경이므로, 머지/push 시점에는 fix 를 커버하는 fresh `/ai-review --branch main` 1회가 필요(메모리 `feedback_fresh_review_after_resolution`). 현재는 미push 상태라 보류.
- security / side_effect / maintainability reviewer 출력은 worktree subagent write 격리로 미기록(SUMMARY 에 사유·잔여위험 평가 명시).
