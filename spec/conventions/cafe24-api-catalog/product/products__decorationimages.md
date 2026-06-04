---
resource: product
entity: products__decorationimages
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products--decorationimages
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Product / Products decorationimages

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products decorationimages](https://developers.cafe24.com/docs/ko/api/admin/#products--decorationimages)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

꾸미기 이미지(Decorationimages)는 쇼핑몰에 진열된 상품 이미지 위에 추가하여 상품에 포인트를 줄 수 있는 기능입니다. · 쇼핑몰에 등록되어있는 꾸미기 이미지를 조회하여 상품별로 꾸미기 이미지를 지정하거나, 상품에 등록되어있는 꾸미기 이미지를 조회할 수 있습니다. · 꾸미기 이미지는 하위 리소스로서 상품(Products) 하위에서만 사용할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `use_show_date` |  | 표시기간 사용 여부 T : 사용함 · F : 사용안함 |
| `show_start_date` |  | 표시기간 시작 일자 |
| `show_end_date` |  | 표시기간 종료 일자 |
| `image_list` |  | 꾸미기 이미지 리스트 수평위치(image_horizontal_position) · L : 왼쪽 · C : 가운데 · R : 오른쪽 · 수직위치(image_vertical_position) · T : 상단 · C : 중단 · B : 하단 |
| `code` |  | 꾸미기 이미지 코드 |

## Operations

### `GET /api/v2/admin/products/{product_no}/decorationimages` — Retrieve a list of product decoration images

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-decoration-images

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `product_no` | ✓ |  |  | 상품번호 상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음. |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `decorationimage` |  | (응답 객체) |
| ↳ `use_show_date` |  | 표시기간 사용 여부 T : 사용함 · F : 사용안함 |
| ↳ `show_start_date` |  | 표시기간 시작 일자 |
| ↳ `show_end_date` |  | 표시기간 종료 일자 |
| ↳ `image_list` |  | 꾸미기 이미지 리스트 수평위치(image_horizontal_position) · L : 왼쪽 · C : 가운데 · R : 오른쪽 · 수직위치(image_vertical_position) · T : 상단 · C : 중단 · B : 하단 |
| ↳ ↳ `code` |  | 꾸미기 이미지 코드 |
| ↳ ↳ `path` |  | 꾸미기 이미지 경로 |
| ↳ ↳ `image_vertical_position` |  | 꾸미기 이미지 수직값 |
| ↳ ↳ `image_horizontal_position` |  | 꾸미기 이미지 수평값 |

응답 예시 (JSON):

```json
{
    "decorationimage": {
        "use_show_date": "T",
        "show_start_date": "2017-10-30T09:00:00+09:00",
        "show_end_date": "2017-11-02T16:00:00+09:00",
        "image_list": [
            {
                "code": "image_custom_4",
                "path": "https://{domain}/web/upload/image_custom_415421761806290.gif",
                "image_vertical_position": "T",
                "image_horizontal_position": "L"
            },
            {
                "code": "image_custom_3",
                "path": "https://{domain}/web/upload/image_custom_615421761805558.gif",
                "image_vertical_position": "B",
                "image_horizontal_position": "C"
            }
        ]
    }
}
```

### `POST /api/v2/admin/products/{product_no}/decorationimages` — Set decoration images for a product

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#set-decoration-images-for-a-product

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` | ✓ |  |  | 상품번호 |
| `use_show_date` |  |  |  | 표시기간 사용 여부 T : 사용함 · F : 사용안함 |
| `show_start_date` |  | 날짜 |  | 표시기간 시작 일자 |
| `show_end_date` |  | 날짜 |  | 표시기간 종료 일자 |
| `image_list` | ✓ |  |  | 꾸미기 이미지 리스트 수평위치(image_horizontal_position) · L : 왼쪽 · C : 가운데 · R : 오른쪽 · 수직위치(image_vertical_position) · T : 상단 · C : 중단 · B : 하단 |
| ↳ `code` |  |  |  | 꾸미기 이미지 코드 |
| ↳ `path` |  |  |  | 꾸미기 이미지 경로 |
| ↳ `image_horizontal_position` |  |  |  | 꾸미기 이미지 수평값 |
| ↳ `image_vertical_position` |  |  |  | 꾸미기 이미지 수직값 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `decorationimage` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `use_show_date` |  | 표시기간 사용 여부 T : 사용함 · F : 사용안함 |
| ↳ `show_start_date` |  | 표시기간 시작 일자 |
| ↳ `show_end_date` |  | 표시기간 종료 일자 |
| ↳ `image_list` |  | 꾸미기 이미지 리스트 수평위치(image_horizontal_position) · L : 왼쪽 · C : 가운데 · R : 오른쪽 · 수직위치(image_vertical_position) · T : 상단 · C : 중단 · B : 하단 |
| ↳ ↳ `code` |  | 꾸미기 이미지 코드 |
| ↳ ↳ `path` |  | 꾸미기 이미지 경로 |
| ↳ ↳ `image_vertical_position` |  | 꾸미기 이미지 수직값 |
| ↳ ↳ `image_horizontal_position` |  | 꾸미기 이미지 수평값 |

응답 예시 (JSON):

```json
{
    "decorationimage": {
        "shop_no": 1,
        "use_show_date": "T",
        "show_start_date": "2017-10-30T09:00:00+09:00",
        "show_end_date": "2017-11-02T16:00:00+09:00",
        "image_list": [
            {
                "code": "image_custom_4",
                "path": "https://{domain}/web/upload/image_custom_415421761806290.gif",
                "image_vertical_position": "T",
                "image_horizontal_position": "L"
            },
            {
                "code": "image_custom_3",
                "path": "https://{domain}/web/upload/image_custom_615421761805558.gif",
                "image_vertical_position": "B",
                "image_horizontal_position": "C"
            }
        ]
    }
}
```

### `PUT /api/v2/admin/products/{product_no}/decorationimages` — Update product decoration images

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-product-decoration-images

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` | ✓ |  |  | 상품번호 상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음. |
| `use_show_date` |  |  |  | 표시기간 사용 여부 T : 사용함 · F : 사용안함 |
| `show_start_date` |  | 날짜 |  | 표시기간 시작 일자 |
| `show_end_date` |  | 날짜 |  | 표시기간 종료 일자 |
| `image_list` | ✓ |  |  | 꾸미기 이미지 리스트 수평위치(image_horizontal_position) · L : 왼쪽 · C : 가운데 · R : 오른쪽 · 수직위치(image_vertical_position) · T : 상단 · C : 중단 · B : 하단 |
| ↳ `code` |  |  |  | 꾸미기 이미지 코드 |
| ↳ `path` |  |  |  | 꾸미기 이미지 경로 |
| ↳ `image_horizontal_position` |  |  |  | 꾸미기 이미지 수평값 |
| ↳ `image_vertical_position` |  |  |  | 꾸미기 이미지 수직값 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `decorationimage` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `use_show_date` |  | 표시기간 사용 여부 T : 사용함 · F : 사용안함 |
| ↳ `show_start_date` |  | 표시기간 시작 일자 |
| ↳ `show_end_date` |  | 표시기간 종료 일자 |
| ↳ `image_list` |  | 꾸미기 이미지 리스트 수평위치(image_horizontal_position) · L : 왼쪽 · C : 가운데 · R : 오른쪽 · 수직위치(image_vertical_position) · T : 상단 · C : 중단 · B : 하단 |
| ↳ ↳ `code` |  | 꾸미기 이미지 코드 |
| ↳ ↳ `path` |  | 꾸미기 이미지 경로 |
| ↳ ↳ `image_vertical_position` |  | 꾸미기 이미지 수직값 |
| ↳ ↳ `image_horizontal_position` |  | 꾸미기 이미지 수평값 |

응답 예시 (JSON):

```json
{
    "decorationimage": {
        "shop_no": 1,
        "use_show_date": "T",
        "show_start_date": "2017-10-30T09:00:00+09:00",
        "show_end_date": "2017-11-02T16:00:00+09:00",
        "image_list": [
            {
                "code": "image_custom_4",
                "path": "https://{domain}/web/upload/image_custom_415421761806290.gif",
                "image_vertical_position": "T",
                "image_horizontal_position": "L"
            },
            {
                "code": "image_custom_3",
                "path": "https://{domain}/web/upload/image_custom_615421761805558.gif",
                "image_vertical_position": "B",
                "image_horizontal_position": "C"
            }
        ]
    }
}
```

### `DELETE /api/v2/admin/products/{product_no}/decorationimages/{code}` — Remove a product decoration image

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#remove-a-product-decoration-image

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `code` | ✓ |  |  | 꾸미기 이미지 코드 |
| `product_no` | ✓ |  |  | 상품번호 상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음. |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `decorationimage` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `code` |  | 꾸미기 이미지 코드 |

응답 예시 (JSON):

```json
{
    "decorationimage": {
        "shop_no": 1,
        "code": "icon_02_01"
    }
}
```
