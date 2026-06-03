---
resource: salesreport
entity: reports-hourlysales
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#reports-hourlysales
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Salesreport / Reports hourlysales

> Field-level 카탈로그. Endpoint enumeration index: [`../salesreport.md`](../salesreport.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Reports hourlysales](https://developers.cafe24.com/docs/ko/api/admin/#reports-hourlysales)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

시간단위 정산통계(Reports hourlysales)는 특정 날짜와 시간을 기준으로 각종 매출에 관한 데이터를 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `collection_date` |  | 정산 수집 일자 |
| `collection_hour` |  | 정산 수집 시간 |
| `order_count` |  | 주문수 |
| `item_count` |  | 품목수 |
| `order_price_amount` |  | 상품 구매금액 |
| `order_sale_price` |  | 할인금액 |
| `shipping_fee` |  | 배송비 |
| `coupon_discount_price` |  | 쿠폰 할인금액 |
| `actual_order_amount` |  | 실결제금액 |
| `refund_amount` |  | 환불 금액 |
| `sales` |  | 순매출 |
| `used_points` |  | 적립금 |
| `used_credits` |  | 예치금 |
| `used_naver_points` |  | 네이버 마일리지 |
| `used_naver_cash` |  | 네이버캐시 |
| `refund_points` |  | 환불 적립금 |
| `refund_credits` |  | 환불 예치금 |
| `refund_naver_points` |  | 환불 네이버 마일리지 |
| `refund_naver_cash` |  | 환불 네이버캐시 |

## Operations

### `GET /api/v2/admin/reports/hourlysales` — Retrieve hourly sales statistics of a store

- **Scope**: `mall.read_salesreport` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-hourly-sales-statistics-of-a-store

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `start_date` | ✓ | 날짜 |  | 검색 시작일 |
| `end_date` | ✓ | 날짜 |  | 검색 종료일 |
| `collection_hour` |  |  |  | 정산 수집 시간 수집 시간을 특정하여 검색 · 00 ~ 23 까지의 값을 입력할 수 있다. |
| `limit` |  | 최소: [1]~최대: [1000] | 744 | 조회결과 최대건수 |
| `offset` |  | 최대값: [10000] | 0 | 조회결과 시작위치 |
