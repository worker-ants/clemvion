---
resource: order
entity: orders__buyer-history
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--buyer-history
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Order / Orders buyer history

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders buyer history](https://developers.cafe24.com/docs/ko/api/admin/#orders--buyer-history)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문자 수정 이력(Buyer History)은 특정 주문의 주문자 정보가 수정된 이력을 나타냅니다. · 주문자 정보가 수정될 때마다 이력이 추가됩니다. · 주문자 수정 이력 리소스를 통해 특정 주문의 주문자 정보가 수정된 내역을 확인할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 |
| `name` |  | 주문자명 |
| `email` | 이메일 | 주문자 이메일 |
| `phone` |  | 주문자 일반 전화 |
| `cellphone` |  | 주문자 휴대 전화 |
| `customer_notification` |  | 고객 알림 |
| `updated_date` |  | 수정일 |
| `user_id` |  | 주문자 수정자 ID |
| `user_name` |  | 주문자 수정자 명 |

## Operations

### `GET /api/v2/admin/orders/{order_id}/buyer/history` — Retrieve a list of customer history of an order

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-history-of-an-order

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
