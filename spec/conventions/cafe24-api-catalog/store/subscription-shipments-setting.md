---
resource: store
entity: subscription-shipments-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#subscription-shipments-setting
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Subscription shipments setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Subscription shipments setting](https://developers.cafe24.com/docs/ko/api/admin/#subscription-shipments-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

정기배송 설정(Subscription shipments setting)은 정기결제를 통해 이루어지는 정기배송에 대한 기능입니다. · 정기배송 설정을 통해 쇼핑몰의 정기배송 상품을 설정하거나 정기배송 상품을 조회할 수 있습니다. · 정기배송 기능을 사용하기 위해서는 먼저 정기배송 서비스가 신청되어 있어야 합니다. · 정기배송 서비스의 신청은 어드민에서 가능합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `subscription_no` |  | 정기배송 상품설정 번호 |
| `subscription_shipments_name` |  | 정기배송 상품설정 명 |
| `product_binding_type` |  | 정기배송 상품 설정 A : 전체상품 · P : 개별상품 · C : 상품분류 |
| `one_time_purchase` |  | 1회구매 제공여부 T : 제공함 · F : 제공안함 |
| `product_list` |  | 적용 상품 |
| `category_list` |  | 적용 분류 |
| `use_discount` |  | 정기배송 할인 사용여부 T : 사용함 · F : 사용안함 |
| `discount_value_unit` |  | 할인 기준 P : 할인율 · W : 할인 금액 |
| `discount_values` |  | 할인 값 |
| `related_purchase_quantity` |  | 구매수량 관계 여부 T : 구매수량에 따라 · F : 구매수량에 관계없이 |
| `subscription_shipments_cycle_type` |  | 배송주기 제공여부 T : 사용함 · F : 사용안함 |
| `subscription_shipments_cycle` |  | 배송주기 1W : 1주 · 2W : 2주 · 3W : 3주 · 4W : 4주 · 1M : 1개월 · 2M : 2개월 · 3M : 3개월 · 4M : 4개월 · 5M : 5개월 · 6M : 6개월 · 1Y : 1년 |
| `subscription_shipments_count_type` |  | 정기배송 횟수 설정 T : 사용함 · F : 사용안함 |
| `subscription_shipments_count` |  | 정기배송 횟수 2 : 2회 · 3 : 3회 · 4 : 4회 · 6 : 6회 · 8 : 8회 · 10 : 10회 · 12 : 12회 |
| `use_order_price_condition` |  | 혜택제공금액기준 사용여부 T : 사용함 · F : 사용안함 |
| `order_price_greater_than` |  | 혜택제공금액기준 제공 기준금액 |
| `include_regional_shipping_rate` |  | 지역별배송비 포함여부 T : 포함 · F : 미포함 |
| `shipments_start_date` | 최소값: [1]; 최대값: [30] | 배송시작일 설정 |
| `change_option` |  | 옵션 변경 가능 여부 T : 사용함 · F : 사용안함 |

## Operations

### `GET /api/v2/admin/subscription/shipments/setting` — Retrieve a list of subscription products

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-subscription-products

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `subscription_no` |  |  |  | 정기배송 상품설정 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "shipments": [
        {
            "shop_no": 1,
            "subscription_no": 70,
            "subscription_shipments_name": "SHIRTS SUBSCRIPTION SHIPMENTS",
            "product_binding_type": "P",
            "one_time_purchase": "T",
            "product_list": [
                11,
                13
            ],
            "category_list": null,
            "use_discount": "T",
            "discount_value_unit": "P",
            "discount_values": [
                {
                    "delivery_cycle": 1,
                    "discount_amount": 10
                },
                {
                    "delivery_cycle": 5,
                    "discount_amount": 20
                }
            ],
            "subscription_shipments_cycle_type": "T",
            "subscription_shipments_cycle": [
                "1M",
                "2M"
            ],
            "subscription_shipments_count_type": "T",
            "subscription_shipments_count": [
                4,
                6,
                8,
                10
            ],
            "use_order_price_condition": "T",
            "order_price_greater_than": "25000.00",
            "include_regional_shipping_rate": "F",
            "shipments_start_date": 3,
            "change_option": "F"
        },
        {
            "shop_no": 1,
            "subscription_no": 71,
            "subscription_shipments_name": "SHIRTS SUBSCRIPTION SHIPMENTS",
            "product_binding_type": "P",
            "one_time_purchase": "T",
            "product_list": [
                11,
                13
            ],
            "category_list": null,
            "use_discount": "T",
            "discount_value_unit": "P",
            "discount_values": [
                {
                    "delivery_cycle": 1,
                    "discount_amount": 10
                },
                {
                    "delivery_cycle": 5,
                    "discount_amount": 20
                }
            ],
            "subscription_shipments_cycle_type": "T",
            "subscription_shipments_cycle": [
                "1M",
                "2M"
            ],
            "subscription_shipments_count_type": "T",
            "subscription_shipments_count": [
                4,
                6,
                8,
                10
            ],
            "use_order_price_condition": "T",
            "order_price_greater_than": "25000.00",
            "include_regional_shipping_rate": "F",
            "shipments_start_date": 3,
            "change_option": "T"
        }
    ]
}
```

### `POST /api/v2/admin/subscription/shipments/setting` — Create a subscription payment rule

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-subscription-payment-rule

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `subscription_shipments_name` | ✓ | 최대글자수 : [255자] |  | 정기배송 상품설정 명 |
| `product_binding_type` | ✓ |  |  | 정기배송 상품 설정 A : 전체상품 · P : 개별상품 · C : 상품분류 |
| `one_time_purchase` |  |  | T | 1회구매 제공여부 T : 제공함 · F : 제공안함 |
| `product_list` |  | 배열 최대사이즈: [10000] |  | 적용 상품 |
| `category_list` |  | 배열 최대사이즈: [1000] |  | 적용 분류 |
| `use_discount` | ✓ |  |  | 정기배송 할인 사용여부 T : 사용함 · F : 사용안함 |
| `discount_value_unit` |  |  |  | 할인 기준 P : 할인율 · W : 할인 금액 |
| `discount_values` |  | 배열 최대사이즈: [40] |  | 할인 값 discount_value_unit이 P일 경우 최대값 : 100 · discount_value_unit이 W일 경우 최대값 : 99999999999999 |
| ↳ `delivery_cycle` | ✓ |  |  | 적용회차 |
| ↳ `discount_amount` | ✓ |  |  | 할인 값 |
| `related_purchase_quantity` |  |  |  | 구매수량 관계 여부 T : 구매수량에 따라 · F : 구매수량에 관계없이 |
| `subscription_shipments_cycle_type` | ✓ |  |  | 배송주기 제공여부 T : 사용함 · F : 사용안함 |
| `subscription_shipments_cycle` | ✓ |  |  | 배송주기 1W : 1주 · 2W : 2주 · 3W : 3주 · 4W : 4주 · 1M : 1개월 · 2M : 2개월 · 3M : 3개월 · 4M : 4개월 · 5M : 5개월 · 6M : 6개월 · 1Y : 1년 |
| `subscription_shipments_count_type` |  |  |  | 정기배송 횟수 설정 T : 사용함 · F : 사용안함 |
| `subscription_shipments_count` |  | 배열 최대사이즈: [7] |  | 정기배송 횟수 2 : 2회 · 3 : 3회 · 4 : 4회 · 6 : 6회 · 8 : 8회 · 10 : 10회 · 12 : 12회 |
| `use_order_price_condition` | ✓ |  |  | 혜택제공금액기준 사용여부 T : 사용함 · F : 사용안함 |
| `order_price_greater_than` |  | 최대값: [99999999999999] |  | 혜택제공금액기준 제공 기준금액 |
| `include_regional_shipping_rate` |  |  |  | 지역별배송비 포함여부 T : 포함 · F : 미포함 |
| `shipments_start_date` |  | 최소값: [1]; 최대값: [30] | 3 | 배송시작일 설정 |
| `change_option` |  |  | F | 옵션 변경 가능 여부 T : 사용함 · F : 사용안함 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "shipment": {
        "shop_no": 1,
        "subscription_no": 70,
        "subscription_shipments_name": "SHIRTS SUBSCRIPTION SHIPMENTS",
        "product_binding_type": "P",
        "one_time_purchase": "T",
        "product_list": [
            11,
            13
        ],
        "category_list": null,
        "use_discount": "T",
        "discount_value_unit": "P",
        "discount_values": [
            {
                "delivery_cycle": 1,
                "discount_amount": 10
            },
            {
                "delivery_cycle": 5,
                "discount_amount": 20
            }
        ],
        "subscription_shipments_cycle_type": "T",
        "subscription_shipments_cycle": [
            "1M",
            "2M"
        ],
        "subscription_shipments_count_type": "T",
        "subscription_shipments_count": [
            4,
            6,
            8,
            10
        ],
        "use_order_price_condition": "T",
        "order_price_greater_than": "25000.00",
        "include_regional_shipping_rate": "F",
        "shipments_start_date": 3,
        "change_option": "F"
    }
}
```

