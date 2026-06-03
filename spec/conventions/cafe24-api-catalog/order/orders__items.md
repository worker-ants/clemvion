---
resource: order
entity: orders__items
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--items
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Order / Orders items

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders items](https://developers.cafe24.com/docs/ko/api/admin/#orders--items)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

품주(Items)는 쇼핑몰 고객이 주문할 때 구매한 품목 정보입니다. · 쇼핑몰의 품목은 쇼핑몰에서 판매하는 상품의 기본 단위로, 품주에는 구입한 상품의 품목 정보와 더불어, 구매시 선택한 옵션, 주문 수량 등의 정보를 추가로 확인할 수 있습니다. · 품주는 하위 리소스로서 주문(Order) 하위에서만 사용할 수 있습니다. · 품주의 조회와 상태변경, 취소/교환/반품 요청 사유 등의 입력과 수정이 가능합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `item_no` |  | 품주 아이디 품목별 주문번호의 아이디 |
| `order_item_code` |  | 품주코드 품목별 주문번호의 코드 |
| `variant_code` |  | 품목코드 시스템이 품목에 부여한 코드. 해당 쇼핑몰 내에서 품목 코드는 중복되지 않음. |
| `product_no` |  | 상품번호 상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음. |
| `product_code` |  | 상품코드 시스템이 상품에 부여한 코드. 해당 쇼핑몰 내에서 상품코드는 중복되지 않음. |
| `internal_product_name` |  | 상품명(관리용) |
| `custom_product_code` | 최대글자수 : [40자] | 자체상품 코드 |
| `custom_variant_code` |  | 자체 품목 코드 |
| `eng_product_name` |  | 영문 상품명 상품의 영문 이름. 해외 배송 등에 사용 가능함. |
| `option_id` |  | 상품옵션 아이디 상품옵션의 아이디 |
| `option_value` |  | 옵션값 주문한 상품의 옵션값 |
| `option_value_default` |  | 기본옵션값 |
| `additional_option_value` |  | 추가입력 옵션 값 |
| `additional_option_values` |  | 추가입력 옵션 목록 |
| `product_name` |  | 상품명 상품의 이름. 상품명은 상품을 구분하는 가장 기초적인 정보이며 검색 정보가 됨. |
| `product_name_default` |  | 기본 상품명 |
| `product_price` |  | 상품 판매가 상품의 판매가. 멀티쇼핑몰 운영 시에는 판매가를 쇼핑별 화폐단위로 환산하여 보여줌. |
| `option_price` |  | 옵션 추가 가격 옵션별로 해당하는 추가 가격이 있을 경우 그 추가가격. |
| `additional_discount_price` |  | 상품추가할인액 상품에 대한 추가 할인금액 |
| `coupon_discount_price` |  | 상품별 쿠폰 할인금액 |
| `app_item_discount_amount` |  | 앱 상품할인금액 |
| `payment_amount` |  | 품목별 결제금액 쇼핑몰설정 > 주문설정 > 주문 후 설정 > 입금/환불/반품처리 설정 > 취소/교환/반품 접수 시 할인/적립 금액 설정 : 할인금액 자동계산(설정한 이후 접수된 주문부터 적용) · 위 옵션을 설정하지 않은 경우 값이 null로 반환됩니다. |
| `quantity` |  | 수량 주문한 상품의 수량 |
| `product_tax_type` |  | 상품 세금 구분 A : 과세 · B : 면세 · C : 비과세 |
| `tax_rate` |  | 과세율 |
| `supplier_product_name` |  | 공급사 상품명 공급사의 상품명 |
| `supplier_transaction_type` |  | 공급사 거래 유형 공급사의 거래 유형 D: 직등록형 · P: 수수료형 |
| `supplier_id` |  | 공급사 아이디 공급사의 아이디 |
| `supplier_name` |  | 공급사명 공급사의 이름 |
| `tracking_no` |  | 송장번호 |
| `shipping_code` |  | 배송번호 배송번호. 품목별 주문번호를 배송준비중으로 처리하면 시스템이 자동으로 부여하는 번호. |
| `claim_code` |  | 취소/교환/반품 번호 |
| `claim_reason_type` |  | 취소/교환/반품 요청 사유 타입 구매자의 취소/교환/반품 신청 사유 구분. · 판매자의 접수 사유는 각 취소/교환/반품 리소스의 claim_reason_type으로 조회할 수 있다. 구매자 취소 신청 · A:고객변심 · G:서비스불만족 · B:배송지연 · I:기타 · 구매자 교환/반품 신청 · O:고객변심 · P:상품 불만족 · V:상품불량 · W:배송오류 · 판매자 취소/교환/반품 신청 · A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| `claim_reason` |  | 취소/교환/반품 요청 사유 구매자의 취소/교환/반품 신청 사유 상세 내용. · 판매자의 접수 사유는 각 취소/교환/반품 리소스의 claim_reason으로 조회할 수 있다. |
| `refund_bank_name` |  | 환불은행명 |
| `refund_bank_account_no` |  | 환불 계좌번호 |
| `refund_bank_account_holder` |  | 환불계좌 예금주 명의 |
| `post_express_flag` |  | 우체국 택배연동 우체국 택배연동 상태 |
| `order_status` |  | 주문상태 주문상태. 주문 상태별로 각각의 코드가 있음. |
| `request_undone` |  | 철회상태 Cancellation : 취소철회 · Exchange : 교환철회 · Return : 반품철회 |
| `order_status_additional_info` |  | 주문상태 추가정보 주문상태의 추가정보 |
| `claim_quantity` |  | 취소/교환/반품 요청 수량 |
| `status_code` |  | 현재 처리상태 코드 현재 처리상태의 코드 N1 : 정상 · N2 : 교환상품 · C1 : 입금전취소 · C2 : 배송전취소 · C3 : 반품 · E1 : 교환 |
| `status_text` |  | 현재 처리상태 현재 처리상태 문구설명 |
| `open_market_status` |  | 마켓연동 상태값 |
| `bundled_shipping_type` |  | 묶음배송 타입 배송 대상 주문건의 묶음배송 유형 N : 단일 주문 일반 배송(Normal) · C :복합 주문 결합 배송(Combination) |
| `shipping_company_id` |  | 배송업체 아이디 배송업체의 아이디 |
| `shipping_company_name` |  | 배송업체 이름 배송업체의 이름 |
| `shipping_company_code` |  | 배송업체 코드 shipping_company_code |
| `product_bundle` |  | 세트상품 여부 T : 세트상품 · F : 세트상품 아님 |
| `product_bundle_no` |  | 세트상품번호 분리형 세트상품의 번호 · 일체형 세트 상품의 번호는 product_no에서 표시됨. |
| `product_bundle_name` |  | 세트상품명 분리형 세트상품의 이름 · 일체형 세트 상품의 이름은 product_name에서 표시됨 |
| `product_bundle_name_default` |  | 세트상품명(기본) 분리형 세트상품의 이름 · 일체형 세트 상품의 이름은 product_name에서 표시됨 |
| `product_bundle_type` |  | 세트상품 타입 세트상품의 타입 C : 일체형 · S : 분리형 |
| `was_product_bundle` |  | 세트품주 분리여부 세트상품의 품목주문번호 분리 여부 T : 분리되었던 적이 있음 |
| `original_bundle_item_no` |  | 분리된 세트상품의 기존 품주번호 분리형 세트 상품의 기존 품목 번호 |
| `naver_pay_order_id` |  | 네이버페이 상품별 주문번호 네이버페이 주문의 상품별 주문번호 |
| `naver_pay_claim_status` |  | 네이버페이 클레임 타입 네이버페이 주문의 클레임 타입 PAYMENT_WAITING : 입금대기 · PAYED : 결제완료 · DELIVERING : 배송중 · DELIVERED : 배송완료 · PURCHASE_DECIDED : 구매확정 · EXCHANGED : 교환 · CANCELED : 취소 · RETURNED : 반품 · CANCELED_BY_NOPAYMENT : 미입금취소 · NOT_YET : 발주 미확인 · OK : 발주 확인 · CANCEL : 발주 확인 해제 · CANCEL_REQUEST : 취소요청 · CANCELING : 취소처리중 · CANCEL_DONE : 취소처리완료 · CANCEL_REJECT : 취소철회 · RETURN_REQUEST : 반품요청 · COLLECTING : 수거처리중 · COLLECT_DONE : 수거완료 · RETURN_DONE : 반품완료 · RETURN_REJECT : 반품철회 · EXCHANGE_REQUEST : 교환요청 · COLLECTING : 수거처리중 · COLLECT_DONE : 수거완료 · EXCHANGE_REDELIVERING : 교환 재배송 중 · EXCHANGE_DONE : 교환완료 · EXCHANGE_REJECT : 교환거부 · PURCHASE_DECISION_HOLDBACK : 구매 확정 보류 · PURCHASE_DECISION_HOLDBACK_REDELIVERING : 구매 확정 보류 재배송 중 · PURCHASE_DECISION_REQUEST : 구매 확정 요청 · PURCHASE_DECISION_HOLDBACK_RELEASE : 구매 확정 보류 해제 · ADMIN_CANCELING : 직권 취소 중 · ADMIN_CANCEL_DONE : 직권 취소 완료 |
| `individual_shipping_fee` |  | 개별배송비 개별 배송비 |
| `shipping_fee_type` |  | 배송비 타입 (개별배송비를 사용할 경우) 상품의 배송비 타입. · shipping_calculation이 A(자동계산)일 경우 null로 반환. T : 무료 · F : 착불 · D : 차등(금액) · M : 조건(금액) · I : 고정 · N : 비례(수량) · W : 차등(무게) · C : 차등(수량) · X : 기본배송 |
| `shipping_fee_type_text` |  | 배송비타입 배송비 타입 설명 |
| `shipping_payment_option` |  | 선/착불 구분 C : 착불 · P : 선결제 · F : 무료 |
| `payment_info_id` |  | 결제정보 아이디 |
| `original_item_no` |  | 기존 품주 아이디 |
| `store_pickup` |  | 매장수령여부 매장수령 상품 여부 T : 매장수령 · F : 매장수령 아님 |
| `ordered_date` |  | 주문일 |
| `shipped_date` |  | 배송시작일 배송 시작일 |
| `delivered_date` |  | 배송완료일 배송 완료일 |
| `purchaseconfirmation_date` |  | 구매확정일 |
| `cancel_date` |  | 주문취소일 주문 취소일 |
| `return_confirmed_date` |  | 반품승인일시 |
| `return_request_date` |  | 반품요청일 반품 요청일 |
| `return_collected_date` |  | 반품수거일 |
| `cancel_request_date` |  | 취소요청일 주문취소 요청일 |
| `refund_date` |  | 환불완료일 환불 완료일 |
| `exchange_request_date` |  | 교환요청일 교환 요청일 |
| `exchange_date` |  | 교환완료일 교환 완료일 |
| `product_material` |  | 상품소재 상품의 소재. 복합 소재일 경우 상품의 소재와 함유랑을 함께 입력해야함. (예 : 면 80%, 레이온 20%) |
| `product_material_eng` |  | 영문 상품 소재 상품소재 영문 설명 |
| `cloth_fabric` |  | 옷감 상품이 의류인 경우, 옷감. 일본 택배사를 이용할 경우, 택배사에 따라 의류 통관시 옷감 정보를 입력 받는 경우가 있음. |
| `product_weight` |  | 상품 중량 상품의 전체 중량(kg). 배송을 위해 상품 자체의 무게와 박스 무게, 포장무게를 모두 포함한 중량 기재가 필요하다. |
| `volume_size` |  | 상품 부피 상품의 부피 |
| `volume_size_weight` |  | 상품 부피 무게 상품의 부피 무게 |
| `clearance_category` |  | 해외통관용 상품구분 |
| `clearance_category_info` |  | 해외통관용 상품정보 |
| `clearance_category_code` |  | 해외통관코드 clearance_category_code |
| `hs_code` |  | HS코드 통관을 위한 hs 코드 |
| `one_plus_n_event` |  | 1+N이벤트 여부 1개 구매시 N개 증정하는 이벤트 여부 |
| `origin_place` |  | 원산지정보 상품의 원산지 |
| `origin_place_no` |  | 원산지 코드 |
| `made_in_code` |  | 원산지 국가코드 |
| `origin_place_value` |  | 원산지기타정보 |
| `gift` |  | 사은품 여부 상품이 사은품인지 여부 T : 사은품 · F : 사은품 아님 |
| `item_granting_gift` |  | 사은품증정 조건품주목록 |
| `subscription` |  | 정기결제 여부 T : 정기결제 · F : 정기결제 아님 |
| `product_bundle_list` |  | 세트상품 목록 |
| `market_cancel_request` |  | 마켓 취소요청 여부 T : 취소 요청된 마켓 주문 · F : 취소 요청되지 않은 마켓 주문 |
| `market_cancel_request_quantity` |  | 마켓 취소신청 수량 |
| `market_fail_reason` |  | 마켓 실패사유 |
| `market_fail_reason_guide` |  | 마켓 실패사유 가이드 |
| `market_fail_reason_type` |  | 마켓 실패사유 타입 S : 마켓전송실패 · C : 마켓취소실패 |
| `market_item_no` |  | 외부 품목별 번호 |
| `market_custom_variant_code` |  | 마켓 자체 품목 코드 |
| `option_type` |  | 옵션 구성방식 T : 조합형 · E : 연동형 · F : 독립형 |
| `options` |  | 옵션 |
| `market_discount_amount` |  | 상품별 마켓 할인금액 |
| `labels` |  | 주문 라벨 |
| `order_status_before_cs` |  | CS 전 주문상태 |
| `supply_price` |  | 상품 공급가 |
| `multi_invoice` |  | 멀티 송장 |
| `shipping_expected_date` |  | 발송예정일 |
| `order_id` |  | 주문번호 |
| `claim_type` |  | 취소/교환/반품 타입 |
| `claim_status` |  | 취소/교환/반품 요청 상태 |

## Operations

### `GET /api/v2/admin/orders/{order_id}/items` — Retrieve a list of order items

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-order-items

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `supplier_id` |  |  |  | 공급사 아이디 ,(콤마)로 여러 건을 검색할 수 있다. |

### `POST /api/v2/admin/orders/{order_id}/items` — Create an order item

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-item

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `was_product_bundle` |  |  | F | 세트품주 분리여부 T : 세트상품 나눔 · F : 세트상품 나눔 안함 |
| `original_bundle_item_no` |  |  |  | 분리된 세트상품의 기존 품주번호 |
| `variant_code` | ✓ | 형식 : [A-Z0-9]; 글자수 최소: [12자]~최대: [12자] |  | 품목코드 |

### `PUT /api/v2/admin/orders/{order_id}/items/{order_item_code}` — Update an order item

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-item

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `order_item_code` | ✓ |  |  | 품주코드 |
| `claim_type` |  |  |  | 취소/교환/반품 타입 ※ 사용시 "claim_type" "claim_status" "claim_reason_type"은 필수값 입니다. C:취소 · R:반품 |
| `claim_status` |  |  |  | 취소/교환/반품 요청 상태 ※ 사용시 "claim_type" "claim_status" "claim_reason_type"은 필수값 입니다. T : 신청함 · F : 신청안함 |
| `claim_reason_type` |  |  |  | 취소/교환/반품 요청 사유 타입 ※ 사용시 "claim_type" "claim_status" "claim_reason_type"은 필수값 입니다. A:고객변심 · B:배송지연 · J:배송오류 · C:배송불가지역 · L:수출/통관 불가 · D:포장불량 · E:상품 불만족 · F:상품정보상이 · K:상품불량 · G:서비스불만족 · H:품절 · I:기타 |
| `claim_reason` |  |  |  | 취소/교환/반품 요청 사유 ※ 사용시 "claim_type" "claim_status" "claim_reason_type"은 필수값 입니다. |
| `claim_quantity` |  |  |  | 취소/교환/반품 요청 수량 ※ 사용시 "claim_type" "claim_status" "claim_reason_type"은 필수값 입니다. |
| `multi_invoice` |  |  |  | 멀티 송장 Youtube shopping 이용 시에는 미제공 ※ 멀티 송장 수정시 "claim_type" "claim_status" "claim_reason_type", "claim_quantity", "claim_quantity"은 사용 불가합니다. · ※ 메인송장의 송장번호와 배송업체 코드는 shipments 에서만 수정이 가능하고 배송처리 이후부터는 수정만 가능하며 추가/삭제는 안됩니다. · ※ 멀티 송장에는 연동 배송업체를 입력할 수 없습니다. · ※ 해당 속성에 대한 어드민 UI는 24년 7월 8일부터 확인 가능합니다. |
| ↳ `tracking_no` |  |  |  | 송장번호 |
| ↳ `shipping_company_id` |  |  |  | 배송업체 아이디 |
| ↳ `quantity` |  |  |  | 수량 |
| `shipping_expected_date` |  |  |  | 발송예정일 |
