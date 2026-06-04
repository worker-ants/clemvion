---
resource: collection
entity: manufacturers
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#manufacturers
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Collection / Manufacturers

> Field-level 카탈로그. Endpoint enumeration index: [`../collection.md`](../collection.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Manufacturers](https://developers.cafe24.com/docs/ko/api/admin/#manufacturers)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

제조사(Manufacturers)는 상품의 제작정보 중 제조사에 입력하는 정보입니다. · 제조사는 상품을 제작, 생산한 주체를 나타내며, 상품을 구분하는 판매분류 중 하나입니다. · 상품은 반드시 하나의 제조사를 갖고 있습니다.(미지정시 '자체제작'을 사용함) · 제조사의 목록조회, 수 조회, 상세조회, 생성, 수정이 가능합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `manufacturer_code` | 형식 : [A-Z0-9]; 글자수 최소: [8자]~최대: [8자] | 제조사 코드 시스템이 부여한 제조사의 코드. 해당 쇼핑몰 내에서 제조사 코드는 중복되지 않는다. |
| `manufacturer_name` | 최대글자수 : [50자] | 제조사명 제조사의 이름. 제조사명은 쇼핑몰 관리자 화면에서 제조사를 구분할 수 있는 기본적인 정보이다. |
| `president_name` | 최대글자수 : [30자] | 대표자명 제조사의 대표자 이름. |
| `use_manufacturer` |  | 사용여부 해당 제조사를 사용하는지 여부 표시 T : 사용함 · F : 사용안함 |
| `email` | 최대글자수 : [255자] | 이메일 제조사의 문의 메일. |
| `phone` | 최대글자수 : [20자] | 전화번호 제조사의 전화번호. |
| `homepage` | 최대글자수 : [255자] | 홈페이지 제조사의 홈페이지 주소 |
| `zipcode` |  | 우편번호 제조사의 사업장 우편번호. |
| `country_code` |  | 국가코드 |
| `address1` | 최대글자수 : [255자] | 기본 주소 제조사의 사업장 주소(시/군/구 단위 표기) |
| `address2` | 최대글자수 : [255자] | 상세 주소 제조사의 사업장 주소(상세 주소 표기) |
| `created_date` |  | 생성일 |

## Operations

### `GET /api/v2/admin/manufacturers` — Retrieve a list of manufacturers

- **Scope**: `mall.read_collection` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-manufacturers

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `manufacturer_code` |  |  |  | 제조사 코드 조회하고자 하는 제조사의 코드. ,(콤마)로 여러 건을 검색할 수 있다. |
| `manufacturer_name` |  |  |  | 제조사명 ,(콤마)로 여러 건을 검색할 수 있다. |
| `use_manufacturer` |  |  |  | 제조사 사용여부 T : 사용함 · F : 사용안함 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 조회하고자 하는 최대 건수를 지정할 수 있음. · 예) 10 입력시 10건만 표시함. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "manufacturers": [
        {
            "shop_no": 1,
            "manufacturer_code": "M0000000",
            "manufacturer_name": "Sample Manufacturer",
            "president_name": "Sample Administrator",
            "use_manufacturer": "T"
        },
        {
            "shop_no": 1,
            "manufacturer_code": "M000000C",
            "manufacturer_name": "Sample Manufacturer",
            "president_name": "Sample Administrator",
            "use_manufacturer": "F"
        }
    ]
}
```

### `GET /api/v2/admin/manufacturers/{manufacturer_code}` — Retrieve a manufacturer

- **Scope**: `mall.read_collection` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-manufacturer

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `manufacturer_code` | ✓ | 형식 : [A-Z0-9]; 글자수 최소: [8자]~최대: [8자] |  | 제조사 코드 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "manufacturer": {
        "shop_no": 1,
        "manufacturer_code": "M0000000",
        "manufacturer_name": "Sample Manufacturer",
        "president_name": "Sample User",
        "email": "sample@sample.com",
        "phone": "010-000-0000",
        "homepage": "http://sample.com",
        "zipcode": "00000",
        "country_code": "KR",
        "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
        "address2": "Professional Construction Hall",
        "created_date": "2018-09-01T15:00:00+09:00",
        "use_manufacturer": "T"
    }
}
```

