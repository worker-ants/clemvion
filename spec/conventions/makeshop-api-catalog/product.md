---
id: makeshop-product
status: spec-only
code: []
pending_plans:
  - plan/in-progress/makeshop-integration.md
---

# Makeshop API Catalog — 상품 (Product)

> 상위: [`_overview.md`](./_overview.md) · 전체 스키마(요청/응답 필드): [`openapi/product.openapi.json`](./openapi/product.openapi.json)

공통 prefix `/api/v1/{shopId}/` 는 `path` 컬럼에서 생략. 인증 `bearerAuth`. 본 표는 메이크샵 공식 문서에서 자동 추출했으며, Phase 0 에서 backend 메타데이터(`MAKESHOP_OPERATIONS_BY_RESOURCE`)와 `catalog-sync` 양방향 테스트로 동기 보호된다. `scope`/`paginated`/`status` 컬럼은 메타데이터와 1:1 일치한다.

## REST endpoints (37)

| id | 라벨 (한) | method | path | scope | paginated | status | docs |
|----|-----------|--------|------|-------|-----------|--------|------|
| `get-brand` | 브랜드/제조사 조회 | GET | `brand` | read |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/get-brand) |
| `get-brand_product` | 브랜드별 상품 조회 | GET | `brand_product` | read |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/get-brand-product) |
| `get-cart_free` | 카트프리 통계 조회 | GET | `cart_free` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/get-cart-free) |
| `get-category` | 카테고리 조회 | GET | `category` | read |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/get-category) |
| `get-category_display_products` | 분류별 진열 상품 조회 | GET | `category_display_products` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/get-category-display-products) |
| `get-delete_product` | 삭제 상품 조회 | GET | `delete_product` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/get-delete-product) |
| `get-discount` | 상품 기간 할인 조회 | GET | `discount` | read |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/get-discount) |
| `get-icon` | 상품 아이콘 조회 | GET | `icon` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/get-icon) |
| `get-main_display` | 메인 노출 상품 조회 | GET | `main_display` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/get-main-display) |
| `get-plan` | 기획전 상품 조회 | GET | `plan` | read |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/get-plan) |
| `get-product` | 상품 조회 | GET | `product` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/get-product) |
| `get-product_notice` | 상품 일반 공시 정보 조회 | GET | `product_notice` | read |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/get-product-notice) |
| `get-product_seo` | 상품 SEO 조회 | GET | `product_seo` | read |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/get-product-seo) |
| `get-product_size_chart` | 사이즈 차트 항목 조회 | GET | `product_size_chart` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/get-product-size-chart) |
| `get-provider` | 공급자 조회 | GET | `provider` | read |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/get-provider) |
| `get-provider_settlement` | 공급자 정산 조회 | GET | `provider_settlement` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/get-provider-settlement) |
| `get-stock` | 상품 재고 조회 | GET | `stock` | read |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/get-stock) |
| `get-subs_product` | 정기배송 상품 조회 | GET | `subs_product` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/get-subs-product) |
| `get-wishlist` | 관심 상품 조회 | GET | `wishlist` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/get-wishlist) |
| `post-brand-create` | 브랜드/제조사 등록 | POST | `brand/create` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/post-brand-create) |
| `post-brand-delete` | 브랜드/제조사 삭제 | POST | `brand/delete` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/post-brand-delete) |
| `post-brand-update` | 브랜드/제조사 수정 | POST | `brand/update` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/post-brand-update) |
| `post-category-create` | 상품 분류 생성 | POST | `category/create` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/post-category-create) |
| `post-plan-create` | 기획전 등록 | POST | `plan/create` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/post-plan-create) |
| `post-plan-delete` | 기획전 삭제 | POST | `plan/delete` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/post-plan-delete) |
| `post-plan-update` | 기획전 수정 | POST | `plan/update` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/post-plan-update) |
| `post-product-create` | 상품 등록 | POST | `product/create` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/post-product-create) |
| `post-product-delete` | 상품 완전 삭제 | POST | `product/delete` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/post-product-delete) |
| `post-product-delete_temp` | 상품 삭제 | POST | `product/delete_temp` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/post-product-delete-temp) |
| `post-product-stock` | 상품 재고 변경 | POST | `product/stock` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/post-product-stock) |
| `post-product-update` | 상품 수정 | POST | `product/update` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/post-product-update) |
| `post-product_display` | 상품 진열 변경 | POST | `product_display` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/post-product-display) |
| `post-product_seo-create` | 상품 SEO 등록 | POST | `product_seo/create` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/post-product-seo-create) |
| `post-product_seo-update` | 상품 SEO 수정 | POST | `product_seo/update` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/post-product-seo-update) |
| `post-provider-create` | 공급자 등록 | POST | `provider/create` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/post-provider-create) |
| `post-provider-delete` | 공급자 삭제 | POST | `provider/delete` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/post-provider-delete) |
| `post-provider-update` | 공급자 수정 | POST | `provider/update` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/product/post-provider-update) |
