# RESOLUTION — 실패 알림 secret 마스킹 ai-review

| # | 출처 | Severity | 처분 |
|---|---|---|---|
| 1 | security | WARNING | **Fixed** — schedule-runner `dispatchScheduleFailedNotification` 에 `sanitizeErrorMessage` 적용(commit `3a522af2f`). execution-failed·background 와 함께 3개 실패-알림 경로 모두 마스킹돼 방어 심도 통일. schedule_failed 마스킹 회귀 테스트 추가. |
| 2 | security | INFO | 공유 SoT 패턴 한계(bare JWT·non-DB URI userinfo) → **별도 follow-up task 로 분리** (SoT 전 소비처 개선이라 이 PR 스코프 밖). |
| 3 | testing | WARNING이하 | **Fixed** — 500자 boundary(500 whole/501→ellipsis)·mask-before-truncate·schedule_failed message 마스킹 테스트 추가. |

## 검증
- unit: execution-engine/sanitize-error-message·schedule-runner·background-execution 등 통과, lint 0 error, build clean.
- **e2e: 249 pass** (무관 경로 회귀 없음).
