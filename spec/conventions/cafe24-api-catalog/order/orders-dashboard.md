---
resource: order
entity: orders-dashboard
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders-dashboard
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders dashboard

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders dashboard](https://developers.cafe24.com/docs/ko/api/admin/#orders-dashboard)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문관련 요약 정보를 확인할 수 있습니다. · 이 정보는 최근 한달동안 누적된 데이터를 기반으로 합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `cancellation_request_count` |  | 취소신청 건수 |
| `cancellation_received_count` |  | 취소접수 건수 |
| `cancellation_processing_count` |  | 취소처리중 건수 |
| `exchange_request_count` |  | 교환신청 건수 |
| `exchange_received_count` |  | 교환접수 건수 |
| `exchange_processing_count` |  | 교환처리중 건수 |
| `return_request_count` |  | 반품신청 건수 |
| `return_received_count` |  | 반품접수 건수 |
| `return_processing_count` |  | 반품처리중 건수 |
| `refund_pending_count` |  | 환불전 건수 |
| `total_order_amount` |  | 총 주문 금액 |
| `total_paid_amount` |  | 총 실 결제금액 |
| `total_refund_amount` |  | 총 환불금액 |
| `total_order_count` |  | 총 주문금액 건수 |
| `total_paid_count` |  | 총 실결제 금액 건수 |
| `total_refund_count` |  | 총 환불금액 건수 |

## Operations

### `GET /api/v2/admin/orders/dashboard` — List all orders dashboard

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#list-all-orders-dashboard

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "dashboard": {
        "shop_no": 1,
        "cancellation_request_count": 10,
        "cancellation_received_count": 5,
        "cancellation_processing_count": 5,
        "exchange_request_count": 8,
        "exchange_received_count": 3,
        "exchange_processing_count": 3,
        "return_request_count": 12,
        "return_received_count": 6,
        "return_processing_count": 6,
        "refund_pending_count": 20,
        "total_order_amount": "1500000.00",
        "total_paid_amount": "120000.00",
        "total_refund_amount": "100000.00",
        "total_order_count": 50,
        "total_paid_count": 40,
        "total_refund_count": 10
    }
}
```
