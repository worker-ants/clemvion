---
resource: product
entity: products__additionalimages
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products--additionalimages
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Product / Products additionalimages

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products additionalimages](https://developers.cafe24.com/docs/ko/api/admin/#products--additionalimages)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품 추가 이미지(Products additionalimages)는 상품의 추가이미지를 나타내는 하위 리소스로, 상품(Products)리소스의 하위에서만 사용할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `additional_image` |  | 추가이미지 |
| `product_no` |  | 상품번호 |

## Operations

### `POST /api/v2/admin/products/{product_no}/additionalimages` — Create an additional product image

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-an-additional-product-image

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `product_no` | ✓ |  |  | 상품번호 |
| `additional_image` | ✓ |  |  | 추가이미지 ● 최대요청건수 : 20개 · ● 이미지 파일 용량 제한 : 5MB · ● 한 호출당 이미지 전체 용량 제한 : 30MB |

### `PUT /api/v2/admin/products/{product_no}/additionalimages` — Update an additional product image

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-an-additional-product-image

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `product_no` | ✓ |  |  | 상품번호 |
| `additional_image` | ✓ |  |  | 추가이미지 ● 최대요청건수 : 20개 · ● 이미지 파일 용량 제한 : 5MB · ● 한 호출당 이미지 전체 용량 제한 : 30MB |

### `DELETE /api/v2/admin/products/{product_no}/additionalimages` — Delete an additional product image

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-an-additional-product-image

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `product_no` | ✓ |  |  | 상품번호 |
