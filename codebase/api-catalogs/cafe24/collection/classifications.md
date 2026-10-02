---
resource: collection
entity: classifications
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#classifications
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Collection / Classifications

> Field-level 카탈로그. Endpoint enumeration index: [`../collection.md`](../collection.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Classifications](https://developers.cafe24.com/docs/ko/api/admin/#classifications)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

자체분류(Classifications)는 상품등록시 사용할 자체분류에 입력하는 정보를 의미합니다. · 자체분류는 상품을 구분하는 판매분류의 하나이며, 상품은 반드시 하나의 자체분류를 가지고 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `classification_code` | 형식 : [A-Z0-9]; 최소글자수 : [8자]; 최대글자수 : [8자] | 자체분류 코드 |
| `classification_name` | 최대글자수 : [200자] | 자체분류 명 |
| `classification_description` | 최대글자수 : [300자] | 자체분류 설명 |
| `use_classification` |  | 사용여부 |
| `created_date` |  | 생성일 |
| `product_count` |  | 상품수 |

## Operations

### `GET /api/v2/admin/classifications` — Retrieve a list of custom categories

- **Scope**: `mall.read_collection` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-custom-categories

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `classification_code` |  |  |  | 자체분류 코드 ,(콤마)로 여러 건을 검색할 수 있다. |
| `classification_name` |  |  |  | 자체분류 명 ,(콤마)로 여러 건을 검색할 수 있다. |
| `use_classification` |  |  |  | 사용여부 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 조회하고자 하는 최대 건수를 지정할 수 있음. · 예) 10 입력시 10건만 표시함. |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `classifications` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| ↳ `classification_code` | 형식 : [A-Z0-9]; 최소글자수 : [8자]; 최대글자수 : [8자] | 자체분류 코드 |
| ↳ `classification_name` | 최대글자수 : [200자] | 자체분류 명 |
| ↳ `classification_description` | 최대글자수 : [300자] | 자체분류 설명 |
| ↳ `use_classification` |  | 사용여부 |
| ↳ `created_date` |  | 생성일 |
| ↳ `product_count` |  | 상품수 |

응답 예시 (JSON):

```json
{
    "classifications": [
        {
            "shop_no": 1,
            "classification_code": "C000000A",
            "classification_name": "Default Classification",
            "classification_description": "Default Classification description",
            "use_classification": "T",
            "created_date": "2018-01-16T12:00:41+09:00",
            "product_count": 2
        },
        {
            "shop_no": 1,
            "classification_code": "C000000B",
            "classification_name": "Classification 1",
            "classification_description": "Classification 1 description",
            "use_classification": "T",
            "created_date": "2018-01-16T12:00:41+09:00",
            "product_count": 3
        }
    ]
}
```

### `GET /api/v2/admin/classifications/count` — Retrieve a count of custom categories

- **Scope**: `mall.read_collection` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-custom-categories

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `classification_code` |  |  |  | 자체분류 코드 ,(콤마)로 여러 건을 검색할 수 있다. |
| `classification_name` |  |  |  | 자체분류 명 ,(콤마)로 여러 건을 검색할 수 있다. |
| `use_classification` |  |  |  | 사용여부 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `count` |  |  |

응답 예시 (JSON):

```json
{
    "count": 3
}
```
