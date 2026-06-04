---
resource: shipping
entity: shippingorigins
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#shippingorigins
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Shipping / Shippingorigins

> Field-level 카탈로그. Endpoint enumeration index: [`../shipping.md`](../shipping.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Shippingorigins](https://developers.cafe24.com/docs/ko/api/admin/#shippingorigins)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

출고지 관리(Shipping origins)는 출고지에 대한 정보를 관리하는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `origin_code` | 형식 : [A-Z0-9]; 글자수 최소: [8자]~최대: [8자] | 출고지 코드 |
| `origin_name` | 최대글자수 : [50자] | 출고지 명 |
| `default` |  | 출고지 기본설정 여부 T : 사용함 · F : 사용안함 |
| `country_code` | 최대글자수 : [2자] | 국가코드 |
| `zipcode` | 최소글자수 : [2자]; 최대글자수 : [14자] | 우편번호 |
| `address1` | 최대글자수 : [255자] | 기본 주소 |
| `address2` | 최대글자수 : [255자] | 상세 주소 |
| `contact` |  | 대표 연락처 |
| `secondary_contact` |  | 보조 연락처 |
| `variants` |  | 출고지 품목 정보 |

## Operations

### `GET /api/v2/admin/shippingorigins` — Retrieve a list of shipping origins

- **Scope**: `mall.read_shipping` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-shipping-origins

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "shippingorigins": [
        {
            "origin_code": "W0000000",
            "origin_name": "Dongjak-gu Warehouse",
            "default": "F",
            "contact": "010-0000-0000",
            "secondary_contact": "010-0000-0000",
            "zipcode": "07071",
            "country_code": "KR",
            "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
            "address2": "Professional Construction Hall",
            "variants": [
                "P000000C000Q",
                "P000000C000R"
            ]
        },
        {
            "origin_code": "W000000B",
            "origin_name": "Boramae Warehouse",
            "default": "F",
            "contact": "010-0000-0000",
            "secondary_contact": "010-0000-0000",
            "zipcode": "07811",
            "country_code": "KR",
            "address1": "Dongjak-gu, Seoul, Republic of Korea",
            "address2": "15, Boramae-ro 5-gil",
            "variants": [
                "P000000C000C",
                "P000000C000F"
            ]
        }
    ],
    "links": [
        {
            "rel": "prev",
            "href": "https://{mallid}.cafe24api.com/api/v2/admin/shippingorigins?offset=0&limit=10"
        },
        {
            "rel": "next",
            "href": "https://{mallid}.cafe24api.com/api/v2/admin/shippingorigins?offset=20&limit=10"
        }
    ]
}
```

### `GET /api/v2/admin/shippingorigins/{origin_code}` — Retrieve a shipping origin

- **Scope**: `mall.read_shipping` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-shipping-origin

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `origin_code` | ✓ | 형식 : [A-Z0-9]; 글자수 최소: [8자]~최대: [8자] |  | 출고지 코드 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "shippingorigin": {
        "origin_code": "W000000Q",
        "origin_name": "Dongjak-gu Warehouse",
        "default": "F",
        "contact": "010-0000-0000",
        "secondary_contact": "010-0000-0000",
        "zipcode": "07811",
        "country_code": "KR",
        "address1": "Dongjak-gu, Seoul, Republic of Korea",
        "address2": "15, Boramae-ro 5-gil",
        "variants": [
            "P000000B000B",
            "P000000B000C"
        ]
    },
    "links": [
        {
            "rel": "self",
            "href": "https://{mallid}.cafe24api.com/api/v2/admin/shippingorigins/W000000Q"
        }
    ]
}
```

### `POST /api/v2/admin/shippingorigins` — Create a shipping origin

- **Scope**: `mall.write_shipping` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-shipping-origin

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `origin_name` | ✓ | 최대글자수 : [50자] |  | 출고지 명 |
| `address1` | ✓ | 최대글자수 : [255자] |  | 기본 주소 |
| `address2` | ✓ | 최대글자수 : [255자] |  | 상세 주소 |
| `country_code` | ✓ | 최대글자수 : [2자] |  | 국가코드 |
| `default` |  |  | F | 출고지 기본설정 여부 T : 사용함 · F : 사용안함 |
| `zipcode` |  | 최소글자수 : [2자]; 최대글자수 : [14자] |  | 우편번호 |
| `contact` |  | 전화번호; 최대글자수 : [20자] |  | 대표 연락처 |
| `secondary_contact` |  | 전화번호; 최대글자수 : [20자] |  | 보조 연락처 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "shippingorigin": {
        "origin_code": "W000000C",
        "origin_name": "Dongjak-gu warehouse",
        "default": "F",
        "contact": "010-0000-0000",
        "secondary_contact": "010-0000-0000",
        "zipcode": "07071",
        "country_code": "KR",
        "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
        "address2": "Professional Construction Hall",
        "variants": null
    }
}
```

### `PUT /api/v2/admin/shippingorigins/{origin_code}` — Update a shipping origin

- **Scope**: `mall.write_shipping` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-shipping-origin

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `origin_code` | ✓ | 형식 : [A-Z0-9]; 글자수 최소: [8자]~최대: [8자] |  | 출고지 코드 |
| `origin_name` |  | 최대글자수 : [50자] |  | 출고지 명 |
| `country_code` |  | 최대글자수 : [2자] |  | 국가코드 |
| `default` |  |  |  | 출고지 기본설정 여부 T : 사용함 · F : 사용안함 |
| `contact` |  | 전화번호; 최대글자수 : [20자] |  | 대표 연락처 |
| `secondary_contact` |  | 전화번호; 최대글자수 : [20자] |  | 보조 연락처 |
| `zipcode` |  | 최소글자수 : [2자]; 최대글자수 : [14자] |  | 우편번호 |
| `address1` |  | 최대글자수 : [255자] |  | 기본 주소 |
| `address2` |  | 최대글자수 : [255자] |  | 상세 주소 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "shippingorigin": {
        "origin_code": "W000000Q",
        "origin_name": "Dongjak-gu Warehouse",
        "default": "F",
        "contact": "010-0000-0000",
        "secondary_contact": "010-0000-0000",
        "zipcode": "07071",
        "country_code": "KR",
        "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
        "address2": "Professional Construction Hall",
        "variants": null
    }
}
```

### `DELETE /api/v2/admin/shippingorigins/{origin_code}` — Delete a shipping origin

- **Scope**: `mall.write_shipping` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-shipping-origin

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `origin_code` | ✓ | 형식 : [A-Z0-9]; 글자수 최소: [8자]~최대: [8자] |  | 출고지 코드 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "shippingorigin": {
        "origin_code": "W000000Q"
    }
}
```
