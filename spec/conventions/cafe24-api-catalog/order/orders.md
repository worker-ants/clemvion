---
resource: order
entity: orders
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders](https://developers.cafe24.com/docs/ko/api/admin/#orders)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문(Order)은 쇼핑몰에서 고객이 상품의 구매의사를 쇼핑몰에 요청한 내역입니다. · 결제수단이 무통장입금인 경우 입금전에도 주문은 생성됩니다. · 쇼핑몰 운영자는 결제가 완료된 주문 정보를 참고하여 쇼핑몰 고객에게 물건을 배송합니다. · 주문 정보에는 주문과 결제를 진행한 주문자의 정보와 상품을 배송 받을 수령자 정보가 포함됩니다. · 주문은 품주, 주문자정보 등 여러 하위 리소스들을 갖고 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `currency` |  | 화폐단위 해당 멀티쇼핑몰의 화폐단위 |
| `order_id` |  | 주문번호 |
| `market_id` |  | 마켓 구분값 가격 비교 사이트를 통하여 마켓 등에서 상품 구매 시 해당 사이트를 구분하기 위한 ID |
| `market_order_no` |  | 마켓 주문 번호 |
| `member_id` |  | 회원아이디 |
| `member_email` |  | 회원 이메일 |
| `member_authentication` |  | 회원인증여부 회원 인증여부. 인증여부에 따라 3가지로 회원타입이 나눠짐. T : 승인 · B : 특별관리회원 · J : 14세미만회원 |
| `billing_name` |  | 결제자명 입금자 이름. 주문자 혹은 수령자 이름과는 다를 수 있음. |
| `bank_code` |  | 은행코드 bank_code |
| `bank_code_name` |  | 입금자 은행명 |
| `payment_method` |  | 결제수단 코드 주문자가 이용한 결제수단의 코드 cash : 무통장 · card : 신용카드 · cell : 휴대폰 · tcash : 계좌이체 · icash : 가상계좌 · prepaid : 선불금 · credit : 예치금 · point : 적립금 · pointfy : 통합포인트 · cvs : 편의점 · cod : 후불 · coupon : 쿠폰 · market_discount : 마켓할인 · giftcard : 제휴상품권 · pointcard : 제휴포인트 · etc : 기타 |
| `payment_method_name` |  | 결제수단명 주문자가 이용한 결제수단의 이름 |
| `payment_gateway_names` |  | PG 이름 |
| `sub_payment_method_name` |  | 해외 결제수단명 |
| `sub_payment_method_code` |  | 해외 결제수단코드 sub_payment_method_code |
| `transaction_ids` |  | 카드 거래 아이디 |
| `paid` |  | 결제 여부 결제가 완료되었는지 여부 T : 결제 · F : 미결제 · M : 부분 결제 |
| `canceled` |  | 취소 여부 T : 취소 · F : 미취소 · M : 부분 취소 |
| `order_date` |  | 주문일 |
| `first_order` |  | 최초 주문여부 해당 주문이 최초 주문인지 여부 T : 최초 주문 · F : 최초 주문 아님 |
| `payment_date` |  | 결제일 |
| `order_from_mobile` |  | 모바일 구분 주문이 모바일에서 이루어졌는지 여부 T : 모바일 주문 · F : 모바일 주문 아님 |
| `use_escrow` |  | 에스크로 사용여부 에스크로를 사용했는지 여부 T : 에스크로 사용 · F : 에스크로 미사용 |
| `group_no_when_ordering` |  | 주문시 회원등급 |
| `initial_order_amount` |  | 최초 주문 금액 |
| `actual_order_amount` |  | 현재 주문 금액 실결제금액 중 coupon_shipping_fee_amount는 할인 금액 자동 계산을 사용할 때만 품목별로 배송비 배분이 가능하기 때문에 할인 금액 자동 계산 기능을 사용할 때만 노출됨 |
| `bank_account_no` |  | 계좌번호 해당 주문건에 대한 쇼핑몰의 계좌번호 |
| `bank_account_owner_name` |  | 예금주 |
| `market_seller_id` |  | 마켓 판매자 아이디 |
| `payment_amount` |  | 최종 결제 금액 |
| `cancel_date` |  | 주문취소일 |
| `order_place_name` |  | 주문경로 텍스트 |
| `order_place_id` |  | 주문경로 |
| `payment_confirmation` |  | 후불결제 입금확인 가능 여부 T : 입금확인 · F : 입금미확인 |
| `commission` |  | 결제 수수료 |
| `postpay` |  | 후불결제여부 T : 후불결제 · F : 후불결제 아님 |
| `admin_additional_amount` |  | 관리자 입력 금액 |
| `additional_shipping_fee` |  | 추가 배송비 |
| `international_shipping_insurance` |  | 해외배송 보험료 |
| `additional_handling_fee` |  | 해외배송 부가금액 |
| `shipping_type` |  | 배송 유형 배송 유형. 국내배송인지 해외배송인지 여부 A : 국내 · B : 해외 |
| `shipping_type_text` |  | 배송 유형명 배송 유형. 국내배송인지 해외배송인지 여부 |
| `shipping_status` |  | 배송상태 F : 배송전 · M : 배송중 · T : 배송완료 · W : 배송보류 · X : 발주전 |
| `wished_delivery_date` |  | 희망배송일 |
| `wished_delivery_time` |  | 희망배송시간 |
| `wished_carrier_id` |  | 희망배송사 코드 |
| `wished_carrier_name` |  | 희망배송사 명 |
| `return_confirmed_date` |  | 반품승인일시 |
| `total_supply_price` |  | 총 공급가액 |
| `naver_point` |  | 네이버포인트 |
| `additional_order_info_list` |  | 주문서 추가항목 |
| `store_pickup` |  | 매장수령여부 T : 매장수령 · F : 매장수령 아님 |
| `easypay_name` |  | 간편결제 결제사 이름 |
| `loan_status` |  | 여신상태 OK : GOOD · NG : NOT GOOD · ER : ERROR |
| `subscription` |  | 정기결제 여부 T : 정기결제 · F : 정기결제 아님 |
| `items` |  | 품주 리소스 · 조회시 Embed 파라메터를 사용하여 조회할 수 있다. |
| `receivers` |  | 수령자정보 리소스 · 조회시 Embed 파라메터를 사용하여 조회할 수 있다. |
| `buyer` |  | 주문자정보 리소스 |
| `shipping_fee_detail` |  | 배송비 정보 |
| `regional_surcharge_detail` |  | 지역별 배송비 정보 |
| `return` |  | 반품상세 리소스 |
| `cancellation` |  | 취소상세 리소스 |
| `exchange` |  | 교환상세 리소스 |
| `multiple_addresses` |  | 멀티 배송지 여부 T : 멀티 배송지 주문 · F : 멀티 배송지 주문 아님 |
| `exchange_rate` |  | 결제 화폐 환율 정보 |
| `first_payment_methods` |  | 최초 결제수단 코드 cash : 무통장 · card : 신용카드 · cell : 휴대폰 · tcash : 계좌이체 · icash : 가상계좌 · prepaid : 선불금 · credit : 예치금 · point : 적립금 · pointfy : 통합포인트 · cvs : 편의점 · cod : 후불 · giftcard : 제휴상품권 · pointcard : 제휴포인트 · etc : 기타 |
| `naverpay_payment_information` |  | 네이버페이 PG 결제 정보 P : PG결제 · N : 네이버결제 |
| `include_tax` |  | 가격에 세금 포함 T: 세금포함 · F: 세금제외 |
| `tax_detail` |  | 세금 상세 정보 |
| `service_type` |  | 주문 서비스 유형 rental : 렌탈주문 |
| `service_data` |  | 주문 서비스 데이터 |
| `show_shipping_address` |  | 배송지 정보 표기 여부 T: 배송지 정보 표기 · F: 배송지 정보 가림 |
| `social_member_code` |  | 연동 된 SNS 제공코드 |
| `social_name` |  | 연동 된 SNS명 |
| `customer_group_no_when_ordering` |  | 주문시 회원등급 주문 당시의 회원등급 |
| `benefits` |  | 혜택 리소스 |
| `coupons` |  | 쿠폰 리소스 |
| `refunds` |  | 환불상세 리소스 |
| `process_status` |  | 주문상태 prepare : 배송준비중 · prepareproduct : 상품준비중 · hold : 배송보류 · unhold : 배송보류해제 |
| `order_item_code` |  | 품주코드 |
| `purchase_confirmation` |  | 구매확정 여부 |
| `collect_points` |  | 적립금 회수 |

## Operations

### `GET /api/v2/admin/orders` — Retrieve a list of orders

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-orders

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `items` |  |  |  | 품주 리소스 · 조회시 Embed 파라메터를 사용하여 조회할 수 있다. |
| `receivers` |  |  |  | 수령자정보 리소스 · 조회시 Embed 파라메터를 사용하여 조회할 수 있다. |
| `buyer` |  |  |  | 주문자정보 리소스 |
| `return` |  |  |  | 반품상세 리소스 |
| `cancellation` |  |  |  | 취소상세 리소스 |
| `exchange` |  |  |  | 교환상세 리소스 |
| `multiple_addresses` |  |  |  | 멀티 배송지 여부 T : 멀티 배송지 주문 |
| `first_order` |  |  |  | 최초 주문여부 T : 최초 주문 · F : 최초 주문 아님 |
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `start_date` |  | 날짜 |  | 검색 시작일 검색을 시작할 기준일 |
| `end_date` |  | 날짜 |  | 검색 종료일 검색을 종료할 기준일 · 검색 시작일과 같이 사용해야함. · 검색기간은 한 호출에 3개월 이상 검색 불가. |
| `order_id` |  | 주문번호 |  | 주문번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `order_status` |  |  |  | 주문상태 주문상태. 주문 상태별로 각각의 코드가 있음. ,(콤마)로 여러 건을 검색할 수 있다. N00 : 입금전 · N02 : 주문접수중 · N10 : 상품준비중 · N20 : 배송준비중 · N21 : 배송대기 · N22 : 배송보류 · N30 : 배송중 · N40 : 배송완료 · N50 : 구매확정 · C00 : 취소신청 · C10 : 취소접수 - 관리자 · C11 : 취소접수거부 - 관리자 · C34 : 취소처리중 - 환불전 · C35 : 취소처리중 - 환불완료 · C36 : 취소처리중 - 환불보류 · C40 : 취소완료 · C41 : 취소 완료 - 환불전 · C42 : 취소 완료 - 환불요청중 · C43 : 취소 완료 - 환불보류 · C47 : 입금전취소 - 구매자 · C48 : 입금전취소 - 자동취소 · C49 : 입금전취소 - 관리자 · R00 : 반품신청 · R10 : 반품접수 · R11 : 반품 접수 거부 · R12 : 반품보류 · R13 : 반품접수 - 수거완료(자동) · R20 : 반품 수거 완료 · R30 : 반품처리중 - 수거전 · R31 : 반품처리중 - 수거완료 · R34 : 반품처리중 - 환불전 · R36 : 반품처리중 - 환불보류 · R40 : 반품완료 - 환불완료 · R41 : 반품완료 - 환불전 · R42 : 반품완료 - 환불요청중 · R43 : 반품완료 - 환불보류 · E00 : 교환신청 · E10 : 교환접수 · N01 : 교환접수 - 교환상품 · N02 : 입금전 - 카드결제대기 · N03 : 교환접수 - 카드결제대기 · E11 : 교환접수거부 · E12 : 교환보류 · E13 : 교환접수 - 수거완료(자동) · E20 : 교환준비 · E30 : 교환처리중 - 수거전 · E31 : 교환처리중 - 수거완료 · E32 : 교환처리중 - 입금전 · E33 : 교환처리중 - 입금완료 · E34 : 교환처리중 - 환불전 · E35 : 교환처리중 - 환불완료 · E36 : 교환처리중 - 환불보류 · E40 : 교환완료 |
| `payment_status` |  |  |  | 결제상태 F : 입금전 · M : 추가입금대기 · T : 입금완료(수동) · A : 입금완료(자동) · P : 결제완료 |
| `member_type` |  |  |  | 회원여부 회원여부. 회원과 비회원 각각의 코드가 있음. 2 : 회원 · 3 : 비회원 |
| `group_no` |  |  |  | 회원등급번호 |
| `buyer_name` |  |  |  | 주문자명 주문자 이름. 입금자 혹은 수령자 이름과는 다를 수 있음. |
| `receiver_name` |  |  |  | 수령자명 수령자 이름. 주문자 혹은 입금자 이름과는 다를 수 있음. |
| `name_furigana` |  |  |  | 수령자명 (발음) |
| `receiver_address` |  |  |  | 수령자주소 수령자 주소. 주문자 혹은 입금자 주소와는 다를 수 있음. |
| `member_id` |  |  |  | 회원아이디 회원 아이디 |
| `member_email` |  |  |  | 회원 이메일 |
| `product_no` |  |  |  | 상품번호 상품 번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `product_code` |  |  |  | 상품코드 상품 코드 |
| `date_type` |  |  | order_date | 검색날짜 유형 검색을 위한 날짜 유형 기준. 기본값은 주문일로 설정되어 있음. order_date : 주문일 · pay_date : 결제일 · shipbegin_date : 배송시작일 · shipend_date : 배송완료일 · cancel_date : 주문취소일 · place_date : 발주일 · cancel_request_date : 취소신청일 · cancel_accept_date : 취소접수일 · cancel_complete_date : 취소완료일 · exchange_request_date : 교환신청일 · exchange_accept_date : 교환접수일 · exchange_complete_date : 교환완료일 · return_request_date : 반품신청일 · return_accept_date : 반품접수일 · return_complete_date : 반품완료일 · purchaseconfirmation_date : 구매확정일 |
| `supplier_id` |  |  |  | 공급사 아이디 ,(콤마)로 여러 건을 검색할 수 있다. |
| `order_place_id` |  |  |  | 주문경로 ,(콤마)로 여러 건을 검색할 수 있다. cafe24:카페24 · mobile:모바일웹 · mobile_d:모바일앱 · NCHECKOUT:네이버페이 · inpark:인터파크 · auction:옥션 · sk11st:11번가 · gmarket:G마켓 · coupang:쿠팡 · shopn:스마트스토어 |
| `buyer_cellphone` |  |  |  | 주문자 휴대 전화 |
| `buyer_phone` |  |  |  | 주문자 일반 전화 |
| `buyer_email` |  |  |  | 주문자 이메일 |
| `inflow_path` |  |  |  | 유입경로 |
| `subscription` |  |  |  | 정기결제 여부 T : 정기결제 · F : 정기결제 아님 |
| `market_order_no` |  | 형식 : [a-zA-Z0-9_-]; 최대글자수 : [40자] |  | 마켓 주문 번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `market_cancel_request` |  |  |  | 마켓 취소요청 여부 T : 취소 요청된 마켓 주문 |
| `payment_method` |  |  |  | 결제수단 코드 ,(콤마)로 여러 건을 검색할 수 있다. cash : 무통장 · card : 신용카드 · tcash : 계좌이체 · icash : 가상계좌 · cell : 휴대폰 · deferpay : 후불 · cvs : 편의점 · point : 선불금 · mileage : 적립금 · deposit : 예치금 · giftcard : 제휴상품권 · pointcard : 제휴포인트 · etc : 기타 |
| `payment_gateway_name` |  |  |  | PG 이름 ,(콤마)로 여러 건을 검색할 수 있다. |
| `market_seller_id` |  |  |  | 마켓 판매자 아이디 |
| `discount_method` |  |  |  | 할인수단 ,(콤마)로 여러 건을 검색할 수 있다. point : 적립금 · credit : 예치금 · coupon : 쿠폰 · market_discount : 마켓할인 · discount_code : 할인코드 |
| `discount_code` |  |  |  | 할인코드 |
| `carrier_id` |  | 최소값: [1] |  | 배송사 아이디 |
| `wished_carrier_id` |  | 최소값: [1] |  | 희망배송사 아이디 ,(콤마)로 여러 건을 검색할 수 있다. |
| `labels` |  |  |  | 주문 라벨 ,(콤마)로 여러 건을 검색할 수 있다. |
| `refund_status` |  |  |  | CS(환불)상태 ,(콤마)로 여러 건을 검색할 수 있다. F : 환불전 · T : 환불완료 · M : 환불보류 |
| `limit` |  | 최소: [1]~최대: [1000] | 10 | 조회결과 최대건수 조회하고자 하는 최대 건수를 지정할 수 있음. · 예) 10 입력시 10건만 표시함. |
| `offset` |  | 최대값: [15000] | 0 | 조회결과 시작위치 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `orders` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| ↳ `currency` |  | 화폐단위 해당 멀티쇼핑몰의 화폐단위 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `market_id` |  | 마켓 구분값 가격 비교 사이트를 통하여 마켓 등에서 상품 구매 시 해당 사이트를 구분하기 위한 ID |
| ↳ `market_order_no` |  | 마켓 주문 번호 |
| ↳ `member_id` |  | 회원아이디 |
| ↳ `member_email` |  | 회원 이메일 |
| ↳ `member_authentication` |  | 회원인증여부 회원 인증여부. 인증여부에 따라 3가지로 회원타입이 나눠짐. T : 승인 · B : 특별관리회원 · J : 14세미만회원 |
| ↳ `initial_order_amount` |  | 최초 주문 금액 |
| ↳ ↳ `order_price_amount` |  |  |
| ↳ ↳ `shipping_fee` |  |  |
| ↳ ↳ `points_spent_amount` |  |  |
| ↳ ↳ `credits_spent_amount` |  |  |
| ↳ ↳ `coupon_discount_price` |  |  |
| ↳ ↳ `coupon_shipping_fee_amount` |  |  |
| ↳ ↳ `membership_discount_amount` |  |  |
| ↳ ↳ `shipping_fee_discount_amount` |  |  |
| ↳ ↳ `set_product_discount_amount` |  |  |
| ↳ ↳ `app_discount_amount` |  |  |
| ↳ ↳ `point_incentive_amount` |  |  |
| ↳ ↳ `total_amount_due` |  |  |
| ↳ ↳ `payment_amount` |  | 최종 결제 금액 |
| ↳ ↳ `market_other_discount_amount` |  |  |
| ↳ ↳ `tax` |  |  |
| ↳ `actual_order_amount` |  | 현재 주문 금액 실결제금액 중 coupon_shipping_fee_amount는 할인 금액 자동 계산을 사용할 때만 품목별로 배송비 배분이 가능하기 때문에 할인 금액 자동 계산 기능을 사용할 때만 노출됨 |
| ↳ ↳ `order_price_amount` |  |  |
| ↳ ↳ `shipping_fee` |  |  |
| ↳ ↳ `points_spent_amount` |  |  |
| ↳ ↳ `credits_spent_amount` |  |  |
| ↳ ↳ `coupon_discount_price` |  |  |
| ↳ ↳ `coupon_shipping_fee_amount` |  |  |
| ↳ ↳ `membership_discount_amount` |  |  |
| ↳ ↳ `shipping_fee_discount_amount` |  |  |
| ↳ ↳ `set_product_discount_amount` |  |  |
| ↳ ↳ `app_discount_amount` |  |  |
| ↳ ↳ `point_incentive_amount` |  |  |
| ↳ ↳ `total_amount_due` |  |  |
| ↳ ↳ `payment_amount` |  | 최종 결제 금액 |
| ↳ ↳ `market_other_discount_amount` |  |  |
| ↳ ↳ `tax` |  |  |
| ↳ `billing_name` |  | 결제자명 입금자 이름. 주문자 혹은 수령자 이름과는 다를 수 있음. |
| ↳ `bank_code` |  | 은행코드 bank_code |
| ↳ `bank_code_name` |  | 입금자 은행명 |
| ↳ `payment_method` |  | 결제수단 코드 주문자가 이용한 결제수단의 코드 cash : 무통장 · card : 신용카드 · cell : 휴대폰 · tcash : 계좌이체 · icash : 가상계좌 · prepaid : 선불금 · credit : 예치금 · point : 적립금 · pointfy : 통합포인트 · cvs : 편의점 · cod : 후불 · coupon : 쿠폰 · market_discount : 마켓할인 · giftcard : 제휴상품권 · pointcard : 제휴포인트 · etc : 기타 |
| ↳ `payment_method_name` |  | 결제수단명 주문자가 이용한 결제수단의 이름 |
| ↳ `payment_gateway_names` |  | PG 이름 |
| ↳ `sub_payment_method_name` |  | 해외 결제수단명 |
| ↳ `sub_payment_method_code` |  | 해외 결제수단코드 sub_payment_method_code |
| ↳ `transaction_ids` |  | 카드 거래 아이디 |
| ↳ `paid` |  | 결제 여부 결제가 완료되었는지 여부 T : 결제 · F : 미결제 · M : 부분 결제 |
| ↳ `canceled` |  | 취소 여부 T : 취소 · F : 미취소 · M : 부분 취소 |
| ↳ `order_date` |  | 주문일 |
| ↳ `first_order` |  | 최초 주문여부 해당 주문이 최초 주문인지 여부 T : 최초 주문 · F : 최초 주문 아님 |
| ↳ `payment_date` |  | 결제일 |
| ↳ `order_from_mobile` |  | 모바일 구분 주문이 모바일에서 이루어졌는지 여부 T : 모바일 주문 · F : 모바일 주문 아님 |
| ↳ `use_escrow` |  | 에스크로 사용여부 에스크로를 사용했는지 여부 T : 에스크로 사용 · F : 에스크로 미사용 |
| ↳ `bank_account_no` |  | 계좌번호 해당 주문건에 대한 쇼핑몰의 계좌번호 |
| ↳ `bank_account_owner_name` |  | 예금주 |
| ↳ `market_seller_id` |  | 마켓 판매자 아이디 |
| ↳ `payment_amount` |  | 최종 결제 금액 |
| ↳ `cancel_date` |  | 주문취소일 |
| ↳ `order_place_name` |  | 주문경로 텍스트 |
| ↳ `order_place_id` |  | 주문경로 |
| ↳ `payment_confirmation` |  | 후불결제 입금확인 가능 여부 T : 입금확인 · F : 입금미확인 |
| ↳ `commission` |  | 결제 수수료 |
| ↳ `postpay` |  | 후불결제여부 T : 후불결제 · F : 후불결제 아님 |
| ↳ `admin_additional_amount` |  | 관리자 입력 금액 |
| ↳ `additional_shipping_fee` |  | 추가 배송비 |
| ↳ `international_shipping_insurance` |  | 해외배송 보험료 |
| ↳ `additional_handling_fee` |  | 해외배송 부가금액 |
| ↳ `shipping_type` |  | 배송 유형 배송 유형. 국내배송인지 해외배송인지 여부 A : 국내 · B : 해외 |
| ↳ `shipping_type_text` |  | 배송 유형명 배송 유형. 국내배송인지 해외배송인지 여부 |
| ↳ `shipping_status` |  | 배송상태 F : 배송전 · M : 배송중 · T : 배송완료 · W : 배송보류 · X : 발주전 |
| ↳ `shipping_fee_detail` |  | 배송비 정보 |
| ↳ ↳ `shipping_group_code` |  |  |
| ↳ ↳ `supplier_code` |  |  |
| ↳ ↳ `shipping_fee` |  |  |
| ↳ ↳ `cancel_shipping_fee` |  |  |
| ↳ ↳ `additional_shipping_fee` |  | 추가 배송비 |
| ↳ ↳ `refunded_shipping_fee` |  |  |
| ↳ ↳ `return_shipping_fee` |  |  |
| ↳ ↳ `items` |  | 품주 리소스 · 조회시 Embed 파라메터를 사용하여 조회할 수 있다. |
| ↳ `regional_surcharge_detail` |  | 지역별 배송비 정보 |
| ↳ ↳ `shipping_group_code` |  |  |
| ↳ ↳ `supplier_code` |  |  |
| ↳ ↳ `regional_surcharge_amount` |  |  |
| ↳ ↳ `regional_surcharge_calculation_type` |  |  |
| ↳ ↳ `template_code` |  |  |
| ↳ ↳ `template_name` |  |  |
| ↳ ↳ `cancel_shipping_fee` |  |  |
| ↳ ↳ `additional_shipping_fee` |  | 추가 배송비 |
| ↳ ↳ `refunded_shipping_fee` |  |  |
| ↳ ↳ `return_shipping_fee` |  |  |
| ↳ ↳ `items` |  | 품주 리소스 · 조회시 Embed 파라메터를 사용하여 조회할 수 있다. |
| ↳ `wished_delivery_date` |  | 희망배송일 |
| ↳ `wished_delivery_time` |  | 희망배송시간 |
| ↳ `wished_carrier_id` |  | 희망배송사 코드 |
| ↳ `wished_carrier_name` |  | 희망배송사 명 |
| ↳ `return_confirmed_date` |  | 반품승인일시 |
| ↳ `total_supply_price` |  | 총 공급가액 |
| ↳ `naver_point` |  | 네이버포인트 |
| ↳ `additional_order_info_list` |  | 주문서 추가항목 |
| ↳ ↳ `id` |  |  |
| ↳ ↳ `name` |  |  |
| ↳ ↳ `value` |  |  |
| ↳ ↳ `input_type` |  |  |
| ↳ ↳ `product_type` |  |  |
| ↳ ↳ `applied_product_list` |  | (목록) |
| ↳ `store_pickup` |  | 매장수령여부 T : 매장수령 · F : 매장수령 아님 |
| ↳ `easypay_name` |  | 간편결제 결제사 이름 |
| ↳ `loan_status` |  | 여신상태 OK : GOOD · NG : NOT GOOD · ER : ERROR |
| ↳ `subscription` |  | 정기결제 여부 T : 정기결제 · F : 정기결제 아님 |
| ↳ `multiple_addresses` |  | 멀티 배송지 여부 T : 멀티 배송지 주문 · F : 멀티 배송지 주문 아님 |
| ↳ `exchange_rate` |  | 결제 화폐 환율 정보 |
| ↳ `first_payment_methods` |  | 최초 결제수단 코드 cash : 무통장 · card : 신용카드 · cell : 휴대폰 · tcash : 계좌이체 · icash : 가상계좌 · prepaid : 선불금 · credit : 예치금 · point : 적립금 · pointfy : 통합포인트 · cvs : 편의점 · cod : 후불 · giftcard : 제휴상품권 · pointcard : 제휴포인트 · etc : 기타 |
| ↳ `naverpay_payment_information` |  | 네이버페이 PG 결제 정보 P : PG결제 · N : 네이버결제 |
| ↳ `market_discount_info` |  |  |
| ↳ `include_tax` |  | 가격에 세금 포함 T: 세금포함 · F: 세금제외 |
| ↳ `tax_detail` |  | 세금 상세 정보 |
| ↳ ↳ `name` |  |  |
| ↳ ↳ `amount` |  |  |
| ↳ ↳ `price_before_tax` |  |  |
| ↳ ↳ `price_before_tax_type` |  |  |
| ↳ ↳ `order_item_code` |  | 품주코드 |
| ↳ ↳ `country_tax_rate` |  |  |
| ↳ ↳ `region_tax` |  | (응답 객체) |
| ↳ ↳ ↳ `rate` |  |  |
| ↳ ↳ ↳ `taxation_method` |  |  |
| ↳ ↳ `product_tax_override` |  | (응답 객체) |
| ↳ ↳ ↳ `rate` |  |  |
| ↳ ↳ ↳ `taxation_method` |  |  |
| ↳ ↳ `shipping_tax_override` |  | (응답 객체) |
| ↳ ↳ ↳ `rate` |  |  |
| ↳ ↳ ↳ `taxation_method` |  |  |
| ↳ `service_type` |  | 주문 서비스 유형 rental : 렌탈주문 |
| ↳ `service_data` |  | 주문 서비스 데이터 |
| ↳ ↳ `key` |  |  |
| ↳ ↳ `value` |  |  |
| ↳ ↳ `title` |  |  |
| ↳ `show_shipping_address` |  | 배송지 정보 표기 여부 T: 배송지 정보 표기 · F: 배송지 정보 가림 |
| ↳ `social_member_code` |  | 연동 된 SNS 제공코드 |
| ↳ `social_name` |  | 연동 된 SNS명 |
| `links` |  | (목록) |
| ↳ `rel` |  |  |
| ↳ `href` |  |  |

