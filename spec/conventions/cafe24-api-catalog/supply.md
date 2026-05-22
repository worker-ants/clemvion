# Cafe24 API Catalog — Supply (공급사)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `suppliers_list` | 공급사 목록 조회 | Retrieve a list of suppliers | GET | `suppliers` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-suppliers) |
| `suppliers_count` | 공급사 개수 조회 | Retrieve a count of suppliers | GET | `suppliers/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-suppliers) |
| `suppliers_get` | 공급사 단건 조회 | Retrieve a supplier | GET | `suppliers/{supplier_code}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-supplier) |
| `suppliers_create` | 공급사 등록 | Create a supplier | POST | `suppliers` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-supplier) |
| `suppliers_update` | 공급사 수정 | Update a supplier | PUT | `suppliers/{supplier_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-supplier) |
| `suppliers_delete` | 공급사 삭제 | Delete a supplier | DELETE | `suppliers/{supplier_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-supplier) |
| `suppliers_users_list` | 공급사 사용자 목록 | Retrieve a list of supplier users | GET | `suppliers/users` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-supplier-users) |
| `suppliers_users_count` | 공급사 사용자 수 | Retrieve a count of supplier users | GET | `suppliers/users/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-supplier-users) |
| `suppliers_users_get` | 공급사 사용자 단건 조회 | Retrieve supplier user details | GET | `suppliers/users/{user_id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-supplier-user-details) |
| `suppliers_users_create` | 공급사 사용자 등록 | Create a supplier user | POST | `suppliers/users` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-supplier-user) |
| `suppliers_users_update` | 공급사 사용자 수정 | Update a supplier user | PUT | `suppliers/users/{user_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-supplier-user) |
| `suppliers_users_delete` | 공급사 사용자 삭제 | Delete a supplier user | DELETE | `suppliers/users/{user_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-supplier-user) |
| `suppliers_users_regional_list` | 사용자 지역별 배송비 목록 | Retrieve a supplier user's list of regional shipping fees | GET | `suppliers/users/{supplier_id}/regionalsurcharges` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-supplier-user-s-list-of-regional-shipping-fees) |
| `suppliers_users_regional_create` | 사용자 지역별 배송비 등록 | Create regional shipping fee for a supplier user | POST | `suppliers/users/{supplier_id}/regionalsurcharges` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-regional-shipping-fee-for-a-supplier-user) |
| `suppliers_users_regional_delete` | 사용자 지역별 배송비 삭제 | Delete supplier user's regional shipping fee settings | DELETE | `suppliers/users/{supplier_id}/regionalsurcharges/{regional_surcharge_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-supplier-user-s-regional-shipping-fee-settings) |
| `suppliers_users_regional_settings_get` | 지역별 배송비 설정 조회 | Retrieve a supplier user's regional shipping fee settings | GET | `suppliers/users/{supplier_id}/regionalsurcharges/setting` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-supplier-user-s-regional-shipping-fee-settings) |
| `suppliers_users_regional_settings_update` | 지역별 배송비 설정 수정 | Update a supplier user's regional shipping fee settings | PUT | `suppliers/users/{supplier_id}/regionalsurcharges/setting` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-supplier-user-s-regional-shipping-fee-settings) |
| `shipping_suppliers_get` | 공급사 배송 설정 조회 | Retrieve a supplier's shipping settings | GET | `shipping/suppliers/{supplier_code}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-supplier-s-shipping-settings) |
| `shipping_suppliers_update` | 공급사 배송 설정 수정 | Update a supplier's shipping settings | PUT | `shipping/suppliers/{supplier_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-supplier-s-shipping-settings) |
| `shipping_suppliers_additionalfees_get` | 공급사 국제 배송 추가비 조회 | Retrieve additional handling fees for supplier international shipping | GET | `shipping/suppliers/{supplier_code}/additionalfees` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-additional-handling-fees-for-supplier-international-shipping) |
