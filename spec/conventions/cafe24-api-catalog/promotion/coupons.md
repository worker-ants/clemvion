---
resource: promotion
entity: coupons
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#coupons
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Promotion / Coupons

> Field-level 카탈로그. Endpoint enumeration index: [`../promotion.md`](../promotion.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Coupons](https://developers.cafe24.com/docs/ko/api/admin/#coupons)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

쿠폰(Coupons)은 상품의 가격을 할인하거나 배송비를 할인받을 수 있도록 쇼핑몰 회원에게 발급할 수 있는 혜택입니다. · 쿠폰은 쇼핑몰의 판매를 촉진하기 위해 사용할 수 있으며, 다양한 형태로 회원에게 발급할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| `coupon_no` |  | 쿠폰번호 |
| `coupon_type` |  | 쿠폰유형 쿠폰유형. 온라인 쿠폰과 오프라인 시리얼 쿠폰 유형이 있음. O : 온라인 쿠폰 · S : 오프라인 시리얼 쿠폰 |
| `coupon_name` |  | 쿠폰명 쿠폰의 이름 |
| `coupon_description` |  | 쿠폰설명 쿠폰의 설명 |
| `created_date` |  | 생성일 쿠폰의 생성 일자 |
| `deleted` |  | 쿠폰삭제 여부 쿠폰이 삭제되었는지 여부. |
| `is_stopped_issued_coupon` |  | 쿠폰 완전삭제 (발급된 쿠폰 사용정지) 여부 쿠폰이 완전 삭제되었는지 여부. 쿠폰이 완전 삭제되면 기존에 발급된 쿠폰도 더 이상 사용이 불가함. T : 완전삭제 · F : 완전삭제 아님 |
| `pause_begin_datetime` |  | 쿠폰 발급 일시정지 시작시간 쿠폰 발급을 조건부 자동발급으로 설정한 경우, 조건에 해당해도 발급을 일시정지하는 기간의 시작 시간 |
| `pause_end_datetime` |  | 쿠폰 발급 일시정지 종료시간 쿠폰 발급을 조건부 자동발급으로 설정한 경우, 조건에 해당해도 발급을 일시정지하는 기간의 종료 시간 |
| `benefit_text` |  | 쿠폰혜택 상세내역 출력 쿠폰혜택의 상세 내역이 출력됨. |
| `benefit_type` |  | 혜택 구분 혜택의 유형. 각각의 유형별로 부여하는 혜택이 다름. |
| `benefit_price` |  | 혜택 금액 혜택으로 할인받는 금액 |
| `benefit_percentage` |  | 혜택 비율 혜택으로 할인받는 비율 |
| `benefit_percentage_round_unit` |  | 혜택 비율 절사 단위 혜택으로 할인받는 금액의 절사 단위 |
| `benefit_percentage_max_price` |  | 혜택 비율 최대 금액 혜택으로 할인받을 수 있는 최대 금액 |
| `include_regional_shipping_rate` |  | 배송비 할인 시 지역별 구분 포함 여부 배송비를 할인할 때 지역별 배송비를 포함할지 여부 |
| `include_foreign_delivery` |  | 해외배송 포함여부 쿠폰혜택에 해외배송을 포함할지 여부 |
| `coupon_direct_url` |  | 쿠폰 직접 접근 경로 쿠폰에 직접 접근할 수 있는 경로 |
| `issue_type` |  | 발급 구분 쿠폰의 발급형태 유형 |
| `issue_sub_type` |  | 발급 하위 유형 쿠폰 발급의 세부 하위 유형 |
| `additional_targets` |  | 추가발급 서비스 대상 P : 브랜드앱 |
| `additional_conditions` |  | 추가발급 조건설정 I : 브랜드앱 설치 · P : 브랜드앱 푸시ON |
| `issue_member_join` |  | 회원가입시 쿠폰 발급 여부 회원가입 시 발급해주는 쿠폰인지 여부 |
| `issue_member_join_recommend` |  | 회원가입시 추천인에게 쿠폰 발급 여부 회원가입시 추천인에게 발급해주는 쿠폰인지 여부 |
| `issue_member_join_type` |  | 회원가입시 쿠폰 발급 대상 회원가입시 쿠폰을 발급해줄 대상에 대한 구분 |
| `issue_order_amount_type` |  | 발급가능 구매금액 유형 쿠폰으로 할인 시 할인 대상이 되는 금액의 기준 |
| `issue_order_start_date` |  | 쿠폰발급 가능한 주문시작일시 |
| `issue_order_end_date` |  | 쿠폰발급 가능한 주문종료일시 |
| `issue_order_amount_limit` |  | 발급 가능 구매 금액 제한 유형 쿠폰 발급 가능 구매금액을 제한할 수 있음 |
| `issue_order_amount_min` |  | 발급 가능 최소 구매 금액 쿠폰 발급이 가능한 최소 구매 금액 |
| `issue_order_amount_max` |  | 발급 가능 최대 구매 금액 쿠폰 발급이 가능한 최대 구매 금액 |
| `issue_order_path` |  | 주문경로 발급한 쿠폰의 사용 가능한 주문 경로 W : 웹 쇼핑몰 전용 · M : 모바일 쇼핑몰 전용 · P : 브랜드앱 전용 |
| `issue_order_type` |  | 발급단위 쿠폰 발급 단위 |
| `issue_order_available_product` |  | 발급 대상 상품 쿠폰 발급 대상이 되는 상품 |
| `issue_order_available_product_list` |  | 발급 대상 상품 리스트 |
| `issue_order_available_category` |  | 발급 대상 카테고리 쿠폰 발급 대상이 되는 카테고리 |
| `issue_order_available_category_list` |  | 발급 대상 카테고리 리스트 |
| `issue_anniversary_type` |  | 발급 조건 기념일 유형 쿠폰 발급 조건 기념일의 유형 |
| `issue_anniversary_pre_issue_day` |  | 발급 조건 기념일 선발행 일수 기념일 쿠폰 미리 발급 가능한 일수 |
| `issue_module_type` |  | 발급 조건 설치 모듈 유형 모듈 설치 발급 쿠폰의 설치 모듈 유형 S : 바로가기 · B : 즐겨찾기 · L : 라이브링콘 |
| `issue_review_count` |  | 발급 조건 상품 후기 개수 쿠폰 발급에 필요한 상품 후기의 개수 |
| `issue_review_has_image` |  | 발급 조건 상품 후기 이미지 포함 여부 쿠폰 발급에 필요한 상품 후기에 이미지가 포함되어야 하는지 여부 |
| `issue_quantity_min` |  | 쿠폰 발급가능 최소구매수량 쿠폰 발급이 가능한 최소 구매 수량 |
| `issue_quntity_type` |  | 쿠폰 발급가능수량 판단기준 쿠폰 발급가능수량의 판단이 되는 기준 |
| `issue_max_count` |  | 최대 발급수 쿠폰의 최대 발급수량 |
| `issue_max_count_by_user` |  | 동일인 재발급 최대수량 동일한 고객에게 재발급할 수 있는 최대 쿠폰 수량 |
| `issue_count_per_once` |  | 쿠폰발급 회당 발급수량 (1회 발급수량) 1회 발급할때의 쿠폰 발급수량 |
| `issued_count` |  | 발급된 수량 쿠폰이 발급된 수량 |
| `issue_member_group_no` |  | 발급대상 회원등급 번호 쿠폰발급 대상이 되는 회원등급의 번호 |
| `issue_member_group_name` |  | 발급대상 회원등급 이름 쿠폰발급 대상이 되는 회원등급의 이름 |
| `issue_no_purchase_period` |  | 일정기간 미구매 대상 회원의 미구매 기간 일정 기간 미구매 회원 대상 발급시 발급 조건으로 설정한 구매이력이 없는 기간 |
| `issue_reserved` |  | 자동 발행 예약 사용 여부 쿠폰 발급일자를 미리 예약하는 기능의 사용여부. 해당 예약 일시가 되면 쿠폰은 자동 발행 됨. |
| `issue_reserved_date` |  | 자동 발행 예약 발급 일시 설정된 쿠폰 자동 발행 예약 일시 |
| `available_date` |  | 쿠폰 사용기간 쿠폰의 사용 가능한 기간 |
| `available_period_type` |  | 사용기간 유형 쿠폰의 사용 가능한 기간의 유형 |
| `available_begin_datetime` |  | 사용 기간 시작 일시 쿠폰 사용 가능 기간 시작일시 |
| `available_end_datetime` |  | 사용 기간 종료 일시 쿠폰 사용 가능 기간 종료일시 |
| `available_site` |  | 사용 범위 유형 쿠폰 사용 가능한 접속경로의 유형 |
| `available_scope` |  | 적용 범위 쿠폰 적용 가능한 범위. 상품 쿠폰으로 적용시 상품 하나에 대하여 쿠폰이 적용되며, 주문서 쿠폰으로 적용시 주문서 전체에 적용됨. |
| `available_day_from_issued` |  | 사용 가능 일수 쿠폰의 사용 가능 일수 |
| `available_price_type` |  | 사용가능 구매 금액 유형 쿠폰의 사용가능 금액에 대한 기준. 상품 금액 기준일 경우 상품 가격에 수량을 곱한 금액을 기준으로 하며, 주문 금액 기준일 경우 해당 금액에 기타 할인, 배송비가 적용된 금액을 기준으로 계산한다. U : 제한 없음 · O : 주문 금액 기준 · P : 상품 금액 기준 |
| `available_order_price_type` |  | 사용가능 구매 금액 상세 유형 U : 모든 상품의 주문 금액 · I : 쿠폰 적용 상품의 주문 금액 |
| `available_min_price` |  | 사용가능 구매 금액 쿠폰을 사용가능한 구매 금액 |
| `available_amount_type` |  | 적용 계산 기준 쿠폰을 적용할 기준이 되는 결제 금액. 쿠폰할인을 각종 할인(회원등급할인, 상품할인 등)전 주문금액에 적용할지, 각종 할인 후 금액에 적용할지 여부. |
| `available_payment_method` |  | 사용가능 결제수단 쿠폰 사용이 가능한 결제수단 |
| `available_product` |  | 쿠폰적용 상품 선택 쿠폰의 적용가능 상품 선택. 특정 상품을 제외하거나, 적용하거나 혹은 모든 상품에 대해서 쿠폰적용 여부를 선택할 수 있음. |
| `available_product_list` |  | 쿠폰적용 상품 리스트 |
| `available_category` |  | 쿠폰적용 분류 선택 쿠폰의 적용가능 분류 선택. 특정 분류를 제외하거나, 적용하거나 혹은 모든 분류에 대해서 쿠폰적용 여부를 선택할 수 있음. |
| `available_category_list` |  | 쿠폰적용 분류 리스트 |
| `available_coupon_count_by_order` |  | 주문서 당 동일쿠폰 최대 사용 수 한 주문서 당 동일한 쿠폰 최대 사용가능 수 |
| `serial_generate_method` |  | 시리얼 쿠폰 생성방법 시리얼 쿠폰을 생성하는 방법 A : 자동 생성 · M : 직접 등록 · E : 엑셀 업로드 |
| `coupon_image_type` |  | 쿠폰 이미지 유형 쿠폰 이미지의 유형 B : 기본 이미지 사용 · C : 직접 업로드 |
| `coupon_image_path` |  | 쿠폰 이미지 경로 쿠폰 이미지의 URL 경로 |
| `show_product_detail` |  | 상품상세페이지 노출여부 상품상세페이지에 노출할지 여부 |
| `use_notification_when_login` |  | 로그인 시 쿠폰발급 알람 사용여부 회원 로그인 시 쿠폰발급 알람을 사용할지 여부 |
| `send_sms_for_issue` |  | 쿠폰발급 SMS 발송 여부 쿠폰 발급정보를 SMS로 발송할지 여부 |
| `send_email_for_issue` |  | 쿠폰 발급정보 이메일 발송여부 쿠폰 발급정보를 이메일로 발송할지 여부 |
| `recurring_issuance_interval` |  | 정기쿠폰 발급 단위 |
| `recurring_issuance_day` |  | 정기쿠폰 발급 일자 |
| `recurring_issuance_hour` |  | 정기쿠폰 발급 시간 |
| `recurring_issuance_minute` |  | 정기쿠폰 발급 분 |
| `issue_limit` |  | 발급수 제한여부 |
| `same_user_reissue` |  | 동일인 재발급 가능여부 |
| `issue_order_date` |  | 발급대상 주문기간 설정 T : 주문기간 설정 · F : 주문기간 설정 불가 |
| `exclude_unsubscribed` |  | 이메일 수신거부 회원 제외여부 |
| `discount_amount` |  | 할인금액 |
| `discount_rate` |  | 할인율 |
| `issue_on_anniversary` |  | 당일 발급 여부 |
| `recurring_issuance` |  | 정기쿠폰 발급 |
| `status` |  | 쿠폰 상태 변경 |
| `immediate_issue_pause` |  | 즉시 발급 중지 |
| `immediate_issue_restart` |  | 즉시 발급 재개 |

## Operations

### `GET /api/v2/admin/coupons` — Retrieve a list of coupons

- **Scope**: `mall.read_promotion` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-coupons

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `coupon_no` |  |  |  | 쿠폰번호 |
| `coupon_type` |  |  |  | 쿠폰유형 O : 온라인 쿠폰 · S : 오프라인 시리얼 쿠폰 |
| `coupon_name` |  |  |  | 쿠폰명 |
| `benefit_type` |  |  |  | 혜택 구분 쿠폰으로 받는 혜택의 종류 구분 ,(콤마)로 여러 건을 검색할 수 있다. A : 할인금액 · B : 할인율 · C : 적립금액 · D : 적립율 · E : 기본배송비 할인(전액할인) · I : 기본배송비 할인(할인율) · H : 기본배송비 할인(할인금액) · J : 전체배송비 할인(전액할인) · F : 즉시적립 · G : 예치금 |
| `issue_type` |  |  |  | 발급 구분 쿠폰의 발급형태 유형 ,(콤마)로 여러 건을 검색할 수 있다. M : 대상자 지정 발급 · A : 조건부 자동 발급 · D : 고객 다운로드 발급 · R : 정기 자동 발급 |
| `issue_sub_type` |  |  |  | 발급 하위 유형 쿠폰 발급의 세부 하위 유형 M : 회원 대상 · C : 실시간 접속자 대상 · T : 전체 회원 대상 · J : 회원 가입 · D : 배송 완료 시 · A : 기념일(생일) · I : 모듈(프로그램) 설치 · P : 상품 후기 작성 · O : 주문 완료 시 · Q : 구매 수량 충족 시 · F : 첫 구매 고객 · N : 일정기간 미구매 회원 대상 · U : 회원등급 상향시 |
| `issued_flag` |  |  |  | 발급된 쿠폰 여부 쿠폰이 기존에 발급된 이력이 있는지 여부 T : 발급이력이 있는 쿠폰 · F : 발급이력이 없는 쿠폰 |
| `created_start_date` |  | 날짜 |  | 검색 시작일 쿠폰 생성일 기준 검색의 검색 시작일 · 검색 종료일과 같이 사용해야함. |
| `created_end_date` |  | 날짜 |  | 검색 종료일 쿠폰 생성일 기준 검색의 검색 종료일 · 검색 시작일과 같이 사용해야함. |
| `deleted` |  |  | F | 쿠폰삭제 여부 쿠폰이 삭제되었는지 여부. ,(콤마)로 여러 건을 검색할 수 있다. T : 삭제된 쿠폰 · F : 삭제되지 않은 쿠폰 |
| `pause_begin_date` |  | 날짜 |  | 쿠폰 발급 일시정지 시작시간 쿠폰 일시정지일 기준 검색의 검색 시작일 |
| `pause_end_date` |  | 날짜 |  | 쿠폰 발급 일시정지 종료시간 쿠폰 일시정지일 기준 검색의 검색 종료일 |
| `issue_order_path` |  |  |  | 주문경로 발급한 쿠폰의 사용 가능한 주문 경로 W : PC · M : 모바일 · P : 브랜드앱 |
| `issue_order_type` |  |  |  | 발급단위 쿠폰의 발급 단위가 상품인지 주문서단위 쿠폰인지 여부 P : 상품 쿠폰 · O : 주문서 쿠폰 |
| `issue_reserved` |  |  |  | 자동 발행 예약 사용 여부 쿠폰의 자동발행예약 사용여부 T : 사용 · F : 사용하지 않음 |
| `available_period_type` |  |  |  | 사용기간 유형 쿠폰 사용기간의 유형 ,(콤마)로 여러 건을 검색할 수 있다. F : 일반 기간 · R : 쿠폰 발급일 기준 · M : 당월 말까지 사용 |
| `available_datetime` |  | 날짜 |  | 해당 날짜에 발급 가능한 쿠폰 검색 해당하는 날짜에 발급 가능한 쿠폰 검색 available_period_type이 F일 때만 유효 |
| `available_site` |  |  |  | 사용 범위 유형 발급한 쿠폰의 사용 가능한 주문 경로 W : 웹 쇼핑몰 전용 · M : 모바일 쇼핑몰 전용 · P : 브랜드앱 전용 |
| `available_scope` |  |  |  | 적용 범위 쿠폰의 적용 가능한 범위가 상품인지 주문서단위 쿠폰인지 여부 P : 상품 쿠폰 · O : 주문서 쿠폰 |
| `available_price_type` |  |  |  | 사용가능 구매 금액 유형 쿠폰이 사용 가능한 금액 기준이 주문 금액 기준인지 상품 금액 기준인지 제한이 없는지 여부 U : 제한 없음 · O : 주문 금액 기준 · P : 상품 금액 기준 |
| `available_order_price_type` |  |  |  | 사용가능 구매 금액 상세 유형 U : 모든 상품의 주문 금액 · I : 쿠폰 적용 상품의 주문 금액 |
| `limit` |  | 최소: [1]~최대: [500] | 100 | 조회결과 최대건수 조회하고자 하는 최대 건수를 지정할 수 있음. · 예) 10 입력시 10건만 표시함. |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `coupons` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| ↳ `coupon_no` |  | 쿠폰번호 |
| ↳ `coupon_type` |  | 쿠폰유형 쿠폰유형. 온라인 쿠폰과 오프라인 시리얼 쿠폰 유형이 있음. O : 온라인 쿠폰 · S : 오프라인 시리얼 쿠폰 |
| ↳ `coupon_name` |  | 쿠폰명 쿠폰의 이름 |
| ↳ `coupon_description` |  | 쿠폰설명 쿠폰의 설명 |
| ↳ `created_date` |  | 생성일 쿠폰의 생성 일자 |
| ↳ `deleted` |  | 쿠폰삭제 여부 쿠폰이 삭제되었는지 여부. |
| ↳ `is_stopped_issued_coupon` |  | 쿠폰 완전삭제 (발급된 쿠폰 사용정지) 여부 쿠폰이 완전 삭제되었는지 여부. 쿠폰이 완전 삭제되면 기존에 발급된 쿠폰도 더 이상 사용이 불가함. T : 완전삭제 · F : 완전삭제 아님 |
| ↳ `pause_begin_datetime` |  | 쿠폰 발급 일시정지 시작시간 쿠폰 발급을 조건부 자동발급으로 설정한 경우, 조건에 해당해도 발급을 일시정지하는 기간의 시작 시간 |
| ↳ `pause_end_datetime` |  | 쿠폰 발급 일시정지 종료시간 쿠폰 발급을 조건부 자동발급으로 설정한 경우, 조건에 해당해도 발급을 일시정지하는 기간의 종료 시간 |
| ↳ `benefit_text` |  | 쿠폰혜택 상세내역 출력 쿠폰혜택의 상세 내역이 출력됨. |
| ↳ `benefit_type` |  | 혜택 구분 혜택의 유형. 각각의 유형별로 부여하는 혜택이 다름. |
| ↳ `benefit_price` |  | 혜택 금액 혜택으로 할인받는 금액 |
| ↳ `benefit_percentage` |  | 혜택 비율 혜택으로 할인받는 비율 |
| ↳ `benefit_percentage_round_unit` |  | 혜택 비율 절사 단위 혜택으로 할인받는 금액의 절사 단위 |
| ↳ `benefit_percentage_max_price` |  | 혜택 비율 최대 금액 혜택으로 할인받을 수 있는 최대 금액 |
| ↳ `include_regional_shipping_rate` |  | 배송비 할인 시 지역별 구분 포함 여부 배송비를 할인할 때 지역별 배송비를 포함할지 여부 |
| ↳ `include_foreign_delivery` |  | 해외배송 포함여부 쿠폰혜택에 해외배송을 포함할지 여부 |
| ↳ `coupon_direct_url` |  | 쿠폰 직접 접근 경로 쿠폰에 직접 접근할 수 있는 경로 |
| ↳ `issue_type` |  | 발급 구분 쿠폰의 발급형태 유형 |
| ↳ `issue_sub_type` |  | 발급 하위 유형 쿠폰 발급의 세부 하위 유형 |
| ↳ `additional_targets` |  | 추가발급 서비스 대상 P : 브랜드앱 |
| ↳ `additional_conditions` |  | 추가발급 조건설정 I : 브랜드앱 설치 · P : 브랜드앱 푸시ON |
| ↳ `issue_member_join` |  | 회원가입시 쿠폰 발급 여부 회원가입 시 발급해주는 쿠폰인지 여부 |
| ↳ `issue_member_join_recommend` |  | 회원가입시 추천인에게 쿠폰 발급 여부 회원가입시 추천인에게 발급해주는 쿠폰인지 여부 |
| ↳ `issue_member_join_type` |  | 회원가입시 쿠폰 발급 대상 회원가입시 쿠폰을 발급해줄 대상에 대한 구분 |
| ↳ `issue_order_amount_type` |  | 발급가능 구매금액 유형 쿠폰으로 할인 시 할인 대상이 되는 금액의 기준 |
| ↳ `issue_order_start_date` |  | 쿠폰발급 가능한 주문시작일시 |
| ↳ `issue_order_end_date` |  | 쿠폰발급 가능한 주문종료일시 |
| ↳ `issue_order_amount_limit` |  | 발급 가능 구매 금액 제한 유형 쿠폰 발급 가능 구매금액을 제한할 수 있음 |
| ↳ `issue_order_amount_min` |  | 발급 가능 최소 구매 금액 쿠폰 발급이 가능한 최소 구매 금액 |
| ↳ `issue_order_amount_max` |  | 발급 가능 최대 구매 금액 쿠폰 발급이 가능한 최대 구매 금액 |
| ↳ `issue_order_path` |  | 주문경로 발급한 쿠폰의 사용 가능한 주문 경로 W : 웹 쇼핑몰 전용 · M : 모바일 쇼핑몰 전용 · P : 브랜드앱 전용 |
| ↳ `issue_order_type` |  | 발급단위 쿠폰 발급 단위 |
| ↳ `issue_order_available_product` |  | 발급 대상 상품 쿠폰 발급 대상이 되는 상품 |
| ↳ `issue_order_available_product_list` |  | 발급 대상 상품 리스트 |
| ↳ `issue_order_available_category` |  | 발급 대상 카테고리 쿠폰 발급 대상이 되는 카테고리 |
| ↳ `issue_order_available_category_list` |  | 발급 대상 카테고리 리스트 |
| ↳ `issue_anniversary_type` |  | 발급 조건 기념일 유형 쿠폰 발급 조건 기념일의 유형 |
| ↳ `issue_anniversary_pre_issue_day` |  | 발급 조건 기념일 선발행 일수 기념일 쿠폰 미리 발급 가능한 일수 |
| ↳ `issue_module_type` |  | 발급 조건 설치 모듈 유형 모듈 설치 발급 쿠폰의 설치 모듈 유형 S : 바로가기 · B : 즐겨찾기 · L : 라이브링콘 |
| ↳ `issue_review_count` |  | 발급 조건 상품 후기 개수 쿠폰 발급에 필요한 상품 후기의 개수 |
| ↳ `issue_review_has_image` |  | 발급 조건 상품 후기 이미지 포함 여부 쿠폰 발급에 필요한 상품 후기에 이미지가 포함되어야 하는지 여부 |
| ↳ `issue_quantity_min` |  | 쿠폰 발급가능 최소구매수량 쿠폰 발급이 가능한 최소 구매 수량 |
| ↳ `issue_quntity_type` |  | 쿠폰 발급가능수량 판단기준 쿠폰 발급가능수량의 판단이 되는 기준 |
| ↳ `issue_max_count` |  | 최대 발급수 쿠폰의 최대 발급수량 |
| ↳ `issue_max_count_by_user` |  | 동일인 재발급 최대수량 동일한 고객에게 재발급할 수 있는 최대 쿠폰 수량 |
| ↳ `issue_count_per_once` |  | 쿠폰발급 회당 발급수량 (1회 발급수량) 1회 발급할때의 쿠폰 발급수량 |
| ↳ `issued_count` |  | 발급된 수량 쿠폰이 발급된 수량 |
| ↳ `issue_member_group_no` |  | 발급대상 회원등급 번호 쿠폰발급 대상이 되는 회원등급의 번호 |
| ↳ `issue_member_group_name` |  | 발급대상 회원등급 이름 쿠폰발급 대상이 되는 회원등급의 이름 |
| ↳ `issue_no_purchase_period` |  | 일정기간 미구매 대상 회원의 미구매 기간 일정 기간 미구매 회원 대상 발급시 발급 조건으로 설정한 구매이력이 없는 기간 |
| ↳ `issue_reserved` |  | 자동 발행 예약 사용 여부 쿠폰 발급일자를 미리 예약하는 기능의 사용여부. 해당 예약 일시가 되면 쿠폰은 자동 발행 됨. |
| ↳ `issue_reserved_date` |  | 자동 발행 예약 발급 일시 설정된 쿠폰 자동 발행 예약 일시 |
| ↳ `available_date` |  | 쿠폰 사용기간 쿠폰의 사용 가능한 기간 |
| ↳ `available_period_type` |  | 사용기간 유형 쿠폰의 사용 가능한 기간의 유형 |
| ↳ `available_begin_datetime` |  | 사용 기간 시작 일시 쿠폰 사용 가능 기간 시작일시 |
| ↳ `available_end_datetime` |  | 사용 기간 종료 일시 쿠폰 사용 가능 기간 종료일시 |
| ↳ `available_site` |  | 사용 범위 유형 쿠폰 사용 가능한 접속경로의 유형 |
| ↳ `available_scope` |  | 적용 범위 쿠폰 적용 가능한 범위. 상품 쿠폰으로 적용시 상품 하나에 대하여 쿠폰이 적용되며, 주문서 쿠폰으로 적용시 주문서 전체에 적용됨. |
| ↳ `available_day_from_issued` |  | 사용 가능 일수 쿠폰의 사용 가능 일수 |
| ↳ `available_price_type` |  | 사용가능 구매 금액 유형 쿠폰의 사용가능 금액에 대한 기준. 상품 금액 기준일 경우 상품 가격에 수량을 곱한 금액을 기준으로 하며, 주문 금액 기준일 경우 해당 금액에 기타 할인, 배송비가 적용된 금액을 기준으로 계산한다. U : 제한 없음 · O : 주문 금액 기준 · P : 상품 금액 기준 |
| ↳ `available_order_price_type` |  | 사용가능 구매 금액 상세 유형 U : 모든 상품의 주문 금액 · I : 쿠폰 적용 상품의 주문 금액 |
| ↳ `available_min_price` |  | 사용가능 구매 금액 쿠폰을 사용가능한 구매 금액 |
| ↳ `available_amount_type` |  | 적용 계산 기준 쿠폰을 적용할 기준이 되는 결제 금액. 쿠폰할인을 각종 할인(회원등급할인, 상품할인 등)전 주문금액에 적용할지, 각종 할인 후 금액에 적용할지 여부. |
| ↳ `available_payment_method` |  | 사용가능 결제수단 쿠폰 사용이 가능한 결제수단 |
| ↳ `available_product` |  | 쿠폰적용 상품 선택 쿠폰의 적용가능 상품 선택. 특정 상품을 제외하거나, 적용하거나 혹은 모든 상품에 대해서 쿠폰적용 여부를 선택할 수 있음. |
| ↳ `available_product_list` |  | 쿠폰적용 상품 리스트 |
| ↳ `available_category` |  | 쿠폰적용 분류 선택 쿠폰의 적용가능 분류 선택. 특정 분류를 제외하거나, 적용하거나 혹은 모든 분류에 대해서 쿠폰적용 여부를 선택할 수 있음. |
| ↳ `available_category_list` |  | 쿠폰적용 분류 리스트 |
| ↳ `available_coupon_count_by_order` |  | 주문서 당 동일쿠폰 최대 사용 수 한 주문서 당 동일한 쿠폰 최대 사용가능 수 |
| ↳ `serial_generate_method` |  | 시리얼 쿠폰 생성방법 시리얼 쿠폰을 생성하는 방법 A : 자동 생성 · M : 직접 등록 · E : 엑셀 업로드 |
| ↳ `coupon_image_type` |  | 쿠폰 이미지 유형 쿠폰 이미지의 유형 B : 기본 이미지 사용 · C : 직접 업로드 |
| ↳ `coupon_image_path` |  | 쿠폰 이미지 경로 쿠폰 이미지의 URL 경로 |
| ↳ `show_product_detail` |  | 상품상세페이지 노출여부 상품상세페이지에 노출할지 여부 |
| ↳ `use_notification_when_login` |  | 로그인 시 쿠폰발급 알람 사용여부 회원 로그인 시 쿠폰발급 알람을 사용할지 여부 |
| ↳ `send_sms_for_issue` |  | 쿠폰발급 SMS 발송 여부 쿠폰 발급정보를 SMS로 발송할지 여부 |
| ↳ `send_email_for_issue` |  | 쿠폰 발급정보 이메일 발송여부 쿠폰 발급정보를 이메일로 발송할지 여부 |
| ↳ `recurring_issuance_interval` |  | 정기쿠폰 발급 단위 |
| ↳ `recurring_issuance_day` |  | 정기쿠폰 발급 일자 |
| ↳ `recurring_issuance_hour` |  | 정기쿠폰 발급 시간 |
| ↳ `recurring_issuance_minute` |  | 정기쿠폰 발급 분 |
| ↳ `issue_limit` |  | 발급수 제한여부 |
| ↳ `same_user_reissue` |  | 동일인 재발급 가능여부 |
| ↳ `issue_order_date` |  | 발급대상 주문기간 설정 T : 주문기간 설정 · F : 주문기간 설정 불가 |
| ↳ `exclude_unsubscribed` |  | 이메일 수신거부 회원 제외여부 |

