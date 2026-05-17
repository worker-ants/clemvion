# Plan 정합성 Check Payload

본 파일은 orchestrator 가 Plan 정합성 checker 용으로 작성한 입력입니다. `plan/in-progress/**` 의 진행 중 작업·미해결 결정과 target 문서가 정합한지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자가 가리키는 경로에 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (Plan 정합성)

1. **미해결 결정과의 충돌** — target 이 plan 에서 "결정 필요" 로 남겨둔 항목과 충돌하는 결정을 일방적으로 내리고 있지 않은가
2. **중복 작업** — target 이 이미 다른 plan 에서 진행 중인 작업과 동일한 영역을 손대고 있는가 (병렬 worktree 경합 위험)
3. **선행 plan 미해소** — target 이 가정하는 사전 조건이 plan 에서 아직 해결되지 않았는가
4. **후속 항목 누락** — target 변경이 다른 plan 의 후속 항목을 무효화하거나 새로 만들어야 하는데 반영되지 않았는가
5. **worktree 충돌** — 동일 spec 파일을 target plan 과 다른 worktree 가 동시에 손대고 있는지 (plan frontmatter `worktree` 필드 확인)

## 검토 모드
구현 착수 전 검토 (--impl-prep, scope=spec/conventions/)

## Target 문서
경로: `spec/conventions/`

```
### 구현 대상 영역: `spec/conventions/`

#### `spec/conventions/cafe24-api-catalog/_overview.md`
```
# CONVENTION: Cafe24 API Catalog — Overview

> 관련 문서: [Spec Cafe24 노드](../../4-nodes/4-integration/4-cafe24.md) · [Cafe24 API Metadata 컨벤션](../cafe24-api-metadata.md) · [Cafe24 공식 Admin API 문서](https://developers.cafe24.com/docs/ko/api/admin/)

본 디렉토리(`spec/conventions/cafe24-api-catalog/`) 는 Cafe24 Admin API 의 **모든 endpoint** 를 18 resource 단위로 enumerate 한 단일 진실(single source of truth)이다. 노드 메타데이터(`backend/src/nodes/integration/cafe24/metadata/*.ts`) 가 어디까지 구현됐고 어디가 남았는지가 한 화면에서 보이도록 유지한다.

---

## 1. 디렉토리 구조

```
spec/conventions/cafe24-api-catalog/
  _overview.md        # 본 문서 — 인덱스 + 컬럼 정의 + 동기 정책 + coverage matrix
  store.md            # Store (상점) — 50+ sub-resource
  product.md          # Product (상품)
  order.md            # Order (주문)
  customer.md         # Customer (회원)
  community.md        # Community (게시판)
  design.md           # Design (디자인)
  promotion.md        # Promotion (프로모션)
  application.md      # Application (앱 관리)
  category.md         # Category (상품분류)
  collection.md       # Collection (판매분류)
  supply.md           # Supply (공급사)
  shipping.md         # Shipping (배송)
  salesreport.md      # Salesreport (매출통계)
  personal.md         # Personal (개인화)
  privacy.md          # Privacy (개인정보)
  mileage.md          # Mileage (적립금)
  notification.md     # Notification (알림)
  translation.md      # Translation (번역)
```

resource 이름은 `Cafe24Resource` enum (`backend/src/nodes/integration/cafe24/metadata/types.ts`) 와 1:1 일치한다.

## 2. 표 컬럼 정의

각 resource 파일은 다음 컬럼의 표를 가진다.

| 컬럼 | 필수 | 설명 |
|------|------|------|
| `id` | ✓ | 노드 메타데이터의 operation id. `<resource>_<verb>` 또는 `<resource>_<sub>_<verb>` (예: `product_list`, `product_options_create`). 영문 snake_case, resource 내 unique |
| `라벨 (한)` | ✓ | UI 드롭다운에 노출되는 한국어 라벨 (예: "상품 목록 조회") |
| `English title` | ✓ | Cafe24 공식 docs 의 영문 제목 (예: "Retrieve a list of products") |
| `method` | supported 시 ✓ | `GET` / `POST` / `PUT` / `DELETE`. planned 시 `?` 허용 |
| `path` | supported 시 ✓ | path template (예: `products/{product_no}`). `/api/v2/admin/` 접두는 생략. planned 시 `?` 허용 |
| `scope` | supported 시 ✓ | `read` / `write`. `mall.<scope>_<resource>` 의 가운데 토큰. planned 시 `?` 허용 |
| `paginated` | — | `✓` 또는 빈 칸. `paginated: true` 인 operation 만 표시 |
| `restricted` | — | `scope` / `op` / 빈칸. `scope` = 본 scope 자체가 카페24 별도 승인 대상이라 같은 resource 의 모든 row 가 영향. `op` = 본 row 만 단독 승인 대상 (store 안 케이스). 빈칸 = 일반 사용 가능. **이 컬럼은 `status` 와 직교하며 `status` 의 값이 아니다** — `supported` + `restricted: op` 조합이 정상이다. 명단 SoT 는 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md) |
| `status` | ✓ | §3 의 enum 중 하나 |
| `docs` | ✓ | Cafe24 공식 docs anchor URL — `https://developers.cafe24.com/docs/ko/api/admin/#<anchor>` |

## 3. status enum

| 값 | 의미 | 백엔드 메타데이터 |
|-----|------|------|
| `supported` | 노드/MCP Bridge 에서 호출 가능 | `CAFE24_OPERATIONS_BY_RESOURCE[resource]` 에 row 존재 |
| `planned` | 카탈로그에 등재만, 미구현. UI 의 Operation 드롭다운에 **disabled + "지원 예정" 배지** 로 노출 | row 없음 |
| `deprecated` | Cafe24 가 제거 또는 deprecate 했고 우리 노드에서도 더 이상 호출 안 함 | row 없으면 정상. 있으면 마이그레이션 대상 |

`planned` 행의 `method`/`path`/`scope` 가 `?` 인 경우, 구현 시점에 공식 docs 를 다시 검증한 뒤 `supported` 로 승격시키며 정확한 값으로 갱신한다.

## 4. 동기 정책 (Sync Contract)

본 카탈로그는 `backend/src/nodes/integration/cafe24/metadata/*.ts` 와 **양방향 동기 테스트**로 보호된다.

**테스트 위치**: `backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts`

**검증 규칙**:

1. **`supported` row → 메타데이터 존재**: 카탈로그에 `status: supported` 로 적힌 모든 `(resource, id)` 가 `findCafe24Operation(resource, id)` 로 조회되어야 한다. 누락 시 fail.
2. **메타데이터 → `supported` row 존재**: `CAFE24_OPERATIONS_BY_RESOURCE` 의 모든 operation 이 해당 resource 의 카탈로그에 `status: supported` 행으로 적혀 있어야 한다. 누락 시 fail.
3. **`paginated` 일치**: `supported` row 의 `paginated` 컬럼(`✓`/공백)이 메타데이터의 `paginated: boolean` 과 일치해야 한다.
4. **`method`/`path` 일치**: `supported` row 의 `method`·`path` 가 메타데이터와 일치.
5. **`scope` 일치**: `supported` row 의 `scope` 가 메타데이터 `scopeType` 과 일치.
6. **id 의 resource 내 unique**: 한 카탈로그 파일 안에 같은 `id` 가 두 번 나오면 fail.
7. **status 가 enum 중 하나**: `supported` / `planned` / `deprecated` 외의 값이 있으면 fail.
8. **`restricted` 컬럼 ↔ 메타데이터 `restrictedApproval` 동기**: catalog row 의 `restricted` 컬럼이 `scope` 또는 `op` 이면 그 row 에 대응하는 backend 메타데이터에 `restrictedApproval` 필드가 존재해야 하고, 그 역도 동일. 컬럼 값 ↔ 메타데이터 `level` 매핑: `scope` ↔ `level='scope'`, `op` ↔ `level='operation'`. **`level='program'` 인 메타데이터 row 는 catalog 화 대상이 아닌 별도 트랙 (Analytics 등) 이므로 본 검증에서 제외**된다 — catalog 에 대응 row 가 없는 것이 정상. SoT 명단의 진위 검증은 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md) §5 절차에서 별도로 다룬다.

테스트는 카탈로그 MD 의 표를 파싱한다 — MD 표 구문이 깨지면 곧장 fail. 따라서 본 카탈로그는 **사람이 직접 손으로 수정하는 SoT** 이며, 코드 변경 시점에 반드시 카탈로그 동기 갱신을 함께 commit 해야 한다(`spec/conventions/cafe24-api-metadata.md` §5 의 신규 endpoint 추가 절차에 인용).

## 5. Coverage Matrix

2026-05-16 기준. 본 매트릭스는 카탈로그 row 수 + 메타데이터 row 수의 한 화면 요약이다 — 위 동기 테스트와 별개의 휴먼 가독성 보조 정보다. row 추가/삭제 시 본 표도 손으로 갱신한다.

| Resource | Supported | Planned | Cafe24 docs sub-resource 수 |
|----------|-----------|---------|---|
| [store](./store.md) | 8 | 50+ | 50+ |
| [product](./product.md) | 14 | 25+ | 28 |
| [order](./order.md) | 17 | 30+ | 47 |
| [customer](./customer.md) | 24 | 0 | 12 |
| [community](./community.md) | 24 | 0 | 9 |
| [design](./design.md) | 9 | 0 | 3 |
| [promotion](./promotion.md) | 35 | 0 | 10 |
| [application](./application.md) | 19 | 0 | 8 |
| [category](./category.md) | 19 | 0 | 5 |
| [collection](./collection.md) | 15 | 0 | 5 |
| [supply](./supply.md) | 20 | 0 | 6 |
| [shipping](./shipping.md) | 15 | 0 | 5 |
| [salesreport](./salesreport.md) | 5 | 0 | 5 |
| [personal](./personal.md) | 5 | 0 | 3 |
| [privacy](./privacy.md) | 6 | 0 | 2 |
| [mileage](./mileage.md) | 8 | 0 | 5 |
| [notification](./notification.md) | 12 | 0 | 7 |
| [translation](./translation.md) | 9 | 0 | 4 |
| **합계** | **264** | **~109** | **~250** |

> "Cafe24 docs sub-resource 수" 는 공식 docs 좌측 사이드바에서 본 resource 그룹 아래의 두 번째 레벨 항목 수다. 각 sub-resource 마다 통상 2~5 operation 이 존재하므로 endpoint 합계는 ~500.

## 6. 신규 endpoint 등재 절차

1. Cafe24 공식 문서에서 endpoint 확인.
2. 본 카탈로그 해당 resource 파일에 표 row 추가:
   - 처음 등재 시 `status: planned`, `method`/`path` 는 `?` 허용.
   - 구현 PR 에서 backend 메타데이터 row 1줄 추가 + 카탈로그 row 를 `planned → supported` 로 갱신 + `method`/`path`/`scope`/`paginated` 채움.
3. `_overview.md` §5 의 coverage matrix 카운트도 함께 갱신.
4. `npm test --workspace backend -- catalog-sync` 통과 확인.

> `spec/conventions/cafe24-api-metadata.md` §5 의 신규 endpoint 추가 절차도 본 카탈로그 row 갱신을 step 으로 포함한다.

## 7. CHANGELOG

