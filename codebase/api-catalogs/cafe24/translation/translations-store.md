---
resource: translation
entity: translations-store
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#translations-store
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Translation / Translations store

> Field-level 카탈로그. Endpoint enumeration index: [`../translation.md`](../translation.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Translations store](https://developers.cafe24.com/docs/ko/api/admin/#translations-store)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상점 번역 정보(Translations store)는, 상점의 번역 정보를 조회하거나 수정할 수 있는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `translations` |  | 번역 정보 |

## Operations

### `GET /api/v2/admin/translations/store` — Retrieve a list of store translations

- **Scope**: `mall.read_translation` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-store-translations

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `language_code` |  |  |  | 언어 코드 언어별로 번역된 정보에서 검색하고자 하는 언어를 선택하면, 해당 언어에 대한 번역 내용을 확인할 수 있습니다. ,(콤마)로 여러 건을 검색할 수 있다. |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `store` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `translations` |  | 번역 정보 |
| ↳ ↳ `language_code` |  | 언어 코드 언어별로 번역된 정보에서 검색하고자 하는 언어를 선택하면, 해당 언어에 대한 번역 내용을 확인할 수 있습니다. ,(콤마)로 여러 건을 검색할 수 있다. |
| ↳ ↳ `translated` |  |  |
| ↳ ↳ `shop_name` |  | 쇼핑몰명 |
| ↳ ↳ `company_name` |  | 상호명 |
| ↳ ↳ `company_registration_no` |  | 사업자등록번호 |
| ↳ ↳ `president_name` |  | 대표자명 |
| ↳ ↳ `phone` |  | 전화번호 |
| ↳ ↳ `email` |  | 이메일 |
| ↳ ↳ `fax` |  | 팩스번호 |
| ↳ ↳ `zipcode` |  | 우편번호 |
| ↳ ↳ `address1` |  | 기본 주소 |
| ↳ ↳ `address2` |  | 상세 주소 |
| ↳ ↳ `customer_service_phone` |  | 고객센터 상담/주문 전화 |
| ↳ ↳ `customer_service_hours` |  | 고객센터 운영시간 |
| ↳ ↳ `privacy_officer_name` |  | 개인정보보호 책임자명 |
| ↳ ↳ `privacy_officer_email` |  | 개인정보보호 책임자 이메일 |
| ↳ ↳ `updated_date` |  |  |

응답 예시 (JSON):

```json
{
    "store": {
        "shop_no": 1,
        "translations": [
            {
                "language_code": "en_US",
                "translated": "T",
                "shop_name": "sample shop",
                "company_name": "sample company",
                "company_registration_no": "118-81-20586",
                "president_name": "Jone Doe",
                "phone": "02-0000-0000",
                "email": "sample@sample.com",
                "fax": "02-0000-0000",
                "zipcode": "07071",
                "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
                "address2": "Professional Construction Hall",
                "customer_service_phone": "02-0000-0000",
                "customer_service_hours": "9:00 AM ~ 5:00 PM",
                "privacy_officer_name": "Jane Doe",
                "privacy_officer_email": "sample1@sample.com",
                "updated_date": "2022-01-10T11:19:27+09:00"
            },
            {
                "language_code": "es_ES",
                "translated": "T",
                "shop_name": "tienda de muestras",
                "company_name": "compañía de muestras",
                "company_registration_no": "118-81-20586",
                "president_name": "Jone Doe",
                "phone": "02-0000-0000",
                "email": "sample@sample.com",
                "fax": "02-0000-0000",
                "zipcode": "07071",
                "address1": "Sindaebang dong Dongjak-gu, Seúl, República de Corea",
                "address2": "Hall de construcción profesional",
                "customer_service_phone": "02-0000-0000",
                "customer_service_hours": "9 de la mañana a 5 de la tarde",
                "privacy_officer_name": "Jane Doe",
                "privacy_officer_email": "sample1@sample.com",
                "updated_date": "2022-01-10T11:19:27+09:00"
            }
        ]
    }
}
```

### `PUT /api/v2/admin/translations/store` — Update the translations of a store

- **Scope**: `mall.write_translation` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-the-translations-of-a-store

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `translations` |  |  |  | 번역 정보 |
| ↳ `language_code` | ✓ |  |  | 언어 코드 |
| ↳ `shop_name` |  |  |  | 쇼핑몰명 |
| ↳ `company_name` |  |  |  | 상호명 |
| ↳ `company_registration_no` |  |  |  | 사업자등록번호 |
| ↳ `president_name` |  |  |  | 대표자명 |
| ↳ `phone` |  |  |  | 전화번호 |
| ↳ `email` |  |  |  | 이메일 |
| ↳ `fax` |  |  |  | 팩스번호 |
| ↳ `zipcode` |  |  |  | 우편번호 |
| ↳ `address1` |  |  |  | 기본 주소 |
| ↳ `address2` |  |  |  | 상세 주소 |
| ↳ `customer_service_phone` |  |  |  | 고객센터 상담/주문 전화 |
| ↳ `customer_service_hours` |  |  |  | 고객센터 운영시간 |
| ↳ `privacy_officer_name` |  |  |  | 개인정보보호 책임자명 |
| ↳ `privacy_officer_email` |  |  |  | 개인정보보호 책임자 이메일 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `store` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `translations` |  | 번역 정보 |
| ↳ ↳ `language_code` |  | 언어 코드 언어별로 번역된 정보에서 검색하고자 하는 언어를 선택하면, 해당 언어에 대한 번역 내용을 확인할 수 있습니다. ,(콤마)로 여러 건을 검색할 수 있다. |
| ↳ ↳ `translated` |  |  |
| ↳ ↳ `shop_name` |  | 쇼핑몰명 |
| ↳ ↳ `company_name` |  | 상호명 |
| ↳ ↳ `company_registration_no` |  | 사업자등록번호 |
| ↳ ↳ `president_name` |  | 대표자명 |
| ↳ ↳ `phone` |  | 전화번호 |
| ↳ ↳ `email` |  | 이메일 |
| ↳ ↳ `fax` |  | 팩스번호 |
| ↳ ↳ `zipcode` |  | 우편번호 |
| ↳ ↳ `address1` |  | 기본 주소 |
| ↳ ↳ `address2` |  | 상세 주소 |
| ↳ ↳ `customer_service_phone` |  | 고객센터 상담/주문 전화 |
| ↳ ↳ `customer_service_hours` |  | 고객센터 운영시간 |
| ↳ ↳ `privacy_officer_name` |  | 개인정보보호 책임자명 |
| ↳ ↳ `privacy_officer_email` |  | 개인정보보호 책임자 이메일 |
| ↳ ↳ `updated_date` |  |  |

응답 예시 (JSON):

```json
{
    "store": {
        "shop_no": 1,
        "translations": [
            {
                "language_code": "en_US",
                "translated": "T",
                "shop_name": "sample shop",
                "company_name": "sample company",
                "company_registration_no": "118-81-20586",
                "president_name": "Jone Doe",
                "phone": "02-0000-0000",
                "email": "sample@sample.com",
                "fax": "02-0000-0000",
                "zipcode": "07071",
                "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
                "address2": "Professional Construction Hall",
                "customer_service_phone": "02-0000-0000",
                "customer_service_hours": "9:00 AM ~ 5:00 PM",
                "privacy_officer_name": "Jane Doe",
                "privacy_officer_email": "sample1@sample.com",
                "updated_date": "2022-01-10T11:19:27+09:00"
            },
            {
                "language_code": "es_ES",
                "translated": "T",
                "shop_name": "tienda de muestras",
                "company_name": "compañía de muestras",
                "company_registration_no": "118-81-20586",
                "president_name": "Jone Doe",
                "phone": "02-0000-0000",
                "email": "sample@sample.com",
                "fax": "02-0000-0000",
                "zipcode": "07071",
                "address1": "Sindaebang dong Dongjak-gu, Seúl, República de Corea",
                "address2": "Hall de construcción profesional",
                "customer_service_phone": "02-0000-0000",
                "customer_service_hours": "9 de la mañana a 5 de la tarde",
                "privacy_officer_name": "Jane Doe",
                "privacy_officer_email": "sample1@sample.com",
                "updated_date": "2022-01-10T11:19:27+09:00"
            }
        ]
    }
}
```
