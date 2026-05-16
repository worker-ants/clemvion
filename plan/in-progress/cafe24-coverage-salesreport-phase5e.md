---
worktree: cafe24-coverage-salesreport-2a9d6e
started: 2026-05-16
owner: developer
---

# Plan: Cafe24 Coverage — Salesreport 완성 Phase 5e

Salesreport 의 모든 planned operation 을 supported 로 승격 — **resource 가 first 0-planned 상태가 된다**.

## 범위

| id | label | method | path |
|---|---|---|---|
| `salesreport_monthly` | 월별 매출 통계 | GET | `financials/monthlysales` |
| `salesreport_hourly` | 시간대별 매출 통계 | GET | `reports/hourlysales` |
| `salesreport_volume` | 매출 리포트 조회 | GET | `reports/salesvolume` |

## 결정 사항

- 모두 read scope, paginated.
- `salesreport_monthly` 는 docs 가 명시한 필수 인자 없음 — shop_no 만 query.
- `salesreport_hourly` / `salesreport_volume` 는 `start_date` + `end_date` required.

Coverage: salesreport 2 → 5, planned 3 → 0, 합계 73 → 76.

## 후속

Phase 5f (Serialcoupons).