응답 예시 (JSON):

```json
{
    "orders": [
        {
            "shop_no": 1,
            "currency": "KRW",
            "order_id": "20170710-0000013",
            "market_id": "self",
            "market_order_no": null,
            "member_id": "sampleid",
            "member_email": "sample@sample.com",
            "member_authentication": "T",
            "initial_order_amount": {
                "order_price_amount": "5000.00",
                "shipping_fee": "14000.00",
                "points_spent_amount": "0.00",
                "credits_spent_amount": "1500.00",
                "coupon_discount_price": "1000.00",
                "coupon_shipping_fee_amount": "0.00",
                "membership_discount_amount": "0.00",
                "shipping_fee_discount_amount": "5500.00",
                "set_product_discount_amount": "0.00",
                "app_discount_amount": "0.00",
                "point_incentive_amount": "0.00",
                "total_amount_due": "0.00",
                "payment_amount": "30000.00",
                "market_other_discount_amount": "0.00",
                "tax": "150.00"
            },
            "actual_order_amount": {
                "order_price_amount": "5000.00",
                "shipping_fee": "14000.00",
                "points_spent_amount": "0.00",
                "credits_spent_amount": "1500.00",
                "coupon_discount_price": "1000.00",
                "coupon_shipping_fee_amount": "0.00",
                "membership_discount_amount": "0.00",
                "shipping_fee_discount_amount": "5500.00",
                "set_product_discount_amount": "0.00",
                "app_discount_amount": "0.00",
                "point_incentive_amount": "0.00",
                "total_amount_due": "0.00",
                "payment_amount": "30000.00",
                "market_other_discount_amount": "0.00",
                "tax": "80.00"
            },
            "billing_name": "Test",
            "bank_code": "bank_26",
            "bank_code_name": "Sample Bank",
            "payment_method": [
                "card",
                "cash"
            ],
            "payment_method_name": [
                "Card",
                "Cash"
            ],
            "payment_gateway_names": null,
            "sub_payment_method_name": "PayPal",
            "sub_payment_method_code": "PM002",
            "transaction_ids": null,
            "paid": "T",
            "canceled": "F",
            "order_date": "2018-07-04T11:21:35+09:00",
            "first_order": "T",
            "payment_date": "2018-07-04T11:21:35+09:00",
            "order_from_mobile": "F",
            "use_escrow": "F",
            "bank_account_no": "12312422234",
            "bank_account_owner_name": "John Doe",
            "market_seller_id": null,
            "payment_amount": "30000.00",
            "cancel_date": null,
            "order_place_name": "Naver Pay",
            "order_place_id": "NCHECKOUT",
            "payment_confirmation": null,
            "commission": "0.00",
            "postpay": "F",
            "admin_additional_amount": "0.00",
            "additional_shipping_fee": "0.00",
            "international_shipping_insurance": "0.00",
            "additional_handling_fee": "0.00",
            "shipping_type": "A",
            "shipping_type_text": "Domestic Shipping",
            "shipping_status": "T",
            "shipping_fee_detail": [
                {
                    "shipping_group_code": 80,
                    "supplier_code": "S0000000",
                    "shipping_fee": "2500.00",
                    "cancel_shipping_fee": "0.00",
                    "additional_shipping_fee": "0.00",
                    "refunded_shipping_fee": "0.00",
                    "return_shipping_fee": "0.00",
                    "items": [
                        "20170710-0000013-01",
                        "20170710-0000013-02"
                    ]
                },
                {
                    "shipping_group_code": 81,
                    "supplier_code": "S000000A",
                    "shipping_fee": "2500.00",
                    "cancel_shipping_fee": "0.00",
                    "additional_shipping_fee": "0.00",
                    "refunded_shipping_fee": "0.00",
                    "return_shipping_fee": "0.00",
                    "items": [
                        "20170710-0000013-03",
                        "20170710-0000013-04"
                    ]
                }
            ],
            "regional_surcharge_detail": [
                {
                    "shipping_group_code": 82,
                    "supplier_code": "S0000000",
                    "regional_surcharge_amount": "5000.00",
                    "regional_surcharge_calculation_type": "custom",
                    "template_code": 5,
                    "template_name": "Jeju/Island Shipping",
                    "cancel_shipping_fee": "0.00",
                    "additional_shipping_fee": "0.00",
                    "refunded_shipping_fee": "0.00",
                    "return_shipping_fee": "0.00",
                    "items": [
                        "20170710-0000013-01",
                        "20170710-0000013-02"
                    ]
                },
                {
                    "shipping_group_code": 83,
                    "supplier_code": "S000000A",
                    "regional_surcharge_amount": "4000.00",
                    "regional_surcharge_calculation_type": "default",
                    "template_code": 4,
                    "template_name": "Default Template",
                    "cancel_shipping_fee": "0.00",
                    "additional_shipping_fee": "0.00",
                    "refunded_shipping_fee": "0.00",
                    "return_shipping_fee": "0.00",
                    "items": [
                        "20170710-0000013-03",
                        "20170710-0000013-04"
                    ]
                }
            ],
            "wished_delivery_date": "",
            "wished_delivery_time": null,
            "wished_carrier_id": null,
            "wished_carrier_name": null,
            "return_confirmed_date": null,
            "total_supply_price": "27000",
            "naver_point": 0,
            "additional_order_info_list": [
                {
                    "id": 1,
                    "name": "addtional info1",
                    "value": "lorem ipsu",
                    "input_type": "A",
                    "product_type": "A",
                    "applied_product_list": [
                        "iPhone X",
                        "iPhone X case"
                    ]
                },
                {
                    "id": 2,
                    "name": "addtional info2",
                    "value": "Green",
                    "input_type": "A",
                    "product_type": "A",
                    "applied_product_list": [
                        "iPhone X",
                        "iPhone X case"
                    ]
                }
            ],
            "store_pickup": "F",
            "easypay_name": "",
            "loan_status": null,
            "subscription": "T",
            "multiple_addresses": "F",
            "exchange_rate": "1.0000",
            "first_payment_methods": [
                "card",
                "giftcard"
            ],
            "naverpay_payment_information": "N",
            "market_discount_info": null,
            "include_tax": "F",
            "tax_detail": [
                {
                    "name": "VAT",
                    "amount": "60.00",
                    "price_before_tax": "15000.00",
                    "price_before_tax_type": "I",
                    "order_item_code": [
                        "20170710-0000013-01",
                        "20170710-0000013-02"
                    ],
                    "country_tax_rate": "5.00",
                    "region_tax": {
                        "rate": "10.00",
                        "taxation_method": "A"
                    },
                    "product_tax_override": {
                        "rate": "7.00",
                        "taxation_method": "A"
                    },
                    "shipping_tax_override": {
                        "rate": null,
                        "taxation_method": null
                    }
                },
                {
                    "name": "TAX",
                    "amount": "20.00",
                    "price_before_tax": "2500.00",
                    "price_before_tax_type": "S",
                    "order_item_code": [
                        "20170710-0000013-01",
                        "20170710-0000013-02"
                    ],
                    "country_tax_rate": "5.00",
                    "region_tax": {
                        "rate": "10.00",
                        "taxation_method": "A"
                    },
                    "product_tax_override": {
                        "rate": null,
                        "taxation_method": null
                    },
                    "shipping_tax_override": {
                        "rate": "7.00",
                        "taxation_method": "A"
                    }
                }
            ],
            "service_type": "rental",
            "service_data": [
                {
                    "key": "rental_period",
                    "value": "12",
                    "title": "rental period"
                },
                {
                    "key": "rental_amount",
                    "value": "10000",
                    "title": "rental amount"
                }
            ],
            "show_shipping_address": "T",
            "social_member_code": null,
            "social_name": null
        },
        {
            "shop_no": 1,
            "currency": "KRW",
            "order_id": "20170711-0000014",
            "market_id": "self",
            "market_order_no": null,
            "member_id": "sampleid",
            "member_email": "sample@sample.com",
            "member_authentication": "T",
            "initial_order_amount": {
                "order_price_amount": "5000.00",
                "shipping_fee": "7000.00",
                "points_spent_amount": "0.00",
                "credits_spent_amount": "1500.00",
                "coupon_discount_price": "1000.00",
                "coupon_shipping_fee_amount": "0.00",
                "membership_discount_amount": "0.00",
                "shipping_fee_discount_amount": "5500.00",
                "app_discount_amount": "0.00",
                "point_incentive_amount": "0.00",
                "total_amount_due": "0.00",
                "payment_amount": "30000.00",
                "market_other_discount_amount": "0.00",
                "tax": "120.00"
            },
            "actual_order_amount": {
                "order_price_amount": "5000.00",
                "shipping_fee": "14000.00",
                "points_spent_amount": "0.00",
                "credits_spent_amount": "1500.00",
                "coupon_discount_price": "1000.00",
                "coupon_shipping_fee_amount": "0.00",
                "membership_discount_amount": "0.00",
                "shipping_fee_discount_amount": "5500.00",
                "app_discount_amount": "0.00",
                "point_incentive_amount": "0.00",
                "total_amount_due": "0.00",
                "payment_amount": "30000.00",
                "market_other_discount_amount": "0.00",
                "tax": "60.00"
            },
            "billing_name": "123",
            "bank_code": "bank_26",
            "bank_code_name": "Sample Bank",
            "payment_method": [
                "card",
                "cash"
            ],
            "payment_method_name": [
                "Card",
                "Cash"
            ],
            "payment_gateway_names": null,
            "sub_payment_method_name": "PayPal",
            "sub_payment_method_code": "PM002",
            "transaction_ids": null,
            "paid": "T",
            "canceled": "F",
            "order_date": "2018-07-04T11:21:35+09:00",
            "first_order": "F",
            "payment_date": "2018-07-04T11:21:35+09:00",
            "order_from_mobile": "F",
            "use_escrow": "F",
            "bank_account_no": "12312422234",
            "bank_account_owner_name": "John Doe",
            "market_seller_id": null,
            "payment_amount": "10000.00",
            "cancel_date": null,
            "order_place_name": "Naver Pay",
            "order_place_id": "NCHECKOUT",
            "payment_confirmation": null,
            "commission": "0.00",
            "postpay": "F",
            "admin_additional_amount": "0.00",
            "additional_shipping_fee": "0.00",
            "international_shipping_insurance": "0.00",
            "additional_handling_fee": "0.00",
            "shipping_type": "A",
            "shipping_type_text": "Domestic Shipping",
            "shipping_status": "M",
            "shipping_fee_detail": [
                {
                    "shipping_group_code": 90,
                    "supplier_code": "S0000000",
                    "shipping_fee": "2500.00",
                    "cancel_shipping_fee": "0.00",
                    "additional_shipping_fee": "0.00",
                    "refunded_shipping_fee": "0.00",
                    "return_shipping_fee": "0.00",
                    "items": [
                        "20170711-0000014-01",
                        "20170711-0000014-02"
                    ]
                },
                {
                    "shipping_group_code": 91,
                    "supplier_code": "S000000A",
                    "shipping_fee": "2500.00",
                    "cancel_shipping_fee": "0.00",
                    "additional_shipping_fee": "0.00",
                    "refunded_shipping_fee": "0.00",
                    "return_shipping_fee": "0.00",
                    "items": [
                        "20170711-0000014-03",
                        "20170711-0000014-04"
                    ]
                }
            ],
            "regional_surcharge_detail": [
                {
                    "shipping_group_code": 92,
                    "supplier_code": "S0000000",
                    "regional_surcharge_amount": "1000.00",
                    "regional_surcharge_calculation_type": "custom",
                    "template_code": 7,
                    "template_name": "Large Furniture",
                    "cancel_shipping_fee": "0.00",
                    "additional_shipping_fee": "0.00",
                    "refunded_shipping_fee": "0.00",
                    "return_shipping_fee": "0.00",
                    "items": [
                        "20170711-0000014-01",
                        "20170711-0000014-02"
                    ]
                },
                {
                    "shipping_group_code": 93,
                    "supplier_code": "S000000A",
                    "regional_surcharge_amount": "1000.00",
                    "regional_surcharge_calculation_type": "default",
                    "template_code": 6,
                    "template_name": "Default Template",
                    "cancel_shipping_fee": "0.00",
                    "additional_shipping_fee": "0.00",
                    "refunded_shipping_fee": "0.00",
                    "return_shipping_fee": "0.00",
                    "items": [
                        "20170711-0000014-03",
                        "20170711-0000014-04"
                    ]
                }
            ],
            "wished_delivery_date": "",
            "wished_delivery_time": null,
            "wished_carrier_id": null,
            "wished_carrier_name": null,
            "return_confirmed_date": null,
            "total_supply_price": "9000",
            "naver_point": 0,
            "additional_order_info_list": [],
            "store_pickup": "F",
            "easypay_name": "",
            "loan_status": null,
            "subscription": "F",
            "multiple_addresses": "T",
            "exchange_rate": "1063.2117",
            "first_payment_methods": [
                "card",
                "giftcard"
            ],
            "naverpay_payment_information": null,
            "include_tax": "F",
            "tax_detail": [
                {
                    "name": "VAT",
                    "amount": "50.00",
                    "price_before_tax": "15000.00",
                    "price_before_tax_type": "I",
                    "order_item_code": [
                        "20170710-0000014-01",
                        "20170710-0000014-02"
                    ],
                    "country_tax_rate": "5.00",
                    "region_tax": {
                        "rate": "10.00",
                        "taxation_method": "A"
                    },
                    "product_tax_override": {
                        "rate": "7.00",
                        "taxation_method": "A"
                    },
                    "shipping_tax_override": {
                        "rate": null,
                        "taxation_method": null
                    }
                },
                {
                    "name": "TAX",
                    "amount": "10.00",
                    "price_before_tax": "2500.00",
                    "price_before_tax_type": "S",
                    "order_item_code": [
                        "20170710-0000014-01",
                        "20170710-0000014-02"
                    ],
                    "country_tax_rate": "5.00",
                    "region_tax": {
                        "rate": "10.00",
                        "taxation_method": "A"
                    },
                    "product_tax_override": {
                        "rate": null,
                        "taxation_method": null
                    },
                    "shipping_tax_override": {
                        "rate": "7.00",
                        "taxation_method": "A"
                    }
                }
            ],
            "service_type": "rental",
            "service_data": [
                {
                    "key": "rental_period",
                    "value": "12",
                    "title": "rental period"
                },
                {
                    "key": "rental_amount",
                    "value": "10000",
                    "title": "rental amount"
                }
            ],
            "show_shipping_address": "T",
            "social_member_code": null,
            "social_name": null
        }
    ],
    "links": [
        {
            "rel": "next",
            "href": "https://{mallid}.cafe24api.com/api/v2/admin/orders?limit=10&offset=10"
        }
    ]
}
```

