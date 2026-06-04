---
resource: product
entity: mains__products
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#mains--products
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Product / Mains products

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Mains products](https://developers.cafe24.com/docs/ko/api/admin/#mains--products)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

특정 메인분류에 배정된 상품을 목록으로 조회하거나 상품배정, 수정, 삭제할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` |  | 상품번호 |
| `product_name` |  | 상품명 |
| `fixed_sort` |  | 고정 여부 |
| `fix_product_no` |  | 진열순위 고정 상품번호 |

## Operations

### `GET /api/v2/admin/mains/{display_group}/products` — Retrieve a list of products in main category

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-products-in-main-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `display_group` | ✓ |  |  | 메인분류 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "products": [
        {
            "shop_no": 1,
            "product_no": 7,
            "product_name": "product_name",
            "fixed_sort": false
        },
        {
            "shop_no": 1,
            "product_no": 8,
            "product_name": "product_name2",
            "fixed_sort": false
        }
    ]
}
```

### `GET /api/v2/admin/mains/{display_group}/products/count` — Retrieve a count of products in main category

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-products-in-main-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `display_group` | ✓ |  |  | 메인분류 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "count": 3
}
```

### `POST /api/v2/admin/mains/{display_group}/products` — Set main category products

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#set-main-category-products

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `display_group` | ✓ |  |  | 메인분류 번호 |
| `product_no` | ✓ |  |  | 상품번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "product": {
        "shop_no": 1,
        "product_no": [
            7,
            8,
            9
        ]
    }
}
```

### `PUT /api/v2/admin/mains/{display_group}/products` — Update fixed sorting of products in main category

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-fixed-sorting-of-products-in-main-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `display_group` | ✓ |  |  | 메인분류 번호 |
| `product_no` | ✓ |  |  | 상품번호 요청한 상품번호의 순서 대로 진열순위가 지정 |
| `fix_product_no` |  |  |  | 진열순위 고정 상품번호 진열순위를 고정하고자 하는 상품번호를 지정 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "product": {
        "shop_no": 1,
        "product_no": [
            7,
            8,
            9
        ],
        "fix_product_no": [
            8,
            9
        ]
    }
}
```

### `DELETE /api/v2/admin/mains/{display_group}/products/{product_no}` — Delete a product in main category

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product-in-main-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `display_group` | ✓ |  |  | 메인분류 번호 |
| `product_no` | ✓ |  |  | 상품번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "product": {
        "shop_no": 1,
        "product_no": 7
    }
}
```
