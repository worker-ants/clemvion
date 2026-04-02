### 발견사항

- **[WARNING]** `waitForFormSubmission`의 다중 DB 작업이 트랜잭션 없이 수행됨
  - 위치: `execution-engine.service.ts` — `waitForFormSubmission()` 메서드
  - 상세: 실행 상태 전환 시 아래 순서로 총 4개의 독립적 DB write가 발생:
    1. `updateExecutionStatus` → WAITING_FOR_INPUT
    2. `nodeExecutionRepository.save(nodeExec)` → WAITING_FOR_INPUT
    3. (폼 제출 후) `nodeExecutionRepository.save(nodeExec)` → COMPLETED
    4. `updateExecutionStatus` → RUNNING
    
    중간에 서버가 재시작되거나 DB 오류가 발생하면 Execution과 NodeExecution의 상태가 불일치하게 됨 (예: Execution=RUNNING, NodeExecution=WAITING_FOR_INPUT)
  - 제안: `@Transaction()` 데코레이터 또는 `QueryRunner`를 사용해 상태 전환을 원자적으로 처리

- **[WARNING]** N+1 쿼리 — `executeNode` 내 `executionPath` 업데이트
  - 위치: `execution-engine.service.ts` — `executeNode()` 내부 (기존 코드지만 Form 노드로 인해 영향 증가)
  - 상세: 노드 실행마다 `executionRepository.findOneBy` + `save`가 반복 호출됨. Form 노드의 대기/재개 사이클이 추가되면서 각 노드마다 최소 3회 이상의 Execution 레코드 SELECT/UPDATE가 발생
  - 제안: `executionPath`를 메모리에 누적하다가 완료 시 한 번만 저장하거나, TypeORM의 배열 append 쿼리를 사용

- **[WARNING]** `pendingContinuations` 인메모리 Map — 서버 재시작 시 대기 중인 실행 복구 불가
  - 위치: `execution-engine.service.ts` — `pendingContinuations` Map
  - 상세: DB에는 `WAITING_FOR_INPUT` 상태로 저장되어 있으나, 서버 재시작 시 `pendingContinuations`가 비워지므로 해당 실행을 재개할 방법이 없음. 또한 폼 제출 이벤트를 서버 인스턴스가 여러 개인 환경(멀티 인스턴스)에서는 라우팅 문제도 발생
  - 제안: 서버 시작 시 DB에서 `WAITING_FOR_INPUT` 상태인 실행들을 조회해 적절히 처리(타임아웃 처리 또는 복구 로직 추가)하거나, 재개 메커니즘을 별도 REST 엔드포인트로 분리

- **[INFO]** `nodeExecutionRepository.findOne` — 인덱스 의존성
  - 위치: `execution-engine.service.ts` — `waitForFormSubmission()` 내 `findOne({ where: { executionId, nodeId }, order: { startedAt: 'DESC' } })`
  - 상세: `(executionId, nodeId, startedAt)` 복합 인덱스가 없으면 ORDER BY + LIMIT 쿼리가 전체 스캔으로 실행될 수 있음
  - 제안: `NodeExecution` 엔티티에 `(executionId, nodeId)` 복합 인덱스가 있는지 확인, `startedAt`도 인덱스에 포함 고려

- **[INFO]** `ExecutionCancelledError` 처리 시 트랜잭션 부재
  - 위치: `execution-engine.service.ts` — `runExecution()` catch 블록
  - 상세: CANCELLED 상태 전환 시 `executionRepository.save` 단일 호출이라 영향은 낮으나, NodeExecution 레코드들은 WAITING_FOR_INPUT 상태로 남을 수 있음
  - 제안: 취소 시 관련 NodeExecution 레코드들도 함께 CANCELLED 상태로 업데이트

---

### 요약

변경 사항의 핵심 데이터베이스 이슈는 `waitForFormSubmission`의 비원자적 상태 전환이다. 최대 4단계의 DB write가 트랜잭션 없이 순차 실행되어, 장애 시 Execution과 NodeExecution 간 상태 불일치가 발생할 수 있다. 또한 `executeNode`의 기존 N+1 패턴이 Form 노드 재개 사이클로 인해 더 빈번하게 실행되며, 인메모리 `pendingContinuations` Map은 서버 재시작이나 멀티 인스턴스 환경에서 대기 중인 실행을 복구할 수 없는 운영 리스크를 안고 있다.

### 위험도
**MEDIUM**