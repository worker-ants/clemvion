# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [WARNING] saveMemories 의 findSimilarFact → updateMemory/insertMemory 시퀀스에 TOCTOU 경쟁 조건
- **위치**: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `saveMemories` 내부 루프, `findSimilarFact` → `updateMemory` / `insertMemory` 경로
- **상세**: `findSimilarFact` (SELECT) 와 `updateMemory`/`insertMemory` (UPDATE/INSERT) 가 단일 트랜잭션으로 묶이지 않는다. BullMQ Worker 의 `concurrency: 2` 설정(`agent-memory-extraction.processor.ts` 라인 849)에 의해 같은 (workspace_id, scope_key) 에 대한 job 이 동시에 실행될 수 있다. 두 worker 가 `findSimilarFact` 에서 유사 fact 를 찾지 못해 둘 다 `insertMemory` 경로로 진입하면 의미적으로 동일한 fact 가 중복 INSERT 된다. Mem0 식 dedup 의 정확성은 깨지지만, 이후 FIFO evict 가 1000건 상한을 유지하므로 데이터 무결성(scope 크기 상한) 은 보존된다.
- **제안**: 같은 scope 에 대한 동시 저장을 DB 레벨 직렬화로 보호한다. 방법 A: `saveMemories` 전체를 트랜잭션으로 감싸고 `SELECT ... FOR UPDATE` 나 Advisory Lock(`pg_try_advisory_xact_lock(hashtext(workspace_id||scope_key))`)으로 scope 단위 직렬화. 방법 B: BullMQ job 에 `jobId: workspace_id:scope_key` 를 설정해 같은 scope 의 job 이 큐에서 중복 대기하지 않도록 dedup. 방법 C: INSERT 에 `ON CONFLICT` + 유사도 기반 conditional UPDATE 를 단일 SQL 로 구현(복잡도 높음). 현재 `concurrency: 2` 를 1로 낮추는 것은 단기 회피책이 되지만 처리량을 희생한다.

### [WARNING] evictExpiredAndOldest 의 두 DELETE 문이 비원자적
- **위치**: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `evictExpiredAndOldest`
- **상세**: TTL 만료 row 삭제(1단계)와 FIFO 초과분 삭제(2단계)가 각각 독립적인 `dataSource.query` 호출이다. 두 DELETE 사이에 다른 worker 가 INSERT 를 하면 2단계의 `(workspace_id, scope_key)` 당 최신 N 개 보존 기준이 1단계 완료 직후 상태와 달라질 수 있다. 결과적으로 1단계 삭제 후 INSERT 된 row 가 2단계의 한도 계산에 포함되어 의도보다 적은 row 가 남거나 한도를 초과하는 케이스가 생긴다.
- **제안**: 두 DELETE 를 하나의 트랜잭션 안에서 실행한다. NestJS TypeORM DataSource 에서 `dataSource.transaction(async (em) => { ... })` 를 사용하거나, 두 DELETE 를 단일 CTE SQL (`WITH expired AS (DELETE ...), fifo AS (DELETE ...)`) 로 합쳐 원자성을 보장한다.

### [INFO] BullMQ concurrency: 2 와 scope 단위 직렬화 부재
- **위치**: `codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.processor.ts` — `@Processor(AGENT_MEMORY_EXTRACTION_QUEUE, { concurrency: 2 })`
- **상세**: 프로세서 레벨 동시성(2)이 설정되어 있으나, 같은 (workspace_id, scope_key) 쌍이 동시에 처리될 가능성을 제한하는 장치가 없다. 위 WARNING 1의 TOCTOU 문제의 근본 원인이기도 하다. 현재 `batchSeen` in-memory 배열은 단일 job 내 batch 중복만 커버하고, job 간(cross-job) 중복은 커버하지 않는다.
- **제안**: BullMQ `jobId` 를 `${workspaceId}:${scopeKey}:${timestamp}` 로 설정하거나, scope 단위 추출 빈도를 제한하는 rate limiter 를 추가하는 것을 검토한다. 장기적으로 scope-level DB 락이 가장 확실한 해법이다.

### [INFO] async/await 패턴 — 정상
- **위치**: `agent-memory.service.ts` 전체, `agent-memory-extraction.processor.ts`
- **상세**: `saveMemories`, `findSimilarFact`, `updateMemory`, `insertMemory`, `evictExpiredAndOldest` 모두 `async/await` 를 올바르게 사용하고 있다. await 누락이나 floating promise 가 없다.

### [INFO] SQL 인젝션 패리셜 위험 — ttlDays 리터럴 삽입
- **위치**: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `insertMemory`, `updateMemory` 에서 `expiresAtSql` 사용
- **상세**: `expiresAtSql = \`now() + INTERVAL '${ttlDays} days'\`` 는 `ttlDays` 가 숫자임을 호출부(`resolveMemoryTtlDays`)가 `Math.floor` + `Number.isFinite` + 양수 검사로 보장한다. 직접 SQL 문자열 리터럴 삽입이지만 타입 검증 체인이 충분히 강력해 SQL 인젝션 실질 위험은 없다. 다만 파라미터 바인딩(`$N`)으로 전환하는 것이 방어적으로 더 안전하다 (`INTERVAL '$1 days'` 는 PostgreSQL 에서 바인딩 불가이므로 `now() + ($1 * INTERVAL '1 day')` 형태로 대체 가능). 동시성 직접 이슈는 아님.

## 요약

변경의 핵심인 `saveMemories` 의미 dedup 로직(findSimilarFact → updateMemory/insertMemory)과 `evictExpiredAndOldest` 의 2단계 삭제가 DB 레벨 직렬화 없이 구현되어 있다. BullMQ `concurrency: 2` 환경에서 같은 (workspace_id, scope_key) 에 대한 job 이 동시에 실행될 경우, SELECT-then-INSERT TOCTOU 경쟁 조건으로 동일 fact 의 중복 저장이 발생할 수 있고, evict 의 두 DELETE 사이에 INSERT 가 끼어들면 1000건 상한 보장이 일시적으로 어긋날 수 있다. 데이터 손실이나 무한 증가 위험은 없으나 Mem0 식 dedup 정확도와 evict 일관성이 저하된다. 나머지 async/await 패턴, 이벤트 루프 블로킹, 스레드 안전성(Node.js 단일 스레드 이벤트 루프)은 정상이다.

## 위험도
MEDIUM
