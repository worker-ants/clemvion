---
resource: collection
entity: classifications
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#classifications
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
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
