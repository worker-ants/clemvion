# 데이터베이스(Database) 리뷰 — workflow duplicate 캔버스 복사

대상: `WorkflowsService.duplicate()` (`codebase/backend/src/modules/workflows/workflows.service.ts`) 를
"workflow 메타 row 만 INSERT" 에서 "workflow+node+edge 전체를 한 트랜잭션으로 복제" 로 재구현.

## 발견사항

- **[INFO]** 대량 노드/엣지 배치 insert 가 chunk 분할 없이 단일 다중-VALUES INSERT 로 전송됨
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:286` (`manager.insert(Node, nodeRows...)`), `:308` (`manager.insert(Edge, edgeRows...)`)
  - 상세: `nodeRows`/`edgeRows` 배열 전체가 한 번의 `manager.insert()` 호출로 전송된다. TypeORM 은 기본적으로 이를 단일 다중-row INSERT 문으로 만들며, Postgres 의 바인드 파라미터 상한(65535)을 감안하면 Node(컬럼 11개 기준) 약 5,900개, Edge(컬럼 7개 기준) 약 9,300개를 넘는 캔버스에서 이론상 실패할 수 있다. 다만 이는 같은 파일의 기존 `importWorkflow()` (perf #10 주석 참조)가 이미 채택한 동일한 형태이고, 워크플로우 캔버스는 사용자가 직접 그리는 그래프라 실질적으로 그 규모에 도달하지 않는다 — 이번 diff 가 새로 만든 리스크는 아니다.
  - 제안: 현재로서는 조치 불필요. 향후 대량 생성 시나리오(예: 자동화된 대규모 import)가 생기면 `manager.insert(..., { chunk: N })` 형태의 분할을 함께 검토.

- **[INFO]** 원본 존재/권한 확인(`findById`)이 트랜잭션 밖에서 수행되어, 확인 시점과 트랜잭션 시작 사이에 원본이 동시 삭제되면 "성공하지만 노드·엣지 0개인 사본"이 조용히 생성될 수 있음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:234`(`findById`) vs `:254-259`(트랜잭션 내부의 `manager.find(Node/Edge, { where: { workflowId: id } })`)
  - 상세: 원본이 확인된 후 트랜잭션이 열리기 전 극히 짧은 창(concurrent DELETE)에서 원본 `workflow`/`node`/`edge` 가 FK CASCADE 로 사라지면, 트랜잭션 내부의 `find()` 는 예외 없이 빈 배열을 반환하고 `duplicate()` 는 "메타만 있고 캔버스가 빈" 워크플로우를 정상 생성한다 — 공교롭게도 이번 plan 이 고치려는 원래 결함과 같은 모양의 결과다. 다만 이는 `update()`/`remove()` 등 이 서비스의 다른 메서드도 동일하게 쓰는 기존 check-then-act 패턴이고, 데이터 손상이나 교차 테넌트 노출로 이어지지 않으며, 발생 조건(동일 워크플로우에 대한 동시 delete+duplicate)이 매우 드물다. 실제로 테스트(`workflows.service.spec.ts` "워크스페이스 밖 워크플로우는 404 로 막고 트랜잭션을 열지 않는다")가 이 경계를 의도된 설계로 고정하고 있어, 간과된 버그라기보다 의식적인 트레이드오프로 보인다.
  - 제안: 조치 불필요(낮은 확률·낮은 파급). 엄격성이 필요해지면 `findById` 를 트랜잭션 내부로 옮기거나 `manager.findOne(Workflow, { where: { id, workspaceId }, lock: { mode: 'pessimistic_read' } })` 로 재확인하는 방안을 고려.

## 검증한 항목 (참고 — 문제 없음)

