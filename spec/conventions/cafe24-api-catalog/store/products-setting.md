---
resource: store
entity: products-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products-setting
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Products setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products setting](https://developers.cafe24.com/docs/ko/api/admin/#products-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품의 설정(Products setting)은 상품의 판매가 등의 설정값에 대한 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `display_price_scope` |  | 회원/비회원 가격표시 A : 모두 표시함 (회원+비회원) · C : 회원만 표시함 |
| `calculate_price_based_on` |  | 판매가 계산 기준 S : 공급가 대비 마진율 · A : 판매가 대비 마진율 · P : 기본몰 판매가 · B : 상품가 |
| `price_rounding_unit` |  | 판매가 계산 절사 단위 F : 절사안함 · -2 : 0.01단위 · -1 : 0.1단위 · 0 : 1단위 · 1 : 10단위 · 2 : 100단위 · 3 : 1000단위 |
| `price_rounding_rule` |  | 판매가 계산 절사 방법 L : 내림 · U : 반올림 · C : 올림 |
| `auto_translation` |  | 자동 번역 항목 사용여부 T:사용 · F:사용안함 |
| `translation_items` |  | 자동 번역 항목 product_name : 상품명 · summary_description : 상품요약설명 · simple_description : 상품간략설명 · description : 상품상세설명 · category_name : 상품 분류 · option : 옵션 · material : 상품소재 |
| `popular_search_keywords` | 배열 최대사이즈: [10] | 인기검색어 |
| `popup_menu` |  | 팝업 메뉴 T : 사용함 · F : 사용안함 |
| `display_sub_category` |  | 분류 리스트 표시 T : 사용함 · F : 사용안함 |
| `display_sub_category_detail` |  | 하위분류 표시단계 상세설정 |
| `display_product_count` |  | 상품 수 표시 T : 사용함 · F : 사용안함 |
| `option_preview` |  | 옵션 미리보기 기능 T : 사용함 · F : 사용안함 |
| `wishlist_registration` |  | 관심상품 등록 기능 T : 사용함 · F : 사용안함 |
| `additional_image_action` |  | 추가이미지 액션 C : 마우스 클릭 · O : 마우스 오버 |
| `image_effect` |  | 상품이미지 효과 설정 T : 사용함 · F : 사용안함 |
| `image_effect_detail` |  | 상품이미지 효과 상세설정 |

## Operations

### `GET /api/v2/admin/products/setting` — Retrieve product settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-product-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `product` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `display_price_scope` |  | 회원/비회원 가격표시 A : 모두 표시함 (회원+비회원) · C : 회원만 표시함 |
| ↳ `calculate_price_based_on` |  | 판매가 계산 기준 S : 공급가 대비 마진율 · A : 판매가 대비 마진율 · P : 기본몰 판매가 · B : 상품가 |
| ↳ `price_rounding_unit` |  | 판매가 계산 절사 단위 F : 절사안함 · -2 : 0.01단위 · -1 : 0.1단위 · 0 : 1단위 · 1 : 10단위 · 2 : 100단위 · 3 : 1000단위 |
| ↳ `price_rounding_rule` |  | 판매가 계산 절사 방법 L : 내림 · U : 반올림 · C : 올림 |
| ↳ `auto_translation` |  | 자동 번역 항목 사용여부 T:사용 · F:사용안함 |
| ↳ `translation_items` |  | 자동 번역 항목 product_name : 상품명 · summary_description : 상품요약설명 · simple_description : 상품간략설명 · description : 상품상세설명 · category_name : 상품 분류 · option : 옵션 · material : 상품소재 |
| ↳ `popular_search_keywords` | 배열 최대사이즈: [10] | 인기검색어 |
| ↳ `popup_menu` |  | 팝업 메뉴 T : 사용함 · F : 사용안함 |
| ↳ `display_sub_category` |  | 분류 리스트 표시 T : 사용함 · F : 사용안함 |
| ↳ `display_sub_category_detail` |  | 하위분류 표시단계 상세설정 |
| ↳ ↳ `type` |  |  |
| ↳ ↳ `visible_targets_by_depth` |  | (응답 객체) |
| ↳ ↳ ↳ `category_depth_1` |  |  |
| ↳ ↳ ↳ `category_depth_2` |  |  |
| ↳ ↳ ↳ `category_depth_3` |  |  |
| ↳ `display_product_count` |  | 상품 수 표시 T : 사용함 · F : 사용안함 |
| ↳ `option_preview` |  | 옵션 미리보기 기능 T : 사용함 · F : 사용안함 |
| ↳ `wishlist_registration` |  | 관심상품 등록 기능 T : 사용함 · F : 사용안함 |
| ↳ `additional_image_action` |  | 추가이미지 액션 C : 마우스 클릭 · O : 마우스 오버 |
| ↳ `image_effect` |  | 상품이미지 효과 설정 T : 사용함 · F : 사용안함 |
| ↳ `image_effect_detail` |  | 상품이미지 효과 상세설정 |
| ↳ ↳ `type` |  |  |
| ↳ ↳ `opacity_value` |  |  |
| ↳ ↳ `border_color` |  |  |
| ↳ ↳ `border_width` |  |  |

응답 예시 (JSON):

```json
{
    "product": {
        "shop_no": 1,
        "display_price_scope": "A",
        "calculate_price_based_on": "P",
        "price_rounding_unit": "1",
        "price_rounding_rule": "U",
        "auto_translation": "T",
        "translation_items": [
            "product_name",
            "summary_description",
            "simple_description",
            "description",
            "category_name",
            "option",
            "material"
        ],
        "popular_search_keywords": [
            "New arrivals",
            "Best sellers"
        ],
        "popup_menu": "T",
        "display_sub_category": "T",
        "display_sub_category_detail": {
            "type": "S",
            "visible_targets_by_depth": {
                "category_depth_1": "category_depth_4",
                "category_depth_2": "category_depth_4",
                "category_depth_3": "category_depth_4"
            }
        },
        "display_product_count": "T",
        "option_preview": "T",
        "wishlist_registration": "T",
        "additional_image_action": "O",
        "image_effect": "T",
        "image_effect_detail": {
            "type": "opacity",
            "opacity_value": 10,
            "border_color": "#ff0000",
            "border_width": 1
        }
    }
}
```
