---
resource: order
entity: orders-paymentamount
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders-paymentamount
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders paymentamount

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders paymentamount](https://developers.cafe24.com/docs/ko/api/admin/#orders-paymentamount)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문의 실결제금액(Orders paymentamount)은 특정 주문의 실제 결제금액에 대한 기능입니다. · 1개 혹은 여러 개의 품주에 대한 실제 결제금액과 관련된 정보를 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `order_item_code` |  | 품주코드 |
| `items` |  | 품목 정보 |
| `order_price_amount` |  | 상품구매금액 |
| `order_discount_amount` |  | 주문 할인금액 |
| `item_discount_amount` |  | 상품 할인금액 |
| `additional_payment_amount` |  | 보조 결제금액 |
| `payment_amount` |  | 품목별 결제금액 |
| `cancel_fee_amount` |  | 취소수수료 |

## Operations

### `GET /api/v2/admin/orders/paymentamount` — Retrieve a payment amount

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-payment-amount

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_item_code` | ✓ |  |  | 품주코드 ,(콤마)로 여러 건을 검색할 수 있다. |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `paymentamount` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `order_item_code` |  | 품주코드 |
| ↳ `items` |  | 품목 정보 |
| ↳ ↳ `product_price` |  |  |
| ↳ ↳ `option_price` |  | 옵션 추가 가격 |
| ↳ ↳ `quantity` |  |  |
| ↳ `order_price_amount` |  | 상품구매금액 |
| ↳ `order_discount_amount` |  | 주문 할인금액 |
| ↳ ↳ `membership_discount_amount` |  | 회원등급 할인금액 |
| ↳ ↳ `coupon_discount_price` |  |  |
| ↳ ↳ `app_discount_amount` |  | 앱 주문할인금액​​​ |
| ↳ `item_discount_amount` |  | 상품 할인금액 |
| ↳ ↳ `additional_discount_price` |  | 상품추가할인액 상품에 대한 추가 할인금액 |
| ↳ ↳ `coupon_discount_price` |  |  |
| ↳ ↳ `app_discount_amount` |  | 앱 주문할인금액​​​ |
| ↳ `additional_payment_amount` |  | 보조 결제금액 |
| ↳ `payment_amount` |  | 품목별 결제금액 |
| ↳ `cancel_fee_amount` |  | 취소수수료 |

응답 예시 (JSON):

```json
{
    "paymentamount": [
        {
            "shop_no": 1,
            "order_item_code": "20210511-0000011-01",
            "items": {
                "product_price": "9000.00",
                "option_price": "1000.00",
                "quantity": 1
            },
            "order_price_amount": "10000.00",
            "order_discount_amount": {
                "membership_discount_amount": "0.00",
                "coupon_discount_price": "0.00",
                "app_discount_amount": "0.00"
            },
            "item_discount_amount": {
                "additional_discount_price": "300.00",
                "coupon_discount_price": "0.00",
                "app_discount_amount": "0.00"
            },
            "additional_payment_amount": "200.00",
            "payment_amount": "9500.00",
            "cancel_fee_amount": null
        },
        {
            "shop_no": 1,
            "order_item_code": "20210511-0000022-01",
            "items": {
                "product_price": "5000.00",
                "option_price": "0.00",
                "quantity": 1
            },
            "order_price_amount": "5000.00",
            "order_discount_amount": {
                "membership_discount_amount": "0.00",
                "coupon_discount_price": "0.00",
                "app_discount_amount": "0.00"
            },
            "item_discount_amount": {
                "additional_discount_price": "200.00",
                "coupon_discount_price": "0.00",
                "app_discount_amount": "0.00"
            },
            "additional_payment_amount": "100.00",
            "payment_amount": "4700.00",
            "cancel_fee_amount": null
        }
    ]
}
```
