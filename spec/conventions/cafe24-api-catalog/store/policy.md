---
resource: store
entity: policy
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#policy
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Policy

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Policy](https://developers.cafe24.com/docs/ko/api/admin/#policy)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

쇼핑몰 이용약관 및 개인정보처리방침 약관의 정보를 관리합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `privacy_all` |  | 개인정보처리방침 전체내용 |
| `terms_using_mall` |  | 쇼핑몰 이용약관 |
| `use_privacy_join` |  | 회원가입 개인정보처리방침 사용 여부 T: 사용함 · F: 사용안함 |
| `privacy_join` |  | 회원가입 개인정보처리방침 내용 |
| `use_withdrawal` |  | 청약철회방침 사용여부 T: 사용함 · F: 사용안함 |
| `required_withdrawal` |  | 청약철회방침 사용자 동의 필수 여부 T : 필수 · F : 선택 |
| `withdrawal` |  | 청약철회방침 내용 |

## Operations

### `GET /api/v2/admin/policy` — Retrieve a store profile

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-store-profile

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `policy` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `privacy_all` |  | 개인정보처리방침 전체내용 |
| ↳ `terms_using_mall` |  | 쇼핑몰 이용약관 |
| ↳ `use_privacy_join` |  | 회원가입 개인정보처리방침 사용 여부 T: 사용함 · F: 사용안함 |
| ↳ `privacy_join` |  | 회원가입 개인정보처리방침 내용 |
| ↳ `use_withdrawal` |  | 청약철회방침 사용여부 T: 사용함 · F: 사용안함 |
| ↳ `required_withdrawal` |  | 청약철회방침 사용자 동의 필수 여부 T : 필수 · F : 선택 |
| ↳ `withdrawal` |  | 청약철회방침 내용 |

응답 예시 (JSON):

```json
{
    "policy": {
        "shop_no": 1,
        "privacy_all": "<p>** This form is intended to assist in the operation...",
        "terms_using_mall": "<p>**This form is provided by the Fair Trade Commission...",
        "use_privacy_join": "T",
        "privacy_join": "<p>1. Purposes of Collection and Use of Personal Information...",
        "use_withdrawal": "T",
        "required_withdrawal": "T",
        "withdrawal": "<p>Withdrawal Policy Agreement...</p>"
    }
}
```

### `PUT /api/v2/admin/policy` — Update a store profile

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-store-profile

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `save_type` |  |  | S | 저장 방식 S: 표준 약관 적용 · C: 사용자 정의 약관 적용 |
| `privacy_all` |  |  |  | 개인정보처리방침 전체내용 |
| `terms_using_mall` |  |  |  | 쇼핑몰 이용약관 |
| `use_privacy_join` |  |  |  | 회원가입 개인정보처리방침 사용 여부 T: 사용함 · F: 사용안함 |
| `privacy_join` |  |  |  | 회원가입 개인정보처리방침 내용 |
| `use_withdrawal` |  |  |  | 청약철회방침 사용여부 T: 사용함 · F: 사용안함 |
| `required_withdrawal` |  |  |  | 청약철회방침 사용자 동의 필수 여부 T : 필수 · F : 선택 |
| `withdrawal` |  |  |  | 청약철회방침 내용 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `policy` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `privacy_all` |  | 개인정보처리방침 전체내용 |
| ↳ `terms_using_mall` |  | 쇼핑몰 이용약관 |
| ↳ `use_privacy_join` |  | 회원가입 개인정보처리방침 사용 여부 T: 사용함 · F: 사용안함 |
| ↳ `privacy_join` |  | 회원가입 개인정보처리방침 내용 |
| ↳ `use_withdrawal` |  | 청약철회방침 사용여부 T: 사용함 · F: 사용안함 |
| ↳ `required_withdrawal` |  | 청약철회방침 사용자 동의 필수 여부 T : 필수 · F : 선택 |
| ↳ `withdrawal` |  | 청약철회방침 내용 |

응답 예시 (JSON):

```json
{
    "policy": {
        "shop_no": 1,
        "privacy_all": "<p>** This form is intended to assist in the operation...",
        "terms_using_mall": "<p>**This form is provided by the Fair Trade Commission...",
        "use_privacy_join": "T",
        "privacy_join": "<p>1. Purposes of Collection and Use of Personal Information...",
        "use_withdrawal": "T",
        "required_withdrawal": "T",
        "withdrawal": "<p>Withdrawal Policy Agreement...</p>"
    }
}
```
