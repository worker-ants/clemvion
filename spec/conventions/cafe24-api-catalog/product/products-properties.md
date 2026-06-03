---
resource: product
entity: products-properties
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products-properties
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Product / Products properties

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products properties](https://developers.cafe24.com/docs/ko/api/admin/#products-properties)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품 상세 화면에 표시되는 항목을 조회하고 수정할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 |
| `properties` |  | 항목 속성 |
| `property` |  | 항목 속성 |

## Operations

### `GET /api/v2/admin/products/properties` — Retrieve fields for product details

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-fields-for-product-details

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

### `POST /api/v2/admin/products/properties` — Create a field for product details page

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-field-for-product-details-page

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `property` |  |  |  | 항목 속성 |
| ↳ `multishop_display_names` |  | Array |  |  |
| ↳ ↳ `shop_no` | ✓ |  |  | 멀티쇼핑몰 번호 |
| ↳ ↳ `name` | ✓ |  |  | 항목명 표시텍스트 |
| ↳ `display` |  |  |  | 항목 표시여부 · DEFAULT F |
| ↳ `display_name` |  |  |  | 항목명 표시설정 · T : 사용함 · F : 사용안함 · DEFAULT T |
| ↳ `font_type` |  |  |  | 글자 타입 · N : 보통(Normal) · B : 굵게(Bold) · I : 기울임(Italic) · D : 굵게 기울임(Bold Italic) · DEFAULT N |
| ↳ `font_size` |  |  |  | 글자 크기 · DEFAULT 12 |
| ↳ `font_color` |  |  |  | 글자 색상 · DEFAULT #555555 |
| ↳ `exposure_group_type` |  |  |  | 표시 대상 타입 · A: 전체 · M: 회원 · DEFAULT A |

### `PUT /api/v2/admin/products/properties` — Update fields for product details

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-fields-for-product-details

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `properties` |  |  |  | 항목 속성 |
| ↳ `key` | ✓ |  |  | 항목코드 |
| ↳ `name` |  |  |  | 항목명 표시텍스트 |
| ↳ `display` |  |  |  | 항목 표시여부 |
| ↳ `font_type` |  |  |  | 글자 타입 · N : 보통(Normal) · B : 굵게(Bold) · I : 기울임(Italic) · D : 굵게 기울임(Bold Italic) |
| ↳ `font_size` |  |  |  | 글자 크기 |
| ↳ `font_color` |  |  |  | 글자 색상 |
