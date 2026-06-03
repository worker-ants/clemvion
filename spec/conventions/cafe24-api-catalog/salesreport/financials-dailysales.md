---
resource: salesreport
entity: financials-dailysales
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#financials-dailysales
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Salesreport / Financials dailysales

> Field-level 카탈로그. Endpoint enumeration index: [`../salesreport.md`](../salesreport.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Financials dailysales](https://developers.cafe24.com/docs/ko/api/admin/#financials-dailysales)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

일별 매출(Financials dailysales)은 PG사별, 일별 매출 정보를 제공합니다. · 검색 조건에 부합하는 매출 정보 검색이 가능합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `date` |  | 날짜 |
| `payment_amount` |  | 결제 금액 |
| `refund_amount` |  | 환불 금액 |
| `sales_count` |  | 판매건수 |

## Operations

### `GET /api/v2/admin/financials/dailysales` — Retrieve a list of daily sales

- **Scope**: `mall.read_salesreport` (read)
- **호출건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-daily-sales

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `start_date` | ✓ |  |  | 검색 시작일 |
| `end_date` | ✓ |  |  | 검색 종료일 |
| `payment_gateway_name` |  |  |  | PG 이름 |
| `partner_id` |  |  |  | PG사 발급 가맹점 ID |
| `payment_method` |  |  |  | 결제수단 코드 card : 신용카드 · tcash : 계좌이체 · icash : 가상계좌 · point : 선불금 · cell : 휴대폰 |
