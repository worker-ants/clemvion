# DB 코드 리뷰 — agent-memory admin API (listScopes / listMemories / deleteMemory / clearScope)

**대상 diff**: `git diff 9f30216f..HEAD`
**파일**: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` (라인 494–658)
**인덱스 기준**: V073 `idx_agent_memory_scope(workspace_id, scope_key, created_at)`, V080 `idx_agent_memory_expires_at(expires_at) WHERE expires_at IS NOT NULL`

---

## WARNING

### W1 — listScopes: GROUP BY ORDER BY latest_updated_at 가 복합 인덱스를 활용하지 못해 filesort 발생

- **위치**: `agent-memory.service.ts:512–522` (listScopes SELECT 쿼리)
- **상세**:
  `idx_agent_memory_scope` 는 `(workspace_id, scope_key, created_at)` 3-컬럼 복합 인덱스다. `listScopes` 의 쿼리 플랜은 다음과 같이 전개된다.
  1. `WHERE workspace_id = $1` → 인덱스 prefix 매칭으로 workspace 행 범위를 필터 (인덱스 활용 O).
  2. `GROUP BY scope_key` → 이미 인덱스 순서(workspace_id, scope_key)와 일치해 Sort 없이 hash-agg 또는 index-scan 방향으로 처리 가능(양호).
  3. `MAX(am.updated_at)` → `updated_at` 컬럼은 인덱스에 없으므로 heap fetch 필요. 스코프 수 × 평균 메모리 수만큼 랜덤 I/O 발생.
  4. `ORDER BY latest_updated_at DESC` → `updated_at` 이 인덱스에 없으므로 GROUP BY 집계 결과를 **filesort** 처리. scope 수가 수백~수천이면 큰 문제가 아니지만, 워크스페이스가 대형(scope 수만 건 이상)이면 Sort 연산이 두드러진다.

  어드민 UI 는 OLTP hot path 가 아니므로 즉각 차단은 아니다. 단, 현재 인덱스 구조상 `MAX(updated_at)` 을 인덱스로 커버하는 방법이 없으며, 스코프 수가 증가할수록 filesort 비용이 선형 증가한다.
- **제안**:
  현재 구조에서 가장 저렴한 개선은 `(workspace_id, scope_key, updated_at)` 인덱스(별도 마이그레이션)를 추가해 `MAX(updated_at)` 을 인덱스-only scan 으로 커버하는 것이다. 단, 이미 created_at 인덱스가 있으므로 쓰기 오버헤드 trade-off를 검토할 것. 어드민 전용 read 빈도가 낮다면 현재 상태 허용 후 모니터링 우선.

---

### W2 — listScopes: COUNT(*) 서브쿼리가 데이터 쿼리와 별도 풀스캔 — 대형 워크스페이스에서 2× 집계 비용

- **위치**: `agent-memory.service.ts:525–533` (listScopes countRows 쿼리)
- **상세**:
  ```sql
  SELECT COUNT(*) AS total FROM (
    SELECT am.scope_key
    FROM agent_memory am
    WHERE am.workspace_id = $1
    GROUP BY am.scope_key
  ) sub
  ```
  이 쿼리는 데이터 쿼리와 독립적으로 전체 `(workspace_id, scope_key)` 를 다시 GROUP BY 한다. PostgreSQL 은 두 쿼리를 별도로 실행하므로 인덱스 스캔이 2회 발생한다. 워크스페이스당 메모리 수십만 건, scope 수천 개 수준에서는 COUNT 쿼리가 응답 latency 의 절반 이상을 차지할 수 있다.
- **제안**:
  단일 CTE 또는 윈도우 함수로 데이터와 total 을 같은 쿼리에서 가져온다.
  ```sql
  WITH base AS (
    SELECT scope_key, COUNT(*) AS cnt, MAX(updated_at) AS latest
    FROM agent_memory
    WHERE workspace_id = $1
    GROUP BY scope_key
  )
  SELECT scope_key, cnt, latest, COUNT(*) OVER () AS total_scopes
  FROM base
  ORDER BY latest DESC
  LIMIT $2 OFFSET $3
  ```
  `COUNT(*) OVER ()` 가 전체 scope 수를 파티션 없이 집계하므로 집계 패스가 1회로 줄어든다. 어드민 빈도 감안 시 중요도 MEDIUM 이나 코드 복잡도는 낮다.

---

### W3 — listMemories / listScopes: OFFSET 페이지네이션 — 대형 scope 에서 성능 저하

- **위치**: `agent-memory.service.ts:601` (listMemories OFFSET), `521` (listScopes OFFSET)
- **상세**:
  `LIMIT $n OFFSET $m` 방식은 PostgreSQL 이 OFFSET 행만큼 앞 rows 를 읽고 버린다. `(workspace_id, scope_key, created_at)` 인덱스가 있어 scope 내 스캔 자체는 인덱스를 타지만, OFFSET 이 수천 이상이 되면 I/O 비용이 선형 증가한다. listMemories 에서 spec 상 scope 당 최대 1000건(AGM-06)이므로 OFFSET 최대 ~970 정도가 현실적 상한이어서 listMemories 는 허용 범위다. 그러나 listScopes 는 scope 수에 제한이 없으며, 대형 워크스페이스(scope 수만 건)에서 마지막 페이지 OFFSET 이 수만이 되면 비용이 누적된다.
- **제안**:
  단기: `limit` 상한값을 DTO 레벨에서 100~200 으로 cap. 중기: keyset 페이지네이션(`WHERE (latest_updated_at, scope_key) < ($cursor_ts, $cursor_key) ORDER BY ... LIMIT n`) 으로 교체. listMemories 는 scope 당 1000건 상한 + 현재 limit=30 디폴트 → 현실적 위험 낮아 정보성 언급.

---

### W4 — listMemories: `metadata->>'kind'` 필터에 인덱스 없음 — 필터 선택도 낮을 때 부분 풀스캔

- **위치**: `agent-memory.service.ts:573, 612` (kindSql 적용 쿼리)
- **상세**:
  `AND am.metadata->>'kind' = $3` 조건은 JSONB 텍스트 추출 필터다. V073~V080 어디에도 `metadata` 또는 `metadata->>'kind'` 에 대한 인덱스가 없다. PostgreSQL 은 `(workspace_id, scope_key)` 범위 필터 후 남은 행에 대해 heap fetch → JSONB 추출 → 필터 순으로 처리한다. scope 당 최대 1000건이므로 절대적 row 수는 작지만, kind 별 비율이 치우치지 않을 경우(e.g., kind='preference' 가 10%) 필터 전 700~800건을 heap-fetch 해야 한다. 어드민 UI 빈도에서는 허용 가능하나 인덱스 부재가 의도적 결정인지 명시적으로 기록할 필요가 있다.
- **제안**:
  `kind` 필터 사용 빈도가 높거나 scope 당 메모리 수 상한이 올라가면 `CREATE INDEX ON agent_memory ((metadata->>'kind'))` 또는 `CREATE INDEX ON agent_memory (workspace_id, scope_key, (metadata->>'kind'))` partial 인덱스 추가를 고려. 지금은 scope 상한 1000건이므로 필수는 아님.

---

## INFO

### I1 — listScopes / listMemories: 2회 별도 쿼리 (데이터 + COUNT) — 커넥션 풀 사용 패턴은 정상

- **위치**: `agent-memory.service.ts:509–533` (listScopes), `577–613` (listMemories)
- **상세**:
  각 메서드에서 `this.dataSource.query()` 를 2회 호출한다. TypeORM `DataSource.query()` 는 호출마다 풀에서 커넥션을 획득하고 쿼리 완료 후 반환하는 패턴이다. 두 쿼리는 순차 `await` 로 실행되므로 커넥션 2회 점유(겹치지 않음). 단일 트랜잭션이 필요하지 않은 read-only 집계 쌍이라 현재 패턴은 적절하다.
  단, 두 쿼리 사이에 row 가 삽입/삭제될 경우 total 과 items 수가 미세하게 불일치할 수 있다 (어드민 UI에서는 허용 가능한 eventual consistency).
- **제안**: 총 개수 정합성이 요구된다면 단일 트랜잭션(REPEATABLE READ) 또는 W2 에서 제안한 CTE 단일 쿼리로 해결. 현재는 어드민 표시 목적이므로 INFO.

### I2 — deleteMemory: `WHERE id = $1 AND workspace_id = $2` — PK 단건 삭제 패턴 정상

- **위치**: `agent-memory.service.ts:638–643`
- **상세**: PK(`id`)로 먼저 필터하므로 Seq Scan 없이 index seek. `workspace_id` 추가 조건으로 교차 삭제 차단. RETURNING id 로 affected rows 계산. 정상 패턴.

### I3 — clearScope: `WHERE workspace_id = $1 AND scope_key = $2` — 인덱스 활용 및 대량 삭제 시 고려

- **위치**: `agent-memory.service.ts:651–657`
- **상세**: `idx_agent_memory_scope(workspace_id, scope_key, created_at)` 가 이 WHERE 조건의 prefix 2컬럼을 커버하므로 인덱스 스캔으로 대상 row 를 찾는다. scope 당 최대 1000건(AGM-06)이므로 단건 DELETE 배치보다 범위 DELETE 한 번이 효율적이며 현재 구현이 올바르다. RETURNING id 로 반환된 `result` 배열을 `result.length` 로만 사용해 embedding 벡터 등 큰 컬럼을 메모리에 로드하지 않는 점도 양호. 단, scope 당 행이 1000건을 초과하는 비정상 상태에서는 DELETE 가 auto-vacuum 을 자극해 table bloat 유발 가능 — spec 상 evict 로 1000건 상한이 유지되어야 하므로 현재는 허용.

### I4 — SQL 인젝션: 파라미터 바인딩 일관 사용 — 안전

- **위치**: 모든 쿼리
- **상세**: `$1~$N` 바인딩 파라미터 사용. LIMIT/OFFSET 도 `$2/$3` 형식으로 바인딩. `filterSql` / `kindSql` 은 조건부 SQL 절로 리터럴 보간이 아닌 파라미터 바인딩 위치만 조정. 입력값이 SQL 문자열에 직접 삽입되지 않으므로 injection 경로 없음. 안전.

### I5 — listScopes q 필터: ILIKE '%||$2||%' — GIN 인덱스 없음, LEADING WILDCARD 전체 스캔

- **위치**: `agent-memory.service.ts:507`
- **상세**: `scope_key ILIKE '%' || $2 || '%'` 는 leading wildcard 포함 패턴으로 B-tree 인덱스를 사용할 수 없다. `scope_key` 에 GIN/trigram 인덱스가 없으면 index 를 타지 못하고 workspace 내 전체 agent_memory 행을 seq scan 한다. 어드민 검색 빈도가 낮고 scope 수 수천 건 이하이면 실용상 무해하다. scope 수가 수만~수십만 이상 또는 검색 빈도가 높아지면 `pg_trgm` + GIN 인덱스(`gin_trgm_ops`) 추가를 고려할 것.

---

## 요약

새로 추가된 4개 메서드(`listScopes`, `listMemories`, `deleteMemory`, `clearScope`)는 전반적으로 안전하게 구현되어 있다. 파라미터 바인딩이 일관되고 workspace_id 격리가 모든 쿼리에 강제되며 embedding 컬럼을 SELECT 에서 제외한 설계도 올바르다. 기존 `(workspace_id, scope_key, created_at)` 복합 인덱스가 `listMemories` 의 ORDER BY created_at DESC 와 `clearScope` 의 WHERE 조건을 커버하는 것은 양호하다. 핵심 경고는 두 가지다. 첫째, `listScopes` 가 `MAX(updated_at)` 집계와 그에 따른 ORDER BY 를 처리할 때 `updated_at` 이 인덱스에 없어 filesort 가 발생하며(W1), 데이터 쿼리와 COUNT 쿼리가 분리되어 집계 비용이 2× 발생한다(W2). 둘째, 대형 워크스페이스에서 OFFSET 기반 페이지네이션이 선형 비용을 초래할 수 있다(W3). `metadata->>'kind'` 인덱스 부재(W4)는 scope 당 1000건 상한 덕분에 현재는 허용 범위이나 인덱스 추가 필요 여부를 의식적으로 검토해야 한다. 어드민 UI 의 낮은 호출 빈도를 감안하면 즉각 배포 차단 수준은 아니나, W2(단일 CTE 리팩터링)는 코드 변경 비용이 낮고 효과가 명확하므로 조기 적용을 권장한다.

---

## 위험도

**MEDIUM**

(W1/W2/W3 는 성능 degradation 경로이나 scope/row 상한이 현실적으로 낮아 즉각적 서비스 장애 수준은 아님. W4 는 인덱스 부재이나 데이터 규모 상한으로 허용. SQL injection 없음. 격리 패턴 정상.)

---

BLOCK: NO
