---
resource: order
entity: orders-saleschannels
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders-saleschannels
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders saleschannels

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders saleschannels](https://developers.cafe24.com/docs/ko/api/admin/#orders-saleschannels)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문 판매채널(Orders saleschannels)은 통해 주문의 판매처의 조회, 등록, 수정, 삭제를 할 수 있습니다. · 주문 판매채널은 하위 리소스로 주문(Orders) 하위에서만 사용할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `sales_channel_id` |  | 판매처 아이디 |
| `sales_channel_name` |  | 판매처 이름 |
| `sales_channel_icon` |  | 판매처 아이콘 |

## Operations

### `GET /api/v2/admin/orders/saleschannels` — Retrieve a list of sales channels

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-sales-channels

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `limit` |  | 최소: [1]~최대: [500] | 10 | 조회결과 최대건수 |
| `offset` |  | 최대값: [10000] | 0 | 조회결과 시작위치 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "saleschannels": [
        {
            "sales_channel_id": "MORUGI",
            "sales_channel_name": "MORUGI",
            "sales_channel_icon": "https://img.echosting.cafe24.com/icon/ico_route_morugi.jpg"
        },
        {
            "sales_channel_id": "gmarket",
            "sales_channel_name": "gmarket",
            "sales_channel_icon": "https://img.echosting.cafe24.com/icon/ico_route_gmarket.jpg"
        }
    ]
}
```

### `POST /api/v2/admin/orders/saleschannels` — Create a sales channel

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-sales-channel

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `sales_channel_id` | ✓ | 최대글자수 : [40자]; 형식 : [a-zA-Z0-9] |  | 판매처 아이디 |
| `sales_channel_name` | ✓ | 최대글자수 : [100자] |  | 판매처 이름 |
| `sales_channel_icon` | ✓ | URL; 최대글자수 : [500자] |  | 판매처 아이콘 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "saleschannel": {
        "sales_channel_id": "MORUGI",
        "sales_channel_name": "MORUGI",
        "sales_channel_icon": "https://img.echosting.cafe24.com/icon/ico_route_morugi.jpg"
    }
}
```

### `PUT /api/v2/admin/orders/saleschannels/{sales_channel_id}` — Update a sales channel

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-sales-channel

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `sales_channel_id` | ✓ | 최대글자수 : [40자]; 형식 : [a-zA-Z0-9] |  | 판매처 아이디 |
| `sales_channel_name` |  | 최대글자수 : [100자] |  | 판매처 이름 |
| `sales_channel_icon` |  | URL; 최대글자수 : [500자] |  | 판매처 아이콘 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "saleschannel": {
        "sales_channel_id": "MORUGI",
        "sales_channel_name": "MORUGI",
        "sales_channel_icon": "https://img.echosting.cafe24.com/icon/ico_route_morugi.jpg"
    }
}
```

### `DELETE /api/v2/admin/orders/saleschannels/{sales_channel_id}` — Delete a sales channel

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-sales-channel

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `sales_channel_id` | ✓ | 최대글자수 : [40자]; 형식 : [a-zA-Z0-9] |  | 판매처 아이디 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "saleschannel": {
        "sales_channel_id": "MORUGI"
    }
}
```
