# Cross-Spec Consistency Review — Cafe24 API Catalog

**Reviewer**: cross-spec checker
**Date**: 2026-05-16
**Target**: `spec/conventions/cafe24-api-catalog/` (19 files) + modifications to `spec/4-nodes/4-integration/4-cafe24.md`, `spec/conventions/cafe24-api-metadata.md`, `plan/in-progress/cafe24-node-resource-operation-ux.md`, `backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts`

---

### 발견사항

- **[WARNING]** 카탈로그 operation id 명명 규칙 위반 — product.md 에 resource prefix 불일치 항목 다수
  - target 위치: `spec/conventions/cafe24-api-catalog/product.md` — `bundleproducts_list/get/create/update/delete`, `categories_products_count/add/update/delete`, `mains_products_list/count/set/update_sorting/delete` (13개 항목)
  - 충돌 대상: `spec/conventions/cafe24-api-metadata.md` §2 — `id: string // 예: 'product_list'. resource 안에서 unique`; `spec/conventions/cafe24-api-catalog/_overview.md` §2 — id 규칙 `<resource>_<verb>` 또는 `<resource>_<sub>_<verb>` (예: `product_list`, `product_options_create`)
  - 상세: catalog `_overview.md` §2 의 id 패턴은 `<resource>_<verb>` 또는 `<resource>_<sub>_<verb>` 로 정의되어 있다. product.md 안의 `bundleproducts_list` 는 prefix 가 `bundleproducts` 이고, `categories_products_count` 는 prefix 가 `categories`, `mains_products_list` 는 prefix 가 `mains` 다. 이들은 모두 resource 값 `product` 로 시작하지 않는다. `cafe24-api-metadata.md` §4 step 3 도 동일하게 `<resource>_<verb>` 를 강제한다. 현재 이 항목들은 전부 `status: planned` 이므로 backend 메타데이터 파일에 row 가 없어 `catalog-sync.spec.ts` 가 즉시 fail 하지는 않는다. 그러나 planned → supported 전환 PR 에서 id 패턴이 컨벤션과 충돌하여 동기 테스트가 fail 하거나, MCP tool name 이 `mcp_<sid>__bundleproducts_list` 처럼 resource 정보를 잃는 형태로 노출될 수 있다.
  - 제안: planned 항목의 id 를 구현 PR 에서 `product_bundles_list`, `product_category_products_count`, `product_mains_list` 처럼 `product_` prefix 를 붙이는 방향으로 카탈로그를 갱신한다. 또는 `_overview.md` §2 의 id 규칙에 예외 케이스(Cafe24 공식 sub-resource 이름이 resource 이름과 다를 때 원본 명칭 허용)를 명시적으로 추가한다. 카탈로그가 SoT 이므로 규칙 우선 갱신 후 planned 행 id 보정이 권장 순서다.

- **[WARNING]** `category.md` 의 `mains_*` 항목 vs `product.md` 의 `mains_products_*` — 동일 Cafe24 API 하위 리소스 중복 등재 가능성
  - target 위치: `spec/conventions/cafe24-api-catalog/category.md` — `mains_list`, `mains_add`, `mains_update`, `mains_delete`; `spec/conventions/cafe24-api-catalog/product.md` — `mains_products_list`, `mains_products_count`, `mains_products_set`, `mains_products_update_sorting`, `mains_products_delete`
  - 충돌 대상: 두 파일 모두 Cafe24 Admin API 의 "mains" (메인 카테고리) 도메인 아래 endpoint 를 등재 중. Cafe24 공식 docs 에서 메인 카테고리 자체(`mains`)와 메인 카테고리 내 상품(`mains/products`)은 서로 다른 path 이지만, 두 resource(category/product) 에 걸쳐 분산 등재되어 있어 일관된 resource 귀속 원칙이 문서화되어 있지 않다.
  - 상세: `_overview.md` 에는 어느 Cafe24 sub-resource 를 어느 catalog resource 파일에 귀속시킬지 결정 원칙이 없다. 운영자가 나중에 "메인 카테고리 조작"을 찾으려 할 때 category 와 product 두 파일을 모두 봐야 할 수 있다. 카탈로그가 SoT 이므로 귀속 원칙 부재는 유지보수 부담이 된다.
  - 제안: `_overview.md` §1 또는 §2 에 "Cafe24 공식 docs 의 상위 리소스 그룹이 귀속 기준" 임을 명시하고, mains/products 는 category 리소스에 귀속, product 가 주체인 경우에만 product 에 귀속 등의 규칙을 한 줄 추가한다.

