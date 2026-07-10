# RESOLUTION (최종 통합) — 실패 알림 secret 마스킹

선행 리뷰(09_17_14)의 findings 를 모두 처분한 최종 상태 확인:

- **security WARNING** (schedule-runner 실패 알림 마스킹 우회): **Fixed** — `dispatchScheduleFailedNotification` 에 `sanitizeErrorMessage` 적용(`3a522af2f`). execution-failed·background·schedule 3개 경로 전부 마스킹으로 방어 심도 통일. 회귀 테스트 추가.
- **security INFO** (SoT 패턴 bare JWT·non-DB URI userinfo 미탐): 공유 SoT 전 소비처 개선이라 별도 follow-up task 로 분리(이 PR 스코프 밖).
- **testing WARNING이하** (boundary/통합 테스트 부재): **Fixed** — 500자 cap 경계·mask-before-truncate·schedule_failed message 마스킹 테스트 추가.

Critical 없음. 최종 위험도 LOW. 검증(unit/lint/build/e2e 249) 완료.
