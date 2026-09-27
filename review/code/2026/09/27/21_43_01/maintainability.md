# 유지보수성(Maintainability) 코드 리뷰 — cross-workspace-refs

## 발견사항

- **[WARNING]** "N개 참조가 이 스코프에 속하는지" 배치 검증 로직이 서비스마다 서로 다른 방식으로 재구현됨
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.ts:97`(`assertPlacementInWorkflow`) vs `codebase/backend/src/modules/edges/edges.service.ts:72`(`assertEndpointsInWorkflow`)
  - 상세: 두 함수 모두 "workflow 안의 두 노드 참조(필드 2개)가 실제로 그 workflow 소속인지" 를 검사하고 `InvalidReference[]` 를 모아 `throwInvalidReferences` 로 던지는 동일한 개념의 작업이다. 그런데 `nodes.service.ts` 는 `for...of` 루프 안에서 필드마다 개별 `this.nodeRepository.exists({ where: { id, workflowId } })` 를 순차 `await` 하는 반면(최대 2회 왕복), `edges.service.ts` 는 `In([source, target])` 으로 한 번에 `find` 한 뒤 `Set` 멤버십으로 판정한다. `reference-in-scope.ts` 가 이미 "단일 참조" 케이스의 공유 헬퍼(`assertReferenceInScope`)를 뽑아 뒀는데, "복수 참조 배치 검사"는 공유되지 않아 같은 PR 안에서 두 가지 다른 구현이 나왔다. 다음에 세 번째 서비스가 비슷한 검사를 추가할 때 또 다른 패턴을 고를 위험이 있고, 두 구현 중 하나에서 버그를 고쳐도 다른 쪽엔 반영되지 않을 수 있다.
  - 제안: `reference-in-scope.ts` 에 `assertReferencesInScope(repo, refs: {field, id, workflowId, message}[])` 류의 배치 버전을 추가해 두 서비스가 공유하게 한다(혹은 최소한 둘 다 `In()` 배치 조회로 통일).

- **[INFO]** `if (invalid.length > 0) throwInvalidReferences(invalid)` 가드가 4개 호출부에 동일하게 반복됨
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.ts:118`, `codebase/backend/src/modules/edges/edges.service.ts:94`, `codebase/backend/src/modules/workflows/workflows.service.ts:1142`(`validateCanvasReferences`), 그리고 같은 파일의 `assertNewNodeIdsUnused`(약 1210행대)
  - 상세: `throwInvalidReferences` 자신은 빈 배열이 들어와도 방어하지 않고(빈 `message`/`details` 로 예외를 던진다), 그래서 "비어 있지 않을 때만 던진다"는 불변식을 함수 자체가 아니라 매 호출부가 반복해서 지켜야 한다. 4곳이 똑같은 한 줄을 복붙하고 있다.
  - 제안: `throwInvalidReferences` 내부에서 `if (items.length === 0) return;` 을 먼저 처리하면(또는 그 사실을 문서화하면) 호출부의 방어 코드를 없앨 수 있다. 사소하지만 "호출자가 매번 지켜야 하는 암묵적 계약"을 유틸리티 안으로 옮기는 쪽이 더 안전하다.

