---
resource: store
entity: mains-properties-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#mains-properties-setting
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Store / Mains properties setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Mains properties setting](https://developers.cafe24.com/docs/ko/api/admin/#mains-properties-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

메인 화면에 표시되는 항목의 추가 설정을 조회하고 수정할 수 있습니다.

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

### `GET /api/v2/admin/mains/properties/setting` — Retrieve additional settings for products on the main screen

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-additional-settings-for-products-on-the-main-screen

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

### `PUT /api/v2/admin/mains/properties/setting` — Update additional settings for products on the main screen

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-additional-settings-for-products-on-the-main-screen

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
