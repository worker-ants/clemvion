---
id: translation
status: implemented
code:
  - codebase/backend/src/nodes/integration/cafe24/metadata/translation.ts
---

# Cafe24 API Catalog — Translation (번역)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `translation_products_list` | 상품 번역 목록 조회 | Retrieve a list of product translations | GET | `translations/products` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-translations) |
| `translation_products_update` | 상품 번역 수정 | Update product translation | PUT | `translations/products/{product_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-product-translation) |
| `translation_categories_list` | 카테고리 번역 목록 조회 | Retrieve a list of product category translations | GET | `translations/categories` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-category-translations) |
| `translation_categories_update` | 카테고리 번역 수정 | Update product category translation | PUT | `translations/categories/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-product-category-translation) |
| `translation_store_list` | 상점 번역 목록 조회 | Retrieve a list of store translations | GET | `translations/store` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-store-translations) |
| `translation_store_update` | 상점 번역 수정 | Update the translations of a store | PUT | `translations/store` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-the-translations-of-a-store) |
| `translation_themes_list` | 테마 번역 목록 조회 | Retrieve a list of theme translations | GET | `translations/themes` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-theme-translations) |
| `translation_themes_get` | 테마 번역 단건 조회 | Retrieve a theme translation | GET | `translations/themes/{skin_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-theme-translation) |
| `translation_themes_update` | 테마 번역 수정 | Update a theme translation | PUT | `translations/themes/{skin_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-theme-translation) |

## Field-level 상세 카탈로그

> 각 sub-resource 의 **응답 속성(field) + operation 요청 파라미터**를 Cafe24 공식 docs 기준으로 담은 상세 카탈로그. 위 표가 endpoint enumeration index 라면, 아래는 field-level 본문이다. 출처: Cafe24 REST API Documentation (admin), 2026-06-03 download.

- [`translation/translations-categories.md`](./translation/translations-categories.md) · Translations categories — 3 fields, 2 ops
- [`translation/translations-products.md`](./translation/translations-products.md) · Translations products — 4 fields, 2 ops
- [`translation/translations-store.md`](./translation/translations-store.md) · Translations store — 2 fields, 2 ops
- [`translation/translations-themes.md`](./translation/translations-themes.md) · Translations themes — 4 fields, 3 ops
