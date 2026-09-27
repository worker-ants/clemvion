# 성능(Performance) 리뷰 — cross-workspace-refs

## 발견사항

- **[INFO]** 폴더 생성 · 재부모화가 같은 부모 행을 두 번 조회한다 (기존 라운드에서 이미 발견 · 수렴 예외로 트래커 등재된 항목, 재확인)
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts:45-56`(`create` — `assertParentInWorkspace` → `getDepth` 순차 호출), `codebase/backend/src/modules/folders/folders.service.ts:88-109`(`getDepth` 첫 반복), `codebase/backend/src/modules/folders/folders.service.ts:116-147`(`validateParentChange` — `assertParentInWorkspace`(128) → `getDepth`(140))
  - 상세: 이번 PR 이 새로 추가한 `assertParentInWorkspace(parentId, workspaceId)`(`exists({ where: { id, workspaceId } })`)는 `parentId` 행의 존재만 확인하는 조회다. 바로 다음 줄에서 호출하는 `getDepth(parentId, workspaceId)` 의 **첫 반복**이 `folderRepository.findOne({ where: { id: currentId, workspaceId } })` 로 **정확히 같은 조건의 같은 행**을 다시 읽는다. `create()` 와 `validateParentChange()` 양쪽에서 이 패턴이 반복돼, 요청 하나당 부모 폴더에 대한 불필요한 DB 왕복이 1회씩 추가됐다. `id` 가 PK 라 각 호출 자체는 인덱스 단건 조회로 저렴하지만, N+1 은 아니어도 "같은 데이터를 위해 같은 조건으로 두 번 왕복" 하는 낭비다.
  - 참고: 이 항목은 직전 라운드(`review/code/2026/09/27/22_11_22`)의 performance 리뷰에서 W3 로 이미 지적됐고, `review/code/2026/09/27/22_11_22/RESOLUTION.md` 에서 "수렴 예외"(동작 결함 아님 · 급하지 않은 구조 개선)로 판정돼 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md` "교차 워크스페이스 참조 후속")에 등재됐다. 코드는 그 판정 이후 변경되지 않았으므로 여전히 같은 형태로 남아 있다 — 새로운 결함이 아니라 기존 판정의 재확인이다.
  - 제안: (트래커에 이미 등재돼 있으므로 이번 PR 에서 조치 불요) 후속 작업 시 `assertReferenceInScope` 를 "행을 반환하는" 변형으로 바꿔 `getDepth`/`validateParentChange` 의 첫 조회가 그 결과를 재사용하게 하거나, `getDepth` 자체에 워크스페이스 소속 검사를 흡수시켜 별도 `assertParentInWorkspace` 호출을 없애는 방향을 고려할 수 있다.

- **[INFO]** 지식베이스 생성 · 수정의 참조 검증 3건이 순차 `await` 다
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:206-235`(`assertModelConfigRefsInWorkspace` — `extractionLlmConfigId`(214) → `rerankConfigId`(221) → `rerankLlmConfigId`(228) 순차 `findEntity` 호출)
  - 상세: 세 필드는 서로 독립적인 조회(다른 컬럼값·다른 kind)라 데이터 의존성이 없는데도 순차로 `await` 한다. 개수가 고정(최대 3)이라 N+1 성격은 아니지만, 셋 다 지정된 요청은 지연시간이 (직렬 3회 왕복) 이 되어 `Promise.all` 병렬화 대비 최대 ~3배 느려질 수 있다.
  - 참고: 1R 리뷰(`review/code/2026/09/27/21_43_01`)에서 INFO 9 로 이미 지적됐고 `RESOLUTION.md` 에서 "조치 불요"(우선순위 낮음)로 판정됐다. 새 결함이 아니라 기존 판정의 재확인이다.
  - 제안: (조치 불요로 이미 판정됨) 후속 최적화가 필요하면 `Promise.all([...])` 로 세 호출을 병렬화하되, 각 호출이 던지는 `NotFoundException` 의 순서 의존적 필드 우선순위(현재는 `extractionLlmConfigId` 가 먼저 실패)를 바꿀 수 있다는 점만 유의.

- **[INFO]** 신규 배치 검증(엣지 끝점 · 노드 배치 · 캔버스 참조 · 신규 노드 id 중복)은 전부 알고리즘적으로 효율적이다 — 문제 없음을 확인하는 차원의 기록
  - 위치: `codebase/backend/src/modules/edges/edges.service.ts:72-95`(`assertEndpointsInWorkflow` — `In()` 단일 조회), `codebase/backend/src/modules/nodes/nodes.service.ts:97-130`(`assertPlacementInWorkflow` — `In()` 단일 조회), `codebase/backend/src/modules/workflows/workflows.service.ts` `validateCanvasReferences`(`nodeIds` Set 기반 O(n+m))·`assertNewNodeIdsUnused`(`In()` 단일 조회)
  - 상세: 모두 `Set`/`Map` 으로 O(1) 조회 가능한 자료구조를 구성한 뒤 단일 `In()` 쿼리(또는 순수 메모리 연산)로 처리해 반복문 안에서 DB 를 호출하는 N+1 패턴이 없다. 조회는 전부 `select: { id: true }` 로 필요한 컬럼만 가져와 과도한 데이터 적재도 없다. 기존 인덱스(`idx_node_workflow(workflow_id)` 등, PK)로 충분히 커버된다(직전 라운드 database 리뷰에서 확인됨).
  - 제안: 없음(양호 확인).

- **[INFO]** `assertReferenceInScope`/`throwInvalidReferences` 공용 유틸은 요청당 단일 `exists()` 호출 + 상수 크기 배열 연산이라 성능 영향이 없다
  - 위치: `codebase/backend/src/common/utils/reference-in-scope.ts:37-45`(`assertReferenceInScope`), `:21-31`(`throwInvalidReferences`)
  - 상세: `where` 조건은 항상 PK(`id`) 를 포함하므로 인덱스 단건 조회다. 호출 지점(alerts·folders·schedules·triggers·workflows) 모두 요청당 1~2회 호출로 제한돼 반복 확대(fan-out) 되지 않는다.
  - 제안: 없음(양호 확인).

## 요약

이번 PR 은 교차 워크스페이스/워크플로 참조를 저장 전에 검증하는 로직을 9개 모듈에 추가했다. 새로 추가된 검증은 모두 단건 PK/인덱스 조회이거나(`exists`), 여러 항목을 한 번에 확인해야 하는 자리(엣지 끝점, 노드 배치, 캔버스 노드/엣지 참조, 신규 노드 id 중복)는 예외 없이 `Set`/`Map` + 단일 `In()` 쿼리로 묶여 있어 N+1 이나 반복문 내 DB 호출이 없다. 새로 발견된 두 항목 — 폴더 생성/재부모화의 부모 행 중복 조회, 지식베이스 참조 검증 3건의 순차 `await` — 은 모두 직전 라운드(1R/2R)에서 이미 식별돼 "조치 불요/수렴 예외"로 판정 및 트래커 등재까지 끝난 기존 사안이며, 이번 재확인에서도 개수·형태가 고정적이라(N+1 이 아니라 상수 회수) 심각도는 낮다. 새로운 성능 결함은 발견되지 않았다.

## 위험도
LOW
