---
id: mileage
status: implemented
code:
  - codebase/backend/src/nodes/integration/cafe24/metadata/mileage.ts
---

# Cafe24 API Catalog — Mileage (적립금)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

> **별도 승인 필요** — 본 resource 의 `mall.read_mileage` / `mall.write_mileage` scope 는 카페24 본사가 별도 승인한 클라이언트만 사용할 수 있다 (명단 SoT: [`cafe24-restricted-scopes.md §1`](../cafe24-restricted-scopes.md#1-scope-단위-별도-승인-resource-전체-영향)). 모든 row 의 `restricted` 컬럼 = `scope`, 대응 backend 메타데이터 `restrictedApproval.level='scope'`, `approvalGroup='mileage'`.

## 표

| id | 라벨 (한) | English title | method | path | scope | restricted | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|---|
| `mileage_list` | 적립금 내역 조회 | Retrieve points | GET | `points` | read | scope | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-points) |
| `mileage_grant` | 적립금 지급 | Issue and deduct points | POST | `points` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#issue-and-deduct-points) |
| `points_autoexpiration_get` | 적립금 자동 만료 조회 | Retrieve an automatic points expiration | GET | `points/autoexpiration/{id}` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-automatic-points-expiration) |
| `points_autoexpiration_create` | 적립금 자동 만료 생성 | Create an automatic points expiration | POST | `points/autoexpiration` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-automatic-points-expiration) |
| `points_autoexpiration_delete` | 적립금 자동 만료 삭제 | Delete an automatic points expiration | DELETE | `points/autoexpiration/{id}` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-automatic-points-expiration) |
| `points_report` | 적립금 리포트 조회 | Retrieve a points report by date range | GET | `points/report` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-points-report-by-date-range) |
| `credits_list` | 예치금 내역 조회 | Retrieve a list of credits by date range | GET | `credits` | read | scope | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-credits-by-date-range) |
| `credits_report` | 예치금 리포트 조회 | Retrieve a credit report by date range | GET | `credits/report` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-credit-report-by-date-range) |

## Rationale

설계 근거 (컬럼 정의·동기 정책·status enum) 는 [`_overview.md`](./_overview.md) 의 §2·§4·§7. 별도 승인 라벨링의 의사결정 배경은 [`cafe24-restricted-scopes.md ## Rationale`](../cafe24-restricted-scopes.md#rationale).

## Field-level 상세 카탈로그

> 각 sub-resource 의 **응답 속성(field) + operation 요청 파라미터**를 Cafe24 공식 docs 기준으로 담은 상세 카탈로그. 위 표가 endpoint enumeration index 라면, 아래는 field-level 본문이다. 출처: Cafe24 REST API Documentation (admin), 2026-06-03 download.

- [`mileage/credits.md`](./mileage/credits.md) · Credits — 12 fields, 1 ops
- [`mileage/credits-report.md`](./mileage/credits-report.md) · Credits report — 4 fields, 1 ops
- [`mileage/points.md`](./mileage/points.md) · Points — 18 fields, 2 ops
- [`mileage/points-autoexpiration.md`](./mileage/points-autoexpiration.md) · Points autoexpiration — 9 fields, 3 ops
- [`mileage/points-report.md`](./mileage/points-report.md) · Points report — 6 fields, 1 ops
