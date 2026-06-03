---
resource: order
entity: orders__receivers-history
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--receivers-history
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Order / Orders receivers history

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders receivers history](https://developers.cafe24.com/docs/ko/api/admin/#orders--receivers-history)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문수령자 이력(Orders receivers history)은 특정 주문의 수령자 정보 변경이력에 대한 기능입니다. · 수정일(updated_date) 파라메터를 통해 언제 정보가 변경되었는지 확인할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 |
| `name` |  | 수령자명 |
| `phone` |  | 전화번호 |
| `cellphone` |  | 수령자 휴대 전화 |
| `zipcode` |  | 우편번호 |
| `address1` |  | 기본 주소 |
| `address2` |  | 상세 주소 |
| `address_state` |  | 주/도 |
| `address_city` |  | 시/군/도시 |
| `address_street` |  | 도로명 |
| `address_full` |  | 전체주소 |
| `name_en` |  | 수령자명 (영문) |
| `city_en` |  | 수령자 도시 (영문) |
| `state_en` |  | 수령자 주 (영문) |
| `street_en` |  | 수령자 주소 (영문) |
| `country_code` |  | 국가코드 |
| `country_name` |  | 국가명 |
| `country_name_en` |  | 국가명 (영문) |
| `shipping_message` |  | 배송 메세지 |
| `updated_date` |  | 수정일 |
| `user_id` |  | 주문자 수정자 ID |
| `user_name` |  | 주문자 수정자 명 |
| `shipping_code` |  | 배송번호 |

## Operations

### `GET /api/v2/admin/orders/{order_id}/receivers/history` — Retrieve a list of recipient history of an order

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-recipient-history-of-an-order

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
