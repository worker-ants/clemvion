---
resource: mileage
entity: points-report
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#points-report
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Mileage / Points report

> Field-level 카탈로그. Endpoint enumeration index: [`../mileage.md`](../mileage.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Points report](https://developers.cafe24.com/docs/ko/api/admin/#points-report)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

적립금 통계(Points report)는 지정한 기간동안의 가용적립금의 증감 내역, 미가용 적립금의 총액 등 적립금과 관련된 통계를 조회할 수 있는 리소스입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `available_points_increase` |  | 가용 적립금 증가 |
| `available_points_decrease` |  | 가용 적립금 차감 |
| `available_points_total` |  | 가용 적립금 전체 |
| `unavailable_points` |  | 미가용 적립금 |
| `unavailable_coupon_points` |  | 미가용 회원 쿠폰 적립금 |

## Operations

### `GET /api/v2/admin/points/report` — Retrieve a points report by date range

- **Scope**: `mall.read_mileage` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-points-report-by-date-range

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `member_id` |  | 최대글자수 : [20자] |  | 회원아이디 |
| `email` |  | 이메일 |  | 이메일 |
| `group_no` |  |  |  | 회원등급번호 |
| `start_date` | ✓ | 날짜 |  | 검색 시작일 |
| `end_date` | ✓ | 날짜 |  | 검색 종료일 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `report` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `available_points_increase` |  | 가용 적립금 증가 |
| ↳ `available_points_decrease` |  | 가용 적립금 차감 |
| ↳ `available_points_total` |  | 가용 적립금 전체 |
| ↳ `unavailable_points` |  | 미가용 적립금 |
| ↳ `unavailable_coupon_points` |  | 미가용 회원 쿠폰 적립금 |

응답 예시 (JSON):

```json
{
    "report": {
        "shop_no": 1,
        "available_points_increase": "100.00",
        "available_points_decrease": "20.00",
        "available_points_total": "80.00",
        "unavailable_points": "1500.00",
        "unavailable_coupon_points": "1169.00"
    }
}
```
