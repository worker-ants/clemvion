---
worktree: cafe24-node-ux-catalog-4b8f2c (Phase 1) / cafe24-node-ux-impl-9d3e1a (Phase 2~)
started: 2026-05-16
owner: project-planner (Phase 1) / developer (Phase 2+)
---

# Plan: Cafe24 노드 Resource → Operation UX 개편

## 배경

현재 `Cafe24Config` 컴포넌트(`frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx:298`)는 다음 UX 결함을 가진다:

- Operation 이 자유 텍스트 입력 — 사용자가 `product_list` 같은 id 를 외워야 함.
- Fields 가 KeyValueEditor — 어떤 키가 required/optional 인지 UI 가 안내하지 않음. type/enum 검증도 없음.
- Pagination 이 항상 노출 — 미지원 operation 에도 limit/offset 입력칸이 그려짐.

목표: Resource 선택 → 해당 resource 의 Operation select 노출 → Operation 선택 시 fields/pagination 이 메타데이터 기반으로 자동 조정.

## Spec 영향

- `spec/4-nodes/4-integration/4-cafe24.md` §2 (설정 UI) — 이미 원하는 그림이 박혀 있음. UI 가 spec 을 따라잡지 못한 상태.
- `spec/conventions/cafe24-api-metadata.md` — 메타데이터 형식 정의됨.
- **신규**: `spec/conventions/cafe24-api-catalog/` 디렉토리 — 18 resource 의 모든 operation (supported + planned + deprecated) 카탈로그. 단일 진실.

## 작업 단위

### Phase 1 — Spec 카탈로그 + 동기 테스트 (PR #78, MERGEABLE)

- [x] `spec/conventions/cafe24-api-catalog/_overview.md` 신규
- [x] `spec/conventions/cafe24-api-catalog/{18 resource}.md` (Cafe24 docs 전수, supported 53 + planned ~300)
- [x] Backend sync test `catalog-sync.spec.ts` (jest 8/8 통과, 양방향)
- [x] `spec/4-nodes/4-integration/4-cafe24.md` §9.3 + `spec/conventions/cafe24-api-metadata.md` §4 — 카탈로그 링크
- [x] consistency-check 세션 `review/consistency/2026/05/16/11_43_07/` — Critical 0

### Phase 2 — 백엔드 frontend payload (이 PR — claude/cafe24-node-ux-impl-9d3e1a)

상세 설계 결정 (2026-05-16):

- **`NodeComponent.extras?: () => unknown`** — 옵셔널 메서드. 컴포넌트가 frontend 에 추가로 보내고 싶은 페이로드 반환. registry 의 `listDefinitions()` 결과에 `extras` 로 surface, `/nodes/definitions` 응답 DTO 에 옵셔널 필드로 추가.
- **`PublicCafe24Operation` 타입** — `Cafe24OperationMetadata` 의 frontend 안전 부분만 추출. **`method` / `path` 는 제외** (frontend 가 알 필요 없고 URL 구조 노출 회피). 포함: `id`, `label`, `description`, `scope`, `paginated`, `requiredFields`, `fields[]` (각 필드: `name`, `type`, `required`, `description?`, `enum?`, `default?`, `location?`).
- **planned 데이터** — 카탈로그 MD 가 정답(SoT) 이지만 production 번들에 spec/ 없음 → backend 에 `planned.ts` 데이터 파일을 별도로 유지하고 sync test 가 catalog MD ↔ planned.ts parity 강제. 양쪽 모두 갱신해야 PR 머지 가능.
- **응답 shape**: `definitions[i].extras = { operationsByResource: Record<resource, PublicCafe24Operation[]>, plannedByResource: Record<resource, PublicCafe24Planned[]> }` — cafe24 노드만 채움, 다른 노드는 `extras` 없음.

체크리스트:

