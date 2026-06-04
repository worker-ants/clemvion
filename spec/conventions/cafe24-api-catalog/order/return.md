---
resource: order
entity: return
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#return
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
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

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `return` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `claim_code` |  | 반품번호 |
| ↳ `claim_reason_type` |  | 구분 판매자의 반품 접수 사유 구분. · 구매자의 반품 신청 사유는 items(품목 주문) > claim_reason_type으로 조회할 수 있다. A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| ↳ `claim_reason` |  | 사유 판매자의 반품 접수 사유 상세 내용. · 구매자의 반품 신청 사유 상세 내용은 items(품목 주문) > claim_reason으로 조회할 수 있다. |
| ↳ `claim_due_date` |  | 반품처리 예정일 |
| ↳ `return_address` |  | 반품주소 |
| ↳ ↳ `zipcode` |  | 우편번호 |
| ↳ ↳ `address1` |  | 기본 주소 |
| ↳ ↳ `address2` |  | 상세 주소 |
| ↳ ↳ `items` |  | 품주코드 |
| ↳ `pickup` |  | 수거지역 상세 |
| ↳ ↳ `use_pickup` |  |  |
| ↳ ↳ `same_address` |  |  |
| ↳ ↳ `name` |  | 이름 |
| ↳ ↳ `phone` |  | 전화번호 |
| ↳ ↳ `cellphone` |  | 휴대전화 |
| ↳ ↳ `zipcode` |  | 우편번호 |
| ↳ ↳ `address` |  |  |
| ↳ `return_invoice_no` | 최대글자수 : [40자] | 반품 송장 번호 |
| ↳ `return_shipping_company_name` | 최대글자수 : [30자] | 반품 배송업체명 |
| ↳ `pickup_request_state` |  | 수거 신청 상태 E : 수거 미신청 · W : 수거 미접수 · S : 수거접수대기(송장발급전) · F : 수거접수실패 · T : 수거접수완료(송장발급완료) · N : 미집하 |
| ↳ `refund_methods` |  | 환불 방식 |
| ↳ `refund_reason` |  | 비고 |
| ↳ `order_price_amount` |  | 상품구매금액 |
| ↳ `refund_amounts` |  | 환불금액 |
| ↳ ↳ `payment_method` |  |  |
| ↳ ↳ `amount` |  | 적립금 증감액 1회당 최대 1,000,000원 이하까지 적립금을 지급할 수 있음. · 가용 적립금보다 큰 금액을 차감할 수 없다. |
| ↳ `shipping_fee` |  | 배송비 DEFAULT 0.00 |
| ↳ `refund_shipping_fee` |  | 환불배송비 DEFAULT 0.00 |
| ↳ `refund_regional_surcharge` |  | 지역별 환불배송비 DEFAULT 0.00 |
| ↳ `return_ship_type` |  | 반품배송비 적용구분 |
| ↳ `return_shipping_fee` |  | 반품배송비 DEFAULT 0.00 |
| ↳ `return_shipping_fee_detail` |  | 반품배송비 상세 |
| ↳ ↳ `group_no` |  |  |
| ↳ ↳ `return_shipping_fee` |  | 반품배송비 DEFAULT 0.00 |
| ↳ ↳ `items` |  | 품주코드 |
| ↳ `return_regional_surcharge` |  | 지역별 반품배송비 DEFAULT 0.00 |
| ↳ `return_regional_surcharge_detail` |  | 지역별 반품배송비 상세 |
| ↳ ↳ `group_no` |  |  |
| ↳ ↳ `return_shipping_fee` |  | 반품배송비 DEFAULT 0.00 |
| ↳ ↳ `items` |  | 품주코드 |
| ↳ `additional_shipping_fee` |  | 추가 배송비 DEFAULT 0.00 |
| ↳ `international_shipping_insurance` |  | 해외배송 보험료 DEFAULT 0.00 |
| ↳ `international_shipping_additional_fee` |  | 해외배송 부가금액 DEFAULT 0.00 |
| ↳ `defer_commission` |  | 후불 결제 수수료 |
| ↳ `partner_discount_amount` |  | 제휴할인 취소액 |
| ↳ `add_discount_amount` |  | 상품별추가할인 취소액 |
| ↳ `member_grade_discount_amount` |  | 회원등급할인 취소액 |
| ↳ `shipping_discount_amount` |  | 배송비할인 취소액 |
| ↳ `coupon_discount_amount` |  | 쿠폰할인 취소액 |
| ↳ `point_used` |  | 사용된 적립금 반환액 |
| ↳ `credit_used` |  | 사용된 예치금 반환액 |
| ↳ `undone` |  | 철회 여부 T : 철회함 · F : 철회안함 |
| ↳ `undone_reason_type` |  | 철회 사유 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| ↳ `undone_reason` |  | 철회 사유 |
| ↳ `expose_order_detail` |  | 주문상세내역 노출 여부 T : 노출함 · F : 노출안함 |
| ↳ `exposed_undone_reason` |  | 주문상세내역 노출 철회 사유 |
| ↳ `items` |  | 품주코드 |
| ↳ ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ ↳ `item_no` |  | 품주 아이디 품목별 주문번호의 아이디 |
| ↳ ↳ `order_item_code` |  | 품주코드 |
| ↳ ↳ `variant_code` |  |  |
| ↳ ↳ `product_no` |  |  |
| ↳ ↳ `product_code` |  | 상품코드 |
| ↳ ↳ `custom_product_code` | 최대글자수 : [40자] | 자체상품 코드 |
| ↳ ↳ `eng_product_name` |  |  |
| ↳ ↳ `option_id` |  | 상품옵션 아이디 |
| ↳ ↳ `option_value` |  | 옵션값 |
| ↳ ↳ `option_value_default` |  | 기본옵션값 |
| ↳ ↳ `additional_option_value` |  | 추가입력 옵션 값 |
| ↳ ↳ `additional_option_values` |  | 추가입력 옵션 |
| ↳ ↳ ↳ `key` |  |  |
| ↳ ↳ ↳ `type` |  |  |
| ↳ ↳ ↳ `name` |  | 이름 |
| ↳ ↳ ↳ `value` |  |  |
| ↳ ↳ `product_name` | 최대글자수 : [250자] | 상품명 |
| ↳ ↳ `product_name_default` |  | 기본 상품명 |
| ↳ ↳ `product_price` |  |  |
| ↳ ↳ `option_price` |  | 옵션 추가 가격 |
| ↳ ↳ `additional_discount_price` |  | 상품추가할인액 상품에 대한 추가 할인금액 |
| ↳ ↳ `coupon_discount_price` |  |  |
| ↳ ↳ `app_item_discount_amount` |  | 앱 상품할인금액 |
| ↳ ↳ `quantity` |  | 수량 |
| ↳ ↳ `supplier_product_name` |  | 공급사 상품명 공급사의 상품명 |
| ↳ ↳ `supplier_transaction_type` |  | 공급사 거래 유형 공급사의 거래 유형 D: 직등록형 · P: 수수료형 |
| ↳ ↳ `supplier_id` | 형식 : [a-z0-9]; 글자수 최소: [4자]~최대: [16자] | 공급사 아이디 |
| ↳ ↳ `supplier_name` | 최대글자수 : [100자] | 공급사명 |
| ↳ ↳ `tracking_no` |  |  |
| ↳ ↳ `shipping_code` |  | 배송번호 |
| ↳ ↳ `claim_code` |  | 반품번호 |
| ↳ ↳ `claim_reason_type` |  | 구분 판매자의 반품 접수 사유 구분. · 구매자의 반품 신청 사유는 items(품목 주문) > claim_reason_type으로 조회할 수 있다. A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| ↳ ↳ `claim_reason` |  | 사유 판매자의 반품 접수 사유 상세 내용. · 구매자의 반품 신청 사유 상세 내용은 items(품목 주문) > claim_reason으로 조회할 수 있다. |
| ↳ ↳ `refund_bank_name` | 최대글자수 : [250자] | 환불은행명 환불 방식(refund_method)이 현금(T)일 경우 필수 · ※ 해당 쇼핑몰이 EC Global 쇼핑몰일 경우 필수 · 환불수단(refund_method)이 "현금(T)"일 때만 사용 가능 |
| ↳ ↳ `refund_bank_account_no` |  | 환불 계좌번호 환불수단(refund_method)이 "현금(T)"일 때만 사용 가능 |
| ↳ ↳ `refund_bank_account_holder` | 최대글자수 : [15자] | 환불계좌 예금주 명의 |
| ↳ ↳ `post_express_flag` |  | 우체국 택배연동 |
| ↳ ↳ `order_status` |  | 주문상태 |
| ↳ ↳ `order_status_additional_info` |  | 주문상태 추가정보 주문상태의 추가정보 |
| ↳ ↳ `claim_quantity` |  | 취소/교환/반품 요청 수량 |
| ↳ ↳ `status_code` |  | 현재 처리상태 코드 현재 처리상태의 코드 N1 : 정상 · N2 : 교환상품 · C1 : 입금전취소 · C2 : 배송전취소 · C3 : 반품 · E1 : 교환 |
| ↳ ↳ `status_text` |  | 현재 처리상태 현재 처리상태 문구설명 |
| ↳ ↳ `open_market_status` |  | 마켓연동 상태값 |
| ↳ ↳ `bundled_shipping_type` |  | 묶음배송 타입 배송 대상 주문건의 묶음배송 유형 N : 단일 주문 일반 배송(Normal) · C :복합 주문 결합 배송(Combination) |
| ↳ ↳ `shipping_company_id` |  | 배송업체 아이디 |
| ↳ ↳ `shipping_company_name` |  |  |
| ↳ ↳ `shipping_company_code` |  | 배송업체 코드 |
| ↳ ↳ `product_bundle` |  | 세트상품 여부 |
| ↳ ↳ `product_bundle_no` |  | 세트상품번호 |
| ↳ ↳ `product_bundle_name` |  | 세트상품명 분리형 세트상품의 이름 · 일체형 세트 상품의 이름은 product_name에서 표시됨 |
| ↳ ↳ `product_bundle_name_default` |  | 세트상품명(기본) 분리형 세트상품의 이름 · 일체형 세트 상품의 이름은 product_name에서 표시됨 |
| ↳ ↳ `product_bundle_type` |  |  |
| ↳ ↳ `was_product_bundle` |  |  |
| ↳ ↳ `original_bundle_item_no` |  | 분리된 세트상품의 기존 품주번호 |
| ↳ ↳ `naver_pay_order_id` |  | 네이버페이 상품별 주문번호 네이버페이 주문의 상품별 주문번호 |
| ↳ ↳ `naver_pay_claim_status` |  | 네이버페이 클레임 타입 네이버페이 주문의 클레임 타입 PAYMENT_WAITING : 입금대기 · PAYED : 결제완료 · DELIVERING : 배송중 · DELIVERED : 배송완료 · PURCHASE_DECIDED : 구매확정 · EXCHANGED : 교환 · CANCELED : 취소 · RETURNED : 반품 · CANCELED_BY_NOPAYMENT : 미입금취소 · NOT_YET : 발주 미확인 · OK : 발주 확인 · CANCEL : 발주 확인 해제 · CANCEL_REQUEST : 취소요청 · CANCELING : 취소처리중 · CANCEL_DONE : 취소처리완료 · CANCEL_REJECT : 취소철회 · RETURN_REQUEST : 반품요청 · COLLECTING : 수거처리중 · COLLECT_DONE : 수거완료 · RETURN_DONE : 반품완료 · RETURN_REJECT : 반품철회 · EXCHANGE_REQUEST : 교환요청 · COLLECTING : 수거처리중 · COLLECT_DONE : 수거완료 · EXCHANGE_REDELIVERING : 교환 재배송 중 · EXCHANGE_DONE : 교환완료 · EXCHANGE_REJECT : 교환거부 · PURCHASE_DECISION_HOLDBACK : 구매 확정 보류 · PURCHASE_DECISION_HOLDBACK_REDELIVERING : 구매 확정 보류 재배송 중 · PURCHASE_DECISION_REQUEST : 구매 확정 요청 · PURCHASE_DECISION_HOLDBACK_RELEASE : 구매 확정 보류 해제 · ADMIN_CANCELING : 직권 취소 중 · ADMIN_CANCEL_DONE : 직권 취소 완료 |
| ↳ ↳ `individual_shipping_fee` |  |  |
| ↳ ↳ `shipping_fee_type` |  |  |
| ↳ ↳ `shipping_fee_type_text` |  | 배송비타입 배송비 타입 설명 |
| ↳ ↳ `shipping_payment_option` |  |  |
| ↳ ↳ `payment_info_id` |  | 결제정보 아이디 |
| ↳ ↳ `original_item_no` |  | 기존 품주 아이디 |
| ↳ ↳ `store_pickup` |  |  |
| ↳ ↳ `ordered_date` |  | 주문일 |
| ↳ ↳ `shipped_date` |  | 배송시작일 배송 시작일 |
| ↳ ↳ `delivered_date` |  | 배송완료일 배송 완료일 |
| ↳ ↳ `cancel_date` |  | 주문취소일 |
| ↳ ↳ `return_request_date` |  | 반품요청일 반품 요청일 |
| ↳ ↳ `return_confirmed_date` |  | 반품승인일시 |
| ↳ ↳ `return_collected_date` |  | 반품수거일 |
| ↳ ↳ `cancel_request_date` |  | 취소요청일 주문취소 요청일 |
| ↳ ↳ `refund_date` |  |  |
| ↳ ↳ `exchange_request_date` |  | 교환요청일 교환 요청일 |
| ↳ ↳ `exchange_date` |  | 교환완료일 교환 완료일 |
| ↳ ↳ `product_material` |  | 상품소재 |
| ↳ ↳ `product_material_eng` |  | 영문 상품 소재 상품소재 영문 설명 |
| ↳ ↳ `cloth_fabric` |  |  |
| ↳ ↳ `product_weight` |  |  |
| ↳ ↳ `volume_size` |  | 상품 부피 상품의 부피 |
| ↳ ↳ `volume_size_weight` |  | 상품 부피 무게 상품의 부피 무게 |
| ↳ ↳ `clearance_category` |  | 해외통관용 상품구분 |
| ↳ ↳ `clearance_category_info` |  | 해외통관용 상품정보 |
| ↳ ↳ `clearance_category_code` | 형식 : [A-Z0-9]; 글자수 최소: [8자]~최대: [8자] | 해외통관코드 |
| ↳ ↳ `hs_code` |  | HS코드 |
| ↳ ↳ `one_plus_n_event` |  | 1+N이벤트 여부 1개 구매시 N개 증정하는 이벤트 여부 |
| ↳ ↳ `origin_place` |  | 원산지정보 상품의 원산지 |
| ↳ ↳ `gift` |  |  |
| ↳ ↳ `item_granting_gift` |  | 사은품증정 조건품주목록 |
| ↳ ↳ `product_bundle_list` |  | 세트상품 목록 |
| ↳ ↳ ↳ `product_no` |  |  |
| ↳ ↳ ↳ `product_code` |  | 상품코드 |
| ↳ ↳ ↳ `variant_code` |  |  |
| ↳ ↳ ↳ `product_name` | 최대글자수 : [250자] | 상품명 |
| ↳ ↳ ↳ `product_name_default` |  | 기본 상품명 |
| ↳ ↳ ↳ `option_id` |  | 상품옵션 아이디 |
| ↳ ↳ ↳ `option_value` |  | 옵션값 |
| ↳ ↳ ↳ `option_value_default` |  | 기본옵션값 |
| ↳ ↳ ↳ `additional_option_value` |  | 추가입력 옵션 값 |
| ↳ ↳ ↳ `additional_option_values` |  | 추가입력 옵션 |
| ↳ ↳ ↳ ↳ `key` |  |  |
| ↳ ↳ ↳ ↳ `type` |  |  |
| ↳ ↳ ↳ ↳ `name` |  | 이름 |
| ↳ ↳ ↳ ↳ `value` |  |  |
| ↳ ↳ ↳ `quantity` |  | 수량 |
| ↳ ↳ ↳ `supplier_id` | 형식 : [a-z0-9]; 글자수 최소: [4자]~최대: [16자] | 공급사 아이디 |
| ↳ ↳ ↳ `eng_product_name` |  |  |
| ↳ ↳ ↳ `hs_code` |  | HS코드 |
| ↳ ↳ ↳ `option_price` |  | 옵션 추가 가격 |
| ↳ ↳ `market_cancel_request` |  | 마켓 취소요청 여부 T : 취소 요청된 마켓 주문 |
| ↳ ↳ `market_cancel_request_quantity` |  | 마켓 취소신청 수량 |
| ↳ ↳ `market_fail_reason` |  | 마켓 실패사유 |
| ↳ ↳ `market_fail_reason_guide` |  | 마켓 실패사유 가이드 |
| ↳ ↳ `market_item_sequence` |  |  |
| ↳ ↳ `market_item_no` |  | 외부 품목별 번호 |
| ↳ ↳ `market_custom_variant_code` |  | 마켓 자체 품목 코드 |
| ↳ ↳ `option_type` |  |  |
| ↳ ↳ `options` |  | (목록) |
| ↳ ↳ ↳ `option_code` |  | 연동형 옵션코드 |
| ↳ ↳ ↳ `option_name` |  | 옵션명 |
| ↳ ↳ ↳ `option_value` |  | 옵션값 |
| ↳ ↳ ↳ ↳ `option_text` |  | 옵션값 |
| ↳ ↳ ↳ ↳ `value_no` |  | 연동형 옵션값 |
| ↳ ↳ `market_discount_amount` |  | 상품별 마켓 할인금액 |
| ↳ ↳ `labels` |  | 주문 라벨 |
| ↳ ↳ `order_status_before_cs` |  | CS 전 주문상태 |
| ↳ ↳ `supply_price` |  |  |
| ↳ ↳ `multi_invoice` |  | 멀티 송장 |
| ↳ ↳ `shipping_expected_date` |  | 발송예정일 |
| ↳ ↳ `dropshipping_type` |  |  |
| ↳ `include_tax` |  | 가격에 세금 포함 T: 세금포함 · F: 세금제외 |
| ↳ `tax` |  | 세금 정보 세금 관리자 앱을 사용 안 할 경우 null로 반환 |
| ↳ ↳ `name` |  | 이름 |
| ↳ ↳ `amount` |  | 적립금 증감액 1회당 최대 1,000,000원 이하까지 적립금을 지급할 수 있음. · 가용 적립금보다 큰 금액을 차감할 수 없다. |
| ↳ `carrier_id` |  | 배송사 아이디 |
| ↳ `return_invoice_success` |  | 반송장 처리 성공 여부 T : 성공 · F : 실패 · N : 미집하 |
| ↳ `return_invoice_fail_reason` |  | 반송장 처리 실패 사유 |
| ↳ `cancel_fee_amount` |  | 취소수수료 |