### `GET /api/v2/admin/orders/{order_id}` — Retrieve an order

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-order

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `items` |  |  |  | 품주 리소스 |
| `receivers` |  |  |  | 수령자정보 리소스 |
| `buyer` |  |  |  | 주문자정보 리소스 |
| `benefits` |  |  |  | 혜택 리소스 |
| `coupons` |  |  |  | 쿠폰 리소스 Youtube shopping 이용 시에는 미제공 |
| `return` |  |  |  | 반품상세 리소스 |
| `cancellation` |  |  |  | 취소상세 리소스 |
| `exchange` |  |  |  | 교환상세 리소스 |
| `refunds` |  |  |  | 환불상세 리소스 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `order` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| ↳ `currency` |  | 화폐단위 해당 멀티쇼핑몰의 화폐단위 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `market_id` |  | 마켓 구분값 가격 비교 사이트를 통하여 마켓 등에서 상품 구매 시 해당 사이트를 구분하기 위한 ID |
| ↳ `market_order_no` |  | 마켓 주문 번호 |
| ↳ `member_id` |  | 회원아이디 |
| ↳ `member_authentication` |  | 회원인증여부 회원 인증여부. 인증여부에 따라 3가지로 회원타입이 나눠짐. T : 승인 · B : 특별관리회원 · J : 14세미만회원 |
| ↳ `customer_group_no_when_ordering` |  | 주문시 회원등급 주문 당시의 회원등급 |
| ↳ `initial_order_amount` |  | 최초 주문 금액 |
| ↳ ↳ `order_price_amount` |  |  |
| ↳ ↳ `shipping_fee` |  |  |
| ↳ ↳ `points_spent_amount` |  |  |
| ↳ ↳ `credits_spent_amount` |  |  |
| ↳ ↳ `coupon_discount_price` |  |  |
| ↳ ↳ `coupon_shipping_fee_amount` |  |  |
| ↳ ↳ `membership_discount_amount` |  |  |
| ↳ ↳ `shipping_fee_discount_amount` |  |  |
| ↳ ↳ `set_product_discount_amount` |  |  |
| ↳ ↳ `app_discount_amount` |  |  |
| ↳ ↳ `point_incentive_amount` |  |  |
| ↳ ↳ `total_amount_due` |  |  |
| ↳ ↳ `payment_amount` |  | 최종 결제 금액 |
| ↳ ↳ `market_other_discount_amount` |  |  |
| ↳ ↳ `tax` |  |  |
| ↳ `actual_order_amount` |  | 현재 주문 금액 실결제금액 중 coupon_shipping_fee_amount는 할인 금액 자동 계산을 사용할 때만 품목별로 배송비 배분이 가능하기 때문에 할인 금액 자동 계산 기능을 사용할 때만 노출됨 |
| ↳ ↳ `order_price_amount` |  |  |
| ↳ ↳ `shipping_fee` |  |  |
| ↳ ↳ `points_spent_amount` |  |  |
| ↳ ↳ `credits_spent_amount` |  |  |
| ↳ ↳ `coupon_discount_price` |  |  |
| ↳ ↳ `coupon_shipping_fee_amount` |  |  |
| ↳ ↳ `membership_discount_amount` |  |  |
| ↳ ↳ `shipping_fee_discount_amount` |  |  |
| ↳ ↳ `set_product_discount_amount` |  |  |
| ↳ ↳ `app_discount_amount` |  |  |
| ↳ ↳ `point_incentive_amount` |  |  |
| ↳ ↳ `total_amount_due` |  |  |
| ↳ ↳ `payment_amount` |  | 최종 결제 금액 |
| ↳ ↳ `market_other_discount_amount` |  |  |
| ↳ ↳ `tax` |  |  |
| ↳ `billing_name` |  | 결제자명 입금자 이름. 주문자 혹은 수령자 이름과는 다를 수 있음. |
| ↳ `bank_code` |  | 은행코드 bank_code |
| ↳ `bank_code_name` |  | 입금자 은행명 |
| ↳ `payment_method` |  | 결제수단 코드 주문자가 이용한 결제수단의 코드 cash : 무통장 · card : 신용카드 · cell : 휴대폰 · tcash : 계좌이체 · icash : 가상계좌 · prepaid : 선불금 · credit : 예치금 · point : 적립금 · pointfy : 통합포인트 · cvs : 편의점 · cod : 후불 · coupon : 쿠폰 · market_discount : 마켓할인 · giftcard : 제휴상품권 · pointcard : 제휴포인트 · etc : 기타 |
| ↳ `payment_method_name` |  | 결제수단명 주문자가 이용한 결제수단의 이름 |
| ↳ `payment_gateway_names` |  | PG 이름 |
| ↳ `sub_payment_method_name` |  | 해외 결제수단명 |
| ↳ `sub_payment_method_code` |  | 해외 결제수단코드 sub_payment_method_code |
| ↳ `transaction_ids` |  | 카드 거래 아이디 |
| ↳ `paid` |  | 결제 여부 결제가 완료되었는지 여부 T : 결제 · F : 미결제 · M : 부분 결제 |
| ↳ `canceled` |  | 취소 여부 T : 취소 · F : 미취소 · M : 부분 취소 |
| ↳ `order_date` |  | 주문일 |
| ↳ `first_order` |  | 최초 주문여부 해당 주문이 최초 주문인지 여부 T : 최초 주문 · F : 최초 주문 아님 |
| ↳ `payment_date` |  | 결제일 |
| ↳ `order_from_mobile` |  | 모바일 구분 주문이 모바일에서 이루어졌는지 여부 T : 모바일 주문 · F : 모바일 주문 아님 |
| ↳ `use_escrow` |  | 에스크로 사용여부 에스크로를 사용했는지 여부 T : 에스크로 사용 · F : 에스크로 미사용 |
| ↳ `bank_account_no` |  | 계좌번호 해당 주문건에 대한 쇼핑몰의 계좌번호 |
| ↳ `bank_account_owner_name` |  | 예금주 |
| ↳ `market_seller_id` |  | 마켓 판매자 아이디 |
| ↳ `payment_amount` |  | 최종 결제 금액 |
| ↳ `cancel_date` |  | 주문취소일 |
| ↳ `order_place_name` |  | 주문경로 텍스트 |
| ↳ `order_place_id` |  | 주문경로 |
| ↳ `payment_confirmation` |  | 후불결제 입금확인 가능 여부 T : 입금확인 · F : 입금미확인 |
| ↳ `commission` |  | 결제 수수료 |
| ↳ `postpay` |  | 후불결제여부 T : 후불결제 · F : 후불결제 아님 |
| ↳ `admin_additional_amount` |  | 관리자 입력 금액 |
| ↳ `additional_shipping_fee` |  | 추가 배송비 |
| ↳ `international_shipping_insurance` |  | 해외배송 보험료 |
| ↳ `additional_handling_fee` |  | 해외배송 부가금액 |
| ↳ `shipping_type` |  | 배송 유형 배송 유형. 국내배송인지 해외배송인지 여부 A : 국내 · B : 해외 |
| ↳ `shipping_type_text` |  | 배송 유형명 배송 유형. 국내배송인지 해외배송인지 여부 |
| ↳ `shipping_status` |  | 배송상태 F : 배송전 · M : 배송중 · T : 배송완료 · W : 배송보류 · X : 발주전 |
| ↳ `shipping_fee_detail` |  | 배송비 정보 |
| ↳ ↳ `shipping_group_code` |  |  |
| ↳ ↳ `supplier_code` |  |  |
| ↳ ↳ `shipping_fee` |  |  |
| ↳ ↳ `cancel_shipping_fee` |  |  |
| ↳ ↳ `additional_shipping_fee` |  | 추가 배송비 |
| ↳ ↳ `refunded_shipping_fee` |  |  |
| ↳ ↳ `return_shipping_fee` |  |  |
| ↳ ↳ `items` |  | 품주 리소스 · 조회시 Embed 파라메터를 사용하여 조회할 수 있다. |
| ↳ `regional_surcharge_detail` |  | 지역별 배송비 정보 |
| ↳ ↳ `shipping_group_code` |  |  |
| ↳ ↳ `supplier_code` |  |  |
| ↳ ↳ `regional_surcharge_amount` |  |  |
| ↳ ↳ `regional_surcharge_calculation_type` |  |  |
| ↳ ↳ `template_code` |  |  |
| ↳ ↳ `template_name` |  |  |
| ↳ ↳ `cancel_shipping_fee` |  |  |
| ↳ ↳ `additional_shipping_fee` |  | 추가 배송비 |
| ↳ ↳ `refunded_shipping_fee` |  |  |
| ↳ ↳ `return_shipping_fee` |  |  |
| ↳ ↳ `items` |  | 품주 리소스 · 조회시 Embed 파라메터를 사용하여 조회할 수 있다. |
| ↳ `wished_delivery_date` |  | 희망배송일 |
| ↳ `wished_delivery_time` |  | 희망배송시간 |
| ↳ `wished_carrier_id` |  | 희망배송사 코드 |
| ↳ `wished_carrier_name` |  | 희망배송사 명 |
| ↳ `return_confirmed_date` |  | 반품승인일시 |
| ↳ `total_supply_price` |  | 총 공급가액 |
| ↳ `naver_point` |  | 네이버포인트 |
| ↳ `additional_order_info_list` |  | 주문서 추가항목 |
| ↳ ↳ `id` |  |  |
| ↳ ↳ `name` |  |  |
| ↳ ↳ `value` |  |  |
| ↳ ↳ `input_type` |  |  |
| ↳ ↳ `product_type` |  |  |
| ↳ ↳ `applied_product_list` |  | (목록) |
| ↳ `store_pickup` |  | 매장수령여부 T : 매장수령 · F : 매장수령 아님 |
| ↳ `easypay_name` |  | 간편결제 결제사 이름 |
| ↳ `loan_status` |  | 여신상태 OK : GOOD · NG : NOT GOOD · ER : ERROR |
| ↳ `subscription` |  | 정기결제 여부 T : 정기결제 · F : 정기결제 아님 |
| ↳ `multiple_addresses` |  | 멀티 배송지 여부 T : 멀티 배송지 주문 · F : 멀티 배송지 주문 아님 |
| ↳ `exchange_rate` |  | 결제 화폐 환율 정보 |
| ↳ `first_payment_methods` |  | 최초 결제수단 코드 cash : 무통장 · card : 신용카드 · cell : 휴대폰 · tcash : 계좌이체 · icash : 가상계좌 · prepaid : 선불금 · credit : 예치금 · point : 적립금 · pointfy : 통합포인트 · cvs : 편의점 · cod : 후불 · giftcard : 제휴상품권 · pointcard : 제휴포인트 · etc : 기타 |
| ↳ `naverpay_payment_information` |  | 네이버페이 PG 결제 정보 P : PG결제 · N : 네이버결제 |
| ↳ `include_tax` |  | 가격에 세금 포함 T: 세금포함 · F: 세금제외 |
| ↳ `tax_detail` |  | 세금 상세 정보 |
| ↳ ↳ `name` |  |  |
| ↳ ↳ `amount` |  |  |
| ↳ ↳ `price_before_tax` |  |  |
| ↳ ↳ `price_before_tax_type` |  |  |
| ↳ ↳ `order_item_code` |  | 품주코드 |
| ↳ ↳ `country_tax_rate` |  |  |
| ↳ ↳ `region_tax` |  | (응답 객체) |
| ↳ ↳ ↳ `rate` |  |  |
| ↳ ↳ ↳ `taxation_method` |  |  |
| ↳ ↳ `product_tax_override` |  | (응답 객체) |
| ↳ ↳ ↳ `rate` |  |  |
| ↳ ↳ ↳ `taxation_method` |  |  |
| ↳ ↳ `shipping_tax_override` |  | (응답 객체) |
| ↳ ↳ ↳ `rate` |  |  |
| ↳ ↳ ↳ `taxation_method` |  |  |
| ↳ `service_type` |  | 주문 서비스 유형 rental : 렌탈주문 |
| ↳ `service_data` |  | 주문 서비스 데이터 |
| ↳ ↳ `key` |  |  |
| ↳ ↳ `value` |  |  |
| ↳ ↳ `title` |  |  |
| ↳ `show_shipping_address` |  | 배송지 정보 표기 여부 T: 배송지 정보 표기 · F: 배송지 정보 가림 |
| ↳ `social_member_code` |  | 연동 된 SNS 제공코드 |
| ↳ `social_name` |  | 연동 된 SNS명 |

