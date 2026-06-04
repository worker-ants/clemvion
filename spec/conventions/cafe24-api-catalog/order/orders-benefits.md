---
resource: order
entity: orders-benefits
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders-benefits
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders benefits

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders benefits](https://developers.cafe24.com/docs/ko/api/admin/#orders-benefits)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문혜택(Orders benefits)은 특정 주문에 적용된 혜택에 관한 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `order_id` |  | 주문번호 |
| `order_item_code` |  | 품주코드 |
| `benefit_no` |  | 혜택번호 |
| `benefit_title` |  | 혜택 유형 |
| `benefit_name` |  | 혜택명 |
| `benefit_code` |  | 혜택코드 |
| `benefit_percent` |  | 혜택 비율 |
| `benefit_value` |  | 혜택 금액 |
| `benefit_app_key` |  | 앱 클라이언트 ID |

## Operations

### `GET /api/v2/admin/orders/benefits` — Retrieve a list of order benefits applied to an order

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-order-benefits-applied-to-an-order

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
    "benefits": [
        {
            "shop_no": 1,
            "order_id": "20201005-0000011",
            "order_item_code": "20201005-0000011-01",
            "benefit_no": 900,
            "benefit_title": "bulk order discount",
            "benefit_name": "bulk order discount name",
            "benefit_code": 966,
            "benefit_percent": "10%",
            "benefit_value": "500.00",
            "benefit_app_key": null
        },
        {
            "shop_no": 1,
            "order_id": "20201005-0000011",
            "order_item_code": "20201005-0000011-01",
            "benefit_no": 901,
            "benefit_title": "customer discount",
            "benefit_name": "customer discount name",
            "benefit_code": 967,
            "benefit_percent": null,
            "benefit_value": "500.00",
            "benefit_app_key": null
        }
    ]
}
```
