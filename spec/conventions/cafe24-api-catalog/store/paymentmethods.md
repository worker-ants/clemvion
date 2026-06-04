---
resource: store
entity: paymentmethods
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#paymentmethods
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Paymentmethods

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Paymentmethods](https://developers.cafe24.com/docs/ko/api/admin/#paymentmethods)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

쇼핑몰에 설정된 결제수단을 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `code` |  | 결제수단 코드 |

## Operations

### `GET /api/v2/admin/paymentmethods` — Retrieve a list of payment methods

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-payment-methods

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "paymentmethods": [
        {
            "shop_no": 1,
            "code": "cash"
        },
        {
            "shop_no": 1,
            "code": "cod"
        }
    ]
}
```
