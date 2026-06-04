---
resource: supply
entity: suppliers-users__regionalsurcharges
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#suppliers-users--regionalsurcharges
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Supply / Suppliers users regionalsurcharges

> Field-level 카탈로그. Endpoint enumeration index: [`../supply.md`](../supply.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Suppliers users regionalsurcharges](https://developers.cafe24.com/docs/ko/api/admin/#suppliers-users--regionalsurcharges)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

공급사 지역별 배송비(Suppliers users regionalsurcharges)를 통해 공급사별로 지역별 배송비를 설정하거나, 설정된 정보를 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `regional_surcharge_no` |  | 지역별 배송비 등록 번호 |
| `supplier_id` | 최대글자수 : [20자] | 공급사 아이디 |
| `country_code` | 최대글자수 : [2자] | 국가코드 KR : 대한민국 · JP : 일본 · VN : 베트남 |
| `region_name` | 최대글자수 : [255자] | 특수지역명 |
| `surcharge_region_name` | 최대글자수 : [300자] | 지역명 추가배송비를 부과할 지역이름 · 지역 설정방식(region_setting_type)이 'N'으로 설정 되어있는 경우 필수 입력 |
| `start_zipcode` | 최대글자수 : [8자] | 시작 우편번호 지역 설정 방식(region_setting_type)이 'Z'로 설정 되어있는 경우 필수 입력 |
| `end_zipcode` | 최대글자수 : [8자] | 끝 우편번호 지역 설정 방식(region_setting_type)이 'Z'로 설정 되어있는 경우 필수 입력 |
| `regional_surcharge_amount` | 최소: [1]~최대: [999999999] | 지역 추가 배송비 부과할 추가배송비 금액 |
| `use_regional_surcharge` |  | 지역별 배송비 사용여부 T : 사용함 · F : 사용안함 |

## Operations

### `GET /api/v2/admin/suppliers/users/{supplier_id}/regionalsurcharges` — Retrieve a supplier user's list of regional shipping fees

- **Scope**: `mall.read_supply` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-supplier-user-s-list-of-regional-shipping-fees

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `supplier_id` | ✓ | 최대글자수 : [20자] |  | 공급사 아이디 |
| `offset` |  | 최대값: [10000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `regionalsurcharges` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `regional_surcharge_no` |  | 지역별 배송비 등록 번호 |
| ↳ `supplier_id` | 최대글자수 : [20자] | 공급사 아이디 |
| ↳ `country_code` | 최대글자수 : [2자] | 국가코드 KR : 대한민국 · JP : 일본 · VN : 베트남 |
| ↳ `region_name` | 최대글자수 : [255자] | 특수지역명 |
| ↳ `surcharge_region_name` | 최대글자수 : [300자] | 지역명 추가배송비를 부과할 지역이름 · 지역 설정방식(region_setting_type)이 'N'으로 설정 되어있는 경우 필수 입력 |
| ↳ `start_zipcode` | 최대글자수 : [8자] | 시작 우편번호 지역 설정 방식(region_setting_type)이 'Z'로 설정 되어있는 경우 필수 입력 |
| ↳ `end_zipcode` | 최대글자수 : [8자] | 끝 우편번호 지역 설정 방식(region_setting_type)이 'Z'로 설정 되어있는 경우 필수 입력 |
| ↳ `regional_surcharge_amount` | 최소: [1]~최대: [999999999] | 지역 추가 배송비 부과할 추가배송비 금액 |

응답 예시 (JSON):

```json
{
    "regionalsurcharges": [
        {
            "shop_no": 1,
            "regional_surcharge_no": 2,
            "supplier_id": "sampleid",
            "country_code": "KR",
            "region_name": "Korea",
            "surcharge_region_name": null,
            "start_zipcode": "63000",
            "end_zipcode": "63644",
            "regional_surcharge_amount": "6000.00"
        },
        {
            "shop_no": 1,
            "regional_surcharge_no": 3,
            "supplier_id": "sampleid",
            "country_code": "KR",
            "region_name": "Korea",
            "surcharge_region_name": null,
            "start_zipcode": "40200",
            "end_zipcode": "40240",
            "regional_surcharge_amount": "5000.00"
        }
    ]
}
```

### `POST /api/v2/admin/suppliers/users/{supplier_id}/regionalsurcharges` — Create regional shipping fee for a supplier user

- **Scope**: `mall.write_supply` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-regional-shipping-fee-for-a-supplier-user

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `supplier_id` | ✓ | 최대글자수 : [20자] |  | 공급사 아이디 |
| `country_code` |  | 최대글자수 : [2자] |  | 국가코드 EC 한국, 일본, 베트남, 필리핀 버전에서는 사용할 수 없음. KR : 대한민국 · JP : 일본 · VN : 베트남 |
| `region_name` | ✓ | 최대글자수 : [255자] |  | 특수지역명 |
| `use_regional_surcharge` | ✓ |  |  | 지역별 배송비 사용여부 T : 사용함 · F : 사용안함 |
| `surcharge_region_name` |  | 최대글자수 : [300자] |  | 지역명 |
| `start_zipcode` |  | 최대글자수 : [8자] |  | 시작 우편번호 |
| `end_zipcode` |  | 최대글자수 : [8자] |  | 끝 우편번호 |
| `regional_surcharge_amount` | ✓ | 최소: [1]~최대: [999999999] |  | 지역 추가 배송비 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `regionalsurcharge` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `regional_surcharge_no` |  | 지역별 배송비 등록 번호 |
| ↳ `supplier_id` | 최대글자수 : [20자] | 공급사 아이디 |
| ↳ `county_code` |  |  |
| ↳ `region_name` | 최대글자수 : [255자] | 특수지역명 |
| ↳ `use_regional_surcharge` |  | 지역별 배송비 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `surcharge_region_name` | 최대글자수 : [300자] | 지역명 추가배송비를 부과할 지역이름 · 지역 설정방식(region_setting_type)이 'N'으로 설정 되어있는 경우 필수 입력 |
| ↳ `start_zipcode` | 최대글자수 : [8자] | 시작 우편번호 지역 설정 방식(region_setting_type)이 'Z'로 설정 되어있는 경우 필수 입력 |
| ↳ `end_zipcode` | 최대글자수 : [8자] | 끝 우편번호 지역 설정 방식(region_setting_type)이 'Z'로 설정 되어있는 경우 필수 입력 |
| ↳ `regional_surcharge_amount` | 최소: [1]~최대: [999999999] | 지역 추가 배송비 부과할 추가배송비 금액 |

응답 예시 (JSON):

```json
{
    "regionalsurcharge": {
        "shop_no": 1,
        "regional_surcharge_no": 4,
        "supplier_id": "sampleid",
        "county_code": "KR",
        "region_name": "Korea",
        "use_regional_surcharge": "T",
        "surcharge_region_name": null,
        "start_zipcode": "63000",
        "end_zipcode": "63644",
        "regional_surcharge_amount": "6000.00"
    }
}
```

### `DELETE /api/v2/admin/suppliers/users/{supplier_id}/regionalsurcharges/{regional_surcharge_no}` — Delete supplier user's regional shipping fee settings

- **Scope**: `mall.write_supply` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-supplier-user-s-regional-shipping-fee-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `supplier_id` | ✓ | 최대글자수 : [20자] |  | 공급사 아이디 |
| `regional_surcharge_no` | ✓ |  |  | 지역별 배송비 등록 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `regionalsurcharge` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `supplier_id` | 최대글자수 : [20자] | 공급사 아이디 |
| ↳ `regional_surcharge_no` |  | 지역별 배송비 등록 번호 |

응답 예시 (JSON):

```json
{
    "regionalsurcharge": {
        "shop_no": 1,
        "supplier_id": "sampleid",
        "regional_surcharge_no": 4
    }
}
```
