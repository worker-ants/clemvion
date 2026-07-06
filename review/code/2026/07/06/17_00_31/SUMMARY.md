# Code Review 통합 보고서 (PR2 convergence — 3rd round)

## 전체 위험도
**LOW** — 신규 CRITICAL 없음(3라운드 연속 0). 남은 항목: planner 위임된 SPEC-DRIFT + e2e/커버리지 보강 WARNING 2건(testing), 나머지 INFO. security/scope/maintainability/documentation output disk-write 갭.

## Critical
없음.

## 경고 (WARNING) — 둘 다 testing 커버리지
| # | 발견 | 조치 |
|---|------|------|
| 1 | e2e/DI 통합 부재 — 실 DB email_sent_at UPDATE + NotificationsModule→MailModule/User 배선이 unit mock 만 | **defer→PR3** — DI 그래프는 app-boot e2e(236 통과)가 검증. channel=email end-to-end 는 발사 소스(PR3) 존재 시 가능 |
| 2 | 동일 userId 다중 email/both 알림 시 emailByUser lookup 미검증 | **fix** — 동일 userId 2건 → sendNotificationEmail 2회 테스트 |

## 참고 (INFO) — 비차단
- SPEC-DRIFT: spec Planned/type별 → spec-update-notifications-email.md(planner) 위임.
- email_sent_at 실패 NULL 서술 보강 → spec-update plan §3.
- entity emailSentAt non-null 타입 = pre-existing 범위 밖.
- 생성자 2→4 인자, 모듈 의존 확대 = DI 안전(회귀 시 부팅 실패로 노출).
- await dispatchEmails 지연 = 16_24_00 defer 유지(PR3).
- 휴면 부작용 = 배포 전 channel 값 grep 확인 권고.
- 대량 배치 UPDATE 배치화 = 후속 최적화.

## 에이전트별
| 에이전트 | 위험도 |
|----------|--------|
| requirement/side_effect/testing | LOW |
| security/scope/maintainability/documentation | 재시도 필요(disk-gap) |

## 판정
critical=0, warning=2(testing). #2 fix, #1 defer(PR3, DI 는 app-boot e2e 검증). fix 후 final review 로 수렴.
