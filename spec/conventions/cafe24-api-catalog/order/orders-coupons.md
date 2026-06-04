---
resource: order
entity: orders-coupons
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders-coupons
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders coupons

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders coupons](https://developers.cafe24.com/docs/ko/api/admin/#orders-coupons)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문 쿠폰(Orders coupons)은 주문에 적용된 쿠폰에 관한 기능입니다. · 특정 주문에 대해 적용된 쿠폰의 정보를 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `order_id` |  | 주문번호 |
| `order_item_code` |  | 품주코드 |
| `coupon_name` |  | 쿠폰명 |
| `coupon_code` |  | 쿠폰번호 |
| `coupon_percent` |  | 쿠폰 비율 |
| `coupon_value` |  | 쿠폰 금액 |
| `coupon_value_final` |  | 최종 쿠폰 금액 |

## Operations

### `GET /api/v2/admin/orders/coupons` — Retrieve a list of coupons applied to an order

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-coupons-applied-to-an-order

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `limit` |  | 최소: [1]~최대: [500] | 10 | 조회결과 최대건수 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "coupons": [
        {
            "shop_no": 1,
            "order_id": "20201005-0000011",
            "order_item_code": "20201005-0000011-01",
            "coupon_name": "coupon setting name",
            "coupon_code": "6069019282400000002",
            "coupon_percent": "1%",
            "coupon_value": "900.00",
            "coupon_value_final": "0.00"
        },
        {
            "shop_no": 1,
            "order_id": "20201005-0000011",
            "order_item_code": "20201005-0000011-01",
            "coupon_name": "coupon setting name",
            "coupon_code": "6069019278500000001",
            "coupon_percent": null,
            "coupon_value": "500.00",
            "coupon_value_final": "0.00"
        }
    ]
}
```
