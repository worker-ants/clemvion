---
resource: order
entity: cashreceipt__cancellation
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#cashreceipt--cancellation
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Cashreceipt cancellation

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Cashreceipt cancellation](https://developers.cafe24.com/docs/ko/api/admin/#cashreceipt--cancellation)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

현금영수증 취소(Cashreceipt cancellation)는 발행된 현금영수증에 대해 신청취소 혹은 발행취소를 할 수 있는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `cashreceipt_no` |  | 현금영수증 번호 |
| `order_id` |  | 주문번호 |
| `status` |  | 처리상태 신청취소: canceled_request · 발행취소: canceled_issuance |

## Operations

### `PUT /api/v2/admin/cashreceipt/{cashreceipt_no}/cancellation` — Update a cash receipt cancellation

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-cash-receipt-cancellation

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `cashreceipt_no` | ✓ | 최소값: [1] |  | 현금영수증 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `type` | ✓ |  |  | 취소 타입 신청취소: request · 발행취소: issue |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `cancellation` |  | (응답 객체) |
| ↳ `cashreceipt_no` |  | 현금영수증 번호 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `status` |  | 처리상태 신청취소: canceled_request · 발행취소: canceled_issuance |

응답 예시 (JSON):

```json
{
    "cancellation": {
        "cashreceipt_no": 11,
        "order_id": "20201013-0000096",
        "status": "canceled_request"
    }
}
```
