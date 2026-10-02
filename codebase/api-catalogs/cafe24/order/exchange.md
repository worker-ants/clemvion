---
resource: order
entity: exchange
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#exchange
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
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

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `exchange` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `claim_code` |  | 반품번호 |
| ↳ `claim_reason_type` |  | 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| ↳ `claim_reason` |  | 사유 |
| ↳ `claim_due_date` |  | 교환처리 예정일 |
| ↳ `receiver` |  | 수령자 |
| ↳ ↳ `name` |  |  |
| ↳ ↳ `phone` |  |  |
| ↳ ↳ `cellphone` |  |  |
| ↳ ↳ `zipcode` |  |  |
| ↳ ↳ `address` |  |  |
| ↳ ↳ `shipping_message` |  | 배송 메세지 |
| ↳ `reshipping_detail` |  | 교환 재발송 정보 |
| ↳ ↳ `name` |  |  |
| ↳ ↳ `phone` |  |  |
| ↳ ↳ `cellphone` |  |  |
| ↳ ↳ `zipcode` |  |  |
| ↳ ↳ `address` |  |  |
| ↳ ↳ `shipping_message` |  | 배송 메세지 |
| ↳ `pickup` |  | 수거지 - 주소 |
| ↳ ↳ `use_pickup` |  |  |
| ↳ ↳ `same_address` |  |  |
| ↳ ↳ `name` |  |  |
| ↳ ↳ `phone` |  |  |
| ↳ ↳ `cellphone` |  |  |
| ↳ ↳ `zipcode` |  |  |
| ↳ ↳ `address` |  |  |
| ↳ `additional_payment` |  | 추가결제 |
| ↳ ↳ `payment_amount` |  |  |
| ↳ ↳ `payment_method` |  |  |
| ↳ ↳ `billing_name` |  |  |
| ↳ ↳ `bank_name` |  | 은행명 |
| ↳ ↳ `bank_accout_no` |  |  |
| ↳ ↳ `bank_account_owner_name` |  | 예금주 |
| ↳ ↳ `order_price_amount` |  | 상품구매금액 |
| ↳ ↳ `shipping_fee` |  | 배송비 |
| ↳ ↳ `additional_shipping_fee` |  | 추가 배송비 |
| ↳ ↳ `postpay_commission` |  |  |
| ↳ ↳ `commission` |  |  |
| ↳ ↳ `credit_spent_amount` |  |  |
| ↳ ↳ `point_spent_amount` |  |  |
| ↳ ↳ `tax` |  | 세금 정보 세금 관리자 앱을 사용 안 할 경우 null로 반환 |
| ↳ ↳ ↳ `name` |  |  |
| ↳ ↳ ↳ `amount` |  | 적립금 증감액 1회당 최대 1,000,000원 이하까지 적립금을 지급할 수 있음. · 가용 적립금보다 큰 금액을 차감할 수 없다. |
| ↳ `return_invoice_no` | 최대글자수 : [40자] | 반품 송장 번호 |
| ↳ `return_shipping_company_name` |  | 반품 배송업체명 |
| ↳ `refund_methods` |  | 환불 방식 |
| ↳ `refund_reason` |  | 비고 |
| ↳ `order_price_amount` |  | 상품구매금액 |
| ↳ `refund_amounts` |  | 환불금액 |
| ↳ ↳ `payment_method` |  |  |
| ↳ ↳ `amount` |  | 적립금 증감액 1회당 최대 1,000,000원 이하까지 적립금을 지급할 수 있음. · 가용 적립금보다 큰 금액을 차감할 수 없다. |
| ↳ `shipping_fee` |  | 배송비 |
| ↳ `return_ship_type` |  | 반품배송비 적용구분 |
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
| ↳ ↳ `custom_variant_code` | 최대글자수 : [40자] | 자체 품목 코드 |
| ↳ ↳ `eng_product_name` |  |  |
| ↳ ↳ `option_id` |  | 상품옵션 아이디 |
| ↳ ↳ `option_value` |  | 옵션값 |
| ↳ ↳ `option_value_default` |  | 기본옵션값 |
| ↳ ↳ `additional_option_value` |  | 추가입력 옵션 값 |
| ↳ ↳ `additional_option_values` |  | 추가입력 옵션 |
| ↳ ↳ ↳ `key` |  |  |
| ↳ ↳ ↳ `type` |  |  |
| ↳ ↳ ↳ `name` |  |  |
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
| ↳ ↳ `claim_reason_type` |  | 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| ↳ ↳ `claim_reason` |  | 사유 |
| ↳ ↳ `refund_bank_name` | 최대글자수 : [250자] | 환불은행명 |
| ↳ ↳ `refund_bank_account_no` |  | 환불 계좌번호 |
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
| ↳ ↳ ↳ ↳ `name` |  |  |
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
| ↳ `exchanged_items` |  | 교환상품 |
| ↳ ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ ↳ `item_no` |  | 품주 아이디 품목별 주문번호의 아이디 |
| ↳ ↳ `order_item_code` |  | 품주코드 |
| ↳ ↳ `variant_code` |  |  |
| ↳ ↳ `product_no` |  |  |
| ↳ ↳ `product_code` |  | 상품코드 |
| ↳ ↳ `custom_product_code` | 최대글자수 : [40자] | 자체상품 코드 |
| ↳ ↳ `custom_variant_code` | 최대글자수 : [40자] | 자체 품목 코드 |
| ↳ ↳ `eng_product_name` |  |  |
| ↳ ↳ `option_id` |  | 상품옵션 아이디 |
| ↳ ↳ `option_value` |  | 옵션값 |
| ↳ ↳ `option_value_default` |  | 기본옵션값 |
| ↳ ↳ `additional_option_value` |  | 추가입력 옵션 값 |
| ↳ ↳ `additional_option_values` |  | 추가입력 옵션 |
| ↳ ↳ ↳ `key` |  |  |
| ↳ ↳ ↳ `type` |  |  |
| ↳ ↳ ↳ `name` |  |  |
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
| ↳ ↳ `claim_reason_type` |  | 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| ↳ ↳ `claim_reason` |  | 사유 |
| ↳ ↳ `refund_bank_name` | 최대글자수 : [250자] | 환불은행명 |
| ↳ ↳ `refund_bank_account_no` |  | 환불 계좌번호 |
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
| ↳ ↳ ↳ ↳ `name` |  |  |
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
| ↳ `carrier_id` |  | 배송사 아이디 |
| ↳ `return_invoice_success` |  | 반송장 처리 성공 여부 T : 성공 · F : 실패 · N : 미집하 |
| ↳ `return_invoice_fail_reason` | 최대글자수 : [100자] | 반송장 처리 실패 사유 |
| ↳ `cancel_fee_amount` |  | 취소수수료 |

