---
resource: customer
entity: customergroups-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#customergroups-setting
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Customer / Customergroups setting

> Field-level 카탈로그. Endpoint enumeration index: [`../customer.md`](../customer.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Customergroups setting](https://developers.cafe24.com/docs/ko/api/admin/#customergroups-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

회원등급에 대한 쇼핑몰 설정 정보를 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `auto_update` |  | 회원등급 자동변경 사용설정 T : 사용함 · F : 사용안함 |
| `use_auto_update` |  | 회원등급 자동변경 적용여부 T : 적용함(사용중) · F : 적용안함(사용대기) |
| `customer_tier_criteria` |  | 회원 등급 기준 purchase_amount : 구매금액 · purchase_count : 구매건수 · purchase_amount_and_count : 구매금액과 구매건수 · purchase_amount_or_count : 구매금액 또는 구매건수 · shopping_index : 쇼핑지수 |
| `standard_purchase_amount` |  | 구매 금액 정의 total_order_amount : 총 주문 금액 · total_paid_amount : 총 결제 금액 · credit_price : 총실결제금액 + 예치금 |
| `offline_purchase_amount` |  | 오프라인 구매금액 포함여부 T : 포함 · F : 미포함 |
| `standard_purchase_count` |  | 구매 건수 정의 order_count : 주문 횟수 · product_count : 상품(품목) 개수 |
| `offline_purchase_count` |  | 오프라인 구매건수 포함여부 T : 포함 · F : 미포함 |
| `auto_update_criteria` |  | 자동 변경 시 산정 주문 기준 설정 delivery_complete : 배송완료 기준 · payment_complete : 결제완료 기준 |
| `deduct_cancellation_refund` |  | 취소/환불 금액(건) 차감 여부 T : 취소/환불 금액(건) 차감 · F : 취소/환불 금액(건) 미차감 |
| `interval_auto_update` |  | 자동 변경 주기 1d : 매일 · 3d : 3일 · 1w : 1주 · 1m : 1개월 · 3m : 3개월 · 6m : 6개월 · 12m : 12개월 |
| `total_period` |  | 등급 산정 누적 기간 now : 변경시점 직전까지 · 1m : 최근 1개월 · 3m : 최근 3개월 · 6m : 최근 6개월 · 12m : 최근 12개월 · 24m : 최근 24개월 · 36m : 최근 36개월 |
| `interval_week` |  | 자동 변경일(매주) 0 : 일요일 · 1 : 월요일 · 2 : 화요일 · 3 : 수요일 · 4 : 목요일 · 5 : 금요일 · 6 : 토요일 |
| `interval_month` |  | 자동 변경일(매월) 1 : 1일 · 5 : 5일 · 10 : 10일 · 15 : 15일 · 20 : 20일 · 25 : 25일 |
| `auto_update_set_date` |  | 회원등급 변경 시점 |
| `use_discount_limit` |  | 등급별 할인 제한 사용여부 T : 사용함 · F : 사용안함 |
| `discount_limit_reset_period` |  | 할인 제한 초기화 주기 1d : 매일 · 3d : 3일 · 1w : 1주 · 1m : 1개월 |
| `discount_limit_reset_week` |  | 할인 제한 초기화 일자(매주) 0 : 일요일 · 1 : 월요일 · 2 : 화요일 · 3 : 수요일 · 4 : 목요일 · 5 : 금요일 · 6 : 토요일 |
| `discount_limit_reset_date` |  | 할인 제한 초기화 일자(매월) 1 : 1일 · 5 : 5일 · 10 : 10일 · 15 : 15일 · 20 : 20일 · 25 : 25일 |
| `discount_limit_begin_date` |  | 할인 제한 시작 일자 |
| `discount_limit_end_date` |  | 할인 제한 종료 일자 |

## Operations

### `GET /api/v2/admin/customergroups/setting` — Retrieve customer tier settings

- **Scope**: `mall.read_customer` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-customer-tier-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `customergroup` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `auto_update` |  | 회원등급 자동변경 사용설정 T : 사용함 · F : 사용안함 |
| ↳ `use_auto_update` |  | 회원등급 자동변경 적용여부 T : 적용함(사용중) · F : 적용안함(사용대기) |
| ↳ `customer_tier_criteria` |  | 회원 등급 기준 purchase_amount : 구매금액 · purchase_count : 구매건수 · purchase_amount_and_count : 구매금액과 구매건수 · purchase_amount_or_count : 구매금액 또는 구매건수 · shopping_index : 쇼핑지수 |
| ↳ `standard_purchase_amount` |  | 구매 금액 정의 total_order_amount : 총 주문 금액 · total_paid_amount : 총 결제 금액 · credit_price : 총실결제금액 + 예치금 |
| ↳ `offline_purchase_amount` |  | 오프라인 구매금액 포함여부 T : 포함 · F : 미포함 |
| ↳ `standard_purchase_count` |  | 구매 건수 정의 order_count : 주문 횟수 · product_count : 상품(품목) 개수 |
| ↳ `offline_purchase_count` |  | 오프라인 구매건수 포함여부 T : 포함 · F : 미포함 |
| ↳ `auto_update_criteria` |  | 자동 변경 시 산정 주문 기준 설정 delivery_complete : 배송완료 기준 · payment_complete : 결제완료 기준 |
| ↳ `deduct_cancellation_refund` |  | 취소/환불 금액(건) 차감 여부 T : 취소/환불 금액(건) 차감 · F : 취소/환불 금액(건) 미차감 |
| ↳ `interval_auto_update` |  | 자동 변경 주기 1d : 매일 · 3d : 3일 · 1w : 1주 · 1m : 1개월 · 3m : 3개월 · 6m : 6개월 · 12m : 12개월 |
| ↳ `total_period` |  | 등급 산정 누적 기간 now : 변경시점 직전까지 · 1m : 최근 1개월 · 3m : 최근 3개월 · 6m : 최근 6개월 · 12m : 최근 12개월 · 24m : 최근 24개월 · 36m : 최근 36개월 |
| ↳ `interval_week` |  | 자동 변경일(매주) 0 : 일요일 · 1 : 월요일 · 2 : 화요일 · 3 : 수요일 · 4 : 목요일 · 5 : 금요일 · 6 : 토요일 |
| ↳ `interval_month` |  | 자동 변경일(매월) 1 : 1일 · 5 : 5일 · 10 : 10일 · 15 : 15일 · 20 : 20일 · 25 : 25일 |
| ↳ `auto_update_set_date` |  | 회원등급 변경 시점 |
| ↳ `use_discount_limit` |  | 등급별 할인 제한 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `discount_limit_reset_period` |  | 할인 제한 초기화 주기 1d : 매일 · 3d : 3일 · 1w : 1주 · 1m : 1개월 |
| ↳ `discount_limit_reset_week` |  | 할인 제한 초기화 일자(매주) 0 : 일요일 · 1 : 월요일 · 2 : 화요일 · 3 : 수요일 · 4 : 목요일 · 5 : 금요일 · 6 : 토요일 |
| ↳ `discount_limit_reset_date` |  | 할인 제한 초기화 일자(매월) 1 : 1일 · 5 : 5일 · 10 : 10일 · 15 : 15일 · 20 : 20일 · 25 : 25일 |
| ↳ `discount_limit_begin_date` |  | 할인 제한 시작 일자 |
| ↳ `discount_limit_end_date` |  | 할인 제한 종료 일자 |

응답 예시 (JSON):

```json
{
    "customergroup": {
        "shop_no": 1,
        "auto_update": "T",
        "use_auto_update": "T",
        "customer_tier_criteria": "purchase_amount_and_purchase_count",
        "standard_purchase_amount": "total_order_amount",
        "offline_purchase_amount": null,
        "standard_purchase_count": "order_count",
        "offline_purchase_count": null,
        "auto_update_criteria": "payment_complete",
        "deduct_cancellation_refund": "T",
        "interval_auto_update": "1m",
        "total_period": "1m",
        "interval_week": null,
        "interval_month": 5,
        "auto_update_set_date": "2022-12-05 03:00:00",
        "use_discount_limit": "T",
        "discount_limit_reset_period": "1m",
        "discount_limit_reset_week": null,
        "discount_limit_reset_date": 5,
        "discount_limit_begin_date": "2022-12-05",
        "discount_limit_end_date": "2023-01-05"
    }
}
```