응답 예시 (JSON):

```json
{
    "order": {
        "shop_no": 1,
        "currency": "KRW",
        "order_id": "20170710-0000013",
        "market_id": "self",
        "market_order_no": null,
        "member_id": "sampleid",
        "member_authentication": "T",
        "customer_group_no_when_ordering": 1,
        "initial_order_amount": {
            "order_price_amount": "5000.00",
            "shipping_fee": "14000.00",
            "points_spent_amount": "0.00",
            "credits_spent_amount": "1500.00",
            "coupon_discount_price": "1000.00",
            "coupon_shipping_fee_amount": "0.00",
            "membership_discount_amount": "0.00",
            "shipping_fee_discount_amount": "5500.00",
            "set_product_discount_amount": "0.00",
            "app_discount_amount": "0.00",
            "point_incentive_amount": "0.00",
            "total_amount_due": "0.00",
            "payment_amount": "30000.00",
            "market_other_discount_amount": "0.00",
            "tax": "120.0"
        },
        "actual_order_amount": {
            "order_price_amount": "5000.00",
            "shipping_fee": "14000.00",
            "points_spent_amount": "0.00",
            "credits_spent_amount": "1500.00",
            "coupon_discount_price": "0.00",
            "coupon_shipping_fee_amount": "0.00",
            "membership_discount_amount": "0.00",
            "shipping_fee_discount_amount": "0.00",
            "set_product_discount_amount": "0.00",
            "app_discount_amount": "0.00",
            "point_incentive_amount": "0.00",
            "total_amount_due": "0.00",
            "payment_amount": "16000.00",
            "market_other_discount_amount": "0.00",
            "tax": "60.0"
        },
        "billing_name": "Test",
        "bank_code": "bank_26",
        "bank_code_name": "Sample Bank",
        "payment_method": [
            "card",
            "cash"
        ],
        "payment_method_name": [
            "Card",
            "Cash"
        ],
        "payment_gateway_names": null,
        "sub_payment_method_name": "PayPal",
        "sub_payment_method_code": "PM002",
        "transaction_ids": null,
        "paid": "T",
        "canceled": "F",
        "order_date": "2018-07-04T11:21:35+09:00",
        "first_order": "T",
        "payment_date": "2018-07-04T11:21:35+09:00",
        "order_from_mobile": "F",
        "use_escrow": "F",
        "bank_account_no": "12312422234",
        "bank_account_owner_name": "John Doe",
        "market_seller_id": null,
        "payment_amount": "30000.00",
        "cancel_date": null,
        "order_place_name": "Naver Pay",
        "order_place_id": "NCHECKOUT",
        "payment_confirmation": null,
        "commission": "0.00",
        "postpay": "F",
        "admin_additional_amount": "0.00",
        "additional_shipping_fee": "0.00",
        "international_shipping_insurance": "0.00",
        "additional_handling_fee": "0.00",
        "shipping_type": "A",
        "shipping_type_text": "Domestic Shipping",
        "shipping_status": "T",
        "shipping_fee_detail": [
            {
                "shipping_group_code": 80,
                "supplier_code": "S0000000",
                "shipping_fee": "2500.00",
                "cancel_shipping_fee": "0.00",
                "additional_shipping_fee": "0.00",
                "refunded_shipping_fee": "0.00",
                "return_shipping_fee": "0.00",
                "items": [
                    "20170710-0000013-01",
                    "20170710-0000013-02"
                ]
            },
            {
                "shipping_group_code": 81,
                "supplier_code": "S000000A",
                "shipping_fee": "2500.00",
                "cancel_shipping_fee": "0.00",
                "additional_shipping_fee": "0.00",
                "refunded_shipping_fee": "0.00",
                "return_shipping_fee": "0.00",
                "items": [
                    "20170710-0000013-03",
                    "20170710-0000013-04"
                ]
            }
        ],
        "regional_surcharge_detail": [
            {
                "shipping_group_code": 82,
                "supplier_code": "S0000000",
                "regional_surcharge_amount": "5000.00",
                "regional_surcharge_calculation_type": "custom",
                "template_code": 5,
                "template_name": "Jeju/Island Shipping",
                "cancel_shipping_fee": "0.00",
                "additional_shipping_fee": "0.00",
                "refunded_shipping_fee": "0.00",
                "return_shipping_fee": "0.00",
                "items": [
                    "20170710-0000013-01",
                    "20170710-0000013-02"
                ]
            },
            {
                "shipping_group_code": 83,
                "supplier_code": "S000000A",
                "regional_surcharge_amount": "4000.00",
                "regional_surcharge_calculation_type": "default",
                "template_code": 4,
                "template_name": "Default Template",
                "cancel_shipping_fee": "0.00",
                "additional_shipping_fee": "0.00",
                "refunded_shipping_fee": "0.00",
                "return_shipping_fee": "0.00",
                "items": [
                    "20170710-0000013-03",
                    "20170710-0000013-04"
                ]
            }
        ],
        "wished_delivery_date": "",
        "wished_delivery_time": null,
        "wished_carrier_id": null,
        "wished_carrier_name": null,
        "return_confirmed_date": null,
        "total_supply_price": "27000",
        "naver_point": 0,
        "additional_order_info_list": [
            {
                "id": 1,
                "name": "addtional info1",
                "value": "lorem ipsu",
                "input_type": "A",
                "product_type": "A",
                "applied_product_list": [
                    "iPhone X",
                    "iPhone X case"
                ]
            },
            {
                "id": 2,
                "name": "addtional info2",
                "value": "Green",
                "input_type": "A",
                "product_type": "A",
                "applied_product_list": [
                    "iPhone X",
                    "iPhone X case"
                ]
            }
        ],
        "store_pickup": "F",
        "easypay_name": "",
        "loan_status": null,
        "subscription": "T",
        "multiple_addresses": "F",
        "exchange_rate": "1063.2117",
        "first_payment_methods": [
            "card",
            "giftcard"
        ],
        "naverpay_payment_information": "N",
        "include_tax": "T",
        "tax_detail": [
            {
                "name": "VAT",
                "amount": "50.00",
                "price_before_tax": "15000.00",
                "price_before_tax_type": "I",
                "order_item_code": [
                    "20170710-0000013-01",
                    "20170710-0000013-02"
                ],
                "country_tax_rate": "5.00",
                "region_tax": {
                    "rate": "10.00",
                    "taxation_method": "A"
                },
                "product_tax_override": {
                    "rate": "7.00",
                    "taxation_method": "A"
                },
                "shipping_tax_override": {
                    "rate": null,
                    "taxation_method": null
                }
            },
            {
                "name": "TAX",
                "amount": "10.00",
                "price_before_tax": "2500.00",
                "price_before_tax_type": "S",
                "order_item_code": [
                    "20170710-0000013-01",
                    "20170710-0000013-02"
                ],
                "country_tax_rate": "5.00",
                "region_tax": {
                    "rate": "10.00",
                    "taxation_method": "A"
                },
                "product_tax_override": {
                    "rate": null,
                    "taxation_method": null
                },
                "shipping_tax_override": {
                    "rate": "7.00",
                    "taxation_method": "A"
                }
            }
        ],
        "service_type": "rental",
        "service_data": [
            {
                "key": "rental_period",
                "value": "12",
                "title": "rental period"
            },
            {
                "key": "rental_amount",
                "value": "10000",
                "title": "rental amount"
            }
        ],
        "show_shipping_address": "T",
        "social_member_code": null,
        "social_name": null
    }
}
```

