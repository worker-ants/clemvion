---
resource: order
entity: orders__shipments
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--shipments
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders shipments

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders shipments](https://developers.cafe24.com/docs/ko/api/admin/#orders--shipments)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문의 배송(Shipments)은 주문을 배송처리하기 위해 필요한 배송 정보를 의미합니다. · 주문의 배송 정보에는 송장번호와 배송사 정보, 배송 상태 등이 있습니다. · 주문의 배송 기능을 활용하여 주문을 배송대기 처리하거나 배송중 처리할 수 있으며 송장번호 등도 수정할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| `shipping_code` |  | 배송번호 |
| `order_id` |  | 주문번호 |
| `tracking_no` |  | 송장번호 |
| `tracking_no_updated_date` |  | 송장번호입력일 |
| `shipping_company_code` |  | 배송업체 코드 shipping_company_code |
| `items` |  | 품주 목록 |
| `status` |  | 주문상태 standby : 배송대기 · shipping : 배송중 · shipped : 배송완료 |
| `order_item_code` |  | 품주코드 |
| `carrier_id` |  | 배송사 아이디 |
| `status_additional_info` |  | 주문상태 추가정보 |

## Operations

### `GET /api/v2/admin/orders/{order_id}/shipments` — Retrieve a list of shipping information of an order

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-shipping-information-of-an-order

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `shipments` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| ↳ `shipping_code` |  | 배송번호 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `tracking_no` |  | 송장번호 |
| ↳ `tracking_no_updated_date` |  | 송장번호입력일 |
| ↳ `shipping_company_code` |  | 배송업체 코드 shipping_company_code |
| ↳ `items` |  | 품주 목록 |
| ↳ ↳ `order_item_code` |  | 품주코드 |
| ↳ ↳ `status` |  | 주문상태 standby : 배송대기 · shipping : 배송중 · shipped : 배송완료 |

응답 예시 (JSON):

```json
{
    "shipments": [
        {
            "shop_no": 1,
            "shipping_code": "D-20180627-0000017-00",
            "order_id": "20180627-0000017",
            "tracking_no": "101080903",
            "tracking_no_updated_date": "2018-09-03T17:20:49+09:00",
            "shipping_company_code": "0001",
            "items": [
                {
                    "order_item_code": "20180627-0000017-01",
                    "status": "standby"
                },
                {
                    "order_item_code": "20180627-0000017-02",
                    "status": "shipping "
                }
            ]
        },
        {
            "shop_no": 1,
            "shipping_code": "D-20180627-0000017-01",
            "order_id": "20180627-0000017",
            "tracking_no": "101080904",
            "tracking_no_updated_date": "2018-09-05T17:20:49+09:00",
            "shipping_company_code": "0001",
            "items": [
                {
                    "order_item_code": "20180627-0000017-03",
                    "status": "standby"
                },
                {
                    "order_item_code": "20180627-0000017-04",
                    "status": "shipping "
                }
            ]
        }
    ]
}
```

### `POST /api/v2/admin/orders/{order_id}/shipments` — Create an order shipping information

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-shipping-information

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `tracking_no` | ✓ | 최대글자수 : [40자] |  | 송장번호 |
| `shipping_company_code` | ✓ |  |  | 배송업체 코드 shipping_company_code |
| `order_item_code` |  |  |  | 품주코드 |
| `status` | ✓ |  |  | 주문상태 standby : 배송대기 · shipping : 배송중 |
| `shipping_code` |  |  |  | 배송번호 |
| `carrier_id` |  |  |  | 배송사 아이디 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `shipments` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| ↳ `shipping_code` |  | 배송번호 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `status` |  | 주문상태 standby : 배송대기 · shipping : 배송중 · shipped : 배송완료 |
| ↳ `tracking_no` |  | 송장번호 |
| ↳ `shipping_company_code` |  | 배송업체 코드 shipping_company_code |
| ↳ `order_item_code` |  | 품주코드 |
| ↳ `carrier_id` |  | 배송사 아이디 |

응답 예시 (JSON):

```json
{
    "shipments": [
        {
            "shop_no": 1,
            "shipping_code": "D-20180627-0000017-00",
            "order_id": "20180627-0000017",
            "status": "shipping",
            "tracking_no": "101080903",
            "shipping_company_code": "0001",
            "order_item_code": [
                "20180627-0000017-01",
                "20180627-0000017-02"
            ],
            "carrier_id": 1
        }
    ]
}
```

### `PUT /api/v2/admin/orders/{order_id}/shipments/{shipping_code}` — Update an order shipping

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-shipping

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `shipping_code` | ✓ |  |  | 배송번호 |
| `status` |  |  |  | 주문상태 status 사용하여 배송상태 수정시 tracking_no, shipping_company_code는 사용 불가 standby : 배송대기 · shipping : 배송중 · shipped : 배송완료 |
| `status_additional_info` |  | 최대글자수 : [30자] |  | 주문상태 추가정보 |
| `tracking_no` |  | 최대글자수 : [40자] |  | 송장번호 tracking_no 사용시 shipping_company_code를 함께 사용해야 하며, 송장번호 수정시 status는 사용 불가 |
| `shipping_company_code` |  |  |  | 배송업체 코드 shipping_company_code · tracking_no 사용시 shipping_company_code를 함께 사용해야 하며, 송장번호 수정시 status는 사용 불가 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `shipment` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| ↳ `status` |  | 주문상태 standby : 배송대기 · shipping : 배송중 · shipped : 배송완료 |
| ↳ `status_additional_info` |  | 주문상태 추가정보 |
| ↳ `tracking_no` |  | 송장번호 |
| ↳ `shipping_company_code` |  | 배송업체 코드 shipping_company_code |

응답 예시 (JSON):

```json
{
    "shipment": {
        "shop_no": 1,
        "status": "shipping",
        "status_additional_info": "Arrived at Sorting Hub",
        "tracking_no": null,
        "shipping_company_code": null
    }
}
```

### `DELETE /api/v2/admin/orders/{order_id}/shipments/{shipping_code}` — Delete an order shipping

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-an-order-shipping

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `shipping_code` | ✓ |  |  | 배송번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `shipment` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `shipping_code` |  | 배송번호 |
| ↳ `order_item_code` |  | 품주코드 |

응답 예시 (JSON):

```json
{
    "shipment": {
        "shop_no": 1,
        "order_id": "20181203-0000021",
        "shipping_code": "D-20181203-0000021-00",
        "order_item_code": [
            "20181203-0000021-01",
            "20181203-0000021-02"
        ]
    }
}
```
