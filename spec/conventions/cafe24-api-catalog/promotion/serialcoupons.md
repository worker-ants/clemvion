---
resource: promotion
entity: serialcoupons
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#serialcoupons
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Promotion / Serialcoupons

> Field-level 카탈로그. Endpoint enumeration index: [`../promotion.md`](../promotion.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Serialcoupons](https://developers.cafe24.com/docs/ko/api/admin/#serialcoupons)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

시리얼코드로 쿠폰을 관리하는 기능을 제공합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `coupon_no` |  | 쿠폰번호 |
| `coupon_name` |  | 쿠폰명 |
| `coupon_description` |  | 쿠폰설명 |
| `created_date` |  | 생성일 |
| `deleted` |  | 쿠폰삭제 여부 T : 삭제 · F : 삭제되지 않음 |
| `benefit_text` |  | 쿠폰혜택 상세내역 출력 |
| `benefit_type` |  | 혜택 구분 A : 할인금액 · B : 할인율 |
| `benefit_price` |  | 혜택 금액 |
| `benefit_percentage` |  | 혜택 비율 |
| `benefit_percentage_round_unit` |  | 혜택 비율 절사 단위 |
| `benefit_percentage_max_price` |  | 혜택 비율 최대 금액 |
| `include_regional_shipping_rate` |  | 배송비 할인 시 지역별 구분 포함 여부 T : 지역별 구분 포함 · F : 지역별 구분 미포함 |
| `include_foreign_delivery` |  | 해외배송 포함여부 T : 해외배송 포함 · F : 해외배송 미포함 |
| `issue_order_amount_type` |  | 발급가능 구매금액 유형 O : 구매금액 기준 · S : 실결제 금액기준 |
| `issue_order_start_date` |  | 쿠폰발급 가능한 주문시작일시 |
| `issue_order_end_date` |  | 쿠폰발급 가능한 주문종료일시 |
| `issue_order_amount_limit` |  | 발급 가능 구매 금액 제한 유형 U : 제한 없음 · L : 최소 금액 · S : 금액 범위 |
| `issue_order_amount_min` |  | 발급 가능 최소 구매 금액 |
| `issue_order_amount_max` |  | 발급 가능 최대 구매 금액 |
| `issue_order_path` |  | 주문경로 W : 웹 쇼핑몰 전용 · M : 모바일 쇼핑몰 전용 · P : 브랜드앱 전용 |
| `issue_order_type` |  | 발급단위 O : 주문서단위 발급쿠폰 · P : 상품단위 발급쿠폰 |
| `issue_order_available_product` |  | 발급 대상 상품 U : 제한 없음 · I : 선택 상품 적용 · E : 선택 상품 제외 |
| `issue_order_available_category` |  | 발급 대상 카테고리 U : 제한 없음 · I : 선택 상품 적용 · E : 선택 상품 제외 |
| `issue_max_count` |  | 최대 발급수 |
| `issue_max_count_by_user` |  | 동일인 재발급 가능 여부 |
| `issue_count_per_once` |  | 쿠폰발급 회당 발급수량 (1회 발급수량) |
| `issued_count` |  | 발급된 수량 |
| `available_date` |  | 쿠폰 사용기간 |
| `available_period_type` |  | 사용기간 유형 F : 일반 기간 · R : 쿠폰 발급일 기준 · M : 당월 말까지 사용 |
| `available_begin_datetime` |  | 사용 기간 시작 일시 |
| `available_end_datetime` |  | 사용 기간 종료 일시 |
| `available_site` |  | 사용 범위 유형 W : 웹 쇼핑몰 전용 · M : 모바일 쇼핑몰 전용 |
| `available_scope` |  | 적용 범위 P : 상품 쿠폰 · O : 주문서 쿠폰 |
| `available_day_from_issued` |  | 사용 가능 일수 |
| `available_price_type` |  | 사용가능 구매 금액 유형 U : 제한 없음 · O : 주문 금액 기준 · P : 상품 금액 기준 |
| `available_order_price_type` |  | 사용가능 구매 금액 상세 유형 U : 모든 상품의 주문 금액 · I : 쿠폰 적용 상품의 주문 금액 |
| `available_min_price` | 최소: [0.01]~최대: [999999999] | 사용가능 구매 금액 |
| `available_amount_type` |  | 적용 계산 기준 E : 할인(쿠폰 제외) 적용 전 결제 금액 · I : 할인(쿠폰 제외) 적용 후 결제 금액 |
| `available_payment_method` |  | 사용가능 결제수단 all : 제한없음 · R : 무통장입금 · E : 가상계좌 · C : 신용카드 · A : 계좌이체 · H : 휴대폰 · M : 적립금 · K : 케이페이 · P : 페이나우 · N : 페이코 · O : 카카오페이 · S : 스마일페이 · V : 네이버페이 · B : 편의점 · D : 토스 |
| `available_product` |  | 쿠폰적용 상품 선택 U : 제한 없음 · I : 선택 상품 적용 · E : 선택 상품 제외 |
| `available_product_list` |  | 쿠폰적용 상품 리스트 |
| `available_category` |  | 쿠폰적용 분류 선택 U : 제한 없음 · I : 선택 카테고리 적용 · E : 선택 카테고리 제외 |
| `available_category_list` |  | 쿠폰적용 분류 리스트 |
| `available_coupon_count_by_order` |  | 주문서 당 동일쿠폰 최대 사용 수 |
| `serial_generate_method` |  | 시리얼 쿠폰 생성방법 A:자동생성 · M:수동생성 |
| `show_product_detail` |  | 상품상세페이지 노출여부 T : 상품상세페이지 노출 · F : 상품상세페이지 미노출 |
| `discount_amount` |  | 할인금액 |
| `discount_rate` |  | 할인율 |
| `serial_code_type` |  | 시리얼코드 생성 방식 R: 다른 시리얼 코드로 생성 · S: 동일 시리얼 코드로 생성 |
| `serial_generate_auto` |  | 시리얼 쿠폰 자동생성 추가 정보 |

## Operations

### `GET /api/v2/admin/serialcoupons` — Retrieve coupon codes

- **Scope**: `mall.read_promotion` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-coupon-codes

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `coupon_no` |  |  |  | 쿠폰번호 |
| `coupon_name` |  |  |  | 쿠폰명 |
| `benefit_type` |  |  |  | 혜택 구분 ,(콤마)로 여러 건을 검색할 수 있다. A : 할인금액 · B : 할인율 · C : 적립금액 · D : 적립율 · E : 기본배송비 할인(전액할인) · I : 기본배송비 할인(할인율) · H : 기본배송비 할인(할인금액) · J : 전체배송비 할인(전액할인) · F : 즉시적립 · G : 예치금 |
| `issued_flag` |  |  |  | 발급된 쿠폰 여부 T : 발급이력이 있는 쿠폰 · F : 발급이력이 없는 쿠폰 |
| `created_start_date` |  | 날짜 |  | 검색 시작일 |
| `created_end_date` |  | 날짜 |  | 검색 종료일 |
| `deleted` |  |  | F | 쿠폰삭제 여부 ,(콤마)로 여러 건을 검색할 수 있다. T : 삭제된 쿠폰 · F : 삭제되지 않은 쿠폰 |
| `issue_order_path` |  |  |  | 주문경로 W : PC · M : 모바일 · P : 브랜드앱 |
| `issue_order_type` |  |  |  | 발급단위 P : 상품 쿠폰 · O : 주문서 쿠폰 |
| `issue_reserved` |  |  |  | 자동 발행 예약 사용 여부 T : 사용 · F : 사용하지 않음 |
| `available_period_type` |  |  |  | 사용기간 유형 ,(콤마)로 여러 건을 검색할 수 있다. F : 일반 기간 · R : 쿠폰 발급일 기준 · M : 당월 말까지 사용 |
| `available_datetime` |  | 날짜 |  | 해당 날짜에 발급 가능한 쿠폰 검색 available_period_type이 F일 때만 유효 |
| `available_site` |  |  |  | 사용 범위 유형 W : 웹 쇼핑몰 전용 · M : 모바일 쇼핑몰 전용 · P : 브랜드앱 전용 |
| `available_scope` |  |  |  | 적용 범위 P : 상품 쿠폰 · O : 주문서 쿠폰 |
| `available_price_type` |  |  |  | 사용가능 구매 금액 유형 U : 제한 없음 · O : 주문 금액 기준 · P : 상품 금액 기준 |
| `available_order_price_type` |  |  |  | 사용가능 구매 금액 상세 유형 U : 모든 상품의 주문 금액 · I : 쿠폰 적용 상품의 주문 금액 |
| `limit` |  | 최소: [1]~최대: [500] | 100 | 조회결과 최대건수 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `serialcoupons` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `coupon_no` |  | 쿠폰번호 |
| ↳ `serial_no` |  |  |
| ↳ `coupon_name` |  | 쿠폰명 |
| ↳ `coupon_description` |  | 쿠폰설명 |
| ↳ `created_date` |  | 생성일 |
| ↳ `deleted` |  | 쿠폰삭제 여부 T : 삭제 · F : 삭제되지 않음 |
| ↳ `is_stopped_issued_coupon` |  | 쿠폰 완전삭제 (발급된 쿠폰 사용정지) 여부 쿠폰이 완전 삭제되었는지 여부. 쿠폰이 완전 삭제되면 기존에 발급된 쿠폰도 더 이상 사용이 불가함. T : 완전삭제 · F : 완전삭제 아님 |
| ↳ `pause_begin_datetime` |  | 쿠폰 발급 일시정지 시작시간 쿠폰 발급을 조건부 자동발급으로 설정한 경우, 조건에 해당해도 발급을 일시정지하는 기간의 시작 시간 |
| ↳ `pause_end_datetime` |  | 쿠폰 발급 일시정지 종료시간 쿠폰 발급을 조건부 자동발급으로 설정한 경우, 조건에 해당해도 발급을 일시정지하는 기간의 종료 시간 |
| ↳ `benefit_text` |  | 쿠폰혜택 상세내역 출력 |
| ↳ `benefit_type` |  | 혜택 구분 A : 할인금액 · B : 할인율 |
| ↳ `benefit_price` |  | 혜택 금액 |
| ↳ `benefit_percentage` |  | 혜택 비율 |
| ↳ `benefit_percentage_round_unit` |  | 혜택 비율 절사 단위 |
| ↳ `benefit_percentage_max_price` |  | 혜택 비율 최대 금액 |
| ↳ `include_regional_shipping_rate` |  | 배송비 할인 시 지역별 구분 포함 여부 T : 지역별 구분 포함 · F : 지역별 구분 미포함 |
| ↳ `include_foreign_delivery` |  | 해외배송 포함여부 T : 해외배송 포함 · F : 해외배송 미포함 |
| ↳ `issue_member_join` |  |  |
| ↳ `issue_member_join_recommend` |  |  |
| ↳ `issue_member_join_type` |  |  |
| ↳ `issue_order_amount_type` |  | 발급가능 구매금액 유형 O : 구매금액 기준 · S : 실결제 금액기준 |
| ↳ `issue_order_start_date` |  | 쿠폰발급 가능한 주문시작일시 |
| ↳ `issue_order_end_date` |  | 쿠폰발급 가능한 주문종료일시 |
| ↳ `issue_order_amount_limit` |  | 발급 가능 구매 금액 제한 유형 U : 제한 없음 · L : 최소 금액 · S : 금액 범위 |
| ↳ `issue_order_amount_min` |  | 발급 가능 최소 구매 금액 |
| ↳ `issue_order_amount_max` |  | 발급 가능 최대 구매 금액 |
| ↳ `issue_order_path` |  | 주문경로 W : 웹 쇼핑몰 전용 · M : 모바일 쇼핑몰 전용 · P : 브랜드앱 전용 |
| ↳ `issue_order_type` |  | 발급단위 O : 주문서단위 발급쿠폰 · P : 상품단위 발급쿠폰 |
| ↳ `issue_order_available_product` |  | 발급 대상 상품 U : 제한 없음 · I : 선택 상품 적용 · E : 선택 상품 제외 |
| ↳ `issue_order_available_category` |  | 발급 대상 카테고리 U : 제한 없음 · I : 선택 상품 적용 · E : 선택 상품 제외 |
| ↳ `issue_anniversary_type` |  |  |
| ↳ `issue_anniversary_pre_issue_day` |  |  |
| ↳ `issue_module_type` |  | 발급 조건 설치 모듈 유형 모듈 설치 발급 쿠폰의 설치 모듈 유형 S : 바로가기 · B : 즐겨찾기 · L : 라이브링콘 |
| ↳ `issue_review_count` |  |  |
| ↳ `issue_review_has_image` |  |  |
| ↳ `issue_quantity_min` | 최소값: [1]; 최대값: [999] | 쿠폰 발급가능 최소구매수량 |
| ↳ `issue_quntity_type` |  |  |
| ↳ `issue_max_count` |  | 최대 발급수 |
| ↳ `issue_max_count_by_user` |  | 동일인 재발급 가능 여부 |
| ↳ `issue_count_per_once` |  | 쿠폰발급 회당 발급수량 (1회 발급수량) |
| ↳ `issued_count` |  | 발급된 수량 |
| ↳ `issue_member_group_no` |  | 발급대상 회원등급 번호 |
| ↳ `issue_member_group_name` |  | 발급대상 회원등급 이름 |
| ↳ `issue_no_purchase_period` |  |  |
| ↳ `issue_reserved` |  | 자동 발행 예약 사용 여부 T : 사용 · F : 사용하지 않음 |
| ↳ `issue_reserved_date` |  |  |
| ↳ `available_date` |  | 쿠폰 사용기간 |
| ↳ `available_period_type` |  | 사용기간 유형 F : 일반 기간 · R : 쿠폰 발급일 기준 · M : 당월 말까지 사용 |
| ↳ `available_begin_datetime` |  | 사용 기간 시작 일시 |
| ↳ `available_end_datetime` |  | 사용 기간 종료 일시 |
| ↳ `available_site` |  | 사용 범위 유형 W : 웹 쇼핑몰 전용 · M : 모바일 쇼핑몰 전용 |
| ↳ `available_scope` |  | 적용 범위 P : 상품 쿠폰 · O : 주문서 쿠폰 |
| ↳ `available_day_from_issued` |  | 사용 가능 일수 |
| ↳ `available_price_type` |  | 사용가능 구매 금액 유형 U : 제한 없음 · O : 주문 금액 기준 · P : 상품 금액 기준 |
| ↳ `available_order_price_type` |  | 사용가능 구매 금액 상세 유형 U : 모든 상품의 주문 금액 · I : 쿠폰 적용 상품의 주문 금액 |
| ↳ `available_min_price` | 최소: [0.01]~최대: [999999999] | 사용가능 구매 금액 |
| ↳ `available_amount_type` |  | 적용 계산 기준 E : 할인(쿠폰 제외) 적용 전 결제 금액 · I : 할인(쿠폰 제외) 적용 후 결제 금액 |
| ↳ `available_payment_method` |  | 사용가능 결제수단 all : 제한없음 · R : 무통장입금 · E : 가상계좌 · C : 신용카드 · A : 계좌이체 · H : 휴대폰 · M : 적립금 · K : 케이페이 · P : 페이나우 · N : 페이코 · O : 카카오페이 · S : 스마일페이 · V : 네이버페이 · B : 편의점 · D : 토스 |
| ↳ `available_product` |  | 쿠폰적용 상품 선택 U : 제한 없음 · I : 선택 상품 적용 · E : 선택 상품 제외 |
| ↳ `available_product_list` |  | 쿠폰적용 상품 리스트 |
| ↳ `available_category` |  | 쿠폰적용 분류 선택 U : 제한 없음 · I : 선택 카테고리 적용 · E : 선택 카테고리 제외 |
| ↳ `available_category_list` |  | 쿠폰적용 분류 리스트 |
| ↳ `available_coupon_count_by_order` |  | 주문서 당 동일쿠폰 최대 사용 수 |
| ↳ `serial_generate_method` |  | 시리얼 쿠폰 생성방법 A:자동생성 · M:수동생성 |
| ↳ `coupon_image_type` |  | 쿠폰 이미지 유형 쿠폰 이미지의 유형 B : 기본 이미지 사용 · C : 직접 업로드 |
| ↳ `coupon_image_path` |  | 쿠폰 이미지 경로 쿠폰 이미지의 URL 경로 |
| ↳ `show_product_detail` |  | 상품상세페이지 노출여부 T : 상품상세페이지 노출 · F : 상품상세페이지 미노출 |
| ↳ `use_notification_when_login` |  |  |

응답 예시 (JSON):

```json
{
    "serialcoupons": [
        {
            "shop_no": 1,
            "coupon_no": "9000000000000000033",
            "serial_no": "A1234567890Z",
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
            "issue_order_available_category": "U",
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
            "available_site": "W,M",
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
            "use_notification_when_login": "F"
        },
        {
            "shop_no": 1,
            "coupon_no": "9000000000000000032",
            "serial_no": "A1234567891Z",
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
            "issue_order_available_category": "U",
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
            "available_site": "W,M",
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
            "use_notification_when_login": "F"
        }
    ]
}
```

### `POST /api/v2/admin/serialcoupons` — Generate coupon code

- **Scope**: `mall.write_promotion` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#generate-coupon-code

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `coupon_name` | ✓ | 글자수 최소: [1자]~최대: [50자] |  | 쿠폰명 |
| `benefit_type` | ✓ |  |  | 혜택 구분 A : 할인금액 · B : 할인율 |
| `available_period_type` | ✓ |  |  | 사용기간 유형 F : 일반 기간 · R : 쿠폰 발급일 기준 · M : 당월 말까지 사용 |
| `available_begin_datetime` |  | 날짜 |  | 사용 기간 시작 일시 |
| `available_end_datetime` |  | 날짜 |  | 사용 기간 종료 일시 |
| `available_day_from_issued` |  | 최소값: [1]; 최대값: [999] |  | 사용 가능 일수 |
| `available_site` | ✓ |  |  | 사용 범위 유형 W : 웹 쇼핑몰 전용 · M : 모바일 쇼핑몰 전용 |
| `available_scope` | ✓ |  |  | 적용 범위 P : 상품 쿠폰 · O : 주문서 쿠폰 |
| `available_product` | ✓ |  |  | 쿠폰적용 상품 선택 U : 제한 없음 · I : 선택 상품 적용 · E : 선택 상품 제외 |
| `available_product_list` |  |  |  | 쿠폰적용 상품 리스트 |
| `available_category` | ✓ |  |  | 쿠폰적용 분류 선택 U : 제한 없음 · I : 선택 카테고리 적용 · E : 선택 카테고리 제외 |
| `available_category_list` |  |  |  | 쿠폰적용 분류 리스트 |
| `available_amount_type` | ✓ |  |  | 적용 계산 기준 E : 할인(쿠폰 제외) 적용 전 결제 금액 · I : 할인(쿠폰 제외) 적용 후 결제 금액 |
| `available_coupon_count_by_order` | ✓ | 최소값: [1]; 최대값: [999] |  | 주문서 당 동일쿠폰 최대 사용 수 |
| `available_price_type` |  |  | U | 사용가능 구매 금액 유형 U : 제한 없음 · O : 주문 금액 기준 · P : 상품 금액 기준 |
| `available_order_price_type` |  |  |  | 사용가능 구매 금액 상세 유형 U : 모든 상품의 주문 금액 · I : 쿠폰 적용 상품의 주문 금액 |
| `available_min_price` |  | 최소: [0.01]~최대: [999999999] |  | 사용가능 구매 금액 |
| `discount_amount` |  |  |  | 할인금액 |
| ↳ `benefit_price` | ✓ |  |  | 혜택 금액 |
| `discount_rate` |  |  |  | 할인율 |
| ↳ `benefit_percentage` | ✓ |  |  | 혜택 비율 |
| ↳ `benefit_percentage_round_unit` | ✓ |  |  | 혜택 비율 절사 단위 |
| ↳ `benefit_percentage_max_price` | ✓ |  |  | 혜택 비율 최대 금액 |
| `serial_generate_method` | ✓ |  |  | 시리얼 쿠폰 생성방법 A:자동생성 · M:수동생성 |
| `serial_code_type` | ✓ |  |  | 시리얼코드 생성 방식 R: 다른 시리얼 코드로 생성 · S: 동일 시리얼 코드로 생성 |
| `serial_generate_auto` |  |  |  | 시리얼 쿠폰 자동생성 추가 정보 |
| ↳ `issue_max_count` | ✓ |  |  | 자동생성 개수 |
| ↳ `serial_code_length` | ✓ |  |  | 자동생성 시리얼코드 자리수 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `serialcoupons` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `coupon_no` |  | 쿠폰번호 |
| ↳ `coupon_name` |  | 쿠폰명 |
| ↳ `benefit_type` |  | 혜택 구분 A : 할인금액 · B : 할인율 |
| ↳ `available_period_type` |  | 사용기간 유형 F : 일반 기간 · R : 쿠폰 발급일 기준 · M : 당월 말까지 사용 |
| ↳ `available_begin_datetime` |  | 사용 기간 시작 일시 |
| ↳ `available_end_datetime` |  | 사용 기간 종료 일시 |
| ↳ `available_day_from_issued` |  | 사용 가능 일수 |
| ↳ `available_site` |  | 사용 범위 유형 W : 웹 쇼핑몰 전용 · M : 모바일 쇼핑몰 전용 |
| ↳ `available_scope` |  | 적용 범위 P : 상품 쿠폰 · O : 주문서 쿠폰 |
| ↳ `available_product` |  | 쿠폰적용 상품 선택 U : 제한 없음 · I : 선택 상품 적용 · E : 선택 상품 제외 |
| ↳ `available_product_list` |  | 쿠폰적용 상품 리스트 |
| ↳ `available_category` |  | 쿠폰적용 분류 선택 U : 제한 없음 · I : 선택 카테고리 적용 · E : 선택 카테고리 제외 |
| ↳ `available_category_list` |  | 쿠폰적용 분류 리스트 |
| ↳ `available_amount_type` |  | 적용 계산 기준 E : 할인(쿠폰 제외) 적용 전 결제 금액 · I : 할인(쿠폰 제외) 적용 후 결제 금액 |
| ↳ `available_coupon_count_by_order` |  | 주문서 당 동일쿠폰 최대 사용 수 |
| ↳ `available_price_type` |  | 사용가능 구매 금액 유형 U : 제한 없음 · O : 주문 금액 기준 · P : 상품 금액 기준 |
| ↳ `available_order_price_type` |  | 사용가능 구매 금액 상세 유형 U : 모든 상품의 주문 금액 · I : 쿠폰 적용 상품의 주문 금액 |
| ↳ `available_min_price` | 최소: [0.01]~최대: [999999999] | 사용가능 구매 금액 |
| ↳ `discount_amount` |  | 할인금액 |
| ↳ ↳ `benefit_price` |  | 혜택 금액 |
| ↳ `discount_rate` |  | 할인율 |
| ↳ ↳ `benefit_percentage` |  | 혜택 비율 |
| ↳ ↳ `benefit_percentage_round_unit` |  | 혜택 비율 절사 단위 |
| ↳ ↳ `benefit_percentage_max_price` |  | 혜택 비율 최대 금액 |
| ↳ `serial_generate_method` |  | 시리얼 쿠폰 생성방법 A:자동생성 · M:수동생성 |
| ↳ `serial_code_type` |  | 시리얼코드 생성 방식 R: 다른 시리얼 코드로 생성 · S: 동일 시리얼 코드로 생성 |
| ↳ `serial_generate_auto` |  | 시리얼 쿠폰 자동생성 추가 정보 |
| ↳ ↳ `issue_max_count` |  | 최대 발급수 |
| ↳ ↳ `serial_code_length` |  | 자동생성 시리얼코드 자리수 |

응답 예시 (JSON):

```json
{
    "serialcoupons": {
        "shop_no": 1,
        "coupon_no": "9000000000000000018",
        "coupon_name": "Special Discount Coupon",
        "benefit_type": "A",
        "available_period_type": "F",
        "available_begin_datetime": "2019-04-10T00:00:00+09:00",
        "available_end_datetime": "2019-04-13T23:00:00+09:00",
        "available_day_from_issued": null,
        "available_site": [
            "W",
            "M"
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
        "discount_rate": {
            "benefit_percentage": null,
            "benefit_percentage_round_unit": null,
            "benefit_percentage_max_price": null
        },
        "serial_generate_method": "M",
        "serial_code_type": "R",
        "serial_generate_auto": {
            "issue_max_count": 100,
            "serial_code_length": 10
        }
    }
}
```

### `DELETE /api/v2/admin/serialcoupons/{coupon_no}` — Delete coupon code

- **Scope**: `mall.write_promotion` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-coupon-code

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `coupon_no` |  |  |  | 쿠폰번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `serialcoupon` |  | (응답 객체) |
| ↳ `coupon_no` |  | 쿠폰번호 |

응답 예시 (JSON):

```json
{
    "serialcoupon": {
        "coupon_no": "9000000000000000031"
    }
}
```
