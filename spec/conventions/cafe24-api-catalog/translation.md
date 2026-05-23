---
id: translation
status: spec-only
code: []
---

# Cafe24 API Catalog — Translation (번역)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `translation_products_list` | 상품 번역 목록 조회 | Retrieve a list of product translations | GET | `translation/products` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-translations) |
| `translation_products_update` | 상품 번역 수정 | Update product translation | PUT | `translation/products/{product_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-product-translation) |
| `translation_categories_list` | 카테고리 번역 목록 조회 | Retrieve a list of product category translations | GET | `translation/categories` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-category-translations) |
| `translation_categories_update` | 카테고리 번역 수정 | Update product category translation | PUT | `translation/categories/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-product-category-translation) |
| `translation_store_list` | 상점 번역 목록 조회 | Retrieve a list of store translations | GET | `translation/store` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-store-translations) |
| `translation_store_update` | 상점 번역 수정 | Update the translations of a store | PUT | `translation/store` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-the-translations-of-a-store) |
| `translation_themes_list` | 테마 번역 목록 조회 | Retrieve a list of theme translations | GET | `translation/themes` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-theme-translations) |
| `translation_themes_get` | 테마 번역 단건 조회 | Retrieve a theme translation | GET | `translation/themes/{theme_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-theme-translation) |
| `translation_themes_update` | 테마 번역 수정 | Update a theme translation | PUT | `translation/themes/{theme_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-theme-translation) |
