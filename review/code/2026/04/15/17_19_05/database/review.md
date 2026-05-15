### 발견사항

- **[WARNING]** `emitExecutionSnapshot` 호출 시 구독 이벤트마다 DB 풀 조회 발생
  - 위치: `websocket.gateway.ts` — `handleSubscribe` → `emitExecutionSnapshot`
  - 상세: 클라이언트가 `execution:*` 채널을 구독할 때마다 `executionsService.findById(executionId)`를 호출합니다. `findById`가 내부적으로 `nodeExecutions` 관계를 eager load한다면, 동일한 executionId에 대해 다수의 클라이언트가 동시에 구독할 경우 각각 독립적인 DB 조회가 발생합니다. 결과 캐싱이나 deduplication 없이 매번 전체 실행 레코드 + 노드 실행 레코드를 JOIN 로드합니다.
  - 제안: 짧은 TTL(수 초)의 인메모리 캐시나 `Map<executionId, Promise>` 형태의 inflight deduplication을 적용하세요. 혹은 snapshot payload를 `nodeExecutions` 없이 가볍게 제공하고 필요 시 별도 REST로 가져오도록 분리할 수 있습니다.

- **[WARNING]** `inputData` JSONB 컬럼 저장 확대에 따른 행(row) 크기 증가
  - 위치: `execution-engine.service.ts` — `createNodeExecution` 및 다수의 `emitNodeEvent` 호출부
  - 상세: 기존에는 `inputData: {}`로 빈 객체만 저장하던 것을 이제 실제 노드 입력 데이터를 저장합니다. `outputData`, `interactionData`와 함께 노드 실행당 JSONB 컬럼이 3개로 늘어납니다. 워크플로우가 대용량 데이터(파일 내용, 대형 JSON 배열 등)를 노드 간에 전달하는 경우 `node_execution` 행 크기가 수십 KB ~ MB 수준으로 커질 수 있습니다. PostgreSQL JSONB 컬럼은 8KB 이상이면 TOAST로 분리되어 읽기 성능이 저하됩니다.
  - 제안: `inputData` 저장 시 크기 상한(예: 1MB)을 설정하거나, 대용량 데이터는 별도 스토리지(S3 등)에 저장 후 참조 URI만 DB에 보관하는 방식을 검토하세요.

- **[INFO]** `inputData` 타입 캐스팅의 잠재적 불일치
  - 위치: `execution-engine.service.ts:2731` — `inputData: (inputData ?? {}) as Record<string, unknown>`
  - 상세: `inputData`가 배열이나 원시값(string, number 등)인 경우에도 `Record<string, unknown>`으로 강제 캐스팅됩니다. TypeORM은 JSONB에 실제 값을 그대로 직렬화하므로 DB에는 올바르게 저장되지만, 타입 시스템이 거짓 보장을 제공합니다. 이후 코드가 `Record`로 가정하고 객체 접근 시 런타임 오류 가능성이 있습니다.
  - 제안: `inputData: (inputData ?? {}) as unknown as Record<string, unknown>` 대신 엔티티 필드를 `inputData: unknown`으로 타입을 넓히거나, 배열/원시값을 `{ value: inputData }` 형태로 정규화하세요.

- **[INFO]** `findById` 내부 쿼리 성능 — `nodeExecutions` 관계 로드
  - 위치: `websocket.gateway.ts:emitExecutionSnapshot`
  - 상세: snapshot 응답에 `execution.nodeExecutions`가 포함되므로(프런트엔드 핸들러 참조), `findById`는 `nodeExecutions`를 JOIN 또는 별도 쿼리로 로드합니다. `node_execution.execution_id`에 인덱스가 없다면 실행당 수십~수백 개의 노드 실행 레코드 조회 시 풀 스캔이 발생합니다. 기존 REST 폴링보다 구독 시점 1회 조회로 개선되었으나, 인덱스 유무를 확인해야 합니다.
  - 제안: `node_execution(execution_id)` 인덱스가 마이그레이션에 포함되어 있는지 확인하세요. TypeORM 엔티티에 `@Index(['executionId'])`가 선언되어 있어야 합니다.

---

### 요약

이번 변경의 핵심 DB 영향은 두 가지입니다. 첫째, `node_execution.inputData`에 실제 노드 입력 데이터를 저장하기 시작하면서 행 크기와 스토리지 사용량이 증가하며, 대용량 워크플로우에서는 TOAST 발생 및 snapshot 쿼리 성능 저하로 이어질 수 있습니다. 둘째, WebSocket 구독 시마다 `findById` DB 조회가 트리거되는 구조는 다중 클라이언트 환경에서 DB 부하 집중의 원인이 될 수 있습니다. 스키마 변경(컬럼 추가/변경)은 없어 마이그레이션 안전성 이슈는 없으며, N+1 문제나 트랜잭션 결함도 발견되지 않았습니다.

### 위험도
**LOW**