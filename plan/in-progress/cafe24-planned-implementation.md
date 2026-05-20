---
worktree: cafe24-planned-impl-060c7f
started: 2026-05-21
owner: developer
spec: spec/conventions/cafe24-api-catalog/{store,product,order}.md
---

# Cafe24 planned operation 전수 구현

## 배경

`spec/conventions/cafe24-api-catalog/_overview.md` §3 의 status enum 중 `planned`
는 "카탈로그에 등재만, 미구현" 을 의미하며, UI Operation 드롭다운에 disabled +
"지원 예정" 배지로 노출된다 (`codebase/backend/src/nodes/integration/cafe24/metadata/planned.ts`
가 backend mirror).

현재 잔여 planned (2026-05-21):

| Resource | planned row | supported row | catalog md |
|---|---|---|---|
| store | **98** | 8 | [store.md](../../spec/conventions/cafe24-api-catalog/store.md) |
| product | **49** | 14 | [product.md](../../spec/conventions/cafe24-api-catalog/product.md) |
| order | **89** | 17 | [order.md](../../spec/conventions/cafe24-api-catalog/order.md) |
| **합계** | **236** | 39 (3개 resource) | |

전체 catalog 264 supported / 109 planned (다른 15 resource 는 모두 0-planned).

사용자 요청 (2026-05-21): "미구현 상태의 항목을 모두 구현해줘".

## Scope · 비-Scope

### Scope (본 plan)

- store / product / order 3 resource 의 planned 236 row 를 `supported` 로 승격
- catalog md row 의 `method` / `path` / `scope` / `paginated` 를 Cafe24 공식 docs
  검증 후 채움 (`_overview.md` §6 등재 절차)
- backend metadata (`codebase/backend/src/nodes/integration/cafe24/metadata/{store,product,order}.ts`)
  에 `Cafe24OperationMetadata` row 추가
- `planned.ts` 에서 대응 row 제거
- `catalog-sync.spec.ts` (양방향 동기 가드) 통과 — batch 마다 확인
- 각 phase 종료 시 `_overview.md` §5 coverage matrix · §7 CHANGELOG 갱신
- TEST WORKFLOW (lint / unit / build / e2e) 각 batch 마다 통과

### 비-Scope

- 다른 15 resource (이미 0-planned)
- frontend Operation 드롭다운 / Operation node UI 변경 — `planned.ts` 가 비워지면
  자동으로 disabled 배지 사라짐, 별도 작업 불필요
- AI agent allowlist 갱신 — supported 로 승격되면 기존 allowlist enumerate 가 자동 포함
- Cafe24 공식 docs 가 deprecate 표시한 endpoint — `planned → deprecated` 로 우회
  (발견 시 catalog row 만 갱신, metadata 추가 안 함). 발견 시점에 본 plan §결정 로그에 기록.

### Spec 변경이 필요해질 가능성

본 plan 은 **catalog md 의 planned → supported 갱신** 만 수행한다 (이는
`_overview.md` §6 등재 절차로 developer 권한에 명시되어 있음). 단,
다음 케이스 발생 시 즉시 멈추고 `project-planner` 위임:

1. cafe24 docs 검증 중 catalog row 가 빠진 endpoint 발견 (신규 row 추가)
2. cafe24 docs 의 deprecation 으로 status enum 정책 변경 필요
3. `Cafe24Resource` enum 신규 추가 필요 (현재 18 resource 외)
4. `Cafe24FieldType` / `Cafe24RestrictedApproval` 등 metadata model 변경
5. `cafe24-restricted-scopes.md` 의 별도 승인 명단 변경

## Phase 구성

### Phase 0 — plan 작성 + scope 확정 (본 단계)

- [x] 잔여 planned 정확 카운트 (store 98 / product 49 / order 89)
- [x] catalog md / backend metadata / planned.ts / catalog-sync.spec 구조 파악
- [x] 본 plan 작성
- [ ] `/consistency-check --impl-prep spec/conventions/cafe24-api-catalog` 통과
- [ ] 사용자 confirm — batch 분할안 + 진행 방식 (PR 단위·검증 흐름)

### Phase 1 — store resource (98 planned)

sub-resource 그룹별 batch (~10~15 row). 카탈로그 docs 컬럼의 anchor 로 Cafe24
공식 페이지 1:1 검증.

