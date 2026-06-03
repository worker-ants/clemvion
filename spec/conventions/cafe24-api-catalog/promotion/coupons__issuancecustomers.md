---
resource: promotion
entity: coupons__issuancecustomers
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#coupons--issuancecustomers
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Promotion / Coupons issuancecustomers

> Field-level 카탈로그. Endpoint enumeration index: [`../promotion.md`](../promotion.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Coupons issuancecustomers](https://developers.cafe24.com/docs/ko/api/admin/#coupons--issuancecustomers)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

멀티쇼핑몰 번호

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| `coupon_no` |  | 쿠폰번호 |
| `member_id` |  | 회원아이디 |
| `group_no` |  | 발급대상 회원등급 번호 |
| `issued_date` |  | 쿠폰 발급일자 |
| `expiration_date` |  | 만료일 |
| `used_coupon` |  | 쿠폰사용 여부 |
| `used_date` |  | 쿠폰 사용 일자 |
| `related_order_id` |  | 관련 주문번호 |

## Operations

### `GET /api/v2/admin/coupons/{coupon_no}/issuancecustomers` — Retrieve a list of eligible customers for conditional issuance

- **Scope**: `mall.read_promotion` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-eligible-customers-for-conditional-issuance

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `coupon_no` | ✓ |  |  | 쿠폰번호 |
| `member_id` |  | 최대글자수 : [20자] |  | 회원아이디 |
| `group_no` |  |  |  | 회원등급번호 |
| `since_member_id` |  | 최대글자수 : [20자] |  | 해당 쿠폰 회원 ID 이후 검색 |
| `limit` |  | 최소: [1]~최대: [500] | 10 | 조회결과 최대건수 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
