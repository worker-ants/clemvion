---
resource: category
entity: categories__decorationimages
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#categories--decorationimages
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Category / Categories decorationimages

> Field-level 카탈로그. Endpoint enumeration index: [`../category.md`](../category.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Categories decorationimages](https://developers.cafe24.com/docs/ko/api/admin/#categories--decorationimages)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

카테고리 꾸미기 이미지(Categories decorationimages)는 특정 카테고리의 꾸미기 이미지에 관한 기능입니다. · 특정 카테고리에 설정된 꾸미기 이미지를 조회하거나 수정할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `category_no` |  | 분류 번호 |
| `use_menu_image_pc` |  | 분류 PC 메뉴 이미지 사용여부 T : 사용함 · F : 사용안함 |
| `menu_image_pc` |  | 분류 PC 메뉴 기본 이미지 |
| `menu_over_image_pc` |  | 분류 PC 메뉴 오버 이미지 |
| `use_top_image_pc` |  | 분류 PC 상단 이미지 사용여부 T : 사용함 · F : 사용안함 |
| `top_images_pc` |  | 분류 PC 상단 이미지 |
| `use_title_image_pc` |  | 분류 PC 타이틀 이미지 사용여부 T : 사용함 · F : 사용안함 |
| `title_image_pc` |  | 분류 PC 타이틀 이미지 |
| `use_menu_image_mobile` |  | 분류 모바일 메뉴 이미지 사용여부 T : 사용함 · F : 사용안함 |
| `menu_image_mobile` |  | 분류 모바일 메뉴 기본 이미지 |
| `use_top_image_mobile` |  | 분류 모바일 상단 이미지 사용여부 T : 사용함 · F : 사용안함 |
| `top_images_mobile` | 배열 최대사이즈: [3] | 분류 모바일 상단 이미지 |
| `use_title_image_mobile` |  | 분류 모바일 타이틀 이미지 사용여부 T : 사용함 · F : 사용안함 |
| `title_image_mobile` |  | 분류 모바일 타이틀 이미지 |

## Operations

### `GET /api/v2/admin/categories/{category_no}/decorationimages` — Retrieve decoration image settings by category

- **Scope**: `mall.read_category` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-decoration-image-settings-by-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `category_no` | ✓ |  |  | 분류 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `decorationimage` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `category_no` |  | 분류 번호 |
| ↳ `use_menu_image_pc` |  | 분류 PC 메뉴 이미지 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `menu_image_pc` |  | 분류 PC 메뉴 기본 이미지 |
| ↳ `menu_over_image_pc` |  | 분류 PC 메뉴 오버 이미지 |
| ↳ `use_top_image_pc` |  | 분류 PC 상단 이미지 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `top_images_pc` |  | 분류 PC 상단 이미지 |
| ↳ `use_title_image_pc` |  | 분류 PC 타이틀 이미지 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `title_image_pc` |  | 분류 PC 타이틀 이미지 |
| ↳ `use_menu_image_mobile` |  | 분류 모바일 메뉴 이미지 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `menu_image_mobile` |  | 분류 모바일 메뉴 기본 이미지 |
| ↳ `use_top_image_mobile` |  | 분류 모바일 상단 이미지 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `top_images_mobile` | 배열 최대사이즈: [3] | 분류 모바일 상단 이미지 |
| ↳ `use_title_image_mobile` |  | 분류 모바일 타이틀 이미지 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `title_image_mobile` |  | 분류 모바일 타이틀 이미지 |

응답 예시 (JSON):

```json
{
    "decorationimage": {
        "shop_no": 1,
        "category_no": 24,
        "use_menu_image_pc": "T",
        "menu_image_pc": "https://{domain}/web/upload/category/738e283772bedd59cd658f8bfe20ff89.png",
        "menu_over_image_pc": "https://{domain}/web/upload/category/80fe9c1862ca96d40455de20e9e4c167.png",
        "use_top_image_pc": "T",
        "top_images_pc": [
            "https://{domain}/web/upload/category/374757e4828de2946ce112fb6082464f.png",
            "https://{domain}/web/upload/category/2b818101423db9eee825048c2decc5f0.png"
        ],
        "use_title_image_pc": "T",
        "title_image_pc": "https://{domain}/web/upload/category/d6a4cfa8d5d15e14bc03e42d95faaa56.png",
        "use_menu_image_mobile": "F",
        "menu_image_mobile": null,
        "use_top_image_mobile": "F",
        "top_images_mobile": null,
        "use_title_image_mobile": "F",
        "title_image_mobile": null
    }
}
```

### `PUT /api/v2/admin/categories/{category_no}/decorationimages` — Update decoration images of a product category

- **Scope**: `mall.write_category` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-decoration-images-of-a-product-category

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `category_no` | ✓ |  |  | 분류 번호 |
| `use_menu_image_pc` |  |  |  | 분류 PC 메뉴 이미지 사용여부 T : 사용함 · F : 사용안함 |
| `menu_image_pc` |  |  |  | 분류 PC 메뉴 기본 이미지 |
| `menu_over_image_pc` |  |  |  | 분류 PC 메뉴 오버 이미지 |
| `use_top_image_pc` |  |  |  | 분류 PC 상단 이미지 사용여부 T : 사용함 · F : 사용안함 |
| `top_images_pc` |  | 배열 최대사이즈: [3] |  | 분류 PC 상단 이미지 |
| `use_title_image_pc` |  |  |  | 분류 PC 타이틀 이미지 사용여부 T : 사용함 · F : 사용안함 |
| `title_image_pc` |  |  |  | 분류 PC 타이틀 이미지 |
| `use_menu_image_mobile` |  |  |  | 분류 모바일 메뉴 이미지 사용여부 T : 사용함 · F : 사용안함 |
| `menu_image_mobile` |  |  |  | 분류 모바일 메뉴 기본 이미지 |
| `use_top_image_mobile` |  |  |  | 분류 모바일 상단 이미지 사용여부 T : 사용함 · F : 사용안함 |
| `top_images_mobile` |  | 배열 최대사이즈: [3] |  | 분류 모바일 상단 이미지 |
| `use_title_image_mobile` |  |  |  | 분류 모바일 타이틀 이미지 사용여부 T : 사용함 · F : 사용안함 |
| `title_image_mobile` |  |  |  | 분류 모바일 타이틀 이미지 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `decorationimage` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `category_no` |  | 분류 번호 |
| ↳ `use_menu_image_pc` |  | 분류 PC 메뉴 이미지 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `menu_image_pc` |  | 분류 PC 메뉴 기본 이미지 |
| ↳ `menu_over_image_pc` |  | 분류 PC 메뉴 오버 이미지 |
| ↳ `use_top_image_pc` |  | 분류 PC 상단 이미지 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `top_images_pc` |  | 분류 PC 상단 이미지 |
| ↳ `use_title_image_pc` |  | 분류 PC 타이틀 이미지 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `title_image_pc` |  | 분류 PC 타이틀 이미지 |
| ↳ `use_menu_image_mobile` |  | 분류 모바일 메뉴 이미지 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `menu_image_mobile` |  | 분류 모바일 메뉴 기본 이미지 |
| ↳ `use_top_image_mobile` |  | 분류 모바일 상단 이미지 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `top_images_mobile` | 배열 최대사이즈: [3] | 분류 모바일 상단 이미지 |
| ↳ `use_title_image_mobile` |  | 분류 모바일 타이틀 이미지 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `title_image_mobile` |  | 분류 모바일 타이틀 이미지 |

응답 예시 (JSON):

```json
{
    "decorationimage": {
        "shop_no": 1,
        "category_no": 24,
        "use_menu_image_pc": "T",
        "menu_image_pc": "https://{domain}/web/upload/category/738e283772bedd59cd658f8bfe20ff89.png",
        "menu_over_image_pc": "https://{domain}/web/upload/category/80fe9c1862ca96d40455de20e9e4c167.png",
        "use_top_image_pc": "T",
        "top_images_pc": [
            "https://{domain}/web/upload/category/374757e4828de2946ce112fb6082464f.png",
            "https://{domain}/web/upload/category/2b818101423db9eee825048c2decc5f0.png"
        ],
        "use_title_image_pc": "T",
        "title_image_pc": "https://{domain}/web/upload/category/d6a4cfa8d5d15e14bc03e42d95faaa56.png",
        "use_menu_image_mobile": "F",
        "menu_image_mobile": null,
        "use_top_image_mobile": "F",
        "top_images_mobile": null,
        "use_title_image_mobile": "F",
        "title_image_mobile": null
    }
}
```