응답 예시 (JSON):

```json
{
    "coupons": [
        {
            "shop_no": 1,
            "coupon_no": "9000000000000000033",
            "coupon_type": "O",
            "coupon_name": "Special Discount Coupon",
            "coupon_description": null,
            "created_date": "2017-12-19T14:39:22+09:00",
            "deleted": "F",
            "is_stopped_issued_coupon": "F",
            "pause_begin_datetime": null,
            "pause_end_datetime": null,
            "benefit_text": "20.0% Discount. No cuts. Maximum discount 50",
            "benefit_type": "B",
            "benefit_price": null,
            "benefit_percentage": "20.0",
            "benefit_percentage_round_unit": "0.1",
            "benefit_percentage_max_price": "50.00",
            "include_regional_shipping_rate": null,
            "include_foreign_delivery": null,
            "coupon_direct_url": "/exec/front/newcoupon/IssueDownload?coupon_no=",
            "issue_type": "M",
            "issue_sub_type": "M",
            "additional_targets": "P",
            "additional_conditions": "I",
            "issue_member_join": null,
            "issue_member_join_recommend": null,
            "issue_member_join_type": null,
            "issue_order_amount_type": null,
            "issue_order_start_date": null,
            "issue_order_end_date": null,
            "issue_order_amount_limit": null,
            "issue_order_amount_min": null,
            "issue_order_amount_max": null,
            "issue_order_path": null,
            "issue_order_type": "O",
            "issue_order_available_product": "I",
            "issue_order_available_product_list": [
                10,
                11
            ],
            "issue_order_available_category": "I",
            "issue_order_available_category_list": [
                25,
                29
            ],
            "issue_anniversary_type": null,
            "issue_anniversary_pre_issue_day": null,
            "issue_module_type": null,
            "issue_review_count": null,
            "issue_review_has_image": null,
            "issue_quantity_min": null,
            "issue_quntity_type": null,
            "issue_max_count": null,
            "issue_max_count_by_user": null,
            "issue_count_per_once": null,
            "issued_count": "0",
            "issue_member_group_no": null,
            "issue_member_group_name": null,
            "issue_no_purchase_period": null,
            "issue_reserved": "F",
            "issue_reserved_date": null,
            "available_date": "2017-12-19 00:00 ~ 2017-12-22 23:00",
            "available_period_type": "F",
            "available_begin_datetime": "2017-12-19T00:00:00+09:00",
            "available_end_datetime": "2017-12-22T23:00:00+09:00",
            "available_site": "W,M,P",
            "available_scope": "O",
            "available_day_from_issued": null,
            "available_price_type": "U",
            "available_order_price_type": null,
            "available_min_price": null,
            "available_amount_type": "E",
            "available_payment_method": "R,E,C,A,H,M,K,P,N,O,S,V,B,D,W,X",
            "available_product": "I",
            "available_product_list": [
                10,
                11
            ],
            "available_category": "I",
            "available_category_list": [
                25,
                29
            ],
            "available_coupon_count_by_order": 1,
            "serial_generate_method": null,
            "coupon_image_type": "B",
            "coupon_image_path": null,
            "show_product_detail": null,
            "use_notification_when_login": "F",
            "send_sms_for_issue": "F",
            "send_email_for_issue": null,
            "recurring_issuance_interval": null,
            "recurring_issuance_day": null,
            "recurring_issuance_hour": null,
            "recurring_issuance_minute": null,
            "issue_limit": "F",
            "same_user_reissue": "F",
            "issue_order_date": "F",
            "exclude_unsubscribed": null
        },
        {
            "shop_no": 1,
            "coupon_no": "9000000000000000032",
            "coupon_type": "O",
            "coupon_name": "Christmas Week Coupon",
            "coupon_description": null,
            "created_date": "2017-12-18T11:56:41+09:00",
            "deleted": "F",
            "is_stopped_issued_coupon": "F",
            "pause_begin_datetime": null,
            "pause_end_datetime": null,
            "benefit_text": "discount for 10",
            "benefit_type": "A",
            "benefit_price": "10.00",
            "benefit_percentage": null,
            "benefit_percentage_round_unit": null,
            "benefit_percentage_max_price": null,
            "include_regional_shipping_rate": null,
            "include_foreign_delivery": null,
            "coupon_direct_url": "/exec/front/newcoupon/IssueDownload?coupon_no=",
            "issue_type": "M",
            "issue_sub_type": "M",
            "additional_targets": null,
            "additional_conditions": null,
            "issue_member_join": null,
            "issue_member_join_recommend": null,
            "issue_member_join_type": null,
            "issue_order_amount_type": null,
            "issue_order_start_date": null,
            "issue_order_end_date": null,
            "issue_order_amount_limit": null,
            "issue_order_amount_min": null,
            "issue_order_amount_max": null,
            "issue_order_path": null,
            "issue_order_type": "O",
            "issue_order_available_product": "U",
            "issue_order_available_product_list": null,
            "issue_order_available_category": "U",
            "issue_order_available_category_list": null,
            "issue_anniversary_type": null,
            "issue_anniversary_pre_issue_day": null,
            "issue_module_type": null,
            "issue_review_count": null,
            "issue_review_has_image": null,
            "issue_quantity_min": null,
            "issue_quntity_type": null,
            "issue_max_count": null,
            "issue_max_count_by_user": null,
            "issue_count_per_once": null,
            "issued_count": "0",
            "issue_member_group_no": null,
            "issue_member_group_name": null,
            "issue_no_purchase_period": null,
            "issue_reserved": "F",
            "issue_reserved_date": null,
            "available_date": "2017-12-18 00:00 ~ 2017-12-21 23:00",
            "available_period_type": "F",
            "available_begin_datetime": "2017-12-18T00:00:00+09:00",
            "available_end_datetime": "2017-12-21T23:00:00+09:00",
            "available_site": "W,M,P",
            "available_scope": "O",
            "available_day_from_issued": null,
            "available_price_type": "U",
            "available_order_price_type": null,
            "available_min_price": null,
            "available_amount_type": "E",
            "available_payment_method": "R,E,C,A,H,M,K,P,N,O,S,V,B,D,W,X",
            "available_product": "U",
            "available_product_list": null,
            "available_category": "U",
            "available_category_list": null,
            "available_coupon_count_by_order": 1,
            "serial_generate_method": null,
            "coupon_image_type": "B",
            "coupon_image_path": null,
            "show_product_detail": null,
            "use_notification_when_login": "F",
            "send_sms_for_issue": "F",
            "send_email_for_issue": null,
            "recurring_issuance_interval": null,
            "recurring_issuance_day": null,
            "recurring_issuance_hour": null,
            "recurring_issuance_minute": null,
            "issue_limit": "F",
            "same_user_reissue": "F",
            "issue_order_date": "F",
            "exclude_unsubscribed": null
        }
    ]
}
```