- **인덱스**: `manager.find(Node, { where: { workflowId: id } })` / `manager.find(Edge, { where: { workflowId: id } })` 는 각각 `V002__indexes.sql` 의 `idx_node_workflow (workflow_id)`, `idx_edge_workflow (workflow_id)` 를 그대로 탄다. 신규 쿼리 형태에 대응하는 인덱스 누락 없음.
- **N+1 쿼리 없음**: 노드/엣지 복사가 루프 내 개별 쿼리가 아니라 `manager.find()` 2회(배치 조회) + `manager.insert()` 2회(배치 삽입)로 처리된다. UUID 재매핑(`idMap`/`remap`)은 순수 인메모리 `Map` 조회이고 DB 호출이 아니다. 이미 검증된 `importWorkflow()` 배치 패턴("perf #10")을 그대로 재사용.
- **트랜잭션**: 이전 구현은 `workflow` 메타 row 하나만 저장해 트랜잭션이 불필요했지만, 이번 diff 는 `workflow`+`node`+`edge` 세 테이블에 걸친 다중 INSERT 이므로 `this.dataSource.transaction(...)` 로 원자성을 새로 확보한 것이 핵심 개선이다. 중간 단계(예: node insert)가 실패하면 전체가 롤백되어 부분 사본이 남지 않는다. 원본에 대한 UPDATE/DELETE 는 전혀 수행하지 않아(unit test `원본의 node·edge row 를 수정하지 않는다` 로 확인) 동시 `saveCanvas` 와의 락 경합/교착 가능성도 낮다.
- **마이그레이션 안전성**: 신규 컬럼·테이블·마이그레이션 파일 없음 — 기존 `node`/`edge` 스키마를 그대로 재사용. 해당 없음.
- **스키마 설계**: 신규 테이블/관계 없음. `container_id`/`tool_owner_id`(상호 배타 CHECK `chk_node_placement`) 재매핑이 원본과 동일 구조를 유지하고, 참조가 복사 대상 노드 집합 밖을 가리키면(`remap` 이 `idMap` 미스 시 `null` 반환) 방어적으로 끊는다. `edge` UNIQUE(`source_node_id, source_port, target_node_id, target_port`)·`chk_no_self_loop` 도 idMap 이 원본 노드 간 1:1 injective 매핑이라 원본이 만족했다면 사본도 만족한다.
- **커넥션 관리**: `this.dataSource.transaction()` 이 커넥션 획득/커밋·롤백/해제를 전부 캡슐화 — 수동 `queryRunner` 관리가 없어 누수 위험 없음.
- **SQL 인젝션**: `manager.find/insert/save` 전부 TypeORM 파라미터 바인딩 경로. 신규 e2e 검증 쿼리(`workflow-crud.e2e-spec.ts:296-303` 부근, `SELECT id FROM node WHERE workflow_id = $1`)도 `$1` 플레이스홀더로 파라미터화되어 있어 문자열 결합 없음.
- **대량 데이터**: `duplicate()` 는 `workflowId` 로 스코프된 조회만 수행하고(전체 테이블 스캔 아님), 페이지네이션이 필요한 목록형 엔드포인트가 아니다. 위 INFO 항목(chunk 미분할)만 이론적 상한으로 남아 있다.

## 요약

`duplicate()` 를 "메타 row 단일 INSERT" 에서 "workflow+node+edge 를 한 트랜잭션으로 원자적 복제" 로 재구현한 변경으로, 데이터베이스 관점에서는 실질적 결함이 없다. 핵심 개선은 다중 테이블 쓰기를 트랜잭션으로 묶어 부분 실패 시 부분 사본이 남지 않도록 한 점과, 이미 검증된 `importWorkflow()` 의 "UUID 사전 발급 + 배치 insert 2회" 패턴을 재사용해 N+1 없이 왕복 횟수를 상수로 유지한 점이다. 신규 조회(`workflowId` 필터)는 기존 인덱스(`idx_node_workflow`, `idx_edge_workflow`)를 그대로 활용하고, 파라미터화되지 않은 쿼리나 신규 마이그레이션·스키마 변경도 없다. 남은 두 관찰(무제한 배치 insert 크기, 트랜잭션 밖 존재확인과의 이론적 레이스)은 모두 기존 코드베이스 패턴과 동일한 형태이거나 테스트로 고정된 의도된 트레이드오프로, 낮은 확률·낮은 파급의 참고 사항일 뿐 차단 사유가 아니다.

## 위험도

LOW
