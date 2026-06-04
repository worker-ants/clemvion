---
resource: collection
entity: origin
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#origin
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Collection / Origin

> Field-level 카탈로그. Endpoint enumeration index: [`../collection.md`](../collection.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Origin](https://developers.cafe24.com/docs/ko/api/admin/#origin)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

원산지(Origin)는 상품정보에 포함되는 데이터로 상품이 생산된 지역을 의미합니다. · 원산지는 국외 배송 등 경우에 따라 중요한 데이터가 될 수 있습니다. · 카페24는 다양한 원산지가 코드화 되어있으며, 원산지 조회 API(List all origin)를 통해 원산지 코드 정보를 확인할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `origin_place_no` |  | 원산지 번호 |
| `origin_place_name` |  | 원산지 이름 |
| `foreign` |  | 해외 여부 |
| `made_in_code` |  | 원산지 국가코드 |

## Operations

### `GET /api/v2/admin/origin` — Retrieve a list of origins

- **Scope**: `mall.read_collection` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-origins

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `origin_place_no` |  |  |  | 원산지 번호 |
| `origin_place_name` |  | 최대글자수 : [50자] |  | 원산지 이름 |
| `foreign` |  |  |  | 해외 여부 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 조회하고자 하는 최대 건수를 지정할 수 있음. · 예) 10 입력시 10건만 표시함. |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `origin` |  | (목록) |
| ↳ `origin_place_no` |  | 원산지 번호 |
| ↳ `origin_place_name` |  | 원산지 이름 |
| ↳ `foreign` |  | 해외 여부 |
| ↳ `made_in_code` |  | 원산지 국가코드 |

응답 예시 (JSON):

```json
{
    "origin": [
        {
            "origin_place_no": "1",
            "origin_place_name": [
                "Gangwon",
                "Gangneung-si"
            ],
            "foreign": "F",
            "made_in_code": "KR"
        },
        {
            "origin_place_no": "2",
            "origin_place_name": [
                "Gangwon",
                "Goseong-gun"
            ],
            "foreign": "F",
            "made_in_code": "KR"
        }
    ]
}
```
