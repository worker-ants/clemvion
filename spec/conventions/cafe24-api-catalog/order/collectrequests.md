---
resource: order
entity: collectrequests
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#collectrequests
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Order / Collectrequests

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Collectrequests](https://developers.cafe24.com/docs/ko/api/admin/#collectrequests)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

수거신청 정보(Collectrequests)는 반품, 교환처리로 수거요청시 수거신청 정보를 수정할 수 있는 리소스입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `request_no` |  | 요청 번호 |
| `order_id` |  | 주문번호 |
| `order_item_code` |  | 품주코드 |
| `shipping_company_name` |  | 수거 배송사명 |
| `collect_tracking_no` |  | 수거 송장 번호 |

## Operations

### `PUT /api/v2/admin/collectrequests/{request_no}` — Update a collection request

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 30
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-collection-request

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `request_no` | ✓ |  |  | 요청 번호 |
| `collect_tracking_no` | ✓ | 최대글자수 : [40자] |  | 수거 송장 번호 |