### `GET /api/v2/admin/coupons/count` — Retrieve a count of coupons

- **Scope**: `mall.read_promotion` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-coupons

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `coupon_no` |  |  |  | 쿠폰번호 |
| `coupon_type` |  |  |  | 쿠폰유형 조회할 쿠폰의 유형 O : 온라인 쿠폰 · S : 오프라인 시리얼 쿠폰 |
| `coupon_name` |  |  |  | 쿠폰명 |
| `benefit_type` |  |  |  | 혜택 구분 쿠폰으로 받는 혜택의 종류 구분 ,(콤마)로 여러 건을 검색할 수 있다. A : 할인금액 · B : 할인율 · C : 적립금액 · D : 적립율 · E : 기본배송비 할인(전액할인) · I : 기본배송비 할인(할인율) · H : 기본배송비 할인(할인금액) · J : 전체배송비 할인(전액할인) · F : 즉시적립 · G : 예치금 |
| `issue_type` |  |  |  | 발급 구분 쿠폰의 발급형태 유형 ,(콤마)로 여러 건을 검색할 수 있다. M : 대상자 지정 발급 · A : 조건부 자동 발급 · D : 고객 다운로드 발급 · R : 정기 자동 발급 |
| `issue_sub_type` |  |  |  | 발급 하위 유형 쿠폰 발급의 세부 하위 유형 M : 회원 대상 · C : 실시간 접속자 대상 · T : 전체 회원 대상 · J : 회원 가입 · D : 배송 완료 시 · A : 기념일(생일) · I : 모듈(프로그램) 설치 · P : 상품 후기 작성 · O : 주문 완료 시 · Q : 구매 수량 충족 시 · F : 첫 구매 고객 · N : 일정기간 미구매 회원 대상 · U : 회원등급 상향시 |
| `issued_flag` |  |  |  | 발급된 쿠폰 여부 쿠폰이 기존에 발급된 이력이 있는지 여부 T : 발급이력이 있는 쿠폰 · F : 발급이력이 없는 쿠폰 |
| `created_start_date` |  | 날짜 |  | 검색 시작일 쿠폰 생성일 기준 검색의 검색 시작일 · 검색 종료일과 같이 사용해야함. |
| `created_end_date` |  | 날짜 |  | 검색 종료일 쿠폰 생성일 기준 검색의 검색 종료일 · 검색 시작일과 같이 사용해야함. |
| `deleted` |  |  | F | 쿠폰삭제 여부 쿠폰이 삭제되었는지 여부. ,(콤마)로 여러 건을 검색할 수 있다. T : 삭제된 쿠폰 · F : 삭제되지 않은 쿠폰 |
| `pause_begin_date` |  | 날짜 |  | 쿠폰 발급 일시정지 시작시간 쿠폰 발급이 일시정지 되기 시작한 시간. |
| `pause_end_date` |  | 날짜 |  | 쿠폰 발급 일시정지 종료시간 쿠폰 발급의 일시정지가 종료된 시간. |
| `issue_order_path` |  |  |  | 주문경로 발급한 쿠폰의 사용 가능한 주문 경로 W : PC · M : 모바일 · P : 브랜드앱 |
| `issue_order_type` |  |  |  | 발급단위 P : 상품 쿠폰 · O : 주문서 쿠폰 |
| `issue_reserved` |  |  |  | 자동 발행 예약 사용 여부 T : 사용 · F : 사용하지 않음 |
| `available_period_type` |  |  |  | 사용기간 유형 쿠폰 사용기간의 유형 ,(콤마)로 여러 건을 검색할 수 있다. F : 일반 기간 · R : 쿠폰 발급일 기준 · M : 당월 말까지 사용 |
| `available_datetime` |  | 날짜 |  | 해당 날짜에 발급 가능한 쿠폰 검색 해당하는 날짜에 발급 가능한 쿠폰 검색 available_period_type이 F일 때만 유효 |
| `available_site` |  |  |  | 사용 범위 유형 발급한 쿠폰의 사용 가능한 주문 경로 W : 웹 쇼핑몰 전용 · M : 모바일 쇼핑몰 전용 · P : 브랜드앱 전용 |
| `available_scope` |  |  |  | 적용 범위 쿠폰의 적용 가능한 범위가 상품인지 주문서단위 쿠폰인지 여부 P : 상품 쿠폰 · O : 주문서 쿠폰 |
| `available_price_type` |  |  |  | 사용가능 구매 금액 유형 쿠폰이 사용 가능한 금액 기준이 주문 금액 기준인지 상품 금액 기준인지 제한이 없는지 여부 U : 제한 없음 · O : 주문 금액 기준 · P : 상품 금액 기준 |
| `available_order_price_type` |  |  |  | 사용가능 구매 금액 상세 유형 U : 모든 상품의 주문 금액 · I : 쿠폰 적용 상품의 주문 금액 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `count` |  |  |

