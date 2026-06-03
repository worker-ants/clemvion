---
resource: shipping
entity: carriers
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#carriers
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Shipping / Carriers

> Field-level 카탈로그. Endpoint enumeration index: [`../shipping.md`](../shipping.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Carriers](https://developers.cafe24.com/docs/ko/api/admin/#carriers)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

배송사(Carriers)는 쇼핑몰로부터 쇼핑몰 고객에게까지 상품을 배송하는 주체입니다. · 배송사를 등록하면 쇼핑몰에서 배송처리시 해당 배송사를 선택하여 배송 처리를 진행할 수 있습니다. · 배송사 리소스에서는 현재 등록되어있는 배송사를 조회하고 배송사를 생성, 수정, 삭제처리할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `carrier_id` |  | 배송사 아이디 |
| `shipping_carrier_code` |  | 배송사 코드 shipping_company_code |
| `shipping_carrier` |  | 배송사 명 |
| `track_shipment_url` |  | 배송추적 URL |
| `shipping_type` |  | 국내/해외배송 설정 A : 국내 · B : 국내/해외 · C : 해외 · F : 설정안함 |
| `contact` |  | 대표 연락처 |
| `secondary_contact` |  | 보조 연락처 |
| `email` |  | 이메일 |
| `default_shipping_fee` |  | 기본 배송비 |
| `homepage_url` |  | 홈페이지 주소 |
| `default_shipping_carrier` |  | 기본배송사 여부 T : 사용함 · F : 사용안함 |
| `shipping_fee_setting` |  | 배송비 설정 여부 T : 사용함 · F : 사용안함 |
| `shipping_fee_setting_detail` |  | 배송비 설정 데이터 |
| `express_exception_setting` |  | 연동택배 예외정보 설정 |
| `links` |  | link |

## Operations

### `GET /api/v2/admin/carriers` — Retrieve a list of shipping carriers

- **Scope**: `mall.read_shipping` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-shipping-carriers

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |

### `GET /api/v2/admin/carriers/{carrier_id}` — Retrieve a shipping carrier

- **Scope**: `mall.read_shipping` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-shipping-carrier

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `carrier_id` | ✓ |  |  | 배송업체 아이디 |

### `POST /api/v2/admin/carriers` — Create a shipping carrier

- **Scope**: `mall.write_shipping` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-shipping-carrier

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `shipping_carrier_code` | ✓ |  |  | 배송사 코드 shipping_company_code |
| `contact` | ✓ | 최대글자수 : [16자] |  | 대표 연락처 |
| `email` | ✓ | 이메일; 최대글자수 : [255자] |  | 이메일 |
| `shipping_carrier` |  | 최대글자수 : [80자] |  | 배송사 명 |
| `track_shipment_url` |  | 최대글자수 : [255자] |  | 배송추적 URL |
| `secondary_contact` |  | 최대글자수 : [16자] |  | 보조 연락처 Youtube shopping 이용 시에는 미제공 |
| `default_shipping_fee` |  |  |  | 기본 배송비 |
| `homepage_url` |  | 최대글자수 : [255자] |  | 홈페이지 주소 Youtube shopping 이용 시에는 미제공 |
| `shipping_fee_setting` |  |  | F | 배송비 설정 여부 T : 사용함 · F : 사용안함 |
| `shipping_fee_setting_detail` |  |  |  | 배송비 설정 데이터 ※shipping_fee_setting_detail의 하위요소에 대한 값 정의 · 1)shipping_fee_setting_domestic > shipping_fee_type · shipping_fee_type(배송비 설정) · T : 배송비 무료 · R : 고정배송비 사용 · M : 구매 금액에 따른 부과 · D : 구매 금액별 차등 배송료 사용 · W : 상품 무게별 차등 배송료 사용 · C : 상품 수량별 차등 배송료 사용 · N : 상품 수량에 비례하여 배송료 부과 · 2)shipping_fee_setting_domestic > shipping_fee_criteria · shipping_fee_criteria(배송비 청구 기준 주문금액 조건 설정) · D : 할인전, 정상판매가격 기준(권장) · A : 할인 적용 후 결제 금액 기준 · 3)shipping_fee_setting_oversea > additional_handling_fee_list > unit · unit(해외배송 부가금액 단위) · W : 정액 · P : 퍼센트 · 4)shipping_fee_setting_oversea > additional_handling_fee_list > rounding_unit · rounding_unit(해외배송 부가금액 절사단위) · F : 절사안함 · 0 : 1단위 · 1 : 10단위 · 2 : 100단위 · 3 : 1000단위 · 5)shipping_fee_setting_oversea > additional_handling_fee_list > rounding_rule · rounding_rule(해외배송 부가금액 절사방식) · L : 내림 · U : 반올림 · C : 올림 |
| ↳ `shipping_type` |  |  |  | 국내/해외배송 설정 · A : 국내 · B : 국내/해외 · C : 해외 · DEFAULT B |
| ↳ `available_shipping_zone` |  |  |  | 배송가능 지역 |
| ↳ `min_shipping_period` |  |  |  | 배송가능 최소일 |
| ↳ `max_shipping_period` |  |  |  | 배송가능 최대일 |
| ↳ `shipping_information` |  |  |  | 주문서 배송안내 |
| ↳ `shipping_fee_setting_domestic` |  | Array |  |  |
| ↳ ↳ `shipping_fee_type` |  |  |  | 배송비 설정 |
| ↳ ↳ `shipping_fee` |  |  |  | 배송비 |
| ↳ ↳ `min_price` |  |  |  | 미만 조건금액 |
| ↳ ↳ `use_product_category` |  |  |  | 선택 상품분류 적용 |
| ↳ ↳ `product_category_list` |  | Array |  |  |
| ↳ ↳ ↳ `category_no` |  |  |  | 카테고리 번호 |
| ↳ ↳ `shipping_fee_criteria` |  |  |  | 배송비 청구 기준 주문금액 조건 설정 |
| ↳ ↳ `domestic_shipping_fee_list` |  | Array |  |  |
| ↳ ↳ ↳ `min_value` |  |  |  | 구간 금액 min |
| ↳ ↳ ↳ `max_value` |  |  |  | 구간 금액 max |
| ↳ ↳ ↳ `shipping_fee` |  |  |  | 배송비 |
| ↳ ↳ `available_shipping_zone` |  |  |  | 배송가능 지역 설정 여부 |
| ↳ ↳ `available_shipping_zone_list` |  | Array |  |  |
| ↳ ↳ ↳ `region` |  |  |  | 배송가능지역 명 |
| ↳ ↳ ↳ `start_zipcode` |  |  |  | 시작 우편번호 |
| ↳ ↳ ↳ `end_zipcode` |  |  |  | 끝 우편번호 |
| ↳ ↳ `available_order_time` |  |  |  | 주문가능 시간 설정 |
| ↳ ↳ `start_time` |  |  |  | 주문가능 시작 시간 |
| ↳ ↳ `end_time` |  |  |  | 주문가능 마감 시간 |
| ↳ `shipping_fee_setting_oversea` |  | Array |  |  |
| ↳ ↳ `shipping_fee_criteria` |  |  |  | 배송비 청구 기준 주문금액 조건 설정 |
| ↳ ↳ `shipping_country_list` |  | Array |  |  |
| ↳ ↳ ↳ `country_code` |  |  |  | 국가코드 |
| ↳ ↳ `country_shipping_fee_list` |  | Array |  |  |
| ↳ ↳ ↳ `country_code` |  |  |  | 국가코드 |
| ↳ ↳ ↳ `conditional` |  |  |  | 구간 조건 |
| ↳ ↳ ↳ `min_value` |  |  |  | 구간 금액 min |
| ↳ ↳ ↳ `max_value` |  |  |  | 구간 금액 max |
| ↳ ↳ ↳ `shipping_fee` |  |  |  | 배송비 |
| ↳ ↳ `additional_handling_fee` |  |  |  | 해외배송 부가금액 여부 |
| ↳ ↳ `additional_handling_fee_list` |  | Array |  |  |
| ↳ ↳ ↳ `country_code` |  |  |  | 국가코드 |
| ↳ ↳ ↳ `text` |  |  |  | 부과금액 명칭 |
| ↳ ↳ ↳ `min_value` |  |  |  | 구간 금액 min |
| ↳ ↳ ↳ `max_value` |  |  |  | 구간 금액 max |
| ↳ ↳ ↳ `additional_handling_fee` |  |  |  | 해외배송 부가금액 |
| ↳ ↳ ↳ `unit` |  |  |  | 해외배송 부가금액 단위 |
| ↳ ↳ ↳ `rounding_unit` |  |  |  | 절사단위 |
| ↳ ↳ ↳ `rounding_rule` |  |  |  | 절사 방법 |
| ↳ ↳ `maximum_quantity` |  |  |  | 총 구매수량 제한 |
| ↳ ↳ `product_category_limit` |  |  |  | 상품분류 제한 여부 |
| ↳ ↳ `product_category_limit_list` |  | Array |  |  |
| ↳ ↳ ↳ `category_no` |  |  |  | 카테고리 번호 |
| ↳ ↳ ↳ `product_maximum_quantity` |  |  |  | 상품분류별 구매수량 제한 |

### `PUT /api/v2/admin/carriers/{carrier_id}` — Update a shipping carrier

- **Scope**: `mall.write_shipping` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-shipping-carrier

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `carrier_id` | ✓ |  |  | 배송사 아이디 |
| `default_shipping_carrier` |  |  | T | 기본배송사 여부 T : 사용함 · F : 사용안함 |

### `DELETE /api/v2/admin/carriers/{carrier_id}` — Delete a shipping carrier

- **Scope**: `mall.write_shipping` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-shipping-carrier

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `carrier_id` | ✓ |  |  | 배송사 아이디 |
| `delete_default_carrier` |  |  | F | 기본배송사 삭제 여부 T : 삭제함 · F : 삭제안함 |