### `GET /api/v2/admin/orders/count` — Retrieve a count of orders

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-orders

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `multiple_addresses` |  |  |  | 멀티 배송지 여부 T : 멀티 배송지 주문 |
| `first_order` |  |  |  | 최초 주문여부 T : 최초 주문 · F : 최초 주문 아님 |
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `start_date` |  | 날짜 |  | 검색 시작일 검색을 시작할 기준일 |
| `end_date` |  | 날짜 |  | 검색 종료일 검색을 종료할 기준일 · 검색 시작일과 같이 사용해야함. · 검색기간은 한 호출에 3개월 이상 검색 불가. |
| `order_id` |  | 주문번호 |  | 주문번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `order_status` |  |  |  | 주문상태 주문상태. 주문 상태별로 각각의 코드가 있음. ,(콤마)로 여러 건을 검색할 수 있다. N00 : 입금전 · N02 : 주문접수중 · N10 : 상품준비중 · N20 : 배송준비중 · N21 : 배송대기 · N22 : 배송보류 · N30 : 배송중 · N40 : 배송완료 · N50 : 구매확정 · C00 : 취소신청 · C10 : 취소접수 - 관리자 · C11 : 취소접수거부 - 관리자 · C34 : 취소처리중 - 환불전 · C35 : 취소처리중 - 환불완료 · C36 : 취소처리중 - 환불보류 · C40 : 취소완료 · C41 : 취소 완료 - 환불전 · C42 : 취소 완료 - 환불요청중 · C43 : 취소 완료 - 환불보류 · C47 : 입금전취소 - 구매자 · C48 : 입금전취소 - 자동취소 · C49 : 입금전취소 - 관리자 · R00 : 반품신청 · R10 : 반품접수 · R11 : 반품 접수 거부 · R12 : 반품보류 · R13 : 반품접수 - 수거완료(자동) · R20 : 반품 수거 완료 · R30 : 반품처리중 - 수거전 · R31 : 반품처리중 - 수거완료 · R34 : 반품처리중 - 환불전 · R36 : 반품처리중 - 환불보류 · R40 : 반품완료 - 환불완료 · R41 : 반품완료 - 환불전 · R42 : 반품완료 - 환불요청중 · R43 : 반품완료 - 환불보류 · E00 : 교환신청 · E10 : 교환접수 · N01 : 교환접수 - 교환상품 · N02 : 입금전 - 카드결제대기 · N03 : 교환접수 - 카드결제대기 · E11 : 교환접수거부 · E12 : 교환보류 · E13 : 교환접수 - 수거완료(자동) · E20 : 교환준비 · E30 : 교환처리중 - 수거전 · E31 : 교환처리중 - 수거완료 · E32 : 교환처리중 - 입금전 · E33 : 교환처리중 - 입금완료 · E34 : 교환처리중 - 환불전 · E35 : 교환처리중 - 환불완료 · E36 : 교환처리중 - 환불보류 · E40 : 교환완료 |
| `payment_status` |  |  |  | 결제상태 F : 입금전 · M : 추가입금대기 · T : 입금완료(수동) · A : 입금완료(자동) · P : 결제완료 |
| `member_type` |  |  |  | 회원여부 회원여부. 회원과 비회원 각각의 코드가 있음. 2 : 회원 · 3 : 비회원 |
| `group_no` |  |  |  | 회원등급번호 |
| `buyer_name` |  |  |  | 주문자명 주문자 이름. 입금자 혹은 수령자 이름과는 다를 수 있음. |
| `receiver_name` |  |  |  | 수령자명 수령자 이름. 주문자 혹은 입금자 이름과는 다를 수 있음. |
| `name_furigana` |  |  |  | 수령자명 (발음) |
| `receiver_address` |  |  |  | 수령자주소 수령자 주소. 주문자 혹은 입금자 주소와는 다를 수 있음. |
| `member_id` |  |  |  | 회원아이디 회원 아이디 |
| `member_email` |  |  |  | 회원 이메일 |
| `product_no` |  |  |  | 상품번호 상품 번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `product_code` |  |  |  | 상품코드 검색어를 상품코드에 포함하고 있는 상품 검색(대소문자 구분 필요) |
| `date_type` |  |  | order_date | 검색날짜 유형 검색을 위한 날짜 유형 기준. 기본값은 주문일로 설정되어 있음. order_date : 주문일 · pay_date : 결제일 · shipbegin_date : 배송시작일 · shipend_date : 배송완료일 · cancel_date : 주문취소일 · place_date : 발주일 · cancel_request_date : 취소신청일 · cancel_accept_date : 취소접수일 · cancel_complete_date : 취소완료일 · exchange_request_date : 교환신청일 · exchange_accept_date : 교환접수일 · exchange_complete_date : 교환완료일 · return_request_date : 반품신청일 · return_accept_date : 반품접수일 · return_complete_date : 반품완료일 · purchaseconfirmation_date : 구매확정일 |
| `supplier_id` |  |  |  | 공급사 아이디 ,(콤마)로 여러 건을 검색할 수 있다. |
| `order_place_id` |  |  |  | 주문경로 ,(콤마)로 여러 건을 검색할 수 있다. cafe24:카페24 · mobile:모바일웹 · mobile_d:모바일앱 · NCHECKOUT:네이버페이 · inpark:인터파크 · auction:옥션 · sk11st:11번가 · gmarket:G마켓 · coupang:쿠팡 · shopn:스마트스토어 |
| `buyer_cellphone` |  |  |  | 주문자 휴대 전화 |
| `buyer_phone` |  |  |  | 주문자 일반 전화 |
| `buyer_email` |  |  |  | 주문자 이메일 |
| `inflow_path` |  |  |  | 유입경로 |
| `subscription` |  |  |  | 정기결제 여부 T : 정기결제 · F : 정기결제 아님 |
| `market_order_no` |  | 형식 : [a-zA-Z0-9_-]; 최대글자수 : [40자] |  | 마켓 주문 번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `market_cancel_request` |  |  |  | 마켓 취소요청 여부 T : 취소 요청된 마켓 주문 |
| `payment_method` |  |  |  | 결제수단 코드 ,(콤마)로 여러 건을 검색할 수 있다. cash : 무통장 · card : 신용카드 · tcash : 계좌이체 · icash : 가상계좌 · cell : 휴대폰 · deferpay : 후불 · cvs : 편의점 · point : 선불금 · mileage : 적립금 · deposit : 예치금 · giftcard : 제휴상품권 · pointcard : 제휴포인트 · etc : 기타 |
| `payment_gateway_name` |  |  |  | PG 이름 ,(콤마)로 여러 건을 검색할 수 있다. |
| `market_seller_id` |  |  |  | 마켓 판매자 아이디 |
| `discount_method` |  |  |  | 할인수단 ,(콤마)로 여러 건을 검색할 수 있다. point : 적립금 · credit : 예치금 · coupon : 쿠폰 · market_discount : 마켓할인 · discount_code : 할인코드 |
| `discount_code` |  |  |  | 할인코드 |
| `carrier_id` |  | 최소값: [1] |  | 배송사 아이디 |
| `wished_carrier_id` |  | 최소값: [1] |  | 희망배송사 아이디 ,(콤마)로 여러 건을 검색할 수 있다. |
| `labels` |  |  |  | 주문 라벨 ,(콤마)로 여러 건을 검색할 수 있다. |
| `refund_status` |  |  |  | CS(환불)상태 ,(콤마)로 여러 건을 검색할 수 있다. F : 환불전 · T : 환불완료 · M : 환불보류 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `count` |  |  |

