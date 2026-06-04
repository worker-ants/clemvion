---
resource: mileage
entity: credits-report
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#credits-report
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Mileage / Credits report

> Field-level 카탈로그. Endpoint enumeration index: [`../mileage.md`](../mileage.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Credits report](https://developers.cafe24.com/docs/ko/api/admin/#credits-report)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

예치금 통계(Credit report)는 지정한 기간동안의 예치금 통계를 조회할 수 있는 리소스입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `increase_amount` |  | 지급 금액 |
| `decrease_amount` |  | 차감 금액 |
| `credits_total` |  | 예치금 합계 |

## Operations

### `GET /api/v2/admin/credits/report` — Retrieve a credit report by date range

- **Scope**: `mall.read_mileage` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-credit-report-by-date-range

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `start_date` | ✓ | 날짜 |  | 검색 시작일 |
| `end_date` | ✓ | 날짜 |  | 검색 종료일 |
| `type` |  |  |  | 예치금 증가/차감 여부 I : 지급내역 · D : 차감내역 |
| `case` |  |  |  | 예치금 유형 A : 주문취소 · B : 예치금환불 · C : 상품구매 · D : 임의조정 · E : 현금환불 · G : 충전 |
| `admin_id` |  |  |  | 관리자 아이디 |
| `search_field` |  |  |  | 검색필드 id : 아이디 · reason : 처리사유 |
| `keyword` |  |  |  | 검색어 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `report` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `increase_amount` |  | 지급 금액 |
| ↳ `decrease_amount` |  | 차감 금액 |
| ↳ `credits_total` |  | 예치금 합계 |

응답 예시 (JSON):

```json
{
    "report": {
        "shop_no": 1,
        "increase_amount": "1000.00",
        "decrease_amount": "0.00",
        "credits_total": "1000.00"
    }
}
```
