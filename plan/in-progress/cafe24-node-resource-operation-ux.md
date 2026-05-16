---
worktree: cafe24-node-ux-catalog-4b8f2c
started: 2026-05-16
owner: project-planner → developer (Phase 2/3)
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

### Phase 1 — Spec 카탈로그 + 동기 테스트 (이 PR)

- [ ] `spec/conventions/cafe24-api-catalog/_overview.md` 신규
  - 컬럼 정의, status enum (`supported` / `planned` / `deprecated`), 동기 정책, coverage matrix, 18 resource 링크
- [ ] `spec/conventions/cafe24-api-catalog/{store,product,order,customer,community,design,promotion,application,category,collection,supply,shipping,salesreport,personal,privacy,mileage,notification,translation}.md` (18개) — 각 파일이 해당 resource 의 모든 operation 표
  - Cafe24 공식 docs 전수 (option C — 사용자 결정 2026-05-16)
  - 현재 metadata 에 있는 ~53개는 `status: supported`
  - 나머지는 `status: planned`
- [ ] Backend sync test (`backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts`)
  - 카탈로그 MD 표를 파싱해 `(resource, id, status, paginated)` 추출
  - `CAFE24_OPERATIONS_BY_RESOURCE` 와 양방향 비교
- [ ] `spec/4-nodes/4-integration/4-cafe24.md` §9.3 + `spec/conventions/cafe24-api-metadata.md` §4 — 카탈로그 링크 한 줄씩
- [ ] `/consistency-check --spec` 호출 (project-planner 의무) — Critical 0 확인 후 commit

### Phase 2 — 백엔드 메타데이터 frontend payload (별 PR)

- [ ] `Cafe24OperationMetadata.toPublicOperationMeta()` (label, requiredFields, fields, paginated, status, description, scope 만 전달; path/method 제외)
- [ ] `NodeDefinitionResponse.extras?: Record<string, unknown>` 신규 옵셔널 필드
- [ ] `cafe24NodeMetadata.extras = { operationsByResource, planned: [...] }` — planned 항목은 카탈로그에서만 와야 하므로 build-time inline 또는 sync test 의 cross-reference 가 SoT
- [ ] zod 메타에 노출 (definition response 직렬화)

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