응답 예시 (JSON):

```json
{
    "count": 3
}
```

### `PUT /api/v2/admin/orders` — Update status for multiple orders

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 100
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-status-for-multiple-orders

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `process_status` |  |  |  | 주문상태 prepare : 배송준비중 · prepareproduct : 상품준비중 · hold : 배송보류 · unhold : 배송보류해제 |
| `order_item_code` |  |  |  | 품주코드 |
| `purchase_confirmation` |  |  |  | 구매확정 여부 T : 구매확정 · F : 구매확정 철회 |
| `collect_points` |  |  | F | 적립금 회수 Youtube shopping 이용 시에는 미제공 T: 회수 · F: 회수안함 |
| `show_shipping_address` |  |  |  | 배송지 정보 표기 여부 T: 배송지 정보 표기 · F: 배송지 정보 가림 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `orders` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| ↳ `order_id` |  | 주문번호 |
| ↳ `process_status` |  | 주문상태 prepare : 배송준비중 · prepareproduct : 상품준비중 · hold : 배송보류 · unhold : 배송보류해제 |
| ↳ `order_item_code` |  | 품주코드 |
| ↳ `purchase_confirmation` |  | 구매확정 여부 |
| ↳ `collect_points` |  | 적립금 회수 |
| ↳ `show_shipping_address` |  | 배송지 정보 표기 여부 T: 배송지 정보 표기 · F: 배송지 정보 가림 |

