---
resource: store
entity: images-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#images-setting
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
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

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `image` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `product_image_size` |  | 상품 이미지 사이즈 설정값 |
| ↳ ↳ `detail_image_width` |  |  |
| ↳ ↳ `detail_image_height` |  |  |
| ↳ ↳ `list_image_width` |  |  |
| ↳ ↳ `list_image_height` |  |  |
| ↳ ↳ `tiny_image_width` |  |  |
| ↳ ↳ `tiny_image_height` |  |  |
| ↳ ↳ `zoom_image_width` |  |  |
| ↳ ↳ `zoom_image_height` |  |  |
| ↳ ↳ `small_image_width` |  |  |
| ↳ ↳ `small_image_height` |  |  |

응답 예시 (JSON):

```json
{
    "image": {
        "shop_no": 1,
        "product_image_size": {
            "detail_image_width": 500,
            "detail_image_height": 500,
            "list_image_width": 300,
            "list_image_height": 300,
            "tiny_image_width": 220,
            "tiny_image_height": 220,
            "zoom_image_width": 500,
            "zoom_image_height": 500,
            "small_image_width": 100,
            "small_image_height": 100
        }
    }
}
```

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

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `image` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `product_image_size` |  | 상품 이미지 사이즈 설정값 |
| ↳ ↳ `detail_image_width` |  |  |
| ↳ ↳ `detail_image_height` |  |  |
| ↳ ↳ `list_image_width` |  |  |
| ↳ ↳ `list_image_height` |  |  |
| ↳ ↳ `tiny_image_width` |  |  |
| ↳ ↳ `tiny_image_height` |  |  |
| ↳ ↳ `zoom_image_width` |  |  |
| ↳ ↳ `zoom_image_height` |  |  |
| ↳ ↳ `small_image_width` |  |  |
| ↳ ↳ `small_image_height` |  |  |

응답 예시 (JSON):

```json
{
    "image": {
        "shop_no": 1,
        "product_image_size": {
            "detail_image_width": 500,
            "detail_image_height": 500,
            "list_image_width": 300,
            "list_image_height": 300,
            "tiny_image_width": 220,
            "tiny_image_height": 220,
            "zoom_image_width": 500,
            "zoom_image_height": 500,
            "small_image_width": 100,
            "small_image_height": 100
        }
    }
}
```
