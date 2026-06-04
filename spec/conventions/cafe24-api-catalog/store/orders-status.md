---
resource: store
entity: orders-status
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders-status
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Orders status

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders status](https://developers.cafe24.com/docs/ko/api/admin/#orders-status)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

쇼핑몰에서 사용하는 주문상태 유형 및 표기를 관리할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `status_name_id` |  | 주문상태 표기명 일련번호 |
| `status_type` |  | 주문상태 유형 P: 결제 및 배송 · D: 후불 결제 · C: 취소 · R: 반품 · E: 교환 · U: 환불 · O: 기타 |
| `basic_name` |  | 기본 표기 주문상태명 |
| `custom_name` |  | 사용자 정의 주문상태명 |
| `reservation_custom_name` |  | 예약주문 사용자 정의 주문상태명 |

## Operations

### `GET /api/v2/admin/orders/status` — Retrieve order status displayed

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-order-status-displayed

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "status": [
        {
            "status_name_id": 1,
            "status_type": "P",
            "basic_name": "Awaiting Shipment",
            "custom_name": "We are preparing for delivery.",
            "reservation_custom_name": "Course confirmed"
        },
        {
            "status_name_id": 35,
            "status_type": "P",
            "basic_name": "Pending",
            "custom_name": "We're preparing a product",
            "reservation_custom_name": "Application for classes"
        }
    ]
}
```

### `PUT /api/v2/admin/orders/status` — Update order status displayed

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 100
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-order-status-displayed

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `status_name_id` | ✓ |  |  | 주문상태 표기명 일련번호 |
| `custom_name` |  |  |  | 사용자 정의 주문상태명 |
| `reservation_custom_name` |  |  |  | 예약주문 사용자 정의 주문상태명 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "status": [
        {
            "status_name_id": 1,
            "status_type": "P",
            "basic_name": "Awaiting Shipment",
            "custom_name": "Preparing for delivery",
            "reservation_custom_name": "Waiting for classes"
        },
        {
            "status_name_id": 35,
            "status_type": "P",
            "basic_name": "Pending",
            "custom_name": "Preparing products",
            "reservation_custom_name": "Application for classes"
        }
    ]
}
```