응답 예시 (JSON):

```json
{
    "return": {
        "shop_no": 1,
        "order_id": "20190607-0000018",
        "claim_code": "C20190610-0000001",
        "claim_reason_type": "A",
        "claim_reason": "Returns accepted",
        "claim_due_date": "2019-06-10",
        "return_address": {
            "zipcode": "07071",
            "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
            "address2": "Professional Construction Hall",
            "items": [
                "20190607-0000018-01",
                "20190607-0000018-02"
            ]
        },
        "pickup": {
            "use_pickup": "F",
            "same_address": null,
            "name": null,
            "phone": null,
            "cellphone": null,
            "zipcode": null,
            "address": null
        },
        "return_invoice_no": "12345678",
        "return_shipping_company_name": "DHL",
        "pickup_request_state": "E",
        "refund_methods": [
            "Refund to points",
            "Refund to card"
        ],
        "refund_reason": "Remark notes",
        "order_price_amount": "15000.00",
        "refund_amounts": [
            {
                "payment_method": "point",
                "amount": "160.00"
            },
            {
                "payment_method": "card",
                "amount": "160.00"
            }
        ],
        "shipping_fee": "2000.00",
        "refund_shipping_fee": "7000.00",
        "refund_regional_surcharge": "5000.00",
        "return_ship_type": "Charge",
        "return_shipping_fee": "-5000.00",
        "return_shipping_fee_detail": [
            {
                "group_no": 278,
                "return_shipping_fee": "-2500.00",
                "items": [
                    "20190607-0000018-01",
                    "20190607-0000018-02"
                ]
            },
            {
                "group_no": 279,
                "return_shipping_fee": "-2500.00",
                "items": [
                    "20190607-0000018-03",
                    "20190607-0000018-04"
                ]
            }
        ],
        "return_regional_surcharge": "-5000.00",
        "return_regional_surcharge_detail": [
            {
                "group_no": 280,
                "return_shipping_fee": "-2500.00",
                "items": [
                    "20190607-0000018-01",
                    "20190607-0000018-02"
                ]
            },
            {
                "group_no": 281,
                "return_shipping_fee": "-2500.00",
                "items": [
                    "20190607-0000018-03",
                    "20190607-0000018-04"
                ]
            }
        ],
        "additional_shipping_fee": "0.00",
        "international_shipping_insurance": "0.00",
        "international_shipping_additional_fee": "0.00",
        "defer_commission": "0.00",
        "partner_discount_amount": "0.00",
        "add_discount_amount": "0.00",
        "member_grade_discount_amount": "0.00",
        "shipping_discount_amount": "0.00",
        "coupon_discount_amount": "0.00",
        "point_used": "-15000.00",
        "credit_used": "0.00",
        "undone": "F",
        "undone_reason_type": null,
        "undone_reason": null,
        "expose_order_detail": null,
        "exposed_undone_reason": null,
        "items": [
            {
                "shop_no": 1,
                "item_no": 1,
                "order_item_code": "20190607-0000018-01",
                "variant_code": "P000000N000A",
                "product_no": 14,
                "product_code": "P000000N",
                "custom_product_code": "",
                "eng_product_name": null,
                "option_id": "000A",
                "option_value": "",
                "option_value_default": "",
                "additional_option_value": "",
                "additional_option_values": [
                    {
                        "key": "item_option_add",
                        "type": "text",
                        "name": "gift option",
                        "value": "yes"
                    },
                    {
                        "key": "item_option_add",
                        "typeitem_granting_gift": "url",
                        "name": "Attached File",
                        "value": "http://sample.com/api/product/fileupload/?cmd=download&path=b%2Fe%2Fbee9c3eb338e6161886c8e6fefedbd4a5c170bac0dfc4&filename=35_shop1_123081.gif"
                    }
                ],
                "product_name": "iPhone X",
                "product_name_default": "iPhone X",
                "product_price": "30000.00",
                "option_price": "0.00",
                "additional_discount_price": "0.00",
                "coupon_discount_price": "1000.00",
                "app_item_discount_amount": "0.00",
                "quantity": 1,
                "supplier_product_name": "",
                "supplier_transaction_type": "D",
                "supplier_id": "S0000000",
                "supplier_name": "Apple",
                "tracking_no": "12345678",
                "shipping_code": "D-20190607-0000018-00",
                "claim_code": "C20190107-0000001",
                "claim_reason_type": "A",
                "claim_reason": "Sorry. I will cancel order for one item.",
                "refund_bank_name": "Woori Bank",
                "refund_bank_account_no": "1234567890",
                "refund_bank_account_holder": "Holders Name",
                "post_express_flag": null,
                "order_status": "N40",
                "order_status_additional_info": null,
                "claim_quantity": 0,
                "status_code": "N1",
                "status_text": "Shipping Complete",
                "open_market_status": "",
                "bundled_shipping_type": "N",
                "shipping_company_id": "2",
                "shipping_company_name": "DHL",
                "shipping_company_code": "0001",
                "product_bundle": "F",
                "product_bundle_no": "0",
                "product_bundle_name": null,
                "product_bundle_name_default": null,
                "product_bundle_type": "C",
                "was_product_bundle": null,
                "original_bundle_item_no": null,
                "naver_pay_order_id": null,
                "naver_pay_claim_status": "PAYMENT_WAITING",
                "individual_shipping_fee": "0.00",
                "shipping_fee_type": "X",
                "shipping_fee_type_text": "Free",
                "shipping_payment_option": "F",
                "payment_info_id": "0",
                "original_item_no": [
                    242,
                    473
                ],
                "store_pickup": "F",
                "ordered_date": "2019-06-07T15:55:51+09:00",
                "shipped_date": "2019-06-07T15:56:52+09:00",
                "delivered_date": "2019-06-07T15:57:05+09:00",
                "cancel_date": null,
                "return_request_date": null,
                "return_confirmed_date": null,
                "return_collected_date": null,
                "cancel_request_date": null,
                "refund_date": null,
                "exchange_request_date": null,
                "exchange_date": null,
                "product_material": null,
                "product_material_eng": null,
                "cloth_fabric": null,
                "product_weight": "1.00",
                "volume_size": null,
                "volume_size_weight": null,
                "clearance_category": null,
                "clearance_category_info": null,
                "clearance_category_code": null,
                "hs_code": "",
                "one_plus_n_event": null,
                "origin_place": " ",
                "gift": "F",
                "item_granting_gift": null,
                "product_bundle_list": [
                    {
                        "product_no": 15,
                        "product_code": "P000000I",
                        "variant_code": "P000000P000A",
                        "product_name": "Sample Product 1",
                        "product_name_default": "Sample Product 1",
                        "option_id": "000A",
                        "option_value": "",
                        "option_value_default": "",
                        "additional_option_value": "",
                        "additional_option_values": [
                            {
                                "key": "item_option_add",
                                "type": "text",
                                "name": "gift option",
                                "value": "yes"
                            },
                            {
                                "key": "item_option_add",
                                "type": "url",
                                "name": "Attached File",
                                "value": "http://sample.com/api/product/fileupload/?cmd=download&path=b%2Fe%2Fbee9c3eb338e6161886c8e6fefedbd4a5c170bac0dfc4&filename=35_shop1_123081.gif"
                            }
                        ],
                        "quantity": 1,
                        "supplier_id": "S0000000",
                        "eng_product_name": null,
                        "hs_code": "0201100000",
                        "option_price": "0.00"
                    },
                    {
                        "product_no": 16,
                        "product_code": "P000000Q",
                        "variant_code": "P000000Q000A",
                        "product_name": "Sample Product 3",
                        "product_name_default": "Sample Product 3",
                        "option_id": "000A",
                        "option_value": "",
                        "option_value_default": "",
                        "additional_option_value": "",
                        "additional_option_values": [
                            {
                                "key": "item_option_add",
                                "type": "text",
                                "name": "gift option",
                                "value": "yes"
                            },
                            {
                                "key": "item_option_add",
                                "type": "url",
                                "name": "Attached File",
                                "value": "http://sample.com/api/product/fileupload/?cmd=download&path=b%2Fe%2Fbee9c3eb338e6161886c8e6fefedbd4a5c170bac0dfc4&filename=35_shop1_123081.gif"
                            }
                        ],
                        "quantity": 1,
                        "supplier_id": "S0000000",
                        "eng_product_name": null,
                        "hs_code": "0201201000",
                        "option_price": "0.00"
                    }
                ],
                "market_cancel_request": null,
                "market_cancel_request_quantity": null,
                "market_fail_reason": null,
                "market_fail_reason_guide": null,
                "market_item_sequence": null,
                "market_item_no": null,
                "market_custom_variant_code": null,
                "option_type": "E",
                "options": [
                    {
                        "option_code": "O000000A",
                        "option_name": null,
                        "option_value": {
                            "option_text": null,
                            "value_no": 1
                        }
                    },
                    {
                        "option_code": "O000000B",
                        "option_name": null,
                        "option_value": {
                            "option_text": null,
                            "value_no": 2
                        }
                    }
                ],
                "market_discount_amount": "0.00",
                "labels": null,
                "order_status_before_cs": "N20",
                "supply_price": "1500.00",
                "multi_invoice": null,
                "shipping_expected_date": null,
                "dropshipping_type": "N"
            },
            {
                "shop_no": 1,
                "item_no": 1,
                "order_item_code": "20190607-0000018-02",
                "variant_code": "P000000N000A",
                "product_no": 15,
                "product_code": "P000000N",
                "custom_product_code": "",
                "eng_product_name": null,
                "option_id": "000A",
                "option_value": "",
                "option_value_default": "",
                "additional_option_value": "",
                "additional_option_values": [
                    {
                        "key": "item_option_add",
                        "type": "text",
                        "name": "gift option",
                        "value": "yes"
                    },
                    {
                        "key": "item_option_add",
                        "type": "url",
                        "name": "Attached File",
                        "value": "http://sample.com/api/product/fileupload/?cmd=download&path=b%2Fe%2Fbee9c3eb338e6161886c8e6fefedbd4a5c170bac0dfc4&filename=35_shop1_123081.gif"
                    }
                ],
                "product_name": "iPhone X",
                "product_name_default": "iPhone X",
                "product_price": "30000.00",
                "option_price": "0.00",
                "additional_discount_price": "0.00",
                "coupon_discount_price": "1000.00",
                "app_item_discount_amount": "0.00",
                "quantity": 1,
                "supplier_product_name": "",
                "supplier_transaction_type": "D",
                "supplier_id": "S0000000",
                "supplier_name": "Apple",
                "tracking_no": "12345678",
                "shipping_code": "D-20190607-0000018-00",
                "claim_code": "C20190107-0000001",
                "claim_reason_type": "A",
                "claim_reason": "Sorry. I will cancel order for one item.",
                "refund_bank_name": "Woori Bank",
                "refund_bank_account_no": "1234567890",
                "refund_bank_account_holder": "Holders Name",
                "post_express_flag": null,
                "order_status": "N40",
                "order_status_additional_info": null,
                "status_code": "N1",
                "status_text": "Shipping Complete",
                "open_market_status": "",
                "bundled_shipping_type": "N",
                "shipping_company_id": "2",
                "shipping_company_name": "DHL",
                "shipping_company_code": "0001",
                "product_bundle": "F",
                "product_bundle_no": "0",
                "product_bundle_name": null,
                "product_bundle_name_default": null,
                "product_bundle_type": "C",
                "was_product_bundle": null,
                "original_bundle_item_no": null,
                "naver_pay_order_id": null,
                "naver_pay_claim_status": "PAYMENT_WAITING",
                "individual_shipping_fee": "0.00",
                "shipping_fee_type": "X",
                "shipping_fee_type_text": "Free",
                "shipping_payment_option": "F",
                "payment_info_id": "0",
                "original_item_no": [
                    242,
                    473
                ],
                "store_pickup": "F",
                "ordered_date": "2019-06-07T15:55:51+09:00",
                "shipped_date": "2019-06-07T15:56:52+09:00",
                "delivered_date": "2019-06-07T15:57:05+09:00",
                "cancel_date": null,
                "return_request_date": null,
                "return_confirmed_date": null,
                "return_collected_date": null,
                "cancel_request_date": null,
                "refund_date": null,
                "exchange_request_date": null,
                "exchange_date": null,
                "product_material": null,
                "product_material_eng": null,
                "cloth_fabric": null,
                "product_weight": "1.00",
                "volume_size": null,
                "volume_size_weight": null,
                "clearance_category": null,
                "clearance_category_info": null,
                "clearance_category_code": null,
                "hs_code": "",
                "one_plus_n_event": null,
                "origin_place": " ",
                "gift": "F",
                "item_granting_gift": null,
                "product_bundle_list": [
                    {
                        "product_no": 15,
                        "product_code": "P000000I",
                        "variant_code": "P000000P000A",
                        "product_name": "Sample Product 1",
                        "product_name_default": "Sample Product 1",
                        "option_id": "000A",
                        "option_value": "",
                        "option_value_default": "",
                        "additional_option_value": "",
                        "additional_option_values": [
                            {
                                "key": "item_option_add",
                                "type": "text",
                                "name": "gift option",
                                "value": "yes"
                            },
                            {
                                "key": "item_option_add",
                                "type": "url",
                                "name": "Attached File",
                                "value": "http://sample.com/api/product/fileupload/?cmd=download&path=b%2Fe%2Fbee9c3eb338e6161886c8e6fefedbd4a5c170bac0dfc4&filename=35_shop1_123081.gif"
                            }
                        ],
                        "quantity": 1,
                        "supplier_id": "S0000000",
                        "eng_product_name": null,
                        "hs_code": "0201100000",
                        "option_price": "0.00"
                    },
                    {
                        "product_no": 16,
                        "product_code": "P000000Q",
                        "variant_code": "P000000Q000A",
                        "product_name": "Sample Product 3",
                        "product_name_default": "Sample Product 3",
                        "option_id": "000A",
                        "option_value": "",
                        "option_value_default": "",
                        "additional_option_value": "",
                        "additional_option_values": [
                            {
                                "key": "item_option_add",
                                "type": "text",
                                "name": "gift option",
                                "value": "yes"
                            },
                            {
                                "key": "item_option_add",
                                "type": "url",
                                "name": "Attached File",
                                "value": "http://sample.com/api/product/fileupload/?cmd=download&path=b%2Fe%2Fbee9c3eb338e6161886c8e6fefedbd4a5c170bac0dfc4&filename=35_shop1_123081.gif"
                            }
                        ],
                        "quantity": 1,
                        "supplier_id": "S0000000",
                        "eng_product_name": null,
                        "hs_code": "0201201000",
                        "option_price": "0.00"
                    }
                ],
                "market_cancel_request": null,
                "market_cancel_request_quantity": null,
                "market_fail_reason": null,
                "market_fail_reason_guide": null,
                "market_item_sequence": null,
                "market_item_no": null,
                "market_custom_variant_code": null,
                "option_type": "E",
                "options": [
                    {
                        "option_code": "O000000A",
                        "option_name": null,
                        "option_value": {
                            "option_text": null,
                            "value_no": 1
                        }
                    },
                    {
                        "option_code": "O000000B",
                        "option_name": null,
                        "option_value": {
                            "option_text": null,
                            "value_no": 2
                        }
                    }
                ],
                "market_discount_amount": "0.00",
                "labels": null,
                "order_status_before_cs": "N20",
                "supply_price": "1500.00",
                "multi_invoice": null,
                "shipping_expected_date": null,
                "dropshipping_type": "N"
            }
        ],
        "include_tax": "T",
        "tax": [
            {
                "name": "vat",
                "amount": "1000.00"
            },
            {
                "name": "tax",
                "amount": "800.00"
            }
        ],
        "carrier_id": null,
        "return_invoice_success": null,
        "return_invoice_fail_reason": null,
        "cancel_fee_amount": null
    }
}
```

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

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `return` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `status` |  | 주문상태 accepted : 반품접수 · processing : 반품처리중 · returned : 반품완료 |
| ↳ `claim_code` |  | 반품번호 |
| ↳ `pickup_completed` |  | 수거완료 여부 T : 수거완료 · F : 수거전 |
| ↳ `items` |  | 품주코드 |
| ↳ ↳ `order_item_code` |  | 품주코드 |
| ↳ ↳ `quantity` |  | 수량 |

