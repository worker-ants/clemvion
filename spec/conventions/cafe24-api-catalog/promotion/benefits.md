---
resource: promotion
entity: benefits
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#benefits
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Promotion / Benefits

> Field-level 카탈로그. Endpoint enumeration index: [`../promotion.md`](../promotion.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Benefits](https://developers.cafe24.com/docs/ko/api/admin/#benefits)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

혜택(Benefits)은 쇼핑몰 고객에게 제공하는 증정 또는 할인과 같은 고객 혜택입니다. · 혜택 리소스를 통해 고객에게 증정 또는 할인 등의 프로모션을 생성하거나 수정, 삭제할 수 있고 생성되어있는 혜택 정보를 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호 |
| `benefit_no` |  | 혜택번호 혜택이 생성된 경우 부여되는 고유 번호 |
| `use_benefit` |  | 진행여부 |
| `benefit_name` | 최대글자수 : [255자] | 혜택명 |
| `benefit_division` |  | 혜택 유형 해당 혜택의 유형으로, 할인과 증정으로 구분됨 |
| `benefit_type` |  | 혜택 상세유형 해당 혜택의 상세유형 · 할인 : 기간할인, 재구매할인, 대량구매할인, 회원할인, 신규상품할인, 배송비할인 · 증정 : 사은품증정, 1+N 이벤트 |
| `use_benefit_period` |  | 혜택 기간 설정 해당 혜택이 적용되는 기간을 설정했는지 여부 |
| `benefit_start_date` | 날짜 | 혜택 시작일 혜택이 적용되는 기간을 설정한 경우, 해당 혜택이 시작되는 일시 |
| `benefit_end_date` | 날짜 | 혜택 종료일 혜택이 적용되는 기간을 설정한 경우, 해당 혜택이 종료되는 일시 |
| `platform_types` |  | 혜택 사용범위 해당 혜택이 적용되는 범위 (PC, 모바일, 플러스앱) |
| `use_group_binding` |  | 참여대상 설정 해당 혜택이 적용되는 대상을 설정 (회원+비회원, 비회원, 회원) |
| `customer_group_list` |  | 회원 등급 참여대상을 회원으로 설정한 경우, 참여가 가능한 회원등급을 설정 |
| `product_binding_type` |  | 상품 범위 해당 혜택이 적용되는 상품의 범위 · 전체상품 : 전체 상품에 혜택 적용 · 특정상품 : 선택한 특정 상품에 대해서만 혜택 적용 · 제외상품 : 선택한 특정 상품에 대해서만 혜택 적용 제외 · 상품분류 : 선택한 상품 분류에 속한 상품에 대해서만 혜택 적용 |
| `use_except_category` |  | 상품분류 혜택제외 특정 상품분류에 대해 혜택 적용을 제외함 (각 유형별로 설정 가능여부가 다름) · 기간할인 : 전체상품, 특정상품인 경우 설정 가능 · 신규상품할인 : 전체상품인 경우 설정 가능 · 그 외 할인 및 증정유형에서는 설정 불가 |
| `available_coupon` |  | 쿠폰 사용범위 쿠폰이 있는 경우, 쿠폰을 중복하여 사용할 수 있는지 여부 |
| `icon_url` |  | 아이콘 URL 혜택이 적용되는 상품명에 아이콘이 노출되도록 아이콘 등록 |
| `created_date` |  | 혜택 등록일 해당 혜택이 등록된 일시 |
| `repurchase_sale` |  | 재구매 할인 설정 혜택의 상세유형이 재구매 할인인 경우 그와 관련한 상세 설정 |
| `bulk_purchase_sale` |  | 대량구매 수량 설정 혜택의 상세유형이 대량구매 할인인 경우 그와 관련한 상세 설정 |
| `member_sale` |  | 회원 할인 설정 혜택의 상세유형이 회원 할인인 경우 그와 관련한 상세 설정 |
| `period_sale` |  | 기간 할인 설정 혜택의 상세유형이 기간 할인인 경우 그와 관련한 상세 설정 · 하위 요소가 입력되어야 정상적인 등록이 가능함 |
| `new_product_sale` |  | 신규상품할인 설정 혜택의 상세유형이 신규상품 할인인 경우 그와 관련한 상세 설정 · 하위 요소가 입력되어야 정상적인 등록이 가능함 |
| `shipping_fee_sale` |  | 배송비 할인 설정 혜택의 상세유형이 배송비 할인인 경우 그와 관련한 상세 설정 · 하위 요소가 입력되어야 정상적인 등록이 가능함 |
| `gift` |  | 사은품 설정 혜택의 상세유형이 사은품 증정인 경우 그와 관련한 상세 설정 · 하위 요소가 입력되어야 정상적인 등록이 가능함 |
| `gift_product_bundle` |  | 1+N 이벤트 설정 혜택의 상세유형이 1+N 이벤트인 경우 그와 관련한 상세 설정 · 하위 요소가 입력되어야 정상적인 등록이 가능함 |

## Operations

### `GET /api/v2/admin/benefits` — Retrieve a list of customer benefits

- **Scope**: `mall.read_promotion` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-benefits

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호 |
| `use_benefit` |  |  |  | 진행여부 T : 진행함 · F : 진행안함 |
| `benefit_name` |  |  |  | 혜택명 |
| `benefit_type` |  |  |  | 혜택 상세유형 해당 혜택의 상세유형 DP : 기간할인 · DR : 재구매할인 · DQ : 대량구매할인 · DM : 회원할인 · DN : 신규상품할인 · DV : 배송비할인 · PG : 사은품 · PB : 1+N 이벤트 |
| `period_type` |  |  |  | 혜택 기간 타입 R : 혜택 등록일 · S : 혜택 시작일 · E : 혜택 종료일 |
| `benefit_start_date` |  | 날짜 |  | 검색 시작일 |
| `benefit_end_date` |  | 날짜 |  | 검색 종료일 |
| `platform_types` |  |  |  | 혜택 사용범위 ,(콤마)로 여러 건을 검색할 수 있다. P : PC 쇼핑몰 · M : 모바일쇼핑몰 · A : 브랜드앱 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |

### `GET /api/v2/admin/benefits/count` — Retrieve a count of customer benefits

- **Scope**: `mall.read_promotion` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-benefits

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호 |
| `use_benefit` |  |  |  | 진행여부 T : 진행함 · F : 진행안함 |
| `benefit_name` |  |  |  | 혜택명 |
| `benefit_type` |  |  |  | 혜택 상세유형 해당 혜택의 상세유형 DP : 기간할인 · DR : 재구매할인 · DQ : 대량구매할인 · DM : 회원할인 · DN : 신규상품할인 · DV : 배송비할인 · PG : 사은품 · PB : 1+N 이벤트 |
| `period_type` |  |  |  | 혜택 기간 타입 R : 혜택 등록일 · S : 혜택 시작일 · E : 혜택 종료일 |
| `benefit_start_date` |  | 날짜 |  | 검색 시작일 |
| `benefit_end_date` |  | 날짜 |  | 검색 종료일 |
| `platform_types` |  |  |  | 혜택 사용범위 ,(콤마)로 여러 건을 검색할 수 있다. P : PC 쇼핑몰 · M : 모바일쇼핑몰 · A : 브랜드앱 |

### `GET /api/v2/admin/benefits/{benefit_no}` — Retrieve a customer benefit

- **Scope**: `mall.read_promotion` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-benefit

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `benefit_no` | ✓ |  |  | 혜택번호 혜택이 생성된 경우 부여되는 고유 번호 |

### `POST /api/v2/admin/benefits` — Create a customer benefit

- **Scope**: `mall.write_promotion` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-customer-benefit

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호 |
| `shop_no` |  |  |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호 |
| `use_benefit` | ✓ |  |  | 진행여부 T : 진행함 · F : 진행안함 |
| `benefit_name` | ✓ | 최대글자수 : [255자] |  | 혜택명 |
| `benefit_division` | ✓ |  |  | 혜택 유형 해당 혜택의 유형으로, 할인과 증정으로 구분됨 D : 할인 · P : 증정 |
| `benefit_type` | ✓ |  |  | 혜택 상세유형 해당 혜택의 상세유형 DP : 기간할인 · DR : 재구매할인 · DQ : 대량구매할인 · DM : 회원할인 · DN : 신규상품할인 · DV : 배송비할인 · PG : 사은품 · PB : 1+N 이벤트 |
| `use_benefit_period` |  |  |  | 혜택 기간 설정 해당 혜택이 적용되는 기간을 설정할지 여부 · 사용함으로 설정하는 경우, 혜택 시작일과 종료일을 입력해야 함 T : 사용함 · F : 사용안함 |
| `benefit_start_date` |  | 날짜 |  | 혜택 시작일 혜택이 적용되는 기간을 설정한 경우, 해당 혜택이 시작되는 일시 |
| `benefit_end_date` |  | 날짜 |  | 혜택 종료일 혜택이 적용되는 기간을 설정한 경우, 해당 혜택이 종료되는 일시 |
| `platform_types` | ✓ |  |  | 혜택 사용범위 해당 혜택이 적용되는 범위 P : PC 쇼핑몰 · M : 모바일쇼핑몰 · A : 브랜드앱 |
| `use_group_binding` |  |  |  | 참여대상 설정 해당 혜택이 적용되는 대상을 설정 A : 회원 + 비회원 · N : 비회원 · M : 회원 |
| `customer_group_list` |  |  |  | 회원 등급 참여대상을 회원으로 설정한 경우, 참여가 가능한 회원등급을 설정 |
| `product_binding_type` |  |  |  | 상품 범위 해당 혜택이 적용되는 상품의 범위 A : 전체상품 · P : 특정상품 · E : 제외상품 · C : 상품분류 |
| `use_except_category` |  |  |  | 상품분류 혜택제외 특정 상품분류에 대해 혜택 적용을 제외함 (각 유형별로 설정 가능여부가 다름) · 기간할인 : 전체상품, 특정상품인 경우 설정 가능 · 신규상품할인 : 전체상품인 경우 설정 가능 · 그 외 할인 및 증정유형에서는 설정 불가 T : 사용함 · F : 사용안함 |
| `available_coupon` |  |  |  | 쿠폰 사용범위 쿠폰이 있는 경우, 쿠폰을 중복하여 사용할 수 있는지 여부 T : 모든 쿠폰 사용가능 · F : 모든 쿠폰 사용제한 |
| `period_sale` |  |  |  | 기간 할인 설정 혜택의 상세유형이 기간 할인인 경우 그와 관련한 상세 설정 · 하위 요소가 입력되어야 정상적인 등록이 가능함 · 할인 금액(discount_value_unit)이 비율(P)인 경우 할인 반올림 단위(discount_truncation_unit), 할인 단위 처리(discount_truncation_method) 필수 입력 · 할인 금액(discount_value_unit)이 금액(W)인 경우 discount_purchasing_quantity 필수 입력 |
| ↳ `product_list` |  |  |  | 상품 목록 |
| ↳ `add_category_list` |  |  |  | 상품 분류 |
| ↳ `except_category_list` |  |  |  | 제외 분류 |
| ↳ `discount_purchasing_quantity` |  |  |  | 할인 구매수량 · T : 구매수량에 따라 · F : 구매수량에 관계없이 |
| ↳ `discount_value` |  |  |  | 할인 값 |
| ↳ `discount_value_unit` |  |  |  | 할인 기준 · P : 비율 · W : 금액 |
| ↳ `discount_truncation_unit` |  |  |  | 할인 반올림 단위 · F : 절사안함 · C : 0.01 · B : 0.1 · O : 1 · T : 10 · M : 100 · H : 1000 |
| ↳ `discount_truncation_method` |  |  |  | 할인 단위 처리 · L : 내림 · U : 반올림 · C : 올림 |
| `repurchase_sale` |  |  |  | 재구매 할인 설정 혜택의 상세유형이 재구매 할인인 경우 그와 관련한 상세 설정 |
| ↳ `product_list` |  |  |  | 상품 목록 |
| ↳ `purchase_item_type` |  |  |  | 구매 횟수 설정 · P : 상품 · I : 품목 |
| ↳ `purchase_times` | ✓ |  |  | 구매횟수 제한 수량 |
| ↳ `discount_purchasing_quantity` |  |  |  | 할인 구매수량 · T : 구매수량에 따라 · F : 구매수량에 관계없이 |
| ↳ `discount_value` |  |  |  | 할인 값 |
| ↳ `discount_value_unit` |  |  |  | 할인 기준 · P : 비율 · W : 금액 |
| ↳ `discount_truncation_unit` |  |  |  | 할인 반올림 단위 · F : 절사안함 · C : 0.01 · B : 0.1 · O : 1 · T : 10 · M : 100 · H : 1000 |
| ↳ `discount_truncation_method` |  |  |  | 할인 단위 처리 · L : 내림 · U : 반올림 · C : 올림 |
| `bulk_purchase_sale` |  |  |  | 대량구매 수량 설정 혜택의 상세유형이 대량구매 할인인 경우 그와 관련한 상세 설정 |
| ↳ `product_list` |  |  |  | 상품 목록 |
| ↳ `bulk_purchase_item_type` |  |  |  | 대량구매 수량 설정 · P : 상품 · I : 품목 · DEFAULT P |
| ↳ `bulk_purchase_begin_quantity` | ✓ |  |  | 구매수량 제한 (n 이상) |
| ↳ `bulk_purchase_limit_quantity` | ✓ |  |  | 구매수량 제한 (n 미만) |
| ↳ `discount_purchasing_quantity` |  |  |  | 할인 구매수량 · T : 구매수량에 따라 · F : 구매수량에 관계없이 |
| ↳ `discount_value` |  |  |  | 할인 값 |
| ↳ `discount_value_unit` |  |  |  | 할인 기준 · P : 비율 · W : 금액 |
| ↳ `discount_truncation_unit` |  |  |  | 할인 반올림 단위 · F : 절사안함 · C : 0.01 · B : 0.1 · O : 1 · T : 10 · M : 100 · H : 1000 |
| ↳ `discount_truncation_method` |  |  |  | 할인 단위 처리 · L : 내림 · U : 반올림 · C : 올림 |
| `member_sale` |  |  |  | 회원 할인 설정 혜택의 상세유형이 회원 할인인 경우 그와 관련한 상세 설정 |
| ↳ `product_list` |  |  |  | 상품 목록 |
| ↳ `discount_purchasing_quantity` |  |  |  | 할인 구매수량 · T : 구매수량에 따라 · F : 구매수량에 관계없이 |
| ↳ `discount_value` |  |  |  | 할인 값 |
| ↳ `discount_value_unit` |  |  |  | 할인 기준 · P : 비율 · W : 금액 |
| ↳ `discount_truncation_unit` |  |  |  | 할인 반올림 단위 · F : 절사안함 · C : 0.01 · B : 0.1 · O : 1 · T : 10 · M : 100 · H : 1000 |
| ↳ `discount_truncation_method` |  |  |  | 할인 단위 처리 · L : 내림 · U : 반올림 · C : 올림 |
| `gift` |  |  |  | 사은품 설정 혜택의 상세유형이 사은품 증정인 경우 그와 관련한 상세 설정 · 하위 요소가 입력되어야 정상적인 등록이 가능함 |
| ↳ `product_list` |  |  |  | 상품 목록 |
| ↳ `add_category_list` |  |  |  | 상품 분류 |
| ↳ `offer_only_first` |  |  |  | 첫 구매 여부 · T : 사용함 · F : 사용안함 |
| ↳ `first_purchase_type` |  |  |  | 첫 구매 기준 · O : 주문기준 · D : 배송완료 기준 |
| ↳ `use_unlimited_price` |  |  |  | 최대가격 제한여부 · T : 사용함 · F : 사용안함 |
| ↳ `purchase_start_price` |  |  |  | 구매가격 제한 (n 이상) |
| ↳ `purchase_limit_price` |  |  |  | 구매가격 제한 (n 미만) |
| ↳ `gift_product_list` |  | Array |  |  |
| ↳ ↳ `product_no` | ✓ |  |  | 상품번호 |
| ↳ ↳ `gift_point` | ✓ |  |  | 차감 점수 |
| ↳ ↳ `max_count` |  |  |  | 최대 선택 수량 |
| `new_product_sale` |  |  |  | 신규상품할인 설정 혜택의 상세유형이 신규상품 할인인 경우 그와 관련한 상세 설정 · 하위 요소가 입력되어야 정상적인 등록이 가능함 · 할인 금액(discount_value_unit)이 비율(P)인 경우 할인 반올림 단위(discount_truncation_unit), 할인 단위 처리(discount_truncation_method) 필수 입력 · 할인 금액(discount_value_unit)이 금액(W)인 경우 discount_purchasing_quantity 필수 입력 |
| ↳ `product_list` |  |  |  | 상품 목록 |
| ↳ `add_category_list` |  |  |  | 상품 분류 |
| ↳ `except_category_list` |  |  |  | 제외 분류 |
| ↳ `new_product_date_type` | ✓ |  |  | 신상품 설정 기준일 · I : 상품 등록일 · U : 상품 최종 수정일 · V : 상품 최종 진열일 |
| ↳ `new_product_day` | ✓ |  |  | 신상품 설정 값 |
| ↳ `new_product_term_type` | ✓ |  |  | 신상품 설정 단위 · D : 일 · H : 시간 |
| ↳ `discount_purchasing_quantity` |  |  |  | 할인 구매수량 · T : 구매수량에 따라 · F : 구매수량에 관계없이 |
| ↳ `discount_value` | ✓ |  |  | 할인 값 |
| ↳ `discount_value_unit` |  |  |  | 할인 기준 · P : 비율 · W : 금액 |
| ↳ `discount_truncation_unit` |  |  |  | 할인 반올림 단위 · F : 절사안함 · C : 0.01 · B : 0.1 · O : 1 · T : 10 · M : 100 · H : 1000 |
| ↳ `discount_truncation_method` |  |  |  | 할인 단위 처리 · L : 내림 · U : 반올림 · C : 올림 |
| `shipping_fee_sale` |  |  |  | 배송비 할인 설정 혜택의 상세유형이 배송비 할인인 경우 그와 관련한 상세 설정 · 하위 요소가 입력되어야 정상적인 등록이 가능함 |
| ↳ `product_list` |  |  |  | 상품 목록 |
| ↳ `use_purchase_price_condition` |  |  |  | 금액 기준 사용여부 · T : 사용함 · F : 사용안함 |
| ↳ `total_purchase_price` |  |  |  | 금액 제한 |
| ↳ `include_regional_shipping_rate` |  |  |  | 지역별배송비 포함여부값 · T : 포함 · F : 미포함 |
| `gift_product_bundle` |  |  |  | 1+N 이벤트 설정 혜택의 상세유형이 1+N 이벤트인 경우 그와 관련한 상세 설정 · 하위 요소가 입력되어야 정상적인 등록이 가능함 |
| ↳ `product_list` |  |  |  | 상품 목록 |
| ↳ `product_bundle_type` | ✓ |  |  | 혜택 설정 · P : 상품 · I : 품목 |
| ↳ `product_bundle_count` | ✓ |  |  | 추가 상품 수량 |
| `icon_url` |  |  |  | 아이콘 URL 혜택이 적용되는 상품명에 아이콘이 노출되도록 아이콘 등록 |

### `PUT /api/v2/admin/benefits/{benefit_no}` — Update a customer benefit

- **Scope**: `mall.write_promotion` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-benefit

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호 |
| `benefit_no` | ✓ |  |  | 혜택번호 혜택이 생성된 경우 부여되는 고유 번호 |
| `use_benefit` |  |  |  | 진행여부 T : 진행함 · F : 진행안함 |
| `benefit_name` |  | 최대글자수 : [255자] |  | 혜택명 |
| `use_benefit_period` |  |  |  | 혜택 기간 설정 해당 혜택이 적용되는 기간을 설정할지 여부 T : 사용함 · F : 사용안함 |
| `benefit_start_date` |  | 날짜 |  | 혜택 시작일 혜택이 적용되는 기간을 설정한 경우, 해당 혜택이 시작되는 일시 · 혜택 시작일을 수정하고자 하는 경우, use_benefit_period 파라미터를 반드시 선언해야 함 |
| `benefit_end_date` |  | 날짜 |  | 혜택 종료일 혜택이 적용되는 기간을 설정한 경우, 해당 혜택이 종료되는 일시 · 혜택 종료일을 수정하고자 하는 경우, use_benefit_period 파라미터를 반드시 선언해야 함 |
| `platform_types` |  |  |  | 혜택 사용범위 해당 혜택이 적용되는 범위 P : PC 쇼핑몰 · M : 모바일쇼핑몰 · A : 브랜드앱 |
| `use_group_binding` |  |  |  | 참여대상 설정 해당 혜택이 적용되는 대상을 설정 A : 회원 + 비회원 · N : 비회원 · M : 회원 |
| `customer_group_list` |  |  |  | 회원 등급 참여대상을 회원으로 설정한 경우, 참여가 가능한 회원등급을 설정 · 회원 등급을 수정하고자 하는 경우, use_group_binding 파라미터를 반드시 선언해야 함 |
| `product_binding_type` |  |  |  | 상품 범위 해당 혜택이 적용되는 상품의 범위 · 상품 범위가 P,E,C 인 경우 기존에 설정된 상품 또는 분류를 수정하고자 하는 경우 product_binding_type 파라미터를 반드시 선언해야 함 A : 전체상품 · P : 특정상품 · E : 제외상품 · C : 상품분류 |
| `use_except_category` |  |  |  | 상품분류 혜택제외 특정 상품분류에 대해 혜택 적용을 제외함 (각 유형별로 설정 가능여부가 다름) · 기간할인 : 전체상품, 특정상품인 경우 설정 가능 · 신규상품할인 : 전체상품인 경우 설정 가능 · 그 외 할인 및 증정유형에서는 설정 불가 · 기존에 설정된 제외 분류를 수정하고자 하는 경우, use_except_category 파라미터를 반드시 선언해야 함 T : 사용함 · F : 사용안함 |
| `available_coupon` |  |  |  | 쿠폰 사용범위 쿠폰이 있는 경우, 쿠폰을 중복하여 사용할 수 있는지 여부 T : 모든 쿠폰 사용가능 · F : 모든 쿠폰 사용제한 |
| `period_sale` |  |  |  | 기간 할인 설정 혜택의 상세유형이 기간 할인인 경우 그와 관련한 상세 설정 · 하위 요소가 입력되어야 정상적인 수정이 가능함 · 할인 금액(discount_value_unit)이 비율(P)인 경우 할인 반올림 단위(discount_truncation_unit), 할인 단위 처리(discount_truncation_method) 필수 입력 · 할인 금액(discount_value_unit)이 금액(W)인 경우 discount_purchasing_quantity 필수 입력 |
| ↳ `product_list` |  |  |  | 상품 목록 |
| ↳ `add_category_list` |  |  |  | 상품 분류 |
| ↳ `except_category_list` |  |  |  | 제외 분류 |
| ↳ `discount_purchasing_quantity` |  |  |  | 할인 구매수량 · T : 구매수량에 따라 · F : 구매수량에 관계없이 |
| ↳ `discount_value` |  |  |  | 할인 값 |
| ↳ `discount_value_unit` |  |  |  | 할인 기준 · P : 비율 · W : 금액 |
| ↳ `discount_truncation_unit` |  |  |  | 할인 반올림 단위 · F : 절사안함 · C : 0.01 · B : 0.1 · O : 1 · T : 10 · M : 100 · H : 1000 |
| ↳ `discount_truncation_method` |  |  |  | 할인 단위 처리 · L : 내림 · U : 반올림 · C : 올림 |
| `gift` |  |  |  | 사은품 설정 혜택의 상세유형이 사은품 증정인 경우 그와 관련한 상세 설정 · 하위 요소가 입력되어야 정상적인 수정이 가능함 |
| ↳ `product_list` |  |  |  | 상품 목록 |
| ↳ `add_category_list` |  |  |  | 상품 분류 |
| ↳ `offer_only_first` |  |  |  | 첫 구매 여부 · T : 사용함 · F : 사용안함 |
| ↳ `first_purchase_type` |  |  |  | 첫 구매 기준 · O : 주문기준 · D : 배송완료 기준 |
| ↳ `use_unlimited_price` |  |  |  | 최대가격 제한여부 · T : 사용함 · F : 사용안함 |
| ↳ `purchase_start_price` |  |  |  | 구매가격 제한 (n 이상) |
| ↳ `purchase_limit_price` |  |  |  | 구매가격 제한 (n 미만) |
| ↳ `gift_product_list` |  | Array |  |  |
| ↳ ↳ `product_no` |  |  |  | 상품번호 |
| ↳ ↳ `gift_point` |  |  |  | 차감 점수 |
| ↳ ↳ `max_count` |  |  |  | 최대 선택 수량 |
| `gift_product_bundle` |  |  |  | 1+N 이벤트 설정 혜택의 상세유형이 1+N 이벤트인 경우 그와 관련한 상세 설정 · 하위 요소가 입력되어야 정상적인 수정이 가능함 |
| ↳ `product_list` |  |  |  | 상품 목록 |
| ↳ `product_bundle_count` |  |  |  | 추가 상품 수량 |
| `new_product_sale` |  |  |  | 신규상품할인 설정 혜택의 상세유형이 신규상품 할인인 경우 그와 관련한 상세 설정 · 하위 요소가 입력되어야 정상적인 수정이 가능함 · 할인 금액(discount_value_unit)이 비율(P)인 경우 할인 반올림 단위(discount_truncation_unit), 할인 단위 처리(discount_truncation_method) 필수 입력 · 할인 금액(discount_value_unit)이 금액(W)인 경우 discount_purchasing_quantity 필수 입력 |
| ↳ `product_list` |  |  |  | 상품 목록 |
| ↳ `add_category_list` |  |  |  | 상품 분류 |
| ↳ `except_category_list` |  |  |  | 제외 분류 |
| ↳ `new_product_date_type` |  |  |  | 신상품 설정 기준일 · I : 상품 등록일 · U : 상품 최종 수정일 · V : 상품 최종 진열일 |
| ↳ `new_product_day` |  |  |  | 신상품 설정 값 |
| ↳ `new_product_term_type` |  |  |  | 신상품 설정 단위 · D : 일 · H : 시간 |
| ↳ `discount_purchasing_quantity` |  |  |  | 할인 구매수량 · T : 구매수량에 따라 · F : 구매수량에 관계없이 |
| ↳ `discount_value` |  |  |  | 할인 값 |
| ↳ `discount_value_unit` |  |  |  | 할인 기준 · P : 비율 · W : 금액 |
| ↳ `discount_truncation_unit` |  |  |  | 할인 반올림 단위 · F : 절사안함 · C : 0.01 · B : 0.1 · O : 1 · T : 10 · M : 100 · H : 1000 |
| ↳ `discount_truncation_method` |  |  |  | 할인 단위 처리 · L : 내림 · U : 반올림 · C : 올림 |
| `shipping_fee_sale` |  |  |  | 배송비 할인 설정 혜택의 상세유형이 배송비 할인인 경우 그와 관련한 상세 설정 · 하위 요소가 입력되어야 정상적인 수정이 가능함 |
| ↳ `product_list` |  |  |  | 상품 목록 |
| ↳ `use_purchase_price_condition` |  |  |  | 금액 기준 사용여부 · T : 사용함 · F : 사용안함 |
| ↳ `total_purchase_price` |  |  |  | 금액 제한 |
| ↳ `include_regional_shipping_rate` |  |  |  | 지역별배송비 포함여부값 · T : 포함 · F : 미포함 |
| `icon_url` |  |  |  | 아이콘 URL 혜택이 적용되는 상품명에 아이콘이 노출되도록 아이콘 등록 · (빈 값으로 요청 시, 기존에 등록된 아이콘 삭제됨) |

### `DELETE /api/v2/admin/benefits/{benefit_no}` — Delete a customer benefit

- **Scope**: `mall.write_promotion` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-customer-benefit

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호 |
| `benefit_no` | ✓ |  |  | 혜택번호 혜택이 생성된 경우 부여되는 고유 번호 |
