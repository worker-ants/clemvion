---
resource: translation
entity: translations-products
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#translations-products
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Translation / Translations products

> Field-level 카탈로그. Endpoint enumeration index: [`../translation.md`](../translation.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Translations products](https://developers.cafe24.com/docs/ko/api/admin/#translations-products)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상품 번역 정보(Translations products)는, 상품의 번역 정보를 조회하거나 수정할 수 있는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `product_no` |  | 상품번호 |
| `product_name` | 최대글자수 : [250자] | 상품명 |
| `translations` |  | 번역 정보 |

## Operations

### `GET /api/v2/admin/translations/products` — Retrieve a list of product translations

- **Scope**: `mall.read_translation` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-translations

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `product_no` |  |  |  | 상품번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `product_name` |  |  |  | 상품명 상품의 상품명에 해당되는 번역 정보를 검색 ,(콤마)로 여러 건을 검색할 수 있다. |
| `language_code` |  |  |  | 언어 코드 번역 정보의 언어 코드에 해당되는 번역 정보를 검색 · 언어별로 번역된 정보에서 검색하고자 하는 언어를 선택하면, 해당 언어에 대한 번역 내용을 확인할 수 있습니다. ,(콤마)로 여러 건을 검색할 수 있다. |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `products` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `product_no` |  | 상품번호 |
| ↳ `product_name` | 최대글자수 : [250자] | 상품명 |
| ↳ `translations` |  | 번역 정보 |
| ↳ ↳ `translated` |  |  |
| ↳ ↳ `language_code` |  | 언어 코드 번역 정보의 언어 코드에 해당되는 번역 정보를 검색 · 언어별로 번역된 정보에서 검색하고자 하는 언어를 선택하면, 해당 언어에 대한 번역 내용을 확인할 수 있습니다. ,(콤마)로 여러 건을 검색할 수 있다. |
| ↳ ↳ `product_name` | 최대글자수 : [250자] | 상품명 |
| ↳ ↳ `product_tag` |  | 상품 검색어 |
| ↳ ↳ `description` |  | 상품상세설명 |
| ↳ ↳ `mobile_description` |  | 모바일 상품 상세설명 |
| ↳ ↳ `simple_description` |  | 상품 간략 설명 |
| ↳ ↳ `summary_description` |  | 상품요약설명 |
| ↳ ↳ `payment_info` |  | 상품결제안내 |
| ↳ ↳ `shipping_info` |  | 상품배송안내 |
| ↳ ↳ `exchange_info` |  | 교환/반품안내 |
| ↳ ↳ `service_info` |  | 서비스문의/안내 |
| ↳ ↳ `product_material` |  | 상품소재 |
| ↳ ↳ `seo` |  | (응답 객체) |
| ↳ ↳ ↳ `meta_title` |  | 브라우저 타이틀 |
| ↳ ↳ ↳ `meta_author` |  | 메타태그1 : Author |
| ↳ ↳ ↳ `meta_description` |  | 메타태그2 : Description |
| ↳ ↳ ↳ `meta_keywords` |  | 메타태그3 : Keywords |
| ↳ ↳ ↳ `meta_alt` |  | 상품 이미지 Alt 텍스트 |
| ↳ ↳ `options` |  | (목록) |
| ↳ ↳ ↳ `name` |  | 옵션명 |
| ↳ ↳ ↳ `value` |  | 옵션값 |
| ↳ ↳ `updated_date` |  |  |
| `links` |  | link |
| ↳ `rel` |  |  |
| ↳ `href` |  |  |

응답 예시 (JSON):

```json
{
    "products": [
        {
            "shop_no": 1,
            "product_no": 10,
            "product_name": "iPhone X",
            "translations": [
                {
                    "translated": "T",
                    "language_code": "en_US",
                    "product_name": "iPhone X",
                    "product_tag": "translated,edu,test,sample",
                    "description": "Sample Translated Description.",
                    "mobile_description": "Sample Translated Mobile Description.",
                    "simple_description": "This is translated simple description.",
                    "summary_description": "This is translated Product Summary.",
                    "payment_info": "Sample translated payment info. You have to Pay.",
                    "shipping_info": "Sample translated shipping info. You have to ship.",
                    "exchange_info": "Sample translated exchange info. You have to exchange.",
                    "service_info": "Sample translated service info. You have to service.",
                    "product_material": "Translated material",
                    "seo": {
                        "meta_title": "product title",
                        "meta_author": "This is Author",
                        "meta_description": "This is Description.",
                        "meta_keywords": "This is Keyword.",
                        "meta_alt": "image1, image2"
                    },
                    "options": [
                        {
                            "name": "color",
                            "value": [
                                "red",
                                "green",
                                "blue"
                            ]
                        },
                        {
                            "name": "size",
                            "value": [
                                "large",
                                "small"
                            ]
                        }
                    ],
                    "updated_date": "2018-01-19T11:19:27+09:00"
                },
                {
                    "translated": "T",
                    "language_code": "es_ES",
                    "product_name": "iPhone X",
                    "product_tag": "translated,edu,test,sample",
                    "description": "Sample Translated Description.",
                    "mobile_description": "Sample Translated Mobile Description.",
                    "simple_description": "This is translated simple description.",
                    "summary_description": "This is translated Product Summary.",
                    "payment_info": "Sample translated payment info. You have to Pay.",
                    "shipping_info": "Sample translated shipping info. You have to ship.",
                    "exchange_info": "Sample translated exchange info. You have to exchange.",
                    "service_info": "Sample translated service info. You have to service.",
                    "product_material": "Translated material",
                    "seo": {
                        "meta_title": "product title",
                        "meta_author": "This is Author",
                        "meta_description": "This is Description.",
                        "meta_keywords": "This is Keyword.",
                        "meta_alt": "image1, image2"
                    },
                    "options": [
                        {
                            "name": "color",
                            "value": [
                                "red",
                                "green",
                                "blue"
                            ]
                        },
                        {
                            "name": "size",
                            "value": [
                                "large",
                                "small"
                            ]
                        }
                    ],
                    "updated_date": "2018-01-19T11:19:27+09:00"
                }
            ]
        },
        {
            "shop_no": 1,
            "product_no": 11,
            "product_name": "iPhone X",
            "translations": [
                {
                    "translated": "T",
                    "language_code": "en_US",
                    "product_name": "iPhone X",
                    "product_tag": "translated,edu,test,sample",
                    "description": "Sample Translated Description.",
                    "mobile_description": "Sample Translated Mobile Description.",
                    "simple_description": "This is translated simple description.",
                    "summary_description": "This is translated Product Summary.",
                    "payment_info": "Sample translated payment info. You have to Pay.",
                    "shipping_info": "Sample translated shipping info. You have to ship.",
                    "exchange_info": "Sample translated exchange info. You have to exchange.",
                    "service_info": "Sample translated service info. You have to service.",
                    "product_material": "Translated material",
                    "seo": {
                        "meta_title": "product title",
                        "meta_author": "This is Author",
                        "meta_description": "This is Description.",
                        "meta_keywords": "This is Keyword.",
                        "meta_alt": "image1, image2"
                    },
                    "options": [
                        {
                            "name": "Color",
                            "value": [
                                "Red",
                                "Blue",
                                "Yellow"
                            ]
                        },
                        {
                            "name": "Size",
                            "value": [
                                "Small",
                                "Large"
                            ]
                        }
                    ],
                    "updated_date": "2018-01-19T11:19:27+09:00"
                },
                {
                    "translated": "T",
                    "language_code": "es_ES",
                    "product_name": "iPhone X",
                    "product_tag": "translated,edu,test,sample",
                    "description": "Sample Translated Description.",
                    "mobile_description": "Sample Translated Mobile Description.",
                    "simple_description": "This is translated simple description.",
                    "summary_description": "This is translated Product Summary.",
                    "payment_info": "Sample translated payment info. You have to Pay.",
                    "shipping_info": "Sample translated shipping info. You have to ship.",
                    "exchange_info": "Sample translated exchange info. You have to exchange.",
                    "service_info": "Sample translated service info. You have to service.",
                    "product_material": "Translated material",
                    "seo": {
                        "meta_title": "product title",
                        "meta_author": "This is Author",
                        "meta_description": "This is Description.",
                        "meta_keywords": "This is Keyword.",
                        "meta_alt": "image1, image2"
                    },
                    "options": [
                        {
                            "name": "Color",
                            "value": [
                                "Red",
                                "Blue",
                                "Yellow"
                            ]
                        },
                        {
                            "name": "Size",
                            "value": [
                                "Small",
                                "Large"
                            ]
                        }
                    ],
                    "updated_date": "2018-01-19T11:19:27+09:00"
                }
            ]
        }
    ],
    "links": [
        {
            "rel": "next",
            "href": "https://{mallid}.cafe24api.com/api/v2/admin/translations/products?limit=10&offset=10"
        }
    ]
}
```

### `PUT /api/v2/admin/translations/products/{product_no}` — Update product translation

- **Scope**: `mall.write_translation` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-product-translation

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `product_no` | ✓ |  |  | 상품번호 |
| `translations` |  |  |  | 번역 정보 |
| ↳ `language_code` | ✓ |  |  | 언어 코드 |
| ↳ `product_name` |  |  |  | 상품명 |
| ↳ `product_tag` |  |  |  | 상품 검색어 |
| ↳ `payment_info` |  |  |  | 상품결제안내 |
| ↳ `shipping_info` |  |  |  | 상품배송안내 |
| ↳ `exchange_info` |  |  |  | 교환/반품안내 |
| ↳ `service_info` |  |  |  | 서비스문의/안내 |
| ↳ `summary_description` |  |  |  | 상품요약설명 |
| ↳ `simple_description` |  |  |  | 상품 간략 설명 |
| ↳ `description` |  |  |  | 상품상세설명 |
| ↳ `mobile_description` |  |  |  | 모바일 상품 상세설명 |
| ↳ `product_material` |  |  |  | 상품소재 |
| ↳ `seo` |  | Array |  |  |
| ↳ ↳ `meta_title` |  |  |  | 브라우저 타이틀 |
| ↳ ↳ `meta_author` |  |  |  | 메타태그1 : Author |
| ↳ ↳ `meta_description` |  |  |  | 메타태그2 : Description |
| ↳ ↳ `meta_keywords` |  |  |  | 메타태그3 : Keywords |
| ↳ ↳ `meta_alt` |  |  |  | 상품 이미지 Alt 텍스트 |
| ↳ `options` |  | Array |  |  |
| ↳ ↳ `name` |  |  |  | 옵션명 |
| ↳ ↳ `value` |  |  |  | 옵션값 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `product` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `product_no` |  | 상품번호 |
| ↳ `product_name` | 최대글자수 : [250자] | 상품명 |
| ↳ `translations` |  | 번역 정보 |
| ↳ ↳ `translated` |  |  |
| ↳ ↳ `language_code` |  | 언어 코드 번역 정보의 언어 코드에 해당되는 번역 정보를 검색 · 언어별로 번역된 정보에서 검색하고자 하는 언어를 선택하면, 해당 언어에 대한 번역 내용을 확인할 수 있습니다. ,(콤마)로 여러 건을 검색할 수 있다. |
| ↳ ↳ `product_name` | 최대글자수 : [250자] | 상품명 |
| ↳ ↳ `product_tag` |  | 상품 검색어 |
| ↳ ↳ `description` |  | 상품상세설명 |
| ↳ ↳ `mobile_description` |  | 모바일 상품 상세설명 |
| ↳ ↳ `simple_description` |  | 상품 간략 설명 |
| ↳ ↳ `summary_description` |  | 상품요약설명 |
| ↳ ↳ `payment_info` |  | 상품결제안내 |
| ↳ ↳ `shipping_info` |  | 상품배송안내 |
| ↳ ↳ `exchange_info` |  | 교환/반품안내 |
| ↳ ↳ `service_info` |  | 서비스문의/안내 |
| ↳ ↳ `product_material` |  | 상품소재 |
| ↳ ↳ `seo` |  | (응답 객체) |
| ↳ ↳ ↳ `meta_title` |  | 브라우저 타이틀 |
| ↳ ↳ ↳ `meta_author` |  | 메타태그1 : Author |
| ↳ ↳ ↳ `meta_description` |  | 메타태그2 : Description |
| ↳ ↳ ↳ `meta_keywords` |  | 메타태그3 : Keywords |
| ↳ ↳ ↳ `meta_alt` |  | 상품 이미지 Alt 텍스트 |
| ↳ ↳ `options` |  | (목록) |
| ↳ ↳ ↳ `name` |  | 옵션명 |
| ↳ ↳ ↳ `value` |  | 옵션값 |
| ↳ ↳ `updated_date` |  |  |

응답 예시 (JSON):

```json
{
    "product": {
        "shop_no": 1,
        "product_no": 10,
        "product_name": "iPhone X",
        "translations": [
            {
                "translated": "T",
                "language_code": "en_US",
                "product_name": "iPhone X",
                "product_tag": "translated,edu,test,sample",
                "description": "Sample Translated Description.",
                "mobile_description": "Sample Translated Mobile Description.",
                "simple_description": "This is translated simple description.",
                "summary_description": "This is translated Product Summary.",
                "payment_info": "Sample translated payment info. You have to Pay.",
                "shipping_info": "Sample translated shipping info. You have to ship.",
                "exchange_info": "Sample translated exchange info. You have to exchange.",
                "service_info": "Sample translated service info. You have to service.",
                "product_material": "Translated material",
                "seo": {
                    "meta_title": "product title",
                    "meta_author": "This is Author",
                    "meta_description": "This is Description.",
                    "meta_keywords": "This is Keyword.",
                    "meta_alt": "image1, image2"
                },
                "options": [
                    {
                        "name": "Color",
                        "value": [
                            "Red",
                            "Blue",
                            "Yellow"
                        ]
                    },
                    {
                        "name": "Size",
                        "value": [
                            "Small",
                            "Large"
                        ]
                    }
                ],
                "updated_date": "2018-01-19T11:19:27+09:00"
            },
            {
                "translated": "T",
                "language_code": "es_ES",
                "product_name": "iPhone X",
                "product_tag": "translated,edu,test,sample",
                "description": "Sample Translated Description.",
                "mobile_description": "Sample Translated Mobile Description.",
                "simple_description": "This is translated simple description.",
                "summary_description": "This is translated Product Summary.",
                "payment_info": "Sample translated payment info. You have to Pay.",
                "shipping_info": "Sample translated shipping info. You have to ship.",
                "exchange_info": "Sample translated exchange info. You have to exchange.",
                "service_info": "Sample translated service info. You have to service.",
                "product_material": "Translated material",
                "seo": {
                    "meta_title": "product title",
                    "meta_author": "This is Author",
                    "meta_description": "This is Description.",
                    "meta_keywords": "This is Keyword.",
                    "meta_alt": "image1, image2"
                },
                "options": [
                    {
                        "name": "Color",
                        "value": [
                            "Red",
                            "Blue",
                            "Yellow"
                        ]
                    },
                    {
                        "name": "Size",
                        "value": [
                            "Small",
                            "Large"
                        ]
                    }
                ],
                "updated_date": "2018-01-19T11:19:27+09:00"
            }
        ]
    }
}
```