응답 예시 (JSON):

```json
{
    "return": [
        {
            "shop_no": 1,
            "order_id": "20190228-0000011",
            "status": "returned",
            "claim_code": "C20190805-0000007",
            "pickup_completed": "T",
            "items": [
                {
                    "order_item_code": "20190228-0000011-01",
                    "quantity": 4
                },
                {
                    "order_item_code": "20190228-0000011-02",
                    "quantity": 4
                }
            ]
        },
        {
            "shop_no": 1,
            "order_id": "20190228-0000012",
            "status": "returned",
            "claim_code": "C20190805-0000008",
            "pickup_completed": "T",
            "items": [
                {
                    "order_item_code": "20190228-0000012-01",
                    "quantity": 4
                },
                {
                    "order_item_code": "20190228-0000012-02",
                    "quantity": 4
                }
            ]
        }
    ]
}
```

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

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `return` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `claim_code` |  | 반품번호 |
| ↳ `status` |  | 주문상태 accepted : 반품접수 · processing : 반품처리중 · returned : 반품완료 |
| ↳ `pickup_completed` |  | 수거완료 여부 T : 수거완료 · F : 수거전 |
| ↳ `carrier_id` |  | 배송사 아이디 |
| ↳ `return_invoice_no` | 최대글자수 : [40자] | 반품 송장 번호 |
| ↳ `return_shipping_company_name` | 최대글자수 : [30자] | 반품 배송업체명 |
| ↳ `return_invoice_success` |  | 반송장 처리 성공 여부 T : 성공 · F : 실패 · N : 미집하 |
| ↳ `return_invoice_fail_reason` |  | 반송장 처리 실패 사유 |
| ↳ `items` |  | 품주코드 |
| ↳ ↳ `order_item_code` |  | 품주코드 |
| ↳ `refund_method_code` |  | 환불 방식 T : 현금 · F : 신용카드 · M : 적립금 · G : 계좌이체 · C : 휴대폰 · D : 예치금 · Z : 후불 · O : 선불금 · V : 편의점 · J : 제휴상품권 · K : 제휴포인트 · I : 기타 |
| ↳ `refund_bank_code` |  | 환불 은행 코드 환불 방식(refund_method)이 현금(T)일 경우 필수 · refund_bank_code · ※ 해당 쇼핑몰이 EC Korea 쇼핑몰일 경우 필수 |
| ↳ `refund_bank_account_no` |  | 환불 계좌번호 환불수단(refund_method)이 "현금(T)"일 때만 사용 가능 |
| ↳ `refund_bank_account_holder` | 최대글자수 : [15자] | 환불계좌 예금주 명의 |
| ↳ `combined_refund_method` |  |  |
| ↳ `recover_inventory` |  | 재고복구 T : 복구함 · F : 복구안함 |
| ↳ `request_pickup` |  | 수거신청 여부 T : 사용함 · F : 사용안함 |
| ↳ `pickup` |  | 수거지역 상세 |
| ↳ ↳ `name` |  | 이름 |
| ↳ ↳ `phone` |  | 전화번호 |
| ↳ ↳ `cellphone` |  | 휴대전화 |
| ↳ ↳ `zipcode` |  | 우편번호 |
| ↳ ↳ `address1` |  | 기본 주소 |
| ↳ ↳ `address2` |  | 상세 주소 |
| ↳ `undone` |  | 철회 여부 T : 철회함 · F : 철회안함 |
| ↳ `add_memo_too` |  | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |
| ↳ `undone_reason_type` |  | 철회 사유 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| ↳ `undone_reason` |  | 철회 사유 |
| ↳ `expose_order_detail` |  | 주문상세내역 노출 여부 T : 노출함 · F : 노출안함 |
| ↳ `exposed_undone_reason` |  | 주문상세내역 노출 철회 사유 |