응답 예시 (JSON):

```json
{
    "count": 24
}
```

### `POST /api/v2/admin/coupons` — Create a coupon

- **Scope**: `mall.write_promotion` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-coupon

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `coupon_name` | ✓ | 글자수 최소: [1자]~최대: [50자] |  | 쿠폰명 |
| `benefit_type` | ✓ |  |  | 혜택 구분 A : 할인금액 · B : 할인율 · C : 적립금액 · D : 적립율 · E : 기본배송비 할인(전액할인) · I : 기본배송비 할인(할인율) · H : 기본배송비 할인(할인금액) · J : 전체배송비 할인(전액할인) · F : 즉시적립 |
| `issue_type` | ✓ |  |  | 발급 구분 M : 대상자 지정 발급 · A : 조건부 자동 발급 · D : 고객 다운로드 발급 · R : 정기자동발급 |
| `issue_sub_type` |  |  |  | 발급 하위 유형 J : 회원 가입 · D : 배송 완료 시 · A : 기념일(생일) · P : 상품후기 작성 · O : 주문 완료 시 · F : 첫 구매 고객 · Q : 구매 수량 충족 시 · M : 회원대상 · N : 일정기간 미구매 회원 대상 · T : 전체회원대상 |
| `available_period_type` | ✓ |  |  | 사용기간 유형 F : 일반 기간 · R : 쿠폰 발급일 기준 · M : 당월 말까지 사용 |
| `available_site` | ✓ |  |  | 사용 범위 유형 W : 웹 쇼핑몰 전용 · M : 모바일 쇼핑몰 전용 · P : 브랜드앱 전용 |
| `available_scope` |  |  | O | 적용 범위 P : 상품 쿠폰 · O : 주문서 쿠폰 |
| `available_product` |  |  | U | 쿠폰적용 상품 선택 U : 제한 없음 · I : 선택 상품 적용 · E : 선택 상품 제외 |
| `available_category` |  |  | U | 쿠폰적용 분류 선택 U : 제한 없음 · I : 선택 카테고리 적용 · E : 선택 카테고리 제외 |
| `available_amount_type` |  |  | E | 적용 계산 기준 E : 할인(쿠폰 제외) 적용 전 결제 금액 · I : 할인(쿠폰 제외) 적용 후 결제 금액 |
| `available_coupon_count_by_order` | ✓ | 최소값: [1]; 최대값: [999] |  | 주문서 당 동일쿠폰 최대 사용 수 |
| `available_begin_datetime` |  | 날짜 |  | 사용 기간 시작 일시 available_period_type이 'F'로 입력된 경우만 필수 입력 |
| `available_end_datetime` |  | 날짜 |  | 사용 기간 종료 일시 available_period_type이 'F'로 입력된 경우만 필수 입력 |
| `available_day_from_issued` |  | 최소값: [1]; 최대값: [999] |  | 사용 가능 일수 available_period_type이 'R'로 입력된 경우만 필수 입력 |
| `issue_member_join` |  |  |  | 회원가입시 쿠폰 발급 여부 T : 발급 대상 · F : 발급 대상 아님 |
| `issue_member_join_recommend` |  |  |  | 회원가입시 추천인에게 쿠폰 발급 여부 T : 발급 대상 · F : 발급 대상 아님 |
| `issue_member_join_type` |  |  |  | 회원가입시 쿠폰 발급 대상 A : 모바일 메시지 수신동의 AND 이메일 수신동의 · O : 모바일 메시지 수신동의 OR 이메일 수신동의 · S : 모바일 메시지 수신동의 · E : 이메일 수신동의 · N : 제한없음 |
| `issue_anniversary_type` |  |  |  | 발급 조건 기념일 유형 B : 생일 · W : 결혼 기념일 |
| `issue_on_anniversary` |  |  |  | 당일 발급 여부 S : 당일 · P: 선발행 |
| `issue_anniversary_pre_issue_day` |  | 최소값: [0]; 최대값: [365] |  | 발급 조건 기념일 선발행 일수 issue_on_anniversary가 'P'로 입력된 경우만 필수 입력 |
| `issue_review_count` |  | 최소값: [1] |  | 발급 조건 상품 후기 개수 issue_sub_type가'P'으로입력된경우만필수입력 |
| `issue_review_has_image` |  |  |  | 발급 조건 상품 후기 이미지 포함 여부 T : 포함 · F : 미포함 |
| `issue_limit` |  |  |  | 발급수 제한여부 T : 발급 제한 · F : 발급 제한 아님 |
| `same_user_reissue` |  |  |  | 동일인 재발급 가능여부 issue_limit가 'T'로 입력된 경우만 필수 입력 T : 동일인 재발급 가능 · F : 동일인 재발급 불가능 |
| `issue_reserved` |  |  | F | 자동 발행 예약 사용 여부 T : 자동 발행 예약 사용 · F : 자동 발행 예약 미사용 |
| `issue_reserved_date` |  | 날짜 |  | 자동 발행 예약 발급 일시 issue_reserved가 'T'로 입력된 경우만 필수 입력 |
| `issue_no_purchase_period` |  | 최소값: [1]; 최대값: [12] |  | 일정기간 미구매 대상 회원의 미구매 기간 1-12까지정수형으로입력 |
| `show_product_detail` |  |  |  | 상품상세페이지 노출여부 T : 상품상세페이지 노출 · F : 상품상세페이지 미노출 |
| `include_regional_shipping_rate` |  |  |  | 배송비 할인 시 지역별 구분 포함 여부 T : 지역별 구분 포함 · F : 지역별 구분 미포함 |
| `include_foreign_delivery` |  |  |  | 해외배송 포함여부 T : 해외배송 포함 · F : 해외배송 미포함 |
| `available_product_list` |  |  |  | 쿠폰적용 상품 리스트 |
| `available_category_list` |  |  |  | 쿠폰적용 분류 리스트 |
| `available_price_type` |  |  | U | 사용가능 구매 금액 유형 U : 제한 없음 · O : 주문 금액 기준 · P : 상품 금액 기준 |
| `available_order_price_type` |  |  |  | 사용가능 구매 금액 상세 유형 U : 모든 상품의 주문 금액 · I : 쿠폰 적용 상품의 주문 금액 |
| `available_min_price` |  | 최소: [0.01]~최대: [999999999] |  | 사용가능 구매 금액 |
| `issue_max_count` |  | 최소값: [1]; 최대값: [999] |  | 최대 발급수 |
| `issue_max_count_by_user` |  | 최소값: [0]; 최대값: [999] |  | 동일인 재발급 최대수량 |
| `issue_order_path` |  |  |  | 주문경로 W : 웹 쇼핑몰 전용 · M : 모바일 쇼핑몰 전용 · P : 브랜드앱 전용 |
| `issue_order_date` |  |  |  | 발급대상 주문기간 설정 T : 주문기간 설정 · F : 주문기간 설정 불가 |
| `issue_order_start_date` |  | 날짜 |  | 쿠폰발급 가능한 주문시작일시 |
| `issue_order_end_date` |  | 날짜 |  | 쿠폰발급 가능한 주문종료일시 |
| `issue_member_group_no` |  |  |  | 발급대상 회원등급 번호 |
| `issue_member_group_name` |  |  |  | 발급대상 회원등급 이름 |
| `discount_amount` |  |  |  | 할인금액 |
| ↳ `benefit_price` | ✓ |  |  | 혜택 금액 |
| `discount_rate` |  |  |  | 할인율 |
| ↳ `benefit_percentage` | ✓ |  |  | 혜택 비율 |
| ↳ `benefit_percentage_round_unit` | ✓ |  |  | 혜택 비율 절사 단위 |
| ↳ `benefit_percentage_max_price` | ✓ |  |  | 혜택 비율 최대 금액 |
| `issue_order_amount_type` |  |  |  | 발급가능 구매금액 유형 O : 구매금액 기준 · S : 실결제 금액기준 |
| `issue_order_amount_limit` |  |  |  | 발급 가능 구매 금액 제한 유형 U : 제한 없음 · L : 최소 금액 · S : 금액 범위 |
| `issue_order_amount_min` |  | 최소: [0.01]~최대: [999999999] |  | 발급 가능 최소 구매 금액 |
| `issue_order_amount_max` |  | 최소: [0.01]~최대: [999999999] |  | 발급 가능 최대 구매 금액 |
| `issue_count_per_once` |  | 최소값: [1]; 최대값: [10] |  | 쿠폰발급 회당 발급수량 (1회 발급수량) |
| `issue_order_type` |  |  |  | 발급단위 O : 주문서단위 발급쿠폰 · P : 상품단위 발급쿠폰 |
| `issue_order_available_product` |  |  |  | 발급 대상 상품 U : 제한 없음 · I : 선택 상품 적용 · E : 선택 상품 제외 |
| `issue_order_available_product_list` |  |  |  | 발급 대상 상품 리스트 |
| `issue_order_available_category` |  |  |  | 발급 대상 카테고리 U : 제한 없음 · I : 선택 카테고리 적용 · E : 선택 카테고리 제외 |
| `issue_order_available_category_list` |  |  |  | 발급 대상 카테고리 리스트 |
| `issue_quntity_type` |  |  |  | 쿠폰 발급가능수량 판단기준 P : 상품 수량 기준 · O : 주문 수량 기준 |
| `issue_quantity_min` |  | 최소값: [1]; 최대값: [999] |  | 쿠폰 발급가능 최소구매수량 |
| `available_payment_method` |  |  |  | 사용가능 결제수단 all : 제한없음 · R : 무통장입금 · E : 가상계좌 · C : 신용카드 · A : 계좌이체 · H : 휴대폰 · M : 적립금 · K : 케이페이 · P : 페이나우 · N : 페이코 · O : 카카오페이 · S : 스마일페이 · V : 네이버페이 · B : 편의점 · D : 토스 |
| `use_notification_when_login` |  |  |  | 로그인 시 쿠폰발급 알람 사용여부 T : 알람 사용 · F : 알람 미사용 |
| `send_sms_for_issue` |  |  |  | 쿠폰발급 SMS 발송 여부 T : SMS 발송 · F : SMS 미발송 |
| `send_email_for_issue` |  |  |  | 쿠폰 발급정보 이메일 발송여부 T : 이메일 발송 · F : 이메일 미발송 |
| `exclude_unsubscribed` |  |  |  | 이메일 수신거부 회원 제외여부 T : 이메일 수신거부 회원 제외 · F : 이메일 수신거부 회원 미제외 |
| `recurring_issuance` |  |  |  | 정기쿠폰 발급 |
| ↳ `recurring_issuance_interval` | ✓ |  |  | 정기쿠폰 발급 단위 · 1m : 1개월 · 3m : 3개월 · 6m : 6개월 · 12m : 12개월 |
| ↳ `recurring_issuance_day` | ✓ |  |  | 정기쿠폰 발급 일자 · 1 : 1일 · 5 : 5일 · 10 : 10일 · 15 : 15일 · 20 : 20일 · 25 : 25일 |
| ↳ `recurring_issuance_hour` | ✓ |  |  | 정기쿠폰 발급 시간 · 08 : 08시 · 09 : 09시 · 10 : 10시 · 11 : 11시 · 12 : 12시 · 13 : 13시 · 14 : 14시 · 15 : 15시 · 16 : 16시 · 17 : 17시 · 18 : 18시 · 19 : 19시 · 20 : 20시 · 21 : 21시 · 22 : 22시 · 23 : 23시 |
| ↳ `recurring_issuance_minute` | ✓ |  |  | 정기쿠폰 발급 분 · 00 : 00분 · 05 : 05분 · 10 : 10분 · 15 : 15분 · 20 : 20분 · 25 : 25분 · 30 : 30분 · 35 : 35분 · 40 : 40분 · 45 : 45분 · 50 : 50분 · 55 : 55분 |
| `additional_targets` |  |  |  | 추가발급 서비스 대상 P : 브랜드앱 |
| `additional_conditions` |  |  |  | 추가발급 조건설정 I : 브랜드앱 설치 · P : 브랜드앱 푸시ON |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `coupon` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| ↳ `coupon_no` |  | 쿠폰번호 |
| ↳ `coupon_name` |  | 쿠폰명 쿠폰의 이름 |
| ↳ `benefit_type` |  | 혜택 구분 혜택의 유형. 각각의 유형별로 부여하는 혜택이 다름. |
| ↳ `issue_type` |  | 발급 구분 쿠폰의 발급형태 유형 |
| ↳ `issue_sub_type` |  | 발급 하위 유형 쿠폰 발급의 세부 하위 유형 |
| ↳ `available_period_type` |  | 사용기간 유형 쿠폰의 사용 가능한 기간의 유형 |
| ↳ `available_begin_datetime` |  | 사용 기간 시작 일시 쿠폰 사용 가능 기간 시작일시 |
| ↳ `available_end_datetime` |  | 사용 기간 종료 일시 쿠폰 사용 가능 기간 종료일시 |
| ↳ `available_day_from_issued` |  | 사용 가능 일수 쿠폰의 사용 가능 일수 |
| ↳ `available_site` |  | 사용 범위 유형 쿠폰 사용 가능한 접속경로의 유형 |
| ↳ `available_scope` |  | 적용 범위 쿠폰 적용 가능한 범위. 상품 쿠폰으로 적용시 상품 하나에 대하여 쿠폰이 적용되며, 주문서 쿠폰으로 적용시 주문서 전체에 적용됨. |
| ↳ `available_product` |  | 쿠폰적용 상품 선택 쿠폰의 적용가능 상품 선택. 특정 상품을 제외하거나, 적용하거나 혹은 모든 상품에 대해서 쿠폰적용 여부를 선택할 수 있음. |
| ↳ `available_product_list` |  | 쿠폰적용 상품 리스트 |
| ↳ `available_category` |  | 쿠폰적용 분류 선택 쿠폰의 적용가능 분류 선택. 특정 분류를 제외하거나, 적용하거나 혹은 모든 분류에 대해서 쿠폰적용 여부를 선택할 수 있음. |
| ↳ `available_category_list` |  | 쿠폰적용 분류 리스트 |
| ↳ `available_amount_type` |  | 적용 계산 기준 쿠폰을 적용할 기준이 되는 결제 금액. 쿠폰할인을 각종 할인(회원등급할인, 상품할인 등)전 주문금액에 적용할지, 각종 할인 후 금액에 적용할지 여부. |
| ↳ `available_coupon_count_by_order` |  | 주문서 당 동일쿠폰 최대 사용 수 한 주문서 당 동일한 쿠폰 최대 사용가능 수 |
| ↳ `available_price_type` |  | 사용가능 구매 금액 유형 쿠폰의 사용가능 금액에 대한 기준. 상품 금액 기준일 경우 상품 가격에 수량을 곱한 금액을 기준으로 하며, 주문 금액 기준일 경우 해당 금액에 기타 할인, 배송비가 적용된 금액을 기준으로 계산한다. U : 제한 없음 · O : 주문 금액 기준 · P : 상품 금액 기준 |
| ↳ `available_order_price_type` |  | 사용가능 구매 금액 상세 유형 U : 모든 상품의 주문 금액 · I : 쿠폰 적용 상품의 주문 금액 |
| ↳ `available_min_price` |  | 사용가능 구매 금액 쿠폰을 사용가능한 구매 금액 |
| ↳ `discount_amount` |  | 할인금액 |
| ↳ ↳ `benefit_price` |  | 혜택 금액 혜택으로 할인받는 금액 |
| ↳ `discount_rate` |  | 할인율 |
| ↳ `issue_member_join` |  | 회원가입시 쿠폰 발급 여부 회원가입 시 발급해주는 쿠폰인지 여부 |
| ↳ `issue_member_join_recommend` |  | 회원가입시 추천인에게 쿠폰 발급 여부 회원가입시 추천인에게 발급해주는 쿠폰인지 여부 |
| ↳ `issue_member_join_type` |  | 회원가입시 쿠폰 발급 대상 회원가입시 쿠폰을 발급해줄 대상에 대한 구분 |
| ↳ `issue_anniversary_type` |  | 발급 조건 기념일 유형 쿠폰 발급 조건 기념일의 유형 |
| ↳ `issue_on_anniversary` |  | 당일 발급 여부 |
| ↳ `issue_anniversary_pre_issue_day` |  | 발급 조건 기념일 선발행 일수 기념일 쿠폰 미리 발급 가능한 일수 |
| ↳ `issue_review_count` |  | 발급 조건 상품 후기 개수 쿠폰 발급에 필요한 상품 후기의 개수 |
| ↳ `issue_review_has_image` |  | 발급 조건 상품 후기 이미지 포함 여부 쿠폰 발급에 필요한 상품 후기에 이미지가 포함되어야 하는지 여부 |
| ↳ `issue_limit` |  | 발급수 제한여부 |
| ↳ `same_user_reissue` |  | 동일인 재발급 가능여부 |
| ↳ `issue_reserved` |  | 자동 발행 예약 사용 여부 쿠폰 발급일자를 미리 예약하는 기능의 사용여부. 해당 예약 일시가 되면 쿠폰은 자동 발행 됨. |
| ↳ `issue_reserved_date` |  | 자동 발행 예약 발급 일시 설정된 쿠폰 자동 발행 예약 일시 |
| ↳ `issue_no_purchase_period` |  | 일정기간 미구매 대상 회원의 미구매 기간 일정 기간 미구매 회원 대상 발급시 발급 조건으로 설정한 구매이력이 없는 기간 |
| ↳ `show_product_detail` |  | 상품상세페이지 노출여부 상품상세페이지에 노출할지 여부 |
| ↳ `include_regional_shipping_rate` |  | 배송비 할인 시 지역별 구분 포함 여부 배송비를 할인할 때 지역별 배송비를 포함할지 여부 |
| ↳ `include_foreign_delivery` |  | 해외배송 포함여부 쿠폰혜택에 해외배송을 포함할지 여부 |
| ↳ `issue_max_count` |  | 최대 발급수 쿠폰의 최대 발급수량 |
| ↳ `issue_max_count_by_user` |  | 동일인 재발급 최대수량 동일한 고객에게 재발급할 수 있는 최대 쿠폰 수량 |
| ↳ `issue_order_path` |  | 주문경로 발급한 쿠폰의 사용 가능한 주문 경로 W : 웹 쇼핑몰 전용 · M : 모바일 쇼핑몰 전용 · P : 브랜드앱 전용 |
| ↳ ↳ `W` |  |  |
| ↳ ↳ `M` |  |  |
| ↳ ↳ `P` |  |  |
| ↳ `issue_order_date` |  | 발급대상 주문기간 설정 T : 주문기간 설정 · F : 주문기간 설정 불가 |
| ↳ `issue_order_start_date` |  | 쿠폰발급 가능한 주문시작일시 |
| ↳ `issue_order_end_date` |  | 쿠폰발급 가능한 주문종료일시 |
| ↳ `issue_member_group_no` |  | 발급대상 회원등급 번호 쿠폰발급 대상이 되는 회원등급의 번호 |
| ↳ `issue_member_group_name` |  | 발급대상 회원등급 이름 쿠폰발급 대상이 되는 회원등급의 이름 |
| ↳ `issue_order_amount_type` |  | 발급가능 구매금액 유형 쿠폰으로 할인 시 할인 대상이 되는 금액의 기준 |
| ↳ `issue_order_amount_limit` |  | 발급 가능 구매 금액 제한 유형 쿠폰 발급 가능 구매금액을 제한할 수 있음 |
| ↳ `issue_order_amount_min` |  | 발급 가능 최소 구매 금액 쿠폰 발급이 가능한 최소 구매 금액 |
| ↳ `issue_order_amount_max` |  | 발급 가능 최대 구매 금액 쿠폰 발급이 가능한 최대 구매 금액 |
| ↳ `issue_count_per_once` |  | 쿠폰발급 회당 발급수량 (1회 발급수량) 1회 발급할때의 쿠폰 발급수량 |
| ↳ `issue_order_type` |  | 발급단위 쿠폰 발급 단위 |
| ↳ `issue_order_available_product` |  | 발급 대상 상품 쿠폰 발급 대상이 되는 상품 |
| ↳ `issue_order_available_product_list` |  | 발급 대상 상품 리스트 |
| ↳ `issue_order_available_category` |  | 발급 대상 카테고리 쿠폰 발급 대상이 되는 카테고리 |
| ↳ `issue_order_available_category_list` |  | 발급 대상 카테고리 리스트 |
| ↳ `issue_quntity_type` |  | 쿠폰 발급가능수량 판단기준 쿠폰 발급가능수량의 판단이 되는 기준 |
| ↳ `issue_quantity_min` |  | 쿠폰 발급가능 최소구매수량 쿠폰 발급이 가능한 최소 구매 수량 |
| ↳ `available_payment_method` |  | 사용가능 결제수단 쿠폰 사용이 가능한 결제수단 |
| ↳ `use_notification_when_login` |  | 로그인 시 쿠폰발급 알람 사용여부 회원 로그인 시 쿠폰발급 알람을 사용할지 여부 |
| ↳ `send_sms_for_issue` |  | 쿠폰발급 SMS 발송 여부 쿠폰 발급정보를 SMS로 발송할지 여부 |
| ↳ `send_email_for_issue` |  | 쿠폰 발급정보 이메일 발송여부 쿠폰 발급정보를 이메일로 발송할지 여부 |
| ↳ `exclude_unsubscribed` |  | 이메일 수신거부 회원 제외여부 |
| ↳ `recurring_issuance` |  | 정기쿠폰 발급 |

