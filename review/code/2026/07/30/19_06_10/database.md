# 데이터베이스(Database) 리뷰 — workflow duplicate 캔버스 복사 (fix-round 누적 diff)

대상: `origin/main...HEAD` 전체 diff(42 파일). 실질 코드 변경은 `WorkflowsService.duplicate()`
(`codebase/backend/src/modules/workflows/workflows.service.ts`)의 "메타 row 단일 INSERT" →
"workflow+node+edge 를 `REPEATABLE READ` 트랜잭션으로 원자적 복제" 재구현, 관련 controller
Swagger 텍스트, unit(`workflows.service.spec.ts`)·e2e(`workflow-crud.e2e-spec.ts`) 테스트, 문서
(CHANGELOG/ui-tour/plan)다. 이번 라운드의 핵심은 직전 코드 리뷰(`review/code/2026/07/30/17_54_27/`)
가 지적한 concurrency WARNING #1(read skew)을 `'REPEATABLE READ'` isolation 명시로 해소한 것이다 —
이 부분을 중점적으로 재검증했다.

## 발견사항

- **[INFO]** 대량 노드/엣지 배치 insert 가 chunk 분할 없이 단일 다중-VALUES INSERT 로 전송됨 (기존 확인 사항, 변화 없음)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `duplicate()` 내 `manager.insert(Node, nodeRows...)`(303-305행), `manager.insert(Edge, edgeRows...)`(327-329행)
  - 상세: `nodeRows`/`edgeRows` 배열 전체가 한 번의 `manager.insert()` 호출로 전송되어 단일 다중-row INSERT 문이 된다. Postgres 바인드 파라미터 상한(65,535)을 감안하면 Node(컬럼 11개) 약 5,900개, Edge(컬럼 7개) 약 9,300개를 넘는 캔버스에서 이론상 실패할 수 있다. 같은 파일의 기존 `importWorkflow()`(453-458행, 477-482행)가 이미 채택한 동일한 형태를 그대로 재사용한 것이라 이번 diff 가 새로 만든 리스크는 아니며, 워크플로우 캔버스는 사용자가 직접 그리는 그래프라 실질적으로 그 규모에 도달하지 않는다.
  - 제안: 조치 불필요. 향후 대량 자동 생성 시나리오가 생기면 `manager.insert(..., { chunk: N })` 분할을 검토.

