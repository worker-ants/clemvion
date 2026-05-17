# Rationale 연속성 Check Payload

본 파일은 orchestrator 가 Rationale 연속성 checker 용으로 작성한 입력입니다. target 문서가 기존 spec 의 `## Rationale` 에서 이미 기각·폐기된 결정을 다시 도입하거나 합의 원칙을 무시하지 않는지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자가 가리키는 경로에 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (Rationale 연속성)

1. **기각된 대안의 재도입** — target 이 과거 Rationale 에서 명시적으로 거부한 대안을 다시 채택하고 있는가 (이유 명시 없이)
2. **합의된 원칙 위반** — Rationale 에 박혀있는 설계 원칙을 따르지 않고 있는가
3. **결정의 무근거 번복** — 과거 결정을 뒤집으면서 새 Rationale 를 함께 작성하지 않고 있는가
4. **암묵적 가정 충돌** — Rationale 에 기록된 시스템 invariant 를 우회하는 설계가 들어와 있는가

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

## 관련 Rationale 발췌

### Rationale 발췌

#### `spec/1-data-model.md` 의 Rationale

## Rationale

### Execution.execution_path → ExecutionNodeLog (V035 → V036)

옛 `execution.execution_path UUID[]` 컬럼은 단일 인스턴스 환경에서는 동작했으나, 다중 backend 인스턴스가 동시에 `array_append()` 로 갱신할 때 인스턴스 간 절대 순서가 보장되지 않았다. 대체 모델로 append-only 테이블 `execution_node_log` 를 도입했고, BIGSERIAL `id` 가 PostgreSQL sequence (concurrency-safe) 로 부여되므로 `(execution_id, id)` 정렬이 곧 노드 실행 순서가 된다.

이행은 lock 영향 최소화를 위해 두 단계로 분리되었다.

- `backend/migrations/V035__execution_node_log_create.sql` — 테이블 생성 + `UNNEST WITH ORDINALITY` 로 기존 array 데이터 이행. `executeInTransaction=false`.
- `backend/migrations/V036__execution_drop_execution_path.sql` — 컬럼 DROP. `lock_timeout=3s` 로 운영 영향 최소화.

설계·운영 세부는 [`spec/5-system/4-execution-engine.md §7.4`](./5-system/4-execution-engine.md) 참고. 외부 API 응답의 `executionPath: string[]` 시그니처는 유지되며, `findById` 가 본 테이블의 정렬 쿼리로 채운다.

### install_token 형식 (32byte hex → 16byte base64url, 2026-05-15)

