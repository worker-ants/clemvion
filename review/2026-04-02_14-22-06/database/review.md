### 발견사항

- **[WARNING]** `relations: ['node']` 추가로 인한 잠재적 N+1/JOIN 성능 문제
  - 위치: `executions.service.ts:37` — `nodeExecutionRepository.find({ relations: ['node'] })`
  - 상세: `node` 관계를 eager load하면 TypeORM이 각 `NodeExecution`에 대해 `workflow_nodes` 테이블을 JOIN하거나 별도 SELECT를 실행한다. 실행당 노드 수가 많을 경우(수십~수백 개) 쿼리 비용이 증가한다. TypeORM의 `find` + `relations`는 단일 LEFT JOIN으로 처리되므로 N+1은 아니지만, `node` 엔티티 전체를 로드하는 오버헤드가 있다.
  - 제안: `node` 관계 전체를 로드하지 말고, QueryBuilder로 필요한 컬럼(`id`, `type`, `label`)만 선택하거나 `NodeExecution` 엔티티에 `nodeType`, `nodeLabel`을 denormalized 컬럼으로 추가하는 방안을 고려할 것.

- **[INFO]** `node` 관계 JOIN 시 인덱스 확인 필요
  - 위치: `NodeExecution` 엔티티의 `nodeId` 외래키
  - 상세: `relations: ['node']` 로드는 `node_executions.node_id` → `workflow_nodes.id` JOIN을 수행한다. `node_executions.node_id`에 인덱스가 없으면 대형 실행 이력 조회 시 풀 스캔이 발생할 수 있다. 이미 `executionId` 컬럼에 인덱스가 있다면 `node_id`는 보조 조건이지만, 스키마 마이그레이션에서 `node_id` FK 인덱스를 명시적으로 확인할 것.
  - 제안: `@Index()` 데코레이터 또는 마이그레이션에서 `CREATE INDEX idx_node_executions_node_id ON node_executions(node_id)` 확인.

- **[INFO]** `execution-engine.service.ts` 이벤트 페이로드 변경은 DB와 무관
  - 위치: `execution-engine.service.ts` 전체 diff
  - 상세: `nodeType`, `nodeLabel`, `output` 필드를 WebSocket 이벤트 페이로드에 추가하는 변경으로, 직접적인 DB 쿼리 변경 없음. 데이터베이스 관점에서 위험 없음.

---

### 요약

이번 변경에서 데이터베이스와 직접 관련된 수정은 `executions.service.ts`의 `relations: ['node']` 추가가 유일하다. 이 변경은 기능적으로 올바르지만, `NodeExecution` 조회 시 `workflow_nodes` 테이블을 JOIN하는 비용이 추가된다. 현재 구조에서 단일 실행의 노드 수가 제한적이라면 큰 문제는 없으나, 실행 히스토리 조회(`findByWorkflow`)가 아닌 단건 조회(`findById`)에만 적용되므로 영향 범위는 제한적이다. `node_executions.node_id` 컬럼의 인덱스 존재 여부를 마이그레이션에서 확인하는 것을 권장한다.

### 위험도
**LOW**