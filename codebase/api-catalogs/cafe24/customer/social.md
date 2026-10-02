---
resource: customer
entity: social
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#social
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Customer / Social

> Field-level 카탈로그. Endpoint enumeration index: [`../customer.md`](../customer.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Social](https://developers.cafe24.com/docs/ko/api/admin/#social)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

회원들의 SNS(social)는 전체 회원에게 연동된 SNS 계정의 정보를 조회할 수 있는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `member_id` |  | 회원아이디 |
| `social_name` |  | 연동 된 SNS명 |
| `social_member_code` |  | 연동 된 SNS 제공코드 |
| `linked_date` |  | 연동 날짜 |

## Operations

### `GET /api/v2/admin/social` — List all social

- **Scope**: `mall.read_customer` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#list-all-social

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `social_name` |  |  |  | 연동 된 SNS명 |
| `linked_start_date` |  | 날짜 |  | 연동 날짜 검색 시작일 |
| `linked_end_date` |  | 날짜 |  | 연동 날짜 검색 종료일 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `social` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `member_id` |  | 회원아이디 |
| ↳ `social_name` |  | 연동 된 SNS명 |
| ↳ `social_member_code` |  | 연동 된 SNS 제공코드 |
| ↳ `linked_date` |  | 연동 날짜 |
| `links` |  | link |
| ↳ `rel` |  |  |
| ↳ `href` |  |  |

응답 예시 (JSON):

```json
{
    "social": [
        {
            "shop_no": 1,
            "member_id": "sampleid",
            "social_name": "line",
            "social_member_code": "U1e0014229a08c2f95e12ee29904da597",
            "linked_date": "2024-02-18T13:03:11+09:00"
        },
        {
            "shop_no": 1,
            "member_id": "sampleid2",
            "social_name": "kakao",
            "social_member_code": "U2f1125330b19d3g06f23ff30015eb608",
            "linked_date": "2026-05-10T09:00:00+09:00"
        }
    ],
    "links": [
        {
            "rel": "next",
            "href": "https://{mallid}.cafe24api.com/api/v2/admin/social?limit=10&offset=10"
        }
    ]
}
```
