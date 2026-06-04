---
resource: order
entity: orders-inflowgroups
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders-inflowgroups
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders inflowgroups

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders inflowgroups](https://developers.cafe24.com/docs/ko/api/admin/#orders-inflowgroups)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

유입경로 그룹(Inflowgroups)은 주문이 유입된 경로의 그룹을 의미합니다. · 유입경로 그룹은 하위 리소스로 주문(Orders) 하위에서만 사용할 수 있습니다. · 유입경로 그룹에 대한 조회, 생성, 수정, 삭제가 가능합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `inflow_group_id` |  | 유입경로 그룹 아이디 |
| `inflow_group_name` |  | 유입경로 그룹 이름 |

## Operations

### `GET /api/v2/admin/orders/inflowgroups` — Retrieve a list of traffic source groups

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-traffic-source-groups

_요청 파라미터 없음._

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `inflowgroups` |  | (목록) |
| ↳ `inflow_group_id` |  | 유입경로 그룹 아이디 |
| ↳ `inflow_group_name` |  | 유입경로 그룹 이름 |

응답 예시 (JSON):

```json
{
    "inflowgroups": [
        {
            "inflow_group_id": "cafe24",
            "inflow_group_name": "Cafe24"
        },
        {
            "inflow_group_id": "gmarket",
            "inflow_group_name": "Gmarket"
        }
    ]
}
```

### `POST /api/v2/admin/orders/inflowgroups` — Create a traffic source group

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-traffic-source-group

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `inflow_group_id` | ✓ | 최대글자수 : [40자]; 형식 : [a-zA-Z0-9] |  | 유입경로 그룹 아이디 |
| `inflow_group_name` | ✓ | 최대글자수 : [100자] |  | 유입경로 그룹 이름 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `inflowgroup` |  | (응답 객체) |
| ↳ `inflow_group_id` |  | 유입경로 그룹 아이디 |
| ↳ `inflow_group_name` |  | 유입경로 그룹 이름 |

응답 예시 (JSON):

```json
{
    "inflowgroup": {
        "inflow_group_id": "cafe24",
        "inflow_group_name": "Cafe24"
    }
}
```

### `PUT /api/v2/admin/orders/inflowgroups/{inflow_group_id}` — Update a traffic source group

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-traffic-source-group

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `inflow_group_id` | ✓ | 형식 : [a-zA-Z0-9]; 최대글자수 : [40자] |  | 유입경로 그룹 아이디 |
| `inflow_group_name` | ✓ | 최대글자수 : [100자] |  | 유입경로 그룹 이름 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `inflowgroup` |  | (응답 객체) |
| ↳ `inflow_group_id` |  | 유입경로 그룹 아이디 |
| ↳ `inflow_group_name` |  | 유입경로 그룹 이름 |

응답 예시 (JSON):

```json
{
    "inflowgroup": {
        "inflow_group_id": "cafe24",
        "inflow_group_name": "Cafe24"
    }
}
```

### `DELETE /api/v2/admin/orders/inflowgroups/{inflow_group_id}` — Delete a traffic source group

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-traffic-source-group

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `inflow_group_id` | ✓ | 최대글자수 : [40자]; 형식 : [a-zA-Z0-9] |  | 유입경로 그룹 아이디 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `inflowgroup` |  | (응답 객체) |
| ↳ `inflow_group_id` |  | 유입경로 그룹 아이디 |

응답 예시 (JSON):

```json
{
    "inflowgroup": {
        "inflow_group_id": "cafe24"
    }
}
```
