---
resource: collection
entity: brands
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#brands
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Collection / Brands

> Field-level 카탈로그. Endpoint enumeration index: [`../collection.md`](../collection.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Brands](https://developers.cafe24.com/docs/ko/api/admin/#brands)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

브랜드(Brands)는 쇼핑몰 상품의 "브랜드"를 나타냅니다. · 브랜드는 쇼핑몰의 상품을 구분하는 판매분류의 하나로, 상품은 반드시 하나의 브랜드를 갖고 있습니다. · 브랜드가 미지정된 경우 "자체브랜드"를 사용합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. DEFAULT 1 |
| `brand_code` |  | 브랜드 코드 |
| `brand_name` | 최대글자수 : [50자] | 브랜드 명 |
| `use_brand` |  | 브랜드 사용여부 T : 사용함 · F : 사용안함 |
| `search_keyword` | 최대글자수 : [200자] | 검색어 설정 |
| `product_count` |  | 상품수 |
| `created_date` |  | 생성일 |

## Operations

### `GET /api/v2/admin/brands` — Retrieve a list of brands

- **Scope**: `mall.read_collection` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-brands

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `brand_code` |  |  |  | 브랜드 코드 ,(콤마)로 여러 건을 검색할 수 있다. |
| `brand_name` |  |  |  | 브랜드 명 ,(콤마)로 여러 건을 검색할 수 있다. |
| `use_brand` |  |  |  | 브랜드 사용여부 T : 사용함 · F : 사용안함 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 조회하고자 하는 최대 건수를 지정할 수 있음. · 예) 10 입력시 10건만 표시함. |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `brands` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. DEFAULT 1 |
| ↳ `brand_code` |  | 브랜드 코드 |
| ↳ `brand_name` | 최대글자수 : [50자] | 브랜드 명 |
| ↳ `use_brand` |  | 브랜드 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `search_keyword` | 최대글자수 : [200자] | 검색어 설정 |
| ↳ `product_count` |  | 상품수 |
| ↳ `created_date` |  | 생성일 |

응답 예시 (JSON):

```json
{
    "brands": [
        {
            "shop_no": 1,
            "brand_code": "B0000000",
            "brand_name": "Default Brand",
            "use_brand": "T",
            "search_keyword": "keyword",
            "product_count": 2,
            "created_date": "2017-12-19T14:39:22+09:00"
        },
        {
            "shop_no": 1,
            "brand_code": "B000000A",
            "brand_name": "Default Brand",
            "use_brand": "F",
            "search_keyword": "keyword",
            "product_count": 3,
            "created_date": "2017-12-19T14:39:22+09:00"
        }
    ]
}
```

### `GET /api/v2/admin/brands/count` — Retrieve a count of brands

- **Scope**: `mall.read_collection` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-brands

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `brand_code` |  |  |  | 브랜드 코드 ,(콤마)로 여러 건을 검색할 수 있다. |
| `brand_name` |  |  |  | 브랜드 명 ,(콤마)로 여러 건을 검색할 수 있다. |
| `use_brand` |  |  |  | 브랜드 사용여부 T : 사용함 · F : 사용안함 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `count` |  |  |

응답 예시 (JSON):

```json
{
    "count": 2
}
```

### `POST /api/v2/admin/brands` — Create a brand

- **Scope**: `mall.write_collection` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-brand

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `brand_name` | ✓ |  |  | 브랜드 명 |
| `use_brand` |  |  | T | 브랜드 사용여부 T : 사용함 · F : 사용안함 |
| `search_keyword` |  | 최대글자수 : [200자] |  | 검색어 설정 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `brand` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. DEFAULT 1 |
| ↳ `brand_code` |  | 브랜드 코드 |
| ↳ `brand_name` | 최대글자수 : [50자] | 브랜드 명 |
| ↳ `use_brand` |  | 브랜드 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `search_keyword` | 최대글자수 : [200자] | 검색어 설정 |
| ↳ `created_date` |  | 생성일 |

응답 예시 (JSON):

```json
{
    "brand": {
        "shop_no": 1,
        "brand_code": "B000000A",
        "brand_name": "Sample Brand",
        "use_brand": "T",
        "search_keyword": "keyword",
        "created_date": "2017-12-19T14:39:22+09:00"
    }
}
```

### `PUT /api/v2/admin/brands/{brand_code}` — Update a brand

- **Scope**: `mall.write_collection` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-brand

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `brand_code` | ✓ | 형식 : [A-Z0-9]; 글자수 최소: [8자]~최대: [8자] |  | 브랜드 코드 |
| `brand_name` |  |  |  | 브랜드 명 |
| `use_brand` |  |  | T | 브랜드 사용여부 T : 사용함 · F : 사용안함 |
| `search_keyword` |  | 최대글자수 : [200자] |  | 검색어 설정 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `brand` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. DEFAULT 1 |
| ↳ `brand_code` |  | 브랜드 코드 |
| ↳ `brand_name` | 최대글자수 : [50자] | 브랜드 명 |
| ↳ `use_brand` |  | 브랜드 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `search_keyword` | 최대글자수 : [200자] | 검색어 설정 |
| ↳ `created_date` |  | 생성일 |

응답 예시 (JSON):

```json
{
    "brand": {
        "shop_no": 1,
        "brand_code": "B000000A",
        "brand_name": "Sample Brand",
        "use_brand": "T",
        "search_keyword": "keyword",
        "created_date": "2017-12-19T14:39:22+09:00"
    }
}
```

### `DELETE /api/v2/admin/brands/{brand_code}` — Delete a brand

- **Scope**: `mall.write_collection` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-brand

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `brand_code` | ✓ | 형식 : [A-Z0-9]; 글자수 최소: [8자]~최대: [8자] |  | 브랜드 코드 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `brand` |  | (응답 객체) |
| ↳ `brand_code` |  | 브랜드 코드 |

응답 예시 (JSON):

```json
{
    "brand": {
        "brand_code": "B000000A"
    }
}
```
