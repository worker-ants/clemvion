---
resource: store
entity: paymentservices
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#paymentservices
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Paymentservices

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Paymentservices](https://developers.cafe24.com/docs/ko/api/admin/#paymentservices)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

국내PG의 세팅사항을 관리할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `payment_gateway_name` |  | PG사 명 |
| `partner_id` |  | PG사 발급 가맹점 ID |
| `hash_code` |  | PG사 해시코드 |
| `etc_code` |  | PG사 기타정보 |
| `payment_methods` |  | 등록 결제수단 리스트 |

## Operations

### `GET /api/v2/admin/paymentservices` — Retrieve a list of PG settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-pg-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "paymentservices": [
        [
            {
                "shop_no": 1,
                "payment_gateway_name": "cafe24pay",
                "partner_id": "dummy_partner_id_01",
                "hash_code": "dummy_hash_code_01",
                "etc_code": "dummy_etc_code_01",
                "payment_methods": [
                    {
                        "code": "card",
                        "use": "T"
                    }
                ]
            },
            {
                "shop_no": 1,
                "payment_gateway_name": "cafe24pay",
                "partner_id": "dummy_partner_id_02",
                "hash_code": "dummy_hash_code_01",
                "etc_code": "dummy_etc_code_01",
                "payment_methods": [
                    {
                        "code": "icash",
                        "use": "T"
                    }
                ]
            },
            {
                "shop_no": 1,
                "payment_gateway_name": "inicis",
                "partner_id": "dummy_partner_id_03",
                "hash_code": "dummy_hash_code_02",
                "etc_code": "dummy_etc_code_02",
                "payment_methods": [
                    {
                        "code": "card",
                        "use": "T"
                    }
                ]
            },
            {
                "shop_no": 1,
                "payment_gateway_name": "inicis",
                "partner_id": "dummy_partner_id_04",
                "hash_code": "dummy_hash_code_02",
                "etc_code": "dummy_etc_code_02",
                "payment_methods": [
                    {
                        "code": "tcash",
                        "use": "T"
                    }
                ]
            },
            {
                "shop_no": 1,
                "payment_gateway_name": "inicis",
                "partner_id": "dummy_partner_id_05",
                "hash_code": "dummy_hash_code_02",
                "etc_code": "dummy_etc_code_02",
                "payment_methods": [
                    {
                        "code": "cvs",
                        "use": "F"
                    }
                ]
            }
        ]
    ]
}
```
