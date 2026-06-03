---
resource: order
entity: cashreceipt
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#cashreceipt
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Order / Cashreceipt

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Cashreceipt](https://developers.cafe24.com/docs/ko/api/admin/#cashreceipt)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

현금영수증(Cashreceipts)은 현금으로 구매 후 구매자가 발급 받을 수 있는 결제 증빙입니다. · 현금영수증 리소스를 통해 현금영수증을 발급하거나 수정할 수 있고, 현재까지 발급된 현금영수증을 조회할 수 있습니다. · 현금영수증은 대한민국에만 있는 제도로, 한국 쇼핑몰에서만 사용할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `cashreceipt_no` |  | 현금영수증 번호 |
| `approval_no` |  | 승인번호 |
| `request_date` |  | 신청일자 |
| `order_id` |  | 주문번호 |
| `member_id` |  | 회원아이디 |
| `name` |  | 요청자 이름 |
| `order_price_amount` |  | 상품구매금액 |
| `vat` |  | 부가세 |
| `subtotal` |  | 총 신청금액 |
| `order_status` |  | 주문상태 입금전: unpaid · 미배송: unshipped · 배송중: shipping · 배송대기: standby · 배송완료: shipped · 부분취소: partially_canceled · 전체취소: canceled |
| `status` |  | 처리상태 신청: request · 발행대기: await_issuance · 발행: issued · 발행거부: issuance_rejected · 신청취소: canceled_request · 발행취소: canceled_issuance · 발행실패: failed_issuance |
| `pg_name` |  | 신청결제사 |
| `cash_bill_no` |  | 현금영수증 일련 번호 |
| `partner_id` |  | PG사 발급 가맹점 ID |
| `type` |  | 발행 타입 개인: personal · 사업자: business |
| `company_registration_no` |  | 사업자등록번호 |
| `cellphone` |  | 휴대전화 |
| `tax_amount` |  | 과세금액 |
| `tax_free_amount` |  | 면세금액 |
| `supply_price` |  | 공급가액 |

## Operations

### `GET /api/v2/admin/cashreceipt` — Retrieve a list of cash receipts

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-cash-receipts

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `start_date` | ✓ | 날짜 |  | 검색 시작일 |
| `end_date` | ✓ | 날짜 |  | 검색 종료일 |
| `order_id` |  | 주문번호 |  | 주문번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `approval_no` |  | 최대글자수 : [9자] |  | 승인번호 |
| `name` |  | 최대글자수 : [20자] |  | 요청자 이름 |
| `member_id` |  | 최대글자수 : [20자] |  | 회원아이디 |
| `status` |  |  | all | 처리상태 전체: all · 신청: request · 발행: issued · 신청취소: canceled_request · 발행취소: canceled_issuance · 발행실패: failed_issuance |
| `limit` |  | 최소: [1]~최대: [500] | 10 | 조회결과 최대건수 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |

### `POST /api/v2/admin/cashreceipt` — Create a cash receipt

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-cash-receipt

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `type` | ✓ |  |  | 발행 타입 개인: personal · 사업자: business |
| `company_registration_no` |  | 사업자번호; 최대글자수 : [10자] |  | 사업자등록번호 |
| `cellphone` |  | 모바일; 최대글자수 : [11자] |  | 휴대전화 |

### `PUT /api/v2/admin/cashreceipt/{cashreceipt_no}` — Update a cash receipt

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-cash-receipt

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `cashreceipt_no` | ✓ | 최소값: [1] |  | 현금영수증 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `type` |  |  |  | 발행 타입 개인: personal · 사업자: business |
| `company_registration_no` |  | 사업자번호; 최대글자수 : [10자] |  | 사업자등록번호 |
| `cellphone` |  | 모바일; 최대글자수 : [11자] |  | 휴대전화 |
