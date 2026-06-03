---
resource: store
entity: images-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#images-setting
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Store / Images setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Images setting](https://developers.cafe24.com/docs/ko/api/admin/#images-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품 이미지 사이즈 설정 값을 조회하거나 수정할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `product_image_size` |  | 상품 이미지 사이즈 설정값 |

## Operations

### `GET /api/v2/admin/images/setting` — Retrieve product image size settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-product-image-size-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

### `PUT /api/v2/admin/images/setting` — Update product image size settings

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-product-image-size-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `product_image_size` | ✓ |  |  | 상품 이미지 사이즈 설정값 |
| ↳ `detail_image_width` |  |  |  | 상세 이미지 가로 |
| ↳ `detail_image_height` |  |  |  | 상세이미지 세로 |
| ↳ `list_image_width` |  |  |  | 목록 이미지 가로 |
| ↳ `list_image_height` |  |  |  | 목록 이미지 세로 |
| ↳ `tiny_image_width` |  |  |  | 작은 목록 이미지 가로 |
| ↳ `tiny_image_height` |  |  |  | 작은 목록 이미지 세로 |
| ↳ `zoom_image_width` |  |  |  | 확대 이미지 가로 |
| ↳ `zoom_image_height` |  |  |  | 확대 이미지 세로 |
| ↳ `small_image_width` |  |  |  | 축소 이미지 가로 |
| ↳ `small_image_height` |  |  |  | 축소 이미지 세로 |