| 일자 | 변경 |
|------|------|
| 2026-05-16 | 신규 컨벤션 — 18 resource 카탈로그 + 양방향 동기 테스트 도입. 사용자 결정(2026-05-16) "Cafe24 docs 전수 등재" 에 따라 supported 53 + planned ~300 으로 초기 채움. |
| 2026-05-16 (coverage Phase 5a) | Order resource — `order_count`, `order_status_update`, `order_status_update_multiple` 3건을 planned → supported 로 승격 (backend metadata + planned.ts mirror 동시 갱신). order supported 6 → 9, 합계 53 → 56. |
| 2026-05-16 (coverage Phase 5b) | Product resource — `product_count`, `product_options_list/create/update/delete`, `product_seo_get/update` 7건을 planned → supported 로 승격. product supported 7 → 14, 합계 56 → 63. |
| 2026-05-16 (coverage Phase 5c) | Customer resource — 회원 메모 CRUD 완성: `customer_memos_count/list/get/update/delete` 5건을 planned → supported 로 승격. customer supported 5 → 10, 합계 63 → 68. |
| 2026-05-16 (coverage Phase 5d) | Promotion resource — 쿠폰 보완: `coupon_count`, `coupon_issues_list`, `coupon_issuance_customers_list`, `customers_coupons_list`, `customers_coupons_count` 5건을 planned → supported 로 승격. promotion supported 5 → 10, 합계 68 → 73. |
| 2026-05-16 (coverage Phase 5e) | Salesreport resource 완성 — `salesreport_monthly`, `salesreport_hourly`, `salesreport_volume` 3건을 planned → supported 로 승격. salesreport supported 2 → 5, planned 3 → 0, 합계 73 → 76. salesreport resource 의 첫 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 5f) | Promotion resource — 시리얼쿠폰 5건 (`serialcoupons_list`, `serialcoupons_generate`, `serialcoupons_delete`, `serialcoupons_issues_get`, `serialcoupons_issues_register`) 를 planned → supported 로 승격. promotion supported 10 → 15, 합계 76 → 81. |
| 2026-05-16 (coverage Phase 6a) | Order resource — A/S 자동화 8건 (`refunds_list/get`, `cancellation_get/create_multiple`, `exchange_get/create_multiple`, `return_get/create_multiple`) 를 planned → supported 로 승격. order supported 9 → 17, 합계 81 → 89. |
| 2026-05-16 (coverage Phase 6b) | Store resource — 결제 설정 6건 (`paymentmethods_list`, `paymentmethods_paymentproviders_list`, `paymentgateway_paymentmethods_list`, `paymentgateway_create/update/delete`) 를 planned → supported 로 승격. store supported 2 → 8, 합계 89 → 95. |
| 2026-05-16 (coverage Phase 6c) | Promotion resource — 회원 혜택 CRUD 6건 + 회원 정보 이벤트 3건 + customers_coupons_delete 1건 = 10건. promotion supported 15 → 25, 합계 95 → 105. |
| 2026-05-16 (coverage Phase 6d) | Category/Collection/Supply/Shipping baseline 10건 — category(category_count/mains_list/autodisplay_list), collection(brands count/create/update/delete), supply(suppliers_count/get), shipping(carriers_get). 합계 105 → 115. |
| 2026-05-16 (coverage Phase 6e) | Mileage resource — 적립금 자동 만료 3건 (`points_autoexpiration_get/create/delete`) + 예치금 2건 (`credits_list`, `credits_report`) = 5건. mileage supported 2 → 7, 합계 115 → 120. |
| 2026-05-16 (coverage Phase 6f) | Notification resource — SMS 2건 (`sms_senders_list`, `sms_receivers_get`) + automails 2건 (`automails_get/update`) + recipientgroups 2건 (`recipientgroups_list/get`) = 6건. notification supported 2 → 8, 합계 120 → 126. |
| 2026-05-16 (coverage Phase 6g) | Translation resource — products_update + categories list/update + store list/update + themes list 6건. translation supported 1 → 7, 합계 126 → 132. 본 사이클 (Phase 6 a~g) 종료. |
| 2026-05-16 (coverage Phase 7a) | Promotion resource — discountcodes CRUD 5건 + commonevents CRUD 4건 = 9건. promotion supported 25 → 34, 합계 132 → 141. |
| 2026-05-16 (coverage Phase 7b) | Customer resource 완성 — 회원 14건 (paymentinfo 3 + properties 2 + customergroups 4 + delete + autoupdate + plusapp + social + social_list). customer supported 10 → 24, planned 14 → 0, 합계 141 → 155. customer 두 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 7c) | Community resource — boards 설정 2건 + boards 글 CRUD 3건 + comments 3건 + commenttemplates 2건 = 10건. community supported 3 → 13, 합계 155 → 165. |
| 2026-05-16 (coverage Phase 7d) | Application resource — apps_update + scripttags CRUD 5건 + webhooks_update + webhooks_logs_list = 8건. application supported 3 → 11, 합계 165 → 173. |
| 2026-05-16 (coverage Phase 7e) | Shipping resource 완성 — carriers CRUD 3건 + regionalsurcharges 2건 + shipping_settings 2건 + shipping_additionalfees_countries + shippingorigins CRUD 5건 = 13건. shipping supported 2 → 15, planned 13 → 0, 합계 173 → 186. shipping 세 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 7f) | Category resource 완성 — decorationimages 2건 (get/update) + seo 2건 (get/update) + mains 3건 (add/update/delete) + autodisplay 3건 (create/update/delete) = 10건. category supported 9 → 19, planned 10 → 0, 합계 186 → 196. category 네 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 7g) | Supply resource 완성 — suppliers CUD 3건 + suppliers_users CRUD 6건 + suppliers_users regional shipping 5건 + shipping_suppliers 3건 = 17건. supply supported 3 → 20, planned 17 → 0, 합계 196 → 213. supply 다섯 번째 0-planned resource. 본 사이클 (Phase 7 a~g) 종료. |
| 2026-05-16 (coverage Phase 8a) | Mileage resource 완성 — `points_report` 1건. mileage supported 7 → 8, planned 1 → 0, 합계 213 → 214. mileage 여섯 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8b) | Promotion resource 완성 — `coupon_manage` 1건 (use_coupon T/F 토글). promotion supported 34 → 35, planned 1 → 0, 합계 214 → 215. promotion 일곱 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8c) | Translation resource 완성 — 테마 번역 단건 조회/수정 2건. translation supported 7 → 9, planned 2 → 0, 합계 215 → 217. translation 여덟 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8d) | Personal resource 완성 — `customers_wishlist_count` + `products_carts_count` + `products_carts_list` 3건. personal supported 2 → 5, planned 3 → 0, 합계 217 → 220. personal 아홉 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8e) | Notification resource 완성 — `customers_invitation_send` + recipientgroups CUD 3건 = 4건. notification supported 8 → 12, planned 4 → 0, 합계 220 → 224. notification 열 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8f) | Privacy resource 완성 — customers_privacy list/count/update 3건 + products_wishlist_customers list/count 2건 = 5건. privacy supported 1 → 6, planned 5 → 0, 합계 224 → 229. privacy 열한 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8g) | Application resource 완성 — appstore_orders get/create 2건 + appstore_payments list/count 2건 + databridge_logs_list + recipes list/create/delete 3건 = 8건. application supported 11 → 19, planned 8 → 0, 합계 229 → 237. application 열두 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8h) | Collection resource 완성 — manufacturers count/get/create/update 4건 + trends_count + classifications list/count 2건 + origin_list = 8건. collection supported 7 → 15, planned 8 → 0, 합계 237 → 245. collection 열세 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8i) | Design resource 완성 — themes count/get 2건 + theme_pages CRUD 4건 (get/create/update/delete) + icons_list + icons_update_settings = 8건. design supported 1 → 9, planned 8 → 0, 합계 245 → 253. design 열네 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8j) | Community resource 완성 — boards_comments_bulk + boards_seo get/update 2건 + commenttemplates get/update/delete 3건 + financials_monthlyreviews_count + urgentinquiry get/reply CRUD 4건 = 11건. community supported 13 → 24, planned 11 → 0, 합계 253 → 264. community 열다섯 번째 0-planned resource. 본 사이클 (Phase 8 a~j) 종료. |
| 2026-05-17 | §2 에 `restricted` 컬럼 추가 + §4 검증 규칙 8 신설 — 카페24 별도 승인 대상 식별. SoT 는 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md). 영향 카탈로그 (mileage / notification / privacy / store) 표 헤더·row 동시 갱신. 사용자 보고 (질문에서 제공한 3종 표) 후속. consistency-check 세션: `review/consistency/2026/05/17/12_12_46/` (BLOCK: NO). |

```

#### `spec/conventions/cafe24-api-catalog/application.md`
```
# Cafe24 API Catalog — Application (앱 관리)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).
> **주의**: 본 resource 는 Cafe24 앱 관리 API 다. 우리 서비스의 Integration `app_type` (Public/Private OAuth 앱 등록) 과 **무관** — naming collision 회피 참고.

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `applications_list` | 설치된 앱 목록 조회 | Retrieve an app information | GET | `applications` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-app-information) |
| `scripttags_list` | 스크립트태그 목록 조회 | Retrieve a list of script tags | GET | `scripttags` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-script-tags) |
| `webhooks_list` | Webhook 설정 조회 | Retrieve webhook settings | GET | `webhooks` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-webhook-settings) |
| `apps_update` | 앱 정보 수정 | Update an app information | PUT | `apps` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-app-information) |
| `appstore_orders_get` | 앱스토어 주문 조회 | Retrieve a Cafe24 store order | GET | `appstore/orders/{order_id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retreive-a-cafe24-store-order) |
| `appstore_orders_create` | 앱스토어 주문 생성 | Create a Cafe24 store order | POST | `appstore/orders` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-cafe24-store-order) |
| `appstore_payments_list` | 앱스토어 결제 목록 | Retrieve a list of Cafe24 store payments | GET | `appstore/payments` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-cafe24-store-payments) |
| `appstore_payments_count` | 앱스토어 결제 수 | Retrieve a count of Cafe24 store payments | GET | `appstore/payments/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-cafe24-store-payments) |
| `databridge_logs_list` | DataBridge 로그 목록 | Retrieve a list of DataBridge webhook logs | GET | `databridge/logs` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-databridge-webhook-logs) |
| `recipes_list` | 레시피 목록 조회 | Retrieve a list of recipes | GET | `recipes` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-recipes) |
| `recipes_create` | 레시피 생성 | Create a recipe | POST | `recipes` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-recipe) |
| `recipes_delete` | 레시피 삭제 | Delete a recipe | DELETE | `recipes/{recipe_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-recipe) |
| `scripttags_count` | 스크립트태그 개수 조회 | Retrieve a count of script tags | GET | `scripttags/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-script-tags) |
| `scripttags_get` | 스크립트태그 단건 조회 | Retrieve a script tag | GET | `scripttags/{tag_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-script-tag) |
| `scripttags_create` | 스크립트태그 생성 | Create a script tag | POST | `scripttags` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-script-tag) |
| `scripttags_update` | 스크립트태그 수정 | Update a script tag | PUT | `scripttags/{tag_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-script-tag) |
| `scripttags_delete` | 스크립트태그 삭제 | Delete a script tag | DELETE | `scripttags/{tag_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-script-tag) |
| `webhooks_logs_list` | Webhook 로그 목록 | Retrieve a list of webhook logs | GET | `webhooks/logs` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-webhook-logs) |
| `webhooks_update` | Webhook 설정 수정 | Edit webhook settings | PUT | `webhooks` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-webhook-settings) |

```

#### `spec/conventions/cafe24-api-catalog/category.md`
```
# Cafe24 API Catalog — Category (상품분류)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `category_list` | 카테고리 목록 조회 | Retrieve a list of product categories | GET | `categories` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-categories) |
| `category_get` | 카테고리 단건 조회 | Retrieve a product category | GET | `categories/{category_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-category) |
| `category_create` | 카테고리 생성 | Create a product category | POST | `categories` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-product-category) |
| `category_update` | 카테고리 수정 | Update a product category | PUT | `categories/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-category) |
| `category_delete` | 카테고리 삭제 | Delete a product category | DELETE | `categories/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product-category) |
| `category_products_list` | 카테고리별 상품 목록 조회 | Retrieve a list of products by category | GET | `categories/{category_no}/products` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-products-by-category) |
| `category_count` | 카테고리 개수 조회 | Retrieve a count of product categories | GET | `categories/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-product-categories) |
| `category_decorationimages_get` | 카테고리 꾸미기 이미지 조회 | Retrieve decoration image settings by category | GET | `categories/{category_no}/decorationimages` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-decoration-image-settings-by-category) |
| `category_decorationimages_update` | 카테고리 꾸미기 이미지 수정 | Update decoration images of a product category | PUT | `categories/{category_no}/decorationimages` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-decoration-images-of-a-product-category) |
| `category_seo_get` | 카테고리 SEO 조회 | Retrieve SEO settings by category | GET | `categories/{category_no}/seo` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-seo-settings-by-category) |
| `category_seo_update` | 카테고리 SEO 수정 | Update a product category SEO | PUT | `categories/{category_no}/seo` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-category-seo) |
| `mains_list` | 메인 카테고리 목록 조회 | Retrieve a list of main categories | GET | `mains` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-main-categories) |
| `mains_add` | 메인 카테고리 추가 | Add main category | POST | `mains` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#add-main-category) |
| `mains_update` | 메인 카테고리 수정 | Update main category | PUT | `mains/{main_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-main-category) |
| `mains_delete` | 메인 카테고리 삭제 | Delete main category | DELETE | `mains/{main_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-main-category) |
| `autodisplay_list` | 자동 진열 목록 조회 | Retrieve a list of auto layouts | GET | `autodisplay` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-auto-layouts) |
| `autodisplay_create` | 자동 진열 생성 | Create auto layout for selected product category | POST | `autodisplay` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-auto-layout-for-selected-product-category) |
| `autodisplay_update` | 자동 진열 수정 | Update auto layout for selected product category | PUT | `autodisplay/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-auto-layout-for-selected-product-category) |
| `autodisplay_delete` | 자동 진열 삭제 | Delete auto layout for selected product category | DELETE | `autodisplay/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-auto-layout-for-selected-product-category) |

```

#### `spec/conventions/cafe24-api-catalog/collection.md`
```
# Cafe24 API Catalog — Collection (판매분류)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `brands_list` | 브랜드 목록 조회 | Retrieve a list of brands | GET | `brands` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-brands) |
| `manufacturers_list` | 제조사 목록 조회 | Retrieve a list of manufacturers | GET | `manufacturers` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-manufacturers) |
| `trends_list` | 트렌드 목록 조회 | Retrieve a list of trends | GET | `trends` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-trends) |
| `brands_count` | 브랜드 개수 조회 | Retrieve a count of brands | GET | `brands/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-brands) |
| `brands_create` | 브랜드 생성 | Create a brand | POST | `brands` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-brand) |
| `brands_update` | 브랜드 수정 | Update a brand | PUT | `brands/{brand_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-brand) |
| `brands_delete` | 브랜드 삭제 | Delete a brand | DELETE | `brands/{brand_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-brand) |
| `manufacturers_count` | 제조사 개수 조회 | Retrieve a count of manufacturers | GET | `manufacturers/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-manufacturers) |
| `manufacturers_get` | 제조사 단건 조회 | Retrieve a manufacturer | GET | `manufacturers/{manufacturer_code}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-manufacturer) |
| `manufacturers_create` | 제조사 생성 | Create a manufacturer | POST | `manufacturers` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-manufacturer) |
| `manufacturers_update` | 제조사 수정 | Update a manufacturer | PUT | `manufacturers/{manufacturer_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-manufacturer) |
| `trends_count` | 트렌드 개수 조회 | Retrieve a count of trends | GET | `trends/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-trends) |
| `classifications_list` | 사용자 정의 카테고리 목록 | Retrieve a list of custom categories | GET | `classifications` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-custom-categories) |
| `classifications_count` | 사용자 정의 카테고리 수 | Retrieve a count of custom categories | GET | `classifications/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-custom-categories) |
| `origin_list` | 원산지 목록 조회 | Retrieve a list of origins | GET | `origin` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-origins) |

```

#### `spec/conventions/cafe24-api-catalog/community.md`
```
# Cafe24 API Catalog — Community (게시판)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `boards_list` | 게시판 목록 조회 | Retrieve a list of boards | GET | `boards` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-boards) |
| `board_articles_list` | 게시판 글 목록 조회 | Retrieve a list of posts for a board | GET | `boards/{board_no}/articles` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-posts-for-a-board) |
| `board_article_get` | 게시판 글 단건 조회 | Retrieve a list of posts for a board (single) | GET | `boards/{board_no}/articles/{article_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-posts-for-a-board) |
| `boards_settings_get` | 게시판 설정 조회 | Retrieve the board settings | GET | `boards/{board_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-board-settings) |
| `boards_settings_update` | 게시판 설정 수정 | Update the board settings | PUT | `boards/{board_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-the-board-settings) |
| `board_articles_create` | 게시판 글 작성 | Create a board post | POST | `boards/{board_no}/articles` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-board-post) |
| `board_articles_update` | 게시판 글 수정 | Update a board post | PUT | `boards/{board_no}/articles/{article_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-board-post) |
| `board_articles_delete` | 게시판 글 삭제 | Delete a board post | DELETE | `boards/{board_no}/articles/{article_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-board-post) |
| `board_articles_comments_list` | 게시판 댓글 목록 | Retrieve a list of comments for a board post | GET | `boards/{board_no}/articles/{article_no}/comments` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-comments-for-a-board-post) |
| `board_articles_comments_create` | 게시판 댓글 작성 | Create a comment for a board post | POST | `boards/{board_no}/articles/{article_no}/comments` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-comment-for-a-board-post) |
| `board_articles_comments_delete` | 게시판 댓글 삭제 | Delete a comment for a board post | DELETE | `boards/{board_no}/articles/{article_no}/comments/{comment_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-comment-for-a-board-post) |
| `boards_comments_bulk` | 게시판 댓글 일괄 조회 | Retrieve comments in bulk | GET | `boards/{board_no}/comments` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-comments-in-bulk) |
| `boards_seo_get` | 게시판 SEO 조회 | Retrieve SEO settings for board | GET | `boards/{board_no}/seo` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-seo-settings-for-board) |
| `boards_seo_update` | 게시판 SEO 수정 | Update SEO settings for board | PUT | `boards/{board_no}/seo` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-seo-settings-for-board) |
| `commenttemplates_list` | 자주 쓰는 답변 목록 | Retrieve frequently used answers | GET | `commenttemplates` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-frequently-used-answers) |
| `commenttemplates_get` | 자주 쓰는 답변 단건 | Retrieve a frequently used answer | GET | `commenttemplates/{template_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-frequently-used-answer) |
| `commenttemplates_create` | 자주 쓰는 답변 생성 | Create a frequently used answer | POST | `commenttemplates` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-frequently-used-answer) |
| `commenttemplates_update` | 자주 쓰는 답변 수정 | Update a frequently used answer | PUT | `commenttemplates/{template_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-frequently-used-answer) |
| `commenttemplates_delete` | 자주 쓰는 답변 삭제 | Delete a frequently used answer | DELETE | `commenttemplates/{template_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-frequently-used-answer) |
| `financials_monthlyreviews_count` | 월별 후기 카운트 | Retrieve the total count for monthly reviews and ratings | GET | `financials/monthlyreviews/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-total-count-for-monthly-reviews-and-ratings) |
| `urgentinquiry_get` | 긴급 문의 게시글 조회 | Retrieve an urgent inquiry post | GET | `urgentinquiry/{inquiry_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-urgent-inquiry-post) |
| `urgentinquiry_reply_get` | 긴급 문의 답변 조회 | Retrieve a reply for urgent inquiry post | GET | `urgentinquiry/{inquiry_no}/reply` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-reply-for-urgent-inquiry-post) |
| `urgentinquiry_reply_create` | 긴급 문의 답변 작성 | Create a reply for urgent inquiry post | POST | `urgentinquiry/{inquiry_no}/reply` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-reply-for-urgent-inquiry-post) |
| `urgentinquiry_reply_update` | 긴급 문의 답변 수정 | Update a reply for urgent inquiry post | PUT | `urgentinquiry/{inquiry_no}/reply` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-reply-for-urgent-inquiry-post) |

