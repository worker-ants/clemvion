---
resource: community
entity: financials-monthlyreviews
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#financials-monthlyreviews
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Community / Financials monthlyreviews

> Field-level 카탈로그. Endpoint enumeration index: [`../community.md`](../community.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Financials monthlyreviews](https://developers.cafe24.com/docs/ko/api/admin/#financials-monthlyreviews)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

월별 리뷰 통계(Financials monthlyreviews)는 월별 리뷰 정보를 제공합니다. 검색 기간 내의 월별 리뷰 개수 합계, 월별 리뷰 평점 평균을 확인할 수 있습니다

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `month` |  | 년월 |
| `count` |  | 리뷰 개수 합계 |
| `rating_average` |  | 리뷰 평점 평균 |

## Operations

### `GET /api/v2/admin/financials/monthlyreviews` — Retrieve the total count for monthly reviews and ratings

- **Scope**: `mall.read_community` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-total-count-for-monthly-reviews-and-ratings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `start_month` | ✓ |  |  | 검색 시작월 |
| `end_month` | ✓ |  |  | 검색 종료월 |
