---
id: shipping
status: implemented
code:
  - codebase/backend/src/nodes/integration/cafe24/metadata/shipping.ts
---

# Cafe24 API Catalog — Shipping (배송)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `shipping_companies_list` | 배송사 목록 조회 | Retrieve a list of shipping carriers | GET | `shippingcompanies` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-shipping-carriers) |
| `carriers_get` | 배송사 단건 조회 | Retrieve a shipping carrier | GET | `carriers/{carrier_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-shipping-carrier) |
| `carriers_create` | 배송사 등록 | Create a shipping carrier | POST | `carriers` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-shipping-carrier) |
| `carriers_update` | 배송사 수정 | Update a shipping carrier | PUT | `carriers/{carrier_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-shipping-carrier) |
| `carriers_delete` | 배송사 삭제 | Delete a shipping carrier | DELETE | `carriers/{carrier_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-shipping-carrier) |
| `regionalsurcharges_get` | 지역별 배송비 조회 | Retrieve shipping zone rates settings | GET | `regionalsurcharges` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-shipping-zone-rates-settings) |
| `regionalsurcharges_update` | 지역별 배송비 수정 | Update regional surcharges | PUT | `regionalsurcharges` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-regional-surcharges) |
| `shipping_settings_get` | 배송·반품 설정 조회 | Retrieve shipping return settings | GET | `shipping` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-shipping-return-settings) |
| `shipping_settings_update` | 배송·반품 설정 수정 | Update store shipping return settings | PUT | `shipping` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-store-shipping-return-settings) |
| `shipping_additionalfees_countries` | 국제 배송 추가비 국가 목록 | Retrieve a list of applicable countries for additional handling fee on international shipping | GET | `shipping/additionalfees` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-applicable-countries-for-additional-handling-fee-on-international-shipping) |
| `shippingorigins_list` | 출고지 목록 조회 | Retrieve a list of shipping origins | GET | `shippingorigins` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-shipping-origins) |
| `shippingorigins_get` | 출고지 단건 조회 | Retrieve a shipping origin | GET | `shippingorigins/{origin_code}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-shipping-origin) |
| `shippingorigins_create` | 출고지 등록 | Create a shipping origin | POST | `shippingorigins` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-shipping-origin) |
| `shippingorigins_update` | 출고지 수정 | Update a shipping origin | PUT | `shippingorigins/{origin_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-shipping-origin) |
| `shippingorigins_delete` | 출고지 삭제 | Delete a shipping origin | DELETE | `shippingorigins/{origin_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-shipping-origin) |

## Field-level 상세 카탈로그

> 각 sub-resource 의 **응답 속성(field) + operation 요청 파라미터**를 Cafe24 공식 docs 기준으로 담은 상세 카탈로그. 위 표가 endpoint enumeration index 라면, 아래는 field-level 본문이다. 출처: Cafe24 REST API Documentation (admin), 2026-06-03 download.

- [`shipping/carriers.md`](./shipping/carriers.md) · Carriers — 16 fields, 5 ops
- [`shipping/regionalsurcharges.md`](./shipping/regionalsurcharges.md) · Regionalsurcharges — 6 fields, 2 ops
- [`shipping/shipping.md`](./shipping/shipping.md) · Shipping — 37 fields, 2 ops
- [`shipping/shipping-additionalfees.md`](./shipping/shipping-additionalfees.md) · Shipping additionalfees — 10 fields, 1 ops
- [`shipping/shippingorigins.md`](./shipping/shippingorigins.md) · Shippingorigins — 10 fields, 5 ops
