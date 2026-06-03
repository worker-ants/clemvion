# CONVENTION: Cafe24 API Catalog — Overview

> 관련 문서: [Spec Cafe24 노드](../../4-nodes/4-integration/4-cafe24.md) · [Cafe24 API Metadata 컨벤션](../cafe24-api-metadata.md) · [Cafe24 공식 Admin API 문서](https://developers.cafe24.com/docs/ko/api/admin/)

본 디렉토리(`spec/conventions/cafe24-api-catalog/`) 는 Cafe24 Admin API 의 **모든 endpoint** 를 18 resource 단위로 enumerate 한 단일 진실(single source of truth)이다. 노드 메타데이터(`codebase/backend/src/nodes/integration/cafe24/metadata/*.ts`) 가 어디까지 구현됐고 어디가 남았는지가 한 화면에서 보이도록 유지한다.

카탈로그는 **두 레이어**로 구성된다.

| 레이어 | 위치 | 내용 | sync 테스트 |
|--------|------|------|------------|
| **Index (endpoint enumeration)** | `<resource>.md` (top-level 18개) | operation 표 (id / method / path / scope / status …). 메타데이터와 양방향 동기. | `catalog-sync.spec.ts` 가 파싱 (§4) |
| **Field-level 상세** | `<resource>/<entity>.md` (하위 폴더, 222개) | 각 sub-resource(entity) 의 **응답 속성(property list) + operation 별 요청 파라미터** — name / 필수 / 제약 / 기본값 / 설명. Cafe24 공식 docs 기준. | 미대상 (§7) |

> Field-level 레이어는 **읽기 참조용**이다. `catalog-sync.spec.ts` 의 `readdirSync(CATALOG_DIR)` 는 top-level `.md` 만 본다 (하위 폴더는 디렉토리 엔트리라 `.endsWith('.md')` 필터에서 제외) — 따라서 하위 폴더 추가는 sync 테스트에 영향이 없다. 자세한 정책은 §7.

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

resource 이름은 `Cafe24Resource` enum (`codebase/backend/src/nodes/integration/cafe24/metadata/types.ts`) 와 1:1 일치한다.

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
| `restricted` | — | `scope` / `operation` / 빈칸. `scope` = 본 scope 자체가 카페24 별도 승인 대상이라 같은 resource 의 모든 row 가 영향. `operation` = 본 row 만 단독 승인 대상 (store 안 케이스). 빈칸 = 일반 사용 가능. **이 컬럼은 `status` 와 직교하며 `status` 의 값이 아니다** — `supported` + `restricted: operation` 조합이 정상이다. 컬럼 값은 backend 메타데이터 `restrictedApproval.level` 과 동일 토큰 (`'scope'` / `'operation'`) 으로 통일. 명단 SoT 는 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md) |
| `paginated` | — | `✓` 또는 빈 칸. `paginated: true` 인 operation 만 표시 |
| `status` | ✓ | §3 의 enum 중 하나 |
| `docs` | ✓ | Cafe24 공식 docs anchor URL — `https://developers.cafe24.com/docs/ko/api/admin/#<anchor>` |

## 3. status enum

| 값 | 의미 | 백엔드 메타데이터 |
|-----|------|------|
| `supported` | 노드/MCP Bridge 에서 호출 가능 | `CAFE24_OPERATIONS_BY_RESOURCE[resource]` 에 row 존재 |
| `planned` | 카탈로그에 등재만, 미구현. UI 의 Operation 드롭다운에 **disabled + "지원 예정" 배지** 로 노출 | `CAFE24_OPERATIONS_BY_RESOURCE` (supported 메타데이터) 에는 row 없음. 단 전용 mirror `CAFE24_PLANNED_BY_RESOURCE` (`metadata/planned.ts`) 에 `{ id, paginated? }` row 가 존재해야 하며, 이 mirror 가 `GET /nodes/definitions` 로 노출돼 프론트 Operation select 의 "지원 예정" 배지를 구동한다. catalog 의 모든 `planned` row ↔ mirror 는 §4 규칙8 로 양방향 강제. 현재 18 resource 전부 planned 0 이므로 mirror (`planned.ts`) 도 모두 빈 배열 |
| `deprecated` | Cafe24 가 제거 또는 deprecate 했고 우리 노드에서도 더 이상 호출 안 함. **본 도메인은 외부 API endpoint 폐기 상태이며, spec frontmatter `status: archived` ([`spec-impl-evidence.md`](../spec-impl-evidence.md)) 와는 별 도메인 (spec 문서 자체의 폐기)** | row 없으면 정상. 있으면 마이그레이션 대상 |

`planned` 행의 `method`/`path`/`scope` 가 `?` 인 경우, 구현 시점에 공식 docs 를 다시 검증한 뒤 `supported` 로 승격시키며 정확한 값으로 갱신한다.

## 4. 동기 정책 (Sync Contract)

본 카탈로그는 `codebase/backend/src/nodes/integration/cafe24/metadata/*.ts` 와 **양방향 동기 테스트**로 보호된다.

**테스트 위치**: `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts`

**검증 규칙**:

