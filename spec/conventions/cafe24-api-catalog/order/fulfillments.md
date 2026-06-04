---
resource: order
entity: fulfillments
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#fulfillments
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Fulfillments

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Fulfillments](https://developers.cafe24.com/docs/ko/api/admin/#fulfillments)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

배송앱에서 N개의 배송사와 연동하여 배송 정보를 등록하는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| `tracking_no` |  | 송장번호 |
| `shipping_company_code` |  | 배송업체 코드 |
| `status` |  | 주문상태 standby : 배송대기 · shipping : 배송중 |
| `order_id` |  | 주문번호 |
| `shipping_code` |  | 배송번호 |
| `order_item_code` |  | 품주코드 |
| `carrier_id` |  | 배송사 아이디 |
| `post_express_flag` |  | 우체국 택배연동 |

## Operations

### `POST /api/v2/admin/fulfillments` — Create shipping information for multiple orders via Fulfillment

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 100
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-shipping-information-for-multiple-orders-via-fulfillment

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `tracking_no` | ✓ | 최대글자수 : [30자] |  | 송장번호 |
| `shipping_company_code` | ✓ |  |  | 배송업체 코드 |
| `status` | ✓ |  |  | 주문상태 standby : 배송대기 · shipping : 배송중 |
| `order_id` |  |  |  | 주문번호 |
| `shipping_code` |  |  |  | 배송번호 |
| `order_item_code` |  |  |  | 품주코드 |
| `carrier_id` |  |  |  | 배송사 아이디 |
| `post_express_flag` |  |  |  | 우체국 택배연동 S : 송장 전송 완료 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `fulfillments` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| ↳ `tracking_no` |  | 송장번호 |
| ↳ `shipping_company_code` |  | 배송업체 코드 |
| ↳ `status` |  | 주문상태 standby : 배송대기 · shipping : 배송중 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `shipping_code` |  | 배송번호 |
| ↳ `order_item_code` |  | 품주코드 |
| ↳ `carrier_id` |  | 배송사 아이디 |
| ↳ `post_express_flag` |  | 우체국 택배연동 |

응답 예시 (JSON):

```json
{
    "fulfillments": [
        {
            "shop_no": 1,
            "tracking_no": "101080903",
            "shipping_company_code": "0001",
            "status": "shipping",
            "order_id": "20190320-0000024",
            "shipping_code": "D-20190320-0000024-00",
            "order_item_code": [
                "20190320-0000024-01",
                "20190320-0000024-02"
            ],
            "carrier_id": 1,
            "post_express_flag": "S"
        },
        {
            "shop_no": 1,
            "tracking_no": "101080904",
            "shipping_company_code": "0001",
            "status": "shipping",
            "order_id": "20190320-0000019",
            "shipping_code": "D-20190320-0000019-01",
            "order_item_code": [
                "20190320-0000019-01",
                "20190320-0000019-02"
            ],
            "carrier_id": 1,
            "post_express_flag": "S"
        }
    ]
}
```
