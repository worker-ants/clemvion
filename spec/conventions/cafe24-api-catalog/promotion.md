---
id: promotion
status: implemented
code:
  - codebase/backend/src/nodes/integration/cafe24/metadata/promotion.ts
---

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
| `coupon_manage` | 쿠폰 관리 (사용/중지) | Coupon management (pause/resume) | PUT | `coupons/{coupon_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#coupon-management) |
| `coupon_issuance_customers_list` | 쿠폰 발급 대상 회원 목록 | Retrieve a list of eligible customers for conditional issuance | GET | `coupons/{coupon_no}/issuancecustomers` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-eligible-customers-for-conditional-issuance) |
| `coupon_issues_list` | 발급 쿠폰 목록 | Retrieve a list of issued coupons | GET | `coupons/{coupon_no}/issues` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-issued-coupons) |
| `benefits_list` | 회원 혜택 목록 | Retrieve a list of customer benefits | GET | `benefits` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-benefits) |
| `benefits_count` | 회원 혜택 개수 | Retrieve a count of customer benefits | GET | `benefits/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-benefits) |
| `benefits_get` | 회원 혜택 단건 조회 | Retrieve a customer benefit | GET | `benefits/{benefit_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-benefit) |
| `benefits_create` | 회원 혜택 생성 | Create a customer benefit | POST | `benefits` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-customer-benefit) |
| `benefits_update` | 회원 혜택 수정 | Update a customer benefit | PUT | `benefits/{benefit_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-benefit) |
| `benefits_delete` | 회원 혜택 삭제 | Delete a customer benefit | DELETE | `benefits/{benefit_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-customer-benefit) |
| `commonevents_list` | 전체 이벤트 목록 | Retrieve a list of storewide promotions | GET | `commonevents` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-storewide-promotions) |
| `commonevents_create` | 전체 이벤트 생성 | Create a storewide promotion | POST | `commonevents` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-storewide-promotion) |
| `commonevents_update` | 전체 이벤트 수정 | Update a storewide promotion | PUT | `commonevents/{event_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-storewide-promotion) |
| `commonevents_delete` | 전체 이벤트 삭제 | Delete a storewide promotion | DELETE | `commonevents/{event_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-storewide-promotion) |
| `customerevents_get` | 회원 정보 이벤트 조회 | View member information event | GET | `customerevents` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#view-member-information-event) |
| `customerevents_create` | 회원 정보 이벤트 생성 | Create a member information modification event | POST | `customerevents` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-member-information-modification-event) |
| `customerevents_update_status` | 회원 정보 이벤트 상태 수정 | Update information update campaign status | PUT | `customerevents` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-information-update-campaign-status) |
| `customers_coupons_list` | 회원별 쿠폰 목록 | Retrieve a list of customer coupons | GET | `customers/{member_id}/coupons` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-coupons) |
| `customers_coupons_count` | 회원별 쿠폰 개수 | Retrieve a count of customer coupons | GET | `customers/{member_id}/coupons/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-coupons) |
| `customers_coupons_delete` | 회원 쿠폰 삭제 | Delete a customer coupon | DELETE | `customers/{member_id}/coupons/{coupon_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-customer-coupon) |
| `discountcodes_list` | 할인 코드 목록 | Retrieve a list of discount codes | GET | `discountcodes` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-discount-codes) |
| `discountcodes_get` | 할인 코드 단건 조회 | Retrieve a discount code | GET | `discountcodes/{discount_code_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-discount-code) |
| `discountcodes_create` | 할인 코드 생성 | Create a discount code | POST | `discountcodes` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-discount-code) |
| `discountcodes_update` | 할인 코드 수정 | Update a discount code | PUT | `discountcodes/{discount_code_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-discount-code) |
| `discountcodes_delete` | 할인 코드 삭제 | Delete a discount code | DELETE | `discountcodes/{discount_code_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-discount-code) |
| `serialcoupons_list` | 시리얼 쿠폰 코드 조회 | Retrieve coupon codes | GET | `serialcoupons` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-coupon-codes) |
| `serialcoupons_generate` | 시리얼 쿠폰 코드 생성 | Generate coupon code | POST | `serialcoupons` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#generate-coupon-code) |
| `serialcoupons_delete` | 시리얼 쿠폰 코드 삭제 | Delete coupon code | DELETE | `serialcoupons/{coupon_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-coupon-code) |
| `serialcoupons_issues_get` | 시리얼 쿠폰 발급 코드 조회 | Retrieve a code of coupon codes | GET | `serialcoupons/{coupon_no}/issues` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-code-of-coupon-codes) |
| `serialcoupons_issues_register` | 시리얼 쿠폰 발급 코드 등록 | Register a code of coupon codes | POST | `serialcoupons/{coupon_no}/issues` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#register-a-code-of-coupon-codes) |

> ⚠ **docs 부재 seed (`coupon_get`, `coupon_delete`)**: 두 row 의 endpoint (`GET coupons/{coupon_no}` / `DELETE coupons/{coupon_no}`) 는 cafe24 admin docs (Latest 2026-03-01) 에 **노출되지 않는다** — coupon 단건 path 에는 `PUT` (즉 `coupon_manage`) 만 문서화되어 있다. 메타데이터 row 는 backwards-compat seed 로 유지되며 cafe24 wire 상 실제 동작 여부는 **미확인 (production 검증 전)**. `status: supported` 는 §3 정의상 "노드에서 호출 가능 = 메타데이터 row 존재" 를 뜻하므로 유효하나, 위 두 row 의 docs 링크는 잠정적이다. JSDoc ⚠ 마크 + 운영 검증/제거 결정 트랙: [`plan/in-progress/cafe24-backlog-residual.md §G-2`](../../../plan/in-progress/cafe24-backlog-residual.md). 근거: [`promotion.ts`](../../../codebase/backend/src/nodes/integration/cafe24/metadata/promotion.ts) JSDoc 주석.

## Field-level 상세 카탈로그

> 각 sub-resource 의 **응답 속성(field) + operation 요청 파라미터**를 Cafe24 공식 docs 기준으로 담은 상세 카탈로그. 위 표가 endpoint enumeration index 라면, 아래는 field-level 본문이다. 출처: Cafe24 REST API Documentation (admin), 2026-06-03 download.

- [`promotion/benefits.md`](./promotion/benefits.md) · Benefits — 25 fields, 6 ops
- [`promotion/commonevents.md`](./promotion/commonevents.md) · Commonevents — 8 fields, 4 ops
- [`promotion/coupons.md`](./promotion/coupons.md) · Coupons — 93 fields, 4 ops
- [`promotion/coupons__issuancecustomers.md`](./promotion/coupons__issuancecustomers.md) · Coupons issuancecustomers — 9 fields, 1 ops
- [`promotion/coupons__issues.md`](./promotion/coupons__issues.md) · Coupons issues — 11 fields, 2 ops
- [`promotion/customerevents.md`](./promotion/customerevents.md) · Customerevents — 19 fields, 3 ops
- [`promotion/customers__coupons.md`](./promotion/customers__coupons.md) · Customers coupons — 17 fields, 3 ops
- [`promotion/discountcodes.md`](./promotion/discountcodes.md) · Discountcodes — 18 fields, 5 ops
- [`promotion/serialcoupons.md`](./promotion/serialcoupons.md) · Serialcoupons — 51 fields, 3 ops
- [`promotion/serialcoupons__issues.md`](./promotion/serialcoupons__issues.md) · Serialcoupons issues — 8 fields, 2 ops