응답 예시 (JSON):

```json
{
    "exchange": {
        "shop_no": 1,
        "order_id": "20190607-0000018",
        "claim_code": "B20190610-0000001",
        "claim_reason_type": "A",
        "claim_reason": "Damaged product shipped",
        "claim_due_date": "2019-06-10",
        "receiver": {
            "name": "John Doe",
            "phone": "02-1111-2222",
            "cellphone": "010-1111-2222",
            "zipcode": "07071",
            "address": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
            "shipping_message": ""
        },
        "reshipping_detail": {
            "name": "John Doe",
            "phone": "02-1111-2222",
            "cellphone": "010-1111-2222",
            "zipcode": "07071",
            "address": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
            "shipping_message": ""
        },
        "pickup": {
            "use_pickup": "T",
            "same_address": "T",
            "name": "John Doe",
            "phone": "02-1111-2222",
            "cellphone": "010-111-2222",
            "zipcode": "07071",
            "address": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea"
        },
        "additional_payment": {
            "payment_amount": "10000.00",
            "payment_method": "Cash",
            "billing_name": "John Doe",
            "bank_name": "bank_05",
            "bank_accout_no": "1234567890",
            "bank_account_owner_name": "John Doe",
            "order_price_amount": "10000.00",
            "shipping_fee": "0.00",
            "additional_shipping_fee": "0.00",
            "postpay_commission": "0.00",
            "commission": "0.00",
            "credit_spent_amount": "0.00",
            "point_spent_amount": "0.00",
            "tax": [
                {
                    "name": "vat",
                    "amount": "1000.00"
                },
                {
                    "name": "tax",
                    "amount": "800.00"
                }
            ]
        },
        "return_invoice_no": null,
        "return_shipping_company_name": null,
        "refund_methods": [
            "Refund to points",
            "Refund to card"
        ],
        "refund_reason": "Points for damaged products",
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
        "shipping_fee": "0.00",
        "return_ship_type": "Charge",
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
                "custom_variant_code": "",
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
                "claim_code": "B20190610-0000001",
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
            }
        ],
        "exchanged_items": [
            {
                "shop_no": 1,
                "item_no": 1,
                "order_item_code": "20190607-0000018-01",
                "variant_code": "P000000N000A",
                "product_no": 14,
                "product_code": "P000000N",
                "custom_product_code": "",
                "custom_variant_code": "",
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
                "claim_code": "B20190610-0000001",
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
                    244
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
        "tax": null,
        "carrier_id": null,
        "return_invoice_success": null,
        "return_invoice_fail_reason": null,
        "cancel_fee_amount": null
    }
}
```

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

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `exchange` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `status` |  | 주문상태 accept : 접수 · collected : 수거완료 · exchanged : 교환완료 |
| ↳ `claim_code` |  | 반품번호 |
| ↳ `items` |  | 품주코드 |
| ↳ ↳ `order_item_code` |  | 품주코드 |
| ↳ ↳ `quantity` |  | 수량 |
| ↳ ↳ `exchange_variant_code` |  | (동일상품 다른 옵션 교환시) 교환 상품 품목 코드 |
| ↳ `exchanged_items` |  | 교환상품 |
| ↳ ↳ `order_item_code` |  | 품주코드 |
| ↳ ↳ `origin_order_item_code` |  |  |

