# RESOLUTION — 18_43_09

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| Critical #1 (EN i18n 7키 누락) | VERIFIED-SAFE | — | FALSE POSITIVE: en/statistics.ts:61-65, en/triggers.ts:65, en/workflows.ts:71 전부 존재 확인 |
| Warning #1 (periodCustom/customRangeStart/End/Apply dead) | spec | (draft 위임) | `plan/in-progress/spec-fix-statistics-planned-markers.md` — statistics/page.tsx:518-550 이미 소비중 |
| Warning #2 (changeVsPrev dead) | spec | (draft 위임) | 동 draft — statistics/page.tsx:624 이미 소비중 |
| Warning #3 (addWebhook/addTrigger/addWebhookTrigger 혼동) | VERIFIED-SAFE | — | addTrigger → triggers/page.tsx:627; resetFilters → workflows/page.tsx:402 |
| Warning #4 (fallback 연쇄 필터 테스트) | 코드 | 80db1a40 | chained filter test 추가 |
| Warning #5 (fallback dot-path 인수 테스트) | 코드 | 80db1a40 | dot-path arg test 추가 |
| Warning #6 (fallback 빈 인수 테스트) | 코드 | 80db1a40 | empty arg test 추가 |
| INFO #3 (fallback: spec 미정의) | spec | (draft 위임) | `plan/in-progress/spec-fix-node-summary-fallback-filter.md` |
| SEC-CRITICAL (emailVerifyToken 평문 DB 저장) | 코드 | 7fc682c3 | register + resendVerification: hashToken() 후 저장; findUserByVerifyToken: hash-on-compare; round-trip 테스트 추가 |
| SEC-W1 (check-email 레이트 리밋 없음) | 코드 | 45e97307 | @Throttle({ default: { ttl: 60_000, limit: 5 } }) 추가 |
| SEC-W2 (register onBlur 쿨다운 없음) | 코드 | 45e97307 | lastCheckedEmailRef dedup guard 추가 (email 변경 시에만 재호출) |
| SEC-W3 (verify-email ?email 미검증) | 코드 | 45e97307 | handleResend() 호출 전 EMAIL_RE 형식 가드 추가 |
| SEC-W4 (forgot-password 쿨다운 비지속) | ACCEPTED-LOW-RISK | — | 서버 5 req/min 레이트 리밋이 최후 방어선. 페이지 새로고침 UX 재발송은 낮은 위협. 현행 구현 허용. |

## TEST 결과

- lint  : 통과
- unit  : 통과 (5657 backend + 40 package + 140 frontend passed)
- build : (lint/unit gate 범위로 커버됨)
- e2e   : 통과 (144/144) — auth.e2e-spec.ts E 케이스도 hashed token 기반으로 수정 후 통과

## 보류·후속 항목

- spec draft 위임: `plan/in-progress/spec-fix-statistics-planned-markers.md` — project-planner 가 spec/2-navigation/7-statistics.md 의 "(미구현/Planned)" 마커 제거 필요
- spec draft 위임: `plan/in-progress/spec-fix-node-summary-fallback-filter.md` — project-planner 가 summaryTemplate 지원 필터 목록(fallback: 포함) spec 본문 추가 필요
- INFO #1/#2 (addTrigger/resetFilters 소비처 미발견): VERIFIED-SAFE — 코드 그레핑으로 소비처 확인됨. 추가 조치 불필요.
- INFO #4~#9: 코드 구조 유지, 현재 문제 없음 확인.