응답 예시 (JSON):

```json
{
    "return": [
        {
            "shop_no": 1,
            "order_id": "20190228-0000011",
            "claim_code": "C20190228-0000001",
            "status": "processing",
            "pickup_completed": "T",
            "carrier_id": null,
            "return_invoice_no": null,
            "return_shipping_company_name": null,
            "return_invoice_success": null,
            "return_invoice_fail_reason": null,
            "items": [
                {
                    "order_item_code": "20190228-0000011-01"
                },
                {
                    "order_item_code": "20190228-0000011-02"
                }
            ],
            "refund_method_code": [
                "F",
                "T"
            ],
            "refund_bank_code": "bank_82",
            "refund_bank_account_no": "000000111111",
            "refund_bank_account_holder": "John Doe",
            "combined_refund_method": null,
            "recover_inventory": "T",
            "request_pickup": null,
            "pickup": {
                "name": null,
                "phone": null,
                "cellphone": null,
                "zipcode": null,
                "address1": null,
                "address2": null
            },
            "undone": null,
            "add_memo_too": null,
            "undone_reason_type": null,
            "undone_reason": null,
            "expose_order_detail": null,
            "exposed_undone_reason": null
        },
        {
            "shop_no": 1,
            "order_id": "20190228-0000012",
            "claim_code": "C20190228-0000002",
            "status": "processing",
            "pickup_completed": "T",
            "return_invoice_no": null,
            "return_shipping_company_name": null,
            "return_invoice_success": null,
            "return_invoice_fail_reason": null,
            "items": [
                {
                    "order_item_code": "20190228-0000012-01"
                },
                {
                    "order_item_code": "20190228-0000012-02"
                }
            ],
            "refund_method_code": [
                "F",
                "T"
            ],
            "refund_bank_code": "bank_82",
            "refund_bank_account_no": "000000111111",
            "refund_bank_account_holder": "John Doe",
            "combined_refund_method": null,
            "recover_inventory": "T",
            "request_pickup": null,
            "pickup": {
                "name": null,
                "phone": null,
                "cellphone": null,
                "zipcode": null,
                "address1": null,
                "address2": null
            },
            "undone": null,
            "add_memo_too": null,
            "undone_reason_type": null,
            "undone_reason": null,
            "expose_order_detail": null,
            "exposed_undone_reason": null
        }
    ]
}
```
