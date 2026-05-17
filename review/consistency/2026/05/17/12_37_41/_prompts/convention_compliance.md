# 정식 규약 준수 Check Payload

본 파일은 orchestrator 가 정식 규약 준수 checker 용으로 작성한 입력입니다. target 문서가 정식 규약(`spec/conventions/**`) 을 따르고 있는지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자가 가리키는 경로에 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (정식 규약 준수)

1. **명명 규약** — 파일·식별자·API endpoint 명명이 conventions 규칙과 일치하는가
2. **출력 포맷 규약** — 노드 Output, API 응답, error code 형식 등이 정식 규약을 따르는가
3. **문서 구조 규약** — Overview / 본문 / Rationale 3섹션 권장, `_product-overview.md`·`0-` prefix 등 CLAUDE.md 의 명명 컨벤션 준수
4. **API 문서 규약** — Swagger 패턴·request/response DTO 명명
5. **금지 항목** — conventions 에서 명시적으로 금지한 패턴(예: 옛 prd/, memory/ 경로 사용)을 답습하고 있지 않은가

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

## 정식 규약 모음 (spec/conventions/)

### spec/conventions 정식 규약
(없음)

