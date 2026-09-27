# 데이터베이스(Database) 리뷰 — cross-workspace-refs

## 발견사항

- **[INFO]** 신설 소속 검증 유틸 전반이 check-then-act(TOCTOU) 로 짜여 있으나, DB 무결성 관점에서는 하위 FK 제약이 최후 방어선 역할을 해 데이터 손상 위험은 낮다
  - 위치: `codebase/backend/src/common/utils/reference-in-scope.ts:43`(`assertReferenceInScope`), `codebase/backend/src/modules/edges/edges.service.ts:72`(`assertEndpointsInWorkflow`), `codebase/backend/src/modules/nodes/nodes.service.ts:97`(`assertPlacementInWorkflow`)
  - 상세: `exists()`/`find()` 로 소속을 확인한 뒤 별도 문장으로 `save()`/`insert()` 하는 구조라, 확인과 저장 사이에 대상 행(워크플로·폴더·노드)이 동시에 삭제되면 방어가 무력화될 수 있다. 다만 모든 대상 컬럼에 FK 제약(`ON DELETE CASCADE`/`SET NULL`)이 걸려 있어, 최악의 경우도 "조용한 데이터 오염"이 아니라 FK 위반에 의한 저장 실패(500) 또는 참조 무효화로 그친다 — 기존 `assertWorkflowInWorkspace`/`assertAuthConfigInWorkspace` 와 동형인 기존 컨벤션이다(신규 결함 아님). 동시성 관점의 상세 평가는 concurrency 리뷰 담당.
  - 제안: 별도 조치 불요(기존 컨벤션 추종). 다만 재발이 우려되면 `assertReferenceInScope` 를 트랜잭션 매니저 스코프 repository 로 호출해 저장과 같은 트랜잭션·같은 스냅샷에서 검사하는 방식도 고려 가능(현재는 대부분 단건 INSERT 라 이득이 크지 않음).

- **[INFO]** 이번 PR 의 저장-전 검증은 신규 쓰기만 막는다 — 이미 DB 에 존재하는 교차 워크스페이스 참조 행(트리거·스케줄의 `workflow_id`, 노드의 `container_id`/`tool_owner_id` 등)은 소급 정리되지 않는다
  - 위치: 전 검증 유틸 공통(신규 코드 자체의 결함은 아님) — `plan/in-progress/spec-draft-nullable-notation-followups.md`(교차 워크스페이스 참조 후속 항목, "이미 저장된 교차 행")에 후속 조사 항목으로 명시적으로 이관돼 있음을 확인
  - 상세: 실행 엔진(`execute()`)은 워크플로를 `findOneBy({ id })` 로만 읽으므로, 과거에 저장된 교차 워크스페이스 행이 있다면 이번 PR 이후에도 여전히 그쪽 자격증명·실행으로 돈다. 저장 전 검사만으로는 이미 발생한 데이터 오염을 막지 못한다.
  - 제안: 별도 조치 불요(이미 plan 에 후속 작업으로 등재됨: `trigger.workspace_id <> workflow.workspace_id` 류 감사 쿼리 + 실행 시점 방어선 여부 결정). 여기서는 스코프 밖임을 확인하는 차원에서만 기록.

- **[INFO]** 신규 조회는 모두 기존 인덱스로 커버된다 — 별도 인덱스 추가나 마이그레이션 불필요
  - 위치: `codebase/backend/src/modules/edges/edges.service.ts:76`(`nodeRepository.find({ where: { id: In([...]), workflowId } })`), `codebase/backend/src/modules/nodes/nodes.service.ts:118`(동형), `codebase/backend/src/modules/workflows/workflows.service.ts:1219`(`assertNewNodeIdsUnused` — `manager.find(Node, { where: { id: In(...) } })`), `assertReferenceInScope`/`AlertsService.create`/`FoldersService`/`SchedulesService`/`TriggersService`/`WorkflowsService.assertFolderInWorkspace` 의 `exists({ where: { id, workspaceId } })` 호출 전체
  - 상세: `codebase/backend/migrations/V002__indexes.sql` 확인 결과 `idx_node_workflow (workflow_id)`, `idx_edge_workflow (workflow_id)`, `idx_folder_workspace_parent (workspace_id, parent_id)` 가 이미 존재한다. `exists({ where: { id, workspaceId } })` 형태는 `id` 가 항상 PK 이므로 워크스페이스 조건 유무와 무관하게 단일 행 PK 조회로 수렴해 성능 영향이 없다. `In()` 배치 조회도 요청 페이로드 크기(엣지 2개, 노드 최대 2개 참조)로 상한이 있어 대량 스캔 위험이 없다.
  - 제안: 없음(확인 목적의 기록).

## 요약

이번 PR 은 스키마 변경 없이(마이그레이션 파일 신규 없음), 트리거·스케줄·알림 규칙·워크플로·폴더·노드·엣지·지식베이스·어시스턴트 세션 생성/수정 경로에 "참조 id 가 요청자 워크스페이스(또는 같은 워크플로) 범위 안에 있는지" 를 저장 전에 검증하는 공용 유틸(`assertReferenceInScope`/`throwInvalidReferences`)을 추가했다. 신규 쿼리는 전부 파라미터화된 TypeORM `where`/`In()` 사용으로 SQL 인젝션 위험이 없고, PK 또는 기존 인덱스(`idx_node_workflow`, `idx_edge_workflow`, `idx_folder_workspace_parent`)로 충분히 커버되며, 배치가 필요한 지점(엣지 끝점, 노드 `containerId`/`toolOwnerId`)은 이미 `In()` 단일 조회로 묶여 있어 N+1 이 없다(지식베이스의 3개 모델설정 검증은 순차 `await` 지만 개수가 고정(≤3)이라 N+1 성격이 아니다). 트랜잭션은 기존 컨벤션(캔버스 저장·워크플로 생성/복제는 `dataSource.transaction`, 단건 검증-후-INSERT 는 트랜잭션 없이 FK 로 뒷받침)을 그대로 따르며 새로 도입된 위험은 없다. 다만 신규 검증은 check-then-act 패턴이고(기존 컨벤션과 동형, FK 가 최종 방어선), 이미 저장된 교차 워크스페이스 행에는 소급 적용되지 않는다는 점은 plan 문서에 후속 과제로 명시적으로 이관되어 있어 이번 PR 의 결함으로 보지 않는다. 종합적으로 데이터베이스 관점에서 문제되는 지점은 없다.

## 위험도
LOW
