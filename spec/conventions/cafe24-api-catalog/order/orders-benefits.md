---
resource: order
entity: orders-benefits
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders-benefits
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Order / Orders benefits

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders benefits](https://developers.cafe24.com/docs/ko/api/admin/#orders-benefits)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문혜택(Orders benefits)은 특정 주문에 적용된 혜택에 관한 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `order_id` |  | 주문번호 |
| `order_item_code` |  | 품주코드 |
| `benefit_no` |  | 혜택번호 |
| `benefit_title` |  | 혜택 유형 |
| `benefit_name` |  | 혜택명 |
| `benefit_code` |  | 혜택코드 |
| `benefit_percent` |  | 혜택 비율 |
| `benefit_value` |  | 혜택 금액 |
| `benefit_app_key` |  | 앱 클라이언트 ID |

## Operations

### `GET /api/v2/admin/orders/benefits` — Retrieve a list of order benefits applied to an order

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-order-benefits-applied-to-an-order

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `limit` |  | 최소: [1]~최대: [500] | 10 | 조회결과 최대건수 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
