# 코드 리뷰 SUMMARY — 실패 알림 error 메시지 secret 마스킹

- 리뷰 대상: `277e6d314` (execution-engine `sanitizeErrorMessage` 에 `redactSecrets` 추가) + review-fix `3a522af2f`.
- reviewer: security / testing.
- 처분 상세: [`RESOLUTION.md`](./RESOLUTION.md).

## 전체 위험도: LOW

Critical 0 / Warning 1(처분 완료) + Info.

## Critical

| # | Checker | 위배 |
|---|---------|------|
| - | - | (없음) |

## 경고 (WARNING)

| # | Checker | 위배 | 처분 |
|---|---------|------|------|
| 1 | security | schedule-runner `dispatchScheduleFailedNotification` 가 raw err.message 를 인앱+이메일로 흘려 마스킹 우회(execution-failed/background 와 동일 위협) | **Fixed** — `sanitizeErrorMessage` 적용(commit `3a522af2f`) |

## 참고 (INFO)

| # | Checker | 항목 | 처분 |
|---|---------|------|------|
| 1 | security | 공유 SoT `SECRET_LEAK_PATTERNS` 가 bare JWT(`eyJ…`)·non-DB URI userinfo(`https://user:pass@host`) 미탐(선재 SoT 한계) | 별도 follow-up task 로 분리(SoT 전 소비처 개선) |
| 2 | security | strip→redact 순서 안전 확인(커버 스킴 내 토큰 누락 없음) | 정보성 |
| 3 | testing | 500자 boundary·mask-before-truncate·통합 회귀 테스트 부재 | **Fixed** — boundary(500/501)·mask-before-truncate·schedule_failed 마스킹 테스트 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| security | MEDIUM→LOW(fix 후) | 이번 diff 안전. schedule 경로 누락 WARNING 을 fix 로 해소. SoT 패턴 한계는 follow-up. |
| testing | LOW | 437 회귀 통과, exact-string 안전(URI redact 가 masking 앞). boundary 테스트 보강. |
