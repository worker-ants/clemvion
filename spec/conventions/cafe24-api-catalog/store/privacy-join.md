---
resource: store
entity: privacy-join
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#privacy-join
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Privacy join

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Privacy join](https://developers.cafe24.com/docs/ko/api/admin/#privacy-join)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

이용약관 중 회원가입시점에 대한 개인정보처리방침을 조회할 수 있습니다

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `no` |  | 동의서 번호 |
| `name` |  | 동의서명 |
| `use` |  | 사용 여부 T: 사용함 · F: 사용안함 |
| `required` |  | 필수/선택 여부 T : 필수 · F : 선택 |
| `display` |  | 동의서 표시 화면 JOIN: 회원가입 · SIMPLE_ORDER_JOIN: 주문서 간단 회원가입 · SHOPPING_PAY_EASY_JOIN: 쇼핑페이 간편가입 |
| `content` |  | 동의서 내용 |

## Operations

### `GET /api/v2/admin/privacy/join` — Retrieve privacy policy for signup

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-privacy-policy-for-signup

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "join": [
        {
            "shop_no": 1,
            "no": 1,
            "name": "Agreement to Collection and Use of Personal Information (Required)",
            "use": "T",
            "required": "T",
            "display": [
                "JOIN",
                "SIMPLE_ORDER_JOIN"
            ],
            "content": "Content of agreement for collection and use of personal information has been modified."
        },
        {
            "shop_no": 1,
            "no": 2,
            "name": "Agreement to Collection and Use of Personal Information (Optional)",
            "use": "F",
            "required": "F",
            "display": [
                "JOIN",
                "SHOPPING_PAY_EASY_JOIN"
            ],
            "content": "This form is provided as a sample to help with shopping mall operation and requires modification according to the type of shopping mall operation."
        }
    ]
}
```

### `PUT /api/v2/admin/privacy/join` — Update privacy policy for signup

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 10
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-privacy-policy-for-signup

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `no` | ✓ | 최소값: [1] |  | 동의서 번호 |
| `use` |  |  |  | 사용 여부 T: 사용함 · F: 사용안함 |
| `required` |  |  |  | 필수/선택 여부 T : 필수 · F : 선택 |
| `display` |  |  |  | 동의서 표시 화면 JOIN: 회원가입 · SIMPLE_ORDER_JOIN: 주문서 간단 회원가입 · SHOPPING_PAY_EASY_JOIN: 쇼핑페이 간편가입 |
| `save_type` |  |  |  | 저장 방식 S: 표준 약관 적용 · C: 사용자 정의 약관 적용 |
| `content` |  |  |  | 동의서 내용 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "join": [
        {
            "shop_no": 1,
            "no": 1,
            "name": "Agreement to Collection and Use of Personal Information (Required)",
            "use": "T",
            "required": "T",
            "display": [
                "JOIN",
                "SIMPLE_ORDER_JOIN"
            ],
            "content": "Content of agreement for collection and use of personal information has been modified."
        },
        {
            "shop_no": 1,
            "no": 2,
            "name": "Agreement to Collection and Use of Personal Information (Optional)",
            "use": "F",
            "required": "F",
            "display": [
                "JOIN",
                "SHOPPING_PAY_EASY_JOIN"
            ],
            "content": "This form is provided as a sample to help with shopping mall operation and requires modification according to the type of shopping mall operation."
        }
    ]
}
```