### `GET /api/v2/admin/manufacturers/count` — Retrieve a count of manufacturers

- **Scope**: `mall.read_collection` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-manufacturers

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `manufacturer_code` |  |  |  | 제조사 코드 조회하고자 하는 제조사의 코드. ,(콤마)로 여러 건을 검색할 수 있다. |
| `manufacturer_name` |  |  |  | 제조사명 검색어를 제조사명에 포함하고 있는 공급사 검색(대소문자 구분 없음) ,(콤마)로 여러 건을 검색할 수 있다. |
| `use_manufacturer` |  |  |  | 제조사 사용여부 T : 사용함 · F : 사용안함 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "count": 2
}
```

### `POST /api/v2/admin/manufacturers` — Create a manufacturer

- **Scope**: `mall.write_collection` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-manufacturer

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `manufacturer_name` | ✓ |  |  | 제조사명 |
| `president_name` | ✓ | 최대글자수 : [30자] |  | 대표자명 |
| `email` |  | 최대글자수 : [255자]; 이메일 |  | 이메일 |
| `phone` |  | 최대글자수 : [20자]; 전화번호 |  | 전화번호 |
| `homepage` |  | 최대글자수 : [255자] |  | 홈페이지 |
| `zipcode` |  |  |  | 우편번호 |
| `address1` |  | 최대글자수 : [255자] |  | 기본 주소 |
| `address2` |  | 최대글자수 : [255자] |  | 상세 주소 |
| `country_code` |  |  |  | 국가코드 |
| `use_manufacturer` |  |  |  | 사용여부 T : 사용함 · F : 사용안함 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "manufacturer": {
        "shop_no": 1,
        "manufacturer_code": "M0000000",
        "manufacturer_name": "Sample Manufacturer",
        "president_name": "Sample User",
        "email": "sample@sample.com",
        "phone": "010-000-0000",
        "homepage": "http://sample.com",
        "zipcode": "00000",
        "country_code": "KR",
        "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
        "address2": "Professional Construction Hall",
        "use_manufacturer": "T"
    }
}
```

### `PUT /api/v2/admin/manufacturers/{manufacturer_code}` — Update a manufacturer

- **Scope**: `mall.write_collection` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-manufacturer

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `manufacturer_code` | ✓ | 형식 : [A-Z0-9]; 글자수 최소: [8자]~최대: [8자] |  | 제조사 코드 |
| `manufacturer_name` |  |  |  | 제조사명 |
| `president_name` |  |  |  | 대표자명 |
| `email` |  | 최대글자수 : [255자]; 이메일 |  | 이메일 |
| `phone` |  | 최대글자수 : [20자]; 전화번호 |  | 전화번호 |
| `homepage` |  | 최대글자수 : [255자] |  | 홈페이지 |
| `zipcode` |  |  |  | 우편번호 |
| `address1` |  | 최대글자수 : [255자] |  | 기본 주소 |
| `address2` |  | 최대글자수 : [255자] |  | 상세 주소 |
| `country_code` |  |  |  | 국가코드 |
| `use_manufacturer` |  |  |  | 사용여부 T : 사용함 · F : 사용안함 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "manufacturer": {
        "shop_no": 1,
        "manufacturer_code": "M000000A",
        "manufacturer_name": "Sample Manufacturer",
        "president_name": "Sample User",
        "email": "sample@sample.com",
        "phone": "010-000-0000",
        "homepage": "http://sample.com",
        "zipcode": "00000",
        "country_code": "KR",
        "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
        "address2": "Professional Construction Hall",
        "use_manufacturer": "T"
    }
}
```
