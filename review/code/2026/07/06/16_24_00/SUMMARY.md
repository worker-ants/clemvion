# Code Review 통합 보고서 (PR2 이메일 발송)

## 전체 위험도
**HIGH** — 이메일 CTA 링크가 존재하지 않는 프런트엔드 라우트(`/notifications`)를 가리켜 클릭 시 404 (CRITICAL 1). 핵심 발송 로직(채널 필터·batch 조회·best-effort 격리·XSS escape)은 정확·테스트 양호. side_effect/documentation output 디스크 갭.

## Critical 발견사항

| # | 카테고리 | 발견 | 위치 | 조치 |
|---|----------|------|------|------|
| 1 | requirement | 이메일 CTA `${frontendUrl}/notifications` 가 실재하지 않는 프런트 라우트 → 404. `/notifications` 페이지 없음, 알림은 사이드바 팝오버로만 노출 | mail.service.ts sendNotificationEmail/build*, mail.service.spec.ts | CTA 를 실재 랜딩 `/dashboard` 로 교체(팝오버 접근 가능). 코드+테스트 동시 수정 |
| 2 | scope (프로세스) | diff-base 오염 — stale 로컬 main 기준이라 PR1(#836) 재포함. 올바른 base(69d0f0a24..HEAD)로는 범위 이탈 없음 | (payload) | 코드 결함 아님 — 무시. (memory 기록 패턴) |

## SPEC-DRIFT
- `8-notifications.md` 이메일/email_sent_at "Planned" + "type별 템플릿" stale → 이미 `plan/in-progress/spec-update-notifications-email.md`(planner) 위임. CTA 수정 시 spec-update plan 도 반영.

## 경고 (WARNING)
| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| 1 | performance/concurrency | notify()/createMany() 가 dispatchEmails 를 inline await — SMTP 지연 블로킹. 현 호출자 전부 백그라운드라 영향 낮음 | **defer(문서화)** — 현 호출자 background, dispatchEmails 는 never-throw(floating promise 안티패턴 회피 위해 await 유지). PR3 latency-민감 경로 wiring 시 큐/decouple 재검토 |
| 2 | requirement | notify() JSDoc 이 이메일을 "후속 phase Planned" 로 서술(stale) | **fix** — JSDoc 갱신 |
| 3 | testing | dispatchEmails 부분 실패 격리(allSettled) 배치 미검증 | **fix** — 혼합 성공/실패 테스트 추가 |
| 4 | testing | sendNotificationEmail console transport 분기 미검증 | **fix** — console transport 테스트 추가 |

## 참고 (INFO) — 비차단
1. security XSS escape 양호. 2. subject/to CRLF 인젝션=기존 패턴 동일(PR3 재점검). 3. 대량 배치 SMTP 동시성=관찰 후 p-limit 고려. 4. SRP 확장(채널↑ 시 NotificationDispatcher 추출). 5. row 매핑 중복. 6. 에러 로깅 중복. 7~11. 저우선 테스트/주석(buildNotificationText escape 불요 주석=fix).

## 에이전트별
| 에이전트 | 위험도 |
|----------|--------|
| requirement | HIGH (CTA CRITICAL + SPEC-DRIFT + JSDoc) |
| security/performance/architecture/scope/maintainability/testing/concurrency | LOW |
| api_contract | NONE |
| side_effect / documentation | 재시도 필요(disk-write 갭) |

## 판정
critical=1(CTA) → **fix 필수**(BLOCK 해소 전 push 불가). WARNING 2/3/4 + INFO#11 fix, WARNING#1 defer(문서화). SPEC-DRIFT=spec-update plan 위임. disk-gap 2 reviewer=알려진 flakiness.