| Batch | sub-resource 그룹 | 추정 row | restricted |
|---|---|---|---|
| 1-A | shops_get + activitylogs(2) + dashboard + financials(2) + menus | 7 | activitylogs/menus = operation |
| 1-B | automessages(3) + benefits(2) + boards_setting(2) + carts_setting(2) | 9 | — |
| 1-C | categories_properties(2) + coupons_setting(2) + currency(2) + customers_setting(2) | 8 | — |
| 1-D | images_setting(2) + information(2) + kakaoalimtalk(3) + kakaopay(2) | 9 | kakaopay = operation |
| 1-E | mains_properties(2) + mobile_setting(2) + naverpay(3) + orderform_setting(2) | 9 | naverpay = operation |
| 1-F | orders_setting(2) + orders_status(2) + payment_setting(2) + paymentgateway_paymentmethods CUD(3) + paymentmethods_paymentproviders_update_display + paymentservices_get | 11 | paymentgateway = operation |
| 1-G | points_setting(2) + policy(2) + privacy_boards(2) + privacy_join(2) + privacy_orders(2) | 10 | privacy = scope (cafe24-restricted-scopes.md 확인) |
| 1-H | products_display_setting(2) + products_properties(2) + products_setting_get + redirects(4) + restocknotification(2) | 11 | — |
| 1-I | seo(2) + shippingmanager + sms(2) + socials_apple(2) + socials_kakaosync(2) + socials_naverlogin(2) + socials_navershopping | 12 | — |
| 1-J | store_accounts + store_dropshipping(2) + store_setting(2) + subscription_shipments(4) + taxmanager + users(2) | 12 | — |
| **합계** | | **98** | |

각 batch 종료 시: `catalog-sync.spec` + `metadata.spec` + lint + unit + build + e2e
통과 확인 후 commit. PR 단위: 사용자 결정 (§진행 방식 결정 사항 참고).

### Phase 2 — product resource (49 planned)

| Batch | sub-resource 그룹 | 추정 row |
|---|---|---|
| 2-A | product_variants(5) + product_additionalimages(3) + product_images(2) | 10 |
| 2-B | product_approve(3) + product_customproperties(3) + product_decorationimages(4) | 10 |
| 2-C | product_discountprice + product_hits_count + product_icons(4) + product_memos(5) | 11 |
| 2-D | product_tags(4) + bundleproducts(5) + categories_products(4) | 13 |
| 2-E | mains_products(5) | 5 |
| **합계** | | **49** |

### Phase 3 — order resource (89 planned)

| Batch | sub-resource 그룹 | 추정 row |
|---|---|---|
| 3-A | order_autocalculation + order_buyer(2) + order_cancellation(2) + order_completions + order_exchange(2) + order_exchangerequests_reject + order_items(7) | 16 |
| 3-B | order_memos(3) + order_payments(1) + order_paymenttimeline(2) + order_receivers(4) + order_refunds + order_return(2) + order_shipments(3) | 16 |
| 3-C | order_shippingfeecancellation(2) + order_shortagecancellation + orders_benefits + orders_calculation_total + orders_coupons + orders_dashboard + orders_inflowgroups(4) | 11 |
| 3-D | orders_inflows(4) + orders_memos + orders_migrations(4) + orders_paymentamount + orders_saleschannels(4) | 14 |
| 3-E | payments_status_update_multiple + reservations + return_update + returnrequests(2) + cancellation_update_bulk + cancellationrequests(2) + cashreceipt(4) | 13 |
| 3-F | collectrequests_update + control + exchange_update_multiple + exchangerequests(2) + fulfillments + labels(2) + orderform_properties(4) | 12 |
| 3-G | shipments(2) + subscription_shipments(4) + unpaidorders_list | 7 |
| **합계** | | **89** |

### Phase 4 — coverage matrix + CHANGELOG + plan complete

- [ ] `_overview.md` §5 coverage matrix 의 `Supported` / `Planned` 합계 갱신
- [ ] `_overview.md` §7 CHANGELOG 에 본 plan 의 phase 별 1줄 entry 추가
- [ ] `planned.ts` 의 store / product / order 배열이 모두 `[]` 임을 재확인
  (다른 15 resource 와 동일하게 0-planned)
- [ ] `/ai-review` SUMMARY 0 Critical / 0 Warning 확보
- [ ] `git mv plan/in-progress/cafe24-planned-implementation.md plan/complete/`

## 진행 방식 결정 사항 (사용자 confirm 필요)

다음 항목들은 batch 진입 전 사용자 결정이 필요:

### D-1. PR 분할 단위

- **(a)** Phase 단위 3 PR (store / product / order)
- **(b)** Phase 안 sub-batch 단위 ~22 PR (batch 당 ~10~15 row, review 부담 균등)
- **(c)** 한 PR (236 row × ~15 lines = ~3500 라인) — 권장 안 함, review 부담 과대

