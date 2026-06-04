---
resource: store
entity: store-accounts
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#store-accounts
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Store accounts

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Store accounts](https://developers.cafe24.com/docs/ko/api/admin/#store-accounts)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상점 계좌(Store accounts)는 쇼핑몰의 무통장입금 정보에 대한 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `bank_account_id` |  | 무통장 입금 은행 ID |
| `bank_name` |  | 은행명 |
| `bank_code` | 최대글자수 : [50자] | 은행코드 bank_code |
| `bank_account_no` |  | 계좌번호 |
| `bank_account_holder` |  | 예금주 |
| `use_account` |  | 사용여부 T : 사용함 · F : 사용안함 |

## Operations

### `GET /api/v2/admin/store/accounts` — Retrieve a list of store bank accounts

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-store-bank-accounts

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `accounts` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `bank_account_id` |  | 무통장 입금 은행 ID |
| ↳ `bank_name` |  | 은행명 |
| ↳ `bank_code` | 최대글자수 : [50자] | 은행코드 bank_code |
| ↳ `bank_account_no` |  | 계좌번호 |
| ↳ `bank_account_holder` |  | 예금주 |
| ↳ `use_account` |  | 사용여부 T : 사용함 · F : 사용안함 |

응답 예시 (JSON):

```json
{
    "accounts": [
        {
            "shop_no": 1,
            "bank_account_id": 1,
            "bank_name": "Hana Bank",
            "bank_code": "bank_81",
            "bank_account_no": "123123123",
            "bank_account_holder": "Depositor Name",
            "use_account": "T"
        },
        {
            "shop_no": 1,
            "bank_account_id": 2,
            "bank_name": "KB Bank",
            "bank_code": "bank_04",
            "bank_account_no": "123456789",
            "bank_account_holder": "Depositor Name",
            "use_account": "T"
        }
    ]
}
```
