---
resource: customer
entity: customers__paymentinformation
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#customers--paymentinformation
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Customer / Customers paymentinformation

> Field-level 카탈로그. Endpoint enumeration index: [`../customer.md`](../customer.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Customers paymentinformation](https://developers.cafe24.com/docs/ko/api/admin/#customers--paymentinformation)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

회원의 결제수단정보(Customers paymentinformation)는 회원이 결제한 결제수단에 대해 목록조회, 삭제가 가능합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `member_id` | 최대글자수 : [20자] | 회원아이디 |
| `payment_method` |  | 결제수단명 |
| `payment_gateway` |  | PG 이름 |
| `created_date` |  | 생성일 |
| `payment_proiority` |  | 결제 우선순위 |
| `payment_method_id` |  | 정기배송 결제수단 번호 |

## Operations

### `GET /api/v2/admin/customers/{member_id}/paymentinformation` — Retrieve a customer's list of payment methods

- **Scope**: `mall.read_customer` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-s-list-of-payment-methods

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `member_id` | ✓ | 최대글자수 : [20자] |  | 회원아이디 |

### `DELETE /api/v2/admin/customers/{member_id}/paymentinformation` — Delete customer's payment information

- **Scope**: `mall.write_customer` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-customer-s-payment-information

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `member_id` | ✓ | 최대글자수 : [20자] |  | 회원아이디 |

### `DELETE /api/v2/admin/customers/{member_id}/paymentinformation/{payment_method_id}` — Delete customer's payment information by payment method ID

- **Scope**: `mall.write_customer` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-customer-s-payment-information-by-payment-method-id

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `member_id` | ✓ | 최대글자수 : [20자] |  | 회원아이디 |
| `payment_method_id` | ✓ | 주문번호 |  | 정기배송 결제수단 번호 |
