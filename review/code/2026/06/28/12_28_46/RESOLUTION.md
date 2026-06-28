# RESOLUTION — 12_28_46

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 (WARNING) | 추적 확인 | (없음 — plan 기존 추적 확인) | SUMMARY 가 "현 리뷰 범위 내 즉각 수정 불필요" 명시. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 "Per-execution / per-trigger rate-limit 및 `RATE_LIMITED` 429 (EIA-NX-11/§8.4/§5.1)" 항목이 이미 inbound rate-limit 미구현을 추적 중. 추가 체크리스트 항목 불필요 (중복). |

## TEST 결과

- lint  : skipped (코드 변경 없음)
- unit  : skipped (코드 변경 없음)
- build : skipped (코드 변경 없음)
- e2e   : 면제 (화이트리스트: 코드 변경 없음 — MDX 문서 수정 전용 PR, 코드 fix commit 0건)

## 보류·후속 항목

- INFO #1: Webhook 429 수치 변경(per-trigger 60 → global 100 req/min) — spec WH-SC-05 정합, 추가 조치 불필요.
- INFO #2: Inbound command RATE_LIMITED 미구현 마킹 — spec §5.1/§8.4 정합, 추가 조치 불필요.
- INFO #3: 클라이언트 버스팅 로직 per-trigger 60 가정 — Retry-After 헤더 개선 검토. 현 diff 범위 외.
- INFO #4: 인프라 vs 앱 레이어 429 구분 미명시 — inbound rate-limit 구현 시 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에서 함께 처리.
- INFO #5: Webhook 본문 1MB vs 32KB/1MB Planned 불일치 — 이번 PR 범위 외 기존 이슈. `plan/in-progress/spec-sync-webhook-gaps.md` (WH-NF-02/옵션C 결정 완료) 에서 추적 중.
- INFO #6: CHANGELOG 업데이트 — 본 변경이 코드·spec 이미 global 100 이었던 상태의 문서 보정이므로 CHANGELOG 불필요 (동작 변경 없음).
