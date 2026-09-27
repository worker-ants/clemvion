# 데이터베이스(Database) 리뷰 — cross-workspace-refs (3R)

> 참고: 직전 라운드(`review/code/2026/09/27/22_11_22/database.md`, LOW)와 코드 변경분이 실질적으로 동일하다. 이번 라운드에서 새로
> 추가된 커밋(`421b69088`)은 `workflows.service.spec.ts` 유닛 테스트 1건 추가뿐이고 `codebase/backend/src/**` 프로덕션 코드는
> 변경되지 않았다(`git show --stat 421b69088` 로 확인). 아래는 전체 diff(`origin/main...HEAD`)를 다시 따라가며 확인한 결과이며,
> 직전 라운드 findings 를 재확인하고 위치를 실제 소스 라인으로 재검증했다.

## 발견사항

- **[INFO]** 신설 소속 검증은 대부분 check-then-act(TOCTOU) 이고, 검사와 저장이 같은 트랜잭션에 묶여 있지 않다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:214`(`assertFolderInWorkspace` 가 `dataSource.transaction` **진입 전**에 호출), `:287`(`assertFolderInWorkspace` 정의) / `codebase/backend/src/modules/edges/edges.service.ts:59`(`assertEndpointsInWorkflow` 호출, `edgeRepository.save` 는 트랜잭션 없이 별도 statement) / `codebase/backend/src/modules/nodes/nodes.service.ts:54`, `:82`(`assertPlacementInWorkflow` 호출) / `codebase/backend/src/common/utils/reference-in-scope.ts:43`(`assertReferenceInScope` 자체가 `exists()` 후 별도 `throw`)
  - 상세: `assertReferenceInScope`/`assertEndpointsInWorkflow`/`assertPlacementInWorkflow`/`assertFolderInWorkspace` 는 모두 주입된 `Repository`(풀에서 새 커넥션/스테이트먼트)로 존재를 확인한 뒤, 별도의 `save()`/`insert()` 문으로 쓴다. 확인과 저장 사이에 대상 행(워크플로·폴더·노드)이 동시에 삭제되면 이론적으로 창이 열린다. 다만 모든 대상 컬럼에 FK 제약이 걸려 있어(`workflow_id`, `folder_id`, `node.container_id`/`tool_owner_id` 등) 최악의 경우도 조용한 데이터 오염이 아니라 FK 위반에 의한 저장 실패(500, folder 는 `SET NULL`)로 그친다 — 기존 `assertWorkflowInWorkspace`/`assertAuthConfigInWorkspace` 와 동형인 이 저장소의 기존 컨벤션이며 이번 PR 이 새로 도입한 위험이 아니다. **예외**: `workflows.service.ts:1154`(`assertNewNodeIdsUnused`, 캔버스 저장의 `syncNodes` 안)는 `manager`(트랜잭션 스코프)로 검사와 `save` 를 같은 트랜잭션·같은 커넥션에서 수행해 이 클래스의 TOCTOU 를 구조적으로 닫는다 — 나머지 자리도 이 패턴을 따를 여지가 있다는 점만 기록.
  - 제안: 별도 조치 불요(기존 컨벤션 추종, 직전 라운드에서 이미 확인·수용됨). 동시성 관점의 상세 평가·재발 우려는 concurrency 리뷰 담당.

- **[INFO]** 이번 PR 의 저장-전 검증은 신규 쓰기만 막고, 이미 DB 에 존재하는 교차 워크스페이스 참조 행은 소급 정리되지 않는다
  - 위치: 전 검증 유틸 공통(신규 코드 자체의 결함 아님) — `plan/in-progress/spec-draft-nullable-notation-followups.md` "교차 워크스페이스 참조 후속" 항목에 후속 조사로 이미 이관돼 있음을 확인
  - 상세: 실행 엔진은 워크플로를 id 로만 읽으므로(`findOneBy({ id })` 류), 과거에 이미 저장된 교차 워크스페이스 행(트리거·스케줄의 `workflow_id`, 노드의 `container_id`/`tool_owner_id` 등)이 있다면 이 PR 이후에도 그쪽 자격증명·실행으로 계속 돈다. 저장 전 검사만으로는 이미 발생한 데이터를 고치지 못한다.
  - 제안: 별도 조치 불요(plan 에 후속 작업으로 명시적 등재됨). 스코프 밖임을 재확인하는 차원에서만 기록.

- **[INFO]** 신규 조회는 모두 기존 인덱스/PK 로 커버되며, 마이그레이션·스키마 변경이 없다
  - 위치: `codebase/backend/src/modules/edges/edges.service.ts:76`(`nodeRepository.find({ where: { id: In([...]), workflowId } })`), `codebase/backend/src/modules/nodes/nodes.service.ts:118`(동형), `codebase/backend/src/modules/workflows/workflows.service.ts:1219`(`assertNewNodeIdsUnused` — `manager.find(Node, { where: { id: In(...) } })`), `reference-in-scope.ts:43`(`repo.exists({ where })`)를 쓰는 `AlertsService`(`alerts.service.ts:31`)·`FoldersService`(`folders.service.ts:150`)·`SchedulesService`(`schedules.service.ts:186`)·`TriggersService`(`triggers.service.ts:485`)·`WorkflowsService.assertFolderInWorkspace`(`workflows.service.ts:287`) 전체
  - 상세: `git diff --stat origin/main...HEAD -- codebase/backend/migrations` 결과 빈 diff — 이번 PR 에 스키마 변경이 전혀 없다. `exists({ where: { id, workspaceId } })` 형태는 `id` 가 항상 PK 이므로 워크스페이스 조건 유무와 무관하게 단일 행 PK 조회로 수렴해 성능 영향이 없다. `In()` 배치 조회도 요청 페이로드 크기(엣지 2개, 노드 `containerId`/`toolOwnerId` 최대 2개, 캔버스 저장의 신규 노드 id 개수는 그 요청의 노드 수 상한)로 상한이 있어 대량 스캔 위험이 없다.
  - 제안: 없음(확인 목적의 기록). 무중단 배포 관점에서도 DDL/lock 위험 없음.

- **[INFO]** N+1 없음 — 배치가 필요한 지점은 전부 `In()` 단일 조회로 묶여 있고, 순차 `await` 지점은 개수가 고정(≤3)이라 N+1 성격이 아니다
  - 위치: `codebase/backend/src/modules/edges/edges.service.ts:72`(`assertEndpointsInWorkflow`, 소스+타겟 2개를 `In()` 한 번), `codebase/backend/src/modules/nodes/nodes.service.ts:97`(`assertPlacementInWorkflow`, `containerId`+`toolOwnerId` 2개를 `In()` 한 번), `codebase/backend/src/modules/workflows/workflows.service.ts:1111`(`validateCanvasReferences`, DB 조회 없이 페이로드 내 `Set` 대조만 — 순수 in-memory), `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:206`(`assertModelConfigRefsInWorkspace`, `extractionLlmConfigId`/`rerankConfigId`/`rerankLlmConfigId` 3개를 순차 `await`)
  - 상세: 지식베이스의 3개 모델설정 검증은 반복문이 아니라 필드 3개 고정 순차 호출이며, 다른 필드가 이미 저장된 것과 같은 검증기(`modelConfigService.findEntity`)를 재사용한다(`knowledge-base.service.ts:158` 기존 `embeddingModelConfigId` 검증과 동일 패턴). 요청당 최대 3회 왕복이고 입력 크기에 비례해 증가하지 않으므로 N+1 로 분류하지 않는다.
  - 제안: 없음.

- **[INFO]** 파라미터화된 쿼리만 사용 — SQL 인젝션 표면 없음
  - 상세: 이번 PR 에서 추가된 조회는 전부 TypeORM `Repository.exists()`/`find()`/`manager.find()` 의 객체 `where`(`{ id, workspaceId }`, `In([...])`)만 사용한다. `createQueryBuilder`·`query()`·raw SQL·템플릿 리터럴 조합은 신규 코드에 없다(`git diff` 전수 grep 확인, `createQueryBuilder` 매치는 기존 테스트 mock 1건뿐).
  - 제안: 없음.

## 요약

이번 PR 은 스키마 변경 없이(마이그레이션 diff 빈 결과 확인), 트리거·스케줄·알림 규칙·워크플로·폴더·노드·엣지·지식베이스·어시스턴트 세션 생성/수정 경로에 "참조 id 가 요청자 워크스페이스(또는 같은 워크플로/캔버스) 범위 안에 있는지" 를 저장 전에 검증하는 공용 유틸(`assertReferenceInScope`/`throwInvalidReferences`)을 추가한다. 신규 쿼리는 전부 파라미터화된 TypeORM `where`/`In()` 이라 SQL 인젝션 위험이 없고, 전부 PK 또는 기존 인덱스로 커버돼 대량 데이터 성능 문제나 신규 인덱스 필요성이 없다. 배치가 필요한 지점(엣지 끝점, 노드 `containerId`/`toolOwnerId`, 캔버스 신규 노드 id 유일성)은 `In()` 단일 조회로 묶여 N+1 이 없으며, 캔버스 저장의 신규 노드 id 중복 검사(`assertNewNodeIdsUnused`)는 트랜잭션 매니저 스코프에서 실행돼 이 PR 의 검증 패턴 중 유일하게 check-then-act 창을 구조적으로 닫는다. 나머지 소속 검증은 저장 직전에 별도 문장으로 존재를 확인하는 check-then-act 이지만, 대상 컬럼에 FK 제약이 있어 최악의 경우도 조용한 오염이 아니라 저장 실패(500)/참조 해제(`SET NULL`)로 그치는 기존 컨벤션과 동형이며 이번 PR 이 새로 만든 위험이 아니다. 이미 저장된 교차 워크스페이스 행에 대한 소급 정리는 이번 PR 범위 밖이며 plan 문서에 후속 과제로 명시적으로 이관돼 있다. 직전 리뷰 라운드(22_11_22, LOW) 이후 프로덕션 코드 변경은 없고(유닛 테스트 1건만 추가) 위 평가는 그대로 유지된다. 종합적으로 데이터베이스 관점에서 이 PR 을 막을 사유는 없다.

## 위험도
LOW
