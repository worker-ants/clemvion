# Cafe24 API Catalog — Privacy (개인정보)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

> **별도 승인 필요** — 본 resource 의 `mall.read_privacy` / `mall.write_privacy` scope 는 카페24 본사가 별도 승인한 클라이언트만 사용할 수 있다 (명단 SoT: [`cafe24-restricted-scopes.md §1`](../cafe24-restricted-scopes.md#1-scope-단위-별도-승인-resource-전체-영향)). 모든 row 의 `restricted` 컬럼 = `scope`, 대응 backend 메타데이터 `restrictedApproval.level='scope'`, `approvalGroup='privacy'`.

## 표

| id | 라벨 (한) | English title | method | path | scope | restricted | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|---|
| `customers_privacy_get` | 회원 개인정보 조회 | Retrieve a customer information | GET | `customersprivacy/{member_id}` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-information) |
| `customers_privacy_list` | 회원 개인정보 목록 조회 | Retrieve a list of customer information | GET | `customersprivacy` | read | scope | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-information) |
| `customers_privacy_count` | 회원 개인정보 개수 조회 | Retrieve a count of customer information | GET | `customersprivacy/count` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-information) |
| `customers_privacy_update` | 회원 개인정보 수정 | Update a customer information | PUT | `customersprivacy/{member_id}` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-information) |
| `products_wishlist_customers_list` | 위시리스트 보유 회원 목록 | Retrieve a list of customers with a product in wishlist | GET | `products/{product_no}/wishlist/customers` | read | scope | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers-with-a-product-in-wishlist) |
| `products_wishlist_customers_count` | 위시리스트 보유 회원 수 | Retrieve a count of customers with a product in wishlist | GET | `products/{product_no}/wishlist/customers/count` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customers-with-a-product-in-wishlist) |

## Rationale

설계 근거 (컬럼 정의·동기 정책·status enum) 는 [`_overview.md`](./_overview.md) 의 §2·§4·§7. 별도 승인 라벨링의 의사결정 배경은 [`cafe24-restricted-scopes.md ## Rationale`](../cafe24-restricted-scopes.md#rationale).