```

#### `spec/conventions/cafe24-api-catalog/customer.md`
```
# Cafe24 API Catalog — Customer (회원)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `customer_list` | 회원 목록 조회 | Retrieve a list of customers | GET | `customers` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers) |
| `customer_get` | 회원 단건 조회 | Retrieve a list of customers (single) | GET | `customers/{member_id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers) |
| `customer_update` | 회원 정보 수정 | Update a customer | PUT | `customers/{member_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers) |
| `customer_group_update` | 회원 등급 변경 | Update a customer's customer tier | PUT | `customergroups/customers` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-s-customer-tier) |
| `customer_memos_create` | 회원 메모 작성 | Create a customer memo | POST | `customers/{member_id}/memos` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-customer-memo) |
| `customer_delete` | 회원 탈퇴 처리 | Delete an account | DELETE | `customers/{member_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-account) |
| `customer_autoupdate_get` | 회원 등급 자동 갱신 조회 | Retrieve customer tier auto-update details | GET | `customers/autoupdate` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-customer-tier-auto-update-details) |
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
| `social_list` | 소셜 연동 목록 | List all social | GET | `social` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#list-all-social) |
| `customergroups_list` | 회원 등급 목록 | Retrieve a list of customer tiers | GET | `customergroups` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-tiers) |
| `customergroups_count` | 회원 등급 개수 | Retrieve a count of customer tiers | GET | `customergroups/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-tiers) |
| `customergroups_get` | 회원 등급 단건 조회 | Retrieve a customer tier | GET | `customergroups/{group_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-tier) |
| `customergroups_settings_get` | 회원 등급 설정 조회 | Retrieve customer tier settings | GET | `customergroups/setting` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-customer-tier-settings) |

```

#### `spec/conventions/cafe24-api-catalog/design.md`
```
# Cafe24 API Catalog — Design (디자인)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md). 본 파일은 `design` resource 의 모든 operation enumeration.

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `themes_list` | 테마 목록 조회 | Retrieve a list of themes | GET | `themes` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-themes) |
| `themes_count` | 테마 개수 조회 | Retrieve a count of themes | GET | `themes/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-themes) |
| `themes_get` | 테마 단건 조회 | Retrieve a theme | GET | `themes/{theme_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-theme) |
| `theme_pages_get` | 테마 페이지 조회 | Retrieve a theme page | GET | `themes/{theme_no}/pages/{page_path}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-theme-page) |
| `theme_pages_create` | 테마 페이지 생성 | Create a theme page | POST | `themes/{theme_no}/pages` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-theme-page) |
| `theme_pages_update` | 테마 페이지 수정 | Update a theme page | PUT | `themes/{theme_no}/pages/{page_path}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-theme-page) |
| `theme_pages_delete` | 테마 페이지 삭제 | Delete a theme page | DELETE | `themes/{theme_no}/pages/{page_path}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-theme-page) |
| `icons_list` | 디자인 아이콘 목록 조회 | Retrieve a list of design icons | GET | `icons` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-desgin-icons) |
| `icons_update_settings` | 상점 아이콘 설정 수정 | Update store icon settings | PUT | `icons` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-store-icon-settings) |

```

#### `spec/conventions/cafe24-api-catalog/mileage.md`
```
# Cafe24 API Catalog — Mileage (적립금)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

> **별도 승인 필요** — 본 resource 의 `mall.read_mileage` / `mall.write_mileage` scope 는 카페24 본사가 별도 승인한 클라이언트만 사용할 수 있다 (명단 SoT: [`cafe24-restricted-scopes.md §1`](../cafe24-restricted-scopes.md#1-scope-단위-별도-승인-resource-전체-영향)). 모든 row 의 `restricted` 컬럼 = `scope`, 대응 backend 메타데이터 `restrictedApproval.level='scope'`, `category='mileage'`.

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

```

#### `spec/conventions/cafe24-api-catalog/notification.md`
```
# Cafe24 API Catalog — Notification (알림)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

> **별도 승인 필요** — 본 resource 의 `mall.read_notification` / `mall.write_notification` scope 는 카페24 본사가 별도 승인한 클라이언트만 사용할 수 있다 (명단 SoT: [`cafe24-restricted-scopes.md §1`](../cafe24-restricted-scopes.md#1-scope-단위-별도-승인-resource-전체-영향)). 모든 row 의 `restricted` 컬럼 = `scope`, 대응 backend 메타데이터 `restrictedApproval.level='scope'`, `category='notification'`.

## 표

| id | 라벨 (한) | English title | method | path | scope | restricted | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|---|
| `sms_send` | SMS 발송 | Send a SMS | POST | `sms` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#send-a-sms) |
| `sms_balance_get` | SMS 잔액 조회 | Retrieve the SMS balance | GET | `sms/balance` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-sms-balance) |
| `sms_receivers_get` | SMS 수신자 조회 | Retrieve a SMS recipient | GET | `sms/receivers` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-sms-recipient) |
| `sms_senders_list` | SMS 발신자 목록 조회 | Retrieve a list of SMS senders | GET | `sms/senders` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-sms-senders) |
| `automails_get` | 자동 이메일 설정 조회 | Retrieve automated email settings | GET | `automails` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-automated-email-settings) |
| `automails_update` | 자동 이메일 설정 수정 | Update automated email settings | PUT | `automails` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-automated-email-settings) |
| `customers_invitation_send` | 회원 활성화 초대 발송 | Send an invitation to activate account | POST | `customers/invitation` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#send-an-invitation-to-activate-account) |
| `recipientgroups_list` | 수신자 그룹 목록 | Retrieve distribution group list | GET | `recipientgroups` | read | scope | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-distribution-group-list) |
| `recipientgroups_get` | 수신자 그룹 상세 | Retrieve distribution group details | GET | `recipientgroups/{group_no}` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-distribution-group-details) |
| `recipientgroups_create` | 수신자 그룹 생성 | Create a distribution group | POST | `recipientgroups` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-distribution-group) |
| `recipientgroups_update` | 수신자 그룹 수정 | Edit distribution group | PUT | `recipientgroups/{group_no}` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-distribution-group) |
| `recipientgroups_delete` | 수신자 그룹 삭제 | Delete distribution group | DELETE | `recipientgroups/{group_no}` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-distribution-group) |

```

#### `spec/conventions/cafe24-api-catalog/order.md`
```
# Cafe24 API Catalog — Order (주문)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `order_list` | 주문 목록 조회 | Retrieve a list of orders | GET | `orders` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-orders) |
| `order_get` | 주문 단건 조회 | Retrieve an order | GET | `orders/{order_id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-order) |
| `order_items_list` | 주문 상품 목록 조회 | Retrieve a list of order items | GET | `orders/{order_id}/items` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-order-items) |
| `order_shipments_create` | 주문 배송 정보 등록 | Create an order shipping information | POST | `orders/{order_id}/shipments` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-shipping-information) |
| `order_buyer_update` | 주문자 정보 수정 | Update customer information of an order | PUT | `orders/{order_id}/buyer` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-customer-information-of-an-order) |
| `order_memos_create` | 주문 메모 작성 | Create an order memo | POST | `orders/{order_id}/memos` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-memo) |
| `order_count` | 주문 개수 조회 | Retrieve a count of orders | GET | `orders/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-orders) |
| `order_status_update_multiple` | 주문 상태 일괄 변경 | Update status for multiple orders | PUT | `orders/status` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-status-for-multiple-orders) |
| `order_status_update` | 주문 상태 변경 | Update an order status | PUT | `orders/{order_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-status) |
| `order_autocalculation_delete` | 주문 자동 계산 해제 | Remove auto calculation setting of an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#remove-auto-calculation-setting-of-an-order) |
| `order_buyer_get` | 주문자 정보 조회 | Retrieve customer details of an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-customer-details-of-an-order) |
| `order_buyer_history_list` | 주문자 정보 변경 이력 | Retrieve a list of customer history of an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-history-of-an-order) |
| `order_cancellation_create` | 주문 취소 생성 | Create an order cancellation | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-cancellation) |
| `order_cancellation_update` | 주문 취소 상세 변경 | Change cancellation details | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#change-cancellation-details) |
| `order_completions_complete` | PG 결제 후 주문 완료 | Complete an order after PG payment | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#complete-an-order-after-pg-payment) |
| `order_exchange_create` | 주문 교환 생성 | Create an order exchange | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-exchange) |
| `order_exchange_update` | 주문 교환 수정 | Update an order exchange | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-exchange) |
| `order_exchangerequests_reject` | 교환 요청 반려 | Reject an exchange request | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#reject-an-exchange-request) |
| `order_items_create` | 주문 상품 추가 | Create an order item | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-item) |
| `order_items_update` | 주문 상품 수정 | Update an order item | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-item) |
| `order_items_labels_get` | 주문 상품 라벨 조회 | Retrieve an order label | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-order-label) |
| `order_items_labels_create` | 주문 상품 라벨 생성 | Create an order label | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-label) |
| `order_items_labels_update` | 주문 상품 라벨 수정 | Update an order label | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-label) |
| `order_items_labels_delete` | 주문 상품 라벨 삭제 | Delete an order label | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-order-label) |
| `order_items_options_create` | 주문 상품 옵션 생성 | Create order item options | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-order-item-options) |
| `order_items_options_update` | 주문 상품 옵션 수정 | Edit order item options | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-order-item-options) |
| `order_memos_list` | 주문 메모 목록 | Retrieve a list of order memos | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-order-memos) |
| `order_memos_update` | 주문 메모 수정 | Update an order memo | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-memo) |
| `order_memos_delete` | 주문 메모 삭제 | Delete an order memo | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-order-memo) |
| `order_payments_status_update` | 주문 결제 상태 수정 | Update an order payment status | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-payment-status) |
| `order_paymenttimeline_history` | 결제 이력 조회 | Retrieve payment history of an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-payment-history-of-an-order) |
| `order_paymenttimeline_details` | 결제 상세 조회 | Retrieve payment details of an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-payment-details-of-an-order) |
| `order_receivers_list` | 받는 사람 목록 | Retrieve a list of recipients of an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-recipients-of-an-order) |
| `order_receivers_update` | 받는 사람 수정 | Update order recipients | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-order-recipients) |
| `order_receivers_change_shipping` | 받는 사람 배송지 변경 | Change shipping information | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#change-shipping-information) |
| `order_receivers_history_list` | 받는 사람 변경 이력 | Retrieve a list of recipient history of an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-recipient-history-of-an-order) |
| `order_refunds_update` | 주문 환불 수정 | Update an order refund | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-refund) |
| `order_return_create` | 주문 반품 생성 | Create an order return | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-return) |
| `order_return_update` | 주문 반품 수정 | Update an order return | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-return) |
| `order_shipments_list` | 주문 배송 정보 목록 | Retrieve a list of shipping information of an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-shipping-information-of-an-order) |
| `order_shipments_update` | 주문 배송 정보 수정 | Update an order shipping | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-shipping) |
| `order_shipments_delete` | 주문 배송 정보 삭제 | Delete an order shipping | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-order-shipping) |
| `order_shippingfeecancellation_get` | 배송비 취소 상세 | Retrieve shipping fee cancellation details of an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-shipping-fee-cancellation-details-of-an-order) |
| `order_shippingfeecancellation_create` | 배송비 취소 생성 | Create an order shipping fee cancellation | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-shipping-fee-cancellation) |
| `order_shortagecancellation_create` | 재고 부족 취소 생성 | Create an order cancellation on stock shortage | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-cancellation-on-stock-shortage) |
| `orders_benefits_list` | 주문 혜택 목록 | Retrieve a list of order benefits applied to an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-order-benefits-applied-to-an-order) |
| `orders_calculation_total` | 주문 결제 금액 계산 | Calculate total due | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#calculate-total-due) |
| `orders_coupons_list` | 주문 쿠폰 목록 | Retrieve a list of coupons applied to an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-coupons-applied-to-an-order) |
| `orders_dashboard_list` | 주문 대시보드 | List all orders dashboard | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#list-all-orders-dashboard) |
| `orders_inflowgroups_list` | 유입 그룹 목록 | Retrieve a list of traffic source groups | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-traffic-source-groups) |
| `orders_inflowgroups_create` | 유입 그룹 생성 | Create a traffic source group | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-traffic-source-group) |
| `orders_inflowgroups_update` | 유입 그룹 수정 | Update a traffic source group | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-traffic-source-group) |
| `orders_inflowgroups_delete` | 유입 그룹 삭제 | Delete a traffic source group | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-traffic-source-group) |
| `orders_inflows_list` | 유입 출처 목록 | Retrieve a list of group traffic sources | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-group-traffic-sources) |
| `orders_inflows_create` | 유입 출처 생성 | Create a group traffic source | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-group-traffic-source) |
| `orders_inflows_update` | 유입 출처 수정 | Update a group traffic source | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-group-traffic-source) |
| `orders_inflows_delete` | 유입 출처 삭제 | Delete a group traffic source | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-group-traffic-source) |
| `orders_memos_list` | 관리자 메모 목록 | Retrieve a list of admin memos for an order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-admin-memos-for-an-order) |
| `orders_migrations_get` | 이관 주문 조회 | Retrieve order from migrated store | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-order-from-migrated-store) |
| `orders_migrations_create` | 이관 주문 생성 | Create order from migrated store | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-order-from-migrated-store) |
| `orders_migrations_update` | 이관 주문 수정 | Update order from migrated store | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-order-from-migrated-store) |
| `orders_migrations_delete` | 이관 주문 삭제 | Delete order from migrated store | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-order-from-migrated-store) |
| `orders_paymentamount_get` | 결제 금액 조회 | Retrieve a payment amount | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-payment-amount) |
| `orders_saleschannels_list` | 판매 채널 목록 | Retrieve a list of sales channels | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-sales-channels) |
| `orders_saleschannels_create` | 판매 채널 생성 | Create a sales channel | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-sales-channel) |
| `orders_saleschannels_update` | 판매 채널 수정 | Update a sales channel | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-sales-channel) |
| `orders_saleschannels_delete` | 판매 채널 삭제 | Delete a sales channel | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-sales-channel) |
| `payments_status_update_multiple` | 결제 상태 일괄 변경 | Update payment status for multiple orders | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-payment-status-for-multiple-orders) |
| `refunds_list` | 환불 목록 | Retrieve a list of refunds | GET | `refunds` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-refunds) |
| `refunds_get` | 환불 단건 조회 | Retrieve a refund | GET | `refunds/{refund_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-refund) |
| `reservations_get` | 예약 상품 조회 | Retrieve a booked item | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-booked-item) |
| `return_get` | 반품 조회 | Retrieve a return | GET | `return/{return_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-return) |
| `return_create_multiple` | 반품 일괄 생성 | Create multiple order returns | POST | `return` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-multiple-order-returns) |
| `return_update` | 반품 수정 | Update a return | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-return) |
| `returnrequests_create` | 반품 요청 생성 | Create a return request for multiple items | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-return-request-for-multiple-items) |
| `returnrequests_reject` | 반품 요청 거부 | Reject a return request for multiple items | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#reject-a-return-request-for-multiple-items) |
| `cancellation_get` | 취소 조회 | Retrieve an order cancellation | GET | `cancellation/{cancellation_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-order-cancellation) |
| `cancellation_create_multiple` | 취소 일괄 생성 | Create multiple order cancellations | POST | `cancellation` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-multiple-order-cancellations) |
| `cancellation_update_bulk` | 취소 상세 일괄 변경 | Change cancellation details in bulk | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#change-cancellation-details-in-bulk) |
| `cancellationrequests_create` | 취소 요청 생성 | Create a cancellation request for multiple items | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-cancellation-request-for-multiple-items) |
| `cancellationrequests_reject` | 취소 요청 거부 | Reject a cancellation request for multiple items | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#reject-a-cancellation-request-for-multiple-items) |
| `cashreceipt_list` | 현금영수증 목록 | Retrieve a list of cash receipts | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-cash-receipts) |
| `cashreceipt_create` | 현금영수증 발행 | Create a cash receipt | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-cash-receipt) |
| `cashreceipt_update` | 현금영수증 수정 | Update a cash receipt | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-cash-receipt) |
| `cashreceipt_cancel` | 현금영수증 취소 | Update a cash receipt cancellation | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-cash-receipt-cancellation) |
| `collectrequests_update` | 수거 요청 수정 | Update a collection request | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-collection-request) |
| `control` | 주문 컨트롤 | Order control | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#order-control) |
| `exchange_get` | 교환 조회 | Retrieve an exchange | GET | `orders/exchange/{order_id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-exchange) |
| `exchange_create_multiple` | 교환 일괄 생성 | Create multiple exchanges | POST | `orders/exchanges` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-multiple-exchanges) |
| `exchange_update_multiple` | 교환 일괄 수정 | Update multiple order exchanges | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-multiple-order-exchanges) |
| `exchangerequests_create_bulk` | 교환 요청 일괄 생성 | Bulk exchange request API | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#bulk-exchange-request-api) |
| `exchangerequests_reject_multiple` | 교환 요청 일괄 거부 | Reject an exchange request for multiple items | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#reject-an-exchange-request-for-multiple-items) |
| `fulfillments_create` | 풀필먼트 배송 생성 | Create shipping information for multiple orders via fulfillment | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-shipping-information-for-multiple-orders-via-fulfillment) |
| `labels_list` | 주문 라벨 목록 | Retrieve order labels | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-order-labels) |
| `labels_create_multiple` | 주문 라벨 일괄 생성 | Create multiple order labels | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-multiple-order-labels) |
| `orderform_properties_get` | 주문서 추가 필드 조회 | Retrieve an additional checkout field | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-additional-checkout-field) |
| `orderform_properties_create` | 주문서 추가 필드 생성 | Create an additional checkout field | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-additional-checkout-field) |
| `orderform_properties_update` | 주문서 추가 필드 수정 | Update an additional checkout field | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-additional-checkout-field) |
| `orderform_properties_delete` | 주문서 추가 필드 삭제 | Delete an additional checkout field | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-additional-checkout-field) |
| `shipments_create_multiple` | 배송 일괄 생성 | Create shipping information for multiple orders | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-shipping-information-for-multiple-orders) |
| `shipments_update_multiple` | 배송 일괄 수정 | Update multiple order shippings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-multiple-order-shippings) |
| `subscription_shipments_get` | 정기배송 조회 | Retrieve a subscription | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-subscription) |
| `subscription_shipments_create` | 정기배송 생성 | Create a subscription | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-subscription) |
| `subscription_shipments_update` | 정기배송 수정 | Update a subscription | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-subscription) |
| `subscription_shipments_items_update` | 정기배송 상품 옵션 수정 | Update product variants in subscription | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-product-variants-in-subscription) |
| `unpaidorders_list` | 미결제 주문 목록 | Retrieve unpaid orders | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-unpaid-orders) |

```

