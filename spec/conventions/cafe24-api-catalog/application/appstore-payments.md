---
resource: application
entity: appstore-payments
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#appstore-payments
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Application / Appstore payments

> Field-level 카탈로그. Endpoint enumeration index: [`../application.md`](../application.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Appstore payments](https://developers.cafe24.com/docs/ko/api/admin/#appstore-payments)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

앱스토어 주문을 결제 완료한 경우 앱스토어 결제 조회를 통해 결제 내역을 확인할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `order_id` |  | 결제번호 앱스토어 주문의 주문 ID |
| `payment_status` |  | 결제상태 paid : 결제완료 · refund : 환불 |
| `title` |  | 결제 명 앱스토어 주문의 주문 이름. 주문 생성시 지정이 가능하며, 사용자가 결제시 해당 결제의 내용이 무엇인지 알 수 있는 내용이어야 함. |
| `approval_no` |  | 승인번호 결제 승인 번호 |
| `payment_gateway_name` |  | 결제 PG사 이름 |
| `payment_method` |  | 결제수단 |
| `payment_amount` |  | 결제금액 |
| `refund_amount` |  | 환불금액 |
| `currency` |  | 화폐단위 KRW : ￦ 원 · USD : $ 달러 · JPY : ¥ 엔 · PHP : ₱ 페소 |
| `locale_code` |  | 결제국가 |
| `automatic_payment` |  | 정기과금 여부 T : 사용함 · F : 사용안함 |
| `pay_date` |  | 결제승인일 |
| `refund_date` |  | 환불승인일 |
| `expiration_date` |  | 만료일 |

## Operations

### `GET /api/v2/admin/appstore/payments` — Retrieve a list of Cafe24 Store payments

- **Scope**: `mall.read_application` (read)
- **호출건수 제한**: 10
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-cafe24-store-payments

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `order_id` |  |  |  | 주문번호 조회하고자하는 앱스토어 주문 번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `start_date` | ✓ | 날짜 |  | 검색 시작일 해당일 이후에 결제완료된 주문 검색 |
| `end_date` | ✓ | 날짜 |  | 검색 종료일 해당일 이전에 결제완료된 주문 검색 |
| `currency` |  |  |  | 화폐단위 KRW : ￦ 원 · USD : $ 달러 · JPY : ¥ 엔 · PHP : ₱ 페소 |
| `limit` |  | 최소: [1]~최대: [50] | 20 | 조회결과 최대건수 조회하고자 하는 최대 건수를 지정할 수 있음. · 예) 10 입력시 10건만 표시함. |
| `offset` |  | 최대값: [10000] | 0 | 조회결과 시작위치 |

### `GET /api/v2/admin/appstore/payments/count` — Retrieve a count of Cafe24 Store payments

- **Scope**: `mall.read_application` (read)
- **호출건수 제한**: 10
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-cafe24-store-payments

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `order_id` |  |  |  | 주문번호 조회하고자하는 앱스토어 주문 번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `start_date` | ✓ | 날짜 |  | 검색 시작일 해당일 이후에 결제완료된 주문 검색 |
| `end_date` | ✓ | 날짜 |  | 검색 종료일 해당일 이전에 결제완료된 주문 검색 |
| `currency` |  |  |  | 화폐단위 KRW : ￦ 원 · USD : $ 달러 · JPY : ¥ 엔 · PHP : ₱ 페소 |
