---
resource: product
entity: products__customproperties
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products--customproperties
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Product / Products customproperties

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products customproperties](https://developers.cafe24.com/docs/ko/api/admin/#products--customproperties)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품에 등록된 사용자정의 속성을 관리 기능을 제공합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 |
| `custom_properties` |  | 자체 정의 속성 |

## Operations

### `GET /api/v2/admin/products/{product_no}/customproperties` — Retrieve user-defined properties by product

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-user-defined-properties-by-product

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `product_no` | ✓ |  |  | 상품번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "products": {
        "shop_no": 1,
        "custom_properties": [
            {
                "property_no": 1001,
                "property_name": "Color",
                "property_value": "Blue"
            },
            {
                "property_no": 1002,
                "property_name": "Size",
                "property_value": "Large"
            }
        ]
    }
}
```

### `PUT /api/v2/admin/products/{product_no}/customproperties/{property_no}` — Update user-defined properties by product

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-user-defined-properties-by-product

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `product_no` | ✓ |  |  | 상품번호 |
| `property_no` | ✓ |  |  | 자체 정의 속성 번호 |
| `shop_no` |  | 최소값: [1] |  | 멀티쇼핑몰 번호 |
| `property_value` |  |  |  | 자체 정의 속성 값 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "product": {
        "shop_no": 1,
        "custom_properties": [
            {
                "property_no": 1001,
                "property_name": "Color",
                "property_value": "Red"
            },
            {
                "property_no": 1002,
                "property_name": "Size",
                "property_value": "Large"
            }
        ]
    }
}
```

### `DELETE /api/v2/admin/products/{product_no}/customproperties/{property_no}` — Delete user-defined properties by product

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-user-defined-properties-by-product

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `product_no` | ✓ |  |  | 상품번호 |
| `property_no` | ✓ |  |  | 자체 정의 속성 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "product": {
        "shop_no": 1,
        "custom_properties": [
            {
                "property_no": 1001,
                "property_name": "Color",
                "property_value": ""
            },
            {
                "property_no": 1002,
                "property_name": "Size",
                "property_value": "Large"
            }
        ]
    }
}
```
