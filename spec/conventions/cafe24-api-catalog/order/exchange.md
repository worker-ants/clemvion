---
resource: order
entity: exchange
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#exchange
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Order / Exchange

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Exchange](https://developers.cafe24.com/docs/ko/api/admin/#exchange)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

교환(Exchange)은 주문의 교환 접수 상태를 변경하는 리소스입니다. · 교환 접수를 할 수 있으며 교환이 접수된 주문의 상태를 수정할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `order_id` |  | 주문번호 |
| `claim_code` |  | 반품번호 |
| `claim_reason_type` |  | 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| `claim_reason` |  | 사유 |
| `claim_due_date` |  | 교환처리 예정일 |
| `receiver` |  | 수령자 |
| `reshipping_detail` |  | 교환 재발송 정보 |
| `pickup` |  | 수거지 - 주소 |
| `additional_payment` |  | 추가결제 |
| `return_invoice_no` | 최대글자수 : [40자] | 반품 송장 번호 |
| `return_shipping_company_name` |  | 반품 배송업체명 |
| `refund_methods` |  | 환불 방식 |
| `refund_reason` |  | 비고 |
| `order_price_amount` |  | 상품구매금액 |
| `refund_amounts` |  | 환불금액 |
| `shipping_fee` |  | 배송비 |
| `return_ship_type` |  | 반품배송비 적용구분 |
| `defer_commission` |  | 후불 결제 수수료 |
| `partner_discount_amount` |  | 제휴할인 취소액 |
| `add_discount_amount` |  | 상품별추가할인 취소액 |
| `member_grade_discount_amount` |  | 회원등급할인 취소액 |
| `shipping_discount_amount` |  | 배송비할인 취소액 |
| `coupon_discount_amount` |  | 쿠폰할인 취소액 |
| `point_used` |  | 사용된 적립금 반환액 |
| `credit_used` |  | 사용된 예치금 반환액 |
| `undone` |  | 철회 여부 T : 철회함 · F : 철회안함 |
| `undone_reason_type` |  | 철회 사유 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| `undone_reason` |  | 철회 사유 |
| `expose_order_detail` |  | 주문상세내역 노출 여부 T : 노출함 · F : 노출안함 |
| `exposed_undone_reason` |  | 주문상세내역 노출 철회 사유 |
| `items` |  | 품주코드 |
| `exchanged_items` |  | 교환상품 |
| `include_tax` |  | 가격에 세금 포함 T: 세금포함 · F: 세금제외 |
| `tax` |  | 세금 정보 세금 관리자 앱을 사용 안 할 경우 null로 반환 |
| `carrier_id` |  | 배송사 아이디 |
| `return_invoice_success` |  | 반송장 처리 성공 여부 T : 성공 · F : 실패 · N : 미집하 |
| `return_invoice_fail_reason` | 최대글자수 : [100자] | 반송장 처리 실패 사유 |
| `cancel_fee_amount` |  | 취소수수료 |
| `status` |  | 주문상태 accept : 접수 · collected : 수거완료 · exchanged : 교환완료 |
| `recover_inventory` |  | 재고복구 T : 복구함 · F : 복구안함 |
| `exchanged_after_collected` |  | 수거완료시 교환완료 여부 T : 사용함 · F : 사용안함 |
| `add_memo_too` |  | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |
| `pickup_completed` |  | 수거완료 여부 T : 수거완료 · F : 수거전 |

## Operations

### `GET /api/v2/admin/exchange/{claim_code}` — Retrieve an exchange

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-exchange

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `claim_code` | ✓ |  |  | 교환번호 |

### `POST /api/v2/admin/exchange` — Create multiple exchanges

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 100
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-multiple-exchanges

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `status` | ✓ |  |  | 주문상태 accepted : 교환접수 · exchanged : 교환완료 |
| `recover_inventory` |  |  | F | 재고복구 T : 복구함 · F : 복구안함 |
| `add_memo_too` |  |  | F | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |
| `items` |  |  |  | 품주코드 |
| ↳ `order_item_code` | ✓ |  |  | 품주코드 |
| ↳ `quantity` | ✓ |  |  | 수량 |
| ↳ `exchange_variant_code` |  |  |  | (동일상품 다른 옵션 교환시) 교환 상품 품목 코드 |
| `same_product` | ✓ |  |  | 동일상품교환 여부 T : 동일상품교환 · F : 다른상품교환 |

### `PUT /api/v2/admin/exchange` — Update multiple order exchanges

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 10
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-multiple-order-exchanges

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `claim_code` | ✓ |  |  | 교환번호 |
| `status` |  |  |  | 주문상태 exchanged : 교환완료 |
| `pickup_completed` |  |  |  | 수거완료 여부 T : 수거완료 · F : 수거전 |
| `recover_inventory` |  |  |  | 재고복구 T : 복구함 · F : 복구안함 |
| `exchanged_after_collected` |  |  |  | 수거완료시 교환완료 여부 T : 사용함 · F : 사용안함 |
| `items` |  |  |  | 품주코드 |
| ↳ `order_item_code` |  |  |  | 품주코드 |
| `undone` |  |  |  | 철회 여부 T : 철회함 |
| `add_memo_too` |  |  |  | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |
| `undone_reason_type` |  |  |  | 철회 사유 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| `undone_reason` |  | 최대글자수 : [2000자] |  | 철회 사유 |
| `expose_order_detail` |  |  |  | 주문상세내역 노출 여부 T : 노출함 · F : 노출안함 |
| `exposed_undone_reason` |  | 최대글자수 : [2000자] |  | 주문상세내역 노출 철회 사유 |
| `return_invoice_no` |  | 최대글자수 : [40자] |  | 반품 송장 번호 |
| `carrier_id` |  |  |  | 배송사 아이디 |
| `return_invoice_success` |  |  |  | 반송장 처리 성공 여부 T : 성공 · F : 실패 · N : 미집하 |
| `return_invoice_fail_reason` |  | 최대글자수 : [100자] |  | 반송장 처리 실패 사유 |
