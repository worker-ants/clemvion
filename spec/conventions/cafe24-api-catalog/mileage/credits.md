---
resource: mileage
entity: credits
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#credits
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Mileage / Credits

> Field-level 카탈로그. Endpoint enumeration index: [`../mileage.md`](../mileage.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Credits](https://developers.cafe24.com/docs/ko/api/admin/#credits)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

예치금(Credits)는 주문 환불시 환불수단으로서 받을 수 있는 현금성 자산입니다. · 별도의 Scope를 가지고 있으며 매우 민감한 API 이므로 이용에 주의를 기울여야 합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `issue_date` |  | 등록일 |
| `member_id` | 최대글자수 : [20자] | 회원아이디 |
| `group_name` |  | 회원등급명 |
| `increase_amount` |  | 지급 금액 |
| `decrease_amount` |  | 차감 금액 |
| `balance` |  | 잔액 |
| `admin_id` |  | 관리자 아이디 |
| `admin_name` |  | 관리자 이름 |
| `reason` |  | 처리사유 |
| `case` |  | 예치금 유형 |
| `order_id` |  | 주문번호 |

## Operations

### `GET /api/v2/admin/credits` — Retrieve a list of credits by date range

- **Scope**: `mall.read_mileage` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-credits-by-date-range

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `start_date` | ✓ | 날짜 |  | 검색 시작일 |
| `end_date` | ✓ | 날짜 |  | 검색 종료일 |
| `type` |  |  |  | 예치금 증가/차감 여부 I : 지급내역 · D : 차감내역 |
| `case` |  |  |  | 예치금 유형 A : 주문취소 · B : 예치금환불 · C : 상품구매 · D : 임의조정 · E : 현금환불 · G : 충전 |
| `admin_id` |  |  |  | 관리자 아이디 |
| `order_id` |  | 주문번호 |  | 주문번호 |
| `search_field` |  |  |  | 검색필드 id : 아이디 · reason : 처리사유 |
| `keyword` |  |  |  | 검색어 |
| `limit` |  | 최소: [1]~최대: [200] | 50 | 조회결과 최대건수 |
| `offset` |  | 최대값: [10000] | 0 | 조회결과 시작위치 |