응답 예시 (JSON):

```json
{
    "coupon": {
        "shop_no": 1,
        "coupon_no": "9000000000000000018",
        "coupon_name": "Special Discount Coupon",
        "benefit_type": "A",
        "issue_type": "M",
        "issue_sub_type": "M",
        "available_period_type": "F",
        "available_begin_datetime": "2019-04-10T00:00:00+09:00",
        "available_end_datetime": "2019-04-13T23:00:00+09:00",
        "available_day_from_issued": null,
        "available_site": [
            "W",
            "M",
            "P"
        ],
        "available_scope": "O",
        "available_product": "I",
        "available_product_list": [
            1,
            2
        ],
        "available_category": "I",
        "available_category_list": [
            1,
            2
        ],
        "available_amount_type": "E",
        "available_coupon_count_by_order": 1,
        "available_price_type": "O",
        "available_order_price_type": "U",
        "available_min_price": "1.00",
        "discount_amount": {
            "benefit_price": "3.00"
        },
        "discount_rate": null,
        "issue_member_join": null,
        "issue_member_join_recommend": null,
        "issue_member_join_type": null,
        "issue_anniversary_type": null,
        "issue_on_anniversary": null,
        "issue_anniversary_pre_issue_day": null,
        "issue_review_count": null,
        "issue_review_has_image": null,
        "issue_limit": null,
        "same_user_reissue": null,
        "issue_reserved": "F",
        "issue_reserved_date": null,
        "issue_no_purchase_period": null,
        "show_product_detail": null,
        "include_regional_shipping_rate": null,
        "include_foreign_delivery": null,
        "issue_max_count": null,
        "issue_max_count_by_user": null,
        "issue_order_path": {
            "W": "T",
            "M": "F",
            "P": "F"
        },
        "issue_order_date": "F",
        "issue_order_start_date": null,
        "issue_order_end_date": null,
        "issue_member_group_no": null,
        "issue_member_group_name": null,
        "issue_order_amount_type": null,
        "issue_order_amount_limit": null,
        "issue_order_amount_min": null,
        "issue_order_amount_max": null,
        "issue_count_per_once": null,
        "issue_order_type": null,
        "issue_order_available_product": "I",
        "issue_order_available_product_list": [
            1,
            2
        ],
        "issue_order_available_category": "I",
        "issue_order_available_category_list": [
            1,
            2
        ],
        "issue_quntity_type": null,
        "issue_quantity_min": null,
        "available_payment_method": [
            "all"
        ],
        "use_notification_when_login": null,
        "send_sms_for_issue": null,
        "send_email_for_issue": null,
        "exclude_unsubscribed": null,
        "recurring_issuance": null
    }
}
```

