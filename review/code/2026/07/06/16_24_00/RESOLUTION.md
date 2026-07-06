# RESOLUTION — PR2 이메일 발송 (16_24_00)

review session: `review/code/2026/07/06/16_24_00/` · risk=HIGH, Critical=1, Warning=4

## 조치 항목

| SUMMARY # | 유형 | 조치 | 결과 |
| --- | --- | --- | --- |
| CRITICAL 1 | requirement | 이메일 CTA `/notifications`(비존재 라우트, 404) → `/dashboard`(인증 랜딩, 벨 팝오버 접근)로 교체. mail.service.ts CTA + 근거 주석, mail.service.spec.ts 단언 동시 수정. spec-update plan 도 `/dashboard` 로 정정 | fixed |
| CRITICAL 2 | scope(프로세스) | diff-base 오염(stale local main → PR1 재포함) — 코드 결함 아님, 올바른 base 로는 범위 이탈 없음 | no_change_needed |
| SPEC-DRIFT 1 | — | 이메일/email_sent_at "Planned" + "type별 템플릿" stale → `plan/in-progress/spec-update-notifications-email.md`(planner) 위임(CTA=/dashboard 반영) | no_change_needed(위임) |
| WARNING 1 | perf/concurrency | notify()/createMany() 의 `await dispatchEmails` 블로킹 | **skipped(문서화 defer)** — 현 호출자 전부 백그라운드 워커, dispatchEmails 는 never-throw(floating-promise 안티패턴 회피 위해 await 유지). PR3 latency-민감 경로(API) wiring 시 큐/decouple 재검토 |
| WARNING 2 | requirement | notify() JSDoc 이 이메일을 "후속 phase Planned" 로 stale 서술 | fixed — JSDoc 갱신(dispatchEmails 위임 명시) |
| WARNING 3 | testing | dispatchEmails 배치 부분 실패 격리(allSettled) 미검증 | fixed — 2 email row 중 1 실패/1 성공 → 실패 row update 미호출 + createMany reject 안 함 테스트 |
| WARNING 4 | testing | sendNotificationEmail console transport 분기 미검증 | fixed — console transport debug 로그 + 발송 테스트 |
| INFO 11 | requirement | buildNotificationText escape 불요 근거 주석 부재 | fixed — 주석 추가 |

기타 INFO(row 매핑/에러 로깅 중복·SRP·CRLF·SMTP 동시성)는 비차단 저우선 — PR3/후속 폴리시.

## TEST 결과
- lint: 통과
- unit: 통과 (388 suites, 7665+ tests; fix 후 재실행)
- build: 통과
- e2e: 통과 (236 passed — Docker build cache prune(25GB) 후 postgres initdb 정상, fix 후 재실행)

## 보류·후속 항목
- WARNING 1 (email dispatch async decouple) → PR3(latency-민감 경로 wiring 시).
- SPEC-DRIFT 배지 flip + 템플릿 downscope 정정 → `spec-update-notifications-email.md`(planner).
