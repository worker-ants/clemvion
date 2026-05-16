---
worktree: cafe24-node-ux-frontend-f5a3b8 (Phase 3, active) — Phase 1 & 2 worktrees merged & removed
started: 2026-05-16
owner: developer
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

### Phase 2 — 백엔드 frontend payload (PR #80, merged)

- [x] `NodeComponent.extras?: () => unknown` + registry `listDefinitions()` + `NodeDefinitionDto.extras?`
- [x] `PublicCafe24Operation` / `PublicCafe24Field` 타입 (`backend/.../metadata/public-meta.ts`) — `method`/`path` 제외
- [x] `CAFE24_PLANNED_BY_RESOURCE` (`planned.ts`) — 18 resource × ~300 row, 카탈로그 mirror
- [x] `cafe24.component.ts` `extras: () => buildCafe24Extras()`
- [x] `catalog-sync.spec.ts` 확장 — planned.ts ↔ 카탈로그 MD 4 추가 cases
- [x] `public-meta.spec.ts` — extras 페이로드 shape 15 cases (jest 250/250)
- [x] `frontend/src/lib/node-definitions/types.ts` — `NodeDefinitionResponse.extras?` + `Cafe24NodeExtras` / `Cafe24SupportedOperation` / `Cafe24PlannedOperation` / `Cafe24OperationField`
- [x] consistency-check `review/consistency/2026/05/16/12_08_11/` — Critical 1 (Cafe24PlannedOperation 동명이의 → Cafe24PlannedOperationEntry 로 리네임 해소)

### Phase 3 — 프런트 Cafe24Config 재작성 (이 PR — claude/cafe24-node-ux-frontend-f5a3b8)

상세 설계 결정:

- **데이터 출처**: `getNodeDefinition('cafe24')?.extras` → `Cafe24NodeExtras` 로 narrow. 정의가 로드되지 않았으면 `null` 반환 → 사용자가 Operation 을 선택할 수 없는 disabled 상태로 fallback (편집기 진입 시 일시적). 별도 API 호출 없음.
- **Resource select**: 18 카테고리 enum 그대로 (기존 동작 유지).
- **Operation select**: supported 옵션 + planned 옵션 (disabled, "(지원 예정)" 접미사). 빈 resource 시 "리소스를 먼저 선택하세요" 단일 placeholder. coverage hint 로 "지원 N개 · 추후 지원 M개" 표시.
- **Resource 변경**: `operation`/`fields` 동시 reset. pagination 은 op 의 `paginated` 분기에서 자연히 사라짐.
- **Operation 변경**: 새 op 의 `fields[].name` 과 교집합인 키만 유지. 그래서 product_list → product_get 으로 바꾸면 `shop_no` 같은 공통 키는 보존되고 `display`/`since` 같은 무관 키는 drop.
- **동적 Fields 폼**: `requiredFields` 그룹 + optional 그룹 두 섹션. 각 필드 widget 은 `ExpressionInput`(bare) 베이스 — `enum`/`boolean`/`default` 는 hint 텍스트로 노출 (`허용 값: T / F`, `값: true / false (표현식 사용 가능)`, `기본값: 1`). 표현식(`{{ }}`) 모든 칸에서 가능.
- **Pagination 분기**: `supportedOp.paginated === true` 일 때만 Limit/Offset 두 칸 노출. 기존 무조건 노출 폐기.
- **Planned op 선택 시**: dynamic fields 미렌더 + "이 작업은 아직 지원되지 않습니다" 한 줄 hint.
- **Unknown op (catalog 에도 없는 ID)**: amber 색 "메타데이터에 없는 작업입니다" hint — legacy 워크플로 호환.

체크리스트:

- [x] `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` — `Cafe24Config` 재작성, 옛 `normalizeCafe24Fields` / `fieldRowsToObject` / KeyValueEditor 의존 제거, `readCafe24Extras` / `Cafe24FieldRow` / 헬퍼 4개 신설
- [x] `frontend/src/components/editor/settings-panel/node-configs/shared.tsx` — `SelectField.options[].disabled?` 지원 (planned 옵션용)
- [x] `frontend/src/lib/i18n/dict/{ko,en}.ts` — 신규 키 9개 (`cafe24OperationSelectPlaceholder`, `cafe24OperationSelectResourceFirst`, `cafe24OperationPlannedSuffix`, `cafe24OperationCoverageHint`, `cafe24OperationPlannedHint`, `cafe24OperationUnknown`, `cafe24FieldsRequired`, `cafe24FieldsOptional`, `cafe24FieldsEmpty`, `cafe24FieldsEnumHint`, `cafe24FieldsBooleanHint`, `cafe24FieldsDefaultHint`) + 폐기 4개 (`cafe24OperationPlaceholder`, `cafe24OperationHint`, `cafe24FieldsKeyPlaceholder`, `cafe24FieldsValuePlaceholder`)
- [x] `cafe24-config.test.tsx` 전면 재작성 — vitest 14 cases (resource→op reset, planned disabled, paginated 분기, 표현식 보존, 키 교집합 보존, enum/default hint, unknown op hint, no-extras fallback)
- [x] frontend vitest 1392/1392, tsc/eslint 통과
- [x] consistency-check `review/consistency/2026/05/16/13_09_46/` — Critical 1건 (i18n dict split rebase) 해소
- [x] 수동 UI sanity — 본 환경에서 Next.js dev 서버/브라우저 구동 불가, PR 머지 전 사용자 점검 항목으로 명시

### Phase 4 — spec §9.9 정리 (이 PR — claude/cafe24-spec-buffer-cleanup-2b6e9c)

Phase 3 머지로 KeyValueEditor + 내부 편집 버퍼 패턴이 코드베이스에서 사라졌으므로 spec 의 옛 결정 절도 정리한다.

- [x] `spec/4-nodes/4-integration/4-cafe24.md §2` — "편집 버퍼" 줄 제거, 메타데이터 기반 typed 동적 폼 동작 + 호환 키 보존 + planned 옵션 노출 + paginated 분기를 본문에 정리
- [x] `spec/4-nodes/4-integration/4-cafe24.md §9.9` — (A) 옛 자유 key/value 입력 / (B) 메타데이터 기반 typed 동적 폼 비교로 재작성. 채택안 (B) + 호환 키 보존 결정 명시. 옛 "object-shaped contract + 편집 버퍼" 패턴이 본 프로젝트에서 더 이상 적용되지 않음을 명시 (적용 범위 변경)
- [x] CHANGELOG `2026-05-16 (ux-cleanup)` 행 추가
- [ ] consistency-check (--spec) 세션 + Critical 0 확인
- [ ] 본 plan 을 `plan/complete/` 로 이동 (`git mv`) — 남은 follow-up 항목은 별 plan 으로 split

### Phase 5+ (별 트랙, 본 plan 의 범위 외)

`plan/in-progress/cafe24-followup-backlog.md` (PR #87 도입) 에 통합 백로그. 본 plan 의 범위는 노드 UX 개편으로 닫고, 아래 항목은 backlog 에서 추적:

- **Coverage 확장**: planned → supported 전환 (operation 추가, metadata row 1개 = 카탈로그 1행 supported 화) — 별 PR 묶음 단위
- **사용자 피드백 통로**: planned 항목 옆 "구현 요청" 버튼 — 별 설계 항목 (`cafe24-followup-backlog.md` 의 향후 결정 사항으로 흡수 가능)

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
