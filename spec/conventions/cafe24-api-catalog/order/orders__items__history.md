---
resource: order
entity: orders__items__history
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--items--history
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders items history

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders items history](https://developers.cafe24.com/docs/ko/api/admin/#orders--items--history)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `process_date` |  | 처리일시 |
| `previous_order_status` |  | 변경 전 주문상태 |
| `current_order_status` |  | 변경 후 주문상태 |
| `manager_id` |  | 처리한 운영자 아이디 |
| `manager_name` |  | 관리자명 |

## Operations

### `GET /api/v2/admin/orders/{order_id}/items/{order_item_code}/history` — Order item processing history

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#order-item-processing-history

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `order_item_code` | ✓ |  |  | 품주코드 |
| `start_date` |  |  |  | 검색 시작일 |
| `end_date` |  |  |  | 검색 종료일 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `history` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `process_date` |  | 처리일시 |
| ↳ `previous_order_status` |  | 변경 전 주문상태 |
| ↳ `current_order_status` |  | 변경 후 주문상태 |
| ↳ `manager_id` |  | 처리한 운영자 아이디 |
| ↳ `manager_name` |  | 관리자명 |

응답 예시 (JSON):

```json
{
    "history": [
        {
            "shop_no": 1,
            "process_date": "2026-04-01T10:00:00+09:00",
            "previous_order_status": "",
            "current_order_status": "N00",
            "manager_id": "system",
            "manager_name": "system"
        },
        {
            "shop_no": 1,
            "process_date": "2026-04-02T14:30:00+09:00",
            "previous_order_status": "N00",
            "current_order_status": "N10",
            "manager_id": "system",
            "manager_name": "system"
        },
        {
            "shop_no": 1,
            "process_date": "2026-04-05T09:00:00+09:00",
            "previous_order_status": "N10",
            "current_order_status": "N20",
            "manager_id": "checkout100",
            "manager_name": "Master operator"
        },
        {
            "shop_no": 1,
            "process_date": "2026-04-07T11:00:00+09:00",
            "previous_order_status": "N20",
            "current_order_status": "N30",
            "manager_id": "checkout100",
            "manager_name": "Master operator"
        },
        {
            "shop_no": 1,
            "process_date": "2026-04-10T16:45:00+09:00",
            "previous_order_status": "N30",
            "current_order_status": "N40",
            "manager_id": "system",
            "manager_name": "system"
        }
    ]
}
```
