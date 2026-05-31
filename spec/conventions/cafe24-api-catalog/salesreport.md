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
| `salesreport_daily` | 일일 매출 통계 | Retrieve a list of daily sales | GET | `salesreport/sales` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-daily-sales) |
| `salesreport_products` | 상품별 매출 통계 | Retrieve hourly product sales statistics of a store | GET | `salesreport/products` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-hourly-product-sales-statistics-of-a-store) |
| `salesreport_monthly` | 월별 매출 통계 | Retrieve a list of monthly sales | GET | `financials/monthlysales` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-monthly-sales) |
| `salesreport_hourly` | 시간대별 매출 통계 | Retrieve hourly sales statistics of a store | GET | `reports/hourlysales` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-hourly-sales-statistics-of-a-store) |
| `salesreport_volume` | 매출 리포트 조회 | Retrieve a sales report | GET | `reports/salesvolume` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-sales-report) |
