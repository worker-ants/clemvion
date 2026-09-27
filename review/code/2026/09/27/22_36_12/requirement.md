# 요구사항(Requirement) 리뷰 — cross-workspace-refs (3R)

## 발견사항

- **[INFO]** `throwInvalidReferences` 는 `items` 가 빈 배열이면 `message: ''`, `details: []` 인 `BadRequestException` 을 던진다(방어 코드 없음)
  - 위치: `codebase/backend/src/common/utils/reference-in-scope.ts` — `export function throwInvalidReferences(items: InvalidReference[]): never { ... }`
  - 상세: 현재 모든 호출부(`EdgesService.assertEndpointsInWorkflow`, `NodesService.assertPlacementInWorkflow`, `WorkflowsService.validateCanvasReferences`, `WorkflowsService.assertNewNodeIdsUnused`)가 `invalid.length > 0`/`taken.length === 0 → return` 가드를 거친 뒤에만 호출하므로 지금은 도달 불가능하다. 다만 1R RESOLUTION(INFO 7)에서 이미 같은 지점이 지적됐고 "동작 결함 아님·우선순위 낮음"으로 처분됐다 — 새 결함이 아니라 재확인.
  - 제안: 조치 불요(기존 처분 유지). 향후 새 호출부를 추가할 때만 가드 누락에 주의.

- **[INFO]** spec `1-data-model.md §1.1` 표의 7개 참조 카테고리(트리거·스케줄·알림 규칙 `workflowId` / 워크플로·폴더 `folderId`·`parentId` / 트리거 `authConfigId`(기존) / 어시스턴트·KB 모델 설정 4필드 / 노드·엣지 구조 참조 / 캔버스 저장 노드 집합 / 캔버스 저장 신규 노드 id 유일성)를 모두 대조 확인 — 코드가 spec 본문과 line-level 로 일치한다.
  - 위치: `spec/1-data-model.md:57-78`(§1.1) vs `codebase/backend/src/common/utils/reference-in-scope.ts`, `codebase/backend/src/modules/{alerts,schedules,triggers}/*.service.ts`, `codebase/backend/src/modules/folders/folders.service.ts`, `codebase/backend/src/modules/workflows/workflows.service.ts`(`assertFolderInWorkspace`/`validateCanvasReferences`/`assertNewNodeIdsUnused`), `codebase/backend/src/modules/{edges,nodes}/*.service.ts`, `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`(`assertModelConfigRefsInWorkspace`), `codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts`(`assertLlmConfigInWorkspace`)
  - 상세: 에러 응답 형태(400 `VALIDATION_ERROR` + `details:[{field,message,code:'INVALID_FIELD'}]`, 모델 설정만 404 `MODEL_CONFIG_NOT_FOUND`), 없는 id/남의 id 무구분, `parentId: null` 루트 이동 허용, 캔버스 저장 `nodes[].id` 재사용 거부(워크스페이스 무관 전역 유일성), `containerId`/`toolOwnerId`/`rerankConfigId`류의 `null`(해제) 통과 등 spec 본문의 모든 세부 규칙이 정확히 반영돼 있다. `ModelConfigKind`(`'chat'|'embedding'|'rerank'`)와 `extractionLlmConfigId`→`'chat'`, `rerankConfigId`→`'rerank'`, `rerankLlmConfigId`→`'chat'` 매핑도 읽기 시점 소비자(`LlmService.resolveConfig`, `RerankService`)와 정확히 동일하다.
  - 제안: 없음(확인 목적의 기록).

- **[INFO]** 2R 에서 지적된 버전 복원(`skipLegacyDataGates=true`) 경로의 참조 검사 우회 가능성은 `421b69088`(뮤턴트 M6 KILLED)으로 이미 닫혀 있음을 재확인
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:696`(`this.validateCanvasReferences(dto)` — `skipLegacyDataGates` 분기 밖, 항상 실행)
  - 상세: `saveCanvas` 에서 `validateManualTrigger`/`validateReservedVariableNames` 는 `skipLegacyDataGates` 로 건너뛸 수 있지만 `validateCanvasReferences` 는 그 조건문 밖에 있어 `restoreVersion`(옛 스냅샷 복원)에서도 항상 실행된다. 요구사항("워크스페이스 경계는 옛 데이터 호환 게이트가 아니다") 충족.
  - 제안: 없음.

## 요약

cross-workspace-refs PR 은 `spec/1-data-model.md §1.1`(참조의 소속)이 정의하는 10개 참조 지점(트리거/스케줄/알림 규칙 `workflowId`, 워크플로/폴더 `folderId`·`parentId`, 어시스턴트/KB 모델 설정 4필드, 노드 `containerId`·`toolOwnerId`, 엣지 끝점, 캔버스 저장의 페이로드-내 참조 및 신규 노드 id 유일성)를 저장 전에 소속 검증하도록 구현했다. 신설 공용 유틸(`assertReferenceInScope`/`throwInvalidReferences`)의 에러 형태(400 `VALIDATION_ERROR` + `details[]` 배열, `code:'INVALID_FIELD'`)와 모델 설정 참조의 404 `MODEL_CONFIG_NOT_FOUND` 예외 처리가 spec 본문·에러 처리 규칙과 line-level 로 정확히 일치하며, `null`(참조 해제)·빈 배열·존재하지 않는 워크플로/노드 등 경계 케이스가 모두 명시적으로 처리돼 있다. 이미 1R(`698ad8ab7`)·2R(`421b69088`)에서 단위 테스트 공백(알림 규칙·어시스턴트 세션)과 버전 복원 우회 가능성이 실제로 수정·뮤턴트 검증(KILLED)됐고, 남은 구조적 비일관성(검증 호출 형태 차이, 폴더 생성의 조회 2회)은 2R RESOLUTION 에서 "수렴 예외"로 트래커에 명시적으로 등재돼 있어 이번 라운드에서 재차 결함으로 지적할 사안이 아니다. TODO/FIXME/HACK/XXX 주석은 신규 코드에 없으며, 함수명·JSDoc 과 실제 구현 간 괴리도 발견되지 않았다. 요구사항 충족 관점에서 추가로 조치가 필요한 Critical/Warning 은 없다.

## 위험도
NONE
