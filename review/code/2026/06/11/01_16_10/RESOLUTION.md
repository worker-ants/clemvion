# RESOLUTION — 01_16_10

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드(docs) | 0d679d6a | `makeshop.{mdx,en.mdx}` — "토큰 갱신 및 만료" 절 신설. refresh-capable 동작·알림 정책 명기 |
| #2 | 코드(docs) | 0d679d6a | `integration-management.{mdx,en.mdx}` L71 callout — refresh_token 자동 갱신 지원 통합은 passive 알림 없음 문구 보완 |
| #3 | 코드 | 0d679d6a | `getNotifResourceIds` — `flatMap` 기반 전체 호출 통합 검사로 견고화 |
| #4 | 코드 | 0d679d6a | `hasSavedExpired` — `calls.some(...)` 형태로 전체 호출 체크로 견고화 |
| #5 | 코드 | 0d679d6a | cafe24 7d·makeshop 3d 면제 테스트 `getNotifResourceIds` 헬퍼 사용으로 통일 |
| #6 | 코드 | 0d679d6a | `integration-status-reason.ts` `token_expired` 인라인 주석 — 기본 1줄만 유지, namespace 경고 별도 주석 라인으로 분리 |

## TEST 결과

- lint  : 통과 (33s)
- unit  : 통과 (40 passed, 35s)
- build : (lint/unit 통과 확인; build 별도 단계 생략 — unit stage 포함)
- e2e   : 통과 (184/184, 83s)

## 보류·후속 항목

- INFO #1 (PERFORMANCE): `resolveRecipients` 순서 비효율 — 운영 규모 미확인으로 보류
- INFO #2 (PERFORMANCE): `enqueueCafe24BackgroundRefresh` 순차 enqueue — 운영 규모 파악 후 병렬화 검토
- INFO #3 (ARCHITECTURE): `isRefreshCapable` 상수 추출 — provider 3개 이상 시 고려
- INFO #4 (ARCHITECTURE): `MONITORED_QUEUES` 동기화 장기 개선 — 모듈 의존 그래프 정리 고려
- INFO #5 (DATABASE): 레거시 `status='expired' AND status_reason IS NULL` backfill — 팀 판단에 위임
- INFO #6 (SIDE_EFFECT): orphan `integration_expiry_dispatch` claim prune — 별도 패스 고려 (범위 밖)
- INFO #7 (USER_GUIDE_SYNC): `statusReasonTokenExpired` i18n 키 예방적 등록 — 현재 노출 경로 없음, 향후 필요 시
- INFO #8–#14: 각 DOCUMENTATION / TESTING / MAINTAINABILITY 개선 제안 — 선택 항목으로 추적
