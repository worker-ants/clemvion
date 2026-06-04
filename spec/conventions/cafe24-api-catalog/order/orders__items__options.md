---
resource: order
entity: orders__items__options
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--items--options
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders items options

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders items options](https://developers.cafe24.com/docs/ko/api/admin/#orders--items--options)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문 품목에 추가입력 옵션을 둥록, 수정, 삭제할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `order_id` |  | 주문번호 |
| `order_item_code` |  | 품주코드 |
| `product_bundle` |  | 세트상품 여부 |
| `additional_options` |  | 추가입력 옵션 |
| `bundle_additional_options` |  | 세트상품 추가입력 옵션 |

## Operations

### `POST /api/v2/admin/orders/{order_id}/items/{order_item_code}/options` — Create order item options

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-order-item-options

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `order_item_code` | ✓ |  |  | 품주코드 |
| `product_bundle` | ✓ |  |  | 세트상품 여부 |
| `additional_options` |  |  |  | 추가입력 옵션 |
| ↳ `additional_option_name` | ✓ |  |  | 추가입력옵션명 |
| ↳ `additional_option_value` | ✓ |  |  | 추가입력 옵션 값 |
| `bundle_additional_options` |  |  |  | 세트상품 추가입력 옵션 |
| ↳ `variant_code` | ✓ |  |  | 품목코드 |
| ↳ `additional_options` |  | Array |  |  |
| ↳ ↳ `additional_option_name` | ✓ |  |  | 추가입력옵션명 |
| ↳ ↳ `additional_option_value` | ✓ |  |  | 추가입력 옵션 값 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `item` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `order_item_code` |  | 품주코드 |
| ↳ `product_bundle` |  | 세트상품 여부 |
| ↳ `additional_options` |  | 추가입력 옵션 |
| ↳ ↳ `additional_option_name` |  | 추가입력옵션명 |
| ↳ ↳ `additional_option_value` |  | 추가입력 옵션 값 |
| ↳ `bundle_additional_options` |  | 세트상품 추가입력 옵션 |

응답 예시 (JSON):

```json
{
    "item": {
        "shop_no": 1,
        "order_id": "20230220-0000105",
        "order_item_code": "20230220-0000105-01",
        "product_bundle": "F",
        "additional_options": [
            {
                "additional_option_name": "Pattern1",
                "additional_option_value": "Flower"
            },
            {
                "additional_option_name": "Pattern2",
                "additional_option_value": "Dot Pattern"
            }
        ],
        "bundle_additional_options": null
    }
}
```

### `PUT /api/v2/admin/orders/{order_id}/items/{order_item_code}/options` — Edit order item options

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#edit-order-item-options

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `order_item_code` | ✓ |  |  | 품주코드 |
| `additional_options` |  |  |  | 추가입력 옵션 |
| ↳ `additional_option_name` | ✓ |  |  | 추가입력옵션명 |
| ↳ `additional_option_value` | ✓ |  |  | 추가입력 옵션 값 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `item` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `order_item_code` |  | 품주코드 |
| ↳ `additional_options` |  | 추가입력 옵션 |
| ↳ ↳ `additional_option_name` |  | 추가입력옵션명 |
| ↳ ↳ `additional_option_value` |  | 추가입력 옵션 값 |

응답 예시 (JSON):

```json
{
    "item": {
        "shop_no": 1,
        "order_id": "20230220-0000105",
        "order_item_code": "20230220-0000105-01",
        "additional_options": [
            {
                "additional_option_name": "Pattern1",
                "additional_option_value": "Flower Pattern"
            },
            {
                "additional_option_name": "Pattern2",
                "additional_option_value": "Dot Pattern"
            }
        ]
    }
}
```
