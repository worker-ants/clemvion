---
resource: order
entity: orders__items__history
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--items--history
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Order / Orders items history

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders items history](https://developers.cafe24.com/docs/ko/api/admin/#orders--items--history)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `process_date` |  | 처리일시 |
| `previous_order_status` |  | 변경 전 주문상태 |
| `current_order_status` |  | 변경 후 주문상태 |
| `manager_id` |  | 처리한 운영자 아이디 |
| `manager_name` |  | 관리자명 |

## Operations

### `GET /api/v2/admin/orders/{order_id}/items/{order_item_code}/history` — Order item processing history

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#order-item-processing-history

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `order_item_code` | ✓ |  |  | 품주코드 |
| `start_date` |  |  |  | 검색 시작일 |
| `end_date` |  |  |  | 검색 종료일 |
