---
resource: shipping
entity: regionalsurcharges
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#regionalsurcharges
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Shipping / Regionalsurcharges

> Field-level 카탈로그. Endpoint enumeration index: [`../shipping.md`](../shipping.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Regionalsurcharges](https://developers.cafe24.com/docs/ko/api/admin/#regionalsurcharges)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

지역별 배송비(Suppliers users regionalsurcharges)를 통해 지역별 배송비를 설정하거나, 설정된 정보를 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `use_regional_surcharge` |  | 지역별 배송비 사용여부 T : 사용함 · F : 사용안함 |
| `region_setting_type` |  | 지역 설정 방식 A : 간편 설정 · N : 지명 설정 · Z : 우편번호 설정 |
| `regional_surcharge_list` |  | 지역별 배송비 목록 |
| `jeju_surcharge_amount` |  | 제주 추가 배송비 |
| `remote_area_surcharge_amount` |  | 도서산간 추가 배송비 |

## Operations

### `GET /api/v2/admin/regionalsurcharges` — Retrieve shipping zone rates settings

- **Scope**: `mall.read_shipping` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-shipping-zone-rates-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "regionalsurcharge": {
        "shop_no": 1,
        "use_regional_surcharge": "T",
        "region_setting_type": "Z",
        "regional_surcharge_list": [
            {
                "regional_surcharge_no": 1,
                "region_name": "Gyeonggi-do",
                "surcharge_region_name": null,
                "country_code": null,
                "start_zipcode": "11750",
                "end_zipcode": "11750",
                "regional_surcharge_amount": "2200.00"
            },
            {
                "regional_surcharge_no": 2,
                "region_name": "Seoul",
                "surcharge_region_name": null,
                "country_code": null,
                "start_zipcode": "05200",
                "end_zipcode": "05200",
                "regional_surcharge_amount": "1000.00"
            }
        ],
        "jeju_surcharge_amount": null,
        "remote_area_surcharge_amount": null
    }
}
```

### `PUT /api/v2/admin/regionalsurcharges` — Update regional surcharges

- **Scope**: `mall.write_shipping` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-regional-surcharges

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `use_regional_surcharge` |  |  |  | 지역별 배송비 사용여부 T : 사용함 · F : 사용안함 |
| `region_setting_type` |  |  |  | 지역 설정 방식 A : 간편 설정 · N : 지명 설정 · Z : 우편번호 설정 |
| `jeju_surcharge_amount` |  | 최소: [0]~최대: [999999999] |  | 제주 추가 배송비 |
| `remote_area_surcharge_amount` |  | 최소: [0]~최대: [999999999] |  | 도서산간 추가 배송비 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "regionalsurcharge": {
        "shop_no": 1,
        "use_regional_surcharge": "T",
        "region_setting_type": "A",
        "jeju_surcharge_amount": "0.00",
        "remote_area_surcharge_amount": "0.00"
    }
}
```
