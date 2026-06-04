---
resource: product
entity: products__tags
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products--tags
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Product / Products tags

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products tags](https://developers.cafe24.com/docs/ko/api/admin/#products--tags)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품 태그(Products tags)는 상품이 특정 단어로 검색 되어야할 경우 추가할 수 있는 검색 키워드와 관련된 기능입니다. · 상품 태그는 하위 리소스로서 상품(Products) 하위에서만 사용할 수 있습니다. · 상품명이나 상품 상세 설명 외에 다른 단어로도 상품이 검색되길 원할 경우 검색어를 상품에 추가할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `tags` |  | 상품 태그 |
| `product_no` |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |
| `tag` |  | 상품 태그 검색 또는 분류를 위하여 상품에 입력하는 검색어 정보(해시태그) |

## Operations

### `GET /api/v2/admin/products/{product_no}/tags` — Retrieve a list of a product's product tags

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-a-product-s-product-tags

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` | ✓ |  |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "tags": {
        "shop_no": 1,
        "tags": [
            "Tag1",
            "Tag2"
        ]
    }
}
```

### `GET /api/v2/admin/products/{product_no}/tags/count` — Retrieve a count of a product's product tags

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-a-product-s-product-tags

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` | ✓ |  |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "count": 3
}
```

### `POST /api/v2/admin/products/{product_no}/tags` — Create product tags

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-product-tags

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` | ✓ |  |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |
| `tags` | ✓ | 배열 최대사이즈: [100] |  | 상품 태그 쇼핑 큐레이션 사용 시 - 배열 최대사이즈 : [100] |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "tag": {
        "shop_no": 1,
        "product_no": 7,
        "tags": [
            "Tag1",
            "Tag2"
        ]
    }
}
```

### `DELETE /api/v2/admin/products/{product_no}/tags/{tag}` — Delete a product tag

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product-tag

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` | ✓ |  |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |
| `tag` |  |  |  | 상품 태그 검색 또는 분류를 위하여 상품에 입력하는 검색어 정보(해시태그) |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "tag": {
        "shop_no": 1,
        "product_no": 7,
        "tag": "Tag1"
    }
}
```