1. **`supported` row → 메타데이터 존재**: 카탈로그에 `status: supported` 로 적힌 모든 `(resource, id)` 가 `findCafe24Operation(resource, id)` 로 조회되어야 한다. 누락 시 fail.
2. **메타데이터 → `supported` row 존재**: `CAFE24_OPERATIONS_BY_RESOURCE` 의 모든 operation 이 해당 resource 의 카탈로그에 `status: supported` 행으로 적혀 있어야 한다. 누락 시 fail.
3. **`paginated` 일치**: `supported` row 의 `paginated` 컬럼(`✓`/공백)이 메타데이터의 `paginated: boolean` 과 일치해야 한다.
4. **`method`/`path` 일치**: `supported` row 의 `method`·`path` 가 메타데이터와 일치.
5. **`scope` 일치**: `supported` row 의 `scope` 가 메타데이터 `scopeType` 과 일치.
6. **id 의 resource 내 unique**: 한 카탈로그 파일 안에 같은 `id` 가 두 번 나오면 fail.
7. **status 가 enum 중 하나**: `supported` / `planned` / `deprecated` 외의 값이 있으면 fail.
8. **`planned` row ↔ `planned.ts` mirror 양방향 동기**: catalog 의 모든 `status: planned` row 가 `CAFE24_PLANNED_BY_RESOURCE` (`metadata/planned.ts`) 에 매칭돼야 하고 그 역도 동일. (a) catalog→mirror 누락 fail, (b) mirror→catalog 누락 fail, (c) `paginated` 플래그 일치, (d) planned id 가 같은 resource 의 supported id 와 충돌 금지 — 의 4개 `it` 로 검증 (`catalog-sync.spec.ts` `describe('catalog ↔ planned.ts')`). (테스트 헤더 주석은 이를 "규칙7" 로 칭한다 — 본 문서 번호와 1칸 어긋남에 유의.)
9. **`restricted` 컬럼 ↔ 메타데이터 `restrictedApproval` 동기**: catalog row 의 `restricted` 컬럼이 `scope` 또는 `operation` 이면 그 row 에 대응하는 backend 메타데이터에 `restrictedApproval` 필드가 존재해야 하고, 그 역도 동일. 컬럼 값과 메타데이터 `level` 은 동일 토큰 (`'scope'` ↔ `'scope'`, `'operation'` ↔ `'operation'`). `restrictedApproval.approvalGroup` 필드 (UI 메시지·tooltip 묶음 식별자) 는 catalog 컬럼으로 노출하지 않으므로 본 검증 대상이 아니다 — 정의는 [`cafe24-api-metadata.md §2`](../cafe24-api-metadata.md#2-operation-메타데이터-형식) 참고. **`level='program'` 인 메타데이터 row 는 catalog 화 대상이 아닌 별도 트랙 (Analytics 등) 이므로 본 검증에서 제외**된다 — catalog 에 대응 row 가 없는 것이 정상. SoT 명단의 진위 검증은 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md) §5 절차에서 별도로 다룬다. **`status: planned` 행은 backend 메타데이터 row 가 아직 없으므로 본 검증 대상에서 제외**된다 — `planned` 행의 `restricted` 컬럼은 구현 예정 메모용이며 `planned → supported` 승격 시 메타데이터와 함께 동기 검증 대상이 된다.

테스트는 카탈로그 MD 의 표를 파싱한다 — MD 표 구문이 깨지면 곧장 fail. 따라서 본 카탈로그는 **사람이 직접 손으로 수정하는 SoT** 이며, 코드 변경 시점에 반드시 카탈로그 동기 갱신을 함께 commit 해야 한다(`spec/conventions/cafe24-api-metadata.md` §5 의 신규 endpoint 추가 절차에 인용).

> **참고 — `constraints` invariant 는 본 catalog-sync 와 별개 파일에서 수행**: backend 메타데이터의 `constraints?` ([Cafe24 API Metadata §2](../cafe24-api-metadata.md#2-operation-메타데이터-형식)) 필드명 부분집합 검증·길이 invariant 는 `metadata.spec.ts` 가 담당한다 — `catalog-sync.spec.ts` 의 검증 대상이 아니다. `constraints` 자체는 backend 메타데이터 row 가 단일 SoT 이며 catalog 컬럼으로 노출하지 않는다 (`restrictedApproval.approvalGroup` 과 동일 패턴).

## 5. Coverage Matrix

본 매트릭스는 카탈로그 row 수 + 메타데이터 row 수의 한 화면 요약이다 — 위 동기 테스트와 별개의 휴먼 가독성 보조 정보다. row 추가/삭제 시 본 표도 손으로 갱신한다.

| Resource | Supported | Planned | Cafe24 docs sub-resource 수 |
|----------|-----------|---------|---|
| [store](./store.md) | 106 | 0 | 50+ |
| [product](./product.md) | 62 | 0 | 28 |
| [order](./order.md) | 104 | 0 | 47 |
| [customer](./customer.md) | 24 | 0 | 12 |
| [community](./community.md) | 21 | 0 | 9 |
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
| **합계** | **494** | **0** | **~250** |

> 18 resource 전부 0-planned. `store.md` 의 `privacy_*` id 명명 우려 (별 `privacy` resource 와 prefix 충돌) 는 별 트랙으로 follow-up 가능.

> "Cafe24 docs sub-resource 수" 는 공식 docs 좌측 사이드바에서 본 resource 그룹 아래의 두 번째 레벨 항목 수다. 각 sub-resource 마다 통상 2~5 operation 이 존재하므로 endpoint 합계는 ~500.

## 6. 신규 endpoint 등재 절차

1. Cafe24 공식 문서에서 endpoint 확인.
2. 본 카탈로그 해당 resource 파일에 표 row 추가:
   - 처음 등재 시 `status: planned`, `method`/`path` 는 `?` 허용.
   - 구현 PR 에서 backend 메타데이터 row 1줄 추가 + 카탈로그 row 를 `planned → supported` 로 갱신 + `method`/`path`/`scope`/`paginated` 채움.
3. `_overview.md` §5 의 coverage matrix 카운트도 함께 갱신.
4. `npm test --workspace backend -- catalog-sync` 통과 확인.

> `spec/conventions/cafe24-api-metadata.md` §5 의 신규 endpoint 추가 절차도 본 카탈로그 row 갱신을 step 으로 포함한다.

## 7. Field-level 상세 레이어 (`<resource>/<entity>.md`)

각 resource 폴더 하위에 sub-resource(entity) 단위로 **field-level 상세 문서**를 둔다 (222개). Index 레이어(`<resource>.md` 의 표)가 "어떤 endpoint 가 있는가" 를 답한다면, 본 레이어는 "그 endpoint 가 어떤 field 를 주고받는가" 를 답한다.

### 7.1 파일 1개 = entity 1개

- 경로: `spec/conventions/cafe24-api-catalog/<resource>/<entity_id>.md` (예: `store/activitylogs.md`, `product/products.md`).
- `<entity_id>` 는 Cafe24 docs 의 sub-resource 식별자 (snake_case). 한 resource 내 unique.
- frontmatter: `resource`, `entity`, `cafe24_docs` (공식 docs anchor URL), `source` (추출 출처·일자).
- **spec frontmatter 가드 제외**: 본 field-level 파일은 생성기 산출물(레퍼런스)이라 [`spec-impl-evidence.md §1`](../spec-impl-evidence.md) 의 lifecycle frontmatter(`id`/`status`) 의무에서 **제외**된다 (`<name>-api-catalog/<resource>/**/*.md` — 카탈로그 디렉토리 뒤 세그먼트 1개 이상인 모든 `.md`, 근거 §Rationale R-7). 카탈로그 최상위 `<resource>.md` 인덱스는 정식 spec 으로 계속 검증된다.

### 7.2 문서 구성

1. **응답 속성 (Property list)** — entity 의 응답 객체 field. 컬럼: `Attribute` / `제약` / `설명`.
2. **Operations** — 해당 entity 의 각 operation 마다:
   - `method` / `path`, **Scope** (`mall.<read|write>_<resource>`), 호출건수 제한, 1회당 요청건수 제한, **Platform** (`cafe24` / `cafe24,youtube` — youtube shopping 채널 가용 여부), Docs anchor.
   - **요청 파라미터 (Request)** — 컬럼: `Parameter` / `필수` / `제약` / `기본값` / `설명`.

### 7.3 출처와 정확성 원칙

- **출처는 Cafe24 공식 Admin API Documentation (전체 페이지 HTML) 의 결정적(deterministic) 파싱**이다. 추측·날조로 field 를 채우지 않는다 — docs 에 없는 field 는 본 문서에도 없다.
- docs 가 type 컬럼을 별도 제공하지 않으므로(설명문 내 산문 형태) 본 카탈로그도 `제약`(형식·길이·최대값·날짜 등 `<em>` 노트)과 `설명`을 그대로 옮긴다. 정식 type 추론은 backend 메타데이터 작업(`cafe24-api-metadata.md`) 의 몫.
- docs 개정 시 **동일 추출 파이프라인으로 재생성**한다 — 생성기는 [`_generator.py`](./_generator.py) (`python3 _generator.py <docs-full-page.html>`). 결정적·멱등이므로 재실행해도 손댄 적 없는 파일은 그대로다. 손으로 행을 추가할 때도 반드시 공식 docs 를 출처로 한다.

### 7.4 sync 테스트와의 관계

본 레이어는 `catalog-sync.spec.ts` 의 검증 대상이 **아니다** (§4 의 동기 규칙은 top-level index 표 ↔ 메타데이터 사이만 강제). Field-level 문서와 backend 메타데이터의 field 단위 정합(`constraints` 등)은 `metadata.spec.ts` 트랙에서 별도로 다루며, 본 레이어는 그 작업의 **docs-side 참조 SoT** 역할이다.

> 본 레이어는 [`plan/in-progress/cafe24-backlog-residual.md`](../../../plan/in-progress/cafe24-backlog-residual.md) 의 `G-1-remaining` (docs field ↔ metadata 갭 보강) 착수를 위한 선행 데이터 확보로 생성됐다.
