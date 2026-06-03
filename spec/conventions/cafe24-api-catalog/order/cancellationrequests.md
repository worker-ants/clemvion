---
resource: order
entity: cancellationrequests
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#cancellationrequests
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Order / Cancellationrequests

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Cancellationrequests](https://developers.cafe24.com/docs/ko/api/admin/#cancellationrequests)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

취소요청(Cancellationrequests)은 주문에 대한 취소요청에 관한 기능입니다. · 취소를 요청하거나 취소요청중인 주문을 접수거부 할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `order_id` |  | 주문번호 |
| `items` |  | 품주 목록 |
| `undone` |  | 접수거부 여부 |
| `order_item_code` |  | 품주코드 |

## Operations

### `POST /api/v2/admin/cancellationrequests` — Create a cancellation request for multiple items

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 100
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-cancellation-request-for-multiple-items

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `reason_type` | ✓ |  |  | 취소사유 구분 A:고객변심 · B:배송지연 · G:서비스불만족 · I:기타 |
| `reason` | ✓ | 최대글자수 : [2000자] |  | 취소사유 |
| `refund_bank_code` |  |  |  | 환불 은행 코드 환불 방식(refund_method)이 현금(T)일 경우 필수 · refund_bank_code · 해당 쇼핑몰이 EC Korea 쇼핑몰일 경우 필수 · 환불수단(refund_method)이 "현금(T)"일 때만 사용 가능 · 오픈마켓/네이버페이 주문을 취소할 경우 사용 불가 |
| `refund_bank_name` |  | 최대글자수 : [250자] |  | 환불은행명 |
| `refund_bank_account_no` |  |  |  | 환불 계좌번호 |
| `refund_bank_account_holder` |  | 최대글자수 : [15자] |  | 환불계좌 예금주 명의 |
| `items` |  |  |  | 품주 목록 |
| ↳ `order_item_code` | ✓ |  |  | 품주코드 |
| ↳ `quantity` | ✓ |  |  | 수량 |

### `PUT /api/v2/admin/cancellationrequests` — Reject a cancellation request for multiple items

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 100
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#reject-a-cancellation-request-for-multiple-items

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `order_item_code` | ✓ |  |  | 품주코드 |
| `undone` | ✓ |  |  | 접수거부 여부 T : 접수거부함 |
| `reason_type` |  |  |  | 사유 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| `reason` |  | 최대글자수 : [2000자] |  | 사유 |
| `display_reject_reason` |  |  | F | 주문상세내역 노출설정 T : 노출함 · F : 노출안함 |
| `reject_reason` |  | 최대글자수 : [2000자] |  | 거부 사유 |