- **[INFO]** 원본 존재/권한 확인(`findById`)이 `REPEATABLE READ` 트랜잭션 밖에서 수행됨 (기존 확인 사항, 이번 라운드에도 의도적으로 유지)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `duplicate()` 234행(`findById`, 트랜잭션 밖) vs 245행(`this.dataSource.transaction('REPEATABLE READ', ...)` 오픈)
  - 상세: 확인과 트랜잭션 오픈 사이 극히 좁은 창에서 원본이 동시 삭제되면(FK CASCADE) 트랜잭션 내부의 `manager.find(Node/Edge, ...)`가 빈 배열을 반환하고, `nodeRows.length > 0`/`edgeRows.length > 0` 가드가 이를 정상적인 "빈 캔버스" 케이스와 구분하지 못해 "메타만 있고 캔버스가 빈" 사본이 조용히 생성될 수 있다 — 이번 plan 이 고치는 원래 결함과 표면적으로 같은 증상이 매우 드문 동시성 창에서 재현되는 형태다. 다만 `update()`/`remove()` 등 이 서비스의 다른 메서드도 동일한 check-then-act 패턴을 쓰고, 데이터 손상·교차 테넌트 노출로 이어지지 않으며, 발생 확률이 극히 낮다. `RESOLUTION.md`(INFO #2)에도 "이번 조치 범위는 node/edge 조회 2건에 한정, `findById` 는 404 fast-path 이점과의 트레이드오프로 현행 유지"라고 명시적으로 스코프 아웃되어 있어 의식적 결정이다.
  - 제안: 조치 불필요(낮은 확률·낮은 파급). 엄격성이 필요해지면 `findById` 를 트랜잭션 내부 첫 쿼리로 이동하는 방안을 고려.

## 재검증: REPEATABLE READ 도입 (전 라운드 concurrency WARNING #1 해결)

`this.dataSource.transaction('REPEATABLE READ', async (manager) => {...})` (`workflows.service.ts:245`)
가 실제로 이전 WARNING(원본 node/edge 두 SELECT 가 기본 `READ COMMITTED` 하에서 별도 스냅샷을 써
동시 `saveCanvas()` 커밋과 겹치면 read skew 로 그래프 일관성이 깨진 사본이 만들어질 수 있음)을
해소하는지 코드·의존성·선례를 직접 열어 독립적으로 재검증했다.

- **isolation 지정 위치**: `manager.find(Node, ...)`(263-265행)·`manager.find(Edge, ...)`(266-268행)
  두 SELECT 가 이제 같은 트랜잭션 안에 있고, Postgres REPEATABLE READ 의 스냅샷은 그 트랜잭션의
  **첫 쿼리 시점**(여기서는 245행 진입 직후의 `manager.save(Workflow, copy)`, 259행)에 고정된다 —
  이후 실행되는 Node/Edge SELECT 는 그 순간의 단일 스냅샷을 공유해 두 조회 사이의 시차가 사실상
  제거된다.
- **saveCanvas 커밋의 원자성 확인**: `saveCanvas()`(512행) 자체도 `this.dataSource.transaction(async (manager) => {...})` 로 감싸여 있음을 직접 확인(532행 부근). Postgres 는 isolation level 과 무관하게 dirty read 를 허용하지 않으므로, `duplicate()` 의 REPEATABLE READ 스냅샷은 동시 `saveCanvas` 커밋을 "전부 반영됨" 또는 "전혀 반영 안 됨" 중 하나로만 관측한다 — 부분 반영(read skew)이 구조적으로 불가능해졌다.
- **재시도(40001) 로직 미도입의 타당성**: `duplicate()` 트랜잭션의 쓰기는 전부 새 UUID 의 **신규 row INSERT**(`manager.save(Workflow, copy)`, `manager.insert(Node/Edge, ...)`)뿐이고, 원본 row 에 대한 UPDATE/DELETE 나 `SELECT ... FOR UPDATE` 가 전혀 없다. Postgres 가 REPEATABLE READ 에서 serialization failure(40001)를 내는 조건은 "동일 행에 대한 동시 write-write 충돌"인데, 새로 생성되는 row 는 트랜잭션 시작 전에는 존재하지 않아 그 어떤 동시 트랜잭션도 같은 row 를 놓고 경합할 수 없다 — 따라서 이 트랜잭션 자체의 쓰기로는 serialization failure 가 발생할 수 없다는 판단이 정확하다. `codebase/backend/src/modules/executions/executions.service.ts:538-539`(`findById`)를 직접 열어 대조한 결과도 순수 read-only 트랜잭션에 재시도 로직이 없는 동일 패턴이었다.
- **API 호환성**: `codebase/backend/node_modules/typeorm/data-source/DataSource.js:338`(`async transaction(isolationOrRunInTransaction, runInTransactionParam)`)에서 TypeORM 0.3.28(`package.json`)이 실제로 `transaction(isolationLevel, callback)` 2-arg 오버로드를 지원함을 소스에서 직접 확인 — 신규 호출부가 존재하지 않는 API 를 쓰는 것이 아니다.
- **테스트 어댑터**: `workflows.service.spec.ts` 의 `mockDataSource.transaction` 이 `args.find((a) => typeof a === 'function')` 패턴으로 1-arg/2-arg 양쪽 호출을 모두 처리하도록 갱신되어, `duplicate()`(2-arg)와 다른 메서드(1-arg) 양쪽 mock 호출이 정상 동작함을 확인.
- **차단(blocking)·교착 없음**: `duplicate()` 는 신규 row 만 INSERT 하고 원본 row 에 락을 걸지 않으므로(Postgres MVCC: reader 는 writer 를 막지 않고, writer 도 서로 다른 row 를 두고는 경합하지 않음) 동시 `saveCanvas` 를 블로킹하지 않는다 — 락 기반 해법(`SELECT ... FOR UPDATE`)보다 저비용인 정확한 선택.

결론: REPEATABLE READ 도입은 기술적으로 올바르고 충분하며, 재시도 로직 부재도 정당하다. 이 부분은
이전 라운드의 WARNING 이 실제로 코드 레벨에서 해소되었음을 확인했다.

## 검증한 항목 (참고 — 문제 없음)

- **인덱스**: `codebase/backend/migrations/V002__indexes.sql`(8행 `idx_node_workflow ON node (workflow_id)`, 13행 `idx_edge_workflow ON edge (workflow_id)`, 14행 `idx_edge_workflow_type`)를 직접 확인 — `manager.find(Node/Edge, { where: { workflowId: id } })` 신규 쿼리 형태가 그대로 인덱스를 탄다. 인덱스 누락 없음.
- **N+1 쿼리 없음**: 노드/엣지 복사가 루프 내 개별 쿼리가 아니라 `manager.find()` 2회(배치 조회) + `manager.insert()` 2회(배치 삽입)로 처리된다. UUID 재매핑(`idMap`/`remap`)은 순수 인메모리 `Map` 조회이고 DB 호출이 아니다.
- **트랜잭션**: `workflow`+`node`+`edge` 세 테이블에 걸친 다중 쓰기가 단일 `dataSource.transaction('REPEATABLE READ', ...)` 로 원자성을 확보한다. 중간 단계 실패 시 전체 롤백되어 부분 사본이 남지 않는다(unit 테스트 `원본의 node·edge row 를 수정하지 않는다`, `워크스페이스 밖 워크플로우는 404 로 막고 트랜잭션을 열지 않는다` 로 확인).
- **마이그레이션 안전성**: 신규 컬럼·테이블·마이그레이션 파일 없음 — 기존 `node`/`edge`/`workflow` 스키마를 그대로 재사용. 해당 없음.
- **스키마 설계**: `codebase/backend/migrations/V001__initial_schema.sql` 을 직접 확인 — `container_id`/`tool_owner_id UUID REFERENCES node(id) ON DELETE SET NULL`(109-110행), `chk_node_placement` CHECK(114행), edge 의 `source_node_id`/`target_node_id ... ON DELETE CASCADE`(127-129행), `chk_no_self_loop`(135행), `UNIQUE (source_node_id, source_port, target_node_id, target_port)`(137행) 모두 기존 제약이며, `idMap` 이 원본 노드 간 1:1 injective 매핑이라 원본이 이 제약을 만족했다면 사본도 만족한다. Node/Edge/Workflow 엔티티에 `@BeforeInsert`/`@BeforeUpdate` 훅이 없음을 직접 확인해(`grep`) `manager.insert()` 의 hook 우회가 실질적 영향이 없음도 재확인했다. `nodeRows` 배치 INSERT 내에서 `containerId`/`toolOwnerId` 가 **같은 배치의 다른 row** 를 참조하는 자기참조 패턴은 Postgres 의 FK 제약 트리거가 문장(statement) 단위로 평가되어(모든 row 삽입 완료 후 검사) 정상 동작한다 — `importWorkflow()` 의 기존 동일 패턴 재사용이고 신규 e2e 테스트(`containerIndex`/`toolOwnerIndex` 단언)로 실증되어 있다. `workflow` 테이블의 `name` 컬럼에 unique 제약이 없어(`UNIQUE (workflow_id, version)` 만 존재, `V001__initial_schema.sql:260`) "(Copy)" 접미 INSERT 가 제약 충돌로 막힐 가능성도 없다.
- **커넥션 관리**: `this.dataSource.transaction()` 이 커넥션 획득/커밋·롤백/해제를 전부 캡슐화 — 수동 `queryRunner` 관리 없이 누수 위험 없음. REPEATABLE READ 전환으로 트랜잭션 지속 시간이 유의미하게 늘지 않으며(쿼리 수 동일, 단지 isolation 문자열만 추가), 이 엔드포인트는 사용자가 수동으로 트리거하는 저빈도 액션이라 커넥션 풀 고갈 우려 없음.
- **SQL 인젝션**: `manager.find/save/insert` 전부 TypeORM 파라미터 바인딩 경로. 신규 e2e 검증 쿼리(`workflow-crud.e2e-spec.ts` `SELECT id FROM node WHERE workflow_id = $1`, `SELECT COUNT(*)::text AS count FROM workflow_version WHERE workflow_id = $1`)도 `$1` 플레이스홀더로 파라미터화되어 있어 문자열 결합 없음.
- **대량 데이터**: `duplicate()` 는 `workflowId` 로 스코프된 조회만 수행하고(전체 테이블 스캔 아님), 페이지네이션이 필요한 목록형 엔드포인트가 아니다. 위 INFO(chunk 미분할)만 이론적 상한으로 남아 있다.

## 요약

이번 diff 는 `duplicate()` 를 "메타 row 단일 INSERT" 에서 "workflow+node+edge 를 `REPEATABLE READ`
트랜잭션으로 원자적 복제" 로 재구현한 것이다. 직전 코드 리뷰가 지적한 유일한 실질적 DB/동시성
WARNING(원본 node/edge 두 SELECT 의 read skew)은 `'REPEATABLE READ'` isolation 명시로 정확하게
해소되었음을 코드·TypeORM 소스·선례(`executions.service.ts`)·`saveCanvas()`의 트랜잭션 원자성까지
직접 열어 독립적으로 재검증했다 — 재시도(40001) 로직을 두지 않은 판단도 이 트랜잭션이 신규 row
INSERT 만 수행해 write-write 충돌이 구조적으로 불가능하다는 근거로 타당하다. 신규 조회는 기존
인덱스(`idx_node_workflow`, `idx_edge_workflow`)를 그대로 활용하고, N+1 없이 왕복 횟수가 상수(SELECT
2회 + INSERT 2회)로 유지되며, 신규 마이그레이션·스키마 변경·파라미터화되지 않은 쿼리도 없다. 남은
두 관찰(무제한 배치 insert 크기, 트랜잭션 밖 존재확인과의 이론적 TOCTOU)은 모두 기존 코드베이스
패턴과 동일한 형태이거나 `RESOLUTION.md` 에 명시된 의도된 트레이드오프로, 낮은 확률·낮은 파급의
참고 사항일 뿐 차단 사유가 아니다.

## 위험도

LOW
