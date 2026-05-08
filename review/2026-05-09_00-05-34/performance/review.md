## 발견사항

---

### [CRITICAL] V035 마이그레이션 — 대형 테이블에서 전체 테이블 락 + 단일 트랜잭션 위험

- **위치**: `V035__execution_node_log.sql`, `executeInTransaction=true`
- **상세**: `executeInTransaction=true` 로 `INSERT...SELECT` + `ALTER TABLE DROP COLUMN` 을 하나의 트랜잭션에 묶었다. `ALTER TABLE DROP COLUMN` 은 `ACCESS EXCLUSIVE` 락을 획득하므로, INSERT가 끝날 때까지 `execution` 테이블의 모든 읽기/쓰기가 차단된다. 수백만 건의 execution 행이 있는 운영 환경에서는 락 보유 시간이 수십 분에 달할 수 있고, 그 동안 신규 실행이 전혀 생성되지 않는다. 또한 UNNEST 결과 전체를 한 번의 INSERT...SELECT로 처리하므로 정렬 + 버퍼링에 대한 메모리 압박도 크다.
- **제안**: 파일 주석에서도 언급된 것처럼 V035a/V035b 분리를 강력히 권장한다. V035a는 `executeInTransaction=false` 로 `CREATE TABLE + INSERT...SELECT` 만 수행(운영 중 점진적 이행, 락 없음). V035b는 별도 배포 시점에 `DROP COLUMN` 만 수행. 마이그레이션 규모가 크다면 `INSERT...SELECT` 도 `LIMIT 10000` + 루프(PL/pgSQL 또는 배치 스크립트)로 청크 처리를 고려한다.

---

### [WARNING] `appendExecutionPath` — ParallelExecutor 환경에서 개별 INSERT 폭주 가능

- **위치**: `execution-engine.service.ts`, `appendExecutionPath()`
- **상세**: 구 구현은 promise chain으로 직렬화했으나, 신 구현은 각 노드 완료 시 즉시 단건 `INSERT`를 발행한다. `ParallelExecutor` 가 N개 브랜치를 동시에 실행하면 `appendExecutionPath` 가 동시에 N번 호출되어 N개의 개별 DB 왕복이 발생한다. 예컨대 10-branch parallel 워크플로에서 각 브랜치가 5노드라면 한 실행에 50번의 개별 INSERT가 일어난다. 기존 직렬화 체인보다 throughput은 높지만, 연결 풀 포화나 DB 과부하 위험이 있다.
- **제안**: `INSERT` 는 append-only이고 BIGSERIAL 순서가 자동 보장되므로 병렬 INSERT 자체는 올바르다. 다만 `executionNodeLogRepository.insert([{ executionId, nodeId }, ...])` 형태의 배치 INSERT API를 제공하면 ParallelExecutor 완료 시 N건을 한 번에 커밋할 수 있다. 혹은 `executeNode` 완료 훅에서 일괄 수집 후 삽입하는 패턴도 고려 가능하다.

---

### [WARNING] Continuation Bus — N 인스턴스 전체 fan-out 비용

- **위치**: `continuation-bus.service.ts`, `publish()` / `dispatch()`
- **상세**: 모든 사용자 입력 이벤트(continue, cancel, button_click 등)가 Redis pub/sub으로 전체 인스턴스에 broadcast된다. 인스턴스 K개 중 K-1개는 로컬 Map에 키가 없어 dispatch 후 즉시 return한다. 인스턴스가 많아지면 Redis publish 1회당 K번의 JSON.parse + Map 조회가 발생한다. 또한 고빈도 multi-turn AI 대화 시나리오에서는 메시지가 초당 수십 건에 달할 수 있다.
- **제안**: 단기적으로는 현재 설계로 충분하다(코드 주석에서도 ms 단위 RTT로 무시 가능하다고 언급). 장기적으로 인스턴스 수가 20+로 증가한다면 `execution:{executionId}:continuation` 처럼 executionId-specific 채널을 쓰거나, sticky session / routing hint를 추가해 fan-out 범위를 줄이는 것을 검토할 수 있다.

---

### [WARNING] `findById` — DB 왕복 증가 (기존 2→3회)

