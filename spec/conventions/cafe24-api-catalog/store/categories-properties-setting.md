---
resource: store
entity: categories-properties-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#categories-properties-setting
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Categories properties setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Categories properties setting](https://developers.cafe24.com/docs/ko/api/admin/#categories-properties-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품 목록 화면에 표시되는 항목의 추가 설정을 조회하고 수정할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 |
| `strikethrough_retail_price` |  | 소비자가 취소선 표시 |
| `strikethrough_price` |  | 판매가 취소선 표시 |
| `product_tax_type_text` |  | 판매가 부가세 표시문구 |
| `product_discount_price_text` |  | 할인판매가 할인금액 표시문구 |
| `optimum_discount_price_text` |  | 최적할인가 할인금액 표시문구 |

## Operations

### `GET /api/v2/admin/categories/properties/setting` — Retrieve additional settings for products in the list

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-additional-settings-for-products-in-the-list

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `category` |  | (응답 객체) |
| ↳ `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 |
| ↳ `strikethrough_retail_price` |  | 소비자가 취소선 표시 |
| ↳ `strikethrough_price` |  | 판매가 취소선 표시 |
| ↳ `product_tax_type_text` |  | 판매가 부가세 표시문구 |
| ↳ ↳ `use` |  |  |
| ↳ ↳ `color` |  |  |
| ↳ ↳ `font_size` |  |  |
| ↳ ↳ `font_type` |  |  |
| ↳ `product_discount_price_text` |  | 할인판매가 할인금액 표시문구 |
| ↳ ↳ `use` |  |  |
| ↳ ↳ `color` |  |  |
| ↳ ↳ `font_size` |  |  |
| ↳ ↳ `font_type` |  |  |
| ↳ `optimum_discount_price_text` |  | 최적할인가 할인금액 표시문구 |
| ↳ ↳ `use` |  |  |
| ↳ ↳ `color` |  |  |
| ↳ ↳ `font_size` |  |  |
| ↳ ↳ `font_type` |  |  |

응답 예시 (JSON):

```json
{
    "category": {
        "shop_no": 1,
        "strikethrough_retail_price": "F",
        "strikethrough_price": "T",
        "product_tax_type_text": {
            "use": "T",
            "color": "#999999",
            "font_size": 12,
            "font_type": "N"
        },
        "product_discount_price_text": {
            "use": "T",
            "color": "#FF5B59",
            "font_size": 14,
            "font_type": "N"
        },
        "optimum_discount_price_text": {
            "use": "T",
            "color": "#0066FF",
            "font_size": 14,
            "font_type": "N"
        }
    }
}
```

### `PUT /api/v2/admin/categories/properties/setting` — Update additional settings for products in the list

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-additional-settings-for-products-in-the-list

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `strikethrough_retail_price` |  |  |  | 소비자가 취소선 표시 T : 사용함 · F : 사용안함 |
| `strikethrough_price` |  |  |  | 판매가 취소선 표시 T : 사용함 · F : 사용안함 |
| `product_tax_type_text` |  |  |  | 판매가 부가세 표시문구 |
| ↳ `use` |  |  |  | 사용 여부 · T : 사용함 · F : 사용안함 |
| ↳ `color` |  |  |  | 글자 색상 |
| ↳ `font_size` |  |  |  | 글자 크기 |
| ↳ `font_type` |  |  |  | 글자 타입 · N : 보통(Normal) · B : 굵게(Bold) · I : 기울임(Italic) · D : 굵게 기울임(Bold Italic) |
| `product_discount_price_text` |  |  |  | 할인판매가 할인금액 표시문구 |
| ↳ `use` |  |  |  | 사용 여부 · T : 사용함 · F : 사용안함 |
| ↳ `color` |  |  |  | 글자 색상 |
| ↳ `font_size` |  |  |  | 글자 크기 |
| ↳ `font_type` |  |  |  | 글자 타입 · N : 보통(Normal) · B : 굵게(Bold) · I : 기울임(Italic) · D : 굵게 기울임(Bold Italic) |
| `optimum_discount_price_text` |  |  |  | 최적할인가 할인금액 표시문구 |
| ↳ `use` |  |  |  | 사용 여부 · T : 사용함 · F : 사용안함 |
| ↳ `color` |  |  |  | 글자 색상 |
| ↳ `font_size` |  |  |  | 글자 크기 |
| ↳ `font_type` |  |  |  | 글자 타입 · N : 보통(Normal) · B : 굵게(Bold) · I : 기울임(Italic) · D : 굵게 기울임(Bold Italic) |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `category` |  | (응답 객체) |
| ↳ `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 |
| ↳ `strikethrough_retail_price` |  | 소비자가 취소선 표시 |
| ↳ `strikethrough_price` |  | 판매가 취소선 표시 |
| ↳ `product_tax_type_text` |  | 판매가 부가세 표시문구 |
| ↳ ↳ `use` |  |  |
| ↳ ↳ `color` |  |  |
| ↳ ↳ `font_size` |  |  |
| ↳ ↳ `font_type` |  |  |
| ↳ `product_discount_price_text` |  | 할인판매가 할인금액 표시문구 |
| ↳ ↳ `use` |  |  |
| ↳ ↳ `color` |  |  |
| ↳ ↳ `font_size` |  |  |
| ↳ ↳ `font_type` |  |  |
| ↳ `optimum_discount_price_text` |  | 최적할인가 할인금액 표시문구 |
| ↳ ↳ `use` |  |  |
| ↳ ↳ `color` |  |  |
| ↳ ↳ `font_size` |  |  |
| ↳ ↳ `font_type` |  |  |

응답 예시 (JSON):

```json
{
    "category": {
        "shop_no": 1,
        "strikethrough_retail_price": "F",
        "strikethrough_price": "T",
        "product_tax_type_text": {
            "use": "F",
            "color": "#999999",
            "font_size": "12",
            "font_type": "N"
        },
        "product_discount_price_text": {
            "use": "T",
            "color": "#FF5B59",
            "font_size": "14",
            "font_type": "N"
        },
        "optimum_discount_price_text": {
            "use": "T",
            "color": "#0066FF",
            "font_size": "14",
            "font_type": "N"
        }
    }
}
```
