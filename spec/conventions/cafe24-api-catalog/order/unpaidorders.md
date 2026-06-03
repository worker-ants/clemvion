---
resource: order
entity: unpaidorders
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#unpaidorders
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Order / Unpaidorders

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Unpaidorders](https://developers.cafe24.com/docs/ko/api/admin/#unpaidorders)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

멀티쇼핑몰 번호

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| `order_id` |  | 주문번호 |
| `order_item_code` |  | 품주코드 |
| `order_date` |  | 주문일 |
| `buyer_name` |  | 주문자 이름 |
| `billing_name` |  | 입금자명 |
| `bank_code` |  | 은행코드 bank_code |
| `bank_name` |  | 은행명 |
| `unpaid_amount` |  | 미입금 금액 |
| `accounts` |  | 계좌번호 |
| `payment_method` |  | 결제수단 cash : 무통장 · icash : 가상계좌 |
| `settle_type` |  | 결제타입 S: 기본결제 · E: 추가결제 |
| `payment_no` |  | 결제번호 |

## Operations

### `GET /api/v2/admin/unpaidorders` — Retrieve unpaid orders

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-unpaid-orders

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `start_date` | ✓ | 날짜 |  | 검색 시작일 |
| `end_date` | ✓ | 날짜 |  | 검색 종료일 |
| `payment_method` |  |  |  | 결제수단 ,(콤마)로 여러 건을 검색할 수 있다. cash : 무통장 · icash : 가상계좌 |
| `settle_type` |  |  |  | 결제타입 S: 기본결제 · E: 추가결제 |
| `limit` |  | 최소: [1]~최대: [500] | 10 | 조회결과 최대건수 |
| `offset` |  | 최대값: [15000] | 0 | 조회결과 시작위치 |
| `order` |  |  | desc | 정렬 순서 asc : 순차정렬 · desc : 역순 정렬 |
