---
resource: store
entity: paymentmethods__paymentproviders
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#paymentmethods--paymentproviders
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Paymentmethods paymentproviders

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Paymentmethods paymentproviders](https://developers.cafe24.com/docs/ko/api/admin/#paymentmethods--paymentproviders)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

쇼핑몰에 설정된 결제수단의 정보를 조회하거나 결제수단의 노출여부를 수정할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `name` |  | PG 이름 |
| `display` |  | 결제수단 노출여부 T : 노출함 · F : 노출안함 |

## Operations

### `GET /api/v2/admin/paymentmethods/{code}/paymentproviders` — Retrieve a list of providers by payment method

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-providers-by-payment-method

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `code` | ✓ |  |  | 결제수단 코드 |
| `name` |  |  |  | PG 이름 |
| `display` |  |  |  | 결제수단 노출여부 T : 노출함 · F : 노출안함 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "paymentproviders": [
        {
            "shop_no": 1,
            "name": "bank",
            "display": "T"
        },
        {
            "shop_no": 1,
            "name": "deferpay",
            "display": "T"
        }
    ]
}
```

### `PUT /api/v2/admin/paymentmethods/{code}/paymentproviders/{name}` — Update the display status of a payment method

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-the-display-status-of-a-payment-method

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `code` | ✓ |  |  | 결제수단 코드 |
| `name` | ✓ |  |  | PG 이름 |
| `display` | ✓ |  |  | 결제수단 노출여부 T : 노출함 · F : 노출안함 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "paymentprovider": {
        "shop_no": 1,
        "display": "T"
    }
}
```
