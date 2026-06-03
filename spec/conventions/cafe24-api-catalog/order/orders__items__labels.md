---
resource: order
entity: orders__items__labels
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--items--labels
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Order / Orders items labels

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders items labels](https://developers.cafe24.com/docs/ko/api/admin/#orders--items--labels)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

원하는 주문 품목에 라벨을 남기거나 조회, 수정, 삭제할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| `names` |  | 주문 라벨명 |
| `order_id` |  | 주문번호 |
| `order_item_code` |  | 품주코드 |
| `name` |  | 주문 라벨명 |

## Operations

### `GET /api/v2/admin/orders/{order_id}/items/{order_item_code}/labels` — Retrieve an order label

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-order-label

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `order_item_code` | ✓ |  |  | 품주코드 |

### `POST /api/v2/admin/orders/{order_id}/items/{order_item_code}/labels` — Create an order label

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-label

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `order_item_code` | ✓ |  |  | 품주코드 |
| `names` | ✓ |  |  | 주문 라벨명 |

### `PUT /api/v2/admin/orders/{order_id}/items/{order_item_code}/labels` — Update an order label

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-label

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `order_item_code` | ✓ |  |  | 품주코드 |
| `names` | ✓ |  |  | 주문 라벨명 |

### `DELETE /api/v2/admin/orders/{order_id}/items/{order_item_code}/labels/{name}` — Delete an order label

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-an-order-label

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `order_item_code` | ✓ |  |  | 품주코드 |
| `name` | ✓ |  |  | 주문 라벨명 |