#### `spec/conventions/cafe24-api-catalog/personal.md`
```
# Cafe24 API Catalog — Personal (개인화)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `carts_list` | 장바구니 목록 조회 | Retrieve a shopping cart | GET | `carts` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-shopping-cart) |
| `wishlists_list` | 위시리스트 조회 | Retrieve a list of products in customer wishlist | GET | `wishlists` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-products-in-customer-wishlist) |
| `customers_wishlist_count` | 위시리스트 상품 개수 | Retrieve a count of products in customer wishlist | GET | `customers/wishlist/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-products-in-customer-wishlist) |
| `products_carts_count` | 상품 담은 장바구니 수 | Retrieve a count of carts containing a product | GET | `products/{product_no}/carts/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-carts-containing-a-product) |
| `products_carts_list` | 상품 담은 장바구니 목록 | Retrieve a list of carts containing a product | GET | `products/{product_no}/carts` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-carts-containing-a-product) |

```

#### `spec/conventions/cafe24-api-catalog/privacy.md`
```
# Cafe24 API Catalog — Privacy (개인정보)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

> **별도 승인 필요** — 본 resource 의 `mall.read_privacy` / `mall.write_privacy` scope 는 카페24 본사가 별도 승인한 클라이언트만 사용할 수 있다 (명단 SoT: [`cafe24-restricted-scopes.md §1`](../cafe24-restricted-scopes.md#1-scope-단위-별도-승인-resource-전체-영향)). 모든 row 의 `restricted` 컬럼 = `scope`, 대응 backend 메타데이터 `restrictedApproval.level='scope'`, `category='privacy'`.

## 표

| id | 라벨 (한) | English title | method | path | scope | restricted | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|---|
| `customers_privacy_get` | 회원 개인정보 조회 | Retrieve a customer information | GET | `privacy/customers/{member_id}` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-information) |
| `customers_privacy_list` | 회원 개인정보 목록 조회 | Retrieve a list of customer information | GET | `privacy/customers` | read | scope | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-information) |
| `customers_privacy_count` | 회원 개인정보 개수 조회 | Retrieve a count of customer information | GET | `privacy/customers/count` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-information) |
| `customers_privacy_update` | 회원 개인정보 수정 | Update a customer information | PUT | `privacy/customers/{member_id}` | write | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-information) |
| `products_wishlist_customers_list` | 위시리스트 보유 회원 목록 | Retrieve a list of customers with a product in wishlist | GET | `products/{product_no}/wishlist/customers` | read | scope | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers-with-a-product-in-wishlist) |
| `products_wishlist_customers_count` | 위시리스트 보유 회원 수 | Retrieve a count of customers with a product in wishlist | GET | `products/{product_no}/wishlist/customers/count` | read | scope |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customers-with-a-product-in-wishlist) |

```

#### `spec/conventions/cafe24-api-catalog/product.md`
```
# Cafe24 API Catalog — Product (상품)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `product_list` | 상품 목록 조회 | Retrieve a list of products | GET | `products` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-products) |
| `product_get` | 상품 단건 조회 | Retrieve a product resource | GET | `products/{product_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-resource) |
| `product_create` | 상품 생성 | Create a product | POST | `products` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-product) |
| `product_update` | 상품 수정 | Update a product | PUT | `products/{product_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product) |
| `product_delete` | 상품 삭제 | Delete a product | DELETE | `products/{product_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product) |
| `product_variants_list` | 상품 품목(옵션) 목록 조회 | Retrieve a list of product variants | GET | `products/{product_no}/variants` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-variants) |
| `product_variants_inventory_update` | 상품 품목 재고 수정 | Update a product variant inventory | PUT | `products/{product_no}/variants/{variant_code}/inventories` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-variant-inventory) |
| `product_count` | 상품 개수 조회 | Retrieve a count of products | GET | `products/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-products) |
| `product_variants_get` | 상품 품목 단건 조회 | Retrieve a product variant | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-variant) |
| `product_variants_update` | 상품 품목 수정 | Update a product variant | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-variant) |
| `product_variants_update_multiple` | 상품 품목 일괄 수정 | Update multiple product variants | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-multiple-product-variants) |
| `product_variants_delete` | 상품 품목 삭제 | Delete a product variant | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product-variant) |
| `product_variants_inventory_get` | 상품 품목 재고 조회 | Retrieve inventory details of a product variant | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-inventory-details-of-a-product-variant) |
| `product_options_list` | 상품 옵션 목록 조회 | Retrieve a list of product options | GET | `products/{product_no}/options` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-options) |
| `product_options_create` | 상품 옵션 생성 | Create product options | POST | `products/{product_no}/options` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-product-options) |
| `product_options_update` | 상품 옵션 수정 | Update product options | PUT | `products/{product_no}/options` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-product-options) |
| `product_options_delete` | 상품 옵션 삭제 | Delete a product option | DELETE | `products/{product_no}/options/{option_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product-option) |
| `product_additionalimages_create` | 추가 이미지 등록 | Create an additional product image | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-additional-product-image) |
| `product_additionalimages_update` | 추가 이미지 수정 | Update an additional product image | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-additional-product-image) |
| `product_additionalimages_delete` | 추가 이미지 삭제 | Delete an additional product image | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-additional-product-image) |
| `product_images_upload` | 상품 이미지 업로드 | Upload product images | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#upload-product-images) |
| `product_images_delete` | 상품 이미지 삭제 | Delete product images | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-product-images) |
| `product_approve_get` | 상품 승인 상태 조회 | Retrieve a product approval status | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-approval-status) |
| `product_approve_create` | 상품 승인 요청 | Create a product approval request | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-product-approval-request) |
| `product_approve_update` | 상품 승인 상태 변경 | Update a product approval status | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-approval-status) |
| `product_customproperties_get` | 상품 사용자 정의 속성 조회 | Retrieve user defined properties by product | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-user-defined-properties-by-product) |
| `product_customproperties_update` | 상품 사용자 정의 속성 수정 | Update user defined properties by product | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-user-defined-properties-by-product) |
| `product_customproperties_delete` | 상품 사용자 정의 속성 삭제 | Delete user defined properties by product | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-user-defined-properties-by-product) |
| `product_decorationimages_list` | 상품 꾸미기 이미지 목록 | Retrieve a list of product decoration images | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-decoration-images) |
| `product_decorationimages_set` | 상품 꾸미기 이미지 설정 | Set decoration images for a product | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#set-decoration-images-for-a-product) |
| `product_decorationimages_update` | 상품 꾸미기 이미지 수정 | Update product decoration images | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-product-decoration-images) |
| `product_decorationimages_delete` | 상품 꾸미기 이미지 삭제 | Remove a product decoration image | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#remove-a-product-decoration-image) |
| `product_discountprice_get` | 상품 할인가 조회 | Retrieve a product discounted price | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-discounted-price) |
| `product_hits_count` | 상품 조회수 카운트 | Retrieve a count of product views | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-product-views) |
| `product_icons_list` | 상품 아이콘 목록 | Retrieve a list of product icons | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-icons) |
| `product_icons_set` | 상품 아이콘 설정 | Set icons for a product | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#set-icons-for-a-product) |
| `product_icons_update` | 상품 아이콘 수정 | Update product icons | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-product-icons) |
| `product_icons_delete` | 상품 아이콘 삭제 | Remove a product icon | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#remove-a-product-icon) |
| `product_memos_list` | 상품 메모 목록 | Retrieve a list of product memos | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-memos) |
| `product_memos_get` | 상품 메모 단건 조회 | Retrieve a product memo | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-memo) |
| `product_memos_create` | 상품 메모 생성 | Create a product memo | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-product-memo) |
| `product_memos_update` | 상품 메모 수정 | Update a product memo | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-memo) |
| `product_memos_delete` | 상품 메모 삭제 | Delete a product memo | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product-memo) |
| `product_seo_get` | 상품 SEO 조회 | Retrieve a product's SEO setting

... (truncated due to size limit) ...
```

## 진행 중 plan 문서 모음 (plan/in-progress/)

### plan/in-progress 진행 중 문서

#### `plan/in-progress/0-unimplemented-overview.md`
```
# 미구현 항목 오버뷰 (PRD/Spec 기준)

> 작성일: 2026-05-11
> 출처: `prd/0-overview.md` §6.2~§6.3, 각 PRD/Spec 문서의 ❌·🚧 표기, 코드베이스 spot-check
> 검증 일자 기준: 2026-05-11. 본 문서의 "현재 상태"는 본 시점의 코드/스펙 비교 결과이며, 진행 시점에 다시 확인할 것

본 문서는 `prd/`와 `spec/`을 전수 정독해 식별한 **아직 구현되지 않았거나 부분 구현 상태인 항목**의 인덱스다. 각 항목은 카테고리별 plan 문서로 분리해 추적한다.

---

## 작업 흐름 권장 순서

다음 순서로 plan을 소화하면 의존성 충돌이 적다.

1. **`ai-agent-tool-connection-rewrite.md`** — AI Agent 도구 연결은 의도적으로 제거되어 재설계 대기 중. 사용자 가치 큼, 다른 plan과 독립적.
2. **`parallel-p2.md`** — 중첩 Parallel, `waitAll: false`, `errorPolicy` schema 노출. `logic-node-followups`와 별개로 진행 가능.
2-1. **`merge-p2-async-fanin.md`** (신규) — Merge `timeout` / `partialOnTimeout` P2 활성화. `logic-node-followups` D3 의 fallback 분리 — 엔진 비동기 dispatch 모델 도입 PoC 가 선결 조건.
3. **`background-monitoring-api.md`** — Background 노드는 ✅ 구현됐으나 `meta.backgroundRunId` 모니터링 API는 미구현.
4. **`replay-rerun.md`** — Re-run (재실행) 정책 도입.
5. **`team-workspace-followups.md`** — 공유 워크플로우 표시 + 미가입자 초대 토큰.
6. **`2fa-webauthn.md`** — WebAuthn 2FA.
7. **`accessibility-voiceover-validation.md`** — macOS VoiceOver 수동 검증.
8. **`self-hosting-deployment.md`** — Docker Compose 셀프 호스팅 풀 번들, Helm Chart, 운영·보안 가이드.
9. **`marketplace-and-plugin-sdk.md`** — 마켓플레이스 + 커스텀 노드 SDK (가장 큰 미구현 덩어리).

