---
resource: product
entity: products__seo
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products--seo
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Product / Products seo

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products seo](https://developers.cafe24.com/docs/ko/api/admin/#products--seo)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품 SEO(Products seo)는 특정 상품의 SEO 에 대한 설정과 설정값의 조회가 가능한 기능입니다. · SEO는 검색엔진 최적화(Search Engine Optimization)의 약자로서 본 기능을 활용하여 검색엔진에 상품이나 쇼핑몰이 더 잘 검색될 수 있도록 할 수 있습니다. · 상품 SEO는 상품의 하위 리소스로서 특정 상품의 검색엔진 최적화 설정을 할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `meta_title` |  | 브라우저 타이틀 해당 상품의 상품 상세 페이지의 Title 태그에 표시되는 정보. Title 태그는 브라우저에 표시되는 정보로 검색엔진에서 검색시 가장 기본적인 정보이다. |
| `meta_author` |  | 메타태그1 : Author 해당 상품의 상품 상세 페이지의 태그에 표시되는 정보. author 메타 태그에는 해당 상품을 제조한 사람 또는 등록한 사람을 기입한다. |
| `meta_description` |  | 메타태그2 : Description 해당 상품의 상품 상세 페이지의 태그에 표시되는 정보. description 태그에 검색 결과 페이지에서 검색 결과 아래에 표시될 간략한 정보를 입력할 수 있다. |
| `meta_keywords` |  | 메타태그3 : Keywords 해당 상품의 상품 상세 페이지의 태그에 표시되는 정보. keyword 태그에 해당 상품이 검색되었으면 하는 검색 키워드를 입력할 수 있다. |
| `meta_alt` |  | 상품 이미지 Alt 텍스트 상품 이미지에 표시되는 Alt 텍스트 정보. Alt 텍스트를 입력해놓으면 검색엔진에서 이미지 검색시 검색될 가능성이 높아지며, 브라우저에서 이미지 대신 해당 텍스트를 출력할 수 있어 웹 접근성에도 유리하다. |
| `search_engine_exposure` |  | 검색 엔진 노출 설정 해당 상품을 검색엔진에 노출할 것인지 설정. '노출안함'으로 설정할 경우 해당 상품이 검색엔진에 노출되지 않는다. T : 사용함 · F : 사용안함 |

## Operations

### `GET /api/v2/admin/products/{product_no}/seo` — Retrieve a product's SEO settings

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-s-seo-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` | ✓ |  |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "seo": {
        "shop_no": 1,
        "meta_title": "product title",
        "meta_author": "This is Author",
        "meta_description": "This is Description.",
        "meta_keywords": "This is Keyword.",
        "meta_alt": "image1, image2",
        "search_engine_exposure": "T"
    }
}
```

### `PUT /api/v2/admin/products/{product_no}/seo` — Update product SEO settings

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-product-seo-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` | ✓ |  |  | 상품번호 시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다. |
| `meta_title` |  |  |  | 브라우저 타이틀 해당 상품의 상품 상세 페이지의 Title 태그에 표시되는 정보. Title 태그는 브라우저에 표시되는 정보로 검색엔진에서 검색시 가장 기본적인 정보이다. |
| `meta_author` |  |  |  | 메타태그1 : Author 해당 상품의 상품 상세 페이지의 태그에 표시되는 정보. author 메타 태그에는 해당 상품을 제조한 사람 또는 등록한 사람을 기입한다. |
| `meta_description` |  |  |  | 메타태그2 : Description 해당 상품의 상품 상세 페이지의 태그에 표시되는 정보. description 태그에 검색 결과 페이지에서 검색 결과 아래에 표시될 간략한 정보를 입력할 수 있다. |
| `meta_keywords` |  |  |  | 메타태그3 : Keywords 해당 상품의 상품 상세 페이지의 태그에 표시되는 정보. keyword 태그에 해당 상품이 검색되었으면 하는 검색 키워드를 입력할 수 있다. |
| `meta_alt` |  |  |  | 상품 이미지 Alt 텍스트 상품 이미지에 표시되는 Alt 텍스트 정보. Alt 텍스트를 입력해놓으면 검색엔진에서 이미지 검색시 검색될 가능성이 높아지며, 브라우저에서 이미지 대신 해당 텍스트를 출력할 수 있어 웹 접근성에도 유리하다. |
| `search_engine_exposure` |  |  |  | 검색 엔진 노출 설정 해당 상품을 검색엔진에 노출할 것인지 설정. '노출안함'으로 설정할 경우 해당 상품이 검색엔진에 노출되지 않는다. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "seo": {
        "shop_no": 1,
        "meta_title": "Updated title",
        "meta_author": "Updated Author",
        "meta_description": "Updated Description",
        "meta_keywords": "Updated Keywords",
        "meta_alt": "Upadted Alt Text",
        "search_engine_exposure": "T"
    }
}
```
