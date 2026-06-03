---
resource: order
entity: return
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#return
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Order / Return

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Return](https://developers.cafe24.com/docs/ko/api/admin/#return)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

반품(Return)은 쇼핑몰 고객이 배송 후 주문을 취소하는 것을 의미합니다. · 반품 리소스는 반품접수 이후부터 반품완료까지의 주문 상태를 조회할 수 있습니다. · 반품 리소스에서는 반품 정보를 조회하거나 반품을 처리할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `order_id` |  | 주문번호 |
| `claim_code` |  | 반품번호 |
| `claim_reason_type` |  | 구분 판매자의 반품 접수 사유 구분. · 구매자의 반품 신청 사유는 items(품목 주문) > claim_reason_type으로 조회할 수 있다. A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| `claim_reason` |  | 사유 판매자의 반품 접수 사유 상세 내용. · 구매자의 반품 신청 사유 상세 내용은 items(품목 주문) > claim_reason으로 조회할 수 있다. |
| `claim_due_date` |  | 반품처리 예정일 |
| `return_address` |  | 반품주소 |
| `pickup` |  | 수거지역 상세 |
| `return_invoice_no` | 최대글자수 : [40자] | 반품 송장 번호 |
| `return_shipping_company_name` | 최대글자수 : [30자] | 반품 배송업체명 |
| `pickup_request_state` |  | 수거 신청 상태 E : 수거 미신청 · W : 수거 미접수 · S : 수거접수대기(송장발급전) · F : 수거접수실패 · T : 수거접수완료(송장발급완료) · N : 미집하 |
| `refund_methods` |  | 환불 방식 |
| `refund_reason` |  | 비고 |
| `order_price_amount` |  | 상품구매금액 |
| `refund_amounts` |  | 환불금액 |
| `shipping_fee` |  | 배송비 DEFAULT 0.00 |
| `refund_shipping_fee` |  | 환불배송비 DEFAULT 0.00 |
| `refund_regional_surcharge` |  | 지역별 환불배송비 DEFAULT 0.00 |
| `return_ship_type` |  | 반품배송비 적용구분 |
| `return_shipping_fee` |  | 반품배송비 DEFAULT 0.00 |
| `return_shipping_fee_detail` |  | 반품배송비 상세 |
| `return_regional_surcharge` |  | 지역별 반품배송비 DEFAULT 0.00 |
| `return_regional_surcharge_detail` |  | 지역별 반품배송비 상세 |
| `additional_shipping_fee` |  | 추가 배송비 DEFAULT 0.00 |
| `international_shipping_insurance` |  | 해외배송 보험료 DEFAULT 0.00 |
| `international_shipping_additional_fee` |  | 해외배송 부가금액 DEFAULT 0.00 |
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
| `include_tax` |  | 가격에 세금 포함 T: 세금포함 · F: 세금제외 |
| `tax` |  | 세금 정보 세금 관리자 앱을 사용 안 할 경우 null로 반환 |
| `carrier_id` |  | 배송사 아이디 |
| `return_invoice_success` |  | 반송장 처리 성공 여부 T : 성공 · F : 실패 · N : 미집하 |
| `return_invoice_fail_reason` |  | 반송장 처리 실패 사유 |
| `cancel_fee_amount` |  | 취소수수료 |
| `status` |  | 주문상태 accepted : 반품접수 · processing : 반품처리중 · returned : 반품완료 |
| `pickup_completed` |  | 수거완료 여부 T : 수거완료 · F : 수거전 |
| `recover_inventory` |  | 재고복구 T : 복구함 · F : 복구안함 |
| `request_pickup` |  | 수거신청 여부 T : 사용함 · F : 사용안함 |
| `add_memo_too` |  | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |

## Operations

### `GET /api/v2/admin/return/{claim_code}` — Retrieve a return

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-return

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `claim_code` | ✓ |  |  | 반품번호 |

### `POST /api/v2/admin/return` — Create multiple order returns

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 100
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-multiple-order-returns

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `status` | ✓ |  |  | 주문상태 accepted : 반품접수 · processing : 반품처리중 · returned : 반품완료 |
| `pickup_completed` |  |  | F | 수거완료 여부 T : 수거완료 · F : 수거전 |
| `recover_inventory` |  |  | F | 재고복구 T : 복구함 · F : 복구안함 |
| `recover_coupon` |  |  | F | 쿠폰 복원 Youtube shopping 이용 시에는 미제공 T : 복구함 · F : 복구안함 |
| `recover_coupon_no` |  |  |  | 복원할 쿠폰 번호 Youtube shopping 이용 시에는 미제공 |
| `add_memo_too` |  |  | F | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |
| `reason` |  | 최대글자수 : [2000자] |  | 반품사유 |
| `claim_reason_type` |  |  |  | 반품사유 구분 A : 고객변심 · B : 배송지연 · C : 배송불가지역 · L : 수출/통관 불가 · D : 포장불량 · E : 상품불만족 · F : 상품정보상이 · G : 서비스불만족 · H : 품절 · I : 기타 |
| `naverpay_return_reason_type` |  |  |  | 네이버페이 반품사유 구분 Youtube shopping 이용 시에는 미제공 카카오페이 주문을 반품할 경우 사용 불가 EC 베트남, 필리핀, 일본 버전에서는 사용할 수 없음. 51 : 구매 의사 취소 · 52 : 색상 및 사이즈 변경 · 53 : 다른 상품 잘못 주문 · 54 : 서비스 및 상품 불만족 · 55 : 배송 지연 · 56 : 상품 품절 · 57 : 배송 누락 · 58 : 미배송 · 59 : 상품 파손 · 60 : 상품 정보 상이 · 61 : 오배송 · 62 : 색상 등 옵션이 다른 상품 잘못 배송 |
| `refund_method_code` |  |  |  | 환불 방식 T : 현금 · F : 신용카드 · M : 적립금 · G : 계좌이체 · C : 휴대폰 · D : 예치금 · Z : 후불 · O : 선불금 · V : 편의점 · J : 제휴상품권 · K : 제휴포인트 · I : 기타 |
| `refund_bank_code` |  |  |  | 환불 은행 코드 환불 방식(refund_method)이 현금(T)일 경우 필수 · refund_bank_code · ※ 해당 쇼핑몰이 EC Korea 쇼핑몰일 경우 필수 |
| `refund_bank_name` |  | 최대글자수 : [250자] |  | 환불은행명 환불 방식(refund_method)이 현금(T)일 경우 필수 · ※ 해당 쇼핑몰이 EC Global 쇼핑몰일 경우 필수 · 환불수단(refund_method)이 "현금(T)"일 때만 사용 가능 |
| `refund_bank_account_no` |  |  |  | 환불 계좌번호 환불수단(refund_method)이 "현금(T)"일 때만 사용 가능 |
| `refund_bank_account_holder` |  | 최대글자수 : [15자] |  | 환불계좌 예금주 명의 |
| `items` |  |  |  | 품주코드 |
| ↳ `order_item_code` | ✓ |  |  | 품주코드 |
| ↳ `quantity` | ✓ |  |  | 수량 |
| `request_pickup` |  |  |  | 수거신청 여부 T : 사용함 · F : 사용안함 |
| `pickup` |  |  |  | 수거지역 상세 |
| ↳ `name` |  |  |  | 이름 |
| ↳ `phone` |  |  |  | 전화번호 |
| ↳ `cellphone` |  |  |  | 휴대전화 |
| ↳ `zipcode` |  |  |  | 우편번호 |
| ↳ `address1` |  |  |  | 기본 주소 |
| ↳ `address2` |  |  |  | 상세 주소 |
| `return_invoice_no` |  | 최대글자수 : [40자] |  | 반품 송장 번호 |
| `return_shipping_company_name` |  | 최대글자수 : [30자] |  | 반품 배송업체명 |

### `PUT /api/v2/admin/return` — Update a return

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 10
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-return

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `claim_code` | ✓ |  |  | 반품번호 |
| `status` |  |  |  | 주문상태 processing : 반품처리중 · returned : 반품완료 |
| `pickup_completed` |  |  |  | 수거완료 여부 T : 수거완료 · F : 수거전 |
| `carrier_id` |  |  |  | 배송사 아이디 배송사에서 반송장번호 업데이트시 carrier_id 필수 |
| `refund_method_code` |  |  |  | 환불 방식 T : 현금 · F : 신용카드 · M : 적립금 · G : 계좌이체 · C : 휴대폰 · D : 예치금 · Z : 후불 · O : 선불금 · V : 편의점 · J : 제휴상품권 · K : 제휴포인트 · I : 기타 |
| `refund_bank_account_holder` |  | 최대글자수 : [15자] |  | 환불계좌 예금주 명의 |
| `return_invoice_no` |  | 최대글자수 : [40자] |  | 반품 송장 번호 |
| `return_shipping_company_name` |  | 최대글자수 : [30자] |  | 반품 배송업체명 |
| `return_invoice_success` |  |  |  | 반송장 처리 성공 여부 T : 성공 · F : 실패 · N : 미집하 |
| `return_invoice_fail_reason` |  | 최대글자수 : [100자] |  | 반송장 처리 실패 사유 |
| `items` |  |  |  | 품주코드 |
| ↳ `order_item_code` |  |  |  | 품주코드 |
| `recover_coupon` |  |  |  | 쿠폰 복원 Youtube shopping 이용 시에는 미제공 T : 복구함 · F : 복구안함 |
| `recover_coupon_no` |  |  |  | 복원할 쿠폰 번호 Youtube shopping 이용 시에는 미제공 |
| `recover_inventory` |  |  |  | 재고복구 T : 복구함 · F : 복구안함 |
| `request_pickup` |  |  |  | 수거신청 여부 반송지 저장시 기본값은 "수거신청함(T)" T : 사용함 · F : 사용안함 |
| `pickup` |  |  |  | 수거지역 상세 |
| ↳ `name` |  |  |  | 이름 |
| ↳ `phone` |  |  |  | 전화번호 |
| ↳ `cellphone` |  |  |  | 휴대전화 |
| ↳ `zipcode` |  |  |  | 우편번호 |
| ↳ `address1` |  |  |  | 기본 주소 |
| ↳ `address2` |  |  |  | 상세 주소 |
| `undone` |  |  |  | 철회 여부 T : 철회함 |
| `add_memo_too` |  |  |  | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |
| `undone_reason_type` |  |  |  | 철회 사유 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| `undone_reason` |  | 최대글자수 : [2000자] |  | 철회 사유 |
| `expose_order_detail` |  |  |  | 주문상세내역 노출 여부 T : 노출함 · F : 노출안함 |
| `exposed_undone_reason` |  | 최대글자수 : [2000자] |  | 주문상세내역 노출 철회 사유 |
| `refund_bank_code` |  |  |  | 환불 은행 코드 |
| `refund_bank_name` |  | 최대글자수 : [250자] |  | 환불은행명 |
| `refund_bank_account_no` |  |  |  | 환불 계좌번호 |