> 각 plan에는 배경 / 관련 PRD-Spec 참조 / 작업 단위 / 수용 기준이 포함된다. 본 인덱스는 plan 간 우선순위·의존 관계만 정리한다.

### 최근 완료

- ✅ **`prd-spec-sync.md`** (2026-05-11, `plan/complete/prd-spec-sync.md`) — Graph RAG ❌→✅, NF-OB-05 cron ✅, EH-NAV-04 ✅, Background spec 4문서 정합화, 매뉴얼 (knowledge-base.mdx 한·영) 정합화.
- ✅ **`logic-node-followups.md`** (2026-05-11, `plan/complete/logic-node-followups.md`) — D1 If/Else `is_type`/`regex` evaluator 통합 ✅, D2 Loop breakCondition + meta.exitReason ✅, D3 Merge P2 → 별도 plan (`merge-p2-async-fanin.md`) 분리 ✅, D4 Switch `meta.value` alias 제거 + 마이그레이션 ✅, D5 Variable Modification recordValues opt-in + 마스킹 유틸 ✅, D6 보류 ✅, D7 case id reserved word 검증 ✅. spec/4-nodes/1-logic 의 P0/P1 미구현 표기 모두 정리 (Merge dormant 표기는 별도 plan 분리에 따른 의도적 잔존).
- ✅ **`llm-provider-followups.md`** (2026-05-11, `plan/complete/llm-provider-followups.md`) — Azure OpenAI 스트리밍 ✅ / Local LLM (Ollama·vLLM) 검증 ✅. `AzureOpenAIClient`·`LocalClient` 가 `OpenAIClient.stream()` 을 상속하여 자동 지원. spec 2종(7-llm-client.md §8.2, 4-ai-assistant.md §1.2/§11/§13/§15) 🚧·❌→✅, PRD 0 §6.1, 매뉴얼 4종(llm-config.mdx 한·영 + overview.mdx 한·영) 정합화.

---

## 카테고리별 미구현 항목 매핑

### A. 제품 기능 (사용자 가치 큰 기능)

| PRD/Spec 항목 | 상태 | 처리 plan |
|---------------|------|-----------|
| **PRD 1 §3.9 NAV-MP-01~07 Marketplace** | ❌ 전체 미구현 (i18n 사전에만 등장) | `marketplace-and-plugin-sdk.md` |
| **PRD 4 §4 MP-CT/CS/PB-***| ❌ 전체 미구현 | `marketplace-and-plugin-sdk.md` |
| **PRD 3 §10 ND-EX-01~03 노드 확장성 SDK** | ❌ 우선순위 3 | `marketplace-and-plugin-sdk.md` |
| **PRD 5 NF-EX-04 노드 플러그인 시스템** | ❌ | `marketplace-and-plugin-sdk.md` |
| **PRD 2 §4 ED-PL-05 마켓 커스텀 노드 팔레트 표시** | (마켓 의존) | `marketplace-and-plugin-sdk.md` |
| **PRD 3 §6.1 ND-AG-06/10/21 AI Agent 도구 연결** | 🚧 의도적 제거, 재작성 예정 | `ai-agent-tool-connection-rewrite.md` |
| **PRD 3 §4.9 ND-PL-03 Parallel 결과 합산 / 중첩 Parallel / waitAll=false** | 🚧 P2 예정 | `parallel-p2.md` |
| **Spec 4-nodes/1-logic/3-loop §1 / §6 breakCondition** | ✅ 활성화 (D2, meta.exitReason 추가) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/1-if-else `is_type` / `regex` 연산자** | ✅ 구현 (D1, evaluator 통합) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/0-common If/Else, Switch `meta.matchedConditions` / `meta.matchedCaseIndex`** | ✅ 핸들러 구현 + spec 정합 (PR-1) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/0-common Variable Decl/Mod meta** | ✅ 핸들러 구현 + recordValues opt-in (D5) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/11-merge `timeout` / `partialOnTimeout`** | 🚧 P2 dormant (엔진 비동기 모델 선결) | `merge-p2-async-fanin.md` |
| **Spec 4-nodes/1-logic/12-background 모니터링 API** | ❌ 미구현 (`meta.backgroundRunId` 키만 발급) | `background-monitoring-api.md` |
| **Spec 5-system/4-execution-engine §6.3 Re-run** | 🚧 미구현 (future PRD) | `replay-rerun.md` |
| **PRD 1 §3.11 NAV-UP-05 미가입자 초대 토큰** | 🚧 후속 (가입 사용자 추가만 ✅) | `team-workspace-followups.md` |
| **PRD 1 §3.1 NAV-WF-07 공유 워크플로우 표시** | 🚧 백엔드만 존재, UI 미노출 | `team-workspace-followups.md` |
| **PRD 5 NF-SC-10 2FA WebAuthn** | 🚧 TOTP만 ✅, WebAuthn 후속 | `2fa-webauthn.md` |

### B. 인프라/배포 (셀프 호스팅)

| PRD 항목 | 상태 | 처리 plan |
|----------|------|-----------|
| **PRD 5 NF-SC-08 셀프 호스팅 보안 가이드** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-EX-03 단일~클러스터 셀프 호스팅** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-02 Docker Compose 셀프 호스팅 번들** | ❌ (현재 docker-compose.yml은 dev infra만) | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-03 Kubernetes Helm Chart** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-06 셀프 호스팅 설치/운영 문서** | ❌ | `self-hosting-deployment.md` |

### C. LLM Provider 확장 — ✅ 완료 (2026-05-11)

본 카테고리는 `plan/complete/llm-provider-followups.md` 에서 모두 처리됨. 결과:

| Spec 항목 | 처리 결과 |
|-----------|-----------|
| **Spec 3-workflow-editor/4 §11 Azure OpenAI 스트리밍** | 🚧 → ✅ (`AzureOpenAIClient extends OpenAIClient` 상속으로 자동 지원, deployment name + `api-version` 매핑) |
| **Spec 5-system/7 §8.2 LLM Client Local (Ollama/vLLM) 스트리밍** | 🚧 → ✅ (`LocalClient extends OpenAIClient` 로 OpenAI 호환 엔드포인트 자동 지원. Ollama 11434 / vLLM OpenAI-compat 모드 검증 완료) |

### D. 접근성

| PRD 항목 | 상태 | 처리 plan |
|----------|------|-----------|
| **PRD 5 NF-A11Y-03 macOS VoiceOver 수동 검증** | 🚧 자동화 ✅, 수동 체크리스트 사용자 수행 대기 | `accessibility-voiceover-validation.md` |

### E. PRD/Spec ↔ 코드 정합성 정리 (실제로는 구현 끝) — ✅ 완료 (2026-05-11)

본 카테고리는 `plan/complete/prd-spec-sync.md` 에서 모두 처리됨. 결과:

| 항목 | 처리 결과 |
|------|-----------|
| **PRD 9 Graph RAG 전체** | ❌ 로드맵 → ✅ P0~P2 구현 완료 (KB-GR-MD/EX/DM/SR/PA/UI/OB-* 모든 ID 에 상태 컬럼 추가). `prd/9-graph-rag.md` §2.1·§3·§6·§7 + `prd/0-overview.md` §6.1 갱신 |
| **PRD 5 NF-OB-05 알림 cron** | 🚧 → ✅ (5분 BullMQ repeatable + cooldown 명시) |
| **PRD 7 EH-NAV-04 AI Assistant read-only 도구** | ❌ → ✅ (`get_workflow_executions` / `get_execution_details` 가 ED-AI-35~38 모두 충족) |
| **Spec Background 노드 (5문서)** | 5-system/4-execution-engine §3.3, 1-data-model.md, 3-workflow-editor/0-canvas.md (3건), 1-node-common.md, 2-edge.md 모두 "🚧 미구현" 제거 + 평면 구현(ND-BG-05) 으로 통일 |
| **AI Agent Tool Area spec 박스** | 재작성 plan(`ai-agent-tool-connection-rewrite.md`) 와 상호 링크 추가 |
| **사용자 매뉴얼** | `frontend/src/content/docs/06-integrations-and-config/knowledge-base.mdx` 한·영 — Graph 모드 "로드맵" 안내 → 실제 사용법 + 검색 파라미터 + Entity/Relation 관리 가이드로 재작성 |

---

## plan 문서 목록

```
plan/in-progress/
├── 0-unimplemented-overview.md        ← 본 문서 (인덱스)
├── ai-agent-tool-connection-rewrite.md ← AI Agent 일반 도구 연결 재설계
├── merge-p2-async-fanin.md            ← Merge timeout/partialOnTimeout — 엔진 비동기 모델 선결
├── parallel-p2.md                     ← 중첩 Parallel·waitAll=false·errorPolicy 노출
├── background-monitoring-api.md       ← meta.backgroundRunId 모니터링 API
├── replay-rerun.md                    ← Re-run 재실행 기능 도입
├── team-workspace-followups.md        ← 공유 워크플로우 표시 + 미가입자 초대 토큰
├── 2fa-webauthn.md                    ← WebAuthn 2FA 추가
├── accessibility-voiceover-validation.md ← macOS VoiceOver 수동 체크리스트
├── self-hosting-deployment.md         ← Docker Compose 풀 번들·Helm·가이드 문서
└── marketplace-and-plugin-sdk.md      ← 마켓플레이스 전체 + 노드 플러그인 SDK

plan/complete/
├── prd-spec-sync.md                   ← §E "PRD/Spec ↔ 코드 정합성 정리" 완료 (2026-05-11)
├── llm-provider-followups.md          ← §C "LLM Provider 확장" 완료 (2026-05-11)
└── logic-node-followups.md            ← Logic 노드 잔여 P0/P1 (D1·D2·D4·D5·D7) 완료, D3 → merge-p2-async-fanin.md 분리 (2026-05-11)
```

각 plan 문서는 다음 구조를 따른다:

- **배경** — PRD/Spec의 어떤 항목이 미구현인지, 현 코드 상태
- **관련 문서** — PRD·Spec·메모리·기존 plan 링크
- **작업 단위** — 체크박스 todo 목록 (SDD: spec → 테스트 → 구현 순서)
- **수용 기준** — Definition of Done
- **의존성·리스크** — 다른 plan, 외부 시스템 영향

---

## 참고: 이미 완료되어 본 plan에 포함되지 않은 영역

- `plan/complete/feature-roadmap/stages.md` Stage 1~11 (LLM 토큰 추적 / Parallel P1 / Background 평면 구현 / 팀 워크스페이스 UI / RBAC / 2FA TOTP / 조직 Integration 공유 / OTel 트레이싱 / 알림 룰 CRUD / 접근성 자동화 / 매뉴얼 검색)
- `plan/complete/node-architecture/*` (handler colocation, schema audit, sub-workflow execution 등)
- `plan/complete/workflow-assistant/*` (Workflow AI Assistant 본체)
- `plan/complete/ai-knowledge-base/*` (Phase 2 KB + Graph RAG PRD 단계 — 코드 구현은 ✅, PRD 표기 갱신은 본 plan의 `prd-spec-sync.md`에서 처리)

```

#### `plan/in-progress/20260516-full-review/RESOLUTION.md`
```
---
worktree: full-review-fixes-a1b2c3
started: 2026-05-16
owner: developer
---

# Full-Review Resolution — 2026-05-16

> 기준 보고서: `plan/in-progress/20260516-full-review/SUMMARY.md`
> 작업 worktree: `.claude/worktrees/full-review-fixes-a1b2c3` / branch `claude/full-review-fixes-a1b2c3`
> 사용자 요청: "우선순위가 높은 순서대로 의사결정이 필요 없는 부분을 순차적으로 경고 단계까지 모두 처리해줘"
> 검증: 백엔드 단위 테스트 3,762/3,762 통과, `tsc --noEmit -p tsconfig.build.json` 통과

본 문서는 위 SUMMARY 의 발견사항 중 "의사결정 불필요 + 위험도 Critical~Warning" 항목을 1회 작업으로 일괄 처리한 결과를 기록한다. 후속 의사결정이 필요한 항목과 deferred 항목은 마지막 두 절에서 명시한다.

---

## 처리 완료 (Critical)

