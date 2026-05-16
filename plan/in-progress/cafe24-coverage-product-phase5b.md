---
worktree: cafe24-coverage-product-3c8e1a
started: 2026-05-16
owner: developer
---

# Plan: Cafe24 Coverage 확장 — Product resource Phase 5b

Phase 5a (Order) 의 후속. Product resource 의 자동화 운영에 자주 필요한 7 endpoint 를 supported 로 승격.

## 범위

| id | label | method | path | scope |
|---|---|---|---|---|
| `product_count` | 상품 개수 조회 | GET | `products/count` | read |
| `product_options_list` | 상품 옵션 목록 조회 | GET | `products/{product_no}/options` | read (paginated) |
| `product_options_create` | 상품 옵션 생성 | POST | `products/{product_no}/options` | write |
| `product_options_update` | 상품 옵션 수정 | PUT | `products/{product_no}/options` | write |
| `product_options_delete` | 상품 옵션 삭제 | DELETE | `products/{product_no}/options/{option_no}` | write |
| `product_seo_get` | 상품 SEO 설정 조회 | GET | `products/{product_no}/seo` | read |
| `product_seo_update` | 상품 SEO 설정 수정 | PUT | `products/{product_no}/seo` | write |

## 작업

- [x] `backend/.../metadata/product.ts`: 7 row 추가
- [x] `backend/.../metadata/planned.ts`: 7 id 제거
- [x] `spec/conventions/cafe24-api-catalog/product.md`: 7 row planned→supported
- [x] `_overview.md`: product 7→14, 합계 56→63, CHANGELOG
- [ ] backend jest 통과
- [ ] consistency-check Critical 0
- [ ] PR

## 결정 사항

- **`product_count` path**: Cafe24 docs page 가 count-specific URL 을 명시하지 않고 list endpoint(`products`) 의 파라미터로 표시했으나, 다른 `*_count` endpoint (order_count → `orders/count`) 와 일관되게 `products/count` 채택. fields 는 list 의 통상 filter (display, selling, category_no, product_name, since, until) 를 활용.
- **`product_options_create` requiredFields**: docs 명시대로 `product_no` + `option_name` + `option_type` + `option_values`.
- **`product_options_update` 의 body `option_no`**: docs 는 single integer 로 명시. spec 그대로 single number.
- **`product_seo_update` 의 body 필드**: 모두 optional (description / title / keyword / url_path / seo_title) — 사용자가 필요한 것만 보낸다.

## 후속

Phase 5c (Customer 메모 CRUD), 5d (Promotion 쿠폰 보완), 5e (Salesreport 전체), 5f (Serialcoupons).
