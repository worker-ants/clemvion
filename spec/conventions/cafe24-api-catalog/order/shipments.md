---
resource: order
entity: shipments
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#shipments
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Shipments

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Shipments](https://developers.cafe24.com/docs/ko/api/admin/#shipments)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

배송(Shipments)은 주문의 하위리소스인 주문의 배송(Orders shipments)과 다르게 여러 주문의 배송 정보를 한번에 등록하거나 수정할 수 있습니다. · 배송 정보에는 송장번호와 배송사 정보, 배송 상태 등이 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `tracking_no` |  | 송장번호 |
| `shipping_company_code` |  | 배송업체 코드 shipping_company_code |
| `status` |  | 주문상태 standby : 배송대기 · shipping : 배송중 · shipped : 배송완료 |
| `order_id` |  | 주문번호 |
| `shipping_code` |  | 배송번호 |
| `order_item_code` |  | 품주코드 |
| `carrier_id` |  | 배송사 아이디 |
| `status_additional_info` |  | 주문상태 추가정보 |

## Operations

### `POST /api/v2/admin/shipments` — Create shipping information for multiple orders

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 100
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-shipping-information-for-multiple-orders

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `tracking_no` | ✓ | 최대글자수 : [40자] |  | 송장번호 |
| `shipping_company_code` | ✓ |  |  | 배송업체 코드 shipping_company_code |
| `status` | ✓ |  |  | 주문상태 standby : 배송대기 · shipping : 배송중 |
| `order_id` |  |  |  | 주문번호 |
| `shipping_code` |  |  |  | 배송번호 |
| `order_item_code` |  |  |  | 품주코드 |
| `carrier_id` |  |  |  | 배송사 아이디 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "shipments": [
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
            "carrier_id": 1
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
            "carrier_id": 1
        }
    ]
}
```

### `PUT /api/v2/admin/shipments` — Update multiple order shippings

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 100
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-multiple-order-shippings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `shipping_code` | ✓ |  |  | 배송번호 |
| `order_id` |  |  |  | 주문번호 |
| `status` |  |  |  | 주문상태 status 사용하여 배송상태 수정시 tracking_no, shipping_company_code는 사용 불가 standby : 배송대기 · shipping : 배송중 · shipped : 배송완료 |
| `status_additional_info` |  | 최대글자수 : [30자] |  | 주문상태 추가정보 |
| `tracking_no` |  | 최대글자수 : [40자] |  | 송장번호 tracking_no 사용시 shipping_company_code를 함께 사용해야 하며, 송장번호 수정시 status는 사용 불가 |
| `shipping_company_code` |  |  |  | 배송업체 코드 해당 주문의 송장번호와 함께 배송사를 변경할 수 있다. · shipping_company_code · tracking_no 사용시 shipping_company_code를 함께 사용해야 하며, 송장번호 수정시 status는 사용 불가 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "shipments": [
        {
            "shop_no": 1,
            "shipping_code": "D-20190108-0000791-00",
            "order_id": "20190108-0000791",
            "status": "shipped",
            "status_additional_info": "Arrived at Sorting Hub",
            "tracking_no": null,
            "shipping_company_code": null
        },
        {
            "shop_no": 1,
            "shipping_code": "D-20190108-0000801-00",
            "order_id": "20190108-0000801",
            "status": "shipped",
            "status_additional_info": "Arrived at Sorting Hub",
            "tracking_no": null,
            "shipping_company_code": null
        }
    ]
}
```