응답 예시 (JSON):

```json
{
    "orders": [
        {
            "shop_no": 1,
            "order_id": "20171207-0000021",
            "process_status": "prepare",
            "order_item_code": [
                "20171207-0000021-01",
                "20171207-0000021-02"
            ],
            "purchase_confirmation": null,
            "collect_points": "F",
            "show_shipping_address": null
        },
        {
            "shop_no": 1,
            "order_id": "20171207-0000023",
            "process_status": "prepare",
            "order_item_code": [
                "20171207-0000023-01",
                "20171207-0000023-02"
            ],
            "purchase_confirmation": null,
            "collect_points": "F",
            "show_shipping_address": null
        }
    ]
}
```

### `PUT /api/v2/admin/orders/{order_id}` — Update an order status

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-status

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ |  |  | 주문번호 |
| `process_status` |  |  |  | 주문상태 prepare : 배송준비중 · prepareproduct : 상품준비중 · hold : 배송보류 · unhold : 배송보류해제 |
| `order_item_code` |  |  |  | 품주코드 |
| `purchase_confirmation` |  |  |  | 구매확정 여부 T : 구매확정 · F : 구매확정 철회 |
| `collect_points` |  |  | F | 적립금 회수 Youtube shopping 이용 시에는 미제공 T: 회수 · F: 회수안함 |
| `show_shipping_address` |  |  |  | 배송지 정보 표기 여부 T: 배송지 정보 표기 · F: 배송지 정보 가림 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `order` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| ↳ `process_status` |  | 주문상태 prepare : 배송준비중 · prepareproduct : 상품준비중 · hold : 배송보류 · unhold : 배송보류해제 |
| ↳ `order_item_code` |  | 품주코드 |
| ↳ `purchase_confirmation` |  | 구매확정 여부 |
| ↳ `collect_points` |  | 적립금 회수 |
| ↳ `show_shipping_address` |  | 배송지 정보 표기 여부 T: 배송지 정보 표기 · F: 배송지 정보 가림 |

응답 예시 (JSON):

```json
{
    "order": {
        "shop_no": 1,
        "process_status": "prepare",
        "order_item_code": [
            "20180627-0000017-01",
            "20180627-0000017-02"
        ],
        "purchase_confirmation": null,
        "collect_points": "F",
        "show_shipping_address": null
    }
}
```
