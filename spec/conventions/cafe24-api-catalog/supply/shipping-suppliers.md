---
resource: supply
entity: shipping-suppliers
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#shipping-suppliers
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Supply / Shipping suppliers

> Field-level 카탈로그. Endpoint enumeration index: [`../supply.md`](../supply.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Shipping suppliers](https://developers.cafe24.com/docs/ko/api/admin/#shipping-suppliers)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

공급사 배송(Supplier Shipping)은 쇼핑몰의 각 공급사에 등록된 배송방법과 관련된 기능입니다. · 각각의 공급사에게 등록된 배송방법에 대한 정보를 조회하거나 수정할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `supplier_id` |  | 공급사 아이디 |
| `supplier_code` |  | 공급사 코드 |
| `shipping_method` |  | 배송방법 shipping_01 : 택배 · shipping_02 : 빠른등기 · shipping_04 : 직접배송 · shipping_05 : 퀵배송 · shipping_06 : 기타 · shipping_07 : 화물배송 · shipping_08 : 매장직접수령 · shipping_09 : 배송필요 없음 |
| `shipping_etc` | 최대글자수 : [25자] | 기타배송 배송방법(shipping_method)이 shipping_06(기타) 일 때 기타 배송 정보 |
| `shipping_type` |  | 국내/해외배송 설정 A : 국내배송 · C : 해외배송 · B : 국내/해외배송 |
| `shipping_place` | 최대글자수 : [127자] | 배송지역 |
| `shipping_start_date` | 최소값: [1]; 최대값: [100] | 배송기간 시작일 |
| `shipping_end_date` | 최소값: [1]; 최대값: [100] | 배송기간 종료일 |
| `shipping_fee_type` |  | 배송비타입 T : 배송비 무료 · R : 고정배송비 사용 · M : 구매 금액에 따른 부과 · D : 구매 금액별 차등 배송료 사용 · W : 상품 무게별 차등 배송료 사용 · C : 상품 수량별 차등 배송료 사용 · N : 상품 수량에 비례하여 배송료 부과 |
| `free_shipping_price` | 최소값: [0]; 최대값: [999999999] | 배송비 무료 최소금액 배송비타입(shipping_fee_type)이 "M(구매 금엑에 따른 부과)" 일 때 배송비를 무료로 만들기 위한 기준 금액 |
| `shipping_fee` | 최소값: [0]; 최대값: [999999999] | 배송비 배송비타입(shipping_fee_type)이 "R(고정배송비 사용)"이거나 "M(구매 금액에 따른 부과)"일 때 배송비 금액 |
| `shipping_fee_by_quantity` | 최소값: [0]; 최대값: [999999999] | 상품 수량별 배송비 배송비타입(shipping_fee_type)이 "N(상품 수량에 비례하여 배송료 부과)"일 때 수량별 배송비 금액 |
| `shipping_rates` | 배열 최대사이즈: [50] | 배송비 상세 설정 |
| `prepaid_shipping_fee` |  | 배송비 선결제 설정 C : 착불 · P : 선결제 · B : 착불/선결제 |
| `shipping_fee_by_product` |  | 상품별 개별 배송료 설정 T : 사용함 · F : 사용안함 |
| `product_weight` | 최소값: [0]; 최대값: [30] | 상품중량 |
| `hscode` | 최대글자수 : [20자] | HS코드 |
| `country_hscode` | 배열 최대사이즈: [50] | 국가별 HS 코드 |
| `oversea_shipping_country` |  | 해외배송가능 국가 제한 여부 T : 제한함 · F : 제한안함 |
| `oversea_shipping_country_list` |  | 배송국가 |

## Operations

### `GET /api/v2/admin/shipping/suppliers/{supplier_id}` — Retrieve a supplier's shipping settings

- **Scope**: `mall.read_supply` (read)
- **호출건수 제한**: 30
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-supplier-s-shipping-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `supplier_id` | ✓ |  |  | 공급사 아이디 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "supplier": {
        "shop_no": 1,
        "supplier_id": "sampleid",
        "supplier_code": "S000000A",
        "shipping_method": "shipping_01",
        "shipping_etc": null,
        "shipping_type": "B",
        "shipping_place": "A Region.",
        "shipping_start_date": 3,
        "shipping_end_date": 7,
        "shipping_fee_type": "C",
        "free_shipping_price": null,
        "shipping_fee": null,
        "shipping_fee_by_quantity": null,
        "shipping_rates": [
            {
                "shipping_rates_min": "0.00",
                "shipping_rates_max": "30000.00",
                "shipping_fee": "3000.00"
            },
            {
                "shipping_rates_min": "30000.00",
                "shipping_rates_max": "50000.00",
                "shipping_fee": "2500.00"
            }
        ],
        "prepaid_shipping_fee": "P",
        "shipping_fee_by_product": "T",
        "product_weight": "1.00",
        "hscode": "0101211000",
        "country_hscode": [
            {
                "country_code": "JPN",
                "hscode": "010121100"
            },
            {
                "country_code": "CHN",
                "hscode": "01022100"
            }
        ],
        "oversea_shipping_country": "T",
        "oversea_shipping_country_list": [
            {
                "country_code": "US"
            },
            {
                "country_code": "JPN"
            }
        ]
    }
}
```

### `PUT /api/v2/admin/shipping/suppliers/{supplier_id}` — Update a supplier's shipping settings

- **Scope**: `mall.write_supply` (write)
- **호출건수 제한**: 30
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-supplier-s-shipping-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `supplier_id` | ✓ |  |  | 공급사 아이디 |
| `shipping_method` |  |  |  | 배송방법 shipping_01 : 택배 · shipping_02 : 빠른등기 · shipping_04 : 직접배송 · shipping_05 : 퀵배송 · shipping_06 : 기타 · shipping_07 : 화물배송 · shipping_08 : 매장직접수령 · shipping_09 : 배송필요 없음 |
| `shipping_etc` |  | 최대글자수 : [25자] |  | 기타배송 배송방법(shipping_method)이 shipping_06(기타) 일 때 기타 배송 정보 |
| `shipping_type` |  |  |  | 국내/해외배송 설정 EC 베트남, 필리핀 버전에서는 사용할 수 없음. A : 국내배송 · C : 해외배송 · B : 국내/해외배송 |
| `shipping_place` |  | 최대글자수 : [127자] |  | 배송지역 |
| `shipping_start_date` |  | 최소값: [1]; 최대값: [100] |  | 배송기간 시작일 |
| `shipping_end_date` |  | 최소값: [1]; 최대값: [100] |  | 배송기간 종료일 |
| `shipping_fee_type` |  |  |  | 배송비타입 T : 배송비 무료 · R : 고정배송비 사용 · M : 구매 금액에 따른 부과 · D : 구매 금액별 차등 배송료 사용 · W : 상품 무게별 차등 배송료 사용 · C : 상품 수량별 차등 배송료 사용 · N : 상품 수량에 비례하여 배송료 부과 |
| `free_shipping_price` |  | 최소값: [0]; 최대값: [999999999] |  | 배송비 무료 최소금액 배송비타입(shipping_fee_type)이 "M(구매 금엑에 따른 부과)" 일 때 배송비를 무료로 만들기 위한 기준 금액 |
| `shipping_fee` |  | 최소값: [0]; 최대값: [999999999] |  | 배송비 배송비타입(shipping_fee_type)이 "R(고정배송비 사용)"이거나 "M(구매 금액에 따른 부과)"일 때 배송비 금액 |
| `shipping_fee_by_quantity` |  | 최소값: [0]; 최대값: [999999999] |  | 상품 수량별 배송비 배송비타입(shipping_fee_type)이 "N(상품 수량에 비례하여 배송료 부과)"일 때 수량별 배송비 금액 |
| `shipping_rates` |  | 배열 최대사이즈: [50] |  | 배송비 상세 설정 |
| ↳ `shipping_rates_min` |  |  |  | 배송비 - 배송비 부과 기준 하한값 |
| ↳ `shipping_rates_max` |  |  |  | 배송비 - 배송비 부과 기준 상한값 |
| ↳ `shipping_fee` |  |  |  | 배송비 |
| `prepaid_shipping_fee` |  |  |  | 배송비 선결제 설정 EC 베트남, 필리핀 버전에서는 사용할 수 없음. C : 착불 · P : 선결제 · B : 착불/선결제 |
| `shipping_fee_by_product` |  |  |  | 상품별 개별 배송료 설정 T : 사용함 · F : 사용안함 |
| `product_weight` |  | 최소값: [0]; 최대값: [30] |  | 상품중량 |
| `hscode` |  | 최대글자수 : [20자] |  | HS코드 |
| `country_hscode` |  | 배열 최대사이즈: [24] |  | 국가별 HS 코드 |
| ↳ `country_code` |  |  |  | 국가코드 |
| ↳ `hscode` |  |  |  | HS코드 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "supplier": {
        "shop_no": 1,
        "supplier_id": "sampleid",
        "supplier_code": "S000000A",
        "shipping_method": "shipping_01",
        "shipping_etc": null,
        "shipping_type": "B",
        "shipping_place": "A Region.",
        "shipping_start_date": 3,
        "shipping_end_date": 7,
        "shipping_fee_type": "D",
        "free_shipping_price": null,
        "shipping_fee": null,
        "shipping_fee_by_quantity": null,
        "shipping_rates": [
            {
                "shipping_rates_min": "0.00",
                "shipping_rates_max": "30000.00",
                "shipping_fee": "3000.00"
            },
            {
                "shipping_rates_min": "30000.00",
                "shipping_rates_max": "50000.00",
                "shipping_fee": "2500.00"
            }
        ],
        "prepaid_shipping_fee": "P",
        "shipping_fee_by_product": "T",
        "product_weight": "1.00",
        "hscode": "0101211000",
        "country_hscode": [
            {
                "country_code": "JPN",
                "hscode": "010121100"
            },
            {
                "country_code": "CHN",
                "hscode": "01022100"
            }
        ]
    }
}
```
