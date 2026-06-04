---
resource: product
entity: products__variants
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products--variants
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Product / Products variants

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products variants](https://developers.cafe24.com/docs/ko/api/admin/#products--variants)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품의 품목(Products variants)은 쇼핑몰에서 판매되는 상품의 기본 단위입니다. · 쇼핑몰은 일반적으로 고객에게 다양한 선택권을 제공하기 위해 같은 상품이지만 사이즈가 다르거나, 혹은 색상이 다른 품목들을 판매합니다. · 품목의 조회, 등록, 수정 또는 삭제를 할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `variant_code` | 형식 : [A-Z0-9]; 글자수 최소: [12자]~최대: [12자] | 상품 품목 코드 시스템이 품목에 부여한 코드. 해당 쇼핑몰 내에서 품목 코드는 중복되지 않음. |
| `options` |  | 옵션 |
| `custom_variant_code` | 최대글자수 : [40자] | 자체 품목 코드 사용자가 품목에 부여 가능한 코드. 재고 관리 등의 이유로 자체적으로 상품을 관리하고 있는 경우 사용함. |
| `display` |  | 진열상태 해당 품목을 진열할지 여부. 품목을 진열할 경우 상품 상세 또는 상품 목록에서 해당 품목을 선택할 수 있다. 품목이 진열되어있지 않을 경우 해당 품목이 표시되지 않으며 해당 품목을 구매할 수 없다. T : 판매함 · F : 판매안함 |
| `selling` |  | 판매상태 해당 품목을 판매할지 여부. 진열은 되어있으나 판매는 하지 않을 경우 해당 품목은 "품절"로 표시되며 해당 품목을 구매할 수 없다. 품목이 "판매함" 상태여도 "진열안함"으로 되어있다면 해당 품목을 구매할 수 없다. T : 진열함 · F : 진열안함 |
| `display_order` | 최소: [1]~최대: [300] | 진열 순서 |
| `additional_amount` |  | 추가금액 해당 품목을 구매할 경우, 상품의 판매가에 더하여 지불해야하는 추가 가격. |
| `use_inventory` |  | 재고 사용여부 T : 사용함 · F : 사용안함 |
| `important_inventory` |  | 중요재고 여부 A : 일반재고 · B : 중요재고 |
| `inventory_control_type` |  | 재고 수량체크 기준 A : 주문기준 · B : 결제기준 |
| `display_soldout` |  | 품절표시여부 T : 품절표시 사용 · F : 품절표시 사용안함 |
| `quantity` |  | 수량 |
| `safety_inventory` |  | 안전재고수량 |
| `image` |  | 품목 이미지 |
| `inventories` |  | 재고 리소스 품목의 재고 리소스 |
| `duplicated_custom_variant_code` |  | 자체품목코드 중복여부 T : 중복됨 · F : 중복안됨 |
| `product_no` |  | 상품번호 상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음. |

## Operations

### `GET /api/v2/admin/products/{product_no}/variants` — Retrieve a list of product variants

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-variants

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` | ✓ |  |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |
| `inventories` |  |  |  | 재고 리소스 품목의 재고 리소스 · 조회시 Embed 파라메터를 사용하여 조회할 수 있다. ,(콤마)로 여러 건을 검색할 수 있다. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "variants": [
        {
            "shop_no": 1,
            "variant_code": "P000000R000C",
            "options": [
                {
                    "name": "Color",
                    "value": "Blue"
                },
                {
                    "name": "Size",
                    "value": "Small"
                }
            ],
            "custom_variant_code": "",
            "display": "T",
            "selling": "T",
            "display_order": 1,
            "additional_amount": "0.00",
            "use_inventory": "T",
            "important_inventory": "A",
            "inventory_control_type": "A",
            "display_soldout": "T",
            "quantity": 6,
            "safety_inventory": 7,
            "image": "https://{domain}/web/product/medium/202402/b51c97e46192e6e2b97732cf196829ed.jpg"
        },
        {
            "shop_no": 1,
            "variant_code": "P000000R000D",
            "options": [
                {
                    "name": "Color",
                    "value": "Red"
                },
                {
                    "name": "Size",
                    "value": "Small"
                }
            ],
            "custom_variant_code": "",
            "display": "T",
            "selling": "T",
            "display_order": 2,
            "additional_amount": "0.00",
            "use_inventory": "T",
            "important_inventory": "B",
            "inventory_control_type": "A",
            "display_soldout": "T",
            "quantity": 15,
            "safety_inventory": 0,
            "image": "https://{domain}/web/product/medium/202402/b51c97e46192e6e2b97732cf196829ed.jpg"
        }
    ]
}
```

### `GET /api/v2/admin/products/{product_no}/variants/{variant_code}` — Retrieve a product variant

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-variant

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` | ✓ |  |  | 상품번호 상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음. |
| `variant_code` | ✓ | 형식 : [A-Z0-9]; 글자수 최소: [12자]~최대: [12자] |  | 품목코드 |
| `inventories` |  |  |  | 재고 리소스 · 조회시 Embed 파라메터를 사용하여 조회할 수 있다. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "variant": {
        "shop_no": 1,
        "variant_code": "P000000R000C",
        "options": [
            {
                "name": "Color",
                "value": "Black"
            },
            {
                "name": "Size",
                "value": "L"
            }
        ],
        "custom_variant_code": "",
        "display": "T",
        "selling": "T",
        "display_order": 1,
        "additional_amount": "0.00",
        "use_inventory": "T",
        "important_inventory": "A",
        "inventory_control_type": "A",
        "display_soldout": "T",
        "quantity": 3,
        "safety_inventory": 8,
        "image": "https://{domain}/web/product/extra/202402/620fafeb5c3f4616887b96c40579cbe2.png"
    }
}
```

### `PUT /api/v2/admin/products/{product_no}/variants/{variant_code}` — Update a product variant

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-variant

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` | ✓ |  |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |
| `variant_code` | ✓ | 형식 : [A-Z0-9]; 글자수 최소: [12자]~최대: [12자] |  | 상품 품목 코드 시스템이 품목에 부여한 코드. 해당 쇼핑몰 내에서 품목 코드는 중복되지 않음. |
| `custom_variant_code` |  | 최대글자수 : [40자] |  | 자체 품목 코드 Youtube shopping 이용 시에는 미제공 사용자가 품목에 부여 가능한 코드. 재고 관리 등의 이유로 자체적으로 상품을 관리하고 있는 경우 사용함. |
| `display` |  |  |  | 진열상태 Youtube shopping 이용 시에는 미제공 해당 품목을 진열할지 여부. 품목을 진열할 경우 상품 상세 또는 상품 목록에서 해당 품목을 선택할 수 있다. 품목이 진열되어있지 않을 경우 해당 품목이 표시되지 않으며 해당 품목을 구매할 수 없다. T : 진열함 · F : 진열안함 |
| `selling` |  |  |  | 판매상태 해당 품목을 판매할지 여부. 진열은 되어있으나 판매는 하지 않을 경우 해당 품목은 "품절"로 표시되며 해당 품목을 구매할 수 없다. 품목이 "판매함" 상태여도 "진열안함"으로 되어있다면 해당 품목을 구매할 수 없다. T : 판매함 · F : 판매안함 |
| `display_order` |  | 최소: [1]~최대: [300] |  | 진열 순서 조합형 옵션 품목에 대해서만 사용 가능함 |
| `additional_amount` |  | 최소: [-2147483647]~최대: [2147483647] |  | 추가금액 해당 품목을 구매할 경우, 상품의 판매가에 더하여 지불해야하는 추가 가격. |
| `quantity` |  |  |  | 수량 |
| `use_inventory` |  |  |  | 재고 사용여부 T : 사용함 · F : 사용안함 |
| `important_inventory` |  |  |  | 중요재고 여부 Youtube shopping 이용 시에는 미제공 A : 일반재고 · B : 중요재고 |
| `inventory_control_type` |  |  |  | 재고 수량체크 기준 A : 주문기준 · B : 결제기준 |
| `display_soldout` |  |  |  | 품절표시여부 T : 품절표시 사용 · F : 품절표시 사용안함 |
| `safety_inventory` |  |  |  | 안전재고수량 Youtube shopping 이용 시에는 미제공 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "variant": {
        "shop_no": 1,
        "variant_code": "P000000R000A",
        "options": [
            {
                "name": "Color",
                "value": "Black"
            },
            {
                "name": "Size",
                "value": "L"
            }
        ],
        "custom_variant_code": "OPTION_CUSTOM_CODE",
        "duplicated_custom_variant_code": "F",
        "display": "T",
        "selling": "F",
        "display_order": 1,
        "additional_amount": "-1000.00",
        "inventories": {
            "shop_no": 1,
            "variant_code": "P000000R000A",
            "quantity": 15,
            "use_inventory": "T",
            "important_inventory": "A",
            "inventory_control_type": "B",
            "display_soldout": "T",
            "safety_inventory": 10
        }
    }
}
```

### `PUT /api/v2/admin/products/{product_no}/variants` — Update multiple product variants

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 100
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-multiple-product-variants

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `product_no` | ✓ |  |  | 상품번호 |
| `variant_code` | ✓ | 형식 : [A-Z0-9]; 글자수 최소: [12자]~최대: [12자] |  | 상품 품목 코드 |
| `custom_variant_code` |  | 최대글자수 : [40자] |  | 자체 품목 코드 |
| `display` |  |  |  | 진열상태 T : 진열함 · F : 진열안함 |
| `selling` |  |  |  | 판매상태 T : 판매함 · F : 판매안함 |
| `display_order` |  | 최소: [1]~최대: [300] |  | 진열 순서 조합형 옵션 품목에 대해서만 사용 가능함 |
| `additional_amount` |  | 최소: [-2147483647]~최대: [2147483647] |  | 추가금액 |
| `quantity` |  |  |  | 수량 |
| `use_inventory` |  |  |  | 재고 사용여부 T : 사용함 · F : 사용안함 |
| `important_inventory` |  |  |  | 중요재고 여부 A : 일반재고 · B : 중요재고 |
| `inventory_control_type` |  |  |  | 재고 수량체크 기준 A : 주문기준 · B : 결제기준 |
| `display_soldout` |  |  |  | 품절표시여부 T : 품절표시 사용 · F : 품절표시 사용안함 |
| `safety_inventory` |  |  |  | 안전재고수량 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "variants": [
        {
            "shop_no": 1,
            "variant_code": "P000000P000B",
            "custom_variant_code": "OPTION_CUSTOM_CODE",
            "options": [
                {
                    "name": "Color",
                    "value": "Black"
                },
                {
                    "name": "Size",
                    "value": "L"
                }
            ],
            "display": "T",
            "selling": "F",
            "display_order": 1,
            "additional_amount": "-1000.00",
            "inventories": {
                "shop_no": 1,
                "variant_code": "P000000P000B",
                "quantity": 15,
                "use_inventory": "T",
                "important_inventory": "A",
                "inventory_control_type": "B",
                "display_soldout": "T",
                "safety_inventory": 6
            }
        },
        {
            "shop_no": 1,
            "variant_code": "P000000P000C",
            "custom_variant_code": "OPTION_CUSTOM_CODE",
            "options": [
                {
                    "name": "Color",
                    "value": "Red"
                },
                {
                    "name": "Size",
                    "value": "M"
                }
            ],
            "display": "T",
            "selling": "F",
            "display_order": 2,
            "additional_amount": "-1000.00",
            "inventories": {
                "shop_no": 1,
                "variant_code": "P000000P000B",
                "quantity": 15,
                "use_inventory": "T",
                "important_inventory": "A",
                "inventory_control_type": "B",
                "display_soldout": "T",
                "safety_inventory": 7
            }
        }
    ]
}
```

### `DELETE /api/v2/admin/products/{product_no}/variants/{variant_code}` — Delete a product variant

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product-variant

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `product_no` | ✓ |  |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |
| `variant_code` | ✓ | 형식 : [A-Z0-9]; 글자수 최소: [12자]~최대: [12자] |  | 상품 품목 코드 시스템이 품목에 부여한 코드. 해당 쇼핑몰 내에서 품목 코드는 중복되지 않음. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "variant": {
        "product_no": 16,
        "variant_code": "P000000P000A"
    }
}
```
