# 유지보수성(Maintainability) 리뷰 — cross-workspace-refs

## 발견사항

- **[INFO]** `assertReferenceInScope` 의 `field`/`message` 가 인접한 동일 타입(`string`) 위치 인자다 — 타입 시스템이 순서 실수를 잡아 주지 않는다
  - 위치: `codebase/backend/src/common/utils/reference-in-scope.ts:37`(`assertReferenceInScope(repo, where, field, message)`)
  - 상세: `field`(예: `'workflowId'`)와 `message`(예: `'Workflow not found in this workspace'`)는 둘 다 `string` 이라, 호출부에서 두 인자의 순서를 바꿔도 컴파일·타입체크가 통과한다. 현재 6개 호출부(`alerts.service.ts`, `schedules.service.ts`, `triggers.service.ts`, `folders.service.ts`(`assertParentInWorkspace` 경유), `workflows.service.ts`(`assertFolderInWorkspace` 경유))는 모두 같은 순서를 지켜 실제 결함은 없지만, 새 호출부가 추가될 때 이 관례를 강제하는 장치가 없다. `throwInvalidReferences`/`InvalidReference` 는 이미 `{ field, message }` 객체 형태를 쓰고 있어, `assertReferenceInScope` 도 뒤 두 인자를 객체로 묶으면(`{ field, message }`) 함수 시그니처가 자기 자신이 위임하는 `throwInvalidReferences` 와 형태가 맞고 순서 실수 여지도 없어진다.
  - 제안: `assertReferenceInScope(repo, where, ref: InvalidReference)` 형태로 리팩터 고려(급하지 않음 — 현재 결함은 없음).

- **[INFO]** "여러 참조를 모아 한 번에 거부" 패턴이 4곳에서 각각 다른 형태로 손으로 짜여 있다 — 단, 이미 트래커에 수렴 예외로 등재된 항목
  - 위치: `codebase/backend/src/modules/edges/edges.service.ts:72`(`assertEndpointsInWorkflow` — 하드코딩된 두 개의 `if`), `codebase/backend/src/modules/nodes/nodes.service.ts:97`(`assertPlacementInWorkflow` — `refs` 배열 + `filter/map`), `codebase/backend/src/modules/workflows/workflows.service.ts:1111`(`validateCanvasReferences` — `forEach` 두 개), `codebase/backend/src/modules/workflows/workflows.service.ts:1210`(`assertNewNodeIdsUnused` — 또 다른 `filter/map` 조합)
  - 상세: 네 메서드 모두 "`In()` 한 번으로 대상 id 집합을 조회 → 없는 id 를 `InvalidReference[]` 로 모음 → `throwInvalidReferences`" 라는 같은 뼈대를 따르지만, `edges.service.ts` 는 필드별 `if` 를 하드코딩하고 `nodes.service.ts` 는 `{ field, id, what }` 배열을 순회하는 등 서로 다른 스타일로 재구현됐다. 같은 문제를 매번 다시 짜면서 스타일이 갈리면, 다섯 번째 자리가 추가될 때 어느 쪽을 본떠야 할지 기준이 없어지고 버그 수정 시 네 곳을 따로 고쳐야 한다.
  - 참고: 이 중복은 이번 리뷰에서 새로 발견한 것이 아니라 직전 라운드(`review/code/2026/09/27/22_11_22`)에서 W2 로 이미 지적됐고, 해당 라운드의 RESOLUTION 에서 "수렴 예외"(동작 결함 아님·구조 개선 성격, 백로그 트래커 「교차 워크스페이스 참조 후속」에 등재)로 처리 완료됐다. 여기서는 재차 WARNING 으로 올리지 않고 상태만 확인차 기록한다.
  - 제안: 추가 조치 불요(이미 등재됨). 다음에 그 백로그를 집행할 때 공용 헬퍼(예: `assertIdsInScope(repo, ids, scopeWhere) => InvalidReference[]`)로 네 자리를 한 번에 통일하는 편이 좋다.

- **[INFO]** `KnowledgeBaseService.assertModelConfigRefsInWorkspace` 의 세 `if` 블록이 필드명·`kind` 인자만 다른 거의 동일한 코드
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:206`(`assertModelConfigRefsInWorkspace`)
  - 상세: `extractionLlmConfigId`/`rerankConfigId`/`rerankLlmConfigId` 세 필드에 대해 "값이 있으면 `findEntity(id, workspaceId, kind)` 호출" 을 세 번 반복한다. 필드 수가 고정(3개)이고 앞으로 늘어날 가능성이 낮아 심각하지 않지만, `[{ id: dto.extractionLlmConfigId, kind: 'chat' }, { id: dto.rerankConfigId, kind: 'rerank' }, { id: dto.rerankLlmConfigId, kind: 'chat' }]` 배열을 `for...of` 로 순회하면 코드량이 절반으로 줄고 네 번째 필드가 추가돼도 배열 원소 하나만 늘면 된다.
  - 제안: 급하지 않은 개선 — 위 형태로 루프화 고려.

## 요약

신규 공용 유틸 `reference-in-scope.ts`(`assertReferenceInScope`/`throwInvalidReferences`)는 목적이 분명한 JSDoc, 명확한 네이밍(`assert*In*Workspace`/`In*Workflow` 접두 컨벤션이 전 서비스에서 일관됨), 짧고 단일 책임인 함수로 잘 설계됐다. 조건문 중첩은 얕고(2단 이내), 매직 넘버는 없으며, 에러 코드·메시지 문자열은 spec 조항을 주석으로 인용해 의도가 뚜렷하다. 유일하게 눈에 띄는 구조적 아쉬움은 "여러 참조를 모아 한 번에 거부" 하는 배치 검증 로직이 4곳(edges/nodes/workflows 캔버스/workflows 노드-id-재사용)에서 서로 다른 스타일로 반복된다는 점인데, 이는 이미 직전 리뷰 라운드에서 지적·수용되어 백로그(수렴 예외)로 등재된 사안이라 이번 라운드에서 새로 차단할 이유는 없다. `assertReferenceInScope` 의 인접 `string` 위치 인자(field/message)는 현재는 전 호출부가 일관되게 지키고 있어 실제 결함은 아니지만, 향후 실수 여지를 줄이려면 객체 인자로 바꾸는 편이 낫다. 전반적으로 이번 변경은 기존 코드베이스 스타일(주석 컨벤션, private 헬퍼 분리, `In()` 배치 조회)을 잘 따르고 있어 유지보수성 관점에서 차단할 사항은 없다.

## 위험도

NONE
