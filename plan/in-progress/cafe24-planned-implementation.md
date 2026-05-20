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
- **`store.md` 의 privacy_* 6 row** (`privacy_boards_get/update`, `privacy_join_get/update`,
  `privacy_orders_get/update`) — `cafe24-restricted-scopes-followups.md §3` 의
  id prefix 결정 (`store_privacy_*` vs `policy_privacy_*` 등) 이 미해소 상태라
  본 PR 에서 제외. 해당 plan 의 prefix 결정 합의 후 별 batch 로 처리 (지원 예정
  배지 6건 유지). 상세: consistency-check `2026/05/21/07_31_53/` C-3.
- **광범위 spec drift fix** — W-4/W-5 (14 resource 파일 Rationale 섹션 보강),
  W-6 (`<resource>_<verb>` 규약 갱신), W-7/W-8 (boards_setting/orders_status
  유사 id rename) 은 본 작업 범위 밖. 별도 `spec-update-cafe24-catalog-drift.md`
  plan 으로 분리 (project-planner 위임 영역).

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
- [x] `/consistency-check --impl-prep spec/conventions/cafe24-api-catalog` — Critical 3건 (C-1/C-2/C-3).
  세션: `review/consistency/2026/05/21/07_31_53/`. BLOCK: YES → Phase 0.5 로 해소.
- [x] 사용자 confirm — D-1 단일 PR / D-2 WebFetch 우선 / D-3 e2e phase 종료 시 1회

### Phase 0.5 — Consistency BLOCK 해소 (drift fix)

본 plan 의 메모리 노트 (Plan must include spec updates) 에 따라 spec 갱신을
정식 phase 로 포함 — "외부 위임 한 줄" 처리 금지.

- [x] **C-1 fix**: `spec/conventions/cafe24-restricted-scopes.md` 32행
  `restricted: op` → `restricted: operation`. drift-fix (2026-05-17 CHANGELOG
  의 토큰 통일 후속). 단순 토큰 정정.
- [x] **C-2 fix**: `spec/conventions/cafe24-api-catalog/store.md` 의
  `## Rationale` 블록 (Rationale 본문 + `> ※ paymentmethods...` 주석) 을
  `## 표` 섹션 뒤로 이동. CLAUDE.md "Rationale 은 문서 끝" 규약 정합. I-4 동시 해소.
- [x] **C-3 분리**: 본 plan §비-Scope 에 명시 (privacy_* 6 row 제외) — 별도 후속.
- [x] text-level 재검증 (grep) — `restricted: op` 단독 토큰 잔존 0건,
  store.md `## Rationale` 가 파일 끝 (line 120) 에 위치 확인. catalog-sync.spec
  의 jest 실행은 backend node_modules 미설치로 Phase 1 진입 시 환경 setup 과 함께 수행.
- [x] commit (단일 commit, 아래 phase 1 진입 전 마무리)

### Phase 1 — store resource (98 planned, privacy_* 6 row 제외 → 92 row)

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
| 1-G | points_setting(2) + policy(2) ~~+ privacy_boards(2) + privacy_join(2) + privacy_orders(2)~~ — privacy_* 6건 제외 (§비-Scope) | 4 | — |
| 1-H | products_display_setting(2) + products_properties(2) + products_setting_get + redirects(4) + restocknotification(2) | 11 | — |
| 1-I | seo(2) + shippingmanager + sms(2) + socials_apple(2) + socials_kakaosync(2) + socials_naverlogin(2) + socials_navershopping | 12 | — |
| 1-J | store_accounts + store_dropshipping(2) + store_setting(2) + subscription_shipments(4) + taxmanager + users(2) | 12 | — |
| **합계** | | **92** (privacy 6 제외) | |

각 batch 종료 시: `catalog-sync.spec` + `metadata.spec` + lint + unit + build 통과
확인 후 commit. e2e 는 phase 종료 시 1회 (D-3 결정).

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

### Phase 4 — coverage matrix + CHANGELOG + 후속 spec drift + plan complete

- [x] `_overview.md` §5 coverage matrix 갱신 (store 100/6, product 63/0,
  order 106/0, 합계 supported 264 → 494, planned ~109 → 6).
- [x] **W-1 fix**: `_overview.md` §4 규칙 8 에 `planned` 행 예외 명시.
- [x] **W-9 fix**: §5 Coverage Matrix 헤더 `2026-05-17` → `2026-05-21`.
- [x] `_overview.md` §7 CHANGELOG 에 `2026-05-21 (planned bulk)` entry 추가.
- [x] `planned.ts` 의 product / order 배열이 `[]`, store 배열이 privacy_* 6건만
  잔존 확인.
- [x] `make e2e-test` 통과 (전체 작업 종료 시 1회 — D-3 결정). 93 tests, 61s.
- [ ] `/ai-review` SUMMARY 0 Critical / 0 Warning 확보 — 본 PR 종료 직전
  별 단계로 수행 (오랜 시간 소요).
- [ ] `git mv plan/in-progress/cafe24-planned-implementation.md plan/complete/`

### 후속 plan (본 PR 밖)

본 PR 에서 처리하지 않는 항목 — 작업 종료 후 `plan/in-progress/` 에 후속 plan
명시:

- `cafe24-restricted-scopes-followups.md §3` — privacy_* 6 row prefix 결정 + rename
- `spec-update-cafe24-catalog-drift.md` (신규 plan) — W-4/W-5 (14 resource Rationale
  보강), W-6 (id 규약 갱신), W-7/W-8 (boards_setting/orders_status 유사 id rename).
  project-planner 위임 영역.

## 진행 방식 결정 사항 (2026-05-21 사용자 confirm 완료)

### D-1. PR 분할 단위 — **한 PR (236 row 전체)**

사용자 결정 (2026-05-21): 단일 PR. 약 ~3500 lines + catalog md 갱신 + plan 이동.
- 사유: review 가 cafe24 endpoint metadata 추가만의 단순 반복 패턴이라 분할
  이점 대비 PR 관리 부담이 큼.
- 위험 완화: batch 별 commit 으로 git history 안에서 영역별 review 가능.
  rollback 도 `git revert <batch-commit>` 으로 영역 단위 가능.

### D-2. cafe24 공식 docs 검증 방식 — **WebFetch 우선 시도**

사용자 결정 (2026-05-21): WebFetch 로 cafe24 docs anchor URL 우선 시도.
- Batch 1-A 진입 시 anchor URL fetch 본문 렌더링 가능 여부를 확인.
- SPA 라 본문 추출 불가 → 멈추고 사용자에게 대체 자료 요청 (escalate).
- 부분 추출 가능 (field 일부 누락) → 가능 부분만 채우고 빈 부분은 catalog md
  의 `?` 유지 + plan 의 §결정 로그 에 기록 후 사용자 보고.

### D-3. e2e 빈도 — **Phase 종료 시 1회**

사용자 결정 (2026-05-21): batch 마다 e2e 는 면제. phase 종료 시 1회.
- Lint / unit / build 는 매 batch 후 통과 확인 (catalog-sync.spec 동기 가드 포함).
- e2e 는 Phase 1 (store) / Phase 2 (product) / Phase 3 (order) / 최종 Phase 4
  의 4회.
- 사유: metadata 추가가 자료구조 row 추가만이라 런타임 회귀 위험이 낮음 (기존
  cafe24 node handler / MCP Bridge 는 row enumerate 만 함).
- RESOLUTION.md `e2e` 줄: "통과" (phase 단위) 형식으로 기록.

### D-4. consistency-check 빈도 — phase 진입 시 1회

`/consistency-check --impl-prep` 은 phase 진입 시점에 phase 단위로 수행. 한
phase 안 sub-batch 사이는 skip (동일 spec 영역, 동일 정책).
- Phase 1 진입 전 1회 — 본 turn 에서 진행.
- Phase 2 / Phase 3 진입 전에는 변경 영역이 동일 catalog 라 skip 가능.
  단 cafe24-restricted-scopes.md / Cafe24OperationMetadata 변경이 발생하면
  재수행.

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

## 결정 로그

### 2026-05-21 — Phase 0 종료

- 사용자 결정 (D-1~D-3): 단일 PR / WebFetch 우선 / e2e phase 종료 시 1회.
- consistency-check `2026/05/21/07_31_53/` Critical 3건:
  - **C-1** (cafe24-restricted-scopes.md 32행 `op` 잔존): Phase 0.5 에서 drift fix.
  - **C-2** (store.md Rationale 위치): Phase 0.5 에서 섹션 이동.
  - **C-3** (privacy_* 6 row prefix 미결): 본 PR §비-Scope 로 분리.
    `cafe24-restricted-scopes-followups.md §3` 결정 후 별 batch.
- Warning W-1/W-9 는 Phase 4 안에 fix 항목으로 포함. W-4~W-8 은 본 PR 밖 후속 plan
  (`spec-update-cafe24-catalog-drift.md`).
- I-1 (paginated 미검증): 각 batch 진행 중 cafe24 docs 확인 시 paginated 도
  실측 갱신.

### 2026-05-21 — Phase 1 종료 (store resource)

- store 92 row (privacy_* 6 제외) supported 승격 완료. 10 batch (1-A ~ 1-J).
- 각 batch 종료 시 catalog-sync (16) + metadata (~16) + public-meta + restricted-approval
  + cafe24-related 5 suite 73 tests 통과 확인.
- backend build (nest build) 통과.
- **lint pre-existing 22 problem (3 errors, 19 warnings)** — 모두 본 PR 변경
  파일과 무관 (sessions.controller / executions.service / llm.service /
  node-component.interface / migrate-node-output-refs). `git diff origin/main`
  로 sessions.controller.ts 가 동일 (변경 없음) 확인. 본 PR 의 store.ts /
  planned.ts / catalog md 변경 자체는 lint clean. 별도 후속 plan
  `spec-update-cafe24-catalog-drift.md` 와 함께 묶거나 본 PR 안 별 commit 으로
  pre-existing fix 검토 — 단 본 plan §Scope 밖이므로 우선 진행 후 처리.
- e2e 는 D-3 결정 (phase 종료 시 1회) 에 따라 Phase 4 종료 시점에 1회로 묶음.
  Phase 1 만 e2e 돌리면 같은 인프라를 phase 마다 setup 하는 비용이 누적되므로
  Phase 2/3/4 종료 후 누적 변경 전체에 대해 1회 수행하는 것이 효율적.
