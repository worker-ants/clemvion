---
resource: promotion
entity: customers__coupons
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#customers--coupons
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Promotion / Customers coupons

> Field-level 카탈로그. Endpoint enumeration index: [`../promotion.md`](../promotion.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Customers coupons](https://developers.cafe24.com/docs/ko/api/admin/#customers--coupons)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

회원 쿠폰(Customers coupons)은 특정 회원이 보유한 쿠폰에 관한 기능입니다. · 회원에게 발급된 쿠폰을 조회하거나 삭제할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `coupon_no` |  | 쿠폰번호 |
| `issue_no` |  | 쿠폰 발급번호 |
| `coupon_name` |  | 쿠폰명 |
| `available_price_type` |  | 사용가능 구매 금액 유형 U : 제한 없음 · O : 주문 금액 기준 · P : 상품 금액 기준 |
| `available_price_type_detail` |  | 사용가능 구매 금액 유형 상세 U : 모든 상품의 주문 금액 · I : 쿠폰 적용 상품의 주문 금액 |
| `available_min_price` |  | 사용가능 구매 금액 |
| `available_payment_methods` |  | 사용가능 결제수단 all : 제한없음 · R : 무통장입금 · E : 가상계좌 · C : 신용카드 · A : 계좌이체 · H : 휴대폰 · M : 적립금 · K : 케이페이 · P : 페이나우 · N : 페이코 · O : 카카오페이 · S : 스마일페이 · V : 네이버페이 · B : 편의점 · D : 토스 |
| `benefit_type` |  | 혜택 구분 A : 할인금액 · B : 할인율 · C : 적립금액 · D : 적립율 · E : 기본배송비 할인(전액할인) · I : 기본배송비 할인(할인율) · H : 기본배송비 할인(할인금액) · F : 즉시적립 · G : 예치금 |
| `benefit_price` |  | 혜택 금액 |
| `benefit_percentage` |  | 혜택 비율 |
| `benefit_percentage_round_unit` |  | 혜택 비율 절사 단위 |
| `benefit_percentage_max_price` |  | 혜택 비율 최대 금액 |
| `credit_amount` |  | 예치금 지급 금액 |
| `issued_date` |  | 발행일 |
| `available_begin_datetime` |  | 사용 기간 시작 일시 |
| `available_end_datetime` |  | 사용 기간 종료 일시 |

## Operations

### `GET /api/v2/admin/customers/{member_id}/coupons` — Retrieve a list of customer coupons

- **Scope**: `mall.read_promotion` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-coupons

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `member_id` | ✓ |  |  | 회원아이디 |
| `offset` |  | 최대값: [10000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `coupons` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `coupon_no` |  | 쿠폰번호 |
| ↳ `issue_no` |  | 쿠폰 발급번호 |
| ↳ `coupon_name` |  | 쿠폰명 |
| ↳ `available_price_type` |  | 사용가능 구매 금액 유형 U : 제한 없음 · O : 주문 금액 기준 · P : 상품 금액 기준 |
| ↳ `available_price_type_detail` |  | 사용가능 구매 금액 유형 상세 U : 모든 상품의 주문 금액 · I : 쿠폰 적용 상품의 주문 금액 |
| ↳ `available_min_price` |  | 사용가능 구매 금액 |
| ↳ `available_payment_methods` |  | 사용가능 결제수단 all : 제한없음 · R : 무통장입금 · E : 가상계좌 · C : 신용카드 · A : 계좌이체 · H : 휴대폰 · M : 적립금 · K : 케이페이 · P : 페이나우 · N : 페이코 · O : 카카오페이 · S : 스마일페이 · V : 네이버페이 · B : 편의점 · D : 토스 |
| ↳ `benefit_type` |  | 혜택 구분 A : 할인금액 · B : 할인율 · C : 적립금액 · D : 적립율 · E : 기본배송비 할인(전액할인) · I : 기본배송비 할인(할인율) · H : 기본배송비 할인(할인금액) · F : 즉시적립 · G : 예치금 |
| ↳ `benefit_price` |  | 혜택 금액 |
| ↳ `benefit_percentage` |  | 혜택 비율 |
| ↳ `benefit_percentage_round_unit` |  | 혜택 비율 절사 단위 |
| ↳ `benefit_percentage_max_price` |  | 혜택 비율 최대 금액 |
| ↳ `credit_amount` |  | 예치금 지급 금액 |
| ↳ `issued_date` |  | 발행일 |
| ↳ `available_begin_datetime` |  | 사용 기간 시작 일시 |
| ↳ `available_end_datetime` |  | 사용 기간 종료 일시 |

응답 예시 (JSON):

```json
{
    "coupons": [
        {
            "shop_no": 1,
            "coupon_no": "9000000000000000032",
            "issue_no": "9000000000000000040",
            "coupon_name": "Christmas Week Coupon",
            "available_price_type": "U",
            "available_price_type_detail": null,
            "available_min_price": null,
            "available_payment_methods": [
                "R",
                "E"
            ],
            "benefit_type": "A",
            "benefit_price": "10.00",
            "benefit_percentage": null,
            "benefit_percentage_round_unit": null,
            "benefit_percentage_max_price": null,
            "credit_amount": null,
            "issued_date": "2019-09-19T11:56:41+09:00",
            "available_begin_datetime": "2019-09-19T00:00:00+09:00",
            "available_end_datetime": "2019-09-22T23:00:00+09:00"
        },
        {
            "shop_no": 1,
            "coupon_no": "9000000000000000033",
            "issue_no": "9000000000000000050",
            "coupon_name": "Special Discount Coupon",
            "available_price_type": "O",
            "available_price_type_detail": "U",
            "available_min_price": "2.00",
            "available_payment_methods": [
                "R",
                "E"
            ],
            "benefit_type": "B",
            "benefit_price": null,
            "benefit_percentage": "10.0",
            "benefit_percentage_round_unit": "10",
            "benefit_percentage_max_price": null,
            "credit_amount": null,
            "issued_date": "2019-09-20T11:56:41+09:00",
            "available_begin_datetime": "2019-09-20T00:00:00+09:00",
            "available_end_datetime": "2019-09-23T23:00:00+09:00"
        }
    ]
}
```

### `GET /api/v2/admin/customers/{member_id}/coupons/count` — Retrieve a count of customer coupons

- **Scope**: `mall.read_promotion` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-coupons

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `member_id` | ✓ |  |  | 회원아이디 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `count` |  |  |

응답 예시 (JSON):

```json
{
    "count": 7
}
```

### `DELETE /api/v2/admin/customers/{member_id}/coupons/{coupon_no}` — Delete a customer coupon

- **Scope**: `mall.write_promotion` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-customer-coupon

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `member_id` | ✓ |  |  | 회원아이디 |
| `coupon_no` | ✓ |  |  | 쿠폰번호 |
| `issue_no` |  |  |  | 쿠폰 발급번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `coupon` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `coupon_no` |  | 쿠폰번호 |
| ↳ `issue_no` |  | 쿠폰 발급번호 |

응답 예시 (JSON):

```json
{
    "coupon": {
        "shop_no": 1,
        "coupon_no": "9000000000000000032",
        "issue_no": [
            "9000000000000000040",
            "9000000000000000041"
        ]
    }
}
```
