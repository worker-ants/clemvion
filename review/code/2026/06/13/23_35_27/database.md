# 데이터베이스(Database) 리뷰 결과

## 발견사항

### [INFO] V095 partial 복합 인덱스 — 설계 타당
- 위치: `codebase/backend/migrations/V095__node_execution_exec_status_active_index.sql`
- 상세: `(execution_id, status) WHERE status IN ('waiting_for_input','running')` partial 인덱스는 핫 경로(resolveWaitingNodeExecutionId, running 조회/UPDATE)와 정확히 일치한다. 완료(대다수) 행을 제외해 인덱스 크기와 write amplification을 최소화한 설계가 적절하다. `CREATE INDEX CONCURRENTLY IF NOT EXISTS`로 운영 중 무중단 적용되고, `executeInTransaction=false` conf 파일이 동봉되어 Flyway 비-트랜잭션 모드도 준수한다. DOWN 주석(`DROP INDEX CONCURRENTLY`)도 있다.
- 제안: 현 설계 유지. 단, HNSW가 아닌 B-tree 인덱스이므로 §4·§5의 `.conf executeInTransaction=false` 1-statement 컨벤션은 만족하나, 추후 인덱스 실효성을 `EXPLAIN ANALYZE`로 확인하는 것을 권장한다.

### [INFO] execution guarded UPDATE — 파라미터화 확인
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (updateExecutionStatus else 분기, 라인 ~9309)
- 상세: 도입된 raw SQL UPDATE는 `$1~$7` 위치 파라미터를 배열로 전달하고 있다. 사용자 입력이 직접 쿼리 문자열에 보간되지 않으므로 SQL 인젝션 위험 없음. `output_data::jsonb`, `resume_call_stack::jsonb` 캐스트가 올바르게 처리된다.
- 제안: 이상 없음.

### [INFO] execution guarded UPDATE — `status IN ('pending','running','waiting_for_input')` 가드 적절성
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- 상세: else 분기(RUNNING→COMPLETED, pending→RUNNING 등)에서 status 가드로 동시 cancel/park 선점 시 0행 매칭 → false 반환 → emit skip 하는 설계는 lost-update 문제를 해결한다. 단, 이 else 분기는 "COMPLETED 전이"만을 대상으로 한다고 JSDoc에 명시되어 있으나, assertTransition 검사가 선행되므로 의도치 않은 전이가 이 경로로 내려오는 것은 차단된다.
- 제안: 이상 없음. 호출부가 `linkedNodeExec` 분기와 else 분기를 분리하는 것이 명확하게 문서화되어 있다.

### [INFO] computeChainDepth 재귀 CTE — N+1 해소 확인
- 위치: `codebase/backend/src/modules/executions/executions.service.ts`
- 상세: 기존 `re_run_of`를 하나씩 따라가는 직렬 SELECT N왕복을 재귀 CTE 단일 쿼리로 교체했다. `WHERE c.depth < $2`(`RERUN_CHAIN_WALK_MAX`) 가드로 사이클 방어가 포함되어 있다. 파라미터화 쿼리(`$1`, `$2`)로 SQL 인젝션 안전하다. PK 및 V067(re_run_of) 인덱스로 커버된다고 명시되어 마이그레이션 불요.
- 제안: 이상 없음.

### [INFO] integration-expiry-scanner keyset 페이지네이션 — 대량 데이터 대응 적절
- 위치: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts`
- 상세: 무제한 `find()` → id keyset cursor 배치(500건)로 교체. `id > lastId` + `ORDER BY id ASC` + `take: 500`의 keyset 페이지네이션이다. UUID id에 대해 PK 인덱스가 존재하면 효율적으로 동작한다. `tokenExpiresAt`와 `status` 필터를 복합 인덱스가 커버하는지는 보이지 않으나, SCAN_BATCH_SIZE=500으로 배치를 나눠 메모리/쿼리 시간 폭발은 방지된다.
- 제안: `tokenExpiresAt`와 `status` 컬럼에 복합 인덱스(`status, tokenExpiresAt`)가 없다면, 대량 integration 환경에서 배치 쿼리가 seq scan으로 전락할 수 있다. 기존 인덱스 커버리지를 `EXPLAIN`으로 확인하고, 없다면 별도 마이그레이션 추가를 검토할 것.

### [INFO] findAdminUserIdsByWorkspaces — N+1 해소 확인
- 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts`
- 상세: 기존 per-integration `findAdminUserIds` N+1을 단일 `find({ workspaceId: In([...]) })` 배치 쿼리로 교체했다. `workspace_member` 테이블의 `(workspace_id, role)` 인덱스 존재 여부에 따라 성능이 갈리지만, 쿼리 횟수는 O(N)→O(1)으로 개선된다.
- 제안: `workspace_member` 테이블에 `(workspace_id, role)` 복합 인덱스가 없다면, 다수 워크스페이스를 `IN`으로 조회할 때 성능 저하가 발생할 수 있다. 기존 인덱스 확인 권장.

