---
resource: order
entity: orders__exchangerequests
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--exchangerequests
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders exchangerequests

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders exchangerequests](https://developers.cafe24.com/docs/ko/api/admin/#orders--exchangerequests)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

교환 처리를 요청한 주문의 교환접수를 거부할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `order_id` |  | 주문번호 |
| `undone` |  | 접수거부 여부 |
| `order_item_code` |  | 품주코드 |
| `additional_payment_gateway_cancel` |  | 추가 PG 취소 |

## Operations

### `PUT /api/v2/admin/orders/{order_id}/exchangerequests` — Reject an exchange request

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#reject-an-exchange-request

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `order_item_code` | ✓ |  |  | 품주코드 |
| `undone` | ✓ |  |  | 접수거부 여부 T : 접수거부함 |
| `reason_type` |  |  |  | 사유 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| `reason` |  | 최대글자수 : [2000자] |  | 사유 |
| `display_reject_reason` |  |  | F | 주문상세내역 노출설정 T : 노출함 · F : 노출안함 |
| `reject_reason` |  | 최대글자수 : [2000자] |  | 거부 사유 고객에게 노출되는 접수 거부 사유 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "exchangerequests": {
        "shop_no": 1,
        "order_id": "20200723-0000001",
        "order_item_code": [
            "20200723-0000001-01",
            "20200723-0000001-02"
        ],
        "undone": "T",
        "additional_payment_gateway_cancel": {
            "success": [
                "20200723-0000001-01",
                "20200723-0000001-02"
            ],
            "fail": null
        }
    }
}
```
