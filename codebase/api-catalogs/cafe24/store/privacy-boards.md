---
resource: store
entity: privacy-boards
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#privacy-boards
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Privacy boards

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Privacy boards](https://developers.cafe24.com/docs/ko/api/admin/#privacy-boards)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

이용약관 중 게시판 글 작성시점에 대한 개인정보처리방침을 조회할 수 있습니다

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `no` |  | 동의서 번호 |
| `name` |  | 동의서명 |
| `use` |  | 사용 여부 T: 사용함 · F: 사용안함 |
| `content` |  | 동의서 내용 |

## Operations

### `GET /api/v2/admin/privacy/boards` — Retrieve privacy policy for posting on board

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-privacy-policy-for-posting-on-board

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `boards` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `no` |  | 동의서 번호 |
| ↳ `name` |  | 동의서명 |
| ↳ `use` |  | 사용 여부 T: 사용함 · F: 사용안함 |
| ↳ `content` |  | 동의서 내용 |

응답 예시 (JSON):

```json
{
    "boards": [
        {
            "shop_no": 1,
            "no": 10,
            "name": "Privacy Policy Agreement for Guest Board Posts",
            "use": "F",
            "content": "This sample form is provided to help with shopping mall operations and needs to be modified according to the specific operational characteristics of your shopping mall before application."
        },
        {
            "shop_no": 1,
            "no": 11,
            "name": "Privacy Policy Agreement for Guest Bulk Order Inquiry",
            "use": "F",
            "content": "This sample form is provided to help with shopping mall operations and needs to be modified according to the specific operational characteristics of your shopping mall before application."
        }
    ]
}
```

### `PUT /api/v2/admin/privacy/boards` — Update privacy policy for posting on board

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 2
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-privacy-policy-for-posting-on-board

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `no` | ✓ | 최소값: [1] |  | 동의서 번호 |
| `use` |  |  |  | 사용 여부 T: 사용함 · F: 사용안함 |
| `save_type` |  |  |  | 저장 방식 S: 표준 약관 적용 · C: 사용자 정의 약관 적용 |
| `content` |  |  |  | 동의서 내용 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `boards` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `no` |  | 동의서 번호 |
| ↳ `name` |  | 동의서명 |
| ↳ `use` |  | 사용 여부 T: 사용함 · F: 사용안함 |
| ↳ `content` |  | 동의서 내용 |

응답 예시 (JSON):

```json
{
    "boards": [
        {
            "shop_no": 1,
            "no": 10,
            "name": "Privacy Policy Agreement for Guest Board Posts",
            "use": "F",
            "content": "This sample form is provided to help with shopping mall operations and needs to be modified according to the specific operational characteristics of your shopping mall before application."
        },
        {
            "shop_no": 1,
            "no": 11,
            "name": "Privacy Policy Agreement for Guest Bulk Order Inquiry",
            "use": "F",
            "content": "This sample form is provided to help with shopping mall operations and needs to be modified according to the specific operational characteristics of your shopping mall before application."
        }
    ]
}
```