### [INFO] workflow-versions findByWorkflow select 최적화
- 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`
- 상세: `snapshot`(JSONB, 노드/엣지 전체 포함) 컬럼을 목록 조회에서 제외하는 TypeORM `select` 절이 추가되었다. 목록 호출당 대형 JSONB를 over-fetch하지 않도록 하는 의미있는 최적화다. `relations: { creator: true }` 형식은 `relations: ['creator']`와 기능상 동일하나 TypeORM 최신 API를 따른다.
- 제안: 이상 없음. 상세 조회(`findOne`)는 여전히 `relations: ['creator']`를 사용하는데, 일관성을 위해 객체 형식으로 통일하는 것을 고려할 수 있으나 기능 영향 없음.

### [INFO] DB_POOL_CONNECTION_TIMEOUT_MS=0 (무한 대기) 기본값
- 위치: `codebase/backend/.env.example`, `codebase/backend/src/common/config/database.config.ts`
- 상세: `connectionTimeoutMillis=0`은 node-postgres의 기본값(연결 대기 무제한)과 일치하며, 기존 동작 보존 의도가 주석으로 명확하게 기재되어 있다. 운영 환경에서 DB 연결 포화 시 요청이 무한정 큐잉될 수 있으나, 이는 기존과 동일한 동작이며 env로 상향 가능하도록 노출되었다.
- 제안: 운영 환경에서는 `DB_POOL_CONNECTION_TIMEOUT_MS`를 적절한 값(예: 5000ms)으로 설정해 연결 포화 시 빠른 오류 응답을 보장하는 것을 권장한다. 현재 기본값 0은 기존 동작 유지 목적으로 허용 가능하다.

### [INFO] reEmbedAll UPDATE RETURNING id — SELECT 왕복 제거
- 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`
- 상세: UPDATE 후 별도 SELECT를 제거하고 `UPDATE ... RETURNING id`로 통합한 것은 DB 왕복 1회 절감이며 올바른 최적화다. `dataSource.query<{ id: string }[]>(...)` 타입 어노테이션이 명시되어 있다.
- 제안: 이상 없음.

### [INFO] enqueueEmbedChunked 내 embedding_status='failed' rollback 쿼리
- 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` (enqueueEmbedChunked, 라인 ~623–643)
- 상세: `UPDATE document SET embedding_status = 'failed' WHERE id = ANY($1::uuid[])` — 파라미터 `[slice]`를 배열로 전달한다. `slice`가 `string[]`이므로 `$1::uuid[]`로 캐스팅이 정상 동작한다. SQL 인젝션 안전하다.
- 제안: 이상 없음.

### [INFO] migrations/README.md 섹션 6 추가 — 마이그레이션 안전성 가이드 보강
- 위치: `codebase/backend/migrations/README.md`
- 상세: ALTER COLUMN TYPE의 테이블-rewrite 위험과 binary-coercible 판별, shadow column 3-step, CONCURRENTLY 인덱스 재생성 절차가 명확하게 문서화되었다. 특히 `SET lock_timeout` 선행 패턴과 대형 테이블 rewrite 방지 방안이 구체적이다.
- 제안: 이상 없음. 운영 마이그레이션 안전성 가이드로 충분하다.

---

## 요약

이번 변경은 데이터베이스 관점에서 다수의 핵심 개선을 포함한다. (1) V095 partial 복합 인덱스로 node_execution 활성 상태 조회 핫 경로를 커버하고 CONCURRENTLY로 무중단 적용한다. (2) execution 상태 전이를 full-entity save에서 guarded raw UPDATE(`status IN (비-terminal)`)로 교체해 동시 cancel/park와의 lost-update 문제를 해결했다. (3) computeChainDepth의 N+1 직렬 SELECT를 재귀 CTE 단일 쿼리로 교체, findAdminUserIdsByWorkspaces로 integration scanner의 per-workspace N+1을 제거, integration keyset 페이지네이션으로 대량 데이터 스캔을 500건 배치로 분할했다. (4) workflow-version 목록에서 대형 snapshot JSONB의 over-fetch를 제거했다. (5) 커넥션 풀 파라미터를 env로 노출해 운영 튜닝 경로를 확보했다. 모든 raw 쿼리는 위치 파라미터화되어 SQL 인젝션 위험이 없다. 마이그레이션 가이드(§6)도 ALTER COLUMN TYPE rewrite 안전 절차로 보강되었다. 발견된 이슈는 모두 INFO 수준이며, `integration` 테이블의 `(status, tokenExpiresAt)` 인덱스 존재 여부와 `workspace_member` 테이블의 `(workspace_id, role)` 인덱스 존재 여부 확인을 권장한다.

## 위험도

LOW
