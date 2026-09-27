# 성능(Performance) 리뷰 — cross-workspace-refs

## 발견사항

- **[WARNING]** `FoldersService.create()` — 부모 소속 검사(`exists`)와 `getDepth()`가 같은 행을 두 번 조회한다(신규 중복 쿼리)
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts:48-49`(호출부), `:150-160`(`assertParentInWorkspace`), `:88-109`(`getDepth`, 특히 `:102` 의 첫 반복)
  - 상세: `create()`는 `data.parentId`가 있으면 이제 `assertParentInWorkspace(data.parentId, workspaceId)`(→ `assertReferenceInScope`의 `repo.exists({ where: { id, workspaceId } })`)를 호출한 **직후** `getDepth(data.parentId, workspaceId)`를 호출한다. `getDepth`의 `while` 루프 첫 반복은 `currentId = folderId(=parentId)`로 시작해 `folderRepository.findOne({ where: { id: currentId, workspaceId } })`를 실행하는데, 이는 방금 `exists()`가 확인한 것과 **완전히 같은 WHERE 조건**이다. 결과적으로 `parentId`가 있는 폴더 생성 요청마다 같은 행에 대한 인덱스 조회가 1회 중복 발생한다(종전에는 `create()`에 소속 검사 자체가 없어 `getDepth`의 1회 조회만 있었다 — 이번 PR로 순수하게 추가된 왕복이다).
  - 참고: `FoldersService.update()`의 `validateParentChange()`(`:116-147`)도 `assertParentInWorkspace(:128)` → `getDepth(:140)` 순서로 같은 모양의 중복을 갖지만, 이 경로는 PR 이전에도 `findOne`(부모 조회) → `getDepth`(재조회) 형태로 이미 존재하던 패턴이다(`assertReferenceInScope`의 `exists()`로 교체됐을 뿐 왕복 횟수는 그대로). 즉 `update()`는 기존 결함의 연장, `create()`만 이번 변경으로 새로 생긴 중복이다.
  - 영향: 폴더는 최대 깊이 5로 제한돼 있고 `id`는 PK 인덱스 조회라 개별 비용은 작지만(수 ms 미만), 폴더 생성·재부모화마다 항상 1회의 불필요한 추가 라운드트립이 발생한다. 트래픽이 몰리는 경로는 아니지만 avoidable.
  - 제안: `getDepth`(또는 새 헬퍼)가 첫 조회에서 얻은 행 유무를 그대로 "소속 확인" 결과로 재사용하게 하거나, `assertParentInWorkspace`가 조회한 부모 엔티티를 `getDepth`/`validateParentChange`에 전달해 재조회를 생략한다. 예: `getDepth`가 `folder is null`이면 그 시점에 `throwInvalidReferences`를 던지도록 합치는 방법도 가능(단, 그러면 "부모 없음" 표준 메시지 포맷을 그 함수 안으로 옮겨야 한다).

- **[INFO]** `KnowledgeBaseService.assertModelConfigRefsInWorkspace` — 독립적인 참조 3건을 순차 `await`로 검증
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:206-235`(`assertModelConfigRefsInWorkspace`), 호출부 `:160`(`create`), `:243`(`update`)
  - 상세: `extractionLlmConfigId`·`rerankConfigId`·`rerankLlmConfigId`가 모두 채워진 요청이면 `this.modelConfigService.findEntity(...)`를 세 번 **순차**로 `await`한다(서로 결과에 의존하지 않는 독립 조회). `findEntity`는 `repo.findOne({ where: { id, workspaceId } })` 단건 조회라 개별 비용은 작지만, 순차 실행은 왕복 지연을 그대로 누적시킨다(최대 3회분의 latency, `Promise.all`이면 1회분).
  - 범위 한정: 반복문 안의 N+1이 아니라 필드 3개로 상한이 고정된 요청-내 순차 호출이며, 직전 리뷰 라운드(`review/code/2026/09/27/21_43_01` INFO 9)에서 이미 "동작 결함 아님, 우선순위 낮음"으로 조치 불요 처리된 항목이다. 신규 재지적이 아니라 성능 관점 커버리지를 위해 기록만 남긴다.
  - 제안: (낮은 우선순위) 세 필드를 `Promise.all([...].filter(Boolean).map(...))`로 병렬화하면 최악 케이스 latency를 1/3로 줄일 수 있다.

- **[INFO]** 새로 추가된 소속-참조 검사는 대체로 배치 조회(`In()`) 또는 단건 상한 호출로 N+1을 피하고 있다 — 회귀 없음 확인
  - 위치: `codebase/backend/src/modules/edges/edges.service.ts:72-95`(`assertEndpointsInWorkflow`, `In([source, target])` 1회 조회), `codebase/backend/src/modules/nodes/nodes.service.ts:97-130`(`assertPlacementInWorkflow`, `containerId`+`toolOwnerId`를 `In()` 1회 조회로 병합 — 직전 리뷰 W2 조치), `codebase/backend/src/modules/workflows/workflows.service.ts:1105-1145`(`validateCanvasReferences`, DB 호출 없이 `Set`으로 O(n+e) 인메모리 검증), `:1203-1234`(`assertNewNodeIdsUnused`, 신규 노드 id 전부를 `In()` 1회로 조회)
  - 상세: 캔버스 저장처럼 노드·엣지가 다수일 수 있는 경로에서는 반복문 안에서 개별 `exists`/`findOne`을 호출하지 않고 `In()` 배치 조회나 `Set` 기반 인메모리 검사로 처리했다. `alerts`·`schedules`·`triggers`·`workflow-assistant-session`·`workflows`(folderId)의 단건 `assertReferenceInScope` 호출들도 요청당 정확히 1회만 호출되고 루프 안에 있지 않다 — 새로 추가된 검증 로직에서 N+1 패턴은 발견되지 않았다.

## 요약

이번 PR은 여러 서비스에 "참조 소속 검사"를 추가하면서 대부분 요청당 상수 회(1회 또는 `In()` 배치 1회) 쿼리로 구현해 N+1 회귀를 만들지 않았고, 캔버스 저장의 노드/엣지 참조 검증은 DB 호출 없이 `Set` 기반 O(n+e) 인메모리 로직으로 처리해 알고리즘적으로도 적절하다. 유일하게 실질적인 지적은 `FoldersService.create()`에 새로 추가된 부모 소속 `exists()` 검사가 바로 이어지는 `getDepth()`의 첫 조회와 완전히 같은 조건을 다시 쿼리하는 중복 왕복이며, 폭발적 영향은 아니지만 avoidable한 회귀다. `KnowledgeBaseService`의 순차 `await` 3연쇄는 이미 이전 라운드에서 낮은 우선순위로 처리된 사항이라 참고용으로만 기록했다.

## 위험도

LOW
