---
resource: translation
entity: translations-categories
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#translations-categories
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Translation / Translations categories

> Field-level 카탈로그. Endpoint enumeration index: [`../translation.md`](../translation.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Translations categories](https://developers.cafe24.com/docs/ko/api/admin/#translations-categories)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품 분류 번역 정보(Translations categories)는, 상품 분류의 번역 정보를 조회하거나 수정할 수 있는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `category_no` |  | 분류 번호 |
| `translations` |  | 번역 정보 |

## Operations

### `GET /api/v2/admin/translations/categories` — Retrieve a list of product category translations

- **Scope**: `mall.read_translation` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-category-translations

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `category_no` |  |  |  | 분류 번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `language_code` |  |  |  | 언어 코드 번역 정보의 언어 코드에 해당되는 번역 정보를 검색 · 언어별로 번역된 정보에서 검색하고자 하는 언어를 선택하면, 해당 언어에 대한 번역 내용을 확인할 수 있습니다. ,(콤마)로 여러 건을 검색할 수 있다. |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |

### `PUT /api/v2/admin/translations/categories/{category_no}` — Update product category translation

- **Scope**: `mall.write_translation` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-product-category-translation

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `category_no` | ✓ |  |  | 분류 번호 |
| `translations` |  |  |  | 번역 정보 |
| ↳ `language_code` | ✓ |  |  | 언어 코드 |
| ↳ `category_name` |  |  |  | 분류명 |
| ↳ `seo` |  | Array |  |  |
| ↳ ↳ `meta_title` |  |  |  | 브라우저 타이틀 |
| ↳ ↳ `meta_author` |  |  |  | 메타태그1 : Author |
| ↳ ↳ `meta_description` |  |  |  | 메타태그2 : Description |
| ↳ ↳ `meta_keywords` |  |  |  | 메타태그3 : Keywords |
