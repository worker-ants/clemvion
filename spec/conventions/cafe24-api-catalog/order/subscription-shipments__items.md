---
resource: order
entity: subscription-shipments__items
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#subscription-shipments--items
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Subscription shipments items

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Subscription shipments items](https://developers.cafe24.com/docs/ko/api/admin/#subscription-shipments--items)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

정기배송 품목(Subscription shipments items)을 통해 정기배송 품목별 수정을 할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `subscription_item_id` |  | 정기배송 아이템 번호 |
| `subscription_state` |  | 정기배송 상태 U:이용중 · B:일시정지(구매자신청) · Q:일시정지(관리자신청) · M:고객해지 · A:자동해지 · O:관리자해지 |
| `quantity` |  | 주문 수량 |
| `expected_delivery_date` |  | 배송예정일 |
| `subscription_shipments_cycle` |  | 배송주기 1W : 1주 · 2W : 2주 · 3W : 3주 · 4W : 4주 · 1M : 1개월 · 2M : 2개월 · 3M : 3개월 · 4M : 4개월 · 5M : 5개월 · 6M : 6개월 · 1Y : 1년 |
| `changed_variant_code` | 형식 : [A-Z0-9]; 글자수 최소: [12자]~최대: [12자] | 변경된 옵션 품목코드 |
| `max_delivery_limit` | 최소값: [0]; 최대값: [12] | 정기배송 횟수 0 : 제한없음 · 2 : 2회 · 3 : 3회 · 4 : 4회 · 6 : 6회 · 10 : 10회 · 12 : 12회 |

## Operations

### `PUT /api/v2/admin/subscription/shipments/{subscription_id}/items` — Update product variants in subscription

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 10
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-product-variants-in-subscription

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `subscription_id` | ✓ |  |  | 정기배송 신청번호 |
| `subscription_item_id` | ✓ | 최소값: [1] |  | 정기배송 아이템 번호 |
| `subscription_state` |  |  |  | 정기배송 상태 U:이용중 · Q:일시정지(관리자신청) · O:관리자해지 |
| `quantity` |  | 최소값: [1] |  | 주문 수량 |
| `expected_delivery_date` |  | 날짜 |  | 배송예정일 |
| `subscription_shipments_cycle` |  |  |  | 배송주기 1W : 1주 · 2W : 2주 · 3W : 3주 · 4W : 4주 · 1M : 1개월 · 2M : 2개월 · 3M : 3개월 · 4M : 4개월 · 5M : 5개월 · 6M : 6개월 · 1Y : 1년 |
| `changed_variant_code` |  | 형식 : [A-Z0-9]; 글자수 최소: [12자]~최대: [12자] |  | 변경된 옵션 품목코드 |
| `max_delivery_limit` |  | 최소값: [0]; 최대값: [12] |  | 정기배송 횟수 0 : 제한없음 · 2 : 2회 · 3 : 3회 · 4 : 4회 · 6 : 6회 · 10 : 10회 · 12 : 12회 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "items": [
        {
            "subscription_item_id": 101,
            "quantity": 2,
            "expected_delivery_date": "2021-07-16",
            "subscription_shipments_cycle": "1M",
            "max_delivery_limit": 6
        },
        {
            "subscription_item_id": 21,
            "subscription_state": "C"
        },
        {
            "subscription_item_id": 103,
            "changed_variant_code": "P00000BQ000D"
        }
    ]
}
```
