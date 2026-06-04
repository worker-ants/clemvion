---
resource: order
entity: payments
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#payments
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Payments

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Payments](https://developers.cafe24.com/docs/ko/api/admin/#payments)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

결제상태(Payments)는 특정 주문의 결제상태에 대한 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `order_id` |  | 주문번호 |
| `status` |  | 주문상태 paid: 입금확인 · unpaid: 입금전 · canceled: 결제취소 |
| `payment_no` |  | 결제번호 |
| `auto_paid` |  | 자동입금 여부 T: 자동입금 · F: 수동입금 |
| `cancel_request` |  | 결제취소 요청 정보 |

## Operations

### `PUT /api/v2/admin/payments` — Update payment status for multiple orders

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 10
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-payment-status-for-multiple-orders

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `status` | ✓ |  |  | 결제상태 canceled의 경우 앱을 통해 추가된 PG사에서 결제를 취소할 경우에만 사용 가능 paid: 입금확인 · unpaid: 입금전 · canceled: 결제취소 |
| `payment_no` |  | 최소값: [1] |  | 결제번호 |
| `auto_paid` |  |  |  | 자동입금 여부 T: 자동입금 · F: 수동입금 |
| `recover_inventory` |  |  |  | 재고복구 T : 복구함 · F : 복구안함 |
| `cancel_request` |  |  |  | 결제취소 요청 정보 |
| ↳ `refund_status` |  |  |  | 환불 처리 상태 · P: 환불완료 · F: 환불실패 · DEFAULT F |
| ↳ `partial_cancel` |  |  |  | 부분 취소 여부 · T: 부분취소 · F: 전체취소 · DEFAULT F |
| ↳ `payment_gateway_name` |  |  |  | 결제 PG사 이름 |
| ↳ `payment_method` |  |  |  | 결제수단 코드 · card : 신용카드 · tcash : 계좌이체 · icash : 가상계좌 · cell : 휴대폰 · deferpay : 후불 · cvs : 편의점 · easypay : 간편결제 · fpayment : 해외결제 |
| ↳ `response_code` |  |  |  | 결제 PG 사의 응답 코드 |
| ↳ `response_message` |  |  |  | 결제 PG 사의 응답 메시지 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "payments": [
        {
            "shop_no": 1,
            "order_id": "20180402-0000032",
            "status": "paid",
            "payment_no": 10,
            "cancel_request": {
                "refund_status": "F",
                "partial_cancel": "F",
                "payment_gateway_name": null,
                "payment_method": null,
                "response_code": null,
                "response_message": null
            }
        },
        {
            "shop_no": 1,
            "order_id": "20180402-0000013",
            "status": "unpaid",
            "payment_no": 12,
            "cancel_request": {
                "refund_status": "F",
                "partial_cancel": "F",
                "payment_gateway_name": null,
                "payment_method": null,
                "response_code": null,
                "response_message": null
            }
        }
    ]
}
```
