---
resource: supply
entity: suppliers-users__regionalsurcharges-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#suppliers-users--regionalsurcharges-setting
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Supply / Suppliers users regionalsurcharges setting

> Field-level 카탈로그. Endpoint enumeration index: [`../supply.md`](../supply.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Suppliers users regionalsurcharges setting](https://developers.cafe24.com/docs/ko/api/admin/#suppliers-users--regionalsurcharges-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

공급사 지역별 배송비 설정(Suppliers users regionalsurcharges setting)을 통해 공급사별로 지역별 배송비를 설정값을 조회하거나 수정할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `supplier_id` | 최대글자수 : [20자] | 공급사 아이디 |
| `use_regional_surcharge` |  | 지역별 배송비 사용여부 T : 사용함 · F : 사용안함 |
| `region_setting_type` |  | 지역 설정 방식 A : 간편 설정 · N : 지명 설정 · Z : 우편번호 설정 |
| `jeju_surcharge_amount` | 최소: [0]~최대: [999999999] | 제주 추가 배송비 |
| `remote_area_surcharge_amount` | 최소: [0]~최대: [999999999] | 도서산간 추가 배송비 |

## Operations

### `GET /api/v2/admin/suppliers/users/{supplier_id}/regionalsurcharges/setting` — Retrieve a supplier user's regional shipping fee settings

- **Scope**: `mall.read_supply` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-supplier-user-s-regional-shipping-fee-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `supplier_id` | ✓ | 최대글자수 : [20자] |  | 공급사 아이디 |

### `PUT /api/v2/admin/suppliers/users/{supplier_id}/regionalsurcharges/setting` — Update a supplier user's regional shipping fee settings

- **Scope**: `mall.write_supply` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-supplier-user-s-regional-shipping-fee-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `supplier_id` | ✓ | 최대글자수 : [20자] |  | 공급사 아이디 |
| `use_regional_surcharge` | ✓ |  |  | 지역별 배송비 사용여부 T : 사용함 · F : 사용안함 |
| `region_setting_type` | ✓ |  |  | 지역 설정 방식 A : 간편 설정 · N : 지명 설정 · Z : 우편번호 설정 |
| `jeju_surcharge_amount` |  | 최소: [0]~최대: [999999999] |  | 제주 추가 배송비 |
| `remote_area_surcharge_amount` |  | 최소: [0]~최대: [999999999] |  | 도서산간 추가 배송비 |