- **위치**: `executions.service.ts`, `findById()`
- **상세**: execution 조회 + nodeExecutions 조회에 `execution_node_log` 조회가 추가되어 단건 상세 조회 시 최소 3번(부모 워크플로 있으면 4번)의 DB 왕복이 발생한다. 각 호출은 독립적이므로 직렬 실행이다.
- **제안**: `nodeExecutions`와 `executionNodeLog` 는 같은 `executionId`로 조회하는 독립 쿼리이므로 `Promise.all([nodeExecQuery, pathQuery])` 로 병렬화하면 RTT를 2회로 줄일 수 있다.

```typescript
const [nodeExecutions, pathRows] = await Promise.all([
  this.nodeExecutionRepository.find({ ... }),
  this.executionNodeLogRepository.find({ ... }),
]);
```

---

### [WARNING] `id` BIGSERIAL → TypeScript `string` 타입 매핑 — 정렬 위험

- **위치**: `execution-node-log.entity.ts:21`, `executions.service.ts` `order: { id: 'ASC' }`
- **상세**: `@PrimaryGeneratedColumn({ type: 'bigint' })` 는 PostgreSQL에서 `bigint`이지만 TypeScript에서 `string`으로 매핑된다. `repository.find({ order: { id: 'ASC' } })` 는 TypeORM이 SQL `ORDER BY id ASC` 로 변환하므로 DB 수준에서는 수치 정렬이 보장된다. 그러나 애플리케이션 코드에서 `id` 값을 직접 비교(예: `log1.id < log2.id`)하면 문자열 사전순 정렬이 되어 `"9" > "10"` 같은 오류가 발생한다. 현재 코드는 DB ORDER BY에만 의존하므로 즉각적 버그는 없지만, 미래 기여자가 string 비교로 정렬을 구현할 위험이 있다.
- **제안**: `id: number` (JS Number 범위 초과 시 손실) 대신 `id: bigint` native type 또는 DB에서 `integer` + 충분히 큰 sequence로 유지하거나, 코드 주석으로 "DB ORDER BY만 사용할 것"을 명시한다.

---

### [INFO] `created_at` 컬럼 — BIGSERIAL 대비 중복 정보

- **위치**: `execution-node-log.entity.ts:33`, `V035__execution_node_log.sql:23`
- **상세**: 실행 순서의 source of truth는 BIGSERIAL `id`이며, `created_at`은 별도 인덱스 없이 추가된다. 스토리지 오버헤드(8 bytes × row 수)와 INSERT 시 `NOW()` 평가 비용이 소량 발생한다.
- **제안**: 현재는 디버깅/감사 목적으로 유용할 수 있으므로 제거보다는 유지를 권장하되, 이 컬럼으로 정렬하거나 범위 쿼리가 필요해지면 별도 인덱스를 추가해야 한다.

---

### [INFO] `FakeRedis.quit()` — O(n²) listener 필터링 (테스트 코드)

- **위치**: `continuation-bus.service.spec.ts`, `FakeRedis.quit():54`
- **상세**: `list.filter((l) => !this.listeners.includes(l))` 에서 `includes`가 O(n) 이므로 리스너 수가 많으면 O(n²)이다. 테스트 코드이고 리스너 수가 매우 적으므로 실제 영향은 없다.

---

## 요약

이번 변경의 핵심 성능 관점은 두 가지다. 첫째, `execution_node_log` 로의 이행 마이그레이션(V035)이 `executeInTransaction=true` + DDL 포함 단일 트랜잭션으로 구성되어 대규모 운영 DB에서 전체 테이블 락 및 서비스 중단 위험이 있다 — 이것이 유일한 CRITICAL 항목이다. 둘째, `appendExecutionPath` 의 단순화로 per-node 개별 INSERT 패턴이 도입되어 ParallelExecutor 환경에서 DB 왕복이 증가하며, `findById` 의 sequential 3-query 패턴도 `Promise.all` 병렬화로 개선 여지가 있다. Continuation Bus의 fan-out 설계와 BIGSERIAL→string 매핑 이슈는 현재 규모에서는 수용 가능하나 향후 성장 시 재검토가 필요하다.

## 위험도

**HIGH** (V035 마이그레이션 운영 적용 시 단일 트랜잭션 DDL 락 위험)