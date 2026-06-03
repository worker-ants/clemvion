---
resource: store
entity: orders-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders-setting
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Store / Orders setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders setting](https://developers.cafe24.com/docs/ko/api/admin/#orders-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

취소/반품시 자동 수량 복구 및 할인/적립 금액 등 주문 설정에 대해 조회, 수정 할 수 있는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 |
| `claim_request` |  | 구매자 취소/교환/반품 신청 사용설정 T : 사용함 · F : 사용안함 |
| `claim_request_type` |  | 구매자 취소/교환/반품 신청 시 표시항목 설정 claim_request 항목이 T일 때만 확인이 가능하다. S : 기본신청 항목 표시 · D : 상세신청 항목 표시 |
| `claim_request_button_exposure` |  | 구매자 취소/교환/반품 신청버튼 노출 범위 설정 cancel_N10 : 취소신청 상품준비중 · cancel_N20 : 취소신청 배송준비중 · cancel_N22 : 취소신청 배송보류 · cancel_N21 : 취소신청 배송대기 · exchange_N00 : 교환신청 입금전 · exchange_N10 : 교환신청 상품준비중 · exchange_N20 : 교환신청 배송준비중 · exchange_N22 : 교환신청 배송보류 · exchange_N21 : 교환신청 배송대기 · exchange_N30 : 교환신청 배송중 · exchange_N40 : 교환신청 배송완료 · return_N30 : 반품신청 배송중 · return_N40 : 반품신청 배송완료 |
| `claim_request_button_date_type` |  | 구매자 취소/교환/반품 신청버튼 노출 기준일 order_date : 주문 완료일 기준 · shipend_date : 배송완료일 기준 |
| `claim_request_button_period` |  | 구매자 취소/교환/반품 신청버튼 노출 기간 |
| `stock_recover` |  | 취소/반품 시 자동 수량복구 T : 기본 설정 · F : 개별 설정 |
| `stock_recover_base` |  | 취소/반품 시 자동 수량복구 - 기본설정 T : 자동 복구함 · F : 자동 복구 안함 · M : 수량복구 여부를 확인함 |
| `stock_recover_individual` |  | 취소/반품 시 자동 수량복구 - 개별설정 |
| `claim_request_auto_accept` |  | 구매자 취소/반품 신청 건 자동 접수 설정 T : 사용함 · F : 사용안함 |
| `refund_benefit_setting` |  | 취소/교환/반품 접수 시 할인/적립 금액 설정 |
| `refund_processing_setting` |  | 취소/교환/반품 접수 시 환불 접수 처리 설정 S : 동시에 처리함 · D : 분리하여 처리함 |
| `use_product_prepare_status` |  | 상품준비중 주문상태 사용여부 T : 사용함 · F : 사용안함 |
| `use_purchase_confirmation_button` |  | 구매확정 버튼 사용여부 T : 사용함 · F : 사용안함 |
| `purchase_confirmation_button_set_date` |  | 구매확정 버튼 적용 날짜 |
| `use_purchase_confirmation_auto_check` |  | 구매확정 자동체크 사용여부 T : 사용함 · F : 사용안함 |
| `purchase_confirmation_auto_check_day` |  | 구매확정 자동체크 기준일 |
| `purchase_confirmation_auto_check_set_date` |  | 구매확정 자동체크 적용 날짜 |
| `use_additional_fields` |  | 추가항목 사용 여부 T : 사용함 · F : 사용안함 |
| `customer_pays_return_shipping` |  | 배송 후 교환/반품 신청 시 구매자부담 배송비 결제 사용 여부 T : 사용함 · F : 사용안함 |
| `refund_bank_account_required` |  | 취소/교환/반품 시 환불계좌정보 등록 필수 여부 T : 필수 · F : 선택 |
| `exchange_shipping_fee` |  | 교환배송비(왕복) 설정 |
| `return_shipping_fee` |  | 반품배송비(편도) 설정 |
| `auto_delivery_completion` |  | 배송완료 일괄체크 설정 T : 사용함 · F : 사용안함 |
| `delivery_completion_after_days` |  | 배송완료 처리 기준일 |
| `receiver_address_modify_button_exposure` |  | 배송지 변경 버튼 노출 범위 설정 N00 : 입금전 · N10 : 상품준비중 · N20 : 배송준비중 · N22 : 배송보류 |
| `auto_cancel` |  | 미입금 주문 자동취소 사용설정 T : 사용함 · F : 사용안함 |
| `auto_cancel_cash_unit` |  | 무통장입금 자동취소 단위 D : 일단위 · T : 시간단위 |
| `auto_cancel_cash_period` |  | 무통장입금 자동취소 기간 |
| `auto_cancel_virtual_account_period` |  | 가상계좌 자동취소 기간 |
| `auto_cancel_cvs_period` |  | 편의점결제 자동취소 기간 |
| `use_shipped_auto_check_start_day` |  | 배송완료 일괄체크 시작시점 사용여부 |
| `shipped_auto_check_start_day` |  | 배송완료 일괄체크 시작일 |

## Operations

### `GET /api/v2/admin/orders/setting` — Retrieve Order Settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-order-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

### `PUT /api/v2/admin/orders/setting` — Update Order settings

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-order-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `refund_benefit_setting` |  |  |  | 취소/교환/반품 접수 시 할인/적립 금액 설정 F: 전체 금액 기준으로 표시 · T: 선택 품목 기준으로 표시 · U: 할인금액 자동계산(설정한 이후 접수된 주문부터 적용) |
| `use_product_prepare_status` |  |  |  | 상품준비중 주문상태 사용여부 상품준비중 주문상태 사용 설정에 따라서 아래 설정의 '상품준비중' 기능이 제어됨 · - 배송지 변경 버튼 노출 범위 설정: '상품준비중' · - 구매자 취소/교환/반품 신청버튼 노출 범위 설정: '상품준비중' T : 사용함 · F : 사용안함 |
| `use_purchase_confirmation_button` |  |  |  | 구매확정 버튼 사용여부 T : 사용함 · F : 사용안함 |
| `purchase_confirmation_button_set_date` |  | 날짜 |  | 구매확정 버튼 적용 날짜 |
| `use_purchase_confirmation_auto_check` |  |  |  | 구매확정 자동체크 사용여부 T : 사용함 · F : 사용안함 |
| `purchase_confirmation_auto_check_day` |  | 최소: [1]~최대: [30] |  | 구매확정 자동체크 기준일 |
| `purchase_confirmation_auto_check_set_date` |  | 날짜 |  | 구매확정 자동체크 적용 날짜 |
| `exchange_shipping_fee` |  | 글자수 최소: [1자]~최대: [9자]; 최소: [0]~최대: [999999999] |  | 교환배송비(왕복) 설정 |
| `return_shipping_fee` |  | 글자수 최소: [1자]~최대: [9자]; 최소: [0]~최대: [999999999] |  | 반품배송비(편도) 설정 |
| `auto_delivery_completion` |  |  |  | 배송완료 일괄체크 설정 T : 사용함 · F : 사용안함 |
| `delivery_completion_after_days` |  | 최소: [1]~최대: [30] |  | 배송완료 처리 기준일 |
| `receiver_address_modify_button_exposure` |  |  |  | 배송지 변경 버튼 노출 범위 설정 N00 : 입금전 · N10 : 상품준비중 · N20 : 배송준비중 · N22 : 배송보류 |
| `auto_cancel` |  |  |  | 미입금 주문 자동취소 사용설정 Youtube shopping 이용 시에는 미제공 T : 사용함 · F : 사용안함 |
| `auto_cancel_cash_unit` |  |  |  | 무통장입금 자동취소 단위 Youtube shopping 이용 시에는 미제공 D : 일단위 · T : 시간단위 |
| `auto_cancel_cash_period` |  | 최소: [1]~최대: [23] |  | 무통장입금 자동취소 기간 Youtube shopping 이용 시에는 미제공 |
| `auto_cancel_virtual_account_period` |  | 최소: [1]~최대: [10] |  | 가상계좌 자동취소 기간 Youtube shopping 이용 시에는 미제공 |
| `auto_cancel_cvs_period` |  | 최소: [1]~최대: [10] |  | 편의점결제 자동취소 기간 Youtube shopping 이용 시에는 미제공 |
| `claim_request` |  |  |  | 구매자 취소/교환/반품 신청 사용설정 T : 사용함 · F : 사용안함 |
| `claim_request_type` |  |  |  | 구매자 취소/교환/반품 신청 시 표시항목 설정 S : 기본신청 항목 표시 · D : 상세신청 항목 표시 |
| `claim_request_button_exposure` |  |  |  | 구매자 취소/교환/반품 신청버튼 노출 범위 설정 Youtube shopping 이용 시에는 미제공 cancel_N10 : 취소신청 상품준비중 · cancel_N20 : 취소신청 배송준비중 · cancel_N22 : 취소신청 배송보류 · cancel_N21 : 취소신청 배송대기 · exchange_N00 : 교환신청 입금전 · exchange_N10 : 교환신청 상품준비중 · exchange_N20 : 교환신청 배송준비중 · exchange_N22 : 교환신청 배송보류 · exchange_N21 : 교환신청 배송대기 · exchange_N30 : 교환신청 배송중 · exchange_N40 : 교환신청 배송완료 · return_N30 : 반품신청 배송중 · return_N40 : 반품신청 배송완료 |
| `claim_request_button_date_type` |  |  |  | 구매자 취소/교환/반품 신청버튼 노출 기준일 Youtube shopping 이용 시에는 미제공 order_date : 주문 완료일 기준 · shipend_date : 배송완료일 기준 |
| `claim_request_button_period` |  | 최소: [1]~최대: [365] |  | 구매자 취소/교환/반품 신청버튼 노출 기간 Youtube shopping 이용 시에는 미제공 |
| `stock_recover` |  |  |  | 취소/반품 시 자동 수량복구 Youtube shopping 이용 시에는 미제공 T : 기본 설정 · F : 개별 설정 |
| `stock_recover_base` |  |  |  | 취소/반품 시 자동 수량복구 - 기본설정 Youtube shopping 이용 시에는 미제공 T : 자동 복구함 · F : 자동 복구 안함 · M : 수량복구 여부를 확인함 |
| `stock_recover_individual` |  |  |  | 취소/반품 시 자동 수량복구 - 개별설정 Youtube shopping 이용 시에는 미제공 |
| ↳ `cancel_before` |  | _Youtube shopping 이용 시에는 미제공_ |  | 개별설정 자동수량 복구 - 취소 시(입금전) · T : 자동 복구함 · F : 자동 복구 안함 · M : 수량복구 여부를 확인함 |
| ↳ `cancel_after` |  | _Youtube shopping 이용 시에는 미제공_ |  | 개별설정 자동수량 복구 - 취소 시(입금후) · T : 자동 복구함 · F : 자동 복구 안함 · M : 수량복구 여부를 확인함 |
| ↳ `cancel_return` |  | _Youtube shopping 이용 시에는 미제공_ |  | 개별설정 자동수량 복구 - 반품 시 · T : 자동 복구함 · F : 자동 복구 안함 · M : 수량복구 여부를 확인함 |
| `refund_bank_account_required` |  |  |  | 취소/교환/반품 시 환불계좌정보 등록 필수 여부 Youtube shopping 이용 시에는 미제공 T : 필수 · F : 선택 |
| `refund_processing_setting` |  |  |  | 취소/교환/반품 접수 시 환불 접수 처리 설정 Youtube shopping 이용 시에는 미제공 S : 동시에 처리함 · D : 분리하여 처리함 |
| `claim_request_auto_accept` |  |  |  | 구매자 취소/반품 신청 건 자동 접수 설정 Youtube shopping 이용 시에는 미제공 T : 사용함 · F : 사용안함 |
| `use_shipped_auto_check_start_day` |  |  |  | 배송완료 일괄체크 시작시점 사용여부 T : 사용함 · F : 사용안함 |
| `shipped_auto_check_start_day` |  | 날짜 |  | 배송완료 일괄체크 시작일 |
