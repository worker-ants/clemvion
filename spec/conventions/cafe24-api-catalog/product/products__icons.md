---
resource: product
entity: products__icons
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products--icons
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Product / Products icons

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products icons](https://developers.cafe24.com/docs/ko/api/admin/#products--icons)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품 아이콘은 상품을 강조하기 위해 상품 옆에 추가할 수 있는 작은 이미지들입니다. 진열된 상품에 할인 정보, "매진 임박" 등의 메시지를 추가하여 상품을 강조할 수 있습니다. · 상품 아이콘는 하위 리소스로서 상품(Products) 하위에서만 사용할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `use_show_date` |  | 표시기간 사용 여부 T : 사용함 · F : 사용안함 |
| `show_start_date` |  | 표시기간 시작 일자 |
| `show_end_date` |  | 표시기간 종료 일자 |
| `image_list` |  | 상품 아이콘 리스트 |
| `code` |  | 상품 아이콘 코드 |

## Operations

### `GET /api/v2/admin/products/{product_no}/icons` — Retrieve a list of product icons

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-icons

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `product_no` | ✓ |  |  | 상품번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `icons` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `use_show_date` |  | 표시기간 사용 여부 T : 사용함 · F : 사용안함 |
| ↳ `show_start_date` |  | 표시기간 시작 일자 |
| ↳ `show_end_date` |  | 표시기간 종료 일자 |
| ↳ `image_list` |  | 상품 아이콘 리스트 |
| ↳ ↳ `code` |  | 상품 아이콘 코드 |
| ↳ ↳ `path` |  |  |

응답 예시 (JSON):

```json
{
    "icons": {
        "shop_no": 1,
        "use_show_date": "T",
        "show_start_date": "2017-10-30T09:00:00+09:00",
        "show_end_date": "2017-11-02T16:00:00+09:00",
        "image_list": [
            {
                "code": "custom_1",
                "path": "https://{domain}/web/upload/custom_115855429954932.gif"
            },
            {
                "code": "custom_2",
                "path": "https://{domain}/web/upload/custom_215855430928360.gif"
            }
        ]
    }
}
```

### `POST /api/v2/admin/products/{product_no}/icons` — Set icons for a product

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#set-icons-for-a-product

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `product_no` | ✓ |  |  | 상품번호 |
| `image_list` | ✓ | 배열 최대사이즈: [5] |  | 상품 아이콘 리스트 |
| ↳ `code` | ✓ |  |  | 상품 아이콘 코드 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `icon` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `use_show_date` |  | 표시기간 사용 여부 T : 사용함 · F : 사용안함 |
| ↳ `show_start_date` |  | 표시기간 시작 일자 |
| ↳ `show_end_date` |  | 표시기간 종료 일자 |
| ↳ `image_list` |  | 상품 아이콘 리스트 |
| ↳ ↳ `code` |  | 상품 아이콘 코드 |
| ↳ ↳ `path` |  |  |

응답 예시 (JSON):

```json
{
    "icon": {
        "shop_no": 1,
        "use_show_date": "T",
        "show_start_date": "2017-10-30T09:00:00+09:00",
        "show_end_date": "2017-11-02T16:00:00+09:00",
        "image_list": [
            {
                "code": "custom_1",
                "path": "https://{domain}/web/upload/custom_115855429954932.gif"
            },
            {
                "code": "custom_2",
                "path": "https://{domain}/web/upload/custom_215855430928360.gif"
            }
        ]
    }
}
```

### `PUT /api/v2/admin/products/{product_no}/icons` — Update product icons

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-product-icons

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `product_no` | ✓ |  |  | 상품번호 |
| `use_show_date` |  |  |  | 표시기간 사용 여부 T : 사용함 · F : 사용안함 |
| `show_start_date` |  | 날짜 |  | 표시기간 시작 일자 |
| `show_end_date` |  | 날짜 |  | 표시기간 종료 일자 |
| `image_list` |  | 배열 최대사이즈: [5] |  | 상품 아이콘 리스트 |
| ↳ `code` | ✓ |  |  | 상품 아이콘 코드 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `icon` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `use_show_date` |  | 표시기간 사용 여부 T : 사용함 · F : 사용안함 |
| ↳ `show_start_date` |  | 표시기간 시작 일자 |
| ↳ `show_end_date` |  | 표시기간 종료 일자 |
| ↳ `image_list` |  | 상품 아이콘 리스트 |
| ↳ ↳ `code` |  | 상품 아이콘 코드 |
| ↳ ↳ `path` |  |  |

응답 예시 (JSON):

```json
{
    "icon": {
        "shop_no": 1,
        "use_show_date": "T",
        "show_start_date": "2017-10-30T09:00:00+09:00",
        "show_end_date": "2017-11-02T16:00:00+09:00",
        "image_list": [
            {
                "code": "custom_1",
                "path": "https://{domain}/web/upload/custom_115855429954932.gif"
            },
            {
                "code": "custom_2",
                "path": "https://{domain}/web/upload/custom_215855430928360.gif"
            }
        ]
    }
}
```

### `DELETE /api/v2/admin/products/{product_no}/icons/{code}` — Remove a product icon

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#remove-a-product-icon

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `product_no` | ✓ |  |  | 상품번호 |
| `code` | ✓ |  |  | 상품 아이콘 코드 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `icon` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `code` |  | 상품 아이콘 코드 |

응답 예시 (JSON):

```json
{
    "icon": {
        "shop_no": 1,
        "code": "custom_1"
    }
}
```