권장: **(b)** sub-batch 단위. 단 store 의 일부 batch (별도 승인 operation 만)
는 합쳐 하나의 PR 로 처리 가능.

### D-2. cafe24 공식 docs 검증 방식

각 endpoint 의 method/path/scope/fields 를 cafe24 공식 docs 에서 검증해야 한다.
방식:

- **(a)** WebFetch 로 `https://developers.cafe24.com/docs/ko/api/admin/` 페이지를
  batch 별로 가져와 parsing. cafe24 docs SPA 일 가능성 — anchor link 직접 fetch 시
  본문 미렌더 위험.
- **(b)** 사용자가 endpoint 명세 JSON / 문서를 제공
- **(c)** cafe24 SDK / openapi spec 이 있다면 그 SoT 사용

→ 시도 순서: (a) anchor URL 로 첫 batch 시도 → 본문 추출 불가 시 (b)/(c) 로 전환.

### D-3. e2e 인프라 부담

`make e2e-test` 가 batch 당 30~60s. 22 batch × 1분 = ~22분 누적. e2e 면제는
화이트리스트 밖이므로 (코드 변경 1줄 이상) 면제 불가. 매 batch 후 수행이 default.

→ 단 metadata 추가가 backend 의 cafe24 노드 핸들러 분기 / cafe24 MCP Bridge 의
operation 라우팅에 어떤 영향을 주는지 먼저 확인. 메타 자료구조에 추가만 하면
런타임 회귀 위험이 낮으므로, batch 종료 시 lint+unit+build 통과 + 마지막 batch /
phase 종료 시 1회 e2e 로 묶을 수 있는지 사용자 의견 확인.

→ 본 plan default 는 "각 phase 종료 시 1회 e2e" — 모든 batch 마다 e2e 는
워크플로 정책상 권장. 사용자 결정 필요.

### D-4. consistency-check 빈도

`/consistency-check --impl-prep` 은 phase 진입 시점에 phase 단위로 수행. 한
phase 안 sub-batch 사이는 skip (동일 spec 영역, 동일 정책).

## 진행 절차 (각 batch 공통)

1. cafe24 공식 docs 의 endpoint 페이지 fetch — method/path/scope/fields 확인
2. `spec/conventions/cafe24-api-catalog/<resource>.md` 의 해당 row 갱신:
   - `method` / `path` / `scope` 의 `?` → 실 값
   - `paginated` 컬럼 — list 형식이면 `✓`
   - `status` — `planned` → `supported`
3. `codebase/backend/src/nodes/integration/cafe24/metadata/<resource>.ts` 에
   `Cafe24OperationMetadata` row 추가:
   - `id` / `label` (한국어, catalog 의 `라벨 (한)` 와 동일)
   - `description` (영문, catalog 의 `English title` 기반)
   - `scopeType` / `method` / `path` / `requiredFields` / `fields` /
     `responseShape` / `paginated`
   - `restrictedApproval` (해당 시) — `RESTRICTED_APPROVAL.<key>` 참조
4. `planned.ts` 의 대응 row 제거
5. `cd codebase/backend && npm test -- catalog-sync` 통과 확인
6. `cd codebase/backend && npm test -- metadata` 통과 확인 (id unique 등)
7. `.claude/tools/run-test.sh lint` / `unit` / `build` 순차 통과
8. phase 마지막 batch 또는 phase 종료 시 `.claude/tools/run-test.sh e2e` 통과
9. commit (`feat(cafe24-catalog): batch <N-X> — <sub-resource>`)

## 의존성 / 위험

- `RESTRICTED_APPROVAL` 의 정의가 catalog 의 `restricted` 컬럼 값과 어긋나면
  catalog-sync.spec §8 fail. batch 1-A / 1-D / 1-E / 1-F / 1-G (activitylogs /
  menus / naverpay / kakaopay / pg_settings / privacy) 진입 전
  `cafe24-restricted-scopes.md` 의 명단 확인.
- product / order 일부 endpoint 가 store 와 cross-resource 참조 가능 (예:
  category, supply). cross-resource id 충돌은 metadata.spec 의 unique 가드로
  검출.
- cafe24 docs 의 일부 endpoint 가 deprecated 표시일 수 있음. 발견 시 catalog
  row 를 `planned → deprecated` 로 (metadata 추가 안 함). 본 plan §결정 로그에
  기록.

## 결정 로그 (배치 진행하며 추가)

(비어있음 — Phase 1 진입 후 갱신)
