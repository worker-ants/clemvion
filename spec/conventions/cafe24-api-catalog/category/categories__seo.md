---
resource: category
entity: categories__seo
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#categories--seo
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Category / Categories seo

> Field-level 카탈로그. Endpoint enumeration index: [`../category.md`](../category.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Categories seo](https://developers.cafe24.com/docs/ko/api/admin/#categories--seo)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

카테고리 SEO(Categories seo)는 특정 카테고리의 SEO 에 대한 설정과 설정값의 조회가 가능한 기능입니다. · SEO는 검색엔진 최적화(Search Engine Optimization)의 약자로서 본 기능을 활용하여 검색엔진에 카테고리나 쇼핑몰이 더 잘 검색될 수 있도록 할 수 있습니다. · 카테고리 SEO는 카테고리의의 하위 리소스로서 특정 카테고리의 검색엔진 최적화 설정을 할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `category_no` |  | 분류 번호 |
| `search_engine_exposure` |  | 검색 엔진 노출 설정 T : 사용함 · F : 사용안함 |
| `meta_title` |  | 브라우저 타이틀 |
| `meta_author` |  | 메타태그1 : Author |
| `meta_description` |  | 메타태그2 : Description |
| `meta_keywords` |  | 메타태그3 : Keywords |

## Operations

### `GET /api/v2/admin/categories/{category_no}/seo` — Retrieve SEO settings by category

- **Scope**: `mall.read_category` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-seo-settings-by-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `category_no` | ✓ |  |  | 분류 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "seo": {
        "shop_no": 1,
        "category_no": 24,
        "search_engine_exposure": "T",
        "meta_title": "Browser Title",
        "meta_author": "Cafe24",
        "meta_description": "This is a sample product.",
        "meta_keywords": "sample keyword1,sample keyword2, sample keyword3, ..."
    }
}
```

### `PUT /api/v2/admin/categories/{category_no}/seo` — Update a product category SEO

- **Scope**: `mall.write_category` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-category-seo

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `category_no` | ✓ |  |  | 분류 번호 |
| `search_engine_exposure` |  |  |  | 검색 엔진 노출 설정 T : 사용함 · F : 사용안함 |
| `meta_title` |  |  |  | 브라우저 타이틀 |
| `meta_author` |  |  |  | 메타태그1 : Author |
| `meta_description` |  |  |  | 메타태그2 : Description |
| `meta_keywords` |  |  |  | 메타태그3 : Keywords |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "seo": {
        "shop_no": 1,
        "category_no": 24,
        "search_engine_exposure": "T",
        "meta_title": "Browser Title",
        "meta_author": "Cafe24",
        "meta_description": "This is a sample product.",
        "meta_keywords": "sample keyword1,sample keyword2, sample keyword3, ..."
    }
}
```
