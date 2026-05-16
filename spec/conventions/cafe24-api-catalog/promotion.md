# Cafe24 API Catalog — Promotion (프로모션)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `coupon_list` | 쿠폰 목록 조회 | Retrieve a list of coupons | GET | `coupons` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-coupons) |
| `coupon_get` | 쿠폰 단건 조회 | Retrieve a list of coupons (single) | GET | `coupons/{coupon_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-coupons) |
| `coupon_create` | 쿠폰 생성 | Create a coupon | POST | `coupons` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-coupon) |
| `coupon_issue` | 쿠폰 발급 | Create coupon issuance history | POST | `coupons/{coupon_no}/issues` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-coupon-issuance-history) |
| `coupon_delete` | 쿠폰 삭제 | Coupon management (delete) | DELETE | `coupons/{coupon_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#coupon-management) |
| `coupon_count` | 쿠폰 개수 조회 | Retrieve a count of coupons | GET | `coupons/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-coupons) |
| `coupon_manage` | 쿠폰 관리 (사용/중지) | Coupon management | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#coupon-management) |
| `coupon_issuance_customers_list` | 쿠폰 발급 대상 회원 목록 | Retrieve a list of eligible customers for conditional issuance | GET | `coupons/{coupon_no}/issuancecustomers` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-eligible-customers-for-conditional-issuance) |
| `coupon_issues_list` | 발급 쿠폰 목록 | Retrieve a list of issued coupons | GET | `coupons/issues` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-issued-coupons) |
| `benefits_list` | 회원 혜택 목록 | Retrieve a list of customer benefits | GET | `benefits` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-benefits) |
| `benefits_count` | 회원 혜택 개수 | Retrieve a count of customer benefits | GET | `benefits/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-benefits) |
| `benefits_get` | 회원 혜택 단건 조회 | Retrieve a customer benefit | GET | `benefits/{benefit_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-benefit) |
| `benefits_create` | 회원 혜택 생성 | Create a customer benefit | POST | `benefits` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-customer-benefit) |
| `benefits_update` | 회원 혜택 수정 | Update a customer benefit | PUT | `benefits/{benefit_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-benefit) |
| `benefits_delete` | 회원 혜택 삭제 | Delete a customer benefit | DELETE | `benefits/{benefit_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-customer-benefit) |
| `commonevents_list` | 전체 이벤트 목록 | Retrieve a list of storewide promotions | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-storewide-promotions) |
| `commonevents_create` | 전체 이벤트 생성 | Create a storewide promotion | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-storewide-promotion) |
| `commonevents_update` | 전체 이벤트 수정 | Update a storewide promotion | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-storewide-promotion) |
| `commonevents_delete` | 전체 이벤트 삭제 | Delete a storewide promotion | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-storewide-promotion) |
| `customerevents_get` | 회원 정보 이벤트 조회 | View member information event | GET | `customerevents` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#view-member-information-event) |
| `customerevents_create` | 회원 정보 이벤트 생성 | Create a member information modification event | POST | `customerevents` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-member-information-modification-event) |
| `customerevents_update_status` | 회원 정보 이벤트 상태 수정 | Update information update campaign status | PUT | `customerevents` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-information-update-campaign-status) |
| `customers_coupons_list` | 회원별 쿠폰 목록 | Retrieve a list of customer coupons | GET | `customers/{member_id}/coupons` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-coupons) |
| `customers_coupons_count` | 회원별 쿠폰 개수 | Retrieve a count of customer coupons | GET | `customers/{member_id}/coupons/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-coupons) |
| `customers_coupons_delete` | 회원 쿠폰 삭제 | Delete a customer coupon | DELETE | `customers/{member_id}/coupons/{coupon_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-customer-coupon) |
| `discountcodes_list` | 할인 코드 목록 | Retrieve a list of discount codes | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-discount-codes) |
| `discountcodes_get` | 할인 코드 단건 조회 | Retrieve a discount code | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-discount-code) |
| `discountcodes_create` | 할인 코드 생성 | Create a discount code | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-discount-code) |
| `discountcodes_update` | 할인 코드 수정 | Update a discount code | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-discount-code) |
| `discountcodes_delete` | 할인 코드 삭제 | Delete a discount code | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-discount-code) |
| `serialcoupons_list` | 시리얼 쿠폰 코드 조회 | Retrieve coupon codes | GET | `serialcoupons` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-coupon-codes) |
| `serialcoupons_generate` | 시리얼 쿠폰 코드 생성 | Generate coupon code | POST | `serialcoupons/{coupon_no}/generate` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#generate-coupon-code) |
| `serialcoupons_delete` | 시리얼 쿠폰 코드 삭제 | Delete coupon code | DELETE | `serialcoupons/{coupon_no}/{code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-coupon-code) |
| `serialcoupons_issues_get` | 시리얼 쿠폰 발급 코드 조회 | Retrieve a code of coupon codes | GET | `serialcoupons/{coupon_no}/issues` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-code-of-coupon-codes) |
| `serialcoupons_issues_register` | 시리얼 쿠폰 발급 코드 등록 | Register a code of coupon codes | POST | `serialcoupons/{coupon_no}/issues` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#register-a-code-of-coupon-codes) |
