---
resource: store
entity: redirects
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#redirects
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Redirects

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Redirects](https://developers.cafe24.com/docs/ko/api/admin/#redirects)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

특정 URL로 접속 했을때, 설정한 URL로 리다이렉트할 수 있는 리소스입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` | 최소값: [1]; 최대값: [2147483647] | 멀티쇼핑몰 번호 |
| `id` | 최대값: [2147483647] | 리다이렉트 아이디 |
| `path` |  | 리다이렉트 경로 |
| `target` |  | 대상 위치 |

## Operations

### `GET /api/v2/admin/redirects` — Retrieve a list of redirects

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 10
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-redirects

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1]; 최대값: [2147483647] | 1 | 멀티쇼핑몰 번호 |
| `id` |  | 최소값: [1]; 최대값: [2147483647] |  | 리다이렉트 아이디 |
| `path` |  |  |  | 리다이렉트 경로 |
| `target` |  |  |  | 대상 위치 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `redirects` |  | (목록) |
| ↳ `shop_no` | 최소값: [1]; 최대값: [2147483647] | 멀티쇼핑몰 번호 |
| ↳ `id` | 최대값: [2147483647] | 리다이렉트 아이디 |
| ↳ `path` |  | 리다이렉트 경로 |
| ↳ `target` |  | 대상 위치 |

응답 예시 (JSON):

```json
{
    "redirects": [
        {
            "shop_no": 1,
            "id": 1,
            "path": "/cafe24",
            "target": "https://www.cafe24.com"
        },
        {
            "shop_no": 1,
            "id": 2,
            "path": "/developers",
            "target": "https://developers.cafe24.com"
        }
    ]
}
```

### `POST /api/v2/admin/redirects` — Create a redirect

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 10
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-redirect

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1]; 최대값: [2147483647] | 1 | 멀티쇼핑몰 번호 |
| `path` | ✓ |  |  | 리다이렉트 경로 |
| `target` | ✓ |  |  | 대상 위치 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `redirects` |  | (응답 객체) |
| ↳ `shop_no` | 최소값: [1]; 최대값: [2147483647] | 멀티쇼핑몰 번호 |
| ↳ `id` | 최대값: [2147483647] | 리다이렉트 아이디 |
| ↳ `path` |  | 리다이렉트 경로 |
| ↳ `target` |  | 대상 위치 |

응답 예시 (JSON):

```json
{
    "redirects": {
        "shop_no": 1,
        "id": 1,
        "path": "/cafe24",
        "target": "https://www.cafe24.com"
    }
}
```

### `PUT /api/v2/admin/redirects/{id}` — Update a redirect

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 10
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-redirect

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1]; 최대값: [2147483647] | 1 | 멀티쇼핑몰 번호 |
| `id` | ✓ | 최소값: [1]; 최대값: [2147483647] |  | 리다이렉트 아이디 |
| `path` |  |  |  | 리다이렉트 경로 |
| `target` |  |  |  | 대상 위치 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `redirects` |  | (응답 객체) |
| ↳ `shop_no` | 최소값: [1]; 최대값: [2147483647] | 멀티쇼핑몰 번호 |
| ↳ `id` | 최대값: [2147483647] | 리다이렉트 아이디 |
| ↳ `path` |  | 리다이렉트 경로 |
| ↳ `target` |  | 대상 위치 |

응답 예시 (JSON):

```json
{
    "redirects": {
        "shop_no": 1,
        "id": 1,
        "path": "/cafe24",
        "target": "https://www.cafe24.com"
    }
}
```

### `DELETE /api/v2/admin/redirects/{id}` — Delete a redirect

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 10
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-redirect

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1]; 최대값: [2147483647] | 1 | 멀티쇼핑몰 번호 |
| `id` | ✓ | 최소값: [1]; 최대값: [2147483647] |  | 리다이렉트 아이디 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `redirects` |  | (응답 객체) |
| ↳ `shop_no` | 최소값: [1]; 최대값: [2147483647] | 멀티쇼핑몰 번호 |
| ↳ `id` | 최대값: [2147483647] | 리다이렉트 아이디 |

응답 예시 (JSON):

```json
{
    "redirects": {
        "shop_no": 1,
        "id": 1
    }
}
```
