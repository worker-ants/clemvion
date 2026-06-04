---
resource: store
entity: currency
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#currency
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Currency

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Currency](https://developers.cafe24.com/docs/ko/api/admin/#currency)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

환율 정보(Currency)는 쇼핑몰의 화폐 정보, 환율 정보 등을 확인할 수 있는 리소스입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `exchange_rate` |  | 결제 화폐 환율 정보 |
| `standard_currency_code` |  | 기준 화폐 코드 해당 쇼핑몰의 기본쇼핑몰에서 사용하는 화폐 코드. 기준 화폐란 일반적으로 쇼핑몰 운영자가 속한 국가에서 통용되는 화폐를 의미한다. |
| `standard_currency_symbol` |  | 기준 화폐 심볼 해당 쇼핑몰의 기본쇼핑몰에서 사용하는 화폐의 화폐 기호. 기준 화폐란 일반적으로 쇼핑몰 운영자가 속한 국가에서 통용되는 화폐를 의미한다. |
| `shop_currency_code` |  | 결제 화폐 코드 |
| `shop_currency_symbol` |  | 결제 화폐 심볼 |
| `shop_currency_format` |  | 결제 화폐 표시 방식 |

## Operations

### `GET /api/v2/admin/currency` — Retrieve currency settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-currency-settings

_요청 파라미터 없음._

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "currency": {
        "exchange_rate": "1004.00",
        "standard_currency_code": "KRW",
        "standard_currency_symbol": "￦",
        "shop_currency_code": "USD",
        "shop_currency_symbol": "$",
        "shop_currency_format": "￦[:PRICE:]"
    }
}
```

### `PUT /api/v2/admin/currency` — Update a currency

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-currency

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` | ✓ | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `exchange_rate` | ✓ |  |  | 결제 화폐 환율 정보 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "currency": {
        "exchange_rate": "9.5697"
    }
}
```
