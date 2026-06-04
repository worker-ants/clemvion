---
resource: salesreport
entity: financials-monthlysales
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#financials-monthlysales
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Salesreport / Financials monthlysales

> Field-level 카탈로그. Endpoint enumeration index: [`../salesreport.md`](../salesreport.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Financials monthlysales](https://developers.cafe24.com/docs/ko/api/admin/#financials-monthlysales)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

월별 매출(Financials monthlysales)은 PG사별, 월별 매출 정보를 제공합니다. · 검색 조건에 부합하는 매출 정보 검색이 가능합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `month` |  | 년월 |
| `payment_amount` |  | 결제 금액 |
| `refund_amount` |  | 환불 금액 |
| `sales_count` |  | 판매건수 |

## Operations

### `GET /api/v2/admin/financials/monthlysales` — Retrieve a list of monthly sales

- **Scope**: `mall.read_salesreport` (read)
- **호출건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-monthly-sales

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `start_month` | ✓ |  |  | 검색 시작월 |
| `end_month` | ✓ |  |  | 검색 종료월 |
| `payment_gateway_name` |  |  |  | PG 이름 |
| `partner_id` |  |  |  | PG사 발급 가맹점 ID |
| `payment_method` |  |  |  | 결제수단 코드 card : 신용카드 · tcash : 계좌이체 · icash : 가상계좌 · point : 선불금 · cell : 휴대폰 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `monthlysales` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `month` |  | 년월 |
| ↳ `payment_amount` |  | 결제 금액 |
| ↳ `refund_amount` |  | 환불 금액 |
| ↳ `sales_count` |  | 판매건수 |

응답 예시 (JSON):

```json
{
    "monthlysales": [
        {
            "shop_no": 1,
            "month": "2020-09",
            "payment_amount": "150000.00",
            "refund_amount": "50000.00",
            "sales_count": 5
        },
        {
            "shop_no": 1,
            "month": "2020-10",
            "payment_amount": "270000.00",
            "refund_amount": "20000.00",
            "sales_count": 8
        }
    ]
}
```
