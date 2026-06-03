---
id: customer
status: implemented
code:
  - codebase/backend/src/nodes/integration/cafe24/metadata/customer.ts
---

# Cafe24 API Catalog — Customer (회원)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).
> **주의 (provisional seed)**: `customer_get`(GET) / `customer_update`(PUT) `customers/{member_id}` 두 행은 Cafe24 admin docs (Latest 2026-03-01) 에 **노출되지 않는** seed endpoint 다 (공식 문서는 `DELETE customers/{member_id}` 만 등재). 노드 메타데이터에는 `supported` 로 존재하나 wire 상 실제 동작 여부는 미검증이며, 운영 검증·제거·대체(`customer_list` + filter) 결정은 [`plan/in-progress/cafe24-backlog-residual.md` §G-2](../../../plan/in-progress/cafe24-backlog-residual.md) 트랙에서 진행 중이다. 그래서 두 행의 `docs` 링크는 단건 GET/PUT 전용 anchor 가 없어 목록 조회 anchor(`#retrieve-a-list-of-customers`) 를 재사용한다. 근거: `codebase/backend/src/nodes/integration/cafe24/metadata/customer.ts:26-62`.

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `customer_list` | 회원 목록 조회 | Retrieve a list of customers | GET | `customers` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers) |
| `customer_get` | 회원 단건 조회 | Retrieve a list of customers (single) | GET | `customers/{member_id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers) |
| `customer_update` | 회원 정보 수정 | Update a customer | PUT | `customers/{member_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers) |
| `customer_group_update` | 회원 등급 변경 | Update a customer's customer tier | POST | `customergroups/{group_no}/customers` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-s-customer-tier) |
| `customer_memos_create` | 회원 메모 작성 | Create a customer memo | POST | `customers/{member_id}/memos` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-customer-memo) |
| `customer_delete` | 회원 탈퇴 처리 | Delete an account | DELETE | `customers/{member_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-account) |
| `customer_autoupdate_get` | 회원 등급 자동 갱신 조회 | Retrieve customer tier auto-update details | GET | `customers/{member_id}/autoupdate` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-customer-tier-auto-update-details) |
| `customer_memos_count` | 회원 메모 개수 | Retrieve a count of customer memos | GET | `customers/{member_id}/memos/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-memos) |
| `customer_memos_list` | 회원 메모 목록 | Retrieve a list of customer memos | GET | `customers/{member_id}/memos` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-memos) |
| `customer_memos_get` | 회원 메모 단건 조회 | Retrieve a customer memo | GET | `customers/{member_id}/memos/{memo_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-memo) |
| `customer_memos_update` | 회원 메모 수정 | Update a customer memo | PUT | `customers/{member_id}/memos/{memo_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-memo) |
| `customer_memos_delete` | 회원 메모 삭제 | Delete a customer memo | DELETE | `customers/{member_id}/memos/{memo_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-customer-memo) |
| `customer_paymentinfo_list` | 회원 결제수단 목록 | Retrieve a customer's list of payment methods | GET | `customers/{member_id}/paymentinformation` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-s-list-of-payment-methods) |
| `customer_paymentinfo_delete` | 회원 결제수단 삭제 | Delete customer's payment information | DELETE | `customers/{member_id}/paymentinformation` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-customer-s-payment-information) |
| `customer_paymentinfo_delete_by_id` | 회원 결제수단 ID 삭제 | Delete customer's payment information by payment method ID | DELETE | `customers/{member_id}/paymentinformation/{payment_method_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-customer-s-payment-information-by-payment-method-id) |
| `customer_plusapp_get` | Plus 앱 설치 정보 조회 | Retrieve app installation information | GET | `customers/{member_id}/plusapp` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-app-installation-information) |
| `customer_social_get` | 소셜 계정 조회 | Retrieve a customer's social account | GET | `customers/{member_id}/social` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-s-social-account) |
| `customers_properties_view` | 회원가입 필드 조회 | View account signup fields | GET | `customers/properties` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#view-account-signup-fields) |
| `customers_properties_edit` | 회원가입 필드 수정 | Edit account signup fields | PUT | `customers/properties` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-account-signup-fields) |
| `social_list` | 소셜 연동 목록 | List all social | GET | `social` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#list-all-social) |
| `customergroups_list` | 회원 등급 목록 | Retrieve a list of customer tiers | GET | `customergroups` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-tiers) |
| `customergroups_count` | 회원 등급 개수 | Retrieve a count of customer tiers | GET | `customergroups/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-tiers) |
| `customergroups_get` | 회원 등급 단건 조회 | Retrieve a customer tier | GET | `customergroups/{group_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-tier) |
| `customergroups_settings_get` | 회원 등급 설정 조회 | Retrieve customer tier settings | GET | `customergroups/setting` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-customer-tier-settings) |

## Field-level 상세 카탈로그

> 각 sub-resource 의 **응답 속성(field) + operation 요청 파라미터**를 Cafe24 공식 docs 기준으로 담은 상세 카탈로그. 위 표가 endpoint enumeration index 라면, 아래는 field-level 본문이다. 출처: Cafe24 REST API Documentation (admin), 2026-06-03 download.

- [`customer/customergroups.md`](./customer/customergroups.md) · Customergroups — 14 fields, 3 ops
- [`customer/customergroups__customers.md`](./customer/customergroups__customers.md) · Customergroups customers — 4 fields, 1 ops
- [`customer/customergroups-setting.md`](./customer/customergroups-setting.md) · Customergroups setting — 21 fields, 1 ops
- [`customer/customers.md`](./customer/customers.md) · Customers — 19 fields, 2 ops
- [`customer/customers__autoupdate.md`](./customer/customers__autoupdate.md) · Customers autoupdate — 7 fields, 1 ops
- [`customer/customers__memos.md`](./customer/customers__memos.md) · Customers memos — 6 fields, 6 ops
- [`customer/customers__paymentinformation.md`](./customer/customers__paymentinformation.md) · Customers paymentinformation — 7 fields, 3 ops
- [`customer/customers__plusapp.md`](./customer/customers__plusapp.md) · Customers plusapp — 5 fields, 1 ops
- [`customer/customers-properties.md`](./customer/customers-properties.md) · Customers properties — 3 fields, 2 ops
- [`customer/customers__social.md`](./customer/customers__social.md) · Customers social — 5 fields, 1 ops
- [`customer/social.md`](./customer/social.md) · Social — 5 fields, 1 ops
