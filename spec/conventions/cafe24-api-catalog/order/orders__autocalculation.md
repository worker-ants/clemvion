---
resource: order
entity: orders__autocalculation
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--autocalculation
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders autocalculation

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders autocalculation](https://developers.cafe24.com/docs/ko/api/admin/#orders--autocalculation)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

자동금액 계산(autocalculation)은 취소/교환/반품시 할인 금액 등 주문 단위의 금액을 자동으로 배분해주는 기능입니다. · 해당 리소스에서는 특정 주문에 대해 자동금액 계산을 해제할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 DEFAULT 1 |
| `order_id` |  | 주문번호 |

## Operations

### `DELETE /api/v2/admin/orders/{order_id}/autocalculation` — Remove auto calculation setting of an order

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#remove-auto-calculation-setting-of-an-order

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "autocalculation": {
        "shop_no": 1,
        "order_id": "20190805-0000011"
    }
}
```