- **[INFO]** 같은 개념(참조 스코프 위반 시 거부)에 `assert*` 와 `validate*` 접두어가 혼재
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:1111`(`validateCanvasReferences`) vs 같은 PR의 `assertFolderInWorkspace`(287행), `assertNewNodeIdsUnused`(1210행), 그리고 다른 서비스의 `assertPlacementInWorkflow`/`assertEndpointsInWorkflow`/`assertParentInWorkspace`/`assertLlmConfigInWorkspace`/`assertModelConfigRefsInWorkspace`
  - 상세: `validateCanvasReferences` 는 이름만 보면 "검증해서 boolean/결과를 반환"하는 함수처럼 보이지만 실제로는 다른 `assert*` 함수들과 동일하게 실패 시 예외를 던지고 성공 시 아무것도 반환하지 않는다(`void`). `workflows.service.ts` 안에서는 `validateManualTrigger`/`validateUniqueLabels`/`validateReservedVariableNames` 와 이름을 맞췄다는 점에서 로컬 컨벤션은 있지만, 이 PR 이 다른 6개 이상의 파일에 걸쳐 확립한 "거부 시 throw 하는 헬퍼는 `assert*`" 패턴과는 어긋난다.
  - 제안: 필수 수정은 아니나, 크로스-파일로 검색하는 다음 리뷰어/개발자가 "같은 스코프 검사인데 왜 이름이 다르지"라고 헤매지 않도록 이번 PR 의 changelog/plan 어딘가에 "workflows.service.ts 는 기존 `validate*` 로컬 컨벤션을 따랐다"는 한 줄을 남기거나, 장기적으로 이름을 통일.

- **[INFO]** 동일한 에러 메시지 리터럴 `'Workflow not found in this workspace'` 가 3개 파일에 하드코딩 중복
  - 위치: `codebase/backend/src/modules/alerts/alerts.service.ts:36`, `codebase/backend/src/modules/schedules/schedules.service.ts:192`, `codebase/backend/src/modules/triggers/triggers.service.ts:491`
  - 상세: 세 서비스가 `assertReferenceInScope(repo, {id: dto.workflowId, workspaceId}, 'workflowId', 'Workflow not found in this workspace')` 를 각자 문자열 리터럴로 호출한다. 문구 하나를 나중에 다듬을 때(예: i18n, 톤 통일) 세 곳을 다 찾아 고쳐야 하고, 하나만 놓치면 필드는 같은데 워딩만 다른 응답이 생긴다.
  - 제안: `reference-in-scope.ts` 나 별도 상수 모듈에 `WORKFLOW_NOT_IN_WORKSPACE_MESSAGE` 같은 상수를 두고 세 호출부가 공유하게 한다. 우선순위는 낮음 — 지금은 세 문구가 모두 동일해 실제 drift 는 없다.

- **[INFO]** `knowledge-base.service.ts` 의 `assertModelConfigRefsInWorkspace` 가 구조적으로 동일한 if-블록을 3회 반복
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:206`(`assertModelConfigRefsInWorkspace`)
  - 상세: `extractionLlmConfigId`/`rerankConfigId`/`rerankLlmConfigId` 각각에 대해 `if (dto.x) { await this.modelConfigService.findEntity(dto.x, workspaceId, 'kind'); }` 형태를 3번 그대로 반복한다. 같은 PR 의 `nodes.service.ts` `assertPlacementInWorkflow` 는 구조적으로 거의 동일한 문제(필드 2~3개를 순회하며 참조를 검증)를 `refs` 배열 + `for` 루프로 풀었는데, 이 함수는 그 패턴을 따르지 않아 PR 내부에서도 스타일이 갈린다. 필드가 4개, 5개로 늘어나면 반복 블록도 그만큼 늘어난다.
  - 제안: `[[dto.extractionLlmConfigId, 'chat'], [dto.rerankConfigId, 'rerank'], [dto.rerankLlmConfigId, 'chat']] as const` 배열을 순회하는 형태로 접어 `nodes.service.ts` 와 같은 관용구로 맞출 수 있다. 다만 이 함수는 각 필드 실패 시 서로 다른 예외(404 `MODEL_CONFIG_NOT_FOUND`, 필드별 즉시 throw)를 그대로 전파하므로 `nodes.service.ts` 처럼 "모두 모아서 한 번에 던지기"는 아니며, 그 차이는 문서화된 의도(같은 요청 안에서 필드마다 코드가 갈리지 않게)와 일치한다 — 리팩터링해도 그 의미는 유지해야 한다.

## 요약

새로 도입된 `codebase/backend/src/common/utils/reference-in-scope.ts` 는 "단일 참조가 스코프 안에 있는지" 검사를 잘 추상화했고, `folders.service.ts` 처럼 기존 인라인 중복을 걷어내고 그 위에 올라탄 리팩터도 깔끔하다. 새로 추가된 private 메서드들(`assertFolderInWorkspace`, `assertPlacementInWorkflow`, `assertEndpointsInWorkflow`, `assertNewNodeIdsUnused`, `validateCanvasReferences` 등)은 모두 짧고(약 10~35줄) 중첩도 얕으며, 각자 위에 "왜 필요한가·종전엔 어떻게 깨졌는가"를 설명하는 한국어 JSDoc을 일관되게 달아 두어 가독성이 좋다. 테스트도 각 서비스마다 신규/기존 분기를 촘촘히 커버한다. 다만 "여러 참조를 배치로 검증"하는 패턴이 서비스마다(순차 `exists()` 루프 vs 배치 `find`+`In`+`Set` vs 순수 인메모리 `Set`) 조금씩 다르게 재구현되었고, 그 결과로 사소한 문자열·if-가드 중복이 여러 파일에 흩어졌다 — 기능적 결함은 아니지만 다음에 유사한 검사를 추가할 개발자가 참고할 "단일한 정본 패턴"이 아직 없다는 점이 유지보수성 관점의 유일한 아쉬움이다.

## 위험도

LOW
