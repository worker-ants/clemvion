---
resource: translation
entity: translations-categories
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#translations-categories
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
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

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `categories` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `category_no` |  | 분류 번호 |
| ↳ `translations` |  | 번역 정보 |
| ↳ ↳ `language_code` |  |  |
| ↳ ↳ `translated` |  |  |
| ↳ ↳ `category_name` |  |  |
| ↳ ↳ `seo` |  | (응답 객체) |
| ↳ ↳ ↳ `meta_title` |  |  |
| ↳ ↳ ↳ `meta_author` |  |  |
| ↳ ↳ ↳ `meta_description` |  |  |
| ↳ ↳ ↳ `meta_keywords` |  |  |
| ↳ ↳ `updated_date` |  |  |
| `links` |  | (목록) |
| ↳ `rel` |  |  |
| ↳ `href` |  |  |

응답 예시 (JSON):

```json
{
    "categories": [
        {
            "shop_no": 1,
            "category_no": 27,
            "translations": [
                {
                    "language_code": "en_US",
                    "translated": "T",
                    "category_name": "(Detailed Category) Cropped",
                    "seo": {
                        "meta_title": "Browser Title",
                        "meta_author": "Cafe24",
                        "meta_description": "This is a sample product.",
                        "meta_keywords": "sample keyword1,sample keyword2, sample keyword3, ..."
                    },
                    "updated_date": "2018-01-19T11:19:27+09:00"
                },
                {
                    "language_code": "es_ES",
                    "translated": "T",
                    "category_name": "(Detailed Category) Cropped",
                    "seo": {
                        "meta_title": "Browser Title",
                        "meta_author": "Cafe24",
                        "meta_description": "This is a sample product.",
                        "meta_keywords": "sample keyword1,sample keyword2, sample keyword3, ..."
                    },
                    "updated_date": "2018-01-19T11:19:27+09:00"
                }
            ]
        },
        {
            "shop_no": 1,
            "category_no": 28,
            "translations": [
                {
                    "language_code": "en_US",
                    "translated": "T",
                    "category_name": "(Detailed Category) Cropped",
                    "seo": {
                        "meta_title": "Browser Title",
                        "meta_author": "Cafe24",
                        "meta_description": "This is a sample product.",
                        "meta_keywords": "sample keyword1,sample keyword2, sample keyword3, ..."
                    },
                    "updated_date": "2018-01-19T11:19:27+09:00"
                },
                {
                    "language_code": "es_ES",
                    "translated": "T",
                    "category_name": "(Detailed Category) Cropped",
                    "seo": {
                        "meta_title": "Browser Title",
                        "meta_author": "Cafe24",
                        "meta_description": "This is a sample product.",
                        "meta_keywords": "sample keyword1,sample keyword2, sample keyword3, ..."
                    },
                    "updated_date": "2018-01-19T11:19:27+09:00"
                }
            ]
        }
    ],
    "links": [
        {
            "rel": "next",
            "href": "https://{mallid}.cafe24api.com/api/v2/admin/translations/categories?limit=10&offset=10"
        }
    ]
}
```

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

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `category` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `category_no` |  | 분류 번호 |
| ↳ `translations` |  | 번역 정보 |
| ↳ ↳ `language_code` |  |  |
| ↳ ↳ `translated` |  |  |
| ↳ ↳ `category_name` |  |  |
| ↳ ↳ `seo` |  | (응답 객체) |
| ↳ ↳ ↳ `meta_title` |  |  |
| ↳ ↳ ↳ `meta_author` |  |  |
| ↳ ↳ ↳ `meta_description` |  |  |
| ↳ ↳ ↳ `meta_keywords` |  |  |
| ↳ ↳ `updated_date` |  |  |

응답 예시 (JSON):

```json
{
    "category": {
        "shop_no": 1,
        "category_no": 27,
        "translations": [
            {
                "language_code": "en_US",
                "translated": "T",
                "category_name": "(Detailed Category) Cropped",
                "seo": {
                    "meta_title": "Browser Title",
                    "meta_author": "Cafe24",
                    "meta_description": "This is a sample product.",
                    "meta_keywords": "sample keyword1,sample keyword2, sample keyword3, ..."
                },
                "updated_date": "2018-01-19T11:19:27+09:00"
            },
            {
                "language_code": "es_ES",
                "category_name": "(Detailed Category) Cropped",
                "seo": {
                    "meta_title": "Browser Title",
                    "meta_author": "Cafe24",
                    "meta_description": "This is a sample product.",
                    "meta_keywords": "sample keyword1,sample keyword2, sample keyword3, ..."
                },
                "updated_date": "2018-01-19T11:19:27+09:00"
            }
        ]
    }
}
```
