---
resource: store
entity: dashboard
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#dashboard
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Store / Dashboard

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Dashboard](https://developers.cafe24.com/docs/ko/api/admin/#dashboard)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

대시보드(Dashboard)는 쇼핑몰의 주문 현황과 매출 현황 등 쇼핑몰 운영에 필요한 정보를 간략하게 요약해놓은 정보입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `daily_sales_stats` |  | 일일 현황 정보 일 단위의 매출 현황 정보 |
| `weekly_sales_stats` |  | 주간 매출 현황 주간 단위의 매출 현황 정보 |
| `monthly_sales_stats` |  | 월간 매출 현황 월간 단위의 매출 현황 정보 |
| `sold_out_products_count` |  | 품절된 상품 수 품절된 상품의 수. 재고관리기능과 품절기능이 활성화 되어있을 경우 집계에 포함됨. |
| `new_members_count` |  | 신규회원 수 신규가입한 회원의 숫자 |
| `board_list` |  | 게시판 목록 해당 몰의 게시판의 리스트 |

## Operations

### `GET /api/v2/admin/dashboard` — Retrieve a dashboard

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-dashboard

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