- **[WARNING]** `cafe24NodeOutputSchema` 에 `status: z.string().optional()` 필드가 포함되어 있으나 spec 은 이 노드에서 `status` 를 항상 생략
  - target 위치: `backend/src/nodes/integration/cafe24/cafe24.schema.ts` line 115 — `status: z.string().optional()`
  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md` §3 — "`status` 는 비-블로킹 노드이므로 항상 생략 (Principle 0)"; §5 — "`status` 는 비-블로킹 노드이므로 항상 생략"; §9.5 — "Principle 0: 5필드 (`config`/`output`/`meta`/`port`) — `status` 는 비-블로킹이므로 생략"
  - 상세: 이 파일은 이번 변경 대상이 아니고 pre-existing 상태(git HEAD 와 동일)이나, 본 리뷰의 대상 변경 세트에서 `cafe24.schema.ts` 가 명시적 참조로 포함된다(`spec/4-nodes/4-integration/4-cafe24.md` §1 의 `Source of truth: backend/src/nodes/integration/cafe24/cafe24.schema.ts`). spec 은 `status` 필드를 이 노드에서 **사용하지 않는다**고 반복 명시하는데, 출력 schema 가 이를 허용한다. 이는 현재도 존재하는 schema/spec 불일치이며, 이번 카탈로그 PR 에서 spec 참조를 강화하면서 함께 정정해야 할 항목이다.
  - 제안: `cafe24NodeOutputSchema` 에서 `status` 필드를 제거하거나, spec 이 이 필드를 `never` / 미사용 허용으로 명시한다. 이 파일 수정은 developer 역할 범주다.

- **[INFO]** `product.md` 의 operation id `categories_products_*` 와 `category.md` 의 `category_products_list` — 명명 패턴 불일치
  - target 위치: `spec/conventions/cafe24-api-catalog/product.md` — `categories_products_count`, `categories_products_add`, `categories_products_update`, `categories_products_delete`; `spec/conventions/cafe24-api-catalog/category.md` — `category_products_list`
  - 충돌 대상: `_overview.md` §2 id 규칙 (`<resource>_<verb>` 또는 `<resource>_<sub>_<verb>`)
  - 상세: product.md 에서 카테고리 상품 관련 항목은 `categories_products_*` 접두 패턴을 사용하고, category.md 에서는 `category_products_list` 를 사용한다. 두 접두가 `categories` vs `category` 로 달라 일관성이 없다. 이 불일치는 MCP tool name 에 그대로 노출된다.
  - 제안: 두 파일 중 하나의 패턴으로 통일. `category_products_*` 가 단수형으로 더 자연스럽고 `_overview.md` 예시(`product_options_create`)의 패턴에도 가깝다.

- **[INFO]** 카탈로그 상태 enum (`supported` / `planned` / `deprecated`) — 다른 spec 영역의 Integration `status` enum 과 이름이 겹치지만 의미가 다름
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §3
  - 충돌 대상: `spec/1-data-model.md` §2.10 / `spec/2-navigation/4-integration.md` §6 — Integration 엔티티의 `status` 컬럼 (`connected`, `expired`, `error`, `pending_install`)
  - 상세: 카탈로그의 `status` 는 endpoint 의 구현 완료 여부(supported/planned/deprecated)를 나타내고, Integration 엔티티의 `status` 는 OAuth 연결 상태를 나타낸다. 두 도메인이 다르며 직접 충돌은 없다. 그러나 같은 프로젝트 내에서 `status` 를 두 다른 의미로 쓰므로, frontend 개발자나 신규 기여자가 혼동할 수 있다. `_overview.md` §3 에 "(이 status 는 endpoint 구현 완료 여부를 나타내며 Integration 엔티티의 OAuth 연결 status 와 무관하다)" 같은 한 줄 주석이 명확성을 높인다.
  - 제안: `_overview.md` §3 status enum 설명에 스코프 명시 주석 추가.

- **[INFO]** `cafe24-api-metadata.md` §4 step 3 — id 규칙 `<resource>_<verb>` 만 명시, catalog `_overview.md` §2 는 `<resource>_<sub>_<verb>` 도 허용
  - target 위치: `spec/conventions/cafe24-api-metadata.md` §4 step 3
  - 충돌 대상: `spec/conventions/cafe24-api-catalog/_overview.md` §2 id 컬럼 설명
  - 상세: metadata 컨벤션의 step 3 은 `<resource>_<verb>` 만 예시로 들고, catalog overview §2 는 `<resource>_<sub>_<verb>` 도 허용(예: `product_options_create`)한다. 완전히 모순은 아니지만 설명이 불완전하다.
  - 제안: `cafe24-api-metadata.md` §4 step 3 을 `<resource>_<verb>` 또는 `<resource>_<sub>_<verb>` 로 갱신하여 두 문서를 동기화한다.

---

### 요약

카탈로그 추가 자체의 핵심 구조 — 18개 resource 파일, status enum 3값, 양방향 동기 테스트, 4-cafe24.md/cafe24-api-metadata.md 참조 갱신 — 는 기존 spec 과 직접 모순되지 않는다. 18 resource enum 은 `backend/src/nodes/integration/cafe24/metadata/types.ts` 의 `Cafe24Resource` 및 `spec/4-nodes/4-integration/4-cafe24.md` §1 의 목록과 완전히 일치한다. MCP 도구 명 규칙(§5.2 의 `mcp_<sid>__<toolName>`, `__` 첫 발생으로 split) 은 카탈로그 operation id 가 단일 underscore 만 쓰므로 충돌 없다. 주요 우려 사항은 두 개다: (1) `product.md` 의 planned 항목 13개가 `<resource>_` prefix 규칙을 어기며, 이들이 supported 로 전환될 때 backend metadata 작성자가 같은 id 로 row 를 만들면 `catalog-sync.spec.ts` 패턴 검증 이전 단계에서 컨벤션 위반이 그대로 코드에 박힌다. (2) `category.md` 와 `product.md` 에 메인 카테고리 endpoint 가 분산 등재되어 있어 귀속 원칙이 문서화되지 않았다. `cafe24NodeOutputSchema` 의 `status` 필드는 pre-existing 불일치로 이번 PR 이 도입한 것은 아니나 spec 참조 강화 시점에 정정 권장이다.

---

### 위험도

MEDIUM

(CRITICAL 0, WARNING 3, INFO 3 — 즉시 작동 불가 모순은 없으나 planned→supported 전환 PR 에서 WARNING 1 이 CI fail 또는 코드 컨벤션 위반으로 번질 수 있다.)
