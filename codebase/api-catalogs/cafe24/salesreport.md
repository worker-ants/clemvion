---
id: salesreport
status: implemented
code:
  - codebase/backend/src/nodes/integration/cafe24/metadata/salesreport.ts
---

# Cafe24 API Catalog — Salesreport (매출통계)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `salesreport_daily` | 일일 매출 통계 | Retrieve a list of daily sales | GET | `financials/dailysales` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-daily-sales) |
| `salesreport_products` | 상품별 매출 통계 | Retrieve hourly product sales statistics of a store | GET | `reports/productsales` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-hourly-product-sales-statistics-of-a-store) |
| `salesreport_monthly` | 월별 매출 통계 | Retrieve a list of monthly sales | GET | `financials/monthlysales` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-monthly-sales) |
| `salesreport_hourly` | 시간대별 매출 통계 | Retrieve hourly sales statistics of a store | GET | `reports/hourlysales` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-hourly-sales-statistics-of-a-store) |
| `salesreport_volume` | 매출 리포트 조회 | Retrieve a sales report | GET | `reports/salesvolume` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-sales-report) |

## Field-level 상세 카탈로그

> 각 sub-resource 의 **응답 속성(field) + operation 요청 파라미터**를 Cafe24 공식 docs 기준으로 담은 상세 카탈로그. 위 표가 endpoint enumeration index 라면, 아래는 field-level 본문이다. 출처: Cafe24 REST API Documentation (admin), 2026-06-03 download.

- [`salesreport/financials-dailysales.md`](./salesreport/financials-dailysales.md) · Financials dailysales — 5 fields, 1 ops
- [`salesreport/financials-monthlysales.md`](./salesreport/financials-monthlysales.md) · Financials monthlysales — 5 fields, 1 ops
- [`salesreport/reports-hourlysales.md`](./salesreport/reports-hourlysales.md) · Reports hourlysales — 20 fields, 1 ops
- [`salesreport/reports-productsales.md`](./salesreport/reports-productsales.md) · Reports productsales — 14 fields, 1 ops
- [`salesreport/reports-salesvolume.md`](./salesreport/reports-salesvolume.md) · Reports salesvolume — 13 fields, 1 ops
