---
resource: shipping
entity: shipping
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#shipping
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Shipping / Shipping

> Field-level 카탈로그. Endpoint enumeration index: [`../shipping.md`](../shipping.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Shipping](https://developers.cafe24.com/docs/ko/api/admin/#shipping)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

배송(Shipping)은 쇼핑몰에 등록된 배송방법과 관련된 기능입니다. · 각각의 배송방법에 대한 상세 정보를 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `shipping_method` |  | 배송방법 shipping_01 : 택배 · shipping_02 : 빠른등기 · shipping_04 : 직접배송 · shipping_05 : 퀵배송 · shipping_06 : 기타 · shipping_07 : 화물배송 · shipping_08 : 매장직접수령 · shipping_09 : 배송필요 없음 · shipping_10 : 고객직접선택 |
| `shipping_etc` |  | 기타배송 |
| `shipping_type` |  | 국내/해외배송 설정 A : 국내배송 · C : 해외배송 · B : 국내/해외배송 |
| `international_shipping_fee_criteria` |  | 해외 배송비 기준 설정 B : 쇼핑몰 자체 배송비 · E : 자동 책정 배송비(EMS) |
| `shipping_place` |  | 배송지역 |
| `shipping_period` |  | 배송기간 |
| `shipping_fee_type` |  | 배송비타입 T : 배송비 무료 · R : 고정배송비 사용 · M : 구매 금액에 따른 부과 · D : 구매 금액별 차등 배송료 사용 · W : 상품 무게별 차등 배송료 사용 · C : 상품 수량별 차등 배송료 사용 · N : 상품 수량에 비례하여 배송료 부과 |
| `shipping_fee` | 최대값: [999999999] | 배송비 |
| `free_shipping_price` | 최대값: [99999999999999] | 배송비 무료 최소금액 배송비 설정 > 구매 금액에 따른 부과 일 경우 사용 |
| `shipping_fee_by_quantity` | 최대값: [999999999] | 상품 수량별 배송비 배송비 설정 > 상품 수량에 비례하여 배송료 부과 일 경우 사용 |
| `shipping_rates` |  | 배송비 상세 설정 |
| `shipping_fee_criteria` |  | 배송비 청구 기준 주문금액 조건 설정 D : 할인전 정상판매가격 기준(권장) · L : 최종 주문(결제)금액 기준 · A : 할인 적용 후 결제 금액 기준 · R : 최종 실 결제금액 기준 |
| `prepaid_shipping_fee` |  | 배송비 선결제 설정 C : 착불 · P : 선결제 · B : 착불/선결제 |
| `product_weight` |  | 상품중량 |
| `oversea_shipping_country` |  | 해외배송가능 국가 제한 여부 T : 제한함 · F : 제한안함 |
| `oversea_shipping_country_list` |  | 배송국가 |
| `country_shipping_fee` |  | 배송비 국가별 개별 설정 여부 T : 사용함 · F : 사용안함 |
| `country_shipping_fee_list` |  | 국가별 배송비 |
| `international_shipping_insurance` |  | 해외배송 보험료 T : 사용함 · F : 사용안함 |
| `return_address` |  | 반품주소 |
| `package_volume` |  | 배송규격 |
| `wished_delivery_date` |  | 희망배송일 |
| `wished_delivery_time` |  | 희망배송시간 |
| `hs_code` |  | HS코드 |
| `country_hs_code` |  | 국가별 HS 코드 |
| `individual_shipping_fee` |  | 상품별 개별배송비 설정 여부 T : 사용함 · F : 사용안함 |
| `individual_fee_calculation_type` |  | 개별배송비 계산 기준 P : 상품별 · I : 품목별 |
| `supplier_shipping_fee` |  | 공급사 배송비 사용 여부 T : 사용함 · F : 사용안함 |
| `supplier_selection` |  | 공급사 배송비 사용 범위 A : 전체 공급사 · P : 특정 공급사 |
| `applicable_suppliers` |  | 공급사 배송비 사용 공급사 |
| `supplier_shipping_calculation` |  | 공급사 배송비 계산 기준 A : 전체 상품금액 합계 · S : 대표운영자와 공급사 상품 별도 합계 |
| `supplier_regional_surcharge` |  | 공급사 지역별 배송비 A : 대표 운영자의 지역별 배송료를 부과 · S : 공급사 관리자 설정에 따라 부과 |
| `additional_shipping_fee` |  | 추가 배송비 설정 |
| `shipping_company_type` |  | 배송업체 선택 |
| `oversea_additional_fee` |  | 해외배송 부가금액 사용여부 T : 사용함 · F : 사용안함 |
| `oversea_additional_fee_list` |  | 해외배송 부가금액 적용국가 |

## Operations

### `GET /api/v2/admin/shipping` — Retrieve shipping / return settings

- **Scope**: `mall.read_shipping` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-shipping-return-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `shipping` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `shipping_method` |  | 배송방법 shipping_01 : 택배 · shipping_02 : 빠른등기 · shipping_04 : 직접배송 · shipping_05 : 퀵배송 · shipping_06 : 기타 · shipping_07 : 화물배송 · shipping_08 : 매장직접수령 · shipping_09 : 배송필요 없음 · shipping_10 : 고객직접선택 |
| ↳ `shipping_etc` |  | 기타배송 |
| ↳ `shipping_type` |  | 국내/해외배송 설정 A : 국내배송 · C : 해외배송 · B : 국내/해외배송 |
| ↳ `international_shipping_fee_criteria` |  | 해외 배송비 기준 설정 B : 쇼핑몰 자체 배송비 · E : 자동 책정 배송비(EMS) |
| ↳ `shipping_place` |  | 배송지역 |
| ↳ `shipping_period` |  | 배송기간 |
| ↳ ↳ `minimum` |  | 최소 기간 |
| ↳ ↳ `maximum` |  | 최대 기간 |
| ↳ `product_weight` |  | 상품중량 |
| ↳ `shipping_fee_type` |  | 배송비타입 T : 배송비 무료 · R : 고정배송비 사용 · M : 구매 금액에 따른 부과 · D : 구매 금액별 차등 배송료 사용 · W : 상품 무게별 차등 배송료 사용 · C : 상품 수량별 차등 배송료 사용 · N : 상품 수량에 비례하여 배송료 부과 |
| ↳ `shipping_fee` | 최대값: [999999999] | 배송비 |
| ↳ `free_shipping_price` | 최대값: [99999999999999] | 배송비 무료 최소금액 배송비 설정 > 구매 금액에 따른 부과 일 경우 사용 |
| ↳ `shipping_fee_by_quantity` | 최대값: [999999999] | 상품 수량별 배송비 배송비 설정 > 상품 수량에 비례하여 배송료 부과 일 경우 사용 |
| ↳ `shipping_rates` |  | 배송비 상세 설정 |
| ↳ ↳ `min_value` |  | 조건 최소값 |
| ↳ ↳ `max_value` |  | 조건 최대값 |
| ↳ ↳ `shipping_fee` | 최대값: [999999999] | 배송비 |
| ↳ `shipping_fee_criteria` |  | 배송비 청구 기준 주문금액 조건 설정 D : 할인전 정상판매가격 기준(권장) · L : 최종 주문(결제)금액 기준 · A : 할인 적용 후 결제 금액 기준 · R : 최종 실 결제금액 기준 |
| ↳ `prepaid_shipping_fee` |  | 배송비 선결제 설정 C : 착불 · P : 선결제 · B : 착불/선결제 |
| ↳ `oversea_shipping_country` |  | 해외배송가능 국가 제한 여부 T : 제한함 · F : 제한안함 |
| ↳ `oversea_shipping_country_list` |  | 배송국가 |
| ↳ ↳ `country_code` |  | 국가코드 |
| ↳ `country_shipping_fee` |  | 배송비 국가별 개별 설정 여부 T : 사용함 · F : 사용안함 |
| ↳ `country_shipping_fee_list` |  | 국가별 배송비 |
| ↳ ↳ `country_code` |  | 국가코드 |
| ↳ ↳ `conditional` |  | 배송비 책정 조건 · quantity : 수량 · weight : 무게 · price : 가격 |
| ↳ ↳ `min_value` |  | 조건 최소값 |
| ↳ ↳ `max_value` |  | 조건 최대값 |
| ↳ ↳ `shipping_fee` | 최대값: [999999999] | 배송비 |
| ↳ `international_shipping_insurance` |  | 해외배송 보험료 T : 사용함 · F : 사용안함 |
| ↳ `return_address` |  | 반품주소 |
| ↳ ↳ `zipcode` |  | 우편번호 |
| ↳ ↳ `ziptype` |  | 우편번호 선택 국가 |
| ↳ ↳ `address1` |  | 기본 주소 |
| ↳ ↳ `address2` |  | 상세 주소 |
| ↳ `package_volume` |  | 배송규격 |
| ↳ ↳ `width` |  | 가로 |
| ↳ ↳ `length` |  | 세로 |
| ↳ ↳ `height` |  | 높이 |
| ↳ `wished_delivery_date` |  | 희망배송일 |
| ↳ ↳ `use` |  |  |
| ↳ ↳ `range` |  | (응답 객체) |
| ↳ ↳ ↳ `minimum` |  | 최소 기간 |
| ↳ ↳ ↳ `maximum` |  | 최대 기간 |
| ↳ ↳ `default` |  | (응답 객체) |
| ↳ ↳ ↳ `minimum` |  | 최소 기간 |
| ↳ ↳ ↳ `use_fast_delivery` |  |  |
| ↳ `wished_delivery_time` |  | 희망배송시간 |
| ↳ ↳ `use` |  |  |
| ↳ ↳ `range` |  | (목록) |
| ↳ ↳ ↳ `start_hour` |  | 희망배송 시작시간 |
| ↳ ↳ ↳ `end_hour` |  | 희망배송 종료시간 |
| ↳ ↳ `default` |  | (응답 객체) |
| ↳ ↳ ↳ `range` |  | (응답 객체) |
| ↳ ↳ ↳ ↳ `start_hour` |  | 희망배송 시작시간 |
| ↳ ↳ ↳ ↳ `end_hour` |  | 희망배송 종료시간 |
| ↳ ↳ ↳ `use_fast_delivery` |  |  |
| ↳ `hs_code` |  | HS코드 |
| ↳ `country_hs_code` |  | 국가별 HS 코드 |
| ↳ ↳ `hs_code` |  | HS코드 |
| ↳ ↳ `country_code` |  | 국가코드 |
| ↳ `individual_shipping_fee` |  | 상품별 개별배송비 설정 여부 T : 사용함 · F : 사용안함 |
| ↳ `individual_fee_calculation_type` |  | 개별배송비 계산 기준 P : 상품별 · I : 품목별 |
| ↳ `supplier_shipping_fee` |  | 공급사 배송비 사용 여부 T : 사용함 · F : 사용안함 |
| ↳ `supplier_selection` |  | 공급사 배송비 사용 범위 A : 전체 공급사 · P : 특정 공급사 |
| ↳ `applicable_suppliers` |  | 공급사 배송비 사용 공급사 |
| ↳ ↳ `supplier_code` | 형식 : [A-Z0-9]; 글자수 최소: [8자]~최대: [8자] | 공급사 코드 |
| ↳ ↳ `supplier_id` | 형식 : [a-z0-9]; 글자수 최소: [4자]~최대: [16자] | 공급사 아이디 |
| ↳ `supplier_shipping_calculation` |  | 공급사 배송비 계산 기준 A : 전체 상품금액 합계 · S : 대표운영자와 공급사 상품 별도 합계 |
| ↳ `supplier_regional_surcharge` |  | 공급사 지역별 배송비 A : 대표 운영자의 지역별 배송료를 부과 · S : 공급사 관리자 설정에 따라 부과 |
| ↳ `additional_shipping_fee` |  | 추가 배송비 설정 |
| ↳ `shipping_company_type` |  | 배송업체 선택 |
| ↳ ↳ `carrier_id` |  | 배송사 아이디 |
| ↳ ↳ `is_selected` |  | 선택여부 · T: 선택 · F: 선택안함 |
| ↳ ↳ `shipping_carrier_code` |  | 배송사 코드 shipping_company_code |
| ↳ ↳ `shipping_type` |  | 국내/해외배송 설정 A : 국내배송 · C : 해외배송 · B : 국내/해외배송 |
| ↳ ↳ `shipping_carrier` |  | 배송사 명 |

응답 예시 (JSON):

```json
{
    "shipping": {
        "shop_no": 1,
        "shipping_method": "shipping_01",
        "shipping_etc": null,
        "shipping_type": "C",
        "international_shipping_fee_criteria": null,
        "shipping_place": null,
        "shipping_period": {
            "minimum": 3,
            "maximum": 7
        },
        "product_weight": "1.00",
        "shipping_fee_type": "D",
        "shipping_fee": null,
        "free_shipping_price": null,
        "shipping_fee_by_quantity": null,
        "shipping_rates": [
            {
                "min_value": "0.00",
                "max_value": "10000.00",
                "shipping_fee": "2500.00"
            },
            {
                "min_value": "10000.00",
                "max_value": "50000.00",
                "shipping_fee": "1000.00"
            }
        ],
        "shipping_fee_criteria": "D",
        "prepaid_shipping_fee": "P",
        "oversea_shipping_country": "T",
        "oversea_shipping_country_list": [
            {
                "country_code": "US"
            },
            {
                "country_code": "JP"
            }
        ],
        "country_shipping_fee": "T",
        "country_shipping_fee_list": [
            {
                "country_code": "US",
                "conditional": "price",
                "min_value": "1.00",
                "max_value": "1000.00",
                "shipping_fee": "1000.00"
            },
            {
                "country_code": "JP",
                "conditional": "quantity",
                "min_value": "1",
                "max_value": "3",
                "shipping_fee": "1000.00"
            }
        ],
        "international_shipping_insurance": "T",
        "return_address": {
            "zipcode": "07071",
            "ziptype": "KOR",
            "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
            "address2": "Professional Construction Hall"
        },
        "package_volume": {
            "width": "22",
            "length": "19",
            "height": "9"
        },
        "wished_delivery_date": {
            "use": "T",
            "range": {
                "minimum": 1,
                "maximum": 3
            },
            "default": {
                "minimum": null,
                "use_fast_delivery": "T"
            }
        },
        "wished_delivery_time": {
            "use": "T",
            "range": [
                {
                    "start_hour": "08",
                    "end_hour": "17"
                },
                {
                    "start_hour": "00",
                    "end_hour": "07"
                }
            ],
            "default": {
                "range": {
                    "start_hour": "08",
                    "end_hour": "17"
                },
                "use_fast_delivery": "F"
            }
        },
        "hs_code": "4203109010",
        "country_hs_code": [
            {
                "hs_code": "61102000",
                "country_code": "CHN"
            },
            {
                "hs_code": "392690010",
                "country_code": "JPN"
            }
        ],
        "individual_shipping_fee": "F",
        "individual_fee_calculation_type": null,
        "supplier_shipping_fee": "T",
        "supplier_selection": "P",
        "applicable_suppliers": [
            {
                "supplier_code": "S000000A",
                "supplier_id": "sampleid1"
            },
            {
                "supplier_code": "S000000B",
                "supplier_id": "sampleid2"
            }
        ],
        "supplier_shipping_calculation": "A",
        "supplier_regional_surcharge": "A",
        "additional_shipping_fee": null,
        "shipping_company_type": [
            {
                "carrier_id": 1,
                "is_selected": "F",
                "shipping_carrier_code": "0012",
                "shipping_type": "A",
                "shipping_carrier": "우체국택배"
            },
            {
                "carrier_id": 2,
                "is_selected": "F",
                "shipping_carrier_code": "0006",
                "shipping_type": "B",
                "shipping_carrier": "CJ대한통운"
            }
        ]
    }
}
```

### `PUT /api/v2/admin/shipping` — Update store shipping/return settings

- **Scope**: `mall.write_shipping` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-store-shipping-return-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `shipping_method` |  |  |  | 배송방법 shipping_01 : 택배 · shipping_02 : 빠른등기 · shipping_04 : 직접배송 · shipping_05 : 퀵배송 · shipping_06 : 기타 · shipping_07 : 화물배송 · shipping_08 : 매장직접수령 · shipping_09 : 배송필요 없음 · shipping_10 : 고객직접선택 |
| `shipping_etc` |  | 최대글자수 : [25자] |  | 기타배송 |
| `shipping_type` |  |  |  | 국내/해외배송 설정 A : 국내배송 · C : 해외배송 · B : 국내/해외배송 |
| `international_shipping_fee_criteria` |  |  |  | 해외 배송비 기준 설정 B : 쇼핑몰 자체 배송비 · E : 자동 책정 배송비(EMS) |
| `shipping_place` |  |  |  | 배송지역 |
| `shipping_period` |  |  |  | 배송기간 |
| ↳ `minimum` |  |  |  | 최소 기간 |
| ↳ `maximum` |  |  |  | 최대 기간 |
| `shipping_fee_type` |  |  |  | 배송비타입 T : 배송비 무료 · R : 고정배송비 사용 · M : 구매 금액에 따른 부과 · D : 구매 금액별 차등 배송료 사용 · W : 상품 무게별 차등 배송료 사용 · C : 상품 수량별 차등 배송료 사용 · N : 상품 수량에 비례하여 배송료 부과 |
| `shipping_fee` |  | 최대값: [999999999] |  | 배송비 |
| `free_shipping_price` |  | 최대값: [99999999999999] |  | 배송비 무료 최소금액 |
| `shipping_fee_by_quantity` |  | 최대값: [999999999] |  | 상품 수량별 배송비 |
| `shipping_rates` |  |  |  | 배송비 상세 설정 |
| ↳ `min_value` |  |  |  | 조건 최소값 |
| ↳ `max_value` |  |  |  | 조건 최대값 |
| ↳ `shipping_fee` |  |  |  | 배송비 |
| `shipping_fee_criteria` |  |  |  | 배송비 청구 기준 주문금액 조건 설정 D : 할인전 정상판매가격 기준(권장) · A : 할인 적용 후 결제 금액 기준 |
| `prepaid_shipping_fee` |  |  |  | 배송비 선결제 설정 EC 일본, 베트남, 필리핀 버전에서는 사용할 수 없음. C : 착불 · P : 선결제 · B : 착불/선결제 |
| `product_weight` |  | 최소값: [0]; 최대값: [30] |  | 상품중량 |
| `oversea_shipping_country` |  |  |  | 해외배송가능 국가 제한 여부 T : 제한함 · F : 제한안함 |
| `oversea_shipping_country_list` |  |  |  | 배송국가 |
| ↳ `country_code` |  |  |  | 국가코드 |
| `country_shipping_fee` |  |  |  | 배송비 국가별 개별 설정 여부 EC 일본, 베트남, 필리핀 버전에서는 사용할 수 없음. T : 사용함 · F : 사용안함 |
| `country_shipping_fee_list` |  |  |  | 국가별 배송비 EC 일본, 베트남, 필리핀 버전에서는 사용할 수 없음. |
| ↳ `country_code` |  |  |  | 국가코드 |
| ↳ `conditional` |  |  |  | 배송비 책정 조건 · quantity : 수량 · weight : 무게 · price : 가격 |
| ↳ `min_value` |  |  |  | 조건 최소값 |
| ↳ `max_value` |  |  |  | 조건 최대값 |
| ↳ `shipping_fee` |  |  |  | 배송비 |
| `international_shipping_insurance` |  |  |  | 해외배송 보험료 EC 한국 버전에서만 사용할 수 있음. T : 사용함 · F : 사용안함 |
| `return_address` |  |  |  | 반품주소 |
| ↳ `zipcode` |  |  |  | 우편번호 |
| ↳ `ziptype` |  |  |  | 우편번호 선택 국가 |
| ↳ `address1` |  |  |  | 기본 주소 |
| ↳ `address2` |  |  |  | 상세 주소 |
| `package_volume` |  |  |  | 배송규격 |
| ↳ `width` |  |  |  | 가로 |
| ↳ `length` |  |  |  | 세로 |
| ↳ `height` |  |  |  | 높이 |
| `individual_shipping_fee` |  |  |  | 상품별 개별배송비 설정 여부 T : 사용함 · F : 사용안함 |
| `individual_fee_calculation_type` |  |  |  | 개별배송비 계산 기준 P : 상품별 · I : 품목별 |
| `additional_shipping_fee` |  | 글자수 최소: [1자]~최대: [9자]; 최소: [0]~최대: [999999999] |  | 추가 배송비 설정 |
| `shipping_company_type` |  |  |  | 배송업체 선택 |
| ↳ `carrier_id` |  |  |  | 배송사 아이디 |
| ↳ `is_selected` |  |  |  | 선택여부 · T: 선택 · F: 선택안함 |
| `hs_code` |  | 최대글자수 : [20자] |  | HS코드 |
| `country_hs_code` |  | 배열 최대사이즈: [29] |  | 국가별 HS 코드 |
| `oversea_additional_fee` |  |  |  | 해외배송 부가금액 사용여부 T : 사용함 · F : 사용안함 |
| `oversea_additional_fee_list` |  | 배열 최대사이즈: [500] |  | 해외배송 부가금액 적용국가 |
| ↳ `country_code` |  |  |  | 국가코드 |
| ↳ `fee_name` |  |  |  | 부과금액 명칭 |
| ↳ `min_value` |  |  |  | 조건 최소값 |
| ↳ `max_value` |  |  |  | 조건 최대값 |
| ↳ `additional_fee` |  |  |  | 부가금액 |
| ↳ `unit` |  |  |  | 해외배송 부가금액 단위 · W : 정액 · P : 퍼센트 |
| ↳ `rounding_unit` |  |  |  | 절사단위 · F : 절사안함 · 0 : 1원단위 · 1 : 10원단위 · 2 : 100원단위 · 3 : 1000원단위 |
| ↳ `rounding_rule` |  |  |  | 절사 방법 · L : 내림 · U : 반올림 · C : 올림 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `shipping` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `shipping_method` |  | 배송방법 shipping_01 : 택배 · shipping_02 : 빠른등기 · shipping_04 : 직접배송 · shipping_05 : 퀵배송 · shipping_06 : 기타 · shipping_07 : 화물배송 · shipping_08 : 매장직접수령 · shipping_09 : 배송필요 없음 · shipping_10 : 고객직접선택 |
| ↳ `shipping_etc` |  | 기타배송 |
| ↳ `shipping_type` |  | 국내/해외배송 설정 A : 국내배송 · C : 해외배송 · B : 국내/해외배송 |
| ↳ `international_shipping_fee_criteria` |  | 해외 배송비 기준 설정 B : 쇼핑몰 자체 배송비 · E : 자동 책정 배송비(EMS) |
| ↳ `shipping_place` |  | 배송지역 |
| ↳ `shipping_period` |  | 배송기간 |
| ↳ ↳ `minimum` |  | 최소 기간 |
| ↳ ↳ `maximum` |  | 최대 기간 |
| ↳ `shipping_fee_type` |  | 배송비타입 T : 배송비 무료 · R : 고정배송비 사용 · M : 구매 금액에 따른 부과 · D : 구매 금액별 차등 배송료 사용 · W : 상품 무게별 차등 배송료 사용 · C : 상품 수량별 차등 배송료 사용 · N : 상품 수량에 비례하여 배송료 부과 |
| ↳ `shipping_rates` |  | 배송비 상세 설정 |
| ↳ ↳ `min_value` |  | 조건 최소값 |
| ↳ ↳ `max_value` |  | 조건 최대값 |
| ↳ ↳ `shipping_fee` | 최대값: [999999999] | 배송비 |
| ↳ `shipping_fee_criteria` |  | 배송비 청구 기준 주문금액 조건 설정 D : 할인전 정상판매가격 기준(권장) · L : 최종 주문(결제)금액 기준 · A : 할인 적용 후 결제 금액 기준 · R : 최종 실 결제금액 기준 |
| ↳ `product_weight` |  | 상품중량 |
| ↳ `oversea_shipping_country` |  | 해외배송가능 국가 제한 여부 T : 제한함 · F : 제한안함 |
| ↳ `oversea_shipping_country_list` |  | 배송국가 |
| ↳ ↳ `country_code` |  | 국가코드 |
| ↳ `country_shipping_fee` |  | 배송비 국가별 개별 설정 여부 T : 사용함 · F : 사용안함 |
| ↳ `country_shipping_fee_list` |  | 국가별 배송비 |
| ↳ ↳ `country_code` |  | 국가코드 |
| ↳ ↳ `conditional` |  | 배송비 책정 조건 · quantity : 수량 · weight : 무게 · price : 가격 |
| ↳ ↳ `min_value` |  | 조건 최소값 |
| ↳ ↳ `max_value` |  | 조건 최대값 |
| ↳ ↳ `shipping_fee` | 최대값: [999999999] | 배송비 |
| ↳ `international_shipping_insurance` |  | 해외배송 보험료 T : 사용함 · F : 사용안함 |
| ↳ `return_address` |  | 반품주소 |
| ↳ ↳ `zipcode` |  | 우편번호 |
| ↳ ↳ `ziptype` |  | 우편번호 선택 국가 |
| ↳ ↳ `address1` |  | 기본 주소 |
| ↳ ↳ `address2` |  | 상세 주소 |
| ↳ `package_volume` |  | 배송규격 |
| ↳ ↳ `width` |  | 가로 |
| ↳ ↳ `length` |  | 세로 |
| ↳ ↳ `height` |  | 높이 |
| ↳ `individual_shipping_fee` |  | 상품별 개별배송비 설정 여부 T : 사용함 · F : 사용안함 |
| ↳ `individual_fee_calculation_type` |  | 개별배송비 계산 기준 P : 상품별 · I : 품목별 |
| ↳ `additional_shipping_fee` |  | 추가 배송비 설정 |
| ↳ `shipping_company_type` |  | 배송업체 선택 |
| ↳ ↳ `carrier_id` |  | 배송사 아이디 |
| ↳ ↳ `is_selected` |  | 선택여부 · T: 선택 · F: 선택안함 |
| ↳ ↳ `shipping_carrier_code` |  | 배송사 코드 shipping_company_code |
| ↳ ↳ `shipping_type` |  | 국내/해외배송 설정 A : 국내배송 · C : 해외배송 · B : 국내/해외배송 |
| ↳ ↳ `shipping_carrier` |  | 배송사 명 |
| ↳ `hs_code` |  | HS코드 |
| ↳ `country_hs_code` |  | 국가별 HS 코드 |
| ↳ ↳ `hs_code` |  | HS코드 |
| ↳ ↳ `country_code` |  | 국가코드 |
| ↳ `oversea_additional_fee` |  | 해외배송 부가금액 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `oversea_additional_fee_list` |  | 해외배송 부가금액 적용국가 |
| ↳ ↳ `country_code` |  | 국가코드 |
| ↳ ↳ `fee_name` |  | 부과금액 명칭 |
| ↳ ↳ `min_value` |  | 조건 최소값 |
| ↳ ↳ `max_value` |  | 조건 최대값 |
| ↳ ↳ `additional_fee` |  | 부가금액 |
| ↳ ↳ `unit` |  | 해외배송 부가금액 단위 · W : 정액 · P : 퍼센트 |
| ↳ ↳ `rounding_unit` |  | 절사단위 · F : 절사안함 · 0 : 1원단위 · 1 : 10원단위 · 2 : 100원단위 · 3 : 1000원단위 |
| ↳ ↳ `rounding_rule` |  | 절사 방법 · L : 내림 · U : 반올림 · C : 올림 |

응답 예시 (JSON):

```json
{
    "shipping": {
        "shop_no": 1,
        "shipping_method": "shipping_01",
        "shipping_etc": null,
        "shipping_type": "C",
        "international_shipping_fee_criteria": "B",
        "shipping_place": null,
        "shipping_period": {
            "minimum": 5,
            "maximum": 12
        },
        "shipping_fee_type": "D",
        "shipping_rates": [
            {
                "min_value": "0.00",
                "max_value": "1000.00",
                "shipping_fee": "3000.00"
            },
            {
                "min_value": "1000.00",
                "max_value": "10000.00",
                "shipping_fee": "1500.00"
            }
        ],
        "shipping_fee_criteria": "D",
        "product_weight": "5.00",
        "oversea_shipping_country": "T",
        "oversea_shipping_country_list": [
            {
                "country_code": "US"
            },
            {
                "country_code": "JP"
            }
        ],
        "country_shipping_fee": "T",
        "country_shipping_fee_list": [
            {
                "country_code": "US",
                "conditional": "price",
                "min_value": "1.00",
                "max_value": "1000.00",
                "shipping_fee": "1000.00"
            },
            {
                "country_code": "JP",
                "conditional": "quantity",
                "min_value": "1",
                "max_value": "3",
                "shipping_fee": "1000.00"
            }
        ],
        "international_shipping_insurance": "T",
        "return_address": {
            "zipcode": "07071",
            "ziptype": "KOR",
            "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
            "address2": "Professional Construction Hall"
        },
        "package_volume": {
            "width": "22",
            "length": "19",
            "height": "9"
        },
        "individual_shipping_fee": "F",
        "individual_fee_calculation_type": null,
        "additional_shipping_fee": null,
        "shipping_company_type": [
            {
                "carrier_id": 1,
                "is_selected": "F",
                "shipping_carrier_code": "0012",
                "shipping_type": "A",
                "shipping_carrier": "우체국택배"
            },
            {
                "carrier_id": 2,
                "is_selected": "F",
                "shipping_carrier_code": "0006",
                "shipping_type": "B",
                "shipping_carrier": "CJ대한통운"
            }
        ],
        "hs_code": "4303101990",
        "country_hs_code": [
            {
                "hs_code": "430310011",
                "country_code": "JPN"
            },
            {
                "hs_code": "43031020",
                "country_code": "CHN"
            }
        ],
        "oversea_additional_fee": "T",
        "oversea_additional_fee_list": [
            {
                "country_code": "GH",
                "fee_name": "oversea_additional",
                "min_value": "0.00",
                "max_value": "500000.00",
                "additional_fee": "20000.00",
                "unit": "W",
                "rounding_unit": "F",
                "rounding_rule": "L"
            }
        ]
    }
}
```