응답 예시 (JSON):

```json
{
    "exchange": [
        {
            "shop_no": 1,
            "order_id": "20190805-0000011",
            "status": "accepted",
            "claim_code": "B20190805-0000007",
            "items": [
                {
                    "order_item_code": "20190805-0000011-01",
                    "quantity": 4,
                    "exchange_variant_code": null
                },
                {
                    "order_item_code": "20190805-0000011-02",
                    "quantity": 4,
                    "exchange_variant_code": "P000000R000C"
                }
            ],
            "exchanged_items": [
                {
                    "order_item_code": "20190805-0000011-03",
                    "origin_order_item_code": "20190805-0000011-01"
                },
                {
                    "order_item_code": "20190805-0000011-04",
                    "origin_order_item_code": "20190805-0000011-02"
                }
            ]
        },
        {
            "shop_no": 1,
            "order_id": "20190805-0000012",
            "status": "accepted",
            "claim_code": "B20190805-0000008",
            "items": [
                {
                    "order_item_code": "20190805-0000012-01",
                    "quantity": 4,
                    "exchange_variant_code": null
                },
                {
                    "order_item_code": "20190805-0000012-02",
                    "quantity": 4,
                    "exchange_variant_code": null
                }
            ],
            "exchanged_items": [
                {
                    "order_item_code": "20190805-0000012-03",
                    "origin_order_item_code": "20190805-0000012-01"
                },
                {
                    "order_item_code": "20190805-0000012-04",
                    "origin_order_item_code": "20190805-0000012-02"
                }
            ]
        }
    ]
}
```

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

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `exchange` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `claim_code` |  | 반품번호 |
| ↳ `items` |  | 품주코드 |
| ↳ ↳ `order_item_code` |  | 품주코드 |
| ↳ `status` |  | 주문상태 accept : 접수 · collected : 수거완료 · exchanged : 교환완료 |
| ↳ `pickup_completed` |  | 수거완료 여부 T : 수거완료 · F : 수거전 |
| ↳ `carrier_id` |  | 배송사 아이디 |
| ↳ `return_invoice_no` | 최대글자수 : [40자] | 반품 송장 번호 |
| ↳ `return_invoice_success` |  | 반송장 처리 성공 여부 T : 성공 · F : 실패 · N : 미집하 |
| ↳ `return_invoice_fail_reason` | 최대글자수 : [100자] | 반송장 처리 실패 사유 |
| ↳ `recover_inventory` |  | 재고복구 T : 복구함 · F : 복구안함 |
| ↳ `exchanged_after_collected` |  | 수거완료시 교환완료 여부 T : 사용함 · F : 사용안함 |
| ↳ `undone` |  | 철회 여부 T : 철회함 · F : 철회안함 |
| ↳ `add_memo_too` |  | 관리자 메모에도 추가 T : 사용함 · F : 사용안함 |
| ↳ `undone_reason_type` |  | 철회 사유 구분 A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| ↳ `undone_reason` |  | 철회 사유 |
| ↳ `expose_order_detail` |  | 주문상세내역 노출 여부 T : 노출함 · F : 노출안함 |
| ↳ `exposed_undone_reason` |  | 주문상세내역 노출 철회 사유 |

응답 예시 (JSON):

```json
{
    "exchange": [
        {
            "shop_no": 1,
            "order_id": "20190228-0000011",
            "claim_code": "B20190228-0000001",
            "items": [
                {
                    "order_item_code": "20190228-0000011-01"
                },
                {
                    "order_item_code": "20190228-0000011-02"
                }
            ],
            "status": "processing",
            "pickup_completed": "T",
            "carrier_id": null,
            "return_invoice_no": null,
            "return_invoice_success": null,
            "return_invoice_fail_reason": null,
            "recover_inventory": "T",
            "exchanged_after_collected": null,
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
            "claim_code": "B20190228-0000002",
            "items": [
                {
                    "order_item_code": "20190228-0000012-01"
                },
                {
                    "order_item_code": "20190228-0000012-02"
                }
            ],
            "status": "processing",
            "pickup_completed": "T",
            "carrier_id": null,
            "return_invoice_no": null,
            "return_invoice_success": null,
            "return_invoice_fail_reason": null,
            "recover_inventory": "T",
            "exchanged_after_collected": null,
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
