### 발견사항

- **[WARNING]** `executeNode` 내 N+1 쿼리 - `executionPath` 업데이트
  - 위치: `execution-engine.service.ts`, `executeNode` 메서드 내 `executionPath` 업데이트 블록
  - 상세: 노드 실행마다 `executionRepository.findOneBy({ id: executionId })` + `executionRepository.save()`를 수행합니다. 기존 DAG 실행에서도 N번의 read+write가 발생하지만, 이번 변경으로 도입된 **back-edge 기반 순환 실행**에서는 단일 노드가 최대 `MAX_NODE_ITERATIONS`(기본 100)회 반복될 수 있어, 한 노드만으로 최대 200번의 DB 왕복이 발생할 수 있습니다.
  - 제안: `executionPath`를 인메모리 배열로 누적한 뒤 실행 완료/실패 시점에 한 번만 저장하세요. 혹은 `executionPath` 업데이트를 분리된 `JSONB append` 쿼리(`UPDATE execution SET execution_path = execution_path || $1`)로 교체하면 read 왕복을 제거할 수 있습니다.

- **[WARNING]** 트랜잭션 부재 - 순환 실행에서 상태 불일치 위험 증가
  - 위치: `execution-engine.service.ts`, `runExecution` 전체 흐름
  - 상세: 기존 DAG 실행에서도 트랜잭션이 없었으나, 순환 실행에서는 동일 노드에 대한 `NodeExecution` 레코드가 반복 생성/업데이트됩니다. 한 이터레이션 중 서버 크래시가 발생하면 `Execution.status=RUNNING`인데 `NodeExecution` 레코드는 절반만 완료된 상태로 남을 수 있습니다. `recoverStuckExecutions`가 `WAITING_FOR_INPUT`만 처리하므로 `RUNNING` 상태로 stuck된 순환 실행은 복구되지 않습니다.
  - 제안: 최소한 노드 실행 완료 처리(`NodeExecution` 저장 + `executionPath` 업데이트)를 단일 트랜잭션으로 묶으세요. TypeORM의 `dataSource.transaction()` 또는 `QueryRunner`를 활용하세요.

- **[WARNING]** `executionPath` 읽기-수정-쓰기 패턴의 경쟁 조건
  - 위치: `execution-engine.service.ts`, `executeNode` 내 `executionPath` 업데이트
  - 상세: 순환 실행에서 동일 `executionId`에 대해 `findOneBy` → append → `save`가 빠르게 반복됩니다. 현재는 단일 실행이 순차적으로 처리되므로 실질적 위험은 낮지만, `containerId`가 있는 컨테이너 노드와 동시에 실행되는 경우 경쟁 조건이 발생할 수 있습니다.
  - 제안: PostgreSQL의 `array_append` 또는 `jsonb_insert`를 사용한 원자적 업데이트로 교체하세요.

- **[INFO]** `nodeExecutionCount` Map이 인메모리에만 존재
  - 위치: `execution-engine.service.ts:284`
  - 상세: `MAX_NODE_ITERATIONS` 초과를 감지하는 카운터가 인메모리 Map에만 있어, 서버 재시작 후 실행이 재개되면 카운터가 초기화됩니다. 스펙 §7.2의 체크포인트 기반 Resume 구현 시 이 카운터가 DB에 영속화되지 않으면 무한 루프 방어가 우회될 수 있습니다.
  - 제안: 현재는 허용 가능하나, Resume 기능 구현 시 `Execution` 엔티티 또는 Redis에 `nodeIterationCounts`를 저장하는 방안을 고려하세요.

- **[INFO]** 순환 실행 시 `NodeExecution` 레코드 중복 생성
  - 위치: `execution-engine.service.ts`, `createNodeExecution` 호출
  - 상세: 동일 노드가 N회 반복 실행되면 N개의 `NodeExecution` 레코드가 생성됩니다. 이는 스펙 의도에 부합하나, 대용량 데이터 관점에서 `MAX_NODE_ITERATIONS=0`(무제한) 설정 시 `node_executions` 테이블이 급격히 증가할 수 있습니다. `node_executions` 테이블에 `(execution_id, node_id)` 복합 인덱스가 없다면 `findOne({ where: { executionId, nodeId } })` 쿼리 성능이 저하됩니다.
  - 제안: `node_executions` 테이블에 `(execution_id, node_id)` 복합 인덱스가 설정되어 있는지 확인하세요. 또한 무제한 반복 설정 사용 시 레코드 수 제한 정책(예: 이터레이션별 단일 레코드 업데이트)을 검토하세요.

---

### 요약

이번 변경의 핵심인 back-edge 기반 순환 실행 지원은 데이터베이스 스키마를 변경하지 않아 마이그레이션 안전성 문제는 없습니다. 그러나 순환 실행으로 인해 기존의 N+1 쿼리 패턴(`executionPath` 업데이트)이 이터레이션 횟수만큼 배수로 증폭되어 DB 부하가 크게 증가할 수 있습니다. 특히 `executeNode` 내부의 `findOneBy + save` 패턴은 순환 실행 이전에도 개선이 필요한 사항이었으나, 이번 변경으로 위험도가 높아졌습니다. 트랜잭션 부재 문제 역시 기존부터 존재하나 순환 실행에서의 반복적 상태 변경이 데이터 정합성 리스크를 키웁니다.

### 위험도
**MEDIUM**