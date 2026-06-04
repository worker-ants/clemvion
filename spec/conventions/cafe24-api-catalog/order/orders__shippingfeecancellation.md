---
resource: order
entity: orders__shippingfeecancellation
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--shippingfeecancellation
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders shippingfeecancellation

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders shippingfeecancellation](https://developers.cafe24.com/docs/ko/api/admin/#orders--shippingfeecancellation)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문의 배송비취소(Orders shippingfeecancellation)를 통해 주문의 취소현황을 조회하거나 취소처리를 요청할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `order_id` |  | 주문번호 |
| `default_shipping_fee` |  | 기본 배송비 |
| `supplier_shipping_fee` |  | 공급사배송비 |
| `individual_shipping_fee` |  | 개별배송비 |
| `international_shipping_fee` |  | 해외배송비 |
| `international_shipping_insurance_fee` |  | 해외배송 보험료 |
| `additional_shipping_fee` |  | 추가 배송비 |
| `additional_handling_fee` |  | 해외배송 부가금액 |
| `regional_surcharge_amount` |  | 지역별 배송비 |
| `claim_code` |  | 취소 번호 |
| `claim_reason_type` |  | 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| `claim_reason` |  | 사유 |
| `refund_method` |  | 환불 방식 |
| `shipping_discount_amount` |  | 배송비할인 취소액 |
| `coupon_discount_amount` |  | 쿠폰할인 취소액 |
| `refund_amount` |  | 환불금액 |
| `point_used` |  | 사용된 적립금 반환액 |
| `credit_used` |  | 사용된 예치금 반환액 |
| `mixed_refund_amount` |  | 복합 환불 금액 |
| `mixed_refund_methods` |  | 복합 환불 방식 |
| `status` |  | 주문상태 canceled: 취소완료 · canceling : 취소처리중 |
| `include_tax` |  | 가격에 세금 포함 T: 세금포함 · F: 세금제외 |
| `tax` |  | 세금 정보 세금 관리자 앱을 사용 안 할 경우 null로 반환 |

## Operations

### `GET /api/v2/admin/orders/{order_id}/shippingfeecancellation` — Retrieve shipping fee cancellation details of an order

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-shipping-fee-cancellation-details-of-an-order

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "shippingfeecancellation": [
        {
            "shop_no": 1,
            "order_id": "20200814-0000011",
            "claim_code": "C20200814-0000001",
            "claim_reason_type": "A",
            "claim_reason": "Free shipping",
            "status": "canceled",
            "default_shipping_fee": "2500.00",
            "supplier_shipping_fee": "0.00",
            "individual_shipping_fee": "0.00",
            "international_shipping_fee": "0.00",
            "international_shipping_insurance_fee": "0.00",
            "additional_shipping_fee": "0.00",
            "additional_handling_fee": "0.00",
            "regional_surcharge_amount": "0.00",
            "refund_method": "Cash refund",
            "shipping_discount_amount": "1000.00",
            "coupon_discount_amount": "0.00",
            "refund_amount": "1500.00",
            "point_used": "0.00",
            "credit_used": "0.00",
            "mixed_refund_amount": "0.00",
            "mixed_refund_methods": null,
            "include_tax": "T",
            "tax": [
                {
                    "name": "vat",
                    "amount": "1000.00"
                },
                {
                    "name": "tax",
                    "amount": "800.00"
                }
            ]
        },
        {
            "shop_no": 1,
            "order_id": "20200814-0000011",
            "claim_code": "C20200814-0000002",
            "claim_reason_type": "B",
            "claim_reason": "delayed delivery",
            "status": "canceling",
            "default_shipping_fee": "0.00",
            "supplier_shipping_fee": "0.00",
            "individual_shipping_fee": "0.00",
            "international_shipping_fee": "0.00",
            "international_shipping_insurance_fee": "0.00",
            "additional_shipping_fee": "0.00",
            "additional_handling_fee": "0.00",
            "regional_surcharge_amount": "0.00",
            "refund_method": "Cash refund",
            "shipping_discount_amount": "0.00",
            "coupon_discount_amount": "0.00",
            "refund_amount": "1500.00",
            "point_used": "0.00",
            "credit_used": "0.00",
            "mixed_refund_amount": "0.00",
            "mixed_refund_methods": null,
            "include_tax": "T",
            "tax": [
                {
                    "name": "vat",
                    "amount": "1100.00"
                },
                {
                    "name": "tax",
                    "amount": "900.00"
                }
            ]
        }
    ]
}
```

### `POST /api/v2/admin/orders/{order_id}/shippingfeecancellation` — Create an order shipping fee cancellation

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-shipping-fee-cancellation

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `reason` |  | 최대글자수 : [2000자] |  | 취소사유 |
| `claim_reason_type` |  |  |  | 취소사유 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| `recover_coupon` |  |  | F | 쿠폰 복원 Youtube shopping 이용 시에는 미제공 T : 복구함 · F : 복구안함 |
| `refund_method_code` |  |  |  | 환불 방식 T : 현금 · F : 신용카드 · M : 적립금 · G : 계좌이체 · C : 휴대폰 · D : 예치금 · Z : 후불 · O : 선불금 · V : 편의점 · J : 제휴상품권 · K : 제휴포인트 · I : 기타 |
| `refund_bank_code` |  |  |  | 환불 은행 코드 |
| `refund_bank_name` |  | 최대글자수 : [250자] |  | 환불은행명 |
| `refund_bank_account_no` |  |  |  | 환불 계좌번호 |
| `refund_bank_account_holder` |  | 최대글자수 : [30자] |  | 환불계좌 예금주 명의 |
| `payment_gateway_cancel` |  |  | F | PG 취소 요청 여부 T : 취소함 · F : 취소안함 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "shippingfeecancellation": {
        "shop_no": 1,
        "order_id": "20200814-0000011",
        "claim_code": "C20200814-0000001"
    }
}
```
