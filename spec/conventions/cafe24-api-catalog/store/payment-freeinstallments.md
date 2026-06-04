---
resource: store
entity: payment-freeinstallments
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#payment-freeinstallments
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Payment freeinstallments

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Payment freeinstallments](https://developers.cafe24.com/docs/ko/api/admin/#payment-freeinstallments)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `payment_gateway_name` |  | PG 이름 |
| `installments` |  | 무이자 할부 정보 목록 |

## Operations

### `GET /api/v2/admin/payment/freeinstallments` — Retrieve interest-free installment information

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-interest-free-installment-information

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "freeinstallments": {
        "shop_no": 1,
        "payment_gateway_name": "allat",
        "installments": [
            {
                "card_code": "SA",
                "card_name": "삼성",
                "installment_months": [
                    1,
                    2,
                    3
                ],
                "event_start_date": "2026-04-01T00:00:00+09:00",
                "event_end_date": "2026-04-30T23:59:59+09:00"
            },
            {
                "card_code": "SH",
                "card_name": "신한",
                "installment_months": [
                    1,
                    2,
                    3
                ],
                "event_start_date": "2026-04-01T00:00:00+09:00",
                "event_end_date": "2026-04-30T23:59:59+09:00"
            },
            {
                "card_code": "HY",
                "card_name": "현대",
                "installment_months": [
                    1,
                    2,
                    3
                ],
                "event_start_date": "2026-04-01T00:00:00+09:00",
                "event_end_date": "2026-04-30T23:59:59+09:00"
            }
        ]
    }
}
```