옛 32바이트 hex (64자) 는 Cafe24 Developers App URL 입력 필드의 100자 한도를 path prefix 단축만으로는 못 맞춰 함께 단축. 16바이트 (128-bit) 면 capability token 으로 NIST/OWASP 권장 (96-bit 이상) 을 충분히 상회. DB 컬럼 `install_token` 은 `String?` 으로 길이 제약이 없어 schema 변경 불필요 — 마이그레이션 entry 신규 추가 없음. 상세 배경·대안 비교는 [Spec 통합 화면 §9.2 Rationale "Cafe24 App URL 100자 한도 대응" 항](./2-navigation/4-integration.md#rationale).

#### `spec/2-navigation/1-workflow-list.md` 의 Rationale

## Rationale

### 1. "공유 워크플로우" 의 정의 — 팀 워크스페이스 전체

NAV-WF-07 의 "공유" 기준으로 두 옵션을 검토했다:

- (a) **팀 워크스페이스에 속한 모든 워크플로우** = 공유 (선택)
- (b) `createdBy ≠ 현재 사용자` 또는 명시적 sharedWith 컬럼 = 공유 (폐기)

(a) 를 채택한 이유:

- PRD 의 NAV-WF-07 원문("팀 워크스페이스에서 공유된 워크플로우 구분 표시")이 워크스페이스 단위의 격리·공유를 전제로 하고 있어, 워크스페이스 = 공유 단위라는 정의와 자연스럽게 부합한다.
- 데이터 모델상 워크플로우 격리는 이미 `workspaceId` 로 처리되며(`backend/src/modules/workflows/entities/workflow.entity.ts`), `sharedWith` 컬럼이나 추가 마이그레이션 없이 구현 가능하다.
- (b) 는 같은 팀 안에서 "내 것" 과 "남의 것" 을 다시 분리하는 정의지만, 그 구분은 §2.3 의 **소유 필터** 가 담당하므로 뱃지에서까지 중복으로 표현할 필요가 없다.

결과적으로 뱃지(워크스페이스 = 공유)와 필터(작성자 단위 세분화)가 역할 분담된다.

#### `spec/2-navigation/10-auth-flow.md` 의 Rationale

## Rationale

### R-1. 인증 화면 배경 — 그라데이션 복원 (2026-05-15 롤백)

§1 배경 기술을 *"제품 브랜드 색상 또는 그래디언트"* (main 표현) 로 **복원**. 이전 Stage 1 (commit `b6267429`) 에서 *"`soil-50` 단색, 그라데이션 금지"* 로 구체화했으나, 동일자 §8 부분 롤백 (`spec/6-brand.md` R-13) 에서 `soil-50` 토큰이 §8.2 와 함께 폐기되어 본 표현도 함께 복원했다.

코드 상태: `frontend/src/app/(auth)/layout.tsx` 는 `bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--muted))] to-[hsl(var(--background))]` 패턴 — Shadcn neutral 그라데이션. 로고는 `#111e14` 라운드 컨테이너 안에 별도 배치 (그라데이션 위 dark surface 로 시인성 확보).

### R-2. `[Logo]` 자리 변종 명시 (2026-05-15 정정)

§1 의 `[Logo]` 플레이스홀더에 *"Full logo 변종 사용"* 명시. 이전 Stage 1 에서는 *"Full logo (light)"* 로 라이트 한정했으나, §8 부분 롤백 (`spec/6-brand.md` R-13) 에서 라이트/다크 자산 선택을 노출 자리의 surface 톤에 위임하는 형태로 바뀌어 본 행에서도 라이트 한정을 제거.

본 문서는 로고가 노출되는 **자리**를 정의하고, 자리에 들어가는 변종·라이트/다크 선택은 brand spec §8.4.1 매트릭스 + §8.4.6 의 노출 자리 규정을 따른다 (R-9 — 브랜드 spec 의 라우트 spec 우선권).

근거 출처: `spec/6-brand.md §8.4.1`, `§8.4.6`, `R-13`. 사전 일관성 검토 세션: `review/consistency/2026/05/15/18_36_51/` (Stage 1), `review/consistency/2026/05/15/23_45_11/` (롤백).

#### `spec/2-navigation/4-integration.md` 의 Rationale

## Rationale

### Attention 가상 필터값 — Expired ∪ Expiring ∪ Error 를 단일 칩으로 노출 (2026-05-16)

§2.4 "Need attention" 배너의 클릭 동작이 spec 텍스트("`Expiring | Expired | Error` 로 자동 전환")와 구현 사이에서 어긋나 사용자가 알림에 표시된 항목을 필터 페이지에서 찾지 못하는 사례가 보고됐다. 원인은 (a) UI 의 상태 칩 모델이 단일 선택이라 세 상태를 동시에 전환할 표현이 없었고, (b) 구현이 차선책으로 `?status=expiring` 단일 필터로만 보냈기 때문이다. 본 spec 개정에서 두 가지를 정리한다.

**1. UI: `Attention` 칩 신설.** `Expired ∪ Expiring ∪ Error` 합집합을 단일 값으로 추가해 단일 선택 칩 모델을 유지하면서 합집합을 제공한다. 멀티 선택 칩 도입이나 `?status=expiring&status=expired` 같은 multi-value 쿼리도 검토했으나 (a) URL 공유성 저하, (b) 다른 단일 필터(`scope`, `q`)와의 일관성 깨짐, (c) 분석/감사 시 "사용자가 어떤 카테고리를 봤는지" 의 의도 신호가 흐려짐 으로 기각.

**2. 백엔드: 가상 필터값(virtual filter) 규약.** `Integration.status` DB Enum 은 `connected` / `expired` / `error` / `pending_install` 4개로 유지하고, API 필터의 `status` 파라미터 값 공간은 이를 포함하면서 추가로 `expiring`(이미 도입), `attention` 두 가상값을 갖는다. 가상값은 영속화되는 상태가 아니라 화면 필터링용 술어 — 백엔드 쿼리 빌더가 WHERE 절을 합성한다. 다음 두 원칙을 따른다:

- **이름 분리**: 가상값 이름은 DB Enum 과 겹치지 않는다 (`expiring`, `attention` 모두 DB 에 없음). 사용자가 칩 라벨에서 본 단어가 그대로 URL 파라미터로 들어간다.
- **DB 엔티티 비확장**: 가상값을 위해 Enum 을 늘리지 않는다 — 영속 상태와 화면 술어를 섞으면 state machine(§6) 이 비대해진다.

**3. 배너 톤·점프 동작 보강.** 분해 카운트(만료 X · 만료 임박 Y · 오류 Z) 를 한 줄에 표시해 어떤 카테고리가 몇 건인지 한눈에 보이게 한다. `error ≥ 1` 일 때 dot 색을 amber 에서 red 로 미세 강조 — 사용자가 "어떤 종류가 섞여있는지" 를 카피 읽기 전에 시각적으로 인지하게 한다. 합계 = 1 일 때는 필터링 단계가 잉여이므로 그 한 건의 detail 로 직접 점프 — 사용자가 어차피 그 건을 열어볼 것이므로 단축이 자연스럽다. "1건일 때만" 의 분기는 합계 ≥ 2 일 때 필터링이 필요한 일반 케이스와 명확히 분리된다 (필터링 → detail 의 한 클릭을 줄임).

(개정 전 텍스트는 "클릭 시 상태 필터를 `Expiring | Expired | Error`로 자동 전환" 한 줄로, 단일 선택 칩과 모순되는 의도만 남기고 구현 표현은 위임 상태였다. 본 개정으로 의도가 실제 구현 가능한 형태(`Attention` 단일 칩 + `?status=attention`)로 닫힌다.)

### Cafe24 Private 앱의 callback 실패는 왜 status 를 보존하나 (2026-05-14)

`pending_install` 상태의 Integration 이 callback 처리 중 token exchange 실패 등으로 떨어졌을 때, 자연스러운 선택지는 `error(auth_failed)` 로 전이하는 것이다. 그러나 Private 앱은 `reauthorize` 액션이 불가능하다 — OAuth 재시작은 **Cafe24 Developers 의 "테스트 실행"** 만 정식 진입점이고, 그 진입점은 우리가 발급한 `install_token` 을 path 에 그대로 사용한다. status 를 `error` 로 바꾸면 (a) UI 가 "reauthorize" 액션을 권장하지만 실제로 그 액션이 무력하고, (b) 사용자는 cafe24 측 설정을 고친 뒤 다시 "테스트 실행" 을 누르는 외부 흐름을 진행 중인데 우리 화면이 이를 "error" 로 표기해 흐름 단계를 오인하게 된다. 따라서 callback 실패는 `status_reason` + `last_error` 만 채우고 status 는 `pending_install` 그대로 유지한다. (참고: `review/consistency/2026/05/14/18_23_55`)

`status_reason` 의 저장값은 callback 에러 코드를 `snake_case` 로 표기한다 — DB 컬럼 컨벤션 전체가 `auth_failed`, `token_expired` 등 `snake_case` 인 것과 통일. 한편 API 응답·callback HTML 의 에러 코드는 `OAUTH_*`, `CAFE24_*` 같은 `UPPER_SNAKE_CASE` 를 유지한다 (HTTP 컨벤션). 동일 의미 두 표기는 §10.4 에서 매핑.

`last_error.code` 와 `status_reason` 이 같은 값을 중복 보존하는 이유: `last_error` 는 JSONB 라 보존 정책(향후 GDPR 등)에 따라 소거될 수 있다. `status_reason` 은 plain string 컬럼으로 더 가볍게 유지되며, "왜 이 상태에 있는지" 의 핵심 신호로 보존된다. `status_reason` 은 에러 분류 코드만 담아 민감 정보 미포함 → 평문 저장.

### OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유 (2026-05-14)

Cafe24 Private 의 "테스트 실행" 흐름은 `pending_install` 행이 이미 존재하는 상태에서 OAuthState 를 새로 발급해 token 교환을 완료한다 — 의미상 "기존 행에 token 을 채운다" 라는 점에서 `mode='reauthorize'` 와 동일 (`mode='new'` 는 OAuthState 에 integrationId 가 없고 callback 이 previewToken 을 발급하는 다른 흐름). 별도 `mode='cafe24_private_install'` 을 신설하는 안도 검토했으나, callback 의 처리 분기가 동일 (integration row UPDATE) 이고 §10.2 step 4 가 이미 reauthorize 를 "기존 integrationId 의 credentials 갱신" 으로 정의하고 있어 enum 확장으로 얻는 이득이 없다. status 가 `pending_install` 이냐 `connected` 이냐에 따라 callback 의 후처리만 살짝 다를 뿐 (`installToken=null` 처리 등). 단, 향후 reauthorize 와 분리해야 할 동작이 늘어나면 별도 mode 신설 검토.

### CAFE24_PRIVATE_APP_ALREADY_CONNECTED 의 mall_id 비교 경로 (2026-05-15 갱신)

**현행 (V045+)**: `mall_id` 가 plain 컬럼 (`integration.mall_id`) 으로 분리되어 — `credentials.mall_id` (encrypted JSONB) 와 동일 값을 plain 컬럼으로 복제 — SQL WHERE 절로 직접 필터링·UNIQUE 제약 강제가 가능. 부분 UNIQUE 인덱스 `(workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL` 이 같은 workspace 내 중복 cafe24 통합 생성을 SQL constraint violation 으로 거부 (TOCTOU race 차단). begin 핸들러는 in-memory 사전 체크 (connected → 409 / pending → reuse 분기 판단) 와 함께 SQL UNIQUE 를 backstop 으로 사용 — 두 검사를 모두 통과한 동시 INSERT 는 `23505 unique_violation` 으로 변환되어 같은 409 응답을 받는다.

**옛 (V045 이전, 2026-05-14)**: `mall_id` 가 암호화 JSONB 안에만 있어 SQL 필터 불가. begin 시점에 (a) 동일 workspace 의 cafe24 통합을 SQL 로 조회한 뒤 (b) ORM 경계의 자동 복호화로 `credentials.mall_id` 와 in-memory 비교. (a) O(N) decrypt 비용 + (b) SELECT 와 INSERT 사이의 TOCTOU 윈도우 두 가지 운영 위험.

**전환기**: V045 이전 행은 `mall_id` 컬럼이 NULL — 부분 UNIQUE 가 그런 행을 비교 대상에서 제외하므로 새 행과 충돌하지 않는다. 옛 행은 callback / re-auth 시점에 plain 컬럼이 backfill 되어 점진적으로 인덱스 범위로 편입된다. begin 시점의 in-memory 비교도 동일 전환기 동안 `credentials.mall_id` fallback 을 둔다.

### install_token 을 App URL path 식별 키로 승격 (2026-05-14)

원래 설계는 `GET /oauth/install/cafe24` 가 mall_id + HMAC 만 받고, 백엔드가 `pending_install` 행을 in-memory 로 100건 스캔하면서 mall_id 일치 candidates 의 client_secret 으로 HMAC 검증을 trial 했다. 두 가지 운영 위험이 누적됐다 — (a) 동일 mall_id 의 중복 `pending_install` 이 누적되면 HMAC 매칭이 비결정적이고 사용자가 보고 있는 행이 아닌 다른 행이 connected 처리될 수 있다, (b) `pending_install` 수가 커지면 O(N) 매칭 비용. App URL path 에 `install_token` 을 박으면 단일 row 조회로 고정되고, 토큰 자체가 random 이므로 추측 불가능한 식별자 역할도 겸한다. 옛 토큰 없는 경로는 별도 PR 로 즉시 제거됐다 (운영 등록자 0 인 시점에 정리 — 이후 등록자는 새 token-pathed URL 만 발급받는다).

(2026-05-15 후속: 토큰을 16바이트 base64url 22자로 단축 — 보안 동등성은 본 섹션 "Cafe24 App URL 100자 한도 대응" 항 참조)

`install_token` 은 App URL path 에 공개 포함되는 식별자로 평문 저장 — credentials/last_error 암호화 정책 대상 아님.

### CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제 (2026-05-14)

옛 `CAFE24_INSTALL_INVALID_HMAC(403, pending 미발견 포함)` 합산 정책은 토큰이 path 에 없던 시절 "어느 mall_id 에 pending 이 있는지" 정보가 응답 코드로 새지 않게 하는 안전망이었다. 새 디자인에서 `install_token` 은 **128-bit 이상 random** (현행 16바이트 base64url, 2026-05-15 단축 이전엔 32바이트 hex 256-bit) 이라 추측 불가능 — URL path 자체가 capability token 처럼 동작한다. 이 전제 하에서 "토큰 미존재" 케이스를 `CAFE24_INSTALL_INVALID_TOKEN(404)` 로 분리해도 무의미한 enumeration 이 일어나지 않는다. **이 전제가 깨지면** (예: **96-bit (12바이트) 미만으로의 토큰 길이 단축**, PRNG 변경, install_token 노출 사고) 다시 403 으로 통합해야 한다.

### install_token TTL 24h (2026-05-14)

**기존 spec §6 는 install timeout 시 `→ (삭제)` 를 명시했으나 본 개정에서 `→ expired (status_reason='install_timeout')` 로 번복한다.** 이유: 데이터 분석·감사 목적으로 보존이 유리하고, 사용자가 만료된 행을 보고 "왜 install 이 안 됐는지" 를 진단할 단서가 남아야 함. 자동 삭제는 더 이상 일어나지 않으며, manual delete 만 삭제 경로다.

Cafe24 Developers 의 앱 등록 → "테스트 실행" 까지의 사용자 작업 텀을 최대 1일로 가정한다. 더 길면 stale `pending_install` 행이 누적되어 §9.2 의 식별 키 룩업 성능과 §2.4 attention 카운트에 잡음. 더 짧으면 정상 흐름이 끊긴다 (사용자가 점심·미팅·휴일 사이클에 작업이 분할되기 쉬움). 24h 가 지나면 `status='expired'`, `status_reason='install_timeout'`, `install_token=NULL` 로 자동 전이. 만료된 행은 데이터 분석·감사 목적으로 삭제하지 않고 보존한다 (manual delete 별도).

**TTL 기준 (2026-05-15 갱신, 2026-05-16 보강)**: `install_token_issued_at` 컬럼 (V044) 을 기준으로 한다 — `created_at` 이 아닌 토큰 발급 시각. 변경 3 (중복 pending_install 재사용) 으로 같은 mall_id 의 begin 재호출이 기존 row 의 install_token 만 갱신할 때, 새 토큰이 발급되자마자 24h 카운트가 끝나 있는 문제를 해소. callback 성공 시 `install_token` 과 `install_token_issued_at` 모두 **보존**된다 (2026-05-16 갱신 — 옛 NULL 처리 기술은 "install_token persistent 격상" 결정과 미정합 표기 잔존이었다) — post-install navigation 의 식별 키이며, 24h TTL 스캐너는 `status='pending_install'` row 만 대상으로 하므로 connected 전이 후의 값이 잘못된 만료 처리에 영향을 주지 않는다. NULL 처리는 `pending_install → expired (install_timeout)` 만료 경로에서만 발생한다. 옛 (V044 이전) 행은 `install_token_issued_at` NULL — 스캐너 SQL 이 `COALESCE(install_token_issued_at, created_at)` 로 fallback 해 legacy 의미를 유지.

`status_reason='install_timeout'` 인 expired 행에서는 reauthorize 버튼이 **비활성** 이다 — Private 앱은 재인증 진입점이 없고 cafe24 "테스트 실행" 만 정식이다. 사용자는 행을 삭제 후 새로 등록한다.

### status_reason `oauth_token_exchange_failed` 와 auth 도메인의 `token_exchange_failed` 구분 (2026-05-14)

소셜 로그인 흐름(`spec/2-navigation/10-auth-flow.md`) 의 URL param `error=token_exchange_failed` 와 본 spec 의 통합 callback `status_reason='oauth_token_exchange_failed'` 는 도메인이 다른 별개 신호다 — 전자는 user authentication 도메인, 후자는 integration credentials 도메인. 의도적으로 prefix `oauth_` 를 두어 grep·index 시 도메인 구분이 자명하도록 분리했다. 이름은 통일하지 않는다.

### Cafe24 Private 의 `connected → error(auth_failed)` 복구 경로 (2026-05-14, 2026-05-16 갱신)

일반 OAuth provider 는 `expired → connected` 가 reauthorize 또는 자동 refresh 로 복구된다 (§6 / data-flow §3.1). **Cafe24 Private 앱은 reauthorize 진입점이 없고**, refresh 도 token endpoint 가 mall 별이라 일반 흐름이긴 하지만 만약 refresh 가 실패해 `error(auth_failed)` 로 떨어지면 **복구 유일 경로는 삭제 후 재등록** 이다. 이건 Private 앱의 구조적 제약 (우리 서버가 OAuth 를 시작할 수 없음) 의 당연한 귀결이며, §6 전이 표의 `expired/error → connected (reauthorize)` 항은 Cafe24 Private 에는 적용되지 않음. UI 의 reauthorize 버튼 비활성 (§4.2) 이 이 사실을 반영한다.

> **(2026-05-16 갱신)** 옛 표기는 `expired(refresh_failed)` 였으나 REQ HIGH-2 로 refresh 실패 전이가 `error(auth_failed)` 로 통일됨 — [Rationale "refresh 실패 시 status_reason 통일"](#refresh-실패-시-status_reason-통일-2026-05-16) 참고. 본문은 새 status 명을 사용하지만 복구 경로의 본질 (삭제 후 재등록) 은 변경 없음.

### `pending_install` 은 필터 칩에 추가하지 않는다 (2026-05-14)

§2.3 상태 필터 칩은 `Connected / Expiring / Expired / Error` 4종 + All 로 운영된다. `Pending install` 은 사용자가 외부 흐름(Cafe24 Developers) 을 진행 중인 **정상 전환 상태** 로 보고 필터 칩에 추가하지 않는다. 별도 필터링 수요가 발생하면 후속 plan 으로 추가 검토.

### Cafe24 App URL 100자 한도 대응 — `/api/3rd-party/<provider>/` namespace 도입 (2026-05-15)

운영 사용자가 Cafe24 Developers 의 앱 URL 입력 필드에서 "허용 길이 초과" 경고를 받아 Private 앱 연동이 막혔다. 수동 테스트 결과 100자 제한이며, 호스트 변동 가능성까지 감안해 90자를 마지노선으로 잡았다. 현행 `/api/integrations/oauth/install/cafe24/<64-hex>` 은 호스트 32자 가정 135자로 한도 초과.

**두 부분을 모두 단축**:

- **path namespace**: `/api/integrations/oauth/install/cafe24/...` (39자) → `/api/3rd-party/cafe24/install/...` (30자). 옛 namespace 는 "사용자가 호출하는 통합 관리 API" 와 "3rd party 가 호출하는 콜백·설치 API" 가 한 prefix 에 섞여 있던 구조. 3rd-party 의미가 명확한 prefix 로 분리하면 IP allowlist · rate limit · 미래 webhook receiver 같은 per-provider 처리가 sub-tree 단위로 모인다.
- **install_token**: 32바이트 hex (64자) → 16바이트 base64url no-padding (22자). 128-bit 엔트로피는 capability token 으로 충분 (NIST SP 800-63B §A.7 권장 96-bit 이상, OWASP capability token 가이드 128-bit 권장). 옛 256-bit 는 과잉.

**provider-grouped vs action-grouped**: `/api/3rd-party/cafe24/install/:token` (provider-grouped) 대신 `/api/3rd-party/install/cafe24/:token` (action-grouped) 도 검토. 두 안 모두 길이 동일. provider-grouped 채택 이유 — (a) 향후 Cafe24 webhook receiver 등을 추가할 때 `/api/3rd-party/cafe24/webhook` 처럼 같은 sub-tree 에 모임. action-grouped 면 webhook 이 또 다른 top-level segment 가 되어 비일관. (b) 새 provider 가 들어올 때 모듈 단위 (`Cafe24ThirdPartyController` 등) 매핑이 자연스럽다. (c) per-provider 미들웨어 (IP allowlist 등) prefix 가 한 곳.

**google/github callback 도 동시 이동**: cafe24 만 옮기면 callback 경로가 provider 별로 갈라져 비대칭 (`/api/3rd-party/cafe24/callback` vs `/api/integrations/oauth/callback/google`). 일관성 우선 + OAuth 콘솔 재등록을 한 번에 마치는 편이 운영상 깔끔. 운영 영향: Google Cloud Console / GitHub OAuth App / Cafe24 Developers 모두 새 redirect URI 등록 필요 (배포와 동시). 사용자 소셜 로그인용 redirect URI (`/api/auth/oauth/:provider/callback`) 는 **별개로 유지** — 두 URI 가 같은 OAuth 콘솔에 공존한다 (§10.1 참고 노트 참조).

**callback URL 표기 컨벤션**: spec 본문·표·다이어그램은 모두 파라메트릭 단일 형식 `/api/3rd-party/:provider/callback` (`:provider ∈ {cafe24, google, github}`) 만 사용한다. 컨트롤러 구현이 provider 별 분리 (3개) 인지 파라메트릭 (1개) 인지는 구현 plan 의 결정 사항.

**옛 경로 미보전**: `/api/integrations/oauth/install/cafe24/:installToken` 및 `/api/integrations/oauth/callback/:provider` 핸들러는 즉시 제거. 운영자에게 OAuth 콘솔 갱신이 강제로 가시화되는 편이 누락 없이 안전. 이전 동일 패턴 (2026-05-14, 토큰 없는 경로 즉시 제거) 의 선례를 따른다. 옛 토큰 없는 `/api/integrations/oauth/install/cafe24` 의 410 Gone hint 라우트는 현재 코드에 존재하지 않으며 (followup plan 의 가설적 항목이었음), 본 PR 의 변경과 무관.

**기존 `pending_install` 행 마이그레이션 생략**: 옛 64자 hex 토큰을 가진 행은 이미 옛 라우트와 결속되어 있고, 새 라우트는 22자 base64url 만 발급한다. 새 라우트로 호출 자체가 path-format mismatch 로 404 가 되므로 자연 만료 (24h install_timeout 스캐너) 에 맡긴다. 실제 영향 범위는 보고된 사례 자체가 "길이 초과로 등록 못 함" 상태였으므로 거의 0.

### Cafe24 App URL 재호출 흐름 — install_token persistent 격상 (2026-05-15)

Cafe24 Developers Console 에 등록한 App URL 은 **두 가지 진입점** 모두에서 호출된다 — ① 초기 install (테스트 실행), ② **post-install navigation** (카페24 쇼핑몰 관리자의 "앱으로 가기" 버튼). ②번이 새로 발견된 요구사항으로, 옛 spec 의 single-use 가정 (callback 성공 시 `installToken=NULL` 소거) 과 충돌해 운영 사용자가 "앱으로 가기" 클릭 시 `404 CAFE24_INSTALL_INVALID_TOKEN` 을 받았다 (2026-05-15 사용자 보고).

**결정**: `install_token` 을 통합 lifetime 동안 보존되는 persistent identifier 로 격상.

- `pending_install → connected` 전이 시 token 보존 (옛: NULL 처리 → 새: 그대로).
- `handleInstall` 이 status 분기 — `pending_install` → OAuth authorize, `connected`/`error(*)`/`expired` → 우리 frontend redirect.
- HMAC 검증은 두 분기 모두 유지 (Cafe24 출처 보증).
- V045 partial UNIQUE `(install_token) WHERE install_token IS NOT NULL` 은 변경 없음 — 한 워크스페이스 안에서 같은 token 이 한 row 에만 매핑되는 invariant 보존.

**옛 connected 행 호환**: 본 변경 이전에 connected 로 전환되어 token 이 이미 NULL 인 통합은 새 동작이 작동하지 않는다 ("앱으로 가기" 클릭 시 여전히 404). 마이그레이션 plan 없이 자연 해소 — 사용자가 통합을 삭제 후 재등록하면 새 token 이 발급되고 새 동작 적용. 옛 행을 위해 추가 마이그레이션 비용을 들이지 않는 이유는 (a) Cafe24 Private 통합 사용자 수가 적고, (b) 재등록 비용이 SQL 마이그레이션 작성·테스트 비용보다 낮으며, (c) 옛 행의 client_secret 이 credentials 에 그대로 있어 token 재발급 자체는 가능하나 그 시점부터 다시 "테스트 실행" 부터 시작해야 하므로 결국 사용자 작업이 필요해 자동화 가치가 낮다.

**NULL 처리 유지 경로**: `pending_install → expired (install_timeout)` 의 24h TTL 만료는 token 을 NULL 로 소거 유지 — 사용자가 새 통합을 등록해야 하므로 옛 token 무효화가 정당. 통합 삭제 시도 row 삭제로 token 자동 소멸.

**post-install navigation 의 redirect target**: `${FRONTEND_URL}/integrations/<id>` 로 통일. 사용자가 카페24 admin 에서 우리 앱으로 들어올 때 그 통합의 상태·diagnostic 을 바로 확인할 수 있는 화면. 단순 `${FRONTEND_URL}/` 으로의 redirect 도 검토했으나 (워크플로 목록 등) 통합 컨텍스트 보존이 더 유익.

### Cafe24 Private request-scopes 흐름 (2026-05-15)

cafe24 Private 의 OAuth 시작은 우리 서버가 할 수 없어 `mode='reauthorize'` 에서 begin 이 `CAFE24_PRIVATE_APP_USE_TEST_RUN` 으로 거부한다. 옛 `/request-scopes` 는 내부적으로 begin 을 호출하며 mode `request_scopes` 도 같은 거부 분기에 걸려 동작 불가였다 (2026-05-15 운영 사용자 보고 — `CAFE24_INVALID_MALL_ID` 가 noise, 실제로는 Private 흐름이 막혀 있는 본질적 문제). 또한 옛 requestScopes 는 `entity.credentials.mall_id` 를 providerMeta 로 전달하지 않아 begin 의 cafe24 검증부가 missing mall_id 로 reject 도 함께 발생.

**결정**: `requestScopes` 가 cafe24 Private 을 감지하면 begin 우회 — 기존 `installToken` 보존 + `credentials.scopes` merge 갱신 + `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded }` 응답. 사용자가 Cafe24 Developers 의 앱 권한에서 추가 scope 활성화 후 "테스트 실행" 누르면 기존 install handler 가 작동 → callback → token 의 scope 가 확장된 새 token 으로 교체된다.

**왜 begin 우회인가**: begin 의 Private 거부는 정당 (OAuth 시작 불가). request-scopes 는 본질적으로 "OAuth 재시작 + 확장 scope" 인데, Private 에서는 Cafe24 측 진입점만 정식이므로 우리 화면은 안내만 담당. credentials.scopes merge 는 install handler 의 `OAuthState.requestedScopes` 채움에 영향을 주므로 사전에 갱신해 둔다.

**`request_scopes` 와 `reauthorize` 의 분리 유지**: 옛 코드는 두 mode 가 거의 동일 처리. 새 흐름에서도 Private 의 reauthorize 는 여전히 거부 (사용자가 reauthorize 의도로 누르면 안내 — Private 앱은 "테스트 실행" 만 정식). request_scopes 만 위 우회 분기로 처리.

**UI 안내 패턴 결정 (2026-05-16 추가)**: 분기 ② 응답(`cafe24_private_pending`) 에 대한 화면 표시는 modal/dialog 가 아닌 **inline alert + info 토스트** 로 정한다. modal 은 닫히면 잊혀지지만 Cafe24 측 작업(권한 활성화 → 테스트 실행)을 진행하는 동안 사용자가 안내를 계속 참조해야 한다 — 따라서 inline 으로 영구 표시. toast 는 응답 도착 신호로만 사용 (alert 가 본문). alert 생존 주기는 "다음 요청 시작 직전 reset" — `useMutation` 의 `onMutate` 훅에서 비워 옛 안내가 새 요청과 섞이지 않게 한다. 본 분기에서는 부모 페이지의 refetch 콜백을 호출하지 않는다 — token 갱신은 Cafe24 측 후속 callback handler (`handleInstall` 의 status 분기) 가 담당하므로 즉시 refetch 해도 변화 없음. `scopesAdded` 는 alert 안의 칩 목록으로 표시하되 빈 배열이면 칩 영역 자체를 숨긴다. UI 매핑 표는 §4.4.

### Cafe24 install_token mismatch 회복 흐름 (2026-05-15 후속)

운영 사용자 보고 — 새 통합 등록 후 Cafe24 Developers 에 App URL 을 등록했는데, "테스트 실행" 시 우리 endpoint 가 `404 CAFE24_INSTALL_INVALID_TOKEN` 응답. 원인: 사용자가 신규 통합 폼을 여러 번 제출하면서 (예: client_secret 오타 수정) idempotent begin 의 credentials-change 분기로 install_token 이 재발급됨. 마지막에 본 URL 만 옳고, 그 사이 Cafe24 Developers 에 등록한 옛 URL 은 stale.

옛 동작은 단호한 404. 사용자는 통합 상세 페이지에서 현재 App URL 을 확인해 Cafe24 Developers 를 수동 갱신해야 회복 가능. UX 가 뚝뚝 끊기고 운영 문의가 잦음.

**결정**: `handleInstall` 의 install_token 직접 매칭 실패 시 회복 분기 추가.

1. 같은 mall_id 의 cafe24 row 들 조회 (V046 partial UNIQUE 로 보통 1~2건).
2. 각 row 의 `client_secret` 으로 HMAC trial 검증.
3. **정확히 1개** validates → 그 row 의 OAuth/navigation 흐름으로 fall-through.
4. 0개 또는 2개+ → 기존 404 흐름 + HTML 안내 페이지 (사용자가 통합 상세의 현재 App URL 로 갱신).

비용: O(N) HMAC verify (회복 분기에서만, 정상 흐름 zero impact). 옛 폐기된 "100건 mall_id 스캔 + trial HMAC" (Rationale "install_token 을 App URL path 식별 키로 승격" 항 참조) 과 형태는 비슷하나 (a) 호출 빈도가 낮고 (404 fallback only), (b) **같은 workspace 안에서는** V046 partial UNIQUE `(workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL` 이 같은 mall_id row 를 최대 1개로 제한하며, 회복 분기 스캔이 workspace 횡단이라도 같은 mall_id 를 둘 이상 workspace 에서 동시 사용하는 케이스는 드물어 N=1~2 가 실무 값 ("구조적 상한 N≤2" 가 아니라 workspace-scoped 1개 보장 + 실무적으로 소수). 정상 식별은 여전히 install_token 단일 row 조회.

**TOCTOU 부재**: 회복 분기는 SELECT + HMAC verify 만 수행하는 read-only 조회로 INSERT/UPDATE 가 없어 race 자체가 발생하지 않는다. begin 핸들러의 V045 partial UNIQUE backstop (`CAFE24_PRIVATE_APP_ALREADY_CONNECTED` Rationale 참조) 은 INSERT 단계의 동시 신청 차단을 담당하는 보완 보증이며, 본 분기와는 다른 시점의 보증.

**보안 분석**: HMAC 위조에는 client_secret 이 필요. client_secret 보유자는 정상 흐름으로도 동일 행위 가능 → 회복 흐름이 추가 권한을 부여하지 않음. install_token capability-token 가정 ("CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제" 항 참조) 는 그대로 유지 — 옛 URL 이 leak 되어도 HMAC 위조 없이는 진행 불가.

**모호 케이스 (2개+ HMAC 매칭)**: 같은 mall_id 가 두 workspace 에 등록되어 있고 동일 client_secret 을 공유하는 경우 (드문 케이스 — 한 Cafe24 앱을 우리 서비스의 둘 이상 workspace 에서 동시에 사용). 어느 row 를 선택할지 결정 불가 → 회복 포기 + 404. 회복 운영로그 (`[cafe24-install-recovery] ambiguous: N rows passed HMAC`) 가 진단을 보조.

**HTML 에러 페이지**: 404 (회복 실패 포함) 시 요청의 `Accept: text/html` 일 때 minimal styled HTML 페이지 렌더. error code/message + 회복 안내 ("통합 상세 페이지에서 현재 App URL 을 확인해 Cafe24 Developers 를 갱신하세요"). API 클라이언트 (JSON 기대) 는 기존 JSON 응답 유지.

### Cafe24 Public app 가용성 — env 기반 노출 (2026-05-15 후속)

Cafe24 Public app 흐름은 우리 서버의 `CAFE24_CLIENT_ID` / `CAFE24_CLIENT_SECRET` env 가 등록된 경우에만 동작 (앱스토어 등록 앱의 OAuth client credentials). env 가 미설정이면 Public 옵션을 선택해도 begin 이 `OAUTH_CONFIG_MISSING` 으로 거부 — 사용자 입장에서 dead-end UX.

**결정**: `/api/integrations/services` 응답의 cafe24 항목에 `meta.publicAppAvailable: boolean` 노출. `CAFE24_CLIENT_ID && CAFE24_CLIENT_SECRET` 둘 다 set 이면 true. Frontend 의 신규 통합 폼이 false 일 때 Public 옵션 토글에서 제거 + 기본값 `private` 강제 + 안내 문구 갱신.

**Private 는 항상 노출**: env 와 무관. 사용자가 직접 client_id/secret 입력하므로 deployment 의 env 상태에 의존하지 않음. Public 만 env 게이트 (사용자 명시 결정).

**왜 server-side 게이트인가**: 클라이언트가 env 를 알 길이 없으므로 server 가 single source of truth. `meta` 객체에 담아 향후 다른 가용성 hints (예: GitHub Enterprise URL 설정 여부 등) 도 같은 통로로 노출 가능.

### BullMQ `cafe24-token-refresh` 큐 — 멀티 인스턴스 race 해소 (2026-05-16)

[`spec/4-nodes/4-integration/4-cafe24.md` §9.6](../4-nodes/4-integration/4-cafe24.md#96-rate-limit-의-범위-한정) 가 "Redis 기반 분산 mutex 도입은 별도 spec 으로" 라는 미결로 남겼던 cross-pod refresh race 가 PR #56 의 BullMQ 큐 도입으로 해소됐다. 새 큐 `cafe24-token-refresh` 가 모든 cafe24 refresh 호출을 `jobId = integrationId` dedup 으로 클러스터 전체에서 직렬화한다.

**문제 정의 (옛 미결)**: 두 backend pod 이 같은 통합에 대해 동시에 refresh 를 시도하면 둘 다 Cafe24 `/oauth/token` 에 같은 old refresh_token 으로 요청을 보내 last-write-wins 로 한쪽 토큰이 orphan 되거나, Cafe24 의 rotation 정책에 따라 한쪽이 `invalid_grant` 401 을 받고 잘못 `error(auth_failed)` 격하될 수 있었다.

**채택 — BullMQ `jobId` dedup**:
- 같은 통합에 대한 동시 enqueue 가 `Queue.add({ jobId: integrationId })` 의 dedup 로 단일 worker 실행으로 모임. 모든 호출자가 `waitUntilFinished` 로 동일 worker 결과 공유.
- Worker (`Cafe24TokenRefreshProcessor`) 는 DB 재로드 + 재확인 short-circuit 후 `refreshAccessToken` 호출 → atomic 4-field UPDATE.
- proactive (API 호출 직전) + background (일일 스캐너) 양쪽 진입점이 동일 큐를 사용.

**기각된 대안**:
- **PostgreSQL advisory lock** (`pg_advisory_xact_lock(hashtext(integrationId))`): 코드 단순하지만 lock 보유 중 HTTP 요청(Cafe24 endpoint)을 transaction 안에 묶어야 해 DB 커넥션 점유 시간이 늘고, BullMQ 가 이미 스택에 있어 별도 메커니즘 추가의 운영 부담이 더 큼.
- **Redis redlock**: 인프라 의존성 추가, BullMQ 와 Redis 를 공유하긴 하지만 별도 lock 메커니즘 운영.
- **In-memory mutex (`withIntegrationLock`) 유지만**: 옛 single-pod 한계 그대로. 멀티 pod 배포 시 race 미해소.

**경계**:
- 본 큐는 **refresh 호출의 cross-pod 직렬화**만 담당. API 호출 자체 (Cafe24 leaky bucket 관리) 는 여전히 `Cafe24ApiClient` in-memory mutex 가 같은 pod 내에서만 직렬화 — Cafe24 leaky bucket 이 per-mall quota 라 cross-pod 직렬화 불필요 (per-pod backoff 신호로 충분). 자세한 분리는 §9.6 참고.
- 큐 미바인딩 환경 (unit test) 에서는 fallback 으로 in-process `refreshAccessToken` 직접 호출. production wiring 은 항상 큐 경유.

### `cafe24-background-refresh` 10일 임계 (2026-05-16)

Cafe24 의 `refresh_token` 은 14일 유효이며, Cafe24 가 매 refresh 마다 새 refresh_token 을 발급 (rotation). 활성 통합 (주 1회 이상 사용) 은 매 사용 시점에 proactive refresh 가 일어나 사실상 영구 유효하다. 그러나 14일 이상 idle 인 통합은 refresh_token 까지 만료되어 사용자가 재인증해야 한다.

**결정**: 일일 `cafe24-background-refresh` 잡이 `lastRotatedAt < now - 10d OR IS NULL` 인 connected cafe24 통합을 자동 refresh.

**임계 10일 근거**:
- 14일 유효 - 4일 안전 마진 = 10일. 갱신 실패 / 큐 적체 / 일일 잡 한 번 누락 시에도 마감 전 재시도 여지.
- 더 짧게 (예: 매일) 잡으면 Cafe24 leaky bucket 에 불필요한 부담. 운영 부하 vs 안전 마진 trade-off.
- 더 길게 (예: 12일) 잡으면 안전 마진 부족.

**신규 통합 NULL 처리**:
- `integrations.service.create()` 가 cafe24 신규 통합 row 생성 시 `lastRotatedAt = new Date()` 로 명시 초기화 (PR #67 DB-1 fix).
- 옛 row (PR #67 이전) 또는 다른 진입점에서 NULL 로 저장된 경우를 대비해 쿼리 조건이 `Or(LessThan(cutoff), IsNull())` belt-and-suspenders.

**경계**: 본 잡은 enqueuer 역할이며 실제 refresh 는 `cafe24-token-refresh` 큐의 worker 가 수행 (역할 분리). proactive call 과 같은 jobId dedup 으로 충돌 없이 협력.

### Cafe24 install_token mismatch 회복 흐름 — 보안 전제 (2026-05-16)

`tryRecoverByMallId` (Rationale "Cafe24 install_token mismatch 회복 흐름" 의 회복 분기) 가 production 코드에 존재한다. 이는 옛 spec §9.8 의 "100건 스캔 + trial HMAC 폐기" 와 **표현상 충돌**하나 본질적으로 다른 경로다.

**구분**:
- 옛 폐기 흐름: install_token 자체가 없던 시절의 **모든 호출에 적용**되는 식별 전략. mall_id 만으로 매칭하고 HMAC trial 로 row 를 골랐다.
- 새 회복 흐름: **단일 row 조회 실패 시에만** fall-back 으로 작동. 정상 흐름은 install_token 단일 row 조회 그대로.

**보안 전제 — HMAC 검증 유지**: 회복 분기에서도 mall_id 매칭 후보 row 들의 client_secret 으로 HMAC 검증을 1회씩 수행. HMAC 통과는 client_secret 보유의 증명이므로 권한 escalation 없음. install_token capability-token 가정 ("CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제" 항) 은 본 회복 흐름이 깨뜨리지 않는다 — 옛 install_token 이 leak 되어도 HMAC 위조 없이는 회복 분기를 통과 못 함.

**DoS 보호**: 코드 상수 `RECOVERY_CANDIDATE_LIMIT = 5`. 후보 overflow 시 회복 포기 (404) — workspace 횡단으로 같은 mall_id 가 5개 이상이면 HMAC trial 자체를 거부해 amplification 차단. 정상 운영에서 같은 mall_id 의 cafe24 row 는 보통 1~2개라 영향 없음.

**로그 정책 (PR #67 SEC H-2)**: 회복 시도·결과 로그에서 cross-tenant Integration UUID 와 install_token prefix 를 제거. mall_id + status 만 로깅해 enumeration 단서를 줄임.

### refresh 실패 시 status_reason 통일 (2026-05-16)

spec §6 가 옛 표기 `connected → expired | refresh fail` 로 명시했으나, 구현은 refresh 실패 시 `error(auth_failed)` 로 전이했었다. UI 분기·재인증 안내 문구·`Notification.type` 발사 정책 (§11.2) 에 일관성 결손.

**결정**: `error(auth_failed)` 채택. 옛 `expired (refresh_failed)` 분기 폐기. `expired` status 는 두 경로로 한정 — (1) refresh_token 없는 일반 OAuth provider (예: GitHub) 의 `token_expires_at` 만료 (`status_reason='token_expired'`), (2) Cafe24 Private 의 `pending_install → expired (install_timeout)`. 즉 본 변경은 cafe24 등 refresh_token 보유 provider 의 refresh 실패 경로에만 영향을 주고, `token_expires_at` 만료 자체 (§11.1 `connected-expiry` 스캐너) 는 그대로 유지된다.

**이유**:
- (a) UI 가 reauthorize 액션을 권장하기에 더 자연스러움. `expired` 는 "자동 재발급 시도 후 만료" 의미가 강해, terminal refresh_token 만료 (사용자 재인증 필요) 와 의미가 어긋남.
- (b) refresh_token 자체 만료 (terminal — Cafe24 가 14일 후 invalidate) 와 access_token 만료 (자동 회복 가능 — refresh 가능) 를 의미적으로 구분 보존. `error(auth_failed)` 는 전자 (사용자 액션 필요), `expired` 는 일반 OAuth provider 의 후자 신호로 분리.
- (c) PR #67 의 REQ-C2 (transport 3회 → `error(network)`) 와 같은 `error(*)` 도메인에서 일관 분류.

**데이터 모델 변경 없음** — `Integration.status_reason` 컬럼 값 정의만 갱신 (`spec/1-data-model.md §2.10` 참고): `expired` 의 사유에서 `refresh_failed` 제거, `error` 의 사유에 `auth_failed` / `insufficient_scope` / `network` 보존. `token_expired` 는 일반 OAuth provider 의 `expired` 경로 (refresh_token 없는 provider) 용으로 유지.

**알림 정책 (§11.2)**: `integration_expired` 알림은 `expired` 전이 중에서도 `token_expired` 경로에만 발사. `install_timeout` 도 `expired` 전이지만 별도 결정으로 미발사 — 아래 ["install_timeout 알림 미발사"](#install_timeout-알림-미발사-2026-05-16) 항 참조. `error(*)` 전이는 별도 알림 없이 UI 배지로만 통지. 향후 별도 알림 타입 필요 시 `integration_action_required` 등 신설 검토.

### install_timeout 알림 미발사 (2026-05-16)

PR #75/#76 의 spec 표현 ("expired 전이 두 경로 — token_expired, install_timeout — 모두 발사") 이 코드 미확인 상태에서 기재된 오기. `expirePendingInstalls()` (`backend/src/modules/integrations/integration-expiry-scanner.service.ts:251-287`) 는 bulk UPDATE 만 수행하고 `notificationsService.createMany` 호출이 없으며, 본 결정으로 그 동작이 의도임을 명문화한다.

**결정**: `pending_install → expired (install_timeout)` 전이는 `integration_expired` 알림 **미발사**.

**이유**:
- (a) **사용자 인지** — `pending_install` 상태는 사용자가 외부 흐름 (Cafe24 Developers 의 "테스트 실행") 을 직접 진행 중인 명시적 상태. 24h 안에 install 을 완료하지 못했다는 건 본인이 시작점·진행 상황을 알고 있을 가능성이 큼.
- (b) **UI 통지 충분** — 통합 상세 페이지의 status 배지 + 목록 페이지의 "Need attention" 배너로 통지. 별도 알림은 over-noise.
- (c) **일관성** — `pending_install` 의 다른 callback 실패 분기 (`oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`) 도 알림 미발사. install_timeout 만 발사하면 일관성 결손.
- (d) **"조용한 전이" 원칙의 연장선** — `install_token=NULL` 소거 (Rationale "install_token TTL 24h") 와 같은 결정 흐름. 외부 흐름 미완료가 자명한 상태 변화는 외부에서 들어오는 새 시도가 아닌 한 알림 가치 낮음.

기각된 옵션 (install_timeout 알림 발사): UI 배지로 충분히 통지되는 자기-시작 상태에 알림을 더하면 over-noise. 향후 별도 도메인 알림 (예: `integration_action_required`) 신설 시 재검토 가능.

**범위**: 본 결정은 `Notification.type='integration_expired'` 미발사만 다룬다. UI 배지·다음 install 시도 시 `install_token=NULL` 로 인한 404 등 다른 동작은 영향 없음.

### Cafe24 App URL 상세 페이지 표시 (2026-05-16)

Cafe24 admin "앱으로 가기" / Cafe24 Developers "테스트 실행" 의 HMAC 검증 실패 에러 페이지(`renderInstallErrorHtml`) 는 사용자에게 "통합 상세 페이지에 표시된 URL 과 일치하는지 확인하세요" 라고 안내한다. 그러나 옛 상세 페이지에는 App URL 이 표시되지 않아 안내가 실효성을 잃었다 (2026-05-16 사용자 보고 — App URL 호출이 `CAFE24_INSTALL_INVALID_HMAC` 으로 거부됐을 때 비교 기준이 없었다).

**해결안**: 상세 페이지 Overview 탭에 `Cafe24AppUrlCard` 를 추가해 App URL/Redirect URI 를 복사 버튼과 함께 노출 (§4.2 표 참조). 백엔드는 `IntegrationDto.appUrl: string | null` 필드를 Cafe24 Private 한정으로 계산해 응답에 포함하며, `install_token` 자체는 별도 필드로 노출하지 않는다 — App URL path segment 안에 이미 포함되며 별도 필드 노출은 (a) 중복, (b) 식별자가 두 곳에 분산되어 클라이언트가 어느 값으로 비교해야 할지 혼동, (c) 향후 path 형식 변경 시 양쪽 필드 동기화 부담, 세 가지 이유로 회피.

**새 등록 흐름과의 일관성**: `frontend/src/app/(main)/integrations/new/page.tsx` 의 `Cafe24PrivatePending` 컴포넌트와 동일한 복사 UX 패턴(라벨 + 모노스페이스 URL + 복사 버튼 + 1줄 안내) 을 재사용해 사용자 혼동을 줄인다.

**HMAC 검증 진단 로그 보강**: 본 변경과 함께 `handleInstall` 의 HMAC 실패 3 분기 (mall_id 불일치 / client_secret 부재 / HMAC 자체 불일치) 가 동일 `CAFE24_INSTALL_INVALID_HMAC` 응답을 반환하는 옛 동작은 유지하되 (응답 코드 단일화 정책 유지 — capability-token 가정 보호), `logger.warn` 로 어느 분기인지·URL mall_id 와 DB mall_id 의 일치 여부·DB app_type/status/status_reason·install_token prefix+suffix 4자를 기록한다. `client_secret` 자체는 절대 로그에 남기지 않는다 — `SECRET_LEAK_PATTERNS` 정책과 일관 (보안 로깅 규약의 spec/conventions 정식화는 별도 plan).

### HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)

PR #67 의 SEC H-1 (2026-05-16) 가 HMAC 검증을 "Java `URLEncoder.encode(value, "UTF-8")` 호환 (공백 `+`)" 으로 정정했으나, 운영 환경에서 **신규 통합 직후 즉시 HMAC 실패** 가 재현됐다 (사용자 보고, 2026-05-16 — PR #89 의 진단 로그가 `reason=hmac_verify_failed` 를 정확히 식별). mall_id / app_type / install_token / client_secret 모두 매칭하는데 HMAC 자체만 불일치 — 알고리즘 자체의 결함.

**근본 원인**: Cafe24 의 공식 `validationCheckHmac` Java 샘플은 `request.getQueryString()` 을 `&` 로 split → `=` 로 한 번만 split → TreeMap 에 **raw value 그대로** 저장한 뒤 concat 한다. 즉 **URL value 를 decode 하지 않으며 re-encode 도 하지 않는다**. 우리 SEC H-1 fix 는 "Cafe24 가 URLEncoder 를 호출한다" 라고 가정했지만, 실제로는 URL 의 raw byte sequence 를 그대로 HMAC 메시지에 넣는다.

**증거**: 사용자 보고 URL 의 `user_name=%EB%8C%80%ED%91%9C%20%EA%B4%80%EB%A6%AC%EC%9E%90` — Cafe24 가 공백을 `%20` 으로 보낸다. 만약 Cafe24 가 HMAC 계산에 URLEncoder 를 호출한다면 메시지 안의 값은 `%EB%8C%80%ED%91%9C+%EA%B4%80%EB%A6%AC%EC%9E%90` 가 되어야 하고, 그 결과 Cafe24 자신의 HMAC 도 자기네 URL 과 매칭이 안 되어 검증이 동작하지 않을 것이다. 따라서 Cafe24 는 raw 값을 사용한다 (이론적 추론 + 운영 재현 동시 확인).

**해결**: `buildHmacMessage` 가 `URLSearchParams` 로 decode 하지 않고 `rawQuery.split('&')` 로 직접 파싱해 key/value 의 raw byte string 을 그대로 보존한다. sort 는 key 만 알파벳 순. value 인코딩은 Cafe24 가 어떤 인코더로 URL 을 만들었든 무관 — byte 단위로 일치하기만 하면 된다.

```typescript
function buildHmacMessage(rawQuery: string): string {
  return rawQuery
    .split('&')
    .map((part) => {
      const eqIdx = part.indexOf('=');
      const key = eqIdx === -1 ? part : part.slice(0, eqIdx);
      return { key, raw: part };
    })
    .filter((p) => p.key.length > 0 && p.key !== 'hmac')
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((p) => p.raw)
    .join('&');
}
```

**기각된 옵션 (raw 보존 대신 다양한 인코더 시도)**: `encodeURIComponent` / `URLEncoder` 호환 / browser fetch encoding 등 후보 인코더가 매번 차이가 있어 (`%20` vs `+`, `*` vs `%2A`, `!` vs `%21` 등) 어느 하나로 매칭이 보장되지 않는다. Cafe24 자체도 향후 인코더를 바꿀 수 있다. raw byte 보존은 인코더 invariant 다.

**보안 영향 없음**: HMAC 자체의 cryptographic strength 는 변하지 않는다. capability-token 보호 ([Rationale "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제"](#cafe24_install_invalid_token404-의-보안-전제-2026-05-14)) 도 그대로. 옛 PR #67 의 SEC H-2 (workspace 횡단 enumeration 방지) 도 그대로.

**테스트 보강**: 사용자 실제 URL (`user_name=...%20...` + 실제 timestamp 패턴) 의 회귀 보호 테스트 추가. 옛 `accepts HMAC for queries containing space-encoded values` 테스트는 `John+Doe` 형식을 사용했으나 — 그건 우리 옛 알고리즘의 self-fulfilling 검증 (compute 와 verify 가 같은 broken 알고리즘 사용) 이라 실제 Cafe24 동작 검증이 안 됐다. 새 테스트는 **Cafe24 가 보내는 형식 (`%20`) 그대로** raw query 를 만들어 검증한다.

**관련 history**:
- 2026-05-14: HMAC 알고리즘 최초 도입 (`encodeURIComponent` 사용, 운영 양호)
- 2026-05-16 (PR #67 SEC H-1): `formUrlEncode` 로 변경 (잘못된 가정에 기반한 회귀)
- 2026-05-16 (본 결정): raw-value 보존으로 재정정 (Cafe24 실제 동작 반영)

### Cafe24 Public 흐름의 begin-time 사전 가드 추가 (2026-05-16)

Public 흐름은 begin 단계에서 Integration row 를 만들지 않으므로 V045 partial UNIQUE 가 발사되는 시점이 `POST /api/integrations` finalize 단계로 미뤄진다. 사용자가 Cafe24 동의 페이지까지 마친 뒤에야 충돌이 드러나고, `IntegrationsService.throwIfUniqueViolation` 의 옛 분기는 `integration_workspace_name_unique` 만 처리해 `idx_integration_cafe24_workspace_mall` 위반은 raw `QueryFailedError` → 500 으로 빠지던 UX 결함이 있었다.

조치:

- **begin 단계 사전 가드** — Public 분기에도 Private 와 동일한 `(workspaceId, mall_id)` connected row 사전 SELECT 추가. `IntegrationOAuthService.findConnectedCafe24MallIntegration` 헬퍼로 두 흐름 공유.
- **race backstop 확장** — `throwIfUniqueViolation` 에 `idx_integration_cafe24_workspace_mall` 분기 추가. begin pre-check 통과 후 동시 INSERT race / finalize 시점 충돌도 동일 409 코드로 변환.

**다른 status (`pending_install`/`expired`/`error`) 가 begin 단계에서 차단되지 않는 이유**:

- `pending_install` 은 Private 흐름의 idempotent begin 정책 (같은 row 를 reuse 해 install_token 보존) 과 호환되어야 한다 ([CAFE24_PRIVATE_APP_ALREADY_CONNECTED 의 mall_id 비교 경로](#cafe24_private_app_already_connected-의-mall_id-비교-경로-2026-05-15-갱신) 항 참조). Public 흐름은 begin 단계에서 row 를 만들지 않으므로 pending_install 이 있더라도 begin 자체는 무영향 — V045 가 finalize 단계에서 차단.
- `expired`/`error` 는 사용자의 재연동 의도를 반영해 begin 진입 자체는 허용하되, 한 workspace 안에서 같은 mall_id 의 cafe24 통합이 최대 1행이라는 invariant 는 V045 partial UNIQUE 가 finalize 단계에서 보장 (사용자는 기존 행을 먼저 삭제해야 새 통합 등록 가능).
- 결과적으로 모든 비-connected status 의 race / 충돌은 finalize 의 V045 backstop 이 동일 409 코드로 변환 → 클라이언트는 단일 분기.

### CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드명 유지 결정 (2026-05-16)

본 코드를 Public 흐름에도 재사용하면서 `→ CAFE24_MALL_ALREADY_CONNECTED` rename 안이 ai-review 와 consistency-check 양쪽에서 제기됐으나 사용자 지시로 **기각**. 사유:

- **(a) 클라이언트 호환성** — 기존 클라이언트(프론트엔드, integration 사용자)는 코드의 *의미* (mall_id 기준 중복) 로 분기 처리하므로 이름 변경으로 얻는 가독성 이득은 없다. rename 시 deprecated 처리·alias 추가 등 호환성 부담만 발생.
- **(b) swagger 규약 정합** — `spec/conventions/swagger.md §2-4` 의 중복/충돌 409 정책과 `INTEGRATION_IN_USE(409)` 선례에 부합. 이름 토큰의 정확성보다 상태 코드·의미의 정확성이 우선.
- **(c) 의미 기반 명명 선례 예외** — `spec/conventions/swagger.md` 의 의미 기반 명명 원칙에서 본 코드는 historical artifact 예외로 등록한다. 신규 코드는 이 예외를 따르지 않으며 처음부터 의미 정확한 이름을 부여한다.

장기적으로 본 코드가 다른 mall_id 충돌 케이스 (예: cross-workspace 정책 변경) 와 분리해야 할 필요가 생기면 별도 코드 신설을 고려하되, 그 시점까지는 본 코드의 정의를 spec 으로 명확화해 유지한다.

### precheck endpoint — mall_id 입력 단계 사전 감지 UX (2026-05-16)

사용자가 mall_id 를 다 입력하기 전(타이핑 중)에 conflict 를 감지해 inline 경고 배너로 보여주는 read-only endpoint (`GET /api/integrations/cafe24/precheck`). begin 의 pre-check 와 동일한 SELECT 를 노출하되, 다음 설계 결정을 반영한다.

- **응답 shape 최소화** — `{ conflict, existingIntegrationId?, existingName?, status? }` 만 반환. 자격 증명·토큰·timestamps·workspace 메타 비포함.
- **노출 범위 격리** — 인증된 사용자의 current workspace (X-Workspace-Id 헤더 기준) 소속 cafe24 row 만 반환. cross-workspace enumeration 경로 아님. Organization-scope 도입 후에도 current workspace 의 정의가 변경되면 본 endpoint 가 자동 추종 (별도 RBAC 처리 불필요).
- **priority status 단일 반환** — `connected > pending_install > error > expired` 순서로 가장 제한적인 status 만 반환 (전체 row 목록이 아닌 단일 status). frontend i18n 메시지 분기 4종이 priority 순으로 일치.
- **enum 범위 밖 status 처리** — 미래에 추가될 수 있는 transitional status (예: `initializing`) 가 들어오면 `status` 필드를 omit. 강제 캐스팅으로 frontend 가 unknown enum 을 silent fallthrough 하는 위험 차단.
- **throttle** — 분당 60회. **이 endpoint 전용 상한** (일반 API rate limit 위에 더해지지 않고 본 값으로 대체 — `@Throttle` decorator). 사용자 입력 350ms debounce 기준 정상 호출 1~2회/입력으로 충분한 여유. mall_id 패턴 정규식 매칭이 frontend 에서 사전 1차 차단되므로 backend 호출 자체가 압축됨. brute-force enumeration 의 비용은 회당 1 SQL 조회 + JWT 검증으로 낮으나 throttle 이 backstop.

**O(N) 폐기와의 관계** — [install_token 을 App URL path 식별 키로 승격](#install_token-을-app-url-path-식별-키로-승격-2026-05-14) 항에서 폐기된 "전방위 O(N) mall_id 스캔 + HMAC trial" 패턴과 본 endpoint 는 다르다. precheck 는 V045 plain mall_id 컬럼의 단일 인덱스 lookup (`(workspace_id, mall_id) WHERE service_type='cafe24'`) 으로 O(1) row 만 가져온다. legacy `mall_id IS NULL` fallback 만 backfill 완료 전 임시로 추가 쿼리 발행 — 향후 backfill 종료 시 제거된다 (구현 코드 주석 `findAllCafe24RowsForMall` 참조).

라우트 선언 순서 주의 — `@Get('cafe24/precheck')` 는 동적 경로 `@Get(':id')` 보다 **앞에** 선언되어야 NestJS 가 `cafe24` 를 `:id` 로 소비해 `ParseUUIDPipe` 위반 400 을 일으키지 않는다. controller 코드 주석에 회귀 안전망으로 명시.

### Cafe24 별도 승인 scope 의 식별·안내 (2026-05-17)

**문제**: Cafe24 Admin API 중 mileage/notification/privacy 의 모든 scope 와 store 안 일부 operation (activitylogs, menus, naverpay/kakaopay/PG settings 등) 은 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. spec 에 이를 표현하는 차원이 없어 사용자가 위저드에서 일반 카테고리처럼 체크 → OAuth `invalid_scope` 거부 또는 호출 시 `INSUFFICIENT_SCOPE (403)` 으로 좌초. 원인 안내 장치 부재.

**채택**: backend 메타데이터의 `Cafe24OperationMetadata.restrictedApproval` 필드와 catalog 의 `restricted` 컬럼을 SoT 로 두고, UI 4 화면 (위저드 §3.2 / 통합 상세 §4.4 / Cafe24 노드 Operation 드롭다운 / AI Agent allowlist) 이 같은 필드를 읽어 ⚠ 배지·tooltip·경고 배너를 자동 렌더. 명단 자체의 진위 SoT 는 신규 컨벤션 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md). 에러 안내는 §10.4 의 `oauth_invalid_scope` 행과 §9.4 의 `INSUFFICIENT_SCOPE` 의 `details.requiresCafe24Approval` 보강 필드 2 경로로 분리 (OAuth 단계 vs 호출 단계).

**기각 대안**:

- (A) **차단 정책** — 체크 시점에 사용자 진행을 막는다. 이미 본사 승인을 받은 합법 사용자 케이스를 막아버려 기각. 안내만, 차단 없음 정책 채택. 단 amber 경고 배너로 인지를 강제한다.
- (B) **신규 에러 코드 추가** (`CAFE24_APPROVAL_REQUIRED` 등) — 기존 `INSUFFICIENT_SCOPE (403)` / OAuth `invalid_scope` 처리 경로를 분기시켜 client 코드 호환성에 영향. `details.requiresCafe24Approval` 보강 필드 + `status_reason='oauth_invalid_scope'` 의 enum 확장만으로 표현 가능.
- (C) **catalog `status` enum 확장** — `supported` / `planned` / `deprecated` 와는 직교 차원이라 enum 확장은 의미 오염. 별도 컬럼 `restricted` 가 정답.

**Trade-off / 미해결**:

- mileage resource 안의 `credits_*` (예치금) 가 정확히 `mall.read_mileage` 를 쓰는지 vs 별도 scope 인지의 공식 분리 확인은 사용자 자료 범위 밖. scope 단위 라벨링 (`level='scope'`) 을 mileage resource 전체에 적용. 향후 공식 문서로 분리 확인되면 정정 ([`cafe24-restricted-scopes.md §5`](../conventions/cafe24-restricted-scopes.md#5-명단-갱신-절차)).
- `paymentmethods_list` / `paymentmethods_paymentproviders_list` / `paymentmethods_paymentproviders_update_display` 는 별도 승인 여부 미확인 — 빈칸 유지.

**출처**: 사용자 보고 (2026-05-17). consistency-check 세션: `review/consistency/2026/05/17/12_12_46/` (BLOCK: NO).

#### `spec/2-navigation/9-user-profile.md` 의 Rationale

## Rationale

### `/profile` 편집 인터랙션의 분리 (§2)

초기 와이어프레임은 사용자 정보·환경설정·비밀번호 변경을 한 페이지의 폼으로 묶고 하단 단일 `[Save Changes]` 버튼으로 모두 커밋하는 형태였다. 다음과 같은 footgun 이 식별되어 현재의 하이브리드 편집 패턴(인라인 토글 + sub-route + diff 확인 모달) 으로 개정했다.

- **이질적 변경의 의도 충돌** — 자격증명(비밀번호)·개인정보(이름·아바타)·환경설정(언어·테마) 은 위험 수준이 서로 다른데도 한 번의 클릭이 모두를 동시에 PATCH 하는 구조였다. 사용자 의도와 실제 결과가 어긋날 가능성이 컸다.
- **무방비 편집 활성화** — 모든 input 이 디폴트로 활성화되어 있어 단순 탐색 중에도 실수 입력이 그대로 저장 대상이 되었다.
- **세션 강제 종료 패턴과의 톤 불일치** — `/profile/sessions` 의 강제 종료는 이미 `RevokeConfirmDialog`(password/TOTP 재인증) 로 명시적 의도를 분리해 안전하게 운영 중인데, 같은 영역의 다른 민감 동작은 그 톤을 따르지 못하고 있었다.

해법으로 (a) `/profile` 을 디폴트 readonly 로 두고 카드 단위 [편집] 토글로 의도를 분리, (b) 저위험 항목(이름·환경설정) 도 저장 직전 변경 전·후 diff 확인 모달을 한 단계 거치게 해 실수 방지, (c) 고위험 항목(비밀번호) 은 별도 sub-route 진입 자체가 의도 표명 역할을 하도록 채택했다. 이메일은 기존 결정대로 "별도 변경 (확인 메일)" 으로 본 화면에서 분리한 상태를 유지한다.

폐기된 대안:

- **모달 일원화** — 모든 편집을 모달로 처리(인라인 토글 없음). 환경설정처럼 자주 만지는 항목까지 매번 모달이 떠야 해 마찰이 과도하다고 판단.
- **전 항목 sub-route** — 환경설정·이름까지 모두 별도 라우트로 분리. 라우팅·뒤로가기 비용이 가치 대비 과도. 위험 수준에 비례한 마찰이 더 합리적.
- **단일 페이지 + 섹션별 Save 버튼** — 폼은 그대로 두고 Save 만 섹션 단위로 쪼개기. "폼이 디폴트로 노출되어 무방비" 라는 핵심 문제를 해결하지 못함.

#### `spec/2-navigation/_layout.md` 의 Rationale

## Rationale

### R-1. 사이드바 로고 변종 규칙 (2026-05-15)

§2.1 로고 행에 expanded/collapsed 변종 규칙을 추가한 이유: 본 문서는 사이드바의 **자리**만 정의하고, 자리에 들어가는 로고 변종·색은 `spec/6-brand.md §8.4` (brand spec) 가 단일 진실로 결정한다. 본 행은 brand spec §8.4.6 의 결정(expanded → Full logo / collapsed → Icon mark)을 자리 정의에 반영한 것이다.

근거 출처: `

... (truncated due to size limit) ...
