---
resource: customer
entity: customers-properties
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#customers-properties
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Customer / Customers properties

> Field-level 카탈로그. Endpoint enumeration index: [`../customer.md`](../customer.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Customers properties](https://developers.cafe24.com/docs/ko/api/admin/#customers-properties)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

회원가입항목 설정을 관리 할 수 있습니다. 기본회원가입항목, 상세회원가입항목 사용여부 확인이 가능하며 회원가입 시 필요항목 및 추가항목(생년월일, 결혼기념일, 배우자 생일 등) 설정을 조회하거나 수정할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `type` |  | 회원가입항목 유형 |
| `properties` |  | 항목 |

## Operations

### `GET /api/v2/admin/customers/properties` — View account signup fields

- **Scope**: `mall.read_customer` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#view-account-signup-fields

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `type` |  |  | join | 회원가입항목 유형 join:회원가입 항목 · edit:회원정보 수정 항목 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `customer` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `type` |  | 회원가입항목 유형 |
| ↳ `properties` |  | 항목 |
| ↳ ↳ `key` |  |  |
| ↳ ↳ `name` |  |  |
| ↳ ↳ `use` |  |  |
| ↳ ↳ `required` |  |  |

응답 예시 (JSON):

```json
{
    "customer": {
        "shop_no": 1,
        "type": "join",
        "properties": [
            {
                "key": "sms_agree",
                "name": "SMS subscription",
                "use": "T",
                "required": "T"
            },
            {
                "key": "email_agree",
                "name": "Email subscription",
                "use": "T",
                "required": "T"
            }
        ]
    }
}
```

### `PUT /api/v2/admin/customers/properties` — Edit account signup fields

- **Scope**: `mall.write_customer` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#edit-account-signup-fields

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `type` | ✓ |  |  | 회원가입항목 유형 join:회원가입 항목 · edit:회원정보 수정 항목 |
| `properties` |  |  |  | 항목 |
| ↳ `key` |  |  |  | 항목키 |
| ↳ `use` |  |  |  | 일반 회원가입 사용여부 · T:사용 · F:사용안함 |
| ↳ `required` |  |  |  | 필수입력여부 · T:필수 · F:선택 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `customer` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `type` |  | 회원가입항목 유형 |
| ↳ `properties` |  | 항목 |
| ↳ ↳ `key` |  |  |
| ↳ ↳ `name` |  |  |
| ↳ ↳ `use` |  |  |
| ↳ ↳ `required` |  |  |

응답 예시 (JSON):

```json
{
    "customer": {
        "shop_no": 1,
        "type": "join",
        "properties": [
            {
                "key": "sms_agree",
                "name": "SMS subscription",
                "use": "T",
                "required": "T"
            },
            {
                "key": "birthday",
                "name": "Date of birth",
                "use": "T",
                "required": "T"
            }
        ]
    }
}
```
