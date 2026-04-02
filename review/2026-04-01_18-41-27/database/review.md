### 발견사항

---

**[WARNING] 트랜잭션 부재: `waitForFormSubmission`에서의 다중 DB 연산**
- 위치: `execution-engine.service.ts` – `waitForFormSubmission` 메서드
- 상세: 아래 순서로 DB 쓰기가 수행되지만 단일 트랜잭션으로 묶이지 않는다:
  1. `updateExecutionStatus(WAITING_FOR_INPUT)` → `execution` 테이블 쓰기
  2. `nodeExecutionRepository.save(nodeExec)` → `node_execution` 테이블 쓰기 (WAITING_FOR_INPUT)
  3. *(사용자 입력 대기 중...)*
  4. `nodeExecutionRepository.save(nodeExec)` → `node_execution` 테이블 쓰기 (COMPLETED)
  5. `updateExecutionStatus(RUNNING)` → `execution` 테이블 쓰기

  3번 이후(폼 제출 처리 중) 서버가 비정상 종료되면 `execution.status = RUNNING`이지만 `node_execution.status = WAITING_FOR_INPUT`이 되는 불일치 상태가 발생할 수 있다.
- 제안: 재개(resume) 시 상태 전환 로직(4–5번)을 QueryRunner 또는 `dataSource.transaction()`으로 감싸서 원자성 보장:
  ```typescript
  await this.dataSource.transaction(async (manager) => {
    nodeExec.status = NodeExecutionStatus.COMPLETED;
    nodeExec.outputData = updatedOutput;
    nodeExec.finishedAt = new Date();
    nodeExec.durationMs = ...;
    await manager.save(nodeExec);
    
    savedExecution.status = ExecutionStatus.RUNNING;
    await manager.save(savedExecution);
  });
  ```

---

**[WARNING] 인덱스 누락 가능성: `findOne({ where: { executionId, nodeId }, order: { startedAt: 'DESC' } })`**
- 위치: `execution-engine.service.ts` – `waitForFormSubmission` 메서드
  ```typescript
  const nodeExec = await this.nodeExecutionRepository.findOne({
    where: { executionId, nodeId: node.id },
    order: { startedAt: 'DESC' },
  });
  ```
- 상세: `(execution_id, node_id)` 또는 `(execution_id, node_id, started_at DESC)` 복합 인덱스가 없으면 `node_execution` 테이블 전체 스캔 또는 비효율적인 필터가 수행된다. Form 노드가 포함된 실행이 많아질수록 성능 저하가 발생할 수 있다.
- 제안: `NodeExecution` 엔티티에 인덱스 추가:
  ```typescript
  @Index(['executionId', 'nodeId'])
  export class NodeExecution { ... }
  ```
  또는 마이그레이션으로 `CREATE INDEX idx_ne_exec_node ON node_execution(execution_id, node_id, started_at DESC)` 추가.

---

**[WARNING] 서버 재시작 시 `WAITING_FOR_INPUT` 상태 복구 불가 (인메모리 상태 소실)**
- 위치: `execution-engine.service.ts` – `pendingContinuations` Map
  ```typescript
  private readonly pendingContinuations = new Map<string, { ... }>();
  ```
- 상세: `pendingContinuations`는 프로세스 메모리에만 존재한다. 서버가 재시작되면 DB에는 `execution.status = WAITING_FOR_INPUT` 레코드가 남지만, 대응하는 Promise resolver가 소실된다. 이 상태의 실행은 영구적으로 `waiting_for_input` 상태에 고착되며 재개가 불가능하다.
- 제안: 서버 시작 시(`OnModuleInit` 또는 `OnApplicationBootstrap`) DB에서 `status = WAITING_FOR_INPUT`인 실행을 조회하여 `FAILED` 또는 `CANCELLED`로 전환하는 복구 로직 추가:
  ```typescript
  async onModuleInit() {
    // 기존 초기화 로직...
    
    // 인메모리 상태 소실로 인한 고착 실행 복구
    const stuckExecutions = await this.executionRepository.find({
      where: { status: ExecutionStatus.WAITING_FOR_INPUT },
    });
    for (const exec of stuckExecutions) {
      exec.status = ExecutionStatus.CANCELLED;
      exec.finishedAt = new Date();
      await this.executionRepository.save(exec);
    }
  }
  ```

---

**[INFO] `ExecutionStatus` enum 확장: DB 마이그레이션 안전성 확인 필요**
- 위치: `execution-engine.service.ts`, `executions.service.ts`, `execution.entity` (간접)
- 상세: `WAITING_FOR_INPUT` 상태가 추가되었다. TypeORM 엔티티의 `status` 컬럼이 PostgreSQL `ENUM` 타입으로 정의된 경우, `ALTER TYPE ... ADD VALUE` DDL은 트랜잭션 내에서 실행 불가(PostgreSQL 12 이전) 또는 마이그레이션 순서 문제가 발생할 수 있다. `varchar` 타입이면 영향 없다.
- 제안: 엔티티의 `status` 컬럼 타입 확인 후, PostgreSQL ENUM인 경우 마이그레이션에서 `ADD VALUE IF NOT EXISTS`를 별도 트랜잭션 밖에서 실행하도록 처리.

---

**[INFO] `cancelWaitingExecution` / `stop()` 간 경쟁 조건**
- 위치: `executions.service.ts` – `stop()` + `execution-engine.service.ts` – `cancelWaitingExecution()`
- 상세: REST `POST /executions/:id/stop`(→ `executionsService.stop()`)와 `cancelWaitingExecution()` 모두 실행을 취소할 수 있다. `stop()`은 DB에서 직접 `CANCELLED`로 전환하고, `cancelWaitingExecution()`은 Promise reject → 예외 처리 경로로 취소한다. 두 경로가 동시에 호출되면 `execution.status`가 두 번 `CANCELLED`로 저장되는 중복 쓰기가 발생할 수 있다. 현재 구조에서는 치명적이지 않지만, 추후 로직이 추가될 경우 문제가 될 수 있다.
- 제안: `stop()` 호출 시 `cancelWaitingExecution()`도 함께 호출하거나, DB 업데이트 전 상태를 재확인하는 낙관적 락(optimistic lock) 또는 `UPDATE ... WHERE status = 'waiting_for_input'` 조건부 쿼리 사용 검토.

---

### 요약

이번 변경에서 데이터베이스 관점의 핵심 문제는 두 가지다. 첫째, `waitForFormSubmission`에서 `execution`과 `node_execution` 테이블에 대한 다중 쓰기 연산이 트랜잭션으로 보호되지 않아, 폼 제출 재개 과정에서 서버 장애 시 두 테이블 간 상태 불일치가 발생할 수 있다. 둘째, 실행 대기 상태(`WAITING_FOR_INPUT`)가 인메모리 Map에만 의존하므로 서버 재시작 시 DB에 고착 레코드가 남는 구조적 문제가 있다. `node_execution(execution_id, node_id)` 인덱스 누락도 쿼리 성능에 영향을 미칠 수 있다. 나머지 변경사항(프론트엔드 스토어, WebSocket 레이어, 스펙 문서)은 DB와 무관하다.

### 위험도
**MEDIUM**