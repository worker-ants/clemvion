# 정식 규약 준수 검토 — `spec/conventions/cafe24-api-catalog`

검토 모드: `--impl-done`, diff-base=`origin/main`

---

## 발견사항

### INFO: `_overview.md` 에 `## Rationale` 섹션 부재
- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md` — 전체 문서
- **위반 규약**: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
- **상세**: 다른 convention 문서(`audit-actions.md`, `cafe24-api-metadata.md` 등)는 `## Rationale` 섹션을 보유하는데 `_overview.md` 에는 없다. 단, `_overview.md` 는 `_` prefix 로 lifecycle frontmatter 의무 면제 대상이며, 카탈로그 enumeration/동기 정책 기술 문서로 일반 spec 문서와 성격이 다르다. 본 diff 에서 새로 도입된 조건이 아니라 pre-existing 상태.
- **제안**: 규약 결정의 배경(예: 왜 18 resource를 top-level 파일로, 하위를 field-level로 구분했는지, catalog-sync 테스트 채택 이유 등)을 간략한 `## Rationale` 절로 추가하는 것을 고려. 단, `_` prefix 파일이므로 강제 의무 사항 아님.

### INFO: endpoint 제거 절차가 `_overview.md` §6 에 명시되어 있지 않음
- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md` §6 (신규 endpoint 등재 절차)
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md` §6 — 현재 신규 추가 절차만 기술, 제거 절차 없음
- **상세**: 이번 diff 는 9개 docs-absent seed row 를 catalog + backend metadata 양쪽에서 동시 제거하는 절차를 처음으로 수행했다. §6 은 "신규 endpoint 등재 절차" 만 정의하고 `deprecated` 로의 전환이나 완전 제거 절차는 정의하지 않는다. 규약 이용자가 다음 제거 작업 시 참조할 내용이 없다.
- **제안**: §6 에 "endpoint 제거 절차" 소절을 추가해 (1) backend metadata row 삭제, (2) catalog row 삭제, (3) coverage matrix 카운트 갱신, (4) `catalog-sync.spec.ts` 통과 확인 단계를 명시하거나, 또는 `deprecated` status 와 완전 제거의 구분 기준(Cafe24-side deprecation vs docs-absent)을 기술하도록 권장.

---

## 규약 준수 확인 항목 (이상 없음)

### 명명 규약
- **카탈로그 파일명**: `application.md`, `category.md`, `customer.md`, `promotion.md`, `store.md` — 모두 `Cafe24Resource` enum 명칭과 1:1 일치. snake_case 소문자. ✓
- **operation id 형식**: 남은 모든 id (`scripttags_list`, `apps_update`, `appstore_orders_get` 등) 가 `<sub-resource>_<verb>` 영문 snake_case 패턴 준수. resource 내 unique 조건 충족. ✓
- **field-level 파일 entity id**: kebab-case (`appstore-orders`, `appstore-payments`, `webhooks-logs` 등) — `_overview.md` §7.1 규약 준수. ✓

### 출력 포맷 규약
- **status enum 준수**: 변경 후 모든 catalog row 의 `status` 컬럼이 `supported | planned | deprecated` 중 하나. 제거된 9개 행에 대해 비정상 값 없음. ✓
- **coverage matrix 수치 정합**: store 106→105(-1), customer 24→22(-2), promotion 35→33(-2), application 19→17(-2), category 19→17(-2), 합계 494→485(-9). 제거 행 수와 정확히 일치. §5/§6 step 3 준수. ✓
- **restricted 컬럼 사용**: `store.md` 만 10-컬럼 표(restricted 포함), 나머지 resource 는 9-컬럼(restricted 생략). restricted operation 이 없는 resource 에서 컬럼 헤더 자체를 생략하는 현행 관례는 `_overview.md` §2 (restricted 컬럼 `—` 필수) 와 모순 없음. ✓

### 문서 구조 규약
- **`_overview.md` prefix**: 카탈로그 개요 파일이 `_overview.md` 를 사용 — `spec/conventions/<영역>/_overview.md` 패턴 준수, lifecycle frontmatter 면제 대상. ✓
- **index 파일 frontmatter**: `application.md`(id: application, status: implemented), `category.md`(id: category, status: implemented) — `spec-impl-evidence.md` §2 스키마 준수. id 가 basename 기반, code 경로 유효. ✓
- **field-level 파일 frontmatter**: `resource`, `entity`, `cafe24_docs`, `source` 키 사용 — lifecycle frontmatter 면제 대상 (`spec-impl-evidence.md` §1 기준, `cafe24-api-catalog/<resource>/**/*.md`). ✓

### 동기 정책 (Sync Contract)
- **Rule 1 (supported→metadata)**: 제거된 row 들의 backend metadata row 도 동시 제거 확인 (`application.ts`, `category.ts`, `customer.ts`, `promotion.ts`, `store.ts` diff 검증). ✓
- **Rule 2 (metadata→supported)**: 제거된 metadata row 가 catalog 에도 제거됨 — 양방향 정합. ✓
- **catalog-sync.spec.ts 파싱 안전**: MD 표 구문이 깨지지 않음. 제거된 행들은 완전한 표 행이었고 나머지 행들의 구문은 유지됨. ✓

### `cafe24-api-metadata.md` 예시 수정
- `cafe24.customer.customer_update` → `cafe24.customer.customer_delete` — `customer_update` id 가 제거됐으므로 예시를 살아있는 id 로 갱신. `customer_delete` 는 현재 `customer.md` 에 `supported` 로 존재. ✓

### 금지 항목
- `_overview.md` §4 Rule 7: status enum 외부 값 없음. ✓
- `_overview.md` §4 Rule 6: resource 내 id unique — 제거 후에도 중복 없음. ✓
- docs-absent ⚠ 경고 노트 삭제: 행 자체가 삭제됐으므로 경고 노트를 제거하는 것이 타당. 잔존하는 plan 참조(`cafe24-backlog-residual.md §G-2`)의 갱신은 plan 라이프사이클 영역이며 본 규약 검토 범위 외. ✓

---

## 요약

`spec/conventions/cafe24-api-catalog` 의 이번 변경(9개 docs-absent seed row 제거 + coverage matrix 카운트 보정 + `cafe24-api-metadata.md` 예시 갱신)은 정식 규약을 전반적으로 준수한다. catalog-sync 계약의 핵심인 catalog ↔ backend metadata 양방향 정합이 원자적으로 유지됐고, id 명명·status enum·frontmatter 스키마·coverage matrix 갱신 의무가 모두 충족됐다. 제기된 두 발견사항은 모두 INFO 등급이며 pre-existing 상태이거나 절차 문서화 보완 권고 수준이다. 채택 시 다른 시스템의 invariant를 깨는 규약 직접 위반은 발견되지 않았다.

---

## 위험도

NONE
