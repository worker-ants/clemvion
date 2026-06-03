---
resource: order
entity: orders__paymenttimeline
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--paymenttimeline
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Order / Orders paymenttimeline

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders paymenttimeline](https://developers.cafe24.com/docs/ko/api/admin/#orders--paymenttimeline)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문의 결제타임라인(Orders paymenttimeline)은 특정 주문의 결제에 대한 시간적인 연대표에 대한 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `payment_no` |  | 결제번호 |
| `payment_settle_type` |  | 결제유형 O : 최초결제 · R : 추가결제 · P : 환불 |
| `order_amount` |  | 주문금액 |
| `additional_payment_amount` |  | 보조 결제금액 |
| `paid_amount` |  | 결제금액 |
| `payment_methods` |  | 결제수단 |
| `payment_datetime` |  | 결제일 |
| `created_datetime` |  | 입력일 |
| `claim_code` |  | 취소/교환/반품 번호 |
| `payment_method_detail` |  | 결제수단별 결제금액 payment_method_detail code |
| `order_amount_detail` |  | 주문금액 상세 order_amount_detail code |

## Operations

### `GET /api/v2/admin/orders/{order_id}/paymenttimeline` — Retrieve payment history of an order

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-payment-history-of-an-order

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `start_date` |  | 날짜 |  | 검색 시작일 |
| `end_date` |  | 날짜 |  | 검색 종료일 |
| `date_type` |  |  |  | 검색날짜 유형 시작일과 종료일 기준으로 기간 검색시 date_type 미입력시 created_datetime 기준으로 검색 진행 created_datetime : 입력일 · payment_datetime : 결제일 |

### `GET /api/v2/admin/orders/{order_id}/paymenttimeline/{payment_no}` — Retrieve payment details of an order

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-payment-details-of-an-order

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `payment_no` | ✓ | 최소값: [1] |  | 결제번호 |
