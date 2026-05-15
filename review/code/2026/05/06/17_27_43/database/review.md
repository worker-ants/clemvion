충분한 코드를 확인했습니다. 데이터베이스 관점에서 분석합니다.

---

### 발견사항

- **[WARNING] N+1 쓰기 + 트랜잭션 부재 — `recoverStuckExecutions()`**
  - 위치: `execution-engine.service.ts` L339–360
  - 상세: `find({ where: { status: WAITING_FOR_INPUT } })` 로 복수의 실행 행을 조회한 뒤, `for...of` 루프 안에서 `await this.executionRepository.save(execution)` 를 개별 호출합니다. stuck 실행이 N개라면 N번의 `UPDATE` 쿼리가 트랜잭션 없이 순차 실행됩니다. 루프 도중 서버가 재기동되면 일부는 `FAILED`, 나머지는 여전히 `WAITING_FOR_INPUT` 상태로 남아 DB 정합성이 깨집니다.
  - 제안: `QueryRunner` 또는 `DataSource.transaction()` 으로 묶거나, `UPDATE ... WHERE status = 'WAITING_FOR_INPUT'` 단일 벌크 쿼리로 대체하세요.

---

- **[WARNING] in-memory 뮤텍스의 다중 프로세스 한계 — `appendExecutionPath()`**
  - 위치: `execution-engine.service.ts` L1317–1340
  - 상세: `executionPathChain` Map은 단일 NestJS 프로세스 내에서만 직렬화를 보장합니다. 수평 확장(복수 인스턴스) 환경에서는 서로 다른 서버가 동시에 동일 `executionId` 에 대해 `findOneBy → 배열 수정 → save` 를 수행하면 last-write-wins 손실이 발생합니다. `executionPath` 컬럼은 JSON 배열이므로 DB 레벨의 atomic 연산(e.g., `array_append` / `JSON_ARRAYAGG` + 낙관적 잠금)이 없으면 단일 프로세스 보장이 무의미합니다.
  - 제안: `executionPath` 를 별도 테이블(`execution_path_entries`)로 분리하여 `INSERT`로 원자적으로 추가하거나, 낙관적 잠금(`@VersionColumn`) 과 재시도를 결합하세요.

---

- **[WARNING] 복합 인덱스 누락 — `NodeExecution` 조회**
  - 위치: `execution-engine.service.ts` L1391–1394, L1608–1611, L1950–1953 (`findOne({ where: { executionId, nodeId }, order: { startedAt: 'DESC' } })`)
  - 상세: `waitForFormSubmission`, `waitForAiConversation`, `waitForButtonInteraction` 세 곳에서 `(executionId, nodeId)` 필터 + `startedAt DESC` 정렬을 사용합니다. `NodeExecution` 에 `(execution_id, node_id, started_at DESC)` 복합 인덱스가 없으면, 워크플로 실행 이력이 쌓일수록 이 쿼리가 풀스캔에 가까워집니다.
  - 제안: 마이그레이션에 `CREATE INDEX idx_ne_exec_node_started ON node_execution(execution_id, node_id, started_at DESC)` 를 추가하세요.

---

- **[WARNING] 트랜잭션 없는 상태 전이 — RUNNING → WAITING_FOR_INPUT → RUNNING**
  - 위치: `execution-engine.service.ts` L1374–1492, L1594–1901, L1917–2213
  - 상세: 세 종류의 blocking 대기 흐름 모두 `updateExecutionStatus(…, WAITING_FOR_INPUT)`, `nodeExecutionRepository.save(nodeExec)`, 이후 `updateExecutionStatus(…, RUNNING)` 를 트랜잭션 없이 순차 저장합니다. 사용자 입력 대기 중 서버가 죽으면 `Execution`은 `WAITING_FOR_INPUT`, `NodeExecution`은 `RUNNING` 처럼 서로 불일치하는 상태가 될 수 있으며, 시작 시 `recoverStuckExecutions`가 `Execution` 행만 복구하고 `NodeExecution`은 그대로 둡니다.
  - 제안: 상태 전이 묶음을 `DataSource.transaction()` 으로 래핑하거나, `NodeExecution` 복구 로직도 `recoverStuckExecutions`에 포함하세요.

