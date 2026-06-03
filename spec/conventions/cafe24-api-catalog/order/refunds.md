---
resource: order
entity: refunds
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#refunds
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Order / Refunds

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Refunds](https://developers.cafe24.com/docs/ko/api/admin/#refunds)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

환불(Refunds)은 주문의 상태가 환불과 관련된 상태에 대해 조회할 수 있는 기능입니다. · 환불전, 환불보류, 환불완료 단계가 아닌 주문에 대해서는 조회할 수 없으므로 주문상태를 잘 확인하고 사용해주세요.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `member_id` |  | 회원아이디 |
| `member_email` |  | 회원 이메일 |
| `buyer_email` |  | 주문자 이메일 |
| `order_date` |  | 주문일 |
| `accepted_refund_date` |  | 환불접수일자 |
| `refund_date` |  | 환불완료일자 |
| `order_id` |  | 주문번호 |
| `refund_code` |  | 환불번호 |
| `order_item_code` |  | 품주코드 목록 |
| `quantity` |  | 수량 |
| `actual_refund_amount` |  | 실환불금액 |
| `used_points` |  | 사용된 적립금 반환액 |
| `used_credits` |  | 사용된 예치금 반환액 |
| `currency` |  | 화폐단위 |
| `payment_methods` |  | 결제수단 cash : 무통장 · card : 신용카드 · cell : 휴대폰 · tcash : 계좌이체 · icash : 가상계좌 · prepaid : 선불금 · credit : 예치금 · point : 적립금 · pointfy : 통합포인트 · cvs : 편의점 · cod : 후불 · coupon : 쿠폰 · market_discount : 마켓할인 · giftcard : 제휴상품권 · pointcard : 제휴포인트 · etc : 기타 |
| `refund_payment_methods` |  | 환불 결제수단 cash : 무통장 · card : 신용카드 · cell : 휴대폰 · tcash : 계좌이체 · prepaid : 선불금 · credit : 예치금 · point : 적립금 · pointfy : 통합포인트 · cvs : 편의점 · cod : 후불 · giftcard : 제휴상품권 · pointcard : 제휴포인트 · etc : 기타 |
| `payment_gateway_cancel_statuses` |  | PG 취소상태 F : 취소전 · M : 부분취소 완료 · T : 전체취소 완료 |
| `payment_gateway_cancel_dates` |  | PG 취소처리 일자 |
| `status` |  | 환불상태 T : 환불완료 · F : 환불전 |
| `refund_methods` |  | 환불 방식 |
| `refund_bank_name` |  | 환불은행명 |
| `refund_bank_account_no` |  | 환불 계좌번호 |
| `refund_bank_account_holder` |  | 환불계좌 예금주 명의 |
| `include_tax` |  | 가격에 세금 포함 T: 세금포함 · F: 세금제외 |
| `tax` |  | 세금 정보 세금 관리자 앱을 사용 안 할 경우 null로 반환 |
| `cancel_fee_amount` |  | 취소수수료 |
| `refund_point` |  | 적립금 반환액 |
| `refund_credit` |  | 예치금 반환액 |
| `refund_naver_point` |  | 네이버 포인트 반환액 |
| `refund_naver_cash` |  | 네이버 캐시 반환액 |
| `refund_amount` |  | 환불금액 |
| `product_price` |  | 상품 판매가 |
| `shipping_fee` |  | 배송비 DEFAULT 0.00 |
| `refund_shipping_fee` |  | 환불배송비 DEFAULT 0.00 |
| `refund_regional_surcharge` |  | 지역별 환불배송비 DEFAULT 0.00 |
| `return_shipping_fee` |  | 반품배송비 DEFAULT 0.00 |
| `return_regional_surcharge` |  | 지역별 반품배송비 DEFAULT 0.00 |
| `additional_shipping_fee` |  | 추가 배송비 DEFAULT 0.00 |
| `international_shipping_insurance` |  | 해외배송 보험료 DEFAULT 0.00 |
| `international_shipping_additional_fee` |  | 해외배송 부가금액 DEFAULT 0.00 |
| `shipping_fee_discount_amount` |  | 배송비할인 |
| `cod_fees` |  | 후불 결제 수수료 |
| `product_discount_amount` |  | 상품별 할인금액 |
| `member_group_discount_amount` |  | 회원등급 할인금액 |
| `app_item_discount_amount` |  | 앱 상품할인금액 |
| `app_discount_amount` |  | 앱 주문할인금액​​​ |
| `coupon_discount_amount` |  | 쿠폰 할인금액 |
| `product_bundle_discount_amount` |  | 세트상품 할인금액 |
| `points_spent_amount` |  | 적립금사용금액 |
| `credits_spent_amount` |  | 예치금사용금액 |
| `naver_point` |  | 네이버포인트 |
| `naver_cash` |  | 네이버캐시 |
| `additional_product_amount` |  | 상품 추가 결제금액 |
| `manually_input_amount` |  | 관리자 입력 금액 |
| `changed_refund_amount` |  | 변경된 환불금액 |
| `refund_manager` |  | 환불 담당자 |
| `refund_reason` |  | 환불사유 |
| `send_sms` |  | 환불처리후 SMS 발송 여부 T : 발송함 · F : 발송안함 |
| `send_mail` |  | 환불처리후 메일 발송 여부 T : 발송함 · F : 발송안함 |
| `items` |  | 품주 리소스 |

## Operations

### `GET /api/v2/admin/refunds` — Retrieve a list of refunds

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-refunds

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `start_date` | ✓ | 날짜 |  | 검색 시작일 |
| `end_date` | ✓ | 날짜 |  | 검색 종료일 |
| `date_type` |  |  | refund_date | 검색날짜 유형 accepted_refund_date : 환불접수일 · refund_date : 환불완료일 |
| `member_email` |  |  |  | 회원 이메일 |
| `buyer_email` |  |  |  | 주문자 이메일 |
| `order_id` |  | 주문번호 |  | 주문번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `member_id` |  | 최대글자수 : [20자] |  | 회원아이디 |
| `refund_status` |  |  |  | CS(환불)상태 ,(콤마)로 여러 건을 검색할 수 있다. F : 환불전 · T : 환불완료 · M : 환불보류 |
| `limit` |  | 최소: [1]~최대: [500] | 10 | 조회결과 최대건수 |
| `offset` |  | 최대값: [15000] | 0 | 조회결과 시작위치 |

### `GET /api/v2/admin/refunds/{refund_code}` — Retrieve a refund

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-refund

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `refund_code` | ✓ |  |  | 환불번호 |
| `items` |  |  |  | 품주 리소스 |
