---
resource: order
entity: orders__refunds
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--refunds
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders refunds

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders refunds](https://developers.cafe24.com/docs/ko/api/admin/#orders--refunds)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문 환불(Orders refunds)은 특정 주문의 환불상태와 관련된 기능입니다. · 특정 주문의 환불상태를 수정할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `refund_code` |  | 환불번호 |
| `status` |  | 환불상태 |
| `reason` |  | 처리사유 |

## Operations

### `PUT /api/v2/admin/orders/{order_id}/refunds/{refund_code}` — Update an order refund

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-refund

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `refund_code` | ✓ |  |  | 환불번호 |
| `status` | ✓ |  |  | 환불상태 complete : 환불완료 |
| `reason` |  | 최대글자수 : [2000자] |  | 처리사유 |
| `send_sms` |  |  | T | 환불처리후 SMS 발송 여부 T : 발송함 · F : 발송안함 |
| `send_mail` |  |  | T | 환불처리후 메일 발송 여부 T : 발송함 · F : 발송안함 |
| `payment_gateway_cancel` |  |  | F | PG 취소 요청 여부 T : 취소함 · F : 취소안함 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "refund": {
        "shop_no": 1,
        "refund_code": "C20190130-0000004",
        "status": "complete",
        "reason": "Refund complete"
    }
}
```