---

- **[WARNING] 무제한 JSON 컬럼 증가 — `outputData` / `_resumeState`**
  - 위치: `execution-engine.service.ts` L1720–1737 (AI conversation loop), `waitForAiConversation` 전체
  - 상세: `_resumeState.turnDebugHistory` 는 대화 턴마다 `LlmCallRecord[]` 항목이 누적됩니다. 각 항목이 `requestPayload`/`responsePayload` (전체 LLM 요청·응답) 를 포함하면 `NodeExecution.outputData` 컬럼이 수십 MB까지 증가할 수 있습니다. 이는 PostgreSQL TOAST 팽창, 슬로우 쿼리, 백업 비용을 유발합니다.
  - 제안: DB 저장 시점에 `turnDebugHistory` 를 최대 N개로 슬라이스하거나, `requestPayload`/`responsePayload` 를 별도 오브젝트 스토리지로 오프로드하고 참조만 저장하세요.

---

- **[INFO] 동일 레코드 중복 조회 — `executeSync()`**
  - 위치: `execution-engine.service.ts` L799, L828, L852
  - 상세: `savedExecution` 을 생성·저장한 뒤, 에러 핸들러(L828)와 완료 확인(L852)에서 각각 `findOneBy({ id: savedExecution.id })` 를 다시 수행합니다. 총 2회의 추가 SELECT이며, `savedExecution` 객체를 직접 갱신해도 동일 목적을 달성할 수 있습니다.
  - 제안: 각 분기에서 인메모리 `savedExecution` 객체를 직접 업데이트하고 save하는 방식으로 SELECT를 제거하세요.

---

- **[INFO] 테스트 픽스처가 DB 행동을 검증하지 않음**
  - 위치: `execution-engine.service.spec.ts` L149–214
  - 상세: 모든 Repository가 `jest.fn()` 목으로 대체되어 인덱스, 제약, 트랜잭션, 동시성 동작이 테스트 레벨에서 전혀 검증되지 않습니다. 특히 `appendExecutionPath` 의 직렬화 보장, `recoverStuckExecutions` 의 원자성은 통합 테스트 없이는 확인 불가합니다.
  - 제안: 핵심 DB 경쟁 조건(executionPath 동시 append, stuck 복구 중 재시동) 에 대한 통합 테스트를 별도로 작성하세요.

---

### 요약

`execution-engine.service.ts` 는 TypeORM Repository를 통해 `Execution`, `NodeExecution`, `Node`, `Edge`, `Workflow` 등 5개 엔티티와 지속적으로 상호작용하는 DB 중심 서비스입니다. 주요 문제는 세 가지입니다. 첫째, `recoverStuckExecutions` 의 N+1 쓰기가 트랜잭션 없이 루프 실행되어 부분 복구 위험이 있습니다. 둘째, `appendExecutionPath` 의 in-memory 뮤텍스가 단일 프로세스에서만 유효하여 수평 확장 시 `executionPath` 데이터 손실이 발생할 수 있습니다. 셋째, blocking 상태 전이(RUNNING ↔ WAITING_FOR_INPUT)가 트랜잭션 없이 다중 저장 호출로 처리되어 서버 충돌 시 `Execution`과 `NodeExecution` 간 상태 불일치가 생깁니다. 추가로 `(execution_id, node_id, started_at DESC)` 복합 인덱스 누락과 AI 대화 노드의 무제한 JSON 누적이 장기적 성능 저하 요인입니다. `node-handler.interface.ts` 는 순수 인터페이스 정의라 DB와 직접 관련이 없고, `spec.ts` 는 목 기반 단위 테스트라 DB 동작 자체는 검증하지 않습니다.

### 위험도

**MEDIUM**