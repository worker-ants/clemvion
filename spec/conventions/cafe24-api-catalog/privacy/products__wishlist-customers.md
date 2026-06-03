---
resource: privacy
entity: products__wishlist-customers
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products--wishlist-customers
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Privacy / Products wishlist customers

> Field-level 카탈로그. Endpoint enumeration index: [`../privacy.md`](../privacy.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products wishlist customers](https://developers.cafe24.com/docs/ko/api/admin/#products--wishlist-customers)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품을 관심상품으로 담은 회원(Products wishlist customers)은 상품을 관심상품으로 담은 회원을 조회할 수 있는 리소스입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `member_id` |  | 회원아이디 |

## Operations

### `GET /api/v2/admin/products/{product_no}/wishlist/customers` — Retrieve a list of customers with a product in wishlist

- **Scope**: `mall.read_privacy` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers-with-a-product-in-wishlist

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `product_no` | ✓ |  |  | 상품번호 상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음. |
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |

### `GET /api/v2/admin/products/{product_no}/wishlist/customers/count` — Retrieve a count of customers with a product in wishlist

- **Scope**: `mall.read_privacy` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customers-with-a-product-in-wishlist

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `product_no` | ✓ |  |  | 상품번호 |
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
