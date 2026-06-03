---
resource: store
entity: products-display-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products-display-setting
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Store / Products display setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products display setting](https://developers.cafe24.com/docs/ko/api/admin/#products-display-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품 화면 설정(Products display setting)은 상품 목록 화면에서 상품 정보의 노출 방식을 설정하는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `sorting_options` |  | 상품정렬조건 new_product : 신상품 · product_name : 상품명 · low_price : 낮은가격 · high_price : 높은가격 · manufacture : 제조사 · popular_product : 인기상품 · review : 사용후기 · hit_count : 조회수 · like_count : 좋아요 |

## Operations

### `GET /api/v2/admin/products/display/setting` — List all products display setting

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#list-all-products-display-setting

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

### `PUT /api/v2/admin/products/display/setting` — Update a products display setting

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-products-display-setting

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `sorting_options` | ✓ |  |  | 상품정렬조건 new_product : 신상품 · product_name : 상품명 · low_price : 낮은가격 · high_price : 높은가격 · manufacture : 제조사 · popular_product : 인기상품 · review : 사용후기 · hit_count : 조회수 · like_count : 좋아요 |
