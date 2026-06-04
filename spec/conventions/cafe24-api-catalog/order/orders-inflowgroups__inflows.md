---
resource: order
entity: orders-inflowgroups__inflows
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders-inflowgroups--inflows
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders inflowgroups inflows

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders inflowgroups inflows](https://developers.cafe24.com/docs/ko/api/admin/#orders-inflowgroups--inflows)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

유입경로 그룹(Inflowgroups)은 주문이 유입된 경로의 그룹을 의미합니다. · 유입경로 그룹은 하위 리소스로 주문(Orders) 하위에서만 사용할 수 있습니다. · 유입경로 그룹에 대한 조회, 생성, 수정, 삭제가 가능합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `inflow_id` |  | 유입경로 그룹 멤버 아이디 |
| `inflow_name` |  | 유입경로 그룹 멤버 이름 |
| `inflow_icon` |  | 유입경로 아이콘 |
| `group_id` |  | 유입경로 그룹 아이디 |

## Operations

### `GET /api/v2/admin/orders/inflowgroups/{group_id}/inflows` — Retrieve a list of group traffic sources

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-group-traffic-sources

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `group_id` | ✓ | 최대글자수 : [40자] |  | 유입경로 그룹 아이디 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "inflows": [
        {
            "inflow_id": "edibot_social",
            "inflow_name": "EdibotSocial",
            "inflow_icon": "https://img.echosting.cafe24.com/icon/ico_route_cafe24.gif"
        },
        {
            "inflow_id": "sample_id",
            "inflow_name": "sample_name",
            "inflow_icon": "https://img.echosting.cafe24.com/icon/ico_route_cafe24.gif"
        }
    ]
}
```

### `POST /api/v2/admin/orders/inflowgroups/{group_id}/inflows` — Create a group traffic source

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-group-traffic-source

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `group_id` | ✓ | 최대글자수 : [40자] |  | 유입경로 그룹 아이디 |
| `inflow_id` | ✓ | 최대글자수 : [40자] |  | 유입경로 그룹 멤버 아이디 |
| `inflow_name` | ✓ | 최대글자수 : [100자] |  | 유입경로 그룹 멤버 이름 |
| `inflow_icon` | ✓ | URL; 최대글자수 : [500자] |  | 유입경로 아이콘 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "inflow": {
        "inflow_id": "edibot_social",
        "inflow_name": "EdibotSocial",
        "inflow_icon": "https://img.echosting.cafe24.com/icon/ico_route_cafe24.gif"
    }
}
```

### `PUT /api/v2/admin/orders/inflowgroups/{group_id}/inflows/{inflow_id}` — Update a group traffic source

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-group-traffic-source

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `group_id` | ✓ | 최대글자수 : [40자] |  | 유입경로 그룹 아이디 |
| `inflow_id` | ✓ | 최대글자수 : [40자] |  | 유입경로 그룹 멤버 아이디 |
| `inflow_name` | ✓ | 최대글자수 : [100자] |  | 유입경로 그룹 멤버 이름 |
| `inflow_icon` | ✓ | URL; 최대글자수 : [500자] |  | 유입경로 아이콘 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "inflow": {
        "inflow_id": "edibot_social",
        "inflow_name": "EdibotSocial",
        "inflow_icon": "https://img.echosting.cafe24.com/icon/ico_route_cafe24.gif"
    }
}
```

### `DELETE /api/v2/admin/orders/inflowgroups/{group_id}/inflows/{inflow_id}` — Delete a group traffic source

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-group-traffic-source

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `group_id` | ✓ | 최대글자수 : [40자] |  | 유입경로 그룹 아이디 |
| `inflow_id` | ✓ | 최대글자수 : [40자] |  | 유입경로 그룹 멤버 아이디 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "inflow": {
        "group_id": "cafe24",
        "inflow_id": "edibot_social"
    }
}
```
