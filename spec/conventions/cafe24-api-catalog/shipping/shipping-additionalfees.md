---
resource: shipping
entity: shipping-additionalfees
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#shipping-additionalfees
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Shipping / Shipping additionalfees

> Field-level 카탈로그. Endpoint enumeration index: [`../shipping.md`](../shipping.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Shipping additionalfees](https://developers.cafe24.com/docs/ko/api/admin/#shipping-additionalfees)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `oversea_additional_fee` |  | 해외배송 부가금액 사용여부 |
| `country_code` |  | 국가코드 |
| `fee_name` |  | 부과금액 명칭 |
| `min_value` |  | 조건 최소값 |
| `max_value` |  | 조건 최대값 |
| `additional_fee` |  | 부가금액 |
| `unit` |  | 해외배송 부가금액 단위 W : 정액 · P : 퍼센트 |
| `rounding_unit` |  | 절사단위 F : 절사안함 · 0 : 1원단위 · 1 : 10원단위 · 2 : 100원단위 · 3 : 1000원단위 |
| `rounding_rule` |  | 절사 방법 L : 내림 · U : 반올림 · C : 올림 |

## Operations

### `GET /api/v2/admin/shipping/additionalfees` — Retrieve a list of applicable countries for additional handling fee on international shipping

- **Scope**: `mall.read_shipping` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-applicable-countries-for-additional-handling-fee-on-international-shipping

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `limit` |  | 최소: [1]~최대: [500] | 100 | 조회결과 최대건수 |
| `offset` |  | 최대값: [500] | 0 | 조회결과 시작위치 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `additionalfees` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `oversea_additional_fee` |  | 해외배송 부가금액 사용여부 |
| ↳ `country_code` |  | 국가코드 |
| ↳ `fee_name` |  | 부과금액 명칭 |
| ↳ `min_value` |  | 조건 최소값 |
| ↳ `max_value` |  | 조건 최대값 |
| ↳ `additional_fee` |  | 부가금액 |
| ↳ `unit` |  | 해외배송 부가금액 단위 W : 정액 · P : 퍼센트 |
| ↳ `rounding_unit` |  | 절사단위 F : 절사안함 · 0 : 1원단위 · 1 : 10원단위 · 2 : 100원단위 · 3 : 1000원단위 |
| ↳ `rounding_rule` |  | 절사 방법 L : 내림 · U : 반올림 · C : 올림 |
| `links` |  | (목록) |
| ↳ `rel` |  |  |
| ↳ `href` |  |  |

응답 예시 (JSON):

```json
{
    "additionalfees": [
        {
            "shop_no": 1,
            "oversea_additional_fee": "T",
            "country_code": "GH",
            "fee_name": "oversea_additional",
            "min_value": "0.00",
            "max_value": "500000.00",
            "additional_fee": "20000.00",
            "unit": "W",
            "rounding_unit": "F",
            "rounding_rule": "L"
        },
        {
            "shop_no": 1,
            "oversea_additional_fee": "T",
            "country_code": "US",
            "fee_name": "usa_shipping",
            "min_value": "0.00",
            "max_value": "1000000.00",
            "additional_fee": "30000.00",
            "unit": "W",
            "rounding_unit": "F",
            "rounding_rule": "L"
        }
    ],
    "links": [
        {
            "rel": "prev",
            "href": "https://{mallid}.cafe24api.com/api/v2/admin/shipping/additionalfees?shop_no=1&limit=100&offset=0"
        },
        {
            "rel": "next",
            "href": "https://{mallid}.cafe24api.com/api/v2/admin/shipping/additionalfees?shop_no=1&limit=100&offset=200"
        }
    ]
}
```
