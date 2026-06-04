---
resource: product
entity: categories__products
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#categories--products
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Product / Categories products

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Categories products](https://developers.cafe24.com/docs/ko/api/admin/#categories--products)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

카테고리 상품(Categories products)은 카테고리의 상품의 표시 순서, 고정 여부, 진열 영역 등을 조회, 수정할 수 있는 관계형 리소스입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 |
| `product_no` |  | 상품번호 상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음. |
| `sequence_no` |  | 표시 순서 |
| `auto_sort` |  | 자동 정렬 여부 |
| `sold_out` |  | 품절여부 |
| `fixed_sort` |  | 고정 여부 |
| `not_for_sale` |  | 판매안함 여부 |
| `display_group` | 최소: [1]~최대: [3] | 상세 상품분류 1 : 일반상품 · 2 : 추천상품 · 3 : 신상품 DEFAULT 1 |
| `sequence` | 최소: [1]~최대: [999998] | 진열 순서 |

## Operations

### `GET /api/v2/admin/categories/{category_no}/products` — Retrieve a list of products by category

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-products-by-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `category_no` | ✓ |  |  | 분류 번호 |
| `display_group` | ✓ | 최소: [1]~최대: [3] |  | 상세 상품분류 1 : 일반상품 · 2 : 추천상품 · 3 : 신상품 |
| `limit` |  | 최소: [1]~최대: [50000] | 50000 | 조회결과 최대건수 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "products": [
        {
            "shop_no": 1,
            "product_no": 10,
            "sequence_no": 1,
            "auto_sort": true,
            "sold_out": true,
            "fixed_sort": true,
            "not_for_sale": false
        },
        {
            "shop_no": 1,
            "product_no": 11,
            "sequence_no": 2,
            "auto_sort": true,
            "sold_out": false,
            "fixed_sort": true,
            "not_for_sale": true
        },
        {
            "shop_no": 1,
            "product_no": 12,
            "sequence_no": 3,
            "auto_sort": true,
            "sold_out": true,
            "fixed_sort": false,
            "not_for_sale": false
        }
    ]
}
```

### `GET /api/v2/admin/categories/{category_no}/products/count` — Retrieve a count of products by category

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-products-by-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `category_no` | ✓ |  |  | 분류 번호 |
| `display_group` | ✓ | 최소: [1]~최대: [3] |  | 상세 상품분류 1 : 일반상품 · 2 : 추천상품 · 3 : 신상품 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "count": 10
}
```

### `POST /api/v2/admin/categories/{category_no}/products` — Add products to a category

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#add-products-to-a-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `category_no` | ✓ |  |  | 분류 번호 |
| `display_group` |  | 최소: [1]~최대: [3] | 1 | 상세 상품분류 1 : 일반상품 · 2 : 추천상품 · 3 : 신상품 |
| `product_no` | ✓ |  |  | 상품번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "product": {
        "display_group": 1,
        "product_no": [
            10,
            12,
            14
        ]
    }
}
```

### `PUT /api/v2/admin/categories/{category_no}/products` — Update a product in product category

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-in-product-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `category_no` | ✓ |  |  | 분류 번호 |
| `display_group` | ✓ | 최소: [1]~최대: [3] |  | 상세 상품분류 1 : 일반상품 · 2 : 추천상품 · 3 : 신상품 |
| `product_no` | ✓ |  |  | 상품번호 |
| `sequence` |  | 최소: [1]~최대: [999999] |  | 진열 순서 |
| `auto_sort` |  |  |  | 자동 정렬 여부 T : 자동 정렬 사용함 · F : 자동 정렬 사용안함 |
| `fixed_sort` |  |  |  | 고정 여부 T : 진열순위 고정 사용함 · F : 진열순위 고정 사용안함 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "product": {
        "shop_no": 1,
        "product_no": 58,
        "sequence": 3,
        "auto_sort": "F",
        "fixed_sort": "F"
    }
}
```

### `DELETE /api/v2/admin/categories/{category_no}/products/{product_no}` — Delete a product by category

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product-by-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `category_no` | ✓ |  |  | 분류 번호 |
| `product_no` | ✓ |  |  | 상품번호 |
| `display_group` |  | 최소: [1]~최대: [3] | 1 | 상세 상품분류 일반상품 영역에서 진열안함 처리 시, 추천상품/신상품 영역에서도 동시에 진열안함 처리된다. 1 : 일반상품 · 2 : 추천상품 · 3 : 신상품 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "product": {
        "display_group": 1,
        "product_no": 12
    }
}
```
