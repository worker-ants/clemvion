# Database 리뷰

## 발견사항

### 발견사항 1
- **[CRITICAL]** `expiresAtSql` 에 숫자 값을 직접 SQL 문자열에 보간 — SQL 인젝션 위험
  - 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `saveMemories` 내 `expiresAtSql` 생성 로직
  - 상세: `ttlDays` 는 `resolveMemoryTtlDays` 에서 `Math.floor(n)` 처리된 양의 정수이므로 실제 인젝션 가능성은 낮다. 그러나 `INTERVAL '${ttlDays} days'` 형태로 숫자를 SQL 리터럴에 직접 보간하는 패턴 자체는 위험하다. 향후 유사 패턴을 복사·확장할 때 검증 없는 값이 보간되면 인젝션이 가능하다. `insertMemory`, `updateMemory` 양쪽에서 `${expiresAtSql ?? 'NULL'}` 를 동적으로 SQL 문자열 안에 넣고 있다.
  - 제안: PostgreSQL 의 `now() + $N * INTERVAL '1 day'` 형태로 `ttlDays` 를 바인드 파라미터로 전달하거나, `INTERVAL '1 day' * $N` 표현식을 쓰도록 변경한다. 예:
    ```sql
    expires_at = CASE WHEN $5 IS NULL THEN NULL ELSE now() + ($5 * INTERVAL '1 day') END
    ```
    이렇게 하면 `ttlDays` 를 `number | null` 파라미터로 직접 바인딩할 수 있다.

---

### 발견사항 2
- **[WARNING]** `saveMemories` 의 N+1 쿼리 패턴 — 각 fact 별로 2회(findSimilarFact + INSERT/UPDATE) DB 쿼리 발생
  - 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `saveMemories` for 루프 (337행 이후)
  - 상세: 이전 구현은 bulk INSERT(values 배열 누적 후 단일 쿼리)였으나, dedup 도입으로 각 fact 마다 `findSimilarFact`(DB 쿼리 1) + `insertMemory` 또는 `updateMemory`(DB 쿼리 1) 총 items.length × 2 회 쿼리로 변경됐다. 배치 처리 중 동시에 여러 fact 가 추출될 경우 왕복 비용이 선형 증가한다. 비동기 추출 큐(BullMQ worker)에서 실행되므로 hot path 차단은 없지만, DB 커넥션을 장시간 점유하고 처리량이 저하된다.
  - 제안: 단기적으로 현재 구조는 허용 가능(비동기 큐, concurrency=2). 중장기적으로 fact 목록 임베딩 벡터를 배열로 모아 단일 쿼리(pgvector 의 `<=>` 연산자를 UNNEST 로 확장)로 유사 행을 일괄 조회하는 방향을 검토한다.

---

### 발견사항 3
- **[WARNING]** `saveMemories` 내 다중 쿼리가 트랜잭션 없이 실행됨 — 부분 실패 시 데이터 불일치 가능
  - 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `saveMemories` 전체 흐름
  - 상세: for 루프 안의 `findSimilarFact` → `insertMemory`/`updateMemory` 시퀀스와 루프 종료 후 `evictExpiredAndOldest` 가 모두 별도 쿼리로 실행된다. 루프 중간에 에러가 발생하면 일부 fact 는 저장되고 일부는 누락된 채 evict 가 실행되지 않을 수 있다. `evictExpiredAndOldest` 도 두 단계(TTL 삭제 + FIFO 삭제)가 분리돼 있어 1단계 후 실패 시 FIFO 초과 상태가 남는다.
  - 제안: `saveMemories` 전체를 `DataSource.transaction()` 으로 감싸거나, 최소한 `evictExpiredAndOldest` 의 두 단계를 단일 트랜잭션 내에서 실행한다. NestJS TypeORM 환경에서는 `this.dataSource.transaction(async (em) => { ... })` 패턴을 사용한다.

---

### 발견사항 4
- **[INFO]** V079 마이그레이션: `ALTER TABLE ADD COLUMN` 락 영향은 미미하나, `CREATE INDEX` 는 잠금 없이 실행되지 않음
  - 위치: `codebase/backend/migrations/V079__agent_memory_expires_at.sql`
  - 상세: `ALTER TABLE agent_memory ADD COLUMN expires_at TIMESTAMPTZ NULL` 은 PostgreSQL 에서 DEFAULT 없는 nullable 컬럼이므로 테이블 재작성 없이 카탈로그 업데이트만 일어나 실질적 락은 짧다. 그러나 뒤따르는 `CREATE INDEX` 는 표준 인덱스 생성으로 테이블 전체 읽기 락(ShareLock)을 건다. `agent_memory` 테이블이 크다면 인덱스 생성 중 INSERT/UPDATE 가 블로킹된다.
  - 제안: 무중단 배포 요건이 있다면 `CREATE INDEX CONCURRENTLY` 를 사용한다. Flyway 는 단일 트랜잭션 내에서 마이그레이션을 실행하는데 `CONCURRENTLY` 는 트랜잭션 내에서 실행 불가하므로, Flyway 의 `outOfOrder=false` + `mixed=true` 또는 별도 마이그레이션 파일로 분리(`V079a`, `V079b`)하거나 `flyway.executeInTransaction=false` 를 해당 파일에 마크해야 한다.

---

### 발견사항 5
- **[INFO]** `findSimilarFact` 의 cosine 유사도 필터와 인덱스 활용도
  - 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `findSimilarFact` SQL
  - 상세: `1 - (am.embedding::halfvec(dim) <=> $1::halfvec(dim)) >= $4` 형태의 쿼리는 pgvector 의 HNSW/IVFFlat 인덱스를 사용할 수 있으나, `ORDER BY ... DESC LIMIT 1` 패턴과 `WHERE ... >= threshold` 필터가 함께 쓰이면 인덱스 스캔 범위가 넓어질 수 있다. `expires_at IS NULL OR expires_at > now()` 조건이 추가돼 필터 선택도가 높지 않을 경우 seq scan 으로 전락할 수 있다.
  - 제안: 현재 구조에서 즉각적인 추가 인덱스는 불필요하나, 테이블 크기 증가 시 `(workspace_id, scope_key)` 복합 인덱스 위에 embedding HNSW 인덱스(`ops = vector_cosine_ops`)가 있는지 기존 마이그레이션(V072 등)을 확인한다.

---

## 요약

이번 변경의 핵심 DB 관련 사항은 세 가지다. (1) V079 마이그레이션은 nullable 컬럼 추가 자체는 안전하지만 `CREATE INDEX` 가 ShareLock 을 발생시키므로 대용량 테이블 환경에서 무중단 배포 시 `CONCURRENTLY` 로 분리해야 한다. (2) `saveMemories` 에서 `ttlDays` 를 SQL 문자열에 직접 보간하는 패턴은 현재 숫자 검증이 있어 실제 위험이 낮지만, 구조적으로 SQL 인젝션 패턴이므로 파라미터 바인딩으로 교체해야 한다. (3) dedup 도입으로 bulk INSERT 가 N+1 패턴으로 변경됐고 트랜잭션 없이 다중 쿼리가 실행돼 부분 실패 시 정합성 위협이 있다 — 비동기 큐이므로 hot path 영향은 없지만 트랜잭션 래핑이 권장된다.

## 위험도

MEDIUM
