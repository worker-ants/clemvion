# Requirement Review — spec/data-flow/3-execution.md

## 발견사항

### **[INFO]** 변경 범위 — 단일 셀 수정 (§2.1 Schema 매핑 테이블)
- 위치: `spec/data-flow/3-execution.md` §2.1 Postgres 매핑 표, `node_execution` 노드 실행 시작 행의 "인덱스 / 제약" 셀
- 상세: 기존 `(execution_id)`, V034 `(execution_id, node_id, started_at DESC)` composite 뒤에 새 항목 `V095 (execution_id, status) WHERE status IN ('waiting_for_input','running') partial (활성 노드 조회/전이)` 을 추가하는 단일 줄 변경이다. 이 변경은 C-3 구현(V095 마이그레이션)에 동반하는 spec 동기화다.

### **[INFO]** spec 본문 일치 — `spec/1-data-model.md §3` 인덱스 표와 정합
- 위치: `spec/1-data-model.md:796`
- 상세: `1-data-model.md §3` NodeExecution 행(V095)은 `(execution_id, status) WHERE status IN ('waiting_for_input','running')`, 용도는 "rehydration `resolveWaitingNodeExecutionId` + running 조회/UPDATE 핫 경로. CONCURRENTLY, V095" 로 등재되어 있다. `data-flow/3-execution.md` 의 본 변경에 기재된 `V095 (execution_id, status) WHERE status IN ('waiting_for_input','running') partial (활성 노드 조회/전이)` 과 인덱스 컬럼·partial 조건·migration 번호가 일치한다.

### **[INFO]** 마이그레이션 SQL 과 spec 기술 일치
- 위치: `codebase/backend/migrations/V095__node_execution_exec_status_active_index.sql:20-22`
- 상세: SQL 파일의 `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_node_execution_exec_status_active ON node_execution (execution_id, status) WHERE status IN ('waiting_for_input', 'running')` 과 spec 변경의 기술 내용이 line-level 로 일치한다. `.conf` 에 `executeInTransaction=false` 도 정상 포함되어 있다.

### **[INFO]** `resolveWaitingNodeExecutionId` 실제 쿼리와 partial 조건 부합
- 위치: `execution-engine.service.ts:5230-5237`
- 상세: `resolveWaitingNodeExecutionId` 는 `status: NodeExecutionStatus.WAITING_FOR_INPUT` 단일 조건으로 조회한다. partial 인덱스의 두 값 중 `waiting_for_input` 이 이 경로를 커버하며, `running` 조회/UPDATE 경로(`:4384, :4451`)도 동일 partial 범위에 포함된다. spec 변경에 기술된 "(활성 노드 조회/전이)" 설명과 구현이 일치한다.

### **[INFO]** 엣지 케이스 — `completed/failed/cancelled/skipped` status 는 partial 에서 제외
- 상세: partial 범위 `IN ('waiting_for_input','running')` 은 terminal status 행을 인덱스에서 배제한다. spec 변경 셀 설명에 이 제외 이유가 없으나, `1-data-model.md §3` 해당 행에 "completed 계열은 `(execution_id, node_id, started_at DESC)` 가 커버하므로 partial 로 활성 행만 인덱싱" 으로 이미 명시되어 있다. `data-flow/3-execution.md` 변경 셀에는 간략 서술만 있어 정보가 비대칭이지만, 이것은 참조 문서 간 상세도 차이일 뿐 spec fidelity 위반이 아니다.

### **[INFO]** TODO/FIXME/HACK 없음
- 변경된 diff 에 미완성 작업을 시사하는 주석이 없다.

## 요약

본 변경은 `spec/data-flow/3-execution.md` §2.1 Postgres 매핑 표의 `node_execution` 행 인덱스 셀에 V095 partial 복합 인덱스 항목을 추가하는 단일 셀 spec 동기화다. `spec/1-data-model.md §3` 에 이미 등재된 V095 항목(`(execution_id, status) WHERE status IN ('waiting_for_input','running')`, CONCURRENTLY, V095)과 인덱스 컬럼·partial 조건·마이그레이션 번호가 완전히 일치하며, 실제 SQL 파일(`V095__node_execution_exec_status_active_index.sql`) 및 `resolveWaitingNodeExecutionId` 구현 쿼리와도 line-level 로 정합한다. 기능 완전성·에러 시나리오·데이터 유효성 관점의 결함은 없으며, spec 본문(두 spec 문서 간, 그리고 마이그레이션 구현과)이 일관된다.

## 위험도

NONE
