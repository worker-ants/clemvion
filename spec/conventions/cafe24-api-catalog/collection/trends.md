---
resource: collection
entity: trends
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#trends
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Collection / Trends

> Field-level 카탈로그. Endpoint enumeration index: [`../collection.md`](../collection.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Trends](https://developers.cafe24.com/docs/ko/api/admin/#trends)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

트렌드(Trends)는 상품의 "제작정보" 중 트렌드에 해당하는 정보에 대한 기능입니다. · 트렌드는 상품을 구분하는 판매분류의 하나이며, 상품은 반드시 하나의 트렌드를 갖고 있습니다.(미지정시 "기본트렌드"를 사용함)

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `trend_code` | 형식 : [A-Z0-9]; 글자수 최소: [8자]~최대: [8자] | 트렌드 코드 |
| `trend_name` | 최대글자수 : [50자] | 트렌드 명 |
| `use_trend` |  | 트렌드 사용여부 T : 사용함 · F : 사용안함 |
| `created_date` |  | 생성일 |
| `product_count` |  | 상품수 |

## Operations

### `GET /api/v2/admin/trends` — Retrieve a list of trends

- **Scope**: `mall.read_collection` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-trends

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `trend_code` |  |  |  | 트렌드 코드 ,(콤마)로 여러 건을 검색할 수 있다. |
| `trend_name` |  |  |  | 트렌드 명 ,(콤마)로 여러 건을 검색할 수 있다. |
| `use_trend` |  |  |  | 트렌드 사용여부 T : 사용함 · F : 사용안함 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 조회하고자 하는 최대 건수를 지정할 수 있음. · 예) 10 입력시 10건만 표시함. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "trends": [
        {
            "shop_no": 1,
            "trend_code": "T0000000",
            "trend_name": "Default Trend",
            "use_trend": "T",
            "created_date": "2019-10-21T15:25:35+09:00",
            "product_count": 2
        },
        {
            "shop_no": 1,
            "trend_code": "T000000A",
            "trend_name": "Default Trend",
            "use_trend": "F",
            "created_date": "2019-10-21T15:25:35+09:00",
            "product_count": 3
        }
    ]
}
```

### `GET /api/v2/admin/trends/count` — Retrieve a count of trends

- **Scope**: `mall.read_collection` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-trends

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `trend_code` |  |  |  | 트렌드 코드 ,(콤마)로 여러 건을 검색할 수 있다. |
| `trend_name` |  |  |  | 트렌드 명 ,(콤마)로 여러 건을 검색할 수 있다. |
| `use_trend` |  |  |  | 트렌드 사용여부 T : 사용함 · F : 사용안함 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "count": 2
}
```