### `PUT /api/v2/admin/coupons/{coupon_no}` — Coupon management

- **Scope**: `mall.write_promotion` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#coupon-management

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `coupon_no` | ✓ |  |  | 쿠폰번호 |
| `status` |  |  |  | 쿠폰 상태 변경 쿠폰을 삭제하는 경우, null로 전송 발급 중지: pause · 발급 재개: restart |
| `deleted` |  |  |  | 쿠폰삭제 여부 D : 삭제 |
| `immediate_issue_pause` |  |  |  | 즉시 발급 중지 I 입력 시 status 항목을 pause 로 전송 필요 I : 즉시 발급 중지 |
| `immediate_issue_restart` |  |  |  | 즉시 발급 재개 I 입력 시 status 항목을 restart 로 전송 필요 I : 즉시 발급 재개 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `coupon` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| ↳ `coupon_no` |  | 쿠폰번호 |
| ↳ `status` |  | 쿠폰 상태 변경 |
| ↳ `deleted` |  | 쿠폰삭제 여부 쿠폰이 삭제되었는지 여부. |
| ↳ `immediate_issue_pause` |  | 즉시 발급 중지 |
| ↳ `immediate_issue_restart` |  | 즉시 발급 재개 |

응답 예시 (JSON):

```json
{
    "coupon": {
        "shop_no": 1,
        "coupon_no": 6079609780100000003,
        "status": "pause",
        "deleted": null,
        "immediate_issue_pause": "I",
        "immediate_issue_restart": null
    }
}
```