### `PUT /api/v2/admin/subscription/shipments/setting/{subscription_no}` — Update subscription products

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-subscription-products

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `subscription_no` | ✓ |  |  | 정기배송 상품설정 번호 |
| `subscription_shipments_name` |  | 최대글자수 : [255자] |  | 정기배송 상품설정 명 |
| `product_binding_type` |  |  |  | 정기배송 상품 설정 A : 전체상품 · P : 개별상품 · C : 상품분류 |
| `one_time_purchase` |  |  |  | 1회구매 제공여부 T : 제공함 · F : 제공안함 |
| `product_list` |  | 배열 최대사이즈: [10000] |  | 적용 상품 |
| `category_list` |  | 배열 최대사이즈: [1000] |  | 적용 분류 |
| `use_discount` |  |  |  | 정기배송 할인 사용여부 T : 사용함 · F : 사용안함 |
| `discount_value_unit` |  |  |  | 할인 기준 P : 할인율 · W : 할인 금액 |
| `discount_values` |  | 배열 최대사이즈: [40] |  | 할인 값 |
| ↳ `delivery_cycle` | ✓ |  |  | 적용회차 |
| ↳ `discount_amount` | ✓ |  |  | 할인 값 |
| `related_purchase_quantity` |  |  |  | 구매수량 관계 여부 T : 구매수량에 따라 · F : 구매수량에 관계없이 |
| `subscription_shipments_cycle_type` |  |  |  | 배송주기 제공여부 T : 사용함 · F : 사용안함 |
| `subscription_shipments_cycle` |  |  |  | 배송주기 1W : 1주 · 2W : 2주 · 3W : 3주 · 4W : 4주 · 1M : 1개월 · 2M : 2개월 · 3M : 3개월 · 4M : 4개월 · 5M : 5개월 · 6M : 6개월 · 1Y : 1년 |
| `subscription_shipments_count_type` |  |  |  | 정기배송 횟수 설정 T : 사용함 · F : 사용안함 |
| `subscription_shipments_count` |  | 배열 최대사이즈: [7] |  | 정기배송 횟수 2 : 2회 · 3 : 3회 · 4 : 4회 · 6 : 6회 · 8 : 8회 · 10 : 10회 · 12 : 12회 |
| `use_order_price_condition` |  |  |  | 혜택제공금액기준 사용여부 T : 사용함 · F : 사용안함 |
| `order_price_greater_than` |  | 최대값: [99999999999999] |  | 혜택제공금액기준 제공 기준금액 |
| `include_regional_shipping_rate` |  |  |  | 지역별배송비 포함여부 T : 포함 · F : 미포함 |
| `shipments_start_date` |  | 최소값: [1]; 최대값: [30] |  | 배송시작일 설정 |
| `change_option` |  |  |  | 옵션 변경 가능 여부 T : 사용함 · F : 사용안함 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "shipment": {
        "shop_no": 1,
        "subscription_no": 72,
        "subscription_shipments_name": "SHIRTS SUBSCRIPTION SHIPMENTS MODIFY",
        "product_binding_type": "P",
        "one_time_purchase": "T",
        "product_list": [
            11,
            13
        ],
        "use_discount": "T",
        "discount_value_unit": "P",
        "discount_values": [
            {
                "delivery_cycle": 1,
                "discount_amount": 10
            },
            {
                "delivery_cycle": 5,
                "discount_amount": 20
            }
        ],
        "subscription_shipments_cycle_type": "T",
        "subscription_shipments_cycle": [
            "3M",
            "5M"
        ],
        "subscription_shipments_count_type": "T",
        "subscription_shipments_count": [
            4,
            6,
            8,
            10
        ],
        "use_order_price_condition": "T",
        "order_price_greater_than": "30000.00",
        "include_regional_shipping_rate": "F",
        "shipments_start_date": 3,
        "change_option": "F"
    }
}
```

### `DELETE /api/v2/admin/subscription/shipments/setting/{subscription_no}` — Delete subscription products

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-subscription-products

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `subscription_no` | ✓ |  |  | 정기배송 상품설정 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "shipment": {
        "shop_no": 1,
        "subscription_no": 15
    }
}
```
