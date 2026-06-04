---
resource: store
entity: activitylogs
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#activitylogs
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Activitylogs

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Activitylogs](https://developers.cafe24.com/docs/ko/api/admin/#activitylogs)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

활동로그(Activitylog)는 쇼핑몰 관리자가 쇼핑몰 어드민에서 진행한 운영 활동을 기록한 내역입니다. · 활동로그 리소스를 사용하면 쇼핑몰의 활동로그를 생성하거나 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `process_no` |  | 업무처리 넘버 |
| `mode` |  | 모드 P : PC 어드민 · M : 모바일 어드민 · S : (구)스마트모드 |
| `type` |  | 구분 |
| `content` |  | 업무내용 |
| `process_date` |  | 처리일시 |
| `manager_id` | 형식 : [a-z0-9]; 글자수 최소: [4자]~최대: [16자] | 처리자 |
| `manager_type` |  | 처리자 타입 |

## Operations

### `GET /api/v2/admin/activitylogs` — Retrieve a list of action logs

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-action-logs

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `manager_type` |  |  |  | 처리자 타입 P : 대표운영자 · A : 부운영자 · S : 공급사 |
| `manager_id` |  | 형식 : [a-z0-9]; 글자수 최소: [4자]~최대: [16자] |  | 처리자 |
| `mode` |  |  |  | 모드 P : PC 어드민 · M : 모바일 어드민 · S : (구)스마트모드 |
| `type` |  |  |  | 구분 |
| `content` |  | 최대글자수 : [500자] |  | 업무내용 |
| `start_date` | ✓ | 날짜 |  | 검색 시작일 |
| `end_date` | ✓ | 날짜 |  | 검색 종료일 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `activitylogs` |  | (목록) |
| ↳ `process_no` |  | 업무처리 넘버 |
| ↳ `mode` |  | 모드 P : PC 어드민 · M : 모바일 어드민 · S : (구)스마트모드 |
| ↳ `type` |  | 구분 |
| ↳ `content` |  | 업무내용 |
| ↳ `process_date` |  | 처리일시 |
| ↳ `manager_id` | 형식 : [a-z0-9]; 글자수 최소: [4자]~최대: [16자] | 처리자 |
| ↳ `manager_type` |  | 처리자 타입 |
| `links` |  | link |
| ↳ `rel` |  |  |
| ↳ `href` |  |  |

응답 예시 (JSON):

```json
{
    "activitylogs": [
        {
            "process_no": 130,
            "mode": "P",
            "type": "product management > product management > product list",
            "content": "Edit product name",
            "process_date": "2020-02-01T00:00:00+09:00",
            "manager_id": "sampleid",
            "manager_type": "representative operator"
        },
        {
            "process_no": 131,
            "mode": "P",
            "type": "product management > product management > product list",
            "content": "Edit product name",
            "process_date": "2020-02-02T00:00:00+09:00",
            "manager_id": "sampleid",
            "manager_type": "representative operator"
        }
    ],
    "links": [
        {
            "rel": "next",
            "href": "https://{mallid}.cafe24api.com/api/v2/admin/activitylogs?limit=10&offset=10"
        }
    ]
}
```

### `GET /api/v2/admin/activitylogs/{process_no}` — Retrieve an action log

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-action-log

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `process_no` | ✓ |  |  | 업무처리 넘버 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `activitylog` |  | (응답 객체) |
| ↳ `process_no` |  | 업무처리 넘버 |
| ↳ `type` |  | 구분 |
| ↳ `manager_id` | 형식 : [a-z0-9]; 글자수 최소: [4자]~최대: [16자] | 처리자 |
| ↳ `manager_type` |  | 처리자 타입 |
| ↳ `process_date` |  | 처리일시 |
| ↳ `content` |  | 업무내용 |

응답 예시 (JSON):

```json
{
    "activitylog": {
        "process_no": 130,
        "type": "product management > product management > product list",
        "manager_id": "sampleid",
        "manager_type": "representative operator",
        "process_date": "2020-02-01T00:00:00+09:00",
        "content": "Edit product name"
    }
}
```