| # | 위치 | 변경 |
|---|------|------|
| C-5 | `backend/src/modules/execution-engine/execution-engine.service.ts:3637,3679,3735` | `planContainerBody` 안의 `allNodes.find()` 를 함수 도입부에서 1회 생성한 `nodeMap` 의 `nodeMap.get()` 호출로 전환. 동일 `nodeMap` 을 반환 plan 에 재사용해 중복 Map 생성 제거 |
| C-7 | spec/*.md 11곳 | `11-mcp-client.md#23-internal-bridge` 깨진 앵커를 실제 헤딩(`### 2.3 Internal Bridge (in-process)`) 의 GFM slug `#23-internal-bridge-in-process` 로 일괄 치환 |
| C-9 | `backend/migrations/V052__notification_type_integration_action_required.sql` (신규) | `notification.type` CHECK 제약에 `integration_action_required` 추가. `IntegrationActionRequiredNotifierService` INSERT 가 check_violation 으로 실패하던 결함 해소 |
| C-11 (부분) | `backend/src/main.ts`, `backend/src/modules/hooks/hooks.service.spec.ts` | `NestFactory.create(AppModule, { rawBody: true })` 적용 (HMAC 서명 검증 활성화). HMAC + bearer 경로 단위 테스트 9건 추가 (length mismatch / equal-length mismatch / valid match / missing signature / missing rawBody / signature mismatch / valid sha256 / unsupported algorithm 등) |
| C-13 | `backend/package.json` | `overrides` 에 `protobufjs ^7.5.6`, `fast-uri ^3.1.2` 추가. `npm audit` 결과 fast-uri/protobufjs 다중 CVE 해소 (잔여: hono via @modelcontextprotocol/sdk W-57, OTel breaking W-54/W-56 — deferred) |
| C-14 | `spec/conventions/conversation-thread.md:3` | `[Spec AI 공통 §11](.../0-common.md#11-conversation-context)` → `[Spec AI 공통 §10](.../0-common.md#10-conversation-context-자동-컨텍스트-주입)`. 실제 헤딩 번호 10 과 동기화 |
| C-15 | `spec/2-navigation/4-integration.md:951` | `[Spec Cafe24 API 메타데이터 §6](.../cafe24-api-metadata.md#6-allowlist-와의-관계)` → `§7` / `#7-allowlist-와의-관계`. 실제 헤딩 번호 7 과 동기화 |

W-60 (V049 파일-디렉토리 충돌) 은 현 base 커밋(`3f5457aa`) 에 빈 V049 디렉토리가 존재하지 않아 별도 조치 없이 already-resolved 로 분류한다.

---

## 처리 완료 (Warning)

| # | 위치 | 변경 |
|---|------|------|
| W-2 | `backend/src/modules/hooks/hooks.service.ts:18,159` | HMAC 알고리즘 허용 목록 `Set(['sha256','sha512'])` 신설. `verifyAuth` 안에서 외부 입력 algorithm 을 허용 목록 외 값일 때 `UnauthorizedException`. 단위 테스트 1건 추가 |
| W-15 | `spec/5-system/10-graph-rag.md:236` | `graph_extraction_status` Enum 값에 `failed` 추가 + 부연 설명. §7/§3.2 의 영구 실패 분기와 자체 모순 해소 |
| W-21 | `backend/src/modules/statistics/statistics.service.ts:80` | `getSummary` 의 unconditional 워크스페이스 집계 쿼리 + workflowId 별 재집계 패턴을 단일 QueryBuilder 로 통합. workflowId 가 있을 때만 `andWhere` 추가, 첫 쿼리 결과 폐기 제거 |
| W-22 | `backend/src/modules/executions/executions.service.ts:20,127` | `executionPath` 조회에 `MAX_EXECUTION_PATH_ROWS=10000` 상한 (`take`). 대규모 ForEach 로그 행 메모리 적재량 안전망. 관련 spec 테스트 갱신 |
| W-25 | `backend/src/modules/websocket/websocket.service.ts:92` | `sanitizePayloadForWs` 가 자식 mutation 없는 경우 원본 참조를 반환하도록 변경. GC pressure 감소 + emit hot path 의 객체 할당 제거 |
| W-31 (5건) | `backend/src/modules/integrations/services/credentials-transformer.ts`, `backend/src/modules/integrations/integrations.service.ts:702`, `backend/src/modules/integrations/integration-oauth.service.ts:282,307`, `backend/src/nodes/presentation/table/table.handler.ts:264` | `console.warn` / `console.error` 5곳을 NestJS `Logger` 인스턴스로 교체. 모듈 수준 인스턴스가 필요한 곳은 `new Logger('<name>')` 로 import |
| W-37 | `backend/src/modules/hooks/hooks.service.spec.ts` | `constantTimeEquals` 분기 (length mismatch / equal-length / 성공) 단위 테스트가 bearer + HMAC 시나리오로 9건 추가 (C-11 와 합쳐 한 번에 작성) |
| W-41 | `backend/test/webhook-trigger.e2e-spec.ts:74,95,112,134` | `e2e-X-${Date.now()}` 4곳을 `crypto.randomBytes(8).toString('hex')` 기반으로 전환. 동시 e2e 실행 시 endpointPath 충돌 방지 |
| W-46 | `backend/src/common/dto/pagination.dto.ts:11,53` | `PaginationQueryDto.sort` 에 `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)` + `@MaxLength(64)` 적용. 서비스별 `getSortColumn()` 화이트리스트를 보조하는 DTO 레벨 1차 차단 |
| W-55 | `backend/package.json` | C-13 와 함께 `fast-uri` overrides 추가. `npm audit` GHSA-q3j6-qgpj-74h6 / GHSA-v39h-62p7-jpjc 해소 |
| W-63 | `backend/migrations/V053__notification_workspace_type_resource_idx.{sql,conf}` (신규) | `notification(workspace_id, type, resource_id, created_at DESC)` 복합 인덱스를 `CONCURRENTLY` 로 추가. `NotificationsService.hasRecentByResource` idempotency 쿼리 hot path 인덱스 보강 |
| W-68 | `backend/src/modules/websocket/websocket.gateway.ts:217` | `authorize()` await 경계 이후 `clientSubs.size >= MAX_SUBSCRIPTIONS_PER_CONNECTION` 재검사 추가. 동시 subscribe 가 한도 검사를 interleave 하는 race 해소 |
| W-69 | `spec/4-nodes/4-integration/4-cafe24.md:23,90` | `pagination` 필드의 `cursor?: string` 제거 + 사유 문구 추가. §3, §4.2 의 cursor 언급 동시 삭제 |
| W-77 | `frontend/README.md:7` | `yarn dev` / `pnpm dev` / `bun dev` 명령 제거. 루트 CLAUDE.md "패키지 매니저" 규약(npm 전용) 과 정합 |
| W-79 | `packages/expression-engine/README.md`, `packages/node-summary/README.md` (신규) | 두 패키지의 목적·빌드·사용·boundary 를 정리한 최소 README 작성 |
| W-80 | `README.md:333` | h1 `# integration (SSO)` 을 h2 로 강등. 직속 자식 `## Google OAuth 연동 설정` 도 h3 로 동시 강등 |

> 자료의 단일 진실 원칙 상, 본 표의 변경은 모두 동일 branch (`claude/full-review-fixes-a1b2c3`) 의 단일 작업 단위로 묶여 있다.

---

## 의사결정 보류 (사용자/스펙 합의 필요)

| # | 사유 |
|---|------|
| C-1 / C-2 | Re-run 기능 백엔드·프론트엔드 완전 미구현. 신규 worktree 에서 `replay-rerun.md` PR2 단위로 별도 진행 필요 |
| C-3 | AI Agent 일반 도구 연결 모델 결정 — 사용자 합의 필요 |
| C-4 | `sanitizePayloadForWs` 설정 레이어 이동 — emit hot path 의 trust boundary 재설계 필요 (allowlist 정의가 의사결정 사안) |
| C-6 | `ExecutionEngineService` God-Object 분해 — 4단계 분리안 (`AiConversationOrchestrator` 등) 별도 plan 으로 진행 |
| C-8 | README 포트 혼재 — 환경별(host dev=3000 vs docker fullstack=3012) 매핑 정확도 확인이 필요 |
| C-10 | `AuthConfig.config` 평문 → encryptedJsonTransformer + 평문 행 마이그레이션 스크립트 — 데이터 마이그레이션 절차 사용자 합의 필요 |
| C-12 | Cafe24 OAuth callback/refresh e2e — HTTP stub 컨테이너 추가가 e2e 인프라 변경 사안 |
| W-1 | WebSocket CORS `*` → frontendUrl 화이트리스트 — 환경 분기(`NODE_ENV==='production'`) 외의 조건 결정 필요 |
| W-3 | DOMPurify `ALLOWED_ATTR` 의 `style` 제거 — CSS 정책 결정 필요 |
| W-4 / W-5 | DNS rebinding / DB 호스트 SSRF — 보안 정책 결정 필요 |
| W-6 | sub-workflow workspace 격리 — 엔진 invariant 변경, 별도 plan 권장 |
| W-7~W-14 | 요구사항 항목 (`errorPolicy`, marketplace SDK, integration_action_required UI 등) — 각각 별도 plan |
| W-16 | API 경로 prefix `/api/v1/` vs `/api/` — 정책 확정 필요 |
| W-18 | spec §2.2 API 직호출 대비 — 별도 spec 보강 |
| W-19 | i18n parity main 병합 여부 확인 (다른 worktree 상태 검증) |
| W-23 | `deriveContainerAssignments` 16 패스 — 자료구조 재설계 필요 |
| W-24 | `appendExecutionPath` 배치 INSERT 전환 — 별도 PR 권장 |
| W-26 / W-27 | expression-resolver/ws snapshot 캐시 — 별도 PR 권장 |
| W-28 / W-29 / W-30 / W-33~W-36 | 대형 파일 분해·헬퍼 단일화 리팩토링 — 영역별 별도 PR |
| W-44 / W-47 / W-48 | API 계약 변경 (controller 단 IDOR 보강, throttle, PATCH 패턴) — 호환성·spec 동시 갱신 필요 |
| W-49~W-53 | 아키텍처 디커플링 (DI 토큰, 순환 의존 해소, common/shared 경계, Cafe24ApiClient 분해) — 별도 plan |
| W-54 / W-56 | OpenTelemetry 0.76.0 업데이트 — breaking change, 호환성 검증 필요 |
| W-57 | `@modelcontextprotocol/sdk` 최신화 → hono 취약점 해소 — SDK breaking 확인 필요 |
| W-58 / W-59 | Playwright/MinIO 이미지 버전 정렬 — 사용자 환경 검증 |
| W-61 / W-62 / W-64 | DB·entity·service 변경 — 호출자 영향 확인 필요 |
| W-65 / W-66 / W-67 | 동시성 (boot race, schedule runner, foreach context clone) — invariant 변경, 별도 PR |
| W-70 / W-71 | 커밋 원자성 원칙 수립 — 프로세스 차원의 합의 |
| W-72 / W-73 / W-74 / W-75 | 부작용 (redis config 확장, OnModuleDestroy, OAUTH_STUB_MODE 가드 통합, mock 보강) — 영향 범위 확인 필요 |
| W-76 | `INTEGRATION_ENCRYPTION_KEY` README 보강 — C-8 README 포트 결정과 함께 처리 권장 |
| W-78 | spec Rationale 56개 보강 — 우선순위별 별도 plan |

---

## 검증

```bash
cd backend
npx tsc --noEmit -p tsconfig.build.json   # exit 0 (src 빌드 그래프 클린)
npx jest --no-coverage --silent           # 210 suites / 3,762 tests / all passed
npm audit                                 # fast-uri / protobufjs CVE 해소 (잔여: hono via mcp/sdk W-57, OTel W-54/W-56)
```

후속 작업으로 commit + PR 작성은 사용자 confirm 후 진행한다.

---

## 후속 조치 (`/ai-review` 통합 후 처리)

PR #126 commit `13d21fcd` 에 대한 `/ai-review` (router 11/13 선별, Critical 0 / Warning 15 / Info 27) 결과 발견된 Warning 항목을 추가 처리했다. 검증: tsc clean, 211 suites / 3,772 tests 통과.

| # | 영역 | 위치 | 변경 |
|---|------|------|------|
| F-A | 부작용/DB | `backend/migrations/V052__*.{sql,conf}` | `ALTER TABLE ADD CONSTRAINT NOT VALID` + `VALIDATE CONSTRAINT` 2단계 + 화이트리스트 외 행 pre-flight 검사 (`RAISE EXCEPTION`). `executeInTransaction=false` 로 짧은 ACCESS EXCLUSIVE lock 만 사용 |
| F-B | 동시성 | `backend/src/modules/websocket/websocket.gateway.ts` | `authorize()` 후 한도 검사·`Set.add`·tentative-add 롤백 패턴으로 묶음. 단위 테스트: deferred authorize 동시 2건에서 정확히 1건만 성공하는지 검증 |
| F-C | 보안 | `backend/src/modules/hooks/hooks.service.ts` | 미허용 HMAC 알고리즘 응답에서 알고리즘 명 제거 (`"Authentication failed"` 고정). 진단은 `this.logger.warn` 으로만. 단위 테스트로 응답에 `md5` 노출 안 됨 검증 |
| F-D | 보안 | `backend/src/modules/websocket/websocket.service.ts` | `sanitizePayloadForWs` 가 `depth > MAX_SANITIZE_DEPTH` 도달 시 원본 대신 `'[REDACTED_DEPTH]'` 반환. 단위 테스트로 깊이 12 페이로드에서 평문 secret 직렬화 미노출 검증 |
| F-E | 요구사항/문서 | `backend/src/modules/executions/executions.service.ts`, `executions.service.spec.ts` | `MAX_EXECUTION_PATH_ROWS` export + 응답에 `executionPathTruncated: boolean` 노출. 테스트에서 10,000 행 case 추가 |
| F-F | 테스트 | `websocket.service.spec.ts`, `websocket.gateway.spec.ts`, `hooks.service.spec.ts`, `pagination.dto.spec.ts` (신규) | 참조 동일성 / depth-redact / sha512 성공 / HMAC 응답 비누출 / WS race / pagination 식별자 패턴 양·음성 케이스 추가 (+10 testcase) |
| F-G | 문서 | `spec/5-system/12-webhook.md` §4.2, `backend/src/common/dto/pagination.dto.ts` | HMAC 알고리즘 허용 목록·information leakage 차단·rawBody 요구를 spec 에 명시. `@ApiPropertyOptional` 에 `pattern`/`maxLength` 메타데이터 추가 |
| F-INFO | 유지보수성 | `backend/src/modules/integrations/integration-oauth.service.ts` | 모듈 수준 logger 변수명 `moduleLogger` → `logger` (다른 파일과 일관성) |
| F-호환성 | 프론트엔드 | grep 결과 | `frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx:152` 의 `sort: "started_at"` 가 신규 `@Matches` 패턴에 적합. 기존 클라이언트 호환성 영향 없음 |

여전히 보류되는 deferred 항목은 위 §의사결정 보류 표 그대로 유지된다.

```

#### `plan/in-progress/20260516-full-review/SUMMARY.md`
```
# Code Review 통합 보고서

> 기준 커밋: `bbd838ef` (main)
> 검토 일시: 2026-05-16
> 범위: spec/, backend/, frontend/, packages/ 전체
> 리뷰 세션: `plan/in-progress/20260516-full-review/`
> 세션 메타: 13/13 reviewer 성공, 총 154 issue

---

## 세션 개요

본 세션은 표준 `review/code/<...>` 경로가 아닌 `plan/in-progress/20260516-full-review/`에서 실행된 전체 코드베이스 audit 세션이다. 사용자 강조 관점은 **일관성**, **스펙 준수**, **보안**, **리팩토링** 4개 축이다.

---

## 전체 위험도

**HIGH** — Critical 보안/데이터 결함 9건, 구현 미완성(Re-run) 3건, 테스트 커버리지 공백 2건 포함. 즉각 조치가 필요한 CRITICAL 항목이 다수 존재하며, 특히 AuthConfig 평문 저장과 HMAC 웹훅 인증 무동작은 운영 환경 보안에 직결된다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| C-1 | 요구사항/스펙 | Re-run 기능 백엔드·프론트엔드 완전 미구현. `POST /executions/:id/re-run`, chain API, 권한 가드, rate limit, audit log, 프론트 UI 모두 없음 | `executions.controller.ts` 전체; `spec/5-system/13-replay-rerun.md`; `plan/in-progress/replay-rerun.md` §3/4/5 전체 미체크 | 새 worktree에서 `replay-rerun.md` PR2 착수. DB 마이그레이션(`re_run_of`, `chain_id` 컬럼) 선행 |
| C-2 | 요구사항/데이터모델 | `Execution` 엔티티에 Re-run 추적 컬럼(`re_run_of`, `chain_id`) 누락 — spec RR-PL-05 및 `spec/1-data-model.md §2.13` 정의 미반영 | `execution.entity.ts:21-81`; `spec/5-system/13-replay-rerun.md §9.1` | TypeORM migration으로 컬럼 추가 + `spec/1-data-model.md §2.13` 갱신 |
| C-3 | 요구사항/AI | AI Agent 일반 도구 연결(ND-AG-06/10/21) 의도적 제거 후 재설계 완전 미결 — 핵심 AI 기능 무기한 보류 | `plan/in-progress/ai-agent-tool-connection-rewrite.md §1`; `spec/4-nodes/3-ai/1-ai-agent.md` | 도구 연결 모델 결정을 위한 사용자 합의를 우선 진행 |
| C-4 | 성능 | `sanitizePayloadForWs`가 모든 WS emit 경로에서 재귀 순회 실행 — 대규모 ForEach(5000+ emit) 시 CPU 병목 | `backend/src/modules/websocket/websocket.service.ts:92-107` | 설정 레이어에서 한 번만 적용하고 WS emit 시 재검사 생략; `messages` 배열 등 신뢰된 필드는 allowlist 방식으로 skip |
| C-5 | 성능 | ForEach 내부 `allNodes.find()` O(N) 선형 탐색이 매 iteration 반복 — 1000회 ForEach × 500노드 시 500,000회 비교 발생 | `execution-engine.service.ts:3679`; `planContainerBody` 내 여러 곳 | `nodeMap.get(id)` O(1) 조회로 전환 (Map이 이미 존재함) |
| C-6 | 아키텍처 | `ExecutionEngineService` 4,733줄 God-Object — 그래프 순회·노드 dispatch·상태 머신·WS 이벤트·AI 대화·분산 continuation을 단일 파일에 집중 | `execution-engine.service.ts:377` 전체 | `AiConversationOrchestrator`, `UserInteractionService`, `GraphTraversalService`, `ExecutionEventEmitter`로 분리 |
| C-7 | 문서 | `spec/5-system/11-mcp-client.md` 헤딩 변경으로 앵커 링크 13건 전 코드베이스에서 파손 (`#23-internal-bridge` → `#23-internal-bridge-in-process`) | `spec/1-data-model.md:247`, `spec/0-overview.md:101`, `spec/4-nodes/4-integration/4-cafe24.md:3,11,337` 외 8개 파일 | 헤딩을 `### 2.3 Internal Bridge`로 단순화하거나 11개 참조 파일 앵커 일괄 수정 |
| C-8 | 문서/보안 | README `FRONTEND_URL` 포트 3000·3002·3012 세 가지 혼재 — OAuth redirect URI 오등록 위험 | `README.md:183, 217, 354-357`; `docker-compose.yml:176` | 환경별(host dev=3000, docker fullstack=3012) 명확히 구분해 기재 |
| C-9 | 데이터베이스/보안 | `integration_action_required` 알림 타입이 DB CHECK constraint에 없어 INSERT 시 `check_violation` 오류로 알림 발사 전체 실패 | `backend/migrations/V001__initial_schema.sql:338`; `integration-action-required-notifier.service.ts:76` | `V052__notification_type_integration_action_required.sql` 마이그레이션 즉시 추가 |
| C-10 | 데이터베이스/보안 | `AuthConfig.config` JSONB가 평문 저장 — spec은 `JSONB (encrypted)` 명시, Webhook Bearer Token/API Key 등 민감 인증 정보 노출 위험 | `auth-config.entity.ts:31`; `auth-configs.service.ts` | `Integration.credentials`와 동일한 `encryptedJsonTransformer` 적용 + 기존 평문 행 마이그레이션 스크립트 |
| C-11 | 테스트/보안 | `HooksService.verifyAuth` HMAC 분기 단위 테스트 전무 + `main.ts`에 `rawBody: true` 미설정으로 HMAC 인증이 운영에서 실제로 동작하지 않을 가능성 | `main.ts`; `hooks.service.spec.ts`; `webhook-trigger.e2e-spec.ts:133-167` | `NestFactory.create(AppModule, { rawBody: true })` 추가; HMAC 단위 테스트 5개 시나리오 추가 |
| C-12 | 테스트 | Cafe24 OAuth callback/BullMQ refresh e2e 미존재 — 핵심 토큰 획득·갱신 경로의 회귀 안전망 부재 | `backend/test/` (관련 파일 없음) | `docker-compose.e2e.yml`에 HTTP stub 컨테이너 추가 후 `integration-cafe24-callback.e2e-spec.ts` 작성 |
| C-13 | 의존성/보안 | `protobufjs <=7.5.5` 다중 CVE — 코드 인젝션, DoS, Prototype pollution 5건 이상 | `backend/package.json` 간접 dep (`@google/genai`, `@opentelemetry/*`) | `npm audit fix` 또는 `"overrides": { "protobufjs": "^7.5.6" }` 추가 |
| C-14 | 문서 | `spec/4-nodes/3-ai/0-common.md#11-conversation-context` 앵커 오기재(실제 섹션 번호 10) | `spec/conventions/conversation-thread.md:3` | 앵커를 `#10-conversation-context-자동-컨텍스트-주입`으로 수정 |
| C-15 | 문서 | `spec/conventions/cafe24-api-metadata.md#6-allowlist-와의-관계` 앵커 불일치(실제 섹션 번호 7) | `spec/2-navigation/4-integration.md:951` | 앵커를 `#7-allowlist-와의-관계`로 수정 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | 보안 | WebSocket 게이트웨이 CORS 와일드카드(`*`) | `websocket.gateway.ts:52` | `NODE_ENV=production`에서 `origin: configService.get('app.frontendUrl')`로 제한 |
| W-2 | 보안 | 웹훅 HMAC `hmacAlgorithm` 허용 목록 없음 | `hooks.service.ts:144`; `create-trigger.dto.ts:61` | `@IsIn(['sha256', 'sha512'])` 검증 추가 |
| W-3 | 보안 | DOMPurify `ALLOWED_ATTR`에 `style` 포함 — CSS 클릭재킹·데이터 유출 벡터 | `presentation-renderers.tsx:45` | `style` 속성 제거; 필요시 `afterSanitizeAttributes` hook으로 CSS 속성 단위 허용 |
| W-4 | 보안 | HTTP Request 노드 DNS rebinding 2차 공격 미차단 | `http-safety.ts:8-12` | `dns.lookup` 결과 IP 재검사 또는 egress 방화벽 보완 |
| W-5 | 보안 | Database Query 노드 사용자 제공 DB 호스트 SSRF 검증 없음 | `database-query.handler.ts:333` | `isPrivateHost`+`resolvesToPrivate` 검증 추가 |
| W-6 | 보안/아키텍처 | sub-workflow 실행 시 workspace 격리 검증 누락 — 교차 workspace 실행 가능 | `execution-engine.service.ts:1049-1054, 1155-1160, 718-725` | `executeSync/Async/Inline` 내부에서 대상 workflow의 `workspaceId` 비교 검증 |
| W-7 | 요구사항 | Parallel 노드 `errorPolicy` schema 미노출 — 항상 기본값 `stop` 동작 | `parallel.schema.ts`; `spec/4-nodes/1-logic/10-parallel.md §1` | `parallel-p2.md §1` 처리 — schema에 `errorPolicy` 노출 |
| W-8 | 요구사항 | Merge 노드 `timeout`/`partialOnTimeout` dormant — 설정해도 warn 로그만 | `merge.handler.ts:89-101` | 프론트엔드 설정 패널에 disabled + 툴팁; 또는 validate 경고 룰 추가 |
| W-9 | 요구사항 | 마켓플레이스·플러그인 SDK 전체 미구현 | `spec/2-navigation/8-marketplace.md`; `plan/in-progress/marketplace-and-plugin-sdk.md` | `0-unimplemented-overview.md` 권장 순서로 Phase A부터 진행 |
| W-10 | 요구사항 | `integration_action_required` 프론트엔드 type-specific 처리 미구현 | `frontend/src/components/` (notification 관련) | frontend notification 컴포넌트에 type-specific 분기 추가 |
| W-11 | 요구사항 | `0-unimplemented-overview.md` 인덱스가 실제 구현 현황과 불일치 | `plan/in-progress/0-unimplemented-overview.md:54, 108-120` | background 모니터링 API 항목 ✅ 갱신 + plan 목록 재동기 |
| W-12 | 보안 | install endpoint IP 기반 rate limiting 미구현 | `cafe24-backlog-residual.md §A-3` | nginx 또는 ThrottlerModule IP 기반 rate limit 추가 |
| W-13 | 요구사항 | Cafe24 BullMQ refresh 실패 시 Sentry/외부 오류 추적 미정의 | `cafe24-backlog-residual.md §D-2` | 에러 격리 정책 spec 명시 + 외부 오류 추적 결정 |
| W-14 | 테스트 | `exchangeCodeForToken`/`refreshAccessToken` fetch 단위 테스트 5개 시나리오 전체 미체크 | `cafe24-backlog-residual.md §B-5-8` | mock fetch + fixture 기반 단위 테스트 추가 |
| W-15 | 스펙 | `graph_extraction_status` Enum에 `failed` 누락(§2.2 vs §7·§3.2 자체 모순) | `spec/5-system/10-graph-rag.md §2.2` | `§2.2` Enum에 `failed` 추가; consistency-check C2 처리 |
| W-16 | 스펙 | API 경로 prefix 혼재 `/api/v1/` vs `/api/` | `spec/5-system/2-api-convention.md` | prefix 정책 확정 + 전체 spec 경로 통일 |
| W-17 | 유지보수성 | `workflow.handler.ts` 에러 분류 문자열 매칭 — 메시지 변경 시 silent regression | `workflow.handler.ts:216-220` | Typed error 계층 도입 후 `instanceof` 분기 전환 |
| W-18 | 스펙 | Cafe24 install endpoint `pending_install` 상태 보호 미명시 | `spec-update-cafe24-test-connection.md §9.1` | spec §2.2 API 직호출 대비 조항 추가 + 구현 확인 |
| W-19 | 요구사항 | i18n ko↔en dict parity 자동 가드 main 병합 여부 불명확 | `harness-i18n-userguide-gap.md`; `harness-review-router-c4f1a2` worktree | worktree 상태 확인 → main 병합 완료 여부 검증 |
| W-20 | 문서/API | Cafe24 신규 에러 코드 2종 Swagger `@ApiResponse` 미명시 | `cafe24-backlog-residual.md §D-1` | 관련 controller에 `@ApiResponse` 데코레이터 추가 |
| W-21 | 성능 | `getSummary`에서 `workflowId` 필터 시 동일 쿼리 두 번 실행 — 첫 번째 결과를 버림 | `statistics.service.ts:80-123` | 단일 쿼리로 통합 |
| W-22 | 성능 | `executionPath` 조회 — 수천 행 메모리 적재 후 `nodeId`만 추출 | `executions.service.ts:123-127` | `MAX_PATH_ROWS` 상한 + LIMIT SQL 절 추가 |
| W-23 | 성능 | `deriveContainerAssignments` 엣지 변경마다 최대 16 패스 × 전체 엣지 동기 순회 — 대형 워크플로 UI 렉 | `frontend/src/lib/stores/editor-store.ts:281-304` | containerId를 엣지에 embed하거나 증분 방식 전환; 단기: pass 상한 축소 |
| W-24 | 성능 | `appendExecutionPath` 노드 실행 시마다 개별 INSERT — 100노드 × 50 ForEach = 5000 INSERT | `execution-engine.service.ts:1554-1567` | 완료 시점에 배치 INSERT로 전환 |
| W-25 | 성능 | `sanitizePayloadForWs` 재귀 호출마다 빈 `result` 객체 새로 생성 — GC pressure | `websocket.service.ts:98` | 민감 키 없으면 원본 참조 반환 |
| W-26 | 성능 | `resolveString`에서 `FULL_EXPRESSION_PATTERN` 중복 정규식 매칭 | `expression-resolver.service.ts:239-245` | 단일 패스 처리 또는 `evaluate` 반환값에 플래그 포함 |
| W-27 | 성능 | `emitExecutionSnapshot` REPEATABLE READ + `findById` 전체 조회 — 동시 구독자 多일 때 반복 heavy 조회 | `websocket.gateway.ts:258-284` | 완료된 실행 snapshot Redis 캐시; 장기: snapshot 전용 경량 쿼리 |
| W-28 | 유지보수성 | `APP_URL` 폴백 리터럴 두 파일 6곳 분산 + `replace(/\/$/, '')` 체인 누락 | `integrations.service.ts:830,1076`; `integration-oauth.service.ts:490,968,1079,1359` | `getAppBaseUrl()` 단일 함수로 통합 |
| W-29 | 유지보수성 | 메시지 길이 상한 불일치 — `LAST_ERROR_MESSAGE_MAX_LEN=200` vs `MCP_ERROR_MESSAGE_MAX_LEN=2048`, 클램프 함수 이중 구현 | `integration-oauth.service.ts:193,220`; `mcp-error-codes.ts:35` | `integrations-error-utils.ts`로 통합 |
| W-30 | 유지보수성 | `extractSid`/`extractOperationId` 파싱 로직 두 provider에 별도 구현 | `cafe24-mcp-tool-provider.ts:454-468`; `mcp-tool-provider.ts:150-161` | `parseMcpToolName` 재사용으로 중복 제거 |
| W-31 | 유지보수성 | `console.warn`/`console.error`가 NestJS Logger 대신 사용된 위치 5곳 이상 | `integrations.service.ts:702`; `integration-oauth.service.ts:307`; `credentials-transformer.ts:45,58`; `table.handler.ts:264-269` | `this.logger.warn/error` 또는 `new Logger(...)` 교체 |
| W-32 | 유지보수성 | `EXPIRING_SOON_INTERVAL` SQL 내장 vs 프론트엔드 `EXPIRING_SOON_DAYS=7` 주석으로만 동기화 | `integrations.service.ts:250` | 공유 상수로 추출 |
| W-33 | 유지보수성 | `integration-oauth.service.ts`(1,818줄) 단일 클래스에 OAuth 흐름 전반과 Cafe24 특화 로직 혼재 | `integration-oauth.service.ts` 전체 | Cafe24 특화 로직을 `cafe24-oauth.service.ts`로 분리 |
| W-34 | 유지보수성 | `ai-agent.handler.ts`(2,099줄) 단일 파일에 AI 에이전트 거의 모든 책임 집중 | `ai-agent.handler.ts` 전체 | `RagAccumulator`, 렌더링 유틸, 멀티-턴 상태 관리 분리 |
| W-35 | 유지보수성 | `IntegrationOAuthService.begin()` Cafe24 private/public 3단 중첩 — 순환 복잡도 높음 | `integration-oauth.service.ts:364` | `beginCafe24(params, meta)`로 추출 + 얼리 리턴 패턴 |
| W-36 | 유지보수성 | `credentials-transformer.ts` 모듈 수준 전역 boolean 플래그 — 테스트 간 상태 오염 가능 | `credentials-transformer.ts:38-39` | `resetWarningFlags()` hook 제공 또는 Logger rate-limiter 활용 |
| W-37 | 테스트 | `HooksService.constantTimeEquals` 분기 미커버 | `hooks.service.ts:176-181` | 길이 불일치·성공 케이스 단위 테스트 추가 |
| W-38 | 테스트 | Cafe24 install e2e `mall_id 불일치 → 403` 케이스 명시됐으나 미구현 | `integration-cafe24-install.e2e-spec.ts:20` | `rejection paths` describe 블록에 케이스 추가 |
| W-39 | 테스트 | Nonce cache Redis 키 HMAC 앞 8자 prefix 충돌 위험 미테스트 | `cafe24-install-nonce-cache.service.ts:108` | 동일 prefix 두 HMAC 독립성 검증; 또는 전체 HMAC 해시로 키 설계 변경 검토 |
| W-40 | 테스트 | `cafe24-token-refresh.processor.spec.ts` `Date.now()` fake timer 없이 사용 | `cafe24-token-refresh.processor.spec.ts:32,48` | `jest.useFakeTimers()` + `jest.setSystemTime()` 사용 |
| W-41 | 테스트 | 웹훅 e2e `Date.now()` 기반 `endpointPath` 생성 — 병렬 실행 시 충돌 가능 | `webhook-trigger.e2e-spec.ts:74,95,112,134` | `randomBytes(8).toString('hex')` 사용 |
| W-42 | 테스트 | `integration-cafe24-install.e2e-spec.ts` credentials 암호화 transformer 우회 — production 경로 미커버 | `integration-cafe24-install.e2e-spec.ts:84-111` | `credentials-transformer.spec.ts`에 암호화/비암호화 경로 통합 추가 |
| W-43 | 테스트 | 웹훅 HMAC 양성 케이스가 `hooks.service.spec.ts`에 위임된다고 명시됐으나 실제로는 없음 — 참조 단절 | `webhook-trigger.e2e-spec.ts:155` | `hooks.service.spec.ts`에 올바른 rawBody+HMAC 서명 케이스 추가 |
| W-44 | API 계약 | `GET /executions/:id`, `GET /executions/workflow/:workflowId` workspaceId 소유권 미검증 IDOR | `executions.controller.ts:56-79` | `@WorkspaceId()` 파라미터 추가 + `verifyOwnership()` 호출 |
| W-45 | API 계약 | webhook spec(§5.2) 에러 응답 형식이 실제 GlobalExceptionFilter envelope과 불일치 | `spec/5-system/12-webhook.md:248-254`; `http-exception.filter.ts:63-72` | spec §5.2를 실제 envelope(`{ error: { code, message, details } }`)과 동기화 |
| W-46 | API 계약 | `PaginationQueryDto.sort` 허용 값 미검증 — 서비스별 `getSortColumn()` 누락 위험 | `pagination.dto.ts:46-51` | DTO 레벨에 `@IsIn([...])` 공통 허용 값 추가 |
| W-47 | API 계약/보안 | `POST /auth/login`/`POST /auth/register`에 개별 throttle 미적용 — spec 10 req/min 대신 100 req/min | `auth.controller.ts:165-200,104-135` | `@Throttle({ default: { ttl: 60_000, limit: 10 } })` 추가 |
| W-48 | API 계약 | `PATCH /notifications/:id/read` — spec §12.1 상태 토글 패턴 위반 | `notifications.controller.ts:73` | `PATCH /notifications/:id` + body `{ isRead: true }`로 변경 또는 spec 예외 명문화 |
| W-49 | 아키텍처 | `ExecutionEngineService` 생성자 16개 의존성 과부하 | `execution-engine.service.ts:421-457` | `HandlerDependenciesFactory` 분리 또는 `NodeRuntimeContext` 인터페이스 추상화 |
| W-50 | 아키텍처 | `ExecutionEngineModule`이 `Cafe24Module` 직접 import — OCP 위반 | `execution-engine.module.ts:25` | `CAFE24_API_CLIENT` DI 토큰 추상화, AppModule conditional provider 등록 |
| W-51 | 아키텍처 | `WebsocketModule` ↔ `ExecutionEngineModule` ↔ `KnowledgeBaseModule` 양방향 순환 의존성 | `execution-engine.module.ts:43`; `websocket.module.ts:22-26`; `knowledge-base.module.ts:38` | `EventEmitter2` 기반 이벤트 분리로 순환 해소 |
| W-52 | 아키텍처 | `backend/src/common` vs `backend/src/shared` 역할 경계 미명시 — `S3Service`가 `common/`에 위치 | `backend/src/common/`, `backend/src/shared/` | `common/` = HTTP/NestJS 레이어, `shared/` = 레이어 독립 타입으로 정의, `S3Service` 이동, ADR 명문화 |
| W-53 | 아키텍처 | `Cafe24ApiClient`(1,271줄) HTTP 요청, rate-limit, OAuth 토큰 갱신, 상태 전이 혼재 | `cafe24-api.client.ts` 전체 | `Cafe24HttpTransport`, `Cafe24TokenManager`, `Cafe24RateLimiter`로 분해 |
| W-54 | 의존성 | OTel 패키지 두 버전 공존(`sdk-node@0.205.0` + `0.57.2`) — trace context 전파 단절 위험 | `backend/package.json` | `@opentelemetry/auto-instrumentations-node`를 `^0.76.0`으로 업데이트 |
| W-55 | 의존성/보안 | `fast-uri` path traversal·host confusion 취약점(CVSS 7.5 HIGH) | `backend/package.json` 간접 dep | `"overrides": { "fast-uri": ">=3.2.0" }` 추가 |
| W-56 | 의존성/보안 | OTel Prometheus DoS 취약점(CVSS 7.5 HIGH) | `@opentelemetry/auto-instrumentations-node@0.55.3` | `^0.76.0`으로 업데이트 |
| W-57 | 의존성 | `hono` JWT 검증 오류·CSS 인젝션·cross-user 캐시 누수 | `backend/package.json` 간접 dep | `@modelcontextprotocol/sdk` 최신 버전으로 업데이트 |
| W-58 | 의존성/테스트 | Playwright docker 이미지(v1.47.0)와 devDependencies(`^1.59.1`) 12 minor 버전 불일치 | `docker-compose.e2e.yml:169`; `frontend/package.json` | docker 이미지를 lock 파일 기준 버전과 일치하도록 업데이트 |
| W-59 | 의존성 | `minio/minio:latest` 태그 미고정 | `docker-compose.yml`, `docker-compose.e2e.yml` | 특정 date-tagged release로 고정 |
| W-60 | 데이터베이스 | V049 마이그레이션 파일-디렉토리 명충돌 — Flyway Linux 환경 예측 불가 동작 | `backend/migrations/V049__integration_consecutive_network_failures.sql` | `git rm -r`로 빈 디렉토리 제거 |
| W-61 | 데이터베이스 | `NotificationsService.findByResource` workspaceId 격리 없음 — 향후 재사용 시 IDOR 위험 | `notifications.service.ts:22-30` | 선택적 `workspaceId` 파라미터 추가 |
| W-62 | 데이터베이스 | `install_token` 컬럼 `VARCHAR(64)` vs spec "길이 제약 없음" 서술 불일치 | `integration.entity.ts:62`; `V042__cafe24_private_app_pending_install.sql:13` | spec Rationale 수정 또는 마이그레이션으로 `TEXT` 변경 |
| W-63 | 데이터베이스 | `hasRecentByResource` 복합 조건 쿼리 인덱스 누락 — 알림 발사 시마다 seq scan | `notifications.service.ts:125-134` | `CREATE INDEX CONCURRENTLY idx_notification_workspace_type_resource` 추가 |
| W-64 | 데이터베이스 | `duplicate`(Workflow 복사) 시 Nodes/Edges 미복사 — 메서드명과 동작 불일치 가능 | `workflows.service.ts:171-188` | spec 의도 확인; 전체 복사라면 `dataSource.transaction` + Node/Edge 복사 |
| W-65 | 동시성 | `pendingContinuations` Map 핸들러 등록 타이밍 race — 부팅 직후 cancel 메시지 drop 가능 | `execution-engine.service.ts:459-526` | 메시지 버퍼 + handler 등록 시 flush 패턴; 또는 `OnApplicationBootstrap`으로 통일 |
| W-66 | 동시성 | `ScheduleRunnerService.onModuleInit` 다중 인스턴스 중복 upsert 동작 가정 미명시 | `schedule-runner.service.ts:107-126` | 동작 가정을 코드 주석에 명시 또는 lock 활용 |
| W-67 | 동시성 | `ForEachExecutor` context 직접 mutate — Parallel 조합 시 잠재 오염 위험 | `foreach-executor.ts:78-83` | `{ ...context, itemContext: { ... } }` shallow clone 전달 |
| W-68 | 동시성 | `handleSubscribe` async await 경계에서 MAX_SUBSCRIPTIONS 한도 재검사 누락 | `websocket.gateway.ts:64` | `authorizer.authorize` 완료 후 `clientSubs.size` 재검사 |
| W-69 | 변경 범위 | B-3-7 cursor 제거 후 `spec/4-nodes/4-integration/4-cafe24.md` §3/§4.2 미갱신 | `spec/4-nodes/4-integration/4-cafe24.md:23,90` | spec에서 `cursor` 언급 제거 + Rationale 결정 근거 명문화 |
| W-70 | 변경 범위 | `test(cafe24)` 커밋에 프로덕션 런타임 동작 변경(`logUsage` try/catch) 혼입 | `d6baf89a`; `integration-handler-base.ts` | fix/test 성격 분리 커밋 원칙 수립 |
| W-71 | 변경 범위 | refactor 커밋에 review 아카이브 파일 26개 혼입 — 코드 히스토리 가독성 저하 | `eacbd45e`, `bb038f90` | review 산출물은 별도 `chore(review):` 커밋으로 분리 |
| W-72 | 부작용 | `Cafe24InstallNonceCache` 독립 Redis 연결 생성 — `redis.config.ts`에 `password/tls` 키 미정의로 인증 Redis 도입 시 replay 방어 무음 비활성화 | `cafe24-install-nonce-cache.service.ts:43-65` | `redisConfig`에 `password/tls` 키 추가 또는 공유 ioredis 인스턴스 DI |
| W-73 | 부작용 | `Cafe24InstallNonceCache.close()` NestJS `OnModuleDestroy` 미등록 — 정상 종료 시 Redis 연결 누수 | `cafe24-install-nonce-cache.service.ts:115-121` | `implements OnModuleDestroy` + `async onModuleDestroy() { await this.close(); }` |
| W-74 | 부작용 | `OAUTH_STUB_MODE` 가드 로직이 세 곳에 서로 다른 허용 목록으로 중복 | `integration-oauth.service.ts:66-70`; `main.ts:27-35` | `isStubModeAllowed()` 공통 유틸로 추출 |
| W-75 | 부작용 | `NotificationsService.hasRecentByResource` 신규 공개 메서드가 기존 부분 mock 테스트에서 누락 시 런타임 오류 | `notifications.service.ts:117-138` | 기존 mock에 `hasRecentByResource: jest.fn()` 추가 |
| W-76 | 문서 | README `INTEGRATION_ENCRYPTION_KEY` 누락 — 신규 개발자가 설정 시 통합 자격증명 암호화 실패 | `README.md:155-196` | `backend/.env` 예시에 `INTEGRATION_ENCRYPTION_KEY=<32-byte-hex>` 추가 |
| W-77 | 문서 | `frontend/README.md` yarn/pnpm/bun 명령 나열 — 프로젝트 규약(npm 전용)과 충돌 | `frontend/README.md:10-14` | yarn/pnpm/bun 줄 제거, npm 단일 명령만 유지 |
| W-78 | 문서 | spec 파일 85개 중 56개(66%)에 `## Rationale` 섹션 부재 | `spec/4-nodes/1-logic/` 외 다수 | 비자명한 complex 노드와 핵심 시스템 스펙부터 우선 추가 |
| W-79 | 문서 | `packages/expression-engine`, `packages/node-summary` README 없음 | `packages/expression-engine/`, `packages/node-summary/` | 최소한의 README(목적, 빌드/사용법, export API) 추가 |
| W-80 | 문서 | `README.md:328` `# integration (SSO)` h1 헤딩 수준 오류 | `README.md:328` | `## integration (SSO)`로 변경 |

---

## 참고 (INFO)

개별 항목은 생략하고 카테고리별 건수를 집계한다. 대표 항목만 인용한다.

| 카테고리 | 건수 | 대표 항목 |
|----------|------|-----------|
| 요구사항 | 7 | ED-AI-39 legacy fallback 만료 기준 미명시(`review-workflow.ts:716`); `buildIntegrationMeta` provider 레지스트리 패턴 필요 시점 미명시 |
| 보안 | 5 | bcrypt 라운드 12 상수 여러 파일 분산; expression-engine AST 샌드박스 확인됨(긍정); `.env` git 추적 제외 확인됨(긍정) |
| 성능 | 4 | `TO_CHAR` GROUP BY 인덱스 미활용 (`statistics.service.ts:135-154`); `Evaluator` new 인스턴스 매 expression 생성; `sortByStartedAt` 매 WS 이벤트마다 전체 배열 정렬 |
| 유지보수성 | 5 | `sanitizeId`/`sanitizeToolName` 동일 정규식 중복; `Cafe24McpToolProvider.__resetForTesting()` public API 노출; `result-detail.tsx` 1,111줄 |
| 테스트 | 5 | 프론트엔드 Cafe24 Private App 설치 흐름 e2e 미커버; Zustand 전역 상태 초기화 패턴 누락; fix ↔ test 추적성(`// 회귀 안전망: <issue-ref>` 주석) 낮음 |
| API 계약 | 4 | `DELETE /workspaces/:id` 204 대신 200; OAuth 콜백 access_token URL 노출(`?token=...`); `GET /login-history` cursor DTO 미사용 |
| 아키텍처 | 3 | `nodes/core/node-component.interface.ts`가 `modules/` 구체 서비스 타입 import; frontend 컴포넌트 레이어 직접 API 호출; `packages/*` 경계 건전함(긍정) |
| 의존성 | 4 | `expression-engine` `dayjs` 버전 낮음; `react`/`react-dom` exact pin; `cron-parser` 중복 설치; `p-limit@7` ESM/CJS 혼용 |
| 데이터베이스 | 3 | `AuthConfig.type` CHECK constraint ORM 미반영; `LlmConfig.apiKey` VARCHAR(500) 암호화 후 근접 가능성; `findByResource` N+1 잠재 + 인덱스 누락 |
| 동시성 | 4 | `WebsocketGateway.subscriptions` async 핸들러 interleave; Nonce SETNX 원자성 확인됨(긍정); `ContinuationBusService` 분산 락 확인됨(긍정); `ParallelExecutor.nodeOutputCache` shallow copy invariant 런타임 검증 없음 |
| 변경 범위 | 3 | `pg-error.ts` 공통 헬퍼 신설 conventions 미언급; Phase 8 spec 동시 갱신 확인됨(긍정); plan/complete 이동 시 spec 링크 갱신 여부 미확인 |
| 부작용 | 2 | `logUsage` swallow 메트릭 연동 없음; `CAFE24_MALL_ID_PATTERN` 정규식 3중 중복 |
| 문서 | 6 | spec 내 `prd/` 경로 참조 역사 표기로 잔존; spec 내 `memory/` 경로 5곳 잔존; CHANGELOG 단일 "Unreleased" 섹션; `backend/README.md` 환경변수 불완전; backend 핵심 서비스 JSDoc 밀도 저조; `frontend/README.md` 보일러플레이트 잔존 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | HIGH | Re-run 완전 미구현(C-1/C-2), AI Agent 도구 연결 무기한 보류(C-3), spec-코드-plan 3축 드리프트 |
| security | HIGH | Database Query 노드 SSRF 무방어(W-5), WebSocket CORS 와일드카드(W-1), protobufjs CVE 5건(C-13) |
| performance | HIGH | `sanitizePayloadForWs` CPU 병목(C-4), ForEach O(N) 선형 탐색(C-5), 프론트 16패스 동기 순회(W-23) |
| maintainability | MEDIUM | `APP_URL` 6곳 분산(W-28), 메시지 클램프 이중 구현(W-29), 대형 파일 2건(W-33/W-34) |
| testing | HIGH | HMAC 웹훅 운영 미동작 + 테스트 전무(C-11), Cafe24 OAuth callback e2e 부재(C-12) |
| documentation | HIGH | spec 앵커 링크 13건 파손(C-7/C-14/C-15), README 포트 혼재(C-8), `INTEGRATION_ENCRYPTION_KEY` 누락(W-76) |

... (truncated due to size limit) ...
