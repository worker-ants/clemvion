---
resource: store
entity: financials-store
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#financials-store
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Financials store

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Financials store](https://developers.cafe24.com/docs/ko/api/admin/#financials-store)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

Financials store(상점의 거래정보)는 상점의 PG사별 거래정보를 제공합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `first_payment_date` |  | 최초 결제일 |
| `payment_gateway_name` |  | PG 이름 |

## Operations

### `GET /api/v2/admin/financials/store` — Retrieve the transaction information of a store

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-transaction-information-of-a-store

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `payment_method` | ✓ |  |  | 결제수단 코드 card : 신용카드 · tcash : 계좌이체 · icash : 가상계좌 · cell : 휴대폰 · deferpay : 후불 · cvs : 편의점 · point : 선불금 · etc : 기타 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "store": {
        "shop_no": 1,
        "first_payment_date": "2020-01-01",
        "payment_gateway_name": "cafe24payTest"
    }
}
```
