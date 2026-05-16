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
| `shipping_additionalfees_countries` | 국제 배송 추가비 국가 목록 | Retrieve a list of applicable countries for additional handling fee on international shipping | GET | `shipping/additionalfees/countries` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-applicable-countries-for-additional-handling-fee-on-international-shipping) |
| `shippingorigins_list` | 출고지 목록 조회 | Retrieve a list of shipping origins | GET | `shippingorigins` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-shipping-origins) |
| `shippingorigins_get` | 출고지 단건 조회 | Retrieve a shipping origin | GET | `shippingorigins/{origin_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-shipping-origin) |
| `shippingorigins_create` | 출고지 등록 | Create a shipping origin | POST | `shippingorigins` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-shipping-origin) |
| `shippingorigins_update` | 출고지 수정 | Update a shipping origin | PUT | `shippingorigins/{origin_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-shipping-origin) |
| `shippingorigins_delete` | 출고지 삭제 | Delete a shipping origin | DELETE | `shippingorigins/{origin_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-shipping-origin) |
