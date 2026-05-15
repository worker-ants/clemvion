## 발견사항

### [WARNING] 독립적인 쿼리 3건의 순차 실행
- **위치**: `background-runs.service.ts` — `getBackgroundRun()` 메서드
- **상세**: `findBackgroundNodeExecution`으로 `parentNodeExecutionId`를 얻은 뒤 `fetchBodyPage`, `aggregateBodyStatus`, `fetchNotifications` 3건을 순차 실행한다. 세 쿼리는 서로 독립적이며 `fetchNotifications`는 초기부터 알고 있는 `backgroundRunId`만 필요해 더 일찍 병렬화할 수 있다. 단일 API 호출당 DB 왕복 5회가 발생한다.
- **제안**:
  ```typescript
  const [pageRows, aggregate, notifications] = await Promise.all([
    this.fetchBodyPage(parentNodeExecutionId, cursor, limit),
    this.aggregateBodyStatus(parentNodeExecutionId),
    this.fetchNotifications(backgroundRunId),
  ]);
  ```

---

### [WARNING] `fetchBodyPage`의 전체 엔티티 하이드레이션
- **위치**: `background-runs.service.ts:fetchBodyPage()` — `.getMany()` 호출
- **상세**: `getMany()`는 `inputData`, `outputData`, `error` 컬럼 3개의 JSONB를 포함한 전체 엔티티를 로딩한다. 페이지당 최대 50행 × 각 행의 JSONB 크기가 메모리 부담이 될 수 있다. DTO가 이 필드를 그대로 노출하므로 불필요한 로딩은 아니나, 필드를 명시적으로 `.select()`해 컬럼 수를 제한하면 네트워크/파싱 비용을 줄일 수 있다.
- **제안**: `.select(['ne.id', 'ne.executionId', 'ne.nodeId', ...필요한 컬럼만])`으로 선택적 로딩.

---

### [WARNING] `parent_node_execution_id` 인덱스 부재 확인 필요
- **위치**: `V047` 마이그레이션, `background-runs.service.ts:fetchBodyPage()` / `aggregateBodyStatus()`
- **상세**: `fetchBodyPage`와 `aggregateBodyStatus` 모두 `WHERE ne.parentNodeExecutionId = :id`로 조회한다. 이 컬럼에 인덱스가 없으면 `node_execution` 테이블 전체 스캔이 발생한다. V047은 `output_data #>> '{meta,backgroundRunId}'` 인덱스만 추가했다. 기존 마이그레이션에서 `parentNodeExecutionId` 인덱스가 이미 존재하는지 확인이 필요하다. 존재하지 않는다면 별도 마이그레이션 필수.
- **제안**: `CREATE INDEX IF NOT EXISTS idx_node_execution_parent_id ON node_execution (parent_node_execution_id)` 확인 또는 추가.

---

### [WARNING] cursor 정렬 키와 복합 인덱스 불일치
- **위치**: `background-runs.service.ts:fetchBodyPage()` — `orderBy('ne.startedAt', 'ASC').addOrderBy('ne.id', 'ASC')`
- **상세**: 페이지네이션 정렬 키가 `(startedAt ASC, id ASC)`인데, 효율적인 cursor 조회를 위해서는 `(parent_node_execution_id, started_at, id)` 복합 인덱스가 필요하다. 현재는 `parentNodeExecutionId` 단일 인덱스(있다면)로 필터 후 전체 정렬이 발생할 수 있다. 본문 노드가 많아질수록 filesort 비용이 증가한다.
- **제안**: `CREATE INDEX idx_ne_parent_started_id ON node_execution (parent_node_execution_id, started_at ASC, id ASC)` 추가.

---

### [INFO] `useMemo(() => nodes, [nodes])` — 아무 효과 없는 메모화
- **위치**: `background-run-section.tsx:NodeExecutionsList()` — line ~180
- **상세**: `const sorted = useMemo(() => nodes, [nodes])`는 변환 없이 `nodes` 참조를 그대로 반환한다. 메모화 오버헤드(deps 추적, 캐시 저장)만 발생시키며 이득이 없다.
- **제안**: `const sorted = nodes;`로 단순화.

---

### [INFO] WS 이벤트마다 전체 쿼리 재실행
- **위치**: `use-background-run.ts` — `handler` 함수
- **상세**: WS 이벤트 수신 시 `invalidateQueries`로 전체 API를 재호출한다. 이벤트 payload에 `status`, `completedAt`, `durationMs`가 포함되어 있으므로, 상태 전환 이벤트는 캐시를 직접 업데이트(`setQueryData`)하고 `completed`/`failed` 이벤트에서만 전체 refetch하는 방식이 더 효율적이다. 현재는 5초 polling과 WS 이벤트 양쪽이 모두 전체 재조회를 트리거한다.
- **제안**: `execution.background_run.completed` 수신 시에만 `invalidateQueries`, `started` 이벤트는 `setQueryData`로 local 업데이트.

---

### [INFO] `verifyBackgroundRunOwnership`의 N+1 join chain
- **위치**: `background-runs.service.ts:verifyBackgroundRunOwnership()`
- **상세**: WS 구독 시마다 `ne → execution → workflow` 3단 join이 실행된다. WebSocket 구독은 연결 시 1회이므로 빈도가 낮아 실질적 문제는 아니다. 다만 `backgroundRunId` → `executionId` 역조회에 V047 인덱스를 활용하는 현재 구조는 올바르다.

---

## 요약

전체적으로 DB 설계가 탄탄하다. V047 부분 expression 인덱스, CONCURRENTLY DDL, cursor 페이지네이션 적용 등 성능을 의식한 설계가 보인다. 주요 개선점은 두 가지다: 단일 API 호출 내 5개의 순차 쿼리 중 마지막 3개를 `Promise.all`로 병렬화하면 레이턴시를 1/3 수준으로 줄일 수 있고, `parent_node_execution_id + started_at + id` 복합 인덱스가 없다면 cursor 페이지네이션의 정렬 효율이 떨어진다. 프론트엔드의 `useMemo` 오용은 미미한 수준이지만 제거가 바람직하다.

## 위험도

**MEDIUM** — 기능 정확성에는 문제 없으나, 트래픽이 늘어나거나 본문 노드가 많아질 때 DB 부하가 예상보다 빠르게 증가할 수 있는 구조적 요인이 존재한다.