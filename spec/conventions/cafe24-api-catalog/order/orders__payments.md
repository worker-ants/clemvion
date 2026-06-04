---
resource: order
entity: orders__payments
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--payments
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders payments

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders payments](https://developers.cafe24.com/docs/ko/api/admin/#orders--payments)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문의 결제상태(Orders payments)는 특정 주문의 결제상태에 대한 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `order_id` |  | 주문번호 |
| `change_payment_amount` |  | 결제금액 변경 여부 T : 사용함 · F : 사용안함 |
| `change_payment_method` |  | 결제수단 변경 여부 T : 사용함 · F : 사용안함 |
| `payment_method` |  | 결제수단 |
| `payment_gateway_failure_message` |  | PG 결제 취소 실패 메시지 |
| `admin_additional_amount` |  | 관리자 입력 금액 |
| `commission` |  | 결제 수수료 |
| `initial_estimated_payment_amount` |  | 최초 결제 예정 금액 |
| `change_payment_amount_reason` |  | 결제금액 변경 사유 |

## Operations

### `PUT /api/v2/admin/orders/{order_id}/payments` — Update an order payment status

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-payment-status

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `change_payment_amount` | ✓ |  |  | 결제금액 변경 여부 입금전 상태에서만 결제금액 변경 가능 · 단, CS주문상태 또는 CS처리이력이 존재하는 경우에는 결제금액 변경 불가능함 · ※ 결제수단별 입금전 주문상태 · - 무통장입금 : 입금전 · - 다이비키 : 상품준비중 ~ 배송완료 [다이비키 입금전] T : 사용함 · F : 사용안함 |
| `change_payment_method` | ✓ |  |  | 결제수단 변경 여부 T : 사용함 · F : 사용안함 |
| `payment_method` |  |  |  | 결제수단 cash: 무통장 입금 · daibiki : 다이비키 |
| `billing_name` |  | 최대글자수 : [40자] |  | 입금자명 결제수단을 무통장입금으로 변경할 경우("change_payment_method:"T"이고 "payment_method":"cash"일 경우) 사용 가능 |
| `bank_account_id` |  |  |  | 무통장 입금 은행 ID 결제수단을 무통장입금으로 변경할 경우("change_payment_method:"T"이고 "payment_method":"cash"일 경우) 사용 가능 |
| `admin_additional_amount` |  | 최소값: [0]; 최대값: [10000000] |  | 관리자 입력 금액 결제금액을 변경할 경우("change_payment_amount":"T"일 경우) 사용 가능 |
| `commission` |  | 최소값: [0]; 최대값: [10000000] |  | 결제 수수료 결제수단을 다이비키로 변경할 경우("change_payment_amount:"T"이고 "payment_method":"daibiki"일 경우) 사용 가능 |
| `change_payment_amount_reason` |  | 최대글자수 : [255자] |  | 결제금액 변경 사유 결제금액을 변경할 경우("change_payment_amount":"T"일 경우) 사용 가능 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "payment": {
        "shop_no": 1,
        "order_id": "20181203-0000022",
        "change_payment_amount": "T",
        "change_payment_method": "T",
        "payment_method": "cash",
        "payment_gateway_failure_message": null,
        "admin_additional_amount": "1000.00",
        "commission": null,
        "initial_estimated_payment_amount": "11000.00",
        "change_payment_amount_reason": "Remove shipping charge, add return fee"
    }
}
```