- [ ] `backend/src/nodes/core/node-component.interface.ts` — `NodeComponent.extras?: () => unknown` 추가
- [ ] `backend/src/nodes/core/node-component.registry.ts` — `NodeDefinitionView.extras?: unknown` 추가, `listDefinitions()` 가 호출 + 전달
- [ ] `backend/src/modules/nodes/dto/responses/node-response.dto.ts` — `NodeDefinitionDto.extras?: Record<string, unknown>` (Swagger 표기)
- [ ] `backend/src/nodes/integration/cafe24/metadata/public-meta.ts` — `PublicCafe24Operation` / `PublicCafe24Field` / `PublicCafe24Planned` 타입 + `toPublicOperation(meta)` helper
- [ ] `backend/src/nodes/integration/cafe24/metadata/planned.ts` — `CAFE24_PLANNED_BY_RESOURCE` (id + label + paginated, 카탈로그 mirror)
- [ ] `backend/src/nodes/integration/cafe24/cafe24.component.ts` — `extras()` 구현
- [ ] `catalog-sync.spec.ts` 확장 — planned.ts ↔ 카탈로그 MD 양방향 parity
- [ ] `cafe24-extras.spec.ts` (or 기존 metadata test 확장) — extras 페이로드 shape 검증, method/path 누출 없음
- [ ] `frontend/src/lib/node-definitions/types.ts` — `NodeDefinitionResponse.extras?: unknown`
- [ ] consistency-check (impl-prep) 세션 + Critical 0 확인

### Phase 3 — 프런트 Cafe24Config 재작성 (같은 PR or 별 PR)

- [ ] Operation select (resource → ops) — `status: planned` 인 op 는 disabled + "지원 예정" 배지
- [ ] Coverage indicator — "Product · 7/15 지원" 한 줄
- [ ] 동적 fields 폼: required/optional 두 그룹, type 별 위젯 (string/number/enum/boolean) — 모두 ExpressionInput 호환 (사용자 결정: 표현식 유지)
- [ ] Pagination 조건부 노출 (`op.paginated === true`)
- [ ] Operation 변경 시 호환 가능 키만 유지 (교집합)
- [ ] `Cafe24Config.test.tsx` 추가 (resource→op reset, paginated 분기, planned disabled, 표현식 입력 보존)

### Phase 4 — Coverage 확장 (별 트랙, 본 PR 종료 후)

- Planned → Supported 전환 PR (operation 추가, metadata row 1개 = 카탈로그 1행 supported 화)
- 사용자 피드백 통로 (옵션): planned 항목 옆 "구현 요청" 버튼 — 별 작업

## 위험

- 카탈로그 분량이 큼 (~200~300 endpoint 추정). 한 번에 작성 시 PR 리뷰 부담.
- Cafe24 공식 docs anchor 가 안정적인지 확인 필요 — 깨지면 sync test 무관하나 사용자 navigation 이 깨짐.
- `cafe24-spec-sync-e2a8b9` 워크트리(`spec/2-navigation/4-integration.md` 수정 중)와 spec/ 동시 수정 → conflict 가능. 본 plan 은 `spec/conventions/cafe24-api-catalog/**` + `spec/4-nodes/4-integration/4-cafe24.md` 만 수정하므로 직접 충돌은 없음.

## 수용 기준

- Phase 1: catalog dir 18 + 1 파일 존재, sync test 통과, 4-cafe24.md / cafe24-api-metadata.md 에 링크.
- Phase 2: `GET /nodes/definitions` 응답 (cafe24 항목) 에 `extras.operationsByResource` 포함.
- Phase 3: 사용자가 Resource 만 선택해도 operation 후보를 select 에서 본다. operation 선택 시 fields/pagination 자동 조정. 표현식 (`{{ }}`) 유지.

## 후속

본 작업이 완료되면 `spec-update-cafe24-app-url-reuse.md`, `cafe24-data-model-strengthen.md`, `cafe24-pending-polish-followup.md` 등 다른 in-progress cafe24 plan 들과 컨플릭트 가능성 재점검.
