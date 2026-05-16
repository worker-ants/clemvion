# Cafe24 API Catalog — Product (상품)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `product_list` | 상품 목록 조회 | Retrieve a list of products | GET | `products` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-products) |
| `product_get` | 상품 단건 조회 | Retrieve a product resource | GET | `products/{product_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-resource) |
| `product_create` | 상품 생성 | Create a product | POST | `products` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-product) |
| `product_update` | 상품 수정 | Update a product | PUT | `products/{product_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product) |
| `product_delete` | 상품 삭제 | Delete a product | DELETE | `products/{product_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product) |
| `product_variants_list` | 상품 품목(옵션) 목록 조회 | Retrieve a list of product variants | GET | `products/{product_no}/variants` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-variants) |
| `product_variants_inventory_update` | 상품 품목 재고 수정 | Update a product variant inventory | PUT | `products/{product_no}/variants/{variant_code}/inventories` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-variant-inventory) |
| `product_count` | 상품 개수 조회 | Retrieve a count of products | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-products) |
| `product_variants_get` | 상품 품목 단건 조회 | Retrieve a product variant | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-variant) |
| `product_variants_update` | 상품 품목 수정 | Update a product variant | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-variant) |
| `product_variants_update_multiple` | 상품 품목 일괄 수정 | Update multiple product variants | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-multiple-product-variants) |
| `product_variants_delete` | 상품 품목 삭제 | Delete a product variant | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product-variant) |
| `product_variants_inventory_get` | 상품 품목 재고 조회 | Retrieve inventory details of a product variant | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-inventory-details-of-a-product-variant) |
| `product_options_list` | 상품 옵션 목록 조회 | Retrieve a list of product options | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-options) |
| `product_options_create` | 상품 옵션 생성 | Create product options | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-product-options) |
| `product_options_update` | 상품 옵션 수정 | Update product options | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-product-options) |
| `product_options_delete` | 상품 옵션 삭제 | Delete a product option | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product-option) |
| `product_additionalimages_create` | 추가 이미지 등록 | Create an additional product image | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-additional-product-image) |
| `product_additionalimages_update` | 추가 이미지 수정 | Update an additional product image | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-additional-product-image) |
| `product_additionalimages_delete` | 추가 이미지 삭제 | Delete an additional product image | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-additional-product-image) |
| `product_images_upload` | 상품 이미지 업로드 | Upload product images | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#upload-product-images) |
| `product_images_delete` | 상품 이미지 삭제 | Delete product images | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-product-images) |
| `product_approve_get` | 상품 승인 상태 조회 | Retrieve a product approval status | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-approval-status) |
| `product_approve_create` | 상품 승인 요청 | Create a product approval request | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-product-approval-request) |
| `product_approve_update` | 상품 승인 상태 변경 | Update a product approval status | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-approval-status) |
| `product_customproperties_get` | 상품 사용자 정의 속성 조회 | Retrieve user defined properties by product | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-user-defined-properties-by-product) |
| `product_customproperties_update` | 상품 사용자 정의 속성 수정 | Update user defined properties by product | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-user-defined-properties-by-product) |
| `product_customproperties_delete` | 상품 사용자 정의 속성 삭제 | Delete user defined properties by product | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-user-defined-properties-by-product) |
| `product_decorationimages_list` | 상품 꾸미기 이미지 목록 | Retrieve a list of product decoration images | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-decoration-images) |
| `product_decorationimages_set` | 상품 꾸미기 이미지 설정 | Set decoration images for a product | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#set-decoration-images-for-a-product) |
| `product_decorationimages_update` | 상품 꾸미기 이미지 수정 | Update product decoration images | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-product-decoration-images) |
| `product_decorationimages_delete` | 상품 꾸미기 이미지 삭제 | Remove a product decoration image | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#remove-a-product-decoration-image) |
| `product_discountprice_get` | 상품 할인가 조회 | Retrieve a product discounted price | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-discounted-price) |
| `product_hits_count` | 상품 조회수 카운트 | Retrieve a count of product views | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-product-views) |
| `product_icons_list` | 상품 아이콘 목록 | Retrieve a list of product icons | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-icons) |
| `product_icons_set` | 상품 아이콘 설정 | Set icons for a product | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#set-icons-for-a-product) |
| `product_icons_update` | 상품 아이콘 수정 | Update product icons | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-product-icons) |
| `product_icons_delete` | 상품 아이콘 삭제 | Remove a product icon | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#remove-a-product-icon) |
| `product_memos_list` | 상품 메모 목록 | Retrieve a list of product memos | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-memos) |
| `product_memos_get` | 상품 메모 단건 조회 | Retrieve a product memo | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-memo) |
| `product_memos_create` | 상품 메모 생성 | Create a product memo | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-product-memo) |
| `product_memos_update` | 상품 메모 수정 | Update a product memo | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-memo) |
| `product_memos_delete` | 상품 메모 삭제 | Delete a product memo | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product-memo) |
| `product_seo_get` | 상품 SEO 조회 | Retrieve a product's SEO settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-s-seo-settings) |
| `product_seo_update` | 상품 SEO 수정 | Update product SEO settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-product-seo-settings) |
| `product_tags_list` | 상품 태그 목록 | Retrieve a list of a product's product tags | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-a-product-s-product-tags) |
| `product_tags_count` | 상품 태그 개수 | Retrieve a count of a product's product tags | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-a-product-s-product-tags) |
| `product_tags_create` | 상품 태그 생성 | Create product tags | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-product-tags) |
| `product_tags_delete` | 상품 태그 삭제 | Delete a product tag | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product-tag) |
| `bundleproducts_list` | 묶음 상품 목록 | Retrieve a list of bundles | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-bundles) |
| `bundleproducts_get` | 묶음 상품 단건 조회 | Retrieve a bundle | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-bundle) |
| `bundleproducts_create` | 묶음 상품 생성 | Create a bundle | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-bundle) |
| `bundleproducts_update` | 묶음 상품 수정 | Update a bundle | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-bundle) |
| `bundleproducts_delete` | 묶음 상품 삭제 | Delete a bundle | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-bundle) |
| `categories_products_count` | 카테고리 내 상품 개수 | Retrieve a count of products by category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-products-by-category) |
| `categories_products_add` | 카테고리에 상품 추가 | Add products to a category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#add-products-to-a-category) |
| `categories_products_update` | 카테고리 상품 수정 | Update a product in product category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-in-product-category) |
| `categories_products_delete` | 카테고리 상품 삭제 | Delete a product by category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product-by-category) |
| `mains_products_list` | 메인 카테고리 상품 목록 | Retrieve a list of products in main category | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-products-in-main-category) |
| `mains_products_count` | 메인 카테고리 상품 개수 | Retrieve a count of products in main category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-products-in-main-category) |
| `mains_products_set` | 메인 카테고리 상품 설정 | Set main category products | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#set-main-category-products) |
| `mains_products_update_sorting` | 메인 카테고리 상품 정렬 수정 | Update fixed sorting of products in main category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-fixed-sorting-of-products-in-main-category) |
| `mains_products_delete` | 메인 카테고리 상품 삭제 | Delete a product in main category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product-in-main-category) |
