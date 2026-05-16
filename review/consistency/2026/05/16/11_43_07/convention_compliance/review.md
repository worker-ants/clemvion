# Convention Compliance Review — Cafe24 API Catalog

대상 파일:
- `spec/conventions/cafe24-api-catalog/_overview.md` (신규)
- `spec/conventions/cafe24-api-catalog/{store,product,order,...}.md` (18개 신규)
- `spec/conventions/cafe24-api-metadata.md` (수정)
- `spec/4-nodes/4-integration/4-cafe24.md` (수정)
- `plan/in-progress/cafe24-node-resource-operation-ux.md` (신규)

참조 규약: `CLAUDE.md` 명명 컨벤션 표, spec 문서 3섹션 권장 구성

---

## 발견사항

### 발견 1

- **[WARNING]** `spec/conventions/cafe24-api-catalog/_overview.md` — underscore prefix 패턴이 정의되지 않은 경로에 적용됨
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` 파일명
  - 위반 규약: `CLAUDE.md` §명명 컨벤션 표
  - 상세: `CLAUDE.md` 의 명명 컨벤션 표는 underscore prefix(`_`) 를 두 가지 경우에만 정의한다 — `spec/<영역>/_product-overview.md` (영역의 제품 정의, 다중 spec 파일 영역에 사용)와 `spec/<영역>/_layout.md` (영역 공통 레이아웃). `spec/0-overview.md` 의 "문서 컨벤션" 항목도 `_product-overview.md`·`_layout.md` 두 패턴만 열거한다. `spec/conventions/cafe24-api-catalog/_overview.md` 는 이 두 패턴 중 어느 것도 아닌 새 패턴(`_overview.md`)이다. `spec/conventions/*.md` 는 규약상 "평문" 파일명이어야 하고, 하위 디렉토리(`cafe24-api-catalog/`) 를 신설했을 때의 인덱스 파일 명명 기준은 명시적 규약이 없다.
  - 제안: 두 선택지가 있다. (A) 파일명을 `_overview.md` → `overview.md`(숫자 없는 평문) 또는 `0-overview.md`(영역 아키텍처 개요의 `0-` prefix 패턴을 차용)로 변경한다. (B) 이 패턴을 규약으로 명시화한다 — `CLAUDE.md` 명명 컨벤션 표에 `spec/conventions/<name>/_overview.md` → "정식 규약 디렉토리의 인덱스 문서" 행을 추가한다. 현재 `_overview.md` 라는 이름을 쓴 근거는 `_layout.md`·`_product-overview.md` 의 underscore prefix 가 "디렉토리 내 인덱스/공통 문서" 임을 암시한다는 유추이며, 이 의도는 합리적이나 규약에 명시되지 않아 WARNING 수준이다.

---

### 발견 2

- **[WARNING]** `spec/conventions/cafe24-api-catalog/store.md` — operation id 가 `<resource>_<verb>` 규칙에서 이탈한 다수 행이 존재
  - target 위치: `spec/conventions/cafe24-api-catalog/store.md` 표, id 컬럼 전반
  - 위반 규약: `spec/conventions/cafe24-api-metadata.md` §4 step 3 ("id 는 `<resource>_<verb>` 형식 (예: `product_list`, `order_update_status`). 중복 금지 (resource 내)")
  - 상세: `store.md` 파일은 resource 이름이 `store` 이지만, id 의 resource prefix 가 `store_` 가 아닌 행들이 대부분이다. 예: `shops_list`, `shops_get`, `activitylogs_list`, `activitylogs_get`, `automessages_arguments_get`, `automessages_setting_get`, `benefits_setting_get`, `boards_setting_get`, `carts_setting_get`, `categories_properties_setting_get` 등. 이 행들은 Cafe24 Admin API 의 실제 sub-resource 이름(shops, activitylogs, automessages 등)을 prefix 로 사용하며, 파일이 속한 resource enum 값인 `store` 를 prefix 로 쓰지 않는다. `cafe24-api-metadata.md` §4 step 3 의 규칙 "id 는 `<resource>_<verb>` 형식" 과 상충한다. 이 id 들이 `CAFE24_OPERATIONS_BY_RESOURCE['store']` 에 `id: 'shops_list'` 로 등록되면, `findCafe24Operation('store', 'shops_list')` 조회에는 문제가 없지만 id 를 보고 resource 를 역추론할 때 (`store` 가 아닌 `shops` 를 예상) 혼동이 발생한다. `catalog-sync.spec.ts` 파싱 결과도 `shops_list.resource = 'store'` 임에도 id prefix 가 `shops` 여서, id 기반 네이밍 추론 코드가 있다면 불일치가 생긴다.
  - 제안: 두 선택지가 있다. (A) 규약(`cafe24-api-metadata.md` §4)에 "Store resource 의 경우 Cafe24 API 가 store 단일 sub-resource 가 아닌 복수 sub-resource 그룹(shops, activitylogs, automessages 등)을 포함하므로, store 파일 내 id 는 sub-resource prefix 를 허용한다"는 예외 조항을 추가한다. (B) id 를 `store_<sub>_<verb>` (예: `store_shops_list`, `store_activitylogs_list`)로 통일하고 규약과 카탈로그 양쪽을 갱신한다. 현재 `supported` 행(`store_get`, `shops_list`)이 이미 backend metadata 와 sync 되어 있을 경우 id 변경은 backend 메타데이터 row 의 id 도 동시에 갱신해야 하며 `catalog-sync.spec.ts` 도 함께 통과해야 한다.

---

### 발견 3

- **[INFO]** `spec/conventions/cafe24-api-catalog/_overview.md` — 정식 규약 문서임에도 3섹션 구조(Overview / 본문 / Rationale) 미적용
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` 전체 구조
  - 위반 규약: `CLAUDE.md` §프로젝트 스펙 문서 ("각 spec 문서는 권장 3섹션 구성을 따른다: 1. Overview (제품 정의) 2. 본문 (스펙) 3. Rationale")
  - 상세: `_overview.md` 는 7개 섹션(디렉토리 구조, 표 컬럼 정의, status enum, 동기 정책, Coverage Matrix, 신규 등재 절차, CHANGELOG)으로 구성되어 있고 `Rationale` 섹션이 없다. CLAUDE.md 는 3섹션을 "권장"으로 표기하나, 다른 정식 규약 파일들(`node-output.md`, `swagger.md`, `cafe24-api-metadata.md`)도 Rationale 섹션을 가지지 않는 경우가 있으므로 이 자체가 이례적이지는 않다. 다만 도입 결정 배경("Cafe24 docs 전수 등재 — option C 결정", "양방향 동기 테스트 채택 배경" 등)이 plan 문서에만 산재하고 _overview.md 안에서 Rationale 로 통합되어 있지 않다.
  - 제안: `_overview.md` 끝에 `## Rationale` 섹션을 추가해 "option C(전수 등재) 결정 배경"과 "양방향 동기 테스트 선택 근거"를 2-3줄로 요약한다. 이렇게 하면 plan 문서가 complete 로 이동한 후에도 의사결정 맥락이 규약 문서에 보존된다.

---

### 발견 4

- **[INFO]** `plan/in-progress/cafe24-node-resource-operation-ux.md` — frontmatter `owner` 값이 이중 역할을 기재함
  - target 위치: `plan/in-progress/cafe24-node-resource-operation-ux.md` line 4 (`owner: project-planner → developer (Phase 2/3)`)
  - 위반 규약: `CLAUDE.md` §PLAN 문서 라이프사이클 frontmatter 메타데이터 ("owner: `<역할/이름>` — planner / developer / 사용자 본인 등")
  - 상세: CLAUDE.md 의 frontmatter 예시는 단일 역할 값(`planner`, `developer`, `사용자 본인`)을 사용한다. 현재 값 `project-planner → developer (Phase 2/3)` 는 Phase 전환 예정을 인라인으로 표현하고 있으며 `plan_coherence` checker 가 `owner` 값을 파싱할 때 예상치 않은 형식일 수 있다. 기능상 문제라기보다는 규약 예시 형식에서 벗어난 정도다.
  - 제안: 현재 Phase 의 담당자만 `owner` 에 기재하고(`project-planner`), Phase 전환 예정은 본문의 작업 단위 섹션에서 서술하는 방식으로 분리한다. 또는 `owner` 필드 확장 형식을 CLAUDE.md 에 명시화한다.

---

### 발견 5

- **[INFO]** `spec/0-overview.md` §4 정식 규약 표 — `cafe24-api-catalog` 항목 미등재
  - target 위치: `spec/0-overview.md` line 341 (정식 규약 행 `노드 Output 규약 | — | ./conventions/node-output.md`)
  - 위반 규약: `CLAUDE.md` §프로젝트 스펙 문서 ("spec/0-overview.md §8 참고"가 상세 트리의 기준점으로 언급됨), `spec/0-overview.md` §4 의 위치 인덱스 역할
  - 상세: `spec/0-overview.md` §4 의 파일 위치 표는 기존 `노드 Output 규약` 만 등재되어 있고 신규 `cafe24-api-metadata.md` 및 `cafe24-api-catalog/` 가 등재되지 않았다. `spec/0-overview.md` 가 "구체 파일 목록을 박제하지 않는다"는 방침을 명시(line 155)하지만, 정식 규약은 다른 spec 의 참조점이 되므로 overview 인덱스에 한 줄 추가하는 편이 discoverability 를 높인다. 엄격한 위반은 아니다.
  - 제안: `spec/0-overview.md` §4 표에 `Cafe24 API 규약 | — | ./conventions/cafe24-api-metadata.md · ./conventions/cafe24-api-catalog/_overview.md` 행을 추가한다.

---

## 요약

신규 파일들의 내용 자체는 정확하고 내부 일관성이 높다. CHANGELOG 항목은 날짜와 함께 모든 수정 파일에 기재되었고, plan frontmatter 의 `worktree`·`started`·`owner` 세 필드는 모두 존재한다. 금지 항목(옛 `prd/`·`memory/`·`user_memo/` 경로, `claude -p` SDK 직접 호출 등) 은 발견되지 않았다. 규약 위반의 핵심은 두 가지다: (1) `_overview.md` 라는 파일명 패턴이 기존 명명 컨벤션 표에 없는 신규 패턴이며 규약 갱신 없이 도입되었다(WARNING), (2) `store.md` 의 id 들이 `<resource>_<verb>` 규칙에서 이탈해 `cafe24-api-metadata.md` §4 step 3 과 상충한다(WARNING). 두 항목 모두 규약 자체를 갱신하거나 id 체계를 통일하면 해소 가능한 수준이며, 현재 시점에서 다른 시스템의 invariant 를 직접 깨지는 않는다(store resource 의 `supported` 행 2개, `store_get`·`shops_list`, 는 이미 backend 메타데이터에 해당 id 로 등록되어 있을 가능성이 높으므로 id 변경은 backend 코드 수정을 수반한다).

한국어 라벨은 자연스러운 한국어로 작성되어 있으며 기계 번역 흔적이 없다. 내부 cross-reference 링크(`_overview.md`→`cafe24-api-metadata.md`, `4-cafe24.md`→`cafe24-api-catalog/_overview.md` 등)는 모두 상대 경로로 올바르게 기재되어 있으며 대상 파일이 존재한다.

## 위험도

LOW
